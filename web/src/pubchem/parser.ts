// Property string parsing and conflict resolution
import type { KnownFlags } from '../types';

export interface ParsedProperty {
  value: number;
  unit: string;
  originalText: string;
  /** Stated at (about) standard conditions: no other pressure, temperature near room temperature, not a hydrate / solution entry. */
  isStandardConditions: boolean;
}

/** Normalises minus signs / dashes / odd spaces so that ranges and negative numbers read consistently. */
function clean(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, ' ') // "[Merck Index]" citations
    .replace(/[−–—‒]/g, '-')
    .replace(/[\u00a0\u2009\u202f]/g, ' ')
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1'); // thousands separators: "1,832 °F"
}

/**
 * Qualifiers that make a quoted temperature NOT the plain property it looks like:
 * "decomposes" / "sublimes" (the point is a decomposition / sublimation point), "greater than" / "less than" / ">" / "<"
 * (a bound, not a value). "approx." / "about" / "ca." are accepted as the (approximate) value.
 */
const REJECT_QUALIFIER = /\b(decompos\w*|sublim\w*|greater\s+than|less\s+than|more\s+than|above|below|exceeds?)\b|(^|\s)[<>]\s*\d/i;

/** Hydrate / solution entries ("/alpha-Glucose, monohydrate/", "50% solution") describe another substance. */
const OTHER_SUBSTANCE = /\b(?:mono|di|tri|tetra|penta|hexa|hepta|octa|deca)?hydrate\b|\b\d+\s*%\s*(?:aq\w*\.?\s*)?solution\b|\bsolution\b/i;

