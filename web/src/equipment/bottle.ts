import * as THREE from 'three';
import { ReagentCatalogEntry } from '../types/sim';
import { clearGlass, createGlassMesh, makeGlassMaterial } from '../render/glass_material';
import { GROUND_EPS } from '../render/glass_profiles';

/**
 * Reagent bottles (1 unit = 1 cm). Three generic kinds chosen purely from data fields:
 *   - 'liquid'  : narrow-neck Boston-round (liquids / solutions)
 *   - 'jar'     : wide-mouth jar (solids, `form === 'solid'` or `by_mass`)
 *   - 'dropper' : small dropper bottle with glass pipette + rubber bulb (`dropper`)
 * Body material from `bottle_colour` (amber glass / clear glass / white HDPE).
 * Geometries and materials are shared per kind/colour; ONLY the label CanvasTexture (+ its tiny material) is
 * per bottle, so bottles are cheap to create and evict.
 */
export type BottleKind = 'liquid' | 'jar' | 'dropper';

export interface BottleInput {
  id: string;
  name: string;
  formula: string;
  concentration_m?: number;
  ghs?: string[];
  signal_word?: 'Danger' | 'Warning' | '';
  bottle_colour?: 'amber' | 'clear' | 'white';
  form?: 'solid' | 'liquid' | 'solution';
  dropper?: boolean;
  by_mass?: boolean;
  /** Content colour hint ('#rrggbb'); otherwise guessed generically from formula/name. */
  colorHex?: string;
}

export interface BottleAssembly {
  group: THREE.Group;
  kind: BottleKind;
  cap: THREE.Object3D;
  /** Pipette + bulb for dropper bottles (hidden while the animation pipette is in use). */
  dropperParts: THREE.Object3D | null;
  pickProxy: THREE.Mesh;
  height: number;
  radius: number;
  /** Pour lip in group coordinates (cap removed). */
  lipLocal: THREE.Vector3;
  /** Height of the (visual) contents above the bottle base, cm (drives the tilt at which pouring starts). */
  fillY: number;
  contentHex: string;
  /** Recolour the visible contents (e.g. once the engine-derived colour is known). */
  setContentColor: (hex: string) => void;
  setRenderOrderBase: (base: number) => void;
  setHover: (on: boolean) => void;
  /** Label glow pulse 0..1 (draws the eye to a shelf bottle). */
  setGlow: (v: number) => void;
  dispose: () => void;
}

interface KindSpec {
  R: number;
  body: THREE.Vector2[]; // outer lathe profile
  fillY: number; // contents level
  neckR: number;
  neckTopY: number;
  capR: number;
  capH: number;
  labelY0: number;
  labelY1: number;
  height: number;
}

function roundedProfile(R: number, bodyH: number, neckR: number, shoulderH: number, neckH: number, lip = 0.12): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  const c = Math.min(0.6, R * 0.18);
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2);
    pts.push(new THREE.Vector2(R - c + Math.cos(a) * c, c + Math.sin(a) * c));
  }
  pts.push(new THREE.Vector2(R, bodyH));
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const e = Math.sin((t * Math.PI) / 2);
    pts.push(new THREE.Vector2(R + (neckR - R) * e, bodyH + shoulderH * t));
  }
  const ny = bodyH + shoulderH;
  pts.push(new THREE.Vector2(neckR, ny + neckH - lip * 2));
  pts.push(new THREE.Vector2(neckR + lip, ny + neckH - lip));
  pts.push(new THREE.Vector2(neckR + lip * 0.6, ny + neckH));
  pts.push(new THREE.Vector2(neckR * 0.85, ny + neckH));
  return pts;
}

