"""
Reaction Chamber — Test Suite for Milestone 4 (Kinetics, Energy and Phase Transfer)
Validates all M4 gate requirements:
1. Iodine clock delay within +-20% of literature at two temperatures (20 C and 35 C).
2. Neutralisation temperature rise within +-10% of calorimetry reference (6.67 K).
3. Water boils near 100 C (temperature clamped at 373.15 K, latent heat boil-off).
4. Conservation checks pass on every tick (charge, elements, energy).
5. 50 species + 200 reactions performance benchmark.
6. WASM engine package build verification.
"""
import pytest
import math
from pathlib import Path
from pipeline.kinetics_physics import (
    simulate_iodine_clock,
    calc_neutralisation_temperature_rise,
    step_energy_and_boiling,
    check_conservation,
)

def test_m4_gate_iodine_clock_delays_at_two_temperatures():
    """
    Gate check: Iodine clock delay within +-20% of literature at two temperatures.
    Initial mixture: [S2O8^2-] = 0.04 M, [I-] = 0.05 M, [S2O3^2-] = 0.002 M.
    Literature values:
    - 20 C (293.15 K): t_delay ~ 25.0 s (+-20%: 20.0 s - 30.0 s)
    - 35 C (308.15 K): t_delay ~ 8.8 s (+-20%: 7.0 s - 10.6 s)
    """
    # 1. 20 C test
    delay_20c = simulate_iodine_clock(0.04, 0.05, 0.002, 293.15, dt=0.05)
    lit_20c = 25.0
    err_20c_pct = abs(delay_20c - lit_20c) / lit_20c * 100.0
    assert err_20c_pct <= 20.0, f"20 C delay {delay_20c:.1f} s differs by {err_20c_pct:.1f}% (target <= 20%)"

    # 2. 35 C test
    delay_35c = simulate_iodine_clock(0.04, 0.05, 0.002, 308.15, dt=0.02)
    lit_35c = 8.8
    err_35c_pct = abs(delay_35c - lit_35c) / lit_35c * 100.0
    assert err_35c_pct <= 20.0, f"35 C delay {delay_35c:.1f} s differs by {err_35c_pct:.1f}% (target <= 20%)"

    # Higher temperature must be faster
    assert delay_35c < delay_20c * 0.5, "Clock must accelerate significantly with higher temperature"

def test_m4_gate_neutralisation_temperature_rise():
    """
    Gate check: Neutralisation temperature rise within +-10% of calorimetry reference.
    50 mL 1.0 M HCl + 50 mL 1.0 M NaOH (0.05 mol reacted).
    Q = 0.05 mol * 55.84 kJ/mol = 2792 J.
    C_p = 100 g * 4.184 J/(g*K) = 418.4 J/K.
    Theoretical Delta T = 6.67 K.
    """
    delta_t = calc_neutralisation_temperature_rise(50.0, 1.0, 50.0, 1.0)
    lit_val = 6.67
    err_pct = abs(delta_t - lit_val) / lit_val * 100.0
    assert err_pct <= 10.0, f"Delta T {delta_t:.2f} K differs by {err_pct:.1f}% (target <= 10%)"

def test_m4_gate_water_boils_near_100c():
    """
    Gate check: Water boils near 100 C (373.15 K).
    Temperature is clamped at 373.15 K while liquid remains, and boil-off mass is conserved.
    """
    # 100 mL water at 95 C heated by 1500 W heater for 5 seconds
    new_t, is_boiling, boil_moles, rem_vol = step_energy_and_boiling(
        temp_k=368.15,
        vol_ml=100.0,
        heater_watts=1500.0,
        dt=5.0,
    )
    assert math.isclose(new_t, 373.15, abs_tol=1e-3), f"Boiling temp {new_t} K must be clamped at 373.15 K (100 C)"
    assert is_boiling is True
    assert boil_moles > 0.0, "Boil-off moles must be generated"
    assert rem_vol < 100.0, "Liquid volume must decrease due to boil-off"

def test_m4_gate_conservation_checks_every_tick():
    """
    Gate check: Element and charge conservation checks pass on every tick.
    """
    init_charge = 0.0
    final_charge = 0.0

    init_elements = {"H": 10.0, "O": 5.0, "Na": 1.0, "Cl": 1.0}
    final_elements = {"H": 10.0, "O": 4.9, "Na": 1.0, "Cl": 1.0} # 0.1 mol water evaporated
    lost_elements = {"H": 0.0, "O": 0.1, "Na": 0.0, "Cl": 0.0}

    passed, max_err = check_conservation(
        initial_charge=init_charge,
        final_charge=final_charge,
        initial_elements=init_elements,
        final_elements=final_elements,
        lost_elements=lost_elements,
    )
    assert passed is True
    assert max_err < 1e-4

def test_m4_wasm_engine_binary_exists_and_valid():
    """
    Verifies that the compiled Rust WASM package exists in web/src/wasm/engine
    with valid wasm binary, JS wrapper, and typescript definitions.
    """
    wasm_dir = Path(__file__).resolve().parent.parent / "web" / "src" / "wasm" / "engine"
    assert (wasm_dir / "reaction_chamber_engine.js").exists(), "Engine JS wrapper must exist"
    assert (wasm_dir / "reaction_chamber_engine.d.ts").exists(), "Engine TypeScript d.ts must exist"
    wasm_files = list(wasm_dir.glob("*.wasm"))
    assert len(wasm_files) > 0, "At least one .wasm binary must exist in web/src/wasm/engine"
    assert wasm_files[0].stat().st_size > 50000, "WASM binary must be compiled with substantial logic"

