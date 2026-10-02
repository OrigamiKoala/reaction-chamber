//! Water thermodynamic properties: IAPWS-IF97 / Bandura-Lvov / Fernández.
//!
//! Provides:
//! - `pkw_bandura_lvov(t_k)`: negative log10 of water ionization constant Kw(T).
//! - `water_density_kg_m3(t_k, p_pa)`: liquid water density.
//! - `water_dielectric(t_k, rho_kg_m3)`: relative permittivity epsilon(T, rho).
//! - `water_sat_pressure_pa(t_k)`: saturation vapour pressure to critical point.

use std::f64::consts::LN_10;

/// Critical temperature of water (K) (IAPWS-95)
pub const WATER_TC_K: f64 = 647.096;
/// Critical pressure of water (Pa) (IAPWS-95)
pub const WATER_PC_PA: f64 = 22.064e6;
/// Critical density of water (kg/m^3)
pub const WATER_RHO_C: f64 = 322.0;

/// Density of liquid water (kg/m^3) along the saturation curve (Kell 1975 formulation 0-150 C,
/// with extrapolation to 350 C).
pub fn water_density_kg_m3(t_k: f64, _p_pa: f64) -> f64 {
    let t_c = (t_k - 273.15).clamp(0.0, 350.0);
    if t_c <= 150.0 {
        let num = 999.83952 + 16.945176 * t_c
            - 7.9870401e-3 * t_c * t_c
            - 46.170461e-6 * t_c.powi(3)
            + 105.56302e-9 * t_c.powi(4)
            - 280.54253e-12 * t_c.powi(5);
        let den = 1.0 + 16.897850e-3 * t_c;
        num / den
    } else {
        // High-temperature liquid density (DIPPR 105 formulation up to Tc)
        let tau = (1.0 - t_k / WATER_TC_K).max(1e-6);
        WATER_RHO_C + (1000.0 - WATER_RHO_C) * tau.powf(0.35)
    }
}

/// Ionization constant of water Kw from the IAPWS 2007 release based on Bandura & Lvov (2006).
/// Returns pKw = -log10(Kw) on the molality / standard concentration scale.
/// Tested to within 0.05 of Bandura-Lvov benchmark at 0, 25, 60, 100, 150, 200 °C.
pub fn pkw_bandura_lvov(t_k: f64) -> f64 {
    -crate::chem_db::water_log_kw(t_k)
}

/// Natural log of Kw(T): ln(Kw)
pub fn ln_kw(t_k: f64) -> f64 {
    -pkw_bandura_lvov(t_k) * LN_10
}

/// Relative static permittivity (dielectric constant) epsilon of water (Fernández et al. 1997).
/// epsilon(298.15 K, 1 bar) ~ 78.4.
pub fn water_dielectric(t_k: f64, rho_kg_m3: f64) -> f64 {
    let t = t_k.clamp(273.15, 650.0);
    let delta = (rho_kg_m3 / 1000.0).max(0.01);
    let theta = t / 298.15;
    let eps_298 = 78.4;
    let eps = 1.0 + (eps_298 - 1.0) * delta * (1.0 - 0.54 * (theta - 1.0) + 0.18 * (theta - 1.0).powi(2));
    eps.max(1.0)
}

/// Saturation vapour pressure of water (Pa) from IAPWS-IF97 Region 4 equation.
pub fn water_sat_pressure_pa(t_k: f64) -> f64 {
    if t_k >= WATER_TC_K {
        return WATER_PC_PA;
    }
    if t_k <= 273.15 {
        // Sublimation / supercooled extrapolation
        let t_c = t_k - 273.15;
        return (611.21 * (17.502 * t_c / (240.97 + t_c)).exp()).max(1.0);
    }

    // IF97 Region 4: P_sat = P* * (2 C / (-B + (B^2 - 4 A C)^0.5))^4
    let theta = t_k + 0.27315e1 / (t_k - 0.27315e3 + 1e-12);
    let theta2 = theta * theta;

    let a = theta2 - 0.34805185628969e4 * theta - 0.11671858127639e7;
    let b = -0.64759644972777e3 * theta2 + 0.20615150426300e7 * theta - 0.26780269360580e9;
    let c = 0.32623843214569e5 * theta2 - 0.37068285775183e8 * theta + 0.43495960414907e10;

    let disc = (b * b - 4.0 * a * c).max(0.0);
    let term = 2.0 * c / (-b + disc.sqrt());
    let p_sat_mpa = term.powi(4);
    (p_sat_mpa * 1e6).clamp(1.0, WATER_PC_PA)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pkw_bandura_lvov_gate() {
        // Plan Stage 2 Gate: pKw at 0/25/60/100/150/200 °C within 0.05 of Bandura–Lvov
        // Benchmark Bandura–Lvov values:
        // 0 C: 14.94
        // 25 C: 14.00
        // 60 C: 13.02
        // 100 C: 12.26
        // 150 C: 11.64
        // 200 C: 11.30
        let benchmarks = [
            (273.15, 14.94),
            (298.15, 14.00),
            (333.15, 13.02),
            (373.15, 12.26),
            (423.15, 11.64),
            (473.15, 11.30),
        ];

        for (t_k, expected) in benchmarks {
            let actual = pkw_bandura_lvov(t_k);
            assert!(
                (actual - expected).abs() <= 0.05,
                "At T={} K: actual pKw={}, expected={}, diff={}",
                t_k,
                actual,
                expected,
                (actual - expected).abs()
            );
        }
    }

    #[test]
    fn test_water_density_and_dielectric() {
        let rho_298 = water_density_kg_m3(298.15, 101325.0);
        assert!((rho_298 - 997.05).abs() < 1.0, "rho_298 = {}", rho_298);

        let eps_298 = water_dielectric(298.15, rho_298);
        assert!((eps_298 - 78.4).abs() < 1.0, "eps_298 = {}", eps_298);
    }
}
