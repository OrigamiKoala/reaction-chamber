#!/usr/bin/env python3
"""UNIFAC parameter parser (Stage 5, plan section 7 source A10).

Reads the *published* original-UNIFAC group tables and writes the engine's `data/unifac_vle.json`:

* subgroup list: id, name, main group, volume R, area Q, the hydrogen count the subgroup accounts for and its SMARTS
  pattern(s) (the engine assigns groups to a molecule by matching these patterns on its SMILES graph);
* main-group interaction matrix `a_mn` (K) for the whole table.

Sources (all parameters are the published Fredenslund / Hansen tables; the machine-readable copies come from the MIT
licensed `thermo` package, which stores them exactly as DDBST lists them):

  --source   thermo/unifac.py                      (subgroup R, Q, main group, SMARTS, atom counts)
  --ip       "UNIFAC original interaction parameters.tsv"      (a_mn, K, Hansen et al. 1991)
  --ip-lle   "UNIFAC LLE interaction parameters.tsv"           (Magnussen et al. 1981, optional second set)

Nothing is hand-typed here: the parser reads `UFSG[...] = UNIFAC_subgroup(...)` statements with the Python `ast`
module (so multi-line statements, trailing comments and keyword arguments need no regular expressions) and the TSV rows.
Interaction pairs the table does not list stay absent: the engine then reports the mixture as *outside UNIFAC* and falls
back to an ideal solution, labelled, instead of guessing a parameter.

Usage:
    python3 pipeline/db/parse_unifac.py --fetch                       # download the sources into pipeline/cache/unifac
    python3 pipeline/db/parse_unifac.py                               # parse the cached sources, write the engine table
    python3 pipeline/db/parse_unifac.py --source X --ip Y --out Z     # explicit paths
"""

import argparse
import ast
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent.parent
CACHE = ROOT / "pipeline" / "cache" / "unifac"
DEFAULT_OUT = ROOT / "engine" / "data" / "unifac_vle.json"

BASE_URL = "https://raw.githubusercontent.com/CalebBell/thermo/master/thermo/"
FETCH = {
    "unifac.py": "unifac.py",
    "UNIFAC original interaction parameters.tsv": "Phase Change/UNIFAC original interaction parameters.tsv",
    "UNIFAC LLE interaction parameters.tsv": "Phase Change/UNIFAC LLE interaction parameters.tsv",
}

SOURCE_NOTE = (
    "Original UNIFAC (Fredenslund, Jones & Prausnitz, AIChE J. 21 (1975) 1086) with the VLE interaction-parameter table of "
    "Hansen, Rasmussen, Fredenslund, Schiller & Gmehling, Ind. Eng. Chem. Res. 30 (1991) 2352, as machine-readable files from "
    "the MIT-licensed `thermo` package (DDBST published parameter lists). Group volumes/areas R, Q and a_mn are the published "
    "values; group assignment patterns are SMARTS. Pairs absent from the table are absent here (mixture outside UNIFAC)."
)


def fetch(dest: Path = CACHE) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    for name, rel in FETCH.items():
        url = BASE_URL + urllib.parse.quote(rel)
        with urllib.request.urlopen(url, timeout=60) as r:
            (dest / name).write_bytes(r.read())
        print(f"fetched {name}")


def _lit(node: ast.AST) -> Any:
    try:
        return ast.literal_eval(node)
    except Exception:
        return None


def parse_main_groups(tree: ast.Module) -> Dict[int, str]:
    """`UFMG[n] = ("name", [subgroup ids])`."""
    out: Dict[int, str] = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            t = node.targets[0]
            if isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name) and t.value.id == "UFMG":
                key = _lit(t.slice)
                val = _lit(node.value)
                if isinstance(key, int) and isinstance(val, tuple) and val:
                    out[key] = str(val[0])
    return out


