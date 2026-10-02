//! Equations of state for the gas phase.
//!
//! * Ideal gas: `P V = n R T` (the reference; exact at the low pressures of an open bench vessel).
//! * Peng-Robinson (Peng & Robinson 1976), `P = RT/(v-b) - a(T)/(v^2 + 2bv - b^2)`, with the standard van der Waals
//!   one-fluid mixing rules (`a = sum_ij y_i y_j sqrt(a_i a_j) (1 - k_ij)`, `b = sum_i y_i b_i`, `k_ij = 0`). It is
//!   used for the sealed-vessel gas phase (hot vapour at tens of atmospheres, supercritical fluids) and for the
//!   fugacity coefficients that enter vapour-liquid equilibrium.
//!
//! The only inputs are intrinsic critical constants and the acentric factor of each gas species (`vle::Volatile`);
//! nothing here knows a compound. A species without critical data is simply not part of the EOS mixture (the caller
//! falls back to the ideal gas for the whole mixture and labels that).
//!
//! Everything is available in the (T, V, n) form (explicit in P, no cubic root to pick, which is what an isochoric
//! sealed vessel needs) and in the (T, P, y) form (which the saturation-fugacity calculation needs).

use crate::physics::R_GAS;

const SQRT2: f64 = std::f64::consts::SQRT_2;

/// Critical constants of one gas component.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PrComp {
    pub tc_k: f64,
    pub pc_pa: f64,
    pub omega: f64,
}

impl PrComp {
    /// Peng-Robinson `kappa(omega)`; the original correlation up to omega 0.49, the Robinson-Peng 1978 extension above.
    fn kappa(&self) -> f64 {
        let w = self.omega;
        if w <= 0.49 {
            0.37464 + 1.54226 * w - 0.26992 * w * w
        } else {
            0.379642 + 1.48503 * w - 0.164423 * w * w + 0.016666 * w * w * w
        }
    }

    /// Attraction parameter a(T), Pa m^6 / mol^2.
    pub fn a_of_t(&self, t_k: f64) -> f64 {
        let tr = (t_k / self.tc_k).max(1e-3);
        let alpha = (1.0 + self.kappa() * (1.0 - tr.sqrt())).powi(2);
        0.457235529 * R_GAS * R_GAS * self.tc_k * self.tc_k / self.pc_pa * alpha
    }

    /// Co-volume b, m^3 / mol.
    pub fn b(&self) -> f64 {
        0.077796074 * R_GAS * self.tc_k / self.pc_pa
    }
}

/// Mixture parameters (a, b) at `t_k` for mole fractions `y`; also returns the per-component a_i and b_i.
fn mixture_ab(comps: &[PrComp], y: &[f64], t_k: f64) -> (f64, f64, Vec<f64>, Vec<f64>) {
    let ai: Vec<f64> = comps.iter().map(|c| c.a_of_t(t_k)).collect();
    let bi: Vec<f64> = comps.iter().map(|c| c.b()).collect();
    let mut a = 0.0;
    let mut b = 0.0;
    for i in 0..comps.len() {
        b += y[i] * bi[i];
        for j in 0..comps.len() {
            a += y[i] * y[j] * (ai[i] * ai[j]).sqrt();
        }
    }
    (a, b, ai, bi)
}

/// Pressure (Pa) of `n` mol (per component) in `v_m3` at `t_k`.
pub fn pressure_tv(comps: &[PrComp], n: &[f64], t_k: f64, v_m3: f64) -> f64 {
    let n_tot: f64 = n.iter().sum();
    if n_tot <= 0.0 || v_m3 <= 0.0 {
        return 0.0;
    }
    let y: Vec<f64> = n.iter().map(|x| x / n_tot).collect();
    let (a, b, _, _) = mixture_ab(comps, &y, t_k);
    let v = v_m3 / n_tot;
    let den = v * v + 2.0 * b * v - b * b;
    let rep = if v > b * 1.0001 { R_GAS * t_k / (v - b) } else { R_GAS * t_k / (b * 1e-4) };
    rep - a / den
}

