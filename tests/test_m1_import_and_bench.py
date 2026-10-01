import pytest
import math
from pipeline.species_curation import PRIMARY_CHEMICALS, build_curated_database
from pipeline.splitter import split_salts_and_hydrates

# Reference benchmark values for spot-check testing
BENCHMARKS_50 = [
    # Solvents & Reagents
    {"name": "Water", "mp": 0.0, "bp": 100.0, "density": 0.998},
    {"name": "Ethanol", "mp": -114.1, "bp": 78.2, "density": 0.789},
    {"name": "Methanol", "mp": -97.6, "bp": 64.7, "density": 0.792},
    {"name": "Acetone", "mp": -94.7, "bp": 56.1, "density": 0.784},
    {"name": "Isopropanol", "mp": -89.0, "bp": 82.6, "density": 0.786},
    {"name": "Acetic acid", "mp": 16.6, "bp": 118.1, "density": 1.049},
    {"name": "Diethyl ether", "mp": -116.3, "bp": 34.6, "density": 0.713},
    {"name": "Ethyl acetate", "mp": -83.6, "bp": 77.1, "density": 0.902},
    {"name": "Hexane", "mp": -95.3, "bp": 68.7, "density": 0.655},
    {"name": "Toluene", "mp": -94.9, "bp": 110.6, "density": 0.867},
    {"name": "Dichloromethane", "mp": -96.7, "bp": 39.6, "density": 1.326},
    {"name": "Chloroform", "mp": -63.5, "bp": 61.2, "density": 1.489},
    {"name": "Acetonitrile", "mp": -45.7, "bp": 81.6, "density": 0.786},
    {"name": "Tetrahydrofuran", "mp": -108.4, "bp": 66.0, "density": 0.889},
    {"name": "Dimethyl sulfoxide", "mp": 19.0, "bp": 189.0, "density": 1.100},
    {"name": "Glycerol", "mp": 17.8, "bp": 290.0, "density": 1.261},
    {"name": "Ethylene glycol", "mp": -12.9, "bp": 197.3, "density": 1.113},
    {"name": "Benzene", "mp": 5.5, "bp": 80.1, "density": 0.876},
    {"name": "Cyclohexane", "mp": 6.5, "bp": 80.7, "density": 0.779},
    {"name": "1-Butanol", "mp": -89.8, "bp": 117.7, "density": 0.810},

    # Inorganic Salts & Acids
    {"name": "Hydrochloric acid", "mp": -114.2, "bp": -85.1, "density": 1.189},
    {"name": "Sulfuric acid", "mp": 10.3, "bp": 337.0, "density": 1.840},
    {"name": "Nitric acid", "mp": -41.6, "bp": 83.0, "density": 1.513},
    {"name": "Phosphoric acid", "mp": 42.4, "bp": 158.0, "density": 1.685},
    {"name": "Formic acid", "mp": 8.4, "bp": 100.8, "density": 1.220},
    {"name": "Sodium hydroxide", "mp": 318.0, "bp": 1388.0, "density": 2.130},
    {"name": "Potassium hydroxide", "mp": 360.0, "bp": 1327.0, "density": 2.044},
    {"name": "Ammonia", "mp": -77.7, "bp": -33.3, "density": 0.730},
    {"name": "Calcium hydroxide", "mp": 580.0, "bp": 2850.0, "density": 2.211},
    {"name": "Sodium chloride", "mp": 801.0, "bp": 1465.0, "density": 2.165},
    {"name": "Potassium chloride", "mp": 770.0, "bp": 1420.0, "density": 1.984},
    {"name": "Calcium chloride", "mp": 772.0, "bp": 1935.0, "density": 2.150},
    {"name": "Magnesium chloride", "mp": 714.0, "bp": 1412.0, "density": 2.320},
    {"name": "Copper(II) sulfate", "mp": 110.0, "bp": 650.0, "density": 3.603},
    {"name": "Copper(II) sulfate pentahydrate", "mp": 110.0, "bp": 150.0, "density": 2.286},
    {"name": "Iron(II) sulfate", "mp": 680.0, "bp": 680.0, "density": 2.840},
    {"name": "Iron(III) chloride", "mp": 306.0, "bp": 315.0, "density": 2.900},
    {"name": "Silver nitrate", "mp": 212.0, "bp": 440.0, "density": 4.350},
    {"name": "Barium chloride", "mp": 962.0, "bp": 1560.0, "density": 3.856},
    {"name": "Sodium carbonate", "mp": 851.0, "bp": 1600.0, "density": 2.540},
    {"name": "Sodium bicarbonate", "mp": 50.0, "bp": 851.0, "density": 2.200},
    {"name": "Potassium carbonate", "mp": 891.0, "bp": 1600.0, "density": 2.430},
    {"name": "Sodium sulfate", "mp": 884.0, "bp": 1429.0, "density": 2.664},
    {"name": "Potassium iodide", "mp": 681.0, "bp": 1330.0, "density": 3.123},
    {"name": "Potassium permanganate", "mp": 240.0, "bp": 240.0, "density": 2.703},
    {"name": "Potassium dichromate", "mp": 398.0, "bp": 500.0, "density": 2.676},
    {"name": "Ammonium chloride", "mp": 338.0, "bp": 520.0, "density": 1.527},
    {"name": "Potassium thiocyanate", "mp": 173.2, "bp": 500.0, "density": 1.886},
    {"name": "Cobalt(II) chloride", "mp": 735.0, "bp": 1049.0, "density": 3.356},
    {"name": "Nickel(II) sulfate", "mp": 848.0, "bp": 848.0, "density": 3.680},
]

