import * as THREE from 'three';
import { Control3D, ScreenPanel } from '../bench/controls3d';
import { roundedBox } from './lcd';

/** An instrument whose software window the lab PC can show. */
interface Source {
  id: string;
  /** Taskbar label. */
  label: string;
  /** Window title (the instrument's control software). */
  title: string;
  panel: ScreenPanel;
  seen: number;
}

export const WORKSTATION_SCREEN_W = 32.6;
export const WORKSTATION_SCREEN_H = 18.3;
const PX_PER_CM = 40;
/** Taskbar geometry as fractions of the screen (shared by the painter and the click targets). */
const BAR_FRAC = 0.065;
const BTN_W_FRAC = 0.15;
const BTN_X0_FRAC = 0.015;
const BTN_GAP_FRAC = 0.01;

/** A taskbar button on the monitor: click it to bring that instrument's software window to the front. */
class TaskbarButton implements Control3D {
  public readonly group = new THREE.Group();
  public readonly hit: THREE.Mesh;
  private hovered = false;

  constructor(public readonly id: string, private label: string, private title: string, w: number, h: number, private choose: () => void) {
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    this.group.add(this.hit);
  }

  public hint(): string {
    return `${this.label}: show the ${this.title} window`;
  }
  public press(): void {
    this.choose();
  }
  public drag(): void {}
  public release(): void {}
  public wheel(): void {}
  public setHover(on: boolean): void {
    this.hovered = on;
  }
  public update(): void {
    void this.hovered;
  }
}

/**
 * The lab PC next to the analytical instruments (monitor, keyboard, mouse). Spectra and chromatograms are not shown on the
 * instruments themselves, as on the real machines (their fronts carry lamps and a small status display); they appear in the
 * instrument's control software on this monitor. The window of the instrument that changed last is in front, and the taskbar
 * has a button per instrument.
 */
export class Workstation {
  public readonly group = new THREE.Group();
  /** Taskbar buttons; the scene registers them with its control rig. */
  public readonly controls: Control3D[] = [];
  private screen: ScreenPanel;
  private sources: Source[] = [];
  private active = 0;
  private activeSeen = -1;

