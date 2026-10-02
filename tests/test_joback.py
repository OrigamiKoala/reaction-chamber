"""Joback estimator over the RDKit graph (Stage 0.12): full coverage, no silent partial results, Cp as [a, b, c, d]."""
import pytest

rdkit = pytest.importorskip("rdkit")

from pipeline.joback_estimator import (
    ATOMS_PER_GROUP,
    JOBACK_GROUPS,
    decompose_smiles_to_groups,
    estimate_for_smiles,
    estimate_properties_from_groups,
)

# (name, SMILES, experimental normal boiling point in K: CRC Handbook of Chemistry and Physics)
MOLECULES = [
    ("ethanol", "CCO", 351.4),
    ("methanol", "CO", 337.7),
    ("1-propanol", "CCCO", 370.3),
    ("1-butanol", "CCCCO", 390.9),
    ("isopropanol", "CC(C)O", 355.4),
    ("acetone", "CC(=O)C", 329.2),
    ("2-butanone", "CCC(C)=O", 352.8),
    ("diethyl ether", "CCOCC", 307.6),
    ("tetrahydrofuran", "C1CCOC1", 339.1),
    ("ethyl acetate", "CCOC(=O)C", 350.2),
    ("methyl formate", "COC=O", 304.9),
    ("acetic acid", "CC(=O)O", 391.1),
    ("propanoic acid", "CCC(=O)O", 414.3),
    ("hexanoic acid", "CCCCCC(=O)O", 478.0),
    ("acetaldehyde", "CC=O", 293.3),
    ("formaldehyde", "C=O", 254.0),
    ("hexane", "CCCCCC", 341.9),
    ("cyclohexane", "C1CCCCC1", 353.9),
    ("cyclohexanol", "OC1CCCCC1", 434.0),
    ("benzene", "c1ccccc1", 353.2),
    ("toluene", "Cc1ccccc1", 383.8),
    ("phenol", "c1ccccc1O", 455.0),
    ("chlorobenzene", "Clc1ccccc1", 404.9),
    ("chloroform", "C(Cl)(Cl)Cl", 334.3),
    ("bromoethane", "CCBr", 311.5),
    ("ethanethiol", "CCS", 308.2),
    ("acetonitrile", "CC#N", 354.8),
    ("nitromethane", "C[N+](=O)[O-]", 374.4),
    ("pyridine", "c1ccncc1", 388.4),
    ("diethylamine", "CCNCC", 328.6),
    ("aniline", "c1ccccc1N", 457.5),
    ("1-hexene", "C=CCCCC", 336.6),
    # known weak spots of the method (amides, S=O, strong H-bond donors): included, not cherry-picked away
    ("dimethyl sulfoxide", "CS(=O)C", 462.0),
    ("acetamide", "CC(N)=O", 494.0),
]


def test_every_heavy_atom_is_assigned_to_a_group():
    from rdkit import Chem

    for name, smi, _ in MOLECULES:
        groups = decompose_smiles_to_groups(smi)
        assert groups, f"{name}: no decomposition"
        n_heavy = Chem.MolFromSmiles(smi).GetNumHeavyAtoms()
        covered = sum(c * ATOMS_PER_GROUP.get(g, 1) for g, c in groups.items())
        assert covered == n_heavy, f"{name}: groups cover {covered} of {n_heavy} heavy atoms: {groups}"
        assert all(g in JOBACK_GROUPS for g in groups), f"{name}: unknown group in {groups}"


def test_41_groups_are_defined():
    assert len(JOBACK_GROUPS) == 41


def test_tb_within_25_k_for_80_percent():
    errs = []
    for name, smi, tb in MOLECULES:
        est = estimate_for_smiles(smi)
        assert est is not None, name
        errs.append((name, est["tb_k"] - tb))
    good = [n for n, e in errs if abs(e) < 25.0]
    frac = len(good) / len(errs)
    bad = {n: round(e, 1) for n, e in errs if abs(e) >= 25.0}
    assert frac >= 0.80, f"{len(good)}/{len(errs)} within 25 K; outliers {bad}"


def test_uncovered_molecules_return_none_instead_of_a_wrong_number():
    # a metal, an ion, a tertiary ring nitrogen, a silane: not Joback groups
    for smi in ["[Na+].[Cl-]", "C[N+](C)(C)C", "CN1CCCC1", "C[Si](C)(C)C", "[Fe]"]:
        assert decompose_smiles_to_groups(smi) is None, smi
        assert estimate_for_smiles(smi) is None, smi


def test_ring_sp3_ch_and_nitrile_are_counted_once():
    g = decompose_smiles_to_groups("CC1CCCCC1")  # methylcyclohexane: one ring >CH-, five ring CH2, one CH3
    assert g == {"-CH3": 1, ">CH- (ring)": 1, "-CH2- (ring)": 5}
    g = decompose_smiles_to_groups("CC#N")  # acetonitrile: -CN (2 atoms) + CH3, not CN + #C-
    assert g == {"-CN": 1, "-CH3": 1}
    # no sp3 ring CH is read as an aromatic CH
    assert "=CH- (ring)" not in decompose_smiles_to_groups("OC1CCCCC1")


def test_formaldehyde_and_amide_carbonyls_are_covered():
    assert decompose_smiles_to_groups("C=O") == {"O=CH- (aldehyde)": 1}
    g = decompose_smiles_to_groups("NC(N)=O")  # urea: one carbonyl + two NH2
    assert g == {">C=O (non-ring)": 1, "-NH2": 2}


def test_cp_is_returned_as_four_coefficients_in_a_list():
    est = estimate_for_smiles("CCO")
    cp = est["cp_coeffs"]
    assert isinstance(cp, list) and len(cp) == 4
    # ethanol ideal-gas Cp(298 K) ~ 65.6 J/(mol K)
    t = 298.15
    val = cp[0] + cp[1] * t + cp[2] * t**2 + cp[3] * t**3
    assert 55.0 < val < 80.0, val
    assert est["tier"] == "estimated"


def test_group_dictionary_api_still_works():
    est = estimate_properties_from_groups({"-CH3": 1, "-CH2-": 1, "-OH (alcohol)": 1})
    assert abs(est["tb_k"] - 337.3) < 0.5
