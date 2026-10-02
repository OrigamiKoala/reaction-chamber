#!/usr/bin/env python3
"""Build core data bundle shards for Reaction Chamber (Stage 1 generalization).

Merges curated intrinsic species records from:
- NBS Tables (A1)
- PHREEQC llnl.dat (A2)
- NASA CEA (A4)
- Curated bench species

Outputs sharded JSON files to web/public/data/core/:
- ions.json
- solids.json
- gases.json
- organics.json
- manifest.json
"""

import json
import os
import gzip
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = ROOT / "web" / "public" / "data" / "core"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

LICENCES = {
    "nbs-tables": {
        "name": "NBS Tables of Chemical Thermodynamic Properties",
        "licence": "NIST Open License / Public Domain",
        "url": "https://data.nist.gov/od/id/mds2-2124"
    },
    "phreeqc-llnl": {
        "name": "USGS PHREEQC llnl.dat",
        "licence": "USGS Public Domain",
        "url": "https://www.usgs.gov/software/phreeqc-version-3"
    },
    "nasa-cea": {
        "name": "NASA CEA thermo.inp",
        "licence": "Apache-2.0",
        "url": "https://www.grc.nasa.gov/WWW/CEAWeb/"
    },
    "curated-bench": {
        "name": "Reaction Chamber Curated Bench Compilation",
        "licence": "MIT",
        "url": "https://github.com/OrigamiKoala/reaction-chamber"
    }
}

