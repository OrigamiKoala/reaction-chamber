// Pure maths for manual pipetting (draw / dispense / meniscus on the mark). No DOM, no scene: unit-testable with node.
// Units: mL, cm, seconds, px. Run the checks with: node tests/pipetting_math.mjs
//
// Control scheme (the mouse button stays down: you are holding the pipette):
//   drag UP   = suction (draw liquid in)        drag DOWN = release (dispense)
//   Shift     = fine control ("bleed", thumb on top): ~10x slower, to set the meniscus exactly on the mark
// The farther the pointer travels from where the tip went in, the faster the flow (exponential, like a tilt).

export type PipetteKind = 'volumetric' | 'graduated' | 'pasteur';

export interface PipetteSpec {
  kind: PipetteKind;
  /** Nominal (printed) volume, mL: the ring (volumetric) or the 0 mark (graduated); capacity for a Pasteur pipette. */
  nominalMl: number;
  /** Inner bore radius (cm). */
  boreR: number;
  /** Most the pipette will hold: draw stops here (a little above the ring / 0 mark; a Pasteur pipette's capacity). */
  fillLimitMl: number;
  /** Volume that stays behind in the tip (a drop; "TD" = to deliver, calibrated with it left in). */
  residualMl: number;
  /** Meniscus-reading tolerance: the level counts as "on the mark" within this volume. */
  markTolMl: number;
  /** Fastest / slowest controlled flow (mL/s). */
  maxRateMlS: number;
  minRateMlS: number;
  /** Volume of one drop of a Pasteur pipette (mL). */
  dropMl: number;
}

export const DROP_ML_PASTEUR = 0.04;
/** Height above the mark (cm) up to which a pipette may be over-filled before the suction stops by itself. */
export const OVERFILL_CM = 0.8;
/** Reading uncertainty of a meniscus on a ring / zero mark (cm): half a millimetre. */
export const MARK_TOL_CM = 0.05;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Pipette behaviour from its glass: `nominalMl` and the inner bore radius in cm. */
export function makePipetteSpec(kind: PipetteKind, nominalMl: number, boreR: number): PipetteSpec {
  const area = Math.PI * boreR * boreR;
  if (kind === 'pasteur') {
    return {
      kind,
      nominalMl,
      boreR,
      fillLimitMl: nominalMl,
      residualMl: 0,
      markTolMl: 0,
      maxRateMlS: 0.7,
      minRateMlS: 0.03,
      dropMl: DROP_ML_PASTEUR,
    };
  }
  return {
    kind,
    nominalMl,
    boreR,
    fillLimitMl: nominalMl + area * OVERFILL_CM,
    // Class A volumetric pipettes are calibrated to deliver with the last drop left in the tip (TD)
    residualMl: kind === 'volumetric' ? 0.001 * nominalMl : 0,
    markTolMl: area * MARK_TOL_CM,
    maxRateMlS: clamp(nominalMl * 0.5, 2, 8),
    minRateMlS: 0.01,
    dropMl: DROP_ML_PASTEUR,
  };
}

/** Pointer travel (px) before anything happens, and the travel that gives the full flow. */
export const DEAD_PX = 10;
export const SPAN_PX = 130;

/**
 * Signed control signal in [-1, 1] from the pointer's vertical travel (px, positive = the pointer is ABOVE the point
 * where the tip went in): + = draw, - = dispense, 0 inside the dead zone.
 */
export function pipetteSignal(dyPx: number, deadPx = DEAD_PX, spanPx = SPAN_PX): number {
  const a = Math.abs(dyPx);
  if (a <= deadPx) return 0;
  const s = smoothstep((a - deadPx) / Math.max(1, spanPx));
  return dyPx > 0 ? s : -s;
}

/** Flow (mL/s) for a signal magnitude in (0, 1]: exponential from `min` to `max` (a trickle up to full speed). */
export function flowFromSignal(mag: number, minRate: number, maxRate: number): number {
  const m = clamp(mag, 0, 1);
  if (m <= 0) return 0;
  const fade = smoothstep(m / 0.06);
  return fade * minRate * Math.pow(maxRate / minRate, m);
}