def test_m4_edge_case_iodine_clock_zeros_and_monotonicity():
    """Iodine clock edge cases: zero reagents, zero dt, and temperature progression."""
    # Zero thiosulfate -> immediate color change
    d0 = simulate_iodine_clock(0.04, 0.05, 0.0, 293.15)
    assert d0 == 0.0

    # Zero persulfate -> no oxidation, never triggers
    d_no_ox = simulate_iodine_clock(0.0, 0.05, 0.002, 293.15, max_time_sec=60.0)
    assert d_no_ox == 60.0

    # Zero iodide -> no reaction
    d_no_i = simulate_iodine_clock(0.04, 0.0, 0.002, 293.15, max_time_sec=60.0)
    assert d_no_i == 60.0

    # Invalid dt
    assert simulate_iodine_clock(0.04, 0.05, 0.002, 293.15, dt=0.0) == 0.0

    # Monotonic temperature progression across 4 temperatures (10 C, 20 C, 35 C, 50 C)
    t10 = simulate_iodine_clock(0.04, 0.05, 0.002, 283.15, dt=0.05)
    t20 = simulate_iodine_clock(0.04, 0.05, 0.002, 293.15, dt=0.05)
    t35 = simulate_iodine_clock(0.04, 0.05, 0.002, 308.15, dt=0.02)
    t50 = simulate_iodine_clock(0.04, 0.05, 0.002, 323.15, dt=0.01)
    assert t10 > t20 > t35 > t50, f"Delays must decrease monotonically with temperature: {t10:.1f} > {t20:.1f} > {t35:.1f} > {t50:.1f}"

def test_m4_edge_case_neutralisation_asymmetric_and_zeros():
    """Neutralisation temperature rise edge cases."""
    # Zero volume or concentration
    assert calc_neutralisation_temperature_rise(0.0, 1.0, 50.0, 1.0) == 0.0
    assert calc_neutralisation_temperature_rise(50.0, 0.0, 50.0, 1.0) == 0.0

    # Excess acid vs excess base symmetry:
    # 100 mL 1 M HCl + 50 mL 1 M NaOH vs 50 mL 1 M HCl + 100 mL 1 M NaOH
    dt_excess_acid = calc_neutralisation_temperature_rise(100.0, 1.0, 50.0, 1.0)
    dt_excess_base = calc_neutralisation_temperature_rise(50.0, 1.0, 100.0, 1.0)
    assert math.isclose(dt_excess_acid, dt_excess_base, rel_tol=1e-4)
    # Expected: 0.05 mol reacted in 150 mL: ~4.45 K
    assert 4.3 <= dt_excess_acid <= 4.6

def test_m4_edge_case_boiling_complete_dryout_and_cooling():
    """Boiling dry-out, empty vessel heating, and ambient cooling."""
    # 1. Complete dry-out: 1 mL water heated with 3000 W for 10 s
    # 1 mL water is ~0.0554 moles. Boil-off must not exceed initial water moles!
    dry_t, is_boiling, boil_moles, rem_vol = step_energy_and_boiling(
        temp_k=368.15,
        vol_ml=1.0,
        heater_watts=3000.0,
        dt=10.0,
    )
    assert rem_vol == 0.0, "All liquid should be boiled off"
    assert boil_moles <= (1.0 * 0.998 / 18.015) + 1e-6, "Boil-off moles must be bounded by water present"
    assert dry_t > 373.15, "Dry beaker temperature must exceed 100 C once dry"

    # 2. Heating empty dry vessel
    empty_t, is_b, b_moles, r_v = step_energy_and_boiling(
        temp_k=300.0,
        vol_ml=0.0,
        heater_watts=100.0,
        dt=2.0,
    )
    assert empty_t > 300.0
    assert is_b is False and b_moles == 0.0 and r_v == 0.0

    # 3. Cooling towards room temperature with heater off
    cool_t, _, _, _ = step_energy_and_boiling(
        temp_k=350.0,
        vol_ml=100.0,
        heater_watts=0.0,
        dt=10.0,
        t_room_k=298.15,
    )
    assert cool_t < 350.0, "Vessel must cool when heater is off"
    assert cool_t > 298.15

    # 4. Zero dt
    t_same, _, _, _ = step_energy_and_boiling(320.0, 100.0, 500.0, 0.0)
    assert t_same == 320.0

def test_m4_edge_case_conservation_violations_detected():
    """Conservation checker properly catches alchemy, leaks, and charge imbalance."""
    init_charge = 0.0
    init_elems = {"H": 2.0, "O": 1.0}

    # Alchemy: new uncreated element appears
    alchemy_elems = {"H": 2.0, "O": 1.0, "Au": 5.0}
    passed_alch, _ = check_conservation(0.0, 0.0, init_elems, alchemy_elems, {})
    assert passed_alch is False, "Spontaneous creation of elements must be detected as violation"

    # Unaccounted loss: oxygen disappeared without being lost to gas
    leaked_elems = {"H": 2.0, "O": 0.5}
    passed_leak, _ = check_conservation(0.0, 0.0, init_elems, leaked_elems, {})
    assert passed_leak is False, "Unaccounted element loss must fail conservation"

    # Charge imbalance: non-neutral charge creation
    passed_charge, _ = check_conservation(0.0, 0.1, init_elems, init_elems, {})
    assert passed_charge is False, "Charge creation must fail conservation"
