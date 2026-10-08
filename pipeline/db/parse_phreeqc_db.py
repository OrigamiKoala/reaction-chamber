#!/usr/bin/env python3
"""General PHREEQC database reader (phreeqc.dat, wateq4f.dat, minteq.v4.dat, llnl.dat, Thermoddem, pitzer.dat ...).

Yields every reaction of SOLUTION_SPECIES and PHASES with log K at 25 C, the reaction enthalpy (kJ/mol) and the
temperature function when the file gives one, and offers `reduce_reaction`, which rewrites a mineral dissolution
reaction in terms of a chosen basis of dissolved ions (eliminating H+, OH- / H2O and derived species with the file's own
species reactions) so that it can be stored as a plain solubility product.

Not a PHREEQC interpreter: only what the data pipeline needs (reactions, log_k, delta_h, -analytic, -gamma, -dw, -Vm).
"""
import re
from pathlib import Path

SECTIONS = {
    "SOLUTION_MASTER_SPECIES", "SOLUTION_SPECIES", "PHASES", "EXCHANGE_MASTER_SPECIES", "EXCHANGE_SPECIES",
    "SURFACE_MASTER_SPECIES", "SURFACE_SPECIES", "RATES", "END", "LLNL_AQUEOUS_MODEL_PARAMETERS", "PITZER", "SIT",
    "NAMED_EXPRESSIONS", "SOLUTION", "KNOBS", "EQUILIBRIUM_PHASES", "SOLID_SOLUTIONS", "GAS_PHASE", "MEAN_GAMMAS",
    "REACTION", "USER_PRINT", "USER_PUNCH", "SELECTED_OUTPUT", "INCREMENTAL_REACTIONS", "TITLE", "PRINT",
}
KCAL = 4.184


def _num(s):
    return float(s.replace("D", "E"))


def _dh_kj(value, unit):
    unit = (unit or "kJ/mol").lower()
    v = _num(value)
    if unit.startswith("kcal"):
        return v * KCAL
    if unit.startswith("kj"):
        return v
    if unit.startswith("j"):
        return v / 1000.0
    if unit.startswith("cal"):
        return v * KCAL / 1000.0
    return v


def split_terms(side):
    """'2 H2AsO4- + UO2+2 + 1.000Ca+2' -> [(coef, species)]"""
    out = []
    for t in re.split(r"\s+\+\s+", side.strip()):
        t = t.strip()
        if not t:
            continue
        m = re.match(r"^(\d+(?:\.\d+)?)\s*(\S.*)$", t)
        # a leading number is a coefficient unless it is the whole token
        if m and not re.match(r"^\d+(?:\.\d+)?$", t):
            coef, name = float(m.group(1)), m.group(2).strip()
        else:
            coef, name = 1.0, t
        out.append((coef, name))
    return out


def parse_reaction(text):
    """'A + 2 B = C + D' -> {A: -1, B: -2, C: 1, D: 1} (products positive); None when it is not a reaction."""
    if "=" not in text:
        return None
    lhs, rhs = text.split("=", 1)
    v = {}
    for c, n in split_terms(lhs):
        v[n] = v.get(n, 0.0) - c
    for c, n in split_terms(rhs):
        v[n] = v.get(n, 0.0) + c
    return {k: x for k, x in v.items() if abs(x) > 1e-12}


