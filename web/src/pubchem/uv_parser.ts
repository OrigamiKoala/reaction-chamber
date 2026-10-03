// PubChem "UV Spectra" / "Spectral Properties" text -> absorption bands `[nm, eps, fwhm | null, solvent class | null]`.
//
// The engine builds a Gaussian band from each row (width estimated from the band strength when the text gives none) and
// uses it as the compound's solution absorption in that solvent class. A row needs both a wavelength and a molar
// absorptivity (given as `log e` or `e`): a wavelength without an absorptivity is not usable and is dropped (an absorptivity
// is never invented). Only the 200-1100 nm range is kept. Pure: no network, no browser APIs.

export type SolventClass = 'water' | 'alcohol' | 'alkane' | 'aromatic' | 'other';
export type UvBand = [nm: number, eps: number, fwhm: number | null, solvent: SolventClass | null];

/** PUG View headings that carry UV/Vis text. */
export const UV_HEADINGS = ['UV Spectra', 'UV/Vis Spectra', 'UV-Vis Spectra', 'Ultraviolet Spectra'];

const SOLVENTS: Array<[RegExp, SolventClass]> = [
  [/\b(water|aqueous|buffer|h2o|acid|alkali|naoh|hcl)\b/, 'water'],
  [/\b(alcohol|ethanol|methanol|isopropanol|propanol|butanol|etoh|meoh)\b/, 'alcohol'],
  [/\b(hexane|heptane|cyclohexane|isooctane|iso-octane|pentane|octane|petroleum ether|paraffin|alkane)\b/, 'alkane'],
  [/\b(benzene|toluene|xylene)\b/, 'aromatic'],
  [/\b(chloroform|dichloromethane|methylene chloride|acetonitrile|ether|dioxane|dmso|dimethyl sulfoxide|acetone|ethyl acetate|thf|tetrahydrofuran|dmf|ccl4|carbon tetrachloride|cs2)\b/, 'other'],
];

export function solventClassOf(text: string): SolventClass | null {
  const t = text.toLowerCase();
  for (const [re, c] of SOLVENTS) if (re.test(t)) return c;
  return null;
}

const NUM = String.raw`\d+(?:[.,]\d+)*(?:\.\d+)?(?:\s*(?:x|×)\s*10\s*\^?\s*[-+−]?\s*\d+|\s*e[-+]?\d+)?`;

function num(s: string): number {
  let t = s.replace(/\s+/g, '').replace('−', '-');
  const m = /^([\d.,]+)(?:x|×)10\^?([-+]?\d+)$/i.exec(t);
  if (m) return parseFloat(m[1].replace(/,/g, '')) * Math.pow(10, parseInt(m[2], 10));
  t = t.replace(/,(?=\d{3}(\D|$))/g, '');
  return parseFloat(t);
}

/**
 * Parses one UV text row. A row can name several wavelengths with their absorptivities ("246, 280 nm (log e = 4.1, 3.9)")
 * and a solvent in parentheses or after "in".
 */
export function parseUvText(raw: string): UvBand[] {
  if (!raw) return [];
  // thousands separators ("95,000") are not list separators
  const text = raw.replace(/\[[^\]]*\]/g, ' ').replace(/(?<=\d),(?=\d{3}(?!\d))/g, '').replace(/\s+/g, ' ').trim();
  const out: UvBand[] = [];
  // split into segments that start with a "max absorption"-style phrase or a solvent label
  const segs = text.split(/;|\bAND\b|\bMax(?:imum)?\s+absorption\b|\bUV max\b|\bλ\s*max\b|\bLambda max\b|\bMAX ABSORPTION\b|\bABSORPTION MAXIMUM\b/i);
  for (const seg of segs) {
    const solv = solventClassOf((/\(([^)]*)\)/.exec(seg)?.[1] ?? '') + ' ' + (/\bin\s+([a-z][a-z\- ]{2,30})/i.exec(seg)?.[1] ?? '')) ?? solventClassOf(seg);
    // wavelengths: numbers followed by nm (a list "246, 280, 351 nm" shares one unit)
    const wl = new RegExp(String.raw`((?:${NUM})(?:\s*(?:,|and|&)\s*${NUM})*)\s*nm`, 'gi');
    const lm = wl.exec(seg);
    if (!lm) continue;
    const lambdas = lm[1].split(/\s*(?:,|and|&)\s*/i).map(num).filter((x) => isFinite(x));
    const rest = seg.slice(lm.index + lm[0].length);
    // absorptivities: "log e = 4.1, 3.9", "log eps 4.98", "epsilon = 95,000", "e = 1.5X10+4", "(e 9500)"
    const logM = new RegExp(String.raw`(?:log\s*(?:e|ε|eps|epsilon|ε)\b)\s*[=:]?\s*((?:${NUM})(?:\s*(?:,|and|&|;)\s*${NUM})*)`, 'i').exec(rest);
    const linM = new RegExp(String.raw`(?:(?<![a-z])(?:e|ε|eps|epsilon|ε)\s*[=:]\s*|\(\s*ε\s*)((?:${NUM})(?:\s*(?:,|and|&)\s*${NUM})*)`, 'i').exec(rest);
    let eps: number[] = [];
    if (logM) eps = logM[1].split(/\s*(?:,|and|&|;)\s*/i).map((s) => Math.pow(10, num(s)));
    else if (linM) eps = linM[1].split(/\s*(?:,|and|&)\s*/i).map(num);
    if (eps.length === 0) continue;
    for (let i = 0; i < lambdas.length; i++) {
      const e = eps[Math.min(i, eps.length - 1)];
      const nm = lambdas[i];
      if (isFinite(nm) && isFinite(e) && nm >= 200 && nm <= 1100 && e > 0.001 && e < 1e7) out.push([nm, Math.round(e * 100) / 100, null, solv]);
    }
  }
  return out;
}

/** All bands of a list of PubChem UV strings, deduplicated by (wavelength, solvent) keeping the first value. */
export function parseUvBands(texts: string[]): UvBand[] {
  const out: UvBand[] = [];
  for (const t of texts) {
    for (const b of parseUvText(t)) {
      if (!out.some((o) => Math.abs(o[0] - b[0]) < 2 && o[3] === b[3])) out.push(b);
    }
  }
  return out.slice(0, 24);
}
