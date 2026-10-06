//! Gates for ALGORITHM-IMPROVEMENT.md section 7 (the engine side of the visual layer's requests W1-W9): what a solid is
//! (monolith / pieces / bed) and in which form it was dosed, electrode deposits that obey Faraday's law, a hot plate with a
//! surface limit, a bath with mass and ice, floc size, the colour of collected gas, electrode material appearance.

use reaction_chamber_engine::transfer::electrochem::SupplyMode;
use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::vessel_electro::{electrode_materials, ElectrodeSpec, ElectrolysisSpec};

fn vessel(kind: &str, capacity: f64, radius: f64, t: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: kind.into(),
        capacity_ml: capacity,
        glass_mass_g: 110.0,
        inner_radius_cm: radius,
        temperature_k: Some(t),
        room_k: Some(295.15),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}

fn beaker(t: f64) -> Vessel {
    vessel("beaker-250", 250.0, 3.5, t)
}

fn dose(v: &mut Vessel, id: &str, volume: Option<f64>, mass: Option<f64>, form: Option<&str>) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: volume, mass_g: mass, drops: None, temperature_k: None, solid_form: form.map(|s| s.to_string()) }).unwrap();
}

/// W1: water that freezes in the beaker is a monolith with no suspended fraction; ice that was added is pieces.
#[test]
fn frozen_liquid_is_cast_to_the_vessel() {
    let mut v = beaker(255.0);
    dose(&mut v, "water", Some(50.0), None, None);
    v.temperature_k = 255.0;
    for _ in 0..20 {
        v.step(0.5).unwrap();
    }
    let snap = v.snapshot();
    let ice = snap.solids.iter().find(|s| s.species == "H2O(s)").expect("water froze");
    assert_eq!(ice.morphology, "monolith", "ice that froze in the beaker is cast to it");
    assert_eq!(ice.suspended_fraction, 0.0);
    assert_eq!(ice.suspended_diameter_um, 0.0);
    // ice put in by hand is loose pieces
    let mut w = beaker(295.15);
    dose(&mut w, "water", Some(100.0), None, None);
    w.solid_mol.insert("H2O(s)".into(), 10.0 / 18.015);
    let s = w.snapshot();
    assert_eq!(s.solids.iter().find(|x| x.species == "H2O(s)").unwrap().morphology, "pieces");
}

/// W2: a magnesium ribbon is dosed as a piece (catalog form): loose pieces, never suspended, not a bed, in a dry vessel too;
/// the same reagent dosed as powder is a bed; the piece still reacts, more slowly than the powder.
#[test]
fn dosed_form_sets_the_morphology_and_the_rate() {
    let mut dry = beaker(295.15);
    dose(&mut dry, "mg_ribbon", None, Some(0.3), None);
    let mg = dry.snapshot().solids.into_iter().find(|s| s.species == "Mg(s)").unwrap();
    assert_eq!(mg.morphology, "pieces");
    assert_eq!(mg.suspended_fraction, 0.0, "no liquid: nothing is suspended");
    assert!((mg.particle_diameter_um - 300.0).abs() < 1.0, "ribbon thickness: {}", mg.particle_diameter_um);
    let mut powder = beaker(295.15);
    dose(&mut powder, "mg_ribbon", None, Some(0.3), Some("powder"));
    let mp = powder.snapshot().solids.into_iter().find(|s| s.species == "Mg(s)").unwrap();
    assert_eq!(mp.morphology, "bed");
    assert!(mp.particle_diameter_um < 100.0);
    let rate = |form: Option<&str>| -> f64 {
        let mut v = beaker(295.15);
        dose(&mut v, "hcl_1m", Some(50.0), None, None);
        dose(&mut v, "mg_ribbon", None, Some(0.1), form);
        let m0 = v.solid_mol.get("Mg(s)").copied().unwrap_or(0.0);
        for _ in 0..20 {
            v.step(0.5).unwrap();
        }
        m0 - v.solid_mol.get("Mg(s)").copied().unwrap_or(0.0)
    };
    let (piece, powder) = (rate(None), rate(Some("powder")));
    assert!(piece > 0.0 && powder > 1.5 * piece, "powder {:e} mol vs piece {:e} mol in 10 s", powder, piece);
    // a piece in a liquid stays a piece
    let mut wet = beaker(295.15);
    dose(&mut wet, "water", Some(100.0), None, None);
    dose(&mut wet, "mg_ribbon", None, Some(0.3), None);
    let mw = wet.snapshot().solids.into_iter().find(|s| s.species == "Mg(s)").unwrap();
    assert_eq!((mw.morphology.as_str(), mw.suspended_fraction), ("pieces", 0.0));
}

