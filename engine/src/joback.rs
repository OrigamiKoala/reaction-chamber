//! Joback group-contribution estimates over the SMILES graph (`smiles::Molecule`): normal boiling point, ideal-gas
//! enthalpy and Gibbs energy of formation and heat capacity of an arbitrary neutral organic molecule, plus the liquid
//! reference state derived from them (Trouton heat of vaporisation at Tb, Clausius-Clapeyron down to 298.15 K).
//!
//! This is the estimate of last resort for compounds the engine *creates* (products of the structure-based network
//! generator): every value is tier Estimated and never overrides measured data. The decomposition assigns every heavy atom
//! to exactly one of the 41 Joback groups; a molecule with an atom that no group covers (a charged atom, a metal, a
//! tertiary ring nitrogen) gets no estimate, because a value from an incomplete decomposition is not an estimate.
//!
//! Parameters: Joback & Reid, Chem. Eng. Commun. 57 (1987) 233, as tabulated in Reid, Prausnitz & Poling, "The Properties
//! of Gases and Liquids", 4th ed.; the same table as `pipeline/joback_estimator.py` (group names match).

use std::collections::HashMap;

use crate::physics::R_GAS;
use crate::smiles::Molecule;

/// (group, dTb K, dHf kJ/mol, dGf kJ/mol, Cp a, b, c, d)
const GROUPS: &[(&str, f64, f64, f64, f64, f64, f64, f64)] = &[
    ("-CH3", 23.58, -76.45, -43.96, 1.95e1, -8.08e-3, 1.53e-4, -9.67e-8),
    ("-CH2-", 22.88, -20.64, 8.42, -9.09e-1, 9.50e-2, -5.44e-5, 1.19e-8),
    (">CH-", 21.74, 29.89, 58.36, -2.30e1, 2.04e-1, -2.65e-4, 1.20e-7),
    (">C<", 18.25, 82.23, 116.02, -6.62e1, 4.27e-1, -6.41e-4, 3.01e-7),
    ("=CH2", 18.18, -9.63, 3.77, -4.14e0, 7.82e-2, -4.96e-5, 1.21e-8),
    ("=CH-", 24.96, 37.97, 48.53, -2.14e1, 1.77e-1, -2.12e-4, 9.45e-8),
    ("=C<", 24.14, 83.99, 92.36, -8.25e0, 1.01e-1, -1.42e-4, 6.78e-8),
    ("=C=", 26.15, 142.14, 136.70, 2.74e1, -5.57e-2, 1.01e-4, -5.02e-8),
    ("#CH", 9.20, 79.30, 77.71, 2.45e1, -2.71e-2, 1.11e-4, -6.78e-8),
    ("#C-", 27.38, 115.34, 109.82, 7.87, 2.01e-2, -8.33e-6, 1.39e-9),
    ("-CH2- (ring)", 27.15, -26.80, -3.68, -6.03e0, 8.54e-2, -8.00e-6, -1.80e-8),
    (">CH- (ring)", 21.78, 8.67, 40.99, -2.05e1, 1.62e-1, -1.60e-4, 6.24e-8),
    (">C< (ring)", 21.32, 79.72, 87.88, -9.09e1, 5.57e-1, -9.00e-4, 4.69e-7),
    ("=CH- (ring)", 26.73, 2.09, 11.30, -2.14e0, 5.74e-2, -1.64e-6, -1.59e-8),
    ("=C< (ring)", 31.01, 46.43, 54.05, -8.25e0, 1.01e-1, -1.42e-4, 6.78e-8),
    ("-F", -0.03, -251.92, -247.19, 2.65e1, -9.13e-2, 1.91e-4, -1.03e-7),
    ("-Cl", 38.13, -71.55, -64.31, 3.33e1, -9.63e-2, 1.87e-4, -9.96e-8),
    ("-Br", 66.86, -29.48, -38.06, 2.86e1, -6.49e-2, 1.36e-4, -7.45e-8),
    ("-I", 93.84, 21.06, 5.74, 3.21e1, -6.41e-2, 1.26e-4, -6.87e-8),
    ("-OH (alcohol)", 92.88, -208.04, -189.20, 2.57e1, -6.91e-2, 1.77e-4, -9.88e-8),
    ("-OH (phenol)", 76.34, -221.65, -197.37, -2.81e0, 1.11e-1, -1.16e-4, 4.94e-8),
    ("-O- (non-ring)", 22.42, -132.22, -105.00, 2.55e1, -6.32e-2, 1.11e-4, -5.48e-8),
    ("-O- (ring)", 31.22, -138.16, -98.22, 1.22e1, -1.26e-2, 6.03e-5, -3.86e-8),
    (">C=O (non-ring)", 76.75, -133.22, -120.50, 6.45e0, 6.70e-2, -3.57e-5, 2.86e-9),
    (">C=O (ring)", 94.97, -164.50, -126.27, 3.04e1, -8.29e-2, 2.36e-4, -1.31e-7),
    ("O=CH- (aldehyde)", 72.24, -162.03, -143.48, 3.09e1, -3.36e-2, 1.60e-4, -9.88e-8),
    ("-COOH (acid)", 169.09, -426.72, -387.87, 2.41e1, 4.27e-2, 8.04e-5, -6.87e-8),
    ("-COO- (ester)", 81.10, -337.92, -301.95, 2.45e1, 4.02e-2, 4.02e-5, -4.52e-8),
    ("=O (other)", -10.50, -247.61, -250.83, 6.82e0, 1.96e-2, 1.27e-5, -1.78e-8),
    ("-NH2", 73.23, -22.02, 14.07, 2.69e1, -4.12e-2, 1.64e-4, -9.76e-8),
    (">NH (non-ring)", 50.17, 53.47, 89.39, -1.21e0, 7.62e-2, -4.86e-5, 1.05e-8),
    (">NH (ring)", 52.82, 31.65, 75.61, 1.18e1, -2.30e-2, 1.07e-4, -6.28e-8),
    (">N- (non-ring)", 11.74, 123.34, 163.16, -3.11e1, 2.27e-1, -3.20e-4, 1.46e-7),
    ("-N= (ring)", 57.55, 55.52, 79.93, 8.83e0, -3.84e-3, 4.35e-5, -2.60e-8),
    ("=NH", 83.08, 93.70, 119.66, 5.69e0, -4.12e-3, 1.28e-4, -8.88e-8),
    ("-CN", 125.66, 88.43, 89.22, 3.65e1, -7.33e-2, 1.84e-4, -1.03e-7),
    ("-NO2", 152.54, -66.57, -16.83, 2.59e1, -3.74e-3, 1.29e-4, -8.88e-8),
    ("-SH", 63.56, -17.33, -22.99, 3.53e1, -7.58e-2, 1.85e-4, -1.03e-7),
    ("-S- (non-ring)", 68.78, 41.87, 33.12, 1.96e1, -5.61e-3, 4.02e-5, -2.76e-8),
    ("-S- (ring)", 52.10, 39.10, 27.76, 1.67e1, 4.81e-3, 2.77e-5, -2.11e-8),
];

