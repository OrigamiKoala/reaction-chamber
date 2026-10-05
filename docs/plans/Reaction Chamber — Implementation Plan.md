# Reaction Chamber — Implementation Plan

Sep 30, 2026 · @Carl Liu

## Overview

Build a chemistry sandbox that feels like a real lab: a 3D bench with unlimited glassware, chemicals imported by name from PubChem, and a simulation engine that models equilibria, kinetics, heat and phase changes "close enough" for open-ended experimenting. It is for students who lack access to lab equipment. It ships in two modes: **local mode** first (a small server on the user's machine adds on-demand semi-empirical calculations for a wider range of reactions), then **web-only mode** later (same app, no install, for less technical users).

**Goals**

- Any PubChem compound can be imported and placed on the bench as a bottle, with usable physical properties.
- Mixing anything does something physically sensible: dissolve, layer, heat, boil, or react.
- Common gen-chem and undergrad-organic reactions run with realistic equilibria, rates, heat release, and competing pathways.
- Unfamiliar reactions get plausible estimates, flagged as estimates in the advanced view.

**Non-goals for v1**

- Predicting arbitrary or niche chemistry accurately (organometallics, photochemistry, polymerization, biochemistry).
- Explanations, hints or tutorials on the bench; the bench shows only what a real lab would.
- The microscale view (designed for, built later).

**Guiding principles**

1. **The macro kinetic model is the source of truth.** Everything else (databases, semi-empirical barriers, ML models, the microscale view) feeds it parameters or illustrates it.
2. **Every number carries provenance.** Each parameter is tagged *tabulated*, *estimated*, or *speculative*; user overrides are tagged user-set. Provenance appears in the advanced view, never on the default bench.
3. **Never refuse a mix.** "No reaction modelled" is a legitimate outcome; inventing chemistry is not.
4. **One codebase.** The frontend and engine run unchanged in the browser; local-mode capabilities live behind the provider interface, so web-only mode is the same app with fewer providers.

## System architecture

One frontend and one engine, two ways to run them. In **local mode** (first), a small server on the user's machine serves the app at `localhost` and adds on-demand semi-empirical barriers. In **web-only mode** (later), the same files load from a static host with no server at all. In both, the browser talks to PubChem directly and runs all chemistry in Web Workers.

&#91;embedded content: architecture · 3 browser threads, 3 outside parts\]

In local mode the local server also serves the app itself, so page and API share one origin; in web-only mode the dashed parts are absent and the app loads from a static host. The build pipeline always runs offline on the developer's machine.

**Stack**

| Layer | Technology | Runs in |
| --- | --- | --- |
| Bench, glassware, UI | TypeScript, Vite, three.js; a light UI layer (React or Svelte) for menus and the inspector | Main thread |
| Chemical perception | RDKit.js (`@rdkit/rdkit`, WASM) | Chemistry worker |
| Network generator, provider chain | Rust compiled to WASM (wasm-bindgen) | Chemistry worker |
| Solver | Rust compiled to WASM | Simulation worker |
| Data bundle | Compressed JSON/MessagePack built by a Python pipeline | Static files, cached by a service worker |
| PubChem cache, saved benches | IndexedDB | Browser |
| Small ML models (later) | ONNX Runtime Web | Chemistry worker |
| Local server (local mode only) | Python, FastAPI, tblite/xtb, RDKit, SQLite log | Your machine, `localhost` |

**Data flow for one pour**

1. The user pours from a bottle or vessel; the main thread sends the transfer to the simulation worker.
2. The simulation worker updates the vessel's composition and asks the chemistry worker for the reaction set of any *new* species combination.
3. The chemistry worker runs the network generator, resolves parameters through the provider chain, and returns reactions with provenance.
4. The simulation worker integrates the vessel and posts state snapshots (about 10–30 per second).
5. The renderer interpolates between snapshots and maps state to visuals.

The main thread never runs chemistry, so the bench stays at 60 fps even when a vessel's network is large.

## Core data model

Six record types carry everything; the key split is between a **substance** (what is in a bottle) and a **species** (what the solver tracks). A bottle of CuSO₄·5H₂O is one substance that becomes Cu²⁺, SO₄²⁻ and water when dissolved.

| Record | Key fields | Notes |
| --- | --- | --- |
| **Parameter** | value, units, tier (*tabulated* / *estimated* / *speculative*), source, uncertainty (as a log₁₀ factor) | Wraps every number below |
| **Species** | InChIKey (primary id), CID, name, SMILES, formula, charge; Tm, Tb, density, vapor-pressure model; ΔHf°, S°, Cp(T) per phase; pKa list; functional-group tags; absorbance or colour; GHS hazards | Built once per species, cached |
| **Substance** | CID, name, form (pure, hydrate, solution with concentration), species composition on dissolution | What a bottle holds |
| **Vessel** | glassware type (capacity, shape, wall heat capacity), phases, temperature, open or sealed, stirring, heat source | One per piece of glassware |
| **Phase** | kind (aqueous, organic liquid, solid, gas headspace), volume, amount of each species, activity model | A vessel holds several |
| **Reaction** | stoichiometry, phase, family or template id, rate law (mass action with Arrhenius A, n, Ea; Mayr; or fast equilibrium), ΔH, ΔG → K, provenance | Reverse rate derived from K |

Identity rule: species are keyed by InChIKey, not by name or CID. PubChem, PHREEQC, Mayr and RMG all name things differently; InChIKey (plus charge for ions) is the join key across them.

User overrides: any species property can be edited from the bottle's details card so students can tinker. The edited value is tagged *user-set*, beats every other source for that bench only, and can be reset to the sourced value.

## Data sources and ingestion

PubChem is queried live, per compound, at import time; everything else is downloaded once, merged by a Python build pipeline, and shipped as a static data bundle. Nothing is fetched mid-simulation.

| Source | Provides | How it is used | Check before shipping |
| --- | --- | --- | --- |
| PubChem PUG REST and PUG View | Identity, SMILES, InChIKey, charge, experimental properties, GHS hazards | Live, per import, cached in IndexedDB | Rate limit (about 5 requests/s): queue requests client-side |
| PHREEQC databases (`llnl.dat`, `minteq.v4.dat`) | Aqueous species, log K(T), ΔH, mineral solubilities, redox couples | Bundled; the aqueous core | License terms |
| IUPAC digitized pKa dataset | Organic pKa values | Bundled | License terms |
| Mayr's Database of Reactivity Parameters | N, s\_N, E per nucleophile and electrophile, with solvent | Bundled; polar organic rates | Ask the Mayr group about bulk use |
| RMG-database | Thermo libraries, group additivity, Abraham solvation parameters, radical kinetics families | Bundled subset | License terms |
| Burcat / NASA CEA thermo | Gas-phase thermo polynomials | Bundled | — |
| Joback group table | Group increments for Tb, ΔHf°, ΔGf°, Cp | Bundled; fallback estimator | — |
| Curated colour table | Colours of common coloured ions and complexes | Hand-built, small | — |

**Import pipeline (per compound)**

1. Name or autocomplete → CID → PUG REST properties → PUG View experimental and safety sections.
2. Parse property strings into numbers with units; when sources disagree, prefer standard conditions (25 °C, 1 atm) and take the median; record conflicts.
3. Split salts and hydrates into fragments with RDKit (`[Na+].[Cl-]` → Na⁺ + Cl⁻) to get the dissolution composition.
4. Join each species to the bundle by InChIKey to attach pKa, log K, Mayr and thermo data.
5. Fill gaps with estimators (Joback; Clausius–Clapeyron with Trouton's rule for vapor pressure) and tag them *estimated*.
6. Cache the finished records in IndexedDB and request persistent storage.

**Build pipeline (offline)**

- Parse each source into a common schema keyed by InChIKey (plus charge for ions).
- Map source-specific names to structures: automatic from formula and charge where unambiguous, hand-checked for the few hundred most common species.
- Apply a per-field priority order (measured beats estimated; evaluated compilations beat single reports) and write a conflict report.
- Emit chunked bundles: the aqueous core loads at start; organic families load on first use. Target under about 20 MB compressed in total.

## Reaction engine

The engine decides *which* reactions exist in a vessel and *what parameters* they get. Reactions come from aqueous class rules and a template library; parameters come from an ordered provider chain. Competing pathways need no special handling: every proposed reaction is integrated at once.

**Aqueous chemistry (class rules)**

- Speciation, acid–base and complexation are fast equilibria taken straight from the PHREEQC data. Carbonate + acid → CO₂ falls out of speciation plus Henry's law, with no special rule.
- Precipitation and dissolution are kinetic: nucleation once supersaturation passes a threshold, then growth proportional to solid surface area.
- Redox couples are fast equilibria by default. Known slow cases (uncatalysed H₂O₂ decomposition, permanganate + oxalate) get curated kinetic overrides.
- Metal + acid is heterogeneous: rate proportional to metal surface area × \[H⁺\]^n, from a curated family.

**Organic chemistry (templates)**

Each family is a reaction SMARTS plus conditions (phase, required catalyst) and a rate source. Acid- or base-catalysed families scale with the vessel's live \[H⁺\] or \[OH⁻\].

| Starter family | Rate source |
| --- | --- |
| Nucleophile + electrophile combinations (carbocations, Michael acceptors, carbonyls) | Mayr: log k = s\_N(N + E) |
| SN1, SN2, E1, E2 | Literature rates and rate rules; QMrxn20-informed |
| Esterification and ester hydrolysis (acid/base catalysed) | Literature rates |
| Alcohol oxidation (dichromate, permanganate) | Literature rates |
| Aldehyde/ketone additions, aldol | Mayr where covered, otherwise rate rule |
| Electrophilic aromatic substitution (nitration, halogenation) | Literature rates and rate rules |
| Halogen addition to alkenes | Literature rates |
| Combustion and radical oxidation | RMG families (gas phase, needs ignition) |

Start with about 40 families covering gen chem and intro organic; grow toward 150–300.

**Network generator (per vessel, on any composition change)**

1. Apply class rules and templates to every new species, unimolecularly and against every existing species.
2. Products enter as *candidates*. A candidate joins the active network only when its formation flux exceeds a threshold relative to the vessel's total flux (RMG-style rate-based expansion). Promoted species go through step 1 in turn.
3. Every reaction is reversible: k\_rev = k\_fwd / K, with K from ΔG° at the current temperature.
4. Bimolecular rates are capped at the diffusion limit, computed from solvent viscosity via Stokes–Einstein.
5. Hard caps (for example 200 active species per vessel) keep pathological mixtures bounded; hitting one is logged.

**Provider chain**

Each provider answers `resolve(quantity, context)` with a Parameter or nothing; the first answer wins.

1. Tabulated value from the bundle
2. Mayr equation (polar bond formation)
3. Precomputed calibrated barrier (from the data flywheel)
4. Distilled barrier model (later; ONNX, with ensemble uncertainty)
5. Local compute service (development only; asynchronous)
6. Family rate rule with a Bell–Evans–Polanyi correction

Asynchronous results (provider 5) never change a running vessel. They are cached and used the next time that reaction is generated, and the inspector marks the reaction *refined*.

**Speculative reactions (later, opt-in)**

When no template matches a pair, a small forward-prediction model can propose products. Proposals must pass atom balance, valence and ΔG sanity checks, get a family-default rate, and are always tagged *speculative*. Behind a "speculative chemistry" toggle, off by default.

## Simulation solver

Each vessel advances by operator splitting: a fast-equilibrium solve, a stiff kinetics step, an energy balance, and a phase-transfer step, in that order every tick. Simulation time is decoupled from wall time, so the user can fast-forward and the stiff integrator takes large steps safely.

**1. Fast equilibrium**

- Unknowns are the log activities of a component basis (PHREEQC-style master species), constrained by mass balance and charge balance.
- Newton–Raphson with a line search, warm-started from the previous tick: usually a few iterations.
- Davies activity coefficients; above about 0.5 M ionic strength, flag results as *estimated*.
- K(T) from the source's analytical log K expressions, or van 't Hoff with ΔH where only that exists.

**2. Slow kinetics**

- Slow reactions change component totals; the equilibrium step then redistributes them (partial-equilibrium approximation).
- Rosenbrock integrator (ROS3P or RODAS4) with an analytic Jacobian, adaptive step size, and mixed absolute/relative tolerances with a concentration floor.
- k(T) from Arrhenius parameters; Mayr rates adjusted from 20 °C with an assumed activation entropy.

**3. Energy balance**

Temperature changes with reaction heat, the heater, heat loss to the room, and evaporation:

```latex
\frac{dT}{dt} = \frac{\sum_j r_j V(-\Delta H_j) + \dot Q_{heater} - hA(T - T_{room}) - \dot n_{evap}\Delta H_{vap}}{\sum_i n_i C_{p,i} + C_{glass}}
```

**4. Phase transfer**

- Gas–liquid: Henry's law equilibrium approached at a transfer rate that rises with stirring; bubbles appear when local supersaturation is high.
- Evaporation from vapor pressure into the headspace; boiling when total vapor pressure reaches the external pressure, with the boil-off rate limited by heat input.
- Liquid–liquid partitioning from solubility and logP, approached at a finite rate.
- Precipitation: nucleation above a supersaturation threshold, growth proportional to solid area.

**Correctness and performance**

- Every tick checks element, charge and energy conservation; a violation is logged with the vessel state.
- Vessels at equilibrium with no heat flow sleep until something changes.
- v1 assumes one dominant solvent per liquid phase; solvent mixtures use mole-fraction-weighted properties (a known approximation).
- Benchmark target: a vessel with 50 species and 200 reactions ticks in a few milliseconds in WASM. Measure this in milestone 3 rather than assuming it.

## Frontend

The bench should feel exactly like a real lab: students learn by watching and measuring, with no explanations, hints or overlays. Visuals are derived entirely from simulation state; the renderer never decides chemistry. Target WebGL2 as the baseline (school laptops and Chromebooks), with WebGPU as an optional upgrade.

**Bench and equipment**

- Glassware shelf that never runs out: beakers (50 mL–2 L), Erlenmeyer and round-bottom flasks, test tubes, graduated cylinders, a burette, a separatory funnel. Each vessel can be cloned.
- Equipment: hot plate with stirrer, ice bath, burner or igniter, thermometer, pH probe, balance.
- Each vessel can be open or sealed; sealed vessels track headspace pressure.

**Chemical shelf**

- Search with PubChem autocomplete; results show name, formula, a structure drawing (RDKit.js SVG) and GHS badges.
- Adding a result creates a labelled bottle with an unlimited supply.

Each bottle has a details card showing its sourced properties; any value can be overridden (tagged *user-set*) and reset.

**Interactions**

- Drag a bottle or vessel onto another vessel to pour. Solids are dosed by mass on the balance, liquids by volume; holding the pour longer transfers more.
- Burette with an adjustable drip rate, for titrations.
- Stir toggle, heat slider, seal or unseal, ignite.
- Time controls: pause, 1×, 10×, 100×, and jump to equilibrium.

**Mapping state to visuals**

| Visual | Driven by |
| --- | --- |
| Liquid level and layers | Phase volumes; layer order by density |
| Colour | Species absorbance via Beer–Lambert, using the vessel's path length, converted to sRGB; curated colours as fallback |
| Cloudiness and settling solid | Suspended and settled solid amounts |
| Bubbles | Gas evolution flux |
| Steam, boiling, condensation | Evaporation rate, boiling state, vessel temperature vs room |
| Flame | Combustion rate in the headspace |

**Instruments and advanced view**

- **Default bench:** only what a real lab offers. Thermometer, pH meter and pH paper, balance, pressure gauge on sealed vessels, a stopwatch.
- **Hazards are physical, not textual:** visible gas and fumes, splattering, fire, a sealed vessel bursting from over-pressure. Bottles carry real GHS labels, as in a real lab.
- **Advanced view (off by default):** species table with amounts and concentrations, active reactions with rates and provenance badges (*tabulated* / *estimated* / *speculative* / *refined* / *user-set*), and time plots. For tinkering, debugging and teachers.

**Saving**

Bench state autosaves to IndexedDB and can be exported and imported as a JSON file.

## Local server and data flywheel

The local server is the first user-facing product, not a dev tool: it serves the app at `localhost`, computes semi-empirical barriers on demand, and logs every result. That log becomes the precomputed barrier table and the training set for the distilled model that web-only mode will depend on.

**Service**

- **Launch:** one command (for example a `pipx` or `uvx` install) starts the server and opens the browser at the app's address. A double-click launcher can follow once packaging is proven.
- **Stack:** FastAPI, tblite/xtb (GFN2-xTB with ALPB implicit solvation), RDKit, ASE, and a saddle-point optimiser such as Sella.
- **Serves the frontend itself,** so page and API share one origin. This sidesteps browser restrictions on public websites calling `localhost`.
- **Security:** bind to 127.0.0.1 only, pick a free port, require a per-session token, and check the Host header to block DNS-rebinding attacks.
- **Resource limits:** a job queue using at most all-but-one CPU core, a per-job timeout, and total memory kept under about 2 GB.
- **Jobs are asynchronous:** the app submits an atom-mapped reaction with family, solvent and temperature, then polls. Results are cached on disk and reused across benches.

**Barrier workflow (per reaction)**

1. Build 3D reactant and product geometries with RDKit; optimise a few low-energy conformers with xTB.
2. Generate a transition-state guess from the template's atom mapping (constrained scan or double-ended path).
3. Optimise the saddle point; require exactly one imaginary frequency.
4. Run an IRC and confirm it connects the intended reactants and products.
5. Compute ΔG‡ with implicit solvent and quasi-RRHO corrections; derive Arrhenius parameters from ΔG‡ at two temperatures.
6. Any failed check: record the failure reason and fall back to the rate rule.

**Log (SQLite)**

One row per job: inputs, method and code versions, outputs, validation flags, run time, and failure reason. Nothing is discarded; failures are training signal for which families need better TS guesses.

**Calibration**

For each family, fit an offset (and optionally a slope) between xTB ΔG‡ and experimental ΔG‡ for reactions with measured rates. The residual spread becomes that family's uncertainty.

**Batch precomputation**

- Enumerate a curated substrate list (common lab compounds) against every template each one matches.
- Expect minutes per transition-state search on a laptop, so roughly hundreds of reactions per night across all cores. Prioritise the substrates people actually import.
- Results ship in the data bundle as the precomputed barrier table (provider 3).

**Contributing results (later, opt-in)**

Local-mode users could choose to upload their validated barriers to grow the shared precomputed table. That needs a small collection endpoint, a deliberate exception to "no server of our own", so it waits until web-only mode exists.

**Distilled model (once data allows)**

- Train a reaction-graph message-passing model (Chemprop-style, condensed reaction graph input) on calibrated barriers, per family or pooled with a family embedding.
- Ensemble of about five; export to ONNX; target a few MB in total.
- Evaluate on held-out substrate scaffolds, not random splits. When ensemble disagreement passes a threshold, fall back to the rate rule and mark the reaction *estimated*.

## Milestones

Ten milestones: M0–M8 ship local mode, M9 adds web-only mode. Each ends in a validation gate that must pass before the next builds on it. M5 can run in parallel with M4; everything else is sequential. Numeric tolerances are targets to confirm, not guarantees.

1. **M0 — Skeleton with local server.** Monorepo with `web/` (TypeScript), `engine/` (Rust crate), `pipeline/` (Python bundle builder), `server/` (Python local server). One launch command starts the server, which serves the frontend at `localhost` with a session token. WASM build, worker plumbing, CI. Install xtb on macOS, Windows and Linux now, since Windows packaging decides the launcher approach.
   - *Gate:* the launch command opens the app; a message round-trips main thread → worker → WASM → main thread; a trivial xtb job returns on all three operating systems.
2. **M1 — Import and bench.** PubChem search and import, property parsing, salt and hydrate splitting, IndexedDB cache, bottle details card with user overrides. Bench scene with glassware, bottles and pouring (volumes only, no chemistry).
   - *Gate:* 50 common chemicals import with melting point, boiling point and density within 5% of reference values; pouring conserves volume; an override persists and resets.
3. **M2 — Data bundle v1.** Build pipeline for PHREEQC, IUPAC pKa and Joback; InChIKey mapping for the 500 most common species; conflict report.
   - *Gate:* 100 spot-checked species match reference values; conflict report reviewed.
4. **M3 — Equilibrium and basic physics.** Equilibrium solver with Davies activities; mixing, dilution, temperature mixing, layering, dissolution.
   - *Gate:* strong/strong, weak/strong and polyprotic titration curves match PHREEQC within 0.05 pH; AgCl precipitates at its Ksp threshold; mixing temperatures match simple calorimetry.
5. **M4 — Kinetics, energy and phase transfer.** Rosenbrock integrator, energy balance, gas evolution, evaporation and boiling, precipitation kinetics, time controls, performance benchmark.
   - *Gate:* iodine clock delay within ±20% of literature at two temperatures; neutralisation temperature rise within ±10%; water boils near 100 °C; conservation checks pass on every tick.
6. **M5 — Visuals, instruments and advanced view.** Absorbance-based colour, bubbles, precipitate, steam, physical hazard effects; thermometer, pH meter, balance, pressure gauge; advanced view with plots and provenance.
   - *Gate:* about ten classroom demos (copper–ammonia complex, phenolphthalein titration, baking soda + vinegar, catalysed H₂O₂ decomposition, AgCl precipitation, cobalt chloride equilibrium shifted by heat) look and measure like the real thing.
7. **M6 — Templates and network generator.** About 40 families, Mayr integration, rate-based expansion, reversibility, diffusion cap.
   - *Gate:* SN2/E2 product ratio shifts toward elimination with heat and with a bulky base; ester hydrolysis rate vs pH shows acid and base catalysis; networks stay bounded on random ten-chemical stress mixtures.
8. **M7 — On-demand barriers.** Barrier workflow in the local server, job queue and limits, disk cache, SQLite log, calibration for two or three families.
   - *Gate:* calibrated xTB rates for held-out reactions in those families land within an order of magnitude of experiment; a running bench never changes when a result arrives.
9. **M8 — Release local mode.** Packaging and install instructions for all three operating systems, onboarding, low-end hardware tuning.
   - *Gate:* a clean install works on a fresh machine of each OS; 10 active vessels at 60 fps on an 8 GB laptop with integrated graphics; server stays under about 2 GB of memory.
10. **M9 — Web-only mode.** Static hosting as a PWA, precomputed barrier table built from the flywheel log, distilled barrier model with ensemble fallback.
    - *Gate:* the M5 demo set and the M6 tests run with no local server; reactions without precomputed data fall back to rate rules and show as *estimated* in the advanced view.

## Risks, open questions and later work

The biggest risks are confident-looking wrong chemistry and runaway reaction networks; both are contained by provenance tags, conservative defaults and hard caps.

| Risk | Mitigation |
| --- | --- |
| Wrong chemistry looks convincing on a realistic bench | Provenance kept for every value and shown in the advanced view; speculative chemistry off by default; "no reaction modelled" over invention |
| Installing the local server is too hard for students | One-command install first, a double-click launcher once packaging is proven; web-only mode for everyone else |
| xtb packaging fails on some OS (Windows is the likeliest) | Test all three operating systems in M0; fall back to a rate-rule-only local server where xtb cannot run |
| Other websites abuse the local server | Bind to 127.0.0.1, per-session token, Host-header check |
| Reaction networks explode in rich mixtures | Flux-threshold promotion, species caps, stress-test gate in M6 |
| Stiff solver fails or produces negative amounts | Step rejection and retry, concentration floor, fallback to implicit Euler, state logged on failure |
| Species joined to the wrong database entry | InChIKey plus charge as the key; hand-checked core mapping; mapping regression tests |
| PubChem gaps or bad values | Estimators fill gaps; conflicting values flagged in the advanced view; users can override |
| Redox defaulting to fast equilibrium runs some reactions too fast | Curated slow-redox overrides, grown from M5–M6 testing |
| Licence limits on Mayr, IUPAC or RMG data | Check before public release; keep each source a separate bundle chunk so one can be dropped |
| Transition-state searches fail often | Validation plus rate-rule fallback; failures logged to improve TS guesses per family |
| Slow on low-end hardware | Sleeping vessels, lower snapshot rate, instanced particles, M8 gate |

**Open questions**

- [ ] Primary audience for v1: students in class, or independent learners? This sets the UI depth and safety messaging. (USER ANSWER: no explanations or anything like that - the purpose is to help students who don't have access to fancy lab equipments to still be able to witness reactions, so this should feel like exactly like a lab would, except it's virtual.)
- [ ] Should users be able to override a species property, tagged *user-set*? (yes, so they can tinker with different properties of compounds)
- [ ] How far to go with mixed solvents in v1 beyond mole-fraction weighting?
- [ ] Bench sharing: an exported file only, or a shareable link later?

**Later work**

- **Microscale view:** offline IRC paths per family, a WebGPU classical-MD scene for solvent and spectators, reaction events spliced in at a rate scaled from the macro k, with the time compression shown.
- **Speculative chemistry** toggle (small forward-prediction model, validated and tagged).
- **Double-click launcher** for local mode, possibly a Tauri shell around the server, plus an "investigate this mixture" exploration mode. Signing costs about $99/year (Apple) plus $9.99/month (Microsoft's Artifact Signing basic tier).
- **Opt-in result sharing** from local mode into the precomputed table.
- More families: electrochemistry, gas-law experiments, coordination kinetics.
