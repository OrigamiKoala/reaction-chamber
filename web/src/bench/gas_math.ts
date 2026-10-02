// Pure maths for gas collection (ideal gas, readings of gas collectors). Mirrors engine/src/gas.rs.
// Run the checks with: node tests/pipetting_math.mjs (also covers this file)

export const R_GAS = 8.314462618; // J / (mol K)
export const ATM_PA = 101325;

export type CollectorKind = 'syringe' | 'over_water' | 'jar';

/** Saturation vapour pressure of water (atm), Antoine equation. */
export function waterVapourAtm(tK: number): number {
  const tC = tK - 273.15;
  if (tC <= 0) return 0;
  const logP = 8.07131 - 1730.63 / (tC + 233.426); // mmHg
  return Math.min(10, Math.max(0, Math.pow(10, logP) / 760));
}

/** Volume (mL) of `nMol` of ideal gas at `tK` and `pAtm`. */
export function gasVolumeMl(nMol: number, tK: number, pAtm: number): number {
  return ((nMol * R_GAS * tK) / (Math.max(1e-6, pAtm) * ATM_PA)) * 1e6;
}

/** Moles in `vMl` of ideal gas at `tK` and `pAtm`. */
export function gasMoles(vMl: number, tK: number, pAtm: number): number {
  return (pAtm * ATM_PA * vMl * 1e-6) / (R_GAS * Math.max(1, tK));
}

/** Pressure (atm) of the dry collected gas: over water the water vapour takes its share of the ambient pressure. */
export function dryGasPressureAtm(kind: CollectorKind, tK: number): number {
  return kind === 'over_water' ? 1 - waterVapourAtm(tK) : 1;
}

/** What the collector reads: volume (mL) of the collected gas, as measured at the collector's temperature. */
export function collectorVolumeMl(kind: CollectorKind, nMol: number, tK: number): number {
  return gasVolumeMl(nMol, tK, dryGasPressureAtm(kind, tK));
}

/** Gas syringes read to the nearest mL; tubes / jars to half a mL (they are only rough guides). */
export function readingResolutionMl(kind: CollectorKind): number {
  return kind === 'syringe' ? 1 : kind === 'over_water' ? 0.5 : 5;
}

export function roundToResolution(ml: number, res: number): number {
  return Math.round(ml / res) * res;
}

/** "H2(g)" -> "H₂", "CO2(g)" -> "CO₂". */
export function gasName(species: string): string {
  const bare = species.replace(/\(g\)$/, '');
  return bare.replace(/(\d+)/g, (d) => d.replace(/\d/g, (c) => '₀₁₂₃₄₅₆₇₈₉'[+c]));
}

/** The most abundant collected gas, or null. */
export function dominantGas(species: { species: string; mol: number }[]): string | null {
  let best: { species: string; mol: number } | null = null;
  for (const s of species) if (s.mol > 0 && (!best || s.mol > best.mol)) best = s;
  return best ? best.species : null;
}

/** The text of a collector's level tag: "Gas: 37 mL at 21 °C" (+ the gas when known). */
export function gasTagText(kind: CollectorKind, volumeMl: number, tK: number, species?: string | null): { text: string; sub: string } {
  const res = readingResolutionMl(kind);
  const v = roundToResolution(volumeMl, res);
  const shown = v >= 100 || res >= 1 ? v.toFixed(0) : v.toFixed(1);
  return {
    text: `Gas: ${shown} mL`,
    sub: `at ${(tK - 273.15).toFixed(0)} °C${species ? ` · ${gasName(species)}` : ''}${kind === 'over_water' ? ' · over water' : ''}`,
  };
}

/** Plunger position (mL on the barrel scale) for a gas syringe holding `volumeMl` (clamped to the barrel). */
export function plungerMl(volumeMl: number, capacityMl: number): number {
  return Math.max(0, Math.min(capacityMl, volumeMl));
}
