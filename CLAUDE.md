# Reaction Chamber

Monorepo for virtual chemistry sandbox (M0–M5 complete + realistic bench / simplified UI rework).

## Structure
- `web/`: Frontend UI (TypeScript, Vite, Three.js r170 3D bench, Web Workers)
  - `src/bench/`: `scene.ts` (BenchScene: renderer, OrbitControls, picking, stations, instruments, animate* API), `glassware.ts` (vessel bundles), `lab_room.ts` (worktop, tiled wall, shelf, lights, PMREM env), `shelf.ts` (capped LRU reagent shelf, 27 slots), `animations.ts` (pour / drops / spatula / ribbon / move tasks)
  - `src/render/`: `glass_profiles.ts` (real-size lathe profiles, 1 unit = 1 cm, volume↔height), `glass_material.ts` (far/near split glass with fresnel), `liquid_material.ts` (per-pixel Beer–Lambert absorb pass + surface pass, layers, meniscus, ripples, vortex), `liquid_shader.ts` (`computeSpectralColor`), `effects.ts` (bubbles, foam, steam, fumes, condensation, precipitates, flame, shatter), `particles.ts`, `flame.ts`, `textures.ts` (all procedural)
  - `src/equipment/`: thermometer, pH meter, balance, pressure gauge, hot plate/stirrer, burner, `bottle.ts` (data-driven reagent bottles + labels), `lcd.ts`
  - `src/app/`: `lab.ts` (vessels, per-vessel controls, hot-plate occupancy, dose/pour actions; `ingest()` returns the engine snapshot merged with visual-only contents), `visual_contents.ts` (visual-only liquids/powders for PubChem imports + dissolving ghost piles for engine-dissolved solids), `reagent_library.ts` (catalog + PubChem imports + recently used, search), `reagent_colors.ts` (engine-derived bottle colours), `storage.ts`
  - `src/ui/`: `reagent_panel.ts` (search-first, PubChem inline), `add_card.ts`, `vessel_panel.ts` (readouts, events, controls, contents, pour), `time_controls.ts`, `top_bar.ts`, `advanced_view.ts` (Details drawer), `custom_reaction_modal.ts`, `bottle_card.ts`, `self_test.ts`, `toast.ts`, `modal.ts`, `icons.ts`
  - `src/main.ts`: thin composition root (startup, 20 Hz snapshot loop with per-vessel dt, keyboard shortcuts)
- `engine/`: WASM chemistry & solver engine (Rust, wasm-bindgen)
- `server/`: Local mode server (Python FastAPI, tblite GFN2-xTB, SQLite flywheel)
- `pipeline/`: Data bundle builder (PHREEQC, IUPAC pKa, Joback additivity, curated colors, 500+ species)
- `tests/`: Automated test suite for M0–M2 gates

## Quickstart
``# Launch server and app
python3 run.py

# Run M7 data flywheel (batch precomputations for ML model, e.g. 50 reactions with 4 parallel workers)
python3 run.py --flywheel --flywheel-count 50 --flywheel-workers 4

# Check flywheel stats
python3 run.py --flywheel-stats

# Export ML training dataset
python3 run.py --export-ml ml_dataset.json

# Run tests
pytest tests/ -v

# Run engine tests
cd engine && cargo test

# Build WASM engine
cd engine && wasm-bindgen target/wasm32-unknown-unknown/release/reaction_chamber_engine.wasm --out-dir ../web/src/wasm/engine --target web

# Build bundle
python3 pipeline/build_bundle.py

