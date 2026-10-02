import * as THREE from 'three';
import { VesselState } from '../types';
import { buildCatalogProfile } from './glass_catalog_profiles';

/**
 * Real-world glassware profiles. 1 scene unit = 1 cm.
 * Every profile is expressed in the vessel's "glass-local" frame: y = 0 is the lowest point of the glass
 * body, the symmetry axis is the local Y axis, and the pour spout (if any) points along local +X.
 *
 * This file holds the profile data model, the volume <-> height tables and the construction helpers; the
 * per-type dimensions live in `glass_catalog_profiles.ts` (`getProfile` below dispatches to it).
 */
export type VesselType = VesselState['type'];

/**
 * One printed mark. `ml` is the liquid volume (measured from the bottom of the vessel, i.e. what `volumeAtHeight`
 * returns) when the surface sits on the mark, so its height is always `heightForVolume(p, ml)` (never linear).
 * `label` is the printed numeral and may differ from `ml` (burettes / graduated pipettes are graduated downward:
 * label = volume delivered since the 0 mark).
 * Tick conventions: minor = short half-ring tick, `mid` = medium tick, `major` = long tick (+ numeral if `label`).
 */
export interface Graduation {
  ml: number;
  major: boolean;
  mid?: boolean;
  label?: string;
}

export type VesselKind =
  | 'beaker'
  | 'conical'
  | 'round-bottom'
  | 'florence'
  | 'filter-flask'
  | 'cylinder'
  | 'volumetric'
  | 'burette'
  | 'pipette-volumetric'
  | 'pipette-graduated'
  | 'pipette-pasteur'
  | 'tube'
  | 'centrifuge'
  | 'gas-tube'
  | 'gas-syringe'
  | 'gas-jar'
  | 'sep-funnel'
  | 'funnel'
  | 'buchner-funnel'
  | 'dish'
  | 'petri'
  | 'watch-glass'
  | 'crucible'
  | 'weigh-boat';

/** glass = clear borosilicate, poly = translucent polypropylene, porcelain = white glaze, plastic = opaque white plastic. */
export type VesselMaterial = 'glass' | 'poly' | 'porcelain' | 'plastic';

/** What the vessel stands in / on (built in `glass_accessories.ts`, hidden together with `setRackVisible(false)`). */
export type SupportKind = 'none' | 'rack' | 'cork-ring' | 'stand';

/** Small extra meshes built next to the lathe body (see `glass_accessories.ts`). `y` is glass-local. */
export interface Accessory {
  kind:
    | 'stopcock'
    | 'sidearm'
    | 'plunger'
    | 'teat'
    | 'lid'
    | 'plate'
    | 'joint'
    | 'flange';
  y: number;
  /** Radius of the part the accessory attaches to / spans (cm). */
  r: number;
  /** Optional length / size (cm). */
  len?: number;
}

