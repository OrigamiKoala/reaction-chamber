//! Reaction descriptions for the molecular viewer (docs/plans/reaction-viewer-plan.md, sections 4.3 and 4.4; stage R2: template
//! reactions and proton transfers; stage R3: complexation, ion pairs and electron transfer).
//!
//! The viewer shows a reaction as one morph of 3D structures, so it needs to know *which atom of the products was which atom
//! of the reactants* and which hydrogens moved. Nothing here is computed from compound names:
//!
//! - **Template reactions.** The vessel's generated kinetic rows do not keep the template match that made them, so it is found
//!   again: the template named by the row's rate key is matched against the row's species (`Template::slot_matches`), the
//!   rewritten graphs come with their atom origins (`Template::products_mapped`), and the first match whose products and
//!   reactants reproduce the row (same species ids after the generator's spectator cancellation) is the reaction's mapping.
//! - **Proton transfers.** Equilibria and kinetic rows whose molecules pair up one-to-one by their skeletons (the non-hydrogen
//!   atoms and their bonds) and differ only in hydrogens and charge (`HA <=> H+ + A-`, `NH3 + H2O <=> NH4+ + OH-`,
//!   `H2O <=> H+ + OH-`, `HCO3- + OH- <=> CO3-2 + H2O`). Which atom of a symmetric skeleton takes the place of which is
//!   chosen by the least change of bond orders and formal charges (acetate keeps its C=O and its C-O-).
//! - **Hydrogens.** Both kinds work on the explicit-hydrogen structures of `structure3d` (R0), through their skeletons. Every
//!   skeleton atom keeps the hydrogens it has in common; the surplus hydrogens of one side are a pool (a donor's extra H, the
//!   free proton `H+`) that is handed to the atoms of the other side that need one (`MovingH`). The result is a complete map
//!   of every product atom, hydrogens included, to a reactant atom: a bijection that conserves elements and formal charge.
//!
//! The rates (section 4.4) are gross: a kinetic row gives its forward and its reverse term (the net rate is their difference);
//! a proton-transfer equilibrium has the diffusion-limited encounter rate in its downhill direction (`transport.rs`: the
//! Grotthuss diffusion of H+ and OH-, Stokes-Einstein for the rest) and the detailed-balance value in the other, so a reaction at
//! equilibrium still shows its exchange. Descriptions depend only on structure and are cached per row and store generation.

use std::collections::{BTreeSet, HashMap, HashSet, VecDeque};
use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;

use crate::reaction_templates::{self, Instance, MappedProduct};
use crate::smiles::Molecule;
use crate::structure3d::{self, Structure3d};
use crate::vessel::{Vessel, AQUEOUS_SOLVENT};

mod surface;
pub use surface::{lattice_of, LatticeDesc, LatticeIon, SurfaceDesc, SurfaceJoin, SurfaceLeave};

/// [molecule index, atom index] in the structure of that molecule (`Structure3d::atoms`).
pub type AtomRef = [usize; 2];

/// What one electrode of a powered cell did in the last step: a half-reaction written in the direction it ran ("ox + n e- -> red"
/// at the cathode, "red -> ox + n e-" at the anode) at `rate_mol_s` extents per second. The rows the vessel reports for the cell
/// are the *net* of both electrodes (copper dissolving at one and plating at the other cancel), so the viewer keeps this.
#[derive(Clone, Debug)]
pub struct MicroElectrode {
    pub electrode: &'static str,
    pub equation: String,
    pub rate_mol_s: f64,
}

/// A gas-liquid exchange of the last step with its gross rates in mol/s (liquid -> gas `forward`, gas -> liquid `reverse`):
/// evaporation and condensation, Henry exchange of a dissolved gas, boiling. Recorded by the steps (`vessel_vle.rs`), cleared
/// at the start of the next one.
#[derive(Clone, Debug)]
pub struct MicroTransfer {
    /// Species of the liquid phase (`H2O`, `O2(aq)`) and of the gas (`H2O(g)`).
    pub liquid: String,
    pub gas: String,
    /// Index of the liquid phase (0 = the primary one).
    pub phase: usize,
    pub forward: f64,
    pub reverse: f64,
    /// "evaporation" | "henry" | "boiling"
    pub origin: &'static str,
}

/// One hydrogen that changes its owner in a reaction.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct MovingH {
    /// The hydrogen in the reactant molecules and in the product molecules.
    pub from: AtomRef,
    pub to: AtomRef,
    /// The atom it leaves / the atom it arrives at; None for a free proton (`H+` is a species of the vessel).
    pub donor: Option<AtomRef>,
    pub acceptor: Option<AtomRef>,
}

/// Electrons that hop from one atom of the reactant molecules to another (an electron transfer).
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ElectronHop {
    /// The reactant atoms that lose and gain the electrons (the redox centres).
    pub from: AtomRef,
    pub to: AtomRef,
    pub count: u32,
}

/// What a reaction does to the atoms (independent of the amounts present).
#[derive(Serialize, Clone, Debug)]
pub struct MicroDescription {
    /// "template" | "proton_transfer" | "complexation" | "ion_pair" | "electron_transfer"
    pub kind: String,
    /// Template id (with its variant tag) for a template reaction.
    pub family: Option<String>,
    /// Species of the reactant / product molecules, one entry per molecule (a coefficient of 2 is two entries). The
    /// molecule index of an `AtomRef` is a position in these lists.
    pub reactants: Vec<String>,
    pub products: Vec<String>,
    /// `atom_map[p][j]`: the reactant atom that atom `j` of product molecule `p` was.
    pub atom_map: Vec<Vec<AtomRef>>,
    pub moving_h: Vec<MovingH>,
    /// The mapping is a rule of thumb, not the reaction's own: atoms were assigned by element where no bond-preserving
    /// correspondence exists (an oxo transfer: permanganate's oxygens become the oxygens of water). Templates, proton
    /// transfers and complexation are exact.
    pub schematic_mapping: bool,
    /// Electrons the event moves (an electron transfer), and where they hop from and to.
    pub electrons: u32,
    pub electron_hops: Vec<ElectronHop>,
    /// What the event shows when it is not the whole reaction ("one-electron step of a 5-electron reaction ...").
    pub note: Option<String>,
    /// What the reaction does at a solid surface (precipitation, an electrode, a decomposing solid); None for a reaction in solution.
    pub surface: Option<SurfaceDesc>,
}

impl MicroDescription {
    fn new(kind: &str, family: Option<String>, reactants: Vec<String>, products: Vec<String>, atom_map: Vec<Vec<AtomRef>>, moving_h: Vec<MovingH>, schematic_mapping: bool) -> MicroDescription {
        MicroDescription { kind: kind.into(), family, reactants, products, atom_map, moving_h, schematic_mapping, electrons: 0, electron_hops: Vec::new(), note: None, surface: None }
    }
}

/// A reaction row of a vessel phase, described for the viewer.
#[derive(Serialize, Clone, Debug)]
pub struct MicroReaction {
    pub id: String,
    pub equation: String,
    /// "template" | "proton_transfer" | "complexation" | "ion_pair" | "electron_transfer" | "other" (an active row the viewer
    /// cannot map yet: it lists it but does not play it)
    pub kind: String,
    pub family: Option<String>,
    pub layer: usize,
    pub reactants: Vec<String>,
    pub products: Vec<String>,
    pub atom_map: Vec<Vec<AtomRef>>,
    pub moving_h: Vec<MovingH>,
    pub schematic_mapping: bool,
    pub electrons: u32,
    pub electron_hops: Vec<ElectronHop>,
    pub note: Option<String>,
    pub surface: Option<SurfaceDesc>,
    /// Rates in mol/s of the whole phase.
    pub net_rate_mol_s: f64,
    pub gross_forward_mol_s: f64,
    pub gross_reverse_mol_s: f64,
    /// Where the gross rates come from: "kinetic row" | "diffusion-limited encounter (transport.rs)" | "none".
    pub rate_source: String,
    pub reversible: bool,
}

// ------------------------------------------------------------------------------------------------ skeleton graphs

/// A structure seen as a skeleton (every atom that is not a hydrogen riding on another atom), with the hydrogens of each
/// skeleton atom and the free hydrogens (the proton).
struct Info {
    s: Arc<Structure3d>,
    /// structure atom index of each skeleton atom
    skel: Vec<usize>,
    /// per structure atom: hydrogens attached to it
    h_of: Vec<Vec<usize>>,
    free_h: Vec<usize>,
    /// per skeleton position: skeleton positions bonded to it
    adj: Vec<Vec<usize>>,
    /// bond order between skeleton atoms by structure atom indices (a < b)
    order: HashMap<(usize, usize), f64>,
}

