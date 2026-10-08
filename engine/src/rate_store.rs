//! Per-reaction rate constants that outrank the template rules.
//!
//! A generated reaction is identified by a *structural* key, `template[_variant]|reactant hashes>>product hashes`, where
//! every hash is a Weisfeiler-Lehman hash of the molecule's heavy-atom graph (element, charge, hydrogens, aromaticity,
//! bond orders). The key does not depend on species ids or SMILES spelling, so a table computed on one machine (the local
//! shipped table) applies on another.
//!
//! Entries are *per pathway* (one transition state; the network generator adds the pathways of a reaction as it does for
//! the template rules) unless `per_reaction` is set (a measured rate constant already counts every pathway). A key may end
//! in `@solvent_class` (`with_solvent`): measured rates are stated for a solvent and are looked up first. The engine never
//! computes these rates itself; they arrive through `register` (WASM `register_reaction_rates`) or from the measured table
//! (`rate_data.rs`).

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

use crate::types::ProvenanceTier;
use crate::smiles::Molecule;

/// A stored rate: Arrhenius parameters of one pathway (A in M^(1-n) s^-1 for the n non-solvent reactants, per unit of the
/// catalysts of the template variant; Ea in J/mol).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RateEntry {
    pub key: String,
    pub a: f64,
    pub ea_j_mol: f64,
    pub tier: ProvenanceTier,
    /// How the value was obtained (method, anchoring, reference), shown in the reaction's source line.
    pub source: String,
    /// The rate is that of the whole reaction (all pathways together), not of one pathway.
    #[serde(default)]
    pub per_reaction: bool,
    /// A rate constant at one temperature without an activation energy: k_ref at t_ref_k, with the temperature dependence
    /// of the template rule's Ea (`a` and `ea_j_mol` are then unused).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub k_ref: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub t_ref_k: Option<f64>,
    /// Empirical rate law terms (when the rate law has multiple terms with different catalysts/orders).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub terms: Vec<crate::rate_data::RateLawTerm>,
}

impl RateEntry {
    /// Arrhenius parameters (A, Ea J/mol), given the template rule's Ea for an entry that has only a rate constant.
    pub fn arrhenius(&self, rule_ea_j_mol: f64) -> (f64, f64) {
        match (self.k_ref, self.t_ref_k) {
            (Some(k), Some(t)) => (k * (rule_ea_j_mol / (crate::physics::R_GAS * t)).exp(), rule_ea_j_mol),
            _ => (self.a, self.ea_j_mol),
        }
    }
}

/// The key of a reaction in one solvent class (measured rates are stated for a solvent).
pub fn with_solvent(key: &str, solvent_class: &str) -> String {
    format!("{}@{}", key, solvent_class)
}

/// The best stored rate of a reaction in a solvent class: a measured rate of that reaction under its template, or under
/// any template, in that solvent; else a rate stated without a solvent (a calculation).
pub fn lookup_for(key: &str, any_template_key: &str, solvent_class: &str) -> Option<RateEntry> {
    crate::rate_data::ensure_loaded();
    let g = lock();
    for k in [with_solvent(key, solvent_class), with_solvent(any_template_key, solvent_class), key.to_string()] {
        if let Some(e) = g.entries.get(&k) {
            return Some(e.clone());
        }
    }
    None
}

#[derive(Default)]
struct Inner {
    entries: HashMap<String, RateEntry>,
    generation: u64,
}

fn inner() -> &'static Mutex<Inner> {
    static STORE: OnceLock<Mutex<Inner>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(Inner::default()))
}

fn lock() -> std::sync::MutexGuard<'static, Inner> {
    inner().lock().unwrap_or_else(|e| e.into_inner())
}

/// The stored rate of a reaction key.
pub fn lookup(key: &str) -> Option<RateEntry> {
    lock().entries.get(key).cloned()
}

/// Number of stored rates.
pub fn len() -> usize {
    lock().entries.len()
}

/// Changes whenever an entry is added or replaced; vessels re-apply stored rates when it moves.
pub fn generation() -> u64 {
    lock().generation
}

/// Adds or replaces entries (non-finite or non-positive A and negative Ea are refused). Returns how many changed.
pub fn register(entries: Vec<RateEntry>) -> usize {
    let mut g = lock();
    let mut changed = 0;
    for e in entries {
        let arrhenius_ok = e.a.is_finite() && e.a > 0.0 && e.ea_j_mol.is_finite() && e.ea_j_mol >= 0.0;
        let k_ok = matches!((e.k_ref, e.t_ref_k), (Some(k), Some(t)) if k.is_finite() && k > 0.0 && t > 0.0);
        let terms_ok = !e.terms.is_empty() && e.terms.iter().all(|tm| tm.k.is_finite() && tm.k > 0.0 && tm.t_k > 0.0);
        if !(arrhenius_ok || k_ok || terms_ok) || e.key.is_empty() {
            continue;
        }
        if g.entries.get(&e.key) != Some(&e) {
            g.entries.insert(e.key.clone(), e);
            changed += 1;
        }
    }
    if changed > 0 {
        g.generation += 1;
    }
    changed
}

/// Empties the store (tests).
pub fn clear() {
    let mut g = lock();
    *g = Inner { generation: g.generation + 1, ..Inner::default() };
}

// ------------------------------------------------------------------------------------------------ structural key

