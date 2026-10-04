import pytest
import math
from pipeline.templates_m6 import (
    REACTION_FAMILIES,
    MAYR_DATABASE,
    VISCOSITY_WATER_298,
    calculate_mayr_rate,
    calculate_diffusion_limit,
    apply_diffusion_cap,
)

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
