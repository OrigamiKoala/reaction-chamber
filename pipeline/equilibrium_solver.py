"""
Reaction Chamber — Equilibrium and Basic Physics Solver (M3)
Implements Davies activity coefficients, aqueous acid-base speciation matching PHREEQC,
precipitation equilibria (Ksp), calorimetry mixing, and density layering.
"""
import math
from typing import Dict, Any, List, Optional, Tuple

R_IDEAL = 8.314462618  # J / (mol * K)
KW_298 = 1.008e-14
KSP_AGCL_298 = 1.77e-10

def kw_at_temp(temp_k: float = 298.15) -> float:
    """van 't Hoff temperature-dependent Kw with Delta H = 55.84 kJ/mol."""
    t = max(273.15, min(temp_k, 400.0))
    delta_h = 55840.0
    return KW_298 * math.exp((-delta_h / R_IDEAL) * (1.0 / t - 1.0 / 298.15))

def davies_gamma(z: int, ionic_strength: float, temp_k: float = 298.15) -> float:
    """Davies activity coefficient: log10(gamma) = -A * z^2 * (sqrt(I)/(1+sqrt(I)) - 0.3*I)."""
    if z == 0 or ionic_strength <= 1e-12:
        return 1.0
    i = max(0.0, ionic_strength)
    t = max(273.15, min(temp_k, 400.0))
    a = 0.5092 * (298.15 / t) ** 1.5
    sqrt_i = math.sqrt(i)
    term = (sqrt_i / (1.0 + sqrt_i)) - 0.3 * i
    log10_gamma = -a * (z ** 2) * term
    gamma = 10.0 ** log10_gamma
    return max(1e-4, min(gamma, 100.0))

def calc_ionic_strength(ions: List[Tuple[float, int]]) -> float:
    """I = 0.5 * sum(c_i * z_i^2)."""
    return 0.5 * sum(max(0.0, c) * (z ** 2) for c, z in ions if c > 0.0)

