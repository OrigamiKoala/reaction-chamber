//! Data-driven reaction templates (`data/reaction_templates.json`): graph transformations with structure-keyed rate rules.
//!
//! A template names no compound. It says which atoms of which reactants take part (SMARTS alternatives per reactant slot,
//! `smarts.rs`), how the matched atoms are rewritten (`break`, `bond`, `set_bond`, `charge`, `h_delta`), what else comes
//! out (`extra_products`, e.g. a proton) and how fast it goes. The network generator matches the templates against the
//! species a vessel holds, rewrites the matched graphs, registers the products and builds the kinetic rows.
//!
//! Rates are rate rules in the manner of RMG: every rule has conditions (a pattern anchored at an atom of the reaction
//! centre, or a solvent class); among the rules whose conditions hold, the one with the most constraints gives the
//! pre-exponential factor and the activation energy; every matching modifier then scales them (`a_factor`, `ea_add_kj`; a
//! `per_match` modifier once per occurrence of its pattern; `unless` conditions exclude). A rule may instead give an
//! Evans-Polanyi line, `Ea = E0 + alpha dHr`, which the generator completes with the reaction enthalpy of the species data.
//! `degeneracy` multiplies the rate by the number of hydrogens on an atom (the statistical factor of an abstraction).
//! A template with a `redox` entry is an *oxidation half-reaction*, not a kinetic reaction: it names no rate rule and the
//! generator never builds a reaction from it. It says which molecule an oxidant converts a species into (an alcohol into the
//! carbonyl compound, an aldehyde into the acid), so that the oxidised form is a registered species the Gibbs-driven redox
//! discovery (`gem/discovery.rs`) can pair with an oxidant, and gives the self-exchange rate constant of that couple, from
//! which the Marcus cross relation derives the rate against any oxidant (`gem/rates.rs`).
//! A modifier may carry a Hammett-Brown relation (`hammett`: rho and the ring atom attacked): the substituents of the
//! aromatic ring shift the activation energy so that `log k / k0 = rho sum sigma+` at 298 K (`pka_structure::ring_sigma_plus`);
//! the ortho substituents add a steric cost; a ring whose substituents have no constant gets no rate.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use serde::Deserialize;

use crate::smarts::{self, MolView, Pattern};
use crate::physics::R_GAS as R_GAS_J;
use crate::smiles::{self, Molecule};

// ------------------------------------------------------------------------------------------------ raw (JSON) forms

#[derive(Deserialize)]
struct TemplateFile {
    templates: Vec<RawTemplate>,
}

#[derive(Deserialize)]
struct RawTemplate {
    id: String,
    name: String,
    category: String,
    reactants: Vec<RawSlot>,
    edits: Vec<RawEdit>,
    #[serde(default)]
    extra_products: Vec<String>,
    #[serde(default)]
    degeneracy: Option<RawDegeneracy>,
    #[serde(default)]
    variants: Vec<RawVariant>,
    #[serde(default)]
    rules: Vec<RawRule>,
    #[serde(default)]
    modifiers: Vec<RawModifier>,
    #[serde(default)]
    redox: Option<RawRedox>,
}

#[derive(Deserialize)]
struct RawRedox {
    electrons: u32,
    /// self-exchange rate constant of the couple, M-1 s-1
    k_self: f64,
    #[serde(default)]
    source: String,
}

#[derive(Deserialize)]
struct RawSlot {
    role: String,
    any_of: Vec<String>,
    #[serde(default)]
    forbid: Vec<RawCond>,
    #[serde(default)]
    net_charge_max: Option<i32>,
    #[serde(default)]
    net_charge_min: Option<i32>,
}

