import * as THREE from 'three';
import { VesselProfile, heightForVolume, outerRadiusAt, volumeAtHeight } from './glass_profiles';
import { createGlassMesh } from './glass_material';
import { woodTexture } from './textures';

/**
 * Cheap procedural accessories that a lathe cannot express: stopcocks (burette, separatory funnel), the filter-flask
 * side arm, the gas-syringe plunger, the Pasteur teat, petri / gas-jar lids, the Büchner plate, ground-glass joint
 * bands, and the supports (test-tube rack, cork ring, ring-stand with clamp or ring). Geometry is cached per vessel
 * type; materials are shared module singletons (never dispose them from per-vessel code).
 */

const geoCache = new Map<string, THREE.BufferGeometry>();
function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

const matCache = new Map<string, THREE.Material>();
function cachedMat<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}

const steelMat = () => cachedMat('steel', () => new THREE.MeshStandardMaterial({ color: 0x8d949b, metalness: 0.85, roughness: 0.38 }));
const paintMat = () => cachedMat('paint', () => new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.45, roughness: 0.5 }));
const ptfeMat = () => cachedMat('ptfe', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.42, metalness: 0 }));
const rubberMat = () => cachedMat('rubber', () => new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.85, metalness: 0 }));
const teatMat = () => cachedMat('teat', () => new THREE.MeshStandardMaterial({ color: 0x8a2c24, roughness: 0.8, metalness: 0 }));
const corkMat = () => cachedMat('cork', () => new THREE.MeshStandardMaterial({ color: 0xb48a58, roughness: 0.92, metalness: 0 }));
const frostMat = () =>
  cachedMat(
    'frost',
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xf4f6f6,
        roughness: 0.95,
        metalness: 0,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
  );

function rackMat(): THREE.MeshStandardMaterial {
  return cachedMat('rackwood', () => {
    const tex = woodTexture().clone();
    tex.needsUpdate = true;
    tex.repeat.set(0.15, 1);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0, color: 0xd8c7b0 });
  });
}

