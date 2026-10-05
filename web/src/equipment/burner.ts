import * as THREE from 'three';
import { VesselSnapshot, VesselControls } from '../types/sim';
import { FlameCluster } from '../render/flame';
import { Control3D, Selector, place, textLegend } from '../bench/controls3d';

/**
 * Bunsen burner (≈16 cm) with gas hose; shader flame with a blue inner cone, lit by `ignite()`.
 */
export const BURNER_TOP_Y = 15.5;

export class Burner {
  public group = new THREE.Group();
  private flame: FlameCluster;
  public isActive: boolean = false;
  public powerWatts: number = 0.0;
  private time = 0;
  /** Gas tap, air collar and the flame-test wire loop; the scene registers them with its control rig. */
  public readonly controls: Control3D[] = [];
  /** The gas tap was opened (true: the burner lights) or shut. */
  public onGas?: (on: boolean) => void;
  /** The wire loop was clicked: `true` = dip it in the selected sample and hold it in the flame. Return false to refuse. */
  public onLoop?: (intoFlame: boolean) => boolean | void;
  /** Result line of the last flame test, for the instrument panel. */
  public flameTestInfo = '';
  private gasTap!: Selector;
  private collar: AirCollar;
  private loop!: THREE.Group;
  private loopControl!: LoopControl;
  private loopTarget = 0;
  /** Current / wanted pose of the wire's end (tip, burner frame) and the direction from handle to tip. */
  private tipCur = REST_TIP.clone();
  private dirCur = REST_DIR.clone();
  private tipGoal = REST_TIP.clone();
  private dirGoal = REST_DIR.clone();
  private loopFast = false;
  private air = 1;
  /** The loop is in the user's hand (dragged); `onLoopFlame` tells the app when the wet loop enters the flame. */
  public loopHeld = false;
  /** Vessel whose liquid is on the wire (dipped by hand), or null for a dry loop. */
  public loopWet: string | null = null;
  /** The wire's end is inside the flame while held. */
  public loopHeldInFlame = false;
  /** Scene: the vessel (world x, z) whose liquid the wire can reach there, with its surface height; null = none. */
  public dipTarget?: (x: number, z: number) => { id: string; surfaceY: number } | null;
  /** The held loop picked up liquid from a vessel (null = it was put back and is dry again). */
  public onLoopWet?: (vesselId: string | null) => void;
  /** The held loop entered / left the flame. */
  public onLoopFlame?: (inFlame: boolean) => void;

