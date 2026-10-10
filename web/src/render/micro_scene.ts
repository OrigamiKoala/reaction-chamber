// Molecular viewer: the three.js scene of the box (own WebGLRenderer on the tab's canvas, instanced atoms and bond cylinders).
//
// `new MicroScene(canvas)` draws; `new MicroScene(null)` builds the same scene graph without a renderer so that the instance
// counts can be checked headlessly (tests/micro_view.mjs). Atoms are one InstancedMesh of spheres and bonds one of cylinders
// (each bond cylinder is split in two halves so every half takes its atom's colour). Waters are a second pair of meshes so
// they can be faint, solid or hidden independently of the solutes.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Body, MicroMotion } from './micro_motion';
import type { DrawableEvent } from './micro_morph';
import type { Slab } from './micro_slab';
import { BOND_RADIUS } from './micro_shape';

export type StyleMode = 'ball-stick' | 'space-filling';
export type WaterMode = 'faint' | 'solid' | 'hidden';

const FAINT_OPACITY = 0.2;
const V3 = new THREE.Vector3();
const V3b = new THREE.Vector3();
const Q = new THREE.Quaternion();
const Q2 = new THREE.Quaternion();
const M = new THREE.Matrix4();
const S = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const COL = new THREE.Color();

/** The atoms and bonds of one group of bodies (solutes or waters) as two instanced meshes. */
class InstancedMolecules {
  public readonly group = new THREE.Group();
  public atoms: THREE.InstancedMesh;
  public bonds: THREE.InstancedMesh;
  private atomCap = 0;
  private bondCap = 0;
  private signature = 0;
  public atomCount = 0;
  public bondCount = 0;
  private readonly sphere = new THREE.SphereGeometry(1, 16, 12);
  private readonly cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
  public readonly material: THREE.MeshStandardMaterial;

  constructor(opacity: number) {
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.0 });
    this.setOpacity(opacity);
    this.atoms = this.makeMesh(this.sphere, 512);
    this.bonds = this.makeMesh(this.cyl, 1024);
    this.atomCap = 512;
    this.bondCap = 1024;
    this.group.add(this.atoms, this.bonds);
  }

  private makeMesh(geo: THREE.BufferGeometry, cap: number): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geo, this.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    // colours exist from the start so a layout change only rewrites them
    m.setColorAt(0, COL.set(0xffffff));
    return m;
  }

  public setOpacity(o: number) {
    this.material.transparent = o < 1;
    this.material.opacity = o;
    this.material.depthWrite = o >= 1;
    this.material.needsUpdate = true;
  }

  private grow(kind: 'atoms' | 'bonds', need: number) {
    const cap = Math.max(need, (kind === 'atoms' ? this.atomCap : this.bondCap) * 2);
    const old = this[kind];
    const next = this.makeMesh(kind === 'atoms' ? this.sphere : this.cyl, cap);
    this.group.remove(old);
    old.dispose();
    this.group.add(next);
    this[kind] = next;
    if (kind === 'atoms') this.atomCap = cap;
    else this.bondCap = cap;
    this.signature = 0; // colours must be rewritten
  }

  /** Writes every instance matrix (and the colours when the set of bodies changed). */
  public update(bodies: readonly Body[], style: StyleMode, visible: (b: Body) => boolean) {
    let na = 0;
    let nb = 0;
    // a hash of the style and the uids shown: when it moves the colours are rewritten
    let sig = style === 'ball-stick' ? 17 : 29;
    for (const b of bodies) {
      if (!visible(b)) continue;
      na += b.shape.atoms.length;
      if (style === 'ball-stick') nb += b.shape.segs.length * 2;
      sig = (Math.imul(sig, 31) + b.uid) | 0;
    }
    sig = (Math.imul(sig, 31) + na) | 0;
    if (na > this.atomCap) this.grow('atoms', na);
    if (nb > this.bondCap) this.grow('bonds', nb);
    const writeColours = sig !== this.signature;
    this.signature = sig;

    let ia = 0;
    let ib = 0;
    for (const b of bodies) {
      if (!visible(b)) continue;
      const sh = b.shape;
      for (const a of sh.atoms) {
        V3.copy(a.p).applyQuaternion(b.quat).add(b.pos);
        const r = style === 'space-filling' ? a.rVdw : a.rBall;
        S.set(r, r, r);
        M.compose(V3, Q.identity(), S);
        this.atoms.setMatrixAt(ia, M);
        if (writeColours) this.atoms.setColorAt(ia, a.colour);
        ia++;
      }
      if (style !== 'ball-stick') continue;
      for (const g of sh.segs) {
        V3.copy(g.mid).applyQuaternion(b.quat).add(b.pos);
        Q2.multiplyQuaternions(b.quat, g.quat);
        V3b.copy(Y).applyQuaternion(Q2).multiplyScalar(g.len * 0.25);
        S.set(g.radius, g.len * 0.5, g.radius);
        for (let half = 0; half < 2; half++) {
          const sgn = half === 0 ? -1 : 1;
          const c = V3.clone().addScaledVector(V3b, sgn);
          M.compose(c, Q2, S);
          this.bonds.setMatrixAt(ib, M);
          if (writeColours) this.bonds.setColorAt(ib, sh.atoms[half === 0 ? g.a : g.b].colour);
          ib++;
        }
      }
    }
    this.atomCount = ia;
    this.bondCount = ib;
    this.atoms.count = ia;
    this.bonds.count = ib;
    this.atoms.instanceMatrix.needsUpdate = true;
    this.bonds.instanceMatrix.needsUpdate = true;
    if (writeColours) {
      if (this.atoms.instanceColor) this.atoms.instanceColor.needsUpdate = true;
      if (this.bonds.instanceColor) this.bonds.instanceColor.needsUpdate = true;
    }
  }

  public dispose() {
    this.atoms.dispose();
    this.bonds.dispose();
    this.sphere.dispose();
    this.cyl.dispose();
    this.material.dispose();
  }
}

