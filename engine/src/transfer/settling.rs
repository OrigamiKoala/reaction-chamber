//! Stokes sedimentation, hindered settling, and Brownian colloidal stability.
//!
//! Evaluates particle terminal settling velocity using actual fluid properties:
//!   v_t = g * (rho_particle - rho_fluid) * d_p^2 / (18 * eta_fluid)
//! Hindered settling follows Richardson-Zaki: v = v_t * (1 - phi)^4.65.
//! Sub-micron particles (Pe < 1) are stabilized by Brownian motion.
//!
//! Eliminates arbitrary 8-300 s clamps and artificial floc factors.
//!
//! Gate verified:
//! - 10 um BaSO4 settles 4 cm in 150 - 300 s in water, and ~1000x slower in glycerol.

use crate::transport::K_BOLTZMANN;

pub const G_ACCEL: f64 = 9.80665;

/// Single-particle terminal settling velocity v_t (m/s).
///
/// Positive = settling downward; negative = floating upward.
pub fn terminal_velocity_m_s(
    diameter_m: f64,
    particle_density_kg_m3: f64,
    fluid_density_kg_m3: f64,
    fluid_viscosity_pa_s: f64,
) -> f64 {
    let dp = diameter_m.max(1e-9);
    let eta = fluid_viscosity_pa_s.max(1e-6);
    let delta_rho = particle_density_kg_m3 - fluid_density_kg_m3;

    // Stokes settling velocity
    let v_stokes = (G_ACCEL * delta_rho * dp.powi(2)) / (18.0 * eta);

    // Schiller-Naumann drag correction for Re_p > 0.2
    let re_p = (fluid_density_kg_m3 * v_stokes.abs() * dp / eta).clamp(1e-6, 1e4);
    if re_p <= 0.2 {
        v_stokes
    } else {
        // Drag coefficient Cd = (24 / Re) * (1 + 0.15 * Re^0.687)
        let cd_factor = 1.0 + 0.15 * re_p.powf(0.687);
        v_stokes / cd_factor
    }
}

/// Hindered settling velocity considering solid volume fraction phi (Richardson-Zaki).
pub fn hindered_settling_velocity_m_s(
    v_terminal_m_s: f64,
    solid_volume_fraction: f64,
) -> f64 {
    let phi = solid_volume_fraction.clamp(0.0, 0.65);
    // Richardson-Zaki exponent n ~ 4.65 for creeping laminar flow (Re_p < 0.2)
    let hindrance = (1.0 - phi).powf(4.65);
    v_terminal_m_s * hindrance
}

/// Computes the Brownian Péclet number Pe = v_t * d_p / D_diff.
///
/// If Pe < 1.0, Brownian thermal motion dominates over sedimentation,
/// meaning the particles form a stable colloidal dispersion and will not settle.
pub fn pe_number(
    v_settle_m_s: f64,
    diameter_m: f64,
    fluid_viscosity_pa_s: f64,
    t_k: f64,
) -> f64 {
    let dp = diameter_m.max(1e-9);
    let eta = fluid_viscosity_pa_s.max(1e-6);
    let t = t_k.max(100.0);

    // Stokes-Einstein diffusivity: D = k_B * T / (3 * pi * eta * dp)
    let d_diff = (K_BOLTZMANN * t) / (3.0 * std::f64::consts::PI * eta * dp);
    (v_settle_m_s.abs() * dp / d_diff).max(0.0)
}

/// Time required (seconds) for particles to clear a specified liquid column height.
pub fn settling_time_s(
    column_height_m: f64,
    diameter_m: f64,
    particle_density_kg_m3: f64,
    fluid_density_kg_m3: f64,
    fluid_viscosity_pa_s: f64,
    solid_volume_fraction: f64,
    t_k: f64,
) -> f64 {
    let h = column_height_m.max(1e-3);
    let v_t = terminal_velocity_m_s(diameter_m, particle_density_kg_m3, fluid_density_kg_m3, fluid_viscosity_pa_s);

    if v_t <= 0.0 {
        // Floating or neutrally buoyant
        return f64::INFINITY;
    }

    let v_hindered = hindered_settling_velocity_m_s(v_t, solid_volume_fraction);
    let pe = pe_number(v_hindered, diameter_m, fluid_viscosity_pa_s, t_k);

    if pe < 1.0 {
        // Colloidal stability: Brownian motion prevents settling
        f64::INFINITY
    } else {
        h / v_hindered.max(1e-12)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_baso4_settling_gate() {
        // Gate: 10 um BaSO4 settles 4 cm in 150 - 300 s in water, and ~1000x slower in glycerol
        let dp = 10.0e-6; // 10 um
        let rho_baso4 = 4500.0; // kg/m^3
        let h = 0.04; // 4 cm
        let phi = 0.001;
        let t = 293.15; // 20 C

        // Water at 20 C: rho ~ 998 kg/m^3, eta ~ 1.002e-3 Pa*s
        let rho_water = 998.2;
        let eta_water = 1.002e-3;
        let tau_water = settling_time_s(h, dp, rho_baso4, rho_water, eta_water, phi, t);

        assert!(
            tau_water >= 150.0 && tau_water <= 300.0,
            "10 um BaSO4 in water must settle in [150, 300] s: got {:.1} s",
            tau_water
        );

        // Glycerol at 20 C: rho ~ 1261 kg/m^3, eta ~ 1.412 Pa*s (~ 1400x more viscous!)
        let rho_gly = 1261.0;
        let eta_gly = 1.412;
        let tau_gly = settling_time_s(h, dp, rho_baso4, rho_gly, eta_gly, phi, t);

        let ratio = tau_gly / tau_water;
        assert!(
            ratio >= 700.0 && ratio <= 2000.0,
            "Settling in glycerol must be ~1000x slower than water: ratio = {:.1}",
            ratio
        );
    }
}
