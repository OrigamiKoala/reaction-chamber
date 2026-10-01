import pytest
import math
from pipeline.templates_m6 import (
    REACTION_FAMILIES,
    MAYR_DATABASE,
    VISCOSITY_WATER_298,
    calculate_mayr_rate,
    calculate_diffusion_limit,
    apply_diffusion_cap,
    sn2_e2_product_ratio,
    ester_hydrolysis_k_obs,
    generate_reaction_network_py,
)

def test_m6_gate_sn2_e2_ratio_shifts_with_heat_and_bulky_base():
    """
    Gate: SN2/E2 product ratio shifts toward elimination with heat and with a bulky base.
    """
    # 1. Baseline at room temperature (298.15 K) with normal base (e.g. OH- / MeO-) on secondary halide
    k_sn2_rt, k_e2_rt, ratio_rt = sn2_e2_product_ratio("secondary", is_bulky_base=False, temp_k=298.15)
    assert k_sn2_rt > 0.0 and k_e2_rt > 0.0

    # 2. Elevated temperature (353.15 K = 80 °C) with normal base
    k_sn2_heat, k_e2_heat, ratio_heat = sn2_e2_product_ratio("secondary", is_bulky_base=False, temp_k=353.15)
    # Ea(E2) > Ea(SN2), so E2 rate increases significantly faster with temperature than SN2
    assert ratio_heat > ratio_rt * 1.5, f"Heat must shift product ratio toward elimination: rt={ratio_rt:.4f}, heat={ratio_heat:.4f}"

    # 3. Bulky base (e.g. tert-butoxide) at room temperature (298.15 K)
    k_sn2_bulky, k_e2_bulky, ratio_bulky = sn2_e2_product_ratio("secondary", is_bulky_base=True, temp_k=298.15)
    # Bulky base imposes severe steric hindrance on SN2 backside attack while E2 deprotonation is promoted
    assert ratio_bulky > ratio_rt * 50.0, f"Bulky base must shift ratio > 50x toward E2: normal={ratio_rt:.4f}, bulky={ratio_bulky:.4f}"
    assert ratio_bulky > 10.0, "Bulky base should make E2 strongly dominate (ratio > 10)"

def test_m6_gate_ester_hydrolysis_rate_vs_ph_curve():
    """
    Gate: Ester hydrolysis rate vs pH shows acid and base catalysis (V-shaped / U-shaped profile).
    """
    k_ph1 = ester_hydrolysis_k_obs("ethyl_acetate", ph=1.0, temp_k=298.15)
    k_ph4 = ester_hydrolysis_k_obs("ethyl_acetate", ph=4.0, temp_k=298.15)
    k_ph7 = ester_hydrolysis_k_obs("ethyl_acetate", ph=7.0, temp_k=298.15)
    k_ph10 = ester_hydrolysis_k_obs("ethyl_acetate", ph=10.0, temp_k=298.15)
    k_ph13 = ester_hydrolysis_k_obs("ethyl_acetate", ph=13.0, temp_k=298.15)

    # Acid catalysis: rate at pH 1 must be orders of magnitude faster than at neutral pH 7
    assert k_ph1 > k_ph7 * 100.0, f"Acid catalysis: pH 1 ({k_ph1:.2e}) must be > 100x pH 7 ({k_ph7:.2e})"
    assert k_ph1 > k_ph4, "pH 1 rate must exceed pH 4 rate"

    # Base catalysis: rate at pH 13 must be orders of magnitude faster than at neutral pH 7
    assert k_ph13 > k_ph7 * 1000.0, f"Base catalysis: pH 13 ({k_ph13:.2e}) must be > 1000x pH 7 ({k_ph7:.2e})"
    assert k_ph13 > k_ph10, "pH 13 rate must exceed pH 10 rate"

    # Neutral rate is at the local minimum
    assert k_ph7 < k_ph1 and k_ph7 < k_ph13, "Neutral pH 7 must be lower than extreme acid and base rates"

def test_m6_gate_ten_chemical_stress_mixtures_stay_bounded():
    """
    Gate: Networks stay bounded on random ten-chemical stress mixtures (species <= 200, reactions <= 500).
    """
    stress_mixture = {
        "CH3COCH3": 0.1,       # acetone
        "C2H5OH": 0.1,         # ethanol
        "CH3COOC2H5": 0.1,     # ethyl acetate
        "NaOH": 0.1,           # strong base
        "HCl": 0.1,            # strong acid
        "CH3CH(Br)CH3": 0.1,   # 2-bromopropane
        "cyclohexene": 0.1,    # alkene
        "benzene": 0.1,        # aromatic
        "H2O": 55.0,           # water
        "NH3": 0.1,            # ammonia
    }

    res = generate_reaction_network_py(stress_mixture, temp_k=298.15, ph=7.0, max_species=200, max_rxns=500)

    assert len(res["active_species"]) <= 200, f"Active species count {len(res['active_species'])} exceeded 200"
    assert len(res["reactions"]) <= 500, f"Reaction count {len(res['reactions'])} exceeded 500"
    assert len(res["reactions"]) > 0, "Network generator should produce reactions for interacting functional groups"
    assert res["total_flux"] >= 0.0

def test_m6_reaction_families_coverage():
    """
    Verifies that about 40+ distinct reaction families are defined and configured.
    """
    assert len(REACTION_FAMILIES) >= 40, f"Expected at least 40 reaction families, got {len(REACTION_FAMILIES)}"
    family_ids = {f["id"] for f in REACTION_FAMILIES}
    expected_core = [
        "sn2_primary_halide", "sn2_secondary_halide", "e2_elimination",
        "acid_ester_hydrolysis", "base_ester_hydrolysis", "fischer_esterification",
        "aldol_addition", "aldol_condensation", "keto_enol_tautomerism",
        "alkene_bromination", "alkene_hydration", "alcohol_oxidation_dichromate",
        "carbonyl_reduction_borohydride", "grignard_addition_ketone", "diels_alder_cycloaddition"
    ]
    for fid in expected_core:
        assert fid in family_ids, f"Core family '{fid}' missing from template registry"

def test_m6_mayr_integration_and_diffusion_cap():
    """
    Verifies Mayr rate equation: log10(k) = s_N * (N + E) and diffusion limit capping.
    """
    pip = MAYR_DATABASE["nuc_piperidine"]
    benz = MAYR_DATABASE["el_benzhydrylium_mpa"]
    k_mayr = calculate_mayr_rate(pip["N"], pip["s_N"], benz["E"], temp_k=293.15)
    # log10(k_20C) = 0.78 * (18.25 + 0.00) = 14.235 => k ~ 1.7e14
    assert k_mayr > 1.0e10, f"Expected high polar addition rate for piperidine + benzhydrylium, got {k_mayr:.2e}"

    # Apply Stokes-Einstein diffusion cap
    k_diff = calculate_diffusion_limit(VISCOSITY_WATER_298, 298.15)
    assert 1.0e9 < k_diff < 1.0e11, f"Water diffusion limit should be ~ 7e9 M^-1 s^-1, got {k_diff:.2e}"

    k_capped = apply_diffusion_cap(k_mayr, 298.15, VISCOSITY_WATER_298)
    assert k_capped < k_diff, f"Capped rate {k_capped:.2e} must be strictly below diffusion limit {k_diff:.2e}"
    assert k_capped > 0.0
