"""
Joback group-contribution estimator over an RDKit molecule graph.

Predicts the normal boiling point, melting point, ideal-gas enthalpy / Gibbs energy of formation, heat-capacity
polynomial and (Trouton) heat of vaporisation of an arbitrary organic molecule from its structure. Every estimate is
labelled tier "estimated": it never overrides measured data.

The decomposition assigns **every heavy atom to exactly one of the 41 Joback groups**. Functional groups that span several
atoms (acid, ester, aldehyde, ketone, nitro, nitrile) claim all of their atoms first; the remaining atoms are classified
by element, hybridisation, hydrogen count and ring membership. A molecule with any heavy atom that no group covers (a
metal, a charged atom, a tertiary ring nitrogen ...) returns None: a Joback value from an incomplete decomposition is
not an estimate, it is wrong (pyridine used to read -57 K, DMSO -217 K).

Source of the parameters: Joback & Reid, Chem. Eng. Commun. 57 (1987) 233, as tabulated in Reid, Prausnitz & Poling,
"The Properties of Gases and Liquids", 4th ed. Boiling-point increments are the ones the accuracy gate checks; a few
rows (marked UNVERIFIED) were reconstructed and should be checked against the printed table when it is at hand.
"""

from typing import Any, Dict, List, Optional, Tuple

