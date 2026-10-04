//! Stage 10 gates (docs/plans/generalization-master-plan.md section 8, Stage 10): appearance from optical records.
//! Every test drives the real `Vessel` path: contents -> snapshot (layers, solids, fumes, flame) and the UV-vis scan.

use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::optics::{self, cie, N_BINS};
use reaction_chamber_engine::vessel::*;
use reaction_chamber_engine::vessel_ext::layer_colour_at;

fn vessel_at(t: f64, capacity: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: capacity,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(false),
        stopper_pop_atm: Some(2.2),
        burst_atm: Some(6.0),
    })
}
fn beaker() -> Vessel {
    vessel_at(295.15, 250.0)
}
fn ml(v: &mut Vessel, id: &str, x: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(x), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
}
fn grams(v: &mut Vessel, id: &str, x: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: None, mass_g: Some(x), drops: None, temperature_k: None, solid_form: None }).unwrap();
}
fn run(v: &mut Vessel, seconds: f64, dt: f64) {
    for _ in 0..((seconds / dt).round() as usize) {
        v.step(dt).unwrap();
    }
}
fn import(req: CompoundRequest) -> CompoundModel {
    let m = model_compound(&req);
    assert!(m.modelable, "{}: {}", req.id, m.reason);
    chem_db::register_custom_reagent(m.entry.clone().expect("entry"));
    if let Some(c) = &m.compound {
        chem_db::register_custom_compound(c.clone());
    }
    if let Some(min) = &m.mineral {
        chem_db::register_custom_mineral(min.clone());
    }
    m
}
fn salt(id: &str, name: &str, formula: &str) -> CompoundRequest {
    CompoundRequest { id: id.into(), name: name.into(), formula: formula.into(), state: Some("solid".into()), density: Some(2.0), solubility_g_per_l: Some(300.0), ..Default::default() }
}
fn peak(a: &[f64]) -> (f64, f64) {
    let mut best = (0.0, 0.0);
    for (i, v) in a.iter().enumerate() {
        if *v > best.0 {
            best = (*v, cie::bin_nm(i));
        }
    }
    best
}
/// sRGB display colour of a layer's absorption over `path` (no turbidity).
fn colour(layer: &LiquidLayer, path: f64) -> [f64; 3] {
    let lin = cie::transmitted_linear_rgb(&layer.absorbance_per_cm, path);
    [cie::to_srgb(lin[0]), cie::to_srgb(lin[1]), cie::to_srgb(lin[2])]
}
fn chroma(c: [f64; 3]) -> f64 {
    c.iter().cloned().fold(0.0, f64::max) - c.iter().cloned().fold(1.0, f64::min)
}
fn aqueous(v: &Vessel) -> LiquidLayer {
    v.snapshot().layers.into_iter().find(|l| l.phase == PhaseKind::Aqueous).expect("aqueous layer")
}

#[test]
fn s10_1_methylene_blue_absorbs_strongly_near_660_nm() {
    // a PubChem-style UV text row: lambda_max 664 nm, log eps 4.98 in water
    let req = CompoundRequest {
        id: "s10_mb".into(),
        name: "Methylene blue".into(),
        formula: "C16H18ClN3S".into(),
        smiles: Some("CN(C)c1ccc2nc3ccc(cc3[s+]c2c1)N(C)C.[Cl-]".into()),
        state: Some("solid".into()),
        density: Some(1.0),
        solubility_g_per_l: Some(43.6),
        uv_bands: vec![(664.0, 95_500.0, None, Some("water".into()))],
        ..Default::default()
    };
    import(req);
    let mut v = beaker();
    ml(&mut v, "water", 50.0);
    grams(&mut v, "s10_mb", 0.010);
    run(&mut v, 20.0, 0.5);
    let l = aqueous(&v);
    let (a, nm) = peak(&l.absorbance_per_cm);
    println!("[s10_1] A_max {a:.1} /cm at {nm} nm, colour {:?}, tier {:?} {:?}", colour(&l, 1.0), l.colour_tier, l.colour_sources);
    assert!(a > 1.0, "A_max {a}");
    assert!((nm - 660.0).abs() <= 15.0, "peak at {nm}");
    assert_eq!(l.colour_tier, reaction_chamber_engine::types::ProvenanceTier::Imported);
    // the scan the spectrophotometer reads agrees with the layer's colour data
    let scan = v.uvvis_scan(0, 350.0, 750.0, 5.0, 1.0);
    let top = scan.points.iter().cloned().fold(scan.points[0].clone(), |b, p| if p.a_species > b.a_species { p } else { b });
    assert!((top.nm - 665.0).abs() <= 10.0 && top.a_species > 1.0, "{top:?}");
    assert_eq!(scan.contributors[0].species.contains("C16"), true, "{:?}", scan.contributors);
}

