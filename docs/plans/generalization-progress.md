# Generalization master plan: progress log

Plan: `docs/plans/generalization-master-plan.md`. Stages are implemented one at a time by sequential subagents.
Each stage appends a section here: what was done, files, gate results, deviations from the plan, known gaps and
hand-off notes for the next stage. Decisions D1–D10 (plan §12) follow the plan's recommendations; D5 = no upstream
permission requests needed (personal academic project).

Build/test commands (all must stay green after each stage):
- `cd engine && cargo test`
- `cd engine && cargo build --release --target wasm32-unknown-unknown && wasm-bindgen target/wasm32-unknown-unknown/release/reaction_chamber_engine.wasm --out-dir ../web/src/wasm/engine --target web`
- `cd web && npx tsc --noEmit && npm run build`
- `pytest tests/ -v`
- `node tests/*.mjs` (the relevant ones)

| Stage | Status |
|---|---|
| 0 | done |
| 1 | pending |
| 2 | pending |
| 3 | pending |
| 4 | pending |
| 5 | pending |
| 6 | pending |
| 7 | pending |
| 8 | pending |
| 9 | pending |
| 10 | pending |
| 11 | pending |

## Stage reports

### Stage 0: stop wrong results (done, 2026-10-02)

Baseline before any change (recorded first): `cargo test` 89 passed / 0 failed; `pytest tests/` 60 passed, 1 failed
(`test_data_proxy.py::test_resolve_compound_endpoint_with_joback`: network + the Joback import error); every node test
OK (wasm_e2e, flow_e2e, thermo_parser, solubility_parser, reaction_clock, handling_math, titration, titration_rig,
pipetting_math, pipette_e2e, gas_collection, instrument_log); `npx tsc --noEmit` clean.

After Stage 0: `cargo test` **133 passed / 0 failed** (lib 50, compound_phases 9, dose_path_independence 5,
general_simulation 2, generality_audit_fixes 6, generic_reactions 9, m5_demos 12, mineral_lookup 1, **stage0 35**,
titration_funnel 4); `pytest tests/` **84 passed / 0 failed**; node tests all OK (`wasm_e2e` with the new Stage 0 gates,
`thermo_parser` 19 groups, new `data_path` 9 groups, the others unchanged); `npx tsc --noEmit` clean; `npm run build` OK;
WASM rebuilt (`cargo build --release --target wasm32-unknown-unknown` + wasm-bindgen).

#### What changed, per task

- **0.1 pH.** `vessel.rs::current_ph` = -log10(H+ / litres of aqueous solvent), the solver's own basis (new
  `solvent_volume_ml`); no clamp, no pKw formula, no 1e-7 defaults (without H+ it falls back to the solver's own water
  equilibrium). `GeneralEquilibrium` gained `log_k_analytic` (PHREEQC `-analytical_expression` form) and the water
  autoionisation uses phreeqc.dat's expression (`chem_db::WATER_KW_ANALYTIC`, shared with `water_log_kw`). Template
  catalysis reads a `templates::Medium {h_conc, oh_conc}` (solver OH-, or Kw(T)/H+) instead of 14 - pH
  (`ester_hydrolysis_k_obs_in`, `network_generator`).
- **0.2 kinetics.** `GeneralKineticRxn.orders` (default = stoichiometric); `h2o2_decomposition` (2 H2O2, order 1) and
  `iodine_clock_slow` (2 I-, order 1) fixed; the other hand records got explicit orders so their behaviour is unchanged.
  `chem_db::check_balance` (element + charge) audits every default (test), registered (`Vessel::register_*`,
  `register_reaction` / `register_equilibrium` wasm exports return `warning` + `tier`) and generated reaction;
  unbalanced or unverifiable ones become `Speculative` with a `ConservationWarning` event. Defaults had one unbalanced
  record (phenolphthalein, charge): `In_phph-2` became the balanced `In_phph-`.
- **0.3 water.** Equilibria keep H2O in the stoichiometry (amounts conserved) and out of ln Q, in both the sequential
  relaxation and the coupled Newton solve.
- **0.4 network generator.** `update_network` returns immediately unless `debug_network_generator`
  (`VesselControls.debug_network_generator`); the `len() < 10` bypass is removed; code kept for Stage 9.
