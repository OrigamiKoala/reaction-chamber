//! Compounds, not "solids" and "liquids": phase is derived from temperature, pressure and contents at run time.
//! Inert compounds (no reaction chemistry) melt, boil and dissolve; ionic salts keep their Ksp path.
//!
//! Updated in Stage 5: a molecule's liquid is the species `X` in a liquid phase (the water-containing phase when there
//! is one, else the neat liquid), its solid `X(s)`, its vapour `X(g)`; the old `X(l)` neat-layer species, the melt plateau
//! code of `vessel_phase.rs`, the 0.1 g/L solubility default and the 500 g/L "miscible" rule are gone. Melting and
//! freezing plateaus, dissolution caps and layers now come from one solid-liquid / liquid-liquid equilibrium, so the tests
//! below assert those outcomes (plateau at the melting point with n * dHfus of latent heat, solubility at its reference
//! temperature, densest layer at the bottom) with the new keys.
use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::compound_thermo::*;
use reaction_chamber_engine::vessel::*;

fn beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-100".into(), capacity_ml: 100.0, glass_mass_g: 50.0, inner_radius_cm: 2.5,
        temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0),
    })
}
fn beaker_at(t: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-100".into(), capacity_ml: 100.0, glass_mass_g: 50.0, inner_radius_cm: 2.5,
        temperature_k: Some(t), room_k: Some(t), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0),
    })
}
/// Holds the vessel at `t` with a bath and lets a dissolving or crystallising solid reach equilibrium there (dissolving a
/// sugar is endothermic: 60 g in 50 mL of water would otherwise cool the solution by ~10 K and lower its saturation).
fn equilibrate_at(v: &mut Vessel, t: f64, seconds: f64) {
    v.set_controls(VesselControls { bath_coupling_w_k: Some(25.0), bath_k: Some(Some(t)), ..Default::default() });
    for _ in 0..(seconds / 0.5) as usize { v.step(0.5).unwrap(); }
}
fn dose_ml(v: &mut Vessel, id: &str, ml: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
}
fn dose_g(v: &mut Vessel, id: &str, g: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: None, mass_g: Some(g), drops: None, temperature_k: None, solid_form: None }).unwrap();
}
fn heater(v: &mut Vessel, w: f64) {
    v.set_controls(VesselControls { heater_w: Some(w), ..Default::default() });
}

/// Imports like the web layer does (model, register reagent + compound record + mineral).
fn import(req: CompoundRequest) -> CompoundModel {
    let m = model_compound(&req);
    assert!(m.modelable, "{}: {}", req.id, m.reason);
    chem_db::register_custom_reagent(m.entry.clone().expect("modelable compounds have an entry"));
    if let Some(c) = &m.compound { chem_db::register_custom_compound(c.clone()); }
    if let Some(min) = &m.mineral { chem_db::register_custom_mineral(min.clone()); }
    m
}

fn naphthalene(id: &str) -> CompoundRequest {
    CompoundRequest {
        id: id.into(), name: "Naphthalene".into(), formula: "C10H8".into(), state: Some("solid".into()), density: Some(1.14),
        t_melt_ref_k: Some(353.35),
        // 0.087 mmHg at 25 C (extrapolated solid range) and the normal boiling point 218 C
        vapor_pressure_points: vec![[298.15, 11.6], [491.15, 101_325.0]],
        solubility_g_per_l: Some(0.031),
        ..Default::default()
    }
}
fn cyclohexane(id: &str) -> CompoundRequest {
    CompoundRequest {
        id: id.into(), name: "Cyclohexane".into(), formula: "C6H12".into(), state: Some("liquid".into()), density: Some(0.774),
        t_melt_ref_k: Some(279.65),
        vapor_pressure_points: vec![[298.15, 13_000.0], [353.85, 101_325.0]],
        dh_vap_kj_mol: Some(29.97),
        solubility_g_per_l: Some(0.055),
        ..Default::default()
    }
}

