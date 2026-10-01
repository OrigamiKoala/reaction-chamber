// Property string parsing and conflict resolution
export interface ParsedProperty {
  value: number;
  unit: string;
  originalText: string;
  isStandardConditions: boolean;
}

export function parseTemperatureString(rawText: string): ParsedProperty | null {
  if (!rawText) return null;
  const isStd = rawText.includes('25') || rawText.includes('1 atm') || rawText.includes('760 mm');
  
  // Match number with unit
  const match = rawText.match(/([-+]?[0-9]*\.?[0-9]+)\s*(?:°|deg|degrees)?\s*([CFK])/i);
  if (match) {
    let num = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    if (unit === 'F') {
      num = (num - 32) * (5 / 9);
    } else if (unit === 'K') {
      num = num - 273.15;
    }
    return {
      value: Math.round(num * 10) / 10,
      unit: '°C',
      originalText: rawText,
      isStandardConditions: isStd,
    };
  }
  return null;
}

export function parseDensityString(rawText: string): ParsedProperty | null {
  if (!rawText) return null;
  const isStd = rawText.includes('20') || rawText.includes('25') || rawText.includes('4 °C');
  const match = rawText.match(/([0-9]*\.?[0-9]+)\s*(?:g\/cm3|g\/cm\^?3|g\/cu\.?\s?cm|g\/mL|g\/cc|kg\/m3)/i);
  if (match) {
    let num = parseFloat(match[1]);
    if (rawText.toLowerCase().includes('kg/m3')) {
      num = num / 1000.0;
    }
    return {
      value: Math.round(num * 1000) / 1000,
      unit: 'g/cm³',
      originalText: rawText,
      isStandardConditions: isStd,
    };
  }
  return null;
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

const COLOUR_WORDS: Array<[RegExp, string]> = [
  [/\b(colou?rless|clear|transparent)\b/, '#e8f4fa'],
  [/\bwhite\b/, '#f4f3ef'],
  [/\b(yellow|straw)\b/, '#e8d34a'],
  [/\borange\b/, '#e98a2b'],
  [/\bred\b/, '#c8332c'],
  [/\bpink\b/, '#e79bb4'],
  [/\b(purple|violet|lilac)\b/, '#7b4fa8'],
  [/\bblue\b/, '#3d6fc4'],
  [/\bgreen\b/, '#4f9a55'],
  [/\bbrown\b/, '#7b5233'],
  [/\bblack\b/, '#262626'],
  [/\b(gr[ae]y|silver\w*)\b/, '#9b9da0'],
];

/** First colour word in the text -> sRGB hex (generic English colour names, not per-compound data). */
export function parseColourWord(texts: string[]): string | undefined {
  const t = texts.slice(0, 4).join(' ; ').toLowerCase();
  let best: { c: string; i: number } | undefined;
  for (const [re, hex] of COLOUR_WORDS) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.i)) best = { c: hex, i: m.index };
  }
  if (!best) return undefined;
  if (/\b(pale|light)\b/.test(t) && best.c !== '#e8f4fa' && best.c !== '#f4f3ef') return mixHex(best.c, '#ffffff', 0.45);
  if (/\bdark\b/.test(t)) return mixHex(best.c, '#000000', 0.4);
  return best.c;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Is an imported compound a solid at room temperature? Explicit user melting-point override wins, then the parsed state. */
export function importIsSolid(b: {
  state?: 'solid' | 'liquid' | 'gas';
  userOverrides?: { mp_c?: number };
  sourcedProperties?: { mp_c?: number };
}): boolean {
  const ov = b.userOverrides?.mp_c;
  if (typeof ov === 'number' && isFinite(ov)) return ov > 28;
  if (b.state) return b.state === 'solid';
  const mp = b.sourcedProperties?.mp_c;
  return typeof mp === 'number' && isFinite(mp) && mp > 28;
}
