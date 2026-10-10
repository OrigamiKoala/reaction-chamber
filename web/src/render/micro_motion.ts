// Molecular viewer: schematic Brownian motion of rigid molecules in a box (three.js maths only, no renderer).
//
// Nothing here is molecular dynamics. Each molecule is a rigid body (the conformer the engine built) whose velocity and
// angular velocity follow an Ornstein-Uhlenbeck process, with a soft repulsion between bodies and reflecting walls. Gas
// phases fly almost straight and bounce. Bodies enter and leave through the walls, so the box follows the vessel's
// composition without molecules popping in and out. Time is slowed: one second on screen stands for far less than a
// nanosecond of real motion at these speeds (the legend of the view says so).
import * as THREE from 'three';
import type { MolShape } from './micro_shape';

export type BodyRole = 'solute' | 'water';
/**
 * `reacting`: owned by a reaction event (`micro_morph.ts`), which draws and moves its atoms; the motion model leaves it alone.
 * `docking`: owned by a surface event (`micro_surface_event.ts`), which moves the whole rigid body to a site of the slab; it is
 * still drawn as a molecule.
 */
export type BodyState = 'in' | 'entering' | 'leaving' | 'reacting' | 'docking';
/** Faces of the box: +x, -x, +y (the free surface of a liquid), -y (the floor, the surface a gas lies over), +z, -z. */
export const FACE_TOP = 2;
export const FACE_BOTTOM = 3;
export type BoxKind = 'liquid' | 'gas';

export interface Body {
  uid: number;
  species: string;
  role: BodyRole;
  shape: MolShape;
  state: BodyState;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
}

/** Tuning constants (angstrom and display seconds). */
export const MOTION = {
  /** Thermal speed scale of a solute in a liquid, A/s of display time (heavier molecules move less). */
  liquidSpeed: 5,
  /** Gas molecules fly this fast. */
  gasSpeed: 22,
  /** Relaxation rate of the velocity, 1/s (liquid: strongly damped; gas: nearly free). */
  liquidDamping: 2.2,
  gasDamping: 0.15,
  /** Rotation: typical angular speed, rad/s. */
  spin: 1.1,
  /** Stiffness of the soft repulsion between bodies, 1/s^2. */
  repel: 40,
  /** Fraction of the summed bounding radii that bodies may overlap before they push. */
  contact: 0.82,
  /** Largest step; longer frames are subdivided. */
  maxStep: 1 / 30,
  /** Speed of molecules entering or leaving through a wall, A/s. */
  transit: 9,
  /** Speed of a molecule that crosses the free surface or leaves as a gas, A/s. */
  crossing: 16,
} as const;

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

export class MicroMotion {
  public readonly bodies: Body[] = [];
  /** Box edge lengths, A; the box is centred on the origin. */
  public readonly size: THREE.Vector3;
  private rnd: () => number;
  private nextUid = 1;
  private spare: number | null = null;

  constructor(size: THREE.Vector3 | number, public kind: BoxKind = 'liquid', seed = 1) {
    this.size = typeof size === 'number' ? new THREE.Vector3(size, size, size) : size.clone();
    this.rnd = mulberry32(seed);
  }

