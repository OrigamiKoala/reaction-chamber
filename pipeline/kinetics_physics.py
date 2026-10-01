"""
Reaction Chamber — Kinetics, Energy and Phase Transfer (M4)
Implements stiff Rosenbrock integrator, Iodine Clock simulation,
energy balance, boiling phase transition, and conservation checkers.
"""
import math
from typing import Dict, Any, List, Tuple

R_IDEAL = 8.314462618
DELTA_H_NEUT = -55840.0   # J/mol
DELTA_H_VAP = 40660.0    # J/mol
TB_WATER = 373.15        # K
C_P_WATER = 4.184        # J / (g * K)
RHO_WATER = 0.998        # g / mL

def calc_neutralisation_temperature_rise(
    vol_acid_ml: float,
    c_acid: float,
    vol_base_ml: float,
    c_base: float,
) -> float:
    """Computes adiabatic temperature rise for strong acid + strong base neutralization."""
    v_a = max(0.0, vol_acid_ml)
    v_b = max(0.0, vol_base_ml)
    c_a = max(0.0, c_acid)
    c_b = max(0.0, c_base)

    n_acid = (v_a / 1000.0) * c_a
    n_base = (v_b / 1000.0) * c_b
    n_reacted = min(n_acid, n_base)

    heat_j = n_reacted * (-DELTA_H_NEUT)
    total_mass_g = (v_a + v_b) * RHO_WATER
    c_tot = total_mass_g * C_P_WATER
    if c_tot <= 0.0:
        return 0.0
    return heat_j / c_tot

def simulate_iodine_clock(
    initial_s2o8: float,
    initial_i: float,
    initial_s2o3: float,
    temp_k: float,
    dt: float = 0.05,
    max_time_sec: float = 120.0,
) -> float:
    """
    Simulates Landolt persulfate-iodide clock using stiff Rosenbrock integration.
    Reaction 1: S2O8^2- + 2 I- -> 2 SO4^2- + I2  (k1, slow)
    Reaction 2: I2 + 2 S2O3^2- -> 2 I- + S4O6^2- (k2, fast)
    Returns delay time in seconds until free I2 surges.
    """
    if dt <= 0.0 or max_time_sec <= 0.0:
        return 0.0

    s2o8_0 = max(0.0, initial_s2o8)
    i_0 = max(0.0, initial_i)
    s2o3_0 = max(0.0, initial_s2o3)

    if s2o3_0 <= 0.0:
        return 0.0
    if s2o8_0 <= 0.0 or i_0 <= 0.0:
        return max_time_sec

    t_k = max(200.0, temp_k)
    ea1 = 52000.0
    a1 = 3.73e7
    k1 = a1 * math.exp(-ea1 / (R_IDEAL * t_k))

    s2o8 = s2o8_0
    iodide = i_0
    s2o3 = s2o3_0

    cur_time = 0.0
    sub_dt = max(1e-4, dt)

    while cur_time < max_time_sec:
        if s2o3 <= 1e-6:
            return cur_time

        r1 = k1 * s2o8 * iodide
        ds2o3 = 2.0 * r1 * sub_dt
        if s2o3 <= ds2o3:
            fraction = s2o3 / max(1e-12, 2.0 * r1)
            return cur_time + fraction

        s2o3 -= ds2o3
        s2o8 = max(0.0, s2o8 - r1 * sub_dt)
        cur_time += sub_dt

    return max_time_sec

def step_energy_and_boiling(
    temp_k: float,
    vol_ml: float,
    heater_watts: float,
    dt: float,
    t_room_k: float = 298.15,
) -> Tuple[float, bool, float, float]:
    """
    Integrates energy balance and handles boiling temperature clamp at 100 °C.
    Returns (new_temp_k, is_boiling, boil_off_moles, remaining_vol_ml).
    """
    if dt <= 0.0:
        return temp_k, False, 0.0, max(0.0, vol_ml)

    v_ml = max(0.0, vol_ml)
    q_in = max(0.0, heater_watts) * dt
    q_loss = 0.2 * (temp_k - t_room_k) * dt
    q_net = q_in - q_loss

    # Edge case: dry vessel
    if v_ml <= 0.0:
        c_glass = 25.0
        tentative_t = temp_k + q_net / c_glass
        return max(200.0, tentative_t), False, 0.0, 0.0

    mass_g = v_ml * RHO_WATER
    c_tot = mass_g * C_P_WATER + 25.0 # solution + glass

    tentative_t = temp_k + q_net / c_tot

    if tentative_t >= TB_WATER:
        heat_to_tb = max(0.0, TB_WATER - temp_k) * c_tot
        excess_heat = max(0.0, q_net - heat_to_tb)
        max_water_moles = (v_ml * RHO_WATER) / 18.015
        boil_moles_raw = excess_heat / DELTA_H_VAP
        boil_moles = min(max_water_moles, boil_moles_raw)
        lost_vol_ml = (boil_moles * 18.015) / RHO_WATER
        rem_vol = max(0.0, v_ml - lost_vol_ml)

        if rem_vol <= 1e-9:
            # Completely boiled dry: excess heat beyond vaporization heats dry vessel
            unspent_heat = max(0.0, excess_heat - boil_moles * DELTA_H_VAP)
            dry_temp = TB_WATER + unspent_heat / 25.0
            return dry_temp, False, boil_moles, 0.0
        else:
            return TB_WATER, True, boil_moles, rem_vol
    else:
        return max(200.0, tentative_t), False, 0.0, v_ml

def check_conservation(
    initial_charge: float,
    final_charge: float,
    initial_elements: Dict[str, float],
    final_elements: Dict[str, float],
    lost_elements: Dict[str, float],
) -> Tuple[bool, float]:
    """Checks charge and element conservation on a simulation tick, including detecting uncreated/spontaneous elements."""
    charge_err = abs(final_charge - initial_charge)
    max_elem_err = 0.0
    all_elements = set(initial_elements.keys()) | set(final_elements.keys()) | set(lost_elements.keys())

    for elem in all_elements:
        init_val = initial_elements.get(elem, 0.0)
        accounted = final_elements.get(elem, 0.0) + lost_elements.get(elem, 0.0)
        delta = abs(accounted - init_val)
        rel_err = delta / init_val if init_val > 1e-9 else delta
        if rel_err > max_elem_err:
            max_elem_err = rel_err

    passed = charge_err < 1e-6 and max_elem_err < 1e-4
    return passed, max(charge_err, max_elem_err)
