export type ProvenanceTier = 'tabulated' | 'imported' | 'estimated' | 'speculative' | 'refined' | 'user-set';

export interface ChemicalParameter {
  value: number;
  units: string;
  tier: ProvenanceTier;
  source: string;
  uncertainty?: number;
}

/** Which of a record's mp / bp / density / colour came from data rather than a placeholder default (20 C, 100 C, 1 g/mL, '#e8f4fa'). */
export interface KnownFlags {
  mp_c?: boolean;
  bp_c?: boolean;
  density?: boolean;
  color?: boolean;
}

/**
 * PubChem thermodynamic data carried from import to the engine's `CompoundRequest`. Only (nearly) pressure-independent
 * values or points of a curve: the engine derives boiling / melting / phase from conditions. All optional (absent = not found).
 */
export interface PhysicalData {
  /** Points [T kelvin, P pascal] of the vapour-pressure curve from the 'Vapor Pressure' text and from boiling points quoted at a reduced pressure (the 1-atm normal boiling point is added at request time from bp_c). */
  vapor_pressure_points?: Array<[number, number]>;
  /** Molar heat of vaporization, kJ/mol, and the temperature (K) it was quoted at (omitted when the text gives none). */
  dh_vap_kj_mol?: number;
  dh_vap_at_k?: number;
  /** Molar heat of fusion, kJ/mol. */
  dh_fus_kj_mol?: number;
  /** Standard heat of combustion, kJ/mol (negative = exothermic). */
  dh_comb_kj_mol?: number;
  /** Water, ~25 C, g/L. */
  solubility_g_per_l?: number;
  /** Enthalpy of solution, kJ/mol. */
  dh_sol_kj_mol?: number;
  /** Standard enthalpy of formation, kJ/mol (intrinsic), of the phase named by `dhf_phase`. */
  dhf_kj_mol?: number;
  /** Phase the enthalpy of formation refers to (a gas value must never be used as a condensed one). */
  dhf_phase?: 'solid' | 'liquid' | 'gas';
  /** Standard entropy, J/(mol K) (intrinsic), of the phase named by `s_phase`. */
  s_j_mol_k?: number;
  s_phase?: 'solid' | 'liquid' | 'gas';
  /** Antoine blocks as published, ln(P/Pa) = a - b / (T/K + c), each valid only inside [t_min_k, t_max_k]. */
  antoine?: Array<{ a_pa: number; b_pa: number; c_pa: number; t_min_k: number; t_max_k: number }>;
  /** Critical temperature, K (a curve parameter, not a phase boundary). */
  tc_k?: number;
  /** Values that failed a physical sanity gate (Trouton / Walden) and were not used, with the reason. */
  rejected?: string[];
  /** Heat capacity at 298 K, J/(mol K). */
  cp_j_mol_k?: number;
  /** Heat capacity polynomial coefficients. */
  cp_coefficients?: number[];
}

export interface SpeciesRecord {
  inchi_key: string;
  cid?: number;
  name: string;
  formula: string;
  smiles: string;
  charge: number;
  mw: number;
  mp_c: number;
  bp_c: number;
  density: number; // g/cm³ or g/mL
  solubility: string;
  ghs: string[];
  tier: ProvenanceTier;
  source: string;
  color?: string;
  pka?: number[];
  user_overrides?: Partial<Record<string, number | string>>;
  /** Physical state at room temperature, parsed from PubChem 'Physical Description' / 'Color/Form' (undefined = unknown). */
  physical_state?: 'solid' | 'liquid' | 'gas';
  /** True per field when mp_c / bp_c / density are data, not the placeholder defaults (undefined = legacy record). */
  known?: KnownFlags;
  /** Heats, liquid density, water solubility parsed from PUG View (see `pubchem/record_builder.ts`). */
  physical?: PhysicalData;
}

export interface DissolutionFragment {
  ion: string;
  stoichiometry: number;
  charge: number;
}

