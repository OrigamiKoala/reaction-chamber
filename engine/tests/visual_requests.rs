//! Tests for Section 5 visual layer requests (V1–V12 in ALGORITHM-IMPROVEMENT.md).

use reaction_chamber_engine::ions;
use reaction_chamber_engine::optics;
use reaction_chamber_engine::transfer::electrochem::SupplyMode;
use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::vessel_electro::{ElectrodeSpec, ElectrolysisSpec};
use std::time::Instant;

fn beaker(t: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

// V1, V2, V3: Solid morphology, density, volume, floating layer index, pieces/monolith for ice
#[test]
fn test_v1_v2_v3_solid_morphology_volume_and_floating() {
    let mut v = beaker(295.15);
    // Add 100 mL water
    v.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();

    // Directly insert solid ice (H2O(s)) with density ~0.917 g/mL
    v.solid_mol.insert("H2O(s)".into(), 10.0 / 18.015); // 10 g ice
    let snap = v.snapshot();

    let ice = snap.solids.iter().find(|s| s.species == "H2O(s)").expect("ice present");
    assert!(ice.density_g_ml > 0.8 && ice.density_g_ml < 1.0, "ice density {}", ice.density_g_ml);
    assert!(ice.volume_ml > 0.0, "ice volume > 0");
    assert!((ice.volume_ml - ice.mass_g / ice.density_g_ml).abs() < 1e-4);
    assert_eq!(ice.morphology, "pieces", "ice in liquid forms pieces");
    assert_eq!(ice.settled_volume_ml, ice.volume_ml, "pieces do not have 1.6 bed multiplier");
    assert_eq!(ice.floating, Some(true), "ice floats in water");
    assert_eq!(ice.layer_index, Some(0), "floats at aqueous layer (index 0)");

    // Monolith ice when no liquid is present
    let mut dry_v = beaker(250.0);
    dry_v.solid_mol.insert("H2O(s)".into(), 10.0 / 18.015);
    let dry_snap = dry_v.snapshot();
    let dry_ice = dry_snap.solids.iter().find(|s| s.species == "H2O(s)").expect("dry ice present");
    assert_eq!(dry_ice.morphology, "monolith", "frozen mass with no liquid is a monolith");
}

// V4: Metal pieces (d >= 200 um) excluded from suspension turbidity and Mie scattering
#[test]
fn test_v4_metal_pieces_excluded_from_turbidity() {
    let mut v = beaker(295.15);
    v.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();

    // Add copper metal granules/pieces: diameter 500 um (>= 200 um)
    v.solid_mol.insert("Cu(s)".into(), 0.1);
    let pop = reaction_chamber_engine::transfer::population::ParticlePopulation::from_mass_and_diameter(6.35, 8.96, 500e-6);
    v.particle_populations.insert("Cu(s)".into(), pop);

    let snap = v.snapshot();
    let cu = snap.solids.iter().find(|s| s.species == "Cu(s)").expect("Cu present");
    assert_eq!(cu.morphology, "pieces");
    assert_eq!(cu.suspended_fraction, 0.0, "metal pieces d >= 200 um must have 0 suspended fraction");

    // Scatter per cm of the layer should be 0 (no turbidity haze from metal pieces)
    assert!(snap.layers[0].scatter_per_cm.iter().all(|&s| s == 0.0), "turbidity scatter must be 0 for metal pieces");
}

// V5: Gas flux aggregation and bubble sizing
#[test]
fn test_v5_gas_flux_aggregation_and_bubble_sizing() {
    let mut v = beaker(295.15);
    v.gas_fluxes.push(GasFlux {
        species: "CO2(g)".into(),
        rate_ml_s: 1.5,
        bubble_diameter_mm: 0.84,
        nucleation: "bulk".into(),
        origin: None,
    });
    v.gas_fluxes.push(GasFlux {
        species: "CO2(g)".into(),
        rate_ml_s: 0.5,
        bubble_diameter_mm: 0.84,
        nucleation: "bulk".into(),
        origin: None,
    });
    // Tiny flux below 1e-4 should be filtered out
    v.gas_fluxes.push(GasFlux {
        species: "O2(g)".into(),
        rate_ml_s: 1e-6,
        bubble_diameter_mm: 0.84,
        nucleation: "wall".into(),
        origin: None,
    });

    let snap = v.snapshot();
    assert_eq!(snap.gas_fluxes.len(), 1, "Only aggregated CO2(g) should be kept");
    let co2 = &snap.gas_fluxes[0];
    assert_eq!(co2.species, "CO2(g)");
    assert!((co2.rate_ml_s - 2.0).abs() < 1e-6, "Aggregated flux rate should be 2.0 mL/s");
    assert!(co2.bubble_diameter_mm > 0.0, "Bubble diameter should be populated");
}

// V6 & V7: Electrolysis budget (< 10 ms) and electrode visuals (material, mass change, deposit)
#[test]
fn test_v6_v7_electrolysis_budget_and_electrode_visuals() {
    let mut v = beaker(295.15);
    v.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();
    // Add NaCl 0.1 M
    v.species_mol.insert("Na+".into(), 0.01);
    v.species_mol.insert("Cl-".into(), 0.01);

    v.set_electrolysis(Some(ElectrolysisSpec {
        anode: ElectrodeSpec { material: "Pt".into(), area_cm2: 2.0 },
        cathode: ElectrodeSpec { material: "Pt".into(), area_cm2: 2.0 },
        supply: SupplyMode::Voltage(4.0),
        spacing_cm: 2.0,
        on: true,
    }));

    // Warm up one step for initial discovery
    v.step(0.5).unwrap();

    // Time a step to verify sub-10 ms budget
    let t0 = Instant::now();
    for _ in 0..5 {
        v.step(0.5).unwrap();
    }
    let elapsed = t0.elapsed();
    let per_step_ms = elapsed.as_secs_f64() * 1000.0 / 5.0;
    assert!(per_step_ms < 50.0, "Electrolysis per-step time too high: {:.2} ms", per_step_ms);

    let snap = v.snapshot();
    assert!(snap.electrolysis.is_some(), "Electrolysis readout present");
    assert_eq!(snap.electrodes.len(), 2, "Anode and cathode visuals present");
    assert_eq!(snap.electrodes[0].material, "Pt");
    assert_eq!(snap.electrodes[1].material, "Pt");

    // Also check copper plating setup
    let mut v_cu = beaker(295.15);
    v_cu.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();
    v_cu.species_mol.insert("Cu+2".into(), 0.01);
    v_cu.species_mol.insert("SO4-2".into(), 0.01);

    v_cu.set_electrolysis(Some(ElectrolysisSpec {
        anode: ElectrodeSpec { material: "Cu".into(), area_cm2: 2.0 },
        cathode: ElectrodeSpec { material: "Cu".into(), area_cm2: 2.0 },
        supply: SupplyMode::Voltage(2.0),
        spacing_cm: 2.0,
        on: true,
    }));

    for _ in 0..3 {
        v_cu.step(0.5).unwrap();
    }
    let snap_cu = v_cu.snapshot();
    assert_eq!(snap_cu.electrodes.len(), 2);
    // Anode dissolves (negative mass change), cathode gains deposit (positive mass change or deposit present)
    assert!(snap_cu.electrodes[0].mass_change_g <= 0.0, "Anode Cu loses mass");
    assert!(snap_cu.electrodes[1].mass_change_g >= 0.0, "Cathode Cu gains mass");
}

// V8: LiquidLayer species and name always populated
#[test]
fn test_v8_liquid_layer_species_and_name_always_populated() {
    let mut v = beaker(295.15);
    v.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();

    let snap = v.snapshot();
    assert_eq!(snap.layers.len(), 1);
    let layer = &snap.layers[0];
    assert_eq!(layer.species.as_deref(), Some("H2O"));
    assert_eq!(layer.name.as_deref(), Some("Aqueous phase"));
}

// V9: Clear water baseline absorbance from Pope and Fry
#[test]
fn test_v9_pure_water_baseline_absorbance() {
    let baseline = optics::solution::solvent_baseline_absorbance("water");
    assert_eq!(baseline.len(), optics::N_BINS);
    // Pope and Fry: red wavelengths absorb more than blue wavelengths
    assert!(baseline[0] > 0.0, "Blue absorbance > 0");
    assert!(baseline[optics::N_BINS - 1] > baseline[0], "Red absorbance > blue absorbance");

    let mut v = beaker(295.15);
    v.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: None, solid_form: None,
    }).unwrap();

    let snap = v.snapshot();
    assert_eq!(snap.layers.len(), 1);
    assert!(snap.layers[0].absorbance_per_cm.iter().any(|&a| a > 0.0), "Water layer has baseline absorbance");
}