  constructor() {
    this.group.name = 'equipment_burner';
    const iron = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.55, metalness: 0.6 });
    const basePts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(4.6, 0),
      new THREE.Vector2(4.6, 0.5),
      new THREE.Vector2(4.0, 1.0),
      new THREE.Vector2(1.6, 1.8),
      new THREE.Vector2(0.9, 2.2),
      new THREE.Vector2(0, 2.2),
    ];
    const base = new THREE.Mesh(new THREE.LatheGeometry(basePts, 40), iron);
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a459, metalness: 1, roughness: 0.3 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, BURNER_TOP_Y - 2.2, 24), brass);
    barrel.position.y = 2.2 + (BURNER_TOP_Y - 2.2) / 2;
    barrel.castShadow = true;
    this.group.add(barrel);
    // air collar (rotates: closed = luminous yellow flame, open = blue non-luminous cone)
    this.collar = new AirCollar(brass);
    this.collar.group.position.y = 3.6;
    this.collar.onChange = (open) => this.setAir(open);
    this.group.add(this.collar.group);
    this.controls.push(this.collar);
    const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 3.2, 12), brass);
    inlet.rotation.z = Math.PI / 2;
    inlet.position.set(-2.0, 1.9, 0);
    this.group.add(inlet);
    // rubber gas hose
    const hose = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.5, 1.9, 0),
      new THREE.Vector3(-6.5, 1.2, 1.5),
      new THREE.Vector3(-9, 0.5, 6),
      new THREE.Vector3(-12, 0.45, 14),
      new THREE.Vector3(-14.6, 2.4, 19.2),
    ]);
    const hoseMesh = new THREE.Mesh(new THREE.TubeGeometry(hose, 40, 0.42, 10, false), new THREE.MeshStandardMaterial({ color: 0xc0471d, roughness: 0.6 }));
    hoseMesh.castShadow = true;
    this.group.add(hoseMesh);

    this.buildGasTap(brass);
    this.buildLoop();

    this.flame = new FlameCluster(1);
    this.flame.configure(0, 2.0, 9.0, { luminosity: 0.0, emitterAmount: 0 });
    this.flame.setInnerCone(true);
    this.flame.group.position.y = BURNER_TOP_Y;
    this.group.add(this.flame.group);
    this.group.traverse((o) => (o.raycast = () => {}));
  }

  /** Lab-bench gas cock at the end of the hose: a brass lever (OFF = across the pipe, GAS = along it). */
  private buildGasTap(brass: THREE.Material) {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 1, roughness: 0.25 });
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.5, 32), chrome);
    flange.position.set(-16, 0.25, 20);
    flange.receiveShadow = true;
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 4.4, 20), brass);
    riser.position.set(-16, 2.7, 20);
    riser.castShadow = true;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.6, 24), brass);
    body.position.set(-16, 4.6, 20);
    const barb = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 2.2, 14), brass);
    barb.position.set(-15.3, 2.4, 19.6);
    barb.rotation.z = Math.PI / 2;
    barb.rotation.y = 0.5;
    this.group.add(flange, riser, body, barb);
    this.gasTap = new Selector({
      id: 'burner.gas',
      caption: 'GAS',
      labels: ['OFF', 'GAS'],
      radius: 1.0,
      style: 'lever',
      accent: 0xd32f2f,
      noPlate: true,
      describe: (i) => (i === 1 ? 'gas on: the burner is lit' : 'gas shut'),
      onChange: (i) => {
        if (i === 1) this.ignite();
        else this.extinguish();
        this.onGas?.(i === 1);
      },
    });
    place(this.gasTap, this.group, [-16, 5.4, 20], [0, 1, 0]);
    const legend = textLegend('GAS', 3.2, 0.9, { ink: '#222', weight: 800 });
    legend.position.set(-16, 0.52, 22.1);
    this.group.add(legend);
    this.controls.push(this.gasTap);
  }

  /** Nichrome wire loop on a glass handle, standing in a holder; carried by hand (drag), or clicked to dip the selected sample and hold it in the flame. */
  private buildLoop() {
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 1.5, 24), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 }));
    holder.position.set(REST_BOTTOM.x, 0.75, REST_BOTTOM.z);
    holder.castShadow = true;
    this.group.add(holder);
    this.loop = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 9, 14), new THREE.MeshStandardMaterial({ color: 0x1c1f23, roughness: 0.5 }));
    handle.position.y = 4.5;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, LOOP_LEN - 9, 8), new THREE.MeshStandardMaterial({ color: 0xcfd4d8, metalness: 1, roughness: 0.25 }));
    rod.position.y = 9 + (LOOP_LEN - 9) / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 24), rod.material);
    ring.position.y = LOOP_LEN + 0.4;
    handle.castShadow = true;
    this.loop.add(handle, rod, ring);
    this.loopControl = new LoopControl(
      () => this.loopTarget === 1 || this.loopHeld,
      (into) => {
        if (this.onLoop?.(into) === false) return;
        this.setLoopInFlame(into);
      },
      (ray) => this.holdLoop(ray),
      () => this.releaseLoop()
    );
    this.loop.add(this.loopControl.group);
    this.group.add(this.loop);
    this.controls.push(this.loopControl);
    this.poseLoop();
  }

  private poseLoop() {
    this.loop.position.copy(this.tipCur).addScaledVector(this.dirCur, -LOOP_LEN);
    this.loop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.dirCur);
  }

  /**
   * The loop is being carried: the wire's end follows the pointer ray on a plane above the bench. Over a vessel with liquid
   * it goes down into the liquid (and comes up wet); near the flame, with the burner lit, it goes into the flame.
   */
  private holdLoop(ray: THREE.Ray) {
    this.group.updateWorldMatrix(true, false);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOLD_Y);
    const hit = ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return;
    hit.x = THREE.MathUtils.clamp(hit.x, -118, 118);
    hit.z = THREE.MathUtils.clamp(hit.z, -38, 30);
    if (!this.loopHeld) {
      this.loopHeld = true;
      this.loopFast = true;
      this.loopTarget = 0;
    }
    const flameW = this.group.localToWorld(FLAME_TIP.clone());
    const dip = this.dipTarget?.(hit.x, hit.z) ?? null;
    let inFlame = false;
    const goalW = hit.clone();
    if (dip) {
      goalW.y = dip.surfaceY - 0.7;
      if (this.loopWet !== dip.id) {
        this.loopWet = dip.id;
        this.onLoopWet?.(dip.id);
      }
    } else if (this.isActive && Math.hypot(hit.x - flameW.x, hit.z - flameW.z) < FLAME_GRAB_R) {
      goalW.set(flameW.x, flameW.y, flameW.z);
      inFlame = true;
    }
    this.tipGoal.copy(this.group.worldToLocal(goalW));
    this.dirGoal.copy(HELD_DIR);
    if (inFlame !== this.loopHeldInFlame) {
      this.loopHeldInFlame = inFlame;
      this.onLoopFlame?.(inFlame);
      if (!inFlame) this.setFlameTest(null);
    }
  }

  /** Let go: the loop returns to its holder, dry (the wire is wiped / the flame test colour goes). */
  private releaseLoop() {
    if (!this.loopHeld) return;
    this.loopHeld = false;
    if (this.loopHeldInFlame) {
      this.loopHeldInFlame = false;
      this.onLoopFlame?.(false);
    }
    this.setFlameTest(null);
    this.flameTestInfo = '';
    if (this.loopWet !== null) {
      this.loopWet = null;
      this.onLoopWet?.(null);
    }
    this.loopFast = false;
    this.tipGoal.copy(REST_TIP);
    this.dirGoal.copy(REST_DIR);
  }

  public get loopInFlame(): boolean {
    return this.loopTarget === 1;
  }

  /** Move the wire loop into / out of the flame (animated). Leaving the flame also clears the flame-test colour. */
  public setLoopInFlame(into: boolean) {
    this.loopTarget = into ? 1 : 0;
    this.loopFast = false;
    this.tipGoal.copy(into ? FLAME_TIP : REST_TIP);
    this.dirGoal.copy(into ? FLAME_DIR : REST_DIR);
    if (!into) {
      this.setFlameTest(null);
      this.flameTestInfo = '';
    }
  }

  private setAir(open: number) {
    this.air = open;
    this.flame.configure(0, 2.0, 9.0, { luminosity: (1 - open) * 0.75 });
  }

  public get airOpen(): number {
    return this.air;
  }

  public ignite(powerW: number = 800.0) {
    this.isActive = true;
    this.powerWatts = powerW;
    this.flame.setTarget(1.0);
    this.gasTap?.setIndex(1);
  }

  /**
   * Flame test: the colour the flame takes when a loop dipped in a sample is held in it (engine `vessel_flame_test`, from
   * emission lines and bands). `null` clears it. `share` is the fraction of the flame's light that comes from the metals.
   */
  public setFlameTest(rgb: [number, number, number] | null, share = 0) {
    this.flame.configure(0, 2.0, 9.0, {
      luminosity: 0.0,
      emitter: rgb ? new THREE.Color(rgb[0], rgb[1], rgb[2]) : undefined,
      emitterAmount: rgb ? Math.min(0.9, Math.max(0, share)) : 0,
    });
  }

  public extinguish() {
    this.isActive = false;
    this.powerWatts = 0.0;
    this.flame.setTarget(0);
    this.gasTap?.setIndex(0);
    if (this.loopTarget) this.setLoopInFlame(false);
    if (this.loopHeldInFlame) {
      this.loopHeldInFlame = false;
      this.onLoopFlame?.(false);
      this.setFlameTest(null);
    }
  }

  /** Kept for API compatibility; animation runs per frame via `animate` (driven by the scene). */
  public update(_snap: VesselSnapshot | null, _dt: number) {}

  /** Per-frame flame animation (called by the scene). */
  public animate(dt: number) {
    this.time += dt;
    if (this.tipCur.distanceToSquared(this.tipGoal) > 1e-6 || this.dirCur.distanceToSquared(this.dirGoal) > 1e-8) {
      // glide to the goal; fast while the loop follows the hand, slower for the click-to-flame move, snap when close
      const k = 1 - Math.exp(-dt * (this.loopFast ? 14 : 4.5));
      this.tipCur.lerp(this.tipGoal, k);
      this.dirCur.lerp(this.dirGoal, k).normalize();
      if (this.tipCur.distanceTo(this.tipGoal) < 0.02) this.tipCur.copy(this.tipGoal);
      if (this.dirCur.distanceTo(this.dirGoal) < 0.002) this.dirCur.copy(this.dirGoal);
      this.poseLoop();
    }
    this.flame.tick(dt, this.time);
  }

  public brightness(): number {
    return this.flame.brightness(this.time) * 0.5;
  }

  public getControls(): VesselControls {
    return {
      burner_w: this.isActive ? this.powerWatts : 0.0,
      igniter: this.isActive,
    };
  }
}

