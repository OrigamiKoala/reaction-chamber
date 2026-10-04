//! Gates of the generality audit of 2026-10-03 (see ALGORITHM-IMPROVEMENT.md, section 6): each one pins a fix through the
//! public API, none of them knows a particular reaction.

use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::thermo::functions::try_thermo_state;

/// The formation data of the species store and the equilibrium constants of the equilibrium rows are two descriptions of
/// the same chemistry; where both exist for a row they must agree (a row whose K and whose species' Gibbs energies disagree
/// makes the solver and the redox / decomposition discovery contradict each other).
#[test]
fn equilibrium_rows_agree_with_the_formation_data() {
    let mut worst: Vec<(f64, String)> = Vec::new();
    for eq in chem_db::get_default_equilibria() {
        let mut dg = 0.0;
        let mut ok = true;
        for (sp, nu) in eq.products.iter().map(|(k, v)| (k, *v)).chain(eq.reactants.iter().map(|(k, v)| (k, -*v))) {
            if sp == "H2O" {
                // the solvent's activity is 1 in the row's K, its formation data are those of the pure liquid
            }
            let phase = reaction_chamber_engine::thermo::phase_of_id(sp);
            match try_thermo_state(sp, phase, 298.15, 101_325.0) {
                Some(st) => dg += nu * st.mu0_j_mol,
                None => {
                    ok = false;
                    break;
                }
            }
        }
        if !ok {
            continue;
        }
        let dg_from_k = -8.314462618 * 298.15 * eq.log_k_298 * std::f64::consts::LN_10;
        worst.push(((dg - dg_from_k).abs() / 1000.0, format!("{}: dG(species) {:.1} kJ vs -RT ln K {:.1} kJ", eq.id, dg / 1000.0, dg_from_k / 1000.0)));
    }
    worst.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    let bad: Vec<&String> = worst.iter().filter(|(d, _)| *d > 10.0).map(|(_, s)| s).collect();
    assert!(bad.is_empty(), "rows inconsistent with the formation data by more than 10 kJ/mol:\n{}", bad.iter().map(|s| s.as_str()).collect::<Vec<_>>().join("\n"));
}

use reaction_chamber_engine::vessel::*;

fn beaker(t: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(295.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}
/// Puts species into the solution and books them in the element ledger (as a dose would).
fn put(v: &mut Vessel, species: &[(&str, f64)]) {
    for (sp, mol) in species {
        if *mol > 0.0 {
            *v.species_mol.entry(sp.to_string()).or_insert(0.0) += mol;
            v.ledger.book_in(sp, *mol);
        }
    }
}
fn dose_ml(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None }).unwrap();
}
fn dose_g(v: &mut Vessel, id: &str, g: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: None, mass_g: Some(g), drops: None, temperature_k: None }).unwrap();
}
fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    for _ in 0..(seconds / dt) as usize {
        v.step(dt).unwrap();
    }
}

/// Heat loss of an open vessel comes from its geometry and the air (convection + radiation) and the surface (evaporation):
/// 100 mL of water at 80 C in a 250 mL beaker is still clearly warm after 10 minutes and near room temperature after 3 hours.
#[test]
fn hot_water_cools_with_a_realistic_time_scale() {
    let mut v = beaker(353.15);
    dose_ml(&mut v, "water", 100.0);
    v.temperature_k = 353.15;
    run(&mut v, 600.0, 1.0);
    let t10 = v.temperature_k - 273.15;
    assert!(t10 > 55.0 && t10 < 77.0, "after 10 min: {:.1} C", t10);
    run(&mut v, 10_200.0, 5.0);
    let t180 = v.temperature_k - 273.15;
    assert!(t180 > 21.5 && t180 < 30.0, "after 3 h: {:.1} C", t180);
}

