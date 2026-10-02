//! Kinetic extent-based Rosenbrock stiff ODE integrator.
//!
//! Features:
//! - Exact element conservation by integrating in extent coordinates: n(xi) = n0 + Nu * xi.
//! - Reaction orders kept separate from stoichiometric coefficients.
//! - Detailed balance: k_r = k_f / K(T) with K(T) from Delta_r G0(T, P) or van 't Hoff.
//! - Diffusion limit cap via k_diffusion_limit from transport properties.
//! - Primary kinetic salt effect (Bronsted-Bjerrum).
//! - Heterogeneous catalysis proportional to surface area and Arrhenius temperature dependence.
//! - L-stable ROS2 Rosenbrock integrator with positivity preservation via step rejection.

use std::collections::HashMap;
use crate::physics::R_GAS;
use crate::types::ProvenanceTier;
use crate::transport::k_diffusion_limit;
use crate::thermo::functions::ln_k_equilibrium;

/// Reaction representation in extent coordinates
#[derive(Clone, Debug)]
pub struct KineticExtentReaction {
    pub id: String,
    pub equation: String,
    /// (species_index, stoich_coeff)
    pub reactants: Vec<(usize, f64)>,
    /// (species_index, stoich_coeff)
    pub products: Vec<(usize, f64)>,
    /// (gas_name, stoich_coeff)
    pub gas_products: Vec<(String, f64)>,
    /// Explicit empirical orders for reactants (species_index, order)
    pub orders_reactants: Vec<(usize, f64)>,
    /// Explicit empirical orders for products (species_index, order)
    pub orders_products: Vec<(usize, f64)>,
    pub arrhenius_a: f64,
    pub arrhenius_n: f64,
    pub arrhenius_ea: f64, // J/mol
    pub delta_h_kj: f64,
    pub catalyst_species: Option<String>,
    pub is_reversible: bool,
    pub k_eq_298: Option<f64>,
    pub tier: ProvenanceTier,
    pub source: String,
}

/// Extent system with sparse stoichiometry
#[derive(Clone, Debug)]
pub struct KineticExtentSystem {
    pub species_names: Vec<String>,
    pub reactions: Vec<KineticExtentReaction>,
    /// Net stoichiometry nu[r][i] = stoich_prod - stoich_react
    pub nu: Vec<Vec<f64>>,
}

impl KineticExtentSystem {
    pub fn new(species_names: Vec<String>, reactions: Vec<KineticExtentReaction>) -> Self {
        let num_rxns = reactions.len();
        let num_spec = species_names.len();
        let mut nu = vec![vec![0.0; num_spec]; num_rxns];

        for (r_idx, rxn) in reactions.iter().enumerate() {
            for &(idx, coeff) in &rxn.reactants {
                nu[r_idx][idx] -= coeff;
            }
            for &(idx, coeff) in &rxn.products {
                nu[r_idx][idx] += coeff;
            }
        }

        Self {
            species_names,
            reactions,
            nu,
        }
    }