const SPECS: Record<BottleKind, KindSpec> = {
  liquid: (() => {
    const R = 3.7, bodyH = 11.2, neckR = 1.3, sh = 2.4, nh = 1.6;
    return { R, body: roundedProfile(R, bodyH, neckR, sh, nh), fillY: 10.2, neckR, neckTopY: bodyH + sh + nh, capR: 1.62, capH: 2.1, labelY0: 2.2, labelY1: 7.45, height: bodyH + sh + nh + 1.6 };
  })(),
  jar: (() => {
    const R = 3.4, bodyH = 8.6, neckR = 2.55, sh = 0.9, nh = 1.0;
    return { R, body: roundedProfile(R, bodyH, neckR, sh, nh, 0.1), fillY: 6.9, neckR, neckTopY: bodyH + sh + nh, capR: 2.85, capH: 1.9, labelY0: 1.2, labelY1: 6.1, height: bodyH + sh + nh + 1.5 };
  })(),
  dropper: (() => {
    const R = 2.0, bodyH = 6.0, neckR = 0.8, sh = 1.0, nh = 0.9;
    return { R, body: roundedProfile(R, bodyH, neckR, sh, nh, 0.08), fillY: 5.0, neckR, neckTopY: bodyH + sh + nh, capR: 1.05, capH: 1.4, labelY0: 0.9, labelY1: 3.75, height: bodyH + sh + nh + 3.6 };
  })(),
};

// ------------------------------------------------------------------ shared resources
const geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

const matCache = new Map<string, THREE.Material>();
function mat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}

function bodyGeo(kind: BottleKind) {
  return geo('body_' + kind, () => new THREE.LatheGeometry(SPECS[kind].body, 48).translate(0, GROUND_EPS, 0));
}

function contentGeo(kind: BottleKind, solid: boolean) {
  return geo(`content_${kind}_${solid ? 's' : 'l'}`, () => {
    const s = SPECS[kind];
    const inset = 0.22;
    const pts: THREE.Vector2[] = [];
    for (const q of s.body) {
      if (q.y > s.fillY) break;
      pts.push(new THREE.Vector2(Math.max(0, q.x - inset), Math.max(q.y, inset)));
    }
    pts.push(new THREE.Vector2(s.R - inset, s.fillY));
    pts.push(new THREE.Vector2(0, s.fillY + (solid ? 0.5 : 0)));
    return new THREE.LatheGeometry(pts, 40).translate(0, GROUND_EPS, 0);
  });
}

function capGeo(kind: BottleKind) {
  return geo('cap_' + kind, () => {
    const s = SPECS[kind];
    const g = new THREE.CylinderGeometry(s.capR, s.capR, s.capH, 48, 1);
    // knurled ribs: push alternate vertices out slightly
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r < s.capR * 0.99) continue;
      const a = Math.atan2(z, x);
      const f = 1 + 0.025 * Math.sign(Math.sin(a * 24));
      pos.setX(i, x * f);
      pos.setZ(i, z * f);
    }
    g.computeVertexNormals();
    g.translate(0, s.capH / 2, 0);
    return g;
  });
}

function labelGeo(kind: BottleKind) {
  return geo('label_' + kind, () => {
    const s = SPECS[kind];
    const L = 1.9; // narrower than before so the reagent inside stays visible beside / above the label
    // Same segment count as the body lathe (48) and a clearance larger than the chord sagitta, so the
    // label never dips behind the (opaque, for HDPE bottles) body polygon.
    const g = new THREE.CylinderGeometry(s.R + 0.04, s.R + 0.04, s.labelY1 - s.labelY0, 48, 1, true, -L / 2, L);
    g.translate(0, (s.labelY0 + s.labelY1) / 2 + GROUND_EPS, 0);
    return g;
  });
}

function proxyGeo(kind: BottleKind) {
  return geo('proxy_' + kind, () => {
    const s = SPECS[kind];
    const g = new THREE.CylinderGeometry(s.R, s.R, s.height, 10);
    g.translate(0, s.height / 2, 0);
    return g;
  });
}

