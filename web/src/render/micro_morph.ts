// Molecular viewer: one reaction event as a morph of 3D structures (three.js maths only, no renderer; tests/micro_morph.mjs).
//
// The engine gives a reaction as an atom map (every product atom, hydrogens included, to the reactant atom it was) and the
// structures of the molecules (`Structure3dData`). An event has three parts, all schematic:
//   approach  the reactant bodies move, rotated so that their reacting atoms face each other, to a docked cluster (rigid);
//   morph     the atoms of the cluster glide from the docked reactant geometry to the product geometry: every atom is guided along
//             a straight path to its place in the product conformer (fitted to the docked cluster by a rigid-body fit of the
//             mapped atoms), bond springs that blend from the reactant to the product topology keep neighbours at sensible
//             distances, a soft repulsion keeps non-bonded atoms apart; breaking bonds shrink away, forming bonds grow in, a
//             hydrogen that changes owner travels from donor to acceptor along its guide;
//   release   the product molecules become rigid bodies again at the pose the fit gave them (`productPoses`).
// It is a single step: no transition state, no mechanism, no stereochemistry (the plan, section 8). It is what the engine's
// atom map says, drawn smoothly.
import * as THREE from 'three';
import type { MicroAtomRef, MicroElectronHop, MicroMovingH, Structure3dData } from '../types/sim';
import { BALL_FRACTION, elementView } from './micro_shape';

export interface EventSpec {
  /** One structure per reactant molecule / product molecule (the molecule indices of the atom map). */
  reactants: Structure3dData[];
  products: Structure3dData[];
  /** `atomMap[p][j]`: the reactant atom that atom `j` of product molecule `p` was. */
  atomMap: MicroAtomRef[][];
  movingH: MicroMovingH[];
  /** Electrons that hop between redox centres (atoms of the reactant molecules): drawn as a glowing point on an arc. */
  electronHops?: MicroElectronHop[];
}

/** The product atom a reactant atom became (the atom map read backwards). */
function inverseOf(s: EventSpec, o: MicroAtomRef): MicroAtomRef {
  for (let p = 0; p < s.atomMap.length; p++) {
    for (let j = 0; j < s.atomMap[p].length; j++) {
      const q = s.atomMap[p][j];
      if (q[0] === o[0] && q[1] === o[1]) return [p, j];
    }
  }
  return o;
}

/** The same reaction run backwards (products become reactants): the atom map and the moving hydrogens are inverted. */
export function invertSpec(s: EventSpec): EventSpec {
  const atomMap: MicroAtomRef[][] = s.reactants.map((r) => r.atoms.map(() => [-1, -1] as MicroAtomRef));
  s.atomMap.forEach((row, p) => row.forEach((o, j) => (atomMap[o[0]][o[1]] = [p, j])));
  return {
    reactants: s.products,
    products: s.reactants,
    atomMap,
    movingH: s.movingH.map((m) => ({ from: m.to, to: m.from, donor: m.acceptor, acceptor: m.donor })),
    // run backwards the electrons go the other way, between the same atoms (which are now atoms of the new reactants)
    electronHops: s.electronHops?.map((h) => ({ from: inverseOf(s, h.to), to: inverseOf(s, h.from), count: h.count })),
  };
}

// ---------------------------------------------------------------------------------------------------- rigid fit (Horn)

/** Jacobi eigen-decomposition of a symmetric 4 x 4 matrix; returns the eigenvector of the largest eigenvalue. */
function largestEigenvector4(a: number[][]): number[] {
  const n = 4;
  const v = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const m = a.map((r) => r.slice());
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += m[i][j] * m[i][j];
    if (off < 1e-24) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(m[p][q]) < 1e-30) continue;
        const theta = (m[q][q] - m[p][p]) / (2 * m[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const mkp = m[k][p];
          const mkq = m[k][q];
          m[k][p] = c * mkp - s * mkq;
          m[k][q] = s * mkp + c * mkq;
        }
        for (let k = 0; k < n; k++) {
          const mpk = m[p][k];
          const mqk = m[q][k];
          m[p][k] = c * mpk - s * mqk;
          m[q][k] = s * mpk + c * mqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i < n; i++) if (m[i][i] > m[best][best]) best = i;
  return [v[0][best], v[1][best], v[2][best], v[3][best]];
}