#[test]
fn s10_2_transition_metal_solutions_are_coloured() {
    // (id, formula, check on the display colour at 5 cm)
    import(salt("s10_nicl2", "Nickel chloride", "Cl2Ni"));
    import(salt("s10_crcl3", "Chromium chloride", "Cl3Cr"));
    import(salt("s10_ferri", "Potassium ferricyanide", "C6FeK3N6"));
    import(salt("s10_voso4", "Vanadyl sulfate", "O5SV"));
    import(salt("s10_nacl", "Sodium chloride", "ClNa"));
    let mut results = Vec::new();
    for id in ["s10_nicl2", "s10_crcl3", "s10_ferri", "s10_voso4", "s10_nacl"] {
        let mut v = beaker();
        ml(&mut v, "water", 50.0);
        grams(&mut v, id, 0.25);
        run(&mut v, 20.0, 0.5);
        let l = aqueous(&v);
        let c = colour(&l, 3.0);
        println!("[s10_2] {id}: display colour {:.2} {:.2} {:.2}, A_max {:.3}, {:?}", c[0], c[1], c[2], peak(&l.absorbance_per_cm).0, l.colour_sources);
        results.push((id, c, l));
    }
    let get = |id: &str| results.iter().find(|r| r.0 == id).unwrap();
    // Ni2+ green: green dominates; Fe(CN)6 3- yellow: blue is absorbed; VO2+ blue: red is absorbed; Cr3+ coloured
    let ni = get("s10_nicl2").1;
    assert!(ni[1] > ni[0] + 0.4 && ni[1] > 0.9 * ni[2] && chroma(ni) > 0.3, "Ni2+ should be green (blue-green): {ni:?}");
    let cr = get("s10_crcl3").1;
    assert!(chroma(cr) > 0.05, "Cr3+ should be coloured: {cr:?}");
    let fe = get("s10_ferri").1;
    assert!(fe[2] < fe[0] && fe[2] < fe[1] && chroma(fe) > 0.2, "ferricyanide should be yellow: {fe:?}");
    let vo = get("s10_voso4").1;
    assert!(vo[2] > vo[0] && chroma(vo) > 0.05, "VO2+ should be blue: {vo:?}");
    let na = get("s10_nacl").1;
    assert!(chroma(na) < 0.02, "NaCl stays colourless: {na:?}");
    // the estimated ones say so
    assert_ne!(get("s10_nicl2").2.colour_tier, reaction_chamber_engine::types::ProvenanceTier::Tabulated);
}

#[test]
fn s10_3_iodine_is_brown_in_water_and_violet_in_alkanes() {
    import(CompoundRequest {
        id: "s10_hexane".into(), name: "Hexane".into(), formula: "C6H14".into(), smiles: Some("CCCCCC".into()),
        inchi_key: Some("VLKZOEOYAKHREP-UHFFFAOYSA-N".into()), state: Some("liquid".into()), density: Some(0.659),
        t_melt_ref_k: Some(177.83), vapor_pressure_points: vec![[341.88, 101_325.0]], ..Default::default()
    });
    import(CompoundRequest {
        id: "s10_iodine".into(), name: "Iodine".into(), formula: "I2".into(), smiles: Some("II".into()),
        inchi_key: Some("PNDPGZBMCMUPRI-UHFFFAOYSA-N".into()), state: Some("solid".into()), density: Some(4.93), ..Default::default()
    });
    let mut v = vessel_at(298.15, 250.0);
    ml(&mut v, "water", 50.0);
    ml(&mut v, "s10_hexane", 50.0);
    grams(&mut v, "s10_iodine", 0.05);
    run(&mut v, 5.0, 0.1);
    let snap = v.snapshot();
    assert_eq!(snap.layers.len(), 2);
    let hex = snap.layers.iter().find(|l| l.solvent_class == "alkane").expect("hexane layer");
    let wat = snap.layers.iter().find(|l| l.solvent_class == "water").expect("water layer");
    let (ah, nh) = peak(&hex.absorbance_per_cm);
    let (aw, nw) = peak(&wat.absorbance_per_cm);
    println!("[s10_3] hexane layer peak {ah:.3} at {nh} nm; water layer peak {aw:.4} at {nw} nm; hexane colour {:?}", colour(hex, 3.0));
    assert!((nh - 520.0).abs() <= 15.0, "alkane peak {nh}");
    assert!(ah > 0.05);
    assert!((nw - 460.0).abs() <= 15.0 || aw < 1e-6, "water peak {nw}");
    // violet: more blue and red than green at 3 cm
    let c = colour(hex, 3.0);
    assert!(c[1] < c[0] && c[1] < c[2], "iodine in hexane should be violet: {c:?}");
}

