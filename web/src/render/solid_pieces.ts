import * as THREE from 'three';
import { SolidKind } from '../types/sim';
import { VesselProfile, heightForVolume, innerRadiusAt } from './glass_profiles';

/**
 * Solids that are not a settled powder bed or a suspension: pieces that float (ice, wax, flakes), a frozen mass that
 * fills the vessel, a floating powder film, and metal (ribbons of a few tenths of a gram, granules above ~1 mL).
 * Everything is driven by the engine's solid records (volume, colour, kind, floating, remaining fraction); this module
 * owns the meshes and their per-frame motion. Lives in the glass-local frame of the vessel (same as `VesselEffects`).
 */

/** The engine reports a settled bed's bulk volume as mass / density x 1.6 (random loose packing). A single piece or a
 *  frozen mass has no packing voids, so its own volume is the bulk volume divided by that factor. */
export const BED_PACKING = 1.6;

export interface PieceSolid {
  rgb: [number, number, number];
  /** Volume of the material itself, mL. */
  volumeMl: number;
  /** 0..1 fraction still present relative to what was added. */
  remaining: number;
  kind: SolidKind;
  /** Mean particle diameter, micrometres (a floating fine powder is a film, a coarse one is pieces). */
  diameterUm: number;
  /** Visual form reported by the engine: 'bed' | 'monolith' | 'pieces' | 'film'. */
  morphology?: string;
  /** Index of the liquid layer a floating solid rides on (null: the top of the liquid). */
  layer?: number | null;
}

let ribbonGeo: THREE.BufferGeometry | null = null;
/** Curled metal ribbon strip (about 5 cm x 0.3 cm), centred. */
export function getRibbonGeo(): THREE.BufferGeometry {
  if (ribbonGeo) return ribbonGeo;
  const segs = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  const L = 5;
  const W = 0.32;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = (t - 0.5) * L;
    const y = Math.sin(t * Math.PI * 2.2) * 0.35 + t * 0.2;
    const z = Math.cos(t * Math.PI * 1.3) * 0.45;
    const tw = Math.sin(t * 5) * 0.4;
    pos.push(x, y + Math.cos(tw) * W * 0.5, z + Math.sin(tw) * W * 0.5);
    pos.push(x, y - Math.cos(tw) * W * 0.5, z - Math.sin(tw) * W * 0.5);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  ribbonGeo.setIndex(idx);
  ribbonGeo.computeVertexNormals();
  return ribbonGeo;
}

let chunkGeo: THREE.BufferGeometry | null = null;
/** Irregular faceted lump (unit radius): a noisy icosahedron, flat shaded so it reads as a broken crystal / granule. */
function getChunkGeo(): THREE.BufferGeometry {
  if (chunkGeo) return chunkGeo;
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + 0.16 * Math.sin(v.x * 3.1 + 1.3) * Math.cos(v.y * 2.7 + 0.4) + 0.11 * Math.sin(v.z * 4.3 + v.x * 1.9) + 0.07 * Math.cos((v.x + v.y + v.z) * 6.1);
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  chunkGeo = g;
  return g;
}

