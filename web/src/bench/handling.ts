// Manual handling of bench objects: grab a shelf bottle or a vessel with the mouse, carry it over the bench, lock onto
// a receiving vessel, drag UP to tilt (the further the tilt, the faster it pours) and release to put it back.
// All chemistry goes through a `FlowSink` supplied by the host (Lab.openFlow); this file only does motion + visuals.
import * as THREE from 'three';
import type { VesselBundle } from './glassware';
import type { BottleAssembly } from '../equipment/bottle';
import { isLoosePieceForm, makePipette } from '../equipment/bottle';
import type { ReagentShelf } from './shelf';
import { Animator, DropFall, GasPlume, MetalPieces, PourStream, PowderStream, poseTask } from './animations';
import {
  DROP_MAX_S,
  LIQUID_MAX_ML_S,
  GAS_MAX_ML_S,
  GAS_MIN_ML_S,
  LIQUID_MIN_ML_S,
  METAL_MAX_PIECES_S,
  METAL_MIN_PIECES_S,
  METAL_PIECE_G,
  POWDER_MAX_G_S,
  POWDER_MIN_G_S,
  TILT_MAX,
  UNLOCK_DOWN_PX,
  angleDelta,
  bodyDrop,
  captureRadius,
  captureState,
  clamp,
  clampLen2,
  dropRate,
  flowRate,
  liquidMaxRate,
  onsetTilt,
  pointerScales,
  rayPlaneY,
  smoothstep,
  streamLanding,
  squeezeFromPointer,
  tiltFromPointer,
} from './handling_math';

import { PipetteSession, PipetteHost, PipetteLab, interactionMode, InteractionMode } from './pipetting';

export * from './handling_math';

// ------------------------------------------------------------------ contracts shared with the Lab / UI
/** Unit of the amounts pushed into a sink. */
export type FlowForm = 'ml' | 'g' | 'drops';

/** What is being poured: a shelf reagent (unlimited reservoir, id = shelf id) or the contents of a vessel. */
export type FlowSourceRef = { type: 'reagent'; id: string } | { type: 'vessel'; id: string };

/** Receives the amounts the user pours. Implemented by `Lab.openFlow` (batches to the engine at <= 10 Hz). */
export interface FlowSink {
  readonly unit: FlowForm;
  /** Offer `amount` (in `unit`); returns what was accepted (< amount when the target is full / the source is empty). */
  push(amount: number): number;
  /** Why the last push was cut short. */
  limit(): 'full' | 'empty' | null;
  /** Final flush; safe to call more than once. */
  end(): void;
  /** Total accepted so far. */
  readonly total: number;
}

export interface PourState {
  kind: 'liquid' | 'solid' | 'drops' | 'transfer';
  targetName: string;
  rate: number;
  total: number;
  unit: 'mL' | 'g' | 'drops';
  /** Material is actually leaving the container right now. */
  flowing: boolean;
  /** 'full' / 'empty' when the pour was cut short. */
  blocked: 'full' | 'empty' | null;
  /** Ready-made HUD texts (pipetting); when present they replace the pour wording. */
  readout?: { rate: string; total: string; to: string };
}

export type DropPlace = 'bench' | 'hotplate' | 'balance';
export interface DropSpot {
  place: DropPlace;
  pos: THREE.Vector3;
  /** Set by apparatus (titration station / funnel stand) that snapped the vessel: 'burette' | 'flask' | 'funnel-flask'. */
  tag?: string;
}

export interface HandlingHost {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  controls: { enabled: boolean };
  animator: Animator;
  shelf: ReagentShelf;
  vessels(): Map<string, VesselBundle>;
  /** Invisible pick proxies (userData.pick = {type,id}) of everything that can be grabbed. */
  pickables(): THREE.Object3D[];
  groundAt(x: number, z: number): number;
  /** Allowed range for the centre of a carried object. */
  bounds(bottle: boolean): { x0: number; x1: number; z0: number; z1: number };
  /** Take a vessel off its resting place; returns where it was. */
  liftVessel(id: string): { place: DropPlace; pos: THREE.Vector3 };
  /** Where a vessel released at (x, z) comes to rest (hot plate / balance pan / nearest free bench spot). */
  resolveDrop(id: string, x: number, z: number, prefer?: DropPlace): DropSpot;
  /** The vessel has settled at `spot`: claim slot / hot plate / balance pan. */
  commitDrop(id: string, spot: DropSpot): void;
  openFlow(src: FlowSourceRef, targetId: string, form: FlowForm): FlowSink | null;
  markDirty(): void;
  onSelectVessel(id: string): void;
  notify(message: string, kind?: 'info' | 'warning'): void;
  setHint(text: string | null): void;
  setPourState(s: PourState | null): void;
  /** Chemistry side of pipetting (null / absent: pipettes cannot move liquid). */
  pipetteLab?(): PipetteLab | null;
}

// ------------------------------------------------------------------ tuning
/** Default cursor plane height (objects follow the cursor's intersection with a horizontal plane at mid-height). */
export const PLANE_Y = 10;
/** Clearance (cm) of a carried vessel / bottle above whatever it is moving over. */
export const LIFT_VESSEL = 4;
export const LIFT_BOTTLE = 3.5;
/** Pointer travel (px) that turns a press into a grab (a plain click selects as before). */
export const DRAG_PX = 5;
const FOLLOW_XZ = 16; // 1/s, carry smoothing
const FOLLOW_Y = 12;
const TILT_UP = 9; // 1/s, tilt follows the pointer
const TILT_DOWN = 14;
const SWING_GAIN = 0.0045; // rad per (cm/s) of horizontal speed
const SWING_MAX = 0.16;
/** A vessel whose opening is higher than this (cm, burette on its stand) is captured by pointer position on screen, not on the bench plane. */
const TALL_RIM_Y = 35;
const TALL_CAPTURE_PX = 70;
const TALL_RELEASE_PX = 170;
const PROJ = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const IDENT = new THREE.Quaternion();