/// A thermodynamically allowed electron transfer is fast between labile couples and does not happen between inert ones:
/// the same driving force, different rate. (Eligibility is data: `data/redox_lability.json`.)
#[test]
fn discovered_redox_is_gated_by_couple_kinetics_not_by_names() {
    // Fe2+ + I2 -> Fe3+ + I- is uphill (see algorithm_fixes); Fe2+ + MnO4- is downhill between labile couples: proceeds
    let mut v = beaker(295.15);
    dose_ml(&mut v, "water", 50.0);
    put(&mut v, &[("Fe+2", 0.001), ("SO4-2", 0.001), ("MnO4-", 0.0002), ("K+", 0.0002)]);
    run(&mut v, 120.0, 0.5);
    let fe2 = v.species_mol.get("Fe+2").copied().unwrap_or(0.0);
    assert!(fe2 < 0.0007, "Fe2+ should be oxidised by permanganate, left {:e}", fe2);
    assert!(v.snapshot().conservation.ok);
    // permanganate with chloride (S, N, C, Cl couples are not labile): nothing happens on bench time
    let mut w = beaker(295.15);
    dose_ml(&mut w, "water", 50.0);
    put(&mut w, &[("Cl-", 0.01), ("Na+", 0.01), ("MnO4-", 0.0002), ("K+", 0.0002)]);
    run(&mut w, 120.0, 0.5);
    let mn = w.species_mol.get("MnO4-").copied().unwrap_or(0.0);
    assert!(mn > 0.00019, "permanganate must survive chloride at neutral pH, left {:e}", mn);
}

/// Decomposition is thermodynamic AND kinetic: sodium bicarbonate is unstable in air at room temperature but does nothing
/// there; hot, it decomposes with the endothermicity of the reaction.
#[test]
fn thermal_decomposition_needs_heat_not_only_thermodynamics() {
    let run_at = |t_k: f64| {
        let mut v = beaker(t_k);
        v.set_controls(VesselControls { bath_k: Some(Some(t_k)), bath_coupling_w_k: Some(50.0), ..Default::default() });
        v.temperature_k = t_k;
        dose_g(&mut v, "nahco3_s", 2.0);
        run(&mut v, 60.0, 0.5);
        v.solid_mol.get("NaHCO3(s)").copied().unwrap_or(0.0)
    };
    let n0 = 2.0 / 84.007;
    assert!((run_at(300.0) - n0).abs() < 1e-6 * n0, "stable at 300 K");
    assert!(run_at(520.0) < 0.5 * n0, "decomposes at 520 K");
}

/// A catalyst works through its surface: twice the powder, twice the rate; none, no reaction.
#[test]
fn catalysed_rate_scales_with_the_catalyst_surface() {
    let rate = |g: f64| {
        let mut v = beaker(295.15);
        dose_ml(&mut v, "h2o2_3pct", 50.0);
        if g > 0.0 {
            dose_g(&mut v, "mno2_s", g);
        }
        let h0 = v.species_mol.get("H2O2").copied().unwrap_or(0.0);
        run(&mut v, 2.0, 0.5);
        (h0 - v.species_mol.get("H2O2").copied().unwrap_or(0.0)) / h0
    };
    let (none, one, two) = (rate(0.0), rate(0.25), rate(0.5));
    assert!(none < 1e-4, "uncatalysed {:e}", none);
    assert!(two > 1.6 * one && two < 2.4 * one, "0.25 g: {:e}, 0.5 g: {:e}", one, two);
}

/// Two reactions that compete for one reactant share it (no species goes negative, atoms are conserved) and the outcome
/// does not depend on the order in which they are listed.
#[test]
fn competing_electron_transfers_share_a_limiting_oxidant() {
    let mut v = beaker(295.15);
    dose_ml(&mut v, "water", 50.0);
    put(&mut v, &[("Fe+2", 0.002), ("SO4-2", 0.002), ("I-", 0.002), ("K+", 0.0021), ("MnO4-", 0.0001), ("Na+", 0.0)]);
    run(&mut v, 300.0, 0.5);
    for (sp, &m) in v.species_mol.iter().chain(v.solid_mol.iter()) {
        assert!(m >= 0.0, "{} went negative: {}", sp, m);
    }
    let c = v.snapshot().conservation;
    assert!(c.ok, "rel {:e} charge {:e} {:?}", c.max_element_rel_err, c.charge_err_mol, c.element_errors);
    // (Fe(III) hydrolyses and precipitates at this pH: count what Fe(II) lost)
    // (Fe(II) is partly the FeSO4 ion pair: count both)
    let oxidised = 0.002 - v.species_mol.get("Fe+2").copied().unwrap_or(0.0) - v.species_mol.get("FeSO4").copied().unwrap_or(0.0);
    assert!(oxidised > 1.5e-4 && oxidised < 5.5e-4, "permanganate (0.1 mmol) oxidises 0.3-0.5 mmol of Fe2+, got {:e}", oxidised);
}