/// Joback estimate of one molecule (ideal gas at 298.15 K unless stated).
#[derive(Clone, Debug)]
pub struct JobackEstimate {
    pub groups: HashMap<&'static str, u32>,
    pub tb_k: f64,
    pub dhf_gas_kj: f64,
    pub dgf_gas_kj: f64,
    /// Cp(T) = a + b T + c T^2 + d T^3, J/(mol K)
    pub cp_coeffs: [f64; 4],
}

impl JobackEstimate {
    pub fn cp_gas(&self, t_k: f64) -> f64 {
        let [a, b, c, d] = self.cp_coeffs;
        a + b * t_k + c * t_k * t_k + d * t_k * t_k * t_k
    }

    /// Heat of vaporisation at Tb from Trouton's rule (88 J/(mol K)), kJ/mol.
    pub fn dh_vap_kj(&self) -> f64 {
        0.088 * self.tb_k
    }

    /// Vapour pressure (Pa) at `t_k` by Clausius-Clapeyron through (Tb, 1 atm) with the Trouton heat.
    pub fn psat_pa(&self, t_k: f64) -> f64 {
        101_325.0 * (-(self.dh_vap_kj() * 1000.0 / R_GAS) * (1.0 / t_k - 1.0 / self.tb_k)).exp()
    }

