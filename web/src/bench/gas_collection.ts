// Gas collection on the bench: delivery tubes (procedural bent glass tube between a stoppered flask and a collector),
// the drag-the-tube-end interaction, and the collector visuals (gas syringe plunger, gas column in a tube / jar).
// The chemistry (gas moving from the flask headspace into the collector, moles conserved) lives in the engine
// (engine/src/gas.rs); this file only draws it and forwards link / unlink requests through `GasHost`.
import * as THREE from 'three';
import type { VesselBundle } from './glassware';
import type { VesselSnapshot } from '../types/sim';
import { plungerMl } from './gas_math';

/** Collector kinds by profile kind. */
export function isCollectorKind(kind: string): boolean {
  return kind === 'gas-syringe' || kind === 'gas-tube' || kind === 'gas-jar';
}

export interface GasHost {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  controls: { enabled: boolean };
  vessels(): Map<string, VesselBundle>;
  /** True while a bottle / vessel is being carried (the tube end cannot be grabbed then). */
  busy(): boolean;
  /** The user dropped the tube end of `srcId` onto the collector `dstId`. */
  link(srcId: string, dstId: string): void;
  /** The user pulled the tube of `srcId` off its collector. */
  unlink(srcId: string): void;
  notify(message: string, kind?: 'info' | 'warning'): void;
  setHint(text: string | null): void;
}

