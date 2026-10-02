// Manual pipetting. A pipette is carried like any vessel (drag it with the mouse) but it works by suction, not by
// tilting: carry the tip over a vessel and it locks on and sinks into the liquid, then
//   drag UP   = draw liquid into the pipette (farther = faster)
//   drag DOWN = dispense (a volumetric pipette stops with a drop in the tip; a graduated one stops where you release;
//               a Pasteur pipette drips)
//   Shift     = fine control ("bleed" / thumb on top): ~10x slower, to set the meniscus exactly on the ring
// Volumetric pipettes stop drawing by themselves a little above the ring; bleed the extra off in the source vessel,
// then move to the target and release: it delivers its nominal volume (+- how well the meniscus was set).
// All chemistry goes through `PipetteLab.transfer` (real portions between real engine vessels, species conserved);
// this file does motion, visuals and the flow rules (`pipetting_math.ts`).
import * as THREE from 'three';
import type { VesselBundle } from './glassware';
import { DropFall, PourStream } from './animations';
import { outerRadiusAt } from '../render/glass_profiles';
import { bulbFor, PipetteBulb } from '../equipment/pipette_bulb';
import {
  PipetteKind,
  PipetteSpec,
  DEAD_PX,
  SPAN_PX,
  acceptsPipette,
  clamp,
  dispenseTipHeight,
  drawTipHeight,
  makePipetteSpec,
  markDeviationMl,
  onMark,
  pipetteKindOf,
  pipetteSignal,
  pipetteStep,
} from './pipetting_math';

export * from './pipetting_math';

/** Chemistry side of pipetting, implemented by the Lab. */
export interface PipetteLab {
  /** Engine volume of a vessel (mL). */
  volumeMl(id: string): number;
  /** Free room of a vessel (mL). */
  freeMl(id: string): number;
  /** Moves `ml` of liquid (species conserved, suspended solids stay behind); resolves once the engine has applied it. */
  transfer(srcId: string, dstId: string, ml: number): Promise<void>;
  name(id: string): string;
}

/** Text of the HUD readout while pipetting. */
export interface PipetteReadout {
  rate: string;
  total: string;
  to: string;
  flowing: boolean;
  blocked: boolean;
}

export interface PipetteHost {
  scene: THREE.Scene;
  vessels(): Map<string, VesselBundle>;
  lab: PipetteLab;
  notify(message: string, kind?: 'info' | 'warning'): void;
  setHint(text: string | null): void;
  setReadout(r: PipetteReadout | null): void;
  /** Top and bottom screen rows (px) of the bench canvas: the pointer travel available for the control signal. */
  viewportY(): [number, number];
}

/** The pose handles of the carried pipette that the session may write (the handling controller owns the rest). */
export interface PipetteHeld {
  id: string;
  pos: THREE.Vector3;
  swing: THREE.Vector2;
  tilt: number;
}

const FLUSH_MS = 100;

/**
 * Sends liquid moves to the engine one at a time, at most ~10 per second. Amounts accumulate while one is in flight;
 * `netOf(id)` is the volume change of a vessel that has been requested but has not reached the engine yet, so the
 * pipette rules always see the true amounts.
 */
export class ChunkPump {
  private queue: { src: string; dst: string; ml: number; open: boolean }[] = [];
  private busy = false;
  private last = -1e9;
  private timer: number | null = null;
  private net = new Map<string, number>();
  private waiters: (() => void)[] = [];
  public errors = 0;

  constructor(private send: (src: string, dst: string, ml: number) => Promise<void>) {}

  public netOf(id: string): number {
    return this.net.get(id) ?? 0;
  }

  public push(src: string, dst: string, ml: number) {
    if (!(ml > 0)) return;
    const q = this.queue[this.queue.length - 1];
    if (q && q.open && q.src === src && q.dst === dst) q.ml += ml;
    else this.queue.push({ src, dst, ml, open: true });
    this.bump(src, -ml);
    this.bump(dst, ml);
    this.pump();
  }

  /** Resolves once everything pushed so far has reached the engine. */
  public drained(): Promise<void> {
    if (!this.busy && this.queue.length === 0) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }

  private bump(id: string, d: number) {
    const v = (this.net.get(id) ?? 0) + d;
    if (Math.abs(v) < 1e-12) this.net.delete(id);
    else this.net.set(id, v);
  }

