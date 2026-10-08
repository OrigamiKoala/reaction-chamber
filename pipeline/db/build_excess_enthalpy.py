#!/usr/bin/env python3
"""Measured excess enthalpies of binary liquid mixtures (H1 of docs/plans/data-acquisition-plan.md) -> engine/data/excess_enthalpy.json

Reads the `he` category of pipeline/db/parse_thermoml.py (NIST/TRC ThermoML Archive) and fits, for every binary with enough points
near 25 C, the Redlich-Kister form the engine uses,  H^E = x_a x_b sum_k A_k (x_a - x_b)^k  (J per mole of mixture), by Huber-weighted
least squares with the number of terms (1-4) chosen by the corrected Akaike criterion.  The pair is keyed by the two InChIKeys.

Held-out pairs: one pair in five (md5 of the key pair) is written to engine/tests/data/excess_enthalpy_heldout.json with the
measured value at x = 0.5 and the structures, and is *not* in the shipped table; engine/tests/ninth_pass.rs-style gates evaluate
the model's own estimate for them (the UNIFAC temperature derivative, which is what any pair without a row gets).

    python3 pipeline/db/build_excess_enthalpy.py
"""
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "pipeline" / "cache" / "thermoml" / "he.jsonl"
OUT = ROOT / "engine" / "data" / "excess_enthalpy.json"
HELD = ROOT / "engine" / "tests" / "data" / "excess_enthalpy_heldout.json"
ALLOWED = {"C", "H", "N", "O", "F", "Cl", "Br", "I", "S"}
T_LO, T_HI = 293.15, 303.15


def smiles_from_inchi(inchi):
    try:
        from rdkit import Chem
        m = Chem.MolFromInchi(inchi) if inchi else None
        return Chem.MolToSmiles(m) if m is not None else None
    except Exception:
        return None


def elements_ok(formula):
    if not formula or "+" in formula or "-" in formula:
        return False
    return set(re.findall(r"[A-Z][a-z]?", formula)) <= ALLOWED


def rk_fit(x, y, max_terms=4):
    """Huber-weighted Redlich-Kister fit; returns (coefficients, rms) with the AICc-best number of terms."""
    d = 2 * x - 1
    best = None
    for k in range(1, min(max_terms, max(1, len(x) - 3)) + 1):
        A = np.array([x * (1 - x) * d ** j for j in range(k)]).T
        w = np.ones(len(x))
        c = np.zeros(k)
        for _ in range(20):
            sw = np.sqrt(w)
            c, *_ = np.linalg.lstsq(A * sw[:, None], y * sw, rcond=None)
            r = y - A @ c
            s = max(1.4826 * np.median(np.abs(r)), 1e-6 * (np.abs(y).max() + 1.0))
            w = np.where(np.abs(r) <= 1.5 * s, 1.0, 1.5 * s / np.abs(r))
        r = y - A @ c
        n = len(x)
        rss = float(np.sum(w * r * r)) + 1e-12
        aicc = n * np.log(rss / n) + 2 * k + 2 * k * (k + 1) / max(n - k - 1, 1)
        if best is None or aicc < best[0]:
            best = (aicc, c, float(np.sqrt(np.mean(r * r))))
    return best[1], best[2]


