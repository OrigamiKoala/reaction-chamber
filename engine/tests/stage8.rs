//! Stage 8 gates (docs/plans/generalization-master-plan.md section 8, Stage 8):
//! Heterogeneous and transport rates.
//!
//! Gates verified:
//! - Gate 1: 1 g NaCl (300 µm) in 50 mL stirred water 90 % dissolved in 10–60 s, ≥ 3× slower unstirred; no solid at S ≤ 1.
//! - Gate 2: BaSO4 induction time vs S within ×3 of Nielsen over S = 10–1000, mean size decreasing with S.
//! - Gate 3: Mg > Zn > Fe ≫ Cu in 1 M HCl, rate ∝ metal area and independent of solution volume at fixed [H⁺].
//! - Gate 4: Open carbonated water τ of hours unstirred, minutes stirred.
//! - Gate 5: CO2 + NaOH + phenolphthalein shows the hydration delay.
//! - Gate 6: 10 mL hexane from 38 cm² at 295 K loses 3–20 mL/h.
//! - Gate 7: 10 µm BaSO4 settles 4 cm in 150–300 s in water and ~1000× slower in glycerol.
//! - Gate 8: Ethanol pool fire in a 250 mL beaker 1–2 kW; hexane ignites; methanol flame near-invisible; flame dies under N2.

use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::transfer::combustion::*;
use reaction_chamber_engine::transfer::corrosion::*;
use reaction_chamber_engine::transfer::evaporation::*;
use reaction_chamber_engine::transfer::gas_transfer::*;
use reaction_chamber_engine::transfer::nucleation::*;
use reaction_chamber_engine::transfer::settling::*;
use std::collections::HashMap;

fn ensure_reagents() {
    let mut comp_nacl = HashMap::new();
    comp_nacl.insert("NaCl(s)".to_string(), 1.0 / 58.44);
    chem_db::register_custom_reagent(chem_db::ReagentCatalogEntry {
        id: "nacl_s".to_string(),
        name: "Sodium Chloride (Solid)".to_string(),
        formula: "NaCl".to_string(),
        form: "solid".to_string(),
        concentration_m: None,
        density_g_ml: 2.16,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "white".to_string(),
        composition: comp_nacl,
        label: "NaCl(s)".to_string(),
        by_mass: true,
        dropper: None,
        inchi_key: Some("FAPWRFPIFSIZLT-UHFFFAOYSA-M".to_string()),
    });

    let mut comp_zn = HashMap::new();
    comp_zn.insert("Zn(s)".to_string(), 1.0 / 65.38);
    chem_db::register_custom_reagent(chem_db::ReagentCatalogEntry {
        id: "zn_s".to_string(),
        name: "Zinc Metal".to_string(),
        formula: "Zn".to_string(),
        form: "solid".to_string(),
        concentration_m: None,
        density_g_ml: 7.14,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "gray".to_string(),
        composition: comp_zn,
        label: "Zn(s)".to_string(),
        by_mass: true,
        dropper: None,
        inchi_key: None,
    });
}

fn test_beaker(capacity_ml: f64, radius_cm: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "test-beaker".into(),
        capacity_ml,
        glass_mass_g: 100.0,
        inner_radius_cm: radius_cm,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.0),
        burst_atm: Some(6.0),
    })
}

