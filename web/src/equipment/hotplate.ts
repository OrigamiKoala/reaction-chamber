import * as THREE from 'three';
import { VesselSnapshot, VesselControls } from '../types/sim';
import { GlasswareMeshBundle } from '../bench/glassware';
import { hotplateGlowTexture, hotplateTopTexture } from '../render/textures';
import { roundedBox } from './lcd';

/**
 * Hot plate / magnetic stirrer (18 × 18 cm glass-ceramic top, 10 cm tall). The top glows with a thermal lag
 * proportional to power. `topLocal` is where a vessel stands (group coordinates).
 */
export const HOTPLATE_TOP_Y = 10.0;

export class HotPlate {
  public group = new THREE.Group();
  public readonly topLocal = new THREE.Vector3(0, HOTPLATE_TOP_Y, -2.0);
  private ceramicTop: THREE.Mesh;
  private topMat: THREE.MeshStandardMaterial;
  private heaterKnob: THREE.Group;
  private stirKnob: THREE.Group;
  private heatLed: THREE.MeshStandardMaterial;
  private stirLed: THREE.MeshStandardMaterial;
  private glow = 0;
  public heaterWatts: number = 0.0;
  public isStirring: boolean = false;
  public stirRpm: number = 0.0;

  constructor() {
    this.group.name = 'equipment_hotplate';
    const body = new THREE.MeshStandardMaterial({ color: 0xe9ebe8, roughness: 0.4, metalness: 0 });
    const chassis = new THREE.Mesh(roundedBox(19, 9.4, 24, 1.4), body);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.group.add(chassis);
    // aluminium top frame
    const alu = new THREE.MeshStandardMaterial({ color: 0xb9bec3, metalness: 1, roughness: 0.35 });
    const frame = new THREE.Mesh(roundedBox(19, 0.4, 19.4, 1.0), alu);
    frame.position.set(0, 9.3, -2.0);
    frame.castShadow = true;
    this.group.add(frame);
    // glass-ceramic plate
    this.topMat = new THREE.MeshStandardMaterial({
      map: hotplateTopTexture(),
      roughness: 0.18,
      metalness: 0,
      emissive: new THREE.Color(1.0, 0.28, 0.06),
      emissiveMap: hotplateGlowTexture(),
      emissiveIntensity: 0,
    });
    this.ceramicTop = new THREE.Mesh(roundedBox(18, 0.32, 18, 0.8), this.topMat);
    this.ceramicTop.position.set(0, HOTPLATE_TOP_Y - 0.32, -2.0);
    this.ceramicTop.receiveShadow = true;
    this.group.add(this.ceramicTop);
    // front control panel
    const panel = new THREE.Mesh(roundedBox(17, 0.3, 3.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x31373d, roughness: 0.55 }));
    panel.position.set(0, 9.38, 9.6);
    this.group.add(panel);
    this.heaterKnob = this.makeKnob(0xd84315);
    this.heaterKnob.position.set(-4.5, 9.7, 9.6);
    this.stirKnob = this.makeKnob(0x1e88e5);
    this.stirKnob.position.set(4.5, 9.7, 9.6);
    this.group.add(this.heaterKnob, this.stirKnob);
    this.heatLed = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2a10, emissiveIntensity: 0 });
    this.stirLed = new THREE.MeshStandardMaterial({ color: 0x002a00, emissive: 0x30ff60, emissiveIntensity: 0 });
    const ledGeo = new THREE.SphereGeometry(0.22, 10, 8);
    const l1 = new THREE.Mesh(ledGeo, this.heatLed);
    l1.position.set(-1.2, 9.6, 9.6);
    const l2 = new THREE.Mesh(ledGeo, this.stirLed);
    l2.position.set(1.2, 9.6, 9.6);
    this.group.add(l1, l2);
    const feet = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 });
    for (const [x, z] of [[-8, -10], [8, -10], [-8, 10], [8, 10]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.5, 12), feet);
      f.position.set(x, -0.15, z);
      this.group.add(f);
    }
    this.group.traverse((o) => (o.raycast = () => {}));
  }

  private makeKnob(accent: number): THREE.Group {
    const g = new THREE.Group();
    const k = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 1.2, 28), new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.35 }));
    k.position.y = 0.6;
    k.castShadow = true;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.9), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.4 }));
    mark.position.set(0, 1.22, -0.6);
    g.add(k, mark);
    return g;
  }

  /** Legacy helper: snaps a vessel onto the plate (the scene animates placement instead). */
  public attachTo(bundle: GlasswareMeshBundle | null) {
    if (bundle) {
      const p = this.topLocal.clone();
      this.group.localToWorld(p);
      bundle.group.position.copy(p);
    }
  }

  public setPower(watts: number) {
    this.heaterWatts = Math.max(0.0, Math.min(1000.0, watts));
    this.heaterKnob.rotation.y = -(this.heaterWatts / 1000.0) * Math.PI * 1.5;
    this.heatLed.emissiveIntensity = this.heaterWatts > 0 ? 2.5 : 0;
  }

  public setStir(stir: boolean, rpm: number = 400.0) {
    this.isStirring = stir;
    this.stirRpm = stir ? rpm : 0.0;
    this.stirKnob.rotation.y = stir ? -(rpm / 1500.0) * Math.PI * 1.5 : 0.0;
    this.stirLed.emissiveIntensity = stir ? 2.0 : 0;
  }

  public getControls(): VesselControls {
    return {
      heater_w: this.heaterWatts,
      stirring: this.isStirring,
      stir_rpm: this.stirRpm,
    };
  }

  public update(_snap: VesselSnapshot | null, _dt: number) {}

  /** Per-frame: thermal lag of the visible glow (~4 s). */
  public animate(dt: number) {
    const target = this.heaterWatts / 1000;
    this.glow += (target - this.glow) * Math.min(1, dt / 4);
    this.topMat.emissiveIntensity = Math.pow(this.glow, 0.8) * 2.4;
  }
}