#[test]
fn s10_4_solids_get_their_colour_from_band_gap_chromophores_and_mixed_valence() {
    // Prussian blue from Fe3+ + hexacyanoferrate(II); the other solids of the same bench: one law, no per-compound rule
    import(salt("s10_fecl3", "Iron chloride", "Cl3Fe"));
    import(salt("s10_k4fecn6", "Potassium ferrocyanide", "C6FeK4N6"));
    let mut v = beaker();
    ml(&mut v, "water", 40.0);
    grams(&mut v, "s10_fecl3", 1.0);
    grams(&mut v, "s10_k4fecn6", 1.5);
    run(&mut v, 60.0, 0.5);
    let snap = v.snapshot();
    let pb = snap.solids.iter().find(|s| s.species.contains("FeC6N6")).expect("Prussian blue solid");
    let srgb = pb.rgb.map(cie::to_srgb);
    println!("[s10_4] Prussian blue {} srgb {:.2} {:.2} {:.2}", pb.species, srgb[0], srgb[1], srgb[2]);
    for e in &snap.events {
        println!("[s10_4] event: {:?}", e.detail);
    }
    let fe3 = snap.species.iter().find(|r| r.id == "Fe+3").map(|r| r.name.clone());
    println!("[s10_4] Fe+3 is shown as {:?}", fe3);
    assert!(pb.rgb[2] > 1.8 * pb.rgb[0] && pb.rgb[2] > pb.rgb[1], "blue: {:?}", pb.rgb);
}

#[test]
fn s10_5_turbidity_is_spectral_and_tinted_by_the_solid() {
    let mut v = beaker();
    ml(&mut v, "water", 30.0);
    ml(&mut v, "agno3_0_1m", 10.0);
    ml(&mut v, "nacl_0_1m", 10.0);
    run(&mut v, 2.0, 0.1);
    let l = aqueous(&v);
    assert_eq!(l.scatter_per_cm.len(), N_BINS);
    assert!(l.scatter_per_cm.iter().all(|e| *e >= 0.0) && l.scatter_per_cm[20] > 0.0, "AgCl makes the liquid turbid");
    // a fine curd: blue scatters more than red (Rayleigh / Mie regime)
    assert!(l.scatter_per_cm[2] > l.scatter_per_cm[N_BINS - 3], "{} vs {}", l.scatter_per_cm[2], l.scatter_per_cm[N_BINS - 3]);
    assert!(l.refractive_index > 1.3 && l.refractive_index < 1.4, "n {}", l.refractive_index);
    let c = layer_colour_at(&l.absorbance_per_cm, &l.scatter_per_cm, &l.scatter_albedo, 3.0);
    assert!(c.iter().all(|x| *x >= 0.0));
}

#[test]
fn s10_6_coloured_gases_are_visible_above_open_vessels_and_clear_gases_are_not() {
    let mut v = beaker();
    ml(&mut v, "water", 50.0);
    for _ in 0..20 {
        v.gas_fluxes.push(GasFlux { species: "NO2(g)".into(), rate_ml_s: 30.0, bubble_diameter_mm: 2.0, nucleation: "bulk".into(), origin: None });
        v.gas_fluxes.push(GasFlux { species: "Br2(g)".into(), rate_ml_s: 30.0, bubble_diameter_mm: 2.0, nucleation: "bulk".into(), origin: None });
        v.gas_fluxes.push(GasFlux { species: "O2(g)".into(), rate_ml_s: 30.0, bubble_diameter_mm: 2.0, nucleation: "bulk".into(), origin: None });
        v.step_plume(0.5);
    }
    let f = v.snapshot().fumes;
    for id in ["NO2(g)", "Br2(g)"] {
        let x = f.iter().find(|x| x.species == id).unwrap_or_else(|| panic!("{id} must be visible above an open vessel: {f:?}"));
        assert!(x.rgb[0] > x.rgb[2], "{id} transmits red, absorbs blue: {:?}", x.rgb);
        assert!(x.denser_than_air, "{id} sinks (derived from its molar mass)");
    }
    assert!(f.iter().all(|x| x.species != "O2(g)"));
    // heavy gas lingers (tens of seconds), hydrogen would not
    let mut a = v.plume_mol.get("NO2(g)").copied().unwrap_or(0.0);
    for _ in 0..4 {
        v.step_plume(0.5);
    }
    let b = v.plume_mol.get("NO2(g)").copied().unwrap_or(0.0);
    assert!(b > 0.9 * a, "a heavy plume stays pooled: {a} -> {b}");
    a = b;
    let _ = a;
}

