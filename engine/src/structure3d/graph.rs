//! The molecular graph the 3D builder embeds: heavy atoms (and explicit hydrogens) in order, implicit hydrogens as counts,
//! bonds with order, aromatic and coordinate (metal-ligand) flags. Built from a SMILES string or by the formula rule; the
//! Lewis assignment gives formula-built fragments their bond orders and formal charges.

use super::data;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct GBond {
    pub a: usize,
    pub b: usize,
    pub order: f64,
    pub aromatic: bool,
    /// A dative / ionic bond to a metal: it does not use the ligand's valence (the ligand gives a lone pair).
    pub coordinate: bool,
}

#[derive(Clone, Debug, Default)]
pub struct BuildGraph {
    pub el: Vec<String>,
    pub charge: Vec<i32>,
    pub arom: Vec<bool>,
    /// Implicit hydrogens of each atom.
    pub hcount: Vec<u32>,
    /// Oxidation state of a metal atom when the builder knows it (d-electron count for the coordination geometry).
    pub ox: Vec<Option<i32>>,
    pub bonds: Vec<GBond>,
}

impl BuildGraph {
    pub fn n(&self) -> usize {
        self.el.len()
    }

    pub fn add_atom(&mut self, el: &str, charge: i32) -> usize {
        self.el.push(el.to_string());
        self.charge.push(charge);
        self.arom.push(false);
        self.hcount.push(0);
        self.ox.push(None);
        self.el.len() - 1
    }

    pub fn add_bond(&mut self, a: usize, b: usize, order: f64, coordinate: bool) -> usize {
        self.bonds.push(GBond { a, b, order, aromatic: false, coordinate });
        self.bonds.len() - 1
    }

    /// Appends another graph (disconnected); returns the index offset of its atoms.
    pub fn append(&mut self, other: &BuildGraph) -> usize {
        let off = self.n();
        self.el.extend(other.el.iter().cloned());
        self.charge.extend(other.charge.iter().copied());
        self.arom.extend(other.arom.iter().copied());
        self.hcount.extend(other.hcount.iter().copied());
        self.ox.extend(other.ox.iter().copied());
        self.bonds.extend(other.bonds.iter().map(|b| GBond { a: b.a + off, b: b.b + off, ..*b }));
        off
    }

    /// (neighbour, bond index) pairs of atom `i`.
    pub fn neighbours(&self, i: usize) -> Vec<(usize, usize)> {
        self.bonds
            .iter()
            .enumerate()
            .filter_map(|(k, b)| if b.a == i { Some((b.b, k)) } else if b.b == i { Some((b.a, k)) } else { None })
            .collect()
    }

    pub fn is_metal(&self, i: usize) -> bool {
        data::is_metal(&self.el[i])
    }

    /// Covalent bonds (not coordinate) plus implicit hydrogens.
    pub fn sigma_degree(&self, i: usize) -> i32 {
        self.bonds.iter().filter(|b| !b.coordinate && (b.a == i || b.b == i)).count() as i32 + self.hcount[i] as i32
    }

    /// Sum of covalent bond orders plus implicit hydrogens.
    pub fn bond_order_sum(&self, i: usize) -> f64 {
        self.bonds.iter().filter(|b| !b.coordinate && (b.a == i || b.b == i)).map(|b| b.order).sum::<f64>() + self.hcount[i] as f64
    }

    /// Lone pairs of a non-metal atom from its valence electrons, formal charge and bonds (a donor's coordinate bonds each
    /// use one); 0 for metals and for elements without a main-group valence count.
    pub fn lone_pairs(&self, i: usize) -> i32 {
        if self.is_metal(i) {
            return 0;
        }
        let Some(v) = data::valence_electrons(&self.el[i]) else { return 0 };
        let raw = ((v - self.charge[i]) as f64 - self.bond_order_sum(i)) / 2.0;
        let donated = self.bonds.iter().filter(|b| b.coordinate && (b.a == i || b.b == i)).count() as i32;
        (raw.floor() as i32 - donated).max(0)
    }

    /// Element counts including the implicit hydrogens.
    pub fn element_counts(&self) -> std::collections::HashMap<String, f64> {
        let mut m: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
        for i in 0..self.n() {
            *m.entry(self.el[i].clone()).or_insert(0.0) += 1.0;
            if self.hcount[i] > 0 {
                *m.entry("H".to_string()).or_insert(0.0) += self.hcount[i] as f64;
            }
        }
        m
    }

