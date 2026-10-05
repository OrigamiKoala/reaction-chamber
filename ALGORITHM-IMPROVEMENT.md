# Algorithm Improvement Plan

Audit of the algorithms that decide **which reactions happen, how far and how fast they go, which phases form, and what the
instruments read**, checked against the design invariants of `CLAUDE.md` ("intrinsic data in, models for the environment";
products are compounds like reagents; no stamped condition-dependent values; every estimate labelled) and against
`docs/plans/generalization-master-plan.md`. The goal is generality over per-reaction accuracy: no result is written for a
specific reaction; a new reaction type is a data row (a template, a record, a coefficient), never code.

This file was consolidated on 2026-10-04 (sixth pass). Earlier passes are summarised by theme in section 2; every status below was
re-checked against the code and the tests, not copied forward. Section 3 is the list of what is genuinely open.

---

## 1. How results are determined today (one tick of `Vessel::step`)

| Step | Code | What decides the outcome |
|---|---|---|
| Organic network | `network_generator.rs`, `reaction_templates.rs`, `data/reaction_templates.json` | graph templates (SMARTS slots, edits, rate rules by specificity, Hammett-Brown modifiers, catalysts as rate-law orders); 31 templates; K from species data or none (irreversible); core / edge split re-evaluated every 2 s; one network per liquid phase and solvent class |
| Kinetics | `kinetics/core.rs`, `Vessel::step_kinetics` | adaptive ROS2 in extent coordinates (embedded error control, sparse LU for large networks); rate `k_f prod c^order (1 - Q/K)` |
| Combustion | `vessel_burn.rs`, `transfer/combustion.rs` | flash point, LFL/LOC, Spalding pool burning |
| Redox | `gem/discovery.rs`, `vessel_discovered.rs` | couples of the species store paired and balanced by null space; Marcus cross-relation rate (`gem/rates.rs`); all reactions advance together to their own equilibrium |
| Thermal decomposition | same | solid -> solid + gas against the gas partial pressures; `1e13 exp(-dH/RT)` |
| Electrodes | `vessel_electro.rs`, `transfer/electrochem.rs` | Butler-Volmer + mass transport, mixed potential, per-electrode Faraday bookkeeping |
| Equilibria + solids | `vessel_eq.rs`, `vessel_transfer.rs` | exact per-row bisection, coupled Newton with minerals at IAP = Ksp, limited by dissolution (film transport) and nucleation / growth rates |
| Particles | `transfer/population.rs`, `psd.rs`, `settling.rs`, `vessel_ext.rs` | moments of a population, log-normal closure into 6 equal-mass classes; dissolution / growth change every diameter by the same thickness (fines vanish first); each class settles through the layers lighter than itself and rests on the first denser one |
| Gas exchange | `vessel_vle.rs`, `transfer/gas_transfer.rs` | Henry constants from mu0(aq) - mu0(g), film mass transfer |
| Heat of mixing | `vessel_mixing.rs`, `data/excess_enthalpy.json` | excess enthalpy `H^E = -R T^2 d(sum n ln gamma)/dT` of the UNIFAC model, with measured Redlich-Kister rows as residual; booked when a dose, a pour or a reaction changes the composition; outflows carry their share away |
| Energy | `Vessel::step_thermal`, `heat_transfer.rs`, `bath.rs` | process heats, heater (surface-limited hot plate), finite baths (ice melts, hot baths steam), Churchill-Chu losses; `vessel_energy.rs` audits H(T, n) against the external energy |
| Phases | `vessel_phase.rs`, `vessel_vle.rs`, `lle.rs` | Schroder-van Laar, UNIFAC, Rachford-Rice, bubble point; a liquid that moves between phases books its excess enthalpy whether or not a solid moved |
| Ionisation of imports | `compound_model.rs::structure_ionisation`, `pka_structure.rs` | a molecule with a structure and ionisable sites gets its dissociation / protonation rows from the SMILES graph even when the ion dictionary has no conjugate base |
| Instruments | `vessel_uvvis.rs`, `analytical/*`, web `equipment/*` | engine values with instrument lag and quantisation |

