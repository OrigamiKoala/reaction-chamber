//! Gibbs Energy Minimization solver.
//!
//! Uses projected Newton-Raphson on the null-space reaction extents xi to find the unique
//! global minimum of the total Gibbs free energy G(n).

use std::collections::HashMap;
use crate::physics::R_GAS;
use crate::thermo::functions::try_thermo_state;
use super::basis::build_reaction_basis;

/// Result of GEM solution
pub struct GemSolution {
    pub species_mol: HashMap<String, f64>,
    pub solid_mol: HashMap<String, f64>,
    pub converged: bool,
    pub delta_g_joules: f64,
}

/// Solves Gibbs Energy Minimization over the given species set.
pub fn solve_gem(
    initial_species: &HashMap<String, f64>,
    initial_solids: &HashMap<String, f64>,
    vol_l: f64,
    t_k: f64,
    p_pa: f64,
) -> GemSolution {
    let mut names = Vec::new();
    let mut n0 = Vec::new();
    let mut is_solid = Vec::new();

    for (sp, &mol) in initial_species {
        names.push(sp.clone());
        n0.push(mol.max(0.0));
        is_solid.push(false);
    }
    for (sp, &mol) in initial_solids {
        names.push(sp.clone());
        n0.push(mol.max(0.0));
        is_solid.push(true);
    }

    let n_species = names.len();
    if n_species == 0 {
        return GemSolution {
            species_mol: HashMap::new(),
            solid_mol: HashMap::new(),
            converged: true,
            delta_g_joules: 0.0,
        };
    }

    // Reaction basis
    let basis = build_reaction_basis(&names);
    let n_rxns = basis.len();
    if n_rxns == 0 {
        let mut final_sp = HashMap::new();
        let mut final_so = HashMap::new();
        for (i, name) in names.iter().enumerate() {
            if is_solid[i] {
                final_so.insert(name.clone(), n0[i]);
            } else {
                final_sp.insert(name.clone(), n0[i]);
            }
        }
        return GemSolution {
            species_mol: final_sp,
            solid_mol: final_so,
            converged: true,
            delta_g_joules: 0.0,
        };
    }

    // Precompute mu0 for all species
    let mut mu0 = vec![0.0; n_species];
    for (i, name) in names.iter().enumerate() {
        let phase = if is_solid[i] { "s" } else if name.ends_with("(g)") { "g" } else { "aq" };
        // a species without formation data has no chemical potential: the system cannot be minimised, so it stays as it is
        match try_thermo_state(name, phase, t_k, p_pa) {
            Some(st) => mu0[i] = st.mu0_j_mol,
            None => {
                let mut final_sp = HashMap::new();
                let mut final_so = HashMap::new();
                for (j, nm) in names.iter().enumerate() {
                    if is_solid[j] { final_so.insert(nm.clone(), n0[j]); } else { final_sp.insert(nm.clone(), n0[j]); }
                }
                return GemSolution { species_mol: final_sp, solid_mol: final_so, converged: false, delta_g_joules: 0.0 };
            }
        }
    }

    // Reaction extents xi
    let mut xi = vec![0.0; n_rxns];
    let rt = R_GAS * t_k.max(1.0);

    let get_amounts = |xi_vec: &[f64]| -> Vec<f64> {
        let mut n = n0.clone();
        for (r, rxn) in basis.iter().enumerate() {
            for &(i, coeff) in &rxn.nu {
                n[i] += coeff * xi_vec[r];
            }
        }
        n
    };

    let eval_mu = |amounts: &[f64]| -> Vec<f64> {
        let mut mu = mu0.clone();
        for i in 0..n_species {
            if !is_solid[i] && names[i] != crate::db::seed::WATER {
                // mu = mu0 + R*T*ln(c)
                let c = (amounts[i] / vol_l).max(1e-30);
                mu[i] += rt * c.ln();
            }
        }
        mu
    };

    let eval_gradient = |mu: &[f64]| -> Vec<f64> {
        let mut g = vec![0.0; n_rxns];
        for (r, rxn) in basis.iter().enumerate() {
            for &(i, coeff) in &rxn.nu {
                g[r] += coeff * mu[i];
            }
        }
        g
    };

    // Damped Newton iterations
    let mut converged = false;
    for _iter in 0..40 {
        let n = get_amounts(&xi);
        let mu = eval_mu(&n);
        let g = eval_gradient(&mu);

        let max_g = g.iter().map(|v| v.abs()).fold(0.0, f64::max);
        if max_g < 1e-4 {
            converged = true;
            break;
        }

        // Build Hessian: H_{r, s} = sum_i nu_{i,r} nu_{i,s} * (RT / n_i)
        let mut h = vec![vec![0.0; n_rxns]; n_rxns];
        for r in 0..n_rxns {
            for s in 0..n_rxns {
                let mut sum = 0.0;
                for &(i, nu_ir) in &basis[r].nu {
                    if !is_solid[i] && names[i] != crate::db::seed::WATER {
                        for &(j, nu_js) in &basis[s].nu {
                            if i == j {
                                let c = n[i].max(1e-18);
                                sum += nu_ir * nu_js * (rt / c);
                            }
                        }
                    }
                }
                h[r][s] = sum;
            }
            h[r][r] += 1e-6; // Regularization
        }

        // Solve H * d_xi = -g (using Gauss-Jordan)
        let mut aug = h.clone();
        for r in 0..n_rxns {
            aug[r].push(-g[r]);
        }

        let mut d_xi = vec![0.0; n_rxns];
        let mut ok = true;
        for i in 0..n_rxns {
            let pivot = aug[i][i];
            if pivot.abs() < 1e-12 {
                ok = false;
                break;
            }
            for j in i..=n_rxns {
                aug[i][j] /= pivot;
            }
            for row in 0..n_rxns {
                if row != i {
                    let factor = aug[row][i];
                    for col in i..=n_rxns {
                        aug[row][col] -= factor * aug[i][col];
                    }
                }
            }
        }

        if !ok {
            break;
        }

        for r in 0..n_rxns {
            d_xi[r] = aug[r][n_rxns];
        }

        // Line search: ensure positive amounts for aqueous species and solids
        let mut step = 1.0;
        for _ in 0..20 {
            let mut test_xi = xi.clone();
            for r in 0..n_rxns {
                test_xi[r] += step * d_xi[r];
            }
            let test_n = get_amounts(&test_xi);
            if test_n.iter().all(|&a| a >= -1e-12) {
                xi = test_xi;
                break;
            }
            step *= 0.5;
        }
    }

    let final_n = get_amounts(&xi);
    let mut final_sp = HashMap::new();
    let mut final_so = HashMap::new();

    for (i, name) in names.iter().enumerate() {
        let val = final_n[i].max(0.0);
        if val > 1e-18 {
            if is_solid[i] {
                final_so.insert(name.clone(), val);
            } else {
                final_sp.insert(name.clone(), val);
            }
        }
    }

    GemSolution {
        species_mol: final_sp,
        solid_mol: final_so,
        converged,
        delta_g_joules: 0.0,
    }
}
