//! Aqueous equilibrium + solid/liquid solubility solver for a vessel.
//!
//! Every registered equilibrium is relaxed *exactly* (bisection on the reaction extent, which is monotone in ln Q),
//! with any sparingly-soluble solid that shares ions with the reaction coupled in: solid dissolves/precipitates
//! so that IAP = Ksp holds at every trial extent. This gives the correct Le Chatelier behaviour for arbitrary
//! combinations (CaCO3 in acid, AgCl in ammonia but not AgI, Mg(OH)2 buffering pH, ...) without any damped-Newton
//! oscillation, and without special cases per compound.

use crate::chem_db::GeneralMineral;
use crate::vessel::*;

const R_GAS: f64 = 8.314;
const LN10: f64 = std::f64::consts::LN_10;

fn ln_c(amount_mol: f64, vol_l: f64) -> f64 {
    (amount_mol / vol_l).max(1e-300).ln()
}

/// Solves the saturation of one solid given the amounts (mol) of its ions: returns the amount of solid dissolved
/// (negative = precipitated) so that IAP = Ksp, or the whole solid if it is undersaturated. None if infeasible
/// (an ion would go negative even with all of the solid dissolved).
fn solve_saturation(ion_mol: &[f64], mu: &[f64], solid_mol: f64, vol_l: f64, ln_ksp: f64) -> Option<f64> {
    let mut y_lo = f64::NEG_INFINITY;
    for (a, m) in ion_mol.iter().zip(mu) {
        y_lo = y_lo.max(-a / m);
    }
    let y_hi = solid_mol.max(0.0);
    if y_lo > y_hi + 1e-15 {
        return None;
    }
    let y_lo = y_lo.min(y_hi);
    let ln_iap = |y: f64| -> f64 { ion_mol.iter().zip(mu).map(|(a, m)| m * ln_c((a + m * y).max(0.0), vol_l)).sum() };
    if ln_iap(y_hi) <= ln_ksp {
        return Some(y_hi);
    }
    let (mut lo, mut hi) = (y_lo, y_hi);
    for _ in 0..100 {
        let mid = 0.5 * (lo + hi);
        if ln_iap(mid) > ln_ksp {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    Some(0.5 * (lo + hi))
}

struct MineralLocal {
    idx: usize,
    /// (index into species list, stoichiometric coefficient)
    ions: Vec<(usize, f64)>,
    ln_ksp: f64,
    dh_j: f64,
    solid0: f64,
}

struct EqSystem {
    names: Vec<String>,
    a0: Vec<f64>,
    /// signed stoichiometry of the equilibrium (reactants negative)
    nu: Vec<f64>,
    reac: Vec<(usize, f64)>,
    prod: Vec<(usize, f64)>,
    minerals: Vec<MineralLocal>,
    vol_l: f64,
}

struct EqState {
    amounts: Vec<f64>,
    solids: Vec<f64>,
    ln_q: f64,
}

impl EqSystem {
    /// State after the reaction has advanced by `xi` mol and the coupled solids have re-saturated.
    /// None when the extent is infeasible (a species would go negative).
    fn eval(&self, xi: f64) -> Option<EqState> {
        let mut amounts: Vec<f64> = self.a0.iter().zip(&self.nu).map(|(a, n)| a + n * xi).collect();
        let mut solids: Vec<f64> = self.minerals.iter().map(|m| m.solid0).collect();
        for _pass in 0..4 {
            for (mi, m) in self.minerals.iter().enumerate() {
                let ion_mol: Vec<f64> = m.ions.iter().map(|(i, _)| amounts[*i]).collect();
                let mu: Vec<f64> = m.ions.iter().map(|(_, c)| *c).collect();
                // A solid that cannot yet cover a deficit (another solid may supply it in a later pass) is skipped here;
                // negative amounts left after all passes mark the extent infeasible.
                let y = match solve_saturation(&ion_mol, &mu, solids[mi], self.vol_l, m.ln_ksp) {
                    Some(y) => y,
                    None => continue,
                };
                if y != 0.0 {
                    for (i, c) in &m.ions {
                        amounts[*i] += c * y;
                    }
                    solids[mi] -= y;
                }
            }
        }
        if amounts.iter().any(|a| *a < -1e-14) {
            return None;
        }
        let mut ln_q = 0.0;
        for (i, nu) in &self.prod {
            ln_q += nu * ln_c(amounts[*i], self.vol_l);
        }
        for (i, nu) in &self.reac {
            ln_q -= nu * ln_c(amounts[*i], self.vol_l);
        }
        Some(EqState { amounts, solids, ln_q })
    }
}

impl Vessel {
    /// One relaxation sweep: every aqueous equilibrium is solved exactly, then every solid is saturated.
    /// Returns the reaction heat released (J).
    pub(crate) fn step_equilibria(&mut self, dt_s: f64) -> f64 {
        // Any cation/anion pair that has newly met gets its solubility controlled by the table / solubility rules.
        self.auto_minerals();
        let vol_l = (self.total_liquid_volume_ml() / 1000.0).max(0.001);
        let t_k = self.temperature_k;
        let has_water = self.species_mol.get("H2O").copied().unwrap_or(0.0) * 18.015 > 0.05;
        let mut q_joules = 0.0;

        for e in 0..self.equilibria.len() {
            q_joules += self.relax_equilibrium(e, vol_l, t_k, has_water, dt_s);
        }
        if has_water {
            q_joules += self.saturate_minerals(vol_l, t_k);
        }

        for mol in self.solid_mol.values_mut() {
            if *mol < 1e-7 {
                *mol = 0.0;
            }
        }
        q_joules
    }

    fn mineral_ln_ksp(min: &GeneralMineral, t_k: f64) -> (f64, f64) {
        let dh_j = min.delta_h_kj * 1000.0;
        let log_ksp_t = min.log_ksp_298 + (-dh_j / R_GAS) * (1.0 / t_k - 1.0 / 298.15) / 2.302585;
        (log_ksp_t * LN10, dh_j)
    }

    /// Saturates every solid with its ions (exact IAP = Ksp). Returns heat (J).
    fn saturate_minerals(&mut self, vol_l: f64, t_k: f64) -> f64 {
        let mut q = 0.0;
        for idx in 0..self.minerals.len() {
            let plan = {
                let min = &self.minerals[idx];
                if min.dissolved_products.is_empty() {
                    continue;
                }
                let solid_mol = self.solid_mol.get(&min.solid_species).copied().unwrap_or(0.0);
                let all_present = min.dissolved_products.keys().all(|i| self.species_mol.get(i).copied().unwrap_or(0.0) > 1e-12);
                if solid_mol <= 1e-12 && !all_present {
                    continue;
                }
                let (ln_ksp, dh_j) = Self::mineral_ln_ksp(min, t_k);
                let mut ion_mol = Vec::with_capacity(min.dissolved_products.len());
                let mut mu = Vec::with_capacity(min.dissolved_products.len());
                for (ion, &c) in &min.dissolved_products {
                    ion_mol.push(self.species_mol.get(ion).copied().unwrap_or(0.0).max(0.0));
                    mu.push(c);
                }
                solve_saturation(&ion_mol, &mu, solid_mol, vol_l, ln_ksp).map(|y| (y, dh_j))
            };
            if let Some((y, dh_j)) = plan {
                if y.abs() < 1e-13 {
                    continue;
                }
                let min = self.minerals[idx].clone();
                for (ion, &c) in &min.dissolved_products {
                    let m = self.species_mol.entry(ion.clone()).or_default();
                    *m = (*m + c * y).max(0.0);
                }
                let sm = self.solid_mol.entry(min.solid_species.clone()).or_default();
                *sm = (*sm - y).max(0.0);
                if y < 0.0 {
                    *self.initial_solids.entry(min.solid_species.clone()).or_default() += -y;
                }
                q -= y * dh_j;
            }
        }
        q
    }

    /// Relaxes equilibrium `e` exactly, coupled with any solid that shares its ions. Returns heat (J).
    fn relax_equilibrium(&mut self, e: usize, vol_l: f64, t_k: f64, has_water: bool, dt_s: f64) -> f64 {
        let eq = &self.equilibria[e];
        let dh_j = eq.delta_h_kj * 1000.0;
        let log_k_t = eq.log_k_298 + (-dh_j / R_GAS) * (1.0 / t_k - 1.0 / 298.15) / 2.302585;
        let ln_k = log_k_t * LN10;

        let mut names: Vec<String> = Vec::new();
        let index_of = |name: &str, names: &mut Vec<String>| -> usize {
            if let Some(i) = names.iter().position(|n| n == name) {
                i
            } else {
                names.push(name.to_string());
                names.len() - 1
            }
        };
        let mut reac: Vec<(usize, f64)> = Vec::new();
        let mut prod: Vec<(usize, f64)> = Vec::new();
        for (r, &c) in &eq.reactants {
            if r != "H2O" {
                reac.push((index_of(r, &mut names), c));
            }
        }
        for (p, &c) in &eq.products {
            if p != "H2O" {
                prod.push((index_of(p, &mut names), c));
            }
        }
        if reac.is_empty() && prod.is_empty() {
            return 0.0;
        }

        // Solids sharing ions with this equilibrium (present, or with all ions available to form one)
        let mut minerals: Vec<MineralLocal> = Vec::new();
        if has_water {
            let eq_species: Vec<&String> = eq.reactants.keys().chain(eq.products.keys()).collect();
            for (idx, m) in self.minerals.iter().enumerate() {
                if m.dissolved_products.is_empty() || !m.dissolved_products.keys().any(|k| eq_species.contains(&k)) {
                    continue;
                }
                let solid0 = self.solid_mol.get(&m.solid_species).copied().unwrap_or(0.0);
                let all_present = m.dissolved_products.keys().all(|i| self.species_mol.get(i).copied().unwrap_or(0.0) > 1e-12);
                if solid0 <= 1e-12 && !all_present {
                    continue;
                }
                let mut ions = Vec::new();
                for (ion, &c) in &m.dissolved_products {
                    ions.push((index_of(ion, &mut names), c));
                }
                let (ln_ksp, mdh) = Self::mineral_ln_ksp(m, t_k);
                minerals.push(MineralLocal { idx, ions, ln_ksp, dh_j: mdh, solid0 });
            }
        }

        let a0: Vec<f64> = names.iter().map(|n| self.species_mol.get(n).copied().unwrap_or(0.0).max(0.0)).collect();
        let mut nu = vec![0.0; names.len()];
        for (i, c) in &reac {
            nu[*i] -= c;
        }
        for (i, c) in &prod {
            nu[*i] += c;
        }
        let sys = EqSystem { names, a0, nu, reac, prod, minerals, vol_l };

        // Available supply of each species including solids that can dissolve into it
        let supply = |i: usize| -> f64 {
            let mut s = sys.a0[i];
            for m in &sys.minerals {
                for (j, c) in &m.ions {
                    if *j == i {
                        s += c * m.solid0;
                    }
                }
            }
            s
        };
        let mut xi_hi = f64::INFINITY;
        for (i, c) in &sys.reac {
            xi_hi = xi_hi.min(supply(*i) / c);
        }
        if !xi_hi.is_finite() {
            xi_hi = 10.0 * vol_l; // water autoionisation-type (solvent only on the left)
        }
        let mut xi_lo = f64::INFINITY;
        for (i, c) in &sys.prod {
            xi_lo = xi_lo.min(supply(*i) / c);
        }
        let xi_lo = if xi_lo.is_finite() { -xi_lo } else { 0.0 };

        let start = sys.eval(0.0);
        let log_q_over_k = start.as_ref().map(|s| (s.ln_q - ln_k) / LN10);
        // Already at equilibrium, or the needed direction is blocked because a species is absent (the common case
        // every tick): nothing to do.
        if let Some(s) = &start {
            let blocked = (s.ln_q < ln_k && xi_hi <= 1e-18 / vol_l) || (s.ln_q > ln_k && xi_lo >= -1e-18 / vol_l);
            if blocked {
                return 0.0;
            }
            let moved = s.amounts.iter().zip(&sys.a0).any(|(a, b)| (a - b).abs() > 1e-15);
            if !moved && (s.ln_q - ln_k).abs() < 1e-9 {
                return 0.0;
            }
        }

        // ln Q increases with xi; infeasible extents mean a reactant (xi>0) / product (xi<0) ran out.
        let (mut lo, mut hi) = (xi_lo, xi_hi);
        for _ in 0..80 {
            let mid = 0.5 * (lo + hi);
            let above = match sys.eval(mid) {
                Some(s) => s.ln_q > ln_k,
                None => mid > 0.0,
            };
            if above {
                hi = mid;
            } else {
                lo = mid;
            }
        }
        let xi = 0.5 * (lo + hi);
        if xi.abs() < 1e-15 && sys.minerals.is_empty() {
            return 0.0;
        }
        let state = match sys.eval(xi) {
            Some(s) => s,
            None => return 0.0,
        };

        // Net change check (skip numerical dust)
        let mut max_change: f64 = 0.0;
        for (i, a) in state.amounts.iter().enumerate() {
            max_change = max_change.max((a - sys.a0[i]).abs());
        }
        if max_change < 1e-15 {
            return 0.0;
        }

        let mut q = -xi * dh_j;
        for (i, n) in sys.names.iter().enumerate() {
            let m = self.species_mol.entry(n.clone()).or_default();
            *m = state.amounts[i].max(0.0);
        }
        for (mi, m) in sys.minerals.iter().enumerate() {
            let y = m.solid0 - state.solids[mi];
            if y.abs() > 1e-14 {
                let sp = self.minerals[m.idx].solid_species.clone();
                let sm = self.solid_mol.entry(sp.clone()).or_default();
                *sm = state.solids[mi].max(0.0);
                if y < 0.0 {
                    *self.initial_solids.entry(sp).or_default() += -y;
                }
                q -= y * m.dh_j;
            }
        }

        if xi.abs() > 1e-14 {
            let eq = &self.equilibria[e];
            self.active_reactions.push(ReactionRow {
                id: eq.id.clone(),
                equation: eq.equation.clone(),
                kind: "equilibrium".to_string(),
                rate: xi / (vol_l * dt_s.max(0.001)),
                log_q_over_k,
                tier: eq.tier.clone(),
                source: eq.source.clone(),
                active: true,
            });
        }
        q
    }
}
