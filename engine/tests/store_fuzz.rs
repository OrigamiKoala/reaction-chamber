//! Store-wide random-mixture audit: charge-balanced mixtures of *any* species of the species store (not only the catalog
//! reagents that `audit_invariants.rs` draws from), heated / stirred / sealed, must keep every invariant that holds for every
//! reaction: finite numbers, non-negative amounts, the element ledger (what went in through `add_portion` is somewhere), mass,
//! bounded temperature and pH. Nothing here knows a reaction; the mixtures are whatever the generator draws, which reaches
//! the discovered redox, the decompositions, the electrodes' neighbours, the flash of sealed vessels with species that have a
//! neat-liquid key and a dissolved key, the ion pairs and the complexes.
//!
//! It found, in the eighth audit pass, the sealed-flash double count of `Br2(l)` / `Br2(aq)` and (with a sibling probe) the
//! unbooked solids of an anodic oxidation. `FUZZ_N` / `FUZZ_START` widen the sweep (`FUZZ_N=200 cargo rtest --test store_fuzz`).

use std::collections::HashMap;

use reaction_chamber_engine::db::SpeciesStore;
use reaction_chamber_engine::vessel::*;

struct Lcg(u64);
impl Lcg {
    fn next(&mut self) -> f64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        ((self.0 >> 33) as f64) / ((1u64 << 31) as f64)
    }
    fn pick(&mut self, n: usize) -> usize {
        ((self.next() * n as f64) as usize).min(n - 1)
    }
}

fn vessel(sealed: bool) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(295.15),
        room_k: Some(295.15),
        sealed: Some(sealed),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

/// Species the generator may use: ions and dissolved molecules of the store (indicator dyes and the starch stand-ins are
/// structures the generator cannot balance), and solids.
fn pools() -> (Vec<(String, i32)>, Vec<(String, i32)>, Vec<String>, Vec<String>) {
    let store = SpeciesStore::default();
    let (mut cations, mut anions, mut neutrals, mut solids) = (vec![], vec![], vec![], vec![]);
    for r in store.iter() {
        let id = r.id.clone();
        if id.starts_with("ik:") || id.starts_with("HIn") || id.starts_with("In_") || id == "starch" || id == "starch_I3" {
            continue;
        }
        if id.ends_with("(s)") {
            solids.push(id);
            continue;
        }
        if id.ends_with("(g)") || id.ends_with("(l)") || id == "H2O" {
            continue;
        }
        let z = r.identity.charge;
        if z > 0 {
            cations.push((id, z));
        } else if z < 0 {
            anions.push((id, -z));
        } else if r.has_phase("aq") {
            neutrals.push(id);
        }
    }
    cations.sort();
    anions.sort();
    neutrals.sort();
    solids.sort();
    (cations, anions, neutrals, solids)
}

