use crate::equilibrium::R_IDEAL;

/// Elementary or empirical reaction
#[derive(Clone, Debug)]
pub struct KineticReaction {
    pub name: String,
    pub reactants: Vec<(usize, f64)>, // rate law orders (species_index, order)
    pub products: Vec<(usize, f64)>,
    pub stoich_reactants: Option<Vec<(usize, f64)>>, // molar stoichiometry if different from rate orders
    pub stoich_products: Option<Vec<(usize, f64)>>,
    pub arrhenius_a: f64,
    pub arrhenius_n: f64,
    pub arrhenius_ea: f64, // J/mol
    pub delta_h: f64,      // J/mol (exothermic < 0)
    pub is_reversible: bool,
    pub k_eq_298: Option<f64>,
}

impl KineticReaction {
    pub fn rate_constant(&self, temp_k: f64) -> f64 {
        let t = if temp_k.is_nan() { 298.15 } else { temp_k.max(100.0) };
        let exp_arg = (-self.arrhenius_ea / (R_IDEAL * t)).clamp(-100.0, 100.0);
        let exp_term = exp_arg.exp();
        let k = self.arrhenius_a * t.powf(self.arrhenius_n) * exp_term;
        if k.is_finite() && k >= 0.0 {
            k
        } else {
            0.0
        }
    }
}

/// Chemical kinetics network
#[derive(Clone, Debug)]
pub struct KineticNetwork {
    pub species_names: Vec<String>,
    pub reactions: Vec<KineticReaction>,
}

impl KineticNetwork {
    pub fn num_species(&self) -> usize {
        self.species_names.len()
    }

    /// Computes reaction rates R_j = r_fwd - r_rev
    pub fn reaction_rates(&self, concs: &[f64], temp_k: f64) -> Vec<f64> {
        let mut rates = Vec::with_capacity(self.reactions.len());
        for rxn in &self.reactions {
            let k_fwd = rxn.rate_constant(temp_k);
            let mut r_fwd = k_fwd;
            for &(idx, coeff) in &rxn.reactants {
                let c = concs[idx].max(0.0);
                if (coeff - 1.0).abs() < 1e-6 {
                    r_fwd *= c;
                } else if (coeff - 2.0).abs() < 1e-6 {
                    r_fwd *= c * c;
                } else if c > 0.0 {
                    r_fwd *= c.powf(coeff);
                } else {
                    r_fwd = 0.0;
                }
            }

            let r_rev = if rxn.is_reversible {
                let k_eq = rxn.k_eq_298.unwrap_or(1.0).max(1e-15);
                let k_rev = (k_fwd / k_eq).max(0.0);
                let mut rev = k_rev;
                for &(idx, coeff) in &rxn.products {
                    let c = concs[idx].max(0.0);
                    if (coeff - 1.0).abs() < 1e-6 {
                        rev *= c;
                    } else if (coeff - 2.0).abs() < 1e-6 {
                        rev *= c * c;
                    } else if c > 0.0 {
                        rev *= c.powf(coeff);
                    } else {
                        rev = 0.0;
                    }
                }
                rev
            } else {
                0.0
            };

            rates.push(r_fwd - r_rev);
        }
        rates
    }

    /// Evaluates time derivatives dc/dt = f(c)
    pub fn derivatives(&self, concs: &[f64], temp_k: f64) -> Vec<f64> {
        let n = self.num_species();
        let mut dc_dt = vec![0.0; n];
        let rates = self.reaction_rates(concs, temp_k);

        for (rxn_idx, rxn) in self.reactions.iter().enumerate() {
            let r = rates[rxn_idx];
            let r_stoich = rxn.stoich_reactants.as_ref().unwrap_or(&rxn.reactants);
            for &(idx, coeff) in r_stoich {
                dc_dt[idx] -= coeff * r;
            }
            let p_stoich = rxn.stoich_products.as_ref().unwrap_or(&rxn.products);
            for &(idx, coeff) in p_stoich {
                dc_dt[idx] += coeff * r;
            }
        }
        dc_dt
    }

