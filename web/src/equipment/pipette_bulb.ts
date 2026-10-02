// Red three-valve rubber pipette filler ("bulb") that sits on top of a volumetric / graduated pipette while it is held.
// Built from a lathe + a few cylinders (1 unit = 1 cm). Origin = the socket that grips the top of the pipette, +Y up.
// Valve A (top) lets the air out, S (bottom, at the pipette) sucks liquid up, E (side) empties it: the same three
// buttons as the real thing. `setSqueeze` animates the bulb: +1 = squeezed flat (liquid pushed out), -1 = relaxed wide
// (vacuum, liquid drawn up).
import * as THREE from 'three';

let rubber: THREE.MeshPhysicalMaterial | null = null;
let plastic: THREE.MeshStandardMaterial | null = null;
let steel: THREE.MeshStandardMaterial | null = null;
let bodyGeo: THREE.BufferGeometry | null = null;
let socketGeo: THREE.BufferGeometry | null = null;
let stemGeo: THREE.CylinderGeometry | null = null;
const letterMats = new Map<string, THREE.MeshBasicMaterial>();
let letterGeo: THREE.PlaneGeometry | null = null;

function materials() {
  rubber ??= new THREE.MeshPhysicalMaterial({ color: 0xb01c1c, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  plastic ??= new THREE.MeshStandardMaterial({ color: 0xe9ebec, roughness: 0.45, metalness: 0 });
  steel ??= new THREE.MeshStandardMaterial({ color: 0xc9cdd1, roughness: 0.3, metalness: 0.9 });
  return { rubber, plastic, steel };
}

function letterMaterial(ch: string): THREE.MeshBasicMaterial {
  let m = letterMats.get(ch);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#1a1c1e';
    g.beginPath();
    g.arc(32, 32, 30, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = 'bold 40px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 32, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  letterMats.set(ch, m);
  return m;
}

function body(): THREE.BufferGeometry {
  if (bodyGeo) return bodyGeo;
  // a fat teardrop, widest in the lower third; centre of the geometry at y = 0
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -2.6)];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 bottom .. 1 top
    const y = -2.6 + t * 5.2;
    const r = 0.5 + 1.15 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.8);
    pts.push(new THREE.Vector2(Math.max(0.05, r), y));
  }
  pts.push(new THREE.Vector2(0, 2.6));
  bodyGeo = new THREE.LatheGeometry(pts, 28);
  return bodyGeo;
}

function socket(): THREE.BufferGeometry {
  // the cup that grips the pipette top: wide at the mouth, tapering into the valve block
  socketGeo ??= new THREE.LatheGeometry(
    [new THREE.Vector2(0.62, 0), new THREE.Vector2(0.62, 0.5), new THREE.Vector2(0.75, 0.55), new THREE.Vector2(0.75, 1.15), new THREE.Vector2(0.55, 1.4)],
    20
  );
  return socketGeo;
}

function stem(): THREE.CylinderGeometry {
  stemGeo ??= new THREE.CylinderGeometry(0.2, 0.24, 1, 12);
  return stemGeo;
}

export class PipetteBulb {
  public readonly group = new THREE.Group();
  private bodyMesh: THREE.Mesh;
  private squeeze = 0;
  private target = 0;

  constructor() {
    const m = materials();
    const g = this.group;
    g.name = 'pipette-bulb';
    const cup = new THREE.Mesh(socket(), m.rubber);
    // valve block: a small white body between the cup and the bulb with the S and E valves
    const block = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 16), m.plastic);
    block.position.y = 1.55;
    this.bodyMesh = new THREE.Mesh(body(), m.rubber);
    this.bodyMesh.position.y = 1.55 + 0.75 + 2.6;
    // valve A on top, S on the lower-front of the block, E on the side
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 0.9, 14), m.plastic);
    top.position.y = 1.55 + 0.75 + 5.2 + 0.35;
    const aPiece = new THREE.Mesh(stem(), m.steel);
    aPiece.scale.set(1.2, 0.9, 1.2);
    aPiece.position.y = top.position.y + 0.8;
    const sValve = new THREE.Mesh(stem(), m.steel);
    sValve.scale.set(1.1, 1.0, 1.1);
    sValve.rotation.x = Math.PI / 2;
    sValve.position.set(0, 1.35, 0.85);
    const eValve = new THREE.Mesh(stem(), m.steel);
    eValve.scale.set(1.1, 1.0, 1.1);
    eValve.rotation.z = -Math.PI / 2;
    eValve.position.set(0.85, 1.85, 0);
    letterGeo ??= new THREE.PlaneGeometry(0.5, 0.5);
    const mkLetter = (ch: string, x: number, y: number, z: number, ry: number) => {
      const p = new THREE.Mesh(letterGeo!, letterMaterial(ch));
      p.position.set(x, y, z);
      p.rotation.y = ry;
      p.renderOrder = 960;
      return p;
    };
    g.add(
      cup,
      block,
      this.bodyMesh,
      top,
      aPiece,
      sValve,
      eValve,
      mkLetter('A', 0, top.position.y + 0.05, 0.52, 0),
      mkLetter('S', 0, 1.35, 1.42, 0),
      mkLetter('E', 1.45, 1.85, 0, Math.PI / 2)
    );
    g.traverse((o) => {
      o.raycast = () => {}; // the pipette's own pick proxy handles clicks
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    g.visible = false;
  }

  /** +1 squeezed, -1 relaxed wide, 0 resting. Eased in `update`. */
  public setSqueeze(q: number) {
    this.target = Math.max(-1, Math.min(1, q));
  }

  public update(dt: number) {
    const k = 1 - Math.exp(-Math.max(0, dt) * 14);
    this.squeeze += (this.target - this.squeeze) * k;
    const q = this.squeeze;
    this.bodyMesh.scale.set(1 - 0.3 * q, 1 + 0.1 * q, 1 - 0.3 * q);
  }

  public set visible(on: boolean) {
    this.group.visible = on;
  }

  public dispose() {
    this.group.removeFromParent();
    // geometries / materials are shared module-wide
  }
}

const bulbs = new WeakMap<THREE.Object3D, PipetteBulb>();

/** The bulb of a pipette group (created and mounted at height `topY` of the group on first use). */
export function bulbFor(pipette: THREE.Object3D, topY: number): PipetteBulb {
  let b = bulbs.get(pipette);
  if (!b) {
    b = new PipetteBulb();
    b.group.position.set(0, topY - 0.45, 0); // the cup slips 0.45 cm over the glass top
    pipette.add(b.group);
    bulbs.set(pipette, b);
  }
  return b;
}
