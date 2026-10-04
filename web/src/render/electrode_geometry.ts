/**
 * Where the electrode pair of the potentiostat sits in a vessel. Shared by the electrode assembly (`equipment/electrochem`)
 * and the vessel's bubbles (`render/effects`), so gas forms on the rods themselves and the rods follow the liquid level.
 */

/** Distance of each rod from the vessel axis, cm (anode at -x, cathode at +x). */
export const ELECTRODE_X = 1.4;
export const ELECTRODE_RADIUS = 0.2;
export const ELECTRODE_LENGTH = 9;
/** How deep the rods stand in the liquid when there is enough of it, cm. */
export const DIP_CM = 3.2;
/** Lowest the rod tips go above the vessel floor, cm. */
const FLOOR_GAP_CM = 0.8;

/** Height of the rod tips in group-local (bench-standing) coordinates for a liquid surface at `surfaceY` (0 = no liquid). */
export function electrodeBottomY(surfaceY: number): number {
  return Math.max(FLOOR_GAP_CM, surfaceY - DIP_CM);
}
