#!/usr/bin/env python3
"""NBS Tables (Wagman 1982) parser for Reaction Chamber (Stage 1 generalization).

Parses NBS digitised CSV / text rows:
formula, state -> identity keys, ΔfH°/ΔfG°/S°/Cp(298.15 K).
Emits SpeciesRecord components with tabulated tier and NBS citation.
"""

import csv
import re
from typing import Dict, Any, Optional

def parse_nbs_row(row: Dict[str, str]) -> Optional[Dict[str, Any]]:
    formula = row.get("formula", "").strip()
    if not formula:
        return None
    state = row.get("state", "cr").strip().lower() # cr, l, g, aq
    phase = "s" if state in ("cr", "s") else "l" if state == "l" else "g" if state == "g" else "aq"

    def parse_float(val: str) -> Optional[float]:
        if not val or val.strip() in ("-", "—", ""):
            return None
        try:
            return float(val.replace(",", "").strip())
        except ValueError:
            return None

    df_h = parse_float(row.get("delta_h_f", ""))
    df_g = parse_float(row.get("delta_g_f", ""))
    s = parse_float(row.get("s", ""))
    cp = parse_float(row.get("cp", ""))

    thermo: Dict[str, Any] = {
        "model": "point+cp",
        "tier": "tabulated",
        "source": "NBS Tables (Wagman 1982)"
    }
    if df_h is not None:
        thermo["dfH"] = {"value": df_h, "unit": "kJ/mol", "T_K": 298.15, "tier": "tabulated", "source": "NBS Tables"}
    if df_g is not None:
        thermo["dfG"] = {"value": df_g, "unit": "kJ/mol", "T_K": 298.15, "tier": "tabulated", "source": "NBS Tables"}
    if s is not None:
        thermo["S"] = {"value": s, "unit": "J/(mol K)", "T_K": 298.15, "tier": "tabulated", "source": "NBS Tables"}
    if cp is not None:
        thermo["cp"] = {"value": cp, "unit": "J/(mol K)", "T_K": 298.15, "tier": "tabulated", "source": "NBS Tables"}

    record_id = f"{phase}:{formula}"
    return {
        "id": record_id,
        "identity": {
            "formula": formula,
            "charge": 0,
            "names": [formula]
        },
        "phases": {
            phase: {"thermo": thermo}
        }
    }
