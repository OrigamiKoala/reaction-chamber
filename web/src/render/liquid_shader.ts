import * as THREE from 'three';
import { LiquidLayer, OpticsTables, N_BINS, BIN_NM0, BIN_STEP_NM } from '../types/sim';

/**
 * Custom Beer-Lambert spectral transmission and turbidity scattering shader material.
 * Computes exact physical light absorption per 32 wavelength bins (400-710 nm).
 */
export function createLiquidMaterial(
  opticsTables: OpticsTables | null,
  layer: LiquidLayer,
  pathDepthCm: number = 2.5
): THREE.MeshPhysicalMaterial {
  // Compute linear-sRGB color from spectral absorbance and optics tables
  const rgb = computeSpectralColor(opticsTables, layer.absorbance_per_cm, pathDepthCm);

  // Apply scattering mix (turbidity)
  const tau = Math.exp(-layer.scatter_per_cm * pathDepthCm);
  const finalR = rgb[0] * tau + layer.scatter_rgb[0] * (1.0 - tau);
  const finalG = rgb[1] * tau + layer.scatter_rgb[1] * (1.0 - tau);
  const finalB = rgb[2] * tau + layer.scatter_rgb[2] * (1.0 - tau);

  const opacity = Math.min(1.0, 0.4 + (1.0 - tau) * 0.55 + (1.0 - Math.min(1.0, rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11)) * 0.5);

  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(
      Math.min(1.0, Math.max(0.0, finalR)),
      Math.min(1.0, Math.max(0.0, finalG)),
      Math.min(1.0, Math.max(0.0, finalB))
    ),
    transmission: Math.max(0.05, Math.min(0.95, tau * 0.9)),
    transparent: true,
    opacity: Math.max(0.2, opacity),
    roughness: 0.1 + (1.0 - tau) * 0.3,
    ior: layer.refractive_index || 1.333,
    thickness: 0.8,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
  });
}

/**
 * Analytic stand-in for the engine's `optics_tables()` (CIE 1931 multi-lobe fit, Wyman et al. 2013, equal-energy
 * illuminant, per-channel white balance so a bin-wise T=1 gives (1,1,1)). Only used when the real tables are not
 * available (engine still loading / failed), so coloured solutions never silently turn into plain water.
 */
let fallbackTables: OpticsTables | null = null;
export function fallbackOpticsTables(): OpticsTables {
  if (fallbackTables) return fallbackTables;
  const g = (l: number, mu: number, s1: number, s2: number) => {
    const t = (l - mu) / (l < mu ? s1 : s2);
    return Math.exp(-0.5 * t * t);
  };
  const w: number[] = [];
  const sum = [0, 0, 0];
  for (let i = 0; i < N_BINS; i++) {
    const l = BIN_NM0 + BIN_STEP_NM * i;
    const X = 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
    const Y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
    const Z = 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
    const rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
    for (let c = 0; c < 3; c++) {
      w.push(rgb[c]);
      sum[c] += rgb[c];
    }
  }
  for (let i = 0; i < N_BINS; i++) for (let c = 0; c < 3; c++) w[i * 3 + c] /= sum[c];
  fallbackTables = { n_bins: N_BINS, rgb_weights: w };
  return fallbackTables;
}

/**
 * Computes linear-sRGB transmission through a path length using Beer-Lambert law.
 */
export function computeSpectralColor(
  opticsTables: OpticsTables | null,
  absorbancePerCm: number[],
  pathLengthCm: number
): [number, number, number] {
  const tables = opticsTables && opticsTables.rgb_weights && opticsTables.rgb_weights.length >= N_BINS * 3 ? opticsTables : fallbackOpticsTables();

  let r = 0.0;
  let g = 0.0;
  let b = 0.0;

  for (let i = 0; i < N_BINS; i++) {
    const a = absorbancePerCm[i] || 0.0;
    const t = Math.pow(10.0, -a * pathLengthCm);
    r += tables.rgb_weights[i * 3 + 0] * t;
    g += tables.rgb_weights[i * 3 + 1] * t;
    b += tables.rgb_weights[i * 3 + 2] * t;
  }

  return [
    Math.max(0.0, Math.min(1.0, r)),
    Math.max(0.0, Math.min(1.0, g)),
    Math.max(0.0, Math.min(1.0, b)),
  ];
}
