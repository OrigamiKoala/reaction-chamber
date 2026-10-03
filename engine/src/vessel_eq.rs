//! Aqueous equilibrium + solid/liquid solubility solver for a vessel.
//!
//! Every registered equilibrium is relaxed *exactly* (bisection on the reaction extent, which is monotone in ln Q),
//! with any sparingly-soluble solid that shares ions with the reaction coupled in: solid dissolves/precipitates
//! so that IAP = Ksp holds at every trial extent. This gives the correct Le Chatelier behaviour for arbitrary
//! combinations (CaCO3 in acid, AgCl in ammonia but not AgI, Mg(OH)2 buffering pH, ...) without any damped-Newton
//! oscillation, and without special cases per compound.

use std::collections::HashMap;
use crate::chem_db::GeneralMineral;
use crate::vessel::*;


const LN10: f64 = std::f64::consts::LN_10;
/// |ln(Q/K)| below which a slow equilibrium row counts as settled and is not relaxed (a numerical tolerance, not physics).
const SLOW_ROW_EQUILIBRIUM_TOL: f64 = 1e-5;

fn ln_c(amount_mol: f64, solv_kg: f64) -> f64 {
    (amount_mol / solv_kg).max(1e-300).ln()
}

/// Solves the saturation of one solid given the amounts (mol) of its ions: returns the amount of solid dissolved
/// (negative = precipitated) so that IAP = Ksp, or the whole solid if it is undersaturated. None if infeasible
/// (an ion would go negative even with all of the solid dissolved).
fn solve_saturation(ion_mol: &[f64], mu: &[f64], solid_mol: f64, solv_kg: f64, ln_ksp: f64) -> Option<f64> {
    solve_saturation_core(ion_mol.len(), |k| ion_mol[k], |k| mu[k], solid_mol, solv_kg, ln_ksp)
}

/// Same, reading the ion amounts straight from the species-amount vector (no per-call allocation: this runs inside the
/// nested bisection of every equilibrium).
fn solve_saturation_idx(ions: &[(usize, f64)], amounts: &[f64], solid_mol: f64, solv_kg: f64, ln_ksp: f64) -> Option<f64> {
    solve_saturation_core(ions.len(), |k| amounts[ions[k].0], |k| ions[k].1, solid_mol, solv_kg, ln_ksp)
}

fn solve_saturation_core(
    n: usize,
    ion: impl Fn(usize) -> f64,
    mu: impl Fn(usize) -> f64,
    solid_mol: f64,
    solv_kg: f64,
    ln_ksp: f64,
) -> Option<f64> {
    let tol = 1e-12 * solv_kg;
    let mut y_lo = f64::NEG_INFINITY;
    for k in 0..n {
        y_lo = y_lo.max(-ion(k) / mu(k));
    }
    let y_hi = solid_mol.max(0.0);
    if y_lo > y_hi + tol {
        return Some(y_hi);
    }
    let y_lo = y_lo.min(y_hi);
    let ln_iap = |y: f64| -> f64 { (0..n).map(|k| mu(k) * ln_c((ion(k) + mu(k) * y).max(0.0), solv_kg)).sum() };
    if ln_iap(y_hi) <= ln_ksp {
        return Some(y_hi);
    }
    // already saturated (a settled solid in contact with its solution): nothing to dissolve or precipitate
    if y_lo <= 0.0 && y_hi >= 0.0 && solid_mol > tol && (ln_iap(0.0) - ln_ksp).abs() < 1e-13 {
        return Some(0.0);
    }
    let (mut lo, mut hi) = (y_lo, y_hi);
    for _ in 0..50 {
        let mid = 0.5 * (lo + hi);
        if ln_iap(mid) > ln_ksp {
            hi = mid;
        } else {
            lo = mid;
        }
        // converged to double precision relative to the amounts involved
        if (hi - lo).abs() <= 1e-15 * lo.abs().max(hi.abs()).max(tol) {
            break;
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
    /// signed stoichiometry of the equilibrium (reactants negative), including the solvent H2O: amounts are conserved
    nu: Vec<f64>,
    reac: Vec<(usize, f64)>,
    prod: Vec<(usize, f64)>,
    minerals: Vec<MineralLocal>,
    solv_kg: f64,
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
            let mut changed = false;
            for (mi, m) in self.minerals.iter().enumerate() {
                // A solid that cannot yet cover a deficit (another solid may supply it in a later pass) is skipped here;
                // negative amounts left after all passes mark the extent infeasible.
                let y = match solve_saturation_idx(&m.ions, &amounts, solids[mi], self.solv_kg, m.ln_ksp) {
                    Some(y) => y,
                    None => continue,
                };
                if y != 0.0 {
                    changed = true;
                    for (i, c) in &m.ions {
                        amounts[*i] += c * y;
                    }
                    solids[mi] -= y;
                }
            }
            if !changed {
                break;
            }
        }
        if amounts.iter().any(|a| *a < -1e-11 * self.solv_kg) {
            return None;
        }
        let mut ln_q = 0.0;
        for (i, nu) in &self.prod {
            ln_q += nu * ln_c(amounts[*i], self.solv_kg);
        }
        for (i, nu) in &self.reac {
            ln_q -= nu * ln_c(amounts[*i], self.solv_kg);
        }
        Some(EqState { amounts, solids, ln_q })
    }
}

