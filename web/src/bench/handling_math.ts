// Pure maths for manual handling (carry / tilt-to-pour). No DOM, no scene state: unit-testable with node.
// Units: cm, radians, seconds. Tilt angle 0 = upright, +θ tips the pour lip (local +X) downward.
import * as THREE from 'three';

/** Largest tilt (rad, ≈115°). */
export const TILT_MAX = 2.0;
/** Pointer travel below the grab / lock point beyond which a locked container lets go of its target (px). */
export const UNLOCK_DOWN_PX = 90;

/** Flow limits. mL/s for liquids, g/s for powders, pieces/s for bare metal, drops/s for droppers. */
export const LIQUID_MIN_ML_S = 0.25;
export const LIQUID_MAX_ML_S = 30;
/** A gas from a cylinder / lecture bottle, mL/s of gas. */
export const GAS_MIN_ML_S = 2;
export const GAS_MAX_ML_S = 60;
export const POWDER_MIN_G_S = 0.01;
export const POWDER_MAX_G_S = 5;
export const METAL_MIN_PIECES_S = 0.25;
export const METAL_MAX_PIECES_S = 2.5;
export const METAL_PIECE_G = 0.1;
export const DROP_MIN_S = 0.3;
export const DROP_MAX_S = 5;
/** Excess tilt (rad) over which the flow climbs from its minimum to its maximum. */
export const FLOW_SPAN = 0.6;
/** Excess tilt over which the flow fades in from zero (avoids a step at the onset angle). */
export const FLOW_FADE = 0.025;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function smoothstep(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Intersect a ray with the horizontal plane y = planeY. Null when the ray is parallel / pointing away. */
export function rayPlaneY(origin: THREE.Vector3, dir: THREE.Vector3, planeY: number, out = new THREE.Vector3()): THREE.Vector3 | null {
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (planeY - origin.y) / dir.y;
  if (!(t > 0) || !isFinite(t)) return null;
  return out.copy(origin).addScaledVector(dir, t);
}

/**
 * Tilt at which the (horizontal) liquid surface reaches the pour lip. The container is a cylinder tilted about its
 * axis: surface height at the lip side = fill + R·tanθ, so pouring starts at θ = atan((lipY − fill) / lipX).
 * `lipX` = radial position of the lip, `lipY` = lip height above the base, `fillY` = liquid level above the base.
 */
export function onsetTilt(lipX: number, lipY: number, fillY: number, lo = 0.08, hi = 1.9): number {
  const th = Math.atan2(Math.max(0.2, lipY - fillY), Math.max(0.5, lipX));
  return clamp(th, lo, hi);
}

/** Vertical drop (cm) from the lip down to the lowest point of the body when tilted by `th` about the lip. */
export function bodyDrop(th: number, lipY: number, lipX: number, bodyR: number): number {
  return Math.max(0, lipY * Math.cos(th) + (bodyR - lipX) * Math.sin(th), lipY * Math.cos(th) - (bodyR + lipX) * Math.sin(th));
}

/** Maximum liquid flow (mL/s) through a mouth of radius `mouthR` (narrow necks limit the flow). */
export function liquidMaxRate(mouthR: number): number {
  return clamp(12 * mouthR, 5, LIQUID_MAX_ML_S);
}

/**
 * Flow vs. excess tilt: zero at/below the onset, a smooth fade-in, then an exponential climb from `rMin` (a trickle
 * for hitting a mark) to `rMax` over `span` rad of further tilt.
 */
export function flowRate(excess: number, rMin: number, rMax: number, span = FLOW_SPAN): number {
  if (!(excess > 0)) return 0;
  const x = clamp(excess / span, 0, 1);
  const fade = smoothstep(excess / FLOW_FADE);
  return fade * rMin * Math.pow(rMax / rMin, x);
}

/** Drops per second for a dropper bottle: squeeze starts at `start` rad of tilt, 0.3 → 5 drops/s over ~0.9 rad. */
export function dropRate(tilt: number, start = 0.12): number {
  const x = clamp((tilt - start) / 0.9, 0, 1);
  if (tilt <= start) return 0;
  return smoothstep((tilt - start) / 0.04) * DROP_MIN_S * Math.pow(DROP_MAX_S / DROP_MIN_S, x);
}

/** Horizontal distance (cm) from a carried lip to the target axis within which the container locks onto the target. */
export function captureRadius(rimOuter: number, srcLipX: number, srcBodyR: number): number {
  return rimOuter + srcLipX + srcBodyR * 0.35 + 3.5;
}

/** Lock with hysteresis: engage inside `r`, release only beyond `r + hyst`. */
export function captureState(dist: number, r: number, locked: boolean, hyst = 2.5): boolean {
  return locked ? dist <= r + hyst : dist <= r;
}

/** Pointer travel (px) that takes a container from upright to the pour-onset angle, and px per radian beyond it. */
export const PRE_ONSET_PX = 90;
export const FINE_PX_PER_RAD = 150;

/** Pointer scales for a lock at screen row `lockY` in a canvas of height `canvasH` (compressed if there is little room above). */
export function pointerScales(lockY: number, canvasH: number): { pre: number; fine: number } {
  const fine = clamp(0.17 * canvasH, 90, 170);
  const need = PRE_ONSET_PX + 0.8 * fine;
  const k = clamp((lockY - 10) / need, 0.4, 1);
  return { pre: PRE_ONSET_PX * k, fine: fine * k };
}

/**
 * Tilt (rad) from the pointer's vertical travel above the lock point: the first `pre` px take the container quickly to
 * its pour-onset angle, after that `fine` px per rad give precise control of the flow (a trickle for hitting a mark).
 */
export function tiltFromPointer(lockY: number, y: number, onset: number, pre: number, fine: number): number {
  const dy = Math.max(0, lockY - y);
  if (dy <= pre) return onset * (dy / Math.max(1, pre));
  return Math.min(TILT_MAX, onset + (dy - pre) / Math.max(1, fine));
}

/** Linear pointer → squeeze mapping for dropper bottles (rad). */
export function squeezeFromPointer(lockY: number, y: number, fine: number, max = 1.3): number {
  return clamp((lockY - y) / Math.max(1, fine), 0, max);
}

/** Clamp the length of the 2-D vector (x, z) into [min, max], keeping its direction (default `fallback`). */
export function clampLen2(x: number, z: number, min: number, max: number, fallback: [number, number] = [1, 0]): [number, number] {
  const len = Math.hypot(x, z);
  if (len < 1e-6) return [fallback[0] * min, fallback[1] * min];
  const k = clamp(len, min, max) / len;
  return [x * k, z * k];
}

/** Stream landing: horizontal speed grows with flow; keep the impact point inside the target opening. */
export function streamLanding(
  lipX: number,
  lipZ: number,
  towardX: number,
  towardZ: number,
  fallH: number,
  rate: number,
  targetX: number,
  targetZ: number,
  openR: number
): [number, number] {
  const fallT = Math.sqrt((2 * Math.max(0.5, fallH)) / 981);
  const D = (3 + 1.1 * rate) * fallT;
  let lx = lipX + towardX * D;
  let lz = lipZ + towardZ * D;
  const dx = lx - targetX;
  const dz = lz - targetZ;
  const len = Math.hypot(dx, dz);
  const max = Math.max(0.2, openR);
  if (len > max) {
    lx = targetX + (dx / len) * max;
    lz = targetZ + (dz / len) * max;
  }
  return [lx, lz];
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Nearest free spot for a disc of radius `r` near (x, z): spiral search; `blocked(x,z,r)` rejects candidates. */
export function nearestFreeSpot(
  x: number,
  z: number,
  r: number,
  blocked: (x: number, z: number, r: number) => boolean,
  maxRadius = 60
): [number, number] | null {
  if (!blocked(x, z, r)) return [x, z];
  for (let ring = 1.5; ring <= maxRadius; ring += 1.5) {
    const n = Math.max(8, Math.round((2 * Math.PI * ring) / 2.5));
    // try the directions nearest to the original drop point first (stable, no wandering across the bench)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const cx = x + Math.cos(a) * ring;
      const cz = z + Math.sin(a) * ring;
      if (!blocked(cx, cz, r)) return [cx, cz];
    }
  }
  return null;
}
