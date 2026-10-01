# M5 — Visuals, instruments and advanced view: design contract and progress

Source of truth for the M5 workstreams. Read this, `Reaction Chamber — Implementation Plan.md` (Frontend section + M5 gate) and `CLAUDE.md` first.
Contract types: `web/src/types/sim.ts` (TS) mirrored by `engine/src/vessel.rs` (Rust, serde snake_case). **Do not change the contract unilaterally**; if you must, make the smallest additive change and note it in "Contract changes" at the bottom.

## Realism bar (user requirement)
Everything must look and measure like doing the experiment in a real lab. Students have no access to real equipment; the bench must feel like a real bench: **no hints, tooltips, explanations or overlays on the bench** (only instrument readouts, labels on bottles as in a real lab). Visuals are derived from simulation state only; the renderer never decides chemistry. Numbers on instruments behave like real instruments (resolution, response lag, range, saturation).

## Architecture
```
Rust/WASM engine (engine/src)        worker (web/src/workers)        main thread
  chem_db  – species, equilibria,       simulation.worker.ts            sim/ (controller, clock, handles)
             kinetics, thermo, reagents   VESSEL_* messages             render/ + bench/ (three.js)
  solver   – generic equilibrium       ───────────────────►            equipment/ (3D instruments)
  vessel   – state, dose, step, gas,    VesselSnapshot (JSON)           ui/ (dosing, instruments, advanced)
             heat, pressure, flame
  optics/spectra – absorbance bins, scattering, sRGB tables
```
Spectral colour: engine supplies per-layer `absorbance_per_cm[32]` and `OpticsTables.rgb_weights`; the liquid shader computes, per fragment, `T_i = 10^(-a_i * pathCm)`, then `rgb = Σ w_i·T_i` — so colour deepens/shifts with real path length (a deep dichromate flask is redder than a thin film). Light from behind the liquid is attenuated this way; scattering (`scatter_per_cm`) adds milky in-scatter coloured `scatter_rgb`.

## Ownership (parallel workers; never edit files you do not own)
| Worker | Owns |
| --- | --- |
| **ENGINE** | `engine/src/{lib.rs,chem_db.rs,solver.rs,vessel.rs,reactions.rs,thermo.rs,...}` (anything in engine/ except optics.rs/spectra.rs), `engine/tests/`, `engine/Cargo.toml`, rebuild of `web/src/wasm/engine/` (wasm-pack), `web/src/workers/simulation.worker.ts` (add the VESSEL_* handlers) |
| **OPTICS** | `engine/src/optics.rs`, `engine/src/spectra.rs` (replace stubs; keep signatures), `tests/test_m5_optics.py` |
| **RENDER** | `web/src/bench/scene.ts`, `web/src/bench/glassware.ts`, new `web/src/render/**` (liquid shader, glass, bubbles, precipitate, steam, condensation, flame, fumes, burst, lighting/environment, bench realism) |
| **EQUIP** | new `web/src/equipment/**` (3D models + live displays: thermometer, pH meter & probe, pH paper, balance, pressure gauge + stopper, burette + stand, hot plate/stirrer, burner/igniter, ice bath, stopwatch, glassware shelf additions, GHS pictogram label textures on bottles; bottle meshes `createBottleMesh` move to `equipment/bottle.ts`) |
| **APP** | `web/src/main.ts`, `web/src/sim/**` (controller: handles, clock/time controls, pouring/dosing logic, snapshots → render/instrument updates), `web/src/ui/**`, `web/index.html`, `web/src/style.css`, `web/src/types/index.ts`, advanced view + plots, reagent catalog UI |
| lead | `M5_DESIGN.md`, `CLAUDE.md`, `tests/test_m5_demos.py`, integration |

