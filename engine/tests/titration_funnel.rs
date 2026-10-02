//! Separatory-funnel draining (densest layer first) and the pH indicators used for titrations.
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::vessel::*;

/// Hexane, imported like the web layer does: the immiscible organic of the funnel tests. (Until Stage 5 the funnel tests
/// used ethanol, which the engine wrongly kept as a second layer on water; water and ethanol are miscible, so the
/// tests use a real immiscible pair.)
fn import_hexane() -> &'static str {
    let req = CompoundRequest {
        id: "tf_hexane".into(),
        name: "Hexane".into(),
        formula: "C6H14".into(),
        smiles: Some("CCCCCC".into()),
        inchi_key: Some("VLKZOEOYAKHREP-UHFFFAOYSA-N".into()),
        state: Some("liquid".into()),
        density: Some(0.659),
        t_melt_ref_k: Some(177.83),
        vapor_pressure_points: vec![[341.88, 101_325.0]],
        ..Default::default()
    };
    let m = model_compound(&req);
    assert!(m.modelable, "{}", m.reason);
    chem_db::register_custom_reagent(m.entry.clone().unwrap());
    if let Some(c) = &m.compound {
        chem_db::register_custom_compound(c.clone());
    }
    "tf_hexane"
}

fn flask() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "erlenmeyer-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5,
        temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0),
    })
}
fn dose_ml(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None }).unwrap();
}
fn drops(v: &mut Vessel, id: &str, n: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: None, mass_g: None, drops: Some(n), temperature_k: None }).unwrap();
}

#[test]
fn bottom_drain_takes_aqueous_before_the_lighter_organic_layer() {
    let hex = import_hexane();
    let mut v = flask();
    dose_ml(&mut v, "water", 30.0);
    dose_ml(&mut v, hex, 20.0);
    let (aq0, org0) = (v.aqueous_volume_ml(), v.organic_volume_ml());
    assert!(org0 > 15.0 && aq0 > 25.0);
    let p = v.remove_liquid_bottom(10.0, true).unwrap();
    assert!((p.volume_ml - 10.0).abs() < 1e-6);
    // only the aqueous phase leaves first, the ethanol layer is untouched
    assert!((v.organic_volume_ml() - org0).abs() < 1e-9, "the organic layer must stay");
    assert!((v.aqueous_volume_ml() - (aq0 - 10.0)).abs() < 1e-6);
    assert!(p.organic_mol.values().all(|m| *m == 0.0));
    // drain the rest of the aqueous phase and continue: the organic layer follows
    let rest = v.aqueous_volume_ml();
    let p2 = v.remove_liquid_bottom(rest + 5.0, true).unwrap();
    assert!(v.aqueous_volume_ml() < 1e-6, "aqueous layer drained: {}", v.aqueous_volume_ml());
    assert!((p2.volume_ml - (rest + 5.0)).abs() < 1e-6);
    assert!((v.organic_volume_ml() - (org0 - 5.0)).abs() < 1e-6);
}

#[test]
fn bottom_drain_conserves_species() {
    let hex = import_hexane();
    let mut v = flask();
    dose_ml(&mut v, "nacl_0_1m", 40.0);
    dose_ml(&mut v, hex, 10.0);
    let na0 = v.species_mol.get("Na+").copied().unwrap_or(0.0);
    let p = v.remove_liquid_bottom(15.0, true).unwrap();
    let na_left = v.species_mol.get("Na+").copied().unwrap_or(0.0);
    let na_out = p.aqueous_mol.get("Na+").copied().unwrap_or(0.0);
    assert!(((na_left + na_out) - na0).abs() < 1e-12);
    assert!(na_out > 0.0);
}

#[test]
fn default_remove_liquid_is_still_proportional() {
    let hex = import_hexane();
    let mut v = flask();
    dose_ml(&mut v, "water", 30.0);
    dose_ml(&mut v, hex, 20.0);
    let (aq0, org0) = (v.aqueous_volume_ml(), v.organic_volume_ml());
    assert!(aq0 > 25.0 && org0 > 15.0);
    v.remove_liquid(10.0, true).unwrap();
    let k = 1.0 - 10.0 / (aq0 + org0);
    assert!((v.aqueous_volume_ml() - aq0 * k).abs() < 1e-6);
    assert!((v.organic_volume_ml() - org0 * k).abs() < 1e-6);
}

#[test]
fn methyl_red_changes_colour_across_ph_5() {
    assert!(chem_db::get_reagent_catalog().iter().any(|r| r.id == "methyl_red_drop"));
    let mut acid = flask();
    dose_ml(&mut acid, "hcl_0_1m", 25.0);
    drops(&mut acid, "methyl_red_drop", 2.0);
    let mut base = flask();
    dose_ml(&mut base, "hcl_0_1m", 25.0);
    dose_ml(&mut base, "naoh_0_1m", 25.5);
    drops(&mut base, "methyl_red_drop", 2.0);
    let (sa, sb) = (acid.snapshot(), base.snapshot());
    let hin = |s: &VesselSnapshot, id: &str| s.species.iter().find(|x| x.id == id).map(|x| x.amount_mol).unwrap_or(0.0);
    assert!(hin(&sa, "HIn_mr") > 20.0 * hin(&sa, "In_mr-"), "red acid form dominates at low pH");
    assert!(hin(&sb, "In_mr-") > 20.0 * hin(&sb, "HIn_mr"), "yellow base form dominates at high pH");
}
