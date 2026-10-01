"""
Reaction Chamber — Test Suite for Milestone 3 (Equilibrium & Basic Physics)
Validates all M3 gate requirements:
1. Strong/strong, weak/strong, and polyprotic titration curves match PHREEQC within 0.05 pH.
2. AgCl precipitates at its Ksp threshold (with common-ion effect).
3. Mixing temperatures match simple calorimetry.
4. Layering follows liquid density ordering.
5. High ionic strength (> 0.5 M) provenance is flagged as estimated.
"""
import pytest
import math
from pipeline.equilibrium_solver import (
    solve_aqueous_equilibrium,
    titrate_strong_strong,
    titrate_weak_strong,
    titrate_polyprotic,
    solve_agcl_precipitation,
    mix_calorimetry,
    determine_density_layering,
    dissolve_solid_with_limit,
    kw_at_temp,
    davies_gamma,
)

def test_m3_gate_strong_strong_titration():
    """
    Gate check: 50 mL 0.1 M HCl titrated with 0.1 M NaOH.
    PHREEQC benchmark reference:
    - Initial (0 mL): pH 1.10 (Davies gamma ~ 0.78 => -log10(0.078) ~ 1.108)
    - Equivalence (50 mL): pH 7.00
    - Excess base (100 mL): pH 12.44
    Tolerance target: within 0.05 pH across curve.
    """
    points = titrate_strong_strong(50.0, 0.1, 0.1, 100.0, 100)
    assert len(points) == 101

    # 1. Initial point
    p_init = points[0]
    assert abs(p_init["ph"] - 1.10) <= 0.05, f"Initial pH {p_init['ph']} should match PHREEQC 1.10"

    # 2. Near equivalence (45 mL NaOH)
    p_45 = points[45]
    assert 2.0 < p_45["ph"] < 3.0

    # 3. Equivalence point (50 mL NaOH)
    p_eq = points[50]
    assert abs(p_eq["ph"] - 7.00) <= 0.05, f"Equivalence pH {p_eq['ph']} should be 7.00"

    # 4. Excess base (100 mL NaOH)
    p_end = points[100]
    assert abs(p_end["ph"] - 12.44) <= 0.05, f"End pH {p_end['ph']} should match PHREEQC 12.44"

def test_m3_gate_weak_strong_titration():
    """
    Gate check: 50 mL 0.1 M Acetic acid (pKa = 4.756) titrated with 0.1 M NaOH.
    PHREEQC benchmark reference:
    - Initial (0 mL): pH 2.88
    - Half-equivalence (25 mL): pH 4.68 (Davies activity corrected from 4.756)
    - Equivalence (50 mL): pH 8.64 (acetate hydrolysis with Davies activity)
    Tolerance target: within 0.05 pH.
    """
    points = titrate_weak_strong(50.0, 0.1, 4.756, 0.1, 100.0, 100)
    assert len(points) == 101

    p_init = points[0]
    assert abs(p_init["ph"] - 2.88) <= 0.05, f"Initial weak acid pH {p_init['ph']} should match 2.88"

    p_half = points[25]
    assert abs(p_half["ph"] - 4.68) <= 0.05, f"Half-equivalence pH {p_half['ph']} should match 4.68"

    p_eq = points[50]
    assert abs(p_eq["ph"] - 8.64) <= 0.05, f"Equivalence pH {p_eq['ph']} should match 8.64"

def test_m3_gate_polyprotic_titration():
    """
    Gate check: 50 mL 0.05 M Carbonic acid (pKa1 = 6.35, pKa2 = 10.33) with 0.1 M NaOH.
    PHREEQC benchmark reference:
    - First equiv (25 mL): pH 8.19
    - Second equiv (50 mL): pH 11.15
    Tolerance target: within 0.05 pH.
    """
    points = titrate_polyprotic(50.0, 0.05, [6.35, 10.33], 0.1, 100.0, 100)
    assert len(points) == 101

    p_eq1 = points[25]
    assert abs(p_eq1["ph"] - 8.19) <= 0.05, f"First equiv pH {p_eq1['ph']} should match 8.19"

    p_eq2 = points[50]
    assert abs(p_eq2["ph"] - 11.15) <= 0.05, f"Second equiv pH {p_eq2['ph']} should match 11.15"

def test_m3_gate_agcl_precipitation_threshold():
    """
    Gate check: AgCl precipitates at its Ksp threshold.
    Ksp(AgCl, 25 C) = 1.77e-10.
    """
    # 1. Undersaturated: [Ag+] = 1e-6 M, [Cl-] = 1e-6 M => IAP = 1e-12 < Ksp
    ag1, cl1, ppt1 = solve_agcl_precipitation(1e-6, 1e-6, 1.0)
    assert ppt1 == 0.0, "Undersaturated solution should yield 0 precipitate"
    assert ag1 == 1e-6
    assert cl1 == 1e-6

    # 2. Saturated / precipitation: 0.01 M AgNO3 + 0.01 M NaCl => IAP = 1e-4 >> Ksp
    ag2, cl2, ppt2 = solve_agcl_precipitation(0.01, 0.01, 1.0)
    assert ppt2 > 0.0099, "Precipitate must form"
    # Remaining product [Ag+] * [Cl-] must equal Ksp within 0.1%
    remaining_iap = ag2 * cl2
    assert math.isclose(remaining_iap, 1.77e-10, rel_tol=1e-3)

    # 3. Common ion effect: excess Cl- (0.05 M Cl-, 0.001 M Ag+)
    ag3, cl3, ppt3 = solve_agcl_precipitation(0.001, 0.05, 1.0)
    assert ppt3 > 0.00099
    assert ag3 < 1e-7, "Common ion effect should depress [Ag+] in solution"
    assert math.isclose(ag3 * cl3, 1.77e-10, rel_tol=1e-3)

