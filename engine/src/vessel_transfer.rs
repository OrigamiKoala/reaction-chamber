//! Heterogeneous transfers between the solids and the solution (Stage 8): the particle populations, the stirring
//! hydrodynamics, kinetic precipitation (nucleation and growth) and transport-limited dissolution.
//!
//! The equilibrium solver (`vessel_eq`) knows only the *target*: where the solution and a solid would end up if given
//! time. This module decides how fast the vessel gets there:
//!
//! * a solid that is **undersaturated** dissolves only as fast as the film around its particles delivers it: the solver
//!   is run once with the whole solid available to find the equilibrium dissolution D_eq of each solid, then again with
//!   the solid limited to D_eq (1 - exp(-k A dt / V)), the exact first-order relaxation of the solution toward
//!   saturation through the particle surface A (`population::relaxation_fraction`);
//! * a **supersaturated** solid is left out of the solver and precipitates only through `nucleation::precipitate`:
//!   no nuclei, no precipitate (the metastable zone), then nucleation and growth, whose balance sets the particle count
//!   and therefore the mean size.

use std::collections::HashMap;

use crate::chem_db;
use crate::transfer::{
    diffusion::species_diffusivity_water_m2_s,
    hydro::{self, Stirring},
    nucleation::{self, PrecipInput, SaltProps},
    population::{self, ParticlePopulation},
};
use crate::vessel::*;

/// Time (s) a freshly dosed or mixed addition takes to reach the whole liquid: the dissolution and precipitation that
/// happen "at the moment of the addition" are those of one mixing time.
pub(crate) const DOSE_MIXING_TIME_S: f64 = 1.0;

/// The liquid and the stirrer as the transfer rates see them.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Hydro {
    pub st: Stirring,
    pub liquid_m3: f64,
    pub rho_l: f64,
    pub eta: f64,
    pub nu: f64,
    pub eps: f64,
}

impl Vessel {
    // ---------------------------------------------------------------------------------------------- hydrodynamics
    pub(crate) fn stir_rpm(&self) -> f64 {
        let stirring = self.controls.stirring.unwrap_or(false);
        self.controls.stir_rpm.unwrap_or(if stirring { 300.0 } else { 0.0 })
    }

    /// The primary liquid's density (kg/m3) and viscosity (Pa s), and the stirrer's dissipation rate.
    pub(crate) fn hydro_state(&self) -> Hydro {
        let t = self.temperature_k;
        let (map, vol_ml) = if self.has_aqueous_phase() {
            (&self.species_mol, self.aqueous_volume_ml())
        } else {
            let lead = self.liquid_maps().max_by(|a, b| {
                self.phase_volume_ml(a, t).partial_cmp(&self.phase_volume_ml(b, t)).unwrap_or(std::cmp::Ordering::Equal)
            });
            match lead {
                Some(m) => (m, self.phase_volume_ml(m, t)),
                None => (&self.species_mol, 0.0),
            }
        };
        let liquid_m3 = self.total_liquid_volume_ml().max(1e-6) * 1e-6;
        let rho_l = if vol_ml > 1e-6 { (self.phase_mass_g(map) / vol_ml * 1000.0).clamp(300.0, 3000.0) } else { 1000.0 };
        let eta = (crate::props::calculate_viscosity_cp(map, t, vol_ml.max(1e-6)) * 1e-3).clamp(1e-4, 100.0);
        let nu = eta / rho_l;
        let st = Stirring::new(self.stir_rpm(), self.config.inner_radius_cm);
        let eps = hydro::dissipation_w_kg(&st, rho_l, nu, liquid_m3);
        Hydro { st, liquid_m3, rho_l, eta, nu, eps }
    }

    /// Film mass-transfer coefficient (m/s) of a particle of diameter `d` of solid `sp` for a solute of diffusivity `diff`.
    pub(crate) fn film_coefficient(&self, sp: &str, d: f64, diff: f64, h: &Hydro) -> f64 {
        let rho_p = self.solid_props(sp).density_g_ml * 1000.0;
        hydro::particle_mass_transfer(d, diff, rho_p, h.rho_l, h.eta, &h.st, h.eps)
    }

    // ----------------------------------------------------------------------------------------------- populations
    /// A dose of solid: its mol join the species' particle population as particles of the given size (default grain
    /// size of the reagent).
    pub(crate) fn add_solid_particles(&mut self, sp: &str, mol: f64, diameter_m: Option<f64>) {
        let props = self.solid_props(sp);
        let d = diameter_m.unwrap_or(props.particle_um * 1e-6);
        let mass_g = mol * chem_db::get_species_thermo(sp).mw;
        self.particle_populations.entry(sp.to_string()).or_default().add_mass(mass_g, props.density_g_ml, d);
    }