#[derive(Deserialize, Clone)]
struct RawCond {
    #[serde(default)]
    reactant: usize,
    #[serde(default)]
    center: usize,
    #[serde(default)]
    smarts: Option<String>,
    #[serde(default)]
    solvent: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct RawEdit {
    op: String,
    #[serde(default)]
    a: Option<[usize; 2]>,
    #[serde(default)]
    b: Option<[usize; 2]>,
    #[serde(default)]
    atom: Option<[usize; 2]>,
    #[serde(default)]
    order: Option<f64>,
    #[serde(default)]
    value: Option<i32>,
    #[serde(default)]
    delta: Option<i32>,
}

#[derive(Deserialize)]
struct RawDegeneracy {
    h_of: [usize; 2],
}

#[derive(Deserialize)]
struct RawCatalyst {
    species: String,
    order: f64,
}

#[derive(Deserialize)]
struct RawEp {
    e0_kj: f64,
    alpha: f64,
    a: f64,
}

#[derive(Deserialize)]
struct RawRule {
    id: String,
    #[serde(default)]
    when: Vec<RawCond>,
    #[serde(default)]
    a: Option<f64>,
    #[serde(default)]
    ea_kj: Option<f64>,
    #[serde(default)]
    ep: Option<RawEp>,
    #[serde(default)]
    source: String,
}

#[derive(Deserialize)]
struct RawModifier {
    id: String,
    #[serde(default)]
    when: Vec<RawCond>,
    #[serde(default)]
    unless: Vec<RawCond>,
    #[serde(default = "one")]
    a_factor: f64,
    #[serde(default)]
    ea_add_kj: f64,
    #[serde(default)]
    per_match: bool,
    #[serde(default)]
    hammett: Option<RawHammett>,
    /// where the factor comes from (documentation of the data)
    #[serde(default)]
    #[allow(dead_code)]
    source: String,
}

#[derive(Deserialize)]
struct RawHammett {
    rho: f64,
    #[serde(default)]
    reactant: usize,
    #[serde(default)]
    center: usize,
    /// charge the ortho steric cost of `pka_structure::ortho_steric_kj` per substituent beside the attacked atom
    #[serde(default)]
    ortho_steric: bool,
}

fn one() -> f64 {
    1.0
}

#[derive(Deserialize)]
struct RawVariant {
    #[serde(default)]
    tag: String,
    #[serde(default)]
    catalysts: Vec<RawCatalyst>,
    #[serde(default)]
    rules: Vec<RawRule>,
    #[serde(default)]
    modifiers: Vec<RawModifier>,
}

// ------------------------------------------------------------------------------------------------ compiled forms

#[derive(Clone, Debug)]
pub struct Cond {
    reactant: usize,
    center: usize,
    pattern: Option<Pattern>,
    solvent: Option<Vec<String>>,
}

#[derive(Clone, Debug)]
pub struct Rule {
    pub id: String,
    when: Vec<Cond>,
    a: Option<f64>,
    ea_j: Option<f64>,
    ep: Option<(f64, f64, f64)>,
    pub source: String,
}

#[derive(Clone, Debug)]
pub struct Hammett {
    rho: f64,
    reactant: usize,
    center: usize,
    ortho_steric: bool,
}

#[derive(Clone, Debug)]
pub struct Modifier {
    pub id: String,
    when: Vec<Cond>,
    unless: Vec<Cond>,
    a_factor: f64,
    ea_add_j: f64,
    per_match: bool,
    hammett: Option<Hammett>,
}

#[derive(Clone, Debug)]
pub struct Variant {
    pub tag: String,
    /// Species whose concentration enters the rate law with the given order (they are not consumed).
    pub catalysts: Vec<(String, f64)>,
    rules: Vec<Rule>,
    modifiers: Vec<Modifier>,
}

#[derive(Clone, Debug)]
pub struct Slot {
    pub role: String,
    patterns: Vec<Pattern>,
    forbid: Vec<Cond>,
    net_charge_max: Option<i32>,
    net_charge_min: Option<i32>,
}

#[derive(Clone, Debug)]
enum Edit {
    Break((usize, usize), (usize, usize)),
    Bond((usize, usize), (usize, usize), f64),
    SetBond((usize, usize), (usize, usize), f64),
    Charge((usize, usize), i32),
    HDelta((usize, usize), i32),
    SolventProton((usize, usize)),
}

/// The redox half-reaction a template stands for (see the module documentation).
#[derive(Clone, Debug)]
pub struct Redox {
    pub electrons: u32,
    pub k_self: f64,
    pub source: String,
}

#[derive(Clone, Debug)]
pub struct Template {
    pub id: String,
    pub name: String,
    pub category: String,
    slots: Vec<Slot>,
    edits: Vec<Edit>,
    extra_products: Vec<Molecule>,
    degeneracy: Option<(usize, usize)>,
    pub variants: Vec<Variant>,
    pub redox: Option<Redox>,
}

/// One matching of a template: the molecule of each slot and the molecule atom matched by every pattern atom.
pub struct Instance<'a> {
    pub template: &'a Template,
    pub mols: Vec<&'a Molecule>,
    pub maps: Vec<&'a Vec<usize>>,
}

/// The rate a variant gives an instance.
#[derive(Clone, Debug)]
pub struct Rate {
    pub variant: usize,
    /// pre-exponential factor (M^(1-n) s^-1 for the n reactants, per unit of catalyst concentrations)
    pub a: f64,
    /// activation energy (J/mol); None when the rule is an Evans-Polanyi line still waiting for the reaction enthalpy
    pub ea_j: Option<f64>,
    /// Evans-Polanyi line (E0 J/mol, alpha) of the matching rule
    pub ep: Option<(f64, f64)>,
    pub rule: String,
    pub source: String,
    /// The rate constant is that of the whole reaction (a measured or Mayr rate), not of one pathway of the template match.
    pub per_reaction: bool,
}

// ------------------------------------------------------------------------------------------------ loading

fn compile_cond(c: &RawCond, template: &str) -> Cond {
    Cond {
        reactant: c.reactant,
        center: c.center,
        pattern: c.smarts.as_ref().map(|s| smarts::parse(s).unwrap_or_else(|| panic!("template {}: SMARTS {} does not parse", template, s))),
        solvent: c.solvent.clone(),
    }
}

fn compile_rule(r: &RawRule, template: &str) -> Rule {
    Rule {
        id: r.id.clone(),
        when: r.when.iter().map(|c| compile_cond(c, template)).collect(),
        a: r.a,
        ea_j: r.ea_kj.map(|e| e * 1000.0),
        ep: r.ep.as_ref().map(|e| (e.e0_kj * 1000.0, e.alpha, e.a)),
        source: r.source.clone(),
    }
}

fn compile_modifier(m: &RawModifier, template: &str) -> Modifier {
    Modifier {
        id: m.id.clone(),
        when: m.when.iter().map(|c| compile_cond(c, template)).collect(),
        unless: m.unless.iter().map(|c| compile_cond(c, template)).collect(),
        a_factor: m.a_factor,
        ea_add_j: m.ea_add_kj * 1000.0,
        per_match: m.per_match,
        hammett: m.hammett.as_ref().map(|h| Hammett { rho: h.rho, reactant: h.reactant, center: h.center, ortho_steric: h.ortho_steric }),
    }
}