#[test]
fn random_store_mixtures_keep_every_ledger() {
    let (cations, anions, neutrals, solids) = pools();
    let n: u64 = std::env::var("FUZZ_N").ok().and_then(|s| s.parse().ok()).unwrap_or(16);
    let start: u64 = std::env::var("FUZZ_START").ok().and_then(|s| s.parse().ok()).unwrap_or(0);
    let mut failures: Vec<String> = Vec::new();
    for seed in start..start + n {
        let mut r = Lcg(seed.wrapping_mul(0x9E3779B97F4A7C15) ^ 0xD1B54A32D192ED03);
        let mut aq: HashMap<String, f64> = HashMap::new();
        let mut sol: HashMap<String, f64> = HashMap::new();
        let mut label = format!("seed {seed}:");
        for _ in 0..(1 + r.pick(3)) {
            let (c, zc) = &cations[r.pick(cations.len())];
            let (a, za) = &anions[r.pick(anions.len())];
            let amt = 1e-3 * (0.3 + 8.0 * r.next());
            // electroneutral: n_c z_c = n_a z_a
            *aq.entry(c.clone()).or_insert(0.0) += amt * *za as f64;
            *aq.entry(a.clone()).or_insert(0.0) += amt * *zc as f64;
            label += &format!(" {c}/{a}");
        }
        if r.next() < 0.5 {
            let s = &neutrals[r.pick(neutrals.len())];
            *aq.entry(s.clone()).or_insert(0.0) += 1e-3 * (0.3 + 6.0 * r.next());
            label += &format!(" +{s}");
        }
        if r.next() < 0.5 {
            let s = &solids[r.pick(solids.len())];
            *sol.entry(s.clone()).or_insert(0.0) += 1e-3 * (0.3 + 8.0 * r.next());
            label += &format!(" +{s}");
        }
        aq.insert("H2O".into(), 80.0 / 18.015);
        let heater = if r.next() < 0.3 { 100.0 + 300.0 * r.next() } else { 0.0 };
        let sealed = r.next() < 0.2;
        let mut v = vessel(sealed);
        let before = v.contents_mass_g() + v.mass_lost_g;
        let portion = Portion { volume_ml: 80.0, temperature_k: 295.15, aqueous_mol: aq, organic_mol: HashMap::new(), solid_mol: sol, particles: HashMap::new(), forms: HashMap::new() };
        v.add_portion(portion).unwrap();
        let dosed = v.contents_mass_g() + v.mass_lost_g - before;
        v.set_controls(VesselControls { heater_w: Some(heater), stirring: Some(true), stir_rpm: Some(300.0), ..Default::default() });
        let mut problems: Vec<String> = Vec::new();
        'run: for i in 0..160 {
            if let Err(e) = v.step(0.5) {
                problems.push(format!("step error {e}"));
                break;
            }
            if i % 20 != 19 {
                continue;
            }
            if !(v.temperature_k.is_finite() && v.temperature_k > 150.0 && v.temperature_k < 3000.0) {
                problems.push(format!("T {}", v.temperature_k));
                break;
            }
            for (sp, &m) in v.species_mol.iter().chain(v.solid_mol.iter()).chain(v.headspace_gas_mol.iter()) {
                if !(m.is_finite() && m >= -1e-12) {
                    problems.push(format!("{sp} = {m}"));
                    break 'run;
                }
            }
            let snap = v.snapshot();
            if !snap.conservation.ok {
                problems.push(format!(
                    "elements: rel {:e}, {:?}",
                    snap.conservation.max_element_rel_err,
                    snap.conservation.element_errors.iter().filter(|e| e.rel_err > 1e-6).map(|e| (e.element.clone(), e.abs_err_mol)).collect::<Vec<_>>()
                ));
                break;
            }
            if let Some(ph) = snap.ph {
                if !(ph.is_finite() && ph > -3.0 && ph < 18.0) {
                    problems.push(format!("pH {ph}"));
                    break;
                }
            }
            let mw = |sp: &String| reaction_chamber_engine::chem_db::get_species_thermo(sp).mw;
            let held = v.contents_mass_g();
            let gas: f64 = v.headspace_gas_mol.iter().map(|(sp, &m)| m * mw(sp)).sum();
            let collected: f64 = v.gas.collected_mol.iter().map(|(sp, &m)| m * mw(sp)).sum();
            let baseline: f64 = v.gas.seal_baseline_mol.iter().map(|(sp, &m)| m * mw(sp)).sum();
            let total = held + gas - baseline + collected + v.mass_lost_g;
            if (total - dosed).abs() > 3e-3 * dosed.abs().max(1.0) {
                problems.push(format!("mass {total:.5} g against {dosed:.5} g dosed"));
                break;
            }
        }
        if !problems.is_empty() {
            failures.push(format!("{label} (heater {heater:.0} W, sealed {sealed}): {:?}", problems));
        }
    }
    assert!(failures.is_empty(), "{} of {} mixtures broke an invariant:\n{}", failures.len(), n, failures.join("\n"));
}