# Core tabulated species definitions
CORE_SPECIES = [
    # Ions
    {
        "id": "ion:H+1",
        "identity": {"formula": "H+", "charge": 1, "smiles": "[H+]", "names": ["hydrogen ion", "hydronium"]},
        "phases": {
            "aq": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NBS Tables",
                           "dfH": {"value": 0.0, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": 0.0, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "ion:OH-1",
        "identity": {"formula": "OH-", "charge": -1, "smiles": "[OH-]", "names": ["hydroxide"]},
        "phases": {
            "aq": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NBS Tables",
                           "dfH": {"value": -230.0, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": -148.5, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "ion:Na+1",
        "identity": {"formula": "Na+", "charge": 1, "smiles": "[Na+]", "names": ["sodium ion"]},
        "phases": {
            "aq": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NBS Tables",
                           "dfH": {"value": -240.1, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": 46.4, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "ion:Cl-1",
        "identity": {"formula": "Cl-", "charge": -1, "smiles": "[Cl-]", "names": ["chloride"]},
        "phases": {
            "aq": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NBS Tables",
                           "dfH": {"value": -167.2, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": -136.4, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "ion:SO4-2",
        "identity": {"formula": "SO4-2", "charge": -2, "smiles": "[O-]S(=O)(=O)[O-]", "names": ["sulfate"]},
        "phases": {
            "aq": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NBS Tables",
                           "dfH": {"value": -909.3, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": -293.0, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    # Solids with exact llnl-consistent Ksp/formation values
    {
        "id": "s:AgCl:cerargyrite",
        "identity": {"formula": "AgCl", "charge": 0, "names": ["silver chloride", "cerargyrite"]},
        "phases": {
            "s": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "PHREEQC llnl.dat",
                           "dfH": {"value": -127.07, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": 50.8, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}},
                "rho": {"value": 5.56, "unit": "g/mL", "tier": "tabulated", "source": "CRC Handbook"},
                "polymorph": "cerargyrite"
            }
        },
        "points": [
            {"kind": "solubility", "solvent": "water", "T_K": 298.15, "value": 0.0019, "unit": "g/L", "tier": "tabulated", "source": "llnl.dat"}
        ],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "s:PbI2:solid",
        "identity": {"formula": "PbI2", "charge": 0, "names": ["lead(II) iodide"]},
        "phases": {
            "s": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "PHREEQC llnl.dat",
                           "dfH": {"value": -175.5, "unit": "kJ/mol", "tier": "tabulated", "source": "llnl.dat"},
                           "cp": {"value": 77.0, "unit": "J/(mol K)", "tier": "tabulated", "source": "llnl.dat"}},
                "rho": {"value": 6.16, "unit": "g/mL", "tier": "tabulated", "source": "CRC Handbook"}
            }
        },
        "points": [
            {"kind": "solubility", "solvent": "water", "T_K": 298.15, "value": 0.76, "unit": "g/L", "tier": "tabulated", "source": "llnl.dat"}
        ],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "s:BaSO4:barite",
        "identity": {"formula": "BaSO4", "charge": 0, "names": ["barium sulfate", "barite"]},
        "phases": {
            "s": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "PHREEQC llnl.dat",
                           "dfH": {"value": -1473.2, "unit": "kJ/mol", "tier": "tabulated", "source": "llnl.dat"},
                           "cp": {"value": 101.8, "unit": "J/(mol K)", "tier": "tabulated", "source": "llnl.dat"}},
                "rho": {"value": 4.50, "unit": "g/mL", "tier": "tabulated", "source": "CRC Handbook"}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "s:CaCO3:calcite",
        "identity": {"formula": "CaCO3", "charge": 0, "names": ["calcium carbonate", "calcite"]},
        "phases": {
            "s": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "PHREEQC llnl.dat",
                           "dfH": {"value": -1207.6, "unit": "kJ/mol", "tier": "tabulated", "source": "llnl.dat"},
                           "cp": {"value": 81.9, "unit": "J/(mol K)", "tier": "tabulated", "source": "llnl.dat"}},
                "rho": {"value": 2.71, "unit": "g/mL", "tier": "tabulated", "source": "CRC Handbook"}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "s:Fe(OH)3:solid",
        "identity": {"formula": "Fe(OH)3", "charge": 0, "names": ["iron(III) hydroxide"]},
        "phases": {
            "s": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "PHREEQC llnl.dat",
                           "dfH": {"value": -823.0, "unit": "kJ/mol", "tier": "tabulated", "source": "llnl.dat"},
                           "cp": {"value": 105.0, "unit": "J/(mol K)", "tier": "tabulated", "source": "llnl.dat"}},
                "rho": {"value": 3.40, "unit": "g/mL", "tier": "tabulated", "source": "CRC Handbook"}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "s:ZnF2:solid",
        "identity": {"formula": "ZnF2", "charge": 0, "names": ["zinc fluoride"]},
        "phases": {
            "s": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "PHREEQC llnl.dat",
                           "dfH": {"value": -764.4, "unit": "kJ/mol", "tier": "tabulated", "source": "llnl.dat"},
                           "cp": {"value": 65.0, "unit": "J/(mol K)", "tier": "tabulated", "source": "llnl.dat"}},
                "rho": {"value": 4.95, "unit": "g/mL", "tier": "tabulated", "source": "CRC Handbook"}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    # Gases
    {
        "id": "g:CO2",
        "identity": {"formula": "CO2", "charge": 0, "inchikey": "CURLTUGMZLYLDI-UHFFFAOYSA-N", "smiles": "O=C=O", "names": ["carbon dioxide"]},
        "phases": {
            "g": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NASA CEA",
                           "dfH": {"value": -393.51, "unit": "kJ/mol", "tier": "tabulated", "source": "NASA CEA"},
                           "cp": {"value": 37.1, "unit": "J/(mol K)", "tier": "tabulated", "source": "NASA CEA"}}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "g:O2",
        "identity": {"formula": "O2", "charge": 0, "inchikey": "MYMOFIZGZYHOMD-UHFFFAOYSA-N", "smiles": "O=O", "names": ["oxygen"]},
        "phases": {
            "g": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NASA CEA",
                           "dfH": {"value": 0.0, "unit": "kJ/mol", "tier": "tabulated", "source": "NASA CEA"},
                           "cp": {"value": 29.4, "unit": "J/(mol K)", "tier": "tabulated", "source": "NASA CEA"}}
            }
        },
        "points": [],
        "acid_base": [],
        "redox": []
    },
    # Organics
    {
        "id": "ik:LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
        "identity": {"formula": "C2H6O", "charge": 0, "inchikey": "LFQSCWFLJHTTHZ-UHFFFAOYSA-N", "smiles": "CCO", "cas": "64-17-5", "cid": 702, "names": ["ethanol"]},
        "phases": {
            "l": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NBS Tables",
                           "dfH": {"value": -277.69, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": 112.3, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}},
                "rho": {"value": 0.789, "unit": "g/mL", "tier": "tabulated", "source": "CRC Handbook"}
            },
            "g": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NASA CEA",
                           "dfH": {"value": -235.3, "unit": "kJ/mol", "tier": "tabulated", "source": "NASA CEA"},
                           "cp": {"value": 65.4, "unit": "J/(mol K)", "tier": "tabulated", "source": "NASA CEA"}}
            }
        },
        "critical": {
            "Tc": {"value": 514.0, "unit": "K", "tier": "tabulated", "source": "NIST WebBook"},
            "Pc": {"value": 6140000.0, "unit": "Pa", "tier": "tabulated", "source": "NIST WebBook"}
        },
        "points": [
            {"kind": "tb", "T_K": 351.44, "P_Pa": 101325, "tier": "tabulated", "source": "NIST WebBook"},
            {"kind": "psat", "T_K": 351.44, "P_Pa": 101325, "tier": "tabulated", "source": "NIST WebBook"},
            {"kind": "tm", "T_K": 159.0, "P_Pa": 101325, "tier": "tabulated", "source": "NIST WebBook"}
        ],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "ik:XLYOFNOQVPJJNP-UHFFFAOYSA-N",
        "identity": {"formula": "H2O", "charge": 0, "inchikey": "XLYOFNOQVPJJNP-UHFFFAOYSA-N", "smiles": "O", "cas": "7732-18-5", "cid": 962, "names": ["water"]},
        "phases": {
            "l": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "IAPWS / NBS",
                           "dfH": {"value": -285.83, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": 75.38, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}},
                "rho": {"value": 0.997, "unit": "g/mL", "tier": "tabulated", "source": "IAPWS"}
            },
            "g": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NASA CEA",
                           "dfH": {"value": -241.82, "unit": "kJ/mol", "tier": "tabulated", "source": "NASA CEA"},
                           "cp": {"value": 33.6, "unit": "J/(mol K)", "tier": "tabulated", "source": "NASA CEA"}}
            }
        },
        "points": [
            {"kind": "tb", "T_K": 373.15, "P_Pa": 101325, "tier": "tabulated", "source": "IAPWS"},
            {"kind": "tm", "T_K": 273.15, "P_Pa": 101325, "tier": "tabulated", "source": "IAPWS"}
        ],
        "acid_base": [],
        "redox": []
    },
    {
        "id": "ik:QTBSBXVTEAMEQO-UHFFFAOYSA-N",
        "identity": {"formula": "C2H4O2", "charge": 0, "inchikey": "QTBSBXVTEAMEQO-UHFFFAOYSA-N", "smiles": "CC(=O)O", "cas": "64-19-7", "cid": 176, "names": ["acetic acid"]},
        "phases": {
            "l": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NBS Tables",
                           "dfH": {"value": -484.5, "unit": "kJ/mol", "tier": "tabulated", "source": "NBS Tables"},
                           "cp": {"value": 124.0, "unit": "J/(mol K)", "tier": "tabulated", "source": "NBS Tables"}},
                "rho": {"value": 1.049, "unit": "g/mL", "tier": "tabulated", "source": "CRC Handbook"}
            }
        },
        "points": [
            {"kind": "tb", "T_K": 391.2, "P_Pa": 101325, "tier": "tabulated", "source": "NIST WebBook"},
            {"kind": "tm", "T_K": 289.8, "P_Pa": 101325, "tier": "tabulated", "source": "NIST WebBook"}
        ],
        "acid_base": [
            {"site": "carboxyl", "pKa": {"value": 4.756, "unit": "pKa", "tier": "tabulated", "source": "PHREEQC"}}
        ],
        "redox": []
    },
    {
        "id": "ik:BSYNRYMUTXBXSQ-UHFFFAOYSA-N",
        "identity": {"formula": "C2H6O", "charge": 0, "inchikey": "BSYNRYMUTXBXSQ-UHFFFAOYSA-N", "smiles": "COC", "cas": "115-10-6", "cid": 8254, "names": ["dimethyl ether"]},
        "phases": {
            "g": {
                "thermo": {"model": "point+cp", "tier": "tabulated", "source": "NASA CEA",
                           "dfH": {"value": -184.1, "unit": "kJ/mol", "tier": "tabulated", "source": "NASA CEA"},
                           "cp": {"value": 65.6, "unit": "J/(mol K)", "tier": "tabulated", "source": "NASA CEA"}}
            }
        },
        "points": [
            {"kind": "tb", "T_K": 249.1, "P_Pa": 101325, "tier": "tabulated", "source": "NIST WebBook"},
            {"kind": "tm", "T_K": 131.7, "P_Pa": 101325, "tier": "tabulated", "source": "NIST WebBook"}
        ],
        "acid_base": [],
        "redox": []
    }
]

def build():
    ions = [s for s in CORE_SPECIES if s["id"].startswith("ion:")]
    solids = [s for s in CORE_SPECIES if s["id"].startswith("s:")]
    gases = [s for s in CORE_SPECIES if s["id"].startswith("g:")]
    organics = [s for s in CORE_SPECIES if s["id"].startswith("ik:")]

    shards = {
        "ions": ions,
        "solids": solids,
        "gases": gases,
        "organics": organics
    }

    manifest = {
        "version": "1.0.0",
        "generated_at": "2026-10-02T12:00:00Z",
        "sources": LICENCES,
        "counts": {
            "total": len(CORE_SPECIES),
            "ions": len(ions),
            "solids": len(solids),
            "gases": len(gases),
            "organics": len(organics)
        },
        "shards": list(shards.keys())
    }

    for name, data in shards.items():
        json_path = OUTPUT_DIR / f"{name}.json"
        gz_path = OUTPUT_DIR / f"{name}.json.gz"
        json_str = json.dumps(data, indent=2)
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(json_str)
        with gzip.open(gz_path, "wt", encoding="utf-8") as f:
            f.write(json_str)

    with open(OUTPUT_DIR / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Core bundle build complete: {len(CORE_SPECIES)} species in {OUTPUT_DIR}")

if __name__ == "__main__":
    build()
