//! NMR predictor gates: literature shifts (CDCl3, 400 MHz) of common compounds, multiplicities, exchange, noise.
//! The compounds are *inputs* to a structure-based predictor (SMILES only); nothing here is stored in the engine.

use reaction_chamber_engine::analytical::nmr::*;

fn sp(name: &str, smi: &str, conc: f64) -> SampleSpecies {
    SampleSpecies { id: name.into(), name: name.into(), smiles: Some(smi.into()), formula: String::new(), charge: 0, conc_mm: conc }
}

fn run(species: &[SampleSpecies], nuc: Nucleus, solv: Solvent, scans: u32) -> NmrSpectrum {
    simulate(species, nuc, solv, scans, 7, false)
}

fn analyte(spec: &NmrSpectrum) -> Vec<&NmrSignal> {
    spec.signals.iter().filter(|s| !s.solvent).collect()
}

/// (SMILES, expected 1H shifts)
const H1_REF: &[(&str, &[f64])] = &[
    ("CCO", &[1.25, 3.69]),
    ("CC(C)=O", &[2.17]),
    ("CCOC(C)=O", &[1.26, 2.04, 4.12]),
    ("Cc1ccccc1", &[2.34, 7.2]),
    ("c1ccccc1", &[7.36]),
    ("CC(=O)O", &[2.10]),
    ("ClCCl", &[5.30]),
    ("CCOCC", &[1.21, 3.48]),
    ("CC#N", &[2.0]),
    ("CS(C)=O", &[2.62]),
    ("C1CCCCC1", &[1.43]),
    ("C1=CCCCC1", &[5.67, 2.0, 1.62]),
    ("CC(C)O", &[1.22, 4.0]),
    ("CCCO", &[0.94, 1.59, 3.58]),
    ("CCC(C)=O", &[1.05, 2.14, 2.46]),
    ("CC=O", &[9.80, 2.20]),
    ("C[N+](=O)[O-]", &[4.33]),
    ("COc1ccccc1", &[3.80, 6.92, 7.28]),
    ("O=[N+]([O-])c1ccccc1", &[8.2, 7.5, 7.65]),
    ("CC(=O)c1ccccc1", &[2.60, 7.45, 7.55, 7.95]),
    ("O=Cc1ccccc1", &[10.0, 7.87, 7.5, 7.6]),
    ("C=Cc1ccccc1", &[6.72, 5.75, 5.25, 7.4]),
    ("c1ccncc1", &[8.60, 7.64, 7.25]),
    ("CC(C)(C)O", &[1.28]),
    ("CCBr", &[1.67, 3.43]),
    ("CCCCCC", &[0.89, 1.26]),
];

/// (SMILES, expected 13C shifts)
const C13_REF: &[(&str, &[f64])] = &[
    ("CCO", &[18.4, 58.0]),
    ("CC(C)=O", &[30.8, 206.7]),
    ("CCOC(C)=O", &[14.2, 21.0, 60.4, 171.1]),
    ("Cc1ccccc1", &[21.4, 137.9, 129.0, 128.2, 125.3]),
    ("c1ccccc1", &[128.4]),
    ("CC(=O)O", &[20.8, 178.1]),
    ("ClCCl", &[53.8]),
    ("CCOCC", &[15.2, 65.9]),
    ("CC#N", &[1.3, 117.7]),
    ("CS(C)=O", &[40.8]),
    ("C1CCCCC1", &[26.9]),
    ("C1=CCCCC1", &[127.3, 25.2, 22.9]),
    ("CC(C)O", &[25.3, 64.0]),
    ("CCCO", &[10.3, 25.9, 64.2]),
    ("CCC(C)=O", &[7.4, 36.9, 29.4, 209.0]),
    ("COc1ccccc1", &[55.1, 159.9, 114.0, 129.5, 120.7]),
    ("O=[N+]([O-])c1ccccc1", &[148.3, 123.5, 129.4, 134.7]),
    ("CC(=O)c1ccccc1", &[26.6, 198.1, 137.1, 128.3, 128.6, 133.0]),
    ("O=Cc1ccccc1", &[192.3, 136.4, 129.7, 129.0, 134.4]),
    ("C=Cc1ccccc1", &[136.9, 113.8, 137.6, 128.5, 127.7, 126.2]),
    ("c1ccncc1", &[149.9, 123.8, 135.9]),
    ("Oc1ccccc1", &[155.0, 115.3, 129.7, 120.9]),
    ("CC(C)(C)O", &[31.2, 68.9]),
    ("CCCCCC", &[14.1, 22.9, 31.9]),
];

