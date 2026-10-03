//! Optical records: the seed rows and the lookup order.
//!
//! `data/optics_seed.json` holds the optical rows of the species store that ship with the engine (each row carries its tier
//! and source). A record registered in the species store (a data shard, a PubChem import) overrides the seed row of the same
//! id. Species without either are described by the models in this module's siblings (ligand field for d-ion complexes) or
//! are optically empty (colourless, transparent).

use std::collections::HashMap;
use std::sync::OnceLock;

use serde::Deserialize;

use crate::db::record::Optics;

#[derive(Deserialize)]
struct SeedFile {
    species: HashMap<String, Optics>,
    atomic_refraction: HashMap<String, f64>,
}

const SEED_JSON: &str = include_str!("../../data/optics_seed.json");

fn seed_file() -> &'static SeedFile {
    static S: OnceLock<SeedFile> = OnceLock::new();
    S.get_or_init(|| serde_json::from_str(SEED_JSON).expect("data/optics_seed.json"))
}

/// The seed rows by species id.
pub fn seed() -> &'static HashMap<String, Optics> {
    &seed_file().species
}

/// Atomic refraction R_D (cm3/mol) of an element for the additive estimate.
pub fn atomic_refraction(element: &str) -> Option<f64> {
    seed_file().atomic_refraction.get(element).copied()
}

/// The optical record of a species: the species store's own record when it has one, else the seed row.
pub fn lookup(id: &str) -> Option<Optics> {
    if let Some(st) = crate::db::SpeciesStore::try_global() {
        if let Ok(g) = st.read() {
            if let Some(o) = g.get(id).and_then(|r| r.optics.clone()) {
                return Some(o);
            }
        }
    }
    seed().get(id).cloned()
}

/// Molar refraction R_D (cm3/mol) of a species and the tier of the value: the optical record's datum, else the sum of the
/// atomic refractions of its formula (Estimated), else a molar-mass heuristic (Speculative).
pub fn molar_refraction(species: &str) -> (f64, crate::types::ProvenanceTier) {
    use crate::types::ProvenanceTier;
    let strip = |s: &str| -> String {
        for suf in ["(aq)", "(s)", "(l)", "(g)"] {
            if let Some(b) = s.strip_suffix(suf) {
                return b.to_string();
            }
        }
        s.to_string()
    };
    for id in [species.to_string(), strip(species)] {
        if let Some(d) = lookup(&id).and_then(|o| o.molar_refraction) {
            return (d.value, d.tier);
        }
    }
    let id = strip(species);
    if let Some(el) = crate::ions::species_elements(&id) {
        let mut total = 0.0;
        let mut all = !el.is_empty();
        for (e, n) in &el {
            match atomic_refraction(e) {
                Some(r) => total += r * n,
                None => {
                    all = false;
                    break;
                }
            }
        }
        if all {
            return (total, ProvenanceTier::Estimated);
        }
    }
    let mw = crate::ions::species_mass(&id).filter(|m| *m > 1.0).unwrap_or(40.0);
    ((mw * 0.25).max(1.0), ProvenanceTier::Speculative)
}

/// FNV-1a hash of every optical datum and model table: bottle colours and other derived colours key their caches on it.
pub fn data_hash() -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    let mut feed = |bytes: &[u8]| {
        for b in bytes {
            h ^= *b as u64;
            h = h.wrapping_mul(0x100000001b3);
        }
    };
    feed(SEED_JSON.as_bytes());
    feed(include_str!("../../data/ligand_field.json").as_bytes());
    feed(include_str!("../../data/flame_emitters.json").as_bytes());
    // model revision: bump when an optical model changes what the same data renders as
    feed(b"optics-model-1");
    h
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_rows_carry_tier_and_source() {
        assert!(seed().len() > 50);
        for (id, o) in seed() {
            assert!(o.tier.is_some() && o.source.as_deref().map_or(false, |s| !s.is_empty()), "{id} has no tier/source");
        }
    }

    #[test]
    fn iodine_is_solvatochromic_in_the_data() {
        let o = lookup("I2(aq)").unwrap();
        let water = o.bands.iter().find(|b| b.solvent.as_deref() == Some("water")).unwrap();
        let alkane = o.bands.iter().find(|b| b.solvent.as_deref() == Some("alkane")).unwrap();
        assert!((water.nm - 460.0).abs() < 10.0 && (alkane.nm - 520.0).abs() < 10.0);
    }
}
