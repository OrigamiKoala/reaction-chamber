// Pure text parsers for PubChem thermodynamic strings: enthalpies of fusion / vaporization / combustion, vapour-pressure
// points and boiling points that carry a pressure (used by record_builder.ts, unit-tested in tests/thermo_parser.mjs).
// No imports: Node strips the TS types, so keep this file free of enums and browser APIs.
//
// Only (nearly) pressure-independent data or points of a curve are produced: the engine fits the curves itself, so a
// boiling point "at 10 mm Hg" is a vapour-pressure POINT, not "the" boiling point.

/** PUG View TOC headings that carry each quantity; the parsers take the plain strings under them. */
export const FUSION_HEADINGS = ['Heat of Fusion', 'Enthalpy of Fusion', 'Heat of Melting'];
export const VAPORIZATION_HEADINGS = ['Heat of Vaporization', 'Enthalpy of Vaporization', 'Latent Heat of Vaporization'];
export const COMBUSTION_HEADINGS = ['Heat of Combustion', 'Enthalpy of Combustion'];
export const VAPOR_PRESSURE_HEADINGS = ['Vapor Pressure'];

const P_ATM = 101325;

const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)(?:\s*(?:[xX]\s*10\s*\^?\s*([-+]?\d+)|[eE]([-+]?\d+)))?`;

const RANGE_UNIT = String.raw`(?=\s*(?:°|º|deg|[CFK](?![A-Za-z])|kJ|MJ|kcal|cal\b|J\b|mm\s*Hg|torr|kPa|hPa|mbar|bar\b|atm\b|Pa\b))`;
/** "A-B unit" / "A to B unit" with ordered, close ends (a real range). */
const RANGE_RE = new RegExp(String.raw`(?<![\d.])(-?\d+(?:\.\d+)?)\s*(?:°|º|deg(?:rees?)?\.?)?\s*(?:to|-)\s*(-?\d+(?:\.\d+)?)${RANGE_UNIT}`, 'gi');

function normalise(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, ' ') // "[Merck Index]" citations
    .replace(/[−–—]/g, '-')
    .replace(/[   ]/g, ' ')
    .replace(/×/g, 'x')
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1') // thousands separators: "1,367 kJ/mol"
    // a range quotes one value: its midpoint ("100-102 °C at 10 mm Hg" is 101 °C, not -102 °C)
    .replace(RANGE_RE, (m, a: string, b: string) => {
      const lo = parseFloat(a);
      const hi = parseFloat(b);
      if (!(hi >= lo) || hi - lo > Math.max(30, Math.abs(lo) * 0.25)) return m;
      return String(Math.round(((lo + hi) / 2) * 1000) / 1000);
    });
}

/** Qualifiers that make a quoted temperature something other than the property: decomposition / sublimation points, bounds. */
const REJECT_QUALIFIER = /\b(decompos\w*|sublim\w*|greater\s+than|less\s+than|more\s+than|above|below|exceeds?)\b|(^|\s)[<>]\s*\d/i;

/** Value of a NUM match whose three groups start at index `i` of `m`. */
function numAt(m: RegExpExecArray, i: number): number {
  let v = parseFloat(m[i]);
  const exp = m[i + 1] ?? m[i + 2];
  if (exp !== undefined) v *= Math.pow(10, parseInt(exp, 10));
  return v;
}

// ------------------------------------------------------------------ temperatures and pressures

/** "20 °C", "52.6 deg C", "293 K", "68 °F" (number first) -> kelvin. */
const TEMP = String.raw`(-?\d+(?:\.\d+)?)\s*(?:°|º|deg(?:rees?)?\.?)?\s*([CFK])(?![A-Za-z])`;

function toKelvin(v: number, unit: string): number {
  const u = unit.toUpperCase();
  return u === 'C' ? v + 273.15 : u === 'F' ? ((v - 32) * 5) / 9 + 273.15 : v;
}

const PRESSURE_PA: Record<string, number> = {
  mmhg: 133.322368, torr: 133.322368, kpa: 1e3, hpa: 100, mbar: 100, bar: 1e5, atm: P_ATM, psi: 6894.757, pa: 1,
};
const PUNIT = String.raw`(mm\s*Hg|torr|kPa|hPa|mbar|bar|atm|psi|Pa)(?![A-Za-z])`;

function pressurePa(unit: string): number {
  return PRESSURE_PA[unit.toLowerCase().replace(/\s+/g, '')];
}

type Point = [number, number];

function sane(t_k: number, p_pa: number): boolean {
  return t_k >= 60 && t_k <= 1500 && p_pa > 1e-12 && p_pa <= 5e7;
}

/**
 * Vapour-pressure points [T kelvin, P pascal] from PubChem 'Vapor Pressure' strings such as "0.05 mmHg at 20 °C",
 * "VP: 1.2 kPa at 25 °C", "5.0X10-2 mm Hg at 25 °C (NTP, 1992)" or "Vapor pressure, kPa at 20 °C: 5.8". Entries
 * without a temperature are skipped (never guessed). Sorted by temperature, exact duplicates removed.
 */
export function parseVaporPressurePoints(texts: string[]): Point[] {
  const out: Point[] = [];
  const add = (t: number, p: number) => {
    if (sane(t, p) && !out.some((q) => Math.abs(q[0] - t) < 0.01 && Math.abs(q[1] / p - 1) < 1e-6)) out.push([t, p]);
  };
  const tempRe = new RegExp(String.raw`(?:\bat\b|@|\()\s*${TEMP}`, 'i');
  for (const raw of texts) {
    for (const seg of normalise(raw).split(/;|\.\s+(?=[A-Z])/)) {
      const tm = tempRe.exec(seg);
      if (!tm) continue;
      const tK = toKelvin(parseFloat(tm[1]), tm[2]);
      // value before the unit ("0.05 mmHg at 20 °C")
      const before = new RegExp(`${NUM}\\s*${PUNIT}`, 'i').exec(seg);
      if (before && before.index < tm.index) {
        add(tK, numAt(before, 1) * pressurePa(before[4]));
        continue;
      }
      // unit before, value after a colon ("Vapor pressure, kPa at 20 °C: 5.8")
      const unit = new RegExp(PUNIT, 'i').exec(seg);
      if (unit && unit.index < tm.index) {
        const after = new RegExp(`:\\s*${NUM}`).exec(seg.slice(tm.index));
        if (after) add(tK, numAt(after, 1) * pressurePa(unit[1]));
      }
    }
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/**
 * Boiling points from PubChem 'Boiling Point' strings. A value stated at (about) 1 atm, or with no pressure, is a
 * normal boiling point (°C); a value "at 10 mm Hg" is a vapour-pressure point instead.
 */
export function parseBoilingPoints(texts: string[]): { normal_c: number[]; points: Point[] } {
  const normal: number[] = [];
  const points: Point[] = [];
  const re = new RegExp(TEMP, 'i');
  const pre = new RegExp(`(?:\\bat\\b|@|\\()\\s*${NUM}\\s*${PUNIT}`, 'i');
  for (const raw of texts) {
    for (const seg of normalise(raw).split(/;|\.\s+(?=[A-Z])/)) {
      if (REJECT_QUALIFIER.test(seg)) continue; // "(decomposes)", "(sublimes)", "greater than 212 °F": not a boiling point
      const t = re.exec(seg);
      if (!t) continue;
      const p = pre.exec(seg);
      const c = ((): number => {
        const v = parseFloat(t[1]);
        return t[2].toUpperCase() === 'C' ? v : t[2].toUpperCase() === 'F' ? ((v - 32) * 5) / 9 : v - 273.15;
      })();
      const pPa = p ? numAt(p, 1) * pressurePa(p[4]) : undefined;
      if (pPa === undefined || Math.abs(pPa / P_ATM - 1) < 0.05) normal.push(Math.round(c * 10) / 10);
      else if (sane(c + 273.15, pPa)) points.push([c + 273.15, pPa]);
    }
  }
  return { normal_c: normal, points: points.sort((a, b) => a[0] - b[0]) };
}

// ------------------------------------------------------------------ enthalpies

const ENERGY_J: Record<string, number> = { mj: 1e6, kj: 1e3, j: 1, kcal: 4184, cal: 4.184, btu: 1055.056 };
// energy / amount, longest alternatives first ("kg mol" before "kg", "g mol" before "g")
const UNIT = String.raw`(MJ|kJ|kcal|cal|Btu|J)\s*(?:\/|per)\s*(kg\s*-?\s*mol(?:e)?|kmol(?:e)?|g\s*-?\s*mol(?:e)?|mol(?:e)?|kg|g|lb(?!\s*-?\s*mol))(?![A-Za-z])`;
const AT_TEMP = new RegExp(String.raw`(?:\bat\b|@|\()\s*${TEMP}`, 'i');
const AT_BP = /\bat\s+(?:the\s+)?(?:normal\s+)?(?:b\.?\s?p\.?|boiling)/i;

interface Heat {
  /** kJ per mole. */
  kj: number;
  /** Temperature the value was quoted at, if the string says so. */
  at_k?: number;
  /** Quoted "at the boiling point". */
  at_bp?: boolean;
}

/** Every "<number> <energy>/<amount>" in the texts. `mw` (g/mol) is only needed for per-mass units. `max` bounds |kJ/mol|. */
function scan(texts: string[], mw: number | undefined, max: number): Heat[] {
  const out: Heat[] = [];
  const re = new RegExp(`${NUM}\\s*${UNIT}`, 'gi');
  for (const raw of texts) {
    for (const seg of normalise(raw).split(/;|\.\s+(?=[A-Z])/)) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(seg))) {
        const joules = numAt(m, 1) * ENERGY_J[m[4].toLowerCase()];
        const per = m[5].toLowerCase().replace(/[\s-]+/g, '');
        let jPerMol: number;
        if (per === 'mol' || per === 'mole' || per === 'gmol' || per === 'gmole') jPerMol = joules;
        else if (per === 'kmol' || per === 'kmole' || per === 'kgmol' || per === 'kgmole') jPerMol = joules / 1000;
        else {
          if (!(typeof mw === 'number' && mw > 0)) continue; // per mass, but no molar mass to convert with
          const jPerG = per === 'kg' ? joules / 1000 : per === 'lb' ? joules / 453.592 : joules;
          jPerMol = jPerG * mw;
        }
        const kj = jPerMol / 1000;
        if (!(kj > 0 && kj <= max)) continue;
        const rest = seg.slice(m.index + m[0].length);
        const tm = AT_TEMP.exec(rest);
        out.push({ kj, at_k: tm ? toKelvin(parseFloat(tm[1]), tm[2]) : undefined, at_bp: AT_BP.test(rest) || undefined });
      }
    }
  }
  return out;
}

function medianHeat(hits: Heat[]): Heat | undefined {
  if (hits.length === 0) return undefined;
  const v = hits.slice().sort((a, b) => a.kj - b.kj);
  return v[Math.floor((v.length - 1) / 2)];
}

/**
 * Molar heat of fusion (kJ/mol) from strings such as "6.01 kJ/mol", "333.55 J/g", "80 cal/g", "1.43 kcal/mol at 0 °C",
 * "40.7 kJ/kg mol"; median of the values found. Per-mass units need `mw` (g/mol), else they are skipped.
 */
export function parseHeatOfFusionKJMol(texts: string[], mw?: number): number | undefined {
  return medianHeat(scan(texts, mw, 600))?.kj;
}

/**
 * Molar heat of vaporization (kJ/mol), median of the values found, with the temperature it was quoted at (`at_k`,
 * kelvin) when the same string gives one, or `at_bp` when it says "at the boiling point" (caller knows Tb).
 */
export function parseHeatOfVaporization(texts: string[], mw?: number): { kj: number; at_k?: number; at_bp?: boolean } | undefined {
  return medianHeat(scan(texts, mw, 600));
}

/**
 * Standard heat of combustion, kJ/mol, NEGATIVE (exothermic) whatever sign the source prints (PubChem mixes
 * "-1367 kJ/mol" and "1367 kJ/mol"; combustion is always exothermic). Per-mass units need `mw`.
 */
export function parseHeatOfCombustionKJMol(texts: string[], mw?: number): number | undefined {
  const h = medianHeat(scan(texts, mw, 60000));
  return h ? -h.kj : undefined;
}

// ------------------------------------------------------------------ physical sanity gates

/** Trouton: dHvap / Tb is 85-110 J/(mol K) for most liquids; the gate only catches gross errors (50-150). */
export function troutonOk(dh_vap_kj_mol: number, tb_k: number): boolean {
  if (!(dh_vap_kj_mol > 0) || !(tb_k > 20)) return true; // cannot check without a boiling point
  const r = (dh_vap_kj_mol * 1000) / tb_k;
  return r >= 50 && r <= 150;
}

/** Walden: dHfus / Tm is ~56 J/(mol K) for molecular crystals, ~10 for metals; the gate allows 5-150. */
export function waldenOk(dh_fus_kj_mol: number, tm_k: number): boolean {
  if (!(dh_fus_kj_mol > 0) || !(tm_k > 20)) return true;
  const r = (dh_fus_kj_mol * 1000) / tm_k;
  return r >= 5 && r <= 150;
}
