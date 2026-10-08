// M5 contract: the ONLY interface between the WASM chemistry engine and everything visual/UI.
// The renderer and instruments never decide chemistry; they only read a VesselSnapshot.
// Rust mirror lives in engine/src/vessel.rs (serde field names are identical, snake_case).

import type { ProvenanceTier, VesselType } from './index';

/** Number of wavelength bins in every spectrum: 380..780 nm in 10 nm steps (bin i centre = 380 + 10*i). */
export const N_BINS = 41;
export const BIN_NM0 = 380;
export const BIN_STEP_NM = 10;

/** Returned once by WASM `optics_tables()`; consumed by the liquid shader (and nothing else needs CMFs). */
export interface OpticsTables {
  n_bins: number;
  /** length N_BINS*3. Linear-sRGB weights per bin (illuminant D65, white-balanced so a bin-wise T=1 gives rgb=(1,1,1)). */
  rgb_weights: number[];
  /** Hash of the engine's optical data and models: caches of derived colours (bottle colours) key on it. */
  data_version?: string;
}

export type PhaseKind = 'aqueous' | 'organic';

export interface LiquidLayer {
  phase: PhaseKind;
  volume_ml: number;
  density_g_ml: number;
  refractive_index: number;
  /** Decadic absorbance per cm of path, per bin (A = sum eps_i * c_i). Beer–Lambert: T_bin = 10^(-a * pathCm). length N_BINS */
  absorbance_per_cm: number[];
  /** Extinction of the suspended solids per bin, 1/cm (natural log; Mie, absorption included). All 0 = optically clear. length N_BINS */
  scatter_per_cm: number[];
  /** Single-scattering albedo of the suspended solids per bin (scattered / extinguished). length N_BINS */
  scatter_albedo: number[];
  /** Weakest provenance tier of the optical data behind the layer's colour. */
  colour_tier?: ProvenanceTier;
  /** Where the colour comes from (data source / model), for the Details drawer. */
  colour_sources?: string[];
  /** Solvent class the absorption was evaluated in: water | alkane | aromatic | alcohol | other. */
  solvent_class?: string;
  /** Species id / display name of the main component of a non-aqueous layer. */
  species?: string;
  name?: string;
  /** What a glass pH electrode with a 3 M KCl bridge reads in this layer (molal pH shifted by the liquid junction); absent without water or where water is under half the solvent. */
  ph?: number;
  /** Thermodynamic molal pH of the layer, -log10(m_H gamma_H). */
  ph_activity?: number;
  /** Junction potential (mV, sample minus bridge) behind the difference between the two. */
  ph_junction_mv?: number;
  /** Mole fraction of water among the layer's molecules (ions left out). */
  water_mole_fraction?: number;
  /** Transport properties of the layer at the vessel's temperature (a probe's film coefficient). */
  viscosity_mpa_s?: number;
  specific_heat_j_g_k?: number;
  thermal_conductivity_w_m_k?: number;
  expansivity_per_k?: number;
}

export type SolidKind = 'powder' | 'crystal' | 'metal' | 'gel' | 'curds';

export interface SolidVisual {
  /** Provenance tier / basis of the solid's colour (measured phrase, band edge, inherited chromophore, mixed valence, hand colour). */
  colour_tier?: ProvenanceTier;
  colour_source?: string;
  species: string;
  name: string;
  mass_g: number;
  /** Bulk volume of the settled bed (includes packing voids). */
  settled_volume_ml: number;
  /** 0..1 fraction of this solid's mass currently suspended in the liquid (rest is settled/resting). */
  suspended_fraction: number;
  /** Volume-equivalent mean particle diameter of the whole population, micrometres. */
  particle_diameter_um: number;
  /**
   * Mass-weighted mean diameter of the *suspended* part, micrometres. Coarse crystals settle first, so a settling
   * precipitate leaves a haze of fines and this falls below `particle_diameter_um`; absent in older snapshots.
   */
  suspended_diameter_um?: number;
  /** Geometric standard deviation of the size distribution (log-normal closure of the moments; 1 = monodisperse). */
  particle_sigma_g?: number;
  /** Linear-RGB reflectance colour of the dry/wet solid. */
  rgb: [number, number, number];
  kind: SolidKind;
  /** Intrinsic material density, g/mL. */
  density_g_ml?: number;
  /** True solid volume (mass / density), mL. */
  volume_ml?: number;
  /** Visual form: 'bed' | 'monolith' | 'pieces' | 'film'. */
  morphology?: 'bed' | 'monolith' | 'pieces' | 'film' | string;
  /** Stokes settling velocity of the particles in the liquid that is in the vessel (mm/s, 0 when they float or stay colloidal). */
  settling_velocity_mm_s?: number;
  /** Total particle surface, cm2. */
  surface_area_cm2?: number;
  /**
   * Mass-weighted mean size (um) the particles settle as in this liquid: the primary size grown into flocs where the
   * electrolyte is at or beyond the critical coagulation concentration (a hydroxide sol of a few nm is micrometre flocs once salted).
   */
  floc_diameter_um?: number;
  /** True when the solid is floating or clinging (e.g. a metal ribbon fizzing) rather than a bed. */
  floating?: boolean;
  /** Liquid layer index the solid floats in/on, if floating. */
  layer_index?: number;
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
  /** Origin/mechanism of gas evolution, e.g. 'boil'. */
  origin?: string;
}

