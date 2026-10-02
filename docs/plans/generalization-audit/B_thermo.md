# Audit B: thermodynamics, chemical equilibrium and the energy balance

Scope: where equilibrium constants and reaction heats come from, how the equilibrium is solved, how temperature is
computed, and the compound phase thermodynamics in `compound_thermo.rs` / `vessel_phase.rs`. Everything was checked
against the **current working tree** (uncommitted, 2026-10-01 evening); line numbers are current. Probes ran against the
built WASM in `web/src/wasm/engine/` (built 21:50, newer than every engine source file), scripts and raw output in
`scratchpad/audit/probes/` (`thermo_probes.mjs/.out`, `solver_probes.mjs/.out`, `list_species.mjs`).
`cargo test` (scratch target dir, nothing in the repo touched): 89 tests, all pass.

Severity: **B** blocks or gives silently wrong results, **D** degrades accuracy/generality, **C** cosmetic.

---

## 1. Inventory: what the live engine actually uses

### 1.1 Which modules the `Vessel` calls

| Module | Called by the bench `Vessel`? | Role |
|---|---|---|
| `vessel.rs` | yes | dose/mix temperature, kinetics (explicit Euler), thermal step, water + ethanol boiling, headspace P, pH |
| `vessel_eq.rs` | yes | per-equilibrium bisection sweeps (`relax_equilibrium`, 5 sweeps per `step`, up to 40 per dose) + mineral saturation + `solve_coupled_equilibria` (damped Newton) |
| `vessel_phase.rs` | yes | Cp of contents, inert-compound melt/freeze/boil plateaus, inert dissolution |
| `compound_thermo.rs` | yes (via registered `CompoundThermo`) | vapour-curve fit, Clapeyron melt, Watson, Trouton/Walden, ΔfH from combustion |
| `chem_db.rs` | yes | 15 equilibria, 5 minerals, 6 kinetic reactions, 27 reagents, `get_species_thermo` (**only `mw` and `charge` are read**) |
| `solubility.rs` + `data/solubility.json` | yes | 128 minerals, 17 equilibria, rule-based / 3 M-cap Ksp, PubChem Ksp |
| `gas.rs` | yes | water Antoine (`water_vapour_atm`, gas.rs:86-95), collectors |
| `phase_transfer.rs` | **one function**: `step_gas_evolution` (CO2 Henry) from vessel.rs:657 | |
| `network_generator.rs` / `templates.rs` | yes (`update_network`, vessel.rs:340-374, after every dose) | adds forward-only kinetic reactions with family ΔH |
| `equilibrium.rs` (Davies, `kw_at_temp`, titrations) | **no** (lib.rs wasm exports + tests only; no web caller) | |
| `energy.rs`, `physics.rs`, `kinetics.rs` (Rosenbrock), `conservation.rs` | **no** (legacy exports/tests/benchmark only) | |

The M3/M4 claims in CLAUDE.md (Davies activities, Kw(T), Rosenbrock, energy balance) describe code the bench never
runs. `web/src` calls none of `calculate_equilibrium`, `calculate_calorimetry_mixing`, `step_simulation_tick`,
`run_iodine_clock_sim` (grep). F46 is still fully open.

### 1.2 Where K comes from

| Source | Count | Data | T dependence |
|---|---|---|---|
| `chem_db.rs:274-455` `get_default_equilibria` | 15 (water, acetic, carbonic×2, NH3, Cu(NH3)4, Ag(NH3)2, FeSCN, CoCl4, I3-, starch-I3, 4 indicators) | `log_k_298` + constant `delta_h_kj` per reaction | van 't Hoff, no ΔCp |
| `data/solubility.json` `equilibria` | 17 acid/base | same | 7 of 17 have ΔH = 0 (HNO2, HClO, HS-, H2SO3, HSO3-, H2C2O4, HC2O4-) |
| `chem_db.rs:456-553` minerals | 5 (AgCl, Cu(OH)2, NaHCO3, MnO2, Mg) | log Ksp + ΔH | van 't Hoff |
| `data/solubility.json` `minerals` | 128 (104 "Ksp table", 24 "solubility limit") | log Ksp298 + ΔH, colour, ρ, particle size | **92 of 128 have ΔH = 0** (all hydroxides except Ca, all sulfides, all phosphates, chromates, oxalates, most carbonates) |
| `solubility.rs:165` rule Ksp | any "insoluble" pair | 10^−(4+2·zc·za) | ΔH = 0 (solubility.rs:138) |
| `solubility.rs:171-189` saturation cap | any soluble pair | 3 mol/L ideal | ΔH = 0 |
| `solubility.rs:344-381` PubChem | formed solids | Ksp from one g/L number, ideal dissociation | ΔH = 0 |
| `network_generator.rs:231-388` | per generated reaction | family ΔH/ΔS, Mayr adduct ΔH −55 / ΔS −70 (296-297) | k frozen at generation T; reverse ignored |

van 't Hoff appears **three times** as copy-pasted literals: `vessel_eq.rs:145` (minerals), `:196` (sweep), `:412`
(coupled), with `R_GAS = 8.314` (vessel_eq.rs:12) while `compound_thermo.rs:24` uses 8.314462618. A fourth, independent
copy for pKw lives in `vessel.rs:1238` (with the wrong sign, B1).

### 1.3 Species thermodynamic data

`chem_db.rs:126-131` `SpeciesThermo { mw, charge, delta_h_f, cp }`, a 60-arm `match` (`chem_db.rs:187-271`):
- No S°, no Cp(T), no phase/T-range, no ΔfG. Indicator/starch entries are invented (`HIn_phph` −500, `starch` −800,
  chem_db.rs:225-234). Fallback for every other species: ΔfH −100 kJ/mol, Cp 50 J/mol/K (chem_db.rs:262-269).
- **Call sites** (`grep get_species_thermo`): vessel.rs:672, 719, 777, 1011, 1066, 1081, 1207, 1222, 1226, 1263, 1274,
  1287; vessel_phase.rs:144, 172. Every one reads `.mw` or `.charge`. **`delta_h_f` and `cp` are never read.**
- `CompoundThermo` (imports) has `dhf_kj_mol`, `s_j_mol_k`, `cp_coefficients`: grep shows no consumer outside
  `compound_thermo.rs` (only `summary()` for the UI). `cp_j_mol_k` is consumed (sets `cp_j_g_k` for inert compounds).
- The web proxy fetches NIST ΔfH, S°, Shomate (`web/src/pubchem/api.ts:148-175`) but `main.ts:120-140` does not even
  forward `dhf_kj_mol`, and api.ts collapses solid/liquid/gas values into one scalar
  (`data.dhf_solid ?? dhf_liquid ?? dhf_gas`, api.ts:148; same for S°, api.ts:152), losing the phase the number belongs to.

### 1.4 Equilibrium solver (live: `vessel_eq.rs`)

- Formulation: concentrations `c = n / V_reaction` (molar, mol/L of aq+ethanol volume, `vessel.rs:1194`), **ideal**
  (`ln_c`, vessel_eq.rs:15-17), water activity 1 (H2O dropped from every reaction, vessel_eq.rs:220-229, 391-400).
  No activity coefficients anywhere in the live path; `SpeciesRow.activity = conc_m` (vessel.rs:1076).
