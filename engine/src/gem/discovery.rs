//! General reaction discovery, classification, and thermodynamic driving force evaluation.
//!
//! Provides:
//! - Discovery of independent chemical reactions via stoichiometric null-space (RREF)
//!   over all candidate species in the store matching elements present.
//! - Classification into redox (oxidation state change), thermal decomposition (solid -> solid/gas),
//!   or precipitation/speciation.
//! - Thermodynamic driving force Delta_r G(T, P) from standard species chemical potentials.
//! - Generalized kinetic/equilibrium advancement without hardcoded species or reactions.

use std::collections::{HashMap, HashSet};
use crate::db::SpeciesStore;
use crate::thermo::functions::{phase_of_id, try_thermo_state};
use super::basis::build_reaction_basis;
use super::candidates::get_present_elements;
use super::redox::determine_oxidation_states;

/// Classification of a discovered reaction.
#[derive(Clone, Debug, PartialEq)]
pub enum DiscoveredRxnKind {
    Redox { z_electrons: f64 },
    ThermalDecomposition,
    PrecipitationOrDissolution,
    GeneralEquilibrium,
}

/// A fully parameterized discovered reaction with stoichiometry, thermodynamics, and classification.
#[derive(Clone, Debug)]
pub struct DiscoveredReaction {
    pub species_names: Vec<String>,
    /// (species_index, stoichiometric_coefficient: negative for reactants, positive for products)
    pub nu: Vec<(usize, f64)>,
    pub delta_h0_j: f64,
    pub delta_g0_j: f64,
    pub kind: DiscoveredRxnKind,
    /// For a redox reaction: the four species of its two couples (indices into `species_names`).
    pub partners: Option<RedoxPartners>,
}

/// The electron donor (reductant) and acceptor (oxidant) of a redox reaction and the product each turns into.
#[derive(Clone, Copy, Debug)]
pub struct RedoxPartners {
    pub donor: usize,
    pub donor_product: usize,
    pub acceptor: usize,
    pub acceptor_product: usize,
}

// The reaction quotient of a discovered reaction is evaluated by the vessel (`Vessel::discovered_extent`), which knows the
// phase of every species: solutes by activity, gases by partial pressure in the headspace or atmosphere, solids and the
// solvent at unit activity.

/// Standard reaction enthalpy and Gibbs energy (J/mol), or None when a species has no formation data. For a thermal
/// decomposition every species that is not a solid is a gas.
fn reaction_thermo(species: &[String], nu: &[(usize, f64)], t_k: f64, p_pa: f64, decomposition: bool) -> Option<(f64, f64)> {
    let (mut dh, mut dg) = (0.0, 0.0);
    for &(idx, coeff) in nu {
        let sp = &species[idx];
        let phase = if decomposition { if sp.ends_with("(s)") { "s" } else { "g" } } else { phase_of_id(sp) };
        let st = try_thermo_state(sp, phase, t_k, p_pa)?;
        dh += coeff * st.h_j_mol;
        dg += coeff * st.mu0_j_mol;
    }
    Some((dh, dg))
}

/// A reaction before its thermodynamics are evaluated: the species, stoichiometry and the couples it joins. These depend
/// only on *which* species are present, so they are found once per composition and kept (`DISCOVERY_CACHE`).
#[derive(Clone, Debug)]
struct Structure {
    species_names: Vec<String>,
    nu: Vec<(usize, f64)>,
    kind: DiscoveredRxnKind,
    partners: Option<RedoxPartners>,
}

/// One cached discovery: the structures of a composition and their thermodynamics at `thermo_t_k`.
struct CacheEntry {
    structs: Vec<Structure>,
    thermo_t_k: f64,
    thermo_p_pa: f64,
    thermo: Vec<Option<(f64, f64)>>,
}

thread_local! {
    /// (store generation, entries keyed by the sorted present species): reaction discovery runs every step on the same few
    /// compositions, and the search (couples, null spaces) is by far the expensive part.
    static DISCOVERY_CACHE: std::cell::RefCell<(u64, HashMap<(u8, Vec<String>), CacheEntry>)> = Default::default();
}

/// Largest temperature drift (K) over which cached reaction enthalpies and Gibbs energies are reused.
const THERMO_REUSE_K: f64 = 0.5;
const CACHE_MAX_ENTRIES: usize = 64;

