//! Stage 8 gates (docs/plans/generalization-master-plan.md section 8, Stage 8): heterogeneous and transport rates.
//! Every gate drives the real `Vessel` path (dose, step, snapshot); the reference values are textbook / literature data,
//! never the engine's own output. Nothing here is keyed by a compound the engine special-cases: the metals, salts and
//! fuels are ordinary store species and imports.

use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::transfer::nucleation;
use reaction_chamber_engine::vessel::*;
use std::collections::HashMap;

fn beaker(capacity_ml: f64, radius_cm: f64, t: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "test-beaker".into(),
        capacity_ml,
        glass_mass_g: 100.0,
        inner_radius_cm: radius_cm,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(false),
        stopper_pop_atm: Some(2.0),
        burst_atm: Some(6.0),
    })
}

fn ml(v: &mut Vessel, id: &str, x: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(x), mass_g: None, drops: None, temperature_k: None }).unwrap();
}

fn grams(v: &mut Vessel, id: &str, x: f64, diameter_um: f64) {
    v.dose_with_diameter(DoseRequest { reagent_id: id.into(), volume_ml: None, mass_g: Some(x), drops: None, temperature_k: None }, diameter_um).unwrap();
}

fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    for _ in 0..((seconds / dt).round() as usize) {
        v.step(dt).unwrap();
    }
}

fn solid_reagent(id: &str, species: &str, mw: f64, density: f64) {
    let mut comp = HashMap::new();
    comp.insert(species.to_string(), 1.0 / mw);
    chem_db::register_custom_reagent(chem_db::ReagentCatalogEntry {
        id: id.to_string(),
        name: id.to_string(),
        formula: species.trim_end_matches("(s)").to_string(),
        form: "solid".to_string(),
        concentration_m: None,
        density_g_ml: density,
        ghs: vec![],
        signal_word: "".to_string(),
        bottle_colour: "white".to_string(),
        composition: comp,
        label: species.to_string(),
        by_mass: true,
        dropper: None,
        inchi_key: None,
    });
}

fn ensure_reagents() {
    solid_reagent("s8_nacl", "NaCl(s)", 58.44, 2.16);
    solid_reagent("s8_zn", "Zn(s)", 65.38, 7.14);
    solid_reagent("s8_fe", "Fe(s)", 55.845, 7.874);
    solid_reagent("s8_cu", "Cu(s)", 63.546, 8.96);
    solid_reagent("s8_mg", "Mg(s)", 24.305, 1.74);
}

fn import(req: CompoundRequest) {
    let m = model_compound(&req);
    assert!(m.modelable, "{}: {}", req.id, m.reason);
    chem_db::register_custom_reagent(m.entry.clone().expect("entry"));
    if let Some(c) = &m.compound {
        chem_db::register_custom_compound(c.clone());
    }
    if let Some(min) = &m.mineral {
        chem_db::register_custom_mineral(min.clone());
    }
}

fn fuel_request(id: &str, name: &str, formula: &str, smiles: &str, ik: &str, density: f64, tb: f64, dh_comb: f64, dh_vap: f64) -> CompoundRequest {
    CompoundRequest {
        id: id.into(),
        name: name.into(),
        formula: formula.into(),
        smiles: Some(smiles.into()),
        inchi_key: Some(ik.into()),
        state: Some("liquid".into()),
        density: Some(density),
        vapor_pressure_points: vec![[tb, 101_325.0]],
        dh_vap_kj_mol: Some(dh_vap),
        dh_vap_at_k: Some(tb),
        dh_comb_kj_mol: Some(dh_comb),
        ..Default::default()
    }
}

fn solid_of(v: &Vessel, sp: &str) -> f64 {
    v.solid_mol.get(sp).copied().unwrap_or(0.0)
}

