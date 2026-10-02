// M5 contract: the ONLY interface between the WASM chemistry engine and everything visual/UI.
// The renderer and instruments never decide chemistry; they only read a VesselSnapshot.
// Rust mirror lives in engine/src/vessel.rs (serde field names are identical, snake_case).

import type { ProvenanceTier, VesselType } from './index';

/** Number of wavelength bins in every spectrum: 400..710 nm in 10 nm steps (bin i centre = 400 + 10*i). */
export const N_BINS = 32;
export const BIN_NM0 = 400;
export const BIN_STEP_NM = 10;

/** Returned once by WASM `optics_tables()`; consumed by the liquid shader (and nothing else needs CMFs). */
export interface OpticsTables {
  n_bins: number;
  /** length N_BINS*3. Linear-sRGB weights per bin (illuminant D65, white-balanced so a bin-wise T=1 gives rgb=(1,1,1)). */
  rgb_weights: number[];
}

export type PhaseKind = 'aqueous' | 'organic';

export interface LiquidLayer {
  phase: PhaseKind;
  volume_ml: number;
  density_g_ml: number;
  refractive_index: number;
  /** Decadic absorbance per cm of path, per bin (A = sum eps_i * c_i). Beer–Lambert: T_bin = 10^(-a * pathCm). length N_BINS */
  absorbance_per_cm: number[];
  /** Turbidity of suspended solid, 1/cm (natural-log extinction by scattering). 0 = optically clear. */
  scatter_per_cm: number;
  /** Linear-RGB colour of light scattered by the suspended solid (its body/reflectance colour). */
  scatter_rgb: [number, number, number];
}

export type SolidKind = 'powder' | 'crystal' | 'metal' | 'gel' | 'curds';

export interface SolidVisual {
  species: string;
  name: string;
  mass_g: number;
  /** Bulk volume of the settled bed (includes packing voids). */
  settled_volume_ml: number;
  /** 0..1 fraction of this solid's mass currently suspended in the liquid (rest is settled/resting). */
  suspended_fraction: number;
  /** Representative particle diameter, micrometres (drives Stokes settling and scattering). */
  particle_diameter_um: number;
  /** Linear-RGB reflectance colour of the dry/wet solid. */
  rgb: [number, number, number];
  kind: SolidKind;
  /** True when the solid is floating or clinging (e.g. a metal ribbon fizzing) rather than a bed. */
  floating?: boolean;
  /** Fraction of this solid still undissolved/unreacted relative to what was added (for shrinking pieces). 0..1 */
  remaining_fraction?: number;
}

export interface GasFlux {
  species: string;
  /** Volumetric evolution rate of free gas bubbles leaving solution, mL/s at current T and P. */
  rate_ml_s: number;
  /** Typical bubble diameter, mm (clean glass ~3-5; surface-active/foaming ~1-2; nucleation on solids ~0.5-1). */
  bubble_diameter_mm: number;
  /** Where bubbles nucleate. 'solid' = on surface of undissolved solid; 'bulk' = throughout liquid; 'wall' = glass wall. */
  nucleation: 'bulk' | 'wall' | 'solid';
}

export interface FumeVisual {
  species: string;
  /** Mass-flow-ish scale 0..1 normalised so 1 ≈ a dense visible plume. */
  intensity: number;
  /** Linear-RGB colour of the visible fume (NO2 brown, Cl2 pale yellow-green, I2 violet, white HCl mist...). */
  rgb: [number, number, number];
  opacity: number;
  /** Heavier than air → rolls over the lip and falls (Cl2, NO2, I2). */
  denser_than_air: boolean;
}

export interface FlameVisual {
  fuel: string;
  /** Heat release, watts. */
  power_w: number;
  /** 0..1: sootiness. 0 = clean blue (premixed/ethanol), 1 = luminous yellow sooty. */
  luminosity: number;
  /** Colour temperature of the emitting zone, K (for blackbody tint of yellow part). */
  flame_temp_k: number;
  /** Optional flame-test emitter (Na yellow, Cu green, Li red...). */
  emitter_rgb?: [number, number, number];
}

export type VesselEventKind =
  | 'burst'            // sealed vessel over-pressured: stopper ejected or glass shattered
  | 'stopper_pop'
  | 'ignition'
  | 'flame_out'
  | 'boil_over'
  | 'splatter'
  | 'dry_out'
  | 'conservation_warning'
  | 'solver_warning'
  // Generic reaction log (derived by the engine from state differences; `detail` is a readable sentence)
  | 'precipitate_formed'
  | 'solid_dissolved'
  | 'gas_evolved'
  | 'colour_change'
  | 'temperature_change'
  | 'complex_formed';

export interface VesselEvent {
  kind: VesselEventKind;
  t_sim_s: number;
  detail?: string;
  /** 0..1 */
  severity?: number;
  /** Monotonic per-vessel sequence number; the engine caps the event list, so use this (not array length) as a cursor. */
  seq?: number;
  /** Engine species id the event is about, e.g. "AgCl(s)". */
  species?: string;
  /** Linear-sRGB colour of the precipitate / solution the event describes. */
  rgb?: [number, number, number];
}

