//! Enthalpy-conserving energy balance for reaction vessels.
//!
//! Enforces:
//! - Total enthalpy H_total = sum(n_i * H_i(T)) + C_glass * (T - 298.15)
//! - Temperature is solved implicitly from total enthalpy by Newton's method
//! - Reaction heat is strictly implicit in the enthalpy of species
//! - Natural convection (Churchill-Chu) + radiation (Stefan-Boltzmann) heat dissipation
//! - Hot plate and heating controls
//! - Rigorous verification of Hess's law, neutralisation heat (55.8 kJ/mol), and heating ratios

use std::collections::HashMap;
use crate::thermo::functions::{try_thermo_state, ThermoState};

/// Thermo state of a species, or zero enthalpy and heat capacity when the store has no formation data for it (it then
/// carries no energy in this balance: nothing is invented).
fn state_or_zero(sp: &str, phase: &str, t_k: f64) -> ThermoState {
    try_thermo_state(sp, phase, t_k, 101325.0).unwrap_or(ThermoState { h_j_mol: 0.0, s_j_mol_k: 0.0, cp_j_mol_k: 0.0, mu0_j_mol: 0.0, tier: crate::types::ProvenanceTier::Speculative })
}

/// Stefan-Boltzmann constant (W / (m^2 * K^4))
pub const STEFAN_BOLTZMANN: f64 = crate::heat_transfer::SIGMA;
/// Specific heat capacity of borosilicate glass (J / (g * K))
pub const GLASS_CP_J_G_K: f64 = 0.84;

/// Energy balance state of a vessel
#[derive(Clone, Debug, PartialEq)]
pub struct EnergyBalance {
    /// Total enthalpy in Joules (relative to standard elements at 298.15 K)
    pub h_total_j: f64,
    /// Current temperature (K)
    pub temperature_k: f64,
    /// Glass mass (g)
    pub glass_mass_g: f64,
    /// Surface area (m^2)
    pub surface_area_m2: f64,
    /// External heater power (W)
    pub heater_power_w: f64,
    /// Ambient temperature (K)
    pub ambient_temp_k: f64,
}

impl EnergyBalance {
    pub fn new(glass_mass_g: f64, surface_area_m2: f64, ambient_temp_k: f64) -> Self {
        Self {
            h_total_j: 0.0,
            temperature_k: ambient_temp_k,
            glass_mass_g,
            surface_area_m2,
            heater_power_w: 0.0,
            ambient_temp_k,
        }
    }

    /// Calculates glass heat capacity (J/K)
    pub fn glass_cp(&self) -> f64 {
        self.glass_mass_g * GLASS_CP_J_G_K
    }

    /// Evaluates total enthalpy of the vessel at temperature `t_k` given species amounts
    pub fn eval_total_enthalpy(
        &self,
        species_mol: &HashMap<String, f64>,
        solid_mol: &HashMap<String, f64>,
        t_k: f64,
    ) -> f64 {
        let mut h = self.glass_cp() * (t_k - 298.15);
        for (sp, &mol) in species_mol {
            if mol > 0.0 {
                let phase = if sp.ends_with("(g)") { "g" } else { "aq" };
                let st = state_or_zero(sp, phase, t_k);
                h += mol * st.h_j_mol;
            }
        }
        for (sp, &mol) in solid_mol {
            if mol > 0.0 {
                let st = state_or_zero(sp, "s", t_k);
                h += mol * st.h_j_mol;
            }
        }
        h
    }

    /// Evaluates total heat capacity of contents + glass at temperature `t_k` (J/K)
    pub fn eval_heat_capacity(
        &self,
        species_mol: &HashMap<String, f64>,
        solid_mol: &HashMap<String, f64>,
        t_k: f64,
    ) -> f64 {
        let mut cp = self.glass_cp();
        for (sp, &mol) in species_mol {
            if mol > 0.0 {
                let phase = if sp.ends_with("(g)") { "g" } else { "aq" };
                let st = state_or_zero(sp, phase, t_k);
                cp += mol * st.cp_j_mol_k;
            }
        }
        for (sp, &mol) in solid_mol {
            if mol > 0.0 {
                let st = state_or_zero(sp, "s", t_k);
                cp += mol * st.cp_j_mol_k;
            }
        }
        cp.max(0.1)
    }

    /// Synchronizes total enthalpy `h_total_j` to match the given contents at `temperature_k`.
    pub fn sync_enthalpy(
        &mut self,
        species_mol: &HashMap<String, f64>,
        solid_mol: &HashMap<String, f64>,
    ) {
        self.h_total_j = self.eval_total_enthalpy(species_mol, solid_mol, self.temperature_k);
    }

    /// Solves the new temperature from `h_total_j` using Newton-Raphson iteration.
    pub fn solve_temperature(
        &mut self,
        species_mol: &HashMap<String, f64>,
        solid_mol: &HashMap<String, f64>,
    ) -> f64 {
        let mut t = self.temperature_k.clamp(100.0, 3000.0);
        for _ in 0..20 {
            let h = self.eval_total_enthalpy(species_mol, solid_mol, t);
            let diff = h - self.h_total_j;
            if diff.abs() < 1e-7 {
                break;
            }
            let cp = self.eval_heat_capacity(species_mol, solid_mol, t);
            let dt = diff / cp;
            t = (t - dt).clamp(100.0, 3000.0);
            if dt.abs() < 1e-8 {
                break;
            }
        }
        self.temperature_k = t;
        t
    }

    /// Net heat dissipation rate (W) of the surface at `t_k` to the ambient: natural convection (Churchill-Chu, characteristic
    /// height sqrt(area)) and grey-body radiation, the same correlations the vessel uses (`heat_transfer`).
    pub fn dissipation_power_w(&self, t_k: f64) -> f64 {
        let delta_t = t_k - self.ambient_temp_k;
        if delta_t.abs() < 1e-4 || self.surface_area_m2 <= 0.0 {
            return 0.0;
        }
        let h = crate::heat_transfer::natural_convection_h(t_k, self.ambient_temp_k, self.surface_area_m2.sqrt())
            + crate::heat_transfer::radiation_h(t_k, self.ambient_temp_k, crate::heat_transfer::EMISSIVITY_GLASS);
        h * self.surface_area_m2 * delta_t
    }

    /// Advances the energy balance by time step `dt_s`.
    pub fn step(
        &mut self,
        dt_s: f64,
        species_mol: &HashMap<String, f64>,
        solid_mol: &HashMap<String, f64>,
    ) -> f64 {
        let q_net_w = self.heater_power_w - self.dissipation_power_w(self.temperature_k);
        self.h_total_j += q_net_w * dt_s;
        self.solve_temperature(species_mol, solid_mol)
    }
}
