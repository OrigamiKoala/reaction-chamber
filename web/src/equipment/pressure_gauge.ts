import * as THREE from 'three';
import { VesselSnapshot } from '../types/sim';
import { GlasswareMeshBundle } from '../bench/glassware';

/**
 * Bourdon-tube pressure gauge (0..3 atm gauge, red zone > 2 atm) on a brass stem through the vessel's
 * rubber stopper. Local origin = bottom of the stem (sits on the stopper top). Shown only while the measured
 * vessel is sealed (the scene positions it and turns the dial toward the camera).
 */
export class PressureGauge {
  public group = new THREE.Group();
  private needle: THREE.Mesh;
  private dial = new THREE.Group();
  private displayedPressureAtm: number = 1.0;
  private tauSeconds: number = 0.5;
  private attached = false;

  constructor() {
    this.group.name = 'instrument_pressure_gauge';
    const brass = new THREE.MeshStandardMaterial({ color: 0xc9a54a, metalness: 1, roughness: 0.28 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.2, 12), brass);
    stem.position.y = 1.6;
    this.group.add(stem);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.7, 6), brass);
    nut.position.y = 3.2;
    this.group.add(nut);

    this.dial.position.y = 3.2 + 2.9;
    this.group.add(this.dial);
    const steel = new THREE.MeshStandardMaterial({ color: 0xd4d8dc, metalness: 1, roughness: 0.25 });
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 1.3, 40), steel);
    housing.rotation.x = Math.PI / 2;
    this.dial.add(housing);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.18, 10, 40), steel);
    bezel.position.z = 0.66;
    this.dial.add(bezel);

    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fbfbf8';
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();
    const a0 = Math.PI * 0.75;
    const span = Math.PI * 1.5;
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(256, 256, 200, a0 + (2 / 3) * span, a0 + span);
    ctx.stroke();
    ctx.strokeStyle = '#1b1b1b';
    ctx.fillStyle = '#1b1b1b';
    for (let p = 0; p <= 3.0001; p += 0.1) {
      const a = a0 + (p / 3) * span;
      const major = Math.abs(p * 2 - Math.round(p * 2)) < 1e-3;
      ctx.lineWidth = major ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 220, 256 + Math.sin(a) * 220);
      ctx.lineTo(256 + Math.cos(a) * (major ? 180 : 200), 256 + Math.sin(a) * (major ? 180 : 200));
      ctx.stroke();
      if (major) {
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.toFixed(1), 256 + Math.cos(a) * 145, 256 + Math.sin(a) * 145);
      }
    }
    ctx.font = '600 34px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('atm', 256, 340);
    ctx.font = '500 22px Arial';
    ctx.fillText('GAUGE', 256, 372);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.7, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    face.position.z = 0.66;
    this.dial.add(face);

    const needleGeo = new THREE.BoxGeometry(0.1, 2.3, 0.05);
    needleGeo.translate(0, 0.85, 0);
    this.needle = new THREE.Mesh(needleGeo, new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.4 }));
    this.needle.position.z = 0.72;
    this.dial.add(this.needle);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.5 }));
    hub.rotation.x = Math.PI / 2;
    hub.position.z = 0.75;
    this.dial.add(hub);
    const cover = new THREE.Mesh(
      new THREE.CircleGeometry(2.75, 40),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, envMapIntensity: 2, depthWrite: false })
    );
    cover.position.z = 0.8;
    this.dial.add(cover);
    this.group.traverse((o) => {
      o.raycast = () => {};
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.group.visible = false;
    this.setNeedle(0);
  }

  /** Turn the dial face toward a world-space point (yaw only). */
  public faceToward(worldPoint: THREE.Vector3) {
    const p = new THREE.Vector3();
    this.group.getWorldPosition(p);
    this.dial.rotation.y = Math.atan2(worldPoint.x - p.x, worldPoint.z - p.z);
  }

  public attachTo(bundle: GlasswareMeshBundle | null) {
    this.attached = !!bundle;
    if (!bundle) this.group.visible = false;
  }

  private setNeedle(pGauge: number) {
    const f = Math.max(0, Math.min(3, pGauge)) / 3;
    // dial angle (canvas, clockwise from +x) -> rotation about +z (counter-clockwise), needle points +y
    const canvasA = Math.PI * 0.75 + f * Math.PI * 1.5;
    this.needle.rotation.z = -canvasA - Math.PI / 2;
  }

  public update(snap: VesselSnapshot | null, dt: number) {
    if (!snap) return;
    if (!this.attached || !snap.sealed || snap.burst) {
      this.group.visible = false;
      this.displayedPressureAtm += (1.0 - this.displayedPressureAtm) * Math.min(1, dt / this.tauSeconds);
      return;
    }
    this.group.visible = true;
    const alpha = Math.min(1.0, dt / this.tauSeconds);
    this.displayedPressureAtm += (snap.pressure_atm - this.displayedPressureAtm) * alpha;
    this.setNeedle(this.displayedPressureAtm - 1.0);
  }

  public readout(): { pressure_atm: number; gauge_atm: number; formatted: string } {
    const pAbs = Math.round(this.displayedPressureAtm * 100) / 100;
    const pGauge = Math.max(0.0, Math.round((pAbs - 1.0) * 100) / 100);
    return {
      pressure_atm: pAbs,
      gauge_atm: pGauge,
      formatted: `${pGauge.toFixed(2)} atm (g)`,
    };
  }
}