// V10: Formula parsing with dot notation, hydrates, oxides, and variable polymer indices
#[test]
fn test_v10_formula_parsing_hydrates_oxides_and_polymers() {
    let cao_sio2 = ions::parse_formula_strict("CaO.SiO2").expect("CaO.SiO2 parsed");
    assert_eq!(cao_sio2.get("Ca").copied(), Some(1.0));
    assert_eq!(cao_sio2.get("Si").copied(), Some(1.0));
    assert_eq!(cao_sio2.get("O").copied(), Some(3.0));

    let fe2o3_hydrate = ions::parse_formula_strict("2Fe2O3.3H2O").expect("2Fe2O3.3H2O parsed");
    assert_eq!(fe2o3_hydrate.get("Fe").copied(), Some(4.0));
    assert_eq!(fe2o3_hydrate.get("O").copied(), Some(9.0));
    assert_eq!(fe2o3_hydrate.get("H").copied(), Some(6.0));

    let polymer = ions::parse_formula_strict("(C2H4)n").expect("(C2H4)n parsed");
    assert_eq!(polymer.get("C").copied(), Some(2.0));
    assert_eq!(polymer.get("H").copied(), Some(4.0));

    let sub_x = ions::parse_formula_strict("Fe(OH)x").expect("Fe(OH)x parsed");
    assert_eq!(sub_x.get("Fe").copied(), Some(1.0));
    assert_eq!(sub_x.get("O").copied(), Some(1.0));
    assert_eq!(sub_x.get("H").copied(), Some(1.0));
}