/** The atoms and bonds of the reaction events in progress (opaque, drawn solid whatever the water mode is). */
/** Electron points drawn per event at most (three per hop, a few hops). */
const MAX_ELECTRONS = 9;

class EventLayer {
  public readonly group = new THREE.Group();
  public atoms: THREE.InstancedMesh;
  public bonds: THREE.InstancedMesh;
  public atomCount = 0;
  public bondCount = 0;
  private atomCap = 256;
  private bondCap = 512;
  private readonly sphere = new THREE.SphereGeometry(1, 16, 12);
  private readonly cyl = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
  private readonly material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.0 });
  private static readonly GLOW = new THREE.Color(1.0, 0.92, 0.55);
  private static readonly WHITE = new THREE.Color(1, 1, 1);
  private electrons: Array<{ pos: THREE.Vector3; strength: number }> = [];

  constructor() {
    this.atoms = this.makeMesh(this.sphere, this.atomCap);
    this.bonds = this.makeMesh(this.cyl, this.bondCap);
    this.group.add(this.atoms, this.bonds);
  }

  private makeMesh(geo: THREE.BufferGeometry, cap: number): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geo, this.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    m.setColorAt(0, COL.set(0xffffff));
    return m;
  }

  private grow(kind: 'atoms' | 'bonds', need: number) {
    const cap = Math.max(need, (kind === 'atoms' ? this.atomCap : this.bondCap) * 2);
    const old = this[kind];
    const next = this.makeMesh(kind === 'atoms' ? this.sphere : this.cyl, cap);
    this.group.remove(old);
    old.dispose();
    this.group.add(next);
    this[kind] = next;
    if (kind === 'atoms') this.atomCap = cap;
    else this.bondCap = cap;
  }

  public update(events: readonly DrawableEvent[], style: StyleMode) {
    let na = 0;
    let nb = 0;
    for (const e of events) {
      na += e.atoms.length + MAX_ELECTRONS;
      if (style === 'ball-stick') nb += e.bonds.length * 3 * 2;
    }
    if (na > this.atomCap) this.grow('atoms', na);
    if (nb > this.bondCap) this.grow('bonds', nb);
    let ia = 0;
    let ib = 0;
    const lines: Array<{ slot: number; weight: number; thin: boolean }> = [];
    const d = new THREE.Vector3();
    const ref = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    const inPlane = new THREE.Vector3();
    for (const e of events) {
      for (const a of e.atoms) {
        const r = (style === 'space-filling' ? a.rVdw : a.rBall) * a.scale;
        S.set(r, r, r);
        M.compose(a.pos, Q.identity(), S);
        this.atoms.setMatrixAt(ia, M);
        this.atoms.setColorAt(ia, COL.copy(a.colour).lerp(EventLayer.GLOW, 0.65 * a.glow));
        ia++;
      }
      // the electrons of an electron transfer: small bright points on their way from donor to acceptor
      for (const el of e.electronSprites(this.electrons).slice(0, MAX_ELECTRONS)) {
        S.set(0.34, 0.34, 0.34);
        M.compose(el.pos, Q.identity(), S);
        this.atoms.setMatrixAt(ia, M);
        this.atoms.setColorAt(ia, COL.setRGB(0.45, 0.8, 1.0).lerp(EventLayer.WHITE, 0.6 * el.strength));
        ia++;
      }
      if (style !== 'ball-stick') continue;
      for (const b of e.bonds) {
        e.linesOf(b, lines);
        if (lines.length === 0) continue;
        const pa = e.atoms[b.a].pos;
        const pb = e.atoms[b.b].pos;
        d.copy(pb).sub(pa);
        const len = d.length();
        if (len < 1e-6) continue;
        d.multiplyScalar(1 / len);
        // plane of multiple bonds: from a neighbour that is off the axis, else any perpendicular
        if (b.ref >= 0) ref.copy(e.atoms[b.ref].pos).sub(pa);
        else ref.set(Math.abs(d.x) < 0.9 ? 1 : 0, Math.abs(d.x) < 0.9 ? 0 : 1, 0);
        nrm.crossVectors(d, ref);
        if (nrm.lengthSq() < 1e-8) nrm.set(0, 0, 1).cross(d);
        nrm.normalize();
        inPlane.crossVectors(nrm, d).normalize();
        Q2.setFromUnitVectors(Y, d);
        for (const ln of lines) {
          const base = lines.length === 1 ? 1 : ln.thin ? 0.44 : 0.62;
          const rad = BOND_RADIUS * base * Math.max(0.08, ln.weight);
          for (let half = 0; half < 2; half++) {
            const sgn = half === 0 ? -1 : 1;
            V3.copy(pa).add(pb).multiplyScalar(0.5).addScaledVector(inPlane, ln.slot * 0.1).addScaledVector(d, sgn * len * 0.25);
            S.set(rad, len * 0.5, rad);
            M.compose(V3, Q2, S);
            this.bonds.setMatrixAt(ib, M);
            this.bonds.setColorAt(ib, COL.copy(e.atoms[half === 0 ? b.a : b.b].colour).lerp(EventLayer.GLOW, 0.65 * e.atoms[half === 0 ? b.a : b.b].glow));
            ib++;
          }
        }
      }
    }
    this.atomCount = ia;
    this.bondCount = ib;
    this.atoms.count = ia;
    this.bonds.count = ib;
    this.atoms.instanceMatrix.needsUpdate = true;
    this.bonds.instanceMatrix.needsUpdate = true;
    if (this.atoms.instanceColor) this.atoms.instanceColor.needsUpdate = true;
    if (this.bonds.instanceColor) this.bonds.instanceColor.needsUpdate = true;
  }

  public dispose() {
    this.atoms.dispose();
    this.bonds.dispose();
    this.sphere.dispose();
    this.cyl.dispose();
    this.material.dispose();
  }
}

