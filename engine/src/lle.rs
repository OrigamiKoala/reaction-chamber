//! Liquid-liquid equilibrium: Michelsen tangent-plane stability analysis and the multiphase split (Stage 5).
//!
//! Which liquids mix is not stored anywhere. Given the amounts of the molecular components of a vessel and the activity
//! model of `molecule::Mixture` (UNIFAC with data corrections, electrolytes in the water-containing phase), this module
//! decides how many liquid phases there are and what each holds:
//!
//!   1. **Stability.** With `d_i = ln x_i + ln gamma_i(x)` of the feed, a trial phase `W` is a stationary point of
//!      `tm(W) = sum W_i (ln W_i + ln gamma_i(w) - d_i - 1)`; the feed is unstable when a nontrivial stationary point has
//!      `sum W_i > 1` (negative tangent-plane distance). Stationary points are found by successive substitution
//!      `ln W_i = d_i - ln gamma_i(w)` from a pure-component-rich start for every component and a uniform start.
//!   2. **Split.** The unstable trial seeds a second phase; the K-phase flash iterates the equal-activity conditions
//!      `x_ip gamma_ip = x_i0 gamma_i0` (successive substitution on the K values), solving the multiphase Rachford-Rice
//!      problem (Michelsen's concave objective `sum z_i ln t_i`) for the phase fractions at every iteration. A phase whose
//!      fraction reaches zero is dropped.
//!   3. **Third phase.** Each resulting phase is tested against the others; a negative distance adds a phase (at most
//!      three liquid phases).
//!
//! The ions live in the phase with the most water (`has_ions`): their ionic water activity and salting-out of the neutral
//! components are part of that phase's activity coefficients.

use crate::molecule::{IonEnv, Mixture};

const STAB_TOL: f64 = 1e-7;
const MAX_PHASES: usize = 3;

#[derive(Clone, Debug)]
pub struct LleResult {
    /// Amounts (mol) of every component in each liquid phase; phase 0 is the one the feed fell into (the ion phase).
    pub phases: Vec<Vec<f64>>,
    /// Index of the phase that holds the ions (the most water-rich), if there are ions and a water component.
    pub ion_phase: Option<usize>,
}

fn normalise(n: &[f64]) -> Vec<f64> {
    let t: f64 = n.iter().filter(|v| **v > 0.0).sum();
    n.iter().map(|v| if t > 0.0 { v.max(0.0) / t } else { 0.0 }).collect()
}

/// Index of the phase richest in water (the component `water`), for the ion assignment.
fn ion_phase_of(mix: &Mixture, comp: &[Vec<f64>]) -> Option<usize> {
    let w = mix.water?;
    let mut best = 0;
    let mut best_x = -1.0;
    for (p, x) in comp.iter().enumerate() {
        if x[w] > best_x {
            best_x = x[w];
            best = p;
        }
    }
    Some(best)
}

fn ln_gamma_phase(mix: &Mixture, x: &[f64], ions: Option<&IonEnv>, phase_has_ions: bool) -> Vec<f64> {
    mix.ln_gamma(x, if phase_has_ions { ions } else { None })
}

/// Successive-substitution search for a stationary point of the tangent-plane distance from the start `w0` (a normalised
/// composition). Returns (sum W, w) at convergence, or None when it collapsed to the reference composition.
fn trial_stationary(mix: &Mixture, d: &[f64], x_ref: &[f64], w0: &[f64]) -> Option<(f64, Vec<f64>)> {
    let n = d.len();
    let mut ln_w: Vec<f64> = (0..n).map(|i| if w0[i] > 0.0 { w0[i].ln() } else { -700.0 }).collect();
    let mut w = w0.to_vec();
    let mut sum_w = 1.0;
    for it in 0..600 {
        let lg = mix.ln_gamma(&w, None);
        let mut max_d: f64 = 0.0;
        for i in 0..n {
            if x_ref[i] <= 0.0 {
                continue;
            }
            let new = d[i] - lg[i];
            max_d = max_d.max((new - ln_w[i]).abs());
            ln_w[i] = new;
        }
        let mx = ln_w.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        if mx > 50.0 {
            return None; // diverging towards a huge phase: no finite stationary point from this start
        }
        let ws: Vec<f64> = (0..n).map(|i| if x_ref[i] > 0.0 { ln_w[i].exp() } else { 0.0 }).collect();
        sum_w = ws.iter().sum();
        w = ws.iter().map(|v| v / sum_w.max(1e-300)).collect();
        if max_d < 1e-11 {
            break;
        }
        if it == 599 {
            return None;
        }
    }
    let dist: f64 = (0..n).map(|i| (w[i] - x_ref[i]).abs()).sum();
    if dist < 1e-5 {
        return None; // the trivial solution
    }
    Some((sum_w, w))
}

