#!/usr/bin/env python3
"""Fits the pair-additive solubility-product model used for ion pairs the Ksp table does not list (engine/src/solubility.rs,
`additive_log_ksp`) and writes engine/data/ksp_additive.json.

Model: log10 Ksp(M_nc X_na) = nc * theta_M + na * theta_X, ridge-regularised least squares over the insoluble rows of
engine/data/solubility.json (log Ksp < 0.5, one cation and one anion). The leave-one-out error over those rows is recorded
in the output: 6.2 log units (the solubility-rule baseline -(4 + 2 zc za) has 13.7). The model orders the silver halides and
the group-2 carbonates; it does not reliably order the alkaline-earth sulfates (tier Speculative).

Usage: python3 pipeline/build_ksp_additive.py
"""
import json
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
LAM = 0.3


def charge(ion: str) -> int:
    m = re.match(r"^(.*?)([+-]\d*)$", ion)
    ch = m.group(2)
    z = int(ch[1:]) if len(ch) > 1 else 1
    return z if ch[0] == "+" else -z


def load_rows():
    data = json.loads((ROOT / "engine/data/solubility.json").read_text())
    rows, seen = [], set()
    for m in data["minerals"]:
        ions = m["dissolved_products"]
        cats = [k for k in ions if charge(k) > 0]
        ans = [k for k in ions if charge(k) < 0]
        if len(ions) != 2 or len(cats) != 1 or len(ans) != 1:
            continue
        if m["log_ksp_298"] > 0.5 or (cats[0], ans[0]) in seen:
            continue
        seen.add((cats[0], ans[0]))
        rows.append((cats[0], ans[0], ions[cats[0]], ions[ans[0]], m["log_ksp_298"]))
    return rows


def design(rows, cats, ans):
    A = np.zeros((len(rows), len(cats) + len(ans)))
    for i, (c, a, nc, na, _) in enumerate(rows):
        A[i, cats.index(c)] = nc
        A[i, len(cats) + ans.index(a)] = na
    return A


def main():
    rows = load_rows()
    cats = sorted({r[0] for r in rows})
    ans = sorted({r[1] for r in rows})
    A = design(rows, cats, ans)
    y = np.array([r[4] for r in rows])
    n = A.shape[1]
    w = np.linalg.solve(A.T @ A + LAM * np.eye(n), A.T @ y)
    errs = []
    for i in range(len(rows)):
        keep = [j for j in range(len(rows)) if j != i]
        wi = np.linalg.solve(A[keep].T @ A[keep] + LAM * np.eye(n), A[keep].T @ y[keep])
        errs.append(float(A[i] @ wi - y[i]))
    loo = float(np.sqrt(np.mean(np.square(errs))))
    out = {
        "_comment": "Pair-additive log10 Ksp model, fitted by pipeline/build_ksp_additive.py from the insoluble rows of solubility.json. log Ksp = nc theta(cation) + na theta(anion). Tier Speculative.",
        "n_pairs": len(rows),
        "ridge_lambda": LAM,
        "loo_rms_log_units": round(loo, 2),
        "cation": {c: round(float(w[i]), 3) for i, c in enumerate(cats)},
        "anion": {a: round(float(w[len(cats) + i]), 3) for i, a in enumerate(ans)},
    }
    (ROOT / "engine/data/ksp_additive.json").write_text(json.dumps(out, indent=1) + "\n")
    print(f"{len(rows)} pairs, {len(cats)} cations, {len(ans)} anions, LOO rms {loo:.2f} log units")


if __name__ == "__main__":
    main()