const capMat = () => mat('cap', () => new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.42, metalness: 0 }));
/** Amber bottle glass that you can still see the contents through (the shared amber pair is ~85% opaque front+back). */
let bottleAmber: [THREE.MeshPhysicalMaterial, THREE.MeshPhysicalMaterial] | null = null;
function bottleAmberGlass() {
  return (bottleAmber ??= [
    makeGlassMaterial(true, { tint: 0x7a3d12, baseAlpha: 0.2, fresnelAlpha: 0.3, edgeTint: 0x9a5a1a, roughness: 0.05, envMapIntensity: 0.5 }),
    makeGlassMaterial(false, { tint: 0x7a3d12, baseAlpha: 0.2, fresnelAlpha: 0.3, edgeTint: 0x9a5a1a, roughness: 0.05, envMapIntensity: 0.5 }),
  ]);
}
const whiteCapMat = () => mat('capw', () => new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.5, metalness: 0 }));
const hdpeMat = () =>
  mat('hdpe', () =>
    new THREE.MeshPhysicalMaterial({ color: 0xf1efe8, roughness: 0.55, metalness: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) })
  );
const bulbMat = () => mat('bulb', () => new THREE.MeshStandardMaterial({ color: 0x7a1f12, roughness: 0.6, metalness: 0 }));
const pipetteMat = () =>
  mat('pipette', () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.25, envMapIntensity: 0.5, depthWrite: false }));
const proxyMat = () => mat('proxy', () => new THREE.MeshBasicMaterial({ visible: false }));

function contentMat(hex: string, solid: boolean): THREE.Material {
  const key = `c_${solid ? 's' : 'l'}_${hex}`;
  if (matCache.size > 160) {
    // bound the cache: drop content materials (they are re-created on demand)
    for (const [k, m] of matCache) if (k.startsWith('c_')) { m.dispose(); matCache.delete(k); }
  }
  return mat(key, () => {
    const c = new THREE.Color(hex);
    if (solid) return new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0 });
    const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    const clear = lum > 0.85;
    return new THREE.MeshPhysicalMaterial({
      // colourless liquids get a faint blue-green body so the fill level is readable through the glass
      color: clear ? c.clone().multiply(new THREE.Color(0.8, 0.93, 1.0)) : c,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: clear ? 0.4 : 0.8,
      depthWrite: false,
      envMapIntensity: 1.2,
    });
  });
}

// ------------------------------------------------------------------ content colour
/**
 * Neutral placeholder for bottle contents until a data-driven colour is known (the app probes the engine's
 * absorbance spectrum per reagent and calls `BenchScene.setBottleContentColor`). No per-compound tables.
 */
export function defaultContentColor(solid: boolean): string {
  return solid ? '#f4f3ef' : '#f2f6f8';
}

/** True if a formula looks like a bare metal (ribbon / granules visuals). */
export function looksLikeMetal(formula: string, name = ''): boolean {
  return /^(Mg|Zn|Al|Fe|Cu|Sn|Pb|Ni|Ca|Na|K|Li)$/.test(formula.trim()) || /ribbon|turnings|granules|wire|foil/i.test(name);
}

