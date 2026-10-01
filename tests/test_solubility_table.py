"""The engine's data-driven solubility table is generated from pipeline/data/*.csv and must stay in sync."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

import build_solubility_table as bst  # noqa: E402


def test_generated_json_is_up_to_date():
    on_disk = json.loads((ROOT / "engine" / "data" / "solubility.json").read_text())
    assert on_disk == json.loads(json.dumps(bst.build())), "run python3 pipeline/build_solubility_table.py"


def test_table_rows_are_balanced_and_broad():
    data = bst.build()
    assert len(data["minerals"]) > 100
    formulas = {m["formula"] for m in data["minerals"]}
    for needed in ["AgCl", "AgBr", "AgI", "BaSO4", "CaCO3", "PbI2", "Fe(OH)3", "Ag2CrO4", "CuS"]:
        assert needed in formulas
    for m in data["minerals"]:
        z = sum(bst.ion_elements(i)[1] * n for i, n in m["dissolved_products"].items())
        assert abs(z) < 1e-9, m["formula"]