// ------------------------------------------------------------------------------------------------
// Gate 1: dissolution is limited by the transport to the particle surface (Sherwood correlation, stirring power).
// 1 g NaCl (300 um) in 50 mL water: stirred, 90 % dissolved in tens of seconds; resting, at least 3x slower; no solid
// remains at S <= 1.
// ------------------------------------------------------------------------------------------------
fn dissolve_time_to(frac_remaining: f64, rpm: f64, mass_g: f64, d_um: f64, volume_ml: f64) -> f64 {
    let mut v = beaker(100.0, 2.5, 298.15);
    ml(&mut v, "water", volume_ml);
    v.set_controls(VesselControls { stirring: Some(rpm > 0.0), stir_rpm: Some(rpm), ..Default::default() });
    grams(&mut v, "s8_nacl", mass_g, d_um);
    let n0 = mass_g / 58.44;
    let dt = 0.25;
    let mut t = 0.0;
    for _ in 0..4000 {
        if solid_of(&v, "NaCl(s)") <= frac_remaining * n0 {
            return t;
        }
        v.step(dt).unwrap();
        t += dt;
    }
    t
}

#[test]
fn gate1_nacl_dissolution_is_transport_limited_and_stirring_dependent() {
    ensure_reagents();
    let t_stirred = dissolve_time_to(0.10, 400.0, 1.0, 300.0, 50.0);
    let t_still = dissolve_time_to(0.10, 0.0, 1.0, 300.0, 50.0);
    println!("[gate1] 90% dissolved: stirred (400 rpm) {:.1} s, resting {:.1} s", t_stirred, t_still);
    // the particle starts as a crystal, not as a solution
    let mut v = beaker(100.0, 2.5, 298.15);
    ml(&mut v, "water", 50.0);
    grams(&mut v, "s8_nacl", 1.0, 300.0);
    assert!(solid_of(&v, "NaCl(s)") > 0.9 * 1.0 / 58.44, "the dose must not dissolve instantly");
    assert!(t_stirred >= 2.0 && t_stirred <= 60.0, "stirred dissolution time {} s", t_stirred);
    assert!(t_still >= 3.0 * t_stirred, "resting {} s must be >= 3x the stirred {} s", t_still, t_stirred);
    // finer powder dissolves faster (area and film thickness)
    let t_fine = dissolve_time_to(0.10, 0.0, 1.0, 100.0, 50.0);
    assert!(t_fine < t_still / 3.0, "100 um {} s vs 300 um {} s", t_fine, t_still);
    // no solid at S <= 1: after long stirring every grain is gone
    let mut v = beaker(100.0, 2.5, 298.15);
    ml(&mut v, "water", 50.0);
    v.set_controls(VesselControls { stirring: Some(true), stir_rpm: Some(400.0), ..Default::default() });
    grams(&mut v, "s8_nacl", 1.0, 300.0);
    run(&mut v, 120.0, 0.5);
    assert!(solid_of(&v, "NaCl(s)") < 1e-9, "NaCl must dissolve completely at S <= 1: {:e} mol left", solid_of(&v, "NaCl(s)"));
    assert!(v.particle_populations.get("NaCl(s)").map_or(true, |p| p.is_empty()));
    // saturated brine keeps its crystals: 25 g in 50 mL is beyond the solubility
    let mut v = beaker(100.0, 2.5, 298.15);
    ml(&mut v, "water", 50.0);
    v.set_controls(VesselControls { stirring: Some(true), stir_rpm: Some(400.0), ..Default::default() });
    grams(&mut v, "s8_nacl", 25.0, 300.0);
    run(&mut v, 600.0, 1.0);
    assert!(solid_of(&v, "NaCl(s)") > 0.0, "an oversaturated charge must keep a solid phase");
}

