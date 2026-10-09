//! Mayr nucleofugality relation (`data/mayr_nucleofugality.json`): log10 k(25 C) = sf (Nf + Ef) for the first-order heterolysis
//! (SN1 ionisation) of a benzhydryl halide, with Ef the electrofugality of the benzhydrylium ion and Nf, sf the nucleofugality and
//! slope of the leaving group in a solvent (Streidl thesis 2010, Tables 5.1 / 5.2; see the data file).
//!
//! Substrates are matched by structure (the Weisfeiler-Lehman hash of the halide, `rate_store::molecule_hash`), never by name.
//! There is no row in pure water: the solvent class "water" uses the reference row of the most aqueous mixture (the file says which),
//! so the rate is a lower bound there; no other solvent class has a row. A substrate whose electrofugality lies more than the
//! validity margin outside the range of the electrofuges the row was fitted on gets no rate (the relation is an interpolation).

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::physics::R_GAS;
use crate::rate_store;
use crate::smiles::{self, Molecule};

#[derive(Deserialize)]
struct Electrofuge {
    id: String,
    ef: f64,
    substrates: HashMap<String, String>,
}

#[derive(Deserialize)]
struct Nucleofuge {
    id: String,
    leaving_group: String,
    solvent: String,
    nf: f64,
    sf: f64,
    electrofuges_used: Vec<u32>,
}

#[derive(Deserialize, Clone)]
pub struct TemplateConfig {
    pub substrate_slot: usize,
    pub leaving_atom: usize,
}

#[derive(Deserialize)]
struct File {
    assumed_ea_kj_mol: f64,
    water_class: HashMap<String, String>,
    validity_margin_ef: f64,
    templates: HashMap<String, TemplateConfig>,
    electrofuges: Vec<Electrofuge>,
    nucleofuges: Vec<Nucleofuge>,
}

struct Index {
    file: File,
    /// substrate hash -> (electrofuge index, leaving group symbol)
    substrates: HashMap<String, (usize, String)>,
}

fn index() -> &'static Index {
    static INDEX: OnceLock<Index> = OnceLock::new();
    INDEX.get_or_init(|| {
        let file: File = serde_json::from_str(include_str!("../data/mayr_nucleofugality.json")).expect("data/mayr_nucleofugality.json");
        let mut substrates = HashMap::new();
        for (i, e) in file.electrofuges.iter().enumerate() {
            for (lg, smi) in &e.substrates {
                if let Some(m) = smiles::parse(smi) {
                    substrates.insert(rate_store::molecule_hash(&m.perceived()), (i, lg.clone()));
                }
            }
        }
        Index { file, substrates }
    })
}

/// Which slot / atom of a template the relation reads (templates named in the data file).
pub fn template_config(template_id: &str) -> Option<TemplateConfig> {
    index().file.templates.get(template_id).cloned()
}

#[derive(Clone, Debug)]
pub struct NucleofugeRate {
    /// first-order rate constant at 298.15 K
    pub k_298: f64,
    pub log10_k: f64,
    /// activation energy used for the temperature dependence (an assumption, see the data file)
    pub ea_j: f64,
    pub nf: f64,
    pub sf: f64,
    pub ef: f64,
    pub source: String,
}

