/**
 * Pure maths of the dipped probes (no THREE, no DOM; tested by tests/probe_math.mjs).
 *
 *  - `layerIndexAtHeight` (I1): which liquid layer the tip of a probe sits in, from the layer volumes (densest first, the
 *    order of the snapshot) and the glass profile's volume -> level function.
 *  - Thermometer bulb (I3): a two-node model of the glass wall and the spirit inside it. The film coefficient from the
 *    liquid to the wall is a correlation, not a constant: Churchill-Chu natural convection around a horizontal cylinder and
 *    Churchill-Bernstein forced convection from the stirrer, combined as (h_n^3 + h_f^3)^(1/3). A stirred bulb answers in
 *    a few seconds, an unstirred one takes several times longer.
 */

/** Index of the layer containing height `tipY` (group-local), -1 above the surface. `volumesMl` is bottom first. */
export function layerIndexAtHeight(volumesMl: number[], tipY: number, levelYForVolume: (ml: number) => number): number {
  let cum = 0;
  for (let i = 0; i < volumesMl.length; i++) {
    cum += Math.max(0, volumesMl[i]);
    if (tipY <= levelYForVolume(cum) + 1e-9) return i;
  }
  return -1;
}

// ------------------------------------------------------------------------------------------------ bulb physics (SI)

/**
 * Spirit-in-glass thermometer bulb, as drawn: a capsule 4.8 mm across and 16 mm long with a 0.4 mm wall, so a spirit core of
 * 2.0 mm radius. The lag inside the bulb is conduction in the spirit (k 0.17 W/(m K), 800 kg/m3, 2.4 kJ/(kg K): alpha 8.9e-8
 * m2/s): the slowest mode of a cylinder, exp(-5.783 alpha t / r^2), as a lumped conductance C_s 5.783 alpha / r^2.
 */
export const BULB = (() => {
  const diameterM = 0.0048;
  const lengthM = 0.016;
  const rSpirit = 0.002;
  const cSpiritJK = Math.PI * rSpirit ** 2 * lengthM * 800 * 2400;
  const alpha = 0.17 / (800 * 2400);
  return {
    diameterM,
    lengthM,
    /** Heat capacity of the glass shell (0.15 g x 0.84 J/(g K)) and of the spirit (J/K) */
    cGlassJK: 0.13,
    cSpiritJK,
    /** Conductance from the wall into the spirit core (W/K) */
    gSpiritWK: (cSpiritJK * 5.783 * alpha) / rSpirit ** 2,
  };
})();
const BULB_AREA_M2 = Math.PI * BULB.diameterM * BULB.lengthM;

/** Water near the bulb: kinematic viscosity (m2/s), Prandtl number, conductivity (W/(m K)), expansivity (1/K), diffusivity. */
function waterProps(tK: number) {
  const nu = 1.0e-6 * Math.exp(-0.0245 * (tK - 293.15));
  const pr = 7.0 * Math.exp(-0.026 * (tK - 293.15));
  const k = 0.598 + 0.0012 * (tK - 293.15);
  const beta = Math.max(0.5e-4, 2.07e-4 + 1.0e-5 * (tK - 293.15));
  return { nu, pr, k, beta, alpha: nu / pr };
}

/** Churchill-Chu natural convection around a horizontal cylinder, W/(m2 K). */
export function filmNatural(tLiquidK: number, deltaK: number): number {
  const w = waterProps(tLiquidK);
  const ra = (9.81 * w.beta * Math.max(deltaK, 0.2) * BULB.diameterM ** 3) / (w.nu * w.alpha);
  const nu = (0.6 + (0.387 * ra ** (1 / 6)) / (1 + (0.559 / w.pr) ** (9 / 16)) ** (8 / 27)) ** 2;
  return (nu * w.k) / BULB.diameterM;
}

/** Churchill-Bernstein forced convection across a cylinder, W/(m2 K), for a stirrer at `rpm` (bar 3 cm: the liquid at the wall moves at a quarter of the tip speed). */
export function filmForced(tLiquidK: number, rpm: number): number {
  if (rpm <= 0) return 0;
  const w = waterProps(tLiquidK);
  const u = 0.25 * Math.PI * 0.03 * (rpm / 60);
  const re = (u * BULB.diameterM) / w.nu;
  const nu = 0.3 + (0.62 * Math.sqrt(re) * w.pr ** (1 / 3)) / (1 + (0.4 / w.pr) ** (2 / 3)) ** 0.25 * (1 + (re / 282000) ** (5 / 8)) ** 0.8;
  return (nu * w.k) / BULB.diameterM;
}

/** Combined film coefficient (W/(m2 K)). */
export function bulbFilmCoefficient(tLiquidK: number, deltaK: number, stirRpm: number): number {
  const hn = filmNatural(tLiquidK, deltaK);
  const hf = filmForced(tLiquidK, stirRpm);
  return (hn ** 3 + hf ** 3) ** (1 / 3);
}

export interface BulbState {
  glassK: number;
  spiritK: number;
}

/** Advances the two-node bulb by `dt` seconds in liquid at `tLiquidK` (explicit sub-steps well inside the fastest time constant, ~0.1 s). */
export function stepBulb(s: BulbState, tLiquidK: number, stirRpm: number, dt: number): void {
  const n = Math.max(1, Math.ceil(dt / 0.02));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const film = bulbFilmCoefficient(tLiquidK, Math.abs(tLiquidK - s.glassK), stirRpm) * BULB_AREA_M2;
    const qIn = film * (tLiquidK - s.glassK);
    const qWall = BULB.gSpiritWK * (s.glassK - s.spiritK);
    s.glassK += ((qIn - qWall) / BULB.cGlassJK) * h;
    s.spiritK += (qWall / BULB.cSpiritJK) * h;
  }
}
