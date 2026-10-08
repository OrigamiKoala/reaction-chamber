#!/usr/bin/env python3
"""FreeSolv (Mobley & Guthrie 2014; https://github.com/MobleyLab/FreeSolv, v0.52) -> pipeline/data/hydration_dg_experimental.csv

Experimental hydration free energies (1 M ideal gas -> 1 M ideal solution, 298 K, kcal/mol) of 642 neutral small molecules, with the
experimental uncertainty and the DOI of the original measurement.  The calculated columns of FreeSolv (GAFF simulations) are not used.
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "pipeline" / "raw" / "freesolv" / "database.txt"
OUT = ROOT / "pipeline" / "data" / "hydration_dg_experimental.csv"

rows = []
for line in SRC.read_text(errors="replace").splitlines():
    if not line.strip() or line.startswith("#"):
        continue
    f = [x.strip() for x in line.split(";")]
    if len(f) < 8:
        continue
    cid, smiles, name, dg, unc = f[0], f[1], f[2], f[3], f[4]
    rows.append({"id": cid, "smiles": smiles, "name": name, "dg_kcal_mol": dg, "unc_kcal_mol": unc, "doi": f[7]})
with open(OUT, "w", newline="") as fh:
    fh.write("# Experimental hydration free energies from FreeSolv v0.52 (Mobley & Guthrie, J. Comput.-Aided Mol. Des. 28 (2014) 711), written by pipeline/db/parse_freesolv.py.\n")
    fh.write("# 1 M ideal gas -> 1 M ideal solution at 298 K, kcal/mol; doi = the original measurement.\n")
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
print(len(rows), "rows ->", OUT)