def solve_aqueous_equilibrium(
    temp_k: float = 298.15,
    c_strong_acid: float = 0.0,
    c_strong_base: float = 0.0,
    c_weak_acid: float = 0.0,
    pka_weak_acid: Optional[float] = None,
    c_weak_base: float = 0.0,
    pka_weak_base_conj: Optional[float] = None,
    c_diprotic_acid: float = 0.0,
    pkas_diprotic: Optional[List[float]] = None,
    c_triprotic_acid: float = 0.0,
    pkas_triprotic: Optional[List[float]] = None,
    c_ag_plus: float = 0.0,
    c_cl_minus: float = 0.0,
) -> Dict[str, Any]:
    """
    Solves aqueous equilibrium with Davies activities using monotonic pH root-finding.
    Supports strong/weak acids, weak bases, diprotic/triprotic polyprotics, and AgCl Ksp.
    """
    c_sa = max(0.0, c_strong_acid)
    c_sb = max(0.0, c_strong_base)
    c_wa = max(0.0, c_weak_acid)
    c_wb = max(0.0, c_weak_base)
    c_da = max(0.0, c_diprotic_acid)
    c_ta = max(0.0, c_triprotic_acid)
    c_ag = max(0.0, c_ag_plus)
    c_cl = max(0.0, c_cl_minus)
    t_k = max(273.15, min(temp_k, 400.0))

    kw = kw_at_temp(t_k)
    ionic_strength = 1e-4
    converged = False
    ph = 7.0

    for _ in range(35):
        gamma_1 = davies_gamma(1, ionic_strength, t_k)
        gamma_2 = davies_gamma(2, ionic_strength, t_k)
        gamma_3 = davies_gamma(3, ionic_strength, t_k)

        delta_strong = c_sb - c_sa

        def net_charge(p: float) -> float:
            a_h = 10.0 ** (-p)
            h_conc = a_h / gamma_1
            oh_conc = kw / (a_h * gamma_1)
            charge = delta_strong + h_conc - oh_conc

            if c_wa > 0.0 and pka_weak_acid is not None:
                ka = 10.0 ** (-pka_weak_acid)
                a_minus = c_wa * (ka / gamma_1) / (a_h + ka / gamma_1)
                charge -= a_minus

            if c_wb > 0.0 and pka_weak_base_conj is not None:
                ka_conj = 10.0 ** (-pka_weak_base_conj)
                bh_plus = c_wb * a_h / (a_h + ka_conj / gamma_1)
                charge += bh_plus

            if c_da > 0.0 and pkas_diprotic:
                ka1 = 10.0 ** (-pkas_diprotic[0])
                ka2 = 10.0 ** (-pkas_diprotic[1])
                d = a_h * a_h + a_h * ka1 / gamma_1 + (ka1 * ka2) / gamma_2
                ha_minus = c_da * (a_h * ka1 / gamma_1) / d
                a_2minus = c_da * (ka1 * ka2 / gamma_2) / d
                charge -= (ha_minus + 2.0 * a_2minus)

            if c_ta > 0.0 and pkas_triprotic:
                ka1 = 10.0 ** (-pkas_triprotic[0])
                ka2 = 10.0 ** (-pkas_triprotic[1])
                ka3 = 10.0 ** (-pkas_triprotic[2])
                d = (a_h ** 3) + (a_h ** 2) * ka1 / gamma_1 + a_h * (ka1 * ka2) / gamma_2 + (ka1 * ka2 * ka3) / gamma_3
                h2a_minus = c_ta * ((a_h ** 2) * ka1 / gamma_1) / d
                ha_2minus = c_ta * (a_h * ka1 * ka2 / gamma_2) / d
                a_3minus = c_ta * (ka1 * ka2 * ka3 / gamma_3) / d
                charge -= (h2a_minus + 2.0 * ha_2minus + 3.0 * a_3minus)

            return charge

        low_ph = -2.0
        high_ph = 16.0
        # Dynamic bracket expansion for extreme acid/base concentrations
        while net_charge(low_ph) < 0.0 and low_ph > -6.0:
            low_ph -= 2.0
        while net_charge(high_ph) > 0.0 and high_ph < 20.0:
            high_ph += 2.0

        for _ in range(54):
            mid_ph = 0.5 * (low_ph + high_ph)
            val = net_charge(mid_ph)
            if val > 0.0:
                low_ph = mid_ph
            else:
                high_ph = mid_ph

        ph = 0.5 * (low_ph + high_ph)
        a_h = 10.0 ** (-ph)
        h_plus = a_h / gamma_1
        oh_minus = kw / (a_h * gamma_1)

        ions: List[Tuple[float, int]] = [(h_plus, 1), (oh_minus, -1)]
        if c_sb > 0.0:
            ions.append((c_sb, 1))
        if c_sa > 0.0:
            ions.append((c_sa, -1))
        if c_wa > 0.0 and pka_weak_acid is not None:
            ka = 10.0 ** (-pka_weak_acid)
            ions.append((c_wa * (ka / gamma_1) / (a_h + ka / gamma_1), -1))
        if c_wb > 0.0 and pka_weak_base_conj is not None:
            ka_conj = 10.0 ** (-pka_weak_base_conj)
            ions.append((c_wb * a_h / (a_h + ka_conj / gamma_1), 1))
        if c_da > 0.0 and pkas_diprotic:
            ka1 = 10.0 ** (-pkas_diprotic[0])
            ka2 = 10.0 ** (-pkas_diprotic[1])
            d = a_h * a_h + a_h * ka1 / gamma_1 + (ka1 * ka2) / gamma_2
            ions.append((c_da * (a_h * ka1 / gamma_1) / d, -1))
            ions.append((c_da * (ka1 * ka2 / gamma_2) / d, -2))
        if c_ta > 0.0 and pkas_triprotic:
            ka1 = 10.0 ** (-pkas_triprotic[0])
            ka2 = 10.0 ** (-pkas_triprotic[1])
            ka3 = 10.0 ** (-pkas_triprotic[2])
            d = (a_h ** 3) + (a_h ** 2) * ka1 / gamma_1 + a_h * (ka1 * ka2) / gamma_2 + (ka1 * ka2 * ka3) / gamma_3
            ions.append((c_ta * ((a_h ** 2) * ka1 / gamma_1) / d, -1))
            ions.append((c_ta * (a_h * ka1 * ka2 / gamma_2) / d, -2))
            ions.append((c_ta * (ka1 * ka2 * ka3 / gamma_3) / d, -3))

        new_i = calc_ionic_strength(ions)
        if abs(new_i - ionic_strength) < 1e-7 * (ionic_strength + 1e-5):
            ionic_strength = new_i
            converged = True
            break
        ionic_strength = 0.5 * (ionic_strength + new_i)

    gamma_1 = davies_gamma(1, ionic_strength, t_k)
    a_h = 10.0 ** (-ph)
    h_plus = a_h / gamma_1
    oh_minus = kw / (a_h * gamma_1)

    species_mol_l: Dict[str, float] = {
        "H+": h_plus,
        "OH-": oh_minus,
    }
    if c_sb > 0.0:
        species_mol_l["Na+"] = c_sb
    if c_sa > 0.0:
        species_mol_l["Cl-"] = c_sa

    if c_wa > 0.0 and pka_weak_acid is not None:
        ka = 10.0 ** (-pka_weak_acid)
        a_min = c_wa * (ka / gamma_1) / (a_h + ka / gamma_1)
        species_mol_l["A-"] = a_min
        species_mol_l["HA"] = max(0.0, c_wa - a_min)

    if c_wb > 0.0 and pka_weak_base_conj is not None:
        ka_conj = 10.0 ** (-pka_weak_base_conj)
        bh_plus = c_wb * a_h / (a_h + ka_conj / gamma_1)
        species_mol_l["BH+"] = bh_plus
        species_mol_l["B"] = max(0.0, c_wb - bh_plus)

    # AgCl precipitation
    ag_eq, cl_eq, ppt_agcl = solve_agcl_precipitation(c_ag, c_cl, gamma_1, t_k)
    if c_ag > 0.0:
        species_mol_l["Ag+"] = ag_eq
    if c_cl > 0.0:
        species_mol_l["Cl_precip-"] = cl_eq

    tier = "estimated" if ionic_strength > 0.5 else "tabulated"

    return {
        "ph": round(ph, 4),
        "ionic_strength": ionic_strength,
        "gamma_1": gamma_1,
        "h_plus": h_plus,
        "oh_minus": oh_minus,
        "ag_eq": ag_eq,
        "cl_eq": cl_eq,
        "precipitate_agcl_mol_l": ppt_agcl,
        "species_mol_l": species_mol_l,
        "tier": tier,
        "converged": converged,
    }

