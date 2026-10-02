# Generality Audit: hardcoded assumptions that limit the simulator

## Task

The simulator must be a *general* chemistry simulator:
- any temperature and pressure (open, sealed, pressurised, vacuum)
- aqueous, non-aqueous and mixed solvents (ethanol, acetone, DCM, ether, DMSO, ionic liquids)
- neat melts and the gas phase
- high ionic strength and extreme pH
- redox, electrochemistry, photochemistry, catalysis and surfaces
- controlled atmospheres (inert, O2, CO2)
- micro to macro scale, and arbitrary heating/cooling profiles

This document lists every hardcoded assumption found that limits that goal, and proposes a target architecture and a
staged roadmap.

### Governing design invariant (from the project's CLAUDE.md, "Design invariants")

> The simulation relies as much as possible on **intrinsic** per-compound values: standard enthalpy and entropy of
> formation, heat-capacity parametrisation, molar mass, molecular structure, acid dissociation constants at a reference
> state, standard potentials, and solvation / activity parameters. **Condition-dependent** quantities (melting/boiling
> point, vapour pressure, solubility, density at T, pH, state of matter) are *derived* with equations and models from
> the vessel's T, P, composition and solvent. A condition-dependent value is never stored as a compound property. If a
> source only offers one, it is stored as a labelled *point on a curve*. Phase is never stamped at import. Estimates
> carry a provenance tier.

