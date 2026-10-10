// Molecular viewer: when reactions fire (pure functions, no DOM, no three.js; tests/micro_events.mjs).
//
// The engine gives every reaction of a phase its gross forward and reverse rate (mol/s), which span many orders of magnitude;
// the box holds a few hundred molecules, so the real rates cannot be played. The visual frequency keeps the ranking and
// compresses the range: f = fMax (G / Gmax)^beta with beta chosen so that the fastest reaction fires about once per second and
// the slowest one that is shown once per 20 s (G = forward + reverse). Which way an event goes follows the share of the
// forward rate (error diffusion, so a reaction at equilibrium alternates forward and reverse, and one that is running forward
// fires forward in proportion F : R). Nothing here claims to be the real rate: the legend of the view gives the true ones.

export interface EventRow {
  id: string;
  /** Gross forward and reverse rates, mol/s of the phase. */
  forward: number;
  reverse: number;
}

export interface VisualRate {
  id: string;
  /** Events per second of display time, forward and reverse. */
  fwd: number;
  rev: number;
  /** False for a row that is below the floor, beyond the row cap, or has no rate: listed in the legend, not played. */
  shown: boolean;
}

export interface VisualRateOptions {
  /** Events per second of the fastest reaction. */
  fMax: number;
  /** Events per second of the slowest reaction that is played. */
  fMin: number;
  /** Rows whose total rate is below this fraction of the fastest are not played. */
  floorRatio: number;
  /** At most this many reactions are played (the fastest). */
  maxRows: number;
}

export const DEFAULT_VISUAL_RATES: VisualRateOptions = { fMax: 1, fMin: 1 / 20, floorRatio: 1e-15, maxRows: 12 };

/** Visual event frequencies of the rows; the ranking by total rate is kept. */
export function visualRates(rows: readonly EventRow[], opts: Partial<VisualRateOptions> = {}): VisualRate[] {
  const o = { ...DEFAULT_VISUAL_RATES, ...opts };
  const total = (r: EventRow) => (Number.isFinite(r.forward) && r.forward > 0 ? r.forward : 0) + (Number.isFinite(r.reverse) && r.reverse > 0 ? r.reverse : 0);
  const live = rows.filter((r) => total(r) > 0).sort((a, b) => total(b) - total(a) || (a.id < b.id ? -1 : 1));
  const gMax = live.length > 0 ? total(live[0]) : 0;
  const shown = live.filter((r, i) => i < o.maxRows && total(r) >= gMax * o.floorRatio);
  const gMin = shown.length > 0 ? total(shown[shown.length - 1]) : 0;
  const beta = gMax > gMin && gMin > 0 ? Math.log(o.fMax / o.fMin) / Math.log(gMax / gMin) : 0;
  const byId = new Map<string, VisualRate>();
  for (const r of shown) {
    const g = total(r);
    const f = o.fMax * Math.pow(g / gMax, beta);
    const share = Math.max(0, r.forward) / g;
    byId.set(r.id, { id: r.id, fwd: f * share, rev: f * (1 - share), shown: true });
  }
  return rows.map((r) => byId.get(r.id) ?? { id: r.id, fwd: 0, rev: 0, shown: false });
}

export interface FiredEvent {
  id: string;
  direction: 'forward' | 'reverse';
}

/** Poisson firing of the rows with a cap on how many events run at once. */
export class EventScheduler {
  private acc = new Map<string, number>();

  constructor(
    private rnd: () => number = Math.random,
    /** Events that may be in progress at the same time. */
    public readonly cap = 3,
  ) {}

  /**
   * Advances `dt` seconds of display time. `busy` events are already in progress; the result never takes the total above the
   * cap. A row fires with probability 1 - exp(-f dt) per call (keep `dt` small: below 0.25 s).
   */
  public tick(dt: number, rates: readonly VisualRate[], busy: number): FiredEvent[] {
    const fired: FiredEvent[] = [];
    if (!(dt > 0)) return fired;
    // rows are visited in a rotating random order so no row is favoured when the cap bites
    const order = rates.filter((r) => r.shown && r.fwd + r.rev > 0);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(this.rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const r of order) {
      if (busy + fired.length >= this.cap) break;
      const f = r.fwd + r.rev;
      if (this.rnd() >= 1 - Math.exp(-f * dt)) continue;
      fired.push({ id: r.id, direction: this.direction(r) });
    }
    return fired;
  }

  /** Error diffusion of the forward share: alternates at 1 : 1, 9 : 1 at 0.9. */
  private direction(r: VisualRate): 'forward' | 'reverse' {
    const share = r.fwd / (r.fwd + r.rev);
    let a = this.acc.get(r.id);
    if (a === undefined) a = this.rnd();
    a += share;
    let dir: 'forward' | 'reverse' = 'reverse';
    if (a >= 1) {
      a -= 1;
      dir = 'forward';
    }
    this.acc.set(r.id, a);
    return dir;
  }

  public reset() {
    this.acc.clear();
  }
}
