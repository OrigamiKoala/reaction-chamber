"""
Keeps the served app current: rebuilds the WASM engine and the web bundle when their sources are newer than the
build output, so `python3 run.py` on a fresh clone or after an edit serves what the sources say.
"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Iterable, List, Optional

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ROOT / "engine"
WEB = ROOT / "web"
WASM_OUT_DIR = WEB / "src" / "wasm" / "engine"
WASM_OUT = WASM_OUT_DIR / "reaction_chamber_engine_bg.wasm"
DIST_INDEX = WEB / "dist" / "index.html"


def _newest(paths: Iterable[Path], suffixes: Optional[Iterable[str]] = None) -> float:
    newest = 0.0
    sfx = tuple(suffixes) if suffixes else None
    for p in paths:
        if p.is_file():
            newest = max(newest, p.stat().st_mtime)
            continue
        if not p.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(p):
            dirnames[:] = [d for d in dirnames if d not in ("node_modules", "target", "dist", ".git")]
            for f in filenames:
                if sfx and not f.endswith(sfx):
                    continue
                try:
                    newest = max(newest, os.stat(os.path.join(dirpath, f)).st_mtime)
                except OSError:
                    pass
    return newest


def _mtime(p: Path) -> float:
    return p.stat().st_mtime if p.exists() else 0.0


def wasm_stale() -> bool:
    src = _newest([ENGINE / "src", ENGINE / "data", ENGINE / "Cargo.toml"])
    return _mtime(WASM_OUT) < src


def web_stale() -> bool:
    src = _newest([WEB / "src", WEB / "public", WEB / "index.html", WEB / "package.json", WEB / "vite.config.ts"])
    return _mtime(DIST_INDEX) < src


def _run(cmd: List[str], cwd: Path) -> None:
    print(f"$ {' '.join(cmd)}  (in {cwd.relative_to(ROOT) if cwd != ROOT else '.'})", flush=True)
    subprocess.run(cmd, cwd=cwd, check=True)


def build_wasm() -> None:
    if not shutil.which("cargo"):
        raise RuntimeError("cargo (Rust) is not installed: https://rustup.rs")
    if not shutil.which("wasm-bindgen"):
        raise RuntimeError("wasm-bindgen is not installed: cargo install wasm-bindgen-cli (same version as engine/Cargo.lock)")
    _run(["cargo", "build", "--release", "--target", "wasm32-unknown-unknown"], ENGINE)
    _run(["wasm-bindgen", "target/wasm32-unknown-unknown/release/reaction_chamber_engine.wasm",
          "--out-dir", str(WASM_OUT_DIR), "--target", "web"], ENGINE)


def build_web() -> None:
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm (Node.js) is not installed: https://nodejs.org")
    if not (WEB / "node_modules").exists():
        _run([npm, "install"], WEB)
    _run([npm, "run", "build"], WEB)


def ensure_built(force: bool = False) -> None:
    """Rebuilds what is stale; a failed step is reported and the previous build is served if there is one."""
    try:
        if force or wasm_stale():
            print("Building the chemistry engine (WASM)...", flush=True)
            build_wasm()
    except (RuntimeError, subprocess.CalledProcessError) as e:
        print(f"! Engine build failed: {e}", flush=True)
        if not WASM_OUT.exists():
            raise
    try:
        if force or web_stale():
            print("Building the web app...", flush=True)
            build_web()
    except (RuntimeError, subprocess.CalledProcessError) as e:
        print(f"! Web build failed: {e}", flush=True)
        if not DIST_INDEX.exists():
            raise