/// ln of the fugacity coefficient of each component for mole fractions `y` at (T, P) with compressibility `z`.
fn ln_phi_from_z(comps: &[PrComp], y: &[f64], t_k: f64, p_pa: f64, z: f64) -> Vec<f64> {
    let (a, b, ai, bi) = mixture_ab(comps, y, t_k);
    let rt = R_GAS * t_k;
    let a_big = a * p_pa / (rt * rt);
    let b_big = b * p_pa / rt;
    let zb = (z - b_big).max(1e-12);
    let log_term = ((z + (1.0 + SQRT2) * b_big) / (z + (1.0 - SQRT2) * b_big).max(1e-300)).max(1e-300).ln();
    (0..comps.len())
        .map(|i| {
            let mut sum = 0.0;
            for j in 0..comps.len() {
                sum += y[j] * (ai[i] * ai[j]).sqrt();
            }
            let bi_b = bi[i] / b.max(1e-30);
            bi_b * (z - 1.0) - zb.ln() - a_big / (2.0 * SQRT2 * b_big.max(1e-30)) * (2.0 * sum / a.max(1e-30) - bi_b) * log_term
        })
        .collect()
}

/// (Z, ln phi_i) of the gas mixture `n` at (T, V): P follows from the EOS, so no root selection is needed.
pub fn ln_phi_tv(comps: &[PrComp], n: &[f64], t_k: f64, v_m3: f64) -> (f64, f64, Vec<f64>) {
    let n_tot: f64 = n.iter().sum();
    let p = pressure_tv(comps, n, t_k, v_m3);
    if n_tot <= 0.0 || p <= 0.0 {
        return (1.0, p, vec![0.0; comps.len()]);
    }
    let y: Vec<f64> = n.iter().map(|x| x / n_tot).collect();
    let z = p * (v_m3 / n_tot) / (R_GAS * t_k);
    (z, p, ln_phi_from_z(comps, &y, t_k, p, z))
}

/// Real roots of Z^3 + c2 Z^2 + c1 Z + c0 = 0, ascending.
fn cubic_roots(c2: f64, c1: f64, c0: f64) -> Vec<f64> {
    // depressed cubic t^3 + p t + q = 0 with Z = t - c2/3
    let p = c1 - c2 * c2 / 3.0;
    let q = 2.0 * c2 * c2 * c2 / 27.0 - c2 * c1 / 3.0 + c0;
    let shift = -c2 / 3.0;
    let disc = q * q / 4.0 + p * p * p / 27.0;
    let mut roots = Vec::new();
    if disc > 0.0 {
        let s = disc.sqrt();
        let u = (-q / 2.0 + s).cbrt();
        let v = (-q / 2.0 - s).cbrt();
        roots.push(u + v + shift);
    } else if p.abs() < 1e-300 {
        roots.push(shift);
    } else {
        let r = (-p / 3.0).sqrt();
        let cos_arg = (-q / (2.0 * r * r * r)).clamp(-1.0, 1.0);
        let th = cos_arg.acos();
        for k in 0..3 {
            roots.push(2.0 * r * ((th + 2.0 * std::f64::consts::PI * k as f64) / 3.0).cos() + shift);
        }
        roots.sort_by(|a, b| a.partial_cmp(b).unwrap());
    }
    roots
}

/// Compressibility factor of the vapour-like (largest) root at (T, P) for mole fractions `y`.
pub fn z_vapour_tp(comps: &[PrComp], y: &[f64], t_k: f64, p_pa: f64) -> f64 {
    let (a, b, _, _) = mixture_ab(comps, y, t_k);
    let rt = R_GAS * t_k;
    let a_big = a * p_pa / (rt * rt);
    let b_big = b * p_pa / rt;
    let c2 = -(1.0 - b_big);
    let c1 = a_big - 3.0 * b_big * b_big - 2.0 * b_big;
    let c0 = -(a_big * b_big - b_big * b_big - b_big * b_big * b_big);
    let roots = cubic_roots(c2, c1, c0);
    roots
        .into_iter()
        .filter(|z| *z > b_big && z.is_finite())
        .fold(f64::NAN, |acc, z| if acc.is_nan() || z > acc { z } else { acc })
        .max(b_big + 1e-9)
}