#[test]
fn s10_7_no_steam_from_a_dry_beaker_and_ethanol_shows_boiling_at_its_bubble_point() {
    let mut dry = beaker();
    dry.temperature_k = 520.0;
    let s = dry.snapshot();
    assert_eq!((s.vapour_visibility, s.condensation, s.boil_intensity), (0.0, 0.0, 0.0));
    let mut e = beaker();
    ml(&mut e, "ethanol", 50.0);
    e.set_controls(VesselControls { heater_w: Some(400.0), ..Default::default() });
    run(&mut e, 60.0, 0.5);
    let se = e.snapshot();
    assert!((e.temperature_k - 351.5).abs() < 1.5, "T {}", e.temperature_k);
    assert!(se.boil_intensity > 0.12, "boil {}", se.boil_intensity);
    assert!(se.vapour_visibility > 0.2, "ethanol mist {}", se.vapour_visibility);
    // water: no mist when cold, more when warm, a strong plume at the boil (the mist follows the vapour flux)
    let vis = |t: f64| {
        let mut w = beaker();
        ml(&mut w, "water", 50.0);
        w.temperature_k = t;
        w.step(0.5).unwrap();
        w.snapshot().vapour_visibility
    };
    let (cold, warm, hot) = (vis(300.0), vis(330.0), vis(365.0));
    let mut boiling = beaker();
    ml(&mut boiling, "water", 50.0);
    boiling.set_controls(VesselControls { heater_w: Some(600.0), ..Default::default() });
    run(&mut boiling, 200.0, 0.5);
    let boil = boiling.snapshot();
    println!("[s10_7] mist visibility cold {cold:.3} warm {warm:.3} hot {hot:.3} boiling {:.3} (boil {:.2})", boil.vapour_visibility, boil.boil_intensity);
    assert!(cold < 0.01 && warm < hot && hot < boil.vapour_visibility && boil.vapour_visibility > 0.4);
}

#[test]
fn s10_8_flame_test_colours_from_emission_data() {
    use std::collections::HashMap;
    let flame = |el: &str, cl: f64| {
        let mut m = HashMap::new();
        m.insert(el.to_string(), 5e14);
        let fc = optics::flame::flame_colour(&m, cl, 2000.0, [0.35, 0.5, 1.0], 0.0);
        fc.emitter_rgb.map(cie::to_srgb)
    };
    let na = flame("Na", 0.0);
    assert!(na[0] > 0.9 && na[1] > 0.3 && na[1] < 0.9 && na[2] < 0.3, "Na yellow-orange {na:?}");
    let li = flame("Li", 0.0);
    assert!(li[0] > 0.9 && li[1] < 0.3 * li[0], "Li red {li:?}");
    let sr = flame("Sr", 0.0);
    assert!(sr[0] > 0.9 && sr[1] < 0.35 * sr[0], "Sr red {sr:?}");
    let k = flame("K", 0.0);
    assert!(k[0] > 0.3 && k[2] > 0.3 && k[1] < 0.8 * k[0].max(k[2]), "K lilac {k:?}");
    let cu = flame("Cu", 1e16); // a flame test wets the loop with hydrochloric acid
    assert!(cu[1] > cu[0] && cu[2] > 0.3 * cu[1], "Cu blue-green {cu:?}");
    // a salt dissolved in a burning liquid colours that liquid's flame (carried in as droplets)
    import(CompoundRequest {
        id: "s10_etoh".into(), name: "Methanol".into(), formula: "CH4O".into(), smiles: Some("CO".into()), state: Some("liquid".into()),
        density: Some(0.792), t_melt_ref_k: Some(175.6), vapor_pressure_points: vec![[337.7, 101_325.0]], dh_comb_kj_mol: Some(-726.0), ..Default::default()
    });
    import(salt("s10_srcl2", "Strontium chloride", "Cl2Sr"));
    let mut v = vessel_at(300.0, 100.0);
    v.set_controls(VesselControls { igniter: Some(true), ..Default::default() });
    ml(&mut v, "water", 4.0);
    grams(&mut v, "s10_srcl2", 2.0);
    ml(&mut v, "s10_etoh", 20.0);
    run(&mut v, 2.0, 0.1);
    let f = v.snapshot().flame.expect("the methanol solution burns");
    println!("[s10_8] burning methanol + SrCl2: {:?}", f);
    assert!(f.metal_share > 0.5, "the dissolved strontium colours the flame: {:?}", f);
    let c = f.emitter_rgb.unwrap().map(cie::to_srgb);
    assert!(c[0] > 0.8 && c[1] < 0.5 * c[0], "strontium flame red: {c:?}");
}


