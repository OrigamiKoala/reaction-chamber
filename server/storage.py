import sqlite3
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any, List

DB_PATH = Path(__file__).parent / "chamber.db"
CACHE_DIR = Path(__file__).parent / "cache"

def init_db(db_path: Path = DB_PATH):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS xtb_jobs (
            job_id TEXT PRIMARY KEY,
            created_at REAL,
            status TEXT,
            method TEXT,
            smiles TEXT,
            reaction_family TEXT,
            energy_hartree REAL,
            delta_g_barrier_kcal REAL,
            runtime_sec REAL,
            validation_flags TEXT,
            error_message TEXT,
            raw_result TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS flywheel_barriers (
            job_id TEXT PRIMARY KEY,
            created_at REAL,
            status TEXT,
            reaction TEXT,
            family TEXT,
            solvent TEXT,
            method TEXT,
            energy_hartree REAL,
            delta_e_electronic_kcal REAL,
            xtb_raw_delta_g_kcal REAL,
            calibrated_delta_g_kcal REAL,
            uncertainty_kcal REAL,
            calibrated_rate REAL,
            arrhenius_ea_j_mol REAL,
            arrhenius_a REAL,
            num_imaginary_freqs INTEGER,
            imaginary_freq_cm1 REAL,
            runtime_sec REAL,
            validation_flags TEXT,
            failure_reason TEXT,
            raw_details TEXT
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_barriers_rxn ON flywheel_barriers (reaction)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_barriers_family ON flywheel_barriers (family)")
    conn.commit()
    conn.close()

def save_job(job_id: str, status: str, method: str, smiles: str = "", family: str = "",
             energy: Optional[float] = None, delta_g: Optional[float] = None,
             runtime: float = 0.0, flags: str = "ok", error: Optional[str] = None,
             raw_data: Optional[Dict[str, Any]] = None, db_path: Path = DB_PATH):
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO xtb_jobs 
        (job_id, created_at, status, method, smiles, reaction_family, energy_hartree, delta_g_barrier_kcal, runtime_sec, validation_flags, error_message, raw_result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job_id,
        time.time(),
        status,
        method,
        smiles,
        family,
        energy,
        delta_g,
        runtime,
        flags,
        error,
        json.dumps(raw_data) if raw_data else None
    ))
    conn.commit()
    conn.close()

def save_barrier_record(record: Dict[str, Any], db_path: Path = DB_PATH):
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO flywheel_barriers
        (job_id, created_at, status, reaction, family, solvent, method, energy_hartree,
         delta_e_electronic_kcal, xtb_raw_delta_g_kcal, calibrated_delta_g_kcal, uncertainty_kcal,
         calibrated_rate, arrhenius_ea_j_mol, arrhenius_a, num_imaginary_freqs, imaginary_freq_cm1,
         runtime_sec, validation_flags, failure_reason, raw_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record.get("job_id"),
        time.time(),
        record.get("status", "completed"),
        record.get("reaction", ""),
        record.get("family", "general"),
        record.get("solvent", "water"),
        record.get("method", "tblite_GFN2-xTB"),
        record.get("energy_hartree"),
        record.get("delta_e_electronic_kcal"),
        record.get("xtb_raw_delta_g_kcal"),
        record.get("calibrated_delta_g_kcal"),
        record.get("uncertainty_kcal"),
        record.get("calibrated_rate_constant"),
        record.get("arrhenius_ea_j_mol"),
        record.get("arrhenius_a"),
        record.get("num_imaginary_frequencies", 1),
        record.get("imaginary_frequency_cm1"),
        record.get("runtime_sec", 0.0),
        json.dumps(record.get("validation_flags", [])),
        record.get("failure_reason"),
        json.dumps(record)
    ))
    conn.commit()
    conn.close()

    # Also save to disk cache
    try:
        cache_file = CACHE_DIR / f"{record.get('job_id')}.json"
        with open(cache_file, "w") as f:
            json.dump(record, f, indent=2)
    except Exception:
        pass

