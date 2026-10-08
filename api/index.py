"""Vercel function: the /api routes of the deployed site (Python runtime, FastAPI `app`).

The page itself is the static build of `web/` (see `vercel.json`); this function adds the data proxy (NIST WebBook search,
CAS Common Chemistry) with the keys read from the project's environment variables:

  CAS_API_KEY   token of CAS Common Chemistry (optional; the source is off without it)
  RC_NIST=0     switch the NIST lookups off (the WebBook's SRD terms: per-user retrieval, no redistribution)
  RC_RATE_PER_MIN  requests per client address per minute (default 40)
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("RC_HOSTED", "1")

from fastapi import FastAPI  # noqa: E402

from server.data_routes import data_capabilities, router  # noqa: E402

app = FastAPI(title="Reaction Chamber data proxy")
app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "online", "service": "Reaction Chamber (hosted)", "token_active": False,
            "capabilities": data_capabilities()}
