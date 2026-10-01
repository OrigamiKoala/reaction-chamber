//! Data-driven solubility: a generated table of solubility products (engine/data/solubility.json, built by
//! pipeline/build_solubility_table.py from pipeline/data/*.csv) plus general solubility rules for ion pairs the
//! table does not list. Any cation/anion pair that meets in a vessel is looked up here, so precipitation is not
//! tied to hand-written per-compound entries.

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::chem_db::{GeneralEquilibrium, GeneralMineral};
use crate::ions;
use crate::types::ProvenanceTier;

#[derive(Deserialize)]
struct SolubilityData {
    minerals: Vec<GeneralMineral>,
    equilibria: Vec<GeneralEquilibrium>,
}

static DATA: OnceLock<SolubilityData> = OnceLock::new();

fn data() -> &'static SolubilityData {
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../data/solubility.json"))
            .expect("engine/data/solubility.json is valid (regenerate with pipeline/build_solubility_table.py)")
    })
}

/// All tabulated sparingly-soluble / saturation-limited solids.
pub fn table_minerals() -> &'static [GeneralMineral] {
    &data().minerals
}

/// Tabulated acid/base and speciation equilibria for ions the core catalog does not cover.
pub fn table_equilibria() -> &'static [GeneralEquilibrium] {
    &data().equilibria
}

fn ion_key(ions: &HashMap<String, f64>) -> String {
    let mut v: Vec<String> = ions.iter().map(|(k, n)| format!("{}:{}", k, *n as i64)).collect();
    v.sort();
    v.join("|")
}

/// Tabulated mineral whose dissolved ions are exactly `ions`.
pub fn table_mineral_for(ions: &HashMap<String, f64>) -> Option<GeneralMineral> {
    let key = ion_key(ions);
    table_minerals().iter().find(|m| ion_key(&m.dissolved_products) == key).cloned()
}

fn gcd(a: i32, b: i32) -> i32 {
    if b == 0 {
        a.abs().max(1)
    } else {
        gcd(b, a % b)
    }
}

fn formula_part(base: &str, n: i32) -> String {
    let elems = ions::parse_formula_strict(base).map(|e| e.len()).unwrap_or(1);
    let atoms: f64 = ions::parse_formula_strict(base).map(|e| e.values().sum()).unwrap_or(1.0);
    let wrap = elems > 1 || atoms > 1.0;
    match (n, wrap) {
        (1, _) => base.to_string(),
        (n, true) => format!("({}){}", base, n),
        (n, false) => format!("{}{}", base, n),
    }
}

fn anion_formula(id: &str) -> String {
    ions::anion_def(id).map(|a| a.formula.to_string()).unwrap_or_else(|| ions::split_charge(id).0.to_string())
}

/// Formula of the neutral solid formed from `n_c` cations and `n_a` anions, e.g. ("Pb+2",1,"NO3-",2) -> "Pb(NO3)2".
pub fn solid_formula(cation: &str, n_c: i32, anion: &str, n_a: i32) -> String {
    format!("{}{}", formula_part(ions::split_charge(cation).0, n_c), formula_part(&anion_formula(anion), n_a))
}

/// True when general solubility rules (not the table) say the pair forms an insoluble solid.
pub fn insoluble_by_rules(cation: &str, anion: &str) -> bool {
    // Alkali metals, ammonium and the proton give soluble salts with everything we model.
    if matches!(cation, "Li+" | "Na+" | "K+" | "Rb+" | "Cs+" | "NH4+" | "H+" | "H3O+") {
        return false;
    }
    let group2 = matches!(cation, "Mg+2" | "Ca+2" | "Sr+2" | "Ba+2" | "Ra+2");
    let transition_or_p = !group2;
    match anion {
        // Always soluble families
        "NO3-" | "CH3COO-" | "HCOO-" | "ClO3-" | "ClO4-" | "ClO-" | "ClO2-" | "MnO4-" | "NO2-" | "HCO3-" | "HSO4-"
        | "H2PO4-" | "HS-" | "HSO3-" | "HCrO4-" | "HC2O4-" | "IO4-" | "N3-" => false,
        "Cl-" | "Br-" | "I-" | "SCN-" | "CN-" | "BrO3-" => matches!(cation, "Ag+" | "Pb+2" | "Hg2+2" | "Cu+" | "Tl+" | "Au+" | "Hg+2"),
        "F-" => group2 || matches!(cation, "Pb+2" | "Cu+2" | "Zn+2") || cation.ends_with("+3"),
        "SO4-2" => matches!(cation, "Ba+2" | "Sr+2" | "Pb+2" | "Ra+2" | "Hg2+2" | "Ca+2" | "Ag+"),
        "S2O3-2" | "Cr2O7-2" | "S2O8-2" | "SeO4-2" => matches!(cation, "Ag+" | "Pb+2" | "Hg2+2" | "Tl+"),
        "OH-" => !matches!(cation, "Ba+2" | "Sr+2" | "Ra+2"),
        "S-2" => !group2,
        "CrO4-2" | "MoO4-2" | "WO4-2" => !matches!(cation, "Mg+2" | "Ca+2"),
        "CO3-2" | "PO4-3" | "HPO4-2" | "C2O4-2" | "SO3-2" | "SiO3-2" | "IO3-" | "AsO4-3" | "B4O7-2" | "C6H5O7-3" => true,
        "Fe(CN)6-4" | "Fe(CN)6-3" => transition_or_p,
        _ => false,
    }
}

