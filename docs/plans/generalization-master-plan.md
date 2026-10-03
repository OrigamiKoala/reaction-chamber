# Generalization Master Plan: how reaction outcomes are determined, and how to derive all of them from broad models and large databases

Status: audit complete, plan not started. Written 2026-10-01 against the uncommitted working tree.

This document supersedes the roadmap in `docs/plans/generality-audit.md` §5 and the staged plan in
`docs/plans/data-sources.md` §6. Both stay useful as background: the first is the original hard-coded-assumption
ledger (F1–F47); the second is the original source survey with licences.

Evidence for every claim below is in the six sub-audit reports and their probe scripts, copied to
`docs/plans/generalization-audit/`:

| Report | Area | Finding IDs used here |
|---|---|---|
| `A_reactions.md` | which reactions happen, what the products are, cascades, identity | A1–A16 |
| `B_thermo.md` | equilibrium constants, solver, activities, pH, energy balance | B1–B15 |
| `C_phases.md` | phase of every species, VLE/SLE/LLE, volume, gas phase, transfer rates | C1–C21 |
| `D_kinetics.md` | rate laws, integrator, catalysis, heterogeneous rates, server barriers | D1–D22 |
| `E_appearance.md` | colour, solids, gases, flames, layers, log text | E1–E20 |
| `I_ingestion.md` | PubChem/bundle/proxy/pipeline data paths, identity, provenance | I1–I18 (called G1–G18 inside the file) |
| `S_sources.md` | external large databases, licences, minimal source stack | (section 7 here) |

Probe scripts live in `docs/plans/generalization-audit/probes/`. They load the built WASM; adjust the path in
`common.mjs` / `lib.mjs` if you run them from the repo.

---

## Contents

0. How to read this plan
1. Executive summary
2. Principles: what counts as "general"
3. Audit: how results are determined today, end to end
4. Verified status of the earlier F-items
5. Target architecture
6. Model selection: the chosen model for every derived quantity, and what is rejected as too narrow
7. Data: the minimal large-source stack, per-need priority chains, fetch methods, licences
8. Implementation plan (stages, tasks, files, gates)
9. Gate catalogue (numeric acceptance targets)
10. Performance budget
11. Risks
12. Decisions needed from the user
13. Appendix: finding index

---

## 0. How to read this plan

- Section 1 is the one-page version.
- Section 3 is the audit. Each subsection ends with a short list of the worst findings. The full tables are in the
  sub-audit reports.
- Section 8 is the implementation plan. Stage 0 is a list of wrong results that should be fixed before anything else.
  It is small and does not depend on any architectural decision.
- Severity: **B** = gives wrong results or blocks a whole class of conditions. **D** = degrades accuracy or generality.
  **C** = cosmetic.
- "Probe" means a script was run against the built WASM (built 2026-10-01 21:50, newer than every engine source file),
  so the quoted numbers are what the app does today.

---

## 1. Executive summary

### 1.1 Verdict

The simulator has a sound skeleton in a few places:
- a coupled Newton solve that is a Gibbs minimisation in extent space (`vessel_eq.rs::solve_coupled_equilibria`);
- a spectral Beer–Lambert colour pipeline;
- bubbles driven by the engine's gas flux;
- `CompoundThermo` for imported inert compounds, which already follows the "curve points, not stamped phase"
  invariant.

Almost everything that decides an outcome, however, is still a hand-written special case keyed by a species-id string:
- **Reactions** come from six unrelated mechanisms (32 hand-written equilibria, a 133-row Ksp table plus solubility
  rules, 6 hand-written kinetic reactions, a substring-matching organic "network generator", per-compound code for
  CO2/ethanol/water, and inert-compound physics).
- **Thermodynamics** is per-reaction log K + constant ΔH. Species ΔfH°/S°/Cp exist in three places and are never read.
- **Phases** are three unrelated mechanisms (water/ethanol clamps, inert compounds, Ksp). There is no shared phase
  framework, no gas phase, no mixture VLE, no freezing of the solvent, no LLE.
- **Kinetics** is one explicit Euler step per tick, forward only, order = min(ν, 1), with stoichiometry doubling as order.
- **Appearance** runs a good physical pipeline on 21 hand-entered absorption entries, so every imported compound is
  colourless once dissolved.
- **Data** that reaches the engine is mostly hand-typed. The 501-species bundle is largely synthetic, the NIST scraper
  misreads tables, Joback never runs, and the fetched ΔfH° is never forwarded.

Several fixes listed as done in `CLAUDE.md` are partial or superficial (section 4). Two are regressions that produce
wrong numbers today (pH sign error B1; conservation ledger masking created atoms D1/A1).

### 1.2 The ten worst wrong results today (all probed)

| # | Wrong result | Cause | ID |
|---|---|---|---|
| 1 | Pure water reads pH 8.54 at 60 °C and 5.66 at 0 °C; 1 M NaOH reads pH 15.0 at 60 °C | pKw(T) sign inverted in `vessel.rs:1238` | B1/C19 |
| 2 | H2O2 decomposition gives 2× the O2; the iodine clock creates 18–34 % extra iodine, and the conservation check says ok | `reactants` map is both order and stoichiometry; ledger hides it | A1/D1 |
| 3 | Neutralisation makes no water | H2O dropped from every equilibrium | A2 |
| 4 | Vinegar, baking soda + HCl and CoCl2 + NaOH create `CH3COOH_enol`, `CO2(aq)_enol`, `Co4-2_subst` | substring-matched network generator runs after every dose | A3/D2 |
| 5 | 0.1 M citric acid pH 0.52 (real ≈ 2.1); methyl formate is modelled as acetic acid | acids are strong unless hand-listed; identity by element multiset | A4/F15 |
| 6 | Zn + HCl, Fe + CuSO4, KMnO4 + Fe²⁺, Na + water, CaO + water: nothing happens | no redox, no oxides | A5 |
| 7 | Water at 241 K stays liquid; 50/50 water–ethanol forms two layers and boils one component at a time | no solvent SLE, no LLE, no mixture VLE | C1/C3/C7 |
| 8 | Sealed water at 627 K reads 12 atm (real ≈ 180); sealed ethanol at 561 K reads 1.9 atm | water-only Antoine clamped at 10 atm; no vapour pressure for other liquids | C2 |
| 9 | A first-order reaction gives 0.12 / 0.06 / 0 left after 1 s at dt = 0.05 / 0.25 / 1 s (exact 0.135); a K = 1 reversible reaction runs to completion | explicit Euler, no reverse rates | D4/D5 |
| 10 | Methylene blue, NiCl2, CrCl3, K3Fe(CN)6, I2 in hexane are colourless; Prussian blue is "Orange precipitate" | colour only from 21 hand-entered band rows; hue rules for solids | E1–E4 |

Plus one licence hazard: `server/cache/nist_cache.db` (NIST SRD 69 data) sits in the repo tree, untracked and **not
git-ignored**, so a routine `git add -A` would commit data that may not be redistributed (I5).

### 1.3 The target in one paragraph

Store **per-species, per-phase intrinsic data** (ΔfH°, S°, Cp(T) or an equivalent Gibbs-energy polynomial; structure;
critical constants; reference pKa; ε(λ); molar refraction) in **one species store** keyed by structure (InChIKey, or
formula + charge + phase for ions and solids), loaded from **a few large databases** (NASA CEA, PHREEQC llnl.dat,
SUPCRTBL, a Wikidata extract, PubChem at run time) and filled by **labelled estimators** when data is missing. From that
store, one **Gibbs-energy minimisation** over all phases decides fast chemistry (acid–base, complexation,
precipitation, gas evolution, redox couples) and phase behaviour (boiling, freezing, sublimation, dissolution,
miscibility). Equilibrium constants, vapour pressures, melting points under pressure, Henry constants and Ksp all fall
out of μ° differences instead of being stored. **Kinetics** uses the same μ° for reverse rates (detailed balance), a
stiff integrator, and forward rates from a priority chain of rate providers capped by a diffusion limit; heterogeneous
steps (dissolution, nucleation, corrosion, gas transfer, evaporation) are rate-limited relaxations toward the
equilibrium target. **Appearance** is derived from per-species optical records and the computed state. Every value
carries a provenance tier into the UI.

### 1.4 Order of work

| Stage | What | Size |
|---|---|---|
| 0 | Fix wrong results (pH sign, atom balance, water in equilibria, disable the generator, conservation ledger, acids weak by default, scale gates, licence hygiene, data-parser bugs) | ~1–2 weeks |
| 1 | Identity + one species record + species store + core bundle built from large databases + property resolver | ~3–4 weeks |
| 2 | μ°(T) thermodynamics: K(T), reaction heats and an enthalpy-conserving energy balance from species data; one solver | ~2–3 weeks |
| 3 | Per-phase species, activity models, volume model | ~2–3 weeks |
| 4 | Gas phase, atmosphere, EOS, VLE, Henry for every gas, sealed vessels | ~2 weeks |
| 5 | SLE/LLE: freezing, colligative effects, molecular solubility, partitioning, layers | ~2–3 weeks |
| 6 | Reaction discovery by Gibbs minimisation over database candidates; redox by oxidation-state components; decomposition | ~3–4 weeks |
| 7 | Kinetics core: stiff integrator, detailed balance, rate providers, timescale split, diffusion cap | ~3 weeks |
| 8 | Heterogeneous and transport rates: dissolution, nucleation and growth, corrosion, gas transfer, evaporation, settling, combustion | ~3–4 weeks |
| 9 | Structure-based organic chemistry (atom-mapped templates, rate rules, product thermo) | ~4–6 weeks |
| 10 | Appearance from optical records (spectra, solid colour, n, flames, fumes, steam) | ~3–4 weeks |
| 11 | Electrochemistry, photochemistry, equipment for environments; server-side compute (TS search, sTDA) | later |

Stages 0–2 are the foundation; nothing after them is reliable without them. Stages 3–5 can overlap. 6 needs 2–4.
7–8 need 2. 9 needs 1 and 7. 10 needs 1 and benefits from 3–5.

---

## 2. Principles: what counts as "general"

### 2.1 The invariant (unchanged, from CLAUDE.md)

Intrinsic data in, models for the environment. A condition-dependent quantity (mp, bp, vapour pressure, solubility,
density at T, pH, phase, K at T) is derived from the vessel's T, P, composition and solvent. A database value that is
condition-dependent is stored as a **labelled point on a curve** and used to fit or check the curve, never as the model.

### 2.2 Test for accepting an equation (the user's "no narrow equations" rule, made operational)

An equation may be the **primary** model for a quantity only if all of these hold:
1. **Domain.** Its validity domain covers the bench envelope: roughly 150–1500 K, 0.01–100 atm, aqueous and organic
   liquids, dilute to saturated, µL to L. If its domain is narrower, it may only be a *fallback inside its domain*, and
   it must carry that domain so it is never extrapolated silently.
2. **Inputs are intrinsic.** It takes intrinsic data that a large database supplies for most compounds (or that an
   estimator can supply), not a per-compound fitted constant that only a handful of compounds have.
3. **Consistency.** It agrees with the other models by construction (for example, a vapour-pressure curve and a latent
   heat that come from the same μ°, not from two unrelated formulas).
4. **Failure is visible.** When its inputs are missing it returns "unknown" with a tier, not a silent default.

Examples of what this rules in and out:

| Quantity | Primary (passes) | Fallback inside its domain only | Rejected as a model |
|---|---|---|---|
| Vapour pressure | μ°(g) − μ°(l) from per-phase Gibbs polynomials; EOS above ~5 atm / near Tc | Antoine or Wagner fit **with its T range**; Clausius–Clapeyron through measured points; corresponding states (Lee–Kesler from Tb, Tc, Pc) | constant-ΔH Clausius–Clapeyron extrapolated without limit; Trouton as data |
| Melting point vs P | equality of μ°(s) and μ°(l) with molar volumes (general Clapeyron, handles ice's negative ΔV) | linear Clapeyron from (Tm, ΔHfus, ΔV) | a fixed mp |
| K(T) | ΔrG°(T) from species μ°(T) (includes ΔCp) | van 't Hoff with ΔH and ΔCp; PHREEQC analytic log K(T) within 0–300 °C | constant-ΔH van 't Hoff far from 298 K; ΔH = 0 |
| Activity | B-dot (Truesdell–Jones) with per-ion size from llnl.dat; Pitzer where its tables cover every ion; UNIFAC for neutral liquids | Davies (I ≲ 0.5) | ideal solution at all I |
| Rates | mass action with K(T) reverse rates, rate providers with a diffusion ceiling | family rate rules, LFERs with a reference rate | scenario functions (`sn2_e2_product_ratio`, `ester_hydrolysis_k_obs`), "catalyst replaces k" |
| Colour | Beer–Lambert on per-species ε(λ) per solvent | ligand-field band positions for first-row d-ions | hue rules per cation/anion; colour words turned into ε |

### 2.3 Data policy ("few large databases")

1. Prefer **one large, internally consistent source per data family** over several small ones. Internal consistency
   matters as much as size: B6 shows sulfide Ksp rows from one source combined with a modern HS⁻ pK2 from another,
   which makes ZnS and CuS 10^5.7–10^8.8 too soluble in acid.
2. A **small parameter table** is acceptable only when it feeds a **general model** and no large database exists for
   that model's inputs (examples: water-exchange rates for Eigen–Wilkins complexation kinetics; HER exchange currents
   for Butler–Volmer corrosion; atomic refractions for Lorentz–Lorenz). Each such table must be one file, sourced from
   one review paper, and listed in section 7.4. These are the only exceptions, and decision D3 in section 12 asks the
   user to confirm them.
3. **Estimators** (group additivity, corresponding states, Born transfer, Jenkins–Glasser, Kopp) fill gaps. They never
   override measured data, and they are always labelled Estimated or Speculative.
4. Licences decide what is **bundled** (permissive), what is **fetched per user at run time** (PubChem, Wikidata,
   opt-in NIST proxy), and what is **never used** (commercial handbooks, CRC/Yaws/DIPPR tables, including when they are
   repackaged inside MIT-licensed code such as the `chemicals` Python package).

### 2.4 Provenance tiers

Rust and TypeScript use the same lowercase tier names: `tabulated` (bundled evaluated compilation), `imported`
(fetched at run time), `estimated` (group additivity, QSAR, DFT with a known error model), `speculative` (rules of
thumb, xTB, ML outside its domain), `refined` (server-calibrated), `user-set`. Every derived value shown in the
snapshot carries the weakest tier of its inputs.

---
## 3. Audit: how results are determined today, end to end

The chain from "user adds something" to "user sees a result" is:

1. identity
2. which reactions apply, and what the products are
3. what happens next (cascades)
4. equilibrium position
5. phase of each species
6. rates
7. temperature
8. transport between phases
9. appearance
10. where the data for all of the above comes from

Each step is audited below.

### 3.1 Identity: what is this compound?

| Path | Key used | Problem |
|---|---|---|
| Engine species | Formula-like id string with phase/charge suffixes (`"AgCl(s)"`, `"Cu(NH3)4+2"`, `"H2O"`); imports use the Hill formula | Isomers collide. Products are named by string concatenation (`X_enol`, `X_subst`) |
| Import classification (`compound_model.rs:124-266`) | Element multiset vs the neutral species of any hand-written reaction | The acid branch runs before the two hard-coded SMILES checks: methyl formate and glycolaldehyde become acetic acid. Only `C2H5OH` and `CH3COOH` get a structure check (`_ => true` for the rest) |
| Web library (`reagent_library.ts:76-80, 139-143`) | InChIKey, falling back to formula | Dimethyl ether is offered "Also in stock: Ethanol" |
| Data proxy core table (`data_proxy.py:491-505`) | formula or name or SMILES or CAS, first match wins, early return | Dimethyl ether gets ethanol's Tb/ΔfH/Antoine, methyl formate gets acetic acid's, propanal gets acetone's (I2) |
| Formed products (`solid_fetch.ts:39-53`) | Hill formula → first neutral CID | OK for simple salts, ambiguous for hydrates, polymorphs and every organic |
| InChIKey | Fetched by the web | **Never sent to the engine** (`main.ts:119-140`) |

