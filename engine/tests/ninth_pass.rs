//! Ninth pass: the glass as a second thermal node (T7), the transport properties of a layer for a probe (I6), the heat of
//! vaporisation of a mixture (H1) and the redox candidate list (X3).

use std::collections::HashMap;

use reaction_chamber_engine::gem::discovery::discover_reactions;
use reaction_chamber_engine::vessel::*;

fn beaker(t: f64, glass_g: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: glass_g,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(295.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

fn water(v: &mut Vessel, ml: f64, t: f64) {
    let mut aq = HashMap::new();
    aq.insert("H2O".to_string(), ml * 0.9970 / 18.015);
    v.add_portion(Portion { volume_ml: ml, temperature_k: t, aqueous_mol: aq, organic_mol: HashMap::new(), solid_mol: HashMap::new(), particles: HashMap::new(), forms: HashMap::new() }).unwrap();
}

fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    for _ in 0..(seconds / dt) as usize {
        v.step(dt).unwrap();
    }
}

/// Hot water poured into a cold glass: the contents are hotter than the wall at first, the wall warms through the liquid
/// film over its own time constant (tens of seconds), and the energy the vessel holds (contents + wall) matches what a
/// calorimeter balance with the full glass heat capacity gives. With the old "15 % of the glass" stand-in the wall was never
/// a temperature of its own.
#[test]
fn hot_water_warms_the_glass_wall_through_the_film() {
    let mut v = beaker(295.15, 110.0);
    water(&mut v, 100.0, 295.15);
    water(&mut v, 100.0, 345.15); // 100 g at 295 K already in the beaker, 100 g at 345 K added
    let t_after_dose = v.temperature_k;
    assert!((t_after_dose - 320.15).abs() < 1.0, "the contents mix to their own mean first: {t_after_dose}");
    assert!((v.glass_temp_k - 295.15).abs() < 1e-9, "the wall is still at room temperature: {}", v.glass_temp_k);
    run(&mut v, 90.0, 0.5);
    assert!(v.glass_temp_k > 310.0, "the wall warmed: {}", v.glass_temp_k);
    assert!(v.temperature_k > v.glass_temp_k, "the contents stay hotter than the wall: {} vs {}", v.temperature_k, v.glass_temp_k);
    // calorimeter balance with the whole glass (200 g water at 4.18, 110 g glass at 0.84): the equilibrium of the two nodes
    let t_eq = (200.0 * 4.18 * 320.15 + 110.0 * 0.84 * 295.15) / (200.0 * 4.18 + 110.0 * 0.84);
    assert!(v.temperature_k > t_eq - 1.5 && v.temperature_k < t_after_dose, "contents {} between the full-glass balance {} and the mix {}", v.temperature_k, t_eq, t_after_dose);
}

/// A hot plate heats the glass base; the contents follow through the film, so the wall leads while heating and keeps
/// giving heat to the contents after the plate is switched off.
#[test]
fn the_plate_heats_the_wall_and_the_wall_keeps_heating_after_it() {
    let mut v = beaker(295.15, 110.0);
    water(&mut v, 100.0, 295.15);
    v.set_controls(VesselControls { heater_w: Some(300.0), stirring: Some(false), ..Default::default() });
    run(&mut v, 60.0, 0.5);
    assert!(v.glass_temp_k > v.temperature_k + 1.0, "the wall leads: wall {} contents {}", v.glass_temp_k, v.temperature_k);
    let t_off = v.temperature_k;
    v.set_controls(VesselControls { heater_w: Some(0.0), stirring: Some(false), ..Default::default() });
    run(&mut v, 20.0, 0.5);
    assert!(v.temperature_k > t_off + 0.3, "the wall's heat keeps warming the contents: {} -> {}", t_off, v.temperature_k);
}

/// The energy the vessel holds (contents + wall) changes by exactly what the surroundings supplied.
#[test]
fn the_two_node_vessel_conserves_energy() {
    let mut v = beaker(295.15, 110.0);
    water(&mut v, 100.0, 295.15);
    let mark = v.energy_mark();
    v.set_controls(VesselControls { heater_w: Some(200.0), stirring: Some(true), stir_rpm: Some(300.0), ..Default::default() });
    run(&mut v, 120.0, 0.5);
    let a = v.energy_audit(&mark);
    assert!(a.external_j > 5_000.0, "{}", a.external_j);
    assert!(a.defect_j.abs() < 0.03 * a.external_j + 50.0, "defect {} J of {} J", a.defect_j, a.external_j);
}

/// A vessel with no glass mass is one node (the wall follows the contents).
#[test]
fn a_vessel_without_glass_is_one_node() {
    let mut v = beaker(295.15, 0.0);
    water(&mut v, 100.0, 295.15);
    v.set_controls(VesselControls { heater_w: Some(200.0), stirring: Some(true), stir_rpm: Some(300.0), ..Default::default() });
    run(&mut v, 60.0, 0.5);
    assert!((v.glass_temp_k - v.temperature_k).abs() < 1e-9);
    assert!(v.temperature_k > 296.0);
}

/// A layer carries the transport properties a probe needs: water at 25 C and a hexane layer on top of it.
#[test]
fn layers_carry_viscosity_conductivity_heat_capacity_and_expansivity() {
    let mut v = beaker(298.15, 110.0);
    water(&mut v, 100.0, 298.15);
    let l = &v.snapshot().layers[0];
    assert!((l.viscosity_mpa_s - 0.89).abs() < 0.1, "{}", l.viscosity_mpa_s);
    assert!((l.specific_heat_j_g_k - 4.18).abs() < 0.3, "{}", l.specific_heat_j_g_k);
    assert!((l.thermal_conductivity_w_m_k - 0.607).abs() < 0.03, "{}", l.thermal_conductivity_w_m_k);
    assert!(l.expansivity_per_k > 1e-4 && l.expansivity_per_k < 5e-4, "{}", l.expansivity_per_k);
}

/// The heat of vaporisation of a mixture is the pure latent heat minus the partial excess enthalpy: what the liquid's excess
/// enthalpy changed by when a component left is paid by the contents, to the joule.
#[test]
fn a_vapour_leaving_a_mixture_is_charged_its_excess_enthalpy() {
    let mut v = beaker(298.15, 110.0);
    for (id, ml) in [("water", 50.0), ("ethanol", 40.0)] {
        v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(ml), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
    }
    let t0 = v.temperature_k;
    let he0 = v.excess_enthalpy_at(t0);
    // take some ethanol out as vapour
    let mut taken = 0.0;
    for (k, x) in v.species_mol.iter_mut() {
        if k != "H2O" && *x > 0.2 {
            *x -= 0.1;
            taken += 0.1;
        }
    }
    assert!(taken > 0.0, "ethanol is in the vessel");
    let cp = v.contents_heat_capacity();
    v.book_vapour_excess_enthalpy(he0, t0);
    let he1 = v.excess_enthalpy_at(t0);
    assert!(((t0 - v.temperature_k) * cp - (he1 - he0)).abs() < 1e-6 * cp.max(1.0), "{} K for a change of {} J", t0 - v.temperature_k, he1 - he0);
}

/// X3: the redox candidates of a dilute permanganate / iodide / iron mixture hold no molecular-solid copy of a dissolved
/// reaction (I2(s)), no hopeless pairing (K+ -> K(s)), and the dissolved forms stay.
#[test]
fn redox_candidates_have_no_redundant_solid_copies_or_hopeless_pairings() {
    let mut sp = HashMap::new();
    for (k, x) in [("MnO4-", 1e-4), ("I-", 2e-3), ("K+", 2.1e-3), ("H+", 1e-3), ("SO4-2", 1e-3), ("Fe+2", 2e-3), ("OH-", 1e-7)] {
        sp.insert(k.to_string(), x);
    }
    let r = discover_reactions(&sp, &HashMap::new(), 298.15, 101325.0);
    let names: Vec<&String> = r.iter().flat_map(|x| x.species_names.iter()).collect();
    assert!(!names.iter().any(|n| n.as_str() == "I2(s)"), "no solid copy of the iodine reactions");
    assert!(!names.iter().any(|n| n.as_str() == "K(s)"), "no potassium metal from potassium ion");
    assert!(names.iter().any(|n| n.as_str() == "I2(aq)"), "the dissolved iodine reactions remain");
    assert!(r.len() < 115, "{} candidates (119 before with fewer couples)", r.len());
}
