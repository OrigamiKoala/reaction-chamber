/**
 * Colorimetry on the engine's spectral grid (380-780 nm, 41 bins of 10 nm): CIE 1931 2-degree colour matching functions x
 * CIE D65 -> linear sRGB per-bin weights, white balanced so a flat spectrum of 1 gives (1, 1, 1). This is the *fallback* used
 * until the engine's own `optics_tables_json()` arrives; the tables below are the same numbers as `engine/src/optics/cie.rs`
 * (a unit test of the engine checks the table against the Wyman-Sloan-Shirley fit, and `tests/optics_tables.mjs` checks that
 * the engine's weights equal the ones this file regenerates).
 */
// (standalone so that node tests can import it: the same constants as `types/sim.ts`)
const N_BINS = 41;
const BIN_NM0 = 380;
const BIN_STEP_NM = 10;

export const CMF_X = [
  0.001368, 0.004243, 0.01431, 0.04351, 0.13438, 0.2839, 0.34828, 0.3362, 0.2908, 0.19536, 0.09564, 0.03201, 0.0049, 0.0093, 0.06327, 0.1655,
  0.2904, 0.43345, 0.5945, 0.7621, 0.9163, 1.0263, 1.0622, 1.0026, 0.85445, 0.6424, 0.4479, 0.2835, 0.1649, 0.0874, 0.04677, 0.0227, 0.011359,
  0.00579, 0.002899, 0.00144, 0.00069, 0.000332, 0.000166, 0.000083, 0.000042,
];
export const CMF_Y = [
  0.000039, 0.00012, 0.000396, 0.00121, 0.004, 0.0116, 0.023, 0.038, 0.06, 0.09098, 0.13902, 0.20802, 0.323, 0.503, 0.71, 0.862, 0.954, 0.99495,
  0.995, 0.952, 0.87, 0.757, 0.631, 0.503, 0.381, 0.265, 0.175, 0.107, 0.061, 0.032, 0.017, 0.00821, 0.004102, 0.002091, 0.001047, 0.00052,
  0.000249, 0.00012, 0.00006, 0.00003, 0.000015,
];
export const CMF_Z = [
  0.00645, 0.02005, 0.06785, 0.2074, 0.6456, 1.3856, 1.74706, 1.77211, 1.6692, 1.28764, 0.81295, 0.46518, 0.272, 0.1582, 0.07825, 0.04216,
  0.0203, 0.00875, 0.0039, 0.0021, 0.00165, 0.0011, 0.0008, 0.00034, 0.00019, 0.00005, 0.00002, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];
/** CIE standard illuminant D65, relative spectral power at 380..780 nm step 10 nm. */
export const D65 = [
  49.9755, 54.6482, 82.7549, 91.486, 93.4318, 86.6823, 104.865, 117.008, 117.812, 114.861, 115.923, 108.811, 109.354, 107.802, 104.79, 107.689,
  104.405, 104.046, 100.0, 96.3342, 95.788, 88.6856, 90.0062, 89.5991, 87.6987, 83.2886, 83.6992, 80.0268, 80.0456, 82.2778, 78.2842, 69.7213,
  71.6091, 74.349, 61.604, 69.8856, 75.087, 63.5927, 46.4182, 66.8054, 63.3828,
];

export function xyzToLinearSrgb(x: number, y: number, z: number): [number, number, number] {
  return [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
}

let weights: number[] | null = null;

/** Per-bin linear-sRGB weights under D65, flattened [r0, g0, b0, r1, ...], white balanced (each channel sums to 1). */
export function rgbWeights(): number[] {
  if (weights) return weights;
  const w: number[] = [];
  const sum = [0, 0, 0];
  for (let i = 0; i < N_BINS; i++) {
    const rgb = xyzToLinearSrgb(CMF_X[i] * D65[i], CMF_Y[i] * D65[i], CMF_Z[i] * D65[i]);
    for (let c = 0; c < 3; c++) {
      w.push(rgb[c]);
      sum[c] += rgb[c];
    }
  }
  for (let i = 0; i < N_BINS; i++) for (let c = 0; c < 3; c++) w[i * 3 + c] /= sum[c];
  weights = w;
  return w;
}

/** Wavelength (nm) of bin i. */
export function binNm(i: number): number {
  return BIN_NM0 + BIN_STEP_NM * i;
}
