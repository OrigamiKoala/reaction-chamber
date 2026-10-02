//! UNIFAC subgroup decomposition of a molecule from its SMILES graph (`smiles.rs`).
//!
//! The decomposition follows the original UNIFAC conventions (Fredenslund et al. 1975): a carbonyl carbon takes one
//! adjacent methyl / methylene carbon (`CH3CO`, `CH2CO`), an aromatic carbon that carries an alkyl carbon takes it
//! (`ACCH3`, `ACCH2`, `ACCH`), methanol and water are groups of their own, the hydroxyl oxygen is `OH`, every remaining
//! sp3 carbon is `CH3` / `CH2` / `CH` / `C` by its hydrogen count. The set of groups supported is the set the bundled
//! parameter table covers (`data/unifac_vle.json`); a molecule that needs a group outside it (ethers, esters, amines,
//! halides, alkenes, acids, ...) returns `None` and the caller treats that species as outside UNIFAC (ideal, labelled)
//! instead of guessing a decomposition. Stage 9 replaces the minimal SMILES reader (and with it this module's reach).

use std::collections::HashMap;

use crate::smiles::{self, Molecule};

fn heavy_neighbours(m: &Molecule, i: usize) -> Vec<(usize, f64)> {
    m.neighbours(i)
}

/// Subgroup names and counts of the molecule, or None when it is outside the supported group set.
pub fn unifac_subgroups_from_smiles(smiles_str: &str) -> Option<Vec<(String, f64)>> {
    let m = smiles::parse(smiles_str)?;
    if m.atoms.is_empty() {
        return None;
    }
    // a single connected molecule: no counter-ions, no mixtures
    let mut seen = vec![false; m.atoms.len()];
    let mut stack = vec![0usize];
    seen[0] = true;
    while let Some(i) = stack.pop() {
        for (j, _) in heavy_neighbours(&m, i) {
            if !seen[j] {
                seen[j] = true;
                stack.push(j);
            }
        }
    }
    if seen.iter().any(|s| !s) {
        return None;
    }
    if m.atoms.iter().any(|a| a.charge != 0 || !matches!(a.element.as_str(), "C" | "O")) {
        return None;
    }

    let n = m.atoms.len();
    let mut used = vec![false; n];
    let mut counts: HashMap<&'static str, f64> = HashMap::new();
    let mut add = |name: &'static str| *counts.entry(name).or_insert(0.0) += 1.0;
    let h = |i: usize| m.hydrogens(i);
    let is_c = |i: usize| m.atoms[i].element == "C";
    let is_o = |i: usize| m.atoms[i].element == "O";
    let single_only = |i: usize| heavy_neighbours(&m, i).iter().all(|&(_, o)| (o - 1.0).abs() < 1e-9);

    // water
    if n == 1 && is_o(0) {
        return if h(0) == 2 { Some(vec![("H2O".to_string(), 1.0)]) } else { None };
    }
    // methanol (the molecule is one group)
    if n == 2 {
        let (c, o) = if is_c(0) { (0, 1) } else { (1, 0) };
        if is_c(c) && is_o(o) && h(c) == 3 && h(o) == 1 && !m.atoms[c].aromatic {
            return Some(vec![("CH3OH".to_string(), 1.0)]);
        }
    }

    // ketones: carbonyl carbon + one adjacent methyl / methylene carbon
    for c in 0..n {
        if !is_c(c) || m.atoms[c].aromatic {
            continue;
        }
        let nb = heavy_neighbours(&m, c);
        let carbonyl_o: Vec<usize> = nb.iter().filter(|&&(o, ord)| is_o(o) && (ord - 2.0).abs() < 1e-9).map(|&(o, _)| o).collect();
        if carbonyl_o.is_empty() {
            continue;
        }
        // exactly C(=O)(C)C: a ketone; anything else (acid, ester, aldehyde, amide, ...) is unsupported
        let carbons: Vec<usize> = nb.iter().filter(|&&(o, ord)| is_c(o) && (ord - 1.0).abs() < 1e-9).map(|&(o, _)| o).collect();
        if carbonyl_o.len() != 1 || nb.len() != 3 || carbons.len() != 2 || carbons.iter().any(|&k| m.atoms[k].aromatic || !single_only(k)) {
            return None;
        }
        let methyl = carbons.iter().copied().find(|&k| heavy_neighbours(&m, k).len() == 1 && h(k) == 3);
        let methylene = carbons.iter().copied().find(|&k| h(k) == 2);
        used[c] = true;
        used[carbonyl_o[0]] = true;
        if let Some(k) = methyl {
            used[k] = true;
            add("CH3CO");
        } else if let Some(k) = methylene {
            used[k] = true;
            add("CH2CO");
        } else {
            return None;
        }
    }

    // aromatic carbons (and the alkyl carbon they carry)
    for c in 0..n {
        if used[c] || !is_c(c) || !m.atoms[c].aromatic {
            continue;
        }
        if h(c) == 1 {
            used[c] = true;
            add("ACH");
            continue;
        }
        let subs: Vec<usize> = heavy_neighbours(&m, c).iter().filter(|&&(o, ord)| (ord - 1.5).abs() > 1e-9 && o != c).map(|&(o, _)| o).collect();
        used[c] = true;
        match subs.as_slice() {
            [] => add("AC"),
            [k] => {
                let k = *k;
                if !is_c(k) || m.atoms[k].aromatic || used[k] || !single_only(k) {
                    return None; // phenol (ACOH), carbonyl or other substituent: outside the supported set
                }
                match h(k) {
                    3 => add("ACCH3"),
                    2 => add("ACCH2"),
                    1 => add("ACCH"),
                    _ => return None,
                }
                used[k] = true;
            }
            _ => return None,
        }
        // fused aromatic carbon without hydrogens and with no substituent neighbours outside the ring system counts as AC
    }

    // hydroxyl groups
    for o in 0..n {
        if used[o] || !is_o(o) {
            continue;
        }
        let nb = heavy_neighbours(&m, o);
        if nb.len() == 1 && (nb[0].1 - 1.0).abs() < 1e-9 && h(o) == 1 && is_c(nb[0].0) && !m.atoms[nb[0].0].aromatic {
            used[o] = true;
            add("OH");
        } else {
            return None; // ether, peroxide, phenol, ...
        }
    }

    // remaining sp3 carbons
    for c in 0..n {
        if used[c] {
            continue;
        }
        if !is_c(c) || m.atoms[c].aromatic || !single_only(c) {
            return None; // alkene / alkyne carbon
        }
        used[c] = true;
        match h(c) {
            3 => add("CH3"),
            2 => add("CH2"),
            1 => add("CH"),
            0 => add("C"),
            _ => return None,
        }
    }
    if used.iter().any(|u| !u) {
        return None;
    }
    let mut out: Vec<(String, f64)> = counts.into_iter().map(|(k, v)| (k.to_string(), v)).collect();
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
    fn unsupported_structures_are_none() {
        assert!(g("COC").is_none()); // ether
        assert!(g("CC(=O)O").is_none()); // acid
        assert!(g("CC(=O)OCC").is_none()); // ester
        assert!(g("C=CC").is_none()); // alkene
        assert!(g("c1ccccc1O").is_none()); // phenol
        assert!(g("CC(=O)[O-].[Na+]").is_none());
        assert!(g("CCN").is_none());
    }
}