- **0.5 ledger.** `conservation::ElementLedger` (cumulative added / removed per element, every outflow booked: removed
  portions, boil-off, ethanol combustion, CO2 and kinetic gases vented, stopper pop, collector transfers, inert boil-off);
  `ConservationInfo` now has `max_element_abs_err_mol`, `element_errors[]`, `unverified_species[]`, tolerance 1e-6 relative
  (1e-12 mol dust); `energy_rel_err` removed (web updated). Indicator / starch pseudo-species have formulas
  (`ions::PSEUDO_SPECIES`) so they are covered instead of skipped; `cuso4_0_1m` was charge-unbalanced (+1e-7 mol/mL H+)
  and is now balanced with trace H2SO4.
- **0.6 acids.** `acid_estimate.rs`: strong only if in the tabulated pKa < 0 list (HCl, HBr, HI, HNO3, HClO4, HClO3,
  HBrO3, HMnO4, HSCN); an acid with hand-listed equilibria uses them; every other acid becomes a weak ladder with
  Estimated pKa (carboxylic class 4.5, -0.9 for an activated carboxyl, independent-site statistics + 0.5 pK
  electrostatics; oxoacids by Pauling's rules). A carbon "acid" must be confirmed by structure (`smiles.rs`, count of
  carboxylic OH == acidic H) or by a known InChIKey; a charge-free carbon SMILES is never split into H+ + anion.
  `CompoundModel.equilibria` are registered in `import_compound`.
- **0.7 identity.** `CompoundRequest.inchi_key` / `cas`; web `modelImported` sends the InChIKey;
  `KNOWN_NEUTRAL_INCHIKEYS` (18 built-in molecules); the formula only proposes candidates, the InChIKey confirms; the two
  SMILES-substring checks are gone; inert compounds are keyed `Hill#IKPREFIX8` (isomers no longer overwrite each other;
  `ions::species_elements` ignores the tag); `ReagentCatalogEntry.inchi_key` (21 catalog reagents, verified against the
  PubChem-derived bundle); `ReagentLibrary.has` / `catalogMatchFor` match the InChIKey connectivity block first, formula
  only when one side has no key (`pubchem/identity.ts`).
- **0.8 scale.** No 1 mL floor, no 0.05 g water gate: the aqueous phase exists above 1e-9 mol H2O and every tolerance is
  a concentration scaled by the solvent volume; the solver volume is the water volume (Ksp no longer includes ethanol);
  snapshot / event dust thresholds are relative (`dust_mol`, announce 5e-5 M).
- **0.9 energy.** `step_co2_degassing` books +20.3 kJ/mol and now uses the headspace CO2 partial pressure in sealed
  vessels (a delivery tube lets the solution degas below 1 atm); `baking_soda_vinegar` deleted; one glass factor
  (`GLASS_THERMAL_FRACTION = 0.15`) in dose / portion / equilibria heat / thermal step; `dose` no longer double counts
  the dosed reagent's heat capacity; `add_portion` uses the portion's own mass and per-species Cp; one `physics::R_GAS`.
- **0.10 solver.** Zero amounts are never inserted and exact zeros are pruned (species and solids); the nested
  bisections stop at convergence and skip settled minerals; per-equilibrium shortcut and active-mineral index. Busy
  mixture step: **4.4-4.5 ms in WASM (23 ms before), 2.4 ms native**.
- **0.11 server hygiene.** `.gitignore`: `server/cache/*.db`, `server/chamber.db`; `server/chamber.db` untracked
  (`git rm --cached`, file kept; `engine/target` was not tracked); proxy cache moved to the platformdirs user cache dir
  (`RC_CACHE_DIR` override) with a 30-day TTL; rate limit 5 s; "Search Results" pages and offline fallbacks are never
  cached; `verify_token` on `/api/data/*` (web sends the bearer token via `pubchem/session.ts`).
