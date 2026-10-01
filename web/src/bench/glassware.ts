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
  vesselFootprint,
  vesselHeight,
} from '../render/glass_profiles';
import { createGlassMesh } from '../render/glass_material';
import { LiquidBody } from '../render/liquid_material';
import { blobShadowTexture, graduationTexture, ringGlowTexture, woodTexture } from '../render/textures';
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
  setSelected: (on: boolean) => void;
  /** Current apparent liquid colour (for pour streams), '#rrggbb'. */
  getLiquidColorHex: () => string;
}

/** Scene-internal extension of the bundle (not part of the frozen contract). */
export interface VesselBundle extends GlasswareMeshBundle {
  profile: VesselProfile;
  /** Frame of the glass itself (lifted for the test-tube rack). */
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
  isBurst: () => boolean;
  /** Test-tube rack visibility (hidden while the tube is lifted for pouring). */
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
const decalCache = new Map<string, { geo: THREE.BufferGeometry; tex: THREE.Texture } | null>();
let footGeo: THREE.BufferGeometry | null = null;
let rackGeos: { base: THREE.BufferGeometry; plate: THREE.BufferGeometry; post: THREE.BufferGeometry } | null = null;
let rackMat: THREE.MeshStandardMaterial | null = null;
let blobMat: THREE.MeshBasicMaterial | null = null;
let planeGeo: THREE.PlaneGeometry | null = null;
let proxyMat: THREE.MeshBasicMaterial | null = null;
let decalMat = new Map<string, THREE.MeshStandardMaterial>();

function unitPlane(): THREE.PlaneGeometry {
  if (!planeGeo) {
    planeGeo = new THREE.PlaneGeometry(1, 1);
    planeGeo.rotateX(-Math.PI / 2);
  }
  return planeGeo;
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

function decalFor(p: VesselProfile): { geo: THREE.BufferGeometry; tex: THREE.Texture } | null {
  if (decalCache.has(p.type)) return decalCache.get(p.type)!;
  if (!p.graduations.length) {
    decalCache.set(p.type, null);
    return null;
  }
  const yA = p.innerBottomY;
  const yNom = heightForVolume(p, p.nominalMl);
  const yB = Math.min(p.rimY - 0.4, yNom + (p.type === 'cylinder-100' ? 1.2 : 1.8));
  const pts: THREE.Vector2[] = [];
  const N = 40;
  for (let j = 0; j <= N; j++) {
    const y = yA + ((yB - yA) * j) / N;
    pts.push(new THREE.Vector2(outerRadiusAt(p, y) + 0.012, y));
  }
  const rMid = outerRadiusAt(p, (yA + yB) / 2);
  const phiLen = Math.max(0.4, Math.min(1.3, 2.5 / rMid));
  const geo = new THREE.LatheGeometry(pts, 16, -phiLen / 2, phiLen);
  const marks = p.graduations.map((g) => ({
    v: (heightForVolume(p, g.ml) - yA) / (yB - yA),
    major: g.major,
    label: g.label,
  }));
  const tex = graduationTexture(p.type, marks, p.gradTitle, p.type === 'cylinder-100');
  const d = { geo, tex };
  decalCache.set(p.type, d);
  return d;
}

function getRack() {
  if (rackGeos) return { geos: rackGeos, mat: rackMat! };
  const W = 12;
  const D = 5.5;
  const base = new THREE.BoxGeometry(W, 1.2, D);
  base.translate(0, 0.6, 0);
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, -D / 2);
  shape.lineTo(W / 2, -D / 2);
  shape.lineTo(W / 2, D / 2);
  shape.lineTo(-W / 2, D / 2);
  shape.lineTo(-W / 2, -D / 2);
  for (const hx of [-3.8, 0, 3.8]) {
    const h = new THREE.Path();
    h.absarc(hx, 0, 1.42, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }
  const plate = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1, curveSegments: 24 });
  plate.rotateX(Math.PI / 2);
  plate.translate(0, 8.2, 0);
  const post = new THREE.BoxGeometry(0.8, 7.4, D * 0.8);
  post.translate(0, 1.2 + 3.7, 0);
  rackGeos = { base, plate, post };
  const tex = woodTexture().clone();
  tex.needsUpdate = true;
  tex.repeat.set(0.15, 1);
  rackMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0, color: 0xd8c7b0 });
  return { geos: rackGeos, mat: rackMat };
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

