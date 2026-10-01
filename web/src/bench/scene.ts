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
import { importIsSolid } from '../pubchem/parser';

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
  public onSelectObject?: (type: 'vessel' | 'bottle', id: string) => void;
  /** Click on empty bench / background (not a drag). */
  public onDeselect?: () => void;
  public instruments: BenchInstruments;
  public onPourRequested?: (sourceId: string, targetId: string) => void;

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
  private time = 0;
  private lastFrame = performance.now();
  private shadowTimer = 0;
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
    this.renderer.toneMappingExposure = 1.0;
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
    this.instruments = { thermometer, phMeter, balance, pressureGauge, hotPlate, burner };
    this.thermoMotion = { bundle: null, t: 1, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion() };
    this.phMotion = { bundle: null, t: 1, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion() };
    this.updateProbes(0, true);

    this.footprints = [
      { x0: -9.5, x1: 9.5, z0: HOTPLATE_POS.z - 12, z1: HOTPLATE_POS.z + 12 },
      { x0: 36, x1: 57, z0: -26, z1: -2 },
      { x0: 67, x1: 93, z0: -19, z1: 11 },
      { x0: -97, x1: -73, z0: -18, z1: 10 },
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

  private allocSlot(id: string): number {
    let idx = this.slotOwner.indexOf(null);
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
    const top = this.hotPlateTopWorld();
    if (Math.abs(x - top.x) < 9 && Math.abs(z - top.z) < 9) return HOTPLATE_TOP_Y;
    return 0;
  }

  // ---------------------------------------------------------------- vessels
  public addVessel(state: VesselState, posX?: number, posZ?: number): GlasswareMeshBundle {
    void posX;
    void posZ; // positions are auto-allocated (real-scale bench slots)
    const existing = this.glasswareMap.get(state.id);
    if (existing) return existing;
    const bundle = createGlassware(state);
    const idx = this.allocSlot(state.id);
    bundle.group.position.copy(this.slots[idx]);
    bundle.group.rotation.y = 0;
    this.scene.add(bundle.group);
    this.glasswareMap.set(state.id, bundle);
    this.shadowDirty = true;
    return bundle;
  }

  public removeVessel(id: string) {
    const bundle = this.glasswareMap.get(id);
    if (!bundle) return;
    if (this.selectedId === id) this.setSelectedVessel(null);
    if (this.hotPlateVessel === id) this.hotPlateVessel = null;
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

  /** PubChem import: generic labelled bottle on the shelf (positions are auto-allocated). */
  public addBottle(bottle: BottleState, posX?: number, posZ?: number) {
    void posX;
    void posZ;
    const solid = importIsSolid(bottle);
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
    const { thermometer, phMeter, balance, pressureGauge } = this.instruments;
    // re-selecting the same vessel refreshes the seal-dependent gauge (UI calls this after sealing)
    const sealed = !!bundle && (bundle.vesselState.isSealed || this.isSealed(bundle));
    pressureGauge.attachTo(sealed ? bundle : null);
    if (bundle && !bundle.lastSnapshot) bundle.effects.setSealed(bundle.vesselState.isSealed);
    if (newId === this.selectedId) return;
    this.selectedId = newId;
    thermometer.attachTo(bundle);
    phMeter.attachTo(bundle);
    balance.attachTo(bundle);
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
    const { thermometer, phMeter, balance, pressureGauge, hotPlate, burner } = this.instruments;
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
    balance.update(snap, dtSeconds);
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
      this.animator.add(moveTask(b.group, this.hotPlateTopWorld(), () => b.liquid.slosh(0.05), HOTPLATE_TOP_Y));
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

  public animatePour(sourceGroupId: string, targetGroupId: string, colorHex: string, onComplete?: () => void) {
    const done = guarded(onComplete);
    try {
      const target = this.glasswareMap.get(targetGroupId);
      if (!target || target.isBurst() || sourceGroupId === targetGroupId) {
        done();
        return;
      }
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
      if (asm && this.animator.isBusy(asm.group)) asm = undefined;
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

  // ---------------------------------------------------------------- camera
  /** Smoothly move the orbit camera target to a vessel. */
  public focusVessel(id: string): void {
    const b = this.glasswareMap.get(id);
    if (!b) return;
    const fromT = this.controls.target.clone();
    const fromP = this.camera.position.clone();
    const toT = b.group.position.clone().add(new THREE.Vector3(0, b.height * 0.45, 0));
    const offset = fromP.clone().sub(fromT);
    const dist = THREE.MathUtils.clamp(Math.max(32, b.height * 3.4), this.controls.minDistance, Math.min(offset.length(), 90));
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

  // ---------------------------------------------------------------- input
  private setPointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  private pick(): { type: 'vessel' | 'bottle'; id: string } | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const proxies: THREE.Object3D[] = [];
    for (const b of this.glasswareMap.values()) if (!b.isBurst()) proxies.push(b.pickProxy);
    for (const a of this.shelf.assemblies()) proxies.push(a.pickProxy);
    for (const o of proxies) o.updateWorldMatrix(true, false);
    const hits = this.raycaster.intersectObjects(proxies, false);
    for (const h of hits) {
      const p = h.object.userData.pick as { type: 'vessel' | 'bottle'; id: string } | undefined;
      if (p) return p;
    }
    return null;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downPos = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.downPos;
    this.downPos = null;
    if (!d || d.button !== 0 || e.button !== 0) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 5 || performance.now() - d.t > 800) return;
    this.setPointer(e);
    const hit = this.pick();
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
    const dragging = !!this.downPos;
    const hit = this.pointerInside && !dragging ? this.pick() : null;
    const key = hit ? `${hit.type}:${hit.id}` : null;
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    for (const [id, b] of this.glasswareMap) b.setHover(hit?.type === 'vessel' && hit.id === id);
    for (const a of this.shelf.assemblies()) a.setHover(hit?.type === 'bottle' && a.group.userData.pick?.id === hit.id);
    this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
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
    this.controls.update();
    const animBusy = this.animator.active;
    this.animator.tick(dt, time);

    let fire = 0;
    const fireTmp = new THREE.Vector3();
    const firePos = this.room.fireLight.position;
    for (const b of this.glasswareMap.values()) {
      b.setGroundY(this.groundAt(b.group.position.x, b.group.position.z));
      b.tick(dt, time);
      const f = b.effects.flameStrength(time);
      if (f > fire) {
        fire = f;
        fireTmp.set(0, b.profile.baseOffsetY + b.effects.flameLocalY(), 0).applyMatrix4(b.group.matrixWorld);
        firePos.copy(fireTmp);
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