/// W3: copper electrodes in copper sulfate: the anode loses and the cathode gains what Faraday's law says of the charge that
/// passed (within the share the cathode spends on other channels), no sulfide solid forms, the snapshot carries the
/// electrode's density and area.
#[test]
fn electrode_mass_obeys_faradays_law() {
    let mut v = beaker(295.15);
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    v.species_mol.insert("Cu+2".into(), 0.01);
    v.species_mol.insert("SO4-2".into(), 0.01);
    v.set_electrolysis(Some(ElectrolysisSpec {
        anode: ElectrodeSpec { material: "Cu".into(), area_cm2: 5.0 },
        cathode: ElectrodeSpec { material: "Cu".into(), area_cm2: 5.0 },
        supply: SupplyMode::Voltage(4.0),
        spacing_cm: 2.0,
        on: true,
    }));
    for _ in 0..300 {
        v.step(0.5).unwrap();
    }
    let snap = v.snapshot();
    let charge = snap.electrolysis.as_ref().unwrap().charge_c;
    assert!(charge > 5.0, "charge {}", charge);
    let faraday_g = charge / 96485.0 / 2.0 * 63.546;
    let (anode, cathode) = (&snap.electrodes[0], &snap.electrodes[1]);
    assert!(anode.mass_change_g < 0.0 && (anode.mass_change_g.abs() / faraday_g - 1.0).abs() < 0.1, "anode {:e} g vs Faraday {:e} g", anode.mass_change_g, faraday_g);
    assert!(cathode.mass_change_g > 0.7 * faraday_g && cathode.mass_change_g <= 1.02 * faraday_g, "cathode {:e} g vs Faraday {:e} g", cathode.mass_change_g, faraday_g);
    assert_eq!(cathode.deposit.as_ref().map(|d| d.species.as_str()), Some("Cu(s)"));
    assert!((cathode.density_g_ml - 8.96).abs() < 0.3 && cathode.area_cm2 == 5.0, "density {}", cathode.density_g_ml);
    for s in &snap.solids {
        assert!(!s.species.contains('S') || s.species.starts_with("Cu(OH)") || s.species == "Cu(s)", "no sulfide in a sulfate cell: {}", s.species);
    }
    // a platinum cathode plates the copper that passed on it, the anode of platinum gains nothing
    let mut p = beaker(295.15);
    p.species_mol.insert("H2O".into(), 100.0 / 18.015);
    p.species_mol.insert("Cu+2".into(), 0.01);
    p.species_mol.insert("SO4-2".into(), 0.01);
    p.set_electrolysis(Some(ElectrolysisSpec {
        anode: ElectrodeSpec { material: "Pt".into(), area_cm2: 5.0 },
        cathode: ElectrodeSpec { material: "Pt".into(), area_cm2: 5.0 },
        supply: SupplyMode::Voltage(4.0),
        spacing_cm: 2.0,
        on: true,
    }));
    for _ in 0..300 {
        p.step(0.5).unwrap();
    }
    let ps = p.snapshot();
    // (the anode of platinum plates no metal; a microgram of copper(II) oxide from copper(I) that the cathode made and the anode
    // oxidised is booked with it since the eighth pass: before, those atoms left the vessel unaccounted)
    assert!(ps.electrodes[0].mass_change_g.abs() < 0.01 * ps.electrodes[1].mass_change_g, "the platinum anode gains next to nothing: {:e} g against {:e} g on the cathode", ps.electrodes[0].mass_change_g, ps.electrodes[1].mass_change_g);
    assert!(ps.electrodes[0].deposit.as_ref().map_or(true, |d| d.species != "Cu(s)"), "no copper plates on the anode");
    assert!(ps.electrodes[1].mass_change_g > 0.0 && ps.electrodes[1].deposit.is_some());
}

/// W4: a hot plate passes on what its surface limit allows: an empty beaker on a 600 W plate does not run away to 1300 K.
#[test]
fn hot_plate_cannot_exceed_its_surface_temperature() {
    let mut v = beaker(295.15);
    dose(&mut v, "ethanol", Some(30.0), None, None);
    v.set_controls(VesselControls { heater_w: Some(600.0), ..Default::default() });
    let mut t_max: f64 = 0.0;
    for _ in 0..1200 {
        v.step(0.5).unwrap();
        t_max = t_max.max(v.temperature_k);
    }
    assert!(v.species_mol.get("C2H5OH").copied().unwrap_or(0.0) < 1e-3, "the ethanol boiled off");
    assert!(t_max < 640.0, "dry beaker reached {} K", t_max);
    assert!(v.temperature_k > 450.0, "it still gets hot: {}", v.temperature_k);
}

