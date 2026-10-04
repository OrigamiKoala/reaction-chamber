// Physical controls for the bench instruments: knobs, rotary / lever selectors, push buttons, rocker switches and
// canvas screens that sit ON the 3D instrument. A `ControlRig` (owned by the scene) picks them with the pointer:
// drag up / down (or scroll) turns a knob, a click steps a selector or presses a button. The instruments own their
// controls and report changes through plain callbacks; nothing here knows about chemistry.
import * as THREE from 'three';
import { roundedBox } from '../equipment/lcd';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------------ shared contract
export interface Control3D {
  readonly id: string;
  readonly group: THREE.Group;
  /** Invisible, generous pick volume (protrudes from the panel so it wins over the instrument's click box). */
  readonly hit: THREE.Mesh;
  /** One line shown in the hint banner while hovering / dragging. */
  hint(): string;
  /** Pointer went down on the control. */
  press(): void;
  /** Pointer moved since the press (cumulative pixels). Only called once the move exceeds the click tolerance. */
  drag(dx: number, dy: number, fine: boolean): void;
  /** Optional: the pointer ray in world space on every move once the press became a drag (for controls that are carried by hand). */
  dragRay?(ray: THREE.Ray): void;
  /** Pointer released. `moved` = it was dragged (not a click). */
  release(moved: boolean, heldMs: number, shift: boolean): void;
  wheel(dir: 1 | -1, fine: boolean): void;
  setHover(on: boolean): void;
  update(dt: number): void;
}

/** Mounts a control on a surface: local +Y of the control becomes `normal`, text printed on it reads upright with panel-up. */
export function place<T extends Control3D>(c: T, parent: THREE.Object3D, pos: [number, number, number], normal: [number, number, number] = [0, 0, 1]): T {
  c.group.position.set(pos[0], pos[1], pos[2]);
  c.group.quaternion.setFromUnitVectors(Y_AXIS, new THREE.Vector3(normal[0], normal[1], normal[2]).normalize());
  parent.add(c.group);
  return c;
}

// ------------------------------------------------------------------ canvas helpers
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Flat printed legend (no lighting): a plane in the XZ plane facing +Y, text-up = -Z. */
export function legendPlane(wCm: number, hCm: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, px = 128): THREE.Mesh {
  const tex = canvasTexture(Math.round(wCm * px), Math.round(hCm * px), draw);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wCm, hCm), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.raycast = () => {};
  m.renderOrder = 2;
  return m;
}

/** Plain text legend on a panel, same orientation rules as `legendPlane`. */
export function textLegend(text: string, wCm: number, hCm: number, opts: { ink?: string; weight?: number; align?: CanvasTextAlign } = {}): THREE.Mesh {
  return legendPlane(wCm, hCm, (ctx, w, h) => {
    ctx.fillStyle = opts.ink ?? '#dfe6ea';
    ctx.font = `${opts.weight ?? 700} ${Math.round(h * 0.62)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = opts.align ?? 'center';
    ctx.textBaseline = 'middle';
    const x = opts.align === 'left' ? 2 : opts.align === 'right' ? w - 2 : w / 2;
    ctx.fillText(text, x, h / 2);
  });
}

interface PlateOpts {
  radius: number;
  /** Tick count along the sweep (0 = none). */
  ticks?: number;
  /** Labels at sweep fractions 0..1 (0 = start of sweep). */
  labels?: Array<{ at: number; text: string }>;
  caption?: string;
  /** Sweep of the pointer, degrees clockwise from 12 o'clock: [start, end]. */
  sweep?: [number, number];
  ink?: string;
}

/** Printed scale around a rotary control: ticks, labels at the stops and a caption underneath. */
function scalePlate(o: PlateOpts): THREE.Mesh {
  const size = o.radius * 2;
  const [a0, a1] = o.sweep ?? [-135, 135];
  return legendPlane(
    size,
    size,
    (ctx, w, h) => {
      const cx = w / 2;
      const cy = h / 2;
      const R = w / 2;
      const ink = o.ink ?? '#dfe6ea';
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      const at = (frac: number, rad: number): [number, number] => {
        const a = ((a0 + (a1 - a0) * frac) * Math.PI) / 180;
        return [cx + Math.sin(a) * rad, cy - Math.cos(a) * rad];
      };
      const nt = o.ticks ?? 0;
      ctx.lineWidth = Math.max(2, R * 0.022);
      for (let i = 0; i < nt; i++) {
        const f = nt === 1 ? 0 : i / (nt - 1);
        const [x0, y0] = at(f, R * 0.56);
        const [x1, y1] = at(f, R * (i % 5 === 0 || nt < 8 ? 0.7 : 0.64));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.font = `700 ${Math.round(R * 0.2)}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const l of o.labels ?? []) {
        const [x, y] = at(l.at, R * 0.83);
        ctx.fillText(l.text, x, y);
      }
      if (o.caption) {
        ctx.font = `800 ${Math.round(R * 0.21)}px Arial, Helvetica, sans-serif`;
        ctx.fillText(o.caption, cx, cy + R * 0.9);
      }
    },
    192
  );
}