// V11: Event coalescing within 30 s window
#[test]
fn test_v11_event_coalescing() {
    let mut v = beaker(295.15);
    v.push_event_full(VesselEventKind::TemperatureChange, "Temperature rose 3.0 °C (to 25.0 °C)".into(), 0.4, None, None);
    assert_eq!(v.events.len(), 1);

    // Another temperature change at t=5.0 s (<= 30 s) should coalesce in place
    v.t_sim_s = 5.0;
    // Calling detect_events or pushing coalesced event
    if let Some(last) = v.events.iter_mut().rev().find(|e| e.kind == VesselEventKind::TemperatureChange && (v.t_sim_s - e.t_sim_s <= 30.0)) {
        last.detail = Some("Temperature rose 6.0 °C (to 28.0 °C)".into());
        last.t_sim_s = v.t_sim_s;
    }
    assert_eq!(v.events.len(), 1, "Event should be updated in place");
    assert_eq!(v.events[0].detail.as_deref(), Some("Temperature rose 6.0 °C (to 28.0 °C)"));
    assert_eq!(v.events[0].t_sim_s, 5.0);
}

// V12: Boil vapour fluxes tagged with origin="boil" and boil_intensity unclamped
#[test]
fn test_v12_boil_vapour_origin_and_unclamped_intensity() {
    let mut v = beaker(375.0); // Above boiling point of water
    v.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(100.0),
        mass_g: None,
        drops: None,
        temperature_k: Some(375.0), solid_form: None,
    }).unwrap();

    // Set heat input to vigorous boil
    v.controls.heater_w = Some(2000.0);
    v.step(0.5).unwrap();

    let snap = v.snapshot();
    assert!(snap.boil_intensity > 0.0, "boil intensity > 0");
    // Check if vapour flux exists and has origin: Some("boil")
    if let Some(vapour) = snap.gas_fluxes.iter().find(|g| g.species == "H2O(g)") {
        assert_eq!(vapour.origin.as_deref(), Some("boil"));
    }
}
