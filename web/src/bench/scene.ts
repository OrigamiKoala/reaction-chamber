import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GlasswareMeshBundle, VesselBundle, createGlassware, setDefaultOpticsTables } from './glassware';
import { VesselState, BottleState } from '../types';
import { OpticsTables, ReagentCatalogEntry, VesselSnapshot } from '../types/sim';
import { Thermometer, PHMeter, Balance, PressureGauge, HotPlate, Burner } from '../equipment';
import { THERMOMETER_RADIUS } from '../equipment/thermometer';
import { PH_PROBE_RADIUS } from '../equipment/ph_meter';
import { HOTPLATE_TOP_Y } from '../equipment/hotplate';
import { BURNER_TOP_Y } from '../equipment/burner';
import { BottleAssembly, BottleInput, createBottleAssembly, entryToBottleInput, defaultContentColor, looksLikeMetal } from '../equipment/bottle';
import { buildLabRoom, LabRoom, BENCH } from './lab_room';
import { ReagentShelf } from './shelf';
import { Animator, AnimTask, PourSource, dropsTask, ease, moveTask, once, pourTask, solidTask } from './animations';
import { setParticleViewport } from '../render/particles';
import {
  DropPlace,
  DropSpot,
  FlowForm,
  FlowSink,
  FlowSourceRef,
  HandlingController,
  HandlingHost,
  PourState,
  nearestFreeSpot,
} from './handling';
import { GasTubes, GasHost } from './gas_collection';
import { FilterRigs } from './filtration';
import { STATION_FOOTPRINT, TitrationHost, TitrationRig, ViewPlan } from './titration';

/** Bench instruments the user can click (right panel shows their controls). */
export type InstrumentId = 'hotplate' | 'balance' | 'phmeter' | 'thermometer' | 'gauge' | 'burner';

type PickHit = { type: 'vessel' | 'bottle' | 'balance-tare' | 'stopcock' | 'stirknob' | 'instrument'; id: string };

/** Bench instruments owned by the scene. UI reads `readout()` values; never decides chemistry. */
export interface BenchInstruments {
  thermometer: Thermometer;
  phMeter: PHMeter;
  balance: Balance;
  pressureGauge: PressureGauge;
  hotPlate: HotPlate;
  burner: Burner;
}

interface Footprint {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

interface ProbeMotion {
  bundle: VesselBundle | null;
  t: number;
  fromPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
}

/** Walk keys -> [forward, right]. Shift is a speed modifier (no movement of its own). */
const WALK_KEYS: Record<string, [number, number]> = {
  KeyW: [1, 0], ArrowUp: [1, 0],
  KeyS: [-1, 0], ArrowDown: [-1, 0],
  KeyA: [0, -1], ArrowLeft: [0, -1],
  KeyD: [0, 1], ArrowRight: [0, 1],
  ShiftLeft: [0, 0], ShiftRight: [0, 0],
};
const WALK_SPEED = 55; // cm/s
const HOTPLATE_POS = new THREE.Vector3(0, 0, 6);
const PH_METER_POS = new THREE.Vector3(46, 0, -14);
const BALANCE_POS = new THREE.Vector3(80, 0, -4);
const BURNER_POS = new THREE.Vector3(-80, 0, -12);

/**
 * Photoreal-leaning lab bench. 1 unit = 1 cm. Bench top at y = 0.
 * See BENCH_REWORK_PLAN.md ("Track A notes") for behaviour of the public API.
 */
export class BenchScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;
  /** 'bottle' ids are catalog reagent ids (addReagentBottle) or PubChem BottleState ids (addBottle). */
  public onSelectObject?: (type: 'vessel' | 'bottle' | 'instrument', id: string) => void;
  /** Click on empty bench / background (not a drag). */
  public onDeselect?: () => void;
  public instruments: BenchInstruments;
  public onPourRequested?: (sourceId: string, targetId: string) => void;
  /** Contextual one-line hint ('Drag to pick up', 'Drag up to tilt · release to stop pouring') or null to clear. */
  public onHint?: (text: string | null) => void;
  /** Live readout while a carried container is locked over a vessel (null when not). */
  public onPourState?: (s: PourState | null) => void;
  /** Short toast-worthy messages from manual handling ('Beaker is full'). */
  public onNotify?: (message: string, kind?: 'info' | 'warning') => void;
  /** Opens the chemistry side of a manual pour (Lab.openFlow). Return null to refuse (nothing is poured). */
  public flowProvider?: (src: FlowSourceRef, targetId: string, form: FlowForm) => FlowSink | null;
  /** A vessel was picked up from the hot plate / balance pan (it is no longer heated / weighed). */
  public onVesselLifted?: (id: string, from: DropPlace) => void;
  /** A carried vessel came to rest. For 'hotplate' the handler must call `placeVesselOnHotPlate(id)` (Lab.moveToHotPlate). */
  public onVesselPlaced?: (id: string, place: DropPlace) => void;
  /** Total mass (glass + contents, g) of a vessel for the balance. Falls back to the snapshot's contents mass. */
  public massProvider?: (id: string) => number;
  /** Opens a drain of a burette / separatory funnel into a vessel (null target = onto the bench). Lab.openDrain; null refuses. */
  public drainProvider?: (srcId: string, targetId: string | null, bottom: boolean) => FlowSink | null;
  /** Engine volume (mL) of a vessel (Lab.volumeMl). */
  public volumeProvider?: (id: string) => number;
  /** The stirrer knob on the titration station was clicked (Lab.setStir). */
  public onStirrerToggle?: (id: string, on: boolean) => void;
  /** A vessel left the stirrer plate (Lab stops its stirring). */
  public onStirrerVacated?: (id: string) => void;
  /** Titration station: burette clamp, stirrer + tile, stopcock levers, separatory funnel stand. */
  public titration!: TitrationRig;
  /** Chemistry side of pipetting (draw / dispense between vessels), wired by main.ts to the Lab. */
  public pipetteLab?: import('./pipetting').PipetteLab | null;

  private container: HTMLElement;
  private room: LabRoom;
  private glasswareMap = new Map<string, VesselBundle>();
  private shelf: ReagentShelf;
  private animator = new Animator();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private opticsTables: OpticsTables | null = null;

  private slots: THREE.Vector3[] = [];
  private slotOwner: (string | null)[] = [];
  private vesselSlot = new Map<string, number>();
  private hotPlateVessel: string | null = null;
  private instrumentProxies: THREE.Mesh[] = [];
  private panVessel: string | null = null;
  private pan: { center: THREE.Vector3; radius: number; topY: number } | null = null;
  private handling!: HandlingController;
  /** Delivery tubes + gas collector visuals (see gas_collection.ts). */
  public gas!: GasTubes;
  /** Funnels sitting on flasks + filtrate drips (see filtration.ts). */
  public filters!: FilterRigs;
  private pulse: { id: string; t: number } | null = null;
  private selectedId: string | null = null;
  private hoverKey: string | null = null;
  private hoverDirty = false;
  private pointerInside = false;
  private downPos: { x: number; y: number; t: number; button: number } | null = null;

  private thermoMotion: ProbeMotion;
  private phMotion: ProbeMotion;
  private thermoPark = { pos: new THREE.Vector3(26, THERMOMETER_RADIUS + 0.05, 7), up: new THREE.Vector3(1, 0, 0) };
  private phPark = { pos: new THREE.Vector3(33, PH_PROBE_RADIUS + 0.05, 2.5), up: new THREE.Vector3(0.97, 0, -0.1).normalize() };

  private transient = new Set<{ object: THREE.Object3D; setRenderOrderBase: (b: number) => void }>();
  private cameraTween: AnimTask | null = null;
  private moveKeys = new Set<string>();
  private time = 0;
  private lastFrame = performance.now();
  private shadowTimer = 0;
  private tickWarned = new Set<string>();
  private shadowDirty = true;
  private rafId = 0;
  private resizeObserver: ResizeObserver;
  private footprints: Footprint[];