Every finding below is tagged against this invariant (column **Inv**):
- **CV**: a condition-dependent value stored or hardcoded as if it were intrinsic. This directly violates the invariant.
- **RS**: legitimate reference-state data, carried to other conditions wrongly or not at all (e.g. ΔH = 0, no ΔCp,
  water-only, a reaction-level value where species-level data would keep Hess's law consistent).
- **EN**: an environment (T, P, atmosphere, solvent, scale) hardcoded instead of being a vessel input to a model.
- **ST**: structural or logic issue, not about stored data.

### Method

- Read `engine/src/*.rs`, `engine/data/solubility.json`, `pipeline/*`, `server/*` and the physics-relevant parts of
  `web/src` (app/, pubchem/, bench/, types/).
- Ran probe scripts with node against the built WASM in `web/src/wasm/engine`. Results are quoted as "Probe:".
- Line numbers are for the working tree on 2026-10-01. `compound_model.rs`, `solubility.rs`, `lib.rs`,
  `web/src/pubchem/*` and `web/src/types/*` were being edited concurrently (compound/phase refactor, see
  `COMPOUND_PHASE_PLAN.md`), so their lines may shift.

Severity: **B** = blocks the environment or gives silently wrong results. **D** = degrades accuracy or generality.
**C** = cosmetic or visual only.

---

## 0. Headline

1. **Condition-dependent values are stored everywhere as if intrinsic**, which violates the invariant directly:
   - boiling at 373.15 K, a constant ΔHvap and water's heat capacity for every liquid
   - Ksp at 298 K, with ΔH = 0 for 92 of 128 minerals
   - fixed densities (water 1.0, ethanol 0.789) and a fixed refractive index of 1.333
   - a 3 mol/L solubility cap, Kw = 10^−14 (and pOH = 14 − pH), CO2 Henry 0.034 M/atm
   - phase stamped at import (`form: "solid" | "solution"`)

   Section 2 is the full ledger. The intrinsic data the invariant asks for (ΔfH°, S°, Cp(T) per species) exists in
   `get_species_thermo` only as a 60-entry static match, and **the engine never reads ΔfH or Cp from it**.
2. **Water is not a solvent model. It is the species id `"H2O"`, special-cased in about 20 places.** Liquid volume is
   `n(H2O)·18.015 mL`. Mineral solubility only runs if `has_water`. Ethanol is a second special id (`"C2H5OH"`) that
   always forms its own layer.
3. **The bench engine (`vessel*.rs`) and the documented M3/M4 engine are different code.** Davies activities, Kw(T),
   the Rosenbrock integrator and the energy balance live in `equilibrium.rs`, `kinetics.rs`, `energy.rs` and
   `physics.rs`, which the `Vessel` does not use. The bench runs ideal concentrations and explicit-Euler, forward-only
   kinetics.
4. **The conservation audit on the bench is fake.** `snapshot()` hardcodes `ok: true` and fixed error numbers
   (vessel.rs:1060-1065). `initial_elements` stores species, not elements, and nothing reads it (vessel.rs:1213-1217).
5. **The M6 network generator makes up chemistry for inorganic ions.** It runs on every addition (vessel.rs:433→330)
   and classifies species by substring of the id (network_generator.rs:322-324). It always produces `Br-` (line 345).
   Probe: NaOH + NaCl gives `Cl- + OH- -> -_subst + Halide-`, and the vessel then holds `Br-` and `-_subst`. Carbonate
   gives a `CO3-2_enol_enol…` chain.
6. **There is no gas phase or atmosphere, and no external pressure.** An open vessel is forced to P = 1 atm. Henry's law
   exists only for CO2, and it uses total pressure, not the CO2 partial pressure.
7. **Identity is a formula string, not a structure.** Probe: dimethyl ether is modelled as **ethanol**, methyl formate
   as **acetic acid**.

Probe summary (built WASM):

| Scenario | Result | Reality |
|---|---|---|
| 50 mL ethanol, open, 200 W, 300 s | T = 522 K, 50 mL liquid left | boils at 351 K |
| 50 mL water + 50 mL ethanol | two layers (aqueous 50, organic 50) | one miscible phase |
| 50 mL water in a 240 K bath, 1000 s | liquid at 241 K | ice |
| 5 g dry NaHCO3, heated to 690 K | unchanged, and reports **10 mL liquid** | decomposes |
| sealed water, 400 W | pops at 2.2 atm, then clamps at 373.15 K | superheats while sealed |
| import "6 M HCl" | pH 0 (clamped) | about −0.8 |
| import H2SO4 (liquid, ρ 1.84) | 0.1 M aqueous solution | neat liquid |
| import acetone / CH4 / Na / Zn | `modelable: false` (visual-only) | solvent / gas / reactive metals |
| 0.5 µL 0.1 M AgNO3 + 0.5 µL 0.1 M NaCl in 10 µL water | no AgCl | precipitate |

---

## 1. Prioritised findings

Columns: ID, Inv, Cat (category from the brief), Location, Assumption, What breaks (example), Sev, Replacement
direction. Categories: 1 solvent = water; 2 fixed ambient; 3 per-compound tables; 4 reaction sources;
5 thermodynamics; 6 transport; 7 caps/structure; 8 data flow.

### P0: wrong results today, or blocks whole environment classes

| ID | Inv | Cat | Location | Assumption | What breaks (example) | Sev | Replacement direction |
|---|---|---|---|---|---|---|---|
| F1 | ST | 4 | network_generator.rs:230, 322-324, 345, 388-389, 424-425; vessel.rs:329-364, 433 | Families match on id substrings ("Cl", "OH", "I", "CO", "ene", "acetate"). Products are formula-less | Cl→Br alchemy, `-_subst`, enol chains on CO3-2 | B | Structure matching (SMARTS on SMILES). Products must have formulas, with an atom-balance check. Disable in the bench until then |
| F2 | ST | 8 | vessel.rs:262, 1060-1065, 1213-1217 | Conservation info is constant. The element ledger is never read | Alchemy (F1) and mass deletion (F17) go unreported | B | Real per-tick element, charge and enthalpy ledgers |
| F3 | CV | 1 | vessel.rs:1113-1122 | Volume = n(H2O)·18.015 mL (water density 1, solutes take no volume). Fake 10 mL when no water | Probe: dry solid shows 10 mL. Neat liquids and melts have no volume | B | V = Σ nᵢ·V̄ᵢ(T, x) from molar-volume models (Rackett/COSTALD from Tc, Pc, ω) |
| F4 | CV | 1 | vessel.rs:483-487, 535-543, 941-949, 1019, 1124-1127 | `"C2H5OH"` is the only organic phase: always separate, ρ 0.789, n 1.361 | Probe: ethanol + water forms two layers. No other solvent can exist | B | Liquid phases computed from components + activity model, with a stability test (LLE) |
| F5 | CV | 2/5 | vessel.rs:840-867, 1041; energy.rs:4-5 | Boiling = 373.15 K clamp for H2O only, ΔHvap 40660 constant, open vessels only | Probe: ethanol reaches 522 K. No elevation, no reduced-pressure boiling, no superheat when sealed | B | Bubble point Σ γᵢxᵢPᵢˢᵃᵗ(T) ≥ P. Pˢᵃᵗ(T) from μ°(g) − μ°(l) built from formation data. Latent heat = H_g(T) − H_l(T) |
| F6 | EN | 2 | vessel.rs:193-204, 285, 577, 871-873, 898, 906, 912 | Open: P = 1 atm. Sealed: 1 + p_sat(H2O) + evolved gas. Air not heated, no O2 | No vacuum or pressurised vessel. A sealed flask of air does not pressurise on heating | B | Gas phase with its own composition, volume and equation of state. P_ext and atmosphere are vessel/room inputs |
| F7 | CV | 2/3 | vessel.rs:634-659 (640), 745-765; phase_transfer.rs:4, 28-35 | CO2-only Henry k_H = 0.034 M/atm (ΔH −20 kJ, T clamped 273-400 K), driven by total P. Other gas products leave instantly | Open beakers keep 0.034 M CO2 (air equilibrium ~1.4e-5 M). NH3, SO2, Cl2, O2 never exchange | B | k_H(T) for every species from μ°(aq) − μ°(g). Partial pressures from the gas phase. Rate limited by kLa |
| F8 | CV | 5 | vessel.rs:404-405, 423, 451-452, 816-817; energy.rs:60-61; physics.rs:5-6 | Cp of all contents = 4.184 J/g/K. Glass factor 0.84 in `dose` but 0.84×0.15 in `step` | Ethanol, oils, melts and dry solids heat at the wrong rate. Mixing temperatures are wrong | B | Enthalpy balance H = Σ nᵢHᵢ(T, phase) from Cp(T) parameters. Solve for T |
| F9 | RS | 5 | chem_db.rs:172-257; vessel_eq.rs:142-146, 194-196, 410-412; vessel.rs:767-768 | K and heat from per-reaction `log_k_298` + constant `delta_h_kj`. Species ΔfH/Cp never read. Fallback ΔfH −100, Cp 50 | Inconsistent Hess cycles. K(T) wrong far from 298 K (no ΔCp). Arbitrary heats for new species | B | ln K(T) = −ΔrG°(T)/RT with ΔrG° = ΔrH°(T) − TΔrS°(T) from species formation data. Reaction-level records are only a labelled fallback |
| F10 | ST | 4 | vessel.rs:661-780 | Explicit Euler, forward only (`is_reversible`, `k_eq_298` ignored). Order = min(coeff, 1). Rate on total liquid volume | Reversible reactions run to completion. 2nd-order rate laws are wrong | B | Reverse via detailed balance with K(T) from F9. Stiff integrator (reuse the Rosenbrock code). Real rate laws |
| F11 | CV | 4 | vessel.rs:782-809, 998-1008; chem_db.rs:642-658 | Combustion only for ethanol: hardcoded 0.789 g/mL, 46.069, 1367 kJ/mol, ignition at T ≥ 286 K, flame 1200 K. The combustion kinetic needs species `"O2"`, which never exists | Nothing else burns. The flame needs no oxygen | B | Gas-phase oxidation with fuel vapour from VLE and O2 from the atmosphere. Flash point from Pˢᵃᵗ + LFL. ΔHc from ΔfH. Flame T adiabatic from Cp |
| F12 | RS | 1/5 | vessel_eq.rs:15-17, 101-107, 209-217, 363-366, 395-405; vessel.rs:1019-1024 | Ideal solution, solvent activity 1. Davies only in the unused equilibrium.rs:18-37, and its A = 0.5092·(298.15/T)^1.5 assumes water's ε | Wrong at high I, 6 M acid and in mixed solvents. Snapshot "activity" is a copy of concentration | B | `ActivityModel` per phase: Debye-Hückel/Davies with A(ε(T), ρ(T)); SIT/Pitzer; UNIFAC. Parameters are intrinsic data |
| F13 | CV | 1 | vessel.rs:1142-1155; chem_db.rs:262-272 | pH = −log[H+] in the aqueous volume, clamped 0-14. Missing H+ means 1e-7. Kw stored as logK −14 + ΔH | 6 M HCl shows pH 0. No acidity scale outside water | B | log a_H+ in the phase. pKs of the solvent derived from ΔfG of solvent and its ions. No clamp |
| F14 | EN | 1/7 | vessel_eq.rs:118, 120, 125-132, 225; vessel.rs:664, 1143, 1158 | Minerals solved only if H2O > 0.05 g. Equilibria use total volume but pH and optics use aqueous volume | Salts in ethanol never precipitate. Inconsistent concentrations | B | Species belong to phases. SLE per phase |
| F15 | ST | 3/4 | compound_model.rs:56-79, 178-179 | Imports matched to engine species by element multiset | Probe: dimethyl ether → ethanol, methyl formate → acetic acid | B | Identity = InChIKey/structure (intrinsic). Never match by formula alone |
| F16 | CV | 3/1 | compound_model.rs:158-159, 195, 228-238, 257 | Phase stamped at import (`form`, `by_mass`). Every non-solid becomes a 0.10 M aqueous solution with water density 0.997. Organics → visual-only | Probe: neat H2SO4 → 0.1 M. Acetone, CH4, Na, Zn are visual-only | B | Dose the pure compound. Phase and dissolution derived by phase equilibrium (COMPOUND_PHASE_PLAN is heading here) |
| F17 | EN | 7 | vessel_eq.rs:118, 134-138; vessel.rs:331, 664 | Solids < 1e-7 mol set to 0 (mass destroyed). Volume floor 1 mL | Probe: no AgCl at 11 µL. µL drops diluted 100× | B | Scale-relative tolerances. Never delete mass. True volume |
| F18 | CV | 2/5 | vessel.rs (absent); energy.rs | No freezing, melting or decomposition. Phase change only via the water boiling clamp | Probe: water at 241 K stays liquid. NaHCO3, CuSO4·5H2O and CaCO3 do not decompose | B | SLE from μ°(s) vs μ°(l). Decomposition = reactions whose ΔG(T) turns negative, with kinetics |

### P1: severely limits generality (data and chemistry sources)

| ID | Inv | Cat | Location | Assumption | What breaks | Sev | Replacement direction |
|---|---|---|---|---|---|---|---|
| F19 | CV | 3 | chem_db.rs:44-60, 669-1253 | 27-entry reagent catalog with per-mL mol (incl. H2O), density, molarity and `form` hand-written | Molarity and density are fixed at one T. Adding a reagent needs Rust | D | A reagent is a *recipe* (compound IDs + amounts). Density and molarity derived |
| F20 | RS | 4 | chem_db.rs:259-455; data/solubility.json `equilibria` | 15 hand-written + 17 table equilibria (logK298 + ΔH, 6 with ΔH = 0). Indicator pseudo-species `HIn_*` | No hydroxo, chloro or ammine complexes beyond 4. FeCl3 alone precipitates | D | Reaction basis generated from species with formation data (formula-matrix null space). Indicators are ordinary species (ΔfG, pKa, spectra) |
| F21 | RS | 4 | chem_db.rs:555-667 | 6 hand-written kinetic reactions, each with its own ΔH | Only Mg reacts with acid. No other redox | D | Rate rules per class + registrable kinetics. ΔH from species |
| F22 | CV | 4 | vessel.rs:668-688 | A solid catalyst **replaces** k by `0.08·clamp(100·n, 0.5, 10)`, dropping Arrhenius | Catalysed rate does not depend on T. No homogeneous catalysis | D | Mechanism steps, or surface rate ∝ area × sites × k(T) |
| F23 | CV | 4 | templates.rs:162-885, 888-949; network_generator.rs:62, 296-299; vessel.rs:352-354 | 45 families with family-level ΔH/ΔS. Mayr keys `nuc_*` never match. Every Mayr adduct gets ΔH −55, ΔS −70. Generated k frozen at generation T (`arrhenius_ea: 0`) | No organic chemistry runs correctly. Rate does not change with T after generation | D | Atom-mapped templates. ΔrG from product/reactant species. Store A and Ea, not k |
| F24 | ST | 4 | (absent) | No E°, Nernst, electrodes or current | Galvanic cells, electrolysis, displacement, corrosion | B | E° = −ΔrG°/nF from formation data (intrinsic). Butler-Volmer electrode phase |
| F25 | ST | 4/6 | (absent); optics.rs, spectra.rs | Spectral model exists, but no light source or quantum yield | Photolysis, photo-halogenation | B | Light-source spectrum × ε(λ) × quantum yield |
| F26 | RS | 3 | spectra.rs:28-198; optics.rs:56-81 | 21 band entries, 9 solid optics, 11 fume entries in static `match`. Fume `denser_than_air` stored instead of derived | Imported coloured compounds are colourless in solution | D | ε(λ) per species (intrinsic in a given solvent) in the species store. Buoyancy derived from M vs air M |
| F27 | CV | 3 | ions.rs:188-249, 473-498; solubility.rs:81-103, 110-146, 165, 178 | Solubility rules. Rule Ksp 10^−(4+2·zc·za). Saturation cap 3 mol/L. Density M/38. ΔH = 0 | Rule guesses do not depend on T or solvent | D | Estimate tier only, behind ΔfG(solid) − ΣΔfG(ions) |
| F28 | RS | 2/3 | gas.rs:89-96, 121-126; vessel.rs:881-887 | Water-only Antoine (valid 1-100 °C, clamped at 10 atm). Collector at 1 atm | Gas collection over other liquids, or at other P | D | Pˢᵃᵗ(T) for any liquid from μ°(g) − μ°(l), or a labelled Antoine fit with its range |
| F29 | CV | 6 | vessel_ext.rs:215; network_generator.rs:62; templates.rs:12, 86-91 | Settling: ρ_liquid 1.0, η 1e-3. Diffusion cap: η 8.9e-4 at all T | Settling and diffusion in other solvents or at other T | D | η(T, x) and ρ(T, x) from models with intrinsic parameters |
| F30 | CV | 6 | vessel.rs:366-461 (449) | Instant mixing and dissolution. Portion mass = volume × 1.0 | Dissolution rates, hot-spots, unstirred layering | D | Rate-limited transfer toward the phase-equilibrium target. Portion density from the model |
| F31 | CV | 6 | vessel.rs:1083; phase_transfer.rs:84-89 | `evaporation_g_s` constant (0.001, or 0.5 when boiling). No sub-boiling solvent loss | Evaporation and crystallisation | D | Flux = k_m·A·(γxPˢᵃᵗ − p_room)/RT per species |
| F32 | ST | 7 | network_generator.rs:15-16; vessel_ext.rs:16 | Caps of 200 species, 500 reactions, 80 events. Cap reached silently | Truncated networks with no warning | D | Report caps in the snapshot. Flux-based pruning |

### P2: data flow, structure, secondary

| ID | Inv | Cat | Location | Assumption | What breaks | Sev | Replacement direction |
|---|---|---|---|---|---|---|---|
| F33 | ST | 8 | lib.rs:400-500; chem_db.rs:10-41 | Runtime registration only for reagents, kinetic reactions, equilibria and minerals. No species thermo, Pˢᵃᵗ, Henry, spectra, transport, activity parameters, templates, atmosphere or P_ext | Data from PubChem cannot reach the physics | B | `register_species` / `load_database` of intrinsic records (§3d) |
| F34 | ST | 8 | solubility.rs:21-28 (`include_str!`) | Solubility table compiled into the WASM | Changing data needs a rebuild | D | Load at runtime, compiled copy as fallback |
| F35 | CV | 8 | pipeline/build_bundle.py, species_curation.py; web/src/pubchem/api.ts:8-20, 65-66 | The bundle (501 species) stores mp_c, bp_c, density and solubility as plain properties. Its PHREEQC/pKa/Joback data never reaches the engine | Intrinsic estimates (Joback) are unused. The 1-atm facts are used as properties | D | The bundle becomes the seed intrinsic store. mp/bp become labelled curve points |
| F36 | CV | 8 | web/src/pubchem/solubility_parser.ts:58-135, 193-203 | Keeps only the *water* value closest to 25 °C. Other solvents and temperatures discarded | Loses the points needed to fit ΔH_sol and per-solvent SLE | D | Keep every (solvent, T, value) point |
| F37 | CV | 2 | pubchem/parser.ts:153-166, 178; record_builder.ts:51-52 | Placeholders mp 20 °C, bp 100 °C, ρ 1 (water-like). Phase from ROOM_C = 25 | Unknown compounds silently behave like water | D | Mark as unknown. Estimate (tiered). Never let placeholders reach physics (partly in progress) |
| F38 | EN | 2 | vessel.rs:269-270; web/src/app/lab.ts:204, 218-222, 318-320 | Initial T 298.15, room 295.15. Ice bath fixed at 273.15. Pop 2.2 atm and burst 6 atm for every vessel | No −78 °C or oil baths, no pressure-rated vessels | D | Bath = a medium compound (T from its phase equilibrium). Pressure ratings per glassware |
| F39 | ST | 7 | web/src/app/glassware_catalog.ts | No condenser, distillation, crucible, autoclave, vacuum line, electrodes or lamp | Missing equipment for several environments | D | Equipment as operators on the phase model |
| F40 | CV | 1 | vessel.rs:520, 927-949, 1203; vessel_ext.rs:157; web/src/app/visual_contents.ts:144-152 | n = 1.333 and ρ = 1 + 0.03·I for the aqueous layer. Ethanol constants for the organic layer | Wrong look and layer order | C | n_D from molar refraction (intrinsic) + Lorentz-Lorenz. ρ from the volume model |
| F41 | CV | 1 | vessel.rs:389-390; web/src/bench/titration_math.ts:4-5; pipetting_math.ts:30 | 1 drop = 0.05 mL (0.04 Pasteur) for every liquid | Small dosing error for non-water liquids | C | Tate's law with γ(T) and ρ(T) |
| F42 | CV | 2 | vessel.rs:1043-1052 | Vapour visible from 330 to 373 K. Condensation from T − room | Wrong cues for other liquids or at other P | C | Visuals from the computed vapour flux and dew point |
| F43 | EN | 1 | vessel_ext.rs:309, 329-331, 359 | `H2O(g)` excluded from events. T ≥ 372 K counts as "external heating" | Event logic assumes water | C | Use the computed boiling state and phase solvent |
| F44 | CV | 4 | templates.rs:136-158 | pOH = 14 − pH. Fixed k_acid and k_base | Wrong away from 25 °C or outside water | D | a_H+/a_OH- from the solver. pKw(T) from formation data |
| F45 | ST | 4 | server/barrier_workflow.py:47-54, 110, 132, 145-154, 177, 195, 204 | GFN2 single point in the **gas phase** (labelled ALPB). First reactant only. "TS" = stretched first bond. Constant thermal correction. Hardcoded validation flags. Unused by the web bench | Barriers are not reaction- or solvent-specific | D | Real TS search with implicit solvent = phase solvent, or literature barriers, with a tier |
| F46 | ST | 8 | equilibrium.rs, kinetics.rs, energy.rs, physics.rs, phase_transfer.rs; lib.rs:93-253 | A parallel legacy engine is exported and covered by the M3/M4 gates | The gates test code the bench never runs | D | Port the gates to the Vessel path, then retire or merge the legacy modules |
| F47 | CV | 3 | vessel.rs:972, 976; vessel_ext.rs:157-168; solubility.rs:119-125, 141; data/solubility.json `kind`, `default_particle_um` | Particle size and morphology (curds/gel/powder) stored per compound. "Floats" if ρ < 1.0 (water). Unknown solid: ρ 2.5, n 1.6 | Morphology depends on supersaturation and T, not on the compound alone | C | Particle size from a nucleation/growth model (supersaturation, T). Only the solid density and colour are stored, as intrinsic data |

---

## 2. Invariant ledger: condition-dependent values stored as if intrinsic

The table lists each stored or hardcoded value, the intrinsic data it should be derived from, and the model that derives
it.

| # | Stored value | Where | Intrinsic data it should come from | Deriving model |
|---|---|---|---|---|
| 1 | Boiling point 373.15 K | vessel.rs:841, 1041; energy.rs:5; phase_transfer.rs:2 | ΔfH°, S°, Cp(T) of liquid and gas | μ°g(T) − μ°l(T) → Pˢᵃᵗ(T). Bubble point at P with activities |
| 2 | ΔHvap = 40660 J/mol | vessel.rs:850; energy.rs:4 | same | ΔHvap(T) = H_g(T) − H_l(T) |
| 3 | Water Antoine A/B/C | vessel.rs:883; gas.rs:93 | allowed as a *labelled curve fit* with a validity range | Fall back to formation data outside the range |
| 4 | Cp = 4.184 J/g/K for all contents | vessel.rs:404, 423, 451, 816; physics.rs:5 | Cp(T) per species and phase (NASA-7 / Shomate / HKF) | Σ nᵢ Cpᵢ(T) |
| 5 | Water density 1.0 / 0.998 / 0.997 | vessel.rs:449, 1115; physics.rs:6; compound_model.rs:232, 250 | Molar volume parameters (Tc, Pc, ω or Rackett Z_RA); partial molar volumes of ions | Rackett/COSTALD + mixing. Ionic V̄ from HKF |
| 6 | Brine density 1 + 0.03·I | vessel.rs:520, 931 | same | same |
| 7 | Ethanol density 0.789, n 1.361 | vessel.rs:521, 800, 944-945, 1126 | same; molar refraction | same; Lorentz-Lorenz |
| 8 | n = 1.333 | vessel.rs:932, 1203; visual_contents.ts:148 | Molar refraction | Lorentz-Lorenz of the phase |
| 9 | Ksp at 298 K (128 minerals) | data/solubility.json; chem_db.rs:457-553 | ΔfG°/ΔfH°/S°/Cp of solid and ions | Ksp(T, solvent) = exp(−ΔrG°/RT) with ion activities from the solvent's activity model (RS: allowed as a labelled reference point when ΔfG° of the solid is missing) |
| 10 | Mineral ΔH = 0 (92/128 + every rule/PubChem mineral) | data/solubility.json; solubility.rs:138 | ΔfH° of solid and ions | van 't Hoff + ΔCp, or Clapeyron-type fit from several (T, s) points |
| 11 | Solubility cap 3 mol/L | solubility.rs:178 | none (invented) | SLE from μ° of the solid (estimate tier if missing) |
| 12 | Rule Ksp 10^−(4+2·zc·za) | solubility.rs:165 | none (invented) | Speculative tier only, with a T dependence from estimated ΔH |
| 13 | PubChem "solubility at ~25 °C" → Ksp_298 | solubility.rs:374-381; solubility_parser.ts | Keep the (T, solvent, s) points | Fit ΔG_sol and ΔH_sol, then derive at T |
| 14 | Kw = 10^−14, ΔH 55.84 | chem_db.rs:268-269 | ΔfG°/ΔfH°/S°/Cp of H2O(l), H+(aq), OH−(aq) | K(T) from ΔrG°(T). pKs of any solvent the same way |
| 15 | pOH = 14 − pH; pH clamp 0-14 | vessel.rs:1149-1153; templates.rs:140 | as #14 | Solver activities |
| 16 | CO2 Henry 0.034 M/atm, ΔH −20 kJ | phase_transfer.rs:4, 33 | ΔfG°/ΔfH° of CO2(g) and CO2(aq) | k_H(T) = exp(−(μ°aq − μ°g)/RT), same for every gas |
| 17 | Equilibrium logK298 + constant ΔH (32 records) | chem_db.rs:259-455; data/solubility.json | Species formation data. Reference pKa is allowed by the invariant (RS) | ΔrG°(T) = ΔrH°(T) − TΔrS°(T) with ΔCp. Reaction-level values only as a labelled fallback |
| 18 | Per-reaction ΔH for kinetics and templates; neutralisation −55840 | chem_db.rs:555-667; templates.rs:162-885; network_generator.rs:296-297; energy.rs:3 | ΔfH° of the species | Hess's law at T |
| 19 | Species fallback ΔfH −100, Cp 50, M 50 | chem_db.rs:248-253 | Structure | Group additivity (Joback/Benson, already in the pipeline), labelled Estimated |
| 20 | Reagent `form`, `by_mass`, density, molarity, mol/mL H2O | chem_db.rs:44-60, 669-1253; compound_model.rs:195, 247-262 | Recipe (compound amounts) | Phase, density and molarity derived at the current T |
| 21 | Import becomes a 0.1 M aqueous solution | compound_model.rs:159, 228-238 | none (environment choice) | Dose the pure compound. The solution is a mixture |
| 22 | Phase from mp/bp vs 25 °C; placeholders mp 20, bp 100, ρ 1 | parser.ts:153-178; record_builder.ts:51-52 | mp/bp as labelled curve points (Tm, 1 atm), (Tb, 101325 Pa) | Phase equilibrium at the vessel's T and P (in progress) |
| 23 | Bundle mp_c, bp_c, density, "miscible" | pipeline/species_curation.py → bundle.json | same; miscibility from the activity model | LLE stability test |
| 24 | Ethanol flame: ignition at 286 K, 1367 kJ/mol, 1200 K | vessel.rs:785, 800-807, 1002-1003 | ΔfH°, Pˢᵃᵗ, lower flammability limit | Flash point = T where Pˢᵃᵗ/P = LFL. Adiabatic flame T |
| 25 | Viscosity 8.9e-4 / 1e-3; liquid density 1.0 in Stokes | network_generator.rs:62; templates.rs:12; vessel_ext.rs:215 | η(T) parameters per species | η(T, x) mixing rules |
| 26 | Drop volume 0.05 mL | vessel.rs:390; titration_math.ts:5; pipetting_math.ts:30 | Surface-tension parameters | Tate's law |
| 27 | Ice bath 273.15 K | web/src/app/lab.ts:320 | Bath medium = compound(s) | Melting point at P (with freezing-point depression for salt/ice) |
| 28 | Vapour visibility 330-373 K; evaporation 0.001 / 0.5 g/s | vessel.rs:1043-1047, 1083 | none | Computed vapour flux and dew point |
| 29 | Particle size, morphology | data/solubility.json; spectra.rs:85-152; solubility.rs:119-141 | none (condition-dependent) | Nucleation/growth from supersaturation and T |
| 30 | Davies A = 0.5092·(298.15/T)^1.5 | equilibrium.rs:27 | ε(T), ρ(T) of the solvent | A ∝ ρ^½ (εT)^−3/2 |
| 31 | `denser_than_air` flags | spectra.rs:154-198 | Molar mass | Compare with the gas phase's mean M |
| 32 | Catalyst k = 0.08·… (T-independent) | vessel.rs:686 | Arrhenius A, Ea (reference kinetic data) | k(T) × surface area |

Allowed as intrinsic or reference data (keep, but store per species with provenance):
- molar mass and structure
- ΔfH°, S°, Cp(T) coefficients
- pKa / log K at a stated reference state, with its ΔH° and ΔCp
- E°, dielectric-constant parameters, critical constants, molar refraction
- ε(λ) of a species in a stated solvent
- solid crystal density (nearly condition-independent)
- Arrhenius A/Ea
- labelled curve points such as (Tb, 101325 Pa)

---

## 3. Architecture assessment for the four requested capabilities

### (a) Pluggable solvent model

**Current state.** No solvent object exists.
- The `Vessel` holds flat `species_mol`, `solid_mol` and `headspace_gas_mol` maps (vessel.rs:245-248). Phase is implied
  by a `(s)` / `(g)` suffix or by the literal ids `"H2O"` / `"C2H5OH"`.
- `types.rs:54-60` already defines an unused `Phase { kind, volume_ml, density_g_ml, amounts_mol }`.

**What it needs.**
- `Vessel.phases: Vec<PhaseState>`: gas, liquid(s) and solids, each with component amounts and an activity-model id.
- A liquid's "solvent properties" (ρ, Cp, η, ε, n_D, pKs) are *derived mixture properties* computed from intrinsic
  component parameters. Nothing is stored per solvent.
- `ActivityModel` trait:
  - Ideal
  - Debye-Hückel/Davies with A and B from the phase's ε(T) and ρ(T)
  - SIT/Pitzer (PHREEQC pitzer.dat)
  - UNIFAC (needs structure, see F15)
- Other solvents: by default, ion μ° in another solvent = aqueous μ° + Born transfer (∝ 1/ε), labelled Estimated.
  Measured transfer or pKa data override it.
- Acidity: log a_H+ in the phase's own scale (pKs from formation data). A solvent with no autoprotolysis has no pH
  readout.

### (b) General thermodynamics from ΔfH°/S°/Cp

**Current state, good news.** `vessel_eq.rs::solve_coupled_equilibria` (line 361 onward) is already a convex Gibbs
minimisation over reaction extents, with solids as bounded extents (ideal solution, per-reaction ln K). The structure is
right.

**What it needs.**
- Per species and phase: `ThermoData { dfH298, S298, cp: Nasa7 | Shomate | HKF, tier, source }`, giving
  μ°(T) = H(T) − T·S(T).
- Reactions are not stored for equilibrium. A reaction basis comes from the null space of the element+charge formula
  matrix of the species present, and ln K_r(T) = −Σνᵢμᵢ°(T)/RT. Existing logK/Ksp records are converted at load time
  into the missing species' μ° (e.g. a Ksp defines μ° of the solid given the ions) and labelled.
- An enthalpy-conserving energy balance replaces F8, the reaction heats, latent heats and mixing temperatures.
- Kinetic reverse rates use the same μ°, so equilibrium and kinetics agree.
- Unknown species: group additivity (Joback/Benson already exist in the pipeline), labelled Estimated, never a silent
  constant.

### (c) Fugacity-based phase equilibrium (VLE/LLE/SLE)

**Current state.** Each transfer is a separate special case:
- the water boiling clamp
- CO2 Henry
- Ksp saturation
- a fixed ethanol layer
- instant gas loss

COMPOUND_PHASE_PLAN Stage E would add a fifth ("inert compounds" with their own melt/boil clamps).

**What it needs.** One condition, equal μᵢ across phases, handled by the same Gibbs solver with inter-phase transfer as
extra extents. With complete formation data for each phase of a compound:
- Pˢᵃᵗ(T), Tm and k_H(T) all *fall out* of μ° differences. Clausius-Clapeyron, Clapeyron and van 't Hoff become
  consequences rather than stored rules.
- With partial data (e.g. only Tb), a labelled curve point plus a Trouton/Walden estimate supplies the missing μ°.

The pieces:
- VLE: γᵢxᵢPᵢˢᵃᵗ = φᵢyᵢP. Ideal gas by default, Peng-Robinson at high P (critical constants are intrinsic).
- Boiling = bubble point at P_ext (open) or at the computed P (sealed).
- SLE: Ksp is the ionic case. Molecular solids use ΔfG(s) vs the solution. Freezing-point depression follows.
- LLE: tangent-plane stability test, then split (ethanol/water stays one phase, hexane/water splits).
- Rates: transfers relax toward the equilibrium target with mass-transfer coefficients (kLa, area, stirring).

### (d) Runtime data ingestion: coverage of the existing `register_*`

| API | Accepts | Gaps vs the invariant |
|---|---|---|
| `register_compound` (lib.rs:400) | `ReagentCatalogEntry` (composition per mL/g, density, `form`) | Stores condition-dependent density and `form` (CV). No species properties |
| `import_compound` (lib.rs:415) | formula, SMILES, state, density, molarity | Element-key identity (F15). Phase stamped (F16). The new thermo fields in web/src/types/sim.ts:319-385 are not yet in the Rust struct (in progress) |
| `register_reaction` (lib.rs:439) | A, n, Ea, ΔH, catalyst, K298 | Reverse and K ignored (F10). Per-reaction ΔH (RS). No atom-balance check |
| `register_equilibrium` (lib.rs:452) | logK298 + constant ΔH | No ΔCp. Water only |
| `register_mineral` / `resolve_mineral` (lib.rs:465-500) | Ksp, ΔH, colour, density, particle size, kind | 25 °C water only. ΔH usually 0. Morphology stored |
| (missing) | species ΔfH°/S°/Cp, Tc/Pc/ω, molar refraction, ε params, activity params, ε(λ), E°, curve points, atmosphere, P_ext | F33 |

**What it needs.**
- One `SpeciesRecord` containing **only intrinsic fields + labelled curve points**, each field with tier and source.
- `register_species` and `load_database` (bulk JSON: pipeline bundle, PHREEQC-derived, user files).
- A general `take_property_requests` queue, generalising today's mineral lookups, so the engine can ask the web layer
  for any missing intrinsic datum.
- `ReagentCatalogEntry` becomes a recipe.

---

## 4. Recommended target architecture (centred on the invariant)

```
engine/src/
  db/            SpeciesDb: INTRINSIC data only, runtime-registrable, per-field provenance tier
    record.rs    SpeciesRecord { identity: InChIKey, SMILES, formula, charge;
                   thermo per phase: dfH298, S298, Cp(T) coeffs (NASA-7 / Shomate / HKF);
                   critical: Tc, Pc, omega; molar refraction; dielectric params; activity params (Pitzer, UNIFAC groups);
                   reference pKa/logK with dH, dCp; E0; eps(lambda) in a stated solvent; solid density;
                   curve_points: [(kind, T, P, value, solvent, source)]  <- e.g. (Tb, 101325 Pa), (25 C, s in water) }
    estimate.rs  Joback/Benson, Born transfer, Trouton/Walden, fit-from-curve-points: always labelled Estimated
  thermo/        mu0(T), H(T), Cp(T); reaction basis from the formula matrix; K(T) = exp(-dG/RT); E = -dG/nF
  props/         DERIVED properties only: rho(T,x), eta(T,x), eps(T,x), n_D, Psat(T), kH(T), gamma (activity models)
  phases/        PhaseState (gas | liquid | solid); stability test (split/merge)
  equilibrium/   Gibbs minimiser (generalised vessel_eq coupled solver): chemical + phase equilibria together
  kinetics/      rate laws (mass action, surface, photo, electrode); reverse from K(T); stiff integrator
  transport/     interphase mass transfer, evaporation, dissolution, settling (using derived rho/eta)
  energy/        enthalpy balance; T solved from H; latent heats implicit
  reactor/       Vessel = phases + environment { P_ext or sealed volume, atmosphere, light, electrodes, bath medium }
                 + equipment operators (condenser, vacuum, purge)
  audit/         element / charge / enthalpy ledgers checked every tick
  snapshot.rs    unchanged visual contract (layers, solids, gas_fluxes, fumes, flame, events)
```

Rules that keep the invariant enforceable:
- Nothing under `props/`, `equilibrium/` or `energy/` may contain a compound id literal (no `"H2O"`, `"C2H5OH"`,
  `"CO2(aq)"`). A lint or test can grep for this.
- Any constant that depends on conditions must live in `db/` as a labelled curve point, or be derived in `props/`.
- Every derived value exposed in the snapshot carries the weakest tier of its inputs.

Data flow:
1. PubChem / bundle / user / server data
2. → web normalises into intrinsic `SpeciesRecord`s (condition-dependent facts become curve points)
3. → `register_species` / `load_database`
4. → `estimate` fills gaps (tiered), or a property request goes back to the web
5. → the engine derives every property at the vessel's T, P and composition
6. → the snapshot (per-phase compositions and derived properties) is drawn by the renderer

---

## 5. Staged roadmap (each stage independently shippable and testable)

**Stage 0: Stop silent errors (small, do first).**
- Remove the network generator from `Vessel::update_network`, or restrict it to species with SMILES (F1).
- Real element/charge ledger (F2).
- Never zero solids, and use scale-relative tolerances (F17).
- No invented 10 mL (F3).
- No element-key identity (F15).
- Tests: NaOH + NaCl conserves Na/Cl/O/H. A µL AgCl precipitate forms. A dry solid reports 0 mL. Dimethyl ether is not
  ethanol.

**Stage 1: Intrinsic SpeciesDb + runtime ingestion (biggest generality gain per effort).**
- Introduce `SpeciesRecord` (intrinsic fields + labelled curve points + tiers), `register_species` and
  `load_database`.
- Port `get_species_thermo`, `spectra::*`, `solubility.json` and the reagent catalog into records loaded at startup.
  The compiled copy stays only as a fallback.
- Conversions at load time:
  - every per-reaction logK/Ksp/ΔH → species μ° where possible (labelled)
  - every stored mp/bp/density/solubility → curve points
- Reagents become recipes (F19). Seed from the pipeline bundle (501 species, Joback estimates, PHREEQC/pKa) (F35).
- Make COMPOUND_PHASE_PLAN's `CompoundThermo` *be* this record.
- Tests:
  - register a species at runtime and its colour and heat take effect
  - no condition-dependent field is accepted as a plain property (schema test)
  - a grep test confirms no compound literals outside `db/` seeds
- Why first: every later stage needs per-species intrinsic data that today cannot get in (F33-F36). This is mostly
  plumbing, with low numerical risk, and it is where the invariant is enforced.

**Stage 2: Thermodynamic models from intrinsic data.**
- μ°(T), H(T), Cp(T). K(T) = exp(−ΔrG°(T)/RT) from formation data (F9, ledger #9-#18).
- Enthalpy energy balance (F8). Hess-consistent reaction heats.
- Removes ledger items 2, 4, 14, 15, 18 and 19.
- Tests:
  - Kw(T) and Ksp(AgCl, T) match tabulated values at 0-100 °C
  - ethanol heats about 1.7× faster than water at equal mass
  - two paths to the same products release the same heat
  - neutralisation gate unchanged

**Stage 3: Gas phase, atmosphere, pressure and VLE.**
- Gas phase with air composition. P_ext input (open, vacuum, pressurised) (F6).
- Pˢᵃᵗ(T) and k_H(T) derived from μ°(g) − μ°(l/aq) (curve points as a fallback). Bubble-point boiling, evaporation,
  degassing and redissolution, all mass-transfer limited (F5, F7, F28, F31).
- Combustion as gas-phase oxidation needing O2 (F11).
- Subsumes the boiling part of COMPOUND_PHASE_PLAN Stage E. Removes ledger items 1, 3, 16, 24 and 28.
- Tests:
  - ethanol boils at 351 K (1 atm) and about 300 K (0.1 atm)
  - a sealed flask's P follows T
  - NaOH solution absorbs atmospheric CO2
  - a flame dies under N2

**Stage 4: Liquid phases, activity models, solvents, SLE/LLE.**
- Per-phase species (F14). `ActivityModel` (F12). ε(T) and ρ(T) derived (F29, F40).
- LLE stability test (F4). Melting and freezing from μ°(s) vs μ°(l) (F18). pH = log a_H+ per solvent (F13).
- Removes ledger items 5-8, 25, 27 and 30.
- Tests:
  - ethanol + water forms one phase
  - hexane + water forms two layers in order
  - 6 M HCl shows pH < 0
  - NaCl precipitates from ethanol
  - water freezes at 240 K with a latent-heat plateau
  - the M3 PHREEQC gates reproduced on the Vessel path, then retire the legacy modules (F46)

**Stage 5: Kinetics + structure-based generation.**
- Reverse via detailed balance. Stiff integrator. Real rate laws (F10).
- Catalysis as mechanism or surface rate (F22).
- Atom-mapped templates on SMILES; A/Ea stored, never k (F23).
- Tests: generated products atom-balanced. Rate follows T after generation. SN2/E2 and ester gates on real structures.

**Stage 6: Electrochemistry and photochemistry.**
- E° from ΔfG. Butler-Volmer electrodes. Power supply and meter (F24).
- Light source × ε(λ) × quantum yield (F25).
- Tests: Daniell EMF vs Nernst. Electrolysis H2:O2 = 2:1. Photolysis rate ∝ intensity.

**Stage 7: Equipment for environments.**
- Condenser/reflux/distillation, vacuum and pressure ratings, inert purge, bath media, crucible (F38, F39).
- Tests: reflux holds volume at the bubble point. Distillate enriched per VLE.

---

## 6. Decisions needed from the user

1. **Estimate policy.** For species with no measured intrinsic data, may the engine run on labelled estimates
   (Joback/Benson, Born transfer, Trouton, rule-based Ksp)? Or should such species stay inert or unmodelled?
2. **Data sources and licensing.** Which sources may be bundled? Candidates: NIST-JANAF / Burcat (gas thermo),
   SUPCRT/HKF (aqueous ions), PHREEQC databases incl. pitzer.dat, published UNIFAC tables, CODATA key values. Is
   PubChem (runtime) still the primary per-compound source? It rarely has ΔfH°/S°/Cp directly.
3. **Browser-only vs local server.** UNIFAC groups, SMARTS templates and TS searches need RDKit (a WASM build of about
   6-10 MB) or the Python server. Must the browser-only app keep full capability?
4. **Environment priority after Stages 0-2.** Choose an order among: non-aqueous/mixed solvents, pressure/vacuum/atmosphere,
   melts and high-T solids, electrochemistry, photochemistry.
5. **pH semantics outside water.** Show nothing, log a_H+ on the solvent's own scale, or an aqueous-scale estimate with a
   warning? Should the pH meter read in ethanol?
6. **Legacy engine.** May `equilibrium.rs`, `energy.rs`, `physics.rs`, `phase_transfer.rs` and the M3/M4 wasm exports be
   retired once their gates run on the Vessel path?
7. **Network generator.** Disable it in the bench now (Stage 0), or keep it behind a debug toggle?
8. **Performance budget.** How many species per vessel and how many vessels must a full multiphase Gibbs solve with
   activity models handle at 20 Hz? This decides whether equilibrium is solved every tick or only on change.
9. **Catalog reagents as recipes.** Is it acceptable that "0.1 M HCl" becomes HCl + water, so its density and molarity
   at T are derived rather than hand-written?
10. **Coordination with COMPOUND_PHASE_PLAN Stage E.** Should the in-flight inert-compound melt/boil clamps be built on
    the Stage 1 store and Stage 3 VLE rather than as a parallel path?

---

## 7. Notes on the in-flight compound/phase work

- `COMPOUND_PHASE_PLAN.md` follows the invariant: mp/bp are curve points, and phase is derived from T and P. This audit
  extends the same rule to the remaining 30-odd stored condition-dependent values (ledger, §2).
- Risk: an "inert compound" store separate from `species_mol` / `minerals` would be a third representation of matter,
  and its melt/boil clamps would copy the water clamp (ledger #1, #2). Recommendation:
  - keep one species store with a phase tag
  - make `CompoundThermo` part of the intrinsic `SpeciesRecord` (Stage 1)
  - make the generic phase-equilibrium step (Stage 3) the first consumer of `CompoundThermo`
- The web parsers being written now (thermo_parser.ts, solubility_parser.ts) should emit curve points with T, P and
  solvent rather than single "at 25 °C" values (F36). That keeps the data the Stage 2-4 models need.