    /// Does the graph have exactly this composition?
    pub fn has_composition(&self, elems: &std::collections::HashMap<String, f64>) -> bool {
        let m = self.element_counts();
        m.len() == elems.len() && elems.iter().all(|(e, n)| (m.get(e).copied().unwrap_or(0.0) - n).abs() < 1e-6)
    }

    pub fn total_charge(&self) -> i32 {
        self.charge.iter().sum()
    }

    /// The graph of a SMILES string with the atom order kept (Kekule rings perceived aromatic; explicit `[H]` atoms stay atoms).
    pub fn from_smiles(smi: &str) -> Option<BuildGraph> {
        let m = crate::smiles::parse(smi)?.perceived();
        if m.atoms.is_empty() {
            return None;
        }
        let mut g = BuildGraph::default();
        for (i, a) in m.atoms.iter().enumerate() {
            data::element(&a.element)?;
            let k = g.add_atom(&a.element, a.charge);
            g.arom[k] = a.aromatic;
            g.hcount[k] = m.hydrogens(i);
            if g.is_metal(k) {
                g.ox[k] = Some(a.charge);
            }
        }
        for &(a, b, o) in &m.bonds {
            let aromatic = (o - 1.5).abs() < 1e-9;
            g.bonds.push(GBond { a, b, order: o, aromatic, coordinate: false });
        }
        Some(g)
    }
}