fn cached_discovery(kind: u8, key: Vec<String>, t_k: f64, p_pa: f64, build: impl FnOnce() -> Vec<Structure>) -> Vec<DiscoveredReaction> {
    let generation = crate::db::SpeciesStore::generation();
    DISCOVERY_CACHE.with(|c| {
        let mut c = c.borrow_mut();
        if c.0 != generation || c.1.len() > CACHE_MAX_ENTRIES {
            c.1.clear();
            c.0 = generation;
        }
        let entry = c.1.entry((kind, key)).or_insert_with(|| {
            let structs = build();
            CacheEntry { thermo: vec![None; structs.len()], thermo_t_k: f64::NAN, thermo_p_pa: f64::NAN, structs }
        });
        if !(entry.thermo_t_k - t_k).abs().le(&THERMO_REUSE_K) || (entry.thermo_p_pa - p_pa).abs() > 0.05 * p_pa {
            entry.thermo = entry.structs.iter().map(|st| reaction_thermo(&st.species_names, &st.nu, t_k, p_pa, st.kind == DiscoveredRxnKind::ThermalDecomposition)).collect();
            entry.thermo_t_k = t_k;
            entry.thermo_p_pa = p_pa;
        }
        entry
            .structs
            .iter()
            .zip(&entry.thermo)
            .filter_map(|(st, th)| {
                th.map(|(dh, dg)| DiscoveredReaction {
                    species_names: st.species_names.clone(),
                    nu: st.nu.clone(),
                    delta_h0_j: dh,
                    delta_g0_j: dg,
                    kind: st.kind.clone(),
                    partners: st.partners,
                })
            })
            .collect()
    })
}

/// Discovers all independent redox reactions among the candidate species reachable from the vessel contents, with their
/// standard enthalpy and Gibbs energy at `(t_k, p_pa)`. A reaction whose species lack formation data is not proposed.
pub fn discover_reactions(
    species_mol: &HashMap<String, f64>,
    solid_mol: &HashMap<String, f64>,
    t_k: f64,
    p_pa: f64,
) -> Vec<DiscoveredReaction> {
    let mut key: Vec<String> = species_mol.iter().filter(|(_, &m)| m > 1e-12).map(|(s, _)| s.clone()).collect();
    key.extend(solid_mol.iter().filter(|(_, &m)| m > 1e-12).map(|(s, _)| s.clone()));
    key.sort();
    key.dedup();
    cached_discovery(0, key, t_k, p_pa, || discover_redox_structures(species_mol, solid_mol))
}