  constructor() {
    this.group.name = 'workstation';
    const plastic = new THREE.MeshStandardMaterial({ color: 0x1e2125, roughness: 0.45, metalness: 0.1 });
    const stand = new THREE.MeshStandardMaterial({ color: 0x2b2f34, roughness: 0.4, metalness: 0.5 });
    // monitor: 36 W x 21.8 H x 2.2 D bezel on a neck and a foot
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(36, 21.8, 2.2), plastic);
    bezel.position.set(0, 17.6, 0);
    bezel.castShadow = true;
    this.group.add(bezel);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 1.6), stand);
    neck.position.set(0, 5.2, -0.6);
    neck.castShadow = true;
    this.group.add(neck);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.8, 32), stand);
    foot.position.set(0, 0.4, 0.6);
    foot.castShadow = true;
    this.group.add(foot);
    this.screen = new ScreenPanel(WORKSTATION_SCREEN_W, WORKSTATION_SCREEN_H, PX_PER_CM);
    this.screen.mesh.position.set(0, 17.9, 1.12);
    this.group.add(this.screen.mesh);
    // keyboard and mouse on the bench in front of the monitor
    const kbd = new THREE.Mesh(roundedBox(14, 1.0, 4.6, 0.5), plastic);
    kbd.position.set(-2, 0, 13);
    kbd.castShadow = true;
    this.group.add(kbd);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.12, 3.2), new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.8 }));
    keys.position.set(-2, 1.0, 13);
    this.group.add(keys);
    const mouse = new THREE.Mesh(roundedBox(3.2, 1.3, 5, 1.4), plastic);
    mouse.position.set(10, 0, 13);
    this.group.add(mouse);
    this.paint();
  }

  /** Register an instrument screen (its software window). The first one is shown until another changes. */
  public addSource(id: string, label: string, title: string, panel: ScreenPanel): void {
    const index = this.sources.length;
    this.sources.push({ id, label, title, panel, seen: panel.version });
    // click target over the button the painter draws
    const bw = WORKSTATION_SCREEN_W * BTN_W_FRAC;
    const bh = WORKSTATION_SCREEN_H * BAR_FRAC * 0.76;
    const cx = (BTN_X0_FRAC + index * (BTN_W_FRAC + BTN_GAP_FRAC) + BTN_W_FRAC / 2 - 0.5) * WORKSTATION_SCREEN_W;
    const cy = 17.9 - (0.5 - BAR_FRAC / 2) * WORKSTATION_SCREEN_H;
    const btn = new TaskbarButton(`workstation.${id}`, label, title, bw, bh, () => this.show(index));
    btn.group.position.set(cx, cy, 1.5);
    this.group.add(btn.group);
    this.controls.push(btn);
    this.paint();
  }

  /** The window shown on the monitor (instrument id). */
  public get shown(): string | null {
    return this.sources[this.active]?.id ?? null;
  }

  /** Bring a window to the front (the taskbar buttons). */
  public show(index: number): void {
    if (index < 0 || index >= this.sources.length || index === this.active) return;
    this.active = index;
    this.sources[index].seen = this.sources[index].panel.version;
    this.paint();
  }

  public update(): void {
    let changed = -1;
    this.sources.forEach((s, i) => {
      if (s.panel.version !== s.seen) {
        s.seen = s.panel.version;
        changed = i;
      }
    });
    if (changed >= 0) this.active = changed;
    const cur = this.sources[this.active];
    if (!cur) return;
    if (changed >= 0 || cur.panel.version !== this.activeSeen) this.paint();
  }

  private paint(): void {
    const cur = this.sources[this.active];
    const key = `${this.active}|${cur ? cur.panel.version : 0}|${this.sources.length}`;
    this.screen.draw(key, (ctx, w, h) => {
      this.activeSeen = cur ? cur.panel.version : -1;
      // desktop
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#16324f');
      g.addColorStop(1, '#0d1f33');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const bar = Math.round(h * BAR_FRAC);
      if (cur) {
        // application window
        const mx = Math.round(w * 0.025);
        const my = Math.round(h * 0.03);
        const ww = w - 2 * mx;
        const wh = h - bar - my * 2;
        const title = Math.round(h * 0.055);
        ctx.fillStyle = '#e9edf1';
        ctx.fillRect(mx, my, ww, title);
        ctx.fillStyle = '#26303a';
        ctx.font = `600 ${Math.round(title * 0.58)}px Arial, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(cur.title, mx + title * 0.5, my + title / 2);
        ctx.textAlign = 'right';
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i === 2 ? '#d9534f' : '#9aa5b0';
          ctx.fillRect(mx + ww - title * (0.9 + i * 0.9), my + title * 0.25, title * 0.5, title * 0.5);
        }
        // window content: the instrument's own picture, scaled to fit
        const cx = mx;
        const cy = my + title;
        const cw = ww;
        const ch = wh - title;
        ctx.fillStyle = '#05090d';
        ctx.fillRect(cx, cy, cw, ch);
        const src = cur.panel.source;
        const k = Math.min(cw / src.width, ch / src.height);
        const dw = src.width * k;
        const dh = src.height * k;
        ctx.drawImage(src, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh);
      }
      // taskbar
      ctx.fillStyle = '#0a121b';
      ctx.fillRect(0, h - bar, w, bar);
      ctx.font = `600 ${Math.round(bar * 0.42)}px Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      this.sources.forEach((s, i) => {
        const bw = w * BTN_W_FRAC;
        const bx = w * BTN_X0_FRAC + i * (bw + w * BTN_GAP_FRAC);
        ctx.fillStyle = i === this.active ? '#2c4f78' : '#17232f';
        ctx.fillRect(bx, h - bar + bar * 0.12, bw, bar * 0.76);
        if (i === this.active) {
          ctx.fillStyle = '#62d2ff';
          ctx.fillRect(bx, h - bar * 0.12 - 3, bw, 3);
        }
        ctx.fillStyle = i === this.active ? '#eaf4ff' : '#8fa3b5';
        ctx.fillText(s.label, bx + bw / 2, h - bar / 2);
      });
    });
  }
}
