//! Builds the shipped environment tables (`data/nmr_hose_c13.json`, `data/nmr_hose_h1.json`) from experimental spectra.
//!
//! Usage: cargo run --release --example build_hose -- --c13 a.jsonl,b.jsonl --h1 c.jsonl,d.jsonl [--min-n 1,1,1,1,2,2]
//!        [--redundant 1.0] [--out data]
//!
//! The records are the ones `pipeline/db/parse_nmrshiftdb2.py` writes (NMRShiftDB2, experimental spectra only). The shipped tables
//! are built from every record (training, development and test splits); the held-out error of the method is measured with
//! `validate_nmr --train13 ... --train1 ...`, which builds the tables from the training files alone.

use reaction_chamber_engine::analytical::hose::*;
use std::collections::BTreeMap;

fn flag(args: &[String], name: &str) -> Option<String> {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned()
}

fn merged(paths: &str, kind: Kind) -> (Vec<reaction_chamber_engine::analytical::graph::Mol>, Vec<(usize, usize, f64)>) {
    let (mut mols, mut ex) = (Vec::new(), Vec::new());
    for p in paths.split(',') {
        let (m, e) = read_training(p, kind);
        let off = mols.len();
        mols.extend(m);
        ex.extend(e.into_iter().map(|(mi, a, x)| (mi + off, a, x)));
    }
    (mols, ex)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let parse_n = |s: String| -> Vec<u32> { s.split(',').filter_map(|x| x.parse().ok()).collect() };
    let min_n13 = parse_n(flag(&args, "--min-n").unwrap_or_else(|| "1,1,1,1,2,2".into()));
    let min_n1 = parse_n(flag(&args, "--min-n-h1").unwrap_or_else(|| "1,1,2,3,3,3".into()));
    let red: f64 = flag(&args, "--redundant").and_then(|x| x.parse().ok()).unwrap_or(1.0);
    let shrink: f64 = flag(&args, "--shrink").and_then(|x| x.parse().ok()).unwrap_or(4.0);
    let out = flag(&args, "--out").unwrap_or_else(|| "data".into());
    for (kind, name, decimals, file) in [(Kind::C13, "13C", 2, "nmr_hose_c13.json"), (Kind::H1, "1H", 3, "nmr_hose_h1.json")] {
        let Some(paths) = flag(&args, if kind == Kind::C13 { "--c13" } else { "--h1" }) else { continue };
        let (mols, triples) = merged(&paths, kind);
        let examples: Vec<Example> = triples.iter().map(|&(m, a, p)| Example { mol: &mols[m], atom: a, ppm: p, base: base_prediction(kind, &mols[m], a) }).collect();
        let t = build(&examples, name, "NMRShiftDB2 experimental spectra (https://nmrshiftdb2.sourceforge.io), environment-table means", if kind == Kind::C13 { min_n13.clone() } else { min_n1.clone() }, red, mols.len());
        let scale = 10f64.powi(decimals);
        let codes: BTreeMap<String, (f64, u32, f64)> = t.codes.iter().map(|(k, &(m, n, sd))| (k.clone(), ((m as f64 * scale).round() / scale, n, (sd as f64 * 100.0).round() / 100.0))).collect();
        let doc = serde_json::json!({
            "nucleus": t.nucleus, "source": t.source, "tier": t.tier,
            "n_training_molecules": t.n_training_molecules, "n_training_atoms": t.n_training_atoms,
            "min_n": t.min_n, "redundant_ppm": red, "shrink_k": shrink,
            "codes": codes,
        });
        let path = format!("{}/{}", out, file);
        std::fs::write(&path, serde_json::to_string(&doc).unwrap() + "\n").unwrap();
        println!("{}: {} environments from {} molecules / {} atoms -> {} ({} bytes)", name, t.codes.len(), mols.len(), examples.len(), path, std::fs::metadata(&path).unwrap().len());
    }
}