fn compare(refs: &[(&str, &[f64])], nuc: Nucleus, scans: u32, tol: f64) -> (f64, usize) {
    let mut tot = 0.0;
    let mut n = 0;
    let mut worst: Vec<(f64, String)> = Vec::new();
    for (smi, exp) in refs {
        let spec = run(&[sp(smi, smi, 1000.0)], nuc, Solvent::Cdcl3, scans);
        let sig = analyte(&spec);
        for e in exp.iter() {
            let best = sig.iter().map(|s| (s.ppm - e).abs()).fold(f64::MAX, f64::min);
            let near = sig.iter().min_by(|a, b| (a.ppm - e).abs().partial_cmp(&(b.ppm - e).abs()).unwrap()).map(|s| s.ppm).unwrap_or(f64::NAN);
            eprintln!("{:<24} expected {:>7.2}  predicted {:>7.2}  err {:>5.2}", smi, e, near, best);
            tot += best;
            n += 1;
            worst.push((best, format!("{} {}", smi, e)));
        }
    }
    worst.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    eprintln!("mean abs error {:.3} over {} shifts; worst: {:?}", tot / n as f64, n, &worst[..worst.len().min(6)]);
    assert!(worst[0].0 < tol, "worst error {:?}", worst[0]);
    (tot / n as f64, n)
}

#[test]
fn h1_shifts_match_literature() {
    let (mae, _) = compare(H1_REF, Nucleus::H1, 16, 0.6);
    assert!(mae < 0.16, "mean abs error {}", mae);
}

#[test]
fn c13_shifts_match_literature() {
    let (mae, _) = compare(C13_REF, Nucleus::C13, 4096, 9.0);
    assert!(mae < 3.0, "mean abs error {}", mae);
}

fn find<'a>(spec: &'a NmrSpectrum, ppm: f64, tol: f64) -> &'a NmrSignal {
    spec.signals.iter().filter(|s| !s.solvent).min_by(|a, b| (a.ppm - ppm).abs().partial_cmp(&(b.ppm - ppm).abs()).unwrap()).filter(|s| (s.ppm - ppm).abs() < tol).unwrap_or_else(|| panic!("no signal near {} in {:?}", ppm, spec.signals.iter().map(|s| (s.ppm, &s.multiplicity)).collect::<Vec<_>>()))
}

#[test]
fn multiplicities_and_integrals() {
    // ethyl acetate: t (3H), s (3H), q (2H)
    let s = run(&[sp("ethyl acetate", "CCOC(C)=O", 1000.0)], Nucleus::H1, Solvent::Cdcl3, 16);
    let t = find(&s, 1.26, 0.2);
    let q = find(&s, 4.12, 0.2);
    let a = find(&s, 2.04, 0.2);
    assert_eq!(t.multiplicity, "t");
    assert_eq!(q.multiplicity, "q");
    assert_eq!(a.multiplicity, "s");
    assert!((t.integration - 3.0).abs() < 0.01 && (q.integration - 2.0).abs() < 0.01 && (a.integration - 3.0).abs() < 0.01);
    assert!((t.j_hz[0] - 7.0).abs() < 0.5);
    // styrene vinyl protons: dd (J ~ 17.6/10.9), and the two =CH2 protons are doublets of doublets (geminal ~1.5)
    let s = run(&[sp("styrene", "C=Cc1ccccc1", 1000.0)], Nucleus::H1, Solvent::Cdcl3, 16);
    let x = find(&s, 6.7, 0.2);
    assert!(x.multiplicity == "dd" || x.multiplicity == "m", "{}", x.multiplicity);
    // isopropanol: doublet 6H and septet 1H
    let s = run(&[sp("isopropanol", "CC(C)O", 1000.0)], Nucleus::H1, Solvent::Cdcl3, 16);
    assert_eq!(find(&s, 1.22, 0.2).multiplicity, "d");
    assert_eq!(find(&s, 4.0, 0.3).multiplicity, "sept");
}

