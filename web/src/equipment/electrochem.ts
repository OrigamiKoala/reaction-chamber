import * as THREE from 'three';
import { ElectroReadout, ElectrolysisSpec } from '../types/sim';
import { LcdDisplay, frontPlate, roundedBox, setWorldPose } from './lcd';
import { Control3D, Knob, PushButton, Rocker, Selector, place } from '../bench/controls3d';
import { ELECTRODE_LENGTH, ELECTRODE_RADIUS, ELECTRODE_X, electrodeBottomY } from '../render/electrode_geometry';

import { ELECTRODE_MATERIALS, ElectrodeMaterial } from './electrode_materials';
export { ELECTRODE_MATERIALS };
export type { ElectrodeMaterial };

const MATERIAL_COLORS: Record<string, number> = {
  Pt: 0xd8dde2,
  C: 0x222426,
  Cu: 0xb86542,
  Zn: 0x9fa9b3,
  Ag: 0xe8ecef,
  Fe: 0x5a636a,
  Al: 0xc4cbd1,
  Ni: 0xa8b0b5,
  Co: 0x8d97a5,
  Mg: 0xcfd3d6,
  Mn: 0x9a8f9a,
  Pb: 0x6f767c,
};

/** Electrode materials on the front-panel selectors: the engine's list from its species store (`electrode_materials.ts`). */
export const PANEL_MATERIALS = ELECTRODE_MATERIALS;
const RED_POST = new THREE.Vector3(-4, 1.9, 9.8);
const BLACK_POST = new THREE.Vector3(4, 1.9, 9.8);

/** Complete state of the console's controls (pushed from the lab, read by the instrument panel). */
export interface PotentiostatPanel {
  mode: 'voltage' | 'current';
  volts: number;
  amps: number;
  anode: ElectrodeMaterial;
  cathode: ElectrodeMaterial;
  on: boolean;
  dipped: boolean;
  bridged: boolean;
}

export class ElectrochemStation {
  /** Front-panel controls; the scene registers them with its control rig. */
  public readonly controls: Control3D[] = [];
  public onVoltage?: (v: number) => void;
  public onCurrent?: (a: number) => void;
  public onMode?: (mode: 'voltage' | 'current') => void;
  public onMaterials?: (anode: ElectrodeMaterial, cathode: ElectrodeMaterial) => void;
  public onPower?: (on: boolean) => void;
  public onDip?: () => void;
  public onBridge?: () => void;
  private voltKnob!: Knob;
  private currKnob!: Knob;
  private modeSel!: Selector;
  private anodeSel!: Selector;
  private cathodeSel!: Selector;
  private powerRocker!: Rocker;
  private dipBtn!: PushButton;
  private bridgeBtn!: PushButton;

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

    // Main box: 28 cm wide, 12 cm high, 18 cm deep
    const chassis = new THREE.Mesh(roundedBox(28, 12, 18, 1.0), chassisMat);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.group.add(chassis);

    // Front faceplate (front at z = 9.6)
    const face = frontPlate(26.6, 10.6, 0.6, 0.5, faceMat);
    face.position.set(0, 6, 9.0);
    this.group.add(face);

    // Dual digital LCDs: Voltage (red/orange) and Current (green/cyan)
    this.vLcd = new LcdDisplay(9.4, 3.4, { bg: '#181008', fg: '#ff3a20', ghost: 'rgba(255,58,32,0.08)', unit: 'V', caption: 'VOLTAGE' });
    this.vLcd.mesh.position.set(-6.8, 9.2, 9.65);
    this.group.add(this.vLcd.mesh);

    this.aLcd = new LcdDisplay(9.4, 3.4, { bg: '#081812', fg: '#20e880', ghost: 'rgba(32,232,128,0.08)', unit: 'A', caption: 'CURRENT' });
    this.aLcd.mesh.position.set(6.8, 9.2, 9.65);
    this.group.add(this.aLcd.mesh);

