use crate::equilibrium::{KSP_AGCL_298, R_IDEAL};
use crate::energy::{DELTA_H_VAP_WATER, TB_WATER_K};

pub const KH_CO2_298: f64 = 0.034; // M / atm
pub const P_ATM: f64 = 1.0;        // atm

/// Phase transfer state result
#[derive(Clone, Debug)]
pub struct PhaseTransferResult {
    pub gas_evolved_moles: f64,
    pub remaining_dissolved_gas_mol_l: f64,
    pub evaporated_water_moles: f64,
    pub precipitate_formed_moles: f64,
}

/// Computes Henry's law gas evolution (degassing) for supersaturated dissolved gas (e.g. CO2)
pub fn step_gas_evolution(
    c_dissolved_mol_l: f64,
    liquid_vol_liters: f64,
    temp_k: f64,
    p_gas_atm: f64,
    stirring: bool,
    dt: f64,
) -> (f64, f64) {
    if liquid_vol_liters <= 0.0 || c_dissolved_mol_l <= 0.0 || dt <= 0.0 {
        return (0.0, c_dissolved_mol_l.max(0.0));
    }
    let t = if temp_k.is_nan() { 298.15 } else { temp_k.clamp(273.15, 400.0) };
    let p = p_gas_atm.max(0.0);

    // Henry's law constant temperature dependence for CO2
    // ln(KH / KH0) = -Delta H_sol / R * (1/T - 1/T0)
    let delta_h_sol = -20000.0; // J/mol exothermic dissolution
    let kh = KH_CO2_298 * ((-delta_h_sol / R_IDEAL) * (1.0 / t - 1.0 / 298.15)).exp();
    let c_sat = kh * p;

    if c_dissolved_mol_l <= c_sat {
        // Undersaturated or at equilibrium: no bubbling
        return (0.0, c_dissolved_mol_l);
    }

    // Degassing rate constant (s^-1)
    let base_rate = 0.15; // unstirred
    let k_degas = if stirring { base_rate * 3.5 } else { base_rate };

    let excess_conc = c_dissolved_mol_l - c_sat;
    let max_degas_moles = excess_conc * liquid_vol_liters;

    // First-order approach to saturation
    let fraction_degassed = 1.0 - (-k_degas * dt).exp();
    let evolved_moles = (max_degas_moles * fraction_degassed).min(max_degas_moles);
    let new_conc = (c_dissolved_mol_l * liquid_vol_liters - evolved_moles) / liquid_vol_liters;

    (evolved_moles, new_conc.max(c_sat))
}

/// Calculates water vapor pressure (atm) at temperature T (Kelvin) via Clausius-Clapeyron
pub fn water_vapor_pressure_atm(temp_k: f64) -> f64 {
    let t = if temp_k.is_nan() { 298.15 } else { temp_k.clamp(200.0, 500.0) };
    let term = (-DELTA_H_VAP_WATER / R_IDEAL) * (1.0 / t - 1.0 / TB_WATER_K);
    P_ATM * term.exp()
}

/// Computes evaporation and boiling loss
pub fn step_evaporation_and_boiling(
    liquid_vol_ml: f64,
    temp_k: f64,
    is_boiling: bool,
    boil_off_moles: f64,
    dt: f64,
) -> (f64, f64) {
    if liquid_vol_ml <= 0.0 || dt <= 0.0 {
        return (0.0, liquid_vol_ml.max(0.0));
    }

    let mw_water = 18.015;
    let max_water_moles = (liquid_vol_ml * 1.0) / mw_water;

    let mut total_lost_moles = 0.0;

    if is_boiling {
        total_lost_moles += boil_off_moles;
    } else {
        // Sub-boiling surface evaporation
        let p_vap = water_vapor_pressure_atm(temp_k);
        let surface_area_cm2 = 25.0; // typical beaker cross-section
        let k_evap = 1e-6; // mol / (cm^2 * s * atm)
        let rate_mol_per_s = k_evap * surface_area_cm2 * p_vap;
        total_lost_moles += rate_mol_per_s * dt;
    }

    let actual_lost_moles = total_lost_moles.min(max_water_moles);
    let lost_volume_ml = (actual_lost_moles * mw_water) / 1.0;
    let remaining_vol_ml = (liquid_vol_ml - lost_volume_ml).max(0.0);

    (actual_lost_moles, remaining_vol_ml)
}

/// Kinetic precipitation step for AgCl with nucleation and growth
pub fn step_precipitation_kinetics(
    c_ag_mol_l: f64,
    c_cl_mol_l: f64,
    existing_solid_moles: f64,
    vol_liters: f64,
    gamma_1: f64,
    _temp_k: f64,
    dt: f64,
) -> (f64, f64, f64) {
    if vol_liters <= 0.0 {
        return (c_ag_mol_l, c_cl_mol_l, existing_solid_moles);
    }

    let iap = (gamma_1 * c_ag_mol_l) * (gamma_1 * c_cl_mol_l);
    let s_ratio = (iap / KSP_AGCL_298).sqrt();

    if s_ratio <= 1.0 {
        // Undersaturated: no further precipitation
        return (c_ag_mol_l, c_cl_mol_l, existing_solid_moles);
    }

    // Fast nucleation + crystal growth
    let supersat_drive = s_ratio - 1.0;
    let k_growth = 2.0; // s^-1
    let rate_mol_l_s = k_growth * supersat_drive * (existing_solid_moles / vol_liters + 1e-4);
    let max_precip_moles = (c_ag_mol_l.min(c_cl_mol_l)) * vol_liters;
    let formed_moles = (rate_mol_l_s * vol_liters * dt).min(max_precip_moles);

    let new_ag = (c_ag_mol_l - formed_moles / vol_liters).max(0.0);
    let new_cl = (c_cl_mol_l - formed_moles / vol_liters).max(0.0);
    let new_solid = existing_solid_moles + formed_moles;

    (new_ag, new_cl, new_solid)
}
