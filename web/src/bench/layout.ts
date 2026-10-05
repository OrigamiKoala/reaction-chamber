import * as THREE from 'three';

/**
 * Where the wet-bench instruments stand (world, cm; the bench front edge is z = +32, the back wall z = -45). They all face
 * the front, square to the table edge (no rotation), in one row with a few cm between neighbours, left to right:
 * burner, titration station (x = -44, `titration.ts`), hot plate, potentiostat, pH meter, balance.
 */
export const BURNER_POS = new THREE.Vector3(-80, 0, -12);
export const HOTPLATE_POS = new THREE.Vector3(0, 0, 6);
export const ELECTROCHEM_POS = new THREE.Vector3(29, 0, -14);
export const PH_METER_POS = new THREE.Vector3(60, 0, -14);
export const BALANCE_POS = new THREE.Vector3(90, 0, -4);

/** The analytical area (island bench, GC/MS, UV-vis, lab PC, NMR bay) stands this far (cm, +z) behind where it used to: a wide aisle separates it from the wet bench. */
export const ANALYTICAL_Z_SHIFT = 130;
const S = ANALYTICAL_Z_SHIFT;

/** Lab PC between the spectrophotometer (x = -65) and the GC/MS (x = 17) on the analytical bench; shows their software. */
export const WORKSTATION_POS = new THREE.Vector3(-30.5, 0, 93 + S);

/** Indicator dropper bottles are put out beside the titration station (front left of it) by the titration setup. */
export const INDICATOR_IDS = ['phenolphthalein_drop', 'methyl_orange_drop', 'bromothymol_blue_drop', 'methyl_red_drop'];
export const INDICATOR_POS = INDICATOR_IDS.map((_, i) => new THREE.Vector3(-70 + i * 5.6, 0, 20));

/**
 * Analytical island bench (z 76..136, x -95..108) and the NMR bay to its right. The bench carries the UV-vis, the lab PC and the
 * GC/MS; the NMR console is a floor-standing cabinet next to the bench end, the superconducting magnet stands on the floor
 * further right inside a taped 5-gauss zone. The side wall of the room is at x = ROOM.xMax.
 */
export const SPECTRO_POS = new THREE.Vector3(-65, 0, 106 + S);
export const MASS_SPEC_POS = new THREE.Vector3(48, 0, 108 + S);
export const NMR_POS = new THREE.Vector3(186, 0, 98 + S);
/** The magnet's floor point (y = floor). */
export const NMR_CRYO_POS = new THREE.Vector3(292, -90, 100 + S);
/** Radius of the taped 5-gauss line around the magnet, cm. */
export const NMR_FIVE_GAUSS_R = 60;
/** Gas cylinders (helium carrier, nitrogen) standing at the bench end beside the GC/MS; floor points. */
export const GAS_CYLINDER_POS = [new THREE.Vector3(128, -90, 88 + S), new THREE.Vector3(128, -90, 112 + S)];

/** The room: the x range was widened to the right for the NMR bay (it used to be -160..160). */
export const ROOM = { xMin: -160, xMax: 372, floorY: -90, ceilingY: 220, zBack: -45, zFront: 515,
  /** Back wall of the NMR bay (x >= ROOM.bayXMin): the analytical area is set well back from the wet bench. */
  zBay: 100 + S - 110, bayXMin: 135 };