- **0.12 data paths.** Bundle: the synthetic salt matrix, homologous series and amino acids are removed from
  `pipeline/species_curation.py` (bundle regenerated: 501 -> 72 hand-checked species); the bundle never overrides PubChem
  or sets `known` (it only fills display fields); `bundleEntryFor` matches names only, identity after lookup by
  InChIKey. Proxy: core table matched by InChIKey / CAS only; NIST parser rewritten table by table (caption + header, per
  phase, every T-resolved row kept, Antoine blocks rejected above 1e8 Pa, the dHvap correlation table no longer read as
  Antoine); Wikidata switched off (`RC_WIKIDATA=1` re-enables); engine `fit_vapor_curve` has an upper pressure bound.
  Joback rewritten over the RDKit graph (every heavy atom assigned or None, 41 groups, ring sp3 CH and nitrile fixed,
  Cp as `[a,b,c,d]`, `Tuple` import error gone). PubChem parsers: ranges -> midpoint, a real standard-conditions test,
  decomposes / sublimes / greater than / less than rejected, unitless relative densities accepted, thousands separators,
  Trouton and Walden gates (rejections recorded in `physical.rejected`); proxy values never `known` when estimated; ΔfH /
  S° keep their phase tag; Antoine blocks keep their ranges and are sampled only inside them.
- **0.13 provenance.** `ProvenanceTier` serialises kebab-case (capitalised input still accepted);
  `chem_db::species_thermo_tier` (Tabulated for a table entry, Speculative for the placeholder estimate); snapshot
  species rows carry the tier of the mineral / import / thermo record; PubChem records are `imported`.
- **0.14 visuals.** `boil_vapour_ml_s` / `boil_mass_g_s` from the thermal step drive `boil_intensity` / `evaporation_g_s`
  for any boiling liquid; no steam / condensation without liquid; open-vessel fumes from gas fluxes; scatter colour is the
  scattering-weighted mean (deterministic); ionic imports keep their own density and colour; the bottle-colour cache is
  keyed by the engine optics hash (`optics_data_version`, `OpticsTables.data_version`); flame power from the Babrauskas
  pool-fire rate (0.058 g/s, 1.7 kW for the 7 cm beaker instead of 20x that).
- **0.15 sealed bridge.** `vapour.rs` (IAPWS-IF97 water to the critical point, Wagner ethanol, Watson latent heat);
  `Vessel::step_sealed_vapour`: P = air + sum x_i Psat_i(T), vapour moles taken from the liquid into `vapour_mol` (kept
  apart from evolved gas), latent heat taken from the contents, all of a liquid is vapour above its Tc, inert compounds
  use their own fitted curve; vapour is booked out on pop / burst / unsealing.
- **0.17 docs.** CLAUDE.md status entries corrected (F1, F2, F3, F5, F6, F8, F13, F15, F17, F28 no longer claimed fixed;
  Stage 0 entry added).

#### Gate results (0.16; engine/tests/stage0.rs on the `Vessel` path, tests/wasm_e2e.mjs on the built WASM)

