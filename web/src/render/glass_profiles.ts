import * as THREE from 'three';
import { VesselState } from '../types';

/**
 * Real-world glassware profiles. 1 scene unit = 1 cm.
 * Every profile is expressed in the vessel's "glass-local" frame: y = 0 is the lowest point of the glass
 * body, the symmetry axis is the local Y axis, and the pour spout (if any) points along local +X.
 */
export type VesselType = VesselState['type'];

export interface Graduation {
  ml: number;
  major: boolean;
  label?: string;
}

export interface VesselProfile {
  type: VesselType;
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
  nominalMl: number;
  graduations: Graduation[];
  gradTitle: string;
  /** Lift of the glass above the bench in the vessel group (test tube in a rack). */
  baseOffsetY: number;
  /** Hexagonal foot height (graduated cylinder), 0 if none. */
  footHeight: number;
  footRadius: number;
  rack: boolean;
  /** Cumulative inner volume (mL) sampled every `volStep` cm from innerBottomY. */
  volTable: Float32Array;
  volStep: number;
}

/** Clearance (cm) between the glass base and the supporting surface; avoids coplanar depth fighting. */
export const GROUND_EPS = 0.03;

// ------------------------------------------------------------------ helpers
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
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

/**
 * Build a profile from the outer wall polyline (ascending, starting at the first non-axis bottom point and
 * ending just below the rim bead).
 */
function buildProfile(
  type: VesselType,
  outerWall: THREE.Vector2[],
  wall: number,
  opts: Partial<VesselProfile> & { nominalMl: number; graduations: Graduation[]; gradTitle: string; bottomY?: number; roundBottom?: boolean }
): VesselProfile {
  const bottomY = opts.bottomY ?? 0;
  const innerWall = offsetInward(outerWall, wall);
  const top = outerWall[outerWall.length - 1];
  const topIn = innerWall[innerWall.length - 1];
  // Rim bead: semicircle joining outer and inner wall tops, slightly fattened.
  const cx = (top.x + topIn.x) / 2;
  const rr = (top.x - topIn.x) / 2;
  const cy = Math.max(top.y, topIn.y);
  const bead = arc(cx, cy, rr * 1.25, 0, Math.PI, 8).map((p) => new THREE.Vector2(p.x, p.y));
  const rimY = cy + rr * 1.25;

  const outer = dedupe([new THREE.Vector2(0, bottomY), ...outerWall]);
  const innerBottomY = opts.roundBottom ? innerWall[0].y : Math.max(innerWall[0].y, bottomY + wall);
  const innerAsc = dedupe([
    new THREE.Vector2(0, innerBottomY),
    ...innerWall.map((p) => new THREE.Vector2(p.x, Math.max(p.y, innerBottomY))),
  ]);
  const shell = dedupe([...outer, ...bead, ...[...innerAsc].reverse()]);

  let maxR = 0;
  for (const p of shell) maxR = Math.max(maxR, p.x);

  const profile: VesselProfile = {
    type,
    shell,
    inner: innerAsc,
    outer,
    wall,
    rimY,
    innerBottomY,
    innerTopY: topIn.y,
    maxOuterRadius: Math.max(maxR, opts.footRadius ?? 0),
    rimOuterRadius: top.x + rr * 0.25,
    rimInnerRadius: topIn.x,
    spout: opts.spout ?? 0,
    nominalMl: opts.nominalMl,
    graduations: opts.graduations,
    gradTitle: opts.gradTitle,
    // Lift the glass a hair above whatever it stands on so the flat outer base never ends up exactly coplanar
    // with the worktop / rack / shelf top (z-fighting at the base).
    baseOffsetY: (opts.baseOffsetY ?? 0) + GROUND_EPS,
    footHeight: opts.footHeight ?? 0,
    footRadius: opts.footRadius ?? 0,
    rack: opts.rack ?? false,
    volTable: new Float32Array(1),
    volStep: 0.02,
  };
  buildVolumeTable(profile);
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

// ------------------------------------------------------------------ catalogue
function grads(step: number, max: number, labelEvery: number, minorStep = 0): Graduation[] {
  const g: Graduation[] = [];
  if (minorStep > 0) {
    for (let v = minorStep; v <= max + 1e-6; v += minorStep) {
      const isMajor = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      if (isMajor) continue;
      g.push({ ml: v, major: false });
    }
  }
  for (let v = step; v <= max + 1e-6; v += step) {
    const lbl = Math.abs(v / labelEvery - Math.round(v / labelEvery)) < 1e-6;
    g.push({ ml: v, major: true, label: lbl ? String(Math.round(v)) : undefined });
  }
  return g;
}

function beaker(type: VesselType, R: number, H: number, wall: number, nominal: number, g: Graduation[]): VesselProfile {
  const c = Math.min(0.55, R * 0.18);
  const wallPts = [
    ...arc(R - c, c, c, -Math.PI / 2, 0, 6),
    new THREE.Vector2(R, H * 0.5),
    new THREE.Vector2(R, H - 0.25),
  ];
  return buildProfile(type, wallPts, wall, {
    nominalMl: nominal,
    graduations: g,
    gradTitle: `${nominal} mL`,
    spout: Math.max(0.35, R * 0.11),
  });
}

function erlenmeyer(): VesselProfile {
  const Rb = 4.25;
  const c = 0.6;
  const neckR = 1.7;
  const shoulderY = 9.2;
  const neckY = 10.2;
  const H = 13.5;
  const wallPts: THREE.Vector2[] = [...arc(Rb - c, c, c, -Math.PI / 2, 0.2, 7)];
  // straight cone to the shoulder
  const coneTop = new THREE.Vector2(neckR + 0.45, shoulderY);
  const start = wallPts[wallPts.length - 1];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    wallPts.push(new THREE.Vector2(start.x + (coneTop.x - start.x) * t, start.y + (coneTop.y - start.y) * t));
  }
  // shoulder curve into the neck
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    const e = 1 - (1 - t) * (1 - t);
    wallPts.push(new THREE.Vector2(coneTop.x + (neckR - coneTop.x) * e, shoulderY + (neckY - shoulderY) * t));
  }
  wallPts.push(new THREE.Vector2(neckR, H - 0.6));
  // slight lip flare
  wallPts.push(new THREE.Vector2(neckR + 0.12, H - 0.3));
  return buildProfile('erlenmeyer-250', wallPts, 0.18, {
    nominalMl: 250,
    graduations: grads(50, 250, 50, 25).filter((x) => x.ml <= 250),
    gradTitle: '250 mL',
  });
}