fn compile(raw: RawTemplate) -> Template {
    let id = raw.id.clone();
    let slots: Vec<Slot> = raw
        .reactants
        .iter()
        .map(|s| Slot {
            role: s.role.clone(),
            patterns: s.any_of.iter().map(|p| smarts::parse(p).unwrap_or_else(|| panic!("template {}: SMARTS {} does not parse", id, p))).collect(),
            forbid: s.forbid.iter().map(|c| compile_cond(c, &id)).collect(),
            net_charge_max: s.net_charge_max,
            net_charge_min: s.net_charge_min,
        })
        .collect();
    let edits = raw
        .edits
        .iter()
        .map(|e| {
            let pair = |x: Option<[usize; 2]>| x.map(|p| (p[0], p[1])).unwrap_or_else(|| panic!("template {}: edit {} lacks an atom", id, e.op));
            match e.op.as_str() {
                "break" => Edit::Break(pair(e.a), pair(e.b)),
                "bond" => Edit::Bond(pair(e.a), pair(e.b), e.order.unwrap_or(1.0)),
                "set_bond" => Edit::SetBond(pair(e.a), pair(e.b), e.order.unwrap_or(1.0)),
                "charge" => Edit::Charge(pair(e.atom), e.value.unwrap_or(0)),
                "h_delta" => Edit::HDelta(pair(e.atom), e.delta.unwrap_or(0)),
                "solvent_proton" => Edit::SolventProton(pair(e.atom)),
                other => panic!("template {}: unknown edit {}", id, other),
            }
        })
        .collect();
    let template_rules: Vec<Rule> = raw.rules.iter().map(|r| compile_rule(r, &id)).collect();
    let template_mods: Vec<Modifier> = raw.modifiers.iter().map(|m| compile_modifier(m, &id)).collect();
    let variants: Vec<Variant> = if raw.variants.is_empty() {
        vec![Variant { tag: String::new(), catalysts: Vec::new(), rules: template_rules.clone(), modifiers: template_mods.clone() }]
    } else {
        raw.variants
            .iter()
            .map(|v| Variant {
                tag: v.tag.clone(),
                catalysts: v.catalysts.iter().map(|c| (c.species.clone(), c.order)).collect(),
                rules: if v.rules.is_empty() { template_rules.clone() } else { v.rules.iter().map(|r| compile_rule(r, &id)).collect() },
                modifiers: template_mods.iter().cloned().chain(v.modifiers.iter().map(|m| compile_modifier(m, &id))).collect(),
            })
            .collect()
    };
    Template {
        id: raw.id,
        name: raw.name,
        category: raw.category,
        slots,
        edits,
        extra_products: raw.extra_products.iter().map(|s| smiles::parse(s).unwrap_or_else(|| panic!("template {}: product {} does not parse", id, s))).collect(),
        degeneracy: raw.degeneracy.map(|d| (d.h_of[0], d.h_of[1])),
        variants,
        redox: raw.redox.map(|r| Redox { electrons: r.electrons, k_self: r.k_self, source: r.source }),
    }
}

/// Every template of `data/reaction_templates.json`.
pub fn templates() -> &'static [Template] {
    static T: OnceLock<Vec<Template>> = OnceLock::new();
    T.get_or_init(|| serde_json::from_str::<TemplateFile>(include_str!("../data/reaction_templates.json")).expect("data/reaction_templates.json").templates.into_iter().map(compile).collect())
}

// ------------------------------------------------------------------------------------------------ matching

/// Matches of a condition's pattern in `mol` whose first atom is `anchor`.
fn anchored_matches(mol: &Molecule, pattern: &Pattern, anchor: usize) -> usize {
    let view = MolView::new(mol);
    let mut found: Vec<Vec<usize>> = smarts::find_matches(&view, pattern).into_iter().filter(|m| m[0] == anchor).collect();
    found.sort();
    found.dedup();
    found.len()
}

impl Template {
    pub fn n_slots(&self) -> usize {
        self.slots.len()
    }

    pub fn slot(&self, i: usize) -> &Slot {
        &self.slots[i]
    }

    /// Every way slot `i` can match `mol`: the molecule atom of each pattern atom. A slot may demand a net charge sign of the
    /// molecule and forbid environments of its reacting centre.
    pub fn slot_matches(&self, i: usize, mol: &Molecule) -> Vec<Vec<usize>> {
        let slot = &self.slots[i];
        let q: i32 = mol.atoms.iter().map(|a| a.charge).sum();
        if slot.net_charge_max.map_or(false, |m| q > m) || slot.net_charge_min.map_or(false, |m| q < m) {
            return Vec::new();
        }
        let view = MolView::new(mol);
        let mut out: Vec<Vec<usize>> = Vec::new();
        for p in &slot.patterns {
            for m in smarts::find_matches(&view, p) {
                if !out.contains(&m) {
                    out.push(m);
                }
            }
        }
        out.retain(|m| {
            !slot.forbid.iter().any(|f| match &f.pattern {
                Some(p) => m.get(f.center).map_or(false, |&anchor| anchored_matches(mol, p, anchor) > 0),
                None => false,
            })
        });
        // the same atoms matched in a different order by a symmetric pattern are one reaction centre
        let mut seen: HashSet<Vec<usize>> = HashSet::new();
        out.retain(|m| seen.insert(m.clone()));
        out
    }

    // -------------------------------------------------------------------------------------------- products