/** The rigid motion (rotation `q`, translation `t`) that takes the points `from` onto `to` in the least-squares sense: to ~ q from + t. */
export function fitRigid(from: readonly THREE.Vector3[], to: readonly THREE.Vector3[]): { q: THREE.Quaternion; t: THREE.Vector3 } {
  const n = Math.min(from.length, to.length);
  const cf = new THREE.Vector3();
  const ct = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    cf.add(from[i]);
    ct.add(to[i]);
  }
  if (n > 0) {
    cf.multiplyScalar(1 / n);
    ct.multiplyScalar(1 / n);
  }
  const q = new THREE.Quaternion();
  if (n >= 2) {
    let sxx = 0, sxy = 0, sxz = 0, syx = 0, syy = 0, syz = 0, szx = 0, szy = 0, szz = 0;
    for (let i = 0; i < n; i++) {
      const f = from[i].clone().sub(cf);
      const g = to[i].clone().sub(ct);
      sxx += f.x * g.x; sxy += f.x * g.y; sxz += f.x * g.z;
      syx += f.y * g.x; syy += f.y * g.y; syz += f.y * g.z;
      szx += f.z * g.x; szy += f.z * g.y; szz += f.z * g.z;
    }
    const N = [
      [sxx + syy + szz, syz - szy, szx - sxz, sxy - syx],
      [syz - szy, sxx - syy - szz, sxy + syx, szx + sxz],
      [szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy],
      [sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz],
    ];
    const e = largestEigenvector4(N);
    q.set(e[1], e[2], e[3], e[0]).normalize();
  }
  const t = ct.clone().sub(cf.clone().applyQuaternion(q));
  return { q, t };
}

// ---------------------------------------------------------------------------------------------------- the event

/** What the scene draws of an event in progress: atoms, the bonds between them, and the electrons on their way. */
export interface DrawableEvent {
  /** 0..1 along the morph, when the event has one (the charge labels switch from the old to the new charge half way). */
  readonly progress?: number;
  readonly atoms: EventAtom[];
  readonly bonds: EventBond[];
  linesOf(e: EventBond, out?: Array<{ slot: number; weight: number; thin: boolean }>): Array<{ slot: number; weight: number; thin: boolean }>;
  electronSprites(out?: Array<{ pos: THREE.Vector3; strength: number }>): Array<{ pos: THREE.Vector3; strength: number }>;
}

export interface EventAtom {
  el: string;
  colour: THREE.Color;
  rBall: number;
  rVdw: number;
  pos: THREE.Vector3;
  /** Reactant molecule the atom started in. */
  mol: number;
  /** 0..1: brightening of an atom whose bonds change (peaks mid-morph). */
  glow: number;
  /** Drawn size factor (1 = full; a generic swap shrinks the reactants and grows the products). */
  scale: number;
  /** Formal charge before and after (the label changes along the morph). */
  chargeFrom: number;
  chargeTo: number;
}

export interface EventBond {
  a: number;
  b: number;
  /** Bond order among the reactants / the products (0 = the bond is not there). */
  rOrder: number;
  pOrder: number;
  rArom: boolean;
  pArom: boolean;
  coordinate: boolean;
  /** Rest length among the reactants and the products, A. */
  lr: number;
  lp: number;
  /** A neighbour of an end that is not on the bond axis (fixes the plane of multiple bonds), or -1. */
  ref: number;
}

export type EventPhase = 'approach' | 'morph' | 'done';

export const EVENT_TIMING = { approach: 1.0, morph: 1.6 } as const;
/** The approach takes longer when the molecules start far apart (A/s at most); never less than `EVENT_TIMING.approach`. */
const APPROACH_SPEED = 14;
const APPROACH_MAX = 2.6;
/** Distance between the reacting atoms of two docked molecules, A. */
const DOCK_GAP = 2.4;
const DOCK_RING = 1.7;
/** Distance between the redox centres of an electron transfer with no bond formed, A (outer sphere: a solvation shell between). */
const OUTER_SPHERE_GAP = 4.4;

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Number of lines a bond is drawn with (an aromatic bond: one plus a thinner second). */
export function bondLines(order: number): number {
  return order <= 0 ? 0 : Math.ceil(order - 1e-9);
}

