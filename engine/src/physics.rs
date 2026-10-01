use crate::types::Phase;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const SPECIFIC_HEAT_WATER: f64 = 4.184; // J/(g*K)
pub const DENSITY_WATER: f64 = 0.998;       // g/mL at 20 C

/// Liquid mixture result from combining two solutions
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LiquidMixResult {
    pub total_volume_ml: f64,
    pub mixed_temperature_k: f64,
    pub total_amounts_mol: HashMap<String, f64>,
    pub concentrations_mol_l: HashMap<String, f64>,
}

/// Computes mixing of two liquid volumes with calorimetry temperature equilibration
pub fn mix_liquids(
    vol1_ml: f64,
    temp1_k: f64,
    amounts1_mol: &HashMap<String, f64>,
    vol2_ml: f64,
    temp2_k: f64,
    amounts2_mol: &HashMap<String, f64>,
) -> LiquidMixResult {
    let total_volume_ml = vol1_ml + vol2_ml;
    if total_volume_ml <= 0.0 {
        return LiquidMixResult {
            total_volume_ml: 0.0,
            mixed_temperature_k: temp1_k,
            total_amounts_mol: HashMap::new(),
            concentrations_mol_l: HashMap::new(),
        };
    }

    // Heat capacity of water approximation (dilute aqueous)
    let m1 = vol1_ml * DENSITY_WATER;
    let m2 = vol2_ml * DENSITY_WATER;
    let c1 = m1 * SPECIFIC_HEAT_WATER;
    let c2 = m2 * SPECIFIC_HEAT_WATER;

    let mixed_temperature_k = if (c1 + c2) > 0.0 {
        (c1 * temp1_k + c2 * temp2_k) / (c1 + c2)
    } else {
        temp1_k
    };

    // Combine moles
    let mut total_amounts_mol = amounts1_mol.clone();
    for (k, v) in amounts2_mol {
        *total_amounts_mol.entry(k.clone()).or_insert(0.0) += *v;
    }

    // Concentrations in mol/L
    let vol_liters = total_volume_ml / 1000.0;
    let mut concentrations_mol_l = HashMap::new();
    for (k, moles) in &total_amounts_mol {
        concentrations_mol_l.insert(k.clone(), *moles / vol_liters);
    }

    LiquidMixResult {
        total_volume_ml,
        mixed_temperature_k,
        total_amounts_mol,
        concentrations_mol_l,
    }
}

/// Simple calorimetry: calculates temperature change Delta T = Q / (m * c_p)
pub fn calorimetry_temp_change(
    heat_joules: f64,
    liquid_vol_ml: f64,
    density_g_ml: f64,
    specific_heat: f64,
) -> f64 {
    let mass_g = liquid_vol_ml * density_g_ml;
    let heat_cap = mass_g * specific_heat;
    if heat_cap > 0.0 {
        heat_joules / heat_cap
    } else {
        0.0
    }
}

/// Sorts phases by density so lower density phases layer on top of higher density phases
pub fn sort_layers_by_density(phases: &mut [Phase]) {
    // Lower density floats on top (index 0 = top layer)
    phases.sort_by(|a, b| a.density_g_ml.partial_cmp(&b.density_g_ml).unwrap_or(std::cmp::Ordering::Equal));
}

/// Determines layering order for two liquids (e.g. aqueous vs organic)
/// Returns (top_phase_name, bottom_phase_name)
pub fn determine_layering(
    phase1_name: &str,
    density1: f64,
    phase2_name: &str,
    density2: f64,
) -> (String, String) {
    if density1 <= density2 {
        (phase1_name.to_string(), phase2_name.to_string())
    } else {
        (phase2_name.to_string(), phase1_name.to_string())
    }
}

/// Dissolves salt or solid into solution considering solubility limit (mol/L)
/// Returns (dissolved_moles, remaining_solid_moles)
pub fn dissolve_solid_with_limit(
    added_moles: f64,
    volume_liters: f64,
    solubility_limit_mol_l: f64,
) -> (f64, f64) {
    if volume_liters <= 0.0 {
        return (0.0, added_moles);
    }
    let max_dissolvable = solubility_limit_mol_l * volume_liters;
    if added_moles <= max_dissolvable {
        (added_moles, 0.0)
    } else {
        (max_dissolvable, added_moles - max_dissolvable)
    }
}
