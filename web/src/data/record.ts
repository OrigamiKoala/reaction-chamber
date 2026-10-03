import type { ProvenanceTier } from '../types';

export interface Datum {
  value: number;
  unit: string;
  T_K?: number;
  tier: ProvenanceTier;
  source: string;
  uncertainty?: number;
}

export interface Identity {
  inchikey?: string;
  smiles?: string;
  formula: string;
  charge: number;
  cas?: string;
  cid?: number;
  names?: string[];
  db_names?: Record<string, string>;
}

export interface PhaseThermo {
  model: string;
  tier: ProvenanceTier;
  source: string;
  dfH?: Datum;
  dfG?: Datum;
  S?: Datum;
  cp?: Datum;
  ranges?: unknown;
  params?: unknown;
}

export interface PhaseVolume {
  model?: string;
  zra?: Datum;
  v0?: Datum;
}

export interface PhaseData {
  thermo?: PhaseThermo;
  volume?: PhaseVolume;
  rho?: Datum;
  polymorph?: string;
}

export interface Critical {
  Tc?: Datum;
  Pc?: Datum;
  Vc?: Datum;
  omega?: Datum;
}

export type CurvePointKind = 'psat' | 'tm' | 'tb' | 'solubility' | 'density';

export interface CurvePoint {
  kind: CurvePointKind;
  T_K?: number;
  P_Pa?: number;
  solvent?: string;
  value?: number;
  unit?: string;
  tier: ProvenanceTier;
  source: string;
  uncertainty?: number;
}

export interface AcidBaseSite {
  site?: string;
  pKa: Datum;
  dH?: Datum;
  T_K?: number;
  I?: number;
}

export interface RedoxCouple {
  partner: string;
  E0: Datum;
  n_electrons?: number;
}

export interface OpticsBand {
  solvent?: string;
  nm: number;
  eps: number;
  fwhm?: number;
  /** "d-d" | "ct" | "pi-pi*" | "n-pi*" | "ivct": informational (and which width default applies). */
  kind?: string;
}

export interface GasBand {
  nm: number;
  /** Cross-section at the centre, cm2 per molecule. */
  sigma_cm2: number;
  fwhm: number;
}

/** A measured colour of a solid (parsed colour phrase): never an absorptivity. */
export interface SolidColour {
  rgb_linear: [number, number, number];
  subject?: string;
  hydrate?: boolean;
  confidence?: number;
  phrase?: string;
}

export interface Optics {
  bands?: OpticsBand[];
  tier?: string;
  source?: string;
  molar_refraction?: Datum;
  refractive_index?: Datum;
  band_gap_eV?: Datum;
  solid_bands?: OpticsBand[];
  colour?: SolidColour;
  gas_bands?: GasBand[];
}

export interface Transport {
  eta_l?: unknown;
  sigma?: Datum;
}

export interface RejectedDatum {
  datum?: unknown;
  reason: string;
}

export interface CompoundRecord {
  id: string;
  identity: Identity;
  phases: Record<string, PhaseData>;
  critical?: Critical;
  points?: CurvePoint[];
  acid_base?: AcidBaseSite[];
  redox?: RedoxCouple[];
  optics?: Optics;
  transport?: Transport;
  kinetics_refs?: string[];
  rejected?: RejectedDatum[];
}

export function validateRecordNoConditionFields(record: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be an object'] };
  }
  const r = record as Record<string, unknown>;
  const forbidden = ['mp', 'bp', 'mp_c', 'bp_c', 'solubility', 'density', 'phase'];
  for (const f of forbidden) {
    if (f in r && r[f] !== undefined) {
      errors.push(`Plain condition-dependent field '${f}' is forbidden in CompoundRecord (use curve points)`);
    }
  }
  return { valid: errors.length === 0, errors };
}
