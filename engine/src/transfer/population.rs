//! Particle population of one solid species, tracked by its moments, and the kinetic exchange law between the
//! population and the solution.
//!
//! The population is monodisperse in each moment set (mu0..mu3 of a single mean size); that is enough to give the area
//! and mean size at every instant, which is all dissolution, growth, settling, turbidity and the visual bed need
//! (master plan Stage 8 item 1). Replaces `initial_solids` / `remaining_fraction` and the stored `kind` /
//! `default_particle_um` (F47).
//!
//! * mu0: number of particles (#)
//! * mu1: sum of diameters (m)
//! * mu2: sum of squared diameters (m^2); surface area A = pi mu2
//! * mu3: sum of cubed diameters (m^3); volume V = (pi / 6) mu3

use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Grain size (m) of a reagent-grade crystalline powder from a shelf bottle when nothing else is known about the
/// sample: the geometric middle of the 50-500 um range that sieved laboratory salts span. A user (or an imported
/// record carrying a particle size) overrides it per dose.
pub const DEFAULT_GRAIN_M: f64 = 150e-6;

/// Smallest particle the model resolves (m): a few lattice spacings.
pub const MIN_PARTICLE_M: f64 = 2e-9;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct ParticlePopulation {
    pub mu0: f64,
    pub mu1: f64,
    pub mu2: f64,
    pub mu3: f64,
}

impl ParticlePopulation {
    /// A monodisperse population from the solid's mass (g), density (g/mL) and diameter (m).
    pub fn from_mass_and_diameter(mass_g: f64, density_g_ml: f64, diameter_m: f64) -> Self {
        let d = diameter_m.max(MIN_PARTICLE_M);
        let total_vol_m3 = mass_g.max(0.0) * 1e-3 / (density_g_ml.max(0.05) * 1000.0);
        let v_single = (PI / 6.0) * d.powi(3);
        if total_vol_m3 <= 1e-30 {
            return Self::default();
        }
        Self::from_count_and_diameter(total_vol_m3 / v_single, d)
    }

    /// `n` particles of diameter `d` (m).
    pub fn from_count_and_diameter(n: f64, d: f64) -> Self {
        let d = d.max(MIN_PARTICLE_M);
        Self { mu0: n, mu1: n * d, mu2: n * d * d, mu3: n * d * d * d }
    }

    pub fn is_empty(&self) -> bool {
        self.mu0 <= 0.0 || self.mu3 <= 0.0
    }

    pub fn surface_area_m2(&self) -> f64 {
        if self.mu2 <= 0.0 { 0.0 } else { PI * self.mu2 }
    }

    pub fn volume_m3(&self) -> f64 {
        if self.mu3 <= 0.0 { 0.0 } else { PI / 6.0 * self.mu3 }
    }

    /// Volume-equivalent mean diameter (m).
    pub fn mean_diameter_m(&self) -> f64 {
        if self.mu0 > 0.0 && self.mu3 > 0.0 {
            (self.mu3 / self.mu0).cbrt().max(MIN_PARTICLE_M)
        } else {
            DEFAULT_GRAIN_M
        }
    }

    /// Sauter mean diameter (m): the diameter of the sphere with the population's volume to surface ratio.
    pub fn sauter_diameter_m(&self) -> f64 {
        if self.mu2 > 0.0 && self.mu3 > 0.0 { (self.mu3 / self.mu2).max(MIN_PARTICLE_M) } else { self.mean_diameter_m() }
    }

    /// Rescales the population to a new solid volume (m3). Growth is uniform (every particle keeps its place in the
    /// distribution, the count is kept). A population that loses volume by dissolving loses it from the *surface*: every
    /// particle's diameter falls by the same amount (a rate set by the film or the surface step, not by the size), so the
    /// smallest particles vanish first, the count falls and the distribution narrows towards its large end
    /// (`dissolve_to_volume`). A population whose volume reaches zero is emptied.
    pub fn scale_to_volume(&mut self, new_volume_m3: f64) {
        let v0 = self.volume_m3();
        if new_volume_m3 <= 1e-30 || v0 <= 1e-30 || self.mu0 <= 0.0 {
            if new_volume_m3 <= 1e-30 {
                *self = Self::default();
            }
            return;
        }
        if new_volume_m3 < v0 * (1.0 - 1e-9) {
            self.dissolve_to_volume(new_volume_m3);
            return;
        }
        let k = (new_volume_m3 / v0).cbrt();
        self.mu1 *= k;
        self.mu2 *= k * k;
        self.mu3 *= k * k * k;
    }