fn sol(v: &Vessel, k: &str) -> f64 { v.solid_mol.get(k).copied().unwrap_or(0.0) }
/// Moles of a molecule in the primary liquid phase.
fn sp(v: &Vessel, k: &str) -> f64 { v.species_mol.get(k).copied().unwrap_or(0.0) }
/// Moles of a molecule in every liquid phase (primary and immiscible layers).
fn liq(v: &Vessel, k: &str) -> f64 {
    sp(v, k) + v.extra_liquids.iter().map(|m| m.get(k).copied().unwrap_or(0.0)).sum::<f64>()
}
/// Total moles of an inert compound over every place it can be, plus what boiled/vented away.
fn total_mol(v: &Vessel, base: &str, mw: f64) -> f64 {
    sol(v, &format!("{}(s)", base)) + liq(v, base) + v.mass_lost_g / mw
        + v.headspace_gas_mol.get(&format!("{}(g)", base)).copied().unwrap_or(0.0)
}


#[test]
fn naphthalene_melts_with_a_plateau_and_latent_heat() {
    let m = import(naphthalene("cp_naph_a"));
    assert_eq!(m.phase_model, "inert");
    assert_eq!(m.state_at_room, "solid");
    assert!(m.by_mass && m.entry.as_ref().unwrap().by_mass);
    let tm = 353.35;
    let dh_fus = m.thermo.dh_fus_kj_mol.unwrap() * 1000.0; // Walden estimate
    assert!(m.thermo.estimated.contains(&"dh_fus".to_string()));
    assert!((dh_fus - 56.5 * tm).abs() < 1.0);

    let mut v = beaker();
    dose_g(&mut v, "cp_naph_a", 5.0);
    let n_tot = 5.0 / m.mw;
    assert!((sol(&v, "C10H8(s)") - n_tot).abs() < 1e-9, "no liquid or dissolution at room temperature");
    heater(&mut v, 150.0);

    let dt = 0.05;
    let mut plateau_j = 0.0;
    let mut saw_partial = false;
    let mut t_before_melt_ok = true;
    // (the glass wall is a node of its own: it has to be heated too, so the melt takes minutes, not a minute; the heat that goes
    // into the contents is what the surroundings supplied minus what warmed the wall)
    let wall_cp = 50.0 * 0.84;
    for _ in 0..6000 {
        let (ext0, tg0) = (v.external_energy_j, v.glass_temp_k);
        let l0 = liq(&v, "C10H8");
        v.step(dt).unwrap();
        let (s1, l1) = (sol(&v, "C10H8(s)"), liq(&v, "C10H8"));
        if l0 < 1e-12 && l1 < 1e-12 && v.temperature_k > tm + 0.05 { t_before_melt_ok = false; }
        if s1 > 1e-9 && l1 > 1e-9 {
            saw_partial = true;
            plateau_j += (v.external_energy_j - ext0) - wall_cp * (v.glass_temp_k - tg0);
            assert!((v.temperature_k - tm).abs() < 0.2, "T {} off the melting plateau", v.temperature_k);
        }
        if s1 <= 1e-9 && l1 > 1e-9 && v.temperature_k > tm + 3.0 { break; }
    }
    assert!(saw_partial && t_before_melt_ok);
    assert!(sol(&v, "C10H8(s)") < 1e-9, "all melted");
    let expect = n_tot * dh_fus;
    assert!((plateau_j - expect).abs() < 0.10 * expect, "plateau heat {:.0} J vs n*dHfus {:.0} J", plateau_j, expect);

    // the melt is a liquid layer of its own with the liquid's computed density (the import's solid density is 1.14)
    let snap = v.snapshot();
    assert!(snap.solids.is_empty());
    assert_eq!(snap.layers.len(), 1);
    let layer = &snap.layers[0];
    assert_eq!(layer.phase, PhaseKind::Organic);
    assert!(layer.density_g_ml > 0.9 && layer.density_g_ml < 1.14, "own (liquid) density {}", layer.density_g_ml);
    assert!((layer.volume_ml - 5.0 / layer.density_g_ml).abs() < 0.05);
    assert!((total_mol(&v, "C10H8", m.mw) - n_tot).abs() < 1e-9, "inert compound conserves moles");
    // cool it down: the melt freezes on the plateau and a solid reappears (announced in the reaction log)
    heater(&mut v, 0.0);
    v.set_controls(VesselControls { bath_coupling_w_k: Some(25.0), bath_k: Some(Some(280.0)), ..Default::default() });
    let mut froze = false;
    for _ in 0..40000 {
        v.step(0.05).unwrap();
        if sol(&v, "C10H8(s)") > 1e-6 && liq(&v, "C10H8") > 1e-6 { froze = true; assert!((v.temperature_k - tm).abs() < 0.3); }
        if liq(&v, "C10H8") < 1e-9 { break; }
    }
    assert!(froze);
    assert!(v.snapshot().events.iter().any(|e| e.detail.as_deref().map_or(false, |d| d.contains("freezing"))), "{:?}", v.snapshot().events);
    assert!((total_mol(&v, "C10H8", m.mw) - n_tot).abs() < 1e-9);
}