// ------------------------------------------------------------------------------------------------
// Gate 2: precipitation needs nucleation. Induction time falls steeply with supersaturation S, particle size falls with
// S (many nuclei at high S, few large crystals at low S); a solution just above S = 1 stays clear.
// ------------------------------------------------------------------------------------------------
fn baso4_mixture(s: f64) -> Vessel {
    let min = chem_db::get_default_minerals().into_iter().find(|m| m.solid_species == "BaSO4(s)").expect("BaSO4 row");
    let ksp = 10f64.powf(min.log_ksp_at(298.15));
    let c = s * ksp.sqrt(); // mol/L of each ion at S (activity effects shift S by a few percent)
    let mut v = beaker(100.0, 2.5, 298.15);
    let n = c * 0.05;
    let portion = Portion {
        volume_ml: 50.0,
        temperature_k: 298.15,
        aqueous_mol: [("H2O".to_string(), 2.7747), ("Ba+2".to_string(), n), ("SO4-2".to_string(), n), ("Na+".to_string(), 0.0), ("Cl-".to_string(), 0.0)].into_iter().filter(|(_, x)| *x > 0.0).collect(),
        organic_mol: HashMap::new(),
        solid_mol: HashMap::new(),
        particles: HashMap::new(),
    };
    // the portion is electroneutral (Ba+2 + SO4-2), so no spectator ions are needed
    v.add_portion(portion).unwrap();
    v
}

#[test]
fn gate2_baso4_induction_time_and_size_follow_nucleation_theory() {
    let min = chem_db::get_default_minerals().into_iter().find(|m| m.solid_species == "BaSO4(s)").unwrap();
    let ksp = 10f64.powf(min.log_ksp_at(298.15));
    let salt = nucleation::SaltProps { density_kg_m3: 4500.0, molar_mass_kg_mol: 0.23339, nu_total: 2.0, c_sat_fu_mol_m3: ksp.sqrt() * 1000.0, gamma_override_j_m2: None };
    let v_m3 = 50e-6;
    // induction time of the model (J V)^-1: monotonic, steep, minutes at S = 10, instantaneous at S >= 100
    let t10 = nucleation::induction_time_s(298.15, &salt, 10.0, v_m3);
    let t30 = nucleation::induction_time_s(298.15, &salt, 30.0, v_m3);
    let t100 = nucleation::induction_time_s(298.15, &salt, 100.0, v_m3);
    let t1000 = nucleation::induction_time_s(298.15, &salt, 1000.0, v_m3);
    println!("[gate2] model induction times: S=10 {:.3e} s, 30 {:.3e}, 100 {:.3e}, 1000 {:.3e}", t10, t30, t100, t1000);
    assert!(t10 > 10.0 && t10 < 1200.0, "S=10 -> {} s (Nielsen: minutes)", t10);
    assert!(t10 > t30 && t30 > t100 && t100 > t1000);
    assert!(t100 < 1.0 && t1000 < 1e-3);

    // through the vessel: a solution at S ~ 3 stays clear for ten minutes (metastable zone) ...
    let mut v = baso4_mixture(3.0);
    run(&mut v, 600.0, 1.0);
    assert!(solid_of(&v, "BaSO4(s)") < 1e-9, "S ~ 3 must stay metastable, found {:e} mol of solid", solid_of(&v, "BaSO4(s)"));
    // ... S ~ 10 holds for seconds, then precipitates
    let mut v = baso4_mixture(11.0);
    assert!(solid_of(&v, "BaSO4(s)") < 1e-9, "S ~ 11 must not precipitate within the mixing time");
    run(&mut v, 3600.0, 2.0);
    assert!(solid_of(&v, "BaSO4(s)") > 0.0, "S ~ 11 must precipitate within an hour");
    // ... S >= 100 precipitates at once; the particles get smaller as S rises
    let mut sizes = Vec::new();
    for s in [20.0, 100.0, 1000.0] {
        let mut v = baso4_mixture(s);
        // S = 20 takes minutes to nucleate and grow out; S >= 100 is done in seconds
        if s < 50.0 { run(&mut v, 3600.0, 2.0); } else { run(&mut v, 60.0, 0.5); }
        let snap = v.snapshot();
        let sd = snap.solids.iter().find(|x| x.species == "BaSO4(s)").unwrap_or_else(|| panic!("S={} must precipitate", s));
        println!("[gate2] S={}: {:.3} um, {:.3e} g", s, sd.particle_diameter_um, sd.mass_g);
        sizes.push(sd.particle_diameter_um);
        // nearly everything precipitates
        let ba_left = v.species_mol.get("Ba+2").copied().unwrap_or(0.0);
        assert!(ba_left < 0.2 * (s * ksp.sqrt() * 0.05), "S={} left {:e} mol Ba", s, ba_left);
    }
    assert!(sizes[0] > sizes[1] && sizes[1] > sizes[2], "mean size must fall with supersaturation: {:?}", sizes);
}

