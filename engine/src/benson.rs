//! Benson group additivity over the SMILES graph: ideal-gas enthalpy of formation, entropy and Gibbs energy of formation
//! of a neutral organic molecule at 298.15 K.
//!
//! Every non-hydrogen atom is typed by what it is bonded to (`C-(O)(C)(H)2`, `CO-(C)2`, `CB-(H)`, ...), the group values
//! come from `data/benson_groups.json`, and three molecule-level terms are added: the symmetry entropy `-R ln sigma`, the
//! alkane gauche interactions (counted from the lowest-energy staggered conformer of every sp3-sp3 bond) and the ring
//! strain of 3-8 membered rings. A molecule with an atom, ring system or neighbour that no group covers gets no estimate
//! (the caller then falls back to Joback); a partial decomposition is not an estimate.
//!
//! Symmetry number: sigma = (automorphisms of the heavy-atom graph) x 3 per methyl rotor, with the correction that at an
//! acyclic sp3 centre whose heavy branches can be permuted but which has no spare pair of equivalent hydrogens, the
//! permutation is a reflection and not a rotation (isobutane 81, neopentane 972, 2-methylbutane 27), and a ring system
//! that is not aromatic takes the tabulated sigma of the bare cycloalkane or none at all.
//!
//! Tier Estimated. This replaces Joback for the enthalpy and entropy of created compounds where the groups exist:
//! Joback's enthalpy is good to about 15 kJ/mol, Benson's to about 3.

use std::collections::{BTreeMap, HashMap};
use std::sync::OnceLock;

use serde::Deserialize;

use crate::physics::R_GAS;
use crate::smiles::Molecule;

const KCAL: f64 = 4.184;

#[derive(Deserialize)]
struct Gauche {
    #[serde(rename = "dH_kcal")]
    dh_kcal: f64,
}

#[derive(Deserialize)]
struct File {
    groups: HashMap<String, [f64; 2]>,
    gauche: Gauche,
    ring_corrections: HashMap<String, serde_json::Value>,
}

fn table() -> &'static File {
    static T: OnceLock<File> = OnceLock::new();
    T.get_or_init(|| serde_json::from_str(include_str!("../data/benson_groups.json")).expect("data/benson_groups.json"))
}

/// Benson estimate of one molecule.
#[derive(Clone, Debug)]
pub struct BensonEstimate {
    /// group counts by name (group keys of the data file)
    pub groups: BTreeMap<String, u32>,
    pub dhf_gas_kj: f64,
    /// absolute entropy of the ideal gas at 298.15 K and 1 bar, J/(mol K)
    pub s_gas: f64,
    pub dgf_gas_kj: f64,
    pub sigma: f64,
    pub gauche: u32,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Kind {
    H,
    C,
    Cd,
    Ct,
    Cb,
    Co,
    O,
    N,
}

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Kind::H => "H",
            Kind::C => "C",
            Kind::Cd => "Cd",
            Kind::Ct => "Ct",
            Kind::Cb => "CB",
            Kind::Co => "CO",
            Kind::O => "O",
            Kind::N => "N",
        }
    }
    /// order of the neighbours in a group name
    fn rank(self) -> u8 {
        match self {
            Kind::O => 0,
            Kind::N => 1,
            Kind::Co => 2,
            Kind::Cb => 3,
            Kind::Cd => 4,
            Kind::Ct => 5,
            Kind::C => 6,
            Kind::H => 7,
        }
    }
}

fn is_close(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-9
}

