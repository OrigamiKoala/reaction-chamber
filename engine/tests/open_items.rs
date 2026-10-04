//! Gates for the items of ALGORITHM-IMPROVEMENT.md section 6.4 closed in the third pass (K2, K3, ...).

use std::collections::HashMap;

use reaction_chamber_engine::kinetics::{KineticExtentReaction, KineticExtentSystem};
use reaction_chamber_engine::types::ProvenanceTier;

fn rxn(id: &str, from: usize, to: usize, k: f64) -> KineticExtentReaction {
    KineticExtentReaction {
        id: id.into(),
        equation: String::new(),
        reactants: vec![(from, 1.0)],
        products: vec![(to, 1.0)],
        gas_products: vec![],
        orders_reactants: vec![(from, 1.0)],
        orders_products: vec![],
        arrhenius_a: k,
        arrhenius_n: 0.0,
        arrhenius_ea: 0.0,
        delta_h_kj: 0.0,
        catalyst_species: None,
        is_reversible: false,
        k_eq_298: None,
        tier: ProvenanceTier::Tabulated,
        source: "test".into(),
    }
}

// ---------------------------------------------------------------- K2: error-controlled sub-steps

#[test]
fn k2_a_consecutive_chain_follows_the_analytic_solution_within_the_tolerance() {
    // A -k1-> B -k2-> C
    let (k1, k2) = (5.0_f64, 0.5_f64);
    let sys = KineticExtentSystem::new(vec!["A".into(), "B".into(), "C".into()], vec![rxn("ab", 0, 1, k1), rxn("bc", 1, 2, k2)]);
    let none = HashMap::new();
    let (xi, _, stats) = sys.integrate_extent_step_stats(&[1.0, 0.0, 0.0], 2.0, 1.0, 298.15, 101_325.0, 0.0, &none);
    let a = (-k1 * 2.0_f64).exp();
    let b = k1 / (k2 - k1) * ((-k1 * 2.0_f64).exp() - (-k2 * 2.0_f64).exp());
    let n_a = 1.0 - xi[0];
    let n_b = xi[0] - xi[1];
    assert!((n_a - a).abs() < 2e-5, "A: {} vs {}", n_a, a);
    assert!((n_b - b).abs() < 2e-5, "B: {} vs {}", n_b, b);
    assert!(stats.accepted >= 2, "the fast step needed refinement: {:?}", stats);
}

#[test]
fn k2_a_slow_reaction_takes_one_step_and_a_fast_one_is_refined() {
    let none = HashMap::new();
    let slow = KineticExtentSystem::new(vec!["A".into(), "B".into()], vec![rxn("ab", 0, 1, 1e-3)]);
    let (_, _, s) = slow.integrate_extent_step_stats(&[1.0, 0.0], 0.05, 1.0, 298.15, 101_325.0, 0.0, &none);
    assert_eq!(s.accepted, 1);
    assert_eq!(s.rejected, 0);
    let fast = KineticExtentSystem::new(vec!["A".into(), "B".into()], vec![rxn("ab", 0, 1, 40.0)]);
    let (xi, _, s) = fast.integrate_extent_step_stats(&[1.0, 0.0], 0.5, 1.0, 298.15, 101_325.0, 0.0, &none);
    assert!(s.accepted > 1, "{:?}", s);
    let exact = 1.0 - (-40.0_f64 * 0.5).exp();
    assert!((xi[0] - exact).abs() < 1e-5, "{} vs {}", xi[0], exact);
}

#[test]
fn k2_stiff_system_stays_stable_with_a_full_step() {
    // k = 1e6 s^-1 over 1 s: L-stability must land on the equilibrium without oscillating or going negative
    let sys = KineticExtentSystem::new(vec!["A".into(), "B".into()], vec![rxn("ab", 0, 1, 1e6)]);
    let none = HashMap::new();
    let (xi, _, _) = sys.integrate_extent_step_stats(&[1.0, 0.0], 1.0, 1.0, 298.15, 101_325.0, 0.0, &none);
    assert!((xi[0] - 1.0).abs() < 1e-6);
}