/// Bond orders and formal charges of the non-metal atoms `atoms` of `g` (all their covalent bonds start as single bonds),
/// as a Lewis structure: each atom takes one of its standard valences, free valences pair up into multiple bonds, and what
/// is left becomes negative charge (as far as `target` asks for it) or lone pairs. The combination of valences that brings
/// the charge closest to `target` (0 when unknown) with the fewest unpaired valences and the lowest valences wins.
/// Returns the fragment's resulting charge.
pub fn assign_lewis(g: &mut BuildGraph, atoms: &[usize], target: Option<i32>) -> i32 {
    let t = target.unwrap_or(0);
    let local: Vec<usize> = atoms.iter().copied().filter(|&i| !g.is_metal(i)).collect();
    if local.is_empty() {
        return 0;
    }
    let pos = |i: usize| local.iter().position(|&x| x == i);
    // covalent bonds inside the fragment
    let fbonds: Vec<usize> = (0..g.bonds.len())
        .filter(|&k| !g.bonds[k].coordinate && pos(g.bonds[k].a).is_some() && pos(g.bonds[k].b).is_some())
        .collect();
    for &k in &fbonds {
        g.bonds[k].order = 1.0;
        g.bonds[k].aromatic = false;
    }
    let sigma: Vec<i32> = local.iter().map(|&i| g.sigma_degree(i)).collect();
    // options: (valence, formal charge)
    let options: Vec<Vec<(i32, i32)>> = local
        .iter()
        .enumerate()
        .map(|(li, &i)| {
            let el = &g.el[i];
            let mut vals = data::valences(el);
            // pentavalent nitrogen only as the centre of an oxo group (nitrate, nitro)
            if data::group(el) == Some(15) && data::element(el).map_or(false, |r| r.z <= 10) {
                let n_o = g.neighbours(i).iter().filter(|(j, _)| g.el[*j] == "O").count();
                if n_o < 2 {
                    vals.retain(|v| *v == 3);
                }
            }
            let mut opts: Vec<(i32, i32)> = vals.iter().filter(|&&v| v >= sigma[li]).map(|&v| (v, 0)).collect();
            if opts.is_empty() {
                let fc = match data::group(el) {
                    Some(15) | Some(16) => 1,
                    Some(13) => -1,
                    _ => 0,
                };
                opts.push((sigma[li], fc));
            }
            opts
        })
        .collect();
    // enumerate the combinations of the atoms that have a choice (capped)
    let multi: Vec<usize> = (0..local.len()).filter(|&li| options[li].len() > 1).collect();
    let mut total: usize = 1;
    let mut free_multi: Vec<usize> = Vec::new();
    for &li in &multi {
        if total * options[li].len() <= 512 {
            total *= options[li].len();
            free_multi.push(li);
        }
    }
    let nb_local: Vec<Vec<(usize, usize)>> = local
        .iter()
        .map(|&i| fbonds.iter().filter_map(|&k| {
            let b = g.bonds[k];
            if b.a == i { pos(b.b).map(|j| (j, k)) } else if b.b == i { pos(b.a).map(|j| (j, k)) } else { None }
        }).collect())
        .collect();
    let mut best: Option<((i32, i32, i32), Vec<(i32, i32)>, Vec<(usize, f64)>, Vec<i32>)> = None;
    for combo in 0..total {
        let mut choice: Vec<(i32, i32)> = options.iter().map(|o| o[0]).collect();
        let mut c = combo;
        for &li in &free_multi {
            let k = options[li].len();
            choice[li] = options[li][c % k];
            c /= k;
        }
        let mut free: Vec<i32> = (0..local.len()).map(|li| choice[li].0 - sigma[li]).collect();
        let mut extra: Vec<(usize, f64)> = Vec::new(); // (bond, added order)
        let mut add: std::collections::HashMap<usize, f64> = std::collections::HashMap::new();
        loop {
            // the atom with free valence that has the fewest partners with free valence (leaves first)
            let mut pick: Option<(usize, usize)> = None; // (li, n candidates)
            for li in 0..local.len() {
                if free[li] <= 0 {
                    continue;
                }
                let n = nb_local[li].iter().filter(|(j, k)| free[*j] > 0 && 1.0 + add.get(k).copied().unwrap_or(0.0) < 3.0).count();
                if n > 0 && pick.map_or(true, |(_, m)| n < m) {
                    pick = Some((li, n));
                }
            }
            let Some((li, _)) = pick else { break };
            let (j, k) = *nb_local[li]
                .iter()
                .filter(|(j, k)| free[*j] > 0 && 1.0 + add.get(k).copied().unwrap_or(0.0) < 3.0)
                .max_by_key(|(j, _)| (free[*j], usize::MAX - *j))
                .unwrap();
            *add.entry(k).or_insert(0.0) += 1.0;
            free[li] -= 1;
            free[j] -= 1;
        }
        for (k, v) in add {
            extra.push((k, v));
        }
        let plus: i32 = choice.iter().map(|c| c.1).sum();
        let left: i32 = free.iter().map(|f| (*f).max(0)).sum();
        let lowest: i32 = (0..local.len()).map(|li| choice[li].0 - options[li][0].0).sum();
        let key = ((plus - left - t).abs(), left, lowest);
        if best.as_ref().map_or(true, |(bk, ..)| key < *bk) {
            best = Some((key, choice, extra, free));
        }
    }
    let (_, choice, extra, free) = best.unwrap();
    for (k, v) in extra {
        g.bonds[k].order += v;
    }
    for (li, &i) in local.iter().enumerate() {
        g.charge[i] = choice[li].1;
    }
    // negative charges on the atoms with unpaired valence, most electronegative first, as many as the target needs
    let plus: i32 = choice.iter().map(|c| c.1).sum();
    let left: i32 = free.iter().map(|f| (*f).max(0)).sum();
    let mut m = if target.is_some() { (plus - t).clamp(0, left) } else { 0 };
    let mut order: Vec<usize> = (0..local.len()).filter(|&li| free[li] > 0).collect();
    order.sort_by(|&a, &b| data::electronegativity(&g.el[local[b]]).partial_cmp(&data::electronegativity(&g.el[local[a]])).unwrap().then(a.cmp(&b)));
    let mut free_left = free.clone();
    while m > 0 {
        let mut placed = false;
        for &li in &order {
            if m > 0 && free_left[li] > 0 {
                g.charge[local[li]] -= 1;
                free_left[li] -= 1;
                m -= 1;
                placed = true;
            }
        }
        if !placed {
            break;
        }
    }
    let q: i32 = local.iter().map(|&i| g.charge[i]).sum();
    if let Some(t) = target {
        if q != t {
            // what the valence model cannot place: on the most electronegative atom (negative) or the least (positive)
            let pick = if t < q {
                *local.iter().max_by(|&&a, &&b| data::electronegativity(&g.el[a]).partial_cmp(&data::electronegativity(&g.el[b])).unwrap().then(b.cmp(&a))).unwrap()
            } else {
                *local
                    .iter()
                    .filter(|&&i| g.el[i] != "H")
                    .min_by(|&&a, &&b| data::electronegativity(&g.el[a]).partial_cmp(&data::electronegativity(&g.el[b])).unwrap().then(a.cmp(&b)))
                    .unwrap_or(&local[0])
            };
            g.charge[pick] += t - q;
            return t;
        }
    }
    q
}
