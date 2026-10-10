// Molecular viewer: a species' engine structure (`Structure3dData`, angstrom) prepared for drawing and for the motion
// model: centred on its centroid, with a bounding radius, element colours and radii, and the list of bond cylinders
// (a double bond is two parallel cylinders in the plane of its neighbours, a triple bond three, an aromatic bond one plus a
// shorter, thinner second line on the ring side).
import * as THREE from 'three';
import type { Structure3dData } from '../types/sim';
import { ELEMENT_VIEW } from '../data/element_view';

export interface AtomShape {
  el: string;
  /** Position relative to the molecule's centroid, A. */
  p: THREE.Vector3;
  colour: THREE.Color;
  /** Van der Waals radius, A (space-filling). */
  rVdw: number;
  /** Ball radius of the ball-and-stick style, A. */
  rBall: number;
  charge: number;
}

export interface SegShape {
  a: number;
  b: number;
  /** Bond line between the two atoms, shifted by the offset: centre, rotation taking +Y to the bond direction, length. */
  mid: THREE.Vector3;
  quat: THREE.Quaternion;
  len: number;
  /** Cylinder radius, A. */
  radius: number;
  /** 'dashed' lines are drawn shorter (a stand-in for the delocalised half of an aromatic bond). */
  kind: 'solid' | 'short';
}

export interface MolShape {
  species: string;
  formula: string;
  charge: number;
  source: Structure3dData['source'];
  atoms: AtomShape[];
  segs: SegShape[];
  /** Bounding radius for collisions, A. */
  radius: number;
  /** A single sphere (monatomic ion, placeholder). */
  single: boolean;
}

/** Ball-and-stick ball radius as a fraction of the van der Waals radius, and the bond cylinder radius, A. */
export const BALL_FRACTION = 0.3;
export const BOND_RADIUS = 0.11;

const FALLBACK: [number, number, string] = [1.5, 2.0, '#bbbbbb'];
export const elementView = (el: string): [number, number, string] => ELEMENT_VIEW[el] ?? FALLBACK;

const Y = new THREE.Vector3(0, 1, 0);

export function buildShape(s: Structure3dData): MolShape {
  const n = s.atoms.length;
  const c = new THREE.Vector3();
  for (const a of s.atoms) c.add(new THREE.Vector3(a.x, a.y, a.z));
  if (n > 0) c.multiplyScalar(1 / n);
  const single = n === 1;

  const atoms: AtomShape[] = s.atoms.map((a) => {
    const [, vdw, hex] = elementView(a.el);
    // a monatomic ion is drawn at its ionic radius (the engine sends it), not the neutral atom's
    const rIon = single && s.radius_a && s.radius_a > 0 ? s.radius_a : 0;
    return {
      el: a.el,
      p: new THREE.Vector3(a.x, a.y, a.z).sub(c),
      colour: new THREE.Color(hex),
      rVdw: rIon || vdw,
      rBall: rIon ? rIon * 0.8 : Math.max(0.3, BALL_FRACTION * vdw),
      charge: a.charge,
    };
  });

  // neighbours for the plane of multiple bonds
  const adj: number[][] = atoms.map(() => []);
  for (const b of s.bonds) {
    adj[b.a].push(b.b);
    adj[b.b].push(b.a);
  }

  const segs: SegShape[] = [];
  const pushSeg = (a: number, b: number, off: THREE.Vector3, radius: number, kind: 'solid' | 'short') => {
    const pa = atoms[a].p.clone().add(off);
    const pb = atoms[b].p.clone().add(off);
    const d = pb.clone().sub(pa);
    let len = d.length();
    if (len < 1e-6) return;
    d.multiplyScalar(1 / len);
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    if (kind === 'short') len *= 0.62;
    segs.push({ a, b, mid, quat: new THREE.Quaternion().setFromUnitVectors(Y, d), len, radius, kind });
  };

  for (const b of s.bonds) {
    const pa = atoms[b.a].p;
    const pb = atoms[b.b].p;
    const d = pb.clone().sub(pa).normalize();
    // plane normal: from a neighbour that is not on the bond axis; else any perpendicular
    let nrm = new THREE.Vector3();
    for (const [end, other] of [[b.a, b.b], [b.b, b.a]] as const) {
      for (const k of adj[end]) {
        if (k === other) continue;
        const t = atoms[k].p.clone().sub(atoms[end].p);
        const cr = new THREE.Vector3().crossVectors(d, t);
        if (cr.lengthSq() > 1e-4 && cr.lengthSq() > nrm.lengthSq()) nrm = cr;
      }
    }
    if (nrm.lengthSq() < 1e-6) nrm = Math.abs(d.x) < 0.9 ? new THREE.Vector3(1, 0, 0).cross(d) : new THREE.Vector3(0, 1, 0).cross(d);
    nrm.normalize();
    // in-plane offset direction, perpendicular to the bond
    const inPlane = new THREE.Vector3().crossVectors(nrm, d).normalize();
    // point it toward the rest of the molecule (the inside of a ring) so the second line of an aromatic bond sits inside
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    if (inPlane.dot(mid) > 0) inPlane.negate();

    if (b.coordinate) {
      pushSeg(b.a, b.b, new THREE.Vector3(), BOND_RADIUS * 0.6, 'solid');
    } else if (b.aromatic) {
      pushSeg(b.a, b.b, new THREE.Vector3(), BOND_RADIUS * 0.8, 'solid');
      pushSeg(b.a, b.b, inPlane.clone().multiplyScalar(0.2), BOND_RADIUS * 0.55, 'short');
    } else if (b.order >= 3) {
      pushSeg(b.a, b.b, new THREE.Vector3(), BOND_RADIUS * 0.6, 'solid');
      pushSeg(b.a, b.b, inPlane.clone().multiplyScalar(0.17), BOND_RADIUS * 0.6, 'solid');
      pushSeg(b.a, b.b, inPlane.clone().multiplyScalar(-0.17), BOND_RADIUS * 0.6, 'solid');
    } else if (b.order >= 2) {
      pushSeg(b.a, b.b, inPlane.clone().multiplyScalar(0.1), BOND_RADIUS * 0.65, 'solid');
      pushSeg(b.a, b.b, inPlane.clone().multiplyScalar(-0.1), BOND_RADIUS * 0.65, 'solid');
    } else {
      pushSeg(b.a, b.b, new THREE.Vector3(), BOND_RADIUS, 'solid');
    }
  }

  let radius = 0.6;
  for (const a of atoms) radius = Math.max(radius, a.p.length() + 0.55 * a.rVdw);
  return { species: s.species, formula: s.formula, charge: s.charge, source: s.source, atoms, segs, radius, single };
}
