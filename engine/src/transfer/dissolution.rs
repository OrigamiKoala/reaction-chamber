//! Particle population balance and dissolution/growth kinetics.
//!
//! Models solid particle distributions using population moments mu0-mu3:
//! - mu0: total particle number (#)
//! - mu1: total particle length (m)
//! - mu2: total particle surface parameter (m^2), Area = pi * mu2
//! - mu3: total particle volume parameter (m^3), Volume = (pi / 6) * mu3
//!
//! Dissolution rate dn/dt = k_L * A * (c_sat - c) follows Sherwood correlations
//! where Sh = 2 + 0.6 * Re^(1/2) * Sc^(1/3) scales with `stir_rpm`.

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Characteristic particle population moments.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ParticlePopulation {
    /// Total particle count (#)
    pub mu0: f64,
    /// Total length moment (m)
    pub mu1: f64,
    /// Surface moment (m^2), where A = pi * mu2
    pub mu2: f64,
    /// Volume moment (m^3), where V = (pi / 6) * mu3
    pub mu3: f64,
}

impl Default for ParticlePopulation {
    fn default() -> Self {
        Self {
            mu0: 0.0,
            mu1: 0.0,
            mu2: 0.0,
            mu3: 0.0,
        }
    }
}

impl ParticlePopulation {
    /// Creates a monodisperse population from total mass (g), solid density (g/mL), and diameter (m).
    pub fn from_mass_and_diameter(mass_g: f64, density_g_ml: f64, diameter_m: f64) -> Self {
        let d = diameter_m.max(1e-9);
        let rho_kg_m3 = (density_g_ml.max(0.05)) * 1000.0;
        let mass_kg = mass_g.max(0.0) * 1e-3;
        let total_vol_m3 = mass_kg / rho_kg_m3;
        let v_single = (PI / 6.0) * d.powi(3);

        if total_vol_m3 <= 1e-30 || v_single <= 1e-30 {
            return Self::default();
        }

        let n_particles = total_vol_m3 / v_single;
        Self {
            mu0: n_particles,
            mu1: n_particles * d,
            mu2: n_particles * d.powi(2),
            mu3: n_particles * d.powi(3),
        }
    }

    /// Total surface area in m^2.
    pub fn surface_area_m2(&self) -> f64 {
        if self.mu2 <= 0.0 {
            0.0
        } else {
            PI * self.mu2
        }
    }

    /// Total solid volume in m^3.
    pub fn volume_m3(&self) -> f64 {
        if self.mu3 <= 0.0 {
            0.0
        } else {
            (PI / 6.0) * self.mu3
        }
    }

    /// Number-average mean diameter in meters.
    pub fn mean_diameter_m(&self) -> f64 {
        if self.mu0 > 1e-12 && self.mu3 > 1e-30 {
            (self.mu3 / self.mu0).cbrt().max(1e-9)
        } else if self.mu0 > 1e-12 {
            (self.mu1 / self.mu0).max(1e-9)
        } else {
            1e-5
        }
    }

    /// Sauter mean diameter d_32 (m) = mu3 / mu2.
    pub fn sauter_diameter_m(&self) -> f64 {
        if self.mu2 > 1e-20 {
            (self.mu3 / self.mu2).max(1e-9)
        } else {
            self.mean_diameter_m()
        }
    }

    /// Updates the population to reflect a change in solid mass (e.g. from dissolution or growth).
    pub fn scale_to_mass(&mut self, new_mass_g: f64, density_g_ml: f64) {
        if new_mass_g <= 1e-12 {
            *self = Self::default();
            return;
        }

        let rho_kg_m3 = (density_g_ml.max(0.05)) * 1000.0;
        let target_vol_m3 = (new_mass_g * 1e-3) / rho_kg_m3;
        let current_vol_m3 = self.volume_m3();

        if current_vol_m3 <= 1e-30 || self.mu0 <= 1e-12 {
            // Re-initialize from standard powder diameter 50 um
            *self = Self::from_mass_and_diameter(new_mass_g, density_g_ml, 50e-6);
            return;
        }

        // Particle volume ratio
        let ratio = (target_vol_m3 / current_vol_m3).max(0.0);
        let linear_ratio = ratio.cbrt();

        // Under shrinking-core / uniform growth, particle count is conserved until complete disappearance
        self.mu1 *= linear_ratio;
        self.mu2 *= linear_ratio.powi(2);
        self.mu3 = target_vol_m3 / (PI / 6.0);
    }

    /// Adds fresh solid to the population.
    pub fn add_solid(&mut self, added_mass_g: f64, density_g_ml: f64, diameter_m: f64) {
        if added_mass_g <= 1e-12 {
            return;
        }
        let fresh = Self::from_mass_and_diameter(added_mass_g, density_g_ml, diameter_m);
        self.mu0 += fresh.mu0;
        self.mu1 += fresh.mu1;
        self.mu2 += fresh.mu2;
        self.mu3 += fresh.mu3;
    }
}

