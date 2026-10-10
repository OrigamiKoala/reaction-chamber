//! 3D coordinates of a species for the molecular viewer (docs/plans/reaction-viewer-plan.md, sections 4.1 and 4.2).
//!
//! A species gets a structure from, in this order: the SMILES the caller passes (a vessel's import), the store record's
//! SMILES, the SMILES of another store record with the same InChIKey, a row of `data/structure_smiles.json` (structures read
//! from PubChem for ions the formula rule would draw wrongly), the formula rule (`formula.rs`, labelled `formula-rule`), and
//! last a placeholder sphere. The embedding (`embed.rs`) is a home-made distance geometry + force field on ideal bond
//! lengths (Pyykko covalent radii by bond order, `data/covalent_radii.json`) and VSEPR / ring angles (`geometry.rs`), with
//! explicit hydrogens. Atom order: the graph's atoms in order (the SMILES atoms, so a reaction template's atom map applies),
//! then the hydrogens of each of them in that order. Stereochemistry is ignored. Results are cached per species id and
//! store generation; nothing here runs in the 20 Hz loop.

pub mod data;
mod embed;
mod formula;
mod geometry;
mod graph;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

use serde::Serialize;

pub use embed::Quality;
pub use graph::{BuildGraph, GBond};

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Atom3d {
    pub el: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// Formal charge (metals: the oxidation state in the ionic picture of the formula rule).
    pub charge: i32,
    /// Oxidation state of a metal atom when known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ox: Option<i32>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Bond3d {
    pub a: usize,
    pub b: usize,
    pub order: f64,
    pub aromatic: bool,
    /// Dative / ionic bond to a metal centre.
    pub coordinate: bool,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Structure3d {
    pub species: String,
    pub formula: String,
    pub charge: i32,
    /// "smiles" | "structure_data" | "formula-rule" | "atom" | "placeholder"
    pub source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_detail: Option<String>,
    /// The first `n_heavy` atoms are the graph's atoms in its order; the hydrogens follow.
    pub n_heavy: usize,
    /// Radius of a single-sphere structure (monatomic ion: Shannon radius; placeholder: from the molar mass), A.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radius_a: Option<f64>,
    pub atoms: Vec<Atom3d>,
    pub bonds: Vec<Bond3d>,
}

fn to_structure(g: &BuildGraph) -> (Vec<Atom3d>, Vec<Bond3d>, usize) {
    let (t, x) = embed::embed(g);
    let atoms = (0..t.n())
        .map(|i| Atom3d { el: t.g.el[i].clone(), x: x[i][0], y: x[i][1], z: x[i][2], charge: t.g.charge[i], ox: if t.metal[i] { t.g.ox[i] } else { None } })
        .collect();
    let bonds = t.g.bonds.iter().map(|b| Bond3d { a: b.a, b: b.b, order: b.order, aromatic: b.aromatic, coordinate: b.coordinate }).collect();
    (atoms, bonds, t.n_skel)
}

fn finish(species: &str, formula: &str, charge: i32, source: &str, detail: Option<String>, g: &BuildGraph) -> Structure3d {
    let (atoms, bonds, n_heavy) = to_structure(g);
    let radius_a = if atoms.len() == 1 {
        let a = &atoms[0];
        let ion = match a.charge {
            0 => None,
            q if q > 0 => Some(crate::ions::cation_id(&a.el, q)),
            -1 => Some(format!("{}-", a.el)),
            q => Some(format!("{}-{}", a.el, -q)),
        };
        Some(ion.and_then(|id| crate::crystal::ionic_radius_angstrom(&id)).unwrap_or_else(|| data::vdw_radius(&a.el)))
    } else {
        None
    };
    let source = if atoms.len() == 1 && source == "formula-rule" { "atom" } else { source };
    Structure3d { species: species.to_string(), formula: formula.to_string(), charge, source: source.to_string(), source_detail: detail, n_heavy, radius_a, atoms, bonds }
}

/// The structure of a SMILES string.
pub fn from_smiles(smi: &str) -> Option<Structure3d> {
    let g = BuildGraph::from_smiles(smi)?;
    let q = g.total_charge();
    Some(finish(smi, smi, q, "smiles", None, &g))
}

/// The structure the formula rule gives a formula body (no phase tag) and charge.
pub fn from_formula(body: &str, charge: i32) -> Option<Structure3d> {
    let g = formula::build(body, charge)?;
    Some(finish(body, body, charge, "formula-rule", None, &g))
}

fn strip_phase(id: &str) -> &str {
    let mut s = id.trim();
    for tag in ["(aq)", "(s)", "(l)", "(g)", "(cr)"] {
        s = s.trim_end_matches(tag);
    }
    s
}

/// Formula body (no charge, phase or isomer tag) and charge of a species: the store record's when there is one, else read
/// from the id.
fn formula_and_charge(id: &str, rec_formula: Option<&str>, rec_charge: Option<i32>) -> (String, i32) {
    let src = rec_formula.filter(|f| !f.is_empty()).unwrap_or(id);
    let s = strip_phase(src);
    let s = s.split('#').next().unwrap_or(s);
    let (body, q) = crate::ions::split_charge(s);
    (body.to_string(), rec_charge.unwrap_or(q))
}

/// Element counts of a formula body, waters of hydration included.
pub fn composition(body: &str) -> Option<HashMap<String, f64>> {
    let (base, nw) = crate::ions::strip_hydrate(body);
    let mut e = crate::ions::parse_formula_strict(&base)?;
    if nw > 0.0 {
        *e.entry("H".to_string()).or_insert(0.0) += 2.0 * nw;
        *e.entry("O".to_string()).or_insert(0.0) += nw;
    }
    Some(e)
}

fn placeholder(id: &str, formula: &str, charge: i32) -> Structure3d {
    let m = crate::ions::species_mass(id).or_else(|| crate::ions::species_mass(formula)).unwrap_or(200.0);
    Structure3d {
        species: id.to_string(),
        formula: formula.to_string(),
        charge,
        source: "placeholder".into(),
        source_detail: Some("no structure and no formula the rule can read".into()),
        n_heavy: 1,
        radius_a: Some(0.5 * m.cbrt()),
        atoms: vec![Atom3d { el: "X".into(), x: 0.0, y: 0.0, z: 0.0, charge, ox: None }],
        bonds: vec![],
    }
}

/// Builds the structure of a species (uncached; see `for_species`).
pub fn build_for_species(id: &str, smiles_hint: Option<&str>) -> Structure3d {
    let (rec_formula, rec_charge, inchikey, rec_smiles, sibling_smiles) = {
        let store = crate::db::SpeciesStore::global();
        let guard = store.read().ok();
        match guard.as_ref().and_then(|st| st.get(id).map(|r| (r.clone(), st.all_by_inchikey(r.identity.inchikey.as_deref().unwrap_or("")).iter().find_map(|o| o.identity.smiles.clone())))) {
            Some((r, sib)) => (Some(r.identity.formula.clone()), Some(r.identity.charge), r.identity.inchikey.clone(), r.identity.smiles.clone(), sib),
            None => (None, None, None, None, None),
        }
    };
    let (body, q) = formula_and_charge(id, rec_formula.as_deref(), rec_charge);
    let elems = crate::ions::parse_formula_strict(&crate::ions::strip_hydrate(&body).0);
    let full = composition(&body);
    for smi in [smiles_hint.map(str::to_string), rec_smiles, sibling_smiles].into_iter().flatten() {
        // a SMILES that contradicts the record's own formula (a seed `[S-]` for HS-) is not used
        if let Some(g) = BuildGraph::from_smiles(&smi).filter(|g| full.as_ref().map_or(true, |f| g.has_composition(f))) {
            return finish(id, &body, q, "smiles", Some(smi), &g);
        }
    }
    if let Some(row) = data::structure_row(elems.as_ref(), q, inchikey.as_deref()) {
        if crate::ions::strip_hydrate(&body).1 == 0.0 {
            if let Some(g) = BuildGraph::from_smiles(&row.smiles) {
                return finish(id, &body, q, "structure_data", Some(row.source.clone()), &g);
            }
        }
    }
    match formula::build(&body, q) {
        Some(g) => finish(id, &body, q, "formula-rule", None, &g),
        None => placeholder(id, &body, q),
    }
}

/// The structure of a species, cached per id (and SMILES hint) and species-store generation.
pub fn for_species(id: &str, smiles_hint: Option<&str>) -> Arc<Structure3d> {
    static CACHE: OnceLock<Mutex<HashMap<String, (u64, Arc<Structure3d>)>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let key = format!("{}|{}", id, smiles_hint.unwrap_or(""));
    let generation = crate::db::SpeciesStore::generation();
    if let Some((g, s)) = cache.lock().unwrap().get(&key) {
        if *g == generation {
            return s.clone();
        }
    }
    let s = Arc::new(build_for_species(id, smiles_hint));
    let mut c = cache.lock().unwrap();
    if c.len() > 4000 {
        c.clear();
    }
    c.insert(key, (generation, s.clone()));
    s
}

fn topo_of(s: &Structure3d) -> geometry::Topo {
    let mut g = BuildGraph::default();
    for a in &s.atoms {
        let k = g.add_atom(&a.el, a.charge);
        g.ox[k] = a.ox;
    }
    for b in &s.bonds {
        g.bonds.push(GBond { a: b.a, b: b.b, order: b.order, aromatic: b.aromatic, coordinate: b.coordinate });
    }
    geometry::Topo::from_explicit(g, s.n_heavy)
}

/// The ideal angles of a structure, (atom a, centre, atom b, radians): VSEPR with lone-pair compression, ring angles of
/// rings up to six atoms, coordination polyhedra of metals. What the embedding aims for.
pub fn angle_targets(s: &Structure3d) -> Vec<(usize, usize, usize, f64)> {
    topo_of(s).angles
}

/// Ideal length of each bond of a structure (sum of the covalent radii of its order), A.
pub fn bond_targets(s: &Structure3d) -> Vec<f64> {
    topo_of(s).r0
}