// ------------------------------------------------------------------ label
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
function prettyFormula(f: string): string {
  return f.replace(/([A-Za-z\)\]])(\d+)/g, (_m, a: string, d: string) => a + d.split('').map((c) => SUB[c] ?? c).join(''));
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = '700', family = '"Helvetica Neue", Arial, sans-serif'): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 12) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function drawGhs(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, code: string) {
  const h = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.save();
  ctx.rotate(Math.PI / 4);
  const s = size / Math.SQRT2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = '#d0191b';
  ctx.lineWidth = size * 0.08;
  ctx.strokeRect(-s / 2 + ctx.lineWidth / 2, -s / 2 + ctx.lineWidth / 2, s - ctx.lineWidth, s - ctx.lineWidth);
  ctx.restore();
  ctx.fillStyle = '#111';
  ctx.strokeStyle = '#111';
  const u = size / 10;
  const flame = (x: number, y: number, k: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y + 2.2 * u * k);
    ctx.bezierCurveTo(x - 2 * u * k, y + 1.6 * u * k, x - 1.6 * u * k, y - 0.6 * u * k, x - 0.2 * u * k, y - 2.4 * u * k);
    ctx.bezierCurveTo(x, y - 1 * u * k, x + 0.9 * u * k, y - 1.2 * u * k, x + 0.7 * u * k, y - 2.0 * u * k);
    ctx.bezierCurveTo(x + 2.2 * u * k, y - 0.6 * u * k, x + 1.9 * u * k, y + 1.7 * u * k, x, y + 2.2 * u * k);
    ctx.fill();
  };
  switch (code) {
    case 'GHS01': {
      ctx.beginPath();
      ctx.arc(0, 0.8 * u, 1.3 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = u * 0.4;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 1.8 * u, 0.8 * u + Math.sin(a) * 1.8 * u);
        ctx.lineTo(Math.cos(a) * 2.8 * u, 0.8 * u + Math.sin(a) * 2.8 * u);
        ctx.stroke();
      }
      break;
    }
    case 'GHS02':
      flame(0, 0, 1);
      ctx.fillRect(-2.2 * u, 2.4 * u, 4.4 * u, 0.5 * u);
      break;
    case 'GHS03':
      ctx.lineWidth = u * 0.6;
      ctx.beginPath();
      ctx.arc(0, 1.4 * u, 1.3 * u, 0, Math.PI * 2);
      ctx.stroke();
      flame(0, -0.9 * u, 0.75);
      break;
    case 'GHS04':
      ctx.save();
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.roundRect(-3 * u, -0.9 * u, 6 * u, 1.8 * u, 0.9 * u);
      ctx.fill();
      ctx.restore();
      break;
    case 'GHS05':
      ctx.fillRect(-2.6 * u, 2.0 * u, 5.2 * u, 0.6 * u);
      ctx.beginPath();
      ctx.moveTo(-2.2 * u, -2.6 * u); ctx.lineTo(-0.9 * u, -2.6 * u); ctx.lineTo(-1.2 * u, -0.6 * u); ctx.lineTo(-1.9 * u, -0.6 * u);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.9 * u, -2.6 * u); ctx.lineTo(2.2 * u, -2.6 * u); ctx.lineTo(1.9 * u, -0.6 * u); ctx.lineTo(1.2 * u, -0.6 * u);
      ctx.fill();
      ctx.beginPath(); ctx.arc(-1.55 * u, 0.4 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(1.55 * u, 0.4 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(0.6 * u, 1.0 * u, 2.2 * u, 0.9 * u);
      break;
    case 'GHS06':
      ctx.beginPath();
      ctx.ellipse(0, -0.9 * u, 1.6 * u, 1.5 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-0.6 * u, -1.0 * u, 0.42 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0.6 * u, -1.0 * u, 0.42 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = u * 0.55;
      ctx.beginPath(); ctx.moveTo(-2.2 * u, 0.9 * u); ctx.lineTo(2.2 * u, 2.6 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2.2 * u, 0.9 * u); ctx.lineTo(-2.2 * u, 2.6 * u); ctx.stroke();
      break;
    case 'GHS07':
      ctx.font = `900 ${size * 0.55}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, u * 0.3);
      break;
    case 'GHS08':
      ctx.beginPath(); ctx.arc(0, -2.0 * u, 0.7 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-1.8 * u, 2.6 * u); ctx.lineTo(-1.6 * u, -0.6 * u); ctx.quadraticCurveTo(0, -1.4 * u, 1.6 * u, -0.6 * u); ctx.lineTo(1.8 * u, 2.6 * u);
      ctx.fill();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0.6 * u);
        ctx.lineTo(Math.cos(a) * 1.1 * u, 0.6 * u + Math.sin(a) * 1.1 * u);
        ctx.lineTo(Math.cos(a + 0.4) * 0.4 * u, 0.6 * u + Math.sin(a + 0.4) * 0.4 * u);
        ctx.fill();
      }
      break;
    case 'GHS09':
      ctx.lineWidth = u * 0.45;
      ctx.beginPath(); ctx.moveTo(-1.6 * u, 0.4 * u); ctx.lineTo(-1.6 * u, -2.4 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1.6 * u, -1.4 * u); ctx.lineTo(-2.6 * u, -2.2 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1.6 * u, -1.0 * u); ctx.lineTo(-0.5 * u, -2.0 * u); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0.9 * u, 1.6 * u, 1.4 * u, 0.6 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(2.2 * u, 1.6 * u); ctx.lineTo(2.9 * u, 1.0 * u); ctx.lineTo(2.9 * u, 2.2 * u); ctx.fill();
      ctx.fillRect(-2.8 * u, 2.6 * u, 5.6 * u, 0.35 * u);
      break;
    default:
      ctx.font = `700 ${size * 0.18}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(code, 0, 0);
  }
  ctx.restore();
  void h;
}

export function makeLabelTexture(b: BottleInput, kind: BottleKind): THREE.CanvasTexture {
  const W = 512;
  const H = 384;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  // paper
  ctx.fillStyle = '#fbfaf5';
  ctx.fillRect(0, 0, W, H);
  const grd = ctx.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.06)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  const sig = b.signal_word || '';
  const band = sig === 'Danger' ? '#c4161c' : sig === 'Warning' ? '#e06a00' : '#1f5fa8';
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 54);
  ctx.fillStyle = '#fff';
  ctx.font = '700 26px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(sig ? sig.toUpperCase() : 'LABORATORY REAGENT', 22, 28);
  ctx.textAlign = 'right';
  ctx.font = '600 20px Arial, sans-serif';
  const formLbl = b.form === 'solid' || b.by_mass ? 'SOLID' : b.form === 'liquid' ? 'LIQUID' : b.form === 'solution' ? 'SOLUTION' : '';
  ctx.fillText(formLbl, W - 22, 28);

  // name
  ctx.textAlign = 'left';
  ctx.fillStyle = '#16181b';
  const name = b.name || 'Reagent';
  const ns = fitText(ctx, name, W - 44, kind === 'dropper' ? 52 : 46);
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(name, 22, 70 + ns);
  // formula
  const formula = prettyFormula(b.formula || '');
  let y = 70 + ns + 14;
  if (formula) {
    const fs = fitText(ctx, formula, W - 44, 42, '600', '"Times New Roman", Georgia, serif');
    ctx.fillStyle = '#23384f';
    ctx.fillText(formula, 22, y + fs);
    y += fs + 10;
  }
  // concentration
  if (b.concentration_m !== undefined && b.concentration_m !== null && b.concentration_m > 0) {
    const cm = b.concentration_m;
    const txt = cm >= 1 ? `${cm.toFixed(cm % 1 === 0 ? 1 : 2)} M` : cm >= 0.01 ? `${cm.toFixed(2)} M` : `${(cm * 1000).toFixed(1)} mM`;
    ctx.font = '700 34px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#16181b';
    ctx.fillText(txt, 22, y + 34);
    y += 44;
  }
  // GHS pictograms
  const codes = (b.ghs || []).slice(0, 4);
  const ps = codes.length > 2 ? 78 : 92;
  let gx = W - 22 - ps / 2;
  const gy = H - 22 - ps / 2 - 18;
  for (let i = codes.length - 1; i >= 0; i--) {
    drawGhs(ctx, gx, gy, ps, codes[i]);
    gx -= ps * 0.92;
  }
  // fine print
  ctx.fillStyle = 'rgba(30,30,30,0.6)';
  ctx.font = '500 15px Arial, sans-serif';
  ctx.textAlign = 'left';
  let hash = 0;
  for (const ch of b.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  ctx.fillText(`Lot ${(hash % 90000) + 10000} · Store tightly closed`, 22, H - 18);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ assembly
export function bottleKindFor(b: BottleInput): BottleKind {
  if (b.dropper) return 'dropper';
  if (b.form === 'solid' || b.by_mass) return 'jar';
  return 'liquid';
}

/** Pipette + rubber bulb (shared geometry); local origin at the pipette tip, pointing up +Y. */
export function makePipette(): THREE.Group {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(
    geo('pipette_tube', () => {
      const pts = [new THREE.Vector2(0.06, 0), new THREE.Vector2(0.12, 0.4), new THREE.Vector2(0.26, 2.4), new THREE.Vector2(0.28, 7.4), new THREE.Vector2(0.34, 7.6)];
      return new THREE.LatheGeometry(pts, 16);
    }),
    pipetteMat()
  );
  tube.renderOrder = 950;
  const bulb = new THREE.Mesh(
    geo('pipette_bulb', () => {
      const pts: THREE.Vector2[] = [new THREE.Vector2(0.42, 0)];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pts.push(new THREE.Vector2(0.42 + Math.sin(t * Math.PI) * 0.38 * (t < 0.7 ? 1 : 1 - (t - 0.7) * 2.5), 0.2 + t * 2.4));
      }
      pts.push(new THREE.Vector2(0, 2.7));
      return new THREE.LatheGeometry(pts, 20);
    }),
    bulbMat()
  );
  bulb.position.y = 7.4;
  bulb.name = 'bulb';
  bulb.castShadow = true;
  g.add(tube, bulb);
  return g;
}

