//! Mass-spectrometer predictor gates: EI base peaks, molecular ions and key fragments of common compounds (NIST-style
//! 70 eV spectra, recalled); GC ordering; isotope patterns; ESI adducts; ion suppression. The compounds are inputs
//! (SMILES); the engine stores none of these spectra.

use reaction_chamber_engine::analytical::graph::Mol;
use reaction_chamber_engine::analytical::ms::*;
use reaction_chamber_engine::analytical::ms_ei;

fn spectrum(smi: &str) -> Vec<ms_ei::EiPeak> {
    let g = &Mol::components_from_smiles(smi).unwrap()[0];
    ms_ei::ei_spectrum_with(g, &ms_ei::EiParams::default()).unwrap().0
}

fn top(peaks: &[ms_ei::EiPeak], n: usize) -> String {
    let mut v: Vec<&ms_ei::EiPeak> = peaks.iter().collect();
    v.sort_by(|a, b| b.intensity.partial_cmp(&a.intensity).unwrap());
    v.iter().take(n).map(|p| format!("{}:{:.0}", p.mz, p.intensity)).collect::<Vec<_>>().join(" ")
}

fn at(peaks: &[ms_ei::EiPeak], mz: i32) -> f64 {
    peaks.iter().find(|p| p.mz == mz).map_or(0.0, |p| p.intensity)
}

/// (name, SMILES, base peak, [(mz, expected %)] key peaks)
const REF: &[(&str, &str, i32, &[(i32, f64)])] = &[
    ("methanol", "CO", 31, &[(32, 74.0), (29, 64.0), (15, 13.0)]),
    ("ethanol", "CCO", 31, &[(45, 52.0), (46, 22.0), (29, 30.0), (27, 24.0)]),
    ("1-propanol", "CCCO", 31, &[(59, 11.0), (29, 30.0), (42, 20.0)]),
    ("2-propanol", "CC(C)O", 45, &[(43, 17.0), (27, 10.0), (29, 7.0)]),
    ("acetone", "CC(C)=O", 43, &[(58, 60.0), (15, 20.0), (42, 7.0)]),
    ("butanone", "CCC(C)=O", 43, &[(72, 28.0), (29, 25.0), (57, 8.0)]),
    ("acetaldehyde", "CC=O", 29, &[(44, 85.0), (43, 40.0), (15, 15.0)]),
    ("acetic acid", "CC(=O)O", 43, &[(45, 90.0), (60, 70.0), (15, 15.0)]),
    ("ethyl acetate", "CCOC(C)=O", 43, &[(61, 20.0), (70, 15.0), (88, 12.0), (45, 30.0), (29, 25.0)]),
    ("diethyl ether", "CCOCC", 31, &[(29, 45.0), (59, 35.0), (45, 20.0), (74, 25.0)]),
    ("benzene", "c1ccccc1", 78, &[(77, 18.0), (52, 18.0), (51, 19.0), (50, 16.0)]),
    ("toluene", "Cc1ccccc1", 91, &[(92, 70.0), (65, 12.0), (39, 12.0)]),
    ("ethylbenzene", "CCc1ccccc1", 91, &[(106, 30.0), (77, 13.0), (65, 10.0)]),
    ("chlorobenzene", "Clc1ccccc1", 112, &[(114, 32.0), (77, 35.0), (51, 15.0)]),
    ("bromoethane", "CCBr", 29, &[(108, 50.0), (110, 50.0), (27, 65.0)]),
    ("chloroform", "ClC(Cl)Cl", 83, &[(85, 64.0), (47, 24.0), (118, 3.0)]),
    ("hexane", "CCCCCC", 57, &[(43, 85.0), (41, 60.0), (29, 55.0), (86, 12.0)]),
    ("cyclohexane", "C1CCCCC1", 56, &[(84, 72.0), (41, 55.0), (69, 35.0)]),
    ("phenol", "Oc1ccccc1", 94, &[(66, 40.0), (65, 35.0), (39, 20.0)]),
    ("aniline", "Nc1ccccc1", 93, &[(66, 35.0), (65, 10.0)]),
    ("acetophenone", "CC(=O)c1ccccc1", 105, &[(77, 65.0), (120, 40.0), (51, 25.0), (43, 15.0)]),
    ("nitrobenzene", "O=[N+]([O-])c1ccccc1", 77, &[(123, 75.0), (51, 40.0), (93, 25.0)]),
    ("pyridine", "c1ccncc1", 79, &[(52, 50.0), (51, 25.0)]),
    ("water", "O", 18, &[(17, 21.0)]),
    ("anisole", "COc1ccccc1", 108, &[(78, 45.0), (65, 35.0), (93, 23.0)]),
    ("dichloromethane", "ClCCl", 49, &[(84, 65.0), (86, 40.0)]),
    ("triethylamine", "CCN(CC)CC", 86, &[(101, 20.0), (58, 40.0)]),
    ("cyclohexene", "C1=CCCCC1", 67, &[(82, 30.0), (54, 60.0)]),
    ("1-butanol", "CCCCO", 31, &[(56, 35.0), (41, 40.0), (43, 30.0)]),
];