impl Info {
    fn new(s: Arc<Structure3d>) -> Info {
        let n = s.atoms.len();
        let mut deg = vec![0usize; n];
        for b in &s.bonds {
            deg[b.a] += 1;
            deg[b.b] += 1;
        }
        let mut owner: Vec<Option<usize>> = vec![None; n];
        for b in &s.bonds {
            for (h, o) in [(b.a, b.b), (b.b, b.a)] {
                if s.atoms[h].el == "H" && deg[h] == 1 && s.atoms[o].el != "H" {
                    owner[h] = Some(o);
                }
            }
        }
        let mut h_of = vec![Vec::new(); n];
        let mut free_h = Vec::new();
        let mut skel = Vec::new();
        for i in 0..n {
            match owner[i] {
                Some(o) => h_of[o].push(i),
                None if s.atoms[i].el == "H" => free_h.push(i),
                None => skel.push(i),
            }
        }
        let mut pos = vec![usize::MAX; n];
        for (k, &i) in skel.iter().enumerate() {
            pos[i] = k;
        }
        let mut adj = vec![Vec::new(); skel.len()];
        let mut order = HashMap::new();
        for b in &s.bonds {
            if pos[b.a] != usize::MAX && pos[b.b] != usize::MAX {
                adj[pos[b.a]].push(pos[b.b]);
                adj[pos[b.b]].push(pos[b.a]);
                order.insert((b.a.min(b.b), b.a.max(b.b)), b.order);
            }
        }
        Info { s, skel, h_of, free_h, adj, order }
    }

    fn graph(&self) -> G {
        G {
            el: self.skel.iter().map(|&i| self.s.atoms[i].el.clone()).collect(),
            adj: self.adj.clone(),
            q: self.skel.iter().map(|&i| self.s.atoms[i].charge).collect(),
            h: self.skel.iter().map(|&i| self.h_of[i].len() as u32).collect(),
        }
    }

    fn is_placeholder(&self) -> bool {
        self.s.source == "placeholder"
    }
}

/// Labelled graph for isomorphism search.
struct G {
    el: Vec<String>,
    adj: Vec<Vec<usize>>,
    q: Vec<i32>,
    h: Vec<u32>,
}

impl G {
    fn from_molecule(m: &Molecule) -> G {
        let n = m.atoms.len();
        let mut adj = vec![Vec::new(); n];
        for &(a, b, _) in &m.bonds {
            adj[a].push(b);
            adj[b].push(a);
        }
        G { el: m.atoms.iter().map(|a| a.element.clone()).collect(), adj, q: m.atoms.iter().map(|a| a.charge).collect(), h: (0..n).map(|i| m.hydrogens(i)).collect() }
    }
}

/// Isomorphisms `a -> b` (atom of `a` -> atom of `b`) by element and connectivity, and by charge and hydrogen count when
/// `strict`; at most `limit` of them, within a search budget.
fn isomorphisms(a: &G, b: &G, strict: bool, limit: usize) -> Vec<Vec<usize>> {
    let n = a.el.len();
    if n != b.el.len() || limit == 0 {
        return Vec::new();
    }
    let mut order = Vec::with_capacity(n);
    let mut seen = vec![false; n];
    for s in 0..n {
        if seen[s] {
            continue;
        }
        seen[s] = true;
        let mut q = VecDeque::from([s]);
        while let Some(u) = q.pop_front() {
            order.push(u);
            for &v in &a.adj[u] {
                if !seen[v] {
                    seen[v] = true;
                    q.push_back(v);
                }
            }
        }
    }
    struct Search<'a> {
        a: &'a G,
        b: &'a G,
        order: Vec<usize>,
        strict: bool,
        limit: usize,
        map: Vec<usize>,
        used: Vec<bool>,
        out: Vec<Vec<usize>>,
        budget: usize,
    }
    impl Search<'_> {
        fn rec(&mut self, k: usize) {
            if self.out.len() >= self.limit || self.budget == 0 {
                return;
            }
            if k == self.order.len() {
                self.out.push(self.map.clone());
                return;
            }
            let i = self.order[k];
            for j in 0..self.b.el.len() {
                if self.used[j] || self.a.el[i] != self.b.el[j] || self.a.adj[i].len() != self.b.adj[j].len() {
                    continue;
                }
                if self.strict && (self.a.q[i] != self.b.q[j] || self.a.h[i] != self.b.h[j]) {
                    continue;
                }
                if !self.a.adj[i].iter().all(|&v| self.map[v] == usize::MAX || self.b.adj[j].contains(&self.map[v])) {
                    continue;
                }
                self.budget = self.budget.saturating_sub(1);
                self.map[i] = j;
                self.used[j] = true;
                self.rec(k + 1);
                self.map[i] = usize::MAX;
                self.used[j] = false;
                if self.out.len() >= self.limit || self.budget == 0 {
                    return;
                }
            }
        }
    }
    let mut s = Search { a, b, order, strict, limit, map: vec![usize::MAX; n], used: vec![false; n], out: Vec::new(), budget: 400_000 };
    s.rec(0);
    s.out
}

/// The skeleton atom of `info` each atom of `mol` is (strict labels first, then element and connectivity only).
fn match_molecule(mol: &Molecule, info: &Info) -> Option<Vec<usize>> {
    let g = G::from_molecule(mol);
    let target = info.graph();
    isomorphisms(&g, &target, true, 1).into_iter().next().or_else(|| isomorphisms(&g, &target, false, 1).into_iter().next())
}

// ------------------------------------------------------------------------------------------------ the shared map builder

/// Completes a skeleton-level correspondence into the full atom map (see the module documentation). `origin[p][a]` is the
/// reactant atom of the skeleton atom `a` (a structure atom index) of product molecule `p`.
fn finish_map(r: &[Info], p: &[Info], origin: &[Vec<Option<AtomRef>>]) -> Option<(Vec<Vec<AtomRef>>, Vec<MovingH>)> {
    finish_map_dq(r, p, origin, 0)
}

/// `finish_map` for a half-reaction: the products carry `dq` more formal charge than the reactants (the electrons the reaction
/// gives to an electrode: + the electrons for an oxidation, - for a reduction).
fn finish_map_dq(r: &[Info], p: &[Info], origin: &[Vec<Option<AtomRef>>], dq: i32) -> Option<(Vec<Vec<AtomRef>>, Vec<MovingH>)> {
    let mut map: Vec<Vec<Option<AtomRef>>> = p.iter().map(|i| vec![None; i.s.atoms.len()]).collect();
    let mut used: HashSet<AtomRef> = HashSet::new();
    let mut released: Vec<(AtomRef, Option<AtomRef>)> = Vec::new();
    let mut needed: Vec<(AtomRef, Option<AtomRef>)> = Vec::new();
    for (pi, pinf) in p.iter().enumerate() {
        for &ps in &pinf.skel {
            let o = origin[pi][ps]?;
            if !used.insert(o) || r[o[0]].s.atoms[o[1]].el != pinf.s.atoms[ps].el {
                return None;
            }
            map[pi][ps] = Some(o);
            let (rh, ph) = (&r[o[0]].h_of[o[1]], &pinf.h_of[ps]);
            let common = rh.len().min(ph.len());
            for t in 0..common {
                map[pi][ph[t]] = Some([o[0], rh[t]]);
                used.insert([o[0], rh[t]]);
            }
            for &h in &rh[common..] {
                released.push(([o[0], h], Some(o)));
            }
            for &h in &ph[common..] {
                needed.push(([pi, h], Some([pi, ps])));
            }
        }
        for &h in &pinf.free_h {
            needed.push(([pi, h], None));
        }
    }
    for (ri, rinf) in r.iter().enumerate() {
        if rinf.skel.iter().any(|&a| !used.contains(&[ri, a])) {
            return None;
        }
        for &h in &rinf.free_h {
            released.push(([ri, h], None));
        }
    }
    if released.len() != needed.len() {
        return None;
    }
    let mut moving = Vec::new();
    for (rel, need) in released.into_iter().zip(needed) {
        map[need.0[0]][need.0[1]] = Some(rel.0);
        used.insert(rel.0);
        moving.push(MovingH { from: rel.0, to: need.0, donor: rel.1, acceptor: need.1 });
    }
    let n_r: usize = r.iter().map(|i| i.s.atoms.len()).sum();
    let n_p: usize = p.iter().map(|i| i.s.atoms.len()).sum();
    if n_r != n_p || used.len() != n_r {
        return None;
    }
    let q_r: i32 = r.iter().map(|i| i.s.atoms.iter().map(|a| a.charge).sum::<i32>()).sum();
    let q_p: i32 = p.iter().map(|i| i.s.atoms.iter().map(|a| a.charge).sum::<i32>()).sum();
    if q_p - q_r != dq {
        return None;
    }
    let mut out = Vec::new();
    for (pi, m) in map.into_iter().enumerate() {
        let row: Option<Vec<AtomRef>> = m.into_iter().collect();
        let row = row?;
        for (a, o) in row.iter().enumerate() {
            if r[o[0]].s.atoms[o[1]].el != p[pi].s.atoms[a].el {
                return None;
            }
        }
        out.push(row);
    }
    Some((out, moving))
}

// ------------------------------------------------------------------------------------------------ template reactions

/// Spectator cancellation of the network generator: a species on both sides is a spectator of the step.
fn cancel(mut r: HashMap<String, f64>, mut p: HashMap<String, f64>) -> (HashMap<String, f64>, HashMap<String, f64>) {
    for sp in r.keys().cloned().collect::<Vec<_>>() {
        if let (Some(a), Some(b)) = (r.get(&sp).copied(), p.get(&sp).copied()) {
            let common = a.min(b);
            if a - common < 1e-9 { r.remove(&sp); } else { r.insert(sp.clone(), a - common); }
            if b - common < 1e-9 { p.remove(&sp); } else { p.insert(sp, b - common); }
        }
    }
    (r, p)
}

fn same_counts(a: &HashMap<String, f64>, b: &HashMap<String, f64>) -> bool {
    a.len() == b.len() && a.iter().all(|(k, v)| b.get(k).map_or(false, |w| (v - w).abs() < 1e-9))
}

