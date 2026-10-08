//! Environment-code shift prediction (the HOSE-code idea of NMRShiftDB / SPECTRUS / ACD databases) trained on experimental
//! spectra.
//!
//! Every carbon (13C) or carbon-bound hydrogen group (1H) is described by its *environment*: the tree of heavy atoms around
//! it out to radius r (element, aromatic flag, hydrogen count, charge of every atom and the bond to its parent), written as a
//! canonical string (children sorted) and hashed. The table maps (radius, hash) to the mean, count and standard deviation of the
//! *residuals* of the increment models (`nmr_shift.rs`) that carbons of that environment have in the training spectra
//! (`data/nmr_hose_c13.json`, `data/nmr_hose_h1.json`, built by `engine/examples/build_hose.rs` from the NMRShiftDB2 records
//! that `pipeline/db/parse_nmrshiftdb2.py` reads): shift = increment prediction + mean residual of the environment. The
//! increments carry the physics of substituent effects over any distance; the table corrects what they get systematically wrong
//! in each local environment, so a coarse environment (little data, small radius) still returns a sensible number.
//! A prediction takes the largest radius whose environment was seen at least `min_n[r]` times; an environment the table does
//! not know leaves the increment prediction untouched (`predict` returns None).
//!
//! The same code builds the table and reads it, so the environment strings cannot drift apart.

use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

use serde::{Deserialize, Serialize};

use crate::analytical::graph::Mol;

/// Largest radius of the environment tree.
pub const MAX_RADIUS: usize = 5;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Kind {
    C13,
    H1,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HoseTable {
    pub nucleus: String,
    pub source: String,
    pub tier: String,
    pub n_training_molecules: usize,
    pub n_training_atoms: usize,
    /// minimum number of training examples of an environment of radius r (index r) for it to be used
    pub min_n: Vec<u32>,
    /// Shrinkage of a radius towards the residual of the radius below it: res_r = (n mean_r + K res_(r-1)) / (n + K)
    #[serde(default)]
    pub shrink_k: f64,
    /// "r:hash(hex)" -> [mean residual of the increment model in ppm, count, standard deviation of the residual]
    pub codes: HashMap<String, (f32, u32, f32)>,
    #[serde(skip)]
    index: HashMap<(u8, u64), (f32, u32, f32)>,
}

impl HoseTable {
    pub fn finish(mut self) -> Self {
        self.index = self
            .codes
            .iter()
            .filter_map(|(k, v)| {
                let (r, h) = k.split_once(':')?;
                Some(((r.parse::<u8>().ok()?, u64::from_str_radix(h, 16).ok()?), *v))
            })
            .collect();
        self
    }

    /// (residual of the increment model in ppm, radius, count, sd) of atom `i`: the means of the environments of growing radius
    /// are combined from the smallest outwards, each shrunk towards the one below it by `shrink_k` pseudo-observations, so an
    /// environment seen twice moves the estimate a little, one seen hundreds of times decides it. None when not even radius 0 is known.
    pub fn predict(&self, g: &Mol, i: usize) -> Option<(f64, usize, u32, f64)> {
        let mut out: Option<(f64, usize, u32, f64)> = None;
        let mut res = 0.0;
        for r in 0..=MAX_RADIUS {
            let h = env_hash(g, i, r);
            if let Some(&(mean, n, sd)) = self.index.get(&(r as u8, h)) {
                if n >= self.min_n.get(r).copied().unwrap_or(1) {
                    res = (n as f64 * mean as f64 + self.shrink_k * res) / (n as f64 + self.shrink_k);
                    out = Some((res, r, n, sd as f64));
                }
            }
        }
        out
    }
}

fn fnv(s: &str, r: usize) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325 ^ (r as u64).wrapping_mul(0x100000001b3);
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn describe(g: &Mol, i: usize) -> String {
    let a = &g.atoms[i];
    let mut s = String::with_capacity(8);
    s.push_str(&a.el);
    if a.arom {
        s.push('a');
    }
    if a.h > 0 {
        s.push('H');
        s.push_str(&a.h.to_string());
    }
    match a.charge {
        0 => {}
        c if c > 0 => s.push_str(&format!("+{c}")),
        c => s.push_str(&format!("{c}")),
    }
    s
}

fn bond_symbol(o: f64) -> char {
    if (o - 1.5).abs() < 1e-9 {
        ':'
    } else if (o - 2.0).abs() < 1e-9 {
        '='
    } else if (o - 3.0).abs() < 1e-9 {
        '#'
    } else {
        '-'
    }
}

fn shell(g: &Mol, atom: usize, depth: usize, path: &mut Vec<usize>) -> String {
    let mut s = describe(g, atom);
    if depth == 0 {
        return s;
    }
    path.push(atom);
    let mut kids: Vec<String> = Vec::new();
    for &(j, o) in &g.adj[atom] {
        if path.contains(&j) {
            // a ring closure: the atom is already on the path; it is written as a label, not expanded
            if path.len() >= 2 && j != path[path.len() - 2] {
                kids.push(format!("{}@{}", bond_symbol(o), g.atoms[j].el));
            }
            continue;
        }
        kids.push(format!("{}{}", bond_symbol(o), shell(g, j, depth - 1, path)));
    }
    path.pop();
    if !kids.is_empty() {
        kids.sort();
        s.push('(');
        s.push_str(&kids.join(","));
        s.push(')');
    }
    s
}

/// Hash of the radius-r environment tree of atom `i`.
pub fn env_hash(g: &Mol, i: usize, r: usize) -> u64 {
    let mut path = Vec::new();
    fnv(&shell(g, i, r, &mut path), r)
}

/// One training example: the molecule graph, the atom, the measured shift and the increment model's prediction for it
/// (the table learns the difference).
pub struct Example<'a> {
    pub mol: &'a Mol,
    pub atom: usize,
    pub ppm: f64,
    pub base: f64,
}

