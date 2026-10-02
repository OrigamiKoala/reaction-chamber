# D. Reaction rates and kinetics: audit of the current working tree

Scope: how fast reactions run on the bench, which reactions count as "kinetic" and which as "instantaneous", where the
rate data comes from, and whether the server-side barrier pipeline does anything physically meaningful. Verified on the
uncommitted working tree (2026-10-01). The built WASM (`web/src/wasm/engine/*.wasm`, 21:50) is newer than every
`engine/src/*.rs` (latest 21:45), so the probes exercise current code. `cargo test --release`: 89/89 pass (41 unit + 48
integration). None of these tests checks stoichiometric balance, reversibility, rate order, dt-invariance or the
T-dependence of catalysed or generated rates, which is why all the defects below pass CI.

Probe scripts and outputs: `scratchpad/audit/probes/` (section 5).

---------------------------------------------------------------------------------------------------------------------

## 1. Inventory

### 1.1 What the bench actually runs

| Path | Code | Used by the bench? |
|---|---|---|
| `Vessel::step` → `step_kinetics` | `engine/src/vessel.rs:604-827` | **Yes.** Every tick, via `vessel_step`/`step_all` (`lib.rs:338, 370`). dt = `min(realDt·speed, 1.0)` s (`web/src/sim/sim_controller.ts:209-218`), so dt = 1 s at 20×. |
| `Vessel::update_network` (M6 generator) | `vessel.rs:340-373`, called from `settle_after_addition` `vessel.rs:444` | **Yes.** Runs after every `dose` and `add_portion` (`vessel.rs:420, 468`). |
| Equilibria + minerals (instantaneous) | `vessel_eq.rs:115-649` (sweeps + damped Newton) | **Yes.** All acid–base, complexation, precipitation and dissolution. `dt` only scales the reported "rate". |
| Inert-compound dissolution | `vessel_phase.rs:231` `inert_dissolution` | Yes. Instantaneous, solubility-capped. |
| CO2 degassing | `vessel.rs:649-674` → `phase_transfer.rs:17-56` | Yes. CO2 only. |
| Settling of precipitates | `vessel_ext.rs:224-241` | Yes (visual only). |
| Legacy `kinetics.rs` (ROS2 Rosenbrock, analytic Jacobian, separate rate orders and stoichiometry, reverse via `k_eq_298`) | `engine/src/kinetics.rs:1-418`, `lib.rs:174` `run_iodine_clock_sim` | **No.** The only caller is the worker's `RUN_IODINE_CLOCK` case (`simulation.worker.ts:140`). No client sends that message. |
| M4 "iodine clock ±20 %" gate | `tests/test_m4_kinetics_physics.py:21-43` | Tests **`pipeline/kinetics_physics.py`, a Python re-implementation**. It runs neither Rust path. |
| Server barrier workflow | `server/barrier_workflow.py`, `calibration.py`, `xtb_runner.py`, `job_queue.py`, `flywheel_runner.py` | **No.** The web app only calls `/api/xtb/trivial-test` (`web/src/ui/self_test.ts:51`). `/api/barrier/precomputed` (`server/main.py:144`) has no client. The engine's `NetworkGeneratorConfig::precomputed_barriers` is always empty (`network_generator.rs:56-66`, built with `::default()` at `vessel.rs:350`). |
| `register_reaction` (runtime kinetics) | `lib.rs:447-457`; worker `REGISTER_REACTION`; `SimController.registerReaction` (`sim_controller.ts:197`) | Exposed, but nothing in the app calls it. `import_compound` never creates a kinetic reaction (`compound_model.rs`: 0 references to `GeneralKineticRxn`). |

### 1.2 The live rate law (`vessel.rs:676-827`)

For each reaction in `self.kinetic_reactions`, in list order:

```
k      = A · T^n · exp(-Ea/RT)                                  (:694-695)
if catalyst solid present:  k = 0.08 · clamp(100·n_cat, 0.5, 10)  (:698-703, replaces Arrhenius)
r_fwd  = k · Π_solutes c_i^min(ν_i, 1) · Π_solids clamp(n_i^0.67, 0.1, 5)   (:707-728)
extent = min(r_fwd · V_rxn · dt, min_i n_i/ν_i)                 (:737)
```

- **Integrator:** a single explicit Euler step per tick, no substeps, no error control. The reactions are applied one
  after another, so each reaction sees the concentrations left by the previous one (Gauss–Seidel operator splitting).
- **Reversibility:** `is_reversible` and `k_eq_298` are never read. Everything runs forward only.
- **Order:** `min(ν, 1)`. Rate orders and stoichiometry are the same field, so an elementary `2A → B` runs at first order.
- **Concentration basis:** `reaction_volume_ml()` (water + miscible ethanol, `vessel.rs:1194`). Ideal: no activity
  coefficients and no salt effect.
- **Solids:** `n^0.67` of moles (the code computes `mass_g/mw`, which is just moles again), clamped to [0.1, 5]. The
  result is multiplied by `V_rxn` in the extent, so a heterogeneous rate scales with solution volume.
- **Heat:** `extent · ΔH_rxn` with a hand-typed ΔH per reaction (`chem_db.rs`), or a family-level ΔH for generated reactions.
- **Gas products:** written straight into the gas flux (no dissolved intermediate), at the total vessel pressure.
- **Special case:** ethanol combustion (`vessel.rs:797-825`): ignition when T ≥ 286 K, burn rate 0.04 mL·s⁻¹·cm⁻²,
  ΔHc 1367 kJ/mol, 15 % of the heat goes to the vessel.

### 1.3 Data

