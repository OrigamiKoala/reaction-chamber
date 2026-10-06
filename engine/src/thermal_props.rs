//! Thermal transport properties of a liquid layer, from correlations: the thermal conductivity of a pure liquid and of a
//! mixture, and the pieces a probe's film coefficient needs (`LiquidLayer::thermal_conductivity_w_m_k` and friends).
//!
//! * Water: the cubic fit of the IAPWS recommended values between 273 and 373 K (Ramires et al. 1995), extended linearly.
//! * Any other liquid: Sato-Riedel, `k = 1.1053 / sqrt(M) (3 + 20 (1 - Tr)^(2/3)) / (3 + 20 (1 - Tbr)^(2/3))` W/(m K) (M in
//!   g/mol), from its molar mass, normal boiling point and critical temperature. Tier Estimated (about 10 % for organics);
//!   a liquid without a vapour-pressure curve has no boiling point and gets the class value `K_ORGANIC_DEFAULT`, labelled.
//! * Mixtures: Li's rule `k = sum_i sum_j phi_i phi_j k_ij`, `k_ij = 2 / (1/k_i + 1/k_j)`, with volume fractions `phi`.

/// Class value (W/(m K)) for an organic liquid without a boiling point (typical of liquids at room temperature).
pub const K_ORGANIC_DEFAULT: f64 = 0.15;

/// Thermal conductivity of liquid water, W/(m K).
pub fn water_conductivity(t_k: f64) -> f64 {
    let t = t_k.clamp(250.0, 420.0);
    (-0.8691 + 0.008948 * t - 1.584e-5 * t * t + 7.975e-9 * t * t * t).max(0.2)
}

/// Sato-Riedel conductivity (W/(m K)) of a liquid of molar mass `mw` (g/mol), normal boiling point `tb_k` and critical
/// temperature `tc_k` at `t_k`.
pub fn sato_riedel(mw: f64, tb_k: f64, tc_k: f64, t_k: f64) -> f64 {
    if !(mw > 0.0 && tb_k > 0.0 && tc_k > tb_k) {
        return K_ORGANIC_DEFAULT;
    }
    let f = |t: f64| 3.0 + 20.0 * (1.0 - (t / tc_k).clamp(0.0, 0.99)).powf(2.0 / 3.0);
    (1.1053 / mw.sqrt() * f(t_k) / f(tb_k)).clamp(0.05, 0.8)
}

/// Li's mixing rule for the conductivity of a liquid mixture; `parts` are (volume fraction, conductivity).
pub fn li_mixture(parts: &[(f64, f64)]) -> f64 {
    let total: f64 = parts.iter().map(|p| p.0).sum();
    if total <= 0.0 {
        return K_ORGANIC_DEFAULT;
    }
    let mut k = 0.0;
    for (pi, ki) in parts {
        for (pj, kj) in parts {
            let kij = 2.0 / (1.0 / ki + 1.0 / kj);
            k += (pi / total) * (pj / total) * kij;
        }
    }
    k
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn water_and_organic_values_are_reasonable() {
        assert!((water_conductivity(298.15) - 0.607).abs() < 0.01);
        assert!(water_conductivity(353.15) > water_conductivity(298.15));
        // ethanol: M 46.07, Tb 351.4, Tc 513.9 -> about 0.17 W/(m K) at 298 K (measured 0.167)
        let k = sato_riedel(46.07, 351.4, 513.9, 298.15);
        assert!((k - 0.167).abs() < 0.03, "{k}");
        // hexane 86.18, 341.9, 507.6 -> about 0.12 (measured 0.12)
        let k = sato_riedel(86.18, 341.9, 507.6, 298.15);
        assert!((k - 0.12).abs() < 0.03, "{k}");
    }

    #[test]
    fn mixture_lies_between_its_parts_and_a_pure_liquid_is_itself() {
        let k = li_mixture(&[(0.5, 0.6), (0.5, 0.15)]);
        assert!(k > 0.15 && k < 0.6);
        assert!((li_mixture(&[(1.0, 0.42)]) - 0.42).abs() < 1e-12);
    }
}
