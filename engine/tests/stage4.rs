//! Stage 4 gates (docs/plans/generalization-master-plan.md section 8, Stage 4): gas phase, atmosphere, vapour-liquid
//! equilibrium and sealed vessels. Every test drives the real `Vessel` path (or, for the pure saturation curve, the
//! species-record resolver the vessel uses). Reference values are textbook / steam-table data, not the engine's output.

use reaction_chamber_engine::chem_db::{self, ReagentCatalogEntry};
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::gas_phase::AtmosphereSpec;
use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::vle;
use std::collections::HashMap;

const ATM: f64 = 101_325.0;

fn vessel(t: f64, sealed: bool, capacity: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: capacity,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(sealed),
        // a stopper and glass that hold (the gates measure pressure, they do not pop)
        stopper_pop_atm: Some(1.0e4),
        burst_atm: Some(1.0e4),
    })
}

fn ml(v: &mut Vessel, id: &str, x: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(x), mass_g: None, drops: None, temperature_k: None }).unwrap();
}

fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    for _ in 0..((seconds / dt).round() as usize) {
        v.step(dt).unwrap();
    }
}

fn sp(v: &Vessel, s: &str) -> f64 {
    v.species_mol.get(s).copied().unwrap_or(0.0)
}

fn atmosphere(v: &mut Vessel, spec: AtmosphereSpec) {
    v.set_controls(VesselControls { atmosphere: Some(spec), ..Default::default() });
}

fn seal(v: &mut Vessel) {
    v.set_controls(VesselControls { sealed: Some(true), ..Default::default() });
}

/// Imports a compound the way the web layer does (model, register reagent + compound record).
fn import(req: CompoundRequest) -> CompoundModel {
    let m = model_compound(&req);
    assert!(m.modelable, "{}: {}", req.id, m.reason);
    chem_db::register_custom_reagent(m.entry.clone().expect("entry"));
    if let Some(c) = &m.compound {
        chem_db::register_custom_compound(c.clone());
    }
    m
}

/// Mixes a binary of ethanol and water of the given ethanol mole fraction (total `n` mol) in an open vessel.
fn ethanol_water(x_eth: f64, n: f64) -> Vessel {
    let mut v = vessel(295.15, false, 250.0);
    let n_e = n * x_eth;
    let n_w = n - n_e;
    if n_w > 0.0 {
        ml(&mut v, "water", n_w * 18.015);
    }
    if n_e > 0.0 {
        ml(&mut v, "ethanol", n_e * 46.069 / 0.789);
    }
    v
}

// ---- item 5 / water vapour pressure ---------------------------------------------------------------------------------------

#[test]
fn s4_1_water_saturation_pressure_matches_the_steam_tables() {
    // steam tables (kPa): 25 C 3.169, 100 C 101.42, 150 C 476.2, 200 C 1554, 300 C 8588
    let w = vle::volatile_from_store("H2O").expect("water record");
    for (t_c, kpa) in [(25.0, 3.169), (100.0, 101.42), (150.0, 476.2), (200.0, 1554.0), (300.0, 8588.0)] {
        let p = w.psat_pa(273.15 + t_c) / 1e3;
        assert!(((p - kpa) / kpa).abs() < 0.01, "{} C: {:.3} kPa vs {}", t_c, p, kpa);
    }
    // the same number is what a sealed vessel's vapour pressure and a boiling beaker use: one curve
    let mut v = vessel(298.15, false, 250.0);
    ml(&mut v, "water", 50.0);
    let p = v.liquid_vapour_pressure_pa(373.124);
    assert!((p / ATM - 1.0).abs() < 2e-3, "{}", p);
}

// ---- boiling: pure liquids at 1 atm and 0.1 atm ---------------------------------------------------------------------------

/// Heats `v` until it has boiled for a while; returns the plateau temperature.
fn plateau_temperature(v: &mut Vessel) -> f64 {
    v.set_controls(VesselControls { heater_w: Some(300.0), ..Default::default() });
    let mut t_seen = 0.0;
    let mut boiling_steps = 0;
    for _ in 0..4000 {
        v.step(0.5).unwrap();
        if v.boil_vapour_ml_s > 0.0 {
            boiling_steps += 1;
            t_seen = v.temperature_k;
            if boiling_steps > 20 {
                break;
            }
        }
    }
    assert!(boiling_steps > 20, "never boiled (T = {} K)", v.temperature_k);
    t_seen
}

