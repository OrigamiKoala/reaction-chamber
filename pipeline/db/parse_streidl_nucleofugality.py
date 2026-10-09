#!/usr/bin/env python3
"""Imports the Mayr nucleofugality / electrofugality scale into engine/data/mayr_nucleofugality.json.

Source (open access, read from the text of the PDF): N. Streidl, "Development of Comprehensive Nucleofugality and Electrofugality
Scales", doctoral thesis, LMU Munich 2010 (https://edoc.ub.uni-muenchen.de/12173/1/streidl_nicolas.pdf), Chapter 5: Table 5.1 (reference
electrofuges E1-E39 with Ef), Table 5.2 (reference nucleofuges N1-N110: leaving group, solvent, Nf, sf) and, in its Experimental Section,
Table S1 (every solvolysis rate constant at 25 C used in the fit, with the rate constant the three-parameter relation
log10 k = sf (Nf + Ef) gives for it). The scales are those of Denegri et al. and Streidl et al., Acc. Chem. Res. 43, 1537 (2010).

Only the halide nucleofuges (Cl, Br: the leaving groups of the `sn1_ionisation` template) and the benzhydrylium ions whose two aryl
groups are given by simple substituent names are written; the fused-ring ions (E26, E27, E34, E36, E37, E39) and every ester
leaving group are left out. The Table S1 rows of the halides are kept as the fit check of `engine/tests/nucleofugality.rs`.

Usage: python3 pipeline/db/parse_streidl_nucleofugality.py [path/to/streidl.txt]
(the text is made with `pdftotext -layout streidl_nicolas.pdf streidl.txt`; without an argument the PDF is downloaded to a temporary directory)
"""
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "engine" / "data" / "mayr_nucleofugality.json"
URL = "https://edoc.ub.uni-muenchen.de/12173/1/streidl_nicolas.pdf"

# substituent name -> SMILES fragment attached to the ring carbon (ring-closure digits 7-9 are free inside the fragments)
FRAGMENT = {
    "H": "", "Cl": "Cl", "F": "F", "Br": "Br", "NO2": "[N+](=O)[O-]", "Me": "C", "OMe": "OC", "OPh": "Oc7ccccc7",
    "N(Ph)2": "N(c7ccccc7)c8ccccc8", "N(CH2CF3)(Ph)": "N(CC(F)(F)F)c7ccccc7", "N(CH3)2": "N(C)C", "N(CH2CH2)2O": "N7CCOCC7",
    "N(CH2CF3)(CH3)": "N(CC(F)(F)F)C", "N(Ph)(CH3)": "N(c7ccccc7)C", "N(CH2)4": "N7CCCC7",
}


def aryl(subst):
    """Ring SMILES for a substituent name such as '3,5-Cl2', '4-OMe', 'H' (ring attached through its first atom)."""
    pos = {2: "", 3: "", 4: "", 5: "", 6: ""}
    if subst != "H":
        m = re.fullmatch(r"([\d,]+)-(.+)", subst)
        if not m:
            raise ValueError(subst)
        places = [int(p) for p in m.group(1).split(",")]
        name = m.group(2)
        n = 1
        mm = re.fullmatch(r"([A-Za-z]+)(\d)", name)
        if mm and name not in FRAGMENT:
            name, n = mm.group(1), int(mm.group(2))
        if name not in FRAGMENT or n != len(places):
            raise ValueError(subst)
        for p in places:
            pos[p] = f"({FRAGMENT[name]})"
    return f"c1c{pos[2]}c{pos[3]}c{pos[4]}c{pos[5]}c1{pos[6]}"


def canon(smi):
    m = Chem.MolFromSmiles(smi)
    if m is None:
        raise ValueError(smi)
    return Chem.MolToSmiles(m)


