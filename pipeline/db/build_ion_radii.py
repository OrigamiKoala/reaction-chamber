#!/usr/bin/env python3
"""Shannon ionic radii (Acta Cryst. A32 (1976) 751; the r(O2-) = 1.40 A scale, crystal radius = ionic radius + 0.14 A for cations) of monatomic ions, six-coordinate (high spin where both exist) -> engine/data/ion_radii.json

The radii come from the `mendeleev` Python package (which carries the Shannon table; pm -> Angstrom).  The earlier file held 66 recalled
values of the same table; those the table covers are replaced, the others kept.
"""
import json
import re
from pathlib import Path

from mendeleev import element

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "engine" / "data" / "ion_radii.json"
SYMBOLS = ["H", "Li", "Be", "B", "C", "N", "O", "F", "Na", "Mg", "Al", "Si", "P", "S", "Cl", "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Rb", "Sr", "Y", "Zr", "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I", "Cs", "Ba", "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg", "Tl", "Pb", "Bi", "Th", "U", "Ra", "Fr"]

old = json.loads(OUT.read_text())
radii = dict(old["radii"])
new = {}
for sym in SYMBOLS:
    try:
        e = element(sym)
        rr = [r for r in e.ionic_radii if r.coordination == "VI" and r.ionic_radius]
    except Exception:
        continue
    by_charge = {}
    for r in rr:
        by_charge.setdefault(r.charge, []).append(r.ionic_radius)
    for z, vals in by_charge.items():
        if z == 0:
            continue
        ion = f"{sym}{'+' if z > 0 else '-'}{abs(z) if abs(z) > 1 else ''}"
        new[ion] = round(max(vals) / 100.0, 3)
changed = {k: (radii[k], v) for k, v in new.items() if k in radii and abs(radii[k] - v) > 0.03}
radii.update(new)
doc = dict(old)
doc["_comment"] = "Ionic radii (Angstrom, the Shannon r(O2-) = 1.40 scale; the earlier text called them crystal radii, which are 0.14 larger for cations) of monatomic ions, Shannon, Acta Cryst. A32, 751 (1976), six-coordinate (high spin where both exist), read from the Shannon table of the `mendeleev` package by pipeline/db/build_ion_radii.py (tier Tabulated); rows the table does not cover are the earlier recalled values. Polyatomic ions have no row: crystal.rs estimates their radius from the molar mass (r = 0.5 M^(1/3), which reproduces the Jenkins & Glasser thermochemical radii of sulfate, carbonate, nitrate, phosphate and perchlorate to 5 %)."
doc["radii"] = dict(sorted(radii.items()))
OUT.write_text(json.dumps(doc, indent=1) + "\n")
print(len(new), "ions from the Shannon table;", len(radii), "in the file; differing by > 0.03 A from the recalled values:", changed)