#[test]
fn low_boiling_liquid_boils_off_with_mass_loss_and_gas_flux() {
    let m = import(cyclohexane("cp_chx_b"));
    assert_eq!(m.state_at_room, "liquid");
    assert!(!m.by_mass && m.entry.as_ref().unwrap().form == "liquid");
    let tb = m.thermo.normal_bp_k.expect("derived from the vapour-pressure curve");
    assert!((tb - 353.85).abs() < 0.2, "tb {}", tb);
    let dh_vap = m.thermo.dh_vap_kj_mol.unwrap();
    assert!(dh_vap > 25.0 && dh_vap < 35.0, "{}", dh_vap);

    let mut v = beaker();
    dose_ml(&mut v, "cp_chx_b", 20.0);
    let n_tot = 20.0 * 0.774 / m.mw;
    assert!((sp(&v, "C6H12") - n_tot).abs() < 1e-9);
    // the layer is there right away, lighter than water
    let snap = v.snapshot();
    assert_eq!(snap.layers.len(), 1);
    assert!((snap.layers[0].density_g_ml - 0.774).abs() < 1e-3 && (snap.layers[0].volume_ml - 20.0).abs() < 0.05);
    heater(&mut v, 200.0);
    let dt = 0.05;
    let mut boil_j = 0.0;
    let mut saw_flux = false;
    let mut boil_steps = 0;
    let mut lost_at_start = None;
    let wall_cp = 50.0 * 0.84; // (the glass wall is a node of its own: the heat into the contents is what the surroundings gave minus what warmed the wall)
    for _ in 0..8000 {
        let (ext0, tg0) = (v.external_energy_j, v.glass_temp_k);
        v.step(dt).unwrap();
        if v.gas_fluxes.iter().any(|g| g.species == "C6H12(g)" && g.rate_ml_s > 0.0) {
            saw_flux = true;
            if sp(&v, "C6H12") > 1e-9 {
                assert!((v.temperature_k - tb).abs() < 0.01, "T {} should sit at the boiling point", v.temperature_k);
            }
            lost_at_start.get_or_insert(v.mass_lost_g);
            boil_j += (v.external_energy_j - ext0) - wall_cp * (v.glass_temp_k - tg0);
            boil_steps += 1;
        }
        if sp(&v, "C6H12") < 1e-9 { break; }
    }
    assert!(saw_flux && boil_steps > 100);
    assert!(sp(&v, "C6H12") < 1e-9, "boiled off completely");
    assert!(v.snapshot().events.iter().any(|e| e.detail.as_deref().map_or(false, |d| d.contains("boiling"))));
    assert!(v.snapshot().events.iter().any(|e| e.kind == VesselEventKind::DryOut && e.detail.as_deref().map_or(false, |d| d.contains("boiled off"))));
    assert!((v.mass_lost_g - 20.0 * 0.774).abs() < 0.01, "lost {} g", v.mass_lost_g);
    // energy spent on the plateau is what the latent heat of the boiled amount requires
    let boiled = v.mass_lost_g - lost_at_start.unwrap();
    let expect = boiled / m.mw * dh_vap * 1000.0;
    assert!((boil_j - expect).abs() < 0.15 * expect, "heat {:.0} J vs n*dHvap {:.0} J", boil_j, expect);
    assert!((total_mol(&v, "C6H12", m.mw) - n_tot).abs() < 1e-9);

    // a sealed vessel does not boil off (like water): a hot sealed vessel keeps the liquid above its boiling point
    let mut s = Vessel::new(VesselConfig {
        vessel_type: "flask-100".into(), capacity_ml: 100.0, glass_mass_g: 50.0, inner_radius_cm: 2.5,
        // a stopper that holds (the cyclohexane vapour pressure alone is ~1.2 atm at 360 K, above the default 2.2 atm pop)
        temperature_k: Some(360.0), room_k: Some(295.15), sealed: Some(true), stopper_pop_atm: Some(10.0), burst_atm: Some(20.0),
    });
    s.dose(DoseRequest { reagent_id: "cp_chx_b".into(), volume_ml: Some(20.0), mass_g: None, drops: None, temperature_k: Some(360.0), solid_form: None }).unwrap();
    assert!(s.temperature_k > tb + 1.0);
    for _ in 0..40 { s.step(0.05).unwrap(); }
    // (the only mass that left is the air the 20 mL of liquid pushed out of the stoppered vessel: < 0.05 g)
    assert!(s.sealed && s.mass_lost_g < 0.05 && sp(&s, "C6H12") > 0.1);
    // its vapour is in the headspace (not lost): the pressure is air + x*Psat(T) from the compound's own curve
    // (Stage 4: the closed gas phase holds the air captured at sealing, compressed by the liquid, plus the vapour)
    let curve = s.compounds["C6H12"].vapor_curve.unwrap();
    let n_air: f64 = ["N2(g)", "O2(g)", "Ar(g)"].iter().map(|k| s.headspace_gas_mol.get(*k).copied().unwrap_or(0.0)).sum();
    let p_air_atm = n_air * 8.314462618 * s.temperature_k / ((100.0 - s.total_liquid_volume_ml()) * 1e-6) / 101325.0;
    let expect = p_air_atm + curve.p_pa(s.temperature_k) / 101325.0;
    assert!((s.pressure_atm - expect).abs() < 0.06 * expect, "{} atm vs {}", s.pressure_atm, expect);
    assert!(s.headspace_gas_mol.get("C6H12(g)").copied().unwrap_or(0.0) > 1e-3);
}


