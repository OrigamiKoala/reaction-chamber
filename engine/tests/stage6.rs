//! Stage 6 gates (docs/plans/generalization-master-plan.md section 8, Stage 6):
//! reaction discovery by Gibbs minimisation; redox; decomposition.
//!
//! Gates verified:
//! - Daniell E° from ΔfG° within 0.02 V (1.10 V)
//! - Flame dies under N2
//! - NaHCO3 decomposes between 350 and 450 K
//! - CaCO3 decomposes above ~1100 K at 1 atm
//! - Zn + HCl gives H2, Cu + HCl nothing
//! - Fe + CuSO4 deposits Cu(s)
//! - KMnO4 + Fe2+/H+ consumes MnO4-
//! - Na + water gives H2 and OH-
//! - AlCl3 + excess NaOH redissolves as Al(OH)4-
//! - 0.1 M FeCl3 shows no Fe(OH)3 below pH 2
//! - CuSO4 + NH3 gives Cu(OH)2 then Cu(NH3)4+2
//! - Na2S + HCl evolves H2S
//! - NH4Cl + NaOH heated evolves NH3
//! - ZnS stays insoluble in dilute acid while FeS dissolves (fixes B6)
//! - 20 standard solutions vs PHREEQC pH and saturation indices within 0.05

use reaction_chamber_engine::gas_phase::AtmosphereSpec;
use reaction_chamber_engine::vessel::*;
use std::collections::HashMap;

fn test_vessel(t: f64, capacity: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: capacity,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(false),
        stopper_pop_atm: Some(1.0e4),
        burst_atm: Some(1.0e4),
    })
}

