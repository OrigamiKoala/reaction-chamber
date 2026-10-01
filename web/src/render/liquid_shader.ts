import * as THREE from 'three';
import { LiquidLayer, OpticsTables, N_BINS } from '../types/sim';

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
 * Computes linear-sRGB transmission through a path length using Beer-Lambert law.
 */
export function computeSpectralColor(
  opticsTables: OpticsTables | null,
  absorbancePerCm: number[],
  pathLengthCm: number
): [number, number, number] {
  if (!opticsTables || !opticsTables.rgb_weights || opticsTables.rgb_weights.length < N_BINS * 3) {
    // Default water clear fallback
    return [0.95, 0.98, 1.0];
  }

  let r = 0.0;
  let g = 0.0;
  let b = 0.0;

  for (let i = 0; i < N_BINS; i++) {
    const a = absorbancePerCm[i] || 0.0;
    const t = Math.pow(10.0, -a * pathLengthCm);
    r += opticsTables.rgb_weights[i * 3 + 0] * t;
    g += opticsTables.rgb_weights[i * 3 + 1] * t;
    b += opticsTables.rgb_weights[i * 3 + 2] * t;
  }

  return [
    Math.max(0.0, Math.min(1.0, r)),
    Math.max(0.0, Math.min(1.0, g)),
    Math.max(0.0, Math.min(1.0, b)),
  ];
}