- `step_equilibria` (vessel_eq.rs:115-139): `auto_minerals()`, then each equilibrium relaxed alone by 80-step
  bisection on its extent with any ion-sharing mineral re-saturated inside each trial (`EqSystem::eval`, 4 passes ×
  100-step bisection per mineral), then `saturate_minerals`, then `solve_coupled_equilibria` (vessel_eq.rs:370-648):
  damped projected Newton on all reaction extents, Hessian `NᵀD⁻¹N`, Jacobi scaling, Gaussian elimination with partial
  pivoting, step limited to keep amounts > 0 and solids ≤ present, backtracking on max-|residual| merit, commit only if
  the merit fell. This is structurally the right thing (convex Gibbs minimisation in extent space) and residuals are
  small (probe S1: log Kw residual 0.004, carbonate 0.001, NH3 0.0003 in a 10-equilibrium mixture).
- Gates/clamps: minerals and the coupled solve only if water > 0.05 g (vessel_eq.rs:119, 125); coupled solve skips
  any reaction with a species ≤ 1e-30 mol (vessel_eq.rs:394-404) so it never *creates* a product species; solid
  numerical floor 1e-15 mol (vessel_eq.rs:134); volume floor 1 mL (vessel_eq.rs:118).
- Heat: `q -= ξ·ΔH_298` per reaction extent (vessel_eq.rs:183, 342, 351, 615), ΔH constant (not ΔH(T)).
- Three different volume bases: solver = aq + ethanol (`reaction_volume_ml`), pH = aqueous only (vessel.rs:1233),
  snapshot `conc_m` = total liquid incl. neat layers (vessel.rs:1067). Solute partial molar volume = M/2 mL/mol
  (vessel.rs:1208). K values are on the molal scale, the solver uses molarity.

### 1.5 Energy balance (live: `vessel.rs` + `vessel_phase.rs`)

- T is a single explicit state; heat in J is divided by a heat capacity: `ΔT = Q/C` (vessel.rs:851).
- Contents heat capacity `vessel_phase.rs:139-155`: 4.184 J/(g K) for every species that is not H2O-special-cased,
  ethanol (2.44 literal, vessel_phase.rs:125), a registered inert compound, or a `(s)` (1.0 J/(g K) literal,
  vessel_phase.rs:133). Dissolved ions get water's Cp by mass. No Cp(T).
- Glass: `glass_mass·0.84` in `dose` mixing (vessel.rs:414) but `glass_mass·0.84·0.15` in `settle_after_addition`
  (434), `add_portion` (461) and `step_thermal` (831). `add_portion` uses 4.184 J/(g K) and density 1.0 for the incoming
  portion whatever it contains (vessel.rs:460-462).
- Inputs: heater and burner watts 100 % absorbed (vessel.rs:838-840); bath `k = 25 W/K` (843); loss to room
  `h = 0.5 W/K` linear, independent of vessel size, no radiation, no evaporative cooling (848); flame deposits 15 % of
  1367 kJ/mol ethanol (815-822).
- Reaction heat: kinetic `extent·ΔH_rxn` with per-reaction constant ΔH (vessel.rs:782-783), equilibrium as above.
  No heat for: inert-compound dissolution (vessel_phase.rs:16-17 says so), CO2 degassing (vessel.rs:649-675), gas
  venting, mixing (excess enthalpy), dilution of strong acids.
- Phase change: water boils at `T_b(P)` from Clausius–Clapeyron with 40 660 J/mol anchored at 373.15 K, open vessels
  only (vessel.rs:861-884); ethanol at 351.5 K / 38 560 J/mol (888-912); inert compounds at their fitted curve
  (vessel_phase.rs:337-363) and melt/freeze plateaus (293-335). Water never freezes.
- Ledger: `conservation.energy_rel_err` is the constant `1.5e-5` (vessel.rs:1143).

### 1.6 Hardcoded condition-dependent constants (current lines)

| Literal | Where | Should be |
|---|---|---|
| pKw 14, ΔH 55 840, 298.15 (sign inverted) | vessel.rs:1238 | a_H+ from the solver; Kw(T) from species μ° |
| `unwrap_or(&1e-7)` **mol** H+/OH- | vessel.rs:1234-1235 | absent ⇒ solve; never a mol default |
| pH clamp (−3, 18) | vessel.rs:1242, 1246 | none |
| pOH = 14 − pH | templates.rs:140; network_generator.rs:501, 506 | solver a_OH- |
| Kw log K −14.00, ΔH 55.84 | chem_db.rs:283-284 | species μ°(T) of H2O(l), H+, OH- |
| ΔHvap 40 660, Tb 373.15 | vessel.rs:861-862, 1095 (visual), energy.rs:4-5 (legacy) | Psat(T) and ΔHvap(T) from μ°(g) − μ°(l) |
| ethanol 351.5 K / 38 560 J/mol | vessel.rs:888-889 | same, any compound |
| ethanol Cp 2.44 J/(g K) | vessel_phase.rs:125 | Cp(T) per species |
| solid Cp 1.0 J/(g K) | vessel_phase.rs:133 | Cp(T) per species; Kopp's rule fallback |
| water Cp 4.184 for everything | vessel_phase.rs:27; vessel.rs:462 | Σ nᵢ Cpᵢ(T) incl. apparent molar Cp of ions |
| glass 0.84 vs 0.84·0.15 | vessel.rs:414 vs 434, 461, 831 | one glass node, Cp_glass(T) ≈ 0.75-0.85 J/(g K) |
| UA 0.5 W/K, bath 25 W/K | vessel.rs:848, 843 | geometry-based convection + radiation + evaporation |
| water Antoine 8.07131/1730.63/233.426, clamp 10 atm | vessel.rs:929-930; gas.rs:92-93 | Psat(T) (IAPWS or μ°) with range |
| P_air = 1·T/T_room | vessel.rs:943 | n_air fixed at sealing: P = n R T / V_head |
| CO2 k_H 0.034 M/atm, ΔH −20 kJ, total P | phase_transfer.rs:4, 33; vessel.rs:655 | k_H(T) for every gas from μ°(aq) − μ°(g), partial pressure |
| R = 8.314 | vessel_eq.rs:12; vessel.rs:680, 940 | one `R_GAS` |
| Tb/Tc = 0.65 | compound_thermo.rs:32, 300 | measured Tc or Joback Tc, labelled |
| Trouton 88, Walden 56.5 | compound_thermo.rs:28, 30 | estimate tier only (see §4.5) |
| ΔHvap reference T default 298.15 | compound_thermo.rs:357 | must come with the datum (PubChem values are usually at Tb) |
| ΔHvap fallback 88·400 J/mol | compound_thermo.rs:439 | none (no data ⇒ no boiling) |
| ρ_l = 0.9·ρ_s, ρ_s = 1.1·ρ_l, 1.5/1.35, 1.1/1.0 | compound_thermo.rs:310-324 | molar-volume model (Rackett/COSTALD, GCVOL) |
| Cp estimates 1.3 / 2.0 J/(g K) | compound_thermo.rs:337-339 | Kopp / Joback Cp(T) |
| unknown solubility 0.1 g/L | compound_thermo.rs:468 | SLE estimate, labelled |
| miscible if s ≥ 500 g/L | compound_thermo.rs:477 | activity model / LLE |
| CO2/H2O/SO2 ΔfH −393.51/−285.83/−296.84 | compound_thermo.rs:280 | read from the species store (fine as values) |
| species fallback ΔfH −100, Cp 50, M 50 | chem_db.rs:262-269 | no silent default |
| rule Ksp 10^−(4+2 zc za), cap 3 M, ΔH 0 | solubility.rs:165, 178-179, 138 | Speculative tier with estimated ΔH |
| Mayr adduct ΔH −55, ΔS −70 | network_generator.rs:296-297 | species-derived ΔrG |
| ignition ≥ 286 K, 0.789, 46.069, 1 367 000, 0.15 | vessel.rs:800-822 | flash point from Psat + LFL, ΔcH from ΔfH |

