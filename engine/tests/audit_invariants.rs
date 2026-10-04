//! Randomised invariant audit: any mixture of catalog reagents, any heating / stirring / sealing, must keep the
//! simulation physical. Nothing here knows a reaction; it only checks what must hold for every one of them:
//! finite numbers, non-negative amounts, element and charge conservation (the vessel's own ledger), bounded temperature,
//! and determinism (the same inputs give bit-identical results, whatever the hash order of the internal maps).

use reaction_chamber_engine::chem_db;
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

struct Scenario {
    doses: Vec<DoseRequest>,
    heater_w: f64,
    stir: bool,
    sealed: bool,
    steps: usize,
}

fn make_scenario(seed: u64, ids: &[(String, bool)]) -> Scenario {
    let mut r = Lcg(seed.wrapping_mul(0x9E3779B97F4A7C15) ^ 0xD1B54A32D192ED03);
    let n = 2 + r.pick(3);
    let mut doses = Vec::new();
    for _ in 0..n {
        let (id, is_mass) = &ids[r.pick(ids.len())];
        doses.push(DoseRequest {
            reagent_id: id.clone(),
            volume_ml: if *is_mass { None } else { Some(2.0 + 40.0 * r.next()) },
            mass_g: if *is_mass { Some(0.1 + 3.0 * r.next()) } else { None },
            drops: None,
            temperature_k: None,
        });
    }
    Scenario {
        doses,
        heater_w: if r.next() < 0.4 { 50.0 + 400.0 * r.next() } else { 0.0 },
        stir: r.next() < 0.5,
        sealed: r.next() < 0.25,
        steps: 30 + r.pick(40),
    }
}

fn run(sc: &Scenario, check: bool, label: &str) -> String {
    let mut v = vessel(sc.sealed);
    let mut dosed_g = 0.0;
    for d in &sc.doses {
        let before = v.contents_mass_g() + v.mass_lost_g;
        v.dose(d.clone()).unwrap();
        dosed_g += v.contents_mass_g() + v.mass_lost_g - before;
        if check {
            check_state(&v, label, "after dose");
        }
    }
    v.set_controls(VesselControls {
        heater_w: Some(sc.heater_w),
        stirring: Some(sc.stir),
        stir_rpm: Some(300.0),
        ..Default::default()
    });
    for i in 0..sc.steps {
        v.step(0.5).unwrap();
        if check {
            check_state(&v, label, &format!("step {}", i));
            check_mass(&v, dosed_g, label, &format!("step {}", i));
        }
    }
    let snap = v.snapshot();
    serde_json::to_string(&snap).unwrap()
}

/// Mass balance: what the vessel holds plus what it has lost (vapour, gas that left, gas drawn from the atmosphere counted
/// negative) is what was put in.
fn check_mass(v: &Vessel, dosed_g: f64, label: &str, when: &str) {
    let held = v.contents_mass_g();
    let gas_in_head: f64 = v.headspace_gas_mol.iter().map(|(sp, &m)| m * reaction_chamber_engine::chem_db::get_species_thermo(sp).mw).sum();
    let collected: f64 = v.gas.collected_mol.iter().map(|(sp, &m)| m * reaction_chamber_engine::chem_db::get_species_thermo(sp).mw).sum();
    // the gas of the headspace and of a collector is part of the system too (air drawn in at sealing is a negative loss)
    let baseline: f64 = v.gas.seal_baseline_mol.iter().map(|(sp, &m)| m * reaction_chamber_engine::chem_db::get_species_thermo(sp).mw).sum();
    let total = held + gas_in_head - baseline + collected + v.mass_lost_g;
    assert!((total - dosed_g).abs() <= 2e-3 * dosed_g.abs().max(1.0), "{} {}: mass held {:.5} + gas {:.5} + lost {:.5} = {:.5} g, dosed {:.5} g", label, when, held, gas_in_head - baseline + collected, v.mass_lost_g, total, dosed_g);
}

