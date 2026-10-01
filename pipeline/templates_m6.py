"""
M6 Templates, Reaction Families, and Network Generator (Python Reference & Test Module).
Implements the 45 curated reaction families, Mayr parameter database,
Stokes-Einstein diffusion limit capping, SN2/E2 competition,
ester hydrolysis pH-rate profile, and RMG-style flux-based candidate expansion.
"""

import math
from typing import Dict, List, Tuple, Any, Optional

R_IDEAL = 8.314462618  # J/(mol·K)
BOLTZMANN_K = 1.380649e-23  # J/K
PLANCK_H = 6.62607015e-34  # J·s
VISCOSITY_WATER_298 = 8.90e-4  # Pa·s

def calculate_mayr_rate(n: float, s_n: float, e: float, temp_k: float = 298.15) -> float:
    """
    Computes Mayr rate constant k at temperature temp_k.
    log10(k_20C) = s_N * (N + E)
    Eyring scaling to temp_k with standard Delta S‡ ~ -60 J/(mol·K).
    """
    t = max(100.0, temp_k) if not math.isnan(temp_k) else 298.15
    log_k_20c = s_n * (n + e)
    # Clamp to avoid overflow
    log_k_20c = max(-15.0, min(15.0, log_k_20c))
    k_20c = 10.0 ** log_k_20c

    t_ref = 293.15
    factor = (BOLTZMANN_K * t_ref) / PLANCK_H
    delta_g_ddagger_20c = -R_IDEAL * t_ref * math.log(max(1e-30, k_20c / factor))

    delta_s_ddagger = -60.0
    delta_h_ddagger = delta_g_ddagger_20c + t_ref * delta_s_ddagger

    k_t = ((BOLTZMANN_K * t) / PLANCK_H) * math.exp(-delta_h_ddagger / (R_IDEAL * t)) * math.exp(delta_s_ddagger / R_IDEAL)
    return k_t if math.isfinite(k_t) and k_t >= 0.0 else k_20c

def calculate_diffusion_limit(viscosity_pa_s: float = VISCOSITY_WATER_298, temp_k: float = 298.15) -> float:
    """
    Stokes-Einstein / Smoluchowski diffusion limit:
    k_diff = (8 * R * T) / (3 * eta) in M^-1 s^-1
    """
    t = max(100.0, temp_k) if not math.isnan(temp_k) else 298.15
    eta = max(1e-6, viscosity_pa_s) if not math.isnan(viscosity_pa_s) else VISCOSITY_WATER_298
    return (8.0 * R_IDEAL * t) / (3.0 * eta) * 1000.0

def apply_diffusion_cap(k_fwd: float, temp_k: float = 298.15, viscosity_pa_s: float = VISCOSITY_WATER_298) -> float:
    """
    Smoothly caps bimolecular rate constant at diffusion limit:
    1 / k_eff = 1 / k_fwd + 1 / k_diff  =>  k_eff = (k_fwd * k_diff) / (k_fwd + k_diff)
    """
    if k_fwd <= 0.0:
        return 0.0
    k_diff = calculate_diffusion_limit(viscosity_pa_s, temp_k)
    return (k_fwd * k_diff) / (k_fwd + k_diff)

def sn2_e2_product_ratio(substrate_type: str = "secondary", is_bulky_base: bool = False, temp_k: float = 298.15) -> Tuple[float, float, float]:
    """
    Computes (k_sn2, k_e2, ratio_e2_over_sn2).
    Gate check:
    - Temperature increase (heat) shifts ratio toward E2
    - Bulky base (e.g. t-BuO-) shifts ratio heavily toward E2
    """
    t = max(100.0, temp_k) if not math.isnan(temp_k) else 298.15

    if substrate_type == "primary":
        ea_sn2, a_sn2, ea_e2, a_e2 = 75000.0, 5.0e8, 95000.0, 5.0e10
    elif substrate_type == "tertiary":
        ea_sn2, a_sn2, ea_e2, a_e2 = 120000.0, 1.0e6, 82000.0, 5.0e11
    else:  # secondary
        ea_sn2, a_sn2, ea_e2, a_e2 = 85000.0, 2.0e9, 98000.0, 2.0e11

    k_sn2 = a_sn2 * math.exp(-ea_sn2 / (R_IDEAL * t))
    k_e2 = a_e2 * math.exp(-ea_e2 / (R_IDEAL * t))

    if is_bulky_base:
        k_sn2 *= 0.005  # 200x steric penalty on backside attack
        k_e2 *= 3.0     # 3x boost on peripheral deprotonation

    ratio = k_e2 / k_sn2 if k_sn2 > 1e-15 else 1e6
    return k_sn2, k_e2, ratio

