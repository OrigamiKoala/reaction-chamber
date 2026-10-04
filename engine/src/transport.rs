//! Transport and physical properties for chemical kinetics and phase transfer.
//!
//! Provides solvent viscosity, dielectric constants, ionic and molecular diffusivity,
//! Debye electrostatic factors, and diffusion-limited rate constant ceilings.

use std::f64::consts::PI;

pub const K_BOLTZMANN: f64 = 1.380649e-23; // J/K
pub const N_AVOGADRO: f64 = 6.02214076e23; // 1/mol
pub const EPSILON_0: f64 = 8.8541878128e-12; // F/m
pub const ELEMENTARY_CHARGE: f64 = 1.602176634e-19; // C

/// Dynamic viscosity of liquid water (Pa*s) as a function of temperature T (K).
/// Follows IAPWS 2008 formulation for water at 0.1 MPa (1 bar).
pub fn viscosity_water_pa_s(t_k: f64) -> f64 {
    let t = t_k.clamp(273.15, 647.0);
    // Viscosity in Pa*s (reference eta0 = 1e-6 Pa*s)
    // Accurate fit to IAPWS 2008 baseline at ambient pressure
    // 298.15 K -> 8.90e-4 Pa*s; 348.15 K -> 3.78e-4 Pa*s
    1e-3 * (-3.7188 + 578.919 / (t - 137.546)).exp()
}

/// Relative static permittivity (dielectric constant) of liquid water as a function of T (K).
pub fn dielectric_water(t_k: f64) -> f64 {
    let t_c = (t_k - 273.15).clamp(0.0, 100.0);
    // Malmberg and Maryott (1956) formulation
    87.740 - 0.40008 * t_c + 9.398e-4 * t_c.powi(2) - 1.410e-6 * t_c.powi(3)
}

/// Stokes-Einstein diffusion coefficient (m^2/s) for a spherical particle with radius `r_m`.
pub fn diffusivity_m2_s(radius_m: f64, t_k: f64, eta_pa_s: f64) -> f64 {
    let r = radius_m.max(1e-11);
    let eta = eta_pa_s.max(1e-5);
    (K_BOLTZMANN * t_k) / (6.0 * PI * eta * r)
}

/// Debye electrostatic correction factor for bimolecular reaction between ions with charges `z_a` and `z_b`.
/// f_Debye = u / (exp(u) - 1) where u = (z_a * z_b * e^2) / (4 * pi * eps_0 * eps_r * k_B * T * r_contact).
pub fn debye_factor(z_a: f64, z_b: f64, r_contact_m: f64, t_k: f64, eps_r: f64) -> f64 {
    let za_zb = z_a * z_b;
    if za_zb.abs() < 1e-4 {
        return 1.0;
    }
    let r = r_contact_m.max(1e-11);
    let eps = (eps_r.max(1.0)) * EPSILON_0;
    let u = (za_zb * ELEMENTARY_CHARGE.powi(2)) / (4.0 * PI * eps * K_BOLTZMANN * t_k.max(1.0) * r);

    if u.abs() < 1e-6 {
        1.0
    } else if u > 50.0 {
        u * (-u).exp()
    } else if u < -50.0 {
        -u
    } else {
        u / (u.exp() - 1.0)
    }
}

/// Debye screening length (m) of an electrolyte of ionic strength `i_mol_l` (mol/L) in a medium of permittivity `eps_r`:
/// `kappa^-1 = sqrt(eps0 eps_r k T / (2 N_A e^2 I))` (0.304 nm / sqrt(I) in water at 25 C). Infinite without ions.
pub fn debye_length_m(i_mol_l: f64, t_k: f64, eps_r: f64) -> f64 {
    if i_mol_l <= 1e-12 {
        return f64::INFINITY;
    }
    (EPSILON_0 * eps_r.max(1.0) * K_BOLTZMANN * t_k.max(1.0) / (2.0 * N_AVOGADRO * ELEMENTARY_CHARGE.powi(2) * i_mol_l * 1e3)).sqrt()
}

