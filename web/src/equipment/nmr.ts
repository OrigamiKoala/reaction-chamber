import * as THREE from 'three';
import { NmrSpectrumData } from '../types/sim';
import { frontPlate, roundedBox } from './lcd';
import { Control3D, PushButton, ScreenPanel, Selector, canvasTexture, place, textLegend } from '../bench/controls3d';

export type NmrNucleus = '1H' | '13C';
export type NmrSolvent = 'CDCl3' | 'DMSO-d6' | 'D2O' | 'CD3OD' | 'acetone-d6';

/** Acquisition parameters the console hands to the engine. */
export interface NmrRunParams {
  nucleus: NmrNucleus;
  solvent: NmrSolvent;
  scans: number;
}

/** A finished acquisition: the engine's predicted spectrum of the tube's contents. */
export interface NmrSpectrumResult extends NmrSpectrumData {
  sampleName: string;
}

export type NmrLiftState = 'empty' | 'ejected' | 'inserted';

/** Height of the rim of the sample-lift housing above the magnet's floor, cm. */
const LIFT_TOP_Y = 178;
/** Radius of the cryostat, cm (a 400 MHz actively shielded magnet is about 70 cm across). */
const MAGNET_R = 34;
/** Console cabinet: floor to top, front face; the group origin is on the bench plane, the floor is 90 cm below. */
const FLOOR_Y = -90;
const CAB_W = 60;
const CAB_H = 128;
const CAB_D = 64;
const PANEL_Z = CAB_D / 2 + 0.8 + 0.5; // front face of the operator panel plate
const NUCLEI: NmrNucleus[] = ['1H', '13C'];
const SOLVENTS: NmrSolvent[] = ['CDCl3', 'DMSO-d6', 'D2O', 'CD3OD', 'acetone-d6'];
const SCAN_COUNTS = [16, 64, 256, 1024, 4096];

/**
 * 400 MHz FT-NMR as it stands in a real facility: a floor-standing electronics cabinet (operator panel at the top, digital
 * receiver / gradient amplifier / shim-and-lock units below, ventilated door) next to the bench end, joined by an umbilical on
 * the floor and two pneumatic hoses to the superconducting magnet. The magnet is a vacuum-jacketed cryostat on pneumatic
 * isolation legs with a conical shoulder, helium and nitrogen fill turrets, a quench vent and the sample-lift housing on top.
 * The sample tube rides an air cushion up out of the magnet (EJECT) and down into it (INSERT); the spectrum appears when the
 * acquisition has run.
 */
export class NmrMachine {
  /** Rim height of the lift housing above the magnet's floor point (the tube rises above it when ejected). */
  public static readonly LIFT_TOP_Y = LIFT_TOP_Y;
  public group = new THREE.Group();
  public cryoMagnet = new THREE.Group();
  /** Console controls (NUCLEUS / SOLVENT / SCANS selectors, LIFT, ACQUIRE); the scene registers them with its control rig. */
  public readonly controls: Control3D[] = [];
  /** LIFT was pressed: the app loads the selected vessel's liquid (or ejects the tube). */
  public onLift?: () => void;
  /** ACQUIRE was pressed: the app supplies the sample and calls `startAcquisition`. */
  public onAcquire?: () => void;
  /** An acquisition failed in the engine (nothing to measure, unreadable structure ...). */
  public onError?: (message: string) => void;

  public nucleus: NmrNucleus = '1H';
  public solvent: NmrSolvent = 'CDCl3';
  public scans = SCAN_COUNTS[0];

  /** The spectrometer software window; shown on the lab PC (`Workstation`), not on the console. */
  public readonly software: ScreenPanel;
  /** Small status display on the console front. */
  private status: ScreenPanel;
  private ringMat: THREE.MeshBasicMaterial;
  private tube = new THREE.Group();
  private tubeLiquidMat: THREE.MeshStandardMaterial;
  private liftLampMat: THREE.MeshBasicMaterial;
  private lockLampMat: THREE.MeshBasicMaterial;
  private acqLampMat: THREE.MeshBasicMaterial;
  /** Activity LEDs of the electronics units; they flicker while a spectrum is recorded. */
  private activityLeds: THREE.MeshBasicMaterial[] = [];
  /** Umbilical and pneumatic lines (rebuilt by `routeCables` once both groups are placed). */
  private cable: THREE.Mesh;
  private leads: THREE.Mesh[] = [];
  private liftBtn: PushButton;
  private liftState: NmrLiftState = 'empty';
  private liftT = 0; // 0 = down in the magnet, 1 = ejected
  private seated = true;
  private acquiring = false;
  private progress = 0;
  private duration = 1;
  private pending: { run: (p: NmrRunParams) => Promise<NmrSpectrumData>; name: string } | null = null;
  private result: NmrSpectrumResult | null = null;
  private fetched = false;
  private failed = false;
  private currentSampleName: string | null = null;
  private lastSpectrum: NmrSpectrumResult | null = null;
  private time = 0;
  private screenTick = 0;

