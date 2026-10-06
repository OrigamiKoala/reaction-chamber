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

/// Properties of the liquid at the glass wall that set its film coefficient (SI): kinematic viscosity, Prandtl number,
/// conductivity, expansivity.
#[derive(Clone, Copy, Debug)]
pub struct FilmLiquid {
    pub nu_m2_s: f64,
    pub pr: f64,
    pub k_w_m_k: f64,
    pub beta_per_k: f64,
}

impl FilmLiquid {
    /// Water near room temperature (used when a vessel holds no liquid to ask).
    pub const WATER: FilmLiquid = FilmLiquid { nu_m2_s: 0.9e-6, pr: 6.1, k_w_m_k: 0.607, beta_per_k: 2.6e-4 };
}

/// Nucleate-boiling coefficient (W/(m^2 K)) at the heated glass of a boiling liquid (Rohsenow: 3-10 kW/(m^2 K) for water at
/// moderate flux); the glass is within a few kelvin of the liquid while it boils.
pub const H_NUCLEATE_BOILING: f64 = 5000.0;

/// Natural-convection coefficient of a vertical wall of height `l_m` (Churchill-Chu) and of a horizontal plate facing up
/// (turbulent, `Nu = 0.15 Ra^(1/3)`, independent of its size), W/(m^2 K), for a liquid film at `delta_k` between wall and bulk.
fn natural_h(liq: &FilmLiquid, delta_k: f64, l_m: f64) -> (f64, f64) {
    let d = delta_k.abs().max(2.0);
    let alpha = liq.nu_m2_s / liq.pr;
    let g_term = G * liq.beta_per_k * d / (liq.nu_m2_s * alpha);
    let ra_l = g_term * l_m.max(0.005).powi(3);
    let nu_wall = (0.825 + 0.387 * ra_l.powf(1.0 / 6.0) / (1.0 + (0.492 / liq.pr).powf(9.0 / 16.0)).powf(8.0 / 27.0)).powi(2);
    let h_wall = nu_wall * liq.k_w_m_k / l_m.max(0.005);
    let h_base = 0.15 * liq.k_w_m_k * g_term.powf(1.0 / 3.0);
    (h_wall, h_base)
}

/// Conductance (W/K) of the liquid film between the contents and the glass wall (wetted wall and base): natural convection
/// from the properties of the liquid and the wall-to-bulk temperature difference, at least the stirred value when the liquid is
/// stirred, nucleate boiling at the glass of a boiling liquid.
pub fn film_conductance_w_per_k(r_m: f64, capacity_ml: f64, liquid_ml: f64, stirred: bool, delta_k: f64, liq: &FilmLiquid, boiling: bool) -> f64 {
    let (a_wet, a_base, _, h_liquid) = vessel_areas(r_m, capacity_ml, liquid_ml);
    let (mut h_wall, mut h_base) = natural_h(liq, delta_k, h_liquid);
    if stirred {
        h_wall = h_wall.max(H_LIQUID_STIRRED);
        h_base = h_base.max(H_LIQUID_STIRRED);
    }
    if boiling {
        h_wall = h_wall.max(H_NUCLEATE_BOILING);
        h_base = h_base.max(H_NUCLEATE_BOILING);
    }
    h_wall * a_wet + h_base * a_base
}

/// Conductance (W/K) between the glass wall node (mid-wall) and a bath around the wetted wall and base: half the wall's own
/// conduction in series with the bath film.
pub fn bath_outer_conductance_w_per_k(r_m: f64, capacity_ml: f64, liquid_ml: f64) -> f64 {
    let (a_wet, a_base, _, _) = vessel_areas(r_m, capacity_ml, liquid_ml);
    let u = 1.0 / (0.5 * WALL_THICKNESS_M / WALL_CONDUCTIVITY + 1.0 / H_BATH);
    u * (a_wet + a_base)
}

/// Highest surface temperature (K) a laboratory hot plate's ceramic top reaches (its thermostat / element limit: about 350 C
/// on the common stirrer-hotplates; the knob sets the *power* up to what this temperature can pass on).
pub const HOT_PLATE_MAX_SURFACE_K: f64 = 623.15;
/// Coefficient (W/(m^2 K)) of the vessel's base to the plate: thin borosilicate on ceramic with a small air gap.
pub const H_BASE_TO_PLATE: f64 = 500.0;
/// Conductance (W/K) from the plate's chassis and underside to the room (the plate's own body, besides its open top).
pub const PLATE_BODY_LOSS_W_PER_K: f64 = 0.3;
/// Radius (m) of the plate top of a stirrer-hotplate (a 10 cm square plate, equivalent disc).
pub const PLATE_RADIUS_M: f64 = 0.056;

/// Heat (W) a hot plate set to `power_w` actually passes into a vessel at `t_vessel` standing on it: the plate top settles at the
/// temperature where the element's power equals the conduction through the vessel base plus the plate's own losses (the open
/// part of its top by convection and radiation, its body), but never above `HOT_PLATE_MAX_SURFACE_K`. A vessel that is hot
/// takes less than the nominal power; an empty one cannot pass the plate's temperature limit on.
pub fn hot_plate_heat_w(power_w: f64, t_vessel: f64, t_room: f64, vessel_radius_m: f64) -> f64 {
    if power_w <= 0.0 {
        return 0.0;
    }
    let a_base = PI * vessel_radius_m * vessel_radius_m;
    let g_base = H_BASE_TO_PLATE * a_base;
    let a_open = (PI * PLATE_RADIUS_M * PLATE_RADIUS_M - a_base).max(0.0);
    let lost = |ts: f64| a_open * (natural_convection_h(ts, t_room, 0.1) + radiation_h(ts, t_room, 0.9)) * (ts - t_room) + PLATE_BODY_LOSS_W_PER_K * (ts - t_room);
    let into_vessel = |ts: f64| g_base * (ts - t_vessel);
    // the element's power balance P = into_vessel(Ts) + lost(Ts) is increasing in Ts: bisect, capped at the surface limit
    let balance = |ts: f64| into_vessel(ts) + lost(ts) - power_w;
    if t_vessel >= HOT_PLATE_MAX_SURFACE_K {
        return 0.0;
    }
    let ts = if balance(HOT_PLATE_MAX_SURFACE_K) <= 0.0 {
        HOT_PLATE_MAX_SURFACE_K
    } else {
        let (mut lo, mut hi) = (t_vessel.min(t_room), HOT_PLATE_MAX_SURFACE_K);
        for _ in 0..60 {
            let mid = 0.5 * (lo + hi);
            if balance(mid) > 0.0 { hi = mid } else { lo = mid }
        }
        0.5 * (lo + hi)
    };
    (into_vessel(ts)).clamp(0.0, power_w)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_hot_plate_saturates_at_its_surface_limit() {
        // a 600 W plate under a 250 mL beaker (3.5 cm radius): cold contents take most of it, hot contents little
        let cold = hot_plate_heat_w(600.0, 295.15, 295.15, 0.035);
        let hot = hot_plate_heat_w(600.0, 500.0, 295.15, 0.035);
        assert!(cold > 350.0 && cold <= 600.0, "{} W into a cold beaker", cold);
        assert!(hot < 0.6 * cold, "{} W into a 500 K beaker", hot);
        assert_eq!(hot_plate_heat_w(600.0, 640.0, 295.15, 0.035), 0.0, "nothing flows past the surface limit");
        // a weak plate passes what it makes
        assert!((hot_plate_heat_w(20.0, 295.15, 295.15, 0.035) - 20.0).abs() < 8.0);
    }

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
