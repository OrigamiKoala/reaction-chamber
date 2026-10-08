#!/usr/bin/env python3
"""Species coverage (X2 of docs/plans/data-acquisition-plan.md): builds engine/data/species_tabulated.json from the
OBIGT thermodynamic database of the CHNOSZ project (SUPCRT92 / SLOP98 / Shock-Helgeson 1988 / Berman 1988 / Wagman 1982 /
CODATA values, one consistent set; https://github.com/jedick/CHNOSZ, inst/extdata/OBIGT).

    pipeline/raw/obigt/*.csv  --(this script)-->  engine/data/species_tabulated.json

Rows: aqueous species (ions, ion pairs, complexes), crystalline solids (minerals and compounds, the most stable polymorph
per formula), gases, liquids; each with the standard enthalpy and Gibbs energy of formation at 298.15 K (kJ/mol), the
heat capacity at 298.15 K (J/(mol K); aqueous: the HKF value, solids: Maier-Kelley a + bT + c/T^2) and, for solids, the
density from the molar volume.  The engine derives the formation entropy from dfH and dfG.

Consistency policy (one number per datum, one consistent source per element): the species the engine's seed tables
already hold are compared with the OBIGT values; an element whose seeded ions disagree with OBIGT by more than 3 kJ/mol
(different literature conventions: Fe2+ / Fe3+ of NBS 1982 vs Shock-Helgeson 1988) is *not* extended from OBIGT, because
a species of such an element would be inconsistent with the redox couples already in the store.  The list is printed.

InChIKeys of neutral molecules that exist in more than one phase (needed for Henry-law exchange) come from PubChem by
name (cached in pipeline/cache/pubchem_inchikey.json).
"""
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import periodictable
from engine_elements import known_elements

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "pipeline" / "raw" / "obigt"
CACHE = ROOT / "pipeline" / "cache"
OUT = ROOT / "engine" / "data" / "species_tabulated.json"
CAL = 4.184
THRESHOLD_KJ = 3.0

ELEMENTS = known_elements()  # the engine's own periodic table (no Am, Cm, Np, Pu, Fr, Pa, Rn)


def num(v):
    try:
        x = float(v)
        return x if x == x else None
    except (TypeError, ValueError):
        return None


def _parse_plain(body):
    """element counts of a formula with nested parentheses (no charge, no dots)"""
    pos = 0

    def group():
        nonlocal pos
        out = {}
        while pos < len(body):
            c = body[pos]
            if c == "(":
                pos += 1
                inner = group()
                mm = re.match(r"\d+", body[pos:])
                mult = int(mm.group()) if mm else 1
                pos += len(mm.group()) if mm else 0
                for k, v in inner.items():
                    out[k] = out.get(k, 0) + v * mult
            elif c == ")":
                pos += 1
                return out
            else:
                mm = re.match(r"([A-Z][a-z]?)(\d*)", body[pos:])
                if not mm:
                    raise ValueError(f"bad formula {body!r}")
                out[mm.group(1)] = out.get(mm.group(1), 0) + (int(mm.group(2)) if mm.group(2) else 1)
                pos += len(mm.group())
        return out

    return group()


def parse_formula(f):
    """(element counts, charge) of a formula with nested parentheses, hydrate / double-oxide dots and a trailing charge"""
    f = f.replace("*", ".")
    charge = 0
    m = re.match(r"^(.*?)([+-])(\d*)$", f)
    if m and m.group(1):
        f = m.group(1)
        mag = int(m.group(3)) if m.group(3) else 1
        charge = mag if m.group(2) == "+" else -mag
    out = {}
    for part in f.split("."):
        mm = re.match(r"^(\d+)(.*)$", part)
        mult, rest = (int(mm.group(1)), mm.group(2)) if mm else (1, part)
        if (mm and mm.group(1).startswith("0")) or not rest:
            raise ValueError(f"fractional stoichiometry in {f!r}")
        for k, v in _parse_plain(rest).items():
            if v == 0:
                raise ValueError(f"fractional stoichiometry in {f!r}")
            out[k] = out.get(k, 0) + v * mult
    return out, charge


def molar_mass(el):
    return sum(periodictable.elements.symbol(k).mass * v for k, v in el.items())