function getDecalMaterial(type: string, tex: THREE.Texture) {
  let m = decalMat.get(type);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    decalMat.set(type, m);
  }
  return m;
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
  const { near: glassMesh, far: glassFar } = createGlassMesh(shellGeometry(p));
  glassMesh.raycast = () => {};
  glassFar.raycast = () => {};
  glassRoot.add(glassMesh);

  const extraGlass: THREE.Mesh[] = [];
  if (p.footHeight > 0) {
    if (!footGeo) {
      footGeo = new THREE.CylinderGeometry(p.footRadius, p.footRadius * 1.02, p.footHeight, 6, 1);
      footGeo.translate(0, p.footHeight / 2, 0);
    }
    const foot = createGlassMesh(footGeo);
    foot.near.raycast = () => {};
    foot.far.raycast = () => {};
    glassRoot.add(foot.near);
    extraGlass.push(foot.near);
  }

  let decal: THREE.Mesh | null = null;
  const d = decalFor(p);
  if (d) {
    decal = new THREE.Mesh(d.geo, getDecalMaterial(p.type, d.tex));
    decal.raycast = () => {};
    glassRoot.add(decal);
  }

  const rackGroup = new THREE.Group();
  group.add(rackGroup);
  if (p.rack) {
    const { geos, mat } = getRack();
    const base = new THREE.Mesh(geos.base, mat);
    const plate = new THREE.Mesh(geos.plate, mat);
    const postL = new THREE.Mesh(geos.post, mat);
    const postR = new THREE.Mesh(geos.post, mat);
    postL.position.x = -5.6;
    postR.position.x = 5.6;
    for (const m of [base, plate, postL, postR]) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = () => {};
      rackGroup.add(m);
    }
  }

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
  const blobSize = p.rack ? 15 : footprint * 2.6;
  blob.scale.set(blobSize, 1, p.rack ? 9 : blobSize);
  blob.position.y = 0.04;
  blob.renderOrder = 0;
  blob.raycast = () => {};
  group.add(blob);

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

  const proxyGeo = new THREE.CylinderGeometry(footprint, footprint, height + 1, 12);
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
      const target = selected ? 0.85 : hovered ? 0.35 : 0;
      ringOpacity += (target - ringOpacity) * Math.min(1, dt * 8);
      ringMat.opacity = ringOpacity * (selected ? 0.85 + 0.15 * Math.sin(time * 2.5) : 1);
      ring.visible = ringOpacity > 0.01;
      // contact shadow / ring stay on the supporting surface while lifted
      const lift = Math.max(0, group.position.y - groundY);
      blob.position.y = groundY - group.position.y + 0.04;
      ring.position.y = groundY - group.position.y + 0.06;
      const k = Math.max(0, 1 - lift / 25);
      blob.visible = k > 0.02 && !burst;
      blob.scale.set(blobSize * (1 + lift * 0.04), 1, (p.rack ? 9 : blobSize) * (1 + lift * 0.04));
      // tint the contact shadow slightly with strongly coloured liquid (cheap caustic hint)
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
      if (decal) decal.renderOrder = base + 6;
      liquid.setRenderOrderBase(base);
      effects.setRenderOrderBase(base);
      ring.renderOrder = base;
      blob.renderOrder = base;
    },

    setGroundY: (y: number) => {
      groundY = y;
    },

    lipLocal: () => {
      const r = p.rimOuterRadius + p.spout * 0.9;
      return new THREE.Vector3(r, p.rimY + p.baseOffsetY - (p.spout > 0 ? 0.12 : 0), 0);
    },

    probeLocal: (slot: 'thermo' | 'ph', probeRadius: number) => {
      const phi = slot === 'thermo' ? -0.75 : -2.35;
      const dir = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
      const tipY = p.innerBottomY + 0.45 + probeRadius;
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

    isBurst: () => burst,

    setRackVisible: (on: boolean) => {
      rackGroup.visible = on;
    },

    dispose: () => {
      liquid.dispose();
      effects.dispose();
      ringMat.dispose();
      proxyGeo.dispose();
      group.parent?.remove(group);
    },
  };

  effects.onBurst = () => {
    burst = true;
    glassMesh.visible = false;
    for (const g of extraGlass) g.visible = false;
    if (decal) decal.visible = false;
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
