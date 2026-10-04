//! Heat of mixing of miscible liquids.
//!
//! The temperature of a vessel is advanced from process heats built from the species' own enthalpies, which describe
//! ideal mixing. What is left is the excess enthalpy `H^E(T, n) = -R T^2 d(sum n_i ln gamma_i)/dT` of every liquid phase,
//! a state function of temperature and composition. The vessel keeps the excess enthalpy per mole it has already
//! accounted for (`MixingState::ref_j_per_mol`); whenever the composition has moved since (a dose, a pour, a reaction
//! changing the solvent), the difference is released as heat (or absorbed), so that the total enthalpy
//! `sum n_i H_i + H^E` is conserved. Outflows carry their share away and cost nothing: the reference is intensive.
//!
//! Source of `H^E`: the UNIFAC temperature derivative of the activity model for every pair of components that have groups
//! (the same model that places the phases), corrected for pairs with measured excess enthalpies (`data/excess_enthalpy.json`,
//! Redlich-Kister rows by InChIKey; Kohler combination for more than two components). The original UNIFAC fitted to
//! vapour-liquid equilibria has a poor temperature derivative, which is why the measured residual exists.
//! Ions are left out: the enthalpy of dissolving a salt belongs to its equilibrium row, with the formation data of the ions.

use std::collections::{hash_map::DefaultHasher, BTreeSet, HashMap};
use std::hash::{Hash, Hasher};
use std::sync::Arc;

use crate::molecule::Molecule;
use crate::vessel::Vessel;

/// Bookkeeping of the excess enthalpy a vessel has accounted for.
#[derive(Default, Clone, Debug)]
pub struct MixingState {
    /// Excess enthalpy per mole of molecular liquid at the last accounting (None until the first look at the contents).
    pub ref_j_per_mol: Option<f64>,
    /// Moles of molecular liquid and excess enthalpy (J) of the stream added by the dose in progress.
    pub pending_n_in: f64,
    pub pending_carried_j: f64,
    cache_key: u64,
    cache_value: (f64, f64),
}

struct Pair {
    a: String,
    b: String,
    coeffs: Vec<f64>,
}

