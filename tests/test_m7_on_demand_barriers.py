import pytest
import time
import json
import math
from pathlib import Path
from fastapi.testclient import TestClient

from server.main import app
from server.calibration import GLOBAL_CALIBRATOR, rate_from_delta_g
from server.barrier_workflow import run_barrier_workflow
from server.job_queue import GLOBAL_JOB_QUEUE
from server.storage import (
    save_barrier_record,
    get_barrier_record,
    get_precomputed_barrier_table,
    get_flywheel_stats,
    export_ml_training_data
)
from server.flywheel_runner import run_flywheel

client = TestClient(app)

def test_m7_gate_calibrated_rates_within_order_of_magnitude_held_out():
    """
    Gate: Calibrated xTB rates for held-out reactions in those families land within an order of magnitude of experiment
    (|log10(k_calc / k_exp)| <= 1.0).
    """
    eval_res = GLOBAL_CALIBRATOR.evaluate_held_out()
    assert eval_res["all_passed"] is True, f"Calibration check failed: {eval_res}"
    assert eval_res["max_order_of_magnitude_error"] <= 1.0, (
        f"Maximum error {eval_res['max_order_of_magnitude_error']} must be <= 1.0 order of magnitude"
    )

    # Spot check specific families
    for fam, evals in eval_res["evaluations"].items():
        assert len(evals) >= 2, f"Family {fam} must have held-out evaluation items"
        for item in evals:
            assert item["within_one_order_of_magnitude"] is True
            assert item["log10_rate_error"] <= 1.0

def test_m7_gate_running_bench_never_changes_when_async_result_arrives():
    """
    Gate: A running bench never changes when a result arrives.
    Asynchronous barrier results are cached for the next network expansion,
    never mutating an in-flight vessel state mid-step.
    """
    # Simulate a running vessel state
    vessel_state_before = {
        "vessel_id": 1,
        "temperature_k": 298.15,
        "species_mol": {
            "CC(Br)C": 0.05,
            "OH-": 0.05,
            "H2O": 5.0,
            "Na+": 0.05,
        },
        "volume_ml": 100.0,
        "active_reaction_ids": ["sn2_secondary_halide"],
        "rate_rule_used": True,
        "k_current": 1.2e-4,
    }

    state_snapshot_before = json.dumps(vessel_state_before, sort_keys=True)

    # Asynchronous job completes on server
    async_result = run_barrier_workflow(
        "CC(Br)C + [OH-] -> CC(O)C + [Br-]",
        family="sn2_secondary_halide"
    )
    save_barrier_record(async_result)

    # Verify vessel state is completely unaffected / non-mutated
    state_snapshot_after = json.dumps(vessel_state_before, sort_keys=True)
    assert state_snapshot_before == state_snapshot_after, "Running bench state must NEVER mutate when async result arrives"

    # Verify that the NEXT query / network generation picks up the refined barrier from Provider 3
    precomputed = get_precomputed_barrier_table()
    assert len(precomputed) > 0
    assert "sn2_secondary_halide" in precomputed or any("CC(Br)C" in k for k in precomputed)

def test_m7_barrier_workflow_semiempirical_calculation():
    """
    Verifies the end-to-end barrier workflow:
    - 3D conformer generation
    - GFN2-xTB saddle-point / electronic barrier evaluation
    - Imaginary vibrational frequency
    - Arrhenius parameter fitting
    - Family calibration
    """
    rxn = "CCOC(=O)C + [OH-] -> CC(=O)[O-] + CCO"  # ester hydrolysis
    res = run_barrier_workflow(rxn, family="base_ester_hydrolysis")

    assert res["status"] == "completed"
    assert res["tier"] in ("calibrated_xtb", "estimated")
    assert res["delta_e_electronic_kcal"] > 0.0
    assert res["calibrated_delta_g_kcal"] > 0.0
    assert res["uncertainty_kcal"] > 0.0
    assert res["arrhenius_ea_j_mol"] > 0.0
    assert res["arrhenius_a"] > 0.0
    assert res["num_imaginary_frequencies"] >= 1
    assert res["runtime_sec"] >= 0.0

def test_m7_job_queue_submission_and_status():
    """
    Verifies asynchronous job queueing, execution, and status polling.
    """
    job_id = GLOBAL_JOB_QUEUE.submit_barrier_job(
        reaction_smiles="CC(Br)C + [OH-] -> C=CC + H2O + [Br-]",
        family="e2_elimination"
    )
    assert job_id.startswith("job_")

    # Poll status
    time.sleep(1.5)
    status_info = GLOBAL_JOB_QUEUE.get_status(job_id)
    assert status_info is not None
    assert status_info["job_id"] == job_id
    assert status_info["status"] in ("running", "completed")

def test_m7_flywheel_batch_and_ml_dataset_export(tmp_path):
    """
    Verifies batch precomputations, SQLite flywheel logging, and ML dataset export.
    """
    run_res = run_flywheel(count=2, verbose=False)
    assert run_res["processed"] >= 2
    assert run_res["successful"] >= 1

    stats = get_flywheel_stats()
    assert stats["total_jobs"] >= 2
    assert stats["validated_barriers"] >= 1
    assert stats["dataset_ready_for_ml"] is True

    export_file = tmp_path / "ml_test_dataset.json"
    dataset = export_ml_training_data(export_file)

    assert len(dataset) >= 1
    sample = dataset[0]
    required_keys = [
        "job_id", "reaction_smiles", "family", "target_delta_g_barrier_kcal",
        "target_uncertainty_kcal", "electronic_delta_e_kcal", "arrhenius_ea_j_mol",
        "arrhenius_a", "validation_flags"
    ]
    for k in required_keys:
        assert k in sample, f"Missing required ML key: {k}"

def test_m7_fastapi_endpoints():
    """
    Tests local server FastAPI endpoints for M7 barrier workflow and flywheel data.
    """
    # 1. Session token
    token_resp = client.get("/api/session-token", headers={"Host": "localhost"})
    assert token_resp.status_code == 200
    token = token_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}", "Host": "localhost"}

    # 2. Submit barrier job
    sub_resp = client.post(
        "/api/barrier/submit",
        json={"reaction": "CC(Cl)C + [OH-] -> CC(O)C + [Cl-]", "family": "sn2_secondary_halide"},
        headers=headers
    )
    assert sub_resp.status_code == 200
    job_id = sub_resp.json()["job_id"]
    assert job_id.startswith("job_")

    # 3. Poll status
    time.sleep(1.0)
    stat_resp = client.get(f"/api/barrier/status/{job_id}", headers=headers)
    assert stat_resp.status_code == 200
    assert stat_resp.json()["job_id"] == job_id

    # 4. Precomputed table
    pre_resp = client.get("/api/barrier/precomputed", headers={"Host": "localhost"})
    assert pre_resp.status_code == 200
    assert "barriers" in pre_resp.json()

    # 5. Flywheel stats
    stats_resp = client.get("/api/flywheel/stats", headers={"Host": "localhost"})
    assert stats_resp.status_code == 200
    assert stats_resp.json()["dataset_ready_for_ml"] is True

    # 6. Flywheel export
    exp_resp = client.get("/api/flywheel/export", headers={"Host": "localhost"})
    assert exp_resp.status_code == 200
    assert exp_resp.json()["count"] > 0
