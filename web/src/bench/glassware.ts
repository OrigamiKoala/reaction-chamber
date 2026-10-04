import * as THREE from 'three';
import { VesselState } from '../types';
import { VesselSnapshot, OpticsTables } from '../types/sim';
import { VesselEffects } from '../render/effects';
import {
  VesselProfile,
  getProfile,
  heightForVolume,
  innerRadiusAt,
  outerRadiusAt,
  scaleReadingForVolume,
  vesselFootprint,
  vesselHeight,
} from '../render/glass_profiles';
import { createGlassMesh, createSolidMesh, polyGlass } from '../render/glass_material';
import { LiquidBody } from '../render/liquid_material';
import { BathVisual } from '../render/bath';
import { blobShadowTexture, graduationTexture, labelTexture, ringGlowTexture, softSpriteTexture } from '../render/textures';
import { buildAccessories, buildSupport } from '../render/glass_accessories';
import { createGenericBottle } from '../equipment/bottle';

/** Frozen contract (see BENCH_REWORK_PLAN.md). Units: 1 scene unit = 1 cm; group origin = bench contact point. */
export interface GlasswareMeshBundle {
  group: THREE.Group;
  glassMesh: THREE.Mesh;
  liquidMesh: THREE.Mesh;
  vesselState: VesselState;
  effects: VesselEffects;
  updateLiquid: (volMl: number, color: string, opacity?: number) => void;
  applyVisual: (snap: VesselSnapshot, dtSeconds: number, opticsTables?: OpticsTables | null) => void;
  /** Magnetic stir bar spin + vortex; 0 = off. */
  setStirring: (rpm: number) => void;
  /** Stirrer speed acting on the contents now (rpm, 0 = still). */
  stirRpm: () => number;
  /** Group-local Y of the liquid surface when the vessel holds `ml` mL (the profile's volume -> level table, not linear). */
  levelLocalYForVolume: (ml: number) => number;
  setSelected: (on: boolean) => void;
  /** Current apparent liquid colour (for pour streams), '#rrggbb'. */
  getLiquidColorHex: () => string;
}

/** Scene-internal extension of the bundle (not part of the frozen contract). */
export interface VesselBundle extends GlasswareMeshBundle {
  profile: VesselProfile;
  /** Frame of the glass itself (lifted for the rack / stand / cork ring). */
  glassRoot: THREE.Group;
  liquid: LiquidBody;
  pickProxy: THREE.Mesh;
  lastSnapshot: VesselSnapshot | null;
  /** Assembly height above the bench and footprint radius (cm). */
  height: number;
  footprint: number;
  tick: (dt: number, time: number) => void;
  setHover: (on: boolean) => void;
  setRenderOrderBase: (base: number) => void;
  /** World Y of whatever the vessel stands on (contact shadow placement). */
  setGroundY: (y: number) => void;
  /** Pour lip (spout) in group coordinates. */
  lipLocal: () => THREE.Vector3;
  /** Probe placement inside the vessel (group coords): tip position + axis direction. */
  probeLocal: (slot: 'thermo' | 'ph', probeRadius: number) => { tip: THREE.Vector3; up: THREE.Vector3 };
  /** Group-local Y of the top of the stopper (pressure gauge mount). */
  stopperTopLocal: () => number;
  /** Liquid surface in group coordinates. */
  surfaceLocalY: () => number;
  /** True liquid volume (mL) at the level that is drawn right now (animated), i.e. what the level line shows. */
  levelReadingMl: () => number;
  /** Reading on the printed scale: = `levelReadingMl()` for upward scales; burettes / graduated pipettes: volume delivered since the 0 mark (can be negative above it). */
  scaleReadingMl: () => number;
  /**
   * Group-local point beside the vessel at the liquid surface height, for a '47.3 mL' HUD tag. Default side: left
   * (-X) when the vessel has a spout (+X), otherwise right.
   */
  readingAnchorLocal: (side?: 1 | -1) => THREE.Vector3;
  /** Opening of a burette / pipette / funnel stem / syringe nozzle in group coordinates (null = closed vessel). */
  tipLocal: () => THREE.Vector3 | null;
  /** Stopcock (burette, separatory funnel): 0 = closed (lever across the tube), 1 = open (lever along it). No-op without a stopcock. */
  setStopcock: (open01: number) => void;
  /** Stopcock centre in group coordinates (null = none). */
  stopcockLocal: () => THREE.Vector3 | null;
  /** Gas syringe: place the piston at `ml` on the scale (0 = pushed in). No-op for other vessels. */
  setPlungerMl: (ml: number) => void;
  /** Petri dish / gas jar cover (hidden by default). No-op for other vessels. */
  setLidVisible: (on: boolean) => void;
  isBurst: () => boolean;
  /** Support visibility: test-tube rack / cork ring / ring stand (hidden while the glass is lifted for pouring). */
  setRackVisible: (on: boolean) => void;
  dispose: () => void;
}

