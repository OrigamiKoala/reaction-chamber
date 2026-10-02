// Pure maths for the titration / separatory-funnel apparatus (stopcock flow curve, drop timing, tip seating, drain
// targets, reading text). No DOM, no scene state: unit-testable with node (tests/titration.mjs). Units: cm, mL, s.

/** One drop from a burette tip (mL): the same 0.05 mL as everywhere else in the lab. */
export const STOPCOCK_DROP_ML = 0.05;
/** Lever openness (0..1) below which nothing leaves (the plug still seals). */
export const STOPCOCK_DEAD = 0.03;
/** Delivery at a fully open stopcock (mL/s): a 50 mL burette empties in ~30 s, a separatory funnel drains ~10 mL/s. */
export const BURETTE_Q_MAX = 1.8;
export const FUNNEL_Q_MAX = 10;
/** Exponent of the openness → flow curve: a wide, controllable drip range, then a quick climb to a stream. */
export const STOPCOCK_CURVE = 2.2;
/** At or above this flow (mL/s) the tip delivers a continuous stream instead of separate drops. */
export const STREAM_FROM_ML_S = 0.5;
/** Pointer travel (px) that swings the lever from closed to wide open (Shift = fine adjust). */
export const LEVER_DRAG_PX = 170;
export const LEVER_FINE = 0.25;
/** Openness a tap on the closed stopcock flicks to (one drop), and how long the flick takes (s). */
export const TAP_OPEN = 0.22;
export const TAP_S = 0.28;

export type DispenserKind = 'burette' | 'funnel';

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function qMaxFor(kind: DispenserKind): number {
  return kind === 'burette' ? BURETTE_Q_MAX : FUNNEL_Q_MAX;
}

/** Delivered flow (mL/s) at lever openness `open01`; `qMax` is the flow of a fully open stopcock. */
export function stopcockFlow(open01: number, qMax = BURETTE_Q_MAX): number {
  const o = clamp01(open01);
  if (o <= STOPCOCK_DEAD) return 0;
  const x = (o - STOPCOCK_DEAD) / (1 - STOPCOCK_DEAD);
  return qMax * Math.pow(x, STOPCOCK_CURVE);
}

/** Inverse of `stopcockFlow` (openness that delivers `q` mL/s): used by tests and by the lever hint. */
export function openForFlow(q: number, qMax = BURETTE_Q_MAX): number {
  if (!(q > 0)) return 0;
  const x = Math.pow(Math.min(1, q / qMax), 1 / STOPCOCK_CURVE);
  return STOPCOCK_DEAD + x * (1 - STOPCOCK_DEAD);
}

/** Lever openness after the pointer moved `dyPx` pixels DOWN from where the drag began (up opens, down closes). */
export function leverFromDrag(startOpen: number, dyPx: number, fine = false): number {
  const k = fine ? LEVER_FINE : 1;
  return clamp01(startOpen - (dyPx / LEVER_DRAG_PX) * k);
}

/** Human description of the delivery for the HUD ("drip", "fast drops", "stream"). */
export function flowWord(q: number): string {
  if (q <= 0) return 'closed';
  if (q < 0.12) return 'dropwise';
  if (q < STREAM_FROM_ML_S) return 'fast drops';
  return 'stream';
}

// ------------------------------------------------------------------ drops
export interface DripState {
  /** Volume (mL) hanging at the tip towards the next drop. */
  acc: number;
}

export function newDrip(): DripState {
  return { acc: 0 };
}

/** Pendant drop size (0..1 of a full drop) for the swelling bead at the tip. */
export function pendantFill(d: DripState): number {
  return clamp01(d.acc / STOPCOCK_DROP_ML);
}

/** Advance the drip by `q·dt` mL; returns how many whole drops fell (the remainder keeps swelling). */
export function stepDrip(d: DripState, q: number, dt: number): number {
  d.acc += Math.max(0, q) * Math.max(0, dt);
  const n = Math.floor(d.acc / STOPCOCK_DROP_ML + 1e-9);
  if (n > 0) d.acc -= n * STOPCOCK_DROP_ML;
  return n;
}

