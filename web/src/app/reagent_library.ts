// Reagent library: the WASM catalog (reacting reagents) + PubChem imports (visual only) + recently used.
// Fully data-driven — no per-compound tables — so it scales to thousands of entries.
import { ReagentCatalogEntry, CompoundModel } from '../types/sim';
import { BottleState } from '../types';
import { loadJSON, saveJSON } from './storage';
import { importIsSolid } from '../pubchem/parser';

export type ReagentItem =
  | { kind: 'catalog'; key: string; id: string; entry: ReagentCatalogEntry }
  /** `model` is the engine's formula-driven reaction model (modelable=false -> visual only; undefined = not modelled yet). */
  | { kind: 'imported'; key: string; id: string; bottle: BottleState; model?: CompoundModel };

export type ReagentFilter = 'all' | 'solution' | 'liquid' | 'solid' | 'indicator' | 'imported';
export type AmountMode = 'ml' | 'g' | 'drops';

export const FILTERS: Array<{ id: ReagentFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'solution', label: 'Solutions' },
  { id: 'liquid', label: 'Liquids' },
  { id: 'solid', label: 'Solids' },
  { id: 'indicator', label: 'Indicators' },
  { id: 'imported', label: 'Imported' },
];

const RECENT_KEY = 'rc.recent.v1';
const IMPORTED_KEY = 'rc.imported.v1';
const RECENT_CAP = 24;
const IMPORTED_CAP = 200;

/** Neutral pour-stream colour for clear liquids (no per-reagent colour tables). */
export const NEUTRAL_STREAM = '#e8f4fa';

export class ReagentLibrary {
  private catalog: ReagentCatalogEntry[] = [];
  private imported: BottleState[] = [];
  private models = new Map<string, CompoundModel>();
  private recent: string[] = [];
  private items = new Map<string, ReagentItem>();
  private ordered: ReagentItem[] = [];
  private hay = new Map<string, string>();
  public onChange?: () => void;

  constructor() {
    this.recent = loadJSON<string[]>(RECENT_KEY, []).filter((k) => typeof k === 'string');
    const imp = loadJSON<BottleState[]>(IMPORTED_KEY, []);
    this.imported = Array.isArray(imp) ? imp.filter((b) => b && typeof b.id === 'string') : [];
    this.rebuild();
  }

  // ------------------------------------------------------------------ mutation
  public setCatalog(c: ReagentCatalogEntry[]) {
    this.catalog = c.slice();
    this.rebuild();
  }

  public catalogEntries(): ReagentCatalogEntry[] {
    return this.catalog;
  }

  public importedBottles(): BottleState[] {
    return this.imported;
  }

  /** Adds (or returns the existing) imported bottle, deduped by InChIKey. */
  public addImported(b: BottleState): ReagentItem {
    const existing = this.imported.find((x) => x.inchi_key && x.inchi_key === b.inchi_key);
    if (existing) return this.items.get(`pc:${existing.id}`)!;
    this.imported.unshift(b);
    if (this.imported.length > IMPORTED_CAP) this.imported.length = IMPORTED_CAP;
    saveJSON(IMPORTED_KEY, this.imported);
    this.rebuild();
    return this.items.get(`pc:${b.id}`)!;
  }

  /** Records the engine's reaction model for an imported bottle (it then becomes dosable as a reacting reagent). */
  public setModel(bottleId: string, model: CompoundModel) {
    this.models.set(bottleId, model);
    this.rebuild();
  }

  public modelOf(bottleId: string): CompoundModel | undefined {
    return this.models.get(bottleId);
  }

  public persistImported() {
    saveJSON(IMPORTED_KEY, this.imported);
  }

  public markUsed(key: string) {
    this.recent = [key, ...this.recent.filter((k) => k !== key)].slice(0, RECENT_CAP);
    saveJSON(RECENT_KEY, this.recent);
    this.onChange?.();
  }

  private rebuild() {
    this.items.clear();
    this.hay.clear();
    this.ordered = [];
    for (const e of this.catalog) {
      const it: ReagentItem = { kind: 'catalog', key: `cat:${e.id}`, id: e.id, entry: e };
      this.items.set(it.key, it);
      this.ordered.push(it);
    }
    for (const b of this.imported) {
      const it: ReagentItem = { kind: 'imported', key: `pc:${b.id}`, id: b.id, bottle: b, model: this.models.get(b.id) };
      this.items.set(it.key, it);
      this.ordered.push(it);
    }
    this.onChange?.();
  }

