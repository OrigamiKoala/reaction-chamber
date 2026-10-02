use std::collections::{BTreeSet, HashMap};

use serde::{Deserialize, Serialize};

/// Relative tolerance of the per-element ledger.
pub const ELEMENT_REL_TOL: f64 = 1e-6;
/// Absolute amount (mol) below which an element discrepancy is numerical dust.
pub const ELEMENT_DUST_MOL: f64 = 1e-12;

/// Per-vessel cumulative element ledger: everything that ever entered (doses, portions poured in, gas received) and
/// everything that ever left (portions removed, gas vented or collected elsewhere, boil-off, evaporation, combustion).
/// The element balance of a vessel is `added - removed` versus what it holds now, so a reaction that creates or destroys
/// atoms shows up as an error instead of being absorbed into a moving baseline.
#[derive(Clone, Debug, Default)]
pub struct ElementLedger {
    pub added: HashMap<String, f64>,
    pub removed: HashMap<String, f64>,
    /// Species that were booked but whose formula cannot be parsed: their atoms are not tracked and are reported.
    pub unverified: BTreeSet<String>,
}

impl ElementLedger {
    fn book(map: &mut HashMap<String, f64>, unverified: &mut BTreeSet<String>, species: &str, mol: f64) {
        if mol == 0.0 || !mol.is_finite() {
            return;
        }
        match crate::ions::species_elements(species) {
            Some(elems) => {
                for (e, n) in elems {
                    *map.entry(e).or_insert(0.0) += mol * n;
                }
            }
            None => {
                unverified.insert(species.to_string());
            }
        }
    }

    pub fn book_in(&mut self, species: &str, mol: f64) {
        Self::book(&mut self.added, &mut self.unverified, species, mol);
    }

    pub fn book_out(&mut self, species: &str, mol: f64) {
        Self::book(&mut self.removed, &mut self.unverified, species, mol);
    }

    /// Expected element inventory (added - removed).
    pub fn expected(&self) -> HashMap<String, f64> {
        let mut out = self.added.clone();
        for (e, n) in &self.removed {
            *out.entry(e.clone()).or_insert(0.0) -= n;
        }
        out
    }
}

/// Element discrepancy of one element.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ElementError {
    pub element: String,
    pub expected_mol: f64,
    pub actual_mol: f64,
    pub abs_err_mol: f64,
    pub rel_err: f64,
}

/// Compares the ledger's expected inventory with what the vessel holds. Returns every element with a non-zero
/// discrepancy (sorted by element), the largest relative error, the largest absolute error and whether all are within
/// tolerance (`rel <= ELEMENT_REL_TOL` or `abs <= ELEMENT_DUST_MOL`).
pub fn audit_elements(ledger: &ElementLedger, current: &HashMap<String, f64>) -> (Vec<ElementError>, f64, f64, bool) {
    let expected = ledger.expected();
    let mut names: BTreeSet<&String> = expected.keys().collect();
    names.extend(current.keys());
    let mut errors = Vec::new();
    let (mut max_rel, mut max_abs, mut ok) = (0.0_f64, 0.0_f64, true);
    for e in names {
        let exp = expected.get(e).copied().unwrap_or(0.0);
        let act = current.get(e).copied().unwrap_or(0.0);
        let abs = (act - exp).abs();
        let rel = abs / exp.abs().max(act.abs()).max(1e-300);
        if abs > 0.0 {
            errors.push(ElementError { element: e.clone(), expected_mol: exp, actual_mol: act, abs_err_mol: abs, rel_err: rel });
        }
        if abs > ELEMENT_DUST_MOL {
            max_rel = max_rel.max(rel);
            max_abs = max_abs.max(abs);
            if rel > ELEMENT_REL_TOL {
                ok = false;
            }
        }
    }
    (errors, max_rel, max_abs, ok)
}

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
