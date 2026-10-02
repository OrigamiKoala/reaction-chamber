import * as THREE from 'three';
import { roundedBox } from './lcd';

/**
 * Magnetic stirrer plate with a white glazed tile on top (the titration station): stirring only, no heating. The tile
 * makes a colour change at the endpoint easy to see. Group origin = centre of the plate on whatever it stands on.
 */
export const STIR_BODY_H = 3.6;
export const TILE_H = 0.5;
export const TILE_SIZE = 12.5;
/** Height of the tile surface above the plate's underside (where a flask stands). */
export const STIR_TOP_Y = STIR_BODY_H + TILE_H;

export class StirPlate {
  public readonly group = new THREE.Group();
  /** Invisible pick target for the speed knob: userData.pick = { type: 'stirknob', id: 'stirrer' }. */
  public readonly knobPick: THREE.Mesh;
  private knob: THREE.Group;
  private led: THREE.MeshStandardMaterial;
  private on = false;
  private spin = 0;
  private glow = 0;

  constructor() {
    this.group.name = 'equipment_stir_plate';
    const body = new THREE.MeshStandardMaterial({ color: 0x2c3238, roughness: 0.5, metalness: 0.15 });
    const chassis = new THREE.Mesh(roundedBox(16, STIR_BODY_H, 16, 1.2), body);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.group.add(chassis);
    // brushed aluminium top plate
    const alu = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 0.85, roughness: 0.38 });
    const top = new THREE.Mesh(roundedBox(15.2, 0.28, 15.2, 1.0), alu);
    top.position.set(0, STIR_BODY_H - 0.14, 0);
    top.receiveShadow = true;
    this.group.add(top);
    // white glazed tile
    const tileMat = new THREE.MeshPhysicalMaterial({ color: 0xf6f5f0, roughness: 0.3, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.25 });
    const tile = new THREE.Mesh(roundedBox(TILE_SIZE, TILE_H, TILE_SIZE, 0.5), tileMat);
    tile.position.set(0, STIR_BODY_H, 0);
    tile.castShadow = true;
    tile.receiveShadow = true;
    this.group.add(tile);
    // front face: speed knob + LED
    this.knob = new THREE.Group();
    const knobMat = new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.45, metalness: 0.1 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 1.1, 20), knobMat);
    cap.rotation.x = Math.PI / 2;
    this.knob.add(cap);
    const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.25), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
    pointer.position.set(0, 0.55, 0.6);
    this.knob.add(pointer);
    this.knob.position.set(3.6, 1.7, 8.2);
    this.group.add(this.knob);
    this.led = new THREE.MeshStandardMaterial({ color: 0x002a00, emissive: 0x30ff60, emissiveIntensity: 0 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), this.led);
    led.position.set(-3.2, 1.7, 8.35);
    this.group.add(led);
    const feet = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 });
    for (const [x, z] of [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.3, 12), feet);
      f.position.set(x, 0.05, z);
      this.group.add(f);
    }
    this.group.traverse((o) => (o.raycast = () => {}));

    this.knobPick = new THREE.Mesh(new THREE.SphereGeometry(2.1, 10, 8), new THREE.MeshBasicMaterial());
    this.knobPick.visible = false;
    this.knobPick.position.copy(this.knob.position);
    this.knobPick.userData.pick = { type: 'stirknob', id: 'stirrer' };
    this.group.add(this.knobPick);
  }

  public setOn(on: boolean) {
    this.on = on;
  }

  public get isOn(): boolean {
    return this.on;
  }

  /** Per-frame: LED glow and knob turning. */
  public animate(dt: number) {
    this.glow += ((this.on ? 1 : 0) - this.glow) * Math.min(1, dt * 8);
    this.led.emissiveIntensity = this.glow * 1.8;
    const target = this.on ? -1.9 : 0;
    this.spin += (target - this.spin) * Math.min(1, dt * 7);
    this.knob.rotation.z = this.spin;
  }
}
