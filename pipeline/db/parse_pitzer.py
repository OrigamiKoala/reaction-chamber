#!/usr/bin/env python3
"""Pitzer ion-interaction parameters with their temperature functions (P3 of docs/plans/data-acquisition-plan.md)
-> the `pitzer_binary` list of engine/data/ion_interactions.json.

Reads pipeline/raw/phreeqc/pitzer.dat (PHREEQC 3, USGS: Appelo 2015 high P,T parameter set built on Harvie-Moller-Weare 1984, Moller 1988, Pabalan & Pitzer 1987 and later work;
every row cites its reference in the file).  A binary parameter of PHREEQC is a function of temperature with up to six coefficients:

    p(T) = a1 + a2 (1/T - 1/Tr) + a3 ln(T/Tr) + a4 (T - Tr) + a5 (T^2 - Tr^2) + a6 (1/T^2 - 1/Tr^2),  Tr = 298.15 K

for beta0, beta1, beta2 (2:2 electrolytes) and C^phi.  The mixing parameters (theta, psi, lambda, zeta) are written to
engine/data/pitzer_mixing.json for the mixed-electrolyte terms (not used by the single-electrolyte activity model yet).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "pipeline" / "raw" / "phreeqc" / "pitzer.dat"
OUT = ROOT / "engine" / "data" / "ion_interactions.json"
MIX = ROOT / "engine" / "data" / "pitzer_mixing.json"


def charge(ion):
    m = re.search(r"([+-])(\d*)$", ion)
    if not m:
        return 0
    z = int(m.group(2)) if m.group(2) else 1
    return z if m.group(1) == "+" else -z


def main():
    section = None
    binary = {}  # (cat, an) -> {"b0": [...], ...}
    mix = {"theta": [], "psi": [], "lambda": [], "zeta": []}
    keys = {"-B0": "b0", "-B1": "b1", "-B2": "b2", "-C0": "c"}
    for raw in SRC.read_text(errors="replace").splitlines():
        line = raw.split("#")[0].rstrip()
        if not line.strip():
            continue
        tok = line.split()
        if line.startswith("-") or tok[0] in ("PITZER", "END", "SOLUTION_MASTER_SPECIES", "SOLUTION_SPECIES", "PHASES"):
            section = tok[0].upper() if tok[0].startswith("-") else None
            continue
        if section in keys:
            # ion1 ion2 a1 .. a6 (the ion names never contain blanks)
            nums = []
            names = []
            for t in tok:
                try:
                    nums.append(float(t))
                except ValueError:
                    names.append(t)
            if len(names) != 2:
                continue
            a, b = names
            za, zb = charge(a), charge(b)
            if za > 0 and zb < 0:
                cat, an = a, b
            elif za < 0 and zb > 0:
                cat, an = b, a
            else:
                continue
            binary.setdefault((cat, an), {})[keys[section]] = (nums + [0.0] * 6)[:6]
        elif section in ("-THETA", "-LAMDA", "-ZETA", "-PSI"):
            nums, names = [], []
            for t in tok:
                try:
                    nums.append(float(t))
                except ValueError:
                    names.append(t)
            kind = {"-THETA": "theta", "-LAMDA": "lambda", "-ZETA": "zeta", "-PSI": "psi"}[section]
            mix[kind].append({"species": names, "coefficients": (nums + [0.0] * 6)[:6]})
    rows = []
    for (cat, an), d in sorted(binary.items()):
        zc, za = charge(cat), -charge(an)
        two_two = zc >= 2 and za >= 2
        row = {"cation": cat, "anion": an, "alpha": 1.4 if two_two and "b2" in d else 2.0}
        if two_two and "b2" in d:
            row["alpha2"] = 12.0
        for k in ("b0", "b1", "b2", "c"):
            if k in d:
                row[k] = d[k]
        row["tier"] = "Tabulated"
        row["source"] = "PHREEQC pitzer.dat (USGS; Harvie-Moller-Weare 1984, Moller 1988, Pabalan & Pitzer 1987 and later updates)"
        rows.append(row)
    cur = json.loads(OUT.read_text())
    cur["pitzer_binary"] = rows
    cur["pitzer_temperature_function"] = "p(T) = a1 + a2 (1/T - 1/Tr) + a3 ln(T/Tr) + a4 (T - Tr) + a5 (T^2 - Tr^2) + a6 (1/T^2 - 1/Tr^2), Tr = 298.15 K, coefficients [a1..a6] of b0 (beta0), b1, b2, c (C^phi)"
    cur["_comment"] = cur["_comment"].replace("Pitzer binary parameters at 25 C (Pitzer & Mayorga 1973; Pitzer 1991: NaCl, KCl, HCl, CaCl2, NaOH, KNO3)", "Pitzer binary parameters with their temperature functions from PHREEQC pitzer.dat (see pitzer_temperature_function)")
    OUT.write_text(json.dumps(cur, indent=1) + "\n")
    MIX.write_text(json.dumps({"_comment": "Pitzer mixing parameters of PHREEQC pitzer.dat (theta: cation-cation / anion-anion, psi: triplets, lambda: neutral-ion, zeta: neutral-cation-anion), same temperature function as the binary ones. Not used by the single-electrolyte model yet.", "source": "PHREEQC pitzer.dat", "tier": "Tabulated", **mix}, indent=1) + "\n")
    print("binary pairs:", len(rows), "with b2:", sum("b2" in r for r in rows), "T-dependent:", sum(any(any(c != 0 for c in r[k][1:]) for k in ("b0", "b1", "b2", "c") if k in r) for r in rows))
    print({k: len(v) for k, v in mix.items()})


main()
