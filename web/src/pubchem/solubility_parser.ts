// Pure text parsers for PubChem solubility / Ksp / appearance strings (used by solid_fetch.ts, unit-tested in
// tests/solubility_parser.mjs). No imports: Node strips the TS types, so keep this file free of enums and browser APIs.

export type Qualitative =
  | 'very_soluble'
  | 'freely_soluble'
  | 'soluble'
  | 'sparingly_soluble'
  | 'slightly_soluble'
  | 'very_slightly_soluble'
  | 'practically_insoluble';

export type SolidKind = 'powder' | 'curds' | 'gel' | 'crystal';

// ------------------------------------------------------------------ text normalisation

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+',
};

/** Unicode minus / superscripts / citation brackets / non-breaking spaces -> plain ASCII the regexes expect. */
function normalise(raw: string): string {
  let s = raw.replace(/\[[^\]]*\]/g, ' '); // "[Merck Index]" citations
  s = s.replace(/[−–—]/g, '-').replace(/[   ]/g, ' ');
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPT[c] ?? c).join(''));
  s = s.replace(/×/g, 'x').replace(/\*\s*10/g, 'x10').replace(/[Xx]\s*10\s*\(\s*([-+]?\d+)\s*\)/g, 'x10^$1');
  return s;
}

/** Splits free text into independent statements: ';' and sentence ends (a '.' followed by a capital letter). */
function segments(texts: string[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    for (const part of normalise(t).split(/;|\.\s+(?=[A-Z])/)) {
      const p = part.trim();
      if (p) out.push(p);
    }
  }
  return out;
}