    /// Keeps every population consistent with the solid amounts (changed by dissolution, reactions, precipitation,
    /// draw-off): the particle count is conserved while a solid shrinks or grows; a solid with no population gets one
    /// of the default grain size.
    pub(crate) fn sync_populations(&mut self) {
        let sps: Vec<String> = self.solid_mol.keys().cloned().collect();
        for sp in &sps {
            let mol = self.solid_mol.get(sp).copied().unwrap_or(0.0);
            if mol <= 0.0 {
                self.particle_populations.remove(sp);
                continue;
            }
            let props = self.solid_props(sp);
            let mass_g = mol * chem_db::get_species_thermo(sp).mw;
            let vol_m3 = mass_g * 1e-3 / (props.density_g_ml.max(0.05) * 1000.0);
            let empty = self.particle_populations.get(sp).map_or(true, |p| p.is_empty());
            if empty {
                self.particle_populations.insert(sp.clone(), ParticlePopulation::from_mass_and_diameter(mass_g, props.density_g_ml, props.particle_um * 1e-6));
            } else if let Some(p) = self.particle_populations.get_mut(sp) {
                p.scale_to_volume(vol_m3);
            }
        }
        self.particle_populations.retain(|k, _| sps.contains(k));
    }

    // ----------------------------------------------------------------------------------------- precipitation
    /// ln of the activity-based saturation ratio of a mineral, S = (IAP / Ksp)^(1/nu), or None when an ion is absent.
    pub(crate) fn ln_saturation(&self, min: &chem_db::GeneralMineral, vol_l: f64, gamma: &HashMap<String, f64>) -> Option<f64> {
        let nu_tot: f64 = min.dissolved_products.values().sum();
        if nu_tot <= 0.0 {
            return None;
        }
        let mut ln_iap = 0.0;
        for (ion, &c) in &min.dissolved_products {
            let n = self.species_mol.get(ion).copied().unwrap_or(0.0);
            if n <= 0.0 {
                return None;
            }
            ln_iap += c * ((n / vol_l).ln() + gamma.get(ion).copied().unwrap_or(0.0));
        }
        let ln_ksp = min.log_ksp_at(self.temperature_k) * std::f64::consts::LN_10;
        Some((ln_iap - ln_ksp) / nu_tot)
    }

    /// The minerals at or above saturation and their ln S (the free-ion supersaturation that drives nucleation).
    pub(crate) fn supersaturated_minerals(&self, vol_l: f64, gamma: &HashMap<String, f64>) -> HashMap<String, f64> {
        let mut out = HashMap::new();
        for m in &self.minerals {
            if m.dissolved_products.is_empty() {
                continue;
            }
            if let Some(ln_s) = self.ln_saturation(m, vol_l, gamma) {
                if ln_s > -1e-9 {
                    out.insert(m.solid_species.clone(), ln_s);
                }
            }
        }
        out
    }

