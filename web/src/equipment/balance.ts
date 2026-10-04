import * as THREE from 'three';
import { VesselSnapshot } from '../types/sim';
import { GlasswareMeshBundle } from '../bench/glassware';
import { roundedBox } from './lcd';

/** Weighing capacity (gross, including the tare), g. Above this the display shows -OL-. */
export const BALANCE_CAPACITY_G = 600;
/** Display resolution, g. */
export const BALANCE_RESOLUTION_G = 0.01;
/** Pan radius, cm. */
export const BALANCE_PAN_RADIUS_CM = 6.5;

const PAN_LOCAL_CENTER = new THREE.Vector3(0, 6.85, -3);
const PAN_THICKNESS = 0.35;
const TAU_S = 0.8;
/** After the load has been steady this long the filter tightens (real balances lock on within a few seconds). */
const SETTLE_AFTER_S = 1.0;
const TAU_SETTLED_S = 0.25;
const KEY_TRAVEL_CM = 0.32;
const KEY_PRESS_S = 0.2;

export interface BalanceReadout {
  mass_g: number;
  formatted: string;
  tared: boolean;
}

/**
 * Top-loading precision balance (0.01 g, 600 g, first-order lag tau 0.8 s, tare). It weighs whatever has been put on
 * the pan via `setLoad(totalMassG)` (the bench places vessels on the pan; nothing is implicit). With an empty pan the
 * display reads 0.00 g. Taring stores an offset, so lifting a tared vessel off shows a negative number, like the real thing.
 */
export class Balance {
  public group = new THREE.Group();
  /** Clickable TARE key. `userData.pick = { type: 'balance-tare', id: 'balance' }`. */
  public tareKey: THREE.Mesh;

  private pan: THREE.Mesh;
  private screen: BalanceScreen;
  private loadG = 0;
  /** Lagged absolute pan reading, g (before subtracting the tare). */
  private shownRawG = 0;
  private tareOffsetG = 0;
  private tared = false;
  /** Number of times the display was zeroed (the instrument log watches this). */
  public tareCount = 0;
  private keyBaseY = 0;
  private keyPressT = 0;
  private lastMs = 0;
  /** Seconds since the load last changed. */
  private steadyS = 0;
  private raf = 0;