function hitCylinder(radius: number, height: number, y0 = -0.2): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), new THREE.MeshBasicMaterial({ visible: false }));
  m.position.y = y0 + height / 2;
  m.name = 'control_hit';
  return m;
}

function ringGlow(radius: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 8, 44), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
  m.rotation.x = Math.PI / 2;
  m.position.y = 0.12;
  m.raycast = () => {};
  return m;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ------------------------------------------------------------------ knob (continuous)
export interface KnobOpts {
  id: string;
  caption: string;
  min: number;
  max: number;
  step: number;
  value: number;
  radius?: number;
  accent?: number;
  ticks?: number;
  /** Labels at value fractions 0..1. */
  labels?: Array<{ at: number; text: string }>;
  format?: (v: number) => string;
  ink?: string;
  /** Sweep, degrees clockwise from 12 o'clock. */
  sweep?: [number, number];
  /** Skip the printed scale (the caller prints its own). */
  noPlate?: boolean;
  onChange?: (v: number) => void;
}

export class Knob implements Control3D {
  public readonly group = new THREE.Group();
  public readonly hit: THREE.Mesh;
  public readonly id: string;
  public onChange?: (v: number) => void;
  private dial = new THREE.Group();
  private glow: THREE.Mesh;
  private _value: number;
  private startValue = 0;
  private acc = 0;
  private last: [number, number] = [0, 0];
  private hover = false;
  private readonly sweep: [number, number];
  private readonly opts: KnobOpts;

