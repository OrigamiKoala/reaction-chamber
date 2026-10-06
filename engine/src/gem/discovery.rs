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
use super::redox::determine_oxidation_states_exact;

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

/// A gas that has no dissolved twin of its own but reacts with water completely: it is a dissolved acid or its anhydride, so a
/// reaction in solution makes the ions (HCl(g) = H+ + Cl-, HI(g), HBr(g)) or the hydrate (SO3(g) + H2O = H2SO4), not the gas. The
/// hydrate and the anion are looked up in the store by their atoms; nothing here names a compound.
fn gas_reacts_with_water(store: &SpeciesStore, gas: &crate::db::SpeciesRecord) -> bool {
    let el = gas.elements();
    if el.is_empty() {
        return false;
    }
    // the gas plus one water is a species of the store in another phase
    let mut hydrate = el.clone();
    *hydrate.entry("H".to_string()).or_insert(0.0) += 2.0;
    *hydrate.entry("O".to_string()).or_insert(0.0) += 1.0;
    if store.iter().any(|r| !r.id.ends_with("(g)") && r.identity.charge == 0 && r.elements() == hydrate) {
        return true;
    }
    // one acidic hydrogen on what is a singly charged anion of the store (HX = H+ + X-)
    if el.get("H") == Some(&1.0) && el.len() > 1 {
        let mut rest = el;
        rest.remove("H");
        return store.iter().any(|r| r.identity.charge == -1 && r.elements() == rest);
    }
    false
}