impl Vessel {
    /// One equilibrium pass over the vessel's rows. Rows with a rate law (CO2 hydration, ...) are *slow*: the fast rows
    /// (everything else) are solved to equilibrium with the slow rows frozen (the fast manifold); the state the slow rows
    /// would reach with the fast rows following them is then found, and the vessel moves a fraction
    /// 1 - exp(-lambda dt) of the way there, lambda being the net rate of each slow row at the fast-manifold state over its
    /// distance to equilibrium (the exact solution of the linearised rate law; `kinetic_dt_s` is the time the slow rows
    /// advance in this pass). A convex combination of two states that conserve every element and the charge conserves
    /// them too; the fast rows are then settled again around it.
    pub(crate) fn step_equilibria(&mut self, dt_s: f64) -> f64 {
        let slow: Vec<usize> = (0..self.equilibria.len()).filter(|&i| self.equilibria[i].rate.is_some()).collect();
        if slow.is_empty() {
            self.slow_exclude = false;
            return self.step_equilibria_core(dt_s);
        }
        let solv_kg = (self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * 0.01801528).max(1e-12);
        let kin_dt = self.kinetic_dt_s;
        self.slow_exclude = true;
        let mut q = self.step_equilibria_core(dt_s);
        // a slow row matters only when it has something to convert (every reactant or every product present)
        let active: Vec<usize> = slow
            .into_iter()
            .filter(|&i| {
                let eq = &self.equilibria[i];
                let have = |sp: &String| sp == AQUEOUS_SOLVENT || self.species_mol.get(sp).copied().unwrap_or(0.0) > 1e-15 * solv_kg.max(1e-6);
                eq.reactants.keys().all(have) || eq.products.keys().all(have)
            })
            .collect();
        // A slow row that already sits at its equilibrium (the usual state of a settled vessel) has nothing to relax: the
        // concentration quotient of the fast-manifold state is checked before paying for the full solve.
        let off_equilibrium = |this: &Self, i: usize| -> bool {
            let eq = &this.equilibria[i];
            let conc = |sp: &str| this.species_mol.get(sp).copied().unwrap_or(0.0).max(0.0) / solv_kg.max(1e-12);
            let (mut ln_q, mut have_all) = (-eq.log_k_at(this.temperature_k) * std::f64::consts::LN_10, true);
            for (sp, c) in eq.products.iter().filter(|(sp, _)| *sp != AQUEOUS_SOLVENT) {
                let x = conc(sp);
                if x <= 0.0 { have_all = false; break; }
                ln_q += c * x.ln();
            }
            for (sp, c) in eq.reactants.iter().filter(|(sp, _)| *sp != AQUEOUS_SOLVENT) {
                let x = conc(sp);
                if x <= 0.0 { have_all = false; break; }
                ln_q -= c * x.ln();
            }
            !have_all || ln_q.abs() > SLOW_ROW_EQUILIBRIUM_TOL
        };
        let active: Vec<usize> = active.into_iter().filter(|&i| off_equilibrium(self, i)).collect();
        if kin_dt > 0.0 && !active.is_empty() && solv_kg > 0.0 {
            let m0_species = self.species_mol.clone();
            let m0_solid = self.solid_mol.clone();
            let t0 = self.temperature_k;
            let moved0 = self.eq_moved;
            self.slow_exclude = false;
            let q_full = self.step_equilibria_core(dt_s);
            let e_species = self.species_mol.clone();
            let e_solid = self.solid_mol.clone();
            let t_k = self.temperature_k;
            // The slow rows move the species they share: the one that no fast row touches and that moved most between the
            // fast-manifold state and the full equilibrium is the tracer of the slow subsystem, and
            // lambda = |sum of the slow rows' net rates into the tracer| / |distance of the tracer to its equilibrium|.
            let fast_species: std::collections::HashSet<&String> = self
                .equilibria
                .iter()
                .enumerate()
                .filter(|(j, _)| !active.contains(j))
                .flat_map(|(_, e)| e.reactants.keys().chain(e.products.keys()))
                .collect();
            let mut tracer: Option<(&String, f64)> = None; // (species, |distance|)
            for &i in &active {
                let eq = &self.equilibria[i];
                for sp in eq.reactants.keys().chain(eq.products.keys()) {
                    if sp == AQUEOUS_SOLVENT {
                        continue;
                    }
                    let d = (e_species.get(sp).copied().unwrap_or(0.0) - m0_species.get(sp).copied().unwrap_or(0.0)).abs();
                    let score = if fast_species.contains(sp) { d } else { 1e30 + d };
                    if tracer.map_or(true, |(_, b)| score > b) {
                        tracer = Some((sp, score));
                    }
                }
            }
            let mut frac = 1.0;
            if let Some((tr, _)) = tracer {
                let dist = e_species.get(tr).copied().unwrap_or(0.0) - m0_species.get(tr).copied().unwrap_or(0.0);
                let mut rate_into_tracer = 0.0;
                for &i in &active {
                    let eq = &self.equilibria[i];
                    let rate = eq.rate.as_ref().unwrap();
                    let conc = |sp: &str| m0_species.get(sp).copied().unwrap_or(0.0).max(0.0) / solv_kg;
                    let k_f = rate.k_forward(t_k, &conc);
                    let k_eq = (eq.log_k_at(t_k) * std::f64::consts::LN_10).exp().max(1e-300);
                    let (mut fwd, mut rev) = (1.0, 1.0);
                    for (sp, c) in &eq.reactants {
                        if sp != AQUEOUS_SOLVENT {
                            fwd *= conc(sp).powf(*c);
                        }
                    }
                    for (sp, c) in &eq.products {
                        if sp != AQUEOUS_SOLVENT {
                            rev *= conc(sp).powf(*c);
                        }
                    }
                    let r0 = solv_kg * (k_f * fwd - k_f / k_eq * rev); // mol/s, + = forward
                    let nu = eq.products.get(tr).copied().unwrap_or(0.0) - eq.reactants.get(tr).copied().unwrap_or(0.0);
                    rate_into_tracer += nu * r0;
                }
                if dist.abs() > 1e-18 {
                    let lambda = (rate_into_tracer / dist).abs();
                    frac = if lambda.is_finite() { 1.0 - (-lambda * kin_dt).exp() } else { 1.0 };
                } else {
                    frac = 0.0;
                }
            }
            let frac = frac.clamp(0.0, 1.0);
            let mix = |a: &HashMap<String, f64>, b: &HashMap<String, f64>| -> HashMap<String, f64> {
                let mut out = HashMap::new();
                for k in a.keys().chain(b.keys()) {
                    let x = a.get(k).copied().unwrap_or(0.0);
                    let y = b.get(k).copied().unwrap_or(0.0);
                    let v = x + frac * (y - x);
                    if v > 0.0 {
                        out.insert(k.clone(), v);
                    }
                }
                out
            };
            self.temperature_k = t0;
            self.eq_moved = moved0 || frac > 0.0;
            q += frac * q_full;
            if frac >= 1.0 - 1e-9 {
                // fully relaxed: the full equilibrium already satisfies the fast rows
                self.species_mol = e_species;
                self.solid_mol = e_solid;
            } else if frac <= 1e-9 {
                self.species_mol = m0_species;
                self.solid_mol = m0_solid;
            } else {
                self.species_mol = mix(&m0_species, &e_species);
                self.solid_mol = mix(&m0_solid, &e_solid);
                // the fast rows follow the partial state
                self.slow_exclude = true;
                q += self.step_equilibria_core(dt_s);
            }
        }
        self.slow_exclude = false;
        q
    }