// ------------------------------------------------------------------------------------------------
// Gate 3: metals in acid by the mixed potential of their half-reactions: the activity series, proportional to the
// surface area, independent of the volume at fixed [H+]; copper does not dissolve in a non-oxidising acid.
// ------------------------------------------------------------------------------------------------
fn metal_in_acid(reagent: &str, species: &str, mass_g: f64, d_um: f64, acid_ml: f64, seconds: f64) -> f64 {
    let mut v = beaker(250.0, 3.5, 298.15);
    ml(&mut v, "hcl_1m", acid_ml);
    grams(&mut v, reagent, mass_g, d_um);
    let n0 = solid_of(&v, species);
    run(&mut v, seconds, 0.1);
    n0 - solid_of(&v, species)
}

#[test]
fn gate3_metal_acid_reactivity_series_area_and_volume_independence() {
    ensure_reagents();
    let (mg, zn, fe, cu) = (
        metal_in_acid("s8_mg", "Mg(s)", 0.2, 500.0, 50.0, 2.0),
        metal_in_acid("s8_zn", "Zn(s)", 0.5, 500.0, 50.0, 2.0),
        metal_in_acid("s8_fe", "Fe(s)", 0.5, 500.0, 50.0, 2.0),
        metal_in_acid("s8_cu", "Cu(s)", 0.5, 500.0, 50.0, 2.0),
    );
    println!("[gate3] mol dissolved in 2 s: Mg {:.3e}, Zn {:.3e}, Fe {:.3e}, Cu {:.3e}", mg, zn, fe, cu);
    // Mg is limited only by the delivery of H+ to its surface; Zn and Fe by the hydrogen overpotential of their own surface
    // (pure zinc has one of the highest, which is why amalgamated zinc does not react at all: the Zn / Fe order of
    // commercial metals, whose inclusions are cathodes, is not the order of pure metals); Cu does not reduce H+ at all.
    assert!(mg > 100.0 * zn && mg > 100.0 * fe, "Mg {:e} must outrun Zn {:e} and Fe {:e}", mg, zn, fe);
    // (copper does dissolve at a trace through the dissolved oxygen of the acid, E0(O2/H2O) = 1.23 V > E0(Cu2+/Cu))
    assert!(zn.min(fe) > 100.0 * cu.max(1e-30), "Zn {:e}, Fe {:e} must vastly outrun Cu {:e}", zn, fe, cu);
    assert!(cu < 1e-9, "Cu does not reduce H+: {:e} mol", cu);

    // rate proportional to the surface area: 0.2 g of 250 um grains has 2x the area of 0.2 g of 500 um grains... compare
    // the same mass in two grain sizes: area ratio = diameter ratio
    let fine = metal_in_acid("s8_zn", "Zn(s)", 0.3, 250.0, 50.0, 1.0);
    let coarse = metal_in_acid("s8_zn", "Zn(s)", 0.3, 500.0, 50.0, 1.0);
    let ratio = fine / coarse;
    println!("[gate3] fine/coarse Zn rate {:.3} (area ratio 2)", ratio);
    assert!(ratio > 1.7 && ratio < 2.3, "rate must scale with area: {}", ratio);

    // independent of the solution volume at fixed [H+]
    let r50 = metal_in_acid("s8_zn", "Zn(s)", 0.3, 500.0, 50.0, 1.0);
    let r150 = metal_in_acid("s8_zn", "Zn(s)", 0.3, 500.0, 150.0, 1.0);
    println!("[gate3] Zn in 50 mL {:.3e} mol/s, in 150 mL {:.3e}", r50, r150);
    assert!((r50 - r150).abs() / r50 < 0.05, "volume independence: {} vs {}", r50, r150);

    // products: hydrogen leaves, the cation joins the solution, atoms are conserved
    let mut v = beaker(250.0, 3.5, 298.15);
    ml(&mut v, "hcl_1m", 50.0);
    grams(&mut v, "s8_mg", 0.1, 500.0);
    run(&mut v, 30.0, 0.1);
    assert!(v.species_mol.get("Mg+2").copied().unwrap_or(0.0) > 1e-3, "Mg+2 {:?}", v.species_mol.get("Mg+2"));
    assert!(v.gas_fluxes.iter().any(|g| g.species == "H2(g)") || v.gas.escaped_mol > 0.0);
    let c = v.snapshot().conservation;
    assert!(c.max_element_rel_err < 1e-6 && c.charge_err_mol.abs() < 1e-9, "conservation {:?}", c);
}

