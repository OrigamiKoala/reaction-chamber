//! Gates for the sixth pass (ALGORITHM-IMPROVEMENT.md 6.7): heats of mixing of miscible liquids, per-phase ionic equilibria.

use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::vessel::*;

/// Imports a compound the way the web layer does (model, register reagent + compound + mineral).
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

fn liquid(id: &str, name: &str, formula: &str, smiles: &str, ik: &str, density: f64, tm: f64, tb: f64) -> CompoundRequest {
    CompoundRequest {
        id: id.into(),
        name: name.into(),
        formula: formula.into(),
        smiles: Some(smiles.into()),
        inchi_key: Some(ik.into()),
        state: Some("liquid".into()),
        density: Some(density),
        t_melt_ref_k: Some(tm),
        vapor_pressure_points: vec![[tb, 101_325.0]],
        ..Default::default()
    }
}


fn beaker() -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(298.15),
        room_k: Some(298.15),
        sealed: Some(false),
        stopper_pop_atm: Some(1.0e4),
        burst_atm: Some(1.0e4),
    })
}

fn ml(v: &mut Vessel, id: &str, x: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(x), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
}

fn rise(a: &str, b: &str, ml_a: f64, ml_b: f64) -> f64 {
    let mut v = beaker();
    ml(&mut v, a, ml_a);
    let t0 = v.temperature_k;
    ml(&mut v, b, ml_b);
    v.temperature_k - t0
}

/// Water and ethanol release heat on mixing (the measured excess enthalpy is negative over most of the range, which UNIFAC
/// fitted to vapour-liquid equilibria gets wrong): 50 mL + 50 mL is x_ethanol = 0.24, H^E about -0.77 kJ/mol over 3.6 mol
/// into about 0.3 kJ/K, a rise of several kelvin, whichever liquid goes in first.
#[test]
fn water_and_ethanol_warm_on_mixing() {
    let up = rise("water", "ethanol", 50.0, 50.0);
    let down = rise("ethanol", "water", 50.0, 50.0);
    assert!(up > 5.0 && up < 12.0, "dT {}", up);
    assert!((up - down).abs() < 0.3, "order matters: {} vs {}", up, down);
    // a vessel that mixes the same liquids in small portions ends at the same temperature (H^E is a state function)
    let mut v = beaker();
    ml(&mut v, "water", 50.0);
    let t0 = v.temperature_k;
    for _ in 0..10 {
        ml(&mut v, "ethanol", 5.0);
    }
    assert!((v.temperature_k - t0 - up).abs() < 0.8, "portions {} vs once {}", v.temperature_k - t0, up);
    // water into water: nothing
    assert!(rise("water", "water", 50.0, 50.0).abs() < 1e-6);
}

/// Pairs without a table row take the group-contribution model's excess enthalpy: dispersion-dominated mixtures (alkane +
/// aromatic, alkane + ketone, alcohol + alkane) are endothermic, whatever the compounds are.
#[test]
fn pairs_without_data_follow_the_activity_model() {
    import(liquid("e_acetone", "Acetone", "C3H6O", "CC(C)=O", "CSCPPACGZOOCGX-UHFFFAOYSA-N", 0.791, 178.5, 329.2));
    import(liquid("e_hexane", "Hexane", "C6H14", "CCCCCC", "VLKZOEOYAKHREP-UHFFFAOYSA-N", 0.659, 177.8, 341.9));
    import(liquid("e_toluene", "Toluene", "C7H8", "Cc1ccccc1", "YXFVVABEGXRONW-UHFFFAOYSA-N", 0.867, 178.0, 383.8));
    for (a, b) in [("e_hexane", "e_toluene"), ("e_hexane", "e_acetone"), ("ethanol", "e_hexane")] {
        let d = rise(a, b, 50.0, 50.0);
        assert!(d < -0.2 && d > -8.0, "{} + {}: dT {}", a, b, d);
        assert!((d - rise(b, a, 50.0, 50.0)).abs() < 0.3, "{} + {} depends on the order", a, b);
    }
}

fn acetic(id: &str) -> CompoundRequest {
    liquid(id, "Acetic acid", "C2H4O2", "CC(=O)O", "QTBSBXVTEAMEQO-UHFFFAOYSA-N", 1.049, 289.8, 391.2)
}

/// (moles of the neutral acid in the organic layer, moles of acid + acetate in the aqueous layer, aqueous layer volume mL,
/// organic layer volume mL, aqueous pH)
fn acid_distribution(v: &Vessel) -> (f64, f64, f64, f64, f64) {
    let snap = v.snapshot();
    let org: f64 = v.extra_liquids.iter().map(|m| m.get("CH3COOH").copied().unwrap_or(0.0)).sum();
    let aq: f64 = ["CH3COOH", "CH3COO-"].iter().map(|k| v.species_mol.get(*k).copied().unwrap_or(0.0)).sum();
    let ph = snap.layers.iter().find_map(|l| l.ph).expect("aqueous layer has a pH");
    let (v_aq, v_org) = (snap.layers[0].volume_ml, snap.layers[1].volume_ml);
    (org, aq, v_aq, v_org, ph)
}