// ---------------------------------------------------------------- K3: sparse LU

fn ring_network(n_species: usize, n_rxn: usize) -> (KineticExtentSystem, Vec<f64>) {
    let names: Vec<String> = (0..n_species).map(|i| format!("S{}", i)).collect();
    let rs: Vec<KineticExtentReaction> = (0..n_rxn)
        .map(|r| {
            let from = r % n_species;
            let to = (r * 7 + 3) % n_species;
            let to = if to == from { (to + 1) % n_species } else { to };
            let mut x = rxn(&format!("r{}", r), from, to, 0.3 + (r % 11) as f64 * 0.2);
            x.is_reversible = true;
            x.k_eq_298 = Some(1.5 + (r % 5) as f64);
            x.orders_products = vec![(to, 1.0)];
            x
        })
        .collect();
    let init: Vec<f64> = (0..n_species).map(|i| 0.01 + 0.001 * (i % 13) as f64).collect();
    (KineticExtentSystem::new(names, rs), init)
}

#[test]
fn k3_five_hundred_reactions_step_in_under_ten_milliseconds() {
    let (sys, mut mol) = ring_network(300, 500);
    let none = HashMap::new();
    let before: f64 = mol.iter().sum();
    let t0 = std::time::Instant::now();
    let ticks = 20;
    for _ in 0..ticks {
        let (xi, _) = sys.integrate_extent_step(&mol, 0.05, 1.0, 298.15, 101_325.0, 0.0, &none);
        for (i, m) in mol.iter_mut().enumerate() {
            for (r, x) in xi.iter().enumerate() {
                *m += sys.nu[r][i] * x;
            }
        }
    }
    let per_tick_ms = t0.elapsed().as_secs_f64() * 1000.0 / ticks as f64;
    let after: f64 = mol.iter().sum();
    assert!((before - after).abs() < 1e-9, "mole count of isomerisations conserved");
    assert!(mol.iter().all(|m| *m >= -1e-12));
    assert!(per_tick_ms < 10.0, "500 reactions: {:.2} ms per tick", per_tick_ms);
}


// ---------------------------------------------------------------- E4: pKa from structure

use reaction_chamber_engine::pka_structure;