const warned = new Set<string>();
/** console.warn once per key, so a per-frame failure cannot flood the console (or take the whole frame down). */
function warnOnce(key: string, ...args: unknown[]) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[glassware] ${key}`, ...args);
}

let defaultOptics: OpticsTables | null = null;
/** Optics tables used when applyVisual is called without them. */
export function setDefaultOpticsTables(t: OpticsTables | null) {
  defaultOptics = t;
}

// ------------------------------------------------------------------ shared geometry
const shellCache = new Map<string, THREE.BufferGeometry>();
interface DecalData {
  geo: THREE.BufferGeometry;
  tex: THREE.Texture;
}
interface DecalSet {
  scale: DecalData | null;
  label: DecalData | null;
  /** Smallest distance (cm) between neighbouring marks: sets the thickness of the level line. */
  minSpacing: number;
}
const decalCache = new Map<string, DecalSet>();
const footCache = new Map<string, THREE.BufferGeometry>();
let blobMat: THREE.MeshBasicMaterial | null = null;
let planeGeo: THREE.PlaneGeometry | null = null;
let bandGeo: THREE.CylinderGeometry | null = null;
let proxyMat: THREE.MeshBasicMaterial | null = null;
const decalMat = new Map<string, THREE.MeshBasicMaterial>();

/** Horizontal direction the key light's shadows fall (the key sits at (-55, 170, 95), `lab_room.ts`). */
const KEY_DIR_X = 55 / Math.hypot(55, 95);
const KEY_DIR_Z = -95 / Math.hypot(55, 95);

function unitPlane(): THREE.PlaneGeometry {
  if (!planeGeo) {
    planeGeo = new THREE.PlaneGeometry(1, 1);
    planeGeo.rotateX(-Math.PI / 2);
  }
  return planeGeo;
}

/** Unit open cylinder (radius 1, height 1): scaled into thin rings (calibration ring, level line). */
function unitBand(): THREE.CylinderGeometry {
  if (!bandGeo) bandGeo = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true);
  return bandGeo;
}

function shellGeometry(p: VesselProfile): THREE.BufferGeometry {
  let g = shellCache.get(p.type);
  if (g) return g;
  g = new THREE.LatheGeometry(p.shell, 96);
  if (p.spout > 0) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    const spoutH = 0.9 + p.rimInnerRadius * 0.12;
    const y0 = p.rimY - spoutH;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y <= y0) continue;
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const a = Math.atan2(z, x);
      const w = Math.exp(-Math.pow(a / 0.3, 2));
      if (w < 1e-3) continue;
      const f = Math.pow((y - y0) / spoutH, 2.2);
      const r = Math.hypot(x, z);
      const nr = r + p.spout * w * f;
      pos.setXYZ(i, (x / r) * nr, y - 0.12 * w * f, (z / r) * nr);
    }
    g.computeBoundingSphere();
  }
  shellCache.set(p.type, g);
  return g;
}

/** Lathe patch hugging the outer wall between yA and yB, centred on +Z (the side facing the camera). */
function patchGeometry(p: VesselProfile, yA: number, yB: number, phiLen: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const N = THREE.MathUtils.clamp(Math.ceil((yB - yA) / 0.3), 8, 220);
  for (let j = 0; j <= N; j++) {
    const y = yA + ((yB - yA) * j) / N;
    pts.push(new THREE.Vector2(outerRadiusAt(p, y) + 0.012, y));
  }
  return new THREE.LatheGeometry(pts, Math.max(12, Math.ceil(phiLen / 0.07)), -phiLen / 2, phiLen);
}

function decalsFor(p: VesselProfile): DecalSet {
  const hit = decalCache.get(p.type);
  if (hit) return hit;
  const set: DecalSet = { scale: null, label: null, minSpacing: 0.5 };

  if (p.graduations.length) {
    const marks = p.graduations.map((g) => ({ y: heightForVolume(p, g.ml), g })).sort((a, b) => a.y - b.y);
    const yMin = marks[0].y;
    const yMax = marks[marks.length - 1].y;
    let minGap = Infinity;
    for (let i = 1; i < marks.length; i++) {
      const d = marks[i].y - marks[i - 1].y;
      if (d > 1e-4) minGap = Math.min(minGap, d);
    }
    if (!isFinite(minGap)) minGap = 0.5;
    const labelled = marks.filter((m) => m.g.label);
    let minLab = 1.2;
    for (let i = 1; i < labelled.length; i++) minLab = Math.min(minLab, labelled[i].y - labelled[i - 1].y);
    const maxChars = Math.max(1, ...labelled.map((m) => m.g.label!.length));
    const rMid = Math.max(0.25, outerRadiusAt(p, yMin + (yMax - yMin) * 0.6));
    const W = Math.min(2.05 * rMid, 3.6);
    const phi = W / rMid;
    const font = THREE.MathUtils.clamp(Math.min(0.58, 0.55 * minLab, (0.34 * W) / (maxChars * 0.6)), 0.18, 0.58);
    const yA = Math.max(p.innerBottomY, yMin - 0.3);
    const limit = p.rimY - 0.3;
    const yB = Math.min(limit, yMax + font * 3.1);
    const title: { text: string; y: number; sizeCm: number }[] = [];
    const t1 = yMax + font * 1.5;
    if (p.gradTitle && t1 + font * 0.6 <= yB) title.push({ text: p.gradTitle, y: t1 - yA, sizeCm: Math.min(font * 1.15, (0.9 * W) / (p.gradTitle.length * 0.62)) });
    const t2 = t1 + font * 1.25;
    if (p.gradNote && title.length && t2 + font * 0.4 <= yB) title.push({ text: p.gradNote, y: t2 - yA, sizeCm: Math.min(font * 0.7, (0.9 * W) / (p.gradNote.length * 0.62)) });
    const tex = graduationTexture({
      key: p.type,
      widthCm: W,
      heightCm: yB - yA,
      marks: marks.map((m) => ({ y: m.y - yA, tier: (m.g.major ? 2 : m.g.mid ? 1 : 0) as 0 | 1 | 2, label: m.g.label })),
      fontCm: font,
      minSpacingCm: minGap,
      title,
    });
    set.scale = { geo: patchGeometry(p, yA, yB, phi), tex };
    set.minSpacing = minGap;
  }

  if (p.label) {
    const yA = Math.max(p.innerBottomY + 0.2, p.label.y - p.label.h / 2);
    const yB = Math.min(p.rimY - 0.3, p.label.y + p.label.h / 2);
    const r = Math.max(0.25, outerRadiusAt(p, (yA + yB) / 2));
    const W = Math.min(2.0 * r, 3.4);
    set.label = {
      geo: patchGeometry(p, yA, yB, W / r),
      tex: labelTexture(p.type, p.label.lines, W, yB - yA),
    };
  }
  decalCache.set(p.type, set);
  return set;
}

function getDecalMaterial(key: string, tex: THREE.Texture) {
  let m = decalMat.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    decalMat.set(key, m);
  }
  return m;
}

function footGeometry(p: VesselProfile): THREE.BufferGeometry {
  const key = `${p.footRadius.toFixed(2)}_${p.footHeight.toFixed(2)}`;
  let g = footCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(p.footRadius, p.footRadius * 1.02, p.footHeight, 6, 1);
    g.translate(0, p.footHeight / 2, 0);
    footCache.set(key, g);
  }
  return g;
}

function sharedBlobMat() {
  if (!blobMat) {
    blobMat = new THREE.MeshBasicMaterial({
      map: blobShadowTexture(),
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
  }
  return blobMat;
}

function sharedProxyMat() {
  if (!proxyMat) proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  return proxyMat;
}

/** Near/far shell pair for the vessel material (glass, translucent poly, opaque porcelain / plastic). */
function createShell(p: VesselProfile, geo: THREE.BufferGeometry): { near: THREE.Mesh; far: THREE.Mesh } {
  if (p.material === 'porcelain' || p.material === 'plastic') return createSolidMesh(geo, p.material);
  if (p.material === 'poly') return createGlassMesh(geo, polyGlass());
  return createGlassMesh(geo);
}

// ------------------------------------------------------------------ factory
export function createGlassware(state: VesselState): VesselBundle {
  const p = getProfile(state.type);
  const group = new THREE.Group();
  group.name = `vessel_${state.id}`;
  group.userData.pick = { type: 'vessel', id: state.id };

  const glassRoot = new THREE.Group();
  glassRoot.position.y = p.baseOffsetY;
  group.add(glassRoot);

  // glass shell (near mesh is the public glassMesh; far mesh is its child)
  const { near: glassMesh, far: glassFar } = createShell(p, shellGeometry(p));
  glassMesh.raycast = () => {};
  glassFar.raycast = () => {};
  glassRoot.add(glassMesh);

  const extraGlass: THREE.Mesh[] = [];
  if (p.footHeight > 0) {
    const foot = createGlassMesh(footGeometry(p));
    foot.near.raycast = () => {};
    foot.far.raycast = () => {};
    glassRoot.add(foot.near);
    extraGlass.push(foot.near);
  }

  // accessories: stopcock, side arm, plunger, teat, lid, perforated plate, ground-glass joint band
  const acc = buildAccessories(p);
  glassRoot.add(acc.group);
  for (const g of acc.glass) extraGlass.push(g);

  // printed scale (front and back, each readable from outside), enamel label, calibration ring
  const decals = decalsFor(p);
  const overlays: THREE.Mesh[] = [...acc.overlays];
  if (decals.scale) {
    const mat = getDecalMaterial(p.type, decals.scale.tex);
    for (const rotY of [0, Math.PI]) {
      const m = new THREE.Mesh(decals.scale.geo, mat);
      m.rotation.y = rotY;
      m.raycast = () => {};
      glassRoot.add(m);
      overlays.push(m);
    }
  }
  if (decals.label) {
    const mat = getDecalMaterial(p.type + '_label', decals.label.tex);
    for (const rotY of [0, Math.PI]) {
      const m = new THREE.Mesh(decals.label.geo, mat);
      m.rotation.y = rotY;
      m.raycast = () => {};
      glassRoot.add(m);
      overlays.push(m);
    }
  }
  const bandMats: THREE.MeshBasicMaterial[] = [];
  const makeBand = (color: number, opacity: number): { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
    });
    bandMats.push(mat);
    const mesh = new THREE.Mesh(unitBand(), mat);
    mesh.raycast = () => {};
    return { mesh, mat };
  };
  if (p.calibrationY !== undefined) {
    // single full-circle calibration ring: dark ink on a light halo, like the etched ring on a real flask / pipette
    const r = outerRadiusAt(p, p.calibrationY) + 0.014;
    const th = p.kind === 'volumetric' ? 0.09 : 0.075;
    const halo = makeBand(0xffffff, 0.55);
    halo.mesh.scale.set(r + 0.004, th * 2.1, r + 0.004);
    halo.mesh.position.y = p.calibrationY;
    const ink = makeBand(0x070b14, 0.96);
    ink.mesh.scale.set(r + 0.008, th, r + 0.008);
    ink.mesh.position.y = p.calibrationY;
    glassRoot.add(halo.mesh, ink.mesh);
    overlays.push(halo.mesh, ink.mesh);
  }

  // level line: thin dark meniscus-bottom reading line + a faint bright line just above it, on graduated vessels only
  const hasScale = p.graduations.length > 0 || p.calibrationY !== undefined;
  const lvlTh = THREE.MathUtils.clamp(decals.minSpacing * 0.34, 0.026, 0.06);
  const lvlDark = makeBand(0x050912, 0);
  const lvlBright = makeBand(0xffffff, 0);
  lvlDark.mesh.visible = false;
  lvlBright.mesh.visible = false;
  if (hasScale) glassRoot.add(lvlBright.mesh, lvlDark.mesh);
  let lvlFade = 0;

  // supports (rack / cork ring / ring stand) stay on the bench while the glass lifts
  const rackGroup = new THREE.Group();
  group.add(rackGroup);
  const support = buildSupport(p);
  if (support) rackGroup.add(support);

  // liquid
  const liquid = new LiquidBody(p);
  glassRoot.add(liquid.root);
  const liquidMesh = liquid.sideAbsorb;

  // effects
  const effects = new VesselEffects(p, liquid);
  glassRoot.add(effects.group);

  // grounding + selection
  const footprint = vesselFootprint(p);
  const height = vesselHeight(p);
  const blob = new THREE.Mesh(unitPlane(), sharedBlobMat());
  const blobX = p.support === 'stand' ? 14 : p.support === 'rack' ? footprint * 2.4 : footprint * 2.6;
  const blobZ = p.support === 'stand' ? 17 : p.support === 'rack' ? 9 : footprint * 2.6;
  blob.scale.set(blobX, 1, blobZ);
  blob.position.y = 0.04;
  blob.renderOrder = 0;
  blob.raycast = () => {};
  group.add(blob);

  // the thermal bath the vessel stands in (the engine's `bath_k`): a basin of water, with floating ice for an ice bath
  const bath = p.support === 'stand' ? null : new BathVisual(footprint, height);
  if (bath) group.add(bath.group);

  // Coloured light the liquid casts onto the worktop (a tinted caustic, thrown away from the key light), only for liquids
  // that actually have a colour; the colour is the one the shader shows, so it follows the engine's spectra.
  const causticMat = new THREE.MeshBasicMaterial({
    map: softSpriteTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -5,
  });
  const caustic = new THREE.Mesh(unitPlane(), causticMat);
  caustic.visible = false;
  caustic.raycast = () => {};
  caustic.renderOrder = 0;
  group.add(caustic);
  let causticTarget = 0;
  let causticLevel = 0;
  const causticCol = new THREE.Color();

  const ringMat = new THREE.MeshBasicMaterial({
    map: ringGlowTexture(),
    color: 0x7cc8ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -6,
  });
  const ring = new THREE.Mesh(unitPlane(), ringMat);
  const ringSize = footprint * 2 * 1.75;
  ring.scale.set(ringSize, 1, ringSize);
  ring.position.y = 0.06;
  ring.visible = false;
  ring.raycast = () => {};
  group.add(ring);

  // pick proxy: the glass (min. 1 cm radius so a pasteur pipette / burette is clickable); racks use their footprint
  const proxyR = p.support === 'stand' ? Math.max(p.maxOuterRadius + 0.5, 1.1) : Math.max(footprint, 1.0);
  const proxyGeo = new THREE.CylinderGeometry(proxyR, proxyR, height + 1, 12);
  proxyGeo.translate(0, (height + 1) / 2, 0);
  const pickProxy = new THREE.Mesh(proxyGeo, sharedProxyMat());
  pickProxy.visible = false;
  pickProxy.userData.pick = { type: 'vessel', id: state.id };
  group.add(pickProxy);

  let selected = false;
  let hovered = false;
  let ringOpacity = 0;
  let groundY = 0;
  let burst = false;
  let renderBase = 0;
  let checkTimer = 0;
  const readingY = () => THREE.MathUtils.clamp(liquid.fillY, p.innerBottomY, p.rimY);
  const bundle: VesselBundle = {
    group,
    glassMesh,
    liquidMesh,
    vesselState: state,
    effects,
    profile: p,
    glassRoot,
    liquid,
    pickProxy,
    lastSnapshot: null,
    height,
    footprint,

    updateLiquid: (volMl: number, color: string, opacity: number = 0.85) => {
      state.currentVolumeMl = volMl;
      state.liquidColor = color;
      liquid.setSimple(volMl, color, opacity);
    },

    applyVisual: (snap: VesselSnapshot, _dt: number, opticsTables?: OpticsTables | null) => {
      bundle.lastSnapshot = snap;
      state.currentVolumeMl = snap.total_liquid_ml;
      state.temperatureK = snap.temperature_k;
      if (snap.ph !== null && snap.ph !== undefined) state.ph = snap.ph;
      // The liquid body must render even if a secondary effect (bubbles, foam, bed...) throws, and vice versa.
      try {
        liquid.setLayers(snap.layers || [], snap.total_liquid_ml, opticsTables ?? defaultOptics);
        state.liquidColor = liquid.getApparentHex();
        causticCol.set(state.liquidColor);
        const mx = Math.max(causticCol.r, causticCol.g, causticCol.b);
        const chroma = mx - Math.min(causticCol.r, causticCol.g, causticCol.b);
        const depth = Math.min(1, (heightForVolume(p, snap.total_liquid_ml) - p.innerBottomY) / 3);
        causticTarget = snap.total_liquid_ml > 0.5 ? Math.min(0.85, chroma * 1.8) * depth : 0;
        if (mx > 0.02) causticCol.multiplyScalar(1 / mx);
        causticMat.color.copy(causticCol);
      } catch (e) {
        warnOnce('liquid.setLayers failed (falling back to a clear liquid of the same volume)', e);
        try {
          liquid.setSimple(snap.total_liquid_ml || 0, state.liquidColor || '#e8f4fa', 0.3);
        } catch (e2) {
          warnOnce('liquid.setSimple failed', e2);
        }
      }
      try {
        effects.applySnapshot(snap);
      } catch (e) {
        warnOnce('effects.applySnapshot failed', e);
      }
      if (checkTimer <= 0) checkTimer = 0.6; // self check shortly after the contents changed (rate-limited)
    },

    stirRpm: () => effects.getStirRpm(),

    levelLocalYForVolume: (ml: number) => heightForVolume(p, ml) + p.baseOffsetY,

    setStirring: (rpm: number) => {
      effects.setStirring(rpm);
      state.stirring = rpm > 0;
    },

    setSelected: (on: boolean) => {
      selected = on;
    },

    getLiquidColorHex: () => liquid.getApparentHex(),

    tick: (dt: number, time: number) => {
      try {
        if (!bundle.lastSnapshot) effects.setSealed(state.isSealed);
        liquid.tick(dt, time, glassRoot.matrixWorld);
      } catch (e) {
        warnOnce('liquid.tick failed', e);
      }
      try {
        effects.tick(dt, time);
      } catch (e) {
        warnOnce('effects.tick failed', e);
      }
      if (checkTimer > 0) {
        checkTimer -= dt;
        if (checkTimer <= 0) {
          const problem = liquid.diagnose();
          if (problem) warnOnce(`vessel ${state.id}: ${problem}`, { volumeMl: liquid.volumeMl, fillY: liquid.fillY });
        }
      }
      // level line on the inner wall at the liquid surface
      if (hasScale) {
        const show = !burst && liquid.volumeMl > 0.03 && liquid.fillY < p.innerTopY + 0.4;
        lvlFade += ((show ? 1 : 0) - lvlFade) * Math.min(1, dt * 8);
        const vis = lvlFade > 0.02;
        lvlDark.mesh.visible = vis;
        lvlBright.mesh.visible = vis;
        if (vis) {
          const y = readingY();
          const r = Math.max(0.02, innerRadiusAt(p, Math.min(y, p.innerTopY)) - 0.004);
          lvlDark.mesh.scale.set(r, lvlTh, r);
          lvlDark.mesh.position.y = y - lvlTh * 0.3;
          lvlBright.mesh.scale.set(r - 0.002, lvlTh * 0.85, r - 0.002);
          lvlBright.mesh.position.y = y + lvlTh * 1.15;
          lvlDark.mat.opacity = 0.7 * lvlFade;
          lvlBright.mat.opacity = 0.6 * lvlFade;
        }
      }
      const target = selected ? 0.85 : hovered ? 0.35 : 0;
      ringOpacity += (target - ringOpacity) * Math.min(1, dt * 8);
      ringMat.opacity = ringOpacity * (selected ? 0.85 + 0.15 * Math.sin(time * 2.5) : 1);
      ring.visible = ringOpacity > 0.01;
      // contact shadow / ring stay on the supporting surface while lifted
      const lift = Math.max(0, group.position.y - groundY);
      blob.position.y = groundY - group.position.y + 0.04;
      ring.position.y = groundY - group.position.y + 0.06;
      const k = Math.max(0, 1 - lift / 25);
      if (bath) {
        // the basin stays on the bench; the vessel is in it only while it stands there
        bath.group.position.y = groundY - group.position.y;
        bath.update(dt, time, bundle.lastSnapshot?.bath_k, lift < 2 && !burst);
      }
      blob.visible = k > 0.02 && !burst;
      blob.scale.set(blobX * (1 + lift * 0.04), 1, blobZ * (1 + lift * 0.04));
      // tinted caustic: thrown along the light's horizontal direction by the height of the liquid column
      causticLevel += ((burst ? 0 : causticTarget) - causticLevel) * Math.min(1, dt * 3);
      caustic.visible = causticLevel > 0.01 && k > 0.02;
      if (caustic.visible) {
        const col = Math.max(0.5, liquid.fillY);
        const r = Math.max(footprint * 1.6, 1.2);
        const off = col * 0.65 + footprint * 0.25;
        caustic.position.set(KEY_DIR_X * off, groundY - group.position.y + 0.07, KEY_DIR_Z * off);
        caustic.scale.set(r * 1.5, 1, r * 1.1);
        caustic.rotation.y = Math.atan2(KEY_DIR_Z, KEY_DIR_X) * -1;
        causticMat.opacity = 0.32 * causticLevel * k;
      }
    },

    setHover: (on: boolean) => {
      hovered = on;
    },

    setRenderOrderBase: (base: number) => {
      if (base === renderBase) return;
      renderBase = base;
      glassMesh.renderOrder = base + 5;
      glassFar.renderOrder = base + 1;
      for (const g of extraGlass) {
        g.renderOrder = base + 5;
        (g.children[0] as THREE.Mesh).renderOrder = base + 1;
      }
      for (const o of overlays) o.renderOrder = base + 6;
      lvlBright.mesh.renderOrder = base + 7;
      lvlDark.mesh.renderOrder = base + 7;
      liquid.setRenderOrderBase(base);
      effects.setRenderOrderBase(base);
      ring.renderOrder = base;
      blob.renderOrder = base;
      bath?.setRenderOrder(base);
    },

    setGroundY: (y: number) => {
      groundY = y;
    },

    lipLocal: () => {
      const r = p.rimOuterRadius + p.spout * 0.9;
      return new THREE.Vector3(r, p.rimY + p.baseOffsetY - (p.spout > 0 ? 0.12 : 0), 0);
    },

    tipLocal: () => (p.tip ? new THREE.Vector3(p.tip.x, p.tip.y + p.baseOffsetY, p.tip.z) : null),

    probeLocal: (slot: 'thermo' | 'ph', probeRadius: number) => {
      const phi = slot === 'thermo' ? -0.75 : -2.35;
      const dir = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
      // shallow dishes: keep the tip inside the cavity
      const tipY = Math.min(p.innerBottomY + 0.45 + probeRadius, Math.max(p.innerBottomY + 0.05, p.innerTopY - 0.3));
      const rb = Math.max(0, innerRadiusAt(p, tipY + 0.6) - probeRadius - 0.2);
      const rr = Math.max(0, p.rimInnerRadius - probeRadius - 0.12);
      const tip = dir.clone().multiplyScalar(rb);
      tip.y = tipY + p.baseOffsetY;
      const up = dir.clone().multiplyScalar(rr - rb);
      up.y = p.rimY - tipY;
      up.normalize();
      return { tip, up };
    },

    stopperTopLocal: () => effects.stopperTopY() + p.baseOffsetY,

    surfaceLocalY: () => liquid.fillY + p.baseOffsetY,

    levelReadingMl: () => liquid.volumeMl,

    scaleReadingMl: () => scaleReadingForVolume(p, liquid.volumeMl),

    readingAnchorLocal: (side?: 1 | -1) => {
      const s = side ?? (p.spout > 0 ? -1 : 1);
      const y = readingY();
      const r = outerRadiusAt(p, Math.min(y, p.rimY)) + 0.35;
      return new THREE.Vector3(s * r, y + p.baseOffsetY, 0);
    },

    setStopcock: (open01: number) => acc.setStopcock?.(open01),

    stopcockLocal: () => (acc.stopcockLocal ? acc.stopcockLocal.clone().add(new THREE.Vector3(0, p.baseOffsetY, 0)) : null),

    setPlungerMl: (ml: number) => acc.setPlungerMl?.(ml),

    setLidVisible: (on: boolean) => acc.setLidVisible?.(on),

    isBurst: () => burst,

    setRackVisible: (on: boolean) => {
      rackGroup.visible = on;
    },

    dispose: () => {
      liquid.dispose();
      effects.dispose();
      bath?.dispose();
      ringMat.dispose();
      for (const m of bandMats) m.dispose();
      proxyGeo.dispose();
      group.parent?.remove(group);
    },
  };

  effects.onBurst = () => {
    burst = true;
    glassMesh.visible = false;
    for (const g of extraGlass) g.visible = false;
    for (const o of overlays) o.visible = false;
    lvlDark.mesh.visible = false;
    lvlBright.mesh.visible = false;
    liquid.root.visible = false;
  };

  bundle.setRenderOrderBase(10);
  liquid.setSimple(state.currentVolumeMl, state.liquidColor || '#f4f8fb', 0);
  return bundle;
}

/** Back-compat helper: a generic labelled reagent bottle (PubChem imports). */
export function createBottleMesh(name: string, colorHex: string): THREE.Group {
  return createGenericBottle({ id: name, name, formula: '', colorHex }).group;
}