#[test]
fn s10_9_bubbles_follow_surface_tension_and_foam_needs_a_surfactant() {
    // Fritz departure diameter from the liquid's own surface tension and density: smaller in hot water (lower sigma) and in a
    // lower-tension liquid
    let d = |t: f64, id: &str| {
        let mut v = vessel_at(t, 250.0);
        ml(&mut v, id, 50.0);
        v.bubble_diameter_mm("bulk")
    };
    let (cold, hot) = (d(295.0, "water"), d(370.0, "water"));
    let etoh = d(295.0, "ethanol");
    println!("[s10_9] bubble diameters: water 22 C {cold:.2} mm, water 97 C {hot:.2} mm, ethanol {etoh:.2} mm");
    assert!(hot < cold && etoh < cold, "sigma(T) and sigma(liquid) must reach the bubble size");
    assert!(cold > 0.5 && cold < 6.0);
    // baking-soda fizz: gas, but no lasting foam without a surface-active species
    let mut v = beaker();
    ml(&mut v, "water", 30.0);
    v.gas_fluxes.push(GasFlux { species: "CO2(g)".into(), rate_ml_s: 60.0, bubble_diameter_mm: 2.0, nucleation: "wall".into(), origin: None });
    assert_eq!(v.snapshot().foam, 0.0, "plain fizz is transient");
    // the same gas flow through a surfactant solution builds a head
    import(CompoundRequest {
        id: "s10_sds".into(), name: "Sodium dodecyl sulfate".into(), formula: "C12H25NaO4S".into(),
        smiles: Some("CCCCCCCCCCCCOS(=O)(=O)[O-].[Na+]".into()), state: Some("solid".into()), density: Some(1.01), solubility_g_per_l: Some(150.0), ..Default::default()
    });
    let mut s = beaker();
    ml(&mut s, "water", 30.0);
    grams(&mut s, "s10_sds", 0.3);
    run(&mut s, 10.0, 0.5);
    s.gas_fluxes.push(GasFlux { species: "CO2(g)".into(), rate_ml_s: 60.0, bubble_diameter_mm: 2.0, nucleation: "wall".into(), origin: None });
    let foam = s.snapshot().foam;
    println!("[s10_9] foam with SDS {foam:.2}");
    assert!(foam > 0.3, "surfactant foam {foam}");
}

#[test]
fn s10_10_dissolved_hydrogen_chloride_fumes_and_ammonia_smokes_with_it() {
    let mut v = beaker();
    ml(&mut v, "water", 20.0);
    for _ in 0..10 {
        v.gas_fluxes.push(GasFlux { species: "NH3(g)".into(), rate_ml_s: 20.0, bubble_diameter_mm: 1.0, nucleation: "bulk".into(), origin: None });
        v.gas_fluxes.push(GasFlux { species: "HCl(g)".into(), rate_ml_s: 20.0, bubble_diameter_mm: 1.0, nucleation: "bulk".into(), origin: None });
        v.step_plume(0.5);
    }
    let f = v.snapshot().fumes;
    let smoke = f.iter().find(|x| x.species == "NH4Cl(s)").unwrap_or_else(|| panic!("NH3 + HCl must make an NH4Cl smoke: {f:?}"));
    assert!(smoke.kind == "aerosol" && smoke.opacity > 0.1, "{smoke:?}");
}
