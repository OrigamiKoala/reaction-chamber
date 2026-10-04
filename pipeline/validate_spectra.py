#!/usr/bin/env python3
"""Validation of the engine's NMR predictor against NMRShiftDB2 (open data, SourceForge).

    python3 pipeline/validate_spectra.py [--bytes 30000000] [--limit 800] [--cache DIR]

Downloads the first `--bytes` of nmrshiftdb2withsignals.sd (a range request; the whole file is large), keeps the records that
(a) have an assigned 13C spectrum in CDCl3, (b) contain only neutral C, H, N, O, F, Cl, Br, I, S in their standard valences and
(c) have at most 24 heavy atoms with every carbon assigned, converts each molfile to SMILES and runs the Rust example
`engine/examples/validate_nmr.rs` on them, which prints the error statistics per compound class. Nothing from the database
is stored in the repository: the data are cached under --cache (default: the platform cache directory).

Not run here: MassBank (EI spectra). No manageable subset of it is reachable without the GitHub API; the electron-ionisation
model stays validated only against the 44 reference spectra of engine/tests/analytical_ms.rs.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request

URL = "https://sourceforge.net/projects/nmrshiftdb2/files/data/nmrshiftdb2withsignals.sd/download"
VALENCE = {"C": 4, "N": 3, "O": 2, "F": 1, "Cl": 1, "Br": 1, "I": 1, "S": 2}
ORGANIC = set(VALENCE)


def download(path, nbytes):
    if os.path.exists(path) and os.path.getsize(path) >= nbytes:
        return
    req = urllib.request.Request(URL, headers={"Range": f"bytes=0-{nbytes}", "User-Agent": "reaction-chamber-validation"})
    with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)


def parse_molfile(block):
    lines = block.split("\n")
    # the counts line is the one ending in V2000 (a record split off a long file starts with a blank line)
    k = next(i for i, ln in enumerate(lines) if ln.rstrip().endswith("V2000"))
    counts = lines[k]
    na, nb = int(counts[0:3]), int(counts[3:6])
    atoms, bonds = [], []
    for ln in lines[k + 1:k + 1 + na]:
        atoms.append({"el": ln[31:34].strip(), "chg": ln[36:39].strip() or "0"})
    for ln in lines[k + 1 + na:k + 1 + na + nb]:
        bonds.append((int(ln[0:3]) - 1, int(ln[3:6]) - 1, int(ln[6:9])))
    return atoms, bonds


def to_smiles(atoms, bonds):
    """SMILES of a connected, neutral, standard-valence molecule; returns (smiles, atom order) or None."""
    n = len(atoms)
    if any(a["el"] not in ORGANIC or a["chg"] != "0" for a in atoms):
        return None
    adj = {i: [] for i in range(n)}
    val = [0] * n
    for a, b, t in bonds:
        if t not in (1, 2, 3):
            return None
        adj[a].append((b, t))
        adj[b].append((a, t))
        val[a] += t
        val[b] += t
    for i, a in enumerate(atoms):
        if val[i] > VALENCE[a["el"]]:
            return None
    order, seen = [], set()
    ring_digit = {}
    next_digit = [1]
    out = []

    # iterative-free recursive DFS: tree edges and ring closures decided up front
    parent = {0: None}
    state = {}
    tree_edges, closures = set(), []

    def dfs(u):
        state[u] = 1
        for v, t in adj[u]:
            if v == parent[u]:
                continue
            if v not in state:
                parent[v] = u
                tree_edges.add((u, v))
                dfs(v)
            elif state[v] == 1:
                closures.append((u, v, t))
        state[u] = 2

    sys.setrecursionlimit(10000)
    dfs(0)
    if len(state) != n:
        return None
    closure_at = {i: [] for i in range(n)}
    for k, (u, v, t) in enumerate(closures):
        closure_at[u].append((k, t))
        closure_at[v].append((k, t))
    digits = {}
    free = list(range(9, 0, -1))
    sym = {1: "", 2: "=", 3: "#"}

    def write(u):
        order.append(u)
        s = atoms[u]["el"]
        for k, t in closure_at[u]:
            if k in digits:
                s += (sym[t] if False else "") + str(digits.pop(k)[0])
                free.append(int(s[-1]))
            else:
                d = free.pop()
                digits[k] = (d, t)
                s += sym[t] + str(d)
        kids = [(v, t) for v, t in adj[u] if (u, v) in tree_edges]
        for idx, (v, t) in enumerate(kids):
            sub = sym[t] + write(v)
            s += f"({sub})" if idx < len(kids) - 1 else sub
        return s

    smi = write(0)
    return smi, order


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bytes", type=int, default=30_000_000)
    ap.add_argument("--limit", type=int, default=800)
    ap.add_argument("--cache", default=os.path.join(os.path.expanduser("~"), ".cache", "reaction-chamber"))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    sd = os.path.join(args.cache, "nmrshiftdb2withsignals.head.sd")
    download(sd, args.bytes)
    text = open(sd, errors="replace").read()
    records = text.split("$$$$")[:-1]  # the last one is cut by the range request
    out_path = os.path.join(args.cache, "nmr13c_cdcl3.jsonl")
    kept = 0
    with open(out_path, "w") as out:
        for rec in records:
            if "M  END" not in rec:
                continue
            head, _, tail = rec.partition("M  END")
            fields = {}
            cur = None
            for ln in tail.split("\n"):
                if ln.startswith("> <"):
                    cur = ln[3:ln.index(">", 3)]
                    fields[cur] = []
                elif cur is not None and ln.strip():
                    fields[cur].append(ln.strip())
            spectra = [k for k in fields if k.startswith("Spectrum 13C")]
            if len(spectra) != 1 or not any("CDCl3" in s for s in fields.get("Solvent", [])):
                continue
            idx = spectra[0].split()[-1]
            if not any(s.startswith(idx + ":") and "CDCl3" in s for s in fields.get("Solvent", [])):
                continue
            atoms, bonds = parse_molfile(head)
            if len(atoms) > 24 or any(a["el"] == "H" for a in atoms):
                continue
            conv = to_smiles(atoms, bonds)
            if conv is None:
                continue
            smi, order = conv
            shifts = {}
            for item in fields[spectra[0]][0].split("|"):
                parts = item.split(";")
                if len(parts) >= 3 and parts[2].strip().isdigit():
                    shifts.setdefault(int(parts[2]), []).append(float(parts[0]))
            carbons = [i for i, a in enumerate(atoms) if a["el"] == "C"]
            if not carbons or any(c not in shifts for c in carbons):
                continue
            c13 = [sum(shifts[c]) / len(shifts[c]) for c in carbons]
            out.write(json.dumps({"id": (fields.get("nmrshiftdb2 ID") or ["?"])[0], "smiles": smi, "c13": c13}) + "\n")
            kept += 1
            if kept >= args.limit:
                break
    print(f"{kept} records written to {out_path}")
    here = os.path.dirname(os.path.abspath(__file__))
    subprocess.run(["cargo", "run", "--release", "--example", "validate_nmr", "--", out_path], cwd=os.path.join(here, "..", "engine"), check=True)


if __name__ == "__main__":
    main()