/** Fine mode (Shift held, thumb on top of the pipette): flows are this much slower. */
export const FINE_FACTOR = 0.1;

/**
 * Slows the flow as the meniscus approaches the mark so it can be caught: 1 beyond ~12 tolerances, falling to 0.25
 * on the mark. `devMl` = content - nominal.
 */
export function detentScale(devMl: number, tolMl: number): number {
  if (!(tolMl > 0)) return 1;
  const k = Math.abs(devMl) / (12 * tolMl);
  if (k >= 1) return 1;
  return 0.25 + 0.75 * k * k;
}

/** Deviation of the level from the mark (mL, + above): meaningful for volumetric (ring) and graduated (0 mark) pipettes. */
export function markDeviationMl(spec: PipetteSpec, contentMl: number): number {
  return spec.kind === 'pasteur' ? 0 : contentMl - spec.nominalMl;
}

/** The meniscus sits on the mark (within the reading tolerance). */
export function onMark(spec: PipetteSpec, contentMl: number): boolean {
  return spec.kind !== 'pasteur' && Math.abs(markDeviationMl(spec, contentMl)) <= spec.markTolMl;
}

/**
 * Volume a volumetric pipette delivers when it was filled to `filledMl` and emptied to the tip (the residual drop
 * stays in): nominal ± the user's meniscus error.
 */
export function volumetricDelivered(spec: PipetteSpec, filledMl: number): number {
  return Math.max(0, filledMl - spec.residualMl);
}

/** What stops the flow (null = flowing / idle). */
export type PipetteBlock = 'air' | 'source-empty' | 'full' | 'empty' | 'target-full' | null;

export interface PipetteStepIn {
  spec: PipetteSpec;
  /** Liquid in the pipette right now (mL, including amounts still queued for the engine). */
  contentMl: number;
  /** -1..1 from `pipetteSignal` (+ draw / - dispense). */
  signal: number;
  fine: boolean;
  dt: number;
  /** Tip is below the liquid surface of the vessel under it. */
  dipped: boolean;
  /** Liquid available to draw from the vessel under the tip (mL). */
  sourceMl: number;
  /** Room left in the vessel under the tip (mL). */
  roomMl: number;
  /** Whole drops already accumulated for a Pasteur pipette (carry the returned `dropAcc` into the next call). */
  dropAcc?: number;
}

export interface PipetteStepOut {
  /** Liquid moved from the vessel into the pipette this step (mL). */
  drawMl: number;
  /** Liquid moved from the pipette into the vessel this step (mL). */
  dispenseMl: number;
  /** Whole Pasteur drops released this step (their volume is part of `dispenseMl`). */
  drops: number;
  dropAcc: number;
  blocked: PipetteBlock;
  /** Flow in mL/s that was asked for (before limits), for the readout. */
  rate: number;
}

