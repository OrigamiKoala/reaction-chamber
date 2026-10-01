import * as THREE from 'three';
import { VesselSnapshot, VesselControls } from '../types/sim';
import { FlameCluster } from '../render/flame';

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
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.4, 24), brass);
    collar.position.y = 3.6;
    this.group.add(collar);
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
      new THREE.Vector3(-16, 0.45, 20),
    ]);
    const hoseMesh = new THREE.Mesh(new THREE.TubeGeometry(hose, 40, 0.42, 10, false), new THREE.MeshStandardMaterial({ color: 0xc0471d, roughness: 0.6 }));
    hoseMesh.castShadow = true;
    this.group.add(hoseMesh);

    this.flame = new FlameCluster(1);
    this.flame.configure(0, 2.0, 9.0, { luminosity: 0.0, emitterAmount: 0 });
    this.flame.setInnerCone(true);
    this.flame.group.position.y = BURNER_TOP_Y;
    this.group.add(this.flame.group);
    this.group.traverse((o) => (o.raycast = () => {}));
  }

  public ignite(powerW: number = 800.0) {
    this.isActive = true;
    this.powerWatts = powerW;
    this.flame.setTarget(1.0);
  }

  public extinguish() {
    this.isActive = false;
    this.powerWatts = 0.0;
    this.flame.setTarget(0);
  }

  /** Kept for API compatibility; animation runs per frame via `animate` (driven by the scene). */
  public update(_snap: VesselSnapshot | null, _dt: number) {}

  /** Per-frame flame animation (called by the scene). */
  public animate(dt: number) {
    this.time += dt;
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