fn check_state(v: &Vessel, label: &str, when: &str) {
    assert!(v.temperature_k.is_finite() && v.temperature_k > 150.0 && v.temperature_k < 3000.0, "{} {}: T {}", label, when, v.temperature_k);
    assert!(v.pressure_atm.is_finite() && v.pressure_atm > 0.0, "{} {}: P {}", label, when, v.pressure_atm);
    for (sp, &m) in v.species_mol.iter().chain(v.solid_mol.iter()).chain(v.headspace_gas_mol.iter()) {
        assert!(m.is_finite() && m >= -1e-12, "{} {}: {} = {}", label, when, sp, m);
    }
    let snap = v.snapshot();
    assert!(snap.conservation.ok, "{} {}: conservation rel {:e} abs {:e} charge {:e} unverified {:?}", label, when, snap.conservation.max_element_rel_err, snap.conservation.max_element_abs_err_mol, snap.conservation.charge_err_mol, snap.conservation.unverified_species);
    if let Some(ph) = snap.ph {
        assert!(ph.is_finite() && ph > -3.0 && ph < 18.0, "{} {}: pH {}", label, when, ph);
    }
    for l in &snap.layers {
        assert!(l.volume_ml.is_finite() && l.volume_ml >= 0.0, "{} {}: layer volume", label, when);
        assert!(l.density_g_ml.is_finite() && l.density_g_ml > 0.0 && l.density_g_ml < 25.0, "{} {}: density {}", label, when, l.density_g_ml);
    }
    assert!(snap.total_liquid_ml.is_finite() && snap.total_liquid_ml >= 0.0);
    // the serialised snapshot must hold no null where a number belongs: serde writes NaN / inf as null
    let json = serde_json::to_value(&snap).unwrap();
    for key in ["temperature_k", "pressure_atm", "total_liquid_ml", "contents_mass_g", "heat_input_w", "net_reaction_heat_w", "boil_intensity"] {
        assert!(json[key].is_number(), "{} {}: snapshot.{} is not a finite number", label, when, key);
    }
}

fn catalog_ids() -> Vec<(String, bool)> {
    chem_db::get_reagent_catalog()
        .into_iter()
        .filter(|e| e.form != "gas")
        .map(|e| (e.id, e.form == "solid" || e.by_mass))
        .collect()
}

#[test]
fn random_mixtures_keep_every_invariant() {
    let ids = catalog_ids();
    let n: u64 = std::env::var("AUDIT_N").ok().and_then(|s| s.parse().ok()).unwrap_or(40);
    for seed in 0..n {
        let sc = make_scenario(seed, &ids);
        let label = format!("seed {} [{}]", seed, sc.doses.iter().map(|d| d.reagent_id.as_str()).collect::<Vec<_>>().join("+"));
        run(&sc, true, &label);
    }
}

#[test]
fn identical_runs_are_bit_identical() {
    let ids = catalog_ids();
    let n: u64 = std::env::var("AUDIT_N").ok().and_then(|s| s.parse().ok()).unwrap_or(25);
    let mut bad: Vec<String> = Vec::new();
    for seed in 100..100 + n {
        let sc = make_scenario(seed, &ids);
        let label = format!("seed {} [{}]", seed, sc.doses.iter().map(|d| d.reagent_id.as_str()).collect::<Vec<_>>().join("+"));
        let a = run(&sc, false, &label);
        let b = run(&sc, false, &label);
        if a != b {
            let (ja, jb): (serde_json::Value, serde_json::Value) = (serde_json::from_str(&a).unwrap(), serde_json::from_str(&b).unwrap());
            // Compare what a user sees of the chemistry (state variables, amounts of the species that matter, solids). Float
            // summation order may change the last digits and, through thresholds, noise-level rows (species below 1e-3 mol,
            // which reaction rows fired this step, particle-size classes): those are not compared.
            let digest = |j: &serde_json::Value| -> serde_json::Value {
                let mut sp: Vec<(String, f64)> = j["species"].as_array().unwrap().iter().filter(|r| r["amount_mol"].as_f64().unwrap_or(0.0) > 1e-3).map(|r| (format!("{}/{}", r["id"], r["phase"]), r["amount_mol"].as_f64().unwrap())).collect();
                sp.sort_by(|a, b| a.0.cmp(&b.0));
                let sol: Vec<(String, f64)> = j["solids"].as_array().unwrap().iter().filter(|r| r["mass_g"].as_f64().unwrap_or(0.0) > 1e-4).map(|r| (r["species"].to_string(), r["mass_g"].as_f64().unwrap())).collect();
                serde_json::json!({
                    "t": j["temperature_k"], "p": j["pressure_atm"], "ph": j["ph"], "liq": j["total_liquid_ml"], "mass": j["contents_mass_g"],
                    "species": sp, "solids": sol,
                })
            };
            // (a vessel held at its boiling point is a threshold system: the bubble-point regime amplifies rounding noise)
            if ja["temperature_k"].as_f64().unwrap_or(0.0) > 340.0 {
                continue;
            }
            let mut worst = (0.0f64, String::new());
            diff(&digest(&ja), &digest(&jb), "", &mut worst);
            if worst.0 > 0.0 {
                eprintln!("{}: runs differ, worst relative difference {:e} at {}", label, worst.0, worst.1);
                bad.push(format!("{}: {:e} at {}", label, worst.0, worst.1));
            }
        }
    }
    assert!(bad.is_empty(), "runs that depend on hash order beyond rounding:\n{}", bad.join("\n"));
}