type PourKind = 'liquid' | 'powder' | 'metal' | 'drops' | 'gas';

interface Fx {
  stream?: PourStream;
  powder?: PowderStream;
  metal?: MetalPieces;
  drops?: DropFall;
  gas?: GasPlume;
  pipette?: THREE.Group;
  target: VesselBundle | null;
}

interface Lock {
  kind: PourKind;
  target: VesselBundle;
  /** Unit vector (x,z) from the target axis toward where the source came from. */
  dir: THREE.Vector2;
  yaw: number;
  ptrY: number;
  pre: number;
  fine: number;
  tiltPtr: number;
  sink: FlowSink;
  blocked: 'full' | 'empty' | null;
  fx: Fx;
  rate: number;
  uiT: number;
  acc: number;
  /** Lip offset from the target axis (x,z), inside the opening. */
  inner: THREE.Vector2;
  captureR: number;
  /** Target is a tall apparatus (burette): captured / released by screen position, lip stays over its opening. */
  tall?: boolean;
}

interface Held {
  kind: 'bottle' | 'vessel';
  /** How it works once carried: tilt-to-pour, suction (pipettes) or carry-only (gas syringe). Decided by `profile.kind`. */
  mode: InteractionMode;
  /** Pipette session while a pipette is carried. */
  pip?: PipetteSession;
  id: string;
  obj: THREE.Object3D;
  asm?: BottleAssembly;
  vb?: VesselBundle;
  home: { pos: THREE.Vector3; quat: THREE.Quaternion; place: DropPlace | 'shelf' };
  grabOff: THREE.Vector2;
  /** Height of the cursor plane: the middle of the object while carried. */
  planeY: number;
  pos: THREE.Vector3;
  yaw: number;
  tilt: number;
  vel: THREE.Vector2;
  swing: THREE.Vector2;
  lastXZ: THREE.Vector2;
  lipX: number;
  lipY: number;
  bodyR: number;
  mouthR: number;
  color: string;
  /** Refractive index of the liquid being carried (a vessel's top layer); the stream refracts like it. */
  ior?: number;
  homeYaw: number;
  lock: Lock | null;
  /** After pulling out of a target, don't re-lock onto it until the object has left its capture zone. */
  exitFrom: string | null;
}