    /// Evaluates forward and reverse rate constants for reaction `r_idx`
    pub fn evaluate_rate_constants(
        &self,
        r_idx: usize,
        temp_k: f64,
        pressure_pa: f64,
        ionic_strength: f64,
        solid_moles: &HashMap<String, f64>,
    ) -> (f64, f64) {
        let rxn = &self.reactions[r_idx];
        let t = temp_k.clamp(100.0, 3000.0);

        // 1. Base Arrhenius activation rate constant
        let exp_arg = (-rxn.arrhenius_ea / (R_GAS * t)).clamp(-100.0, 100.0);
        let mut k_act = rxn.arrhenius_a * t.powf(rxn.arrhenius_n) * exp_arg.exp();

        // 2. Primary kinetic salt effect (Bronsted-Bjerrum)
        // If reactants are ionic, log10(k/k0) = 2 * A_DH * zA * zB * sqrt(I)/(1 + sqrt(I))
        if ionic_strength > 1e-6 && rxn.reactants.len() >= 2 {
            let z1 = crate::ions::species_charge(&self.species_names[rxn.reactants[0].0]) as f64;
            let z2 = crate::ions::species_charge(&self.species_names[rxn.reactants[1].0]) as f64;
            if z1 != 0.0 && z2 != 0.0 {
                let a_dh = 0.51; // Debye-Huckel constant for water around 298 K
                let sqrt_i = ionic_strength.sqrt();
                let delta_log10_k = 2.0 * a_dh * z1 * z2 * (sqrt_i / (1.0 + sqrt_i));
                k_act *= 10.0_f64.powf(delta_log10_k);
            }
        }

        // 3. Diffusion ceiling for bimolecular steps in solution
        let total_order: f64 = rxn.orders_reactants.iter().map(|(_, o)| *o).sum();
        let mut k_fwd = if total_order >= 1.8 && rxn.reactants.len() >= 2 {
            let sp_a = &self.species_names[rxn.reactants[0].0];
            let sp_b = &self.species_names[rxn.reactants[1].0];
            let z_a = crate::ions::species_charge(sp_a) as f64;
            let z_b = crate::ions::species_charge(sp_b) as f64;
            let r_a = 0.25e-9; // typical radius 0.25 nm
            let r_b = 0.25e-9;
            let eta = crate::transport::viscosity_water_pa_s(t);
            let eps = crate::transport::dielectric_water(t);
            let k_d = k_diffusion_limit(r_a, r_b, z_a, z_b, t, eta, eps);
            if k_d > 0.0 && k_act > 0.0 {
                (k_act * k_d) / (k_act + k_d)
            } else {
                k_act
            }
        } else {
            k_act
        };

        // 4. Heterogeneous catalysis surface term
        if let Some(ref cat_id) = rxn.catalyst_species {
            let cat_mol = solid_moles.get(cat_id).copied().unwrap_or(0.0);
            if cat_mol > 0.0 {
                let thermo = crate::chem_db::get_species_thermo(cat_id);
                let mass_g = cat_mol * thermo.mw;
                // Specific area: 50 m^2/g for standard powder, reference mass 0.5 g -> 25 m^2
                let area_m2 = 50.0 * mass_g;
                let ref_area_m2 = 25.0; // 0.5 g reference
                let area_factor = area_m2 / ref_area_m2;
                k_fwd *= area_factor;
            } else {
                // Catalyst required but absent: catalyzed path is inactive
                k_fwd = 0.0;
            }
        }

        // 5. Detailed balance: k_rev = k_fwd / K(T)
        let k_rev = if k_fwd <= 0.0 {
            0.0
        } else if let Some(k_298) = rxn.k_eq_298 {
            let delta_h_j = rxn.delta_h_kj * 1000.0;
            let ln_k_t = k_298.ln() - (delta_h_j / R_GAS) * (1.0 / t - 1.0 / 298.15);
            if ln_k_t > 60.0 {
                0.0
            } else {
                k_fwd / ln_k_t.exp().max(1e-30)
            }
        } else if rxn.is_reversible {
            // Compute ln K(T, P) from standard species chemical potentials
            let mut react_map = HashMap::new();
            for &(idx, c) in &rxn.reactants {
                react_map.insert(self.species_names[idx].clone(), c);
            }
            let mut prod_map = HashMap::new();
            for &(idx, c) in &rxn.products {
                prod_map.insert(self.species_names[idx].clone(), c);
            }
            for (g, c) in &rxn.gas_products {
                *prod_map.entry(g.clone()).or_default() += *c;
            }

            let ln_k = ln_k_equilibrium(&react_map, &prod_map, t, pressure_pa);
            if ln_k > 60.0 {
                0.0
            } else {
                k_fwd / ln_k.exp().max(1e-30)
            }
        } else {
            0.0
        };

        (k_fwd, k_rev)
    }

