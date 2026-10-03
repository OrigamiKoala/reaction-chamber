// Colour phrases of PubChem "Color/Form" / "Physical Description" text -> a colour with provenance.
//
// A colour phrase is *the appearance of a thing* (a crystal, a solution, a vapour), never an absorptivity: the engine uses it
// as the measured bulk colour of a solid (or the neat colour of a liquid) and never inverts it into a solution spectrum.
// The parser reads a large lexicon of colour names, lightness/saturation modifiers, "-ish" hues and hyphenated compounds
// ("bluish green", "orange-red", "violet-black", "pale yellow"), and records what the phrase is about (solid / solution /
// liquid / vapour), whether it describes a hydrate, and how confident the reading is. No compound is named anywhere.

export type ColourSubject = 'solid' | 'solution' | 'liquid' | 'vapour';

export interface ColourPhrase {
  /** sRGB hex of the phrase's colour. */
  hex: string;
  subject: ColourSubject;
  /** true when the phrase describes a hydrate, false for "anhydrous", undefined when it does not say. */
  hydrate?: boolean;
  /** 0..1: how sure the reading is (compound hues, hedges and conflicting colours lower it). */
  confidence: number;
  /** The words that were read. */
  phrase: string;
}

/** Colour lexicon: name -> sRGB hex (CSS/X11 names plus the colour words chemists use for solids and solutions). */
const LEXICON: Record<string, string> = {
  colorless: '#eef6fa', colourless: '#eef6fa', clear: '#eef6fa', transparent: '#eef6fa',
  white: '#f4f3ef', milky: '#f1efe8', chalky: '#f1efe8', snow: '#fbfaf8', ivory: '#f1ecd9', cream: '#efe6c8', offwhite: '#eeece4', beige: '#e3d7b9', buff: '#dcc99a',
  yellow: '#e8d34a', lemon: '#f0e04a', straw: '#e6d78a', canary: '#f1e24a', gold: '#d9aa2b', golden: '#d9aa2b', amber: '#d98a1c', ochre: '#c8932f', sulfur: '#e1d43c', sulphur: '#e1d43c', saffron: '#e8a721',
  orange: '#e98a2b', apricot: '#efa86a', peach: '#f0b999', tangerine: '#ee8226',
  red: '#c8332c', scarlet: '#d3391f', crimson: '#b21f35', vermilion: '#d9452b', brick: '#a8442d', rust: '#9a4a24', maroon: '#7a1f2a', burgundy: '#722f3d', carmine: '#a31b3a',
  pink: '#e79bb4', rose: '#d98aa2', salmon: '#ea8d78', coral: '#e77a63', magenta: '#b8368a', fuchsia: '#c43d9b',
  purple: '#7b4fa8', violet: '#6b46a8', lilac: '#b79ad0', lavender: '#b8a9d6', mauve: '#a984a0', plum: '#7b4a78', indigo: '#3f3a8c', amethyst: '#8a62b0',
  blue: '#3d6fc4', navy: '#243a73', azure: '#3f8fd9', cobalt: '#2f5fc0', cyan: '#3fbcd6', turquoise: '#3cb8b0', teal: '#2d8a8a', aqua: '#6cc8d4', cerulean: '#3c86bd', prussian: '#1f4a78', royal: '#2f55b8',
  green: '#4f9a55', olive: '#82853a', lime: '#9ccc3c', emerald: '#2e9e5b', jade: '#4fa07a', moss: '#6b8a3e', sage: '#9aae85', chartreuse: '#a6d33a', verdigris: '#4a9e8e', 
  brown: '#7b5233', tan: '#c9a77c', chocolate: '#5c3a24', copper: '#b8733a', bronze: '#a67a3c', rusty: '#9a4a24', tawny: '#b87b3b', sepia: '#6c4a32', khaki: '#c2b280', chestnut: '#6b3a28', umber: '#6b4a32', mahogany: '#5b2a22', 
  grey: '#9b9da0', gray: '#9b9da0', silver: '#c0c2c5', silvery: '#c0c2c5', metallic: '#a8aaae', slate: '#5f6a75', gunmetal: '#4a5058', steel: '#8a949e', ash: '#b6b6b2', graphite: '#4a4c50', charcoal: '#383a3e',
  black: '#262626', ebony: '#262626', jet: '#1c1c1c',
};

/** Words that darken / lighten / hedge. */
const LIGHTEN = new Set(['pale', 'light', 'faint', 'faintly', 'slightly', 'weak', 'pastel']);
const DARKEN = new Set(['dark', 'deep', 'rich', 'intense']);
const HEDGE = /\b(may|might|usually|often|sometimes|typically|becom\w*|turn\w*|darken\w*|on standing|upon|when impure|impure|technical|commercial|depending|varies|or)\b/;
const CONFLICT = /\b(when|but|becomes?|turns?|on standing|upon|after|if|while|changes?)\b/;

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function rgbToHex(c: number[]): string {
  return '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}
function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  return rgbToHex(pa.map((v, i) => v + (pb[i] - v) * t));
}

