//! Hydrodynamics of a stirred or resting vessel: what the stirring rate does to mass transfer.
//!
//! Every transfer rate of Stage 8 (dissolution, growth, gas exchange, evaporation, settling, suspension) needs the
//! same few quantities: the energy dissipation rate eps (W/kg) of the stirrer, the speed at which dense particles are
//! just suspended (Zwietering), the slip velocity between a particle and the liquid, and the Sherwood numbers they
//! imply. They are computed here once, from the stirring rate, the stirrer and vessel geometry and the liquid's actual
//! density and viscosity, so that "stirring" is a number (D22), not a boolean.
//!
//! Domains: laminar to turbulent stirring (Re_stirrer 1e1..1e5), particles 1 um..2 mm, Sc 1e2..1e4.

use std::f64::consts::PI;

pub const G_ACCEL: f64 = 9.80665;

/// Power number of a flat paddle / stir bar in the turbulent regime (Re > ~1e4); in the transitional and laminar
/// regime the laminar branch of `power_number` takes over. Generic impeller constant (Rushton 1950, Nagata 1975).
const NP_TURBULENT: f64 = 1.2;
/// Constant of the laminar power-number branch, Np = K_LAM / Re_stirrer.
const NP_LAMINAR_K: f64 = 70.0;
/// Zwietering constant S of the just-suspended-speed correlation for a flat paddle / stir bar in an unbaffled
/// flat-bottomed vessel (Zwietering 1958: S = 2..12 over impeller types, high for impellers far from the floor).
const ZWIETERING_S: f64 = 8.0;

/// Stirrer and vessel geometry derived from the vessel's inner radius and the rate.
#[derive(Clone, Copy, Debug)]
pub struct Stirring {
    pub rpm: f64,
    /// Impeller (bar) length, m. A stir bar is chosen to be about half the vessel diameter.
    pub d_impeller_m: f64,
    pub vessel_diameter_m: f64,
}

impl Stirring {
    pub fn new(rpm: f64, inner_radius_cm: f64) -> Self {
        let vessel_d = 2.0 * inner_radius_cm.max(0.2) * 1e-2;
        Self { rpm: rpm.max(0.0), d_impeller_m: 0.5 * vessel_d, vessel_diameter_m: vessel_d }
    }

    pub fn rps(&self) -> f64 {
        self.rpm / 60.0
    }

    pub fn is_stirred(&self) -> bool {
        self.rpm > 1.0
    }
}

/// Power number Np(Re): laminar (Np = K/Re) merged with the turbulent plateau.
pub fn power_number(re_stirrer: f64) -> f64 {
    let lam = NP_LAMINAR_K / re_stirrer.max(1e-3);
    NP_TURBULENT.max(lam)
}

/// Energy dissipation rate per unit liquid mass, eps (W/kg), of the stirrer in a liquid of density `rho` (kg/m3), kinematic
/// viscosity `nu` (m2/s) and volume `liquid_m3`.
pub fn dissipation_w_kg(st: &Stirring, rho: f64, nu: f64, liquid_m3: f64) -> f64 {
    if !st.is_stirred() || liquid_m3 <= 0.0 {
        return 0.0;
    }
    let n = st.rps();
    let re = n * st.d_impeller_m.powi(2) / nu.max(1e-9);
    let p = power_number(re) * rho * n.powi(3) * st.d_impeller_m.powi(5);
    p / (rho * liquid_m3)
}

/// Surface tension of water (N/m), IAPWS 1994: sigma = 0.2358 (1 - T/Tc)^1.256 (1 - 0.625 (1 - T/Tc)), Tc = 647.096 K.
pub fn water_surface_tension_n_m(t_k: f64) -> f64 {
    let tau = (1.0 - t_k.clamp(250.0, 646.0) / 647.096).max(0.0);
    0.2358 * tau.powf(1.256) * (1.0 - 0.625 * tau)
}

/// Terminal velocity (m/s) of a sphere of diameter `d` (Stokes with the Schiller-Naumann drag correction), positive
/// downward.
pub fn terminal_velocity(d: f64, rho_p: f64, rho_l: f64, eta: f64) -> f64 {
    let d = d.max(1e-9);
    let eta = eta.max(1e-6);
    let v_stokes = G_ACCEL * (rho_p - rho_l) * d * d / (18.0 * eta);
    let re = (rho_l * v_stokes.abs() * d / eta).max(1e-9);
    if re <= 0.2 {
        v_stokes
    } else {
        // iterate v = v_stokes / (1 + 0.15 Re^0.687) with Re = rho v d / eta (fixed point converges in a few passes)
        let mut v = v_stokes.abs();
        for _ in 0..30 {
            let re = rho_l * v * d / eta;
            v = 0.5 * v + 0.5 * v_stokes.abs() / (1.0 + 0.15 * re.powf(0.687));
        }
        v * v_stokes.signum()
    }
}

