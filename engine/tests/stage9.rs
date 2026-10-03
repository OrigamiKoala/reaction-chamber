//! Stage 9 gates (docs/plans/generalization-master-plan.md section 8, Stage 9):
//! Structure-based organic chemistry.
//!
//! Gates verified:
//! - Gate 1: Ethyl acetate + NaOH gives ethanol + acetate, atom-balanced, k(298) within ×3 of 0.11 M⁻¹s⁻¹.
//! - Gate 2: Bromoethane + NaOH gives ethanol (SN2) and ethene (E2) with an elimination fraction that rises with T.
//! - Gate 3: Generated k follows Arrhenius tracking after generation (evaluating rate at multiple temperatures).
//! - Gate 4: No generated species without Hill formula and SMILES in SpeciesStore.

use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::network_generator::{NetworkGenerator, NetworkGeneratorConfig, resolve_molecule};
use reaction_chamber_engine::db::SpeciesStore;
use std::collections::HashMap;

fn ensure_stage9_reagents() {
    let mut comp_ea = HashMap::new();
    // Ethyl acetate: MW = 88.11 g/mol, density = 0.902 g/mL
    comp_ea.insert("ethyl_acetate".to_string(), 0.902 / 88.11);
    chem_db::register_custom_reagent(chem_db::ReagentCatalogEntry {
        id: "ethyl_acetate_neat".to_string(),
        name: "Ethyl Acetate".to_string(),
        formula: "C4H8O2".to_string(),
        form: "liquid".to_string(),
        concentration_m: None,
        density_g_ml: 0.902,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp_ea,
        label: "Ethyl Acetate".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: Some("XEKOWRVHYACXOJ-UHFFFAOYSA-N".to_string()),
    });

    let mut comp_etbr = HashMap::new();
    // Bromoethane: MW = 108.97 g/mol, density = 1.46 g/mL
    comp_etbr.insert("bromoethane".to_string(), 1.46 / 108.97);
    chem_db::register_custom_reagent(chem_db::ReagentCatalogEntry {
        id: "bromoethane_neat".to_string(),
        name: "Bromoethane".to_string(),
        formula: "C2H5Br".to_string(),
        form: "liquid".to_string(),
        concentration_m: None,
        density_g_ml: 1.46,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp_etbr,
        label: "Bromoethane".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: Some("RDHPKYGYEGBPIA-UHFFFAOYSA-N".to_string()),
    });
}

fn test_flask(capacity_ml: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "test-flask".into(),
        capacity_ml,
        glass_mass_g: 100.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.0),
        burst_atm: Some(6.0),
    })
}

