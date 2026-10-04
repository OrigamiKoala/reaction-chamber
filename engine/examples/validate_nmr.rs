//! Runs the NMR predictor over a set of experimental 13C spectra and prints error statistics per compound class.
//!
//! Input (JSON lines): {"id": "...", "smiles": "...", "c13": [shift, ...]} with one experimental shift per carbon atom.
//! Usage: cargo run --release --example validate_nmr -- <file.jsonl> [limit]
//!
//! The comparison is on sorted lists: each predicted signal is repeated for the carbons it stands for, both lists are
//! sorted and compared pairwise (assignments between equivalent-looking carbons are not needed). A molecule whose predicted
//! carbon count differs from the experimental count is reported separately, not scored.
//! Driven by `pipeline/validate_spectra.py`, which builds the input from NMRShiftDB2.

use reaction_chamber_engine::analytical::nmr::*;
use reaction_chamber_engine::smiles::parse;
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};

fn class_of(smiles: &str) -> &'static str {
    let Some(m) = parse(smiles).map(|m| m.aromatized()) else { return "unparsed" };
    let n = m.atoms.len();
    let el = |i: usize| m.atoms[i].element.as_str();
    let nb: Vec<Vec<(usize, f64)>> = (0..n).map(|i| m.neighbours(i)).collect();
    let has = |f: &dyn Fn(usize) -> bool| (0..n).any(|i| f(i));
    if has(&|i| el(i) == "C" && nb[i].iter().any(|&(j, b)| el(j) == "O" && (b - 2.0).abs() < 1e-9)) {
        return "carbonyl";
    }
    if has(&|i| el(i) == "N") {
        return "nitrogen";
    }
    if has(&|i| matches!(el(i), "F" | "Cl" | "Br" | "I")) {
        return "halide";
    }
    if has(&|i| el(i) == "S") {
        return "sulfur";
    }
    if has(&|i| el(i) == "O" && m.hydrogens(i) == 1) {
        return "alcohol/phenol";
    }
    if has(&|i| el(i) == "O") {
        return "ether";
    }
    if has(&|i| m.atoms[i].aromatic) {
        return "aromatic hydrocarbon";
    }
    if has(&|i| nb[i].iter().any(|&(_, b)| b > 1.4 && b != 1.5)) {
        return "alkene/alkyne";
    }
    "alkane"
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let path = args.get(1).expect("usage: validate_nmr <file.jsonl> [limit]");
    let limit: usize = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(usize::MAX);
    let file = std::fs::File::open(path).expect("input file");
    let mut by_class: BTreeMap<&'static str, Vec<f64>> = BTreeMap::new();
    let mut mol_mae: BTreeMap<&'static str, Vec<f64>> = BTreeMap::new();
    let (mut total, mut mismatched, mut failed) = (0usize, 0usize, 0usize);
    let mut worst: Vec<(f64, String, String)> = Vec::new();
    for line in BufReader::new(file).lines().take(limit) {
        let line = line.unwrap();
        if line.trim().is_empty() {
            continue;
        }
        let v: serde_json::Value = serde_json::from_str(&line).expect("json line");
        let (id, smiles) = (v["id"].as_str().unwrap_or("?").to_string(), v["smiles"].as_str().unwrap().to_string());
        let mut exp: Vec<f64> = v["c13"].as_array().unwrap().iter().filter_map(|x| x.as_f64()).collect();
        exp.sort_by(|a, b| a.partial_cmp(b).unwrap());
        total += 1;
        let species = [SampleSpecies { id: "x".into(), name: "x".into(), smiles: Some(smiles.clone()), formula: String::new(), charge: 0, conc_mm: 200.0 }];
        let spec = std::panic::catch_unwind(|| simulate(&species, Nucleus::C13, Solvent::Cdcl3, 4_000_000, 7, false));
        let Ok(spec) = spec else {
            failed += 1;
            continue;
        };
        let mut pred: Vec<f64> = Vec::new();
        for s in spec.signals.iter().filter(|s| !s.solvent) {
            for _ in 0..s.nuclei.max(1) {
                pred.push(s.ppm);
            }
        }
        pred.sort_by(|a, b| a.partial_cmp(b).unwrap());
        if pred.len() != exp.len() {
            mismatched += 1;
            continue;
        }
        let cls = class_of(&smiles);
        let errs: Vec<f64> = pred.iter().zip(&exp).map(|(p, e)| (p - e).abs()).collect();
        let mae = errs.iter().sum::<f64>() / errs.len() as f64;
        by_class.entry(cls).or_default().extend(errs.iter().copied());
        mol_mae.entry(cls).or_default().push(mae);
        worst.push((mae, id, smiles));
    }
    println!("{} molecules, {} scored, {} with a different carbon count, {} failed", total, total - mismatched - failed, mismatched, failed);
    println!("{:<22} {:>6} {:>8} {:>8} {:>8} {:>10}", "class", "mols", "MAE", "RMS", "median", "within 5ppm");
    let mut all: Vec<f64> = Vec::new();
    for (cls, errs) in &by_class {
        let mut s = errs.clone();
        s.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mae = s.iter().sum::<f64>() / s.len() as f64;
        let rms = (s.iter().map(|e| e * e).sum::<f64>() / s.len() as f64).sqrt();
        let within = s.iter().filter(|e| **e <= 5.0).count() as f64 / s.len() as f64;
        println!("{:<22} {:>6} {:>8.2} {:>8.2} {:>8.2} {:>9.1}%", cls, mol_mae[cls].len(), mae, rms, s[s.len() / 2], 100.0 * within);
        all.extend(errs.iter().copied());
    }
    if !all.is_empty() {
        all.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mae = all.iter().sum::<f64>() / all.len() as f64;
        let rms = (all.iter().map(|e| e * e).sum::<f64>() / all.len() as f64).sqrt();
        println!("{:<22} {:>6} {:>8.2} {:>8.2} {:>8.2} {:>9.1}%", "ALL", mol_mae.values().map(|v| v.len()).sum::<usize>(), mae, rms, all[all.len() / 2], 100.0 * all.iter().filter(|e| **e <= 5.0).count() as f64 / all.len() as f64);
    }
    worst.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    println!("worst molecules (mean abs error per carbon):");
    for (mae, id, smi) in worst.iter().take(8) {
        println!("  {:6.1}  {}  {}", mae, id, smi);
    }
}