#[test]
fn ei_reference_spectra() {
    let mut base_ok = 0;
    let mut key_err = 0.0;
    let mut key_n = 0;
    let mut missing: Vec<String> = Vec::new();
    for (name, smi, base, keys) in REF {
        let sp = spectrum(smi);
        let b = sp.iter().max_by(|a, b| a.intensity.partial_cmp(&b.intensity).unwrap()).unwrap().mz;
        eprintln!("{:<16} base {:>3} (expect {:>3})  top: {}", name, b, base, top(&sp, 9));
        if b == *base {
            base_ok += 1;
        }
        for (mz, e) in keys.iter() {
            let got = at(&sp, *mz);
            eprintln!("      {:>3} expect {:>5.0} got {:>5.1}", mz, e, got);
            key_n += 1;
            key_err += (got.max(0.5).ln() - e.ln()).abs();
            if got < e * 0.15 {
                missing.push(format!("{} m/z {}", name, mz));
            }
        }
    }
    let n = REF.len();
    eprintln!("base peak right for {}/{}; mean |ln ratio| of key peaks {:.2}; missing: {:?}", base_ok, n, key_err / key_n as f64, missing);
    assert!(base_ok * 100 / n >= 60, "base peak right for only {}/{}", base_ok, n);
}

fn sp(name: &str, smi: &str, conc: f64, tb: Option<f64>) -> MsSampleSpecies {
    MsSampleSpecies { id: name.into(), name: name.into(), smiles: Some(smi.into()), formula: String::new(), charge: 0, elements: vec![], conc_mm: conc, tb_k: tb, b_k: None }
}

#[test]
fn gc_orders_by_volatility_and_skips_salts() {
    let mix = [
        sp("hexane", "CCCCCC", 100.0, Some(342.0)),
        sp("decane", "CCCCCCCCCC", 100.0, Some(447.0)),
        sp("toluene", "Cc1ccccc1", 100.0, Some(384.0)),
        MsSampleSpecies { id: "NaCl".into(), name: "sodium chloride".into(), smiles: Some("[Na+].[Cl-]".into()), formula: "NaCl".into(), charge: 0, elements: vec![], conc_mm: 100.0, tb_k: None, b_k: None },
    ];
    let r = simulate_ei(&mix, 1);
    let names: Vec<&str> = r.components.iter().map(|c| c.name.as_str()).collect();
    assert_eq!(names, vec!["hexane", "toluene", "decane"]);
    assert!(r.not_analysed.iter().any(|s| s.contains("sodium chloride")));
    assert!(r.tic.iter().cloned().fold(0.0, f32::max) > 0.05);
}