export interface FumeVisual {
  species: string;
  /** Mass-flow-ish scale 0..1 normalised so 1 ≈ a dense visible plume. */
  intensity: number;
  /** Linear-RGB colour of the visible fume (NO2 brown, Cl2 pale yellow-green, I2 violet, white HCl mist...). */
  rgb: [number, number, number];
  opacity: number;
  /** Derived from the plume's molar mass and temperature (density_ratio > 1): rolls over the lip and falls (Cl2, NO2, Br2). */
  denser_than_air: boolean;
  /** Plume density relative to the room air. */
  density_ratio?: number;
  /** 'gas' = absorbing gas (hue from cross-sections); 'aerosol' = droplets / smoke (white haze). */
  kind?: 'gas' | 'aerosol';
}

export interface FlameVisual {
  fuel: string;
  /** Heat release, watts. */
  power_w: number;
  /** 0..1: sootiness. 0 = clean blue (premixed/ethanol), 1 = luminous yellow sooty. */
  luminosity: number;
  /** Colour temperature of the emitting zone, K (for blackbody tint of yellow part). */
  flame_temp_k: number;
  /** Colour of the whole flame (own light + the emission of dissolved metals), linear RGB. */
  emitter_rgb?: [number, number, number];
  /** 0..1: share of the visible light that comes from emitting metals (flame test); 0 = plain flame. */
  metal_share?: number;
  /** Strongest emitters, e.g. "Na atom 589 nm". */
  emitters?: string[];
}

/** Result of the burner's flame test (engine `vessel_flame_test`). */
export interface FlameTestResult {
  emitter_rgb: [number, number, number];
  metal_share: number;
  emitters: string[];
}

/** UV-vis scan of a liquid layer (engine `vessel_uvvis_scan`). */
export interface UvVisPoint {
  nm: number;
  /** Decadic absorbance of the dissolved species over the path. */
  a_species: number;
  /** Apparent absorbance from the extinction of suspended solids. */
  a_turbidity: number;
}
export interface UvVisContributor {
  species: string;
  name: string;
  peak_nm: number;
  peak_a_per_cm: number;
  /** Absorbance per cm of this species at every scanned point (aligned with `UvVisScan.points`). */
  a_per_cm: number[];
  tier: ProvenanceTier;
  source: string;
  solvent_matched: boolean;
}
export interface UvVisScan {
  layer: number;
  solvent_class: string;
  path_cm: number;
  points: UvVisPoint[];
  contributors: UvVisContributor[];
}

/** NMR spectrum of a liquid layer in a deuterated solvent (engine `vessel_nmr_spectrum`). */
export interface NmrSignalData {
  ppm: number;
  multiplicity: string;
  j_hz: number[];
  /** 1H: protons relative to the most abundant C-H species; 13C: carbons likewise. */
  integration: number;
  nuclei: number;
  assignment: string;
  species: string;
  species_id: string;
  exchangeable: boolean;
  solvent: boolean;
  width_hz: number;
  snr: number;
  ppm_lo: number;
  ppm_hi: number;
}
export interface NmrSpectrumData {
  nucleus: '1H' | '13C';
  solvent: string;
  frequency_mhz: number;
  scans: number;
  ppm_start: number;
  ppm_step: number;
  /** Digitised spectrum normalised to the tallest peak, ascending in ppm from `ppm_start`. */
  intensity: number[];
  signals: NmrSignalData[];
  /** Noise sigma relative to the tallest peak. */
  noise_sigma: number;
  unobserved: string[];
  notes: string[];
  tier: string;
  method: string;
}

