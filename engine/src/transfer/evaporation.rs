//! Sub-boiling evaporation with natural-convection mass transfer and evaporative cooling.
//!
//! Models vapor transport into the atmosphere:
//!   J = k_g * A * (p_sat - p_inf) / (R * T)
//! where gas diffusivity D_gas is derived from Fuller, Schettler & Giddings (1966)
//! and mass transfer coefficient k_g combines natural convection boundary layer
//! with glassware lip stagnant diffusion resistance.
//!
//! Gate verified:
//! - 10 mL hexane from 38 cm^2 at 295 K loses 3 - 20 mL/h

pub const R_GAS: f64 = 8.314462618;

/// Binary gas diffusivity in air (m^2/s) using the Fuller-Schettler-Giddings (1966) method.
pub fn fuller_gas_diffusivity_m2_s(t_k: f64, p_pa: f64, molar_mass_g_mol: f64, diff_volume: Option<f64>) -> f64 {
    let t = t_k.max(100.0);
    let p_bar = (p_pa / 1e5).max(0.01);
    let m_a = 28.97; // air
    let m_b = molar_mass_g_mol.max(2.0);
    let m_ab = 2.0 / (1.0 / m_a + 1.0 / m_b);

    let v_air: f64 = 19.7;
    let v_b: f64 = diff_volume.unwrap_or(m_b * 1.5); // empirical group volume approximation if unlisted

    let denom = p_bar * m_ab.sqrt() * (v_air.cbrt() + v_b.cbrt()).powi(2);
    let d_cm2_s = (0.00143 * t.powf(1.75)) / denom;

    (d_cm2_s * 1e-4).clamp(1e-7, 1e-3)
}

/// Computes the effective gas-phase mass transfer coefficient k_g (m/s)
/// for evaporation from an open liquid surface inside glassware.
///
/// Combines natural-convection boundary layer mass transfer (Churchill-Sherwood)
/// with the stagnant gas diffusion resistance of the vessel lip/headspace in series:
///   1 / k_eff = 1 / k_film + h_lip / D_gas
pub fn natural_convection_evaporation_kg(
    _t_k: f64,
    pool_area_m2: f64,
    liquid_depth_below_rim_m: f64,
    d_gas_m2_s: f64,
    density_vapor_diff_ratio: f64,
) -> f64 {
    let area = pool_area_m2.max(1e-5);
    let l_char = area.sqrt(); // characteristic length
    let d_gas = d_gas_m2_s.max(1e-7);

    // Grashof number for mass transfer: Gr_m = g * L^3 * (Delta rho / rho) / nu^2
    let g = 9.81;
    let nu_air = 1.55e-5; // m^2/s at 295 K
    let delta_rho = density_vapor_diff_ratio.abs().max(0.02);
    let gr_m = (g * l_char.powi(3) * delta_rho) / (nu_air * nu_air);
    let sc = nu_air / d_gas;

    // Natural convection Sherwood correlation over horizontal liquid surface
    let sh = 0.54 * (gr_m * sc).clamp(1.0, 1e8).powf(0.25);
    let k_film = sh * d_gas / l_char;

    // Headspace diffusion resistance across lip depth h_lip
    let h_lip = liquid_depth_below_rim_m.clamp(0.005, 0.10);
    let r_headspace = h_lip / d_gas;
    let r_film = 1.0 / k_film;

    1.0 / (r_film + r_headspace)
}

/// Evaporation molar rate (mol/s) and latent heat flux (Watts) from an open liquid surface.
pub fn sub_boiling_evaporation_rates(
    t_k: f64,
    pool_area_m2: f64,
    liquid_depth_below_rim_m: f64,
    p_sat_pa: f64,
    p_ambient_partial_pa: f64,
    molar_mass_g_mol: f64,
    dh_vap_j_mol: f64,
) -> (f64, f64) {
    if pool_area_m2 <= 1e-6 || p_sat_pa <= p_ambient_partial_pa {
        return (0.0, 0.0);
    }

    let d_gas = fuller_gas_diffusivity_m2_s(t_k, 101325.0, molar_mass_g_mol, None);
    let vapor_rho_ratio = (molar_mass_g_mol - 28.97).abs() / 28.97;
    let kg = natural_convection_evaporation_kg(t_k, pool_area_m2, liquid_depth_below_rim_m, d_gas, vapor_rho_ratio);

    let delta_p = p_sat_pa - p_ambient_partial_pa;
    // J = kg * A * delta_P / (R * T)
    let flux_mol_s = kg * pool_area_m2 * delta_p / (R_GAS * t_k.max(100.0));
    let latent_heat_watts = flux_mol_s * dh_vap_j_mol;

    (flux_mol_s, latent_heat_watts)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hexane_evaporation_gate() {
        // Gate: 10 mL hexane from 38 cm^2 at 295 K loses 3 - 20 mL/h
        let t = 295.0;
        let area = 38.0e-4; // 38 cm^2 = 0.0038 m^2
        let p_sat_hexane_295 = 17500.0; // 17.5 kPa at 22 C
        let p_inf = 0.0; // dry air
        let mw_hexane = 86.18; // g/mol
        let rho_hexane = 0.655; // g/mL
        let dh_vap = 28850.0; // J/mol
        let h_lip = 0.02; // 2 cm lip in a 250 mL beaker

        let (flux_mol_s, _) = sub_boiling_evaporation_rates(
            t,
            area,
            h_lip,
            p_sat_hexane_295,
            p_inf,
            mw_hexane,
            dh_vap,
        );

        let g_s = flux_mol_s * mw_hexane;
        let ml_s = g_s / rho_hexane;
        let ml_h = ml_s * 3600.0;

        assert!(
            ml_h >= 3.0 && ml_h <= 20.0,
            "10 mL hexane evaporation rate must be in [3, 20] mL/h: got {:.2} mL/h",
            ml_h
        );
    }
}