fn structure_of(species: &str, hint: &dyn Fn(&str) -> Option<String>) -> Info {
    Info::new(structure3d::for_species(species, hint(species).as_deref()))
}

/// The template a rate key (`template[_variant]`) or a generated row's family names.
fn find_template(family: &str) -> Option<&'static reaction_templates::Template> {
    reaction_templates::templates().iter().filter(|t| family == t.id || family.strip_prefix(t.id.as_str()).map_or(false, |rest| rest.starts_with('_'))).max_by_key(|t| t.id.len())
}

/// Describes the template reaction `family` that turns `reactants` into `products` (the row's species maps), by finding the
/// template match that reproduces the row. None when no match does (the row came from another version of the templates, or
/// a species has no structure).
pub fn describe_template(family: &str, reactants: &HashMap<String, f64>, products: &HashMap<String, f64>, hint: &dyn Fn(&str) -> Option<String>) -> Option<MicroDescription> {
    let tpl = find_template(family)?;
    let n = tpl.n_slots();
    let mut cands: Vec<String> = reactants.keys().cloned().collect();
    cands.sort();
    let mut tail: Vec<String> = products.keys().cloned().collect();
    tail.sort();
    cands.extend(tail);
    cands.push(crate::db::seed::WATER.to_string());
    let mut seen = HashSet::new();
    cands.retain(|c| seen.insert(c.clone()));
    let mols: Vec<Option<Molecule>> = cands.iter().map(|c| crate::network_generator::resolve_molecule(c)).collect();
    // matches of each slot in each candidate
    let slot_matches: Vec<Vec<Vec<Vec<usize>>>> = (0..n).map(|s| mols.iter().map(|m| m.as_ref().map_or(Vec::new(), |m| tpl.slot_matches(s, m))).collect()).collect();

    struct Found {
        species: Vec<usize>,
        products: Vec<MappedProduct>,
        ids: Vec<String>,
    }
    let mut id_memo: HashMap<String, String> = HashMap::new();
    let mut budget = 4000usize;
    let mut found: Option<Found> = None;

    // depth-first over the species of the slots, then over the matches of each
    #[allow(clippy::too_many_arguments)]
    fn walk(
        tpl: &reaction_templates::Template,
        slot: usize,
        sel: &mut Vec<(usize, usize)>,
        slot_matches: &[Vec<Vec<Vec<usize>>>],
        mols: &[Option<Molecule>],
        reactants: &HashMap<String, f64>,
        products: &HashMap<String, f64>,
        cands: &[String],
        id_memo: &mut HashMap<String, String>,
        budget: &mut usize,
        found: &mut Option<Found>,
    ) {
        if found.is_some() || *budget == 0 {
            return;
        }
        if slot == slot_matches.len() {
            *budget -= 1;
            let species: Vec<usize> = sel.iter().map(|s| s.0).collect();
            let maps: Vec<&Vec<usize>> = sel.iter().enumerate().map(|(s, &(c, m))| &slot_matches[s][c][m]).collect();
            let inst = Instance { template: tpl, mols: species.iter().map(|&c| mols[c].as_ref().unwrap()).collect(), maps: maps.clone() };
            let Some(mapped) = tpl.products_mapped(&inst) else { return };
            let ids: Vec<String> = mapped
                .iter()
                .map(|mp| {
                    let key = mp.mol.to_smiles();
                    id_memo.entry(key).or_insert_with(|| crate::network_generator::register_or_find_species(&mp.mol)).clone()
                })
                .collect();
            let (mut r, mut p): (HashMap<String, f64>, HashMap<String, f64>) = (HashMap::new(), HashMap::new());
            for &c in &species {
                *r.entry(cands[c].clone()).or_insert(0.0) += 1.0;
            }
            for id in &ids {
                *p.entry(id.clone()).or_insert(0.0) += 1.0;
            }
            let (r, p) = cancel(r, p);
            if same_counts(&r, reactants) && same_counts(&p, products) {
                *found = Some(Found { species, products: mapped, ids });
            }
            return;
        }
        for c in 0..cands.len() {
            for m in 0..slot_matches[slot][c].len() {
                sel.push((c, m));
                walk(tpl, slot + 1, sel, slot_matches, mols, reactants, products, cands, id_memo, budget, found);
                sel.pop();
                if found.is_some() || *budget == 0 {
                    return;
                }
            }
        }
    }
    walk(tpl, 0, &mut Vec::new(), &slot_matches, &mols, reactants, products, &cands, &mut id_memo, &mut budget, &mut found);
    let found = found?;

    // structures of the reactants (the template slots) and products
    let mut r_species: Vec<String> = found.species.iter().map(|&c| cands[c].clone()).collect();
    let mut r_info: Vec<Info> = r_species.iter().map(|s| structure_of(s, hint)).collect();
    let mut r_match: Vec<Option<Vec<usize>>> = Vec::new();
    for (slot, &c) in found.species.iter().enumerate() {
        r_match.push(match_molecule(mols[c].as_ref()?, &r_info[slot]));
    }
    if r_info.iter().any(|i| i.is_placeholder()) || r_match.iter().any(|m| m.is_none()) {
        return None;
    }
    let p_species = found.ids.clone();
    let p_info: Vec<Info> = p_species.iter().map(|s| structure_of(s, hint)).collect();
    if p_info.iter().any(|i| i.is_placeholder()) {
        return None;
    }
    let mut origin: Vec<Vec<Option<AtomRef>>> = p_info.iter().map(|i| vec![None; i.s.atoms.len()]).collect();
    for (pi, mp) in found.products.iter().enumerate() {
        if mp.mol.atoms.iter().all(|a| a.element == "H") {
            continue; // the free proton
        }
        let pm = match_molecule(&mp.mol, &p_info[pi])?;
        let mut missing: Vec<usize> = Vec::new();
        for (k, o) in mp.origin.iter().enumerate() {
            let target = p_info[pi].skel[pm[k]];
            match o {
                Some((slot, a)) => {
                    let rs = r_info[*slot].skel[r_match[*slot].as_ref()?[*a]];
                    origin[pi][target] = Some([*slot, rs]);
                }
                None => missing.push(target),
            }
        }
        // the hydroxide the solvent proton leaves is a water that lost a proton: the solvent molecule joins the reactants
        if !missing.is_empty() {
            let single_o = missing.len() == 1 && mp.mol.atoms.len() == 1 && mp.mol.atoms[0].element == "O";
            if !single_o {
                return None;
            }
            let water = crate::db::seed::WATER.to_string();
            let info = structure_of(&water, hint);
            if info.skel.len() != 1 || info.is_placeholder() {
                return None;
            }
            origin[pi][missing[0]] = Some([r_info.len(), info.skel[0]]);
            r_species.push(water);
            r_info.push(info);
        }
    }
    let (atom_map, moving_h) = finish_map(&r_info, &p_info, &origin)?;
    Some(MicroDescription::new("template", Some(family.to_string()), r_species, p_species, atom_map, moving_h, false))
}

// ------------------------------------------------------------------------------------------------ proton transfers

/// Species of a row as a list of molecules (a coefficient of 2 is two entries); None for a coefficient that is not a small
/// whole number or a species that is not dissolved (solids and gases are other kinds of reaction).
fn expand(map: &HashMap<String, f64>) -> Option<Vec<String>> {
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();
    let mut out = Vec::new();
    for k in keys {
        let c = map[k];
        if (c - c.round()).abs() > 1e-9 || !(1.0..=4.0).contains(&c) || k.ends_with("(s)") || k.ends_with("(g)") {
            return None;
        }
        for _ in 0..(c.round() as usize) {
            out.push(k.clone());
        }
    }
    if out.is_empty() || out.len() > 8 {
        return None;
    }
    Some(out)
}

/// Cost of an atom correspondence between the skeletons of two structures: changed bond orders, formal charges that do not
/// follow the hydrogen change (an atom that loses H+ gains one negative charge), and the hydrogens that move.
fn pair_cost(a: &Info, b: &Info, iso: &[usize]) -> f64 {
    let mut cost = 0.0;
    for (&(x, y), &o) in &a.order {
        let (px, py) = (a.skel.iter().position(|&s| s == x), a.skel.iter().position(|&s| s == y));
        let (Some(px), Some(py)) = (px, py) else { continue };
        let (bx, by) = (b.skel[iso[px]], b.skel[iso[py]]);
        let ob = b.order.get(&(bx.min(by), bx.max(by))).copied().unwrap_or(o);
        cost += (o - ob).abs();
    }
    for (k, &sa) in a.skel.iter().enumerate() {
        let sb = b.skel[iso[k]];
        let dh = b.h_of[sb].len() as i32 - a.h_of[sa].len() as i32;
        let dq = b.s.atoms[sb].charge - a.s.atoms[sa].charge;
        cost += (dq - dh).abs() as f64 + 0.1 * dh.abs() as f64;
    }
    cost
}

