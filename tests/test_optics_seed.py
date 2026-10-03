"""Stage 10: the engine's optical seed rows are generated from pipeline/db/build_optics_seed.py (every row carries a tier and a
source). The colorimetry and spectra themselves are tested against the built engine (engine/tests/stage10.rs, tests/optics_tables.mjs),
never against a Python re-implementation."""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_builder():
    spec = importlib.util.spec_from_file_location("build_optics_seed", ROOT / "pipeline" / "db" / "build_optics_seed.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["build_optics_seed"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_seed_json_is_current():
    b = _load_builder()
    on_disk = json.loads((ROOT / "engine" / "data" / "optics_seed.json").read_text())
    assert on_disk == json.loads(json.dumps(b.out)), "run python3 pipeline/db/build_optics_seed.py"
    flame = json.loads((ROOT / "engine" / "data" / "flame_emitters.json").read_text())
    assert flame == json.loads(json.dumps(b.flame_out)), "run python3 pipeline/db/build_optics_seed.py"


def test_every_seed_row_has_tier_and_source():
    b = _load_builder()
    for sid, row in b.species.items():
        assert row.get("tier") and row.get("source"), sid


def test_no_row_derives_an_absorptivity_from_a_colour_word():
    b = _load_builder()
    for sid, row in b.species.items():
        # a colour phrase is a solid's measured colour, a band is an absorptivity: a row has bands from data or a colour, not one made of the other
        assert not ("bands" in row and "colour" in row), sid
