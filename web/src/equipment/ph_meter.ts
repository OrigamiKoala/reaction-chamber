import * as THREE from 'three';
import { VesselSnapshot } from '../types/sim';
import { GlasswareMeshBundle } from '../bench/glassware';
import { createGlassMesh } from '../render/glass_material';
import { LcdDisplay, roundedBox, setWorldPose } from './lcd';

/**
 * Benchtop digital pH meter + combination glass electrode on a cable.
 * Instrument model: 0.01 pH resolution, tau = 3 s, "---" when the probe is not immersed.
 * `group` = meter body (placed by the scene); `probe` = electrode (child of group, posed in world space via
 * `setProbeWorldPose`); the cable is re-shaped whenever the probe moves.
 */
export const PH_PROBE_RADIUS = 0.6;

export class PHMeter {
  public group = new THREE.Group();
  public probe = new THREE.Group();
  private lcd: LcdDisplay;
  private displayedPh: number | null = null;
  private tauSeconds: number = 3.0;
  private immersed = true;
  private cable: THREE.Mesh;
  private cableMat: THREE.MeshStandardMaterial;
  private lastCableKey = '';
  private socketLocal = new THREE.Vector3(0, 5.2, -8.4);

  constructor() {
    this.group.name = 'instrument_ph_meter';
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe7e9e6, roughness: 0.45, metalness: 0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c3136, roughness: 0.5, metalness: 0 });
    const body = new THREE.Mesh(roundedBox(16, 4.5, 18, 1.2), bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    // sloped control panel
    const panel = new THREE.Mesh(roundedBox(14.5, 1.0, 11, 0.8), darkMat);
    panel.position.set(0, 4.3, 0.8);
    panel.rotation.x = 0.32;
    panel.castShadow = true;
    this.group.add(panel);
    // LCD
    this.lcd = new LcdDisplay(9.5, 4.2, { bg: '#b4c39c', fg: '#151d0e', ghost: 'rgba(21,29,14,0.08)', unit: 'pH', caption: 'ATC  25.0°C' });
    this.lcd.mesh.position.set(0, 5.84, -0.6);
    this.lcd.mesh.rotation.x = -Math.PI / 2 + 0.32;
    this.group.add(this.lcd.mesh);
    // buttons
    const btnGeo = roundedBox(2.4, 0.5, 1.3, 0.3);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x8a949c, roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(btnGeo, i === 2 ? new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.5 }) : btnMat);
      b.position.set(-3.3 + i * 3.3, 4.2, 4.2);
      b.rotation.x = 0.32;
      this.group.add(b);
    }
    // BNC socket
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0xc0c4c8, metalness: 1, roughness: 0.3 }));
    sock.rotation.x = Math.PI / 2;
    sock.position.set(0, 2.6, -9.2);
    this.group.add(sock);
    this.socketLocal.set(0, 2.6, -9.6);

    this.buildProbe();
    this.group.add(this.probe);

    this.cableMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.55 });
    this.cable = new THREE.Mesh(new THREE.BufferGeometry(), this.cableMat);
    this.cable.castShadow = true;
    this.group.add(this.cable);
    this.group.traverse((o) => (o.raycast = () => {}));
    this.lcd.set('---');
  }

  private buildProbe() {
    // origin at the glass bulb tip, axis +Y
    const glassPts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.28, 0.06),
      new THREE.Vector2(0.42, 0.3),
      new THREE.Vector2(0.45, 0.55),
      new THREE.Vector2(0.38, 0.9),
      new THREE.Vector2(0.5, 1.1),
      new THREE.Vector2(0.5, 2.2),
    ];
    const { near } = createGlassMesh(new THREE.LatheGeometry(glassPts, 20));
    this.probe.add(near);
    const fill = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 1.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9e4ea, roughness: 0.2, transparent: true, opacity: 0.6 })
    );
    fill.position.y = 1.4;
    this.probe.add(fill);
    const epoxy = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.35, metalness: 0 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(PH_PROBE_RADIUS, PH_PROBE_RADIUS, 11.5, 20), epoxy);
    shaft.position.y = 2.1 + 5.75;
    shaft.castShadow = true;
    this.probe.add(shaft);
    // guard window
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(PH_PROBE_RADIUS + 0.02, PH_PROBE_RADIUS + 0.02, 1.0, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a4148, roughness: 0.4 }));
    guard.position.y = 2.4;
    this.probe.add(guard);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, PH_PROBE_RADIUS, 1.6, 16), new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.45 }));
    cap.position.y = 2.1 + 11.5 + 0.8;
    this.probe.add(cap);
    const relief = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.6, 10), epoxy);
    relief.position.y = 2.1 + 11.5 + 2.4;
    this.probe.add(relief);
  }

  /** Length from the tip to the cable exit, cm. */
  public static readonly PROBE_LENGTH = 17.0;

  /** Pose the electrode in world space (tip position + axis quaternion), and re-route the cable. */
  public setProbeWorldPose(pos: THREE.Vector3, quat: THREE.Quaternion) {
    setWorldPose(this.probe, pos, quat);
    this.updateCable();
  }

  private updateCable() {
    this.group.updateWorldMatrix(true, false);
    const top = new THREE.Vector3(0, PHMeter.PROBE_LENGTH - 0.2, 0).applyQuaternion(this.probe.quaternion).add(this.probe.position);
    const key = `${top.x.toFixed(2)},${top.y.toFixed(2)},${top.z.toFixed(2)}`;
    if (key === this.lastCableKey) return;
    this.lastCableKey = key;
    const s = this.socketLocal.clone();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.probe.quaternion);
    const p1 = top.clone().addScaledVector(up, 4);
    const mid = top.clone().lerp(s, 0.5);
    const dist = top.distanceTo(s);
    mid.y = Math.max(0.6, Math.min(top.y, s.y) - dist * 0.25);
    const p3 = s.clone().add(new THREE.Vector3(0, 0, -3));
    p3.y = 1.0;
    const curve = new THREE.CatmullRomCurve3([top, p1, mid, p3, s]);
    const g = new THREE.TubeGeometry(curve, 48, 0.22, 8, false);
    this.cable.geometry.dispose();
    this.cable.geometry = g;
  }

  /** Records the vessel being measured (placement is animated by the scene). */
  public attachTo(bundle: GlasswareMeshBundle | null) {
    void bundle;
  }

  /** Scene tells the meter whether the glass bulb is below the liquid surface. */
  public setImmersed(on: boolean) {
    this.immersed = on;
  }

  public update(snap: VesselSnapshot | null, dt: number) {
    const isImmersed = !!snap && this.immersed && snap.total_liquid_ml > 0.1 && snap.ph !== null && !snap.burst;
    if (!isImmersed) {
      this.displayedPh = null;
      this.lcd.set('---');
      return;
    }
    const targetPh = snap!.ph!;
    if (this.displayedPh === null) {
      // electrodes drift in from ~7 when first dipped
      this.displayedPh = 7.0 + (targetPh - 7.0) * 0.35;
    } else {
      const alpha = Math.min(1.0, dt / this.tauSeconds);
      this.displayedPh += (targetPh - this.displayedPh) * alpha;
    }
    const quantPh = Math.round(this.displayedPh * 100) / 100;
    const tC = snap!.temperature_k - 273.15;
    this.lcd.set(quantPh.toFixed(2), `ATC  ${tC.toFixed(1)}°C`);
  }

  public readout(): { ph: number | null; formatted: string } {
    if (this.displayedPh === null) {
      return { ph: null, formatted: '---' };
    }
    const quantPh = Math.round(this.displayedPh * 100) / 100;
    return { ph: quantPh, formatted: quantPh.toFixed(2) };
  }
}
