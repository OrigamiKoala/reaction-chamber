//! UNIFAC subgroup decomposition of a molecule from its SMILES graph.
//!
//! The group set, the volumes/areas and the *patterns that recognise each subgroup* all come from the published table
//! (`data/unifac_vle.json`, written by `pipeline/db/parse_unifac.py`); nothing about a compound or a functional group is
//! written in this file. A molecule is decomposed by an exact cover of its heavy atoms by subgroup fragments:
//!
//!   1. every subgroup pattern is matched on the (aromaticity-perceived) graph; a match is a candidate fragment when the
//!      hydrogens on its atoms equal the hydrogens the subgroup accounts for;
//!   2. the fragments that tile all heavy atoms without overlap are enumerated, and the tiling whose fragments are
//!      "most specific" wins: fragments are ranked by (heteroatoms covered, heavy atoms covered), the tiling is the
//!      lexicographically largest descending list of those ranks. That is how a carboxylic acid becomes CH3 + COOH rather
//!      than CH3CO + OH, methanol CH3OH rather than CH3 + OH, and an ester CH3COO rather than CH3CO + CH3O.
//!
//! A molecule with a charge, several fragments, an element outside the table, or no complete tiling is *outside UNIFAC*:
//! the function returns None and the caller treats the species as ideal and labels it.

use std::collections::HashMap;

use crate::activity;
use crate::smarts::{self, MolView};
use crate::smiles;

#[derive(Clone)]
struct Cand {
    sg: usize,
    atoms: Vec<usize>,
    het: u32,
    /// specificity of the matching pattern (ring-specific ether > plain ether), tie-break 1
    spec: u32,
    /// hydrogens the fragment covers (a methyl-capped carbonyl CH3CO > CH2CO), tie-break 2
    h: u32,
}

/// Quality of a tiling: descending (heteroatoms, size) ranks, then summed pattern specificity, then hydrogens held by
/// multi-atom fragments. Larger compares better.
type Quality = (Vec<(u32, u32)>, u32, u32);

struct Search<'a> {
    n: usize,
    /// candidate fragments containing atom i
    by_atom: Vec<Vec<usize>>,
    cands: &'a [Cand],
    best: Option<(Quality, Vec<usize>)>,
    nodes: usize,
}

const NODE_LIMIT: usize = 400_000;

impl<'a> Search<'a> {
    fn go(&mut self, covered: &mut Vec<bool>, chosen: &mut Vec<usize>) {
        if self.nodes > NODE_LIMIT {
            return;
        }
        self.nodes += 1;
        let Some(first) = (0..self.n).find(|&i| !covered[i]) else {
            let mut ranks: Vec<(u32, u32)> = chosen.iter().map(|&c| (self.cands[c].het, self.cands[c].atoms.len() as u32)).collect();
            ranks.sort_by(|a, b| b.cmp(a));
            let spec: u32 = chosen.iter().map(|&c| self.cands[c].spec).sum();
            let h_multi: u32 = chosen.iter().filter(|&&c| self.cands[c].atoms.len() > 1).map(|&c| self.cands[c].h).sum();
            let q: Quality = (ranks, spec, h_multi);
            if self.best.as_ref().map_or(true, |(b, _)| q > *b) {
                self.best = Some((q, chosen.clone()));
            }
            return;
        };
        let options: Vec<usize> = self.by_atom[first].clone();
        for c in options {
            if self.cands[c].atoms.iter().any(|&a| covered[a]) {
                continue;
            }
            for &a in &self.cands[c].atoms {
                covered[a] = true;
            }
            chosen.push(c);
            self.go(covered, chosen);
            chosen.pop();
            for &a in &self.cands[c].atoms {
                covered[a] = false;
            }
        }
    }
}

