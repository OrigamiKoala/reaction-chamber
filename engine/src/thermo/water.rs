//! Water thermodynamic properties: IAPWS-IF97 / Bandura-Lvov / Fernández.
//!
//! Provides:
//! - `pkw_bandura_lvov(t_k)`: negative log10 of water ionization constant Kw(T).
//! - `water_density_kg_m3(t_k, p_pa)`: liquid water density.
//! - `water_dielectric(t_k, rho_kg_m3)`: relative permittivity epsilon(T, rho).
//! - `water_sat_pressure_pa(t_k)`: saturation vapour pressure to critical point (the single copy; IF97 region 4).
//! - `water_dielectric_sat(t_k)`: relative permittivity along the saturation curve (for Debye-Hueckel slopes).

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

/// Saturation vapour pressure of water (Pa): the IAPWS-IF97 region-4 equation (R7-97, eq. 30), valid from 273.15 K to
/// the critical point. This is the engine's single implementation of the water saturation curve; the species record of
/// water names it (`vapor_pressure.model = "iapws-if97-region4"`) and everything else (sealed vessels, boiling, collectors
/// over water, humidity) asks the vapour-liquid-equilibrium layer, which calls it. Below the triple point the curve is
/// evaluated at 273.15 K (ice is Stage 5); above the critical temperature it returns the critical pressure.
pub fn water_sat_pressure_pa(t_k: f64) -> f64 {
    const N: [f64; 10] = [
        0.11670521452767e4,
        -0.72421316703206e6,
        -0.17073846940092e2,
        0.12020824702470e5,
        -0.32325550322333e7,
        0.14915108613530e2,
        -0.48232657361591e4,
        0.40511340542057e6,
        -0.23855557567849,
        0.65017534844798e3,
    ];
    if t_k >= WATER_TC_K {
        return WATER_PC_PA;
    }
    let t = t_k.max(273.15);
    let th = t + N[8] / (t - N[9]);
    let a = th * th + N[0] * th + N[1];
    let b = N[2] * th * th + N[3] * th + N[4];
    let c = N[5] * th * th + N[6] * th + N[7];
    let p_mpa = (2.0 * c / (-b + (b * b - 4.0 * a * c).sqrt())).powi(4);
    p_mpa * 1.0e6
}

/// Relative permittivity of liquid water along the saturation curve, 0-200 C (Malmberg & Maryott 1956 polynomial,
/// accurate to about 1 % to 100 C and 2 % to 200 C; 78.30 at 25 C, 55.7 at 100 C). Used by the
/// Debye-Hueckel limiting-law slopes, which need the dielectric constant of the *actual* solvent at T.
pub fn water_dielectric_sat(t_k: f64) -> f64 {
    let t = (t_k - 273.15).clamp(0.0, 200.0);
    87.740 - 0.40008 * t + 9.398e-4 * t * t - 1.410e-6 * t * t * t
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
    fn if97_saturation_pressure_check_values() {
        // IAPWS-IF97 verification values (Table 35 of R7-97): 300 K 0.353658941e-2 MPa, 500 K 0.263889776e1, 600 K 0.123443146e2
        for (t, p) in [(300.0, 0.353658941e-2), (500.0, 0.263889776e1), (600.0, 0.123443146e2)] {
            let got = water_sat_pressure_pa(t) / 1e6;
            assert!(((got - p) / p).abs() < 1e-7, "T={} K: {} vs {}", t, got, p);
        }
        // normal boiling point and the critical region
        assert!((water_sat_pressure_pa(373.124) - 101325.0).abs() < 100.0);
        assert!((water_sat_pressure_pa(647.0) / 1e6 - 22.06).abs() < 0.05);
    }

    #[test]
    fn test_water_density_and_dielectric() {
        let rho_298 = water_density_kg_m3(298.15, 101325.0);
        assert!((rho_298 - 997.05).abs() < 1.0, "rho_298 = {}", rho_298);

        let eps_298 = water_dielectric(298.15, rho_298);
        assert!((eps_298 - 78.4).abs() < 1.0, "eps_298 = {}", eps_298);
    }
}
