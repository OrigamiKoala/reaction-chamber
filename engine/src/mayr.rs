//! Mayr reactivity scale (`data/mayr_parameters.json`): log10 k(20 C) = sN (N + E) (Mayr & Patz 1994).
//!
//! Provides closed-form rate constants for nucleophile-electophile combinations evaluated in microseconds.
//! Molecules are indexed by their heavy-atom Weisfeiler-Lehman graph hash (`rate_store::molecule_hash`),
//! matching by structure rather than chemical name.

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::rate_store;
use crate::smiles::{self, Molecule};

#[derive(Clone, Debug, Deserialize)]
pub struct MayrRow {
    pub name: String,
    pub is_nucleophile: bool,
    pub n: f64,
    pub s_n: f64,
    pub e: f64,
    #[serde(default)]
    pub smiles: Option<String>,
    #[serde(default)]
    pub solvent: String,
    #[serde(default)]
    pub quality_stars: u32,
    #[serde(default)]
    pub reference: String,
    #[serde(default)]
    pub doi: String,
    #[serde(default)]
    pub db_id: u32,
}

#[derive(Deserialize)]
struct MayrFile {
    parameters: Vec<MayrRow>,
}

#[derive(Deserialize)]
struct SolventsFile {
    solvents: HashMap<String, String>,
}

#[derive(Deserialize)]
struct TemplatesFile {
    templates: HashMap<String, TemplateSlotConfig>,
}

#[derive(Deserialize, Clone)]
pub struct TemplateSlotConfig {
    pub nucleophile_slot: usize,
    pub electrophile_slot: usize,
}

#[derive(Clone, Debug)]
pub struct MayrRate {
    pub k_20: f64,
    pub log10_k_20: f64,
    pub n: f64,
    pub s_n: f64,
    pub e: f64,
    pub nuc_db_id: u32,
    pub el_db_id: u32,
    pub source: String,
}

struct MayrIndex {
    /// Nucleophiles keyed by (molecule_hash, solvent_class) -> MayrRow
    nucleophiles: HashMap<(String, String), MayrRow>,
    /// Electrophiles keyed by molecule_hash -> MayrRow (E is solvent-independent)
    electrophiles: HashMap<String, MayrRow>,
    /// Solvent string -> solvent class
    _solvents: HashMap<String, String>,
    /// Template configuration
    templates: HashMap<String, TemplateSlotConfig>,
}

fn index() -> &'static MayrIndex {
    static INDEX: OnceLock<MayrIndex> = OnceLock::new();
    INDEX.get_or_init(|| {
        let file: MayrFile = serde_json::from_str(include_str!("../data/mayr_parameters.json"))
            .expect("mayr_parameters.json is valid");
        let solv_file: SolventsFile = serde_json::from_str(include_str!("../data/mayr_solvents.json"))
            .expect("mayr_solvents.json is valid");
        let tpl_file: TemplatesFile = serde_json::from_str(include_str!("../data/mayr_templates.json"))
            .expect("mayr_templates.json is valid");

        let solvents = solv_file.solvents;
        let mut nucleophiles: HashMap<(String, String), MayrRow> = HashMap::new();
        let mut electrophiles: HashMap<String, MayrRow> = HashMap::new();

        for row in file.parameters {
            if row.quality_stars < 1 {
                continue;
            }
            let Some(smiles_str) = &row.smiles else { continue };
            let Some(mol) = smiles::parse(smiles_str) else { continue };
            // the generator's molecules are aromaticity-perceived: the database's Kekule SMILES must be too
            let hash = rate_store::molecule_hash(&mol.perceived());

            if row.is_nucleophile {
                // N and sN are per solvent: a row is filed under its own solvent class only (rows that state no solvent are
                // class "any", usable in every class). There is no cross-solvent N.
                let solv_class = solvents.get(&row.solvent).map(|s| s.as_str()).unwrap_or("other");
                let key = (hash, solv_class.to_string());
                match nucleophiles.get(&key) {
                    Some(existing) if existing.quality_stars >= row.quality_stars => {}
                    _ => {
                        nucleophiles.insert(key, row);
                    }
                }
            } else {
                match electrophiles.get(&hash) {
                    Some(existing) if existing.quality_stars >= row.quality_stars => {}
                    _ => {
                        electrophiles.insert(hash, row);
                    }
                }
            }
        }

        MayrIndex {
            nucleophiles,
            electrophiles,
            _solvents: solvents,
            templates: tpl_file.templates,
        }
    })
}

