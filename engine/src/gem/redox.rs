//! Redox chemistry: oxidation-state components, labile redox couples, and reduction potentials.
//!
//! Enforces:
//! - General calculation of element oxidation states in compounds and ions.
//! - Which elements have labile couples (data file) and the oxidation states of elements in species.
//! - Standard cell potential E0 and Nernst equation from Delta_r G0.

use std::collections::HashMap;
use crate::physics::FARADAY;

/// Standard Faraday constant in C/mol
pub const FARADAY_CONST: f64 = FARADAY;

#[derive(serde::Deserialize)]
struct LabilityFile {
    labile: Vec<String>,
}

fn labile_set() -> &'static std::collections::HashSet<String> {
    static S: std::sync::OnceLock<std::collections::HashSet<String>> = std::sync::OnceLock::new();
    S.get_or_init(|| serde_json::from_str::<LabilityFile>(include_str!("../../data/redox_lability.json")).expect("data/redox_lability.json").labile.into_iter().collect())
}

/// Whether the common aqueous couples of an element exchange electrons on bench time scales (`data/redox_lability.json`).
/// Couples of other elements react only through a registered kinetic row or a record that gives them a self-exchange rate.
pub fn is_labile_redox_element(elem: &str) -> bool {
    labile_set().contains(elem)
}

/// Whether a couple of two forms of one element can take part in discovered electron transfer: the element is labile, or
/// a species record carries a self-exchange rate for the couple (data overrides the class default).
pub fn couple_is_eligible(elem: &str, a: &str, b: &str) -> bool {
    is_labile_redox_element(elem) || crate::gem::rates::self_exchange_k(a, b).1
}

/// Pauling electronegativity of the non-metals whose oxidation state is set by their position in the periodic table
/// (the anion-forming elements), with the oxidation state they take as the more electronegative partner of a compound.
const ANION_FORMERS: &[(&str, f64, i32)] = &[
    ("F", 3.98, -1),
    ("O", 3.44, -2),
    ("N", 3.04, -3),
    ("Cl", 3.16, -1),
    ("Br", 2.96, -1),
    ("S", 2.58, -2),
    ("Se", 2.55, -2),
    ("C", 2.55, -4),
    ("I", 2.66, -1),
    ("P", 2.19, -3),
    ("As", 2.18, -3),
    ("B", 2.04, -3),
    ("Si", 1.90, -4),
];

/// Oxidation state an element takes by the bonding rules that need no structure: fluorine -1, alkali metals +1, alkaline
/// earths +2, aluminium +3, hydrogen +1 (with non-metals), zinc +2, silver +1.
fn fixed_state(elem: &str) -> Option<i32> {
    match elem {
        "F" => Some(-1),
        "Li" | "Na" | "K" | "Rb" | "Cs" | "Ag" | "H" => Some(1),
        "Be" | "Mg" | "Ca" | "Sr" | "Ba" | "Zn" => Some(2),
        "Al" => Some(3),
        _ => None,
    }
}

/// Determines the oxidation states of elements in a species id.
///
/// Returns a map of element symbol -> integer oxidation state (the average over the atoms of the element). Fixed states
/// are assigned first; oxygen is -2 unless every other element is fixed (then charge balance decides, so H2O2 and the
/// alkali peroxides give -1); the remaining elements are ordered by electronegativity: every one more electronegative
/// than the least electronegative takes its anionic state (N -3, S -2, Cl -1, ...) and the least electronegative one
/// closes the charge balance. The result never depends on hash order.
pub fn determine_oxidation_states(species: &str) -> HashMap<String, i32> {
    determine_oxidation_states_exact(species).into_iter().map(|(e, ox)| (e, ox.round() as i32)).collect()
}

