// Instrument history: a capped, decimated time series per reading, driven by simulation time (so pause / 1x / 5x / 20x
// behave correctly: no sim time, no samples) plus a short list of notable events per instrument ('250 W', 'tared').
// Pure data module (no DOM / three.js) so it can be tested under node: tests/instrument_log.mjs.

export type InstrumentKey = 'hotplate' | 'balance' | 'phmeter' | 'thermometer' | 'gauge' | 'burner';

export type ChannelId = 'thermometer' | 'ph' | 'balance' | 'pressure' | 'plate_w' | 'plate_temp' | 'flame';

/** Which instrument panel a channel belongs to. */
export const CHANNEL_INSTRUMENT: Record<ChannelId, InstrumentKey> = {
  thermometer: 'thermometer',
  ph: 'phmeter',
  balance: 'balance',
  pressure: 'gauge',
  plate_w: 'hotplate',
  plate_temp: 'hotplate',
  flame: 'burner',
};

export const LOG_WINDOW_S = 600; // 10 simulated minutes
export const LOG_MIN_DT_S = 0.25; // decimate to <= 4 Hz of simulated time
const MAX_EVENTS = 40;

export interface LogEvent {
  /** Simulation time, s. */
  t: number;
  text: string;
}

/** Capped ring buffer of (t, value, source) samples. NaN value = "no reading" (a gap in the line). */
export class Series {
  readonly windowS: number;
  readonly minDt: number;
  private cap: number;
  private ts: Float64Array;
  private vs: Float64Array;
  private srcs: Array<string | null>;
  private head = 0; // index of the oldest sample
  private n = 0;
  private lastT = -Infinity;

  constructor(windowS: number = LOG_WINDOW_S, minDt: number = LOG_MIN_DT_S) {
    this.windowS = windowS;
    this.minDt = minDt;
    this.cap = Math.ceil(windowS / minDt) + 8;
    this.ts = new Float64Array(this.cap);
    this.vs = new Float64Array(this.cap);
    this.srcs = new Array(this.cap).fill(null);
  }

  get length(): number {
    return this.n;
  }

  clear() {
    this.head = 0;
    this.n = 0;
    this.lastT = -Infinity;
  }

  private at(i: number): number {
    return (this.head + i) % this.cap;
  }

  /** Adds a sample when at least `minDt` of sim time passed since the last one. Returns true when stored. */
  push(t: number, v: number | null, src: string | null): boolean {
    if (t < this.lastT) this.clear(); // time went backwards: restart
    if (this.n > 0 && t - this.lastT < this.minDt - 1e-9) return false;
    const val = v === null || !isFinite(v) ? NaN : v;
    // one gap marker is enough: don't fill the buffer with "no reading" samples
    if (Number.isNaN(val) && this.n > 0 && Number.isNaN(this.vs[this.at(this.n - 1)])) {
      this.lastT = t;
      return false;
    }
    if (this.n === this.cap) {
      this.head = (this.head + 1) % this.cap;
      this.n--;
    }
    const i = this.at(this.n);
    this.ts[i] = t;
    this.vs[i] = val;
    this.srcs[i] = src;
    this.n++;
    this.lastT = t;
    // drop what fell out of the window
    while (this.n > 1 && t - this.ts[this.head] > this.windowS) {
      this.head = (this.head + 1) % this.cap;
      this.n--;
    }
    return true;
  }

  forEach(cb: (t: number, v: number, src: string | null) => void) {
    for (let k = 0; k < this.n; k++) {
      const i = this.at(k);
      cb(this.ts[i], this.vs[i], this.srcs[i]);
    }
  }

  /** Min / max / latest of the finite samples in the window (null when there are none). */
  stats(): { min: number; max: number; last: number } | null {
    let min = Infinity;
    let max = -Infinity;
    let last = NaN;
    this.forEach((_t, v) => {
      if (Number.isNaN(v)) return;
      if (v < min) min = v;
      if (v > max) max = v;
      last = v;
    });
    return min <= max ? { min, max, last } : null;
  }

