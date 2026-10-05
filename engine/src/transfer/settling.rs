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

/// Fractal dimension of sedimenting / sheared flocs (Tang & Raper 2002: 2.0-2.4 for flocs formed by shear and differential
/// settling; diffusion-limited clusters are 1.8, restructured flocs approach 2.5).
pub const FLOC_FRACTAL_DIM: f64 = 2.3;
/// Largest solid volume fraction a floc can reach inside its own envelope (a floc cannot be denser than random packing).
pub const FLOC_MAX_SOLID_FRACTION: f64 = 0.5;
/// Mean relative settling speed of two flocs of the same size class over their settling speed: aggregates of a
/// polydisperse suspension differ in size, so the differential-sedimentation kernel does not vanish for "equal" flocs.
pub const POLYDISPERSITY_FACTOR: f64 = 0.5;

/// Solid volume fraction of a floc of diameter `d_floc` made of primaries of diameter `d_primary`.
pub fn floc_solid_fraction(d_primary: f64, d_floc: f64) -> f64 {
    (d_floc / d_primary.max(1e-12)).max(1.0).powf(FLOC_FRACTAL_DIM - 3.0)
}

/// Rate (1/s) at which the mean number of primaries per floc, g = (d_floc / d_primary)^D_f, grows by collisions of flocs of
/// that size (Smoluchowski: d<g>/dt = 1/2 alpha beta N0 with N0 the primary-particle number density). The kernel is the sum of
/// the Brownian, orthokinetic-shear and differential-sedimentation collision frequencies of two flocs of radius `d_floc / 2`:
///   beta_B = 8 k T / (3 eta),  beta_S = (4/3) G (2 r)^3,  beta_DS = pi (2 r)^2 kappa v_s.
/// `alpha` is the collision efficiency (1 when the electrolyte has screened the repulsion, 0 for a stable colloid).
pub fn aggregation_rate_per_s(alpha: f64, n_primary_per_m3: f64, d_floc: f64, eta_pa_s: f64, t_k: f64, shear_g: f64, v_settle_m_s: f64) -> f64 {
    if alpha <= 0.0 || n_primary_per_m3 <= 0.0 {
        return 0.0;
    }
    let r = 0.5 * d_floc;
    let beta_b = 8.0 * crate::transport::K_BOLTZMANN * t_k / (3.0 * eta_pa_s.max(1e-9));
    let beta_s = (4.0 / 3.0) * shear_g.max(0.0) * (2.0 * r).powi(3);
    let beta_ds = std::f64::consts::PI * (2.0 * r).powi(2) * POLYDISPERSITY_FACTOR * v_settle_m_s.abs();
    0.5 * alpha * (beta_b + beta_s + beta_ds) * n_primary_per_m3
}

/// Largest floc diameter (m): the smaller of the space-filling size (the floc's own solid fraction cannot pass
/// `FLOC_MAX_SOLID_FRACTION`) and the Kolmogorov microscale of the flow, sqrt(nu / G), above which turbulent shear breaks
/// flocs.
pub fn max_floc_diameter_m(d_primary: f64, solid_fraction: f64, shear_g: f64, nu_m2_s: f64) -> f64 {
    let fill = d_primary * (FLOC_MAX_SOLID_FRACTION / solid_fraction.max(1e-12)).max(1.0).powf(1.0 / (3.0 - FLOC_FRACTAL_DIM));
    let kolmogorov = (nu_m2_s.max(1e-9) / shear_g.max(1e-6)).sqrt();
    fill.min(kolmogorov.max(d_primary))
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
    fn floc_growth_kernels_and_caps() {
        // a stable colloid (alpha 0) does not aggregate; shear and settling raise the rate; the Brownian part is size independent
        assert_eq!(aggregation_rate_per_s(0.0, 1e20, 1e-6, 1e-3, 298.0, 1.0, 0.0), 0.0);
        let b = aggregation_rate_per_s(1.0, 1e20, 1e-7, 1e-3, 298.0, 0.0, 0.0);
        assert!((b / aggregation_rate_per_s(1.0, 1e20, 1e-6, 1e-3, 298.0, 0.0, 0.0) - 1.0).abs() < 1e-9);
        assert!(aggregation_rate_per_s(1.0, 1e20, 1e-5, 1e-3, 298.0, 1.0, 0.0) > 10.0 * b);
        // space filling: more solid means smaller flocs; a Kolmogorov scale caps vigorous stirring
        let quiet = max_floc_diameter_m(1e-8, 1e-3, 0.2, 1e-6);
        assert!(max_floc_diameter_m(1e-8, 1e-2, 0.2, 1e-6) < quiet);
        assert!(max_floc_diameter_m(1e-8, 1e-3, 500.0, 1e-6) < 50e-6);
        assert!(floc_solid_fraction(1e-8, 1e-4) < floc_solid_fraction(1e-8, 1e-6));
    }

    #[test]
    fn schulze_hardy_scaling() {
        assert!((critical_coagulation_mol_l(1.0) / critical_coagulation_mol_l(2.0) - 64.0).abs() < 1e-9);
        assert!(coagulation_index(&[(0.01, 3.0)]) > coagulation_index(&[(0.01, 1.0)]));
    }
}