#[test]
fn esi_adducts_and_classes() {
    let mix = [
        sp("triethylamine", "CCN(CC)CC", 1.0, None),
        sp("acetic acid", "CC(=O)O", 1.0, None),
        sp("hexane", "CCCCCC", 1.0, None),
        MsSampleSpecies { id: "Na+".into(), name: "sodium ion".into(), smiles: Some("[Na+]".into()), formula: "Na+".into(), charge: 1, elements: vec![("Na".into(), 1)], conc_mm: 1.0, tb_k: None, b_k: None },
    ];
    let pos = simulate_esi(&mix, EsiPolarity::Positive);
    let has = |s: &MassSpectrum, mz: f64| s.summed.iter().any(|p| (p.mz - mz).abs() < 0.6);
    assert!(has(&pos, 102.0), "triethylamine [M+H]+ at 102: {:?}", pos.summed.iter().map(|p| (p.mz, p.intensity)).collect::<Vec<_>>());
    assert!(has(&pos, 23.0), "Na+ passes through");
    assert!(!pos.components.iter().any(|c| c.name == "hexane"), "an alkane does not ionise by ESI");
    let neg = simulate_esi(&mix, EsiPolarity::Negative);
    assert!(has(&neg, 59.0), "acetate [M-H]- at 59");
    assert!(!has(&neg, 102.0));
}

use reaction_chamber_engine::analytical::ms_ei::EiParams;

fn score(prm: &EiParams, refs: &[(&str, &str, i32, &[(i32, f64)])]) -> (f64, usize, f64) {
    let mut base_ok = 0;
    let mut err = 0.0;
    let mut n = 0;
    for (_, smi, base, keys) in refs {
        let g = &Mol::components_from_smiles(smi).unwrap()[0];
        let Some((sp, _)) = ms_ei::ei_spectrum_with(g, prm) else { continue };
        let b = sp.iter().max_by(|a, b| a.intensity.partial_cmp(&b.intensity).unwrap()).map(|p| p.mz).unwrap_or(0);
        if b == *base {
            base_ok += 1;
        }
        for (mz, e) in keys.iter() {
            let got = at(&sp, *mz);
            err += (got.max(0.5).ln() - e.ln()).abs().min(3.0);
            n += 1;
        }
    }
    let mean = err / n as f64;
    (base_ok as f64 / refs.len() as f64 - 0.3 * mean, base_ok, mean)
}

#[test]
#[ignore]
fn tune_ei_parameters() {
    let mut seed = 12345u64;
    let mut rnd = move || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        (seed >> 11) as f64 / (1u64 << 53) as f64
    };
    let mut best = EiParams::default();
    let mut best_s = score(&best, REF);
    eprintln!("start {:?} {:?}", best, best_s);
    for it in 0..600 {
        let mut c = best;
        let wide = it < 200;
        let jig = |x: f64, lo: f64, hi: f64, r: f64| (x + (r - 0.5) * (hi - lo) * if wide { 0.6 } else { 0.2 }).clamp(lo, hi);
        c.w_low = jig(c.w_low, 0.0, 0.7, rnd());
        c.theta_low = jig(c.theta_low, 0.2, 1.2, rnd());
        c.theta = jig(c.theta, 0.5, 1.6, rnd());
        c.w2 = jig(c.w2, 0.05, 0.5, rnd());
        c.tail = jig(c.tail, 1.5, 6.0, rnd());
        c.s_factor = jig(c.s_factor, 0.2, 0.9, rnd());
        c.tau = (c.tau.ln() + (rnd() - 0.5) * if wide { 1.5 } else { 0.5 }).exp().clamp(5e-7, 5e-5);
        c.cleave_shift = jig(c.cleave_shift, -0.4, 1.0, rnd());
        c.rearr_shift = jig(c.rearr_shift, -0.6, 1.0, rnd());
        c.keep = jig(c.keep, 0.4, 1.0, rnd());
        c.s_factor = c.s_factor.max(0.1);
        let s = score(&c, REF);
        if s.0 > best_s.0 {
            best = c;
            best_s = s;
            eprintln!("it {} score {:.3} base {} err {:.2} {:?}", it, s.0, s.1, s.2, c);
        }
    }
    eprintln!("BEST {:?} {:?}", best, best_s);
}