def solve_agcl_precipitation(c_ag: float, c_cl: float, gamma_1: float, temp_k: float = 298.15) -> Tuple[float, float, float]:
    """Solves Ag+ + Cl- <=> AgCl(s) with Ksp using numerically stable quadratic root."""
    if c_ag <= 0.0 or c_cl <= 0.0:
        return max(0.0, c_ag), max(0.0, c_cl), 0.0
    t = max(273.15, min(temp_k, 400.0))
    g1 = max(1e-4, gamma_1)
    delta_h = 65500.0
    ksp = KSP_AGCL_298 * math.exp((-delta_h / R_IDEAL) * (1.0 / t - 1.0 / 298.15))
    iap = (g1 * c_ag) * (g1 * c_cl)
    if iap <= ksp:
        return c_ag, c_cl, 0.0

    ksp_eff = ksp / (g1 ** 2)
    b = -(c_ag + c_cl)
    c = c_ag * c_cl - ksp_eff
    disc = max(0.0, b * b - 4.0 * c)
    sqrt_disc = math.sqrt(disc)
    # Numerically stable formulation avoiding cancellation: xi = 2c / (-b + sqrt(disc))
    denom = -b + sqrt_disc
    if denom > 0.0:
        xi = 2.0 * c / denom
    else:
        xi = (-b - sqrt_disc) / 2.0
    xi = max(0.0, min(xi, min(c_ag, c_cl)))
    return max(0.0, c_ag - xi), max(0.0, c_cl - xi), xi