/// W5: an ice bath holds 273.15 K while ice is left, melts, and then warms; a hot bath cools; the snapshot carries it.
#[test]
fn a_bath_is_a_finite_object() {
    let mut v = beaker(330.0);
    dose(&mut v, "water", Some(100.0), None, None);
    v.temperature_k = 330.0;
    v.set_controls(VesselControls { bath: Some(Some(reaction_chamber_engine::bath::BathSpec { temperature_k: 273.15, mass_g: 400.0, ice_fraction: 0.3, melt_k: None })), ..Default::default() });
    let mut min_ice: f64 = 1.0;
    for _ in 0..1200 {
        v.step(1.0).unwrap();
        let b = v.snapshot().bath.expect("bath in the snapshot");
        if b.ice_fraction > 0.0 {
            assert!((b.temperature_k - 273.15).abs() < 1e-6, "plateau");
        }
        min_ice = min_ice.min(b.ice_fraction);
    }
    let b = v.snapshot().bath.unwrap();
    assert!(min_ice < 0.3, "ice melted: {}", min_ice);
    assert!(v.temperature_k < 300.0, "the vessel cooled: {}", v.temperature_k);
    // an infinite reservoir stays as it was
    let mut r = beaker(330.0);
    dose(&mut r, "water", Some(100.0), None, None);
    r.set_controls(VesselControls { bath_k: Some(Some(273.15)), ..Default::default() });
    for _ in 0..1200 {
        r.step(1.0).unwrap();
    }
    assert!(r.snapshot().bath.is_none() && r.snapshot().bath_k == Some(273.15));
    let _ = b;
    // a small hot bath cools toward the room
    let mut h = beaker(295.15);
    dose(&mut h, "water", Some(50.0), None, None);
    h.set_controls(VesselControls { bath: Some(Some(reaction_chamber_engine::bath::BathSpec { temperature_k: 340.0, mass_g: 500.0, ice_fraction: 0.0, melt_k: None })), ..Default::default() });
    for _ in 0..1800 {
        h.step(1.0).unwrap();
    }
    let hb = h.snapshot().bath.unwrap();
    assert!(hb.temperature_k < 335.0 && hb.temperature_k > h.room_k, "hot bath after 30 min: {}", hb.temperature_k);
}

/// W6: a hydroxide sol is nanometre particles; salted, the particles settle as micrometre flocs.
#[test]
fn floc_size_follows_the_electrolyte() {
    let floc = |extra_salt: f64| -> (f64, f64) {
        let mut v = beaker(295.15);
        v.species_mol.insert("H2O".into(), 100.0 / 18.015);
        v.species_mol.insert("Cu+2".into(), 0.01);
        v.species_mol.insert("SO4-2".into(), 0.01 + extra_salt);
        v.species_mol.insert("Na+".into(), 0.03 + 2.0 * extra_salt);
        v.species_mol.insert("OH-".into(), 0.03);
        for _ in 0..100 {
            v.step(0.5).unwrap();
        }
        let s = v.snapshot().solids.into_iter().find(|s| s.species == "Cu(OH)2(s)").expect("Cu(OH)2");
        (s.particle_diameter_um, s.floc_diameter_um)
    };
    let (d, f) = floc(0.0);
    assert!(d > 0.0 && f >= d, "{} {}", d, f);
    let (d2, f2) = floc(0.05);
    assert!(f2 > 20.0 * d2, "salted sol: primary {} um, floc {} um", d2, f2);
}

/// W7: in a two-layer vessel every solid says which layer it rests on or rides.
#[test]
fn solids_in_layered_vessels_have_a_layer() {
    let mut v = beaker(295.15);
    dose(&mut v, "water", Some(60.0), None, None);
    v.species_mol.insert("hexane".into(), 0.3);
    v.solid_mol.insert("MnO2(s)".into(), 0.01);
    let snap = v.snapshot();
    for s in &snap.solids {
        assert!(s.layer_index.is_some(), "{} has no layer", s.species);
    }
}

/// W8: the electrode console's materials come with the metal's colour and density.
#[test]
fn electrode_materials_carry_colour_and_density() {
    let mats = electrode_materials();
    let cu = mats.iter().find(|m| m.symbol == "Cu").expect("copper");
    assert!(cu.rgb.is_some());
    assert!((cu.density_g_ml.unwrap() - 8.96).abs() < 0.3);
    assert!(mats.iter().all(|m| m.rgb.is_some()));
}

/// W9: a collector holding chlorine shows it yellow-green, one holding hydrogen shows nothing.
#[test]
fn collected_gas_has_a_colour() {
    let mut v = vessel("gas-syringe-100", 100.0, 1.2, 295.15);
    v.gas.collected_mol.insert("Cl2(g)".into(), 2.0e-3);
    v.gas.collected_mol.insert("H2(g)".into(), 1.0e-4);
    let info = v.snapshot().gas;
    let cl2 = info.species.iter().find(|g| g.species == "Cl2(g)").unwrap();
    let h2 = info.species.iter().find(|g| g.species == "H2(g)").unwrap();
    let rgb = cl2.rgb.expect("chlorine is coloured");
    assert!(rgb[2] < rgb[0] && rgb[2] < rgb[1], "yellow-green: {:?}", rgb);
    assert!(h2.rgb.is_none() && h2.opacity == 0.0);
}
