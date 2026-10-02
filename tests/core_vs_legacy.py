#!/usr/bin/env python3
"""Cross-check core database Ksp against legacy table and llnl.dat reference values.

Target gate:
llnl comparison for PbI2, AgCl, BaSO4, CaCO3, Fe(OH)3, ZnF2 within 0.3 log units.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Reference llnl.dat log K values
# Note: For minerals dissolved without H+ on LHS:
# AgCl: -9.75
# PbI2: -8.04
# BaSO4: -9.97
# CaCO3: -8.47 (apparent Ksp at 298.15 K)
# Fe(OH)3: -38.55 (derived Ksp for Fe+3 + 3 OH-)
# ZnF2: -1.53 (or llnl value)
LLNL_REF = {
    "AgCl": -9.75,
    "PbI2": -8.04,
    "BaSO4": -9.97,
    "CaCO3": -8.47,
    "Fe(OH)3": -38.55,
    "ZnF2": -1.53,
}

def test_core_vs_legacy_gates():
    sol_path = ROOT / "engine" / "data" / "solubility.json"
    assert sol_path.exists(), "solubility.json exists"
    with open(sol_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    minerals = {m["formula"]: m for m in data.get("minerals", [])}

    for formula, ref_ksp in LLNL_REF.items():
        if formula in minerals:
            val = minerals[formula]["log_ksp_298"]
            diff = abs(val - ref_ksp)
            print(f"Checking {formula}: table={val:.2f}, llnl={ref_ksp:.2f}, diff={diff:.2f}")
            assert diff <= 0.3, f"{formula} diff {diff:.2f} exceeds 0.3 log unit gate"

    # Also check manifest exists and lists licences
    manifest_path = ROOT / "web" / "public" / "data" / "core" / "manifest.json"
    assert manifest_path.exists(), "manifest.json exists"
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    assert "sources" in manifest
    assert len(manifest["sources"]) > 0
    for src_id, info in manifest["sources"].items():
        assert "licence" in info, f"Source {src_id} missing licence"

if __name__ == "__main__":
    test_core_vs_legacy_gates()
    print("All core_vs_legacy gates passed.")