def get_job(job_id: str, db_path: Path = DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM xtb_jobs WHERE job_id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    if res.get("raw_result"):
        try:
            res["raw_result"] = json.loads(res["raw_result"])
        except Exception:
            pass
    return res

def get_barrier_record(job_id: str, db_path: Path = DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM flywheel_barriers WHERE job_id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    if res.get("raw_details"):
        try:
            return json.loads(res["raw_details"])
        except Exception:
            pass
    return res

def canonicalize_reaction_smiles(reaction: str) -> str:
    if "->" not in reaction:
        return reaction
    parts = reaction.split("->")
    if len(parts) != 2:
        return reaction
    try:
        from rdkit import Chem
    except ImportError:
        return reaction

    def canon_side(side_str: str) -> str:
        tokens = [s.strip() for s in side_str.split("+") if s.strip()]
        canon_tokens = []
        for t in tokens:
            try:
                m = Chem.MolFromSmiles(t)
                if m is not None:
                    canon_tokens.append(Chem.MolToSmiles(m, canonical=True))
                else:
                    canon_tokens.append(t)
            except Exception:
                canon_tokens.append(t)
        canon_tokens.sort()
        return " + ".join(canon_tokens)

    return f"{canon_side(parts[0])} -> {canon_side(parts[1])}"

def get_precomputed_barrier_table(db_path: Path = DB_PATH) -> Dict[str, float]:
    """Returns mapping of canonical reaction SMILES and family to calibrated Delta G‡ (kcal/mol) for Provider 3."""
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT reaction, family, calibrated_delta_g_kcal FROM flywheel_barriers WHERE status = 'completed' AND calibrated_delta_g_kcal IS NOT NULL")
    rows = cursor.fetchall()
    conn.close()

    table = {}
    for rxn, fam, dg in rows:
        if rxn:
            canon = canonicalize_reaction_smiles(rxn)
            table[canon] = dg
            table[rxn] = dg
        if fam and fam not in table:
            table[fam] = dg
    return table

def get_flywheel_stats(db_path: Path = DB_PATH) -> Dict[str, Any]:
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*), COUNT(DISTINCT family), AVG(runtime_sec) FROM flywheel_barriers")
    total_jobs, num_families, avg_runtime = cursor.fetchone()
    cursor.execute("SELECT COUNT(*) FROM flywheel_barriers WHERE failure_reason IS NULL AND status = 'completed'")
    validated_jobs = cursor.fetchone()[0]
    conn.close()

    return {
        "total_jobs": total_jobs or 0,
        "validated_barriers": validated_jobs or 0,
        "failed_or_fallback": (total_jobs or 0) - (validated_jobs or 0),
        "families_covered": num_families or 0,
        "average_runtime_sec": round(avg_runtime or 0.0, 3),
        "dataset_ready_for_ml": (validated_jobs or 0) > 0,
    }

def export_ml_training_data(output_path: Optional[Path] = None, db_path: Path = DB_PATH) -> List[Dict[str, Any]]:
    """
    Exports clean, structured ML training samples for training graph neural networks (e.g. Chemprop)
    or distilled barrier models.
    """
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM flywheel_barriers WHERE status = 'completed' AND calibrated_delta_g_kcal IS NOT NULL")
    rows = cursor.fetchall()
    conn.close()

    dataset = []
    for r in rows:
        sample = {
            "job_id": r["job_id"],
            "reaction_smiles": r["reaction"],
            "family": r["family"],
            "solvent": r["solvent"],
            "target_delta_g_barrier_kcal": r["calibrated_delta_g_kcal"],
            "target_uncertainty_kcal": r["uncertainty_kcal"],
            "electronic_delta_e_kcal": r["delta_e_electronic_kcal"],
            "arrhenius_ea_j_mol": r["arrhenius_ea_j_mol"],
            "arrhenius_a": r["arrhenius_a"],
            "vibrational_imaginary_freq_cm1": r["imaginary_freq_cm1"],
            "method": r["method"],
            "validation_flags": json.loads(r["validation_flags"]) if r["validation_flags"] else []
        }
        dataset.append(sample)

    if output_path:
        with open(output_path, "w") as f:
            json.dump(dataset, f, indent=2)

    return dataset