Interfaces between workers:
* RENDER exposes `GlasswareMeshBundle.applyVisual(snap: VesselSnapshot, dtSeconds: number)` (called every frame with the latest snapshot; it owns interpolation and particle sim) plus `BenchScene` hooks: `getGlassware(id)`, `addVessel`, `removeVessel`, `scene`, `onSelectObject`, drag-to-pour events (`onPourRequested(sourceId, targetId)`), `setOpticsTables(OpticsTables)`, and `triggerBurst(id)`. RENDER also draws the *vessel-side* fx of events (burst, boil-over).
* EQUIP exposes classes with `group: THREE.Group`, `attachTo(vesselBundle|null)`, `update(snap: VesselSnapshot | null, dt: number)`; plus `readout()` values for the UI where relevant. APP instantiates and adds `group` to `benchScene.scene`. Meters must read only from the snapshot (`ph`, `temperature_k`, `contents_mass_g`+glass, `pressure_atm`) through an instrument-realism model (lag, resolution, noise-free but quantised).
* APP calls ENGINE only through the worker (`SimRequest` in sim.ts) and keeps `Map<vesselId, handle>`.

## Rules for all workers
* Do **not** open or test anything in a browser (user rule). Verify with `cargo test`, `wasm-pack build`, `npm run build` (tsc must pass), node/python scripts, and numeric tests of shader math ported to plain functions where useful.
* Env: `export PATH=$HOME/.cargo/bin:$PATH`; Python venv at `.venv` (`source .venv/bin/activate`; `pytest tests -v`). Existing 35 pytest + cargo tests must keep passing.
* No new npm deps unless unavoidable (three.js only; plots are hand-drawn canvas). No network fetches at runtime for assets: textures/dials are procedurally drawn on canvas.
* Match surrounding code style; no hint/overlay text on the bench. Keep files focused (<~600 lines).
* Do not use git (project is not a repo). Do not edit files owned by others; ask via your final report.
* Final report: what you built, files, how verified, known gaps (be honest), and any contract change.

## Species-id convention (shared by ENGINE and OPTICS)
PHREEQC-style ids, matching the bundle: aqueous `H+`, `OH-`, `Na+`, `K+`, `Cl-`, `SO4-2`, `NO3-`, `Cu+2`, `Cu(NH3)4+2`, `NH3`, `NH4+`, `Ag+`, `Ag(NH3)2+`, `CO3-2`, `HCO3-`, `CO2(aq)`, `CH3COOH`, `CH3COO-`, `Fe+3`, `Fe(SCN)+2`, `SCN-`, `Co(H2O)6+2` (written `Co+2`), `CoCl4-2`, `I-`, `I3-`, `I2(aq)`, `S2O8-2`, `S2O3-2`, `S4O6-2`, `H2O2`, `O2(aq)`, `Mg+2`, `MnO4-`, `Cr2O7-2`, `CrO4-2`, `HIn_phph` / `In_phph-2` (phenolphthalein lactone/dianion), `starch_I3` (starch–triiodide complex), bromothymol blue `HIn_btb`/`In_btb-`, methyl orange `HIn_mo`/`In_mo-`, universal-indicator not needed (pH paper is table-driven in APP). Solids `AgCl(s)`, `Cu(OH)2(s)`, `NaHCO3(s)`, `MnO2(s)`, `Mg(s)`, `CoCl2(s)`, `NaCl(s)`, `NaOH(s)`, `KI(s)`… Gases `CO2(g)`, `O2(g)`, `H2(g)`, `NH3(g)`, `HCl(g)`, `N2(g)`, `H2O(g)`, `C2H5OH(g)`. Organic liquid: `C2H5OH`. ENGINE owns the canonical list (`chem_db.rs`); OPTICS keys spectra by these ids and exports `spectra::species_with_spectra()`.

