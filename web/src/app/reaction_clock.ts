// Per-vessel reaction clock. The engine ticks from the moment a vessel exists, but the *reaction timer* a student
// reads must only run once a real chemical reaction has begun (or when they start it by hand like a stopwatch).
// Everything here is pure (no DOM / Three / worker) so it can be unit-tested in node (tests/reaction_clock.mjs).
import type { VesselSnapshot, VesselEvent, VesselEventKind } from '../types/sim';

/**
 * Engine log events that mean chemistry happened. NOT included on purpose: solid_dissolved, colour_change (a coloured
 * salt dissolving turns the water blue without reacting), temperature_change (dissolution / heating), boil_over etc.
 */
const REACTION_EVENTS: ReadonlySet<VesselEventKind> = new Set<VesselEventKind>([
  'precipitate_formed',
  'gas_evolved',
  'complex_formed',
  'ignition',
]);

/** Net rate (mol/(L·s)) above which a kinetic / combustion row counts as an ongoing reaction (filters 1e-9 noise). */
export const KINETIC_RATE_MIN = 1e-7;
/**
 * Row kinds that are chemical reactions in their own right: rate-law kinetics, combustion, and the reactions the engine
 * discovers from Gibbs energies (electron transfer, thermal decomposition). Equilibrium rows are speciation (dissolving a
 * weak acid moves them too), so only the neutralisation signature below counts among them.
 */
const REACTION_ROW_KINDS: ReadonlySet<string> = new Set(['kinetic', 'combustion', 'redox', 'thermal_decomposition']);
/**
 * The solvent's autoprotolysis row (engine `role`) relaxing strongly *towards the solvent* (negative rate) means acid + base are neutralising. Self-ionisation
 * of pure water and spectator dissolution only ever show |rate| <~ 1e-4, a titration drop or more shows <= -1e-2.
 */
export const NEUTRALISATION_RATE_MAX = -2e-3;

export type ReactionTrigger = 'event' | 'kinetic' | 'neutralisation';

export interface ReactionDetection {
  /** Simulation time (engine seconds) the first reaction evidence refers to, or null if there is none. */
  startS: number | null;
  /** New event cursor: pass back into the next call. */
  cursor: number;
  trigger?: ReactionTrigger;
  /** Human text for a toast / tooltip. */
  detail?: string;
  /** True when a row-based trigger (kinetic / neutralisation flux) is currently present in the snapshot. */
  rowsActive: boolean;
}

/** Looks for row-based evidence (an ongoing reaction right now). */
function rowEvidence(snap: VesselSnapshot): { trigger: ReactionTrigger; detail: string } | null {
  for (const r of snap.reactions ?? []) {
    if (REACTION_ROW_KINDS.has(r.kind)) {
      if (r.active && Math.abs(r.rate) > KINETIC_RATE_MIN) return { trigger: 'kinetic', detail: r.equation };
    } else if (r.kind === 'equilibrium' && r.role === 'autoprotolysis' && r.rate < NEUTRALISATION_RATE_MAX) {
      return { trigger: 'neutralisation', detail: 'Acid and base neutralising' };
    }
  }
  return null;
}

/**
 * Decide whether `snap` shows the first real reaction.
 *  - Events carry the engine's own `t_sim_s`, so the start time is exact even if the snapshot arrives later.
 *  - Rows (kinetic step active, acid/base neutralising) are stamped with the snapshot time (<= one 50 ms tick late).
 * `cursor` is the highest event `seq` already examined (0 initially); `ignoreRows` suppresses row evidence (used right
 * after a manual reset while the previous reaction is still running, so the clock does not immediately restart).
 */
export function detectReactionStart(snap: VesselSnapshot, cursor: number, ignoreRows = false): ReactionDetection {
  const evs: VesselEvent[] = snap.events ?? [];
  let newCursor = cursor;
  let evHit: VesselEvent | null = null;
  for (const e of evs) {
    const seq = e.seq ?? 0;
    if (seq <= cursor) continue;
    if (seq > newCursor) newCursor = seq;
    if (REACTION_EVENTS.has(e.kind) && (!evHit || e.t_sim_s < evHit.t_sim_s)) evHit = e;
  }
  const row = rowEvidence(snap);
  const rowsActive = !!row;
  const rowHit = !ignoreRows ? row : null;

  if (evHit) {
    // An event can only be older than/equal to the snapshot time; a row hit this tick cannot be earlier than that.
    return { startS: evHit.t_sim_s, cursor: newCursor, trigger: 'event', detail: evHit.detail ?? evHit.kind, rowsActive };
  }
  if (rowHit) return { startS: snap.t_sim_s, cursor: newCursor, trigger: rowHit.trigger, detail: rowHit.detail, rowsActive };
  return { startS: null, cursor: newCursor, rowsActive };
}

// ------------------------------------------------------------------------------------------ the clock itself
export type ClockPhase = 'waiting' | 'running' | 'stopped';

export interface ClockInfo {
  phase: ClockPhase;
  /** Elapsed reaction time, s (0 while waiting). */
  elapsedS: number;
  /** True when the clock was started by a detected reaction (false = by hand). */
  auto: boolean;
  /** What started it, e.g. "White precipitate formed: AgCl". */
  reason?: string;
}

/**
 * Stopwatch whose Start can come from `detectReactionStart` or from the user. Time is *engine* time (t_sim_s), so
 * pause, 5x and 20x speed all behave and nothing needs a wall clock.
 */
export class ReactionClock {
  private phase: ClockPhase = 'waiting';
  private accumS = 0;
  private segStartS = 0;
  private auto = false;
  private reason: string | undefined;
  /** Highest engine event seq examined for reaction evidence. */
  private cursor = 0;
  /** After a reset, ignore row evidence until a snapshot without any has been seen. */
  private rowsBlocked = false;

  /** Feed every engine snapshot. Returns true exactly when this call auto-started the clock. */
  public observe(snap: VesselSnapshot): boolean {
    const wasWaiting = this.phase === 'waiting';
    const d = detectReactionStart(snap, this.cursor, this.rowsBlocked);
    this.cursor = d.cursor;
    if (this.rowsBlocked && !d.rowsActive) this.rowsBlocked = false;
    if (wasWaiting && d.startS !== null) {
      this.phase = 'running';
      this.accumS = 0;
      this.segStartS = Math.min(d.startS, snap.t_sim_s);
      this.auto = true;
      this.reason = d.detail;
      return true;
    }
    return false;
  }

  /** Manual Start (or resume after Stop). `nowS` = engine time of the latest snapshot. */
  public start(nowS: number) {
    if (this.phase === 'running') return;
    this.segStartS = nowS;
    if (this.phase === 'waiting') {
      this.accumS = 0;
      this.auto = false;
      this.reason = undefined;
    }
    this.phase = 'running';
  }

  public stop(nowS: number) {
    if (this.phase !== 'running') return;
    this.accumS += Math.max(0, nowS - this.segStartS);
    this.phase = 'stopped';
  }

  /** Back to "waiting for reaction". Row evidence is ignored until the current reaction (if any) has gone quiet. */
  public reset() {
    this.phase = 'waiting';
    this.accumS = 0;
    this.auto = false;
    this.reason = undefined;
    this.rowsBlocked = true;
  }

  public info(nowS: number): ClockInfo {
    const elapsed = this.phase === 'running' ? this.accumS + Math.max(0, nowS - this.segStartS) : this.accumS;
    return { phase: this.phase, elapsedS: elapsed, auto: this.auto, reason: this.reason };
  }
}
