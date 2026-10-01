import * as THREE from 'three';
import { VesselSnapshot } from '../types/sim';
import { GlasswareMeshBundle } from '../bench/glassware';
import { LcdDisplay, roundedBox } from './lcd';

/**
 * Top-loading precision balance (0.01 g, tau 0.8 s, tare). It reports the mass of the *selected* vessel
 * (glass + contents) — vessels are never moved onto the pan implicitly.
 */
export class Balance {
  public group = new THREE.Group();
  private lcd: LcdDisplay;
  private displayedMassG: number = 0.0;
  private tareOffsetG: number = 0.0;
  private attachedGlassMassG: number = 0.0;
  private attached = false;
  private tauSeconds: number = 0.8;

  constructor() {
    this.group.name = 'instrument_balance';
    const body = new THREE.Mesh(
      roundedBox(20, 6.5, 27, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xeceeec, roughness: 0.42, metalness: 0 })
    );
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    // weighing pan
    const steel = new THREE.MeshStandardMaterial({ color: 0xe1e4e7, metalness: 1, roughness: 0.18 });
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.4, 0.35, 48), steel);
    pan.position.set(0, 6.85, -3);
    pan.castShadow = true;
    pan.receiveShadow = true;
    this.group.add(pan);
    const support = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.4, 16), steel);
    support.position.set(0, 6.6, -3);
    this.group.add(support);
    // display bezel + LCD on the front
    const bezel = new THREE.Mesh(roundedBox(14, 0.6, 5.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.5 }));
    bezel.position.set(0, 6.3, 10.2);
    bezel.rotation.x = 0.25;
    this.group.add(bezel);
    this.lcd = new LcdDisplay(8.5, 2.6, { bg: '#0f1a14', fg: '#a8f7c0', ghost: 'rgba(168,247,192,0.06)', unit: 'g' });
    this.lcd.mesh.position.set(-1.6, 6.95, 10.1);
    this.lcd.mesh.rotation.x = -Math.PI / 2 + 0.25;
    this.group.add(this.lcd.mesh);
    const keyMat = new THREE.MeshStandardMaterial({ color: 0x5f6b74, roughness: 0.6 });
    for (let i = 0; i < 2; i++) {
      const k = new THREE.Mesh(roundedBox(1.6, 0.35, 1.1, 0.25), keyMat);
      k.position.set(4.3 + i * 1.9, 6.85, 10.4);
      k.rotation.x = 0.25;
      this.group.add(k);
    }
    // levelling feet
    const footMat = new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.8 });
    for (const [x, z] of [[-8.5, -11.5], [8.5, -11.5], [-8.5, 11.5], [8.5, 11.5]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.4, 12), footMat);
      f.position.set(x, -0.1, z);
      this.group.add(f);
    }
    this.group.traverse((o) => (o.raycast = () => {}));
    this.renderScreen(0);
  }

  /** Select which vessel is being weighed (no implicit teleport onto the pan). */
  public attachTo(bundle: GlasswareMeshBundle | null) {
    this.attached = !!bundle;
    if (bundle) {
      switch (bundle.vesselState.type) {
        case 'beaker-50': this.attachedGlassMassG = 35.0; break;
        case 'beaker-250': this.attachedGlassMassG = 110.0; break;
        case 'beaker-1000': this.attachedGlassMassG = 320.0; break;
        case 'erlenmeyer-250': this.attachedGlassMassG = 130.0; break;
        case 'cylinder-100': this.attachedGlassMassG = 145.0; break;
        case 'test-tube': this.attachedGlassMassG = 18.0; break;
        default: this.attachedGlassMassG = 60.0; break;
      }
    } else {
      this.attachedGlassMassG = 0.0;
    }
  }

  public tare() {
    this.tareOffsetG += this.displayedMassG;
  }

  public update(snap: VesselSnapshot | null, dt: number) {
    const rawMass = snap && this.attached && !snap.burst ? this.attachedGlassMassG + snap.contents_mass_g : 0.0;
    const targetNetMass = rawMass - this.tareOffsetG;
    const alpha = Math.min(1.0, dt / this.tauSeconds);
    this.displayedMassG += (targetNetMass - this.displayedMassG) * alpha;
    this.renderScreen(Math.round(this.displayedMassG * 100) / 100);
  }

  private renderScreen(val: number) {
    this.lcd.set(val.toFixed(2));
  }

  public readout(): { mass_g: number; formatted: string } {
    const quant = Math.round(this.displayedMassG * 100) / 100;
    return { mass_g: quant, formatted: `${quant.toFixed(2)} g` };
  }
}