/// Zwietering just-suspended speed (rev/s) of dense particles of diameter `d` (m), density `rho_p`, solid mass
/// fraction `x_wt_pct` (percent of the liquid mass), in a liquid of density `rho_l`, viscosity `nu`.
/// N_js = S nu^0.1 d^0.2 (g (rho_p - rho_l)/rho_l)^0.45 X^0.13 / D^0.85.
pub fn just_suspended_rps(st: &Stirring, d: f64, rho_p: f64, rho_l: f64, nu: f64, x_wt_pct: f64) -> f64 {
    let drho = (rho_p - rho_l).abs().max(1.0);
    let x = x_wt_pct.clamp(0.01, 50.0);
    ZWIETERING_S * nu.powf(0.1) * d.max(1e-7).powf(0.2) * (G_ACCEL * drho / rho_l).powf(0.45) * x.powf(0.13)
        / st.d_impeller_m.max(1e-3).powf(0.85)
}

/// Fraction of a particle population that the stirring keeps in suspension (the rest lies as a bed on the floor):
/// 0 at rest, 1 at and above the just-suspended speed, (N/N_js)^2 between.
pub fn suspended_fraction(st: &Stirring, n_js_rps: f64) -> f64 {
    if !st.is_stirred() {
        return 0.0;
    }
    (st.rps() / n_js_rps.max(1e-6)).clamp(0.0, 1.0).powi(2)
}

/// Slip velocity (m/s) between a suspended particle and the liquid: the larger of the terminal velocity and the
/// turbulent (inertial-subrange, d >> Kolmogorov scale) eddy velocity (eps d)^(1/3); for particles below the Kolmogorov
/// scale the viscous-subrange velocity (eps nu)^(1/4) (d/eta_K).
pub fn slip_velocity(d: f64, rho_p: f64, rho_l: f64, eta: f64, eps: f64, nu: f64) -> f64 {
    let v_t = terminal_velocity(d, rho_p, rho_l, eta).abs();
    if eps <= 0.0 {
        return v_t;
    }
    let eta_k = (nu.powi(3) / eps).powf(0.25);
    let u_eddy = if d >= eta_k { (eps * d).powf(1.0 / 3.0) } else { (eps * nu).powf(0.25) * d / eta_k };
    v_t.max(u_eddy)
}

/// Ranz-Marshall Sherwood number of a sphere in a flow: Sh = 2 + 0.6 Re^(1/2) Sc^(1/3).
pub fn sherwood_ranz_marshall(re: f64, sc: f64) -> f64 {
    2.0 + 0.6 * re.max(0.0).sqrt() * sc.max(1e-3).cbrt()
}

/// Schmidt number nu / D.
pub fn schmidt(nu: f64, diffusivity: f64) -> f64 {
    nu / diffusivity.max(1e-14)
}

/// Mass-transfer coefficient k_L (m/s) of a dissolving or growing particle: the Ranz-Marshall Sherwood number with the
/// slip velocity the stirring (or, at rest, nothing but diffusion: Sh = 2) gives it. A stir bar sweeps the floor as well,
/// so particles lying on it are in the same flow as suspended ones; the suspended fraction matters for settling and for
/// what the eye sees, not for the film.
pub fn particle_mass_transfer(
    d: f64,
    diffusivity: f64,
    rho_p: f64,
    rho_l: f64,
    eta: f64,
    st: &Stirring,
    eps: f64,
) -> f64 {
    let nu = eta / rho_l;
    let sc = schmidt(nu, diffusivity);
    let sh = if st.is_stirred() {
        let u = slip_velocity(d, rho_p, rho_l, eta, eps, nu);
        sherwood_ranz_marshall(u * d / nu, sc)
    } else {
        2.0
    };
    sh * diffusivity / d.max(1e-9)
}

/// Liquid-side mass-transfer coefficient k_L (m/s) of a dissolved gas across the free surface of a liquid layer of
/// depth `depth_m`.
///
/// Resting liquid: the surface is stably stratified by the escaping gas, so transport is diffusion through the layer;
/// the slowest relaxation mode of a layer of depth H with a fixed-concentration surface and a closed floor has rate
/// pi^2 D / (4 H^2), i.e. k_L = pi^2 D / (4 H).
/// Stirred liquid: small-eddy surface renewal (Lamont-Scott 1970), k_L = 0.4 (eps nu)^(1/4) Sc^(-1/2).
pub fn gas_liquid_kl(diffusivity: f64, nu: f64, eps: f64, depth_m: f64) -> f64 {
    let h = depth_m.max(1e-3);
    let k_diff = PI * PI * diffusivity / (4.0 * h);
    if eps <= 0.0 {
        return k_diff;
    }
    let sc = schmidt(nu, diffusivity);
    let k_eddy = 0.4 * (eps * nu).powf(0.25) / sc.sqrt();
    k_diff.max(k_eddy)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suspended_fraction_rises_with_speed() {
        let slow = Stirring::new(100.0, 2.5);
        let fast = Stirring::new(1500.0, 2.5);
        let n_js = just_suspended_rps(&slow, 300e-6, 2160.0, 1000.0, 1e-6, 2.0);
        assert!(suspended_fraction(&slow, n_js) < suspended_fraction(&fast, n_js));
        assert_eq!(suspended_fraction(&Stirring::new(0.0, 2.5), n_js), 0.0);
        assert!(suspended_fraction(&fast, n_js) <= 1.0);
    }

    #[test]
    fn terminal_velocity_matches_stokes_for_fine_particles() {
        let v = terminal_velocity(10e-6, 4500.0, 998.0, 1.0e-3);
        let stokes = G_ACCEL * (4500.0 - 998.0) * 1e-10 / (18.0 * 1.0e-3);
        assert!((v - stokes).abs() / stokes < 1e-6);
    }
}
