#!/usr/bin/env python3
"""
Reaction Chamber: one command to build (when stale) and serve the full local version.

  python3 run.py                       build if needed, start the server, open the browser
"""
import argparse
import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))


def check_python_packages() -> None:
    """Stops with an install hint when this interpreter lacks the server's packages (a common case: `python3` is the
    system Python rather than the environment the packages were installed into)."""
    import importlib.util
    missing = [m for m in ("fastapi", "uvicorn", "pydantic", "numpy", "scipy", "rdkit")
               if importlib.util.find_spec(m) is None]
    if missing:
        print(f"This Python ({sys.executable}) is missing: {', '.join(missing)}.\n"
              f"Install them with:  {sys.executable} -m pip install -r {root_dir / 'requirements-dev.txt'}\n"
              "or run run.py with the Python environment that has them.")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Launch Reaction Chamber (local full version)")
    parser.add_argument("--host", default="127.0.0.1", help="Host (default 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open the browser")
    parser.add_argument("--no-build", action="store_true", help="Serve the existing build even if sources are newer")
    parser.add_argument("--rebuild", action="store_true", help="Rebuild the engine and the web app before serving")
    args = parser.parse_args()

    check_python_packages()

    if not args.no_build:
        from server.build import ensure_built
        ensure_built(force=args.rebuild)

    from server.main import start_server
    start_server(host=args.host, port=args.port, open_browser=not args.no_browser)
