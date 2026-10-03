"""
Data Bundle Build Pipeline
Assembles:
1. PHREEQC Aqueous Core (master species, equilibria, Ksp)
2. IUPAC pKa Dataset
3. Joback Group Contribution Table
4. (removed in Stage 10: optical data are the engine's optical records, engine/data/optics_seed.json)
5. 500+ Curated Species mapped by InChIKey
6. Conflict Report
Emits to web/public/data/bundle.json and conflict_report.json.
"""
import json
import gzip
from pathlib import Path
from phreeqc_parser import get_phreeqc_data
from pka_parser import get_pka_records
from joback_estimator import JOBACK_GROUPS
from species_curation import build_curated_database
from conflict_checker import analyze_conflicts

def build_data_bundle():
    print("Building Data Bundle v1...")
    
    # 1. Collect sources
    phreeqc = get_phreeqc_data()
    pka_list = get_pka_records()
    species_db = build_curated_database()
    
    print(f"Loaded {len(species_db)} curated species keyed by InChIKey.")
    print(f"Loaded {len(phreeqc['aqueous_equilibria'])} aqueous equilibria and {len(phreeqc['mineral_solubilities'])} mineral solubilities.")
    print(f"Loaded {len(pka_list)} IUPAC pKa records.")
    
    # 2. Conflict Report
    conflict_report = analyze_conflicts(species_db)
    
    # 3. Assemble unified bundle
    bundle = {
        "version": "1.0.0",
        "description": "Reaction Chamber Data Bundle v1 (PHREEQC + IUPAC + Joback + Curated Core)",
        "meta": {
            "total_species": len(species_db),
            "total_equilibria": len(phreeqc["aqueous_equilibria"]),
            "total_minerals": len(phreeqc["mineral_solubilities"]),
            "total_pka_entries": len(pka_list),
        },
        "phreeqc": phreeqc,
        "pka": pka_list,
        "joback_groups": JOBACK_GROUPS,
        "species": species_db
    }
    
    # 4. Output directory
    output_dir = Path(__file__).resolve().parent.parent / "web" / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    bundle_path = output_dir / "bundle.json"
    with open(bundle_path, "w", encoding="utf-8") as f:
        json.dump(bundle, f, indent=2)
    print(f"Wrote data bundle to {bundle_path} ({bundle_path.stat().st_size / 1024:.1f} KB)")
    
    # Also write compressed gzip bundle for fast loading
    bundle_gz_path = output_dir / "bundle.json.gz"
    with gzip.open(bundle_gz_path, "wt", encoding="utf-8") as f:
        json.dump(bundle, f)
    print(f"Wrote compressed bundle to {bundle_gz_path} ({bundle_gz_path.stat().st_size / 1024:.1f} KB)")
    
    conflict_path = output_dir / "conflict_report.json"
    with open(conflict_path, "w", encoding="utf-8") as f:
        json.dump(conflict_report, f, indent=2)
    print(f"Wrote conflict report to {conflict_path}")

if __name__ == "__main__":
    build_data_bundle()