/// What a heavy atom is, as a neighbour of another group: None for an atom the method does not cover.
fn kind_of(mol: &Molecule, nbrs: &[Vec<(usize, f64)>], i: usize) -> Option<Kind> {
    let a = &mol.atoms[i];
    if a.charge != 0 {
        return None;
    }
    match a.element.as_str() {
        "C" => {
            if a.aromatic {
                return Some(Kind::Cb);
            }
            let dbl: Vec<usize> = nbrs[i].iter().filter(|&&(_, b)| is_close(b, 2.0)).map(|&(j, _)| j).collect();
            let triple = nbrs[i].iter().any(|&(_, b)| is_close(b, 3.0));
            if triple {
                // only a C-C triple bond
                let partner = nbrs[i].iter().find(|&&(_, b)| is_close(b, 3.0)).map(|&(j, _)| j)?;
                return if mol.atoms[partner].element == "C" { Some(Kind::Ct) } else { None };
            }
            match dbl.len() {
                0 => Some(Kind::C),
                1 => match mol.atoms[dbl[0]].element.as_str() {
                    "O" => Some(Kind::Co),
                    // the carbon of a C=N is an alkene-type carbon (Benson's Cd group) with the imine nitrogen as its partner
                    "C" | "N" => Some(Kind::Cd),
                    _ => None,
                },
                _ => None,
            }
        }
        "O" => {
            // a carbonyl oxygen belongs to its carbon's group
            if nbrs[i].iter().any(|&(_, b)| is_close(b, 2.0)) {
                None
            } else {
                Some(Kind::O)
            }
        }
        "N" => {
            // an amine nitrogen (single bonds only) or an imine nitrogen (one double bond to a carbon, the rest single)
            let doubles: Vec<usize> = nbrs[i].iter().filter(|&&(_, b)| is_close(b, 2.0)).map(|&(j, _)| j).collect();
            let others_single = nbrs[i].iter().all(|&(_, b)| is_close(b, 1.0) || is_close(b, 2.0));
            if a.aromatic || !others_single || doubles.len() > 1 || doubles.iter().any(|&j| mol.atoms[j].element != "C" || mol.atoms[j].aromatic) {
                None
            } else {
                Some(Kind::N)
            }
        }
        _ => None,
    }
}

fn group_key(centre: &str, mut subs: Vec<Kind>) -> String {
    subs.sort_by_key(|k| k.rank());
    let mut out = format!("{}-", centre);
    let mut i = 0;
    while i < subs.len() {
        let k = subs[i];
        let n = subs.iter().filter(|&&x| x == k).count();
        out.push_str(&format!("({}){}", k.name(), if n > 1 { n.to_string() } else { String::new() }));
        i += n;
    }
    out
}

/// Smallest cycle through every non-bridge bond; returns the distinct cycles as sorted atom lists.
fn cycles(mol: &Molecule, nbrs: &[Vec<(usize, f64)>]) -> Vec<Vec<usize>> {
    let ring = crate::joback::ring_atoms(mol);
    let mut out: Vec<Vec<usize>> = Vec::new();
    for &(a, b, _) in &mol.bonds {
        if !ring[a] || !ring[b] {
            continue;
        }
        // shortest path a -> b avoiding the bond (a, b)
        let n = mol.atoms.len();
        let mut prev = vec![usize::MAX; n];
        let mut seen = vec![false; n];
        let mut q = std::collections::VecDeque::new();
        q.push_back(a);
        seen[a] = true;
        while let Some(u) = q.pop_front() {
            for &(v, _) in &nbrs[u] {
                if (u == a && v == b) || seen[v] {
                    continue;
                }
                seen[v] = true;
                prev[v] = u;
                q.push_back(v);
            }
        }
        if !seen[b] {
            continue;
        }
        let mut cyc = vec![b];
        let mut cur = b;
        while cur != a {
            cur = prev[cur];
            cyc.push(cur);
        }
        cyc.sort_unstable();
        if !out.contains(&cyc) {
            out.push(cyc);
        }
    }
    out
}

/// Canonical string of the branch hanging off `from` at `at` (a rooted tree walk; rings are cut where they close).
fn branch_label(mol: &Molecule, nbrs: &[Vec<(usize, f64)>], at: usize, from: usize, depth: usize) -> String {
    let a = &mol.atoms[at];
    let mut kids: Vec<String> = Vec::new();
    if depth < 12 {
        for &(j, b) in &nbrs[at] {
            if j != from {
                kids.push(format!("{}{}", b, branch_label(mol, nbrs, j, at, depth + 1)));
            }
        }
    }
    kids.sort();
    format!("{}{}{}({})", a.element, mol.hydrogens(at), if a.aromatic { "a" } else { "" }, kids.join(","))
}

