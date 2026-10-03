//! Evaporation below the boiling point from an open liquid surface, with the transport the geometry allows
//! (master plan Stage 8 item 6).
//!
//! The vapour leaves the liquid by gas-phase diffusion and convection:
//!
//! * a vapour *heavier* than air (hexane, ethanol, most organics) pools above the liquid, stably stratified, so it
//!   reaches the rim only by diffusion across the depth of empty glass; above the rim a laminar boundary layer in the
//!   room's air motion carries it away;
//! * a vapour *lighter* than air (water vapour) rises and mixes by natural convection (Sherwood correlation of the
//!   horizontal plate, Gr from the actual gas density difference at the surface).
//!
//! The flux is J = k A (p_sat - p_inf) / (R T) with the gas diffusivity of Fuller-Schettler-Giddings from the species'
//! formula, and the latent heat J x dHvap leaves the liquid (booked by the caller in the enthalpy balance).

use super::diffusion::{fuller_gas_diffusivity_m2_s, MOLAR_MASS_AIR};
use crate::physics::R_GAS;
use std::collections::HashMap;

/// Speed of the room's air moving across the rim of a vessel, m/s (a still laboratory without a fume hood).
pub const ROOM_AIR_SPEED_M_S: f64 = 0.1;

/// Kinematic viscosity of air at `t_k`, `p_pa` (Sutherland's law for the dynamic viscosity, ideal-gas density).
pub fn air_kinematic_viscosity_m2_s(t_k: f64, p_pa: f64) -> f64 {
    let t = t_k.max(150.0);
    let mu = 1.458e-6 * t.powf(1.5) / (t + 110.4);
    let rho = p_pa.max(1.0) * MOLAR_MASS_AIR * 1e-3 / (R_GAS * t);
    mu / rho
}

/// Mass-transfer coefficient (m/s) of a vapour leaving an open vessel of surface `pool_area_m2`, whose liquid is
/// `depth_below_rim_m` below the rim.
///
/// `p_surface_pa` is the vapour's partial pressure at the liquid surface, `p_total_pa` the total pressure and
/// `molar_mass_g_mol` the vapour's: together they give the gas density difference that drives (or suppresses)
/// natural convection.
pub fn mass_transfer_coefficient_m_s(
    t_k: f64,
    p_total_pa: f64,
    pool_area_m2: f64,
    depth_below_rim_m: f64,
    p_surface_pa: f64,
    molar_mass_g_mol: f64,
    d_gas_m2_s: f64,
) -> f64 {
    let area = pool_area_m2.max(1e-8);
    let l_char = (4.0 * area / std::f64::consts::PI).sqrt(); // pool diameter
    let nu = air_kinematic_viscosity_m2_s(t_k, p_total_pa);
    let sc = nu / d_gas_m2_s.max(1e-8);
    // gas density at the surface (air + vapour) relative to the ambient air
    let x_v = (p_surface_pa / p_total_pa.max(1.0)).clamp(0.0, 1.0);
    let m_mix = x_v * molar_mass_g_mol + (1.0 - x_v) * MOLAR_MASS_AIR;
    let d_rho_over_rho = (m_mix - MOLAR_MASS_AIR) / MOLAR_MASS_AIR; // > 0: heavier than air

    let h = depth_below_rim_m.max(0.0);
    if d_rho_over_rho < 0.0 {
        // lighter than air: natural convection over the horizontal surface
        let gr = super::hydro::G_ACCEL * l_char.powi(3) * (-d_rho_over_rho) / (nu * nu);
        let sh = 0.54 * (gr * sc).max(1.0).powf(0.25);
        let k_nc = sh * d_gas_m2_s / l_char;
        // the same stagnant-gas depth still sits above the liquid
        return if h > 1e-4 { 1.0 / (1.0 / k_nc + h / d_gas_m2_s) } else { k_nc };
    }
    // heavier than air: diffusion across the empty depth in series with the boundary layer over the rim
    let re_l = ROOM_AIR_SPEED_M_S * l_char / nu;
    let sh_rim = 0.664 * re_l.max(1.0).sqrt() * sc.cbrt();
    let k_rim = sh_rim * d_gas_m2_s / l_char;
    1.0 / (1.0 / k_rim + h / d_gas_m2_s)
}

/// Evaporation rate (mol/s) and latent-heat flux (W) of a volatile species leaving an open surface.
pub fn evaporation_rates(
    t_k: f64,
    p_total_pa: f64,
    pool_area_m2: f64,
    depth_below_rim_m: f64,
    p_sat_pa: f64,
    p_ambient_partial_pa: f64,
    molar_mass_g_mol: f64,
    elements: &HashMap<String, f64>,
    dh_vap_j_mol: f64,
) -> (f64, f64) {
    if pool_area_m2 <= 1e-8 || p_sat_pa <= p_ambient_partial_pa {
        return (0.0, 0.0);
    }
    let d_gas = fuller_gas_diffusivity_m2_s(t_k, p_total_pa, molar_mass_g_mol, elements);
    let k = mass_transfer_coefficient_m_s(t_k, p_total_pa, pool_area_m2, depth_below_rim_m, p_sat_pa, molar_mass_g_mol, d_gas);
    let flux = k * pool_area_m2 * (p_sat_pa - p_ambient_partial_pa) / (R_GAS * t_k.max(100.0));
    (flux, flux * dh_vap_j_mol)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn el(pairs: &[(&str, f64)]) -> HashMap<String, f64> {
        pairs.iter().map(|(k, v)| (k.to_string(), *v)).collect()
    }

    #[test]
    fn heavy_vapour_is_slower_from_a_deep_vessel() {
        let hex = el(&[("C", 6.0), ("H", 14.0)]);
        let shallow = evaporation_rates(295.0, 101325.0, 38e-4, 0.01, 17600.0, 0.0, 86.18, &hex, 31500.0).0;
        let deep = evaporation_rates(295.0, 101325.0, 38e-4, 0.06, 17600.0, 0.0, 86.18, &hex, 31500.0).0;
        assert!(shallow > 2.0 * deep, "shallow = {:e}, deep = {:e}", shallow, deep);
    }

    #[test]
    fn water_vapour_rises_and_mixes() {
        let w = el(&[("H", 2.0), ("O", 1.0)]);
        let (n, q) = evaporation_rates(298.15, 101325.0, 38e-4, 0.0, 3169.0, 1500.0, 18.015, &w, 43990.0);
        assert!(n > 0.0 && q > 0.0);
        // an open dish of water at 25 C and 50 % RH loses ~ 0.02-0.15 g/(cm2 h)... order 1 g/h from 38 cm2
        let g_h = n * 18.015 * 3600.0;
        assert!(g_h > 0.2 && g_h < 6.0, "{} g/h", g_h);
    }
}