    /// The products of the transformation: the connected pieces of the rewritten reactant graphs, then the template's extra
    /// products. None when an edit cannot be applied (a bond that is not there).
    pub fn products(&self, inst: &Instance) -> Option<Vec<Molecule>> {
        let mut atoms = Vec::new();
        let mut bonds: Vec<(usize, usize, f64)> = Vec::new();
        let mut h0: Vec<u32> = Vec::new();
        let mut offs = Vec::new();
        for m in &inst.mols {
            let off = atoms.len();
            offs.push(off);
            for i in 0..m.atoms.len() {
                h0.push(m.hydrogens(i));
            }
            atoms.extend(m.atoms.iter().cloned());
            for &(a, b, o) in &m.bonds {
                bonds.push((a + off, b + off, o));
            }
        }
        let at = |(slot, p): (usize, usize)| -> Option<usize> { Some(offs[slot] + *inst.maps[slot].get(p)?) };
        let mut pinned: HashSet<usize> = HashSet::new();
        let mut delta: HashMap<usize, i32> = HashMap::new();
        let mut has_solvent_proton = false;
        for e in &self.edits {
            match e {
                Edit::Break(a, b) => {
                    let (x, y) = (at(*a)?, at(*b)?);
                    let k = bonds.iter().position(|&(p, q, _)| (p == x && q == y) || (p == y && q == x))?;
                    bonds.remove(k);
                }
                Edit::Bond(a, b, order) => {
                    let (x, y) = (at(*a)?, at(*b)?);
                    match bonds.iter_mut().find(|(p, q, _)| (*p == x && *q == y) || (*p == y && *q == x)) {
                        Some(bd) => bd.2 = *order,
                        None => bonds.push((x, y, *order)),
                    }
                }
                Edit::SetBond(a, b, order) => {
                    let (x, y) = (at(*a)?, at(*b)?);
                    let bd = bonds.iter_mut().find(|(p, q, _)| (*p == x && *q == y) || (*p == y && *q == x))?;
                    bd.2 = *order;
                }
                Edit::Charge(a, value) => {
                    let x = at(*a)?;
                    atoms[x].charge = *value;
                    pinned.insert(x);
                }
                Edit::HDelta(a, d) => {
                    let x = at(*a)?;
                    *delta.entry(x).or_insert(0) += *d;
                    pinned.insert(x);
                }
                Edit::SolventProton(a) => {
                    let x = at(*a)?;
                    *delta.entry(x).or_insert(0) += 1;
                    pinned.insert(x);
                    has_solvent_proton = true;
                }
            }
        }
        if has_solvent_proton {
            let net_reactant_charge: i32 = inst.mols.iter().map(|m| m.atoms.iter().map(|at| at.charge).sum::<i32>()).sum();
            if net_reactant_charge >= 0 {
                // Neutral nucleophile (amine): transfer proton from nucleophile heteroatom with H > 0
                if let (Some(nuc_map), Some(_)) = (inst.maps.get(1), inst.mols.get(1)) {
                    if let Some(&nuc_atom) = nuc_map.first() {
                        let g_nuc = offs[1] + nuc_atom;
                        if h0[g_nuc] > 0 {
                            *delta.entry(g_nuc).or_insert(0) -= 1;
                            pinned.insert(g_nuc);
                        }
                    }
                }
            }
        }
        // hydrogens: an atom that was written with its hydrogens (a bracket atom), changed charge or was told to gain or lose
        // hydrogens keeps its count (plus the change); every other atom takes the hydrogens its new valence leaves
        for i in 0..atoms.len() {
            if atoms[i].explicit_h.is_some() || pinned.contains(&i) {
                let target = (h0[i] as i32 + delta.get(&i).copied().unwrap_or(0)).max(0) as u32;
                atoms[i].explicit_h = Some(target);
            }
        }
        // connected pieces
        let n = atoms.len();
        let mut comp = vec![usize::MAX; n];
        let mut n_comp = 0;
        for s in 0..n {
            if comp[s] != usize::MAX {
                continue;
            }
            let mut stack = vec![s];
            comp[s] = n_comp;
            while let Some(u) = stack.pop() {
                for &(p, q, _) in &bonds {
                    let v = if p == u { q } else if q == u { p } else { continue };
                    if comp[v] == usize::MAX {
                        comp[v] = n_comp;
                        stack.push(v);
                    }
                }
            }
            n_comp += 1;
        }
        let mut out = Vec::new();
        for c in 0..n_comp {
            let members: Vec<usize> = (0..n).filter(|&i| comp[i] == c).collect();
            let local = |g: usize| members.iter().position(|&m| m == g);
            let mut mol = Molecule { atoms: members.iter().map(|&g| atoms[g].clone()).collect(), bonds: Vec::new() };
            for &(p, q, o) in &bonds {
                if let (Some(a), Some(b)) = (local(p), local(q)) {
                    mol.bonds.push((a, b, o));
                }
            }
            // a neutral atom whose pinned count agrees with its valence is written with implicit hydrogens
            for i in 0..mol.atoms.len() {
                if let Some(t) = mol.atoms[i].explicit_h {
                    if mol.atoms[i].charge == 0 {
                        mol.atoms[i].explicit_h = None;
                        if mol.hydrogens(i) != t {
                            mol.atoms[i].explicit_h = Some(t);
                        }
                    }
                }
            }
            out.push(mol);
        }
        for extra in &self.extra_products {
            out.push(extra.clone());
        }
        if has_solvent_proton {
            let net_reactant_charge: i32 = inst.mols.iter().map(|m| m.atoms.iter().map(|at| at.charge).sum::<i32>()).sum();
            if net_reactant_charge < 0 {
                if let Some(oh) = crate::smiles::parse("[OH-]") {
                    out.push(oh);
                }
            }
        }
        Some(out)
    }