/// (name, SMILES, measured pKa at 25 C in water, tolerance)
const PKA_TABLE: &[(&str, &str, f64, f64)] = &[
    // aliphatic carboxylic acids
    ("formic", "OC=O", 3.75, 0.5),
    ("acetic", "CC(=O)O", 4.76, 0.5),
    ("propanoic", "CCC(=O)O", 4.87, 0.5),
    ("butanoic", "CCCC(=O)O", 4.82, 0.5),
    ("fluoroacetic", "FCC(=O)O", 2.59, 0.5),
    ("chloroacetic", "ClCC(=O)O", 2.87, 0.5),
    ("bromoacetic", "BrCC(=O)O", 2.90, 0.5),
    ("iodoacetic", "ICC(=O)O", 3.18, 0.5),
    ("dichloroacetic", "ClC(Cl)C(=O)O", 1.35, 0.5),
    ("trichloroacetic", "ClC(Cl)(Cl)C(=O)O", 0.65, 0.6),
    ("trifluoroacetic", "FC(F)(F)C(=O)O", 0.30, 0.8),
    ("glycolic", "OCC(=O)O", 3.83, 0.5),
    ("methoxyacetic", "COCC(=O)O", 3.57, 0.5),
    ("cyanoacetic", "N#CCC(=O)O", 2.47, 0.5),
    ("phenylacetic", "OC(=O)Cc1ccccc1", 4.31, 0.5),
    ("3-chloropropanoic", "ClCCC(=O)O", 3.98, 0.5),
    ("4-chlorobutanoic", "ClCCCC(=O)O", 4.52, 0.5),
    ("lactic", "CC(O)C(=O)O", 3.86, 0.5),
    ("acrylic", "C=CC(=O)O", 4.25, 0.5),
    ("glycine (COOH of the cation)", "[NH3+]CC(=O)O", 2.35, 0.5),
    // benzoic acids
    ("benzoic", "OC(=O)c1ccccc1", 4.20, 0.5),
    ("p-nitrobenzoic", "OC(=O)c1ccc(cc1)[N+](=O)[O-]", 3.44, 0.5),
    ("m-nitrobenzoic", "OC(=O)c1cccc(c1)[N+](=O)[O-]", 3.45, 0.5),
    ("p-chlorobenzoic", "OC(=O)c1ccc(Cl)cc1", 3.98, 0.5),
    ("m-chlorobenzoic", "OC(=O)c1cccc(Cl)c1", 3.83, 0.5),
    ("p-toluic", "OC(=O)c1ccc(C)cc1", 4.37, 0.5),
    ("p-anisic", "OC(=O)c1ccc(OC)cc1", 4.47, 0.5),
    ("p-aminobenzoic", "OC(=O)c1ccc(N)cc1", 4.85, 0.5),
    ("o-chlorobenzoic", "OC(=O)c1ccccc1Cl", 2.94, 0.5),
    ("o-nitrobenzoic", "OC(=O)c1ccccc1[N+](=O)[O-]", 2.17, 0.5),
    ("o-toluic", "OC(=O)c1ccccc1C", 3.91, 0.5),
    // phenols
    ("phenol", "Oc1ccccc1", 9.99, 0.5),
    ("p-nitrophenol", "Oc1ccc(cc1)[N+](=O)[O-]", 7.15, 0.5),
    ("m-nitrophenol", "Oc1cccc(c1)[N+](=O)[O-]", 8.36, 0.5),
    ("p-chlorophenol", "Oc1ccc(Cl)cc1", 9.41, 0.5),
    ("p-cresol", "Oc1ccc(C)cc1", 10.26, 0.5),
    ("p-cyanophenol", "Oc1ccc(C#N)cc1", 7.95, 0.5),
    ("2,4-dinitrophenol", "Oc1ccc(cc1[N+](=O)[O-])[N+](=O)[O-]", 4.11, 0.8),
    // amines (pKa of the conjugate acid)
    ("methylamine", "CN", 10.62, 0.5),
    ("ethylamine", "CCN", 10.65, 0.5),
    ("dimethylamine", "CNC", 10.73, 0.5),
    ("diethylamine", "CCNCC", 10.98, 0.5),
    ("trimethylamine", "CN(C)C", 9.80, 0.5),
    ("triethylamine", "CCN(CC)CC", 10.75, 0.8),
    ("ethanolamine", "NCCO", 9.50, 0.5),
    ("2-chloroethylamine", "NCCCl", 8.8, 0.6),
    ("trifluoroethylamine", "NCC(F)(F)F", 5.7, 0.8),
    ("aniline", "Nc1ccccc1", 4.60, 0.5),
    ("p-toluidine", "Nc1ccc(C)cc1", 5.08, 0.5),
    ("p-nitroaniline", "Nc1ccc(cc1)[N+](=O)[O-]", 1.0, 0.8),
    ("pyridine", "c1ccncc1", 5.23, 0.5),
    ("benzylamine", "NCc1ccccc1", 9.34, 0.6),
    ("imidazole", "c1c[nH]cn1", 6.95, 0.5),
    // alcohols and thiols
    ("methanol", "CO", 15.5, 0.6),
    ("ethanol", "CCO", 15.9, 0.6),
    ("trifluoroethanol", "OCC(F)(F)F", 12.4, 0.8),
    ("ethanethiol", "CCS", 10.6, 0.5),
    ("thiophenol", "Sc1ccccc1", 6.62, 0.5),
];

