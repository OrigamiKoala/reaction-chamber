#!/usr/bin/env bash
# Build of the static site on Vercel: WASM engine (Rust is not in Vercel's image, so it is installed here) + web app.
# Output: web/dist (see vercel.json). The /api routes are the Python function api/index.py.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f web/src/wasm/engine/reaction_chamber_engine_bg.wasm ]; then
  if ! command -v cargo >/dev/null 2>&1; then
    curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --target wasm32-unknown-unknown
    # shellcheck disable=SC1091
    . "$HOME/.cargo/env"
  fi
  rustup target add wasm32-unknown-unknown
  # must equal the wasm-bindgen version in engine/Cargo.lock
  cargo install wasm-bindgen-cli --version 0.2.100 --locked
  (cd engine && cargo build --release --target wasm32-unknown-unknown \
    && wasm-bindgen target/wasm32-unknown-unknown/release/reaction_chamber_engine.wasm \
         --out-dir ../web/src/wasm/engine --target web)
fi
(cd web && npm ci && npm run build)