export interface SpeciesRow {
  id: string;
  name: string;
  formula: string;
  charge: number;
  phase: 'aqueous' | 'solid' | 'gas' | 'organic';
  amount_mol: number;
  /** Molar concentration in its liquid phase (null for solid/gas). */
  conc_m: number | null;
  /** Activity (dimensionless, solutes: γ·c/c°; solids: 1; gas: partial pressure in atm). */
  activity: number | null;
  /** Provenance of this species' thermo data. */
  tier: ProvenanceTier;
}

export interface ReactionRow {
  id: string;
  /** Human equation, e.g. "NaHCO3(s) + CH3COOH → CO2(g) + H2O + CH3COONa" */
  equation: string;
  kind: 'equilibrium' | 'kinetic' | 'phase-transfer' | 'combustion';
  /** Net rate, mol/(L·s) of reaction extent (positive = forward). For equilibria: the instantaneous relaxation flux. */
  rate: number;
  /** Fraction of how far from equilibrium (log10 Q/K) for equilibria; null for kinetic. */
  log_q_over_k: number | null;
  tier: ProvenanceTier;
  /** Citation / basis, shown in advanced view. */
  source: string;
  /** True if rate is non-negligible this tick. */
  active: boolean;
}

export interface ConservationInfo {
  ok: boolean;
  max_element_rel_err: number;
  charge_err_mol: number;
  energy_rel_err: number;
}

export type CollectorKind = 'syringe' | 'over_water' | 'jar';

export interface GasInfo {
  /** Set for gas syringes / gas collection tubes / gas jars. */
  collector: CollectorKind | null;
  species: { species: string; mol: number }[];
  total_mol: number;
  /** Volume the gas occupies at the vessel temperature and ambient pressure, mL. */
  volume_ml: number;
  /** Collector capacity, mL (0 for ordinary vessels). */
  capacity_ml: number;
  /** Gas that did not fit and escaped into the room, mol. */
  escaped_mol: number;
  /** Water-vapour partial pressure in the collected gas (collection over water), atm. */
  vapour_atm: number;
}

export interface VesselSnapshot {
  t_sim_s: number;
  temperature_k: number;
  room_k: number;
  /** Liquid-phase temperature of the thermal bath if one is attached, else null. */
  bath_k: number | null;
  /** Total headspace pressure, atm. Open vessel: 1.0 (= ambient). */
  pressure_atm: number;
  sealed: boolean;
  /** Vessel has failed (glass burst). Stopper-pop sets sealed=false and emits an event instead. */
  burst: boolean;
  /** Thermodynamic pH (−log10 a_H+) of the aqueous phase, null if there is none. */
  ph: number | null;
  ionic_strength: number | null;

  /** Bottom → top. */
  layers: LiquidLayer[];
  total_liquid_ml: number;
  solids: SolidVisual[];

  gas_fluxes: GasFlux[];
  /** 0..1 how much of the liquid surface is covered by persistent foam (CO2/O2 fizzing in surfactant-like or viscous liquid). */
  foam: number;
  /** 0..1 strength of boiling (bubbles of vapour in the bulk). 0 below boiling point. */
  boil_intensity: number;
  /** Evaporation mass flow, g/s (all volatile liquids). */
  evaporation_g_s: number;
  /** 0..1 visible-vapour factor: steam plume above hot water, mist when cold gas dissolves, etc. */
  vapour_visibility: number;
  /** 0..1 fogging of the inner glass above the liquid (condensation). */
  condensation: number;
  fumes: FumeVisual[];
  flame: FlameVisual | null;

  /** Mass of contents (liquids + solids), grams. Balance adds the empty-vessel glass mass itself. */
  contents_mass_g: number;
  /** Mass of species that left as gas/vapour/combustion products so far, g (balance drifts when open). */
  mass_lost_g: number;
  heat_input_w: number;
  net_reaction_heat_w: number;

  /** Advanced view only; engine always fills these. */
  species: SpeciesRow[];
  reactions: ReactionRow[];
  conservation: ConservationInfo;
  events: VesselEvent[];
  /** Collected gas (collectors) or evolved gas trapped in the headspace of a stoppered vessel. */
  gas?: GasInfo;
}

// ------------------------------------------------------------------ commands
export interface VesselConfig {
  type: VesselType;
  capacity_ml: number;
  /** Empty glass mass, g. */
  glass_mass_g: number;
  /** Inner radius at the liquid surface region, cm (for headspace volume / evaporation area). */
  inner_radius_cm: number;
  temperature_k?: number;
  room_k?: number;
  sealed?: boolean;
  /** Pressure at which the closure pops (stopper), atm absolute. Default 2.2. Glass bursts at burst_atm (default 6). */
  stopper_pop_atm?: number;
  burst_atm?: number;
}