---

## 2. Status of prior findings (area-relevant)

| ID | Claimed | True status | Evidence |
|---|---|---|---|
| F2 (energy part) | fixed | **Superficial.** Element ledger is real now (vessel.rs:1114-1137) but ignores vented/escaped mass (error grows with gas loss: 0.16 % after 10 s of CO2 release in `list_species.mjs`; `ok` flips at 5 %). Energy error is the constant `1.5e-5` (vessel.rs:1143). | probe, code |
| F5 | fixed | **Partial / superficial.** Water: Clausius–Clapeyron with constant 40 660 J/mol anchored at 373.15 K, open vessels only. Ethanol: same with hardcoded 351.5 K / 38 560 J/mol. No Raoult, no boiling-point elevation, no bubble point of mixtures, pure components distil one after another. The F5 test only checks T ≥ 350 K. | P7: 50/50 water–ethanol first vapour at 351.50 K, all ethanol gone before water boils (real bubble point ≈ 353.5 K, rising continuously); 2 M NaCl boils at 373.15 K (real ≈ 375.2 K) |
| F6 | fixed | **Partial.** Sealed air pressure = 1 atm·T/T_room regardless of the T and P at sealing and of headspace volume; water Psat from Antoine (valid 1–100 °C) clamped at 10 atm; open vessel P is hard 1 atm (no P_ext). | P9: sealed water at 218 °C reports 11.7 atm (real Psat 21.6 atm + air); at 318 °C 12.0 atm (real ≈ 107 atm) |
| F7 | — | **Open.** CO2-only Henry (phase_transfer.rs:4, 33), total pressure not p_CO2 (vessel.rs:655), and degassing carries no enthalpy. | P6 |
| F8 | fixed | **Partial / superficial.** Only ethanol got a (constant) Cp; solids get 1.0 J/(g K); ions and all other solutes get 4.184; `get_species_thermo.cp` still unused; no Cp(T); glass-factor inconsistency (0.84 vs 0.126) still present. No F8 test in `generality_audit_fixes.rs`. | P4 water/ethanol ratio OK (1.57); P5 brine Cp 27 % too high; P11 glass |
| F9 | — | **Open.** K and heat still per-reaction `log_k_298` + constant ΔH; species ΔfH/Cp never read; S° does not exist in the species table; import `dhf/S°/cp_coefficients` unused. | §1.3 |
| F10 | — | **Open** (kinetics area): `is_reversible`, `k_eq_298` ignored in `step_kinetics` (vessel.rs:676-829). Relevant here because the reverse needs K(T). | code |
| F11 | — | **Open.** Ethanol-only flame, 1367 kJ/mol literal, 15 % heat fraction, needs no O2. | vessel.rs:797-825 |
| F12 | — | **Open.** Ideal solution in the live solver; Davies only in unused `equilibrium.rs:20-39` (with water-only A(T), clamped 273–400 K). | P3: AgCl solubility identical with 0.42 M KNO3 (I = 0.85) |
| F13 | fixed | **Partial, and a new regression (B1).** Clamp widened to (−3, 18); pH is still −log c (not activity), aqueous volume, 1e-7 mol default; and pKw(T) in `current_ph` has the wrong sign. | P10: 6 M HCl pH −0.78 (activity scale ≈ −1.3); 1 M NaOH at 60 °C pH 15.03 |
| F14 | — | **Open.** Minerals and the coupled solve only if water > 0.05 g; volume bases inconsistent (§1.4). | code |
| F18 | — | **Partial.** Inert compounds now melt/freeze with a latent-heat plateau; water still never freezes. | P8: water in 250 K bath reaches 250.9 K, liquid |
| F20 | — | **Open.** 32 reaction-level equilibria, 7 json ones with ΔH = 0; indicators remain pseudo-species with invented ΔfH. | §1.2 |
| F27 | — | **Open.** Rule Ksp, 3 M cap, ΔH 0 unchanged (solubility.rs:138, 165, 178). | code |
| F28 | fixed | **Open.** Water Antoine still the only Psat in `gas.rs:86-95` and `vessel.rs:925-931` (clamp 10 atm); a second, inconsistent water Psat (Clausius–Clapeyron) drives boiling. | code, P9 |
| F31 | — | **Open.** No sub-boiling evaporation of any liquid; dissolved inert compounds never evaporate. | vessel_phase.rs:16-17 |
| F44 | — | **Open.** pOH = 14 − pH in templates.rs:140, network_generator.rs:501, 506. | code |
| F46 | — | **Open.** See §1.1. Legacy `kw_at_temp` has the correct sign; the live `current_ph` does not, and no Vessel-path test covers pH(T). | code |
| Ledger #1–#4, #9–#19, #30 | — | All still present (lines in §1.6). #13 (PubChem 25 °C solubility → Ksp, ΔH 0) unchanged. | |

---

## 3. New findings

### B1 [B] pKw(T) sign error in `Vessel::current_ph` (vessel.rs:1238)
`pkw = 14 − (ΔH/(R ln10))·(1/T − 1/298.15)` increases pKw on heating; the correct van 't Hoff form is
`pKw = 14 + (ΔH/(R ln10))·(1/T − 1/T₀)`. The basic/neutral branch (`pkw − pOH`, vessel.rs:1243-1247) therefore reads
2·ΔpKw too high. The solver's own Kw (chem_db water equilibrium) has the right sign, so concentrations are right and
only the reported pH is wrong — but that pH also feeds `update_network` → templates (vessel.rs:349).
Probe P1/P10: pure water reads pH 8.54 at 60 °C (true 6.51), 9.95 at 100 °C (6.13), 5.66 at 0 °C (7.47);
1 M NaOH reads 15.03 at 60 °C (true ≈ 13.0 on the concentration scale). The pH meter, titration HUD and instrument
history all show this. Fix: drop the formula; pH = −log10(a_H+) from the solver state in the phase. Gate: pure water
pH(T) = pKw(T)/2 within 0.01 at 0–100 °C.

### B2 [B] Intrinsic thermodynamic data exist but are dead
`SpeciesThermo.delta_h_f/.cp` (60 entries) never read; no S° exists; `CompoundThermo.dhf_kj_mol/s_j_mol_k/
cp_coefficients` stored but unused; web-side NIST ΔfH is fetched but not forwarded (main.ts:120-140) and is
phase-collapsed (api.ts:148-155). So the invariant's "ΔfH°, S°, Cp parametrisation" path has *no consumer*. Every K and
every reaction heat is still a reaction-level number.

