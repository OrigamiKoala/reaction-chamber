"""
Joback Group Contribution Estimator
Predicts Tb, Tm, dHf, dGf, and heat capacities from molecular structure.
"""
from typing import Dict, Any, List, Optional

# Joback group parameters: group_name -> (Tb, Tm, dHf, dGf, a, b, c, d)
# Values in: Tb (K), Tm (K), dHf (kJ/mol), dGf (kJ/mol), Cp coefficients (J/mol-K)
JOBACK_GROUPS = {
    "-CH3": (23.58, -5.10, -76.45, -43.96, 1.95e1, -8.08e-3, 1.53e-4, -9.67e-8),
    "-CH2-": (22.88, 11.27, -20.64, 8.42, -9.09e-1, 9.5e-2, -5.44e-5, 1.19e-8),
    ">CH-": (21.74, 12.64, 29.89, 58.36, -2.30e1, 2.04e-1, -2.65e-4, 1.20e-7),
    ">C<": (18.25, 46.43, 82.23, 116.02, -6.62e1, 4.27e-1, -6.41e-4, 3.01e-7),
    "=CH2": (18.18, -4.32, -9.63, 3.77, -4.14e0, 7.82e-2, -4.96e-5, 1.21e-8),
    "=CH-": (24.96, 8.73, 37.97, 48.53, -2.14e1, 1.77e-1, -2.12e-4, 9.45e-8),
    "=C<": (24.14, 11.14, 83.99, 92.36, -8.25e0, 2.36e-1, -3.15e-4, 1.57e-7),
    "-OH (alcohol)": (92.88, 44.45, -208.04, -189.20, 2.57e1, -6.91e-2, 1.77e-4, -9.88e-8),
    "-OH (phenol)": (76.34, 82.83, -221.65, -197.37, -2.81, 1.11e-1, -1.16e-4, 4.94e-8),
    "-O- (ether)": (22.42, 22.23, -132.22, -105.00, 2.55e1, -6.32e-2, 1.11e-4, -5.48e-8),
    ">C=O (ketone)": (76.75, 61.20, -133.22, -120.50, 6.45, 6.70e-2, -3.57e-5, 2.86e-9),
    "-CHO (aldehyde)": (72.24, 36.90, -113.90, -109.14, 3.09e1, -3.36e-2, 1.60e-4, -9.88e-8),
    "-COOH (acid)": (169.09, 155.50, -426.72, -387.87, 2.41e1, 4.27e-2, 8.04e-5, -6.87e-8),
    "-COO- (ester)": (81.10, 53.60, -337.92, -301.90, 2.45e1, 4.02e-2, 4.02e-5, -4.52e-8),
    "-NH2": (73.23, 66.89, -22.02, 14.05, 2.69e1, -4.12e-2, 1.64e-4, -9.76e-8),
    "-Cl": (38.13, 25.11, -71.55, -64.31, 3.33e1, -9.63e-2, 1.87e-4, -9.96e-8),
    "-Br": (66.86, 38.80, -29.08, -38.07, 2.86e1, -6.49e-2, 1.36e-4, -7.45e-8),
}

def estimate_properties_from_groups(groups: Dict[str, int]) -> Dict[str, Any]:
    """Computes Joback estimates given a dictionary of group counts."""
    sum_tb = 0.0
    sum_tm = 0.0
    sum_hform = 0.0
    sum_gform = 0.0
    sum_a = sum_b = sum_c = sum_d = 0.0

    for group, count in groups.items():
        if group in JOBACK_GROUPS:
            tb, tm, hform, gform, a, b, c, d = JOBACK_GROUPS[group]
            sum_tb += count * tb
            sum_tm += count * tm
            sum_hform += count * hform
            sum_gform += count * gform
            sum_a += count * a
            sum_b += count * b
            sum_c += count * c
            sum_d += count * d

    # Joback empirical equations:
    # Tb = 198.2 + sum(Tb)
    tb_k = 198.2 + sum_tb
    # Tm = 122.5 + sum(Tm)
    tm_k = 122.5 + sum_tm
    # dHf = 68.29 + sum(dHf) (kJ/mol)
    dhf_kj = 68.29 + sum_hform
    # dGf = 53.88 + sum(dGf) (kJ/mol)
    dgf_kj = 53.88 + sum_gform

    return {
        "tb_k": round(tb_k, 2),
        "tb_c": round(tb_k - 273.15, 2),
        "tm_k": round(tm_k, 2),
        "tm_c": round(tm_k - 273.15, 2),
        "dhf_kj_mol": round(dhf_kj, 2),
        "dgf_kj_mol": round(dgf_kj, 2),
        "cp_coeffs": {
            "a": round(sum_a - 37.93, 4),
            "b": round(sum_b + 0.210, 5),
            "c": round(sum_c - 3.91e-4, 7),
            "d": round(sum_d + 2.06e-7, 9)
        },
        "tier": "estimated",
        "method": "Joback group contribution"
    }

def estimate_for_smiles(smiles: str) -> Optional[Dict[str, Any]]:
    """Heuristic / SMARTS decomposition for common molecules."""
    # Mapping for common molecules
    known_group_maps = {
        "CCO": {"-CH3": 1, "-CH2-": 1, "-OH (alcohol)": 1}, # Ethanol
        "CO": {"-CH3": 1, "-OH (alcohol)": 1}, # Methanol
        "CC(=O)O": {"-CH3": 1, "-COOH (acid)": 1}, # Acetic acid
        "CC(=O)C": {"-CH3": 2, ">C=O (ketone)": 1}, # Acetone
        "CCC": {"-CH3": 2, "-CH2-": 1}, # Propane
        "CCCC": {"-CH3": 2, "-CH2-": 2}, # Butane
        "CCCCC": {"-CH3": 2, "-CH2-": 3}, # Pentane
        "CCCCCC": {"-CH3": 2, "-CH2-": 4}, # Hexane
        "CCOCC": {"-CH3": 2, "-CH2-": 2, "-O- (ether)": 1}, # Diethyl ether
        "CCOC(=O)C": {"-CH3": 2, "-CH2-": 1, "-COO- (ester)": 1}, # Ethyl acetate
        "CCl": {"-CH3": 1, "-Cl": 1}, # Chloromethane
        "CCCl": {"-CH3": 1, "-CH2-": 1, "-Cl": 1}, # Chloroethane
    }
    if smiles in known_group_maps:
        return estimate_properties_from_groups(known_group_maps[smiles])
    return None