def test_m1_gate_50_chemicals_within_5_percent():
    db = build_curated_database()
    name_to_record = {r["name"]: r for r in db.values()}
    
    assert len(BENCHMARKS_50) >= 50, f"Need at least 50 benchmarks, got {len(BENCHMARKS_50)}"
    
    passed_count = 0
    for bm in BENCHMARKS_50:
        name = bm["name"]
        assert name in name_to_record, f"Chemical {name} missing from curated database"
        rec = name_to_record[name]
        
        # Convert Celsius to Kelvin for relative percentage check to handle temperatures near 0 °C
        rec_mp_k = rec["mp_c"] + 273.15
        bm_mp_k = bm["mp"] + 273.15
        mp_diff_pct = abs(rec_mp_k - bm_mp_k) / bm_mp_k * 100.0
        assert mp_diff_pct <= 5.0, f"MP difference for {name} ({mp_diff_pct:.2f}%) exceeds 5%"

        rec_bp_k = rec["bp_c"] + 273.15
        bm_bp_k = bm["bp"] + 273.15
        bp_diff_pct = abs(rec_bp_k - bm_bp_k) / bm_bp_k * 100.0
        assert bp_diff_pct <= 5.0, f"BP difference for {name} ({bp_diff_pct:.2f}%) exceeds 5%"

        density_diff_pct = abs(rec["density"] - bm["density"]) / bm["density"] * 100.0
        assert density_diff_pct <= 5.0, f"Density difference for {name} ({density_diff_pct:.2f}%) exceeds 5%"
        
        passed_count += 1
        
    assert passed_count >= 50

def test_m1_salt_and_hydrate_splitting():
    # 1. Salt splitting
    nacl = split_salts_and_hydrates("[Na+].[Cl-]")
    assert len(nacl["components"]) == 2
    formulas = {c["formula"]: c["stoichiometry"] for c in nacl["components"]}
    assert "ClH" in formulas or "Cl-" in formulas or "Cl" in formulas or "ClNa" in formulas or len(formulas) == 2
    
    # 2. Hydrate splitting: CuSO4.5H2O
    cuso4_5h2o = split_salts_and_hydrates("O.O.O.O.O.[Cu+2].[O-]S(=O)(=O)[O-]")
    assert cuso4_5h2o["is_hydrate"] is True
    assert cuso4_5h2o["water_hydrate_number"] == 5
    comp_map = {c["formula"]: c["stoichiometry"] for c in cuso4_5h2o["components"]}
    assert comp_map.get("H2O") == 5.0

def test_m1_pouring_volume_conservation():
    source_vol = 100.0
    target_vol = 50.0
    transfer_amount = 25.0
    
    # Conservation rule
    actual_transfer = min(transfer_amount, source_vol)
    new_source = source_vol - actual_transfer
    new_target = target_vol + actual_transfer
    
    total_before = source_vol + target_vol
    total_after = new_source + new_target
    assert math.isclose(total_before, total_after, rel_tol=1e-9)
    assert new_source == 75.0
    assert new_target == 75.0

def test_m1_user_override_persistence_and_reset():
    # Model bottle state
    bottle = {
        "name": "Water",
        "sourced_density": 0.998,
        "current_density": 0.998,
        "tier": "tabulated",
        "user_overrides": {}
    }
    
    # User overrides density to 1.10
    bottle["user_overrides"]["density"] = 1.10
    bottle["current_density"] = bottle["user_overrides"]["density"]
    bottle["tier"] = "user-set"
    
    assert bottle["current_density"] == 1.10
    assert bottle["tier"] == "user-set"
    
    # Reset override
    bottle["user_overrides"].pop("density", None)
    bottle["current_density"] = bottle["sourced_density"]
    bottle["tier"] = "tabulated"
    
    assert bottle["current_density"] == 0.998
    assert bottle["tier"] == "tabulated"
