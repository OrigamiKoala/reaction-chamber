//! Gas-liquid transfer of dissolved gases: surface exchange, and release as bubbles when the dissolved-gas tension
//! exceeds the ambient pressure (master plan Stage 8 item 5).
//!
//! * Surface exchange: N = k_L a (c - c*) with k_L from `hydro::gas_liquid_kl` (diffusion through the layer at rest,
//!   surface renewal when stirred): the relaxation of a resting 2.5 cm layer takes hours, a stirred one minutes.
//! * Bubble release (fizzing): a liquid whose dissolved-gas tension plus vapour pressure exceeds the ambient pressure
//!   is metastable and degasses at the nucleation sites of every wetted surface: cavities of the glass wall and of the
//!   solid particles, activated in proportion to the square of the excess pressure and limited by crowding. Each
//!   growing bubble takes gas from the liquid with the boundary-layer coefficient of a rising bubble. A larger
//!   surface (crystals!) and a larger excess fizz faster; a clean wall and a small excess degas only slowly.
//!
//! CO2 hydration (the slow step CO2(aq) + H2O <=> H+ + HCO3-) is not here: it is a rate on the equilibrium row of the
//! species data (`GeneralEquilibrium::rate`) relaxed by the equilibrium solver.

use super::hydro::{sherwood_ranz_marshall, terminal_velocity};

/// Active bubble nucleation sites per m2 of any wetted surface (glass wall, crystal faces) at 1 atm of tension excess.
/// Gas pockets in surface cavities of radius r_c are activated once the excess pressure passes 2 sigma / r_c; for the
/// power-law cavity size distribution of an ordinary surface the number of active sites grows as the square of the
/// excess (Wilt 1986; ~ 100 sites per cm2 of the etched and scratched glass of a used laboratory flask at 1 atm excess).
pub const SITES_PER_M2_AT_1_ATM_EXCESS: f64 = 1e6;
/// Crowding limit: bubbles in a foam touch, each needs about its own departure diameter squared.
const CROWDING_AREA_FACTOR: f64 = 1.0;
/// Contact angle (degrees) of a gas bubble on wet glass and crystal faces (hydrophilic surfaces: small bubbles), for the
/// Fritz departure diameter.
pub const BUBBLE_CONTACT_ANGLE_DEG: f64 = 15.0;

/// Fritz (1935) departure diameter of a bubble (m) from a wall: d = 0.0208 theta sqrt(sigma / (g (rho_l - rho_g))),
/// theta in degrees.
pub fn fritz_departure_diameter_m(sigma_n_m: f64, rho_l: f64, rho_g: f64) -> f64 {
    0.0208 * BUBBLE_CONTACT_ANGLE_DEG * (sigma_n_m / (super::hydro::G_ACCEL * (rho_l - rho_g).max(1.0))).sqrt()
}

/// Liquid-side mass-transfer coefficient (m/s) of a rising bubble of diameter `d_b` (Ranz-Marshall with the bubble's
/// terminal rise velocity).
pub fn bubble_mass_transfer_m_s(d_b: f64, diffusivity: f64, rho_l: f64, eta: f64) -> f64 {
    let rise = terminal_velocity(d_b, 1.2, rho_l, eta).abs();
    let nu = eta / rho_l;
    let re = rise * d_b / nu;
    let sc = nu / diffusivity.max(1e-14);
    sherwood_ranz_marshall(re, sc) * diffusivity / d_b.max(1e-5)
}

/// Interfacial area of the growing bubbles per unit area of nucleating surface (dimensionless) at a tension `tension_over_ambient` times the ambient
/// pressure `p_ambient_pa`: the active sites (power law in the excess pressure, capped by crowding) each carry a bubble of
/// the departure diameter; the mean interfacial area of a bubble growing from nothing to diameter d is pi d^2 / 3.
pub fn bubble_coverage(tension_over_ambient: f64, p_ambient_pa: f64, d_b: f64) -> f64 {
    let excess_atm = ((tension_over_ambient - 1.0) * p_ambient_pa / 101_325.0).max(0.0);
    let sites = (SITES_PER_M2_AT_1_ATM_EXCESS * excess_atm * excess_atm).min(1.0 / (CROWDING_AREA_FACTOR * d_b * d_b));
    sites * std::f64::consts::PI * d_b * d_b / 3.0
}

