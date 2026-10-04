"""Offline checks of pipeline/validate_spectra.py (molfile parsing, SMILES writing). The database itself is not needed."""
import importlib.util
import os

spec = importlib.util.spec_from_file_location("validate_spectra", os.path.join(os.path.dirname(__file__), "..", "pipeline", "validate_spectra.py"))
vs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vs)

ETHANOL_MOLFILE = """
  CDKD

  3  2  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.2990    0.7500    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.5981    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
"""


def test_molfile_to_smiles_keeps_atoms_and_bonds():
    atoms, bonds = vs.parse_molfile(ETHANOL_MOLFILE)
    assert [a["el"] for a in atoms] == ["C", "C", "O"]
    assert bonds == [(0, 1, 1), (1, 2, 1)]
    smi, order = vs.to_smiles(atoms, bonds)
    assert smi == "CCO" and order == [0, 1, 2]


def _mk(elements, bonds):
    return [{"el": e, "chg": "0"} for e in elements], bonds


def test_branches_rings_and_multiple_bonds():
    assert vs.to_smiles(*_mk(["C"] * 4, [(0, 1, 1), (1, 2, 1), (1, 3, 1)]))[0] == "CC(C)C"
    assert vs.to_smiles(*_mk(["C", "C", "O", "O"], [(0, 1, 1), (1, 2, 2), (1, 3, 1)]))[0] == "CC(=O)O"
    ring = vs.to_smiles(*_mk(["C"] * 6, [(0, 1, 1), (1, 2, 2), (2, 3, 1), (3, 4, 2), (4, 5, 1), (5, 0, 2)]))[0]
    assert ring.count("1") == 2 and ring.count("=") == 3, ring


def test_unsupported_molecules_are_dropped_not_guessed():
    assert vs.to_smiles(*_mk(["C", "Si"], [(0, 1, 1)])) is None
    assert vs.to_smiles(*_mk(["C", "C", "C"], [(0, 1, 1), (1, 2, 4)])) is None, "aromatic bond type 4"
    assert vs.to_smiles([{"el": "N", "chg": "1"}, {"el": "C", "chg": "0"}], [(0, 1, 1)]) is None, "charged atom"
    assert vs.to_smiles(*_mk(["C", "C", "C", "C", "C", "C"], [(0, 1, 2), (0, 2, 2), (0, 3, 1), (0, 4, 1), (0, 5, 1)])) is None, "valence of five"
    assert vs.to_smiles(*_mk(["C", "C", "C"], [(0, 1, 1)])) is None, "disconnected"
