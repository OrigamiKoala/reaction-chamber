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
def _load_groups() -> Dict[str, Tuple[float, ...]]:
    """The group table is the engine's data file (one source for the Rust and the Python estimator)."""
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "engine" / "data" / "joback_groups.json"
    with open(path, encoding="utf-8") as fh:
        rows = json.load(fh)["groups"]
    return {r["group"]: (r["tb"], r["tm"], r["hf"], r["gf"], *r["cp"]) for r in rows}


JOBACK_GROUPS: Dict[str, Tuple[float, ...]] = _load_groups()

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