// ------------------------------------------------------------------------------------------------
// Gate 3b: cementation: a more active metal displaces a nobler one from solution (the Daniell reaction without a salt
// bridge), with the nobler metal deposited as a new solid.
// ------------------------------------------------------------------------------------------------
#[test]
fn gate3b_zinc_cements_copper_out_of_copper_sulfate() {
    ensure_reagents();
    let mut v = beaker(250.0, 3.5, 298.15);
    ml(&mut v, "cuso4_0_1m", 50.0);
    grams(&mut v, "s8_zn", 0.2, 200.0);
    // dissolved copper = free ions + the CuSO4 ion pair
    let cu_dissolved = |v: &Vessel| v.species_mol.get("Cu+2").copied().unwrap_or(0.0) + v.species_mol.get("CuSO4").copied().unwrap_or(0.0);
    let cu0 = cu_dissolved(&v);
    // (300 s: about 60 % of the copper sits in the CuSO4 ion pair and only the free ion reacts at the electrode, so the
    // cementation, which accelerates as copper deposits, takes about 2.5 times longer than with fully dissociated sulfate)
    run(&mut v, 300.0, 0.25);
    let cu1 = cu_dissolved(&v);
    println!("[gate3b] Cu+2 {:.3e} -> {:.3e} mol, Cu(s) {:.3e}, Zn+2 {:.3e}", cu0, cu1, solid_of(&v, "Cu(s)"), v.species_mol.get("Zn+2").copied().unwrap_or(0.0));
    assert!(cu1 < 0.9 * cu0, "copper must leave the solution");
    assert!(solid_of(&v, "Cu(s)") > 0.0, "copper must deposit as a solid");
    assert!(v.species_mol.get("Zn+2").copied().unwrap_or(0.0) > 0.0);
    // charge and elements balance
    let c = v.snapshot().conservation;
    assert!(c.max_element_rel_err < 1e-6 && c.charge_err_mol.abs() < 1e-9, "conservation {:?}", c);
    // the reverse does not happen: copper in zinc sulfate does nothing
    let mut v = beaker(250.0, 3.5, 298.15);
    ml(&mut v, "water", 50.0);
    grams(&mut v, "s8_cu", 0.2, 200.0);
    v.add_portion(Portion { volume_ml: 0.0, temperature_k: 298.15, aqueous_mol: [("Zn+2".to_string(), 0.005), ("SO4-2".to_string(), 0.005)].into(), organic_mol: HashMap::new(), solid_mol: HashMap::new(), particles: HashMap::new() }).unwrap();
    run(&mut v, 120.0, 0.5);
    assert!(solid_of(&v, "Zn(s)") < 1e-9, "copper must not reduce zinc ions");
}

