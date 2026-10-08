#!/usr/bin/env python3
"""Refits template rules from measured rows (Section 4.4 of rates-from-data-plan.md).

For every rule that has verified, non-held-out rows (pipeline/data/rates_measured.csv -> engine/data/rates_measured.json):
  1. strip the structural modifiers a previous run wrote (ids starting "fit:") from reaction_templates.json;
  2. run the engine's own export (engine/examples/fit_template_rules.rs): for each row, the rule the engine assigns and its
     estimate `log_k_rule` at the row's temperature (existing hand-written modifiers included);
  3. regress  log10 k_measured - log10 k_rule  on an intercept and the candidate structural features below (ridge on the
     feature coefficients; a feature must fire in >= 2 training rows and the parameter count stays <= half the rows), giving the
     change of the rule's pre-exponential factor and one multiplicative modifier per feature; the activation energy moves to
     the mean measured one when >= 3 training rows state theirs;
  4. write the rule (`a`, `ea_kj`, `n_points`, `rms_log10`, `held_out_rms_log10`, tier `estimated`, source) and the modifiers.
Held-out rows are never fitted. The held-out error written here is a regression estimate (RDKit SMARTS); the authority is the
engine harness, engine/tests/measured_rates.rs, which evaluates the rules the engine actually builds.
Templates without any verified row keep their rule and are labelled `speculative` with "uncited" in the source (Section 13.1).

Usage: python3 pipeline/fit_template_rates.py [--no-write]
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from rdkit import Chem, RDLogger

RDLogger.DisableLog("rdApp.*")
ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "engine" / "data" / "reaction_templates.json"
ROWS_JSON = ROOT / "pipeline" / "data" / "rule_rows.json"
R = 8.314462618e-3

# Candidate structural features per template: (id, SMARTS anchored at the reacting centre atom, per_match, reactant slot).
# The anchor is the first atom of the template's own reactant pattern (the carbonyl carbon of esters and amides, the carbon of
# an alkyl halide), as the engine's modifiers require. The features are the standard physical-organic ones: acyl and leaving
# group electronics (Taft), steric class of the alkoxy carbon, N-substitution of amides, benzylic activation of halides.
FEATURES = {
    "base_ester_hydrolysis": [
        ("formate (H on the carbonyl carbon)", "[CX3;H1]", False, 0),
        ("alpha halogen on the acyl carbon, per halogen", "[CX3][CX4][F,Cl,Br]", True, 0),
        ("aryl ester (phenoxide leaving group)", "[CX3][OX2]c", False, 0),
        ("secondary alkoxy carbon", "[CX3][OX2][CX4;H1]", False, 0),
        ("tertiary alkoxy carbon", "[CX3][OX2][CX4;H0]", False, 0),
        ("acyl conjugated with C=C (acrylate, crotonate)", "[CX3][CX3]=[CX3]", False, 0),
        ("alkyl on the acyl alpha carbon (propionate and longer, Taft steric)", "[CX3][CX4][CX4]", False, 0),
        ("sulfinyl or sulfonyl on the acyl alpha carbon (electron-withdrawing)", "[CX3][CX4][SX3,SX4]=O", False, 0),
    ],
    "acid_ester_hydrolysis": [
        ("acyl conjugated with C=C (acrylate, crotonate)", "[CX3][CX3]=[CX3]", False, 0),
    ],
    "amide_hydrolysis": [
        ("N-alkyl substituent, per substituent", "[CX3][NX3][CX4]", True, 0),
    ],
    "amide_base_hydrolysis": [
        ("N-alkyl substituent, per substituent", "[CX3][NX3][CX4]", True, 0),
        ("alpha halogen on the acyl carbon, per halogen", "[CX3][CX4][F,Cl,Br]", True, 0),
    ],
    "carbamate_base_hydrolysis": [
        ("halogen on the alkoxy carbon, per halogen", "[CX3][OX2][CX4][CX4][F,Cl,Br]", True, 0),
        ("para-nitro on the aryloxy ring", "[CX3][OX2]c1ccc(cc1)[N+](=O)[O-]", False, 0),
    ],
    "acyl_halide_substitution": [],
    "halide_neutral_hydrolysis": [
        ("benzylic carbon (aryl on the halide carbon)", "[CX4]c", False, 0),
        ("allylic carbon (vinyl on the halide carbon)", "[CX4][CX3]=[CX3]", False, 0),
    ],
    "sn1_ionisation": [],
    "sn2_substitution": [],
}


# The reacting centre of the template's reactant slot 0 (the first atom of its pattern): the engine anchors every modifier there,
# so a feature only counts when its SMARTS starts at such an atom.
ANCHORS = {
    "base_ester_hydrolysis": "[CX3;A](=[OX1])[OX2;H0][#6]",
    "acid_ester_hydrolysis": "[CX3;A](=[OX1])[OX2;H0][#6]",
    "amide_hydrolysis": "[CX3;A](=[OX1])[NX3]",
    "amide_base_hydrolysis": "[CX3;A](=[OX1])[NX3]",
    "carbamate_base_hydrolysis": "[CX3;A](=[OX1])([OX2;H0][#6])[NX3]",
    "acyl_halide_substitution": "[CX3;A](=[OX1])[Cl,Br,I]",
    "halide_neutral_hydrolysis": "[CX4;H2,H3][Cl,Br,I]",
    "sn1_ionisation": "[CX4;!H3][Cl,Br,I]",
    "sn2_substitution": "[CX4][Cl,Br,I]",
}


# Hammett-Brown regression on the leaving-group ring of a rule (the engine's `hammett` modifier, constants of
# engine/data/hammett_plus.json): rule id -> (reactant slot, pattern atom of the ring carbon bound to the leaving O).
HAMMETT = {("carbamate_base_hydrolysis", "N-aryl carbamate, aryl-O + hydroxide"): (0, 3)}
SIGMA = json.loads((ROOT / "engine" / "data" / "hammett_plus.json").read_text())["sigma"]


def ring_sigma_sum(smiles, ipso_smarts="[CX3](=O)([OX2]c)N"):
    """Sum of the substituent constants of the aryl ring bound to the ester oxygen: meta with sigma_m, ortho / para with sigma+
    (as `pka_structure::ring_sigma_plus`). None when a substituent has no constant."""
    m = Chem.MolFromSmiles(smiles)
    hit = m.GetSubstructMatch(Chem.MolFromSmarts(ipso_smarts))
    ipso = hit[3]
    ring = next(r for r in m.GetRingInfo().AtomRings() if ipso in r and len(r) == 6)
    pos = ring.index(ipso)
    total = 0.0
    for k in range(1, 6):
        a = m.GetAtomWithIdx(ring[(pos + k) % 6])
        rd = min(k, 6 - k)
        for nb in a.GetNeighbors():
            if nb.GetIdx() in ring:
                continue
            sym = nb.GetSymbol()
            if sym in ("F", "Cl", "Br", "I"):
                name = sym
            elif sym == "O":
                name = "OR" if nb.GetDegree() == 2 and not nb.GetNeighbors()[0].GetIsAromatic() and not nb.GetNeighbors()[1].GetIsAromatic() else "OH"
                if nb.GetTotalNumHs() == 0 and nb.GetDegree() == 1:
                    return None
            elif sym == "N" and nb.GetFormalCharge() == 1 and sum(1 for x in nb.GetNeighbors() if x.GetSymbol() == "O") >= 2:
                name = "nitro"
            elif sym == "C" and not nb.GetIsAromatic():
                name = "alkyl"
            else:
                return None
            if name not in SIGMA:
                return None
            total += SIGMA[name][0] if rd == 2 else SIGMA[name][1]
    return total


def rules_of(template):
    out = list(template.get("rules", []))
    for v in template.get("variants", []):
        out += v.get("rules", [])
    return out


def strip_previous_fit(templates):
    for t in templates:
        mods = t.get("modifiers")
        if mods:
            t["modifiers"] = [m for m in mods if not m["id"].startswith("fit:")]
            if not t["modifiers"]:
                del t["modifiers"]


def features_of(tid, reactant_smiles, feats):
    m = Chem.MolFromSmiles(reactant_smiles)
    anchors = {mm[0] for mm in m.GetSubstructMatches(Chem.MolFromSmarts(ANCHORS[tid]))}
    out = []
    for _, sma, per_match, _ in feats:
        p = Chem.MolFromSmarts(sma)
        matches = [mm for mm in m.GetSubstructMatches(p) if mm[0] in anchors]
        n = len(matches) if per_match else int(len(matches) > 0)
        out.append(n)
    return out


def main():
    write = "--no-write" not in sys.argv
    original_text = TEMPLATES.read_text()
    data = json.loads(original_text)
    templates = data["templates"]
    strip_previous_fit(templates)
    TEMPLATES.write_text(json.dumps(data, indent=2) + "\n")
    subprocess.run(["cargo", "run", "--release", "--example", "fit_template_rules", "--", "--export", str(ROWS_JSON)],
                   cwd=ROOT / "engine", check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    rows = json.loads(ROWS_JSON.read_text())["rows"]
    by_rule = {}
    for r in rows:
        by_rule.setdefault((r["template"], r["rule"]), []).append(r)

    fitted_templates = set()
    fitted_rules = set()
    summary = []
    for (tid, rid), rs in sorted(by_rule.items()):
        template = next(t for t in templates if t["id"] == tid)
        rule = next(x for x in rules_of(template) if x["id"] == rid)
        train = [r for r in rs if not r["held_out"]]
        held = [r for r in rs if r["held_out"]]
        if not train:
            continue
        feats = FEATURES.get(tid, [])
        # which feature columns are usable
        F = np.array([features_of(tid, r["reactants"][0], feats) for r in rs], float).reshape(len(rs), len(feats))
        tr_idx = [i for i, r in enumerate(rs) if not r["held_out"]]
        ho_idx = [i for i, r in enumerate(rs) if r["held_out"]]
        use = [j for j in range(len(feats)) if (F[tr_idx, j] > 0).sum() >= 2]
        while use and 1 + len(use) > max(1, len(tr_idx) // 2):
            use.remove(min(use, key=lambda j: (F[tr_idx, j] > 0).sum()))
        # activation energy
        eas = [r["ea_meas_kj"] for r in train if r["ea_meas_kj"] is not None]
        d_ea = (np.mean(eas) - np.mean([r["ea_rule_kj"] for r in train if r["ea_meas_kj"] is not None])) if len(eas) >= 3 else 0.0
        y = np.array([r["log_k_meas"] - r["log_k_rule"] + d_ea * 1000.0 / (R * 1000.0 * r["t_k"] * math.log(10)) for r in rs])
        ham = HAMMETT.get((tid, rid))
        sig = None
        if ham is not None:
            sig = np.array([ring_sigma_sum(r["reactants"][0]) for r in rs], float).reshape(-1, 1)
            if np.isnan(sig).any():
                sig = None
        X = np.hstack([np.ones((len(rs), 1)), F[:, use]] + ([sig] if sig is not None else []))
        Xt, yt = X[tr_idx], y[tr_idx]
        lam = np.diag([0.0] + [0.05] * len(use) + ([0.0] if sig is not None else []))
        w = np.linalg.solve(Xt.T @ Xt + lam, Xt.T @ yt)
        res = y - X @ w
        rms_tr = float(np.sqrt(np.mean(res[tr_idx] ** 2)))
        rms_ho = float(np.sqrt(np.mean(res[ho_idx] ** 2))) if ho_idx else None
        # the change of A: the intercept, applied to the rule; features become modifiers
        rule["a"] = float(rule["a"]) * 10 ** w[0]
        if abs(d_ea) > 1e-9:
            rule["ea_kj"] = round(float(rule["ea_kj"]) + d_ea, 2)
        rule["a"] = float(f"{rule['a']:.6g}")
        rule["n_points"] = len(train)
        rule["rms_log10"] = round(rms_tr, 3)
        if rms_ho is not None:
            rule["held_out_rms_log10"] = round(rms_ho, 3)
            rule["n_held_out"] = len(held)
        else:
            rule.pop("held_out_rms_log10", None)
            rule.pop("n_held_out", None)
        rule["tier"] = "estimated"
        rule["source"] = (f"Fit to {len(train)} verified rows read from Mabey & Mill, J. Phys. Chem. Ref. Data 7, 383 (1978), rms {rms_tr:.2f} log10"
                          + (f", held-out rms {rms_ho:.2f} ({len(held)} rows)" if rms_ho is not None else ", no held-out rows")
                          + ("; activation energy = mean of the tabulated ones" if abs(d_ea) > 1e-9 else "; activation energy from the earlier rule"))
        mods = template.setdefault("modifiers", [])
        if sig is not None:
            mods.append({
                "id": "fit: Hammett-Brown relation of the leaving-group ring",
                "when": list(rule["when"]),
                "hammett": {"rho": float(f"{w[-1]:.4g}"), "reactant": ham[0], "center": ham[1], "ortho_steric": False},
                "source": f"rho from least squares on {len(train)} verified Mabey & Mill (1978) rows of {tid} ({rid}); substituent constants of engine/data/hammett_plus.json (recalled, tier Estimated)",
            })
        for k, j in enumerate(use):
            fid, sma, per_match, slot = feats[j]
            mods.append({
                "id": f"fit: {fid}",
                "when": [{"reactant": slot, "center": 0, "smarts": sma}],
                "a_factor": float(f"{10 ** w[1 + k]:.4g}"),
                "per_match": per_match,
                "source": f"least-squares factor on {len(train)} verified Mabey & Mill (1978) rows of {tid} ({rid}); {int((F[tr_idx, j] > 0).sum())} of them show the feature",
            })
        fitted_templates.add(tid)
        fitted_rules.add((tid, rid))
        summary.append((tid, rid, len(train), rms_tr, len(held), rms_ho, [feats[j][0] for j in use] + (['Hammett rho'] if sig is not None else []), [round(float(10 ** w[1 + k]), 3) for k in range(len(use))] + ([round(float(w[-1]), 3)] if sig is not None else [])))

    # Section 13.1: a template without a verified row keeps its rule, labelled speculative and uncited
    for t in templates:
        for rule in rules_of(t):
            if (t["id"], rule["id"]) in fitted_rules:
                continue
            if "n_points" in rule or "Fit to" in rule.get("source", ""):  # a fit label of a row set that no longer exists
                for k in ("n_points", "rms_log10", "held_out_rms_log10", "n_held_out"):
                    rule.pop(k, None)
            rule["tier"] = "speculative"
            src = rule.get("source", "")
            if "uncited" not in src.lower():
                rule["source"] = f"{src} (uncited, tier speculative: no verified measured row)" if src else "uncited, tier speculative"

    for s in summary:
        print(f"{s[0]} / {s[1]}: train {s[2]} rms {s[3]:.2f}; held-out {s[4]} rms {'n/a' if s[5] is None else f'{s[5]:.2f}'}; modifiers {dict(zip(s[6], s[7]))}")
    if write:
        TEMPLATES.write_text(json.dumps(data, indent=2) + "\n")
        print(f"wrote {TEMPLATES.name}")
    else:
        TEMPLATES.write_text(original_text)  # the engine export needed the stripped file; leave the file as it was
        print("--no-write: reaction_templates.json left unchanged")


if __name__ == "__main__":
    main()