function hash(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Chunk {
  a: number;
  f: number;
  r: number;
  ph: number;
  tumble: number;
  x: number;
  y: number;
  z: number;
  /** Which solid (index) it belongs to, for remaining-fraction shrinkage. */
  owner: number;
  /** Height as a multiple of the radius (default 0.82: a roundish piece; a slab or a tall rod differs). */
  hScale?: number;
}

interface RibbonSlot {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  scale: number;
  target: number;
  base: number;
  floating: boolean;
  ox: number;
  oz: number;
}

const MAX_RIBBONS = 3;
const MAX_FLOAT_CHUNKS = 40;
const MAX_METAL_CHUNKS = 60;

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();
const tmpQ2 = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export interface PieceContext {
  /** Free-surface height (glass-local cm). */
  fill: number;
  hasLiquid: boolean;
  /** Resting level of the settled bed (or the vessel floor). */
  bedY: number;
  stirRpm: number;
  /** A solid-nucleated gas flux is active (a fizzing metal bobs and darts). */
  fizz: boolean;
  burst: boolean;
  /** World up in the vessel's frame: the free surface stays level while the vessel tilts (pouring). */
  up: THREE.Vector3;
  /** Glass-local height of the top of each liquid layer, bottom first (the last one is the free surface). */
  layerTops?: number[];
}

/** Height of the level free surface above the nominal fill line at glass-local (x, z), as the liquid shader tilts it. */
function surfaceTilt(up: THREE.Vector3, x: number, z: number): number {
  return -(up.x * x + up.z * z) / Math.max(up.y, 0.3);
}

export class SolidPieces {
  public readonly group = new THREE.Group();

  // floating / resting pieces (ice, wax, flakes)
  private floatMesh: THREE.InstancedMesh;
  private floatMat: THREE.MeshPhysicalMaterial;
  private floatChunks: Chunk[] = [];
  private floatVol = 0;
  private floatRem = 1;
  private floatFloats = true;
  private floatSig = '';
  /** One piece of the floating material is a single mass (a frozen sheet, a cast block) rather than many fragments. */
  private floatMono = false;
  /** Liquid layer the floating material rides on (null: the free surface). */
  private floatLayer: number | null = null;
  // frozen mass
  private block: THREE.Mesh | null = null;
  private blockMat: THREE.MeshPhysicalMaterial;
  private blockVol = -1;
  private blockOn = false;
  // floating powder film
  private film: THREE.Mesh;
  private filmMat: THREE.MeshStandardMaterial;
  private filmCover = 0;
  private filmTarget = 0;
  // metal
  private ribbons: RibbonSlot[] = [];
  private metalMesh: THREE.InstancedMesh;
  private metalChunks: Chunk[] = [];
  private metalRadii: number[] = [];
  private metalSig = '';
  private metalFloating: boolean[] = [];
  private metalRem: number[] = [];
  private metalRemEase: number[] = [];

  private floorY: number;

  constructor(private p: VesselProfile) {
    this.floorY = p.innerBottomY;
    this.floatMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.16,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.1,
      ior: 1.31,
      transparent: true,
      opacity: 0.82,
      flatShading: true,
    });
    this.floatMesh = new THREE.InstancedMesh(getChunkGeo(), this.floatMat, MAX_FLOAT_CHUNKS);
    this.floatMesh.count = 0;
    this.floatMesh.visible = false;
    this.floatMesh.frustumCulled = false;
    this.floatMesh.raycast = () => {};
    this.floatMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.blockMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0,
      clearcoat: 0.4,
      envMapIntensity: 1.0,
      ior: 1.31,
      transparent: true,
      opacity: 0.86,
      side: THREE.DoubleSide,
    });

    this.filmMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false });
    const fg = new THREE.CircleGeometry(1, 40);
    const fpos = fg.attributes.position as THREE.BufferAttribute;
    for (let i = 1; i < fpos.count; i++) {
      const x = fpos.getX(i);
      const y = fpos.getY(i);
      const a = Math.atan2(y, x);
      const f = 1 + 0.1 * Math.sin(a * 5 + 1) + 0.06 * Math.sin(a * 9 + 3);
      fpos.setXY(i, x * f, y * f);
    }
    fg.rotateX(-Math.PI / 2);
    this.film = new THREE.Mesh(fg, this.filmMat);
    this.film.visible = false;
    this.film.raycast = () => {};

    const metalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.34, flatShading: true });
    this.metalMesh = new THREE.InstancedMesh(getChunkGeo(), metalMat, MAX_METAL_CHUNKS);
    this.metalMesh.count = 0;
    this.metalMesh.visible = false;
    this.metalMesh.frustumCulled = false;
    this.metalMesh.raycast = () => {};
    this.metalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const ribbonLen = Math.max(0.35, Math.min(1, (p.rimInnerRadius * 2 - 0.4) / 5));
    for (let k = 0; k < MAX_RIBBONS; k++) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xc8c8cc, metalness: 1, roughness: 0.32, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(getRibbonGeo(), mat);
      mesh.visible = false;
      mesh.castShadow = false;
      mesh.raycast = () => {};
      const ang = k * 2.1 + 0.4;
      const off = k === 0 ? 0 : Math.min(p.rimInnerRadius * 0.4, 1.3);
      this.ribbons.push({ mesh, mat, scale: 0, target: 0, base: ribbonLen, floating: false, ox: Math.cos(ang) * off, oz: Math.sin(ang) * off });
      this.group.add(mesh);
    }
    this.group.add(this.floatMesh, this.film, this.metalMesh);
  }

  public setRenderOrder(base: number) {
    this.floatMesh.renderOrder = base + 4;
    this.film.renderOrder = base + 4;
    this.metalMesh.renderOrder = base + 4;
    if (this.block) this.block.renderOrder = base + 4;
    for (const r of this.ribbons) r.mesh.renderOrder = base + 4;
  }

  /** Hides everything (glass shattered). */
  public hide() {
    this.floatMesh.visible = false;
    this.film.visible = false;
    this.metalMesh.visible = false;
    if (this.block) this.block.visible = false;
    for (const r of this.ribbons) r.mesh.visible = false;
  }

  /**
   * Engine update. `floaters`: non-metal solids that float (density below the liquid's, or ice in water) -- they are
   * not part of the bed or the cloud. `metals`: the metal solids, biggest first.
   */
  public setSolids(floaters: Array<PieceSolid & { floating: boolean }>, metals: Array<PieceSolid & { floating: boolean }>) {
    this.setFloaters(floaters);
    this.setMetals(metals);
  }

  // ------------------------------------------------------------------ floaters / frozen mass / film
  private setFloaters(list: Array<PieceSolid & { floating: boolean }>) {
    let vol = 0;
    let fineVol = 0;
    let rem = 0;
    let wsum = 0;
    let cr = 0, cg = 0, cb = 0;
    let clear = 0;
    for (const s of list) {
      const w = Math.max(1e-6, s.volumeMl);
      const fine = s.diameterUm < 300 && s.kind !== 'crystal';
      if (fine) fineVol += s.volumeMl;
      else vol += s.volumeMl;
      rem += s.remaining * w;
      wsum += w;
      cr += s.rgb[0] * w;
      cg += s.rgb[1] * w;
      cb += s.rgb[2] * w;
      if (s.kind === 'crystal') clear += w;
    }
    if (wsum > 0) {
      tmpC.setRGB(cr / wsum, cg / wsum, cb / wsum);
      this.floatMat.color.copy(tmpC);
      this.blockMat.color.copy(tmpC);
      this.filmMat.color.copy(tmpC);
      const translucent = clear / wsum > 0.5;
      this.floatMat.opacity = translucent ? 0.8 : 0.97;
      this.floatMat.transparent = translucent;
      this.floatMat.clearcoat = translucent ? 0.5 : 0.1;
      this.blockMat.opacity = translucent ? 0.86 : 0.98;
      this.blockMat.transparent = translucent;
      this.floatRem = rem / wsum;
    }
    this.floatVol = vol;
    this.filmTarget = fineVol;
    this.floatFloats = list.length === 0 || list.some((s) => s.floating);
    this.floatMono = list.some((s) => s.morphology === 'monolith');
    // the layer of the biggest floating solid decides where the material rides
    let big = -1;
    this.floatLayer = null;
    for (const s of list) {
      if (s.layer !== null && s.layer !== undefined && s.volumeMl > big) {
        big = s.volumeMl;
        this.floatLayer = s.layer;
      }
    }
    if (vol <= 0) {
      this.floatChunks = [];
      this.floatSig = '';
      this.floatMesh.count = 0;
      this.floatMesh.visible = false;
    }
  }

  private layoutFloaters(dry: boolean) {
    const V = this.floatVol;
    // a single mass (a frozen sheet, a cast block) is one piece; loose material is a handful of fragments (about 6 mL each)
    const n = this.floatMono ? 1 : Math.max(1, Math.min(MAX_FLOAT_CHUNKS, Math.ceil(V / 6)));
    const sig = `${n}|${Math.round(V * 4)}|${dry ? 1 : 0}|${this.floatMono ? 1 : 0}`;
    if (sig === this.floatSig) return;
    this.floatSig = sig;
    // pieces share the volume unevenly (a few big cubes among small shards)
    let wsum = 0;
    const w: number[] = [];
    for (let i = 0; i < n; i++) {
      const x = 0.5 + hash(i, 21);
      w.push(x);
      wsum += x;
    }
    this.floatChunks = [];
    for (let i = 0; i < n; i++) {
      const v = (V * w[i]) / wsum;
      // an irregular piece fills about half its bounding sphere
      let r = Math.max(0.1, Math.cbrt((3 * v) / (4 * Math.PI * 0.55)));
      let hScale: number | undefined;
      if (this.floatMono) {
        // one mass wider than the vessel is a slab: keep the volume, flatten it to fit
        const rMax = Math.max(0.3, this.p.rimInnerRadius * 0.85);
        if (r > rMax) {
          hScale = Math.min(3, Math.pow(r / rMax, 3) * 0.82);
          r = rMax;
        }
      }
      this.floatChunks.push({
        a: i * 2.399963 + hash(i, 22) * 0.5,
        f: this.floatMono ? 0 : Math.sqrt((i + 0.5) / n),
        r,
        hScale,
        ph: hash(i, 23) * 6.28,
        tumble: 0.2 + hash(i, 24) * 0.5,
        x: 0,
        y: 0,
        z: 0,
        owner: 0,
      });
    }
    this.floatMesh.count = n;
    for (let i = 0; i < n; i++) {
      this.floatMesh.setColorAt(i, tmpC.setScalar(0.92 + hash(i, 25) * 0.12));
    }
    if (this.floatMesh.instanceColor) this.floatMesh.instanceColor.needsUpdate = true;
  }

  private ensureBlock(V: number) {
    const p = this.p;
    const yTop = Math.min(p.innerTopY - 0.2, heightForVolume(p, V));
    if (this.block && Math.abs(V - this.blockVol) / Math.max(V, 1) < 0.01) return;
    this.blockVol = V;
    const pts: THREE.Vector2[] = [];
    for (const q of p.inner) {
      if (q.y < yTop) pts.push(new THREE.Vector2(Math.max(0, q.x - 0.03), q.y + 0.012));
    }
    const rTop = Math.max(0.1, innerRadiusAt(p, yTop) - 0.03);
    pts.push(new THREE.Vector2(rTop, yTop));
    // slightly domed, rough top
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const f = 1 - i / steps;
      pts.push(new THREE.Vector2(rTop * f, yTop + 0.07 * Math.sin(i * 2.3) + 0.12 * (1 - f * f) * 0.4));
    }
    const g = new THREE.LatheGeometry(pts, 48);
    if (!this.block) {
      this.block = new THREE.Mesh(g, this.blockMat);
      this.block.raycast = () => {};
      this.block.frustumCulled = false;
      this.group.add(this.block);
    } else {
      this.block.geometry.dispose();
      this.block.geometry = g;
    }
  }

  // ------------------------------------------------------------------ metals
  private setMetals(list: Array<PieceSolid & { floating: boolean }>) {
    const sigParts: string[] = [];
    const chunkMetals: Array<{ s: PieceSolid & { floating: boolean }; idx: number }> = [];
    this.metalRem = [];
    this.metalFloating = [];
    let ribbonIdx = 0;
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      if (s.volumeMl >= 1.0 && chunkMetals.length < 4) {
        chunkMetals.push({ s, idx: chunkMetals.length });
        this.metalRem.push(Math.max(0.05, Math.min(1, s.remaining)));
        this.metalFloating.push(s.floating);
        const n = Math.max(5, Math.min(Math.floor(MAX_METAL_CHUNKS / 2), Math.round(s.volumeMl / 0.35)));
        sigParts.push(`${n}:${Math.round(s.volumeMl * 3)}:${s.rgb.map((c) => c.toFixed(2)).join(',')}`);
      } else if (ribbonIdx < MAX_RIBBONS) {
        const r = this.ribbons[ribbonIdx++];
        // size follows the amount: 0.17 mL is the 5 cm ribbon the model was drawn for
        const size = Math.max(0.55, Math.min(1.5, Math.cbrt(Math.max(s.volumeMl, 0.01) / 0.17)));
        r.target = Math.max(0.05, Math.min(1, s.remaining));
        r.floating = s.floating;
        r.base = Math.max(0.35, Math.min(1, (this.p.rimInnerRadius * 2 - 0.4) / 5)) * size;
        r.mat.color.setRGB(s.rgb[0], s.rgb[1], s.rgb[2]);
      }
    }
    for (let k = ribbonIdx; k < MAX_RIBBONS; k++) this.ribbons[k].target = 0;
    const sig = sigParts.join('|');
    if (sig !== this.metalSig) {
      this.metalSig = sig;
      this.metalChunks = [];
      this.metalRadii = [];
      let cursor = 0;
      for (const { s, idx } of chunkMetals) {
        const n = Math.max(5, Math.min(Math.floor(MAX_METAL_CHUNKS / 2), Math.round(s.volumeMl / 0.35)));
        for (let i = 0; i < n && cursor < MAX_METAL_CHUNKS; i++, cursor++) {
          const v = (s.volumeMl * (0.6 + hash(cursor, 31) * 0.8)) / n;
          const r = Math.max(0.08, Math.cbrt((3 * v) / (4 * Math.PI * 0.6)));
          this.metalChunks.push({
            a: cursor * 2.399963,
            f: Math.sqrt((i + 0.5) / n),
            r,
            ph: hash(cursor, 32) * 6.28,
            tumble: 0.1 + hash(cursor, 33) * 0.4,
            x: 0,
            y: 0,
            z: 0,
            owner: idx,
          });
          this.metalMesh.setColorAt(cursor, tmpC.setRGB(s.rgb[0], s.rgb[1], s.rgb[2]).multiplyScalar(0.85 + hash(cursor, 34) * 0.3));
        }
      }
      this.metalRemEase = chunkMetals.map(() => 1);
      this.metalMesh.count = this.metalChunks.length;
      if (this.metalMesh.instanceColor) this.metalMesh.instanceColor.needsUpdate = true;
    }
  }

  /** A point on a metal piece where gas bubbles nucleate (glass-local), or false when there is no metal in view. */
  public nucleationPoint(out: THREE.Vector3, maxY: number): boolean {
    const vis = this.ribbons.filter((r) => r.mesh.visible);
    const nChunk = this.metalMesh.visible ? this.metalChunks.length : 0;
    const total = vis.length + (nChunk > 0 ? 1 : 0);
    if (total === 0) return false;
    const pick = Math.floor(Math.random() * total);
    if (pick < vis.length) {
      const r = vis[pick].mesh;
      out.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8);
      r.localToWorld(out);
      this.group.worldToLocal(out);
    } else {
      const c = this.metalChunks[Math.floor(Math.random() * nChunk)];
      out.set(c.x + (Math.random() - 0.5) * c.r, c.y + c.r * 0.5, c.z + (Math.random() - 0.5) * c.r);
    }
    out.y = Math.min(out.y, maxY);
    return true;
  }

  // ------------------------------------------------------------------ per frame
  public update(dt: number, time: number, ctx: PieceContext) {
    if (ctx.burst) {
      this.hide();
      return;
    }
    const p = this.p;
    this.updateFloaters(dt, time, ctx);
    this.updateFilm(dt, time, ctx);
    this.updateMetals(dt, time, ctx);
    void p;
  }

  private updateFloaters(dt: number, time: number, ctx: PieceContext) {
    const p = this.p;
    const V = this.floatVol;
    const rem = Math.max(0.02, this.floatRem);
    const vEff = V * rem;
    // a frozen mass that fills the vessel is a cast block; so is any large single mass lying on the floor of the liquid
    const showBlock = vEff > 12 && (!ctx.hasLiquid || (this.floatMono && !this.floatFloats));
    if (vEff < 0.004) {
      this.floatMesh.visible = false;
      if (this.block) this.block.visible = false;
      this.blockOn = false;
      return;
    }
    if (showBlock) {
      this.ensureBlock(vEff);
      if (this.block) this.block.visible = true;
      this.blockOn = true;
      this.floatMesh.visible = false;
      return;
    }
    if (this.block) this.block.visible = false;
    this.blockOn = false;
    this.layoutFloaters(!ctx.hasLiquid);
    const n = this.floatChunks.length;
    if (n === 0) return;
    const swirl = ctx.stirRpm > 0 ? Math.min(2.5, (ctx.stirRpm / 60) * 6.283 * 0.07) : 0;
    const float = ctx.hasLiquid && this.floatFloats;
    const shrink = Math.cbrt(rem);
    // floating material rides the top of the layer it is in (ice on water, a wax disc between water and a dense organic)
    const tops = ctx.layerTops;
    const layerTop = float && this.floatLayer !== null && tops && this.floatLayer >= 0 && this.floatLayer < tops.length ? tops[this.floatLayer] : ctx.fill;
    const yRef = float ? layerTop : Math.max(ctx.bedY, p.innerBottomY);
    const rSurf = Math.max(0.2, innerRadiusAt(p, Math.min(float ? layerTop : p.innerBottomY + 0.5, p.innerTopY)));
    for (let i = 0; i < n; i++) {
      const c = this.floatChunks[i];
      const r = c.r * shrink;
      const h = r * (c.hScale ?? 0.82);
      c.a += swirl * dt + Math.sin(time * 0.31 + c.ph) * 0.0015;
      const R = Math.max(0, rSurf - r * 1.05);
      const rr = Math.min(R, c.f * R * (float ? 1 : 0.9) + Math.sin(time * 0.23 + c.ph) * 0.12 * (float ? 1 : 0));
      c.x = Math.cos(c.a) * rr;
      c.z = Math.sin(c.a) * rr;
      const bob = float ? Math.sin(time * 1.1 + c.ph) * 0.025 * (1 + ctx.stirRpm / 400) : 0;
      // a floating piece rides ~92 % submerged (ice in water); a resting one sits on the floor / bed
      c.y = float ? yRef - 0.84 * h + bob + surfaceTilt(ctx.up, c.x, c.z) : yRef + h * 0.85 + (i % 3) * 0.02;
      tmpP.set(c.x, c.y, c.z);
      tmpQ.setFromEuler(tmpE.set(c.ph * 0.3 + Math.sin(time * 0.4 + c.ph) * 0.12 * c.tumble, c.ph + time * 0.05 * c.tumble, Math.cos(time * 0.35 + c.ph) * 0.1 * c.tumble));
      tmpS.set(r, h, r * (0.9 + 0.2 * hash(i, 26)));
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.floatMesh.setMatrixAt(i, tmpM);
    }
    this.floatMesh.count = n;
    this.floatMesh.visible = true;
    this.floatMesh.instanceMatrix.needsUpdate = true;
  }

  private updateFilm(dt: number, time: number, ctx: PieceContext) {
    const p = this.p;
    const area = Math.PI * Math.pow(Math.max(0.3, innerRadiusAt(p, Math.min(ctx.fill, p.innerTopY))), 2);
    // a monolayer of ~0.1 mm powder over the whole surface is ~0.01 mL per cm2
    const want = ctx.hasLiquid && this.filmTarget > 1e-4 ? Math.min(1, this.filmTarget / (area * 0.01)) : 0;
    this.filmCover += (want - this.filmCover) * Math.min(1, dt * 2);
    if (this.filmCover < 0.02) {
      this.film.visible = false;
      return;
    }
    const R = Math.max(0.15, innerRadiusAt(p, Math.min(ctx.fill, p.innerTopY)) - 0.06);
    const s = R * (0.25 + 0.75 * Math.sqrt(this.filmCover));
    this.film.visible = true;
    this.film.scale.set(s, 1, s);
    const fx = Math.sin(time * 0.2) * R * 0.04;
    const fz = Math.cos(time * 0.17) * R * 0.04;
    this.film.position.set(fx, ctx.fill + 0.015, fz);
    // lie in the level free surface: tilt the disc's normal to world up, then spin it slowly about that normal
    tmpQ.setFromUnitVectors(Y_AXIS, tmpP.copy(ctx.up).normalize());
    this.film.quaternion.copy(tmpQ).multiply(tmpQ2.setFromAxisAngle(Y_AXIS, time * 0.03));
  }

  private updateMetals(dt: number, time: number, ctx: PieceContext) {
    const p = this.p;
    // ribbons
    for (const r of this.ribbons) {
      r.scale += (r.target - r.scale) * Math.min(1, dt * 1.5);
      if (r.scale <= 0.03) {
        r.mesh.visible = false;
        continue;
      }
      r.mesh.visible = true;
      const s = r.base * r.scale;
      r.mesh.scale.set(s, r.base * (0.6 + 0.4 * r.scale), r.base);
      const yFloat = ctx.hasLiquid ? Math.max(p.innerBottomY + 0.4, ctx.fill - 0.35) : p.innerBottomY + 0.3;
      const yBed = ctx.bedY + 0.35;
      const yT = r.floating ? yFloat : yBed;
      const first = r.mesh.userData.placed !== true;
      if (first) {
        r.mesh.position.set(r.ox, yT, r.oz);
        r.mesh.userData.placed = true;
      }
      r.mesh.position.x = r.ox;
      r.mesh.position.z = r.oz;
      r.mesh.position.y += (yT - r.mesh.position.y) * Math.min(1, dt * 2);
      r.mesh.position.y += ctx.fizz ? Math.sin(time * 9 + r.ox * 3) * 0.04 : 0;
      r.mesh.rotation.set(0.25 + Math.sin(time * 0.7) * (ctx.fizz ? 0.08 : 0), time * (ctx.fizz ? 0.25 : 0.02) + r.ox, 0.1);
    }
    // granules
    const n = this.metalChunks.length;
    if (n === 0) {
      this.metalMesh.visible = false;
      return;
    }
    for (let k = 0; k < this.metalRemEase.length; k++) {
      this.metalRemEase[k] += ((this.metalRem[k] ?? 1) - this.metalRemEase[k]) * Math.min(1, dt * 1.5);
    }
    const rSurf = Math.max(0.2, innerRadiusAt(p, Math.min(ctx.hasLiquid ? ctx.fill : p.innerBottomY + 0.5, p.innerTopY)));
    for (let i = 0; i < n; i++) {
      const c = this.metalChunks[i];
      const r = c.r * Math.cbrt(this.metalRemEase[c.owner] ?? 1);
      const floats = !!this.metalFloating[c.owner] && ctx.hasLiquid;
      const R = Math.max(0, rSurf - r * 1.1) * 0.9;
      const orbit = floats && ctx.fizz ? time * 0.4 * (0.5 + c.tumble) : 0;
      const rr = c.f * R;
      c.x = Math.cos(c.a + orbit) * rr;
      c.z = Math.sin(c.a + orbit) * rr;
      c.y = floats ? ctx.fill - r * 0.35 + (ctx.fizz ? Math.sin(time * 8 + c.ph) * 0.03 : 0) : Math.max(ctx.bedY, p.innerBottomY) + r * 0.8;
      tmpP.set(c.x, c.y, c.z);
      tmpQ.setFromEuler(tmpE.set(c.ph, c.ph * 2 + (floats && ctx.fizz ? time * c.tumble : 0), c.ph * 0.5));
      tmpS.set(r, r * 0.8, r * 0.95);
      tmpM.compose(tmpP, tmpQ, tmpS);
      this.metalMesh.setMatrixAt(i, tmpM);
    }
    this.metalMesh.count = n;
    this.metalMesh.visible = true;
    this.metalMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose() {
    this.floatMat.dispose();
    this.floatMesh.dispose();
    this.blockMat.dispose();
    if (this.block) this.block.geometry.dispose();
    this.filmMat.dispose();
    this.film.geometry.dispose();
    (this.metalMesh.material as THREE.Material).dispose();
    this.metalMesh.dispose();
    for (const r of this.ribbons) r.mat.dispose();
  }
}
