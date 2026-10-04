//! Nucleation and growth of precipitates: classical nucleation theory with the Mersmann interfacial energy, coupled to
//! diffusion / integration-limited growth of the nuclei (master plan Stage 8 item 3).
//!
//! The inputs are a salt's intrinsic data only: its solubility product (hence the saturation concentration), molar mass
//! and density, plus the solution's supersaturation. Induction time, the width of the metastable zone, the particle
//! count and therefore the mean particle size (and the visual "curds vs crystals") all follow; nothing is stored per
//! compound.
//!
//! * gamma (J/m2) = 0.414 k T (rho N_A / M)^(2/3) ln(c_solid / c_sat)      (Mersmann 1990)
//! * dG*/kT       = 16 pi gamma^3 v^2 / (3 (kT)^3 (nu ln S)^2)             (CNT, nu ions per formula unit)
//! * J            = J0 exp(-f(theta) dG*/kT)                               (heterogeneous nucleation on the dust
//!                                                                           and glass every real bench vessel has)
//!
//! `NUCLEATION_PREFACTOR` and `WETTING_ANGLE_DEG` are two compound-independent constants of the vessel (the number of
//! foreign nucleation sites per unit volume times the attachment frequency, and the effective contact angle of a nucleus
//! on them); the supersaturation scale of the metastable zone is a derived quantity.

use super::population::{effective_transfer_coefficient, ParticlePopulation, MIN_PARTICLE_M};
use crate::transport::{K_BOLTZMANN, N_AVOGADRO};
use std::f64::consts::PI;

/// J0 of heterogeneous nucleation, m^-3 s^-1: ~1e11 dust / glass sites per m3 x ~1e3 nucleation sites each x an
/// attachment frequency of ~1e10 s^-1 (diffusion-limited capture of an ion at a critical-nucleus surface).
pub const NUCLEATION_PREFACTOR: f64 = 1e24;
/// Effective contact angle of a nucleus on a foreign surface (degrees); a typical value of aqueous inorganic salts on
/// glass and dust (Mullin, Crystallization 4th ed. section 5.2); with J0 it sets where the metastable limit of the
/// solution lies (S ~ 10 for BaSO4, the width Nielsen measured).
pub const WETTING_ANGLE_DEG: f64 = 73.0;

/// The intrinsic description of a salt that nucleation needs.
#[derive(Clone, Copy, Debug)]
pub struct SaltProps {
    pub density_kg_m3: f64,
    pub molar_mass_kg_mol: f64,
    /// Number of ions per formula unit (2 for BaSO4, 3 for CaCl2, ...).
    pub nu_total: f64,
    /// Saturation concentration expressed per formula unit, mol/m3: (Ksp / prod nu_i^nu_i)^(1/nu_total) x 1000.
    pub c_sat_fu_mol_m3: f64,
    /// Measured solid-water interfacial energy (J/m2) of this solid when the mineral record carries one; it replaces
    /// the Mersmann estimate. `None` for every compound without a citable value.
    pub gamma_override_j_m2: Option<f64>,
}

impl SaltProps {
    /// Volume of one formula unit in the crystal, m3.
    pub fn molecular_volume_m3(&self) -> f64 {
        self.molar_mass_kg_mol / (self.density_kg_m3 * N_AVOGADRO)
    }

    /// Molar volume of the solid, m3/mol.
    pub fn molar_volume_m3(&self) -> f64 {
        self.molar_mass_kg_mol / self.density_kg_m3
    }
}

/// Solid-liquid interfacial energy gamma (J/m2): the measured value of the mineral record when there is one, else the
/// Mersmann (1990) correlation (which needs only density, molar mass and solubility).
pub fn mersmann_interfacial_energy(t_k: f64, salt: &SaltProps) -> f64 {
    if let Some(g) = salt.gamma_override_j_m2.filter(|g| g.is_finite() && *g > 0.0) {
        return g;
    }
    let c_solid = salt.density_kg_m3 / salt.molar_mass_kg_mol; // mol/m3
    let ratio = (c_solid / salt.c_sat_fu_mol_m3.max(1e-15)).max(1.01);
    let n_density = (c_solid * N_AVOGADRO).powf(2.0 / 3.0);
    0.414 * K_BOLTZMANN * t_k.max(100.0) * n_density * ratio.ln()
}

/// f(theta) of heterogeneous nucleation on a flat foreign surface: dG_het / dG_hom.
pub fn wetting_factor(theta_deg: f64) -> f64 {
    let c = theta_deg.to_radians().cos();
    ((2.0 + c) * (1.0 - c).powi(2) / 4.0).clamp(0.0, 1.0)
}

