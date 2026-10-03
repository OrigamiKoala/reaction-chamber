import { LiquidLayer, OpticsTables, N_BINS } from '../types/sim';
import { rgbWeights } from './cie';

/**
 * Spectral helpers of the liquid renderer. A layer's colour is never collapsed to three per-channel coefficients: the shader
 * reads a per-layer look-up table of optical depth (rgb) against path length built here from the whole spectrum, so dichroic
 * solutions change hue with depth (thin films and the meniscus differ from the deep column).
 */

/** Samples of a layer's optical-depth LUT along the path. */
export const LUT_N = 32;
/** Longest path (cm) the LUT covers; longer chords extrapolate linearly. Samples are spaced as sqrt(L / LUT_LMAX_CM). */
export const LUT_LMAX_CM = 16;

function weightsOf(opticsTables: OpticsTables | null): number[] {
  return opticsTables && opticsTables.rgb_weights && opticsTables.rgb_weights.length >= N_BINS * 3 ? opticsTables.rgb_weights : rgbWeights();
}

/**
 * Computes linear-sRGB transmission through a path length using Beer-Lambert law.
 */
export function computeSpectralColor(opticsTables: OpticsTables | null, absorbancePerCm: number[], pathLengthCm: number): [number, number, number] {
  const w = weightsOf(opticsTables);
  let r = 0.0;
  let g = 0.0;
  let b = 0.0;
  for (let i = 0; i < N_BINS; i++) {
    const a = absorbancePerCm[i] || 0.0;
    const t = Math.pow(10.0, -a * pathLengthCm);
    r += w[i * 3 + 0] * t;
    g += w[i * 3 + 1] * t;
    b += w[i * 3 + 2] * t;
  }
  return [Math.max(0.0, Math.min(1.0, r)), Math.max(0.0, Math.min(1.0, g)), Math.max(0.0, Math.min(1.0, b))];
}

const LN10 = Math.LN10;

/**
 * Optical-depth LUT of a layer: `out[3 j + c]` = -ln T_c(L_j) for the sample path lengths `L_j = LUT_LMAX_CM (j / (N-1))^2`,
 * where T_c is the colour channel of the spectral transmission `10^(-A L) exp(-ext L)` (absorption and the chromatic
 * extinction of the suspended solids together).
 */
export function buildOdLut(opticsTables: OpticsTables | null, layer: LiquidLayer, out: Float32Array) {
  const w = weightsOf(opticsTables);
  const a = layer.absorbance_per_cm ?? [];
  const e = layer.scatter_per_cm ?? [];
  for (let j = 0; j < LUT_N; j++) {
    const u = j / (LUT_N - 1);
    const L = LUT_LMAX_CM * u * u;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < N_BINS; i++) {
      const t = Math.exp(-((a[i] || 0) * LN10 + (e[i] || 0)) * L);
      r += w[i * 3] * t;
      g += w[i * 3 + 1] * t;
      b += w[i * 3 + 2] * t;
    }
    out[3 * j] = -Math.log(Math.max(r, 1e-3));
    out[3 * j + 1] = -Math.log(Math.max(g, 1e-3));
    out[3 * j + 2] = -Math.log(Math.max(b, 1e-3));
  }
}

/**
 * In-scattering of a layer's suspended solids: the colour of the scattered light (luminance-normalised, from the albedo and
 * the chromatic extinction) and the luminance-weighted extinction coefficient (1/cm).
 */
export function scatterSummary(opticsTables: OpticsTables | null, layer: LiquidLayer): { rgb: [number, number, number]; w: number } {
  const wt = weightsOf(opticsTables);
  const e = layer.scatter_per_cm ?? [];
  const alb = layer.scatter_albedo ?? [];
  let lum = 0;
  const raw = [0, 0, 0];
  for (let i = 0; i < N_BINS; i++) {
    const ei = e[i] || 0;
    if (ei <= 0) continue;
    const wl = 0.2126 * wt[i * 3] + 0.7152 * wt[i * 3 + 1] + 0.0722 * wt[i * 3 + 2];
    lum += wl * ei;
    const a = alb[i] ?? 1;
    for (let c = 0; c < 3; c++) raw[c] += wt[i * 3 + c] * ei * a;
  }
  if (lum <= 1e-9) return { rgb: [1, 1, 1], w: 0 };
  return { rgb: [Math.max(0, raw[0] / lum), Math.max(0, raw[1] / lum), Math.max(0, raw[2] / lum)], w: lum };
}
