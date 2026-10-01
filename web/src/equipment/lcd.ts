import * as THREE from 'three';

/**
 * Small canvas LCD (reflective segment style). Redraws only when the text changes.
 */
export class LcdDisplay {
  public mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private last = '';

  constructor(
    widthCm: number,
    heightCm: number,
    private opts: { bg: string; fg: string; ghost: string; unit?: string; caption?: string } = {
      bg: '#aebd98',
      fg: '#18210f',
      ghost: 'rgba(24,33,15,0.07)',
    }
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = Math.round((512 * heightCm) / widthCm);
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthCm, heightCm), mat);
    this.mesh.raycast = () => {};
  }

  public set(text: string, sub = '') {
    const key = text + '|' + sub;
    if (key === this.last) return;
    this.last = key;
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.opts.bg);
    g.addColorStop(1, shade(this.opts.bg, -18));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const size = Math.round(H * 0.62);
    ctx.font = `700 ${size}px "DSEG7 Classic", "Courier New", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const right = W - (this.opts.unit ? W * 0.2 : W * 0.06);
    // ghost segments for an LCD feel
    ctx.fillStyle = this.opts.ghost;
    ctx.fillText('8888.88'.slice(-Math.max(4, text.length)), right, H * 0.56);
    ctx.fillStyle = this.opts.fg;
    ctx.fillText(text, right, H * 0.56);
    if (this.opts.unit) {
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(H * 0.26)}px Arial, sans-serif`;
      ctx.fillText(this.opts.unit, right + W * 0.03, H * 0.66);
    }
    if (this.opts.caption || sub) {
      ctx.textAlign = 'left';
      ctx.font = `600 ${Math.round(H * 0.16)}px Arial, sans-serif`;
      ctx.fillText(sub || this.opts.caption || '', W * 0.04, H * 0.16);
    }
    // glass glare
    const gl = ctx.createLinearGradient(0, 0, W, H);
    gl.addColorStop(0, 'rgba(255,255,255,0.18)');
    gl.addColorStop(0.4, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    this.texture.needsUpdate = true;
  }
}

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255 + amt)));
  return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
}

/** Rounded box helper used by several instrument bodies. */
export function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const bevel = Math.min(r * 0.5, h * 0.2);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

/** Place `obj` at a world pose regardless of its parent's transform. */
export function setWorldPose(obj: THREE.Object3D, pos: THREE.Vector3, quat: THREE.Quaternion) {
  const parent = obj.parent;
  if (!parent) {
    obj.position.copy(pos);
    obj.quaternion.copy(quat);
    return;
  }
  parent.updateWorldMatrix(true, false);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const m = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
  m.premultiply(inv);
  const s = new THREE.Vector3();
  m.decompose(obj.position, obj.quaternion, s);
}