export interface VesselProfile {
  type: VesselType;
  kind: VesselKind;
  material: VesselMaterial;
  /** Closed cross-section for the glass lathe: outer surface (bottom→rim), rim bead, inner surface (rim→bottom). */
  shell: THREE.Vector2[];
  /** Inner cavity, ascending from the axis at the inner bottom up to the inner rim. */
  inner: THREE.Vector2[];
  /** Outer surface, ascending (axis → rim). */
  outer: THREE.Vector2[];
  wall: number;
  rimY: number;
  innerBottomY: number;
  innerTopY: number;
  maxOuterRadius: number;
  rimOuterRadius: number;
  rimInnerRadius: number;
  spout: number; // spout protrusion, cm (0 = none)
  /** Printed (nominal) volume, mL. */
  nominalMl: number;
  /** Brim-full volume of the cavity (mL). */
  capacityMl: number;
  graduations: Graduation[];
  /** First line of the scale title (units / nominal volume), e.g. "100 mL" or "mL". */
  gradTitle: string;
  /** Small second title line, e.g. "TC 20 °C". */
  gradNote: string;
  /** Lift of the glass above the bench in the vessel group (test tube in a rack, burette on a stand). */
  baseOffsetY: number;
  /** Hexagonal foot height (graduated cylinder), 0 if none. */
  footHeight: number;
  footRadius: number;
  /** True when the vessel stands in a wooden test-tube rack (support === 'rack'). */
  rack: boolean;
  support: SupportKind;
  /** Support geometry: rack hole radius / cork-ring major radius / stand clamp height + radius (glass-local y). */
  supportR: number;
  supportY: number;
  /** Footprint radius of the whole assembly (glass + support), cm. */
  footprintR: number;
  /** Height of the support above the bench (stand rod top), cm; 0 if it is not taller than the glass. */
  supportTopY: number;
  /** Single calibration ring (volumetric flask / volumetric pipette), glass-local y; undefined = none. */
  calibrationY?: number;
  /** Graduated downward (burette, graduated pipette): label = volume delivered since the 0 mark. */
  downward: boolean;
  /** y of the 0 mark of a downward scale. */
  zeroY?: number;
  /** Total scale range (mL) of the printed scale (nominal for cylinders / burettes / pipettes). */
  scaleMl: number;
  /** Open delivery tip (burette, pipettes, funnel stems): glass-local position of the opening, undefined = closed vessel. */
  tip?: THREE.Vector3;
  openBottom: boolean;
  /** Inner radius of the neck (at the ring for volumetric flasks / pipettes, at the rim for narrow-necked vessels). */
  neckRadius: number;
  accessories: Accessory[];
  /** Title-only enamel label (volumetric flask / pipette bulb): y centre, height and text lines. */
  label?: { y: number; h: number; lines: string[] };
  /** Cumulative inner volume (mL) sampled every `volStep` cm from innerBottomY. */
  volTable: Float32Array;
  volStep: number;
}

/** Clearance (cm) between the glass base and the supporting surface; avoids coplanar depth fighting. */
export const GROUND_EPS = 0.03;

// ------------------------------------------------------------------ helpers
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

/** Polyline builder for the ascending outer wall of a lathe profile. */
export class Wall {
  pts: THREE.Vector2[] = [];
  /** Without arguments the polyline starts empty (the first `arc` / `curve` call defines the start). */
  constructor(x?: number, y?: number) {
    if (x !== undefined && y !== undefined) this.pts.push(new THREE.Vector2(x, y));
  }
  get x(): number {
    return this.pts[this.pts.length - 1].x;
  }
  get y(): number {
    return this.pts[this.pts.length - 1].y;
  }
  /** Straight segment to (x, y). */
  line(x: number, y: number, n = 1): this {
    const x0 = this.x;
    const y0 = this.y;
    for (let i = 1; i <= n; i++) this.pts.push(new THREE.Vector2(x0 + ((x - x0) * i) / n, y0 + ((y - y0) * i) / n));
    return this;
  }
  /** Smooth radius change to (x, y): vertical tangents at both ends (shoulders, neck blends). */
  ease(x: number, y: number, n = 10): this {
    const x0 = this.x;
    const y0 = this.y;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const s = t * t * (3 - 2 * t);
      this.pts.push(new THREE.Vector2(x0 + (x - x0) * s, y0 + (y - y0) * t));
    }
    return this;
  }
  /** Arbitrary radius function r(t), t in (0..1], linearly spaced in y up to `y`. */
  curve(y: number, r: (t: number) => number, n = 16): this {
    const y0 = this.y;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.pts.push(new THREE.Vector2(Math.max(0, r(t)), y0 + (y - y0) * t));
    }
    return this;
  }
  /** Circular arc (appended, first point skipped when it coincides with the current end). */
  arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): this {
    const a = arc(cx, cy, r, a0, a1, n);
    for (const p of a) {
      const last = this.pts[this.pts.length - 1];
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-4) continue;
      this.pts.push(p);
    }
    return this;
  }
}

/** Offset a polyline (ascending outer wall) inward by `d` along its 2D normals. */
function offsetInward(pts: THREE.Vector2[], d: number): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[Math.min(pts.length - 1, i + 1)];
    const tx = p1.x - p0.x;
    const ty = p1.y - p0.y;
    const len = Math.hypot(tx, ty) || 1;
    // outward normal of an ascending outer wall = (ty, -tx)
    const nx = ty / len;
    const ny = -tx / len;
    out.push(new THREE.Vector2(Math.max(0, pts[i].x - nx * d), pts[i].y - ny * d));
  }
  return out;
}