// ------------------------------------------------------------------------------------------------ charge labels
/** Labels of one text drawn at most this many times per frame. */
const LABEL_CAP = 96;

/** "+", "2+", "-", "2-" (a real minus sign) for a formal charge. */
export function chargeText(q: number): string {
  if (q === 0) return '';
  const n = Math.abs(q);
  return `${n === 1 ? '' : n}${q > 0 ? '+' : '\u2212'}`;
}

/**
 * Charge labels for the ions in the box and the atoms whose charge changes in an event: for every distinct text an instanced
 * plane with the text on a texture, turned toward the camera each frame. Drawn on top of everything (no depth test).
 */
class ChargeLabels {
  public readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.InstancedMesh>();
  private readonly geo = new THREE.PlaneGeometry(1, 1);
  private used = new Map<string, number>();
  /** Labels drawn in the last frame. */
  public count = 0;

  private meshFor(text: string): THREE.InstancedMesh {
    let m = this.meshes.get(text);
    if (m) return m;
    const mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      // (a scripted DOM without a 2d context draws no text; the labels are then blank squares of the material colour)
      const g = typeof c.getContext === 'function' ? c.getContext('2d') : null;
      if (g) {
        g.clearRect(0, 0, 64, 64);
        g.font = 'bold 40px system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = 7;
        g.strokeStyle = 'rgba(8,14,18,0.92)';
        g.strokeText(text, 32, 34);
        g.fillStyle = text.endsWith('+') ? '#ff9a8a' : '#8fc2ff';
        g.fillText(text, 32, 34);
        mat.map = new THREE.CanvasTexture(c);
        mat.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
    m = new THREE.InstancedMesh(this.geo, mat, LABEL_CAP);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.renderOrder = 20;
    m.count = 0;
    this.meshes.set(text, m);
    this.group.add(m);
    return m;
  }

  public begin() {
    this.used.clear();
    this.count = 0;
  }

  /** A label for charge `q` at `pos`, `size` angstrom across, turned toward the camera. */
  public add(q: number, pos: THREE.Vector3, size: number, camQuat: THREE.Quaternion) {
    const text = chargeText(q);
    if (!text) return;
    const m = this.meshFor(text);
    const i = this.used.get(text) ?? 0;
    if (i >= LABEL_CAP) return;
    S.set(size, size, size);
    M.compose(pos, camQuat, S);
    m.setMatrixAt(i, M);
    this.used.set(text, i + 1);
    this.count++;
  }

  public end() {
    for (const [text, m] of this.meshes) {
      m.count = this.used.get(text) ?? 0;
      m.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose() {
    for (const m of this.meshes.values()) {
      (m.material as THREE.MeshBasicMaterial).map?.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
    this.geo.dispose();
  }
}

export interface MicroSceneStats {
  soluteAtoms: number;
  soluteBonds: number;
  waterAtoms: number;
  waterBonds: number;
  eventAtoms: number;
  eventBonds: number;
  slabAtoms: number;
  slabBonds: number;
  labels: number;
}

export class MicroScene {
  public readonly scene = new THREE.Scene();
  public readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000);
  public style: StyleMode = 'ball-stick';
  private water: WaterMode = 'faint';
  private readonly solutes = new InstancedMolecules(1);
  private readonly waters = new InstancedMolecules(FAINT_OPACITY);
  private readonly events = new EventLayer();
  private readonly slabLayer = new InstancedMolecules(1);
  private readonly bedrock = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.85, metalness: 0.1, transparent: true, opacity: 0.55 }),
  );
  private readonly labels = new ChargeLabels();
  /** Charge labels on the ions of the box (the atoms whose charge an event changes always get one). */
  public showCharges = false;
  private slab: Slab | null = null;
  private slabSig = '';
  private below = 0;
  private rest = new THREE.Vector3();
  private follow: THREE.Vector3 | null = null;
  private pxW = 1;
  private pxH = 1;
  private readonly frame = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4a5d6e, transparent: true, opacity: 0.35 }));
  private readonly surface = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x5ec4d6, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  private renderer: THREE.WebGLRenderer | null = null;
  private controls: OrbitControls | null = null;
  private size = new THREE.Vector3(1, 1, 1);

  constructor(canvas: HTMLCanvasElement | null) {
    this.scene.background = new THREE.Color(0xf5f7f8);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xcfd6dc, 1.2);
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(1.2, 2, 1.4);
    this.scene.add(hemi, key, this.waters.group, this.solutes.group, this.slabLayer.group, this.bedrock, this.events.group, this.labels.group, this.frame, this.surface);
    this.bedrock.visible = false;
    this.surface.rotation.x = Math.PI / 2;
    if (canvas) {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.enablePan = false;
    }
  }

  /** The box the bodies live in; also frames the camera. `surfaceOpen` draws the liquid's free surface on the top face. */
  public setBox(size: THREE.Vector3, hasSurface: boolean) {
    this.size.copy(size);
    this.frame.geometry.dispose();
    this.frame.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
    this.surface.visible = hasSurface;
    this.surface.scale.set(size.x, size.z, 1);
    this.surface.position.set(0, size.y / 2, 0);
    this.reframe();
  }

  /** The slab under the box (a solid surface), or none. It hangs below the floor: its top face is the floor of the box. */
  public setSlab(slab: Slab | null) {
    this.slab = slab;
    this.slabSig = '';
    this.below = slab ? slab.layout.height + slab.layout.spacing + 4 : 0;
    this.bedrock.visible = !!slab;
    if (slab) {
      const bottom = slab.origin.y - slab.layout.height - slab.layout.spacing * 0.5;
      this.bedrock.scale.set(Math.max(slab.layout.width, slab.layout.depth) + 6, 14, Math.max(slab.layout.width, slab.layout.depth) + 6);
      this.bedrock.position.set(slab.origin.x, bottom - 7, slab.origin.z);
    } else {
      this.slabLayer.update([], this.style, () => true);
    }
    this.reframe();
  }

  private reframe() {
    const size = this.size;
    // the camera looks at the middle of box and slab together
    const cy = -this.below / 2;
    this.rest.set(0, cy, 0);
    const d = (Math.max(size.x, size.y + this.below, size.z) * 2.3);
    this.camera.position.set(d * 0.35, cy + d * 0.28, d * 0.92);
    this.camera.near = d / 100;
    this.camera.far = d * 10;
    this.camera.updateProjectionMatrix();
    if (this.controls) {
      this.controls.target.set(0, cy, 0);
      this.controls.minDistance = d * 0.35;
      this.controls.maxDistance = d * 1.8;
      this.controls.update();
    } else {
      this.camera.lookAt(0, cy, 0);
    }
  }

  public setWaterMode(m: WaterMode) {
    this.water = m;
    this.waters.group.visible = m !== 'hidden';
    this.waters.setOpacity(m === 'faint' ? FAINT_OPACITY : 1);
  }

  public resize(w: number, h: number) {
    if (w < 2 || h < 2) return;
    this.pxW = w;
    this.pxH = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(w, h, false);
  }

  /** Writes the bodies' poses into the instance buffers. */
  public sync(motion: MicroMotion, events: readonly DrawableEvent[] = []) {
    // a body that an event owns is drawn by the event, atom by atom
    this.solutes.update(motion.bodies, this.style, (b) => b.role === 'solute' && b.state !== 'reacting');
    this.waters.update(motion.bodies, this.style, (b) => b.role === 'water' && this.water !== 'hidden' && b.state !== 'reacting');
    this.events.update(events, this.style);
    this.syncLabels(motion, events);
    if (this.slab) {
      const sig = `${this.slab.version}|${this.style}`;
      if (sig !== this.slabSig) {
        this.slabSig = sig;
        this.slabLayer.update(this.slab.bodies(), this.style, () => true);
      }
    }
  }

  /** Charge labels: ions of the box (when switched on) and atoms of events whose charge changes (the old charge, then the new one from half way). */
  private syncLabels(motion: MicroMotion, events: readonly DrawableEvent[]) {
    const L = this.labels;
    L.begin();
    const up = V3;
    if (this.showCharges) {
      for (const b of motion.bodies) {
        if (b.state === 'reacting' || b.state === 'leaving' || b.role === 'water' || b.shape.charge === 0) continue;
        up.set(b.pos.x, b.pos.y + b.shape.radius * 0.55 + 0.6, b.pos.z);
        L.add(b.shape.charge, up, 1.7, this.camera.quaternion);
      }
    }
    for (const e of events) {
      const half = (e.progress ?? 0) >= 0.5;
      for (const a of e.atoms) {
        if (a.chargeFrom === a.chargeTo || a.scale < 0.05) continue;
        up.set(a.pos.x, a.pos.y + a.rBall + 0.7, a.pos.z);
        L.add(half ? a.chargeTo : a.chargeFrom, up, 1.9, this.camera.quaternion);
      }
    }
    L.end();
  }

  /** Where a world point lands on the canvas, in css pixels (`visible`: in front of the camera and inside the frame). */
  public project(p: THREE.Vector3): { x: number; y: number; visible: boolean } {
    this.camera.updateMatrixWorld();
    V3b.copy(p).project(this.camera);
    return { x: (V3b.x * 0.5 + 0.5) * this.pxW, y: (-V3b.y * 0.5 + 0.5) * this.pxH, visible: V3b.z < 1 && Math.abs(V3b.x) <= 1.05 && Math.abs(V3b.y) <= 1.05 };
  }

  /** The camera turns toward a point (an event being replayed) and back to the middle of the scene when it is null. */
  public followPoint(p: THREE.Vector3 | null) {
    this.follow = p ? p.clone() : null;
  }

  public render() {
    if (!this.renderer) return;
    if (this.controls) {
      this.controls.target.lerp(this.follow ?? this.rest, this.follow ? 0.07 : 0.05);
    }
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  }

  public stats(): MicroSceneStats {
    return {
      soluteAtoms: this.solutes.atomCount,
      soluteBonds: this.solutes.bondCount,
      waterAtoms: this.waters.atomCount,
      waterBonds: this.waters.bondCount,
      eventAtoms: this.events.atomCount,
      eventBonds: this.events.bondCount,
      slabAtoms: this.slabLayer.atomCount,
      slabBonds: this.slabLayer.bondCount,
      labels: this.labels.count,
    };
  }

  public dispose() {
    this.controls?.dispose();
    this.solutes.dispose();
    this.waters.dispose();
    this.events.dispose();
    this.labels.dispose();
    this.slabLayer.dispose();
    this.bedrock.geometry.dispose();
    (this.bedrock.material as THREE.Material).dispose();
    this.frame.geometry.dispose();
    (this.frame.material as THREE.Material).dispose();
    this.surface.geometry.dispose();
    (this.surface.material as THREE.Material).dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