# Joback group parameters: group_name -> (Tb, Tm, dHf, dGf, a, b, c, d)
# Tb, Tm contributions in K; dHf, dGf in kJ/mol; Cp coefficients: Cp = a + bT + cT^2 + dT^3 (J/mol-K) after the
# -37.93 / +0.210 / -3.91e-4 / +2.06e-7 offsets applied in `estimate_properties_from_groups`.
JOBACK_GROUPS: Dict[str, Tuple[float, ...]] = {
    # Non-ring carbons
    "-CH3": (23.58, -5.10, -76.45, -43.96, 1.95e1, -8.08e-3, 1.53e-4, -9.67e-8),
    "-CH2-": (22.88, 11.27, -20.64, 8.42, -9.09e-1, 9.50e-2, -5.44e-5, 1.19e-8),
    ">CH-": (21.74, 12.64, 29.89, 58.36, -2.30e1, 2.04e-1, -2.65e-4, 1.20e-7),
    ">C<": (18.25, 46.43, 82.23, 116.02, -6.62e1, 4.27e-1, -6.41e-4, 3.01e-7),
    "=CH2": (18.18, -4.32, -9.63, 3.77, -4.14e0, 7.82e-2, -4.96e-5, 1.21e-8),
    "=CH-": (24.96, 8.73, 37.97, 48.53, -2.14e1, 1.77e-1, -2.12e-4, 9.45e-8),
    "=C<": (24.14, 11.14, 83.99, 92.36, -8.25e0, 1.01e-1, -1.42e-4, 6.78e-8),
    "=C=": (26.15, 17.78, 142.14, 136.70, 2.74e1, -5.57e-2, 1.01e-4, -5.02e-8),
    "#CH": (9.20, -11.18, 79.30, 77.71, 2.45e1, -2.71e-2, 1.11e-4, -6.78e-8),
    "#C-": (27.38, 64.32, 115.34, 109.82, 7.87, 2.01e-2, -8.33e-6, 1.39e-9),

    # Ring carbons
    "-CH2- (ring)": (27.15, 7.75, -26.80, -3.68, -6.03e0, 8.54e-2, -8.00e-6, -1.80e-8),
    ">CH- (ring)": (21.78, 19.88, 8.67, 40.99, -2.05e1, 1.62e-1, -1.60e-4, 6.24e-8),
    ">C< (ring)": (21.32, 60.15, 79.72, 87.88, -9.09e1, 5.57e-1, -9.00e-4, 4.69e-7),
    "=CH- (ring)": (26.73, 8.13, 2.09, 11.30, -2.14e0, 5.74e-2, -1.64e-6, -1.59e-8),
    "=C< (ring)": (31.01, 37.02, 46.43, 54.05, -8.25e0, 1.01e-1, -1.42e-4, 6.78e-8),  # UNVERIFIED Cp

    # Halogens
    "-F": (-0.03, -15.78, -251.92, -247.19, 2.65e1, -9.13e-2, 1.91e-4, -1.03e-7),
    "-Cl": (38.13, 13.55, -71.55, -64.31, 3.33e1, -9.63e-2, 1.87e-4, -9.96e-8),
    "-Br": (66.86, 43.43, -29.48, -38.06, 2.86e1, -6.49e-2, 1.36e-4, -7.45e-8),
    "-I": (93.84, 41.69, 21.06, 5.74, 3.21e1, -6.41e-2, 1.26e-4, -6.87e-8),

    # Oxygen groups
    "-OH (alcohol)": (92.88, 44.45, -208.04, -189.20, 2.57e1, -6.91e-2, 1.77e-4, -9.88e-8),
    "-OH (phenol)": (76.34, 82.83, -221.65, -197.37, -2.81e0, 1.11e-1, -1.16e-4, 4.94e-8),
    "-O- (non-ring)": (22.42, 22.23, -132.22, -105.00, 2.55e1, -6.32e-2, 1.11e-4, -5.48e-8),
    "-O- (ring)": (31.22, 23.05, -138.16, -98.22, 1.22e1, -1.26e-2, 6.03e-5, -3.86e-8),
    ">C=O (non-ring)": (76.75, 61.20, -133.22, -120.50, 6.45e0, 6.70e-2, -3.57e-5, 2.86e-9),
    ">C=O (ring)": (94.97, 75.97, -164.50, -126.27, 3.04e1, -8.29e-2, 2.36e-4, -1.31e-7),
    "O=CH- (aldehyde)": (72.24, 36.90, -162.03, -143.48, 3.09e1, -3.36e-2, 1.60e-4, -9.88e-8),
    "-COOH (acid)": (169.09, 155.50, -426.72, -387.87, 2.41e1, 4.27e-2, 8.04e-5, -6.87e-8),
    "-COO- (ester)": (81.10, 53.60, -337.92, -301.95, 2.45e1, 4.02e-2, 4.02e-5, -4.52e-8),
    "=O (other)": (-10.50, 2.08, -247.61, -250.83, 6.82e0, 1.96e-2, 1.27e-5, -1.78e-8),

    # Nitrogen groups
    "-NH2": (73.23, 66.89, -22.02, 14.07, 2.69e1, -4.12e-2, 1.64e-4, -9.76e-8),
    ">NH (non-ring)": (50.17, 52.66, 53.47, 89.39, -1.21e0, 7.62e-2, -4.86e-5, 1.05e-8),
    ">NH (ring)": (52.82, 101.51, 31.65, 75.61, 1.18e1, -2.30e-2, 1.07e-4, -6.28e-8),
    ">N- (non-ring)": (11.74, 48.84, 123.34, 163.16, -3.11e1, 2.27e-1, -3.20e-4, 1.46e-7),
    "-N= (non-ring)": (74.60, 0.0, 23.61, 0.0, 0.0, 0.0, 0.0, 0.0),  # UNVERIFIED (no Tm/Gf/Cp published)
    "-N= (ring)": (57.55, 68.40, 55.52, 79.93, 8.83e0, -3.84e-3, 4.35e-5, -2.60e-8),
    "=NH": (83.08, 68.91, 93.70, 119.66, 5.69e0, -4.12e-3, 1.28e-4, -8.88e-8),
    "-CN": (125.66, 59.89, 88.43, 89.22, 3.65e1, -7.33e-2, 1.84e-4, -1.03e-7),
    "-NO2": (152.54, 127.24, -66.57, -16.83, 2.59e1, -3.74e-3, 1.29e-4, -8.88e-8),

    # Sulfur
    "-SH": (63.56, 20.09, -17.33, -22.99, 3.53e1, -7.58e-2, 1.85e-4, -1.03e-7),
    "-S- (non-ring)": (68.78, 34.40, 41.87, 33.12, 1.96e1, -5.61e-3, 4.02e-5, -2.76e-8),
    "-S- (ring)": (52.10, 79.93, 39.10, 27.76, 1.67e1, 4.81e-3, 2.77e-5, -2.11e-8),
}

# Heavy atoms each group stands for (1 unless listed): lets callers check that a decomposition covers every heavy atom.
ATOMS_PER_GROUP: Dict[str, int] = {
    "-COOH (acid)": 3,
    "-COO- (ester)": 3,
    "O=CH- (aldehyde)": 2,
    ">C=O (non-ring)": 2,
    ">C=O (ring)": 2,
    "-CN": 2,
    "-NO2": 3,
}

# Backwards-compatible alias used by older callers
_LEGACY_NAMES = {">N-": ">N- (non-ring)", "-CHO (aldehyde)": "O=CH- (aldehyde)"}