    // -------------------------------------------------------------------------------------------- rates

    fn cond_count(&self, c: &Cond, inst: &Instance, solvent: &str) -> usize {
        if let Some(list) = &c.solvent {
            return list.iter().any(|s| s == solvent) as usize;
        }
        match &c.pattern {
            Some(p) => {
                let (Some(mol), Some(map)) = (inst.mols.get(c.reactant), inst.maps.get(c.reactant)) else { return 0 };
                match map.get(c.center) {
                    Some(&anchor) => anchored_matches(mol, p, anchor),
                    None => 0,
                }
            }
            None => 1,
        }
    }

    fn all_hold(&self, conds: &[Cond], inst: &Instance, solvent: &str) -> bool {
        conds.iter().all(|c| self.cond_count(c, inst, solvent) > 0)
    }

    fn specificity(conds: &[Cond]) -> u32 {
        conds.iter().map(|c| c.pattern.as_ref().map_or(1, |p| p.specificity() + 1)).sum()
    }

    /// The rate every variant gives this instance in a solvent of the given class (variants without a matching rule give
    /// none: a reaction whose rate nothing says is not proposed).
    pub fn rates(&self, inst: &Instance, solvent: &str) -> Vec<Rate> {
        // Precedence 2: check Mayr relation when both partners have measured parameters
        if let Some(cfg) = crate::mayr::template_config(&self.id) {
            if let (Some(nuc_mol), Some(el_mol)) = (inst.mols.get(cfg.nucleophile_slot), inst.mols.get(cfg.electrophile_slot)) {
                if let Some(mayr_rate) = crate::mayr::evaluate(nuc_mol, el_mol, solvent) {
                    let base_ea = self.variants.first().and_then(|v| v.rules.first()).and_then(|r| r.ea_j).unwrap_or(25000.0);
                    let mayr_a = mayr_rate.k_20 * (base_ea / (R_GAS_J * 293.15)).exp();
                    return vec![Rate {
                        variant: 0,
                        a: mayr_a,
                        ea_j: Some(base_ea),
                        ep: None,
                        rule: format!("mayr_{}", self.id),
                        source: mayr_rate.source,
                        per_reaction: true,
                    }];
                }
            }
        }
        let mut out = Vec::new();
        for (vi, v) in self.variants.iter().enumerate() {
            let best = v
                .rules
                .iter()
                .filter(|r| self.all_hold(&r.when, inst, solvent))
                .fold(None::<&Rule>, |acc, r| match acc {
                    Some(b) if Self::specificity(&b.when) >= Self::specificity(&r.when) => Some(b),
                    _ => Some(r),
                });
            let Some(rule) = best else { continue };
            let (mut a, mut ea, ep) = match (rule.a, rule.ea_j, rule.ep) {
                (Some(a), Some(ea), _) => (a, Some(ea), None),
                (_, _, Some((e0, alpha, a))) => (a, None, Some((e0, alpha))),
                _ => continue,
            };
            let mut ea_add = 0.0;
            let mut assessable = true;
            for m in &v.modifiers {
                if !self.all_hold(&m.when, inst, solvent) || m.unless.iter().any(|c| self.cond_count(c, inst, solvent) > 0) {
                    continue;
                }
                let times = if m.per_match { m.when.first().map_or(1, |c| self.cond_count(c, inst, solvent)) } else { 1 };
                a *= m.a_factor.powi(times as i32);
                ea_add += m.ea_add_j * times as f64;
                if let Some(h) = &m.hammett {
                    match self.hammett_shift_j(h, inst) {
                        Some(shift) => ea_add += shift,
                        None => assessable = false,
                    }
                }
            }
            if !assessable {
                continue;
            }
            if let Some((slot, atom)) = self.degeneracy {
                if let (Some(mol), Some(map)) = (inst.mols.get(slot), inst.maps.get(slot)) {
                    if let Some(&i) = map.get(atom) {
                        a *= mol.hydrogens(i) as f64;
                    }
                }
            }
            if a <= 0.0 {
                continue;
            }
            ea = ea.map(|e| e + ea_add);
            out.push(Rate { variant: vi, a, ea_j: ea, ep: ep.map(|(e0, al)| (e0 + ea_add, al)), rule: rule.id.clone(), source: rule.source.clone(), per_reaction: false });
        }
        out
    }

    /// Change of the activation energy (J/mol) the substituents of an aromatic ring make, from the Hammett-Brown relation
    /// `log10(k/k0) = rho sum sigma+` at 298.15 K (an enthalpic shift, so rho falls with temperature like 1/T), plus the
    /// steric cost of the ortho substituents. None when the ring cannot be assessed.
    fn hammett_shift_j(&self, h: &Hammett, inst: &Instance) -> Option<f64> {
        let mol = inst.mols.get(h.reactant)?;
        let atom = *inst.maps.get(h.reactant)?.get(h.center)?;
        let r = crate::pka_structure::ring_sigma_plus(mol, atom)?;
        let mut shift = -h.rho * r.sum * std::f64::consts::LN_10 * R_GAS_J * 298.15;
        if h.ortho_steric {
            shift += r.n_ortho as f64 * crate::pka_structure::ortho_steric_kj() * 1000.0;
        }
        Some(shift)
    }

    /// The reacting atoms of an instance as a short key (`slot.atom`), for reaction ids.
    pub fn centre_key(&self, inst: &Instance) -> String {
        inst.maps.iter().enumerate().map(|(s, m)| format!("{}.{}", s, m.iter().map(|x| x.to_string()).collect::<Vec<_>>().join("-"))).collect::<Vec<_>>().join("_")
    }
}

