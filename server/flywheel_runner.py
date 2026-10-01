"""
M7 Flywheel Data Generator & Batch Precomputation Runner.
Enumerates reactions across core families and common laboratory substrates,
executes the semi-empirical barrier workflow in parallel across CPU cores,
populates SQLite chamber.db and the disk cache, and exports ML training datasets.
"""

import sys
import time
import argparse
from pathlib import Path
from typing import List, Dict, Any

from .barrier_workflow import run_barrier_workflow
from .storage import save_barrier_record, get_flywheel_stats, export_ml_training_data
from .calibration import GLOBAL_CALIBRATOR

# Curated library of representative reaction templates for batch precomputation
FLYWHEEL_CANDIDATE_REACTIONS = [
    # SN2 reactions (primary, secondary, benzylic)
    {"rxn": "CCBr + [OH-] -> CCO + [Br-]", "family": "sn2_primary_halide"},
    {"rxn": "CCCCl + [OH-] -> CCCO + [Cl-]", "family": "sn2_primary_halide"},
    {"rxn": "CCCCBr + [I-] -> CCCCI + [Br-]", "family": "sn2_primary_halide"},
    {"rxn": "c1ccccc1CCl + [OH-] -> c1ccccc1CO + [Cl-]", "family": "sn2_primary_halide"},
    {"rxn": "CCCl + [SH-] -> CCS + [Cl-]", "family": "sn2_primary_halide"},
    {"rxn": "CCBr + [CN-] -> CCC#N + [Br-]", "family": "sn2_primary_halide"},
    {"rxn": "CC(Br)C + [OH-] -> CC(O)C + [Br-]", "family": "sn2_secondary_halide"},
    {"rxn": "CC(Cl)C + [OH-] -> CC(O)C + [Cl-]", "family": "sn2_secondary_halide"},
    {"rxn": "CC(I)C + [OH-] -> CC(O)C + [I-]", "family": "sn2_secondary_halide"},
    {"rxn": "CCC(Br)C + [OH-] -> CCC(O)C + [Br-]", "family": "sn2_secondary_halide"},
    {"rxn": "CCC(Cl)C + [OH-] -> CCC(O)C + [Cl-]", "family": "sn2_secondary_halide"},
    {"rxn": "CC(Br)CC + [I-] -> CC(I)CC + [Br-]", "family": "sn2_secondary_halide"},
    {"rxn": "CC(Cl)CC + [I-] -> CC(I)CC + [Cl-]", "family": "sn2_secondary_halide"},
    {"rxn": "CC(Br)C + [CH3O-] -> CC(OC)C + [Br-]", "family": "sn2_secondary_halide"},
    {"rxn": "CC(Cl)C + [CH3O-] -> CC(OC)C + [Cl-]", "family": "sn2_secondary_halide"},
    {"rxn": "CCCC(Br)C + [OH-] -> CCCC(O)C + [Br-]", "family": "sn2_secondary_halide"},
    {"rxn": "C1CCCC(Br)C1 + [OH-] -> C1CCCC(O)C1 + [Br-]", "family": "sn2_secondary_halide"},

    # E2 eliminations
    {"rxn": "CC(Br)C + [OH-] -> C=CC + H2O + [Br-]", "family": "e2_elimination"},
    {"rxn": "CC(Br)C + CC([O-])(C)C -> C=CC + CC(O)(C)C + [Br-]", "family": "e2_elimination"},
    {"rxn": "CC(Cl)C + [OH-] -> C=CC + H2O + [Cl-]", "family": "e2_elimination"},
    {"rxn": "CCC(Br)C + [OH-] -> CC=CC + H2O + [Br-]", "family": "e2_elimination"},
    {"rxn": "CCC(Br)C + CC([O-])(C)C -> CC=CC + CC(O)(C)C + [Br-]", "family": "e2_elimination"},
    {"rxn": "CCC(Cl)C + [OH-] -> CC=CC + H2O + [Cl-]", "family": "e2_elimination"},
    {"rxn": "CCCC(Br)C + [OH-] -> CCC=CC + H2O + [Br-]", "family": "e2_elimination"},
    {"rxn": "CC(Br)CC + [CH3O-] -> CC=CC + CO + [Br-]", "family": "e2_elimination"},
    {"rxn": "CC(Br)(C)C + [OH-] -> CC(=C)C + H2O + [Br-]", "family": "e2_elimination"},
    {"rxn": "CC(Cl)(C)C + [OH-] -> CC(=C)C + H2O + [Cl-]", "family": "e2_elimination"},

    # Ester hydrolysis (saponification and acid)
    {"rxn": "CCOC(=O)C + [OH-] -> CC(=O)[O-] + CCO", "family": "base_ester_hydrolysis"},
    {"rxn": "CCOC(=O)C + O -> CC(=O)O + CCO", "family": "acid_ester_hydrolysis"},
    {"rxn": "COC(=O)C + [OH-] -> CC(=O)[O-] + CO", "family": "base_ester_hydrolysis"},
    {"rxn": "COC(=O)C + O -> CC(=O)O + CO", "family": "acid_ester_hydrolysis"},
    {"rxn": "CCCOC(=O)C + [OH-] -> CC(=O)[O-] + CCCO", "family": "base_ester_hydrolysis"},
    {"rxn": "CCOC(=O)CC + [OH-] -> CCC(=O)[O-] + CCO", "family": "base_ester_hydrolysis"},
    {"rxn": "COC(=O)c1ccccc1 + [OH-] -> O=C([O-])c1ccccc1 + CO", "family": "base_ester_hydrolysis"},
    {"rxn": "CCOC(=O)c1ccccc1 + [OH-] -> O=C([O-])c1ccccc1 + CCO", "family": "base_ester_hydrolysis"},
    {"rxn": "CC(C)OC(=O)C + [OH-] -> CC(=O)[O-] + CC(C)O", "family": "base_ester_hydrolysis"},
    {"rxn": "CCOC(=O)CCC + [OH-] -> CCCC(=O)[O-] + CCO", "family": "base_ester_hydrolysis"},

    # Alkene addition & halogenation
    {"rxn": "C=C + BrBr -> C(Br)C(Br)", "family": "alkene_bromination"},
    {"rxn": "CC=C + BrBr -> CC(Br)C(Br)", "family": "alkene_bromination"},
    {"rxn": "CC=CC + BrBr -> CC(Br)C(Br)C", "family": "alkene_bromination"},
    {"rxn": "C1=CCCCC1 + BrBr -> C1CC(Br)C(Br)CC1", "family": "alkene_bromination"},
    {"rxn": "CC=C + O -> CC(O)C", "family": "alkene_hydration"},
    {"rxn": "CCC=C + O -> CCC(O)C", "family": "alkene_hydration"},
    {"rxn": "CC=C + ClCl -> CC(Cl)C(Cl)", "family": "alkene_bromination"},

    # Carbonyl addition & reduction
    {"rxn": "CC(=O)C + [BH4-] -> CC(O)C", "family": "carbonyl_reduction_borohydride"},
    {"rxn": "CCC(=O)C + [BH4-] -> CCC(O)C", "family": "carbonyl_reduction_borohydride"},
    {"rxn": "CC=O + [BH4-] -> CCO", "family": "carbonyl_reduction_borohydride"},
    {"rxn": "c1ccccc1C=O + [BH4-] -> c1ccccc1CO", "family": "carbonyl_reduction_borohydride"},
    {"rxn": "CCCC(=O)C + [BH4-] -> CCCC(O)C", "family": "carbonyl_reduction_borohydride"},
    {"rxn": "CC(=O)c1ccccc1 + [BH4-] -> CC(O)c1ccccc1", "family": "carbonyl_reduction_borohydride"},

    # Aldol condensation
    {"rxn": "CC=O + CC=O -> CC(O)CC=O", "family": "aldol_addition"},
    {"rxn": "CCC=O + CCC=O -> CCC(O)C(C)C=O", "family": "aldol_addition"},
    {"rxn": "CC(=O)C + CC=O -> CC(=O)CC(O)C", "family": "aldol_addition"},

    # Acyl transfer & amide formation
    {"rxn": "CC(=O)Cl + CCO -> CC(=O)OCC + [Cl-]", "family": "acyl_substitution"},
    {"rxn": "CC(=O)Cl + CCN -> CC(=O)NCC + [Cl-]", "family": "amide_formation"},
    {"rxn": "CC(=O)Cl + N -> CC(=O)N + [Cl-]", "family": "amide_formation"},

    # Epoxide ring opening
    {"rxn": "C1CO1 + [OH-] -> OCCO", "family": "epoxide_opening"},
    {"rxn": "CC1CO1 + [OH-] -> CC(O)CO", "family": "epoxide_opening"},
]