  constructor() {
    this.group.name = 'instrument_nmr_console';
    this.cryoMagnet.name = 'instrument_nmr_magnet';

    const white = new THREE.MeshStandardMaterial({ color: 0xe3e5e4, roughness: 0.48, metalness: 0.08 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2024, roughness: 0.55, metalness: 0.15 });
    const slateMat = new THREE.MeshStandardMaterial({ color: 0x343a40, roughness: 0.5, metalness: 0.25 });
    const unitMat = new THREE.MeshStandardMaterial({ color: 0xa7aeb3, roughness: 0.4, metalness: 0.45 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc8ced4, metalness: 0.85, roughness: 0.25 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x174f9c, roughness: 0.4, metalness: 0.2 });
    const slotMat = new THREE.MeshBasicMaterial({ color: 0x07080a });

    // ---------------------------------------------------------------- console cabinet (floor standing, operator panel at bench height)
    const cab = new THREE.Mesh(roundedBox(CAB_W, CAB_H, CAB_D, 1.6), white);
    cab.position.y = FLOOR_Y;
    cab.castShadow = true;
    cab.receiveShadow = true;
    this.group.add(cab);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(CAB_W - 3, 5, CAB_D - 3), darkMat);
    plinth.position.y = FLOOR_Y + 2.5;
    this.group.add(plinth);
    const frontZ = CAB_D / 2 + 0.8; // front face of the cabinet body (bevel included)
    // blue top rail and a blue vertical accent on the door side
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(CAB_W + 0.5, 1.6, CAB_D + 0.5), blueMat);
    topRail.position.y = 36.4;
    this.group.add(topRail);
    // operator panel (top section)
    const panel = frontPlate(CAB_W - 4.4, 36, 0.5, 0.8, darkMat);
    panel.position.set(0, 18, frontZ);
    this.group.add(panel);
    // three rack units under the panel: BSMS (shim / lock / lift), gradient amplifier, digital receiver
    const unitDefs: Array<[string, number]> = [['LOCK / SHIM / LIFT CONTROL', -5], ['GRADIENT AMPLIFIER', -14], ['DIGITAL RECEIVER  2 CH', -23]];
    unitDefs.forEach(([name, y], idx) => {
      const unit = frontPlate(CAB_W - 4.4, 8, 0.4, 0.5, unitMat);
      unit.position.set(0, y, frontZ);
      this.group.add(unit);
      const lg = textLegend(name, 26, 1.3, { ink: '#2b3236', weight: 800, align: 'left' });
      lg.rotation.x = 0;
      lg.position.set(-9.2, y + 1.9, frontZ + 0.42);
      this.group.add(lg);
      for (const hx of [-24.5, 24.5]) {
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 5, 10), silverMat);
        handle.position.set(hx, y, frontZ + 1.3);
        const standoff = [-1.8, 1.8].map((dy) => {
          const so = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 8), silverMat);
          so.rotation.x = Math.PI / 2;
          so.position.set(hx, y + dy, frontZ + 0.8);
          return so;
        });
        this.group.add(handle, ...standoff);
      }
      // a row of activity LEDs and a vent slit block
      for (let k = 0; k < 8; k++) {
        const led = new THREE.MeshBasicMaterial({ color: 0x14301c, toneMapped: false });
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 10), led);
        l.rotation.x = Math.PI / 2;
        l.position.set(-9.2 + k * 1.15, y - 0.3, frontZ + 0.42);
        this.group.add(l);
        this.activityLeds.push(led);
      }
      for (let k = 0; k < 6; k++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.22, 0.1), slotMat);
        s.position.set(14, y + 2.6 - k * 0.9, frontZ + 0.42);
        this.group.add(s);
      }
      void idx;
    });
    // ventilated door (lower section) with a recessed handle and louvres
    const door = frontPlate(CAB_W - 4.4, 55, 0.5, 0.8, white);
    door.position.set(0, -58, frontZ);
    this.group.add(door);
    for (let i = 0; i < 14; i++) {
      const louvre = new THREE.Mesh(new THREE.BoxGeometry(34, 0.38, 0.14), slotMat);
      louvre.position.set(-4, -80 + i * 2.0, frontZ + 0.54);
      this.group.add(louvre);
    }
    const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 14, 12), silverMat);
    doorHandle.position.set(23.2, -58, frontZ + 1.8);
    for (const dy of [-5.5, 5.5]) {
      const so = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8), silverMat);
      so.rotation.x = Math.PI / 2;
      so.position.set(23.2, -58 + dy, frontZ + 1.1);
      this.group.add(so);
    }
    this.group.add(doorHandle);
    const doorLegend = textLegend('NMR CONSOLE', 16, 1.1, { ink: '#6b757c', weight: 800 });
    doorLegend.rotation.x = 0;
    doorLegend.position.set(-4, -34.5, frontZ + 0.54);
    this.group.add(doorLegend);
    // side vents and the cable gland plate (right side, toward the magnet)
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 22), slotMat);
        v.position.set(sx * (CAB_W / 2 + 0.78), -20 + i * 1.3, 4);
        this.group.add(v);
      }
    }
    const gland = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 15), unitMat);
    gland.position.set(CAB_W / 2 + 0.95, -72, -6);
    this.group.add(gland);
    for (const gz of [-3, 3]) {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.0, 18), darkMat);
      g.rotation.z = Math.PI / 2;
      g.position.set(CAB_W / 2 + 1.4, -72, -6 + gz * 1.6);
      this.group.add(g);
    }
    // feet
    const foot = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 });
    for (const [x, z] of [[-26, -27], [26, -27], [-26, 27], [26, 27]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 1.6, 14), foot);
      f.position.set(x, FLOOR_Y + 0.8, z);
      this.group.add(f);
    }

    // the console has a small status display and lamps; the spectrum is shown by the software on the lab PC
    this.software = new ScreenPanel(17.4, 10.6, 100);
    this.status = new ScreenPanel(17.4, 7.2, 60);
    this.status.mesh.position.set(-14.4, 28.2, PANEL_Z + 0.28);
    this.group.add(this.status.mesh);
    const bezel = frontPlate(18.4, 8.2, 0.25, 0.6, new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.6 }));
    bezel.position.set(-14.4, 28.2, PANEL_Z);
    this.group.add(bezel);
    const model = textLegend('NMR SPECTROMETER', 18, 0.85, { ink: '#8d979f', weight: 700 });
    model.rotation.x = 0;
    model.position.set(-14.4, 21.9, PANEL_Z + 0.04);
    this.group.add(model);

    // selectors (upper right)
    const nucSel = new Selector({
      id: 'nmr.nucleus',
      caption: 'NUCLEUS',
      labels: ['1H', '13C'],
      radius: 1.15,
      plateScale: 3.0,
      accent: 0x62d2ff,
      describe: (i) => (i === 0 ? '400 MHz proton' : '100 MHz carbon'),
      onChange: (i) => {
        this.nucleus = NUCLEI[i];
      },
    });
    const solSel = new Selector({
      id: 'nmr.solvent',
      caption: 'LOCK SOLVENT',
      labels: ['CDCl3', 'DMSO', 'D2O', 'CD3OD', 'Acet.'],
      radius: 1.15,
      plateScale: 3.0,
      accent: 0xffd34a,
      describe: (i) => `deuterated ${SOLVENTS[i]}${i === 2 || i === 3 ? ' (exchanges O-H / N-H protons)' : ''}`,
      onChange: (i) => {
        this.solvent = SOLVENTS[i];
      },
    });
    const scanSel = new Selector({
      id: 'nmr.scans',
      caption: 'SCANS',
      labels: ['16', '64', '256', '1k', '4k'],
      value: 0,
      radius: 1.15,
      plateScale: 3.0,
      accent: 0x5df08a,
      describe: (i) => `${SCAN_COUNTS[i]} transients (signal / noise grows as the square root; 13C of a dilute sample needs hundreds)`,
      onChange: (i) => {
        this.scans = SCAN_COUNTS[i];
      },
    });
    place(nucSel, this.group, [6.4, 26.6, PANEL_Z + 0.02]);
    place(solSel, this.group, [14.4, 26.6, PANEL_Z + 0.02]);
    place(scanSel, this.group, [22.4, 26.6, PANEL_Z + 0.02]);
    const caption = textLegend('SAMPLE SET-UP', 9, 0.65, { ink: '#8d979f', weight: 700 });
    caption.rotation.x = 0;
    caption.position.set(14.4, 33.6, PANEL_Z + 0.04);
    this.group.add(caption);

    // status lamps (middle left)
    const lampDefs: Array<[string, number]> = [['POWER', 0x35e070], ['LOCK', 0x35e070], ['LIFT AIR', 0x4aa8ff], ['ACQ', 0xffb02e]];
    const lampMats: THREE.MeshBasicMaterial[] = [];
    lampDefs.forEach(([name, color], i) => {
      const x = -22.6 + i * 4.8;
      const mat = new THREE.MeshBasicMaterial({ color: i === 0 ? color : 0x1e2326, toneMapped: false });
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 18), mat);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(x, 15.2, PANEL_Z + 0.06);
      lampMats.push(mat);
      const lg = textLegend(name, 4.2, 0.6, { ink: '#8d979f', weight: 700 });
      lg.rotation.x = 0;
      lg.position.set(x, 14.0, PANEL_Z + 0.04);
      this.group.add(lamp, lg);
    });
    this.lockLampMat = lampMats[1];
    this.liftLampMat = lampMats[2];
    this.acqLampMat = lampMats[3];
    // vents under the status display
    for (let i = 0; i < 6; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(18, 0.28, 0.12), slotMat);
      slot.position.set(-14.4, 8.6 - i * 0.95, PANEL_Z + 0.03);
      this.group.add(slot);
    }
    // an emergency quench-switch cover (decorative: this simulation never quenches)
    const quenchBase = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0xc9a100, roughness: 0.5 }));
    quenchBase.rotation.x = Math.PI / 2;
    quenchBase.position.set(-23.6, 4.8, PANEL_Z + 0.25);
    const quenchCover = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.9, 24), new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.35, transparent: true, opacity: 0.9 }));
    quenchCover.rotation.x = Math.PI / 2;
    quenchCover.position.set(-23.6, 4.8, PANEL_Z + 0.7);
    const quenchLg = textLegend('MAGNET', 4, 0.55, { ink: '#8d979f', weight: 700 });
    quenchLg.rotation.x = 0;
    quenchLg.position.set(-23.6, 2.6, PANEL_Z + 0.04);
    this.group.add(quenchBase, quenchCover, quenchLg);

    // LIFT and ACQUIRE
    this.liftBtn = new PushButton({
      id: 'nmr.lift',
      label: 'LIFT',
      size: [6.6, 2.8],
      color: 0x2c5f8f,
      lamp: 0x62d2ff,
      hintText: 'Sample lift: first press loads the selected vessel\'s liquid and lowers the tube into the magnet, the next one ejects it on the air cushion',
      onPress: () => this.onLift?.(),
    });
    const acqBtn = new PushButton({
      id: 'nmr.acquire',
      label: 'ACQUIRE',
      size: [7.4, 2.8],
      color: 0x1f7a3f,
      lamp: 0x6dff9b,
      hintText: 'Acquire: pulse, record the FID, Fourier-transform (loads the selected vessel first if no tube is in the magnet)',
      onPress: () => this.onAcquire?.(),
    });
    place(this.liftBtn, this.group, [9.4, 11.0, PANEL_Z + 0.02]);
    place(acqBtn, this.group, [19.6, 11.0, PANEL_Z + 0.02]);
    this.controls.push(nucSel, solSel, scanSel, this.liftBtn, acqBtn);

    // NMR tube rack on top of the console
    const rack = new THREE.Mesh(roundedBox(16, 2.4, 5.4, 0.6), new THREE.MeshStandardMaterial({ color: 0xe9ecee, roughness: 0.6 }));
    rack.position.set(-15, 38, -8);
    rack.castShadow = true;
    this.group.add(rack);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xf4f9fb, transparent: true, opacity: 0.45, roughness: 0.05 });
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 17.8, 12), glass);
      t.position.set(-20.5 + i * 2.2, 38 + 2.4 + 8.9 - 0.4, -8);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.2, 12), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x1e88e5 : 0xe53935, roughness: 0.5 }));
      cap.position.set(t.position.x, 38 + 2.4 + 17.8 - 0.2, -8);
      this.group.add(t, cap);
    }
    // a pair of cryo-gloves and a lens-tissue box would be clutter: a small solvent bottle of CDCl3 for the tubes instead
    const clutterBottle = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 7, 20), new THREE.MeshStandardMaterial({ color: 0x8a5a1a, roughness: 0.25, transparent: true, opacity: 0.9 }));
    clutterBottle.position.set(8, 38 + 3.5, -6);
    const clutterCap = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.4, 16), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 }));
    clutterCap.position.set(8, 38 + 7.7, -6);
    this.group.add(clutterBottle, clutterCap);

    // umbilical and pneumatic lines to the magnet (built by routeCables once both groups are placed)
    const lineMats = [
      new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0x2d3d4d, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0xd97a1c, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: 0x2d7fd0, roughness: 0.45 }),
      new THREE.MeshStandardMaterial({ color: 0xe8ebee, roughness: 0.45 }),
    ];
    this.cable = new THREE.Mesh(new THREE.BufferGeometry(), lineMats[0]);
    this.cable.castShadow = true;
    this.leads = lineMats.slice(1).map((m) => new THREE.Mesh(new THREE.BufferGeometry(), m));
    this.group.add(this.cable, ...this.leads);

    // ---------------------------------------------------------------- superconducting magnet (floor standing)
    const R = MAGNET_R;
    const body = new THREE.MeshStandardMaterial({ color: 0xdfe2e1, roughness: 0.38, metalness: 0.3 });
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.5, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.5 });
    // pneumatic anti-vibration legs on rubber pads under a base ring
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + (i * Math.PI) / 2;
      const lx = Math.cos(ang) * (R - 7);
      const lz = Math.sin(ang) * (R - 7);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }));
      pad.position.set(lx, 0.6, lz);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 16, 24), dark);
      leg.position.set(lx, 9.2, lz);
      leg.castShadow = true;
      const bellow = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 3.4, 20), new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.8 }));
      bellow.position.set(lx, 19.6, lz);
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 16), silverMat);
      piston.position.set(lx, 23.2, lz);
      // blue pneumatic line stub
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 8), new THREE.MeshStandardMaterial({ color: 0x2d7fd0, roughness: 0.5 }));
      stub.rotation.z = Math.PI / 2;
      stub.position.set(lx + Math.cos(ang) * 5, 14, lz + Math.sin(ang) * 5);
      stub.rotation.y = -ang;
      this.cryoMagnet.add(pad, leg, bellow, piston, stub);
    }
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.5, R + 1.5, 3, 56), dark);
    platform.position.y = 26;
    platform.castShadow = true;
    this.cryoMagnet.add(platform);
    // dark lower skirt, then the cryostat: cylinder, trim rings, conical shoulder, neck
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R - 1, R - 1.8, 26, 56), skirtMat);
    skirt.position.y = 41;
    skirt.castShadow = true;
    this.cryoMagnet.add(skirt);
    const prof: THREE.Vector2[] = [new THREE.Vector2(R - 0.4, 54), new THREE.Vector2(R, 55), new THREE.Vector2(R, 104)];
    for (let i = 1; i <= 14; i++) {
      const a = (i / 14) * (Math.PI / 2);
      prof.push(new THREE.Vector2(14 + (R - 14) * Math.cos(a), 104 + 40 * Math.sin(a)));
    }
    prof.push(new THREE.Vector2(13.2, 144), new THREE.Vector2(13.2, 147), new THREE.Vector2(0, 147));
    const cryostat = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), body);
    cryostat.castShadow = true;
    cryostat.receiveShadow = true;
    this.cryoMagnet.add(cryostat);
    for (const [y, r, h] of [[54.6, R + 0.5, 1.2], [104.4, R + 0.5, 1.2]] as Array<[number, number, number]>) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 72), silverMat);
      ring.position.y = y;
      this.cryoMagnet.add(ring);
    }
    // navy label band and a front nameplate with the field warning
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x143a6b, roughness: 0.45, metalness: 0.2 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.25, R + 0.25, 7, 72, 1, true), bandMat);
    band.position.y = 62;
    this.cryoMagnet.add(band);
    const brand = canvasTexture(1024, 96, (ctx, w, h) => {
      ctx.fillStyle = '#143a6b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#eef3f6';
      ctx.font = `800 ${Math.round(h * 0.52)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('400 MHz  ·  9.4 T  ·  54 mm bore', w / 2, h / 2);
    });
    const brandBand = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.3, 6, 36, 1, true, -0.62, 1.24), new THREE.MeshStandardMaterial({ map: brand, roughness: 0.45, metalness: 0.2 }));
    brandBand.position.y = 62;
    this.cryoMagnet.add(brandBand);
    const plateTex = canvasTexture(640, 460, (ctx, w, h) => {
      ctx.fillStyle = '#f4d300';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(w * 0.17, h * 0.84);
      ctx.lineTo(w * 0.3, h * 0.48);
      ctx.lineTo(w * 0.43, h * 0.84);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f4d300';
      ctx.font = `800 ${Math.round(h * 0.26)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', w * 0.3, h * 0.72);
      ctx.fillStyle = '#111';
      ctx.font = `800 ${Math.round(h * 0.14)}px Arial, sans-serif`;
      ctx.fillText('STRONG MAGNETIC FIELD', w / 2, h * 0.22);
      ctx.font = `700 ${Math.round(h * 0.09)}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('Pacemakers · implants', w * 0.5, h * 0.55);
      ctx.fillText('Steel tools · cards · watches', w * 0.5, h * 0.7);
      ctx.fillText('5 gauss line on the floor', w * 0.5, h * 0.85);
    });
    const nameplate = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.3, 24, 36, 1, true, -0.4, 0.8), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }));
    nameplate.position.y = 84;
    this.cryoMagnet.add(nameplate);

    // top flange, sample-lift housing with its air fittings, cryogen turrets
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(17.5, 17.5, 2.4, 56), dark);
    flange.position.y = 148.2;
    flange.castShadow = true;
    this.cryoMagnet.add(flange);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.5, LIFT_TOP_Y - 149.4, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
    housing.position.y = 149.4 + (LIFT_TOP_Y - 149.4) / 2;
    housing.castShadow = true;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 8, 3.2, 40), silverMat);
    base.position.y = 151;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 3, 40), dark);
    collar.position.y = LIFT_TOP_Y - 8.5;
    const liftRim = new THREE.Mesh(new THREE.TorusGeometry(5.35, 0.5, 12, 40), silverMat);
    liftRim.rotation.x = Math.PI / 2;
    liftRim.position.y = LIFT_TOP_Y;
    const bore = new THREE.Mesh(new THREE.CircleGeometry(5.0, 32), new THREE.MeshBasicMaterial({ color: 0x050607 }));
    bore.rotation.x = -Math.PI / 2;
    bore.position.y = LIFT_TOP_Y - 3.4;
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x1b3a52, toneMapped: false });
    const statusRing = new THREE.Mesh(new THREE.TorusGeometry(6.25, 0.3, 10, 40), this.ringMat);
    statusRing.rotation.x = Math.PI / 2;
    statusRing.position.y = LIFT_TOP_Y - 7.2;
    this.cryoMagnet.add(housing, base, collar, liftRim, bore, statusRing);
    // two push-in air fittings on the housing (bearing air blue, lift air white) on the console side
    for (const [dz, c] of [[-2.4, 0x2d7fd0], [2.4, 0xe8ebee]] as Array<[number, number]>) {
      const fit = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3.2, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
      fit.rotation.z = Math.PI / 2;
      fit.position.set(-6.6, 156, dz);
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.2, 6), silverMat);
      nut.rotation.z = Math.PI / 2;
      nut.position.set(-5.3, 156, dz);
      this.cryoMagnet.add(fit, nut);
    }
    // cryogen fill turrets: bellows, neck, cap; helium has the quench valve block
    const turrets: Array<[number, number, number, string]> = [[-9.5, -10, 0xd8561f, 'He'], [9.5, -10, 0x2f7fd0, 'N2']];
    for (const [tx, tz, capColour, kind] of turrets) {
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 3, 20), silverMat);
      neck.position.set(tx, 150.9, tz);
      this.cryoMagnet.add(neck);
      for (let k = 0; k < 5; k++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.62, 8, 20), silverMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(tx, 153.2 + k * 1.2, tz);
        this.cryoMagnet.add(ring);
      }
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 4, 20), silverMat);
      stack.position.set(tx, 160.4, tz);
      stack.castShadow = true;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 1.8, 20), new THREE.MeshStandardMaterial({ color: capColour, roughness: 0.45 }));
      cap.position.set(tx, 163.3, tz);
      this.cryoMagnet.add(stack, cap);
      if (kind === 'He') {
        const valve = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.4, 3.6), dark);
        valve.position.set(tx, 157.7, tz + 3.2);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0xd8561f, roughness: 0.5 }));
        handle.rotation.z = Math.PI / 2;
        handle.position.set(tx, 157.7, tz + 5.4);
        this.cryoMagnet.add(valve, handle);
      }
    }
    // ---------------------------------------------------------------- sample tube + spinner (rides the air cushion)
    const tubeGlass = new THREE.MeshPhysicalMaterial({ color: 0xf4f9fb, transparent: true, opacity: 0.45, roughness: 0.05 });
    const tubeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 18, 14), tubeGlass);
    tubeBody.position.y = 9;
    this.tubeLiquidMat = new THREE.MeshStandardMaterial({ color: 0x9cc8e6, transparent: true, opacity: 0.8, roughness: 0.2 });
    const tubeLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 4.2, 12), this.tubeLiquidMat);
    tubeLiquid.position.y = 3.2;
    const turbine = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 22), new THREE.MeshStandardMaterial({ color: 0x2f7fd0, roughness: 0.45 }));
    turbine.position.y = 14.6;
    const fins = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.5, 22), new THREE.MeshStandardMaterial({ color: 0x1f5ba8, roughness: 0.45 }));
    fins.position.y = 13.2;
    this.tube.add(tubeBody, tubeLiquid, turbine, fins);
    this.tube.visible = false;
    this.cryoMagnet.add(this.tube);
    this.poseTube();
    this.drawScreen();
  }

  /**
   * Builds the umbilical on the floor between the console and the magnet and the two pneumatic hoses from the console top to
   * the fittings on the lift housing. Call once both groups are placed in the scene.
   */
  public routeCables() {
    this.group.updateWorldMatrix(true, false);
    this.cryoMagnet.updateWorldMatrix(true, false);
    const inv = this.group.matrixWorld.clone().invert();
    const fromGroup = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(this.group.matrixWorld);
    const fromMagnet = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(this.cryoMagnet.matrixWorld);
    const toLocal = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts.map((p) => p.clone().applyMatrix4(inv)));
    // umbilical: out of the gland plate, down to the floor, along it with a loop, up into the magnet's skirt
    const floor = this.cryoMagnet.getWorldPosition(new THREE.Vector3()).y + 1.6;
    const start = fromGroup(CAB_W / 2 + 2.2, -72, -6);
    const end = fromMagnet(-(MAGNET_R - 0.4), 40, 6);
    const dx = end.x - start.x;
    const base = [
      start,
      start.clone().add(new THREE.Vector3(4, -6, 1)),
      new THREE.Vector3(start.x + dx * 0.28, floor, start.z + 5),
      new THREE.Vector3(start.x + dx * 0.55, floor, (start.z + end.z) / 2 + 9),
      new THREE.Vector3(start.x + dx * 0.82, floor, end.z + 1),
      new THREE.Vector3(end.x - 3, floor + 10, end.z),
      end,
    ];
    const radii = [1.3, 0.8, 0.6];
    const offsets = [0, 3.2, -3.0];
    const meshes = [this.cable, this.leads[0], this.leads[1]];
    meshes.forEach((m, i) => {
      const pts = base.map((p, k) => (k === 0 || k === base.length - 1 ? p.clone().add(new THREE.Vector3(0, offsets[i] * 0.5, offsets[i] * 0.4)) : p.clone().add(new THREE.Vector3(0, i === 0 ? 0 : 0.2, offsets[i]))));
      m.geometry.dispose();
      m.geometry = new THREE.TubeGeometry(toLocal(pts), 70, radii[i], 10, false);
    });
    // air hoses: from the cabinet top, hanging in a long arc, to the two fittings on the housing
    [this.leads[2], this.leads[3]].forEach((m, i) => {
      const dz = i === 0 ? -2.4 : 2.4;
      const hs = fromGroup(CAB_W / 2 + 0.6, 30, -12 + i * 4);
      const he = fromMagnet(-8.2, 156, dz);
      const mid = hs.clone().lerp(he, 0.5);
      mid.y = Math.min(hs.y, he.y) - 26 - i * 4;
      const q1 = hs.clone().lerp(he, 0.22);
      q1.y = hs.y - 14;
      const q3 = hs.clone().lerp(he, 0.78);
      q3.y = he.y - 20 - i * 3;
      m.geometry.dispose();
      m.geometry = new THREE.TubeGeometry(toLocal([hs, hs.clone().add(new THREE.Vector3(3, 1, 0)), q1, mid, q3, he.clone().add(new THREE.Vector3(-3, -4, 0)), he]), 60, 0.45, 8, false);
    });
  }

  // ------------------------------------------------------------------ sample lift
  public get lift(): NmrLiftState {
    return this.liftState;
  }

  /** Load a sample: the tube comes down into the magnet (animated). `color` tints the liquid in the tube. */
  public insert(vesselName: string, color?: string) {
    this.currentSampleName = vesselName;
    if (color) this.tubeLiquidMat.color.set(color);
    this.tube.visible = true;
    if (this.liftState === 'empty') this.liftT = 1;
    this.liftState = 'inserted';
    this.seated = false;
    this.liftBtn.setLit(true);
  }

  /** Pop the tube out of the magnet on the air cushion. */
  public eject() {
    if (this.liftState !== 'inserted') return;
    this.liftState = 'ejected';
    this.seated = false;
    this.liftBtn.setLit(false);
  }

  private poseTube() {
    const k = this.liftT * this.liftT * (3 - 2 * this.liftT);
    // inserted: the whole tube is inside the lift tube; ejected: it hovers with the spinner above the rim
    const down = LIFT_TOP_Y - 24;
    const up = LIFT_TOP_Y - 2.5;
    this.tube.position.set(0, down + (up - down) * k, 0);
  }

  public setSample(vesselName: string | null) {
    this.currentSampleName = vesselName;
  }

  public get sampleName(): string | null {
    return this.currentSampleName;
  }

  public get isAcquiring(): boolean {
    return this.acquiring || !!this.pending;
  }

  /** 0..1 progress of the running acquisition. */
  public get acquisitionProgress(): number {
    return this.acquiring ? this.progress : 0;
  }

  // ------------------------------------------------------------------ per-frame
  public animate(dt: number) {
    this.time += dt;
    const target = this.liftState === 'ejected' ? 1 : this.liftState === 'inserted' ? 0 : this.liftT;
    if (this.liftT !== target) {
      this.liftT += Math.sign(target - this.liftT) * Math.min(Math.abs(target - this.liftT), dt * 0.9);
      this.poseTube();
    } else if (!this.seated) {
      this.seated = true;
    }
    if (this.pending && this.liftState === 'inserted' && this.liftT === 0) {
      const p = this.pending;
      this.pending = null;
      this.acquiring = true;
      this.progress = 0;
      this.fetched = false;
      this.failed = false;
      this.result = null;
      this.duration = 0.6 + 0.7 * Math.log2(this.scans / 4);
      const params: NmrRunParams = { nucleus: this.nucleus, solvent: this.solvent, scans: this.scans };
      p.run(params).then(
        (data) => {
          this.result = { ...data, sampleName: p.name };
          this.fetched = true;
        },
        (err) => {
          this.failed = true;
          this.fetched = true;
          this.onError?.(String(err instanceof Error ? err.message : err).replace(/^Error: /, ''));
        }
      );
    }
    if (this.acquiring) {
      // the bar waits at 97 % until the engine has answered
      this.progress = Math.min(this.fetched ? 1 : 0.97, this.progress + dt / this.duration);
      if (this.progress >= 1) {
        this.acquiring = false;
        this.progress = 0;
        if (!this.failed && this.result) this.lastSpectrum = this.result;
        this.result = null;
      }
    }
    // lamps and the lift ring
    const acq = this.acquiring || !!this.pending;
    this.ringMat.color.setHex(acq ? 0xffb02e : this.liftState === 'inserted' ? 0x35e070 : this.liftState === 'ejected' ? 0x4aa8ff : 0x1b3a52);
    this.acqLampMat.color.setHex(acq ? (Math.floor(this.time * 4) % 2 ? 0xffb02e : 0x6b4a10) : 0x1e2326);
    this.liftLampMat.color.setHex(this.liftState === 'ejected' && this.liftT > 0.05 ? 0x4aa8ff : 0x1e2326);
    this.lockLampMat.color.setHex(this.liftState === 'inserted' && this.liftT === 0 ? 0x35e070 : 0x1e2326);
    // the electronics units: a slow idle pattern, busy while recording
    this.activityLeds.forEach((led, k) => {
      const on = acq ? Math.sin(this.time * (9 + (k % 4) * 3) + k * 1.7) > -0.2 : Math.sin(this.time * 0.8 + k * 2.1) > 0.85;
      led.color.setHex(on ? 0x35e070 : 0x14301c);
    });
    this.screenTick += dt;
    this.drawScreen();
  }

  private drawScreen() {
    const sp = this.lastSpectrum;
    const acq = this.acquiring;
    const key = `${this.nucleus}|${this.solvent}|${this.scans}|${this.liftState}|${this.currentSampleName}|${sp ? sp.sampleName + sp.signals.length + sp.nucleus + sp.scans : ''}|${acq ? Math.floor(this.progress * 40) : 0}|${this.pending ? 1 : 0}`;
    this.paintStatus();
    this.software.draw(key, (ctx, w, h) => {
      ctx.fillStyle = '#04120d';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0b2a1e';
      ctx.fillRect(0, 0, w, h * 0.12);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6dffb0';
      ctx.font = `700 ${Math.round(h * 0.075)}px Arial, sans-serif`;
      ctx.fillText('NMR', w * 0.03, h * 0.06);
      const state = acq ? 'ACQUIRING' : this.pending ? 'LOADING' : this.liftState === 'inserted' ? 'LOCKED' : this.liftState === 'ejected' ? 'TUBE EJECTED' : 'NO SAMPLE';
      ctx.textAlign = 'right';
      ctx.fillStyle = acq || this.pending ? '#ffc233' : this.liftState === 'inserted' ? '#6dffb0' : '#8fb7a8';
      ctx.fillText(state, w * 0.97, h * 0.06);
      ctx.textAlign = 'left';
      ctx.font = `${Math.round(h * 0.07)}px "Courier New", monospace`;
      ctx.fillStyle = '#9fe8c4';
      ctx.fillText(`Nucleus  ${this.nucleus === '1H' ? '1H' : '13C'}`, w * 0.03, h * 0.19);
      ctx.fillText(`Solvent  ${this.solvent}`, w * 0.03, h * 0.27);
      ctx.fillText(`Scans    ${this.scans}`, w * 0.03, h * 0.35);
      ctx.fillStyle = '#6fa890';
      ctx.fillText(this.currentSampleName ? `Sample   ${this.currentSampleName.slice(0, 22)}` : 'Sample   (none)', w * 0.03, h * 0.43);
      // progress / spectrum preview
      const x0 = w * 0.04;
      const x1 = w * 0.96;
      const y0 = h * 0.52;
      const y1 = h * 0.94;
      ctx.strokeStyle = '#1b4a38';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      if (acq) {
        ctx.fillStyle = '#163d2e';
        ctx.fillRect(x0, y0 + (y1 - y0) * 0.4, x1 - x0, (y1 - y0) * 0.14);
        ctx.fillStyle = '#ffc233';
        ctx.fillRect(x0, y0 + (y1 - y0) * 0.4, (x1 - x0) * this.progress, (y1 - y0) * 0.14);
        ctx.fillStyle = '#9fe8c4';
        ctx.textAlign = 'center';
        ctx.fillText(`transient ${Math.min(this.scans, Math.ceil(this.progress * this.scans))} / ${this.scans}`, w / 2, y0 + (y1 - y0) * 0.25);
      } else if (sp && sp.intensity.length > 1) {
        // preview: the digitised spectrum reduced to one column per pixel, high ppm on the left
        const n = sp.intensity.length;
        const cols = Math.max(2, Math.floor(x1 - x0));
        ctx.strokeStyle = '#6dffb0';
        ctx.lineWidth = Math.max(1.5, h * 0.008);
        ctx.beginPath();
        for (let c = 0; c < cols; c++) {
          const iHi = n - 1 - Math.floor((c / cols) * n);
          const iLo = Math.max(0, n - 1 - Math.floor(((c + 1) / cols) * n));
          let m = 0;
          for (let i = iLo; i <= iHi; i++) if (sp.intensity[i] > m) m = sp.intensity[i];
          const x = x0 + c;
          const y = y1 - 3 - Math.min(1, m) * (y1 - y0 - 8);
          if (c === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#6fa890';
        ctx.textAlign = 'center';
        ctx.font = `${Math.round(h * 0.055)}px Arial, sans-serif`;
        const nsig = sp.signals.filter((q) => !q.solvent).length;
        ctx.fillText(`${sp.nucleus} · ${sp.sampleName.slice(0, 18)} · ${nsig} signals · ppm`, w / 2, y0 + 10);
      } else {
        ctx.fillStyle = '#4f7f6c';
        ctx.textAlign = 'center';
        ctx.fillText(this.liftState === 'inserted' ? 'press ACQUIRE' : 'bring a sample to the magnet', w / 2, (y0 + y1) / 2);
      }
    });
  }

  /** The console's small character display: what the spectrometer is doing. */
  private paintStatus() {
    const acq = this.acquiring;
    const state = acq ? 'ACQUIRING' : this.pending ? 'LOADING' : this.liftState === 'inserted' ? 'LOCKED' : this.liftState === 'ejected' ? 'EJECTED' : 'NO SAMPLE';
    const key = `${state}|${this.nucleus}|${this.solvent}|${this.scans}|${acq ? Math.floor(this.progress * 20) : 0}`;
    this.status.draw(key, (ctx, w, h) => {
      ctx.fillStyle = '#0c1a12';
      ctx.fillRect(0, 0, w, h);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(h * 0.2)}px "Courier New", monospace`;
      ctx.fillStyle = '#6dffb0';
      ctx.fillText(`NUCLEUS ${this.nucleus}`, w * 0.05, h * 0.2);
      ctx.fillStyle = '#9fe8c4';
      ctx.fillText(`LOCK ${this.solvent}`, w * 0.05, h * 0.46);
      ctx.fillText(`NS ${this.scans}`, w * 0.05, h * 0.72);
      ctx.textAlign = 'right';
      ctx.fillStyle = acq || this.pending ? '#ffc233' : this.liftState === 'inserted' ? '#6dffb0' : '#8fb7a8';
      ctx.fillText(acq ? `${Math.min(100, Math.round(this.progress * 100))} %` : state, w * 0.95, h * 0.72);
    });
  }

  // ------------------------------------------------------------------ spectra
  /**
   * Starts an acquisition. `run` asks the engine for the spectrum of the loaded sample (it is called once the tube is seated in
   * the magnet); the spectrum is published when the progress bar has run through and the engine has answered.
   */
  public startAcquisition(run: (p: NmrRunParams) => Promise<NmrSpectrumData>, vesselName: string) {
    this.pending = { run, name: vesselName };
  }

  public getLastSpectrum(): NmrSpectrumResult | null {
    return this.lastSpectrum;
  }
}