#[test]
fn dissolution_is_limited_by_solubility() {
    let g = import(CompoundRequest {
        id: "cp_glucose_c".into(), name: "Glucose".into(), formula: "C6H12O6".into(), state: Some("solid".into()), density: Some(1.54),
        t_melt_ref_k: Some(419.15), solubility_g_per_l: Some(909.0), dh_comb_kj_mol: Some(-2803.0), ..Default::default()
    });
    assert_eq!(g.phase_model, "inert");
    assert!((g.thermo.dhf_kj_mol.unwrap() + 1273.0).abs() < 2.0, "Hess: {:?}", g.thermo.dhf_kj_mol);
    assert!(g.thermo.normal_bp_k.is_none(), "no vapour-pressure data, no boiling point");
    // The supplied solubility is a datum at its reference temperature (25 C); the saturation limit at any other temperature
    // follows from the solid-liquid equilibrium (Stage 5 deleted the temperature-independent cap), so this runs at 25 C.
    let mut v = beaker_at(298.15);
    dose_ml(&mut v, "water", 50.0);
    dose_g(&mut v, "cp_glucose_c", 5.0);
    assert!((sp(&v, "C6H12O6") - 5.0 / g.mw).abs() < 1e-9, "5 g in 50 mL (cap ~45 g) dissolves fully");
    assert!(sol(&v, "C6H12O6(s)") < 1e-12);
    let snap = v.snapshot();
    assert!(snap.solids.is_empty());
    let row = snap.species.iter().find(|r| r.id == "C6H12O6").unwrap();
    assert_eq!(row.phase, "aqueous");
    assert_eq!(row.name, "Glucose");
    // more than the cap stays as solid: 60 g in 50 mL of water. The cap is the saturated solution at the datum: the solute
    // mole fraction of 909 g/L (taken per litre of water, x = 0.0834), whatever the amount of water makes of it.
    dose_g(&mut v, "cp_glucose_c", 60.0);
    assert!(v.temperature_k < 290.0, "dissolving glucose is endothermic: {} K", v.temperature_k);
    equilibrate_at(&mut v, 298.15, 600.0);
    assert!((v.temperature_k - 298.15).abs() < 0.5, "{} K", v.temperature_k);
    let n_w = sp(&v, "H2O");
    let c = 909.0 / g.mw;
    let x_sat = c / (c + 1000.0 * 0.997 / 18.015);
    let cap = x_sat / (1.0 - x_sat) * n_w;
    assert!((sp(&v, "C6H12O6") - cap).abs() < 0.03 * cap, "{} vs cap {}", sp(&v, "C6H12O6"), cap);
    assert!(sol(&v, "C6H12O6(s)") > 0.2 * 65.0 / g.mw);
    assert!(v.snapshot().solids.iter().any(|s| s.species == "C6H12O6(s)" && s.name == "Glucose"));

    let n = import(naphthalene("cp_naph_c"));
    let mut w = beaker();
    dose_ml(&mut w, "water", 50.0);
    dose_g(&mut w, "cp_naph_c", 1.0);
    let total = 1.0 / n.mw;
    let dissolved = sp(&w, "C10H8");
    assert!(dissolved < 0.01 * total, "naphthalene stays mostly solid ({} of {})", dissolved, total);
    assert!(sol(&w, "C10H8(s)") > 0.99 * total);
    assert!((dissolved + sol(&w, "C10H8(s)") - total).abs() < 1e-12);
    // no water: nothing dissolves
    let mut dry = beaker();
    dose_g(&mut dry, "cp_naph_c", 1.0);
    assert!(sp(&dry, "C10H8") < 1e-15);
    // A liquid with a very high measured "solubility" (>= 500 g/L, PubChem's way of saying miscible) is no longer a special
    // case ("the 500 g/L rule" is deleted): its datum is a saturation mole fraction (0.2 here), and 5 mL of it in 50 mL of
    // water stays below that, so it dissolves completely and no layer forms.
    let a = import(CompoundRequest {
        id: "cp_acetone_c".into(), name: "Acetone".into(), formula: "C3H6O".into(), state: Some("liquid".into()), density: Some(0.79),
        t_melt_ref_k: Some(178.5), vapor_pressure_points: vec![[329.35, 101_325.0], [298.15, 30_800.0]], solubility_g_per_l: Some(1000.0),
        ..Default::default()
    });
    let mut x = beaker();
    dose_ml(&mut x, "water", 50.0);
    dose_ml(&mut x, "cp_acetone_c", 5.0);
    assert!((liq(&x, "C3H6O") - 5.0 * 0.79 / a.mw).abs() < 1e-9);
    assert_eq!(x.snapshot().layers.len(), 1);
}