// ------------------------------------------------------------------------------------------------
// Gate 4: carbonated water in an open beaker degasses with tau of hours at rest and minutes when stirred.
// ------------------------------------------------------------------------------------------------
fn co2_tau(rpm: f64, total_s: f64, dt: f64) -> f64 {
    let mut v = beaker(250.0, 3.5, 298.15);
    ml(&mut v, "water", 100.0);
    v.set_controls(VesselControls { stirring: Some(rpm > 0.0), stir_rpm: Some(rpm), ..Default::default() });
    v.add_portion(Portion { volume_ml: 0.0, temperature_k: 298.15, aqueous_mol: [("CO2(aq)".to_string(), 0.0035)].into(), organic_mol: HashMap::new(), solid_mol: HashMap::new(), particles: HashMap::new() }).unwrap();
    let co2 = |v: &Vessel| v.species_mol.get("CO2(aq)").copied().unwrap_or(0.0) + v.species_mol.get("HCO3-").copied().unwrap_or(0.0);
    let c0 = co2(&v);
    let mut t = 0.0;
    while t < total_s {
        v.step(dt).unwrap();
        t += dt;
    }
    let c1 = co2(&v);
    let air_equilibrium = 1e-5; // atmospheric CO2 holds ~ 1e-5 mol in 100 mL: negligible against c0
    ((c1 - air_equilibrium).max(1e-30) / (c0 - air_equilibrium)).ln().abs().recip() * t
}

#[test]
fn gate4_open_carbonated_water_degasses_in_hours_at_rest_and_minutes_stirred() {
    let tau_stirred = co2_tau(500.0, 300.0, 1.0);
    let tau_rest = co2_tau(0.0, 3600.0, 10.0);
    println!("[gate4] tau stirred {:.0} s, at rest {:.0} s", tau_stirred, tau_rest);
    assert!(tau_stirred > 30.0 && tau_stirred < 900.0, "stirred tau {} s", tau_stirred);
    assert!(tau_rest > 3600.0, "resting tau {} s must be hours", tau_rest);
}

// ------------------------------------------------------------------------------------------------
// Gate 5: CO2 hydration is a real slow step: dissolved CO2 does not acidify water at once, and dilute alkali
// neutralises it in about a second (k2 [OH-] with k2 = 8500 /(M s)).
// ------------------------------------------------------------------------------------------------
#[test]
fn gate5_co2_hydration_delays_the_ph_change() {
    let ph_after = |base_ml: f64, naoh: &str, co2_mol: f64, t: f64| -> f64 {
        let mut v = beaker(250.0, 3.5, 298.15);
        if base_ml > 0.0 {
            ml(&mut v, naoh, base_ml);
        }
        ml(&mut v, "water", 50.0);
        v.add_portion(Portion { volume_ml: 0.0, temperature_k: 298.15, aqueous_mol: [("CO2(aq)".to_string(), co2_mol)].into(), organic_mol: HashMap::new(), solid_mol: HashMap::new(), particles: HashMap::new() }).unwrap();
        run(&mut v, t, 0.05);
        v.current_ph()
    };
    // dilute CO2 in neutral water: pH has barely moved after 0.2 s, and reaches the carbonic acid value later
    let early = ph_after(0.0, "naoh_0_1m", 5e-6, 0.2);
    let late = ph_after(0.0, "naoh_0_1m", 5e-6, 120.0);
    println!("[gate5] 5 uM CO2 in water: pH {:.2} at 0.2 s, {:.2} at 120 s", early, late);
    // an instantaneous equilibrium would put the pH at its final value at once
    assert!(early > late + 0.8, "no instantaneous acidification: pH {} at 0.2 s vs {} at 120 s", early, late);
    // 0.2 mM NaOH (phenolphthalein turns at pH 8.3-10) with 0.1 mM CO2: the pink persists for a moment, then fades
    let early = ph_after(0.1, "naoh_0_1m", 2.5e-5, 0.02);
    let late = ph_after(0.1, "naoh_0_1m", 2.5e-5, 30.0);
    println!("[gate5] CO2 into dilute NaOH: pH {:.2} at 0.02 s, {:.2} at 30 s", early, late);
    assert!(early > 9.5 && late < 8.0, "the indicator stays pink for a moment, then fades: pH {} -> {}", early, late);
}

