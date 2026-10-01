//! Generic (non-catalog) chemistry: imported compounds are modelled from their formula and react through the
//! same solver; precipitation is driven by the solubility table / rules; the reaction log reports what happened.
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::vessel::*;

fn beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5,
        temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0),
    })
}

fn import(id: &str, name: &str, formula: &str, smiles: Option<&str>, state: &str) -> CompoundModel {
    let m = model_compound(&CompoundRequest {
        id: id.into(), name: name.into(), formula: formula.into(), smiles: smiles.map(|s| s.to_string()),
        mw: None, density: None, state: Some(state.into()), molarity: None, ghs: vec![],
    });
    if let Some(e) = &m.entry { chem_db::register_custom_reagent(e.clone()); }
    if let Some(min) = &m.mineral { chem_db::register_custom_mineral(min.clone()); }
    m
}

fn dose_ml(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None }).unwrap();
}
fn dose_g(v: &mut Vessel, id: &str, g: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: None, mass_g: Some(g), drops: None, temperature_k: None }).unwrap();
}
fn solid(v: &Vessel, sp: &str) -> f64 { v.solid_mol.get(sp).copied().unwrap_or(0.0) }

fn two_solutions(a: (&str, &str), b: (&str, &str), sp: &str, expect_mol: f64, colour_word: &str) {
    // a/b = (id, formula) of liquid imports (0.1 M default)
    let ma = import(a.0, a.0, a.1, None, "liquid");
    let mb = import(b.0, b.0, b.1, None, "liquid");
    assert!(ma.modelable && mb.modelable, "{:?} / {:?}", ma.reason, mb.reason);
    let mut v = beaker();
    dose_ml(&mut v, a.0, 25.0);
    assert_eq!(solid(&v, sp), 0.0, "no solid before mixing");
    dose_ml(&mut v, b.0, 25.0);
    let got = solid(&v, sp);
    assert!(got > expect_mol, "{} should precipitate: found {} mol", sp, got);
    let snap = v.snapshot();
    assert!(snap.solids.iter().any(|s| s.species == sp && s.mass_g > 0.0), "snapshot lists {}", sp);
    let ev: Vec<_> = snap.events.iter().filter(|e| e.kind == VesselEventKind::PrecipitateFormed).collect();
    assert_eq!(ev.len(), 1, "exactly one precipitate event, got {:?}", snap.events);
    let text = ev[0].detail.clone().unwrap().to_lowercase();
    assert!(text.contains("precipitate formed") && text.contains(colour_word), "event text {:?}", text);
    // Stepping must not repeat the event
    for _ in 0..200 { v.step(0.1).unwrap(); }
    let n = v.snapshot().events.iter().filter(|e| e.kind == VesselEventKind::PrecipitateFormed).count();
    assert_eq!(n, 1, "precipitate event must not be replayed every tick");
}

#[test]
fn kcl_solid_plus_agno3_gives_agcl_and_logs_it() {
    let kcl = import("t_kcl_s", "Potassium chloride", "ClK", Some("[Cl-].[K+]"), "solid");
    assert!(kcl.modelable, "{}", kcl.reason);
    assert!(kcl.by_mass);
    let mut v = beaker();
    dose_ml(&mut v, "agno3_0_1m", 25.0);
    dose_g(&mut v, "t_kcl_s", 0.5); // 6.7 mmol, > 2.5 mmol Ag+
    assert!(solid(&v, "AgCl(s)") > 0.002, "AgCl found {}", solid(&v, "AgCl(s)"));
    assert!(v.species_mol.get("K+").copied().unwrap_or(0.0) > 0.006, "KCl dissolved");
    let snap = v.snapshot();
    let evs: Vec<String> = snap.events.iter().filter_map(|e| e.detail.clone()).collect();
    assert!(evs.iter().any(|t| t.to_lowercase().contains("white precipitate formed: agcl")), "{:?}", evs);
}

#[test]
fn kcl_solution_plus_agno3() {
    let kcl = import("t_kcl_l", "Potassium chloride", "KCl", None, "liquid");
    assert!(kcl.modelable && !kcl.by_mass);
    let mut v = beaker();
    dose_ml(&mut v, "agno3_0_1m", 25.0);
    dose_ml(&mut v, "t_kcl_l", 25.0);
    assert!((solid(&v, "AgCl(s)") - 0.0025).abs() < 1e-4);
}

#[test]
fn nacl_solid_by_mass_dissolves_and_precipitates() {
    let m = import("t_nacl_s", "Sodium chloride", "ClNa", Some("[Na+].[Cl-]"), "solid");
    assert!(m.modelable);
    let mut v = beaker();
    dose_ml(&mut v, "agno3_0_1m", 25.0);
    dose_g(&mut v, "t_nacl_s", 1.0);
    assert!((solid(&v, "AgCl(s)") - 0.0025).abs() < 2e-4, "{}", solid(&v, "AgCl(s)"));
    assert_eq!(solid(&v, "NaCl(s)"), 0.0, "NaCl must dissolve in 25 mL");
}

