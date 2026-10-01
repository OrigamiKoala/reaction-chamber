import secrets
from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_scheme = HTTPBearer(auto_error=False)

CURRENT_SESSION_TOKEN = secrets.token_urlsafe(32)

def get_session_token() -> str:
    return CURRENT_SESSION_TOKEN

def verify_host_header(request: Request):
    host = request.headers.get("host", "")
    allowed = ["localhost", "127.0.0.1", "0.0.0.0"]
    host_name = host.split(":")[0].lower()
    if host_name not in allowed:
        raise HTTPException(status_code=403, detail="Forbidden: DNS rebinding protection")

def verify_token(credentials: HTTPAuthorizationCredentials = Security(security_scheme), request: Request = None):
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