export class ReactionEvent implements DrawableEvent {
  public readonly atoms: EventAtom[] = [];
  public readonly bonds: EventBond[] = [];
  public phase: EventPhase = 'approach';
  public elapsed = 0;
  /** Progress of the morph, 0..1 (0 during the approach). */
  public progress = 0;
  public readonly nMols: number;
  /** Seconds the approach takes (0 for a single molecule). */
  public approachTime = 0;
  /** Smallest distance between atoms of different docked molecules (contact atoms excepted), in units of the van der Waals sums. */
  public dockScore = 0;
  /** Atoms whose bonds change (the reacting atoms). */
  public readonly reacting: ReadonlySet<number>;
  /** Index of the first atom of each reactant molecule. */
  private offsets: number[] = [];
  private local: THREE.Vector3[] = []; // atom coordinates relative to the molecule's centroid
  private start: Array<{ pos: THREE.Vector3; quat: THREE.Quaternion }>;
  private dock: Array<{ pos: THREE.Vector3; quat: THREE.Quaternion }> = [];
  private x0: THREE.Vector3[] = []; // docked positions
  private target: THREE.Vector3[] = []; // product positions, by reactant atom index
  private prodPose: Array<{ q: THREE.Quaternion; t: THREE.Vector3 }> = [];
  private adj: number[][] = [];
  private bonded: Set<number>;
  private cx = new THREE.Vector3();
  private anchor: THREE.Vector3 | null;
  private movingAtoms = new Set<number>();
  /** Atoms that form a bond with another reactant molecule: they are meant to meet. */
  private contact = new Set<number>();
  /** Electron hops (global atom indices of the redox centres) and the atoms they touch. */
  private hops: Array<{ from: number; to: number; count: number }> = [];
  private hopAtoms = new Set<number>();
  private readonly nAtoms: number;