def _heavy_atoms(mol) -> List[int]:
    return [a.GetIdx() for a in mol.GetAtoms() if a.GetAtomicNum() > 1]


def decompose_smiles_to_groups(smiles: str) -> Optional[Dict[str, int]]:
    """Decomposes `smiles` into Joback groups with every heavy atom assigned once, or returns None when the molecule
    cannot be fully covered (unknown element, charged atom, tertiary ring nitrogen, ...)."""
    from rdkit import Chem

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    mol = Chem.AddHs(mol)  # explicit hydrogens make the per-atom H counts reliable
    assigned: Dict[int, str] = {}
    counts: Dict[str, int] = {}

    def claim(atoms: Tuple[int, ...], group: str) -> bool:
        if any(a in assigned for a in atoms):
            return False
        for a in atoms:
            assigned[a] = group
        counts[group] = counts.get(group, 0) + 1
        return True

    def matches(smarts: str):
        q = Chem.MolFromSmarts(smarts)
        return mol.GetSubstructMatches(q)

    def h_count(idx: int) -> int:
        return sum(1 for n in mol.GetAtomWithIdx(idx).GetNeighbors() if n.GetAtomicNum() == 1)

    def in_ring(idx: int) -> bool:
        return mol.GetAtomWithIdx(idx).IsInRing()

    # ---- multi-atom functional groups, most specific first
    for m in matches("[CX3](=[OX1])[OX2H1]"):  # carboxylic acid: C, =O, OH
        claim((m[0], m[1], m[2]), "-COOH (acid)")
    for m in matches("[CX3](=[OX1])[OX2H0][#6]"):  # ester: C(=O)O (the alkyl carbons are separate groups)
        claim((m[0], m[1], m[2]), "-COO- (ester)")
    for m in matches("[$([NX3](=O)=O),$([NX3+](=O)[O-])]"):  # nitro: claim N and both O
        n_atom = m[0]
        o_atoms = tuple(nb.GetIdx() for nb in mol.GetAtomWithIdx(n_atom).GetNeighbors() if nb.GetAtomicNum() == 8)
        claim((n_atom,) + o_atoms, "-NO2")
    for m in matches("[CX2]#[NX1]"):  # nitrile
        claim((m[0], m[1]), "-CN")
    for m in matches("[CX3;H1,H2](=[OX1])"):  # aldehyde (formaldehyde included)
        claim((m[0], m[1]), "O=CH- (aldehyde)")
    for m in matches("[CX3;!$(C(=O)[OX2H1]);!$(C(=O)[OX2H0][#6])](=[OX1])"):  # ketone / amide / urea carbonyl
        claim((m[0], m[1]), ">C=O (ring)" if in_ring(m[0]) else ">C=O (non-ring)")
    for m in matches("[OX1;!$([OX1][#6X3]);!$([OX1]~[#7+]);!$([OX1]=[#7])]=*"):  # S=O, P=O, ...: "=O (other)"
        claim((m[0],), "=O (other)")

    # ---- remaining atoms, by element
    for atom in mol.GetAtoms():
        idx = atom.GetIdx()
        z = atom.GetAtomicNum()
        if z == 1 or idx in assigned:
            continue
        h = h_count(idx)
        ring = atom.IsInRing()
        arom = atom.GetIsAromatic()
        if atom.GetFormalCharge() != 0:
            return None  # ions are outside the method
        if z == 6:
            n_double = sum(1 for b in atom.GetBonds() if b.GetBondType() == Chem.BondType.DOUBLE)
            n_triple = sum(1 for b in atom.GetBonds() if b.GetBondType() == Chem.BondType.TRIPLE)
            if n_triple:
                claim((idx,), "#CH" if h == 1 else "#C-")
            elif n_double == 2:
                claim((idx,), "=C=")
            elif arom or n_double == 1:
                if ring:
                    claim((idx,), "=CH- (ring)" if h == 1 else "=C< (ring)")
                else:
                    claim((idx,), "=CH2" if h == 2 else "=CH-" if h == 1 else "=C<")
            else:  # sp3
                if ring:
                    claim((idx,), "-CH2- (ring)" if h == 2 else ">CH- (ring)" if h == 1 else ">C< (ring)")
                else:
                    claim((idx,), "-CH3" if h == 3 else "-CH2-" if h == 2 else ">CH-" if h == 1 else ">C<")
        elif z == 8:
            if h == 1:
                bonded_aromatic = any(n.GetIsAromatic() for n in atom.GetNeighbors())
                claim((idx,), "-OH (phenol)" if bonded_aromatic else "-OH (alcohol)")
            elif h == 0 and atom.GetDegree() == 2:
                claim((idx,), "-O- (ring)" if ring else "-O- (non-ring)")
            else:
                return None
        elif z == 7:
            n_double = sum(1 for b in atom.GetBonds() if b.GetBondType() == Chem.BondType.DOUBLE)
            if arom:
                if h == 1:
                    claim((idx,), ">NH (ring)")
                elif atom.GetDegree() == 2:
                    claim((idx,), "-N= (ring)")
                else:
                    return None  # substituted aromatic N (pyrrole N-alkyl, ...): not a Joback group
            elif n_double == 1:
                if h == 1:
                    claim((idx,), "=NH")
                elif ring:
                    claim((idx,), "-N= (ring)")
                else:
                    claim((idx,), "-N= (non-ring)")
            else:
                if h == 2:
                    claim((idx,), "-NH2")
                elif h == 1:
                    claim((idx,), ">NH (ring)" if ring else ">NH (non-ring)")
                elif h == 0 and not ring:
                    claim((idx,), ">N- (non-ring)")
                else:
                    return None  # tertiary ring nitrogen: no Joback group
        elif z == 9:
            claim((idx,), "-F")
        elif z == 17:
            claim((idx,), "-Cl")
        elif z == 35:
            claim((idx,), "-Br")
        elif z == 53:
            claim((idx,), "-I")
        elif z == 16:
            if h == 1:
                claim((idx,), "-SH")
            else:
                claim((idx,), "-S- (ring)" if ring else "-S- (non-ring)")
        else:
            return None  # element outside the method

    # every heavy atom must be covered
    if any(i not in assigned for i in _heavy_atoms(mol)):
        return None
    return counts


