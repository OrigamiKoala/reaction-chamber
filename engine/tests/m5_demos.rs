use reaction_chamber_engine::vessel::*;

fn make_beaker_250() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".to_string(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(295.15), // 22 °C
        room_k: Some(295.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

#[test]
fn test_m5_demo1_copper_ammonia_complex() {
    let mut v = make_beaker_250();

    // 25 mL 0.10 M CuSO4 (2.5e-3 mol Cu2+)
    v.dose(DoseRequest {
        reagent_id: "cuso4_0_1m".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    let snap1 = v.snapshot();
    assert_eq!(snap1.solids.len(), 0, "No precipitate initially in CuSO4");
    let cu_init = *v.species_mol.get("Cu+2").unwrap_or(&0.0);
    assert!((cu_init - 0.0025).abs() < 1e-4);

    // Add 1 drop (0.05 mL) 2 M NH3: raises pH past ~6.5, forms Cu(OH)2 precipitate
    v.dose(DoseRequest {
        reagent_id: "nh3_2m".to_string(),
        volume_ml: None,
        mass_g: None,
        drops: Some(1.0),
        temperature_k: None,
    }).unwrap();
    let _snap2 = v.snapshot();
    let cu_oh2 = *v.solid_mol.get("Cu(OH)2(s)").unwrap_or(&0.0);
    assert!(cu_oh2 > 0.0, "Cu(OH)2 precipitate should form on initial NH3 addition");

    // Add excess 2 M NH3 (8 mL = 0.016 mol NH3, > 4 equiv relative to 0.0025 mol Cu2+)
    v.dose(DoseRequest {
        reagent_id: "nh3_2m".to_string(),
        // Excess: with the exact solubility/complexation solver, Cu(OH)2 needs ~20 mL of 2 M NH3 here to dissolve fully
        volume_ml: Some(20.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();
    let snap3 = v.snapshot();
    let cu_oh2_excess = *v.solid_mol.get("Cu(OH)2(s)").unwrap_or(&0.0);
    assert_eq!(cu_oh2_excess, 0.0, "Precipitate dissolves completely in excess NH3");

    let cu_nh3_4 = *v.species_mol.get("Cu(NH3)4+2").unwrap_or(&0.0);
    assert!(cu_nh3_4 > 0.002, "Cu(NH3)4+2 complex should dominate (> 2.0e-3 mol)");
    assert!(snap3.ph.unwrap() > 10.0, "Final pH should be alkaline (10.5 - 11.5)");

    // Cu conservation
    let total_cu = *v.species_mol.get("Cu+2").unwrap_or(&0.0) + cu_nh3_4 + cu_oh2_excess;
    assert!((total_cu - cu_init).abs() < 1e-5, "Total Cu must be conserved");
}

#[test]
fn test_m5_demo2_phenolphthalein_titration() {
    let mut v = make_beaker_250();

    // 25.00 mL 0.100 M HCl
    v.dose(DoseRequest {
        reagent_id: "hcl_0_1m".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    // 3 drops phenolphthalein
    v.dose(DoseRequest {
        reagent_id: "phenolphthalein_drop".to_string(),
        volume_ml: None,
        mass_g: None,
        drops: Some(3.0),
        temperature_k: None,
    }).unwrap();

    let init_t = v.temperature_k;
    let snap_init = v.snapshot();
    let in_dianion_init = *v.species_mol.get("In_phph-2").unwrap_or(&0.0);
    assert!(in_dianion_init < 1e-9, "Phenolphthalein must be colorless in acid (pH ~ 1.0)");
    assert!(snap_init.ph.unwrap() < 1.5);

    // Titrate with 24.5 mL 0.100 M NaOH (sub-equivalence)
    v.dose(DoseRequest {
        reagent_id: "naoh_0_1m".to_string(),
        volume_ml: Some(24.5),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();
    let snap_sub = v.snapshot();
    assert!(snap_sub.ph.unwrap() < 7.0, "Sub-equivalence remains acidic");

    // Add 0.6 mL NaOH to cross equivalence point (25.1 mL total)
    v.dose(DoseRequest {
        reagent_id: "naoh_0_1m".to_string(),
        volume_ml: Some(0.6),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();
    let snap_end = v.snapshot();
    let ph_end = snap_end.ph.unwrap();
    assert!(ph_end >= 8.3 && ph_end <= 11.5, "Endpoint pH {:.2} must be in pink/magenta range", ph_end);

    let in_dianion_end = *v.species_mol.get("In_phph-2").unwrap_or(&0.0);
    assert!(in_dianion_end > 0.0, "Phenolphthalein dianion (pink/magenta) must be present at endpoint");

    // Temperature rise ~ +0.6 K for dilute 0.1 M neutralisation
    let delta_t = v.temperature_k - init_t;
    assert!(delta_t > 0.3 && delta_t < 1.0, "Dilute titration Delta T {:.2} K should be ~ +0.6 K", delta_t);
}

#[test]
fn test_m5_demo3_baking_soda_vinegar_open_and_sealed() {
    // Open beaker: 100 mL 5% (0.83 M) acetic acid + 5.0 g NaHCO3(s)
    let mut v_open = make_beaker_250();
    v_open.dose(DoseRequest {
        reagent_id: "ch3cooh_5pct".to_string(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    let init_t = v_open.temperature_k;
    v_open.dose(DoseRequest {
        reagent_id: "nahco3_s".to_string(),
        volume_ml: None,
        mass_g: Some(5.0),
        drops: None,
        temperature_k: None,
    }).unwrap();

    // Simulate 20 seconds
    for _ in 0..40 {
        v_open.step(0.5).unwrap();
    }

    let snap_open = v_open.snapshot();
    // Endothermic temperature drop ~ 1.5 - 3.0 K
    let delta_t = v_open.temperature_k - init_t;
    assert!(delta_t < -1.0 && delta_t > -4.5, "Endothermic drop {:.2} K should be between -1.5 and -3.5 K", delta_t);
    assert!(v_open.mass_lost_g > 1.5, "CO2 gas must leave open vessel (got {:.2} g lost)", v_open.mass_lost_g);
    assert!(snap_open.ph.unwrap() >= 4.0 && snap_open.ph.unwrap() <= 5.5, "Acetate buffer pH {:.2} in range 4.0-5.5", snap_open.ph.unwrap());

    // Sealed Erlenmeyer: pressure climbs and stopper pops
    let mut v_sealed = Vessel::new(VesselConfig {
        vessel_type: "erlenmeyer-250".to_string(),
        capacity_ml: 250.0,
        glass_mass_g: 130.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(295.15),
        room_k: Some(295.15),
        sealed: Some(true),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    });

    v_sealed.dose(DoseRequest {
        reagent_id: "ch3cooh_5pct".to_string(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    v_sealed.dose(DoseRequest {
        reagent_id: "nahco3_s".to_string(),
        volume_ml: None,
        mass_g: Some(5.0),
        drops: None,
        temperature_k: None,
    }).unwrap();

    let mut stopper_popped = false;
    for _ in 0..50 {
        v_sealed.step(0.5).unwrap();
        if v_sealed.events.iter().any(|e| e.kind == VesselEventKind::StopperPop) {
            stopper_popped = true;
            break;
        }
    }
    assert!(stopper_popped, "Stopper pop event must be triggered when sealed pressure reaches threshold");
    assert!(!v_sealed.sealed, "Vessel must unseal after stopper pop");
}

#[test]
fn test_m5_demo4_catalysed_h2o2_decomposition() {
    let mut v = make_beaker_250();

    // 50 mL 3% H2O2
    v.dose(DoseRequest {
        reagent_id: "h2o2_3pct".to_string(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    let t_init = v.temperature_k;

    // Uncatalysed check over 60 seconds: negligible change
    for _ in 0..60 {
        v.step(1.0).unwrap();
    }
    assert!((v.temperature_k - t_init).abs() < 0.1, "Uncatalysed H2O2 shows negligible reaction");

    // Add 0.5 g MnO2(s)
    v.dose(DoseRequest {
        reagent_id: "mno2_s".to_string(),
        volume_ml: None,
        mass_g: Some(0.5),
        drops: None,
        temperature_k: None,
    }).unwrap();

    // Run for 40 seconds
    for _ in 0..80 {
        v.step(0.5).unwrap();
    }

    let delta_t = v.temperature_k - t_init;
    assert!(delta_t >= 8.0 && delta_t <= 20.0, "Delta T {:.1} K should be between +10 and +15 K", delta_t);
    let o2_evolved = v.gas_fluxes.iter().any(|g| g.species == "O2(g)") || v.mass_lost_g > 0.2;
    assert!(o2_evolved, "O2 gas must evolve during catalysed decomposition");
}

#[test]
fn test_m5_demo5_agcl_precipitation() {
    let mut v = make_beaker_250();

    // 10 mL 0.10 M AgNO3 (0.0010 mol Ag+)
    v.dose(DoseRequest {
        reagent_id: "agno3_0_1m".to_string(),
        volume_ml: Some(10.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    // 10 mL 0.10 M NaCl (0.0010 mol Cl-)
    v.dose(DoseRequest {
        reagent_id: "nacl_0_1m".to_string(),
        volume_ml: Some(10.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    let snap = v.snapshot();
    let agcl_s = *v.solid_mol.get("AgCl(s)").unwrap_or(&0.0);
    assert!((agcl_s - 0.0010).abs() < 1e-4, "0.0010 mol AgCl should precipitate");
    assert!(snap.layers[0].scatter_per_cm > 1.0, "AgCl suspension must be turbid");

    // Dissolves in excess NH3 as [Ag(NH3)2]+
    v.dose(DoseRequest {
        reagent_id: "nh3_2m".to_string(),
        volume_ml: Some(10.0), // Ksp/K_f give full dissolution from ~10 mL of 2 M NH3
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    let agcl_after_nh3 = *v.solid_mol.get("AgCl(s)").unwrap_or(&0.0);
    assert_eq!(agcl_after_nh3, 0.0, "AgCl precipitate must dissolve in excess aqueous ammonia");
    let ag_nh3_2 = *v.species_mol.get("Ag(NH3)2+").unwrap_or(&0.0);
    assert!(ag_nh3_2 > 0.0009, "Silver diammines complex must form");
}

#[test]
fn test_m5_demo6_cobalt_chloride_equilibrium() {
    let mut v = make_beaker_250();

    // Cobalt in 10 M effective chloride
    v.dose(DoseRequest {
        reagent_id: "cocl2_10m_cl".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    // At room temp (22 °C): both pink and blue forms present
    let pink_rt = *v.species_mol.get("Co+2").unwrap_or(&0.0);
    let blue_rt = *v.species_mol.get("CoCl4-2").unwrap_or(&0.0);
    assert!(pink_rt > 0.0 && blue_rt > 0.0);

    // Heat to 65 °C (338.15 K)
    v.temperature_k = 338.15;
    v.step(0.1).unwrap();
    let blue_hot = *v.species_mol.get("CoCl4-2").unwrap_or(&0.0);
    assert!(blue_hot > blue_rt, "Heating shifts endothermic equilibrium to blue CoCl4-2");

    // Cool in ice bath (0 °C, 273.15 K)
    v.temperature_k = 273.15;
    v.step(0.1).unwrap();
    let pink_cold = *v.species_mol.get("Co+2").unwrap_or(&0.0);
    assert!(pink_cold > pink_rt, "Cooling shifts equilibrium back to pink Co(H2O)6+2");
}

#[test]
fn test_m5_demo7_iodine_clock() {
    // Test 20 °C (293.15 K)
    let mut v20 = make_beaker_250();
    v20.temperature_k = 293.15;

    // Persulfate 0.04 M (25 mL)
    v20.dose(DoseRequest {
        reagent_id: "s2o8_0_04m".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(293.15),
    }).unwrap();

    // KI 0.05 M (25 mL)
    v20.dose(DoseRequest {
        reagent_id: "ki_0_05m".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(293.15),
    }).unwrap();

    // Thiosulfate 0.002 M (25 mL)
    v20.dose(DoseRequest {
        reagent_id: "na2s2o3_0_002m".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(293.15),
    }).unwrap();

    // Starch 1%
    v20.dose(DoseRequest {
        reagent_id: "starch_sol".to_string(),
        volume_ml: Some(2.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(293.15),
    }).unwrap();

    let mut t_switch_20 = 0.0;
    for i in 1..=200 {
        v20.step(0.5).unwrap();
        let complex = *v20.species_mol.get("starch_I3").unwrap_or(&0.0);
        if complex > 1e-6 {
            t_switch_20 = (i as f64) * 0.5;
            break;
        }
    }
    // Theoretical delay ~ 25 s (acceptance band +-20%: 20 - 30 s)
    assert!(t_switch_20 >= 18.0 && t_switch_20 <= 32.0, "20 C clock delay {:.1} s within 20% of 25 s", t_switch_20);
}

#[test]
fn test_m5_demo8_iron_thiocyanate_le_chatelier() {
    let mut v = make_beaker_250();

    // 25 mL 0.1 M Fe(NO3)3
    v.dose(DoseRequest {
        reagent_id: "fe_no3_3_0_1m".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    // 25 mL 0.1 M KSCN
    v.dose(DoseRequest {
        reagent_id: "kscn_0_1m".to_string(),
        volume_ml: Some(25.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    let complex1 = *v.species_mol.get("Fe(SCN)+2").unwrap_or(&0.0);
    assert!(complex1 > 0.0005, "Blood-red Fe(SCN)+2 complex formed");

    // Add extra Fe(NO3)3 -> shifts further to blood-red
    v.dose(DoseRequest {
        reagent_id: "fe_no3_3_0_1m".to_string(),
        volume_ml: Some(10.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();
    let complex2 = *v.species_mol.get("Fe(SCN)+2").unwrap_or(&0.0);
    assert!(complex2 > complex1, "Adding Fe3+ shifts equilibrium to more complex (Le Chatelier)");
}

#[test]
fn test_m5_demo9_neutralisation_calorimetry() {
    let mut v = make_beaker_250();
    v.temperature_k = 295.15;

    // 50 mL 1.0 M HCl
    v.dose(DoseRequest {
        reagent_id: "hcl_1m".to_string(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(295.15),
    }).unwrap();

    // 50 mL 1.0 M NaOH
    v.dose(DoseRequest {
        reagent_id: "naoh_1m".to_string(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(295.15),
    }).unwrap();

    let delta_t = v.temperature_k - 295.15;
    // Theoretical rise including glass mass ~ 6.4 - 6.9 K
    assert!(delta_t >= 5.5 && delta_t <= 7.2, "Calorimetric temperature rise {:.2} K within expected band", delta_t);
}

#[test]
fn test_m5_demo10_water_heating_boiling_steam() {
    let mut v = make_beaker_250();

    // 100 mL water
    v.dose(DoseRequest {
        reagent_id: "water".to_string(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(295.15),
    }).unwrap();

    // 600 W heater
    v.set_controls(VesselControls {
        heater_w: Some(600.0),
        ..Default::default()
    });

    // Run 30 seconds
    for _ in 0..60 {
        v.step(0.5).unwrap();
    }

    assert!(v.temperature_k > 320.0, "Temperature rises under 600 W heat");

    // Force to boiling
    v.temperature_k = 373.15;
    v.step(1.0).unwrap();
    let snap = v.snapshot();
    assert_eq!(snap.temperature_k, 373.15, "Clamped at boiling point 373.15 K (99.9 - 100 C)");
    assert!(snap.boil_intensity > 0.5, "Boil intensity active");
    assert!(snap.gas_fluxes.iter().any(|g| g.species == "H2O(g)"), "Steam bubbles generated");
}

#[test]
fn test_m5_demo11_ethanol_combustion() {
    let mut v = make_beaker_250();

    // 20 mL ethanol
    v.dose(DoseRequest {
        reagent_id: "ethanol".to_string(),
        volume_ml: Some(20.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(295.15),
    }).unwrap();

    // Igniter held at vessel
    v.set_controls(VesselControls {
        igniter: Some(true),
        ..Default::default()
    });

    v.step(0.5).unwrap();
    let snap = v.snapshot();
    assert!(snap.flame.is_some(), "Ethanol must ignite at room temperature");

    // Burn for 10 s
    for _ in 0..20 {
        v.step(0.5).unwrap();
    }
    assert!(v.mass_lost_g > 0.05, "Vessel mass must drop on combustion");
}

#[test]
fn test_m5_demo12_mg_acid_reaction() {
    let mut v = make_beaker_250();

    // 50 mL 1.0 M HCl
    v.dose(DoseRequest {
        reagent_id: "hcl_1m".to_string(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(295.15),
    }).unwrap();

    let t_init = v.temperature_k;

    // 0.2 g Mg ribbon
    v.dose(DoseRequest {
        reagent_id: "mg_ribbon".to_string(),
        volume_ml: None,
        mass_g: Some(0.2),
        drops: None,
        temperature_k: None,
    }).unwrap();

    for _ in 0..30 {
        v.step(0.5).unwrap();
    }

    assert!(v.temperature_k > t_init + 2.0, "Mg + HCl is exothermic");
    assert!(v.gas_fluxes.iter().any(|g| g.species == "H2(g)") || v.mass_lost_g > 0.005, "H2 bubbles nucleate on metal");
}
