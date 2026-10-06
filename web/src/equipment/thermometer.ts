import * as THREE from 'three';
import { VesselSnapshot } from '../types/sim';
import { GlasswareMeshBundle } from '../bench/glassware';
import { createGlassMesh } from '../render/glass_material';
import { thermometerScaleTexture } from '../render/textures';
import { BulbState, liquidPropsFromLayer, stepBulb } from './probe_math';

/**
 * 28 cm glass laboratory thermometer (red spirit, -20..110 °C, white enamel scale backing).
 * Local origin = bulb tip, axis +Y. Instrument model: two-node bulb (glass wall + spirit core, `probe_math.ts`: film
 * coefficient from the stirring and the properties of the liquid layer, conduction in the spirit, about 8 s stirred and 14 s unstirred), 0.1 K resolution.
 * The scene moves the whole `group` (see BenchScene.setSelectedVessel).
 */
export const THERMOMETER_RADIUS = 0.34;
const SCALE_Y0 = 2.6;
const SCALE_Y1 = 26.0;

export class Thermometer {
  public group = new THREE.Group();
  private liquidColumn: THREE.Mesh;
  private attachedBundle: GlasswareMeshBundle | null = null;
  private displayedTempK: number = 298.15;
  private bulb: BulbState = { glassK: 298.15, spiritK: 298.15 };

  constructor() {
    this.group.name = 'instrument_thermometer';
    const R = THERMOMETER_RADIUS;
    // glass stem with rounded top
    const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
    for (let i = 0; i <= 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * 0.36, 0.36 + Math.sin(a) * 0.36));
    }
    pts.push(new THREE.Vector2(0.36, 1.6));
    pts.push(new THREE.Vector2(R * 0.85, 2.0));
    pts.push(new THREE.Vector2(R, 2.3));
    pts.push(new THREE.Vector2(R, 27.6));
    for (let i = 1; i <= 6; i++) {
      const a = (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * R, 27.6 + Math.sin(a) * R));
    }
    const stemGeo = new THREE.LatheGeometry(pts, 24);
    const { near } = createGlassMesh(stemGeo);
    near.raycast = () => {};
    near.traverse((o) => (o.raycast = () => {}));
    this.group.add(near);

    // spirit bulb
    const red = new THREE.MeshStandardMaterial({ color: 0xc8161d, roughness: 0.3, emissive: 0x3a0000 });
    const bulb = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.1, 6, 16), red);
    bulb.position.y = 0.95;
    this.group.add(bulb);

    // capillary column (scaled in Y)
    const colGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 8);
    colGeo.translate(0, 0.5, 0);
    this.liquidColumn = new THREE.Mesh(colGeo, red);
    this.liquidColumn.position.set(0, 1.5, 0.07);
    this.group.add(this.liquidColumn);

    // enamel scale backing (faces local +Z)
    const scale = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, SCALE_Y1 - SCALE_Y0 + 1.2),
      new THREE.MeshStandardMaterial({ map: thermometerScaleTexture(), roughness: 0.5 })
    );
    scale.position.set(0, (SCALE_Y0 + SCALE_Y1) / 2, -0.06);
    this.group.add(scale);

    // hanging cap
    const cap = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.06, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.3 })
    );
    cap.position.y = 28.15;
    this.group.add(cap);
    this.group.traverse((o) => {
      o.raycast = () => {};
      if ((o as THREE.Mesh).isMesh && o !== near) (o as THREE.Mesh).castShadow = true;
    });
    this.update(null, 0);
  }

  /** Records the vessel being measured (placement is animated by the scene). */
  public attachTo(bundle: GlasswareMeshBundle | null) {
    this.attachedBundle = bundle;
  }

  public getAttached(): GlasswareMeshBundle | null {
    return this.attachedBundle;
  }

  public update(snap: VesselSnapshot | null, dt: number, stirRpm = 0) {
    if (snap) {
      // the bulb sits in the main liquid: the layer holding most of the volume sets the film coefficient
      const main = snap.layers.reduce<(typeof snap.layers)[number] | null>((a, l) => (a === null || l.volume_ml > a.volume_ml ? l : a), null);
      stepBulb(this.bulb, snap.temperature_k, stirRpm, Math.min(Math.max(dt, 0), 5), liquidPropsFromLayer(main, snap.temperature_k));
      this.displayedTempK = this.bulb.spiritK;
    }

    const tempC = this.displayedTempK - 273.15;
    const clampedC = Math.max(-25.0, Math.min(112.0, tempC));
    const y = SCALE_Y0 + ((clampedC + 20.0) / 130.0) * (SCALE_Y1 - SCALE_Y0);
    this.liquidColumn.scale.set(1, Math.max(0.05, y - 1.5), 1);
  }

  public readout(): { temperature_k: number; temperature_c: number; formatted: string } {
    const quantK = Math.round(this.displayedTempK * 10) / 10;
    const quantC = Math.round((quantK - 273.15) * 10) / 10;
    return {
      temperature_k: quantK,
      temperature_c: quantC,
      formatted: `${quantC.toFixed(1)} °C`,
    };
  }
}