def ester_hydrolysis_k_obs(ester_type: str = "ethyl_acetate", ph: float = 7.0, temp_k: float = 298.15) -> float:
    """
    Computes ester hydrolysis pseudo-first-order rate constant:
    k_obs = k_acid * [H+] + k_neutral + k_base * [OH-]
    Gate check: V-shaped / U-shaped curve showing acid (low pH) and base (high pH) catalysis.
    """
    t = max(100.0, temp_k) if not math.isnan(temp_k) else 298.15
    clamped_ph = max(0.0, min(14.0, ph))
    h_conc = 10.0 ** (-clamped_ph)
    oh_conc = 10.0 ** (-(14.0 - clamped_ph))

    ea = 68000.0 if ester_type == "aromatic" else 60000.0
    t_factor = math.exp((-ea / R_IDEAL) * (1.0 / t - 1.0 / 298.15))

    k_acid_25 = 1.1e-4    # M^-1 s^-1
    k_neutral_25 = 1.5e-8  # s^-1
    k_base_25 = 0.11       # M^-1 s^-1

    k_acid = k_acid_25 * t_factor
    k_neutral = k_neutral_25 * t_factor
    k_base = k_base_25 * t_factor

    return k_acid * h_conc + k_neutral + k_base * oh_conc

MAYR_DATABASE = {
    "nuc_piperidine": {"name": "Piperidine", "is_nuc": True, "N": 18.25, "s_N": 0.78},
    "nuc_morpholine": {"name": "Morpholine", "is_nuc": True, "N": 15.39, "s_N": 0.75},
    "nuc_pyrrolidine": {"name": "Pyrrolidine", "is_nuc": True, "N": 20.21, "s_N": 0.81},
    "nuc_triethylamine": {"name": "Triethylamine", "is_nuc": True, "N": 15.80, "s_N": 0.65},
    "nuc_water": {"name": "Water", "is_nuc": True, "N": 5.20, "s_N": 0.89},
    "nuc_methanol": {"name": "Methanol", "is_nuc": True, "N": 7.55, "s_N": 0.86},
    "nuc_hydroxide": {"name": "Hydroxide Ion", "is_nuc": True, "N": 14.50, "s_N": 0.90},
    "nuc_methoxide": {"name": "Methoxide Ion", "is_nuc": True, "N": 15.80, "s_N": 0.85},
    "nuc_cyanide": {"name": "Cyanide Ion", "is_nuc": True, "N": 16.40, "s_N": 0.72},
    "nuc_iodide": {"name": "Iodide Ion", "is_nuc": True, "N": 12.10, "s_N": 0.80},
    "el_benzhydrylium_dma": {"name": "Bis(4-dimethylaminophenyl)methylium", "is_nuc": False, "E": -7.02},
    "el_benzhydrylium_mpa": {"name": "Bis(4-methoxyphenyl)methylium", "is_nuc": False, "E": 0.00},
    "el_benzhydrylium_ph": {"name": "Diphenylmethylium", "is_nuc": False, "E": 5.90},
    "el_chalcone": {"name": "Chalcone Michael Acceptor", "is_nuc": False, "E": -12.50},
    "el_acetone": {"name": "Acetone", "is_nuc": False, "E": -8.90},
}

