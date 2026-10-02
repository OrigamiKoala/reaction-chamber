import json
from pathlib import Path

def test_m2_bundle_structure_and_species_count():
    bundle_path = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "bundle.json"
    assert bundle_path.exists(), "bundle.json must exist in web/public/data/"
    
    with open(bundle_path, "r", encoding="utf-8") as f:
        bundle = json.load(f)
        
    assert "version" in bundle
    assert "phreeqc" in bundle
    assert "pka" in bundle
    assert "joback_groups" in bundle
    assert "colors" in bundle
    assert "species" in bundle
    
    # Stage 0: the bundle holds only hand-checked species. The generated homologous series and salt matrix that padded it
    # to 501 entries were synthetic (mp/bp/density from molar-mass arithmetic) and were removed.
    total_species = len(bundle["species"])
    assert total_species >= 60, f"expected the ~70 curated species, got {total_species}"
    for s in bundle["species"].values():
        assert not s["formula"].startswith(("Salt_", "Ester_", "AminoAcid_", "Alkane_")), f"synthetic entry {s['name']}"
        assert s["source"] not in ("PHREEQC_Inorganic_Matrix", "Joback_Additivity", "CRC_Amino_Acids"), s["name"]

def test_m2_gate_spot_checked_species():
    bundle_path = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "bundle.json"
    with open(bundle_path, "r", encoding="utf-8") as f:
        bundle = json.load(f)
        
    species_list = list(bundle["species"].values())
    assert len(species_list) >= 60

    # Spot-check every curated species for valid physical properties
    checked = 0
    for s in species_list:
        assert "inchi_key" in s and len(s["inchi_key"]) > 5
        assert "name" in s and len(s["name"]) > 0
        assert "mw" in s and s["mw"] > 0
        assert "mp_c" in s
        assert "bp_c" in s
        assert s["bp_c"] >= s["mp_c"], f"Boiling point {s['bp_c']} must be >= melting point {s['mp_c']} for {s['name']}"
        assert "density" in s and s["density"] > 0
        assert "tier" in s and s["tier"] in ["tabulated", "estimated", "speculative", "user-set"]
        checked += 1
        
    assert checked == len(species_list)

def test_m2_gate_conflict_report_reviewed():
    report_path = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "conflict_report.json"
    assert report_path.exists(), "conflict_report.json must exist"
    
    with open(report_path, "r", encoding="utf-8") as f:
        report = json.load(f)
        
    assert report["milestone"] == "M2 - Data Bundle v1"
    assert "conflicts" in report
    assert len(report["conflicts"]) >= 5
    assert report["conflicts_resolved"] == len(report["conflicts"])
    
    # Verify priority rule is enforced
    for c in report["conflicts"]:
        assert c["status"] == "resolved_prefer_evaluated"
        assert "resolution_rule" in c