/// Number of automorphisms of the heavy-atom graph (labels: element, hydrogens, aromaticity; bond orders). None above the cap.
fn automorphisms(mol: &Molecule, nbrs: &[Vec<(usize, f64)>], h: &[u32]) -> Option<u64> {
    let n = mol.atoms.len();
    let label = |i: usize| (mol.atoms[i].element.clone(), h[i], mol.atoms[i].aromatic, nbrs[i].len());
    // visit order: breadth first from atom 0 so each new atom has an already-mapped neighbour
    let mut order = Vec::with_capacity(n);
    let mut seen = vec![false; n];
    for root in 0..n {
        if seen[root] {
            continue;
        }
        seen[root] = true;
        order.push(root);
        let mut idx = order.len() - 1;
        while idx < order.len() {
            let u = order[idx];
            idx += 1;
            for &(v, _) in &nbrs[u] {
                if !seen[v] {
                    seen[v] = true;
                    order.push(v);
                }
            }
        }
    }
    let bond = |a: usize, b: usize| nbrs[a].iter().find(|&&(x, _)| x == b).map(|&(_, o)| o);
    let mut map = vec![usize::MAX; n];
    let mut used = vec![false; n];
    let mut count: u64 = 0;
    let mut nodes: u64 = 0;
    fn rec(
        k: usize,
        order: &[usize],
        map: &mut Vec<usize>,
        used: &mut Vec<bool>,
        count: &mut u64,
        nodes: &mut u64,
        label: &dyn Fn(usize) -> (String, u32, bool, usize),
        bond: &dyn Fn(usize, usize) -> Option<f64>,
        n: usize,
    ) -> bool {
        if *nodes > 400_000 {
            return false;
        }
        if k == order.len() {
            *count += 1;
            return true;
        }
        let u = order[k];
        for cand in 0..n {
            if used[cand] || label(cand) != label(u) {
                continue;
            }
            *nodes += 1;
            // every already-mapped atom must keep its bond (or absence of a bond) to u
            let mut ok = true;
            for &w in &order[..k] {
                if bond(u, w) != bond(cand, map[w]) {
                    ok = false;
                    break;
                }
            }
            if !ok {
                continue;
            }
            map[u] = cand;
            used[cand] = true;
            let fine = rec(k + 1, order, map, used, count, nodes, label, bond, n);
            used[cand] = false;
            map[u] = usize::MAX;
            if !fine {
                return false;
            }
        }
        true
    }
    if rec(0, &order, &mut map, &mut used, &mut count, &mut nodes, &label, &bond, n) {
        Some(count.max(1))
    } else {
        None
    }
}

/// Number of gauche interactions across the bond between sp3 carbons `i` and `j` in its lowest-energy staggered conformer.
fn gauche_across(a: usize, b: usize) -> u32 {
    // `a` carbon substituents on one end, `b` on the other; positions 0..2 on each side, anti when (q - p) = 1 mod 3
    if a == 0 || b == 0 {
        return 0;
    }
    let mut best = u32::MAX;
    for mask_a in 0u32..8 {
        if mask_a.count_ones() as usize != a {
            continue;
        }
        for mask_b in 0u32..8 {
            if mask_b.count_ones() as usize != b {
                continue;
            }
            let mut g = 0;
            for p in 0..3 {
                if mask_a & (1 << p) == 0 {
                    continue;
                }
                for q in 0..3 {
                    if mask_b & (1 << q) != 0 && (q + 3 - p) % 3 != 1 {
                        g += 1;
                    }
                }
            }
            best = best.min(g);
        }
    }
    best
}

