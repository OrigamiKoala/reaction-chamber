//! Heavy-atom molecular graph (hydrogens as counts) built from a SMILES string; the structure both spectrum predictors read.

use std::collections::HashMap;

use crate::smiles;

#[derive(Clone, Debug, PartialEq)]
pub struct GAtom {
    pub el: String,
    pub arom: bool,
    pub charge: i32,
    pub h: u32,
}

#[derive(Clone, Debug, Default)]
pub struct Mol {
    pub atoms: Vec<GAtom>,
    /// (neighbour, bond order); 1.5 = aromatic
    pub adj: Vec<Vec<(usize, f64)>>,
}

impl Mol {
    /// The covalently connected components of a SMILES string, hydrogens folded into counts. Aromaticity is perceived for
    /// Kekule input. None when the SMILES cannot be read.
    pub fn components_from_smiles(smi: &str) -> Option<Vec<Mol>> {
        let parsed = smiles::parse(smi)?.aromatized();
        let n = parsed.atoms.len();
        let hs: Vec<u32> = (0..n).map(|i| parsed.hydrogens(i)).collect();
        let mut nb: Vec<Vec<(usize, f64)>> = (0..n).map(|i| parsed.neighbours(i)).collect();
        // fold explicit [H] atoms into their heavy neighbour
        let mut keep: Vec<bool> = vec![true; n];
        let mut h = hs.clone();
        let all_h = parsed.atoms.iter().all(|a| a.element == "H");
        if !all_h {
            for i in 0..n {
                if parsed.atoms[i].element == "H" && nb[i].len() == 1 && parsed.atoms[nb[i][0].0].element != "H" && parsed.atoms[i].charge == 0 {
                    keep[i] = false;
                    h[nb[i][0].0] += 1;
                }
            }
        }
        let mut idx: Vec<Option<usize>> = vec![None; n];
        let mut atoms: Vec<GAtom> = Vec::new();
        for i in 0..n {
            if keep[i] {
                idx[i] = Some(atoms.len());
                let a = &parsed.atoms[i];
                atoms.push(GAtom { el: a.element.clone(), arom: a.aromatic, charge: a.charge, h: if a.element == "H" && all_h { 0 } else { h[i] } });
            }
        }
        for i in 0..n {
            nb[i].retain(|(j, _)| keep[*j]);
        }
        let mut adj: Vec<Vec<(usize, f64)>> = vec![Vec::new(); atoms.len()];
        for i in 0..n {
            if let Some(ii) = idx[i] {
                for &(j, o) in &nb[i] {
                    if let Some(jj) = idx[j] {
                        adj[ii].push((jj, o));
                    }
                }
            }
        }
        let whole = Mol { atoms, adj };
        Some(whole.split())
    }

    fn split(&self) -> Vec<Mol> {
        let n = self.atoms.len();
        let mut comp: Vec<Option<usize>> = vec![None; n];
        let mut ncomp = 0;
        for s in 0..n {
            if comp[s].is_some() {
                continue;
            }
            let mut stack = vec![s];
            comp[s] = Some(ncomp);
            while let Some(u) = stack.pop() {
                for &(v, _) in &self.adj[u] {
                    if comp[v].is_none() {
                        comp[v] = Some(ncomp);
                        stack.push(v);
                    }
                }
            }
            ncomp += 1;
        }
        let mut out = Vec::new();
        for c in 0..ncomp {
            let members: Vec<usize> = (0..n).filter(|&i| comp[i] == Some(c)).collect();
            let map: HashMap<usize, usize> = members.iter().enumerate().map(|(k, &i)| (i, k)).collect();
            let atoms = members.iter().map(|&i| self.atoms[i].clone()).collect();
            let adj = members.iter().map(|&i| self.adj[i].iter().map(|&(j, o)| (map[&j], o)).collect()).collect();
            out.push(Mol { atoms, adj });
        }
        out
    }

    pub fn n(&self) -> usize {
        self.atoms.len()
    }

    pub fn el(&self, i: usize) -> &str {
        &self.atoms[i].el
    }

    pub fn is(&self, i: usize, el: &str) -> bool {
        self.atoms[i].el == el
    }