REACTION_FAMILIES = [
    {"id": "sn2_primary_halide", "name": "SN2 Primary Halide Substitution", "ea": 75000.0, "reversible": False},
    {"id": "sn2_secondary_halide", "name": "SN2 Secondary Halide Substitution", "ea": 85000.0, "reversible": False},
    {"id": "e2_elimination", "name": "E2 Bimolecular Elimination", "ea": 98000.0, "reversible": False},
    {"id": "sn1_solvolysis", "name": "SN1 Solvolysis", "ea": 90000.0, "reversible": False},
    {"id": "e1_elimination", "name": "E1 Unimolecular Elimination", "ea": 95000.0, "reversible": False},
    {"id": "acid_ester_hydrolysis", "name": "Acid-Catalyzed Ester Hydrolysis", "ea": 62000.0, "reversible": True},
    {"id": "base_ester_hydrolysis", "name": "Base-Catalyzed Ester Hydrolysis", "ea": 48000.0, "reversible": False},
    {"id": "fischer_esterification", "name": "Fischer Esterification", "ea": 64000.0, "reversible": True},
    {"id": "aldol_addition", "name": "Aldol Addition", "ea": 58000.0, "reversible": True},
    {"id": "aldol_condensation", "name": "Aldol Condensation Dehydration", "ea": 65000.0, "reversible": False},
    {"id": "keto_enol_tautomerism", "name": "Keto-Enol Tautomerism", "ea": 70000.0, "reversible": True},
    {"id": "mayr_carbocation_addition", "name": "Mayr Carbocation Addition", "ea": 25000.0, "reversible": True},
    {"id": "mayr_michael_addition", "name": "Mayr Michael Addition", "ea": 40000.0, "reversible": True},
    {"id": "mayr_carbonyl_addition", "name": "Mayr Carbonyl Addition", "ea": 38000.0, "reversible": True},
    {"id": "alkene_bromination", "name": "Alkene Electrophilic Bromination", "ea": 28000.0, "reversible": False},
    {"id": "alkene_chlorination", "name": "Alkene Electrophilic Chlorination", "ea": 22000.0, "reversible": False},
    {"id": "alkene_hydrobromination", "name": "Alkene Hydrobromination", "ea": 45000.0, "reversible": False},
    {"id": "alkene_hydrochlorination", "name": "Alkene Hydrochlorination", "ea": 52000.0, "reversible": False},
    {"id": "alkene_hydration", "name": "Alkene Acid-Catalyzed Hydration", "ea": 68000.0, "reversible": True},
    {"id": "alkene_epoxidation", "name": "Alkene Epoxidation", "ea": 55000.0, "reversible": False},
    {"id": "alkyne_hydration", "name": "Alkyne Hydration", "ea": 65000.0, "reversible": False},
    {"id": "alkyne_halogenation", "name": "Alkyne Halogenation", "ea": 35000.0, "reversible": False},
    {"id": "alcohol_oxidation_dichromate", "name": "Alcohol Oxidation (Dichromate)", "ea": 42000.0, "reversible": False},
    {"id": "aldehyde_oxidation_permanganate", "name": "Aldehyde Oxidation (Permanganate)", "ea": 38000.0, "reversible": False},
    {"id": "carbonyl_reduction_borohydride", "name": "Carbonyl Reduction (NaBH4)", "ea": 45000.0, "reversible": False},
    {"id": "carbonyl_reduction_lah", "name": "Carbonyl Reduction (LiAlH4)", "ea": 28000.0, "reversible": False},
    {"id": "grignard_addition_ketone", "name": "Grignard Addition to Ketone", "ea": 24000.0, "reversible": False},
    {"id": "grignard_addition_aldehyde", "name": "Grignard Addition to Aldehyde", "ea": 20000.0, "reversible": False},
    {"id": "organolithium_addition", "name": "Organolithium Carbonyl Addition", "ea": 18000.0, "reversible": False},
    {"id": "acetal_formation", "name": "Acetal Formation", "ea": 58000.0, "reversible": True},
    {"id": "acetal_hydrolysis", "name": "Acetal Hydrolysis", "ea": 73000.0, "reversible": True},
    {"id": "imine_formation", "name": "Imine Formation", "ea": 46000.0, "reversible": True},
    {"id": "enamine_formation", "name": "Enamine Formation", "ea": 50000.0, "reversible": True},
    {"id": "imine_hydrolysis", "name": "Imine Hydrolysis", "ea": 52000.0, "reversible": True},
    {"id": "amide_hydrolysis_acid", "name": "Acid Amide Hydrolysis", "ea": 88000.0, "reversible": False},
    {"id": "amide_hydrolysis_base", "name": "Base Amide Hydrolysis", "ea": 84000.0, "reversible": False},
    {"id": "diels_alder_cycloaddition", "name": "Diels-Alder Cycloaddition", "ea": 70000.0, "reversible": True},
    {"id": "eas_nitration", "name": "Aromatic Nitration", "ea": 60000.0, "reversible": False},
    {"id": "eas_bromination", "name": "Aromatic Bromination", "ea": 65000.0, "reversible": False},
    {"id": "eas_chlorination", "name": "Aromatic Chlorination", "ea": 62000.0, "reversible": False},
    {"id": "eas_friedel_crafts_alkylation", "name": "Friedel-Crafts Alkylation", "ea": 68000.0, "reversible": False},
    {"id": "eas_friedel_crafts_acylation", "name": "Friedel-Crafts Acylation", "ea": 72000.0, "reversible": False},
    {"id": "ether_cleavage_hi", "name": "Ether Cleavage with HI", "ea": 82000.0, "reversible": False},
    {"id": "pinacol_rearrangement", "name": "Pinacol Rearrangement", "ea": 90000.0, "reversible": False},
    {"id": "radical_combustion", "name": "Radical Combustion", "ea": 125000.0, "reversible": False},
]