    /// Computes analytic Jacobian J_{ik} = df_i / dc_k
    pub fn jacobian(&self, concs: &[f64], temp_k: f64) -> Vec<Vec<f64>> {
        let n = self.num_species();
        let mut jac = vec![vec![0.0; n]; n];

        for rxn in &self.reactions {
            let k_fwd = rxn.rate_constant(temp_k);
            let r_stoich = rxn.stoich_reactants.as_ref().unwrap_or(&rxn.reactants);
            let p_stoich = rxn.stoich_products.as_ref().unwrap_or(&rxn.products);

            // Derivative of forward rate wrt species k
            for &(k_idx, k_coeff) in &rxn.reactants {
                let mut dr_fwd_dck = k_fwd * k_coeff;
                let ck = concs[k_idx].max(1e-18);
                if (k_coeff - 1.0).abs() > 1e-6 {
                    dr_fwd_dck *= ck.powf(k_coeff - 1.0);
                }
                for &(m_idx, m_coeff) in &rxn.reactants {
                    if m_idx != k_idx {
                        let cm = concs[m_idx].max(0.0);
                        dr_fwd_dck *= cm.powf(m_coeff);
                    }
                }

                // Apply to reactant and product derivatives using stoichiometry
                for &(i_idx, i_coeff) in r_stoich {
                    jac[i_idx][k_idx] -= i_coeff * dr_fwd_dck;
                }
                for &(i_idx, i_coeff) in p_stoich {
                    jac[i_idx][k_idx] += i_coeff * dr_fwd_dck;
                }
            }

            // Derivative of reverse rate if reversible
            if rxn.is_reversible {
                let k_eq = rxn.k_eq_298.unwrap_or(1.0);
                let k_rev = (k_fwd / k_eq).max(0.0);
                for &(k_idx, k_coeff) in &rxn.products {
                    let mut dr_rev_dck = k_rev * k_coeff;
                    let ck = concs[k_idx].max(1e-18);
                    if (k_coeff - 1.0).abs() > 1e-6 {
                        dr_rev_dck *= ck.powf(k_coeff - 1.0);
                    }
                    for &(m_idx, m_coeff) in &rxn.products {
                        if m_idx != k_idx {
                            let cm = concs[m_idx].max(0.0);
                            dr_rev_dck *= cm.powf(m_coeff);
                        }
                    }

                    for &(i_idx, i_coeff) in r_stoich {
                        jac[i_idx][k_idx] += i_coeff * dr_rev_dck;
                    }
                    for &(i_idx, i_coeff) in p_stoich {
                        jac[i_idx][k_idx] -= i_coeff * dr_rev_dck;
                    }
                }
            }
        }

        jac
    }
}

/// L-stable Rosenbrock (ROS2) stiff ODE integrator
pub fn rosenbrock_step(
    network: &KineticNetwork,
    concs: &[f64],
    dt: f64,
    temp_k: f64,
) -> Vec<f64> {
    if dt <= 0.0 || dt.is_nan() {
        return concs.to_vec();
    }
    let n = network.num_species();
    let gamma = 1.0 - 1.0 / std::f64::consts::SQRT_2; // ~0.2928932188

    // f0 = f(y_n)
    let f0 = network.derivatives(concs, temp_k);
    // J = df/dy
    let jac = network.jacobian(concs, temp_k);

    // Matrix W = I - gamma * dt * J
    let mut w = vec![vec![0.0; n]; n];
    for i in 0..n {
        for j in 0..n {
            w[i][j] = -gamma * dt * jac[i][j];
        }
        w[i][i] += 1.0;
    }

    // Solve W * k1 = f0
    let k1 = solve_linear_system(&w, &f0);

    // Intermediate state y* = y_n + dt * k1
    let mut y_star = vec![0.0; n];
    for i in 0..n {
        let val = concs[i] + dt * k1[i];
        y_star[i] = if val.is_finite() && val > 0.0 { val } else { 0.0 };
    }

    // f(y*)
    let f_star = network.derivatives(&y_star, temp_k);

    // RHS2 = f_star - 2.0 * gamma * dt * J * k1
    // Let's compute J * k1
    let mut jk1 = vec![0.0; n];
    for i in 0..n {
        for j in 0..n {
            jk1[i] += jac[i][j] * k1[j];
        }
    }

    let mut rhs2 = vec![0.0; n];
    for i in 0..n {
        rhs2[i] = f_star[i] - 2.0 * gamma * dt * jk1[i];
    }

    // Solve W * k2 = rhs2
    let k2 = solve_linear_system(&w, &rhs2);

    // Next state y_{n+1} = y_n + (dt / 2) * (k1 + k2)
    let mut next_concs = vec![0.0; n];
    for i in 0..n {
        let updated = concs[i] + 0.5 * dt * (k1[i] + k2[i]);
        next_concs[i] = if updated.is_finite() && updated > 0.0 { updated } else { 0.0 };
    }

    next_concs
}