  // ------------------------------------------------------------------ lookup
  public get(key: string): ReagentItem | undefined {
    return this.items.get(key);
  }

  /** Shelf/bottle ids are catalog ids or PubChem bottle ids. */
  public findByShelfId(id: string): ReagentItem | undefined {
    return this.items.get(`cat:${id}`) ?? this.items.get(`pc:${id}`);
  }

  public recentItems(): ReagentItem[] {
    return this.recent.map((k) => this.items.get(k)).filter((x): x is ReagentItem => !!x);
  }

  public get size(): number {
    return this.ordered.length;
  }

  /** Catalog entry with the same formula as an imported compound (offers the reacting version). */
  public catalogMatchFor(b: BottleState): ReagentCatalogEntry | undefined {
    const f = formulaKey(b.formula);
    if (!f) return undefined;
    return this.catalog.find((e) => e.id !== b.id && formulaKey(e.formula) === f);
  }

  public matchesFilter(it: ReagentItem, f: ReagentFilter): boolean {
    if (f === 'all') return true;
    if (f === 'imported') return it.kind === 'imported';
    if (it.kind !== 'catalog') return false;
    const e = it.entry;
    if (f === 'indicator') return !!e.dropper;
    if (f === 'solid') return e.form === 'solid' || e.by_mass;
    if (f === 'liquid') return e.form === 'liquid' && !e.dropper;
    if (f === 'solution') return e.form === 'solution' && !e.dropper;
    return true;
  }

  public search(query: string, filter: ReagentFilter, limit: number): { items: ReagentItem[]; total: number } {
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored: Array<{ it: ReagentItem; s: number; i: number }> = [];
    this.ordered.forEach((it, i) => {
      if (!this.matchesFilter(it, filter)) return;
      if (tokens.length === 0) {
        scored.push({ it, s: 0, i });
        return;
      }
      const hay = this.haystack(it);
      if (!tokens.every((t) => hay.includes(t))) return;
      const name = displayName(it).toLowerCase();
      const formula = formulaOf(it).toLowerCase();
      let s = 5;
      if (formula === q) s = 0;
      else if (name.startsWith(q)) s = 1;
      else if (name.includes(` ${q}`) || name.includes(`(${q}`)) s = 2;
      else if (formula.startsWith(q)) s = 3;
      else if (name.includes(q)) s = 4;
      scored.push({ it, s, i });
    });
    scored.sort((a, b) => a.s - b.s || a.i - b.i);
    return { items: scored.slice(0, limit).map((x) => x.it), total: scored.length };
  }

  private haystack(it: ReagentItem): string {
    let s = this.hay.get(it.key);
    if (s === undefined) {
      s = it.kind === 'catalog'
        ? `${it.entry.name} ${it.entry.formula} ${it.entry.id} ${it.entry.label}`.toLowerCase()
        : `${it.bottle.name} ${it.bottle.formula} ${it.bottle.cid ?? ''}`.toLowerCase();
      this.hay.set(it.key, s);
    }
    return s;
  }
}

// ------------------------------------------------------------------ item presentation (generic)
/**
 * Order-independent key of a chemical formula (element multiset), so PubChem's Hill-ordered "ClNa" matches "NaCl".
 * Hydrate suffixes ("·5H2O") are ignored; unparsable text falls back to the lower-cased string.
 */