    /// One equilibrium pass in which each solid exchanges with the solution at the rate its surface and the stirring allow.
    ///
    /// Pass 1 solves the equilibrium target with an inexhaustible supply of every solid: how much each solid would dissolve
    /// (D_sat) or precipitate (P_eq) if given all the time it needs, with every speciation and activity effect in place.
    /// The kinetics then decide how much of that happens in `transport_dt_s`: a dissolving solid delivers
    /// D_sat (1 - exp(-k A dt / V)) through its particle surface; a supersaturated one nucleates and grows
    /// (`nucleation::precipitate`). Pass 2 re-solves the vessel with each solid's reservoir (and, for a precipitate, its
    /// formation) limited to that amount, so every equilibrium that is fast stays at equilibrium around the slow transfer.
    /// `transport_dt_s` = 0 freezes the solids (only the speciation settles); `kinetic_dt_s` is the time the slow
    /// (rate-limited) equilibrium rows advance.
    pub(crate) fn step_equilibria_limited(&mut self, dt_sweep_s: f64, transport_dt_s: f64, kinetic_dt_s: f64) -> f64 {
        self.kinetic_dt_s = kinetic_dt_s;
        let vol_l = (self.solvent_volume_ml() / 1000.0).max(1e-12);
        let (gamma, _) = crate::activity::batch_aqueous_gamma_and_aw(&self.species_mol, self.temperature_k);
        let supers = self.supersaturated_minerals(vol_l, &gamma);
        self.precip_cap.clear();

        // frozen solids (or nothing that can transfer): the speciation settles around the solids as they are
        if transport_dt_s <= 0.0 || (self.solid_mol.is_empty() && supers.is_empty()) {
            self.blocked_minerals = supers.keys().cloned().collect();
            let held = if transport_dt_s <= 0.0 { std::mem::take(&mut self.solid_mol) } else { HashMap::new() };
            let q = self.step_equilibria(dt_sweep_s);
            for (k, v) in held {
                *self.solid_mol.entry(k).or_default() += v;
            }
            self.blocked_minerals.clear();
            return q;
        }

        // pass 1: the equilibrium target with every solid inexhaustible and every precipitation allowed
        let before_solid = self.solid_mol.clone();
        let (d_sat, p_eq) = self.equilibrium_targets(dt_sweep_s, vol_l, kinetic_dt_s, &supers);

        let h = self.hydro_state();
        let t_k = self.temperature_k;
        // kinetic precipitation: nucleation and growth toward P_eq
        for (sp, &p) in &p_eq {
            let Some(min) = self.minerals.iter().find(|m| &m.solid_species == sp).cloned() else { continue };
            let ln_s0 = supers.get(sp).copied().unwrap_or(0.0);
            let nu_tot: f64 = min.dissolved_products.values().sum();
            let nu_prod: f64 = min.dissolved_products.values().map(|c| c * c.ln()).sum();
            let ln_ksp = min.log_ksp_at(t_k) * std::f64::consts::LN_10;
            let ln_gamma_sum: f64 = min.dissolved_products.iter().map(|(i, c)| c * gamma.get(i).copied().unwrap_or(0.0)).sum();
            let c_sat_fu = ((ln_ksp - ln_gamma_sum - nu_prod) / nu_tot.max(1e-9)).exp() * 1000.0;
            let props = self.solid_props(sp);
            let mw = chem_db::get_species_thermo(sp).mw;
            let salt = SaltProps { density_kg_m3: props.density_g_ml * 1000.0, molar_mass_kg_mol: mw * 1e-3, nu_total: nu_tot, c_sat_fu_mol_m3: c_sat_fu };
            let diff = self.solid_diffusivity(sp);
            let pop0 = self.particle_populations.get(sp).cloned().unwrap_or_default();
            let clock0 = self.nuc_clock.get(sp).copied().unwrap_or(0.0);
            let film = |d: f64| -> f64 { hydro::particle_mass_transfer(d, diff, salt.density_kg_m3, h.rho_l, h.eta, &h.st, h.eps) };
            let res = nucleation::precipitate(PrecipInput {
                t_k,
                vol_m3: vol_l * 1e-3,
                dt_s: transport_dt_s,
                salt,
                ln_s0,
                p_eq_mol: p,
                pop: pop0,
                nuc_clock: clock0,
                film_coefficient: &film,
            });
            if res.dn_fu_mol > 0.0 {
                self.precip_cap.insert(sp.clone(), res.dn_fu_mol);
                self.ev.susp.entry(sp.clone()).or_insert(1.0);
            }
            if res.pop.is_empty() {
                self.particle_populations.remove(sp);
            } else {
                self.particle_populations.insert(sp.clone(), res.pop);
            }
            if res.nuc_clock > 0.0 {
                self.nuc_clock.insert(sp.clone(), res.nuc_clock);
            } else {
                self.nuc_clock.remove(sp);
            }
        }

        // each dissolving solid may deliver D_sat (1 - exp(-k A dt / V)), capped by what there is
        let mut held: Vec<(String, f64)> = Vec::new();
        for (sp, &b) in &before_solid {
            let target = d_sat.get(sp).copied().unwrap_or(0.0);
            let pop = self.particle_populations.get(sp).cloned().unwrap_or_default();
            let k = if pop.is_empty() {
                0.0
            } else {
                population::effective_transfer_coefficient(self.film_coefficient(sp, pop.sauter_diameter_m(), self.solid_diffusivity(sp), &h))
            };
            let frac = population::relaxation_fraction(k, pop.surface_area_m2(), h.liquid_m3.max(1e-12), transport_dt_s);
            let allowed = (target * frac).min(b);
            if allowed < b {
                held.push((sp.clone(), b - allowed));
                self.solid_mol.insert(sp.clone(), allowed);
            }
        }

        // pass 2: the vessel with the transfers limited; a supersaturated mineral forms only up to its kinetic amount
        self.blocked_minerals = supers.keys().cloned().collect();
        let mut q = self.step_equilibria(dt_sweep_s);
        for (sp, h_mol) in held {
            *self.solid_mol.entry(sp).or_default() += h_mol;
        }
        // a kinetic precipitate below the equilibrium solver's resolution (the first nuclei: femtomoles) is applied directly
        let caps: Vec<(String, f64)> = self.precip_cap.iter().map(|(k, v)| (k.clone(), *v)).collect();
        for (sp, cap) in caps {
            let gained = self.solid_mol.get(&sp).copied().unwrap_or(0.0) - before_solid.get(&sp).copied().unwrap_or(0.0);
            if gained >= 0.99 * cap {
                continue;
            }
            let Some(min) = self.minerals.iter().find(|m| m.solid_species == sp).cloned() else { continue };
            let mut want = cap - gained.max(0.0);
            for (ion, &c) in &min.dissolved_products {
                want = want.min(self.species_mol.get(ion).copied().unwrap_or(0.0) / c);
            }
            if want <= 0.0 {
                continue;
            }
            for (ion, &c) in &min.dissolved_products {
                let m = self.species_mol.entry(ion.clone()).or_default();
                *m = (*m - c * want).max(0.0);
            }
            *self.solid_mol.entry(sp.clone()).or_default() += want;
            *self.initial_solids.entry(sp.clone()).or_default() += want;
            q += want * min.delta_h_kj * 1000.0;
            self.eq_moved = true;
        }
        self.blocked_minerals.clear();
        self.precip_cap.clear();
        q
    }