def rows_of(name):
    p = RAW / name
    return list(csv.DictReader(open(p))) if p.exists() else []


def unit_factor(r):
    """energy units of a row: calories (SUPCRT-family rows) or joules (NEA / JANAF / later additions)"""
    return 1.0 if r.get("E_units", "cal").strip().upper() == "J" else CAL


def cp_of(r, state):
    k = unit_factor(r)
    cp = num(r["Cp"])
    if cp is None and state != "aq":
        a, b, c = num(r["a1.a"]), num(r["a2.b"]), num(r["a3.c"])
        if a is not None and r["model"] == "CGL":
            cp = a + (b or 0) * 298.15 + (c or 0) / 298.15 ** 2
    if cp is None or (cp == 0 and state != "aq"):
        return None
    return cp * k


_C_TWO = re.compile(r"C[adelmorsu]")


def is_organic(formula):
    masked = _C_TWO.sub("X", formula)
    return bool(re.search(r"C\d*H|CC|C\d*\(C|CH", masked)) or "Ac" in formula or "Lac" in formula


def clean(rows, state):
    out = []
    for r in rows:
        if r["state"] != state:
            continue
        g, h = num(r["G"]), num(r["H"])
        if g is None or h is None:
            continue
        formula = r["formula"]
        # organics (carbon bearing C-H or C-C bonds) and abbreviations: only the inorganic carbon / cyanide species stay
        if is_organic(formula):
            continue
        try:
            el, z = parse_formula(formula)
        except Exception:
            continue
        if not el or not set(el) <= ELEMENTS:
            continue
        out.append(dict(r=r, formula=formula, el=el, z=z, g=g * unit_factor(r) / 1000.0, h=h * unit_factor(r) / 1000.0, cp=cp_of(r, state), v=num(r["V"]), ref=r["ref1"], name=r["name"]))
    return out


def pubchem_inchikeys(names):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / "pubchem_inchikey.json"
    cache = json.loads(path.read_text()) if path.exists() else {}
    for n in names:
        if n in cache:
            continue
        url = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" + urllib.parse.quote(n) + "/property/InChIKey/JSON"
        try:
            d = json.load(urllib.request.urlopen(url, timeout=30))
            cache[n] = d["PropertyTable"]["Properties"][0]["InChIKey"]
        except Exception:
            cache[n] = None
        time.sleep(0.25)
    path.write_text(json.dumps(cache, indent=1))
    return cache