def read(path):
    """Returns {'species': [...], 'phases': [...]} of dicts {name, rxn(dict), log_k, delta_h_kj, analytic, gamma, vm, line}."""
    text = Path(path).read_text(errors="replace")
    section = None
    cur = None
    out = {"species": [], "phases": []}
    for raw in text.splitlines():
        line = raw.split("#")[0].rstrip()
        if not line.strip():
            continue
        first = line.strip().split()[0]
        if not line.startswith((" ", "\t")) and first in SECTIONS:
            section = first
            cur = None
            continue
        if section not in ("SOLUTION_SPECIES", "PHASES"):
            continue
        s = line.strip()
        indented = line.startswith((" ", "\t"))
        # reaction line
        if "=" in s and not s.startswith("-") and not re.match(r"^(log_?k|delta_?h)\b", s, re.I):
            rx = parse_reaction(s)
            if section == "SOLUTION_SPECIES":
                lhs_terms = split_terms(s.split("=", 1)[0])
                cur = {"name": None, "rxn": rx, "log_k": None, "delta_h_kj": None, "analytic": None, "gamma": None, "vm": None, "text": s,
                       "identity": lhs_terms[0][1] if rx == {} and len(lhs_terms) == 1 else None}
                out["species"].append(cur)
            else:
                if cur is not None and cur.get("rxn") is None:
                    cur["rxn"] = rx
                    cur["text"] = s
                elif cur is None:
                    pass
            continue
        if section == "PHASES" and not indented:
            name = re.sub(r"\s+\d+$", "", s)  # wateq4f appends an index number
            cur = {"name": name, "rxn": None, "log_k": None, "delta_h_kj": None, "analytic": None, "gamma": None, "vm": None, "text": None}
            out["phases"].append(cur)
            continue
        if cur is None:
            continue
        # parameter lines (several per line possible: "-log_k -8.45; -delta_h -3.15 kcal")
        for part in s.split(";"):
            part = part.strip()
            m = re.match(r"^-?log_?k\s+(\S+)", part, re.I)
            if m:
                try:
                    cur["log_k"] = _num(m.group(1))
                except ValueError:
                    pass
                continue
            m = re.match(r"^-?delta_?h\s+(\S+)\s*(\S+)?", part, re.I)
            if m:
                try:
                    cur["delta_h_kj"] = _dh_kj(m.group(1), m.group(2))
                except ValueError:
                    pass
                continue
            m = re.match(r"^-analyt\w*\s+(.*)$", part, re.I)
            if m:
                try:
                    cur["analytic"] = [_num(x) for x in m.group(1).split()[:6]]
                except ValueError:
                    pass
                continue
            m = re.match(r"^-(?:llnl_)?gamma\s+(\S+)(?:\s+(\S+))?", part, re.I)
            if m:
                try:
                    cur["gamma"] = (_num(m.group(1)), _num(m.group(2)) if m.group(2) else None)
                except ValueError:
                    pass
                continue
            m = re.match(r"^-Vm\s+(\S+)", part, re.I)
            if m:
                try:
                    cur["vm"] = _num(m.group(1))
                except ValueError:
                    pass
    # species rows: the species name is the one that is produced with coefficient 1 and does not appear on the left
    for sp in out["species"]:
        if sp.get("identity"):
            sp["name"] = sp["identity"]  # a master species: "Na+ = Na+"
        elif sp["rxn"]:
            prods = [k for k, v in sp["rxn"].items() if v > 0]
            sp["name"] = prods[0] if len(prods) == 1 else None
    out["species"] = [s for s in out["species"] if (s["rxn"] or s.get("identity")) and s["log_k"] is not None]
    # a phase is named by its first reactant: the phase's own formula
    for ph in out["phases"]:
        if ph["rxn"]:
            reac = [k for k, v in ph["rxn"].items() if v < 0]
            ph["solid"] = reac[0] if reac else None
    out["phases"] = [p for p in out["phases"] if p["rxn"] and p["log_k"] is not None]
    return out


LOG_KW = -14.0  # only the fallback: the water row of the file itself is used when present
DH_W = 55.8


def species_defs(db):
    """map name -> (rxn, log_k, delta_h_kj) of derived species (the species appearing alone on the right)"""
    defs = {}
    for sp in db["species"]:
        n = sp["name"]
        if n and len(sp["rxn"]) > 1 and sp["rxn"].get(n, 0) > 0:
            defs.setdefault(n, sp)
    return defs


def reduce_reaction(rxn, log_k, dh, solid, basis, defs, water):
    """Rewrites rxn (products positive) so that only `solid` and species of `basis` remain.

    H+ is removed with the water reaction `water` ({H+: 1, OH-: 1, H2O: -1}); species outside the basis are replaced by their
    definition in `defs` (a derived species is replaced by the masters it is made of: the definition reaction is added
    with a negative multiplier). Returns (rxn, log_k, dh_kj or None) or None when the reaction cannot be written with the
    basis alone (redox electrons, a remaining H2O, a species without a definition)."""
    v = dict(rxn)
    lk = log_k
    d = dh
    wk, wdh = water
    for _ in range(40):
        bad = [s for s, c in v.items() if abs(c) > 1e-9 and s != solid and s not in basis]
        if not bad:
            return v, lk, d
        # H+ first (it creates H2O / OH-), the derived species next, H2O and electrons only fail when still there
        bad.sort(key=lambda x: (x in ("H2O", "e-"), x != "H+"))
        s = bad[0]
        c = v[s]
        if s == "e-" or s == "H2O":
            return None
        if s == "H+":
            # cancel H+ with H2O = H+ + OH-
            mult = -c
            for k, x in (("H+", 1.0), ("OH-", 1.0), ("H2O", -1.0)):
                v[k] = v.get(k, 0.0) + mult * x
            lk += mult * wk
            d = None if (d is None or wdh is None) else d + mult * wdh
        else:
            sd = defs.get(s)
            if sd is None:
                return None
            # sd: S is a product with coefficient a; adding mult*sd removes S
            a = sd["rxn"][s]
            mult = -c / a
            for k, x in sd["rxn"].items():
                v[k] = v.get(k, 0.0) + mult * x
            lk += mult * sd["log_k"]
            d = None if (d is None or sd["delta_h_kj"] is None) else d + mult * sd["delta_h_kj"]
        v = {k: x for k, x in v.items() if abs(x) > 1e-9}
    return None
