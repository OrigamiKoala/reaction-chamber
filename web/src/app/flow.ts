// Chemistry side of manual pouring: sinks that accept continuous amounts from the bench and flush them to the engine
// in small batches (<= ~10 Hz, one request in flight). Amounts are accumulated, so 200 x 0.5 mL ends up chemically
// the same as one 100 mL dose.
import type { FlowForm, FlowSink } from '../bench/handling';
import type { Lab } from './lab';
import { ReagentItem, amountMode } from './reagent_library';

export const DROP_ML = 0.05;
/** Minimum time between engine requests of one flow (ms). */
export const FLUSH_MS = 100;

export type LabFlowSource = { item: ReagentItem } | { vesselId: string };

export interface LabFlowSink extends FlowSink {
  /** Resolves once everything pushed so far has reached the engine (after `end()`). */
  readonly finished: Promise<void>;
  /** The reagent has no reaction model (visual-only import). */
  readonly visualOnly: boolean;
  /** Item being poured (reagent flows only). */
  readonly item?: ReagentItem;
}

/** Units of `to` per unit of `from` for a reagent with density `rho` (g/mL). */
export function unitFactor(from: FlowForm, to: FlowForm, rho: number): number {
  if (from === to) return 1;
  const ml = from === 'ml' ? 1 : from === 'drops' ? DROP_ML : 1 / Math.max(0.05, rho);
  return to === 'ml' ? ml : to === 'drops' ? ml / DROP_ML : ml * Math.max(0.05, rho);
}

abstract class BatchedSink {
  public total = 0;
  public readonly finished: Promise<void>;
  protected pending = 0;
  protected inflight = 0;
  private busy = false;
  private ended = false;
  private lastFlush = -1e9;
  private timer: number | null = null;
  private why: 'full' | 'empty' | null = null;
  private resolveDone!: () => void;
  public errors = 0;

  constructor(public readonly unit: FlowForm) {
    this.finished = new Promise<void>((r) => (this.resolveDone = r));
  }

  /** How much more (in `unit`) can be accepted right now. */
  protected abstract room(): number;
  protected abstract limitReason(): 'full' | 'empty';
  /** Send `amount` (in `unit`) to the engine. */
  protected abstract flushChunk(amount: number): Promise<void>;

  public limit(): 'full' | 'empty' | null {
    return this.why;
  }

  public push(amount: number): number {
    if (this.ended || !(amount > 0)) return 0;
    const room = this.room();
    const got = Math.max(0, Math.min(amount, room));
    this.why = got < amount - 1e-9 ? this.limitReason() : null;
    if (got > 0) {
      this.pending += got;
      this.total += got;
      this.pump();
    }
    return got;
  }

  public end(): void {
    if (this.ended) return;
    this.ended = true;
    this.pump();
    this.checkDone();
  }

  private pump() {
    if (this.busy || this.pending <= 1e-9) return;
    const now = performance.now();
    const wait = FLUSH_MS - (now - this.lastFlush);
    if (wait > 0 && !this.ended) {
      // keep a partial batch moving even if the user stops tilting
      if (this.timer === null) {
        this.timer = window.setTimeout(() => {
          this.timer = null;
          this.pump();
        }, wait + 1);
      }
      return;
    }
    const amount = this.pending;
    this.pending = 0;
    this.inflight = amount;
    this.busy = true;
    this.lastFlush = now;
    this.flushChunk(amount)
      .catch((err) => {
        this.errors++;
        console.warn('[flow] flush failed', err);
      })
      .finally(() => {
        this.busy = false;
        this.inflight = 0;
        this.pump();
        this.checkDone();
      });
  }

  private checkDone() {
    if (this.ended && !this.busy && this.pending <= 1e-9) this.resolveDone();
  }
}

/** Pours a shelf reagent (unlimited reservoir) into a vessel. */
export class ReagentFlowSink extends BatchedSink implements LabFlowSink {
  public readonly visualOnly: boolean;
  private k: number;
  private mode: FlowForm;

  constructor(private lab: Lab, public readonly item: ReagentItem, private target: string, form: FlowForm, rho: number) {
    super(form);
    this.mode = amountMode(item);
    this.k = unitFactor(form, this.mode, rho);
    this.visualOnly = item.kind === 'imported' && !(item.model?.modelable && item.model.entry);
  }

  /** Volume (mL) that `amount` of this flow's unit displaces. */
  private mlOf(amount: number): number {
    const own = amount * this.k;
    return this.mode === 'drops' ? own * DROP_ML : this.mode === 'g' ? 0 : own;
  }

  protected room(): number {
    if (this.mode === 'g') return Infinity; // solids are treated as negligible volume
    const free = this.lab.freeCapacityMl(this.target) - this.mlOf(this.pending + this.inflight);
    const perUnit = this.mlOf(1);
    return perUnit > 0 ? Math.max(0, free / perUnit) : Infinity;
  }

  protected limitReason(): 'full' | 'empty' {
    return 'full';
  }

  protected async flushChunk(amount: number): Promise<void> {
    let own = amount * this.k;
    if (this.mode === 'drops') own = Math.round(own);
    if (!(own > 0)) return;
    await this.lab.commitAddition(this.item, this.target, own);
  }
}

/** Pours the contents of one vessel into another, moving real portions (species conserved). */
export class VesselFlowSink extends BatchedSink implements LabFlowSink {
  public readonly visualOnly = false;
  private reason: 'full' | 'empty' = 'full';

  constructor(private lab: Lab, private src: string, private tgt: string) {
    super('ml');
  }

  protected room(): number {
    const out = this.pending + this.inflight;
    const have = this.lab.volumeMl(this.src) - out;
    const free = this.lab.freeCapacityMl(this.tgt) - out;
    this.reason = have <= free ? 'empty' : 'full';
    return Math.max(0, Math.min(have, free));
  }

  protected limitReason(): 'full' | 'empty' {
    return this.reason;
  }

  protected async flushChunk(amount: number): Promise<void> {
    await this.lab.transferChunk(this.src, this.tgt, amount);
  }
}

/** Drains a burette / separatory funnel through its stopcock into a vessel (`tgt` null: onto the bench, discarded). */
export class DrainSink extends BatchedSink implements LabFlowSink {
  public readonly visualOnly = false;
  private reason: 'full' | 'empty' = 'empty';

  constructor(private lab: Lab, private src: string, private tgt: string | null, private bottom: boolean) {
    super('ml');
  }

  protected room(): number {
    const out = this.pending + this.inflight;
    const have = this.lab.volumeMl(this.src) - out;
    const free = this.tgt === null ? Infinity : this.lab.freeCapacityMl(this.tgt) - out;
    this.reason = have <= free ? 'empty' : 'full';
    return Math.max(0, Math.min(have, free));
  }

  protected limitReason(): 'full' | 'empty' {
    return this.reason;
  }

  protected async flushChunk(amount: number): Promise<void> {
    await this.lab.drainChunk(this.src, this.tgt, amount, this.bottom);
  }
}
