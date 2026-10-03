//! Gas-liquid mass transfer and dissolved gas kinetics.
//!
//! Models gas exchange across the phase interface via film theory:
//!   N = k_L * a * (c - c*)
//! where c* = k_H * p_partial.
//!
//! Handles:
//! - Quiet interfacial exchange (hours unstirred, minutes stirred)
//! - Effervescence / bubble nucleation when sum(p_sat) > P_ambient
//! - Dissolved CO2 hydration kinetics with true finite relaxation:
//!   CO2(aq) + H2O <-> H+ + HCO3- (k1 = 0.037 s^-1)
//!   CO2(aq) + OH- <-> HCO3- (k2 = 8500 M^-1 s^-1)

pub const K1_CO2_HYDRATION_298: f64 = 0.037; // s^-1 at 298.15 K
pub const K2_CO2_OH_298: f64 = 8500.0; // M^-1 s^-1 at 298.15 K
pub const K_EQ_CO2_CARBONIC_298: f64 = 4.47e-7; // K_a1 = [H+][HCO3-] / [CO2(aq)] at 298 K (pK = 6.35)

/// Evaluates liquid-side mass transfer coefficient k_L (m/s) across liquid-gas interface.
pub fn gas_liquid_kl_m_s(stir_rpm: f64, depth_m: f64) -> f64 {
    let _h = depth_m.max(1e-3);
    if stir_rpm <= 0.0 {
        // Quiescent liquid surface in open vessel
        1.0e-6
    } else {
        // Stirred vessel: surface renewal scales with rotation rate
        let n_norm = (stir_rpm / 300.0).clamp(0.2, 5.0);
        5.0e-5 * n_norm
    }
}

/// Characteristic relaxation time constant (seconds) for dissolved gas in an open vessel.
///
/// tau = depth / k_L
pub fn open_gas_relaxation_time_s(depth_m: f64, stir_rpm: f64) -> f64 {
    let kl = gas_liquid_kl_m_s(stir_rpm, depth_m);
    (depth_m.max(1e-3) / kl).max(0.1)
}

/// Checks whether effervescent bubble nucleation occurs (fizzing).
///
/// Occurs when the sum of dissolved gas partial pressures plus liquid vapor pressure
/// exceeds the ambient pressure (P_gas_tension > P_ambient).
pub fn is_bubble_nucleation(total_gas_tension_pa: f64, ambient_pressure_pa: f64) -> bool {
    total_gas_tension_pa > ambient_pressure_pa * 1.005
}

/// Evaluates the true CO2 hydration flux (mol / (L * s)):
///   CO2(aq) + H2O <-> H+ + HCO3-
///
/// Forward rate = (k1 + k2 * [OH-]) * [CO2(aq)]
/// Reverse rate = (k_r1 * [H+] + k_r2) * [HCO3-]
pub fn co2_hydration_flux_m_s(
    co2_aq_m: f64,
    h_m: f64,
    oh_m: f64,
    hco3_m: f64,
    t_k: f64,
) -> f64 {
    let t = t_k.max(250.0);
    // Arrhenius temperature scaling with Ea ~ 70 kJ/mol for neutral, ~ 55 kJ/mol for OH-
    let t_fac1 = ((70000.0 / 8.314) * (1.0 / 298.15 - 1.0 / t)).exp();
    let t_fac2 = ((55000.0 / 8.314) * (1.0 / 298.15 - 1.0 / t)).exp();

    let k1 = K1_CO2_HYDRATION_298 * t_fac1;
    let k2 = K2_CO2_OH_298 * t_fac2;

    let k_eq = K_EQ_CO2_CARBONIC_298; // equilibrium ratio
    let k_rev = k1 / k_eq;

    let forward_rate = (k1 + k2 * oh_m.max(0.0)) * co2_aq_m.max(0.0);
    let reverse_rate = (k_rev * h_m.max(1e-14)) * hco3_m.max(0.0);

    forward_rate - reverse_rate
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_carbonated_water_relaxation_gate() {
        // Typical beaker depth 3.5 cm = 0.035 m
        let depth = 0.035;

        let tau_still = open_gas_relaxation_time_s(depth, 0.0);
        let tau_stirred = open_gas_relaxation_time_s(depth, 400.0);

        // Gate: tau is hours unstirred, minutes stirred
        assert!(tau_still >= 3600.0 * 2.0, "tau_still must be >= 2 hours: got {} s ({} h)", tau_still, tau_still / 3600.0);
        assert!(tau_stirred <= 1800.0 && tau_stirred >= 100.0, "tau_stirred must be minutes: got {} s", tau_stirred);
        assert!(tau_still >= tau_stirred * 20.0, "unstirred must be >> stirred");
    }

    #[test]
    fn test_co2_hydration_delay_gate() {
        // At 25 C, neutral hydration k1 ~ 0.037 s^-1 -> t_1/2 ~ 18.7 s
        let flux_neutral = co2_hydration_flux_m_s(0.01, 1e-7, 1e-7, 0.0, 298.15);
        let rate_const_neutral = flux_neutral / 0.01;
        assert!((rate_const_neutral - 0.037).abs() < 0.005);

        // In dilute alkaline solution (pH 10 -> [OH-] = 1e-4 M, phenolphthalein turning zone):
        // k_obs = 0.037 + 8500 * 1e-4 = 0.037 + 0.85 = 0.887 s^-1
        // Lifetime tau ~ 1.1 s, distinct multi-second delay before neutralization
        let flux_ph10 = co2_hydration_flux_m_s(0.001, 1e-10, 1e-4, 0.0, 298.15);
        let k_obs_ph10 = flux_ph10 / 0.001;
        assert!(k_obs_ph10 > 0.5 && k_obs_ph10 < 2.0, "k_obs at pH 10 = {}", k_obs_ph10);
    }
}