def estimate_properties_from_groups(groups: Dict[str, int]) -> Dict[str, Any]:
    """Computes Joback estimates given a dictionary of group counts."""
    sum_tb = sum_tm = sum_hform = sum_gform = 0.0
    sum_a = sum_b = sum_c = sum_d = 0.0

    for group, count in groups.items():
        group = _LEGACY_NAMES.get(group, group)
        if group not in JOBACK_GROUPS:
            raise KeyError(f"unknown Joback group {group!r}")
        tb, tm, hform, gform, a, b, c, d = JOBACK_GROUPS[group]
        sum_tb += count * tb
        sum_tm += count * tm
        sum_hform += count * hform
        sum_gform += count * gform
        sum_a += count * a
        sum_b += count * b
        sum_c += count * c
        sum_d += count * d

    tb_k = 198.0 + sum_tb          # Tb = 198 + sum(dTb)
    tm_k = 122.0 + sum_tm          # Tm = 122 + sum(dTm)
    dhf_kj = 68.29 + sum_hform     # kJ/mol, ideal gas, 298 K
    dgf_kj = 53.88 + sum_gform
    # Trouton: dHvap ~ 88 J/(mol K) * Tb (an estimate, labelled as such)
    dh_vap_kj = 88.0 * tb_k / 1000.0

    return {
        "tb_k": round(tb_k, 2),
        "tb_c": round(tb_k - 273.15, 2),
        "tm_k": round(tm_k, 2),
        "tm_c": round(tm_k - 273.15, 2),
        "dhf_kj_mol": round(dhf_kj, 2),
        "dgf_kj_mol": round(dgf_kj, 2),
        "dh_vap_kj_mol": round(dh_vap_kj, 2),
        # Cp(T) = a + b T + c T^2 + d T^3, J/(mol K): returned as the list [a, b, c, d] (the web layer requires an array)
        "cp_coeffs": [
            round(sum_a - 37.93, 4),
            round(sum_b + 0.210, 5),
            round(sum_c - 3.91e-4, 7),
            round(sum_d + 2.06e-7, 9),
        ],
        "groups": groups,
        "tier": "estimated",
        "method": "Joback Group Contribution (RDKit atom assignment)",
    }


def estimate_for_smiles(smiles: str) -> Optional[Dict[str, Any]]:
    """Estimates physical and thermodynamic properties for a SMILES via the Joback method, or None when the decomposition
    does not cover every heavy atom (an incomplete decomposition is not an estimate)."""
    groups = decompose_smiles_to_groups(smiles)
    if not groups:
        return None
    return estimate_properties_from_groups(groups)
