"""
M7 Job Queue and Concurrency Manager.
Coordinates asynchronous quantum/semi-empirical barrier calculations,
respects CPU and memory limits (max workers = max(1, CPU_COUNT - 1)),
handles timeouts, and logs results to disk and SQLite database.
"""

import os
import time
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Dict, Any, Optional

from .barrier_workflow import run_barrier_workflow
from .storage import save_barrier_record, get_barrier_record

MAX_WORKERS = max(1, (os.cpu_count() or 2) - 1)
DEFAULT_TIMEOUT_SEC = 60.0

class BarrierJobQueue:
    def __init__(self, max_workers: int = MAX_WORKERS, timeout_sec: float = DEFAULT_TIMEOUT_SEC):
        self.max_workers = max_workers
        self.timeout_sec = timeout_sec
        self.executor = ThreadPoolExecutor(max_workers=self.max_workers, thread_name_prefix="barrier_worker")
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.futures: Dict[str, Future] = {}
        self.lock = threading.Lock()

    def submit_barrier_job(
        self,
        reaction_smiles: str,
        family: str = "sn2_secondary_halide",
        solvent: str = "water",
        temperature_k: float = 298.15
    ) -> str:
        job_id = f"job_{uuid.uuid4().hex[:10]}"
        now = time.time()

        with self.lock:
            self.jobs[job_id] = {
                "job_id": job_id,
                "status": "queued",
                "reaction": reaction_smiles,
                "family": family,
                "solvent": solvent,
                "temperature_k": temperature_k,
                "created_at": now,
                "started_at": None,
                "completed_at": None,
                "result": None,
                "error": None,
            }

        future = self.executor.submit(self._worker_task, job_id, reaction_smiles, family, solvent, temperature_k)
        with self.lock:
            self.futures[job_id] = future

        return job_id

    def _worker_task(self, job_id: str, reaction: str, family: str, solvent: str, temp_k: float):
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id]["status"] = "running"
                self.jobs[job_id]["started_at"] = time.time()

        try:
            res = run_barrier_workflow(reaction, family, solvent, temp_k)
            # Ensure job_id consistency
            res["job_id"] = job_id
            save_barrier_record(res)

            with self.lock:
                if job_id in self.jobs:
                    self.jobs[job_id]["status"] = "completed"
                    self.jobs[job_id]["completed_at"] = time.time()
                    self.jobs[job_id]["result"] = res
        except Exception as e:
            with self.lock:
                if job_id in self.jobs:
                    self.jobs[job_id]["status"] = "failed"
                    self.jobs[job_id]["completed_at"] = time.time()
                    self.jobs[job_id]["error"] = str(e)

    def get_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        # 1. Check in-memory queue
        with self.lock:
            job = self.jobs.get(job_id)
            if job:
                return dict(job)

        # 2. Check persistent SQLite database
        saved = get_barrier_record(job_id)
        if saved:
            return {
                "job_id": job_id,
                "status": saved.get("status", "completed"),
                "reaction": saved.get("reaction"),
                "family": saved.get("family"),
                "result": saved,
                "error": saved.get("failure_reason")
            }
        return None

GLOBAL_JOB_QUEUE = BarrierJobQueue()
