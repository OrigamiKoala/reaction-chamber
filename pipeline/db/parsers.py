#!/usr/bin/env python3
"""Parsers for NASA CEA, Wikidata, Solubilities, Optics, UNIFAC, and pKa."""

import json
from typing import Dict, Any, List

def parse_nasa_cea_record(name: str, intervals: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "id": f"g:{name}",
        "identity": {"formula": name, "charge": 0},
        "phases": {
            "g": {
                "thermo": {
                    "model": "nasa9",
                    "tier": "tabulated",
                    "source": "NASA CEA thermo.inp",
                    "ranges": intervals
                }
            }
        }
    }

def parse_wikidata_claim(prop_id: str, value: float, unit_qid: str, qid_to_si: Dict[str, float]) -> Dict[str, Any]:
    conversion = qid_to_si.get(unit_qid, 1.0)
    return {
        "property": prop_id,
        "value_si": value * conversion,
        "tier": "imported",
        "source": "Wikidata"
    }

def parse_solubility_point(solute_smiles: str, solvent_smiles: str, t_k: float, val_mol_kg: float) -> Dict[str, Any]:
    return {
        "kind": "solubility",
        "solvent": solvent_smiles,
        "T_K": t_k,
        "value": val_mol_kg,
        "unit": "mol/kg",
        "tier": "tabulated",
        "source": "BigSolDB / AqSolDB"
    }