function lowerMedian(sorted: number[]): number {
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

// ------------------------------------------------------------------ numbers

// Mantissa with optional exponent: "1.93", "1.5e-3", "1.9X10-3", "4 x 10^-5". Exactly three capture groups.
const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)(?:\s*(?:[xX]\s*10\s*\^?\s*([-+]?\d+)|[eE]([-+]?\d+)))?`;

/** Value of the NUM match whose mantissa group is `m[i]`. */
function numFromGroups(m: RegExpExecArray, i: number): number {
  const mant = parseFloat(m[i]);
  const exp = m[i + 1] ?? m[i + 2];
  return exp !== undefined ? mant * Math.pow(10, parseInt(exp, 10)) : mant;
}

// ------------------------------------------------------------------ water solubility

/** Unit -> g/L factor; `mm` units are per mole, so the result is multiplied by the molar mass. */
interface UnitDef {
  re: string;
  factor: number;
  mm?: boolean;
}

const LITRE = String.raw`(?:L|dm3|dm\^3|litre|liter)`;
const ML100 = String.raw`100\s*(?:mL|cc|cu\.?\s*cm|cm3|cm\^3)`;
// Order matters (specific before general). Matched case-insensitively; all groups non-capturing.
const UNITS: UnitDef[] = [
  { re: String.raw`mg\s*/\s*${ML100}`, factor: 0.01 },
  { re: String.raw`(?:µ|μ|u)g\s*/\s*${ML100}`, factor: 1e-5 },
  { re: String.raw`g\s*/\s*${ML100}`, factor: 10 },
  { re: String.raw`mg\s*/\s*100\s*g`, factor: 0.01 },
  { re: String.raw`g\s*/\s*100\s*g`, factor: 10 }, // g per 100 g water ~ 10 g/L (water ~ 1 g/mL)
  { re: String.raw`g\s*/\s*kg`, factor: 1 },
  { re: String.raw`mg\s*/\s*kg`, factor: 1e-3 },
  { re: String.raw`(?:µ|μ|u)g\s*/\s*${LITRE}`, factor: 1e-6 },
  { re: String.raw`mg\s*/\s*(?:mL|cc|cm3)`, factor: 1 },
  { re: String.raw`mg\s*/\s*${LITRE}`, factor: 1e-3 },
  { re: String.raw`g\s*/\s*(?:mL|cc|cm3)`, factor: 1000 },
  { re: String.raw`g\s*/\s*${LITRE}`, factor: 1 },
  { re: String.raw`mmol\s*/\s*${LITRE}`, factor: 1e-3, mm: true },
  { re: String.raw`mol\s*/\s*(?:${LITRE}|kg)`, factor: 1, mm: true },
  { re: String.raw`ppm`, factor: 1e-3 },
  { re: String.raw`ppb`, factor: 1e-6 },
];

const UNIT_RE_I = new RegExp(`^\\s*(?:${UNITS.map((u) => `(${u.re})`).join('|')})`, 'i');
const UNIT_ANY = UNITS.map((u) => u.re).join('|');
// The bare molar "M" ("0.01 M") is case-sensitive, so it is matched on its own.
const MOLAR_RE = /^\s*M(?![A-Za-z])/;

function matchUnit(rest: string): { factor: number; mm: boolean; len: number } | undefined {
  const m = UNIT_RE_I.exec(rest);
  if (m) {
    for (let i = 0; i < UNITS.length; i++) {
      if (m[i + 1] !== undefined) return { factor: UNITS[i].factor, mm: !!UNITS[i].mm, len: m[0].length };
    }
  }
  const mm = MOLAR_RE.exec(rest);
  return mm ? { factor: 1, mm: true, len: mm[0].length } : undefined;
}

const WATER_WORD = /\b(?:water|aqueous|H2O)\b/gi;
// Other solvents / reagents: a quantity nearer to one of these than to "water" is not a water solubility.
const OTHER_SOLVENT_SRC =
  String.raw`\b(?:alcohol|ethanol|methanol|propanol|ether|acetone|benzene|toluene|chloroform|aniline|pyridine|glycerol|glycerin|hexane|DMSO|DMF|acetic|ethyl\s+acetate|carbon\s+disulfide|CS2|oils?|acids?|HCl|HNO3|H2SO4|ammonia|NH3|NH4OH|alkali\w*|hydroxide|cyanide|thiosulfate|solvents?)\b`;
const OTHER_SOLVENT = new RegExp(OTHER_SOLVENT_SRC, 'gi');
const OTHER_SOLVENT_TEST = new RegExp(OTHER_SOLVENT_SRC, 'i');

interface Hit {
  value: number; // g/L
  tempC: number | undefined;
}

function nearestSolventIsWater(seg: string, qStart: number, qEnd: number): boolean {
  let bestD = Infinity;
  let bestWater = false;
  const scan = (re: RegExp, water: boolean) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg))) {
      const s = m.index;
      const e = s + m[0].length;
      const d = e <= qStart ? qStart - e : s >= qEnd ? s - qEnd : 0;
      if (d < bestD || (d === bestD && water)) {
        bestD = d;
        bestWater = water;
      }
    }
  };
  scan(WATER_WORD, true);
  scan(OTHER_SOLVENT, false);
  if (bestD === Infinity) return true; // no solvent named at all: the Solubility heading is about water
  return bestWater;
}

function temperatureIn(seg: string): number | undefined {
  // "at 25 deg C", "@ 18 °C", "20°C" (a bare "5 C" without degree sign or at/@ is not trusted)
  const m = /(?:(?:at|@)\s*(-?\d+(?:\.\d+)?)\s*(?:°|º|deg\.?|degrees?)?\s*C\b)|(?:(-?\d+(?:\.\d+)?)\s*(?:°|º|deg\.?|degrees?)\s*C\b)/i.exec(seg);
  if (m) {
    const t = parseFloat(m[1] ?? m[2]);
    if (isFinite(t) && t > -20 && t < 120) return t;
  }
  const k = /\b(\d{3}(?:\.\d+)?)\s*K\b/.exec(seg);
  if (k) {
    const t = parseFloat(k[1]) - 273.15;
    if (t > -20 && t < 120) return t;
  }
  return undefined;
}

function scanSegment(seg: string, molarMass: number | undefined): Hit | undefined {
  const accept = (v: number, u: { factor: number; mm: boolean }, qs: number, qe: number, tempSrc: string): Hit | undefined => {
    let g = v * u.factor;
    if (u.mm) {
      if (!molarMass || molarMass <= 0) return undefined;
      g *= molarMass;
    }
    if (!isFinite(g) || g <= 0 || g > 5000) return undefined;
    if (!nearestSolventIsWater(seg, qs, qe)) return undefined;
    return { value: g, tempC: temperatureIn(tempSrc) };
  };

  // A) number then unit: "1.93 mg/L at 25 deg C", "0.0019 g/100 mL", "1.5e-3 mol/L"
  const reA = new RegExp(`(?<![\\d.^/-])${NUM}`, 'g');
  let m: RegExpExecArray | null;
  while ((m = reA.exec(seg))) {
    const end = m.index + m[0].length;
    const u = matchUnit(seg.slice(end));
    if (!u) continue;
    const hit = accept(numFromGroups(m, 1), u, m.index, end + u.len, seg);
    if (hit) return hit;
  }

  // B) unit then number: "Water (g/100 cu cm) 0.076 at 20 °C", "g/100 mL at 20 °C: 0.07"
  const reB = new RegExp(
    String.raw`(?:${UNIT_ANY})\s*\)?(?:\s*(?:at|@)\s*-?\d+(?:\.\d+)?\s*(?:°|º|deg)?\s*C)?\s*[:=,@]?\s*${NUM}`,
    'gi',
  );
  while ((m = reB.exec(seg))) {
    const u = matchUnit(seg.slice(m.index));
    if (!u) continue;
    const hit = accept(numFromGroups(m, 1), u, m.index, m.index + m[0].length, seg);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Water solubility in g of solid per litre, from PubChem 'Solubility' / 'Physical Description' strings. Only statements
 * about water count; the entries closest to 25 C are kept (median, or geometric mean of the middle pair, as values
 * span decades). `molarMass` (g/mol) is only needed for molar units (mol/L, mmol/L, M).
 */
export function parseWaterSolubilityGPerL(texts: string[], molarMass?: number): number | undefined {
  const hits: Hit[] = [];
  for (const seg of segments(texts)) {
    const h = scanSegment(seg, molarMass);
    if (h) hits.push(h);
  }
  if (hits.length === 0) return undefined;
  const dist = (h: Hit) => (h.tempC === undefined ? 3 : Math.abs(h.tempC - 25));
  const best = Math.min(...hits.map(dist));
  const near = hits.filter((h) => dist(h) <= best + 7).map((h) => h.value).sort((a, b) => a - b);
  const mid = Math.floor(near.length / 2);
  return near.length % 2 ? near[mid] : Math.sqrt(near[mid - 1] * near[mid]);
}

// ------------------------------------------------------------------ Ksp

/** log10 Ksp from "Ksp = 1.8X10-10", "solubility product 1.77 x 10^-10", "pKsp 9.75". Median if several. */
export function parseKsp(texts: string[]): number | undefined {
  const vals: number[] = [];
  const GAP = String.raw`(?:\s*\(?\s*(?:at|@)\s*-?\d+(?:\.\d+)?\s*(?:°|º|deg)?\s*C\)?)?\s*(?:\([^)]{0,20}\))?\s*(?:[:=≈~]|is|of)?\s*`;
  for (const seg of segments(texts)) {
    const re = new RegExp(String.raw`(?<![A-Za-z])(p)?K\s*_?\s*sp\b${GAP}${NUM}`, 'gi');
    const re2 = new RegExp(String.raw`solubility\s+product(?:\s+constant)?${GAP}${NUM}`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg))) {
      const v = numFromGroups(m, 2);
      if (m[1]) {
        if (v > 0 && v < 80) vals.push(-v); // pKsp
      } else if (v > 0 && v < 1) {
        vals.push(Math.log10(v));
      }
    }
    while ((m = re2.exec(seg))) {
      const v = numFromGroups(m, 1);
      if (v > 0 && v < 1) vals.push(Math.log10(v));
    }
  }
  if (vals.length === 0) return undefined;
  vals.sort((a, b) => a - b);
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

// ------------------------------------------------------------------ qualitative solubility

const QUAL_ORDER: Qualitative[] = [
  'practically_insoluble',
  'very_slightly_soluble',
  'slightly_soluble',
  'sparingly_soluble',
  'soluble',
  'freely_soluble',
  'very_soluble',
];

// First match wins (most specific first).
const QUAL_PHRASES: Array<[RegExp, Qualitative]> = [
  [/\b(?:practically|virtually|essentially|almost|nearly)\s+(?:in)?soluble\b/, 'practically_insoluble'],
  [/\b(?:very|extremely)\s+(?:slightly|sparingly|poorly)\s+(?:soluble|sol\b)/, 'very_slightly_soluble'],
  [/\b(?:slightly|poorly|barely|scarcely)\s+(?:soluble|sol\b)/, 'slightly_soluble'],
  [/\bsparingly\s+(?:soluble|sol\b)/, 'sparingly_soluble'],
  [/\bfreely\s+(?:soluble|sol\b)/, 'freely_soluble'],
  [/\b(?:very|highly|extremely)\s+(?:soluble|sol\b)|\bmiscible\b/, 'very_soluble'],
  [/\b(?:insoluble|insol\b|not\s+soluble|negligibly\s+soluble|does\s+not\s+dissolve)/, 'practically_insoluble'],
  [/\b(?:soluble|sol\b)/, 'soluble'],
];

/**
 * Qualitative water solubility from words, only for statements about water (or a bare "X salts are insoluble" with
 * no solvent named). "Decomposes / reacts with water" -> undefined. Several statements: lower median.
 */
export function parseQualitativeSolubility(texts: string[]): Qualitative | undefined {
  const found: number[] = [];
  for (const seg of segments(texts)) {
    for (const clause of seg.split(/,|\bbut\b/i)) {
      const c = clause.toLowerCase().trim();
      if (!c) continue;
      const waterNamed = /\b(?:water|h2o)\b/.test(c);
      if (waterNamed && /\b(?:decompos\w*|reacts?|hydroly[sz]\w*)\b/.test(c)) return undefined;
      for (const [re, q] of QUAL_PHRASES) {
        const m = re.exec(c);
        if (!m) continue;
        const after = c.slice(m.index + m[0].length);
        // "soluble in KI solution" / "insol in alcohol" are about other solvents, not water.
        if (waterNamed || (!/^\s*(?:in|with|to|by)\b/.test(after) && !OTHER_SOLVENT_TEST.test(c))) {
          found.push(QUAL_ORDER.indexOf(q));
        }
        break;
      }
    }
  }
  if (found.length === 0) return undefined;
  found.sort((a, b) => a - b);
  return QUAL_ORDER[lowerMedian(found)];
}

// ------------------------------------------------------------------ appearance

/** Precipitate habit from appearance words. */
export function parseSolidKind(texts: string[]): SolidKind {
  const t = texts.join(' ; ').toLowerCase();
  if (/\b(?:gelatinous|gel|flocculent|colloidal)\b/.test(t)) return 'gel';
  if (/\b(?:curdy|cheesy|curds?)\b/.test(t)) return 'curds';
  const crystal = /\bcrystal\w*|\bneedles?\b/.test(t);
  // "crystalline or amorphous powder" is a powder; amorphous on its own reads as a gel.
  if (/\bamorphous\b/.test(t) && !crystal && !/\bpowder\b/.test(t)) return 'gel';
  return crystal ? 'crystal' : 'powder';
}

/** Density in g/mL from PubChem 'Density' strings ("6.16 g/cu cm", "6.16 @25 °C", "5.56"); median of sane values. */
export function parseSolidDensity(texts: string[]): number | undefined {
  const vals: number[] = [];
  const re = new RegExp(String.raw`^\s*(?:density\s*[:=]?\s*)?${NUM}\s*(g\s*/\s*(?:cm\^?3|cu\.?\s*cm|mL|cc)|kg\s*/\s*m\^?3)?`, 'i');
  for (const raw of texts) {
    const m = re.exec(normalise(raw));
    if (!m) continue;
    let v = numFromGroups(m, 1);
    if (m[4] && /^kg/i.test(m[4])) v /= 1000;
    if (v >= 0.5 && v <= 25) vals.push(v);
  }
  if (vals.length === 0) return undefined;
  vals.sort((a, b) => a - b);
  return lowerMedian(vals);
}

/** "#rrggbb" sRGB -> linear-light [r,g,b] 0..1 (what the engine's MineralData.color_linear_rgb wants). */
export function srgbHexToLinear(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const ch = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [ch(0), ch(2), ch(4)];
}