fn measured_pairs() -> &'static Vec<Pair> {
    static PAIRS: std::sync::OnceLock<Vec<Pair>> = std::sync::OnceLock::new();
    PAIRS.get_or_init(|| {
        let v: serde_json::Value = serde_json::from_str(include_str!("../data/excess_enthalpy.json")).expect("excess_enthalpy.json");
        v["pairs"]
            .as_array()
            .map(|list| {
                list.iter()
                    .filter_map(|p| {
                        Some(Pair {
                            a: p["a"].as_str()?.to_string(),
                            b: p["b"].as_str()?.to_string(),
                            coeffs: p["A_J_mol"].as_array()?.iter().filter_map(|x| x.as_f64()).collect(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    })
}

/// Measured excess enthalpy of one binary (J per mole of the binary) for `x_a` of the pair's first member.
fn measured_binary_j_mol(p: &Pair, x_a: f64) -> f64 {
    let x_b = 1.0 - x_a;
    let d = x_a - x_b;
    x_a * x_b * p.coeffs.iter().enumerate().map(|(k, a)| a * d.powi(k as i32)).sum::<f64>()
}

/// Relative apparent molar enthalpy of the ionic part of an aqueous phase (Debye-Huckel / Pitzer) in Joules.
fn ionic_excess_enthalpy_of(phase: &HashMap<String, f64>, t_k: f64) -> f64 {
    let n_h2o = phase.get(crate::db::seed::WATER).copied().unwrap_or(0.0);
    if n_h2o <= 1e-12 {
        return 0.0;
    }
    let m_w_kg = n_h2o * 0.01801528;
    let mut sum_m_z2 = 0.0;
    for (sp, &mol) in phase.iter() {
        if sp != crate::db::seed::WATER && mol > 0.0 {
            let charge = crate::chem_db::get_species_thermo(sp).charge as f64;
            if charge != 0.0 {
                let m = mol / m_w_kg;
                sum_m_z2 += m * charge * charge;
            }
        }
    }
    let i_tot = 0.5 * sum_m_z2;
    if i_tot <= 1e-5 {
        return 0.0;
    }
    let a_phi_p = crate::activity::debye_huckel_a_phi(t_k + 0.5);
    let a_phi_m = crate::activity::debye_huckel_a_phi(t_k - 0.5);
    let da_phi_dt = a_phi_p - a_phi_m;
    let a_h = 4.0 * crate::physics::R_GAS * t_k * t_k * da_phi_dt;
    let b = 1.2;
    let sqrt_i = i_tot.sqrt();
    m_w_kg * (a_h / b) * i_tot * (1.0 + b * sqrt_i).ln()
}

impl Vessel {
    /// Excess enthalpy (J) and the moles of molecular liquid of a set of liquid phases at `t_k`.
    fn excess_enthalpy_of(&self, phases: &[&HashMap<String, f64>], t_k: f64) -> (f64, f64) {
        let mut keys: BTreeSet<&String> = BTreeSet::new();
        for m in phases {
            for (k, &v) in m.iter() {
                if v > 1e-30 {
                    keys.insert(k);
                }
            }
        }
        let comps: Vec<(String, Arc<Molecule>)> = keys
            .into_iter()
            .filter_map(|k| self.molecule(k).filter(|m| m.partitionable()).map(|m| (k.clone(), m)))
            .collect();
        let vecs: Vec<Vec<f64>> = phases.iter().map(|m| comps.iter().map(|(k, _)| m.get(k).copied().unwrap_or(0.0)).collect()).collect();
        let n_mol: f64 = vecs.iter().map(|v| v.iter().sum::<f64>()).sum();

        let mut h_ionic = 0.0;
        for ph in phases {
            h_ionic += ionic_excess_enthalpy_of(ph, t_k);
        }

        if comps.len() < 2 || n_mol <= 0.0 {
            return (h_ionic, n_mol);
        }
        // memoised on temperature (0.05 K) and composition (a part in 1e4 of the molecular liquid): the excess enthalpy per mole
        // varies slowly with both, so most steps find it; it scales with the amount of liquid
        let mut h = DefaultHasher::new();
        ((t_k * 20.0).round() as i64).hash(&mut h);
        for (k, _) in &comps {
            k.hash(&mut h);
        }
        for v in &vecs {
            for x in v {
                ((x / n_mol * 1e4).round() as i64).hash(&mut h);
            }
            0u8.hash(&mut h);
        }
        let key = h.finish();
        {
            let st = self.mixing.borrow();
            if st.cache_key == key && st.cache_value.1 > 0.0 {
                return (st.cache_value.0 / st.cache_value.1 * n_mol + h_ionic, n_mol);
            }
        }
        let mut he = self.excess_enthalpy(&comps, t_k, &vecs, None, None);
        // measured binaries replace the UNIFAC value of their own pair (Kohler combination)
        for p in measured_pairs() {
            let (Some(i), Some(j)) = (
                comps.iter().position(|(_, m)| m.inchikey.as_deref() == Some(p.a.as_str())),
                comps.iter().position(|(_, m)| m.inchikey.as_deref() == Some(p.b.as_str())),
            ) else {
                continue;
            };
            for v in &vecs {
                let (na, nb) = (v[i], v[j]);
                let s = na + nb;
                let total: f64 = v.iter().sum();
                if na <= 0.0 || nb <= 0.0 || total <= 0.0 {
                    continue;
                }
                let x_a = na / s;
                let pair = [comps[i].clone(), comps[j].clone()];
                let model = self.excess_enthalpy(&pair, t_k, &[vec![x_a, 1.0 - x_a]], None, None);
                he += s * s / total * (measured_binary_j_mol(p, x_a) - model);
            }
        }
        let out = (he, n_mol);
        let mut st = self.mixing.borrow_mut();
        st.cache_key = key;
        st.cache_value = out;
        (he + h_ionic, n_mol)
    }

    /// Partial molar excess enthalpy of component `key` in a phase (J/mol).
    pub(crate) fn partial_excess_enthalpy(&self, phase_map: &HashMap<String, f64>, key: &str, t_k: f64) -> f64 {
        let cur = phase_map.get(key).copied().unwrap_or(0.0);
        if cur <= 1e-12 {
            return 0.0;
        }
        let delta = (cur * 1e-4).clamp(1e-7, 1e-4);
        let mut m_plus = phase_map.clone();
        *m_plus.get_mut(key).unwrap() += delta;
        let mut m_minus = phase_map.clone();
        *m_minus.get_mut(key).unwrap() = (cur - delta).max(0.0);
        let (he_plus, _) = self.excess_enthalpy_of(&[&m_plus], t_k);
        let (he_minus, _) = self.excess_enthalpy_of(&[&m_minus], t_k);
        (he_plus - he_minus) / (2.0 * delta)
    }

    fn excess_enthalpy_now(&self) -> (f64, f64) {
        let phases: Vec<&HashMap<String, f64>> = self.liquid_maps().collect();
        self.excess_enthalpy_of(&phases, self.temperature_k)
    }

    /// Total excess (mixing) enthalpy of the liquids, J.
    pub fn excess_enthalpy_j(&self) -> f64 {
        self.excess_enthalpy_now().0
    }

    /// Looks at the contents for the first time: what is in the vessel now has already mixed.
    pub(crate) fn ensure_mixing_reference(&self) {
        if self.mixing.borrow().ref_j_per_mol.is_none() {
            self.rebaseline_mixing();
        }
    }

    /// Accepts the present excess enthalpy as accounted for (no heat): after a change that booked its own heat.
    pub(crate) fn rebaseline_mixing(&self) {
        let (he, n) = self.excess_enthalpy_now();
        self.mixing.borrow_mut().ref_j_per_mol = Some(if n > 0.0 { he / n } else { 0.0 });
    }

    /// Records the stream a dose or pour is about to add (its moles of molecular liquid and its own excess enthalpy), so
    /// that the next `book_mixing_heat` charges only the mixing, not the heat already released when the stream was made.
    pub(crate) fn note_streams_for_mixing(&self, streams: &[&HashMap<String, f64>], t_k: f64) {
        let (he, n) = self.excess_enthalpy_of(streams, t_k);
        let mut st = self.mixing.borrow_mut();
        st.pending_n_in += n;
        st.pending_carried_j += he;
    }

    /// Releases (or absorbs) the heat of mixing of everything that changed since the last accounting and takes the
    /// temperature with it: `Q = H^E(now) - h_ref (n_now - n_in) - H^E(stream)`; positive Q is absorbed and cools.
    pub(crate) fn book_mixing_heat(&mut self) {
        let (he, n) = self.excess_enthalpy_now();
        let (r, n_in, carried) = {
            let mut st = self.mixing.borrow_mut();
            let out = (st.ref_j_per_mol, st.pending_n_in, st.pending_carried_j);
            st.pending_n_in = 0.0;
            st.pending_carried_j = 0.0;
            out
        };
        if let Some(r) = r {
            let q = he - r * (n - n_in).max(0.0) - carried;
            let cp = (self.contents_heat_capacity() + self.glass_heat_capacity()).max(1.0);
            if q.is_finite() && q.abs() > 1e-9 {
                // the excess enthalpy depends weakly on temperature itself: the shift is applied once, the reference is then
                // taken at the new state
                self.temperature_k -= q / cp;
            }
        }
        self.rebaseline_mixing();
    }
}