    /// One relaxation sweep: every aqueous equilibrium is solved exactly, then every solid is saturated.
    /// Returns the reaction heat released (J).
    pub(crate) fn step_equilibria_core(&mut self, dt_s: f64) -> f64 {
        // Any cation/anion pair that has newly met gets its solubility controlled by the table / solubility rules.
        self.auto_minerals();
        // The solver's concentration basis is the mass of the aqueous solvent (water in kg). Immiscible or miscible
        // co-solvents (ethanol) do not dilute the aqueous chemistry until Stage 3 makes this per-phase. No scale gate:
        // the only requirement is that an aqueous phase exists at all.
        let solv_kg = (self.species_mol.get(AQUEOUS_SOLVENT).copied().unwrap_or(0.0) * 0.01801528).max(1e-12);
        if !self.has_aqueous_phase() || solv_kg <= 0.0 {
            return 0.0;
        }
        let t_k = self.temperature_k;
        let mut q_joules = 0.0;

        // Minerals that can matter right now (solid present, or every ion present): found once per sweep, so each
        // equilibrium looks only at these instead of the whole 130-row table.
        let present_mol = 1e-9 * solv_kg;
        let eps_mol = 1e-15 * solv_kg;
        let active: Vec<usize> = self
            .minerals
            .iter()
            .enumerate()
            .filter(|(_, m)| {
                !m.dissolved_products.is_empty()
                    && !self.blocked_minerals.contains(&m.solid_species)
                    && (self.solid_mol.get(&m.solid_species).copied().unwrap_or(0.0) > eps_mol
                        || m.dissolved_products.keys().all(|i| self.species_mol.get(i).copied().unwrap_or(0.0) > present_mol))
            })
            .map(|(i, _)| i)
            .collect();
        let (gamma_cache, a_w) = crate::activity::batch_aqueous_gamma_and_aw(&self.species_mol, t_k);
        let ln_aw = a_w.max(1e-10).ln();

        for e in 0..self.equilibria.len() {
            q_joules += self.relax_equilibrium(e, solv_kg, t_k, dt_s, &active, &gamma_cache, ln_aw);
        }
        q_joules += self.saturate_minerals(&active, solv_kg, t_k, &gamma_cache);
        q_joules += self.solve_coupled_equilibria(solv_kg, t_k, dt_s);

        // Numerical dust: exact zeros are removed so that species tables only list what is present.
        self.species_mol.retain(|_, m| *m > 0.0);
        self.solid_mol.retain(|_, m| *m > 0.0);
        q_joules
    }

    fn mineral_ln_ksp(min: &GeneralMineral, t_k: f64) -> (f64, f64) {
        let dh_j = min.delta_h_kj * 1000.0;
        let log_ksp_t = min.log_ksp_at(t_k);
        (log_ksp_t * LN10, dh_j)
    }