/** Pressure stated in the string, in pascals ("at 10 mm Hg", "(760 mmHg)", "at 1 atm"), if any. */
function statedPressurePa(t: string): number | undefined {
  const m = /(?:\bat\b|@|\()\s*(\d+(?:\.\d+)?)\s*(mm\s*Hg|torr|kPa|hPa|mbar|bar|atm|psi|Pa)(?![A-Za-z])/i.exec(t);
  if (!m) return undefined;
  const f: Record<string, number> = { mmhg: 133.322368, torr: 133.322368, kpa: 1e3, hpa: 100, mbar: 100, bar: 1e5, atm: 101325, psi: 6894.757, pa: 1 };
  return parseFloat(m[1]) * f[m[2].toLowerCase().replace(/\s+/g, '')];
}

const NUMB = String.raw`(-?\d+(?:\.\d+)?)`;
const TUNIT = String.raw`(?:°|º|deg(?:rees?)?\.?)?\s*([CFK])(?![A-Za-z])`;

function toCelsius(v: number, unit: string): number {
  const u = unit.toUpperCase();
  return u === 'F' ? ((v - 32) * 5) / 9 : u === 'K' ? v - 273.15 : v;
}

/**
 * Temperature in °C from PubChem text. A range ("122-123 °C", "122 to 123 °C", "100 - 102 °C") is its midpoint (it used
 * to parse as the negative number -123 °C); a bound ("greater than 212 °F"), a decomposition or sublimation point
 * ("284 °F (decomposes)") and an entry about a hydrate or a solution are rejected (null) rather than read as the
 * property. `isStandardConditions` is true when the string states no other pressure and no temperature condition.
 */
export function parseTemperatureString(rawText: string): ParsedProperty | null {
  if (!rawText) return null;
  const text = clean(rawText);
  if (REJECT_QUALIFIER.test(text) || OTHER_SUBSTANCE.test(text)) return null;
  // the value is what comes before any "at ..." condition
  const cut = text.search(/\bat\b|@|\(\s*\d/i);
  const head = cut > 0 ? text.slice(0, cut) : text;
  const rangeRe = new RegExp(String.raw`(?<![\d.])${NUMB}\s*(?:${TUNIT})?\s*(?:to|-)\s*${NUMB}\s*${TUNIT}`, 'i');
  const single = new RegExp(String.raw`${NUMB}\s*${TUNIT}`, 'i');
  let value: number | undefined;
  const rm = rangeRe.exec(head);
  if (rm) {
    const unit = rm[4];
    const lo = parseFloat(rm[1]);
    const hi = parseFloat(rm[3]);
    // "-117 to -115" is a range; "12-13" with one unit is too. Require ordered ends within 30 K-equivalents.
    if (hi >= lo && hi - lo <= 30) value = toCelsius((lo + hi) / 2, rm[2] ?? unit);
  }
  if (value === undefined) {
    const m = single.exec(head);
    if (!m) return null;
    value = toCelsius(parseFloat(m[1]), m[2]);
  }
  const p = statedPressurePa(text);
  const pressureOk = p === undefined || Math.abs(p / 101325 - 1) < 0.05;
  return {
    value: Math.round(value * 10) / 10,
    unit: '°C',
    originalText: rawText,
    isStandardConditions: pressureOk && !/\bat\s+-?\d+(?:\.\d+)?\s*(?:°|º|deg)?\s*[CFK]\b/i.test(text),
  };
}

/**
 * Density in g/cm³. Units g/cm³, g/mL, g/cc, kg/m³; also unitless relative densities ("Relative density (water = 1): 0.79",
 * "Specific gravity: 1.26"), which are numerically g/cm³. `isStandardConditions`: temperature stated and within 15-25 °C,
 * or the 4 °C water reference ("1.26 at 20 °C/4 °C"), or no temperature at all.
 */
export function parseDensityString(rawText: string): ParsedProperty | null {
  if (!rawText) return null;
  const text = clean(rawText);
  if (OTHER_SUBSTANCE.test(text)) return null;
  let num: number | undefined;
  const withUnit = text.match(/(\d*\.?\d+)\s*(?:g\/cm3|g\/cm\^?3|g\/cm³|g\/cu\.?\s?cm|g\/mL|g\/cc|kg\/m3|kg\/m\^3|kg\/m³)/i);
  const relative = /^\s*(\d*\.?\d+)\s*(?:at|@)\s*-?\d+(?:\.\d+)?\s*(?:°|º|deg)?\s*C?\s*\/\s*-?\d+(?:\.\d+)?\s*(?:°|º|deg)?\s*C/i.exec(text);
  if (withUnit) {
    num = parseFloat(withUnit[1]);
    if (/kg\/m/i.test(withUnit[0])) num /= 1000;
  } else if (relative) {
    num = parseFloat(relative[1]); // "0.7893 at 20 °C/4 °C": density relative to water at 4 °C = g/cm3
  } else if (/(relative\s+density|specific\s+gravity|sp\.?\s*gr\.?|\(water\s*=\s*1\)|\bd\s*\d+\s*=)/i.test(text)) {
    const m = text.match(/(?:[:=]|\bis\b)?\s*(\d*\.?\d+)\s*(?:at\b|@|\(|\/|$|,|;)/i) ?? text.match(/(\d*\.?\d+)/);
    if (m) num = parseFloat(m[1]);
    // the "(water = 1)" reference itself must not be read as the value
    const afterRef = text.replace(/\(?water\s*=\s*1\)?/i, ' ');
    const m2 = afterRef.match(/(\d*\.?\d+)/);
    if (m2) num = parseFloat(m2[1]);
  }
  if (num === undefined || !(num > 0.05 && num < 30)) return null;
  const t = /(?:\bat\b|@)\s*(-?\d+(?:\.\d+)?)\s*(?:°|º|deg)?\s*C/i.exec(text) ?? /\(\s*(-?\d+(?:\.\d+)?)\s*(?:°|º|deg)\s*C/i.exec(text);
  const tc = t ? parseFloat(t[1]) : undefined;
  return {
    value: Math.round(num * 1000) / 1000,
    unit: 'g/cm³',
    originalText: rawText,
    isStandardConditions: tc === undefined || (tc >= 15 && tc <= 25),
  };
}

export function resolveMedianProperty(parsedList: ParsedProperty[], defaultValue: number): number {
  if (parsedList.length === 0) return defaultValue;

  // Prefer standard conditions if present
  const stdOnly = parsedList.filter((p) => p.isStandardConditions);
  const targetPool = stdOnly.length > 0 ? stdOnly : parsedList;

  const values = targetPool.map((p) => p.value).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return (values[mid - 1] + values[mid]) / 2;
  }
  return values[mid];
}

export function parseGHSCodes(hazardsText: string): string[] {
  if (!hazardsText) return [];
  const matches = hazardsText.match(/H[0-9]{3}[a-zA-Z]*/g);
  return matches ? Array.from(new Set(matches)) : [];
}

// ------------------------------------------------------------------ PUG View helpers (generic text -> visuals)

/** Collects the plain strings under the given TOCHeadings anywhere in a PUG View record. */
export function collectPugViewStrings(root: unknown, headings: string[]): Record<string, string[]> {
  const wanted = new Set(headings);
  const out: Record<string, string[]> = {};
  const strings = (info: any): string[] => {
    const arr = info?.Value?.StringWithMarkup;
    if (!Array.isArray(arr)) return [];
    return arr.map((x: any) => (typeof x?.String === 'string' ? x.String : '')).filter(Boolean);
  };
  const walk = (node: any, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 8) return;
    if (typeof node.TOCHeading === 'string' && wanted.has(node.TOCHeading)) {
      const list = (out[node.TOCHeading] ??= []);
      for (const info of node.Information ?? []) list.push(...strings(info));
    }
    if (Array.isArray(node.Section)) for (const s of node.Section) walk(s, depth + 1);
    if (node.Record) walk(node.Record, depth + 1);
  };
  walk(root, 0);
  return out;
}

/** Room-temperature state from free text such as "White crystalline powder" / "Colorless liquid with a sweet odor". */
export function parsePhysicalState(texts: string[]): 'solid' | 'liquid' | 'gas' | undefined {
  const t = texts.slice(0, 4).join(' ; ').toLowerCase();
  const kinds: Array<['solid' | 'liquid' | 'gas', RegExp]> = [
    ['solid', /\b(solid|powder|crystal\w*|flakes?|granul\w*|pellets?|prills?|needles?|plates?|lumps?|tablets?|dust|metal)\b/],
    ['liquid', /\b(liquid|solution|oil|oily|syrup\w*)\b/],
    ['gas', /\b(gas|vapou?r)\b/],
  ];
  let best: { k: 'solid' | 'liquid' | 'gas'; i: number } | undefined;
  for (const [k, re] of kinds) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.i)) best = { k, i: m.index };
  }
  return best?.k;
}

