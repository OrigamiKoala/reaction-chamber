#!/usr/bin/env python3
"""Metal-ligand complexes and ion pairs (A1 / X2 of docs/plans/data-acquisition-plan.md) -> engine/data/complexes.json.

Reads the species reactions of the PHREEQC-format databases (minteq.v4.dat from the MINTEQA2 / NIST compilation, wateq4f.dat,
llnl.dat, phreeqc.dat, Thermoddem) that form one product from a metal cation and n identical ligands (hydroxo complexes
included: the H+ is removed with the file's water reaction), with log beta at 25 C and zero ionic strength and the
reaction enthalpy.  One row per product, the first database in the priority order above that holds it.  A product the store
already holds under another id (same elements and charge: FeSCN+2 / Fe(SCN)+2) keeps the store's id, so its formation data
are shared.  The 35 hand-typed rows of the earlier version are kept only where no database row covers the same
metal / ligand / n.  Pairs of K < 1 (log beta < 0) are not rows.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import parse_phreeqc_db as pp
from engine_elements import known_elements
from build_solubility_table import parse_formula, split_charge
from build_solubility_phreeqc import store_ions, BASIS_ANIONS, PROTONATED, is_basis_cation

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "pipeline" / "raw" / "phreeqc"
OUT = ROOT / "engine" / "data" / "complexes.json"

DATABASES = [("minteq.v4.dat", "PHREEQC minteq.v4.dat (MINTEQA2 / NIST SRD 46 compilations)"), ("wateq4f.dat", "PHREEQC wateq4f.dat"),
             ("llnl.dat", "PHREEQC llnl.dat (LLNL data0)"), ("phreeqc.dat", "PHREEQC phreeqc.dat"), ("PHREEQC_ThermoddemV1.10_15Dec2020.dat", "Thermoddem V1.10 (BRGM)")]
LIGANDS_EXTRA = ["NH3"]


def element_key(ion):
    el, z = parse_formula_charge(ion)
    return (tuple(sorted(el.items())), z)


def parse_formula_charge(ion):
    body, z = split_charge(ion)
    return parse_formula(body), z


def main():
    held = store_ions()
    tab = json.loads((ROOT / "engine" / "data" / "species_tabulated.json").read_text())
    inorg = json.loads((ROOT / "engine" / "data" / "species_inorganic.json").read_text())
    seed = (ROOT / "engine" / "src" / "db" / "seed.rs").read_text()
    all_aq = {r["id"] for r in tab["rows"] if r["phase"] == "aq"} | {r[0] for r in inorg["aq"]} | set(re.findall(r'make_aq\w*\("([^"]+)"', seed))
    by_key = {}
    for i in all_aq:
        try:
            by_key.setdefault(element_key(i), i)
        except Exception:
            pass
    ligands = {a for a in BASIS_ANIONS if a in held} | {p for p in PROTONATED if p in held} | set(LIGANDS_EXTRA)
    metals = {i for i in held if is_basis_cation(i)}
    rows = {}
    hand = json.loads((ROOT / "pipeline" / "data" / "complexes_hand.json").read_text())["complexes"]
    for fname, label in DATABASES:
        path = RAW / fname
        if not path.exists():
            continue
        db = pp.read(path)
        defs = pp.species_defs(db)
        water = (-14.0, 55.8)
        for sp in db["species"]:
            if sp["rxn"] == {"H2O": -1.0, "H+": 1.0, "OH-": 1.0}:
                water = (sp["log_k"], sp["delta_h_kj"])
        for sp in db["species"]:
            prod = sp["name"]
            if not prod or not sp["rxn"] or sp["rxn"].get(prod, 0) != 1.0:
                continue
            allowed = metals | ligands | {"OH-"}
            red = pp.reduce_reaction(sp["rxn"], sp["log_k"], sp["delta_h_kj"], prod, allowed, {}, water)
            if red is None:
                continue
            v, lk, dh = red
            reac = {k: -x for k, x in v.items() if k != prod and x < 0}
            if any(x > 0 for k, x in v.items() if k != prod) or len(reac) != 2:
                continue
            ms = [k for k in reac if k in metals]
            ls = [k for k in reac if k in ligands or k == "OH-"]
            if len(ms) != 1 or len(ls) != 1 or reac[ms[0]] != 1.0:
                continue
            n = reac[ls[0]]
            if abs(n - round(n)) > 1e-6 or n < 1:
                continue
            n = int(round(n))
            # (weak pairs are dropped after the priority order has been applied, so a lower-priority database cannot fill in)
            # the product's identity in the store
            try:
                key = element_key(prod)
            except Exception:
                continue
            if not {e for e, _ in key[0]} <= known_elements():
                continue
            pid = by_key.get(key, prod)
            ident = (ms[0], ls[0], n)
            if any(r["metal"] == ms[0] and r["ligand"] == ls[0] and r["n"] == n for r in rows.values()):
                continue
            if pid in rows:
                continue
            rows[pid] = {"metal": ms[0], "ligand": ls[0], "n": n, "product": pid, "log_beta": round(lk, 4),
                         "delta_h_kj": round(dh, 3) if dh is not None else None, "source": f"{label}, species {prod}", "tier": "Tabulated"}
    rows = {k: r for k, r in rows.items() if r["log_beta"] >= 0.0}
    kept = [h for h in hand if not any(r["metal"] == h["metal"] and r["ligand"] == h["ligand"] and r["n"] == h["n"] for r in rows.values())]
    out = sorted(rows.values(), key=lambda r: (r["metal"], r["ligand"], r["n"]))
    for h in kept:
        h = dict(h)
        h["delta_h_kj"] = None
        h["source"] = "Smith-Martell / CRC compilations, recalled (not covered by the databases)"
        h["tier"] = "Estimated"
        out.append(h)
    doc = {"_comment": "Stepwise-cumulative formation constants of metal-ligand complexes and ion pairs as equilibrium rows (E2 / A1): log10 beta_n at 25 C and zero ionic strength, reaction enthalpy dH (kJ/mol; null = not tabulated, taken as 0), tier and source per row. Generated by pipeline/db/build_complexes.py from the species reactions of the PHREEQC-format databases (minteq.v4, wateq4f, llnl, phreeqc, Thermoddem); rows marked Estimated are the earlier hand-typed values no database covers. A row is registered in a vessel when its metal and ligand are both present; ion pairs the table does not list are generated by Fuoss association (src/ion_pairing.rs).",
           "complexes": out}
    OUT.write_text(json.dumps(doc, indent=1) + "\n")
    print("rows:", len(out), "from databases:", len(rows), "hand rows kept:", len(kept), "dropped hand rows:", len(hand) - len(kept))
    for ident in [("Mg+2", "SO4-2"), ("Ca+2", "SO4-2"), ("Cu+2", "SO4-2"), ("Zn+2", "SO4-2"), ("Na+", "SO4-2"), ("Ca+2", "HCO3-"), ("Fe+3", "Cl-")]:
        for r in out:
            if (r["metal"], r["ligand"]) == ident:
                print("  ", r["metal"], r["ligand"], r["n"], r["product"], r["log_beta"], r["delta_h_kj"], r["tier"])


main()