#[test]
fn e4_pka_from_structure_matches_measured_values() {
    let mut worst = 0.0_f64;
    let mut sum_abs = 0.0;
    let mut fails = Vec::new();
    for &(name, smi, exp, tol) in PKA_TABLE {
        let got = pka_structure::primary_pka(smi).unwrap_or(f64::NAN);
        let err = got - exp;
        eprintln!("{:<32} pred {:6.2} exp {:6.2} err {:+.2}", name, got, exp, err);
        sum_abs += err.abs();
        worst = worst.max(err.abs());
        if !(err.abs() <= tol) {
            fails.push(format!("{} {:.2} vs {:.2}", name, got, exp));
        }
    }
    eprintln!("mean abs error {:.2}, worst {:.2}", sum_abs / PKA_TABLE.len() as f64, worst);
    assert!(fails.is_empty(), "outside tolerance: {:?}", fails);
}

#[test]
fn e4_polyprotic_ladders() {
    // oxalic 1.25 / 4.27, malonic 2.83 / 5.69, succinic 4.21 / 5.64
    for (smi, p1, p2) in [("OC(=O)C(=O)O", 1.25, 4.27), ("OC(=O)CC(=O)O", 2.83, 5.69), ("OC(=O)CCC(=O)O", 4.21, 5.64)] {
        let (l, _) = pka_structure::acid_ladder(smi).unwrap();
        assert_eq!(l.len(), 2);
        eprintln!("{} ladder {:?} (exp {} / {})", smi, l, p1, p2);
        assert!((l[0] - p1).abs() < 0.8 && (l[1] - p2).abs() < 0.9, "{} {:?}", smi, l);
    }
}

/// Compounds that were not looked at while the class constants were chosen.
const PKA_HELD_OUT: &[(&str, &str, f64)] = &[
    ("2-chloropropanoic", "CC(Cl)C(=O)O", 2.83),
    ("pyruvic", "CC(=O)C(=O)O", 2.50),
    ("4-nitrophenylacetic", "OC(=O)Cc1ccc(cc1)[N+](=O)[O-]", 3.85),
    ("m-bromobenzoic", "OC(=O)c1cccc(Br)c1", 3.81),
    ("p-bromophenol", "Oc1ccc(Br)cc1", 9.34),
    ("m-chlorophenol", "Oc1cccc(Cl)c1", 9.12),
    ("propylamine", "CCCN", 10.57),
    ("isopropylamine", "CC(C)N", 10.63),
    ("2-chloroethanol", "OCCCl", 14.3),
    ("m-nitroaniline", "Nc1cccc(c1)[N+](=O)[O-]", 2.47),
    ("4-methylpyridine", "Cc1ccncc1", 6.0),
    ("3-chloropyridine", "Clc1cccnc1", 2.84),
];

#[test]
fn e4_held_out_pka_error_is_reported_and_bounded() {
    let mut sum = 0.0;
    for &(name, smi, exp) in PKA_HELD_OUT {
        let got = pka_structure::primary_pka(smi).unwrap();
        eprintln!("held-out {:<24} pred {:6.2} exp {:6.2} err {:+.2}", name, got, exp, got - exp);
        sum += (got - exp).abs();
        assert!((got - exp).abs() < 1.0, "{} {:.2} vs {:.2}", name, got, exp);
    }
    assert!((sum / PKA_HELD_OUT.len() as f64) < 0.45, "mean abs held-out error {:.2}", sum / PKA_HELD_OUT.len() as f64);
}

// ---------------------------------------------------------------- T2 / T3 / T5: thermodynamic estimators

use reaction_chamber_engine::db::{Datum, PhaseData, PhaseThermo, SpeciesRecord, SpeciesStore};
use reaction_chamber_engine::thermo::functions::{try_ln_k_equilibrium, try_thermo_state};