/// Linear solver using Gaussian elimination with partial pivoting
pub fn solve_linear_system(a: &[Vec<f64>], b: &[f64]) -> Vec<f64> {
    let n = b.len();
    let mut mat = a.to_vec();
    let mut rhs = b.to_vec();

    // Forward elimination
    for col in 0..n {
        // Find pivot
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

/// Builds the Iodine Clock (Persulfate-Iodide Landolt) kinetic network
/// Species indices:
/// 0: S2O8^2- (persulfate)
/// 1: I^- (iodide)
/// 2: SO4^2- (sulfate)
/// 3: I2 (iodine)
/// 4: S2O3^2- (thiosulfate)
/// 5: S4O6^2- (tetrathionate)
pub fn build_iodine_clock_network() -> KineticNetwork {
    let species_names = vec![
        "S2O8_2-".to_string(),
        "I-".to_string(),
        "SO4_2-".to_string(),
        "I2".to_string(),
        "S2O3_2-".to_string(),
        "S4O6_2-".to_string(),
    ];

    // Reaction 1: S2O8^2- + 2 I- -> 2 SO4^2- + I2
    // Rate = k1 [S2O8^2-] [I-]
    // Literature: k1(293.15 K) ~ 0.020 M^-1 s^-1, Ea ~ 52 kJ/mol
    // A = 0.020 * exp(52000 / (8.314 * 293.15)) ~ 3.73e7
    let rxn1 = KineticReaction {
        name: "Persulfate oxidation of iodide".to_string(),
        reactants: vec![(0, 1.0), (1, 1.0)], // first order in each
        products: vec![(2, 2.0), (3, 1.0)],
        stoich_reactants: Some(vec![(0, 1.0), (1, 2.0)]),
        stoich_products: None,
        arrhenius_a: 3.73e7,
        arrhenius_n: 0.0,
        arrhenius_ea: 52000.0,
        delta_h: -150000.0,
        is_reversible: false,
        k_eq_298: None,
    };

    // Reaction 2: I2 + 2 S2O3^2- -> 2 I- + S4O6^2-
    // Fast scavenging reaction: k2 ~ 5.0e5 M^-1 s^-1
    // Rate order is first-order in each, but stoichiometry consumes 2 S2O3^2-
    let rxn2 = KineticReaction {
        name: "Thiosulfate reduction of iodine".to_string(),
        reactants: vec![(3, 1.0), (4, 1.0)],
        products: vec![(1, 2.0), (5, 1.0)],
        stoich_reactants: Some(vec![(3, 1.0), (4, 2.0)]),
        stoich_products: None,
        arrhenius_a: 5.0e5,
        arrhenius_n: 0.0,
        arrhenius_ea: 0.0,
        delta_h: -100000.0,
        is_reversible: false,
        k_eq_298: None,
    };

    KineticNetwork {
        species_names,
        reactions: vec![rxn1, rxn2],
    }
}

/// Simulates the Iodine Clock reaction until color transition (free I2 emerges)
/// Returns (delay_time_sec, time_series_i2, time_series_thiosulfate)
pub fn simulate_iodine_clock(
    initial_s2o8: f64,
    initial_i: f64,
    initial_s2o3: f64,
    temp_k: f64,
    dt: f64,
    max_time_sec: f64,
) -> (f64, Vec<(f64, f64)>, Vec<(f64, f64)>) {
    if dt <= 0.0 || max_time_sec <= 0.0 {
        return (0.0, Vec::new(), Vec::new());
    }
    let s2o8_0 = initial_s2o8.max(0.0);
    let i_0 = initial_i.max(0.0);
    let s2o3_0 = initial_s2o3.max(0.0);

    if s2o3_0 <= 0.0 {
        return (0.0, vec![(0.0, 0.0)], vec![(0.0, 0.0)]);
    }
    if s2o8_0 <= 0.0 || i_0 <= 0.0 {
        return (max_time_sec, vec![(0.0, 0.0)], vec![(0.0, s2o3_0)]);
    }

    let network = build_iodine_clock_network();
    let mut concs = vec![
        s2o8_0,  // 0: S2O8^2-
        i_0,     // 1: I-
        0.0,     // 2: SO4^2-
        0.0,     // 3: I2
        s2o3_0,  // 4: S2O3^2-
        0.0,     // 5: S4O6^2-
    ];

    let mut current_time = 0.0;
    let mut delay_time = max_time_sec;
    let mut transition_detected = false;

    let mut i2_series = Vec::new();
    let mut s2o3_series = Vec::new();

    while current_time < max_time_sec {
        i2_series.push((current_time, concs[3]));
        s2o3_series.push((current_time, concs[4]));

        // Check transition: thiosulfate depleted and free I2 surges
        if !transition_detected && concs[3] > 1e-5 && concs[4] < 1e-4 {
            delay_time = current_time;
            transition_detected = true;
        }

        concs = rosenbrock_step(&network, &concs, dt, temp_k);
        current_time += dt;

        if transition_detected && current_time > delay_time + 10.0 {
            break;
        }
    }

    (delay_time, i2_series, s2o3_series)
}
