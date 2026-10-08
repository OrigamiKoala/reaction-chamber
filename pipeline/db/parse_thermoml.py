#!/usr/bin/env python3
"""NIST/TRC ThermoML Archive (https://trc.nist.gov/ThermoML, data.nist.gov/od/id/mds2-2422; 2020-09-30 snapshot) -> normalised
rows of the properties the engine models need.

    pipeline/raw/thermoml/ThermoML.v2020-09-30.tgz  --(this script)-->  pipeline/cache/thermoml/<category>.jsonl

One pass over the archive (about 30 000 XML files, one per paper).  Every `PureOrMixtureData` block with a property of interest
becomes rows {doi, compounds: [{key, name, formula}], property, T_K, P_kPa, x (mole fractions in the order of `compounds`), m
(molality), value (in SI-like units given in `unit`), u (standard uncertainty if present), phase}.  Categories:

  he          excess molar enthalpy of binary liquid mixtures             (H1: pipeline/db/build_excess_enthalpy.py)
  ve          excess molar volume of binary liquid mixtures               (excess_volume.json)
  osmotic     osmotic coefficient of aqueous electrolytes, molality       (P3 validation)
  gamma_mean  mean ionic activity coefficient, molality scale             (P3 validation)
  eps         relative permittivity of pure liquids and mixtures          (dielectric.json)
  gamma_inf   activity coefficient at infinite dilution                   (UNIFAC / activity points)
  psat        vapour or sublimation pressure of pure compounds            (vle.rs curves)
  lle         mutual solubility (mole fraction in coexisting liquid phases)  (P3 LLE)
  henry       Henry's law constant                                         (vle.rs)
"""
import json
import re
import sys
import tarfile
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "pipeline" / "raw" / "thermoml" / "ThermoML.v2020-09-30.tgz"
OUT = ROOT / "pipeline" / "cache" / "thermoml"
NS = "{http://www.iupac.org/namespaces/ThermoML}"

CATEGORIES = [
    ("he", re.compile(r"^Excess molar enthalpy", re.I)),
    ("ve", re.compile(r"^Excess molar volume", re.I)),
    ("osmotic", re.compile(r"^Osmotic coefficient", re.I)),
    ("gamma_mean", re.compile(r"^Mean ionic activity coefficient", re.I)),
    ("eps", re.compile(r"^Relative permittivity", re.I)),
    ("gamma_inf", re.compile(r"^Activity coefficient at infinite dilution|^Activity coefficient.*infinite", re.I)),
    ("psat", re.compile(r"^Vapor or sublimation pressure", re.I)),
    ("lle", re.compile(r"^(Mole fraction|Mass fraction|Molality)", re.I)),
    ("henry", re.compile(r"^Henry", re.I)),
]


def t(el, tag):
    x = el.find(NS + tag)
    return x.text.strip() if x is not None and x.text else None


def deep_text(el, tag):
    """text of the first descendant with this tag"""
    for x in el.iter(NS + tag):
        if x.text and x.text.strip():
            return x.text.strip()
    return None