#[test]
fn exchange_and_solvents() {
    // ethanol in DMSO: OH is a separate triplet near 4.4 coupled to CH2
    let s = run(&[sp("ethanol", "CCO", 1000.0)], Nucleus::H1, Solvent::Dmso, 16);
    let oh = find(&s, 4.4, 0.4);
    assert!(oh.exchangeable);
    assert!(oh.multiplicity == "t" || oh.multiplicity == "br s", "{}", oh.multiplicity);
    // in D2O the OH is gone and joins the HDO line
    let s = run(&[sp("ethanol", "CCO", 1000.0)], Nucleus::H1, Solvent::D2o, 16);
    assert!(s.signals.iter().filter(|x| !x.solvent).all(|x| !x.exchangeable));
    assert!(s.signals.iter().any(|x| x.assignment.contains("HDO")));
    // ethanol + water in CDCl3 average into one line
    let s = run(&[sp("ethanol", "CCO", 500.0), sp("water", "O", 500.0)], Nucleus::H1, Solvent::Cdcl3, 16);
    let ex: Vec<_> = s.signals.iter().filter(|x| x.exchangeable).collect();
    assert_eq!(ex.len(), 1, "{:?}", ex.iter().map(|x| x.ppm).collect::<Vec<_>>());
}

#[test]
fn mixtures_scale_with_concentration() {
    let s = run(&[sp("ethanol", "CCO", 1000.0), sp("acetone", "CC(C)=O", 250.0)], Nucleus::H1, Solvent::Cdcl3, 16);
    let et = find(&s, 1.25, 0.2);
    let ac = find(&s, 2.17, 0.2);
    // per-proton area ratio: 1000 mM vs 250 mM
    let r = (ac.integration / ac.nuclei as f64) / (et.integration / et.nuclei as f64);
    assert!((r - 0.25).abs() < 0.01, "{}", r);
}

#[test]
fn noise_hides_dilute_signals_until_more_scans() {
    let dilute = [sp("ethanol", "CCO", 100.0)];
    let few = run(&dilute, Nucleus::C13, Solvent::Cdcl3, 16);
    let many = run(&dilute, Nucleus::C13, Solvent::Cdcl3, 16384);
    assert!(analyte(&few).is_empty(), "20 mM 13C in 16 scans should be noise");
    assert!(!analyte(&many).is_empty());
    // 1H of the same sample is easy
    assert!(!analyte(&run(&dilute, Nucleus::H1, Solvent::Cdcl3, 16)).is_empty());
}

#[test]
fn solvent_residuals() {
    let s = run(&[sp("ethanol", "CCO", 1000.0)], Nucleus::H1, Solvent::Cdcl3, 16);
    assert!(s.signals.iter().any(|x| x.solvent && (x.ppm - 7.26).abs() < 0.01));
    let s = run(&[sp("ethanol", "CCO", 1000.0)], Nucleus::C13, Solvent::Cdcl3, 64);
    let t = s.signals.iter().find(|x| x.solvent && (x.ppm - 77.16).abs() < 0.05).expect("CDCl3 triplet");
    assert_eq!(t.multiplicity, "t");
}

#[test]
fn fluorine_splits_carbon() {
    let s = run(&[sp("fluorobenzene", "Fc1ccccc1", 2000.0)], Nucleus::C13, Solvent::Cdcl3, 4096);
    let cf = analyte(&s).into_iter().max_by(|a, b| a.ppm.partial_cmp(&b.ppm).unwrap()).unwrap();
    assert!(cf.ppm > 155.0 && cf.multiplicity == "d", "{} {}", cf.ppm, cf.multiplicity);
    assert!((cf.j_hz[0] - 245.0).abs() < 10.0);
}

