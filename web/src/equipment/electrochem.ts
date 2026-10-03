import * as THREE from 'three';
import { ElectroReadout, ElectrolysisSpec } from '../types/sim';
import { LcdDisplay, roundedBox, setWorldPose } from './lcd';

export const ELECTRODE_MATERIALS = ['Pt', 'C', 'Cu', 'Zn', 'Ag', 'Fe', 'Al', 'Ni'] as const;
export type ElectrodeMaterial = (typeof ELECTRODE_MATERIALS)[number];

const MATERIAL_COLORS: Record<ElectrodeMaterial, number> = {
  Pt: 0xd8dde2,
  C: 0x222426,
  Cu: 0xb86542,
  Zn: 0x9fa9b3,
  Ag: 0xe8ecef,
  Fe: 0x5a636a,
  Al: 0xc4cbd1,
  Ni: 0xa8b0b5,
};

export class ElectrochemStation {
  public group = new THREE.Group();
  public electrodesGroup = new THREE.Group();
  public saltBridgeGroup = new THREE.Group();

  private vLcd: LcdDisplay;
  private aLcd: LcdDisplay;
  private redCable: THREE.Mesh;
  private blackCable: THREE.Mesh;
  private saltBridgeMesh: THREE.Mesh;

  private anodeRod: THREE.Mesh;
  private cathodeRod: THREE.Mesh;
  private anodeMat: THREE.MeshStandardMaterial;
  private cathodeMat: THREE.MeshStandardMaterial;

  private currentReadout: ElectroReadout | null = null;
  private powerLed: THREE.Mesh;
  private powerLedMat: THREE.MeshBasicMaterial;

  private lastAnodeKey = '';
  private lastCathodeKey = '';
  private lastBridgeKey = '';