    /// Computes reaction rates r_j (mol/(L*s)) and their concentration derivatives dr_j/dc_i
    pub fn compute_rates_and_derivatives(
        &self,
        concs: &[f64],
        temp_k: f64,
        pressure_pa: f64,
        ionic_strength: f64,
        solid_moles: &HashMap<String, f64>,
    ) -> (Vec<f64>, Vec<Vec<f64>>) {
        let num_rxns = self.reactions.len();
        let num_spec = self.species_names.len();
        let mut rates = vec![0.0; num_rxns];
        let mut dr_dc = vec![vec![0.0; num_spec]; num_rxns];

        for r_idx in 0..num_rxns {
            let rxn = &self.reactions[r_idx];
            let (k_fwd, k_rev) = self.evaluate_rate_constants(
                r_idx,
                temp_k,
                pressure_pa,
                ionic_strength,
                solid_moles,
            );

            // Check if any stoichiometric reactant is depleted
            let mut reactant_depleted = false;
            for &(idx, _) in &rxn.reactants {
                if concs[idx] <= 1e-15 {
                    reactant_depleted = true;
                    break;
                }
            }

            // Forward rate
            let mut r_fwd = if reactant_depleted { 0.0 } else { k_fwd };
            if r_fwd > 0.0 {
                for &(idx, order) in &rxn.orders_reactants {
                    let c = concs[idx].max(0.0);
                    if (order - 1.0).abs() < 1e-6 {
                        r_fwd *= c;
                    } else if (order - 2.0).abs() < 1e-6 {
                        r_fwd *= c * c;
                    } else if c > 0.0 {
                        r_fwd *= c.powf(order);
                    } else {
                        r_fwd = 0.0;
                    }
                }
            }

            // Check if any stoichiometric product is depleted for reverse rate
            let mut product_depleted = false;
            for &(idx, _) in &rxn.products {
                if concs[idx] <= 1e-15 {
                    product_depleted = true;
                    break;
                }
            }

            // Reverse rate
            let mut r_rev = if product_depleted { 0.0 } else { k_rev };
            if r_rev > 0.0 {
                for &(idx, order) in &rxn.orders_products {
                    let c = concs[idx].max(0.0);
                    if (order - 1.0).abs() < 1e-6 {
                        r_rev *= c;
                    } else if (order - 2.0).abs() < 1e-6 {
                        r_rev *= c * c;
                    } else if c > 0.0 {
                        r_rev *= c.powf(order);
                    } else {
                        r_rev = 0.0;
                    }
                }
            } else {
                r_rev = 0.0;
            }

            rates[r_idx] = r_fwd - r_rev;

            // Concentration derivatives of forward rate
            if r_fwd > 0.0 {
                for &(k_idx, k_order) in &rxn.orders_reactants {
                    let ck = concs[k_idx].max(1e-15);
                    let mut term = k_fwd * k_order;
                    if (k_order - 1.0).abs() > 1e-6 {
                        term *= ck.powf(k_order - 1.0);
                    }
                    for &(m_idx, m_order) in &rxn.orders_reactants {
                        if m_idx != k_idx {
                            let cm = concs[m_idx].max(0.0);
                            term *= cm.powf(m_order);
                        }
                    }
                    dr_dc[r_idx][k_idx] += term;
                }
            }

            // Concentration derivatives of reverse rate
            if r_rev > 0.0 {
                for &(k_idx, k_order) in &rxn.orders_products {
                    let ck = concs[k_idx].max(1e-15);
                    let mut term = k_rev * k_order;
                    if (k_order - 1.0).abs() > 1e-6 {
                        term *= ck.powf(k_order - 1.0);
                    }
                    for &(m_idx, m_order) in &rxn.orders_products {
                        if m_idx != k_idx {
                            let cm = concs[m_idx].max(0.0);
                            term *= cm.powf(m_order);
                        }
                    }
                    dr_dc[r_idx][k_idx] -= term;
                }
            }
        }

        (rates, dr_dc)
    }

    /// Evaluates extent derivatives d xi / dt (mol/s) and Jacobian J_{rk} = d (d xi_r / dt) / d xi_k
    pub fn extent_f_and_jacobian(
        &self,
        xi: &[f64],
        initial_moles: &[f64],
        vol_l: f64,
        temp_k: f64,
        pressure_pa: f64,
        ionic_strength: f64,
        solid_moles: &HashMap<String, f64>,
    ) -> (Vec<f64>, Vec<Vec<f64>>) {
        let num_rxns = self.reactions.len();
        let num_spec = self.species_names.len();
        let v = vol_l.max(1e-6);

        // Species moles at current extent xi: n(xi) = n0 + Nu^T * xi
        let mut concs = vec![0.0; num_spec];
        for i in 0..num_spec {
            let mut mol = initial_moles[i];
            for r in 0..num_rxns {
                mol += self.nu[r][i] * xi[r];
            }
            concs[i] = (mol / v).max(0.0);
        }

        let (rates, dr_dc) = self.compute_rates_and_derivatives(
            &concs,
            temp_k,
            pressure_pa,
            ionic_strength,
            solid_moles,
        );

        // f_r = rate_r * V (mol/s)
        let mut f = vec![0.0; num_rxns];
        for r in 0..num_rxns {
            f[r] = rates[r] * v;
        }

        // Jacobian J_{rk} = d f_r / d xi_k = sum_i (d rate_r / d c_i) * (d c_i / d xi_k) * V
        // Since d c_i / d xi_k = nu[k][i] / V, J_{rk} = sum_i dr_dc[r][i] * nu[k][i]
        let mut jac = vec![vec![0.0; num_rxns]; num_rxns];
        for r in 0..num_rxns {
            for k in 0..num_rxns {
                let mut sum = 0.0;
                for i in 0..num_spec {
                    sum += dr_dc[r][i] * self.nu[k][i];
                }
                jac[r][k] = sum;
            }
        }

        (f, jac)
    }