def parse_subgroups(tree: ast.Module, table: str = "UFSG") -> List[Dict[str, Any]]:
    """`UFSG[id] = UNIFAC_subgroup(id, "name", main_id, "main", R, Q, smarts=..., atoms={...})` (ids < 2000)."""
    rows: List[Dict[str, Any]] = []
    for node in tree.body:
        if not (isinstance(node, ast.Assign) and len(node.targets) == 1):
            continue
        t = node.targets[0]
        if not (isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name) and t.value.id == table):
            continue
        key = _lit(t.slice)
        call = node.value
        if not (isinstance(call, ast.Call) and isinstance(key, int) and key < 2000):
            continue
        if len(call.args) < 6:
            continue
        sid, name, main_id, main_name, r, q = (_lit(a) for a in call.args[:6])
        if None in (sid, name, main_id, r, q):
            continue
        kw = {k.arg: k.value for k in call.keywords}
        smarts = _lit(kw["smarts"]) if "smarts" in kw else None
        if isinstance(smarts, str):
            smarts = [smarts]
        atoms = _lit(kw["atoms"]) if "atoms" in kw else None
        n_h: Optional[int] = None
        if isinstance(atoms, dict):
            n_h = int(atoms.get("H", 0))
        rows.append(
            {
                "id": int(sid),
                "name": str(name),
                "main": int(main_id),
                "main_name": str(main_name),
                "R": float(r),
                "Q": float(q),
                "h": n_h,
                "smarts": smarts,
            }
        )
    return rows


def parse_interactions(text: str) -> List[Tuple[int, int, float]]:
    out: List[Tuple[int, int, float]] = []
    for line in text.splitlines():
        parts = line.strip().split("\t")
        if len(parts) != 3:
            continue
        try:
            out.append((int(parts[0]), int(parts[1]), float(parts[2])))
        except ValueError:
            continue
    return out


def unique_names(rows: List[Dict[str, Any]]) -> None:
    """Subgroup names are the engine's keys in species records: duplicates (aldehyde CHO and ether CHO) get the id suffixed."""
    seen: Dict[str, int] = {}
    for r in rows:
        n = r["name"]
        if n in seen:
            r["name"] = f"{n}#{r['id']}"
        else:
            seen[n] = r["id"]


def build_table(source_text: str, ip_text: str, ip_lle_text: Optional[str] = None) -> Dict[str, Any]:
    tree = ast.parse(source_text)
    mains = parse_main_groups(tree)
    subs = parse_subgroups(tree, "UFSG")
    unique_names(subs)
    ips = parse_interactions(ip_text)
    used_mains = sorted({s["main"] for s in subs})
    lle = parse_interactions(ip_lle_text) if ip_lle_text else []
    out = {
        "model": "UNIFAC original VLE (Fredenslund 1975; Hansen 1991 interaction parameters)",
        "tier": "tabulated",
        "source": SOURCE_NOTE,
        "main_groups": {str(k): mains.get(k, "") for k in used_mains},
        "subgroups": [
            {
                "id": s["id"],
                "name": s["name"],
                "main": s["main"],
                "R": s["R"],
                "Q": s["Q"],
                "h": s["h"] if s["h"] is not None else 0,
                "smarts": s["smarts"] or [],
            }
            for s in subs
        ],
        "a_mn": [[m, n, a] for m, n, a in ips if m in used_mains and n in used_mains],
        # Magnussen et al. (1981) liquid-liquid set, recorded for completeness. NOT used by the engine: tried as the
        # parameter set of the phase-equilibrium layer, the thermo-published LLE matrix makes hexane and water miscible
        # (the VLE set separates them), so the engine keeps the original set until a validated LLE source is found.
        "a_mn_lle": [[m, n, a] for m, n, a in lle if m in used_mains and n in used_mains],
    }
    return out


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fetch", action="store_true", help="download the source files into pipeline/cache/unifac")
    ap.add_argument("--source", type=Path, default=CACHE / "unifac.py")
    ap.add_argument("--ip", type=Path, default=CACHE / "UNIFAC original interaction parameters.tsv")
    ap.add_argument("--ip-lle", type=Path, default=CACHE / "UNIFAC LLE interaction parameters.tsv")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args(argv)
    if args.fetch:
        fetch()
    table = build_table(args.source.read_text(), args.ip.read_text(), args.ip_lle.read_text() if args.ip_lle.exists() else None)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(table, indent=1) + "\n")
    print(f"wrote {args.out}: {len(table['subgroups'])} subgroups, {len(table['main_groups'])} main groups, {len(table['a_mn'])} VLE and {len(table['a_mn_lle'])} LLE interaction pairs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