/** A thing poured/dosed into a vessel. Engine resolves ids against its species/reagent catalog. */
export interface DoseRequest {
  /** Catalog reagent id (see ReagentCatalogEntry) */
  reagent_id: string;
  /** Exactly one of: */
  volume_ml?: number;   // liquids and solutions
  mass_g?: number;      // solids
  drops?: number;       // 0.05 mL each, for droppers
  temperature_k?: number;
}

/** Carried between vessels on pour so species are conserved. */
export interface Portion {
  volume_ml: number;
  temperature_k: number;
  /** species id → moles, per phase kind. */
  aqueous_mol: Record<string, number>;
  organic_mol: Record<string, number>;
  /** Solids carried over with the slurry (species → mol); suspended fraction goes first. */
  solid_mol: Record<string, number>;
}

export interface VesselControls {
  heater_w?: number;           // hot-plate power delivered to the vessel, 0..1000
  stirring?: boolean;          // magnetic stirrer
  stir_rpm?: number;
  sealed?: boolean;
  /** Thermal bath (ice bath = 273.15). null removes it. */
  bath_k?: number | null;
  /** Burner/igniter held at the vessel: ignites flammable vapour when true. */
  igniter?: boolean;
  /** Direct burner flame heating, watts (0 = off). */
  burner_w?: number;
}

export interface ReagentCatalogEntry {
  id: string;
  name: string;
  formula: string;
  form: 'solid' | 'liquid' | 'solution';
  /** For solution: the solute concentration. */
  concentration_m?: number;
  density_g_ml: number;
  ghs: string[];             // GHS pictogram codes: GHS01..GHS09
  signal_word: 'Danger' | 'Warning' | '';
  bottle_colour: 'amber' | 'clear' | 'white';   // glass tint of the bottle
  /** Species id → mol per mL (solution/liquid) or per g (solid). Lets the UI describe contents. */
  composition: Record<string, number>;
  /** Species id of the main compound this entry's label shows. */
  label: string;
  /** If true, solid is added by mass (spatula/balance); otherwise by volume. */
  by_mass: boolean;
  /** Hint for UI: dropper bottle (indicators) dosed in drops. */
  dropper?: boolean;
}

/** Messages the simulation worker understands (added to the existing PING/WASM_ROUNDTRIP/... set). */
export type SimRequest =
  | { type: 'VESSEL_NEW'; payload: { config: VesselConfig }; requestId: string }
  | { type: 'VESSEL_FREE'; payload: { handle: number }; requestId: string }
  | { type: 'VESSEL_DOSE'; payload: { handle: number; dose: DoseRequest }; requestId: string }
  | { type: 'VESSEL_ADD_PORTION'; payload: { handle: number; portion: Portion }; requestId: string }
  | { type: 'VESSEL_REMOVE_LIQUID'; payload: { handle: number; volume_ml: number; include_solids?: boolean }; requestId: string }
  | { type: 'GAS_LINK'; payload: { src: number; dst: number }; requestId: string }
  | { type: 'GAS_UNLINK'; payload: { src: number }; requestId: string }
  | { type: 'GAS_VENT'; payload: { handle: number }; requestId: string }
  | { type: 'VESSEL_REMOVE_LIQUID_BOTTOM'; payload: { handle: number; volume_ml: number; include_solids?: boolean }; requestId: string }
  | { type: 'VESSEL_CONTROL'; payload: { handle: number; controls: VesselControls }; requestId: string }
  | { type: 'VESSEL_STEP'; payload: { handle: number; dt_s: number }; requestId: string }
  | { type: 'VESSEL_SNAPSHOT'; payload: { handle: number }; requestId: string }
  | { type: 'VESSEL_EQUILIBRATE'; payload: { handle: number; max_sim_s?: number }; requestId: string }
  | { type: 'STEP_ALL'; payload: { handles: number[]; dt_s: number }; requestId: string }
  | { type: 'OPTICS_TABLES'; payload: {}; requestId: string }
  | { type: 'REAGENT_CATALOG'; payload: {}; requestId: string };

/** Request to model an imported compound as a reacting reagent (engine `import_compound`). */
export interface CompoundRequest {
  id: string;
  name: string;
  formula: string;
  smiles?: string;
  mw?: number;
  density?: number;
  state?: 'solid' | 'liquid' | 'gas';
  molarity?: number;
  ghs?: string[];
}

/** Engine's answer: `modelable=false` means the compound stays visual-only. */
export interface CompoundModel {
  modelable: boolean;
  /** Human-readable explanation, e.g. "Modelled as salt: K+ + Cl-". */
  reason: string;
  kind: 'salt' | 'acid' | 'base' | 'molecule' | 'none';
  entry: ReagentCatalogEntry | null;
  species: Array<[string, number]>;
  mw: number;
  by_mass: boolean;
}
