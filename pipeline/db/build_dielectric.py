#!/usr/bin/env python3
"""Static dielectric constants of pure liquids (ThermoML 'eps' category) -> engine/data/dielectric.json

Per compound (InChIKey): the median over all measurements of the relative permittivity at zero frequency between 283 and 313 K, each
moved to 298.15 K with the compound's own ln(eps) slope when it has three or more temperatures, else with the generic slope
(-4.6e-3 /K) of dielectric.rs; outliers (more than 25 % from the median) are dropped.  The earlier hand-typed values (recalled from
the CRC) stay only for compounds the data do not cover.
"""
import json
import math
import re
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "pipeline" / "cache" / "thermoml" / "eps.jsonl"
OUT = ROOT / "engine" / "data" / "dielectric.json"
GENERIC = -4.6e-3


def main():
    by = defaultdict(list)
    names = {}
    for line in open(SRC):
        r = json.loads(line)
        if "zero frequency" not in r["property"] or len(r["compounds"]) != 1 or r["T_K"] is None:
            continue
        c = r["compounds"][0]
        if not c.get("key") or not c.get("formula") or re.search(r"[+-]", c["formula"]):
            continue
        if not 283.0 <= r["T_K"] <= 313.0 or not 1.2 < r["value"] < 200:
            continue
        if r.get("P_kPa") is not None and r["P_kPa"] > 1000:
            continue
        by[c["key"]].append((r["T_K"], r["value"], r["doi"]))
        names[c["key"]] = c.get("name")
    old = json.loads(OUT.read_text())
    eps, count, slope = {}, {}, {}
    for k, pts in by.items():
        ts = sorted({round(t, 1) for t, _, _ in pts})
        s = GENERIC
        if len(ts) >= 3 and ts[-1] - ts[0] >= 10:
            x = [t - 298.15 for t, _, _ in pts]
            y = [math.log(v) for _, v, _ in pts]
            mx, my = statistics.fmean(x), statistics.fmean(y)
            den = sum((a - mx) ** 2 for a in x)
            if den > 0:
                s_fit = sum((a - mx) * (b - my) for a, b in zip(x, y)) / den
                if -2e-2 < s_fit < 0:
                    s = s_fit
        vals = [v * math.exp(-s * (t - 298.15)) for t, v, _ in pts]
        med = statistics.median(vals)
        keep = [v for v in vals if abs(v / med - 1) < 0.25] or vals
        eps[k] = round(statistics.median(keep), 3)
        count[k] = len(keep)
        if s != GENERIC:
            slope[k] = round(s, 5)
    hand = {k: v for k, v in old["eps"].items() if k not in eps and not k.startswith("_")}
    doc = {
        "model": old["model"],
        "tier": "tabulated",
        "source": "Median of the measured relative permittivities (zero frequency, 283-313 K, moved to 298.15 K) of the NIST/TRC ThermoML Archive (2020-09-30), one value per InChIKey; `n` is the number of measurements kept, `dlneps_dT` the compound's own slope where the data span 10 K or more. Entries listed under `hand` are the earlier CRC values recalled from memory, kept for compounds the archive does not cover. A liquid that is not listed gets a composition-based estimate labelled Speculative.",
        "T_K": 298.15,
        "eps": dict(sorted({**hand, **eps}.items())),
        "n": dict(sorted(count.items())),
        "dlneps_dT": dict(sorted(slope.items())),
        "hand": sorted(hand),
    }
    OUT.write_text(json.dumps(doc, indent=0) + "\n")
    print(len(eps), "compounds from ThermoML,", len(hand), "hand values kept,", len(slope), "own slopes")
    for k, v in old["eps"].items():
        if k in eps and abs(eps[k] / v - 1) > 0.1:
            print("  differs from the hand value:", names.get(k), v, "->", eps[k])


main()