/// A broad set of structures (drug-like, natural-product-like, heterocycles, long chains, polyfunctional): the spectra must
/// account for every proton and every carbon, and finish quickly. SMILES as PubChem writes them (Kekule rings, stereo marks).
const ZOO: &[(&str, &str)] = &[
    ("glycine", "C(C(=O)O)N"),
    ("alanine", "C[C@@H](C(=O)O)N"),
    ("glucose", "C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O"),
    ("caffeine", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C"),
    ("aspirin", "CC(=O)OC1=CC=CC=C1C(=O)O"),
    ("paracetamol", "CC(=O)NC1=CC=C(C=C1)O"),
    ("ibuprofen", "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O"),
    ("nicotine", "CN1CCCC1C2=CN=CC=C2"),
    ("cholesterol", "C[C@H](CCCC(C)C)[C@H]1CC[C@@H]2[C@@]1(CC[C@H]3[C@H]2CC=C4[C@@]3(CC[C@@H](C4)O)C)C"),
    ("dodecane", "CCCCCCCCCCCC"),
    ("palmitic acid", "CCCCCCCCCCCCCCCC(=O)O"),
    ("anthracene", "C1=CC=C2C=C3C=CC=CC3=CC2=C1"),
    ("adenine", "C1=NC2=NC=NC(=C2N1)N"),
    ("quinoline", "C1=CC=C2C(=C1)C=CC=N2"),
    ("indole", "C1=CC=C2C(=C1)C=CN2"),
    ("thiophene", "C1=CSC=C1"),
    ("furan", "C1=COC=C1"),
    ("imidazole", "C1=CN=CN1"),
    ("urea", "C(=O)(N)N"),
    ("lactic acid", "CC(C(=O)O)O"),
    ("citric acid", "C(C(=O)O)C(CC(=O)O)(C(=O)O)O"),
    ("styrene oxide", "C1C(O1)C2=CC=CC=C2"),
    ("cyclopropane", "C1CC1"),
    ("norbornene", "C1CC2CC1C=C2"),
    ("adamantane", "C1C2CC3CC1CC(C2)C3"),
    ("triphenylmethanol", "C1=CC=C(C=C1)C(C2=CC=CC=C2)(C3=CC=CC=C3)O"),
    ("4-nitroaniline", "C1=CC(=CC=C1N)[N+](=O)[O-]"),
    ("benzophenone", "C1=CC=C(C=C1)C(=O)C2=CC=CC=C2"),
    ("acetamide", "CC(=O)N"),
    ("acrylonitrile", "C=CC#N"),
    ("propyne", "CC#C"),
    ("trifluoroacetic acid", "C(=O)(C(F)(F)F)O"),
    ("diethyl malonate", "CCOC(=O)CC(=O)OCC"),
    ("DMSO", "CS(C)=O"),
    ("sulfolane", "C1CCS(=O)(=O)C1"),
    ("triethylamine", "CCN(CC)CC"),
    ("piperidine", "C1CCNCC1"),
    ("morpholine", "C1COCCN1"),
    ("benzoyl chloride", "C1=CC=C(C=C1)C(=O)Cl"),
    ("vanillin", "COC1=C(C=CC(=C1)C=O)O"),
    ("menthol", "CC1CCC(C(C1)O)C(C)C"),
    ("limonene", "CC1=CCC(CC1)C(=C)C"),
    ("camphor", "CC1(C2CCC1(C(=O)C2)C)C"),
    ("tetramethylsilane", "C[Si](C)(C)C"),
    ("hexamethyldisiloxane", "C[Si](C)(C)O[Si](C)(C)C"),
    ("dimethyl carbonate", "COC(=O)OC"),
    ("pyrrole", "C1=CNC=C1"),
    ("toluene diisocyanate-like", "CC1=C(C=C(C=C1)N=C=O)N=C=O"),
];

#[test]
fn a_structure_zoo_is_accounted_for_atom_by_atom() {
    let t0 = std::time::Instant::now();
    let mut n = 0;
    for (name, smi) in ZOO {
        let comps = reaction_chamber_engine::analytical::graph::Mol::components_from_smiles(smi).unwrap_or_else(|| panic!("{} not parsed", name));
        let g = &comps[0];
        let h_total: u32 = g.total_h();
        let c_total = g.atoms.iter().filter(|a| a.el == "C").count();
        let h1 = run(&[sp(name, smi, 4000.0)], Nucleus::H1, Solvent::Cdcl3, 64);
        let seen_h: f64 = analyte(&h1).iter().map(|s| s.integration).sum();
        // exchangeable protons may average with nothing else here, so they appear as their own lines; allow the noise to hide none
        assert!((seen_h - h_total as f64).abs() < 0.25, "{}: 1H integrals {:.2} vs {} H ({} signals)", name, seen_h, h_total, analyte(&h1).len());
        let c13 = run(&[sp(name, smi, 4000.0)], Nucleus::C13, Solvent::Cdcl3, 16384);
        let seen_c: u32 = analyte(&c13).iter().map(|s| s.nuclei).sum();
        // C-F coupling can split a carbon into lines below the noise: allow it only for fluorinated compounds
        if !smi.contains('F') {
            assert_eq!(seen_c as usize, c_total, "{}: 13C signals cover {} of {} carbons", name, seen_c, c_total);
        }
        n += 1;
    }
    eprintln!("{} structures, {:.1} ms each (1H + 13C)", n, t0.elapsed().as_secs_f64() * 1000.0 / n as f64);
}

#[test]
#[ignore]
fn print_some() {
    for (name, smi, solv) in [("caffeine", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", Solvent::Cdcl3), ("aspirin", "CC(=O)OC1=CC=CC=C1C(=O)O", Solvent::Cdcl3), ("paracetamol", "CC(=O)NC1=CC=C(C=C1)O", Solvent::Dmso), ("nicotine", "CN1CCCC1C2=CN=CC=C2", Solvent::Cdcl3), ("glucose", "C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O", Solvent::D2o), ("4-nitroaniline", "C1=CC(=CC=C1N)[N+](=O)[O-]", Solvent::Dmso)] {
        let s = run(&[sp(name, smi, 4000.0)], Nucleus::H1, solv, 16);
        eprintln!("== {} ({})", name, solv.name());
        for g in s.signals.iter().filter(|g| !g.solvent) {
            eprintln!("   {:>6.2} {:<6} J={:?} int {:.2}  {}", g.ppm, g.multiplicity, g.j_hz, g.integration, g.assignment);
        }
        let c = run(&[sp(name, smi, 4000.0)], Nucleus::C13, solv, 16384);
        eprintln!("   13C: {}", c.signals.iter().filter(|g| !g.solvent).map(|g| format!("{:.1}", g.ppm)).collect::<Vec<_>>().join(" "));
    }
}

/// Compounds the increments were NOT tuned on (CDCl3 literature values).
const H1_HOLDOUT: &[(&str, &[f64])] = &[
    ("CCC(=O)O", &[1.17, 2.38]),
    ("CCOC(=O)c1ccccc1", &[1.40, 4.38, 7.44, 7.55, 8.05]),
    ("Cc1ccc(cc1)[N+](=O)[O-]", &[2.46, 7.31, 8.11]),
    ("CN(C)C=O", &[2.88, 2.97, 8.02]),
    ("C1CCOC1", &[1.85, 3.76]),
    ("O=C1CCCCC1", &[1.8, 2.35]),
    ("CCCCBr", &[0.95, 1.45, 1.85, 3.41]),
    ("CCC(C)O", &[0.92, 1.18, 1.45, 3.7]),
    ("ClCc1ccccc1", &[4.58, 7.35]),
    ("C=CCO", &[4.1, 5.2, 5.3, 5.9]),
    ("C#Cc1ccccc1", &[3.06, 7.35, 7.5]),
    ("Nc1ccccc1", &[3.6, 6.65, 6.75, 7.15]),
    ("CCNCC", &[1.1, 2.65]),
    ("ClCC(C)=O", &[2.3, 4.1]),
    ("C1COCCO1", &[3.69]),
    ("Cc1cc(C)cc(C)c1", &[2.27, 6.78]),
];

const C13_HOLDOUT: &[(&str, &[f64])] = &[
    ("CCC(=O)O", &[8.9, 27.5, 181.0]),
    ("CCOC(=O)c1ccccc1", &[14.4, 61.0, 166.6, 130.6, 129.5, 128.3, 132.8]),
    ("C1CCOC1", &[25.8, 67.9]),
    ("O=C1CCCCC1", &[25.0, 27.1, 42.0, 211.5]),
    ("CCCCBr", &[13.2, 21.4, 33.3, 34.4]),
    ("CCC(C)O", &[10.0, 22.9, 32.0, 69.3]),
    ("CN(C)C=O", &[31.3, 36.4, 162.6]),
    ("Nc1ccccc1", &[146.5, 129.3, 118.6, 115.1]),
    ("ClCc1ccccc1", &[46.2, 137.5, 128.8, 128.6]),
    ("Cc1cc(C)cc(C)c1", &[21.2, 127.1, 137.7]),
    ("Cc1ccc(cc1)[N+](=O)[O-]", &[21.6, 147.0, 146.0, 129.8, 123.6]),
    ("C=CCO", &[63.6, 115.2, 137.0]),
    ("CCNCC", &[15.3, 44.1]),
    ("C#Cc1ccccc1", &[77.2, 83.5, 122.2, 128.3, 132.0]),
];

#[test]
fn held_out_compounds_predicted_without_tuning() {
    let (mae_h, nh) = compare(H1_HOLDOUT, Nucleus::H1, 16, 0.8);
    let (mae_c, nc) = compare(C13_HOLDOUT, Nucleus::C13, 4096, 12.0);
    eprintln!("HOLD-OUT: 1H MAE {:.3} ppm over {} shifts, 13C MAE {:.2} ppm over {} shifts", mae_h, nh, mae_c, nc);
    assert!(mae_h < 0.2, "1H hold-out mean error {}", mae_h);
    assert!(mae_c < 4.0, "13C hold-out mean error {}", mae_c);
}