// ------------------------------------------------------------------ phase at room temperature (derived, never stamped)

export type Phase = 'solid' | 'liquid' | 'gas';
const ROOM_C = 25;

/**
 * Phase at 25 C from melting / boiling point alone: mp > 25 -> solid; else bp < 25 -> gas; else liquid. Unknown (not
 * finite) points are skipped; with neither known `hint` (e.g. PubChem's 'Physical Description' text) decides, else liquid.
 */
export function phaseAtRoom(mp_c?: number | null, bp_c?: number | null, hint?: Phase): Phase {
  const fin = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
  if (fin(mp_c)) {
    if (mp_c > ROOM_C) return 'solid';
    if (fin(bp_c) && bp_c < ROOM_C) return 'gas';
    return 'liquid';
  }
  if (fin(bp_c) && bp_c < ROOM_C) return 'gas';
  return hint ?? 'liquid';
}

/** Shape shared by BottleState (structural so this module stays import-free and Node-testable). */
export interface ThermoSource {
  state?: Phase;
  userOverrides?: { mp_c?: number; bp_c?: number; density?: number };
  sourcedProperties?: { mp_c?: number; bp_c?: number; density?: number; known?: KnownFlags };
}

/** Placeholders record_builder used before the `known` flags existed (20 C, 100 C, 1 g/mL): treated as unknown. */
const PLACEHOLDER = { mp_c: 20, bp_c: 100, density: 1 };

/**
 * Melting point / (normal) boiling point / density to send the engine: a user override wins, then a sourced value that
 * is real data (flagged `known`, or - for bottles saved before the flags - different from the old placeholder default).
 */
export function effectiveThermo(b: ThermoSource): { mp_c?: number; bp_c?: number; density?: number } {
  const fin = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
  const pick = (key: 'mp_c' | 'bp_c' | 'density'): number | undefined => {
    const ov = b.userOverrides?.[key];
    if (fin(ov)) return ov;
    const v = b.sourcedProperties?.[key];
    if (!fin(v)) return undefined;
    const flag = b.sourcedProperties?.known?.[key];
    return flag === true || (flag === undefined && v !== PLACEHOLDER[key]) ? v : undefined;
  };
  return { mp_c: pick('mp_c'), bp_c: pick('bp_c'), density: pick('density') };
}

const P_ATM_PA = 101325;

/**
 * Vapour-pressure points [T K, P Pa] to send the engine: the sourced curve points plus the 1-atm normal boiling point
 * as one more point. A user-overridden boiling point replaces the sourced points (they would contradict it). No point at
 * all = non-volatile, nothing is invented.
 */
export function vaporPressurePoints(b: ThermoSource & { physical?: { vapor_pressure_points?: Array<[number, number]> } }): Array<[number, number]> {
  const fin = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
  const pts: Array<[number, number]> = fin(b.userOverrides?.bp_c) ? [] : (b.physical?.vapor_pressure_points ?? []).map((p) => [p[0], p[1]]);
  const bp = effectiveThermo(b).bp_c;
  if (fin(bp)) {
    const t = bp + 273.15;
    if (!pts.some((p) => Math.abs(p[0] - t) < 0.01 && Math.abs(p[1] / P_ATM_PA - 1) < 1e-6)) pts.push([t, P_ATM_PA]);
  }
  return pts.sort((x, y) => x[0] - y[0]);
}

/**
 * Phase at room temperature of an imported compound, one place for every consumer (dosing form, labels, bottle look):
 * the engine's `state_at_room` when it modelled the compound, else derived from mp / bp at 25 C, else the PubChem
 * text hint (`b.state`), else liquid.
 */
export function importPhase(b: ThermoSource, model?: { state_at_room?: Phase } | null): Phase {
  if (model?.state_at_room) return model.state_at_room;
  const t = effectiveThermo(b);
  return phaseAtRoom(t.mp_c, t.bp_c, b.state);
}