fn bare_record(id: &str, formula: &str, charge: i32, phase: &str, dfh: f64, dfg: Option<f64>, cp: Option<f64>) -> SpeciesRecord {
    let mut rec: SpeciesRecord = serde_json::from_value(serde_json::json!({
        "id": id,
        "identity": { "formula": formula, "charge": charge, "names": [id] }
    }))
    .unwrap();
    let mut th = PhaseThermo::default();
    th.model = "point+cp".into();
    th.tier = ProvenanceTier::Tabulated;
    th.source = "test".into();
    th.dfH = Some(Datum::new(dfh, "kJ/mol", ProvenanceTier::Tabulated, "test"));
    th.dfG = dfg.map(|g| Datum::new(g, "kJ/mol", ProvenanceTier::Tabulated, "test"));
    th.cp = cp.map(|c| Datum::new(c, "J/(mol K)", ProvenanceTier::Tabulated, "test"));
    rec.phases.insert(phase.into(), PhaseData { thermo: Some(th), ..Default::default() });
    rec
}

#[test]
fn t2_cp_of_temperature_moves_the_decomposition_pressure_of_calcite_toward_the_measured_one() {
    use std::collections::HashMap;
    // CaCO3(s) -> CaO(s) + CO2(g): with the tabulated Shomate data (seeded) the CO2 equilibrium pressure at 1100 K is the
    // reference; the same reaction from point data + Cp(298) only (Einstein solids, constant gas Cp)
    let r: HashMap<String, f64> = [("CaCO3(s)".to_string(), 1.0)].into();
    let p: HashMap<String, f64> = [("CaO(s)".to_string(), 1.0), ("CO2(g)".to_string(), 1.0)].into();
    let ln_k_ref = try_ln_k_equilibrium(&r, &p, 1100.0, 101_325.0).unwrap();
    let p_ref_atm = (ln_k_ref.exp()) * 1.0e5 / 101_325.0;
    eprintln!("Shomate: p(CO2) at 1100 K = {:.3} atm", p_ref_atm);
    assert!(p_ref_atm > 0.1 && p_ref_atm < 1.0, "calcite decomposes near 1170 K at 1 atm: {}", p_ref_atm);

    {
        let g = SpeciesStore::global();
        let mut st = g.write().unwrap();
        st.register(bare_record("EST_CaCO3(s)", "CaCO3", 0, "s", -1207.6, Some(-1128.8), Some(81.9)));
        st.register(bare_record("EST_CaO(s)", "CaO", 0, "s", -634.9, Some(-603.3), Some(42.8)));
        st.register(bare_record("EST_CO2(g)", "CO2", 0, "g", -393.51, Some(-394.39), Some(37.1)));
    }
    let r2: HashMap<String, f64> = [("EST_CaCO3(s)".to_string(), 1.0)].into();
    let p2: HashMap<String, f64> = [("EST_CaO(s)".to_string(), 1.0), ("EST_CO2(g)".to_string(), 1.0)].into();
    let ln_k_est = try_ln_k_equilibrium(&r2, &p2, 1100.0, 101_325.0).unwrap();
    // constant Cp (the old model) for comparison: van 't Hoff with dH(298), dS(298)
    let dh = (-634.9 - 393.51 + 1207.6) * 1000.0;
    let dg = (-603.3 - 394.39 + 1128.8) * 1000.0;
    let ds = (dh - dg) / 298.15;
    let ln_k_const = -(dh - 1100.0 * ds) / (8.314462618 * 1100.0);
    eprintln!("ln K: shomate {:.3}, einstein+const-gas {:.3}, constant-dH {:.3}", ln_k_ref, ln_k_est, ln_k_const);
    // within a factor 2 of the reference pressure (the audit gate)
    assert!((ln_k_est - ln_k_ref).abs() < 2.0_f64.ln(), "estimated-Cp pressure off by a factor {:.2}", (ln_k_est - ln_k_ref).abs().exp());
    let cp_gas_hot = try_thermo_state("EST_CO2(g)", "g", 1100.0, 101_325.0).unwrap().cp_j_mol_k;
    assert!(cp_gas_hot > 48.0 && cp_gas_hot < 60.0, "CO2 Cp at 1100 K from the Einstein-gas model: {} (JANAF 54.3)", cp_gas_hot);
    let st = try_thermo_state("EST_CaCO3(s)", "s", 1100.0, 101_325.0).unwrap();
    assert!(st.cp_j_mol_k > 100.0 && st.cp_j_mol_k < 3.0 * 8.314 * 5.0 + 1e-6, "Einstein Cp at 1100 K: {}", st.cp_j_mol_k);
}