/// Subgroup names and counts of the molecule, or None when it is outside the group set.
pub fn unifac_subgroups_from_smiles(smiles_str: &str) -> Option<Vec<(String, f64)>> {
    let parsed = smiles::parse(smiles_str)?;
    if parsed.atoms.is_empty() {
        return None;
    }
    // a single connected, uncharged molecule of elements the table knows
    let mut seen = vec![false; parsed.atoms.len()];
    let mut stack = vec![0usize];
    seen[0] = true;
    while let Some(i) = stack.pop() {
        for (j, _) in parsed.neighbours(i) {
            if !seen[j] {
                seen[j] = true;
                stack.push(j);
            }
        }
    }
    if seen.iter().any(|s| !s) {
        return None;
    }
    if parsed.atoms.iter().any(|a| a.charge != 0 || smarts::atomic_number(&a.element).is_none()) {
        return None;
    }
    // group contribution is organic chemistry: a molecule without carbon is outside the table (water has its own group)
    if !parsed.atoms.iter().any(|a| a.element == "C") && !(parsed.atoms.len() == 1 && parsed.atoms[0].element == "O") {
        return None;
    }
    let mol = parsed.aromatized();
    let view = MolView::new(&mol);
    let params = activity::unifac_params();
    let n = mol.atoms.len();
    let is_het = |i: usize| mol.atoms[i].element != "C";

    let mut cands: Vec<Cand> = Vec::new();
    let mut seen_sets: std::collections::HashSet<(usize, Vec<usize>)> = std::collections::HashSet::new();
    for (si, sg) in params.subgroups.iter().enumerate() {
        for pat in &sg.patterns {
            let spec = pat.specificity();
            for m in smarts::find_matches(&view, pat) {
                let mut atoms = m.clone();
                atoms.sort();
                if !seen_sets.insert((si, atoms.clone())) {
                    continue;
                }
                let h: u32 = atoms.iter().map(|&a| view.h[a]).sum();
                if h != sg.h {
                    continue;
                }
                let het = atoms.iter().filter(|&&a| is_het(a)).count() as u32;
                cands.push(Cand { sg: si, atoms, het, spec, h });
            }
        }
    }
    if cands.is_empty() {
        return None;
    }
    let mut by_atom: Vec<Vec<usize>> = vec![Vec::new(); n];
    for (ci, c) in cands.iter().enumerate() {
        for &a in &c.atoms {
            by_atom[a].push(ci);
        }
    }
    if by_atom.iter().any(|v| v.is_empty()) {
        return None; // an atom no subgroup can hold
    }
    // larger / more heteroatomic fragments first: the first complete tiling is usually the best one
    for v in by_atom.iter_mut() {
        v.sort_by(|&a, &b| (cands[b].het, cands[b].atoms.len()).cmp(&(cands[a].het, cands[a].atoms.len())));
    }
    let mut s = Search { n, by_atom, cands: &cands, best: None, nodes: 0 };
    let mut covered = vec![false; n];
    let mut chosen = Vec::new();
    s.go(&mut covered, &mut chosen);
    let (_, picks) = s.best?;
    let mut counts: HashMap<String, f64> = HashMap::new();
    for c in picks {
        *counts.entry(params.subgroups[cands[c].sg].name.clone()).or_insert(0.0) += 1.0;
    }
    let mut out: Vec<(String, f64)> = counts.into_iter().collect();
    out.sort_by(|a, b| a.0.cmp(&b.0));
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn g(s: &str) -> Option<Vec<(String, f64)>> {
        unifac_subgroups_from_smiles(s)
    }
    fn count(v: &[(String, f64)], name: &str) -> f64 {
        v.iter().find(|(n, _)| n == name).map(|(_, c)| *c).unwrap_or(0.0)
    }
    fn total_groups(v: &[(String, f64)]) -> f64 {
        v.iter().map(|(_, c)| c).sum()
    }

    #[test]
    fn water_methanol_ethanol() {
        assert_eq!(g("O").unwrap(), vec![("H2O".to_string(), 1.0)]);
        assert_eq!(g("CO").unwrap(), vec![("CH3OH".to_string(), 1.0)]);
        let e = g("CCO").unwrap();
        assert_eq!((count(&e, "CH3"), count(&e, "CH2"), count(&e, "OH")), (1.0, 1.0, 1.0));
    }

    #[test]
    fn alkanes_aromatics_and_ketones() {
        let h = g("CCCCCC").unwrap();
        assert_eq!((count(&h, "CH3"), count(&h, "CH2")), (2.0, 4.0));
        let t = g("Cc1ccccc1").unwrap();
        assert_eq!((count(&t, "ACH"), count(&t, "ACCH3")), (5.0, 1.0));
        // PubChem writes Kekule SMILES: the same groups
        let tk = g("CC1=CC=CC=C1").unwrap();
        assert_eq!(tk, t);
        let b = g("c1ccccc1").unwrap();
        assert_eq!(count(&b, "ACH"), 6.0);
        let a = g("CC(C)=O").unwrap();
        assert_eq!((count(&a, "CH3CO"), count(&a, "CH3")), (1.0, 1.0));
        let ip = g("CC(C)O").unwrap(); // 2-propanol: CH3 + CH + CH3 + OH
        assert_eq!((count(&ip, "CH3"), count(&ip, "CH"), count(&ip, "OH")), (2.0, 1.0, 1.0));
        let eb = g("CCc1ccccc1").unwrap(); // ethylbenzene: CH3 + ACCH2 + 5 ACH
        assert_eq!((count(&eb, "CH3"), count(&eb, "ACCH2"), count(&eb, "ACH")), (1.0, 1.0, 5.0));
        let bu = g("CCC(C)=O").unwrap(); // 2-butanone: CH3CO + CH2 + CH3
        assert_eq!((count(&bu, "CH3CO"), count(&bu, "CH2"), count(&bu, "CH3")), (1.0, 1.0, 1.0));
    }

    #[test]
    fn heteroatom_groups_the_old_table_could_not_hold() {
        // acetic acid is CH3 + COOH (not CH3CO + OH); methyl acetate CH3COO + CH3; ethyl acetate CH3COO + CH2 + CH3
        let ac = g("CC(=O)O").unwrap();
        assert_eq!((count(&ac, "CH3"), count(&ac, "COOH"), total_groups(&ac)), (1.0, 1.0, 2.0));
        let ma = g("CC(=O)OC").unwrap();
        assert_eq!((count(&ma, "CH3COO"), count(&ma, "CH3"), total_groups(&ma)), (1.0, 1.0, 2.0));
        let ea = g("CC(=O)OCC").unwrap();
        assert_eq!((count(&ea, "CH3COO"), count(&ea, "CH2"), count(&ea, "CH3")), (1.0, 1.0, 1.0));
        // ethers: diethyl ether CH3 x2 + CH2 + CH2O; THF is the ring ether group
        let de = g("CCOCC").unwrap();
        assert_eq!((count(&de, "CH3"), count(&de, "CH2"), count(&de, "CH2O"), total_groups(&de)), (2.0, 1.0, 1.0, 4.0));
        let thf = g("C1CCOC1").unwrap();
        assert_eq!((count(&thf, "THF"), count(&thf, "CH2"), total_groups(&thf)), (1.0, 3.0, 4.0));
        // phenol, aniline, chloroform, dichloromethane, acetonitrile, DMSO
        let ph = g("c1ccccc1O").unwrap();
        assert_eq!((count(&ph, "ACOH"), count(&ph, "ACH")), (1.0, 5.0));
        let an = g("Nc1ccccc1").unwrap();
        assert_eq!((count(&an, "ACNH2"), count(&an, "ACH")), (1.0, 5.0));
        assert_eq!(g("ClC(Cl)Cl").unwrap(), vec![("CHCL3".to_string(), 1.0)]);
        assert_eq!(g("ClCCl").unwrap(), vec![("CH2CL2".to_string(), 1.0)]);
        assert_eq!(g("CC#N").unwrap(), vec![("CH3CN".to_string(), 1.0)]);
        assert_eq!(g("CS(C)=O").unwrap(), vec![("DMSO".to_string(), 1.0)]);
        // alkene and nitrobenzene
        let al = g("CC=C").unwrap();
        assert_eq!((count(&al, "CH3"), count(&al, "CH2=CH")), (1.0, 1.0));
        let nb = g("O=[N+]([O-])c1ccccc1");
        assert!(nb.is_none(), "charged nitro SMILES is outside the supported set");
    }

    #[test]
    fn sugars_and_polyols() {
        // glucopyranose: a decomposition exists (the table's 2-alkoxyethanol group takes C6-O6 with the ring ether, so four
        // free hydroxyls remain)
        let glc = g("C(C1C(C(C(C(O1)O)O)O)O)O").unwrap();
        assert!(count(&glc, "OH") >= 4.0 && count(&glc, "CH") >= 4.0, "{:?}", glc);
        // glycerol: 3 OH + 2 CH2 + CH
        let gly = g("C(C(CO)O)O").unwrap();
        assert_eq!((count(&gly, "OH"), count(&gly, "CH2"), count(&gly, "CH")), (3.0, 2.0, 1.0));
    }

    #[test]
    fn structures_outside_the_table_are_none() {
        assert!(g("CC(=O)[O-].[Na+]").is_none());
        assert!(g("C").is_none()); // methane has no UNIFAC group in the original table
        assert!(g("O=C=O").is_none());
        assert!(g("[Na+].[Cl-]").is_none());
        assert!(g("II").is_none());
    }
}
