//! Sedimentation of a particle population in the liquid that is actually in the vessel: Stokes / Schiller-Naumann
//! terminal velocity from the layer's own density and viscosity, hindered settling (Richardson-Zaki), the Brownian
//! Peclet test that keeps colloids suspended, and Schulze-Hardy aggregation by the electrolyte present (master plan
//! Stage 8 item 7). There is no 8-300 s clamp and no flocculation factor: the time to clear the liquid column is
//! H / v_hindered, infinite for a stable colloid.

pub use super::hydro::terminal_velocity as terminal_velocity_m_s;
use crate::transport::K_BOLTZMANN;

/// Richardson-Zaki hindered settling velocity (m/s) at solid volume fraction phi: v = v_t (1 - phi)^n, n = 4.65 in the
/// creeping-flow regime (the exponent falls toward 2.4 at high particle Reynolds number).
pub fn hindered_settling_velocity_m_s(v_terminal_m_s: f64, phi: f64, re_p: f64) -> f64 {
    let n = if re_p < 0.2 {
        4.65
    } else if re_p > 500.0 {
        2.39
    } else {
        // log-linear interpolation of the Richardson-Zaki exponent between Re_p = 0.2 and 500
        4.65 + (2.39 - 4.65) * (re_p / 0.2).ln() / (500.0f64 / 0.2).ln()
    };
    v_terminal_m_s * (1.0 - phi.clamp(0.0, 0.65)).powf(n)
}

/// Brownian Peclet number Pe = v d / D with the Stokes-Einstein diffusivity: Pe < 1 means thermal motion beats
/// sedimentation and the dispersion is stable.
pub fn peclet_number(v_settle_m_s: f64, d_m: f64, eta_pa_s: f64, t_k: f64) -> f64 {
    let d = d_m.max(1e-9);
    let diff = K_BOLTZMANN * t_k.max(100.0) / (3.0 * std::f64::consts::PI * eta_pa_s.max(1e-6) * d);
    v_settle_m_s.abs() * d / diff
}

/// Time (s) for particles of diameter `d_m` to clear a liquid column of `height_m` (infinite when they float, or when
/// Brownian motion keeps them dispersed).
pub fn settling_time_s(
    height_m: f64,
    d_m: f64,
    rho_p: f64,
    rho_l: f64,
    eta_pa_s: f64,
    phi: f64,
    t_k: f64,
) -> f64 {
    let v_t = terminal_velocity_m_s(d_m, rho_p, rho_l, eta_pa_s);
    if v_t <= 0.0 {
        return f64::INFINITY;
    }
    let re = rho_l * v_t * d_m / eta_pa_s.max(1e-6);
    let v = hindered_settling_velocity_m_s(v_t, phi, re);
    if peclet_number(v, d_m, eta_pa_s, t_k) < 1.0 {
        return f64::INFINITY;
    }
    height_m.max(1e-3) / v.max(1e-15)
}

/// Schulze-Hardy critical coagulation concentration of a counter-ion of charge |z| (mol/L): CCC = K / z^6, K = 55 mmol/L
/// (the monovalent value of the classical As2S3 sol; the 1 : 1/80 : 1/600 ratios for Na+, Ca2+, Al3+ follow z^-6).
pub fn critical_coagulation_mol_l(z: f64) -> f64 {
    0.055 / z.abs().max(1.0).powi(6)
}

/// Coagulation index Gamma = sum_i c_i z_i^6 / K over the ions of one sign (the larger of the two): >= 1 means the
/// colloid is at or beyond its critical coagulation concentration.
pub fn coagulation_index(ions_mol_l_and_charge: &[(f64, f64)]) -> f64 {
    let mut cat = 0.0;
    let mut an = 0.0;
    for &(c, z) in ions_mol_l_and_charge {
        let w = c * z.abs().powi(6) / 0.055;
        if z > 0.0 {
            cat += w;
        } else {
            an += w;
        }
    }
    cat.max(an)
}

/// Effective settling diameter of an aggregated colloid: open fractal aggregates settle like a sphere about up to 5x the
/// primary size, approached as the coagulation index passes 1.
pub fn aggregate_diameter_m(primary_m: f64, gamma_index: f64) -> f64 {
    primary_m * (1.0 + 4.0 * gamma_index / (1.0 + gamma_index))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn baso4_10um_settles_4cm_in_minutes_and_glycerol_is_a_thousand_times_slower() {
        let t_w = settling_time_s(0.04, 10e-6, 4500.0, 998.2, 1.002e-3, 0.001, 293.15);
        assert!(t_w > 150.0 && t_w < 300.0, "{}", t_w);
        let t_g = settling_time_s(0.04, 10e-6, 4500.0, 1261.0, 1.412, 0.001, 293.15);
        let r = t_g / t_w;
        assert!(r > 600.0 && r < 2500.0, "{}", r);
    }

    #[test]
    fn colloids_stay_suspended_by_brownian_motion() {
        assert!(settling_time_s(0.04, 50e-9, 4500.0, 998.0, 1.0e-3, 0.0, 293.15).is_infinite());
    }

    #[test]
    fn schulze_hardy_scaling() {
        assert!((critical_coagulation_mol_l(1.0) / critical_coagulation_mol_l(2.0) - 64.0).abs() < 1e-9);
        assert!(coagulation_index(&[(0.01, 3.0)]) > coagulation_index(&[(0.01, 1.0)]));
    }
}