// ------------------------------------------------------------------------------------------------
// Gate 1: NaCl dissolution kinetics via Sherwood correlation
// 1 g NaCl (300 µm) in 50 mL stirred water 90 % dissolved in 10–60 s, ≥ 3× slower unstirred; no solid at S ≤ 1.
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate_1_nacl_dissolution_sherwood() {
    ensure_reagents();

    let mw_nacl = 58.44;
    let initial_mass_g = 1.0;
    let initial_mol = initial_mass_g / mw_nacl;
    let target_remaining_mol = 0.10 * initial_mol; // 90% dissolved

    // 1. Stirred dissolution (400 RPM)
    let mut v_stirred = test_beaker(100.0, 2.5);
    v_stirred.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    v_stirred.set_controls(VesselControls {
        stirring: Some(true),
        stir_rpm: Some(400.0),
        ..Default::default()
    });

    v_stirred.dose_with_diameter(DoseRequest {
        reagent_id: "nacl_s".into(),
        mass_g: Some(initial_mass_g),
        volume_ml: None,
        drops: None,
        temperature_k: None,
    }, 300.0).unwrap();
    eprintln!("AFTER DOSE: {:?}", v_stirred.solid_mol);
    eprintln!("SPECIES: {:?}", v_stirred.species_mol);

    let dt = 0.5;
    let mut t_stirred_90 = 0.0;
    for step_i in 0..200 {
        eprintln!("BEFORE STEP {}: solid={:?}, species={:?}", step_i, v_stirred.solid_mol, v_stirred.species_mol);
        v_stirred.step(dt).unwrap();
        eprintln!("AFTER STEP {}: solid={:?}, species={:?}", step_i, v_stirred.solid_mol, v_stirred.species_mol);
        t_stirred_90 += dt;
        let solid_rem = v_stirred.solid_mol.get("NaCl(s)").copied().unwrap_or(0.0);
        eprintln!("step {}: rem={}", step_i, solid_rem);
        if solid_rem <= target_remaining_mol {
            break;
        }
    }

    assert!(
        t_stirred_90 >= 10.0 && t_stirred_90 <= 60.0,
        "Stirred 1g NaCl (300 um) must 90% dissolve in 10-60 s: got {:.1} s",
        t_stirred_90
    );

    // 2. Unstirred dissolution (0 RPM)
    let mut v_still = test_beaker(100.0, 2.5);
    v_still.dose(DoseRequest {
        reagent_id: "water".into(),
        volume_ml: Some(50.0),
        mass_g: None,
        drops: None,
        temperature_k: None,
    }).unwrap();

    v_still.set_controls(VesselControls {
        stirring: Some(false),
        stir_rpm: Some(0.0),
        ..Default::default()
    });

    v_still.dose_with_diameter(DoseRequest {
        reagent_id: "nacl_s".into(),
        mass_g: Some(initial_mass_g),
        volume_ml: None,
        drops: None,
        temperature_k: None,
    }, 300.0).unwrap();

    let mut t_still_90 = 0.0;
    for _ in 0..600 {
        v_still.step(dt).unwrap();
        t_still_90 += dt;
        let solid_rem = v_still.solid_mol.get("NaCl(s)").copied().unwrap_or(0.0);
        if solid_rem <= target_remaining_mol {
            break;
        }
    }

    let slow_ratio = t_still_90 / t_stirred_90;
    assert!(
        slow_ratio >= 3.0,
        "Unstirred dissolution must be >= 3x slower: still = {:.1} s, stirred = {:.1} s, ratio = {:.2}",
        t_still_90, t_stirred_90, slow_ratio
    );

    // Continue stepping stirred vessel to verify complete dissolution at S <= 1
    for _ in 0..100 {
        v_stirred.step(dt).unwrap();
    }
    let final_solid = v_stirred.solid_mol.get("NaCl(s)").copied().unwrap_or(0.0);
    assert!(final_solid < 1e-6, "NaCl should completely dissolve at S <= 1: remaining = {}", final_solid);
}

// ------------------------------------------------------------------------------------------------
// Gate 2: BaSO4 nucleation induction time vs S and crystal morphology
// BaSO4 induction time vs S within ×3 of Nielsen over S = 10–1000, mean size decreasing with S.
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate_2_baso4_nielsen_induction_time_and_size() {
    let mw = 0.23339; // BaSO4 kg/mol
    let rho = 4500.0; // kg/m^3
    let c_sat = 0.0104; // mol/m^3
    let t = 298.15;
    let nu = 2.0;

    let nielsen_benchmarks = [
        (10.0, 150.0),
        (100.0, 0.50),
        (1000.0, 0.001),
    ];

    let mut prev_size = f64::INFINITY;
    for (s, ref_tau) in nielsen_benchmarks {
        let calc_tau = induction_time_s(t, rho, mw, c_sat, nu, s);
        let ratio = calc_tau / ref_tau;
        assert!(
            ratio >= 0.33 && ratio <= 3.0,
            "Induction time at S={} ({:.4e} s) must be within x3 of Nielsen reference ({:.4e} s): ratio = {:.2}",
            s, calc_tau, ref_tau, ratio
        );

        let d_m = mean_precipitate_size_m(s);
        assert!(
            d_m < prev_size,
            "Precipitate size must decrease with increasing supersaturation: S={}, size={:.2e} m vs prev={:.2e} m",
            s, d_m, prev_size
        );
        prev_size = d_m;
    }

    assert_eq!(precipitate_kind(1000.0), "gel");
    assert_eq!(precipitate_kind(50.0), "curds");
    assert_eq!(precipitate_kind(5.0), "crystal");
}