    /// Saturates every solid with its ions (exact IAP = Ksp). Returns heat (J).
    fn saturate_minerals(&mut self, active: &[usize], solv_kg: f64, t_k: f64, gamma_cache: &std::collections::HashMap<String, f64>) -> f64 {
        let mut q = 0.0;
        let eps_mol = 1e-15 * solv_kg;
        for &idx in active {
            let plan = {
                let min = &self.minerals[idx];
                if min.dissolved_products.is_empty() {
                    continue;
                }
                let solid_mol = self.solid_mol.get(&min.solid_species).copied().unwrap_or(0.0);
                let (ln_ksp, dh_j) = Self::mineral_ln_ksp(min, t_k);
                let mut ln_act_sum = 0.0;
                for (ion, &c) in &min.dissolved_products {
                    ln_act_sum += c * gamma_cache.get(ion).copied().unwrap_or(0.0);
                }
                let ln_ksp_eff = ln_ksp - ln_act_sum;
                if solid_mol > eps_mol {
                    let mut ln_iap = 0.0;
                    let mut can_calc_iap = true;
                    for (ion, &c) in &min.dissolved_products {
                        let amt = self.species_mol.get(ion).copied().unwrap_or(0.0);
                        if amt <= 0.0 { can_calc_iap = false; break; }
                        ln_iap += c * (amt / solv_kg).ln();
                    }
                    if can_calc_iap && (ln_iap - ln_ksp_eff).abs() < 1e-4 {
                        continue;
                    }
                }
                let mut ion_mol = Vec::with_capacity(min.dissolved_products.len());
                let mut mu = Vec::with_capacity(min.dissolved_products.len());
                for (ion, &c) in &min.dissolved_products {
                    ion_mol.push(self.species_mol.get(ion).copied().unwrap_or(0.0).max(0.0));
                    mu.push(c);
                }
                solve_saturation(&ion_mol, &mu, solid_mol, solv_kg, ln_ksp_eff).map(|y| (y, dh_j))
            };
            if let Some((y, dh_j)) = plan {
                if y.abs() < 100.0 * eps_mol {
                    continue;
                }
                let min = self.minerals[idx].clone();
                self.eq_moved = true;
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
    fn relax_equilibrium(
        &mut self,
        e: usize,
        solv_kg: f64,
        t_k: f64,
        dt_s: f64,
        active_minerals: &[usize],
        gamma_cache: &std::collections::HashMap<String, f64>,
        ln_aw: f64,
    ) -> f64 {
        let eq = &self.equilibria[e];
        if eq.rate.is_some() && self.slow_exclude {
            return 0.0;
        }

        // Shortcut: with no active mineral touching this equilibrium it can only move forward (every reactant present)
        // or backward (every product present); otherwise there is nothing to solve.
        let has_supply = |sp: &String| {
            if sp == "H2O" { return true; }
            if self.species_mol.get(sp).copied().unwrap_or(0.0) > 1e-15 * solv_kg {
                return true;
            }
            active_minerals.iter().any(|&mi| {
                let m = &self.minerals[mi];
                m.dissolved_products.contains_key(sp) && self.solid_mol.get(&m.solid_species).copied().unwrap_or(0.0) > 1e-15 * solv_kg
            })
        };
        let forward = eq.reactants.keys().all(has_supply);
        let backward = eq.products.keys().all(has_supply);
        if !forward && !backward {
            return 0.0;
        }

        let touches_mineral = active_minerals.iter().any(|&mi| {
            self.minerals[mi].dissolved_products.keys().any(|k| eq.reactants.contains_key(k) || eq.products.contains_key(k))
        });

        let dh_j = eq.delta_h_kj * 1000.0;
        let mut ln_act_eq = 0.0;
        for (r, &c) in &eq.reactants {
            if r == "H2O" {
                ln_act_eq -= c * ln_aw;
            } else {
                ln_act_eq -= c * gamma_cache.get(r).copied().unwrap_or(0.0);
            }
        }
        for (p, &c) in &eq.products {
            if p == "H2O" {
                ln_act_eq += c * ln_aw;
            } else {
                ln_act_eq += c * gamma_cache.get(p).copied().unwrap_or(0.0);
            }
        }
        let ln_k = eq.log_k_at(t_k) * LN10 - ln_act_eq;
        if !touches_mineral {
            let mut ln_q = 0.0;
            let mut can_calc_q = true;
            for (r, &c) in &eq.reactants {
                if r != "H2O" {
                    let amt = self.species_mol.get(r).copied().unwrap_or(0.0);
                    if amt <= 0.0 { can_calc_q = false; break; }
                    ln_q -= c * (amt / solv_kg).ln();
                }
            }
            if can_calc_q {
                for (p, &c) in &eq.products {
                    if p != "H2O" {
                        let amt = self.species_mol.get(p).copied().unwrap_or(0.0);
                        if amt <= 0.0 { can_calc_q = false; break; }
                        ln_q += c * (amt / solv_kg).ln();
                    }
                }
                if can_calc_q && (ln_q - ln_k).abs() < 1e-4 {
                    return 0.0;
                }
            }
        }
        // concentration-scaled tolerances: 1e-15 M and 1e-9 M expressed as amounts in this vessel
        let eps_mol = 1e-15 * solv_kg;
        let present_mol = 1e-9 * solv_kg;

        let mut names: Vec<String> = Vec::new();
        let index_of = |name: &str, names: &mut Vec<String>| -> usize {
            if let Some(i) = names.iter().position(|n| n == name) {
                i
            } else {
                names.push(name.to_string());
                names.len() - 1
            }
        };
        // `reac`/`prod` define ln Q: the solvent H2O is left out there (activity 1 until Stage 3), but it IS kept in
        // the stoichiometry `nu` below, so its amount is consumed / produced and element balance holds.
        let mut reac: Vec<(usize, f64)> = Vec::new();
        let mut prod: Vec<(usize, f64)> = Vec::new();
        let mut solvent_nu: Vec<(usize, f64)> = Vec::new();
        for (r, &c) in &eq.reactants {
            let i = index_of(r, &mut names);
            if r == "H2O" {
                solvent_nu.push((i, -c));
            } else {
                reac.push((i, c));
            }
        }
        for (p, &c) in &eq.products {
            let i = index_of(p, &mut names);
            if p == "H2O" {
                solvent_nu.push((i, c));
            } else {
                prod.push((i, c));
            }
        }
        if reac.is_empty() && prod.is_empty() {
            return 0.0;
        }

        // Solids sharing ions with this equilibrium (present, or with all ions available to form one)
        let mut minerals: Vec<MineralLocal> = Vec::new();
        {
            let eq_species: Vec<&String> = eq.reactants.keys().chain(eq.products.keys()).collect();
            for &idx in active_minerals {
                let m = &self.minerals[idx];
                if m.dissolved_products.is_empty() || !m.dissolved_products.keys().any(|k| eq_species.contains(&k)) {
                    continue;
                }
                let solid0 = self.solid_mol.get(&m.solid_species).copied().unwrap_or(0.0);
                let all_present = m.dissolved_products.keys().all(|i| self.species_mol.get(i).copied().unwrap_or(0.0) > present_mol);
                if solid0 <= eps_mol && !all_present {
                    continue;
                }
                let mut ions = Vec::new();
                for (ion, &c) in &m.dissolved_products {
                    ions.push((index_of(ion, &mut names), c));
                }
                let (ln_ksp, mdh) = Self::mineral_ln_ksp(m, t_k);
                let mut ln_act_min = 0.0;
                for (ion, &c) in &m.dissolved_products {
                    ln_act_min += c * gamma_cache.get(ion).copied().unwrap_or(0.0);
                }
                let ln_ksp_eff = ln_ksp - ln_act_min;
                minerals.push(MineralLocal { idx, ions, ln_ksp: ln_ksp_eff, dh_j: mdh, solid0 });
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
        for (i, c) in &solvent_nu {
            nu[*i] += c;
        }
        let sys = EqSystem { names, a0, nu, reac, prod, minerals, solv_kg };

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
            xi_hi = 10.0 * solv_kg; // water autoionisation-type (solvent only on the left)
        }
        let mut xi_lo = f64::INFINITY;
        for (i, c) in &sys.prod {
            xi_lo = xi_lo.min(supply(*i) / c);
        }
        let xi_lo = if xi_lo.is_finite() { -xi_lo } else { 0.0 };
        if xi_hi <= 1e-18 * solv_kg && xi_lo >= -1e-18 * solv_kg {
            return 0.0;
        }

        let start = sys.eval(0.0);
        let log_q_over_k = start.as_ref().map(|s| (s.ln_q - ln_k) / LN10);
        // Already at equilibrium, or the needed direction is blocked because a species is absent (the common case
        // every tick): nothing to do.
        if let Some(s) = &start {
            let blocked = (s.ln_q < ln_k && xi_hi <= 1e-18 * solv_kg) || (s.ln_q > ln_k && xi_lo >= -1e-18 * solv_kg);
            if blocked {
                return 0.0;
            }
            // changes below 1e-9 of an amount (or of the 1e-9 M floor) are solver noise from the coupled Newton solve,
            // not a state to relax: without this every tick re-ran the full nested bisection on settled equilibria
            let moved = s.amounts.iter().zip(&sys.a0).any(|(a, b)| (a - b).abs() > 1e-9 * a.max(*b).max(present_mol));
            if !moved && (s.ln_q - ln_k).abs() < 1e-4 {
                return 0.0;
            }
        }

        // ln Q increases with xi; infeasible extents mean a reactant (xi>0) / product (xi<0) ran out.
        // Safeguarded Illinois (regula falsi that halves the retained end's weight when the same end is kept twice) on
        // f = ln Q - ln K, with a bisection step whenever the secant point is not inside the bracket or the bracket has not
        // halved: the same bracket and tolerance as plain bisection, in a fraction of the evaluations.
        let (mut lo, mut hi) = (xi_lo, xi_hi);
        let (mut f_lo, mut f_hi): (Option<f64>, Option<f64>) = (None, None); // None: infeasible or not yet evaluated
        let mut last_kept = 0i8;
        let mut width_before = (hi - lo).abs();
        for it in 0..80 {
            // 1e-10 relative is far below any observable and the coupled Newton solve that follows polishes the result
            if (hi - lo).abs() <= 1e-10 * lo.abs().max(hi.abs()).max(eps_mol) {
                break;
            }
            let bisect = it % 3 == 2 && (hi - lo).abs() > 0.5 * width_before;
            if it % 3 == 0 {
                width_before = (hi - lo).abs();
            }
            let secant = match (f_lo, f_hi) {
                (Some(fl), Some(fh)) if !bisect && fh > fl => {
                    let x = hi - fh * (hi - lo) / (fh - fl);
                    if x > lo && x < hi { Some(x) } else { None }
                }
                _ => None,
            };
            let x = secant.unwrap_or(0.5 * (lo + hi));
            let f = sys.eval(x).map(|s| s.ln_q - ln_k);
            let above = match f {
                Some(v) => v > 0.0,
                None => x > 0.0,
            };
            if above {
                hi = x;
                f_hi = f;
                if last_kept == 1 {
                    if let Some(fl) = f_lo.as_mut() {
                        *fl *= 0.5;
                    }
                }
                last_kept = 1;
            } else {
                lo = x;
                f_lo = f;
                if last_kept == -1 {
                    if let Some(fh) = f_hi.as_mut() {
                        *fh *= 0.5;
                    }
                }
                last_kept = -1;
            }
        }
        let xi = 0.5 * (lo + hi);
        if xi.abs() < eps_mol && sys.minerals.is_empty() {
            return 0.0;
        }
        let state = match sys.eval(xi) {
            Some(s) => s,
            None => return 0.0,
        };

        // Net change check (skip numerical dust)
        let mut max_change: f64 = 0.0;
        for (i, a) in state.amounts.iter().enumerate() {
            max_change = max_change.max((a - sys.a0[i]).abs() / a.max(sys.a0[i]).max(present_mol));
        }
        if max_change < 1e-6 {
            return 0.0;
        }
        self.eq_moved = true;

        let mut q = -xi * dh_j;
        for (i, n) in sys.names.iter().enumerate() {
            let a = state.amounts[i].max(0.0);
            if a > 0.0 {
                self.species_mol.insert(n.clone(), a);
            } else if let Some(m) = self.species_mol.get_mut(n) {
                *m = 0.0; // pruned at the end of the solve; never insert a zero-amount species
            }
        }
        for (mi, m) in sys.minerals.iter().enumerate() {
            let y = m.solid0 - state.solids[mi];
            if y.abs() > 10.0 * eps_mol {
                let sp = self.minerals[m.idx].solid_species.clone();
                let sm = self.solid_mol.entry(sp.clone()).or_default();
                *sm = state.solids[mi].max(0.0);
                if y < 0.0 {
                    *self.initial_solids.entry(sp).or_default() += -y;
                }
                q -= y * m.dh_j;
            }
        }

        if xi.abs() > 10.0 * eps_mol {
            let eq = &self.equilibria[e];
            self.active_reactions.push(ReactionRow {
                id: eq.id.clone(),
                equation: eq.equation.clone(),
                kind: "equilibrium".to_string(),
                rate: xi / (solv_kg * dt_s.max(0.001)),
                log_q_over_k,
                tier: eq.tier.clone(),
                source: eq.source.clone(),
                active: true,
            });
        }
        q
    }

    /// Solves every aqueous equilibrium and every mineral solubility equilibrium simultaneously.
    ///
    /// The equilibrium state of an ideal solution minimises F(xi) = sum_i [n_i ln(n_i/V) - n_i] - sum_r xi_r ln K_r over
    /// the reaction extents xi (n = n0 + N^T xi), a convex function with gradient f_r = ln Q_r - ln K_r and Hessian
    /// H = N^T diag(1/n) N. Dissolving solids add the bound xi_m <= solid_m (solid activity is 1, so a mineral
    /// reaction is f = ln IAP - ln Ksp). Damped projected Newton from the current (interior) state converges to the unique
    /// minimum regardless of how the contents were assembled. The result is only committed if it reduces the residual,
    /// so on any numerical trouble the state from the preceding sweeps is kept. Returns heat released (J).
    fn solve_coupled_equilibria(&mut self, solv_kg: f64, t_k: f64, dt_s: f64) -> f64 {
        self.eq_converged = false;
        struct Rxn {
            eq: Option<usize>,
            min: Option<usize>,
            /// species entering ln Q (and the Hessian)
            nu: Vec<(usize, f64)>,
            /// solvent stoichiometry: amounts change, activity stays 1
            nu_solv: Vec<(usize, f64)>,
            ln_k: f64,
            dh_j: f64,
            upper: f64,
            /// Largest extent of precipitation (a negative bound): a supersaturated mineral's kinetic amount.
            lower: f64,
        }
        let mut names: Vec<String> = Vec::new();
        let mut idx_of: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        let mut get_idx = |name: &str, names: &mut Vec<String>| -> usize {
            if let Some(&i) = idx_of.get(name) {
                return i;
            }
            names.push(name.to_string());
            idx_of.insert(name.to_string(), names.len() - 1);
            names.len() - 1
        };
        let amount = |m: &Vessel, n: &str| m.species_mol.get(n).copied().unwrap_or(0.0).max(0.0);
        const TINY: f64 = 1e-30;
        let eps_mol = 1e-15 * solv_kg;
        let present_mol = 1e-9 * solv_kg;

        let mut rxns: Vec<Rxn> = Vec::new();
        for (e, eq) in self.equilibria.iter().enumerate() {
            if eq.rate.is_some() && self.slow_exclude {
                continue; // a row with a rate law is not on the fast manifold (see `step_equilibria`)
            }
            let mut nu: Vec<(usize, f64)> = Vec::new();
            let mut nu_solv: Vec<(usize, f64)> = Vec::new();
            let mut ok = true;
            for (r, &c) in &eq.reactants {
                if r != "H2O" {
                    ok &= amount(self, r) > TINY;
                    nu.push((get_idx(r, &mut names), -c));
                } else {
                    nu_solv.push((get_idx(r, &mut names), -c));
                }
            }
            for (p, &c) in &eq.products {
                if p != "H2O" {
                    ok &= amount(self, p) > TINY;
                    nu.push((get_idx(p, &mut names), c));
                } else {
                    nu_solv.push((get_idx(p, &mut names), c));
                }
            }
            if !ok || nu.is_empty() {
                continue;
            }
            let dh_j = eq.delta_h_kj * 1000.0;
            rxns.push(Rxn { eq: Some(e), min: None, nu, nu_solv, ln_k: eq.log_k_at(t_k) * LN10, dh_j, upper: f64::INFINITY, lower: f64::NEG_INFINITY });
        }
        for (mi, m) in self.minerals.iter().enumerate() {
            if m.dissolved_products.is_empty() {
                continue;
            }
            // a supersaturated mineral forms only up to its kinetic amount (see `step_equilibria_limited`)
            let lower = if self.blocked_minerals.contains(&m.solid_species) {
                match self.precip_cap.get(&m.solid_species) {
                    Some(&c) if c > 0.0 => -c,
                    _ => continue,
                }
            } else {
                f64::NEG_INFINITY
            };
            let solid0 = self.solid_mol.get(&m.solid_species).copied().unwrap_or(0.0).max(0.0);
            let all_present = m.dissolved_products.keys().all(|i| amount(self, i) > present_mol);
            if solid0 <= eps_mol && !all_present {
                continue;
            }
            if !m.dissolved_products.keys().all(|i| amount(self, i) > TINY) {
                continue;
            }
            let mut nu: Vec<(usize, f64)> = Vec::new();
            for (ion, &c) in &m.dissolved_products {
                nu.push((get_idx(ion, &mut names), c));
            }
            let (ln_ksp, dh_j) = Self::mineral_ln_ksp(m, t_k);
            rxns.push(Rxn { eq: None, min: Some(mi), nu, nu_solv: Vec::new(), ln_k: ln_ksp, dh_j, upper: solid0, lower });
        }
        let nr = rxns.len();
        if nr == 0 {
            self.eq_converged = true;
            return 0.0;
        }
        let n0: Vec<f64> = names.iter().map(|n| amount(self, n)).collect();
        let ns = names.len();

        let compute_amounts = |x: &[f64], n: &mut [f64]| {
            n.copy_from_slice(&n0);
            for (r, rx) in rxns.iter().enumerate() {
                let xr = x[r];
                if xr != 0.0 {
                    for (i, c) in rx.nu.iter().chain(rx.nu_solv.iter()) {
                        n[*i] += c * xr;
                    }
                }
            }
        };
        let compute_act_corr = |n_vec: &[f64]| -> Vec<f64> {
            let (gamma_cache, a_w) = crate::activity::batch_aqueous_gamma_and_aw_from_slices(
                &names,
                n_vec,
                &self.species_mol,
                t_k,
            );
            let ln_aw = a_w.max(1e-10).ln();
            let mut corr = vec![0.0; nr];
            for (r, rx) in rxns.iter().enumerate() {
                let mut c_sum = 0.0;
                for (i, c) in &rx.nu {
                    c_sum += c * gamma_cache.get(&names[*i]).copied().unwrap_or(0.0);
                }
                for (i, c) in &rx.nu_solv {
                    if names[*i] == "H2O" {
                        c_sum += c * ln_aw;
                    }
                }
                corr[r] = c_sum;
            }
            corr
        };

        let mut act_corr = compute_act_corr(&n0);
        let residual = |n: &[f64], act: &[f64]| -> Vec<f64> {
            rxns.iter()
                .enumerate()
                .map(|(r, rx)| rx.nu.iter().map(|(i, c)| c * ln_c(n[*i], solv_kg)).sum::<f64>() + act[r] - rx.ln_k)
                .collect()
        };
        // Bound-aware merit: a dissolving solid already fully consumed whose residual still wants more is satisfied.
        let free_mask = |x: &[f64], f: &[f64]| -> Vec<bool> {
            (0..nr)
                .map(|r| {
                    !(rxns[r].upper.is_finite() && x[r] >= rxns[r].upper - 1e-3 * eps_mol && f[r] < 0.0)
                        && !(rxns[r].lower.is_finite() && x[r] <= rxns[r].lower + 1e-3 * eps_mol && f[r] > 0.0)
                })
                .collect()
        };
        let merit = |f: &[f64], free: &[bool]| -> f64 {
            (0..nr).filter(|r| free[*r]).map(|r| f[r].abs()).fold(0.0, f64::max)
        };

        let mut x = vec![0.0; nr];
        let mut n = n0.clone();
        let mut f = residual(&n, &act_corr);
        let f_start = f.clone();
        let mut free = free_mask(&x, &f);
        let merit_start = merit(&f, &free);
        if merit_start < 1e-4 {
            self.eq_converged = true;
            return 0.0;
        }
        let mut cur = merit_start;
        // reactions held at a bound by the coupling with the others (an active set): solved around, not through
        let mut pinned = vec![false; nr];

        for _outer in 0..2 {
            for _iter in 0..30 {
                if cur < 1e-7 {
                    break;
                }
                let fidx: Vec<usize> = (0..nr).filter(|r| free[*r] && !pinned[*r]).collect();
                let m = fidx.len();
                if m == 0 {
                    break;
                }
                // Newton system  H d = -f  on the free reactions, Jacobi-scaled, lightly regularised
                let mut h = vec![vec![0.0; m]; m];
                for (a, &ra) in fidx.iter().enumerate() {
                    for (b, &rb) in fidx.iter().enumerate() {
                        let mut s = 0.0;
                        for (i, ca) in &rxns[ra].nu {
                            for (j, cb) in &rxns[rb].nu {
                                if i == j {
                                    s += ca * cb / n[*i].max(1e-300);
                                }
                            }
                        }
                        h[a][b] = s;
                    }
                }
                let scale: Vec<f64> = (0..m).map(|a| 1.0 / h[a][a].max(1e-300).sqrt()).collect();
                let mut aug = vec![vec![0.0; m + 1]; m];
                for a in 0..m {
                    for b in 0..m {
                        aug[a][b] = h[a][b] * scale[a] * scale[b];
                    }
                    aug[a][a] += 1e-11;
                    aug[a][m] = -f[fidx[a]] * scale[a];
                }
                let mut singular = false;
                for col in 0..m {
                    let mut piv = col;
                    for r in col + 1..m {
                        if aug[r][col].abs() > aug[piv][col].abs() {
                            piv = r;
                        }
                    }
                    if aug[piv][col].abs() < 1e-14 {
                        singular = true;
                        break;
                    }
                    aug.swap(col, piv);
                    for r in col + 1..m {
                        let fct = aug[r][col] / aug[col][col];
                        for c in col..=m {
                            aug[r][c] -= fct * aug[col][c];
                        }
                    }
                }
                if singular {
                    break;
                }
                let mut d = vec![0.0; nr];
                let mut y = vec![0.0; m];
                for a in (0..m).rev() {
                    let mut s = aug[a][m];
                    for b in a + 1..m {
                        s -= aug[a][b] * y[b];
                    }
                    y[a] = s / aug[a][a];
                }
                for a in 0..m {
                    d[fidx[a]] = y[a] * scale[a];
                }

                // largest step that keeps every amount positive and every dissolving solid within what is present
                let mut dn = vec![0.0; ns];
                for (r, rx) in rxns.iter().enumerate() {
                    for (i, c) in rx.nu.iter().chain(rx.nu_solv.iter()) {
                        dn[*i] += c * d[r];
                    }
                }
                let mut alpha: f64 = 1.0;
                let mut bound_hit: Option<usize> = None;
                for i in 0..ns {
                    if dn[i] < 0.0 {
                        alpha = alpha.min(0.9 * n[i] / -dn[i]);
                    }
                }
                let mut bound_is_lower = false;
                for r in 0..nr {
                    if rxns[r].upper.is_finite() && d[r] > 0.0 {
                        let a_max = (rxns[r].upper - x[r]) / d[r];
                        if a_max <= alpha {
                            alpha = a_max;
                            bound_hit = Some(r);
                            bound_is_lower = false;
                        }
                    }
                    if rxns[r].lower.is_finite() && d[r] < 0.0 {
                        let a_max = (rxns[r].lower - x[r]) / d[r];
                        if a_max <= alpha {
                            alpha = a_max;
                            bound_hit = Some(r);
                            bound_is_lower = true;
                        }
                    }
                }
                if !(alpha > 0.0) {
                    match bound_hit {
                        Some(r) if !pinned[r] => {
                            pinned[r] = true;
                            continue;
                        }
                        _ => break,
                    }
                }

                // backtrack until the residual does not grow
                let mut accepted = false;
                let mut x_try = vec![0.0; nr];
                let mut n_try = vec![0.0; ns];
                let mut f_try = vec![0.0; nr];
                let mut free_try = vec![false; nr];
                let mut ln_c_try = vec![0.0; ns];
                for _ in 0..40 {
                    for r in 0..nr {
                        x_try[r] = x[r] + alpha * d[r];
                    }
                    if let Some(r) = bound_hit {
                        if bound_is_lower {
                            if alpha == (rxns[r].lower - x[r]) / d[r] {
                                x_try[r] = rxns[r].lower;
                            }
                        } else if alpha == (rxns[r].upper - x[r]) / d[r] {
                            x_try[r] = rxns[r].upper;
                        }
                    }
                    compute_amounts(&x_try, &mut n_try);
                    if n_try.iter().any(|v| *v < 0.0) {
                        alpha *= 0.5;
                        bound_hit = None;
                        continue;
                    }
                    for i in 0..ns {
                        ln_c_try[i] = ln_c(n_try[i], solv_kg);
                    }
                    let mut mer = 0.0_f64;
                    for (r, rx) in rxns.iter().enumerate() {
                        let f_val = rx.nu.iter().map(|(i, c)| c * ln_c_try[*i]).sum::<f64>() + act_corr[r] - rx.ln_k;
                        f_try[r] = f_val;
                        let is_free = !(rx.upper.is_finite() && x_try[r] >= rx.upper - 1e-3 * eps_mol && f_val < 0.0)
                            && !(rx.lower.is_finite() && x_try[r] <= rx.lower + 1e-3 * eps_mol && f_val > 0.0);
                        free_try[r] = is_free;
                        if is_free && f_val.abs() > mer {
                            mer = f_val.abs();
                        }
                    }
                    if mer < cur || mer < 1e-11 {
                        x.copy_from_slice(&x_try);
                        n.copy_from_slice(&n_try);
                        f.copy_from_slice(&f_try);
                        free.copy_from_slice(&free_try);
                        cur = mer;
                        accepted = true;
                        break;
                    }
                    alpha *= 0.5;
                    bound_hit = None;
                }
                if !accepted {
                    break;
                }
            }
            let next_act_corr = compute_act_corr(&n);
            let d_act = (0..nr).map(|r| (next_act_corr[r] - act_corr[r]).abs()).fold(0.0, f64::max);
            act_corr = next_act_corr;
            f = residual(&n, &act_corr);
            free = free_mask(&x, &f);
            cur = merit(&f, &free);
            if d_act < 1e-3 || cur < 1e-6 {
                break;
            }
        }
        self.eq_converged = cur < 1e-4;
        if !(cur < merit_start) {
            return 0.0;
        }

        // Commit
        let max_move = x.iter().map(|v| v.abs()).fold(0.0, f64::max);
        if max_move > 1e-10 {
            self.eq_moved = true;
        }
        let mut q = 0.0;
        for (i, name) in names.iter().enumerate() {
            let a = n[i].max(0.0);
            if a > 0.0 {
                self.species_mol.insert(name.clone(), a);
            } else if let Some(m) = self.species_mol.get_mut(name) {
                *m = 0.0;
            }
        }
        for (r, rx) in rxns.iter().enumerate() {
            let xi = x[r];
            if xi == 0.0 {
                continue;
            }
            q -= xi * rx.dh_j;
            if let Some(mi) = rx.min {
                let sp = self.minerals[mi].solid_species.clone();
                let sm = self.solid_mol.entry(sp.clone()).or_default();
                *sm = (*sm - xi).max(0.0);
                if xi < 0.0 {
                    *self.initial_solids.entry(sp).or_default() += -xi;
                }
            }
            if let (Some(e), true) = (rx.eq, xi.abs() > 10.0 * eps_mol) {
                let rate = xi / (solv_kg * dt_s.max(0.001));
                if let Some(row) = self.active_reactions.iter_mut().find(|row| row.id == self.equilibria[e].id) {
                    row.rate += rate;
                } else {
                    let eq = &self.equilibria[e];
                    self.active_reactions.push(ReactionRow {
                        id: eq.id.clone(),
                        equation: eq.equation.clone(),
                        kind: "equilibrium".to_string(),
                        rate,
                        log_q_over_k: Some(f_start[r] / LN10),
                        tier: eq.tier.clone(),
                        source: eq.source.clone(),
                        active: true,
                    });
                }
            }
        }
        q
    }
}
