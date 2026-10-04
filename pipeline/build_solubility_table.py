"""
Builds engine/data/solubility.json from the compiled solubility-product and acid/base equilibrium tables in
pipeline/data/*.csv.  The Rust engine embeds the JSON (include_str!) and loads every row as a registered mineral /
equilibrium, so any cation/anion pair present in a vessel with IAP > Ksp precipitates - no per-compound code.

    python3 pipeline/build_solubility_table.py

The script validates each row (charge balance, element conservation of solid vs. ions) before writing.
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT.parent / "engine" / "data" / "solubility.json"


def parse_formula(f):
    """Element counts of a formula with nested parentheses (no charge)."""
    pos = 0

    def group(depth):
        nonlocal pos
        out = {}
        while pos < len(f):
            c = f[pos]
            if c in "([":
                pos += 1
                inner = group(depth + 1)
                m = re.match(r"\d+", f[pos:])
                mult = int(m.group()) if m else 1
                pos += len(m.group()) if m else 0
                for k, v in inner.items():
                    out[k] = out.get(k, 0) + v * mult
            elif c in ")]":
                pos += 1
                return out
            else:
                m = re.match(r"([A-Z][a-z]?)(\d*)", f[pos:])
                if not m:
                    raise ValueError(f"bad formula {f!r} at {pos}")
                out[m.group(1)] = out.get(m.group(1), 0) + (int(m.group(2)) if m.group(2) else 1)
                pos += len(m.group())
        return out

    return group(0)


def split_charge(ion):
    m = re.match(r"^(.*?)([+-])(\d*)$", ion)
    if not m:
        return ion, 0
    body, sign, mag = m.groups()
    z = int(mag) if mag else 1
    return body, z if sign == "+" else -z


# Anion/ion ids whose element formula differs from the id text
ID_FORMULA = {"CH3COO": "C2H3O2", "Fe(CN)6": "FeC6N6"}


def ion_elements(ion):
    body, z = split_charge(ion)
    body = ID_FORMULA.get(body, body)
    return parse_formula(body), z


def parse_stoich(text):
    out = {}
    for part in text.split("|"):
        sp, n = part.rsplit(":", 1)
        out[sp] = float(n)
    return out


def srgb_to_linear(hex_colour):
    h = hex_colour.lstrip("#")
    rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return [round(((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92, 4) for c in rgb]


def rows(path):
    with open(path, newline="") as fh:
        lines = [ln for ln in fh if ln.strip() and not ln.lstrip().startswith("#")]
    return list(csv.DictReader(lines))


def interfacial_energies(known_formulas):
    """Optional measured solid-water interfacial energies (pipeline/data/interfacial_energies.csv), mJ/m^2 -> J/m^2."""
    path = DATA / "interfacial_energies.csv"
    out = {}
    if not path.exists():
        return out
    for r in rows(path):
        f = r["formula"].strip()
        if f not in known_formulas:
            raise ValueError(f"interfacial_energies.csv: {f} is not a solid of solubility_products.csv")
        gamma = float(r["gamma_mj_m2"]) * 1e-3
        if not 0.005 <= gamma <= 1.0:
            raise ValueError(f"interfacial_energies.csv: {f}: {r['gamma_mj_m2']} mJ/m^2 is outside 5-1000")
        out[f] = (gamma, r["source"].strip())
    return out


def build():
    minerals = []
    for r in rows(DATA / "solubility_products.csv"):
        ions = parse_stoich(r["ions"])
        # validation: solid formula = sum of ion elements, and charge balance
        solid = parse_formula(r["formula"])
        total = {}
        charge = 0.0
        for ion, n in ions.items():
            el, z = ion_elements(ion)
            charge += z * n
            for k, v in el.items():
                total[k] = total.get(k, 0) + v * n
        if abs(charge) > 1e-9:
            raise ValueError(f"{r['formula']}: ions not charge balanced ({charge})")
        # the hydroxide/oxide special cases (AgOH written as Ag2O-like solid) still balance by H/O
        if total != solid:
            raise ValueError(f"{r['formula']}: ion elements {total} != solid {solid}")
        soluble = float(r["log_ksp"]) > 0
        minerals.append({
            "id": f"{r['formula']}_tbl",
            "mineral": r["name"],
            "formula": r["formula"],
            "solid_species": f"{r['formula']}(s)",
            "dissolved_products": ions,
            "log_ksp_298": float(r["log_ksp"]),
            "delta_h_kj": float(r["dh_kj"]),
            "solid_color": srgb_to_linear(r["colour"]),
            "density_g_ml": float(r["density"]),
            "default_particle_um": {"curds": 2.0, "gel": 5.0, "crystal": 40.0}.get(r["kind"], 8.0),
            "kind": r["kind"],
            "tier": "Tabulated",
            "source": "CRC Handbook solubility table (solubility limit)" if soluble else "CRC Handbook Ksp table",
        })

    gammas = interfacial_energies({m["formula"] for m in minerals})
    for m in minerals:
        if m["formula"] in gammas:
            m["interfacial_energy_j_m2"], m["interfacial_energy_source"] = gammas[m["formula"]]

    equilibria = []
    for r in rows(DATA / "acid_base_equilibria.csv"):
        reac = parse_stoich(r["reactants"])
        prod = parse_stoich(r["products"])
        equilibria.append({
            "id": r["id"],
            "name": r["name"],
            "equation": " + ".join(f"{int(n) if n != 1 else ''}{s}" for s, n in reac.items())
            + " <=> "
            + " + ".join(f"{int(n) if n != 1 else ''}{s}" for s, n in prod.items()),
            "reactants": reac,
            "products": prod,
            "log_k_298": float(r["log_k"]),
            "delta_h_kj": float(r["dh_kj"]),
            "tier": "Tabulated",
            "source": r["source"],
        })
    # rows the CSV tables do not hold (pipeline/data/extra_rows.json): appended after the CSV rows
    extra = json.loads((DATA / "extra_rows.json").read_text())
    drop = set(extra.get("remove", []))
    minerals = [m for m in minerals if m["id"] not in drop]
    equilibria = [e for e in equilibria if e["id"] not in drop]
    for m in minerals:
        m.update(extra.get("override", {}).get(m["id"], {}))
    minerals += extra.get("minerals", [])
    equilibria += extra.get("equilibria", [])
    return {"version": 1, "minerals": minerals, "equilibria": equilibria}


if __name__ == "__main__":
    data = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {OUT}: {len(data['minerals'])} minerals, {len(data['equilibria'])} equilibria")
