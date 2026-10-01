use std::collections::HashMap;

/// Conservation check report
#[derive(Clone, Debug, Default)]
pub struct ConservationReport {
    pub passed: bool,
    pub charge_error: f64,
    pub max_element_error: f64,
    pub energy_error: f64,
    pub element_deltas: HashMap<String, f64>,
}

/// Verifies charge conservation: sum(z_i * n_i) == 0
pub fn check_charge_conservation(ions: &[(f64, i32)]) -> (bool, f64) {
    let mut net_charge = 0.0;
    let mut total_ions = 0.0;
    for &(moles, z) in ions {
        net_charge += moles * (z as f64);
        total_ions += moles.abs();
    }
    let error = net_charge.abs();
    let passed = if total_ions > 1e-9 {
        error / total_ions < 1e-4 || error < 1e-7
    } else {
        error < 1e-8
    };
    (passed, error)
}

/// Verifies element molar conservation: sum(atoms_e * n_species) before vs after
pub fn check_element_conservation(
    initial_elements: &HashMap<String, f64>,
    final_elements: &HashMap<String, f64>,
    moles_lost_to_gas_or_boil: &HashMap<String, f64>,
) -> (bool, f64, HashMap<String, f64>) {
    let mut max_err = 0.0;
    let mut deltas = HashMap::new();
    let mut all_passed = true;

    let mut all_elements: std::collections::HashSet<&String> = initial_elements.keys().collect();
    for k in final_elements.keys() {
        all_elements.insert(k);
    }
    for k in moles_lost_to_gas_or_boil.keys() {
        all_elements.insert(k);
    }

    for elem in all_elements {
        let init_moles = initial_elements.get(elem).copied().unwrap_or(0.0);
        let final_moles = final_elements.get(elem).copied().unwrap_or(0.0);
        let lost_moles = moles_lost_to_gas_or_boil.get(elem).copied().unwrap_or(0.0);
        let total_accounted = final_moles + lost_moles;
        let delta = (total_accounted - init_moles).abs();
        deltas.insert(elem.clone(), delta);

        let rel_err = if init_moles > 1e-9 {
            delta / init_moles
        } else {
            delta
        };

        if rel_err > max_err {
            max_err = rel_err;
        }

        if rel_err > 1e-4 && delta > 1e-7 {
            all_passed = false;
        }
    }

    (all_passed, max_err, deltas)
}

/// Verifies thermal energy conservation: Delta H_rxn + Q_in - Q_out == C_tot * Delta T
pub fn check_energy_conservation(
    q_reaction: f64,
    q_in: f64,
    q_out: f64,
    c_tot: f64,
    delta_t: f64,
) -> (bool, f64) {
    let q_net = q_reaction + q_in - q_out;
    let delta_e_thermal = c_tot * delta_t;
    let error = (q_net - delta_e_thermal).abs();
    let norm = (q_net.abs() + delta_e_thermal.abs()).max(1.0);
    let rel_err = error / norm;
    let passed = rel_err < 1e-3 || error < 1e-2;
    (passed, error)
}