#[test]
fn t3_missing_entropy_of_ions_and_solids_is_estimated_and_labelled() {
    {
        let g = SpeciesStore::global();
        let mut st = g.write().unwrap();
        // Na+ and Cl- with only their enthalpies of formation
        st.register(bare_record("EST_Na+", "Na+", 1, "aq", -240.34, None, None));
        st.register(bare_record("EST_Cl-", "Cl-", -1, "aq", -167.16, None, None));
        st.register(bare_record("EST_NaCl(s)", "NaCl", 0, "s", -411.15, None, Some(50.5)));
    }
    let na = try_thermo_state("EST_Na+", "aq", 298.15, 101_325.0).unwrap();
    let cl = try_thermo_state("EST_Cl-", "aq", 298.15, 101_325.0).unwrap();
    let nacl = try_thermo_state("EST_NaCl(s)", "s", 298.15, 101_325.0).unwrap();
    assert_eq!(na.tier, ProvenanceTier::Estimated);
    // dfG from the estimated entropy: tabulated dfG(Na+) = -261.9, dfG(Cl-) = -131.2, dfG(NaCl,s) = -384.1 kJ/mol
    let dfg = |s: &reaction_chamber_engine::thermo::ThermoState, dfh: f64| dfh - 298.15 * s.s_j_mol_k / 1000.0;
    eprintln!("dfG Na+ {:.1} (-261.9)  Cl- {:.1} (-131.2)  NaCl(s) {:.1} (-384.1)", dfg(&na, -240.34), dfg(&cl, -167.16), dfg(&nacl, -411.15));
    assert!((dfg(&na, -240.34) + 261.9).abs() < 8.0);
    assert!((dfg(&cl, -167.16) + 131.2).abs() < 8.0);
    assert!((dfg(&nacl, -411.15) + 384.1).abs() < 12.0);
}

#[test]
fn t5_anion_and_ammonium_formation_data_come_from_the_conjugate_partner_and_its_pka() {
    {
        let g = SpeciesStore::global();
        let mut st = g.write().unwrap();
        // propanoic acid (aq) with tabulated data; its anion and a protonated amine have only an identity
        st.register(bare_record("EST_C3H6O2", "C3H6O2", 0, "aq", -510.4, Some(-383.5), Some(145.0)));
        let mut acid = st.get("EST_C3H6O2").unwrap().clone();
        acid.identity.smiles = Some("CCC(=O)O".into());
        st.register(acid);
        let mut anion = bare_record("EST_C3H5O2-", "C3H5O2-", -1, "aq", 0.0, None, None);
        anion.phases.clear();
        anion.identity.smiles = Some("CCC(=O)[O-]".into());
        st.register(anion);
        st.register(bare_record("EST_CH5N", "CH5N", 0, "aq", -70.0, Some(-39.0), Some(150.0)));
        let mut ammonium = bare_record("EST_CH6N+", "CH6N+", 1, "aq", 0.0, None, None);
        ammonium.phases.clear();
        ammonium.identity.smiles = Some("C[NH3+]".into());
        st.register(ammonium);
    }
    let a = try_thermo_state("EST_C3H5O2-", "aq", 298.15, 101_325.0).expect("anion from the cycle");
    assert_eq!(a.tier, ProvenanceTier::Estimated);
    let ha = try_thermo_state("EST_C3H6O2", "aq", 298.15, 101_325.0).unwrap();
    // mu0(A-) - mu0(HA) = RT ln 10 pKa, pKa(propanoic) = 4.87 (estimated within 0.3)
    let pka = (a.mu0_j_mol - ha.mu0_j_mol) / (8.314462618 * 298.15 * std::f64::consts::LN_10);
    eprintln!("cycle pKa propanoate {:.2}", pka);
    assert!((pka - 4.87).abs() < 0.3);
    let bh = try_thermo_state("EST_CH6N+", "aq", 298.15, 101_325.0).expect("ammonium from the cycle");
    let b = try_thermo_state("EST_CH5N", "aq", 298.15, 101_325.0).unwrap();
    let pka_n = (b.mu0_j_mol - bh.mu0_j_mol) / (8.314462618 * 298.15 * std::f64::consts::LN_10);
    eprintln!("cycle pKa methylammonium {:.2}", pka_n);
    assert!((pka_n - 10.62).abs() < 0.3);
}


