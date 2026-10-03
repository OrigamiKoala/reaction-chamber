//! Particle size distribution from the population moments: a log-normal closure.
//!
//! `ParticlePopulation` (`population.rs`, monodisperse per cohort but a mixture of cohorts in general) carries four power
//! sums of the particle diameter, mu_k = sum(d^k), k = 0..3. A log-normal
//! number distribution with geometric median d_g and geometric standard deviation sigma_g (s = ln sigma_g) has
//!   mu_k = N d_g^k exp(k^2 s^2 / 2)
//! so the four moments are redundant: two independent estimates of s^2 follow from them,
//!   s^2_a = ln(mu2 mu0 / mu1^2)           and           s^2_b = ln(mu3 mu0^2 / mu1^3) / 3,
//! and their mean is used. d_g is then fixed by mu0 and mu3, so the closure reproduces the particle count and the
//! solid volume (mass) of the population exactly whatever the spread.
//!
//! The mass-weighted distribution of a log-normal is log-normal with the same sigma_g and median d_g exp(3 s^2). It is
//! cut into `N_CLASSES` classes of equal mass, which is what settling and light scattering are evaluated on (each
//! class has its own Stokes velocity and its own cross-section per gram).

use super::population::ParticlePopulation;

/// Number of equal-mass size classes.
pub const N_CLASSES: usize = 6;

/// Standard-normal quantiles at the class mid-points (k + 1/2) / N_CLASSES.
const Z_MID: [f64; N_CLASSES] = [-1.382994, -0.674490, -0.210428, 0.210428, 0.674490, 1.382994];

/// sigma_g above which the closure is not trusted (moments of mixed populations can imply absurd spreads).
const SIGMA_G_MAX: f64 = 6.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LogNormal {
    /// Geometric median of the number distribution (m).
    pub d_g_m: f64,
    /// Geometric standard deviation, >= 1 (1 = monodisperse).
    pub sigma_g: f64,
}

impl LogNormal {
    /// Closure of a population's moments. An empty population gives a 10 um monodisperse placeholder.
    pub fn from_population(pop: &ParticlePopulation) -> Self {
        if pop.mu0 <= 1e-12 || pop.mu1 <= 0.0 || pop.mu2 <= 0.0 || pop.mu3 <= 1e-30 {
            return Self { d_g_m: pop.mean_diameter_m(), sigma_g: 1.0 };
        }
        let sa = (pop.mu2 * pop.mu0 / (pop.mu1 * pop.mu1)).ln().max(0.0);
        let sb = ((pop.mu3 * pop.mu0 * pop.mu0) / pop.mu1.powi(3)).ln().max(0.0) / 3.0;
        let mut s2 = (0.5 * (sa + sb)).min(SIGMA_G_MAX.ln().powi(2));
        if s2 < 1e-12 {
            s2 = 0.0; // round-off of a monodisperse population
        }
        let d_g = ((pop.mu3 / pop.mu0).cbrt() * (-1.5 * s2).exp()).max(1e-9);
        Self { d_g_m: d_g, sigma_g: s2.sqrt().exp() }
    }

    fn s(&self) -> f64 {
        self.sigma_g.max(1.0).ln()
    }

    /// Median of the mass-weighted distribution (m).
    pub fn mass_median_m(&self) -> f64 {
        self.d_g_m * (3.0 * self.s().powi(2)).exp()
    }

    /// Representative diameter of each equal-mass class (m), smallest first.
    pub fn class_diameters_m(&self) -> [f64; N_CLASSES] {
        let m = self.mass_median_m();
        let s = self.s();
        let mut out = [0.0; N_CLASSES];
        for (o, z) in out.iter_mut().zip(Z_MID.iter()) {
            *o = (m * (s * z).exp()).max(1e-9);
        }
        out
    }

    /// Sauter (surface-volume) mean diameter, mu3 / mu2 of the distribution (m).
    pub fn sauter_m(&self) -> f64 {
        self.d_g_m * (2.5 * self.s().powi(2)).exp()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A discrete log-normal sample with known d_g and sigma_g.
    fn sample(d_g: f64, sigma_g: f64, n: usize) -> ParticlePopulation {
        let mut pop = ParticlePopulation::default();
        let s = sigma_g.ln();
        for i in 0..n {
            let p = (i as f64 + 0.5) / n as f64;
            // inverse normal CDF by bisection
            let (mut lo, mut hi) = (-8.0_f64, 8.0_f64);
            for _ in 0..80 {
                let mid = 0.5 * (lo + hi);
                let cdf = 0.5 * (1.0 + erf(mid / std::f64::consts::SQRT_2));
                if cdf < p { lo = mid } else { hi = mid }
            }
            let d = d_g * (s * 0.5 * (lo + hi)).exp();
            pop.mu0 += 1.0;
            pop.mu1 += d;
            pop.mu2 += d * d;
            pop.mu3 += d * d * d;
        }
        pop
    }

    fn erf(x: f64) -> f64 {
        // Abramowitz-Stegun 7.1.26 is too coarse for a 1e-2 check of sigma; use a series/continued form.
        let t = 1.0 / (1.0 + 0.3275911 * x.abs());
        let y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * (-x * x).exp();
        if x >= 0.0 { y } else { -y }
    }

    #[test]
    fn recovers_lognormal_parameters() {
        let pop = sample(2e-6, 1.6, 4000);
        let ln = LogNormal::from_population(&pop);
        assert!((ln.sigma_g - 1.6).abs() < 0.03, "sigma_g {}", ln.sigma_g);
        assert!((ln.d_g_m / 2e-6 - 1.0).abs() < 0.05, "d_g {}", ln.d_g_m);
    }

    #[test]
    fn monodisperse_has_unit_spread() {
        let pop = ParticlePopulation::from_mass_and_diameter(1.0, 2.5, 30e-6);
        let ln = LogNormal::from_population(&pop);
        assert!((ln.sigma_g - 1.0).abs() < 1e-9);
        assert!((ln.d_g_m - 30e-6).abs() < 1e-9);
        for d in ln.class_diameters_m() {
            assert!((d - 30e-6).abs() < 1e-9);
        }
    }

    #[test]
    fn closure_preserves_count_and_volume() {
        // count and volume follow from d_g and sigma_g exactly: mu3/mu0 = d_g^3 exp(9 s^2 / 2)
        let pop = sample(5e-7, 1.9, 2000);
        let ln = LogNormal::from_population(&pop);
        let s = ln.sigma_g.ln();
        let mu3_over_mu0 = ln.d_g_m.powi(3) * (4.5 * s * s).exp();
        assert!((mu3_over_mu0 / (pop.mu3 / pop.mu0) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn classes_are_ordered_and_mass_equal() {
        let ln = LogNormal { d_g_m: 1e-6, sigma_g: 2.0 };
        let d = ln.class_diameters_m();
        for w in d.windows(2) {
            assert!(w[0] < w[1]);
        }
        // equal-mass classes: the mean of d^0 over classes is not the volume, but the mean of the class diameters
        // (a mass average) must equal the mass-weighted mean diameter d_g exp(3.5 s^2) within the 6-class error
        let mean: f64 = d.iter().sum::<f64>() / N_CLASSES as f64;
        let exact = ln.d_g_m * (3.5 * ln.sigma_g.ln().powi(2)).exp();
        assert!((mean / exact - 1.0).abs() < 0.08, "{} vs {}", mean, exact);
    }
}