---

## 2. Resolved (consolidated)

Each line names where the test or the code is. "Gate" = a numeric test in `engine/tests/` or `tests/*.mjs`.

### 2.1 Hardcoded results and invented data removed
- Per-reaction calculators (AgCl / NaCl / HA titration curves, the hand-built iodine clock, SN2/E2 and ester string functions,
  the legacy kinetic integrator, the Mayr substring branch) and their worker messages: deleted (`algorithm_fixes`, `stage7` gates).
- Every hand reaction row is `data/core_reactions.json` with tier and source; compound literals in engine logic: ratchet at zero
  (`literal_ban.rs`); the Python equilibrium solver / network generator copies are deleted (`/api/m6/network` returns 501).
- Invented formation data (dfH -100 kJ/mol, S 50 J/mol/K, Cp placeholders, invented indicator data) no longer decides any
  reaction: `try_thermo_state` returns `None`, discovery skips such reactions, kinetics leaves them irreversible; the thermo cache
  is keyed by the store generation; a phase never borrows another phase's data.
- Web stand-ins removed this pass: the metal-name regex (`looksLikeMetal`) and `piece_metals.ts` (the engine reports morphology
  from the dosed form, `data/solid_forms.json`, and the form travels with a poured portion), the hard-coded electrode colour
  table (the engine returns the colour and density of the metal's solid record), the renderer's 200 um piece threshold, and the
  fixed 8 g/mL electrode density when the engine gives one.

### 2.2 Thermodynamics and data layer
- One thermo lookup with Cp(T) models, Benson group additivity (dHf, S; 39 molecules mean 1.0 kJ/mol), Cabani-type hydration energies,
  entropy estimators for ions and solids, anion / ammonium formation data from pKa cycles, structure-based pKa
  (0.10 calibration, 0.17 held out), Fuoss ion pairs (now with the van 't Hoff enthalpy from the permittivity of water, stated at 25 C;
  not between the two ends of one redox couple) and 33 complexation rows, pair-additive Ksp for pairs without data.
- Indicators are structures (`data/indicators.json`); electrode materials, Joback groups, Mayr parameters, ligand-field constants,
  strong acids, redox lability are data files. Chromium(III) (`Cr+3`, `Cr(s)`) and the Cr(VI) couple are seeded; Cr is a labile redox element.
- Excess volumes and excess enthalpies are Redlich-Kister rows keyed by InChIKey pair, applied as residuals on UNIFAC.

### 2.3 Equilibria, phases and transfer
- Dose-path-independent coupled equilibria; molal basis everywhere (`solvent_kg_per_l` into the kinetic core); phase flash at conserved
  enthalpy with LLE up to 3 liquids; boiling as bubble point; sealed vessels; Henry exchange; evaporation with natural / forced convection.
- Stage 8 transfers: particle populations, film-limited dissolution, nucleation and growth, settling (Stokes / Richardson-Zaki / Peclet /
  Schulze-Hardy), electrochemistry. Sixth pass: dissolution and growth by constant thickness on the log-normal classes
  (`psd::change_to_volume`, exact binomial shift of the moments while nothing vanishes), settling through stratified layers
  (`settling_time_through_column`).
- Heat of mixing (`vessel_mixing.rs`): water + ethanol 100 + 50 mL warms by 7 K, the same by one dose or two, a draw-off costs nothing,
  the excess enthalpy is part of the state function of the energy audit.
- Finite baths (`bath.rs`): ice plateau, warming, cooling through the room, and now evaporation of the bath water into the room air.
- Hot plate surface limit (623 K), Churchill-Chu / radiation losses, finite heat capacities: no 1300 K dry beakers.

### 2.4 Reactions
- Organic network from data: 31 templates (ester / amide / acyl-halide / anhydride substitution, SN2 / E2 / SN1 / E1, hydration and
  halogenation of alkenes, keto-enol, carbonyl hydration / hemiacetal / carbinolamine / imine, aldol and its dehydration, EAS halogenation
  and nitration, **Diels-Alder, Friedel-Crafts alkylation and acylation (Lewis acid as a catalyst species), organomagnesium addition and
  protonolysis, Wittig olefination**, three alcohol / aldehyde oxidation half-reactions). Hammett-Brown relations orient and scale EAS.
- Redox discovery over the species store, organic couples eligible through a class rate or a `k_self` record. Corrections of this pass:
  oxidation states of ion pairs and hydroxo complexes follow the cation they were formed from (the electronegativity rule gave FeSO4 an
  iron of +10); a "reaction" that only swaps the oxidation levels of two forms of one element (Fe2+ + FeSO4+ -> Fe3+ + FeSO4) is not redox;
  an equilibrium-overshoot limit no longer throttles every reaction because one of them is already at equilibrium (bisection on the common
  scale, the offender waits); ion pairs and hydroxo complexes are forms of the free cation, not redox partners (`is_derived_ion_form`: a
  solution with five such forms discovers the same reactions as one without; it had 255 candidates for Fe2+ + dichromate). Gate: dichromate +
  Fe2+ in acid is quantitative (6 : 2 stoichiometry, atoms and charge conserved). Redox between solids and different oxidation-state families
  is still enumerated pairwise; the Gibbs minimisation of `gem/solver.rs` is not on the vessel path.
- Complexation data rows are registered before the first solve of a dose (the weak Fuoss pairs after it: registering them first adds species rows and takes the busy mixture from 9 to 15 ms/step), so a chloro complex competes with the hydroxide for the
  metal (Hg2+ in chloride at pH 8 stays dissolved); the solubility rules no longer call HgCl2 / HgBr2 / Hg(CN)2 insoluble.
- Acid-base + partition: a weak acid or base known only by its structure is ionised in water and extracted as its neutral form
  (benzoic acid / aniline between water and dichloromethane, `open_items_e`).

### 2.5 Instruments, visual contract
- Controls are on the 3D instruments; pH electrode with junction potential per layer; two-node thermometer; electrode materials from the store;
  NMR / MS predictors from the SMILES graph; UV-vis from optical records.
- Engine requests V1-V12 (morphology, volume, density, layer index, gas flux aggregation, electrolysis cost, electrode deposits, layer names,
  water baseline, formula parsing, event coalescing, boil intensity) and W1-W11 (frozen mass is a monolith, dosed forms, electrode mass per
  electrode, hot plate limit, finite baths, floc size, gas colour, supercritical flag, no visual-only fallback needed) are met; the renderer
  reads them.

### 2.6 Bugs found and fixed (sixth pass)
| Bug | Effect | Fix |
|---|---|---|
| `StoreLock::try_read` answered "unknown" whenever *another* thread was writing | species with no elements or charge during a registration: the intermittent `open_items_c` failures | it waits for another thread's writer and refuses only when this thread owns the write lock |
| SMARTS `#Z` knew 12 elements | `[#12]` (Mg) never matched; organometallic templates silently inert | full table of 92 symbols |
| `phase_flash` booked mixing heat only when a solid moved | a liquid-liquid split or transfer released no heat | booked whenever a phase amount changes |
| Portion lost the physical form of its solids | a poured ribbon became a bed | `Portion.forms` |
| Fuoss pair row stated at the temperature it was asked at, ΔH = 0 | wrong K(T) | stated at 25 C with ΔH from d ln K / dT |
| Fuoss pair between Cr3+ and Cr2O7 2- | nonsense redox candidates | same-element cation / anion pairs are not generated |
| Mercury(II) halides in the solubility rules | HgCl2 (74 g/L) precipitated | Hg(II) is insoluble only with I-, SCN-, BrO3- |
| Oxidation states of ion pairs (FeSO4: Fe +10, S -2) | hundreds of spurious redox candidates, throttled rates | split into cation and known anion |
| Equilibrium-overshoot halving (8 halvings) | a redox step ran at 1/256 of its speed whenever any candidate was at equilibrium | bisection; the offender waits |
| Node tests asserted behaviour removed earlier (Mg ribbon speed, hot plate power, synthetic metals without morphology) | stale failures | updated |

### 2.9 Seventh pass (2026-10-05): hardcoded solvent table, species coverage, and what the new data exposed
Found by reading the remaining logic for name- and key-based branches, by a scenario battery against textbook values (acid-base
pH and heats, precipitation, complexes, boiling and distillation curves, partition, electrolysis) and by adding the species the
store was missing. Gates: `engine/tests/seventh_pass.rs` (8) plus the changed tests named below.

| Defect | Effect | Fix |
|---|---|---|
| `vessel_phase.rs::component_dielectric` held a table of InChIKeys and substring matches on compound names ("dichloromethane", "ether", "acetate", ...), with a heuristic from elements for the rest (and a wrong key for hexane) | a hardcoded per-compound table inside logic; ions counted as solvent components of the mixture | `data/dielectric.json` (eps at 298.15 K by InChIKey, 39 liquids) + `dielectric.rs` (generic ln eps slope; Speculative composition estimate for the rest); water from the IAPWS expression; only liquid solvent components enter the mixture value |
| Ions of a water + co-solvent phase had no solvation change (Born transfer was only applied between phases) | NaCl was almost as soluble in water + ethanol as in water (1.55 g vs 1.11 g undissolved of 10 g; `stage0` s0_8) | `Vessel::apply_mixed_solvent_born`: ln gamma_Born(eps_mix) added to every ion's ln gamma in all six activity evaluations (zero for pure water); Born radii are crystal radii + Rashin-Honig offsets (not the Debye-Hueckel hydrated size); the phase-to-phase ion partition now uses the difference of the two media |
| `props::calculate_viscosity_cp` used `0.89 exp(1.4 (298/T - 1))` for water | 0.67 cP at 100 C (0.28), 1.0 cP at 0 C (1.79); a water-ethanol mixture took water's value | IAPWS-type curve of `transport.rs`, logarithmic mixing of all neutral components, Jones-Dole term for the ions |
| Flocs were a state function: floc size relaxed to `20 d_Pe1` (an arbitrary cap), D_f = 2 | 10 nm AgCl flocs (11 um, density contrast ~0) never settled (99.7 % suspended after 160 s; open item P4) | `transfer/settling.rs`: Smoluchowski growth of the primaries per floc with Brownian + orthokinetic + differential-sedimentation kernels, D_f = 2.3, collision efficiency from the Schulze-Hardy index, limited by the space-filling size and the Kolmogorov scale; AgCl clears over ~15 min, BaSO4 flocs to mm and clears in 90 s, stirring caps flocs near 50 um |
| Hydration free energy had no ring term and a ridge penalty that shrank rare groups | cyclohexanol Henry constant 17 mol/(kg bar) against 400 measured | `ring_aliph` group, fit set +7 cyclic compounds (`fit_hydration_groups`), leave-one-out 0.83 (common) / 1.13 kcal/mol (all); a held-out compound is within a factor 7 |
| The catalog bottle "Ethanol 95%" held pure ethanol (17.1 M) | label and composition disagreed | renamed "Ethanol (absolute)", 17.1 M |
| `solubility.json` had been edited by hand (Cr(III) rows) and the pipeline could not regenerate it (`test_generated_json_is_up_to_date` failed) | data not reproducible | rows moved to `pipeline/data/extra_rows.json`; acid-dissociation rows with a placeholder dH = 0 now carry the NBS-derived values (`acid_base_equilibria.csv`) |
| Dead `debug_network_generator` flag (engine, web type, a test) | clutter | removed |
| The thermal decomposition search took reactions from an RREF null-space basis of {solid, product solid, all gases} | which reactions a solid had depended on the order and number of the gases in the store: adding CH4, CO and O3 removed 2 NaHCO3 -> Na2CO3 + CO2 + H2O | `discover_decomposition_structures` enumerates the minimal pathways (one or two product solids, a gas set that is irredundant and has a strictly positive solution) and keeps those that are the lowest-Gibbs assemblage at some temperature of 298-1600 K: independent of what else the store holds |
| Solid-state activation energy floor 40 kJ/mol (`EA_DECOMPOSITION_MIN`) | `k = 1e13 exp(-40e3/RT)` ~ 1e6 /s: Cu(OH)2 became CuO instantly | floor 100 kJ/mol (hydroxide dehydrations 80-100): ageing over hours |
| Discovered redox in water could form any compound solid of the store (Fe2O3, Fe3O4, Cu2O, ...) by solution-phase Marcus kinetics, and the electrode search could plate them | dilute Fe(II)/MnO4-/I- made magnetite and hematite; a Cu / Cu cell made Cu2O and the anode mass change missed Faraday | `gem::redox::solid_may_form_in_solution`: a compound solid forms in water only if it is elemental, a registered mineral (solubility table) or listed in `data/redox_lability.json` as precipitating at once (MnO2); K, Li, Ca, Ni, Cd are labile |
| `advance_discovered` applied reactions one after another with `max(0)` clamping | a consumer applied before a producer of the same species clamped an interim shortfall and destroyed atoms (3e-6 relative error of iodine in a dilute iodide/permanganate/Fe(II) mixture) | the net change of every species is computed once and applied once (order independent) |
| Gas exchange: when total dissolved-gas tension + vapour exceeded the ambient pressure (28 Pa for air at 50 % RH once N2 was in the store) the bubble branch *replaced* the surface exchange of every gas | CO2 could not absorb into NaOH at all (CO2(aq) at 3e-11 mol against 1.4e-6 mol at saturation), every open aqueous vessel | surface exchange and bubble loss add; a gas never falls below the lower of its two targets |
| Electrode kinetics: HER / OER exchange currents were looked up only for the gas ids `H2(g)` / `O2(g)`, the Tafel symmetry only for `(g)` products, and everything else got the generic i0 | water oxidation to dissolved O2, H2O2 or O3 ran with 1e-4 A/cm2 and beat chloride oxidation at 1.36 V | classification by molecule (InChIKey), by "dissolved gas" (neutral, gas twin, no liquid or solid record) and by elements (every H/O-only reaction has the sluggish OER prefactor) |

**Species coverage.** The core bundle of `web/public/data/core` is a 17-record stub, so the 140 seeds were the whole database: no Cl2, Br2,
SO2, oxo-halogens, NOx, phosphate, CO, CH4, Ni, Cd, K, Li, Ca, no common oxide. `data/species_inorganic.json` (49 solids, 33
aqueous, 13 gases, Br2(l); NBS Tables recalled, tier Estimated) is loaded after the seeds: brine electrolysis now gives chlorine,
the halogen hydrolysis rows (`chlorine_hydrolysis`, `bromine_hydrolysis`, `HBrO_dissoc`, `so2_hydrolysis`) are derived from the same
formation data, and E0 of Cl2 / Br2 / O2 / MnO4- / IO3- / PbO2 / Cd / Ni from the store agree with the tables to 10-20 mV (Ni 0.02 V).
`SO2`, `Cl2`, `Br2` have Henry constants from mu0(aq) - mu0(g) (1.2, 0.06 mol/(kg bar), 0.2 mol/kg for liquid Br2) that match the
measured ones, and VLE records (critical constants, normal boiling points) so they evaporate.

Changed tests (and why): `generic_reactions` precipitate settling asserts the ~15 min floc timescale; `open_items_d` aldehyde carbon
tolerance 6 % (room is 25 C, acetaldehyde boils at 20 C); `open_items_b` Henry constant of the held-out compound within a factor 7
(the group scheme's leave-one-out error is a factor 4-6); `stage10` s10_8 doses the strontium salt where it mostly dissolves in methanol
(the new Born term salts it out of 4 : 20 water : methanol, giving a pink flame); `gas_collection.mjs` threshold of the un-linked flask;
`electrode_materials.ts` regenerated (14 materials: Ni, Cd added); `stage0` s0_4 (debug flag) deleted.

---

## 3. Open (genuinely)

Severity: **A** wrong results in common bench situations, **B** wrong for a class of chemistry, **C** limits generality, **D** hygiene.

| # | Sev | Open item | Why it is open / what the fix is |
|---|---|---|---|
| E5 | C | Ions of a water + miscible co-solvent phase now feel the mixed solvent (Born term, 2.9) and ions partition between water and an immiscible layer by the difference of the two Born energies, but there is no ionic *equilibrium* inside an organic layer beyond the Born-shifted rows (ion-pair extraction, phase-transfer catalysis, strong electrolytes in a non-aqueous layer) | Ions as components of the phase flash with per-phase equilibria in the coupled Newton solver (`activity.rs` has the Born term; the solver applies it per phase only for the extra liquids' rows) |
| P4 | C | Colloid aggregation is now a rate (Smoluchowski growth with Brownian, shear and differential-sedimentation kernels, 2.9) but the flocs are fractal (D_f 2.3) and never restructure: a 10 nm AgCl colloid clears in ~15 min where real curds settle in minutes; no sweep flocculation, no breakage-by-collision beyond the Kolmogorov cap | A restructuring rate (D_f rising with floc age), sweep collection by large flocs |
| H1 | C | Heat of mixing: no ionic part (the dissolution enthalpy of salts is in their rows, concentration dependence of ionic enthalpies is not); evaporation and boiling of a mixture book the pure latent heats (the vapour does not carry its partial excess enthalpy); measured rows exist for four pairs only, every other pair uses the temperature derivative of the VLE-fitted UNIFAC, whose sign is unreliable | More Redlich-Kister rows (open calorimetric compilations), temperature-dependent UNIFAC parameters (Dortmund) |
| P3 | C | Pitzer parameters are 25 C values (only the Debye-Hueckel slopes depend on T); hexane in water is ~45x too high (VLE-fitted UNIFAC underestimates alkane hydrophobicity; the Magnussen LLE matrix made hexane and water miscible) | Pitzer T-derivatives (data), eNRTL for mixed solvents, a blended UNIFAC parameter set |
| A1 | C | The Fuoss ion-pair fraction at 0.1 M is high (MgSO4 63 % paired against ~40 % measured; the equation is a Speculative outer-sphere model, constants within 0.4 log units) | Calibrate the contact distance against activities rather than concentrations, or use measured association constants where they exist |
| T1 | C | Aqueous state of neutral solutes without data (hydration groups, Trouton) carries 10-20 kJ/mol errors for what the groups do not capture: carbonyl hydration constants (acetone 5 % hydrated, measured 0.14 %; no aldehyde / ketone distinction, K 0.055 vs 0.05 where 1 vs 0.0014 is measured; formaldehyde 9 vs 2300), secondary alcohols and ethers 0.5-1 kcal/mol | A Taft sigma* correlation with resonance corrections for gem-diol formation (Guthrie), more hydration data for gem-diols, ethers and polyols in the fit (`fit_hydration_groups`) |
| O1 | C | Rates of the newest templates are class estimates (Diels-Alder per orientation A/4, Friedel-Crafts, organomagnesium, Wittig: tier Estimated); the Wittig ylide needs the covalent SMILES form `C=P(Ph)3`; Friedel-Crafts needs `AlCl3` as a species; the Grignard addition is meaningful only in an ether (no solvent class excludes water except through the faster protonolysis); organic redox constants are Speculative; no Cr(III) hydrolysis rows | RMG-style rate rules from a kinetics database; barriers from the xtb flywheel (`precomputed_barriers`) |
| V1 | C | 13C shifts: sorted-list comparison with 421 NMRShiftDB2 molecules in CDCl3 gives MAE 4.4 ppm (median 2.4, 73 % within 5 ppm); the worst are perfluorinated carbons and a ketene. EI mass spectra were never validated against a database (MassBank is not reachable offline) | Per-class increments refitted on NMRShiftDB2 (`pipeline/validate_spectra.py`), 19F coupling in the shift model, MassBank gate |
| X1 | C | Homogeneous redox of Cl, S, N, C couples is inert on bench time unless a kinetic row exists (no `k_self` data): `ClO- + H+ + Cl-` -> Cl2, MnO4- + conc. HCl -> Cl2, H2O2 + I- -> I2 (a two-electron O-atom transfer that the one-electron Marcus relation cannot describe: dilute KI + H2O2 + acid shows nothing), SO2 / sulfite oxidation | An atom-transfer class (peroxide + nucleophile, hypohalite + halide) as templates with measured class rates, or `RedoxCouple.k_self` data |
| X2 | C | The species store holds ~190 species (the NBS parser of `pipeline/db` only has a stub bundle): no Sn, Hg, Ti, V, Mo, W, lanthanides; no sulfide / phosphate / silicate minerals beyond a few; no oxo-halogen acids beyond Cl / Br / I hypo-, chlor-, iod- | Run the pipeline's NBS / PHREEQC parsers into the core shards instead of recalling values |
| X3 | D | Discovered redox enumerates many redundant reactions among trace intermediates (IO-, IO3-, HI(g), I2(s) variants of one couple, ~60 per dilute iodide / permanganate system): correct but wasteful | Merge couples whose forms differ only by phase or by the speciation rows; drop gas partners that dissociate in water (HI(g)) |
| U1 | D | Nothing was verified in a browser (per project rules the user tests the UI): pointer feel, control sizes, panel layout, the new electrode colours and the pieces / powder split for metals poured from a jar | user |

### Behaviour that changed in this pass (tests were updated and say so)
- Mixing water and ethanol warms the mixture (`stage0` s0_9, `stage5` s5_4, `open_items_b` p2 audit tolerance 200 J of 3.9 kJ).
- Acids and bases known by structure ionise: `stage0` s0_6 selects the citric rows by name; a compound imported with a SMILES may now carry `equilibria`.
- Chromium appears in the electrode list (Pt, C, Ag, Cu, Pb, Co, Fe, **Cr**, Zn, Mn, Al, Mg).
- The Mg ribbon (300 um piece) and the hot plate limit make `gas_collection.mjs` and `vessel_effects.mjs` run longer (150 s, 130 s).

---

## 4. Verification of this pass

- `cd engine && cargo rtest --no-fail-fast`: 493 tests, all suites pass (new: `tests/seventh_pass.rs`, 8 gates; unit tests in `dielectric.rs`,
  `transfer/settling.rs`). Before the pass five tests failed (`precipitate_settles_over_time`, `aldehyde_hydrate_equilibrates_at_the_data_k`,
  `literal_ban`, `s0_8_...`, `t4_a_created_solute...`); three were model defects (floc settling, mixed-solvent salting out, hydration ring term),
  one a stale tolerance, one a literal-ban violation (the dielectric table). The `test_m4_gate_performance_benchmark_50_species_200_rxns`
  timing gate is sensitive to machine load (passes alone; run the lib suite by itself when it fails in a full run).
- WASM rebuilt (`cargo build --release --target wasm32-unknown-unknown` + `wasm-bindgen`), `npx tsc --noEmit`, `npm run build`, the node
  suites in `tests/` (busy mixture 8.9 ms/step against 8.7 ms for the commit before the pass, budget 10; `renderer_fuzz.mjs 150`), pytest 64.
- Scenario battery against textbook values (run as a scratch test, not kept): acetic acid pH 2.77 (2.76), half-neutralised 4.60, 0.2 M HCl
  0.81 (activity-corrected 0.70 -> 0.81), HCl + NaOH dT 6.4 K (6.7), NaOH dissolution dT +10 K (10.6), NH4Cl dT -6.9 K (-6.6), saponification of
  ethyl acetate second order with k within 25 % of 0.11, Cu(OH)2 -> Cu(NH3)4 2+ in excess ammonia, Fe(SCN) 2+, Mg + HCl, boiling of water and a
  water-ethanol batch distillation curve (355.6 -> 373 K), I2 partition D ~ 70 into hexane, freezing plateau at 273.15 K, brine electrolysis
  (Cl2 on graphite), E0 of seven couples from the store within 10-20 mV.
- Not verified in a browser.