export function formulaKey(formula: string): string {
  const raw = (formula || '').replace(/\s+/g, '');
  const body = raw.split(/[·.*•]/)[0];
  const counts = new Map<string, number>();
  let i = 0;
  const group = (depth: number): boolean => {
    while (i < body.length) {
      const c = body[i];
      if (c === '(' || c === '[') {
        i++;
        const before = new Map(counts);
        counts.clear();
        if (!group(depth + 1)) return false;
        const inner = new Map(counts);
        let n = '';
        while (i < body.length && /[0-9]/.test(body[i])) n += body[i++];
        const mult = n ? parseInt(n, 10) : 1;
        counts.clear();
        before.forEach((v, k) => counts.set(k, v));
        inner.forEach((v, k) => counts.set(k, (counts.get(k) ?? 0) + v * mult));
      } else if (c === ')' || c === ']') {
        i++;
        return depth > 0;
      } else if (/[A-Z]/.test(c)) {
        let sym = c;
        i++;
        if (i < body.length && /[a-z]/.test(body[i])) sym += body[i++];
        let n = '';
        while (i < body.length && /[0-9]/.test(body[i])) n += body[i++];
        counts.set(sym, (counts.get(sym) ?? 0) + (n ? parseInt(n, 10) : 1));
      } else return false;
    }
    return depth === 0;
  };
  if (!body || !group(0) || counts.size === 0) return raw.toLowerCase();
  return Array.from(counts.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}${v}`)
    .join('');
}

export function formulaOf(it: ReagentItem): string {
  return it.kind === 'catalog' ? it.entry.formula : it.bottle.formula;
}

/** Name without trailing concentration / form hints, e.g. "Hydrochloric Acid 0.10 M" → "Hydrochloric Acid". */
export function displayName(it: ReagentItem): string {
  const raw = it.kind === 'catalog' ? it.entry.name : it.bottle.name;
  const cleaned = raw
    .replace(/\s*\((dropper|powder|solid|liquid)\)\s*$/i, '')
    .replace(/\s+\d[\d.]*\s*(M|%)(\s*\([^)]*\))?\s*$/i, '')
    .trim();
  return cleaned || raw;
}

export function amountMode(it: ReagentItem): AmountMode {
  if (it.kind === 'imported') {
    if (it.model?.modelable && it.model.entry) return it.model.entry.by_mass ? 'g' : 'ml';
    return importIsSolid(it.bottle) ? 'g' : 'ml';
  }
  if (it.entry.dropper) return 'drops';
  if (it.entry.by_mass) return 'g';
  return 'ml';
}

/** Short descriptor, e.g. "0.10 M solution", "powder", "liquid", "dropper bottle". */
export function strengthLabel(it: ReagentItem): string {
  if (it.kind === 'imported') {
    const m = it.model;
    if (m?.modelable && m.entry) {
      if (m.entry.by_mass) return 'imported solid · reacts';
      const c = m.entry.concentration_m;
      return c ? `imported · ${c >= 1 ? c.toFixed(1) : c.toPrecision(2)} M solution · reacts` : 'imported · reacts';
    }
    if (m) return importIsSolid(it.bottle) ? 'imported solid · visual only' : 'imported · visual only';
    return importIsSolid(it.bottle) ? 'imported solid' : 'imported';
  }
  const e = it.entry;
  const pct = e.name.match(/(\d[\d.]*\s*%)/);
  if (e.dropper) return pct ? `${pct[1]} · drops` : 'dropper';
  if (e.by_mass || e.form === 'solid') return 'solid';
  if (e.form === 'liquid') return pct ? `${pct[1]} liquid` : 'liquid';
  if (e.concentration_m !== undefined && e.concentration_m !== null) {
    const c = e.concentration_m;
    return `${c >= 1 ? c.toFixed(1) : c.toPrecision(2)} M`;
  }
  return pct ? pct[1] : 'solution';
}

const GHS_WORDS: Record<string, string> = {
  GHS01: 'Explosive',
  GHS02: 'Flammable',
  GHS03: 'Oxidiser',
  GHS04: 'Gas under pressure',
  GHS05: 'Corrosive',
  GHS06: 'Toxic',
  GHS07: 'Harmful / irritant',
  GHS08: 'Health hazard',
  GHS09: 'Environmental hazard',
};

export function hazardWords(codes: string[] | undefined): string[] {
  return (codes ?? []).map((c) => GHS_WORDS[c] ?? c);
}

export function signalWord(it: ReagentItem): 'Danger' | 'Warning' | '' {
  if (it.kind === 'catalog') return it.entry.signal_word;
  return it.bottle.ghs && it.bottle.ghs.length > 0 ? 'Warning' : '';
}

export function ghsOf(it: ReagentItem): string[] {
  return it.kind === 'catalog' ? it.entry.ghs : it.bottle.ghs;
}

/** Visual bottle tint for the list swatch (from the data's bottle_colour field). */
export function bottleTint(it: ReagentItem): 'amber' | 'clear' | 'white' | 'custom' {
  return it.kind === 'catalog' ? it.entry.bottle_colour : 'custom';
}

export function streamColour(it: ReagentItem): string {
  if (it.kind === 'imported' && /^#[0-9a-f]{6}$/i.test(it.bottle.color)) return it.bottle.color;
  return NEUTRAL_STREAM;
}