  constructor(o: KnobOpts) {
    this.opts = o;
    this.id = o.id;
    this.onChange = o.onChange;
    this.sweep = o.sweep ?? [-135, 135];
    const r = o.radius ?? 1.25;
    const accent = o.accent ?? 0xe8edf0;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.4, metalness: 0.3 });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.26, 0.22, 40), new THREE.MeshStandardMaterial({ color: 0x0f1113, roughness: 0.6 }));
    skirt.position.y = 0.11;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 1.06, r * 0.95, 48), dark);
    body.position.y = 0.22 + (r * 0.95) / 2;
    body.castShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.86, 0.14, 40), new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.3, metalness: 0.5 }));
    cap.position.y = 0.22 + r * 0.95 + 0.06;
    const pointer = new THREE.Mesh(new THREE.BoxGeometry(r * 0.16, 0.06, r * 0.82), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, emissive: accent, emissiveIntensity: 0.25 }));
    pointer.position.set(0, cap.position.y + 0.1, -r * 0.4);
    this.dial.add(body, cap, pointer);
    this.group.add(skirt, this.dial);
    if (!o.noPlate) {
      const plate = scalePlate({ radius: r * 2.1, ticks: o.ticks ?? 11, labels: o.labels, caption: o.caption, sweep: this.sweep, ink: o.ink });
      plate.position.y = 0.025;
      this.group.add(plate);
    }
    this.glow = ringGlow(r * 1.42, 0x6fd2ff);
    this.group.add(this.glow);
    this.hit = hitCylinder(r * 1.5, r * 0.95 + 1.6);
    this.group.add(this.hit);
    this._value = this.quant(o.value);
    this.paint();
  }

  public get value(): number {
    return this._value;
  }

  /** Move the knob without notifying (state pushed from the lab). */
  public setValue(v: number): void {
    this._value = this.quant(v);
    this.paint();
  }

  public hint(): string {
    const fmt = this.opts.format ?? ((v: number) => String(v));
    return `${this.opts.caption}: ${fmt(this._value)} · drag up / down or scroll to turn (Shift = fine)`;
  }

  public press(): void {
    this.startValue = this._value;
    this.acc = 0;
    this.last = [0, 0];
  }

  public drag(dx: number, dy: number, fine: boolean): void {
    // incremental: holding Shift part-way only slows the movement that follows
    const span = this.opts.max - this.opts.min;
    this.acc += (((dx - this.last[0]) * 0.5 - (dy - this.last[1])) / (fine ? 900 : 220)) * span;
    this.last = [dx, dy];
    this.commit(this.startValue + this.acc);
  }

  public release(): void {}

  public wheel(dir: 1 | -1, fine: boolean): void {
    const step = this.opts.step * (fine ? 1 : Math.max(1, Math.round((this.opts.max - this.opts.min) / this.opts.step / 25)));
    this.commit(this._value + dir * step);
  }

  public setHover(on: boolean): void {
    this.hover = on;
    (this.glow.material as THREE.MeshBasicMaterial).opacity = on ? 0.85 : 0;
  }

  public update(): void {}

  private commit(v: number) {
    const q = this.quant(v);
    if (q === this._value) return;
    this._value = q;
    this.paint();
    this.onChange?.(q);
  }

  private quant(v: number): number {
    const { min, max, step } = this.opts;
    const snapped = Math.round((v - min) / step) * step + min;
    return Math.max(min, Math.min(max, Number(snapped.toFixed(6))));
  }

  private paint() {
    const f = clamp01((this._value - this.opts.min) / (this.opts.max - this.opts.min || 1));
    const a = this.sweep[0] + (this.sweep[1] - this.sweep[0]) * f;
    this.dial.rotation.y = -(a * Math.PI) / 180;
  }
}

// ------------------------------------------------------------------ selector (discrete: knob or lever)
export interface SelectorOpts {
  id: string;
  caption: string;
  labels: string[];
  value?: number;
  radius?: number;
  accent?: number;
  ink?: string;
  /** 'lever' = a gas-cock handle instead of a round knob. */
  style?: 'knob' | 'lever';
  /** Extra words for the hint ('turns the burner on'). */
  describe?: (index: number, label: string) => string;
  /** Skip the printed scale. */
  noPlate?: boolean;
  onChange?: (index: number, label: string) => void;
}

export class Selector implements Control3D {
  public readonly group = new THREE.Group();
  public readonly hit: THREE.Mesh;
  public readonly id: string;
  public onChange?: (index: number, label: string) => void;
  private dial = new THREE.Group();
  private glow: THREE.Mesh;
  private _index: number;
  private startIndex = 0;
  private readonly angles: number[];
  private readonly opts: SelectorOpts;