#[test]
fn s4_2_ethanol_boils_at_351_4_k_at_one_atmosphere() {
    let mut v = vessel(295.15, false, 250.0);
    ml(&mut v, "ethanol", 50.0);
    let t = plateau_temperature(&mut v);
    println!("[s4_2] ethanol plateau at 1 atm: {:.3} K", t);
    assert!((t - 351.4).abs() < 0.5, "ethanol plateau {} K", t);
    assert!(v.snapshot().boil_intensity > 0.1);
}

#[test]
fn s4_3_ethanol_boils_near_300_k_at_a_tenth_of_an_atmosphere() {
    // a reduced-pressure atmosphere is just another input: no per-pressure clamp, the bubble point moves
    let mut v = vessel(295.15, false, 250.0);
    atmosphere(&mut v, AtmosphereSpec { pressure_atm: Some(0.1), ..Default::default() });
    ml(&mut v, "ethanol", 50.0);
    let t = plateau_temperature(&mut v);
    println!("[s4_3] ethanol plateau at 0.1 atm: {:.3} K", t);
    // real value 302.5 K (ethanol vapour pressure 10.5 kPa at 30 C); the plan's gate is "about 300 K"
    assert!((t - 300.0).abs() < 4.0, "ethanol plateau at 0.1 atm {} K", t);
    assert!(t < 351.0 - 40.0);
    // and water boils below room temperature in a rough vacuum, cooling itself by the boil
    let mut w = vessel(295.15, false, 250.0);
    atmosphere(&mut w, AtmosphereSpec { pressure_atm: Some(0.02), ..Default::default() });
    ml(&mut w, "water", 50.0);
    run(&mut w, 30.0, 0.5);
    let tb = w.bubble_point_k(0.02 * ATM).unwrap();
    assert!(tb < 295.0 && tb > 285.0, "water bubble point at 0.02 atm {} K", tb);
    assert!(w.temperature_k < 293.0, "boiling in vacuum cools the water: {}", w.temperature_k);
}

// ---- sealed vessels --------------------------------------------------------------------------------------------------------

#[test]
fn s4_4_sealed_water_at_200_c_reads_about_17_atm() {
    // 50 mL of water in a 250 mL sealed vessel held at 200 C: IAPWS saturation 15.3 atm plus the air (compressed and heated)
    let mut v = vessel(295.15, false, 250.0);
    ml(&mut v, "water", 50.0);
    seal(&mut v);
    v.temperature_k = 473.15;
    // the bath is set a little above 200 C: at steady state the vessel sits ~3.6 K below it (0.5 W/K loss to the room)
    v.set_controls(VesselControls { bath_k: Some(Some(476.8)), ..Default::default() });
    run(&mut v, 200.0, 0.5);
    assert!((v.temperature_k - 473.15).abs() < 1.0, "T {}", v.temperature_k);
    println!("[s4_4] sealed 50 mL water at {:.2} K: {:.3} atm", v.temperature_k, v.pressure_atm);
    assert!((v.pressure_atm - 16.8).abs() < 0.8, "sealed 50 mL water at 200 C: {:.2} atm", v.pressure_atm);
    let c = v.snapshot().conservation;
    assert!(c.ok, "{:?}", c);
    // the headspace is one gas phase: water vapour + the air captured at sealing
    let gp = v.snapshot().gas_phase.unwrap();
    assert_eq!(gp.kind, "sealed");
    assert_eq!(gp.eos, "peng-robinson");
    assert!(gp.species.iter().any(|s| s.species == "N2(g)") && gp.species.iter().any(|s| s.species == "H2O(g)"));
}

