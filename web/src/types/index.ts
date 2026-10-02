export type ProvenanceTier = 'tabulated' | 'estimated' | 'speculative' | 'refined' | 'user-set';

export interface ChemicalParameter {
  value: number;
  units: string;
  tier: ProvenanceTier;
  source: string;
  uncertainty?: number;
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
  };
  userOverrides: Partial<{
    mp_c: number;
    bp_c: number;
    density: number;
    solubility: string;
  }>;
  color: string;
  ghs: string[];
  remainingMl: number;
  /** Physical state at room temperature when known (drives powder vs liquid handling of visual-only imports). */
  state?: 'solid' | 'liquid' | 'gas';
}

export interface WorkerRoundtripMessage {
  type: 'PING' | 'PONG' | 'WASM_INIT' | 'WASM_ECHO' | 'POUR_CALC';
  payload?: any;
  requestId?: string;
}