// ------------------------------------------------------------------------------------------------
// Gate 6: a volatile liquid evaporates below its boiling point at the rate the geometry's transport allows, cooling
// itself.
// ------------------------------------------------------------------------------------------------
const HEXANE_IK: &str = "VLKZOEOYAKHREP-UHFFFAOYSA-N";

#[test]
fn gate6_hexane_evaporates_at_millilitres_per_hour_and_cools_the_liquid() {
    import(fuel_request("s8_hexane", "Hexane", "C6H14", "CCCCCC", HEXANE_IK, 0.659, 341.88, -4163.0, 28.85));
    // 10 mL in a dish of 38 cm2 (radius 3.5 cm) and 3 cm of glass above the liquid
    let mut v = beaker(115.0, 3.5, 295.0);
    ml(&mut v, "s8_hexane", 10.0);
    let v0 = v.snapshot().total_liquid_ml;
    run(&mut v, 300.0, 1.0);
    let v1 = v.snapshot().total_liquid_ml;
    let rate_ml_h = (v0 - v1) * (3600.0 / 300.0);
    println!("[gate6] hexane loses {:.1} mL/h; liquid at {:.1} K", rate_ml_h, v.temperature_k);
    assert!(rate_ml_h > 3.0 && rate_ml_h < 20.0, "evaporation {} mL/h", rate_ml_h);
    assert!(v.temperature_k < 294.9, "evaporation must cool the liquid: {} K", v.temperature_k);
}

// ------------------------------------------------------------------------------------------------
// Gate 7: sedimentation with the liquid's own density and viscosity: 10 um BaSO4 settles 4 cm in minutes in water and
// about a thousand times slower in a liquid a thousand times more viscous.
// ------------------------------------------------------------------------------------------------
#[test]
fn gate7_settling_follows_stokes_in_the_actual_liquid() {
    use reaction_chamber_engine::transfer::settling::settling_time_s;
    let t_w = settling_time_s(0.04, 10e-6, 4500.0, 998.2, 1.002e-3, 0.001, 293.15);
    let t_g = settling_time_s(0.04, 10e-6, 4500.0, 1261.0, 1.412, 0.001, 293.15);
    assert!(t_w > 150.0 && t_w < 300.0, "water: {} s", t_w);
    assert!(t_g / t_w > 700.0 && t_g / t_w < 2000.0, "glycerol / water = {}", t_g / t_w);

    // in the vessel: the suspended fraction of a 10 um precipitate decays over minutes, a 1 um one over hours
    ensure_reagents();
    let suspended_after = |d_um: f64, t: f64| -> f64 {
        solid_reagent("s8_baso4", "BaSO4(s)", 233.39, 4.5);
        let mut v = beaker(100.0, 2.5, 293.15);
        ml(&mut v, "water", 50.0);
        grams(&mut v, "s8_baso4", 0.01, d_um);
        v.ev.susp.insert("BaSO4(s)".to_string(), 1.0);
        run(&mut v, t, 1.0);
        v.ev.susp.get("BaSO4(s)").copied().unwrap_or(0.0)
    };
    let coarse = suspended_after(10.0, 300.0);
    let fine = suspended_after(1.0, 300.0);
    println!("[gate7] suspended after 300 s: 10 um {:.3}, 1 um {:.3}", coarse, fine);
    assert!(coarse < 0.5 && fine > 0.8 && fine > coarse + 0.3);
}

