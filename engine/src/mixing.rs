//! Excess (mixing) enthalpy of liquid phases.
//!
//! The enthalpy of a liquid phase is `sum_i n_i H_i(T)` of its pure-state species data plus the excess enthalpy
//! `H^E = -R T^2 d(sum_i n_i ln gamma_i)/dT` of the activity model. Mixing two liquids releases (or takes up)
//! `H^E(mixture) - H^E(first) - H^E(second)`; the vessel books that heat wherever liquids combine (a dose, a poured
//! portion) and the phase solver books the change of `H^E` when material moves between phases.
//!
//! Where the activity model is accurate for the *composition* but not for the *temperature dependence* of its activity
//! coefficients (UNIFAC fitted to vapour-liquid equilibria gets the sign of `H^E` of water + ethanol wrong), a measured
//! Redlich-Kister row for the pair (`data/excess_enthalpy.json`, keyed by InChIKey like the excess volumes) replaces the
//! model's contribution of that binary: `H^E = H^E_model(phase) + sum_pairs [H^E_table(pair) - H^E_model(pair)]`, the pair
//! terms weighted by Kohler's rule `n (x_a + x_b)^2 h(x_a / (x_a + x_b))`. A pure binary reproduces its table exactly; a pair
//! without a row keeps the model's value.

use std::sync::Arc;

use crate::molecule::{IonEnv, Mixture, Molecule};
use crate::physics::R_GAS;

/// One tabulated binary (`data/excess_enthalpy.json`).
pub struct ExcessEnthalpyPair {
    pub a: String,
    pub b: String,
    /// Redlich-Kister coefficients, J per mole of the binary mixture.
    pub coeffs: Vec<f64>,
    pub t_ref_k: f64,
}

pub fn tabulated_pairs() -> &'static Vec<ExcessEnthalpyPair> {
    static PAIRS: std::sync::OnceLock<Vec<ExcessEnthalpyPair>> = std::sync::OnceLock::new();
    PAIRS.get_or_init(|| {
        let v: serde_json::Value = serde_json::from_str(include_str!("../data/excess_enthalpy.json")).expect("excess_enthalpy.json");
        v["pairs"]
            .as_array()
            .map(|list| {
                list.iter()
                    .filter_map(|p| {
                        Some(ExcessEnthalpyPair {
                            a: p["a"].as_str()?.to_string(),
                            b: p["b"].as_str()?.to_string(),
                            coeffs: p["A_J_mol"].as_array()?.iter().filter_map(|x| x.as_f64()).collect(),
                            t_ref_k: p["T_K"].as_f64().unwrap_or(298.15),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    })
}

/// Tabulated excess enthalpy of a binary (J per mole of mixture) at the mole fraction `xa` of its first component.
pub fn table_h_e_j_mol(pair: &ExcessEnthalpyPair, xa: f64) -> f64 {
    let xb = 1.0 - xa;
    let d = xa - xb;
    xa * xb * pair.coeffs.iter().enumerate().map(|(k, a)| a * d.powi(k as i32)).sum::<f64>()
}

/// `-R T^2 sum_i n_i d ln gamma_i / dT` of one phase by central difference of the activity model (J). `mixes` are the
/// mixture models at T - dt and T + dt.
fn model_h_e_j(m_lo: &Mixture, m_hi: &Mixture, n: &[f64], env: Option<&IonEnv>, dt: f64, t_k: f64) -> f64 {
    if n.iter().sum::<f64>() <= 0.0 {
        return 0.0;
    }
    let (g1, g2) = (m_lo.ln_gamma(n, env), m_hi.ln_gamma(n, env));
    let dg: f64 = (0..n.len()).map(|i| n[i] * (g2[i] - g1[i])).sum();
    -R_GAS * t_k * t_k * dg / (2.0 * dt)
}

/// Excess enthalpy (J) of a set of liquid phases (`phases[p][i]` mol of component i, `envs[p]` the electrolytes of phase
/// p): the activity model's, with the tabulated pairs substituted for their own binary contribution.
pub fn excess_enthalpy_j(comps: &[Arc<Molecule>], t_k: f64, phases: &[Vec<f64>], envs: &[Option<&IonEnv>]) -> f64 {
    let dt = 0.5;
    let m_lo = Mixture::new(comps.to_vec(), t_k - dt);
    let m_hi = Mixture::new(comps.to_vec(), t_k + dt);
    let mut total = 0.0;
    // pairs of the table that this component list contains
    let mut pair_idx: Vec<(usize, usize, &ExcessEnthalpyPair)> = Vec::new();
    for p in tabulated_pairs() {
        let ia = comps.iter().position(|c| c.inchikey.as_deref() == Some(p.a.as_str()));
        let ib = comps.iter().position(|c| c.inchikey.as_deref() == Some(p.b.as_str()));
        if let (Some(ia), Some(ib)) = (ia, ib) {
            if ia != ib {
                pair_idx.push((ia, ib, p));
            }
        }
    }
    let mut binary_models: Vec<Option<(Mixture, Mixture)>> = pair_idx
        .iter()
        .map(|&(ia, ib, _)| Some((Mixture::new(vec![comps[ia].clone(), comps[ib].clone()], t_k - dt), Mixture::new(vec![comps[ia].clone(), comps[ib].clone()], t_k + dt))))
        .collect();
    for (ph, n) in phases.iter().enumerate() {
        let tot: f64 = n.iter().filter(|v| **v > 0.0).sum();
        if tot <= 0.0 {
            continue;
        }
        let env = envs.get(ph).copied().flatten();
        total += model_h_e_j(&m_lo, &m_hi, n, env, dt, t_k);
        for (k, &(ia, ib, pair)) in pair_idx.iter().enumerate() {
            let (na, nb) = (n[ia].max(0.0), n[ib].max(0.0));
            if na <= 0.0 || nb <= 0.0 {
                continue;
            }
            let xs = (na + nb) / tot;
            let xa = na / (na + nb);
            // Kohler weight: moles of the phase times the squared pair fraction
            let w = tot * xs * xs;
            let table = w * table_h_e_j_mol(pair, xa);
            let model = match binary_models[k].as_mut() {
                Some((lo, hi)) => w * model_h_e_j(lo, hi, &[xa, 1.0 - xa], None, dt, t_k),
                None => 0.0,
            };
            total += table - model;
        }
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A pure binary phase reproduces its table: the model's contribution of the pair is replaced, not added to.
    #[test]
    fn a_tabulated_binary_phase_has_exactly_the_table_value() {
        let (w, e) = (Arc::new(crate::molecule::resolve("H2O", None).expect("water")), Arc::new(crate::molecule::resolve("C2H5OH", None).expect("ethanol")));
        for (n_w, n_e) in [(0.8, 0.2), (0.5, 0.5), (0.1, 0.9)] {
            let h = excess_enthalpy_j(&[w.clone(), e.clone()], 298.15, &[vec![n_w, n_e]], &[None]);
            let p = &tabulated_pairs()[0];
            let want = (n_w + n_e) * table_h_e_j_mol(p, n_e / (n_w + n_e));
            assert!((h - want).abs() < 1e-6 * want.abs().max(1.0), "{} vs {}", h, want);
        }
    }

    #[test]
    fn the_table_is_zero_at_the_pure_ends_and_negative_in_between() {
        let p = &tabulated_pairs()[0];
        assert!(table_h_e_j_mol(p, 0.0).abs() < 1e-12 && table_h_e_j_mol(p, 1.0).abs() < 1e-12);
        assert!(table_h_e_j_mol(p, 0.25) < -600.0 && table_h_e_j_mol(p, 0.25) > -900.0);
    }
}
