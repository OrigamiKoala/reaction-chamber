#!/usr/bin/env python3
"""pipeline/db/parse_unifac.py on a fixture excerpt (no network): subgroup rows, duplicate names, multi-line statements,
list-valued SMARTS, interaction rows restricted to the groups present, and the engine's committed table."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from pipeline.db import parse_unifac  # noqa: E402

FIX = ROOT / "tests" / "fixtures" / "unifac"


def _table():
    return parse_unifac.build_table((FIX / "unifac_excerpt.py").read_text(), (FIX / "original_ip_excerpt.tsv").read_text())


def test_subgroups_are_read_with_ast_not_regexes():
    t = _table()
    by_id = {s["id"]: s for s in t["subgroups"]}
    assert sorted(by_id) == [1, 2, 14, 16, 20, 26, 27]  # ids >= 2000 and DOUFSG rows are not original UNIFAC
    assert (by_id[1]["R"], by_id[1]["Q"], by_id[1]["h"], by_id[1]["main"]) == (0.9011, 0.848, 3, 1)
    assert by_id[14]["R"] == 1.0 and by_id[14]["smarts"] == ["[OX2;H1]"]  # multi-line statement with a trailing comment
    assert by_id[27]["smarts"] == ["[CX4;H2;R][OX2;R]", "[CX3;H1;R][OX2;R]"]  # list-valued SMARTS
    assert by_id[16]["h"] == 2


def test_duplicate_subgroup_names_are_made_unique():
    names = [s["name"] for s in _table()["subgroups"]]
    assert len(names) == len(set(names))
    assert "CHO" in names and "CHO#26" in names  # the aldehyde keeps the plain name, the ether gets its id


def test_interactions_are_limited_to_the_groups_present_and_kept_directional():
    t = _table()
    pairs = {(m, n): a for m, n, a in t["a_mn"]}
    assert pairs[(1, 5)] == 986.5 and pairs[(5, 1)] == 156.4  # a_mn != a_nm
    assert (1, 99) not in pairs  # group 99 has no subgroup in the excerpt
    assert t["tier"] == "tabulated" and "Hansen" in t["source"]
    assert t["main_groups"]["13"] == "CH2O"


def test_committed_engine_table_is_the_full_original_set():
    t = json.loads((ROOT / "engine" / "data" / "unifac_vle.json").read_text())
    assert len(t["subgroups"]) >= 100 and len(t["main_groups"]) >= 50
    ids = {s["id"] for s in t["subgroups"]}
    assert {1, 2, 9, 14, 15, 16, 18, 42} <= ids  # CH3, CH2, ACH, OH, CH3OH, H2O, CH3CO, COOH
    pairs = {(m, n): a for m, n, a in t["a_mn"]}
    assert abs(pairs[(1, 7)] - 1318.0) < 1e-9 and abs(pairs[(7, 1)] - 300.0) < 1e-9  # CH2-H2O, published
    assert abs(pairs[(1, 3)] - 61.13) < 1e-9


def test_liquid_liquid_set_is_a_second_directional_matrix_next_to_the_vle_one():
    t = parse_unifac.build_table((FIX / "unifac_excerpt.py").read_text(), (FIX / "original_ip_excerpt.tsv").read_text(), (FIX / "lle_ip_excerpt.tsv").read_text())
    lle = {(m, n): a for m, n, a in t["a_mn_lle"]}
    vle = {(m, n): a for m, n, a in t["a_mn"]}
    assert lle[(1, 7)] == 310.7 and vle[(1, 7)] == 1318.0  # CH2-H2O differs between the two published sets
    assert (7, 1) in lle and lle[(7, 1)] != lle[(1, 7)]
    # without the optional file the table simply has no LLE set
    assert parse_unifac.build_table((FIX / "unifac_excerpt.py").read_text(), (FIX / "original_ip_excerpt.tsv").read_text())["a_mn_lle"] == []


def test_committed_engine_table_carries_the_lle_set():
    t = json.loads((ROOT / "engine" / "data" / "unifac_vle.json").read_text())
    lle = {(m, n): a for m, n, a in t["a_mn_lle"]}
    assert len(lle) > 300 and abs(lle[(1, 7)] - 310.7) < 1e-9