### B3 [B] Hess's law is violated between routes; several reaction heats contradict the species table
- `baking_soda_vinegar` (chem_db.rs:574-590, kinetic, ΔH +11.5 to CO2(g)) runs alongside the equilibrium route
  (HCO3- + H+ ⇌ CO2(aq) −9.16, acetic −0.41, then degassing with **no enthalpy**). Same overall change, 11.5 vs
  −9.6 kJ/mol: a 21 kJ/mol difference depending on which path the numerics take. Probe P6: 1 g NaHCO3 in 50 mL 5 %
  AcOH cools by 0.53 K; species ΔfH (NaHCO3(s) + AcOH → Na+ + Ac- + H2O + CO2(g), +29.9 kJ/mol) gives ≈ 1.5 K.
  CO2(aq) → CO2(g) alone is +20.3 kJ/mol (−393.5 vs −413.8), missing from `step_co2_degassing`.
- `iodine_clock_slow` stored −140 kJ; species table gives −341 kJ (S2O8²⁻ −1345, I⁻ −55.2, SO4²⁻ −909.3, I2 +22.6).
  `iodine_thiosulfate_fast` stored −95; table −60. `carbonic_acid_dissoc1` ΔH 9.16 vs table 7.6.
- Stoichiometry in the kinetic records does not balance: `h2o2_decomposition` consumes 1 H2O2 and makes 2 H2O + 1 O2
  (chem_db.rs:593-595: creates 2 H and 2 O per event); `iodine_clock_slow` consumes 1 I⁻ but makes 1 I2
  (chem_db.rs:610-611). Energy and element ledgers cannot close with these (kinetics auditor should own the fix; here
  it matters because ΔH per extent is meaningless if the extent is not balanced).
- Network-generator reactions inject family ΔH for fake chemistry (`keto_enol_tautomerism_CH3COOH`,
  `sn2_AgCl(s)_Cu(NH3)4+2` seen in probes; Mayr adducts −55 kJ, network_generator.rs:296).
Root cause: heats are per reaction, not Σν ΔfH(T). Only a species-level enthalpy (and an H-conserving energy balance,
§4.4) makes every route agree by construction.

### B4 [B] K(T): two-term van 't Hoff, no ΔCp, and ΔH = 0 for most data
- Probe P1 (pKw vs Bandura–Lvov 2006): error −0.05 at 0 °C, −0.05 at 60, **−0.23 at 100, −0.53 at 150, −0.92 at
  200 °C** (Kw 8× too large at 200 °C, relevant for sealed vessels which now superheat). Water ionisation has
  ΔrCp ≈ −224 J/(mol K); constant ΔH is the wrong model past ±40 K.
- 92/128 minerals with ΔH = 0 are temperature-independent. Example: Ag2CrO4 ΔsolH from the table's own ΔfH values is
  +61.8 kJ/mol ⇒ Ksp should rise ≈ 48× from 25 to 80 °C; engine: constant. CaF2/Mg(OH)2 IAP identical at 25 and 80 °C
  (P2). All rule-based, 3 M-cap and PubChem-derived minerals: ΔH = 0. CaCO3/CaSO4 retrograde solubility only because
  their rows happen to carry ΔH.
- AgCl (ΔH 65.7) is reasonable: log Ksp −7.95 at 80 °C (P2), within ~0.1 of the literature extrapolation; error grows
  to ~0.2 at 100 °C without ΔCp.

### B5 [B] Ideal-solution equilibrium everywhere
No γ in `ln_c` (vessel_eq.rs:15) or the coupled residual (vessel_eq.rs:449-453). Ionic strength is computed
(vessel.rs:1259) but only used for brine density (vessel.rs:532). Consequences:
- P3: [Ag+] in saturated AgCl is 1.34e-5 M with or without 0.42 M KNO3 (real ≈ 1.9e-5 M; γ± ≈ 0.70 at I 0.42).
- 2:2 salts (BaSO4, CaSO4) are ~2–3× under-soluble at I = 0.1 (γ± ≈ 0.38); the error is the largest for exactly
  the qualitative-analysis cases the bench showcases.
- 6 M HCl pH −0.78 (P10) vs ≈ −1.3 on the activity scale; 1 M NaOH pH 14.00 vs 13.8.
- Ksp values are thermodynamic (activity-based, CRC/PHREEQC), so applying them to concentrations is internally
  inconsistent, and PubChem solubility → "Ksp" (solubility.rs:344-361) produces concentration-based numbers that are
  then mixed with thermodynamic ones.

### B6 [B] Mixed-convention reaction data: sulfide Ksp vs HS⁻ pK2
`solubility.json` sulfide Ksp (MS ⇌ M²⁺ + S²⁻, "CRC", e.g. CuS −36.1, ZnS −21.6) were derived with the old
pK2(HS⁻) ≈ 13–14; the same file sets `HS_dissoc_2` log K = −19.0 (modern). Combined:
ZnS + H⁺ ⇌ Zn²⁺ + HS⁻ gives log K = −2.6 in the engine vs −11.4 in llnl.dat (sphalerite); CuS gives −17.1 vs −22.8
(covellite). ZnS/CuS are 10^5.7–10^8.8 too soluble in acid, so the classic H2S group separation is wrong. This is the
general hazard of reaction-level tables from different sources: they cannot be checked for consistency. Species
ΔfG° (or one internally consistent basis-species database such as llnl.dat) removes it.

### B7 [B] Heat-capacity model
- Ions/solutes at 4.184 J/(g K) by mass: P5 26 wt % NaCl brine heats 19 % slower than water at equal volume; real
  brine Cp ≈ 3.3 J/(g K), so the engine's C is 27 % too high (ions have negative apparent molar Cp: NaCl ≈ −90
  J/(mol K) at infinite dilution).
- Solids at 1.0 J/(g K): PbI2 real 0.167 (6× high), AgCl 0.354 (2.8×), BaSO4 0.436 (2.3×); Mg 1.02 (ok). Heavy-metal
  precipitates add too much thermal mass.
- No Cp(T): ethanol 2.44 at 25 °C vs ≈ 3.0 J/(g K) at 78 °C; water 4.18 → 4.22 at 100 °C (minor); molten salts and
  hot solids diverge more.
- Glass: P11 pouring 10 mL of 80 °C water into an empty 110 g beaker drops instantly to 35.8 °C because `dose` uses
  the full glass Cp (92 J/K), while every other path uses 13.9 J/K. Same vessel, two different heat capacities.

### B8 [D] Heat exchange with the surroundings
- One constant UA = 0.5 W/K (vessel.rs:848) for a 5 mL test tube and a 1 L beaker alike; no radiation, no
  evaporative cooling (the dominant loss of an open beaker of water above ~60 °C, ~5–20 W).
- P7: after boiling dry under 300 W, the empty beaker heads for 295 + 300/0.5 = 895 K (reached 894 K). Radiation from
  ~0.02 m² of glass at 894 K is ~640 W, so the real equilibrium is far lower; a hot plate is also temperature-limited
  (plate surface ≤ ~550 °C), not a constant-power source.
- Bath coupling 25 W/K fixed (vessel.rs:843); ice bath is a fixed 273.15 K reservoir (web lab.ts:320) that never melts.

