//! Candidate species discovery for Gibbs Energy Minimization.

use std::collections::{HashMap, HashSet};
use crate::db::SpeciesStore;

/// Finds all candidate species from the SpeciesStore whose elements are a subset of `elements_present`.
pub fn find_candidate_species(elements_present: &HashSet<String>) -> Vec<String> {
    let mut candidates = HashSet::new();

    // Query SpeciesStore
    if let Ok(store) = SpeciesStore::global().read() {
        for rec in store.iter() {
            let elems = rec.elements();
            if !elems.is_empty() && elems.keys().all(|e| elements_present.contains(e)) {
                candidates.insert(rec.id.clone());
            }
        }
    }

    let mut out: Vec<String> = candidates.into_iter().collect();
    out.sort();
    out
}

/// Gathers the set of elements currently present in the vessel from aqueous and solid species.
pub fn get_present_elements(
    species_mol: &HashMap<String, f64>,
    solid_mol: &HashMap<String, f64>,
) -> HashSet<String> {
    let mut elems = HashSet::new();
    for (sp, &mol) in species_mol {
        if mol > 1e-18 {
            if let Some(map) = crate::ions::species_elements(sp) {
                for (e, _) in map {
                    elems.insert(e);
                }
            }
        }
    }
    for (sp, &mol) in solid_mol {
        if mol > 1e-18 {
            if let Some(map) = crate::ions::species_elements(sp) {
                for (e, _) in map {
                    elems.insert(e);
                }
            }
        }
    }
    elems
}