/// `determine_oxidation_states` without the rounding: the average oxidation state of the atoms of each element, which is
/// fractional for an element whose atoms differ (the carbons of hydroquinone average -1/3, of benzoquinone 0: the couple
/// is two electrons apart although both round to 0).
pub fn determine_oxidation_states_exact(species: &str) -> HashMap<String, f64> {
    thread_local! {
        static MEMO: std::cell::RefCell<(u64, HashMap<String, HashMap<String, f64>>)> = std::cell::RefCell::new((0, HashMap::new()));
    }
    // the answer depends on the species store (the ion split below looks records up): memoised per store generation
    let generation = crate::db::SpeciesStore::generation();
    if let Some(hit) = MEMO.with(|m| {
        let mut m = m.borrow_mut();
        if m.0 != generation {
            m.0 = generation;
            m.1.clear();
        }
        m.1.get(species).cloned()
    }) {
        return hit;
    }
    let out = oxidation_states_uncached(species);
    MEMO.with(|m| {
        let mut m = m.borrow_mut();
        if m.1.len() > 20_000 {
            m.1.clear();
        }
        m.1.insert(species.to_string(), out.clone());
    });
    out
}

/// A species made of one metal cation and a known anion (an ion pair or hydroxo complex: FeSO4, FeOH+2, CrSO4+) has the
/// metal in the oxidation state of the cation it was formed from, and the anion's elements in the anion's own states: the
/// electronegativity rule alone would give the sulfur of FeSO4 the state of a sulfide and the iron +10.
fn oxidation_states_by_ion_split(species: &str, charge: i32, elements: &HashMap<String, f64>) -> Option<HashMap<String, f64>> {
    let metals: Vec<&String> = elements.iter().filter(|(e, n)| **n == 1.0 && e.as_str() != "H" && e.as_str() != "O" && crate::compound_thermo::is_metal_element(e)).map(|(e, _)| e).collect();
    if metals.len() != 1 || elements.len() < 2 {
        return None;
    }
    let m = metals[0];
    let mut rest = elements.clone();
    rest.remove(m);
    let store = crate::db::SpeciesStore::try_global()?;
    let mut found: Option<(i32, String)> = None;
    {
        let guard = store.read().ok()?;
        for z in 1..=6i32 {
            let cation = if z == 1 { format!("{}+", m) } else { format!("{}+{}", m, z) };
            if guard.get(&cation).is_none() {
                continue;
            }
            let rem_charge = charge - z;
            // the remainder must be a species of the store with exactly these atoms and this charge
            let rem = guard.iter().find(|r| {
                r.identity.charge == rem_charge && crate::ions::parse_formula_strict(crate::ions::split_charge(&r.identity.formula).0).map_or(false, |e| e == rest)
            });
            if let Some(r) = rem {
                found = Some((z, r.id.clone()));
                break;
            }
        }
    }
    let (z, rem_id) = found?;
    let mut states = determine_oxidation_states_exact(&rem_id);
    states.insert(m.clone(), z as f64);
    let _ = species;
    Some(states)
}

/// True for an ion pair or hydroxo / chloro complex of one metal cation and a known anion (FeSO4+, FeOH+2, HgCl+, CrSO4+): a
/// form of the free cation that the association and hydrolysis rows keep in equilibrium with it. Redox discovery works on the
/// free cation and the speciation follows; pairing every such form with every other made hundreds of redundant reactions that
/// all relax toward one shared equilibrium.
pub fn is_derived_ion_form(species: &str) -> bool {
    let elements = crate::ions::species_elements(species).unwrap_or_default();
    elements.len() > 1 && oxidation_states_by_ion_split(species, crate::ions::species_charge(species), &elements).is_some()
}