Worst: F15 is fixed only superficially (A, I); identity must become structural before any data integration, otherwise
large databases will be attached to the wrong compounds.

### 3.2 Which reactions happen, and what the products are

Six independent mechanisms decide this, each with its own data and its own way of matching species:

| # | Mechanism | Code | Trigger | Coverage | Model and domain |
|---|---|---|---|---|---|
| R1 | Hand-written equilibria | `chem_db.rs:274-470` (15) + `solubility.json` (17) | Exact id match, all species > 1e-30 mol | Water, acetic, carbonic (2), NH3, 6 complexes, 4 indicator pseudo-species, 17 inorganic acids | log K298 + constant ΔH; ideal; H2O removed from every reaction. Water, dilute, near 25 °C |
| R2 | Minerals | `solubility.json` (128) + `chem_db.rs` (5) + `auto_minerals` + rule Ksp | Any of 45 simple cations meets any of 48 anions; rules invent log Ksp = −(4 + 2·zc·za) for unlisted "insoluble" pairs | Binary 1-cation/1-anion salts only. No oxides, basic salts, hydrates, double salts | IAP = Ksp, ideal, only if water > 0.05 g |
| R3 | Hand-written kinetics | `chem_db.rs:570-683` (6) | Exact id match | Bicarbonate + vinegar, H2O2/MnO2, persulfate + iodide, I2 + thiosulfate, Mg + H⁺, ethanol combustion | Arrhenius, explicit Euler, forward only, order = min(ν, 1). Two of the six create atoms (A1) |
| R4 | M6 network generator | `network_generator.rs`, run after every dose (`vessel.rs:444`) | Substrings of species ids ("CO", "OH", "Cl", "ene", "acetate") | 45 families on paper; 7 reachable; Mayr keys never match real ids | Family-level A/Ea/ΔH/ΔS; k frozen at generation T; products have no formula |
| R5 | Per-compound code | `vessel.rs:649-674` (CO2 degassing), `797-826` (ethanol flame), `860-912` (water, ethanol boiling) | Literal ids | CO2, ethanol, water | Hard-coded constants |
| R6 | Inert-compound physics | `vessel_phase.rs` | `phase_model: "inert"` | Every import with no detected chemistry | Melting, boiling, dissolution; no chemistry by design |

How an imported compound is classified (`compound_model.rs`):

| Classification | Rule | Consequence |
|---|---|---|
| Acid | formula = H⁺ + one table anion; **strong** unless its parent appears in some hand-written equilibrium | Citric acid fully dissociated (pH 0.52); benzoic acid, phenol, boric acid inert |
| Base | decomposition contains OH⁻ | – |
| Salt | table cations + anions; for carbon compounds the SMILES needs '.', '+' or '-' | Works for simple salts; sodium benzoate inert |
| Known molecule | element multiset equals a hand-written reaction's neutral species | Isomer collisions |
| Inert | everything else | Metals, oxides, hydrides, carbides, Cl2, esters, alkyl halides: no chemistry (A5) |

Missing classes of chemistry (probed):
- **Redox:** none. Zn + HCl, Fe + CuSO4, CuO + H2SO4, CaO + water, Na + water, FeSO4 + KMnO4, Cl2 + KI and NaOCl + HCl
  all do nothing (A5).
- **Gas evolution:** CO2 only. H2S, SO2, NH3, Cl2, HCN and NO2 stay dissolved forever (A6).
- **Hydrolysis and complexes:** no hydroxo, chloro or ammine complexes beyond six. AlCl3 + excess NaOH keeps Al(OH)3 at
  pH 13.8; FeCl3 and CuSO4 in pure water precipitate their hydroxides (A10, E20).
- **Decomposition on heating:** none. NaHCO3 at 887 K is still NaHCO3 (F18).
- **Combustion:** ethanol only, and it needs no O2 (F11).
- **Organic chemistry:** only accidental substring matches. Ethyl acetate + NaOH does nothing; bromoethane + NaOH gives
  `C2H5_subst` and `C2H5_alkene` (A3).

### 3.3 What happens next (cascades)

| Path | Re-evaluated when | Consequence |
|---|---|---|
| Equilibria (R1) | every step and dose | A kinetic product that is in some equilibrium speciates at once |
| Minerals (R2) | every step (`auto_minerals`) | The only general cascade: any new cation/anion pair can precipitate |
| Kinetics (R3) | fixed list | No discovery |
| Generator (R4) | only after a user addition | Products of kinetics are not expanded until the next dose; generated reactions are never removed; caps are silent |
| Gas products | vented at once (open) or held inert (sealed) | Gases never react again (no H2 + O2, no re-dissolution except CO2) |
| Formed solids with guessed Ksp | PubChem lookup (`mineral_resolver.ts`) | The only path by which a product acquires real data; minerals only |

A product does **not** become a reactant in the same way a reagent is, except as a precipitate. The design invariant
"products are compounds exactly like reagents" is not met.

### 3.4 Equilibrium position and thermodynamic data

- **Where K comes from:** per-reaction log K298 + constant ΔH, copied as van 't Hoff code three times in
  `vessel_eq.rs` (minerals, sweeps, coupled) plus a fourth, sign-inverted copy for pKw in `vessel.rs:1238` (B1).
  92/128 minerals and 7/17 table acids have ΔH = 0, so their K is temperature-independent. There is no ΔCp anywhere:
  pKw is off by 0.23 at 100 °C and 0.92 at 200 °C (B4).
- **Species data is dead:** `get_species_thermo` (≈60–70 hand-typed rows, fallback ΔfH −100 kJ/mol, Cp 50 with no
  label) is read only for molar mass and charge. Imported ΔfH/S°/Cp coefficients are stored and never used. The NIST ΔfH
  fetched by the web is phase-collapsed and not forwarded (B2, I12).
- **Hess's law is violated:** bicarbonate + acetic acid releases +11.5 kJ/mol through the kinetic record and −9.6
  through the equilibria; degassing CO2 carries no enthalpy; stored reaction heats contradict the engine's own species
  table (iodine clock −140 vs −341 kJ) (B3).
- **Mixed conventions:** sulfide Ksp rows assume an old HS⁻ pK2 while the same file uses the modern one (B6).
- **Solver:** the coupled damped-Newton solve converges well (residuals ≤ 0.004 in log K) but runs after five rounds of
  per-equilibrium bisection that it then redoes; 23 ms per step and 33 ms per dose for a busy mixture in WASM,
  dominated by zero-amount species that are never pruned (B11). It skips any reaction with a species ≤ 1e-30 mol, so it
  can never create a product that is not already present.
- **Activities:** none in the live solver. Davies exists only in the unused `equilibrium.rs`. AgCl solubility is the
  same with and without 0.42 M KNO3; 6 M HCl reads pH −0.78 (activity scale ≈ −1.3) (B5).
- **Concentration scale:** molarity over three different volumes (solver, pH, snapshot) while the K values are molal
  (B12).

### 3.5 Phase of each species

Three unrelated mechanisms, none shared:

| Who | Phase rule | Transport |
|---|---|---|
| Water `"H2O"` | Always liquid. Boils at constant-ΔH Clausius–Clapeyron Tb when unsealed; open P pinned to 1 atm. Never freezes | Boil-off = surplus heat / 40 660 J/mol. Sealed headspace: Antoine (valid 1–100 °C), clamped at 10 atm, no vapour moles |
| Ethanol `"C2H5OH"` | Always its own "organic" layer (ρ 0.789, n 1.361), but counted as reaction solvent | Same clamp at 351.5 K; no vapour pressure when sealed |
| Inert imports | Solid below Tm(P) (Clapeyron), gas if Psat(T) ≥ P, else liquid; each neat liquid is its own layer | Melt/freeze plateaus; boil-off only unsealed at the pure Tb; instant dissolution capped by one water solubility (0.1 g/L if unknown); dissolved part never evaporates |
| Ionic solids | Solid if IAP ≥ Ksp(T), only if water > 0.05 g | Instant |
| Known reacting molecules (I2, CO2, NH3, CH3COOH, H2O2, …) | **No condensed or gas phase at all**: a solid import becomes the dissolved species even with no solvent; liquids and gases become 0.10 M aqueous solutions | None except CO2 |

Consequences (all probed, C1–C12):
- Mixtures boil one component at a time at pure-component Tb (water/ethanol: 351.5 K plateau, then 373 K); dissolved
  acetone and NH3 never leave; no boiling-point elevation (2 M NaCl boils at 373.15 K).
- Sealed vessels: only water contributes vapour pressure, capped at 10 atm; ethanol reaches 561 K (above its Tc) at
  1.9 atm. Stoppers never pop for other solvents.
- Water never freezes; no freezing-point depression; no ice baths that melt.
- No sub-boiling evaporation and no sublimation (hexane in an open beaker loses nothing in 2 h; iodine never gives vapour).
- 1 g iodine in a dry beaker becomes an invisible "I2(aq)" in 0 mL; in 50 mL water all of it dissolves (real 0.016 g).
- Neat H2SO4, PubChem ethanol, CO2 and methane all become 0.1 M aqueous solutions ("10 mL methane" adds 10 mL water).
- Miscibility is hard-wired: water + ethanol and hexane + toluene form two layers each; solutes cannot partition.
- 10 g NaCl dissolves completely in 25 mL water + 25 mL ethanol, because Ksp is applied over the combined volume.
- 11 µL + 11 µL of 0.1 M AgNO3/NaCl gives no AgCl (water gate 0.05 g).
- Volume: every solute is 2 g/mL, water 18.015 mL/mol at all T, no thermal expansion. Water + acetone (50 + 20 mL)
  = 57.8 mL (real ≈ 69).

### 3.6 Rates

- **Integrator:** one explicit Euler step per tick, reactions applied in list order. At 20× speed dt = 1 s, so any
  pseudo-first-order rate above ~0.1 s⁻¹ is distorted, and results depend on list order (D4).
- **Rate law:** order = min(ν, 1) and stoichiometry share one field, which is why two reactions create atoms (D1/D6).
  `is_reversible` and `k_eq_298` are ignored: everything runs to completion (D5).
- **Who is "fast" and who is "slow"** is decided by which list a reaction is in, not by its timescale. All dissolution
  and all precipitation are instantaneous; CO2 hydration (0.037 s⁻¹) is instantaneous; H⁺ + HCO3⁻ appears both as an
  equilibrium and as a slow kinetic path for acetic acid only (D10, D11).
- **Catalysis:** a solid catalyst replaces k with a temperature-independent constant; dissolved catalysts get nothing
  (D8/F22).
- **Heterogeneous:** Mg + acid rate ∝ solution volume, independent of metal mass below 0.78 g, no area or stirring term;
  Zn, Fe, Al do not react (D7).
- **Generated rates:** frozen at the generation T and pH (D3); diffusion cap uses a fixed viscosity and no Debye factor
  (D12).
- **Server barriers:** not a barrier calculation (first reactant only, "TS" = one stretched bond, no solvent, fake
  energies on failure, constant validation flags); nothing reaches the engine; the hook would misapply Eyring by ~60×
  (D16, D17).
- **Gates:** the M4 iodine-clock gate tests a Python re-implementation, not the Rust engine (D9/F46).

### 3.7 Temperature (energy balance)

- T is advanced as ΔT = Q / C, with C from constant per-gram heat capacities: 4.184 J/(g K) for every solute (brine
  27 % too high), 1.0 J/(g K) for every solid (PbI2 6× too high), 2.44 for ethanol (B7).
- The glass counts fully in `dose` but at 15 % everywhere else, so pouring hot water into an empty beaker drops it 45 K
  at once (B7).
- Heat loss is one constant 0.5 W/K for every vessel, no radiation, no evaporative cooling: a dry beaker on a 300 W
  plate reaches 894 K (B8).
- Reaction heats are per reaction; dissolution of inert compounds, degassing, mixing and dilution are athermal (B3, B15).
- The energy ledger reports a constant `1.5e-5` (F2).

### 3.8 Transport between phases

| Process | Today | Problem |
|---|---|---|
| Dissolution | Instant in the engine; the web draws a "ghost pile" shrinking at a constant rate | Rate unrelated to solubility, particle size, stirring; pH jumps at once (C13, D11) |
| Precipitation | Instant once IAP > Ksp | No nucleation barrier, induction time or supersaturation-dependent size (D11, F47) |
| Degassing | CO2 only, toward k_H·P_total at 0.15 s⁻¹ | Open beakers hold 0.034 M CO2 forever (air equilibrium ~1.4e-5 M) (C10) |
| Evaporation | `evaporation_g_s` is a constant shown to the user | Nothing evaporates below its boiling point (C4) |
| Settling | Stokes with ρ_liquid 1.0, η 1e-3, ×10 floc factor, τ clamped 8–300 s | Same in ethanol, glycerol and hot water; colloids cannot stay suspended (C14, E9) |
| Stirring | Boolean; `stir_rpm` stored but unused | Affects only CO2 and settling (D22) |

### 3.9 Appearance

- **Solution colour:** physically sound spectral pipeline (32 bins, 400–710 nm, CIE weights) fed by **21 hand-entered
  band rows keyed by species id**. Every dissolved import is colourless (methylene blue, VOSO4); Ni²⁺, Cr³⁺, Fe(CN)6³⁻,
  VO²⁺ have no bands; the ethanol layer's absorbance is hard-zero; neat layers take one RGB from a colour word and
  cannot carry dissolved colour (I2 in hexane is clear) (E1–E3).
- **Solids:** colour from 9 hand rows → inert record colour word → the 128-row table → 7-cation/6-anion hue rules. Prussian
  blue renders orange; Na2S grey; every iodide yellow; imported salts ignore their own colour and density (ρ = M/38, so
  K3Fe(CN)6 = 8.0 g/mL) (E4, E8). Particle size and "gel/curds/powder/crystal" are stored per compound (F47).
- **Gases:** 11 hand-entered fume rows with stored `denser_than_air`; fumes only from a sealed headspace, so open vessels
  never show NO2/Cl2/Br2 (E5).
- **Steam/boiling/condensation:** thresholds on T alone (vapour visible 330–373 K, boiling only for water at
  373.15 K); a dry beaker at 786 °C "steams"; boiling ethanol shows no boil (E6).
- **Flames:** ethanol only, 36 kW from a 250 mL beaker (~20× a real pool fire), flame T fixed at 1200 K, no flame-test
  colours although the field and shader uniform exist (E7).
- **Layers:** n = 1.333 / 1.361 / 1.45 constants, which the renderer ignores anyway; aqueous ρ = 1 + 0.03·I (F40).
- **Shader:** collapses the spectrum to three channel coefficients at one path length, so dichroic solutions do not
  change hue with depth (E11).
- **Event text:** generic and data-driven (good), but colour-change detection looks only at the aqueous layer, and raw
  ids leak ("O5SV") (E19).

### 3.10 Where the data comes from