// ------------------------------------------------------------------ flame-test loop geometry (burner-local frame)
const LOOP_LEN = 15;
const REST_BOTTOM = new THREE.Vector3(7.5, 1.5, 4.5);
const REST_DIR = new THREE.Vector3(0, 1, 0);
const REST_TIP = REST_BOTTOM.clone().addScaledVector(REST_DIR, LOOP_LEN);
const FLAME_DIR = new THREE.Vector3(-0.55, 0.65, -0.5).normalize();
const FLAME_TIP = new THREE.Vector3(0.3, BURNER_TOP_Y + 5.2, 0.2);
/** Height (world, cm) the wire's end is carried at, clear of the burner and the vessel rims. */
const HOLD_Y = 24;
/** Direction from the handle to the wire's end while carried: tip down, handle leaning back and to the left. */
const HELD_DIR = new THREE.Vector3(0.3, -0.85, 0.43).normalize();
/** The wire is drawn into the flame when the carried tip is within this distance of the flame axis (cm). */
const FLAME_GRAB_R = 4;

/** The wire loop: drag = carry it by hand (dip it in any vessel, hold it in the flame); a plain click only explains how. */
class LoopControl implements Control3D {
  public readonly id = 'burner.loop';
  public readonly group = new THREE.Group();
  public readonly hit: THREE.Mesh;
  private glow: THREE.Mesh;