  constructor(o: SelectorOpts) {
    this.opts = o;
    this.id = o.id;
    this.onChange = o.onChange;
    const n = o.labels.length;
    const step = n <= 2 ? 80 : Math.min(60, 270 / (n - 1));
    const half = (step * (n - 1)) / 2;
    this.angles = o.labels.map((_, i) => -half + i * step);
    this._index = Math.max(0, Math.min(n - 1, o.value ?? 0));
    const r = o.radius ?? 1.1;
    const accent = o.accent ?? 0xe8edf0;
    if ((o.style ?? 'knob') === 'lever') {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, 0.9, 28), new THREE.MeshStandardMaterial({ color: 0xc9a459, metalness: 0.95, roughness: 0.3 }));
      hub.position.y = 0.45;
      const arm = new THREE.Mesh(roundedBox(r * 0.75, 0.55, r * 5.2, 0.25), new THREE.MeshStandardMaterial({ color: 0x1c1f23, roughness: 0.5 }));
      arm.position.set(0, 0.85, -r * 2.2);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.9, 20), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45 }));
      grip.position.set(0, 1.0, -r * 4.5);
      this.dial.add(hub, arm, grip);
      this.group.add(this.dial);
    } else {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 1.24, 0.2, 36), new THREE.MeshStandardMaterial({ color: 0x0f1113, roughness: 0.6 }));
      skirt.position.y = 0.1;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 1.04, r * 0.9, 40), new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.35, metalness: 0.45 }));
      body.position.y = 0.2 + (r * 0.9) / 2;
      body.castShadow = true;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.82, 0.12, 36), new THREE.MeshStandardMaterial({ color: 0x3a4047, roughness: 0.3, metalness: 0.55 }));
      cap.position.y = 0.2 + r * 0.9 + 0.05;
      const pointer = new THREE.Mesh(new THREE.BoxGeometry(r * 0.2, 0.07, r * 0.9), new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.3, roughness: 0.35 }));
      pointer.position.set(0, cap.position.y + 0.1, -r * 0.35);
      this.dial.add(body, cap, pointer);
      this.group.add(skirt, this.dial);
    }
    if (!o.noPlate) {
      const labels = o.labels.map((text, i) => ({ at: n === 1 ? 0.5 : i / (n - 1), text }));
      const plate = scalePlate({ radius: (o.style === 'lever' ? 3.2 : r * 2.2), ticks: 0, labels, caption: o.caption, sweep: [this.angles[0], this.angles[n - 1]], ink: o.ink });
      plate.position.y = 0.025;
      this.group.add(plate);
    }
    this.glow = ringGlow(o.style === 'lever' ? r * 1.7 : r * 1.4, 0x6fd2ff);
    this.group.add(this.glow);
    this.hit = hitCylinder(o.style === 'lever' ? r * 2.6 : r * 1.55, r * 0.9 + 1.7);
    this.group.add(this.hit);
    this.paint();
  }

  public get index(): number {
    return this._index;
  }

  public get label(): string {
    return this.opts.labels[this._index];
  }

  /** Select a stop without notifying. */
  public setIndex(i: number): void {
    this._index = Math.max(0, Math.min(this.opts.labels.length - 1, i));
    this.paint();
  }

  public hint(): string {
    const l = this.label;
    const extra = this.opts.describe?.(this._index, l);
    return `${this.opts.caption}: ${l}${extra ? ` (${extra})` : ''} · click to switch (Shift = back) · drag or scroll to step`;
  }

  public press(): void {
    this.startIndex = this._index;
  }

  public drag(dx: number, dy: number): void {
    const steps = Math.round((dx * 0.5 - dy) / 26);
    this.go(this.startIndex + steps, false);
  }

  public release(moved: boolean, _ms: number, shift: boolean): void {
    if (moved) return;
    const n = this.opts.labels.length;
    this.go((this._index + (shift ? -1 : 1) + n) % n, true);
  }

  public wheel(dir: 1 | -1): void {
    this.go(this._index + dir, false);
  }

  public setHover(on: boolean): void {
    (this.glow.material as THREE.MeshBasicMaterial).opacity = on ? 0.85 : 0;
  }

  public update(): void {}

  private go(i: number, wrapped: boolean) {
    const n = this.opts.labels.length;
    const t = wrapped ? i : Math.max(0, Math.min(n - 1, i));
    if (t === this._index) return;
    this._index = t;
    this.paint();
    this.onChange?.(t, this.opts.labels[t]);
  }

  private paint() {
    this.dial.rotation.y = -(this.angles[this._index] * Math.PI) / 180;
  }
}

// ------------------------------------------------------------------ push button
export interface ButtonOpts {
  id: string;
  /** Text printed on the cap (short) and the legend under it. */
  label: string;
  caption?: string;
  /** Round cap of this radius, or a rectangular cap w x d. */
  radius?: number;
  size?: [number, number];
  color?: number;
  ink?: string;
  /** Lamp colour; omit for a button without a lamp. */
  lamp?: number;
  hintText: string;
  onPress?: () => void;
}

export class PushButton implements Control3D {
  public readonly group = new THREE.Group();
  public readonly hit: THREE.Mesh;
  public readonly id: string;
  public onPress?: () => void;
  private cap: THREE.Mesh;
  private lampMat?: THREE.MeshBasicMaterial;
  private lampColor = 0;
  private pressT = 0;
  private down = false;
  private glow: THREE.Mesh;
  private readonly opts: ButtonOpts;
  public enabled = true;