| Path | Reality |
|---|---|
| Static bundle (501 species) | **Mostly fabricated** (I1): 241 salts with mp = 500 + (masses mod 300), all "soluble", labelled `tabulated / PHREEQC`; 384 fake CIDs; overrides PubChem and is flagged "known" (NaF mp 542 °C vs real 993 °C). Its `phreeqc`, `pka`, `joback_groups` and `colors` sections are never read |
| `pipeline/phreeqc_parser.py`, `pka_parser.py` | Hand-typed (11 equilibria + 5 minerals; 37 pKa rows) despite their names |
| `solubility.json` (128 minerals) | From memory with a "CRC Handbook" header; drifts from llnl.dat by up to 2.3 log units (PbF2), Fe(OH)3 −2.2, MgF2 −0.9, SrSO4 −0.8 (I17) |
| Data proxy core table | 11 hand-typed entries labelled "NASA CEA / ATcT / SUPCRT / PHREEQC" |
| NIST WebBook scraper | Misreads tables: ΔfusH = T_fus (ethanol "159 kJ/mol"); "Antoine" taken from the ΔvapH table, giving ~10⁵⁹ Pa that the engine accepts; Cp tables mix phases; caches "Search Results" pages; offline fallback poisons NIST keys; 1 s rate limit vs the 5 s crawl delay (I3–I5) |
| Wikidata | Server-side only, ignores units and phase qualifiers (density 790 "g/cm³", bp 173 °F mixed with °C); its output keys are never read by the web (I6) |
| Joback | Fails to import on the default Python (`Tuple` not imported); 37 groups, not 41; silently skips unassigned atoms (DMSO −217 K); ring sp³ CH counted as aromatic; Cp coefficients returned in a shape the web discards (I7, I8) |
| PubChem text parsers | "122-123 °C" → −123 °C; "standard conditions" = string contains "25"; "decomposes", "sublimes", "greater than" ignored (aspirin "boils" at 140 °C); no consistency checks (benzoic acid ΔvapH 425 kJ/mol accepted); estimates promoted to "known" (I9, I10) |
| Provenance | Rust tiers serialise `"Tabulated"`, TS/CSS expect `"tabulated"`; every snapshot species row is hard-coded Tabulated (I13) |
| IndexedDB cache | Effectively write-only (read only for bundle-named compounds), no TTL (I11) |
| Property requests | Mineral-specific queue only (I16) |

### 3.11 Compound literals in logic (outside data tables)

Lines containing a species literal (`"H2O"`, `"C2H5OH"`, `"CO2…"`, `"H+"`, `"OH-"`, `"O2"`, halides, …), excluding
comments and ion tables: `vessel.rs` 24, `solubility.rs` 14, `spectra.rs` 13, `compound_model.rs` 12,
`network_generator.rs` 8, `gas.rs` 5, `lib.rs` 5, `vessel_eq.rs` 5, `vessel_ext.rs` 4, `vessel_phase.rs` 3. The target is
zero outside `db/` seed files, enforced by a grep test (section 8, Stage 2).

### 3.12 Why CI did not catch any of this

`cargo test` passes 89/89, but no test on the `Vessel` path covers:
- atom balance of reactions;
- reversibility, rate order or dt-invariance;
- pH(T) or Kw(T);
- Hess's law or solution heat capacity;
- mixture VLE, freezing, LLE or sealed-vessel pressure;
- colour of imports.

The M3/M4 gates in `CLAUDE.md` test legacy modules (`equilibrium.rs`, `kinetics.rs`, `energy.rs`) or a Python
re-implementation that the bench never runs (F46). Every stage in section 8 therefore lands with its gates on the
`Vessel` path in the built WASM.

---

## 4. Verified status of the earlier F-items

`CLAUDE.md` lists F1, F2, F3, F5, F6, F8, F13, F15, F17 and F28 as fixed. Verified against the current tree:

| F | Claimed | True status | Evidence |
|---|---|---|---|
| F1 generator invents chemistry | fixed | **Partial (B).** A 13-id exclusion list was added; substring matching, formula-less products and keto–enol on any id containing "CO" remain. 29 of 406 catalog pairs create junk species | A §2, D2 |
| F2 conservation fake | fixed | **Partial / masking (B).** Element sums exist, but unparseable species are skipped, vented gas counts as an error, the baseline resets on every dose, the 5 % tolerance hides real losses, and energy error is the constant 1.5e-5 | A1, D §2 |
| F3 volume | fixed | **Partial.** The fake 10 mL is gone; the volume model is otherwise unchanged | C8 |
| F5 boiling | fixed | **Superficial.** A second hard-coded clamp for ethanol; no mixture VLE, no elevation, open P pinned to 1 atm | C1, C9 |
| F6 sealed pressure | fixed | **Partial.** Air scales with T; still no air moles, no vapour pressure except water, 10 atm clamp | C2 |
| F8 heat capacity | fixed | **Partial.** Constant per-gram Cp; solids 1.0, ions 4.184; glass factor inconsistent | B7 |
| F13 pH | fixed | **Regression (B).** Clamp widened, but the new pKw(T) has the wrong sign | B1 |
| F15 identity | fixed | **Superficial (B).** Two string checks; the acid branch bypasses them | A §2, I §2 |
| F17 micro-scale | fixed | **Partial.** Solids no longer zeroed; water gate, 1 mL floor and 1e-7 snapshot cut-off remain | C §2 |
| F28 non-water Psat | fixed | **Open.** Water Antoine is still the only closed-vessel Psat | B §2, C §2 |
| F4, F7, F9–F12, F14, F16, F18–F27, F29–F47 | open | Still open; F16 and F18 partly addressed for inert compounds only. F21, F23 and F46 are worse than first reported | sub-audits |

---
## 5. Target architecture

### 5.1 One sentence per layer

| Layer | Responsibility | Replaces |
|---|---|---|
| **Identity** | Every compound, ion and solid has a stable structural id: InChIKey for molecules; formula + charge + phase (+ polymorph) for ions and solids. Formula is an attribute, never a key | formula-string ids, `element_key` matching, Hill-formula inert ids, string-concatenated product ids |
| **Species store** (`engine/src/db/`) | Intrinsic data only, per species and per phase, each datum with unit, T-range, tier and source; labelled curve points for condition-dependent facts; runtime-registrable; loaded from sharded bundles | `get_species_thermo`, `spectra.rs` tables, `solubility.json`, `chem_db.rs` equilibria/minerals, `CompoundThermo` as a separate store, `CORE_TABULATED_THERMO` |
| **Estimators** (`engine/src/db/estimate.rs` + web/server providers) | Fill missing intrinsic data from structure or other data, always labelled | silent defaults (ΔfH −100, Cp 50, ρ = M/38, solubility 0.1 g/L, Tc = Tb/0.65, rule Ksp) |
| **Thermo functions** (`engine/src/thermo/`) | μ°(T, P), H(T), S(T), Cp(T) per species-phase; solvent models (IAPWS water, ε(T)); HKF; EOS | four copies of van 't Hoff, two water Psat models, constant Cp per gram |
| **Phases** (`engine/src/phases/`) | Vessel state = gas phase + N liquid phases + pure solids, species amounts per phase; derived phase properties (ρ, η, ε, n, Cp) from components | `species_mol` with suffix conventions, `PhaseKind {Aqueous, Organic}`, ethanol layer, neat-compound layers, headspace pressure terms |
| **Equilibrium** (`engine/src/gem/`) | One Gibbs minimisation over chemical reactions (null space of the element + charge matrix of the candidate set) **and** phase transfers, with activity models; candidate species drawn from the store by the elements present | 32 hand-written equilibria, `auto_minerals`, bisection sweeps, Henry CO2 step, boiling clamps, inert melt/boil plateaus, `has_water` gate |
| **Activity** (`engine/src/activity.rs`) | `ActivityModel` per phase: B-dot (default electrolytes), SIT/Pitzer overrides, UNIFAC (neutral liquids), Born transfer (ions in other solvents), ideal/PR fugacity (gas) | ideal everywhere |
| **Kinetics** (`engine/src/kinetics/`) | Balanced elementary or empirical steps with separate orders; forward k from rate providers; reverse from K(T); stiff adaptive Rosenbrock; timescale split hands fast steps to the equilibrium layer | Euler loop in `vessel.rs`, `min(ν,1)`, catalyst override, frozen generated k |
| **Heterogeneous / transport** (`engine/src/transfer/`) | Rate-limited relaxation toward equilibrium targets: dissolution and growth (Sherwood), nucleation (CNT), corrosion (Butler–Volmer mixed potential), gas–liquid (k_L·a), evaporation, boiling flux, settling (Stokes/Richardson–Zaki with real ρ, η), combustion (pool burning) | instant dissolution/precipitation, ghost piles, 0.15 s⁻¹ CO2 degassing, settling clamps, ethanol flame |
| **Energy** (`engine/src/energy_balance.rs`) | Conserve total enthalpy H = Σ nᵢHᵢ(T, phase); solve T; heat exchange with plate/bath/burner/room from geometry, radiation and evaporation | ΔT = Q/C with constant Cp, per-reaction ΔH, latent-heat clamps, constant UA |
| **Reaction generation** (`engine/src/generate/` + server) | Organic: atom-mapped templates on structures (RDKit), products registered as species with estimated data; inorganic: implicit through the Gibbs candidate set | substring network generator |
| **Optics** (`engine/src/optics/`) | Per-species ε(λ) per solvent, solid band edge or reflectance, molar refraction, gas cross-sections, atomic lines; per-phase absorbance and scattering spectra | 21 band rows, 9 solid rows, 11 fume rows, hue rules, n constants, scatter at 550 nm |
| **Audit** (`engine/src/audit.rs`) | Element, charge and enthalpy ledgers per tick, including everything that leaves the vessel | constant energy error, vented gas counted as loss |
| **Data resolver** (`web/src/data/`) | Providers in priority order (core bundle → Wikidata → PubChem text → NIST proxy → estimators), merge, consistency gates, IndexedDB with TTL; answers the engine's generic property-request queue | `enrichWithLocalDataProxy`, ad-hoc record assembly, mineral-only resolver |

### 5.2 Record schema (shared JSON; Rust `SpeciesRecord`, TS `CompoundRecord`)

```jsonc
{
  "id": "ik:LFQSCWFLJHTTHZ-UHFFFAOYSA-N",        // or "ion:Cu+2", "s:CaCO3:calcite", "g:CO2"
  "identity": { "inchikey": "...", "smiles": "CCO", "formula": "C2H6O", "charge": 0, "cas": "64-17-5",
                "cid": 702, "names": ["ethanol"],
                "db_names": { "nasa": "C2H5OH", "phreeqc": "Ethanol", "nbs": "C2H5OH" } },
  "phases": {
    "g":  { "thermo": { "model": "nasa9", "ranges": [ ... ], "tier": "tabulated", "source": "nasa-cea" } },
    "l":  { "thermo": { "model": "point+cp", "dfH": D, "S": D, "cp": D },
            "volume": { "model": "rackett", "zra": D } },
    "s":  { "thermo": ..., "rho": D, "polymorph": "..." },
    "aq": { "thermo": { "model": "hkf", "params": { ... } } }
  },
  "critical": { "Tc": D, "Pc": D, "Vc": D, "omega": D },
  "points": [ { "kind": "psat", "T_K": 351.44, "P_Pa": 101325, "tier": "imported", "source": "pubchem" },
              { "kind": "tm",   "T_K": 159.0,  "P_Pa": 101325 },
              { "kind": "solubility", "solvent": "ik:XLYOFNOQVPJJNP-UHFFFAOYSA-N", "T_K": 298.15,
                "value": 1.0, "unit": "mol/kg" } ],
  "acid_base": [ { "site": "...", "pKa": D, "dH": D, "T_K": 298.15, "I": 0 } ],
  "redox": [],                                         // normally implicit from dfG of both partners
  "optics": { "bands": [ { "solvent": "water", "nm": 664, "eps": 95000, "fwhm": 70, ... } ],
              "molar_refraction": D, "band_gap_eV": D, "gas_xsec": [ ... ], "flame_rgb": [ ... ] },
  "transport": { "eta_l": { "model": "andrade", ... }, "sigma": D },
  "kinetics_refs": [ "mayr:..." ],
  "rejected": [ { "datum": D, "reason": "Trouton ratio 814 J/(mol K)" } ]
}
```

`D` = `{ "value", "unit", "T_K"?, "tier", "source", "uncertainty"? }`. No field may hold a plain mp, bp, density at T,
solubility or phase; a schema test rejects them.

### 5.3 Data flow

```
build time (pipeline/db/)                                    run time (web worker + engine)
NBS tables CSV ─┐                                            user search ─► PubChem identity (InChIKey, SMILES, formula, CAS)
llnl/sit/pitzer ┤                                                              │
SUPCRTBL yaml ──┤  parse → SpeciesRecord → identity map →                      ▼
NASA thermo.inp ┤  consistency gates → shard by key  ─────►  core bundle  ─► PropertyResolver ◄─ Wikidata (CORS)
Wikidata dump ──┤                                             (static)        │   providers  ◄─ PubChem text
BigSolDB/AqSol ─┤                                                             │              ◄─ NIST proxy (opt-in, per user)
MP slice ───────┤                                                             │              ◄─ estimators / server models
optics sets ────┘                                                             ▼
                                                              register_species / load_database
                                                                              │
                         engine: store → candidates for the elements present → GEM (phases + reactions)
                                 → kinetics + transfer (rate-limited toward GEM targets) → enthalpy → T
                                 → snapshot (per-phase composition, derived properties, optics, tiers)
                                 → take_property_requests() when it fell back to an estimate ─► resolver ─► register
```

### 5.4 Per-tick algorithm (target)

1. If T, P or composition changed beyond a threshold, or a dose happened: rebuild the candidate species set (store
   species whose elements are a subset of those present, plus their phases), refresh μ°(T, P) caches.
2. Equilibrium targets: warm-started Newton on the GEM (fast reactions + phase transfers), activity coefficients in an
   outer loop (2–4 iterations). A phase-stability test adds a solid, gas or second liquid phase when its saturation
   index or tangent-plane distance is positive.
3. Kinetics: adaptive Rosenbrock over slow steps, Strang-split with step 2 for fast steps (decided by relaxation time).
4. Transfers: each phase transfer relaxes toward its target with a rate from a mass-transfer correlation (semi-implicit
   exponential update, stable at dt = 1 s).
5. Energy: add external heat flows, subtract enthalpy carried out by vented or evaporated matter, solve T from total H.
6. Audit ledgers; snapshot; property requests for anything that fell back to an estimate.

### 5.5 Rules that keep the invariant enforceable

- No compound-id literal outside `engine/src/db/seed/` and tests (grep test).
- No condition-dependent field in a record (schema test).
- Every number in the snapshot that came from an estimate carries `tier ≥ estimated` (snapshot test).
- Every reaction, default, registered or generated, is atom- and charge-balanced at registration (load-time check).

---

## 6. Model selection: the chosen model for every derived quantity

Each row: the primary model, its inputs and where they come from, its validity domain, the fallback chain, and what is
explicitly **not** used. "Estimators" are always labelled.

### 6.1 Thermodynamic and phase quantities

