//! A precipitate that is not in the Ksp table starts with a rule-based guess; the lookup queue hands it to the web layer
//! (PubChem) and `resolve_mineral` replaces the guess with a Ksp derived from the measured solubility.
//! One test function: the lookup queue is process-global.
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::solubility::{self, MineralData};
use reaction_chamber_engine::types::ProvenanceTier;
use reaction_chamber_engine::vessel::*;

fn beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-100".into(), capacity_ml: 100.0, glass_mass_g: 50.0, inner_radius_cm: 2.5,
        temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0),
    })
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
fn mix() -> Vessel {
    let mut v = beaker();
    v.dose(DoseRequest { reagent_id: "water".into(), volume_ml: Some(100.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
    dose_g(&mut v, "t_ZnNO32", 2.0);
    dose_g(&mut v, "t_NaF", 1.0);
    v
}
fn solid(v: &Vessel) -> f64 { v.solid_mol.get("ZnF2(s)").copied().unwrap_or(0.0) }

#[test]
fn unlisted_precipitate_is_looked_up_and_corrected() {
    assert_eq!(solubility::hill_formula("Pb(NO3)2").as_deref(), Some("N2O6Pb"));
    assert_eq!(solubility::hill_formula("CH3COOAg").as_deref(), Some("C2H3AgO2"));
    assert_eq!(solubility::hill_formula("CuS").as_deref(), Some("CuS"));

    import_solid("t_ZnNO32", "Zn(NO3)2");
    import_solid("t_NaF", "NaF");

    // 1. Rule-based guess: very insoluble (Ksp 1e-8), nearly everything precipitates.
    let mut guess = mix();
    guess.equilibrate(60.0);
    let guessed = solid(&guess);
    assert!(guessed > 1e-3, "ZnF2 should precipitate on the rule-based Ksp, got {}", guessed);
    let m = guess.minerals.iter().find(|m| m.solid_species == "ZnF2(s)").expect("rule mineral registered");
    assert_eq!(m.tier, ProvenanceTier::Speculative);

    // 2. It was queued for an external lookup with a PubChem-ready formula, exactly once.
    let queue = solubility::take_lookups();
    let q = queue.iter().find(|l| l.solid_species == "ZnF2(s)").expect("ZnF2 queued");
    assert_eq!(q.hill_formula, "F2Zn");
    assert_eq!(q.tier, "speculative");
    assert!(q.molar_mass > 100.0 && q.molar_mass < 107.0);
    assert!(solubility::take_lookups().iter().all(|l| l.solid_species != "ZnF2(s)"), "queue drains");
    let _ = mix();
    assert!(solubility::take_lookups().iter().all(|l| l.solid_species != "ZnF2(s)"), "no repeat requests");

    // 3. PubChem says it dissolves ~16 g/L: Ksp = 4 s^3 with s = 16 / M.
    let res = solubility::resolve_mineral(&MineralData {
        solid_species: "ZnF2(s)".into(),
        name: Some("Zinc fluoride".into()),
        solubility_g_per_l: Some(16.0),
        color_linear_rgb: Some([0.8, 0.8, 0.75]),
        density_g_ml: Some(3.9),
        source: "PubChem CID test".into(),
        ..Default::default()
    });
    assert!(res.registered, "{}", res.detail);
    let s = 16.0 / q.molar_mass;
    assert!((res.log_ksp.unwrap() - (4.0 * s * s * s).log10()).abs() < 1e-9, "{:?}", res.log_ksp);
    let min = res.mineral.clone().unwrap();
    assert_eq!(min.tier, ProvenanceTier::Imported);
    assert_eq!(min.mineral, "Zinc fluoride");
    assert!(min.source.contains("PubChem CID test"));
    chem_db::register_custom_mineral(min.clone());

    // 4. A vessel that already holds the guessed solid is corrected in place and agrees with a fresh vessel.
    guess.register_mineral(min.clone());
    guess.equilibrate(60.0);
    let fresh = { let mut v = mix(); v.equilibrate(60.0); v };
    let (corrected, new) = (solid(&guess), solid(&fresh));
    assert!(corrected < guessed * 0.1, "real (much higher) Ksp must dissolve the solid: {} -> {}", guessed, corrected);
    assert!((corrected - new).abs() <= 0.05 * new.max(1e-9), "existing vessel {} vs fresh vessel {}", corrected, new);
    assert_eq!(guess.minerals.iter().filter(|m| m.solid_species == "ZnF2(s)").count(), 1, "no duplicate registry entries");

    // 5. Importing the product as a reagent reuses the same (resolved) solid record, not a separate saturation cap.
    let imported = model_compound(&CompoundRequest {
        id: "t_ZnF2".into(), name: "Zinc fluoride".into(), formula: "ZnF2".into(), smiles: None, mw: None, density: None,
        state: Some("solid".into()), molarity: None, ghs: vec![], ..Default::default()
    });
    assert!(imported.modelable, "{}", imported.reason);
    let im = imported.mineral.expect("imported salt carries its solid");
    assert_eq!(im.solid_species, "ZnF2(s)");
    assert_eq!(im.tier, ProvenanceTier::Imported);
    assert!((im.log_ksp_298 - min.log_ksp_298).abs() < 1e-12);

    // PubChem's charge-free SMILES for metal halides must not hide their ionic nature.
    for (f, smi) in [("ZnF2", "F[Zn]F"), ("PbI2", "I[Pb]I"), ("AgCl", "Cl[Ag]")] {
        let m = model_compound(&CompoundRequest {
            id: format!("t_{}", f), name: f.into(), formula: f.into(), smiles: Some(smi.into()), mw: None, density: None,
            state: Some("solid".into()), molarity: None, ghs: vec![], ..Default::default()
        });
        assert!(m.modelable && m.kind == "salt", "{} from {}: {}", f, smi, m.reason);
    }

    // 6. Unknown solids and qualitative-only data.
    assert!(!solubility::resolve_mineral(&MineralData { solid_species: "NoSuch(s)".into(), ..Default::default() }).registered);
}
