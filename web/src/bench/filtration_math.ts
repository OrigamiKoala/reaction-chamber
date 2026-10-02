// Pure maths for filtration (funnel set on a flask): how fast liquid passes the paper / frit, what the wet cake holds
// back. No DOM, no scene. Checked by tests/pipetting_math.mjs.

export type FilterMode = 'gravity' | 'vacuum';

/** Gravity filtration through a 75 mm paper: about half a mL per second for a well-filled funnel. */
export const GRAVITY_ML_S = 0.55;
/** A water aspirator pulling on a Büchner flask is roughly an order of magnitude faster. */
export const VACUUM_ML_S = 6;
/** Wet cake holds back this much liquid per gram of solid (mL/g), plus a film on the paper. */
export const CAKE_HOLD_ML_PER_G = 0.4;
export const PAPER_FILM_ML = 0.25;

export function isFunnelType(type: string): boolean {
  return type.startsWith('filter-funnel') || type.startsWith('buchner-funnel');
}

/** Vacuum only works for a Büchner funnel sitting on a Büchner (filter) flask. */
export function filterMode(funnelType: string, receiverType: string): FilterMode {
  return funnelType.startsWith('buchner-funnel') && receiverType.startsWith('buchner-flask') ? 'vacuum' : 'gravity';
}

/** Vessels a funnel can sit on: flasks, beakers, cylinders, tubes (open top, not another funnel / pipette / gas holder). */
export function canReceiveFiltrate(type: string): boolean {
  if (isFunnelType(type) || type.startsWith('separatory') || type.startsWith('pipette') || type.startsWith('gas-')) return false;
  if (type.startsWith('burette') || type.startsWith('petri') || type.startsWith('watch') || type.startsWith('weigh') || type.startsWith('evaporating') || type.startsWith('crucible')) return false;
  return true;
}

/** Liquid the cake / paper keeps instead of letting it through (mL). */
export function retainedMl(cakeG: number): number {
  return PAPER_FILM_ML + CAKE_HOLD_ML_PER_G * Math.max(0, cakeG);
}

/** Flow (mL/s) through the filter: more liquid above the paper pushes harder; a thick cake slows it down. */
export function filtrationRateMlS(mode: FilterMode, liquidMl: number, cakeG: number): number {
  const base = mode === 'vacuum' ? VACUUM_ML_S : GRAVITY_ML_S;
  const head = Math.min(1.2, Math.max(0.25, Math.sqrt(Math.max(0, liquidMl) / 25)));
  return (base * head) / (1 + 0.3 * Math.max(0, cakeG));
}

/** mL that pass in `dt` seconds (never more than the liquid above what the cake keeps; room-limited by the flask). */
export function filtrateStep(mode: FilterMode, liquidMl: number, cakeG: number, dt: number, roomMl = Infinity): number {
  const avail = Math.max(0, liquidMl - retainedMl(cakeG));
  if (avail <= 1e-6 || !(dt > 0)) return 0;
  return Math.max(0, Math.min(filtrationRateMlS(mode, liquidMl, cakeG) * dt, avail, roomMl));
}
