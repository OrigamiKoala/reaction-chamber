// Molecular viewer: the slab of a solid surface under the box (three.js maths only, no renderer; tests/micro_slab.mjs).
//
// The slab is the schematic lattice patch of `app/micro_lattice.ts` plus its state: which site holds which occupant (an ion, a
// metal atom), which sites are held by an event in progress, and the residues a decomposition leaves. It sits below the floor
// of the box (its top face is the floor), so the dissolved molecules never overlap it. Precipitation, plating and dissolution
// are changes of occupancy: an ion docks at a vacant site that is held up by occupied sites below it (crystals grow
// layer by layer), a surface ion leaves from a site that nothing rests on.
import * as THREE from 'three';
import type { MicroLatticeData } from '../types/sim';
import type { SlabLayout } from '../app/micro_lattice';
import { mulberry32 } from '../app/micro_lattice';
import type { Body } from './micro_motion';
import type { MolShape } from './micro_shape';

export interface Occupant {
  species: string;
  shape: MolShape;
  quat: THREE.Quaternion;
}

/** Residues kept on the surface at most (the oldest go first). */
export const MAX_RESIDUES = 24;
/** Share of the sites of the layer under the growth layer that start occupied (a rough surface), and of the growth layer (adatoms). */
const START_OCCUPANCY = { sub: 0.7, top: 0.1 };

let nextUid = 1_000_000;

export class Slab {
  public readonly occupant: Array<Occupant | null>;
  /** Sites whose occupant is held by an event (lifting off or being replaced): not available to other events. */
  public readonly reserved = new Set<number>();
  public readonly residues: Body[] = [];
  /** Counts every change; the scene redraws the slab when it moves. */
  public version = 0;
  private cache: { version: number; bodies: Body[] } | null = null;
  private rnd: () => number;
  private bodyOf = new Map<number, Body>();

  /** `origin`: the world position of the local origin (the centre of the top layer's plane). */
  constructor(public readonly layout: SlabLayout, public readonly origin: THREE.Vector3, public readonly lattice: MicroLatticeData, public readonly label: string, seed = 1) {
    this.occupant = layout.sites.map(() => null);
    this.rnd = mulberry32(seed);
  }

  // ------------------------------------------------------------------ geometry
  public siteWorld(id: number, out = new THREE.Vector3()): THREE.Vector3 {
    const s = this.layout.sites[id];
    return out.set(s.x, s.y, s.z).add(this.origin);
  }

  /** Position of the surface plane above a site (where an arriving molecule waits before it docks), `h` angstrom above it. */
  public above(id: number, h: number, out = new THREE.Vector3()): THREE.Vector3 {
    return this.siteWorld(id, out).add(new THREE.Vector3(0, h, 0));
  }

  // ------------------------------------------------------------------ occupancy
  /** Fills the starting surface: all layers full below the top two; the layer under the growth layer partly, the growth layer with a few adatoms. */
  public fillInitial(shapeOf: (species: string) => MolShape | undefined) {
    const top = this.layout.layers - 1;
    for (const s of this.layout.sites) {
      const share = s.layer < top - 1 ? 1 : s.layer === top - 1 ? START_OCCUPANCY.sub : START_OCCUPANCY.top;
      if (s.layer >= top - 1 && this.rnd() >= share) continue;
      // a site above the bottom layer needs a support
      if (s.layer > 0 && !s.below.some((b) => this.occupant[b])) continue;
      const shape = shapeOf(s.species);
      if (shape) this.place(s.id, s.species, shape);
    }
  }

  /** A random orientation for an occupant (atoms need none), so an arriving ion can be turned to it on the way in. */
  public randomOrientation(shape: MolShape): THREE.Quaternion {
    const q = new THREE.Quaternion();
    if (!shape.single) q.set(this.rnd() - 0.5, this.rnd() - 0.5, this.rnd() - 0.5, this.rnd() - 0.5).normalize();
    return q;
  }

  public place(id: number, species: string, shape: MolShape, quat?: THREE.Quaternion) {
    this.occupant[id] = { species, shape, quat: quat ? quat.clone() : this.randomOrientation(shape) };
    this.version++;
  }

  public clear(id: number) {
    if (this.occupant[id]) {
      this.occupant[id] = null;
      this.version++;
    }
  }

  public count(): number {
    return this.occupant.reduce((n, o) => n + (o ? 1 : 0), 0);
  }

  /** Held up by an occupant that is there now (the structural invariant). */
  public supported(id: number): boolean {
    const s = this.layout.sites[id];
    return s.layer === 0 || s.below.some((b) => this.occupant[b] !== null);
  }

  /** Held up by an occupant that will still be there when an ion arrives: not one that an event is about to lift off. */
  private supportedForGrowth(id: number): boolean {
    const s = this.layout.sites[id];
    return s.layer === 0 || s.below.some((b) => this.occupant[b] !== null && !this.reserved.has(b));
  }

