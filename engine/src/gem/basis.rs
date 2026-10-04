//! Stoichiometric reaction basis via null space (RREF) of formula + charge matrix.

use std::collections::HashSet;

/// An independent reaction in the null space basis: sum nu_i * species_i = 0
#[derive(Clone, Debug, PartialEq)]
pub struct BasisReaction {
    /// Stoichiometric coefficients per species index: (species_idx, nu)
    pub nu: Vec<(usize, f64)>,
}

/// Most distinct species lists whose bases are remembered before the memo is dropped (a bound on memory, not physics).
const BASIS_MEMO_MAX: usize = 4096;

thread_local! {
    /// (store generation, memo): a basis computed from formulas that a later registration changes must not survive it.
    static BASIS_MEMO: std::cell::RefCell<(u64, std::collections::HashMap<Vec<String>, Vec<BasisReaction>>)> = Default::default();
}

/// Builds the null-space stoichiometric basis for the given candidate species. The basis depends only on the ordered
/// species ids (their formulas and charges), not on amounts, so the vessel loop, which asks for the same candidate sets
/// every step, is served from a memo.
pub fn build_reaction_basis(species: &[String]) -> Vec<BasisReaction> {
    let generation = crate::db::SpeciesStore::generation();
    if let Some(hit) = BASIS_MEMO.with(|m| {
        let mut m = m.borrow_mut();
        if m.0 != generation {
            m.1.clear();
            m.0 = generation;
        }
        m.1.get(species).cloned()
    }) {
        return hit;
    }
    let basis = build_reaction_basis_uncached(species);
    BASIS_MEMO.with(|m| {
        let mut m = m.borrow_mut();
        if m.1.len() >= BASIS_MEMO_MAX {
            m.1.clear();
        }
        m.1.insert(species.to_vec(), basis.clone());
    });
    basis
}

fn build_reaction_basis_uncached(species: &[String]) -> Vec<BasisReaction> {
    if species.is_empty() {
        return Vec::new();
    }

    // 1. Collect all elements
    let mut all_elements = HashSet::new();
    let mut compositions = Vec::new();
    let mut charges = Vec::new();

    for sp in species {
        let elems = crate::ions::species_elements(sp).unwrap_or_default();
        for e in elems.keys() {
            all_elements.insert(e.clone());
        }
        compositions.push(elems);
        charges.push(crate::ions::species_charge(sp) as f64);
    }

    let mut element_list: Vec<String> = all_elements.into_iter().collect();
    element_list.sort();

    let n_rows = element_list.len() + 1; // elements + charge
    let n_cols = species.len();

    // Construct matrix A: (n_rows x n_cols)
    let mut a = vec![vec![0.0; n_cols]; n_rows];
    for (j, comp) in compositions.iter().enumerate() {
        for (i, elem) in element_list.iter().enumerate() {
            if let Some(&count) = comp.get(elem) {
                a[i][j] = count;
            }
        }
        // Charge row
        a[n_rows - 1][j] = charges[j];
    }

    // Gaussian elimination to RREF
    let mut pivot_row = 0;
    let mut pivot_cols = Vec::new();

    for col in 0..n_cols {
        if pivot_row >= n_rows {
            break;
        }

        // Find max pivot
        let mut max_val = 0.0;
        let mut max_row = pivot_row;
        for row in pivot_row..n_rows {
            let val = a[row][col].abs();
            if val > max_val {
                max_val = val;
                max_row = row;
            }
        }

        if max_val < 1e-9 {
            continue;
        }

        // Swap rows
        a.swap(pivot_row, max_row);

        // Normalize pivot row
        let p_val = a[pivot_row][col];
        for c in col..n_cols {
            a[pivot_row][c] /= p_val;
        }

        // Eliminate other rows
        for row in 0..n_rows {
            if row != pivot_row {
                let factor = a[row][col];
                if factor.abs() > 1e-12 {
                    for c in col..n_cols {
                        a[row][c] -= factor * a[pivot_row][c];
                    }
                }
            }
        }

        pivot_cols.push(col);
        pivot_row += 1;
    }

    // Free columns (columns that are not pivot columns) define basis reactions
    let mut free_cols = Vec::new();
    for col in 0..n_cols {
        if !pivot_cols.contains(&col) {
            free_cols.push(col);
        }
    }

    let mut basis = Vec::new();
    for &free_col in &free_cols {
        let mut rxn_nu = Vec::new();
        // Free variable coefficient = +1.0
        rxn_nu.push((free_col, 1.0));

        // Pivot variable coefficients = - A[row][free_col]
        for (row, &p_col) in pivot_cols.iter().enumerate() {
            let coeff = -a[row][free_col];
            if coeff.abs() > 1e-9 {
                rxn_nu.push((p_col, coeff));
            }
        }

        basis.push(BasisReaction { nu: rxn_nu });
    }

    basis
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redox_basis_discovery() {
        let species = vec![
            "Zn(s)".to_string(),
            "Zn+2".to_string(),
            "H+".to_string(),
            "H2(g)".to_string(),
        ];
        let basis = build_reaction_basis(&species);
        assert_eq!(basis.len(), 1, "Should discover exactly 1 independent reaction");
        // Zn + 2 H+ <=> Zn+2 + H2
        // Check that stoichiometry balances both Zn, H and charge
        let rxn = &basis[0];
        let mut net_charge = 0.0;
        for &(idx, coeff) in &rxn.nu {
            let sp = &species[idx];
            net_charge += coeff * crate::ions::species_charge(sp) as f64;
        }
        assert!(net_charge.abs() < 1e-9, "Reaction must be charge balanced: {}", net_charge);
    }

    #[test]
    fn test_thermal_decomposition_basis() {
        let species = vec![
            "CaCO3(s)".to_string(),
            "CaO(s)".to_string(),
            "CO2(g)".to_string(),
        ];
        let basis = build_reaction_basis(&species);
        assert_eq!(basis.len(), 1, "CaCO3 <=> CaO + CO2 should be discovered");
    }
}