/// Slot mapping for a template if it supports the Mayr scale.
pub fn template_config(template_id: &str) -> Option<TemplateSlotConfig> {
    index().templates.get(template_id).cloned()
}

/// Evaluates the Mayr rate constant at 20 C for a nucleophile and electrophile in a given solvent class.
/// Returns None if either partner is not tabulated, or if the resulting rate falls outside the
/// validated range (log k between -5 and 8, E between -25 and 10).
pub fn evaluate(nuc_mol: &Molecule, el_mol: &Molecule, solvent_class: &str) -> Option<MayrRate> {
    let idx = index();
    let nuc_hash = rate_store::molecule_hash(&nuc_mol.perceived());
    let el_hash = rate_store::molecule_hash(&el_mol.perceived());

    // Look up the nucleophile in the specified solvent class; rows without a stated solvent ("any") serve every class
    let nuc = idx
        .nucleophiles
        .get(&(nuc_hash.clone(), solvent_class.to_string()))
        .or_else(|| idx.nucleophiles.get(&(nuc_hash, "any".to_string())))?;

    // Look up electrophile (solvent-independent)
    let el = idx.electrophiles.get(&el_hash)?;

    // Validity range
    if el.e < -25.0 || el.e > 10.0 {
        return None;
    }

    let log_k = nuc.s_n * (nuc.n + el.e);
    if !(-5.0..=8.0).contains(&log_k) {
        return None;
    }

    let k_20 = 10.0_f64.powf(log_k);
    let source = format!(
        "Mayr relation: log10 k(20 C) = {:.2} (N = {:.2}, sN = {:.2} from Mayr #{}; E = {:.2} from Mayr #{})",
        log_k, nuc.n, nuc.s_n, nuc.db_id, el.e, el.db_id
    );

    Some(MayrRate {
        k_20,
        log10_k_20: log_k,
        n: nuc.n,
        s_n: nuc.s_n,
        e: el.e,
        nuc_db_id: nuc.db_id,
        el_db_id: el.db_id,
        source,
    })
}

#[derive(Deserialize, Clone, Debug)]
pub struct ModelCoefficients {
    pub weights: Vec<f64>,
    pub intercept: f64,
    pub held_out_rms: f64,
    pub enabled: bool,
}

#[derive(Deserialize, Clone, Debug)]
pub struct MayrPredictorFile {
    pub feature_names: Vec<String>,
    pub n_model: ModelCoefficients,
    pub sn_model: ModelCoefficients,
    pub e_model: ModelCoefficients,
}

fn predictor() -> Option<&'static MayrPredictorFile> {
    static PREDICTOR: OnceLock<Option<MayrPredictorFile>> = OnceLock::new();
    PREDICTOR.get_or_init(|| {
        serde_json::from_str(include_str!("../data/mayr_predictor.json")).ok()
    }).as_ref()
}