/// Most negative tangent-plane distance trial composition against the reference composition `x_ref` (with its own
/// environment), searching from every pure-rich start, a uniform start and the compositions in `extra_starts`.
fn find_unstable_trial(mix: &Mixture, x_ref: &[f64], ref_has_ions: bool, ions: Option<&IonEnv>, extra_starts: &[Vec<f64>]) -> Option<Vec<f64>> {
    let n = x_ref.len();
    let lg_ref = ln_gamma_phase(mix, x_ref, ions, ref_has_ions);
    let d: Vec<f64> = (0..n).map(|i| if x_ref[i] > 0.0 { x_ref[i].ln() + lg_ref[i] } else { 0.0 }).collect();
    let active: Vec<usize> = (0..n).filter(|&i| x_ref[i] > 0.0).collect();
    if active.len() < 2 {
        return None;
    }
    let mut starts: Vec<Vec<f64>> = Vec::new();
    for &k in &active {
        let mut s = vec![0.0; n];
        let rest = 0.01 / (active.len() - 1) as f64;
        for &i in &active {
            s[i] = if i == k { 0.99 } else { rest };
        }
        starts.push(s);
    }
    let u = 1.0 / active.len() as f64;
    starts.push((0..n).map(|i| if x_ref[i] > 0.0 { u } else { 0.0 }).collect());
    for s in extra_starts {
        starts.push(s.clone());
    }
    let mut best: Option<(f64, Vec<f64>)> = None;
    for s in starts {
        if let Some((sum_w, w)) = trial_stationary(mix, &d, x_ref, &s) {
            if sum_w > 1.0 + STAB_TOL && best.as_ref().map_or(true, |(b, _)| sum_w > *b) {
                best = Some((sum_w, w));
            }
        }
    }
    best.map(|(_, w)| w)
}

/// Multiphase Rachford-Rice: phase fractions `beta[p]` (p = 1..) of the non-reference phases by Newton ascent on the
/// concave objective `F(beta) = sum_i z_i ln t_i`, `t_i = 1 + sum_p beta_p (K_ip - 1)`. Returns None when the solution lies
/// on the boundary (a phase vanishes): the caller drops that phase.
fn rachford_rice(z: &[f64], k: &[Vec<f64>], beta0: &[f64]) -> Result<Vec<f64>, usize> {
    let m = k.len(); // number of non-reference phases
    let n = z.len();
    let mut beta: Vec<f64> = beta0.to_vec();
    let t_of = |b: &[f64]| -> Vec<f64> { (0..n).map(|i| 1.0 + (0..m).map(|p| b[p] * (k[p][i] - 1.0)).sum::<f64>()).collect() };
    for _ in 0..200 {
        let t = t_of(&beta);
        let mut g = vec![0.0; m];
        let mut h = vec![vec![0.0; m]; m];
        for i in 0..n {
            if z[i] <= 0.0 {
                continue;
            }
            for p in 0..m {
                g[p] += z[i] * (k[p][i] - 1.0) / t[i];
                for q in 0..m {
                    h[p][q] -= z[i] * (k[p][i] - 1.0) * (k[q][i] - 1.0) / (t[i] * t[i]);
                }
            }
        }
        // a phase pinned at zero whose gradient points inward is the answer: it vanishes
        for p in 0..m {
            if beta[p] <= 1e-14 && g[p] < 0.0 {
                return Err(p);
            }
        }
        // Newton step on the free phases: H d = -g (H negative definite)
        let mut a = vec![vec![0.0; m + 1]; m];
        for p in 0..m {
            for q in 0..m {
                a[p][q] = h[p][q];
            }
            a[p][p] -= 1e-14;
            a[p][m] = -g[p];
        }
        for c in 0..m {
            let mut piv = c;
            for r in c + 1..m {
                if a[r][c].abs() > a[piv][c].abs() {
                    piv = r;
                }
            }
            if a[piv][c].abs() < 1e-300 {
                return Err(m.saturating_sub(1));
            }
            a.swap(c, piv);
            for r in c + 1..m {
                let f = a[r][c] / a[c][c];
                for cc in c..=m {
                    a[r][cc] -= f * a[c][cc];
                }
            }
        }
        let mut d = vec![0.0; m];
        for p in (0..m).rev() {
            let mut s = a[p][m];
            for q in p + 1..m {
                s -= a[p][q] * d[q];
            }
            d[p] = s / a[p][p];
        }
        // step length: keep t_i > 0, beta >= 0 and sum beta <= 1
        let mut alpha: f64 = 1.0;
        for i in 0..n {
            if z[i] <= 0.0 {
                continue;
            }
            let dt: f64 = (0..m).map(|p| d[p] * (k[p][i] - 1.0)).sum();
            if dt < 0.0 {
                alpha = alpha.min(0.95 * t[i] / -dt);
            }
        }
        for p in 0..m {
            if d[p] < 0.0 {
                alpha = alpha.min(beta[p] / -d[p]);
            }
        }
        let sum_b: f64 = beta.iter().sum();
        let sum_d: f64 = d.iter().sum();
        if sum_d > 0.0 {
            alpha = alpha.min((1.0 - sum_b) * 0.999 / sum_d);
        }
        let step = d.iter().map(|v| (v * alpha).abs()).fold(0.0, f64::max);
        for p in 0..m {
            beta[p] += alpha * d[p];
            if beta[p] < 1e-14 {
                beta[p] = 0.0;
            }
        }
        if step < 1e-13 {
            break;
        }
    }
    for p in 0..m {
        if beta[p] <= 1e-12 {
            return Err(p);
        }
    }
    Ok(beta)
}