#[test]
fn s4_5_sealed_ethanol_above_its_critical_temperature_is_one_supercritical_fluid() {
    let mut v = vessel(295.15, false, 250.0);
    ml(&mut v, "ethanol", 50.0);
    seal(&mut v);
    // below Tc (514 K) there is liquid and vapour
    v.temperature_k = 480.0;
    v.set_controls(VesselControls { bath_k: Some(Some(480.0)), ..Default::default() });
    run(&mut v, 60.0, 0.5);
    let below = v.snapshot();
    assert!(!below.gas_phase.as_ref().unwrap().supercritical);
    assert!(below.total_liquid_ml > 1.0, "liquid below Tc: {} mL", below.total_liquid_ml);
    // above Tc: no liquid phase, all of the ethanol is in the gas phase, the pressure is the Peng-Robinson one
    v.temperature_k = 560.0;
    v.set_controls(VesselControls { bath_k: Some(Some(560.0)), ..Default::default() });
    run(&mut v, 120.0, 0.5);
    let above = v.snapshot();
    let gp = above.gas_phase.as_ref().unwrap();
    assert!(gp.supercritical, "{:?}", gp);
    assert!(above.total_liquid_ml < 0.5 && sp(&v, "C2H5OH") < 1e-6, "liquid left: {} mL, {} mol", above.total_liquid_ml, sp(&v, "C2H5OH"));
    let n_eth = v.headspace_gas_mol.get("C2H5OH(g)").copied().unwrap_or(0.0);
    assert!((n_eth - 50.0 * 0.789 / 46.069).abs() < 1e-3, "all ethanol is fluid: {}", n_eth);
    // PR pressure of 0.856 mol of ethanol in ~250 mL at 560 K: well above the critical pressure, below the ideal-gas value
    let ideal = n_eth * 8.314462618 * 560.0 / (250.0e-6) / ATM;
    println!("[s4_5] sealed ethanol at {:.1} K: {:.2} atm (ideal gas {:.2} atm), liquid {:.3} mL", v.temperature_k, above.pressure_atm, ideal, above.total_liquid_ml);
    assert!(above.pressure_atm > 60.0 && above.pressure_atm < ideal, "P {} atm, ideal gas {} atm", above.pressure_atm, ideal);
}

// ---- mixtures: UNIFAC activities, bubble points, the azeotrope ------------------------------------------------------------

