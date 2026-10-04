/**
 * Colour and visibility of thermal emission (a glowing vessel, a flame's yellow part): Planck's law integrated against
 * the CIE 1931 colour matching functions on the engine's spectral grid (`cie.ts`), converted to linear sRGB. No colour
 * table: the glow follows from the temperature alone.
 */
import { CMF_X, CMF_Y, CMF_Z, binNm, xyzToLinearSrgb } from './cie';

const H = 6.62607015e-34;
const C = 2.99792458e8;
const KB = 1.380649e-23;

/** Spectral radiance at wavelength `nm` of a blackbody at `tK` (arbitrary units; only ratios are used). */
function planck(nm: number, tK: number): number {
  const l = nm * 1e-9;
  const x = (H * C) / (l * KB * tK);
  if (x > 700) return 0;
  return (2 * H * C * C) / (l ** 5 * (Math.exp(x) - 1));
}

function xyz(tK: number): [number, number, number] {
  let X = 0, Y = 0, Z = 0;
  for (let i = 0; i < CMF_Y.length; i++) {
    const p = planck(binNm(i), tK);
    X += p * CMF_X[i];
    Y += p * CMF_Y[i];
    Z += p * CMF_Z[i];
  }
  return [X, Y, Z];
}

/** Luminance (photopic, arbitrary units) of a blackbody at `tK`. */
export function blackbodyLuminance(tK: number): number {
  return tK > 300 ? xyz(tK)[1] : 0;
}

/** Linear-sRGB hue of a blackbody at `tK`, scaled so the largest channel is 1. */
export function blackbodyHue(tK: number): [number, number, number] {
  const [X, Y, Z] = xyz(Math.max(500, tK));
  const [r, g, b] = xyzToLinearSrgb(X, Y, Z);
  const m = Math.max(r, g, b, 1e-12);
  return [Math.max(0, r) / m, Math.max(0, g) / m, Math.max(0, b) / m];
}

// Draper point: a body first glows dull red in a dark room at ~798 K; by ~1300 K it is bright orange. The display
// brightness runs from 0 to 1 over that range on a log scale of the luminance (the eye's response is logarithmic).
const L_LO = blackbodyLuminance(780);
const L_HI = blackbodyLuminance(1300);

/** 0..1 how brightly a body at `tK` glows (0 below ~780 K: no visible light; 1 at ~1300 K and above). */
export function glowBrightness(tK: number): number {
  if (!(tK > 780)) return 0;
  const l = blackbodyLuminance(tK);
  return Math.max(0, Math.min(1, Math.log(l / L_LO) / Math.log(L_HI / L_LO)));
}