#[test]
fn heavy_neat_liquid_sinks_below_water() {
    let m = import(CompoundRequest {
        id: "cp_dcm_d".into(), name: "Dichloromethane".into(), formula: "CH2Cl2".into(), state: Some("liquid".into()), density: Some(1.33),
        t_melt_ref_k: Some(178.0), vapor_pressure_points: vec![[313.15, 101_325.0], [298.15, 58_000.0]], solubility_g_per_l: Some(13.0),
        color_linear_rgb: Some([0.9, 0.6, 0.3]), ..Default::default()
    });
    let mut v = beaker();
    dose_ml(&mut v, "water", 30.0);
    dose_ml(&mut v, "cp_dcm_d", 10.0);
    let snap = v.snapshot();
    assert_eq!(snap.layers.len(), 2);
    assert!(snap.layers[0].density_g_ml > 1.2 && snap.layers[1].density_g_ml < 1.05, "densest layer first (bottom): {} / {}", snap.layers[0].density_g_ml, snap.layers[1].density_g_ml);
    assert_eq!(snap.layers[0].phase, PhaseKind::Organic);
    assert_eq!(snap.layers[1].phase, PhaseKind::Aqueous);
    // coloured layer: absorbs blue more than red
    let a = &snap.layers[0].absorbance_per_cm;
    assert!(a[3] > a[22] + 0.05, "blue {} vs red {}", a[3], a[22]);
    // dissolved fraction: 13 g/L * 0.03 L
    assert!((sp(&v, "CH2Cl2") - 13.0 * 0.03 / m.mw).abs() < 0.15 * 13.0 * 0.03 / m.mw, "{}", sp(&v, "CH2Cl2"));
    // draining from the bottom takes the denser layer first: the portion carries the densest phase in `organic_mol` (the
    // immiscible phases) and nothing of the water-containing primary phase
    let p = v.remove_liquid_bottom(5.0, false).unwrap();
    assert!(p.organic_mol.get("CH2Cl2").copied().unwrap_or(0.0) > 0.05 && p.aqueous_mol.get("H2O").copied().unwrap_or(0.0) < 1e-3, "{:?} / {:?}", p.aqueous_mol, p.organic_mol);
    let mut w = beaker();
    w.add_portion(p).unwrap();
    assert!(liq(&w, "CH2Cl2") > 0.0);
}

