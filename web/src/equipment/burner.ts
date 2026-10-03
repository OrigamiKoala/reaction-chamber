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
  private loopS = 0;
  private loopTarget = 0;
  private air = 1;

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

  /** Nichrome wire loop on a glass handle, standing in a holder; clicking it dips it in a sample and holds it in the flame. */
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
    this.loopControl = new LoopControl(() => this.loopTarget === 1, (into) => {
      if (this.onLoop?.(into) === false) return;
      this.setLoopInFlame(into);
    });
    this.loop.add(this.loopControl.group);
    this.group.add(this.loop);
    this.controls.push(this.loopControl);
    this.poseLoop(0);
  }

  private poseLoop(s: number) {
    const tip = new THREE.Vector3().lerpVectors(REST_TIP, FLAME_TIP, s);
    const dir = new THREE.Vector3().lerpVectors(REST_DIR, FLAME_DIR, s).normalize();
    this.loop.position.copy(tip).addScaledVector(dir, -LOOP_LEN);
    this.loop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  public get loopInFlame(): boolean {
    return this.loopTarget === 1;
  }

  /** Move the wire loop into / out of the flame (animated). Leaving the flame also clears the flame-test colour. */
  public setLoopInFlame(into: boolean) {
    this.loopTarget = into ? 1 : 0;
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
  }

  /** Kept for API compatibility; animation runs per frame via `animate` (driven by the scene). */
  public update(_snap: VesselSnapshot | null, _dt: number) {}

  /** Per-frame flame animation (called by the scene). */
  public animate(dt: number) {
    this.time += dt;
    if (this.loopS !== this.loopTarget) {
      this.loopS += Math.sign(this.loopTarget - this.loopS) * Math.min(Math.abs(this.loopTarget - this.loopS), dt * 2.2);
      this.poseLoop(this.loopS * this.loopS * (3 - 2 * this.loopS));
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

/** The wire loop as a clickable control (hit volume along the handle). */
class LoopControl implements Control3D {
  public readonly id = 'burner.loop';
  public readonly group = new THREE.Group();
  public readonly hit: THREE.Mesh;
  private glow: THREE.Mesh;

  constructor(
    private inFlame: () => boolean,
    private toggle: (intoFlame: boolean) => void
  ) {
    this.hit = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, LOOP_LEN + 1, 10), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = LOOP_LEN / 2;
    this.glow = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, LOOP_LEN, 12), new THREE.MeshBasicMaterial({ color: 0x6fd2ff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.glow.position.y = LOOP_LEN / 2;
    this.glow.raycast = () => {};
    this.group.add(this.hit, this.glow);
  }

  public hint(): string {
    return this.inFlame()
      ? 'Wire loop is in the flame · click to take it out'
      : 'Flame test · click to dip the loop in the selected vessel\'s liquid and hold it in the flame (burner must be lit)';
  }

  public press(): void {}
  public drag(): void {}
  public release(moved: boolean): void {
    if (!moved) this.toggle(!this.inFlame());
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