### B9 [B] Boiling and vapour pressure are per-compound special cases
See F5/F6/F28 rows. Additional points: (1) two water Psat models in one vessel (Clausius–Clapeyron in
`step_thermal`, Antoine in `step_headspace` and `gas.rs`); (2) boiling is skipped entirely while sealed, but the latent
heat of the vapour that fills the headspace is never charged; (3) the energy above Tb is converted to vapour with the
whole-vessel `cp_total`, so mixed contents boil the first-listed compound only; (4) Psat of dissolved species (ethanol in
water, NH3, HCl) is never evaluated, so solutions do not lose volatile solutes.

### B10 [D] `compound_thermo.rs`: equations used outside their domain
- **Clausius–Clapeyron fit with constant ΔH** (`fit_vapor_curve`, :205-268): fine inside the data range.
  Extrapolated: water fitted through (25 °C, 3169 Pa) and (100 °C, 1 atm) gives 18.4 atm at 200 °C (real 15.5,
  +19 %) and 122 atm at 300 °C (real 85.9, +42 %); no critical point, so a "liquid" exists above Tc.
  The Antoine-C search (:239-252) helps only with ≥ 3 points.
- **Watson** (`dh_vap_at`, :437-448) needs Tc; Tc is guessed as Tb/0.65 (:300) and is *not* listed in `estimated`.
  Real Tb/Tc: water 0.577, methane 0.58, ethanol 0.69, benzene 0.67, glycerol 0.75. It is also inconsistent with the
  curve: the boiling point comes from a constant-ΔH line while the latent heat applied comes from Watson.
- **ΔHvap reference T** defaults to 298.15 K when the datum has no T (:357), but PubChem/NIST "heat of
  vaporisation" is very often at Tb: ethanol 38.6 kJ at Tb read as a 298 K value gives 35.1 kJ at Tb (−9 %).
- **Trouton 88 J/(mol K)** (:28, :266-268, :365-366): ±10 % for non-polar liquids, −19 % water (32.8 vs 40.7 kJ),
  −20 % ethanol, +45 % acetic acid (dimerises). **Walden 56.5** (:30, :346-350): naphthalene good, water +157 %
  (15.4 vs 6.0 kJ), salts and flexible molecules poor. **Richard's rule** for metals is fine.
- **Clapeyron melting line** (`melt_k`, :413-421): linearised, correct sign and order of magnitude for ≲ 1 kbar.
  Keep.
- **ΔfH from combustion** (`dhf_from_combustion`, :271-281): correct Hess transform for C/H/O/N/S, but S → SO2(g) is
  not the bomb-calorimetry convention (H2SO4·aq), halogens/P/metals excluded, and the result is unused (B2).
- **van 't Hoff solubility with dh_sol** (`solubility_limit_g_per_l`, :465-473): reasonable within ±30 K, but the same
  ΔHsol is *not* released as heat on dissolution (vessel_phase.rs:16-17, 230-275): the T dependence and the heat
  are thermodynamically inconsistent.
- **Cp fallbacks** 1.3 / 2.0 J/(g K) and density ratios 0.9 / 1.1 (:310-339) are undocumented guesses; only
  Dulong–Petit for elemental solids is a named model (fails for B, C, Be, Si).
- `derive_state_at_room` uses Tm ref at 1 atm and a fitted Tb only: fine.

### B11 [D] Solver cost and species-map pollution
Zero-amount entries accumulate in `species_mol` and are never pruned (`relax_equilibrium` writes every species of
the relaxed equilibrium with `entry().or_default()`, vessel_eq.rs:330; `saturate_minerals` likewise at :178). P-solver: a carbonate/ammonia/phosphate/Cu/Ag mixture carries 71 species rows, ~45 of them
exactly 0 (HIn_phph, starch, I3-, CoCl4-2, …), which then pass through every Newton build, ledger and snapshot loop.
Measured in node WASM: **23 ms per `vessel_step`** for that mixture (0.6 ms for pure water) and **33 ms per small
dose** (`settle_after_addition` runs up to 40 full `step_equilibria`). With `Lab.openFlow` dosing at ≤ 10 Hz and
the 20 Hz loop, one pouring vessel can eat most of the worker's budget. Most of the time goes to 5 sweeps × 32
equilibria × (80-step bisection × nested 4×100-step mineral bisection) that the coupled Newton then redoes anyway.

### B12 [D] Concentration scale and volume
Molarity on three different volumes (§1.4) while K are molal; solute volume M/2 mL/mol (vessel.rs:1208; NaCl gives
29 mL/mol vs 16.6 real). At 100 °C water's density is 0.958, so molal/molar differ by 4 % even for dilute solutions.

### B13 [D] Sealed-vessel gas model
`P_air = 1·T/T_room` (vessel.rs:943) assumes the stopper was inserted at room T and 1 atm and that the headspace
volume never changes; stoppering a hot flask and cooling it does not produce under-pressure. Vapour in the headspace
does not come from the liquid (no mass or latent heat), so P9's liquid volume stays exactly 50.00 mL at 318 °C.

### B14 [C] Reporting
`ReactionRow.log_q_over_k` is the value before the solve (vessel_eq.rs:282/353, 639); the instrument panel shows
the pre-equilibrium residual. `SpeciesRow.tier` is always `Tabulated` (vessel.rs:1077) even for rule-based solids.
Indicators/starch have invented ΔfH (chem_db.rs:225-234) shown as data.

### B15 [D] Heat of solution/mixing not modelled for liquids
Concentrated H2SO4 or NaOH solutions diluted in water release large heats (H2SO4: ≈ −74 kJ/mol to infinite
dilution); imports become 0.1 M solutions (F16) so the case cannot arise, but once neat liquids are dosed it will be
silently athermal. Water + ethanol excess enthalpy (≈ −0.8 kJ/mol) also absent.

---

## 4. Recommendations

### 4.1 One principle: species-level μ°(T, P) per phase, everything else derived

For every species *i* and phase *α* (gas, pure liquid, pure solid, aqueous solute, solute in solvent S) store the
intrinsic data that give `H°ᵢ(T)`, `S°ᵢ(T)`, `Cp°ᵢ(T)` and hence `μ°ᵢ(T,P) = H − T·S`. Then:
- K_r(T) = exp(−Σν μ°/RT) for any reaction, including ones nobody tabulated (Hess-consistent by construction, B3/B6).
- Reaction heat = −Δ(Σ n H) at constant P (no per-reaction ΔH anywhere, B3).
- Psat(T), Tm(P), Henry k_H(T), Ksp(T), Kw(T) all fall out of μ° differences (F5, F7, F18, F28, B4, B9).
- ΔHvap(T), ΔHfus, ΔHsol are H differences (Watson/Trouton/Walden become estimators only, B10).

Per-reaction log K records stay as a *labelled fallback tier* and are converted at load time into the missing
species' μ° where possible (e.g. a Ksp with known ion μ° defines μ°(solid)).

### 4.2 Data: few, large, internally consistent sources