## Demo set (the M5 gate). Each must run end-to-end in the engine, render, and *measure* correctly
Quantitative targets (engine tests in `engine/tests/m5_demos.rs`; ± are acceptance bands):
1. **Copper–ammonia complex.** 25 mL 0.10 M CuSO4 (pale sky blue, λmax≈800 nm ε≈12) + 2 M NH3 added by the drop/mL: first a pale-blue gelatinous precipitate (Cu(OH)2 / basic sulfate; pH rises past ~6.5–7), then on excess NH3 (>~4 equiv.) it dissolves to deep royal-blue [Cu(NH3)4]2+ (λmax≈600–610 nm, ε≈50–60), final pH ≈ 10.5–11.5, solution transparent. Cu2+ total conserved.
2. **Phenolphthalein titration.** 25.00 mL 0.100 M HCl + 3 drops (0.15 mL) phenolphthalein; titrate with 0.100 M NaOH from the burette. First persistent faint pink at 25.0–25.3 mL (pH≈8.3–9), full magenta by pH≈10.5; pH curve matches the M3 curve within 0.1 pH away from the sharp jump; ΔT≈+0.6 K at endpoint region (dilute, mixed in a beaker). Drop-by-drop addition must be possible (burette stopcock rate).
3. **Baking soda + vinegar.** 5.0 g NaHCO3(s) into 100 mL 5% (≈0.83 M) acetic acid at 22 °C: vigorous CO2 evolution lasting ~10–30 s open, foam head, **temperature falls ~1.5–3 K** (endothermic, ΔH≈+10–12 kJ/mol HCO3-… engine computes from species ΔHf), ≈1.4 L CO2 total at 1 atm (≥85% of 0.0595 mol leaves; remainder dissolved/supersaturated), final pH≈4.0–4.8 (acetate/acetic buffer with leftover acid). Same experiment in a **sealed** 250 mL Erlenmeyer: pressure climbs, stopper pops at the closure threshold (≈2.2 atm, event `stopper_pop`), a stronger/over-tightened closure can `burst` the vessel at 6 atm (glass).
4. **Catalysed H2O2 decomposition.** 50 mL 3% (0.88 M) H2O2 + 0.5 g MnO2(s) (or 5 mL 0.5 M KI): rapid O2 evolution (bubbles nucleate on the solid), temperature rise ΔT ≈ +10–15 K for 3% in ~30–60 s with MnO2 (ΔH = −98 kJ/mol H2O2; cp≈4.18) — exact value falls out of the energy balance; uncatalysed 3% H2O2 shows no measurable change over minutes (k very small); KI path gives transient brown/yellow I2/I3- tint. Stoichiometry conserved: 2 H2O2 → 2 H2O + O2.
5. **AgCl precipitation.** 10 mL 0.10 M AgNO3 + 10 mL 0.10 M NaCl → white curdy AgCl, strongly turbid, settles over minutes (Stokes, d≈1–5 µm clumping to curds); supernatant [Ag+]=[Cl-]≈√Ksp(1.77e-10 at 25 °C)≈1.3e-5 M (activity-corrected); 0.0010 mol precipitates; dissolves in excess NH3 as [Ag(NH3)2]+ (log β2≈7.2). No precipitate while Q<Ksp (e.g. 1e-6 M each).
6. **Cobalt(II) chloride equilibrium.** [Co(H2O)6]2+ (pink, λ≈510 nm ε≈5) + 4 Cl- ⇌ [CoCl4]2- (deep blue, λ≈625/690 nm ε≈600) is endothermic (ΔH≈+50 kJ/mol): 0.1 M CoCl2 in ~10 M effective chloride medium (conc. HCl / ethanol-water) is violet at room T, **turns blue on heating (≥60 °C), pink when cooled in ice**; adding water shifts back to pink, adding HCl/NaCl shifts to blue. In plain 0.1 M aqueous CoCl2 it is pink at all temperatures. Use an activity model valid at high ionic strength for the Cl- medium (Davies fails above I≈0.5; use an extended/ B-dot or calibrated-γ± treatment, documented).
7. **Iodine clock.** The M4 network integrated through the vessel: 0.04 M S2O8-2 / 0.05 M I- / 0.002 M S2O3-2 (+starch): colourless for ~25 s at 20 °C, ~9 s at 35 °C, then abrupt blue-black starch–triiodide (`starch_I3` band ≈ 600 nm, very high ε) — the *colour* must switch sharply.
8. **Iron(III) thiocyanate.** Fe(NO3)3 + KSCN → blood-red [Fe(SCN)]2+ (K1≈ 138–890 M-1 at I≈0.5; use ~ 2.0e2... choose and cite), intensity scales with the Fe/SCN added, shifts with added Fe3+/SCN- (Le Chatelier); the dilute yellow-brown Fe3+ must be visible (hydrolysis).
9. **Neutralisation calorimetry.** 50 mL 1.0 M HCl + 50 mL 1.0 M NaOH from 22 °C: thermometer rises 6.4–6.9 K (M4 gate re-verified through the vessel, heat capacity of the glass included).
10. **Water: heating, boiling, steam, condensation.** 100 mL water, hot plate 600 W: temperature rises linearly, bubbles nucleate on the bottom (dissolved air first, ~60–80 °C), rolling boil clamped ≈ 99.9 °C (≈ 100 at 1 atm; slightly lower if altitude is modelled — keep sea level), visible steam, condensation fog on the cool upper glass, level falls, vessel boils dry → glass heats. A sealed vessel with water heated builds vapour pressure (Antoine) → stopper pops.
11. **Ethanol combustion hazard.** 20 mL ethanol in an evaporating dish/beaker; igniter held at it: ignition when vapour pressure supports a flammable mixture (flash point ≈ 13 °C, so ignites at room T), almost-invisible pale blue flame (ethanol), burns ≈ 0.025–0.06 mL/s·cm² ... (engine: burn rate from heat feedback), combustion products CO2/H2O conserved; extinguishes when fuel is gone; vessel mass drops on the balance.
12. **(stretch) Mg + HCl.** Mg ribbon in 1 M HCl: H2 bubbles on the metal, strongly exothermic, ribbon shrinks; H2 + igniter pop optional.