# Build frontend
cd web && npm run build
```

## Status & Milestones
- **M0 (Skeleton & Local Server)**: Rust WASM engine compiled (0 warnings); worker roundtrip plumbing implemented; FastAPI local server with session tokens, DNS rebinding protection, HEAD/GET route support, and GFN2-xTB (`tblite`) runner; CI workflow configured. Verified working with live test client and curl endpoints.
- **M1 (Import & Bench)**: PubChem PUG REST/View import, property parsing & median conflict resolution; salt & hydrate splitter; IndexedDB caching; bottle cards with user overrides; Three.js 3D glassware (beakers, flasks, cylinders, test tubes) and volume-conserving pouring. Verified across 50 benchmark chemicals and volume conservation checks.
- **M2 (Data Bundle v1)**: Build pipeline assembling PHREEQC core, IUPAC pKa dataset, Joback group table, curated colors, and 501 species mapped by InChIKey; conflict report generated and reviewed. All 11 automated test gates passing.
- **M3 (Equilibrium & Basic Physics)**: Equilibrium solver with Davies activities, monotonic charge-balance root-finding, and exact Ksp precipitation. Strong/strong, weak/strong, and polyprotic titration curves match PHREEQC within <= 0.05 pH. AgCl precipitation at Ksp threshold with common-ion effect and temperature-dependent solubility verified. Volume additivity, density layering, and calorimetry mixing verified. Hardened for edge cases: concentrated 5M acid/base, ultra-dilute (1e-11 M), weak base speciation (NH3/NH4+), triprotic acids (H3PO4), temperature Kw shifts (0–60 °C), and solid solubility limits.
- **M4 (Kinetics, Energy & Phase Transfer)**: Stiff Rosenbrock (ROS2) integrator with analytic Jacobian (corrected reverse product Jacobian sign bug). Iodine clock delay within +-20% of literature at two temperatures (20 °C and 35 °C). Neutralisation temperature rise within +-10% of calorimetry reference (6.67 K). Water boiling clamped at 373.15 K with latent boil-off, mass-bounded dry-out, and dry vessel heating. Conservation checks (charge, elements, energy) pass on every tick with alchemy/leak detection. Benchmark with 50 species and 200 reactions ticks in WASM in < 5 ms. All 35 automated pytest gates and 20 cargo unit tests passing.
- **M5 (Visuals, Instruments & Advanced View)**: Physics-visual decoupled architecture (`VesselSnapshot` serde contract). Beer-Lambert spectral transmission across 32 wavelength bins (400-710 nm) with Van de Hulst turbidity scattering. Volumetric bubble particle system with nucleation dynamics, steam plumes, upper-glass condensation, flame cones, and precipitate slurries. 3D lab instruments with first-order lag response and quantised readouts: Thermometer (tau=4s, 0.1K), Digital pH Meter (tau=3s, 0.01pH, '---' dry), Balance (tau=0.8s, 0.01g, tare), Pressure Gauge (0-3 atm dial, stopper seal), Hot Plate (0-1000W glow, magnetic stirrer), and Bunsen Burner. Advanced view with 10 Hz canvas dynamics plot (T, pH, P), universal elemental conservation audit, species activities table, and reaction provenance badges.
- **M6 (Templates & Network Generator)**: 45 organic & general reaction families implemented in Rust WASM (`engine/src/templates.rs`) and Python (`pipeline/templates_m6.py`); Mayr reactivity parameters ($N, s_N, E$) integrated with Eyring temperature scaling; Stokes-Einstein diffusion limit capping; RMG-style rate-based expansion with formation-flux candidate filtering; thermodynamic reversibility ($k_{rev} = k_{fwd}/K_{eq}$); strict hard caps on species ($\le 200$) and reactions ($\le 500$); SN2/E2 product ratio gate verified (shifts toward elimination with heat and with bulky bases); ester hydrolysis gate verified (acid and base catalysis V-shaped pH curve); 10-chemical stress mixtures stay strictly bounded; all automated gates passing.
- **M7 (On-Demand Barriers & Data Flywheel)**: Automated semi-empirical barrier workflow (`server/barrier_workflow.py`) with 3D conformers, GFN2-xTB (`tblite`) saddle-point evaluation, numerical Hessian vibrational frequency verification (1 imaginary frequency along reaction coordinate), and quasi-RRHO thermal corrections; linear calibration module (`server/calibration.py`) for SN2, E2, and ester hydrolysis families; gate verified (calibrated rates for held-out benchmark reactions land within 1 order of magnitude of experiment: max log error = 0.048); running bench stability gate verified (incoming async barrier calculations write to SQLite flywheel and disk cache without mutating in-flight vessel states, refining subsequent network generation); asynchronous multi-worker job queue (`server/job_queue.py`); batch flywheel runner (`server/flywheel_runner.py`) executable via `python run.py --flywheel` or `python -m server.flywheel_runner`; structured ML training dataset export (`export_ml_training_data()`); all 56 pytest tests and 39 cargo tests passing.
- **Generalized Chemical Engine Hardening (Implementation Plan Conformance)**: Completely eliminated all hardcoded reaction shortcuts and mineral bypasses. Formulated a unified, arbitrary-stoichiometry mineral equilibrium solver ($IAP \rightleftharpoons K_{sp}$) coupled with solid reservoir drawing for aqueous speciation equilibria, enabling universal Le Chatelier dissolution (e.g. hydroxides in acid, halides in ammonia) purely from thermodynamic driving forces. Elementary solution kinetics capped at $\min(\text{coeff}, 1.0)$ preventing millimolar exponent dampening. Mutex-backed global and vessel-level extensible registries for custom reagents, equilibria, minerals, and kinetics with full WASM and Web Worker exposure. All 34 cargo tests (`lib.rs`, `m5_demos.rs`, `general_simulation.rs`) and all 45 pytest tests passing; clean Vite production build.
- **PubChem Import & IndexedDB Fix**: Hardened IndexedDB caching layer against closed/closing connection exceptions (`onversionchange`, `onclose`, transaction retry, and in-memory cache fallback); wrapped import caching calls non-blocking to prevent UI import aborts.
- **Bench Realism & UI Simplification (see `BENCH_REWORK_PLAN.md`)**: Photoreal-leaning bench (ACES tone mapping, RoomEnvironment IBL, soft shadows, epoxy worktop, tiled wall, wood/steel reagent shelf) at real scale (1 unit = 1 cm). Lathe-profile glassware with wall thickness, spouts, enamel graduations; liquids fill along the inner profile with per-pixel Beer–Lambert colour from engine spectra, immiscible layers, turbidity, meniscus, ripples, stir vortex, colour-mixing swirl. Per-frame effects: instanced bubbles by nucleation site, foam, steam/fume sprites (dense fumes roll over the rim), condensation droplets, suspended→settling precipitates, metal ribbons, shader flames with flicker light, stopper pop and glass shatter. Animated pours (tilting source + ballistic tapered stream), dropper drops, spatula powder; `onComplete` always fires once and triggers the actual dose. UI: full-bleed bench, search-first Reagents panel with inline PubChem search/import (scales to thousands of reagents, no per-compound hand-authored text/colours), inline Add card, Vessel panel (lagged instrument readouts, generic event log, heat/stir/ice bath/stopper/ignite, contents, pour-into), time controls (pause, 1×/5×/20×), toasts, keyboard shortcuts (A details, Space pause, F focus, / search, Esc). Bottle colours come from the engine (throwaway probe vessel), cached in localStorage. Clean Vite build; all 45 pytest tests passing. Custom GLSL not yet verified in a browser.rified in a browser.
- **Visible contents fix (solids/liquids)**: Settled solids are now a heaped bed (radial height-field in `effects.ts`: paraboloid mound + flat layer when large; crystals rest on it) instead of a sub-millimetre uniform film; clear liquids get a faint base absorption, meniscus line and surface sheen so water is visible; powder/precipitate sprites are world-sized for bench distance. PubChem imports parse physical state / colour / mp / bp / density from PUG View (`pubchem/parser.ts`), imported solids are dosed by mass and, like all visual-only additions, stay in the vessel via `VisualContents` (merged into the snapshot in `Lab.ingest`). Soluble catalog solids leave a dissolving ghost pile (shrinking-core) because the engine dissolves them instantly. Reagent bottles: solid jars are always glass (white HDPE hid the powder), amber glass is lighter, labels are narrower so contents show beside/above them, clear liquids have visible opacity. Not verified in a browser.