    /// Dissolution to a smaller volume: all diameters shrink by one common amount `delta` (particles smaller than `delta`
    /// disappear). The distribution is the log-normal closure of the moments (`psd.rs`), integrated on a fixed grid; the
    /// new moments are the old ones scaled by the integrals of the shrunk distribution, so the volume is met exactly and a
    /// monodisperse population keeps its count and shrinks uniformly (shrinking core).
    fn dissolve_to_volume(&mut self, new_volume_m3: f64) {
        let ln = super::psd::LogNormal::from_population(self);
        let s = ln.sigma_g.max(1.0).ln();
        let r = (new_volume_m3 / self.volume_m3()).clamp(0.0, 1.0);
        if s < 1e-6 {
            // one size: the shrinking core
            let k = r.cbrt();
            self.mu1 *= k;
            self.mu2 *= k * k;
            self.mu3 *= k * k * k;
            return;
        }
        // grid in z = ln(d / d_g) / s: weights are the normal density times the cell width
        const N: usize = 240;
        let (z0, z1) = (-5.5f64, 5.5f64);
        let dz = (z1 - z0) / N as f64;
        let mut d = [0.0f64; N];
        let mut w = [0.0f64; N];
        let mut wsum = 0.0;
        for i in 0..N {
            let z = z0 + (i as f64 + 0.5) * dz;
            d[i] = ln.d_g_m * (s * z).exp();
            w[i] = (-0.5 * z * z).exp();
            wsum += w[i];
        }
        for x in w.iter_mut() {
            *x /= wsum;
        }
        let moment = |delta: f64, k: i32| -> f64 { (0..N).filter(|&i| d[i] > delta).map(|i| w[i] * (d[i] - delta).powi(k)).sum() };
        let v_ref = moment(0.0, 3);
        if v_ref <= 0.0 {
            return;
        }
        // bisection on the shrink: the remaining volume fraction falls monotonically from 1 (delta = 0) to 0 (delta = d_max)
        let (mut lo, mut hi) = (0.0f64, d[N - 1]);
        for _ in 0..80 {
            let mid = 0.5 * (lo + hi);
            if moment(mid, 3) / v_ref > r {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        let delta = 0.5 * (lo + hi);
        let (m0, m1, m2) = (moment(delta, 0) / moment(0.0, 0), moment(delta, 1) / moment(0.0, 1), moment(delta, 2) / moment(0.0, 2));
        self.mu0 *= m0;
        self.mu1 *= m1;
        self.mu2 *= m2;
        self.mu3 *= r;
        if self.mu0 < 1e-12 || self.mu3 < 1e-30 {
            *self = Self::default();
        }
    }

    /// Adds fresh particles of one size.
    pub fn add(&mut self, n: f64, d: f64) {
        if n <= 0.0 {
            return;
        }
        let f = Self::from_count_and_diameter(n, d);
        self.mu0 += f.mu0;
        self.mu1 += f.mu1;
        self.mu2 += f.mu2;
        self.mu3 += f.mu3;
    }

    /// Adds a mass of solid as particles of diameter `d`.
    pub fn add_mass(&mut self, mass_g: f64, density_g_ml: f64, d: f64) {
        let f = Self::from_mass_and_diameter(mass_g, density_g_ml, d);
        self.mu0 += f.mu0;
        self.mu1 += f.mu1;
        self.mu2 += f.mu2;
        self.mu3 += f.mu3;
    }

    /// Merges a portion of another population (a drawn-off sample): `fraction` of every moment.
    pub fn take_fraction(&mut self, fraction: f64) -> ParticlePopulation {
        let f = fraction.clamp(0.0, 1.0);
        let out = ParticlePopulation { mu0: self.mu0 * f, mu1: self.mu1 * f, mu2: self.mu2 * f, mu3: self.mu3 * f };
        self.mu0 *= 1.0 - f;
        self.mu1 *= 1.0 - f;
        self.mu2 *= 1.0 - f;
        self.mu3 *= 1.0 - f;
        out
    }
}

/// Surface-integration (attachment) rate coefficient of a crystal face, m/s, as an upper bound for fast ionic
/// crystals; in series with the film transfer coefficient. Sparingly soluble salts integrate slower in reality, so the
/// growth it gives is an upper bound (tier: speculative).
pub const SURFACE_INTEGRATION_M_S: f64 = 1e-3;

/// Effective transfer coefficient of the film and the surface step in series (m/s).
pub fn effective_transfer_coefficient(k_film: f64) -> f64 {
    1.0 / (1.0 / k_film.max(1e-30) + 1.0 / SURFACE_INTEGRATION_M_S)
}

/// First-order relaxation fraction of a solid-liquid exchange over `dt_s`: of the equilibrium amount still to be
/// transferred, the fraction that moves in `dt_s` when the solution relaxes toward saturation through the surface
/// `area_m2` with film coefficient `k_m_s` into a liquid volume `liquid_m3`.
///
/// With the driving force linear in the transferred amount (dn/dt = k A / V (n_eq - n)) the exact solution is
/// 1 - exp(-k A dt / V); it is stable at any dt and never overshoots the equilibrium (the semi-implicit relaxation of
/// the master plan, Stage 8 item 2).
pub fn relaxation_fraction(k_m_s: f64, area_m2: f64, liquid_m3: f64, dt_s: f64) -> f64 {
    if area_m2 <= 0.0 || liquid_m3 <= 0.0 || dt_s <= 0.0 {
        return 0.0;
    }
    1.0 - (-(k_m_s * area_m2 / liquid_m3) * dt_s).exp()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monodisperse_moments() {
        let pop = ParticlePopulation::from_mass_and_diameter(1.0, 2.16, 300e-6);
        assert!((pop.mean_diameter_m() - 300e-6).abs() < 1e-9);
        assert!((pop.volume_m3() * 1e6 - 1.0 / 2.16).abs() < 1e-6);
        assert!((pop.sauter_diameter_m() - 300e-6).abs() < 1e-9);
    }

    #[test]
    fn shrinking_core_keeps_count() {
        let mut pop = ParticlePopulation::from_mass_and_diameter(1.0, 2.0, 200e-6);
        let n = pop.mu0;
        let v = pop.volume_m3();
        pop.scale_to_volume(v / 8.0);
        assert!((pop.mu0 - n).abs() < 1e-9 * n);
        assert!((pop.mean_diameter_m() - 100e-6).abs() < 1e-9);
    }

    #[test]
    fn dissolution_removes_the_fines_first() {
        // a spread population: half of the particles are small
        let mut pop = ParticlePopulation::from_count_and_diameter(1.0e6, 20e-6);
        pop.add(1.0e6, 200e-6);
        let (n0, v0, d0) = (pop.mu0, pop.volume_m3(), pop.mean_diameter_m());
        // dissolve 40 % of the volume: the 20 um particles lose their size (their volume is 0.1 % of the big ones)
        pop.scale_to_volume(0.6 * v0);
        assert!((pop.volume_m3() / (0.6 * v0) - 1.0).abs() < 1e-9, "volume is met exactly");
        // (the log-normal closure smooths a two-size mixture, so the fall is gentler than the two-size picture's 50 %)
        assert!(pop.mu0 < 0.9 * n0, "the count falls as the fines vanish: {} of {}", pop.mu0, n0);
        assert!(pop.mean_diameter_m() > 0.0 && pop.mean_diameter_m() < d0 * 1.0001 + 1e-12);
        // the moments stay those of a real set of particles (Cauchy-Schwarz)
        assert!(pop.mu1 * pop.mu1 <= pop.mu0 * pop.mu2 * (1.0 + 1e-9));
        assert!(pop.mu2 * pop.mu2 <= pop.mu1 * pop.mu3 * (1.0 + 1e-9));
    }

    #[test]
    fn growth_keeps_the_count_and_one_size_shrinks_as_a_core() {
        let mut pop = ParticlePopulation::from_count_and_diameter(1.0e6, 20e-6);
        pop.add(1.0e6, 200e-6);
        let (n0, v0) = (pop.mu0, pop.volume_m3());
        pop.scale_to_volume(1.5 * v0);
        assert!((pop.mu0 - n0).abs() < 1e-9 * n0, "growth is uniform");
        let mut mono = ParticlePopulation::from_count_and_diameter(1.0e6, 100e-6);
        mono.scale_to_volume(0.125 * mono.volume_m3());
        assert!((mono.mu0 - 1.0e6).abs() < 1.0 && (mono.mean_diameter_m() - 50e-6).abs() < 1e-9);
    }

    #[test]
    fn relaxation_is_bounded() {
        assert_eq!(relaxation_fraction(1e-5, 0.0, 1e-4, 1.0), 0.0);
        let f = relaxation_fraction(1e-5, 1e3, 1e-4, 100.0);
        assert!(f > 0.999 && f <= 1.0);
    }
}
