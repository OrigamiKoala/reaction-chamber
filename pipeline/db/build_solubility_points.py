#!/usr/bin/env python3
"""Mutual solubilities of water and organic liquids (ThermoML 'lle' category) -> engine/data/solubility_points.json

A liquid-liquid pair with an organic liquid X: (a) the solubility of X in the water-rich phase and (b) the solubility of water in the
X-rich phase, each a mole fraction at a temperature.  They become the engine's *activity points* (measured solubility = ln gamma at the
saturation mole fraction, `molecule.rs`): (a) is a point of X against solvent water, (b) a point of water against solvent X.  Used only
when the other phase is nearly pure (x of the dilute component <= 5e-3 in the water-rich phase), so the saturated phase has unit activity.

Per compound pair: all measurements within 278-318 K and below 1000 kPa from datasets that label both phases 'Liquid mixture n';
the value at 298.15 K is the median of ln x moved with the pair's own van 't Hoff slope (d ln x / d(1/T)) when three or more temperatures
exist (clamped to |slope| <= 4000 K), else the nearest-temperature value.
"""
import json
import math
import re
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "pipeline" / "cache" / "thermoml" / "lle.jsonl"
OUT = ROOT / "engine" / "data" / "solubility_points.json"
WATER = "XLYOFNOQVPJJNP-UHFFFAOYSA-N"
ALLOWED = {"C", "H", "N", "O", "F", "Cl", "Br", "I", "S"}


def ok(c):
    f = c.get("formula") or ""
    return bool(c.get("key")) and not re.search(r"[+-]", f) and set(re.findall(r"[A-Z][a-z]?", f)) <= ALLOWED


def main():
    # (doi, T, X) -> {"aq": x_X in water-rich phase, "org": x_water in X-rich phase}
    data = defaultdict(dict)
    names = {}
    for line in open(SRC):
        r = json.loads(line)
        if r["property"] != "Mole fraction" or len(r["compounds"]) != 2 or not r["phase"].startswith("Liquid mixture"):
            continue
        if r["T_K"] is None or not 278.0 <= r["T_K"] <= 318.0 or (r.get("P_kPa") is not None and r["P_kPa"] > 1000):
            continue
        c = r["compounds"]
        keys = [x.get("key") for x in c]
        if WATER not in keys or not all(ok(x) for x in c):
            continue
        ids = r["comp_ids"]
        pc = r.get("prop_comp")
        if pc not in ids:
            continue
        idx = ids.index(pc)
        other = c[1 - idx]
        comp = c[idx]
        v = r["value"]
        if not 0 < v < 1:
            continue
        if comp["key"] == WATER:
            X = other["key"]
            if v < 0.6:
                data[(r["doi"], round(r["T_K"], 2), X)]["org"] = v
        else:
            X = comp["key"]
            if v < 0.5:
                data[(r["doi"], round(r["T_K"], 2), X)]["aq"] = v
        names[comp["key"]] = comp.get("name")
        names[other["key"]] = other.get("name")
    pts = defaultdict(lambda: {"aq": [], "org": []})
    for (doi, T, X), d in data.items():
        aq = d.get("aq")
        org = d.get("org")
        aq_pure_water = aq is None or aq <= 5e-3
        if aq is not None and aq <= 5e-3 and (org is None or org <= 0.01 or True):
            pts[X]["aq"].append((T, aq, doi))
        if org is not None and aq_pure_water:
            pts[X]["org"].append((T, org, doi))

    def at_298(vals):
        T = [t for t, _, _ in vals]
        ln = [math.log(x) for _, x, _ in vals]
        slope = None
        if len({round(t, 0) for t in T}) >= 3 and max(T) - min(T) >= 8:
            u = [1.0 / t - 1.0 / 298.15 for t in T]
            mu, ml = statistics.fmean(u), statistics.fmean(ln)
            den = sum((a - mu) ** 2 for a in u)
            if den > 0:
                slope = sum((a - mu) * (b - ml) for a, b in zip(u, ln)) / den
                slope = max(-4000.0, min(4000.0, slope))
        moved = [l - (slope or 0.0) * (1.0 / t - 1.0 / 298.15) for l, t in zip(ln, T)]
        keep = moved
        med = statistics.median(moved)
        keep = [m for m in moved if abs(m - med) < 0.7] or moved  # within a factor of 2
        return math.exp(statistics.median(keep)), len(keep), len({d for _, _, d in vals}), slope

    out = {}
    for X, d in sorted(pts.items()):
        rows = []
        if d["aq"]:
            x, n, npap, slope = at_298(d["aq"])
            rows.append({"solute": X, "solvent": WATER, "x": float(f"{x:.4g}"), "T_K": 298.15, "n": n, "n_papers": npap, "dlnx_d_invT": None if slope is None else round(slope, 1)})
        if d["org"]:
            x, n, npap, slope = at_298(d["org"])
            rows.append({"solute": WATER, "solvent": X, "x": float(f"{x:.4g}"), "T_K": 298.15, "n": n, "n_papers": npap, "dlnx_d_invT": None if slope is None else round(slope, 1)})
        if rows:
            out[X] = {"name": names.get(X), "points": rows}
    doc = {"model": "Mutual solubility of water and an organic liquid X at 298.15 K as mole fractions: each point is a measured saturation of `solute` in `solvent` (the other phase being nearly pure), used as an activity point by molecule.rs",
           "tier": "tabulated",
           "source": "NIST/TRC ThermoML Archive (2020-09-30): liquid-liquid equilibria of binary water + organic mixtures with both phases labelled; median over datasets, moved to 298.15 K. Generated by pipeline/db/build_solubility_points.py.",
           "compounds": out}
    OUT.write_text(json.dumps(doc, indent=0) + "\n")
    na = sum(1 for v in out.values() for p in v["points"] if p["solvent"] == WATER)
    nb = sum(1 for v in out.values() for p in v["points"] if p["solute"] == WATER)
    print(len(out), "organic liquids;", na, "solubilities in water,", nb, "solubilities of water;", f"{OUT.stat().st_size/1e3:.0f} kB")
    for X in out:
        if names.get(X) in ("hexane", "heptane", "benzene", "toluene", "cyclohexane", "1-butanol", "chloroform", "diethyl ether"):
            print("  ", names[X], [(p["solute"] == WATER and "water in" or "in water", p["x"]) for p in out[X]["points"]])


main()