def generate_reaction_network_py(
    initial_concs: Dict[str, float],
    temp_k: float = 298.15,
    ph: float = 7.0,
    max_species: int = 200,
    max_rxns: int = 500,
    flux_threshold: float = 1e-8,
) -> Dict[str, Any]:
    """
    RMG-style candidate generation and rate-based expansion in Python.
    Enforces hard caps on active species and reactions.
    """
    active_species = set(initial_concs.keys())
    concs = dict(initial_concs)
    queue = list(initial_concs.keys())
    reactions = []
    seen = set()
    rejected = 0
    cap_reached = False
    total_flux = 0.0

    while queue:
        if len(active_species) >= max_species or len(reactions) >= max_rxns:
            cap_reached = True
            break
        sp = queue.pop()

        # Unimolecular checks
        if "tert" in sp and ("Cl" in sp or "Br" in sp):
            rxn_id = f"sn1_{sp}"
            if rxn_id not in seen:
                seen.add(rxn_id)
                k_fwd = 5e10 * math.exp(-90000.0 / (R_IDEAL * temp_k))
                flux = k_fwd * concs.get(sp, 0.0)
                if flux >= flux_threshold or len(reactions) < 5:
                    total_flux += flux
                    prod = f"{sp}_alcohol"
                    if prod not in active_species and len(active_species) < max_species:
                        active_species.add(prod)
                        concs[prod] = flux * 0.1
                        queue.append(prod)
                    reactions.append({
                        "id": rxn_id,
                        "equation": f"{sp} + H2O -> {prod} + HX",
                        "k_fwd": k_fwd,
                        "k_rev": 0.0,
                        "flux": flux
                    })

        # Bimolecular pairs with all known active species
        for other in list(active_species):
            if len(reactions) >= max_rxns:
                cap_reached = True
                break

            # SN2 / E2 matching
            is_hal = ("Br" in sp or "Cl" in sp or "bromo" in sp) and ("OH" not in sp)
            is_bas = ("OH" in other or "NaOH" in other or "oxide" in other or "NH3" in other or "BuO" in other)

            if is_hal and is_bas:
                bulky = "tert" in other or "BuO" in other
                k_sn2, k_e2, _ = sn2_e2_product_ratio("secondary", bulky, temp_k)
                k_sn2 = apply_diffusion_cap(k_sn2, temp_k)
                k_e2 = apply_diffusion_cap(k_e2, temp_k)

                for kind, k in [("sn2", k_sn2), ("e2", k_e2)]:
                    rid = f"{kind}_{sp}_{other}"
                    if rid not in seen:
                        seen.add(rid)
                        flux = k * concs.get(sp, 0.0) * concs.get(other, 0.0)
                        if flux >= flux_threshold or len(reactions) < 10:
                            total_flux += flux
                            prod = f"{sp}_{kind}_prod"
                            if prod not in active_species and len(active_species) < max_species:
                                active_species.add(prod)
                                concs[prod] = flux * 0.1
                                queue.append(prod)
                            reactions.append({
                                "id": rid,
                                "equation": f"{sp} + {other} -> {prod}",
                                "k_fwd": k,
                                "k_rev": 0.0,
                                "flux": flux
                            })
                        else:
                            rejected += 1

            # Ester hydrolysis
            is_est = "acetate" in sp or "benzoate" in sp or "COOC" in sp or "EtOAc" in sp
            is_wat = other in ("H2O", "OH-", "NaOH")
            if is_est and is_wat:
                rid = f"ester_hydr_{sp}_{other}"
                if rid not in seen:
                    seen.add(rid)
                    k = ester_hydrolysis_k_obs("ethyl_acetate", ph, temp_k)
                    flux = k * concs.get(sp, 0.0)
                    if flux >= flux_threshold or len(reactions) < 10:
                        total_flux += flux
                        p1 = f"{sp}_acid"
                        p2 = f"{sp}_alcohol"
                        for p in (p1, p2):
                            if p not in active_species and len(active_species) < max_species:
                                active_species.add(p)
                                concs[p] = flux * 0.1
                                queue.append(p)
                        reactions.append({
                            "id": rid,
                            "equation": f"{sp} + {other} -> {p1} + {p2}",
                            "k_fwd": k,
                            "k_rev": k / 10.0,  # reversible
                            "flux": flux
                        })

    return {
        "active_species": sorted(list(active_species)),
        "reactions": reactions,
        "cap_reached": cap_reached,
        "candidates_rejected": rejected,
        "total_flux": total_flux,
    }