  /**
   * `start[m]` is the world pose of reactant molecule `m` (its rigid body: world = pos + quat * (structure coordinates minus the
   * structure's centroid)).
   */
  constructor(
    public readonly spec: EventSpec,
    start: ReadonlyArray<{ pos: THREE.Vector3; quat: THREE.Quaternion }>,
    /**
     * `anchor`: the reactants meet at this point instead of between where they are (a reaction at a surface: they meet just above
     * the electrode); a single reactant then also travels there.
     */
    opts: { anchor?: THREE.Vector3 } = {},
  ) {
    this.anchor = opts.anchor ? opts.anchor.clone() : null;
    this.nMols = spec.reactants.length;
    this.start = start.map((s) => ({ pos: s.pos.clone(), quat: s.quat.clone() }));
    // atoms of the reactants, in the order of the molecules
    for (const [m, st] of spec.reactants.entries()) {
      this.offsets.push(this.atoms.length);
      const c = new THREE.Vector3();
      for (const a of st.atoms) c.add(new THREE.Vector3(a.x, a.y, a.z));
      if (st.atoms.length > 0) c.multiplyScalar(1 / st.atoms.length);
      for (const a of st.atoms) {
        const [, vdw, hex] = elementView(a.el);
        this.local.push(new THREE.Vector3(a.x, a.y, a.z).sub(c));
        this.atoms.push({ el: a.el, colour: new THREE.Color(hex), rBall: Math.max(0.3, BALL_FRACTION * vdw), rVdw: vdw, pos: new THREE.Vector3(), mol: m, glow: 0, scale: 1, chargeFrom: a.charge, chargeTo: a.charge });
      }
    }
    this.nAtoms = this.atoms.length;
    // where each reactant atom ends up
    const prodAtom: Array<[number, number]> = new Array(this.nAtoms);
    spec.atomMap.forEach((row, p) =>
      row.forEach((o, j) => {
        const g = this.offsets[o[0]] + o[1];
        prodAtom[g] = [p, j];
        this.atoms[g].chargeTo = spec.products[p].atoms[j].charge;
      }),
    );
    // bonds: the union of the reactants' bonds and the products' bonds seen through the atom map
    const byKey = new Map<string, EventBond>();
    const key = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);
    for (const [m, st] of spec.reactants.entries()) {
      for (const b of st.bonds) {
        const a = this.offsets[m] + b.a;
        const c = this.offsets[m] + b.b;
        byKey.set(key(a, c), { a: Math.min(a, c), b: Math.max(a, c), rOrder: b.order, pOrder: 0, rArom: b.aromatic, pArom: false, coordinate: b.coordinate, lr: this.localDist(a, c), lp: 0, ref: -1 });
      }
    }
    spec.atomMap.forEach((row, p) => {
      const st = spec.products[p];
      for (const b of st.bonds) {
        const a = this.offsets[row[b.a][0]] + row[b.a][1];
        const c = this.offsets[row[b.b][0]] + row[b.b][1];
        const pa = st.atoms[b.a];
        const pb = st.atoms[b.b];
        const len = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
        const k = key(a, c);
        const e = byKey.get(k);
        if (e) {
          e.pOrder = b.order;
          e.pArom = b.aromatic;
          e.lp = len;
          e.coordinate = e.coordinate && b.coordinate;
        } else {
          byKey.set(k, { a: Math.min(a, c), b: Math.max(a, c), rOrder: 0, pOrder: b.order, rArom: false, pArom: b.aromatic, coordinate: b.coordinate, lr: 0, lp: len, ref: -1 });
        }
      }
    });
    const react = new Set<number>();
    for (const e of byKey.values()) {
      // a bond that is only on one side stretches to 1.7 x its length on the other side's scale
      if (e.lr === 0) e.lr = e.lp * 1.7;
      if (e.lp === 0) e.lp = e.lr * 1.7;
      if (e.rOrder !== e.pOrder || e.rArom !== e.pArom) {
        react.add(e.a);
        react.add(e.b);
      }
      this.bonds.push(e);
    }
    this.reacting = react;
    this.adj = this.atoms.map(() => []);
    for (const e of this.bonds) {
      this.adj[e.a].push(e.b);
      this.adj[e.b].push(e.a);
    }
    this.bonded = new Set(this.bonds.map((e) => e.a * this.nAtoms + e.b));
    for (const e of this.bonds) {
      for (const [end, other] of [[e.a, e.b], [e.b, e.a]] as const) {
        if (e.ref >= 0) break;
        for (const k of this.adj[end]) {
          if (k === other) continue;
          const d = this.local[other].clone().sub(this.local[end]);
          const t = this.local[k].clone().sub(this.local[end]);
          if (d.cross(t).lengthSq() > 1e-3) {
            e.ref = k;
            break;
          }
        }
      }
    }
    for (const m of spec.movingH) {
      this.movingAtoms.add(this.offsets[m.from[0]] + m.from[1]);
    }
    for (const h of spec.electronHops ?? []) {
      const from = this.offsets[h.from[0]] + h.from[1];
      const to = this.offsets[h.to[0]] + h.to[1];
      if (from >= this.nAtoms || to >= this.nAtoms) continue;
      this.hops.push({ from, to, count: Math.max(1, h.count) });
      this.hopAtoms.add(from);
      this.hopAtoms.add(to);
    }
    for (const e of this.bonds) {
      if (e.rOrder === 0 && e.pOrder > 0 && this.atoms[e.a].mol !== this.atoms[e.b].mol) {
        this.contact.add(e.a);
        this.contact.add(e.b);
      }
    }
    this.planDock();
    const approaches = this.nMols >= 2 || this.anchor !== null;
    if (approaches) {
      let travel = 0;
      for (let m = 0; m < this.nMols; m++) travel = Math.max(travel, this.start[m].pos.distanceTo(this.dock[m].pos));
      this.approachTime = Math.min(APPROACH_MAX, Math.max(EVENT_TIMING.approach, travel / APPROACH_SPEED));
    } else {
      // nothing to bring together: the morph starts where the molecule is
      this.phase = 'morph';
    }
    this.placeAtoms(approaches ? 0 : 1);
    if (this.phase === 'morph') this.beginMorph();
  }

  private localDist(a: number, b: number): number {
    return this.local[a].distanceTo(this.local[b]);
  }

  // ------------------------------------------------------------------------------------------ docking
  /** Centroid (molecule frame) of the atoms of molecule `m` that react, heavy atoms preferred; null if none. */
  private reactingCentre(m: number): THREE.Vector3 | null {
    const lo = this.offsets[m];
    const hi = lo + this.spec.reactants[m].atoms.length;
    for (const heavyOnly of [true, false]) {
      const c = new THREE.Vector3();
      let n = 0;
      for (let i = lo; i < hi; i++) {
        if (!this.reacting.has(i) && !this.hopAtoms.has(i) && !(this.movingAtoms.has(i) && !heavyOnly)) continue;
        if (heavyOnly && this.atoms[i].el === 'H') continue;
        c.add(this.local[i]);
        n++;
      }
      if (n > 0) return c.multiplyScalar(1 / n);
    }
    return null;
  }

  /** The atoms the molecule `m` offers for a bond that forms with another reactant molecule (heavy ones preferred), else its reacting centre. */
  private contactSite(m: number): THREE.Vector3 | null {
    const lo = this.offsets[m];
    const hi = lo + this.spec.reactants[m].atoms.length;
    const found: number[] = [];
    for (const e of this.bonds) {
      if (e.rOrder !== 0 || e.pOrder <= 0 || this.atoms[e.a].mol === this.atoms[e.b].mol) continue;
      for (const i of [e.a, e.b]) if (i >= lo && i < hi) found.push(i);
    }
    const heavy = found.filter((i) => this.atoms[i].el !== 'H');
    const use = heavy.length > 0 ? heavy : found;
    if (use.length === 0) return this.reactingCentre(m);
    const c = new THREE.Vector3();
    for (const i of use) c.add(this.local[i]);
    return c.multiplyScalar(1 / use.length);
  }

  /** World positions of the atoms of molecule `m` in the pose (pos, quat). */
  private worldAtoms(m: number, pos: THREE.Vector3, quat: THREE.Quaternion): THREE.Vector3[] {
    const lo = this.offsets[m];
    return this.spec.reactants[m].atoms.map((_, k) => this.local[lo + k].clone().applyQuaternion(quat).add(pos));
  }

  /** Smallest distance between two sets of atoms, in units of the sum of their van der Waals radii (the contact atoms are left out). */
  private clearance(a: THREE.Vector3[], ma: number, b: THREE.Vector3[], mb: number): number {
    let best = Infinity;
    const la = this.offsets[ma];
    const lb = this.offsets[mb];
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        if (this.contact.has(la + i) && this.contact.has(lb + j)) continue;
        const d = a[i].distanceTo(b[j]) / (this.atoms[la + i].rVdw + this.atoms[lb + j].rVdw);
        if (d < best) best = d;
      }
    }
    return best;
  }

  private planDock() {
    const n = this.nMols;
    const centre = new THREE.Vector3();
    for (const s of this.start) centre.add(s.pos);
    if (n > 0) centre.multiplyScalar(1 / n);
    if (this.anchor) centre.copy(this.anchor);
    this.cx.copy(centre);
    if (n < 2) {
      // nothing to bring together: the morph starts where the molecule is (or at the anchor)
      for (const s of this.start) this.dock.push({ pos: this.anchor ? this.anchor.clone() : s.pos.clone(), quat: s.quat.clone() });
      return;
    }
    const dirs: THREE.Vector3[] = [];
    if (n === 2) {
      const u = this.start[1].pos.clone().sub(this.start[0].pos);
      if (u.lengthSq() < 1e-6) u.set(1, 0, 0);
      u.normalize();
      dirs.push(u.clone().negate(), u);
    } else {
      for (let m = 0; m < n; m++) {
        const d = this.start[m].pos.clone().sub(centre);
        if (d.lengthSq() < 1e-6) d.set(Math.cos((2 * Math.PI * m) / n), 0, Math.sin((2 * Math.PI * m) / n));
        dirs.push(d.normalize());
      }
    }
    // the atoms that meet: their distance at docking is a little more than the bond they are about to form
    let gap = DOCK_GAP;
    let forming = false;
    for (const e of this.bonds) {
      if (e.rOrder === 0 && e.pOrder > 0 && this.atoms[e.a].mol !== this.atoms[e.b].mol) {
        gap = Math.min(3.0, Math.max(1.9, e.lp + 1.0));
        forming = true;
        break;
      }
    }
    // an electron transfer without a new bond is an outer-sphere encounter: the partners meet with their solvation shells between
    if (!forming && this.hops.length > 0) gap = OUTER_SPHERE_GAP;
    // a molecule that forms a bond with every other one (a metal ion taking ligands) sits in the middle and the others around it
    let hub = -1;
    if (n >= 3) {
      const links = Array.from({ length: n }, () => new Set<number>());
      for (const e of this.bonds) {
        const ma = this.atoms[e.a].mol;
        const mb = this.atoms[e.b].mol;
        if (e.rOrder === 0 && e.pOrder > 0 && ma !== mb) {
          links[ma].add(mb);
          links[mb].add(ma);
        }
      }
      for (let m = 0; m < n; m++) if (links[m].size === n - 1) hub = m;
    }
    if (hub >= 0) {
      // the others take evenly spread directions (a Fibonacci sphere), each the free direction closest to where it came from
      const k = n - 1;
      const spokes: THREE.Vector3[] = [];
      for (let i = 0; i < k; i++) {
        const y = k === 1 ? 0 : 1 - (2 * i) / (k - 1);
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const phi = i * 2.399963229728653;
        spokes.push(new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r));
      }
      const left = new Set(spokes.keys());
      const others = [...Array(n).keys()].filter((m) => m !== hub);
      const from = (m: number) => this.start[m].pos.clone().sub(this.start[hub].pos).normalize();
      // the molecule with the most clear-cut preference chooses first
      others.sort((a, b) => Math.max(...[...left].map((i) => spokes[i].dot(from(b)))) - Math.max(...[...left].map((i) => spokes[i].dot(from(a)))));
      for (const m of others) {
        let bi = -1;
        let bd = -Infinity;
        for (const i of left) {
          const d = spokes[i].dot(from(m));
          if (d > bd) {
            bd = d;
            bi = i;
          }
        }
        left.delete(bi);
        dirs[m] = spokes[bi].clone();
      }
      dirs[hub] = new THREE.Vector3(1, 0, 0);
    }
    const sites = Array.from({ length: n }, (_, m) => this.contactSite(m));
    const ROLLS = 12;
    /** The orientations tried for molecule `m`: the one that faces its reacting side to the middle (with rolls about that line), then others. */
    const candidates = (m: number, extra: number): THREE.Quaternion[] => {
      const site = sites[m] ?? new THREE.Vector3();
      const q0 = this.start[m].quat.clone();
      if (site.length() > 0.2) {
        const cur = site.clone().normalize().applyQuaternion(q0);
        q0.premultiply(new THREE.Quaternion().setFromUnitVectors(cur, dirs[m].clone().negate()));
      }
      const out: THREE.Quaternion[] = [];
      for (let k = 0; k < ROLLS; k++) out.push(q0.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(dirs[m], (2 * Math.PI * k) / ROLLS)));
      let seed = 12345 + m * 977;
      const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
      for (let k = 0; k < extra; k++) out.push(new THREE.Quaternion(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize());
      return out;
    };
    const turn = (m: number, q: THREE.Quaternion) => (0.02 * (2 * Math.acos(Math.min(1, Math.abs(q.dot(this.start[m].quat)))))) / Math.PI;
    const spotOf = (m: number) => (hub >= 0 ? (m === hub ? centre.clone() : centre.clone().addScaledVector(dirs[m], gap)) : centre.clone().addScaledVector(dirs[m], n === 2 ? gap / 2 : DOCK_RING));
    const poseOf = (m: number, q: THREE.Quaternion) => spotOf(m).sub((sites[m] ?? new THREE.Vector3()).clone().applyQuaternion(q));

    if (n === 2) {
      // the two orientations together: what matters is the room between the molecules, whichever way each one turns
      const big = this.spec.reactants[0].atoms.length * this.spec.reactants[1].atoms.length > 900;
      const extra = big ? 12 : 48;
      const c0 = candidates(0, extra).map((q) => ({ q, pos: poseOf(0, q) }));
      const c1 = candidates(1, extra).map((q) => ({ q, pos: poseOf(1, q) }));
      const w0 = c0.map((c) => this.worldAtoms(0, c.pos, c.q));
      const w1 = c1.map((c) => this.worldAtoms(1, c.pos, c.q));
      let bi = 0;
      let bj = 0;
      let bs = -Infinity;
      for (let i = 0; i < c0.length; i++) {
        for (let j = 0; j < c1.length; j++) {
          const score = this.clearance(w0[i], 0, w1[j], 1) - turn(0, c0[i].q) - turn(1, c1[j].q);
          if (score > bs + 1e-9) {
            bs = score;
            bi = i;
            bj = j;
          }
        }
      }
      this.dock.push({ pos: c0[bi].pos, quat: c0[bi].q }, { pos: c1[bj].pos, quat: c1[bj].q });
      this.dockScore = bs;
      return;
    }
    // three or more: placed one after the other, each in the orientation that leaves the most room
    const placed: Array<{ m: number; atoms: THREE.Vector3[] }> = [];
    let worst = Infinity;
    for (let m = 0; m < n; m++) {
      let best = { q: this.start[m].quat.clone(), pos: poseOf(m, this.start[m].quat), score: -Infinity };
      for (const q of candidates(m, placed.length > 0 ? 96 : 0)) {
        const pos = poseOf(m, q);
        const atoms = this.worldAtoms(m, pos, q);
        let score = placed.length === 0 ? 0 : Infinity;
        for (const o of placed) score = Math.min(score, this.clearance(atoms, m, o.atoms, o.m));
        score -= turn(m, q);
        if (score > best.score + 1e-9) best = { q, pos, score };
      }
      if (placed.length > 0) worst = Math.min(worst, best.score);
      this.dock.push({ pos: best.pos, quat: best.q });
      placed.push({ m, atoms: this.worldAtoms(m, best.pos, best.q) });
    }
    this.dockScore = worst;
  }

  /** Writes the atom positions of the rigid motion `u` (0 = the start poses, 1 = the docked poses). */
  private placeAtoms(u: number) {
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    for (let m = 0; m < this.nMols; m++) {
      const s = this.start[m];
      const d = this.dock[m];
      q.copy(s.quat).slerp(d.quat, u);
      p.copy(s.pos).lerp(d.pos, u);
      const lo = this.offsets[m];
      for (let i = lo; i < lo + this.spec.reactants[m].atoms.length; i++) this.atoms[i].pos.copy(this.local[i]).applyQuaternion(q).add(p);
    }
  }

  // ------------------------------------------------------------------------------------------ morph
  private beginMorph() {
    this.x0 = this.atoms.map((a) => a.pos.clone());
    this.target = new Array(this.nAtoms);
    this.prodPose = [];
    this.spec.atomMap.forEach((row, p) => {
      const st = this.spec.products[p];
      const c = new THREE.Vector3();
      for (const a of st.atoms) c.add(new THREE.Vector3(a.x, a.y, a.z));
      if (st.atoms.length > 0) c.multiplyScalar(1 / st.atoms.length);
      const from = st.atoms.map((a) => new THREE.Vector3(a.x, a.y, a.z).sub(c));
      const to = row.map((o) => this.x0[this.offsets[o[0]] + o[1]]);
      const fit = fitRigid(from, to);
      this.prodPose.push(fit);
      row.forEach((o, j) => {
        this.target[this.offsets[o[0]] + o[1]] = from[j].clone().applyQuaternion(fit.q).add(fit.t);
      });
    });
    this.separateProducts();
    this.phase = 'morph';
    this.progress = 0;
  }

  /**
   * Product molecules that were one cluster (a split ester, a proton on its way off) are fitted to the docked geometry one by one
   * and can overlap there. They are pushed apart along the line between their centres until no two atoms of different products are
   * closer than 0.9 of the van der Waals sum, so the release does not hand over interpenetrating bodies.
   */
  private separateProducts() {
    const np = this.prodPose.length;
    if (np < 2) return;
    const idx = this.spec.atomMap.map((row) => row.map((o) => this.offsets[o[0]] + o[1]));
    const centroid = (p: number) => {
      const c = new THREE.Vector3();
      for (const i of idx[p]) c.add(this.target[i]);
      return c.multiplyScalar(1 / Math.max(1, idx[p].length));
    };
    const clear = (p: number, q: number) => {
      let best = Infinity;
      for (const i of idx[p]) for (const j of idx[q]) best = Math.min(best, this.target[i].distanceTo(this.target[j]) / (this.atoms[i].rVdw + this.atoms[j].rVdw));
      return best;
    };
    const shift = (p: number, d: THREE.Vector3) => {
      for (const i of idx[p]) this.target[i].add(d);
      this.prodPose[p].t.add(d);
    };
    const dir = new THREE.Vector3();
    for (let iter = 0; iter < 80; iter++) {
      let moved = false;
      for (let p = 0; p < np; p++) {
        for (let q = p + 1; q < np; q++) {
          if (clear(p, q) >= 0.9) continue;
          dir.copy(centroid(q)).sub(centroid(p));
          if (dir.lengthSq() < 1e-6) dir.set(Math.cos(p + 1), Math.sin(q + 2), 0.5);
          dir.normalize().multiplyScalar(0.12);
          shift(p, dir.clone().negate());
          shift(q, dir);
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  /** Advances the event by `dt` seconds of display time. */
  public step(dt: number) {
    if (this.finished || !(dt > 0)) return;
    let left = Math.min(dt, 0.5);
    while (left > 1e-9 && !this.finished) {
      const h = Math.min(left, 1 / 40);
      left -= h;
      this.elapsed += h;
      if (this.phase === 'approach') {
        const u = this.elapsed / this.approachTime;
        this.placeAtoms(ease(u));
        if (u >= 1) this.beginMorph();
      } else {
        this.morphStep(h);
      }
    }
  }

  private morphStep(h: number) {
    const morphT = this.elapsed - this.approachTime;
    const u = Math.min(1, Math.max(0, morphT / EVENT_TIMING.morph));
    const s = smooth(u);
    this.progress = u;
    const n = this.nAtoms;
    const guide = (i: number, out: THREE.Vector3) => out.copy(this.x0[i]).lerp(this.target[i], s);
    const g = new THREE.Vector3();
    const force: THREE.Vector3[] = this.atoms.map(() => new THREE.Vector3());
    // bond springs toward the blended rest length; weight follows how much of the bond exists at this stage
    for (const e of this.bonds) {
      const wr = e.rOrder > 0 ? (e.pOrder > 0 ? 1 : 1 - s) : 0;
      const wp = e.pOrder > 0 ? (e.rOrder > 0 ? 0 : s) : 0;
      const w = Math.min(1, wr + wp);
      if (w < 0.05) continue;
      const rest = e.lr + (e.lp - e.lr) * s;
      const d = this.atoms[e.b].pos.clone().sub(this.atoms[e.a].pos);
      const len = d.length() || 1e-6;
      const corr = d.multiplyScalar(((len - rest) / len) * 0.5 * w);
      force[e.a].add(corr);
      force[e.b].sub(corr);
    }
    // soft repulsion between atoms that are not bonded to each other on either side
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (this.bonded.has(i * n + j)) continue;
        const a = this.atoms[i];
        const b = this.atoms[j];
        const min = 0.72 * (a.rVdw + b.rVdw);
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= min * min) continue;
        // atoms that react are meant to get close
        const scale = this.reacting.has(i) && this.reacting.has(j) ? 0.15 : 0.5;
        const d = Math.sqrt(d2) || 1e-6;
        const push = ((min - d) / d) * scale * 0.5;
        force[i].set(force[i].x - dx * push, force[i].y - dy * push, force[i].z - dz * push);
        force[j].set(force[j].x + dx * push, force[j].y + dy * push, force[j].z + dz * push);
      }
    }
    const alpha = Math.max(1 - Math.exp(-14 * h), smooth((u - 0.82) / 0.18));
    const glow = Math.pow(Math.sin(Math.PI * Math.min(1, u)), 0.7);
    for (let i = 0; i < n; i++) {
      guide(i, g);
      const a = this.atoms[i];
      // relax toward the guide, with the corrections of the bond springs and the repulsion
      a.pos.x += alpha * (g.x - a.pos.x) + force[i].x * (1 - alpha);
      a.pos.y += alpha * (g.y - a.pos.y) + force[i].y * (1 - alpha);
      a.pos.z += alpha * (g.z - a.pos.z) + force[i].z * (1 - alpha);
      a.glow = this.reacting.has(i) || this.movingAtoms.has(i) || this.hopAtoms.has(i) ? glow : 0;
    }
    if (u >= 1) {
      for (let i = 0; i < n; i++) {
        this.atoms[i].pos.copy(this.target[i]);
        this.atoms[i].glow = 0;
      }
      this.phase = 'done';
    }
  }

  public get finished(): boolean {
    return this.phase === 'done';
  }

  /** Centre of the cluster now. */
  public centre(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, 0, 0);
    for (const a of this.atoms) out.add(a.pos);
    return this.nAtoms > 0 ? out.multiplyScalar(1 / this.nAtoms) : out;
  }

  /** Poses of the product molecules as rigid bodies once the morph is done: world = pos + quat * (coordinates minus centroid). */
  public productPoses(): Array<{ pos: THREE.Vector3; quat: THREE.Quaternion }> {
    return this.prodPose.map((p) => ({ pos: p.t.clone(), quat: p.q.clone() }));
  }

  /**
   * The electrons that are on their way now (an electron transfer): each hop sends up to three glowing points along an arc from
   * the atom that gives them to the atom that takes them, during the middle of the morph. `strength` peaks half way.
   */
  public electronSprites(out: Array<{ pos: THREE.Vector3; strength: number }> = []): Array<{ pos: THREE.Vector3; strength: number }> {
    out.length = 0;
    if (this.hops.length === 0 || this.phase !== 'morph') return out;
    for (const h of this.hops) {
      const a = this.atoms[h.from].pos;
      const b = this.atoms[h.to].pos;
      const n = Math.min(3, h.count);
      for (let k = 0; k < n; k++) {
        const w = (this.progress - 0.15 - 0.1 * k) / 0.45;
        if (w <= 0 || w >= 1) continue;
        const s = ease(w);
        const pos = a.clone().lerp(b, s);
        pos.y += Math.sin(Math.PI * s) * 0.2 * a.distanceTo(b);
        out.push({ pos, strength: Math.sin(Math.PI * w) });
      }
    }
    return out;
  }

  /** Lines of a bond now: for every line, its offset slot (-1, 0, 1 times the spacing) and a radius weight in 0..1. */
  public linesOf(e: EventBond, out: Array<{ slot: number; weight: number; thin: boolean }> = []): Array<{ slot: number; weight: number; thin: boolean }> {
    out.length = 0;
    const s = this.phase === 'approach' ? 0 : smooth(this.progress);
    const lr = bondLines(e.rOrder);
    const lp = bondLines(e.pOrder);
    const n = Math.max(lr, lp);
    const arom = (e.rArom && lr > 0) || (e.pArom && lp > 0);
    for (let k = 0; k < n; k++) {
      const w = (k < lr ? 1 - s : 0) + (k < lp ? s : 0);
      if (w < 0.04) continue;
      const slot = n === 1 ? 0 : n === 2 ? (arom ? (k === 0 ? 0 : 2) : k === 0 ? -1 : 1) : k - 1;
      out.push({ slot, weight: Math.min(1, w), thin: arom && k === 1 });
    }
    return out;
  }
}