    // Power LED indicator between the displays
    this.powerLedMat = new THREE.MeshBasicMaterial({ color: 0x203020 });
    this.powerLed = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16), this.powerLedMat);
    this.powerLed.rotation.x = Math.PI / 2;
    this.powerLed.position.set(0, 9.2, 9.7);
    this.group.add(this.powerLed);

    // ---------------------------------------------------------------- front-panel controls
    this.voltKnob = new Knob({
      id: 'electrochem.volts',
      caption: 'SET V',
      min: 0,
      max: 12,
      step: 0.05,
      value: 2.5,
      radius: 1.15,
      accent: 0xff5a36,
      ticks: 13,
      labels: [
        { at: 0, text: '0' },
        { at: 1, text: '12' },
      ],
      format: (v) => `${v.toFixed(2)} V (constant-voltage target)`,
      onChange: (v) => this.onVoltage?.(v),
    });
    this.currKnob = new Knob({
      id: 'electrochem.amps',
      caption: 'LIMIT I',
      min: 0.01,
      max: 5,
      step: 0.05,
      value: 1,
      radius: 1.15,
      accent: 0x2ee88a,
      ticks: 11,
      labels: [
        { at: 0, text: '0' },
        { at: 1, text: '5A' },
      ],
      format: (v) => `${v.toFixed(2)} A (constant-current target)`,
      onChange: (v) => this.onCurrent?.(v),
    });
    this.modeSel = new Selector({
      id: 'electrochem.mode',
      caption: 'MODE',
      labels: ['V', 'I'],
      radius: 1.05,
      accent: 0xffd34a,
      describe: (i) => (i === 0 ? 'potentiostatic: holds the voltage' : 'galvanostatic: holds the current'),
      onChange: (i) => this.onMode?.(i === 0 ? 'voltage' : 'current'),
    });
    this.anodeSel = new Selector({
      id: 'electrochem.anode',
      caption: 'ANODE +',
      labels: [...PANEL_MATERIALS],
      radius: 1.05,
      accent: 0xff6b5a,
      describe: (_i, l) => `${l} electrode on the + lead`,
      onChange: () => this.emitMaterials(),
    });
    this.cathodeSel = new Selector({
      id: 'electrochem.cathode',
      caption: 'CATHODE -',
      labels: [...PANEL_MATERIALS],
      radius: 1.05,
      accent: 0x5ab4ff,
      describe: (_i, l) => `${l} electrode on the - lead`,
      onChange: () => this.emitMaterials(),
    });
    this.powerRocker = new Rocker({
      id: 'electrochem.power',
      caption: 'OUTPUT',
      hintOn: 'Output ON · click to switch the cell off',
      hintOff: 'Output OFF · click to apply the set voltage / current to the cell (electrodes dip into the selected vessel)',
      onChange: (on) => this.onPower?.(on),
    });
    this.dipBtn = new PushButton({
      id: 'electrochem.dip',
      label: 'DIP',
      size: [3.8, 1.6],
      color: 0x4a4232,
      lamp: 0xffc233,
      hintText: 'Dip / lift the electrode pair: they go into the selected vessel (click it first)',
      onPress: () => this.onDip?.(),
    });
    this.bridgeBtn = new PushButton({
      id: 'electrochem.bridge',
      label: 'BRIDGE',
      size: [3.8, 1.6],
      color: 0x32424a,
      lamp: 0x62d2ff,
      hintText: 'Salt bridge: click to join the selected vessel to the next nearest one, again to step on, then off',
      onPress: () => this.onBridge?.(),
    });
    place(this.voltKnob, this.group, [-11.2, 5.4, 9.62]);
    place(this.currKnob, this.group, [-6.7, 5.4, 9.62]);
    place(this.modeSel, this.group, [-2.2, 5.4, 9.62]);
    place(this.anodeSel, this.group, [2.3, 5.4, 9.62]);
    place(this.cathodeSel, this.group, [6.8, 5.4, 9.62]);
    place(this.powerRocker, this.group, [11.3, 5.2, 9.62]);
    place(this.dipBtn, this.group, [-10.4, 1.9, 9.62]);
    place(this.bridgeBtn, this.group, [10.4, 1.9, 9.62]);
    this.controls.push(this.voltKnob, this.currKnob, this.modeSel, this.anodeSel, this.cathodeSel, this.powerRocker, this.dipBtn, this.bridgeBtn);

    // Binding Posts: Red (+ / Anode) and Black (- / Cathode)
    const redTerminal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.3, metalness: 0.3 }));
    redTerminal.rotation.x = Math.PI / 2;
    redTerminal.position.set(RED_POST.x, RED_POST.y, RED_POST.z - 0.1);
    this.group.add(redTerminal);

    const blackTerminal = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.3 }));
    blackTerminal.rotation.x = Math.PI / 2;
    blackTerminal.position.set(BLACK_POST.x, BLACK_POST.y, BLACK_POST.z - 0.1);
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

    const rodGeo = new THREE.CylinderGeometry(ELECTRODE_RADIUS, ELECTRODE_RADIUS, ELECTRODE_LENGTH, 16);
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

    this.anodeRod.position.set(-ELECTRODE_X, 0, 0);
    this.cathodeRod.position.set(ELECTRODE_X, 0, 0);

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

  private emitMaterials() {
    this.onMaterials?.(PANEL_MATERIALS[this.anodeSel.index], PANEL_MATERIALS[this.cathodeSel.index]);
  }

  /** The console's own state (what the knobs, switches and lamps show). Does not notify. */
  public get panel(): PotentiostatPanel {
    return {
      mode: this.modeSel.index === 0 ? 'voltage' : 'current',
      volts: this.voltKnob.value,
      amps: this.currKnob.value,
      anode: PANEL_MATERIALS[this.anodeSel.index],
      cathode: PANEL_MATERIALS[this.cathodeSel.index],
      on: this.powerRocker.on,
      dipped: this.dipLit,
      bridged: this.bridgeLit,
    };
  }

  private dipLit = false;
  private bridgeLit = false;

  /** Push state into the controls without firing their callbacks. */
  public setPanel(p: Partial<PotentiostatPanel>) {
    if (p.volts !== undefined) this.voltKnob.setValue(p.volts);
    if (p.amps !== undefined) this.currKnob.setValue(p.amps);
    if (p.mode !== undefined) this.modeSel.setIndex(p.mode === 'voltage' ? 0 : 1);
    if (p.anode !== undefined) this.anodeSel.setIndex(Math.max(0, PANEL_MATERIALS.indexOf(p.anode as (typeof PANEL_MATERIALS)[number])));
    if (p.cathode !== undefined) this.cathodeSel.setIndex(Math.max(0, PANEL_MATERIALS.indexOf(p.cathode as (typeof PANEL_MATERIALS)[number])));
    if (p.on !== undefined) this.powerRocker.setOn(p.on);
    if (p.dipped !== undefined) {
      this.dipLit = p.dipped;
      this.dipBtn.setLit(p.dipped);
    }
    if (p.bridged !== undefined) {
      this.bridgeLit = p.bridged;
      this.bridgeBtn.setLit(p.bridged);
    }
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
  public attachToVessel(worldPos: THREE.Vector3, _lipHeight: number, surfaceY: number) {
    this.electrodesGroup.visible = true;

    // The rods stand a few cm in the liquid (not a fixed distance below the rim): their tips follow the surface level
    const targetY = worldPos.y + electrodeBottomY(surfaceY) + ELECTRODE_LENGTH / 2;
    const targetWorld = new THREE.Vector3(worldPos.x, targetY, worldPos.z);
    setWorldPose(this.electrodesGroup, targetWorld, new THREE.Quaternion());

    // Route Red Cable from the + post to the Anode clip
    const redStartWorld = RED_POST.clone().applyMatrix4(this.group.matrixWorld);
    const redEndWorld = new THREE.Vector3(-1.4, 4.2, 0).applyMatrix4(this.electrodesGroup.matrixWorld);
    this.routeCable(this.redCable, redStartWorld, redEndWorld, 'red', -3.0);

    // Route Black Cable from the - post to the Cathode clip
    const blackStartWorld = BLACK_POST.clone().applyMatrix4(this.group.matrixWorld);
    const blackEndWorld = new THREE.Vector3(1.4, 4.2, 0).applyMatrix4(this.electrodesGroup.matrixWorld);
    this.routeCable(this.blackCable, blackStartWorld, blackEndWorld, 'black', 3.0);
  }

  public get hasSaltBridge(): boolean {
    return this.saltBridgeGroup.visible;
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