function gradCylinder(): VesselProfile {
  const R = 1.62;
  const foot = 1.0;
  const H = 24.5;
  const wallPts = [
    ...arc(R - 0.3, foot + 0.3, 0.3, -Math.PI / 2, 0, 4),
    new THREE.Vector2(R, (foot + H) * 0.5),
    new THREE.Vector2(R, H - 0.2),
  ];
  return buildProfile('cylinder-100', wallPts, 0.17, {
    nominalMl: 100,
    graduations: grads(10, 100, 10, 1),
    gradTitle: '100 mL',
    spout: 0.35,
    bottomY: foot,
    footHeight: foot,
    footRadius: 3.8,
  });
}

function testTube(): VesselProfile {
  const R = 1.25;
  const H = 15;
  const wallPts = [
    ...arc(0, R, R, -Math.PI / 2 + 0.12, 0, 10),
    new THREE.Vector2(R, H * 0.5),
    new THREE.Vector2(R, H - 0.25),
  ];
  return buildProfile('test-tube', wallPts, 0.11, {
    nominalMl: 30,
    graduations: [],
    gradTitle: '',
    roundBottom: true,
    baseOffsetY: 1.2,
    rack: true,
  });
}

const cache = new Map<VesselType, VesselProfile>();

export function getProfile(type: VesselType): VesselProfile {
  let p = cache.get(type);
  if (p) return p;
  switch (type) {
    case 'beaker-50':
      p = beaker(type, 2.1, 5.5, 0.14, 50, grads(10, 50, 10));
      break;
    case 'beaker-1000':
      p = beaker(type, 5.25, 14.5, 0.22, 1000, grads(100, 1000, 200, 50));
      break;
    case 'erlenmeyer-250':
      p = erlenmeyer();
      break;
    case 'cylinder-100':
      p = gradCylinder();
      break;
    case 'test-tube':
      p = testTube();
      break;
    case 'beaker-250':
    default:
      p = beaker('beaker-250', 3.5, 9.5, 0.18, 250, grads(50, 250, 50, 25));
      break;
  }
  cache.set(type, p);
  return p;
}

/** Total height of the vessel assembly above the bench (rim + base offset). */
export function vesselHeight(p: VesselProfile): number {
  return p.rimY + p.baseOffsetY;
}

/** Footprint radius of the vessel assembly (rack included). */
export function vesselFootprint(p: VesselProfile): number {
  return p.rack ? 6.5 : p.maxOuterRadius + p.spout;
}