/// Computes molecular descriptors for Mayr parameter prediction.
pub fn featurize(mol: &Molecule) -> Vec<f64> {
    let charge: f64 = mol.atoms.iter().map(|a| a.charge as f64).sum();
    let n_heavy: f64 = mol.atoms.iter().filter(|a| a.element != "H").count() as f64;
    let n_rings: f64 = ((mol.bonds.len() as isize - mol.atoms.len() as isize + 1).max(0)) as f64;
    let n_mult_bonds: f64 = mol.bonds.iter().filter(|b| b.2 >= 2.0).count() as f64;
    let n_o: f64 = mol.atoms.iter().filter(|a| a.element == "O").count() as f64;
    let n_n: f64 = mol.atoms.iter().filter(|a| a.element == "N").count() as f64;
    let n_halogens: f64 = mol.atoms.iter().filter(|a| matches!(a.element.as_str(), "F" | "Cl" | "Br" | "I")).count() as f64;
    let n_aromatic: f64 = mol.atoms.iter().filter(|a| a.aromatic).count() as f64;

    vec![
        charge,
        n_heavy,
        n_rings,
        n_mult_bonds,
        n_o,
        n_n,
        n_halogens,
        n_aromatic,
    ]
}

/// Predicts (N, sN, 0) or (0, 0, E) parameters using the trained predictor (Precedence 4).
pub fn predict_parameters(mol: &Molecule, is_nucleophile: bool) -> Option<(f64, f64, f64)> {
    let p = predictor()?;
    let feats = featurize(mol);
    if is_nucleophile {
        if !p.n_model.enabled || !p.sn_model.enabled {
            return None;
        }
        let dot = |m: &ModelCoefficients| -> f64 {
            m.intercept + m.weights.iter().zip(&feats).map(|(w, x)| w * x).sum::<f64>()
        };
        let n = dot(&p.n_model);
        let sn = dot(&p.sn_model).clamp(0.2, 2.0);
        Some((n, sn, 0.0))
    } else {
        if !p.e_model.enabled {
            return None;
        }
        let e = p.e_model.intercept + p.e_model.weights.iter().zip(&feats).map(|(w, x)| w * x).sum::<f64>();
        Some((0.0, 0.0, e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn index_loads_parameters_and_finds_benzaldehyde() {
        // the way the generator writes it: no explicit hydrogen, aromatic
        let mol = smiles::parse("O=Cc1ccccc1").expect("benzaldehyde parses").perceived();
        let hash = rate_store::molecule_hash(&mol.perceived());
        let idx = index();
        let el = idx.electrophiles.get(&hash).expect("benzaldehyde in electrophiles");
        assert!((el.e - (-12.9)).abs() < 0.1, "E = {}", el.e);
    }

    #[test]
    fn a_predictor_is_on_only_when_its_held_out_error_is_a_usable_rate_estimate() {
        let p = predictor().expect("mayr_predictor.json");
        for (name, m, max) in [("N", &p.n_model, 1.5), ("sN", &p.sn_model, 0.15), ("E", &p.e_model, 1.5)] {
            assert!(!m.enabled || m.held_out_rms <= max, "{name} is enabled with a held-out rms of {}", m.held_out_rms);
        }
        let water = smiles::parse("O").unwrap();
        if !(p.n_model.enabled && p.sn_model.enabled) {
            assert!(predict_parameters(&water, true).is_none());
        }
    }

    #[test]
    fn the_relation_is_sn_times_n_plus_e_and_there_is_no_cross_solvent_n() {
        // benzylidenemalononitrile (E = -9.42) with propylamine: a row in water and rows in other solvents
        let el = smiles::parse("N#CC(C#N)=Cc1ccccc1").unwrap().perceived();
        let nuc = smiles::parse("CCCN").unwrap().perceived();
        let r = evaluate(&nuc, &el, "water").expect("both partners have rows");
        assert!((r.log10_k_20 - r.s_n * (r.n + r.e)).abs() < 1e-12);
        assert!((r.n - 13.33).abs() < 1e-9 && (r.e + 9.42).abs() < 1e-9, "N {} E {}", r.n, r.e);
        // hydroxide has rows in water only: no N in an alkane, whatever the other rows say
        let oh = smiles::parse("[OH-]").unwrap().perceived();
        assert!(evaluate(&oh, &el, "alkane").is_none());
    }
}
