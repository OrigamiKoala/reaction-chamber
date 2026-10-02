#!/usr/bin/env python3
"""Test species record schema and invariant rejection of condition-dependent fields."""

import json
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parent.parent

def validate_record(rec: dict, schema: dict):
    # Check forbidden condition-dependent fields
    forbidden_fields = ["mp", "bp", "mp_c", "bp_c", "solubility", "density", "phase"]
    for f in forbidden_fields:
        if f in rec and rec[f] is not None:
            raise ValueError(f"Forbidden condition-dependent field '{f}' present")

    # Check required fields
    for req in schema.get("required", []):
        if req not in rec:
            raise ValueError(f"Missing required field: '{req}'")

    if not isinstance(rec["id"], str):
        raise ValueError("id must be string")
    if not isinstance(rec["identity"], dict):
        raise ValueError("identity must be dict")
    if "formula" not in rec["identity"]:
        raise ValueError("identity.formula is required")
    if "charge" not in rec["identity"]:
        raise ValueError("identity.charge is required")
    if not isinstance(rec["phases"], dict):
        raise ValueError("phases must be dict")

    # Check phase keys
    allowed_phases = {"g", "l", "s", "aq"}
    for p in rec["phases"]:
        if p not in allowed_phases:
            raise ValueError(f"Unknown phase key '{p}'")

def test_schema_rejects_plain_condition_fields():
    schema_path = ROOT / "docs" / "schema" / "species_record.schema.json"
    assert schema_path.exists(), "Schema file exists"
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    # Valid record
    valid_record = {
        "id": "ik:TEST-KEY-N",
        "identity": {
            "formula": "H2O",
            "charge": 0
        },
        "phases": {
            "l": {
                "thermo": {
                    "model": "point+cp",
                    "tier": "tabulated",
                    "source": "NBS Tables"
                }
            }
        },
        "points": [
            {"kind": "tb", "T_K": 373.15, "P_Pa": 101325, "tier": "tabulated", "source": "IAPWS"}
        ]
    }

    validate_record(valid_record, schema)

    # Verify rejection of plain mp, bp, solubility, density, phase
    forbidden_fields = ["mp", "bp", "mp_c", "bp_c", "solubility", "density", "phase"]
    for field in forbidden_fields:
        bad_record = dict(valid_record)
        bad_record[field] = 100.0
        with pytest.raises(ValueError):
            validate_record(bad_record, schema)

def test_core_shards_pass_schema():
    schema_path = ROOT / "docs" / "schema" / "species_record.schema.json"
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    core_dir = ROOT / "web" / "public" / "data" / "core"
    for shard_file in core_dir.glob("*.json"):
        if shard_file.name == "manifest.json":
            continue
        with open(shard_file, "r", encoding="utf-8") as f:
            records = json.load(f)
        for rec in records:
            validate_record(rec, schema)

if __name__ == "__main__":
    test_schema_rejects_plain_condition_fields()
    test_core_shards_pass_schema()
    print("Schema tests passed.")
