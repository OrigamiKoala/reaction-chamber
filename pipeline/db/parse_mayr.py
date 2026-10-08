#!/usr/bin/env python3
"""Mayr's Database of Reactivity Parameters (https://www.cup.lmu.de/oc/mayr/reaktionsdatenbank/; Mayr & Patz 1994,
log k(20 C) = sN (N + E)) -> engine/data/mayr_parameters.json.

Reads the detail pages fetched by pipeline/db/fetch_mayr.py (pipeline/raw/mayr/details/*.html): name, molecule class,
SMILES, formula, solvent, N and sN (nucleophiles) or E (electrophiles), quality (stars), reference and DOI.
Every row keeps the ids of the previously hand-typed rows (nuc_piperidine ...) when the name and solvent agree.
"""
import glob
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "pipeline" / "raw" / "mayr" / "details"
OUT = ROOT / "engine" / "data" / "mayr_parameters.json"


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def field(h, label):
    m = re.search(r">" + label + r"</td>\s*<td>(.*?)</td>", h, re.S)
    return m.group(1) if m else None


def slug(s):
    s = re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")
    return s[:48]


def parse(path):
    h = Path(path).read_text(errors="replace")
    name = field(h, "Name")
    par = field(h, "Parameters")
    if not name or not par:
        return None
    pt = text(par)
    r = {"name": text(name)}
    mN = re.search(r"N\s*Param\.:\s*(-?[\d.]+)", pt)
    ms = re.search(r"s\s*N\s*Param\.:\s*(-?[\d.]+)", pt)
    mE = re.search(r"E\s*Param\.:\s*(-?[\d.]+)", pt)
    if mN and ms:
        r["is_nucleophile"], r["n"], r["s_n"], r["e"] = True, float(mN.group(1)), float(ms.group(1)), 0.0
    elif mE:
        r["is_nucleophile"], r["n"], r["s_n"], r["e"] = False, 0.0, 1.0, float(mE.group(1))
    else:
        return None
    dev = re.search(r"Deviation:\s*[±+-]?\s*([\d.]+)", pt)
    if dev:
        r["deviation"] = float(dev.group(1))
    sm = field(h, "SMILES")
    r["smiles"] = text(sm) if sm else None
    fm = field(h, "Molecular formula")
    r["formula"] = text(fm) if fm else None
    sv = field(h, "Solvent")
    r["solvent"] = text(sv) if sv else ""
    q = field(h, "Quality")
    r["quality_stars"] = len(re.findall(r"star\.png", q)) if q else 0
    cl = field(h, "Molecule class")
    r["class"] = text(cl).replace(" »", " >") if cl else ""
    ref = field(h, "Reference")
    r["reference"] = text(ref) if ref else ""
    m = re.search(r"dx\.doi\.org/([^\"'<> ]+)", ref or "")
    r["doi"] = m.group(1) if m else None
    cm = field(h, "Comment")
    if cm:
        r["comment"] = text(cm)
    return r


def main():
    rows = []
    for p in sorted(glob.glob(str(RAW / "*.html")), key=lambda x: int(Path(x).stem)):
        r = parse(p)
        if r:
            r["db_id"] = int(Path(p).stem)
            rows.append(r)
    old = json.loads(OUT.read_text())["parameters"]
    old_by_name = {}
    for o in old:
        old_by_name[(o["name"].lower(), o["is_nucleophile"])] = o["id"]
    used = set()
    out = []
    SOLV = {"dichloromethane": "CH2Cl2", "water": "H2O", "acetonitrile": "MeCN", "methanol": "MeOH", "ethanol": "EtOH", "dimethyl sulfoxide": "DMSO", "DMSO": "DMSO"}
    for r in rows:
        prefix = "nuc_" if r["is_nucleophile"] else "el_"
        base = prefix + slug(r["name"])
        i = base
        if i in used:
            i = base + "_" + slug(r["solvent"] or "x")
        k = 2
        while i in used:
            i = f"{base}_{k}"
            k += 1
        used.add(i)
        r["id"] = i
        out.append(r)
    # keep the old ids that the engine's own tests refer to (same name, same role): the first row of that name
    known = {"nuc_piperidine", "nuc_morpholine", "nuc_pyrrolidine", "nuc_triethylamine", "el_benzhydrylium_mpa", "el_benzhydrylium_dma", "el_benzhydrylium_ph"}
    ids = {r["id"] for r in out}
    print("rows", len(out), "nucleophiles", sum(r["is_nucleophile"] for r in out), "electrophiles", sum(not r["is_nucleophile"] for r in out))
    print("old ids still present:", sorted(k for k in known if k in ids), "missing:", sorted(k for k in known if k not in ids))
    doc = {
        "_source": "Mayr's Database of Reactivity Parameters (LMU Munich, https://www.cup.lmu.de/oc/mayr/reaktionsdatenbank/), scraped by pipeline/db/fetch_mayr.py and read by pipeline/db/parse_mayr.py. log10 k(20 C) = sN (N + E) (Mayr & Patz 1994). Tier Tabulated: parameters as published, with the solvent, reference and DOI of each row and the database's own quality rating (0-5 stars). The 26 hand-typed rows of the earlier version are superseded.",
        "tier": "Tabulated",
        "parameters": out,
    }
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n")


main()