/// ln phi_i of the vapour-like phase at (T, P, y).
pub fn ln_phi_vapour_tp(comps: &[PrComp], y: &[f64], t_k: f64, p_pa: f64) -> Vec<f64> {
    let z = z_vapour_tp(comps, y, t_k, p_pa);
    ln_phi_from_z(comps, y, t_k, p_pa, z)
}

/// ln of the fugacity coefficient of the pure vapour at (T, P): the saturation reference of the gamma-phi method.
pub fn ln_phi_pure_vapour(comp: PrComp, t_k: f64, p_pa: f64) -> f64 {
    ln_phi_vapour_tp(&[comp], &[1.0], t_k, p_pa)[0]
}

/// Ideal-gas pressure (Pa).
pub fn ideal_pressure(n_mol: f64, t_k: f64, v_m3: f64) -> f64 {
    if v_m3 <= 0.0 {
        return 0.0;
    }
    n_mol * R_GAS * t_k / v_m3
}

#[cfg(test)]
mod tests {
    use super::*;

    // CO2 (Tc 304.13 K, Pc 73.77 bar, omega 0.2239) and N2 (126.2 K, 33.98 bar, 0.0372): textbook constants.
    const CO2: PrComp = PrComp { tc_k: 304.13, pc_pa: 73.77e5, omega: 0.2239 };
    const N2: PrComp = PrComp { tc_k: 126.2, pc_pa: 33.98e5, omega: 0.0372 };

    #[test]
    fn dilute_gas_is_ideal() {
        let v = 0.025; // m3
        let p = pressure_tv(&[N2], &[1.0], 298.15, v);
        let p_id = ideal_pressure(1.0, 298.15, v);
        assert!((p / p_id - 1.0).abs() < 0.01, "{} vs {}", p, p_id);
        let (_, _, lp) = ln_phi_tv(&[N2], &[1.0], 298.15, v);
        assert!(lp[0].abs() < 0.01, "ln phi {}", lp[0]);
    }

    #[test]
    fn co2_compressibility_at_50_bar_matches_pr() {
        // CO2 at 300 K and 50 bar (just below the saturation pressure): experiment Z ~ 0.75, PR gives ~ 0.67
        let z = z_vapour_tp(&[CO2], &[1.0], 300.0, 50e5);
        assert!(z > 0.62 && z < 0.80, "Z {}", z);
    }

    #[test]
    fn tp_and_tv_forms_agree() {
        let (t, p) = (350.0, 20e5);
        let y = [0.3, 0.7];
        let comps = [CO2, N2];
        let z = z_vapour_tp(&comps, &y, t, p);
        let n_tot = 2.0;
        let v = z * n_tot * R_GAS * t / p;
        let (z2, p2, lp2) = ln_phi_tv(&comps, &[0.6, 1.4], t, v);
        assert!((p2 / p - 1.0).abs() < 1e-9, "{} vs {}", p2, p);
        assert!((z2 - z).abs() < 1e-9);
        let lp = ln_phi_vapour_tp(&comps, &y, t, p);
        for k in 0..2 {
            assert!((lp[k] - lp2[k]).abs() < 1e-9);
        }
    }

    #[test]
    fn pressure_scales_with_density_above_critical_temperature() {
        // supercritical CO2 at 350 K: P rises faster than linearly at high density (repulsion) but less than ideal at moderate density
        let p1 = pressure_tv(&[CO2], &[1.0], 350.0, 0.005);
        let p_id = ideal_pressure(1.0, 350.0, 0.005);
        assert!(p1 < p_id && p1 > 0.5 * p_id);
    }
}
