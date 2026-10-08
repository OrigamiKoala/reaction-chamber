//! Rate-law helpers shared by the network generator: the Mayr linear free-energy relation, the diffusion ceiling of
//! bimolecular steps and the acidity of the medium. The reaction families themselves are data
//! (`data/reaction_templates.json`, `reaction_templates.rs`).

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

pub const R_IDEAL: f64 = crate::physics::R_GAS; // J/(mol·K)
pub const BOLTZMANN_K: f64 = 1.380649e-23; // J/K
pub const PLANCK_H: f64 = 6.62607015e-34; // J·s
pub const VISCOSITY_WATER_298: f64 = 8.90e-4; // Pa·s (at 25 °C)

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MayrParameter {
    pub id: String,
    pub name: String,
    pub is_nucleophile: bool,
    pub n: f64,    // Nucleophilicity N
    pub s_n: f64,  // Nucleophile sensitivity s_N
    pub e: f64,    // Electrophilicity E
    pub solvent: String,
    /// structure of the compound (the database's SMILES), when it has one
    #[serde(default)]
    pub smiles: Option<String>,
    /// database quality rating (0-5 stars) and the literature reference of the parameters
    #[serde(default)]
    pub quality_stars: u8,
    #[serde(default)]
    pub reference: String,
    #[serde(default)]
    pub doi: Option<String>,
}

/// Calculate Mayr rate constant at 20 °C (293.15 K) and scale with temperature:
/// log10(k_20C) = s_N * (N + E)
/// Arrhenius / Eyring temperature adjustment with assumed delta_S_ddagger = -60 J/(mol·K)
pub fn calculate_mayr_rate(nuc: &MayrParameter, el: &MayrParameter, temp_k: f64) -> f64 {
    let t = if temp_k.is_nan() || temp_k <= 100.0 { 298.15 } else { temp_k };
    let log_k_20c = nuc.s_n * (nuc.n + el.e);
    let k_20c = 10.0_f64.powf(log_k_20c.clamp(-15.0, 15.0));

    // Convert k at 293.15 K to Delta G_ddagger(293.15)
    let t_ref = 293.15;
    let factor = (BOLTZMANN_K * t_ref) / PLANCK_H; // ~ 6.11e12 s^-1
    let delta_g_ddagger_20c = -R_IDEAL * t_ref * (k_20c / factor).max(1e-30).ln();

    // Standard bimolecular activation entropy Delta S_ddagger ~ -60 J/(mol*K)
    let delta_s_ddagger = -60.0;
    let delta_h_ddagger = delta_g_ddagger_20c + t_ref * delta_s_ddagger;

    // Eyring rate at temperature T:
    // k(T) = (k_B * T / h) * exp(-Delta H_ddagger / (R*T)) * exp(Delta S_ddagger / R)
    let k_t = ((BOLTZMANN_K * t) / PLANCK_H)
        * (-delta_h_ddagger / (R_IDEAL * t)).exp()
        * (delta_s_ddagger / R_IDEAL).exp();

    if k_t.is_finite() && k_t >= 0.0 {
        k_t
    } else {
        k_20c
    }
}

/// Calculate Stokes-Einstein / Smoluchowski diffusion limit:
/// k_diff = (8 * R * T) / (3 * eta)
/// In M^-1 s^-1 (with eta in Pa*s, 1 m^3/mol*s = 1000 L/(mol*s) = 1000 M^-1 s^-1)
pub fn calculate_diffusion_limit(viscosity_pa_s: f64, temp_k: f64) -> f64 {
    let t = if temp_k <= 100.0 || temp_k.is_nan() { 298.15 } else { temp_k };
    let eta = if viscosity_pa_s <= 1e-6 || viscosity_pa_s.is_nan() { VISCOSITY_WATER_298 } else { viscosity_pa_s };
    // (8 * 8.314 * T) / (3 * eta) in m^3/(mol*s) * 1000 = L/(mol*s) = M^-1 s^-1
    (8.0 * R_IDEAL * t) / (3.0 * eta) * 1000.0
}

/// Smoothly cap bimolecular rate constant at diffusion limit:
/// 1 / k_eff = 1 / k_fwd + 1 / k_diff  =>  k_eff = (k_fwd * k_diff) / (k_fwd + k_diff)
pub fn apply_diffusion_cap(k_fwd: f64, temp_k: f64, viscosity: f64) -> f64 {
    if k_fwd <= 0.0 || k_fwd.is_nan() {
        return 0.0;
    }
    let k_diff = calculate_diffusion_limit(viscosity, temp_k);
    (k_fwd * k_diff) / (k_fwd + k_diff)
}

/// Acidity of the solution a network is generated in (dissolved H+ and OH- concentrations, mol/L).
#[derive(Clone, Copy, Debug)]
pub struct Medium {
    pub ph: f64,
    pub h_conc: f64,
    pub oh_conc: f64,
}

impl Medium {
    pub fn new(h_conc: f64, oh_conc: f64) -> Self {
        Medium { ph: -h_conc.max(1e-300).log10(), h_conc, oh_conc }
    }

    /// From a pH and the solution: uses the solver's OH- concentration when it is in `concs` (mol/L), otherwise
    /// Kw(T) / [H+] with the same Kw(T) as the solver's water equilibrium.
    pub fn from_solution(ph: f64, temp_k: f64, concs: &HashMap<String, f64>) -> Self {
        let h_conc = concs.get(crate::db::seed::PROTON).copied().filter(|c| *c > 0.0).unwrap_or_else(|| 10.0_f64.powf(-ph));
        let oh_conc = concs
            .get(crate::db::seed::HYDROXIDE)
            .copied()
            .filter(|c| *c > 0.0)
            .unwrap_or_else(|| 10.0_f64.powf(crate::chem_db::water_log_kw(temp_k)) / h_conc);
        Medium { ph, h_conc, oh_conc }
    }
}

/// Mayr reactivity parameters (`data/mayr_parameters.json`).
pub fn get_mayr_database() -> HashMap<String, MayrParameter> {
    #[derive(Deserialize)]
    struct File {
        parameters: Vec<MayrParameter>,
    }
    let file: File = serde_json::from_str(include_str!("../data/mayr_parameters.json")).expect("mayr_parameters.json is valid");
    file.parameters.into_iter().map(|p| (p.id.clone(), p)).collect()
}