fn fnv(bytes: &[u8], mut h: u64) -> u64 {
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

const FNV_SEED: u64 = 0xcbf29ce484222325;

/// Weisfeiler-Lehman hash of a molecule's heavy-atom graph (4 refinement rounds), as 16 hex digits. Terminal explicit hydrogen
/// atoms (`[H]C(...)=O`, as the Mayr database writes aldehydes) are folded into the hydrogen count of their neighbour, so the hash
/// of a molecule does not depend on how its hydrogens are written. Aromaticity is NOT perceived here: a molecule that comes from a
/// Kekule SMILES must be passed through `Molecule::perceived` first (the network generator's molecules are).
pub fn molecule_hash(mol: &Molecule) -> String {
    let total = mol.atoms.len();
    let bonded = |i: usize| -> Vec<usize> { mol.bonds.iter().filter_map(|&(a, b, _)| if a == i { Some(b) } else if b == i { Some(a) } else { None }).collect() };
    // a terminal explicit hydrogen: element H with exactly one bond, to a non-hydrogen
    let is_h = |i: usize| mol.atoms[i].element == "H" && { let nb = bonded(i); nb.len() == 1 && mol.atoms[nb[0]].element != "H" };
    let keep: Vec<bool> = (0..total).map(|i| !is_h(i)).collect();
    let mut new_index = vec![usize::MAX; total];
    let mut heavy = Vec::new();
    for i in 0..total {
        if keep[i] {
            new_index[i] = heavy.len();
            heavy.push(i);
        }
    }
    let n = heavy.len();
    let mut adj: Vec<Vec<(usize, u8)>> = vec![Vec::new(); n];
    let mut extra_h = vec![0u32; n];
    for &(a, b, o) in &mol.bonds {
        let code = (o * 2.0).round() as u8;
        match (keep[a], keep[b]) {
            (true, true) => {
                adj[new_index[a]].push((new_index[b], code));
                adj[new_index[b]].push((new_index[a], code));
            }
            (true, false) => extra_h[new_index[a]] += 1,
            (false, true) => extra_h[new_index[b]] += 1,
            _ => {}
        }
    }
    let mut labels: Vec<u64> = (0..n)
        .map(|k| {
            let i = heavy[k];
            let a = &mol.atoms[i];
            let s = format!("{}|{}|{}|{}|{}", a.element, a.charge, mol.hydrogens(i) + extra_h[k], a.aromatic as u8, adj[k].len());
            fnv(s.as_bytes(), FNV_SEED)
        })
        .collect();
    for _ in 0..4 {
        labels = (0..n)
            .map(|i| {
                let mut nb: Vec<(u8, u64)> = adj[i].iter().map(|&(j, c)| (c, labels[j])).collect();
                nb.sort_unstable();
                let mut h = fnv(&labels[i].to_le_bytes(), FNV_SEED);
                for (c, l) in nb {
                    h = fnv(&[c], h);
                    h = fnv(&l.to_le_bytes(), h);
                }
                h
            })
            .collect();
    }
    let mut sorted = labels;
    sorted.sort_unstable();
    let mut h = fnv(&(n as u64).to_le_bytes(), FNV_SEED);
    for l in sorted {
        h = fnv(&l.to_le_bytes(), h);
    }
    format!("{:016x}", h)
}

/// Structural key of a reaction of `template_variant` (template id plus `_tag` of the variant, if any).
pub fn reaction_key(template_variant: &str, reactants: &[&Molecule], products: &[&Molecule]) -> String {
    let side = |ms: &[&Molecule]| {
        let mut v: Vec<String> = ms.iter().map(|m| molecule_hash(m)).collect();
        v.sort();
        v.join(".")
    };
    format!("{}|{}>>{}", template_variant, side(reactants), side(products))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::smiles::parse;

    #[test]
    fn hash_ignores_smiles_spelling_and_tells_isomers_apart() {
        let a = parse("CCO").unwrap();
        let b = parse("OCC").unwrap();
        let c = parse("COC").unwrap();
        assert_eq!(molecule_hash(&a), molecule_hash(&b));
        assert_ne!(molecule_hash(&a), molecule_hash(&c));
        let p1 = parse("CCCBr").unwrap();
        let p2 = parse("CC(C)Br").unwrap();
        assert_ne!(molecule_hash(&p1), molecule_hash(&p2));
        let ion = parse("[O-]C").unwrap();
        let neutral = parse("OC").unwrap();
        assert_ne!(molecule_hash(&ion), molecule_hash(&neutral));
    }

    #[test]
    fn hash_ignores_how_hydrogens_and_aromaticity_are_written() {
        let kekule = parse("[H]C(C1=CC=CC=C1)=O").unwrap().perceived();
        let plain = parse("O=Cc1ccccc1").unwrap().perceived();
        assert_eq!(molecule_hash(&kekule), molecule_hash(&plain));
        // stereo marks are not part of the key
        let a = parse("N#C/C(C#N)=C\\C1=CC=CC=C1").unwrap().perceived();
        let b = parse("N#CC(C#N)=Cc1ccccc1").unwrap().perceived();
        assert_eq!(molecule_hash(&a), molecule_hash(&b));
        // an aldehyde is not its alcohol
        assert_ne!(molecule_hash(&plain), molecule_hash(&parse("OCc1ccccc1").unwrap().perceived()));
    }

    #[test]
    fn key_does_not_depend_on_the_order_of_molecules() {
        let x = parse("CBr").unwrap();
        let y = parse("[OH-]").unwrap();
        let p = parse("CO").unwrap();
        let q = parse("[Br-]").unwrap();
        assert_eq!(reaction_key("t", &[&x, &y], &[&p, &q]), reaction_key("t", &[&y, &x], &[&q, &p]));
        assert_ne!(reaction_key("t", &[&x, &y], &[&p, &q]), reaction_key("u", &[&x, &y], &[&p, &q]));
    }
}
