//! The state a vessel settles into must depend only on what is in it, never on how it was assembled:
//! one big solid dose, 10 portions and 250 portions of the same total mass give the same pH and species amounts.
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::vessel::*;

fn beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-100".into(), capacity_ml: 100.0, glass_mass_g: 50.0, inner_radius_cm: 2.5,
        temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0),
    })
}
fn dose_ml(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None }).unwrap();
}
fn dose_g(v: &mut Vessel, id: &str, g: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: None, mass_g: Some(g), drops: None, temperature_k: None }).unwrap();
}
fn import_solid(id: &str, formula: &str) {
    let m = model_compound(&CompoundRequest {
        id: id.into(), name: id.into(), formula: formula.into(), smiles: None, mw: None, density: None,
        state: Some("solid".into()), molarity: None, ghs: vec![], ..Default::default()
    });
    assert!(m.modelable, "{}: {}", id, m.reason);
    if let Some(e) = &m.entry { chem_db::register_custom_reagent(e.clone()); }
    if let Some(min) = &m.mineral { chem_db::register_custom_mineral(min.clone()); }
}

/// Doses `total_g` of `id` into `water_ml` of water in `n` equal portions; returns the vessel.
fn weigh_in(id: &str, total_g: f64, n: usize, water_ml: f64) -> Vessel {
    let mut v = beaker();
    dose_ml(&mut v, "water", water_ml);
    for _ in 0..n {
        dose_g(&mut v, id, total_g / n as f64);
    }
    v
}

fn amount(v: &Vessel, sp: &str) -> f64 { v.species_mol.get(sp).copied().unwrap_or(0.0) }

/// pH is the same for 1 / 10 / 250 portions and the speciation matches to a tight relative tolerance.
fn assert_dose_size_independent(id: &str, total_g: f64, water_ml: f64, species: &[&str]) -> f64 {
    let one = weigh_in(id, total_g, 1, water_ml);
    let ten = weigh_in(id, total_g, 10, water_ml);
    let many = weigh_in(id, total_g, 250, water_ml);
    let (p1, p10, p250) = (one.current_ph(), ten.current_ph(), many.current_ph());
    assert!((p1 - p250).abs() < 0.05, "{}: pH 1 dose {:.3} vs 250 doses {:.3}", id, p1, p250);
    assert!((p10 - p250).abs() < 0.05, "{}: pH 10 doses {:.3} vs 250 doses {:.3}", id, p10, p250);
    for sp in species {
        let (a, b) = (amount(&one, sp), amount(&many, sp));
        assert!((a - b).abs() <= 0.02 * a.max(b) + 1e-12, "{}: {} {:e} vs {:e}", id, sp, a, b);
    }
    // stepping time on (equilibria only, no degassing below Henry saturation) must not drift the pH either
    let mut stepped = weigh_in(id, total_g, 1, water_ml);
    for _ in 0..40 { stepped.step(0.1).unwrap(); }
    assert!((stepped.current_ph() - p1).abs() < 0.05, "{}: pH drifted {:.3} -> {:.3}", id, p1, stepped.current_ph());
    p1
}

#[test]
fn nahco3_ph_is_independent_of_dose_size() {
    let ph = assert_dose_size_independent("nahco3_s", 2.5, 50.0, &["Na+", "HCO3-", "CO3-2", "CO2(aq)", "H+", "OH-"]);
    // ideal 0.6 M bicarbonate: pH = (pK1 + pK2)/2 ~ 8.3 (real solutions ~8.3 too)
    assert!(ph > 8.0 && ph < 8.5, "NaHCO3 pH {:.3}", ph);
}

#[test]
fn nahco3_conserves_sodium_and_carbon() {
    let v = weigh_in("nahco3_s", 2.5, 1, 50.0);
    let mol = 2.5 / 84.007;
    assert!((amount(&v, "Na+") - mol).abs() < 1e-9);
    let carbon = amount(&v, "HCO3-") + amount(&v, "CO3-2") + amount(&v, "CO2(aq)");
    assert!((carbon - mol).abs() < 1e-9, "carbon {} vs {}", carbon, mol);
    // charge balance
    let q = amount(&v, "Na+") + amount(&v, "H+") - amount(&v, "OH-") - amount(&v, "HCO3-") - 2.0 * amount(&v, "CO3-2");
    assert!(q.abs() < 1e-9, "charge imbalance {}", q);
}

#[test]
fn na2co3_ph_is_independent_of_dose_size() {
    import_solid("dp_na2co3_s", "CNa2O3");
    let ph = assert_dose_size_independent("dp_na2co3_s", 1.5, 50.0, &["Na+", "HCO3-", "CO3-2", "OH-"]);
    assert!(ph > 11.0 && ph < 12.0, "Na2CO3 pH {:.3}", ph);
}

#[test]
fn naoh_ph_is_independent_of_dose_size() {
    import_solid("dp_naoh_s", "HNaO");
    let ph = assert_dose_size_independent("dp_naoh_s", 0.2, 50.0, &["Na+", "OH-"]);
    assert!(ph > 12.5 && ph < 13.5, "NaOH pH {:.3}", ph);
}

#[test]
fn nahco3_exceeding_solubility_is_path_independent() {
    // 12 g in 50 mL is beyond the ~1.1 M solubility: a solid bed must remain, same amount either way
    let one = weigh_in("nahco3_s", 12.0, 1, 50.0);
    let many = weigh_in("nahco3_s", 12.0, 120, 50.0);
    let (s1, s2) = (one.solid_mol.get("NaHCO3(s)").copied().unwrap_or(0.0), many.solid_mol.get("NaHCO3(s)").copied().unwrap_or(0.0));
    assert!(s1 > 1e-3, "undissolved solid expected, got {}", s1);
    assert!((s1 - s2).abs() < 0.02 * s1 + 1e-6, "undissolved {} vs {}", s1, s2);
    assert!((one.current_ph() - many.current_ph()).abs() < 0.05);
}