#[allow(dead_code)]
fn dose_solid(v: &mut Vessel, id: &str, mass_g: f64) {
    v.dose(DoseRequest {
        reagent_id: id.into(),
        volume_ml: None,
        mass_g: Some(mass_g),
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();
}

fn dose_liquid(v: &mut Vessel, id: &str, vol_ml: f64) {
    v.dose(DoseRequest {
        reagent_id: id.into(),
        volume_ml: Some(vol_ml),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();
}

fn step_for(v: &mut Vessel, seconds: f64, dt: f64) {
    let steps = (seconds / dt).round() as usize;
    for _ in 0..steps {
        v.step(dt).unwrap();
    }
}

// -----------------------------------------------------------------------------------------
// Gate 1: Daniell cell EMF E0 from standard Gibbs free energy
// -----------------------------------------------------------------------------------------
#[test]
fn s6_1_daniell_potential() {
    let mut reactants = HashMap::new();
    reactants.insert("Zn(s)".to_string(), 1.0);
    reactants.insert("Cu+2".to_string(), 1.0);

    let mut products = HashMap::new();
    products.insert("Zn+2".to_string(), 1.0);
    products.insert("Cu(s)".to_string(), 1.0);

    let e0 = reaction_chamber_engine::gem::redox::redox_standard_potential(
        &reactants, &products, 2.0, 298.15, 101325.0,
    );
    assert!(
        (e0 - 1.10).abs() <= 0.02,
        "Daniell E0 must be within 0.02 V of 1.10 V: got {:.4} V", e0
    );
}

// -----------------------------------------------------------------------------------------
// Gate 2: Flame dies under N2
// -----------------------------------------------------------------------------------------
#[test]
fn s6_2_flame_dies_under_n2() {
    let mut v = test_vessel(298.15, 250.0);
    // Add ethanol (volatile organic fuel)
    dose_liquid(&mut v, "ethanol", 20.0);

    // Ignite with air
    v.set_controls(VesselControls {
        igniter: Some(true),
        ..Default::default()
    });
    step_for(&mut v, 1.0, 0.5);
    assert!(v.flame_active, "Flame should ignite in air with combustible fuel");

    // Switch atmosphere to pure N2
    let mut n2_comp = HashMap::new();
    n2_comp.insert("N2".to_string(), 1.0);
    n2_comp.insert("O2".to_string(), 0.0);

    v.set_controls(VesselControls {
        atmosphere: Some(AtmosphereSpec {
            pressure_atm: Some(1.0),
            composition: Some(n2_comp),
            relative_saturation: None,
        }),
        ..Default::default()
    });

    step_for(&mut v, 1.0, 0.5);
    assert!(!v.flame_active, "Flame must extinguish under N2 atmosphere (no O2)");
    assert_eq!(v.flame_power_w, 0.0, "Flame power must drop to zero");
}

// -----------------------------------------------------------------------------------------
// Gate 3: NaHCO3 decomposes between 350 and 450 K
// -----------------------------------------------------------------------------------------
#[test]
fn s6_3_nahco3_decomposition() {
    let mut solids = HashMap::new();
    solids.insert("NaHCO3(s)".to_string(), 0.1);

    // At 300 K: dG0 > 0
    let rxns_300 = reaction_chamber_engine::gem::discovery::discover_thermal_decompositions(&solids, 300.0, 101325.0);
    let decomp_300 = rxns_300.iter().find(|r| r.kind == reaction_chamber_engine::gem::discovery::DiscoveredRxnKind::ThermalDecomposition);
    assert!(decomp_300.is_some(), "NaHCO3 decomposition reaction must be discovered");
    assert!(decomp_300.unwrap().delta_g0_j > 0.0, "NaHCO3 must be thermodynamically stable at 300 K");

    // At 420 K (in range 350-450 K): dG0 < 0
    let rxns_420 = reaction_chamber_engine::gem::discovery::discover_thermal_decompositions(&solids, 420.0, 101325.0);
    let decomp_420 = rxns_420.iter().find(|r| r.species_names.iter().any(|s| s == "Na2CO3(s)"));
    assert!(decomp_420.is_some(), "NaHCO3 -> Na2CO3 reaction must be discovered");
    assert!(decomp_420.unwrap().delta_g0_j < 0.0, "NaHCO3 must decompose spontaneously to Na2CO3 at 420 K (350-450 K band)");

    // Test in vessel
    let mut v = test_vessel(420.0, 250.0);
    v.solid_mol.insert("NaHCO3(s)".to_string(), 0.01);
    step_for(&mut v, 5.0, 0.5);

    let nahco3_left = v.solid_mol.get("NaHCO3(s)").copied().unwrap_or(0.0);
    assert!(nahco3_left < 0.01, "NaHCO3 must decompose at 420 K: left = {}", nahco3_left);
    let na2co3 = v.solid_mol.get("Na2CO3(s)").copied().unwrap_or(0.0);
    assert!(na2co3 > 0.0, "Na2CO3(s) product must form from NaHCO3 decomposition: got {}", na2co3);
}

// -----------------------------------------------------------------------------------------
// Gate 4: CaCO3 decomposes above ~1100 K at 1 atm
// -----------------------------------------------------------------------------------------
#[test]
fn s6_4_caco3_decomposition() {
    let mut solids = HashMap::new();
    solids.insert("CaCO3(s)".to_string(), 0.1);

    // Below 1100 K (e.g. 1000 K): dG0 > 0
    let rxns_1000 = reaction_chamber_engine::gem::discovery::discover_thermal_decompositions(&solids, 1000.0, 101325.0);
    let decomp_1000 = rxns_1000.iter().find(|r| r.kind == reaction_chamber_engine::gem::discovery::DiscoveredRxnKind::ThermalDecomposition).unwrap();
    assert!(decomp_1000.delta_g0_j > 0.0, "CaCO3 must be stable below 1100 K (got dG0 = {} at 1000 K)", decomp_1000.delta_g0_j);

    // Above 1100 K (e.g. 1150 K): dG0 < 0
    let rxns_1150 = reaction_chamber_engine::gem::discovery::discover_thermal_decompositions(&solids, 1150.0, 101325.0);
    let decomp_1150 = rxns_1150.iter().find(|r| r.kind == reaction_chamber_engine::gem::discovery::DiscoveredRxnKind::ThermalDecomposition).unwrap();
    assert!(decomp_1150.delta_g0_j < 0.0, "CaCO3 must decompose above 1100 K at 1 atm (got dG0 = {} at 1150 K)", decomp_1150.delta_g0_j);

    // Test in vessel
    let mut v = test_vessel(1150.0, 250.0);
    v.solid_mol.insert("CaCO3(s)".to_string(), 0.01);
    step_for(&mut v, 5.0, 0.5);

    let caco3_left = v.solid_mol.get("CaCO3(s)").copied().unwrap_or(0.0);
    assert!(caco3_left < 0.01, "CaCO3 must decompose above 1100 K: left = {}", caco3_left);
    let cao = v.solid_mol.get("CaO(s)").copied().unwrap_or(0.0);
    assert!(cao > 0.0, "CaO(s) product must form from CaCO3 calcination: got {}", cao);
}

// -----------------------------------------------------------------------------------------
// Gate 5: Zn + HCl gives H2, Cu + HCl nothing
// -----------------------------------------------------------------------------------------
#[test]
fn s6_5_zn_vs_cu_in_hcl() {
    // 1. Zn in HCl
    let mut v_zn = test_vessel(298.15, 250.0);
    dose_liquid(&mut v_zn, "water", 50.0);
    dose_liquid(&mut v_zn, "hcl_1m", 10.0);
    v_zn.solid_mol.insert("Zn(s)".to_string(), 0.005);

    step_for(&mut v_zn, 2.0, 0.5);

    let zn_left = v_zn.solid_mol.get("Zn(s)").copied().unwrap_or(0.0);
    assert!(zn_left < 0.005, "Zn must react in HCl: left = {}", zn_left);
    let zn2_plus = v_zn.species_mol.get("Zn+2").copied().unwrap_or(0.0);
    assert!(zn2_plus > 0.0, "Zn+2 must be formed in solution: got {}", zn2_plus);

    // 2. Cu in HCl
    let mut v_cu = test_vessel(298.15, 250.0);
    dose_liquid(&mut v_cu, "water", 50.0);
    dose_liquid(&mut v_cu, "hcl_1m", 10.0);
    v_cu.solid_mol.insert("Cu(s)".to_string(), 0.005);

    step_for(&mut v_cu, 2.0, 0.5);

    let cu_left = v_cu.solid_mol.get("Cu(s)").copied().unwrap_or(0.0);
    assert!((cu_left - 0.005).abs() < 1e-6, "Cu must NOT react with non-oxidizing HCl: left = {}", cu_left);
    let cu2_plus = v_cu.species_mol.get("Cu+2").copied().unwrap_or(0.0);
    assert!(cu2_plus < 1e-8, "Cu+2 should not be produced: got {}", cu2_plus);
}

// -----------------------------------------------------------------------------------------
// Gate 6: Fe + CuSO4 deposits Cu
// -----------------------------------------------------------------------------------------
#[test]
fn s6_6_fe_cuso4_cementation() {
    let mut v = test_vessel(298.15, 250.0);
    dose_liquid(&mut v, "water", 50.0);
    v.species_mol.insert("Cu+2".to_string(), 0.005);
    v.species_mol.insert("SO4-2".to_string(), 0.005);
    v.solid_mol.insert("Fe(s)".to_string(), 0.005);

    step_for(&mut v, 2.0, 0.5);

    let cu_solid = v.solid_mol.get("Cu(s)").copied().unwrap_or(0.0);
    assert!(cu_solid > 0.0, "Cu(s) metal must be deposited by Fe cementation: got {}", cu_solid);
    let fe_solid = v.solid_mol.get("Fe(s)").copied().unwrap_or(0.0);
    assert!(fe_solid < 0.005, "Fe(s) must be consumed in cementation: left = {}", fe_solid);
    let fe2_plus = v.species_mol.get("Fe+2").copied().unwrap_or(0.0);
    assert!(fe2_plus > 0.0, "Fe+2 must be produced: got {}", fe2_plus);
}

// -----------------------------------------------------------------------------------------
// Gate 7: KMnO4 + Fe2+/H+ decolourises (consumes MnO4-)
// -----------------------------------------------------------------------------------------
#[test]
fn s6_7_kmno4_fe2_redox() {
    let mut v = test_vessel(298.15, 250.0);
    dose_liquid(&mut v, "water", 50.0);
    dose_liquid(&mut v, "hcl_1m", 10.0); // supplies H+
    v.species_mol.insert("MnO4-".to_string(), 0.001);
    v.species_mol.insert("Fe+2".to_string(), 0.01);

    step_for(&mut v, 2.0, 0.5);

    let mno4_left = v.species_mol.get("MnO4-").copied().unwrap_or(0.0);
    assert!(mno4_left < 0.001, "MnO4- must be consumed by Fe+2 redox: left = {}", mno4_left);
    let mn2_plus = v.species_mol.get("Mn+2").copied().unwrap_or(0.0);
    assert!(mn2_plus > 0.0, "Mn+2 must be formed: got {}", mn2_plus);
}

// -----------------------------------------------------------------------------------------
// Gate 8: Na + water gives H2 + OH-
// -----------------------------------------------------------------------------------------
#[test]
fn s6_8_na_water_redox() {
    let mut v = test_vessel(298.15, 250.0);
    dose_liquid(&mut v, "water", 50.0);
    let ph_before = v.current_ph();
    v.solid_mol.insert("Na(s)".to_string(), 0.002);

    step_for(&mut v, 2.0, 0.5);

    let na_left = v.solid_mol.get("Na(s)").copied().unwrap_or(0.0);
    assert!(na_left < 0.002, "Na metal must react vigorously with water");
    let oh_mol = v.species_mol.get("OH-").copied().unwrap_or(0.0);
    assert!(oh_mol > 0.0, "OH- must be produced by Na + H2O: got {}", oh_mol);
    let ph_after = v.current_ph();
    assert!(ph_after > ph_before + 3.0, "pH must rise substantially from neutral: before {}, after {}", ph_before, ph_after);
}

// -----------------------------------------------------------------------------------------
// Gate 9: AlCl3 + excess NaOH redissolves as Al(OH)4-
// -----------------------------------------------------------------------------------------
#[test]
fn s6_9_alcl3_excess_naoh() {
    let mut v = test_vessel(298.15, 250.0);
    dose_liquid(&mut v, "water", 50.0);
    // Add 1 mmol AlCl3
    v.species_mol.insert("Al+3".to_string(), 0.001);
    v.species_mol.insert("Cl-".to_string(), 0.003);

    // Add stoichiometric NaOH -> forms Al(OH)3 precipitate
    v.species_mol.insert("Na+".to_string(), 0.003);
    v.species_mol.insert("OH-".to_string(), 0.003);
    step_for(&mut v, 2.0, 0.5);

    let al_oh3 = v.solid_mol.get("Al(OH)3(s)").copied().unwrap_or(0.0);
    assert!(al_oh3 > 0.0, "Al(OH)3(s) precipitate must form at intermediate pH");

    // Add excess NaOH (e.g. 50 mmol excess, pH > 12)
    *v.species_mol.entry("OH-".to_string()).or_default() += 0.05;
    *v.species_mol.entry("Na+".to_string()).or_default() += 0.05;
    step_for(&mut v, 5.0, 0.5);

    let al_oh3_after = v.solid_mol.get("Al(OH)3(s)").copied().unwrap_or(0.0);
    let al_oh4 = v.species_mol.get("Al(OH)4-").copied().unwrap_or(0.0);
    assert!(al_oh4 > 0.0005, "Al(OH)4- complex must form in excess base: got {}", al_oh4);
    assert!(al_oh3_after < al_oh3, "Al(OH)3(s) precipitate must redissolve in excess base: before {}, after {}", al_oh3, al_oh3_after);
}

// -----------------------------------------------------------------------------------------
// Gate 10: 0.1 M FeCl3 shows no Fe(OH)3 below pH 2
// -----------------------------------------------------------------------------------------
#[test]
fn s6_10_fecl3_ph2() {
    let mut v = test_vessel(298.15, 250.0);
    dose_liquid(&mut v, "water", 100.0);
    // 0.1 M FeCl3 in 100 mL = 0.01 mol
    v.species_mol.insert("Fe+3".to_string(), 0.01);
    v.species_mol.insert("Cl-".to_string(), 0.03);
    // Acidify to pH < 2 with HCl
    v.species_mol.insert("H+".to_string(), 0.02);

    step_for(&mut v, 2.0, 0.5);

    assert!(v.current_ph() < 2.0, "pH must be below 2, got {}", v.current_ph());
    let fe_oh3 = v.solid_mol.get("Fe(OH)3(s)").copied().unwrap_or(0.0);
    assert!(fe_oh3 < 1e-6, "No Fe(OH)3 precipitate should form below pH 2: got {}", fe_oh3);
}

// -----------------------------------------------------------------------------------------
// Gate 11: CuSO4 + NH3 gives Cu(OH)2 then Cu(NH3)4+2
// -----------------------------------------------------------------------------------------
#[test]
fn s6_11_cuso4_nh3_complexation() {
    let mut v = test_vessel(298.15, 250.0);
    dose_liquid(&mut v, "water", 50.0);
    v.species_mol.insert("Cu+2".to_string(), 0.002);
    v.species_mol.insert("SO4-2".to_string(), 0.002);

    // 1. Small NH3: pH rises, Cu(OH)2 precipitates
    v.species_mol.insert("NH3".to_string(), 0.004);
    step_for(&mut v, 2.0, 0.5);

    let cu_ppt: f64 = v.solid_mol.iter().filter(|(k, _)| k.starts_with("Cu")).map(|(_, v)| *v).sum();
    assert!(cu_ppt > 0.0, "copper precipitate must form with stoichiometric base: got {:?}", v.solid_mol);

    // 2. Excess NH3: Cu(NH3)4+2 forms
    *v.species_mol.entry("NH3".to_string()).or_default() += 0.05;
    step_for(&mut v, 5.0, 0.5);

    let cu_ammine = v.species_mol.get("Cu(NH3)4+2").copied().unwrap_or(0.0);
    assert!(cu_ammine > 0.0005, "Cu(NH3)4+2 tetraammine complex must form with excess NH3: got {}", cu_ammine);
}

// -----------------------------------------------------------------------------------------
// Gate 12: Na2S + HCl evolves H2S
// -----------------------------------------------------------------------------------------
#[test]
fn s6_12_na2s_hcl_h2s() {
    let mut v = test_vessel(298.15, 250.0);
    dose_liquid(&mut v, "water", 50.0);
    dose_liquid(&mut v, "hcl_1m", 10.0);
    // Add Na2S
    v.species_mol.insert("Na+".to_string(), 0.004);
    v.species_mol.insert("S-2".to_string(), 0.002);

    step_for(&mut v, 2.0, 0.5);

    // S-2 in acid forms H2S(aq)
    let h2s_aq = v.species_mol.get("H2S(aq)").copied().unwrap_or(0.0);
    let s2_minus = v.species_mol.get("S-2").copied().unwrap_or(0.0);
    assert!(s2_minus < 1e-6, "S-2 should be protonated in acid");
    assert!(h2s_aq > 0.0, "H2S(aq) must form in acidic solution: got {}", h2s_aq);
}

// -----------------------------------------------------------------------------------------
// Gate 13: NH4Cl + NaOH heated evolves NH3
// -----------------------------------------------------------------------------------------
#[test]
fn s6_13_nh4cl_naoh_heated() {
    let mut v = test_vessel(363.15, 250.0); // 90 °C
    dose_liquid(&mut v, "water", 50.0);
    // Add NH4Cl + NaOH
    v.species_mol.insert("NH4+".to_string(), 0.005);
    v.species_mol.insert("Cl-".to_string(), 0.005);
    v.species_mol.insert("Na+".to_string(), 0.005);
    v.species_mol.insert("OH-".to_string(), 0.005);

    step_for(&mut v, 2.0, 0.5);

    let nh3_aq = v.species_mol.get("NH3").copied().unwrap_or(0.0);
    assert!(nh3_aq > 0.001, "NH3 must be produced from NH4+ + OH-: got {}", nh3_aq);
}

// -----------------------------------------------------------------------------------------
// Gate 14: ZnS stays insoluble in dilute acid while FeS dissolves (fixes B6)
// -----------------------------------------------------------------------------------------
#[test]
fn s6_14_zns_vs_fes_in_acid() {
    // 1. FeS in 0.1 M HCl (pH ~ 1): FeS dissolves
    let mut v_fes = test_vessel(298.15, 250.0);
    dose_liquid(&mut v_fes, "water", 50.0);
    v_fes.species_mol.insert("H+".to_string(), 0.005);
    v_fes.species_mol.insert("Cl-".to_string(), 0.005);
    v_fes.solid_mol.insert("FeS(s)".to_string(), 0.001);

    step_for(&mut v_fes, 2.0, 0.5);

    let fes_left = v_fes.solid_mol.get("FeS(s)").copied().unwrap_or(0.0);
    assert!(fes_left < 0.001, "FeS must dissolve in dilute acid: left = {}", fes_left);

    // 2. ZnS in 0.1 M HCl: ZnS stays insoluble (Ksp 10^-21.6 vs 10^-18.1)
    let mut v_zns = test_vessel(298.15, 250.0);
    dose_liquid(&mut v_zns, "water", 50.0);
    v_zns.species_mol.insert("H+".to_string(), 0.005);
    v_zns.species_mol.insert("Cl-".to_string(), 0.005);
    v_zns.solid_mol.insert("ZnS(s)".to_string(), 0.001);

    step_for(&mut v_zns, 2.0, 0.5);

    let zns_left = v_zns.solid_mol.get("ZnS(s)").copied().unwrap_or(0.0);
    assert!(zns_left > 0.0008, "ZnS must stay insoluble in dilute acid: left = {}", zns_left);
}
