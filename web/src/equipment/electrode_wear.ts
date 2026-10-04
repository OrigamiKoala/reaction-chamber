/**
 * What an electrode looks like after current has passed: the cathode gets a film of whatever deposited on it, the anode
 * loses metal and tarnishes. Pure maths (no three.js) so the numbers can be tested: the engine reports the mass change of
 * each electrode and, for the cathode, the deposit as a solid record (`ElectrodeVisual`); the rod's wetted area is the
 * assembly's own geometry.
 */
import type { ElectrodeVisual } from '../types/sim';
import { DIP_CM, ELECTRODE_RADIUS } from '../render/electrode_geometry';

/** Wetted side area of one rod standing `DIP_CM` in the liquid, cm2. */
export const WETTED_ROD_AREA_CM2 = 2 * Math.PI * ELECTRODE_RADIUS * DIP_CM;

/** Density used only when the engine reports neither a deposit record nor the electrode material's own density (visual stand-in, g/mL). */
const FALLBACK_DENSITY_G_ML = 8;

/** The density of the electrode's own material (engine: the species store's solid record), else the deposit's, else the stand-in. */
function densityOf(v: ElectrodeVisual, deposit?: { density_g_ml?: number }): number {
  const ok = (x: number | undefined): x is number => typeof x === 'number' && isFinite(x) && x > 0.05;
  if (ok(deposit?.density_g_ml)) return deposit!.density_g_ml!;
  if (ok(v.density_g_ml)) return v.density_g_ml;
  return FALLBACK_DENSITY_G_ML;
}

/** A film is opaque once it is a few hundred nanometres thick (copper looks copper from ~0.5 um). */
const OPAQUE_UM = 0.5;

export interface WearLook {
  /** Mean thickness of deposit (cathode) or of metal lost (anode) over the wetted rod, micrometres. */
  thicknessUm: number;
  /** 0..1 how much of the rod the film hides (cathode) or how tarnished it is (anode). */
  coverage: number;
  /** Radial shrink of the rod, cm (anode only; true to scale, so invisible until a lot has dissolved). */
  shrinkCm: number;
  /** Colour of the deposit (linear RGB) when the engine names one. */
  rgb: [number, number, number] | null;
}

const NONE: WearLook = { thicknessUm: 0, coverage: 0, shrinkCm: 0, rgb: null };

export function cathodeLook(v: ElectrodeVisual | undefined): WearLook {
  if (!v) return NONE;
  const dep = v.deposit;
  const mass = dep ? dep.mass_g : Math.max(0, v.mass_change_g);
  if (!(mass > 0)) return NONE;
  const rho = densityOf(v, dep);
  const t = (mass / (rho * WETTED_ROD_AREA_CM2)) * 1e4;
  return { thicknessUm: t, coverage: 1 - Math.exp(-t / OPAQUE_UM), shrinkCm: 0, rgb: dep ? dep.rgb : null };
}

export function anodeLook(v: ElectrodeVisual | undefined): WearLook {
  if (!v) return NONE;
  const lost = Math.max(0, -v.mass_change_g);
  if (!(lost > 0)) return NONE;
  const t = (lost / (densityOf(v) * WETTED_ROD_AREA_CM2)) * 1e4;
  return { thicknessUm: t, coverage: Math.min(0.7, 1 - Math.exp(-t / 2)), shrinkCm: Math.min(ELECTRODE_RADIUS * 0.5, t * 1e-4), rgb: null };
}
