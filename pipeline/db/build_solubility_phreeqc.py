#!/usr/bin/env python3
"""Solubility products from the PHREEQC-format thermodynamic databases (X2 of docs/plans/data-acquisition-plan.md).

    pipeline/raw/phreeqc/{wateq4f,minteq.v4,phreeqc,llnl,PHREEQC_Thermoddem...}.dat
        --(this script)-->  pipeline/data/solubility_products_phreeqc.csv

Every mineral dissolution reaction of the databases is rewritten in terms of plain dissolved ions (H+ / H2O removed with
the file's own water reaction, protonated and complexed forms replaced by the file's own species reactions), so that it
is a solubility product  solid = sum(n_i ion_i)  with log K at 25 C and dH.  Reactions that need redox electrons, a
remaining water molecule (oxides, hydrates) or a species the engine does not hold are not representable and are skipped
(they are reported).  One row per solid formula: the database priority is wateq4f, minteq.v4, phreeqc, llnl, Thermoddem;
within a database the least soluble polymorph is taken.  Formulas that pipeline/data/solubility_products.csv (CRC table)
already holds are not repeated here; their disagreement with the databases is printed as an audit.

The databases are public domain (USGS PHREEQC) or openly licensed (Thermoddem, BRGM); see docs/data-licences.md.
"""
import csv
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import parse_phreeqc_db as pp  # noqa: E402
from engine_elements import known_elements  # noqa: E402
from build_solubility_table import parse_formula, ion_elements  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "pipeline" / "raw" / "phreeqc"
OUT = ROOT / "pipeline" / "data" / "solubility_products_phreeqc.csv"

DATABASES = [
    ("wateq4f.dat", "PHREEQC wateq4f.dat"),
    ("minteq.v4.dat", "PHREEQC minteq.v4.dat"),
    ("phreeqc.dat", "PHREEQC phreeqc.dat"),
    ("llnl.dat", "PHREEQC llnl.dat (LLNL data0, SUPCRT92)"),
    ("PHREEQC_ThermoddemV1.10_15Dec2020.dat", "Thermoddem V1.10 (BRGM)"),
]

# dissolved basis anions (fully deprotonated masters); cations are every monatomic / small cation the store holds
BASIS_ANIONS = [
    "F-", "Cl-", "Br-", "I-", "OH-", "S-2", "CO3-2", "SO4-2", "SO3-2", "PO4-3", "AsO4-3", "AsO3-3", "NO3-", "NO2-", "CrO4-2",
    "MoO4-2", "WO4-2", "SeO4-2", "SeO3-2", "IO3-", "BrO3-", "ClO3-", "ClO4-", "SCN-", "CN-", "C2O4-2", "VO4-3", "BO2-",
    "S2O3-2", "MnO4-", "Fe(CN)6-4", "Fe(CN)6-3", "B4O7-2", "S2O8-2", "SiF6-2", "BF4-",
]


def store_ions():
    """ion ids the engine's store holds (tabulated + seeds)"""
    ids = set()
    tab = json.loads((ROOT / "engine" / "data" / "species_tabulated.json").read_text())
    ids |= {r["id"] for r in tab["rows"] if r["phase"] == "aq" and r["charge"] != 0}
    inorg = json.loads((ROOT / "engine" / "data" / "species_inorganic.json").read_text())
    ids |= {r[0] for r in inorg["aq"] if r[2] != 0}
    seed = (ROOT / "engine" / "src" / "db" / "seed.rs").read_text()
    for m in re.finditer(r'make_aq\("([^"]+)", "[^"]+", (-?\d+)', seed):
        if int(m.group(2)) != 0:
            ids.add(m.group(1))
    return ids


PROTONATED = ["HPO4-2", "H2PO4-", "HCO3-", "HS-", "HSO4-", "H2AsO4-", "HAsO4-2", "HSeO3-", "HCrO4-", "HSO3-"]


def is_basis_cation(ion):
    # monatomic or the engine's polyatomic cations (never the proton)
    if ion == "H+":
        return False
    return bool(re.fullmatch(r"[A-Z][a-z]?\d?\+\d?", ion)) or ion in ("NH4+", "UO2+2", "UO2+", "VO+2", "VO2+", "Hg2+2", "Pb2+2")


def audit_value(formula, ours, existing):
    return abs(ours - existing)


def read_existing():
    path = ROOT / "pipeline" / "data" / "solubility_products.csv"
    rows = [ln for ln in open(path) if ln.strip() and not ln.lstrip().startswith("#")]
    return {r["formula"]: r for r in csv.DictReader(rows)}


def obigt_density(formula):
    tab = json.loads((ROOT / "engine" / "data" / "species_tabulated.json").read_text())
    return {r["formula"]: r["density"] for r in tab["rows"] if r["phase"] == "s" and r["density"]}