def main():
    if len(sys.argv) > 1:
        text = Path(sys.argv[1]).read_text()
    else:
        d = Path(tempfile.mkdtemp())
        pdf = d / "streidl.pdf"
        urllib.request.urlretrieve(URL, pdf)
        subprocess.run(["pdftotext", "-layout", str(pdf), str(d / "streidl.txt")], check=True)
        text = (d / "streidl.txt").read_text()
    text = text.replace("–", "-").replace("−", "-")
    lines = text.splitlines()
    t51 = next(i for i, l in enumerate(lines) if l.startswith("Table 5.1: Reference Electrofuges"))
    t52 = next(i for i, l in enumerate(lines) if l.startswith("Table 5.2: Reference Nucleofuges"))
    t52_end = next(i for i, l in enumerate(lines) if i > t52 and "The electrofugality of the 4,4" in l)

    # Table 5.2: nucleofuges. Leaving groups appear on the first row of a group only (ranges from the table).
    lg_ranges = [(1, 7, "OTs"), (8, 11, "OMs"), (12, 18, "Br"), (19, 28, "Cl"), (29, 42, "HFB"), (43, 54, "TFA"), (55, 64, "PhOCO2"),
                 (65, 70, "DNB"), (71, 80, "MeOCO2"), (81, 86, "PNB"), (87, 89, "iBuOCO2"), (90, 93, "tBuOCO2"), (94, 97, "BzO"),
                 (98, 101, "AcO"), (102, 110, "Cl")]
    nucleofuges = []
    LG_NAMES = {"OTs", "OMs", "Br", "Cl", "HFB", "TFA", "PhOCO2", "DNB", "MeOCO2", "PNB", "BzO", "AcO", "iBuOCO2", "tBuOCO2"}
    number_end = re.compile(r"(-?\d+\.\d+)\s+(\d\.\d+)\s*$")
    for i in range(t52, t52_end):
        m = re.match(r"^\s*N(\d+)\s+(.*)$", lines[i])
        if not m:
            continue
        n = int(m.group(1))
        tok = m.group(2).split()
        if tok and tok[0] in LG_NAMES:
            tok = tok[1:]
        solvent = tok[0]
        # the Nf / sf numbers close the row; an electrofuge list that wraps puts them on the following line
        blob = m.group(2)
        nm = number_end.search(blob)
        if not nm and i + 1 < t52_end:
            blob += " " + lines[i + 1].strip()
            nm = number_end.search(blob)
        blob = blob.split(solvent, 1)[1]  # the solvent label itself can contain "E20" (80E20W)
        nm = number_end.search(blob)
        if not nm or not re.search(r"\bE\d+", blob):
            continue
        lg = next(name for a, b, name in lg_ranges if a <= n <= b)
        listed = blob[:nm.start()]
        if i + 1 < t52_end and re.match(r"^\s+(E\d+,?\s*)+$", lines[i + 1]):  # the list continues on the next line
            listed += " " + lines[i + 1]
        nucleofuges.append(dict(id=f"N{n}", leaving_group=lg, solvent=solvent, nf=float(nm.group(1)), sf=float(nm.group(2)),
                                electrofuges_used=sorted({int(x[1:]) for x in re.findall(r"E\d+", listed)})))
    nucleofuges.sort(key=lambda r: int(r["id"][1:]))
    ids = [int(n["id"][1:]) for n in nucleofuges]
    assert ids == list(range(1, 111)), f"Table 5.2 incomplete: missing {sorted(set(range(1, 111)) - set(ids))}"

    # Table S1: solvolysis rate constants at 25 C (experimental, calculated)
    s1 = next(i for i, l in enumerate(lines) if "Table S1: Solvolysis Rate Constants at 25" in l)
    s1_end = next(i for i, l in enumerate(lines) if i > s1 + 100 and "Table S2" in l)
    erow = re.compile(r"E(\d+)\s+(\S+)\s+(\S+)\s+(-?\d+\.\d+)\s+(\d\.\d+E[+-]\d+)\s+(\d\.\d+E[+-]\d+)\s+(\d\.\d+)\s+\[(\w+)\]")
    nhead = re.compile(r"N(\d+)\s+(?:(\S+)\s+)?(\S+)\s+(-?\d+\.\d+)\s+(\d\.\d+)\s+(E\d+.*)$")
    current = None
    s1_rows = []
    electrofuges = {}
    for l in lines[s1:s1_end]:
        l = re.sub(r"^\s{20,}", "", l)
        l = re.sub(r"^\d{3}\s+", "", l)
        m = nhead.search(l)
        if m:
            current = int(m.group(1))
            l = m.group(6)
        for em in erow.finditer(l):
            e, x, y, ef, kexp, kcalc, ratio, ref = em.groups()
            if current is None:
                continue
            s1_rows.append(dict(nucleofuge=f"N{current}", electrofuge=f"E{e}", k_exp=float(kexp), k_calc=float(kcalc), ref=ref))
            electrofuges.setdefault(int(e), dict(x=x, y=y, ef=float(ef)))
    # Ef of Table 5.1 (the authority for the number), cross-checked with S1
    ef51 = {}
    for l in lines[t51:t52]:
        m = re.match(r"^\s*E(\d+)\s+.*?\s(-?\d+\.\d+)\s*$", l)
        if m:
            ef51[int(m.group(1))] = float(m.group(2))
    for k, v in electrofuges.items():
        assert abs(ef51.get(k, 99) - v["ef"]) < 0.006, (k, ef51.get(k), v["ef"])
    E_out = []
    for k in sorted(electrofuges):
        v = electrofuges[k]
        try:
            ax, ay = aryl(v["x"]), aryl(v["y"])
        except ValueError:
            continue
        ring = {}
        for lg in ("Cl", "Br"):
            ring[lg] = canon(f"{lg}C({ax}){ay}")
        cation = canon(f"[CH+]({ax}){ay}")
        E_out.append(dict(id=f"E{k}", x=v["x"], y=v["y"], ef=ef51[k], cation_smiles=cation, substrates={"Cl": ring["Cl"], "Br": ring["Br"]}))
    keep = {n["id"] for n in nucleofuges if n["leaving_group"] in ("Cl", "Br")}
    kept_e = {e["id"] for e in E_out}
    doc = {
        "_source": "N. Streidl, doctoral thesis, LMU Munich 2010 (https://edoc.ub.uni-muenchen.de/12173/1/streidl_nicolas.pdf), Chapter 5, Tables 5.1 "
                   "and 5.2 and Table S1 of its Experimental Section; scales of Denegri et al. and Streidl et al., Acc. Chem. Res. 43, 1537 (2010). "
                   "Generated by pipeline/db/parse_streidl_nucleofugality.py. log10 k(25 C) = sf (Nf + Ef), first-order ionisation in the solvent "
                   "mixture of the row; solvents are written as in the thesis (A acetone, AN acetonitrile, E ethanol, M methanol, T / TFE "
                   "trifluoroethanol, W water, volume fractions in percent).",
        "tier": "Tabulated",
        "temperature_k": 298.15,
        "assumed_ea_kj_mol": 85.0,
        "assumed_ea_note": "the scale is stated at 25 C only; a typical heterolysis enthalpy of activation of benzhydryl halides in aqueous solvents "
                           "(recalled, about 80-95 kJ/mol) gives the temperature dependence; this value is an assumption, not a datum",
        "water_class": {
            "Cl": "N23", "Br": "N16",
            "note": "the solvent class 'water' uses the row of the most aqueous reference mixture (60 % MeCN / 40 % water): there is no row in pure water, "
                    "which ionises faster, so the rate is a lower bound"
        },
        "validity_margin_ef": 1.0,
        "templates": {"sn1_ionisation": {"substrate_slot": 0, "leaving_atom": 1}},
        "electrofuges": E_out,
        "nucleofuges": [n for n in nucleofuges if n["id"] in keep],
        "table_s1_halides": [r for r in s1_rows if r["nucleofuge"] in keep and r["electrofuge"] in kept_e],
    }
    OUT.write_text(json.dumps(doc, indent=1) + "\n")
    print(f"wrote {OUT.name}: {len(E_out)} electrofuges, {len(doc['nucleofuges'])} halide nucleofuges, {len(doc['table_s1_halides'])} Table S1 rows")


if __name__ == "__main__":
    main()