/// Describes a proton transfer: molecules that pair up by skeleton and differ by hydrogens and charge only.
pub fn describe_proton_transfer(reactants: &HashMap<String, f64>, products: &HashMap<String, f64>, hint: &dyn Fn(&str) -> Option<String>) -> Option<MicroDescription> {
    let r_species = expand(reactants)?;
    let p_species = expand(products)?;
    let r_info: Vec<Info> = r_species.iter().map(|s| structure_of(s, hint)).collect();
    let p_info: Vec<Info> = p_species.iter().map(|s| structure_of(s, hint)).collect();
    if r_info.iter().chain(p_info.iter()).any(|i| i.is_placeholder()) {
        return None;
    }
    let r_heavy: Vec<usize> = (0..r_info.len()).filter(|&i| !r_info[i].skel.is_empty()).collect();
    let p_heavy: Vec<usize> = (0..p_info.len()).filter(|&i| !p_info[i].skel.is_empty()).collect();
    if r_heavy.len() != p_heavy.len() || r_heavy.is_empty() {
        return None;
    }
    // best skeleton correspondence of every compatible (reactant, product) pair
    let mut best: HashMap<(usize, usize), (f64, Vec<usize>)> = HashMap::new();
    for &i in &r_heavy {
        let gi = r_info[i].graph();
        for &j in &p_heavy {
            let gj = p_info[j].graph();
            let isos = isomorphisms(&gi, &gj, false, 600);
            let pick = isos.into_iter().map(|m| (pair_cost(&r_info[i], &p_info[j], &m), m)).min_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
            if let Some(p) = pick {
                best.insert((i, j), p);
            }
        }
    }
    // assignment of reactants to products of least total cost
    fn assign(k: usize, r_heavy: &[usize], p_heavy: &[usize], used: &mut Vec<bool>, best: &HashMap<(usize, usize), (f64, Vec<usize>)>, cur: &mut Vec<usize>, out: &mut Option<(f64, Vec<usize>)>, total: f64) {
        if k == r_heavy.len() {
            if out.as_ref().map_or(true, |o| total < o.0) {
                *out = Some((total, cur.clone()));
            }
            return;
        }
        for (pj, &j) in p_heavy.iter().enumerate() {
            if used[pj] {
                continue;
            }
            if let Some((c, _)) = best.get(&(r_heavy[k], j)) {
                used[pj] = true;
                cur.push(j);
                assign(k + 1, r_heavy, p_heavy, used, best, cur, out, total + c);
                cur.pop();
                used[pj] = false;
            }
        }
    }
    let mut chosen = None;
    assign(0, &r_heavy, &p_heavy, &mut vec![false; p_heavy.len()], &best, &mut Vec::new(), &mut chosen, 0.0);
    let (_, pairing) = chosen?;
    let mut origin: Vec<Vec<Option<AtomRef>>> = p_info.iter().map(|i| vec![None; i.s.atoms.len()]).collect();
    for (k, &i) in r_heavy.iter().enumerate() {
        let j = pairing[k];
        let (_, iso) = &best[&(i, j)];
        for (pos_r, &pos_p) in iso.iter().enumerate() {
            origin[j][p_info[j].skel[pos_p]] = Some([i, r_info[i].skel[pos_r]]);
        }
    }
    let (atom_map, moving_h) = finish_map(&r_info, &p_info, &origin)?;
    if moving_h.is_empty() {
        return None;
    }
    Some(MicroDescription::new("proton_transfer", None, r_species, p_species, atom_map, moving_h, false))
}

// ------------------------------------------------------------------------------------------------ associations, electron transfer

/// All skeleton atoms of a list of structures as one graph: element, neighbours, and where each atom lives (molecule, structure
/// atom index).
struct Flat {
    el: Vec<String>,
    adj: Vec<Vec<usize>>,
    loc: Vec<(usize, usize)>,
}

fn flatten(infos: &[Info]) -> Flat {
    let mut f = Flat { el: Vec::new(), adj: Vec::new(), loc: Vec::new() };
    let mut base = Vec::with_capacity(infos.len());
    for (m, inf) in infos.iter().enumerate() {
        base.push(f.el.len());
        for &a in &inf.skel {
            f.el.push(inf.s.atoms[a].el.clone());
            f.loc.push((m, a));
            f.adj.push(Vec::new());
        }
    }
    for (m, inf) in infos.iter().enumerate() {
        for k in 0..inf.skel.len() {
            f.adj[base[m] + k] = inf.adj[k].iter().map(|&v| base[m] + v).collect();
        }
    }
    f
}

/// Breadth-first order of the atoms of a skeleton (every component).
fn bfs_order(adj: &[Vec<usize>]) -> Vec<usize> {
    let mut order = Vec::with_capacity(adj.len());
    let mut seen = vec![false; adj.len()];
    for s in 0..adj.len() {
        if seen[s] {
            continue;
        }
        seen[s] = true;
        let mut q = VecDeque::from([s]);
        while let Some(u) = q.pop_front() {
            order.push(u);
            for &v in &adj[u] {
                if !seen[v] {
                    seen[v] = true;
                    q.push_back(v);
                }
            }
        }
    }
    order
}

/// Places a skeleton onto free atoms of `b` so that every bond of `a` lands on a bond of `b` and elements agree (a subgraph
/// monomorphism); None when there is none (or the search budget runs out).
fn embed_into(a: &G, b: &Flat, free: &[bool]) -> Option<Vec<usize>> {
    struct S<'x> {
        a: &'x G,
        b: &'x Flat,
        order: Vec<usize>,
        free: Vec<bool>,
        map: Vec<usize>,
        budget: usize,
    }
    impl S<'_> {
        fn rec(&mut self, k: usize) -> bool {
            if k == self.order.len() {
                return true;
            }
            let i = self.order[k];
            for j in 0..self.b.el.len() {
                if !self.free[j] || self.b.el[j] != self.a.el[i] || self.b.adj[j].len() < self.a.adj[i].len() {
                    continue;
                }
                if !self.a.adj[i].iter().all(|&v| self.map[v] == usize::MAX || self.b.adj[j].contains(&self.map[v])) {
                    continue;
                }
                if self.budget == 0 {
                    return false;
                }
                self.budget -= 1;
                self.map[i] = j;
                self.free[j] = false;
                if self.rec(k + 1) {
                    return true;
                }
                self.map[i] = usize::MAX;
                self.free[j] = true;
            }
            false
        }
    }
    let mut s = S { a, b, order: bfs_order(&a.adj), free: free.to_vec(), map: vec![usize::MAX; a.el.len()], budget: 200_000 };
    if s.rec(0) { Some(s.map) } else { None }
}

/// Places a skeleton by element where no bond-preserving placement exists: every atom takes the free atom of its element that
/// keeps most of its bonds to the atoms already placed, then the one in the molecule its neighbours went to.
fn place_by_element(a: &G, b: &Flat, free: &[bool]) -> Option<Vec<usize>> {
    let mut free = free.to_vec();
    let mut map = vec![usize::MAX; a.el.len()];
    for i in bfs_order(&a.adj) {
        let mut best: Option<(i32, usize)> = None;
        for j in 0..b.el.len() {
            if !free[j] || b.el[j] != a.el[i] {
                continue;
            }
            let mut score = 0;
            for &v in &a.adj[i] {
                if map[v] != usize::MAX {
                    if b.adj[j].contains(&map[v]) {
                        score += 4;
                    } else if b.loc[map[v]].0 == b.loc[j].0 {
                        score += 1;
                    }
                }
            }
            if best.map_or(true, |(s, _)| score > s) {
                best = Some((score, j));
            }
        }
        let (_, j) = best?;
        map[i] = j;
        free[j] = false;
    }
    Some(map)
}

/// The skeleton correspondence of a reaction in which the molecules keep their bonds as far as they can: reactants, largest
/// first, are laid onto the product skeletons by a bond-preserving embedding; a reactant that has none is laid by element (the
/// returned flag: the mapping is schematic). Returns `origin` as `finish_map` wants it.
fn map_by_skeleton(r: &[Info], p: &[Info]) -> Option<(Vec<Vec<Option<AtomRef>>>, bool)> {
    let flat = flatten(p);
    let mut free = vec![true; flat.el.len()];
    let mut origin: Vec<Vec<Option<AtomRef>>> = p.iter().map(|i| vec![None; i.s.atoms.len()]).collect();
    let mut order: Vec<usize> = (0..r.len()).filter(|&i| !r[i].skel.is_empty()).collect();
    order.sort_by_key(|&i| (std::cmp::Reverse(r[i].skel.len()), i));
    let mut schematic = false;
    for i in order {
        let g = r[i].graph();
        let map = match embed_into(&g, &flat, &free) {
            Some(m) => m,
            None => {
                schematic = true;
                place_by_element(&g, &flat, &free)?
            }
        };
        for (k, &j) in map.iter().enumerate() {
            free[j] = false;
            let (pm, pa) = flat.loc[j];
            origin[pm][pa] = Some([i, r[i].skel[k]]);
        }
    }
    Some((origin, schematic))
}

/// The full description of a reaction whose molecules are laid onto one another by `map_by_skeleton`.
fn describe_skeleton(kind: &str, r_species: Vec<String>, p_species: Vec<String>, hint: &dyn Fn(&str) -> Option<String>) -> Option<MicroDescription> {
    describe_skeleton_dq(kind, r_species, p_species, hint, 0)
}

/// `describe_skeleton` of a half-reaction whose products carry `dq` more formal charge than its reactants.
fn describe_skeleton_dq(kind: &str, r_species: Vec<String>, p_species: Vec<String>, hint: &dyn Fn(&str) -> Option<String>, dq: i32) -> Option<MicroDescription> {
    let r_info: Vec<Info> = r_species.iter().map(|s| structure_of(s, hint)).collect();
    let p_info: Vec<Info> = p_species.iter().map(|s| structure_of(s, hint)).collect();
    if r_info.iter().chain(p_info.iter()).any(|i| i.is_placeholder()) {
        return None;
    }
    let (origin, schematic) = map_by_skeleton(&r_info, &p_info)?;
    let (atom_map, moving_h) = finish_map_dq(&r_info, &p_info, &origin, dq)?;
    Some(MicroDescription::new(kind, None, r_species, p_species, atom_map, moving_h, schematic))
}