function dedupe(pts: THREE.Vector2[]): THREE.Vector2[] {
  const out: THREE.Vector2[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.distanceTo(p) > 1e-4) out.push(p);
  }
  return out;
}

export interface ProfileOpts extends Partial<Omit<VesselProfile, 'type' | 'shell' | 'inner' | 'outer' | 'volTable' | 'volStep'>> {
  nominalMl: number;
  graduations: Graduation[];
  gradTitle: string;
  bottomY?: number;
  roundBottom?: boolean;
  /** Cavity floor (e.g. the perforated plate of a Büchner funnel); the wall below it stays solid. */
  innerFloorY?: number;
}

/**
 * Build a profile from the outer wall polyline (ascending, starting at the first non-axis bottom point and
 * ending just below the rim bead).
 */
export function buildProfile(type: VesselType, outerWall: THREE.Vector2[], wall: number, opts: ProfileOpts): VesselProfile {
  const bottomY = opts.bottomY ?? 0;
  const innerWall = offsetInward(outerWall, wall);
  const top = outerWall[outerWall.length - 1];
  const topIn = innerWall[innerWall.length - 1];
  // Rim bead: semicircle joining outer and inner wall tops, slightly fattened.
  const cx = (top.x + topIn.x) / 2;
  const rr = Math.max(0.02, (top.x - topIn.x) / 2);
  const cy = Math.max(top.y, topIn.y);
  const bead = arc(cx, cy, rr * 1.25, 0, Math.PI, 8).map((p) => new THREE.Vector2(p.x, p.y));
  const rimY = cy + rr * 1.25;

  const outer = dedupe([new THREE.Vector2(0, bottomY), ...outerWall]);
  let innerBottomY: number;
  let innerAsc: THREE.Vector2[];
  if (opts.innerFloorY !== undefined) {
    // flat cavity floor above a solid underside (perforated plate): interpolate the inner wall at the floor height
    const fy = opts.innerFloorY;
    innerBottomY = fy;
    const above = innerWall.filter((p) => p.y > fy + 1e-4);
    const k = innerWall.findIndex((p) => p.y > fy + 1e-4);
    let x0 = innerWall[Math.max(0, k)].x;
    if (k > 0) {
      const a = innerWall[k - 1];
      const b = innerWall[k];
      x0 = a.x + ((b.x - a.x) * (fy - a.y)) / Math.max(1e-6, b.y - a.y);
    }
    innerAsc = dedupe([new THREE.Vector2(0, fy), new THREE.Vector2(x0, fy), ...above]);
  } else {
    innerBottomY = opts.roundBottom ? innerWall[0].y : Math.max(innerWall[0].y, bottomY + wall);
    innerAsc = dedupe([
      new THREE.Vector2(0, innerBottomY),
      ...innerWall.map((p) => new THREE.Vector2(p.x, Math.max(p.y, innerBottomY))),
    ]);
  }
  const shell = dedupe([...outer, ...bead, ...[...innerAsc].reverse()]);

  let maxR = 0;
  for (const p of shell) maxR = Math.max(maxR, p.x);

  const spout = opts.spout ?? 0;
  const maxOuter = Math.max(maxR, opts.footRadius ?? 0);
  const profile: VesselProfile = {
    type,
    kind: opts.kind ?? 'beaker',
    material: opts.material ?? 'glass',
    shell,
    inner: innerAsc,
    outer,
    wall,
    rimY,
    innerBottomY,
    innerTopY: topIn.y,
    maxOuterRadius: maxOuter,
    rimOuterRadius: top.x + rr * 0.25,
    rimInnerRadius: topIn.x,
    spout,
    nominalMl: opts.nominalMl,
    capacityMl: 0,
    graduations: opts.graduations,
    gradTitle: opts.gradTitle,
    gradNote: opts.gradNote ?? '',
    // Lift the glass a hair above whatever it stands on so the flat outer base never ends up exactly coplanar
    // with the worktop / rack / shelf top (z-fighting at the base).
    baseOffsetY: (opts.baseOffsetY ?? 0) + GROUND_EPS,
    footHeight: opts.footHeight ?? 0,
    footRadius: opts.footRadius ?? 0,
    rack: (opts.support ?? (opts.rack ? 'rack' : 'none')) === 'rack',
    support: opts.support ?? (opts.rack ? 'rack' : 'none'),
    supportR: opts.supportR ?? 0,
    supportY: opts.supportY ?? 0,
    footprintR: opts.footprintR ?? maxOuter + spout,
    supportTopY: opts.supportTopY ?? 0,
    calibrationY: opts.calibrationY,
    downward: opts.downward ?? false,
    zeroY: opts.zeroY,
    scaleMl: opts.scaleMl ?? opts.nominalMl,
    tip: opts.tip,
    openBottom: opts.openBottom ?? false,
    neckRadius: opts.neckRadius ?? topIn.x,
    accessories: opts.accessories ?? [],
    label: opts.label,
    volTable: new Float32Array(1),
    volStep: 0.02,
  };
  buildVolumeTable(profile);
  profile.capacityMl = profile.volTable[profile.volTable.length - 1];
  return profile;
}

