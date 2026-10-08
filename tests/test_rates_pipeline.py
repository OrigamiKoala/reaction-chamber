"""Measured-rate pipeline (docs/plans/rates-from-data-plan.md, section 3.1): the CSV is the source, the engine JSON and the held-out
fixture are generated from it, and nothing that was not read from its source reaches the engine as an organic rate."""
import csv
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline" / "db"))

CSV_PATH = ROOT / "pipeline" / "data" / "rates_measured.csv"
JSON_PATH = ROOT / "engine" / "data" / "rates_measured.json"
HELD_OUT_PATH = ROOT / "engine" / "tests" / "fixtures" / "rates_held_out.json"


def rows():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_every_row_is_cited_and_states_its_status():
    for i, r in enumerate(rows(), start=2):
        assert r["source"].strip() and r["table_or_page"].strip(), f"line {i}: uncited"
        assert r["status"] in ("verified", "recalled"), f"line {i}: status {r['status']!r}"
        assert float(r["k"]) > 0


def test_verified_organic_rows_name_a_table_of_the_source_not_a_guess():
    for r in rows():
        if r["kind"] == "organic":
            assert r["status"] == "verified", "the organic table holds only rows read from their source"
            assert r["table_or_page"].startswith("Table "), r["table_or_page"]


def test_engine_json_is_the_verified_non_held_out_part_of_the_csv():
    organic = [r for r in rows() if r["kind"] == "organic"]
    used = [r for r in organic if r["held_out"] != "True"]
    held = [r for r in organic if r["held_out"] == "True"]
    engine = json.loads(JSON_PATH.read_text())
    fixture = json.loads(HELD_OUT_PATH.read_text())
    assert len(engine["organic"]) == len(used)
    assert len(fixture["organic"]) == len(held)
    used_keys = {(e["template"], tuple(e["reactants"]), tuple(e["products"])) for e in engine["organic"]}
    held_keys = {(e["template"], tuple(e["reactants"]), tuple(e["products"])) for e in fixture["organic"]}
    assert not used_keys & held_keys, "a held-out row is also loaded into the engine"
    # roughly a quarter of the rows of a rule class are held out; the textbook rows are pinned into the training set
    assert 0.05 < len(held) / len(organic) < 0.35


def test_redox_rows_carry_their_verification():
    engine = json.loads(JSON_PATH.read_text())
    for r in engine["redox"]:
        assert r["verification"] in ("verified", "recalled")
        assert r["source"].strip()


def test_build_script_refuses_what_it_cannot_check():
    import build_rates_measured as b

    assert b.convert_k_to_si(6.0, "M^-1 min^-1") == pytest.approx(0.1)
    with pytest.raises(ValueError):
        b.convert_k_to_si(1.0, "furlongs per fortnight")
    with pytest.raises(ValueError):
        b.parse_smiles_list("CC(=O)O;not a smiles(")


def test_held_out_rows_are_not_in_the_engine_table_by_reaction():
    engine = json.loads(JSON_PATH.read_text())
    fixture = json.loads(HELD_OUT_PATH.read_text())
    used = {(e["template"], tuple(e["reactants"])) for e in engine["organic"]}
    for e in fixture["organic"]:
        assert (e["template"], tuple(e["reactants"])) not in used