    /// Liquid standard state at 298.15 K: dfH(l) = dfH(g) - dHvap, dfG(l) = dfG(g) + RT ln(Psat / 1 bar).
    pub fn liquid_formation_kj(&self) -> (f64, f64) {
        self.liquid_formation_from_gas_kj(self.dhf_gas_kj, self.dgf_gas_kj)
    }

    /// The same liquid reference state built on another ideal-gas formation enthalpy and Gibbs energy (e.g. Benson's)
    /// with this estimate's vapour pressure curve.
    pub fn liquid_formation_from_gas_kj(&self, dhf_gas_kj: f64, dgf_gas_kj: f64) -> (f64, f64) {
        let t = 298.15;
        let dhf_l = dhf_gas_kj - self.dh_vap_kj();
        let dgf_l = dgf_gas_kj + R_GAS * t * (self.psat_pa(t) / 1e5).ln() / 1000.0;
        (dhf_l, dgf_l)
    }
}

/// Atoms that lie on a ring (an atom is in a ring when one of its bonds is not a bridge).
pub(crate) fn ring_atoms(mol: &Molecule) -> Vec<bool> {
    let n = mol.atoms.len();
    let mut adj: Vec<Vec<(usize, usize)>> = vec![Vec::new(); n];
    for (bi, &(a, b, _)) in mol.bonds.iter().enumerate() {
        adj[a].push((b, bi));
        adj[b].push((a, bi));
    }
    let mut disc = vec![usize::MAX; n];
    let mut low = vec![0usize; n];
    let mut bridge = vec![false; mol.bonds.len()];
    let mut time = 0;
    for root in 0..n {
        if disc[root] != usize::MAX {
            continue;
        }
        // iterative DFS: (node, parent edge, next neighbour index)
        let mut stack: Vec<(usize, usize, usize)> = vec![(root, usize::MAX, 0)];
        disc[root] = time;
        low[root] = time;
        time += 1;
        while let Some(&mut (u, pe, ref mut it)) = stack.last_mut() {
            if *it < adj[u].len() {
                let (v, e) = adj[u][*it];
                *it += 1;
                if e == pe {
                    continue;
                }
                if disc[v] == usize::MAX {
                    disc[v] = time;
                    low[v] = time;
                    time += 1;
                    stack.push((v, e, 0));
                } else {
                    low[u] = low[u].min(disc[v]);
                }
            } else {
                stack.pop();
                if let Some(&(p, _, _)) = stack.last() {
                    low[p] = low[p].min(low[u]);
                    if low[u] > disc[p] {
                        bridge[pe] = true;
                    }
                }
            }
        }
    }
    let mut ring = vec![false; n];
    for (bi, &(a, b, _)) in mol.bonds.iter().enumerate() {
        if !bridge[bi] {
            ring[a] = true;
            ring[b] = true;
        }
    }
    ring
}

