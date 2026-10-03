//! Turbidity: wavelength-resolved extinction and scattering of a suspension of solid spheres.
//!
//! Each equal-mass size class of each suspended solid is evaluated with Mie theory (the Bohren-Huffman BHMIE recurrences) for
//! the complex relative index `m = (n_solid + i k) / n_medium` at every wavelength bin, where `k = alpha lambda / 4 pi` comes
//! from the solid's own absorption (a black precipitate is absorbing, a white one is not). Large particles (size parameter
//! above `X_ASYMPTOTIC`) use the geometric-optics limit `Q_ext = 2`. The result per bin is the extinction coefficient and the
//! single-scattering albedo: fine particles scatter blue more than red (Rayleigh `lambda^-4`), coarse ones are grey, absorbing
//! ones darken. Contributions are summed over solids in a fixed order (the caller sorts), never in hash order.

use super::cie::{bin_nm, Spectrum, N_BINS};

const X_ASYMPTOTIC: f64 = 150.0;

#[derive(Clone, Copy, Debug)]
struct C {
    re: f64,
    im: f64,
}

impl C {
    fn new(re: f64, im: f64) -> Self {
        C { re, im }
    }
    fn add(self, o: C) -> C {
        C::new(self.re + o.re, self.im + o.im)
    }
    fn sub(self, o: C) -> C {
        C::new(self.re - o.re, self.im - o.im)
    }
    fn mul(self, o: C) -> C {
        C::new(self.re * o.re - self.im * o.im, self.re * o.im + self.im * o.re)
    }
    fn scale(self, s: f64) -> C {
        C::new(self.re * s, self.im * s)
    }
    fn div(self, o: C) -> C {
        let d = o.re * o.re + o.im * o.im;
        C::new((self.re * o.re + self.im * o.im) / d, (self.im * o.re - self.re * o.im) / d)
    }
    fn norm(self) -> f64 {
        (self.re * self.re + self.im * self.im).sqrt()
    }
}

/// Extinction and scattering efficiencies of a sphere of size parameter `x` and complex relative index `m = n + i k`.
pub fn mie_efficiencies(x: f64, n: f64, k: f64) -> (f64, f64) {
    if x < 1e-6 {
        return (0.0, 0.0);
    }
    if x > X_ASYMPTOTIC {
        // geometric limit: extinction paradox 2; a large absorbing sphere absorbs what enters (1 - e^{-4kx}) and reflects
        let q_abs = 1.0 - (-4.0 * k * x).exp();
        let q_abs = q_abs.clamp(0.0, 1.0);
        return (2.0, (2.0 - q_abs).max(0.0));
    }
    let m = C::new(n, k);
    let y = m.scale(x);
    let nstop = (x + 4.0 * x.cbrt() + 2.0).floor() as usize;
    let nmx = (nstop.max(y.norm().ceil() as usize)) + 15;
    // downward recurrence of the logarithmic derivative D_n(y)
    let mut d = vec![C::new(0.0, 0.0); nmx + 1];
    for nn in (1..=nmx).rev() {
        let a = C::new(nn as f64, 0.0).div(y);
        d[nn - 1] = a.sub(C::new(1.0, 0.0).div(d[nn].add(a)));
    }
    let (mut psi0, mut psi1) = (x.cos(), x.sin());
    let (mut chi0, mut chi1) = (-x.sin(), x.cos());
    let mut xi1 = C::new(psi1, -chi1);
    let (mut q_sca, mut q_ext) = (0.0, 0.0);
    for nn in 1..=nstop {
        let fn_ = nn as f64;
        let psi = (2.0 * fn_ - 1.0) * psi1 / x - psi0;
        let chi = (2.0 * fn_ - 1.0) * chi1 / x - chi0;
        let xi = C::new(psi, -chi);
        let dn = d[nn];
        let an = {
            let num = dn.div(m).add(C::new(fn_ / x, 0.0)).scale(psi).sub(C::new(psi1, 0.0));
            let den = dn.div(m).add(C::new(fn_ / x, 0.0)).mul(xi).sub(xi1);
            num.div(den)
        };
        let bn = {
            let num = dn.mul(m).add(C::new(fn_ / x, 0.0)).scale(psi).sub(C::new(psi1, 0.0));
            let den = dn.mul(m).add(C::new(fn_ / x, 0.0)).mul(xi).sub(xi1);
            num.div(den)
        };
        q_sca += (2.0 * fn_ + 1.0) * (an.re * an.re + an.im * an.im + bn.re * bn.re + bn.im * bn.im);
        q_ext += (2.0 * fn_ + 1.0) * (an.re + bn.re);
        psi0 = psi1;
        psi1 = psi;
        chi0 = chi1;
        chi1 = chi;
        xi1 = C::new(psi1, -chi1);
    }
    let f = 2.0 / (x * x);
    (f * q_ext, f * q_sca)
}

