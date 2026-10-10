// Molecular viewer: events at a surface and the generic swap (three.js maths only, no renderer; tests/micro_surface_events.mjs).
//
// A `SurfaceEvent` is the lattice part of a reaction at a solid (docs/plans/reaction-viewer-plan.md, 4.5 and 5.5): dissolved ions
// glide down to vacant sites of the slab and become its occupants (precipitation, plating, cementation), occupants lift off and
// become dissolved or gas species (dissolution, corrosion, an anode), and electrons run between the places they leave and arrive.
// The dissolved and gas species that react next to the surface (H+ turning into H2 on a cathode) are a `ReactionEvent` morph that
// the view runs beside it. Nothing here is a mechanism: no hydration shell is shed, no kink-site search; an ion goes to a free
// place that crystal growth would allow (`Slab.vacancies`), and one leaves from a place nothing rests on (`Slab.exposed`).
//
// A `SwapEvent` is the fallback for a reaction the engine reports without an atom map: the reactants shrink away and the
// products grow in at the same spot (the plan's kind "other"), labelled as such.
import * as THREE from 'three';
import type { Structure3dData } from '../types/sim';
import { BALL_FRACTION, elementView, type MolShape } from './micro_shape';
import type { Body, BodyRole } from './micro_motion';
import type { Slab } from './micro_slab';
import { bondLines, type DrawableEvent, type EventAtom, type EventBond } from './micro_morph';

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Height above a site where an arriving ion waits before it goes in, A. */
const HOVER = 4.5;
/** Speed of an arriving ion, A/s; the glide lasts at least `JOIN_MIN` and at most `JOIN_MAX` seconds. */
const JOIN_SPEED = 11;
const JOIN_MIN = 1.1;
const JOIN_MAX = 3.0;
/** Time after the start at which a leaving occupant lifts off, s (the stagger between the ions of a unit is added). */
const LIFT_AT = 0.45;
/** Seconds the event lasts after the last ion has docked or lifted (the surface settles, the electrons arrive). */
const TAIL = 0.35;

export interface JoinPlan {
  /** The dissolved ion that goes in: taken over by the event (state `docking`). */
  body: Body;
  siteId: number;
  /** What the site holds afterwards (Cu(s) for a Cu2+ that plates). */
  occupantSpecies: string;
  occupantShape: MolShape;
}

export interface LeavePlan {
  siteId: number;
  /** The dissolved / gas species the occupant becomes (one per atom or ion that goes into solution). */
  becomes: Array<{ species: string; shape: MolShape; role: BodyRole; gas: boolean }>;
}

/** Electrons that run from one place to another during the event; `from` / `to` are read each frame (a body moves). */
export interface ElectronPath {
  from: () => THREE.Vector3 | null;
  to: () => THREE.Vector3 | null;
  count: number;
}

export interface SurfaceHooks {
  /** An ion has reached its site: the view takes it out of the box's motion (the slab already holds the new occupant). */
  onDock(join: JoinPlan): void;
  /** An occupant lifted off the slab: the view puts what it became into the box at `pos`. */
  onLift(leave: LeavePlan, pos: THREE.Vector3): void;
}

interface JoinState {
  plan: JoinPlan;
  from: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  toQuat: THREE.Quaternion;
  duration: number;
  done: boolean;
}

export class SurfaceEvent implements DrawableEvent {
  public readonly atoms: EventAtom[] = [];
  public readonly bonds: EventBond[] = [];
  public elapsed = 0;
  private joins: JoinState[];
  private leaves: Array<{ plan: LeavePlan; at: number; done: boolean }>;
  private end: number;
  private windows: Array<{ path: ElectronPath; t0: number; t1: number }> = [];
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor(
    public readonly slab: Slab,
    joins: JoinPlan[],
    leaves: LeavePlan[],
    electrons: ElectronPath[],
    private hooks: SurfaceHooks,
  ) {
    this.joins = joins.map((plan) => {
      const target = slab.siteWorld(plan.siteId);
      const duration = THREE.MathUtils.clamp(plan.body.pos.distanceTo(target) / JOIN_SPEED, JOIN_MIN, JOIN_MAX);
      plan.body.state = 'docking';
      plan.body.vel.set(0, 0, 0);
      return { plan, from: plan.body.pos.clone(), fromQuat: plan.body.quat.clone(), toQuat: slab.randomOrientation(plan.occupantShape), duration, done: false };
    });
    this.leaves = leaves.map((plan, i) => ({ plan, at: LIFT_AT + 0.12 * i, done: false }));
    const joinEnd = Math.max(0, ...this.joins.map((j) => j.duration));
    const leaveEnd = Math.max(0, ...this.leaves.map((l) => l.at + 0.2));
    this.end = Math.max(joinEnd, leaveEnd) + TAIL;
    // the electrons run while the ions are about to dock (reduction) or after they have lifted (oxidation)
    const t0 = this.joins.length > 0 ? Math.max(0.3, joinEnd * 0.5) : LIFT_AT;
    const t1 = Math.max(t0 + 0.8, this.joins.length > 0 ? joinEnd : leaveEnd + 0.9);
    this.end = Math.max(this.end, t1 + 0.1);
    for (const p of electrons) this.windows.push({ path: p, t0, t1 });
  }