  constructor() {
    this.group.name = 'instrument_electrochem';

    // ---------------------------------------------------------------- Power Supply / Potentiostat Chassis
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.45, metalness: 0.15 });
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x181a1d, roughness: 0.5, metalness: 0.1 });
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x5a626a, roughness: 0.3, metalness: 0.8 });

    // Main box: 20cm wide, 11cm high, 18cm deep
    const chassis = new THREE.Mesh(roundedBox(20, 11, 18, 1.0), chassisMat);
    chassis.position.y = 5.5;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.group.add(chassis);

    // Inset front faceplate
    const face = new THREE.Mesh(roundedBox(18.5, 9.6, 0.6, 0.4), faceMat);
    face.position.set(0, 5.5, 9.1);
    this.group.add(face);

    // Bezel border
    const bezel = new THREE.Mesh(roundedBox(19, 10, 0.4, 0.5), bezelMat);
    bezel.position.set(0, 5.5, 8.9);
    this.group.add(bezel);

    // Dual digital LCDs: Voltage (red/orange) and Current (green/cyan)
    this.vLcd = new LcdDisplay(7.5, 3.2, {
      bg: '#181008',
      fg: '#ff3a20',
      ghost: 'rgba(255,58,32,0.08)',
      unit: 'V',
      caption: 'VOLTAGE',
    });
    this.vLcd.mesh.position.set(-4.5, 7.2, 9.45);
    this.group.add(this.vLcd.mesh);

    this.aLcd = new LcdDisplay(7.5, 3.2, {
      bg: '#081812',
      fg: '#20e880',
      ghost: 'rgba(32,232,128,0.08)',
      unit: 'A',
      caption: 'CURRENT',
    });
    this.aLcd.mesh.position.set(4.5, 7.2, 9.45);
    this.group.add(this.aLcd.mesh);

    // Adjustment knobs
    const knobMat = new THREE.MeshStandardMaterial({ color: 0x33383e, roughness: 0.35, metalness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.9, 20), knobMat);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-5.5 + i * 5.5, 3.5, 9.5);
      this.group.add(knob);
    }

    // Power LED indicator
    this.powerLedMat = new THREE.MeshBasicMaterial({ color: 0x203020 });
    this.powerLed = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 16), this.powerLedMat);
    this.powerLed.rotation.x = Math.PI / 2;
    this.powerLed.position.set(-7.5, 9.0, 9.45);
    this.group.add(this.powerLed);

    // Binding Posts: Red (+ / Anode) and Black (- / Cathode)
    const redTerminal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.3, metalness: 0.3 })
    );
    redTerminal.rotation.x = Math.PI / 2;
    redTerminal.position.set(-3.5, 2.0, 9.7);
    this.group.add(redTerminal);

    const blackTerminal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.3 })
    );
    blackTerminal.rotation.x = Math.PI / 2;
    blackTerminal.position.set(3.5, 2.0, 9.7);
    this.group.add(blackTerminal);

    // ---------------------------------------------------------------- Connecting Leads
    const redCableMat = new THREE.MeshStandardMaterial({ color: 0xd12828, roughness: 0.5 });
    const blackCableMat = new THREE.MeshStandardMaterial({ color: 0x1f2326, roughness: 0.5 });

    this.redCable = new THREE.Mesh(new THREE.BufferGeometry(), redCableMat);
    this.blackCable = new THREE.Mesh(new THREE.BufferGeometry(), blackCableMat);
    this.redCable.castShadow = true;
    this.blackCable.castShadow = true;
    this.group.add(this.redCable, this.blackCable);

    // ---------------------------------------------------------------- Dipped Electrodes
    this.anodeMat = new THREE.MeshStandardMaterial({ color: MATERIAL_COLORS.Pt, metalness: 0.85, roughness: 0.25 });
    this.cathodeMat = new THREE.MeshStandardMaterial({ color: MATERIAL_COLORS.Pt, metalness: 0.85, roughness: 0.25 });

    const rodGeo = new THREE.CylinderGeometry(0.2, 0.2, 9.0, 16);
    this.anodeRod = new THREE.Mesh(rodGeo, this.anodeMat);
    this.cathodeRod = new THREE.Mesh(rodGeo, this.cathodeMat);
    this.anodeRod.castShadow = true;
    this.cathodeRod.castShadow = true;

    // Cross-bar acrylic clamp holding the electrodes
    const clampMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 0.1, transmission: 0.8 });
    const clampBar = new THREE.Mesh(roundedBox(5.0, 0.8, 1.2, 0.2), clampMat);
    clampBar.position.set(0, 4.0, 0);

    // Terminal clip caps on rods
    const redClip = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 12), redCableMat);
    redClip.position.set(-1.4, 4.2, 0);
    const blackClip = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 12), blackCableMat);
    blackClip.position.set(1.4, 4.2, 0);

    this.anodeRod.position.set(-1.4, 0, 0);
    this.cathodeRod.position.set(1.4, 0, 0);

    this.electrodesGroup.add(clampBar, redClip, blackClip, this.anodeRod, this.cathodeRod);
    this.electrodesGroup.visible = false;
    this.group.add(this.electrodesGroup);

    // ---------------------------------------------------------------- Salt Bridge (U-Tube)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8f4fa,
      transmission: 0.9,
      opacity: 0.8,
      transparent: true,
      roughness: 0.1,
      ior: 1.48,
    });
    this.saltBridgeMesh = new THREE.Mesh(new THREE.BufferGeometry(), glassMat);
    this.saltBridgeGroup.add(this.saltBridgeMesh);
    this.saltBridgeGroup.visible = false;
    this.group.add(this.saltBridgeGroup);

    this.updateDisplay(0, 0, false);
  }

  public setMaterials(anode: ElectrodeMaterial, cathode: ElectrodeMaterial) {
    this.anodeMat.color.setHex(MATERIAL_COLORS[anode] ?? 0xd8dde2);
    this.cathodeMat.color.setHex(MATERIAL_COLORS[cathode] ?? 0xd8dde2);
    if (anode === 'C') {
      this.anodeMat.metalness = 0.1;
      this.anodeMat.roughness = 0.8;
    } else {
      this.anodeMat.metalness = 0.85;
      this.anodeMat.roughness = 0.25;
    }
    if (cathode === 'C') {
      this.cathodeMat.metalness = 0.1;
      this.cathodeMat.roughness = 0.8;
    } else {
      this.cathodeMat.metalness = 0.85;
      this.cathodeMat.roughness = 0.25;
    }
  }

  public updateDisplay(v: number, a: number, on: boolean) {
    this.vLcd.set(v.toFixed(2), on ? 'ON' : 'STBY');
    this.aLcd.set(a.toFixed(3), on ? 'RUN' : 'OFF');
    this.powerLedMat.color.setHex(on ? 0x00ff66 : 0x203020);
  }

  public updateReadout(r: ElectroReadout | null, on: boolean) {
    this.currentReadout = r;
    if (r) {
      this.updateDisplay(r.cell_voltage_v, r.current_a, on);
    } else {
      this.updateDisplay(0, 0, false);
    }
  }

  public readout(): ElectroReadout | null {
    return this.currentReadout;
  }

  /**
   * Poses the electrode assembly over a target vessel in world space, and shapes the red & black leads.
   */
  public attachToVessel(worldPos: THREE.Vector3, lipHeight: number, liquidLevel: number) {
    this.electrodesGroup.visible = true;

    // Position electrode assembly centered at vessel top
    const targetY = worldPos.y + lipHeight - 1.5;
    const targetWorld = new THREE.Vector3(worldPos.x, targetY, worldPos.z);
    setWorldPose(this.electrodesGroup, targetWorld, new THREE.Quaternion());

    // Route Red Cable from (-3.5, 2.0, 9.7) in meter local space to Anode clip
    const redStartWorld = new THREE.Vector3(-3.5, 2.0, 9.7).applyMatrix4(this.group.matrixWorld);
    const redEndWorld = new THREE.Vector3(-1.4, 4.2, 0).applyMatrix4(this.electrodesGroup.matrixWorld);
    this.routeCable(this.redCable, redStartWorld, redEndWorld, 'red', -3.0);

    // Route Black Cable from (3.5, 2.0, 9.7) to Cathode clip
    const blackStartWorld = new THREE.Vector3(3.5, 2.0, 9.7).applyMatrix4(this.group.matrixWorld);
    const blackEndWorld = new THREE.Vector3(1.4, 4.2, 0).applyMatrix4(this.electrodesGroup.matrixWorld);
    this.routeCable(this.blackCable, blackStartWorld, blackEndWorld, 'black', 3.0);
  }

  public detach() {
    this.electrodesGroup.visible = false;
    this.redCable.geometry.dispose();
    this.redCable.geometry = new THREE.BufferGeometry();
    this.blackCable.geometry.dispose();
    this.blackCable.geometry = new THREE.BufferGeometry();
    this.lastAnodeKey = '';
    this.lastCathodeKey = '';
  }

  /**
   * Creates an authentic inverted glass U-tube salt bridge spanning two beakers.
   */
  public setSaltBridge(vesselAPos: THREE.Vector3, vesselBPos: THREE.Vector3, heightA: number, heightB: number) {
    this.saltBridgeGroup.visible = true;
    const key = `${vesselAPos.x.toFixed(1)},${vesselAPos.z.toFixed(1)}|${vesselBPos.x.toFixed(1)},${vesselBPos.z.toFixed(1)}`;
    if (key === this.lastBridgeKey) return;
    this.lastBridgeKey = key;

    const topY = Math.max(vesselAPos.y + heightA, vesselBPos.y + heightB) + 3.0;
    const dipYA = vesselAPos.y + heightA * 0.4;
    const dipYB = vesselBPos.y + heightB * 0.4;

    const p0 = new THREE.Vector3(vesselAPos.x, dipYA, vesselAPos.z);
    const p1 = new THREE.Vector3(vesselAPos.x, topY, vesselAPos.z);
    const p2 = new THREE.Vector3(
      (vesselAPos.x + vesselBPos.x) / 2,
      topY + 1.2,
      (vesselAPos.z + vesselBPos.z) / 2
    );
    const p3 = new THREE.Vector3(vesselBPos.x, topY, vesselBPos.z);
    const p4 = new THREE.Vector3(vesselBPos.x, dipYB, vesselBPos.z);

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4]);
    // convert world points to saltBridgeGroup local space
    const inv = this.saltBridgeGroup.matrixWorld.clone().invert();
    const localPts = curve.getPoints(24).map((p) => p.applyMatrix4(inv));
    const localCurve = new THREE.CatmullRomCurve3(localPts);

    this.saltBridgeMesh.geometry.dispose();
    this.saltBridgeMesh.geometry = new THREE.TubeGeometry(localCurve, 24, 0.45, 12, false);
  }

  public removeSaltBridge() {
    this.saltBridgeGroup.visible = false;
    this.lastBridgeKey = '';
  }

  private routeCable(cableMesh: THREE.Mesh, startW: THREE.Vector3, endW: THREE.Vector3, id: 'red' | 'black', sagOffset: number) {
    const key = `${startW.x.toFixed(1)},${startW.y.toFixed(1)},${startW.z.toFixed(1)}|${endW.x.toFixed(1)},${endW.y.toFixed(1)},${endW.z.toFixed(1)}`;
    if (id === 'red' && key === this.lastAnodeKey) return;
    if (id === 'black' && key === this.lastCathodeKey) return;
    if (id === 'red') this.lastAnodeKey = key;
    else this.lastCathodeKey = key;

    const mid = new THREE.Vector3().addVectors(startW, endW).multiplyScalar(0.5);
    // natural catenary droop
    mid.y = Math.min(startW.y, endW.y) - 2.5;
    mid.x += sagOffset * 0.4;

    const p0 = startW.clone();
    const p1 = startW.clone().add(new THREE.Vector3(0, 0, 3));
    const p2 = mid;
    const p3 = endW.clone().add(new THREE.Vector3(0, 3, 0));
    const p4 = endW.clone();

    const worldCurve = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4]);
    const inv = this.group.matrixWorld.clone().invert();
    const localPts = worldCurve.getPoints(20).map((p) => p.applyMatrix4(inv));
    const localCurve = new THREE.CatmullRomCurve3(localPts);

    cableMesh.geometry.dispose();
    cableMesh.geometry = new THREE.TubeGeometry(localCurve, 20, 0.22, 8, false);
  }
}