/** A tap on the closed lever squeezes out exactly one drop (on top of whatever is already hanging at the tip). */
export function tapDrop(d: DripState): void {
  d.acc += STOPCOCK_DROP_ML;
}

/** Visual flick of that tap: lever openness over time (s since the tap), 0 outside [0, TAP_S]. */
export function tapProfile(t: number): number {
  if (t < 0 || t > TAP_S) return 0;
  return TAP_OPEN * Math.sin((Math.PI * t) / TAP_S);
}

// ------------------------------------------------------------------ seating the tip over a vessel
/** The tip must fit through the opening with this much clearance (cm). */
export const TIP_CLEARANCE = 0.15;

export function tipFitsMouth(rimInnerR: number, tipR = 0.3): boolean {
  return rimInnerR >= tipR + TIP_CLEARANCE;
}

/** How far (cm) the tip hangs inside the opening: well inside a neck, a little inside a wide beaker. */
export function insertDepth(rimInnerR: number, vesselHeight: number): number {
  return Math.max(0.6, Math.min(2.2, vesselHeight * 0.25, 0.9 + rimInnerR * 0.7));
}

/**
 * Group-Y offset of a burette (whose tip is `tipLocalY` above its group origin) that puts the tip `depth` cm inside
 * the opening of a vessel whose rim is `rimWorldY` high.
 */
export function clampDelta(tipLocalY: number, rimWorldY: number, depth: number): number {
  return rimWorldY - depth - tipLocalY;
}

export interface UnderTarget {
  id: string;
  x: number;
  z: number;
  /** Radius of the opening and world height of the rim / of the inside bottom. */
  rimInnerR: number;
  rimTopY: number;
  bottomY: number;
}

/**
 * The vessel a drop from tip (x, y, z) lands in: its opening is beneath the tip (within `rimInnerR - 0.05` of its
 * axis) and the tip is above the inside bottom. Several candidates: the one with the highest rim wins.
 */
export function targetUnderTip(tip: { x: number; y: number; z: number }, vessels: UnderTarget[]): string | null {
  let best: UnderTarget | null = null;
  for (const v of vessels) {
    const d = Math.hypot(v.x - tip.x, v.z - tip.z);
    if (d > Math.max(0.2, v.rimInnerR - 0.05)) continue;
    if (tip.y <= v.bottomY + 0.2) continue;
    if (!best || v.rimTopY > best.rimTopY) best = v;
  }
  return best ? best.id : null;
}

/** Where a vessel released near the burette station snaps: the station spot when its centre is within `r` cm. */
export function withinSnap(x: number, z: number, cx: number, cz: number, r: number): boolean {
  return Math.hypot(x - cx, z - cz) <= r;
}

// ------------------------------------------------------------------ separatory funnel
export interface LayerLike {
  phase: string;
  volume_ml: number;
}

/**
 * The bottom layer is used up while one layer is left: the interface has reached the stopcock. The engine lists the layers
 * densest first and drains the densest first (whatever they are: water under hexane, dichloromethane under water), so the
 * caller, which knows that two layers were present when the stopcock opened, only needs to see a single layer remain.
 */
export function interfaceReached(layers: LayerLike[]): boolean {
  return layers.filter((l) => l.volume_ml > 0.05).length === 1;
}

// ------------------------------------------------------------------ readout text
/** Burette reading in mL, always two decimals ("12.35"), "-1.20" above the zero mark. */
export function formatReading(ml: number): string {
  const r = Math.round(ml * 100) / 100;
  return (Object.is(r, -0) ? 0 : r).toFixed(2);
}

export function buretteTag(readingMl: number, volumeMl: number): { main: string; sub: string } {
  if (volumeMl < 0.005) return { main: 'Burette empty', sub: '' };
  return {
    main: `Burette reads ${formatReading(readingMl)} mL`,
    sub: readingMl < -0.005 ? 'above the zero mark' : '(delivered)',
  };
}