def build():
    seed_text = (ROOT / "engine" / "src" / "db" / "seed.rs").read_text()
    inorg = json.loads((ROOT / "engine" / "data" / "species_inorganic.json").read_text())
    core_ids = set(re.findall(r'make_\w+\("([^"]+)"', seed_text))
    inorg_ids = {r[0] for k in ("aq", "s", "l", "g") for r in inorg[k]}
    seeded = {}  # (formula-key) -> (dfH, dfG) for ions of the seed tables
    for m in re.finditer(r'make_aq\("([^"]+)", "[^"]+", (-?\d+), ([-\d.]+), ([-\d.]+)', seed_text):
        seeded[m.group(1)] = (float(m.group(3)), float(m.group(4)))
    for r in inorg["aq"]:
        seeded.setdefault(r[0], (r[3], r[4]))

    aq = clean(rows_of("inorganic_aq.csv"), "aq") + clean(rows_of("SLOP98-a.csv"), "aq") + clean(rows_of("SLOP98-b.csv"), "aq")
    cr = clean(rows_of("inorganic_cr.csv"), "cr") + clean(rows_of("SUPCRT92.csv"), "cr") + clean(rows_of("Berman_cr.csv"), "cr")
    gas = clean(rows_of("inorganic_gas.csv"), "gas")
    liq = clean(rows_of("inorganic_liq.csv"), "liq")

    # which elements disagree with the seeded values
    conflict_elements = {}
    for s in aq:
        sid = s["formula"]
        if sid in seeded:
            dh, dg = seeded[sid]
            if abs(dg - s["g"]) > THRESHOLD_KJ or abs(dh - s["h"]) > THRESHOLD_KJ:
                for e in s["el"]:
                    if e not in ("H", "O"):
                        conflict_elements.setdefault(e, []).append((sid, round(dg - s["g"], 1), round(dh - s["h"], 1)))
    print("elements left as seeded (conflicting conventions):", {k: v for k, v in conflict_elements.items()})

    gas_formulas = {s["formula"] for s in gas}
    liq_formulas = {s["formula"] for s in liq}

    def aq_id(s):
        f = s["formula"]
        if s["z"] == 0 and (f in gas_formulas or f in liq_formulas):
            return f + "(aq)"
        return f

    rows = []
    seen = set()

    def add(phase, s, sid, density=None):
        if sid in seen:
            return
        seen.add(sid)
        rows.append({
            "id": sid, "phase": phase, "formula": s["formula"].replace("*", "."), "charge": s["z"],
            "dfH": round(s["h"], 3), "dfG": round(s["g"], 3),
            "cp": round(s["cp"], 2) if s["cp"] is not None else None,
            "density": round(density, 4) if density else None,
            "ref": s["ref"],
        })

    skipped_conflict = []
    for s in aq:
        sid = aq_id(s)
        if sid in core_ids or s["formula"] in ("H2O", "H+", "e-"):
            continue
        if set(s["el"]) & set(conflict_elements) and sid not in inorg_ids:
            skipped_conflict.append(sid)
            continue
        if sid.replace("(aq)", "") in inorg_ids and sid not in inorg_ids and sid.endswith("(aq)"):
            pass
        add("aq", s, sid)
    # solids: most stable polymorph per formula
    best = {}
    for s in cr:
        key = tuple(sorted(s["el"].items()))
        if key in best and best[key]["g"] <= s["g"]:
            continue
        best[key] = s
    for key, s in best.items():
        f = s["formula"]
        sid = f.replace("*", ".") + "(s)"
        phase = "s"
        if f == "H2O":
            continue  # ice has its own record (fusion line, density, floating) in db/seed_phases.rs
        if f == "Hg":  # the reference state of mercury is the liquid
            sid, phase = "Hg(l)", "l"
        if sid in core_ids:
            continue
        if set(s["el"]) & set(conflict_elements) and sid not in inorg_ids:
            skipped_conflict.append(sid)
            continue
        dens = molar_mass(s["el"]) / s["v"] if s["v"] else None
        add(phase, s, sid, dens)
    for s in gas:
        sid = s["formula"] + "(g)"
        if sid in core_ids or s["formula"] == "H2O":
            continue
        add("g", s, sid)
    for s in liq:
        sid = s["formula"] + "(l)"
        if sid in core_ids or s["formula"] == "H2O":
            continue
        add("l", s, sid)
    print(f"skipped for conflicting conventions: {len(skipped_conflict)}", skipped_conflict[:30])

    # InChIKeys for molecules that exist in several phases (Henry exchange pairs them up)
    names = {}
    for s in gas + liq:
        names[s["formula"]] = s["name"]
    need = sorted({names[r["formula"]] for r in rows if r["charge"] == 0 and r["phase"] in ("g", "l", "aq") and r["formula"] in names})
    keys = pubchem_inchikeys(need)
    for r in rows:
        if r["charge"] == 0 and r["phase"] in ("g", "l", "aq") and r["formula"] in names:
            r["inchikey"] = keys.get(names[r["formula"]])
    return rows, conflict_elements


if __name__ == "__main__":
    rows, conflicts = build()
    doc = {
        "comment": "Standard formation enthalpy and Gibbs energy at 298.15 K (kJ/mol), heat capacity at 298.15 K (J/(mol K); null = not tabulated, the engine estimates it) and density (g/mL, from the molar volume) of inorganic species, from the OBIGT database of the CHNOSZ project (Dick 2019; SUPCRT92 Johnson et al. 1992, Shock & Helgeson 1988 and later HKF parameter papers, Berman 1988, Wagman 1982, CODATA). Generated by pipeline/db/build_engine_species.py; do not edit by hand. Elements whose seeded ions use another literature convention are listed in `left_as_seeded` and not extended.",
        "source": "OBIGT (CHNOSZ) thermodynamic database",
        "tier": "Tabulated",
        "left_as_seeded": {k: v[:6] for k, v in sorted(conflicts.items())},
        "rows": rows,
    }
    OUT.write_text(json.dumps(doc, indent=1) + "\n")
    from collections import Counter
    print("wrote", OUT, Counter(r["phase"] for r in rows))