  // ------------------------------------------------------------------ random
  private gauss(): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    let u = 0;
    while (u < 1e-12) u = this.rnd();
    const v = this.rnd();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  private randomQuat(q: THREE.Quaternion) {
    // uniform on SO(3)
    const u1 = this.rnd();
    const u2 = this.rnd() * 2 * Math.PI;
    const u3 = this.rnd() * 2 * Math.PI;
    const a = Math.sqrt(1 - u1);
    const b = Math.sqrt(u1);
    q.set(a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3));
  }

  private thermalSpeed(shape: MolShape): number {
    const base = this.kind === 'gas' ? MOTION.gasSpeed : MOTION.liquidSpeed;
    // heavier / larger bodies move less (v ~ 1/sqrt(m), m ~ r^3)
    return base / Math.sqrt(Math.max(0.5, Math.pow(shape.radius / 1.6, 3)));
  }

  // ------------------------------------------------------------------ population
  /** A molecule at a random free spot inside the box (initial fill). */
  public addInside(species: string, shape: MolShape, role: BodyRole = 'solute'): Body {
    const b = this.make(species, shape, role, 'in');
    const hx = this.size.x / 2 - shape.radius;
    const hy = this.size.y / 2 - shape.radius;
    const hz = this.size.z / 2 - shape.radius;
    // best of 24 random spots: the one with the largest clearance to the molecules already there
    let best = -Infinity;
    const cand = new THREE.Vector3();
    for (let tries = 0; tries < 24; tries++) {
      cand.set((this.rnd() * 2 - 1) * Math.max(0, hx), (this.rnd() * 2 - 1) * Math.max(0, hy), (this.rnd() * 2 - 1) * Math.max(0, hz));
      let clear = Infinity;
      for (const o of this.bodies) {
        if (o.state === 'leaving') continue;
        clear = Math.min(clear, o.pos.distanceTo(cand) - (o.shape.radius + shape.radius));
      }
      if (clear > best) {
        best = clear;
        b.pos.copy(cand);
      }
      if (best > 0) break;
    }
    this.bodies.push(b);
    return b;
  }

  /** A molecule that drifts in through a random wall (a gas also through the top). */
  public addEntering(species: string, shape: MolShape, role: BodyRole = 'solute'): Body {
    const b = this.make(species, shape, role, 'entering');
    const face = this.pickFace(false);
    const out = shape.radius + 0.8;
    const p = b.pos;
    p.set((this.rnd() - 0.5) * this.size.x, (this.rnd() - 0.5) * this.size.y, (this.rnd() - 0.5) * this.size.z);
    this.placeOnFace(p, face, out);
    b.vel.set(0, 0, 0).addScaledVector(this.faceNormal(face), -MOTION.transit);
    this.bodies.push(b);
    return b;
  }

  /** Sends the molecule of `species` that is nearest to a wall out through it. Returns false if there is none. */
  public removeOne(species: string, role: BodyRole = 'solute'): boolean {
    let pick: Body | null = null;
    let face = 0;
    let bestD = Infinity;
    for (const b of this.bodies) {
      if (b.species !== species || b.role !== role || b.state === 'leaving' || b.state === 'reacting' || b.state === 'docking') continue;
      for (let f = 0; f < 6; f++) {
        const d = this.faceDistance(b.pos, f);
        if (d < bestD) {
          bestD = d;
          pick = b;
          face = f;
        }
      }
    }
    if (!pick) return false;
    pick.state = 'leaving';
    pick.vel.copy(this.faceNormal(face)).multiplyScalar(MOTION.transit);
    return true;
  }

  /** A molecule that drifts in through the given face (`FACE_TOP`: a gas dissolving, a vapour condensing) at crossing speed. */
  public addEnteringAt(species: string, shape: MolShape, role: BodyRole, face: number): Body {
    const b = this.make(species, shape, role, 'entering');
    b.pos.set((this.rnd() - 0.5) * this.size.x * 0.8, (this.rnd() - 0.5) * this.size.y * 0.8, (this.rnd() - 0.5) * this.size.z * 0.8);
    this.placeOnFace(b.pos, face, shape.radius + 0.8);
    b.vel.set(0, 0, 0).addScaledVector(this.faceNormal(face), -MOTION.crossing);
    this.bodies.push(b);
    return b;
  }

  /** Sends a body out through the given face at crossing speed (a molecule evaporating, a gas rising out of a liquid). */
  public sendThrough(b: Body, face: number) {
    b.state = 'leaving';
    b.vel.copy(this.faceNormal(face)).multiplyScalar(MOTION.crossing);
    b.angVel.multiplyScalar(0.4);
  }

  /**
   * A free molecule of `species` (settled, not taking part in an event), the one nearest to `near` or a random one; `exclude`
   * holds uids already chosen. Null if there is none.
   */
  public pick(species: string, role: BodyRole, exclude: ReadonlySet<number> = new Set(), near?: THREE.Vector3): Body | null {
    const free = this.bodies.filter((b) => b.species === species && b.role === role && b.state === 'in' && !exclude.has(b.uid));
    if (free.length === 0) return null;
    if (near) {
      let best = free[0];
      for (const b of free) if (b.pos.distanceToSquared(near) < best.pos.distanceToSquared(near)) best = b;
      return best;
    }
    return free[Math.floor(this.rnd() * free.length) % free.length];
  }

  /** A molecule placed with a given pose and velocity (the product of an event). */
  public place(species: string, shape: MolShape, role: BodyRole, pos: THREE.Vector3, quat: THREE.Quaternion, vel: THREE.Vector3): Body {
    const b = this.make(species, shape, role, 'in');
    b.pos.copy(pos);
    b.quat.copy(quat);
    b.vel.copy(vel);
    this.bodies.push(b);
    return b;
  }

  /** Takes a body out of the box at once (a reactant that an event has consumed). */
  public release(b: Body) {
    const i = this.bodies.indexOf(b);
    if (i >= 0) this.bodies.splice(i, 1);
  }

  /** Molecules of each species that are in the box or on their way in (not leaving). */
  public counts(role: BodyRole = 'solute'): Map<string, number> {
    const m = new Map<string, number>();
    for (const b of this.bodies) if (b.role === role && b.state !== 'leaving') m.set(b.species, (m.get(b.species) ?? 0) + 1);
    return m;
  }

  public clear() {
    this.bodies.length = 0;
  }

  private make(species: string, shape: MolShape, role: BodyRole, state: BodyState): Body {
    const b: Body = {
      uid: this.nextUid++,
      species,
      role,
      shape,
      state,
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
    };
    this.randomQuat(b.quat);
    const s = this.thermalSpeed(shape);
    b.vel.set(this.gauss(), this.gauss(), this.gauss()).multiplyScalar(s);
    b.angVel.set(this.gauss(), this.gauss(), this.gauss()).multiplyScalar(MOTION.spin);
    return b;
  }

  // ------------------------------------------------------------------ faces: 0 +x, 1 -x, 2 +y (top), 3 -y, 4 +z, 5 -z
  private faceNormal(f: number): THREE.Vector3 {
    const n = new THREE.Vector3();
    n.setComponent(f >> 1, f & 1 ? -1 : 1);
    return n;
  }

  private faceDistance(p: THREE.Vector3, f: number): number {
    const axis = f >> 1;
    const half = this.size.getComponent(axis) / 2;
    return f & 1 ? p.getComponent(axis) + half : half - p.getComponent(axis);
  }

  private pickFace(includeTop: boolean): number {
    // a liquid keeps its free surface closed to molecules; a gas is open on all six faces
    const faces = this.kind === 'gas' || includeTop ? [0, 1, 2, 3, 4, 5] : [0, 1, 3, 4, 5];
    return faces[Math.floor(this.rnd() * faces.length) % faces.length];
  }

  private placeOnFace(p: THREE.Vector3, f: number, out: number) {
    const axis = f >> 1;
    const half = this.size.getComponent(axis) / 2;
    p.setComponent(axis, (f & 1 ? -1 : 1) * (half + out));
  }

  // ------------------------------------------------------------------ dynamics
  public step(dt: number) {
    if (!(dt > 0)) return;
    let left = Math.min(dt, 0.5);
    while (left > 1e-9) {
      const h = Math.min(left, MOTION.maxStep);
      this.substep(h);
      left -= h;
    }
  }

  private substep(dt: number) {
    const gas = this.kind === 'gas';
    const damp = gas ? MOTION.gasDamping : MOTION.liquidDamping;
    const decay = Math.exp(-damp * dt);
    const kick = Math.sqrt(1 - decay * decay);
    const bodies = this.bodies;

    // repulsion between settled bodies (O(n^2); n <= a few hundred)
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      if (a.state !== 'in') continue;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        if (b.state !== 'in') continue;
        const rr = (a.shape.radius + b.shape.radius) * MOTION.contact;
        const dx = a.pos.x - b.pos.x;
        const dy = a.pos.y - b.pos.y;
        const dz = a.pos.z - b.pos.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-6;
        const push = (MOTION.repel * (rr - d)) / d;
        const wa = 1 / (a.shape.radius * a.shape.radius);
        const wb = 1 / (b.shape.radius * b.shape.radius);
        const s = wa + wb;
        a.vel.x += dx * push * (wa / s) * 2 * dt;
        a.vel.y += dy * push * (wa / s) * 2 * dt;
        a.vel.z += dz * push * (wa / s) * 2 * dt;
        b.vel.x -= dx * push * (wb / s) * 2 * dt;
        b.vel.y -= dy * push * (wb / s) * 2 * dt;
        b.vel.z -= dz * push * (wb / s) * 2 * dt;
      }
    }

    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      if (b.state === 'reacting' || b.state === 'docking') continue;
      if (b.state === 'in') {
        const s = this.thermalSpeed(b.shape);
        // velocity: Ornstein-Uhlenbeck toward zero with thermal kicks (gas: nearly free flight at constant speed)
        b.vel.multiplyScalar(decay);
        b.vel.x += kick * s * this.gauss();
        b.vel.y += kick * s * this.gauss();
        b.vel.z += kick * s * this.gauss();
        if (gas) {
          const sp = b.vel.length() || 1;
          b.vel.multiplyScalar(THREE.MathUtils.clamp(s * 1.2 / sp, 0.5, 1.6) * 0.02 + 0.98);
        }
        b.angVel.multiplyScalar(decay);
        b.angVel.x += kick * MOTION.spin * this.gauss();
        b.angVel.y += kick * MOTION.spin * this.gauss();
        b.angVel.z += kick * MOTION.spin * this.gauss();
        b.pos.addScaledVector(b.vel, dt);
        this.reflect(b);
      } else if (b.state === 'entering') {
        // straight inward at transit speed; settled once its centre is a radius inside every wall
        b.pos.addScaledVector(b.vel, dt);
        if (this.insideBox(b.pos, b.shape.radius)) {
          b.state = 'in';
          b.vel.multiplyScalar(0.3);
        }
      } else {
        b.pos.addScaledVector(b.vel, dt);
        if (!this.insideBox(b.pos, -(b.shape.radius + 1.5))) {
          bodies.splice(i, 1);
          continue;
        }
      }
      // rotation
      const w = b.angVel.length();
      if (w > 1e-9) {
        _v.copy(b.angVel).multiplyScalar(1 / w);
        _q.setFromAxisAngle(_v, w * dt);
        b.quat.premultiply(_q).normalize();
      }
    }
  }

  private insideBox(p: THREE.Vector3, margin: number): boolean {
    return (
      Math.abs(p.x) <= this.size.x / 2 - margin && Math.abs(p.y) <= this.size.y / 2 - margin && Math.abs(p.z) <= this.size.z / 2 - margin
    );
  }

  private reflect(b: Body) {
    const r = b.shape.radius * 0.7;
    for (let axis = 0; axis < 3; axis++) {
      const lim = this.size.getComponent(axis) / 2 - r;
      const p = b.pos.getComponent(axis);
      if (p > lim) {
        b.pos.setComponent(axis, lim - (p - lim));
        b.vel.setComponent(axis, -Math.abs(b.vel.getComponent(axis)));
      } else if (p < -lim) {
        b.pos.setComponent(axis, -lim + (-lim - p));
        b.vel.setComponent(axis, Math.abs(b.vel.getComponent(axis)));
      }
      // a box smaller than the molecule: keep it centred
      const q = b.pos.getComponent(axis);
      if (Math.abs(q) > lim && lim > 0) b.pos.setComponent(axis, Math.sign(q) * lim);
      if (lim <= 0) b.pos.setComponent(axis, 0);
    }
  }
}