// ------------------------------------------------------------------------------------------------
// Gate 8: combustion of any fuel the data describes: an ethanol pool fire of a 250 mL beaker, hexane ignites at room
// temperature, methanol burns with a near-invisible flame, no flame without oxygen.
// ------------------------------------------------------------------------------------------------
fn burn(fuel: &str, o2: f64) -> Vessel {
    let mut v = beaker(250.0, 3.5, 295.15);
    ml(&mut v, fuel, 30.0);
    v.set_controls(VesselControls {
        atmosphere: Some(reaction_chamber_engine::gas_phase::AtmosphereSpec { composition: Some([("N2".to_string(), 1.0 - o2), ("O2".to_string(), o2)].into_iter().filter(|(_, x)| *x > 0.0).collect()), ..Default::default() }),
        igniter: Some(true),
        ..Default::default()
    });
    run(&mut v, 2.0, 0.5);
    v
}

#[test]
fn gate8_pool_fires_derive_from_fuel_data() {
    import(fuel_request("s8_hexane", "Hexane", "C6H14", "CCCCCC", HEXANE_IK, 0.659, 341.88, -4163.0, 28.85));
    import(fuel_request("s8_methanol", "Methanol", "CH4O", "CO", "OKKJLVBELUTLKV-UHFFFAOYSA-N", 0.792, 337.7, -726.0, 35.2));
    // ethanol (store species / catalog reagent)
    let v = burn("ethanol", 0.2095);
    let snap = v.snapshot();
    let flame = snap.flame.expect("ethanol must ignite in air");
    println!("[gate8] ethanol: {:.0} W, luminosity {:.3}, T {:.0} K", flame.power_w, flame.luminosity, flame.flame_temp_k);
    assert!(flame.power_w > 1000.0 && flame.power_w < 2000.0, "ethanol pool fire {} W", flame.power_w);
    assert!(flame.flame_temp_k > 1800.0 && flame.flame_temp_k < 2500.0, "flame temperature {}", flame.flame_temp_k);
    let lum_ethanol = flame.luminosity;
    // hexane ignites at room temperature (its vapour is above the lower flammability limit) and is the most luminous
    let v = burn("s8_hexane", 0.2095);
    let hex = v.snapshot().flame.expect("hexane must ignite at room temperature");
    // methanol: near-invisible flame
    let v = burn("s8_methanol", 0.2095);
    let meoh = v.snapshot().flame.expect("methanol must ignite");
    println!("[gate8] luminosity: methanol {:.3}, ethanol {:.3}, hexane {:.3}", meoh.luminosity, lum_ethanol, hex.luminosity);
    assert!(meoh.luminosity < 0.1 && meoh.luminosity < lum_ethanol && lum_ethanol < hex.luminosity);
    // under nitrogen there is no flame
    let v = burn("ethanol", 0.0);
    assert!(v.snapshot().flame.is_none(), "no oxygen, no flame");
    // water does not burn
    let mut v = beaker(250.0, 3.5, 295.15);
    ml(&mut v, "water", 30.0);
    v.set_controls(VesselControls { igniter: Some(true), ..Default::default() });
    run(&mut v, 2.0, 0.5);
    assert!(v.snapshot().flame.is_none());
    // a sealed jar's flame dies when its oxygen is gone, and the products stay in the jar
    let mut v = Vessel::new(VesselConfig {
        vessel_type: "jar".into(),
        capacity_ml: 250.0,
        glass_mass_g: 100.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(295.15),
        room_k: Some(295.15),
        sealed: Some(true),
        stopper_pop_atm: Some(10.0),
        burst_atm: Some(20.0),
    });
    ml(&mut v, "ethanol", 5.0);
    v.set_controls(VesselControls { igniter: Some(true), ..Default::default() });
    run(&mut v, 3.0, 0.1);
    for _ in 0..3000 {
        v.step(0.1).unwrap();
    }
    assert!(v.snapshot().flame.is_none(), "the flame must die once the jar's oxygen is consumed");
    assert!(v.headspace_gas_mol.get("CO2(g)").copied().unwrap_or(0.0) > 1e-4, "combustion products stay in a sealed jar");
}