/// Builds the table from examples (mean / count / sd of every environment of radius 0..=MAX_RADIUS), then drops entries that
/// tell nothing beyond their parent: a singleton or pair whose mean is within `redundant_ppm` of the next smaller radius.
pub fn build(examples: &[Example], nucleus: &str, source: &str, min_n: Vec<u32>, redundant_ppm: f64, n_molecules: usize) -> HoseTable {
    // Welford accumulation: (n, mean, m2)
    let mut acc: HashMap<(u8, u64), (u32, f64, f64)> = HashMap::new();
    for ex in examples {
        for r in 0..=MAX_RADIUS {
            let e = acc.entry((r as u8, env_hash(ex.mol, ex.atom, r))).or_insert((0, 0.0, 0.0));
            e.0 += 1;
            let y = ex.ppm - ex.base;
            let d = y - e.1;
            e.1 += d / e.0 as f64;
            e.2 += d * (y - e.1);
        }
    }
    // prune: walk the examples again to know each environment's parent
    let mut parent: HashMap<(u8, u64), (u8, u64)> = HashMap::new();
    for ex in examples {
        for r in 1..=MAX_RADIUS {
            parent.entry((r as u8, env_hash(ex.mol, ex.atom, r))).or_insert((r as u8 - 1, env_hash(ex.mol, ex.atom, r - 1)));
        }
    }
    let mut codes = HashMap::new();
    for (&(r, h), &(n, mean, m2)) in &acc {
        if r >= 1 && n < min_n.get(r as usize).copied().unwrap_or(1) {
            continue;
        }
        if r >= 1 && n <= 3 {
            if let Some(p) = parent.get(&(r, h)).and_then(|p| acc.get(p)) {
                if (p.1 - mean).abs() < redundant_ppm {
                    continue;
                }
            }
        }
        let sd = if n > 1 { (m2 / (n - 1) as f64).sqrt() } else { 0.0 };
        codes.insert(format!("{}:{:x}", r, h), (mean as f32, n, sd as f32));
    }
    HoseTable {
        nucleus: nucleus.to_string(),
        source: source.to_string(),
        tier: "Tabulated".into(),
        n_training_molecules: n_molecules,
        n_training_atoms: examples.len(),
        min_n,
        shrink_k: 0.0,
        codes,
        index: HashMap::new(),
    }
    .finish()
}

// ------------------------------------------------------------------------------------------------ the shipped tables

fn load(json: &str) -> Option<HoseTable> {
    let t: HoseTable = serde_json::from_str(json).ok()?;
    if t.codes.is_empty() {
        return None;
    }
    Some(t.finish())
}

static C13: OnceLock<Option<HoseTable>> = OnceLock::new();
static H1: OnceLock<Option<HoseTable>> = OnceLock::new();
static OVERRIDE: RwLock<Option<(HoseTable, HoseTable)>> = RwLock::new(None);

/// Replaces the shipped tables (validation: a table built from the training split alone); `None` restores them.
pub fn set_override(t: Option<(HoseTable, HoseTable)>) {
    *OVERRIDE.write().unwrap() = t;
}

/// Disables the table lookups (validation of the increment models alone).
static DISABLED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
pub fn set_disabled(d: bool) {
    DISABLED.store(d, std::sync::atomic::Ordering::Relaxed);
}