def test_m3_gate_calorimetry_temperature_mixing():
    """
    Gate check: Mixing temperatures match simple calorimetry.
    """
    # 1. Equal volumes: 100 mL at 20 C (293.15 K) + 100 mL at 80 C (353.15 K) => 50 C (323.15 K)
    v_tot, t_mix = mix_calorimetry(100.0, 293.15, 100.0, 353.15)
    assert v_tot == 200.0
    assert math.isclose(t_mix, 323.15, abs_tol=1e-3)

    # 2. Unequal volumes: 50 mL at 10 C (283.15 K) + 150 mL at 90 C (363.15 K)
    # (50*10 + 150*90)/200 = 14000/200 = 70 C (343.15 K)
    v_tot2, t_mix2 = mix_calorimetry(50.0, 283.15, 150.0, 363.15)
    assert v_tot2 == 200.0
    assert math.isclose(t_mix2, 343.15, abs_tol=1e-3)

def test_m3_gate_density_layering():
    """
    Gate check: Immiscible phases layer according to physical density.
    """
    # Hexane (0.655) floats on water (1.000)
    top1, bot1 = determine_density_layering("Hexane", 0.655, "Water", 1.000)
    assert top1 == "Hexane" and bot1 == "Water"

    # Dichloromethane (1.326) sinks below water (1.000)
    top2, bot2 = determine_density_layering("DCM", 1.326, "Water", 1.000)
    assert top2 == "Water" and bot2 == "DCM"

def test_m3_edge_cases():
    """
    Edge case checks:
    - Pure water: pH 7.00
    - Very dilute acid: 1e-8 M HCl does not give pH 8, autoionization maintains pH ~ 6.98
    - High ionic strength (> 0.5 M) marked as estimated
    """
    # 1. Pure water
    res_water = solve_aqueous_equilibrium()
    assert abs(res_water["ph"] - 7.00) < 0.05
    assert res_water["tier"] == "tabulated"

    # 2. Very dilute acid: 1e-8 M HCl
    res_dilute = solve_aqueous_equilibrium(c_strong_acid=1e-8)
    assert 6.95 <= res_dilute["ph"] <= 7.00, f"Dilute acid pH {res_dilute['ph']} must be slightly below 7.0, never > 7.0"

    # 3. High ionic strength (> 0.5 M)
    res_high_i = solve_aqueous_equilibrium(c_strong_base=0.8)
    assert res_high_i["ionic_strength"] > 0.5
    assert res_high_i["tier"] == "estimated"

def test_m3_edge_case_concentrated_acid_base():
    """Extremely concentrated acid and base solutions with high ionic strength."""
    # 5.0 M HCl -> extreme acid, negative pH
    res_acid = solve_aqueous_equilibrium(c_strong_acid=5.0)
    assert res_acid["ph"] < 0.0, f"5 M HCl pH {res_acid['ph']} must be negative"
    assert res_acid["tier"] == "estimated"
    assert res_acid["ionic_strength"] >= 2.5

    # 5.0 M NaOH -> extreme base, pH > 14
    res_base = solve_aqueous_equilibrium(c_strong_base=5.0)
    assert res_base["ph"] > 14.0, f"5 M NaOH pH {res_base['ph']} must be > 14"
    assert res_base["tier"] == "estimated"

def test_m3_edge_case_ultra_dilute_acid_base():
    """Ultra-dilute acid and base (1e-11 M) dominated by water autoionization."""
    res_a = solve_aqueous_equilibrium(c_strong_acid=1e-11)
    assert abs(res_a["ph"] - 7.00) < 0.01, f"1e-11 M HCl pH {res_a['ph']} must be essentially 7.00"

    res_b = solve_aqueous_equilibrium(c_strong_base=1e-11)
    assert abs(res_b["ph"] - 7.00) < 0.01, f"1e-11 M NaOH pH {res_b['ph']} must be essentially 7.00"

def test_m3_edge_case_weak_base_equilibrium():
    """Weak base (NH3 / NH4+, pKa = 9.25) speciation."""
    # 0.1 M NH3: pH = 0.5 * (14 + 9.25 + log10(0.1)) ~ 11.12
    res_nh3 = solve_aqueous_equilibrium(c_weak_base=0.1, pka_weak_base_conj=9.25)
    assert abs(res_nh3["ph"] - 11.12) < 0.10, f"0.1 M NH3 pH {res_nh3['ph']} should be ~ 11.12"
    assert res_nh3["species_mol_l"]["BH+"] > 0.0