def main():
    held = store_ions()
    basis = {a for a in BASIS_ANIONS if a in held} | {i for i in held if is_basis_cation(i)}
    basis.add("OH-")
    existing = read_existing()
    dens = obigt_density(None)
    result = {}
    stats = {}
    audit = []
    for fname, label in DATABASES:
        path = RAW / fname
        if not path.exists():
            continue
        db = pp.read(path)
        defs = pp.species_defs(db)
        water = None
        for sp in db["species"]:
            if sp["rxn"] == {"H2O": -1.0, "H+": 1.0, "OH-": 1.0}:
                water = (sp["log_k"], sp["delta_h_kj"])
        if water is None:
            water = (-14.0, 55.8)
        ok = fail = 0
        for ph in db["phases"]:
            solid = ph.get("solid")
            if not solid or ":" in solid or "." in solid and not re.search(r"\.\d", solid):
                continue
            if ":" in solid or re.search(r"\d\.\d", solid):
                continue
            if ph["rxn"].get(solid, 0) >= 0:
                continue
            red = pp.reduce_reaction(ph["rxn"], ph["log_k"], ph["delta_h_kj"], solid, basis, defs, water)
            if red is None:
                # second try: protonated anions are allowed as dissolved ions (BaHPO4 = Ba+2 + HPO4-2)
                red = pp.reduce_reaction(ph["rxn"], ph["log_k"], ph["delta_h_kj"], solid, basis | {p for p in PROTONATED if p in held}, defs, water)
            if red is None:
                fail += 1
                continue
            v, lk, dh = red
            a = -v.get(solid, 0)
            if a <= 0:
                fail += 1
                continue
            ions = {k: x / a for k, x in v.items() if k != solid}
            if any(x <= 0 for x in ions.values()) or not ions:
                fail += 1
                continue
            # stoichiometries must be small integers
            if any(abs(x - round(x)) > 1e-6 for x in ions.values()):
                fail += 1
                continue
            ions = {k: int(round(x)) for k, x in ions.items()}
            if solid.startswith("(") and solid.endswith(")"):
                continue
            try:
                sel = parse_formula(solid)
                tot, charge = {}, 0
                for ion, n in ions.items():
                    el, z = ion_elements(ion)
                    charge += z * n
                    for k, x in el.items():
                        tot[k] = tot.get(k, 0) + x * n
            except Exception:
                fail += 1
                continue
            if charge != 0 or tot != sel or not set(sel) <= known_elements():
                fail += 1
                continue
            lk, dh_val = lk / a, (dh / a if dh is not None else 0.0)
            if lk > 3.0:
                # an anhydrous very soluble salt: its K is not a saturation limit (the stable solid in contact with the
                # solution is a hydrate); the model treats such salts as always soluble
                continue
            ok += 1
            key = solid
            rec = dict(formula=solid, name=ph["name"], ions="|".join(f"{k}:{n}" for k, n in sorted(ions.items())), log_ksp=lk, dh_kj=dh_val,
                       source=f"{label} (phase {ph['name']})", db=fname)
            if key in existing:
                audit.append((solid, float(existing[key]["log_ksp"]), lk, label))
                continue
            if key in result:
                # earlier database wins; within one database the least soluble polymorph
                if result[key]["db"] == fname and lk < result[key]["log_ksp"]:
                    result[key] = rec
                continue
            result[key] = rec
        stats[fname] = (ok, fail)
    print("per database (ok, not representable):", stats)
    print("new solids:", len(result))
    # density and colour columns
    out_rows = []
    for key, r in sorted(result.items()):
        d = dens.get(key, "")
        out_rows.append(dict(formula=key, name=r["name"], ions=r["ions"], log_ksp=f"{r['log_ksp']:.4f}", dh_kj=f"{r['dh_kj']:.2f}",
                             colour="", kind="", density=f"{d:.3f}" if d else "", source=r["source"], tier="Tabulated"))
    with open(OUT, "w", newline="") as fh:
        fh.write("# Solubility products read from the PHREEQC-format databases by pipeline/db/build_solubility_phreeqc.py (do not edit).\n")
        fh.write("# Same columns as solubility_products.csv plus source and tier; blank colour / kind / density fall back to the model\n")
        fh.write("# (ion hue rules, anion appearance kind, crystal density from ion sizes).\n")
        w = csv.DictWriter(fh, fieldnames=["formula", "name", "ions", "log_ksp", "dh_kj", "colour", "kind", "density", "source", "tier"])
        w.writeheader()
        w.writerows(out_rows)
    # audit of the formulas the CRC table already holds
    audit.sort(key=lambda t: -abs(t[1] - t[2]))
    print(f"audit: {len(audit)} formulas in both; rms difference {((sum((a[1]-a[2])**2 for a in audit)/max(1,len(audit)))**0.5):.2f} log units")
    for a in audit[:25]:
        print(f"   {a[0]:12s} CRC table {a[1]:8.2f}   database {a[2]:8.2f}   ({a[3]})")


if __name__ == "__main__":
    main()