/// The table's correction for atom `i` of `g`: (residual of the increment model in ppm, radius, count, sd), or None when no environment was seen often enough.
pub fn predict(kind: Kind, g: &Mol, i: usize) -> Option<(f64, usize, u32, f64)> {
    if DISABLED.load(std::sync::atomic::Ordering::Relaxed) {
        return None;
    }
    if let Some((c, h)) = OVERRIDE.read().unwrap().as_ref() {
        return match kind {
            Kind::C13 => c.predict(g, i),
            Kind::H1 => h.predict(g, i),
        };
    }
    let table = match kind {
        Kind::C13 => C13.get_or_init(|| load(include_str!("../../data/nmr_hose_c13.json"))),
        Kind::H1 => H1.get_or_init(|| load(include_str!("../../data/nmr_hose_h1.json"))),
    };
    table.as_ref().and_then(|t| t.predict(g, i))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mol(smi: &str) -> Mol {
        Mol::components_from_smiles(smi).unwrap().remove(0)
    }

    #[test]
    fn equivalent_atoms_have_the_same_environment_and_different_ones_do_not() {
        let g = mol("CCO");
        // the two carbons differ at radius 0 already (H count) ...
        assert_ne!(env_hash(&g, 0, 2), env_hash(&g, 1, 2));
        let h = mol("CC(C)C");
        assert_eq!(env_hash(&h, 0, 3), env_hash(&h, 2, 3), "the two methyls of isobutane are equivalent");
        // the environment does not depend on the atom order of the SMILES
        let a = mol("OCC");
        assert_eq!(env_hash(&g, 1, 3), env_hash(&a, 1, 3));
        assert_eq!(env_hash(&g, 0, 3), env_hash(&a, 2, 3));
    }

    #[test]
    fn the_radius_separates_what_it_should() {
        let a = mol("CCCC(=O)O");
        let b = mol("CCCCCO");
        // the CH2 next to the methyl looks the same out to radius 1 but not beyond
        assert_eq!(env_hash(&a, 1, 1), env_hash(&b, 1, 1));
        assert_ne!(env_hash(&a, 1, 4), env_hash(&b, 1, 4));
    }
}

// ------------------------------------------------------------------------------------------------ training data

/// Reads training records (JSON lines of `pipeline/db/parse_nmrshiftdb2.py`) into molecule graphs and (molecule, atom, ppm)
/// triples. 13C: `c13_by_atom` is [heavy-atom position, shift] of every assigned carbon; 1H: `h1_by_atom` is [heavy-atom position, [shift per H]], the
/// target being the mean over the hydrogens of the carbon. Records whose carbon count disagrees with the parsed graph are skipped.
pub fn read_training(path: &str, kind: Kind) -> (Vec<Mol>, Vec<(usize, usize, f64)>) {
    use std::io::{BufRead, BufReader};
    let file = std::fs::File::open(path).unwrap_or_else(|e| panic!("{path}: {e}"));
    let mut mols = Vec::new();
    let mut ex = Vec::new();
    for line in BufReader::new(file).lines() {
        let line = line.unwrap();
        if line.trim().is_empty() {
            continue;
        }
        let v: serde_json::Value = serde_json::from_str(&line).unwrap();
        let Some(smi) = v["smiles"].as_str() else { continue };
        let Some(comps) = Mol::components_from_smiles(smi) else { continue };
        if comps.len() != 1 {
            continue;
        }
        let g = comps.into_iter().next().unwrap();
        let mi = mols.len();
        match kind {
            Kind::C13 => {
                let Some(arr) = v["c13_by_atom"].as_array() else { continue };
                for item in arr {
                    let pos = item[0].as_u64().unwrap_or(u64::MAX) as usize;
                    if let (true, Some(p)) = (pos < g.n() && g.atoms[pos].el == "C", item[1].as_f64()) {
                        ex.push((mi, pos, p));
                    }
                }
            }
            Kind::H1 => {
                let Some(arr) = v["h1_by_atom"].as_array() else { continue };
                let mut local = Vec::new();
                let mut ok = true;
                for item in arr {
                    let pos = item[0].as_u64().unwrap_or(u64::MAX) as usize;
                    let shifts: Vec<f64> = item[1].as_array().map(|a| a.iter().filter_map(|x| x.as_f64()).collect()).unwrap_or_default();
                    if pos >= g.n() || g.atoms[pos].el != "C" || shifts.is_empty() || g.atoms[pos].h as usize != shifts.len() {
                        ok = false;
                        break;
                    }
                    local.push((mi, pos, shifts.iter().sum::<f64>() / shifts.len() as f64));
                }
                if !ok {
                    continue;
                }
                ex.extend(local);
            }
        }
        mols.push(g);
    }
    (mols, ex)
}

/// The increment model's value for the quantity a table learns: the carbon's 13C shift, or the mean shift of its protons.
pub fn base_prediction(kind: Kind, g: &Mol, atom: usize) -> f64 {
    match kind {
        Kind::C13 => crate::analytical::nmr::c13_increment_shift(g, atom),
        Kind::H1 => crate::analytical::nmr::h1_increment_mean(g, atom),
    }
}

/// Builds a table from a training file.
pub fn build_from_file(path: &str, kind: Kind, source: &str, min_n: Vec<u32>, redundant_ppm: f64) -> HoseTable {
    let (mols, triples) = read_training(path, kind);
    let examples: Vec<Example> = triples.iter().map(|&(m, a, p)| Example { mol: &mols[m], atom: a, ppm: p, base: base_prediction(kind, &mols[m], a) }).collect();
    build(&examples, if kind == Kind::C13 { "13C" } else { "1H" }, source, min_n, redundant_ppm, mols.len())
}
