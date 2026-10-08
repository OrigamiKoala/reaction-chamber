#!/usr/bin/env python3
"""Reference osmotic coefficients for engine/tests/pitzer_temperature.rs: PHREEQC (phreeqpython, pitzer.dat) water activity
of single-salt solutions, phi = -ln a_w / (M_w * sum m_i).  Independent implementation of the same Pitzer equations."""
import json
import math
from pathlib import Path
from phreeqpython import PhreeqPython

ROOT = Path(__file__).resolve().parents[1]
pp = PhreeqPython(database="pitzer.dat", database_directory=ROOT / "pipeline" / "raw" / "phreeqc")
SALTS = {"NaCl": ({"Na": 1, "Cl": 1}, 2), "KCl": ({"K": 1, "Cl": 1}, 2), "Na2SO4": ({"Na": 2, "S(6)": 1}, 3), "CaCl2": ({"Ca": 1, "Cl": 2}, 3)}
rows = []
for salt, (el, nions) in SALTS.items():
    for t in (25, 60, 100):
        for m in (0.1, 0.5, 1.0, 2.0):
            comp = "\n".join(f" {k} {v * m}" for k, v in el.items())
            inp = f"SOLUTION 1\n units mol/kgw\n temp {t}\n{comp}\n"
            inp += "USER_PUNCH 1\n -headings aw\n 10 PUNCH ACT(\"H2O\")\nSELECTED_OUTPUT 1\n -reset false\n -user_punch true\nEND\n"
            pp.ip.run_string(inp)
            aw = pp.ip.get_selected_output_array()[1][0]
            phi = -math.log(aw) / (0.01801528 * nions * m)
            rows.append({"salt": salt, "t_c": t, "m": m, "phi": round(phi, 5)})
out = ROOT / "engine" / "tests" / "data" / "pitzer_osmotic_reference.json"
out.write_text(json.dumps({"source": "PHREEQC 3 (phreeqpython), pitzer.dat; phi = -ln aw / (Mw nu m)", "rows": rows}, indent=1) + "\n")
print(len(rows), "rows;", [r for r in rows if r["salt"] == "NaCl" and r["m"] == 1.0])