/// E5 (per-phase equilibria): a weak acid is extracted into an organic layer as the neutral molecule only, so its distribution
/// ratio falls with the pH of the aqueous layer as D = P / (1 + Ka/[H+]), P being the partition coefficient of the neutral
/// molecule. Nothing in the engine knows "extraction": the neutral molecule partitions through the activity model, the
/// aqueous layer ionises it by its equilibrium row, and the two settle against each other. Neutralising all the acid leaves
/// none in the organic layer. (Real P of acetic acid between 1-octanol and water: 0.68; between hexane and water: 0.0006-0.03.)
#[test]
fn a_weak_acid_is_extracted_as_the_neutral_molecule_and_follows_the_ph() {
    import(acetic("e_acetic"));
    import(liquid("e_octanol", "1-Octanol", "C8H18O", "CCCCCCCCO", "KBPLFHHGFOOTCA-UHFFFAOYSA-N", 0.824, 257.6, 468.3));
    let mut v = beaker();
    ml(&mut v, "water", 50.0);
    ml(&mut v, "e_octanol", 50.0);
    ml(&mut v, "e_acetic", 3.0);
    for _ in 0..20 {
        v.step(0.5).unwrap();
    }
    let (org0, aq0, vaq0, vorg0, ph0) = acid_distribution(&v);
    assert!(v.snapshot().layers.len() == 2, "octanol and water are two layers");
    // all of the acid is accounted for (3 mL at 1.049 g/mL)
    let total = 3.0 * 1.049 / 60.052;
    assert!((org0 + aq0 - total).abs() < 0.03 * total, "acid {} vs dosed {}", org0 + aq0, total);
    // partition coefficient of the neutral molecule at low pH (acid hardly ionised)
    let p = (org0 / vorg0) / (aq0 / vaq0);
    assert!(p > 0.3 && p < 1.5, "P(octanol/water) = {}, measured 0.68", p);
    assert!(ph0 < 3.0, "pH {}", ph0);
    let pka = 4.76;
    for step in 0..4 {
        ml(&mut v, "naoh_1m", 10.0);
        for _ in 0..30 {
            v.step(0.5).unwrap();
        }
        let (org, aq, vaq, vorg, ph) = acid_distribution(&v);
        let d = (org / vorg) / (aq / vaq);
        let d_pred = p / (1.0 + 10f64.powf(ph - pka));
        println!("[E5] after {} mL NaOH: pH {:.2}  D = {:.3}  predicted {:.3}", 10 * (step + 1), ph, d, d_pred);
        assert!((d / d_pred).ln().abs() < 0.25, "pH {}: D {} vs P/(1+Ka/[H]) {}", ph, d, d_pred);
    }
    // 60 mmol NaOH against 52 mmol acid: nothing left in the organic layer
    for _ in 0..2 {
        ml(&mut v, "naoh_1m", 10.0);
        for _ in 0..30 {
            v.step(0.5).unwrap();
        }
    }
    let (org, _, _, _, ph) = acid_distribution(&v);
    let neutral_aq = v.species_mol.get("CH3COOH").copied().unwrap_or(0.0);
    let acetate = v.species_mol.get("CH3COO-").copied().unwrap_or(0.0);
    assert!(org < 0.01 * total && neutral_aq < 0.01 * total && ph > 11.0, "organic acid {} aqueous acid {} pH {}", org, neutral_aq, ph);
    assert!((acetate - total).abs() < 0.02 * total, "all of the acid is acetate: {} of {}", acetate, total);
}

/// The electrolytes carry no heat of mixing of their own (their activity models are Gibbs-energy fits without enthalpy data):
/// methanol poured into a concentrated salt solution warms it by the molecular mixing heat at most, it does not cool it by a
/// spurious temperature derivative of the salting-out term.
#[test]
fn a_concentrated_electrolyte_adds_no_spurious_mixing_heat() {
    import(liquid("e_meoh", "Methanol", "CH4O", "CO", "OKKJLVBELUTLKV-UHFFFAOYSA-N", 0.792, 175.6, 337.7));
    let mut v = beaker();
    ml(&mut v, "water", 4.0);
    v.dose(DoseRequest { reagent_id: "nahco3_s".into(), volume_ml: None, mass_g: Some(0.3), drops: None, temperature_k: None, solid_form: None }).unwrap();
    let t0 = v.temperature_k;
    ml(&mut v, "e_meoh", 20.0);
    let d = v.temperature_k - t0;
    assert!(d > -1.0 && d < 5.0, "dT {}", d);
}
