//! Element geometry data (`data/covalent_radii.json`) and the structure exceptions (`data/structure_smiles.json`).

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

#[derive(Deserialize, Clone, Debug)]
pub struct ElementRow {
    pub z: u32,
    pub r1: f64,
    pub r2: Option<f64>,
    pub r3: Option<f64>,
    pub vdw: Option<f64>,
    pub en: Option<f64>,
    pub group: Option<u32>,
    pub jmol: Option<String>,
}

#[derive(Deserialize)]
struct RadiiFile {
    elements: HashMap<String, ElementRow>,
}

fn table() -> &'static HashMap<String, ElementRow> {
    static T: OnceLock<HashMap<String, ElementRow>> = OnceLock::new();
    T.get_or_init(|| serde_json::from_str::<RadiiFile>(include_str!("../../data/covalent_radii.json")).expect("data/covalent_radii.json").elements)
}

pub fn element(el: &str) -> Option<&'static ElementRow> {
    table().get(el)
}

pub fn is_metal(el: &str) -> bool {
    crate::compound_thermo::is_metal_element(el) && element(el).is_some()
}

/// Covalent radius for a bond of this order (1, 2, 3; 1.5 = aromatic, the mean of the single and double radii). A missing
/// multiple-bond radius falls back to the next lower order; an unknown element to 1.5 A.
pub fn covalent_radius(el: &str, order: f64) -> f64 {
    let Some(r) = element(el) else { return 1.5 };
    let r2 = r.r2.unwrap_or(r.r1);
    let r3 = r.r3.unwrap_or(r2);
    if order >= 2.5 {
        r3
    } else if order >= 1.75 {
        r2
    } else if order > 1.25 {
        0.5 * (r.r1 + r2)
    } else {
        r.r1
    }
}

/// Ideal length of a bond between `a` and `b`: the sum of the covalent radii of that order.
pub fn bond_length(a: &str, b: &str, order: f64) -> f64 {
    covalent_radius(a, order) + covalent_radius(b, order)
}

/// Van der Waals radius (Bondi, else Alvarez); 2.0 A when the table has none.
pub fn vdw_radius(el: &str) -> f64 {
    element(el).and_then(|r| r.vdw).unwrap_or(2.0)
}

/// Pauling electronegativity; elements without one get 1.2 (metals) or 2.5.
pub fn electronegativity(el: &str) -> f64 {
    element(el).and_then(|r| r.en).unwrap_or(if is_metal(el) { 1.2 } else { 2.5 })
}

pub fn group(el: &str) -> Option<u32> {
    element(el).and_then(|r| r.group)
}

/// Valence electrons of a main-group element (groups 1, 2, 13-18; hydrogen 1); None for the d and f blocks.
pub fn valence_electrons(el: &str) -> Option<i32> {
    match group(el)? {
        g @ 1..=2 => Some(g as i32),
        g @ 13..=18 => Some(g as i32 - 10),
        _ => None,
    }
}

/// Standard covalent valences of a non-metal, lowest first (the hypervalent ones of the heavier p-block elements included).
pub fn valences(el: &str) -> Vec<i32> {
    let Some(g) = group(el) else { return vec![] };
    let period2 = element(el).map_or(false, |r| r.z <= 10);
    match g {
        1 => vec![1],
        13 => vec![3],
        14 => vec![4],
        15 => vec![3, 5],
        16 if period2 => vec![2],
        16 => vec![2, 4, 6],
        17 if period2 => vec![1],
        17 => vec![1, 3, 5, 7],
        18 => vec![0, 2, 4, 6, 8],
        _ => vec![],
    }
}

#[derive(Deserialize, Clone, Debug)]
pub struct SmilesRow {
    pub formula: String,
    pub charge: i32,
    pub smiles: String,
    pub cid: Option<u64>,
    pub inchikey: Option<String>,
    pub source: String,
}

#[derive(Deserialize)]
struct SmilesFile {
    rows: Vec<SmilesRow>,
}

fn smiles_rows() -> &'static Vec<(String, SmilesRow)> {
    static T: OnceLock<Vec<(String, SmilesRow)>> = OnceLock::new();
    T.get_or_init(|| {
        let f: SmilesFile = serde_json::from_str(include_str!("../../data/structure_smiles.json")).expect("data/structure_smiles.json");
        f.rows
            .into_iter()
            .filter_map(|r| crate::ions::parse_formula_strict(&r.formula).map(|e| (crate::ions::element_key(&e), r)))
            .collect()
    })
}

/// The structure row of an element composition + charge, or of an InChIKey.
pub fn structure_row(elems: Option<&HashMap<String, f64>>, charge: i32, inchikey: Option<&str>) -> Option<&'static SmilesRow> {
    if let Some(ik) = inchikey {
        if let Some((_, r)) = smiles_rows().iter().find(|(_, r)| r.inchikey.as_deref() == Some(ik)) {
            return Some(r);
        }
    }
    let key = crate::ions::element_key(elems?);
    smiles_rows().iter().find(|(k, r)| *k == key && r.charge == charge).map(|(_, r)| r)
}