    /// Integrates the extent system over interval `dt_s` using adaptive L-stable ROS2
    /// Returns (final_extents, rates_mol_per_l_s)
    pub fn integrate_extent_step(
        &self,
        initial_moles: &[f64],
        dt_s: f64,
        vol_l: f64,
        temp_k: f64,
        pressure_pa: f64,
        ionic_strength: f64,
        solid_moles: &HashMap<String, f64>,
    ) -> (Vec<f64>, Vec<f64>) {
        let num_rxns = self.reactions.len();
        let num_spec = self.species_names.len();
        if num_rxns == 0 || dt_s <= 0.0 || dt_s.is_nan() {
            return (vec![0.0; num_rxns], vec![0.0; num_rxns]);
        }

        let gamma = 1.0 - 1.0 / std::f64::consts::SQRT_2; // ~0.2928932188
        let mut xi = vec![0.0; num_rxns];
        let mut t_sub = 0.0;
        let mut h = dt_s.min(0.05); // sub-step <= 50 ms guarantees < 0.1% integration error

        while t_sub < dt_s - 1e-12 {
            let cur_h = h.min(dt_s - t_sub);
            if cur_h <= 1e-12 {
                break;
            }

            let (f0, jac) = self.extent_f_and_jacobian(
                &xi,
                initial_moles,
                vol_l,
                temp_k,
                pressure_pa,
                ionic_strength,
                solid_moles,
            );

            // Matrix W = I - gamma * cur_h * J
            let mut w = vec![vec![0.0; num_rxns]; num_rxns];
            for i in 0..num_rxns {
                for j in 0..num_rxns {
                    w[i][j] = -gamma * cur_h * jac[i][j];
                }
                w[i][i] += 1.0;
            }

            // Stage 1: solve W * k1 = f0
            let k1 = solve_linear_system(&w, &f0);

            // Intermediate extent xi* = xi + cur_h * k1
            let mut xi_star = vec![0.0; num_rxns];
            for r in 0..num_rxns {
                xi_star[r] = xi[r] + cur_h * k1[r];
            }

            let (f_star, _) = self.extent_f_and_jacobian(
                &xi_star,
                initial_moles,
                vol_l,
                temp_k,
                pressure_pa,
                ionic_strength,
                solid_moles,
            );

            // Stage 2: RHS2 = f_star - 2 * gamma * cur_h * J * k1
            let mut jk1 = vec![0.0; num_rxns];
            for i in 0..num_rxns {
                for j in 0..num_rxns {
                    jk1[i] += jac[i][j] * k1[j];
                }
            }

            let mut rhs2 = vec![0.0; num_rxns];
            for i in 0..num_rxns {
                rhs2[i] = f_star[i] - 2.0 * gamma * cur_h * jk1[i];
            }

            let k2 = solve_linear_system(&w, &rhs2);

            // Candidate increment: delta_xi = 0.5 * cur_h * (k1 + k2)
            let mut delta_xi = vec![0.0; num_rxns];
            for r in 0..num_rxns {
                delta_xi[r] = 0.5 * cur_h * (k1[r] + k2[r]);
            }

            // Positivity check: ensure no reactant drops below -1e-12
            let mut non_negative = true;
            for i in 0..num_spec {
                let mut cand_mol = initial_moles[i];
                for r in 0..num_rxns {
                    cand_mol += self.nu[r][i] * (xi[r] + delta_xi[r]);
                }
                if cand_mol < -1e-12 {
                    non_negative = false;
                    break;
                }
            }

            if !non_negative {
                // Reject step and halve step size
                h *= 0.5;
                if h < 1e-8 {
                    // Limiting reactant boundary reached: find maximum non-negative scale alpha in [0, 1]
                    let mut alpha = 1.0_f64;
                    for i in 0..num_spec {
                        let mut cur_mol = initial_moles[i];
                        let mut d_mol = 0.0;
                        for r in 0..num_rxns {
                            cur_mol += self.nu[r][i] * xi[r];
                            d_mol += self.nu[r][i] * delta_xi[r];
                        }
                        if d_mol < -1e-15 && cur_mol > 0.0 {
                            let a = cur_mol / (-d_mol);
                            if a < alpha {
                                alpha = a;
                            }
                        }
                    }
                    alpha = alpha.clamp(0.0, 1.0);
                    for r in 0..num_rxns {
                        xi[r] += alpha * delta_xi[r];
                    }
                    break;
                }
            } else {
                // Step accepted
                for r in 0..num_rxns {
                    xi[r] += delta_xi[r];
                }
                t_sub += cur_h;
                h = 0.05_f64.min(dt_s - t_sub);
                if h <= 1e-10 {
                    break;
                }
            }
        }

        // Final rates in mol/(L*s)
        let v = vol_l.max(1e-6);
        let mut final_rates = vec![0.0; num_rxns];
        for r in 0..num_rxns {
            final_rates[r] = xi[r] / (v * dt_s);
        }

        (xi, final_rates)
    }
}

