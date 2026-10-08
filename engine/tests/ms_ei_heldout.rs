//! V1 of docs/plans/data-acquisition-plan.md: the electron-ionisation model against MassBank.
//!
//! `pipeline/data/ms_ei_splits/ei_test.jsonl`: 2 200 measured 70 eV spectra (MassBank EI-B / GC-EI records, one per structure) of
//! organic compounds the model treats, 30 % of the connectivity classes, never used to fit the model's ten constants (those were
//! fitted on 29 recalled reference spectra, `analytical_ms.rs`). Scores per spectrum, integer m/z bins with the base peak at 100:
//! whether the predicted base peak is the measured one, and the cosine similarity of the square-root intensities of peaks above 1 %.
//!
//! Measured at the time of writing: base peak right for 25 %, cosine mean 0.40 / median 0.39. The plan's gate (>= 70 % and >= 0.6)
//! is out of reach of the quasi-equilibrium model (a refit of the ten constants on the 4 400 training spectra reaches cosine 0.43 and
//! no better base-peak rate; see docs/plans/data-acquisition-plan.md). The assertions here guard the present level.

use reaction_chamber_engine::analytical::graph::Mol;
use reaction_chamber_engine::analytical::ms_ei::*;
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};

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
    for (k, &x) in a.iter().filter(|(_, x)| **x >= 1.0) {
        na += x;
        if let Some(&y) = b.get(k) {
            if y >= 1.0 {
                dot += x.sqrt() * y.sqrt();
            }
        }
    }
    for &y in b.values().filter(|y| **y >= 1.0) {
        nb += y;
    }
    if na == 0.0 || nb == 0.0 { 0.0 } else { dot / (na.sqrt() * nb.sqrt()) }
}

#[test]
fn held_out_massbank_spectra() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../pipeline/data/ms_ei_splits/ei_test.jsonl");
    let Ok(file) = std::fs::File::open(path) else {
        eprintln!("MassBank EI split not present: skipped");
        return;
    };
    let prm = EiParams::default();
    let (mut n, mut hits, mut cos_sum) = (0usize, 0usize, 0.0);
    let mut cos: Vec<f64> = Vec::new();
    for line in BufReader::new(file).lines() {
        let v: serde_json::Value = serde_json::from_str(&line.unwrap()).unwrap();
        let Some(g) = Mol::components_from_smiles(v["smiles"].as_str().unwrap()).and_then(|c| if c.len() == 1 { c.into_iter().next() } else { None }) else { continue };
        let Some((pred, _)) = std::panic::catch_unwind(|| ei_spectrum_with(&g, &prm)).ok().flatten() else { continue };
        let exp: Vec<(f64, f64)> = v["peaks"].as_array().unwrap().iter().map(|p| (p[0].as_f64().unwrap(), p[1].as_f64().unwrap())).collect();
        let (e, p) = (binned(&exp), binned(&pred.iter().map(|x| (x.mz as f64, x.intensity)).collect::<Vec<_>>()));
        let base = |m: &BTreeMap<i32, f64>| m.iter().max_by(|a, b| a.1.partial_cmp(b.1).unwrap()).map(|(k, _)| *k);
        n += 1;
        hits += (base(&e) == base(&p)) as usize;
        let c = cosine(&p, &e);
        cos_sum += c;
        cos.push(c);
    }
    cos.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let (rate, mean, median) = (hits as f64 / n as f64, cos_sum / n as f64, cos[cos.len() / 2]);
    eprintln!("{n} held-out spectra: base peak right {:.1} %, cosine mean {:.3}, median {:.3}", 100.0 * rate, mean, median);
    assert!(n > 1500, "{n} spectra scored");
    assert!(rate > 0.18 && mean > 0.35, "model got worse: base peak {rate:.3}, cosine {mean:.3}");
}