  constructor(container: HTMLElement) {
    this.container = container;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, w / h, 4, 900);
    this.camera.position.set(0, 50, 102);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);
    setParticleViewport(h * this.renderer.getPixelRatio(), this.camera.fov);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 15, -8);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 16;
    this.controls.maxDistance = 190;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = 1.38;
    this.controls.minAzimuthAngle = -1.35;
    this.controls.maxAzimuthAngle = 1.35;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.9;
    this.controls.update();

    this.room = buildLabRoom(this.scene, this.renderer);
    this.shelf = new ReagentShelf(this.scene, this.room.shelfSlots);
    this.shelf.onChange = () => (this.shadowDirty = true);

    // instruments
    const thermometer = new Thermometer();
    const phMeter = new PHMeter();
    const balance = new Balance();
    const pressureGauge = new PressureGauge();
    const hotPlate = new HotPlate();
    const burner = new Burner();
    hotPlate.group.position.copy(HOTPLATE_POS);
    phMeter.group.position.copy(PH_METER_POS);
    phMeter.group.rotation.y = -0.35;
    balance.group.position.copy(BALANCE_POS);
    balance.group.rotation.y = -0.3;
    burner.group.position.copy(BURNER_POS);
    burner.group.rotation.y = 0.4;
    this.scene.add(thermometer.group, phMeter.group, balance.group, pressureGauge.group, hotPlate.group, burner.group);
    this.instrumentProxies = [
      this.addInstrumentProxy('hotplate', hotPlate.group, null),
      this.addInstrumentProxy('balance', balance.group, null),
      this.addInstrumentProxy('phmeter', phMeter.group, phMeter.probe),
      this.addInstrumentProxy('phmeter', phMeter.probe, null),
      this.addInstrumentProxy('thermometer', thermometer.group, null),
      this.addInstrumentProxy('gauge', pressureGauge.group, null),
      this.addInstrumentProxy('burner', burner.group, null, new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, BURNER_TOP_Y, 5))),
    ];
    this.instruments = { thermometer, phMeter, balance, pressureGauge, hotPlate, burner };
    this.thermoMotion = { bundle: null, t: 1, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion() };
    this.phMotion = { bundle: null, t: 1, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion() };
    this.updateProbes(0, true);

    this.footprints = [
      { x0: -9.5, x1: 9.5, z0: HOTPLATE_POS.z - 12, z1: HOTPLATE_POS.z + 12 },
      { x0: 36, x1: 57, z0: -26, z1: -2 },
      { x0: 67, x1: 93, z0: -19, z1: 11 },
      { x0: -97, x1: -73, z0: -18, z1: 10 },
      STATION_FOOTPRINT,
    ];
    this.buildSlots();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);
    window.addEventListener('resize', this.onResize);
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerleave', this.onPointerLeave);
    // capture phase on the parent: runs before OrbitControls so a press on a bottle / vessel can keep the camera still
    container.addEventListener('pointerdown', this.onPointerDownCapture, true);
    this.refreshPan();
    this.handling = new HandlingController(this.makeHandlingHost());
    this.gas = new GasTubes(this.makeGasHost());
    this.filters = new FilterRigs({ scene: this.scene, vessels: () => this.glasswareMap, markDirty: () => (this.shadowDirty = true) });
    this.titration = new TitrationRig(this.makeTitrationHost());

    this.animate();
  }

  // ---------------------------------------------------------------- layout
  private buildSlots() {
    const front = 12;
    const back = -15;
    const cand: THREE.Vector3[] = [];
    for (const x of [-24, 24, -39, 39, -54, 54, -69, 69]) cand.push(new THREE.Vector3(x, 0, front));
    for (const x of [0, -15, 15, -30, 30, -45, 45, -60, 60]) cand.push(new THREE.Vector3(x, 0, back));
    const margin = 7;
    this.slots = cand.filter(
      (p) => !this.footprints.some((f) => p.x > f.x0 - margin && p.x < f.x1 + margin && p.z > f.z0 - margin && p.z < f.z1 + margin)
    );
    this.slotOwner = this.slots.map(() => null);
  }

  /** A bench slot is usable when nobody stands on it (vessels may have been dropped anywhere by hand). */
  private slotFree(i: number, id: string, r: number): boolean {
    if (this.slotOwner[i] !== null) return false;
    const s = this.slots[i];
    for (const [vid, b] of this.glasswareMap) {
      if (vid === id) continue;
      if (Math.hypot(b.group.position.x - s.x, b.group.position.z - s.z) < r + Math.max(b.footprint, b.profile.maxOuterRadius) + 1) return false;
    }
    return true;
  }

  private allocSlot(id: string, r = 5): number {
    let idx = -1;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slotFree(i, id, r)) {
        idx = i;
        break;
      }
    }
    if (idx < 0) {
      // overflow: add an extra slot further along the back
      const n = this.slots.length;
      this.slots.push(new THREE.Vector3(-75 + (n % 6) * 14, 0, 22));
      this.slotOwner.push(null);
      idx = this.slots.length - 1;
    }
    this.slotOwner[idx] = id;
    this.vesselSlot.set(id, idx);
    return idx;
  }

  private freeSlotOf(id: string) {
    const idx = this.vesselSlot.get(id);
    if (idx !== undefined) {
      this.slotOwner[idx] = null;
      this.vesselSlot.delete(id);
    }
  }

  private hotPlateTopWorld(): THREE.Vector3 {
    return this.instruments.hotPlate.topLocal.clone().add(HOTPLATE_POS);
  }

  private groundAt(x: number, z: number): number {
    const rig = this.titration?.groundAt(x, z);
    if (rig !== null && rig !== undefined) return rig;
    const top = this.hotPlateTopWorld();
    if (Math.abs(x - top.x) < 9 && Math.abs(z - top.z) < 9) return HOTPLATE_TOP_Y;
    const p = this.pan;
    if (p && Math.hypot(x - p.center.x, z - p.center.z) < p.radius + 0.3) return p.topY;
    return 0;
  }

  private refreshPan() {
    try {
      this.pan = this.instruments.balance.panWorld();
    } catch (e) {
      this.pan = null;
    }
  }

  // ---------------------------------------------------------------- vessels
  public addVessel(state: VesselState, posX?: number, posZ?: number): GlasswareMeshBundle {
    void posX;
    void posZ; // positions are auto-allocated (real-scale bench slots)
    const existing = this.glasswareMap.get(state.id);
    if (existing) return existing;
    const bundle = createGlassware(state);
    let mount: THREE.Vector3 | null = null;
    try {
      mount = this.titration.onVesselAdded(bundle); // a burette goes straight into the station clamp
    } catch (e) {
      console.warn('[bench] titration.onVesselAdded failed', e);
    }
    if (mount) bundle.group.position.copy(mount);
    else {
      const idx = this.allocSlot(state.id, Math.max(bundle.footprint, bundle.profile.maxOuterRadius));
      bundle.group.position.copy(this.slots[idx]);
    }
    bundle.group.rotation.y = 0;
    this.scene.add(bundle.group);
    this.glasswareMap.set(state.id, bundle);
    this.shadowDirty = true;
    return bundle;
  }

  public removeVessel(id: string) {
    const bundle = this.glasswareMap.get(id);
    if (!bundle) return;
    this.handling.onVesselRemoved(id);
    this.gas.removeVessel(id);
    this.filters.removeVessel(id);
    this.titration.onVesselRemoved(id);
    if (this.selectedId === id) this.setSelectedVessel(null);
    if (this.hotPlateVessel === id) this.hotPlateVessel = null;
    if (this.panVessel === id) this.panVessel = null;
    this.freeSlotOf(id);
    this.glasswareMap.delete(id);
    bundle.dispose();
    this.scene.remove(bundle.group);
    this.shadowDirty = true;
  }

  public getGlassware(id: string): GlasswareMeshBundle | undefined {
    return this.glasswareMap.get(id);
  }

  public getAllVessels(): VesselState[] {
    return Array.from(this.glasswareMap.values()).map((g) => g.vesselState);
  }

  // ---------------------------------------------------------------- bottles
  /** Place a catalog reagent bottle on the (capped, LRU) reagent shelf. id = entry.id */
  public addReagentBottle(entry: ReagentCatalogEntry): void {
    this.shelf.add(entryToBottleInput(entry));
  }

  /** PubChem import: generic labelled bottle on the shelf (positions are auto-allocated); `phase` = its phase at room temperature (jar for solids). */
  public addBottle(bottle: BottleState, phase: 'solid' | 'liquid' | 'gas' = 'liquid', posX?: number, posZ?: number) {
    void posX;
    void posZ;
    const solid = phase === 'solid';
    this.shelf.add({
      id: bottle.id,
      name: bottle.name,
      formula: bottle.formula,
      ghs: bottle.ghs,
      signal_word: bottle.ghs && bottle.ghs.length ? 'Warning' : '',
      bottle_colour: 'clear',
      form: solid ? 'solid' : 'solution',
      by_mass: solid,
      colorHex: bottle.color,
    });
  }

  /** Data-driven contents colour for a shelved bottle (remembered even if the bottle is currently evicted). */
  public setBottleContentColor(id: string, hex: string): void {
    const m = this.shelf.getMeta(id);
    if (m) m.colorHex = hex;
    this.shelf.get(id)?.setContentColor(hex);
  }

  // ---------------------------------------------------------------- optics
  public setOpticsTables(tables: OpticsTables) {
    this.opticsTables = tables;
    setDefaultOpticsTables(tables);
  }

  public getOpticsTables(): OpticsTables | null {
    return this.opticsTables;
  }

  // ---------------------------------------------------------------- selection + instruments
  /** Highlight + attach thermometer / pH probe (and pressure gauge if sealed) to this vessel. */
  public setSelectedVessel(id: string | null): void {
    const bundle = id ? this.glasswareMap.get(id) ?? null : null;
    const newId = bundle ? id : null;
    for (const [vid, b] of this.glasswareMap) b.setSelected(vid === newId);
    const { thermometer, phMeter, pressureGauge } = this.instruments;
    // re-selecting the same vessel refreshes the seal-dependent gauge (UI calls this after sealing)
    const sealed = !!bundle && (bundle.vesselState.isSealed || this.isSealed(bundle));
    pressureGauge.attachTo(sealed ? bundle : null);
    if (bundle && !bundle.lastSnapshot) bundle.effects.setSealed(bundle.vesselState.isSealed);
    if (newId === this.selectedId) return;
    this.selectedId = newId;
    thermometer.attachTo(bundle);
    phMeter.attachTo(bundle);
    this.startProbeMotion(this.thermoMotion, thermometer.group, bundle);
    this.startProbeMotion(this.phMotion, phMeter.probe, bundle);
  }

  private isSealed(b: VesselBundle): boolean {
    return b.lastSnapshot ? b.lastSnapshot.sealed && !b.lastSnapshot.burst : b.vesselState.isSealed;
  }

  private startProbeMotion(m: ProbeMotion, obj: THREE.Object3D, bundle: VesselBundle | null) {
    obj.updateWorldMatrix(true, false);
    obj.getWorldPosition(m.fromPos);
    obj.getWorldQuaternion(m.fromQuat);
    m.bundle = bundle;
    m.t = 0;
  }

  /** Feed the selected vessel's snapshot to the instruments (lagged readouts). */
  public updateInstruments(snap: VesselSnapshot, dtSeconds: number): void {
    const { thermometer, phMeter, pressureGauge, hotPlate, burner } = this.instruments;
    const b = this.selectedId ? this.glasswareMap.get(this.selectedId) : undefined;
    // pH bulb must be under the surface (and the probe must have arrived)
    if (b) {
      const tip = b.probeLocal('ph', PH_PROBE_RADIUS).tip;
      phMeter.setImmersed(b.surfaceLocalY() - tip.y > 0.5 && this.phMotion.t >= 1);
      const sealed = snap.sealed && !snap.burst;
      pressureGauge.attachTo(sealed ? b : null);
    } else {
      phMeter.setImmersed(false);
    }
    thermometer.update(snap, dtSeconds);
    phMeter.update(snap, dtSeconds);
    pressureGauge.update(snap, dtSeconds);
    hotPlate.update(snap, dtSeconds);
    burner.update(snap, dtSeconds);
  }

  private probeTarget(m: ProbeMotion, slot: 'thermo' | 'ph', radius: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
    const b = m.bundle;
    if (b && this.glasswareMap.has(b.vesselState.id) && !b.isBurst()) {
      b.group.updateWorldMatrix(true, false);
      const { tip, up } = b.probeLocal(slot, radius);
      outPos.copy(tip).applyMatrix4(b.group.matrixWorld);
      const upW = up.clone().transformDirection(b.group.matrixWorld);
      outQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upW);
      if (slot === 'thermo') this.spinToCamera(outPos, upW, outQuat);
    } else {
      const park = slot === 'thermo' ? this.thermoPark : this.phPark;
      outPos.copy(park.pos);
      outQuat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), park.up);
      if (slot === 'thermo') {
        // scale side up
        const spin = new THREE.Quaternion().setFromAxisAngle(park.up, -Math.PI / 2);
        outQuat.premultiply(spin);
      }
    }
  }

  /** Rotate about the probe axis so its local +Z (scale side) faces the camera. */
  private spinToCamera(pos: THREE.Vector3, up: THREE.Vector3, q: THREE.Quaternion) {
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const toCam = this.camera.position.clone().sub(pos);
    toCam.addScaledVector(up, -toCam.dot(up));
    if (toCam.lengthSq() < 1e-6) return;
    toCam.normalize();
    const ang = Math.atan2(new THREE.Vector3().crossVectors(z, toCam).dot(up), z.dot(toCam));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(up, ang));
  }

  private tmpPos = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();

  private updateProbes(dt: number, snap = false) {
    const { thermometer, phMeter } = this.instruments;
    const run = (m: ProbeMotion, slot: 'thermo' | 'ph', radius: number, apply: (p: THREE.Vector3, q: THREE.Quaternion) => void) => {
      this.probeTarget(m, slot, radius, this.tmpPos, this.tmpQuat);
      if (snap) m.t = 1;
      if (m.t < 1) {
        m.t = Math.min(1, m.t + dt / 1.0);
        const k = ease.inOut(m.t);
        const p = m.fromPos.clone().lerp(this.tmpPos, k);
        p.y += Math.sin(k * Math.PI) * 18;
        const q = m.fromQuat.clone().slerp(this.tmpQuat, k);
        apply(p, q);
        this.shadowDirty = true;
      } else {
        apply(this.tmpPos, this.tmpQuat);
      }
    };
    run(this.thermoMotion, 'thermo', THERMOMETER_RADIUS, (p, q) => {
      thermometer.group.position.copy(p);
      thermometer.group.quaternion.copy(q);
    });
    run(this.phMotion, 'ph', PH_PROBE_RADIUS, (p, q) => phMeter.setProbeWorldPose(p, q));
    // pressure gauge rides on the stopper of the selected sealed vessel
    const b = this.selectedId ? this.glasswareMap.get(this.selectedId) : undefined;
    const g = this.instruments.pressureGauge;
    if (b && g.group.visible) {
      b.group.updateWorldMatrix(true, false);
      const p = new THREE.Vector3(0, b.stopperTopLocal() - 0.6, 0).applyMatrix4(b.group.matrixWorld);
      g.group.position.copy(p);
      g.group.quaternion.copy(b.group.quaternion);
      g.faceToward(this.camera.position);
    }
  }

  // ---------------------------------------------------------------- hot plate
  /** Slide a vessel onto the hot plate (previous occupant returns to a free bench spot).
   *  Returns the id of the vessel that was displaced, or null. id=null clears the plate. */
  public placeVesselOnHotPlate(id: string | null): string | null {
    const prev = this.hotPlateVessel;
    if (id !== null && !this.glasswareMap.has(id)) return null;
    if (id !== null && prev === id) return null;
    if (id !== null && this.panVessel === id) this.panVessel = null;
    if (id !== null) this.titration.vesselMoved(id);
    let displaced: string | null = null;
    if (prev && this.glasswareMap.has(prev)) {
      const pb = this.glasswareMap.get(prev)!;
      const idx = this.allocSlot(prev);
      this.animator.add(moveTask(pb.group, this.slots[idx].clone(), () => pb.liquid.slosh(0.04), HOTPLATE_TOP_Y + pb.height * 0.2));
      displaced = prev;
    }
    this.hotPlateVessel = null;
    if (id !== null) {
      const b = this.glasswareMap.get(id)!;
      this.freeSlotOf(id);
      this.hotPlateVessel = id;
      const to = this.hotPlateTopWorld();
      // already set down on the plate by hand: just snap, no lift-and-slide hop
      if (b.group.position.distanceTo(to) < 0.6) b.group.position.copy(to);
      else this.animator.add(moveTask(b.group, to, () => b.liquid.slosh(0.05), HOTPLATE_TOP_Y));
    }
    this.shadowDirty = true;
    return displaced;
  }

  public getHotPlateVesselId(): string | null {
    return this.hotPlateVessel;
  }

  // ---------------------------------------------------------------- additions
  private registerTransient(asm: BottleAssembly) {
    const t = { object: asm.group, setRenderOrderBase: asm.setRenderOrderBase };
    this.transient.add(t);
    return () => this.transient.delete(t);
  }

  /** A temporary bottle on the bench beside the target (for reagents not on the shelf). */
  private tempBottle(id: string, target: VesselBundle, colorHex: string, forceKind?: 'liquid' | 'dropper' | 'jar'): BottleAssembly {
    const known = this.shelf.getMeta(id);
    // known reagent: its own data drives the look; unknown: generic clear bottle tinted by the passed colour
    const input: BottleInput = known ? { ...known } : { id, name: prettyId(id), formula: '', bottle_colour: 'clear', form: 'solution', colorHex };
    if (forceKind === 'liquid') {
      input.dropper = false;
      if (input.form === 'solid') input.form = 'solution';
      input.by_mass = false;
    }
    const asm = createBottleAssembly(input);
    const p = target.group.position;
    const side = p.x > 0 ? 1 : -1;
    let x = p.x + side * 18;
    if (x > BENCH.xMax - 10 || x < BENCH.xMin + 10) x = p.x - side * 18;
    asm.group.position.set(x, this.groundAt(x, p.z + 4), Math.min(BENCH.zMax - 6, p.z + 4));
    this.scene.add(asm.group);
    return asm;
  }

  /**
   * At the default bench distance a 7 cm beaker is only ~60 px wide, so a few mL of clear liquid or a spatula of
   * powder is a speck. When something is added to a vessel that is far from the camera, glide in (never out) so the
   * contents are actually visible; the user can still orbit/zoom freely.
   */
  private frameForAddition(target: VesselBundle) {
    const d = this.camera.position.distanceTo(target.group.position);
    if (d > 80 && !this.downPos) this.focusVessel(target.vesselState.id, 58);
  }

  public animatePour(sourceGroupId: string, targetGroupId: string, colorHex: string, onComplete?: () => void) {
    const done = guarded(onComplete);
    try {
      const target = this.glasswareMap.get(targetGroupId);
      if (!target || target.isBurst() || sourceGroupId === targetGroupId) {
        done();
        return;
      }
      this.frameForAddition(target);
      const vessel = this.glasswareMap.get(sourceGroupId);
      if (vessel && !this.animator.isBusy(vessel.group) && !vessel.isBurst()) {
        const lip = vessel.lipLocal();
        const color = vessel.lastSnapshot ? vessel.getLiquidColorHex() : colorHex || vessel.getLiquidColorHex();
        const src: PourSource = {
          object: vessel.group,
          lipLocal: lip,
          lipHeight: lip.y,
          bodyRadius: vessel.profile.maxOuterRadius,
          isBottle: false,
          fillHeight: vessel.surfaceLocalY(),
          groundY: vessel.group.position.y,
          onStart: () => vessel.setRackVisible(false),
          onEnd: () => {
            vessel.setRackVisible(true);
            this.shadowDirty = true;
          },
        };
        this.animator.add(pourTask(this.scene, src, target, color, done), done);
        return;
      }
      let asm = this.shelf.get(sourceGroupId);
      let temporary = false;
      if (asm && (this.animator.isBusy(asm.group) || this.handling.isHeld(sourceGroupId))) asm = undefined; // in someone's hand
      if (asm && asm.kind !== 'liquid') asm = undefined; // pour from a jar/dropper: use a pouring bottle
      if (!asm) {
        asm = this.tempBottle(sourceGroupId, target, colorHex, 'liquid');
        temporary = true;
      } else {
        this.shelf.touch(sourceGroupId);
      }
      const a = asm;
      let unregister: (() => void) | null = null;
      const color = pickColor(colorHex, a.contentHex);
      const src: PourSource = {
        object: a.group,
        lipLocal: a.lipLocal,
        lipHeight: a.lipLocal.y,
        bodyRadius: a.radius,
        isBottle: true,
        fillHeight: 0,
        groundY: a.group.position.y,
        temporary,
        onStart: () => {
          a.cap.visible = false;
          if (!temporary) this.shelf.setBusy(sourceGroupId, true);
          else unregister = this.registerTransient(a);
        },
        onEnd: () => {
          a.cap.visible = true;
          this.shadowDirty = true;
          if (temporary) {
            unregister?.();
            a.dispose();
          } else this.shelf.setBusy(sourceGroupId, false);
        },
      };
      this.animator.add(pourTask(this.scene, src, target, color, done), done);
    } catch (e) {
      console.error('[bench] animatePour failed', e);
      done();
    }
  }

  /** Dropper bottle -> pipette drops into target. */
  public animateDrops(sourceBottleId: string, targetId: string, drops: number, colorHex: string, onComplete?: () => void): void {
    const done = guarded(onComplete);
    try {
      const target = this.glasswareMap.get(targetId);
      if (!target || target.isBurst()) {
        done();
        return;
      }
      this.frameForAddition(target);
      const asm = this.shelf.get(sourceBottleId);
      let start: THREE.Vector3;
      let fromAbove = false;
      let onStart: (() => void) | undefined;
      let onEnd: (() => void) | undefined;
      if (asm && asm.dropperParts && asm.dropperParts.visible) {
        this.shelf.touch(sourceBottleId);
        start = new THREE.Vector3(0, asm.lipLocal.y - 7, 0);
        asm.group.localToWorld(start);
        const parts = asm.dropperParts;
        onStart = () => {
          parts.visible = false;
          this.shelf.setBusy(sourceBottleId, true);
        };
        onEnd = () => {
          parts.visible = true;
          this.shelf.setBusy(sourceBottleId, false);
        };
      } else {
        start = target.group.position.clone();
        fromAbove = true;
      }
      const color = pickColor(colorHex, asm?.contentHex ?? this.shelfMetaColor(sourceBottleId, false));
      this.animator.add(dropsTask(this.scene, start, target, drops, color, done, { onStart, onEnd, fromAbove }), done);
    } catch (e) {
      console.error('[bench] animateDrops failed', e);
      done();
    }
  }

  /** Solid reagent -> spatula of powder (or a metal piece) dropped into target. */
  public animateSolidAddition(sourceBottleId: string, targetId: string, colorHex: string, onComplete?: () => void): void {
    const done = guarded(onComplete);
    try {
      const target = this.glasswareMap.get(targetId);
      if (!target || target.isBurst()) {
        done();
        return;
      }
      this.frameForAddition(target);
      const meta = this.shelf.getMeta(sourceBottleId);
      const metal = meta
        ? looksLikeMetal(meta.formula, meta.name) && (meta.form === 'solid' || !!meta.by_mass)
        : /(^|[_\-\s])(mg|zn|fe|al|cu|sn)([_\-\s]|$)/i.test(sourceBottleId);
      const asm = this.shelf.get(sourceBottleId);
      let start: THREE.Vector3;
      if (asm) {
        this.shelf.touch(sourceBottleId);
        start = new THREE.Vector3(0, asm.height + 2, 0);
        asm.group.localToWorld(start);
      } else {
        start = target.group.position.clone().add(new THREE.Vector3(-14, target.height + 10, 6));
      }
      const color = pickColor(colorHex, asm?.contentHex ?? this.shelfMetaColor(sourceBottleId, true));
      this.animator.add(
        solidTask(this.scene, start, target, color, metal, done, {
          onStart: () => asm && this.shelf.setBusy(sourceBottleId, true),
          onEnd: () => {
            this.shelf.setBusy(sourceBottleId, false);
            this.shadowDirty = true;
          },
        }),
        done
      );
    } catch (e) {
      console.error('[bench] animateSolidAddition failed', e);
      done();
    }
  }

  private shelfMetaColor(id: string, solid: boolean): string | undefined {
    const m = this.shelf.getMeta(id);
    return m ? m.colorHex || defaultContentColor(solid) : undefined;
  }

  public triggerBurst(id: string) {
    const bundle = this.glasswareMap.get(id);
    if (bundle) {
      bundle.effects.triggerBurst();
      this.shadowDirty = true;
    }
  }

  // ---------------------------------------------------------------- manual handling
  /** True while a bottle / vessel is being carried (keyboard shortcuts should be ignored). */
  public isHolding(): boolean {
    return this.handling.holding;
  }

  /** Drop whatever is carried back where it came from (same as Esc). */
  public cancelHandling(): void {
    this.handling.cancel();
  }

  /** Vessel currently standing on the balance pan, if any. */
  public getPanVesselId(): string | null {
    return this.panVessel;
  }

  /** Make a shelf bottle glow for a few seconds ("this is the one to pick up"). */
  public pulseBottle(id: string): void {
    this.pulse = { id, t: 0 };
  }

  /** Vessels whose level tag should be shown: hovered, selected, carried, or being poured into. */
  public getFocusVesselIds(): string[] {
    const out = new Set<string>();
    if (this.hoverKey?.startsWith('vessel:')) out.add(this.hoverKey.slice(7));
    if (this.selectedId) out.add(this.selectedId);
    for (const id of this.handling.focusIds()) out.add(id);
    for (const id of this.titration.focusIds()) out.add(id);
    return Array.from(out).filter((id) => this.glasswareMap.has(id));
  }

  /**
   * Screen position (CSS px, relative to the bench container) of a vessel's level tag: beside the liquid surface, or
   * the glass profile's own reading anchor when it provides one. `visible` is false behind the camera / off-screen.
   */
  public getVesselScreenAnchor(id: string): { x: number; y: number; visible: boolean } | null {
    const b = this.glasswareMap.get(id);
    if (!b) return null;
    b.group.updateWorldMatrix(true, false);
    const ext = b as unknown as { readingAnchorLocal?: (side?: 1 | -1) => THREE.Vector3 | undefined };
    let world: THREE.Vector3;
    let a: THREE.Vector3 | undefined;
    try {
      a = ext.readingAnchorLocal?.(b.profile.kind === 'burette' ? -1 : undefined); // burette: tag on the side away from the stopcock lever
    } catch {
      a = undefined;
    }
    if (a && a.isVector3) world = a.clone().applyMatrix4(b.group.matrixWorld);
    else {
      world = new THREE.Vector3(0, b.surfaceLocalY(), 0).applyMatrix4(b.group.matrixWorld);
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      world.addScaledVector(right, b.profile.maxOuterRadius + 0.8);
    }
    const ndc = world.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = (ndc.x * 0.5 + 0.5) * rect.width;
    const y = (-ndc.y * 0.5 + 0.5) * rect.height;
    const visible = ndc.z > -1 && ndc.z < 1 && x > -20 && x < rect.width + 20 && y > -20 && y < rect.height + 20;
    return { x, y, visible };
  }

  /** Sit a filter funnel on a flask (stem into the neck, funnel stand put away). */
  public stackFunnel(funnelId: string, receiverId: string): boolean {
    this.freeSlotOf(funnelId);
    if (this.panVessel === funnelId) this.panVessel = null;
    if (this.hotPlateVessel === funnelId) this.hotPlateVessel = null;
    return this.filters.stack(funnelId, receiverId);
  }

  /** Take a funnel off its flask; `reposition` also sets it down on the nearest free bench spot (not while it is carried). */
  public unstackFunnel(funnelId: string, reposition: boolean): void {
    this.filters.unstack(funnelId);
    const b = this.glasswareMap.get(funnelId);
    if (!b || !reposition) return;
    const spot = this.resolveDrop(funnelId, b.group.position.x, b.group.position.z, 'bench');
    this.commitDrop(funnelId, spot);
  }

  /** Slide `id` next to `nearId` (setups: a flask and its collector side by side), onto the nearest free spot. */
  public placeBeside(id: string, nearId: string, dx = 14): void {
    const b = this.glasswareMap.get(id);
    const n = this.glasswareMap.get(nearId);
    if (!b || !n) return;
    const r = Math.max(b.footprint, b.profile.maxOuterRadius);
    const free = nearestFreeSpot(n.group.position.x + dx, n.group.position.z, r, (x, z, cr) => this.spotBlocked(id, x, z, cr));
    if (!free) return;
    this.freeSlotOf(id);
    b.group.position.set(free[0], 0, free[1]);
    this.shadowDirty = true;
  }

  /** Gas collectors draw their collected gas (plunger / gas column); true when `id` was handled that way. */
  public drawGasCollector(id: string, snap: VesselSnapshot): boolean {
    const b = this.glasswareMap.get(id);
    return !!b && this.gas.applyCollector(b, snap);
  }

  /** The glass profile's own graduation reading of the current level, if it provides one (mL). */
  public getVesselLevelReading(id: string): number | null {
    const b = this.glasswareMap.get(id) as unknown as { levelReadingMl?: () => number | null; scaleReadingMl?: () => number | null } | undefined;
    try {
      // the printed scale reading (burettes / graduated pipettes are graduated downward), else the true level
      const v = b?.scaleReadingMl?.() ?? b?.levelReadingMl?.();
      return typeof v === 'number' && isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }

  /** The user dropped a delivery-tube end on a collector / pulled it off (wired to the Lab by main.ts). */
  public onGasLink?: (srcId: string, dstId: string) => void;
  public onGasUnlink?: (srcId: string) => void;

  private makeGasHost(): GasHost {
    return {
      scene: this.scene,
      camera: this.camera,
      dom: this.renderer.domElement,
      controls: this.controls,
      vessels: () => this.glasswareMap,
      busy: () => this.handling.holding || this.handling.pressing,
      link: (s, d) => this.onGasLink?.(s, d),
      unlink: (s) => this.onGasUnlink?.(s),
      notify: (m, k) => this.onNotify?.(m, k),
      setHint: (t) => this.onHint?.(t),
    };
  }

  private makeHandlingHost(): HandlingHost {
    return {
      scene: this.scene,
      camera: this.camera,
      dom: this.renderer.domElement,
      controls: this.controls,
      animator: this.animator,
      shelf: this.shelf,
      vessels: () => this.glasswareMap,
      pickables: () => {
        const out: THREE.Object3D[] = [];
        for (const b of this.glasswareMap.values()) if (!b.isBurst()) out.push(b.pickProxy);
        for (const a of this.shelf.assemblies()) out.push(a.pickProxy);
        return out;
      },
      groundAt: (x, z) => this.groundAt(x, z),
      bounds: (bottle) => (bottle ? { x0: -108, x1: 108, z0: -42, z1: 28 } : { x0: -108, x1: 108, z0: -27, z1: 27 }),
      liftVessel: (id) => this.liftVessel(id),
      resolveDrop: (id, x, z, prefer) => this.resolveDrop(id, x, z, prefer),
      commitDrop: (id, spot) => this.commitDrop(id, spot),
      openFlow: (src, targetId, form) => {
        try {
          return this.flowProvider?.(src, targetId, form) ?? null;
        } catch (e) {
          console.warn('[bench] flowProvider failed', e);
          return null;
        }
      },
      markDirty: () => {
        this.shadowDirty = true;
      },
      onSelectVessel: (id) => this.onSelectObject?.('vessel', id),
      notify: (m, k) => this.onNotify?.(m, k),
      setHint: (t) => this.onHint?.(t),
      setPourState: (st) => this.onPourState?.(st),
      pipetteLab: () => this.pipetteLab ?? null,
    };
  }

  private makeTitrationHost(): TitrationHost {
    return {
      scene: this.scene,
      camera: this.camera,
      dom: this.renderer.domElement,
      controls: this.controls,
      vessels: () => this.glasswareMap,
      heldVesselId: () => this.handling.heldVesselId(),
      isHolding: () => this.handling.holding,
      openDrain: (src, target, bottom) => {
        try {
          return this.drainProvider?.(src, target, bottom) ?? null;
        } catch (e) {
          console.warn('[bench] drainProvider failed', e);
          return null;
        }
      },
      volumeMl: (id) => {
        try {
          return this.volumeProvider?.(id) ?? this.glasswareMap.get(id)?.lastSnapshot?.total_liquid_ml ?? 0;
        } catch {
          return 0;
        }
      },
      notify: (m, k) => this.onNotify?.(m, k),
      setHint: (t) => this.onHint?.(t),
      markDirty: () => {
        this.shadowDirty = true;
      },
      setStirring: (id, on) => this.onStirrerToggle?.(id, on),
      stirrerVacated: (id) => this.onStirrerVacated?.(id),
    };
  }

  // ---------------------------------------------------------------- titration station / stopcocks (see titration.ts)
  /** The vessel standing on the station's magnetic stirrer (stirring does not move it to the hot plate). */
  public isOnStirrer(id: string): boolean {
    return this.titration.isOnStirrer(id);
  }

  /** Stand `flaskId` on the station tile (kit spawn). False when it cannot stand there / the tile is taken. */
  public seatTitrationFlask(flaskId: string): boolean {
    const b = this.glasswareMap.get(flaskId);
    const spot = this.titration.flaskSpot(flaskId);
    if (!b || !spot) return false;
    this.freeSlotOf(flaskId);
    this.commitDrop(flaskId, spot);
    return true;
  }

  /** Stand `flaskId` under the stopcock of the separatory funnel `funnelId` (kit spawn). */
  public seatBelowFunnel(flaskId: string, funnelId: string): boolean {
    const b = this.glasswareMap.get(flaskId);
    const spot = this.titration.funnelFlaskSpot(flaskId, funnelId);
    if (!b || !spot) return false;
    this.freeSlotOf(flaskId);
    this.commitDrop(flaskId, spot);
    return true;
  }

  /** Close every open stopcock (Esc). True when one was open. */
  public closeStopcocks(): boolean {
    return this.titration.closeAll();
  }

  /** Open stopcocks for the HUD ('Burette: dropwise 0.06 mL/s'). */
  public getStopcockStates() {
    return this.titration.states();
  }

  /** Level tag texts of a burette ('Burette reads 12.35 mL' / '(delivered)'), null for other vessels. */
  public getVesselTagText(id: string): { main: string; sub: string } | null {
    return this.titration.tagFor(id);
  }

  /** B key: cycle the camera over the station (tip + flask, the whole stand, the burette reading). `restart` begins at the tip. */
  public focusTitration(restart = false): boolean {
    if (restart) this.titration.resetView();
    const plan: ViewPlan | null = this.titration.nextView();
    if (!plan) return false;
    this.focusPoint(plan.target, plan.distance, plan.front);
    return true;
  }

  /** Take a vessel off the bench / hot plate / balance (it is about to be carried). */
  private liftVessel(id: string): { place: DropPlace; pos: THREE.Vector3 } {
    const b = this.glasswareMap.get(id);
    let place: DropPlace = 'bench';
    if (this.hotPlateVessel === id) {
      place = 'hotplate';
      this.hotPlateVessel = null;
      this.onVesselLifted?.(id, 'hotplate');
    } else if (this.panVessel === id) {
      place = 'balance';
      this.panVessel = null;
      this.onVesselLifted?.(id, 'balance');
    } else this.onVesselLifted?.(id, 'bench'); // (a funnel sitting on a flask comes off it)
    this.freeSlotOf(id);
    this.titration.onLift(id);
    this.shadowDirty = true;
    return { place, pos: b ? b.group.position.clone() : new THREE.Vector3() };
  }

  /** A vessel of radius `r` centred at (x, z) would collide with another vessel, an instrument or the bench edge. */
  private spotBlocked(id: string, x: number, z: number, r: number): boolean {
    if (x - r < BENCH.xMin + 6 || x + r > BENCH.xMax - 6 || z - r < -30 || z + r > BENCH.zMax - 4) return true;
    for (const [vid, o] of this.glasswareMap) {
      if (vid === id) continue;
      const rr = r + Math.max(o.footprint, o.profile.maxOuterRadius) + 0.6;
      if (Math.hypot(o.group.position.x - x, o.group.position.z - z) < rr) return true;
    }
    for (const f of this.footprints) {
      if (x > f.x0 - r && x < f.x1 + r && z > f.z0 - r && z < f.z1 + r) return true;
    }
    return false;
  }

  /** Where a vessel released at (x, z) comes to rest: hot plate, balance pan, or the nearest free bench spot. */
  private resolveDrop(id: string, x: number, z: number, prefer?: DropPlace): DropSpot {
    const b = this.glasswareMap.get(id);
    if (b && (prefer === undefined || prefer === 'bench')) {
      const snap = this.titration.resolveDrop(id, x, z, b); // burette -> clamp, flask -> tile / under a funnel
      if (snap) return snap;
    }
    const r = b ? Math.max(b.footprint, b.profile.maxOuterRadius) : 4;
    const hp = this.hotPlateTopWorld();
    const pan = this.pan;
    const inPlate = Math.abs(x - hp.x) < 9 && Math.abs(z - hp.z) < 9;
    const inPan = !!pan && Math.hypot(x - pan.center.x, z - pan.center.z) < Math.max(4.5, pan.radius);
    if (prefer === 'hotplate' || (prefer === undefined && inPlate)) return { place: 'hotplate', pos: hp.clone() };
    if ((prefer === 'balance' || (prefer === undefined && inPan)) && pan && (this.panVessel === null || this.panVessel === id)) {
      return { place: 'balance', pos: new THREE.Vector3(pan.center.x, pan.topY, pan.center.z) };
    }
    const free = nearestFreeSpot(x, z, r, (cx, cz, cr) => this.spotBlocked(id, cx, cz, cr));
    const pos = new THREE.Vector3(free ? free[0] : x, 0, free ? free[1] : z);
    // tidy up: settle exactly onto a nearby free bench slot
    for (let i = 0; i < this.slots.length; i++) {
      const sl = this.slots[i];
      if (this.slotOwner[i] === null && Math.hypot(sl.x - pos.x, sl.z - pos.z) < 3.5 && !this.spotBlocked(id, sl.x, sl.z, r)) {
        pos.set(sl.x, 0, sl.z);
        break;
      }
    }
    return { place: 'bench', pos };
  }

  /** The vessel has come to rest at `spot`. */
  private commitDrop(id: string, spot: DropSpot) {
    const b = this.glasswareMap.get(id);
    if (!b) return;
    b.group.position.copy(spot.pos);
    b.group.quaternion.identity();
    this.titration.onCommit(id, spot);
    if (spot.place === 'bench') {
      for (let i = 0; i < this.slots.length; i++) {
        const sl = this.slots[i];
        if (this.slotOwner[i] === null && Math.hypot(sl.x - spot.pos.x, sl.z - spot.pos.z) < 0.05) {
          this.slotOwner[i] = id;
          this.vesselSlot.set(id, i);
          break;
        }
      }
    } else if (spot.place === 'balance') {
      this.panVessel = id;
    } else if (!this.onVesselPlaced) {
      this.placeVesselOnHotPlate(id);
      return;
    }
    this.onVesselPlaced?.(id, spot.place);
    this.shadowDirty = true;
  }

  private updateBalance(dt: number) {
    const bal = this.instruments.balance;
    let load: number | null = null;
    const id = this.panVessel;
    if (id) {
      const b = this.glasswareMap.get(id);
      if (b) {
        try {
          load = this.massProvider ? this.massProvider(id) : b.lastSnapshot?.contents_mass_g ?? 0;
        } catch {
          load = b.lastSnapshot?.contents_mass_g ?? 0;
        }
      } else this.panVessel = null;
    }
    try {
      bal.setLoad(load);
      bal.update(null, dt);
    } catch (e) {
      if (!this.tickWarned.has('balance')) {
        this.tickWarned.add('balance');
        console.warn('[bench] balance update failed', e);
      }
    }
  }

  private updatePulse(dt: number) {
    const p = this.pulse;
    if (!p) return;
    p.t += dt;
    const a = this.shelf.get(p.id);
    if (!a || p.t > 3.6) {
      a?.setGlow(0);
      this.pulse = null;
      return;
    }
    const k = Math.min(1, (3.6 - p.t) / 0.6);
    a.setGlow((0.5 + 0.5 * Math.sin(p.t * 7)) * k);
  }

  // ---------------------------------------------------------------- camera
  /** Smoothly orbit the camera target to a world point. `front` also swings the camera to look straight at the bench front. */
  public focusPoint(target: THREE.Vector3, distance: number, front = false): void {
    const fromT = this.controls.target.clone();
    const fromP = this.camera.position.clone();
    const toT = target.clone();
    const offset = front ? new THREE.Vector3(-0.12, 0.08, 1) : fromP.clone().sub(fromT);
    const dist = THREE.MathUtils.clamp(distance, this.controls.minDistance, this.controls.maxDistance);
    const toP = toT.clone().add(offset.normalize().multiplyScalar(dist));
    let t = 0;
    const task: AnimTask = {
      update: (dt: number) => {
        if (this.cameraTween !== task) return true;
        t = Math.min(1, t + dt / 0.9);
        const k = ease.inOut(t);
        this.controls.target.lerpVectors(fromT, toT, k);
        this.camera.position.lerpVectors(fromP, toP, k);
        if (t >= 1) {
          this.cameraTween = null;
          return true;
        }
        return false;
      },
    };
    this.cameraTween = task;
    this.animator.add(task);
  }

  /** Smoothly move the orbit camera target to a vessel. */
  public focusVessel(id: string, distance?: number): void {
    const b = this.glasswareMap.get(id);
    if (!b) return;
    const fromT = this.controls.target.clone();
    const fromP = this.camera.position.clone();
    const toT = b.group.position.clone().add(new THREE.Vector3(0, b.height * 0.45, 0));
    const offset = fromP.clone().sub(fromT);
    const dist = THREE.MathUtils.clamp(distance ?? Math.max(32, b.height * 3.4), this.controls.minDistance, Math.min(offset.length(), 90));
    const toP = toT.clone().add(offset.normalize().multiplyScalar(dist));
    let t = 0;
    const task: AnimTask = {
      update: (dt: number) => {
        if (this.cameraTween !== task) return true;
        t = Math.min(1, t + dt / 0.85);
        const k = ease.inOut(t);
        this.controls.target.lerpVectors(fromT, toT, k);
        this.camera.position.lerpVectors(fromP, toP, k);
        if (t >= 1) {
          this.cameraTween = null;
          return true;
        }
        return false;
      },
    };
    this.cameraTween = task;
    this.animator.add(task);
  }

  // ---------------------------------------------------------------- walking (WASD / arrows)
  /** Track a held movement key (KeyW/A/S/D, Arrow*). Returns true when the key is a movement key. */
  public setMoveKey(code: string, down: boolean): boolean {
    const dir = WALK_KEYS[code];
    if (!dir) return false;
    if (down) this.moveKeys.add(code);
    else this.moveKeys.delete(code);
    return true;
  }

  public clearMoveKeys(): void {
    this.moveKeys.clear();
  }

  /** Slide camera + orbit target together over the bench plane (forward = where the camera looks, flattened). */
  private updateWalk(dt: number): void {
    if (this.moveKeys.size === 0) return;
    let fwd = 0;
    let right = 0;
    for (const c of this.moveKeys) {
      fwd += WALK_KEYS[c][0];
      right += WALK_KEYS[c][1];
    }
    if (fwd === 0 && right === 0) return;
    const f = new THREE.Vector3().subVectors(this.controls.target, this.camera.position);
    f.y = 0;
    if (f.lengthSq() < 1e-6) return;
    f.normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x); // right-hand side of the view direction
    const step = WALK_SPEED * dt * (this.moveKeys.has('ShiftLeft') || this.moveKeys.has('ShiftRight') ? 2.5 : 1);
    const d = f.multiplyScalar(fwd).addScaledVector(r, right);
    d.normalize().multiplyScalar(step);
    const t = this.controls.target;
    const nx = THREE.MathUtils.clamp(t.x + d.x, BENCH.xMin + 10, BENCH.xMax - 10);
    const nz = THREE.MathUtils.clamp(t.z + d.z, BENCH.zMin + 5, BENCH.zMax);
    d.set(nx - t.x, 0, nz - t.z);
    t.add(d);
    this.camera.position.add(d);
    this.cameraTween = null; // walking takes over from any glide
  }

  // ---------------------------------------------------------------- input
  private setPointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  /**
   * Invisible click target for an instrument (they are not draggable and their meshes have raycasting disabled).
   * Boxed from the group's own geometry at construction (before it is posed), optionally ignoring a child group.
   */
  private addInstrumentProxy(id: InstrumentId, group: THREE.Group, exclude: THREE.Object3D | null, box?: THREE.Box3): THREE.Mesh {
    // measure in the group's own frame: detach it, drop its pose, optionally set a child group aside
    const gParent = group.parent;
    const savedPos = group.position.clone();
    const savedQuat = group.quaternion.clone();
    const exParent = exclude?.parent ?? null;
    gParent?.remove(group);
    group.position.set(0, 0, 0);
    group.quaternion.identity();
    if (exclude && exParent) exParent.remove(exclude);
    group.updateWorldMatrix(false, true);
    const b = box ? box.clone() : new THREE.Box3().setFromObject(group);
    if (exclude && exParent) exParent.add(exclude);
    group.position.copy(savedPos);
    group.quaternion.copy(savedQuat);
    gParent?.add(group);
    b.expandByScalar(id === 'thermometer' || id === 'phmeter' ? 0.7 : 0.2);
    const size = b.getSize(new THREE.Vector3());
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ visible: false }));
    mesh.position.copy(b.getCenter(new THREE.Vector3()));
    mesh.visible = false;
    mesh.name = `pick_${id}`;
    mesh.userData.pick = { type: 'instrument', id };
    group.add(mesh);
    return mesh;
  }

  private pick(): PickHit | null {
    return this.pickAll()[0] ?? null;
  }

  /** All hits under the pointer, nearest first (with the balance TARE-key override applied). */
  private pickAll(): PickHit[] {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const proxies: THREE.Object3D[] = [];
    for (const b of this.glasswareMap.values()) if (!b.isBurst()) proxies.push(b.pickProxy);
    for (const a of this.shelf.assemblies()) proxies.push(a.pickProxy);
    const key = this.instruments.balance.tareKey;
    if (key) proxies.push(key);
    proxies.push(...this.titration.pickMeshes()); // stopcock levers + stirrer knob
    for (const o of this.instrumentProxies) if (o.parent?.visible) proxies.push(o); // gauge only while sealed
    for (const o of proxies) o.updateWorldMatrix(true, false);
    const hits = this.raycaster.intersectObjects(proxies, false);
    const picks: PickHit[] = [];
    for (const h of hits) {
      const p = h.object.userData.pick as PickHit | undefined;
      if (p) picks.push(p);
    }
    const first = picks[0];
    // the TARE key sits inside the balance's box: it wins over the balance body
    if (first?.type === 'instrument' && first.id === 'balance') {
      const tare = picks.find((p) => p.type === 'balance-tare');
      if (tare) return [tare, ...picks.filter((p) => p !== tare)];
    }
    return picks;
  }

  /** Capture-phase press: arm a grab when the press lands on a bottle / vessel (keeps OrbitControls from starting). */
  private onPointerDownCapture = (e: PointerEvent) => {
    try {
      if (this.titration.pointerDown(e)) return; // a stopcock lever / stirrer knob press: no grab, no orbit
      this.handling.pointerDown(e);
    } catch (err) {
      console.warn('[bench] handling.pointerDown failed', err);
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.downPos;
    this.downPos = null;
    if (!d || d.button !== 0 || e.button !== 0) return;
    if (this.handling.holding) return; // a carried object is being released, not clicked
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 5 || performance.now() - d.t > 800) return;
    this.setPointer(e);
    const all = this.pickAll();
    let hit = all[0] ?? null;
    // a probe standing in the selected vessel is behind the glass proxy: clicking it should open the probe, not re-pick the vessel
    if (hit?.type === 'vessel' && hit.id === this.selectedId) {
      const probe = all.find((p) => p.type === 'instrument' && (p.id === 'thermometer' || p.id === 'phmeter'));
      if (probe) hit = probe;
    }
    if (hit?.type === 'balance-tare') {
      this.instruments.balance.tare();
      return;
    }
    if (hit?.type === 'stopcock' || hit?.type === 'stirknob') return; // handled by the titration rig
    if (hit) {
      if (hit.type === 'bottle') this.shelf.touch(hit.id);
      this.onSelectObject?.(hit.type, hit.id);
    } else {
      this.onDeselect?.();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    this.pointerInside = true;
    this.setPointer(e);
    this.hoverDirty = true;
  };

  private onPointerLeave = () => {
    this.pointerInside = false;
    this.hoverDirty = true;
  };

  private updateHover() {
    if (!this.hoverDirty) return;
    this.hoverDirty = false;
    const dragging = !!this.downPos || this.handling.holding;
    const hit = this.pointerInside && !dragging ? this.pick() : null;
    const key = hit ? `${hit.type}:${hit.id}` : null;
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    for (const [id, b] of this.glasswareMap) b.setHover(hit?.type === 'vessel' && hit.id === id);
    for (const a of this.shelf.assemblies()) a.setHover(hit?.type === 'bottle' && a.group.userData.pick?.id === hit.id);
    const rigHit = hit && (hit.type === 'stopcock' || hit.type === 'stirknob') ? hit : null;
    if (this.handling.holding) {
      this.titration.hover(null);
      return;
    }
    const grabbable = hit && hit.type !== 'balance-tare' && hit.type !== 'instrument' && !rigHit ? { type: hit.type as 'vessel' | 'bottle', id: hit.id } : null;
    this.handling.hoverHint(grabbable);
    this.titration.hover(rigHit); // after the handling hint: a lever's own hint wins
    this.renderer.domElement.style.cursor = !hit ? '' : rigHit?.type === 'stopcock' ? 'ns-resize' : hit.type === 'balance-tare' || hit.type === 'instrument' || rigHit ? 'pointer' : 'grab';
  }

  private onResize = () => {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    setParticleViewport(h * this.renderer.getPixelRatio(), this.camera.fov);
  };

  // ---------------------------------------------------------------- loop
  private sortRenderOrder() {
    const cam = this.camera.position;
    const items: { d: number; set: (b: number) => void }[] = [];
    for (const b of this.glasswareMap.values()) {
      items.push({ d: b.group.position.distanceToSquared(cam), set: b.setRenderOrderBase });
    }
    for (const a of this.shelf.assemblies()) items.push({ d: a.group.position.distanceToSquared(cam), set: a.setRenderOrderBase });
    for (const t of this.transient) items.push({ d: t.object.position.distanceToSquared(cam), set: t.setRenderOrderBase });
    items.sort((a, b) => b.d - a.d);
    for (let i = 0; i < items.length; i++) items[i].set(10 + i * 10);
  }

  private animate = () => {
    this.rafId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += dt;
    const time = this.time;

    if (this.downPos) this.cameraTween = null; // user takes over the camera
    this.updateWalk(dt);
    this.controls.update();
    const animBusy = this.animator.active;
    this.animator.tick(dt, time);
    this.refreshPan();
    try {
      this.handling.update(dt, time);
    } catch (e) {
      if (!this.tickWarned.has('handling')) {
        this.tickWarned.add('handling');
        console.warn('[bench] handling.update failed', e);
      }
    }
    try {
      this.gas.update(dt, time);
      this.filters.update(dt, time);
    } catch (e) {
      if (!this.tickWarned.has('gas')) {
        this.tickWarned.add('gas');
        console.warn('[bench] gas tubes / filter drips update failed', e);
      }
    }
    this.updateBalance(dt);
    this.updatePulse(dt);
    try {
      this.titration.update(dt, time);
    } catch (e) {
      if (!this.tickWarned.has('titration')) {
        this.tickWarned.add('titration');
        console.warn('[bench] titration.update failed', e);
      }
    }

    let fire = 0;
    const fireTmp = new THREE.Vector3();
    const firePos = this.room.fireLight.position;
    for (const b of this.glasswareMap.values()) {
      try {
        b.setGroundY(this.titration.groundFor(b.vesselState.id, b.group.position.x, b.group.position.z));
        b.tick(dt, time);
        const f = b.effects.flameStrength(time);
        if (f > fire) {
          fire = f;
          fireTmp.set(0, b.profile.baseOffsetY + b.effects.flameLocalY(), 0).applyMatrix4(b.group.matrixWorld);
          firePos.copy(fireTmp);
        }
      } catch (e) {
        // one broken vessel must never stop the frame from rendering (everything would go blank)
        if (!this.tickWarned.has(b.vesselState.id)) {
          this.tickWarned.add(b.vesselState.id);
          console.warn(`[bench] vessel ${b.vesselState.id} tick failed`, e);
        }
      }
    }
    const { hotPlate, burner } = this.instruments;
    hotPlate.animate(dt);
    burner.animate(dt);
    const bf = burner.brightness();
    if (bf > fire) {
      fire = bf;
      firePos.set(BURNER_POS.x, BURNER_TOP_Y + 4, BURNER_POS.z);
    }
    this.room.fireLight.intensity = fire * 1500;

    this.updateProbes(dt);
    this.updateHover();
    this.sortRenderOrder();

    this.shadowTimer += dt;
    if (this.shadowDirty || animBusy || this.shadowTimer > 0.5) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
      this.shadowTimer = 0;
    }
    this.renderer.render(this.scene, this.camera);
  };

  /** Stop rendering and release GPU resources (not required by the contract; useful for HMR). */
  public dispose() {
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.onResize);
    this.container.removeEventListener('pointerdown', this.onPointerDownCapture, true);
    this.handling.dispose();
    this.titration.dispose();
    this.gas.dispose();
    this.filters.dispose();
    this.controls.dispose();
    for (const id of Array.from(this.glasswareMap.keys())) this.removeVessel(id);
    this.room.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Prefer the bottle's own (data-derived) content colour when the caller passes a neutral/near-white colour. */
function pickColor(passed: string | undefined, content: string | undefined): string {
  if (!passed) return content || '#f2f6f8';
  if (!content) return passed;
  const c = new THREE.Color(passed);
  const neutral = Math.min(c.r, c.g, c.b) > 0.8;
  const k = new THREE.Color(content);
  const contentColoured = Math.max(k.r, k.g, k.b) - Math.min(k.r, k.g, k.b) > 0.12 || Math.max(k.r, k.g, k.b) < 0.5;
  return neutral && contentColoured ? content : passed;
}

/** once() + a wall-clock fallback so the UI's dose callback fires even if rendering is paused (hidden tab). */
function guarded(cb?: () => void): () => void {
  const done = once(cb);
  setTimeout(done, 7000);
  return done;
}

function prettyId(id: string): string {
  return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