/// The K-phase flash by successive substitution from the starting compositions `x0` (one normalised vector per phase).
/// Returns the phase amounts, or None when it did not converge to at least two phases.
fn flash(mix: &Mixture, z: &[f64], x0: Vec<Vec<f64>>, ions: Option<&IonEnv>) -> Option<Vec<Vec<f64>>> {
    let n = z.len();
    let z_tot: f64 = z.iter().sum();
    let mut comp = x0;
    let mut ion_phase = if ions.is_some() { ion_phase_of(mix, &comp) } else { None };
    // initial fractions from the mass balance of the first non-reference phase against the feed
    let mut beta: Vec<f64> = vec![0.0; comp.len() - 1];
    {
        let mut b = 0.5;
        for i in 0..n {
            if z[i] > 0.0 && comp[1][i] > 0.0 {
                b = f64::min(b, 0.5 * z[i] / (z_tot * comp[1][i]));
            }
        }
        let share = (b.min(0.3) / (comp.len() - 1) as f64).max(1e-3);
        for v in beta.iter_mut() {
            *v = share;
        }
    }
    let mut last_lnk: Vec<Vec<f64>> = Vec::new();
    for iter in 0..500 {
        let lg: Vec<Vec<f64>> = comp.iter().enumerate().map(|(p, x)| ln_gamma_phase(mix, x, ions, ion_phase == Some(p))).collect();
        let k: Vec<Vec<f64>> = (1..comp.len())
            .map(|p| (0..n).map(|i| if z[i] > 0.0 { (lg[0][i] - lg[p][i]).clamp(-60.0, 60.0).exp() } else { 1.0 }).collect())
            .collect();
        let zf: Vec<f64> = z.iter().map(|v| v / z_tot).collect();
        let b = match rachford_rice(&zf, &k, &beta) {
            Ok(b) => b,
            Err(_) => return None,
        };
        beta = b;
        let t: Vec<f64> = (0..n).map(|i| 1.0 + (0..k.len()).map(|p| beta[p] * (k[p][i] - 1.0)).sum::<f64>()).collect();
        let mut new_comp: Vec<Vec<f64>> = Vec::with_capacity(comp.len());
        let x0n: Vec<f64> = (0..n).map(|i| zf[i] / t[i].max(1e-300)).collect();
        new_comp.push(normalise(&x0n));
        for p in 0..k.len() {
            let xp: Vec<f64> = (0..n).map(|i| k[p][i] * x0n[i]).collect();
            new_comp.push(normalise(&xp));
        }
        let ln_k_now: Vec<Vec<f64>> = k.iter().map(|kp| kp.iter().map(|v| v.max(1e-300).ln()).collect()).collect();
        let conv = if last_lnk.len() == ln_k_now.len() {
            ln_k_now.iter().zip(&last_lnk).map(|(a, b)| a.iter().zip(b).map(|(x, y)| (x - y).abs()).fold(0.0, f64::max)).fold(0.0, f64::max)
        } else {
            1.0
        };
        comp = new_comp;
        ion_phase = if ions.is_some() { ion_phase_of(mix, &comp) } else { None };
        last_lnk = ln_k_now;
        if conv < 1e-11 && iter > 1 {
            break;
        }
        if iter == 499 {
            return None;
        }
    }
    // the phases must be distinct: two phases of the same composition are one phase
    for p in 1..comp.len() {
        for q in 0..p {
            let dist: f64 = comp[p].iter().zip(&comp[q]).map(|(a, b)| (a - b).abs()).sum();
            if dist < 1e-6 {
                return None;
            }
        }
    }
    // amounts from the converged fractions: n_ip = Z beta_p x_ip(unnormalised) keeps the feed's mass balance exactly
    let k_final: Vec<Vec<f64>> = (1..comp.len())
        .map(|p| {
            let lg0 = ln_gamma_phase(mix, &comp[0], ions, ion_phase == Some(0));
            let lgp = ln_gamma_phase(mix, &comp[p], ions, ion_phase == Some(p));
            (0..n).map(|i| if z[i] > 0.0 { (lg0[i] - lgp[i]).clamp(-60.0, 60.0).exp() } else { 1.0 }).collect()
        })
        .collect();
    let zf: Vec<f64> = z.iter().map(|v| v / z_tot).collect();
    let t: Vec<f64> = (0..n).map(|i| 1.0 + (0..k_final.len()).map(|p| beta[p] * (k_final[p][i] - 1.0)).sum::<f64>()).collect();
    let mut out: Vec<Vec<f64>> = Vec::new();
    let b0 = 1.0 - beta.iter().sum::<f64>();
    out.push((0..n).map(|i| z_tot * b0 * zf[i] / t[i].max(1e-300)).collect());
    for p in 0..k_final.len() {
        out.push((0..n).map(|i| z_tot * beta[p] * k_final[p][i] * zf[i] / t[i].max(1e-300)).collect());
    }
    // enforce the exact balance (the converged K may differ from the last composition by 1e-11)
    for i in 0..n {
        let s: f64 = out.iter().map(|p| p[i]).sum();
        if s > 0.0 && z[i] > 0.0 {
            let f = z[i] / s;
            for p in out.iter_mut() {
                p[i] *= f;
            }
        }
    }
    Some(out)
}