function buildVolumeTable(p: VesselProfile) {
  const h = p.innerTopY - p.innerBottomY;
  const n = Math.max(2, Math.ceil(h / p.volStep) + 1);
  const t = new Float32Array(n);
  let acc = 0;
  let prevR = innerRadiusAt(p, p.innerBottomY);
  for (let i = 1; i < n; i++) {
    const y = p.innerBottomY + i * p.volStep;
    const r = innerRadiusAt(p, y);
    // frustum slice volume
    acc += (Math.PI * p.volStep * (prevR * prevR + prevR * r + r * r)) / 3;
    t[i] = acc;
    prevR = r;
  }
  p.volTable = t;
}

/** Inner radius at local height y (piecewise-linear along the inner profile). */
export function innerRadiusAt(p: VesselProfile, y: number): number {
  const pts = p.inner;
  if (y <= pts[0].y) return y < pts[0].y - 1e-6 ? 0 : maxRadiusAtY(pts, y);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b.y - a.y < 1e-6) continue;
    if (y >= a.y && y <= b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return a.x + (b.x - a.x) * t;
    }
  }
  return pts[pts.length - 1].x;
}

function maxRadiusAtY(pts: THREE.Vector2[], y: number): number {
  let r = 0;
  for (const q of pts) if (Math.abs(q.y - y) < 1e-4) r = Math.max(r, q.x);
  return r;
}

/** Outer radius at height y. */
export function outerRadiusAt(p: VesselProfile, y: number): number {
  const pts = p.outer;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b.y - a.y < 1e-6) continue;
    if (y >= a.y && y <= b.y) return a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
  }
  return y < pts[0].y ? pts[0].x : pts[pts.length - 1].x;
}

/** Volume (mL) of liquid filled up to local height y. */
export function volumeAtHeight(p: VesselProfile, y: number): number {
  const f = (y - p.innerBottomY) / p.volStep;
  if (f <= 0) return 0;
  const n = p.volTable.length;
  if (f >= n - 1) {
    const r = p.rimInnerRadius;
    return p.volTable[n - 1] + Math.PI * r * r * (f - (n - 1)) * p.volStep;
  }
  const i = Math.floor(f);
  return p.volTable[i] + (p.volTable[i + 1] - p.volTable[i]) * (f - i);
}

/** Local surface height for a given liquid volume (inverse of volumeAtHeight). Extrapolates above the rim. */
export function heightForVolume(p: VesselProfile, ml: number): number {
  if (ml <= 0) return p.innerBottomY;
  const t = p.volTable;
  const n = t.length;
  if (ml >= t[n - 1]) {
    const r = p.rimInnerRadius;
    return p.innerBottomY + (n - 1) * p.volStep + (ml - t[n - 1]) / (Math.PI * r * r);
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] < ml) lo = mid;
    else hi = mid;
  }
  const f = lo + (ml - t[lo]) / Math.max(1e-9, t[hi] - t[lo]);
  return p.innerBottomY + f * p.volStep;
}

