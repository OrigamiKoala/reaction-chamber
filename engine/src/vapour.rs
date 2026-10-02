//! Saturation vapour pressures of the liquids the engine models explicitly, from correlations that are valid up to the
//! critical point (Stage 0 bridge for sealed vessels; Stage 4 derives every vapour pressure from species data).
//!
//! - **Water**: IAPWS-IF97 region-4 saturation-pressure equation (273.15 K to the critical point 647.096 K). It replaces
//!   the Antoine line that was clamped at 10 atm (sealed water at 627 K read 12 atm, the real value is about 180 atm).
//! - **Ethanol**: the Wagner equation with the Reid-Prausnitz-Poling coefficients (Tc 513.92 K, Pc 61.48 bar), accurate
//!   to the critical point (the normal boiling point comes out at 351.5 K).
//!
//! Imported inert compounds use their own fitted `VaporCurve` (`compound_thermo`); no value here is a per-compound
//! property stored as such: each is a curve whose derived quantities (boiling point at any pressure, latent heat via
//! Watson's relation) follow from the equation.

/// Critical temperatures (K).
pub const WATER_TC_K: f64 = 647.096;
pub const ETHANOL_TC_K: f64 = 513.92;

/// Water saturation pressure (Pa), IAPWS-IF97 eq. 30. Defined from 273.15 K to the critical point; outside that range
/// the equation is evaluated at the nearest end (a frozen/hot-limit placeholder, not extrapolated).
pub fn water_psat_pa(t_k: f64) -> f64 {
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
    let t = t_k.clamp(273.15, WATER_TC_K);
    let th = t + N[8] / (t - N[9]);
    let a = th * th + N[0] * th + N[1];
    let b = N[2] * th * th + N[3] * th + N[4];
    let c = N[5] * th * th + N[6] * th + N[7];
    let p_mpa = (2.0 * c / (-b + (b * b - 4.0 * a * c).sqrt())).powi(4);
    p_mpa * 1.0e6
}

/// Ethanol saturation pressure (Pa), Wagner equation (Reid, Prausnitz & Poling): valid from the triple point to Tc.
pub fn ethanol_psat_pa(t_k: f64) -> f64 {
    const PC_PA: f64 = 61.48e5;
    const A: f64 = -8.51838;
    const B: f64 = 0.34163;
    const C: f64 = -5.73683;
    const D: f64 = 8.32581;
    let t = t_k.clamp(150.0, ETHANOL_TC_K);
    let tr = t / ETHANOL_TC_K;
    let tau = 1.0 - tr;
    PC_PA * ((A * tau + B * tau.powf(1.5) + C * tau.powi(3) + D * tau.powi(6)) / tr).exp()
}

/// Watson's relation for the heat of vaporisation: dH(T) = dH_ref * ((1 - T/Tc) / (1 - T_ref/Tc))^0.38 (J/mol). Zero at
/// and above the critical point.
pub fn watson_dh_j_mol(dh_ref_j_mol: f64, t_ref_k: f64, tc_k: f64, t_k: f64) -> f64 {
    if t_k >= tc_k || t_ref_k >= tc_k {
        return 0.0;
    }
    dh_ref_j_mol * ((1.0 - t_k / tc_k) / (1.0 - t_ref_k / tc_k)).powf(0.38)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn if97_saturation_check_values() {
        // IAPWS-IF97 Table 35 verification values (MPa)
        for (t, p) in [(300.0, 0.353658941e-2), (500.0, 0.263889776e1), (600.0, 0.123443146e2)] {
            let got = water_psat_pa(t) / 1e6;
            assert!(((got - p) / p).abs() < 1e-7, "T={} K: {} vs {}", t, got, p);
        }
        // normal boiling point
        assert!((water_psat_pa(373.124) - 101325.0).abs() < 100.0);
        // near the critical point (22.064 MPa)
        assert!((water_psat_pa(647.0) / 1e6 - 22.06).abs() < 0.05);
    }

    #[test]
    fn ethanol_wagner_matches_known_points() {
        // normal boiling point 351.44 K; about 2.2 bar at 100 C and 5.3 bar at 400 K; Pc at Tc
        assert!((ethanol_psat_pa(351.44) / 101325.0 - 1.0).abs() < 0.01);
        let p373 = ethanol_psat_pa(373.15) / 1e5;
        assert!(p373 > 2.1 && p373 < 2.4, "p(100 C) = {} bar", p373);
        let p400 = ethanol_psat_pa(400.0) / 1e5;
        assert!(p400 > 5.0 && p400 < 5.6, "p(400 K) = {} bar", p400);
        assert!((ethanol_psat_pa(ETHANOL_TC_K) / 1e5 - 61.48).abs() < 0.01);
    }

    #[test]
    fn watson_latent_heat_falls_to_zero_at_tc() {
        let dh = watson_dh_j_mol(40_660.0, 373.15, WATER_TC_K, 473.15);
        assert!(dh > 33_000.0 && dh < 37_000.0, "water dHvap(200 C) = {}", dh);
        assert_eq!(watson_dh_j_mol(40_660.0, 373.15, WATER_TC_K, 700.0), 0.0);
    }
}
