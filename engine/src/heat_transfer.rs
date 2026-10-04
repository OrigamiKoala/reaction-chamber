//! Heat exchange of a vessel with its surroundings, from heat-transfer correlations and material properties.
//!
//! * Natural convection to room air from a vertical wall: the Churchill-Chu correlation
//!   `Nu = [0.825 + 0.387 Ra^(1/6) / (1 + (0.492/Pr)^(9/16))^(8/27)]^2` with the air properties at the film temperature.
//! * Radiation to the room: a grey surface of emissivity 0.9 (glass), `h_r = eps sigma (T_s^2 + T_inf^2)(T_s + T_inf)`.
//! * Coupling to a bath: the series resistance of the liquid film inside, the glass wall and the bath film outside.
//!
//! The vessel's geometry (radius, liquid height, capacity) sets the areas; nothing here depends on the contents.

use std::f64::consts::PI;

/// Stefan-Boltzmann constant, W/(m^2 K^4).
pub const SIGMA: f64 = 5.670374419e-8;
/// Total hemispherical emissivity of glass.
pub const EMISSIVITY_GLASS: f64 = 0.9;
/// Gravitational acceleration, m/s^2.
const G: f64 = 9.80665;
/// Thickness (m) and thermal conductivity (W/(m K)) of a borosilicate vessel wall.
pub const WALL_THICKNESS_M: f64 = 2.5e-3;
pub const WALL_CONDUCTIVITY: f64 = 1.14;
/// Film coefficients (W/(m^2 K)) of the liquid in the vessel (stirred / still, natural convection) and of a stirred water bath.
pub const H_LIQUID_STIRRED: f64 = 700.0;
pub const H_LIQUID_STILL: f64 = 200.0;
pub const H_BATH: f64 = 500.0;
/// Coefficient (W/(m^2 K)) of the base of the vessel to the bench (conduction through a thin air gap and the bench top).
pub const H_BASE_TO_BENCH: f64 = 10.0;

/// Air at temperature `t_k` and 1 atm: (conductivity W/(m K), kinematic viscosity m^2/s, thermal diffusivity m^2/s).
/// Power-law fits to the standard tables between 250 and 450 K.
fn air_properties(t_k: f64) -> (f64, f64, f64) {
    let r = (t_k / 300.0).clamp(0.6, 2.0);
    (0.0263 * r.powf(0.8), 1.568e-5 * r.powf(1.7), 2.25e-5 * r.powf(1.8))
}

/// Mean natural-convection coefficient (W/(m^2 K)) of a vertical wall of height `l_m` at `t_wall` in air at `t_air`.
pub fn natural_convection_h(t_wall: f64, t_air: f64, l_m: f64) -> f64 {
    let d_t = (t_wall - t_air).abs();
    if d_t < 1e-6 || l_m <= 0.0 {
        return 0.0;
    }
    let t_film = 0.5 * (t_wall + t_air);
    let (k, nu, alpha) = air_properties(t_film);
    let pr = nu / alpha;
    let ra = G * d_t / t_film * l_m.powi(3) / (nu * alpha);
    let nu_l = (0.825 + 0.387 * ra.powf(1.0 / 6.0) / (1.0 + (0.492 / pr).powf(9.0 / 16.0)).powf(8.0 / 27.0)).powi(2);
    nu_l * k / l_m
}

/// Radiative coefficient (W/(m^2 K)) of a grey surface at `t_s` to surroundings at `t_inf`.
pub fn radiation_h(t_s: f64, t_inf: f64, emissivity: f64) -> f64 {
    emissivity * SIGMA * (t_s * t_s + t_inf * t_inf) * (t_s + t_inf)
}

/// Areas (m^2) of a cylindrical vessel of inner radius `r_m` and capacity `capacity_ml` holding `liquid_ml`: the wall
/// wetted by the liquid, the base, and the dry wall above the liquid.
pub fn vessel_areas(r_m: f64, capacity_ml: f64, liquid_ml: f64) -> (f64, f64, f64, f64) {
    let cross = PI * r_m * r_m;
    let h_vessel = (capacity_ml * 1e-6 / cross).max(0.01);
    let h_liquid = (liquid_ml * 1e-6 / cross).clamp(0.0, h_vessel);
    let circumference = 2.0 * PI * r_m;
    (circumference * h_liquid, cross, circumference * (h_vessel - h_liquid), h_liquid)
}

/// Heat loss coefficient (W/K) of the vessel at `t_k` in a room at `t_room`: the wall wetted by the liquid and the dry wall
/// above it (convection and radiation) and the base (to the bench); `in_bath` when a bath surrounds the wetted wall.
pub fn ambient_loss_w_per_k(r_m: f64, capacity_ml: f64, liquid_ml: f64, t_k: f64, t_room: f64, in_bath: bool) -> f64 {
    let (a_wet, a_base, a_dry, h_liquid) = vessel_areas(r_m, capacity_ml, liquid_ml);
    let h_vessel = h_liquid + a_dry / (2.0 * PI * r_m);
    let wall = |a: f64, l: f64| a * (natural_convection_h(t_k, t_room, l.max(0.005)) + radiation_h(t_k, t_room, EMISSIVITY_GLASS));
    // the dry wall above the liquid is a fin of glass thin compared with its length: it loses at most a quarter of its
    // area's worth at the liquid's temperature
    // in a bath the wetted wall and the base face the bath (`bath_coupling_w_per_k`), only the dry wall faces the room
    let dry = 0.25 * wall(a_dry, h_vessel);
    if in_bath { dry } else { wall(a_wet, h_vessel) + dry + a_base * H_BASE_TO_BENCH }
}

/// Coupling (W/K) between the liquid and a bath that surrounds the wetted wall and base of the vessel.
pub fn bath_coupling_w_per_k(r_m: f64, capacity_ml: f64, liquid_ml: f64, stirred: bool) -> f64 {
    let (a_wet, a_base, _, _) = vessel_areas(r_m, capacity_ml, liquid_ml);
    let h_in = if stirred { H_LIQUID_STIRRED } else { H_LIQUID_STILL };
    let u = 1.0 / (1.0 / h_in + WALL_THICKNESS_M / WALL_CONDUCTIVITY + 1.0 / H_BATH);
    u * (a_wet + a_base)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn beaker_of_hot_water_loses_a_fraction_of_a_watt_per_kelvin() {
        // 100 mL in a 250 mL beaker of 3.5 cm radius at 80 C in a 22 C room
        let g = ambient_loss_w_per_k(0.035, 250.0, 100.0, 353.15, 295.15, false);
        assert!(g > 0.1 && g < 0.4, "loss coefficient {} W/K", g);
        // a bath couples several times more strongly than the air does
        let b = bath_coupling_w_per_k(0.035, 250.0, 100.0, true);
        assert!(b > 1.0 && b < 4.0, "bath coupling {} W/K", b);
    }

    #[test]
    fn natural_convection_matches_the_textbook_range() {
        // a 5 cm wall 30 K above the air: h of 4-8 W/(m^2 K)
        let h = natural_convection_h(325.0, 295.0, 0.05);
        assert!(h > 3.0 && h < 9.0, "h = {}", h);
    }
}