/// Joback decomposition: every heavy atom assigned to exactly one group, or None.
pub fn decompose(mol: &Molecule) -> Option<HashMap<&'static str, u32>> {
    let n = mol.atoms.len();
    if n == 0 || mol.atoms.iter().any(|a| a.charge != 0) {
        return None;
    }
    let ring = ring_atoms(mol);
    let h: Vec<u32> = (0..n).map(|i| mol.hydrogens(i)).collect();
    let el = |i: usize| mol.atoms[i].element.as_str();
    let nbrs: Vec<Vec<(usize, f64)>> = (0..n).map(|i| mol.neighbours(i)).collect();
    let mut assigned = vec![false; n];
    let mut counts: HashMap<&'static str, u32> = HashMap::new();
    let mut claim = |atoms: &[usize], g: &'static str, assigned: &mut Vec<bool>| -> bool {
        if atoms.iter().any(|&a| assigned[a]) {
            return false;
        }
        for &a in atoms {
            assigned[a] = true;
        }
        *counts.entry(g).or_insert(0) += 1;
        true
    };
    let carbonyl_o = |c: usize| -> Option<usize> {
        nbrs[c].iter().find(|&&(o, b)| el(o) == "O" && (b - 2.0).abs() < 1e-9 && nbrs[o].len() == 1).map(|&(o, _)| o)
    };

    // multi-atom functional groups, most specific first
    for c in 0..n {
        if el(c) != "C" || mol.atoms[c].aromatic {
            continue;
        }
        let Some(o1) = carbonyl_o(c) else { continue };
        let single_o: Vec<usize> = nbrs[c].iter().filter(|&&(o, b)| el(o) == "O" && (b - 1.0).abs() < 1e-9).map(|&(o, _)| o).collect();
        if let Some(&oh) = single_o.iter().find(|&&o| h[o] == 1) {
            claim(&[c, o1, oh], "-COOH (acid)", &mut assigned);
        } else if let Some(&oe) = single_o.iter().find(|&&o| h[o] == 0 && nbrs[o].iter().any(|&(x, _)| x != c && el(x) == "C")) {
            claim(&[c, o1, oe], "-COO- (ester)", &mut assigned);
        }
    }
    for i in 0..n {
        if el(i) == "C" && !assigned[i] {
            for &(j, b) in &nbrs[i] {
                if el(j) == "N" && (b - 3.0).abs() < 1e-9 && nbrs[j].len() == 1 {
                    claim(&[i, j], "-CN", &mut assigned);
                }
            }
        }
    }
    for c in 0..n {
        if el(c) != "C" || assigned[c] || mol.atoms[c].aromatic {
            continue;
        }
        if let Some(o) = carbonyl_o(c) {
            if h[c] >= 1 {
                claim(&[c, o], "O=CH- (aldehyde)", &mut assigned);
            } else {
                claim(&[c, o], if ring[c] { ">C=O (ring)" } else { ">C=O (non-ring)" }, &mut assigned);
            }
        }
    }
    for o in 0..n {
        if el(o) == "O" && !assigned[o] && nbrs[o].len() == 1 && (nbrs[o][0].1 - 2.0).abs() < 1e-9 && el(nbrs[o][0].0) != "C" && el(nbrs[o][0].0) != "N" {
            claim(&[o], "=O (other)", &mut assigned);
        }
    }

    // remaining atoms by element
    for i in 0..n {
        if assigned[i] {
            continue;
        }
        let arom = mol.atoms[i].aromatic;
        let n_double = nbrs[i].iter().filter(|&&(_, b)| (b - 2.0).abs() < 1e-9).count();
        let n_triple = nbrs[i].iter().filter(|&&(_, b)| (b - 3.0).abs() < 1e-9).count();
        let g: &'static str = match el(i) {
            "C" => {
                if n_triple > 0 {
                    if h[i] == 1 { "#CH" } else { "#C-" }
                } else if n_double == 2 {
                    "=C="
                } else if arom || n_double == 1 {
                    if ring[i] {
                        if h[i] == 1 { "=CH- (ring)" } else { "=C< (ring)" }
                    } else if h[i] == 2 {
                        "=CH2"
                    } else if h[i] == 1 {
                        "=CH-"
                    } else {
                        "=C<"
                    }
                } else if ring[i] {
                    match h[i] { 2 => "-CH2- (ring)", 1 => ">CH- (ring)", 0 => ">C< (ring)", _ => return None }
                } else {
                    match h[i] { 3 => "-CH3", 2 => "-CH2-", 1 => ">CH-", 0 => ">C<", _ => return None }
                }
            }
            "O" => {
                if h[i] == 1 && nbrs[i].len() == 1 {
                    if mol.atoms[nbrs[i][0].0].aromatic { "-OH (phenol)" } else { "-OH (alcohol)" }
                } else if h[i] == 0 && nbrs[i].len() == 2 {
                    if ring[i] { "-O- (ring)" } else { "-O- (non-ring)" }
                } else {
                    return None;
                }
            }
            "N" => {
                if arom {
                    if h[i] == 1 { ">NH (ring)" } else if nbrs[i].len() == 2 { "-N= (ring)" } else { return None }
                } else if n_double == 1 {
                    if h[i] == 1 { "=NH" } else if ring[i] { "-N= (ring)" } else { return None }
                } else {
                    match (h[i], ring[i]) {
                        (2, _) => "-NH2",
                        (1, true) => ">NH (ring)",
                        (1, false) => ">NH (non-ring)",
                        (0, false) => ">N- (non-ring)",
                        _ => return None,
                    }
                }
            }
            "F" => "-F",
            "Cl" => "-Cl",
            "Br" => "-Br",
            "I" => "-I",
            "S" => {
                if h[i] == 1 { "-SH" } else if ring[i] { "-S- (ring)" } else { "-S- (non-ring)" }
            }
            _ => return None,
        };
        claim(&[i], g, &mut assigned);
    }
    if assigned.iter().all(|&a| a) {
        Some(counts)
    } else {
        None
    }
}

