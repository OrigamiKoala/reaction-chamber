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

export interface VesselState {
  id: string;
  name: string;
  type: 'beaker-50' | 'beaker-250' | 'beaker-1000' | 'erlenmeyer-250' | 'test-tube' | 'cylinder-100';
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