fn discover_redox_structures(species_mol: &HashMap<String, f64>, solid_mol: &HashMap<String, f64>) -> Vec<Structure> {
    let elements = get_present_elements(species_mol, solid_mol);
    if elements.is_empty() {
        return Vec::new();
    }

    let mut discovered: Vec<Structure> = Vec::new();
    let mut seen_signatures = HashSet::new();

    // 1. Collect present species with positive amounts
    let mut present_species: Vec<String> = species_mol.iter()
        .filter(|(_, &m)| m > 1e-12)
        .map(|(s, _)| s.clone())
        .collect();
    for (s, &m) in solid_mol {
        if m > 1e-12 && !present_species.contains(s) {
            present_species.push(s.clone());
        }
    }
    let aqueous_env = species_mol.contains_key(crate::vessel::AQUEOUS_SOLVENT)
        || species_mol.contains_key("H+")
        || species_mol.contains_key("OH-");

    if aqueous_env && !present_species.iter().any(|s| s == crate::vessel::AQUEOUS_SOLVENT) {
        present_species.push(crate::vessel::AQUEOUS_SOLVENT.to_string());
    }

    // 2. Identify labile redox elements and oxidation states of present species
    struct RedoxHalf {
        sp: String,
        elem: String,
        ox: i32,
    }

    let mut present_halves = Vec::new();
    for sp in &present_species {
        let ox_map = determine_oxidation_states(sp);
        let elem_map = crate::ions::species_elements(sp).unwrap_or_default();
        for elem in elem_map.keys() {
            if let Some(&ox) = ox_map.get(elem) {
                present_halves.push(RedoxHalf { sp: sp.clone(), elem: elem.clone(), ox });
            }
        }
    }

    // 3. For each labile element, query candidate products in different oxidation states
    let mut candidate_products_by_elem: HashMap<String, Vec<(String, i32)>> = HashMap::new();
    if let Ok(store) = SpeciesStore::global().read() {
        for rec in store.iter() {
            let elems = rec.elements();
            if elems.is_empty() || !elems.keys().all(|e| elements.contains(e)) {
                continue;
            }
            if elems.get("C").copied().unwrap_or(0.0) > 1.0 {
                continue;
            }
            // In solution a gas is formed dissolved and leaves by Henry exchange: a gas that has an aqueous or liquid twin
            // (O2(g) / O2(aq), H2O(g) / H2O) is not a partner of a solution reaction, its twin is.
            if aqueous_env && rec.id.ends_with("(g)") {
                let has_twin = store.get_by_formula(&rec.identity.formula).iter().any(|t| t.id != rec.id && (t.has_phase("aq") || t.has_phase("l")));
                if has_twin {
                    continue;
                }
            }
            let ox_map = determine_oxidation_states(&rec.id);
            for elem in elems.keys() {
                if let Some(&ox) = ox_map.get(elem) {
                    candidate_products_by_elem.entry(elem.clone()).or_default().push((rec.id.clone(), ox));
                }
            }
        }
    }

    // 4. Form oxidation couples and reduction couples
    let mut oxidation_couples: Vec<(String, String, String, i32, i32)> = Vec::new();
    let mut reduction_couples: Vec<(String, String, String, i32, i32)> = Vec::new();

    for half in &present_halves {
        if let Some(products) = candidate_products_by_elem.get(&half.elem) {
            for (p_sp, p_ox) in products {
                if p_sp == &half.sp || !super::redox::couple_is_eligible(&half.elem, &half.sp, p_sp) {
                    continue;
                }
                if *p_ox > half.ox {
                    oxidation_couples.push((half.sp.clone(), p_sp.clone(), half.elem.clone(), half.ox, *p_ox));
                } else if *p_ox < half.ox {
                    reduction_couples.push((half.sp.clone(), p_sp.clone(), half.elem.clone(), half.ox, *p_ox));
                }
            }
        }
    }

    oxidation_couples.sort();
    oxidation_couples.dedup();
    reduction_couples.sort();
    reduction_couples.dedup();

    // 5. Try balancing each (ox_couple, red_couple) pair
    let water_id = crate::vessel::AQUEOUS_SOLVENT.to_string();
    let h_plus = "H+".to_string();
    let oh_minus = "OH-".to_string();

    for (s_ox, p_ox, _elem_ox, ox_s, ox_p) in &oxidation_couples {
        for (s_red, p_red, _elem_red, _red_s, _red_p) in &reduction_couples {
            if s_ox == s_red && p_ox == p_red {
                continue;
            }

            let candidate_sets = if aqueous_env {
                vec![
                    vec![s_ox.clone(), p_ox.clone(), s_red.clone(), p_red.clone()],
                    vec![s_ox.clone(), p_ox.clone(), s_red.clone(), p_red.clone(), h_plus.clone(), water_id.clone()],
                    vec![s_ox.clone(), p_ox.clone(), s_red.clone(), p_red.clone(), oh_minus.clone(), water_id.clone()],
                ]
            } else {
                vec![vec![s_ox.clone(), p_ox.clone(), s_red.clone(), p_red.clone()]]
            };

            for mut sub_species in candidate_sets {
                sub_species.sort();
                sub_species.dedup();

                let basis = build_reaction_basis(&sub_species);
                for rxn in basis {
                    let idx_s_ox = sub_species.iter().position(|s| s == s_ox);
                    let idx_s_red = sub_species.iter().position(|s| s == s_red);
                    let idx_p_ox = sub_species.iter().position(|s| s == p_ox);
                    let idx_p_red = sub_species.iter().position(|s| s == p_red);

                    let (i_sox, i_sred, i_pox, i_pred) = match (idx_s_ox, idx_s_red, idx_p_ox, idx_p_red) {
                        (Some(a), Some(b), Some(c), Some(d)) => (a, b, c, d),
                        _ => continue,
                    };

                    let c_sox = rxn.nu.iter().find(|&&(i, _)| i == i_sox).map(|&(_, c)| c).unwrap_or(0.0);
                    let c_sred = rxn.nu.iter().find(|&&(i, _)| i == i_sred).map(|&(_, c)| c).unwrap_or(0.0);
                    let c_pox = rxn.nu.iter().find(|&&(i, _)| i == i_pox).map(|&(_, c)| c).unwrap_or(0.0);
                    let c_pred = rxn.nu.iter().find(|&&(i, _)| i == i_pred).map(|&(_, c)| c).unwrap_or(0.0);

                    if c_sox.abs() < 1e-6 || c_sred.abs() < 1e-6 || c_pox.abs() < 1e-6 || c_pred.abs() < 1e-6 {
                        continue;
                    }

                    let mut nu_oriented = rxn.nu;
                    if c_sox > 0.0 {
                        nu_oriented = nu_oriented.into_iter().map(|(i, c)| (i, -c)).collect();
                    }

                    let cur_c_sox = nu_oriented.iter().find(|&&(i, _)| i == i_sox).map(|&(_, c)| c).unwrap_or(0.0);
                    let cur_c_sred = nu_oriented.iter().find(|&&(i, _)| i == i_sred).map(|&(_, c)| c).unwrap_or(0.0);
                    let cur_c_pox = nu_oriented.iter().find(|&&(i, _)| i == i_pox).map(|&(_, c)| c).unwrap_or(0.0);
                    let cur_c_pred = nu_oriented.iter().find(|&&(i, _)| i == i_pred).map(|&(_, c)| c).unwrap_or(0.0);

                    if cur_c_sox >= -1e-6 || cur_c_sred >= -1e-6 || cur_c_pox <= 1e-6 || cur_c_pred <= 1e-6 {
                        continue;
                    }

                    let z_electrons = (cur_c_sox.abs() * (ox_p - ox_s) as f64).round().max(1.0);

                    let mut sig_parts: Vec<String> = nu_oriented.iter()
                        .map(|&(i, c)| format!("{}:{}", sub_species[i], c.round()))
                        .collect();
                    sig_parts.sort();
                    let sig = sig_parts.join(";");

                    if seen_signatures.insert(sig) {
                        discovered.push(Structure {
                            species_names: sub_species.clone(),
                            nu: nu_oriented,
                            kind: DiscoveredRxnKind::Redox { z_electrons },
                            partners: Some(RedoxPartners { donor: i_sox, donor_product: i_pox, acceptor: i_sred, acceptor_product: i_pred }),
                        });
                    }
                }
            }
        }
    }

    discovered
}

