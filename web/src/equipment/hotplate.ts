import * as THREE from 'three';
import { VesselSnapshot, VesselControls } from '../types/sim';
import { GlasswareMeshBundle } from '../bench/glassware';
import { hotplateGlowTexture, hotplateTopTexture } from '../render/textures';
import { LcdDisplay, roundedBox } from './lcd';
import { Control3D, Knob, Selector, place, textLegend } from '../bench/controls3d';

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
  /** Front-panel controls (HEAT knob, STIR switch); the scene registers them with its control rig. */
  public readonly controls: Control3D[] = [];
  private heatKnob: Knob;
  private stirSwitch: Selector;
  private lcd: LcdDisplay;
  /** The user turned the HEAT knob. Return false to refuse (the knob snaps back to its previous value). */
  public onHeat?: (watts: number) => boolean | void;
  /** The user flipped the STIR switch. Return false to refuse. */
  public onStir?: (on: boolean) => boolean | void;
  private heatLed: THREE.MeshStandardMaterial;
  private stirLed: THREE.MeshStandardMaterial;
  private glow = 0;
  public heaterWatts: number = 0.0;
  public isStirring: boolean = false;
  public stirRpm: number = 0.0;

  constructor() {
    this.group.name = 'equipment_hotplate';
    const body = new THREE.MeshStandardMaterial({ color: 0x32373d, roughness: 0.5, metalness: 0.1 });
    const chassis = new THREE.Mesh(roundedBox(19, 9.4, 24, 1.4), body);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.group.add(chassis);
    // aluminium top frame
    const alu = new THREE.MeshStandardMaterial({ color: 0x5a6066, metalness: 0.85, roughness: 0.35 });
    const frame = new THREE.Mesh(roundedBox(19, 0.4, 19.4, 1.0), alu);
    frame.position.set(0, 9.3, -2.0);
    frame.castShadow = true;
    this.group.add(frame);
    // glass-ceramic plate
    this.topMat = new THREE.MeshStandardMaterial({
      map: hotplateTopTexture(),
      roughness: 0.28,
      metalness: 0.05,
      emissive: new THREE.Color(1.0, 0.28, 0.06),
      emissiveMap: hotplateGlowTexture(),
      emissiveIntensity: 0,
    });
    this.ceramicTop = new THREE.Mesh(roundedBox(18, 0.32, 18, 0.8), this.topMat);
    this.ceramicTop.position.set(0, HOTPLATE_TOP_Y - 0.32, -2.0);
    this.ceramicTop.receiveShadow = true;
    this.group.add(this.ceramicTop);
    // front control panel: a dark fascia on the vertical front face, controls facing the user
    const fascia = new THREE.Mesh(roundedBox(17.4, 0.5, 7.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.55 }));
    fascia.rotation.x = Math.PI / 2;
    fascia.position.set(0, 4.7, 12.7); // chassis front face = 12 + bevel 0.7
    this.group.add(fascia);
    this.heatKnob = new Knob({
      id: 'hotplate.heat',
      caption: 'HEAT',
      min: 0,
      max: 1000,
      step: 50,
      value: 0,
      radius: 1.45,
      accent: 0xff6a3d,
      ticks: 11,
      labels: [
        { at: 0, text: 'OFF' },
        { at: 1, text: '1000W' },
      ],
      format: (v) => (v <= 0 ? 'off' : `${v} W`),
      onChange: (v) => {
        const prev = this.heaterWatts;
        this.setPower(v);
        if (this.onHeat?.(v) === false) this.setPower(prev);
      },
    });
    place(this.heatKnob, this.group, [-5.4, 4.5, 13.2], [0, 0, 1]);
    this.stirSwitch = new Selector({
      id: 'hotplate.stir',
      caption: 'STIR',
      labels: ['OFF', 'ON'],
      radius: 1.3,
      accent: 0x4aa8ff,
      describe: (i) => (i === 1 ? 'magnetic stirrer on' : 'stirrer off'),
      onChange: (i) => {
        const prev = this.isStirring;
        const prevRpm = this.stirRpm;
        this.setStir(i === 1);
        if (this.onStir?.(i === 1) === false) this.setStir(prev, prevRpm);
      },
    });
    place(this.stirSwitch, this.group, [5.4, 4.5, 13.2], [0, 0, 1]);
    this.controls.push(this.heatKnob, this.stirSwitch);
    // power read-out between the controls
    this.lcd = new LcdDisplay(5.4, 2.4, { bg: '#1b0f0b', fg: '#ff6a2a', ghost: 'rgba(255,106,42,0.08)', unit: 'W', caption: 'SET' });
    this.lcd.mesh.position.set(0, 5.5, 13.22);
    this.group.add(this.lcd.mesh);
    this.updateLcd(0);
    const cap = textLegend('HOT PLATE / STIRRER', 6.4, 0.62, { ink: '#9aa4ab', weight: 700 });
    cap.rotation.x = 0; // the legend is printed on the vertical face
    cap.position.set(0, 3.2, 13.22);
    this.group.add(cap);
    this.heatLed = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2a10, emissiveIntensity: 0 });
    this.stirLed = new THREE.MeshStandardMaterial({ color: 0x002a00, emissive: 0x30ff60, emissiveIntensity: 0 });
    const ledGeo = new THREE.SphereGeometry(0.22, 10, 8);
    const l1 = new THREE.Mesh(ledGeo, this.heatLed);
    l1.position.set(-1.5, 3.7, 13.25);
    const l2 = new THREE.Mesh(ledGeo, this.stirLed);
    l2.position.set(1.5, 3.7, 13.25);
    this.group.add(l1, l2);
    const feet = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 });
    for (const [x, z] of [[-8, -10], [8, -10], [-8, 10], [8, 10]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.5, 12), feet);
      f.position.set(x, -0.15, z);
      this.group.add(f);
    }
    this.group.traverse((o) => (o.raycast = () => {}));
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
    this.heatKnob.setValue(this.heaterWatts);
    this.heatLed.emissiveIntensity = this.heaterWatts > 0 ? 2.5 : 0;
    this.updateLcd(this.heaterWatts);
  }

  public setStir(stir: boolean, rpm: number = 400.0) {
    this.isStirring = stir;
    this.stirRpm = stir ? rpm : 0.0;
    this.stirSwitch.setIndex(stir ? 1 : 0);
    this.stirLed.emissiveIntensity = stir ? 2.0 : 0;
  }

  private updateLcd(watts: number) {
    this.lcd.set(String(Math.round(watts)), watts > 0 ? 'HEATING' : 'SET');
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