| Need | Primary source (bulk) | Coverage | Notes |
|---|---|---|---|
| Gases + pure condensed phases (incl. H2O(l)/ice, salts, metals, oxides) | **NASA CEA `thermo.inp`** (McBride–Zehe–Gordon 2002, NASA-9) and/or **Burcat–Ruscic "Third Millennium" database** (NASA-7, ATcT-anchored) | ≈2 000 / ≈3 000 species, 200–6 000 K, condensed phases with explicit T ranges | public domain (NASA); Burcat freely distributed with citation (check terms) |
| Anchor ΔfH° | **ATcT** (Ruscic, ANL) | ≈2 300 species with uncertainties | supersedes JANAF for small molecules |
| Inorganic cross-check | **NIST-JANAF** (SRD 13) | ≈1 100 substances to 6 000 K | public |
| Aqueous ions/complexes + minerals, T to 300 °C+ | **SUPCRTBL / slop16** (HKF parameters for aqueous species, Holland–Powell minerals) | ≈1 500 aqueous species + several hundred minerals | free; HKF needs a water EOS (ρ, ε) |
| Same, ready-to-use reaction form | **PHREEQC `llnl.dat`** (LLNL thermo.com.V8.R6) | ≈1 200 aqueous species, ≈1 100 minerals, ≈80 gases; analytic log K(T) 0–300 °C; **per-species B-dot ion size åᵢ** | public domain; all reactions written on one basis set ⇒ consistent; convert to μ° by sequential solve |
| High ionic strength | **PHREEQC `pitzer.dat`** (Harvie–Møller–Weare+) | ≈30 major ions, to saturation, 0–~200 °C | public domain |
| Organics (gas μ°) | **RMG-database** (Benson group additivity + NASA libraries) | any C/H/O/N/S/halogen structure from SMILES | MIT-licensed; replaces ad-hoc Joback for ΔfH/S/Cp; Joback stays for Tc/Pc |
| Pure-component T-dependent properties (Psat with ranges, Cp_l(T), ΔHvap(T), Tc/Pc/ω, ε(T), ρ_l(T)) | **`chemicals`/`thermo` (Caleb Bell) data tables** aggregated from Poling/Perry/CRC/DIPPR-public/Yaws-public | ≈70 000 CAS numbers (coverage varies by property) | MIT code, mixed public data; one pipeline import instead of many scrapers |
| Gas solubility, any solute | **Sander (2023) Henry's-law compilation** | ≈10 000 values for ≈4 600 species incl. d ln k_H/d(1/T) | open access; gives μ°(aq) = μ°(g) + RT ln(k_H term) for organics/gases missing in SUPCRT |
| Mixture non-ideality (non-electrolytes) | **UNIFAC** (original + Dortmund published tables) | group-based, any structure | tables bundled in `thermo` (MIT) |
| Gaps | Wikidata (ΔfH, S°, Tc, Psat points) | patchy | labelled Imported |

Construction rules that make these sources general:
- Liquid μ° of an organic with only gas-phase data: `μ°(l,T) = μ°(g,T) + RT ln(Psat(T)/P°)` with Psat from a ranged
  Wagner/Antoine fit (measured) — two large sources combine into a full liquid description.
- Aqueous μ° of a neutral solute without HKF data: `μ°(aq) = μ°(g) + RT ln(P°/(k_H·m°))` from Sander.
- Solid μ° of an organic: from μ°(l) and (Tm, ΔHfus): `μ°(s) = μ°(l) − ΔHfus(1 − T/Tm)` (+ΔCp term if known).
- Ions in another solvent: aqueous μ° + Born transfer with that solvent's ε(T), labelled Estimated.

### 4.3 Activity models (breadth vs data)

| Model | Range | Data needed | Availability | Verdict |
|---|---|---|---|---|
| Davies | I ≲ 0.3–0.5, aqueous only | none (A from ε, ρ) | universal | minimum baseline; error ≥ 10 % above I 0.5 |
| Truncated/extended Debye–Hückel, **B-dot (Helgeson)** | I ≲ 1–3 m, 0–300 °C | åᵢ per ion, B-dot(T) | **in llnl.dat for every aqueous species** | **default**: broadest coverage for the data |
| SIT | I ≲ 3–4 m | ε(i,j) per cation–anion pair | NEA-TDB/ThermoChimie, ~hundreds of pairs | optional override; little gain over B-dot+Pitzer |
| Pitzer | to saturation (6 m NaCl, brines, conc. acids) | β0, β1, β2, Cφ, θ, ψ per pair/triple | pitzer.dat: ~30 ions only | use when every major ion is covered (I > 1); otherwise fall back |
| UNIFAC / modified UNIFAC | non-electrolyte mixtures (ethanol–water VLE, LLE of hexane/water) | group parameters (structure) | broad, from SMILES | **use for neutral liquid phases** |
| eNRTL, eUNIQUAC, LIFAC | mixed-solvent electrolytes | binary params, sparse | narrow | not worth it now |
| COSMO-RS/SAC | anything with a σ-profile | DFT-COSMO σ-profiles | VT-2005 (~1 400 molecules) or compute via server | future, server-side only |

Recommended stack: B-dot for aqueous electrolytes (A(T), B(T) derived from ε(T) and ρ(T) of the solvent — the same
code works for any solvent with ε), Pitzer override when `pitzer.dat` covers all ions with c > 0.1 m, UNIFAC for
neutral species and solvent activity (a_w enters every hydrolysis/hydration reaction), Born transfer for ions in
non-aqueous solvents. pH = −log10(m_H+ γ_H+) on the molal scale of the phase.

### 4.4 Energy balance: conserve enthalpy, solve for T

- State: total enthalpy `H_tot` of contents (+ one glass node, Cp_glass(T) ≈ 0.75–0.85 J/(g K) for borosilicate,
  with a contact conductance to the liquid; or lump with one consistent factor).
- Each tick: `H_tot += (Q_heater + Q_burner + Q_bath − Q_loss − Σ ṅ_out·H_out)·dt`; chemistry, phase change, mixing
  and dissolution conserve H; then solve `Σ nᵢ Hᵢ(T, phase) + H_excess(T, x) = H_tot` for T by Newton
  (dH/dT = Cp). Latent heats, reaction heats, heats of solution, desorption and mixing temperatures all follow; a
  vented gas leaves with its own enthalpy.
- Heat loss: `Q = h(ΔT, geometry)·A·ΔT + ε σ A (T⁴ − T∞⁴) + Σ ṁ_evap ΔH_vap` with A from `inner_radius_cm`, liquid
  height and capacity; h from a natural-convection correlation (Churchill–Chu) or a fixed 8–12 W/(m² K) as a first step.
- Hot plate: plate node with its own heat capacity and thermostat/power limit, Q = UA_contact·(T_plate − T_vessel).
  Burner: flame T and efficiency; bath: medium compound(s) whose T follows its own enthalpy (ice melts).
- Cp(T): NASA/Shomate for pure phases; aqueous solutes from HKF (or apparent molar Cp from Pitzer derivative), solids
  without data by **Kopp's rule** (Σ atomic Cp, Estimated tier) instead of a flat 1.0 J/(g K).
- Ledger: report `|H_tot − (H_0 + ∫Q dt)|/max(|H|)` each tick (replaces the constant at vessel.rs:1143).

### 4.5 Fate of each `compound_thermo.rs` mechanism

