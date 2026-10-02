// Titration station + stopcock apparatus: a ring stand with a burette clamp over a magnetic stirrer with a white tile,
// manual stopcock levers (burette, separatory funnel), tip-to-vessel drain targets and the drops / stream that leave the tip.
// Owned by BenchScene (`scene.titration`); all chemistry goes through the FlowSink supplied by `host.openDrain`.
import * as THREE from 'three';
import type { VesselBundle } from './glassware';
import { DropFall, PourStream } from './animations';
import type { DropSpot, FlowSink } from './handling';
import { StirPlate, STIR_TOP_Y } from '../equipment/stir_plate';
import { roundedBox } from '../equipment/lcd';
import {
  DispenserKind,
  DripState,
  STOPCOCK_DEAD,
  STOPCOCK_DROP_ML,
  STREAM_FROM_ML_S,
  TAP_S,
  UnderTarget,
  buretteTag,
  clampDelta,
  flowWord,
  insertDepth,
  interfaceReached,
  leverFromDrag,
  newDrip,
  pendantFill,
  qMaxFor,
  stepDrip,
  stopcockFlow,
  tapDrop,
  tapProfile,
  targetUnderTip,
  tipFitsMouth,
  withinSnap,
} from './titration_math';

export * from './titration_math';

// ------------------------------------------------------------------ layout (world coordinates, cm)
/** Burette axis / flask axis of the station. The stirrer is centred on it, the rod stands behind it. */
export const STATION_X = -44;
export const STATION_Z = -3;
const BASE_H = 1.2;
/** Height of the white tile surface: where the flask stands. */
export const STATION_TILE_Y = BASE_H + STIR_TOP_Y;
const BASE_W = 26;
const BASE_D = 28;
const BASE_CZ = -2; // base plate centre (relative to the axis)
const ROD_Z = -12.5;
const ROD_TOP = 92;
/** Footprint the bench keeps free (scene.footprints). */
export const STATION_FOOTPRINT = { x0: STATION_X - BASE_W / 2 - 1, x1: STATION_X + BASE_W / 2 + 1, z0: STATION_Z + BASE_CZ - BASE_D / 2 - 1, z1: STATION_Z + BASE_CZ + BASE_D / 2 + 1 };
/** A burette released within this distance of the clamp (xz) snaps into it; a flask within SEAT_R of the tile centre snaps onto it. */
const MOUNT_R = 16;
const SEAT_R = 9;
const FUNNEL_SEAT_R = 6.5;
/** The tile is the ground over this half-width (cm): carried vessels rise onto it before they get there. */
const TILE_GROUND_R = 8.5;
/** Burette group height when no flask is seated, and the lift that clears a vessel carried under the tip. */
const DELTA_DEFAULT = 0;
const DELTA_MAX = 22;
const DELTA_SPEED = 22; // cm/s
/** Built-in ring-stand base of a separatory funnel (glass_accessories.buildStand): half sizes + centre offset (z). */
const FUNNEL_BASE_HX = 5.25;
const FUNNEL_BASE_HZ = 7;
const FUNNEL_BASE_CZ = -1.5;
const FUNNEL_BASE_H = 1.2;