/// Species of a row as a list of molecules for the kinds that may hold solid atoms, gases and larger coefficients (electron
/// transfer: a metal dissolving in acid makes hydrogen gas).
fn expand_up_to(map: &HashMap<String, f64>, max: usize) -> Option<Vec<String>> {
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();
    let mut out = Vec::new();
    for k in keys {
        let c = map[k];
        if (c - c.round()).abs() > 1e-9 || !(1.0..=8.0).contains(&c) {
            return None;
        }
        for _ in 0..(c.round() as usize) {
            out.push(k.clone());
        }
    }
    if out.is_empty() || out.len() > max {
        return None;
    }
    Some(out)
}

/// A complexation or ion pair: the metal ion, ligands and any water or proton they use come together into one species. The
/// ligand binds by its donor atom (the product's bonds say which); nothing is mapped by element, so the mapping is exact.
pub fn describe_association(reactants: &HashMap<String, f64>, products: &HashMap<String, f64>, hint: &dyn Fn(&str) -> Option<String>) -> Option<MicroDescription> {
    let r_species = expand(reactants)?;
    let p_species = expand(products)?;
    let mut d = describe_skeleton("complexation", r_species, p_species, hint)?;
    // an association joins atoms of at least two reactant molecules in one product molecule
    let joins = d.atom_map.iter().any(|row| row.iter().map(|o| o[0]).collect::<HashSet<_>>().len() >= 2);
    if d.schematic_mapping || !joins {
        return None;
    }
    // a metal ion takes ligands (a complex), or oppositely charged ions meet (an ion pair); a neutral molecule that adds water
    // (CO2 hydration) is neither
    let infos: Vec<Info> = d.reactants.iter().map(|s| structure_of(s, hint)).collect();
    let has_metal = infos.iter().any(|i| i.s.atoms.iter().any(|a| a.ox.is_some()));
    let charged = |i: &Info| i.s.atoms.iter().map(|a| a.charge).sum::<i32>() != 0;
    let ions_meet = infos.iter().filter(|i| !i.skel.is_empty()).all(|i| charged(i));
    if !has_metal && !ions_meet {
        return None;
    }
    if !has_metal {
        d.kind = "ion_pair".into();
    }
    Some(d)
}

/// The two couples of an electron transfer (the species each partner turns into).
#[derive(Clone, Debug)]
pub struct EtPartners {
    pub donor: String,
    pub donor_product: String,
    pub acceptor: String,
    pub acceptor_product: String,
}

/// The species id with its charge changed by `dq` (`Fe+2` -> `Fe+3`, `MnO4-` -> `MnO4-2`, `Zn(s)` -> `Zn+`): what a partner
/// of a one-electron transfer is just after the electron has gone. None when the id is not a formula with a charge suffix.
fn shift_charge(species: &str, dq: i32) -> Option<String> {
    let base = species.trim_end_matches("(aq)").trim_end_matches("(s)").trim_end_matches("(l)");
    let b = base.as_bytes();
    let end = b.len();
    let mut i = end;
    while i > 0 && b[i - 1].is_ascii_digit() {
        i -= 1;
    }
    let (formula, z) = if i > 0 && (b[i - 1] == b'+' || b[i - 1] == b'-') {
        let mag: i32 = if i == end { 1 } else { base[i..].parse().ok()? };
        (&base[..i - 1], if b[i - 1] == b'+' { mag } else { -mag })
    } else {
        (base, 0)
    };
    if formula.is_empty() {
        return None;
    }
    let nz = z + dq;
    let suffix = match nz {
        0 => String::new(),
        1 => "+".into(),
        -1 => "-".into(),
        n if n > 0 => format!("+{}", n),
        n => format!("-{}", -n),
    };
    Some(format!("{}{}", formula, suffix))
}

/// The atom of a structure whose oxidation state changes most between two species (the redox centre); the first skeleton atom
/// when they do not differ.
fn redox_centre(info: &Info, from: &str, to: &str) -> usize {
    use crate::gem::redox::determine_oxidation_states_exact as ox;
    let (a, b) = (ox(from), ox(to));
    let mut best: Option<(f64, &str)> = None;
    for (el, &x) in &a {
        let d = (b.get(el).copied().unwrap_or(x) - x).abs();
        if d > 1e-9 && best.map_or(true, |(bd, be)| d > bd + 1e-9 || ((d - bd).abs() <= 1e-9 && el.as_str() < be)) {
            best = Some((d, el.as_str()));
        }
    }
    best.and_then(|(_, el)| info.skel.iter().copied().find(|&i| info.s.atoms[i].el == el)).or_else(|| info.skel.first().copied()).unwrap_or(0)
}

/// Largest number of molecules on a side for which an electron transfer is shown as the whole reaction; beyond it one electron
/// hops between donor and acceptor.
const MAX_WHOLE_EVENT_MOLECULES: usize = 6;

/// Describes an electron transfer. A reaction of a few molecules (zinc and copper(II), sulfite and hypochlorite) is shown whole:
/// the atoms are laid onto each other with their bonds where that works, by element where it does not (an oxo transfer, flagged
/// schematic), and the electrons hop from the donor's redox centre to the acceptor's. A reaction of many molecules (permanganate
/// with five iron(II) and eight protons) is shown as the step the Marcus rate describes: one electron from the donor to the
/// acceptor, the two partners left one charge up and one charge down (an intermediate; the reaction log has the net reaction).
pub fn describe_electron_transfer(reactants: &HashMap<String, f64>, products: &HashMap<String, f64>, partners: Option<&EtPartners>, electrons: u32, hint: &dyn Fn(&str) -> Option<String>) -> Option<MicroDescription> {
    let attach = |mut d: MicroDescription, p: &EtPartners, n: u32, dq_species: Option<(&str, &str)>| -> Option<MicroDescription> {
        let infos: Vec<Info> = d.reactants.iter().map(|s| structure_of(s, hint)).collect();
        let di = d.reactants.iter().position(|s| *s == p.donor)?;
        let ai = d.reactants.iter().rposition(|s| *s == p.acceptor).filter(|&k| k != di).or_else(|| d.reactants.iter().position(|s| *s == p.acceptor).filter(|&k| k != di))?;
        let (d_to, a_to) = dq_species.unwrap_or((p.donor_product.as_str(), p.acceptor_product.as_str()));
        let from = redox_centre(&infos[di], &p.donor, d_to);
        let to = redox_centre(&infos[ai], &p.acceptor, a_to);
        d.electrons = n;
        d.electron_hops = vec![ElectronHop { from: [di, from], to: [ai, to], count: n }];
        Some(d)
    };
    if let (Some(r), Some(p)) = (expand_up_to(reactants, MAX_WHOLE_EVENT_MOLECULES), expand_up_to(products, MAX_WHOLE_EVENT_MOLECULES)) {
        if let Some(d) = describe_skeleton("electron_transfer", r, p, hint) {
            match partners {
                Some(pt) => {
                    if let Some(d) = attach(d, pt, electrons.max(1), None) {
                        return Some(d);
                    }
                }
                None => return Some(d),
            }
        }
    }
    let pt = partners?;
    let donor_after = shift_charge(&pt.donor, 1)?;
    let acceptor_after = shift_charge(&pt.acceptor, -1)?;
    let r = vec![pt.donor.clone(), pt.acceptor.clone()];
    let p = vec![donor_after.clone(), acceptor_after.clone()];
    let mut d = describe_skeleton("electron_transfer", r, p, hint)?;
    d.note = Some(format!("one-electron step of a {}-electron reaction; the products are the intermediates", electrons));
    attach(d, pt, 1, Some((donor_after.as_str(), acceptor_after.as_str())))
}

/// `[(species, coefficient)]` terms of a reaction written as "2 A + B" (signs kept; a term without a coefficient counts 1).
fn parse_terms(side: &str) -> Option<Vec<(String, f64)>> {
    let mut out = Vec::new();
    for t in side.split(" + ") {
        let t = t.trim();
        if t.is_empty() {
            return None;
        }
        match t.split_once(' ') {
            Some((c, sp)) if c.parse::<f64>().is_ok() => out.push((sp.trim().to_string(), c.parse::<f64>().ok()?)),
            _ => out.push((t.to_string(), 1.0)),
        }
    }
    Some(out)
}

/// A discovered reaction's row equation ("-1 MnO4- + -5 Fe+2 + 8 H+ + 1 Mn+2 ..."): negative coefficients are reactants.
fn parse_signed_equation(eq: &str) -> Option<(HashMap<String, f64>, HashMap<String, f64>)> {
    let (mut l, mut r) = (HashMap::new(), HashMap::new());
    for (sp, c) in parse_terms(eq)? {
        if c < 0.0 { *l.entry(sp).or_insert(0.0) += -c } else if c > 0.0 { *r.entry(sp).or_insert(0.0) += c }
    }
    if l.is_empty() || r.is_empty() { None } else { Some((l, r)) }
}