  /** Time span covered by the stored samples, s. */
  span(): number {
    return this.n > 1 ? this.ts[this.at(this.n - 1)] - this.ts[this.head] : 0;
  }

  /** Removes every sample that was read from vessel `id` (the vessel left the bench). */
  forgetSource(id: string) {
    const keep: Array<[number, number, string | null]> = [];
    this.forEach((t, v, s) => {
      if (s !== id) keep.push([t, v, s]);
    });
    if (keep.length === this.n) return;
    const lastT = this.lastT;
    this.clear();
    keep.forEach(([t, v, s], k) => {
      const i = k;
      this.ts[i] = t;
      this.vs[i] = v;
      this.srcs[i] = s;
    });
    this.n = keep.length;
    this.lastT = lastT;
  }
}

export interface ChannelReading {
  /** Quantised value as the instrument shows it; null = no reading (dry probe, nothing attached). */
  v: number | null;
  /** Vessel the instrument reads right now (id), and its display name. */
  src?: string | null;
  srcLabel?: string | null;
}

export class InstrumentLog {
  private series = new Map<ChannelId, Series>();
  private events = new Map<InstrumentKey, LogEvent[]>();
  private lastSrc = new Map<ChannelId, string | null>();
  private watched = new Map<string, string | number | boolean | null>();

  private windowS: number;
  private minDt: number;

  constructor(windowS: number = LOG_WINDOW_S, minDt: number = LOG_MIN_DT_S) {
    this.windowS = windowS;
    this.minDt = minDt;
  }

  channel(ch: ChannelId): Series {
    let s = this.series.get(ch);
    if (!s) {
      s = new Series(this.windowS, this.minDt);
      this.series.set(ch, s);
    }
    return s;
  }

  eventsOf(inst: InstrumentKey): LogEvent[] {
    return this.events.get(inst) ?? [];
  }

  /** Appends one sim-time sample per channel (decimated per channel). A change of source vessel is logged as an event. */
  record(t: number, readings: Partial<Record<ChannelId, ChannelReading>>) {
    for (const ch of Object.keys(readings) as ChannelId[]) {
      const r = readings[ch]!;
      const src = r.src ?? null;
      const s = this.channel(ch);
      if (this.lastSrc.has(ch) && this.lastSrc.get(ch) !== src && (ch === 'thermometer' || ch === 'ph' || ch === 'pressure')) {
        this.note(CHANNEL_INSTRUMENT[ch], t, src ? `reading ${r.srcLabel ?? src}` : 'no vessel');
      }
      this.lastSrc.set(ch, src);
      s.push(t, r.v, src);
    }
  }

  /** Adds an event line for an instrument. */
  note(inst: InstrumentKey, t: number, text: string) {
    let list = this.events.get(inst);
    if (!list) this.events.set(inst, (list = []));
    list.push({ t, text });
    if (list.length > MAX_EVENTS) list.shift();
  }

  /** Logs `text(value)` whenever `value` differs from the last one seen under `key` (the first sighting is silent). */
  watch<T extends string | number | boolean | null>(inst: InstrumentKey, key: string, value: T, t: number, text: (v: T) => string | null) {
    const k = `${inst}:${key}`;
    if (this.watched.has(k) && this.watched.get(k) !== value) {
      const msg = text(value);
      if (msg) this.note(inst, t, msg);
    }
    this.watched.set(k, value);
  }

  /** A vessel left the bench: forget what instruments read from it. */
  forgetSource(id: string) {
    for (const s of this.series.values()) s.forgetSource(id);
    for (const ch of this.lastSrc.keys()) if (this.lastSrc.get(ch) === id) this.lastSrc.set(ch, null);
  }

  clear() {
    this.series.clear();
    this.events.clear();
    this.lastSrc.clear();
    this.watched.clear();
  }
}