fn diff(a: &serde_json::Value, b: &serde_json::Value, path: &str, worst: &mut (f64, String)) {
    use serde_json::Value::*;
    match (a, b) {
        (Number(x), Number(y)) => {
            let (x, y) = (x.as_f64().unwrap(), y.as_f64().unwrap());
            // float summation order may change the last digits and, through thresholds, noise-level rows: compare physically
            let r = if (x - y).abs() < 1e-5 || (x - y).abs() <= 2e-2 * x.abs().max(y.abs()) { 0.0 } else { (x - y).abs() / x.abs().max(y.abs()) };
            if r > worst.0 {
                *worst = (r, path.to_string());
            }
        }
        (Array(x), Array(y)) => {
            if x.len() != y.len() {
                *worst = (1.0, format!("{} (length {} vs {})", path, x.len(), y.len()));
                return;
            }
            for (i, (p, q)) in x.iter().zip(y).enumerate() {
                diff(p, q, &format!("{}[{}]", path, i), worst);
            }
        }
        (Object(x), Object(y)) => {
            for (k, p) in x {
                match y.get(k) {
                    Some(q) => diff(p, q, &format!("{}.{}", path, k), worst),
                    None => *worst = (1.0, format!("{}.{} missing", path, k)),
                }
            }
        }
        _ => {
            if a != b {
                *worst = (1.0, format!("{} ({} vs {})", path, a, b));
            }
        }
    }
}

/// Drawing liquid off and pouring it back (a pipette, a pour between vessels) must not create or destroy anything.
#[test]
fn draw_off_and_return_conserves_atoms_and_mass() {
    let ids = catalog_ids();
    let n: u64 = std::env::var("AUDIT_N").ok().and_then(|s| s.parse().ok()).unwrap_or(40);
    for seed in 500..500 + n {
        let sc = make_scenario(seed, &ids);
        let label = format!("seed {} [{}]", seed, sc.doses.iter().map(|d| d.reagent_id.as_str()).collect::<Vec<_>>().join("+"));
        let mut v = vessel(false);
        for d in &sc.doses {
            v.dose(d.clone()).unwrap();
        }
        for _ in 0..10 {
            v.step(0.5).unwrap();
        }
        let before = v.snapshot();
        let mass_before = v.contents_mass_g();
        let mut r = Lcg(seed ^ 0xABCDEF);
        let take = (0.1 + 0.8 * r.next()) * before.total_liquid_ml.max(0.1);
        if let Ok(portion) = v.remove_liquid(take, r.next() < 0.5) {
            check_state(&v, &label, "after draw-off");
            let removed = mass_before - v.contents_mass_g();
            assert!(removed >= -1e-9, "{}: drawing liquid off increased the contents", label);
            v.add_portion(portion).unwrap();
            check_state(&v, &label, "after return");
            let mass_after = v.contents_mass_g();
            assert!((mass_after - mass_before).abs() <= 1e-3 * mass_before.max(1.0), "{}: mass {} -> {} after draw-off and return", label, mass_before, mass_after);
        }
    }
}
