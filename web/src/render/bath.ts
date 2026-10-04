import * as THREE from 'three';
import { blackbodyHue } from './blackbody';

/**
 * The thermal bath a vessel stands in: a clear basin of water around the glass, with floating ice while the bath is at or
 * below the temperature of slush (an ice bath). Driven only by the engine's `bath_k` (the bath's liquid temperature;
 * null = no bath), so any bath temperature the engine accepts is drawn.
 * Lives in the vessel group's frame with the bench surface at y = 0 (the owner keeps it on the supporting surface while the
 * vessel is lifted out).
 */

const ICE_BATH_MAX_K = 276;

/** A bath that is not drawn when the engine has none; true while the basin should be on the bench. */
export function bathVisible(bathK: number | null | undefined): bathK is number {
  return typeof bathK === 'number' && Number.isFinite(bathK) && bathK > 150;
}

const WHITE = new THREE.Color(1, 1, 1);

interface Cube {
  a: number;
  r: number;
  s: number;
  ph: number;
  tumble: number;
}

let cubeGeo: THREE.BufferGeometry | null = null;
function getCubeGeo(): THREE.BufferGeometry {
  if (cubeGeo) return cubeGeo;
  // a slightly chamfered cube: flat shaded so it catches the light like an ice cube
  const g = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const m = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    const k = 1 - 0.09 * (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z) > 1.2 * m ? 1 : 0);
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  cubeGeo = flat;
  return flat;
}

