use crate::physics::{DENSITY_WATER, SPECIFIC_HEAT_WATER};

pub const DELTA_H_NEUTRALISATION: f64 = -55840.0; // J/mol (exothermic)
pub const DELTA_H_VAP_WATER: f64 = 40660.0;       // J/mol
pub const TB_WATER_K: f64 = 373.15;               // 100 °C in Kelvin
pub const T_ROOM_DEFAULT_K: f64 = 298.15;         // 25 °C

/// Energy balance step result
#[derive(Clone, Debug)]
pub struct EnergyBalanceResult {
    pub new_temp_k: f64,
    pub heat_reaction_joules: f64,
    pub heat_input_joules: f64,
    pub heat_loss_joules: f64,
    pub boil_off_moles: f64,
    pub is_boiling: bool,
}

/// Integrates the vessel energy balance over a time step dt
pub fn step_energy_balance(
    current_temp_k: f64,
    liquid_vol_ml: f64,
    reaction_heats_joules: f64,
    heater_watts: f64,
    ambient_loss_coeff_w_per_k: f64,
    t_room_k: f64,
    dt: f64,
) -> EnergyBalanceResult {
    if dt <= 0.0 {
        return EnergyBalanceResult {
            new_temp_k: current_temp_k,
            heat_reaction_joules: 0.0,
            heat_input_joules: 0.0,
            heat_loss_joules: 0.0,
            boil_off_moles: 0.0,
            is_boiling: false,
        };
    }

    let c_glass = 25.0; // Small thermal mass of vessel glass (J/K)
    let q_heater_joules = heater_watts.max(0.0) * dt;
    let q_ambient_loss = ambient_loss_coeff_w_per_k * (current_temp_k - t_room_k) * dt;
    let q_net = reaction_heats_joules + q_heater_joules - q_ambient_loss;

    // Edge case: dry vessel
    if liquid_vol_ml <= 0.0 {
        let delta_t = q_net / c_glass;
        let tentative = (current_temp_k + delta_t).max(200.0);
        return EnergyBalanceResult {
            new_temp_k: tentative,
            heat_reaction_joules: reaction_heats_joules,
            heat_input_joules: q_heater_joules,
            heat_loss_joules: q_ambient_loss,
            boil_off_moles: 0.0,
            is_boiling: false,
        };
    }

    // Heat capacity of the solution (J/K)
    let liquid_mass_g = liquid_vol_ml * DENSITY_WATER;
    let c_solution = liquid_mass_g * SPECIFIC_HEAT_WATER;
    let c_total = c_solution + c_glass;

    let delta_t_unconstrained = q_net / c_total;
    let tentative_temp = current_temp_k + delta_t_unconstrained;

    // Boiling phase transition clamp
    if tentative_temp >= TB_WATER_K {
        // Temperature clamped at boiling point (100 C)
        // Heat above Tb drives latent phase change (boil-off)
        let heat_to_reach_tb = (TB_WATER_K - current_temp_k).max(0.0) * c_total;
        let excess_heat = (q_net - heat_to_reach_tb).max(0.0);
        let max_water_moles = (liquid_vol_ml * DENSITY_WATER) / 18.015;
        let raw_boil_moles = excess_heat / DELTA_H_VAP_WATER;
        let boil_off_moles = raw_boil_moles.min(max_water_moles);
        let water_left = max_water_moles - boil_off_moles;

        let (new_temp, is_boiling) = if water_left <= 1e-9 {
            let unspent_heat = (raw_boil_moles - boil_off_moles) * DELTA_H_VAP_WATER;
            (TB_WATER_K + unspent_heat / c_glass, false)
        } else {
            (TB_WATER_K, true)
        };

        EnergyBalanceResult {
            new_temp_k: new_temp,
            heat_reaction_joules: reaction_heats_joules,
            heat_input_joules: q_heater_joules,
            heat_loss_joules: q_ambient_loss,
            boil_off_moles,
            is_boiling,
        }
    } else {
        EnergyBalanceResult {
            new_temp_k: tentative_temp.max(200.0), // prevent sub-absolute zero
            heat_reaction_joules: reaction_heats_joules,
            heat_input_joules: q_heater_joules,
            heat_loss_joules: q_ambient_loss,
            boil_off_moles: 0.0,
            is_boiling: false,
        }
    }
}

/// Computes neutralisation temperature rise for mixing strong acid and strong base
pub fn calc_neutralisation_temperature_rise(
    vol_acid_ml: f64,
    c_acid_mol_l: f64,
    vol_base_ml: f64,
    c_base_mol_l: f64,
) -> f64 {
    let va = vol_acid_ml.max(0.0);
    let vb = vol_base_ml.max(0.0);
    let ca = c_acid_mol_l.max(0.0);
    let cb = c_base_mol_l.max(0.0);

    let moles_acid = (va / 1000.0) * ca;
    let moles_base = (vb / 1000.0) * cb;
    let moles_neutralised = moles_acid.min(moles_base);

    let heat_joules = moles_neutralised * (-DELTA_H_NEUTRALISATION);
    let total_vol_ml = va + vb;
    let total_mass_g = total_vol_ml * DENSITY_WATER;
    let heat_capacity = total_mass_g * SPECIFIC_HEAT_WATER;

    if heat_capacity > 0.0 {
        heat_joules / heat_capacity
    } else {
        0.0
    }
}