#[test]
fn common_double_displacements() {
    two_solutions(("t_na2so4", "Na2O4S"), ("t_bacl2", "BaCl2"), "BaSO4(s)", 0.002, "white");
    two_solutions(("t_na2co3", "CNa2O3"), ("t_cacl2", "CaCl2"), "CaCO3(s)", 0.002, "white");
    two_solutions(("t_pbno32", "Pb(NO3)2"), ("t_ki", "IK"), "PbI2(s)", 0.001, "yellow");
    two_solutions(("t_k2cro4", "CrK2O4"), ("t_agno3", "AgNO3"), "Ag2CrO4(s)", 0.001, "");
    two_solutions(("t_fecl3", "FeCl3"), ("t_naoh", "NaOH"), "Fe(OH)3(s)", 0.001, "");
    two_solutions(("t_mgso4", "MgSO4"), ("t_koh", "KOH"), "Mg(OH)2(s)", 0.001, "white");
    two_solutions(("t_cuso4", "CuSO4"), ("t_na2s", "Na2S"), "CuS(s)", 0.001, "");
}

#[test]
fn soluble_pairs_stay_clear() {
    import("t_nacl", "NaCl", "NaCl", None, "liquid");
    import("t_kno3", "KNO3", "KNO3", None, "liquid");
    let mut v = beaker();
    dose_ml(&mut v, "t_nacl", 25.0);
    dose_ml(&mut v, "t_kno3", 25.0);
    assert!(v.solid_mol.values().all(|m| *m < 1e-7));
    assert!(v.snapshot().events.iter().all(|e| e.kind != VesselEventKind::PrecipitateFormed));
}

#[test]
fn agcl_dissolves_in_ammonia_but_agi_does_not() {
    import("t_ki2", "KI", "KI", None, "liquid");
    let mut a = beaker();
    dose_ml(&mut a, "agno3_0_1m", 10.0);
    dose_ml(&mut a, "nacl_0_1m", 10.0);
    dose_ml(&mut a, "nh3_2m", 10.0);
    assert_eq!(solid(&a, "AgCl(s)"), 0.0);
    let mut b = beaker();
    dose_ml(&mut b, "agno3_0_1m", 10.0);
    dose_ml(&mut b, "t_ki2", 10.0);
    dose_ml(&mut b, "nh3_2m", 10.0);
    assert!(solid(&b, "AgI(s)") > 0.0009, "AgI must survive ammonia, found {}", solid(&b, "AgI(s)"));
    let snap = b.snapshot();
    let s = snap.solids.iter().find(|s| s.species == "AgI(s)").unwrap();
    assert!(s.rgb[0] > s.rgb[2], "AgI is yellow, not white: {:?}", s.rgb);
}

#[test]
fn unmodelable_molecules_are_reported() {
    let glucose = import("t_glc", "Glucose", "C6H12O6", Some("C(C1C(C(C(C(O1)O)O)O)O)O"), "solid");
    assert!(!glucose.modelable, "{}", glucose.reason);
    let urea = import("t_urea", "Urea", "CH4N2O", Some("C(=O)(N)N"), "solid");
    assert!(!urea.modelable, "urea must not be mistaken for ammonium cyanate");
    let nh3 = import("t_nh3", "Ammonia", "H3N", Some("N"), "liquid");
    assert!(nh3.modelable && nh3.species[0].0 == "NH3", "{:?}", nh3.species);
    let hcl = import("t_hcl", "Hydrochloric acid", "ClH", Some("Cl"), "liquid");
    assert!(hcl.modelable);
    let mut v = beaker();
    dose_ml(&mut v, "t_hcl", 25.0);
    assert!(v.snapshot().ph.unwrap() < 1.5);
}

#[test]
fn log_reports_dissolving_solid_and_colour() {
    import("t_cuso4_s", "Copper sulfate pentahydrate", "CuSO4.5H2O", None, "solid");
    let mut v = beaker();
    dose_ml(&mut v, "water", 50.0);
    dose_g(&mut v, "t_cuso4_s", 1.0);
    let evs: Vec<String> = v.snapshot().events.iter().filter_map(|e| e.detail.clone()).collect();
    assert!(evs.iter().any(|t| t.contains("turned blue")) || evs.iter().any(|t| t.contains("turned")), "{:?}", evs);
    assert!(evs.iter().any(|t| t.contains("Solid gone") && t.contains("CuSO4")), "{:?}", evs);
}

#[test]
fn precipitate_settles_over_time() {
    let mut v = beaker();
    dose_ml(&mut v, "agno3_0_1m", 25.0);
    dose_ml(&mut v, "nacl_0_1m", 25.0);
    for _ in 0..10 { v.step(0.1).unwrap(); }
    let early = v.snapshot().solids[0].suspended_fraction;
    for _ in 0..150 { v.step(1.0).unwrap(); }
    let late = v.snapshot().solids[0].suspended_fraction;
    assert!(early > 0.8 && late < 0.1, "early {} late {}", early, late);
}

