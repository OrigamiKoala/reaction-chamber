use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::vessel::*;

fn make_test_beaker(capacity_ml: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml,
        glass_mass_g: 100.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

fn dose_ml(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest {
        reagent_id: id.into(),
        volume_ml: Some(ml),
        mass_g: None,
        drops: None,
        temperature_k: None,
    })
    .unwrap();
}

fn dose_g(v: &mut Vessel, id: &str, g: f64) {
    v.dose(DoseRequest {
        reagent_id: id.into(),
        volume_ml: None,
        mass_g: Some(g),
        drops: None,
        temperature_k: None,
    })
    .unwrap();
}

/// F15: Isomer disambiguation test. Dimethyl ether (COC) must not map to ethanol (C2H5OH).
#[test]
fn test_f15_dimethyl_ether_is_not_ethanol() {
    let dme_req = CompoundRequest {
        id: "dme_test".into(),
        name: "Dimethyl ether".into(),
        formula: "C2H6O".into(),
        smiles: Some("COC".into()),
        inchi_key: Some("LCGLNKUTAGEVQW-UHFFFAOYSA-N".into()),
        ..Default::default()
    };
    let dme_model = model_compound(&dme_req);
    assert!(dme_model.modelable);
    // Dimethyl ether must be modeled as inert, not hijacked as C2H5OH molecule
    assert_eq!(dme_model.kind, "inert");
    let entry = dme_model.entry.expect("entry present");
    assert!(!entry.composition.contains_key("C2H5OH"));

    let eth_req = CompoundRequest {
        id: "eth_test".into(),
        name: "Ethanol".into(),
        formula: "C2H6O".into(),
        smiles: Some("CCO".into()),
        inchi_key: Some("LFQSCWFLJHTTHZ-UHFFFAOYSA-N".into()),
        ..Default::default()
    };
    let eth_model = model_compound(&eth_req);
    assert!(eth_model.modelable);
    assert_eq!(eth_model.kind, "molecule");
    let eth_entry = eth_model.entry.expect("entry present");
    assert!(eth_entry.composition.contains_key("C2H5OH"));
}

/// F3: Dry solid reports zero liquid volume (no fake 10 mL).
#[test]
fn test_f3_dry_solid_reports_zero_liquid_volume() {
    let mut v = make_test_beaker(250.0);
    // Dose 10g of solid NaHCO3 (no water added)
    dose_g(&mut v, "nahco3_s", 10.0);
    let _ = v.step(0.1);

    // Liquid volume should be 0, not 10.0 mL
    assert_eq!(v.aqueous_volume_ml(), 0.0);
    assert_eq!(v.total_liquid_volume_ml(), 0.0);
    assert!(v.contents_mass_g() > 9.0); // 10g solid NaHCO3
}

/// F5: Ethanol boiling at ~351.4 K with mass loss and vapor flux.
#[test]
fn test_f5_ethanol_boils_near_351k_and_loses_mass() {
    let mut v = make_test_beaker(250.0);
    dose_ml(&mut v, "ethanol", 50.0);
    let initial_mass = v.contents_mass_g();

    // Heat vessel (above ethanol Tb ~351.4 K, below water Tb 373.15 K)
    v.set_controls(VesselControls {
        heater_w: Some(500.0),
        ..Default::default()
    });

    // Step until temperature reaches boiling range
    for _ in 0..100 {
        let _ = v.step(0.5);
        if v.temperature_k >= 351.0 {
            break;
        }
    }

    assert!(v.temperature_k >= 350.0);
    let eth_before = v.species_mol.get("C2H5OH").copied().unwrap_or(0.0);

    // Step further while hot to boil ethanol off
    for _ in 0..50 {
        let _ = v.step(0.5);
    }

    let eth_after = v.species_mol.get("C2H5OH").copied().unwrap_or(0.0);
    assert!(eth_after < eth_before, "Ethanol should boil away into vapor flux");
    assert!(v.mass_lost_g > 0.0, "Vessel must record mass loss from boiling");
    assert!(v.contents_mass_g() < initial_mass);
}

/// F6: Sealed vessel with air pressurises on heating via ideal gas law.
#[test]
fn test_f6_sealed_air_pressurises_on_heating() {
    let mut v = Vessel::new(VesselConfig {
        vessel_type: "sealed-vial".into(),
        capacity_ml: 100.0,
        glass_mass_g: 50.0,
        inner_radius_cm: 2.0,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(true),
        stopper_pop_atm: Some(10.0),
        burst_atm: Some(20.0),
    });

    // Initially at room temperature (298.15 K), pressure ~ 1.0 atm
    let _ = v.step(0.01);
    let p_initial = v.pressure_atm;
    assert!((p_initial - 1.0).abs() < 0.05);

    // Heat dry sealed vessel to ~373.15 K (heating ratio 373.15 / 298.15 = 1.251)
    v.temperature_k = 373.15;
    let _ = v.step(0.01);
    let p_heated = v.pressure_atm;
    // Dry air pressure increases to ~ 1.25 atm
    assert!(
        p_heated >= 1.20 && p_heated <= 1.30,
        "Expected P ~ 1.25 atm, got {}",
        p_heated
    );
}

/// F13: Concentrated acid has negative pH (unclamped).
#[test]
fn test_f13_concentrated_acid_negative_ph() {
    let mut v = make_test_beaker(250.0);
    // Dose 100 mL of 1M HCl
    dose_ml(&mut v, "hcl_1m", 100.0);
    // Add additional H+ to simulate concentrated HCl (> 1 M)
    *v.species_mol.entry("H+".to_string()).or_insert(0.0) += 0.5; // 0.5 mol in ~100 mL = 5 M
    let _ = v.step(0.01);

    let ph = v.current_ph();
    assert!(
        ph < 0.0,
        "Concentrated acid ([H+] > 1 M) must have negative pH, got {}",
        ph
    );
}

/// F17: Micromolar precipitate is preserved and not deleted.
#[test]
fn test_f17_micromolar_precipitate_preserved() {
    let mut v = make_test_beaker(250.0);
    // Dose 10 mL of water (0.01 L). AgCl solubility is 1.34e-5 M -> 1.34e-7 mol dissolves.
    dose_ml(&mut v, "water", 10.0);
    // Add 5.0e-7 mol AgCl(s). Dissolves 1.34e-7 mol, leaving ~3.66e-7 mol precipitate.
    *v.solid_mol.entry("AgCl(s)".to_string()).or_insert(0.0) += 5.0e-7;
    let _ = v.step(0.1);

    let solid_agcl = v.solid_mol.get("AgCl(s)").copied().unwrap_or(0.0);
    assert!(
        solid_agcl > 1.0e-7,
        "Micromolar precipitate (>1e-7 mol) must not be zeroed out, got {:.3e}",
        solid_agcl
    );
}