const warned = new Set<string>();
function warnOnce(key: string, e: unknown) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[titration] ${key}`, e);
}

// ------------------------------------------------------------------ host contract
export interface TitrationHost {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  controls: { enabled: boolean };
  vessels(): Map<string, VesselBundle>;
  /** Id of the vessel being carried right now (null when none). */
  heldVesselId(): string | null;
  /** Anything (a vessel or a shelf bottle) is being carried. */
  isHolding(): boolean;
  /** Opens a drain of `srcId` into `targetId` (null = onto the bench: the liquid is discarded). `bottom`: densest layer first. */
  openDrain(srcId: string, targetId: string | null, bottom: boolean): FlowSink | null;
  /** Engine volume (mL) of a vessel. */
  volumeMl(id: string): number;
  notify(message: string, kind?: 'info' | 'warning'): void;
  setHint(text: string | null): void;
  markDirty(): void;
  /** The stirrer knob was clicked: stir (or stop stirring) the vessel on the plate. */
  setStirring(id: string, on: boolean): void;
  /** A vessel left the stirrer plate (stirring must stop). */
  stirrerVacated(id: string): void;
}

export interface DispenserState {
  id: string;
  name: string;
  kind: DispenserKind;
  open: number;
  /** Delivered flow (mL/s) right now. */
  flow: number;
  word: string;
  flowing: boolean;
}

export type TitrationPick = { type: 'stopcock' | 'stirknob'; id: string };

export type ViewPlan = { target: THREE.Vector3; distance: number; front?: boolean };

// ------------------------------------------------------------------ one stopcock
const GLOW_COLOR = 0x7cc8ff;

class Dispenser {
  public readonly kind: DispenserKind;
  public readonly qMax: number;
  /** Lever position set by the user (0 closed .. 1 wide open); the stopcock mesh shows max(open, tap flick). */
  public open = 0;
  public shown = -1;
  public tapT = -1;
  public drip: DripState = newDrip();
  public stream: PourStream | null = null;
  public drops: DropFall | null = null;
  public sink: FlowSink | null = null;
  public sinkTarget: string | null | undefined = undefined;
  public idle = 0;
  public flow = 0;
  public hadBottom = false;
  public spillWarned = false;
  public colourT = 0;
  public fxIdle = 0;
  public readonly pick: THREE.Mesh;
  public readonly arc: THREE.Mesh;
  public readonly pendant: THREE.Mesh;
  public readonly pendantMat: THREE.MeshPhysicalMaterial;
  /** Hover arc: 0..1 eased towards `glowTarget` every frame. */
  public glow = 0;
  public glowTarget = 0;
  public readonly tipR: number;
  public readonly tipY: number;
  private readonly arcMat: THREE.MeshBasicMaterial;

  constructor(public readonly bundle: VesselBundle) {
    const p = bundle.profile;
    this.kind = p.kind === 'burette' ? 'burette' : 'funnel';
    this.qMax = qMaxFor(this.kind);
    const sc = p.accessories.find((a) => a.kind === 'stopcock');
    const len = sc?.len ?? 2.7;
    const tubeR = sc?.r ?? 0.3;
    const br = Math.max(0.55, tubeR * 1.8);
    const leverLen = Math.max(2.4, br * 3.8);
    const c = bundle.stopcockLocal() ?? new THREE.Vector3(0, 8, 0);
    const pivot = new THREE.Vector3(c.x + len / 2 + 0.9, c.y, c.z);
    this.tipR = tubeR;
    this.tipY = bundle.tipLocal()?.y ?? 0;

    // pick target: the quarter circle the lever sweeps (closed = toward the viewer, open = up)
    this.pick = new THREE.Mesh(new THREE.SphereGeometry(leverLen * 0.78, 10, 8), new THREE.MeshBasicMaterial());
    this.pick.visible = false;
    this.pick.position.set(pivot.x, pivot.y + leverLen * 0.42, pivot.z + leverLen * 0.42);
    this.pick.userData.pick = { type: 'stopcock', id: bundle.vesselState.id } satisfies TitrationPick;
    bundle.group.add(this.pick);

    // highlight arc along the lever's sweep (shown on hover / while dragging)
    this.arcMat = new THREE.MeshBasicMaterial({
      color: GLOW_COLOR,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const arcGeo = new THREE.TorusGeometry(leverLen * 1.05, 0.07, 6, 28, Math.PI / 2);
    arcGeo.rotateY(-Math.PI / 2);
    this.arc = new THREE.Mesh(arcGeo, this.arcMat);
    this.arc.position.copy(pivot);
    this.arc.renderOrder = 1000;
    this.arc.visible = false;
    this.arc.raycast = () => {};
    bundle.group.add(this.arc);

    // the drop swelling at the tip
    this.pendantMat = new THREE.MeshPhysicalMaterial({ color: 0xeef6fb, roughness: 0.03, transparent: true, opacity: 0.8, depthWrite: false });
    this.pendant = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 9), this.pendantMat);
    const tip = bundle.tipLocal() ?? new THREE.Vector3();
    this.pendant.position.set(tip.x, tip.y - 0.1, tip.z);
    this.pendant.visible = false;
    this.pendant.raycast = () => {};
    bundle.group.add(this.pendant);
  }

  public easeGlow(dt: number) {
    this.glow += (this.glowTarget - this.glow) * Math.min(1, dt * 12);
    this.arcMat.opacity = 0.55 * this.glow;
    this.arc.visible = this.glow > 0.02;
  }

  public dispose(scene: THREE.Scene) {
    this.bundle.group.remove(this.pick, this.arc, this.pendant);
    this.pick.geometry.dispose();
    this.arc.geometry.dispose();
    this.arcMat.dispose();
    this.pendant.geometry.dispose();
    this.pendantMat.dispose();
    this.endSink();
    this.stream?.dispose();
    this.drops?.dispose();
    this.stream = null;
    this.drops = null;
    void scene;
  }

  public endSink() {
    if (this.sink) {
      try {
        this.sink.end();
      } catch (e) {
        warnOnce('sink.end failed', e);
      }
    }
    this.sink = null;
    this.sinkTarget = undefined;
  }
}

// ------------------------------------------------------------------ the rig
export class TitrationRig {
  public readonly group = new THREE.Group();
  public readonly stirrer = new StirPlate();
  private clampGroup = new THREE.Group();
  private clampRing: THREE.Mesh | null = null;
  private ringMat: THREE.MeshStandardMaterial;
  private dispensers = new Map<string, Dispenser>();
  /** Burette held by the clamp (id) and the flask on the tile (id). */
  private burette: string | null = null;
  private occupant: string | null = null;
  private lifted = new Set<string>();
  private delta = DELTA_DEFAULT;
  private ray = new THREE.Raycaster();
  private drag: { d: Dispenser; startY: number; startOpen: number; moved: boolean; t0: number } | null = null;
  private knobPress: { x: number; y: number; t0: number } | null = null;
  private hoverId: string | null = null;
  private hintShown: string | null = null;
  private viewIdx = 0;
  private time = 0;
  private tmp = new THREE.Vector3();

  constructor(private host: TitrationHost) {
    this.group.name = 'titration_station';
    this.group.position.set(STATION_X, 0, STATION_Z);
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0xb4bac0, metalness: 0.9, roughness: 0.35 });
    this.build();
    host.scene.add(this.group);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('blur', this.onCancel);
    window.addEventListener('keydown', this.onKey, true);
    const wheelHost = host.dom.parentElement ?? host.dom;
    wheelHost.addEventListener('wheel', this.onWheel, { passive: false, capture: true });
    this.wheelHost = wheelHost;
  }

  private wheelHost: HTMLElement;

  public dispose() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('blur', this.onCancel);
    window.removeEventListener('keydown', this.onKey, true);
    this.wheelHost.removeEventListener('wheel', this.onWheel, { capture: true } as EventListenerOptions);
    for (const d of this.dispensers.values()) d.dispose(this.host.scene);
    this.dispensers.clear();
    this.host.scene.remove(this.group);
  }

  // ---------------------------------------------------------------- station geometry
  private build() {
    const paint = new THREE.MeshStandardMaterial({ color: 0x1f2327, roughness: 0.55, metalness: 0.2 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb4bac0, metalness: 0.9, roughness: 0.35 });
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.group) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = () => {};
      parent.add(m);
      return m;
    };
    // heavy base plate
    add(roundedBox(BASE_W, BASE_H, BASE_D, 1.2), paint, 0, 0, BASE_CZ);
    // magnetic stirrer + tile stand on it
    this.stirrer.group.position.set(0, BASE_H, 0);
    this.group.add(this.stirrer.group);
    // vertical rod behind the flask
    add(new THREE.CylinderGeometry(0.55, 0.55, ROD_TOP - BASE_H, 14), steel, 0, BASE_H + (ROD_TOP - BASE_H) / 2, ROD_Z);
    add(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 14), steel, 0, BASE_H + 0.25, ROD_Z);
    // sliding clamp: boss on the rod, arm to the burette, ring (rebuilt for the burette's diameter)
    this.group.add(this.clampGroup);
    add(new THREE.BoxGeometry(2.3, 2.1, 2.3), paint, 0, 0, ROD_Z, this.clampGroup);
    const armLen = -ROD_Z - 1.0;
    const armGeo = new THREE.CylinderGeometry(0.32, 0.32, armLen, 10);
    armGeo.rotateX(Math.PI / 2);
    add(armGeo, steel, 0, 0, ROD_Z + armLen / 2 + 0.6, this.clampGroup);
    this.setClampRing(1.0);
    this.clampGroup.position.y = DELTA_DEFAULT + 16 + 50.5;
  }

  private setClampRing(r: number) {
    if (this.clampRing) {
      this.clampGroup.remove(this.clampRing);
      this.clampRing.geometry.dispose();
    }
    const g = new THREE.TorusGeometry(r + 0.22, 0.22, 10, 36);
    g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, this.ringMat);
    m.castShadow = true;
    m.raycast = () => {};
    this.clampRing = m;
    this.clampGroup.add(m);
  }

  // ---------------------------------------------------------------- queries used by the scene
  public mountedBuretteId(): string | null {
    return this.burette;
  }

  public stirrerVesselId(): string | null {
    return this.occupant;
  }

  public isOnStirrer(id: string): boolean {
    return this.occupant === id;
  }

  public isDispenser(id: string): boolean {
    return this.dispensers.has(id);
  }

  public holdsBurette(): boolean {
    return this.burette !== null;
  }

  /** Height of whatever stands on the station tile / funnel base at (x, z), or null when the rig has no opinion. */
  public groundAt(x: number, z: number): number | null {
    if (Math.abs(x - STATION_X) < TILE_GROUND_R && Math.abs(z - STATION_Z) < TILE_GROUND_R) return STATION_TILE_Y;
    for (const d of this.dispensers.values()) {
      if (d.kind !== 'funnel' || this.lifted.has(d.bundle.vesselState.id)) continue;
      const p = d.bundle.group.position;
      if (Math.abs(x - p.x) < FUNNEL_BASE_HX - 0.4 && Math.abs(z - (p.z + FUNNEL_BASE_CZ)) < FUNNEL_BASE_HZ - 0.4) return p.y + FUNNEL_BASE_H;
    }
    return null;
  }

  /** Ground height for a vessel's own contact shadow: the clamped burette hangs in the air (no shadow / ring on the tile). */
  public groundFor(id: string, x: number, z: number): number {
    if (this.burette === id) return -100;
    return this.groundAt(x, z) ?? 0;
  }

  // ---------------------------------------------------------------- vessels coming and going
  /** A vessel was created. Returns where it should stand (the clamp) when it is a burette and the clamp is free. */
  public onVesselAdded(b: VesselBundle): THREE.Vector3 | null {
    const p = b.profile;
    const isDispenser = p.accessories.some((a) => a.kind === 'stopcock') && !!p.tip;
    if (isDispenser) {
      try {
        this.dispensers.set(b.vesselState.id, new Dispenser(b));
        // only the glass is a pick target (the empty air above the stand base must not catch clicks meant for a flask)
        const lift = p.baseOffsetY;
        const h1 = b.height + 1;
        b.pickProxy.scale.y = Math.max(0.2, (h1 - lift) / h1);
        b.pickProxy.position.y = lift;
      } catch (e) {
        warnOnce('dispenser setup failed', e);
      }
    }
    if (p.kind === 'burette' && this.burette === null && this.dispensers.has(b.vesselState.id)) {
      this.mount(b);
      return new THREE.Vector3(STATION_X, this.delta, STATION_Z);
    }
    return null;
  }

  public onVesselRemoved(id: string) {
    const d = this.dispensers.get(id);
    if (d) {
      d.dispose(this.host.scene);
      this.dispensers.delete(id);
    }
    if (this.drag?.d.bundle.vesselState.id === id) this.drag = null;
    if (this.burette === id) this.burette = null;
    if (this.occupant === id) {
      this.occupant = null;
      this.stirrer.setOn(false);
    }
    this.lifted.delete(id);
    if (this.hoverId === id) this.hoverId = null;
  }

  private mount(b: VesselBundle) {
    this.burette = b.vesselState.id;
    b.setRackVisible(false); // the station's own stand + clamp hold it
    this.setClampRing(b.profile.rimOuterRadius + 0.1);
    this.lifted.delete(b.vesselState.id);
  }

  /** A vessel was moved without being carried (slid onto the hot plate): it no longer stands on the tile. */
  public vesselMoved(id: string) {
    if (this.occupant !== id) return;
    this.occupant = null;
    this.stirrer.setOn(false);
    this.host.stirrerVacated(id);
  }

  /** A vessel is being picked up. */
  public onLift(id: string) {
    this.lifted.add(id);
    const d = this.dispensers.get(id);
    if (d) {
      d.open = 0;
      d.tapT = -1;
      d.bundle.setRackVisible(false);
    }
    if (this.burette === id) this.burette = null;
    if (this.occupant === id) {
      this.occupant = null;
      this.stirrer.setOn(false);
      this.host.stirrerVacated(id);
    }
  }

  /** Where a vessel released at (x, z) comes to rest when that is the station / a funnel stand; null = normal bench rules. */
  public resolveDrop(id: string, x: number, z: number, b: VesselBundle): DropSpot | null {
    const p = b.profile;
    // burette -> clamp
    if (p.kind === 'burette' && this.dispensers.has(id) && (this.burette === null || this.burette === id)) {
      if (withinSnap(x, z, STATION_X, STATION_Z, MOUNT_R)) {
        return { place: 'bench', pos: new THREE.Vector3(STATION_X, this.deltaFor(b), STATION_Z), tag: 'burette' };
      }
      return null;
    }
    if (!this.canSeat(b)) return null;
    // flask -> tile
    if ((this.occupant === null || this.occupant === id) && withinSnap(x, z, STATION_X, STATION_Z, SEAT_R)) {
      return { place: 'bench', pos: new THREE.Vector3(STATION_X, STATION_TILE_Y, STATION_Z), tag: 'flask' };
    }
    // anything under a separatory funnel's tip
    for (const d of this.dispensers.values()) {
      const fid = d.bundle.vesselState.id;
      if (d.kind !== 'funnel' || fid === id || this.lifted.has(fid)) continue;
      const fp = d.bundle.group.position;
      if (!withinSnap(x, z, fp.x, fp.z, FUNNEL_SEAT_R)) continue;
      const rimTop = fp.y + FUNNEL_BASE_H + b.profile.rimY + b.profile.baseOffsetY;
      if (rimTop <= fp.y + d.tipY + 1.0) {
        return { place: 'bench', pos: new THREE.Vector3(fp.x, fp.y + FUNNEL_BASE_H, fp.z), tag: 'funnel-flask' };
      }
    }
    return null;
  }

  /** Vessels that may stand on the tile: open-topped, free-standing, small enough for the plate. */
  private canSeat(b: VesselBundle): boolean {
    const p = b.profile;
    return !p.tip && p.support === 'none' && b.footprint <= 7.2 && p.rimInnerRadius > 0.3 && b.height < 40;
  }

  /** A vessel came to rest at `spot`. */
  public onCommit(id: string, spot: DropSpot) {
    this.lifted.delete(id);
    const b = this.host.vessels().get(id);
    if (!b) return;
    if (spot.tag === 'burette') {
      this.mount(b);
      this.delta = spot.pos.y;
    } else if (spot.tag === 'flask') {
      this.occupant = id;
    } else if (this.dispensers.has(id)) {
      b.setRackVisible(true); // free-standing burette / funnel: its own stand again
    }
    if (this.occupant === id && spot.tag !== 'flask') this.occupant = null;
    this.host.markDirty();
  }

  /** Kit helper: put `id` on the tile (flask) right away. Returns false when it cannot stand there. */
  public flaskSpot(id: string): DropSpot | null {
    const b = this.host.vessels().get(id);
    if (!b || !this.canSeat(b) || (this.occupant !== null && this.occupant !== id)) return null;
    return { place: 'bench', pos: new THREE.Vector3(STATION_X, STATION_TILE_Y, STATION_Z), tag: 'flask' };
  }

  /** Kit helper: stand `flaskId` under the tip of the separatory funnel `funnelId`. */
  public funnelFlaskSpot(flaskId: string, funnelId: string): DropSpot | null {
    const d = this.dispensers.get(funnelId);
    const f = this.host.vessels().get(flaskId);
    if (!d || !f || d.kind !== 'funnel') return null;
    const fp = d.bundle.group.position;
    return { place: 'bench', pos: new THREE.Vector3(fp.x, fp.y + FUNNEL_BASE_H, fp.z), tag: 'funnel-flask' };
  }

  // ---------------------------------------------------------------- burette height (clamp slides on the rod)
  /** Burette group height that seats the tip in the opening of the vessel on the tile (or the default height). */
  private deltaFor(b: VesselBundle): number {
    const f = this.occupant ? this.host.vessels().get(this.occupant) : null;
    if (!f) return DELTA_DEFAULT;
    const d = this.dispensers.get(b.vesselState.id);
    const tipY = d?.tipY ?? b.profile.baseOffsetY;
    const rimWorld = STATION_TILE_Y + f.profile.rimY + f.profile.baseOffsetY;
    if (!tipFitsMouth(f.profile.rimInnerRadius, d?.tipR ?? 0.3)) return Math.min(DELTA_MAX, clampDelta(tipY, rimWorld, -1.5));
    return Math.min(DELTA_MAX, clampDelta(tipY, rimWorld, insertDepth(f.profile.rimInnerRadius, f.height)));
  }

  private updateStation(dt: number) {
    const vessels = this.host.vessels();
    if (this.occupant && !vessels.has(this.occupant)) this.occupant = null;
    if (this.burette && !vessels.has(this.burette)) this.burette = null;
    const occ = this.occupant ? vessels.get(this.occupant) : undefined;
    this.stirrer.setOn(!!occ && occ.vesselState.stirring);
    this.stirrer.animate(dt);

    const bur = this.burette ? vessels.get(this.burette) : undefined;
    if (!bur) return;
    const held = this.host.heldVesselId();
    let target = this.deltaFor(bur);
    if (held && held !== this.burette) {
      const hb = vessels.get(held);
      if (hb && Math.hypot(hb.group.position.x - STATION_X, hb.group.position.z - STATION_Z) < 24) {
        const d = this.dispensers.get(this.burette!);
        const need = STATION_TILE_Y + 4 + hb.height + 1.5 - (d?.tipY ?? 16);
        target = Math.max(target, Math.min(DELTA_MAX, need));
      }
    }
    const step = DELTA_SPEED * dt;
    this.delta += Math.max(-step, Math.min(step, target - this.delta));
    bur.group.position.set(STATION_X, this.delta, STATION_Z);
    this.clampGroup.position.y = this.delta + bur.profile.baseOffsetY + bur.profile.supportY;
    this.host.markDirty();
  }

  // ---------------------------------------------------------------- picking
  public pickMeshes(): THREE.Object3D[] {
    const out: THREE.Object3D[] = [this.stirrer.knobPick];
    for (const d of this.dispensers.values()) if (!this.lifted.has(d.bundle.vesselState.id)) out.push(d.pick);
    return out;
  }

  private pickAt(cx: number, cy: number): TitrationPick | null {
    const rect = this.host.dom.getBoundingClientRect();
    const x = ((cx - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = -((cy - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.ray.setFromCamera(new THREE.Vector2(x, y), this.host.camera);
    const objs = this.pickMeshes();
    for (const o of objs) o.updateWorldMatrix(true, false);
    const hits = this.ray.intersectObjects(objs, false);
    // a vessel in front of the lever (e.g. a flask carried past) does not block it: the lever is small and deliberate
    for (const h of hits) {
      const p = h.object.userData.pick as TitrationPick | undefined;
      if (p) return p;
    }
    return null;
  }

  /** Capture-phase press. True when it started a lever drag / knob press (the caller must not start a grab). */
  public pointerDown(e: PointerEvent): boolean {
    if (e.button !== 0 || this.drag || this.knobPress) return false;
    const hit = this.pickAt(e.clientX, e.clientY);
    if (!hit) return false;
    if (hit.type === 'stirknob') {
      this.knobPress = { x: e.clientX, y: e.clientY, t0: performance.now() };
      this.host.controls.enabled = false;
      return true;
    }
    const d = this.dispensers.get(hit.id);
    if (!d || this.host.heldVesselId() === hit.id) return false;
    this.drag = { d, startY: e.clientY, startOpen: d.open, moved: false, t0: performance.now() };
    d.glowTarget = 1;
    this.host.controls.enabled = false;
    this.setHint('Drag up to open · down to close · Shift = fine · Esc closes');
    return true;
  }

  private onMove = (e: PointerEvent) => {
    const dr = this.drag;
    if (!dr) return;
    const dy = e.clientY - dr.startY;
    if (!dr.moved && Math.abs(dy) > 4) dr.moved = true;
    if (dr.moved) {
      dr.d.open = leverFromDrag(dr.startOpen, dy, e.shiftKey);
      dr.d.spillWarned = false;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const dr = this.drag;
    if (dr) {
      this.drag = null;
      if (!dr.moved && performance.now() - dr.t0 < 500) this.tap(dr.d);
      dr.d.glowTarget = this.hoverId === dr.d.bundle.vesselState.id ? 1 : 0;
      this.host.controls.enabled = true;
      this.setHint(null);
    }
    const kp = this.knobPress;
    if (kp) {
      this.knobPress = null;
      this.host.controls.enabled = true;
      if (Math.hypot(e.clientX - kp.x, e.clientY - kp.y) < 8) this.toggleStirrer();
    }
  };

  private onCancel = () => {
    if (this.drag || this.knobPress) {
      this.drag = null;
      this.knobPress = null;
      this.host.controls.enabled = true;
      this.setHint(null);
    }
  };

  /** A click on the lever: shuts an open stopcock, otherwise squeezes out exactly one drop. */
  private tap(d: Dispenser) {
    if (d.open > STOPCOCK_DEAD) {
      d.open = 0;
      return;
    }
    d.tapT = 0;
    tapDrop(d.drip);
  }

  private toggleStirrer() {
    const id = this.occupant;
    if (!id) {
      this.host.notify('Stand a flask on the tile first, then switch the stirrer on.', 'info');
      return;
    }
    const b = this.host.vessels().get(id);
    this.host.setStirring(id, !(b?.vesselState.stirring ?? false));
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || this.host.isHolding() || this.drag) return;
    if (this.closeAll()) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  private onWheel = (e: WheelEvent) => {
    const id = this.hoverId;
    const d = id ? this.dispensers.get(id) : null;
    if (!d || this.host.heldVesselId() !== null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const step = (e.shiftKey ? 0.01 : 0.03) * (e.deltaY < 0 ? 1 : -1);
    d.open = Math.max(0, Math.min(1, d.open + step));
    if (d.open < STOPCOCK_DEAD * 0.9 && step < 0) d.open = 0;
    d.spillWarned = false;
  };

  /** Close every open stopcock (Esc / the HUD button). True when something was open. */
  public closeAll(): boolean {
    let any = false;
    for (const d of this.dispensers.values()) {
      if (d.open > 0 || d.tapT >= 0) any = true;
      d.open = 0;
      d.tapT = -1;
    }
    return any;
  }

  // ---------------------------------------------------------------- hover (called by the scene)
  /** Pointer hover result: returns true when the hit belongs to the rig (the scene skips its own hover handling). */
  public hover(hit: { type: string; id: string } | null): boolean {
    const mine = !!hit && (hit.type === 'stopcock' || hit.type === 'stirknob');
    this.hoverId = mine && hit!.type === 'stopcock' ? hit!.id : null;
    for (const d of this.dispensers.values()) {
      d.glowTarget = this.hoverId === d.bundle.vesselState.id || this.drag?.d === d ? 1 : 0;
    }
    if (this.drag) return true;
    if (!mine) {
      if (this.hintShown) this.setHint(null);
      return false;
    }
    if (hit!.type === 'stirknob') this.setHint('Click to switch the stirrer on / off');
    else {
      const d = this.dispensers.get(hit!.id);
      this.setHint(
        d && d.open > 0
          ? 'Stopcock is open · drag down or click to close · wheel = fine adjust · Esc closes'
          : 'Drag the lever up to open the stopcock · click = one drop · wheel = fine adjust · B frames the station'
      );
    }
    return true;
  }

  public cursor(): string | null {
    return this.drag ? 'ns-resize' : null;
  }

  private setHint(text: string | null) {
    if (text === this.hintShown) return;
    this.hintShown = text;
    this.host.setHint(text);
  }

  // ---------------------------------------------------------------- HUD / camera
  /** Vessels the level tags should label: stopcocks being used / hovered and whatever receives their liquid. */
  public focusIds(): string[] {
    const out: string[] = [];
    for (const d of this.dispensers.values()) {
      const id = d.bundle.vesselState.id;
      if (d.open > 0 || d.tapT >= 0 || this.hoverId === id || this.drag?.d === d) {
        out.push(id);
        if (d.sinkTarget) out.push(d.sinkTarget);
      }
    }
    return out;
  }

  public states(): DispenserState[] {
    const out: DispenserState[] = [];
    for (const d of this.dispensers.values()) {
      if (!(d.open > 0 || d.tapT >= 0)) continue;
      const q = stopcockFlow(d.open, d.qMax); // nominal delivery of this lever position (steadier to read than the drop spikes)
      out.push({ id: d.bundle.vesselState.id, name: d.bundle.vesselState.name, kind: d.kind, open: d.open, flow: q, word: flowWord(q), flowing: q > 0 });
    }
    return out;
  }

  /** Reading text for a burette's level tag (null for everything else). */
  public tagFor(id: string): { main: string; sub: string } | null {
    const d = this.dispensers.get(id);
    if (!d || d.kind !== 'burette') return null;
    return buretteTag(d.bundle.scaleReadingMl(), this.host.volumeMl(id));
  }

  /** Next camera view of the station (B key): tip + flask -> the whole stand -> the burette reading. */
  public nextView(): ViewPlan | null {
    const vessels = this.host.vessels();
    const bur = this.burette ? vessels.get(this.burette) : undefined;
    const d = bur ? this.dispensers.get(bur.vesselState.id) : undefined;
    if (!bur || !d) return null;
    const views: ViewPlan[] = [
      { target: new THREE.Vector3(STATION_X, d.tipY + this.delta - 3, STATION_Z), distance: 46 },
      { target: new THREE.Vector3(STATION_X, 48, STATION_Z), distance: 150, front: true },
      { target: readingTarget(bur), distance: 26, front: true },
    ];
    const plan = views[this.viewIdx % views.length];
    this.viewIdx++;
    return plan;
  }

  public resetView() {
    this.viewIdx = 0;
  }

  // ---------------------------------------------------------------- per frame
  public update(dt: number, time: number) {
    this.time = time;
    try {
      this.updateStation(dt);
    } catch (e) {
      warnOnce('station update failed', e);
    }
    for (const d of this.dispensers.values()) {
      try {
        this.updateDispenser(d, dt, time);
      } catch (e) {
        warnOnce(`dispenser ${d.bundle.vesselState.id} update failed`, e);
      }
    }
  }

  private underTargets(self: string): UnderTarget[] {
    const out: UnderTarget[] = [];
    for (const [vid, v] of this.host.vessels()) {
      if (vid === self || v.isBurst() || !!v.profile.tip || v.vesselState.isSealed) continue; // a stoppered flask takes nothing
      const p = v.profile;
      const g = v.group.position;
      out.push({
        id: vid,
        x: g.x,
        z: g.z,
        rimInnerR: p.rimInnerRadius,
        rimTopY: g.y + p.rimY + p.baseOffsetY,
        bottomY: g.y + p.innerBottomY + p.baseOffsetY,
      });
    }
    return out;
  }

  private ensureSink(d: Dispenser, targetId: string | null): FlowSink | null {
    if (d.sink && d.sinkTarget === targetId) return d.sink;
    d.endSink();
    const sink = this.host.openDrain(d.bundle.vesselState.id, targetId, d.kind === 'funnel');
    d.sink = sink;
    d.sinkTarget = targetId;
    return sink;
  }

  private closeWith(d: Dispenser, message: string) {
    d.open = 0;
    d.tapT = -1;
    d.drip.acc = 0;
    d.flow = 0;
    this.host.notify(message, 'info');
  }

  private updateDispenser(d: Dispenser, dt: number, time: number) {
    const b = d.bundle;
    const id = b.vesselState.id;
    if (!this.host.vessels().has(id)) return;
    const held = this.host.heldVesselId() === id;
    if (held) {
      d.open = 0;
      d.tapT = -1;
    }
    if (d.tapT >= 0) {
      d.tapT += dt;
      if (d.tapT > TAP_S) d.tapT = -1;
    }
    d.easeGlow(dt);
    const eff = Math.max(d.open, d.tapT >= 0 ? tapProfile(d.tapT) : 0);
    if (Math.abs(eff - d.shown) > 1e-3) {
      d.shown = eff;
      b.setStopcock(eff);
    }
    const q = held ? 0 : stopcockFlow(eff, d.qMax);

    // tip + what is under it
    b.group.updateWorldMatrix(true, false);
    const tipW = this.tmp.set(0, d.tipY, 0).applyMatrix4(b.group.matrixWorld).clone();
    const targetId = targetUnderTip(tipW, this.underTargets(id));
    const target = targetId ? this.host.vessels().get(targetId) ?? null : null;

    const wantsFlow = q > 0 || d.drip.acc >= STOPCOCK_DROP_ML - 1e-9;
    if (!wantsFlow && d.drip.acc <= 1e-6) {
      d.idle += dt;
      d.hadBottom = false;
      d.flow = 0;
      if (d.sink && d.idle > 0.6) d.endSink();
    } else d.idle = 0;
    if (eff <= 0 && d.tapT < 0) d.spillWarned = false;

    // funnel: remember that a bottom layer was present when the stopcock opened (see the interface check below)
    const snap = b.lastSnapshot;
    if (d.kind === 'funnel' && snap && q > 0 && !d.hadBottom) {
      if (snap.layers.filter((l) => l.volume_ml > 0.05).length >= 2) d.hadBottom = true;
    }

    let flowNow = 0;
    let blocked: 'full' | 'empty' | null = null;
    let drops = 0;
    if (wantsFlow) {
      const sink = this.ensureSink(d, targetId);
      if (!sink) {
        if (!d.spillWarned) {
          d.spillWarned = true;
          this.host.notify("Nothing to drain into.", 'warning');
        }
      } else {
        if (!targetId && !d.spillWarned) {
          d.spillWarned = true;
          this.host.notify(`${b.vesselState.name} is dripping onto the bench — stand a flask under the tip.`, 'warning');
        }
        if (q >= STREAM_FROM_ML_S) {
          const want = q * dt + d.drip.acc;
          d.drip.acc = 0;
          const got = sink.push(want);
          flowNow = got / Math.max(dt, 1e-4);
          if (got < want * 0.98) blocked = sink.limit() ?? 'empty';
        } else {
          drops = stepDrip(d.drip, q, dt);
          let landed = 0;
          for (let i = 0; i < drops; i++) {
            const got = sink.push(STOPCOCK_DROP_ML);
            if (got <= 0.005) {
              blocked = sink.limit() ?? 'empty';
              break;
            }
            landed++;
            if (got < STOPCOCK_DROP_ML - 1e-6) blocked = sink.limit() ?? 'empty';
          }
          drops = landed;
          flowNow = (drops * STOPCOCK_DROP_ML) / Math.max(dt, 1e-4);
          if (landed === 0 && q > 0) flowNow = 0;
        }
      }
    }
    d.flow += (flowNow - d.flow) * Math.min(1, dt * 6);
    if (flowNow === 0 && d.flow < 1e-3) d.flow = 0;

    // safety: nothing left / nowhere to go
    if (blocked === 'empty') this.closeWith(d, `${b.vesselState.name} is empty — stopcock closed.`);
    else if (blocked === 'full') this.closeWith(d, `${target?.vesselState.name ?? 'The vessel'} is full — stopcock closed.`);
    if (d.kind === 'funnel' && eff > 0 && d.hadBottom && snap && interfaceReached(snap.layers)) {
      d.hadBottom = false;
      this.closeWith(d, 'The interface reached the stopcock — closed. Open it again to run the upper layer out.');
    }

    // ---- visuals (never throw out of the render loop)
    try {
      this.updateVisuals(d, dt, time, tipW, target, q, flowNow, drops);
    } catch (e) {
      warnOnce('stopcock visuals failed', e);
      d.stream = d.drops = null;
    }
  }

  private updateVisuals(d: Dispenser, dt: number, time: number, tipW: THREE.Vector3, target: VesselBundle | null, q: number, flowNow: number, drops: number) {
    const b = d.bundle;
    const hex = b.getLiquidColorHex();
    d.colourT -= dt;
    const dropRegime = q < STREAM_FROM_ML_S;
    // the drop swelling at the tip (drop regime only)
    const fill = pendantFill(d.drip);
    d.pendant.visible = dropRegime && fill > 0.04 && !this.lifted.has(b.vesselState.id);
    if (d.pendant.visible) {
      const s = Math.cbrt(fill);
      d.pendant.scale.setScalar(s);
      const tip = b.tipLocal() ?? new THREE.Vector3();
      d.pendant.position.set(tip.x, tip.y - 0.05 - 0.2 * s, tip.z);
      if (d.colourT <= 0) d.pendantMat.color.copy(tintFor(hex));
    }
    // falling drops
    if (drops > 0 || d.drops) {
      if (!d.drops) d.drops = new DropFall(this.host.scene, hex);
      for (let i = 0; i < drops; i++) d.drops.drop(tipW.clone().add(new THREE.Vector3(0, -0.2, 0)));
      d.drops.update(dt, time, target);
      if (!d.drops.alive && drops === 0 && d.idle > 1) {
        d.drops.dispose();
        d.drops = null;
      }
    }
    // continuous stream
    const streaming = !dropRegime && flowNow > 0.005;
    if (streaming && !d.stream) d.stream = new PourStream(this.host.scene, hex);
    if (d.stream) {
      if (d.colourT <= 0) d.stream.setColor(hex);
      const floor = target ? target.group.position.y + target.surfaceLocalY() : this.groundAt(tipW.x, tipW.z) ?? 0;
      const land = new THREE.Vector3(tipW.x, Math.min(tipW.y - 0.5, floor), tipW.z);
      d.stream.update(dt, time, { flowMlS: streaming ? flowNow : 0, lip: tipW, land, target, mouthR: Math.max(0.3, d.tipR) });
      if (!d.stream.alive) {
        d.stream.dispose();
        d.stream = null;
      }
    }
    if (d.colourT <= 0) d.colourT = 0.3;
    this.host.markDirty();
  }
}

/** Near-colourless liquids get the faint blue-white drop tint used by the pipette drops. */
function tintFor(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  return lum > 0.82 ? new THREE.Color(0xeef6fb) : c;
}

/** Where the camera looks to read the burette: the liquid level (or the zero mark when empty), on the axis. */
function readingTarget(b: VesselBundle): THREE.Vector3 {
  const w = b.group.localToWorld(b.readingAnchorLocal(-1));
  w.x = b.group.position.x;
  w.y = Math.max(30, Math.min(b.group.position.y + b.height - 8, w.y));
  return w;
}
