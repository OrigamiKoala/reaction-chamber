// Builds a SpeciesRecord from a PUG REST property row (+ optional PUG View record). Shared by the user-driven import
// (api.ts `importCompound` / `importCompoundByCid`) and the precipitate lookup (solid_fetch.ts), so a product formed in
// the lab is described exactly like a reagent imported by hand. Pure: no network, no browser APIs.
import type { KnownFlags, PhysicalData, SpeciesRecord } from '../types';
import {
  parseTemperatureString,
  parseDensityString,
  resolveMedianProperty,
  parseGHSCodes,
  collectPugViewStrings,
  parsePhysicalState,
  parseColourWord,
  type ParsedProperty,
} from './parser';
import { parseWaterSolubilityGPerL } from './solubility_parser';
import {
  COMBUSTION_HEADINGS,
  FUSION_HEADINGS,
  VAPORIZATION_HEADINGS,
  VAPOR_PRESSURE_HEADINGS,
  parseBoilingPoints,
  parseHeatOfCombustionKJMol,
  parseHeatOfFusionKJMol,
  parseHeatOfVaporization,
  parseVaporPressurePoints,
  troutonOk,
  waldenOk,
} from './thermo_parser';

/** PUG REST property list used for every import (one row per CID). */
export const PUG_PROPERTIES = 'Title,IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey,Charge';

export interface BuildRecordOptions {
  /** State to assume when the PUG View text does not say (e.g. 'solid' for a product that precipitated). */
  defaultState?: 'solid' | 'liquid' | 'gas';
}

/**
 * `prop` is a PUG REST property row, `viewData` the PUG View record for the same CID (null if unavailable),
 * `foundInBundle` a static-bundle entry for the same compound. The bundle never overrides what PubChem says and never
 * makes a value `known`: it only fills display fields (hazards, colour, state, and - unflagged - mp / bp / density) when
 * the PubChem record has nothing, so the engine never takes a bundle estimate for measured data.
 */