/// CNT barrier of homogeneous nucleation divided by kT at supersaturation S (= (IAP/Ksp)^(1/nu)).
pub fn barrier_over_kt(t_k: f64, salt: &SaltProps, s_ratio: f64) -> f64 {
    let gamma = mersmann_interfacial_energy(t_k, salt);
    let v = salt.molecular_volume_m3();
    let kt = K_BOLTZMANN * t_k.max(100.0);
    let ln_s = s_ratio.max(1.0 + 1e-12).ln();
    let nu = salt.nu_total.max(1.0);
    16.0 * PI * gamma.powi(3) * v * v / (3.0 * kt.powi(3) * (nu * ln_s).powi(2))
}

/// Nucleation rate J (nuclei per m3 per second) at supersaturation S.
pub fn nucleation_rate(t_k: f64, salt: &SaltProps, s_ratio: f64) -> f64 {
    if s_ratio <= 1.0 {
        return 0.0;
    }
    let dg = wetting_factor(WETTING_ANGLE_DEG) * barrier_over_kt(t_k, salt, s_ratio);
    if dg > 700.0 {
        0.0
    } else {
        NUCLEATION_PREFACTOR * (-dg).exp()
    }
}

/// Critical nucleus diameter (m) from the Gibbs-Thomson relation d* = 4 gamma v / (nu k T ln S).
pub fn critical_diameter_m(t_k: f64, salt: &SaltProps, s_ratio: f64) -> f64 {
    let gamma = mersmann_interfacial_energy(t_k, salt);
    let kt = K_BOLTZMANN * t_k.max(100.0);
    let ln_s = s_ratio.max(1.0 + 1e-9).ln();
    (4.0 * gamma * salt.molecular_volume_m3() / (salt.nu_total.max(1.0) * kt * ln_s)).clamp(MIN_PARTICLE_M, 1e-5)
}

/// Induction time (s) of a solution of volume `vol_m3` held at constant supersaturation S: the time for the first
/// nucleus to appear, 1 / (J V). Infinite inside the metastable zone.
pub fn induction_time_s(t_k: f64, salt: &SaltProps, s_ratio: f64, vol_m3: f64) -> f64 {
    let j = nucleation_rate(t_k, salt, s_ratio);
    if j <= 0.0 {
        f64::INFINITY
    } else {
        1.0 / (j * vol_m3.max(1e-12))
    }
}

/// Everything a precipitation step needs.
///
/// The thermodynamic target is not recomputed here: the equilibrium solver (which knows every speciation and activity
/// effect, e.g. that sulfide is mostly HS- and that the free S-2 that nucleates is a trace) supplies `p_eq_mol`, the formula
/// units that would precipitate at equilibrium, and `ln_s0`, the supersaturation of the free ions now. As the
/// precipitated amount x grows toward p_eq the supersaturation falls to 1 along ln S = ln S0 (1 - x / p_eq), and the
/// driving force of growth is the remaining amount, (p_eq - x) / V.
pub struct PrecipInput<'a> {
    pub t_k: f64,
    pub vol_m3: f64,
    pub dt_s: f64,
    pub salt: SaltProps,
    pub ln_s0: f64,
    pub p_eq_mol: f64,
    pub pop: ParticlePopulation,
    /// Expected number of nuclei accumulated while no particle exists yet (the induction clock).
    pub nuc_clock: f64,
    /// Film coefficient (m/s) of a particle of diameter d: the stirring and fluid properties live with the caller.
    pub film_coefficient: &'a dyn Fn(f64) -> f64,
}

#[derive(Clone, Debug)]
pub struct PrecipResult {
    /// Formula units that left the solution as solid in this step.
    pub dn_fu_mol: f64,
    pub pop: ParticlePopulation,
    pub nuc_clock: f64,
    /// Highest supersaturation seen in the step.
    pub s_peak: f64,
}