/// Joback estimate for a molecule, or None when its decomposition is incomplete.
pub fn estimate(mol: &Molecule) -> Option<JobackEstimate> {
    let groups = decompose(mol)?;
    let (mut tb, mut hf, mut gf) = (0.0, 0.0, 0.0);
    let mut cp = [0.0; 4];
    for (g, &k) in &groups {
        let row = GROUPS.iter().find(|r| r.0 == *g)?;
        let k = k as f64;
        tb += k * row.1;
        hf += k * row.2;
        gf += k * row.3;
        cp[0] += k * row.4;
        cp[1] += k * row.5;
        cp[2] += k * row.6;
        cp[3] += k * row.7;
    }
    Some(JobackEstimate {
        groups,
        tb_k: 198.0 + tb,
        dhf_gas_kj: 68.29 + hf,
        dgf_gas_kj: 53.88 + gf,
        cp_coeffs: [cp[0] - 37.93, cp[1] + 0.210, cp[2] - 3.91e-4, cp[3] + 2.06e-7],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::smiles::parse;

    #[test]
    fn ethanol_and_ethyl_acetate_are_near_their_measured_values() {
        // ethanol: dfH(g) -234.8, Tb 351.4 K; ethyl acetate: dfH(g) -443.6, Tb 350.2 K (NIST)
        let e = estimate(&parse("CCO").unwrap()).unwrap();
        assert!((e.dhf_gas_kj + 234.8).abs() < 15.0, "{}", e.dhf_gas_kj);
        assert!((e.tb_k - 351.4).abs() < 25.0, "{}", e.tb_k);
        let ea = estimate(&parse("CC(=O)OCC").unwrap()).unwrap();
        assert!((ea.dhf_gas_kj + 443.6).abs() < 25.0, "{}", ea.dhf_gas_kj);
        assert_eq!(ea.groups.get("-COO- (ester)"), Some(&1));
    }

    #[test]
    fn rings_and_unsupported_atoms() {
        let c6 = estimate(&parse("C1CCCCC1").unwrap()).unwrap();
        assert_eq!(c6.groups.get("-CH2- (ring)"), Some(&6));
        let benzene = estimate(&parse("c1ccccc1").unwrap()).unwrap();
        assert_eq!(benzene.groups.get("=CH- (ring)"), Some(&6));
        assert!(estimate(&parse("CC(=O)[O-]").unwrap()).is_none(), "ions are outside the method");
        // liquid is more stable than gas at 298 K for a compound boiling above it
        let (hl, gl) = e_liquid("CCCCO");
        let g = estimate(&parse("CCCCO").unwrap()).unwrap();
        assert!(hl < g.dhf_gas_kj && gl < g.dgf_gas_kj);
    }

    fn e_liquid(s: &str) -> (f64, f64) {
        estimate(&parse(s).unwrap()).unwrap().liquid_formation_kj()
    }
}
