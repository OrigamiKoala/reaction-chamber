import os
import sys
from pathlib import Path

# OpenMP (numpy / scipy / RDKit): the test inputs are tiny, and a thread per core only spins. An explicit setting wins.
os.environ.setdefault("OMP_NUM_THREADS", "1")

root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))


import pytest


@pytest.fixture(autouse=True)
def _no_live_cas(monkeypatch):
    """Tests never use the real CAS key of `.env` (server.main loads it at import): they would call the live API and see its data.
    A test that needs the CAS path sets `CAS_API_KEY` itself and stubs `server.cas_common`."""
    monkeypatch.delenv("CAS_API_KEY", raising=False)