| Mechanism | Keep? | Replacement |
|---|---|---|
| Clausius–Clapeyron / Antoine fit of measured points | keep as **Imported curve with validity range** | outside the range: μ°(g) − μ°(l); else Ambrose–Walton / Lee–Kesler corresponding states from (Tb, Tc, Pc, ω); cut at Tc |
| Watson ΔHvap(T) | estimator only | H_g(T) − H_l(T); else Clapeyron from the curve's own slope (with ΔZ) so curve and latent heat agree; Tc from data or Joback, listed in `estimated` |
| Trouton / Walden | Speculative fallback | Riedel/Vetere (Tc, Pc) for ΔHvap; Chickos–Acree group ΔSfus or Joback ΔHfus |
| Clapeyron melting line | keep | becomes a consequence once μ°(s), μ°(l) exist |
| ΔfH from combustion | keep as ingestion transform | extend: halogens → HX(aq), S → H2SO4(aq) convention; must be consumed |
| van 't Hoff solubility | estimator | SLE: μ°(s) = μ°(aq) + RT ln(a_sat); apply ΔHsol as heat too |
| Dulong–Petit / 1.3 / 2.0 J/(g K) | replace | Kopp's rule; Joback Cp(T) for organics (both labelled) |
| density guesses 0.9/1.1 | replace | GCVOL / Rackett from Tc, Pc, Z_RA (other auditor) |

### 4.6 Implementation steps

**T0 — immediate correctness (≈1 day).**
1. `vessel.rs:1232-1249`: compute pH as −log10 of the solver's H+ (activity once T3 lands) in the same volume basis
   as the solver; delete the pKw formula and the 1e-7 mol default; drop the clamp. Test
   `engine/tests/ph_temperature.rs`: pure water pH within 0.01 of pKw(T)/2 at 0, 25, 60, 100 °C; 0.1 M NaOH at 60 °C
   within 0.05 of pKw(60) − 1.
2. `step_co2_degassing` (vessel.rs:649-675): subtract ΔH(CO2 aq→g) × evolved (+20.3 kJ/mol now, later from μ°).
3. Delete the `baking_soda_vinegar` kinetic or derive its ΔH from the species table; fix the H2O2 and iodine-clock
   stoichiometries (shared with kinetics audit). Test: Hess gate below.
4. One glass factor (vessel.rs:414/434/461/831) and one `R_GAS` constant; `add_portion` uses the portion's Cp.
5. `relax_equilibrium` must not insert zero-amount species (only write names whose amount changed or is > 0).

**T1 — `engine/src/thermo/` species store (≈1 week).**
- `thermo/record.rs`: `ThermoRecord { id, formula, charge, phase: Gas|Liquid|Solid|Aqueous{solvent},
  model: Nasa7{t_ranges, coeffs}|Nasa9{..}|Shomate{..}|Hkf{g,h,s,a1..a4,c1,c2,omega}|Point{dfh,s,cp}, tier, source,
  t_valid:(f64,f64) }`; `fn h(&self,T)`, `s(T)`, `cp(T)`, `mu0(T,P)`.
- `thermo/water.rs`: IAPWS-IF97 regions 1/2/4 (ρ, Psat to the critical point) and an ε(T, ρ) correlation
  (Fernández 1997 or Johnson–Norton) — needed by HKF and Debye–Hückel A/B. This is a solvent *model*, not a per-species
  table.