#[test]
fn state_at_room_derivation_table() {
    let st = |tm: Option<f64>, vp: Vec<[f64; 2]>, hint: Option<&str>, formula: &str| -> (String, bool, String) {
        let m = model_compound(&CompoundRequest {
            id: "cp_state".into(), name: "x".into(), formula: formula.into(), t_melt_ref_k: tm, vapor_pressure_points: vp,
            // identity: magnesium is matched on its InChIKey, not on the formula alone
            inchi_key: if formula == "Mg" { Some("FYYHWMGAXLPEAU-UHFFFAOYSA-N".into()) } else { None },
            state: hint.map(|s| s.into()), ..Default::default()
        });
        assert!(m.modelable, "{}", m.reason);
        (m.state_at_room, m.by_mass, m.phase_model)
    };
    // melting reference above 298.15 K -> solid (even against a liquid hint)
    assert_eq!(st(Some(353.35), vec![], None, "C10H8").0, "solid");
    assert_eq!(st(Some(400.0), vec![], Some("liquid"), "C10H8").0, "solid");
    assert_eq!(st(Some(298.16), vec![], None, "C10H8").0, "solid");
    assert_eq!(st(Some(298.15), vec![], None, "C10H8").0, "liquid", "exactly 298.15 K is not above room temperature");
    // curve crossing 1 atm below 298.15 K -> gas
    assert_eq!(st(Some(134.8), vec![[272.65, 101_325.0]], None, "C4H10").0, "gas");
    assert_eq!(st(None, vec![[272.65, 101_325.0]], Some("solid"), "C4H10").0, "gas");
    // liquid: melted and boils above room temperature
    let (s, by_mass, pm) = st(Some(279.65), vec![[353.85, 101_325.0]], None, "C6H12");
    assert_eq!((s.as_str(), by_mass, pm.as_str()), ("liquid", false, "inert"));
    // no melting reference: the hint, else a boiling point above room temperature means liquid
    assert_eq!(st(None, vec![[500.0, 101_325.0]], None, "C8H18").0, "liquid");
    assert_eq!(st(None, vec![[500.0, 101_325.0]], Some("solid"), "C8H18").0, "solid");
    assert_eq!(st(None, vec![], Some("liquid"), "C6H12").0, "liquid");
    assert_eq!(st(None, vec![], Some("gas"), "C2H6").0, "gas");
    // nothing known: inert compounds and ionic salts are solids, acids and known molecules solutions
    assert_eq!(st(None, vec![], None, "C20H42").0, "solid");
    assert_eq!(st(None, vec![], None, "NaCl"), ("solid".into(), true, "ionic".into()));
    assert_eq!(st(None, vec![], None, "HCl"), ("liquid".into(), false, "ionic".into()));
    // known neutral species map onto the engine
    assert_eq!(st(Some(1000.0), vec![], None, "Mg").2, "neutral");
    // only unparseable formulas / unknown elements are unmodelable
    for f in ["C10H8(", "Xx2O", "", "C-H"] {
        let m = model_compound(&CompoundRequest { id: "bad".into(), name: "bad".into(), formula: f.into(), ..Default::default() });
        assert!(!m.modelable && m.entry.is_none() && m.phase_model == "none", "{:?}", f);
    }
}