def parse_file(data, name):
    root = ET.fromstring(data)
    doi = (root.find(f"{NS}Citation/{NS}sDOI").text if root.find(f"{NS}Citation/{NS}sDOI") is not None else name) or name
    comps = {}
    for c in root.findall(NS + "Compound"):
        n = c.find(f"{NS}RegNum/{NS}nOrgNum")
        if n is None:
            continue
        names = [x.text for x in c.findall(NS + "sCommonName") if x.text]
        comps[int(n.text)] = {"key": t(c, "sStandardInChIKey"), "inchi": t(c, "sStandardInChI"), "name": names[0] if names else None, "formula": t(c, "sFormulaMolec")}
    out = []
    for blk in root.findall(NS + "PureOrMixtureData"):
        comp_ids = [int(x.text) for x in blk.findall(f"{NS}Component/{NS}RegNum/{NS}nOrgNum") if x.text]
        # properties of the block
        props = {}
        for p in blk.findall(NS + "Property"):
            num = int(t(p, "nPropNumber") or 0)
            name_ = deep_text(p, "ePropName")
            phase = deep_text(p, "ePropPhase")
            rc = p.find(f".//{NS}RegNum/{NS}nOrgNum")
            props[num] = (name_ or "", phase or "", int(rc.text) if rc is not None and rc.text else None)
        # variables
        variables = {}
        for v in blk.findall(NS + "Variable"):
            num = int(t(v, "nVarNumber") or 0)
            vt = v.find(f"{NS}VariableID/{NS}VariableType")
            vname, vtype = None, None
            if vt is not None and len(vt):
                vtype = vt[0].tag.replace(NS, "")
                vname = vt[0].text
            reg = v.find(f"{NS}VariableID/{NS}RegNum/{NS}nOrgNum")
            variables[num] = (vtype, vname or "", int(reg.text) if reg is not None and reg.text else None)
        cats = {}
        for pn, (nm, ph, rc) in props.items():
            for cat, rx in CATEGORIES:
                if rx.search(nm):
                    cats[pn] = (cat, nm, ph, rc)
                    break
        if not cats:
            continue
        for nv in blk.findall(NS + "NumValues"):
            row = {"T_K": None, "P_kPa": None, "x": {}, "w": {}, "m": {}, "other": {}}
            for vv in nv.findall(NS + "VariableValue"):
                num = int(t(vv, "nVarNumber") or 0)
                val = t(vv, "nVarValue")
                if val is None or num not in variables:
                    continue
                try:
                    f = float(val)
                except ValueError:
                    continue
                vtype, vname, reg = variables[num]
                if vtype == "eTemperature":
                    row["T_K"] = f
                elif vtype == "ePressure":
                    row["P_kPa"] = f if "kPa" in vname else f / 1000.0 if vname.endswith("Pa") else f
                elif vtype == "eComponentComposition" or vtype == "eSolventComposition":
                    if "Mole fraction" in vname:
                        row["x"][reg] = f
                    elif "Mass fraction" in vname:
                        row["w"][reg] = f
                    elif "Molality" in vname:
                        row["m"][reg] = f
                    else:
                        row["other"][vname] = f
                else:
                    row["other"][vname] = f
            for pv in nv.findall(NS + "PropertyValue"):
                pn = int(t(pv, "nPropNumber") or 0)
                if pn not in cats:
                    continue
                val = t(pv, "nPropValue")
                if val is None:
                    continue
                try:
                    fv = float(val)
                except ValueError:
                    continue
                cat, nm, ph, prop_comp = cats[pn]
                u = deep_text(pv, "nCombExpandUncertValue") or deep_text(pv, "nExpandUncertValue")
                out.append((cat, {"doi": doi, "compounds": [comps.get(i, {}) for i in comp_ids], "comp_ids": comp_ids, "property": nm, "phase": ph, "prop_comp": prop_comp,
                                  "T_K": row["T_K"], "P_kPa": row["P_kPa"], "x": {str(k): v for k, v in row["x"].items()}, "w": {str(k): v for k, v in row["w"].items()},
                                  "m": {str(k): v for k, v in row["m"].items()}, "other": row["other"], "value": fv, "u": float(u) if u else None}))
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {c: open(OUT / f"{c}.jsonl", "w") for c, _ in CATEGORIES}
    counts, props = Counter(), Counter()
    n = bad = 0
    with tarfile.open(SRC, "r|gz") as tf:
        for m in tf:
            if not m.isfile() or not m.name.endswith(".xml"):
                continue
            n += 1
            try:
                rows = parse_file(tf.extractfile(m).read(), m.name)
            except Exception:
                bad += 1
                continue
            for cat, r in rows:
                files[cat].write(json.dumps(r) + "\n")
                counts[cat] += 1
                props[(cat, r["property"])] += 1
    for f in files.values():
        f.close()
    print(f"{n} papers read ({bad} unreadable); rows per category: {dict(counts)}")
    for (cat, nm), c in sorted(props.items(), key=lambda kv: -kv[1])[:40]:
        print(f"  {c:8d}  {cat:10s} {nm}")


if __name__ == "__main__":
    main()