def test_m3_edge_case_triprotic_titration_h3po4():
    """Triprotic titration curve (e.g. H3PO4 pKas = [2.15, 7.20, 12.35])."""
    points = titrate_polyprotic(50.0, 0.1, [2.15, 7.20, 12.35], 0.1, 150.0, 150)
    assert len(points) == 151
    # Initial point (0.1 M H3PO4): pH ~ 1.6
    assert 1.0 < points[0]["ph"] < 2.5
    # First equiv (50 mL added): pH near (2.15 + 7.20)/2 = 4.67
    assert 4.0 < points[50]["ph"] < 5.5
    # Second equiv (100 mL added): pH near (7.20 + 12.35)/2 = 9.77
    assert 9.0 < points[100]["ph"] < 10.5

def test_m3_edge_case_temperature_dependent_kw():
    """Water autoionization Kw and neutral pH shift with temperature."""
    # 0 °C (273.15 K): Kw ~ 1.14e-15, neutral pH ~ 7.47
    res_0c = solve_aqueous_equilibrium(temp_k=273.15)
    assert 7.40 <= res_0c["ph"] <= 7.55, f"0 C neutral water pH {res_0c['ph']} should be ~ 7.47"

    # 60 °C (333.15 K): Kw ~ 9.6e-14, neutral pH ~ 6.51
    res_60c = solve_aqueous_equilibrium(temp_k=333.15)
    assert 6.45 <= res_60c["ph"] <= 6.60, f"60 C neutral water pH {res_60c['ph']} should be ~ 6.51"

def test_m3_edge_case_agcl_precipitation_comprehensive():
    """AgCl precipitation edge cases: zero ions, temperature shifts, extreme common ion."""
    # 1. Zero Ag+ or zero Cl-
    ag0, cl0, ppt0 = solve_agcl_precipitation(0.0, 0.1, 1.0)
    assert ppt0 == 0.0 and ag0 == 0.0 and cl0 == 0.1

    # 2. Extreme common-ion effect: [Cl-] = 1.0 M, [Ag+] = 1e-4 M
    ag_ci, cl_ci, ppt_ci = solve_agcl_precipitation(1e-4, 1.0, 1.0)
    assert ppt_ci > 9.99e-5
    # [Ag+] should be depressed to ~ 1.77e-10 M
    assert ag_ci < 1e-9
    assert math.isclose(ag_ci * cl_ci, 1.77e-10, rel_tol=1e-3)

    # 3. Temperature dependence: AgCl is more soluble at 60 °C (333.15 K) than 25 °C (298.15 K)
    # At 25 °C, 2e-5 M Ag+ + 2e-5 M Cl- (IAP = 4e-10 > 1.77e-10) precipitates
    _, _, ppt_25c = solve_agcl_precipitation(2e-5, 2e-5, 1.0, temp_k=298.15)
    assert ppt_25c > 0.0

    # At 60 °C, Ksp increases by factor ~ 10 -> IAP = 4e-10 is now undersaturated!
    _, _, ppt_60c = solve_agcl_precipitation(2e-5, 2e-5, 1.0, temp_k=333.15)
    assert ppt_60c == 0.0, "Higher temperature should dissolve AgCl (endothermic dissolution)"

def test_m3_edge_case_solid_dissolution():
    """Dissolution with solubility limit."""
    # 1. Below limit (solubility = 0.5 mol/L, vol = 2 L -> max 1.0 mol)
    diss1, rem1 = dissolve_solid_with_limit(0.4, 2.0, 0.5)
    assert diss1 == 0.4 and rem1 == 0.0

    # 2. Above limit: 1.5 mol added into 2 L with 0.5 M limit -> 1.0 mol dissolved, 0.5 mol solid
    diss2, rem2 = dissolve_solid_with_limit(1.5, 2.0, 0.5)
    assert math.isclose(diss1 := diss2, 1.0)
    assert math.isclose(rem2, 0.5)

    # 3. Zero volume
    diss3, rem3 = dissolve_solid_with_limit(1.0, 0.0, 0.5)
    assert diss3 == 0.0 and rem3 == 1.0

def test_m3_edge_case_calorimetry_and_layering():
    """Calorimetry and density layering edge cases."""
    # Zero volume mixing
    v0, t0 = mix_calorimetry(0.0, 300.0, 0.0, 350.0)
    assert v0 == 0.0 and t0 == 300.0

    # Negative volume clamped
    v_neg, t_neg = mix_calorimetry(-50.0, 290.0, 100.0, 350.0)
    assert v_neg == 100.0 and math.isclose(t_neg, 350.0)

    # Extreme volume ratio: 1 mL at 100 °C + 999 mL at 20 °C
    v_rat, t_rat = mix_calorimetry(1.0, 373.15, 999.0, 293.15)
    assert v_rat == 1000.0
    assert math.isclose(t_rat, 293.23, abs_tol=0.05)

    # Equal density layering
    top_eq, bot_eq = determine_density_layering("PhaseA", 1.0, "PhaseB", 1.0)
    assert top_eq == "PhaseA" and bot_eq == "PhaseB"