/// One suspended population: a size class of one solid.
#[derive(Clone, Copy, Debug)]
pub struct Class {
    /// Mass concentration of the class in the liquid, g/mL.
    pub mass_conc_g_ml: f64,
    pub diameter_um: f64,
    pub density_g_ml: f64,
}

/// The material of the particles: real index (n_D) and absorption coefficient per bin (cm-1).
pub struct Material<'a> {
    pub n: f64,
    pub alpha_per_cm: &'a Spectrum,
}

/// Extinction (1/cm) and scattering (1/cm) per bin of the classes of one solid in a medium of index `n_medium`.
pub fn suspension_spectra(classes: &[Class], mat: &Material, n_medium: f64) -> (Spectrum, Spectrum) {
    let mut ext = [0.0; N_BINS];
    let mut sca = [0.0; N_BINS];
    let n_med = n_medium.max(1.0);
    for c in classes {
        if c.mass_conc_g_ml <= 1e-12 || c.diameter_um <= 1e-3 || c.density_g_ml <= 1e-3 {
            continue;
        }
        let d_cm = c.diameter_um * 1e-4;
        let r_cm = 0.5 * d_cm;
        let m_particle_g = (4.0 / 3.0) * std::f64::consts::PI * r_cm.powi(3) * c.density_g_ml;
        let n_per_ml = c.mass_conc_g_ml / m_particle_g;
        let area = std::f64::consts::PI * r_cm * r_cm;
        for i in 0..N_BINS {
            let lambda_med_cm = bin_nm(i) * 1e-7 / n_med;
            let x = std::f64::consts::PI * d_cm / lambda_med_cm;
            let k = mat.alpha_per_cm[i] * (bin_nm(i) * 1e-7) / (4.0 * std::f64::consts::PI);
            let (q_e, q_s) = mie_efficiencies(x, mat.n / n_med, k / n_med);
            ext[i] += n_per_ml * area * q_e;
            sca[i] += n_per_ml * area * q_s;
        }
    }
    (ext, sca)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rayleigh_limit_and_wavelength_dependence() {
        // x = 0.1, m = 1.5: Q_sca = (8/3) x^4 |(m^2-1)/(m^2+2)|^2
        let (qe, qs) = mie_efficiencies(0.1, 1.5, 0.0);
        let rayleigh = 8.0 / 3.0 * 0.1f64.powi(4) * ((1.5f64 * 1.5 - 1.0) / (1.5f64 * 1.5 + 2.0)).powi(2);
        assert!((qs - rayleigh).abs() / rayleigh < 0.02, "Qsca {qs} vs {rayleigh}");
        assert!((qe - qs).abs() < 1e-3 * qs, "no absorption: ext = sca");
    }

    #[test]
    fn large_water_droplet_has_extinction_near_two() {
        let (qe, _) = mie_efficiencies(60.0, 1.333, 0.0);
        assert!((qe - 2.0).abs() < 0.25, "{qe}");
    }

    #[test]
    fn fine_particles_scatter_blue_more_than_red() {
        let alpha = [0.0; N_BINS];
        let classes = [Class { mass_conc_g_ml: 1e-4, diameter_um: 0.06, density_g_ml: 2.0 }];
        let (ext, _) = suspension_spectra(&classes, &Material { n: 1.6, alpha_per_cm: &alpha }, 1.333);
        assert!(ext[0] > 4.0 * ext[N_BINS - 1], "{} vs {}", ext[0], ext[N_BINS - 1]);
    }

    #[test]
    fn absorbing_particles_scatter_less_than_they_extinguish() {
        let mut alpha = [0.0; N_BINS];
        alpha.iter_mut().for_each(|a| *a = 5e4);
        let classes = [Class { mass_conc_g_ml: 1e-4, diameter_um: 2.0, density_g_ml: 5.0 }];
        let (ext, sca) = suspension_spectra(&classes, &Material { n: 2.5, alpha_per_cm: &alpha }, 1.333);
        assert!(sca[20] < 0.8 * ext[20] && ext[20] > 0.0);
    }
}