| Source | Count | Content | Provenance |
|---|---|---|---|
| `chem_db.rs:570-680` default kinetics | 6 | baking soda + vinegar (A 180, Ea 10 kJ), H2O2/MnO2 (A 1e3, Ea 25 kJ, catalyst), persulfate–iodide (A 1.15e8, Ea 52 kJ), I2 + thiosulfate (A 1e11, Ea 0), Mg + 2H⁺ (A 475, Ea 20 kJ), ethanol + 3 O2 (A 1e9, Ea 120 kJ) | All tagged `Tabulated`, with sources such as "IUPAC / CRC Handbook" and "NIST Chemical Kinetics". None can be traced. The A values are tuned to the demos. |
| `templates.rs:162-885` reaction families | 45 | One A, Ea, ΔH, ΔS and `is_reversible` per family, plus a catalysis enum (14 acid, 4 base, 4 both, 4 TM, 1 radical, 18 none) | No sources. Family-level ΔH/ΔS stand in for species thermochemistry. |
| `templates.rs:888-949` Mayr | 15 nucleophiles, 11 electrophiles | N, s_N, E. Converted to Eyring with an assumed ΔS‡ = −60 J/(mol·K) (`templates.rs:56-82`) | Some values differ from Mayr's database, e.g. OH⁻ in water is N 10.47 / s_N 0.61 there and N 14.5 / s_N 0.90 here. Several of the "E" values for aldehydes and ketones are not Mayr parameters at all. |
| `templates.rs:86-102` diffusion limit | 1 formula | Smoluchowski k_D = 8RT/(3η), combined harmonically with k | η is fixed at 8.9e-4 Pa·s (`network_generator.rs:62`). No Debye factor for ions. |
| `templates.rs:108-158` | 2 functions | `sn2_e2_product_ratio` (hard-coded A/Ea per substrate class, ×0.005 / ×3 for a bulky base) and `ester_hydrolysis_k_obs` (k_acid 1.1e-4, k_neutral 1.5e-8, k_base 0.11, pOH = 14 − pH) | Used only by the `m6_*` exports and their tests. These are scenario functions. |
| `phase_transfer.rs:4, 33, 43-44` | — | CO2 Henry constant 0.034 M/atm, ΔH_sol −20 kJ/mol, degassing rate 0.15 s⁻¹ (×3.5 when stirred) | Hard-coded for CO2 only. |
| `vessel_ext.rs:230-232` | — | Stokes settling with η = 1e-3, ρ_liquid = 1, ×10 aggregate size, a fixed 4 cm height, τ clamped to [8, 300] s | Hard-coded. |
| `server/calibration.py:32-71` | 3 families × 6 | "xtb_raw" and "exp" ΔG‡ pairs | **Both columns are typed in by hand.** The xTB numbers are not outputs of the workflow (see D17). |

### 1.4 Who decides between "instantaneous" and "kinetic"?

Only list membership. A reaction is instantaneous if it was written as a `GeneralEquilibrium`/`GeneralMineral`
(`chem_db.rs:277-553`, `solubility.json`, `auto_minerals()`), and kinetic if it is in `get_default_kinetic_reactions()`,
was registered at run time, or was generated by the M6 templates. Nothing compares a relaxation time with the time step.
Consequences:

- **Every dissolution is instantaneous**, whatever the particle size or stirring. The only exception is Mg (P7).
- **Every precipitation is instantaneous once S > 1.** There is no nucleation barrier, induction time or growth law (P7).
- **Slow "equilibria" run instantly**, e.g. CO2 hydration (k ≈ 0.03 s⁻¹) and ligand exchange on inert ions (Cr³⁺, Co³⁺).
- **Fast chemistry is sometimes kinetic and slow.** H⁺ + HCO₃⁻ appears twice: as an equilibrium (`carbonic_acid_dissoc1`)
  and as a hand-written kinetic path with k = 3.2 M⁻¹s⁻¹ for acetic acid only (P8).

---------------------------------------------------------------------------------------------------------------------

## 2. Status of the prior-audit items in this area