/// An elemental metal is not made from an oxo species (MnO4-, Cr2O7-2, MnO2) by a reductant in solution: the reduction stops at
/// the aqua cation, whose own reduction to the metal is far uphill for any reductant that is not an electrode. (Thermodynamics
/// alone does not say so: the seven-electron reaction MnO4- -> Mn(s) is downhill for a mild reductant because the overall
/// potential averages the steps, but the last of them is not.) Metal cations, ammines and the like are not affected.
fn is_metal_from_oxo_species(reactant: &str, product: &str) -> bool {
    let metal_solid = |sp: &str| {
        sp.ends_with("(s)") && crate::ions::species_elements(sp).map_or(false, |e| e.len() == 1 && e.keys().all(|k| crate::compound_thermo::is_metal_element(k)))
    };
    let oxo = |sp: &str| crate::ions::species_elements(sp).map_or(false, |e| e.contains_key("O") && e.len() > 1);
    (metal_solid(product) && oxo(reactant)) || (metal_solid(reactant) && oxo(product))
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
        || species_mol.contains_key(crate::db::seed::PROTON)
        || species_mol.contains_key(crate::db::seed::HYDROXIDE);

    if aqueous_env && !present_species.iter().any(|s| s == crate::vessel::AQUEOUS_SOLVENT) {
        present_species.push(crate::vessel::AQUEOUS_SOLVENT.to_string());
    }

    // 2. Identify labile redox elements and oxidation states of present species
    struct RedoxHalf {
        sp: String,
        elem: String,
        ox: f64,
    }

    let mut present_halves = Vec::new();
    for sp in &present_species {
        if super::redox::is_derived_ion_form(sp) {
            continue;
        }
        let ox_map = determine_oxidation_states_exact(sp);
        let elem_map = crate::ions::species_elements(sp).unwrap_or_default();
        for elem in elem_map.keys() {
            if let Some(&ox) = ox_map.get(elem) {
                present_halves.push(RedoxHalf { sp: sp.clone(), elem: elem.clone(), ox });
            }
        }
    }

    // 3. For each labile element, query candidate products in different oxidation states
    let mut candidate_products_by_elem: HashMap<String, Vec<(String, f64)>> = HashMap::new();
    if let Ok(store) = SpeciesStore::global().read() {
        for rec in store.iter() {
            let elems = rec.elements();
            if elems.is_empty() || !elems.keys().all(|e| elements.contains(e)) {
                continue;
            }
            // organic species are candidates too: whether a carbon couple reacts on bench time is decided by
            // `couple_is_eligible` (a record's self-exchange rate), never by excluding carbon here
            // In solution a gas is formed dissolved and leaves by Henry exchange: a gas that has an aqueous or liquid twin
            // (O2(g) / O2(aq), H2O(g) / H2O) is not a partner of a solution reaction, its twin is.
            if aqueous_env && rec.id.ends_with("(g)") {
                let has_twin = store.get_by_formula(&rec.identity.formula).iter().any(|t| t.id != rec.id && (t.has_phase("aq") || t.has_phase("l")));
                if has_twin || gas_reacts_with_water(&store, rec) {
                    continue;
                }
            }
            // the same for a neat liquid that has a dissolved form of its own (Br2(l) / Br2(aq)): the solution holds the dissolved
            // molecule, and the phase machinery (solubility, immiscible layers) decides how much of it is a layer of its own
            if aqueous_env && rec.id.ends_with("(l)") {
                let has_aq = store.get_by_formula(&rec.identity.formula).iter().any(|t| t.id != rec.id && !t.id.ends_with("(l)") && !t.id.ends_with("(g)") && !t.id.ends_with("(s)") && t.has_phase("aq"));
                if has_aq {
                    continue;
                }
            }
            if super::redox::is_derived_ion_form(&rec.id) {
                continue;
            }
            // in water a compound solid forms only through its precipitation model (solids already present still react as
            // reactants: the partner side of a couple is what gets *made*)
            if aqueous_env && rec.id.ends_with("(s)") && !super::redox::solid_may_form_in_solution(&rec.id) {
                continue;
            }
            let ox_map = determine_oxidation_states_exact(&rec.id);
            for elem in elems.keys() {
                if let Some(&ox) = ox_map.get(elem) {
                    candidate_products_by_elem.entry(elem.clone()).or_default().push((rec.id.clone(), ox));
                }
            }
        }
    }

    // 4. Form oxidation couples and reduction couples
    let mut oxidation_couples: Vec<(String, String, String, f64, f64)> = Vec::new();
    let mut reduction_couples: Vec<(String, String, String, f64, f64)> = Vec::new();

    for half in &present_halves {
        if let Some(products) = candidate_products_by_elem.get(&half.elem) {
            for (p_sp, p_ox) in products {
                if p_sp == &half.sp || !super::redox::couple_is_eligible(&half.elem, &half.sp, p_sp) || is_metal_from_oxo_species(&half.sp, p_sp) {
                    continue;
                }
                // a couple whose forms differ by less than 1/1000 of an electron per atom is the same oxidation level
                if *p_ox > half.ox + 1e-3 {
                    oxidation_couples.push((half.sp.clone(), p_sp.clone(), half.elem.clone(), half.ox, *p_ox));
                } else if *p_ox < half.ox - 1e-3 {
                    reduction_couples.push((half.sp.clone(), p_sp.clone(), half.elem.clone(), half.ox, *p_ox));
                }
            }
        }
    }

    let order = |a: &(String, String, String, f64, f64), b: &(String, String, String, f64, f64)| {
        (&a.0, &a.1, &a.2).cmp(&(&b.0, &b.1, &b.2)).then(a.3.total_cmp(&b.3)).then(a.4.total_cmp(&b.4))
    };
    oxidation_couples.sort_by(order);
    oxidation_couples.dedup();
    reduction_couples.sort_by(order);
    reduction_couples.dedup();

    // 5. Try balancing each (ox_couple, red_couple) pair
    let water_id = crate::vessel::AQUEOUS_SOLVENT.to_string();
    let h_plus = crate::db::seed::PROTON.to_string();
    let oh_minus = crate::db::seed::HYDROXIDE.to_string();

    for (s_ox, p_ox, elem_ox, ox_s, ox_p) in &oxidation_couples {
        for (s_red, p_red, elem_red, red_s, red_p) in &reduction_couples {
            if s_ox == s_red && p_ox == p_red {
                continue;
            }
            // two forms of one element exchanging their oxidation levels (Fe2+ + FeSO4+ -> Fe3+ + FeSO4) change nothing but
            // the speciation, which the association equilibria already hold; only a net change of oxidation levels is redox
            if elem_ox == elem_red && (ox_s - red_p).abs() < 1e-3 && (red_s - ox_p).abs() < 1e-3 {
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

                    // electrons the donor species gives: its atoms of the element each change by the difference of the
                    // average oxidation states (one atom for Fe2+, six for hydroquinone)
                    let atoms = crate::ions::species_elements(s_ox).and_then(|m| m.get(elem_ox).copied()).unwrap_or(1.0);
                    let z_electrons = (cur_c_sox.abs() * atoms * (ox_p - ox_s)).round().max(1.0);

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

/// Solves `sum_j x_j col_j = target` for the strictly positive `x` when the columns are linearly independent and the system is
/// consistent (Gaussian elimination with partial pivoting on the normal form); None otherwise.
fn solve_positive_combination(cols: &[&Vec<f64>], target: &[f64]) -> Option<Vec<f64>> {
    let (m, k) = (target.len(), cols.len());
    if k == 0 || k > m {
        return None;
    }
    // augmented matrix m x (k + 1)
    let mut a: Vec<Vec<f64>> = (0..m).map(|r| { let mut row: Vec<f64> = cols.iter().map(|c| c[r]).collect(); row.push(target[r]); row }).collect();
    let mut pivot_row = 0;
    let mut pivot_col_of_row = Vec::new();
    for c in 0..k {
        let Some(p) = (pivot_row..m).max_by(|&i, &j| a[i][c].abs().partial_cmp(&a[j][c].abs()).unwrap_or(std::cmp::Ordering::Equal)) else { return None };
        if a[p][c].abs() < 1e-9 {
            return None; // dependent columns
        }
        a.swap(pivot_row, p);
        let d = a[pivot_row][c];
        for j in c..=k {
            a[pivot_row][j] /= d;
        }
        for r in 0..m {
            if r != pivot_row {
                let f = a[r][c];
                if f != 0.0 {
                    for j in c..=k {
                        a[r][j] -= f * a[pivot_row][j];
                    }
                }
            }
        }
        pivot_col_of_row.push(c);
        pivot_row += 1;
    }
    // rows below the pivots must read 0 = 0
    if (pivot_row..m).any(|r| a[r][k].abs() > 1e-9) {
        return None;
    }
    let x: Vec<f64> = (0..k).map(|c| a[c][k]).collect();
    if x.iter().all(|v| *v > 1e-9) { Some(x) } else { None }
}

/// Smallest multiplier in 1..=6 that turns every coefficient into a whole number (else 1).
fn whole_number_scale(coeffs: &[f64]) -> f64 {
    for f in 1..=6 {
        if coeffs.iter().all(|c| ((c * f as f64) - (c * f as f64).round()).abs() < 1e-6) {
            return f as f64;
        }
    }
    1.0
}

/// The minimal thermal decompositions of each solid: it turns into one or two other solids plus a set of gases, with the gases
/// chosen so that no gas is redundant (every gas of the set is needed by the element balance and the coefficients are all
/// positive). Which pathways *proceed* is decided by the sign of their Gibbs energy at the vessel's temperature, not here,
/// so this set depends only on the species present. (A basis of the null space would give arbitrary combinations of
/// pathways, and which ones depended on the order and number of species in the store.)
fn discover_decomposition_structures(solids: &[String]) -> Vec<Structure> {
    let mut discovered: Vec<Structure> = Vec::new();
    const MAX_GASES: usize = 3;

    for solid_sp in solids {
        let mut local: Vec<Structure> = Vec::new();
        let mut seen_signatures = HashSet::new();
        let Some(elem_map) = crate::ions::species_elements(solid_sp) else { continue };
        let mut elements: Vec<String> = elem_map.keys().cloned().collect();
        elements.sort();
        let target: Vec<f64> = elements.iter().map(|e| elem_map[e]).collect();
        let column = |sp: &str| -> Option<Vec<f64>> {
            let m = crate::ions::species_elements(sp)?;
            if m.keys().any(|k| !elements.contains(k)) {
                return None;
            }
            Some(elements.iter().map(|e| m.get(e).copied().unwrap_or(0.0)).collect())
        };

        let mut candidate_solids: Vec<(String, Vec<f64>)> = Vec::new();
        let mut candidate_gases: Vec<(String, Vec<f64>)> = Vec::new();
        if let Ok(store) = SpeciesStore::global().read() {
            for rec in store.iter() {
                if rec.identity.charge != 0 || rec.id == *solid_sp {
                    continue;
                }
                let elems = rec.elements();
                if elems.is_empty() || elems.get("C").copied().unwrap_or(0.0) > 1.0 {
                    continue;
                }
                let Some(col) = column(&rec.id) else { continue };
                if rec.has_phase("s") {
                    candidate_solids.push((rec.id.clone(), col));
                } else if rec.has_phase("g") {
                    candidate_gases.push((rec.id.clone(), col));
                }
            }
        }

        // product solid sets: none, each one, each pair
        let mut solid_sets: Vec<Vec<usize>> = vec![Vec::new()];
        for i in 0..candidate_solids.len() {
            solid_sets.push(vec![i]);
        }
        for i in 0..candidate_solids.len() {
            for j in (i + 1)..candidate_solids.len() {
                solid_sets.push(vec![i, j]);
            }
        }
        for sset in &solid_sets {
            // gas subsets of growing size; a subset is skipped once a smaller subset of it already solved the balance
            let max_g = if sset.len() == 2 { 2 } else { MAX_GASES };
            let ng = candidate_gases.len();
            let mut solved_subsets: Vec<Vec<usize>> = Vec::new();
            for size in 0..=max_g.min(ng) {
                let mut idx: Vec<usize> = (0..size).collect();
                loop {
                    let contains_solved = solved_subsets.iter().any(|ss| ss.iter().all(|g| idx.contains(g)));
                    if !contains_solved && (size > 0 || !sset.is_empty()) && sset.len() + size <= elements.len() {
                        let mut cols: Vec<&Vec<f64>> = sset.iter().map(|&i| &candidate_solids[i].1).collect();
                        cols.extend(idx.iter().map(|&g| &candidate_gases[g].1));
                        if let Some(x) = solve_positive_combination(&cols, &target) {
                            let n_solid = sset.len();
                            // reaction: solid -> products, coefficients scaled to whole numbers
                            let mut coeffs: Vec<f64> = vec![1.0];
                            coeffs.extend(x.iter().copied());
                            let scale = whole_number_scale(&coeffs);
                            let mut names: Vec<String> = vec![solid_sp.clone()];
                            names.extend(sset.iter().map(|&i| candidate_solids[i].0.clone()));
                            names.extend(idx.iter().map(|&g| candidate_gases[g].0.clone()));
                            let nu: Vec<(usize, f64)> = names.iter().enumerate().map(|(k, _)| (k, if k == 0 { -scale } else { x[k - 1] * scale })).collect();
                            // indices refer to a sorted species list so that the vessel can look species up by position
                            let mut order: Vec<usize> = (0..names.len()).collect();
                            order.sort_by(|&i, &j| names[i].cmp(&names[j]));
                            let sorted_names: Vec<String> = order.iter().map(|&i| names[i].clone()).collect();
                            let nu_sorted: Vec<(usize, f64)> = order.iter().enumerate().map(|(new_i, &old_i)| (new_i, nu[old_i].1)).collect();
                            let has_gas_product = idx.len() > 0;
                            let is_pure_sublimation = nu_sorted.len() == 2 && {
                                let r = sorted_names[0].trim_end_matches("(s)").trim_end_matches("(g)");
                                let p = sorted_names[1].trim_end_matches("(s)").trim_end_matches("(g)");
                                r == p
                            };
                            let _ = n_solid;
                            if has_gas_product && !is_pure_sublimation {
                                let mut sig_parts: Vec<String> = nu_sorted.iter().map(|&(i, c)| format!("{}:{}", sorted_names[i], c.round())).collect();
                                sig_parts.sort();
                                if seen_signatures.insert(sig_parts.join(";")) {
                                    local.push(Structure { species_names: sorted_names, nu: nu_sorted, kind: DiscoveredRxnKind::ThermalDecomposition, partners: None });
                                }
                            }
                            solved_subsets.push(idx.clone());
                        }
                    }
                    // next combination of `size` gases
                    if size == 0 {
                        break;
                    }
                    let mut i = size;
                    let mut advanced = false;
                    while i > 0 {
                        i -= 1;
                        if idx[i] != i + ng - size {
                            idx[i] += 1;
                            for j in (i + 1)..size {
                                idx[j] = idx[j - 1] + 1;
                            }
                            advanced = true;
                            break;
                        }
                    }
                    if !advanced {
                        break;
                    }
                }
            }
        }
        // Keep the pathways that are the Gibbs minimum of the products at some temperature of the bench: of all the ways a
        // solid can fall apart, the stable assemblage is the one of lowest standard Gibbs energy per mole of the solid, and
        // assemblages that are never the lowest (CH4 + O2, Na metal + carbon dioxide + oxygen, ...) are not products at any T.
        const WINDOW_K: [f64; 8] = [298.15, 400.0, 500.0, 650.0, 800.0, 1000.0, 1300.0, 1600.0];
        let mut keep = vec![false; local.len()];
        for &t in &WINDOW_K {
            let dgs: Vec<Option<f64>> = local.iter().map(|st| {
                let mol_solid = st.nu.iter().find(|(i, _)| st.species_names[*i] == *solid_sp).map(|(_, c)| c.abs()).filter(|c| *c > 0.0)?;
                reaction_thermo(&st.species_names, &st.nu, t, 101_325.0, true).map(|(_, dg)| dg / mol_solid)
            }).collect();
            let best = dgs.iter().flatten().copied().fold(f64::INFINITY, f64::min);
            for (k, dg) in dgs.iter().enumerate() {
                if let Some(dg) = dg {
                    if *dg <= best + 1_000.0 {
                        keep[k] = true;
                    }
                }
            }
        }
        discovered.extend(local.into_iter().zip(keep).filter(|(_, k)| *k).map(|(st, _)| st));
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
        // the reaction of the zinc: it consumes Zn(s) and makes Zn+2 (the candidate list holds every redox pairing of the
        // species present, most of them uphill)
        let redox_rxn = rxns.iter().find(|r| {
            matches!(r.kind, DiscoveredRxnKind::Redox { .. })
                && r.nu.iter().any(|&(i, c)| c < 0.0 && r.species_names[i] == "Zn(s)")
                && r.nu.iter().any(|&(i, c)| c > 0.0 && r.species_names[i] == "Zn+2")
        });
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