  constructor() {
    this.group.name = 'instrument_balance';
    const body = new THREE.Mesh(
      roundedBox(20, 6.5, 27, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xeceeec, roughness: 0.42, metalness: 0 })
    );
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // weighing pan
    const steel = new THREE.MeshStandardMaterial({ color: 0xe1e4e7, metalness: 1, roughness: 0.18 });
    this.pan = new THREE.Mesh(new THREE.CylinderGeometry(BALANCE_PAN_RADIUS_CM, BALANCE_PAN_RADIUS_CM - 0.1, PAN_THICKNESS, 48), steel);
    this.pan.position.copy(PAN_LOCAL_CENTER);
    this.pan.castShadow = true;
    this.pan.receiveShadow = true;
    this.group.add(this.pan);
    const support = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.4, 16), steel);
    support.position.set(0, 6.6, -3);
    this.group.add(support);

    // sloped console on the front: bezel, large LCD, big TARE key
    const bezel = new THREE.Mesh(roundedBox(17.6, 0.6, 5.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.5 }));
    bezel.position.set(0, 6.3, 10.2);
    bezel.rotation.x = 0.25;
    this.group.add(bezel);
    this.screen = new BalanceScreen(11.4, 3.4);
    this.screen.mesh.position.set(-2.9, 6.95, 10.1);
    this.screen.mesh.rotation.x = -Math.PI / 2 + 0.25;
    this.group.add(this.screen.mesh);

    const keyMat = new THREE.MeshStandardMaterial({ color: 0x3d4a55, roughness: 0.5 });
    this.tareKey = new THREE.Mesh(roundedBox(4.4, 0.6, 2.8, 0.55), keyMat);
    this.keyBaseY = 6.78;
    this.tareKey.position.set(5.8, this.keyBaseY, 10.35);
    this.tareKey.rotation.x = 0.25;
    this.tareKey.castShadow = true;
    this.tareKey.name = 'balance_tare_key';
    this.tareKey.userData.pick = { type: 'balance-tare', id: 'balance' };
    this.group.add(this.tareKey);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(3.7, 2.1),
      new THREE.MeshBasicMaterial({ map: keyLabelTexture('TARE'), transparent: true, toneMapped: false })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.62, 0);
    label.raycast = () => {};
    this.tareKey.add(label);

    // levelling feet
    const footMat = new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.8 });
    for (const [x, z] of [[-8.5, -11.5], [8.5, -11.5], [-8.5, 11.5], [8.5, 11.5]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.4, 12), footMat);
      f.position.set(x, -0.1, z);
      this.group.add(f);
    }

    // Nothing on the balance may block picking/dragging vessels except the TARE key.
    this.group.traverse((o) => {
      if (o !== this.tareKey) o.raycast = () => {};
    });

    this.render();
    this.startLoop();
  }

  // ------------------------------------------------------------------ load / tare
  /** Everything currently on the pan (glass + contents), grams. `null` = empty pan. */
  public setLoad(totalMassG: number | null) {
    this.advance();
    const next = totalMassG !== null && isFinite(totalMassG) ? Math.max(0, totalMassG) : 0;
    if (Math.abs(next - this.loadG) > 0.002) this.steadyS = 0;
    this.loadG = next;
  }

  /** Zero the display at the current load (T key, the TARE key, or the vessel panel). Animates the key. */
  public tare() {
    this.tareCount++;
    this.advance();
    this.tareOffsetG = this.loadG;
    this.steadyS = SETTLE_AFTER_S;
    this.shownRawG = this.loadG; // electronic zero: the display reads 0.00 immediately
    this.tared = Math.abs(this.loadG) > 1e-9;
    this.keyPressT = KEY_PRESS_S;
    this.render();
  }

  /** Clears the tare back to gross weighing (not exposed on a key; used by tests / reset). */
  public clearTare() {
    this.tareOffsetG = 0;
    this.tared = false;
    this.render();
  }

  /** The pan surface in world coordinates (the group is positioned/rotated by BenchScene). */
  public panWorld(): { center: THREE.Vector3; radius: number; topY: number } {
    this.group.updateWorldMatrix(true, false);
    const top = this.group.localToWorld(new THREE.Vector3(PAN_LOCAL_CENTER.x, PAN_LOCAL_CENTER.y + PAN_THICKNESS / 2, PAN_LOCAL_CENTER.z));
    const edge = this.group.localToWorld(new THREE.Vector3(PAN_LOCAL_CENTER.x + BALANCE_PAN_RADIUS_CM, PAN_LOCAL_CENTER.y, PAN_LOCAL_CENTER.z));
    const c = this.group.localToWorld(PAN_LOCAL_CENTER.clone());
    return { center: top.clone(), radius: edge.distanceTo(c), topY: top.y };
  }

  // ------------------------------------------------------------------ compatibility (legacy "selected vessel" API)
  /** Legacy no-op: the balance no longer follows the selected vessel. */
  public attachTo(_bundle: GlasswareMeshBundle | null) {
    /* intentionally empty */
  }

  /** Legacy hook (called from the snapshot loop): only advances the lag/animation clock. */
  public update(_snap: VesselSnapshot | null, _dt: number) {
    this.advance();
  }

  /** Optional per-frame hook; the balance also drives itself, so calling this is not required. */
  public tick() {
    this.advance();
  }

  public dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // ------------------------------------------------------------------ readout
  public readout(): BalanceReadout {
    this.advance();
    const m = this.netMass();
    return { mass_g: m.quant, formatted: m.over ? '-OL-' : `${m.quant.toFixed(2)} g`, tared: this.tared };
  }

  // ------------------------------------------------------------------ internals
  private netMass(): { quant: number; over: boolean } {
    const over = this.shownRawG > BALANCE_CAPACITY_G + 0.005;
    const net = this.shownRawG - this.tareOffsetG;
    // Round to the display resolution; avoid "-0.00".
    let q = Math.round(net / BALANCE_RESOLUTION_G) * BALANCE_RESOLUTION_G;
    if (Math.abs(q) < BALANCE_RESOLUTION_G / 2) q = 0;
    return { quant: q, over };
  }

  private startLoop() {
    if (typeof requestAnimationFrame !== 'function') return;
    const loop = () => {
      this.advance();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Wall-clock advance (the lag and key travel are mechanical, independent of simulation speed). Idempotent. */
  private advance() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = this.lastMs ? Math.min(0.25, Math.max(0, (now - this.lastMs) / 1000)) : 0;
    this.lastMs = now;
    if (dt > 0) {
      this.steadyS += dt;
      const a = 1 - Math.exp(-dt / (this.steadyS > SETTLE_AFTER_S ? TAU_SETTLED_S : TAU_S));
      this.shownRawG += (this.loadG - this.shownRawG) * a;
      if (Math.abs(this.loadG - this.shownRawG) < 5e-4) this.shownRawG = this.loadG;
    }
    if (this.keyPressT > 0) {
      this.keyPressT = Math.max(0, this.keyPressT - dt);
      const k = this.keyPressT / KEY_PRESS_S; // 1 -> 0
      const depth = Math.sin(Math.PI * (1 - k)); // down and back up
      this.tareKey.position.y = this.keyBaseY - KEY_TRAVEL_CM * depth;
    }
    this.render();
  }

  private render() {
    const m = this.netMass();
    this.screen.set({
      text: this.shownRawG > BALANCE_CAPACITY_G + 0.005 ? '-OL-' : m.quant.toFixed(2),
      net: this.tared,
    });
  }
}