def _worker_compute(item: Dict[str, str]) -> Dict[str, Any]:
    rxn = item["rxn"]
    fam = item["family"]
    res = run_barrier_workflow(rxn, family=fam)
    save_barrier_record(res)
    return res

def run_flywheel(
    count: int = 20,
    family_filter: str = "",
    continuous: bool = False,
    workers: int = 1,
    verbose: bool = True
) -> Dict[str, Any]:
    """
    Runs flywheel precomputations and populates the database and disk cache.
    Supports single-threaded or multi-worker concurrent batch generation.
    """
    from concurrent.futures import ThreadPoolExecutor

    candidates = list(FLYWHEEL_CANDIDATE_REACTIONS)
    if family_filter:
        candidates = [c for c in candidates if family_filter.lower() in c["family"].lower()]

    if not candidates:
        if verbose:
            print(f"⚠️ No reactions found matching family filter: '{family_filter}'")
        return {"processed": 0, "success": 0}

    # Build queue of jobs up to count
    job_list = []
    if continuous:
        job_list = candidates
    else:
        while len(job_list) < count:
            job_list.extend(candidates)
        job_list = job_list[:count]

    total_target = len(job_list) if not continuous else "Continuous"
    eff_workers = max(1, workers)

    if verbose:
        print("=" * 65)
        print("🌀 Reaction Chamber Data Flywheel — Starting Precomputations")
        print(f"📊 Available Templates in Library: {len(candidates)}")
        print(f"🎯 Target Jobs: {total_target} | Parallel Workers: {eff_workers}")
        print("=" * 65)

    processed = 0
    successful = 0
    start_total = time.time()

    if eff_workers > 1:
        with ThreadPoolExecutor(max_workers=eff_workers) as executor:
            futures = [executor.submit(_worker_compute, item) for item in job_list]
            for idx, fut in enumerate(futures, 1):
                try:
                    res = fut.result()
                    processed += 1
                    if res.get("status") == "completed" and res.get("failure_reason") is None:
                        successful += 1
                        if verbose:
                            dg_cal = res.get("calibrated_delta_g_kcal")
                            print(f"[{processed}/{total_target}] ✅ {res.get('reaction')} | ΔG‡ = {dg_cal} kcal/mol ({res.get('runtime_sec')}s)")
                    else:
                        if verbose:
                            print(f"[{processed}/{total_target}] ⚠️ Fallback ({res.get('failure_reason')}) for {res.get('reaction')}")
                except Exception as e:
                    if verbose:
                        print(f"[{idx}/{total_target}] ❌ Worker error: {e}")
    else:
        for idx, item in enumerate(job_list, 1):
            rxn = item["rxn"]
            fam = item["family"]
            if verbose:
                print(f"[{idx}/{total_target}] Computing: {rxn}")
                print(f"    Family: {fam} ...", end="", flush=True)

            t0 = time.time()
            res = run_barrier_workflow(rxn, family=fam)
            dt = time.time() - t0
            save_barrier_record(res)
            processed += 1

            if res.get("status") == "completed" and res.get("failure_reason") is None:
                successful += 1
                if verbose:
                    dg_cal = res.get("calibrated_delta_g_kcal")
                    print(f" ✅ Done in {dt:.2f}s | ΔG‡ = {dg_cal} kcal/mol (flags: {len(res.get('validation_flags', []))})")
            else:
                if verbose:
                    print(f" ⚠️ Fallback ({res.get('failure_reason')}) in {dt:.2f}s")

    total_time = time.time() - start_total
    stats = get_flywheel_stats()

    if verbose:
        print("-" * 65)
        print("🎉 Flywheel Run Complete!")
        print(f"⏱️  Total Time: {total_time:.2f}s ({total_time / max(1, processed):.3f}s / reaction)")
        print(f"📦 Total Database Records: {stats['total_jobs']}")
        print(f"✅ Validated Barrier Samples: {stats['validated_barriers']}")
        print(f"🧬 Reaction Families in Flywheel: {stats['families_covered']}")
        print("=" * 65)

    return {
        "processed": processed,
        "successful": successful,
        "stats": stats,
    }

def main():
    parser = argparse.ArgumentParser(description="Reaction Chamber Data Flywheel Generator")
    parser.add_argument("--count", type=int, default=15, help="Number of reaction barriers to calculate (default: 15)")
    parser.add_argument("--family", type=str, default="", help="Filter by reaction family name")
    parser.add_argument("--workers", type=int, default=1, help="Concurrent worker count (default: 1)")
    parser.add_argument("--continuous", action="store_true", help="Run indefinitely in background")
    parser.add_argument("--stats", action="store_true", help="Print flywheel database stats and exit")
    parser.add_argument("--export", type=str, default="", help="Export ML training dataset to JSON file")
    args = parser.parse_args()

    if args.stats:
        stats = get_flywheel_stats()
        print("Flywheel Statistics:")
        for k, v in stats.items():
            print(f"  {k}: {v}")
        return

    if args.export:
        out_path = Path(args.export)
        data = export_ml_training_data(out_path)
        print(f"✅ Exported {len(data)} training samples to {out_path.resolve()}")
        return

    run_flywheel(count=args.count, family_filter=args.family, continuous=args.continuous, workers=args.workers, verbose=True)

if __name__ == "__main__":
    main()