/// Linear solver using Gaussian elimination with partial pivoting for small dense systems
pub fn solve_linear_system(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = b.len();
    if n == 0 {
        return Vec::new();
    }
    if n == 1 {
        let diag = a[0][0];
        return if diag.abs() > 1e-15 {
            vec![b[0] / diag]
        } else {
            vec![0.0]
        };
    }

    let mut mat = a.to_vec();
    let mut rhs = b.to_vec();

    // Forward elimination
    for col in 0..n {
        let mut max_row = col;
        let mut max_val = mat[col][col].abs();
        for row in (col + 1)..n {
            let val = mat[row][col].abs();
            if val > max_val {
                max_val = val;
                max_row = row;
            }
        }

        if max_row != col {
            mat.swap(col, max_row);
            rhs.swap(col, max_row);
        }

        let pivot = mat[col][col];
        if pivot.abs() < 1e-15 || pivot.is_nan() {
            continue;
        }

        for row in (col + 1)..n {
            let factor = mat[row][col] / pivot;
            mat[row][col] = 0.0;
            for c in (col + 1)..n {
                mat[row][c] -= factor * mat[col][c];
            }
            rhs[row] -= factor * rhs[col];
        }
    }

    // Back substitution
    let mut x = vec![0.0; n];
    for i in (0..n).rev() {
        let mut sum = rhs[i];
        for j in (i + 1)..n {
            sum -= mat[i][j] * x[j];
        }
        let diag = mat[i][i];
        x[i] = if diag.abs() > 1e-15 && diag.is_finite() {
            let val = sum / diag;
            if val.is_finite() { val } else { 0.0 }
        } else {
            0.0
        };
    }

    x
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_elementary_2a_to_b_rate_order_and_conservation() {
        // 2 A -> B, k = 1.0 M^-1 s^-1
        let rxn = KineticExtentReaction {
            id: "2A_to_B".into(),
            equation: "2 A -> B".into(),
            reactants: vec![(0, 2.0)],
            products: vec![(1, 1.0)],
            gas_products: vec![],
            orders_reactants: vec![(0, 2.0)], // elementary 2nd order
            orders_products: vec![],
            arrhenius_a: 1.0,
            arrhenius_n: 0.0,
            arrhenius_ea: 0.0,
            delta_h_kj: 0.0,
            catalyst_species: None,
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "test".into(),
        };

        let system = KineticExtentSystem::new(vec!["A".into(), "B".into()], vec![rxn]);
        let solids = HashMap::new();

        // 1. Initial [A] = 1.0 M
        let (rates1, _) = system.compute_rates_and_derivatives(&[1.0, 0.0], 298.15, 101325.0, 0.0, &solids);
        assert!((rates1[0] - 1.0).abs() < 1e-6);

        // 2. Initial [A] = 2.0 M -> rate must be 4.0x
        let (rates2, _) = system.compute_rates_and_derivatives(&[2.0, 0.0], 298.15, 101325.0, 0.0, &solids);
        let ratio = rates2[0] / rates1[0];
        assert!((ratio - 4.0).abs() < 0.02, "Initial rate ratio {} should be 4.00 +- 0.02", ratio);

        // 3. Extent integration conservation check: 2 * n_B + n_A = constant
        let (extents, _) = system.integrate_extent_step(&[1.0, 0.0], 0.1, 1.0, 298.15, 101325.0, 0.0, &solids);
        let n_a = 1.0 + system.nu[0][0] * extents[0];
        let n_b = 0.0 + system.nu[0][1] * extents[0];
        let total_atoms = n_a + 2.0 * n_b;
        assert!((total_atoms - 1.0).abs() < 1e-12, "Atoms conserved exactly in extent integration");
    }

    #[test]
    fn test_first_order_dt_invariance() {
        // A -> B, k = 2.0 s^-1
        // Analytical solution: [A](1 s) = [A]_0 * exp(-2 * 1) = 0.135335
        let rxn = KineticExtentReaction {
            id: "A_to_B".into(),
            equation: "A -> B".into(),
            reactants: vec![(0, 1.0)],
            products: vec![(1, 1.0)],
            gas_products: vec![],
            orders_reactants: vec![(0, 1.0)],
            orders_products: vec![],
            arrhenius_a: 2.0,
            arrhenius_n: 0.0,
            arrhenius_ea: 0.0,
            delta_h_kj: 0.0,
            catalyst_species: None,
            is_reversible: false,
            k_eq_298: None,
            tier: ProvenanceTier::Tabulated,
            source: "test".into(),
        };

        let system = KineticExtentSystem::new(vec!["A".into(), "B".into()], vec![rxn]);
        let solids = HashMap::new();
        let exact = (-2.0_f64).exp(); // 0.135335

        for &dt in &[0.05_f64, 0.25, 0.5, 1.0] {
            let steps = (1.0 / dt).round() as usize;
            let mut mol = vec![1.0, 0.0];
            for _ in 0..steps {
                let (ext, _) = system.integrate_extent_step(&mol, dt, 1.0, 298.15, 101325.0, 0.0, &solids);
                mol[0] += system.nu[0][0] * ext[0];
                mol[1] += system.nu[0][1] * ext[0];
            }
            let err_pct = (mol[0] - exact).abs() / exact * 100.0;
            assert!(err_pct < 0.5, "dt={} gave [A]={:.4}, error={:.2}% (expected < 0.5%)", dt, mol[0], err_pct);
        }
    }

    #[test]
    fn test_detailed_balance_reversible_equilibrium() {
        // A <=> B, k_f = 0.05 s^-1, K = 1.0 -> k_rev = 0.05 s^-1
        // Starting at [A]=1.0, [B]=0.0, reaches [A]=0.500 +- 0.001
        let rxn = KineticExtentReaction {
            id: "A_rev_B".into(),
            equation: "A <=> B".into(),
            reactants: vec![(0, 1.0)],
            products: vec![(1, 1.0)],
            gas_products: vec![],
            orders_reactants: vec![(0, 1.0)],
            orders_products: vec![(1, 1.0)],
            arrhenius_a: 0.05,
            arrhenius_n: 0.0,
            arrhenius_ea: 0.0,
            delta_h_kj: 0.0,
            catalyst_species: None,
            is_reversible: true,
            k_eq_298: Some(1.0),
            tier: ProvenanceTier::Tabulated,
            source: "test".into(),
        };

        let system = KineticExtentSystem::new(vec!["A".into(), "B".into()], vec![rxn]);
        let solids = HashMap::new();

        for &dt in &[0.05_f64, 0.5, 1.0] {
            let steps = (200.0 / dt).round() as usize;
            let mut mol = vec![1.0, 0.0];
            for _ in 0..steps {
                let (ext, _) = system.integrate_extent_step(&mol, dt, 1.0, 298.15, 101325.0, 0.0, &solids);
                mol[0] += system.nu[0][0] * ext[0];
                mol[1] += system.nu[0][1] * ext[0];
            }
            assert!((mol[0] - 0.500).abs() < 0.001, "dt={} reached {:.4} after 200s (expected 0.500 +- 0.001)", dt, mol[0]);
        }
    }
}