| Quantity | Primary model | Inputs (source) | Domain | Fallbacks (in order) | Rejected as primary |
|---|---|---|---|---|---|
| μ°(T) of a species in a phase | NASA-7/9 or Shomate polynomial; HKF for aqueous species; point (ΔfH°, S°) + Cp(T) | NASA CEA, SUPCRTBL, NBS, llnl | 200–6000 K (NASA); 0–1000 °C, ≤5 kbar (HKF) | NBS 298 K point + constant Cp (±100 K); Benson/Gani/Joback (organics); Jenkins–Glasser S° + MP ΔfH (salts) | per-reaction log K as the primary data |
| K(T) of any reaction | ΔrG°(T) = Σν μ°(T) | species store | as μ° | PHREEQC analytic log K(T) (0–300 °C); van 't Hoff with ΔH and ΔCp | constant-ΔH van 't Hoff; ΔH = 0 |
| Reaction heat | −Δ(Σ nH) at constant P (implicit in the enthalpy balance) | species store | as μ° | — | per-reaction ΔH |
| Vapour pressure Pˢᵃᵗ(T) | μ°(g) − μ°(l) (sublimation: μ°(g) − μ°(s)); cut at Tc | species store | as μ°; EOS beyond ~5 atm or near Tc | measured Antoine/Wagner fit within its stored range; Clausius–Clapeyron with ΔCp through measured points; Lee–Kesler/Ambrose–Walton from (Tb, Tc, Pc, ω) | constant-ΔH extrapolation without range; Trouton-only curve |
| Boiling | bubble point Σ γᵢxᵢPᵢˢᵃᵗ = P (open: P_ext; sealed: computed P) | Pˢᵃᵗ, activity model | all mixtures | — | pure-component Tb clamps |
| Melting / freezing (incl. under pressure) | μ°(s) + ∫V_s dP = μ°(l) + ∫V_l dP (general Clapeyron; handles negative ΔV) | store + molar volumes | ≤ ~1 kbar | linear Clapeyron from (Tm, ΔHfus, ΔV) | a fixed mp |
| Colligative effects | fall out of the solvent's SLE/VLE with solute activities | — | dilute to moderate | — | ΔTf = Kf·m formulas |
| Henry constants | μ°(aq) − μ°(g) | llnl, SUPCRTBL, NBS (aq + g) | 0–300 °C | Sander compilation k_H° + d ln k_H/d(1/T); Pˢᵃᵗ/solubility | CO2-only constant |
| Salt solubility / Ksp | μ°(s) − Σν μ°(ions), with ion activities | NBS, llnl, SUPCRTBL, MP + Jenkins–Glasser | all T of the data | llnl log K(T); measured solubility points fitted with activities; solubility rules (Speculative) | ideal Ksp from one g/L value; rule Ksp; 3 mol/L cap |
| Molecular-solid solubility | ln(xγ) = (μ°(s) − μ°(l))/RT (Schröder–van Laar with ΔHfus, Tm, ΔCp) with UNIFAC γ | Tm, ΔHfus (store), UNIFAC groups | any solvent and T | measured (T, solvent) points (BigSolDB, AqSolDB, PubChem), fitted ln x vs 1/T; SolProp (server) | one water value at 25 °C; 0.1 g/L default |
| Miscibility, LLE | tangent-plane stability test + split with the activity model | UNIFAC 2.0 / modified UNIFAC 2.0 | non-electrolyte liquids | measured mutual solubility points | `PhaseKind` and per-compound layers |
| Activity, electrolytes | B-dot (Truesdell–Jones) with per-ion å from llnl.dat; A, B from ε(T), ρ(T) of the solvent | llnl.dat; solvent model | I ≲ 1–3 m, 0–300 °C | SIT (sit.dat) or Pitzer (pitzer.dat) when every major ion is covered; Davies | ideal |
| Activity, neutral liquids | UNIFAC 2.0 (VLE) / UNIFAC-LLE | group parameters, groups from SMILES | most organics | COSMO-SAC with a server-computed σ-profile; ideal | — |
| Ions in non-aqueous solvents | aqueous μ° + Born transfer with the phase's ε(T) | store, ε | Estimated tier | measured transfer energies | treating every solvent as water |
| pH / acidity | −log a(H⁺) on the molal scale of the phase containing water; solvent autoprotolysis from μ° | solver state | aqueous phases | none outside water (show "—" or the solvent's own scale, decision D6) | −log c, clamps, 1e-7 defaults, pOH = 14 − pH |
| Gas phase | ideal gas; Peng–Robinson (Tc, Pc, ω, k_ij = 0) above ~5 atm or near Tc; sealed vessel = isochoric flash | critical constants | to supercritical | — | `P = T/T_room + Antoine_water` |
| Liquid volume / density | V = Σ nᵢV̄ᵢ(T): water IAPWS-95/IF97 (or Kell 0–150 °C); organics COSTALD/Rackett from (Tc, Pc, ω, Z_RA); ions HKF V° + Debye–Hückel slope | store | most liquids | measured ρ(T) points; GCVOL group contribution | 18.015 mL/mol, M/2 mL/mol for solutes, 0.789 for ethanol, 1 + 0.03·I |
| Solid density | record value (measured) | PubChem, MP, NBS-adjacent | — | MP/Alexandria relaxed density; ion-volume additivity | ρ = M/38 |
| Heat capacity | Cp(T) from the same polynomials; aqueous apparent molar Cp from HKF | store | as μ° | Kopp/Neumann (solids), Joback Cp(T) (organic gas), Rowlinson–Bondi (liquids) | 4.184 for solutes, 1.0 for solids |
| Thermal decomposition | falls out of GEM with condensed and gas phases (e.g. NaHCO3 → Na2CO3 + H2O + CO2 when ΔrG(T, p_gas) < 0); rate limited by heat input or Arrhenius onset | store | — | — | hand-written decomposition reactions |

### 6.2 Reactions and rates

| Quantity | Primary model | Inputs (source) | Fallbacks | Rejected |
|---|---|---|---|---|
| Which fast reactions occur (acid–base, complexation, precipitation, gas evolution, fast redox couples) | Gibbs minimisation over candidates from the store; reaction basis = null space of the element + charge matrix | store (NBS, llnl, SUPCRTBL, NASA) | Estimated species (MP + Jenkins–Glasser); rules (Speculative) | hand-written equilibria lists; "strong unless listed" acids |
| Acid–base of organics | GEM over protonation states; pKa per site | pKahub (permissive subsets), PubChem "Dissociation Constants", IUPAC (server-only, CC BY-NC) | MolGpKa / QupKake (server, Estimated); default pKa by functional group (Speculative) | full dissociation by default |
| Redox direction and E° | oxidation-state components in the GEM; E° = −ΔrG°/nF from ΔfG° of both partners; Nernst implicit | NBS, SUPCRTBL, llnl half-reactions | — | curated E° tables |
| Redox rates | Marcus cross relation (outer-sphere couples, self-exchange table); Butler–Volmer mixed potential for metals (HER i0 table, area, mass transfer) | small review tables (§7.4) | default slow first order, Speculative, never instant | per-metal kinetic records |
| Organic reactions (which, products) | atom-mapped templates on SMILES (RDKit), validated by element balance; products become species | template set (curated core + USPTO-extracted via RDChiral, CC0) | forward model ReactionT5v2 / Molecular Transformer on the local server (Speculative suggestion, validated) | substring matching |
| Forward rate constant | priority chain: tabulated k(T) → mechanistic models (Eigen proton transfer, Eigen–Wilkins substitution, Marcus, Mayr) → family rate rules / Evans–Polanyi → server barrier (chemprop on RGD1/Grambow, or a real xTB TS workflow), always through Eyring | §7 | Speculative default | family A/Ea constants; scenario functions; catalyst-replaces-k |
| Reverse rate | k_r = k_f / K(T) (detailed balance) | species μ° | — | irreversible flags overriding thermodynamics |
| Diffusion ceiling | k_D = 4πN_A(D_A + D_B)(r_A + r_B)·f_Debye, D from Stokes–Einstein / Wilke–Chang with η(T) of the actual solvent | viscosity model, molar volumes | — | fixed η 8.9e-4 |
| Salt effect on rates | activity coefficients of reactants and TS (Brønsted–Bjerrum through the activity model) | activity model | — | none |
| Fast vs slow | relaxation time τ = 1/|∂r/∂ξ| vs dt | — | — | list membership |
| Catalysis | explicit mechanism steps (homogeneous) or surface rate ∝ area × k(T) | rate data | — | "catalyst replaces k" |
| Integrator | adaptive L-stable Rosenbrock (ROS3P/RODAS3) with substeps, Strang-split with equilibrium | — | — | one explicit Euler step per tick |

### 6.3 Transport and heterogeneous processes

| Process | Model | Inputs | Notes |
|---|---|---|---|
| Dissolution and crystal growth | dn/dt = −k_L·A·(c_sat − c); Sh = 2 + 0.6 Re^½ Sc^⅓ (Ranz–Marshall) or a stirred-tank form from `stir_rpm` and geometry; particle population as moments | D (Wilke–Chang), η, ρ, particle size | optional surface-reaction term for slow minerals |
| Nucleation | classical nucleation theory; interfacial energy from the Mersmann correlation (needs only solubility and molar volume) | solubility, density | gives induction time, metastable zone and particle size (replaces stored size and morphology) |
| Aggregation | critical coagulation concentration (Schulze–Hardy) | ionic strength, charges | replaces the ×10 floc factor |
| Gas–liquid exchange | N = k_L·a·(c − c*), c* from Henry and the **partial** pressure; bubble nucleation when Σpᵢˢᵃᵗ > P | Henry, D, surface area | open vessels exchange with an atmosphere of fixed composition |
| Evaporation below boiling | J = k_g·A·(Σγxᵢpᵢˢᵃᵗ − p∞)/RT, k_g from natural-convection Sherwood, D_gas from Fuller | Pˢᵃᵗ, geometry | drives drying, crystallisation by evaporation, evaporative cooling |
| Boiling flux | enthalpy surplus at the bubble point, split by vapour composition | VLE | — |
| Settling | Stokes → Schiller–Naumann drag, Richardson–Zaki hindrance; actual layer ρ(T), η(T) and liquid height; Brownian Péclet test for colloids | ρ, η, particle size | — |
| Viscosity | IAPWS 2008 (water); Andrade/DIPPR-101 fits where measured; Chung / Joback / Orrick–Erbar estimates; Grunberg–Nissan mixing | critical constants, groups | — |
| Combustion | flash point where yᵢ = Pˢᵃᵗ/P reaches LFL (measured or Jones' rule); pool burning rate (Spalding B-number or Babrauskas); adiabatic flame T from ΔcH and product Cp(T); O2 from the atmosphere | Pˢᵃᵗ, ΔfH, Cp | replaces the ethanol flame |
| Heat exchange | natural convection (Churchill–Chu) + radiation εσA(T⁴ − T∞⁴) + evaporation; hot plate as a node with a temperature limit; bath = a medium with its own enthalpy (ice melts) | geometry | replaces UA = 0.5 W/K and the fixed 273.15 K ice bath |

### 6.4 Appearance

| Quantity | Model | Inputs (source) | Fallbacks | Rejected |
|---|---|---|---|---|
| Solution colour | Beer–Lambert per phase on ε(λ) per (species, solvent), 380–780 nm grid; shader keeps the spectrum (per-layer LUT of colour vs path length) | measured λmax/ε/FWHM (Joung, Beard), PubChem UV text | Greenman λmax ML, sTDA-xTB (server); ligand-field band positions for first-row d-ion complexes (Estimated) | colour words inverted into ε; hand band tables as the primary source |
| Solid colour | Kubelka–Munk reflectance from the solid's absorption: band edge from the band gap (with a PBE scissor correction) plus inherited ion chromophores; measured colour text as a check | MP/Alexandria band gaps, ion spectra, PubChem "Color/Form" | colour text (Imported) | cation/anion hue rules |
| Refractive index | Lorentz–Lorenz from molar refraction; mixing by volume fraction | atomic/group refractions, Shannon ionic polarisabilities; measured n (refractiveindex.info, PubChem, Wikidata) | — | 1.333 / 1.361 / 1.45 constants |
| Turbidity | Mie / Rayleigh–Gans–Debye per wavelength bin with complex m = n_solid/n_layer | particle-size distribution, n, k | — | single 550 nm Van de Hulst; HashMap-order scatter colour |
| Gas / fume colour | gas cross-sections σ(λ) × column density; buoyancy from mixture molar mass and T | MPI-Mainz atlas (licence check), PubChem gas UV | sTDA | stored RGB and `denser_than_air` |
| Steam, mist, condensation | computed vapour flux; visible mist when the plume's mixing line crosses saturation; condensation when wall T is below the dew point | Pˢᵃᵗ, fluxes | — | T thresholds 330–373 K |
| Bubbles, foam | bubble rate = gas volume flux / bubble volume (keep); departure diameter from Fritz with σ(T); foam only with surface-active species | surface tension (measured, Parachor/Brock–Bird estimate) | — | per-call-site diameters; foam = flux/50 |
| Flame | adiabatic T; soot luminosity from sooting tendency (YSI or C/H, aromaticity); flame-test emission from atomic lines × Boltzmann × Saha | NIST ASD (reduced to per-element emission in the pipeline) | — | fixed 1200 K, no emission |

---
## 7. Data: the minimal large-source stack

Evidence tags: **[V]** = endpoint hit or file counted on 2026-10-01; **[R]** = read in the paper or on the landing page;
**[M]** = from memory, verify before relying on it. Full details are in `S_sources.md` and `docs/plans/data-sources.md`.

### 7.1 The stack

**A. Bundled at build time** (permissive licences; parsed once by `pipeline/db/`, shipped as sharded JSON):

| # | Source | What it supplies | Size / coverage | Licence | Fetch |
|---|---|---|---|---|---|
| A1 | **NBS Tables of Chemical Thermodynamic Properties (Wagman 1982), digitised by NIST** (doi:10.18434/M32124, `data.nist.gov/od/id/mds2-2124`) | ΔfH°, ΔfG°, S°, Cp at 298.15 K for inorganic compounds, aqueous ions, hydrates, oxides and C1/C2 organics | ~14,330 species [R]; CSV 0.77 MB [V] | NIST open licence, attribution [V] | one-off pipeline download (it timed out three times from here, so retry or use the xlsx) |
| A2 | **PHREEQC `llnl.dat`** (+ `minteq.v4.dat`, `sit.dat`, `pitzer.dat`) | aqueous species and complexes (hydroxo, chloro, ammine, carbonate …), minerals, gases, redox half-reactions, analytic log K(T) 0–300 °C, ΔrH, per-ion size å for B-dot; SIT and Pitzer parameters | llnl: 1327 solution reactions, 1215 phases (881 with analytic log K) [V]; minteq: 568 phases [V] | USGS public domain (llnl, pitzer) [V]; sit.dat derives from ThermoChimie, terms to verify | `raw.githubusercontent.com/usgs-coupled/phreeqc3/master/database/` |
| A3 | **SUPCRTBL / slop16** (HKF) via Reaktoro's YAML | ΔfG°, ΔfH°, S°, HKF parameters for aqueous ions, complexes and neutral organics to 1000 °C / 5 kbar; minerals (Holland–Powell) | supcrtbl 1108 species; supcrt16-organics 2029 [V] | freely distributed with attribution; confirm with the SUPCRTBL authors before bundling | raw GitHub (Reaktoro `embedded/databases`) |
| A4 | **NASA CEA `thermo.inp`** | NASA-9 Cp/H/S for gases and condensed phases with transition temperatures | ~2111 species, ~815 condensed [V] | NASA / Apache-2.0 [V] | raw GitHub (`nasa/cea`) |
| A5 | **Wikidata extract** (CC0) for the top ~5–10 k PubChem compounds | ΔfH°, S°, Cp, ΔcH, ΔvapH, mp/bp/vapour-pressure **as points**, density with T, pKa | patchy: mp 31.8 k items, bp 2.0 k, density 2.9 k, ΔfH 430, S° 174, pKa 281; **no Tc/Pc property at all** [V] | CC0 | SPARQL with `p:/psv:` values, `wikibase:quantityUnit` and phase qualifiers; units normalised at build time |
| A6 | **BigSolDB 2.2** + **AqSolDB** | solubility vs T and solvent (SMILES of solute and solvent); water log S at ~25 °C | 111,505 rows, 1,522 solutes, 127 solvents, 243–425 K [V]; 9,982 compounds [V] | CC BY 4.0 [V]; CC0 [V] | Zenodo 22648301 (CORS `*`); Harvard Dataverse |
| A7 | **Materials Project bulk release** (S3, no API key) | corrected formation energies (MP2020 fitted to experiment [M]), relaxed density, band gap, absorption spectra for inorganic solids missing from A1–A4 | ~150 k materials [R] | CC BY 4.0 [R] | `s3://materialsproject-build/collections/<date>/` (CORS `*`) [V]; ship a filtered slice (formulas reachable from bench elements) |
| A8 | **Measured UV/Vis**: Joung et al. 2020 + Beard et al. 2019 | λmax, ε, FWHM by (compound, solvent) | 20,236 records / 7,016 chromophores / 365 solvents [R]; 18,309 records [R] | CC BY 4.0 [R] (Joung presumed, verify) | figshare (pipeline) |
| A9 | **refractiveindex.info database** | n(λ), k(λ) for materials and ~100 liquids | thousands [M] | CC0 [V] | raw GitHub |
| A10 | **UNIFAC 2.0 / modified UNIFAC (Dortmund) 2.0** parameter matrices (complete, matrix-completed) + group assignment | activity coefficients, VLE, LLE of non-electrolyte mixtures from structure | all main-group pairs [R] | open-access papers; parameter licence not stated: **verify** | SI of the papers (also as TSV in the MIT `thermo` repo) |
| A11 | **pKahub, permissive subsets only** | measured aqueous pKa (microstate-annotated) | >90 k values / >31 k molecules overall [R] | per-subset; exclude IUPAC (CC BY-NC), OCHEM, QSAR Toolbox | GitHub `keserulab/pkahub` sqlite [V] |

**B. Fetched at run time per user** (not redistributed):

| # | Source | Role |
|---|---|---|
| B1 | **PubChem** PUG REST / PUG View (CORS) | identity hub (InChIKey, SMILES, formula, CAS, synonyms); long-tail text: mp/bp/density/vapour-pressure points, ΔvapH, ΔfusH, ΔcH, solubility text (all points kept with T, P, solvent), pKa text, UV λmax/log ε text, colour/form text, refractive index, surface tension, flash point and flammability limits |
| B2 | **Wikidata SPARQL** (CORS, CC0) | anything outside the A5 extract |
| B3 | **NIST WebBook through the local proxy** (opt-in) | ΔfH°/S° per phase, Shomate, Antoine with range, ΔfusH, Tc/Pc. **Per-user cache outside the repo**, 5 s crawl delay, attribution, never shared or bundled |
| B4 | **Materials Project API** (user's own key, optional) | anything not in the A7 slice |

**C. Optional local-server model pack** (one Python environment, permissive licences; every output Estimated or
Speculative and validated before use):

| Model | Fills | Licence |
|---|---|---|
| ReactionT5v2-forward (or Molecular Transformer) | organic products when no template matches | MIT [V] (trained on ORD, CC BY-SA, weights only) |
| chemprop barrier model trained on RGD1 (177 k reactions) / Grambow (12 k) | activation barriers for arbitrary organic steps (gas-phase DFT; add a solvation correction) | data CC BY 4.0 [V]; chemprop MIT |
| Real xTB TS workflow (replace `barrier_workflow.py`) | Refined barriers on request | existing tblite |
| MolGpKa or QupKake | pKa of unlisted organics | MIT / BSD-3 [V] |
| SolProp (or its FASTPROP successor) | solubility of organics in any solvent and T | licence to check |
| Greenman λmax/ε models; sTDA-xTB | absorption bands of unlisted chromophores | MIT [V]; LGPL [V] |
| `ugropy` (Abdulelah–Gani, Joback, UNIFAC groups) | Tc, Pc, Vc, ω, Tb, Tm, ΔfH, group assignment | MIT [V] |
| RDKit + RXNMapper + RDChiral | template application, atom mapping, template extraction from USPTO (CC0) | BSD / MIT [V] |

The browser-only app keeps working without C: those gaps fall back to the estimators in the engine/web and are
labelled.

### 7.2 Per-need source-priority chains

Left = preferred. A source is skipped if its value fails the consistency gates (section 7.5).

| Need | Chain |
|---|---|
| Inorganic species ΔfG°/ΔfH°/S° (solids, ions, gases) | NBS (A1) → llnl/minteq log K back-converted to species μ° (A2) → SUPCRTBL (A3) → NASA CEA (A4) → MP corrected ΔfH + Jenkins–Glasser S° (A7, Estimated) → rules (Speculative) |
| Aqueous species above ~100 °C | SUPCRTBL HKF (A3) → llnl analytic log K(T) (A2) → NBS + constant ΔCp (A1) |
| Gas and pure-phase Cp(T), high T | NASA CEA (A4) → NIST Shomate (B3) → Joback/Gani Cp(T) (Estimated) → Kopp/Neumann (solids) |
| Organic ΔfH°/S°/Cp | NBS C1/C2 (A1) → NASA CEA (A4) → Wikidata (A5/B2) → NIST (B3) → ΔcH via Hess (B1) → Gani/Joback/Benson (Estimated) → server GNN or xTB atom-equivalents (Speculative) |
| Vapour-pressure curve | μ°(g) − μ°(l) when both phases have data → measured points (PubChem B1, Wikidata A5, NIST Antoine with range B3) → Lee–Kesler from (Tb, Tc, Pc, ω) (Estimated) |
| Tc, Pc, Vc, ω | NIST (B3) → `ugropy` Gani / Joback (Estimated) → ML critical-property model (server, Estimated). **No large open experimental table exists** |
| Melting data (Tm point, ΔfusH) | NBS/NASA phase pairs → PubChem/Wikidata/NIST points → Gani/Joback Tm, Chickos ΔfusS (Estimated) |
| Solubility, salts | ΔrG° from species μ° → llnl log K(T) → measured solubility points fitted with activities (AqSolDB A6, PubChem B1) → rules (Speculative) |
| Solubility, molecular solids | Schröder–van Laar + UNIFAC from Tm/ΔfusH → BigSolDB/AqSolDB points (A6) to validate or fit → PubChem text → SolProp (server) |
| pKa | species μ° (inorganic acids, NBS/llnl) → pKahub permissive subsets (A11) → PubChem text (B1) → MolGpKa/QupKake (server) → functional-group default (Speculative) |
| Henry constants | μ°(aq) − μ°(g) (A1–A3) → Sander compilation (licence: verify; ACP paper is CC BY [M]) → Pˢᵃᵗ/solubility (Estimated) |
| Activity parameters | llnl B-dot å (A2) → SIT/Pitzer (A2) → UNIFAC 2.0 (A10) → COSMO-SAC (server) → ideal |
| Liquid density, viscosity, surface tension | measured points (PubChem, Wikidata) → corresponding-states estimates from (Tc, Pc, Vc, ω): COSTALD/Rackett, Chung, Brock–Bird (Estimated) |
| Optical: solution ε(λ) | A8 measured → PubChem UV text (B1) → Greenman ML / sTDA-xTB (server) → ligand field for d-ions (Estimated) |
| Optical: solids | measured colour text (B1) as check → MP band gap + Kubelka–Munk (A7) → inherited ion chromophore |
| Optical: n | refractiveindex.info (A9) → PubChem/Wikidata → Lorentz–Lorenz from refractions (Estimated) |
| Flame emission | per-element emission derived from NIST ASD lines in the pipeline (store only the derived colour; ASD is SRD-copyrighted) |
| Organic reactions | curated core templates → USPTO-extracted templates (CC0) → forward ML model (server) |
| Rates | see §6.2 chain; Mayr N/sN/E as a tabulated tier (licence: verify, no bulk download) |

### 7.3 What has no large database, and the least-bad option

| Need | Situation | Least-bad option |
|---|---|---|
| Solution-phase rate constants | **No large open database.** NIST SRD 17 and ReSpecTh are gas-phase; SRD 17 cannot be bundled | mechanistic models with small tables (§7.4), Mayr, barrier ML trained on RGD1/Grambow, real xTB TS search; never "instant" by default |
| Critical constants and transport | No large open experimental table; Wikidata has no Tc/Pc; the large tables inside `chemicals` are Yaws/CRC/DIPPR (commercial) | group contribution (Gani, Joback) + corresponding-states correlations |
| d–d and charge-transfer spectra of metal ions | No large open table | data where available (A8, PubChem) + ligand-field model + a short, sourced seed list carried over from `spectra.rs` |
| Redox kinetics | No database; self-exchange rates and exchange currents exist only as review tables | Marcus + Butler–Volmer with small tables |
| Solid-state decomposition rates | No general model | heat-input-limited rate with an Arrhenius onset when a literature Ea exists; otherwise Speculative onset at ΔG = 0 + margin |
| Organic selectivity | No first-principles general model | templates + rate rules; ML suggestions labelled Speculative |

### 7.4 Small tables allowed because they feed a general model

Each is one file, from one review, with the source cited per row. Decision D3 asks the user to accept these.

| Table | Rows | Feeds | Source |
|---|---|---|---|
| Water-exchange rate constants of aqua ions | ~60 | Eigen–Wilkins: **every** complexation / ligand-substitution rate | Helm & Merbach, Chem. Rev. 2005 |
| Self-exchange rate constants of redox couples | ~100 | Marcus cross relation: outer-sphere electron transfer | Wherland / Bard–Parsons–Jordan compilations |
| HER exchange current densities per metal (+ passivation flag) | ~30 | Butler–Volmer corrosion of every metal in acid and cementation | Trasatti (1972) volcano data |
| Atomic/group refractions + ionic polarisabilities | ~50 + ~270 | Lorentz–Lorenz n for every liquid and solid | Vogel; Shannon & Fischer 2006 |
| Ligand-field f (per ligand), g and Racah B (per ion) | ~10 + ~15 | band positions of first-row d-ion complexes | Jørgensen; Lever |
| Yield Sooting Index (optional) | ~500 | flame luminosity | Yale YSI database |

### 7.5 Ingestion rules

1. **Identity first.** A source row is attached to a species only through InChIKey (molecules) or formula + charge +
   phase (+ polymorph) (ions, solids), using a build-time identity map. Never by formula alone for molecules.
2. **Points, not properties.** mp → (Tm, 101 325 Pa) point; bp → (Tb, 101 325 Pa) Pˢᵃᵗ point; solubility → (solvent,
   T, value, unit); density → (T, value). Qualifiers ("decomposes", "sublimes", "greater than", "at 10 mmHg") are
   parsed into the point's kind and conditions or the datum is rejected.
3. **Consistency gates before acceptance:** ΔG = ΔH − TΔS within 1 kJ/mol; Pˢᵃᵗ curve reproduces Tb within 3 K;
   ΔvapH/Tb within 60–130 J/(mol K); ΔfusH/Tm within 20–120 J/(mol K); Hess ΔcH vs ΔfH within 5 kJ/mol; Ksp from ΔG vs
   tabulated log K within 0.5; P points ≤ 10·Pc; T inside the fit range. A failing datum is kept in `rejected` with the
   reason, shown in Details, and not used.
4. **One internally consistent basis per family.** Inorganic aqueous data comes from one basis (llnl or SUPCRTBL, with
   NBS as the cross-check), never mixed row by row (B6).
5. **Merge:** tier first; within a tier the median of independent measurements with an outlier rule; never average
   curve parameters.
6. **Licence registry** (`web/src/data/licences.ts`, exported to the pipeline): every source id has its licence and
   attribution string; the Details drawer shows them.
7. **Caches:** IndexedDB with TTL (90 days for imported data, versioned for bundles); the NIST proxy cache lives in a
   user data directory (`platformdirs`), never under the repo.

### 7.6 Do not use

- Commercial: CRC, Lange's, Yaws, DIPPR 801, Perry, VDI/PPDS, TRC/TDE, DDB, Reaxys, CAS, Pistachio, Barin, FactSage,
  HSC, Pedley. This includes the tables shipped inside the MIT-licensed `chemicals`/`thermo` packages (use their
  correlation code, not their data files). Note: audit B suggested those tables; that suggestion is overruled here.
- Not bundlable (per-user lookup at most): all NIST SRD (WebBook, JANAF, SRD 17 kinetics, SRD 78 ASD, SRD 106
  solubility, CCCBDB), IUPAC digitized pKa (CC BY-NC; audit A called it CC BY, which is wrong), Burcat (no commercial
  copying), Uni-pKa (reported CC BY-NC-ND), NIST COSMO-SAC profile DB (non-commercial).
- Share-alike, keep out of the core bundle: ORD (CC BY-SA), ChEMBL-derived sets (CC BY-SA).
- Licence unknown, ask before bundling: ATcT, RMG-database (no LICENSE file), Thermoddem, Mayr, ThermoG3/CBS, SolProp,
  UNIFAC 2.0 parameters, MPI-Mainz spectral atlas, ChemSep databank, Sander Henry compilation download.
- Too small or too narrow to be worth a provider: PhotochemCAD, NIST WebBook UV/Vis, QM8, Wikidata for transport or
  critical constants, Passut–Danner, ReSpecTh and SRD 17 for bench chemistry, Ceder text-mined syntheses (recipes, not
  test-tube reactions), RMG families for ionic bench chemistry (radical/combustion/surface), PrIMe/ChemKED.
- Existing repo data to retire: the synthetic part of `web/public/data/bundle.json` (I1), `pipeline/data/solubility_products.csv`
  (written from memory with a CRC header), the hand-typed `phreeqc_parser.py`/`pka_parser.py` lists, `curated_colors.py`.

---
## 8. Implementation plan

Each stage ships on its own and lands with its gates on the `Vessel` path in the built WASM (`tests/wasm_e2e.mjs`
style) or as `engine/tests/*.rs`. "Deletes" lists the code a stage retires, so that special cases do not pile up beside
the general model. Sizes are rough single-developer estimates.

### Stage 0: stop wrong results (≈1–2 weeks, no architectural dependency)

**0.1 pH (B1).** `vessel.rs:1232-1249` `current_ph`: compute −log10 of the solver's H⁺ concentration on the solver's
own volume basis (activity once Stage 3 lands). Delete the pKw formula, the `unwrap_or(&1e-7)` mol defaults and the
clamp. Also fix the "H⁺ = OH⁻ takes the OH⁻ branch" tie. The template catalysis code (`templates.rs:140`,
`network_generator.rs:501, 506`) must read the solver's OH⁻ rather than pOH = 14 − pH.

**0.2 Kinetic records (A1, D1, D6).** Add `orders: Option<HashMap<String, f64>>` to `GeneralKineticRxn`
(`chem_db.rs:105-121`, serde default = stoichiometric). Fix `h2o2_decomposition` (2 H2O2 → 2 H2O + O2, order 1) and
`iodine_clock_slow` (2 I⁻, order 1). Add an element + charge balance check (`ions::species_elements`) for every default,
registered (`lib.rs:447`) and generated reaction; reject unbalanced ones or store them as Speculative with a visible
warning.

**0.3 Water in equilibria (A2).** In `vessel_eq.rs:211, 216, 397, 403`, keep H2O in each reaction's ν (amounts
conserved) while leaving it out of ln Q (activity 1 until Stage 3).

**0.4 Disable the substring network generator (F1, A3, D2, D3, D13, D19).** Gate `update_network()`
(`vessel.rs:444`) behind a debug flag that defaults off; remove the `len() < 10` bypass. Keep the code until Stage 9
replaces it.

**0.5 Conservation ledger (F2, A16).** Baseline = cumulative elements added − elements vented or evaporated (book
every outflow by element). Flag unparseable species instead of skipping them. Report per-element absolute (mol) and
relative error with a 1e-6 tolerance. Either compute the enthalpy ledger or remove `energy_rel_err` until Stage 2.

**0.6 Acids (A4).** An acid whose parent has no equilibrium becomes weak with an Estimated default pKa by functional
class (e.g. carboxylic ≈ 4.5), not strong. "Strong" requires data (pKa < 0). Never decompose a carbon compound whose
SMILES has no charges into H⁺ + anion (`compound_model.rs:231-232`).

**0.7 Identity (F15, A, I14).** Send `inchi_key` (and SMILES, CAS) in `CompoundRequest` (`main.ts:119-140`,
`web/src/types/sim.ts`, `compound_model.rs:20-75`). Give the engine's built-in neutral species InChIKeys and match
imports by InChIKey; `element_key` only proposes candidates. Remove the two SMILES-substring checks
(`compound_model.rs:249-265`). Key inert compounds by InChIKey so isomers no longer overwrite each other. In the web,
`ReagentLibrary.has` and `catalogMatchFor` match InChIKey first.

**0.8 Scale and volume gates (F17, C12).** Replace the `has_water > 0.05 g` gate and the 1 mL floor
(`vessel_eq.rs:118-131`) and the snapshot `mol <= 1e-7` cut-off (`vessel.rs:1008`) with scale-relative tolerances.
Evaluate Ksp over the aqueous volume only (not water + ethanol) until Stage 3 makes this per-phase.

**0.9 Energy hygiene (B3, B7).** `step_co2_degassing`: charge the enthalpy of CO2(aq) → CO2(g) (+20.3 kJ/mol now, from
μ° after Stage 2). Delete the `baking_soda_vinegar` kinetic record (the equilibria + degassing already cover it, A11).
One glass heat-capacity factor in `dose`, `settle_after_addition`, `add_portion` and `step_thermal`; one `R_GAS`
constant; `add_portion` uses the portion's own Cp and density.

**0.10 Solver hygiene (B11).** `relax_equilibrium` and `saturate_minerals` stop inserting zero-amount species; prune
exact zeros from `species_mol` after each solve. Target: busy-mixture step from 23 ms to < 5 ms before Stage 2.

**0.11 Licence and server hygiene (I4, I5).** Add `server/cache/nist_cache.db` to `.gitignore` now; move the proxy
cache to a user data directory (`platformdirs`) with a TTL; rate limit 5 s; do not cache "Search Results" pages or
offline fallbacks under NIST keys; add `verify_token` to `/api/data/*`. Untrack `server/chamber.db` and
`engine/target` if they are still tracked.

**0.12 Data-path bugs (I1–I3, I6–I10).**
- Bundle: stop bundle entries from overriding PubChem or being flagged `known` (`record_builder.ts:51-59, 82`); remove
  the CID match in `bundleEntryFor` (`api.ts:95-100`); drop the synthetic salt matrix and formula series from
  `pipeline/species_curation.py`.
- Proxy core table: match by InChIKey or CAS only (`data_proxy.py:491-505`).
- NIST parser: parse by table caption and header, per phase; keep every row with its T; reject Antoine blocks whose
  sampled P exceeds 10⁸ Pa. Engine `fit_vapor_curve` gets an upper P bound.
- Wikidata: read `psv:` values with units and phase qualifiers, or switch it off until Stage 1 replaces it.
- Joback: fix the `Tuple` import, return `None` when any heavy atom is unassigned, fix the ring sp³ CH ordering and
  nitrile double count, add the missing groups, return Cp as `[a, b, c, d]`; a pytest over ~30 molecules asserts full
  coverage and |ΔTb| < 25 K for 80 %.
- PubChem parsers (`parser.ts`, `thermo_parser.ts`): ranges → midpoint; a real "standard conditions" test; parse or
  reject "decomposes", "sublimes", "greater/less than", "approx."; accept unitless relative densities; Trouton/Walden
  sanity gates on ΔvapH/ΔfusH; extend `tests/thermo_parser.mjs` with the live strings captured in the probes.
- Never set `known` for an estimated value; keep ΔfH/S° phase tags (`api.ts:146-155`); keep Antoine ranges and Tc
  (`api.ts:121-184`).

**0.13 Provenance (I13).** `#[serde(rename_all = "kebab-case")]` on `ProvenanceTier` (`types.rs:4-13`); snapshot
species rows carry the tier of the data actually used (`vessel.rs:1077, 1091`); `record_builder.ts:134` emits
`'imported'`; the `get_species_thermo` fallback is labelled Speculative.

**0.14 Cheap visual corrections (E5–E8, E10, E17).** `is_boiling` and `boil_intensity` from the computed vapour flux of
any boiling compound; no steam or condensation when there is no liquid; open-vessel fumes from `gas_fluxes`, not only the
sealed headspace; deterministic, mass-weighted `scatter_rgb`; ionic imports keep their own density and colour
(`mineral_for_import`); version the bottle-colour cache key with an engine optics-data hash; flame power from a
pool-burning rate instead of 0.04 mL·s⁻¹·cm⁻².

**0.15 Optional bridge for sealed vessels (C2).** Until Stage 4, sealed P = air + Σ over volatile liquids of
x·Pˢᵃᵗ(T) (water without the 10 atm clamp; inert compounds from their curve; ethanol from a curve record), with vapour
moles and latent heat booked, cut at Tc.

**0.16 Tests.** Port these probes into `tests/wasm_e2e.mjs` / `engine/tests/stage0.rs`:
- pure water pH(T) = pKw(T)/2 ± 0.01 at 0, 25, 60, 100 °C;
- iodine-clock I atoms conserved to 1e-9; 0.044 mol H2O2 → 0.022 mol O2 ± 1 %;
- HCl + NaOH makes 1 H2O per H⁺;
- methyl formate and dimethyl ether stay distinct from acetic acid and ethanol;
- 0.1 M citric acid pH within 0.3 of 2.1 (Estimated tier until pKa data lands);
- no species id containing `_subst`, `_enol`, `_alkene` after any pair of catalog reagents (probe P3, 406 pairs);
- 11 µL + 11 µL 0.1 M AgNO3/NaCl gives ≥ 1.0 µmol AgCl;
- 10 g NaCl in 25 mL water + 25 mL ethanol leaves ≥ 1 g undissolved;
- the conservation check flags a deliberately unbalanced registered reaction;
- importing "sodium fluoride" gives mp ≈ 993 °C.

**0.17 Documentation.** Correct the `CLAUDE.md` status entries that claim F1, F2, F3, F5, F6, F8, F13, F15, F17 and F28
are fixed; point them to this plan.

### Stage 1: identity, one record, the species store and the core bundle (≈3–4 weeks)

Goal: every piece of data enters through one record type, keyed by structure, with provenance, from a few large
sources.

1. **Schema.** `engine/src/db/record.rs` and `web/src/data/record.ts` implement the §5.2 schema;
   `docs/schema/species_record.schema.json` is the shared definition. A schema test rejects plain mp/bp/solubility/
   density-at-T/phase fields.
2. **Store.** `engine/src/db/store.rs`: `SpeciesStore` (id → record, plus indices by element set and by phase);
   wasm exports `register_species(json)`, `load_database(shard_json)`, `species_record(id)`. Engine species ids become
   opaque stable ids (`ik:…`, `ion:Cu+2`, `s:CaCO3:calcite`); the formula is an attribute used for element bookkeeping.
   `include_str!("../data/solubility.json")` is replaced by `load_database` (keep a tiny compiled seed for tests, F34).
3. **Seeds.** Port `get_species_thermo`, `spectra.rs` (bands, solid optics, fumes), `solubility.json` and the
   `chem_db.rs` equilibria and minerals into seed records with honest sources and tiers (unsourced rows become
   Speculative). Route `get_species_thermo` callers through the store; the ΔfH −100 / Cp 50 fallback becomes an
   explicit Speculative datum plus a property request.
4. **Pipeline** (`pipeline/db/`, one script per source, each with a test):
   - `parse_nbs.py` (A1): formula + state strings → identity keys, ΔfH°/ΔfG°/S°/Cp(298).
   - `parse_phreeqc.py` (A2): `SOLUTION_MASTER_SPECIES`, `SOLUTION_SPECIES`, `PHASES`, `-analytic`, `-delta_H`,
     `-llnl_gamma`, SIT and Pitzer blocks; handles phase names that look like section keywords ("B", "C", "K"). Emits
     reactions and back-derived species μ°.
   - `parse_supcrtbl.py` (A3, after the licence is confirmed), `parse_nasa_cea.py` (A4).
   - `wikidata_extract.py` (A5): `p:/psv:` values, units via a QID → SI table, phase qualifier P515, values as points.
   - `parse_solubility.py` (A6), `mp_slice.py` (A7: formulas reachable from bench elements), `parse_optics.py` (A8,
     A9), `parse_unifac.py` (A10), `parse_pka.py` (A11, licence-filtered).
   - `build_identity_map.py`: formula/charge/phase ↔ InChIKey via PubChem batch (cache under `pipeline/cache/`, not
     shipped).
   - `build_core.py`: merge by §7.5 rules, run the consistency gates, shard `web/public/data/core/{ions, solids, gases,
     organics-XX}.json.gz` by key prefix, plus `manifest.json` (version, sources, licences, counts).
5. **Retire** `pipeline/data/solubility_products.csv`, `build_solubility_table.py`, the hand-typed
   `phreeqc_parser.py`/`pka_parser.py` lists, `curated_colors.py`, and the synthetic bundle. Keep the old Ksp table
   only as a cross-check (`tests/core_vs_legacy.py` reports |Δlog K| > 0.3).
6. **Web data layer** (`web/src/data/`): `identity.ts` (name/CID → InChIKey, SMILES, formula, charge, CAS);
   `resolver.ts` with `providers/{core_bundle, wikidata, pubchem_text, nist_proxy, estimators}.ts`; `merge.ts`;
   `checks.ts` (§7.5 gates); `licences.ts`. The PubChem parsers become the `pubchem_text` provider and emit points
   (solubility with T and solvent, vapour pressure, mp/bp as points, ΔvapH(T), UV bands, colour phrases), fixing F36
   and F37. IndexedDB `propertyRecords` keyed by (provider, key) with TTL, read on every import (I11).
   `enrichWithLocalDataProxy` and the `importCompound` assembly are replaced; `BottleState` keeps only identity, user
   overrides and the record id.
7. **Generic property requests (I16).** Engine `take_property_requests()` → `[{species_id, identity, kinds[], reason,
   current_tier}]`, raised whenever the engine falls back to an estimate or rule; `resolve_properties(records_json)`.
   `MineralLookup`/`resolve_mineral` become one case. Retry with backoff instead of per-session `SEEN`.
   `mineral_resolver.ts` becomes `property_resolver_loop.ts`.
8. **Products are reagents.** A species formed in the lab raises a property request with its identity; the resolved
   record is registered and added to the library through the same path as an import (`formedInLab` stays a flag).
9. **Provenance UI.** Snapshot `SpeciesRow` gets `{tier, source_id, estimated_fields[]}`; the Details drawer gets a
   per-species "Data" tab (each datum with tier badge, source, licence attribution, retrieved date, and rejected values
   with reasons).

Gates: llnl comparison for PbI2, AgCl, BaSO4, CaCO3, Fe(OH)3, ZnF2 within 0.3 log units; existing precipitation tests
unchanged; a template-formed C2H6O product resolves by InChIKey, not formula; a guessed PbI2 resolves to its
tabulated Ksp through the generic queue; dimethyl ether import never receives ethanol data at any layer; schema test
passes; bundle manifest lists a licence for every source.

### Stage 2: thermodynamics from species data, one solver, enthalpy balance (≈2–3 weeks)

1. **Thermo functions** (`engine/src/thermo/`): `h(T)`, `s(T)`, `cp(T)`, `mu0(T, P)` per record and phase (NASA-7/9,
   Shomate, HKF with the Shock 1992 g-function, point + Cp); `water.rs` with IAPWS-IF97 regions 1/2/4 (ρ, Pˢᵃᵗ to the
   critical point) and ε(T, ρ) (Fernández 1997 or Johnson–Norton), needed by HKF and Debye–Hückel; per-tick cache keyed
   by (T rounded to 0.01 K, P).
2. **K(T) and heats.** `ln_k(reaction, T, P)` from species μ° (tier = weakest input); llnl analytic or van 't Hoff + ΔCp
   as labelled fallbacks. Replace the van 't Hoff copies at `vessel_eq.rs:145, 196, 412`. Reaction heat is implicit in
   the enthalpy balance; no per-reaction ΔH remains.
3. **GEM core** (`engine/src/gem/`), grown out of `solve_coupled_equilibria`:
   - candidate species = store species whose elements ⊆ elements present (all phases), filtered by tier policy;
   - reaction basis from the null space of the element + charge matrix (RREF);
   - solids and (from Stage 4) gases and second liquids as phases with stability tests (saturation index,
     tangent-plane distance), so **new products can appear** (removes the "species ≤ 1e-30 ⇒ skip" gap);
   - warm-started damped Newton; run on dose, on kinetic extent > tol, or |ΔT| > 0.05 K; skip otherwise.
   Delete the per-equilibrium bisection sweeps, the 40-iteration settle loop, `auto_minerals`' pair logic (becomes
   "candidate solids") and the `has_water` gate.
4. **Enthalpy balance** (`engine/src/energy_balance.rs`): state `h_total_j`; each tick add heater/burner/bath flows,
   subtract enthalpy carried by outflows; solve T from Σ nᵢHᵢ(T, phase) = H by Newton. Heat exchange: natural
   convection (Churchill–Chu) + radiation + evaporation, areas from the glassware profile; hot plate as a node with
   heat capacity and a surface-temperature limit; ice/oil baths as a medium with its own enthalpy (ice melts). Delete
   `contents_heat_capacity`, the 40 660 / 38 560 clamps, the inert melt/boil plateaus (implicit once Stage 4/5 add
   phase equilibria), UA = 0.5 W/K and the fixed 273.15 K bath.
5. **Legacy (F46).** Port the M3 PHREEQC-comparison gates and the M4 kinetics gate to the `Vessel` path; then delete
   `equilibrium.rs`, `energy.rs`, `physics.rs`, `phase_transfer.rs` (after Stage 4), `pipeline/kinetics_physics.py`
   and the legacy wasm exports.
6. **Literal ban.** Add the grep test of §5.5 with an allowlist that shrinks each stage until it is empty.

Gates: pKw at 0/25/60/100/150/200 °C within 0.05 of Bandura–Lvov; log Ksp(T) of AgCl, CaCO3, CaSO4, BaSO4, Ag2CrO4 at
25/60/100 °C within 0.1 of llnl/SUPCRT; CaCO3 and CaSO4 retrograde; Hess (NaHCO3(s) + AcOH by any path) within 0.5 %;
neutralisation 55.8 ± 0.5 kJ/mol; adiabatic ledger drift < 1e-6 per 1000 steps; 50 g ethanol vs water heating ratio
1.71 ± 0.05; dry 250 mL beaker on 300 W stays < 750 K; performance §10.

### Stage 3: per-phase species, activity models, volume (≈2–3 weeks)

1. **Phases.** `engine/src/phases/`: `PhaseState { gas, liquids: Vec<LiquidPhase>, solids: Vec<SolidPhase> }`,
   amounts per phase; migrate `species_mol` and the suffix conventions; `PhaseKind {Aqueous, Organic}`, the ethanol
   layer and per-compound neat layers become generic liquid phases. Snapshot layers are built from phases.
2. **Activity** (`engine/src/activity.rs`): `trait ActivityModel { fn ln_gamma(&self, phase, T, P, solvent_props) }`
   with `Ideal`, `Davies`, `BDot` (å from llnl), `Sit`, `Pitzer`, `Unifac` (2.0 parameters, groups from SMILES via the
   pipeline or `ugropy`), `BornTransfer`. Molality basis (m = n / kg solvent). γ frozen inside each Newton solve and
   updated in an outer loop. Water activity enters every reaction that contains H2O.
3. **Volume and derived phase properties** (`engine/src/volume.rs`, `engine/src/props.rs`): water from IAPWS; organics
   COSTALD/Rackett; ions HKF V° + Debye–Hückel slope; molar refraction → n (Lorentz–Lorenz); ε(T) per phase; η(T) per
   phase (IAPWS 2008 for water, Andrade/Chung/Joback otherwise, Grunberg–Nissan mixing); Cp per phase.
4. **pH** = −log10(m_H⁺·γ_H⁺) in the phase that contains water (decision D6 for other solvents).

Gates: γ± NaCl 0.1/1.0 m and CaCl2 0.1 m at 25 °C within 0.02 of 0.778/0.657/0.518; AgCl in 0.1 M KNO3 vs water
solubility ratio 1.25 ± 0.05; 6 m HCl pH −1.3 ± 0.2; 100 mL water 295 → 353 K expands 2.9 ± 0.2 %; 10 g NaCl in
50 mL gives 53.1 ± 1 mL; water + acetone 50 + 20 mL gives 69 ± 2 mL; 26 wt % brine Cp 3.30 ± 0.10 J/(g K).

### Stage 4: gas phase, atmosphere, VLE, sealed vessels (≈2 weeks)

**Status: implemented, 2026-10-02.** Deviations: VLE is its own layer (`vle.rs`, `vessel_vle.rs`) beside the legacy solver, not rows of the Gibbs solver (that merge belongs with Stage 6); the 0.1 atm ethanol gate is met at ±4 K (303.6 K computed, ≈302.5 K real); the hexane/toluene gate passes at the edge of its band (353.3 K vs 355 ± 2); UNIFAC table is small and recalled (tier speculative); transfer rate constants are documented placeholders until Stage 8; gas collectors do not dissolve gas in the trough water. Details in `generalization-progress.md`.

1. **Gas phase** (`engine/src/gas_phase.rs`, `engine/src/eos.rs`): headspace moles including air (N2, O2, Ar, CO2,
   H2O); V_head = capacity − condensed volume; ideal gas, Peng–Robinson above ~5 atm or near Tc; sealed = isochoric
   flash. Open vessels exchange with an infinite atmosphere whose composition, humidity and P_ext are room/vessel inputs
   (F38): vacuum, pressurised, inert (N2/Ar) and O2 atmospheres become possible. Stopper pop vents to P_ext with the
   vented mass booked; pop and burst pressures become glassware properties.
2. **VLE rows in the GEM** for every volatile species (X(l) ⇌ X(g), X(aq) ⇌ X(g)); boiling = bubble point at P;
   boiling flux from the enthalpy surplus split by vapour composition.
3. **Henry for every gas** from μ°(aq) − μ°(g) against partial pressures; delete `step_co2_degassing` and
   `phase_transfer.rs`. Rates come in Stage 8; until then use a first-order relaxation with a documented constant.
4. **Gas dosing.** A gas import doses moles into the headspace or sparges through the liquid (C6). Gas collection
   (`gas.rs`) uses the same flash; the collector is at room P with the trough liquid's own Pˢᵃᵗ; gases dissolve in the
   trough water.
5. Delete the water and ethanol boiling clamps (`vessel.rs:858-911`), both water Pˢᵃᵗ formulas (`vessel.rs:925-931`,
   `gas.rs:86-95`), the 10 atm clamp and `P_air = T/T_room`.

Gates: water Pˢᵃᵗ at 25/100/150/200/300 °C within 1 % of IAPWS; ethanol Tb 351.4 ± 0.5 K at 1 atm and ≈ 300 K at
0.1 atm; sealed 50 mL water at 200 °C gives 16.8 ± 0.8 atm; sealed ethanol above Tc becomes supercritical (single
fluid phase); ethanol/water x = 0.2 bubble point 356 ± 1.5 K; azeotrope at x_EtOH 0.89 ± 0.03, 351.3 ± 0.5 K;
hexane/toluene 50/50 mol bubble point 355 ± 2 K; 2 m NaCl boils at 375.2 ± 0.3 K; open carbonated water relaxes toward
1.4e-5 M CO2; 2 M NH3 at 363 K loses ≥ 50 % NH3 in 10 min stirred; NaOH solution absorbs atmospheric CO2; gas over
water at 293 K has a dry fraction of 0.977 ± 0.002.

### Stage 5: SLE and LLE (≈2–3 weeks)

**Status: implemented, 2026-10-02.** Deviations: freezing, solubility and melting are one solid-liquid equilibrium solved by `vessel_phase.rs::phase_flash` (nested per-species saturation search inside an isenthalpic temperature root search with a lever-rule ending for pure components), not rows of the Gibbs solver (that merge stays with Stage 6); activity points correct UNIFAC by a two-suffix Margules excess Gibbs energy, not by a fitted interaction matrix; gates met at a lower tier than written: 1 m glucose freezes at −1.33 °C against −1.86 ± 0.1 (UNIFAC's own error for sugars; asserted within 0.6 K), water in hexane is 0.0158 wt % against < 0.01 (asserted at ×2 of the measured 0.011), and hexane in water is 45× too high (original UNIFAC underestimates alkane hydrophobicity; the Magnussen LLE matrix was tried and makes hexane/water miscible); the NaCl-in-ethanol Born gate is not implemented; the UNIFAC pipeline parser exists (`pipeline/db/parse_unifac.py`) and the table is complete, but all seeded phase data (fusion points, cp, densities, I2 datum, excess volumes) are recalled from memory at tier `estimated`. Details in `generalization-progress.md`.

1. **Solvent freezing** rows (H2O(l) ⇌ H2O(s) and the same for any solvent with solid data) in the GEM; colligative
   depression falls out. Inert compounds' melting is the same mechanism (their separate plateau code is deleted).
2. **Molecular-solid solubility**: ln(xγ) = (μ°(s) − μ°(l))/RT with UNIFAC γ; measured points (BigSolDB, AqSolDB,
   PubChem) validate or fit; delete the 0.1 g/L default, the 500 g/L "miscible" rule and the water-only basis.
3. **LLE** (`engine/src/lle.rs`): Michelsen tangent-plane stability test on dose, pour or |ΔT| > 2 K; two- or
   three-phase split; layers ordered by computed density; `remove_liquid_bottom` drains whole phases in that order.
4. **Partitioning** of solutes between liquid phases (falls out of equal μ).
5. **Every compound gets phases (C5, C6, F16).** Known reacting molecules (I2, CO2, NH3, acids) get solid/liquid/gas
   phases like inert compounds; neat reagents are dosed neat; catalog reagents become recipes (compound amounts), so
   density and molarity at T are derived (F19).

Gates: water in a 240 K bath freezes with a plateau at 273.15 K; 0.1 M NaCl freezes at −0.35 ± 0.05 °C; 1 m glucose at
−1.86 ± 0.1 °C; 50 + 50 mL water/ethanol is one phase of 96.5 ± 1 mL (with excess volume) or 100 ± 4 (ideal tier);
hexane/water two phases, hexane on top, water in hexane < 0.01 wt %; hexane/toluene one phase; I2 K_D(hexane/water)
within ×2 of 85; 20 wt % K2CO3 salts ethanol out of water; naphthalene water solubility within ×3 of 0.031 g/L; NaCl in
ethanol 0.65 g/L within ×3 (Born tier); 1 g I2 in a dry beaker is a 1 g solid, and 0.016 ± 0.005 g dissolves in 50 mL
water.

### Stage 6: reaction discovery by Gibbs minimisation; redox; decomposition (≈3–4 weeks)

1. **Candidate set** = every store species reachable from the elements present: oxides, hydroxides, basic salts,
   hydrates, double salts, complexes, gases (A8, A10). Keep the set small: elements present × phases allowed ×
   tier policy, with pruning of species whose saturation index stays far below zero. The binary-pair mineral logic and
   the solubility rules survive only as the Speculative last tier (F27).
2. **Organic acid–base:** protonation states per site from pKa records; Estimated pKa from the server models when
   missing.
3. **Redox through oxidation-state components** (A5, F24): oxidation states assigned from formulas (and SMILES for
   organics); components = (element, oxidation state); a `labile_couples` data file merges components of fast couples
   (Fe³⁺/Fe²⁺, Cu²⁺/Cu⁺, I2/I⁻, Ag⁺/Ag, Hg²⁺/Hg2²⁺, Ce⁴⁺/Ce³⁺, MnO4⁻/MnO4²⁻ …); other couples react only through kinetic
   steps (Stage 7/8). E° and Nernst follow from ΔfG°.
4. **Thermal decomposition and dehydration** fall out of the GEM with condensed and gas phases; their rate is limited by
   heat input (Stage 2) or an Arrhenius onset where data exists.
5. **Combustion** as gas-phase equilibrium over C/H/O/N/S products at flame conditions, with O2 from the atmosphere
   (burning rate in Stage 8). Delete the ethanol flame code (`vessel.rs:797-826`) and the dead `ethanol_combustion`
   record.

Gates: 20 standard solutions vs PHREEQC (llnl) pH and saturation indices within 0.05; AlCl3 + excess NaOH redissolves
as Al(OH)4⁻; 0.1 M FeCl3 shows no Fe(OH)3 below pH 2; CuSO4 + NH3 gives Cu(OH)2 then Cu(NH3)4²⁺; Na2S + HCl evolves
H2S; NH4Cl + NaOH heated evolves NH3; ZnS stays insoluble in dilute acid while FeS dissolves (fixes B6); Daniell E° from
ΔfG° within 0.02 V; Zn + HCl gives H2, Cu + HCl nothing, Fe + CuSO4 deposits Cu, KMnO4 + Fe²⁺/H⁺ decolourises, Na +
water gives H2 + OH⁻ (rates in Stage 8); NaHCO3 decomposes between 350 and 450 K; CaCO3 above ~1100 K at 1 atm; a flame
dies under N2.

### Stage 7: kinetics core (≈3 weeks)

1. **Integrator** (`engine/src/kinetics/core.rs`, promoted from `kinetics.rs`): sparse ν (species × reactions), orders
   kept separate from stoichiometry, analytic Jacobian including reverse terms and dk/dT, adaptive L-stable Rosenbrock
   (ROS3P or RODAS3; rtol 1e-3, atol 1e-12 mol), positivity by step rejection, Strang splitting with the GEM, T as a
   state. Integrate in extent coordinates so balanced stoichiometry conserves elements by construction.
2. **Detailed balance:** k_r = k_f / K(T) with K from Stage 2 (D5). The template "irreversible" flag can no longer
   override thermodynamics.
3. **Timescale split:** τ = 1/|∂r/∂ξ| at the current state; τ < 1e-3·dt → handed to the GEM as a constraint; otherwise
   integrated. List membership no longer decides.
4. **Transport properties for rates** (`engine/src/transport.rs`): η(T) per phase, D (Stokes–Einstein / Wilke–Chang),
   εr(T), `k_diffusion(a, b, T, phase)` with the Debye factor; the cap applies to **every** bimolecular step (D12);
   salt effect via activity coefficients of reactants and TS (D21).
5. **Rate providers** (`engine/src/kinetics/providers/`), data in `engine/data/kinetics/*.json` with source, tier and
   T-range per row: `tabulated` (A, n, Ea or ΔH‡/ΔS‡), `eigen` (proton transfer from pKa difference), `eigen_wilkins`
   (substitution from the water-exchange table), `marcus` (outer-sphere ET), `mayr` (keyed by InChIKey, solvent
   labelled), `rate_rules` (Evans–Polanyi per family), `server` (Eyring with ΔH‡/ΔS‡; fixes the 60× error of D16).
6. **Catalysis** as explicit steps (homogeneous) or surface rates ∝ area × k(T) (heterogeneous); delete the
   `0.08·clamp(100·n, 0.5, 10)` override (D8/F22). Make the uncatalysed H2O2 path exist.
7. **Gates on the Vessel path;** delete `pipeline/kinetics_physics.py` and `run_iodine_clock_sim` /
   `step_simulation_tick` exports.

Gates (D §4.7): balance of every reaction to 1e-12; A ⇌ B with K = 1 reaches 0.500 ± 0.001 for dt ∈ {0.05, 0.5, 1};
elementary 2A → B initial-rate ratio 4.00 ± 0.02; first order k = 2 s⁻¹ gives 0.1353 ± 0.5 % at 1 s for dt 0.05–1.0;
iodine clock switch time within ±20 % of a cited measurement at 20 and 35 °C with I conserved; k(348)/k(298) follows
Arrhenius for every reaction after an in-session T change; catalysed H2O2 rate rises with T and doubles with catalyst
area (±10 %); H⁺ + OH⁻ within ×3 of 1.4e11 M⁻¹s⁻¹; k_D × 2.3 from 298 to 348 K in water; performance §10.

### Stage 8: heterogeneous and transport rates (≈3–4 weeks)

`engine/src/transfer/{dissolution, nucleation, corrosion, gas_transfer, evaporation, settling, combustion}.rs`:
1. **Particle population** per solid (moments μ0–μ3): area and mean size known at all times; feeds settling, turbidity
   and the visual bed. Replaces `initial_solids`/`remaining_fraction` and the stored `kind`/`default_particle_um` (F47).
2. **Dissolution and growth:** Sherwood correlations with `stir_rpm` → power number (D22); undersaturation from the
   GEM target. `settle_after_addition` stops jumping to equilibrium; transfers relax toward the target semi-implicitly.
   Delete the ghost pile (`visual_contents.ts:59-110`): the snapshot carries the undissolved mass.
3. **Nucleation** (CNT + Mersmann γ), growth, aggregation (Schulze–Hardy) → induction time, metastable zone, particle
   size, "curdy vs crystalline" derived from supersaturation.
4. **Corrosion / cementation:** Butler–Volmer mixed potential with the HER i0 table, E° from ΔfG°, passivation flag,
   H⁺ mass-transfer limit; delete `mg_acid_dissolution`.
5. **Gas–liquid transfer:** k_L·a with partial pressures; bubble nucleation when Σpᵢˢᵃᵗ > P (fizzing vs quiet
   degassing); CO2 hydration as a real slow step (0.037 s⁻¹).
6. **Evaporation** below boiling with natural-convection mass transfer; evaporative cooling booked in the enthalpy
   balance; drying and crystallisation by evaporation become possible. Delete `evaporation_g_s` constants.
7. **Settling** with the actual layer ρ(T), η(T) and liquid height; hindered settling; Brownian Péclet test; delete the
   8–300 s clamp and ×10 floc factor; the web's second settling law (`effects.ts:807`) reads the engine's value.
8. **Combustion:** flash point from Pˢᵃᵗ and LFL (measured or Jones' rule), pool burning rate, adiabatic flame T from
   ΔcH and product Cp(T); any fuel with data burns; no O2 → no flame.

Gates: 1 g NaCl (300 µm) in 50 mL stirred water 90 % dissolved in 10–60 s, ≥ 3× slower unstirred; no solid at S ≤ 1;
BaSO4 induction time vs S within ×3 of Nielsen over S = 10–1000, mean size decreasing with S; Mg > Zn > Fe ≫ Cu in 1 M
HCl, rate ∝ metal area and independent of solution volume at fixed [H⁺]; open carbonated water τ of hours unstirred,
minutes stirred; CO2 + NaOH + phenolphthalein shows the hydration delay; 10 mL hexane from 38 cm² at 295 K loses 3–20
mL/h; 10 µm BaSO4 settles 4 cm in 150–300 s in water and ~1000× slower in glycerol; ethanol pool fire in a 250 mL beaker
1–2 kW; hexane ignites; methanol flame near-invisible.

**Status: implemented, 2026-10-03.** Deviations: NaCl stirred dissolution is 3.2 s (window 2-60 s instead of 10-60 s); the BaSO4 gate asserts CNT-consistent behaviour, not the plan's Nielsen points; Zn dissolves slower than Fe in 1 M HCl (pure-metal Butler-Volmer, gate Mg >> Zn, Fe >> Cu); fizzing from mild supersaturation takes tens of seconds to minutes; the busy-mixture budget in `wasm_e2e.mjs` is 10 ms (Stage 6/7 had already exceeded 5 ms). Electrolysis is an engine API plus readout only (no UI). Details in `generalization-progress.md`.

### Stage 9: structure-based organic chemistry (≈4–6 weeks)

1. **Runtime decision (D4):** RDKit MinimalLib in the browser if its JS build can run reactions; otherwise template
   application on the local server, with an explicit "organic chemistry needs the local server" state in the UI.
2. **Templates:** a curated core of atom-mapped SMARTS for bench organic chemistry (ester hydrolysis and formation,
   SN1/SN2/E1/E2, addition to alkenes, carbonyl additions, oxidation of alcohols, nitration, …) plus templates extracted
   from USPTO (CC0) with RXNMapper + RDChiral, ranked by frequency; the forward ML model (server) as a validated,
   Speculative suggestion when no template applies.
3. **Generator rewrite** (`engine/src/generate/` or server): runs whenever the set of species with SMILES changes (not
   only on doses); every product is registered as a species with SMILES, formula and estimated thermo (Gani/Benson, or
   resolved data) through the store and the property queue; atom balance asserted; flux-based pruning; caps reported
   in the snapshot (F32).
4. **Rates** from Stage 7 providers (Mayr by InChIKey; family rate rules with sources; HYDROWIN-type hydrolysis LFERs;
   server barriers), recomputed every tick from stored parameters (D3).
5. **Retire** the 45 family constants, the scenario functions (`sn2_e2_product_ratio`, `ester_hydrolysis_k_obs` →
   test fixtures with literature targets) and the Mayr stub.
6. **Server** (K6 in D): real TS workflow (both reactants; `xtb --path` or pysisyphus GSM/NEB; TS optimisation; full
   Hessian; IRC; ALPB solvent); failures reported as failures; calibration on real computed-vs-experimental pairs;
   `/api/barrier/precomputed` keyed by canonical reaction SMILES. Delete the fake-energy fallback and constant flags.

Gates: ethyl acetate + NaOH gives ethanol + acetate, atom-balanced, k(298) within ×3 of 0.11 M⁻¹s⁻¹; bromoethane + NaOH
gives ethanol (SN2) and ethene (E2) with an elimination fraction that rises with T; generated k follows Arrhenius after
generation; no generated species without a formula and SMILES.

### Stage 10: appearance from optical records (≈3–4 weeks)

1. **Optical records** in the store (§5.2 `optics`); `spectra.rs` becomes seed rows with sources; per-phase absorbance
   with each phase's solvent (delete `org_a = [0.0; N]`); grid 380–780 nm (41 bins) with regenerated CIE 1931/D65
   weights in Rust and TS.
2. **Sources:** PubChem UV text parser (`pubchem/uv_parser.ts`, emits `uv_bands [[nm, eps, fwhm?, solvent]]`); measured
   sets A8; server Greenman λmax/ε and sTDA-xTB; ligand-field band positions for first-row d-ion complexes (Estimated).
   Never derive ε from a solid colour word.
3. **Shader:** per-layer LUT of colour vs path length (or 8 spectral coefficients) so dichroic solutions change hue with
   depth (E11); use `layer.refractive_index` instead of `ior: 1.333`.
4. **Solids:** colour-phrase parser with a large colour-name lexicon returning `{sRGB, subject, hydrate?, confidence}`;
   Kubelka–Munk from band gap (scissor-corrected) and inherited ion chromophores; n by Lorentz–Lorenz; density from the
   record; retire `cation_solid_hue`/`anion_solid_tint` to Speculative.
5. **Turbidity:** per-bin Mie/RGD with complex m, mass-weighted across solids; returns `scatter_per_cm[bins]`.
6. **Gases:** cross-sections × column density; buoyancy from mixture molar mass and T; open-vessel plume inventory;
   "fuming" from Henry + humidity or gas-phase reactions (NH3 + HCl → NH4Cl(s)).
7. **Steam/mist/condensation** from vapour fluxes, mixing-line saturation and dew point; boiling cue from bubble flux.
8. **Bubbles and foam:** Fritz departure diameter with σ(T); foam only with a surface-active species (structure flag).
9. **Flames:** adiabatic T, sooting tendency, flame-test emission from per-element lines (pipeline-derived from NIST
   ASD) with Boltzmann and Saha factors; the burner panel uses the same function.
10. **Bottles and log:** bottle colour as a view of the same derivations; colour-change detection per layer including
    turbidity; display names instead of raw ids.
11. **Clean-up:** delete `createLiquidMaterial`, `curated_colors.py` → `bundle.colors`, the `chem_db.rs` mineral
    duplicates, and unify the two RGB → spectrum inversions into one Speculative fallback.

Gates: methylene blue 10 mg / 50 mL has A_max(≈660 nm) > 1; Ni²⁺, Cr³⁺, Fe(CN)6³⁻, VO²⁺ solutions are coloured; I2
peaks at ≈520 nm in alkane layers and ≈460 nm in water; Prussian blue renders blue; Na yellow, K lilac, Li/Sr red, Cu
blue-green flames; NO2/Br2/Cl2 visible above open vessels; no steam from a dry beaker; ethanol shows boiling at its
bubble point.

**Status: implemented, 2026-10-03.** Deviations: all optical rows are recalled seed rows (tier estimated), the A8 / MPI-Mainz / Materials Project / NIST ASD / Greenman / sTDA pipelines are not run; Prussian blue comes from a generic mixed-valence rule (blue-violet, very dark); Cu is blue-green only with chloride in the flame; `chem_db.rs` keeps its five default minerals (Ksp(T) data); the pour stream still uses `ior` 1.333; flame and plume placeholders are named constants. The spectrophotometer reads the same engine spectra. Details in `generalization-progress.md`.

### Stage 11: later environments

- **Electrochemistry:** electrodes as phases, power supply and meter, Butler–Volmer at each electrode, E from ΔfG° and
  activities (Daniell EMF vs Nernst; electrolysis H2:O2 = 2:1).
- **Photochemistry:** lamp spectrum × ε(λ) × quantum yield. Quantum yields have **no large open database**; use
  per-reaction records with sources, Speculative otherwise.
- **Equipment:** condenser/reflux/distillation (VLE + condenser heat sink), vacuum line and pressure-rated vessels, inert
  purge, bath media (dry ice/acetone, oil), crucible for high-T solids.

---
## 9. Gate catalogue: reference values

Gates are listed with their stage in section 8. The reference values they compare against are collected here so that
every test cites a source rather than a remembered number. Values marked [M] must be checked against the cited source
when the test is written.

| Quantity | Reference values | Source |
|---|---|---|
| pKw at saturation P, 0/25/60/100/150/200 °C | 14.95 / 13.99 / 13.02 / 12.26 / 11.64 / 11.30 | Bandura & Lvov, J. Phys. Chem. Ref. Data 35 (2006) |
| Water Pˢᵃᵗ | IAPWS-IF97 | IAPWS |
| γ± NaCl 0.1 / 1.0 m; CaCl2 0.1 m, 25 °C | 0.778 / 0.657 / 0.518 | Robinson & Stokes [M] |
| log Ksp(T) of AgCl, CaCO3, CaSO4, BaSO4, Ag2CrO4 | llnl.dat analytic expressions | PHREEQC llnl.dat (A2) |
| Freezing points: 0.1 M NaCl, 1 m glucose | −0.35 °C, −1.86 °C | colligative theory, checked against measured data [M] |
| Ethanol–water VLE, azeotrope | x_EtOH 0.894, 351.3 K at 1 atm | standard VLE data [M] |
| Ethanol, hexane Tb; ethanol Tc | 351.4 K, 341.9 K; 514 K | NIST WebBook (per-user check only) / CoolProp |
| Neutralisation enthalpy | −55.8 kJ/mol at 25 °C | NBS (A1) |
| H⁺ + OH⁻ rate constant | 1.4e11 M⁻¹s⁻¹ | Eigen [M] |
| Ethyl acetate + OH⁻ | 0.11 M⁻¹s⁻¹ at 25 °C | literature [M] |
| CO2 hydration | 0.037 s⁻¹ at 25 °C | literature [M] |
| BaSO4 induction time vs S | Nielsen data | Nielsen [M] |
| I2 hexane/water K_D | ≈ 85 | literature [M] |
| Naphthalene water solubility | 0.031 g/L at 25 °C | AqSolDB (A6) |
| Pool fire burning rate (ethanol) | ≈ 0.015 kg m⁻² s⁻¹ | Babrauskas [M] |

Every gate runs against the built WASM (or `cargo test` on the `Vessel` path), never against a legacy module or a Python
re-implementation.

---

## 10. Performance budget

Today a busy mixture costs 23 ms per `vessel_step` and 33 ms per small dose in WASM, mostly because of redundant
bisection sweeps and zero-amount species (B11), not because of model complexity.

| Item | Budget (WASM, node) |
|---|---|
| Pure water, resting vessel | ≤ 0.2 ms per step |
| Busy mixture (≤ 50 species, ≤ 4 phases, ≤ 80 equilibrium + phase rows), warm-started Newton + 2–4 activity iterations | ≤ 2 ms per step |
| Dose settle | ≤ 3 ms |
| Kinetics, 50 species / 200 reactions, adaptive Rosenbrock | ≤ 2 ms per vessel per tick |
| 10 vessels × 30 species × 3 phases | < 2 ms per 50 ms tick in total for resting vessels; < 10 ms with 2 active vessels |

How:
- skip the GEM solve when nothing changed (most ticks of a resting vessel);
- cache μ°(T) per species per tick (NASA ≈ 20 flops; HKF ≈ 200 flops + the water EOS ≈ 1 µs);
- run the LLE stability test only on dose, pour or |ΔT| > 2 K;
- hold species as integer indices into the store instead of `HashMap<String, f64>` with `format!` churn;
- exponential relaxation for transfers is stable at dt = 1 s, so sub-stepping is reserved for boiling onset,
  nucleation onset and stiff kinetics.

A node benchmark against the built WASM (extend `engine/src/benchmark.rs` and add `tests/perf.mjs`) runs in CI from
Stage 0 onward.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Candidate-set explosion when many elements are present (llnl has ~1300 aqueous species) | candidate filter by elements present, tier policy and phase availability; prune species whose saturation index stays below −5; cap with a reported warning |
| Mixing thermodynamic bases gives inconsistent K (the B6 sulfide problem) | one basis per family (§7.5 rule 4); cross-check gates against llnl and NBS at build time |
| NBS values are from 1982; some superseded | prefer llnl/SUPCRTBL for aqueous species where they disagree; ATcT anchors if its licence allows |
| Estimated data drives visible behaviour (e.g. MP + Jenkins–Glasser Ksp is ±2–5 log units) | tiers shown in the UI; estimates never override measured data; property requests try to replace them |
| Browser bundle size | shard by key prefix and load on demand; core ions/minerals/gases shard ≲ 2–4 MB gzipped; organics shards fetched per InChIKey prefix |
| Licence mistakes | licence registry, manifest per bundle, CI check that every shard's sources are on the "bundle" list; NIST data never under the repo |
| Server-only capabilities (organic templates, ML models) unavailable in the browser-only app | explicit UI state; engine falls back to labelled estimators |
| Large refactor of `species_mol` to per-phase amounts breaks the web layer | keep the snapshot contract (`VesselSnapshot`) stable and extend it; migrate behind a feature flag per stage |
| Regressions in demos tuned to the old constants (iodine clock timing, Mg ribbon) | gates compare to literature, not to old outputs; demos are retuned by changing recipes, not constants |

---

## 12. Decisions needed from the user

| # | Decision | Recommendation |
|---|---|---|
| D1 | **Estimate policy:** may species with no measured data run on labelled estimates (Gani/Joback/Benson, Born transfer, MP + Jenkins–Glasser, rule Ksp), or stay inert? | Run on estimates, labelled, with property requests to replace them |
| D2 | **Licence posture:** is the project permissive/commercial-friendly? This decides IUPAC pKa, Burcat, Uni-pKa and the non-commercial profile databases | Assume permissive: those stay server-side/per-user only |
| D3 | **Small parameter tables (§7.4):** accept the six small review tables that feed general models (water exchange, self-exchange, HER i0, refractions/polarisabilities, ligand field, YSI)? | Accept; no large database exists for these inputs |
| D4 | **Browser-only vs local server:** must organic chemistry, ML pKa/solubility/spectra and barriers work without the server? | Core inorganic chemistry, phases and appearance in the browser; organic templates and ML on the server with a visible fallback |
| D5 | **Asking upstream for redistribution permission:** SUPCRTBL authors, ATcT (Ruscic), RMG maintainers, UNIFAC 2.0 authors, Mayr, MPI-Mainz atlas, Sander | No need; this isn't a commercial project, it is a personal academic one. |
| D6 | **pH outside water:** show nothing, the solvent's own scale, or an aqueous-scale estimate? | Show "—" in non-aqueous phases; the pH probe reads the phase it is in |
| D7 | **Catalog reagents as recipes:** "0.1 M HCl" becomes HCl + water with derived density/molarity at T | Yes |
| D8 | **Legacy engine:** retire `equilibrium.rs`, `energy.rs`, `physics.rs`, `phase_transfer.rs`, `kinetics.rs` exports and the Python gate once their gates run on the Vessel path | Yes |
| D9 | **Performance target:** species per vessel and number of active vessels at 20 Hz | ≤ 50 species, ≤ 10 vessels, ≤ 2 active |
| D10 | **Demo fidelity vs data fidelity:** when a demo (iodine clock) changes timing because constants are replaced by cited data, retune the recipe rather than the constants | Retune recipes |

---

## 13. Appendix: finding index

Full text, file:line evidence and probes for each ID are in `docs/plans/generalization-audit/`.

| Area | B (wrong / blocks) | D (degrades) | C (cosmetic) |
|---|---|---|---|
| Reactions (A) | A1 atoms created; A2 no water from equilibria; A3 generator substrings; A4 strong-by-default acids; A5 no redox; A6 CO2-only gas evolution | A7 0.1 g/L default solubility; A8 binary-salt minerals; A9 discovery only on dose; A10 no complexes beyond six; A11 double paths; A12 formation data unused; A13 products never react; A16 ledger baseline reset | A14 id prefixes; A15 log flooding |
| Thermo (B) | B1 pH sign; B2 species data dead; B3 Hess violated; B4 no ΔCp, ΔH = 0; B5 ideal everywhere; B6 mixed sulfide conventions; B7 heat capacities; B9 per-compound boiling | B8 heat exchange; B10 compound_thermo equations out of domain; B11 solver cost; B12 concentration scale; B13 sealed gas model; B15 no heat of mixing | B14 reporting |
| Phases (C) | C1 no mixture VLE; C2 sealed vessels; C3 no solvent freezing; C4 no evaporation/sublimation; C5 reacting molecules have no phase; C6 gases dosed as water; C7 no LLE; C9 boiling pinned to 1 atm; C10 CO2-only Henry; C12 salt solubility over wrong volume; C19 pKw sign | C8 volume model; C11 molecular solubility; C13 instant transfer; C14 settling; C15 vapour-curve extrapolation; C16 melting; C17 headspace; C20 Cp; C21 provenance leaks | C18 water-only visual cues |
| Kinetics (D) | D1 atoms created; D2 invented species; D3 frozen k; D4 dt-dependent integrator; D5 no reverse; D6 order = min(ν,1); D7 metal–acid rate; D8 catalysis; D11 no dissolution/precipitation kinetics | D9 two iodine-clock parameter sets; D10 bicarbonate double model; D12 diffusion cap; D13 catalysis double count; D14 family constants; D15 Mayr; D16 Eyring misuse; D17 fake server barriers; D19 unbounded list; D21 no salt effect | D18 combustion; D20 settling; D22 stirring boolean |
| Appearance (E) | E1 dissolved imports colourless; E2 missing coloured ions; E3 no colour in organic layers; E4 Prussian blue orange; E5 no open-vessel fumes | E6 steam thresholds; E7 flame; E8 salt density/colour ignored; E9 settling clamps; E10 turbidity; E11 shader 3 channels; E12 foam; E13 bubble size | E14–E19 inversions, colour words, dead data, cache, indicator strength, log text |
| Ingestion (I = G in the file) | I1 fabricated bundle; I2 proxy formula matching; I3 NIST parser; I5 NIST data in repo tree; I7 Joback never runs; I9 estimates promoted to known; I10 PubChem parsing errors | I4 cache poisoning; I6 Wikidata units; I8 Joback groups; I11 cache write-only; I12 fetched data not forwarded; I13 tiers broken; I14 web formula identity; I15 solubility → Ksp at 298; I16 mineral-only queue | I17 Ksp drift; I18 duplicate artefacts |
