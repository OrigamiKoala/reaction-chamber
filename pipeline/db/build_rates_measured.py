#!/usr/bin/env python3
"""Builds engine/data/rates_measured.json from pipeline/data/rates_measured.csv (Section 3.1 of rates-from-data-plan.md).

Validation (any failure stops the build): required columns, kind in {organic, redox}, k > 0 and a known unit, RDKit parse of every
organic SMILES, a citation (source + table_or_page) on every row, `status` in {verified, recalled}, no duplicate reaction
(template, reactants, products, solvent class), a unique held-out flag. Unit conversions live here only.

Outputs
* engine/data/rates_measured.json: the rows the engine uses. Organic rows are compiled only when `status == verified` (a value
  that was not read from its source never overrides a template rule) and not held out. Redox rows are compiled with their
  `verification` ("verified" or "recalled"): a recalled redox law replaces only a Speculative Marcus estimate and is labelled so.
* engine/tests/fixtures/rates_held_out.json: the held-out organic rows. The engine never loads them; the harness
  (engine/tests/measured_rates.rs) compares what the rules estimate with them.

Never edit the JSON by hand.
"""
import csv
import json
import sys
from pathlib import Path

from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")
ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "pipeline" / "data" / "rates_measured.csv"
JSON_OUT = ROOT / "engine" / "data" / "rates_measured.json"
HELD_OUT_OUT = ROOT / "engine" / "tests" / "fixtures" / "rates_held_out.json"

REQUIRED_FIELDS = [
    "kind", "template", "reactants", "products", "k", "k_unit", "t_k",
    "ea_kj_mol", "ea_source", "orders", "solvent", "solvent_class",
    "ionic_strength_m", "medium", "ph_or_h_conc", "source", "table_or_page",
    "doi", "licence", "extracted_by", "checked_by", "held_out", "notes", "status", "value_basis",
]

UNITS = {
    "M^-1 s^-1": 1.0, "s^-1": 1.0, "M^-2 s^-1": 1.0, "M^-3 s^-1": 1.0,
    "M^-1 min^-1": 1 / 60.0, "min^-1": 1 / 60.0, "M^-2 min^-1": 1 / 60.0,
    "M^-1 hr^-1": 1 / 3600.0, "hr^-1": 1 / 3600.0, "M^-1 d^-1": 1 / 86400.0, "d^-1": 1 / 86400.0,
    "10^3 M^-1 s^-1": 1e3, "10^6 M^-1 s^-1": 1e6, "10^9 M^-1 s^-1": 1e9,
}


def convert_k_to_si(k_val: float, unit: str) -> float:
    unit = unit.strip()
    if unit.startswith("log10_"):
        return 10.0 ** k_val
    if unit not in UNITS:
        raise ValueError(f"Unknown k_unit: {unit}")
    return k_val * UNITS[unit]


def parse_smiles_list(text: str) -> list:
    items = json.loads(text) if text.strip().startswith("[") else [x.strip() for x in text.split(";") if x.strip()]
    for s in items:
        if Chem.MolFromSmiles(s) is None:
            raise ValueError(f"Invalid SMILES string: '{s}'")
    return items