## Instrument realism targets
* **Thermometer:** glass alcohol/mercury-style, ±0.1 K resolution scale 1 °C ticks, lag time constant τ≈3–6 s (bulb), range −20…110 °C (saturates at top with column to the end; for >110 shows off-scale).
* **pH meter:** glass electrode, 0.01 resolution, τ≈2–4 s lag (slower in dilute/unbuffered), range 0–14, reads 0.01 pH, shows "---" when not immersed; probe stays wet between uses (no drying model needed).
* **pH paper:** universal indicator strip table (pH 1…13 → red…violet), colour appears when dipped; strip is single-use and held to compare against the colour chart printed on the dispenser.
* **Balance:** 0.01 g (or 0.001 g analytical) resolution, tare button, settles in ~1 s, drifts while a volatile open vessel evaporates/ boils; shows total of vessel glass + contents on the pan.
* **Pressure gauge:** analog dial (0–3 atm gauge, red zone), on a sealed vessel's stopper; follows `pressure_atm − 1`.
* **Stopwatch:** start/stop/reset, runs in wall time scaled by sim speed.
* **Time controls:** pause, 1×, 10×, 100×, jump to equilibrium (`VESSEL_EQUILIBRATE`). At high speeds fizz/boil visuals saturate sensibly.

## Advanced view (off by default, key `A` or a discreet toggle)
Species table (id/name/phase/amount/conc/activity/tier), active reactions with rate and provenance badges (*tabulated/estimated/speculative/refined/user-set*), conservation status, time plots (T, pH, pressure, selected species concentrations) drawn on canvas at ≤10 Hz sample, retained ~10 min of sim time.

## Progress log
- [x] Contract + stubs written (lead)
- [ ] ENGINE
- [ ] OPTICS
- [ ] RENDER
- [ ] EQUIP
- [ ] APP
- [ ] Integration, pytest gates, CLAUDE.md update

## Contract changes
(none yet)
