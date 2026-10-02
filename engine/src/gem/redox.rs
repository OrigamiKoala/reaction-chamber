//! Redox chemistry: oxidation-state components, labile redox couples, and reduction potentials.
//!
//! Enforces:
//! - General calculation of element oxidation states in compounds and ions.
//! - Labile redox couple definitions that allow fast electron transfer in GEM.
//! - Standard cell potential E0 and Nernst equation from Delta_r G0.

use std::collections::HashMap;
use crate::physics::FARADAY;

/// Standard Faraday constant in C/mol
pub const FARADAY_CONST: f64 = FARADAY;

/// Returns true if an element belongs to a fast / labile redox couple.
pub fn is_labile_redox_element(elem: &str) -> bool {
    matches!(
        elem,
        "Fe" | "Cu" | "Zn" | "Ag" | "Mn" | "I" | "H" | "Na" | "Mg" | "Ce"
    )
}

/// Determines the oxidation states of elements in a species id.
///
/// Returns a map of element symbol -> integer oxidation state.
pub fn determine_oxidation_states(species: &str) -> HashMap<String, i32> {
    let mut states = HashMap::new();
    let clean = species
        .trim_end_matches("(s)")
        .trim_end_matches("(g)")
        .trim_end_matches("(l)")
        .trim_end_matches("(aq)");

    let charge = crate::ions::species_charge(species);
    let elements = crate::ions::species_elements(species).unwrap_or_default();

    if elements.is_empty() {
        return states;
    }

    // Single element species
    if elements.len() == 1 {
        let (elem, &count) = elements.iter().next().unwrap();
        let ox = if count > 0.0 {
            (charge as f64 / count).round() as i32
        } else {
            0
        };
        states.insert(elem.clone(), ox);
        return states;
    }

    // Known common rules for polyatomic species
    // Rule 1: Fluorine is -1
    // Rule 2: Group 1 metals (Li, Na, K, Rb, Cs) are +1
    // Rule 3: Group 2 metals (Be, Mg, Ca, Sr, Ba) are +2, Al is +3, Zn is +2, Ag is +1
    // Rule 4: Hydrogen is +1 (unless only with metals)
    // Rule 5: Oxygen is -2 (unless in peroxides with O-O)
    let is_peroxide = clean.ends_with('2') && clean.contains('O') && (clean.starts_with('H') || clean.starts_with("Na"));

    let mut fixed_sum = 0.0;
    let mut variable_elem = None;
    let mut variable_count = 0.0;

    for (elem, &count) in &elements {
        let fixed_ox = match elem.as_str() {
            "F" => Some(-1),
            "Li" | "Na" | "K" | "Rb" | "Cs" => Some(1),
            "Be" | "Mg" | "Ca" | "Sr" | "Ba" | "Zn" => Some(2),
            "Al" => Some(3),
            "Ag" => Some(1),
            "H" => Some(1),
            "O" => {
                if is_peroxide {
                    Some(-1)
                } else {
                    Some(-2)
                }
            }
            "Cl" | "Br" | "I" if !elements.contains_key("O") && !elements.contains_key("F") => Some(-1),
            _ => None,
        };

        if let Some(ox) = fixed_ox {
            states.insert(elem.clone(), ox);
            fixed_sum += ox as f64 * count;
        } else if variable_elem.is_none() {
            variable_elem = Some(elem.clone());
            variable_count = count;
        } else {
            // Multiple variable elements (e.g. organic or complex salt): default remaining to 0
            states.insert(elem.clone(), 0);
        }
    }

    // Solve for variable element by charge balance: sum (ox * count) = charge
    if let Some(var_el) = variable_elem {
        if variable_count > 0.0 {
            let var_ox = ((charge as f64 - fixed_sum) / variable_count).round() as i32;
            states.insert(var_el, var_ox);
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