// ---------------------------------------------------------------- E1: one concentration basis (molality)

#[test]
fn e1_kinetic_equilibrium_is_the_molal_k_converted_with_the_solvent_density() {
    // A + B <=> C, K = 10 (molal basis); 0.9 kg of solvent per litre of solution: K_c = K_m rho^(-1)
    let mut r = rxn("abc", 0, 2, 2.0);
    r.reactants = vec![(0, 1.0), (1, 1.0)];
    r.orders_reactants = vec![(0, 1.0), (1, 1.0)];
    r.orders_products = vec![(2, 1.0)];
    r.is_reversible = true;
    r.k_eq_298 = Some(10.0);
    let run = |rho: f64| {
        let mut sys = KineticExtentSystem::new(vec!["A".into(), "B".into(), "C".into()], vec![r.clone()]);
        sys.solvent_kg_per_l = rho;
        let none = HashMap::new();
        let mut mol = vec![0.05, 0.05, 0.0];
        for _ in 0..4000 {
            let (xi, _) = sys.integrate_extent_step(&mol, 0.5, 1.0, 298.15, 101_325.0, 0.0, &none);
            mol[0] -= xi[0];
            mol[1] -= xi[0];
            mol[2] += xi[0];
        }
        mol[2] / (mol[0] * mol[1])
    };
    let q1 = run(1.0);
    let q9 = run(0.9);
    assert!((q1 - 10.0).abs() < 0.05, "{}", q1);
    assert!((q9 - 10.0 / 0.9).abs() < 0.06, "{} vs {}", q9, 10.0 / 0.9);
}

// ---------------------------------------------------------------- E2 / E3: ion pairing, Ksp estimates

use reaction_chamber_engine::vessel::{Vessel, VesselConfig};

fn beaker_at(t: f64) -> Vessel {
    Vessel::new(VesselConfig {
        vessel_type: "beaker-250".into(),
        capacity_ml: 250.0,
        glass_mass_g: 110.0,
        inner_radius_cm: 3.5,
        temperature_k: Some(t),
        room_k: Some(t),
        sealed: Some(false),
        stopper_pop_atm: Some(1.0e4),
        burst_atm: Some(1.0e4),
    })
}

fn settle(v: &mut Vessel, s: f64) {
    for _ in 0..(s / 0.5) as usize {
        v.step(0.5).unwrap();
    }
}

fn species(v: &Vessel, sp: &str) -> f64 {
    v.species_mol.get(sp).copied().unwrap_or(0.0)
}

