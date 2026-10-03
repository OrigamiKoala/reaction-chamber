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
use crate::thermo::functions::try_ln_k_equilibrium;

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
    /// Non-zero entries of `nu` per reaction: (species, nu)
    nu_by_rxn: Vec<Vec<(usize, f64)>>,
    /// Non-zero entries of `nu` per species: (reaction, nu)
    nu_by_species: Vec<Vec<(usize, f64)>>,
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

        let mut nu_by_rxn = vec![Vec::new(); num_rxns];
        let mut nu_by_species = vec![Vec::new(); num_spec];
        for r in 0..num_rxns {
            for i in 0..num_spec {
                if nu[r][i] != 0.0 {
                    nu_by_rxn[r].push((i, nu[r][i]));
                    nu_by_species[i].push((r, nu[r][i]));
                }
            }
        }

        Self {
            species_names,
            reactions,
            nu,
            nu_by_rxn,
            nu_by_species,
        }
    }

    /// (k_fwd, K) of every reaction: they depend on T, P, ionic strength and the catalysts present, which are constant
    /// over one integration step, so they are evaluated once per step rather than at every stage.
    pub fn rate_constants(&self, temp_k: f64, pressure_pa: f64, ionic_strength: f64, solid_moles: &HashMap<String, f64>) -> Vec<(f64, f64)> {
        (0..self.reactions.len()).map(|r| self.evaluate_rate_constants(r, temp_k, pressure_pa, ionic_strength, solid_moles)).collect()
    }

    /// Evaluates the forward rate constant and the equilibrium constant K (0 = irreversible) of reaction `r_idx`
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

        // 5. Equilibrium constant for the reverse direction (concentration units, solids and solvent at unit activity):
        // K(T) from the supplied K(298) by van 't Hoff, else from the species' standard chemical potentials. A reaction
        // whose species lack formation data stays irreversible rather than getting an invented K. 0 = irreversible.
        let k_eq = if k_fwd <= 0.0 {
            0.0
        } else if let Some(k_298) = rxn.k_eq_298 {
            let delta_h_j = rxn.delta_h_kj * 1000.0;
            let ln_k_t = k_298.max(1e-300).ln() - (delta_h_j / R_GAS) * (1.0 / t - 1.0 / 298.15);
            if ln_k_t > 690.0 { 0.0 } else { ln_k_t.exp() }
        } else if rxn.is_reversible {
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
            match try_ln_k_equilibrium(&react_map, &prod_map, t, pressure_pa) {
                Some(ln_k) if ln_k <= 690.0 => ln_k.exp(),
                _ => 0.0,
            }
        } else {
            0.0
        };

        (k_fwd, k_eq)
    }

    /// Computes reaction rates r_j (mol/(L*s)) and their concentration derivatives dr_j/dc_i (dense).
    pub fn compute_rates_and_derivatives(
        &self,
        concs: &[f64],
        temp_k: f64,
        pressure_pa: f64,
        ionic_strength: f64,
        solid_moles: &HashMap<String, f64>,
    ) -> (Vec<f64>, Vec<Vec<f64>>) {
        let consts = self.rate_constants(temp_k, pressure_pa, ionic_strength, solid_moles);
        let (rates, sparse) = self.rates_sparse(concs, &consts);
        let mut dense = vec![vec![0.0; self.species_names.len()]; self.reactions.len()];
        for (r, row) in sparse.into_iter().enumerate() {
            for (i, d) in row {
                dense[r][i] += d;
            }
        }
        (rates, dense)
    }

    /// Rates (mol/(L s)) and, per reaction, the non-zero derivatives dr/dc_i, for the step's rate constants `consts`.
    fn rates_sparse(&self, concs: &[f64], consts: &[(f64, f64)]) -> (Vec<f64>, Vec<Vec<(usize, f64)>>) {
        let num_rxns = self.reactions.len();
        let mut rates = vec![0.0; num_rxns];
        let mut deriv: Vec<Vec<(usize, f64)>> = vec![Vec::new(); num_rxns];

        for r_idx in 0..num_rxns {
            let rxn = &self.reactions[r_idx];
            let (k_fwd, k_eq) = consts[r_idx];
            let row = &mut deriv[r_idx];
            let push = |row: &mut Vec<(usize, f64)>, i: usize, d: f64| {
                if let Some(x) = row.iter_mut().find(|(j, _)| *j == i) {
                    x.1 += d;
                } else {
                    row.push((i, d));
                }
            };

            // Check if any stoichiometric reactant is depleted
            let reactant_depleted = rxn.reactants.iter().any(|&(idx, _)| concs[idx] <= 1e-15);

            // Forward rate F = k_f prod c^order (orders may name catalysts that the reaction does not consume) and dF/dc
            let mut f_fwd = if reactant_depleted { 0.0 } else { k_fwd };
            if f_fwd > 0.0 {
                for &(idx, order) in &rxn.orders_reactants {
                    let c = concs[idx].max(0.0);
                    if order.abs() < 1e-12 {
                        // zero order
                    } else if (order - 1.0).abs() < 1e-6 {
                        f_fwd *= c;
                    } else if (order - 2.0).abs() < 1e-6 {
                        f_fwd *= c * c;
                    } else if c > 0.0 {
                        f_fwd *= c.powf(order);
                    } else {
                        f_fwd = 0.0;
                    }
                }
            }
            if f_fwd > 0.0 {
                for &(k_idx, k_order) in &rxn.orders_reactants {
                    if k_order.abs() < 1e-12 {
                        continue;
                    }
                    push(row, k_idx, f_fwd * k_order / concs[k_idx].max(1e-15));
                }
            }

            // Reverse rate from detailed balance whatever the empirical orders: r = F (1 - Q/K), written as
            // r_rev = (k_f / K) prod c^(order - nu_reactant + nu_product) so that it stays finite when a reactant is
            // absent (the reaction then runs backward from its products). Q runs over the stoichiometric species in
            // solution: pure solids and the solvent have unit activity. A gas product leaves the liquid as it forms, so a
            // reaction that makes gas never runs backward, and neither can one whose solid product is absent.
            let mut r_rev = 0.0;
            let solid_product_absent = rxn.products.iter().any(|&(idx, _)| self.species_names[idx].ends_with("(s)") && concs[idx] <= 1e-15);
            if k_eq > 0.0 && k_fwd > 0.0 && rxn.gas_products.is_empty() && !solid_product_absent {
                let mut expo: Vec<(usize, f64)> = rxn.orders_reactants.clone();
                let add = |idx: usize, e: f64, expo: &mut Vec<(usize, f64)>| {
                    if let Some(x) = expo.iter_mut().find(|(i, _)| *i == idx) {
                        x.1 += e;
                    } else {
                        expo.push((idx, e));
                    }
                };
                for (sign, list) in [(-1.0, &rxn.reactants), (1.0, &rxn.products)] {
                    for &(idx, nu) in list.iter() {
                        let sp = &self.species_names[idx];
                        if sp.ends_with("(s)") || sp == crate::vessel::AQUEOUS_SOLVENT {
                            continue;
                        }
                        add(idx, sign * nu, &mut expo);
                    }
                }
                // the reverse needs every species it consumes (positive exponent) present
                if expo.iter().all(|&(idx, e)| e <= 1e-12 || concs[idx] > 1e-15) {
                    let mut ln_r = (k_fwd / k_eq).ln();
                    for &(idx, e) in &expo {
                        if e.abs() > 1e-12 {
                            ln_r += e * concs[idx].max(1e-15).ln();
                        }
                    }
                    r_rev = ln_r.min(690.0).exp();
                    for &(idx, e) in &expo {
                        if e.abs() > 1e-12 {
                            push(row, idx, -r_rev * e / concs[idx].max(1e-15));
                        }
                    }
                }
            }

            rates[r_idx] = f_fwd - r_rev;
        }

        (rates, deriv)
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
        let consts = self.rate_constants(temp_k, pressure_pa, ionic_strength, solid_moles);
        let (f, jac) = self.f_and_jac(xi, initial_moles, vol_l, &consts, true);
        (f, jac.unwrap_or_default())
    }

    fn concs_at(&self, xi: &[f64], initial_moles: &[f64], v: f64) -> Vec<f64> {
        let mut concs: Vec<f64> = initial_moles.to_vec();
        for (r, row) in self.nu_by_rxn.iter().enumerate() {
            if xi[r] != 0.0 {
                for &(i, nu) in row {
                    concs[i] += nu * xi[r];
                }
            }
        }
        for c in concs.iter_mut() {
            *c = (*c / v).max(0.0);
        }
        concs
    }

    fn f_and_jac(&self, xi: &[f64], initial_moles: &[f64], vol_l: f64, consts: &[(f64, f64)], want_jac: bool) -> (Vec<f64>, Option<Vec<Vec<f64>>>) {
        let num_rxns = self.reactions.len();
        let v = vol_l.max(1e-6);
        let concs = self.concs_at(xi, initial_moles, v);
        let (rates, deriv) = self.rates_sparse(&concs, consts);
        // f_r = rate_r * V (mol/s)
        let f: Vec<f64> = rates.iter().map(|r| r * v).collect();
        if !want_jac {
            return (f, None);
        }
        // J_{rk} = d f_r / d xi_k = sum_i (d rate_r / d c_i) * nu[k][i] (the V cancels against dc_i / dxi_k = nu / V)
        let mut jac = vec![vec![0.0; num_rxns]; num_rxns];
        for (r, row) in deriv.iter().enumerate() {
            for &(i, d) in row {
                for &(k, nu) in &self.nu_by_species[i] {
                    jac[r][k] += d * nu;
                }
            }
        }
        (f, Some(jac))
    }

    /// Integrates the extent system over interval `dt_s` with L-stable ROS2 sub-steps of at most 50 ms (halved on a
    /// positivity failure). Returns (final_extents, rates_mol_per_l_s)
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
        let consts = self.rate_constants(temp_k, pressure_pa, ionic_strength, solid_moles);

        let gamma = 1.0 - 1.0 / std::f64::consts::SQRT_2; // ~0.2928932188
        let mut xi = vec![0.0; num_rxns];
        let mut t_sub = 0.0;
        let mut h = dt_s.min(0.05);
        let moles_at = |xi: &[f64], i: usize| -> f64 {
            let mut m = initial_moles[i];
            for &(r, nu) in &self.nu_by_species[i] {
                m += nu * xi[r];
            }
            m
        };

        while t_sub < dt_s - 1e-12 {
            let cur_h = h.min(dt_s - t_sub);
            if cur_h <= 1e-12 {
                break;
            }

            let (f0, jac) = self.f_and_jac(&xi, initial_moles, vol_l, &consts, true);
            let jac = jac.unwrap_or_default();

            // W = I - gamma h J, factorised once for both stages
            let mut w = vec![vec![0.0; num_rxns]; num_rxns];
            for i in 0..num_rxns {
                for j in 0..num_rxns {
                    w[i][j] = -gamma * cur_h * jac[i][j];
                }
                w[i][i] += 1.0;
            }
            let lu = LuFactors::new(w);

            // Stage 1: W k1 = f0
            let k1 = lu.solve(&f0);
            let xi_star: Vec<f64> = (0..num_rxns).map(|r| xi[r] + cur_h * k1[r]).collect();
            let (f_star, _) = self.f_and_jac(&xi_star, initial_moles, vol_l, &consts, false);

            // Stage 2: W k2 = f* - 2 gamma h J k1
            let mut rhs2 = vec![0.0; num_rxns];
            for i in 0..num_rxns {
                let mut jk1 = 0.0;
                for j in 0..num_rxns {
                    jk1 += jac[i][j] * k1[j];
                }
                rhs2[i] = f_star[i] - 2.0 * gamma * cur_h * jk1;
            }
            let k2 = lu.solve(&rhs2);

            // Candidate increment: delta_xi = 0.5 * cur_h * (k1 + k2)
            let delta_xi: Vec<f64> = (0..num_rxns).map(|r| 0.5 * cur_h * (k1[r] + k2[r])).collect();
            let cand: Vec<f64> = (0..num_rxns).map(|r| xi[r] + delta_xi[r]).collect();

            // Positivity check: no species may drop below -1e-12 mol
            let non_negative = (0..num_spec).all(|i| moles_at(&cand, i) >= -1e-12);

            if !non_negative {
                // Reject step and halve step size
                h *= 0.5;
                if h < 1e-8 {
                    // Limiting reactant boundary reached: largest non-negative fraction alpha of the step, then the rest
                    // of the interval has nothing left to convert along this direction
                    let mut alpha = 1.0_f64;
                    for i in 0..num_spec {
                        let cur_mol = moles_at(&xi, i);
                        let d_mol: f64 = self.nu_by_species[i].iter().map(|&(r, nu)| nu * delta_xi[r]).sum();
                        if d_mol < -1e-15 && cur_mol > 0.0 {
                            alpha = alpha.min(cur_mol / (-d_mol));
                        }
                    }
                    let alpha = alpha.clamp(0.0, 1.0);
                    for r in 0..num_rxns {
                        xi[r] += alpha * delta_xi[r];
                    }
                    break;
                }
            } else {
                xi = cand;
                t_sub += cur_h;
                h = 0.05_f64.min(dt_s - t_sub);
                if h <= 1e-10 {
                    break;
                }
            }
        }

        // Final rates in mol/(L*s)
        let v = vol_l.max(1e-6);
        let final_rates: Vec<f64> = xi.iter().map(|x| x / (v * dt_s)).collect();
        (xi, final_rates)
    }
}