  constructor(o: ButtonOpts) {
    this.opts = o;
    this.id = o.id;
    this.onPress = o.onPress;
    const color = o.color ?? 0x3a424a;
    const capMat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 });
    let w: number;
    let d: number;
    if (o.size) {
      [w, d] = o.size;
      this.cap = new THREE.Mesh(roundedBox(w, 0.5, d, Math.min(w, d) * 0.28), capMat);
    } else {
      const r = o.radius ?? 0.9;
      w = d = r * 2;
      this.cap = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, 0.5, 32), capMat);
      this.cap.position.y = 0.25;
    }
    this.cap.castShadow = true;
    const bezel = o.size
      ? new THREE.Mesh(roundedBox(w + 0.5, 0.18, d + 0.5, Math.min(w, d) * 0.3), new THREE.MeshStandardMaterial({ color: 0x0f1113, roughness: 0.6 }))
      : new THREE.Mesh(new THREE.CylinderGeometry(w / 2 + 0.28, w / 2 + 0.3, 0.18, 32), new THREE.MeshStandardMaterial({ color: 0x0f1113, roughness: 0.6 }));
    if (!o.size) bezel.position.y = 0.09;
    this.group.add(bezel, this.cap);
    // legend on the cap
    const top = o.size ? 0.5 : 0.5;
    const legend = textLegend(o.label, w * 0.9, Math.min(d * 0.7, 0.9), { ink: o.ink ?? '#f2f6f8' });
    legend.position.set(0, top + 0.012, 0);
    this.cap.add(legend);
    if (o.caption) {
      const cap = textLegend(o.caption, Math.max(w + 1.4, 3.6), 0.62, { ink: '#dfe6ea', weight: 800 });
      cap.position.set(0, 0.03, d / 2 + 0.75);
      this.group.add(cap);
    }
    if (o.lamp !== undefined) {
      this.lampColor = o.lamp;
      this.lampMat = new THREE.MeshBasicMaterial({ color: 0x1c1f22, toneMapped: false });
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 14), this.lampMat);
      lamp.position.set(w / 2 - 0.42, top + 0.04, -d / 2 + 0.4);
      lamp.raycast = () => {};
      this.cap.add(lamp);
    }
    this.glow = ringGlow(Math.max(w, d) / 2 + 0.55, 0x6fd2ff);
    this.group.add(this.glow);
    this.hit = o.size
      ? (() => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 2.4, d + 1.2), new THREE.MeshBasicMaterial({ visible: false }));
          m.position.y = 0.9;
          m.name = 'control_hit';
          return m;
        })()
      : hitCylinder(w / 2 + 0.6, 2.4);
    this.group.add(this.hit);
  }

  public setLit(on: boolean): void {
    this.lampMat?.color.setHex(on ? this.lampColor : 0x1c1f22);
  }

  public hint(): string {
    return this.opts.hintText;
  }

  public press(): void {
    if (!this.enabled) return;
    this.down = true;
    this.onPress?.();
  }

  public drag(): void {}

  public release(): void {
    this.down = false;
  }

  public wheel(): void {}

  public setHover(on: boolean): void {
    (this.glow.material as THREE.MeshBasicMaterial).opacity = on ? 0.85 : 0;
  }

  public update(dt: number): void {
    const target = this.down ? 1 : 0;
    this.pressT += (target - this.pressT) * Math.min(1, dt * 22);
    const base = this.opts.size ? 0 : 0.25;
    this.cap.position.y = base - 0.28 * this.pressT;
  }
}

// ------------------------------------------------------------------ rocker (latching)
export interface RockerOpts {
  id: string;
  caption: string;
  on?: boolean;
  lamp?: number;
  hintOn: string;
  hintOff: string;
  onChange?: (on: boolean) => void;
}

export class Rocker implements Control3D {
  public readonly group = new THREE.Group();
  public readonly hit: THREE.Mesh;
  public readonly id: string;
  public onChange?: (on: boolean) => void;
  private lever: THREE.Group;
  private lampMat: THREE.MeshBasicMaterial;
  private glow: THREE.Mesh;
  private _on: boolean;
  private tilt = 0;
  private readonly opts: RockerOpts;