  private free(id: number): boolean {
    return !this.reserved.has(id);
  }

  /** Vacant sites of `species` (any when omitted) that an arriving ion can take: held up from below, not held by an event. */
  public vacancies(species?: string): number[] {
    return this.layout.sites.filter((s) => !this.occupant[s.id] && this.free(s.id) && (species === undefined || s.species === species) && this.supportedForGrowth(s.id)).map((s) => s.id);
  }

  /** Occupied sites of `species` that nothing rests on (and that are not in the bottom layer): the ones that can leave. */
  public exposed(species?: string): number[] {
    return this.layout.sites
      .filter((s) => this.occupant[s.id] && this.free(s.id) && s.layer >= 1 && (species === undefined || s.species === species) && !s.above.some((a) => this.occupant[a] || this.reserved.has(a)))
      .map((s) => s.id);
  }

  private dist(a: number, b: number): number {
    const p = this.layout.sites[a];
    const q = this.layout.sites[b];
    return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  }

  /**
   * Sites for an event, one per wanted position, as close together as the candidates allow, starting from a random candidate of
   * the scarcest one. `species`: the lattice species wanted at each position (default: one formula unit of the lattice).
   * `occupants` (for `exposed`): the species the site must hold, where the slab carries foreign atoms (copper plated on zinc).
   * `mode`: free positions (precipitation, plating) or occupied ones that can leave (dissolution). The result is in the order of
   * the wanted positions; null when the surface offers none of one kind.
   */
  public pickUnit(mode: 'vacant' | 'exposed', species?: string[], occupants?: Array<string | null>): number[] | null {
    const wanted = species ?? this.layout.unit.flatMap((u) => Array.from({ length: u.count }, () => u.species));
    const items = wanted.map((sp, i) => ({ sp, occ: occupants?.[i] ?? null }));
    const pool = (it: { sp: string; occ: string | null }): number[] =>
      mode === 'vacant' ? this.vacancies(it.sp) : this.exposed(it.sp).filter((id) => it.occ === null || this.occupant[id]?.species === it.occ);
    const pools = items.map(pool);
    let first = 0;
    for (let i = 1; i < items.length; i++) if (pools[i].length < pools[first].length) first = i;
    if (items.length === 0 || pools[first].length === 0) return null;
    const seed = pools[first][Math.floor(this.rnd() * pools[first].length) % pools[first].length];
    const out: number[] = new Array(items.length);
    const taken = new Set<number>([seed]);
    out[first] = seed;
    for (let i = 0; i < items.length; i++) {
      if (i === first) continue;
      let best: number | null = null;
      let bd = Infinity;
      for (const c of pools[i]) {
        if (taken.has(c)) continue;
        const d = this.dist(c, seed);
        if (d < bd - 1e-9) {
          bd = d;
          best = c;
        }
      }
      if (best === null) return null;
      taken.add(best);
      out[i] = best;
    }
    return out;
  }

  public reserve(ids: Iterable<number>) {
    for (const id of ids) this.reserved.add(id);
  }

  public release(ids: Iterable<number>) {
    for (const id of ids) this.reserved.delete(id);
  }

  // ------------------------------------------------------------------ residues
  /** A solid product that stays on the surface where the reactant solid was. */
  public addResidue(at: THREE.Vector3, species: string, shape: MolShape) {
    const b = this.pseudoBody(species, shape, at.clone(), new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rnd() * 6.28, this.rnd() * 6.28, this.rnd() * 6.28)));
    this.residues.push(b);
    while (this.residues.length > MAX_RESIDUES) this.residues.shift();
    this.version++;
  }

  private pseudoBody(species: string, shape: MolShape, pos: THREE.Vector3, quat: THREE.Quaternion): Body {
    return { uid: nextUid++, species, role: 'solute', shape, state: 'in', pos, quat, vel: new THREE.Vector3(), angVel: new THREE.Vector3() };
  }

  // ------------------------------------------------------------------ drawing
  /** The occupants (and residues) as static bodies in world coordinates, for the scene's instanced drawing. */
  public bodies(): Body[] {
    if (this.cache && this.cache.version === this.version) return this.cache.bodies;
    const out: Body[] = [];
    const live = new Set<number>();
    for (const s of this.layout.sites) {
      const o = this.occupant[s.id];
      if (!o) continue;
      live.add(s.id);
      let b = this.bodyOf.get(s.id);
      if (!b || b.species !== o.species) {
        b = this.pseudoBody(o.species, o.shape, new THREE.Vector3(), o.quat.clone());
        this.bodyOf.set(s.id, b);
      }
      b.shape = o.shape;
      b.quat.copy(o.quat);
      this.siteWorld(s.id, b.pos);
      out.push(b);
    }
    for (const id of [...this.bodyOf.keys()]) if (!live.has(id)) this.bodyOf.delete(id);
    out.push(...this.residues);
    this.cache = { version: this.version, bodies: out };
    return out;
  }
}