def titrate_strong_strong(vol_acid_ml: float, c_acid: float, c_base: float, max_titrant_ml: float, steps: int = 100, temp_k: float = 298.15) -> List[Dict[str, float]]:
    points = []
    for i in range(steps + 1):
        v_titrant = (i / steps) * max_titrant_ml
        v_tot = vol_acid_ml + v_titrant
        c_a = (vol_acid_ml * c_acid) / v_tot if v_tot > 0 else 0.0
        c_b = (v_titrant * c_base) / v_tot if v_tot > 0 else 0.0
        res = solve_aqueous_equilibrium(temp_k=temp_k, c_strong_acid=c_a, c_strong_base=c_b)
        points.append({"v_titrant": v_titrant, "ph": res["ph"], "ionic_strength": res["ionic_strength"]})
    return points

def titrate_weak_strong(vol_acid_ml: float, c_acid: float, pka: float, c_base: float, max_titrant_ml: float, steps: int = 100, temp_k: float = 298.15) -> List[Dict[str, float]]:
    points = []
    for i in range(steps + 1):
        v_titrant = (i / steps) * max_titrant_ml
        v_tot = vol_acid_ml + v_titrant
        c_a = (vol_acid_ml * c_acid) / v_tot if v_tot > 0 else 0.0
        c_b = (v_titrant * c_base) / v_tot if v_tot > 0 else 0.0
        res = solve_aqueous_equilibrium(temp_k=temp_k, c_weak_acid=c_a, pka_weak_acid=pka, c_strong_base=c_b)
        points.append({"v_titrant": v_titrant, "ph": res["ph"], "ionic_strength": res["ionic_strength"]})
    return points

def titrate_polyprotic(vol_acid_ml: float, c_acid: float, pkas: List[float], c_base: float, max_titrant_ml: float, steps: int = 100, temp_k: float = 298.15) -> List[Dict[str, float]]:
    points = []
    for i in range(steps + 1):
        v_titrant = (i / steps) * max_titrant_ml
        v_tot = vol_acid_ml + v_titrant
        c_a = (vol_acid_ml * c_acid) / v_tot if v_tot > 0 else 0.0
        c_b = (v_titrant * c_base) / v_tot if v_tot > 0 else 0.0

        if len(pkas) == 1:
            res = solve_aqueous_equilibrium(temp_k=temp_k, c_weak_acid=c_a, pka_weak_acid=pkas[0], c_strong_base=c_b)
        elif len(pkas) == 2:
            res = solve_aqueous_equilibrium(temp_k=temp_k, c_diprotic_acid=c_a, pkas_diprotic=pkas, c_strong_base=c_b)
        else:
            res = solve_aqueous_equilibrium(temp_k=temp_k, c_triprotic_acid=c_a, pkas_triprotic=pkas[:3], c_strong_base=c_b)

        points.append({"v_titrant": v_titrant, "ph": res["ph"], "ionic_strength": res["ionic_strength"]})
    return points

def mix_calorimetry(vol1_ml: float, temp1_k: float, vol2_ml: float, temp2_k: float) -> Tuple[float, float]:
    """Calculates liquid volume additivity and calorimetry temperature."""
    v1 = max(0.0, vol1_ml)
    v2 = max(0.0, vol2_ml)
    v_tot = v1 + v2
    if v_tot <= 0.0:
        return 0.0, temp1_k
    t_mix = (v1 * temp1_k + v2 * temp2_k) / v_tot
    return v_tot, t_mix

def determine_density_layering(phase1: str, rho1: float, phase2: str, rho2: float) -> Tuple[str, str]:
    """Returns (top_layer_name, bottom_layer_name) ordered by density."""
    if rho1 <= rho2:
        return phase1, phase2
    return phase2, phase1

def dissolve_solid_with_limit(
    added_moles: float,
    volume_liters: float,
    solubility_limit_mol_l: float,
) -> Tuple[float, float]:
    """Dissolves solid considering solubility limit. Returns (dissolved_moles, remaining_solid_moles)."""
    if volume_liters <= 0.0 or added_moles <= 0.0:
        return 0.0, max(0.0, added_moles)
    max_dissolvable = max(0.0, solubility_limit_mol_l) * volume_liters
    if added_moles <= max_dissolvable:
        return added_moles, 0.0
    return max_dissolvable, added_moles - max_dissolvable