    /// Pass 1 of `step_equilibria_limited`: what the vessel would dissolve (D_sat) and precipitate (P_eq) per solid at
    /// equilibrium, found by equilibrating with every solid inexhaustible. Leaves the vessel as it found it.
    fn equilibrium_targets(
        &mut self,
        dt_sweep_s: f64,
        vol_l: f64,
        kinetic_dt_s: f64,
        supers: &HashMap<String, f64>,
    ) -> (HashMap<String, f64>, HashMap<String, f64>) {
        let before_species = self.species_mol.clone();
        let before_solid = self.solid_mol.clone();
        let before_extra = self.extra_liquids.clone();
        let before_t = self.temperature_k;
        let before_moved = self.eq_moved;
        let phantom = 50.0 * vol_l; // mol: far more than any solubility (50 M) can take
        self.blocked_minerals.clear();
        for v in self.solid_mol.values_mut() {
            *v += phantom;
        }
        // (the targets are limits of the fast speciation: slow rows stay frozen here, they relax in pass 2)
        self.kinetic_dt_s = 0.0;
        let _ = self.step_equilibria(dt_sweep_s);
        self.kinetic_dt_s = kinetic_dt_s;
        let mut d_sat: HashMap<String, f64> = HashMap::new(); // dissolution target
        let mut p_eq: HashMap<String, f64> = HashMap::new(); // precipitation target
        let mut sps: Vec<String> = before_solid.keys().cloned().collect();
        sps.extend(supers.keys().filter(|k| !before_solid.contains_key(*k)).cloned());
        for sp in &sps {
            let b = before_solid.get(sp).copied().unwrap_or(0.0);
            let had = before_solid.contains_key(sp);
            let a = self.solid_mol.get(sp).copied().unwrap_or(0.0);
            let delta = (b + if had { phantom } else { 0.0 }) - a; // + dissolved, - precipitated
            if delta > 0.0 {
                d_sat.insert(sp.clone(), delta);
            } else if delta < 0.0 {
                p_eq.insert(sp.clone(), -delta);
            }
        }
        self.species_mol = before_species;
        self.extra_liquids = before_extra;
        self.solid_mol = before_solid.clone();
        self.temperature_k = before_t;
        self.eq_moved = before_moved;
        (d_sat, p_eq)
    }

    /// Diffusivity (m2/s) of the species a solid dissolves into.
    pub(crate) fn solid_diffusivity(&self, sp: &str) -> f64 {
        let t = self.temperature_k;
        if let Some(m) = self.minerals.iter().find(|m| m.solid_species == sp) {
            let (mut s, mut w) = (0.0, 0.0);
            for (i, &c) in &m.dissolved_products {
                s += c * species_diffusivity_water_m2_s(i, t).ln();
                w += c;
            }
            if w > 0.0 {
                return (s / w).exp();
            }
        }
        let key = self.liquid_key_of_solid(sp).unwrap_or_else(|| sp.trim_end_matches("(s)").to_string());
        species_diffusivity_water_m2_s(&key, t)
    }
}