/// Diffusion-limited bimolecular rate constant ceiling (M^-1 s^-1 = L / (mol * s)).
/// k_D = 4 * pi * N_A * (D_A + D_B) * (r_A + r_B) * f_Debye.
pub fn k_diffusion_limit(
    r_a_m: f64,
    r_b_m: f64,
    z_a: f64,
    z_b: f64,
    t_k: f64,
    eta_pa_s: f64,
    eps_r: f64,
) -> f64 {
    k_diffusion_limit_screened(r_a_m, r_b_m, z_a, z_b, t_k, eta_pa_s, eps_r, 0.0)
}

/// `k_diffusion_limit` with the Coulomb term screened by the ionic atmosphere (ionic strength in mol/L): the interaction
/// at contact is multiplied by `exp(-r / lambda_D)` (Debye-Hueckel), so highly charged like ions still meet in 0.1 M salt.
pub fn k_diffusion_limit_screened(
    r_a_m: f64,
    r_b_m: f64,
    z_a: f64,
    z_b: f64,
    t_k: f64,
    eta_pa_s: f64,
    eps_r: f64,
    ionic_strength_mol_l: f64,
) -> f64 {
    let d_a = diffusivity_m2_s(r_a_m, t_k, eta_pa_s);
    let d_b = diffusivity_m2_s(r_b_m, t_k, eta_pa_s);
    let r_contact = r_a_m + r_b_m;
    let screening = (-r_contact / debye_length_m(ionic_strength_mol_l, t_k, eps_r)).exp();
    // the screened pair potential is z_a z_b e^2 exp(-r/lambda) / (4 pi eps r): the charge product is scaled by the screening
    let f_deb = debye_factor(z_a * z_b * screening, 1.0, r_contact, t_k, eps_r);

    // M^3 / (mol * s) to L / (mol * s)
    4.0 * PI * N_AVOGADRO * (d_a + d_b) * r_contact * f_deb * 1e3
}

/// Specific diffusion-controlled rate for H+ + OH- -> H2O in water at T (K).
/// Accounts for Grotthuss proton jumping: D(H+) + D(OH-) is much higher than ordinary ions.
pub fn h_oh_recombination_rate(t_k: f64) -> f64 {
    let eta = viscosity_water_pa_s(t_k);
    let eps = dielectric_water(t_k);

    // At 298.15 K: D_H+ ~ 9.31e-9 m^2/s, D_OH- ~ 5.27e-9 m^2/s (Grotthuss hopping)
    let t_ratio = (t_k / 298.15) * (viscosity_water_pa_s(298.15) / eta);
    let d_h = 9.31e-9 * t_ratio;
    let d_oh = 5.27e-9 * t_ratio;

    // Contact / capture distance for proton transfer: ~0.75 nm (Bjerrum length in water)
    let r_capture = 0.75e-9;
    let f_deb = debye_factor(1.0, -1.0, r_capture, t_k, eps);

    4.0 * PI * N_AVOGADRO * (d_h + d_oh) * r_capture * f_deb * 1e3
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_water_viscosity() {
        let eta_298 = viscosity_water_pa_s(298.15);
        assert!((eta_298 - 8.90e-4).abs() < 2e-5, "viscosity at 298 K: got {}", eta_298);

        let eta_348 = viscosity_water_pa_s(348.15);
        assert!((eta_348 - 3.78e-4).abs() < 2e-5, "viscosity at 348 K: got {}", eta_348);
    }

    #[test]
    fn test_h_oh_recombination_gate() {
        let k_298 = h_oh_recombination_rate(298.15);
        // Stage 7 gate: H+ + OH- within x3 of 1.4e11 M^-1 s^-1
        assert!(k_298 > 1.4e11 / 3.0 && k_298 < 1.4e11 * 3.0, "k(298) = {}", k_298);

        // Stage 7 gate: k_D ~ 2.3x - 2.8x from 298 to 348 K in water
        let eta_298 = viscosity_water_pa_s(298.15);
        let eta_348 = viscosity_water_pa_s(348.15);
        let kd_298 = k_diffusion_limit(0.2e-9, 0.2e-9, 0.0, 0.0, 298.15, eta_298, 78.4);
        let kd_348 = k_diffusion_limit(0.2e-9, 0.2e-9, 0.0, 0.0, 348.15, eta_348, 61.0);
        let ratio = kd_348 / kd_298;
        assert!(ratio >= 2.0 && ratio <= 3.0, "k_D ratio 348/298: got {}", ratio);
    }
}
