import os
import secrets
import threading
import time
from collections import defaultdict, deque
from urllib.parse import urlparse

from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_scheme = HTTPBearer(auto_error=False)

CURRENT_SESSION_TOKEN = secrets.token_urlsafe(32)

#: True on a public deployment (Vercel sets VERCEL=1; RC_HOSTED=1 forces it). There the page and the API share one
#: origin, there is no local session token to hand out, and the API keys live in the platform's environment variables.
HOSTED = bool(os.environ.get("VERCEL")) or os.environ.get("RC_HOSTED", "") == "1"

#: Requests per client address per minute on a hosted deployment (each search can trigger outbound lookups).
HOSTED_RATE_PER_MIN = int(os.environ.get("RC_RATE_PER_MIN", "40"))
_hits = defaultdict(deque)
_hits_lock = threading.Lock()


def get_session_token() -> str:
    return CURRENT_SESSION_TOKEN


def verify_host_header(request: Request):
    if HOSTED:
        return  # any host name is legitimate on a deployment; same-origin is checked in verify_hosted_request
    host = request.headers.get("host", "")
    allowed = ["localhost", "127.0.0.1", "0.0.0.0"]
    host_name = host.split(":")[0].lower()
    if host_name not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden: DNS rebinding protection")


def verify_hosted_request(request: Request):
    """Public deployment: only the app's own page may call the API (Sec-Fetch-Site / Origin must match the host), and
    each client address is limited per minute. This keeps the keyed sources and the NIST crawl delay from being used as
    an open relay; it is not authentication."""
    site = request.headers.get("sec-fetch-site", "")
    origin = request.headers.get("origin", "")
    host = request.headers.get("host", "")
    if site and site not in ("same-origin", "none"):
        raise HTTPException(status_code=403, detail="Cross-origin requests are not accepted")
    if origin and urlparse(origin).netloc.lower() != host.lower():
        raise HTTPException(status_code=403, detail="Cross-origin requests are not accepted")
    fwd = request.headers.get("x-forwarded-for", "")
    client = (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?"))
    now = time.time()
    with _hits_lock:
        q = _hits[client]
        while q and now - q[0] > 60.0:
            q.popleft()
        if len(q) >= HOSTED_RATE_PER_MIN:
            raise HTTPException(status_code=429, detail="Too many requests; try again in a minute")
        q.append(now)


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security_scheme), request: Request = None):
    if HOSTED:
        if request is not None:
            verify_hosted_request(request)
        return ""
    # Check Host header
    if request:
        verify_host_header(request)
    # Check query param token for browser initial load or WebSocket/SSE
    query_token = request.query_params.get("token") if request else None
    header_token = credentials.credentials if credentials else None

    token = header_token or query_token
    if not token or token != CURRENT_SESSION_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid or missing session token")
    return token