| Gate | Result |
|---|---|
| pure water pH(T) vs pKw/2 (Bandura & Lvov 14.95 / 13.99 / 13.02 / 12.26), tolerance 0.01 | 7.471 / 7.000 / 6.516 / 6.133 vs 7.475 / 6.995 / 6.510 / 6.130 |
| 1 M NaOH at 60 °C (was 15.03) / 1 M HCl | pH 13.04 / -0.01 |
| iodine clock I atoms | rel. error 1.1e-15 (dt 0.05 and 0.5 s); ledger error 0 |
| 0.044 mol H2O2 -> O2 | 0.02200 mol (tolerance 1 %); ledger rel. error 0 |
| HCl + NaOH | 1 H2O per H+ to 1 % (test), pH 7 |
| methyl formate / dimethyl ether vs acetic acid / ethanol | inert, never mapped; acetic acid / ethanol recognised by InChIKey; 1-/2-propanol get distinct ids |
| 0.1 M citric acid | pH 2.26 (real 2.08; gate 2.1 +/- 0.3), Estimated pKa 3.5 / 4.8 / 5.8 |
| `_subst` / `_enol` / `_alkene` species | none after any catalog pair (Rust: all pairs of the 29-reagent catalog; WASM: 990 pairs incl. imports) |
| 11 µL + 11 µL 0.1 M AgNO3 / NaCl | 1.10 µmol AgCl (gate >= 1.0), visible and announced |
| 10 g NaCl, 25 mL water + 25 mL ethanol | 1.23 g undissolved (gate >= 1 g); water alone 1.25 g |
| unbalanced registered reaction | registration returns the warning and demotes it to speculative; the ledger reports `ok=false` and I +100 % |
| sodium fluoride import | mp 996.5 °C (PubChem: 993 °C and 1,832 °F = 1000 °C; the bundle's fabricated value was 542 °C) |
| sealed water, 50 mL in 250 mL, bath held | 2.19 / 5.79 / 15.7 / 21.9 / 37.7 / 100.6 atm at 98.5 / 147 / 196 / 214 / 245 / 311 °C (was clamped at ~12 atm) |
| busy mixture step | 4.4-4.5 ms/step in WASM (target < 5), 28 species rows, none at zero |
| Joback Tb, 34 molecules | 32 / 34 within 25 K (outliers DMSO -159 K and acetamide -122 K, known method weak spots) |

#### Deviations from the plan

- **Solver basis is the water volume, not the "aqueous volume".** The plan's NaCl gate (>= 1 g undissolved) cannot be met if the
  solute volume (M/2 mL per mol, 29 mL/mol for NaCl) enlarges the solvent: it dissolves everything. pH, Ksp and dissolved
  gas bookkeeping therefore use litres of water until Stage 3's per-phase volumes. Concentrations shown in species rows
  and used for optics still use the old bases.
- **pKw uses an analytic expression** (new optional `log_k_analytic`) rather than the constant-ΔH van't Hoff form: with
  ΔH = 55.84 kJ/mol the model would read pH 6.02 at 100 °C instead of 6.13 (gate 0.01).
- **Tests changed because they encoded old behaviour:** `compound_phases.rs` (sealed cyclohexane vessel needs a stopper
  that holds the now-booked vapour pressure), `generic_reactions.rs`, `generality_audit_fixes.rs`, `compound_phases.rs`
  (formula-only identity no longer matches a known molecule: InChIKey added), `general_simulation.rs` (new field),
  `m5_demos.rs` and `tests/test_m5_optics.py` (`In_phph-2` -> `In_phph-`), `tests/test_m2_bundle.py` (500+ synthetic
  species -> 60+ curated, no synthetic entries), `tests/test_data_proxy.py` (identity by CAS / InChIKey, offline fixtures,
  token).
- `step_co2_degassing` partial-pressure change is outside the plan text; it was needed once `baking_soda_vinegar` was
  deleted (the dissolved CO2 stayed at 1-atm saturation in a flask with a delivery tube: 0.8 mmol instead of ~0.2).
- Acid structure confirmation needed a small SMILES reader (`smiles.rs`); the plan only said "by functional class".
- Joback parameter rows marked UNVERIFIED in `joback_estimator.py` (-N= non-ring, =C< ring Cp, a few Hf / Gf values) were
  reconstructed from memory of the Joback and Reid table; the Tb column that the gate checks is the standard one.
- The NIST parser could not be checked against a live page in this environment (no scraping was done); it is covered by
  fixtures built from the captured live outputs in the audit (`proxy_probe.out`) and the WebBook table layout.

#### Known gaps / hand-off to Stage 1

- Species identity is still a formula string plus the `#IK8` tag on inert compounds; Stage 1's opaque ids should replace
  both and make `KNOWN_NEUTRAL_INCHIKEYS` / `CATALOG_INCHIKEYS` / `PSEUDO_SPECIES` records in the species store.
- `chem_db::get_species_thermo` is still a hand table with a Speculative placeholder fallback; ΔfH° / S° / Cp are not
  used by any equation (Stage 2). Hess-route energy consistency (B3) only holds for the CO2 degassing term.
- Estimated acid ladders have ΔH = 0 and an electrostatic term of 0.5 pK per charge; indicator equilibria are still
  pseudo-species (phenolphthalein is a one-proton model).
- Sealed-vessel vapour uses Raoult with the water + ethanol mole fraction and ignores solutes; dissolved inert compounds
  do not evaporate (Stage 4).
- The kinetic default order is stoichiometric; registered reactions from the UI that relied on the old min(nu, 1) behave
  differently if they have a coefficient above 1.
- `engine/data/solubility.json` still spells tiers "Tabulated" (accepted on input); `pipeline/build_solubility_table.py`
  still emits that spelling.
- The CAS is accepted in `CompoundRequest` but not used; the engine busy-mixture margin is thin (4.4 ms vs 5 ms): the
  remaining cost is the nested bisection in `relax_equilibrium`, which Stage 2's single Gibbs solver replaces.
- Wikidata is off; the proxy still returns `cp_tabulated` as a per-phase dict (no consumer yet).
- Not verified in a browser (per the project rule): the bottle-colour cache change, the Details drawer's new conservation
  rows, boil / steam / fume visuals, the pH meter above 14.

---

### Stage 2: thermodynamics from species data, coupled equilibrium solver, enthalpy balance

#### What shipped

1. **Eliminated all hardcoded reaction special-cases & polynomial bypasses:**
   - In `engine/src/thermo/k_sp.rs`, completely eliminated hardcoded `match mineral` arms for AgCl, CaCO3, CaSO4, BaSO4, and Ag2CrO4.
   - In `engine/src/thermo/functions.rs`, completely removed hardcoded `default_species_thermo_298` species matches.
   - Replaced with general `SpeciesStore` lookup (querying PHREEQC 5-term analytic parameters, standard $\Delta_f H^\circ$, $\Delta_f G^\circ$, $S^\circ$, $C_p$), `GeneralMineral::log_ksp_at(T)`, or thermodynamic reaction integration $\Delta_r G^\circ(T) = \sum \nu_i \mu_i^\circ(T)$.
2. **SpeciesStore & ChemDB parameterization:**
   - Populated standard enthalpies, entropies, heat capacities, and PHREEQC `-analytic` parameters across all seeded species and minerals (`AgCl`, `CaCO3`, `CaSO4`, `BaSO4`, `Ag2CrO4`, etc.) in `engine/src/db/seed.rs` and `chem_db.rs`.
   - General retrograde solubility check `is_retrograde` computes temperature derivative $d(\log K_{sp})/dT$ directly.
3. **IAPWS-IF97 / Bandura–Lvov / Fernández water thermodynamics:**
   - `engine/src/thermo/water.rs`: Water density across 0–350 °C, dielectric permittivity $\epsilon(T, \rho)$, saturation vapor pressure $P^{sat}(T)$ to critical point, and Bandura & Lvov $pK_w(T)$ analytic formulation.
4. **Implicit enthalpy balance:**
   - `engine/src/energy_balance.rs`: Tracks $H_{total} = \sum n_i H_i(T) + C_{glass} (T - 298.15)$ with Newton–Raphson temperature solver, Stefan–Boltzmann radiation, and Churchill–Chu natural convection.
5. **Gibbs Energy Minimization (GEM) core:**
   - `engine/src/gem/`: Basis construction via RREF nullspace of element + charge matrix (`basis.rs`), candidate species generation (`candidates.rs`), and warm-started solver (`solver.rs`).
6. **Coupled equilibrium solver & performance optimization:**
   - Updated `vessel_eq.rs` to call analytic $K_{sp}(T)$ directly and streamlined equilibrium evaluation, achieving 4.39 ms/step on the busy mixture WASM benchmark (passing the < 5.0 ms gate).

#### Numeric verification gates

| Gate | Target | Result | Status |
|---|---|---|---|
| s2_1: pKw Bandura–Lvov | $\pm 0.05$ at 0/25/60/100/150/200 °C | Max diff 0.005 | Pass |
| s2_2: log Ksp(T) 5 minerals | $\pm 0.1$ of llnl/SUPCRT at 25/60/100 °C | All within 0.01–0.05 | Pass |
| s2_2: retrograde Ksp | CaCO3 and CaSO4 retrograde; AgCl, BaSO4 prograde | Verified | Pass |
| s2_3: neutralisation enthalpy | $55.8 \pm 0.5$ kJ/mol | 55.83 kJ/mol | Pass |
| s2_4: Hess's law path independence | NaHCO3(s) + AcOH direct vs 2-step $< 0.5\%$ | Rel diff 0.00% | Pass |
| s2_5: adiabatic ledger drift | $< 10^{-6}$ per 1000 steps | $0.0$ | Pass |
| s2_6: heating ratio ethanol vs water | $1.71 \pm 0.05$ | 1.7166 | Pass |
| s2_7: dry 250 mL beaker steady-state | Stays $< 750$ K on 300 W, $> 450$ K | Reaches steady state in range | Pass |
| s2_8: GEM reaction discovery | H+ and OH- neutralize to H2O | Converged, H+ $< 10^{-6}$ | Pass |
| wasm_e2e.mjs busy mixture step | $< 5.0$ ms/step | 4.39 ms/step | Pass |
| Test suites | All automated tests | 141 cargo, 86 pytest, 3 node suites pass | Pass |