def main():
    if not CSV_PATH.exists():
        sys.exit(f"Error: {CSV_PATH} does not exist")
    organic, held_out_rows, redox = [], [], []
    seen = set()
    total = n_recalled_skipped = 0
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.DictReader(f), start=2):
            total += 1
            for field in REQUIRED_FIELDS:
                if field not in row:
                    raise ValueError(f"Line {i}: missing column '{field}'")
            kind, template = row["kind"].strip(), row["template"].strip()
            if kind not in ("organic", "redox"):
                raise ValueError(f"Line {i}: unknown kind '{kind}' (organic or redox; rate laws of fixed products are kinetic rows of core_reactions.json)")
            status = row["status"].strip()
            if status not in ("verified", "recalled"):
                raise ValueError(f"Line {i}: status must be verified or recalled, got '{status}'")
            k_raw = float(row["k"])
            if not k_raw > 0:
                raise ValueError(f"Line {i}: k must be positive")
            k_si = convert_k_to_si(k_raw, row["k_unit"])
            t_k = float(row["t_k"]) if row["t_k"].strip() else 298.15
            ea = float(row["ea_kj_mol"]) if row["ea_kj_mol"].strip() else None
            if ea is not None and ea < 0:
                raise ValueError(f"Line {i}: negative activation energy")
            source, page = row["source"].strip(), row["table_or_page"].strip()
            if not source or not page:
                raise ValueError(f"Line {i}: every row needs source and table_or_page")
            held_out = row["held_out"].strip().lower() in ("true", "1", "yes")
            solvent_class = row["solvent_class"].strip() or "water"
            orders = json.loads(row["orders"].strip()) if row["orders"].strip() else {}
            cite = f"{source} ({page})"
            dup_key = (kind, template, row["reactants"].strip(), row["products"].strip(), solvent_class)
            if dup_key in seen:
                raise ValueError(f"Line {i}: duplicate row {dup_key}")
            seen.add(dup_key)

            if kind == "organic":
                entry = {
                    "template": template or "*",
                    "reactants": parse_smiles_list(row["reactants"]),
                    "products": parse_smiles_list(row["products"]),
                    "k_m_s": k_si,
                    "t_k": t_k,
                    "ea_kj_mol": ea,
                    "solvent_class": solvent_class,
                    "terms": [{"k": k_si, "t_k": t_k, "ea_kj_mol": ea, "orders": orders}] if orders else [],
                    "source": cite,
                }
                if held_out:
                    held_out_rows.append(entry)
                elif status == "verified":
                    organic.append(entry)
                else:
                    n_recalled_skipped += 1
            else:
                parts = [x.strip() for x in row["reactants"].split(";") if x.strip()]
                if len(parts) != 2:
                    raise ValueError(f"Line {i}: redox reactants must be donor;acceptor")
                prods = [x.strip() for x in row["products"].split(";") if x.strip()]
                rate_of = parts[0]
                for token in row["notes"].split(";"):
                    if token.strip().startswith("rate_of="):
                        rate_of = token.split("=", 1)[1].strip()
                other = {k: v for k, v in orders.items() if k != "H+"}
                entry = {
                    "donor": parts[0], "donor_product": prods[0] if prods else "",
                    "acceptor": parts[1], "acceptor_product": prods[1] if len(prods) > 1 else "",
                    "rate_of": rate_of, "k_m_s": k_si, "t_k": t_k, "ea_kj_mol": ea,
                    "h_order": float(orders.get("H+", 0.0)),
                    "terms": [{"k": k_si, "t_k": t_k, "ea_kj_mol": ea, "orders": orders}] if other else [],
                    "source": cite,
                    "verification": status,
                }
                if not held_out:
                    redox.append(entry)

    JSON_OUT.write_text(json.dumps({
        "_comment": "Measured rate constants of whole reactions (engine/src/rate_data.rs). Generated by "
                    "pipeline/db/build_rates_measured.py from pipeline/data/rates_measured.csv; never edit by hand. Organic rows are "
                    "only those read from their source (status verified); redox rows carry their verification.",
        "organic": organic, "redox": redox}, indent=2) + "\n", encoding="utf-8")
    HELD_OUT_OUT.parent.mkdir(parents=True, exist_ok=True)
    HELD_OUT_OUT.write_text(json.dumps({"_comment": "Held-out organic rows: never loaded by the engine, only compared with the rules' estimates by the harness.",
                                        "organic": held_out_rows}, indent=2) + "\n", encoding="utf-8")
    print(f"Built {JSON_OUT.name}: {len(organic)} organic rows, {len(redox)} redox rows; {len(held_out_rows)} held-out organic rows in "
          f"{HELD_OUT_OUT.name}; {n_recalled_skipped} recalled organic rows not compiled (CSV rows: {total})")


if __name__ == "__main__":
    main()