/// LU factorisation with partial pivoting of a small dense matrix (factor once, solve several right-hand sides).
pub struct LuFactors {
    lu: Vec<Vec<f64>>,
    perm: Vec<usize>,
}

impl LuFactors {
    pub fn new(mut a: Vec<Vec<f64>>) -> Self {
        let n = a.len();
        let mut perm: Vec<usize> = (0..n).collect();
        for col in 0..n {
            let mut max_row = col;
            let mut max_val = a[col][col].abs();
            for row in (col + 1)..n {
                if a[row][col].abs() > max_val {
                    max_val = a[row][col].abs();
                    max_row = row;
                }
            }
            if max_row != col {
                a.swap(col, max_row);
                perm.swap(col, max_row);
            }
            let pivot = a[col][col];
            if pivot.abs() < 1e-15 || !pivot.is_finite() {
                continue;
            }
            let (top, bottom) = a.split_at_mut(col + 1);
            let prow = &top[col];
            for row in bottom.iter_mut() {
                let factor = row[col] / pivot;
                row[col] = factor;
                if factor != 0.0 {
                    for c in (col + 1)..n {
                        row[c] -= factor * prow[c];
                    }
                }
            }
        }
        LuFactors { lu: a, perm }
    }

    pub fn solve(&self, b: &[f64]) -> Vec<f64> {
        let n = b.len();
        let mut y: Vec<f64> = self.perm.iter().map(|&p| b[p]).collect();
        for i in 0..n {
            let mut sum = y[i];
            for j in 0..i {
                sum -= self.lu[i][j] * y[j];
            }
            y[i] = sum;
        }
        let mut x = vec![0.0; n];
        for i in (0..n).rev() {
            let mut sum = y[i];
            for j in (i + 1)..n {
                sum -= self.lu[i][j] * x[j];
            }
            let diag = self.lu[i][i];
            x[i] = if diag.abs() > 1e-15 && diag.is_finite() {
                let val = sum / diag;
                if val.is_finite() { val } else { 0.0 }
            } else {
                0.0
            };
        }
        x
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
