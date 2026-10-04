/**
 * Metals the user added as pieces (a ribbon, turnings, granules) versus metals that formed in the vessel (cemented copper).
 * The engine models every solid as a particle population (a ribbon of magnesium is a 30 um powder that is partly
 * suspended and clouds the liquid), so the picture has to be corrected where the engine does not know the form:
 *  - the solid is reported as `pieces` (the renderer draws a ribbon / granules, not a powder bed);
 *  - it is not suspended, and the layer's turbidity loses the share its surface area contributed (Mie extinction of grains
 *    this size is proportional to their projected area).
 * A stand-in until the dose carries the physical form (ALGORITHM-IMPROVEMENT.md, W2).
 */
import type { VesselSnapshot } from '../types/sim';

export function applyPieceMetals(snap: VesselSnapshot, pieces: ReadonlySet<string>): void {
  if (pieces.size === 0) return;
  // projected area of everything that is suspended, per liquid layer, and the share that belongs to the pieces
  const total = new Map<number, number>();
  const piece = new Map<number, number>();
  for (const x of snap.solids) {
    const area = Math.max(0, x.surface_area_cm2 ?? 0) * Math.max(0, Math.min(1, x.suspended_fraction));
    if (area <= 0) continue;
    const layer = x.layer_index ?? 0;
    total.set(layer, (total.get(layer) ?? 0) + area);
    if (x.kind === 'metal' && pieces.has(x.species)) piece.set(layer, (piece.get(layer) ?? 0) + area);
  }
  for (const x of snap.solids) {
    if (x.kind !== 'metal' || !pieces.has(x.species)) continue;
    x.morphology = 'pieces';
    x.suspended_fraction = 0;
  }
  for (const [layer, a] of piece) {
    const l = snap.layers[layer];
    const t = total.get(layer) ?? 0;
    if (!l || t <= 0) continue;
    const keep = Math.max(0, 1 - a / t);
    l.scatter_per_cm = l.scatter_per_cm.map((v) => v * keep);
  }
}