export function buildSpeciesRecord(
  prop: any,
  viewData: unknown | null,
  foundInBundle: SpeciesRecord | undefined,
  fallbackName: string,
  opts: BuildRecordOptions = {},
): SpeciesRecord {
  // PubChem now answers a CanonicalSMILES request under the key ConnectivitySMILES.
  const smiles = prop.CanonicalSMILES || prop.ConnectivitySMILES || prop.SMILES || '';
  const inchiKey = prop.InChIKey || '';

  // mp / bp / density are placeholders unless the PUG View record supplies them (then `known` says so)
  let mp_c = 20.0;
  let bp_c = 100.0;
  let density = 1.0;
  let ghs: string[] = [];
  let physicalState: SpeciesRecord['physical_state'];
  let colour: string | undefined;
  const mw = parseFloat(prop.MolecularWeight) || 0;
  const known: KnownFlags = {};
  const physical: PhysicalData = {};
  const rejected: string[] = [];

  if (viewData) {
    const parsedGhs = parseGHSCodes(JSON.stringify(viewData));
    if (parsedGhs.length > 0) ghs = parsedGhs;
    // Generic text -> visuals + thermo: state / colour / melting & boiling point / density / heats / solubility from the record itself.
    const props = collectPugViewStrings(viewData, [
      'Physical Description',
      'Color/Form',
      'Melting Point',
      'Boiling Point',
      'Density',
      'Solubility',
      ...FUSION_HEADINGS,
      ...VAPORIZATION_HEADINGS,
      ...COMBUSTION_HEADINGS,
      ...VAPOR_PRESSURE_HEADINGS,
    ]);
    const all = (keys: string[]) => keys.flatMap((k) => props[k] ?? []);
    const look = [...(props['Physical Description'] ?? []), ...(props['Color/Form'] ?? [])];
    physicalState = parsePhysicalState(look);
    colour = parseColourWord(look);
    const temps = (key: string) => (props[key] ?? []).map((t) => parseTemperatureString(t)).filter((x): x is ParsedProperty => !!x);
    const dens = (props['Density'] ?? []).map((t) => parseDensityString(t)).filter((x): x is ParsedProperty => !!x);
    const mps = temps('Melting Point');
    // A boiling point quoted at a reduced pressure is a vapour-pressure point, not the normal boiling point.
    const bps = parseBoilingPoints(props['Boiling Point'] ?? []);
    mp_c = resolveMedianProperty(mps, mp_c);
    bp_c = resolveMedianProperty(
      bps.normal_c.map((v) => ({ value: v, unit: '°C', originalText: '', isStandardConditions: false })),
      bp_c,
    );
    density = resolveMedianProperty(dens, density);
    known.mp_c = mps.length > 0;
    known.bp_c = bps.normal_c.length > 0;
    known.density = dens.length > 0;
    if (bps.points.length > 0) physical.vapor_pressure_points = bps.points;
    // Vapour-pressure curve points (T in K, P in Pa) from the 'Vapor Pressure' text, plus any reduced-pressure boiling points.
    const vp = parseVaporPressurePoints(all(VAPOR_PRESSURE_HEADINGS));
    if (vp.length > 0) {
      const merged = [...(physical.vapor_pressure_points ?? []), ...vp].sort((a, b) => a[0] - b[0]);
      physical.vapor_pressure_points = merged.filter((p, i) => i === 0 || Math.abs(p[0] - merged[i - 1][0]) > 0.01 || Math.abs(p[1] / merged[i - 1][1] - 1) > 1e-6);
    }
    const dhFus = parseHeatOfFusionKJMol(all(FUSION_HEADINGS), mw);
    const dhVap = parseHeatOfVaporization(all(VAPORIZATION_HEADINGS), mw);
    const dhComb = parseHeatOfCombustionKJMol(all(COMBUSTION_HEADINGS), mw);
    // sanity gates against the melting / boiling point (only when those are data): Walden and Trouton
    if (dhFus !== undefined) {
      if (known.mp_c && !waldenOk(dhFus, mp_c + 273.15)) rejected.push(`heat of fusion ${dhFus} kJ/mol fails Walden's rule at ${mp_c} °C`);
      else physical.dh_fus_kj_mol = dhFus;
    }
    if (dhVap) {
      if (known.bp_c && !troutonOk(dhVap.kj, bp_c + 273.15)) {
        rejected.push(`heat of vaporization ${dhVap.kj} kJ/mol fails Trouton's rule at ${bp_c} °C`);
      } else {
        physical.dh_vap_kj_mol = dhVap.kj;
        const at = dhVap.at_k ?? (dhVap.at_bp && known.bp_c ? bp_c + 273.15 : undefined);
        if (at !== undefined) physical.dh_vap_at_k = at;
      }
    }
    if (dhComb !== undefined) physical.dh_comb_kj_mol = dhComb;
    const sol = parseWaterSolubilityGPerL([...(props['Solubility'] ?? []), ...(props['Physical Description'] ?? [])], mw || undefined);
    if (sol !== undefined) physical.solubility_g_per_l = sol;
  }

  // The static bundle only fills what PubChem left empty, and what it fills is never `known`.
  if (foundInBundle) {
    if (!known.mp_c) mp_c = foundInBundle.mp_c;
    if (!known.bp_c) bp_c = foundInBundle.bp_c;
    if (!known.density) density = foundInBundle.density;
    if (ghs.length === 0) ghs = foundInBundle.ghs;
    physicalState = physicalState ?? foundInBundle.physical_state;
    colour = colour ?? foundInBundle.color;
    for (const [k, v] of Object.entries(foundInBundle.physical ?? {})) {
      if ((physical as Record<string, unknown>)[k] === undefined) (physical as Record<string, unknown>)[k] = v;
    }
  }
  physicalState = physicalState ?? opts.defaultState;
  known.color = colour !== undefined && (!foundInBundle || colour !== foundInBundle.color);
  if (rejected.length > 0) physical.rejected = rejected;

  return {
    inchi_key: inchiKey,
    cid: prop.CID,
    name: prop.Title || fallbackName,
    formula: prop.MolecularFormula || '',
    smiles,
    charge: prop.Charge || 0,
    mw,
    mp_c,
    bp_c,
    density,
    solubility: foundInBundle ? foundInBundle.solubility : 'soluble',
    ghs,
    // fetched from PubChem (a database record), not a curated table
    tier: 'imported',
    source: 'PubChem PUG REST',
    physical_state: physicalState,
    color: colour,
    known,
    physical: Object.keys(physical).length > 0 ? physical : undefined,
  };
}