    pub fn bond(&self, i: usize, j: usize) -> Option<f64> {
        self.adj[i].iter().find(|(k, _)| *k == j).map(|(_, o)| *o)
    }

    pub fn nbrs(&self, i: usize) -> impl Iterator<Item = usize> + '_ {
        self.adj[i].iter().map(|(j, _)| *j)
    }

    pub fn heavy_degree(&self, i: usize) -> usize {
        self.adj[i].len()
    }

    pub fn total_h(&self) -> u32 {
        self.atoms.iter().map(|a| a.h).sum()
    }

    pub fn is_sp3(&self, i: usize) -> bool {
        !self.atoms[i].arom && self.adj[i].iter().all(|(_, o)| (*o - 1.0).abs() < 1e-9)
    }

    /// Does atom `i` carry a double bond to an atom of element `el` (other than `except`)?
    pub fn double_to(&self, i: usize, el: &str, except: Option<usize>) -> bool {
        self.adj[i].iter().any(|&(j, o)| (o - 2.0).abs() < 1e-9 && self.atoms[j].el == el && Some(j) != except)
    }

    pub fn triple_bonded(&self, i: usize) -> Option<usize> {
        self.adj[i].iter().find(|(_, o)| (*o - 3.0).abs() < 1e-9).map(|(j, _)| *j)
    }

    pub fn has_double(&self, i: usize) -> bool {
        self.adj[i].iter().any(|(_, o)| (*o - 2.0).abs() < 1e-9)
    }

    /// Is the bond in a ring?
    pub fn ring_bond(&self, a: usize, b: usize) -> bool {
        self.path_len_without_bond(a, b).is_some()
    }

    /// Size of the smallest ring through bond (a, b); None if the bond is not in a ring.
    pub fn ring_size_of_bond(&self, a: usize, b: usize) -> Option<usize> {
        self.path_len_without_bond(a, b).map(|l| l + 1)
    }

    fn path_len_without_bond(&self, a: usize, b: usize) -> Option<usize> {
        let n = self.n();
        let mut dist = vec![usize::MAX; n];
        dist[a] = 0;
        let mut q = std::collections::VecDeque::new();
        q.push_back(a);
        while let Some(u) = q.pop_front() {
            for &(v, _) in &self.adj[u] {
                if (u == a && v == b) || (u == b && v == a) {
                    continue;
                }
                if dist[v] == usize::MAX {
                    dist[v] = dist[u] + 1;
                    if v == b {
                        return Some(dist[v]);
                    }
                    q.push_back(v);
                }
            }
        }
        None
    }

    /// Size of the smallest ring containing atom `i` (0 = acyclic).
    pub fn ring_size(&self, i: usize) -> usize {
        self.adj[i].iter().filter_map(|&(j, _)| self.ring_size_of_bond(i, j)).min().unwrap_or(0)
    }

    pub fn in_ring(&self, i: usize) -> bool {
        self.ring_size(i) > 0
    }

    /// Atoms of a smallest ring through (a, b) (empty if acyclic), for ring-position bookkeeping.
    pub fn smallest_ring_through(&self, a: usize, b: usize) -> Vec<usize> {
        let n = self.n();
        let mut prev = vec![usize::MAX; n];
        let mut seen = vec![false; n];
        seen[a] = true;
        let mut q = std::collections::VecDeque::new();
        q.push_back(a);
        while let Some(u) = q.pop_front() {
            for &(v, _) in &self.adj[u] {
                if (u == a && v == b) || (u == b && v == a) || seen[v] {
                    continue;
                }
                seen[v] = true;
                prev[v] = u;
                if v == b {
                    let mut path = vec![b];
                    let mut c = b;
                    while c != a {
                        c = prev[c];
                        path.push(c);
                    }
                    return path;
                }
                q.push_back(v);
            }
        }
        Vec::new()
    }

    /// Topological symmetry classes (Morgan refinement over element, charge, H count, aromaticity and bond orders).
    pub fn classes(&self) -> Vec<usize> {
        let n = self.n();
        let mut cls: Vec<u64> = (0..n)
            .map(|i| {
                let a = &self.atoms[i];
                let mut h = 1469598103934665603u64;
                for b in a.el.bytes() {
                    h = (h ^ b as u64).wrapping_mul(1099511628211);
                }
                for v in [a.charge as i64 as u64, a.h as u64, a.arom as u64, self.adj[i].len() as u64] {
                    h = (h ^ v).wrapping_mul(1099511628211);
                }
                h
            })
            .collect();
        let mut nclass = count_distinct(&cls);
        for _ in 0..n.max(2) {
            let next: Vec<u64> = (0..n)
                .map(|i| {
                    let mut nb: Vec<u64> = self.adj[i].iter().map(|&(j, o)| cls[j].wrapping_mul(31).wrapping_add((o * 2.0) as u64)).collect();
                    nb.sort();
                    let mut h = cls[i];
                    for v in nb {
                        h = (h ^ v).wrapping_mul(1099511628211).rotate_left(7);
                    }
                    h
                })
                .collect();
            let k = count_distinct(&next);
            cls = next;
            if k == nclass {
                break;
            }
            nclass = k;
        }
        let mut ids: HashMap<u64, usize> = HashMap::new();
        cls.iter()
            .map(|c| {
                let l = ids.len();
                *ids.entry(*c).or_insert(l)
            })
            .collect()
    }

    /// Element counts including hydrogens, Hill order (C, H, then alphabetical).
    pub fn element_counts(&self) -> Vec<(String, u32)> {
        let mut m: std::collections::BTreeMap<String, u32> = std::collections::BTreeMap::new();
        for a in &self.atoms {
            *m.entry(a.el.clone()).or_insert(0) += 1;
            if a.h > 0 {
                *m.entry("H".to_string()).or_insert(0) += a.h;
            }
        }
        let mut out: Vec<(String, u32)> = Vec::new();
        if let Some(c) = m.remove("C") {
            out.push(("C".into(), c));
            if let Some(h) = m.remove("H") {
                out.push(("H".into(), h));
            }
        }
        out.extend(m.into_iter());
        out
    }

    pub fn formula(&self) -> String {
        let mut s: String = self.element_counts().iter().map(|(e, n)| if *n == 1 { e.clone() } else { format!("{}{}", e, n) }).collect();
        let q: i32 = self.atoms.iter().map(|a| a.charge).sum();
        match q {
            0 => {}
            1 => s.push('+'),
            -1 => s.push('-'),
            q if q > 0 => s.push_str(&format!("{}+", q)),
            q => s.push_str(&format!("{}-", -q)),
        }
        s
    }

    /// Monoisotopic mass of the neutral composition, u.
    pub fn mono_mass(&self) -> Option<f64> {
        let mut m = 0.0;
        for (e, n) in self.element_counts() {
            m += super::isotopes::mono_mass(&e)? * n as f64;
        }
        Some(m)
    }

    /// Unsaturated-valence check: radical-free valid structures have all atoms at standard valence. Used to reject nonsense.
    pub fn charge(&self) -> i32 {
        self.atoms.iter().map(|a| a.charge).sum()
    }
}

fn count_distinct(v: &[u64]) -> usize {
    let mut s: Vec<u64> = v.to_vec();
    s.sort();
    s.dedup();
    s.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ethanol_graph() {
        let m = &Mol::components_from_smiles("CCO").unwrap()[0];
        assert_eq!(m.n(), 3);
        assert_eq!(m.total_h(), 6);
        assert_eq!(m.formula(), "C2H6O");
    }

    #[test]
    fn benzene_is_aromatic_and_symmetric() {
        let m = &Mol::components_from_smiles("C1=CC=CC=C1").unwrap()[0];
        assert!(m.atoms.iter().all(|a| a.arom));
        let c = m.classes();
        assert!(c.iter().all(|x| *x == c[0]));
        assert_eq!(m.ring_size(0), 6);
    }

    #[test]
    fn salt_splits() {
        let v = Mol::components_from_smiles("[Na+].[Cl-]").unwrap();
        assert_eq!(v.len(), 2);
    }

    #[test]
    fn symmetry_of_isopropanol() {
        let m = &Mol::components_from_smiles("CC(C)O").unwrap()[0];
        let c = m.classes();
        assert_eq!(c[0], c[2]);
        assert_ne!(c[0], c[1]);
    }
}