/** Resolves one token to a lexicon colour: "bluish" -> blue, "yellowish" -> yellow. */
function lookup(tok: string): { hex: string; ish: boolean } | undefined {
  if (LEXICON[tok]) return { hex: LEXICON[tok], ish: false };
  const m = /^(.+?)(?:ish|y)$/.exec(tok);
  if (m) {
    let stem = m[1];
    if (LEXICON[stem]) return { hex: LEXICON[stem], ish: true };
    // "reddish" -> "redd": drop a doubled final consonant
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
      stem = stem.slice(0, -1);
      if (LEXICON[stem]) return { hex: LEXICON[stem], ish: true };
    }
    if (stem.endsWith('e') || LEXICON[stem + 'e']) {
      const alt = LEXICON[stem + 'e'];
      if (alt) return { hex: alt, ish: true };
    }
  }
  return undefined;
}

interface Reading {
  hex: string;
  compound: boolean;
  modifiers: number;
  words: string;
}

/** Reads the first colour expression of a text segment. */
function readColour(segment: string): Reading | undefined {
  const toks = segment.split(/[^a-z\-]+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    // split hyphenated compounds into their parts
    const parts = toks[i].split('-').filter(Boolean);
    const found = parts.map((p) => ({ p, c: lookup(p) }));
    if (!found.some((f) => f.c)) continue;
    const hues = found.filter((f) => f.c) as Array<{ p: string; c: { hex: string; ish: boolean } }>;
    // modifiers directly before the colour word
    let mods = 0;
    let lighten = false;
    let darken = false;
    for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
      if (LIGHTEN.has(toks[j])) {
        lighten = true;
        mods++;
      } else if (DARKEN.has(toks[j])) {
        darken = true;
        mods++;
      } else break;
    }
    let hex: string;
    let compound = false;
    let words = [...toks.slice(Math.max(0, i - mods), i), toks[i]].join(' ');
    if (hues.length >= 2) {
      // "orange-red", "violet-black": the last hue dominates
      compound = true;
      hex = mix(hues[0].c.hex, hues[hues.length - 1].c.hex, 0.6);
    } else if (hues[0].c.ish && toks[i + 1] && lookup(toks[i + 1]) && !lookup(toks[i + 1])!.ish) {
      // "bluish green": the noun hue dominates
      compound = true;
      hex = mix(hues[0].c.hex, lookup(toks[i + 1])!.hex, 0.7);
      words += ' ' + toks[i + 1];
    } else if (hues[0].c.ish) {
      // a lone "yellowish" is the hue, slightly diluted
      compound = true;
      hex = mix(hues[0].c.hex, '#f2f2f0', 0.25);
    } else {
      hex = hues[0].c.hex;
      // "yellow green" without a hyphen: two bare hue words in a row
      const nxt = toks[i + 1] ? lookup(toks[i + 1]) : undefined;
      if (nxt && !nxt.ish && toks[i] !== 'dark' && toks[i + 1] !== 'dark' && !/^(metallic|silvery)$/.test(toks[i + 1]) && !/^(metallic|silvery)$/.test(toks[i])) {
        compound = true;
        hex = mix(hex, nxt.hex, 0.6);
        words += ' ' + toks[i + 1];
      }
    }
    if (lighten) hex = mix(hex, '#ffffff', 0.45);
    if (darken) hex = mix(hex, '#000000', 0.35);
    return { hex, compound, modifiers: mods, words };
  }
  return undefined;
}

function subjectOf(seg: string): ColourSubject {
  if (/\bsolutions?\b|\baqueous\b|in water|dissolved|\bsol\b/.test(seg)) return 'solution';
  if (/\b(vapou?rs?|gas|fumes?)\b/.test(seg)) return 'vapour';
  if (/\b(liquid|oil|oily|syrup\w*)\b/.test(seg)) return 'liquid';
  return 'solid';
}

/**
 * The colour a PubChem text describes. `texts` are the strings of the "Color/Form" heading first, then "Physical
 * Description": the first segment (split at ';', '.', ' or ') that holds a colour wins.
 */
export function parseColourPhrase(texts: string[]): ColourPhrase | undefined {
  for (const raw of texts.slice(0, 6)) {
    if (!raw) continue;
    const text = raw.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ');
    const segments = text.split(/[;.]|\bor\b/).map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
      const r = readColour(seg);
      if (!r) continue;
      // a second, different colour after a conflict word ("colorless when pure, yellow on standing") lowers the confidence
      let confidence = 0.9;
      if (r.compound) confidence -= 0.15;
      if (HEDGE.test(seg)) confidence -= 0.2;
      const after = seg.slice(seg.indexOf(r.words.split(' ').pop() ?? '') + 1);
      if (CONFLICT.test(seg) && readColour(after) && readColour(after)!.hex !== r.hex) confidence -= 0.35;
      const hydrate = /anhydrous|dehydrated/.test(text) ? false : /hydrat|[·.*]\s*\d*\s*h2o|\b(mono|di|tri|tetra|penta|hexa|hepta|octa|nona|deca)hydrate\b/.test(seg) ? true : undefined;
      return { hex: r.hex, subject: subjectOf(seg), hydrate, confidence: Math.max(0.1, Math.min(1, confidence)), phrase: raw.trim().slice(0, 120) };
    }
  }
  return undefined;
}

/** Back-compat: the sRGB hex of the first colour phrase, or undefined. */
export function parseColourHex(texts: string[]): string | undefined {
  return parseColourPhrase(texts)?.hex;
}