#[test]
fn s4_6_ethanol_water_bubble_points_and_azeotrope() {
    // x_EtOH = 0.2 boils at 356 +/- 1.5 K
    let v = ethanol_water(0.2, 1.0);
    let t = v.bubble_point_k(ATM).unwrap();
    println!("[s4_6] ethanol/water x=0.2 bubble point {:.3} K", t);
    assert!((t - 356.0).abs() < 1.5, "x=0.2 bubble point {} K", t);
    // the ethanol-rich vapour: y_EtOH(x=0.2) ~ 0.52
    let (_, y) = v.bubble_point_vapour(ATM).unwrap();
    let y_e = y.iter().find(|(g, _)| g == "C2H5OH(g)").unwrap().1;
    assert!(y_e > 0.45 && y_e < 0.60, "vapour y(EtOH) {}", y_e);
    // the azeotrope: the composition at which the vapour has the liquid's composition, found by bisection on y - x
    let (mut lo, mut hi) = (0.7, 0.99);
    for _ in 0..30 {
        let mid = 0.5 * (lo + hi);
        let v = ethanol_water(mid, 1.0);
        let (_, y) = v.bubble_point_vapour(ATM).unwrap();
        let ye = y.iter().find(|(g, _)| g == "C2H5OH(g)").unwrap().1;
        if ye > mid {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let x_az = 0.5 * (lo + hi);
    let t_az = ethanol_water(x_az, 1.0).bubble_point_k(ATM).unwrap();
    println!("[s4_6] azeotrope x = {:.4}, T = {:.3} K", x_az, t_az);
    assert!((x_az - 0.89).abs() < 0.03, "azeotrope at x = {}", x_az);
    assert!((t_az - 351.3).abs() < 0.5, "azeotrope boils at {} K", t_az);
    // it is the minimum of the boiling-point curve
    for x in [0.7, 0.8, 0.95, 0.99] {
        assert!(ethanol_water(x, 1.0).bubble_point_k(ATM).unwrap() >= t_az - 1e-6);
    }
}

#[test]
fn s4_7_boiling_ethanol_water_distils_the_light_component_first() {
    // x_EtOH = 0.2 heated at constant pressure: the first vapour is ethanol-rich, so the liquid gets *poorer* in ethanol
    // and the boiling temperature rises toward 373 K (no pure-component plateaus, one boiling range)
    let mut v = ethanol_water(0.2, 2.0);
    let (n_e0, n_w0) = (sp(&v, "C2H5OH"), sp(&v, "H2O"));
    v.set_controls(VesselControls { heater_w: Some(600.0), ..Default::default() });
    let mut t_first = None;
    let mut t_last = 0.0;
    for _ in 0..1200 {
        v.step(0.25).unwrap();
        if v.boil_vapour_ml_s > 0.0 {
            t_first.get_or_insert(v.temperature_k);
            t_last = v.temperature_k;
        }
        if sp(&v, "C2H5OH") < 0.05 * n_e0 {
            break;
        }
    }
    let t_first = t_first.expect("boiled");
    assert!((t_first - 356.0).abs() < 2.0, "boiling began at {} K", t_first);
    assert!(t_last > t_first + 5.0, "the boiling range climbs: {} -> {}", t_first, t_last);
    let x_now = sp(&v, "C2H5OH") / (sp(&v, "C2H5OH") + sp(&v, "H2O"));
    assert!(x_now < 0.2 * 0.5, "ethanol was boiled off first: x = {}", x_now);
    // (distilling 95 % of the ethanol out of the 80 mol % water also takes a good part of the water with it)
    assert!(sp(&v, "H2O") > 0.5 * n_w0, "half the water is still there: {} of {} mol", sp(&v, "H2O"), n_w0);
    assert!(v.snapshot().conservation.ok);
}

#[test]
fn s4_8_hexane_toluene_is_one_ideal_phase_boiling_at_355_k() {
    let hexane = import(CompoundRequest {
        id: "s4_hexane".into(), name: "Hexane".into(), formula: "C6H14".into(), smiles: Some("CCCCCC".into()),
        inchi_key: Some("VLKZOEOYAKHREP-UHFFFAOYSA-N".into()), state: Some("liquid".into()), density: Some(0.655),
        t_melt_ref_k: Some(177.8), vapor_pressure_points: vec![[341.88, 101_325.0]], ..Default::default()
    });
    let toluene = import(CompoundRequest {
        id: "s4_toluene".into(), name: "Toluene".into(), formula: "C7H8".into(), smiles: Some("Cc1ccccc1".into()),
        inchi_key: Some("YXFVVABEGXRONW-UHFFFAOYSA-N".into()), state: Some("liquid".into()), density: Some(0.867),
        t_melt_ref_k: Some(178.0), vapor_pressure_points: vec![[383.78, 101_325.0]], ..Default::default()
    });
    let mut v = vessel(295.15, false, 250.0);
    // 50 / 50 mol %
    let n = 0.1;
    ml(&mut v, "s4_hexane", n * hexane.mw / 0.655);
    ml(&mut v, "s4_toluene", n * toluene.mw / 0.867);
    let t = v.bubble_point_k(ATM).unwrap();
    println!("[s4_8] hexane/toluene 50/50 bubble point {:.3} K", t);
    assert!((t - 355.0).abs() < 2.0, "hexane/toluene 50/50 bubble point {} K", t);
    // the two neat liquids are one phase: their activity coefficients are ~1 (UNIFAC) and the vapour is hexane rich
    let (_, y) = v.bubble_point_vapour(ATM).unwrap();
    let y_hex = y.iter().find(|(g, _)| g.starts_with("C6H14")).unwrap().1;
    assert!(y_hex > 0.6 && y_hex < 0.8, "y(hexane) {}", y_hex);
    // water and hexane do not mix: their vapour pressures add (heterogeneous azeotrope, boils below both)
    let mut w = vessel(295.15, false, 250.0);
    ml(&mut w, "water", 50.0);
    ml(&mut w, "s4_hexane", 20.0);
    let t_het = w.bubble_point_k(ATM).unwrap();
    assert!(t_het < 342.0 && t_het > 320.0, "water + hexane boils at {} K (below hexane's own 341.9 K)", t_het);
}

// ---- electrolytes ---------------------------------------------------------------------------------------------------------

#[test]
fn s4_9_two_molal_sodium_chloride_boils_at_375_2_k() {
    let mut v = vessel(295.15, false, 250.0);
    let kg = 0.1;
    let portion = Portion {
        volume_ml: 100.0,
        temperature_k: 295.15,
        aqueous_mol: [("H2O".to_string(), kg / 0.018_015_28), ("Na+".to_string(), 2.0 * kg), ("Cl-".to_string(), 2.0 * kg)].into(),
        organic_mol: HashMap::new(),
        solid_mol: HashMap::new(),
    };
    v.add_portion(portion).unwrap();
    let t = v.bubble_point_k(ATM).unwrap();
    println!("[s4_9] 2 m NaCl bubble point {:.3} K", t);
    assert!((t - 375.2).abs() < 0.3, "2 m NaCl boils at {} K", t);
    // and a boiling brine sits on that temperature, above the 373.1 K of pure water
    let t_pure = {
        let mut w = vessel(295.15, false, 250.0);
        ml(&mut w, "water", 50.0);
        w.bubble_point_k(ATM).unwrap()
    };
    assert!(t - t_pure > 1.8 && t - t_pure < 2.3, "elevation {} K", t - t_pure);
}

// ---- dissolved gases and the atmosphere ------------------------------------------------------------------------------------

fn co2_aq(v: &Vessel) -> f64 {
    sp(v, "CO2(aq)")
}

/// Total dissolved inorganic carbon (mol).
fn carbonate_total(v: &Vessel) -> f64 {
    sp(v, "CO2(aq)") + sp(v, "HCO3-") + sp(v, "CO3-2")
}

#[test]
fn s4_10_open_carbonated_water_relaxes_toward_the_air_value() {
    let mut v = vessel(298.15, false, 250.0);
    ml(&mut v, "water", 100.0);
    v.set_controls(VesselControls { stirring: Some(true), ..Default::default() });
    // 0.03 M dissolved CO2 (a bottle's worth: 0.9 atm of CO2 over it)
    let portion = Portion {
        volume_ml: 0.0,
        temperature_k: 298.15,
        aqueous_mol: [("CO2(aq)".to_string(), 0.003)].into(),
        organic_mol: HashMap::new(),
        solid_mol: HashMap::new(),
    };
    v.add_portion(portion).unwrap();
    let vol_l = v.aqueous_volume_ml() / 1000.0;
    let c0 = carbonate_total(&v) / vol_l;
    assert!(c0 > 0.028, "start {} M", c0);
    let mut prev = c0;
    for _ in 0..12 {
        run(&mut v, 900.0, 10.0);
        let c = carbonate_total(&v) / vol_l;
        assert!(c < prev, "monotone relaxation");
        prev = c;
    }
    let c_aq = co2_aq(&v) / vol_l;
    // equilibrium with 420 ppm CO2 at 25 C: 0.0334 mol/(kg bar) x 4.3e-4 bar = 1.4e-5 M
    println!("[s4_10] CO2(aq) after 3 h: {:.3e} M", c_aq);
    assert!(c_aq > 1.0e-5 && c_aq < 2.0e-5, "CO2(aq) after 3 h: {:.3e} M (air value 1.4e-5 M)", c_aq);
    assert!(v.snapshot().conservation.ok);
}

#[test]
fn s4_11_ammonia_leaves_a_hot_stirred_open_solution() {
    let mut v = vessel(295.15, false, 250.0);
    v.dose(DoseRequest { reagent_id: "nh3_2m".into(), volume_ml: Some(100.0), mass_g: None, drops: None, temperature_k: Some(363.15) }).unwrap();
    v.set_controls(VesselControls { stirring: Some(true), bath_k: Some(Some(363.15)), ..Default::default() });
    let total = |v: &Vessel| sp(v, "NH3") + sp(v, "NH4+");
    let n0 = total(&v);
    assert!((n0 - 0.2).abs() < 0.01, "{}", n0);
    run(&mut v, 600.0, 1.0);
    let n1 = total(&v);
    println!("[s4_11] ammonia kept after 10 min at 363 K: {:.1} %", 100.0 * n1 / n0);
    assert!(n1 <= 0.5 * n0, "2 M NH3 at 363 K stirred for 10 min kept {:.0} % of its ammonia", 100.0 * n1 / n0);
    assert!(v.snapshot().conservation.ok);
}

#[test]
fn s4_12_dilute_sodium_hydroxide_absorbs_carbon_dioxide_from_the_air() {
    let mut v = vessel(298.15, false, 250.0);
    ml(&mut v, "water", 99.0);
    ml(&mut v, "naoh_0_1m", 1.0);
    v.set_controls(VesselControls { stirring: Some(true), ..Default::default() });
    let ph0 = v.current_ph();
    let c0 = carbonate_total(&v);
    run(&mut v, 7200.0, 10.0);
    let c1 = carbonate_total(&v);
    println!("[s4_12] 1 mM NaOH 2 h in air: pH {:.3} -> {:.3}, carbonate {:.3e} mol", ph0, v.current_ph(), c1);
    assert!(ph0 > 10.8, "start pH {}", ph0);
    // 1 mM NaOH, stirred, 2 h: ~0.2 mM of carbonate (CO2 uptake limited by the surface transfer, no chemical enhancement)
    assert!(c1 > c0 + 1e-5, "carbonate species {} -> {} mol", c0, c1);
    assert!(v.current_ph() < ph0 - 0.04, "pH {} -> {}", ph0, v.current_ph());
    // in an atmosphere without CO2 nothing is absorbed
    let mut w = vessel(298.15, false, 250.0);
    atmosphere(&mut w, AtmosphereSpec { composition: Some([("N2(g)".to_string(), 1.0)].into()), ..Default::default() });
    ml(&mut w, "water", 99.0);
    ml(&mut w, "naoh_0_1m", 1.0);
    w.set_controls(VesselControls { stirring: Some(true), ..Default::default() });
    run(&mut w, 7200.0, 10.0);
    assert!(carbonate_total(&w) < 1e-9, "{}", carbonate_total(&w));
}

#[test]
fn s4_13_gas_over_water_at_293_k_is_2_3_percent_vapour() {
    let mut v = vessel(293.15, false, 250.0);
    ml(&mut v, "water", 100.0);
    seal(&mut v);
    run(&mut v, 30.0, 0.5);
    let gp = v.snapshot().gas_phase.unwrap();
    let y_w = gp.species.iter().find(|s| s.species == "H2O(g)").unwrap().mole_fraction;
    let dry = 1.0 - y_w;
    println!("[s4_13] dry fraction of the gas over water at 293.15 K: {:.4}, P {:.4} atm", dry, v.pressure_atm);
    assert!((dry - 0.977).abs() < 0.002, "dry fraction {}", dry);
    // the pressure is the air's plus the saturation pressure
    assert!(v.pressure_atm > 1.0 && v.pressure_atm < 1.03, "{}", v.pressure_atm);
    // air is mostly nitrogen and oxygen
    let y_n2 = gp.species.iter().find(|s| s.species == "N2(g)").unwrap().mole_fraction;
    assert!((y_n2 - 0.78 * dry).abs() < 0.01);
}

// ---- atmospheres and gas dosing ---------------------------------------------------------------------------------------------

#[test]
fn s4_14_atmospheres_are_inputs_oxygen_rich_air_dissolves_more_oxygen() {
    let mk = |o2: f64| {
        let mut v = vessel(298.15, false, 250.0);
        atmosphere(&mut v, AtmosphereSpec { composition: Some([("N2(g)".to_string(), 1.0 - o2), ("O2(g)".to_string(), o2)].into()), ..Default::default() });
        ml(&mut v, "water", 100.0);
        v.set_controls(VesselControls { stirring: Some(true), ..Default::default() });
        run(&mut v, 3600.0, 10.0);
        v
    };
    let (air, pure) = (mk(0.21), mk(1.0));
    let ratio = sp(&pure, "O2(aq)") / sp(&air, "O2(aq)");
    assert!(ratio > 4.0 && ratio < 5.5, "O2(aq) ratio {}", ratio);
    // 21 % O2 over water at 25 C (50 % humid air): 2.7e-4 M = 8.7 mg/L (air-saturated water holds 8.3 mg/L)
    let c = sp(&air, "O2(aq)") / (air.aqueous_volume_ml() / 1000.0);
    assert!(c > 2.2e-4 && c < 3.1e-4, "{} M", c);
    // pressurised air raises the pressure of a sealed vessel
    let mut p = vessel(298.15, false, 250.0);
    atmosphere(&mut p, AtmosphereSpec { pressure_atm: Some(3.0), ..Default::default() });
    seal(&mut p);
    run(&mut p, 5.0, 0.5);
    assert!((p.pressure_atm - 3.0).abs() < 0.1, "{}", p.pressure_atm);
}

#[test]
fn s4_15_gas_dosing_goes_into_the_headspace_or_dissolves() {
    // a gas reagent (moles of gas at room conditions): sealed vessel
    let entry = ReagentCatalogEntry {
        id: "s4_co2_gas".into(), name: "Carbon dioxide gas".into(), formula: "CO2".into(), form: "gas".into(),
        concentration_m: None, density_g_ml: 0.0018, ghs: vec![], signal_word: String::new(), bottle_colour: "clear".into(),
        composition: [("CO2(g)".to_string(), 1.0)].into(), label: "CO2".into(), by_mass: false, dropper: None, inchi_key: None,
    };
    chem_db::register_custom_reagent(entry);
    let mut v = vessel(298.15, false, 250.0);
    seal(&mut v);
    let p0 = {
        run(&mut v, 1.0, 0.5);
        v.pressure_atm
    };
    ml(&mut v, "s4_co2_gas", 100.0); // 100 mL of gas at 25 C, 1 atm = 4.09 mmol
    run(&mut v, 1.0, 0.5);
    let n = v.headspace_gas_mol.get("CO2(g)").copied().unwrap_or(0.0);
    assert!((n - 4.087e-3).abs() < 1e-4, "CO2 in the headspace: {} mol (100 mL at 25 C, 1 atm = 4.087 mmol)", n);
    assert!(v.pressure_atm > p0 + 0.3, "pressure rose {} -> {}", p0, v.pressure_atm);
    // open vessel with water: part dissolves (sparging), the rest bubbles out
    let mut o = vessel(298.15, false, 250.0);
    ml(&mut o, "water", 100.0);
    ml(&mut o, "s4_co2_gas", 100.0);
    let dissolved = carbonate_total(&o);
    assert!(dissolved > 1e-4 && dissolved < 4.1e-3, "dissolved {} mol", dissolved);
    assert!(o.snapshot().conservation.ok, "{:?}", o.snapshot().conservation);
    assert!(o.gas_fluxes.iter().any(|g| g.species == "CO2(g)"), "the undissolved gas is seen leaving as bubbles");
}

#[test]
fn s4_16_stopper_pop_vents_to_the_atmosphere_and_books_the_gas() {
    let mut v = Vessel::new(VesselConfig {
        vessel_type: "erlenmeyer-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5,
        temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.0), burst_atm: Some(6.0),
    });
    ml(&mut v, "water", 100.0);
    seal(&mut v);
    v.set_controls(VesselControls { heater_w: Some(400.0), ..Default::default() });
    let mut popped = false;
    for _ in 0..2000 {
        v.step(0.5).unwrap();
        if !v.sealed {
            popped = true;
            break;
        }
    }
    assert!(popped, "the stopper pops when the pressure reaches 2 atm (T = {} K, P = {})", v.temperature_k, v.pressure_atm);
    assert!((v.pressure_atm - 1.0).abs() < 1e-9);
    assert!(v.headspace_gas_mol.is_empty());
    assert!(v.snapshot().conservation.ok, "{:?}", v.snapshot().conservation);
}