#[test]
fn e2_divalent_sulfate_ion_pairs_form_and_conserve_the_metal() {
    let mut v = beaker_at(298.15);
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    v.species_mol.insert("Mg+2".into(), 0.01);
    v.species_mol.insert("SO4-2".into(), 0.01);
    settle(&mut v, 20.0);
    let pair = species(&v, "MgSO4");
    let free = species(&v, "Mg+2");
    eprintln!("0.1 m MgSO4: free Mg {:.4} mol, pair {:.4} mol", free, pair);
    assert!(pair > 0.002, "a divalent sulfate pairs at 0.1 M: {}", pair);
    assert!(pair / (pair + free) < 0.8);
    assert!((pair + free - 0.01).abs() < 1e-6, "metal conserved");
    // sodium chloride does not pair at all
    let mut w = beaker_at(298.15);
    w.species_mol.insert("H2O".into(), 100.0 / 18.015);
    w.species_mol.insert("Na+".into(), 0.01);
    w.species_mol.insert("Cl-".into(), 0.01);
    settle(&mut w, 10.0);
    assert!(species(&w, "NaCl") < 1e-12);
}

#[test]
fn e2_ion_pairing_raises_the_dissolved_calcium_of_a_saturated_sulfate_solution() {
    // CaSO4(s) in 100 mL water: the free-ion solubility product limits the *free* ions; the CaSO4(aq) pair adds to the
    // dissolved calcium (experimental solubility of gypsum / anhydrite: 15-30 mM)
    let mut v = beaker_at(298.15);
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    v.solid_mol.insert("CaSO4(s)".into(), 0.02);
    settle(&mut v, 400.0);
    let free = species(&v, "Ca+2");
    let pair = species(&v, "CaSO4");
    let total_m = (free + pair) / 0.1;
    eprintln!("CaSO4 saturated: free {:.4} mol, pair {:.4} mol, total {:.1} mM", free, pair, total_m * 1000.0);
    assert!(pair > 0.25 * (free + pair) * 0.5);
    assert!(total_m > 0.015 && total_m < 0.035, "dissolved calcium {:.1} mM", total_m * 1000.0);
}

#[test]
fn e2_complexation_rows_register_when_metal_and_ligand_meet() {
    let mut v = beaker_at(298.15);
    v.species_mol.insert("H2O".into(), 100.0 / 18.015);
    v.species_mol.insert("Hg+2".into(), 0.001);
    v.species_mol.insert("Na+".into(), 0.018);
    v.species_mol.insert("Cl-".into(), 0.020);
    settle(&mut v, 20.0);
    // HgCl2 dominates in chloride solution (log beta2 = 14.0)
    let hgcl2 = species(&v, "HgCl2");
    eprintln!("HgCl2 {:.6} of 0.001", hgcl2);
    let complexed: f64 = ["HgCl+", "HgCl2", "HgCl3-", "HgCl4-2"].iter().map(|s| species(&v, s)).sum();
    assert!(hgcl2 > 1e-4 && complexed > 0.0005, "chloro complexes carry the mercury: {} / {}", hgcl2, complexed);
    assert!(species(&v, "Hg+2") < 1e-10, "no free Hg2+ in chloride");
    let total: f64 = ["Hg+2", "HgCl+", "HgCl2", "HgCl3-", "HgCl4-2"].iter().map(|s| species(&v, s)).sum();
    let solid: f64 = v.solid_mol.iter().filter(|(k, _)| k.starts_with("Hg")).map(|(_, m)| *m).sum();
    assert!((total + solid - 0.001).abs() < 1e-6, "mercury conserved: {} + solid {}", total, solid);
}

#[test]
fn e3_unlisted_pairs_get_a_data_fitted_estimate_and_unknown_ions_fall_back_to_the_rule() {
    use reaction_chamber_engine::solubility::mineral_for_pair;
    let m = mineral_for_pair("Cd+2", "SO3-2").expect("insoluble by the rules");
    eprintln!("CdSO3: log Ksp {:.1} ({})", m.log_ksp_298, m.source);
    assert!(m.source.contains("Pair-additive"));
    assert_eq!(m.tier, ProvenanceTier::Speculative);
    assert!(m.log_ksp_298 < -1.0 && m.log_ksp_298 > -25.0);
    // an ion the table has never seen: the charge rule
    let m2 = mineral_for_pair("Eu+3", "CO3-2");
    if let Some(m2) = m2 {
        assert!(m2.source.contains("rules"), "{}", m2.source);
    }
}