/// Discovers thermal decomposition reactions for the solids present (solid -> solid + gas, or solid -> gases), with their
/// standard enthalpy and Gibbs energy at `(t_k, p_pa)`.
pub fn discover_thermal_decompositions(
    solid_mol: &HashMap<String, f64>,
    t_k: f64,
    p_pa: f64,
) -> Vec<DiscoveredReaction> {
    let mut key: Vec<String> = solid_mol.iter().filter(|(_, &m)| m > 1e-12).map(|(s, _)| s.clone()).collect();
    key.sort();
    cached_discovery(1, key.clone(), t_k, p_pa, || discover_decomposition_structures(&key))
}

fn discover_decomposition_structures(solids: &[String]) -> Vec<Structure> {
    let mut discovered: Vec<Structure> = Vec::new();
    let mut seen_signatures = HashSet::new();

    for solid_sp in solids {
        let elem_map = match crate::ions::species_elements(solid_sp) {
            Some(m) => m,
            None => continue,
        };
        let solid_elements: HashSet<String> = elem_map.keys().cloned().collect();

        let mut candidate_solids = Vec::new();
        let mut candidate_gases = Vec::new();

        if let Ok(store) = SpeciesStore::global().read() {
            for rec in store.iter() {
                if rec.identity.charge != 0 {
                    continue;
                }
                let elems = rec.elements();
                let is_multi_carbon = elems.get("C").copied().unwrap_or(0.0) > 1.0;
                if elems.is_empty() || is_multi_carbon || !elems.keys().all(|e| solid_elements.contains(e)) {
                    continue;
                }
                if rec.has_phase("s") && &rec.id != solid_sp {
                    candidate_solids.push(rec.id.clone());
                } else if rec.has_phase("g") {
                    candidate_gases.push(rec.id.clone());
                }
            }
        }

        // Build candidate sets:
        // 1. Direct decomposition to gases only (e.g. NH4Cl(s) -> NH3(g) + HCl(g))
        let mut candidate_sets: Vec<Vec<String>> = Vec::new();
        let mut direct_set = vec![solid_sp.clone()];
        direct_set.extend(candidate_gases.iter().cloned());
        candidate_sets.push(direct_set);

        // 2. Decomposition to another solid + gases (e.g. NaHCO3(s) -> Na2CO3(s) + CO2(g) + H2O(g))
        for p_solid in &candidate_solids {
            let mut sol_set = vec![solid_sp.clone(), p_solid.clone()];
            sol_set.extend(candidate_gases.iter().cloned());
            candidate_sets.push(sol_set);
        }

        for mut candidate_ids in candidate_sets {
            candidate_ids.sort();
            candidate_ids.dedup();
            if candidate_ids.len() < 2 {
                continue;
            }

            let basis = build_reaction_basis(&candidate_ids);

            for rxn in basis {
                let mut nu_oriented = rxn.nu;

                // Invert if target solid is on the product side (c > 0)
                let target_coeff = nu_oriented.iter().find(|&&(i, _)| &candidate_ids[i] == solid_sp).map(|&(_, c)| c).unwrap_or(0.0);
                if target_coeff > 0.0 {
                    nu_oriented = nu_oriented.into_iter().map(|(i, c)| (i, -c)).collect();
                }

                let decomposes_target = nu_oriented.iter().any(|&(i, c)| c < 0.0 && &candidate_ids[i] == solid_sp);
                let all_reactants_solid = nu_oriented.iter().all(|&(i, c)| c >= 0.0 || candidate_ids[i].ends_with("(s)"));
                let has_gas_product = nu_oriented.iter().any(|&(i, c)| c > 0.0 && candidate_ids[i].ends_with("(g)"));

                // Exclude pure physical sublimation of identical molecule (e.g. H2O(s) -> H2O(g))
                // which is handled by physical VLE/sublimation rather than chemical decomposition.
                let is_pure_sublimation = nu_oriented.len() == 2 && {
                    let r = candidate_ids[nu_oriented[0].0].trim_end_matches("(s)").trim_end_matches("(g)");
                    let p = candidate_ids[nu_oriented[1].0].trim_end_matches("(s)").trim_end_matches("(g)");
                    r == p
                };

                if decomposes_target && all_reactants_solid && has_gas_product && !is_pure_sublimation {
                    let mut sig_parts: Vec<String> = nu_oriented.iter()
                        .map(|&(i, c)| format!("{}:{}", candidate_ids[i], c.round()))
                        .collect();
                    sig_parts.sort();
                    let sig = sig_parts.join(";");
                    if seen_signatures.insert(sig) {
                        discovered.push(Structure {
                            species_names: candidate_ids.clone(),
                            nu: nu_oriented,
                            kind: DiscoveredRxnKind::ThermalDecomposition,
                            partners: None,
                        });
                    }
                }
            }
        }
    }

    discovered
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discover_zinc_acid_redox() {
        let mut species = HashMap::new();
        species.insert("H+".to_string(), 0.1);
        species.insert("Cl-".to_string(), 0.1);
        let mut solids = HashMap::new();
        solids.insert("Zn(s)".to_string(), 0.05);

        let rxns = discover_reactions(&species, &solids, 298.15, 101325.0);
        let redox_rxn = rxns.iter().find(|r| matches!(r.kind, DiscoveredRxnKind::Redox { .. }));
        assert!(redox_rxn.is_some(), "Must discover Zn redox reaction");

        let r = redox_rxn.unwrap();
        // Check delta G0 is negative (spontaneous)
        assert!(r.delta_g0_j < -50000.0, "Zn + 2 H+ must be strongly spontaneous, got dG0 = {}", r.delta_g0_j);
    }

    #[test]
    fn test_discover_caco3_thermal_decomposition() {
        let mut solids = HashMap::new();
        solids.insert("CaCO3(s)".to_string(), 0.1);

        let rxns = discover_thermal_decompositions(&solids, 298.15, 101325.0);
        let decomp = rxns.iter().find(|r| r.kind == DiscoveredRxnKind::ThermalDecomposition);
        assert!(decomp.is_some(), "Must discover CaCO3 thermal decomposition");

        let d = decomp.unwrap();
        // At 298 K, CaCO3 decomposition has delta_g0 > 0
        assert!(d.delta_g0_j > 100000.0, "CaCO3 decomposition must not be spontaneous at 298 K, got dG0 = {}", d.delta_g0_j);
        // At 1200 K, delta_g0 should be negative
        let rxns_high_t = discover_thermal_decompositions(&solids, 1200.0, 101325.0);
        let d_high = rxns_high_t.iter().find(|r| r.kind == DiscoveredRxnKind::ThermalDecomposition).unwrap();
        assert!(d_high.delta_g0_j < 0.0, "CaCO3 decomposition must be spontaneous at 1200 K, got dG0 = {}", d_high.delta_g0_j);
    }

    #[test]
    fn test_discover_nahco3_thermal_decomposition() {
        let mut solids = HashMap::new();
        solids.insert("NaHCO3(s)".to_string(), 0.1);

        let rxns = discover_thermal_decompositions(&solids, 298.15, 101325.0);
        eprintln!("NaHCO3 rxns count: {}", rxns.len());
        for r in &rxns {
            eprintln!("  rxn: dG0={}", r.delta_g0_j);
            for &(i, c) in &r.nu {
                eprintln!("    {} * {}", c, r.species_names[i]);
            }
        }
        let decomp = rxns.iter().find(|r| r.kind == DiscoveredRxnKind::ThermalDecomposition);
        assert!(decomp.is_some(), "Must discover NaHCO3 thermal decomposition");
    }
}