function hash(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class BathVisual {
  public readonly group = new THREE.Group();
  // Everything is drawn in two passes around the vessel (its glass and liquid write no depth): what lies behind it first
  // (back faces of the basin and the water wall, the surface, the ice cubes on the far side), what lies in front of it
  // afterwards (front faces, the near ice), so the vessel is seen through the water and the near ice hides it.
  private basinBack: THREE.Mesh;
  private basinFront: THREE.Mesh;
  private waterBack: THREE.Mesh;
  private waterFront: THREE.Mesh;
  private surface: THREE.Mesh;
  private basinMats: THREE.MeshPhysicalMaterial[];
  private waterMats: THREE.MeshPhysicalMaterial[];
  private surfaceMat: THREE.MeshPhysicalMaterial;
  private iceBack: THREE.InstancedMesh;
  private iceFront: THREE.InstancedMesh;
  private iceMat: THREE.MeshPhysicalMaterial;
  private cubes: Cube[] = [];
  private camWorld = new THREE.Vector3(0, 100, 100);
  private camLocal = new THREE.Vector3();
  private level = 0;
  private bathK: number | null = null;
  private readonly rBasin: number;
  private readonly rGlass: number;
  private readonly hBasin: number;
  private readonly hWater: number;

  /** `footprintR`: radius of the glass on the bench, `vesselH`: its height (cm). */
  constructor(footprintR: number, vesselH: number) {
    this.rGlass = Math.max(0.6, footprintR);
    this.rBasin = Math.min(11, Math.max(this.rGlass * 1.75, this.rGlass + 2.6, 3.8));
    this.hBasin = Math.max(3, Math.min(9, vesselH * 0.5));
    this.hWater = this.hBasin * 0.8;

    // the basin: thin clear plastic, open on top
    const t = 0.18;
    const prof: THREE.Vector2[] = [
      new THREE.Vector2(0.001, 0.02),
      new THREE.Vector2(this.rBasin - 0.4, 0.02),
      new THREE.Vector2(this.rBasin, 0.45),
      new THREE.Vector2(this.rBasin, this.hBasin),
      new THREE.Vector2(this.rBasin + 0.12, this.hBasin + 0.1),
      new THREE.Vector2(this.rBasin - t, this.hBasin),
      new THREE.Vector2(this.rBasin - t, 0.5),
      new THREE.Vector2(this.rBasin - t - 0.4, 0.02 + t),
      new THREE.Vector2(0.001, 0.02 + t),
    ];
    const basinGeo = new THREE.LatheGeometry(prof, 56);
    const mkBasin = (side: THREE.Side) =>
      new THREE.MeshPhysicalMaterial({
        color: 0xd6e4ec,
        transparent: true,
        opacity: 0.3,
        roughness: 0.12,
        metalness: 0,
        envMapIntensity: 0.7,
        side,
        depthWrite: false,
      });
    this.basinMats = [mkBasin(THREE.BackSide), mkBasin(THREE.FrontSide)];
    this.basinBack = new THREE.Mesh(basinGeo, this.basinMats[0]);
    this.basinFront = new THREE.Mesh(basinGeo, this.basinMats[1]);

    // the water: a clear body with a faint tint; ice water is cloudier
    const mkWater = (side: THREE.Side) =>
      new THREE.MeshPhysicalMaterial({
        color: 0xaed8ea,
        transparent: true,
        opacity: 0.32,
        roughness: 0.05,
        metalness: 0,
        ior: 1.333,
        envMapIntensity: 1.0,
        depthWrite: false,
        side,
      });
    this.waterMats = [mkWater(THREE.BackSide), mkWater(THREE.FrontSide)];
    const wr = this.rBasin - t - 0.02;
    const waterGeo = new THREE.CylinderGeometry(wr, wr - 0.4, this.hWater - 0.3, 56, 1, true);
    this.waterBack = new THREE.Mesh(waterGeo, this.waterMats[0]);
    this.waterFront = new THREE.Mesh(waterGeo, this.waterMats[1]);
    for (const w of [this.waterBack, this.waterFront]) w.position.y = 0.3 + (this.hWater - 0.3) / 2;
    this.surfaceMat = new THREE.MeshPhysicalMaterial({
      color: 0xc4e4f2,
      transparent: true,
      opacity: 0.5,
      roughness: 0.03,
      metalness: 0,
      clearcoat: 0.6,
      envMapIntensity: 1.2,
      depthWrite: false,
    });
    const disc = new THREE.CircleGeometry(wr, 56);
    disc.rotateX(-Math.PI / 2);
    this.surface = new THREE.Mesh(disc, this.surfaceMat);
    this.surface.position.y = this.hWater;

    // ice cubes between the glass and the basin wall
    const ringArea = Math.PI * (wr * wr - (this.rGlass + 0.4) ** 2);
    const n = Math.max(0, Math.min(26, Math.floor(ringArea / 4.5)));
    for (let i = 0; i < n; i++) {
      this.cubes.push({
        a: i * 2.399963 + hash(i, 1) * 0.4,
        r: this.rGlass + 0.5 + Math.sqrt((i + 0.5) / Math.max(1, n)) * Math.max(0.4, wr - this.rGlass - 1.6),
        s: 1.1 + hash(i, 2) * 0.9,
        ph: hash(i, 3) * 6.28,
        tumble: 0.2 + hash(i, 4) * 0.4,
      });
    }
    this.iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f3fa,
      transparent: true,
      opacity: 0.72,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 0.5,
      envMapIntensity: 1.1,
      flatShading: true,
    });
    const mkIce = () => {
      const m = new THREE.InstancedMesh(getCubeGeo(), this.iceMat, Math.max(1, n));
      m.count = 0;
      m.visible = false;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // the camera, as seen by the draw call, decides which cubes lie in front of the vessel
      m.onBeforeRender = (_r, _s, camera) => this.camWorld.copy(camera.position);
      return m;
    };
    this.iceBack = mkIce();
    this.iceFront = mkIce();

    for (const m of [this.basinBack, this.basinFront, this.waterBack, this.waterFront, this.surface, this.iceBack, this.iceFront]) m.raycast = () => {};
    this.group.add(this.basinBack, this.waterBack, this.surface, this.iceBack, this.iceFront, this.waterFront, this.basinFront);
    this.group.visible = false;
  }

  public setRenderOrder(base: number) {
    for (const m of [this.basinBack, this.waterBack, this.surface, this.iceBack]) m.renderOrder = base;
    for (const m of [this.basinFront, this.waterFront, this.iceFront]) m.renderOrder = base + 8;
  }

  /**
   * `shown`: the vessel stands in the bath (not lifted out); `bathK`: the engine's bath temperature, null = none;
   * `iceFraction`: the mass fraction of a finite bath that is still ice (`snapshot.bath`), absent for an infinite reservoir
   * (ice then follows the temperature alone). The cubes thin out and shrink as the ice melts.
   */
  public update(dt: number, time: number, bathK: number | null | undefined, shown: boolean, iceFraction?: number) {
    const has = bathVisible(bathK) && shown;
    this.level += ((has ? 1 : 0) - this.level) * Math.min(1, dt * 5);
    if (bathVisible(bathK)) this.bathK = bathK;
    const vis = this.level > 0.02 && this.bathK !== null;
    this.group.visible = vis;
    if (!vis) return;
    const k = this.bathK as number;
    this.group.scale.set(1, 0.4 + 0.6 * this.level, 1);
    for (const m of this.basinMats) m.opacity = 0.3 * this.level;
    const finite = typeof iceFraction === 'number' && Number.isFinite(iceFraction);
    const iceLeft = finite ? THREE.MathUtils.clamp(iceFraction as number, 0, 1) : 1;
    const slush = finite ? iceLeft > 0.002 : k <= ICE_BATH_MAX_K;
    // colder water is a deeper, cloudier blue; a bath above the glow threshold would emit (never in a real bath)
    const cold = THREE.MathUtils.clamp((300 - k) / 40, 0, 1);
    const hue = k > 780 ? blackbodyHue(k) : null;
    for (const m of this.waterMats) {
      m.color.setRGB(0.55 - 0.1 * cold, 0.78, 0.9 + 0.05 * cold).lerp(WHITE, slush ? 0.18 : 0);
      m.opacity = (0.26 + 0.14 * cold) * this.level;
      if (hue) m.emissive.setRGB(hue[0] * 0.3, hue[1] * 0.3, hue[2] * 0.3);
      else m.emissive.setRGB(0, 0, 0);
    }
    this.surfaceMat.opacity = 0.5 * this.level;

    // ice: cubes on the camera's side of the vessel are drawn after it, the others before
    // (a finite bath keeps one cube until its last ice is gone, then fewer and smaller ones as it melts)
    const share = finite ? Math.min(1, 0.12 + iceLeft * 2.5) : 1;
    const n = slush && this.cubes.length > 0 ? Math.min(this.cubes.length, Math.max(1, Math.round(this.cubes.length * share))) : 0;
    this.group.updateWorldMatrix(true, false);
    this.camLocal.copy(this.camWorld);
    this.group.worldToLocal(this.camLocal);
    let nb = 0;
    let nf = 0;
    if (n > 0) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const pos = new THREE.Vector3();
      const sc = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        const c = this.cubes[i];
        const a = c.a + Math.sin(time * 0.17 + c.ph) * 0.05 + time * 0.01 * c.tumble;
        const bob = Math.sin(time * 0.9 + c.ph) * 0.035;
        pos.set(Math.cos(a) * c.r, this.hWater - c.s * 0.38 + bob, Math.sin(a) * c.r);
        q.setFromEuler(e.set(c.ph * 0.3 + Math.sin(time * 0.3 + c.ph) * 0.1, c.ph + time * 0.04 * c.tumble, Math.cos(time * 0.27 + c.ph) * 0.1));
        sc.setScalar(c.s * (0.85 + 0.15 * this.level) * (finite ? 0.55 + 0.45 * Math.min(1, iceLeft * 3) : 1));
        m.compose(pos, q, sc);
        if (pos.x * this.camLocal.x + pos.z * this.camLocal.z > 0) this.iceFront.setMatrixAt(nf++, m);
        else this.iceBack.setMatrixAt(nb++, m);
      }
      this.iceBack.instanceMatrix.needsUpdate = true;
      this.iceFront.instanceMatrix.needsUpdate = true;
      this.iceMat.opacity = 0.72 * this.level;
    }
    this.iceBack.count = nb;
    this.iceFront.count = nf;
    this.iceBack.visible = nb > 0;
    this.iceFront.visible = nf > 0;
  }

  /** Radius of the basin (cm), for layout checks. */
  public get radius(): number {
    return this.rBasin;
  }

  /** True while the bath is cold enough to be drawn as an ice bath. */
  public get hasIce(): boolean {
    return this.iceBack.count + this.iceFront.count > 0;
  }

  public dispose() {
    this.basinBack.geometry.dispose();
    this.waterBack.geometry.dispose();
    this.surface.geometry.dispose();
    for (const m of [...this.basinMats, ...this.waterMats, this.surfaceMat, this.iceMat]) m.dispose();
  }
}

/** True when the engine's bath temperature is an ice bath. */
export function isIceBath(bathK: number | null | undefined): boolean {
  return bathVisible(bathK) && bathK <= ICE_BATH_MAX_K;
}