  constructor(o: RockerOpts) {
    this.opts = o;
    this.id = o.id;
    this.onChange = o.onChange;
    this._on = !!o.on;
    const bezel = new THREE.Mesh(roundedBox(2.6, 0.3, 3.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x0f1113, roughness: 0.6 }));
    this.group.add(bezel);
    this.lever = new THREE.Group();
    this.lever.position.y = 0.62;
    const paddle = new THREE.Mesh(roundedBox(2.0, 0.8, 3.0, 0.45), new THREE.MeshStandardMaterial({ color: 0xc83a32, roughness: 0.4 }));
    paddle.position.y = -0.4;
    paddle.castShadow = true;
    this.lever.add(paddle);
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x24362a, toneMapped: false });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 14), this.lampMat);
    lamp.position.set(0, 0.46, -0.9);
    lamp.raycast = () => {};
    this.lever.add(lamp);
    this.group.add(this.lever);
    const marks = legendPlane(
      2.6,
      5.4,
      (ctx, w, h) => {
        ctx.fillStyle = '#dfe6ea';
        ctx.strokeStyle = '#dfe6ea';
        ctx.lineWidth = 5;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.round(h * 0.075)}px Arial, sans-serif`;
        ctx.fillText('I', w / 2, h * 0.17);
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.65, h * 0.028, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `800 ${Math.round(h * 0.07)}px Arial, sans-serif`;
        ctx.fillText(o.caption, w / 2, h * 0.9);
      },
      128
    );
    marks.position.y = 0.03;
    this.group.add(marks);
    this.glow = ringGlow(2.2, 0x6fd2ff);
    this.glow.scale.set(0.8, 1, 1.2);
    this.group.add(this.glow);
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 4.6), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 0.7;
    this.hit.name = 'control_hit';
    this.group.add(this.hit);
    this.paint(true);
  }

  public get on(): boolean {
    return this._on;
  }

  public setOn(on: boolean): void {
    this._on = on;
    this.paint(false);
  }

  public hint(): string {
    return this._on ? this.opts.hintOn : this.opts.hintOff;
  }

  public press(): void {}

  public drag(_dx: number, dy: number): void {
    if (dy < -12) this.set(true);
    else if (dy > 12) this.set(false);
  }

  public release(moved: boolean): void {
    if (!moved) this.set(!this._on);
  }

  public wheel(dir: 1 | -1): void {
    this.set(dir > 0);
  }

  public setHover(on: boolean): void {
    (this.glow.material as THREE.MeshBasicMaterial).opacity = on ? 0.85 : 0;
  }

  public update(dt: number): void {
    const target = this._on ? -0.32 : 0.32;
    this.tilt += (target - this.tilt) * Math.min(1, dt * 18);
    this.lever.rotation.x = this.tilt;
  }

  private set(on: boolean) {
    if (on === this._on) return;
    this._on = on;
    this.paint(false);
    this.onChange?.(on);
  }

  private paint(snap: boolean) {
    this.lampMat.color.setHex(this._on ? this.opts.lamp ?? 0x3dff7a : 0x24362a);
    if (snap) {
      this.tilt = this._on ? -0.32 : 0.32;
      this.lever.rotation.x = this.tilt;
    }
  }
}

// ------------------------------------------------------------------ on-instrument screen
export class ScreenPanel {
  public readonly mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private lastKey = '';
  /** Counts redraws, so a viewer (the lab PC) can tell when the content changed. */
  public version = 0;

  constructor(wCm: number, hCm: number, px = 56) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(wCm * px);
    this.canvas.height = Math.round(hCm * px);
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(wCm, hCm), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.raycast = () => {};
  }

  /** Redraw only when `key` changes. */
  public draw(key: string, fn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
    if (key === this.lastKey) return;
    this.lastKey = key;
    fn(this.ctx, this.canvas.width, this.canvas.height);
    this.tex.needsUpdate = true;
    this.version++;
  }

  /** The canvas the content is drawn on (another screen may show it, e.g. the lab PC). */
  public get source(): HTMLCanvasElement {
    return this.canvas;
  }
}

// ------------------------------------------------------------------ rig (owned by the scene)
export interface ControlRigHost {
  /** Element that gets the capture-phase wheel listener (the scene's container). */
  container: HTMLElement;
  /** OrbitControls: disabled while a control is being dragged. */
  orbit: { enabled: boolean };
  setHint: (text: string | null) => void;
  /** World-space ray under a pointer event; needed only by controls that implement `dragRay`. */
  rayFor?: (e: PointerEvent) => THREE.Ray;
}

interface ActivePress {
  c: Control3D;
  x0: number;
  y0: number;
  t0: number;
  moved: boolean;
}

export class ControlRig {
  private byId = new Map<string, Control3D>();
  private active: ActivePress | null = null;
  private hovered: Control3D | null = null;
  private hintShown: string | null = null;

  constructor(private host: ControlRigHost) {
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('blur', this.onCancel);
    host.container.addEventListener('wheel', this.onWheel, { capture: true, passive: false });
  }

  public register(list: Control3D[]): void {
    for (const c of list) {
      c.hit.userData.pick = { type: 'control', id: c.id };
      c.hit.raycast = THREE.Mesh.prototype.raycast; // instruments disable raycasting on their own meshes
      this.byId.set(c.id, c);
    }
  }

  public hitMeshes(): THREE.Object3D[] {
    return Array.from(this.byId.values(), (c) => c.hit);
  }

  public get(id: string): Control3D | undefined {
    return this.byId.get(id);
  }

  public get pressing(): boolean {
    return !!this.active;
  }

  public begin(c: Control3D, e: PointerEvent): void {
    this.active = { c, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false };
    this.host.orbit.enabled = false;
    c.press();
    c.setHover(true);
    this.setHint(c.hint());
  }

  public setHovered(id: string | null): void {
    const next = id ? this.byId.get(id) ?? null : null;
    if (next === this.hovered) return;
    this.hovered?.setHover(false);
    this.hovered = next;
    next?.setHover(true);
    if (!this.active) this.setHint(next ? next.hint() : null);
  }

  /** Re-assert the hover hint (other hint sources run after the hover pass). */
  public refreshHint(): void {
    const c = this.active?.c ?? this.hovered;
    if (!c) return;
    this.hintShown = c.hint();
    this.host.setHint(this.hintShown);
  }

  public update(dt: number): void {
    for (const c of this.byId.values()) c.update(dt);
  }

  public dispose(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('blur', this.onCancel);
    this.host.container.removeEventListener('wheel', this.onWheel, true);
  }

  private setHint(t: string | null) {
    if (t === this.hintShown) return;
    this.hintShown = t;
    this.host.setHint(t);
  }

  private onMove = (e: PointerEvent) => {
    const a = this.active;
    if (!a) return;
    const dx = e.clientX - a.x0;
    const dy = e.clientY - a.y0;
    if (!a.moved && Math.hypot(dx, dy) > 4) a.moved = true;
    if (a.moved) {
      a.c.drag(dx, dy, e.shiftKey);
      if (a.c.dragRay && this.host.rayFor) a.c.dragRay(this.host.rayFor(e));
      this.setHint(a.c.hint());
    }
  };

  private onUp = (e: PointerEvent) => {
    const a = this.active;
    if (!a || e.button !== 0) return;
    this.active = null;
    this.host.orbit.enabled = true;
    a.c.release(a.moved, performance.now() - a.t0, e.shiftKey);
    if (this.hovered !== a.c) a.c.setHover(false);
    this.setHint(this.hovered ? this.hovered.hint() : null);
  };

  private onCancel = () => {
    const a = this.active;
    if (!a) return;
    this.active = null;
    this.host.orbit.enabled = true;
    a.c.setHover(false);
    this.setHint(null);
  };

  private onWheel = (e: WheelEvent) => {
    const c = this.hovered;
    if (!c || this.active) return;
    e.preventDefault();
    e.stopPropagation();
    c.wheel(e.deltaY < 0 ? 1 : -1, e.shiftKey);
    this.setHint(c.hint());
  };
}