  public get finished(): boolean {
    return this.elapsed >= this.end;
  }

  /** Where the action is: the mean of the sites the event works on. */
  public centre(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, 0, 0);
    const sites = [...this.joins.map((j) => j.plan.siteId), ...this.leaves.map((l) => l.plan.siteId)];
    for (const s of sites) out.add(this.slab.siteWorld(s, this.tmpA));
    return sites.length > 0 ? out.multiplyScalar(1 / sites.length) : out.copy(this.slab.origin);
  }

  public step(dt: number) {
    if (this.finished || !(dt > 0)) return;
    this.elapsed += Math.min(dt, 0.25);
    for (const j of this.joins) {
      if (j.done) continue;
      const u = Math.min(1, this.elapsed / j.duration);
      const site = this.slab.siteWorld(j.plan.siteId, this.tmpA);
      const hover = this.tmpB.copy(site).add(new THREE.Vector3(0, HOVER, 0));
      const b = j.plan.body;
      // 0..0.7: to the point above the site; 0.7..1: down into it
      if (u < 0.7) b.pos.copy(j.from).lerp(hover, ease(u / 0.7));
      else b.pos.copy(hover).lerp(site, ease((u - 0.7) / 0.3));
      b.quat.copy(j.fromQuat).slerp(j.toQuat, ease(u));
      if (u >= 1) {
        j.done = true;
        this.slab.place(j.plan.siteId, j.plan.occupantSpecies, j.plan.occupantShape, j.toQuat);
        this.slab.release([j.plan.siteId]);
        this.hooks.onDock(j.plan);
      }
    }
    for (const l of this.leaves) {
      if (l.done || this.elapsed < l.at) continue;
      l.done = true;
      const pos = this.slab.siteWorld(l.plan.siteId);
      this.slab.clear(l.plan.siteId);
      this.slab.release([l.plan.siteId]);
      this.hooks.onLift(l.plan, pos);
    }
  }

  /** Releases whatever the event still holds (it is dropped half way: the box was rebuilt, the view closed). */
  public abort() {
    for (const j of this.joins) {
      if (!j.done) {
        this.slab.release([j.plan.siteId]);
        j.plan.body.state = 'in';
      }
    }
    for (const l of this.leaves) if (!l.done) this.slab.release([l.plan.siteId]);
    this.elapsed = this.end;
  }

  public linesOf(): Array<{ slot: number; weight: number; thin: boolean }> {
    return [];
  }

  /** The electrons on their way now: up to three points per path, each on an arc between its two ends. */
  public electronSprites(out: Array<{ pos: THREE.Vector3; strength: number }> = []): Array<{ pos: THREE.Vector3; strength: number }> {
    out.length = 0;
    for (const w of this.windows) {
      if (this.elapsed < w.t0 || this.elapsed > w.t1) continue;
      const a = w.path.from();
      const b = w.path.to();
      if (!a || !b) continue;
      const span = w.t1 - w.t0;
      const n = Math.min(3, Math.max(1, w.path.count));
      for (let k = 0; k < n; k++) {
        const x = (this.elapsed - w.t0 - 0.12 * k * Math.min(1, span)) / (span * 0.7);
        if (x <= 0 || x >= 1) continue;
        const s = ease(x);
        const pos = a.clone().lerp(b, s);
        pos.y += Math.sin(Math.PI * s) * 0.18 * a.distanceTo(b);
        out.push({ pos, strength: Math.sin(Math.PI * x) });
      }
    }
    return out;
  }
}

// ------------------------------------------------------------------------------------------------ generic swap

/** Seconds a swap lasts. */
export const SWAP_TIME = 1.8;

/**
 * A reaction without an atom map drawn honestly as what is known: these molecules are gone and those are there. The reactants
 * (frozen where they were picked up) shrink away; the products grow in around the same spot and are then released as ordinary
 * bodies. No bond or atom is claimed to move from one to the other.
 */
export class SwapEvent implements DrawableEvent {
  public readonly atoms: EventAtom[] = [];
  public readonly bonds: EventBond[] = [];
  public elapsed = 0;
  /** Where each product ends up (world pose of its rigid body). */
  public readonly productPoses: Array<{ pos: THREE.Vector3; quat: THREE.Quaternion }> = [];
  private reactantAtoms: number;
  private centre0 = new THREE.Vector3();