/** One step of the manual pipette: how much goes in / out in `dt` seconds, and why it may be blocked. */
export function pipetteStep(i: PipetteStepIn): PipetteStepOut {
  const { spec, contentMl, signal, fine, dt } = i;
  const out: PipetteStepOut = { drawMl: 0, dispenseMl: 0, drops: 0, dropAcc: i.dropAcc ?? 0, blocked: null, rate: 0 };
  if (!(dt > 0) || signal === 0) return out;
  const mag = Math.abs(signal);
  const fineK = fine ? FINE_FACTOR : 1;
  const dev = markDeviationMl(spec, contentMl);
  const detent = detentScale(dev, spec.markTolMl);

  if (signal > 0) {
    // ---- suction
    let rate = flowFromSignal(mag, spec.minRateMlS, spec.kind === 'pasteur' ? spec.maxRateMlS * 0.6 : spec.maxRateMlS) * fineK;
    if (contentMl >= spec.nominalMl - 1e-9) rate *= detent; // near / above the mark: ease off
    out.rate = rate;
    if (!i.dipped) {
      out.blocked = 'air'; // the tip is out of the liquid: a pipette only sucks air
      return out;
    }
    if (i.sourceMl <= 1e-4) {
      out.blocked = 'source-empty';
      return out;
    }
    const want = rate * dt;
    const room = spec.fillLimitMl - contentMl;
    if (room <= 1e-9) {
      out.blocked = 'full';
      return out;
    }
    const got = Math.min(want, room, i.sourceMl);
    out.drawMl = Math.max(0, got);
    if (got < want - 1e-12) out.blocked = room <= i.sourceMl ? 'full' : 'source-empty';
    return out;
  }

  // ---- release
  const avail = Math.max(0, contentMl - spec.residualMl);
  if (spec.kind === 'pasteur') {
    // drop-wise: 0.6 -> 6 drops/s over the signal range
    const dps = (0.6 + 5.4 * mag) * fineK * (fine ? 3 : 1);
    out.rate = dps * spec.dropMl;
    let acc = out.dropAcc + dps * dt;
    let drops = 0;
    let left = avail;
    let roomLeft = i.roomMl;
    while (acc >= 1 && left > 1e-9) {
      const v = Math.min(spec.dropMl, left);
      if (v > roomLeft + 1e-9) {
        out.blocked = 'target-full';
        acc = 0;
        break;
      }
      acc -= 1;
      drops += 1;
      left -= v;
      roomLeft -= v;
      out.dispenseMl += v;
    }
    out.drops = drops;
    out.dropAcc = acc;
    if (avail <= 1e-9) out.blocked = 'empty';
    return out;
  }
  let rate = flowFromSignal(mag, spec.minRateMlS, spec.maxRateMlS) * fineK;
  if (contentMl <= spec.nominalMl + spec.markTolMl * 12 && contentMl >= spec.nominalMl - spec.markTolMl * 12) rate *= detent;
  out.rate = rate;
  if (avail <= 1e-9) {
    out.blocked = 'empty';
    return out;
  }
  const want = rate * dt;
  const got = Math.min(want, avail, Math.max(0, i.roomMl));
  out.dispenseMl = Math.max(0, got);
  if (got < want - 1e-12) out.blocked = i.roomMl <= avail ? 'target-full' : 'empty';
  return out;
}

/** Interaction mode of a held vessel, from its glass kind. */
export type InteractionMode = 'pour' | 'pipette' | 'syringe';

export function interactionMode(kind: string): InteractionMode {
  if (kind === 'pipette-volumetric' || kind === 'pipette-graduated' || kind === 'pipette-pasteur') return 'pipette';
  if (kind === 'gas-syringe') return 'syringe';
  return 'pour';
}

export function pipetteKindOf(profileKind: string): PipetteKind | null {
  if (profileKind === 'pipette-volumetric') return 'volumetric';
  if (profileKind === 'pipette-graduated') return 'graduated';
  if (profileKind === 'pipette-pasteur') return 'pasteur';
  return null;
}

/** A vessel that a pipette can be dipped into / dispense into (open top, wide enough for the stem). */
export function acceptsPipette(profileKind: string, rimInnerRadius: number, stemOuterR: number): boolean {
  if (interactionMode(profileKind) !== 'pour') return false; // pipettes / syringes are not receivers
  if (profileKind === 'gas-jar' || profileKind === 'gas-tube') return false; // gas holders
  return rimInnerRadius >= stemOuterR + 0.08;
}

/** Tip height (cm above the glass bottom) while drawing: a bit below the surface, never on the bottom. */
export function drawTipHeight(surfaceY: number, bottomY: number): number {
  const depth = surfaceY - bottomY;
  if (depth <= 0.3) return bottomY + 0.12;
  return Math.max(bottomY + 0.2, Math.min(surfaceY - 0.5, bottomY + depth * 0.85));
}

/** Tip height while dispensing: just above the surface (a drip / thin stream), or hanging low in an empty vessel. */
export function dispenseTipHeight(surfaceY: number, bottomY: number, rimY: number): number {
  const base = surfaceY > bottomY + 0.3 ? surfaceY + 0.7 : bottomY + 2.2;
  return Math.min(base, rimY - 0.4);
}
