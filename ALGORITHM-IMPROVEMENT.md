# Algorithm Improvement Plan

Audit of the algorithms that decide **which reactions happen, how far and how fast they go, which phases form, and what
the instruments read**, checked against the design invariants in `CLAUDE.md` ("intrinsic data in, models for the
environment"; products are compounds like reagents; no stamped condition-dependent values; label every estimate) and
against `docs/plans/generalization-master-plan.md`.

The goal is generality over per-reaction accuracy. This document has three parts:

1. **Fixed in this pass:** bugs and hardcoded results that were removed, with the tests that pin them.
2. **Open problems:** what is still wrong, too narrow or a placeholder, each with the fix or replacement algorithm.
3. **Staged plan:** the order to do part 2 in, with numeric gates.

Date of audit: 2026-10-03. Engine state: Stages 0–10 of the master plan merged.

---

## 0. How results are determined today (one tick of `Vessel::step`)

| Step | Code | What decides the outcome |
|---|---|---|
| Organic network | `network_generator.rs`, `Vessel::update_network` | SMILES-graph templates (ester hydrolysis, SN2/E2, alkene hydration/halogenation, keto-enol) produce reactions; a flux filter at generation conditions keeps the fast ones |
| Kinetics | `kinetics/core.rs`, `Vessel::step_kinetics` | ROS2 in extent coordinates; rate = k_f·Πc^order·(1 − Q/K); K from data or from the template |
| Combustion | `vessel_burn.rs`, `transfer/combustion.rs` | flash point, LFL/LOC, Spalding pool burning |
| Redox | `gem/discovery.rs`, `Vessel::step_redox` | pairs of oxidation/reduction couples from the species store, balanced by null-space; advanced toward ΔrG = 0 |
| Thermal decomposition | `gem/discovery.rs`, `Vessel::step_thermal_decomposition` | solid → solid + gas from the store; advanced toward ΔrG = 0 with gas partial pressures |
| Electrode reactions | `vessel_electro.rs`, `transfer/electrochem.rs` | Butler–Volmer + mass transport, mixed potential |
| Aqueous equilibria + solids | `vessel_eq.rs`, `vessel_transfer.rs` | exact per-row bisection, then coupled Newton with minerals at IAP = Ksp, limited by dissolution/nucleation rates |
| Gas exchange | `vessel_vle.rs`, `transfer/gas_transfer.rs` | Henry constants from μ°(aq) − μ°(g), film mass transfer |
| Energy | `Vessel::step_thermal` | sum of process heats, heater, bath, ambient loss |
| Phases | `vessel_phase.rs` (SLE/LLE flash), `vessel_vle.rs` (boiling, evaporation, sealed flash) | Schröder–van Laar, UNIFAC, Rachford–Rice, bubble point |
| Instruments | `vessel_uvvis.rs`, `analytical/*`, web `equipment/*` | engine snapshot values with instrument lag and quantisation |

---

## 1. Fixed in this pass

All of these were verified with `cargo test --release` (every suite, plus the new `engine/tests/algorithm_fixes.rs`),
the 18 node suites in `tests/*.mjs` against a rebuilt WASM, `tsc --noEmit` and `npm run build`. pytest: 79 pass; the
one failure (`test_generated_json_is_up_to_date`) predates this work (see the merge note in `CLAUDE.md`).

### 1.1 Hardcoded per-reaction results removed

| Removed | Why it was a hardcoded result | Replacement |
|---|---|---|
| `engine/src/equilibrium.rs` (wasm `calculate_equilibrium`, `calculate_titration`) | a separate NaCl/AgCl/"HA"/"H2A" calculator with an AgCl-only precipitation routine; the bench never used it | the vessel's general solver (`vessel_eq.rs`) |
| `kinetics/mod.rs::build_iodine_clock_network`, `simulate_iodine_clock` (wasm `run_iodine_clock_sim`) | a hand-built two-reaction network with its own rate constants, outside the species/reaction data | the iodine clock runs from the `GeneralKineticRxn` rows in a vessel (`stage7.rs` G5) |
| `templates::sn2_e2_product_ratio(substrate_type: "primary"/"secondary"/"tertiary")`, `ester_hydrolysis_k_obs("ethyl_acetate", pH)` (wasm `m6_sn2_e2_competition`, `m6_ester_hydrolysis_rate_vs_ph`) | rate constants selected by a string, the same ethyl-acetate numbers for every ester | structure-derived templates (1.3) |
| The legacy `KineticNetwork`/`rosenbrock_step` integrator | only the benchmark used it, so the Stage 7 performance gate timed an integrator the vessel never runs | `benchmark.rs` now times `KineticExtentSystem` |
| The Mayr branch of the network generator | it matched Mayr ids by substring (`"nuc_piperidine"` never occurs in a species id) and produced a `MayrAdduct_x_y` pseudo-species that fails the balance check, so it could never yield a reaction | removed; see 2.4 for Mayr as record data |
| Worker messages `CALCULATE_EQUILIBRIUM`, `CALCULATE_TITRATION`, `CALCULATE_MIXING`, `RUN_IODINE_CLOCK`, `RUN_BENCHMARK`, `M6_SN2_E2`, `M6_ESTER_HYDROLYSIS` | dead paths into the above; `RUN_BENCHMARK` would also have panicked in WASM (`std::time::Instant`) | removed from `web/src/workers/simulation.worker.ts` |

### 1.2 Thermodynamic data layer (`thermo/functions.rs`)

- **Invented formation data drove reactions.** `get_thermo_state` returned ΔfH = −100, ΔfG = −80 kJ/mol (gases −50,
  ions −150·|z|) for any species without data, and redox/decomposition discovery and kinetic detailed balance used those
  numbers to decide whether a reaction is spontaneous. New `try_thermo_state` / `try_ln_k_equilibrium` return `None`;
  discovery skips such reactions, and kinetics leaves them irreversible instead of using an invented K.
- **Stale cache.** The thermo cache never noticed new store records (imports, shards, resolved property requests), so a
  value looked up before its record arrived (often the placeholder) was served for the rest of the session. The cache
  is now keyed by `SpeciesStore::generation()`.
- **Cross-phase substitution.** A lookup fell through aq → l → s → g, so a solid could get aqueous data and a gas could
  get liquid data. Now a phase uses its own data; the only allowed substitute is pure liquid for a neutral solute, and
  it is demoted to tier Estimated. Missing ΔfG (ΔfS taken as 0) is also demoted to Estimated.

### 1.3 Organic network generator (`network_generator.rs`)

- **Every created product was stamped ΔfH = −100 kJ/mol, S = 150 J/(mol K)** (tier "Estimated") in
  `register_or_find_species`, and K was then computed from those numbers. Products now get a **Joback** group-contribution
  estimate (new `engine/src/joback.rs`, the same table as `pipeline/joback_estimator.py`): ideal-gas ΔfH°/ΔfG°/Cp; the
  liquid reference state from Trouton + Clausius–Clapeyron; the normal boiling point stored as a labelled `psat` curve
  point (so created products evaporate through the general VLE). Ions and molecules outside the method get **no** data.
- **K from species data, not per-family constants.** Each template had a fixed K (acid hydrolysis 0.25, the
  ethyl-acetate value, for every ester; hydration 100; SN2 1e12; ...). K at 298 K and ΔrH now come from the species'
  formation data when all of them have it; the template's estimate is the labelled fallback (`k_eq_from_data`).
- **Water counted as 55 M in rate laws.** `update_network` set every reactant to first order, so hydrolysis and
  hydration rates were multiplied by [H₂O] ≈ 55 M. The solvent is now zero order.
- **Catalysis was frozen at generation time.** Acid/base catalysis was folded into the pre-exponential with a
  `clamp(0.01, 100)` floor, so (a) a pH change after generation never changed the rate, and (b) acid catalysis ran at
  1 % strength even at pH 7. Catalysts are now **orders on [H⁺]/[OH⁻] in the rate law**, which the vessel evaluates every
  tick (the kinetics core now accepts orders on species a reaction does not consume). Keto-enol tautomerism is two
  parallel acid- and base-catalysed paths.
- **Only hydroxide could substitute.** A `contains("O-") / contains("tert")` string test chose the base, but the product
  was always R–OH, so any other nucleophile produced an unbalanced, silently rejected reaction. Nucleophile/base class now
  comes from the anionic atom's structure (hydroxide, alkoxide, phenoxide, carboxylate, thiolate, cyanide), the SN2 product
  is R–Nu (an ether from an alkoxide), E2 releases the base's conjugate acid, nucleophilicity scales by Swain–Scott *n*,
  and bulkiness is a tertiary alkoxide carbon.
- **Substrate class ignored.** SN2/E2 used one A/Ea for every halide. Methyl / primary / secondary / tertiary and
  β-branching factors now come from the α-carbon's graph; one E2 reaction per distinct alkene with β-H statistics and
  Zaitsev (small base) or Hofmann (bulky base) orientation. The E2 prefactor was recalibrated (8e11 → 2e10) so that the
  generator reproduces the Hughes–Ingold elimination fractions (primary ≈ 1 %, secondary ≈ 80 %); it had given 28 % for
  bromoethane, which made secondary halides ~99.9 % elimination.
- Vinyl/aryl halides no longer undergo SN2/E2; alkene hydration follows **Markovnikov**.
- Ionic compounds named by formula ("NaOH", "HCl") are expanded into their ions before pairing.
- **Network never revisited.** The network was regenerated only when the set of structured species changed, but
  candidates are filtered by rate at generation conditions, so an ester added to neutral water never got its acid
  hydrolysis path even after acid was added. The vessel now also regenerates when the pH unit or the 10 K temperature
  band changes.

### 1.4 Kinetics (`kinetics/core.rs`, `Vessel::step_kinetics`)

- **Reverse direction dropped.** `step_kinetics` skipped every extent ≤ 1e-15, so a reversible reaction running
  backward was integrated but never applied.
- **Detailed balance inconsistent with empirical orders.** The reverse rate used stoichiometric product orders while the
  forward rate used empirical orders and catalysts, so the stationary state was not Q = K (it depended on [H⁺] for an
  acid-catalysed reaction). The net rate is now r = F·(1 − Q/K), written as (k_f/K)·Πc^(order − ν_r + ν_p) so it stays
  finite when a reactant is absent. Solids and the solvent have unit activity in Q (they used to enter as mol/V).
- **Performance.** k_f and K are evaluated once per step instead of at every stage (each evaluation did store lookups
  for ion charges), the ROS2 matrix is LU-factorised once per step instead of twice, and the Jacobian is built from
  sparse stoichiometry: the 50-species/200-reaction benchmark went from 7.0 to 2.5 ms per tick. The old gate was green only
  because it timed the legacy integrator.

### 1.5 Redox and thermal decomposition (`vessel.rs`)

- **Sign of ΔrG° only.** Both steps proceeded whenever ΔrG° < 0, and toward completion, ignoring concentrations: no
  equilibrium, no Le Chatelier, and nothing at all when ΔrG° > 0 even with the products absent. They now use
  ΔrG = ΔrG° + RT ln Q with vessel activities (γ·c for solutes, a_w for the solvent, headspace or atmosphere partial
  pressures for gases) and relax toward the equilibrium extent, found by bisection (`Vessel::discovered_extent`).
  By construction, CaCO₃ ⇌ CaO + CO₂ in a sealed vessel now stops when the headspace CO₂ reaches the decomposition
  pressure, and an open vessel decomposes against the atmosphere's CO₂ partial pressure. Neither is gated numerically
  yet; that comes with Cp(T) in Stage A. The test that is in place: Fe²⁺ + I₂ (ΔrG° > 0) converts no more than a trace.
- **Water from nothing.** A dry vessel used 55.5 mol of H₂O as the available amount for water-consuming redox.
- **Atoms lost in decomposition.** Gas candidates whose id lacks `(g)` (e.g. `NH3`) were neither solid nor gas in the
  apply loop and vanished. Every non-solid decomposition product is now released as a gas; gases drawn from an open
  atmosphere are booked in the ledger.
- `DiscoveredReaction::delta_r_g` (unused, and it computed gas pressures from the liquid volume) was removed.

### 1.6 Solubility (`solubility.rs`, `thermo/k_sp.rs`)

- An ion pair missing from the Ksp table got the solubility-rules guess log Ksp = −(4 + 2 z₊z₋) **even when the store
  had formation data** for the solid and both ions. `mineral_from_formation_data` now computes Ksp (and its van 't Hoff
  ΔH) from ΔsolG° first. Example: ZnF₂ log Ksp −1.53 (measured −1.52); it used to precipitate on the rule guess of −8.
- `thermo::k_sp::mineral_log_ksp` dissolved an unknown solid **into its elements** with placeholder thermodynamics; it
  now uses the ionic decomposition and returns NaN without data.

### 1.7 Instruments and UI

- **Voltmeter** (`vessel_electro.rs`): the open-circuit cell reading was |E_cathode − E_anode|, so a cell wired backward
  read the same positive voltage. It is now signed.
- **Electrode reaction rows** matched elements by string prefix (`"C"` matched Cl⁻, Cu²⁺ and Co²⁺); now by element set.
- **Reaction clock** (`web/src/app/reaction_clock.ts`): reactions found by Gibbs discovery (kinds `redox`,
  `thermal_decomposition`) never started the timer.

### 1.8 Tests changed (they asserted removed behaviour)

- `lib.rs` unit tests of the removed calculators (titration curves, AgCl, Kw table, iodine-clock delays, SN2/E2 and
  ester k_obs string functions, legacy Jacobian): deleted along with the code.
- `stage0.rs` `s0_1_template_catalysis...`: now checks that generated acid hydrolysis is first order in H⁺ and zero order
  in water, with k_H of ethyl acetate within ×3.
- `mineral_lookup.rs`: the rule-based-guess path is exercised with Zn²⁺/IO₃⁻ (no table row, no formation data), because
  ZnF₂ now gets its Ksp from data; a second test checks that formation-data value.
- `literal_baseline.txt`: lowered (equilibrium.rs and kinetics/mod.rs gone, vessel.rs 9 → 7).

---

## 2. Open problems and their fixes

Severity: **A** wrong results in common bench situations, **B** wrong for whole classes of chemistry, **C** placeholder or
narrowness that limits generality, **D** performance or hygiene.

### 2.1 Thermodynamic data

| # | Sev | Status | Problem | Fix / algorithm |
|---|---|---|---|---|
| T1 | B | **Complete (§6.1)** | `get_thermo_state` still hands placeholders to non-deciding callers (energy balance, burn enthalpies, GEM solver), and `chem_db::get_species_thermo` has a separate hand table plus placeholder ΔfH | One lookup, `try_thermo_state`, everywhere; callers that need a number must handle `None` (skip the species' heat and say so). Delete `species_thermo_table` once `SpeciesStore` seeds carry its rows. |
| T2 | B | Open | Cp is constant from 298 K (`state_from_formation`), so ΔrG(T) is poor above ~400 K (decomposition onsets, flames) | Use the record's Cp polynomial (NASA-7 / Shomate `ranges`) and integrate H and S analytically; fall back to constant Cp with tier Estimated. |
| T3 | B | Open | No S°/ΔfG estimate when only ΔfH is known (ΔfS = 0 is used, now flagged Estimated) | Organics: Benson group additivity for S° (and ΔfH, better than Joback); ions: Latimer / Powell–Latimer S°(aq) from charge and radius; solids: Latimer's element contributions. |
| T4 | B | Open | Joback (now used for created products) gives ideal-gas values; the liquid comes from Trouton + Clausius–Clapeyron; there is no aqueous standard state | Add a hydration free energy estimate for neutral solutes (Abraham linear solvation energy relationship from SMILES descriptors, or a group-additive ΔhydG such as Cabani) so μ°(aq) = μ°(g) + ΔhydG. Replace Joback ΔfH by Benson where groups exist. |
| T5 | C | Open | Joback has no ions, so carboxylates and other created anions get no data and fall back to template K | ΔfG°(A⁻,aq) = ΔfG°(HA,aq) + 2.303 RT pKa with the pKa from `acid_estimate` (cycle closure); same for protonated amines. |
| T6 | C | **Partial (§6.2)** | `chem_db` default rows include questionable data: `cobalt_tetrachloro` log K −4 "effective" with an invented ΔH of 50 kJ/mol; indicator and starch pseudo-species; `MnO2_sol`/`Mg_metal` pseudo-minerals with log Ksp −50/−100 and no ions, used only to carry appearance | Move every row to a cited data file (`engine/data/*.json`) with provenance; replace pseudo-minerals by solid records (the store already has `MnO2(s)`, `Mg(s)`); derive indicators from imported structures with pKa from data or `acid_estimate`, colour from their UV bands. Stepwise CoClₙ complexes with measured β_n. |
| T7 | D | Open | Literal ion tables in logic files (`props.rs`, `volume.rs`, `activity.rs` Pitzer pairs, `ions.rs` hue hints) | Move to `engine/data` and records; keep driving the ratchet in `literal_ban.rs` down. |

### 2.2 Equilibrium and speciation

| # | Sev | Status | Problem | Fix / algorithm |
|---|---|---|---|---|
| E1 | A | Open | Concentration basis is mol per litre of *solvent* in the solver but molality in `current_ph` and the activity models | One basis: molality for all aqueous rows (K values are molal at the standard state anyway); convert to molarity only for display. |
| E2 | B | Open | Salts are fully dissociated at import; there is no ion pairing or complexation unless a table row exists (CuCl⁺, HgCl₂(aq), CdCl⁺, sulfate ion pairs) | Generic association: Bjerrum/Fuoss ion-pair constants from charges, radii (`data/ion_radii.json`) and ε(T) for every cation/anion pair, plus a complexation database (NIST SRD 46 / Smith–Martell rows as records). |
| E3 | B | Open | Ksp for pairs with neither a table row nor formation data uses the solubility rules (log Ksp −(4 + 2z₊z₋)) | Estimate ΔsolG° = ΔlatticeG − ΣΔhydG: Kapustinskii lattice energy from ion radii and charges, Born/Marcus hydration energies of the ions. Tier Speculative, but it orders solubilities correctly across a family; keep the rules only as a sanity check. Also store the result so a PubChem lookup can overwrite it (this already works). |
| E4 | C | Open | Acid strength: strong acids from a 9-row list; others from class ladders | pKa from structure (Hammett σ / Taft σ* increments over the SMILES graph, as Perrin–Dempsey–Serjeant); keep tabulated pKa when present. |
| E5 | C | Open | Equilibria act only in the water-containing phase; acid–base and complexation in organic layers are absent, and ions never partition | Per-phase equilibria (the master plan's D6): solve each liquid phase with its own activity model; ion transfer via Born transfer energy (already in `activity.rs` as `BornTransfer`). |
| E6 | C | Open | K(T) by van 't Hoff with constant ΔH for rows without analytic forms | Use ΔrCp from the species records (T2) or the record's analytic log K(T). Subsumed by T2. |

### 2.3 Reaction discovery (inorganic)

| # | Sev | Status | Problem | Fix / algorithm |
|---|---|---|---|---|
| R1 | A | **Complete (§6.3)** | Discovered reactions are applied one after another within a tick, each against the amounts left by the previous one; the result depends on discovery order, and competing reactions are not solved together | Treat all labile reactions (fast redox, decomposition) as one Gibbs minimisation over the candidate set (`gem/solver.rs` exists but is not on the vessel path), then relax the vessel toward that state with one rate per process (the Stage 8 "limited equilibrium" pattern). |
| R2 | B | Open | Redox discovery only pairs two couples, with H⁺/H₂O or OH⁻/H₂O as the only helpers; species with more than one carbon are excluded; O₂ of the open atmosphere is not a candidate (air oxidation of Fe²⁺, sulfite, ...) | Build the candidate set from the elements present (as Stage 6 intended) with gases of the headspace or atmosphere as reactants at their partial pressures, and let R1's minimisation pick products. Allow organic redox through couples in records (quinone/hydroquinone, alcohol/aldehyde) rather than by excluding carbon. |
| R3 | B | **Complete (§6.3)** | Homogeneous electron-transfer rate is a placeholder relaxation of 1 s⁻¹ for every couple | Marcus cross relation k₁₂ = (k₁₁k₂₂K₁₂f)^½ with self-exchange constants per couple from records (default by class: outer-sphere aqua ions ~1–10 M⁻¹s⁻¹, inner-sphere oxo anions slow), capped by diffusion. Couples that are kinetically inert (MnO₄⁻ without catalyst, H₂O₂ at neutral pH, N₂) get no fast path. |
| R4 | B | **Complete (§6.3)** | Thermal decomposition rate is a placeholder 0.1 s⁻¹ at any T past the onset | Heat- and mass-transfer limited: rate = (heat flow into the powder)/ΔrH, capped by an Arrhenius solid-state rate with Ea ≈ ΔrH (Kissinger-type default), and a shrinking-core geometry from the particle population. |
| R5 | C | **Complete (§1.5, §6.3)** | Discovery excludes gases as reactants of decomposition reverse paths (recarbonation of CaO, hydration of CuSO₄ by humid air) | Covered by R1/R2: gases present at their partial pressures are candidates; the ΔrG sign then decides the direction. |
| R6 | C | **Complete (§6.2, §6.3)** | Heterogeneous catalysis uses a fixed 50 m²/g specific area for any catalyst | A specific-surface-area (BET) property on solid records; fall back to the particle population's geometric area. |

### 2.4 Organic reactions (network generator)

| # | Sev | Status | Problem | Fix / algorithm |
|---|---|---|---|---|
| O1 | B | Open | Only five template families act (ester hydrolysis, SN2/E2, alkene hydration, halogen addition, keto–enol). The 45 `templates.rs` families are data the generator ignores (except keto–enol) | A SMIRKS-based template engine: each family = reaction SMARTS + rate rule + catalyst orders, loaded from data. First additions: SN1/E1 (carbocation stability from substitution, solvent ionising power Y), esterification (the reverse of hydrolysis now follows from K), amide hydrolysis, nucleophilic addition to carbonyls (hydrate, hemiacetal, cyanohydrin, imine), aldol, alcohol oxidation by Cr(VI)/Mn(VII) (links to R2), electrophilic aromatic substitution, acid–base proton transfer of organic acids and amines (from E4). |
| O2 | B | Open | Rate rules are one A/Ea per family with class multipliers | RMG-style rate-rule trees (most specific matching node wins) or Evans–Polanyi Ea = E₀ + αΔrH with ΔrH from T3/T4; precomputed barriers from the M7 xtb flywheel override them (the hook exists: `precomputed_barriers`). Mayr N/sN/E belong on nucleophile/electrophile *records*, matched by identity, giving log k = s_N(N + E) for polar additions. |
| O3 | C | Open | Solvent effects absent (SN2 rates for a protic solvent, no Hughes–Ingold solvent rules, no ionic-strength effect for neutral–ion steps) | Solvent-dependent rate multipliers from the phase's solvent class (protic/aprotic, ε) via Grunwald–Winstein for ionisation paths and a dielectric (Kirkwood) correction for ion–dipole steps. |
| O4 | C | Open | Generation is flux-filtered at one composition; the network only grows and is never pruned | RMG core/edge: keep a candidate edge list, re-evaluate fluxes during the simulation and promote edge reactions whose flux exceeds ε·(characteristic flux); prune core species whose concentration and flux stay negligible. |
| O5 | C | Open | Organic reactions happen only in `species_mol` (the primary liquid) | Run them per liquid phase with that phase's activities (needs E5). |
| O6 | D | **Complete (§6.2)** | Python `pipeline/templates_m6.py` (served at `/api/m6/network`) still applies `sn2_e2_product_ratio("secondary", …)` and `ester_hydrolysis_k_obs("ethyl_acetate", …)` to every substrate; `pipeline/equilibrium_solver.py` (AgCl-specific) is tested but never used by the bench | Delete both, or make the endpoint call the WASM/native generator; move the remaining M3/M6 pytest gates onto the engine (the master plan already lists this). |

### 2.5 Kinetics core

| # | Sev | Status | Problem | Fix / algorithm |
|---|---|---|---|---|
| K1 | C | **Complete (§6.2)** | Kinetic salt effect uses the first two reactants and A_DH = 0.51 at every temperature; the diffusion cap uses 0.25 nm radii and water's viscosity for every species and solvent | A_DH(T, ε) from `transport.rs`; radii from molar volumes (organics) or `data/ion_radii.json`; viscosity of the phase the reaction runs in. |
| K2 | C | Open | Sub-steps are fixed at ≤ 50 ms; error is not estimated | Use the embedded ROS2/ROS1 pair for an error estimate and adapt h (the comment already claims "adaptive"). |
| K3 | D | Open | Dense LU is O(R³): 500 generated reactions would cost ~40 ms per tick | Sparse LU on the reaction-coupling graph (reactions sharing species), or integrate in species space with a sparse Jacobian when R ≫ S. |
| K4 | C | **Complete (§1.4, §6.1)** | Gas products make a kinetic reaction irreversible (they are assumed to leave); in a sealed vessel they should enter Q at their partial pressure | Pass the headspace partial pressures into the integrator (the redox path already does this). |

### 2.6 Transfer, phase and energy

| # | Sev | Status | Problem | Fix / algorithm |
|---|---|---|---|---|
| P1 | A | **Complete (§6.3)** | Energy balance: ambient loss is a constant 0.5 W/K and bath coupling a constant 25 W/K for every vessel; the unused `energy_balance.rs` has a geometric model | Natural-convection h from Churchill–Chu over the wetted wall area plus radiation (εσT⁴), bath coupling from the immersed area; wire `energy_balance.rs` in. Gate: 100 mL water in a 250 mL beaker cools from 80 °C with τ ≈ 20–30 min. |
| P2 | B | Open | Process heats are summed per reaction (ΔrH × extent) instead of from an enthalpy state, so heats of mixing, dilution and the temperature dependence of ΔrH are missed | Track total enthalpy H(T, n) of the contents from species H(T) (T2) and solve T from it each tick (`energy_balance::solve_temperature`). Energy is then conserved by construction across all processes. |
| P3 | C | Open | VLE is a separate layer beside the equilibrium solver; UNIFAC covers few groups; Pitzer parameters fixed at 25 °C; no electrolyte–solvent LLE for ions | As listed in `docs/plans/generalization-progress.md` (Stage 4–5 gaps): modified UNIFAC (Dortmund) table, Pitzer T-derivatives, eNRTL for mixed solvents. |
| P4 | C | Open | Dissolution scales the particle population self-similarly; no aggregation/breakage balance | Method of classes on the existing 6 log-normal classes (smallest dissolve first), Smoluchowski aggregation kernel for flocs. |
| P5 | D | **Complete (§6.1)** | `"H2O(g)"` literal in `vessel_ext.rs` to hide steam from the gas-evolution log | Skip gases that are the vapour of a liquid currently boiling (from `boil_vapour_ml_s` / the volatile list). |

### 2.7 Instruments

| # | Sev | Status | Problem | Fix / algorithm |
|---|---|---|---|---|
| I1 | C | Open | The pH meter reads the water-containing phase wherever the probe sits; in mixed solvents it reports molal aqueous pH | Read the phase at the probe tip height (layers are ordered by density); for mixed solvents report the operational pH with a junction-potential estimate, or "---" outside the electrode's range. |
| I2 | C | **Complete (§6.1)** | Reaction-clock neutralisation detection matches the text `H2O <=> H+ + OH-` | Detect by structure: the equilibrium row whose reactant is the solvent and whose products are its autoprotolysis ions (any amphiprotic solvent), with a reaction-enthalpy threshold instead of a rate threshold. |
| I3 | C | Open | Thermometer reads the bulk temperature; no thermal lag of the glass, no gradient while heating unstirred | Two-node model (contents and wall) from P1, with an unstirred-layer temperature at the probe. |
| I4 | C | Open | Voltmeter/potentiostat electrodes limited to six materials on the console | Any conducting solid record (already supported in the engine) exposed in the console selector from the store. |
| I5 | C | Open | NMR/MS/UV-vis increments are recalled literature values never compared to a database (see `CLAUDE.md` "Structure-based NMR and mass spectrometry") | Validate against NMRShiftDB2 (open) and MassBank (open) in a pipeline gate; fit the 8 EI constants on MassBank; report error statistics per class. |

---

## 3. Staged plan

Each stage ends with its gates added to `engine/tests/` (Rust) or `tests/*.mjs` (WASM), as earlier stages did.

**Stage A: data completeness (T1, T2, T3, T5, T6, E1).** One thermo lookup with Cp(T); S° estimates; anion ΔfG° from
pKa cycles; cited data files for every `chem_db` row; molality basis.
*Gates:* log Ksp(T) of the Stage 2 minerals unchanged within 0.05; CaCO₃ decomposition pressure at 1100 K within ×2 of
1 atm with Cp(T); pH of 0.1 m HCl / NaOH and buffers unchanged within 0.02 after the basis switch; no `get_thermo_state`
placeholder reaches a reaction decision (assert in debug builds).

**Stage B: one Gibbs step for labile chemistry (R1, R2, R5, K4).** Candidate sets from elements present, including
gases at their partial pressures; minimise G over them; relax toward it with per-process rates.
*Gates:* the Stage 6 gates unchanged; Fe²⁺ in an open beaker oxidises in air at pH 7 (and not at pH 2 within 10 min);
anhydrous CuSO₄ in humid air hydrates; result independent of species ordering (shuffle test).

**Stage C: rates for discovered reactions (R3, R4, R6).** Marcus cross relation with self-exchange data; heat-limited
decomposition; BET areas.
*Gates:* Fe³⁺ + I⁻ reaches equilibrium in seconds, MnO₄⁻ + oxalate shows its autocatalytic lag only with Mn²⁺
present (if the Mn²⁺ path is data-driven), NaHCO₃ on a 300 W plate decomposes over minutes, not 10 s.

**Stage D: ion association and solubility estimates (E2, E3, E4, E5).** Bjerrum/Fuoss pairs, complexation records,
Kapustinskii–Born Ksp estimates, pKa from structure, per-phase equilibria.
*Gates:* CaSO₄ solubility in water within 20 % with ion pairing; ordering of Ksp within the alkaline-earth sulfates
and the silver halides correct from estimates alone; pKa of substituted acetic and benzoic acids within 0.5.

**Stage E: organic template engine (O1–O5, T4).** SMIRKS families from data, rate-rule trees + Evans–Polanyi, Mayr on
records, solvent effects, core/edge expansion, Benson + hydration energies.
*Gates:* SN1 solvolysis of tert-butyl chloride in water with t½ within ×3 of 20–30 s at 25 °C; Fischer esterification
reaches K ≈ 4 (mole-fraction basis) from either side; network stays ≤ 200 species on the ten-chemical stress mix;
every generated species has a SMILES, formula and labelled thermo or none.

**Stage F: energy and instruments (P1, P2, P5, I1–I4, K1–K3).** Enthalpy state, convection/radiation losses, probe
position, adaptive error control, sparse LU.
*Gates:* the cooling-curve gate in P1; enthalpy of every closed adiabatic test conserved to 0.1 %; busy-mixture WASM
step under 5 ms; 500-reaction benchmark under 10 ms natively.

**Stage G: hygiene (T7, O6, I5).** Literal ratchet to ≤ 50 in logic files; remove the Python reimplementations; spectral
validation gates against open databases.

---

## 4. Verification of this pass

- `cd engine && cargo test --release`: every suite passes, including the new `tests/algorithm_fixes.rs` (7 tests: reverse
  kinetics from products, catalyst orders, thermo cache + no invented data, Joback products and Hughes–Ingold fractions,
  ether formation and Markovnikov hydration, network regeneration on acidification, redox stopping at equilibrium) and
  `mineral_lookup.rs::pair_with_formation_data_gets_its_ksp_from_the_dissolution_gibbs_energy`.
- WASM rebuilt; all 18 node suites pass (`wasm_e2e` busy mixture 7.4 ms/step, budget 10).
- `npx tsc --noEmit` and `npm run build` clean.
- pytest: 79 pass, 1 known pre-existing failure.
- Not verified in a browser (per project rules the user tests the UI).

---

## 5. Requests from the visual layer (2026-10-03)

Found while making the renderer show every snapshot field properly (probes of the built WASM, `tests/vessel_effects.mjs`).
None of these was changed in the engine; each row says what the renderer does today instead, and what the engine should
provide so that stand-in can go. "Stand-in" items are visual defaults that exist only because the snapshot lacks the datum.

| # | Where | Observation | Renderer stand-in today | Engine fix |
|---|---|---|---|---|
| V1 | `SolidVisual.settled_volume_ml` | Always `mass / density x 1.6` (loose-packed bed), also for a frozen mass or a single piece: 50 g of ice in a beaker reports an 87 mL "bed". | `BED_PACKING = 1.6` in `render/solid_pieces.ts` divides it back out for floating solids and metals. | Report `density_g_ml` and a `morphology` (`bed` / `monolith` / `pieces` / `film`) per solid, plus the solid's own volume; a frozen liquid is a monolith filling the vessel (cast to the vessel's shape), not a powder. |
| V2 | `SolidVisual.floating` | `density < 1.0` is compared with 1.0, not with the liquid it sits in: ice in brine floats, naphthalene in hexane does not, but sinks/floats are decided against water. | Draws floaters at the surface and the rest as a bed, as told. | Compare with the density of the layer the solid is in (layers are already ordered by density), and say which layer (`layer_index`) a floating / suspended solid is in, so a solid can sit on an interface (e.g. between water and a dense organic layer). |
| V3 | `SolidVisual` for ice | One `particle_diameter_um` (1.3 mm) for a freezing population; cubes added by hand and a frozen mass are indistinguishable. | Dry and large -> a block; otherwise chunks (about one per 6 mL, max 40). | Piece count / size from the recipe that added the solid, or `morphology` (V1). |
| V4 | Layer turbidity | A fizzing Mg ribbon in HCl reports `suspended_fraction 0.13`, `d = 92 um` and layer `scatter_per_cm 0.11` (the solution looks cloudy). A ribbon or granule is not a suspension. | Metals are never drawn as a cloud. The shader still receives the turbidity. | Exclude `kind: metal` pieces from `ev.susp` and from the Mie scattering of the layer (unless the engine knows it is a powder: `particle_diameter_um < ~200`). |
| V5 | `gas_fluxes` | One row per reaction row for the same species (four `H2(g)` rows, three at 1e-9 mL/s noise); every gas and nucleation site gets the same ~0.84 mm bubble. | The renderer ignores rows below 1e-4 mL/s and sums the rest per species (Details drawer). | Aggregate per species and site in the snapshot; bubble diameter from surface tension, wetting and nucleation site (Fritz exists for boiling only; 0.84 mm is the generic value). |
| V6 | Electrolysis cost | `vessel_step` with electrodes costs 0.3 - 1.5 s per 0.5 s step (Pt/Pt in 0.1 M NaCl at 4 V: ~0.32 s; Cu/Cu in 0.1 M CuSO4: ~1.5 s) against the 10 ms budget; the worker stalls and the whole bench freezes while electrolysis runs. | None. | Profile `vessel_electro.rs` (the half-reaction discovery runs every step; cache by composition band) and give it a sub-10 ms budget gate. |
| V7 | Electrode products | No electrode mass change and no plated deposit: Cu plating leaves nothing in `solids`, and the dissolving Cu anode loses no mass. Also ~20 rows of H2S / H2 / O2 fluxes at 1e-14..1e-25 mL/s from impossible half reactions at the cathode of CuSO4. | Gas rows are drawn on the rod that has the gas among its reaction products. | Snapshot `electrodes: [{ material, mass_change_g, deposit: SolidVisual? }]`; drop fluxes below a physical floor. |
| V8 | `LiquidLayer.name` / `species` | `undefined` for aqueous layers, set for organic ones only. | The Details drawer labels them "aqueous" / "organic". | Always give the lead species and a display name. |
| V9 | Clear liquids | The engine's absorbance of pure water / solvents is 0 across the grid (`Amax 0`), so a layer of water has no colour data at all. | The shader adds a faint fixed cool absorption (0.045, 0.028, 0.02 per cm of chord plus 1 cm) that fades out where the layer has its own colour. This is a **visibility aid, not data**. | Baseline absorbance spectra per solvent class (Pope and Fry 1997 for water, Hale and Querry; organic solvents from the open spectral atlases) in `optics/solution.rs`, tier Tabulated; then the shader constant can go. |
| V10 | Visual-only fallback | `VisualContents` (`web/src/app/visual_contents.ts`) still mixes a visual-only liquid into the aqueous layer and never dissolves a visual-only solid; both are placeholders for `modelable: false` imports. | Shown as given. | Model every PubChem compound with a formula as at least an inert molecule (Stage 5 does for molecular compounds; extend to oxides, metals and polymers) so the fallback is never needed. |
| V11 | Reaction log | `colour_change` ("Solution turned blue", twice) and `temperature_change` (a new sentence per 3 K step) repeat; `solid_dissolved` repeats per small dose. | The panel replaces the previous entry of the same kind and species within 30 s of sim time; toasts only the most telling kind and never temperature steps. | Coalesce in `vessel_ext.rs` (one running "temperature rose / fell" event updated in place). |
| V12 | Vapour bubbles | While boiling the snapshot lists the vapour (`H2O(g)`, 420 mL/s) as a bulk bubble flux with `boil_intensity` 0.94 saturated for any strong heating. | The vapour of a liquid present is drawn only by the boil path (bubbles born on the floor, growing as they rise); `boil_intensity` is used as given. | Report boiling intensity as superheat / flux ratio (not saturating at 0.94) and mark vapour fluxes (`origin: "boil"`). |

Visual-only constants kept on purpose (all in the renderer, listed so they are not mistaken for chemistry):
`BED_PACKING`; the boil bubble rate (320 /s x intensity) and growth (2 - 3.4 /s up to ~5 mm); the bubble budget (800 /s, 700
instances, merged bubbles capped at 3.5 mm); the micro-bubble haze (0.3 /cm x (agitation - 0.15)); ice chunks (one per 6
mL, 92 % submerged); settling shown with the engine's velocity x 0.3 (`effects.ts`, the cloud clears within an attention
span); the clear-liquid tint (V9).


---

## 6. Second audit pass (2026-10-03): generality, determinism, conservation

Method: besides reading the code, a randomised invariant harness (`engine/tests/audit_invariants.rs`: random mixtures of the
catalog reagents with random heating, stirring and sealing; 40-400 seeds) checks finite numbers, non-negative amounts, element
and charge conservation, **mass balance** (held + headspace + lost = dosed), bounded temperature, draw-off / return, and that two
identical runs agree. It found most of the bugs below.

### 6.1 Bugs fixed

| Bug | Effect | Fix |
|---|---|---|
| `ions::species_elements` cached "unknown" forever, and treated a busy store (`try_read`) as "no such species" | a species unknown at first sight, or looked up while another thread registered a record, never parsed again (flaky `acidifying_regenerates_the_network`, wrong networks) | cache keyed by store generation; a lookup that could not read the store is not cached. Same for the reaction-basis memo |
| `phase_flash` counted one solid for two liquid keys of one molecule (`I2(aq)` and `I2(l)`) | iodine atoms created (1e-9 mol per step, drifting past the conservation tolerance) | one solid belongs to one component |
| Electrode half-reactions: flows from the root finders did not balance electrons | net charge created in the solution | oxidation and reduction fluxes are trimmed to the same number of electrons (zero current if one side is empty) |
| Hash-order dependence: species store, half-reaction discovery, electrode order, mineral registration, snapshot species / solid rows | results and the species table differed between runs | `BTreeMap` store, sorted iteration, sorted snapshot rows |
| Duplicate equilibrium rows per step | the same equilibrium listed 2-3 times | one row per equilibrium, rates summed |
| Gas leaving by venting, and gas drawn from the atmosphere, were booked in the element ledger but not in `mass_lost_g` | mass balance off by up to 0.5 % after a stopper pop | `vent_headspace` books the net gas, open absorption books a negative loss |
| Kinetic integrator accepted species down to -1e-12 mol and the vessel then clamped to 0 | atoms created (1e-9 mol per step) | the final extent is pulled back along its direction until nothing is negative |
| `is_ice` was `name.contains("ice")` (matched "silicate", "rice") plus a water-id test | wrong solid morphology | `solid_is_frozen_liquid`: the solid phase of the main liquid component, or of a molecule liquid at 298 K |
| `metal_is_passive` assumed pKw = 14 with a dead expression | passivation wrong off 25 C | `Vessel::pkw()` |
| `get_species_thermo` returned dfH = -100 kJ/mol, Cp = 50 J/(mol K) for unknown species and sat on the hot path | invented values in heat capacities; slow | it returns mass and charge only; `chem_db::species_cp_j_mol_k` returns `None` without data; `get_thermo_state` (placeholder estimator) panics instead of inventing; every engine caller uses `try_thermo_state` |
| `CoCl4-2` carried dfG = +10 kJ/mol against its own K (off by 567 kJ), `Fe(SCN)+2`, six indicator / starch species carried invented formation data tagged "NBS Tables" | contradictory thermodynamics | derived from the stability constants (tier Estimated) or removed; test `equilibrium_rows_agree_with_the_formation_data` |
| `KNOWN_NEUTRAL_INCHIKEYS` held a wrong InChIKey for H2S | PubChem H2S never recognised | imports are matched on the InChIKey of store records (identity records added to the seed) |
| Web: boiling bubble size used the unsaturated `boil_intensity` (x9 for a 600 W plate) | 3 cm bubbles | `boilVigour` saturates it for the picture |
| Web: `splitter.ts` recognised ions by substring (any Cu is Cu2+) | wrong fragment labels | formula from the atoms of the fragment |
| Web: reaction clock matched the text `H2O <=> H+ + OH-` | neutralisation detection by string | engine `ReactionRow.role = "autoprotolysis"` |
| `test_generated_json_is_up_to_date` failing since the merge | CSV tables and `solubility.json` out of sync | hand rows moved to `pipeline/data/extra_rows.json`, merged by the build script |
| Titration / effects node tests failing at HEAD | water baseline absorbance and unsaturated boil intensity | thresholds account for the baseline; renderer saturates |

### 6.2 Hard-coded results and constants removed or moved to data

- `chem_db.rs` no longer holds a single reaction: the hand rows (equilibria, minerals, kinetic rate laws) are `engine/data/core_reactions.json`
  with tier and source per row (`starch` binding, `CoCl4` and the thiosulfate row relabelled Estimated).
- Python: `pipeline/equilibrium_solver.py` (AgCl / NaCl / "HA" calculator, never used by the bench) and the substring-matching
  network generator with one constant per substrate class and the ethyl-acetate rates for every ester are deleted; the server's
  `/api/m6/network` returns 501 (the WASM engine generates networks from molecular graphs).
- `props.rs`: per-compound heat capacities, permittivities and viscosities of ethanol / acetone / hexane / toluene and a six-ion table
  are gone (dead code deleted; viscosity parameters are record data `transport.eta_l`; ion heat capacities come from the species
  records with the generic apparent-molar form `Cp0 + 14.5 |z|^1.5 sqrt(I) + 3.5 |z|^1.2 I`).
- Kinetics: heterogeneous catalysis used a fixed 50 m2/g and a 0.5 g reference; it now uses the catalyst's area per volume
  (record datum `specific_area`, else the particle population). Debye-Hueckel slope, encounter radii and the Coulomb term of the diffusion
  limit follow T, species size and ionic strength (screened).
- `is_labile_redox_element` (a Rust list) is `engine/data/redox_lability.json`; a species record with a self-exchange rate
  (`RedoxCouple.k_self`) makes any couple eligible.

### 6.3 New algorithms (closing items of section 2)

| Item | What |
|---|---|
| R1 | Discovered reactions advance together (`vessel_discovered.rs`): each relaxes toward its own equilibrium, one common scale keeps every species non-negative, and a damping loop stops any reaction being pushed past its equilibrium by the others. Order-independent |
| R3 | Rates of homogeneous electron transfer: Marcus cross relation with self-exchange constants (record data, else class estimates: outer-sphere 1, labile element with composition change 1e-3, inert element 1e-14 M^-1 s^-1) and the screened diffusion ceiling (`gem/rates.rs`). Reactions of a solid are limited by that and by film transfer |
| R4 | Thermal decomposition: first-order, `1e13 exp(-dH/RT)` with the reaction enthalpy as barrier; heat comes from the energy balance, so an endothermic decomposition cools its bed |
| R6 | see above (catalyst surface) |
| P1 | `heat_transfer.rs`: Churchill-Chu natural convection + radiation from the wetted, dry and base areas, bath coupling from the film / wall / bath series resistance; `VesselControls.bath_coupling_w_k` overrides it (a thermostatted jacket). The constants 0.5 W/K and 25 W/K are gone |
| Known kinetics win | a discovered reaction identical to a registered kinetic row (ignoring the solvent, its ions and phase tags) is left to the row |
| Solution gases | in solution, a gas with an aqueous / liquid twin is not a redox partner (its twin is; Henry exchange does the rest) |
| Determinism and speed | discovery structures cached per composition (thermo re-evaluated when T moves 0.5 K); busy mixtures 2-5x faster than before this pass |

### 6.4 Open items: status after the third pass (2026-10-03)

Gates for everything marked done are in `engine/tests/open_items.rs` (and the unit tests of the new modules).

| Item | Status | What was done / what is left |
|---|---|---|
| K2 error-controlled sub-steps | **done** | `kinetics/core.rs`: embedded first-order solution (Rosenbrock-Euler stage), error `0.5 h |k2 - k1|` per reaction against `KINETICS_ATOL_MOL + KINETICS_RTOL * (largest dissolved species of the reaction)`; steps grow x4 / shrink by `(0.9 err^-1/3)`; `integrate_extent_step_stats` reports accepted / rejected steps. A slow reaction takes one step, a stiff one is refined; chain A->B->C within 2e-5 of the analytic solution |
| K3 sparse LU | **done** | `kinetics/sparse.rs`: Markowitz pivoting with threshold partial pivoting; used for networks with >= 48 reactions and < 6 % density, dense LU otherwise (a dense coupling fills in; the 50 x 200 benchmark stays 2.4 ms). 500 reactions / 300 species: < 10 ms per 50 ms tick |
| E1 one concentration basis | **done for the kinetic core** | The equilibrium solver, `current_ph` and the ionic strength were already molal. The kinetic core's rate laws are in mol/L: `KineticExtentSystem::solvent_kg_per_l` converts the molal K(T) of every reversible row (`K_c = K_m rho^(sum nu)` over dissolved species). Left: `vessel_discovered.rs` still forms its quotients in mol/L |
| T2 Cp(T) | **done** | `thermo/estimate.rs` (`CpModel`): Einstein solid anchored on Cp(298) (Dulong-Petit limit), Einstein-gas (translation + rotation + 3n-5/6 Einstein modes anchored on the datum) or Joback polynomial shifted to the datum for gases, constant for liquids and solutes; Kopp's rule when no datum; the `50 J/(mol K)` placeholder is gone (a solute without datum carries Cp = 0, tier Estimated). Gate: CaCO3 -> CaO + CO2 at 1100 K from point data only is within a factor 1.4 of the Shomate-based pressure (0.59 atm) |
| T3 entropy estimates | **done (ions, solids)** | Parameters are data (`data/thermo_estimators.json`): standard element entropies for 50 elements, Latimer solid contributions, Powell-Latimer-form ion entropies refitted to the seeded NBS ions per class (monatomic cations rms 16.5, monatomic anions 14.1, polyatomic anions 38 J/(mol K)); the (z/2) S(H2) term of the H+ convention was missing before. Not done: Benson group additivity (no table that could be validated in-repo; organics keep Joback dfH/dfG) |
| T4 hydration free energy | open | unchanged |
| T5 anion / ammonium dfG from pKa | **done** | `conjugate_partner` finds the species one proton away by formula (only for records with a SMILES), pKa from the record's sites, else `pka_structure`; cycle-closure pKa of propanoate 4.76, methylammonium 10.65 |
| T6 indicators as derived structures | open | still named pseudo-species |
| E2 ion pairing, complexation | **done (generation), data partial** | `ion_pairing.rs`: Fuoss association with `a = r+ + r- + 0.5 A` reproduces measured sulfate / carbonate pair constants within 0.4 log units; generated only for `|z+ z-| >= 4`, `10 <= K_A <= 1e5` (stronger is a complex or a solid), when both ions are >= 20 umol, the pair would hold >= 5 % of the scarcer ion, and no tabulated row already forms that species. `data/complexes.json`: 33 recalled stability constants (Cl-, F-, NH3, CN-, S2O3 and first hydrolysis steps), tier Estimated. Registered by `Vessel::auto_associations` after the dose has settled. NIST SRD 46 itself is not redistributable, so the table is a recalled subset. Behaviour change: free-ion amounts drop where pairs form (60 % of 0.1 M CuSO4 is the pair); tests that read free Cu2+ / Fe2+ count the pair, and zinc cementation of copper sulfate takes about 2.5x longer |
| E3 Ksp estimates | **done, weaker than planned** | The Kapustinskii + Born cycle was implemented offline and fails: it misorders the silver halides and gives errors of 10-20 log units (ionic model, no covalency). What ships instead: a pair-additive model `log Ksp = nc theta(M) + na theta(X)` fitted by `pipeline/build_ksp_additive.py` to the 108 insoluble table rows (`data/ksp_additive.json`, leave-one-out rms 6.3 log units vs 13.7 for the charge rule), used for *how* insoluble a pair is once the solubility rules say it is, clamped to the rule +- 6, tier Speculative. Whether a pair is insoluble stays with the rules (98 % of the table vs 89 % for the model). It does not order the alkaline-earth sulfates |
| E4 pKa from structure | **done** | `pka_structure.rs` + `data/pka_structure.json`: Hammett / Taft style relations over the SMILES graph for carboxylic, benzoic, phenol, alcohol, thiol, ammonium / amine, anilinium, pyridine, imidazole sites; polyprotic ladders with a statistical and a distance-dependent electrostatic term. Mean abs error 0.10 on the 56 compounds the class constants were chosen with (calibration, not validation), 0.17 on 12 held-out compounds (pyruvic acid worst, -0.74). Used by `compound_model::acid_species` (imported acids with a SMILES) and by T5 |
| E5 per-phase equilibria | open | unchanged |
| R2 element-set candidates with atmospheric O2 | open | unchanged |
| O1-O5 organic templates beyond five families | open | unchanged |
| P2 enthalpy-state energy balance | open | unchanged (`energy_balance.rs` still unused by the vessel) |
| I1-I5 instruments | open | unchanged |
| literal ratchet; Python `joback_estimator.py` | partly | the element-entropy, Latimer, Kopp, ion-entropy, pKa, complexation and additive-Ksp tables are data files, not code; the Python Joback duplicate and the older ion tables (`props.rs`, `activity.rs`) are untouched |

Other changes of this pass: the reaction log no longer announces generated ion pairs as "complex formed"; the electrode half-reaction search ignores species without formation data; conj. partner search under the store lock uses pure formula parsing (a nested store read deadlocks against a waiting writer).

Verification: `cargo test --release` (all suites, including the 18 gates of `tests/open_items.rs`), WASM rebuilt, node suites re-run (busy-mixture step 8.4 ms, budget 10: the association rows are registered only after the dose settles; registering them at dose time cost 15-27 ms). Tests changed because of ion pairing: `algorithm_fixes::redox_stops_at_its_equilibrium`, `audit_fixes::competing_electron_transfers_share_a_limiting_oxidant` (lower bound 2.0e-4 -> 1.5e-4 mol), `m5_demos` demo 1, `stage8` gate 3b (run time 120 -> 300 s) now count the pair species. Not verified in a browser.

Known limits of the new pieces: a soft cation can still precipitate its hydroxide before a chloro complex takes it up (precipitation is applied before association within a dose; Hg2+ in chloride works only because the additive Ksp is clamped); the Fuoss pair fraction is somewhat high at 0.1 M (MgSO4 63 % paired vs about 40 % measured); ion pairs carry no reaction enthalpy.