  constructor(reactants: Array<{ shape: MolShape; struct: Structure3dData; pos: THREE.Vector3; quat: THREE.Quaternion }>, products: Array<{ shape: MolShape; struct: Structure3dData }>) {
    for (const r of reactants) this.centre0.add(r.pos);
    if (reactants.length > 0) this.centre0.multiplyScalar(1 / reactants.length);
    const q = new THREE.Quaternion();
    const addMolecule = (shape: MolShape, struct: Structure3dData, pos: THREE.Vector3, quat: THREE.Quaternion, side: 'r' | 'p') => {
      const base = this.atoms.length;
      shape.atoms.forEach((a, i) => {
        const [, vdw, hex] = elementView(a.el);
        const c = struct.atoms[i]?.charge ?? 0;
        this.atoms.push({ el: a.el, colour: new THREE.Color(hex), rBall: Math.max(0.3, BALL_FRACTION * vdw), rVdw: vdw, pos: a.p.clone().applyQuaternion(quat).add(pos), mol: 0, glow: 0, scale: side === 'r' ? 1 : 0, chargeFrom: c, chargeTo: c });
      });
      for (const b of struct.bonds) {
        const len = Math.hypot(struct.atoms[b.a].x - struct.atoms[b.b].x, struct.atoms[b.a].y - struct.atoms[b.b].y, struct.atoms[b.a].z - struct.atoms[b.b].z);
        this.bonds.push({ a: base + b.a, b: base + b.b, rOrder: side === 'r' ? b.order : 0, pOrder: side === 'p' ? b.order : 0, rArom: side === 'r' && b.aromatic, pArom: side === 'p' && b.aromatic, coordinate: b.coordinate, lr: len, lp: len, ref: -1 });
      }
    };
    for (const r of reactants) addMolecule(r.shape, r.struct, r.pos, r.quat, 'r');
    this.reactantAtoms = this.atoms.length;
    // the products stand on a ring around the centre of the reactants, far enough apart not to overlap
    const n = products.length;
    const ring = n <= 1 ? 0 : products.reduce((s, p) => s + p.shape.radius, 0) / n + 0.8;
    products.forEach((p, k) => {
      const ang = (2 * Math.PI * k) / Math.max(1, n);
      const pos = this.centre0.clone().add(new THREE.Vector3(Math.cos(ang) * ring, 0, Math.sin(ang) * ring));
      q.set(Math.sin(k + 1), Math.cos(k * 2 + 1), Math.sin(k * 3 + 2), Math.cos(k + 3)).normalize();
      this.productPoses.push({ pos, quat: q.clone() });
      addMolecule(p.shape, p.struct, pos, q, 'p');
    });
  }

  public get finished(): boolean {
    return this.elapsed >= SWAP_TIME;
  }

  public get progress(): number {
    return Math.min(1, this.elapsed / SWAP_TIME);
  }

  public centre(out = new THREE.Vector3()): THREE.Vector3 {
    return out.copy(this.centre0);
  }

  public step(dt: number) {
    if (this.finished || !(dt > 0)) return;
    this.elapsed += Math.min(dt, 0.25);
    const u = this.progress;
    // the reactants shrink during the first 60 %, the products grow during the last 60 %
    const out = 1 - ease(u / 0.6);
    const into = ease((u - 0.4) / 0.6);
    this.atoms.forEach((a, i) => {
      a.scale = i < this.reactantAtoms ? Math.max(0.001, out) : Math.max(0.001, into);
      a.glow = Math.sin(Math.PI * u) * 0.5;
    });
  }

  public linesOf(e: EventBond, out: Array<{ slot: number; weight: number; thin: boolean }> = []): Array<{ slot: number; weight: number; thin: boolean }> {
    out.length = 0;
    const reactantSide = e.rOrder > 0;
    const w = reactantSide ? 1 - ease(this.progress / 0.6) : ease((this.progress - 0.4) / 0.6);
    const order = reactantSide ? e.rOrder : e.pOrder;
    const arom = reactantSide ? e.rArom : e.pArom;
    const n = bondLines(order);
    for (let k = 0; k < n; k++) {
      if (w < 0.04) continue;
      const slot = n === 1 ? 0 : n === 2 ? (arom ? (k === 0 ? 0 : 2) : k === 0 ? -1 : 1) : k - 1;
      out.push({ slot, weight: Math.min(1, w), thin: arom && k === 1 });
    }
    return out;
  }

  public electronSprites(out: Array<{ pos: THREE.Vector3; strength: number }> = []): Array<{ pos: THREE.Vector3; strength: number }> {
    out.length = 0;
    return out;
  }
}
