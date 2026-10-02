# Compounds, not "solids" and "liquids": phase from conditions

Goal (user): every substance — reagent, imported compound, or reaction product — is one kind of thing, a *compound*
(identity + thermodynamic/physical data from PubChem). Its phase (solid / liquid / gas / dissolved) is derived from the
vessel's temperature and contents at run time, never stamped at import. A product is imported exactly like a reactant,
so it can be a reactant in the next reaction.

## Design invariant (user, standing)
Rely on *intrinsic* per-compound values (ΔfH°, S°, Cp parametrisation, ...); derive everything that depends on external factors
(melting/boiling, vapour pressure, solubility, phase) with equations and models. Recorded in CLAUDE.md > Design invariants.

## Done
- [x] Unlisted precipitates: engine queues rule-guessed solids (`solubility::request_lookup`), web fetches PubChem
      (solubility → Ksp, colour, density, name, kind), `resolve_mineral` replaces the guess; product is added to the
      reagent library via the normal import path (`web/src/pubchem/solid_*.ts`, `app/mineral_resolver.ts`).
- [x] Importing a salt reuses the same solid record as precipitation (`solubility::mineral_for_import`).
- [x] Charge-free PubChem SMILES ("Cl[Ag]") no longer hides ionic salts (`compound_model.rs`).

## Contract (TS <-> engine)
Principle: mp/bp are values at ~1 atm, so they are never stored as state-defining properties. Only data that is nearly
pressure-independent, or that parametrises a curve, is ported from PubChem; phase is derived from T and vessel pressure.
`CompoundRequest` (web -> `import_compound`), all optional: `vapor_pressure_points` [(T_K, P_Pa)] (PubChem 'Vapor
Pressure' points plus the normal boiling point as just one more point (Tb, 101325)), `dh_vap_kj_mol` + `dh_vap_at_k`,
`t_melt_ref_k` (one point on the solid-liquid curve), `dh_fus_kj_mol`, `dh_comb_kj_mol` (-> standard enthalpy of
formation by Hess's law), `density`, `solubility_g_per_l`, `color_linear_rgb`, `state` (hint only).
`CompoundModel` (engine -> web) adds `state_at_room` (derived), `phase_model` ("ionic"|"neutral"|"inert") and
`thermo` { dhf_kj_mol, dh_vap_kj_mol, dh_fus_kj_mol, normal_bp_k (derived from the fitted curve), normal_mp_k,
estimated[] }. `modelable` is false only for unparseable formulas / unknown elements: organics with no reaction
chemistry are `inert` compounds - physically present (phases, heat, boil-off, dissolution) but not reacting.

## Engine (Stage E) - done
- [x] `CompoundThermo` per compound (`engine/src/compound_thermo.rs`, registry in `chem_db`): intrinsic values (mw, ΔfH° from
      the heat of combustion by Hess's law, optional S° / Cp / Shomate coefficients, ΔHfus, ΔHvap) and curve anchors (vapour
      pressure curve fitted to every (T,P) point, melting reference at 1 atm + Clapeyron, 25 C solubility with optional
      van't Hoff slope, reference densities). No stored mp/bp/state: `state_at_room` and the normal bp are derived.
      Estimates (Walden/Richard for ΔHfus, Trouton for ΔHvap, Dulong-Petit Cp) are labelled in `thermo.estimated`.
- [x] Inert compounds (`phase_model: "inert"`, `engine/src/vessel_phase.rs`): per-vessel total split into `X(s)` solid,
      `X(l)` neat liquid, dissolved `X`; melt/freeze plateau at the Clapeyron-shifted melting reference with latent heat,
      boil-off where the fitted vapour pressure reaches ambient pressure (unsealed vessels), dissolution capped by solubility.
- [x] Snapshot: undissolved solid -> `SolidVisual`, immiscible neat liquid -> `LiquidLayer` (own density, colour, `species`,
      `name`), vapour -> `gas_fluxes`, species rows `X(s)` solid / `X(l)` organic / `X` aqueous (compound name in `name`).
- [x] Dosing form from the derived `state_at_room` (solid -> mass, liquid -> neat by volume, gas -> 0.1 M solution); ionic
      salts keep their Ksp solid; a supplied solubility feeds `solubility::apply_solubility` (same derivation as `resolve_mineral`).
- [x] cargo tests (`engine/tests/compound_phases.rs`: melting plateau, boil-off, solubility, state table, dose-size
      independence, salts, web-shaped JSON), WASM rebuilt, node engine tests pass.

## Web (Stage W)
- [x] Import records carry thermo + colour + solubility into `CompoundRequest`; remove `importIsSolid` stamping.
- [x] Amount mode (g / mL) from `state_at_room`; PubChem-imported compounds are engine compounds, not
      `VisualContents` (keep ghost piles only).
- [x] Products imported via `MineralResolver` use the same path (`addImportedRecord` -> `modelImported`).
- [x] tsc, `npm run build`, node tests (`tests/thermo_parser.mjs`, `tests/solubility_parser.mjs`, ...).
- [ ] Verify against the real engine once Stage E lands (see "Web field names" below: `state_at_room`, `phase_model`,
      `thermo`, and that inert compounds return a dosing `entry`).

### Web field names (what Stage W sends / reads; supersedes mp_c / bp_c / density_liquid in the Contract above)
`sim.importCompound({...})` = `CompoundRequest` (web/src/types/sim.ts), every field optional except id/name/formula:
`density` (g/mL, only when PubChem gave one), `state` (PubChem text hint only), `vapor_pressure_points: [[T_K, P_Pa], ...]`
(PubChem "Vapor Pressure" points + boiling points quoted at a reduced pressure + the 1-atm normal bp as `[Tb, 101325]`;
omitted = non-volatile), `dh_vap_kj_mol`, `dh_vap_at_k`, `t_melt_ref_k` (mp + 273.15), `dh_fus_kj_mol`,
`dh_comb_kj_mol` (negative), `solubility_g_per_l`, `color_linear_rgb`. Unknown values are omitted, never placeholders.
Reads from `CompoundModel`: `modelable`, `reason`, `entry` (must be non-null for inert compounds: it carries `by_mass`
and is what doses them), `by_mass`, `state_at_room`, `phase_model` ('ionic'|'neutral'|'inert'), `thermo`
(`dhf_kj_mol?, dh_vap_kj_mol?, dh_fus_kj_mol?, normal_bp_k?, normal_mp_k?, estimated: string[]`; the UI prints derived
melting / boiling points from it).
Web-side pieces: `pubchem/thermo_parser.ts` (pure parsers: heats of fusion / vaporization / combustion, vapour-pressure
points, reduced-pressure boiling points), `pubchem/record_builder.ts` (fills `SpeciesRecord.physical` + `known` flags),
`pubchem/parser.ts` (`phaseAtRoom`, `effectiveThermo`, `vaporPressurePoints`, `importPhase`; `importIsSolid` removed),
`app/reagent_library.ts` (`itemPhase`, `describeModel`).

## Not covered (stated limits)
- Most ionic solids melt far above bench temperatures; molten salts are not modelled.
- Reaction chemistry for organics (no templates run on inert compounds yet).
- Gas-phase products (`gas_evolved`) are not yet looked up on PubChem.
