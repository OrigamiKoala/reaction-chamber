#!/usr/bin/env python3
"""NMRShiftDB2 (open data, https://nmrshiftdb2.sourceforge.io; CC-BY-SA) -> experimental 13C / 1H shift records with the
assignment of every signal to an atom, split into a training and a held-out test set by InChIKey.

    pipeline/raw/nmrshiftdb2/nmrshiftdb2withsignals.sd  --(this script, needs RDKit)-->  pipeline/data/nmr_splits/{13c,1h}_{train,dev,test}.jsonl (committed: one file per split)

Only experimental spectra are used: NMRShiftDB2 also stores predictions (ACD/Labs, quantum chemistry) as spectra; a spectrum
whose index appears in the record's `Program` / `NMRProgram` lists is a prediction and is skipped.  A molecule enters the set
when it is a neutral, connected, organic molecule (C, H, N, O, F, Cl, Br, I, S; <= 40 heavy atoms) with a measured
spectrum in which every carbon (13C) / every carbon-bound hydrogen (1H) has an assigned shift.  Solvent as recorded.
The split is by the first block of the InChIKey (connectivity): 70 % train, 30 % held out; isomers stay together.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")
ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "pipeline" / "raw" / "nmrshiftdb2" / "nmrshiftdb2withsignals.sd"
OUT = ROOT / "pipeline" / "data" / "nmr_splits"
ORGANIC = {"C", "H", "N", "O", "F", "Cl", "Br", "I", "S"}
SOLV = {"Chloroform-D1 (CDCl3)": "CDCl3", "Dimethylsulphoxide-D6 (DMSO-D6, C2D6SO)": "DMSO-d6", "Methanol-D4 (CD3OD)": "CD3OD",
        "Deuteriumoxide (D2O)": "D2O", "Acetone-D6 ((CD3)2CO)": "acetone-d6", "Benzene-D6 (C6D6)": "C6D6"}


def charge_separate_nitro(mol):
    """nitro groups and N-oxides are often drawn pentavalent (N(=O)=O): write them charge separated, [N+](=O)[O-]"""
    rw = Chem.RWMol(mol)
    for a in rw.GetAtoms():
        if a.GetSymbol() != "N" or a.GetFormalCharge() != 0:
            continue
        dbl_o = [b for b in a.GetBonds() if b.GetBondType() == Chem.BondType.DOUBLE and b.GetOtherAtom(a).GetSymbol() == "O"]
        if len(dbl_o) >= 1 and sum(b.GetBondTypeAsDouble() for b in a.GetBonds()) >= 5:
            b = dbl_o[0]
            b.SetBondType(Chem.BondType.SINGLE)
            a.SetFormalCharge(1)
            b.GetOtherAtom(a).SetFormalCharge(-1)
    return rw.GetMol()


def only_zwitterionic_charges(mol):
    """True when the only charged atoms are N+ / O- (or N+ / N-, azides) pairs of a neutral molecule (nitro, N-oxide, azide)"""
    charged = [a for a in mol.GetAtoms() if a.GetFormalCharge() != 0]
    if not charged:
        return True
    if sum(a.GetFormalCharge() for a in charged) != 0:
        return False
    return all((a.GetSymbol() == "N" and a.GetFormalCharge() == 1) or (a.GetSymbol() in ("O", "N", "S") and a.GetFormalCharge() == -1) for a in charged)


def split_of(key):
    """held-out test 30 %, development 10 % (parameter tuning), training 60 %; by the connectivity block of the InChIKey"""
    h = int(hashlib.md5(key.split("-")[0].encode()).hexdigest(), 16) % 10
    return "test" if h < 3 else "dev" if h == 3 else "train"


def fields_of(block):
    fields, cur = {}, None
    for ln in block.split("\n"):
        if ln.startswith("> <"):
            cur = ln[3:ln.index(">", 3)]
            fields[cur] = []
        elif cur is not None and ln.strip():
            fields[cur].append(ln.strip())
    return fields


def indexed(lines):
    """'2:CDCl3 3:...' style lines -> {index: text}"""
    out = {}
    for ln in lines:
        for m in re.finditer(r"(\d+):([^\d][^:]*?)(?=\s\d+:|$)", ln):
            out[int(m.group(1))] = m.group(2).strip()
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {(n, s): open(OUT / f"{n}_{s}.jsonl", "w") for n in ("13c", "1h") for s in ("train", "dev", "test")}
    counts = {k: 0 for k in files}
    total = skipped = 0
    buf = []
    with open(SRC, errors="replace") as fh:
        for line in fh:
            if not line.startswith("$$$$"):
                buf.append(line)
                continue
            block = "".join(buf)
            buf = []
            total += 1
            if "M  END" not in block:
                continue
            head, _, tail = block.partition("M  END")
            f = fields_of(tail)
            mol = Chem.MolFromMolBlock(head + "M  END\n", sanitize=False, removeHs=False)
            if mol is None:
                skipped += 1
                continue
            mol = charge_separate_nitro(mol)
            try:
                Chem.SanitizeMol(mol)
            except Exception:
                skipped += 1
                continue
            if any(a.GetSymbol() not in ORGANIC for a in mol.GetAtoms()) or mol.GetNumAtoms() > 40 or not only_zwitterionic_charges(mol):
                continue
            if len(Chem.GetMolFrags(mol)) != 1:
                continue
            key = (f.get("INChI key") or [""])[0] or hashlib.md5(Chem.MolToSmiles(mol).encode()).hexdigest()
            smiles = Chem.MolToSmiles(mol, isomericSmiles=False)
            # atoms in the order of the SMILES string (the engine numbers atoms the same way), explicit hydrogens left out
            order = [int(x) for x in mol.GetProp("_smilesAtomOutputOrder").strip("[],").split(",") if x != ""]
            order = [i for i in order if mol.GetAtomWithIdx(i).GetSymbol() != "H"]
            predicted = set()
            for k in ("Program", "NMRProgram"):
                predicted |= set(indexed(f.get(k, [])).keys())
            solvents = indexed(f.get("Solvent", []))
            split = split_of(key)
            nH = {a.GetIdx(): a.GetTotalNumHs(includeNeighbors=True) for a in mol.GetAtoms() if a.GetSymbol() != "H"}
            for kind, tag in (("13C", "13c"), ("1H", "1h")):
                for k, v in f.items():
                    m = re.fullmatch(rf"Spectrum {kind} (\d+)", k)
                    if not m or int(m.group(1)) in predicted or not v:
                        continue
                    idx = int(m.group(1))
                    assigned = {}
                    for item in v[0].split("|"):
                        parts = item.split(";")
                        if len(parts) >= 3 and re.fullmatch(r"\d+", parts[2].strip()):
                            try:
                                assigned.setdefault(int(parts[2]), []).append(float(parts[0]))
                            except ValueError:
                                pass
                    atoms = [a.GetIdx() for a in mol.GetAtoms() if a.GetSymbol() != "H"]
                    solv = SOLV.get(solvents.get(idx, ""), solvents.get(idx, ""))
                    if tag == "13c":
                        carbons = [i for i in order if mol.GetAtomWithIdx(i).GetSymbol() == "C"]
                        part = [[order.index(c), sum(assigned[c]) / len(assigned[c])] for c in carbons if c in assigned]
                        if not carbons or not part:
                            continue
                        complete = len(part) == len(carbons)
                        if not complete and split != "train":
                            continue  # evaluation sets keep fully assigned spectra only; partial ones still train the tables
                        # c13: one shift per carbon in the order of the SMILES string (complete spectra); c13_by_atom: [position, shift]
                        rec = {"id": key, "smiles": smiles, "solvent": solv, "complete": complete, "c13_by_atom": part}
                        if complete:
                            rec["c13"] = [p_[1] for p_ in part]
                    else:
                        shifts = []
                        by_atom = []
                        ok = True
                        for i in order:
                            a = mol.GetAtomWithIdx(i)
                            n = nH[i]
                            if a.GetSymbol() != "C" or n == 0:
                                continue
                            s = assigned.get(i)
                            if not s:
                                ok = False
                                continue
                            per_h = s if len(s) == n else [sum(s) / len(s)] * n
                            shifts += per_h
                            by_atom.append([order.index(i), per_h])
                        if not by_atom or (not ok and split != "train"):
                            continue
                        # h1: every carbon-bound hydrogen (complete spectra); h1_by_atom: [position of the carbon among the heavy atoms of
                        # the SMILES, [shift per H]]; evaluation sets keep fully assigned spectra, partial ones still train the tables
                        rec = {"id": key, "smiles": smiles, "solvent": solv, "complete": ok, "h1_by_atom": by_atom}
                        if ok:
                            rec["h1"] = shifts
                    files[(tag, split)].write(json.dumps(rec) + "\n")
                    counts[(tag, split)] += 1
                    break  # one spectrum per molecule and nucleus (the first experimental one)
    for f_ in files.values():
        f_.close()
    print(f"{total} records read ({skipped} unreadable); written:", {f"{a}_{b}": c for (a, b), c in counts.items()})


main()