fn charges(cation: &str, anion: &str) -> (i32, i32) {
    (ions::species_charge(cation), -ions::species_charge(anion))
}

/// Builds a mineral for the pair with the supplied Ksp (log10) and generic appearance.
fn make_mineral(cation: &str, anion: &str, log_ksp: f64, tier: ProvenanceTier, source: &str) -> Option<GeneralMineral> {
    let (zc, za) = charges(cation, anion);
    if zc <= 0 || za <= 0 {
        return None;
    }
    let g = gcd(zc, za);
    let (n_c, n_a) = (za / g, zc / g);
    let formula = solid_formula(cation, n_c, anion, n_a);
    let hue = ions::anion_solid_tint(anion).unwrap_or_else(|| ions::cation_solid_hue(cation));
    let kind = if anion == "OH-" {
        "gel"
    } else if matches!(anion, "Cl-" | "Br-" | "I-") {
        "curds"
    } else {
        "powder"
    };
    let mut dissolved = HashMap::new();
    dissolved.insert(cation.to_string(), n_c as f64);
    dissolved.insert(anion.to_string(), n_a as f64);
    // Density from molar mass with a typical ionic-solid packing density when nothing better is known.
    let density = ions::species_mass(&formula).map(|m| (m / 38.0).clamp(1.5, 8.0)).unwrap_or(3.0);
    Some(GeneralMineral {
        id: format!("{}_auto", formula),
        mineral: formula.clone(),
        formula: formula.clone(),
        solid_species: format!("{}(s)", formula),
        dissolved_products: dissolved,
        log_ksp_298: log_ksp,
        delta_h_kj: 0.0,
        solid_color: hue,
        density_g_ml: density,
        default_particle_um: if kind == "curds" { 2.0 } else if kind == "gel" { 5.0 } else { 10.0 },
        kind: kind.to_string(),
        tier,
        source: source.to_string(),
    })
}

/// Mineral controlling a cation/anion pair: the tabulated Ksp if present, otherwise a rule-based estimate when the
/// solubility rules call the pair insoluble, otherwise None (the pair stays dissolved).
pub fn mineral_for_pair(cation: &str, anion: &str) -> Option<GeneralMineral> {
    let (zc, za) = charges(cation, anion);
    if zc <= 0 || za <= 0 {
        return None;
    }
    let g = gcd(zc, za);
    let mut ions_map = HashMap::new();
    ions_map.insert(cation.to_string(), (za / g) as f64);
    ions_map.insert(anion.to_string(), (zc / g) as f64);
    if let Some(m) = table_mineral_for(&ions_map) {
        return Some(m);
    }
    if !insoluble_by_rules(cation, anion) {
        return None;
    }
    let log_ksp = -(4.0 + 2.0 * (zc * za) as f64);
    make_mineral(cation, anion, log_ksp, ProvenanceTier::Speculative, "General solubility rules (order-of-magnitude estimate)")
}

/// Mineral describing the *solid form of a soluble salt* (its saturation limit). Table value if listed, else a
/// default saturation of ~3 mol/L of formula units.
pub fn saturation_mineral(cation: &str, n_c: f64, anion: &str, n_a: f64) -> Option<GeneralMineral> {
    let mut ions_map = HashMap::new();
    ions_map.insert(cation.to_string(), n_c);
    ions_map.insert(anion.to_string(), n_a);
    if let Some(m) = table_mineral_for(&ions_map) {
        return Some(m);
    }
    let s: f64 = 3.0;
    let log_ksp = n_c * (n_c * s).log10() + n_a * (n_a * s).log10();
    let tier = ProvenanceTier::Estimated;
    let mut m = make_mineral(cation, anion, log_ksp, tier, "Solubility cap estimate (3 mol/L)")?;
    // make_mineral derives stoichiometry from charges; honour the formula's own ratio when it differs (e.g. Hg2+2)
    m.dissolved_products.insert(cation.to_string(), n_c);
    m.dissolved_products.insert(anion.to_string(), n_a);
    m.kind = "crystal".to_string();
    m.default_particle_um = 40.0;
    Some(m)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_loads_and_is_balanced() {
        assert!(table_minerals().len() > 100);
        for m in table_minerals() {
            let mut charge = 0.0;
            for (ion, n) in &m.dissolved_products {
                charge += ions::species_charge(ion) as f64 * n;
            }
            assert!(charge.abs() < 1e-9, "{} not charge balanced", m.formula);
        }
        assert!(table_mineral_for(&[("Ag+".to_string(), 1.0), ("I-".to_string(), 1.0)].into()).is_some());
    }

    #[test]
    fn rules_cover_unlisted_pairs() {
        // CdS-like pair not in the table: Sn+2 + CO3-2 -> insoluble by rule
        let m = mineral_for_pair("Sn+2", "CO3-2").expect("rule-based mineral");
        assert_eq!(m.solid_species, "SnCO3(s)");
        assert!(mineral_for_pair("Rb+", "Cl-").is_none());
        assert!(mineral_for_pair("Rb+", "NO3-").is_none());
        assert_eq!(solid_formula("Pb+2", 1, "NO3-", 2), "Pb(NO3)2");
        assert_eq!(solid_formula("Ca+2", 3, "PO4-3", 2), "Ca3(PO4)2");
        assert_eq!(solid_formula("NH4+", 2, "SO4-2", 1), "(NH4)2SO4");
    }
}