#[test]
fn inert_compound_is_dose_size_independent() {
    let m = import(CompoundRequest {
        id: "cp_suc_f".into(), name: "Sucrose".into(), formula: "C12H22O11".into(), state: Some("solid".into()), density: Some(1.54),
        t_melt_ref_k: Some(459.15), solubility_g_per_l: Some(100.0), ..Default::default()
    });
    let weigh = |n: usize| {
        let mut v = beaker_at(298.15); // the temperature of the solubility datum
        dose_ml(&mut v, "water", 40.0);
        for _ in 0..n { dose_g(&mut v, "cp_suc_f", 8.0 / n as f64); }
        equilibrate_at(&mut v, 298.15, 300.0);
        v
    };
    let (one, many) = (weigh(1), weigh(250));
    // 8 g in 40 mL at 100 g/L: ~4 g dissolve, the rest stays solid, whether it came in one dose or 250
    assert!((sp(&one, "C12H22O11") - sp(&many, "C12H22O11")).abs() < 1e-6 * sp(&one, "C12H22O11"));
    assert!((sol(&one, "C12H22O11(s)") - sol(&many, "C12H22O11(s)")).abs() < 1e-6);
    for v in [&one, &many] {
        let dissolved_g = sp(v, "C12H22O11") * m.mw;
        assert!((dissolved_g - 4.0).abs() < 0.1, "dissolved {} g", dissolved_g);
        assert!((sp(v, "C12H22O11") + sol(v, "C12H22O11(s)") - 8.0 / m.mw).abs() < 1e-9);
    }
    // neat liquid: one dose or 250 doses give the same layer volume
    let c = import(cyclohexane("cp_chx_f"));
    let pour = |n: usize| {
        let mut v = beaker();
        dose_ml(&mut v, "water", 30.0);
        for _ in 0..n { dose_ml(&mut v, "cp_chx_f", 10.0 / n as f64); }
        v
    };
    let (a, b) = (pour(1), pour(250));
    assert!((liq(&a, "C6H12") - liq(&b, "C6H12")).abs() < 1e-9);
    assert!((a.organic_volume_ml() - b.organic_volume_ml()).abs() < 1e-3, "{} vs {}", a.organic_volume_ml(), b.organic_volume_ml());
    assert!((total_mol(&a, "C6H12", c.mw) - 10.0 * 0.774 / c.mw).abs() < 1e-6);
    // stepping on at room temperature: a liquid with a vapour pressure of 10 kPa evaporates slowly into the room air
    // (Stage 4), booking the loss and cooling the liquid a little; nothing else moves
    let mut s = pour(1);
    for _ in 0..200 { s.step(0.1).unwrap(); }
    let evaporated = liq(&a, "C6H12") - liq(&s, "C6H12");
    assert!(evaporated > 0.0 && evaporated < 0.02 * liq(&a, "C6H12"), "evaporated {} mol", evaporated);
    assert!(s.mass_lost_g >= evaporated * c.mw - 1e-9 && s.mass_lost_g < evaporated * c.mw + 0.05, "{} g lost (cyclohexane {} g + a little water)", s.mass_lost_g, evaporated * c.mw);
    assert!(s.temperature_k < 295.15 && s.temperature_k > 294.5, "{}", s.temperature_k);
    assert!(s.snapshot().conservation.ok);
}

#[test]
fn ionic_salts_take_the_supplied_solubility_through_the_same_ksp_derivation() {
    // a salt the solubility table does not know: a supplied solubility replaces the guessed Ksp
    let m = model_compound(&CompoundRequest {
        id: "cp_rbf".into(), name: "Rubidium fluoride".into(), formula: "FRb".into(), state: Some("solid".into()),
        solubility_g_per_l: Some(100.0), t_melt_ref_k: Some(1068.0), ..Default::default()
    });
    assert!(m.modelable);
    assert_eq!((m.phase_model.as_str(), m.state_at_room.as_str(), m.by_mass), ("ionic", "solid", true));
    let min = m.mineral.as_ref().expect("solid record");
    let s: f64 = 100.0 / 104.47;
    assert!((min.log_ksp_298 - 2.0 * s.log10()).abs() < 0.01, "log Ksp {}", min.log_ksp_298);
    assert_eq!(min.tier, reaction_chamber_engine::types::ProvenanceTier::Imported);
    // the thermo record is stored anyway (molten salts are not modelled, the melting reference is just recorded)
    let c = m.compound.as_ref().unwrap();
    assert_eq!(c.phase_model, "ionic");
    assert_eq!(m.thermo.normal_mp_k, Some(1068.0));
    // a tabulated Ksp wins over a supplied solubility
    let agcl = model_compound(&CompoundRequest {
        id: "cp_agcl".into(), name: "Silver chloride".into(), formula: "AgCl".into(), state: Some("solid".into()),
        solubility_g_per_l: Some(50.0), ..Default::default()
    });
    let min = agcl.mineral.unwrap();
    assert_eq!(min.tier, reaction_chamber_engine::types::ProvenanceTier::Tabulated);
    assert!(min.log_ksp_298 < -9.0);
}