// ------------------------------------------------------------------------------------------------ oxidation half-reactions

/// An oxidised form of a molecule by one of the oxidation half-reaction templates.
#[derive(Clone, Debug)]
pub struct OxidisedForm {
    pub template: String,
    pub product: Molecule,
    pub electrons: u32,
    pub k_self: f64,
    pub source: String,
}

/// The forms an oxidant can turn `mol` into: for every oxidation template (`redox` entry) the slot-0 matches of the molecule
/// rewritten (the other slot, when there is one, is water). One product per match; duplicates by isomorphism are dropped.
pub fn oxidised_forms(mol: &Molecule) -> Vec<OxidisedForm> {
    let water = smiles::parse("O").expect("water");
    let mut out: Vec<OxidisedForm> = Vec::new();
    for t in templates().iter().filter(|t| t.redox.is_some()) {
        let redox = t.redox.as_ref().unwrap();
        let w_maps = if t.n_slots() == 2 { t.slot_matches(1, &water) } else { Vec::new() };
        if t.n_slots() == 2 && w_maps.is_empty() {
            continue;
        }
        for m in t.slot_matches(0, mol) {
            let inst = Instance {
                template: t,
                mols: if t.n_slots() == 2 { vec![mol, &water] } else { vec![mol] },
                maps: if t.n_slots() == 2 { vec![&m, &w_maps[0]] } else { vec![&m] },
            };
            let Some(mut pieces) = t.products(&inst) else { continue };
            if pieces.len() != 1 {
                continue;
            }
            let product = pieces.remove(0);
            if !out.iter().any(|o| o.product.is_isomorphic(&product)) {
                out.push(OxidisedForm { template: t.id.clone(), product, electrons: redox.electrons, k_self: redox.k_self, source: redox.source.clone() });
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mol(s: &str) -> Molecule {
        smiles::parse(s).unwrap()
    }

    fn find(id: &str) -> &'static Template {
        templates().iter().find(|t| t.id == id).unwrap_or_else(|| panic!("template {}", id))
    }

    /// Products (as SMILES-formulas, sorted) of the first matching instance of a template over the given reactants.
    fn run(id: &str, reactants: &[&str]) -> Vec<String> {
        let t = find(id);
        let mols: Vec<Molecule> = reactants.iter().map(|s| mol(s)).collect();
        let maps: Vec<Vec<Vec<usize>>> = mols.iter().enumerate().map(|(i, m)| t.slot_matches(i, m)).collect();
        assert!(maps.iter().all(|m| !m.is_empty()), "{} must match {:?}", id, reactants);
        let inst = Instance { template: t, mols: mols.iter().collect(), maps: maps.iter().map(|m| &m[0]).collect() };
        let mut out: Vec<String> = t.products(&inst).expect("products").iter().map(|m| m.to_smiles()).collect();
        out.sort();
        out
    }

    /// True when one of the products is the molecule written as `smi` (graph isomorphism, not text).
    fn has(products: &[String], smi: &str) -> bool {
        let want = mol(smi);
        products.iter().any(|p| mol(p).is_isomorphic(&want))
    }

    #[test]
    fn every_template_compiles_and_has_rules() {
        let t = templates();
        assert!(t.len() >= 19);
        for x in t {
            assert!(x.n_slots() >= 1 && !x.variants.is_empty(), "{}", x.id);
        }
    }

    #[test]
    fn rewrites_follow_the_edits() {
        // SN2: ethyl bromide + hydroxide -> ethanol + bromide
        let sn2 = run("sn2_substitution", &["CCBr", "[OH-]"]);
        assert!(sn2.len() == 2 && has(&sn2, "CCO") && has(&sn2, "[Br-]"), "{:?}", sn2);
        // E2: 2-bromopropane + hydroxide -> propene + water + bromide
        let e2 = run("e2_elimination", &["CC(C)Br", "[OH-]"]);
        assert!(e2.len() == 3 && has(&e2, "CC=C") && has(&e2, "O") && has(&e2, "[Br-]"), "{:?}", e2);
        // saponification: ethyl acetate + hydroxide -> acetate + ethanol
        let sap = run("base_ester_hydrolysis", &["CC(=O)OCC", "[OH-]"]);
        assert!(sap.len() == 2 && has(&sap, "CC(=O)[O-]") && has(&sap, "CCO"), "{:?}", sap);
        // keto-enol: acetone -> propen-2-ol
        let enol = run("keto_enol_tautomerism", &["CC(C)=O"]);
        assert_eq!(enol.len(), 1);
        assert_eq!(mol(&enol[0]).formula(), "C3H6O");
        // SN1 releases a proton and a halide
        let sn1 = run("sn1_solvolysis", &["CC(C)(C)Cl", "O"]);
        assert!(sn1.len() == 3 && has(&sn1, "[H+]") && has(&sn1, "[Cl-]") && has(&sn1, "CC(C)(C)O"), "{:?}", sn1);
    }

    #[test]
    fn carbonyl_aldol_aromatic_and_acyl_templates_rewrite_the_graph() {
        // hydration, hemiacetal, carbinolamine, imine
        let hyd = run("carbonyl_hydration", &["CC=O", "O"]);
        assert!(hyd.len() == 1 && has(&hyd, "CC(O)O"), "{:?}", hyd);
        let hem = run("hemiacetal_formation", &["CC=O", "CO"]);
        assert!(hem.len() == 1 && has(&hem, "CC(O)OC"), "{:?}", hem);
        let cbn = run("carbinolamine_formation", &["CC=O", "CN"]);
        assert!(cbn.len() == 1 && has(&cbn, "CC(O)NC"), "{:?}", cbn);
        let imine = run("imine_formation", &["CC(O)NC"]);
        assert!(imine.len() == 2 && has(&imine, "CC=NC") && has(&imine, "O"), "{:?}", imine);
        // a ketone is no acid derivative, an ester / acid chloride / amide are
        let t = find("carbonyl_hydration");
        assert!(!t.slot_matches(0, &mol("CC(C)=O")).is_empty());
        for no in ["CC(=O)OC", "CC(=O)Cl", "CC(=O)N", "CC(=O)O", "O=C=O"] {
            assert!(t.slot_matches(0, &mol(no)).is_empty(), "{} is no ketone / aldehyde", no);
        }
        // aldol addition and dehydration
        let ald = run("aldol_addition", &["CC=O", "CC=O"]);
        assert!(ald.len() == 1 && has(&ald, "CC(O)CC=O"), "{:?}", ald);
        let enone = run("aldol_dehydration", &["CC(O)CC=O"]);
        // the pattern anchors on the carbonyl carbon: 3-hydroxybutanal gives but-2-enal + water
        assert!(enone.len() == 2 && has(&enone, "CC=CC=O") && has(&enone, "O"), "{:?}", enone);
        // electrophilic aromatic substitution: the hydrogen leaves as a proton, the halogen pair splits, nitrate gives hydroxide
        let br = run("eas_halogenation", &["c1ccccc1O", "BrBr"]);
        assert!(br.len() == 3 && has(&br, "[Br-]") && has(&br, "[H+]") && (has(&br, "Oc1ccccc1Br") || has(&br, "Oc1ccc(Br)cc1") || has(&br, "Oc1cccc(Br)c1")), "{:?}", br);
        let nit = run("eas_nitration", &["c1ccccc1", "[O-][N+](=O)[O-]"]);
        assert!(nit.len() == 2 && has(&nit, "O=[N+]([O-])c1ccccc1") && has(&nit, "[OH-]"), "{:?}", nit);
        // acyl halide and anhydride
        let acl = run("acyl_halide_substitution", &["CC(=O)Cl", "O"]);
        assert!(acl.len() == 3 && has(&acl, "CC(=O)O") && has(&acl, "[Cl-]") && has(&acl, "[H+]"), "{:?}", acl);
        let est = run("acyl_halide_substitution", &["CC(=O)Cl", "CCO"]);
        assert!(has(&est, "CC(=O)OCC"), "{:?}", est);
        let amd = run("acyl_halide_substitution", &["CC(=O)Cl", "N"]);
        assert!(has(&amd, "CC(N)=O"), "{:?}", amd);
        let anh = run("anhydride_substitution", &["CC(=O)OC(C)=O", "O"]);
        assert!(anh.len() == 2 && anh.iter().all(|p| mol(p).is_isomorphic(&mol("CC(=O)O"))), "{:?}", anh);
    }

    #[test]
    fn hammett_relation_sets_the_ring_rates() {
        let rate = |arene: &str, atom_h: usize| -> f64 {
            // the `atom_h`-th aromatic CH of the arene as the attacked position
            let t = find("eas_halogenation");
            let m = mol(arene);
            let maps = t.slot_matches(0, &m);
            let br = mol("BrBr");
            let bm = t.slot_matches(1, &br);
            let inst = Instance { template: t, mols: vec![&m, &br], maps: vec![&maps[atom_h], &bm[0]] };
            let r = t.rates(&inst, "water");
            assert!(!r.is_empty(), "{} must be assessable", arene);
            r[0].a * (-r[0].ea_j.unwrap() / (8.314462618 * 298.15)).exp()
        };
        // benzene: all six positions alike; phenol: para (index follows atom order c1ccc(O)cc1 -> CH at 0,1,3,4... ) vs meta
        let benzene = rate("c1ccccc1", 0);
        let toluene_para = {
            let t = find("eas_halogenation");
            let m = mol("Cc1ccccc1");
            let maps = t.slot_matches(0, &m);
            // the CH farthest from the methyl carbon (index 1) is the para one: atom 4
            let k = maps.iter().position(|mp| mp[0] == 4).unwrap();
            let br = mol("BrBr");
            let bm = t.slot_matches(1, &br);
            let r = t.rates(&Instance { template: t, mols: vec![&m, &br], maps: vec![&maps[k], &bm[0]] }, "water");
            r[0].a * (-r[0].ea_j.unwrap() / (8.314462618 * 298.15)).exp()
        };
        // sigma+ para of methyl -0.31, rho -12.1: partial rate factor 10^3.75 = 5.6e3 (Br2 / HOAc: toluene p 2.4e3)
        let f = toluene_para / benzene;
        assert!(f > 1.0e3 && f < 2.0e4, "toluene para partial rate factor {}", f);
        // nitrobenzene is deactivated: meta position (sigma_m 0.71) far slower than benzene
        let nb = mol("c1ccccc1[N+](=O)[O-]");
        let t = find("eas_halogenation");
        let maps = t.slot_matches(0, &nb);
        let meta = maps.iter().find(|mp| mp[0] == 2).unwrap();
        let br = mol("BrBr");
        let bm = t.slot_matches(1, &br);
        let r = t.rates(&Instance { template: t, mols: vec![&nb, &br], maps: vec![meta, &bm[0]] }, "water");
        let k_meta = r[0].a * (-r[0].ea_j.unwrap() / (8.314462618 * 298.15)).exp();
        assert!(k_meta / benzene < 1.0e-6, "nitrobenzene meta {:e}", k_meta / benzene);
        // a five-membered heteroaromatic ring has no constants: no rate is proposed
        let fur = mol("c1ccoc1");
        let maps = t.slot_matches(0, &fur);
        assert!(!maps.is_empty());
        assert!(t.rates(&Instance { template: t, mols: vec![&fur, &br], maps: vec![&maps[0], &bm[0]] }, "water").is_empty());
    }

    #[test]
    fn slots_forbid_what_the_template_excludes() {
        let t = find("keto_enol_tautomerism");
        assert!(!t.slot_matches(0, &mol("CC(C)=O")).is_empty());
        assert!(t.slot_matches(0, &mol("CC(=O)OCC")).is_empty(), "an ester has no ketone enol");
        assert!(t.slot_matches(0, &mol("CC(=O)O")).is_empty(), "nor an acid");
        let sn2 = find("sn2_substitution");
        assert!(sn2.slot_matches(1, &mol("[O-]S(=O)(=O)[O-]")).is_empty(), "sulfate is not a carbon-bound nucleophile");
        assert!(!sn2.slot_matches(1, &mol("[OH-]")).is_empty());
        assert!(sn2.slot_matches(1, &mol("CC(=O)O")).is_empty(), "a neutral molecule is not an anion");
    }

    fn rate_of(id: &str, reactants: &[&str], solvent: &str) -> Vec<Rate> {
        let t = find(id);
        let mols: Vec<Molecule> = reactants.iter().map(|s| mol(s)).collect();
        let maps: Vec<Vec<Vec<usize>>> = mols.iter().enumerate().map(|(i, m)| t.slot_matches(i, m)).collect();
        let inst = Instance { template: t, mols: mols.iter().collect(), maps: maps.iter().map(|m| &m[0]).collect() };
        t.rates(&inst, solvent)
    }

    #[test]
    fn rate_rules_follow_structure() {
        let a = |smi: &str, nuc: &str| rate_of("sn2_substitution", &[smi, nuc], "water")[0].a;
        // methyl 30 : primary 1 : secondary 0.025 : tertiary 1e-5
        let (me, pri, sec, ter) = (a("CBr", "[OH-]"), a("CCBr", "[OH-]"), a("CC(C)Br", "[OH-]"), a("CC(C)(C)Br", "[OH-]"));
        assert!((me / pri - 30.0).abs() < 1e-9 && (sec / pri - 0.025).abs() < 1e-9 && (ter / pri - 1e-5).abs() < 1e-12);
        // neopentyl: two branches on the beta carbon
        assert!((a("CC(C)(C)CBr", "[OH-]") / pri - 0.0016).abs() < 1e-9);
        // isobutyl: one branch
        assert!((a("CC(C)CBr", "[OH-]") / pri - 0.04).abs() < 1e-9);
        // nucleophiles by Swain-Scott n
        assert!((a("CCBr", "[S-]C") / pri - 7.9433).abs() < 1e-3);
        assert!((a("CCBr", "CC(=O)[O-]") / pri - 0.031623).abs() < 1e-5);
        // aprotic solvent
        assert!((rate_of("sn2_substitution", &["CCBr", "[OH-]"], "other")[0].a / pri - 1000.0).abs() < 1e-6);
        // the most specific rule wins: a tertiary halide in water has its own SN1 rule, a primary one has none
        assert!(rate_of("sn1_solvolysis", &["CCBr", "O"], "water").is_empty());
        assert!(!rate_of("sn1_solvolysis", &["CC(C)(C)Br", "O"], "water").is_empty());
        // hydration by carbocation class (OH on the carbon that is tertiary / secondary): Markovnikov
        let t = find("alkene_hydration");
        let m = mol("CC(C)=C");
        let w = mol("O");
        let maps = t.slot_matches(0, &m);
        let wm = t.slot_matches(1, &w);
        let ea: Vec<f64> = maps.iter().map(|mp| t.rates(&Instance { template: t, mols: vec![&m, &w], maps: vec![mp, &wm[0]] }, "water")[0].ea_j.unwrap()).collect();
        assert!(ea.iter().cloned().fold(f64::MAX, f64::min) < ea.iter().cloned().fold(f64::MIN, f64::max), "two orientations, different barriers");
    }

    #[test]
    fn evans_polanyi_rules_wait_for_the_reaction_enthalpy() {
        let r = Rule { id: "x".into(), when: vec![], a: None, ea_j: None, ep: Some((50_000.0, 0.5, 1e10)), source: String::new() };
        let t = Template {
            id: "synthetic".into(),
            name: String::new(),
            category: String::new(),
            slots: vec![Slot { role: "r".into(), patterns: vec![smarts::parse("[CX4]").unwrap()], forbid: vec![], net_charge_max: None, net_charge_min: None }],
            edits: vec![],
            extra_products: vec![],
            degeneracy: None,
            variants: vec![Variant { tag: String::new(), catalysts: vec![], rules: vec![r], modifiers: vec![] }],
            redox: None,
        };
        let m = mol("C");
        let maps = t.slot_matches(0, &m);
        let rate = &t.rates(&Instance { template: &t, mols: vec![&m], maps: vec![&maps[0]] }, "water")[0];
        assert!(rate.ea_j.is_none());
        assert_eq!(rate.ep, Some((50_000.0, 0.5)));
        assert_eq!(rate.a, 1e10);
    }
}