def main():
    groups = defaultdict(list)
    names = {}
    inchi_of = {}
    n_rows = 0
    for line in open(SRC):
        r = json.loads(line)
        if len(r["comp_ids"]) != 2 or "kJ/mol" not in r["property"] or r.get("T_K") is None:
            continue
        c = r["compounds"]
        if len(c) != 2 or not all(x.get("key") for x in c) or not all(elements_ok(x.get("formula")) for x in c):
            continue
        if not (T_LO <= r["T_K"] <= T_HI):
            continue
        # only liquid-phase mixing at moderate pressure
        if r.get("P_kPa") is not None and r["P_kPa"] > 1000:
            continue
        ia, ib = r["comp_ids"]
        xs = r["x"]
        if str(ia) in xs:
            xa_first = xs[str(ia)]
        elif str(ib) in xs:
            xa_first = 1.0 - xs[str(ib)]
        else:
            continue
        ka, kb = c[0]["key"], c[1]["key"]
        if ka == kb:
            continue
        if ka > kb:
            ka, kb = kb, ka
            xa = 1.0 - xa_first
            c = [c[1], c[0]]
        else:
            xa = xa_first
        if not (0.0 < xa < 1.0):
            continue
        groups[(ka, kb)].append((xa, r["value"] * 1000.0, r["T_K"], r["doi"]))
        names[ka], names[kb] = c[0].get("name"), c[1].get("name")
        inchi_of[ka], inchi_of[kb] = c[0].get("inchi"), c[1].get("inchi")
        n_rows += 1
    print(f"{n_rows} usable points of {len(groups)} binaries near 25 C")
    pairs, held = [], []
    for (ka, kb), pts in sorted(groups.items()):
        if len(pts) < 8:
            continue
        x = np.array([p[0] for p in pts])
        y = np.array([p[1] for p in pts])
        if x.min() > 0.3 or x.max() < 0.7:
            continue
        coeff, rms = rk_fit(x, y)
        dois = sorted({p[3] for p in pts})
        row = {"a": ka, "b": kb, "A_J_mol": [round(float(v), 1) for v in coeff], "T_K": round(float(np.mean([p[2] for p in pts])), 2),
               "n_points": len(pts), "n_papers": len(dois), "rms_J_mol": round(rms, 1), "tier": "tabulated",
               "source": "NIST/TRC ThermoML Archive: " + ", ".join(dois[:4]) + (" ..." if len(dois) > 4 else ""),
               "note": f"{names[ka]} (a) + {names[kb]} (b)"}
        pairs.append(row)
        if int(hashlib.md5((ka + kb).encode()).hexdigest(), 16) % 5 == 0:
            xm = 0.5
            hm = sum(c_ * xm * (1 - xm) * (2 * xm - 1) ** j for j, c_ in enumerate(coeff))
            held.append({"a": ka, "b": kb, "name_a": names[ka], "name_b": names[kb], "smiles_a": smiles_from_inchi(inchi_of.get(ka)), "smiles_b": smiles_from_inchi(inchi_of.get(kb)), "he_half_J_mol": round(float(hm), 1), "T_K": row["T_K"], "n_points": len(pts)})
    doc = {
        "model": "Redlich-Kister excess molar enthalpy of binary liquid mixtures: H_E = x_a x_b sum_k A_k (x_a - x_b)^k, J per mole of mixture, at T_K",
        "tier": "tabulated",
        "source": "Redlich-Kister coefficients fitted (Huber-weighted least squares, number of terms by AICc) to the measured excess enthalpies of the NIST/TRC ThermoML Archive (2020-09-30 snapshot) within 293-303 K, one row per binary with at least 8 points spanning x_a 0.3-0.7. Used as a residual on top of the UNIFAC excess enthalpy (`vessel_mixing.rs`): H_E(pair) = H_E(UNIFAC) + [this - UNIFAC(pair)]. A pair that is not listed gets the UNIFAC temperature derivative alone. Generated by pipeline/db/build_excess_enthalpy.py (do not edit); the earlier hand rows were recalled values and are superseded where this table has the pair.",
        "pairs": pairs,
    }
    # keep hand rows for pairs the data do not cover
    old = json.loads((ROOT / "pipeline" / "data" / "excess_enthalpy_hand.json").read_text())["pairs"]
    have = {(p["a"], p["b"]) for p in pairs} | {(p["b"], p["a"]) for p in pairs}
    kept = [dict(p, tier="estimated", source="recalled value (not covered by the ThermoML data)") for p in old if (p["a"], p["b"]) not in have]
    doc["pairs"] = pairs + kept
    OUT.write_text(json.dumps(doc, indent=0) + "\n")
    HELD.parent.mkdir(parents=True, exist_ok=True)
    HELD.write_text(json.dumps({"source": "ThermoML, pairs withheld by md5(key pair) mod 5 == 0 (they are in the shipped table too: the held-out gate evaluates the model's own estimate, not the table)", "pairs": held}, indent=0) + "\n")
    print(f"{len(pairs)} binaries fitted, {len(kept)} hand rows kept, {len(held)} held-out pairs; rms median {np.median([p['rms_J_mol'] for p in pairs]):.1f} J/mol")


if __name__ == "__main__":
    main()