/// A half-reaction written "Zn(s) -> Zn+2 + 2 e-": the two sides and the electrons it moves (> 0 oxidation: electrons on the
/// right; < 0 reduction).
fn parse_half_reaction(eq: &str) -> Option<(HashMap<String, f64>, HashMap<String, f64>, f64)> {
    let (lhs, rhs) = eq.split_once(" -> ")?;
    let (mut l, mut r) = (HashMap::new(), HashMap::new());
    let mut e = 0.0;
    for (sp, c) in parse_terms(lhs)? {
        if sp == "e-" { e -= c } else { *l.entry(sp).or_insert(0.0) += c }
    }
    for (sp, c) in parse_terms(rhs)? {
        if sp == "e-" { e += c } else { *r.entry(sp).or_insert(0.0) += c }
    }
    if l.is_empty() || r.is_empty() || e == 0.0 { None } else { Some((l, r, e)) }
}

fn is_helper_species(sp: &str) -> bool {
    sp == AQUEOUS_SOLVENT || sp == crate::db::seed::PROTON || sp == crate::db::seed::HYDROXIDE
}

fn main_species(m: &HashMap<String, f64>) -> Option<String> {
    let mut keys: Vec<&String> = m.keys().filter(|k| !is_helper_species(k)).collect();
    keys.sort();
    keys.first().map(|s| (*s).clone()).or_else(|| {
        let mut all: Vec<&String> = m.keys().collect();
        all.sort();
        all.first().map(|s| (*s).clone())
    })
}

fn gcd_u(a: u32, b: u32) -> u32 {
    if b == 0 { a } else { gcd_u(b, a % b) }
}

// ------------------------------------------------------------------------------------------------ cache

type CacheKey = String;

fn cache() -> &'static Mutex<HashMap<CacheKey, (u64, Option<Arc<MicroDescription>>)>> {
    static C: OnceLock<Mutex<HashMap<CacheKey, (u64, Option<Arc<MicroDescription>>)>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(HashMap::new()))
}

fn sorted_key(m: &HashMap<String, f64>) -> String {
    let mut v: Vec<String> = m.iter().map(|(k, c)| format!("{}:{}", k, c)).collect();
    v.sort();
    v.join("+")
}

/// A description behind a cache keyed by `key` (the row's species and context) and the store generation.
fn cached_by(key: String, compute: impl FnOnce() -> Option<MicroDescription>) -> Option<Arc<MicroDescription>> {
    let generation = crate::db::SpeciesStore::generation();
    if let Some((g, d)) = cache().lock().ok().and_then(|c| c.get(&key).cloned()) {
        if g == generation {
            return d;
        }
    }
    let d = compute().map(Arc::new);
    if let Ok(mut c) = cache().lock() {
        if c.len() > 3000 {
            c.clear();
        }
        c.insert(key, (crate::db::SpeciesStore::generation(), d.clone()));
    }
    d
}

/// `describe_template` / `describe_proton_transfer` / `describe_association` behind a cache.
fn cached(kind: &str, family: &str, reactants: &HashMap<String, f64>, products: &HashMap<String, f64>, hint: &dyn Fn(&str) -> Option<String>) -> Option<Arc<MicroDescription>> {
    let key = format!("{}|{}|{}>{}", kind, family, sorted_key(reactants), sorted_key(products));
    cached_by(key, || match kind {
        "template" => describe_template(family, reactants, products, hint),
        "association" => describe_association(reactants, products, hint),
        _ => describe_proton_transfer(reactants, products, hint),
    })
}

fn cached_electron_transfer(reactants: &HashMap<String, f64>, products: &HashMap<String, f64>, partners: Option<&EtPartners>, electrons: u32, hint: &dyn Fn(&str) -> Option<String>) -> Option<Arc<MicroDescription>> {
    let who = partners.map_or(String::new(), |p| format!("{}>{}|{}>{}", p.donor, p.donor_product, p.acceptor, p.acceptor_product));
    let key = format!("electron_transfer|{}|{}|{}>{}", who, electrons, sorted_key(reactants), sorted_key(products));
    cached_by(key, || {
        let mut d = describe_electron_transfer(reactants, products, partners, electrons, hint)?;
        // a metal that dissolves or a metal that plates out: the atoms leave / join a lattice instead of meeting in solution
        if d.reactants.iter().chain(d.products.iter()).any(|s| s.ends_with("(s)")) {
            let kind = |s: &str| surface::surface_lattice_kind(s);
            d.surface = surface::split_surface(&d, None, None, &kind, hint);
        }
        Some(d)
    })
}

// ------------------------------------------------------------------------------------------------ rates

/// Radius (m) of a species for the encounter rate: its structure's extent (the Shannon radius of a monatomic ion).
fn encounter_radius_m(species: &str, hint: &dyn Fn(&str) -> Option<String>) -> f64 {
    let s = structure3d::for_species(species, hint(species).as_deref());
    if let Some(r) = s.radius_a {
        return r.max(0.5) * 1e-10;
    }
    let n = s.atoms.len() as f64;
    let (cx, cy, cz) = s.atoms.iter().fold((0.0, 0.0, 0.0), |a, at| (a.0 + at.x / n, a.1 + at.y / n, a.2 + at.z / n));
    let rms = (s.atoms.iter().map(|a| (a.x - cx).powi(2) + (a.y - cy).powi(2) + (a.z - cz).powi(2)).sum::<f64>() / n).sqrt();
    (rms + 1.2).max(1.5) * 1e-10
}

/// Diffusion-limited encounter rate constant (M^-1 s^-1) of two dissolved species in water: the engine's own model of the
/// H+ + OH- recombination (Grotthuss diffusion, 0.75 nm capture) when both are the water ions, the same form with the partner's
/// Stokes-Einstein diffusion for a proton or hydroxide with another species, and the screened Smoluchowski rate otherwise.
fn encounter_rate(a: &str, b: &str, t_k: f64, ionic: f64, hint: &dyn Fn(&str) -> Option<String>) -> f64 {
    use crate::transport as tr;
    let (h, oh) = (crate::db::seed::PROTON, crate::db::seed::HYDROXIDE);
    let charge = |s: &str| structure3d::for_species(s, hint(s).as_deref()).charge as f64;
    if (a == h && b == oh) || (a == oh && b == h) {
        return tr::h_oh_recombination_rate(t_k);
    }
    let eta = tr::viscosity_water_pa_s(t_k);
    let eps = tr::dielectric_water(t_k);
    let tr_ratio = (t_k / 298.15) * (tr::viscosity_water_pa_s(298.15) / eta);
    for (fast, other, d_fast) in [(a, b, 9.31e-9), (b, a, 9.31e-9)] {
        if fast == h {
            let d_other = tr::diffusivity_m2_s(encounter_radius_m(other, hint), t_k, eta);
            let r_cap = 0.75e-9;
            let f = tr::debye_factor(charge(fast) * charge(other), 1.0, r_cap, t_k, eps);
            return 4.0 * std::f64::consts::PI * tr::N_AVOGADRO * (d_fast * tr_ratio + d_other) * r_cap * f * 1e3;
        }
    }
    tr::k_diffusion_limit_screened(encounter_radius_m(a, hint), encounter_radius_m(b, hint), charge(a), charge(b), t_k, eta, eps, ionic)
}

impl Vessel {
    /// `micro_reactions` of the first liquid phase of a kind: `"aqueous"` (a phase holding water as its solvent) or `"organic"`
    /// (the first liquid phase that does not). Empty for a gas or when the vessel has no such phase.
    pub fn micro_reactions_in(&self, phase: &str) -> Vec<MicroReaction> {
        let want_aqueous = match phase {
            "aqueous" => true,
            "organic" => false,
            "gas" => return self.micro_gas_reactions(),
            _ => return Vec::new(),
        };
        match (0..=self.extra_liquids.len()).find(|&p| self.phase_is_aqueous(self.liquid_phase_map(p)) == want_aqueous) {
            Some(p) => self.micro_reactions(p),
            None => Vec::new(),
        }
    }

    /// The reactions of the gas phase: the exchanges across the liquid surface (evaporation, condensation, dissolved gases
    /// leaving or entering, boiling; seen from the gas side), the fuels that burn, and solids that decompose (the surface views
    /// of a vessel without liquid ask for these).
    pub fn micro_gas_reactions(&self) -> Vec<MicroReaction> {
        let hint = |s: &str| self.smiles_of(Some(s));
        let mut out = self.transfer_rows(None);
        out.extend(self.combustion_rows(&hint));
        out.extend(self.decomposition_rows(0, &hint));
        out
    }