const warned = new Set<string>();
function warnOnce(key: string, e: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[gas] ${key}`, e);
}

let glassMat: THREE.MeshPhysicalMaterial | null = null;
let sleeveMat: THREE.MeshStandardMaterial | null = null;
let proxyMat: THREE.MeshBasicMaterial | null = null;

function tubeMaterial(): THREE.MeshPhysicalMaterial {
  glassMat ??= new THREE.MeshPhysicalMaterial({
    color: 0xd3e6ef,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    metalness: 0,
    envMapIntensity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return glassMat;
}

function rubberMaterial(): THREE.MeshStandardMaterial {
  sleeveMat ??= new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.7, metalness: 0 });
  return sleeveMat;
}

function pickMaterial(): THREE.MeshBasicMaterial {
  proxyMat ??= new THREE.MeshBasicMaterial({ visible: false });
  return proxyMat;
}

const TUBE_R = 0.3;

interface Tube {
  src: string;
  dst: string;
  group: THREE.Group;
  glass: THREE.Mesh;
  sleeveA: THREE.Mesh;
  sleeveB: THREE.Mesh;
  end: THREE.Mesh;
  key: string;
  /** Free-end override while the user drags it (world). */
  drag: THREE.Vector3 | null;
}

/** A tube of unit length along +Y, scaled / placed per frame (rubber sleeve over the glass at a tube end). */
function sleeveGeometry(): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(TUBE_R * 1.25, TUBE_R * 1.25, 1, 12);
  g.translate(0, 0.5, 0);
  return g;
}

export class GasTubes {
  private tubes = new Map<string, Tube>(); // by source vessel id
  private ray = new THREE.Raycaster();
  private dragging: Tube | null = null;
  private dragPlaneY = 12;
  private ptr = new THREE.Vector2();
  private sleeveGeo = sleeveGeometry();
  private endGeo = new THREE.SphereGeometry(1.1, 10, 8);

  constructor(private host: GasHost) {
    window.addEventListener('pointerdown', this.onDown, true);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
  }

  public dispose() {
    window.removeEventListener('pointerdown', this.onDown, true);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    for (const id of Array.from(this.tubes.keys())) this.unlink(id);
    this.sleeveGeo.dispose();
    this.endGeo.dispose();
  }

  // ---------------------------------------------------------------- links (visual side)
  public link(srcId: string, dstId: string) {
    this.unlink(srcId);
    const group = new THREE.Group();
    group.name = `gas-tube-${srcId}`;
    const glass = new THREE.Mesh(new THREE.BufferGeometry(), tubeMaterial());
    glass.renderOrder = 40;
    glass.raycast = () => {};
    const sleeveA = new THREE.Mesh(this.sleeveGeo, rubberMaterial());
    const sleeveB = new THREE.Mesh(this.sleeveGeo, rubberMaterial());
    for (const m of [sleeveA, sleeveB]) {
      m.raycast = () => {};
      m.castShadow = true;
    }
    const end = new THREE.Mesh(this.endGeo, pickMaterial());
    end.userData.pick = { type: 'gas-tube-end', id: srcId };
    group.add(glass, sleeveA, sleeveB, end);
    group.frustumCulled = false;
    this.host.scene.add(group);
    this.tubes.set(srcId, { src: srcId, dst: dstId, group, glass, sleeveA, sleeveB, end, key: '', drag: null });
  }

  public unlink(srcId: string) {
    const t = this.tubes.get(srcId);
    if (!t) return;
    this.tubes.delete(srcId);
    if (this.dragging === t) this.endDrag();
    this.host.scene.remove(t.group);
    t.glass.geometry.dispose();
  }

  public collectorOf(srcId: string): string | null {
    return this.tubes.get(srcId)?.dst ?? null;
  }

  public sourceOf(dstId: string): string | null {
    for (const t of this.tubes.values()) if (t.dst === dstId) return t.src;
    return null;
  }

  /** A vessel left the bench: drop every tube that touched it. Returns the sources whose tube was removed. */
  public removeVessel(id: string): string[] {
    const gone: string[] = [];
    for (const t of Array.from(this.tubes.values())) {
      if (t.src === id || t.dst === id) {
        gone.push(t.src);
        this.unlink(t.src);
      }
    }
    return gone;
  }

  // ---------------------------------------------------------------- drawing
  private worldAt(b: VesselBundle, local: THREE.Vector3): THREE.Vector3 {
    b.group.updateWorldMatrix(true, false);
    return local.clone().applyMatrix4(b.group.matrixWorld);
  }

  /** Path of the tube: out of the stopper, over the top and into the collector's opening. */
  private path(src: VesselBundle, dst: VesselBundle, drag: THREE.Vector3 | null): THREE.Vector3[] {
    const stopTop = Math.max(src.stopperTopLocal(), src.profile.rimY + src.profile.baseOffsetY);
    const a = this.worldAt(src, new THREE.Vector3(0, stopTop, 0));
    const kind = dst.profile.kind;
    let end: THREE.Vector3;
    let approach: THREE.Vector3;
    const dstPos = dst.group.position;
    const toSrc = new THREE.Vector3(a.x - dstPos.x, 0, a.z - dstPos.z);
    if (toSrc.lengthSq() < 1e-6) toSrc.set(-1, 0, 0);
    toSrc.normalize();
    if (kind === 'gas-syringe') {
      // the nozzle at the bottom of the barrel, reached from the side
      const tip = dst.tipLocal() ?? new THREE.Vector3(0, dst.profile.baseOffsetY, 0);
      end = this.worldAt(dst, tip.clone());
      approach = end.clone().addScaledVector(toSrc, 3.2);
      approach.y = end.y + 0.2;
    } else {
      // through the open top, down into the vessel
      const rimY = dst.profile.rimY + dst.profile.baseOffsetY;
      const depth = kind === 'gas-jar' ? Math.min(rimY - 2, 9) : Math.min(rimY - 2, 8);
      const top = this.worldAt(dst, new THREE.Vector3(0, rimY + 1.2, 0));
      approach = top.clone().addScaledVector(toSrc, dst.profile.rimInnerRadius * 0.35);
      end = this.worldAt(dst, new THREE.Vector3(0, rimY - depth, 0)).addScaledVector(toSrc, dst.profile.rimInnerRadius * 0.15);
    }
    if (drag) {
      end = drag.clone();
      approach = end.clone().add(new THREE.Vector3(0, 2.5, 0));
    }
    const up = Math.max(a.y + 5, approach.y + 3, end.y + 4);
    const p1 = new THREE.Vector3(a.x, a.y + 3.0, a.z);
    const p2 = new THREE.Vector3(a.x, up, a.z);
    const mid = new THREE.Vector3().lerpVectors(a, approach, 0.5);
    mid.y = up + 0.8;
    const p3 = new THREE.Vector3(approach.x, up, approach.z);
    const p4 = new THREE.Vector3(approach.x, Math.max(approach.y + 0.5, end.y), approach.z);
    return kind === 'gas-syringe' && !drag ? [a, p1, p2, mid, p3, new THREE.Vector3(approach.x, approach.y + 0.2, approach.z), end] : [a, p1, p2, mid, p3, p4, end];
  }

  public update(_dt: number, _time: number) {
    for (const t of Array.from(this.tubes.values())) {
      try {
        this.updateTube(t);
      } catch (e) {
        warnOnce('tube update failed', e);
      }
    }
  }

  private updateTube(t: Tube) {
    const vs = this.host.vessels();
    const src = vs.get(t.src);
    const dst = vs.get(t.dst);
    t.group.visible = !!src && !!dst && !src.isBurst();
    if (!src || !dst) return;
    const pts = this.path(src, dst, t.drag);
    const key = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`).join('|');
    if (key === t.key) return;
    t.key = key;
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const geo = new THREE.TubeGeometry(curve, 56, TUBE_R, 8, false);
    t.glass.geometry.dispose();
    t.glass.geometry = geo;
    // rubber sleeves over the two ends, along the local direction of the curve
    this.placeSleeve(t.sleeveA, curve, 0, 1.6, 1);
    this.placeSleeve(t.sleeveB, curve, 1, 1.4, -1);
    t.end.position.copy(pts[pts.length - 1]);
  }

  private placeSleeve(m: THREE.Mesh, curve: THREE.CatmullRomCurve3, u: number, len: number, dir: 1 | -1) {
    const p = curve.getPointAt(u);
    const tan = curve.getTangentAt(u).multiplyScalar(dir);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.normalize());
    m.quaternion.copy(q);
    m.position.copy(p);
    m.scale.set(1, len, 1);
  }

  // ---------------------------------------------------------------- dragging the tube end
  private pointer(e: PointerEvent): THREE.Vector2 {
    const rect = this.host.dom.getBoundingClientRect();
    return this.ptr.set(((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1);
  }

  private cursorOnPlane(e: PointerEvent, y: number): THREE.Vector3 | null {
    this.ray.setFromCamera(this.pointer(e), this.host.camera);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    if (Math.abs(d.y) < 1e-6) return null;
    const k = (y - o.y) / d.y;
    if (!(k > 0)) return null;
    return o.clone().addScaledVector(d, k);
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.dragging || this.tubes.size === 0) return;
    if (e.target !== this.host.dom || this.host.busy()) return;
    try {
      this.ray.setFromCamera(this.pointer(e), this.host.camera);
      const ends: THREE.Object3D[] = [];
      for (const t of this.tubes.values()) {
        t.group.updateWorldMatrix(true, true);
        ends.push(t.end);
      }
      const hits = this.ray.intersectObjects(ends, false);
      const hit = hits[0];
      if (!hit) return;
      const id = (hit.object.userData.pick as { id: string }).id;
      const t = this.tubes.get(id);
      if (!t) return;
      // a different vessel in front of the tube end? then the click was meant for that vessel
      const vessels = Array.from(this.host.vessels().values()).map((b) => b.pickProxy);
      for (const v of vessels) v.updateWorldMatrix(true, false);
      const vh = this.ray.intersectObjects(vessels, false)[0];
      const vid = vh ? (vh.object.userData.pick as { id: string } | undefined)?.id : undefined;
      if (vh && vid !== t.src && vid !== t.dst && vh.distance < hit.distance - 0.5) return;
      e.stopPropagation();
      e.preventDefault();
      this.dragging = t;
      this.dragPlaneY = Math.max(6, hit.point.y);
      t.drag = hit.point.clone();
      this.host.controls.enabled = false;
      this.host.dom.style.cursor = 'grabbing';
      this.host.setHint('Drop the tube end into a gas syringe, gas tube or gas jar · drop it anywhere else to disconnect');
    } catch (err) {
      warnOnce('pointerdown failed', err);
    }
  };

  private onMove = (e: PointerEvent) => {
    const t = this.dragging;
    if (!t) return;
    const p = this.cursorOnPlane(e, this.dragPlaneY);
    if (p) t.drag = p;
  };

  private nearestCollector(p: THREE.Vector3, exclude: string): VesselBundle | null {
    let best: VesselBundle | null = null;
    let bestD = Infinity;
    for (const [id, b] of this.host.vessels()) {
      if (id === exclude || !isCollectorKind(b.profile.kind) || b.isBurst()) continue;
      const d = Math.hypot(b.group.position.x - p.x, b.group.position.z - p.z);
      const r = Math.max(3.5, b.profile.maxOuterRadius + 2.5);
      if (d < r && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  private endDrag() {
    const t = this.dragging;
    this.dragging = null;
    if (t) t.drag = null;
    this.host.controls.enabled = true;
    this.host.dom.style.cursor = '';
    this.host.setHint(null);
  }

  private onUp = (e: PointerEvent) => {
    const t = this.dragging;
    if (!t || e.button !== 0) return;
    const p = t.drag;
    const src = t.src;
    const old = t.dst;
    this.endDrag();
    const target = p ? this.nearestCollector(p, src) : null;
    if (!target) {
      this.host.unlink(src);
      this.host.notify('Delivery tube disconnected. The flask keeps its stopper.', 'info');
    } else if (target.vesselState.id !== old) {
      this.host.link(src, target.vesselState.id);
    }
  };

  private onCancel = () => {
    if (this.dragging) this.endDrag();
  };

  // ---------------------------------------------------------------- collector visuals
  /**
   * Draws a gas collector from its snapshot (plunger of a gas syringe, a pale gas column in a tube / jar). Returns true
   * when it handled the vessel (the caller then skips the normal liquid rendering); false for ordinary vessels and for
   * collectors that hold real liquid.
   */
  public applyCollector(b: VesselBundle, snap: VesselSnapshot): boolean {
    const g = snap.gas;
    if (!g || !g.collector || snap.total_liquid_ml > 0.5) return false;
    try {
      b.lastSnapshot = snap;
      const vol = Math.max(0, Math.min(g.capacity_ml || b.profile.nominalMl, g.volume_ml));
      if (g.collector === 'syringe') {
        b.setPlungerMl(plungerMl(vol, g.capacity_ml || b.profile.nominalMl));
        b.liquid.setSimple(vol, '#ffffff', 0);
      } else if (g.collector === 'over_water') {
        b.liquid.setSimple(vol, '#cfe3f0', 0.22);
      } else {
        b.setLidVisible(true);
        b.liquid.setSimple(vol, '#e4edf1', 0.1);
      }
      b.effects.applySnapshot(snap);
    } catch (e) {
      warnOnce('collector visual failed', e);
    }
    return true;
  }
}
