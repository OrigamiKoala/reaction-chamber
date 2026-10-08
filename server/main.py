import os
import sys
import argparse
import webbrowser
from pathlib import Path
from .env import load_env_file

load_env_file()  # .env of the repository root (CAS_API_KEY, ...): before the modules that read the environment

from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .data_routes import data_capabilities
from .security import (
    CURRENT_SESSION_TOKEN,
    verify_token,
    verify_host_header,
    get_session_token,
)

app = FastAPI(title="Reaction Chamber Local Server", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def host_check_middleware(request: Request, call_next):
    # Enforce DNS rebinding check on all requests
    try:
        verify_host_header(request)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    response = await call_next(request)
    return response

@app.get("/api/health")
def health(request: Request):
    return {
        "status": "online",
        "service": "Reaction Chamber Local Server",
        "version": "0.2.0",
        "token_active": True,
        # what the local build adds to the static one (the frontend reads this to pick its providers)
        "capabilities": data_capabilities(),
    }

@app.get("/api/session-token")
def session_token():
    return {"token": get_session_token()}

from .data_routes import router as data_router
app.include_router(data_router)

# Static frontend serving
WEB_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
WEB_SRC = Path(__file__).resolve().parent.parent / "web"

if WEB_DIST.exists():
    # every file of the built app (index, assets, WASM, data); mounted last so the /api routes win
    app.mount("/", StaticFiles(directory=str(WEB_DIST), html=True), name="web")

def start_server(host: str = "127.0.0.1", port: int = 8000, open_browser: bool = False):
    import uvicorn
    token = get_session_token()
    print("=" * 60)
    print("🚀 Reaction Chamber Local Server Starting")
    print(f"🔗 URL: http://{host}:{port}/?token={token}")
    print(f"🔑 Session Token: {token}")
    print("=" * 60)
    
    if open_browser:
        webbrowser.open(f"http://{host}:{port}/?token={token}")
        
    uvicorn.run(app, host=host, port=port, log_level="info")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reaction Chamber Local Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    parser.add_argument("--open", action="store_true", help="Open browser on launch")
    args = parser.parse_args()
    start_server(host=args.host, port=args.port, open_browser=args.open)