/// The rate of ionisation of `substrate` (a benzhydryl halide with halogen `leaving_group`, e.g. "Cl") in a solvent class, or None
/// when the substrate is not a reference electrofuge, the class has no row, or the substrate lies outside the fitted range.
pub fn evaluate(substrate: &Molecule, leaving_group: &str, solvent_class: &str) -> Option<NucleofugeRate> {
    if solvent_class != "water" {
        return None;
    }
    let idx = index();
    let (ei, lg) = idx.substrates.get(&rate_store::molecule_hash(&substrate.perceived()))?;
    if lg != leaving_group {
        return None;
    }
    let row_id = idx.file.water_class.get(lg)?;
    let n = idx.file.nucleofuges.iter().find(|n| &n.id == row_id && n.leaving_group == *lg)?;
    let e = &idx.file.electrofuges[*ei];
    let used: Vec<f64> = n
        .electrofuges_used
        .iter()
        .filter_map(|k| idx.file.electrofuges.iter().find(|x| x.id == format!("E{k}")).map(|x| x.ef))
        .collect();
    let (lo, hi) = (used.iter().cloned().fold(f64::MAX, f64::min), used.iter().cloned().fold(f64::MIN, f64::max));
    let m = idx.file.validity_margin_ef;
    if used.is_empty() || e.ef < lo - m || e.ef > hi + m {
        return None;
    }
    let log10_k = n.sf * (n.nf + e.ef);
    Some(NucleofugeRate {
        k_298: 10f64.powf(log10_k),
        log10_k,
        ea_j: idx.file.assumed_ea_kj_mol * 1000.0,
        nf: n.nf,
        sf: n.sf,
        ef: e.ef,
        source: format!(
            "Mayr nucleofugality relation: log10 k(25 C) = {:.2} = sf (Nf + Ef), sf {:.2}, Nf {:.2} ({} in {}, Streidl 2010 Table 5.2 {}), Ef {:.2} ({}); \
             the reference solvent is a {} mixture (water ionises faster: lower bound), activation energy assumed {:.0} kJ/mol",
            log10_k, n.sf, n.nf, lg, n.solvent, n.id, e.ef, e.id, n.solvent, idx.file.assumed_ea_kj_mol
        ),
    })
}

/// k(T) of a rate from `evaluate`, using its assumed activation energy.
pub fn k_at(r: &NucleofugeRate, t_k: f64) -> f64 {
    r.k_298 * (r.ea_j / R_GAS * (1.0 / 298.15 - 1.0 / t_k)).exp()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mol(s: &str) -> Molecule {
        smiles::parse(s).unwrap().perceived()
    }

    #[test]
    fn benzhydryl_chloride_in_water_follows_sf_nf_plus_ef() {
        let r = evaluate(&mol("ClC(c1ccccc1)c1ccccc1"), "Cl", "water").expect("benzhydryl chloride is E14");
        // Table 5.2 N23 (Cl in 60AN40W): Nf 3.84, sf 0.96; Table 5.1 E14: Ef -6.03
        assert!((r.log10_k - 0.96 * (3.84 - 6.03)).abs() < 1e-9, "{}", r.log10_k);
        assert!(r.source.contains("lower bound"));
        assert!(k_at(&r, 318.15) > r.k_298 * 5.0, "warmer is faster");
    }

    #[test]
    fn only_reference_electrofuges_in_the_fitted_range_in_water_have_a_rate() {
        // E22 (4-methoxy) is in range; the bis(dimethylamino) ion (E35, Ef 4.84) is far above the range of the Cl row; no row in alkane / alcohol
        assert!(evaluate(&mol("COc1ccc(C(Cl)c2ccccc2)cc1"), "Cl", "water").is_some());
        assert!(evaluate(&mol("CN(C)c1ccc(C(Cl)c2ccc(N(C)C)cc2)cc1"), "Cl", "water").is_none());
        assert!(evaluate(&mol("ClC(c1ccccc1)c1ccccc1"), "Cl", "alkane").is_none());
        assert!(evaluate(&mol("ClC(c1ccccc1)c1ccccc1"), "Cl", "alcohol").is_none());
        // a molecule that is not a benzhydryl halide
        assert!(evaluate(&mol("CC(C)(C)Cl"), "Cl", "water").is_none());
        // the bromide of the same cation is a different substrate and has its own leaving-group row
        let br = evaluate(&mol("BrC(c1ccccc1)c1ccccc1"), "Br", "water").expect("bromide");
        assert!((br.log10_k - 0.99 * (5.23 - 6.03)).abs() < 1e-9);
    }
}