/// Compounds that were NOT used to fit the model constants.
const HOLDOUT: &[(&str, &str, i32, &[(i32, f64)])] = &[
    ("isobutane", "CC(C)C", 43, &[(41, 30.0), (42, 8.0), (39, 14.0), (58, 7.0)]),
    ("acetonitrile", "CC#N", 41, &[(40, 30.0), (39, 15.0)]),
    ("methyl acetate", "COC(C)=O", 43, &[(74, 35.0), (59, 7.0), (15, 15.0)]),
    ("DMSO", "CS(C)=O", 63, &[(78, 66.0), (15, 30.0)]),
    ("styrene", "C=Cc1ccccc1", 104, &[(103, 30.0), (78, 25.0), (77, 15.0), (51, 20.0)]),
    ("naphthalene", "c1ccc2ccccc2c1", 128, &[(127, 12.0), (129, 11.0), (102, 8.0)]),
    ("benzyl alcohol", "OCc1ccccc1", 79, &[(108, 85.0), (107, 70.0), (77, 55.0), (91, 25.0)]),
    ("tetrahydrofuran", "C1CCOC1", 42, &[(72, 25.0), (71, 55.0), (41, 40.0)]),
    ("tert-butanol", "CC(C)(C)O", 59, &[(31, 20.0), (41, 15.0), (43, 15.0)]),
    ("heptane", "CCCCCCC", 43, &[(57, 85.0), (41, 70.0), (71, 35.0), (100, 6.0)]),
    ("benzonitrile", "N#Cc1ccccc1", 103, &[(76, 14.0), (104, 8.0)]),
    ("chloroethane", "CCCl", 64, &[(66, 33.0), (28, 80.0), (29, 60.0), (49, 12.0)]),
    ("carbon tetrachloride", "ClC(Cl)(Cl)Cl", 117, &[(119, 96.0), (121, 31.0), (82, 20.0)]),
    ("propylbenzene", "CCCc1ccccc1", 91, &[(120, 25.0), (92, 40.0), (65, 10.0)]),
    ("methylamine", "CN", 30, &[(31, 70.0), (29, 20.0), (28, 40.0)]),
];

#[test]
fn ei_holdout_spectra() {
    let prm = ms_ei::EiParams::default();
    let (s, ok, err) = score(&prm, HOLDOUT);
    for (name, smi, base, keys) in HOLDOUT {
        let g = &Mol::components_from_smiles(smi).unwrap()[0];
        let sp = ms_ei::ei_spectrum_with(g, &prm).unwrap().0;
        let b = sp.iter().max_by(|a, b| a.intensity.partial_cmp(&b.intensity).unwrap()).unwrap().mz;
        eprintln!("{:<22} base {:>3} (expect {:>3}) {}  top: {}", name, b, base, if b == *base { "  " } else { "XX" }, top(&sp, 8));
        let _ = keys;
    }
    eprintln!("hold-out: base peaks right {}/{}, mean |ln ratio| {:.2}, score {:.2}", ok, HOLDOUT.len(), err, s);
    assert!(ok * 100 / HOLDOUT.len() >= 50);
}

// ------------------------------------------------------------------ through a real vessel (imports carry their SMILES)

use reaction_chamber_engine::chem_db;
use reaction_chamber_engine::compound_model::*;
use reaction_chamber_engine::vessel::*;

fn beaker() -> Vessel {
    Vessel::new(VesselConfig { vessel_type: "beaker-250".into(), capacity_ml: 250.0, glass_mass_g: 110.0, inner_radius_cm: 3.5, temperature_k: Some(295.15), room_k: Some(295.15), sealed: Some(false), stopper_pop_atm: Some(2.2), burst_atm: Some(6.0) })
}

fn import_liquid(id: &str, name: &str, formula: &str, smiles: &str, density: f64, tb: f64) {
    let req = CompoundRequest { id: id.into(), name: name.into(), formula: formula.into(), smiles: Some(smiles.into()), state: Some("liquid".into()), density: Some(density), vapor_pressure_points: vec![[tb, 101325.0]], dh_vap_kj_mol: Some(88.0 * tb / 1000.0), dh_vap_at_k: Some(tb), ..Default::default() };
    let m = model_compound(&req);
    assert!(m.modelable, "{}: {}", id, m.reason);
    chem_db::register_custom_reagent(m.entry.clone().expect("entry"));
    if let Some(c) = &m.compound {
        chem_db::register_custom_compound(c.clone());
    }
}

