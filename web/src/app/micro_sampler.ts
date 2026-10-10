// Molecular viewer: who is in the box (pure functions, no DOM, no three.js; tests/micro_sampler.mjs).
//
// The box holds a few hundred molecules, the vessel 1e22. Counts are therefore not proportional to the concentrations: they
// follow x_i^alpha (alpha ~ 0.3 compresses 1 : 1e6 into about 1 : 16), every species present gets at least one molecule, and
// the legend states the true concentrations. `reconcileStep` moves the box toward the targets a few molecules at a time
// instead of popping them in and out.

export interface SampleSpecies {
  id: string;
  /** Relative abundance in the phase (molar concentration or mole fraction; only ratios matter). */
  weight: number;
  /** Moles in the vessel; species at or below the floor are not drawn. */
  mol: number;
  /** Takes part in an active reaction: never dropped by the species cap. */
  forced?: boolean;
}

export interface AllocateOptions {
  /** Solute molecules in the box. */
  budget: number;
  /** Compression exponent of the abundance (1 = proportional, 0 = one of each). */
  alpha: number;
  /** Most species drawn; forced ones first, then the most abundant. */
  maxSpecies: number;
  /** Smallest amount (mol) that is drawn. */
  floorMol: number;
  /** Counts of the last allocation: a species whose new count is within one of its old one keeps the old count. */
  previous?: ReadonlyMap<string, number>;
}

export const DEFAULT_ALLOCATE: AllocateOptions = { budget: 150, alpha: 0.3, maxSpecies: 30, floorMol: 1e-12 };

export interface Allocation {
  counts: Map<string, number>;
  /** Species left out (below the floor or beyond the cap), by id. */
  dropped: string[];
}

/**
 * Number of molecules of each species. Every drawn species has at least one; the total is `budget`, or the number of drawn
 * species when that is larger.
 */
export function allocate(species: readonly SampleSpecies[], opts: Partial<AllocateOptions> = {}): Allocation {
  const o = { ...DEFAULT_ALLOCATE, ...opts };
  const dropped: string[] = [];
  let live = species.filter((s) => {
    const ok = s.mol > o.floorMol && s.weight > 0 && Number.isFinite(s.weight);
    if (!ok) dropped.push(s.id);
    return ok;
  });
  if (live.length > o.maxSpecies) {
    // forced species first (ranked among themselves by abundance), then the rest by abundance
    live = live.slice().sort((a, b) => Number(!!b.forced) - Number(!!a.forced) || b.weight - a.weight || (a.id < b.id ? -1 : 1));
    for (const s of live.slice(o.maxSpecies)) dropped.push(s.id);
    live = live.slice(0, o.maxSpecies);
  }
  const counts = new Map<string, number>();
  if (live.length === 0) return { counts, dropped };

  const total = live.reduce((q, s) => q + s.weight, 0);
  const w = live.map((s) => Math.pow(s.weight / total, o.alpha));
  const wsum = w.reduce((q, x) => q + x, 0);
  const raw = w.map((x) => Math.max(1, Math.round((o.budget * x) / wsum)));

  // hysteresis against the previous allocation, so a tiny composition change does not renumber the box
  if (o.previous) {
    live.forEach((s, i) => {
      const p = o.previous!.get(s.id);
      if (p !== undefined && p >= 1 && Math.abs(raw[i] - p) <= 1) raw[i] = p;
    });
  }

  // trim the largest counts until the total fits the budget (never below one)
  let sum = raw.reduce((q, x) => q + x, 0);
  while (sum > Math.max(o.budget, live.length)) {
    let k = -1;
    for (let i = 0; i < raw.length; i++) if (raw[i] > 1 && (k < 0 || raw[i] > raw[k])) k = i;
    if (k < 0) break;
    raw[k]--;
    sum--;
  }
  live.forEach((s, i) => counts.set(s.id, raw[i]));
  return { counts, dropped };
}

export interface ReconcileOps {
  /** Species ids of molecules to bring in (one entry per molecule). */
  add: string[];
  /** Species ids of molecules to send out of the box (one entry per molecule). */
  remove: string[];
}

/**
 * At most `maxOps` changes that move `current` toward `target`. Species missing from the box come first (so the legend never
 * shows a species with nothing to look at), then the largest relative surplus / deficit.
 */
export function reconcileStep(current: ReadonlyMap<string, number>, target: ReadonlyMap<string, number>, maxOps: number): ReconcileOps {
  const ops: ReconcileOps = { add: [], remove: [] };
  if (maxOps <= 0) return ops;
  const cur = new Map(current);
  type Item = { id: string; diff: number; rel: number; missing: boolean };
  const ids = new Set<string>([...cur.keys(), ...target.keys()]);
  const items: Item[] = [];
  for (const id of ids) {
    const c = cur.get(id) ?? 0;
    const t = target.get(id) ?? 0;
    if (c !== t) items.push({ id, diff: t - c, rel: Math.abs(t - c) / Math.max(1, t, c), missing: c === 0 && t > 0 });
  }
  // missing species first, then by relative gap, then by id for determinism
  items.sort((a, b) => Number(b.missing) - Number(a.missing) || b.rel - a.rel || (a.id < b.id ? -1 : 1));
  let left = maxOps;
  // one molecule per species per round, so a big gap of one species does not starve the others
  while (left > 0 && items.some((it) => it.diff !== 0)) {
    for (const it of items) {
      if (left <= 0) break;
      if (it.diff > 0) {
        ops.add.push(it.id);
        it.diff--;
        left--;
      } else if (it.diff < 0) {
        ops.remove.push(it.id);
        it.diff++;
        left--;
      }
    }
  }
  return ops;
}

/** Number of waters drawn as scenery around the solutes of an aqueous phase (not the true ratio; the legend says so). */
export const SCENERY_WATERS = 40;