const warned = new Set<string>();
function warnOnce(key: string, e: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[handling] ${key}`, e);
}

export class HandlingController {
  private held: Held | null = null;
  private pending: { hit: { type: 'vessel' | 'bottle'; id: string }; x: number; y: number } | null = null;
  private fading: Fx[] = [];
  private ptr = { x: 0, y: 0 };
  private ray = new THREE.Raycaster();
  private hintShown: string | null = null;
  private hovering = false;
  /** Shift held: fine control while pipetting. */
  private shift = false;
  private tmpV = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();

  constructor(private host: HandlingHost) {
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('keydown', this.onKey, true);
    window.addEventListener('keyup', this.onKeyUp, true);
  }

  public dispose() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    this.cancel();
    for (const f of this.fading) this.disposeFx(f);
    this.fading = [];
  }

  // ---------------------------------------------------------------- public queries
  public get holding(): boolean {
    return this.held !== null;
  }

  /** A press on a grabbable object that has not (yet) become a drag. */
  public get pressing(): boolean {
    return this.pending !== null;
  }

  public isHeld(id: string): boolean {
    return this.held?.id === id;
  }

  /** Id of the vessel being carried (null when nothing, or a shelf bottle, is held). */
  public heldVesselId(): string | null {
    return this.held && this.held.kind === 'vessel' ? this.held.id : null;
  }

  /** Vessels the HUD should label: the one being carried and the one being poured into. */
  public focusIds(): string[] {
    const h = this.held;
    if (!h) return [];
    const out: string[] = [];
    if (h.kind === 'vessel') out.push(h.id);
    if (h.lock) out.push(h.lock.target.vesselState.id);
    const pt = h.pip?.targetId;
    if (pt) out.push(pt);
    return out;
  }

  /** Called by the scene's hover logic when nothing is held. */
  public hoverHint(hit: { type: 'vessel' | 'bottle'; id: string } | null) {
    this.hovering = !!hit;
    if (this.held || this.pending) return;
    this.setHint(hit ? (hit.type === 'bottle' ? 'Drag to pick up · click to open its add card' : 'Drag to pick up and move · click to select') : null);
  }

  public cursor(): string | null {
    if (this.held) return 'grabbing';
    return null;
  }

  // ---------------------------------------------------------------- input
  /** Capture-phase pointerdown from the scene. Returns true when it armed a grab (OrbitControls must stay off). */
  public pointerDown(e: PointerEvent): boolean {
    if (e.button !== 0 || this.held || this.pending) return false;
    this.ptr.x = e.clientX;
    this.ptr.y = e.clientY;
    const hit = this.pickAt(e.clientX, e.clientY);
    if (!hit || !this.canGrab(hit)) return false;
    this.pending = { hit, x: e.clientX, y: e.clientY };
    this.host.controls.enabled = false;
    return true;
  }

  private onMove = (e: PointerEvent) => {
    this.shift = e.shiftKey;
    this.ptr.x = e.clientX;
    this.ptr.y = e.clientY;
    if (this.pending && !this.held && Math.hypot(e.clientX - this.pending.x, e.clientY - this.pending.y) > DRAG_PX) {
      const hit = this.pending.hit;
      this.pending = null;
      try {
        this.beginGrab(hit);
      } catch (err) {
        warnOnce('beginGrab failed', err);
        this.held = null;
        this.host.controls.enabled = true;
      }
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.pending = null;
    if (this.held) this.release(false);
    this.host.controls.enabled = true;
  };

  private onCancel = () => {
    this.pending = null;
    if (this.held) this.release(true);
    this.host.controls.enabled = true;
  };

  private onBlur = () => this.cancel();

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.shift = false;
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Shift') this.shift = true;
    if (!this.held) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      this.cancel();
    }
  };

  /** Put whatever is held back where it came from (Esc / window blur). */
  public cancel() {
    this.pending = null;
    if (this.held) this.release(true);
    this.host.controls.enabled = true;
  }

  /** A vessel was deleted while held. */
  public onVesselRemoved(id: string) {
    const h = this.held;
    if (!h) return;
    if (h.kind === 'vessel' && h.id === id) {
      if (h.lock) this.endLock(h);
      h.lock = null;
      this.endPipette(h);
      this.held = null;
      this.setHint(null);
      this.host.setPourState(null);
      this.host.controls.enabled = true;
    }
  }

  private canGrab(hit: { type: 'vessel' | 'bottle'; id: string }): boolean {
    if (hit.type === 'bottle') {
      const a = this.host.shelf.get(hit.id);
      return !!a && !this.host.animator.isBusy(a.group);
    }
    const v = this.host.vessels().get(hit.id);
    return !!v && !v.isBurst() && !this.host.animator.isBusy(v.group);
  }

  private pickAt(cx: number, cy: number): { type: 'vessel' | 'bottle'; id: string } | null {
    const rect = this.host.dom.getBoundingClientRect();
    const x = ((cx - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = -((cy - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.ray.setFromCamera(new THREE.Vector2(x, y), this.host.camera);
    const objs = this.host.pickables();
    for (const o of objs) o.updateWorldMatrix(true, false);
    for (const h of this.ray.intersectObjects(objs, false)) {
      const p = h.object.userData.pick as { type: 'vessel' | 'bottle'; id: string } | undefined;
      if (p) return p;
    }
    return null;
  }

  private cursorPlane(px: number, py: number, out: THREE.Vector3, planeY = PLANE_Y): THREE.Vector3 | null {
    const rect = this.host.dom.getBoundingClientRect();
    const x = ((px - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = -((py - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.ray.setFromCamera(new THREE.Vector2(x, y), this.host.camera);
    return rayPlaneY(this.ray.ray.origin, this.ray.ray.direction, planeY, out);
  }

  // ---------------------------------------------------------------- grab
  private beginGrab(hit: { type: 'vessel' | 'bottle'; id: string }) {
    const host = this.host;
    let h: Held;
    if (hit.type === 'bottle') {
      const asm = host.shelf.get(hit.id);
      if (!asm) return;
      host.shelf.setBusy(hit.id, true);
      host.shelf.touch(hit.id);
      h = {
        kind: 'bottle',
        mode: 'pour',
        id: hit.id,
        obj: asm.group,
        asm,
        home: { pos: asm.group.position.clone(), quat: asm.group.quaternion.clone(), place: 'shelf' },
        grabOff: new THREE.Vector2(),
        planeY: LIFT_BOTTLE + asm.height * 0.5,
        pos: asm.group.position.clone(),
        yaw: asm.group.rotation.y,
        tilt: 0,
        vel: new THREE.Vector2(),
        swing: new THREE.Vector2(),
        lastXZ: new THREE.Vector2(asm.group.position.x, asm.group.position.z),
        lipX: asm.lipLocal.x,
        lipY: asm.lipLocal.y,
        bodyR: asm.radius,
        mouthR: Math.max(0.4, asm.lipLocal.x - 0.1),
        color: asm.contentHex,
        homeYaw: asm.group.rotation.y,
        lock: null,
        exitFrom: null,
      };
    } else {
      const vb = host.vessels().get(hit.id);
      if (!vb) return;
      const home = host.liftVessel(hit.id);
      const lip = vb.lipLocal();
      h = {
        kind: 'vessel',
        mode: interactionMode(vb.profile.kind),
        id: hit.id,
        obj: vb.group,
        vb,
        home: { pos: home.pos.clone(), quat: new THREE.Quaternion(), place: home.place },
        grabOff: new THREE.Vector2(),
        planeY: vb.group.position.y + LIFT_VESSEL + Math.min(vb.height * 0.5, 14), // a 90 cm burette is steered at bench level, not at its middle
        pos: vb.group.position.clone(),
        yaw: 0,
        tilt: 0,
        vel: new THREE.Vector2(),
        swing: new THREE.Vector2(),
        lastXZ: new THREE.Vector2(vb.group.position.x, vb.group.position.z),
        lipX: lip.x,
        lipY: lip.y,
        bodyR: vb.profile.maxOuterRadius,
        mouthR: vb.profile.rimInnerRadius,
        color: vb.getLiquidColorHex(),
        ior: vb.lastSnapshot?.layers?.length ? vb.lastSnapshot.layers[vb.lastSnapshot.layers.length - 1].refractive_index : undefined,
        homeYaw: 0,
        lock: null,
        exitFrom: null,
      };
      host.onSelectVessel(hit.id);
      if (vb.profile.rack) vb.setRackVisible(false); // the tube leaves its rack
    }
    const pp = this.cursorPlane(this.ptr.x, this.ptr.y, this.tmpV, h.planeY);
    if (pp) h.grabOff.set(h.pos.x - pp.x, h.pos.z - pp.z);
    this.held = h;
    host.dom.style.cursor = 'grabbing';
    this.setHint(h.kind === 'bottle' ? 'Carry it over a vessel, then drag up to tilt · Esc to put back' : 'Carry it · release to set it down · Esc to put back');
    if (h.mode === 'pipette') {
      this.beginPipette(h);
      if (h.pip) this.setHint(h.pip.freeHint());
    }
    host.markDirty();
  }

  // ---------------------------------------------------------------- per-frame
  public update(dt: number, time: number) {
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const f = this.fading[i];
      try {
        this.tickFx(f, dt, time, 0);
      } catch (e) {
        warnOnce('fading fx failed', e);
        f.stream = f.powder = f.metal = f.drops = f.gas = undefined;
      }
      if (!this.fxAlive(f)) {
        this.disposeFx(f);
        this.fading.splice(i, 1);
      }
    }
    const h = this.held;
    if (!h) return;
    try {
      this.updateHeld(h, Math.min(0.05, dt), time);
    } catch (e) {
      warnOnce('updateHeld failed', e);
    }
    this.host.markDirty();
  }

  private updateHeld(h: Held, dt: number, time: number) {
    const host = this.host;
    const b = host.bounds(h.kind === 'bottle');
    // the grab offset melts away so the object ends up right under the cursor (a shelf bottle starts far from it)
    h.grabOff.multiplyScalar(Math.exp(-dt * (h.kind === 'bottle' ? 3 : 1.2)));
    const cur = this.cursorPlane(this.ptr.x, this.ptr.y, this.tmpV, h.planeY);
    const cx = cur ? clamp(cur.x + h.grabOff.x, b.x0, b.x1) : h.pos.x;
    const cz = cur ? clamp(cur.z + h.grabOff.y, b.z0, b.z1) : h.pos.z;

    if (h.mode === 'pipette' && h.pip) {
      this.updatePipette(h, dt, time, cx, cz);
      this.applyObject(h);
      return;
    }

    // lock lifecycle
    if (h.lock) {
      const L = h.lock;
      if (!host.vessels().has(L.target.vesselState.id) || L.target.isBurst()) this.unlock(h, false);
    }
    if (!h.lock) {
      this.checkExit(h, cx, cz);
      if (!h.exitFrom) this.tryLock(h, cx, cz);
    }
    if (h.lock) this.updateLocked(h, dt, time, cx, cz);
    else this.updateFree(h, dt, cx, cz);
    this.applyObject(h);
  }

  // ---- free carry
  private carryY(h: Held, x: number, z: number): number {
    const g = this.host.groundAt(x, z);
    let y = h.kind === 'vessel' ? g + LIFT_VESSEL : g + LIFT_BOTTLE;
    if (h.kind === 'bottle') {
      // lift off the shelf smoothly instead of snapping to bench height
      const away = Math.hypot(x - h.home.pos.x, z - h.home.pos.z);
      y = h.home.pos.y + 1.2 + (y - (h.home.pos.y + 1.2)) * smoothstep(away / 16);
    }
    for (const o of this.host.vessels().values()) {
      if (o.group === h.obj) continue;
      const d = Math.hypot(o.group.position.x - x, o.group.position.z - z);
      // glass hung high on a ring stand (burette, separatory funnel) is passed underneath, not climbed over
      const top = o.profile.support === 'stand' && o.profile.baseOffsetY > 5 ? 1.2 : o.height;
      if (d < o.footprint + h.bodyR + 1.2) y = Math.max(y, o.group.position.y + top + 1.5);
    }
    return y;
  }

  private updateFree(h: Held, dt: number, cx: number, cz: number) {
    const ky = 1 - Math.exp(-dt * FOLLOW_Y);
    const kxz = 1 - Math.exp(-dt * FOLLOW_XZ);
    h.pos.x += (cx - h.pos.x) * kxz;
    h.pos.z += (cz - h.pos.z) * kxz;
    h.pos.y += (this.carryY(h, h.pos.x, h.pos.z) - h.pos.y) * ky;
    h.tilt += (0 - h.tilt) * (1 - Math.exp(-dt * TILT_DOWN));
    h.yaw += angleDelta(h.yaw, h.homeYaw) * (1 - Math.exp(-dt * 6));
    this.updateSwing(h, dt);
  }

  private updateSwing(h: Held, dt: number) {
    const vx = (h.pos.x - h.lastXZ.x) / Math.max(1e-3, dt);
    const vz = (h.pos.z - h.lastXZ.y) / Math.max(1e-3, dt);
    h.lastXZ.set(h.pos.x, h.pos.z);
    h.vel.x += (vx - h.vel.x) * Math.min(1, dt * 10);
    h.vel.y += (vz - h.vel.y) * Math.min(1, dt * 10);
    const tx = clamp(h.vel.x * SWING_GAIN, -SWING_MAX, SWING_MAX); // roll about z
    const tz = clamp(-h.vel.y * SWING_GAIN, -SWING_MAX, SWING_MAX); // pitch about x
    const k = Math.min(1, dt * 8);
    h.swing.x += (tx - h.swing.x) * k;
    h.swing.y += (tz - h.swing.y) * k;
  }

  /** Write the held pose (position + rotation) to the object. */
  private applyObject(h: Held) {
    const q = this.tmpQ;
    const qt = this.tmpQ2;
    q.setFromAxisAngle(UP, h.yaw);
    qt.setFromAxisAngle(AXIS_Z, -h.tilt);
    q.multiply(qt);
    if (!h.lock) {
      qt.setFromEuler(new THREE.Euler(h.swing.y, 0, h.swing.x));
      q.premultiply(qt);
    }
    h.obj.quaternion.copy(q);
    h.obj.position.copy(h.pos);
  }

  // ---- locking
  private pourKind(h: Held): PourKind | null {
    if (h.kind === 'vessel') {
      if (h.mode !== 'pour') return null; // pipettes work by suction, a gas syringe holds gas
      const v = h.vb!;
      const ml = v.lastSnapshot?.total_liquid_ml ?? v.vesselState.currentVolumeMl ?? 0;
      return ml > 0.05 ? 'liquid' : null;
    }
    const a = h.asm!;
    if (a.kind === 'dropper') return 'drops';
    if (a.kind === 'jar') {
      const m = this.host.shelf.getMeta(h.id);
      return m && isLoosePieceForm(m.solid_form) && (m.form === 'solid' || !!m.by_mass) ? 'metal' : 'powder';
    }
    // a gas reagent (cylinder / lecture bottle) is released as a plume, not poured as a liquid
    if (this.host.shelf.getMeta(h.id)?.form === 'gas') return 'gas';
    return 'liquid';
  }

  /** The opening of this vessel is far above the bench (burette): the cursor plane cannot aim at it. */
  private isTall(t: VesselBundle): boolean {
    return t.group.position.y + t.profile.rimY + t.profile.baseOffsetY > TALL_RIM_Y;
  }

  /** Pointer offset (px, screen) from the projected opening of a tall vessel; null when it is behind the camera. */
  private tallRimOffset(t: VesselBundle): { dx: number; dy: number } | null {
    const p = t.group.position;
    PROJ.set(p.x, p.y + t.profile.rimY + t.profile.baseOffsetY, p.z).project(this.host.camera);
    if (PROJ.z < -1 || PROJ.z > 1) return null;
    const rect = this.host.dom.getBoundingClientRect();
    return {
      dx: this.ptr.x - (rect.left + (PROJ.x * 0.5 + 0.5) * rect.width),
      dy: this.ptr.y - (rect.top + (-PROJ.y * 0.5 + 0.5) * rect.height),
    };
  }

  private checkExit(h: Held, cx: number, cz: number) {
    if (!h.exitFrom) return;
    const t = this.host.vessels().get(h.exitFrom);
    if (!t) {
      h.exitFrom = null;
      return;
    }
    if (this.isTall(t)) {
      const o = this.tallRimOffset(t);
      if (!o || Math.hypot(o.dx, o.dy) > TALL_RELEASE_PX) h.exitFrom = null;
      return;
    }
    const d = Math.hypot(t.group.position.x - cx, t.group.position.z - cz);
    if (d > captureRadius(t.profile.rimOuterRadius, h.lipX, h.bodyR) + 1) h.exitFrom = null;
  }

  private tryLock(h: Held, cx: number, cz: number) {
    const kind = this.pourKind(h);
    if (!kind) return;
    if (h.kind === 'vessel' && h.vb!.vesselState.isSealed) return;
    let best: VesselBundle | null = null;
    let bestD = Infinity;
    let tall: VesselBundle | null = null;
    let tallD = TALL_CAPTURE_PX;
    for (const t of this.host.vessels().values()) {
      if (t.group === h.obj || t.isBurst()) continue;
      if (interactionMode(t.profile.kind) !== 'pour') continue; // pipettes and gas syringes are filled by suction / gas, not poured into
      if (this.isTall(t)) {
        const o = this.tallRimOffset(t);
        const px = o ? Math.hypot(o.dx, o.dy) : Infinity;
        if (px < tallD) {
          tall = t;
          tallD = px;
        }
        continue;
      }
      const d = Math.hypot(t.group.position.x - cx, t.group.position.z - cz);
      const r = captureRadius(t.profile.rimOuterRadius, h.lipX, h.bodyR);
      if (captureState(d, r, false) && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    if (!best && tall) {
      this.lock(h, tall, kind, true);
      return;
    }
    if (!best) return;
    this.lock(h, best, kind);
  }

  private lock(h: Held, t: VesselBundle, kind: PourKind, tall = false) {
    const form: FlowForm = kind === 'liquid' || kind === 'gas' ? 'ml' : kind === 'drops' ? 'drops' : 'g';
    const src: FlowSourceRef = h.kind === 'vessel' ? { type: 'vessel', id: h.id } : { type: 'reagent', id: h.id };
    const sink = this.host.openFlow(src, t.vesselState.id, form);
    if (!sink) {
      h.exitFrom = t.vesselState.id; // can't pour this (unknown reagent); don't retry every frame
      this.host.notify("That can't be poured right now.", 'warning');
      return;
    }
    const tp = t.group.position;
    const dir = tall ? new THREE.Vector2(this.host.camera.position.x - tp.x, this.host.camera.position.z - tp.z) : new THREE.Vector2(h.pos.x - tp.x, h.pos.z - tp.z);
    if (dir.lengthSq() < 1e-3) dir.set(0, -1);
    dir.normalize();
    const yaw = Math.atan2(dir.y, -dir.x);
    const ptrY = this.ptr.y;
    const rect = this.host.dom.getBoundingClientRect();
    const fx: Fx = { target: t };
    try {
      if (kind === 'liquid') fx.stream = new PourStream(this.host.scene, h.color, h.ior);
      else if (kind === 'gas') fx.gas = new GasPlume(this.host.scene, h.color);
      else if (kind === 'powder') fx.powder = new PowderStream(this.host.scene, h.color);
      else if (kind === 'metal') fx.metal = new MetalPieces(this.host.scene, h.color);
      else {
        fx.drops = new DropFall(this.host.scene, h.color);
        const pip = makePipette();
        pip.traverse((o) => (o.raycast = () => {}));
        h.obj.updateWorldMatrix(true, false);
        pip.position.set(0, h.lipY, 0).applyMatrix4(h.obj.matrixWorld); // starts at the bottle's neck
        this.host.scene.add(pip);
        fx.pipette = pip;
      }
    } catch (e) {
      // a visual effect failed to build: never leave a half-open flow behind
      warnOnce('effects failed', e);
      this.disposeFx(fx);
      sink.end();
      h.exitFrom = t.vesselState.id;
      return;
    }
    if (h.asm) {
      h.asm.cap.visible = false; // unscrew / lift the pipette out
    }
    h.lock = {
      kind,
      target: t,
      dir,
      yaw,
      ptrY,
      ...pointerScales(ptrY - rect.top, rect.height),
      tiltPtr: 0,
      sink,
      blocked: null,
      fx,
      rate: 0,
      uiT: 1,
      acc: 0,
      inner: new THREE.Vector2(dir.x * t.profile.rimInnerRadius * 0.8, dir.y * t.profile.rimInnerRadius * 0.8),
      captureR: captureRadius(t.profile.rimOuterRadius, h.lipX, h.bodyR),
      tall,
    };
    this.setHint('Drag up to tilt · release to stop pouring');
  }

  private unlock(h: Held, pulledDown: boolean) {
    const L = h.lock;
    if (!L) return;
    if (pulledDown) h.exitFrom = L.target.vesselState.id;
    this.endLock(h);
    h.lock = null;
    this.host.setPourState(null);
    this.setHint(h.kind === 'bottle' ? 'Carry it over a vessel, then drag up to tilt · Esc to put back' : 'Carry it · release to set it down · Esc to put back');
  }

  /** Close the sink, hand the visual effects to the fading list and restore caps / pipettes. */
  private endLock(h: Held) {
    const L = h.lock;
    if (!L) return;
    try {
      L.sink.end();
    } catch (e) {
      warnOnce('sink.end failed', e);
    }
    if (L.fx.pipette) {
      this.host.scene.remove(L.fx.pipette);
      L.fx.pipette = undefined;
    }
    if (h.asm) h.asm.cap.visible = true;
    this.fading.push(L.fx);
  }

  // ---- locked (pouring) pose + flow
  private updateLocked(h: Held, dt: number, time: number, cx: number, cz: number) {
    const L = h.lock!;
    const T = L.target;
    const tp = T.group.position;
    const kind = L.kind;
    const isDrops = kind === 'drops';

    // virtual cursor: horizontal pointer movement nudges / unlocks, vertical movement only tilts
    const vp = this.cursorPlane(this.ptr.x, L.ptrY, this.tmpV, h.planeY);
    const b = this.host.bounds(h.kind === 'bottle');
    const vx = vp ? clamp(vp.x + h.grabOff.x, b.x0, b.x1) : cx;
    const vz = vp ? clamp(vp.z + h.grabOff.y, b.z0, b.z1) : cz;
    const wx = vx - tp.x;
    const wz = vz - tp.z;
    const wLen = Math.hypot(wx, wz);
    // tall target (burette): released by sideways pointer travel on screen (moving UP only tilts the bottle)
    const rimOff = L.tall ? this.tallRimOffset(T) : null;
    const outside = L.tall ? !rimOff || Math.abs(rimOff.dx) > TALL_RELEASE_PX : !captureState(wLen, L.captureR, true);
    if (outside || this.ptr.y > L.ptrY + UNLOCK_DOWN_PX) {
      this.unlock(h, this.ptr.y > L.ptrY + UNLOCK_DOWN_PX || (!!L.tall && outside));
      return;
    }
    // lip position within the opening: the carried centre sits `lipX` farther from the axis than the lip
    const openMax = Math.max(0.3, T.profile.rimInnerRadius * 0.85);
    const lipLen = Math.max(0, wLen - h.lipX);
    const [ix, iz] = L.tall
      ? [L.dir.x * Math.min(0.35, openMax), L.dir.y * Math.min(0.35, openMax)]
      : clampLen2((wx / Math.max(1e-6, wLen)) * lipLen, (wz / Math.max(1e-6, wLen)) * lipLen, 0.25, openMax, [L.dir.x, L.dir.y]);
    L.inner.x += (ix - L.inner.x) * Math.min(1, dt * 10);
    L.inner.y += (iz - L.inner.y) * Math.min(1, dt * 10);

    // tilt from the pointer
    const maxTilt = isDrops ? 1.3 : TILT_MAX;
    const onset = isDrops ? 0.12 : this.onsetFor(h);
    L.tiltPtr = isDrops ? squeezeFromPointer(L.ptrY, this.ptr.y, L.fine, maxTilt) : Math.min(maxTilt, tiltFromPointer(L.ptrY, this.ptr.y, onset, L.pre, L.fine));
    let tiltT = L.tiltPtr;
    if (L.blocked === 'empty') tiltT = Math.min(tiltT, Math.max(0, onset - 0.12));
    if (L.blocked === 'full' && L.tiltPtr < onset - 0.06) L.blocked = null;
    h.tilt += (tiltT - h.tilt) * (1 - Math.exp(-dt * (tiltT > h.tilt ? TILT_UP : TILT_DOWN)));
    const pourTilt = isDrops ? L.tiltPtr : h.tilt; // droppers squeeze with the pointer directly
    const excess = pourTilt - onset;

    // yaw eases to the lock direction
    h.yaw += angleDelta(h.yaw, L.yaw) * (1 - Math.exp(-dt * 10));

    // pose: rotate about the lip, which hovers just above the target opening
    const rimTop = tp.y + T.profile.rimY + T.profile.baseOffsetY;
    const rimOuter = T.profile.rimOuterRadius;
    const ground = this.host.groundAt(tp.x, tp.z);
    const outsideR = rimOuter + 0.5 + h.bodyR - h.lipX;
    if (isDrops) {
      // the bottle stands beside the target while the pipette (cursor) works over the opening
      const r = rimOuter + h.bodyR + 1.5;
      h.pos.x += (tp.x + L.dir.x * r - h.pos.x) * (1 - Math.exp(-dt * FOLLOW_XZ));
      h.pos.z += (tp.z + L.dir.y * r - h.pos.z) * (1 - Math.exp(-dt * FOLLOW_XZ));
      h.pos.y += (ground + LIFT_BOTTLE - h.pos.y) * (1 - Math.exp(-dt * FOLLOW_Y));
      h.tilt += (0 - h.tilt) * (1 - Math.exp(-dt * TILT_DOWN));
    } else {
      const p = smoothstep(h.tilt / Math.max(0.3, onset * 0.7));
      const lipX = tp.x + L.dir.x * outsideR * (1 - p) + L.inner.x * p;
      const lipZ = tp.z + L.dir.y * outsideR * (1 - p) + L.inner.y * p;
      const lipY = Math.max(rimTop + 1.0, ground + LIFT_BOTTLE + bodyDrop(h.tilt, h.lipY, h.lipX, h.bodyR));
      // object origin so that the (rotated) lip lands on (lipX, lipY, lipZ)
      const q = this.tmpQ;
      const qt = this.tmpQ2;
      q.setFromAxisAngle(UP, h.yaw);
      qt.setFromAxisAngle(AXIS_Z, -h.tilt);
      q.multiply(qt);
      const off = new THREE.Vector3(h.lipX, h.lipY, 0).applyQuaternion(q);
      const k = 1 - Math.exp(-dt * 18);
      h.pos.x += (lipX - off.x - h.pos.x) * k;
      h.pos.y += (lipY - off.y - h.pos.y) * k;
      h.pos.z += (lipZ - off.z - h.pos.z) * k;
    }
    this.applyObject(h);
    h.obj.updateWorldMatrix(true, false);

    // ---- flow
    let rate = 0; // display unit per second (mL, g or drops)
    const sink = L.sink;
    const lipW = this.tmpV.set(h.lipX, h.lipY, 0).applyMatrix4(h.obj.matrixWorld).clone();
    const surfY = tp.y + T.surfaceLocalY();
    if (kind === 'liquid' && L.fx.stream) {
      // a narrow opening (burette 1.3 cm) takes liquid more slowly than a beaker
      const narrow = clamp(14 * T.profile.rimInnerRadius, 3, LIQUID_MAX_ML_S);
      let flow = L.blocked ? 0 : flowRate(excess, LIQUID_MIN_ML_S, Math.min(LIQUID_MAX_ML_S, liquidMaxRate(h.mouthR), narrow));
      if (flow > 0) {
        const got = sink.push(flow * dt);
        if (got < flow * dt * 0.98) {
          this.block(h, L, sink.limit() ?? 'full');
          flow = got / Math.max(dt, 1e-4);
          if (got <= 0) flow = 0;
        }
      }
      rate = flow;
      const tw = this.towardTarget(lipW, tp);
      const [lx, lz] = streamLanding(lipW.x, lipW.z, tw.x, tw.y, lipW.y - surfY, flow, tp.x, tp.z, T.profile.rimInnerRadius * 0.9);
      L.fx.stream.update(dt, time, {
        flowMlS: flow,
        lip: lipW,
        land: new THREE.Vector3(lx, surfY, lz),
        target: T,
        mouthR: h.mouthR,
      });
    } else if (kind === 'gas' && L.fx.gas) {
      const flow = L.blocked ? 0 : flowRate(excess, GAS_MIN_ML_S, GAS_MAX_ML_S);
      if (flow > 0) {
        const got = sink.push(flow * dt);
        if (got < flow * dt * 0.98) this.block(h, L, sink.limit() ?? 'full');
      }
      rate = flow;
      L.fx.gas.update(dt, time, flow, lipW, T);
    } else if (kind === 'powder' && L.fx.powder) {
      const g = L.blocked ? 0 : flowRate(excess, POWDER_MIN_G_S, POWDER_MAX_G_S);
      if (g > 0) sink.push(g * dt);
      rate = g;
      L.fx.powder.update(dt, time, g, lipW, T);
    } else if (kind === 'metal' && L.fx.metal) {
      const pcs = L.blocked ? 0 : flowRate(excess, METAL_MIN_PIECES_S, METAL_MAX_PIECES_S);
      L.acc += pcs * dt;
      while (L.acc >= 1) {
        L.acc -= 1;
        sink.push(METAL_PIECE_G);
        L.fx.metal.drop(lipW, T);
      }
      rate = pcs * METAL_PIECE_G;
      L.fx.metal.update(dt, time, T);
    } else if (kind === 'drops' && L.fx.drops && L.fx.pipette) {
      const dr = L.blocked ? 0 : dropRate(L.tiltPtr);
      L.acc += dr * dt;
      const tip = new THREE.Vector3(tp.x + L.inner.x * 0.45, rimTop + 2.2, tp.z + L.inner.y * 0.45);
      L.fx.pipette.position.lerp(tip, 1 - Math.exp(-dt * 18));
      if (L.fx.pipette.position.lengthSq() < 1e-6) L.fx.pipette.position.copy(tip);
      const bulb = L.fx.pipette.getObjectByName('bulb');
      const squeeze = clamp(L.tiltPtr / 1.2, 0, 1);
      bulb?.scale.set(1 + squeeze * 0.12, 1 - squeeze * 0.22, 1 + squeeze * 0.12);
      while (L.acc >= 1) {
        L.acc -= 1;
        const got = sink.push(1);
        if (got < 1) {
          this.block(h, L, sink.limit() ?? 'full');
          break;
        }
        L.fx.drops.drop(L.fx.pipette.position.clone().add(new THREE.Vector3(0, -0.15, 0)));
      }
      rate = dr;
      L.fx.drops.update(dt, time, T);
    }
    L.rate = rate;

    L.uiT += dt;
    if (L.uiT >= 0.08) {
      L.uiT = 0;
      this.host.setPourState({
        kind: h.kind === 'vessel' ? 'transfer' : kind === 'liquid' ? 'liquid' : kind === 'drops' ? 'drops' : 'solid',
        targetName: T.vesselState.name,
        rate,
        total: sink.total,
        unit: kind === 'liquid' ? 'mL' : kind === 'drops' ? 'drops' : 'g',
        flowing: rate > 0,
        blocked: L.blocked,
      });
    }
  }

  private towardTarget(lip: THREE.Vector3, tp: THREE.Vector3): THREE.Vector2 {
    const v = new THREE.Vector2(tp.x - lip.x, tp.z - lip.z);
    if (v.lengthSq() < 1e-4) return new THREE.Vector2(-this.held!.lock!.dir.x, -this.held!.lock!.dir.y);
    return v.normalize();
  }

  private block(h: Held, L: Lock, why: 'full' | 'empty') {
    if (L.blocked === why) return;
    L.blocked = why;
    const name = L.target.vesselState.name;
    if (why === 'full') {
      this.host.notify(`${name} is full.`, 'warning');
      this.setHint('Target is full · release or tilt back');
    } else {
      this.host.notify(h.kind === 'vessel' ? 'Nothing left to pour.' : 'Nothing left to pour.', 'info');
      this.setHint('Nothing left to pour · release to put it down');
    }
  }

  /** Tilt (rad) at which the liquid reaches the lip, from the real fill of the source. */
  private onsetFor(h: Held): number {
    const fill = h.kind === 'vessel' ? h.vb!.surfaceLocalY() : h.asm!.fillY;
    return onsetTilt(h.lipX, h.lipY, fill);
  }

  // ---------------------------------------------------------------- pipettes (suction instead of tilt)
  private beginPipette(h: Held) {
    const lab = this.host.pipetteLab?.() ?? null;
    if (!lab || !h.vb) return;
    const ph: PipetteHost = {
      scene: this.host.scene,
      vessels: () => this.host.vessels(),
      lab,
      notify: (m, k) => this.host.notify(m, k),
      setHint: (t) => this.setHint(t),
      viewportY: () => {
        const rect = this.host.dom.getBoundingClientRect();
        return [rect.top, rect.bottom];
      },
      setReadout: (r) =>
        this.host.setPourState(
          r ? { kind: 'transfer', targetName: '', rate: 0, total: 0, unit: 'mL', flowing: r.flowing, blocked: r.blocked ? 'full' : null, readout: { rate: r.rate, total: r.total, to: r.to } } : null
        ),
    };
    try {
      h.pip = new PipetteSession(ph, h.vb, h);
    } catch (e) {
      warnOnce('pipette session failed', e);
      h.pip = undefined;
    }
  }

  private endPipette(h: Held) {
    const s = h.pip;
    if (!s) return;
    h.pip = undefined;
    try {
      const fx = s.end();
      if (fx.stream || fx.drops) this.fading.push(fx);
    } catch (e) {
      warnOnce('pipette end failed', e);
    }
  }

  private updatePipette(h: Held, dt: number, time: number, cx: number, cz: number) {
    const s = h.pip!;
    if (!s.locked) {
      this.updateFree(h, dt, cx, cz);
      s.tickFree(dt, time);
      s.tryCapture(cx, cz, this.ptr.y);
      return;
    }
    // virtual cursor: horizontal pointer travel moves the tip inside the opening, vertical travel is the suction signal
    const vp = this.cursorPlane(this.ptr.x, s.lockY, this.tmpV, h.planeY);
    const b = this.host.bounds(false);
    const vx = vp ? clamp(vp.x + h.grabOff.x, b.x0, b.x1) : cx;
    const vz = vp ? clamp(vp.z + h.grabOff.y, b.z0, b.z1) : cz;
    if (!s.updateLocked(dt, time, vx, vz, this.ptr.y, this.shift)) {
      s.unlock();
      this.host.setPourState(null);
      this.setHint(s.freeHint());
    }
  }

  // ---------------------------------------------------------------- effects bookkeeping
  private tickFx(f: Fx, dt: number, time: number, flow: number) {
    if (f.stream) {
      f.stream.update(dt, time, { flowMlS: flow, lip: IDENT_V, land: IDENT_V, target: f.target });
      if (!f.stream.alive) {
        f.stream.dispose();
        f.stream = undefined;
      }
    }
    if (f.powder) {
      f.powder.update(dt, time, 0, IDENT_V, f.target);
      if (!f.powder.alive) {
        f.powder.dispose();
        f.powder = undefined;
      }
    }
    if (f.metal) {
      f.metal.update(dt, time, f.target);
      if (!f.metal.alive) {
        f.metal.dispose();
        f.metal = undefined;
      }
    }
    if (f.gas) {
      f.gas.update(dt, time, 0, IDENT_V, f.target);
      if (!f.gas.alive) {
        f.gas.dispose();
        f.gas = undefined;
      }
    }
    if (f.drops) {
      f.drops.update(dt, time, f.target);
      if (!f.drops.alive) {
        f.drops.dispose();
        f.drops = undefined;
      }
    }
  }

  private fxAlive(f: Fx): boolean {
    return !!(f.stream || f.powder || f.metal || f.drops || f.gas);
  }

  private disposeFx(f: Fx) {
    f.stream?.dispose();
    f.powder?.dispose();
    f.metal?.dispose();
    f.drops?.dispose();
    f.gas?.dispose();
    if (f.pipette) this.host.scene.remove(f.pipette);
  }

  // ---------------------------------------------------------------- release
  private release(cancel: boolean) {
    const h = this.held;
    if (!h) return;
    this.held = null;
    const wasLocked = !!h.lock || !!h.pip?.locked;
    if (h.lock) {
      this.endLock(h);
      h.lock = null;
    }
    this.endPipette(h);
    this.host.dom.style.cursor = 'grab';
    this.host.setPourState(null);
    this.setHint(null);
    const host = this.host;
    if (h.kind === 'bottle') {
      const asm = h.asm!;
      asm.cap.visible = true;
      if (asm.dropperParts) asm.dropperParts.visible = true;
      host.animator.add(
        poseTask(h.obj, h.home.pos, h.home.quat, {
          arc: 9 + Math.min(14, h.obj.position.distanceTo(h.home.pos) * 0.08),
          rotFrac: 0.35,
          onArrive: () => {
            host.shelf.setBusy(h.id, false);
            host.markDirty();
          },
        })
      );
      return;
    }
    // vessel: set it down where it is, or go back to where it was picked up (Esc, or released while pouring)
    const vb = h.vb!;
    if (!host.vessels().has(h.id)) return;
    const goHome = cancel || wasLocked;
    const spot = goHome
      ? host.resolveDrop(h.id, h.home.pos.x, h.home.pos.z, h.home.place === 'shelf' ? 'bench' : h.home.place)
      : host.resolveDrop(h.id, h.obj.position.x, h.obj.position.z);
    const dist = Math.hypot(spot.pos.x - h.obj.position.x, spot.pos.z - h.obj.position.z);
    const fall = Math.max(0, h.obj.position.y - spot.pos.y);
    host.animator.add(
      poseTask(h.obj, spot.pos, IDENT, {
        arc: dist > 6 ? 5 : 0,
        duration: Math.min(0.9, 0.14 + fall / 90 + dist / 160),
        rotFrac: 0.5,
        onArrive: () => {
          try {
            if (vb.profile.rack) vb.setRackVisible(true);
            vb.liquid.slosh(0.05);
          } catch {
            /* cosmetic */
          }
          host.commitDrop(h.id, spot);
          host.markDirty();
        },
      })
    );
  }

  // ---------------------------------------------------------------- hint
  private setHint(text: string | null) {
    if (text === this.hintShown) return;
    this.hintShown = text;
    this.host.setHint(text);
  }
}

const IDENT_V = new THREE.Vector3();