#[test]
fn web_shaped_request_round_trips() {
    // exactly what the web layer sends (old fields from an earlier contract are ignored)
    let json = r#"{
        "id": "web_naph", "name": "Naphthalene", "formula": "C10H8", "smiles": "C1=CC=C2C=CC=CC2=C1", "mw": 128.17,
        "density": 1.14, "state": "solid", "molarity": null, "ghs": ["GHS07"],
        "vapor_pressure_points": [[298.15, 11.6], [353.15, 1000.0], [491.15, 101325]],
        "dh_vap_kj_mol": 43.2, "dh_vap_at_k": 491.15, "t_melt_ref_k": 353.35, "dh_fus_kj_mol": 19.0, "dh_comb_kj_mol": -5156.3,
        "solubility_g_per_l": 0.031, "color_linear_rgb": [0.9, 0.9, 0.9],
        "s_j_mol_k": 167.4, "cp_j_mol_k": 165.7, "cp_coefficients": [1.0, 2.0],
        "mp_c": 80.2, "bp_c": 218, "density_liquid": 0.98
    }"#;
    let req: CompoundRequest = serde_json::from_str(json).expect("unknown fields are ignored");
    assert_eq!(req.vapor_pressure_points.len(), 3);
    let m = model_compound(&req);
    assert!(m.modelable && m.entry.is_some());
    let out = serde_json::to_value(&m).unwrap();
    assert_eq!(out["state_at_room"], "solid");
    assert_eq!(out["phase_model"], "inert");
    assert_eq!(out["modelable"], true);
    assert_eq!(out["by_mass"], true);
    assert_eq!(out["entry"]["by_mass"], true);
    assert_eq!(out["entry"]["composition"]["C10H8(s)"].as_f64().map(|x| (x * 128.17 - 1.0).abs() < 0.01), Some(true));
    let t = &out["thermo"];
    assert!((t["normal_bp_k"].as_f64().unwrap() - 491.15).abs() < 8.0, "regression through all points: {}", t);
    assert_eq!(t["normal_mp_k"].as_f64(), Some(353.35));
    assert_eq!(t["dh_fus_kj_mol"].as_f64(), Some(19.0));
    assert!(t["dh_vap_kj_mol"].as_f64().unwrap() > 30.0);
    assert!(t["dhf_kj_mol"].is_number());
    assert_eq!(t["estimated"], serde_json::json!([]), "both latent heats were supplied");
    // heat of combustion -> enthalpy of formation: naphthalene +77 kJ/mol
    assert!((t["dhf_kj_mol"].as_f64().unwrap() - 77.0).abs() < 5.0, "{}", t["dhf_kj_mol"]);
    // the supplied molar heat capacity sets the specific heat; the other fields are stored
    let c = m.compound.unwrap();
    assert!((c.cp_j_g_k - 165.7 / 128.17).abs() < 0.01 && !c.is_estimated("cp_j_g_k"));
    assert_eq!(c.s_j_mol_k, Some(167.4));
    assert_eq!(c.cp_coefficients, vec![1.0, 2.0]);

    // a request with nothing but the required fields still works (all new fields are optional)
    let min: CompoundRequest = serde_json::from_str(r#"{"id":"m","name":"m","formula":"C2H6O2"}"#).unwrap();
    let m = model_compound(&min);
    assert!(m.modelable && m.phase_model == "inert" && m.state_at_room == "solid");
    let out = serde_json::to_value(&m).unwrap();
    assert!(out["thermo"].get("normal_bp_k").is_none() && out["thermo"]["estimated"].is_array());
}

#[test]
fn pressure_shifts_the_phase_boundaries() {
    let m = model_compound(&naphthalene("cp_naph_p"));
    let c = m.compound.unwrap();
    let tm1 = c.melt_k(1.0).unwrap();
    assert!((tm1 - 353.35).abs() < 1e-9);
    let tm10 = c.melt_k(10.0).unwrap();
    assert!(tm10 > tm1 && tm10 - tm1 < 1.0, "Clapeyron shift {}", tm10 - tm1);
    let tb1 = c.boil_k(P_ATM_PA).unwrap();
    let tb2 = c.boil_k(2.0 * P_ATM_PA).unwrap();
    assert!(tb2 > tb1 + 10.0);
    assert_eq!(c.neat_phase(300.0, 1.0), NeatPhase::Solid);
    assert_eq!(c.neat_phase(400.0, 1.0), NeatPhase::Liquid);
    assert_eq!(c.neat_phase(tb1 + 1.0, 1.0), NeatPhase::Gas);
    assert_eq!(c.neat_phase(tb1 + 1.0, 2.0), NeatPhase::Liquid);
}