/// Advances the precipitation of one salt over `dt_s`: nucleation at the current supersaturation, growth of the
/// existing particles (and of the new nuclei), consumption of the supersaturation. Sub-stepped adaptively, so it is
/// stable at any `dt_s` including the stiff burst of a highly supersaturated solution.
pub fn precipitate(inp: PrecipInput) -> PrecipResult {
    let vm = inp.salt.molar_volume_m3();
    let v_fu = inp.salt.molecular_volume_m3();
    let mut pop = inp.pop.clone();
    let mut clock = inp.nuc_clock;
    let mut x = 0.0; // formula units precipitated, mol
    let mut t = 0.0;
    let mut s_peak: f64 = 1.0;
    let p_eq = inp.p_eq_mol;
    if !(inp.ln_s0 > 1e-9) || !(p_eq > 0.0) {
        return PrecipResult { dn_fu_mol: 0.0, pop, nuc_clock: 0.0, s_peak };
    }
    let ln_s_at = |x: f64| -> f64 { inp.ln_s0 * (1.0 - x / p_eq).max(0.0) };

    for _ in 0..400 {
        if t >= inp.dt_s {
            break;
        }
        let ln_s = ln_s_at(x);
        if !(ln_s > 1e-9) {
            break;
        }
        let s = ln_s.exp();
        s_peak = s_peak.max(s);
        let j = nucleation_rate(inp.t_k, &inp.salt, s);
        let excess_mol = p_eq - x;
        let dc = excess_mol / inp.vol_m3; // mol/m3, the driving force of growth (the pool the film delivers)
        let d_crit = critical_diameter_m(inp.t_k, &inp.salt, s);
        let mol_per_nucleus = PI / 6.0 * d_crit.powi(3) / v_fu / N_AVOGADRO;

        let have_particles = pop.mu0 >= 1.0 && !pop.is_empty();
        let k = if have_particles { effective_transfer_coefficient((inp.film_coefficient)(pop.sauter_diameter_m())) } else { 0.0 };
        let growth_rate = if have_particles { k * pop.surface_area_m2() * dc } else { 0.0 }; // mol/s
        let nuc_rate = j * inp.vol_m3; // nuclei/s
        let consume = growth_rate + nuc_rate * mol_per_nucleus;

        let mut dt_sub = inp.dt_s - t;
        if consume > 0.0 {
            dt_sub = dt_sub.min(0.1 * excess_mol / consume);
        }
        if !have_particles && nuc_rate > 0.0 {
            // the first nucleus is due when the induction clock reaches one
            dt_sub = dt_sub.min(((1.0 - clock).max(0.0) / nuc_rate).max(1e-12));
        }
        // (not `clamp`: the time left in the step can be below the 1e-12 s floor, and clamp panics when min > max)
        dt_sub = dt_sub.max(1e-12).min(inp.dt_s - t);

        if consume <= 0.0 && nuc_rate <= 0.0 {
            break; // metastable: nothing happens at this supersaturation
        }

        // trial step, halved until the supersaturation changes moderately
        let mut committed = false;
        for _ in 0..40 {
            let d_nuclei = nuc_rate * dt_sub;
            let dn_growth = growth_rate * dt_sub;
            let forms_now = have_particles || clock + d_nuclei >= 1.0;
            let dn_nuc = if forms_now { (if have_particles { d_nuclei } else { clock + d_nuclei }) * mol_per_nucleus } else { 0.0 };
            let dn = (dn_growth + dn_nuc).min(0.999 * excess_mol);
            let ln_s_new = ln_s_at(x + dn);
            let moderate = (ln_s - ln_s_new).abs() <= 0.25 * ln_s + 1e-12 || dn >= 0.99 * excess_mol;
            if moderate || dt_sub <= 1e-12 {
                let growth_applied = dn_growth.min(dn);
                if have_particles {
                    { let v_new = pop.volume_m3() + growth_applied * vm; super::psd::change_to_volume(&mut pop, v_new); }
                    pop.add(d_nuclei, d_crit);
                } else if forms_now {
                    pop = ParticlePopulation::from_count_and_diameter(clock + d_nuclei, d_crit);
                    clock = 0.0;
                } else {
                    clock += d_nuclei;
                }
                x += dn;
                t += dt_sub;
                committed = true;
                break;
            }
            dt_sub *= 0.5;
        }
        if !committed {
            break;
        }
    }
    PrecipResult { dn_fu_mol: x, pop, nuc_clock: clock, s_peak }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn baso4() -> SaltProps {
        // intrinsic data only: M, rho, and the saturation concentration of Ksp = 1.08e-10 (c_sat = sqrt(Ksp))
        SaltProps { density_kg_m3: 4500.0, molar_mass_kg_mol: 0.23339, nu_total: 2.0, c_sat_fu_mol_m3: 1.04e-5 * 1000.0, gamma_override_j_m2: None }
    }

    #[test]
    fn mersmann_gamma_of_a_sparingly_soluble_salt() {
        let g = mersmann_interfacial_energy(298.15, &baso4());
        assert!(g > 0.08 && g < 0.2, "gamma(BaSO4) = {} J/m2 (literature 0.1-0.13)", g);
    }

    #[test]
    fn induction_time_falls_steeply_with_supersaturation() {
        let s = baso4();
        let v = 5e-5;
        let t10 = induction_time_s(298.15, &s, 10.0, v);
        let t30 = induction_time_s(298.15, &s, 30.0, v);
        let t100 = induction_time_s(298.15, &s, 100.0, v);
        assert!(t10 > t30 && t30 > t100, "{} {} {}", t10, t30, t100);
        assert!(induction_time_s(298.15, &s, 1.0, v).is_infinite());
    }

    #[test]
    fn ln_t_is_linear_in_inverse_ln_s_squared() {
        // CNT: ln(1/(J V)) = const + f dG*/kT with dG*/kT proportional to 1/ln^2(S)
        let s = baso4();
        let v = 5e-5;
        let y = |sr: f64| induction_time_s(298.15, &s, sr, v).ln();
        let x = |sr: f64| 1.0 / sr.ln().powi(2);
        let slope1 = (y(12.0) - y(15.0)) / (x(12.0) - x(15.0));
        let slope2 = (y(15.0) - y(20.0)) / (x(15.0) - x(20.0));
        assert!((slope1 / slope2 - 1.0).abs() < 1e-6);
    }
}