fn oxidation_states_uncached(species: &str) -> HashMap<String, f64> {
    let mut states: HashMap<String, f64> = HashMap::new();
    let charge = crate::ions::species_charge(species);
    let elements = crate::ions::species_elements(species).unwrap_or_default();
    if elements.is_empty() {
        return states;
    }
    if elements.len() > 1 {
        if let Some(split) = oxidation_states_by_ion_split(species, charge, &elements) {
            return split;
        }
    }

    // Single element species: the charge is shared by its atoms
    if elements.len() == 1 {
        let (elem, &count) = elements.iter().next().unwrap();
        let ox = if count > 0.0 { charge as f64 / count } else { 0.0 };
        states.insert(elem.clone(), ox);
        return states;
    }

    let mut names: Vec<&String> = elements.keys().collect();
    names.sort();
    let others_fixed = names.iter().all(|e| e.as_str() == "O" || fixed_state(e).is_some());
    let mut fixed_sum = 0.0;
    let mut open: Vec<(&String, f64)> = Vec::new();
    for e in &names {
        let count = elements[*e];
        let fixed = if e.as_str() == "O" {
            if others_fixed { None } else { Some(-2) }
        } else {
            fixed_state(e)
        };
        match fixed {
            Some(ox) => {
                states.insert((*e).clone(), ox as f64);
                fixed_sum += ox as f64 * count;
            }
            None => open.push((*e, count)),
        }
    }
    // order the open elements: most electronegative first (unknown elements, the metals, last)
    let en = |e: &str| ANION_FORMERS.iter().find(|(x, _, _)| *x == e).map_or(0.0, |(_, v, _)| *v);
    open.sort_by(|a, b| en(b.0).partial_cmp(&en(a.0)).unwrap_or(std::cmp::Ordering::Equal).then(a.0.cmp(b.0)));
    if let Some(((last_el, last_count), rest)) = open.split_last().map(|(l, r)| (*l, r)) {
        let mut sum = fixed_sum;
        for (e, count) in rest {
            // an electronegative element takes its anionic state; one that is not an anion former defaults to 0
            let ox = ANION_FORMERS.iter().find(|(x, _, _)| *x == e.as_str()).map_or(0, |(_, _, o)| *o);
            states.insert((*e).clone(), ox as f64);
            sum += ox as f64 * count;
        }
        if last_count > 0.0 {
            states.insert(last_el.clone(), (charge as f64 - sum) / last_count);
        }
    }
    states
}

/// Computes the standard cell reduction potential E0 in Volts for a redox reaction:
/// E0 = - Delta_r G0 / (z * F)
pub fn redox_standard_potential(
    reactants: &HashMap<String, f64>,
    products: &HashMap<String, f64>,
    z_electrons: f64,
    t_k: f64,
    p_pa: f64,
) -> f64 {
    if z_electrons <= 0.0 {
        return 0.0;
    }
    let dg = crate::thermo::functions::delta_r_g0(reactants, products, t_k, p_pa);
    -dg / (z_electrons * FARADAY_CONST)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Evaluates Daniell cell EMF (Zn(s) + Cu+2 -> Zn+2 + Cu(s)) from standard Gibbs free energies.
    pub fn daniell_cell_potential(t_k: f64, p_pa: f64) -> f64 {
        let mut reactants = HashMap::new();
        reactants.insert("Zn(s)".to_string(), 1.0);
        reactants.insert("Cu+2".to_string(), 1.0);

        let mut products = HashMap::new();
        products.insert("Zn+2".to_string(), 1.0);
        products.insert("Cu(s)".to_string(), 1.0);

        redox_standard_potential(&reactants, &products, 2.0, t_k, p_pa)
    }

    #[test]
    fn test_oxidation_states() {
        assert_eq!(determine_oxidation_states("Fe+3").get("Fe"), Some(&3));
        assert_eq!(determine_oxidation_states("Fe+2").get("Fe"), Some(&2));
        assert_eq!(determine_oxidation_states("Fe(s)").get("Fe"), Some(&0));
        assert_eq!(determine_oxidation_states("MnO4-").get("Mn"), Some(&7));
        assert_eq!(determine_oxidation_states("SO4-2").get("S"), Some(&6));
        assert_eq!(determine_oxidation_states("H2S(aq)").get("S"), Some(&-2));
        assert_eq!(determine_oxidation_states("Al(OH)4-").get("Al"), Some(&3));
    }

    #[test]
    fn test_daniell_potential() {
        let e0 = daniell_cell_potential(298.15, 101325.0);
        assert!((e0 - 1.10).abs() <= 0.02, "Daniell E0 must be within 0.02 V of 1.10 V: got {}", e0);
    }
}