/**
 * Every piece of glassware the bench can hold. The id is the single key shared by the glassware catalog
 * (`app/glassware_catalog.ts`), the lathe profiles (`render/glass_profiles.ts`) and the engine `VesselConfig.type`.
 * The engine treats `type` as an opaque label; only capacity / glass mass / inner radius matter to it.
 */
export type VesselType =
  // beakers
  | 'beaker-50' | 'beaker-100' | 'beaker-250' | 'beaker-400' | 'beaker-600' | 'beaker-1000'
  // conical (Erlenmeyer) flasks
  | 'erlenmeyer-50' | 'erlenmeyer-125' | 'erlenmeyer-250' | 'erlenmeyer-500'
  // round-bottom / boiling / filter flasks
  | 'round-bottom-50' | 'round-bottom-100' | 'round-bottom-250' | 'round-bottom-500' | 'florence-500' | 'buchner-flask-250'
  // graduated cylinders
  | 'cylinder-10' | 'cylinder-25' | 'cylinder-50' | 'cylinder-100' | 'cylinder-250' | 'cylinder-500' | 'cylinder-1000'
  // volumetric flasks (to-contain, one calibration ring on the neck)
  | 'volumetric-25' | 'volumetric-50' | 'volumetric-100' | 'volumetric-250' | 'volumetric-500' | 'volumetric-1000'
  // burettes (graduated downward from 0 at the top, stopcock at the bottom)
  | 'burette-25' | 'burette-50'
  // pipettes
  | 'pipette-volumetric-10' | 'pipette-volumetric-25' | 'pipette-graduated-5' | 'pipette-graduated-10' | 'pipette-pasteur'
  // tubes
  | 'test-tube' | 'test-tube-small' | 'boiling-tube-25' | 'centrifuge-tube-15' | 'centrifuge-tube-50'
  // gas handling
  | 'gas-collection-tube-50' | 'gas-syringe-100' | 'gas-jar-250'
  // funnels
  | 'separatory-funnel-250' | 'filter-funnel-75' | 'buchner-funnel-90'
  // dishes / open vessels
  | 'evaporating-dish-100' | 'petri-dish-90' | 'watch-glass-75' | 'crucible-30' | 'weigh-boat';

export interface VesselState {
  id: string;
  name: string;
  type: VesselType;
  capacityMl: number;
  currentVolumeMl: number;
  liquidColor: string;
  liquidOpacity: number;
  temperatureK: number;
  ph?: number;
  isSealed: boolean;
  stirring: boolean;
  contents: Array<{
    name: string;
    formula: string;
    amountMol: number;
    concentrationM: number;
    color?: string;
  }>;
}

export interface BottleState {
  id: string;
  cid?: number;
  name: string;
  formula: string;
  smiles: string;
  inchi_key: string;
  mw: number;
  sourcedProperties: {
    mp_c: number;
    bp_c: number;
    density: number;
    solubility: string;
    /** Per field: is the sourced value real data rather than a placeholder default? */
    known?: KnownFlags;
  };
  /** PubChem heats / liquid density / water solubility; sent to the engine with mp, bp, density and colour. */
  physical?: PhysicalData;
  userOverrides: Partial<{
    mp_c: number;
    bp_c: number;
    density: number;
    solubility: string;
  }>;
  color: string;
  ghs: string[];
  remainingMl: number;
  /** PubChem text hint for the room-temperature state (the engine derives the real phase from mp / bp; see `importPhase`). */
  state?: 'solid' | 'liquid' | 'gas';
  /** Added automatically because a reaction in the lab produced it (looked up on PubChem like a hand import). */
  formedInLab?: boolean;
}

export interface WorkerRoundtripMessage {
  type: 'PING' | 'PONG' | 'WASM_INIT' | 'WASM_ECHO' | 'POUR_CALC';
  payload?: any;
  requestId?: string;
}