    /// The reactions of liquid phase `layer` the molecular viewer can show: the template and proton-transfer rows that have
    /// their reactants in the phase, each with its atom map and its gross rates, plus the active rows that are not mapped yet
    /// (`kind` "other", no atom map).
    pub fn micro_reactions(&self, layer: usize) -> Vec<MicroReaction> {
        if layer > self.extra_liquids.len() {
            return Vec::new();
        }
        let map = self.liquid_phase_map(layer);
        let vol_l = self.phase_volume_ml(map, self.temperature_k) / 1000.0;
        if vol_l <= 0.0 {
            return Vec::new();
        }
        let hint = |s: &str| self.smiles_of(Some(s));
        let present = |sp: &str, floor: f64| map.get(sp).copied().unwrap_or(0.0) > floor || self.solid_mol.get(sp).copied().unwrap_or(0.0) > floor;
        let class = self.phase_solvent_class(layer);
        let ionic = if layer == 0 { self.calc_ionic_strength() } else { 0.0 };
        let mut out = Vec::new();

        // kinetic rows: generated template rows and the hand-written ones
        for rxn in &self.kinetic_reactions {
            let applies = match rxn.phase_class.as_deref() {
                Some(c) => c == class,
                None => layer == 0,
            };
            if !applies || !rxn.reactants.keys().all(|k| present(k, 1e-15)) {
                continue;
            }
            let template_key = self.generated_rate_keys.get(&rxn.id).and_then(|g| g.key.split('|').next()).map(str::to_string);
            let desc = match &template_key {
                Some(f) if !f.is_empty() => cached("template", f, &rxn.reactants, &rxn.products, &hint),
                _ => None,
            }
            .or_else(|| cached("proton_transfer", "", &rxn.reactants, &rxn.products, &hint));
            let active = self.active_reactions.iter().any(|a| a.id == rxn.id);
            if desc.is_none() && !active {
                continue;
            }
            let (f, r) = self.kinetic_gross_rates(rxn, layer, vol_l, ionic);
            out.push(row_of(&rxn.id, &rxn.equation, layer, desc.as_deref(), &rxn.reactants, &rxn.products, f * vol_l, r * vol_l, "kinetic row", rxn.is_reversible));
        }

        // equilibria: proton transfers of the primary aqueous phase; their constants are activity constants on the molal basis,
        // so the rates use molal activities (the activity models of the vessel) and the water activity
        if class == "water" && layer == 0 {
            let kg_w = (map.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * 0.01801528).max(1e-12);
            let (mut ln_gamma, a_w) = crate::activity::batch_aqueous_gamma_and_aw(map, self.temperature_k);
            self.apply_mixed_solvent_born(&mut ln_gamma);
            let activity = |sp: &str| -> f64 {
                if sp == AQUEOUS_SOLVENT {
                    a_w
                } else {
                    map.get(sp).copied().unwrap_or(0.0).max(0.0) / kg_w * ln_gamma.get(sp).copied().unwrap_or(0.0).exp()
                }
            };
            for eq in &self.equilibria {
                if eq.reactants.keys().chain(eq.products.keys()).filter(|k| k.as_str() != AQUEOUS_SOLVENT).any(|k| !present(k, 1e-20)) {
                    continue;
                }
                if eq.reactants.keys().chain(eq.products.keys()).any(|k| k.ends_with("(s)") || k.ends_with("(g)")) {
                    continue;
                }
                if let Some(desc) = cached("proton_transfer", "", &eq.reactants, &eq.products, &hint) {
                    let (f, r, source) = self.equilibrium_gross_rates(eq, &activity, ionic, &hint);
                    out.push(row_of(&eq.id, &eq.equation, layer, Some(&desc), &eq.reactants, &eq.products, f * kg_w, r * kg_w, source, true));
                    continue;
                }
                // complexation and ion pairs: metal ion and ligands (or a water that gives up a proton) join into one species
                if let Some(desc) = cached("association", "", &eq.reactants, &eq.products, &hint) {
                    let (f, r, source) = self.complexation_gross_rates(eq, &activity, ionic, &hint);
                    let mut d = (*desc).clone();
                    if eq.source.starts_with("Fuoss") {
                        d.kind = "ion_pair".into();
                    }
                    out.push(row_of(&eq.id, &eq.equation, layer, Some(&d), &eq.reactants, &eq.products, f * kg_w, r * kg_w, source, true));
                    continue;
                }
                // an equilibrium that moved in the last step but has no description (a hydroxo complex with three solute species on a
                // side, an acid-base pair the skeleton pairing cannot read): listed, drawn as a generic swap with the net rate it moved at
                if let Some(a) = self.active_reactions.iter().find(|a| a.id == eq.id) {
                    out.push(row_of(&eq.id, &eq.equation, layer, None, &eq.reactants, &eq.products, a.rate.max(0.0) * kg_w, (-a.rate).max(0.0) * kg_w, "net rate of the equilibrium row (no forward rate constant: gross exchange not modelled)", true));
                }
            }
            out.extend(self.electron_transfer_rows(layer, &hint));
            out.extend(self.mineral_rows(layer));
            out.extend(self.electrode_rows(layer, &hint));
        }
        out.extend(self.transfer_rows(Some(layer)));
        out.extend(self.decomposition_rows(layer, &hint));
        out
    }

    /// Gross forward and reverse rates (mol/(L s)) of a kinetic row at the phase's concentrations.
    fn kinetic_gross_rates(&self, rxn: &crate::chem_db::GeneralKineticRxn, layer: usize, vol_l: f64, ionic: f64) -> (f64, f64) {
        use crate::kinetics::{KineticExtentReaction, KineticExtentSystem};
        let mut names: Vec<String> = Vec::new();
        let index = |s: &str, names: &mut Vec<String>| -> usize {
            names.iter().position(|n| n == s).unwrap_or_else(|| {
                names.push(s.to_string());
                names.len() - 1
            })
        };
        let reactants: Vec<(usize, f64)> = rxn.reactants.iter().map(|(s, &c)| (index(s, &mut names), c)).collect();
        let products: Vec<(usize, f64)> = rxn.products.iter().map(|(s, &c)| (index(s, &mut names), c)).collect();
        let orders: Vec<(usize, f64)> = match &rxn.orders {
            Some(o) => o.iter().map(|(s, &c)| (index(s, &mut names), c)).collect(),
            None => reactants.clone(),
        };
        let system_rxn = KineticExtentReaction {
            id: rxn.id.clone(),
            equation: rxn.equation.clone(),
            reactants,
            products: products.clone(),
            gas_products: rxn.gas_products.iter().map(|(g, &c)| (g.clone(), c)).collect(),
            orders_reactants: orders,
            orders_products: products,
            arrhenius_a: rxn.arrhenius_a,
            arrhenius_n: rxn.arrhenius_n,
            arrhenius_ea: rxn.arrhenius_ea,
            delta_h_kj: rxn.delta_h_kj,
            catalyst_species: rxn.catalyst_species.clone(),
            is_reversible: rxn.is_reversible,
            k_eq_298: rxn.k_eq_298,
            tier: rxn.tier.clone(),
            source: rxn.source.clone(),
        };
        let mut system = KineticExtentSystem::new(names.clone(), vec![system_rxn]);
        let kg_solvent = self.liquid_phase_map(layer).get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * 0.01801528;
        if kg_solvent > 1e-9 {
            system.solvent_kg_per_l = (kg_solvent / vol_l).clamp(0.2, 1.5);
        }
        let concs: Vec<f64> = names.iter().map(|s| self.liquid_phase_map(layer).get(s).copied().or_else(|| self.solid_mol.get(s).copied()).unwrap_or(0.0) / vol_l).collect();
        let g = system.gross_rates(&concs, self.temperature_k, self.pressure_atm * 101325.0, ionic, &self.catalyst_areas());
        g.first().copied().unwrap_or((0.0, 0.0))
    }

    /// Gross rates (mol/(kg s) of solvent) of a proton-transfer equilibrium: the encounter-limited rate in the direction that
    /// brings two molecules together (or the downhill one when both sides have as many), the detailed-balance value in the
    /// other, both on the activities of the equilibrium constant.
    fn equilibrium_gross_rates(&self, eq: &crate::chem_db::GeneralEquilibrium, activity: &dyn Fn(&str) -> f64, ionic: f64, hint: &dyn Fn(&str) -> Option<String>) -> (f64, f64, &'static str) {
        let solute = |m: &HashMap<String, f64>| -> Vec<(String, f64)> { m.iter().filter(|(k, _)| k.as_str() != AQUEOUS_SOLVENT).map(|(k, &c)| (k.clone(), c)).collect() };
        let (rs, ps) = (solute(&eq.reactants), solute(&eq.products));
        let count = |v: &[(String, f64)]| v.iter().map(|(_, c)| c).sum::<f64>().round() as usize;
        let (nr, np) = (count(&rs), count(&ps));
        let k_eq = 10f64.powf(eq.log_k_at(self.temperature_k)).max(1e-300);
        // the association direction: two molecules meet
        let forward_assoc = if nr != np { nr > np } else { k_eq >= 1.0 };
        let assoc = if forward_assoc { &rs } else { &ps };
        let species: Vec<&str> = assoc.iter().flat_map(|(s, c)| std::iter::repeat(s.as_str()).take(c.round() as usize)).collect();
        if species.len() != 2 {
            return (0.0, 0.0, "none");
        }
        let k_a = encounter_rate(species[0], species[1], self.temperature_k, ionic, hint);
        let (k_f, k_r) = if forward_assoc { (k_a, k_a / k_eq) } else { (k_a * k_eq, k_a) };
        // the solvent enters with its activity: it is a reactant of the autoprotolysis and a product of a neutralisation
        let act = |m: &HashMap<String, f64>| -> f64 { m.iter().map(|(s, c)| activity(s).powf(*c)).product() };
        (k_f * act(&eq.reactants), k_r * act(&eq.products), "diffusion-limited encounter (transport.rs)")
    }