| F | Prior claim | Current status | Evidence |
|---|---|---|---|
| **F10** | Explicit Euler, forward only, order = min(ν,1), total-volume basis | **Open, verified.** Line numbers have moved to `vessel.rs:676-791`. | P6: A⇌B with K = 1 ends with 0.0000 of A left (detailed balance gives 0.5000). For `2A→B` the initial rate goes 2.0e-3 → 1.0e-3 M/s when [A] is halved, i.e. first order (second order would give 4×). First order with k = 2 s⁻¹, after 1 s: 0.1216 / 0.0625 / 0.0000 / 0.0000 for dt = 0.05 / 0.25 / 0.5 / 1.0 (exact 0.1353). |
| **F21** | 6 hand-written reactions, only Mg reacts with acid | **Open, and worse than reported.** Two of the six are not atom-balanced (D1). Ethanol combustion never fires because the species `"O2"` never exists. Imports create no kinetics. `register_reaction` has no caller in the app. | P3: Zn, Fe and Al imports are "inert" and give 0.00 mL gas in 1 M HCl over 60 s. P1, P2: atom balance. |
| **F22** | Solid catalyst replaces k with 0.08·clamp(100n, 0.5, 10) | **Open, verified.** `vessel.rs:698-703` | P1: with 0.5 g MnO2, the H2O2 consumed in 60 s is 4.131e-2 mol at 278, 298 and 348 K alike. 0.05 g vs 0.5 g MnO2 consumes 4.010e-2 vs 4.131e-2 mol (the clamp floor). A dissolved catalyst passes the presence check (`:684-690`) but gets no boost, so it falls back to A = 1e3, Ea = 25 kJ. |
| **F23** | Family ΔH/ΔS. Mayr keys never match. k frozen at the generation T | **Open, verified, and worse** (D2, D3, D13–D15). | P5: tautomerism k_obs = 2.068e-8 s⁻¹ is unchanged after heating 298 → 347 K (Arrhenius predicts ×54) and after neutralising pH 0.3 → 2.5 (the template's own catalysis term predicts ×6e-3). P4b: the Mayr branch only fires for literal ids `nuc_piperidine` + `el_benzhydrylium_ph`. |
| **F32** | Caps 200/500/80, reached silently | **Open.** `cap_reached` exists in `GeneratedNetwork` but is not read by `vessel*.rs` or the web app. The vessel's `kinetic_reactions` list only ever grows. | P4b: EtOAc + OH⁻ hits the cap (200 species, 99 reactions) with no warning. |
| **F44** | pOH = 14 − pH, fixed k_acid/k_base | **Open.** `network_generator.rs:494-512` and `templates.rs:142-158`. The catalysis factor also double-counts OH⁻ (D13). | Code. |
| **F45** | Gas-phase single point labelled ALPB, first reactant only, "TS" = stretched first bond, constant thermal correction, hard-coded flags, unused | **Open, verified with stored results** (D17). | `server/cache/barrier_*.json` (88 files): CCBr + OH⁻, CCBr + CN⁻ and CCCl + SH⁻ all give ΔG‡_raw 60.7 kcal/mol. Calibrated values are 49–79 kcal/mol (k ≈ 1e-23 s⁻¹). Some runs give 5.14 kcal/mol from the exception fallback, still labelled `tblite_GFN2-xTB_ALPB`. |
| **F46** | A parallel legacy engine is covered by the M3/M4 gates | **Open, and worse.** The M4 kinetics gate tests Python (`pipeline/kinetics_physics.py`), not Rust. The bench's own iodine-clock parameters disagree with that gate's by 3× (D9). | `tests/test_m4_kinetics_physics.py:14-19`. P2b: on the bench the clock switches at ~25 s at 20 °C. The gate's own k (0.020 M⁻¹s⁻¹) predicts ~75 s for the same recipe. |
| F1 (related) | Generator makes up chemistry for inorganic ions | **Only partly fixed.** There is now an exclusion list (`network_generator.rs:322-326`), but `CoCl4-2` still matches as an "alkyl halide". Any id containing "CO" (CO2(aq), HCO3-, CH3COOH, CaCO3(s)) gets keto–enol tautomerism. | P4: NaHCO3 + HCl → `CO2(aq)_enol` 7e-7 mol in 60 s. Vinegar → `CH3COOH_enol`. Generator: `CoCl4-2 + OH- → Co4-2_subst + Cl-`. |
| F2 (related) | Conservation ledger fixed | **Masked.** Generated species ids cannot be parsed, so `species_elements` returns None and they are silently left out (`vessel.rs:1115-1124`, `ions.rs:130-134`). Gas lost from open vessels is not booked. The 5 % tolerance is taken against totals dominated by water. `energy_rel_err` is the constant 1.5e-5 (`vessel.rs:1143`). | P1: 2× H and O2 creation still reports `ok: true`, `max_element_rel_err` 0.0149. |
| F11 (related) | Combustion hard-wired to ethanol | **Open.** `vessel.rs:797-825`. | Code. |
| F47 (related) | Particle size stored per compound | **Open.** No nucleation/growth model. | P7: no `particle_um` in the BaSO4 snapshot. Size comes from `default_particle_um`. |

---------------------------------------------------------------------------------------------------------------------

## 3. New findings

Severity: **B** = blocks / gives wrong results, **D** = degrades, **C** = cosmetic.

**D1 (B): The hand-written kinetic reactions create atoms.**
- `h2o2_decomposition` (`chem_db.rs:590-606`) has reactants `{H2O2: 1}` and products `{H2O: 2}` + `{O2(g): 1}`.
  Each H2O2 makes 2 H2O and 1 O2, so H doubles and O triples.
  - P1: 0.0413 mol H2O2 gives 0.0826 mol H2O (ratio 2.00, correct 1.00) and ~1040 mL O2. The correct volume is ~505 mL.
- `iodine_clock_slow` (`:607-623`) has `{I-: 1}` → `{I2(aq): 1}`. Stoichiometry was bent to get first order in I⁻.
  - P2: total I atoms +18 % (with thiosulfate) and +33 % (without) at 20 °C, +34 % at 35 °C.
- There is no balance check on default, registered or generated reactions, and the conservation audit hides the error
  (F2 row above).
- Fix: separate `orders` from `stoich` (the legacy `KineticReaction` already does this, `kinetics.rs:7-10`), and
  balance-check every reaction in `register_kinetic_reaction` (reject or downgrade the tier).

**D2 (B): The network generator invents species in ordinary inorganic vessels and expands without bound.**
It runs after every addition (`vessel.rs:444`) and classifies species by substrings of their ids:

| Matcher | Code | Matches by mistake |
|---|---|---|
| tautomerism | `network_generator.rs:230`: contains "CO", "CHO" or "one" | CO2(aq), HCO3⁻, CO3²⁻, CH3COOH, CH3COO⁻, CaCO3(s) |
| base | `:327`: contains "OH" or "O-" | CH3COOH |
| halide | `:322-326` | CoCl4-2 |
| ester | `:399`: contains "acetate", "ester", "EtOAc" | — |

Products are named by appending strings to the reactant id (`X_enol`, `X_alcohol`, `X_subst`). Those names match the
same tests again, which produces chains:
- `CO2(aq)_enol_enol_enol…` (10 forced reactions, from the `len() < 10` bypass at `:125, :175`).
- `EtOAc_alcohol_alcohol_alcohol…` until the 200-species cap (P4b).

The products are not balanced: the E2 product drops H2O, `sn1` always releases Cl⁻ (`:261`), the halide leaving group
defaults to Br⁻. Each tautomerisation also absorbs +42 kJ/mol of heat.

On the bench, P4 shows `keto_enol_tautomerism_CO2(aq)` active with rate 1.4e-7 M/s after NaHCO3 + HCl, and
`CH3COOH_enol` after an hour in vinegar. Real CH3COOH and SMILES-identified organics are never matched correctly,
because imports are keyed by Hill formula: `C4H8O2` + OH⁻ produces no reaction (P4b).

Recommendation: disable `update_network` on the bench until templates act on atom-mapped SMILES (Stage 5 of the prior plan).

**D3 (B): Generated rate constants are frozen.**
`vessel.rs:356-371` stores `arrhenius_a = k_fwd(T_gen, pH_gen)`, `arrhenius_ea = 0`, and never refreshes an id that is
already present (`:355`). Rates ignore later T, pH and solvent changes (P5). The acid/base catalysis factor for the
generation pH is baked into A as well.

**D4 (B): The integrator is not dt-invariant and not stiff-stable.**
Single explicit Euler step with extent clipping (`vessel.rs:737`), reactions applied sequentially.
- Any reaction with k·dt ≳ 0.1 is wrong.
- Any reaction with k·dt ≥ 1 completes in one tick, whatever its true time course (P6).
- At 20× speed dt = 1 s, so every pseudo-first-order rate above ~0.1 s⁻¹ is distorted.
- The sequential update makes results depend on list order (for example, the I2 made by `iodine_clock_slow` is consumed
  in the same tick only because that reaction comes before `iodine_thiosulfate_fast`).

**D5 (B): No reverse reactions and no thermodynamic consistency.**
`is_reversible`/`k_eq_298` are ignored. Generated reactions do carry `k_rev`, but it is dropped. The templates'
irreversible flag also overrides their own thermodynamics: E2 has K(298) = 0.53 (ΔG° > 0) and still runs to completion
(P4b). (P6 is the verification.)

**D6 (B): The rate order is min(ν, 1).**
This is the "design" claimed in CLAUDE.md ("capped at min(coeff, 1.0)"). It makes every elementary bimolecular
self-reaction (2 NO2, 2 I, radical recombination, 2 H2O2 on a surface) first order (P6).

**D7 (B): The heterogeneous metal–acid rate is unphysical.**
`vessel.rs:716-722` with `mg_acid_dissolution`:
- **Rate ∝ solution volume.** 0.1 g Mg in 1 M HCl: 25 mL gives 9.1 mL H2/s, 200 mL gives 72.8 mL/s.
- **Rate does not depend on the amount of metal below 0.78 g** (clamp floor 0.1 on n^0.67): 0.02, 0.1 and 0.5 g all start
  at 18.2 mL/s.
- **No area, particle-size or stirring term.** Stirring changes nothing.
- **Only Mg exists.** Zn, Fe and Al imports are inert.

(P3 for all of the above.)

**D8 (B): Catalysis.**
F22 as above. In addition:
- Homogeneous catalysis (KI or Fe³⁺ with H2O2, acid catalysis of hand-written reactions) has no representation outside
  the templates.
- The uncatalysed H2O2 path is skipped entirely: `continue` when the catalyst is absent (`:684-691`).
- The rate is not proportional to catalyst area, and is T-independent (P1).

**D9 (D): Two inconsistent iodine-clock parameter sets; the M4 gate tests neither engine path.**

| | A | k1(20 °C) | k2 (I2 + thiosulfate) |
|---|---|---|---|
| Bench (`chem_db.rs:613`) | 1.15e8 | 0.062 M⁻¹s⁻¹ | 1e11 |
| Legacy and gate (`kinetics.rs:330`, `pipeline/kinetics_physics.py:66`) | 3.73e7 | 0.020 M⁻¹s⁻¹ | 5e5 |

- For the m5 demo recipe ([S2O8] 0.0133, [I⁻] 0.0167, [S2O3] 6.7e-4 M after mixing): the bench switches at ~25 s (P2b),
  while the gate's own k predicts ~75 s.
- The bench k2 = 1e11 M⁻¹s⁻¹ exceeds the diffusion limit (~7e9).
- The persulfate–iodide rate depends strongly on ionic strength (Brønsted–Bjerrum, z_A·z_B = +2). That is not modelled
  (D21).

**D10 (D): Acid + bicarbonate has two inconsistent models, and degassing is CO2-specific.**

| | Acetic acid | HCl |
|---|---|---|
| Model | Hand kinetic path, k = 3.2 M⁻¹s⁻¹, writes CO2(g) directly | Equilibria + Henry degassing |
| CO2(aq) left after 120 s | 5.7e-3 M | 3.43e-2 M |

- Degassing (`phase_transfer.rs:17-56`) relaxes toward K_H·P_total (1 atm), not toward atmospheric pCO2. Carbonated
  water in an open beaker therefore keeps 0.034 M CO2 indefinitely; air equilibrium is ~1.3e-5 M.
- The rate constants 0.15 / 0.525 s⁻¹ are hard-coded.
- Only CO2 is handled. Dissolved NH3, Cl2, SO2, H2S and O2 never exchange with the gas phase.
- In reality the H⁺ + HCO₃⁻ proton transfer is diffusion-limited. The slow steps are H2CO3 → CO2 dehydration (~20 s⁻¹)
  and CO2 hydration (0.037 s⁻¹, which matters for CO2 + base demos). Neither is represented. (P8)

**D11 (B): Dissolution and precipitation have no kinetics at all.**
- P7: 5 g KCl dissolves into 50 mL water within the dosing call (0.0000 g left before any step). 2 g NaHCO3 likewise.
- BaSO4 precipitates at once at S = IAP/Ksp = 1.56 (0.062 mg). It does not at S = 0.93. There is no metastable zone,
  induction time or supersaturation-dependent particle size.
- The web app hides this with a "dissolving ghost pile" (`visual_contents.ts`). The visible dissolution rate is
  therefore a front-end animation, not physics.
- Stirring and particle size cannot change any dissolution or precipitation rate.

**D12 (D): The diffusion limit uses a fixed viscosity, has no electrostatics, and is applied selectively.**
- η = 8.9e-4 Pa·s at any T and in any solvent (`network_generator.rs:62`). Water at 348 K is 3.8e-4, so k_D is low by ×2.3
  there.
- There is no Debye factor (×3–10 for oppositely charged ions; H⁺ + OH⁻ is 1.4e11 M⁻¹s⁻¹ versus the 7.4e9 from the formula).
- The cap is applied only to generated reactions, not to default or registered ones (D9: 1e11).

**D13 (D): The template catalysis term double-counts and its pH is frozen.**
`compute_rate_and_equilibrium` multiplies k by [OH⁻]/0.1 for base-catalysed families (`network_generator.rs:500-503`),
and OH⁻ is also a reactant of the generated reaction. The rate therefore goes as [OH⁻]², i.e. 100× slower at pH 12 than
at pH 13 for saponification (expected 10×). pOH = 14 − pH at any T (F44). Combined with D3, the pH is frozen.

**D14 (D): Family constants are unsourced and wrong by 1–2 orders of magnitude.**
- `base_ester_hydrolysis`: k(298) = 3.9 M⁻¹s⁻¹ (P4b). Ethyl acetate + OH⁻ is 0.11 M⁻¹s⁻¹, a 35× error. The repo's own
  `ester_hydrolysis_k_obs` has 0.11.
- Ethyl bromide + OH⁻ is routed to `sn2_secondary_halide` (k = 2.6e-6). Primary SN2 by OH⁻ is ~1e-4 M⁻¹s⁻¹, and the
  `sn2_primary_halide` family exists but is unused.
- All 45 families are tagged `Tabulated` when they should be `Estimated` at best.
- Family ΔH/ΔS (e.g. every Diels–Alder ΔS = −140) replace the species ΔfG°, which violates the "intrinsic data in"
  invariant.

**D15 (D): Mayr branch.**
- Dead on the bench (F23).
- The hard-coded adduct thermochemistry ΔH = −55 kJ/mol, ΔS = −70 J/(mol·K) (`network_generator.rs:296-297`) sets K and k_rev.
- The parameter discrepancies are listed in §1.3.
- The ΔS‡ = −60 J/(mol·K) assumption used for the T extrapolation is a reasonable *Estimated* model, but it should be
  labelled as such.

**D16 (D): The precomputed-barrier hook is unwired and has the wrong formula.**
- `precomputed_barriers` is never filled: the default is empty and there is no worker message.
- If it were filled, `network_generator.rs:483-488` would set `Ea = ΔG‡` and `A = 1e11`. That is not Eyring
  (k_BT/h = 6.2e12 s⁻¹, and ΔG‡ already contains −TΔS‡). It underestimates k by ~60× at 298 K and has the wrong T-slope.
- The server derives "Ea" from two Eyring evaluations of the same ΔG‡ (`barrier_workflow.py:186-190`), which yields
  Ea = ΔH‡ + RT with an implicit ΔS‡ = 0.

**D17 (D): The server barrier workflow is not a barrier calculation (F45 confirmed with data).**
`barrier_workflow.py`:
- **Only one molecule:** only the first reactant is used (`:145`), so the nucleophile, solvent and product never enter.
- **No TS search:** the "TS" moves atoms 0 and 1 apart by 0.6 Å (`:160-168`).
- **No solvent model:** `tblite.interface.Calculator("GFN2-xTB", …)` without a solvation model, labelled `GFN2-xTB_ALPB` (`:210`).
- **Silent fallback:** `evaluate_xtb` swallows any exception and returns a made-up energy `-0.5·ΣZ + 0.05/d` (`:56-61`).
- **Fake frequency check:** frequencies are computed on the first 4 atoms only, and when no imaginary mode is found one is
  inserted (`:110-112`).
- **Constant thermal correction** of 2.0 kcal/mol (`:177`).
- **Hard-coded flags:** `validation_flags` is a constant list that includes "irc_confirmed" (`:195`).

Stored results (`server/cache`):

| Input | Raw ΔG‡ |
|---|---|
| CCBr + [OH⁻] | 60.69 kcal/mol |
| CCBr + [CN⁻] | 60.69 kcal/mol |
| CCCl + [SH⁻] | 60.68 kcal/mol |
| c1ccccc1CCl + OH⁻ | 96.6 kcal/mol |
| Several runs (exception fallback) | 5.14 kcal/mol |

The true ΔG‡ for EtBr + OH⁻ in water is ~23 kcal/mol.

The M7 gate (`calibration.py:evaluate_held_out`, "max log error 0.048") fits a line through hand-typed `xtb_raw_kcal`
values, so it measures the fit of constants, not the workflow. `job_queue.py` runs this in a `ThreadPoolExecutor`;
`flywheel_runner.py` loops over 40 hard-coded SMILES (`:21-61`).

**D18 (C): Combustion.** The `ethanol_combustion` kinetic needs `"O2"` and is dead. The flame is special-cased
(`vessel.rs:797-825`): ignition at T ≥ 286 K, burn rate 0.04 mL·s⁻¹·cm⁻² for ethanol only, 15 % heat coupling. See F11.

**D19 (D): The reaction list grows without bound and caps are silent.**
Generated reactions are only ever added to `Vessel::kinetic_reactions`. `generated_reactions.len() < 10` admits 10
reactions per call regardless of flux. `cap_reached` is never surfaced (F32). Per-tick cost grows with the history of
doses.

**D20 (C): Settling.** Stokes law with fixed η = 1e-3, ρ_liq = 1.0, a 4 cm height (not the actual liquid height),
×10 flocculation and τ clamped to [8, 300] s (`vessel_ext.rs:230-232`). Particle size comes from the compound (F47).

**D21 (D): Concentration basis and activities.**
- All rates use `reaction_volume_ml()` concentrations, ideal.
- There is no primary salt effect (log k = log k⁰ + 1.02·z_A·z_B·√I/(1+√I)), no per-phase concentration for reactions
  in an organic layer, and no solvent dependence.
- Rates in ethanol–water mixtures use the combined volume.

**D22 (C): Stirring is a boolean.** `stir_rpm` is stored (`vessel.rs:582`) but unused. Stirring affects only CO2
degassing and settling, not dissolution or metal reactions.

---------------------------------------------------------------------------------------------------------------------

## 4. Recommendations: the most general rate framework that is achievable

### 4.1 What is honestly available

There is **no comprehensive open database of solution-phase rate constants.** What exists:

| Source | Coverage | Licence / access | Verdict |
|---|---|---|---|
| NIST Chemical Kinetics DB (SRD 17) | ~38k gas-phase reactions, mostly radical/combustion | SRD copyright; HTML form only | Gas-phase flames only, per-user proxy cache. **Not a bench backbone.** |
| JPL Evaluation 19-5 / IUPAC atmospheric task group | ~1000 evaluated gas-phase and heterogeneous atmospheric reactions with k(T) | JPL is US-government, public domain; IUPAC is free to use with citation | Bundle for gas-phase chemistry (NOx, O3, Cl2/radicals). Narrow but clean. |
| ReSpecTh / CHEMKIN mechanisms (GRI-Mech 3.0, etc.) | Combustion of small fuels | Mostly open | Only for a real gas-phase flame model. Defer. |
| Buxton et al. 1988 (J. Phys. Chem. Ref. Data 17, 513) + NDRL/NIST RCDC | ~3500 rate constants of e⁻(aq), H•, •OH and O•⁻ in water | Facts from a published compilation; RCDC database is SRD | Bundle the subset needed for radical/redox chemistry in water. |
| **Eigen–Wilkins**: water-exchange rates k_ex of aqua ions (Helm & Merbach, Chem. Rev. 2005) + outer-sphere K_os from Fuoss | ~60 metal ions → **every** complexation/ligand-substitution rate | Published numbers, small table | **Implement.** One small table makes all complexation rates derivable, e.g. Cr³⁺ is slow (k_ex 2.4e-6 s⁻¹), Cu²⁺ fast (4e9). |
| **Eigen proton transfer**: k = k_D / (1 + 10^(pKa(donor) − pKa(acceptor))) | Every acid–base reaction, given pKa (already present) | Model | **Implement** as the rate for acid–base. Gives "instantaneous" for O/N acids and slow C–H acids automatically. |
| **Marcus cross relation**: k12 = √(k11·k22·K12·f12) with self-exchange k11 (~100 couples tabulated, e.g. Fe³⁺/²⁺ 4 M⁻¹s⁻¹, MnO4⁻/²⁻ 3e3), K12 from E° (= ΔfG°) | Outer-sphere electron transfer between inorganic couples | Published numbers | **Implement** for redox. Inner-sphere and multi-electron oxidants (MnO4⁻/oxalate, dichromate) still need per-reaction data or mechanism. |
| Mayr database | ~1300 N/s_N and E (polar organic bond formation, 20 °C, measured solvents) | Free web access; check the terms before bundling | Keep as one *Tabulated* tier (fix the ids, label solvent), with the existing ΔS‡ estimate for T. Narrow but real. |
| US EPA EPI Suite HYDROWIN (public domain) | Acid/base/neutral hydrolysis k for esters, carbamates, epoxides, alkyl halides, via Hammett/Taft LFER | Public domain | Use as an *Estimated* source for hydrolysis-family rates instead of the hand family A/Ea. |
| RMG-database kinetics families/libraries (rate-rule trees, Evans–Polanyi, some liquid-phase and solvation corrections) | Thousands of mostly gas-phase rate rules, atom-mapped templates | No LICENSE file (data-sources.md); RMG-Py is MIT. Ask before bundling | Best open source of **atom-mapped templates** (which reactions occur). Rate rules mostly gas phase: correct with solvation (RMG's Abraham/LSER-based ΔG_solv for TS ≈ reactants) and label *Estimated*. |
| ML barrier predictors (Chemprop on RDB7 / Transition1x / Grambow; Chung & Green kinetic solvent effects) | Arbitrary atom-mapped reactions | Datasets are CC-BY; models are open source | Server-side, *Speculative*. ~3–5 kcal/mol MAE versus DFT in-distribution, i.e. 2–4 orders of magnitude in k. Useful to rank competing channels, not to predict absolute times. |
| xTB TS search (the existing server) | Anything | Open | Only with a real path search (xtb `--path` / NEB / GSM via pysisyphus), TS optimisation, full Hessian, IRC, ALPB solvent, and both reactants. GFN2 barrier MAE is ~5–10 kcal/mol, so tier *Speculative*, offline only, calibrated per family against *real* computed-vs-experimental pairs. |

### 4.2 Models that are too narrow to implement

- Per-reaction scenario functions (`sn2_e2_product_ratio`, `ester_hydrolysis_k_obs`, the bulky-base multipliers, the
  current hand-tuned A values for the clock and baking soda): keep them as test fixtures with literature targets, never
  as engine data.
- Hammett/Taft as a standalone engine model. It is only useful inside a family that already has a reference rate and
  substituent perception (HYDROWIN packages it). Skip until atom-mapped templates exist.
- The 45 family-level A/Ea/ΔH/ΔS rows as they stand: replace ΔH/ΔS with species ΔfG° and A/Ea with rate rules from a source.
- Substring-matched generation: delete.
- xTB barriers as the default for bench reactions: too slow (minutes) and too inaccurate.
- A detailed gas-phase radical mechanism for the flame: overkill. Use a vaporisation-limited pool-fire burning rate
  instead (below).

### 4.3 Target architecture

Each kinetic reaction is a record:

- **Stoichiometry:** atom- and charge-balanced, checked at registration.
- **Rate law:** mass action in **activities** for elementary steps, or explicit empirical orders kept separate from
  stoichiometry, or a surface rate.
- **Phase:** where it happens (aqueous / organic layer / interface / gas).
- **Forward rate provider** with a provenance tier, returning k_f(T, P, solvent).
- **Reverse rate by detailed balance:** k_r = k_f / K(T), with K(T) = exp(−ΔrG°(T)/RT) from the species' intrinsic
  ΔfH°, S° and Cp. This is the same thermochemistry the equilibrium solver uses, so kinetics and equilibrium can never
  disagree.

Forward rate providers, in priority order:

1. **Tabulated k(T)** with A, n, Ea, T-range, solvent and source (JSON library).
2. **Mechanistic models:** Eigen (proton transfer), Eigen–Wilkins (substitution), Marcus (outer-sphere ET), Mayr (polar
   organic), HYDROWIN (hydrolysis). These cover most of school and undergraduate inorganic chemistry with small tables.
3. **Family rate rules:** Evans–Polanyi Ea = E0 + α·ΔrH (per family), Brønsted catalysis law for general acid/base
   catalysis. Provider 3 gives ΔG‡ and ΔS‡ separately.
4. **Server / ML ΔG‡** (*Speculative*), always converted with **Eyring** k = κ·(k_BT/h)·exp(ΔS‡/R)·exp(−ΔH‡/RT).
5. **Diffusion ceiling for every bimolecular step:**
   k_eff⁻¹ = k_act⁻¹ + k_D⁻¹, with k_D = 4πN_A(D_A + D_B)(r_A + r_B)·f_Debye,
   f = δ/(e^δ − 1) and δ = z_A·z_B·e²/(4πε₀εr·k_BT·(r_A + r_B)).
   - D from Stokes–Einstein (Wilke–Chang for neutrals) with **η(T) of the actual solvent**: IAPWS-2008 for water, RMG
     solvent A/B/C or Andrade fits otherwise.
   - r from the molar volume (or McGowan volume from SMILES).
   - εr(T) from the solvent library.
   - Salt effect: log γ‡ via the existing Davies/activity model, so k scales as γ_A·γ_B/γ‡.

Catalysis is just additional reactions: catalyst + substrate ⇌ complex → products + catalyst, or a surface rate. There
are no "catalyst replaces k" rules.

The class (instantaneous or kinetic) is **decided by timescale, not by list**. Every reaction has both K(T) and a k. At
each tick, compute the relaxation time τ_r = 1/|∂r/∂ξ| at the current state. Reactions with τ_r < 1e-3·dt (typically
acid–base, labile complexation) are handed to the existing equilibrium solver (`vessel_eq.rs`) as algebraic constraints.
All others are integrated. Precipitation and dissolution leave the instantaneous solver entirely and get the
heterogeneous models below.

### 4.4 Heterogeneous and transport models

All of these are general and use only intrinsic data plus correlations:

- **Dissolution / growth (shrinking particle):** dn/dt = −k_L·A·(c_sat − c).
  - k_L = Sh·D/d. Sh = 2 + 0.6·Re^½·Sc^⅓ (Ranz–Marshall), or the Levins–Glastonbury / Armenante–Kirwan stirred-tank form
    using the power input from `stir_rpm` and vessel geometry.
  - A from a particle-size distribution (default by form: powder ~100 µm, crystals ~1 mm, ribbon/sheet from thickness),
    shrinking as d ∝ n^⅓.
  - c_sat comes from the existing solubility model.
  - Optional surface-reaction term k_s(T)·(1 − Ω) for slow minerals (calcite in acid, quartz).
  - This replaces the instantaneous `inert_dissolution` and the ghost pile.
- **Precipitation:** classical nucleation theory plus growth, solved by the method of moments (μ0..μ3 per solid, i.e.
  4 ODEs).
  - J = A_J·exp(−16π·γ³·v_m²/(3·k³T³·(ln S)²)).
  - Interfacial energy from the Mersmann correlation γ = 0.414·k_BT·v_m^(−2/3)·ln(1/(c_s·v_m·N_A)), so **no
    per-compound fit is needed**.
  - Growth: diffusion-limited, with the same k_L.
  - Outputs: induction time, metastable zone, and a mean particle size that feeds settling and turbidity (fixes F47).
- **Metal + acid and corrosion, cementation:** mixed-potential Butler–Volmer.
  - Inputs: E°(M^z+/M) from ΔfG°; a ~30-row table of HER exchange current densities i0 per metal (Trasatti); α ≈ 0.5;
    a passivation flag for Al/Cr/Ti.
  - Corrosion current is solved from i_a(E) = |i_c(E)|, rate = i_corr·A/(zF).
  - Limited by H⁺ mass transfer k_L·[H⁺], which gives the stirring dependence.
  - The same machinery covers Zn + Cu²⁺ cementation (mass-transfer-limited) and galvanic couples. This replaces
    `mg_acid_dissolution`.
- **Gas–liquid transfer for every volatile solute:** N = k_L·a·(c − H·p_i).
  - p_i is the **partial pressure** in the headspace or air (pCO2 = 4e-4 atm in open air).
  - k_L from penetration theory with D. Interfacial area a from the free surface plus bubbles when Σp_i^sat > P_total
    (bubble nucleation: "fizzing" versus quiet degassing).
  - H(T) from Sander's open compilation (CC-BY, ~17k species) or from ΔfG°(g) − ΔfG°(aq).
  - Replaces `step_co2_degassing`.
- **Settling:** Stokes with η(T) and ρ_liquid from the volume model, the actual liquid height from the vessel profile,
  Richardson–Zaki hindered settling, and particle size from the nucleation model.
- **Flame:** pool-fire burning rate from Spalding's B-number, m'' = (h/c_p)·ln(1 + B), with
  B = (ΔHc·Y_O2/ν + c_p(T∞ − T_s))/ΔHvap. Flash point from P_sat(T) = LFL·P. Covers any fuel and replaces the
  ethanol constants (F11).

### 4.5 Integrator for stiff systems in WASM at 20 Hz

- Promote `kinetics.rs` to `kinetics_core.rs`, operating on Vessel species:
  - a sparse stoichiometry matrix ν (species × reactions);
  - orders;
  - per-reaction `RateProvider` (k_f(T, solvent), K(T));
  - an analytic Jacobian. The current ROS2 Jacobian code is a starting point; add the reverse terms and the T-dependence
    of k inside the tick.
- **Method:** Rosenbrock **ROS3P or RODAS3** (L-stable, order 3, embedded error estimate). Adaptive internal substeps
  inside each tick dt (rtol 1e-3, atol 1e-12 mol), dense LU (n ≤ ~60 species per vessel is ≈ 1e5 flops per stage).
  Positivity: reject and halve any substep that makes a species < −atol, then clip.
- **Coupling:** Strang splitting inside each substep: ½ kinetics → equilibrium constraint solve (`vessel_eq`) → ½ kinetics.
  For full consistency, integrate in reaction-extent coordinates so balanced stoichiometry guarantees element
  conservation by construction.
- **Energy:** integrate T as an extra state with Cp(contents) and Σ r·ΔrH(T) from species ΔfH (not from per-reaction ΔH),
  so thermal runaways are captured inside the tick.
- **Budget:** < 2 ms per vessel per tick for 50 species / 200 reactions. The existing `benchmark.rs` (ROS2) shows this
  is achievable; add a node benchmark against the built WASM.

### 4.6 Implementation steps, ordered by return on effort

**K0. Correctness, small changes (days)**
1. `chem_db.rs`:
   - H2O2: reactants `{H2O2: 2}` with order 1 via a new `orders` field, or keep coefficient 1 and use products
     `{H2O: 1}`, `{O2(g): 0.5}`.
   - Iodine: `{I-: 2}`, order 1.
   - Add `orders: Option<HashMap<String, f64>>` to `GeneralKineticRxn` (serde default).
2. `register_kinetic_reaction` / `register_reaction`: element and charge balance check using `ions::species_elements`.
   Reject unparseable or unbalanced reactions, or store them with tier `Speculative` and a visible warning.
3. Disable `update_network()` in `settle_after_addition` (`vessel.rs:444`) behind a flag until SMILES-based templates
   exist. Remove the `len() < 10` bypass.
4. Conservation: book gas leaving open vessels per element, compare absolute error per element (mol) as well as
   relative, flag unparseable species, and compute `energy_rel_err` for real.
5. `step_kinetics`: use orders; add reverse rates with K(T) (initially from `k_eq_298` plus van 't Hoff with the
   reaction ΔH, later from species ΔfG°); make the catalyst a multiplicative term ∝ catalyst area (or concentration)
   × k_cat(T); scale heterogeneous rates by area, not by V_rxn.

**K1. Integrator (about a week):** `kinetics_core.rs` as in §4.5. Port the M4 iodine-clock gate (with one cited k1)
from the Python file to `engine/tests/kinetics_gates.rs` on the `Vessel` path. Delete `pipeline/kinetics_physics.py`
and the legacy `run_iodine_clock_sim` / `step_simulation_tick` exports (closes F46 for kinetics).

**K2. Transport properties (a few days):** `engine/src/transport.rs`:
- η(T) for water (IAPWS 2008) and other solvents (Andrade A/B or RMG A/B/C);
- D from Stokes–Einstein / Wilke–Chang;
- εr(T);
- `k_diffusion(a, b, T, solvent, I)` with the Debye factor.

Apply the diffusion cap to all bimolecular reactions.

**K3. Rate providers (2–3 weeks):** `engine/src/rate_providers/{tabulated, eigen, eigen_wilkins, marcus, mayr,
hydrolysis, rate_rules}.rs`:
- Data in `engine/data/kinetics/*.json`, each row carrying source, tier and T-range.
- Replace the `GeneralEquilibrium`-only classification with a timescale split.
- Register complexation and acid–base reactions with both K and k.
- Make dissolved catalysts (I⁻, Fe³⁺ for H2O2) explicit mechanism steps.

**K4. Heterogeneous kinetics (2–3 weeks):** `engine/src/hetero/{dissolution, nucleation, corrosion, gas_transfer,
settling}.rs`:
- Wire `stir_rpm` → power number → Sherwood.
- Remove the instantaneous dissolution from `inert_dissolution` and `solve_saturation` for solids that are not yet
  present (keep equilibrium only as the asymptote).
- Snapshot: `SolidVisual.particle_um` from the moment model, dissolving rate in g/s, which replaces the web ghost pile.

**K5. Generation (Stage 5 of the prior plan):**
- Atom-mapped templates on SMILES (RMG families or RDChiral-style SMARTS), deciding *which* reactions occur.
- Rates from K3.
- Products are real species with formulas and SMILES that go through `import_compound`.
- Never refresh by id. Recompute k(T) every tick from stored A/n/Ea or ΔH‡/ΔS‡.
- Report `cap_reached` in the snapshot.

**K6. Server, offline only:**
- A real TS workflow: both reactants, `xtb --path` or pysisyphus GSM/NEB → TS optimisation → full Hessian → IRC, with
  ALPB(solvent).
- Failures are reported as failures. No fake energies, no constant flags.
- Calibrate with computed-vs-experimental pairs.
- Expose `/api/barrier/precomputed` keyed by canonical reaction SMILES. The worker fetches it and the engine uses Eyring
  with tier `Speculative`.
- Optional ML predictor behind the same API.

### 4.7 Gates (numeric targets, all on the `Vessel` path, in the built WASM)

| Gate | Target |
|---|---|
| G1 balance | Every default, registered and generated kinetic reaction balanced in elements and charge to 1e-12. Probe P1/P2 scenarios: per-element absolute drift < 1e-9 mol over 600 s. O2 from 0.044 mol H2O2 = 0.022 mol ± 1 %. |
| G2 detailed balance | A ⇌ B, K = 1, k_f = 0.05 s⁻¹: x_A = 0.500 ± 0.001 after 200 s for dt ∈ {0.05, 0.5, 1.0}. K(T) agrees with the equilibrium solver to 1e-6. |
| G3 rate order | Elementary 2A → B: initial-rate ratio 4.00 ± 0.02 when [A] doubles. Empirical orders honoured independently of stoichiometry. |
| G4 dt invariance | First order, k = 2 s⁻¹: x(1 s) = 0.1353 ± 0.5 % for dt from 0.05 to 1.0. Iodine clock switch time varies < 2 % between dt = 0.05 and 1.0. |
| G5 iodine clock | With one cited k1(T) and the salt effect: switch time at 20 °C and 35 °C within ±20 % of a published measurement for the m5 recipe. I atoms conserved. |
| G6 Arrhenius at run time | Every reaction, including generated ones: k(348)/k(298) = exp(Ea/R·(1/298 − 1/348)) ± 1 %, evaluated after T changes inside one session. Catalysed H2O2 rate rises with T and is proportional to catalyst area (±10 % when area doubles). |
| G7 metals | Rate ∝ metal area (×2 ± 10 %), independent of solution volume at fixed [H⁺] (±5 %), higher when stirred if mass-transfer-limited. Ordering in 1 M HCl: Mg > Zn > Fe ≫ Cu (no H2). |
| G8 dissolution | 1 g NaCl (300 µm) in 50 mL water: 90 % dissolved in 10–60 s when stirred and ≥3× slower unstirred. Dissolution of a saturated salt stops at c_sat. |
| G9 precipitation | No solid at S ≤ 1. BaSO4 induction time versus S within ×3 of Nielsen's data over S = 10–1000. Mean particle size decreases with S. |
| G10 gas transfer | Carbonated water (0.034 M) in an open 250 mL beaker relaxes toward K_H·pCO2(air) with τ of hours unstirred and minutes stirred. CO2 + NaOH + phenolphthalein shows the 0.037 s⁻¹ hydration delay. |
| G11 diffusion | k(H⁺ + OH⁻) within ×3 of 1.4e11 M⁻¹s⁻¹ at 25 °C. k_D scales with T/η(T) (×2.3 from 298 to 348 K in water). |
| G12 performance | 50 species / 200 reactions, adaptive Rosenbrock: < 2 ms per vessel per tick in WASM (node), 20 Hz with 10 vessels. |
| G13 no fake chemistry | NaHCO3 + HCl, vinegar, CoCl2 + NaOH, KCl + AgNO3: zero kinetic rows other than real ones, no species ids outside the registry. |

---------------------------------------------------------------------------------------------------------------------

## 5. Probes and results

All probes live in `/private/tmp/claude-501/-Users-carlliu-reaction-chamber/f26e8c67-1a98-4c46-88a1-a51d179e5f1f/scratchpad/audit/probes/`
(`common.mjs` loads the built WASM like `tests/wasm_e2e.mjs`). Run them with `node <file>`.

| Probe | What | Key output |
|---|---|---|
| `p1_h2o2.mjs` | 50 mL 3 % H2O2 + MnO2 at 278/298/348 K and 0.05/0.5/2 g; no catalyst | H2O2 consumed 4.131e-2 mol at all three T (0.5 g). H2O gained/H2O2 consumed = **2.00**. O2 971–1209 mL (correct ~505 mL). 0.05 g vs 0.5 g: 4.010e-2 vs 4.131e-2. No catalyst: 0. `conservation.ok = true`, err 0.0149. |
| `p2_iodine.mjs`, `p2b_series.mjs` | Persulfate/KI/thiosulfate/starch recipe of `m5_demos.rs` | I atoms +18.3 % (20 °C), +34.2 % (35 °C), +33.2 % without thiosulfate. Thiosulfate exhausted at t ≈ 25 s for dt = 0.05/0.5/1.0. Legacy/gate k predicts ~75 s. |
| `p3_mg.mjs` | Mg ribbon + HCl | Initial H2 18.2 mL/s for 0.02, 0.1 and 0.5 g Mg. 34.2 mL/s for 2 g. 9.1 mL/s (25 mL) vs 72.8 mL/s (200 mL) at the same 1 M. Stirring: no change. 278 K 9.5, 338 K 53.6 mL/s. Zn, Fe, Al: "inert", 0 mL gas. |
| `p4_network.mjs`, `p4b_gen.mjs` | Network generator on the bench and direct calls | Bench: NaHCO3 + HCl → `keto_enol_tautomerism_CO2(aq)` (rate 1.4e-7 M/s), species `CO2(aq)_enol`. Vinegar → `CH3COOH_enol`. Generator: HCO3⁻ chain `HCO3-_enol_enol…` (10 rxns). CoCl4-2 + OH⁻ → `Co4-2_subst`/`Co4-2_alkene`. EtOAc + OH⁻ → 99 rxns, 200 species, cap reached, chain `EtOAc_alcohol_alcohol…`, k = 3.9 M⁻¹s⁻¹ (literature 0.11). C4H8O2 + OH⁻ → none. Mayr: only literal `nuc_*`/`el_*` ids. C2H5Br + OH⁻ → secondary-SN2 k 2.6e-6, E2 K = 0.53 but irreversible. |
| `p5_frozen.mjs` | Generated tautomerism rate after a T jump and a pH change | k_obs 2.068e-8 s⁻¹ at 298 K/pH 0.30, after a 347 K bath, and after neutralising to pH 2.50 (expected ×54 and ×6e-3). |
| `p6_rev_order.mjs rev/order/dt` | `register_reaction` probes | K = 1 reversible → 0.0000 left (expect 0.5). 2A → B is first order (2.0e-3 vs 1.0e-3 M/s). k = 2 s⁻¹ after 1 s: 0.1216/0.0625/0/0 for dt 0.05/0.25/0.5/1 (exact 0.1353). |
| `p7_hetero.mjs` | Dissolution and precipitation timing | 2 g NaHCO3 and 5 g KCl in 50 mL: 0.0000 g undissolved before any step. BaSO4: none at S = 0.93, 0.062 mg at S = 1.56, 2.09 mg at S = 93, all at t = 0. |
| `p8_bicarb.mjs` | 1 g NaHCO3 + 50 mL acid | Vinegar: kinetic path active, CO2(aq) left 5.7e-3 M. 1 M HCl: equilibrium path, CO2(aq) left 3.43e-2 M after 120 s (air equilibrium ~1.3e-5). The keto–enol row is active in both. |
| `cargo test --release` | Engine tests | 89 passed, 0 failed. None covers G1–G13. |
| Server cache read (python, read-only) | 88 `server/cache/barrier_*.json` | ΔG‡_raw 60.69 kcal/mol for CCBr + OH⁻ and for CCBr + CN⁻, 60.68 for CCCl + SH⁻, 63.1 for CC(Br)C + OH⁻, 96.6 for PhCH2Cl + OH⁻, 5.14 for exception fallbacks. All labelled `tblite_GFN2-xTB_ALPB`, with constant validation flags. |