/** Mass spectrum of a liquid layer (engine `vessel_ms_spectrum`). */
export interface MsPeakData {
  mz: number;
  intensity: number;
  assignment: string;
  molecular: boolean;
}
export interface MsComponentData {
  id: string;
  name: string;
  formula: string;
  mw: number;
  rt_min: number | null;
  share_pct: number;
  peaks: MsPeakData[];
  base_mz: number;
  notes: string[];
}
export interface MsSpectrumData {
  mode: string;
  components: MsComponentData[];
  summed: MsPeakData[];
  chrom_t0: number;
  chrom_dt: number;
  tic: number[];
  oven: number[];
  not_analysed: string[];
  notes: string[];
  tier: string;
  method: string;
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
  kind: 'equilibrium' | 'kinetic' | 'phase-transfer' | 'combustion' | 'redox' | 'thermal_decomposition' | 'corrosion' | 'electrolysis';
  /** `autoprotolysis` marks the solvent's own ionisation row (neutralisation shows as it relaxing toward the solvent). */
  role?: 'autoprotolysis';
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

/** One element's discrepancy against the vessel's cumulative ledger (added - removed). */
export interface ElementError {
  element: string;
  expected_mol: number;
  actual_mol: number;
  abs_err_mol: number;
  rel_err: number;
}

export interface ConservationInfo {
  /** Every element within 1e-6 relative of the ledger and the net charge within tolerance. */
  ok: boolean;
  max_element_rel_err: number;
  max_element_abs_err_mol: number;
  charge_err_mol: number;
  /** Elements with a non-zero discrepancy (usually only numerical dust). */
  element_errors: ElementError[];
  /** Species whose formula cannot be parsed: their atoms are not covered by the element check. */
  unverified_species: string[];
}

export type CollectorKind = 'syringe' | 'over_water' | 'jar';

export interface GasInfo {
  /** Set for gas syringes / gas collection tubes / gas jars. */
  collector: CollectorKind | null;
  /** `rgb` is the hue of the gas across the vessel's width at its concentration (from its absorption cross-sections; absent = colourless as far as the model knows), `opacity` how visible (0..1). */
  species: { species: string; mol: number; rgb?: [number, number, number]; opacity?: number }[];
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

/** One species of a gas phase. */
export interface GasPhaseSpecies {
  /** Gas species id, e.g. "N2(g)". */
  species: string;
  /** Moles (sealed vessel inventory); 0 for the atmosphere an open vessel sits in. */
  mol: number;
  mole_fraction: number;
  partial_atm: number;
}

/** The gas phase of a vessel: the atmosphere of an open vessel or the closed gas mixture of a sealed one. */
export interface GasPhaseInfo {
  kind: 'atmosphere' | 'sealed';
  pressure_atm: number;
  temperature_k: number;
  /** A liquid component of the vessel is above its critical temperature: it is one fluid with the gas. */
  supercritical: boolean;
  /** Equation of state behind the pressure. */
  eos: 'ideal' | 'peng-robinson';
  species: GasPhaseSpecies[];
}

/** Partial update of the atmosphere an open vessel exchanges with (room input). */
export interface AtmosphereSpec {
  pressure_atm?: number;
  /** Dry-gas mole fractions by gas species id ("N2(g)", "O2(g)", ...). */
  composition?: Record<string, number>;
  /** Relative saturation (0-1) of condensable vapours, e.g. { 'H2O(g)': 0.5 }. */
  relative_saturation?: Record<string, number>;
}

export interface VesselSnapshot {
  t_sim_s: number;
  temperature_k: number;
  room_k: number;
  /** Liquid-phase temperature of the thermal bath if one is attached, else null. */
  bath_k: number | null;
  /** The bath as an object (finite mass, ice fraction) when `VesselControls.bath` gave one; `bath_k` alone is an infinite reservoir. */
  bath?: BathVisual;
  /** Total gas pressure, atm. Open vessel: the atmosphere's pressure (1.0 by default). Sealed: equation of state of the closed gas mixture. */
  pressure_atm: number;
  /** Pressure outside the vessel, atm (the atmosphere control; 1 by default): the reference of a gauge reading. Absent in snapshots that predate it. */
  ambient_atm?: number;
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
  /** Evaporation mass flow, g/s (all volatile liquids; the boil flow while boiling, else evaporation toward the room air). */
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
  /** The gas phase: the atmosphere of an open vessel or the closed gas mixture (air + vapour + evolved gas) of a sealed one. */
  gas_phase?: GasPhaseInfo;
  /** Electrochemistry / electrolysis cell readout if electrodes are present. */
  electrolysis?: ElectroReadout | null;
  /** Visuals for the cell's electrodes (material, mass change, plated deposit). */
  electrodes?: ElectrodeVisual[];
}

export interface ElectrodeSpec {
  material: string;
  area_cm2: number;
}

export interface ElectrolysisSpec {
  anode: ElectrodeSpec;
  cathode: ElectrodeSpec;
  mode: 'voltage' | 'current';
  value: number;
  spacing_cm?: number;
  on?: boolean;
}

export interface ElectrodeReactionRow {
  electrode: string;
  equation: string;
  current_a: number;
  faradaic_fraction: number;
  e0_v: number;
}

export interface ElectrodeVisual {
  material: string;
  mass_change_g: number;
  deposit?: SolidVisual;
  /** Density of the electrode's own material (g/mL) from the species store's solid record; 0 when it has none. */
  density_g_ml?: number;
  /** Wetted area the console specified, cm2. */
  area_cm2?: number;
}

export interface ElectroReadout {
  current_a: number;
  cell_voltage_v: number;
  anode_potential_v: number;
  cathode_potential_v: number;
  ohmic_drop_v: number;
  resistance_ohm: number;
  charge_c: number;
  rows: ElectrodeReactionRow[];
  electrodes?: ElectrodeVisual[];
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

export interface BathVisual {
  temperature_k: number;
  /** Mass fraction of the bath that is ice (it holds its melting point while any is left). */
  ice_fraction: number;
  mass_g: number;
}

/** A finite bath: `mass_g` of water-ice mixture; with ice it sits at `melt_k` (273.15 K by default, colder for a salted bath). */
export interface BathSpec {
  temperature_k: number;
  mass_g: number;
  ice_fraction?: number;
  melt_k?: number;
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
  /** Physical form of a solid: 'piece' | 'turnings' | 'granules' | 'powder'. Absent = the catalog entry's form. Sets the grain size and whether it stays separate pieces. */
  solid_form?: string;
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
  /** Particle populations of those solids (engine-internal, passed back unchanged so grains keep their size). */
  particles?: Record<string, unknown>;
  /** Physical form of the loose solids (a ribbon stays a ribbon when it is poured on); passed back unchanged. */
  forms?: Record<string, string>;
}

export interface VesselControls {
  heater_w?: number;           // hot-plate power delivered to the vessel, 0..1000
  stirring?: boolean;          // magnetic stirrer
  stir_rpm?: number;
  sealed?: boolean;
  /** Thermal bath (ice bath = 273.15). null removes it. An infinite reservoir; use `bath` for one with mass and ice. */
  bath_k?: number | null;
  /** A finite bath (melting ice, warming water, cooling through the room); null removes it. */
  bath?: BathSpec | null;
  /** Thermal conductance (W/K) of the vessel-bath contact; absent = from the vessel's geometry and wall (engine `heat_transfer`). */
  bath_coupling_w_k?: number;
  /** Burner/igniter held at the vessel: ignites flammable vapour when true. */
  igniter?: boolean;
  /** Direct burner flame heating, watts (0 = off). */
  burner_w?: number;
  /** Atmosphere an open vessel exchanges with: pressure, dry composition, humidity (vacuum, pressurised, inert, O2-rich all possible). */
  atmosphere?: AtmosphereSpec;
  /** Electrochemistry / electrolysis setup. */
  electrolysis?: ElectrolysisSpec | null;
  /** Remove electrodes from vessel. */
  remove_electrodes?: boolean;
}

export interface ReagentCatalogEntry {
  id: string;
  name: string;
  formula: string;
  /** 'gas': dosed by volume of gas (headspace of a sealed vessel / sparged through the liquid of an open one). */
  form: 'solid' | 'liquid' | 'solution' | 'gas';
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
  /** InChIKey of the main species (identity; absent for pseudo-reagents such as starch solution). */
  inchi_key?: string;
  /** Physical form a solid reagent is dosed in ('piece' | 'turnings' | 'granules' | 'powder', see `getSolidForms`); absent = the solid's own grain. */
  solid_form?: string;
  /** Grain size of that form when the reagent's own differs from the form's default, um. */
  particle_um?: number;
}

/** One electrode material of the console (engine `vessel_electro::electrode_materials`). */
export interface ElectrodeMaterialInfo {
  symbol: string;
  e0_v?: number | null;
  inert: boolean;
  /** Linear sRGB of the bulk metal from the solid's optical record. */
  rgb?: [number, number, number] | null;
  density_g_ml?: number | null;
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
  | { type: 'UVVIS_SCAN'; payload: { handle: number; layer?: number; nm_min: number; nm_max: number; step_nm: number; path_cm: number }; requestId: string }
  | { type: 'NMR_SPECTRUM'; payload: { handle: number; layer?: number; nucleus: string; solvent: string; scans: number; seed: number }; requestId: string }
  | { type: 'MS_SPECTRUM'; payload: { handle: number; layer?: number; mode: string; seed: number }; requestId: string }
  | { type: 'FLAME_TEST'; payload: { handle: number; t_flame_k: number }; requestId: string }
  | { type: 'COLOUR_TO_ABSORBANCE'; payload: { r: number; g: number; b: number; path_cm: number }; requestId: string }
  | { type: 'REAGENT_CATALOG'; payload: {}; requestId: string }
  | { type: 'TAKE_MINERAL_LOOKUPS'; payload: {}; requestId: string }
  | { type: 'RESOLVE_MINERAL'; payload: MineralData; requestId: string };

/** Request to model an imported compound as a reacting reagent (engine `import_compound`). */
export interface CompoundRequest {
  id: string;
  name: string;
  formula: string;
  smiles?: string;
  /** Standard InChIKey: identity. The engine matches built-in molecules and keys inert compounds on it. */
  inchi_key?: string;
  /** CAS registry number (secondary identity). */
  cas?: string;
  mw?: number;
  /** g/mL (solid / room-temperature value, or the only one PubChem gave). */
  density?: number;
  /**
   * Physical state hint only (PubChem text): the engine derives the phase from the melting / vapour-pressure data
   * and uses this solely when it has neither.
   */
  state?: 'solid' | 'liquid' | 'gas';
  molarity?: number;
  ghs?: string[];
  // --- compound thermodynamic data (COMPOUND_PHASE_PLAN.md contract); each omitted when PubChem has nothing ---
  // Only (nearly) pressure-independent values or points of a curve: the engine derives boiling, melting and phase.
  /** Measured points [T kelvin, P pascal] of the vapour-pressure curve; includes the 1-atm normal boiling point (Tb, 101325). None = non-volatile. */
  vapor_pressure_points?: Array<[number, number]>;
  /** Molar heat of vaporization, kJ/mol, and the temperature (K) it was measured at. */
  dh_vap_kj_mol?: number;
  dh_vap_at_k?: number;
  /** Melting point at ~1 atm, kelvin (one point on the solid-liquid curve). */
  t_melt_ref_k?: number;
  /** Molar heat of fusion, kJ/mol. */
  dh_fus_kj_mol?: number;
  /** Standard heat of combustion, kJ/mol (negative = exothermic). */
  dh_comb_kj_mol?: number;
  /** Water, ~25 C, g/L. */
  solubility_g_per_l?: number;
  /** Enthalpy of solution, kJ/mol. */
  dh_sol_kj_mol?: number;
  /** Standard entropy S° (J/(mol K)). */
  s_j_mol_k?: number;
  /** Molar heat capacity at 298 K (J/(mol K)). */
  cp_j_mol_k?: number;
  /** Heat capacity polynomial coefficients. */
  cp_coefficients?: number[];
  /** LINEAR (not sRGB) rgb, 0..1: the compound's colour as a solid / neat liquid (a parsed colour phrase, never an absorptivity). */
  color_linear_rgb?: [number, number, number];
  /** What the colour phrase was about (solid / solution / liquid / vapour), hydrate flag and parser confidence. */
  color_meta?: { subject: string; hydrate?: boolean; confidence: number; phrase: string };
  /** Solution absorption bands from the PubChem UV text: `[nm, eps, fwhm | null, solvent class | null]`. */
  uv_bands?: Array<[number, number, number | null, string | null]>;
  /** Measured refractive index n_D of the neat compound. */
  refractive_index?: number;
  /** Surface tension of the neat liquid, mN/m. */
  surface_tension_mn_m?: number;
}

/** Derived thermodynamic record of a compound (engine response). */
export interface CompoundThermo {
  /** Standard enthalpy of formation, kJ/mol (derived from the heat of combustion for CHNOS compounds). */
  dhf_kj_mol?: number;
  dh_vap_kj_mol?: number;
  dh_fus_kj_mol?: number;
  /** DERIVED: temperature where the fitted vapour pressure reaches 1 atm / the melting temperature at 1 atm. */
  normal_bp_k?: number;
  normal_mp_k?: number;
  /** Names of quantities that are estimates (Trouton, Walden, ...), not data. */
  estimated: string[];
}

/** Engine's answer: `modelable=false` (unparseable formula / unknown element) means the compound stays visual-only. */
export interface CompoundModel {
  modelable: boolean;
  /** Human-readable explanation, e.g. "Modelled as salt: K+ + Cl-". */
  reason: string;
  kind: 'salt' | 'acid' | 'base' | 'molecule' | 'inert' | 'none';
  entry: ReagentCatalogEntry | null;
  species: Array<[string, number]>;
  mw: number;
  by_mass: boolean;
  /** Phase at 298.15 K, 1 atm derived from the fitted curves (absent until the engine lands the compound-phase contract). */
  state_at_room?: 'solid' | 'liquid' | 'gas';
  /**
   * How the engine models the compound: 'ionic' (dissociating salt), 'neutral' (known molecule with reaction
   * chemistry), 'inert' (physically present - phases, heat, boil-off, dissolution - but not reacting; `modelable` is true).
   */
  phase_model?: 'ionic' | 'neutral' | 'inert';
  /** Derived thermodynamics (absent until the engine lands the compound-phase contract). */
  thermo?: CompoundThermo;
}

/** A per-pathway rate that replaces the template rule of the reaction with the same key (engine `register_reaction_rates`). */
export interface RateEntry {
  key: string;
  a: number;
  ea_j_mol: number;
  tier: string;
  source: string;
}

/** A solid the engine formed with only a rule-of-thumb Ksp: the app should look it up (engine `take_mineral_lookups`). */
export interface MineralLookup {
  /** Species id, e.g. "PbI2(s)". */
  solid_species: string;
  /** Formula as written, may contain parentheses ("Pb(NO3)2"). */
  formula: string;
  /** Hill-order formula without parentheses ("I2Pb"): use for PubChem fastformula. */
  hill_formula: string;
  cation: string;
  anion: string;
  n_c: number;
  n_a: number;
  molar_mass: number;
  tier: 'speculative' | 'estimated';
}

/** Looked-up data for a solid (engine `resolve_mineral`). Engine picks Ksp by priority log_ksp > solubility > qualitative. */
export interface MineralData {
  solid_species: string;
  cid?: number;
  name?: string;
  /** Water, ~25 C, g of solid per litre of solution. */
  solubility_g_per_l?: number;
  /** Explicit literature value, if the record states one. */
  log_ksp?: number;
  qualitative?:
    | 'very_soluble'
    | 'freely_soluble'
    | 'soluble'
    | 'sparingly_soluble'
    | 'slightly_soluble'
    | 'very_slightly_soluble'
    | 'practically_insoluble';
  /** LINEAR (not sRGB) rgb, 0..1. */
  color_linear_rgb?: [number, number, number];
  density_g_ml?: number;
  kind?: 'powder' | 'curds' | 'gel' | 'crystal';
  /** e.g. "PubChem CID 24931". */
  source: string;
}

export interface MineralResolution {
  registered: boolean;
  id: string;
  log_ksp: number | null;
  tier: string;
  source: string;
  detail: string;
}