  constructor(
    private active: () => boolean,
    private toggle: (intoFlame: boolean) => void,
    private carry: (ray: THREE.Ray) => void,
    private drop: () => void
  ) {
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, LOOP_LEN + 1, 10), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = LOOP_LEN / 2;
    this.glow = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, LOOP_LEN, 12), new THREE.MeshBasicMaterial({ color: 0x6fd2ff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.glow.position.y = LOOP_LEN / 2;
    this.glow.raycast = () => {};
    this.group.add(this.hit, this.glow);
  }

  public hint(): string {
    return this.active()
      ? 'Carrying the wire loop · move over a vessel to dip it, over a lit flame to test · release to put it back'
      : 'Flame test · drag the wire loop over any vessel to dip it, then hold it in the lit flame';
  }

  public press(): void {}
  public drag(): void {}
  public dragRay(ray: THREE.Ray): void {
    this.carry(ray);
  }
  public release(moved: boolean): void {
    if (moved) this.drop();
    else this.toggle(!this.active());
  }
  public wheel(): void {}
  public setHover(on: boolean): void {
    (this.glow.material as THREE.MeshBasicMaterial).opacity = on ? 0.35 : 0;
  }
  public update(): void {}
}

/** Knurled brass air collar: dark slots line up with the barrel's air holes as it opens. Drag up / down or scroll. */
class AirCollar implements Control3D {
  public readonly id = 'burner.air';
  public readonly group = new THREE.Group();
  public readonly hit: THREE.Mesh;
  public onChange?: (open: number) => void;
  private ring = new THREE.Group();
  private glow: THREE.Mesh;
  private open = 1;
  private start = 1;
  private acc = 0;
  private last: [number, number] = [0, 0];

  constructor(brass: THREE.Material) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 1.4, 28), brass);
    body.castShadow = true;
    this.ring.add(body);
    const slotMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
    for (const a of [0, Math.PI]) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.12), slotMat);
      slot.position.set(Math.sin(a) * 0.84, 0, Math.cos(a) * 0.84);
      slot.rotation.y = a;
      this.ring.add(slot);
    }
    for (let i = 0; i < 10; i++) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.1), brass);
      const a = (i / 10) * Math.PI * 2 + 0.3;
      ridge.position.set(Math.sin(a) * 0.84, 0, Math.cos(a) * 0.84);
      ridge.rotation.y = a;
      this.ring.add(ridge);
    }
    this.group.add(this.ring);
    this.glow = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.5, 24), new THREE.MeshBasicMaterial({ color: 0x6fd2ff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.glow.raycast = () => {};
    this.group.add(this.glow);
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 2.6, 14), new THREE.MeshBasicMaterial({ visible: false }));
    this.group.add(this.hit);
    this.paint();
  }

  public hint(): string {
    const pct = Math.round(this.open * 100);
    return `Air collar: ${pct}% open (${pct > 60 ? 'blue, hot flame' : pct > 20 ? 'blue-yellow flame' : 'yellow, luminous flame'}) · drag up / down or scroll`;
  }

  public press(): void {
    this.start = this.open;
    this.acc = 0;
    this.last = [0, 0];
  }

  public drag(dx: number, dy: number, fine: boolean): void {
    this.acc += ((dx - this.last[0]) * 0.5 - (dy - this.last[1])) / (fine ? 700 : 160);
    this.last = [dx, dy];
    this.set(this.start + this.acc);
  }

  public release(): void {}

  public wheel(dir: 1 | -1, fine: boolean): void {
    this.set(this.open + dir * (fine ? 0.02 : 0.1));
  }

  public setHover(on: boolean): void {
    (this.glow.material as THREE.MeshBasicMaterial).opacity = on ? 0.3 : 0;
  }

  public update(): void {}

  private set(v: number) {
    const q = Math.max(0, Math.min(1, Math.round(v * 50) / 50));
    if (q === this.open) return;
    this.open = q;
    this.paint();
    this.onChange?.(q);
  }

  private paint() {
    this.ring.rotation.y = (1 - this.open) * (Math.PI / 2);
  }
}