// ---------------------------------------------------------------------------------------------- display
/** 11 x 3.4 cm LCD: big right-aligned digits, unit, stability marker and a NET (tared) annunciator. */
class BalanceScreen {
  public mesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private last = '';

  constructor(widthCm: number, heightCm: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = Math.round((640 * heightCm) / widthCm);
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthCm, heightCm), new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    this.mesh.raycast = () => {};
  }

  public set(s: { text: string; net: boolean }) {
    const key = `${s.text}|${s.net ? 1 : 0}`;
    if (key === this.last) return;
    this.last = key;
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#12261b');
    g.addColorStop(1, '#0a1510');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const fg = '#b4ffcb';
    // digits
    const size = Math.round(H * 0.7);
    ctx.font = `700 ${size}px "DSEG7 Classic", "Courier New", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const right = W * 0.8;
    ctx.fillStyle = 'rgba(180,255,203,0.07)';
    ctx.fillText('-888.88', right, H * 0.54);
    ctx.fillStyle = fg;
    ctx.fillText(s.text, right, H * 0.54);
    // unit
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(H * 0.36)}px Arial, sans-serif`;
    ctx.fillText('g', right + W * 0.035, H * 0.66);
    ctx.font = `700 ${Math.round(H * 0.2)}px Arial, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    // NET annunciator when a tare is active
    if (s.net) {
      ctx.textAlign = 'left';
      ctx.fillText('NET', W * 0.03, H * 0.28);
    }
    // glass glare
    const gl = ctx.createLinearGradient(0, 0, W, H);
    gl.addColorStop(0, 'rgba(255,255,255,0.16)');
    gl.addColorStop(0.4, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, H);
    this.texture.needsUpdate = true;
  }
}

function keyLabelTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 148;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#f2f6f8';
  ctx.font = '800 76px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