- `thermo/hkf.rs`: revised HKF with the Shock 1992 g-function.
- `thermo/db.rs`: `ThermoDb` (HashMap id → Vec<ThermoRecord> by phase), `ln_k(reaction, T, P)` (species route →
  llnl analytic route → van 't Hoff + ΔCp route, returns tier), runtime `register_thermo` and `load_thermo_db(json)`
  wasm exports (F33/F34).
- `pipeline/build_thermo_db.py`: parse `thermo.inp`/Burcat, SUPCRTBL slop, `llnl.dat` (species, log K coefficients,
  åᵢ), `pitzer.dat`; resolve ids (Hill formula + charge + phase + InChIKey for organics); emit
  `engine/data/thermo_db.json` (~1–2 MB gz) loaded at startup, compiled fallback kept small (only what the default
  catalog needs).
- Replace `get_species_thermo` by `ThermoDb` lookups for mw/charge too; delete the silent −100/50 fallback.

**T2 — K(T) and heats from species (≈3 days).** Replace the three van 't Hoff copies (vessel_eq.rs:145, 196, 412)
with `ThermoDb::ln_k`; equilibrium heat = ΔH from the same records (or, after T4, implicit). Convert
`solubility.json`/`chem_db` equilibria into fallback records with their ΔH and (new) ΔCp field; mark the 92 ΔH = 0
minerals as `ΔH unknown` and let `llnl.dat` replace them.

**T3 — activity (≈1 week).** `engine/src/activity.rs`: `trait ActivityModel { fn ln_gamma(&self, comp:&[f64],
z:&[i32], T, P, solvent:&SolventProps) -> Vec<f64> }`; `Bdot`, `Pitzer`, `Unifac`, `Ideal`. In
`solve_coupled_equilibria` use residual `Σν(ln m + ln γ) − ln K` with γ frozen inside a Newton solve and updated in
an outer loop (2–4 outer iterations; γ depends smoothly on I). Molality basis: m = n / kg_solvent. Water activity
from the same model enters reactions that contain H2O.

**T4 — enthalpy balance (≈1 week).** `engine/src/energy_balance.rs`: `fn enthalpy(&Vessel, T) -> f64`,
`fn solve_t(&Vessel, h_target) -> f64`; vessel keeps `h_total_j`; chemistry and phase changes call nothing heat-
related; `step_thermal` becomes `h_total += Q·dt` then `solve_t`. Heat-loss model with geometry + radiation +
evaporation; hot-plate node. Remove `contents_heat_capacity`, the 40 660/38 560 clamps and the inert plateaus (they
become implicit once phase equilibrium is part of the Gibbs solve — coordinate with the phase-equilibrium audit).

**T5 — solver consolidation and performance (≈3 days).** Keep only the coupled Newton (warm-started from the last
solution, run when composition or T changed: dose, kinetic extent > tol, |ΔT| > 0.05 K); drop the 5 bisection
sweeps per tick and the 40-iteration settle loop; use a stoichiometric basis from the null space of the
element+charge matrix of *present* species so that new products can appear (fixes the "species ≤ 1e-30 ⇒ skip"
gap). Phase-stability check (saturation index > 0 ⇒ add solid/gas phase). Dense LU on ≤ 40 unknowns is
microseconds; HKF/NASA μ° cached per species keyed by (T rounded to 0.01 K, P).

### 4.7 Gates (numeric targets)

| Gate | Target |
|---|---|
| pKw(T) at Psat, 0/25/60/100/150/200 °C | within 0.05 of Bandura–Lvov 2006 (14.95/13.99/13.02/12.26/11.64/11.30) |
| pure-water pH(T) | = pKw/2 ± 0.01 |
| log Ksp(T) AgCl, CaCO3, CaSO4, BaSO4, Ag2CrO4 at 25/60/100 °C | within 0.1 of llnl.dat / SUPCRT |
| CaCO3, CaSO4 retrograde | log Ksp(80 °C) < log Ksp(25 °C) by ≥ 0.3 |
| γ± NaCl 0.1/1.0 m, CaCl2 0.1 m, 25 °C | 0.778 / 0.657 / 0.518 ± 0.02 |
| AgCl in 0.1 M KNO3 vs water | solubility ratio 1.25 ± 0.05 |
| 6 m HCl | pH −1.3 ± 0.2 (Pitzer) |
| Hess: NaHCO3(s) + AcOH → products by any dosing order/path | total heat equal within 0.5 %, = Σν ΔfH ± 1 % |
| Neutralisation 25 °C | 55.8 ± 0.5 kJ/mol |
| Adiabatic closed test (random reactions, no heater) | enthalpy ledger drift < 1e-6 relative per 1 000 steps |
| Heating 50 g ethanol vs 50 g water (no glass), 25 °C | ΔT ratio 1.71 ± 0.05 |
| 26 wt % NaCl brine Cp | 3.30 ± 0.10 J/(g K) |
| Water Psat 25/100/150/200/300 °C | ± 1 % of IAPWS |
| 2 m NaCl boiling point | 375.2 ± 0.3 K |
| Sealed 50 mL water, 200 °C | P = Psat(200 °C) + air ≈ 16.8 atm ± 5 % |
| Dry 250 mL beaker on 300 W plate | steady T < 750 K (radiation), plate model capped |
| Performance (WASM, node) | busy mixture `vessel_step` ≤ 2 ms; dose settle ≤ 3 ms; pure water ≤ 0.2 ms |

### 4.8 Performance notes for the 20 Hz loop

- Today's cost is dominated by redundant work (B11), not by model complexity: 23 ms/step and 33 ms/dose for ~25
  active species. A single warm-started Newton with ≤ 40 unknowns and 2–4 activity outer iterations costs ≪ 1 ms.
- μ°(T) evaluation: NASA-7 is ~20 flops; HKF ~200 flops plus the water EOS (IF97 region 1 ≈ 1 µs). Cache per tick.
- Pitzer is O(n_ions²); with ≤ 20 ions negligible. UNIFAC is O(groups²) per neutral phase; evaluate only when a
  neutral liquid phase has ≥ 2 components.
- Skip the solve entirely when nothing changed (most ticks of a resting vessel); event detection already compares
  states.
- Keep data loading out of the hot path: build `ThermoDb` once in the worker; vessels hold indices, not strings
  (the current per-call `HashMap<String,f64>` and `format!` churn in `vessel_eq.rs` is a large part of the 23 ms).

---

## 5. Probes and results

Scripts: `scratchpad/audit/probes/thermo_probes.mjs` (P1–P11, output `thermo_probes.out`),
`solver_probes.mjs` (S1–S2, `solver_probes.out`), `list_species.mjs`. All against the built WASM; vessel = 250 mL
beaker, 110 g glass.

| # | Scenario | Engine | Reference | Finding |
|---|---|---|---|---|
| P1 | pure water at T (sealed), pKw from [H+][OH-] | 14.90 / 14.00 / 12.97 / 12.03 / 11.11 / 10.38 at 0/25/60/100/150/200 °C | 14.95 / 13.99 / 13.02 / 12.26 / 11.64 / 11.30 | B4 (no ΔCp) |
| P1 | pure water pH reported | 5.66 / 7.00 / 8.54 / 9.95 / 11.33 / 12.43 | 7.47 / 7.00 / 6.51 / 6.13 / 5.82 / 5.65 | **B1 sign error** |
| P2 | AgCl IAP 25 → 80 °C | log −9.74 → −7.95 | ≈ −9.75 → ≈ −8.0 | ok (ΔH present) |
| P2 | Mg(OH)2, CaF2 IAP 25 → 80 °C | unchanged (−11.25, −10.46) | CaF2 rises (ΔH ≈ +12 kJ) | B4 (ΔH = 0 rows) |
| P3 | AgCl saturation, 0 vs 0.42 M KNO3 | [Ag+] 1.34e-5 both; `activity` = conc | ≈ 1.9e-5 with γ± 0.70 | B5 |
| P4 | 50 g water vs ethanol, 50 W 60 s | ΔT 12.6 vs 19.8 K (ratio 1.57) | ≈ 1.6 incl. glass | F8 ok for ethanol only |
| P5 | 100 mL water vs + 30 g NaCl, 50 W 60 s | ΔT 6.71 vs 5.43 K; dissolution −3.6 K | brine Cp ≈ 3.3 J/(g K) ⇒ ≈ 6.5 K | B7 |
| P6 | 0.05 mol HCl(aq) + NaOH(aq) | ΔT 6.39 K | 55.8 kJ/mol ⇒ 6.46 K with engine C | consistent |
| P6 | HCl(aq) + NaOH(s) | ΔT 11.6 K | 55.8 + 44.5 kJ/mol ⇒ ≈ 11.6 K | consistent (table ΔH) |
| P6 | 1 g NaHCO3 + 50 mL 5 % AcOH, 60 s | ΔT −0.53 K, 0.48 g CO2 lost, CO2(aq) 0.23 M right after dose | ΔfH route ⇒ ≈ −1.5 K | **B3** (no degassing enthalpy, route-dependent ΔH) |
| P7 | 100 mL 2 M NaCl, 400 W | boils at 373.15 K | 375.2 K | B9 |
| P7 | 50 mL water + 50 mL ethanol, 300 W | first vapour 351.50 K; EtOH gone at 400 s, then 373.15 K; dry vessel to 894 K at 800 s | bubble point ≈ 353.5 K rising; radiation-limited | B8, B9 |
| P8 | 50 mL water, 250 K bath, 1000 s | 250.9 K, liquid | ice, plateau at 273.15 K | F18 open (water) |
| P9 | sealed 50 mL water, 200 W | 136 °C 4.6 atm; 218 °C 11.7 atm; 318 °C 12.0 atm; volume 50.00 mL | 4.6 / ≈ 22.6 / ≈ 107 atm | F6, F28, B13 |
| P10 | 6 M HCl import | pH −0.78 | ≈ −1.3 (activity) | F13 partial, B5 |
| P10 | 1 M NaOH at 25 / 60 °C | 14.00 / 15.03 | 13.8 / ≈ 12.8 | **B1** |
| P11 | cooling 600 s, 10 mL vs 200 mL from 353 K pour | 10 mL: pour drops to 308.9 K at once; 200 mL: 322.6 → 314.5 K | glass Cp inconsistency; no evaporation | B7, B8 |
| S1 | 10-equilibrium mixture residuals | log Kw 0.004, carbonate ≤ 0.0012, NH3 0.0003 | 0 | solver converges |
| S1 | species rows / step cost | 71 rows (≈45 at 0 mol); 23.3 ms/step; 33 ms/dose; pure water 0.59 ms/step; snapshot 0.15 ms | — | B11 |
| S1 | network generator in an inorganic mixture | adds `sn2_AgCl(s)_Cu(NH3)4+2`, `keto_enol_tautomerism_CH3COOH` | none | F1/F23 still active, injects family ΔH (B3) |
| — | `cargo test` | 89 passed, 0 failed | — | no test covers pH(T), Hess, Cp of solutions, Kw(T) on the Vessel path |

Hand calculations used above (from the engine's own data where possible): Ag2CrO4 ΔsolH = 2(105.58) − 881.15 −
(−731.74) = +61.8 kJ/mol; iodine clock ΔrH = 2(−909.3) + 22.6 − (−1345 + 2(−55.2)) = −340.6 kJ; thiosulfate ΔrH =
2(−55.2) − 1224 − (22.6 + 2(−648.5)) = −60.0 kJ; sulfide consistency log K(ZnS + H⁺) = −21.6 + 19.0 = −2.6 vs llnl
−11.4; water Clausius–Clapeyron 2-point fit ΔH = 42.7 kJ/mol ⇒ 18.4 atm at 200 °C, 122 atm at 300 °C.