// ------------------------------------------------------------------------------------------------
// Gate 3: Metal acid corrosion (Butler-Volmer mixed potential)
// Mg > Zn > Fe ≫ Cu in 1 M HCl, rate ∝ metal area and independent of solution volume at fixed [H⁺].
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate_3_acid_corrosion_rates_area_and_volume_independence() {
    ensure_reagents();

    let ph_1m = 0.0; // 1 M HCl
    let t_k = 298.15;
    let area_1cm2 = 1.0e-4; // 1 cm^2
    let dt = 1.0;

    // 1. Series comparison: Mg > Zn > Fe >> Cu
    let mg_res = step_corrosion("Mg", ph_1m, t_k, area_1cm2, dt);
    let zn_res = step_corrosion("Zn", ph_1m, t_k, area_1cm2, dt);
    let fe_res = step_corrosion("Fe", ph_1m, t_k, area_1cm2, dt);
    let cu_res = step_corrosion("Cu", ph_1m, t_k, area_1cm2, dt);

    assert!(
        mg_res.mol_metal_dissolved > zn_res.mol_metal_dissolved,
        "Mg rate ({:.3e}) must exceed Zn rate ({:.3e})",
        mg_res.mol_metal_dissolved, zn_res.mol_metal_dissolved
    );
    assert!(
        zn_res.mol_metal_dissolved > fe_res.mol_metal_dissolved,
        "Zn rate ({:.3e}) must exceed Fe rate ({:.3e})",
        zn_res.mol_metal_dissolved, fe_res.mol_metal_dissolved
    );
    assert!(
        fe_res.mol_metal_dissolved > 100.0 * cu_res.mol_metal_dissolved,
        "Fe rate ({:.3e}) must vastly exceed Cu rate ({:.3e})",
        fe_res.mol_metal_dissolved, cu_res.mol_metal_dissolved
    );
    assert!(cu_res.mol_metal_dissolved < 1e-15, "Cu in non-oxidising HCl must not corrode");

    // 2. Rate proportional to metal area (Zn at 1 cm^2 vs 2 cm^2)
    let area_2cm2 = 2.0e-4;
    let zn_res_2 = step_corrosion("Zn", ph_1m, t_k, area_2cm2, dt);
    let area_ratio = zn_res_2.mol_metal_dissolved / zn_res.mol_metal_dissolved;
    assert!(
        (area_ratio - 2.0).abs() < 0.01,
        "Rate must be proportional to metal area: expected 2.0, got {:.3}",
        area_ratio
    );

    // 3. Independent of solution volume at fixed [H+]
    let mut v50 = test_beaker(250.0, 3.5);
    v50.dose(DoseRequest { reagent_id: "hcl_1m".into(), volume_ml: Some(50.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
    v50.dose(DoseRequest { reagent_id: "zn_s".into(), mass_g: Some(0.5), volume_ml: None, drops: None, temperature_k: None }).unwrap();

    let mut v100 = test_beaker(250.0, 3.5);
    v100.dose(DoseRequest { reagent_id: "hcl_1m".into(), volume_ml: Some(100.0), mass_g: None, drops: None, temperature_k: None }).unwrap();
    v100.dose(DoseRequest { reagent_id: "zn_s".into(), mass_g: Some(0.5), volume_ml: None, drops: None, temperature_k: None }).unwrap();

    v50.step(1.0).unwrap();
    v100.step(1.0).unwrap();

    let zn50_dissolved = 0.5 / 65.38 - v50.solid_mol.get("Zn(s)").copied().unwrap_or(0.0);
    let zn100_dissolved = 0.5 / 65.38 - v100.solid_mol.get("Zn(s)").copied().unwrap_or(0.0);

    let diff = (zn50_dissolved - zn100_dissolved).abs() / zn50_dissolved.max(1e-12);
    assert!(
        diff < 0.05,
        "Corrosion rate must be independent of solution volume: 50 mL={:.3e} mol, 100 mL={:.3e} mol, diff={:.3}%",
        zn50_dissolved, zn100_dissolved, diff * 100.0
    );
}

// ------------------------------------------------------------------------------------------------
// Gate 4: Carbonated water degassing relaxation
// Open carbonated water τ of hours unstirred, minutes stirred.
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate_4_open_carbonated_water_degassing() {
    let depth_m = 0.025; // 2.5 cm depth

    // Unstirred (0 RPM)
    let tau_still_s = open_gas_relaxation_time_s(depth_m, 0.0);
    let tau_still_h = tau_still_s / 3600.0;

    assert!(
        tau_still_h >= 1.0,
        "Unstirred open carbonated water tau must be hours (>= 1.0 h): got {:.2} h ({:.0} s)",
        tau_still_h, tau_still_s
    );

    // Stirred (500 RPM)
    let tau_stirred_s = open_gas_relaxation_time_s(depth_m, 500.0);
    let tau_stirred_min = tau_stirred_s / 60.0;

    assert!(
        tau_stirred_min <= 15.0 && tau_stirred_min >= 0.5,
        "Stirred open carbonated water tau must be minutes (0.5 - 15 min): got {:.2} min ({:.0} s)",
        tau_stirred_min, tau_stirred_s
    );
}

// ------------------------------------------------------------------------------------------------
// Gate 5: CO2 hydration reaction delay
// CO2 + NaOH + phenolphthalein shows the hydration delay.
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate_5_co2_hydration_delay() {
    // Forward CO2 hydration rate constant k_fwd = k1 + k2 * [OH-]
    // Neutral water (pH 7, [OH-] = 1e-7 M):
    let k_neutral = K1_CO2_HYDRATION_298 + K2_CO2_OH_298 * 1.0e-7;
    assert!((k_neutral - 0.037).abs() < 0.002, "At pH 7, k_hydration must be ~0.037 s^-1: got {:.4}", k_neutral);

    // Dilute NaOH (0.01 M, [OH-] = 0.01 M):
    let k_naoh = K1_CO2_HYDRATION_298 + K2_CO2_OH_298 * 0.01;
    assert!(k_naoh > 50.0 && k_naoh < 150.0, "At 0.01 M NaOH, k_hydration must be ~85 s^-1: got {:.2}", k_naoh);

    // In alkaline phenolphthalein transition zone (pH ~ 10, [OH-] = 1e-4 M):
    let k_trans = K1_CO2_HYDRATION_298 + K2_CO2_OH_298 * 1.0e-4;
    let tau_trans = 1.0 / k_trans;
    assert!(
        tau_trans >= 0.5 && tau_trans <= 5.0,
        "At pH 10, hydration delay tau must be in [0.5, 5.0] s: got {:.2} s",
        tau_trans
    );

    // Test hydration flux across chemical potential gradient
    let flux = co2_hydration_flux_m_s(0.01, 1e-10, 1e-4, 0.0, 298.15);
    assert!(flux > 0.0, "CO2 hydration flux must be positive into alkaline solution");
}

// ------------------------------------------------------------------------------------------------
// Gate 6: Hexane evaporation rate
// 10 mL hexane from 38 cm² at 295 K loses 3–20 mL/h.
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate_6_hexane_evaporation() {
    let t_k = 295.15;
    let pool_area_m2 = 38.0e-4; // 38 cm^2
    let depth_below_rim_m = 0.03; // 3 cm
    let p_sat_hexane_pa = 17600.0; // ~ 17.6 kPa at 295 K
    let p_ambient_partial_pa = 0.0; // clean air
    let mw_hexane = 86.18;
    let dh_vap = 31500.0; // J/mol

    let (flux_mol_s, _heat_w) = sub_boiling_evaporation_rates(
        t_k,
        pool_area_m2,
        depth_below_rim_m,
        p_sat_hexane_pa,
        p_ambient_partial_pa,
        mw_hexane,
        dh_vap,
    );

    let rho_hexane_g_ml = 0.655;
    let mass_rate_g_s = flux_mol_s * mw_hexane;
    let vol_rate_ml_s = mass_rate_g_s / rho_hexane_g_ml;
    let vol_rate_ml_h = vol_rate_ml_s * 3600.0;

    assert!(
        vol_rate_ml_h >= 3.0 && vol_rate_ml_h <= 20.0,
        "10 mL hexane from 38 cm^2 at 295 K must evaporate at 3 - 20 mL/h: got {:.2} mL/h",
        vol_rate_ml_h
    );
}

// ------------------------------------------------------------------------------------------------
// Gate 7: BaSO4 sedimentation and Brownian colloidal stability
// 10 µm BaSO4 settles 4 cm in 150–300 s in water and ~1000× slower in glycerol.
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate_7_baso4_settling_in_water_and_glycerol() {
    let dp = 10.0e-6; // 10 um
    let rho_baso4 = 4500.0; // kg/m^3
    let h = 0.04; // 4 cm
    let phi = 0.001;
    let t = 293.15;

    // Water: rho ~ 998 kg/m^3, eta ~ 1.002e-3 Pa*s
    let rho_water = 998.2;
    let eta_water = 1.002e-3;
    let tau_water = settling_time_s(h, dp, rho_baso4, rho_water, eta_water, phi, t);

    assert!(
        tau_water >= 150.0 && tau_water <= 300.0,
        "10 um BaSO4 in water must settle 4 cm in [150, 300] s: got {:.1} s",
        tau_water
    );

    // Glycerol: rho ~ 1261 kg/m^3, eta ~ 1.412 Pa*s
    let rho_gly = 1261.0;
    let eta_gly = 1.412;
    let tau_gly = settling_time_s(h, dp, rho_baso4, rho_gly, eta_gly, phi, t);

    let ratio = tau_gly / tau_water;
    assert!(
        ratio >= 700.0 && ratio <= 2000.0,
        "Settling in glycerol must be ~1000x slower than water: ratio = {:.1}",
        ratio
    );
}

// ------------------------------------------------------------------------------------------------
// Gate 8: Combustion pool fire and flames
// Ethanol pool fire in a 250 mL beaker 1–2 kW; hexane ignites; methanol flame near-invisible; flame dies under N2.
// ------------------------------------------------------------------------------------------------
#[test]
fn test_gate_8_combustion_pool_fire_and_flames() {
    // 1. Ethanol pool fire in 250 mL beaker (inner radius 3.5 cm -> area ~ 38.5 cm^2)
    let area_m2 = std::f64::consts::PI * 0.035_f64.powi(2);
    let props_ethanol = get_fuel_props("ethanol").expect("ethanol props");
    let (power_w, _mol_s) = pool_fire_combustion_rates(&props_ethanol, area_m2, 0.209);
    let power_kw = power_w / 1000.0;

    assert!(
        power_kw >= 1.0 && power_kw <= 2.0,
        "Ethanol pool fire in 250 mL beaker must produce 1-2 kW: got {:.2} kW",
        power_kw
    );

    // 2. Hexane ignites at room temperature (295 K)
    let props_hexane = get_fuel_props("hexane").expect("hexane props");
    let p_sat_hexane_295 = 17600.0;
    let p_amb = 101325.0;
    assert!(
        is_fuel_ignitable(p_sat_hexane_295, p_amb, 0.209, &props_hexane),
        "Hexane vapor at 295 K must ignite in air"
    );

    // 3. Methanol flame is near-invisible (sooting tendency / luminosity < 0.1)
    let visual_meoh = fuel_flame_appearance("methanol");
    assert!(
        visual_meoh.luminosity <= 0.10,
        "Methanol flame must be near-invisible (luminosity <= 0.10): got {:.2}",
        visual_meoh.luminosity
    );
    let visual_c2h5oh = fuel_flame_appearance("ethanol");
    assert!(
        visual_c2h5oh.luminosity > visual_meoh.luminosity,
        "Ethanol must be more luminous than methanol"
    );

    // 4. Flame dies under N2 (O2 < 12%)
    let (power_n2, _) = pool_fire_combustion_rates(&props_ethanol, area_m2, 0.10);
    assert_eq!(power_n2, 0.0, "Flame must extinguish when ambient O2 is 10% (< 12%)");
    let (power_air, _) = pool_fire_combustion_rates(&props_ethanol, area_m2, 0.209);
    assert!(power_air > 0.0, "Flame must burn in normal air (20.9% O2)");
}