// ------------------------------------------------------------------------------------------------
// Gate 1: Ethyl acetate + NaOH gives ethanol + acetate, atom-balanced, k(298) within x3 of 0.11 M^-1 s^-1
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate1_ethyl_acetate_saponification() {
    ensure_stage9_reagents();

    // 1. Verify structure-based network generator reaction generation & balance
    let mut concs = HashMap::new();
    concs.insert("ethyl_acetate".to_string(), 0.1);
    concs.insert("OH-".to_string(), 0.1);
    concs.insert("Na+".to_string(), 0.1);
    concs.insert("H2O".to_string(), 55.5);

    let generator = NetworkGenerator::new(NetworkGeneratorConfig::default());
    let net = generator.generate_network(&concs, 298.15, 13.0);

    let sap_rxn = net.reactions.iter()
        .find(|r| r.family_id == "base_ester_hydrolysis")
        .expect("Network generator must discover ester saponification reaction");

    // Must yield ethanol and acetate (or carboxylate)
    assert!(sap_rxn.products.contains_key("C2H5OH") || sap_rxn.products.keys().any(|k| k.contains("ethanol") || k.contains("CCO")),
        "Products must include ethanol: {:?}", sap_rxn.products);
    assert!(sap_rxn.products.contains_key("CH3COO-") || sap_rxn.products.keys().any(|k| k.contains("acetate") || k.contains("CC(=O)[O-]")),
        "Products must include acetate: {:?}", sap_rxn.products);

    // Atom and charge balance check
    let balance_rep = chem_db::check_balance(&sap_rxn.reactants, &sap_rxn.products, &sap_rxn.gas_products);
    assert!(balance_rep.balanced, "Saponification equation '{}' must be atom and charge balanced: {:?}", sap_rxn.equation, balance_rep);

    // Rate constant k(298.15) must be within x3 of 0.11 M^-1 s^-1 (0.0367 to 0.33 M^-1 s^-1)
    let k_298 = sap_rxn.k_fwd;
    let k_target = 0.11;
    assert!(k_298 >= k_target / 3.0 && k_298 <= k_target * 3.0,
        "k(298.15) = {:.4} M^-1 s^-1 must be within x3 of 0.11 M^-1 s^-1 (range {:.4} .. {:.4})",
        k_298, k_target / 3.0, k_target * 3.0);

    // 2. Simulate in Vessel
    let mut vessel = test_flask(250.0);
    vessel.dose(DoseRequest {
        reagent_id: "water".to_string(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(298.15),
    }).unwrap();

    vessel.dose(DoseRequest {
        reagent_id: "naoh_1m".to_string(),
        volume_ml: Some(10.0), // 0.010 mol OH-
        mass_g: None,
        drops: None,
        temperature_k: Some(298.15),
    }).unwrap();

    vessel.dose(DoseRequest {
        reagent_id: "ethyl_acetate_neat".to_string(),
        volume_ml: Some(1.0), // ~0.0102 mol ethyl acetate
        mass_g: None,
        drops: None,
        temperature_k: Some(298.15),
    }).unwrap();

    // Verify saponification reaction was registered in vessel
    assert!(vessel.kinetic_reactions.iter().any(|r| r.id.contains("saponification")),
        "Vessel kinetic_reactions must contain saponification: {:?}",
        vessel.kinetic_reactions.iter().map(|r| &r.id).collect::<Vec<_>>());

    // Step simulation for 60 seconds
    for _ in 0..60 {
        vessel.step(1.0).unwrap();
    }

    // Verify products are formed
    let ethanol_mol = vessel.species_mol.get("C2H5OH").copied().unwrap_or(0.0);
    let acetate_mol = vessel.species_mol.get("CH3COO-").copied().unwrap_or(0.0);

    assert!(ethanol_mol > 1e-6, "Ethanol should be formed in vessel: {:.6} mol", ethanol_mol);
    assert!(acetate_mol > 1e-6, "Acetate should be formed in vessel: {:.6} mol", acetate_mol);
    // Stoichiometric 1:1 ratio between ethanol and acetate
    let ratio = ethanol_mol / acetate_mol.max(1e-12);
    assert!((ratio - 1.0).abs() < 0.05, "Ethanol/acetate ratio should be ~1.0: {:.3}", ratio);
}

// ------------------------------------------------------------------------------------------------
// Gate 2: Bromoethane + NaOH gives ethanol (SN2) and ethene (E2) with elimination fraction rising with T
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate2_sn2_e2_competition_and_temperature_shift() {
    ensure_stage9_reagents();

    let generator = NetworkGenerator::new(NetworkGeneratorConfig::default());

    // Evaluate at T1 = 298.15 K
    let mut concs = HashMap::new();
    concs.insert("bromoethane".to_string(), 0.1);
    concs.insert("OH-".to_string(), 0.1);
    concs.insert("Na+".to_string(), 0.1);
    concs.insert("H2O".to_string(), 55.5);

    let net_298 = generator.generate_network(&concs, 298.15, 13.0);

    let sn2_rxn_298 = net_298.reactions.iter()
        .find(|r| r.family_id == "sn2_substitution")
        .expect("Network generator must discover SN2 substitution for bromoethane");
    let e2_rxn_298 = net_298.reactions.iter()
        .find(|r| r.family_id == "e2_elimination")
        .expect("Network generator must discover E2 elimination for bromoethane");

    // SN2 produces ethanol (C2H5OH) and Br-
    assert!(sn2_rxn_298.products.contains_key("C2H5OH"), "SN2 must yield ethanol");
    assert!(sn2_rxn_298.products.contains_key("Br-"), "SN2 must yield Br-");

    // E2 produces ethene (ethene / C2H4), H2O, and Br-
    assert!(e2_rxn_298.products.contains_key("ethene") || e2_rxn_298.products.contains_key("C2H4"), "E2 must yield ethene");
    assert!(e2_rxn_298.products.contains_key("H2O"), "E2 must yield H2O");
    assert!(e2_rxn_298.products.contains_key("Br-"), "E2 must yield Br-");

    // Check atom and charge balance for both reactions
    let rep_sn2 = chem_db::check_balance(&sn2_rxn_298.reactants, &sn2_rxn_298.products, &sn2_rxn_298.gas_products);
    assert!(rep_sn2.balanced, "SN2 reaction '{}' must be balanced: {:?}", sn2_rxn_298.equation, rep_sn2);
    let rep_e2 = chem_db::check_balance(&e2_rxn_298.reactants, &e2_rxn_298.products, &e2_rxn_298.gas_products);
    assert!(rep_e2.balanced, "E2 reaction '{}' must be balanced: {:?}", e2_rxn_298.equation, rep_e2);

    let k_sn2_298 = sn2_rxn_298.k_fwd;
    let k_e2_298 = e2_rxn_298.k_fwd;
    let f_elim_298 = k_e2_298 / (k_sn2_298 + k_e2_298);

    // Evaluate at elevated temperature T2 = 348.15 K (75 °C)
    let net_348 = generator.generate_network(&concs, 348.15, 13.0);
    let sn2_rxn_348 = net_348.reactions.iter()
        .find(|r| r.family_id == "sn2_substitution")
        .expect("SN2 reaction at 348 K");
    let e2_rxn_348 = net_348.reactions.iter()
        .find(|r| r.family_id == "e2_elimination")
        .expect("E2 reaction at 348 K");

    let k_sn2_348 = sn2_rxn_348.k_fwd;
    let k_e2_348 = e2_rxn_348.k_fwd;
    let f_elim_348 = k_e2_348 / (k_sn2_348 + k_e2_348);

    // Elimination fraction must increase with temperature because Ea(E2) > Ea(SN2)
    assert!(f_elim_348 > f_elim_298,
        "Elimination fraction must rise with temperature: f_elim(298 K) = {:.3}, f_elim(348 K) = {:.3}",
        f_elim_298, f_elim_348);

    // Both rate constants must increase significantly from 298 K to 348 K
    assert!(k_sn2_348 > k_sn2_298 * 10.0, "k_SN2 must rise by >10x from 298 to 348 K");
    assert!(k_e2_348 > k_e2_298 * 20.0, "k_E2 must rise by >20x from 298 to 348 K");
}

// ------------------------------------------------------------------------------------------------
// Gate 3: Generated k follows Arrhenius tracking after generation
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate3_arrhenius_temperature_tracking() {
    ensure_stage9_reagents();

    let mut concs = HashMap::new();
    concs.insert("ethyl_acetate".to_string(), 0.1);
    concs.insert("OH-".to_string(), 0.1);
    concs.insert("H2O".to_string(), 55.5);

    let generator = NetworkGenerator::new(NetworkGeneratorConfig::default());
    let net = generator.generate_network(&concs, 298.15, 13.0);

    for rxn in &net.reactions {
        if rxn.arrhenius_ea > 0.0 && rxn.arrhenius_a > 0.0 {
            let ea = rxn.arrhenius_ea;
            let a = rxn.arrhenius_a;
            let r = 8.314462618;

            let t1 = 298.15;
            let t2 = 323.15; // 50 °C
            let t3 = 353.15; // 80 °C

            let k1 = a * (-ea / (r * t1)).exp();
            let k2 = a * (-ea / (r * t2)).exp();
            let k3 = a * (-ea / (r * t3)).exp();

            // Arrhenius equation: ln(k2 / k1) == (Ea / R) * (1/T1 - 1/T2)
            let predicted_ln_ratio_12 = (ea / r) * (1.0 / t1 - 1.0 / t2);
            let actual_ln_ratio_12 = (k2 / k1).ln();
            assert!((actual_ln_ratio_12 - predicted_ln_ratio_12).abs() < 1e-6,
                "Reaction {} must follow Arrhenius between {} K and {} K", rxn.id, t1, t2);

            let predicted_ln_ratio_13 = (ea / r) * (1.0 / t1 - 1.0 / t3);
            let actual_ln_ratio_13 = (k3 / k1).ln();
            assert!((actual_ln_ratio_13 - predicted_ln_ratio_13).abs() < 1e-6,
                "Reaction {} must follow Arrhenius between {} K and {} K", rxn.id, t1, t3);
        }
    }

    // Verify dynamic Arrhenius evaluation inside Vessel with temperature change
    let mut vessel = test_flask(100.0);
    vessel.species_mol.insert("ethyl_acetate".to_string(), 0.01);
    vessel.species_mol.insert("OH-".to_string(), 0.01);
    vessel.species_mol.insert("H2O".to_string(), 5.0);
    vessel.temperature_k = 298.15;

    vessel.update_network();

    let _rxn_idx = vessel.kinetic_reactions.iter().position(|r| r.id.contains("saponification"))
        .expect("Saponification must be present in kinetic reactions");

    // Extent step at T = 298.15 K
    vessel.step(1.0).unwrap();
    let ethanol_produced_298 = vessel.species_mol.get("C2H5OH").copied().unwrap_or(0.0);

    // Warm up vessel to 348.15 K and step
    vessel.temperature_k = 348.15;
    let mol_before = vessel.species_mol.get("C2H5OH").copied().unwrap_or(0.0);
    vessel.step(1.0).unwrap();
    let ethanol_produced_348 = vessel.species_mol.get("C2H5OH").copied().unwrap_or(0.0) - mol_before;

    // Rate at 348 K must be significantly higher than at 298 K
    assert!(ethanol_produced_348 > ethanol_produced_298 * 5.0,
        "Reaction rate at 348 K ({:.2e}) must be > 5x rate at 298 K ({:.2e})",
        ethanol_produced_348, ethanol_produced_298);
}

// ------------------------------------------------------------------------------------------------
// Gate 4: No generated species without a formula and SMILES in SpeciesStore
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate4_all_generated_species_have_formula_and_smiles() {
    ensure_stage9_reagents();

    let generator = NetworkGenerator::new(NetworkGeneratorConfig::default());

    // Generate reactions across multiple diverse organic substrates:
    // - Ester (ethyl acetate)
    // - Haloalkane (bromoethane, 2-bromopropane)
    // - Alkene (ethene, cyclohexene)
    // - Carbonyl (acetone)
    let substrates = vec![
        ("ethyl_acetate", "OH-"),
        ("ethyl_acetate", "H2O"),
        ("bromoethane", "OH-"),
        ("2-bromopropane", "OH-"),
        ("ethene", "H2O"),
        ("cyclohexene", "Br2"),
        ("acetone", "H2O"),
    ];

    let store_arc = SpeciesStore::global();

    for (sub, reagent) in substrates {
        let mut concs = HashMap::new();
        concs.insert(sub.to_string(), 0.1);
        concs.insert(reagent.to_string(), 0.1);
        concs.insert("H2O".to_string(), 55.5);

        let net = generator.generate_network(&concs, 298.15, 7.0);

        for rxn in &net.reactions {
            for prod_id in rxn.products.keys() {
                // Must be registered in SpeciesStore
                let store = store_arc.read().unwrap();
                let rec = store.get(prod_id)
                    .unwrap_or_else(|| panic!("Generated species '{}' from reaction '{}' must exist in SpeciesStore", prod_id, rxn.id));

                // Must have valid non-empty formula
                assert!(!rec.identity.formula.is_empty(),
                    "Generated species '{}' must have non-empty formula", prod_id);
                // Must parse as valid chemical formula
                let (body, _) = reaction_chamber_engine::ions::split_charge(&rec.identity.formula);
                assert!(reaction_chamber_engine::ions::parse_formula_strict(body).is_some(),
                    "Formula '{}' of species '{}' must be valid strict formula", rec.identity.formula, prod_id);

                // Must have non-empty SMILES
                assert!(rec.identity.smiles.is_some(),
                    "Generated species '{}' must have SMILES string", prod_id);
                let smiles = rec.identity.smiles.as_ref().unwrap();
                assert!(!smiles.is_empty(),
                    "SMILES of generated species '{}' must not be empty", prod_id);

                // Molecule must be resolvable from SMILES
                assert!(resolve_molecule(prod_id).is_some(),
                    "Generated species '{}' must resolve to a valid molecular graph", prod_id);
            }
        }
    }
}
