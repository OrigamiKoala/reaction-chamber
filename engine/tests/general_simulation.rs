use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::chem_db::*;
use reaction_chamber_engine::types::ProvenanceTier;
use std::collections::HashMap;

fn make_test_vessel() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".to_string(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

#[test]
fn test_arbitrary_custom_compound_and_multivalent_mineral() {
    let mut v = make_test_vessel();

    // 1. Register arbitrary custom multivalent mineral: Lanthanum hydroxide La(OH)3 (1:3 stoichiometry)
    let la_oh3_mineral = GeneralMineral {
        id: "la_hydroxide".to_string(),
        mineral: "Lanthanum Hydroxide".to_string(),
        formula: "La(OH)3".to_string(),
        solid_species: "La(OH)3(s)".to_string(),
        dissolved_products: [("La+3".to_string(), 1.0), ("OH-".to_string(), 3.0)].into(),
        log_ksp_298: -21.0, // Ksp ~ 1e-21
        delta_h_kj: 45.0,
        solid_color: [0.95, 0.95, 0.95],
        density_g_ml: 4.28,
        default_particle_um: 15.0,
        kind: "powder".to_string(),
        log_ksp_analytic: None,
        tier: ProvenanceTier::Tabulated,
        source: "Inorganic Chemistry Handbook".to_string(),
        interfacial_energy_j_m2: None,
        interfacial_energy_source: None,
    };
    v.register_mineral(la_oh3_mineral);

    // 2. Register custom reagent: 0.1 M La(NO3)3
    let mut comp_la = HashMap::new();
    comp_la.insert("La+3".to_string(), 0.0001); // 0.1 mol/L = 0.0001 mol/mL
    comp_la.insert("NO3-".to_string(), 0.0003);
    comp_la.insert("H2O".to_string(), 0.0555);
    v.register_reagent(ReagentCatalogEntry {
        id: "la_no3_3_0_1m".to_string(),
        name: "Lanthanum(III) Nitrate 0.1 M".to_string(),
        formula: "La(NO3)3".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.1),
        density_g_ml: 1.05,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp_la,
        label: "La(NO3)3".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None, solid_form: None, particle_um: None,
    });

    // 3. Dose 25 mL of La(NO3)3 (2.5e-3 mol La3+)
    v.dose(DoseRequest {
        reagent_id: "la_no3_3_0_1m".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();

    let total_la = |v: &Vessel| {
        v.species_mol.get("La+3").copied().unwrap_or(0.0)
            + v.species_mol.get("LaNO3+2").copied().unwrap_or(0.0)
            + v.species_mol.get("LaCl+2").copied().unwrap_or(0.0)
    };

    let la_init = total_la(&v);
    assert!((la_init - 0.0025).abs() < 1e-5);
    assert_eq!(v.solid_mol.get("La(OH)3(s)").copied().unwrap_or(0.0), 0.0);

    // 4. Dose NaOH 0.1 M (excess base: 80 mL = 0.008 mol OH-, > 3 equiv of 0.0025 mol La)
    v.dose(DoseRequest {
        reagent_id: "naoh_0_1m".to_string(),
        volume_ml: Some(80.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();

    // 1:3 mineral La(OH)3 must precipitate spontaneously
    let la_solid = *v.solid_mol.get("La(OH)3(s)").unwrap_or(&0.0);
    assert!(la_solid > 0.0024, "La(OH)3(s) should precipitate almost quantitatively (> 0.0024 mol), found {}", la_solid);

    // Total La element conservation
    let la_sol = total_la(&v);
    assert!((la_solid + la_sol - la_init).abs() < 1e-5, "La mass must be strictly conserved");

    // 5. Add strong acid HCl 1 M to dissolve La(OH)3 precipitate by acid neutralization
    let mut comp_hcl_1m = HashMap::new();
    comp_hcl_1m.insert("H+".to_string(), 0.001); // 1.0 M = 0.001 mol/mL
    comp_hcl_1m.insert("Cl-".to_string(), 0.001);
    comp_hcl_1m.insert("H2O".to_string(), 0.0555);
    v.register_reagent(ReagentCatalogEntry {
        id: "hcl_1m".to_string(),
        name: "Hydrochloric Acid 1.0 M".to_string(),
        formula: "HCl".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(1.0),
        density_g_ml: 1.02,
        ghs: vec!["GHS05".to_string()],
        signal_word: "Danger".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp_hcl_1m,
        label: "HCl 1 M".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None, solid_form: None, particle_um: None,
    });

    // 10 mL of 1 M HCl = 0.010 mol H+, enough to neutralize OH- and completely dissolve La(OH)3
    v.dose(DoseRequest {
        reagent_id: "hcl_1m".to_string(),
        volume_ml: Some(10.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();

    let la_solid_after_acid = *v.solid_mol.get("La(OH)3(s)").unwrap_or(&0.0);
    assert_eq!(la_solid_after_acid, 0.0, "La(OH)3 precipitate must completely dissolve upon acid addition");
    let la_redissolved = total_la(&v);
    assert!((la_redissolved - la_init).abs() < 1e-5, "All La+3 must return to aqueous solution");
}

#[test]
fn test_arbitrary_custom_kinetic_reaction_network() {
    let mut v = make_test_vessel();

    // Register a custom organic ester hydrolysis: Ethyl acetate + OH- -> Ethanol + Acetate
    v.register_kinetic_reaction(GeneralKineticRxn {
        id: "etac_saponification".to_string(),
        equation: "EtAc + OH- -> EtOH + AcO-".to_string(),
        reactants: [("EtAc".to_string(), 1.0), ("OH-".to_string(), 1.0)].into(),
        products: [("C2H5OH".to_string(), 1.0), ("CH3COO-".to_string(), 1.0)].into(),
        gas_products: HashMap::new(),
        orders: None,
        arrhenius_a: 5.0e7,
        arrhenius_n: 0.0,
        arrhenius_ea: 48000.0, // J/mol
        delta_h_kj: -55.0,     // Exothermic
        catalyst_species: None,
        is_reversible: false,
        k_eq_298: None,
        tier: ProvenanceTier::Tabulated,
        source: "Physical Organic Chemistry".to_string(), phase_class: None,
    });

    // Seed vessel with water, EtAc, and OH-
    let mut comp = HashMap::new();
    comp.insert("H2O".to_string(), 0.0555);
    comp.insert("EtAc".to_string(), 0.0001); // 0.1 M
    comp.insert("OH-".to_string(), 0.0001);   // 0.1 M
    comp.insert("Na+".to_string(), 0.0001);
    v.register_reagent(ReagentCatalogEntry {
        id: "etac_base_mix".to_string(),
        name: "Ethyl Acetate Alkaline Mix".to_string(),
        formula: "EtAc_NaOH".to_string(),
        form: "solution".to_string(),
        concentration_m: Some(0.1),
        density_g_ml: 1.0,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "clear".to_string(),
        composition: comp,
        label: "EtAc Alkaline".to_string(),
        by_mass: false,
        dropper: None,
        inchi_key: None, solid_form: None, particle_um: None,
    });

    v.dose(DoseRequest {
        reagent_id: "etac_base_mix".to_string(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();

    let etac_init = *v.species_mol.get("EtAc").unwrap_or(&0.0);
    assert!((etac_init - 0.005).abs() < 1e-5);

    // Step simulation 2.0 seconds
    for _ in 0..40 {
        v.step(0.05).unwrap();
    }

    let etac_rem = *v.species_mol.get("EtAc").unwrap_or(&0.0);
    let etoh_formed = *v.species_mol.get("C2H5OH").unwrap_or(&0.0);
    let aco_formed = *v.species_mol.get("CH3COO-").unwrap_or(&0.0);

    assert!(etac_rem < etac_init, "Ester must be consumed by custom reaction");
    assert!(etoh_formed > 0.0, "Ethanol product must be generated");
    assert!((etoh_formed - aco_formed).abs() < 1e-6, "Products must form in 1:1 stoichiometric ratio");
    assert!((etac_init - (etac_rem + etoh_formed)).abs() < 1e-6, "Total carbon skeleton must be conserved");
}