/** Reading on the printed scale for a given liquid volume (downward scales: volume delivered since the 0 mark). */
export function scaleReadingForVolume(p: VesselProfile, volumeMl: number): number {
  if (p.downward && p.zeroY !== undefined) return volumeAtHeight(p, p.zeroY) - volumeMl;
  return volumeMl;
}

/** Bisection root of an increasing function f on [lo, hi]. */
export function solveIncreasing(f: (x: number) => number, lo: number, hi: number, iters = 36): number {
  let a = lo;
  let b = hi;
  for (let i = 0; i < iters; i++) {
    const m = (a + b) / 2;
    if (f(m) < 0) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

// ------------------------------------------------------------------ graduation helpers
export interface TickSpec {
  /** Smallest division (mL). */
  minor: number;
  /** Optional medium division (mL, a multiple of `minor`). */
  mid?: number;
  /** Long division (mL, a multiple of `minor`); numerals are printed here (every `labelEvery`, default = major). */
  major: number;
  labelEvery?: number;
  /** Smallest value that gets a mark (default = minor). */
  from?: number;
  /** Largest value that gets a mark (default = range). */
  to?: number;
}

const isMultiple = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6;
const fmtLabel = (v: number) => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : String(+v.toFixed(2)));

/**
 * Tick values for a scale 0 … `range`. Returns plain printed values (not yet mapped to heights); use `scaleGraduations`
 * to convert them to `Graduation`s for a concrete profile.
 */
export function tickValues(range: number, t: TickSpec): { v: number; tier: 0 | 1 | 2; label?: string }[] {
  const out: { v: number; tier: 0 | 1 | 2; label?: string }[] = [];
  const from = t.from ?? t.minor;
  const to = t.to ?? range;
  const n = Math.round(to / t.minor);
  for (let i = 0; i <= n; i++) {
    const v = i * t.minor;
    if (v < from - 1e-9 && !(i === 0 && t.from === 0)) continue;
    const major = isMultiple(v, t.major);
    const mid = !major && t.mid !== undefined && isMultiple(v, t.mid);
    const lab = major && isMultiple(v, t.labelEvery ?? t.major);
    out.push({ v, tier: major ? 2 : mid ? 1 : 0, label: lab ? fmtLabel(v) : undefined });
  }
  return out;
}

/**
 * Map printed values onto a profile. Upward scales: ml = V(zeroY) + v. Downward scales (zero at the top):
 * ml = V(zeroY) - v. `zeroY` defaults to the inner bottom.
 */
export function scaleGraduations(
  p: VesselProfile,
  ticks: { v: number; tier: 0 | 1 | 2; label?: string }[],
  opts: { zeroY?: number; downward?: boolean } = {}
): Graduation[] {
  const zeroY = opts.zeroY ?? p.innerBottomY;
  const v0 = volumeAtHeight(p, zeroY);
  return ticks.map((t) => ({
    ml: opts.downward ? v0 - t.v : v0 + t.v,
    major: t.tier === 2,
    mid: t.tier === 1,
    label: t.label,
  }));
}

// ------------------------------------------------------------------ catalogue
const cache = new Map<VesselType, VesselProfile>();

/** Profile for any `VesselType` (unknown / old-save types fall back to the 250 mL beaker). */
export function getProfile(type: VesselType): VesselProfile {
  let p = cache.get(type);
  if (p) return p;
  p = buildCatalogProfile(type) ?? buildCatalogProfile('beaker-250')!;
  cache.set(type, p);
  return p;
}

/** Total height of the vessel assembly above the bench (rim + base offset). */
export function vesselHeight(p: VesselProfile): number {
  return p.rimY + p.baseOffsetY;
}

/** Footprint radius of the vessel assembly (rack / stand / cork ring included). */
export function vesselFootprint(p: VesselProfile): number {
  return p.footprintR;
}
