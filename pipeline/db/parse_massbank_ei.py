#!/usr/bin/env python3
"""MassBank (https://github.com/MassBank/MassBank-data, release 2026.03, NIST-format MSP) -> electron-ionisation spectra with
structure, split like the NMR records.

    pipeline/raw/massbank/MassBank_NISTformat.msp  --(this script, needs RDKit)-->  pipeline/data/ms_ei_splits/ei_{train,dev,test}.jsonl

Kept: Spectrum_type MS (MS1) of instrument types EI-B / GC-EI-* (70 eV electron ionisation), compounds of one connected neutral
organic structure (C, H, N, O, F, Cl, Br, I, S; up to 40 heavy atoms, no charge), one spectrum per InChIKey connectivity block
(the one with the most peaks).  Peaks are (m/z, relative intensity 0-999 as in the file).  Split: md5(connectivity block)
mod 10 < 3 test, == 3 development, else training.
"""
import hashlib
import json
import re
from pathlib import Path

from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "pipeline" / "raw" / "massbank" / "MassBank_NISTformat.msp"
OUT = ROOT / "pipeline" / "data" / "ms_ei_splits"
ORGANIC = {"C", "H", "N", "O", "F", "Cl", "Br", "I", "S"}


def split_of(block):
    h = int(hashlib.md5(block.encode()).hexdigest(), 16) % 10
    return "test" if h < 3 else "dev" if h == 3 else "train"


def records():
    cur, peaks, npk = {}, [], None
    with open(SRC, errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                if cur:
                    yield cur, peaks
                cur, peaks, npk = {}, [], None
                continue
            if re.match(r"^\d+(\.\d+)?\s+\d", line):
                a = line.split()
                peaks.append((float(a[0]), float(a[1])))
            elif ":" in line:
                k, v = line.split(":", 1)
                cur.setdefault(k.strip(), v.strip())
        if cur:
            yield cur, peaks


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    best = {}
    seen = ei = 0
    for rec, peaks in records():
        seen += 1
        it = rec.get("Instrument_type", "")
        if not (it.startswith("EI") or "-EI-" in it) or "ESI" in it:
            continue
        if rec.get("Spectrum_type", "MS") not in ("MS", "MS1") or not rec.get("SMILES") or len(peaks) < 3:
            continue
        ei += 1
        mol = Chem.MolFromSmiles(rec["SMILES"])
        if mol is None or len(Chem.GetMolFrags(mol)) != 1:
            continue
        if any(a.GetSymbol() not in ORGANIC or a.GetFormalCharge() != 0 for a in mol.GetAtoms()) or mol.GetNumHeavyAtoms() > 40:
            continue
        key = rec.get("InChIKey") or ""
        block = key.split("-")[0] or Chem.MolToSmiles(mol)
        smi = Chem.MolToSmiles(mol, isomericSmiles=False)
        if block in best and len(best[block]["peaks"]) >= len(peaks):
            continue
        best[block] = {"id": rec.get("DB#", ""), "name": rec.get("Name", ""), "inchikey": key, "smiles": smi, "formula": rec.get("Formula", ""),
                       "instrument": it, "peaks": [[round(m, 4), i] for m, i in peaks]}
    files = {s: open(OUT / f"ei_{s}.jsonl", "w") for s in ("train", "dev", "test")}
    counts = {s: 0 for s in files}
    for block, r in sorted(best.items()):
        s = split_of(block)
        files[s].write(json.dumps(r) + "\n")
        counts[s] += 1
    for f in files.values():
        f.close()
    print(f"{seen} records, {ei} EI with structure; written (one per structure):", counts)


main()