/** Stainless steel spatula (scoop end at the origin pointing +X). */
export function makeSpatula(): THREE.Group {
  const g = new THREE.Group();
  const steel = mat('steel', () => new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 1, roughness: 0.22 }));
  const blade = new THREE.Mesh(
    geo('spat_blade', () => {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0);
      s.quadraticCurveTo(-0.6, 0.65, 0, 0.7);
      s.lineTo(3.2, 0.25);
      s.lineTo(3.2, -0.25);
      s.lineTo(0, -0.7);
      s.quadraticCurveTo(-0.6, -0.65, -0.5, 0);
      const e = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
      e.rotateX(-Math.PI / 2);
      return e;
    }),
    steel
  );
  const handle = new THREE.Mesh(
    geo('spat_handle', () => {
      const c = new THREE.CylinderGeometry(0.18, 0.18, 12, 12);
      c.rotateZ(Math.PI / 2);
      c.translate(9.2, 0.05, 0);
      return c;
    }),
    steel
  );
  blade.castShadow = true;
  handle.castShadow = true;
  g.add(blade, handle);
  return g;
}

export function createBottleAssembly(b: BottleInput): BottleAssembly {
  const kind = bottleKindFor(b);
  const s = SPECS[kind];
  const solid = kind === 'jar';
  const group = new THREE.Group();
  group.name = `bottle_${b.id}`;
  const colour = b.bottle_colour ?? 'clear';
  const contentHex = b.colorHex && b.colorHex !== '' ? b.colorHex : defaultContentColor(solid);

  let far: THREE.Mesh | null = null;
  let near: THREE.Mesh;
  // Opaque white plastic would hide the powder completely, so solid jars are always glass.
  const opaquePlastic = colour === 'white' && kind !== 'jar';
  if (opaquePlastic) {
    near = new THREE.Mesh(bodyGeo(kind), hdpeMat());
    near.castShadow = true;
    near.receiveShadow = true;
  } else {
    const gm = createGlassMesh(bodyGeo(kind), colour === 'amber' ? bottleAmberGlass() : clearGlass());
    near = gm.near;
    far = gm.far;
  }
  near.raycast = () => {};
  if (far) far.raycast = () => {};
  group.add(near);

  let content: THREE.Mesh | null = null;
  if (!opaquePlastic) {
    content = new THREE.Mesh(contentGeo(kind, solid), contentMat(contentHex, solid));
    content.raycast = () => {};
    group.add(content);
  }

  const labelTex = makeLabelTexture(b, kind);
  // transparent so it draws after the (possibly amber) glass it is stuck onto
  const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.75, metalness: 0, transparent: true, emissive: 0xffffff, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const label = new THREE.Mesh(labelGeo(kind), labelMat);
  label.raycast = () => {};
  label.receiveShadow = true;
  group.add(label);

  let cap: THREE.Object3D;
  let dropperParts: THREE.Object3D | null = null;
  if (kind === 'dropper') {
    const d = new THREE.Group();
    const collar = new THREE.Mesh(capGeo(kind), capMat());
    collar.position.y = s.neckTopY - 0.6;
    collar.castShadow = true;
    const pip = makePipette();
    pip.position.y = 0.9;
    // pipette passes through the collar; its bulb sits on top
    pip.scale.setScalar(1);
    const bulb = pip.getObjectByName('bulb')!;
    bulb.position.y = s.neckTopY - 0.6 + s.capH - 0.9 - 0.2;
    d.add(collar, pip);
    group.add(d);
    cap = d;
    dropperParts = d;
  } else {
    const c = new THREE.Mesh(capGeo(kind), colour === 'white' ? whiteCapMat() : capMat());
    c.position.y = s.neckTopY - 0.9;
    c.castShadow = true;
    c.raycast = () => {};
    group.add(c);
    cap = c;
  }
  cap.traverse((o) => ((o as THREE.Mesh).raycast = () => {}));

  const pickProxy = new THREE.Mesh(proxyGeo(kind), proxyMat());
  pickProxy.visible = false;
  pickProxy.userData.pick = { type: 'bottle', id: b.id };
  group.add(pickProxy);
  group.userData.pick = { type: 'bottle', id: b.id };

  const lipLocal = new THREE.Vector3(s.neckR + 0.1, s.neckTopY, 0);
  let hovered = false;
  let glow = 0;

  const asm: BottleAssembly = {
    group,
    kind,
    cap,
    dropperParts,
    pickProxy,
    height: s.height,
    radius: s.R,
    lipLocal,
    fillY: s.fillY,
    contentHex,
    setContentColor: (hex: string) => {
      asm.contentHex = hex;
      if (content) content.material = contentMat(hex, solid);
    },
    setRenderOrderBase: (base: number) => {
      near.renderOrder = base + 5;
      if (far) far.renderOrder = base + 1;
      if (content) content.renderOrder = base + 2;
      label.renderOrder = base + 6;
    },
    setHover: (on: boolean) => {
      hovered = on;
      labelMat.emissiveIntensity = Math.max(glow, hovered ? 0.14 : 0);
    },
    setGlow: (v: number) => {
      glow = Math.max(0, Math.min(1, v)) * 0.5;
      labelMat.emissiveIntensity = Math.max(glow, hovered ? 0.14 : 0);
    },
    dispose: () => {
      labelTex.dispose();
      labelMat.dispose();
      group.parent?.remove(group);
    },
  };
  return asm;
}

export function createGenericBottle(b: Partial<BottleInput> & { id: string; name: string; formula: string }): BottleAssembly {
  return createBottleAssembly({ bottle_colour: 'clear', form: 'solution', ghs: [], signal_word: '', ...b });
}

/** Catalog entry → bottle assembly. */
export function entryToBottleInput(entry: ReagentCatalogEntry): BottleInput {
  return {
    id: entry.id,
    name: entry.name,
    formula: entry.formula,
    concentration_m: entry.form === 'solution' ? entry.concentration_m : undefined,
    ghs: entry.ghs,
    signal_word: entry.signal_word,
    bottle_colour: entry.bottle_colour,
    form: entry.form,
    dropper: entry.dropper,
    by_mass: entry.by_mass,
  };
}

/** Back-compat: create a reagent bottle group for a catalog entry. */
export function createReagentBottle(entry: ReagentCatalogEntry): THREE.Group {
  return createBottleAssembly(entryToBottleInput(entry)).group;
}