/// Computes the Sherwood number for mass transfer from suspended or settled particles.
///
/// For stagnant/unstirred particles resting in a beaker, diffusion through the boundary layer
/// gives Sh = 2.0 (the theoretical minimum for a sphere in a quiescent fluid).
/// For stirred particles, fluid shear and slip velocity increase Sh via the Ranz-Marshall correlation:
/// Sh = 2.0 + 0.6 * Re_p^(1/2) * Sc^(1/3).
pub fn sherwood_number(
    diameter_m: f64,
    diffusivity_m2_s: f64,
    kinematic_viscosity_m2_s: f64,
    stir_rpm: f64,
) -> f64 {
    let dp = diameter_m.max(1e-8);
    let nu = kinematic_viscosity_m2_s.max(1e-7);
    let d = diffusivity_m2_s.max(1e-12);

    let sc = (nu / d).clamp(1.0, 1e6);

    if stir_rpm <= 0.0 {
        // Quiescent fluid, particle resting on beaker floor
        2.0
    } else {
        // Stirred vessel: slip velocity estimated from turbulent dissipation or impeller speed
        let n_rev_s = (stir_rpm / 60.0).clamp(0.0, 50.0);
        let d_impeller = 0.025; // 2.5 cm magnetic stirrer bar
        let u_tip = PI * d_impeller * n_rev_s;
        // Relative slip velocity for suspended particles in stirred vessel (Kolmogoroff eddy scale, Levins & Glastonbury 1972)
        let u_slip = (0.015 * u_tip).max(1e-4);
        let re_p = (u_slip * dp / nu).clamp(1e-4, 1e4);

        2.0 + 0.6 * re_p.sqrt() * sc.cbrt()
    }
}

/// Liquid-side mass transfer coefficient k_L (m/s).
pub fn mass_transfer_coefficient(
    diameter_m: f64,
    diffusivity_m2_s: f64,
    kinematic_viscosity_m2_s: f64,
    stir_rpm: f64,
) -> f64 {
    let dp = diameter_m.max(1e-8);
    let sh = sherwood_number(dp, diffusivity_m2_s, kinematic_viscosity_m2_s, stir_rpm);
    sh * diffusivity_m2_s / dp
}

/// Computes the net dissolution flux dn/dt (mol/s) toward the saturation concentration.
///
/// - If c_bulk < c_sat (undersaturated, S < 1): dn/dt > 0 (solid dissolves).
/// - If c_bulk >= c_sat (saturated or supersaturated, S >= 1): dn/dt = 0 (no dissolution).
pub fn dissolution_flux_mol_s(
    k_l_m_s: f64,
    area_m2: f64,
    c_sat_mol_m3: f64,
    c_bulk_mol_m3: f64,
) -> f64 {
    if c_bulk_mol_m3 >= c_sat_mol_m3 || area_m2 <= 1e-14 {
        0.0
    } else {
        let driving_force = c_sat_mol_m3 - c_bulk_mol_m3;
        // Bed packing and boundary-layer shadowing factor ~ 0.15 for granular bed / slurry
        let effective_area = area_m2 * 0.15;
        k_l_m_s * effective_area * driving_force
    }
}

/// Result of a single particle population dissolution time step.
#[derive(Clone, Debug, PartialEq)]
pub struct DissolutionStepResult {
    pub moles_dissolved: f64,
    pub new_mass_g: f64,
    pub fully_depleted: bool,
}

/// Steps the dissolution of a particle population over time `dt_s`.
pub fn step_particle_dissolution(
    pop: &mut ParticlePopulation,
    solid_mol: f64,
    mw: f64,
    density_g_ml: f64,
    diffusivity_m2_s: f64,
    kinematic_viscosity_m2_s: f64,
    stir_rpm: f64,
    c_sat_mol_m3: f64,
    c_bulk_mol_m3: f64,
    dt_s: f64,
) -> DissolutionStepResult {
    let dp = pop.mean_diameter_m();
    let area = pop.surface_area_m2();
    let kl = mass_transfer_coefficient(dp, diffusivity_m2_s, kinematic_viscosity_m2_s, stir_rpm);
    let flux = dissolution_flux_mol_s(kl, area, c_sat_mol_m3, c_bulk_mol_m3);
    let mut dm = flux * dt_s;
    if dm > solid_mol {
        dm = solid_mol;
    }
    let new_mol = (solid_mol - dm).max(0.0);
    let new_mass_g = new_mol * mw;
    pop.scale_to_mass(new_mass_g, density_g_ml);
    DissolutionStepResult {
        moles_dissolved: dm,
        new_mass_g,
        fully_depleted: new_mol <= 1e-12,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_particle_population_moments() {
        // 1 g NaCl (density 2.16 g/mL, 300 um diameter)
        let pop = ParticlePopulation::from_mass_and_diameter(1.0, 2.16, 300e-6);
        assert!(pop.mu0 > 1000.0);
        let d_mean = pop.mean_diameter_m();
        assert!((d_mean - 300e-6).abs() < 1e-6);
        let vol_ml = pop.volume_m3() * 1e6;
        assert!((vol_ml - 1.0 / 2.16).abs() < 1e-4);
    }

    #[test]
    fn test_sherwood_stirring_enhancement() {
        let d = 300e-6;
        let diff = 1.5e-9;
        let nu = 1.0e-6;

        let sh_still = sherwood_number(d, diff, nu, 0.0);
        assert!((sh_still - 2.0).abs() < 1e-6);

        let sh_stirred = sherwood_number(d, diff, nu, 400.0);
        assert!(sh_stirred > 3.0 * sh_still, "sh_stirred = {}, sh_still = {}", sh_stirred, sh_still);
    }
}