/// Benson estimate for a neutral molecule, or None when a group, ring or atom is not covered.
pub fn estimate(mol_in: &Molecule) -> Option<BensonEstimate> {
    let mol = mol_in.aromatized();
    let n = mol.atoms.len();
    if n == 0 {
        return None;
    }
    let t = table();
    let nbrs: Vec<Vec<(usize, f64)>> = (0..n).map(|i| mol.neighbours(i)).collect();
    let h: Vec<u32> = (0..n).map(|i| mol.hydrogens(i)).collect();
    let kinds: Vec<Option<Kind>> = (0..n).map(|i| kind_of(&mol, &nbrs, i)).collect();

    // ---- groups
    let mut groups: BTreeMap<String, u32> = BTreeMap::new();
    let mut dh = 0.0;
    let mut s = 0.0;
    for i in 0..n {
        let Some(k) = kinds[i] else {
            // a carbonyl oxygen is covered by its carbon; anything else is not covered
            if mol.atoms[i].element == "O" && nbrs[i].len() == 1 && is_close(nbrs[i][0].1, 2.0) && kinds[nbrs[i][0].0] == Some(Kind::Co) {
                continue;
            }
            return None;
        };
        let mut subs: Vec<Kind> = Vec::new();
        let mut skip_partner: Option<usize> = None;
        // the partner of a double / triple bond (and the carbonyl oxygen) is part of the centre, not a substituent
        // an imine nitrogen is the centre `N_I` of its own groups, with its carbon as the partner
        let imine_n = k == Kind::N && nbrs[i].iter().any(|&(_, b)| is_close(b, 2.0));
        if matches!(k, Kind::Cd | Kind::Ct | Kind::Co) || imine_n {
            skip_partner = nbrs[i].iter().find(|&&(_, b)| b > 1.9 && !is_close(b, 1.5)).map(|&(j, _)| j);
        }
        let mut arom_nb = 0;
        for &(j, b) in &nbrs[i] {
            if Some(j) == skip_partner {
                continue;
            }
            if k == Kind::Cb && is_close(b, 1.5) {
                arom_nb += 1;
                if arom_nb <= 2 {
                    continue; // the two ring neighbours
                }
            }
            let kj = match kinds[j] {
                Some(x) => x,
                None => return None,
            };
            subs.push(kj);
        }
        for _ in 0..h[i] {
            subs.push(Kind::H);
        }
        let key = group_key(
            match k {
                Kind::C => "C",
                Kind::Cd => "Cd",
                Kind::Ct => "Ct",
                Kind::Cb => "CB",
                Kind::Co => "CO",
                Kind::O => "O",
                Kind::N if imine_n => "N_I",
                Kind::N => "N",
                Kind::H => return None,
            },
            subs,
        );
        let v = t.groups.get(&key)?;
        dh += v[0] * KCAL;
        s += v[1] * KCAL;
        *groups.entry(key).or_insert(0) += 1;
    }

    // ---- rings
    let cyc = cycles(&mol, &nbrs);
    let mut ring_sigma: Option<f64> = None;
    let nonarom: Vec<&Vec<usize>> = cyc.iter().filter(|c| !c.iter().all(|&a| mol.atoms[a].aromatic)).collect();
    for c in &cyc {
        let all_arom = c.iter().all(|&a| mol.atoms[a].aromatic);
        let any_arom = c.iter().any(|&a| mol.atoms[a].aromatic);
        if all_arom {
            if !c.iter().all(|&a| mol.atoms[a].element == "C") {
                return None;
            }
            continue;
        }
        if any_arom {
            return None;
        }
        // fused or spiro non-aromatic rings are outside the table
        if cyc.iter().any(|o| o != c && o.iter().any(|a| c.contains(a))) {
            return None;
        }
        let size = c.len();
        let n_dbl = mol.bonds.iter().filter(|&&(a, b, o)| is_close(o, 2.0) && c.contains(&a) && c.contains(&b)).count();
        let hetero: Vec<&str> = c.iter().map(|&a| mol.atoms[a].element.as_str()).filter(|e| *e != "C").collect();
        let (kind, row) = if hetero.is_empty() && n_dbl == 0 {
            ("carbocycle", t.ring_corrections.get("carbocycle"))
        } else if hetero.is_empty() && n_dbl == 1 {
            ("alkene", t.ring_corrections.get("alkene"))
        } else if hetero == ["O"] && n_dbl == 0 {
            ("oxa", t.ring_corrections.get("oxa"))
        } else {
            return None;
        };
        let _ = kind;
        let v = row?.get(size.to_string())?.as_array()?;
        dh += v[0].as_f64()? * KCAL;
        s += v[1].as_f64()? * KCAL;
        if nonarom.len() == 1 && cyc.len() == 1 {
            let bare = n == size && mol.atoms.iter().all(|a| a.element == "C");
            if bare {
                ring_sigma = Some(v[2].as_f64()?);
            }
        }
    }

    // ---- gauche interactions (acyclic sp3-sp3 bonds, carbon substituents)
    let ring = crate::joback::ring_atoms(&mol);
    let sp3c = |i: usize| kinds[i] == Some(Kind::C);
    let mut gauche = 0u32;
    for &(a, b, o) in &mol.bonds {
        if !is_close(o, 1.0) || !sp3c(a) || !sp3c(b) || (ring[a] && ring[b]) {
            continue;
        }
        let ca = nbrs[a].iter().filter(|&&(j, _)| j != b && sp3c(j)).count();
        let cb = nbrs[b].iter().filter(|&&(j, _)| j != a && sp3c(j)).count();
        gauche += gauche_across(ca, cb);
    }
    dh += gauche as f64 * t.gauche.dh_kcal * KCAL;

    // ---- symmetry
    let n_methyl = (0..n).filter(|&i| kinds[i] == Some(Kind::C) && h[i] == 3 && nbrs[i].len() == 1).count() as f64;
    let sigma = if n == 1 && kinds[0] == Some(Kind::C) && h[0] == 4 {
        // the C-(H)4 value is the entropy of methane itself (its sigma of 12 is already in it)
        1.0
    } else if !nonarom.is_empty() {
        // a non-aromatic ring: the bare cycloalkane's tabulated sigma, otherwise no external symmetry
        ring_sigma.unwrap_or(1.0) * 3f64.powf(n_methyl)
    } else {
        let aut = automorphisms(&mol, &nbrs, &h)? as f64;
        let mut halve = 0;
        for i in 0..n {
            if kinds[i] != Some(Kind::C) || ring[i] || h[i] >= 2 {
                continue;
            }
            let labels: Vec<String> = nbrs[i].iter().map(|&(j, _)| branch_label(&mol, &nbrs, j, i, 0)).collect();
            let repeated = labels.iter().any(|l| labels.iter().filter(|x| *x == l).count() >= 2);
            if repeated {
                halve += 1;
            }
        }
        aut / 2f64.powi(halve) * 3f64.powf(n_methyl)
    };
    s -= R_GAS * sigma.max(1.0).ln();

    // ---- formation Gibbs energy from the elements in their reference states
    let formula = mol.formula();
    let s_elements = crate::thermo::estimate::elements_entropy_sum(&formula);
    let dgf = dh - 298.15 * (s - s_elements) / 1000.0;
    Some(BensonEstimate { groups, dhf_gas_kj: dh, s_gas: s, dgf_gas_kj: dgf, sigma, gauche })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::smiles::parse;

    fn est(s: &str) -> BensonEstimate {
        estimate(&parse(s).unwrap()).unwrap_or_else(|| panic!("no Benson estimate for {}", s))
    }

    #[test]
    fn symmetry_numbers() {
        for (smi, sigma) in [
            ("C", 1.0), ("CC", 18.0), ("CCC", 18.0), ("CCCC", 18.0), ("CC(C)C", 81.0), ("CC(C)(C)C", 972.0), ("CCC(C)C", 27.0),
            ("CO", 3.0), ("CCO", 3.0), ("CC(C)(C)O", 81.0), ("CC(C)=O", 18.0), ("CCOCC", 18.0), ("c1ccccc1", 12.0), ("Cc1ccccc1", 6.0),
            ("C1CCCCC1", 6.0), ("C1CCCC1", 10.0),
        ] {
            assert_eq!(est(smi).sigma, sigma, "{}", smi);
        }
    }

    #[test]
    fn gauche_counts() {
        assert_eq!(est("CCCC").gauche, 0);
        assert_eq!(est("CCC(C)C").gauche, 1);
        assert_eq!(est("CC(C)C(C)C").gauche, 2);
        assert_eq!(est("CC(C)(C)CC").gauche, 2);
    }

    #[test]
    fn uncovered_atoms_give_no_estimate() {
        assert!(estimate(&parse("CCCl").unwrap()).is_none());
        assert!(estimate(&parse("CC(=O)[O-]").unwrap()).is_none());
        assert!(estimate(&parse("C1CC2CCC1C2").unwrap()).is_none(), "bridged ring");
    }
}