/// Solves the liquid-liquid equilibrium of `z` (mol of each component of `mix`).
pub fn solve(mix: &Mixture, z: &[f64], ions: Option<&IonEnv>) -> LleResult {
    let n = z.len();
    let zt: f64 = z.iter().filter(|v| **v > 0.0).sum();
    let single = |z: &[f64]| LleResult { phases: vec![z.to_vec()], ion_phase: if ions.is_some() && mix.water.is_some() { Some(0) } else { None } };
    if zt <= 0.0 || (0..n).filter(|&i| z[i] > 0.0).count() < 2 {
        return single(z);
    }
    let xf = normalise(z);
    let feed_ions = ions.is_some() && mix.water.map_or(false, |w| z[w] > 0.0);
    let mut phases: Vec<Vec<f64>> = vec![z.to_vec()];
    let mut ion_phase: Option<usize> = if feed_ions { Some(0) } else { None };
    // 1. is the feed stable?
    let Some(trial) = find_unstable_trial(mix, &xf, feed_ions, ions, &[]) else {
        return single(z);
    };
    // 2. split with the trial as the second phase
    let mut comp = vec![xf.clone(), trial];
    let mut result: Option<Vec<Vec<f64>>> = None;
    if let Some(r) = flash(mix, z, comp.clone(), ions) {
        result = Some(r);
    } else {
        // retry from the mass-balance composition of the remainder
        let mut rest: Vec<f64> = (0..n).map(|i| (z[i] / zt - 0.05 * comp[1][i]).max(1e-12)).collect();
        rest = normalise(&rest);
        comp[0] = rest;
        if let Some(r) = flash(mix, z, comp, ions) {
            result = Some(r);
        }
    }
    let Some(mut ph) = result else {
        return single(z);
    };
    // 3. a third phase?
    for _ in 0..(MAX_PHASES - 2) {
        let comps: Vec<Vec<f64>> = ph.iter().map(|p| normalise(p)).collect();
        let ip = if ions.is_some() { ion_phase_of(mix, &comps) } else { None };
        let mut added = false;
        for p in 0..comps.len() {
            let others: Vec<Vec<f64>> = comps.iter().enumerate().filter(|(q, _)| *q != p).map(|(_, x)| x.clone()).collect();
            if let Some(w) = find_unstable_trial(mix, &comps[p], ip == Some(p), ions, &others) {
                // distinct from every existing phase?
                if comps.iter().all(|c| c.iter().zip(&w).map(|(a, b)| (a - b).abs()).sum::<f64>() > 1e-4) {
                    let mut init = comps.clone();
                    init.push(w);
                    // keep the aqueous-feed phase first
                    if let Some(r) = flash(mix, z, init, ions) {
                        ph = r;
                        added = true;
                        break;
                    }
                }
            }
        }
        if !added {
            break;
        }
    }
    phases = ph;
    let comps: Vec<Vec<f64>> = phases.iter().map(|p| normalise(p)).collect();
    if ions.is_some() {
        ion_phase = ion_phase_of(mix, &comps);
    }
    LleResult { phases, ion_phase }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::molecule::{resolve, Mixture};
    use std::sync::Arc;

    fn mol(key: &str) -> Arc<crate::molecule::Molecule> {
        Arc::new(resolve(key, None).unwrap_or_else(|| panic!("{} resolves", key)))
    }
    const HEXANE: &str = "ik:VLKZOEOYAKHREP-UHFFFAOYSA-N";
    const TOLUENE: &str = "ik:YXFVVABEGXRONW-UHFFFAOYSA-N";

    #[test]
    fn hexane_and_water_split_and_water_mixes_with_ethanol() {
        let mix = Mixture::new(vec![mol("H2O"), mol(HEXANE)], 295.15);
        let r = solve(&mix, &[2.0, 0.5], None);
        assert_eq!(r.phases.len(), 2, "{:?}", r.phases);
        // balance
        for i in 0..2 {
            let s: f64 = r.phases.iter().map(|p| p[i]).sum();
            assert!((s - [2.0, 0.5][i]).abs() < 1e-9);
        }
        let (aq, org) = if r.phases[0][0] > r.phases[1][0] { (&r.phases[0], &r.phases[1]) } else { (&r.phases[1], &r.phases[0]) };
        assert!(aq[1] / (aq[0] + aq[1]) < 1e-3, "hexane in water: x = {}", aq[1] / (aq[0] + aq[1]));
        assert!(org[0] / (org[0] + org[1]) < 2e-3, "water in hexane: x = {}", org[0] / (org[0] + org[1]));
        // ethanol + water: one phase; hexane + toluene: one phase
        let mix2 = Mixture::new(vec![mol("H2O"), mol("C2H5OH")], 295.15);
        assert_eq!(solve(&mix2, &[2.0, 1.0], None).phases.len(), 1);
        let mix3 = Mixture::new(vec![mol(HEXANE), mol(TOLUENE)], 295.15);
        assert_eq!(solve(&mix3, &[1.0, 1.0], None).phases.len(), 1);
    }

    #[test]
    fn ethanol_partitions_between_water_and_hexane_with_equal_activities() {
        let mix = Mixture::new(vec![mol("H2O"), mol(HEXANE), mol("C2H5OH")], 295.15);
        let z = [2.0, 0.6, 0.2];
        let r = solve(&mix, &z, None);
        assert_eq!(r.phases.len(), 2);
        let a: Vec<Vec<f64>> = r.phases.iter().map(|p| mix.ln_activity(p, None)).collect();
        for i in 0..3 {
            if r.phases[0][i] > 1e-9 && r.phases[1][i] > 1e-9 {
                assert!((a[0][i] - a[1][i]).abs() < 1e-5, "component {}: {} vs {}", i, a[0][i], a[1][i]);
            }
        }
        // more ethanol stays in the water-rich phase
        let (aq, org) = if r.phases[0][0] > r.phases[1][0] { (&r.phases[0], &r.phases[1]) } else { (&r.phases[1], &r.phases[0]) };
        assert!(aq[2] > org[2]);
    }
}