/// First-order rate (1/s) at which a supersaturated dissolved gas leaves the liquid as bubbles, zero when the tension
/// does not exceed the ambient pressure.
///
/// The nucleation sites of the wetted wall and of the solid particles give lambda_nuc = k_b theta A / V. A bubble that has
/// left a site keeps growing on its way up through the supersaturated liquid, and the bubbles in the column are
/// themselves nucleation sites: the feedback gain of a column of depth H is
/// chi = 6 k_b L (zeta - 1) H / (u_b d_b)  (L the Ostwald coefficient of the gas, zeta the tension over the ambient
/// pressure, u_b the rise velocity). For chi < 1 the column amplifies the rate by 1 / (1 - chi); for chi >= 1 the
/// effervescence sustains itself and the gas leaves in about one rise time H / u_b (a freshly mixed fizzy drink or a
/// baking soda and vinegar foam), the supersaturation being the only thing that decides it.
pub fn bubble_release_rate_per_s(
    tension_over_ambient: f64,
    p_ambient_pa: f64,
    wall_area_m2: f64,
    solid_area_m2: f64,
    liquid_m3: f64,
    liquid_depth_m: f64,
    ostwald: f64,
    diffusivity: f64,
    rho_l: f64,
    eta: f64,
    sigma_n_m: f64,
) -> f64 {
    if tension_over_ambient <= 1.0 || liquid_m3 <= 0.0 {
        return 0.0;
    }
    let d_b = fritz_departure_diameter_m(sigma_n_m, rho_l, 1.2);
    let k_b = bubble_mass_transfer_m_s(d_b, diffusivity, rho_l, eta);
    let lambda_nuc = bubble_coverage(tension_over_ambient, p_ambient_pa, d_b) * k_b * (wall_area_m2 + solid_area_m2) / liquid_m3;
    let u_b = terminal_velocity(d_b, 1.2, rho_l, eta).abs().max(1e-3);
    let h = liquid_depth_m.max(1e-3);
    let chi = 6.0 * k_b * ostwald.max(0.0) * (tension_over_ambient - 1.0) * h / (u_b * d_b);
    let amplified = lambda_nuc / (1.0 - chi.min(0.95));
    let sustained = if chi > 1.0 { u_b / h * (1.0 - 1.0 / chi) } else { 0.0 };
    amplified.max(sustained)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transfer::hydro::{gas_liquid_kl, Stirring};

    #[test]
    fn open_layer_relaxes_in_hours_at_rest_and_minutes_stirred() {
        let d = 1.9e-9;
        let nu = 1.0e-6;
        let h = 0.025;
        let tau_rest = h / gas_liquid_kl(d, nu, 0.0, h);
        assert!(tau_rest > 3600.0, "resting tau = {} s", tau_rest);
        let st = Stirring::new(500.0, 3.0);
        let eps = crate::transfer::hydro::dissipation_w_kg(&st, 1000.0, nu, 2e-4);
        let tau_stirred = h / gas_liquid_kl(d, nu, eps, h);
        assert!(tau_stirred > 30.0 && tau_stirred < 900.0, "stirred tau = {} s", tau_stirred);
    }

    #[test]
    fn crystals_and_a_larger_excess_make_a_supersaturated_liquid_fizz_faster() {
        let p = 101_325.0;
        let rate = |z: f64, solid: f64| bubble_release_rate_per_s(z, p, 4e-3, solid, 2e-5, 0.02, 0.83, 1.9e-9, 1000.0, 1e-3, 0.072);
        let clean = rate(2.0, 0.0);
        let with_crystals = rate(2.0, 0.1);
        assert!(with_crystals > 10.0 * clean, "{} vs {}", with_crystals, clean);
        assert!(clean > rate(1.2, 0.0));
        assert_eq!(rate(0.9, 0.1), 0.0);
        // a strongly supersaturated liquid (15 atm of CO2: baking soda in vinegar) degasses in about a rise time
        assert!(1.0 / rate(15.0, 0.0) < 3.0, "tau = {} s", 1.0 / rate(15.0, 0.0));
        // a freshly mixed fizzy drink (3 atm of CO2 over a crystal-covered glass) degasses in seconds
        assert!(1.0 / with_crystals < 30.0, "tau = {} s", 1.0 / with_crystals);
    }
}