  private pump() {
    if (this.busy) return;
    if (this.queue.length === 0) {
      const w = this.waiters;
      this.waiters = [];
      for (const r of w) r();
      return;
    }
    const wait = FLUSH_MS - (performance.now() - this.last);
    if (wait > 0) {
      if (this.timer === null) {
        this.timer = window.setTimeout(() => {
          this.timer = null;
          this.pump();
        }, wait + 1);
      }
      return;
    }
    const item = this.queue.shift()!;
    item.open = false;
    this.busy = true;
    this.last = performance.now();
    this.send(item.src, item.dst, item.ml)
      .catch((err) => {
        this.errors++;
        console.warn('[pipette] transfer failed', err);
      })
      .finally(() => {
        this.bump(item.src, item.ml);
        this.bump(item.dst, -item.ml);
        this.busy = false;
        this.pump();
      });
  }
}

const warned = new Set<string>();
function warnOnce(key: string, e: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[pipetting] ${key}`, e);
}

const UP = new THREE.Vector3(0, 1, 0);

/** Height (cm above the tip) where the slim delivery stem ends and the bulb of a volumetric pipette starts (Infinity: none). */
export function stemLength(outer: THREE.Vector2[]): number {
  let rRef = 0;
  for (const p of outer) {
    if (p.y < 3.5) continue;
    if (rRef === 0) {
      rRef = p.x;
      continue;
    }
    if (p.x > rRef * 1.25) return p.y;
  }
  return Infinity;
}

function fmtMl(ml: number, kind: PipetteKind): string {
  const d = kind === 'volumetric' ? 3 : 2;
  return `${Math.max(0, ml).toFixed(d)} mL`;
}

/** What the handling controller needs back when a session ends: effects that keep running a moment (stream, drops). */
export interface PipetteFx {
  stream?: PourStream;
  drops?: DropFall;
  target: VesselBundle | null;
}

/** One carried pipette. Created when the pipette is grabbed, `end()`ed when it is released. */
export class PipetteSession {
  public readonly spec: PipetteSpec;
  public readonly bundle: VesselBundle;
  private readonly stemR: number;
  private readonly tipY: number; // tip height in group coordinates
  /** Length of the slim delivery stem below the bulb (cm): the tip cannot sink deeper than this below a vessel's rim. */
  private readonly stemLen: number;
  private readonly pump: ChunkPump;
  private bulb: PipetteBulb | null = null;
  private target: VesselBundle | null = null;
  private lockPtrY = 0;
  private spanUp = SPAN_PX;
  private spanDown = SPAN_PX;
  private inner = new THREE.Vector2();
  private mode: 'draw' | 'dispense' = 'draw';
  private tipTargetY = 0;
  private dropAcc = 0;
  private fine = false;
  private ended = false;
  private uiT = 1;
  private hint: string | null = null;
  private lastBlocked: string | null = null;
  private moved = { drawn: 0, delivered: 0 };
  private stream: PourStream | null = null;
  private drops: DropFall | null = null;
  private squeeze = 0;
  private rate = 0;
  private dtLast = 0.016;
  private tmpV = new THREE.Vector3();

  constructor(private host: PipetteHost, bundle: VesselBundle, private held: PipetteHeld) {
    this.bundle = bundle;
    const kind = pipetteKindOf(bundle.profile.kind);
    if (!kind) throw new Error('not a pipette');
    this.spec = makePipetteSpec(kind, bundle.profile.nominalMl, bundle.profile.neckRadius);
    // outer radius of the slim delivery stem (the bulb of a volumetric pipette is much wider)
    this.stemR = outerRadiusAt(bundle.profile, Math.min(4, bundle.profile.rimY * 0.3));
    this.tipY = bundle.tipLocal()?.y ?? 0;
    this.stemLen = stemLength(bundle.profile.outer);
    this.pump = new ChunkPump((s, d, ml) => host.lab.transfer(s, d, ml));
    this.tipTargetY = 0;
    if (kind !== 'pasteur') {
      try {
        this.bulb = bulbFor(bundle.group, bundle.profile.rimY + bundle.profile.baseOffsetY);
        this.bulb.visible = true;
      } catch (e) {
        warnOnce('bulb failed', e);
        this.bulb = null;
      }
    }
  }

  // ---------------------------------------------------------------- queries
  public get locked(): boolean {
    return this.target !== null;
  }

  public get targetId(): string | null {
    return this.target ? this.target.vesselState.id : null;
  }

  /** Screen row (px) where the tip went in: the pointer's travel from here is the control signal. */
  public get lockY(): number {
    return this.lockPtrY;
  }

  /** The text for the hint bar while the pipette is carried free. */
  public freeHint(): string {
    return this.spec.kind === 'pasteur'
      ? 'Carry the Pasteur pipette into a liquid · drag up to draw, down to drip · Esc puts it back'
      : 'Carry the pipette tip into a liquid · drag up to draw, down to release · Shift = fine · Esc puts it back';
  }

  private contentMl(): number {
    return this.host.lab.volumeMl(this.held.id) + this.pump.netOf(this.held.id);
  }

  private tipWorld(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.held.pos.x, this.held.pos.y + this.tipY, this.held.pos.z);
  }

  // ---------------------------------------------------------------- capture
  private captureR(t: VesselBundle): number {
    return t.profile.rimInnerRadius + 1.0;
  }

  /** Free carry: lock onto the vessel opening under the cursor (cx, cz). Returns true once locked. */
  public tryCapture(cx: number, cz: number, ptrY: number): boolean {
    if (this.target) return true;
    let best: VesselBundle | null = null;
    let bestK = Infinity;
    for (const [id, t] of this.host.vessels()) {
      if (id === this.held.id || t.isBurst() || t.vesselState.isSealed) continue;
      if (!acceptsPipette(t.profile.kind, t.profile.rimInnerRadius, this.stemR)) continue;
      const d = Math.hypot(t.group.position.x - cx, t.group.position.z - cz);
      const k = d / this.captureR(t);
      if (k < 1 && k < bestK) {
        best = t;
        bestK = k;
      }
    }
    if (!best) return false;
    this.target = best;
    this.lockPtrY = ptrY;
    // little room above / below the pointer (a lock near the screen edge): compress the travel for the full flow
    const [top, bottom] = this.host.viewportY();
    this.spanUp = clamp(ptrY - top - DEAD_PX - 6, 45, SPAN_PX);
    this.spanDown = clamp(bottom - ptrY - DEAD_PX - 6, 45, SPAN_PX);
    const tp = best.group.position;
    const room = Math.max(0, best.profile.rimInnerRadius - this.stemR - 0.1);
    const v = new THREE.Vector2(cx - tp.x, cz - tp.z);
    if (v.length() > room) v.setLength(room);
    this.inner.copy(v);
    this.mode = this.contentMl() > this.spec.residualMl + 1e-6 ? 'dispense' : 'draw';
    this.host.setReadout(null);
    return true;
  }

  // ---------------------------------------------------------------- locked update
  /**
   * Called every frame while locked. (vx, vz) is the virtual cursor in world space (horizontal pointer travel only),
   * `ptrY` the real pointer row. Returns false when the pipette should let go of the vessel (moved away / vessel gone).
   */
  public updateLocked(dt: number, time: number, vx: number, vz: number, ptrY: number, fine: boolean): boolean {
    const T = this.target;
    if (!T || !this.host.vessels().has(T.vesselState.id) || T.isBurst() || T.vesselState.isSealed) return false;
    this.dtLast = dt;
    this.fine = fine;
    const tp = T.group.position;
    const away = Math.hypot(vx - tp.x, vz - tp.z);
    if (away > this.captureR(T) + 2.0) return false;
    const lab = this.host.lab;
    const tid = T.vesselState.id;
    const pid = this.held.id;

    // horizontal: the tip follows the cursor inside the opening
    const room = Math.max(0, T.profile.rimInnerRadius - this.stemR - 0.1);
    const want = new THREE.Vector2(vx - tp.x, vz - tp.z);
    if (want.length() > room) want.setLength(room);
    const kxz = 1 - Math.exp(-dt * 12);
    this.inner.x += (want.x - this.inner.x) * kxz;
    this.inner.y += (want.y - this.inner.y) * kxz;

    // control signal from the pointer's travel since the tip went in
    const dy = this.lockPtrY - ptrY;
    const signal = pipetteSignal(dy, DEAD_PX, dy > 0 ? this.spanUp : this.spanDown);
    if (signal > 0) this.mode = 'draw';
    else if (signal < 0) this.mode = 'dispense';

    // vertical: dip below the surface to draw, hover just above it to dispense
    const bottom = T.profile.innerBottomY + T.profile.baseOffsetY;
    const surface = T.surfaceLocalY();
    const rim = T.profile.rimY + T.profile.baseOffsetY;
    const liquidMl = lab.volumeMl(tid) + this.pump.netOf(tid);
    const surfLocal = liquidMl > 0.02 ? surface : bottom;
    const tipLocalY = this.mode === 'draw' ? drawTipHeight(surfLocal, bottom) : dispenseTipHeight(surfLocal, bottom, rim);
    this.tipTargetY = tp.y + tipLocalY;
    const ky = 1 - Math.exp(-dt * 9);
    const curTip = this.held.pos.y + this.tipY;
    // never plunge below the vessel floor; the carry height above the rim is where the lock started
    const floorY = tp.y + Math.max(bottom + 0.05, rim + 0.6 - this.stemLen);
    const nextTip = curTip + (Math.max(this.tipTargetY, floorY) - curTip) * ky;
    this.held.pos.x += (tp.x + this.inner.x - this.held.pos.x) * (1 - Math.exp(-dt * 14));
    this.held.pos.z += (tp.z + this.inner.y - this.held.pos.z) * (1 - Math.exp(-dt * 14));
    this.held.pos.y = nextTip - this.tipY;
    this.held.tilt += (0 - this.held.tilt) * (1 - Math.exp(-dt * 10));
    this.held.swing.multiplyScalar(Math.exp(-dt * 12));

    const tipW = this.tipWorld(this.tmpV);
    const surfW = tp.y + surface;
    const insideOpening = Math.hypot(tipW.x - tp.x, tipW.z - tp.z) < T.profile.rimInnerRadius;
    const dipped = insideOpening && liquidMl > 0.02 && tipW.y < surfW - 0.12;
    // the tip has to be down in the vessel before anything happens (it is still descending right after the lock)
    const lowered = tipW.y < tp.y + rim + 0.4;

    const content = this.contentMl();
    const out = pipetteStep({
      spec: this.spec,
      contentMl: content,
      signal: lowered ? signal : 0,
      fine,
      dt,
      dipped,
      sourceMl: liquidMl,
      roomMl: lab.freeMl(tid) - this.pump.netOf(tid),
      dropAcc: this.dropAcc,
    });
    this.dropAcc = out.dropAcc;
    this.rate = out.rate;
    if (out.drawMl > 0) {
      this.pump.push(tid, pid, out.drawMl);
      this.moved.drawn += out.drawMl;
    }
    if (out.dispenseMl > 0) {
      this.pump.push(pid, tid, out.dispenseMl);
      this.moved.delivered += out.dispenseMl;
    }
    this.react(out.blocked, signal, content, T);
    this.visuals(dt, time, out.dispenseMl / Math.max(dt, 1e-4), out.drops, T, dipped, surfW);
    this.pushUi(dt, signal, out.blocked, content, T);
    return true;
  }

  private react(blocked: string | null, signal: number, content: number, T: VesselBundle) {
    const s = this.spec;
    let text: string;
    if (blocked === 'air') text = 'The tip is out of the liquid — lower it into the vessel first';
    else if (blocked === 'source-empty') text = `Nothing left to draw from ${T.vesselState.name}`;
    else if (blocked === 'full') {
      text =
        s.kind === 'volumetric'
          ? 'Full, a little above the ring · drag down slowly (hold Shift) to bring the meniscus onto the ring'
          : s.kind === 'graduated'
            ? 'Full to just above the 0 mark · drag down (Shift = fine) to set it on 0'
            : 'Pipette full';
    } else if (blocked === 'target-full') text = `${T.vesselState.name} is full`;
    else if (blocked === 'empty') {
      text =
        s.kind === 'volumetric'
          ? 'Delivered · a drop stays in the tip (calibrated to deliver, TD) · release to put it back'
          : 'Pipette empty · drag up to draw again · release to put it back';
    } else if (signal === 0 && content < 1e-4 && s.kind !== 'pasteur') text = 'Drag up to draw liquid in · Shift = fine control';
    else if (signal === 0 && content < 1e-4) text = 'Drag up to draw liquid in';
    else if (signal === 0) {
      if (s.kind === 'volumetric' && onMark(s, content)) text = 'Meniscus on the ring · carry to the target vessel and drag down to deliver';
      else if (s.kind === 'volumetric' && content > s.nominalMl) text = 'Above the ring · drag down slowly (hold Shift) to set the meniscus on it';
      else text = 'Drag down to dispense · drag up to draw more · Shift = fine';
    } else text = this.hint ?? '';
    if (blocked && blocked !== this.lastBlocked && (blocked === 'target-full' || blocked === 'air')) {
      this.host.notify(blocked === 'air' ? 'Lower the pipette tip into the liquid to draw.' : `${T.vesselState.name} is full.`, 'warning');
    }
    this.lastBlocked = blocked;
    if (text) {
      this.hint = text;
      this.host.setHint(text);
    }
  }

  private visuals(dt: number, time: number, flowMlS: number, drops: number, T: VesselBundle, dipped: boolean, surfW: number) {
    // the filler bulb: squeezed while releasing, relaxed (wide) while sucking
    const want = this.mode === 'dispense' ? (flowMlS > 0.005 || drops > 0 ? 1 : 0.3) : this.rate > 0 ? -0.8 : 0;
    this.squeeze += (want - this.squeeze) * Math.min(1, dt * 10);
    this.bulb?.setSqueeze(this.squeeze);
    this.bulb?.update(dt);
    try {
      const tip = this.tipWorld(new THREE.Vector3());
      const color = this.bundle.getLiquidColorHex();
      if (this.spec.kind === 'pasteur') {
        this.drops ??= new DropFall(this.host.scene, color);
        for (let i = 0; i < drops; i++) {
          if (!dipped) this.drops.drop(tip.clone().add(new THREE.Vector3(0, -0.15, 0)));
        }
        this.drops.update(dt, time, T);
      } else {
        this.stream ??= new PourStream(this.host.scene, color);
        const above = !dipped && tip.y > surfW + 0.15;
        const land = new THREE.Vector3(tip.x, Math.min(surfW, tip.y - 0.3), tip.z);
        this.stream.setColor(color);
        this.stream.update(dt, time, { flowMlS: above ? flowMlS : 0, lip: tip, land, target: T, mouthR: 0.3 });
      }
    } catch (e) {
      warnOnce('visuals failed', e);
      this.stream = null;
      this.drops = null;
    }
  }

  private pushUi(dt: number, signal: number, blocked: string | null, content: number, T: VesselBundle) {
    this.uiT += dt;
    if (this.uiT < 0.08) return;
    this.uiT = 0;
    const s = this.spec;
    let rate: string;
    if (blocked === 'air') rate = 'Tip out of the liquid';
    else if (blocked === 'source-empty') rate = 'Nothing left to draw';
    else if (blocked === 'full') rate = 'Pipette full';
    else if (blocked === 'target-full') rate = 'Target full';
    else if (blocked === 'empty') rate = 'Empty';
    else if (signal > 0 && this.rate > 0) rate = `Drawing ${this.rate.toFixed(this.rate < 1 ? 2 : 1)} mL/s${this.fine ? ' (fine)' : ''}`;
    else if (signal < 0 && this.rate > 0) rate = s.kind === 'pasteur' ? 'Dripping' : `Dispensing ${this.rate.toFixed(this.rate < 1 ? 2 : 1)} mL/s${this.fine ? ' (fine)' : ''}`;
    else rate = 'Drag up to draw · down to release';
    let total = `In pipette ${fmtMl(content, s.kind)}`;
    if (s.kind !== 'pasteur' && content > s.residualMl + 1e-6) {
      const dev = markDeviationMl(s, content);
      const word = s.kind === 'volumetric' ? 'ring' : '0 mark';
      if (onMark(s, content)) total += ` · on the ${word}`;
      else if (dev > 0) total += ` · ${dev.toFixed(3)} mL above the ${word}`;
      else total += ` · ${(-dev).toFixed(3)} mL below the ${word}`;
    }
    this.host.setReadout({
      rate,
      total,
      to: `${this.mode === 'draw' ? 'from' : 'into'} ${this.host.lab.name(T.vesselState.id)}`,
      flowing: this.rate > 0 && !blocked,
      blocked: !!blocked && blocked !== 'empty',
    });
  }

  // ---------------------------------------------------------------- lifecycle
  /** The pipette lets go of its vessel (moved away): back to free carry. */
  public unlock() {
    this.target = null;
    this.host.setReadout(null);
    this.hint = null;
    this.lastBlocked = null;
    this.bulb?.setSqueeze(0);
    this.mode = 'draw';
    this.host.setHint(this.freeHint());
  }

  /** Free-carry frame: keep the bulb animating and let a running stream / drops finish. */
  public tickFree(dt: number, time: number) {
    this.bulb?.setSqueeze(0);
    this.bulb?.update(dt);
    try {
      this.stream?.update(dt, time, { flowMlS: 0, lip: UP, land: UP, target: null });
      this.drops?.update(dt, time, null);
    } catch (e) {
      warnOnce('tickFree failed', e);
    }
  }

  /** Released: hides the bulb, flushes the engine moves and hands over effects that are still running. */
  public end(): PipetteFx {
    if (this.ended) return { target: null };
    this.ended = true;
    const T = this.target;
    this.target = null;
    this.host.setReadout(null);
    this.bulb?.setSqueeze(0);
    if (this.bulb) this.bulb.visible = false;
    const fx: PipetteFx = { stream: this.stream ?? undefined, drops: this.drops ?? undefined, target: T };
    this.stream = null;
    this.drops = null;
    return fx;
  }

  /** Resolves once every liquid move has reached the engine. */
  public drained(): Promise<void> {
    return this.pump.drained();
  }
}