let plateTex: THREE.Texture | null = null;
function perforatedPlateTexture(): THREE.Texture {
  if (plateTex) return plateTex;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efede6';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#4a4a46';
  const step = 14;
  for (let row = 0, y = step / 2; y < S; y += step * 0.866, row++) {
    for (let x = (row % 2 ? step / 2 : 0) + step / 2; x < S; x += step) {
      g.beginPath();
      g.arc(x, y, 3.1, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  plateTex = t;
  return t;
}

const noRay = (m: THREE.Object3D) => {
  m.raycast = () => {};
};

// ------------------------------------------------------------------ accessories on the glass
export interface AccessoryBundle {
  /** Added to `glassRoot` (glass-local frame). */
  group: THREE.Group;
  /** Clear glass pieces (near mesh with far child): the bundle orders / hides them like the foot. */
  glass: THREE.Mesh[];
  /** Transparent overlays drawn after the near glass (frosted joint band). */
  overlays: THREE.Mesh[];
  /** 0 = closed, 1 = open. */
  setStopcock?: (open01: number) => void;
  /** Stopcock centre, glass-local. */
  stopcockLocal?: THREE.Vector3;
  /** Move the plunger so the piston sits at `ml` on the scale. */
  setPlungerMl?: (ml: number) => void;
  setLidVisible?: (on: boolean) => void;
}

export function buildAccessories(p: VesselProfile): AccessoryBundle {
  const out: AccessoryBundle = { group: new THREE.Group(), glass: [], overlays: [] };
  out.group.name = 'accessories';
  for (const a of p.accessories) {
    switch (a.kind) {
      case 'stopcock':
        addStopcock(p, out, a.y, a.r, a.len ?? 2.7);
        break;
      case 'sidearm':
        addSidearm(p, out, a.y, a.r, a.len ?? 3.6);
        break;
      case 'plunger':
        addPlunger(p, out, a.y, a.r, a.len ?? 17);
        break;
      case 'teat':
        addTeat(p, out, a.y, a.len ?? 4.6);
        break;
      case 'lid':
        addLid(p, out, a.y, a.r, a.len ?? 0.3);
        break;
      case 'plate':
        addPlate(p, out, a.y, a.r);
        break;
      case 'joint':
        addJoint(p, out, a.y, a.len ?? 2.4);
        break;
      default:
        break;
    }
  }
  return out;
}

function addGlass(out: AccessoryBundle, geo: THREE.BufferGeometry, pos: THREE.Vector3, rot?: THREE.Euler) {
  const { near, far } = createGlassMesh(geo);
  near.raycast = () => {};
  far.raycast = () => {};
  near.position.copy(pos);
  if (rot) near.rotation.copy(rot);
  out.group.add(near);
  out.glass.push(near);
}

function addSolid(out: AccessoryBundle, geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = out.group): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  noRay(m);
  parent.add(m);
  return m;
}

function addStopcock(p: VesselProfile, out: AccessoryBundle, y: number, tubeR: number, len: number) {
  const br = Math.max(0.55, tubeR * 1.8);
  const key = `${p.type}_stopcock`;
  // glass barrel along X
  const barrel = cachedGeo(key + '_barrel', () => {
    const g = new THREE.CylinderGeometry(br, br, len, 24, 1, false);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  addGlass(out, barrel, new THREE.Vector3(0, y, 0));
  // PTFE plug through the barrel, key knob on +X, wing nut on -X
  const plug = cachedGeo(key + '_plug', () => {
    const g = new THREE.CylinderGeometry(br * 0.62, br * 0.55, len + 1.1, 20);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const plugMesh = addSolid(out, plug, ptfeMat());
  plugMesh.position.set(0.45, y, 0);
  const nut = cachedGeo(key + '_nut', () => {
    const g = new THREE.CylinderGeometry(br * 0.8, br * 0.8, 0.28, 8);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const nutMesh = addSolid(out, nut, ptfeMat());
  nutMesh.position.set(-len / 2 - 0.14, y, 0);
  // handle: pivot on the plug axis, lever rotates about X (alpha 0 = along the tube = open, 90 deg = across = closed)
  const pivot = new THREE.Group();
  pivot.position.set(len / 2 + 0.9, y, 0);
  out.group.add(pivot);
  const leverLen = Math.max(2.4, br * 3.8);
  const lever = cachedGeo(key + '_lever', () => {
    const g = new THREE.BoxGeometry(0.42, leverLen, 0.3);
    g.translate(0, leverLen / 2, 0);
    return g;
  });
  addSolid(out, lever, ptfeMat(), pivot);
  const tab = cachedGeo(key + '_tab', () => {
    const g = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 14);
    g.rotateZ(Math.PI / 2);
    g.translate(0, leverLen, 0);
    return g;
  });
  addSolid(out, tab, ptfeMat(), pivot);
  const hub = cachedGeo(key + '_hub', () => {
    const g = new THREE.CylinderGeometry(br * 0.7, br * 0.7, 0.5, 14);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  addSolid(out, hub, ptfeMat(), pivot);
  const set = (open01: number) => {
    pivot.rotation.x = (1 - THREE.MathUtils.clamp(open01, 0, 1)) * (Math.PI / 2);
  };
  set(0);
  out.setStopcock = set;
  out.stopcockLocal = new THREE.Vector3(0, y, 0);
}

function addSidearm(p: VesselProfile, out: AccessoryBundle, y: number, neckR: number, len: number) {
  const ang = 0.34;
  const geo = cachedGeo(`${p.type}_sidearm`, () => {
    const r = 0.5;
    const pts = [
      new THREE.Vector2(r, 0),
      new THREE.Vector2(r, len - 1.5),
      new THREE.Vector2(r + 0.2, len - 1.3),
      new THREE.Vector2(r, len - 1.1),
      new THREE.Vector2(r + 0.2, len - 0.75),
      new THREE.Vector2(r, len - 0.5),
      new THREE.Vector2(r, len),
    ];
    const g = new THREE.LatheGeometry(pts, 18);
    g.translate(0, 0, 0);
    return g;
  });
  // lathe axis = +Y; tilt it so it points along (cos ang, sin ang) in the XY plane
  const rot = new THREE.Euler(0, 0, -(Math.PI / 2 - ang));
  addGlass(out, geo, new THREE.Vector3(neckR * 0.75, y, 0), rot);
}

function addPlunger(p: VesselProfile, out: AccessoryBundle, y: number, r: number, len: number) {
  const g = new THREE.Group();
  g.position.y = y;
  out.group.add(g);
  const piston = cachedGeo(`${p.type}_piston`, () => {
    const gg = new THREE.CylinderGeometry(r - 0.05, r - 0.05, 1.1, 28);
    gg.translate(0, 0.55, 0);
    return gg;
  });
  addSolid(out, piston, rubberMat(), g);
  const rod = cachedGeo(`${p.type}_rod`, () => {
    const gg = new THREE.CylinderGeometry(0.3, 0.3, len, 12);
    gg.translate(0, 1.1 + len / 2, 0);
    return gg;
  });
  addSolid(out, rod, ptfeMat(), g);
  const thumb = cachedGeo(`${p.type}_thumb`, () => {
    const gg = new THREE.CylinderGeometry(1.25, 1.25, 0.32, 24);
    gg.translate(0, 1.1 + len + 0.16, 0);
    return gg;
  });
  addSolid(out, thumb, ptfeMat(), g);
  out.setPlungerMl = (ml: number) => {
    const v0 = volumeAtHeight(p, y);
    g.position.y = heightForVolume(p, v0 + Math.max(0, ml));
  };
}

function addTeat(p: VesselProfile, out: AccessoryBundle, y: number, len: number) {
  const geo = cachedGeo(`${p.type}_teat`, () => {
    const k = len / 4.6;
    const pts = [
      [0.34, 0],
      [0.34, 0.25],
      [0.75, 0.6],
      [0.98, 1.4],
      [0.98, 2.7],
      [0.64, 3.8],
      [0.22, 4.45],
      [0, 4.6],
    ].map(([x, yy]) => new THREE.Vector2(x, yy * k));
    return new THREE.LatheGeometry(pts, 20);
  });
  const m = addSolid(out, geo, teatMat());
  m.position.y = y - 0.45;
}

function addLid(p: VesselProfile, out: AccessoryBundle, y: number, r: number, t: number) {
  const plate = t < 0.5;
  const geo = cachedGeo(`${p.type}_lid`, () => {
    const pts = plate
      ? [new THREE.Vector2(0, t), new THREE.Vector2(r, t), new THREE.Vector2(r, 0), new THREE.Vector2(0, 0)]
      : [
          new THREE.Vector2(0, t),
          new THREE.Vector2(r - 0.15, t),
          new THREE.Vector2(r, t - 0.15),
          new THREE.Vector2(r, 0),
          new THREE.Vector2(r - 0.08, 0),
          new THREE.Vector2(r - 0.08, t - 0.2),
          new THREE.Vector2(0, t - 0.08),
        ];
    return new THREE.LatheGeometry(pts, 64);
  });
  const { near, far } = createGlassMesh(geo);
  near.raycast = () => {};
  far.raycast = () => {};
  near.position.y = plate ? y + 0.02 : y - t + 0.25;
  near.visible = false;
  out.group.add(near);
  out.glass.push(near);
  out.setLidVisible = (on: boolean) => {
    near.visible = on;
  };
}

function addPlate(p: VesselProfile, out: AccessoryBundle, y: number, r: number) {
  const geo = cachedGeo(`${p.type}_plate`, () => {
    const g = new THREE.CircleGeometry(r - 0.05, 48);
    g.rotateX(-Math.PI / 2);
    return g;
  });
  const mat = cachedMat('plate', () => new THREE.MeshStandardMaterial({ map: perforatedPlateTexture(), roughness: 0.3, metalness: 0 }));
  const m = addSolid(out, geo, mat);
  m.castShadow = false;
  m.position.y = y + 0.02;
}

function addJoint(p: VesselProfile, out: AccessoryBundle, y: number, len: number) {
  // frosted ground-glass band just below the rim
  const geo = cachedGeo(`${p.type}_joint`, () => {
    const y0 = y - len;
    const y1 = y - 0.4;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 6; i++) {
      const yy = y0 + ((y1 - y0) * i) / 6;
      pts.push(new THREE.Vector2(outerRadiusAt(p, yy) + 0.012, yy));
    }
    return new THREE.LatheGeometry(pts, 40);
  });
  const m = new THREE.Mesh(geo, frostMat());
  noRay(m);
  out.group.add(m);
  out.overlays.push(m);
}

// ------------------------------------------------------------------ supports (not lifted with the glass)
export function buildSupport(p: VesselProfile): THREE.Group | null {
  switch (p.support) {
    case 'rack':
      return buildRack(p);
    case 'cork-ring':
      return buildCorkRing(p);
    case 'stand':
      return buildStand(p);
    default:
      return null;
  }
}

function addPart(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  noRay(m);
  g.add(m);
  return m;
}

function buildRack(p: VesselProfile): THREE.Group {
  const holeR = p.supportR;
  const plateY = p.supportY;
  const spacing = Math.max(3.8, holeR * 2 + 1.0);
  const W = spacing * 3 + 0.6;
  const D = Math.max(5.5, holeR * 2 + 2.2);
  const baseH = 1.2;
  const key = `rack_${holeR.toFixed(2)}_${plateY.toFixed(2)}`;
  const base = cachedGeo(key + '_base', () => {
    const g = new THREE.BoxGeometry(W, baseH, D);
    g.translate(0, baseH / 2, 0);
    return g;
  });
  const plate = cachedGeo(key + '_plate', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, -D / 2);
    shape.lineTo(W / 2, -D / 2);
    shape.lineTo(W / 2, D / 2);
    shape.lineTo(-W / 2, D / 2);
    shape.lineTo(-W / 2, -D / 2);
    for (const hx of [-spacing, 0, spacing]) {
      const h = new THREE.Path();
      h.absarc(hx, 0, holeR, 0, Math.PI * 2, true);
      shape.holes.push(h);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1, curveSegments: 24 });
    g.rotateX(Math.PI / 2);
    g.translate(0, plateY, 0);
    return g;
  });
  const postH = plateY + 0.4 - baseH;
  const post = cachedGeo(key + '_post', () => {
    const g = new THREE.BoxGeometry(0.8, postH, D * 0.8);
    g.translate(0, baseH + postH / 2, 0);
    return g;
  });
  const grp = new THREE.Group();
  grp.name = 'support_rack';
  const mat = rackMat();
  addPart(grp, base, mat);
  addPart(grp, plate, mat);
  addPart(grp, post, mat, -(W / 2 - 0.4));
  addPart(grp, post, mat, W / 2 - 0.4);
  return grp;
}

function buildCorkRing(p: VesselProfile): THREE.Group {
  const R = p.supportR;
  const t = p.supportY;
  const geo = cachedGeo(`cork_${R.toFixed(2)}_${t.toFixed(2)}`, () => {
    const g = new THREE.TorusGeometry(R, t, 14, 40);
    g.rotateX(Math.PI / 2);
    g.translate(0, t, 0);
    return g;
  });
  const grp = new THREE.Group();
  grp.name = 'support_cork';
  addPart(grp, geo, corkMat());
  return grp;
}

/** Ring stand: heavy base, rod behind the glass, boss + arm, and a claw (tubes) or iron ring (funnels). */
function buildStand(p: VesselProfile): THREE.Group {
  const grp = new THREE.Group();
  grp.name = 'support_stand';
  const baseW = 10.5;
  const baseD = 14;
  const baseH = 1.2;
  const baseZ = -1.5;
  const rodZ = -4.6;
  const clampY = p.baseOffsetY + p.supportY;
  const rodTop = clampY + 3.5;
  const funnelRing = p.kind === 'sep-funnel' || p.kind === 'funnel' || p.kind === 'buchner-funnel';
  const key = `stand_${p.type}`;
  const base = cachedGeo(key + '_base', () => {
    const g = new THREE.BoxGeometry(baseW, baseH, baseD, 1, 1, 1);
    g.translate(0, baseH / 2, baseZ);
    return g;
  });
  addPart(grp, base, paintMat());
  const rod = cachedGeo(key + '_rod', () => {
    const g = new THREE.CylinderGeometry(0.5, 0.5, rodTop - baseH, 14);
    g.translate(0, baseH + (rodTop - baseH) / 2, rodZ);
    return g;
  });
  addPart(grp, rod, steelMat());
  const boss = cachedGeo(key + '_boss', () => {
    const g = new THREE.BoxGeometry(1.9, 1.5, 1.9);
    g.translate(0, clampY, rodZ);
    return g;
  });
  addPart(grp, boss, paintMat());
  const ringTube = funnelRing ? 0.36 : 0.22;
  const ringR = p.supportR + ringTube + (funnelRing ? 0 : 0.02);
  const armLen = Math.max(0.5, -rodZ - ringR + 0.2);
  const arm = cachedGeo(key + '_arm', () => {
    const g = new THREE.CylinderGeometry(0.3, 0.3, armLen, 10);
    g.rotateX(Math.PI / 2);
    g.translate(0, clampY, rodZ + armLen / 2);
    return g;
  });
  addPart(grp, arm, steelMat());
  const ring = cachedGeo(key + '_ring', () => {
    const g = new THREE.TorusGeometry(ringR, ringTube, 10, 40);
    g.rotateX(Math.PI / 2);
    g.translate(0, clampY, 0);
    return g;
  });
  addPart(grp, ring, steelMat());
  if (!funnelRing) {
    // clamp screw + jaw block on the front of the claw
    const jaw = cachedGeo(key + '_jaw', () => {
      const g = new THREE.BoxGeometry(0.9, 0.7, 0.9);
      g.translate(0, clampY, ringR + 0.2);
      return g;
    });
    addPart(grp, jaw, paintMat());
  }
  return grp;
}
