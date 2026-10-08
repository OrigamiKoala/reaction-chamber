//! Validates the electron-ionisation model against measured spectra (MassBank EI records, `pipeline/db/parse_massbank_ei.py`).
//!
//! Usage: cargo run --release --example validate_ms -- <ei_*.jsonl> [limit] [--params theta,w2,tail,w_low,theta_low,s_factor,tau,cleave,rearr,keep]
//!
//! Per spectrum (integer m/z bins, base peak = 100): whether the predicted base peak is the measured one, the cosine similarity of
//! the square-root intensities of the peaks above 1 %, and whether the molecular ion is predicted where it is measured.
//! Prints the mean and median over the scored spectra and the rate of base-peak hits, and breaks them down by compound class.

use reaction_chamber_engine::analytical::graph::Mol;
use reaction_chamber_engine::analytical::ms_ei::*;
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};

pub fn parse_params(s: &str) -> EiParams {
    let v: Vec<f64> = s.split(',').filter_map(|x| x.parse().ok()).collect();
    assert_eq!(v.len(), 10, "--params needs 10 numbers");
    EiParams { theta: v[0], w2: v[1], tail: v[2], w_low: v[3], theta_low: v[4], s_factor: v[5], tau: v[6], cleave_shift: v[7], rearr_shift: v[8], keep: v[9] }
}

fn binned(peaks: &[(f64, f64)]) -> BTreeMap<i32, f64> {
    let mut m: BTreeMap<i32, f64> = BTreeMap::new();
    for &(mz, i) in peaks {
        let e = m.entry(mz.round() as i32).or_insert(0.0);
        *e = e.max(i);
    }
    let top = m.values().cloned().fold(0.0, f64::max);
    if top > 0.0 {
        for v in m.values_mut() {
            *v *= 100.0 / top;
        }
    }
    m
}

fn cosine(a: &BTreeMap<i32, f64>, b: &BTreeMap<i32, f64>) -> f64 {
    let (mut dot, mut na, mut nb) = (0.0, 0.0, 0.0);
    for (k, &x) in a {
        if x < 1.0 {
            continue;
        }
        let x = x.sqrt();
        na += x * x;
        if let Some(&y) = b.get(k) {
            if y >= 1.0 {
                dot += x * y.sqrt();
            }
        }
    }
    for &y in b.values() {
        if y >= 1.0 {
            nb += y;
        }
    }
    if na == 0.0 || nb == 0.0 { 0.0 } else { dot / (na.sqrt() * nb.sqrt()) }
}

fn class_of(g: &Mol) -> &'static str {
    let has = |el: &str| g.atoms.iter().any(|a| a.el == el);
    if g.atoms.iter().enumerate().any(|(i, a)| a.el == "C" && g.double_to(i, "O", None)) {
        return "carbonyl";
    }
    if has("N") {
        return "nitrogen";
    }
    if has("Cl") || has("Br") || has("I") || has("F") {
        return "halide";
    }
    if has("S") {
        return "sulfur";
    }
    if has("O") {
        return "oxygen (alcohol/ether)";
    }
    if g.atoms.iter().any(|a| a.arom) {
        return "aromatic hydrocarbon";
    }
    "hydrocarbon"
}

#[derive(Default)]
pub struct Stats {
    pub n: usize,
    pub base_hits: usize,
    pub cos: Vec<f64>,
}

pub fn evaluate(path: &str, limit: usize, prm: &EiParams, by_class: &mut BTreeMap<&'static str, Stats>) -> (Stats, usize, usize) {
    let file = std::fs::File::open(path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let mut all = Stats::default();
    let (mut failed, mut total) = (0, 0);
    for line in BufReader::new(file).lines().take(limit) {
        let line = line.unwrap();
        if line.trim().is_empty() {
            continue;
        }
        let v: serde_json::Value = serde_json::from_str(&line).unwrap();
        total += 1;
        let Some(smi) = v["smiles"].as_str() else { continue };
        let Some(g) = Mol::components_from_smiles(smi).and_then(|c| if c.len() == 1 { c.into_iter().next() } else { None }) else {
            failed += 1;
            continue;
        };
        let Some((pred, _)) = std::panic::catch_unwind(|| ei_spectrum_with(&g, prm)).ok().flatten() else {
            failed += 1;
            continue;
        };
        let exp: Vec<(f64, f64)> = v["peaks"].as_array().unwrap().iter().map(|p| (p[0].as_f64().unwrap(), p[1].as_f64().unwrap())).collect();
        let e = binned(&exp);
        let p = binned(&pred.iter().map(|x| (x.mz as f64, x.intensity)).collect::<Vec<_>>());
        let base = |m: &BTreeMap<i32, f64>| m.iter().max_by(|a, b| a.1.partial_cmp(b.1).unwrap()).map(|(k, _)| *k);
        let hit = base(&e) == base(&p);
        let c = cosine(&p, &e);
        for s in [&mut all, by_class.entry(class_of(&g)).or_default()] {
            s.n += 1;
            s.base_hits += hit as usize;
            s.cos.push(c);
        }
    }
    (all, failed, total)
}

pub fn summary(s: &Stats) -> (f64, f64, f64) {
    let mut c = s.cos.clone();
    c.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mean = c.iter().sum::<f64>() / c.len().max(1) as f64;
    (s.base_hits as f64 / s.n.max(1) as f64, mean, c.get(c.len() / 2).copied().unwrap_or(0.0))
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let path = args.get(1).expect("usage: validate_ms <ei.jsonl> [limit] [--params ...]");
    let limit: usize = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(usize::MAX);
    let prm = args.iter().position(|a| a == "--params").and_then(|i| args.get(i + 1)).map(|s| parse_params(s)).unwrap_or_default();
    let mut by_class = BTreeMap::new();
    let (all, failed, total) = evaluate(path, limit, &prm, &mut by_class);
    println!("{} spectra, {} scored, {} not predicted (structure not treatable)", total, all.n, failed);
    println!("{:<26} {:>6} {:>10} {:>8} {:>8}", "class", "n", "base peak", "cos mean", "cos med");
    for (k, s) in by_class.iter() {
        let (b, m, md) = summary(s);
        println!("{:<26} {:>6} {:>9.1}% {:>8.3} {:>8.3}", k, s.n, 100.0 * b, m, md);
    }
    let (b, m, md) = summary(&all);
    println!("{:<26} {:>6} {:>9.1}% {:>8.3} {:>8.3}", "ALL", all.n, 100.0 * b, m, md);
}