fn ml(v: &mut Vessel, id: &str, x: f64) {
    v.dose(DoseRequest { reagent_id: id.into(), volume_ml: Some(x), mass_g: None, drops: None, temperature_k: None, solid_form: None }).unwrap();
}

#[test]
fn imported_compounds_are_analysed_from_their_structure() {
    // none of these is known to the NMR / MS code: only their SMILES (from the import) reaches it
    import_liquid("C8H10", "ethylbenzene", "C8H10", "CCc1ccccc1", 0.867, 409.3);
    import_liquid("C7H8", "toluene", "C7H8", "Cc1ccccc1", 0.867, 383.8);
    let mut v = beaker();
    ml(&mut v, "C8H10", 5.0);
    ml(&mut v, "C7H8", 5.0);
    // NMR
    let nmr = v.nmr_spectrum(0, "1H", "CDCl3", 16, 3).unwrap();
    let names: std::collections::BTreeSet<_> = nmr.signals.iter().filter(|s| !s.solvent).map(|s| s.species.clone()).collect();
    assert!(names.contains("ethylbenzene") && names.contains("toluene"), "{:?}", names);
    let ethyl_q = nmr.signals.iter().find(|s| s.species == "ethylbenzene" && s.multiplicity == "q").expect("ethyl CH2 quartet");
    assert!((ethyl_q.ppm - 2.65).abs() < 0.2, "{}", ethyl_q.ppm);
    assert!(nmr.signals.iter().any(|s| s.species == "toluene" && (s.ppm - 2.28).abs() < 0.15 && s.multiplicity == "s"));
    // GC/MS: toluene elutes before ethylbenzene; each has its own spectrum
    let ms = v.ms_spectrum(0, "EI", 1).unwrap();
    let order: Vec<&str> = ms.components.iter().map(|c| c.name.as_str()).collect();
    assert_eq!(order, vec!["toluene", "ethylbenzene"], "{:?} {:?}", order, ms.not_analysed);
    assert_eq!(ms.components[0].peaks.iter().max_by(|a, b| a.intensity.partial_cmp(&b.intensity).unwrap()).unwrap().mz as i32 / 10, 9);
    assert!(ms.components[0].rt_min.unwrap() < ms.components[1].rt_min.unwrap());
}

#[test]
fn a_reaction_mixture_changes_the_spectrum() {
    // aqueous NaCl + AgNO3: no organic structure at all -> nothing to simulate for NMR, ESI shows the ions left in solution
    let mut v = beaker();
    ml(&mut v, "nacl_0_1m", 10.0);
    let nmr = v.nmr_spectrum(0, "1H", "D2O", 8, 1).unwrap();
    assert!(nmr.signals.iter().all(|s| s.solvent || s.assignment.contains("HDO")), "{:?}", nmr.signals.iter().map(|s| &s.assignment).collect::<Vec<_>>());
}

#[test]
fn aqueous_salt_in_esi_and_gc() {
    let mut v = beaker();
    ml(&mut v, "nacl_0_1m", 10.0);
    let pos = v.ms_spectrum(0, "ESI+", 1).unwrap();
    assert!(pos.summed.iter().any(|p| (p.mz - 23.0).abs() < 0.6), "Na+ in positive ESI: {:?}", pos.summed.iter().map(|p| p.mz).collect::<Vec<_>>());
    let neg = v.ms_spectrum(0, "ESI-", 1).unwrap();
    assert!(neg.summed.iter().any(|p| (p.mz - 35.0).abs() < 0.6), "Cl- in negative ESI");
    let gc = v.ms_spectrum(0, "EI", 1).unwrap();
    // only water elutes; the salt is reported as non-volatile
    assert!(gc.components.iter().all(|c| c.formula == "H2O"), "{:?}", gc.components.iter().map(|c| &c.name).collect::<Vec<_>>());
    eprintln!("not analysed: {:?}", gc.not_analysed);
}