    /// Gross rates (mol/(kg s) of solvent) of a complexation or ion-pair row `M + n L <=> ML_n`: the first metal-ligand bond is
    /// the step (Eigen-Wilkins `k_f = K_os k_ex` of the aqua ion, `substitution.rs`, with its hydroxo path), the stepwise constant
    /// is the geometric mean `K^(1/n)` the engine's own relaxation uses, and the other direction follows by detailed balance, so a
    /// row at its equilibrium exchanges equally in both directions. A metal ion without a water-exchange rate, and a row that is
    /// not `M + n L`, use the diffusion-limited encounter of the two partners.
    fn complexation_gross_rates(&self, eq: &crate::chem_db::GeneralEquilibrium, activity: &dyn Fn(&str) -> f64, ionic: f64, hint: &dyn Fn(&str) -> Option<String>) -> (f64, f64, &'static str) {
        use crate::substitution as sub;
        let encounter = || self.equilibrium_gross_rates(eq, activity, ionic, hint);
        let Some((metal, ligand, n)) = sub::complexation_parts(eq) else { return encounter() };
        let Some(product) = eq.products.keys().find(|k| k.as_str() != AQUEOUS_SOLVENT) else { return encounter() };
        let (zm, zl) = (crate::ions::species_charge(&metal), crate::ions::species_charge(&ligand));
        let rm = crate::crystal::ionic_radius_angstrom(&metal).unwrap_or(0.8);
        let rl = crate::crystal::ionic_radius_angstrom(&ligand).unwrap_or(1.4);
        let dist = rm + rl + crate::ion_pairing::CONTACT_OFFSET_A;
        let Some(rate) = sub::eigen_wilkins_rate(&metal, zm, zl, dist, self.temperature_k) else { return encounter() };
        let k_f = rate.k_forward_at(self.temperature_k, &|sp: &str| activity(sp), ionic);
        let k_eq = 10f64.powf(eq.log_k_at(self.temperature_k)).max(1e-300);
        let k_step = k_eq.powf(1.0 / n.max(1.0)).max(1e-300);
        let rev = k_f * activity(product) / k_step;
        let fwd = k_f * k_step.powf(n - 1.0) * activity(&metal) * activity(&ligand).powf(n);
        (fwd, rev, "Eigen-Wilkins first bond k_f = K_os k_ex (substitution.rs), stepwise K^(1/n), detailed balance")
    }

    /// The electron transfers of the aqueous phase: the homogeneous redox reactions the Gibbs discovery runs (rate = the net
    /// rate it applied in the last step, which is limited by the Marcus encounter rate) and the metal / solution pairs of a
    /// mixed-potential corrosion or cementation (the anodic and cathodic half-reactions of the electrode model paired by their
    /// electron flows).
    fn electron_transfer_rows(&self, layer: usize, hint: &dyn Fn(&str) -> Option<String>) -> Vec<MicroReaction> {
        let mut out = Vec::new();
        let vol_l = (self.reaction_volume_ml() / 1000.0).max(1e-9);
        let pretty = |l: &HashMap<String, f64>, r: &HashMap<String, f64>| -> String {
            let side = |m: &HashMap<String, f64>| -> String {
                let mut v: Vec<(&String, &f64)> = m.iter().collect();
                v.sort_by(|a, b| a.0.cmp(b.0));
                v.iter().map(|(k, c)| if (**c - 1.0).abs() < 1e-9 { (*k).clone() } else { format!("{} {}", c, k) }).collect::<Vec<_>>().join(" + ")
            };
            format!("{} -> {}", side(l), side(r))
        };
        // homogeneous electron transfer found by Gibbs discovery: its partners were kept when the row was made
        for row in self.active_reactions.iter().filter(|r| r.kind == "redox" && r.rate > 0.0) {
            let Some((l, r)) = parse_signed_equation(&row.equation) else { continue };
            let (partners, electrons) = match self.redox_partners.get(&row.equation) {
                Some(i) => (Some(EtPartners { donor: i.donor.clone(), donor_product: i.donor_product.clone(), acceptor: i.acceptor.clone(), acceptor_product: i.acceptor_product.clone() }), i.electrons),
                None => (None, 1),
            };
            let desc = cached_electron_transfer(&l, &r, partners.as_ref(), electrons, hint);
            // one event per electron when the event is a single hop of a many-electron reaction
            let events = row.rate * vol_l * desc.as_ref().map_or(1.0, |d| if d.note.is_some() { electrons as f64 } else { 1.0 });
            out.push(row_of(&format!("{}|{}", row.id, pretty(&l, &r)), &pretty(&l, &r), layer, desc.as_deref(), &l, &r, events, 0.0, "net rate of the discovered reaction (Marcus encounter rate, gem/rates.rs)", false));
        }
        // mixed-potential pairs: the anodic and cathodic half-reactions of a corroding / cementing metal
        struct Half { id: String, l: HashMap<String, f64>, r: HashMap<String, f64>, n: u32, flux: f64 }
        let (mut anodic, mut cathodic) = (Vec::new(), Vec::new());
        for row in self.active_reactions.iter().filter(|r| r.kind == "corrosion" && r.rate > 0.0) {
            let Some((l, r, e)) = parse_half_reaction(&row.equation) else { continue };
            let n = e.abs().round();
            if (e.abs() - n).abs() > 1e-9 || !(1.0..=8.0).contains(&n) {
                continue;
            }
            let h = Half { id: row.id.clone(), l, r, n: n as u32, flux: row.rate * n };
            if e > 0.0 { anodic.push(h) } else { cathodic.push(h) }
        }
        let total: f64 = anodic.iter().map(|h| h.flux).sum();
        if total > 0.0 {
            let mut pairs: Vec<(f64, usize, usize)> = Vec::new();
            for (i, a) in anodic.iter().enumerate() {
                for (j, c) in cathodic.iter().enumerate() {
                    pairs.push((a.flux * c.flux / total, i, j));
                }
            }
            pairs.sort_by(|x, y| y.0.partial_cmp(&x.0).unwrap_or(std::cmp::Ordering::Equal));
            let top = pairs.first().map_or(0.0, |p| p.0);
            for (flux, i, j) in pairs.into_iter().take(6).filter(|p| p.0 > 1e-6 * top) {
                let (a, c) = (&anodic[i], &cathodic[j]);
                let big_l = {
                    let g = gcd_u(a.n, c.n);
                    a.n / g * c.n
                };
                let (ma, mc) = ((big_l / a.n) as f64, (big_l / c.n) as f64);
                let mut l = HashMap::new();
                let mut r = HashMap::new();
                for (k, v) in &a.l { *l.entry(k.clone()).or_insert(0.0) += v * ma; }
                for (k, v) in &c.l { *l.entry(k.clone()).or_insert(0.0) += v * mc; }
                for (k, v) in &a.r { *r.entry(k.clone()).or_insert(0.0) += v * ma; }
                for (k, v) in &c.r { *r.entry(k.clone()).or_insert(0.0) += v * mc; }
                let (l, r) = cancel(l, r);
                if l.is_empty() || r.is_empty() {
                    continue;
                }
                let (Some(donor), Some(donor_product), Some(acceptor), Some(acceptor_product)) = (main_species(&a.l), main_species(&a.r), main_species(&c.l), main_species(&c.r)) else { continue };
                let partners = EtPartners { donor, donor_product, acceptor, acceptor_product };
                let desc = cached_electron_transfer(&l, &r, Some(&partners), big_l, hint);
                let events = if desc.as_ref().map_or(false, |d| d.note.is_some()) { flux } else { flux / big_l as f64 };
                out.push(row_of(&format!("pair_{}_{}", a.id, c.id), &pretty(&l, &r), layer, desc.as_deref(), &l, &r, events, 0.0, "anodic and cathodic half-reactions paired by their electron flows (Butler-Volmer, vessel_electro.rs)", false));
            }
        }
        out
    }
}

/// The molecules of a side for a row that has no description: any phase, whole coefficients, empty if they are not.
fn expand_any_lenient(map: &HashMap<String, f64>) -> Vec<String> {
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();
    let mut out = Vec::new();
    for k in keys {
        let c = map[k];
        if (c - c.round()).abs() > 1e-9 || !(1.0..=8.0).contains(&c) {
            return Vec::new();
        }
        out.extend(std::iter::repeat(k.clone()).take(c.round() as usize));
    }
    out
}

#[allow(clippy::too_many_arguments)]
fn row_of(id: &str, equation: &str, layer: usize, desc: Option<&MicroDescription>, reactants: &HashMap<String, f64>, products: &HashMap<String, f64>, fwd: f64, rev: f64, source: &str, reversible: bool) -> MicroReaction {
    let (kind, family, r, p, atom_map, moving_h, schematic, electrons, hops, note, surface) = match desc {
        Some(d) => (d.kind.clone(), d.family.clone(), d.reactants.clone(), d.products.clone(), d.atom_map.clone(), d.moving_h.clone(), d.schematic_mapping, d.electrons, d.electron_hops.clone(), d.note.clone(), d.surface.clone()),
        None => ("other".to_string(), None, expand_any_lenient(reactants), expand_any_lenient(products), Vec::new(), Vec::new(), false, 0, Vec::new(), None, None),
    };
    MicroReaction {
        id: id.to_string(),
        equation: equation.to_string(),
        kind,
        family,
        layer,
        reactants: r,
        products: p,
        atom_map,
        moving_h,
        schematic_mapping: schematic,
        electrons,
        electron_hops: hops,
        note,
        surface,
        net_rate_mol_s: fwd - rev,
        gross_forward_mol_s: fwd,
        gross_reverse_mol_s: rev,
        rate_source: if fwd == 0.0 && rev == 0.0 && source != "kinetic row" { "none".into() } else { source.to_string() },
        reversible,
    }
}
