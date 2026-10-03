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

/** Height of the top of the sample-lift tube above the magnet's floor, cm. */
const LIFT_TOP_Y = 156;
const NUCLEI: NmrNucleus[] = ['1H', '13C'];
const SOLVENTS: NmrSolvent[] = ['CDCl3', 'DMSO-d6', 'D2O', 'CD3OD', 'acetone-d6'];
const SCAN_COUNTS = [16, 64, 256, 1024, 4096];

/**
 * 400 MHz FT-NMR: a floor-standing superconducting magnet (blue helium dewar, sample-lift tube on top) and the acquisition
 * console on the bench with its screen and controls, joined by an umbilical. The sample tube rides an air cushion up out of
 * the magnet (EJECT) and down into it (INSERT); the spectrum appears when the acquisition has run.
 */
export class NmrMachine {
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

  private screen: ScreenPanel;
  private ringMat: THREE.MeshBasicMaterial;
  private tube = new THREE.Group();
  private tubeLiquidMat: THREE.MeshStandardMaterial;
  private liftLampMat: THREE.MeshBasicMaterial;
  private lockLampMat: THREE.MeshBasicMaterial;
  private acqLampMat: THREE.MeshBasicMaterial;
  private cable: THREE.Mesh;
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

    const caseMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.45, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.55, metalness: 0.15 });
    const slateMat = new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.5, metalness: 0.2 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc8ced4, metalness: 0.85, roughness: 0.25 });

    // ---------------------------------------------------------------- console (bench top): 38 W x 30 H x 30 D
    const body = new THREE.Mesh(roundedBox(38, 30, 30, 1.6), caseMat);
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);
    // brand band
    const band = new THREE.Mesh(new THREE.BoxGeometry(39.9, 0.7, 31.9), new THREE.MeshStandardMaterial({ color: 0x1b5aa8, roughness: 0.4 }));
    band.position.y = 15.4;
    this.group.add(band);
    // upper fascia: display + sample set-up controls
    const upper = frontPlate(35.4, 12.8, 0.5, 0.8, darkMat);
    upper.position.set(0, 22.3, 15.8); // body front face = 15 + bevel 0.8
    this.group.add(upper);
    // lower fascia: status lamps, LIFT / ACQUIRE, vents
    const lower = frontPlate(35.4, 11.8, 0.5, 0.8, slateMat);
    lower.position.set(0, 8.6, 15.8);
    this.group.add(lower);

    this.screen = new ScreenPanel(17.4, 10.6);
    this.screen.mesh.position.set(-7.4, 22.3, 16.58);
    this.group.add(this.screen.mesh);
    const bezel = frontPlate(18.2, 11.4, 0.25, 0.6, new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.6 }));
    bezel.position.set(-7.4, 22.3, 16.3);
    this.group.add(bezel);

    // selectors (upper right)
    const nucSel = new Selector({
      id: 'nmr.nucleus',
      caption: 'NUCLEUS',
      labels: ['1H', '13C'],
      radius: 1.15,
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
      accent: 0x5df08a,
      describe: (i) => `${SCAN_COUNTS[i]} transients (signal / noise grows as the square root; 13C of a dilute sample needs hundreds)`,
      onChange: (i) => {
        this.scans = SCAN_COUNTS[i];
      },
    });
    place(nucSel, this.group, [8.2, 25.2, 16.32]);
    place(solSel, this.group, [13.6, 25.2, 16.32]);
    place(scanSel, this.group, [8.2, 18.7, 16.32]);
    const caption = textLegend('SAMPLE SET-UP', 7.6, 0.6, { ink: '#8d979f', weight: 700 });
    caption.rotation.x = 0;
    caption.position.set(11.0, 28.2, 16.34);
    this.group.add(caption);

    // status lamps (lower left)
    const lampDefs: Array<[string, number]> = [['POWER', 0x35e070], ['LOCK', 0x35e070], ['LIFT AIR', 0x4aa8ff], ['ACQ', 0xffb02e]];
    const lampMats: THREE.MeshBasicMaterial[] = [];
    lampDefs.forEach(([name, color], i) => {
      const x = -15.4 + i * 4.2;
      const mat = new THREE.MeshBasicMaterial({ color: i === 0 ? color : 0x1e2326, toneMapped: false });
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 18), mat);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(x, 11.4, 16.36);
      lampMats.push(mat);
      const lg = textLegend(name, 3.6, 0.55, { ink: '#8d979f', weight: 700 });
      lg.rotation.x = 0;
      lg.position.set(x, 10.35, 16.34);
      this.group.add(lamp, lg);
    });
    this.lockLampMat = lampMats[1];
    this.liftLampMat = lampMats[2];
    this.acqLampMat = lampMats[3];
    // vents
    for (let i = 0; i < 9; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 0.12), new THREE.MeshBasicMaterial({ color: 0x07080a }));
      slot.position.set(-9.5, 7.1 - i * 0.62 + 1.6, 16.33);
      this.group.add(slot);
    }

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
    place(this.liftBtn, this.group, [5.6, 8.3, 16.32]);
    place(acqBtn, this.group, [13.6, 8.3, 16.32]);
    this.controls.push(nucSel, solSel, scanSel, this.liftBtn, acqBtn);

    // NMR tube rack on top of the console
    const rack = new THREE.Mesh(roundedBox(15, 2.4, 5, 0.6), new THREE.MeshStandardMaterial({ color: 0x8b6b4a, roughness: 0.7 }));
    rack.position.set(-8, 30, -8);
    rack.castShadow = true;
    this.group.add(rack);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xf4f9fb, transparent: true, opacity: 0.45, roughness: 0.05 });
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 17, 12), glass);
      t.position.set(-13.5 + i * 2.1, 30 + 2.4 + 8.5 - 0.4, -8);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.2, 12), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x1e88e5 : 0xe53935, roughness: 0.5 }));
      cap.position.set(t.position.x, 30 + 2.4 + 17 - 0.2, -8);
      this.group.add(t, cap);
    }

    // feet
    const foot = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 });
    for (const [x, z] of [[-16, -13], [16, -13], [-16, 13], [16, 13]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.5, 12), foot);
      f.position.set(x, -0.15, z);
      this.group.add(f);
    }

    // umbilical to the magnet (built by routeCables once both groups are placed)
    this.cable = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.55 }));
    this.cable.castShadow = true;
    this.group.add(this.cable);

    // ---------------------------------------------------------------- superconducting magnet (floor standing)
    const blue = new THREE.MeshStandardMaterial({ color: 0x1f5ba8, roughness: 0.38, metalness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe7eaec, roughness: 0.4, metalness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.5 });
    // anti-vibration legs and a platform
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + (i * Math.PI) / 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 18, 20), dark);
      leg.position.set(Math.cos(ang) * 20, 9, Math.sin(ang) * 20);
      leg.castShadow = true;
      const piston = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 6, 16), silverMat);
      piston.position.set(Math.cos(ang) * 20, 19, Math.sin(ang) * 20);
      this.cryoMagnet.add(leg, piston);
    }
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(27.5, 27.5, 3, 48), dark);
    platform.position.y = 22.5;
    platform.castShadow = true;
    this.cryoMagnet.add(platform);
    // helium dewar: a lathe with rounded shoulders
    const prof: THREE.Vector2[] = [
      [0, 24], [27.5, 24], [29.2, 25.2], [29.6, 27], [29.6, 116], [29.2, 119], [27.8, 122], [24.5, 126], [19.5, 130], [15.5, 134], [13.2, 137.5], [12.6, 142], [0, 142],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const dewar = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), blue);
    dewar.castShadow = true;
    dewar.receiveShadow = true;
    this.cryoMagnet.add(dewar);
    // white trim rings
    for (const [y, r] of [[27.6, 29.9], [115.6, 29.9], [121.2, 28.0]] as Array<[number, number]>) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.4, 64), white);
      ring.position.y = y;
      this.cryoMagnet.add(ring);
    }
    // hazard stripes near the foot
    const stripes = canvasTexture(1024, 64, (ctx, w, h) => {
      ctx.fillStyle = '#f2c500';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#16181a';
      for (let x = -h; x < w + h; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + 32, h);
        ctx.lineTo(x + 32 + h, 0);
        ctx.lineTo(x + h, 0);
        ctx.fill();
      }
    });
    stripes.wrapS = THREE.RepeatWrapping;
    const hazard = new THREE.Mesh(new THREE.CylinderGeometry(29.8, 29.8, 3.4, 64, 1, true), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6, side: THREE.DoubleSide }));
    hazard.position.y = 32;
    this.cryoMagnet.add(hazard);
    // front nameplate with the field warning (open cylinder segment facing +z)
    const plateTex = canvasTexture(768, 384, (ctx, w, h) => {
      ctx.fillStyle = '#eef1f3';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#143a6b';
      ctx.fillRect(0, 0, w, h * 0.34);
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${Math.round(h * 0.17)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('400 MHz  ·  9.4 T', w / 2, h * 0.17);
      ctx.fillStyle = '#222';
      ctx.font = `700 ${Math.round(h * 0.085)}px Arial, sans-serif`;
      ctx.fillText('SUPERCONDUCTING MAGNET', w / 2, h * 0.46);
      // warning triangle with a magnet
      ctx.fillStyle = '#f2c500';
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.9);
      ctx.lineTo(w * 0.3, h * 0.55);
      ctx.lineTo(w * 0.4, h * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.font = `800 ${Math.round(h * 0.17)}px Arial, sans-serif`;
      ctx.fillText('!', w * 0.3, h * 0.77);
      ctx.font = `700 ${Math.round(h * 0.075)}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('STRONG MAGNETIC FIELD', w * 0.46, h * 0.64);
      ctx.fillText('Pacemakers · metal tools · cards', w * 0.46, h * 0.76);
      ctx.fillText('5 gauss line on the floor', w * 0.46, h * 0.88);
    });
    const nameplate = new THREE.Mesh(new THREE.CylinderGeometry(29.75, 29.75, 28, 32, 1, true, -0.5, 1.0), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }));
    nameplate.position.y = 70;
    this.cryoMagnet.add(nameplate);
    // neck, top plate, sample-lift tube
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(11.6, 12.2, 3, 40), silverMat);
    neck.position.y = 143.4;
    const topPlate = new THREE.Mesh(new THREE.CylinderGeometry(13.6, 13.6, 2.2, 48), dark);
    topPlate.position.y = 145.6;
    this.cryoMagnet.add(neck, topPlate);
    const lift = new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.5, LIFT_TOP_Y - 146.7, 36, 1, true), new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
    lift.position.y = 146.7 + (LIFT_TOP_Y - 146.7) / 2;
    lift.castShadow = true;
    const liftRim = new THREE.Mesh(new THREE.TorusGeometry(5.35, 0.45, 12, 40), silverMat);
    liftRim.rotation.x = Math.PI / 2;
    liftRim.position.y = LIFT_TOP_Y;
    const bore = new THREE.Mesh(new THREE.CircleGeometry(5.0, 32), new THREE.MeshBasicMaterial({ color: 0x050607 }));
    bore.rotation.x = -Math.PI / 2;
    bore.position.y = LIFT_TOP_Y - 3.2;
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x1b3a52, toneMapped: false });
    const statusRing = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.28, 10, 40), this.ringMat);
    statusRing.rotation.x = Math.PI / 2;
    statusRing.position.y = LIFT_TOP_Y - 3.6;
    this.cryoMagnet.add(lift, liftRim, bore, statusRing);
    // cryogen fill turrets (He, N2) with caps and vent hoses
    for (const [tx, tz, cap, h] of [[-8.6, -5, 0xd8dde1, 11], [8.6, -5, 0x2f7fd0, 9]] as Array<[number, number, number, number]>) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, h, 20), silverMat);
      stack.position.set(tx, 146.7 + h / 2, tz);
      stack.castShadow = true;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.6, 20), new THREE.MeshStandardMaterial({ color: cap, roughness: 0.45 }));
      top.position.set(tx, 146.7 + h + 0.6, tz);
      this.cryoMagnet.add(stack, top);
    }
    const vent = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-8.6, 154, -5), new THREE.Vector3(-14, 160, -8), new THREE.Vector3(-20, 150, -9), new THREE.Vector3(-26, 120, -8)]), 24, 0.7, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x28313a, roughness: 0.7 })
    );
    this.cryoMagnet.add(vent);
    // 5 gauss warning perimeter circle (floor decal)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5b041, side: THREE.DoubleSide });
    const line = new THREE.Mesh(new THREE.RingGeometry(31.5, 33, 64), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.2;
    this.cryoMagnet.add(line);

    // ---------------------------------------------------------------- sample tube + spinner (rides the air cushion)
    const tubeGlass = new THREE.MeshPhysicalMaterial({ color: 0xf4f9fb, transparent: true, opacity: 0.45, roughness: 0.05 });
    const tubeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 18, 14), tubeGlass);
    tubeBody.position.y = 9;
    this.tubeLiquidMat = new THREE.MeshStandardMaterial({ color: 0x9cc8e6, transparent: true, opacity: 0.8, roughness: 0.2 });
    const tubeLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 4.2, 12), this.tubeLiquidMat);
    tubeLiquid.position.y = 3.2;
    const turbine = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 22), new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.45 }));
    turbine.position.y = 14.6;
    const fins = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.5, 22), new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.45 }));
    fins.position.y = 13.2;
    this.tube.add(tubeBody, tubeLiquid, turbine, fins);
    this.tube.visible = false;
    this.cryoMagnet.add(this.tube);
    this.poseTube();
    this.drawScreen();
  }

  /** Builds the umbilical cable between the console and the magnet. Call once both groups are placed in the scene. */
  public routeCables() {
    this.group.updateWorldMatrix(true, false);
    this.cryoMagnet.updateWorldMatrix(true, false);
    const start = new THREE.Vector3(19.4, 9, -4).applyMatrix4(this.group.matrixWorld);
    const floor = this.cryoMagnet.getWorldPosition(new THREE.Vector3());
    const end = floor.clone().add(new THREE.Vector3(-26, 12, 8));
    const mid1 = start.clone().add(new THREE.Vector3(9, -2, -3));
    const mid2 = new THREE.Vector3(mid1.x + 4, floor.y + 4, mid1.z + 4);
    const mid3 = new THREE.Vector3((mid2.x + end.x) / 2, floor.y + 1.2, (mid2.z + end.z) / 2 + 3);
    const curve = new THREE.CatmullRomCurve3([start, mid1, mid2, mid3, end]);
    const inv = this.group.matrixWorld.clone().invert();
    const local = new THREE.CatmullRomCurve3(curve.getPoints(40).map((p) => p.applyMatrix4(inv)));
    this.cable.geometry.dispose();
    this.cable.geometry = new THREE.TubeGeometry(local, 60, 0.9, 10, false);
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
    const down = LIFT_TOP_Y - 19.5;
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
    this.screenTick += dt;
    this.drawScreen();
  }

  private drawScreen() {
    const sp = this.lastSpectrum;
    const acq = this.acquiring;
    const key = `${this.nucleus}|${this.solvent}|${this.scans}|${this.liftState}|${this.currentSampleName}|${sp ? sp.sampleName + sp.signals.length + sp.nucleus + sp.scans : ''}|${acq ? Math.floor(this.progress * 40) : 0}|${this.pending ? 1 : 0}`;
    this.screen.draw(key, (ctx, w, h) => {
      ctx.fillStyle = '#04120d';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0b2a1e';
      ctx.fillRect(0, 0, w, h * 0.12);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6dffb0';
      ctx.font = `700 ${Math.round(h * 0.075)}px Arial, sans-serif`;
      ctx.fillText('FT-NMR  400 MHz  ·  9.4 T', w * 0.03, h * 0.06);
      const state = acq ? 'ACQUIRING' : this.pending ? 'LOADING' : this.liftState === 'inserted' ? 'LOCKED' : this.liftState === 'ejected' ? 'TUBE EJECTED' : 'NO SAMPLE';
      ctx.textAlign = 'right';
      ctx.fillStyle = acq || this.pending ? '#ffc233' : this.liftState === 'inserted' ? '#6dffb0' : '#8fb7a8';
      ctx.fillText(state, w * 0.97, h * 0.06);
      ctx.textAlign = 'left';
      ctx.font = `${Math.round(h * 0.07)}px "Courier New", monospace`;
      ctx.fillStyle = '#9fe8c4';
      const f = this.nucleus === '1H' ? '400.13 MHz' : '100.61 MHz';
      ctx.fillText(`Nucleus  ${this.nucleus === '1H' ? '1H' : '13C'}  ${f}`, w * 0.03, h * 0.19);
      ctx.fillText(`Solvent  ${this.solvent}`, w * 0.03, h * 0.27);
      ctx.fillText(`Scans    ${this.scans}`, w * 0.03, h * 0.35);
      ctx.fillStyle = '#6fa890';
      ctx.fillText(this.currentSampleName ? `Sample   ${this.currentSampleName.slice(0, 22)}` : 'Sample   (none)', w * 0.5, h * 0.19);
      // progress / spectrum preview
      const x0 = w * 0.04;
      const x1 = w * 0.96;
      const y0 = h * 0.43;
      const y1 = h * 0.92;
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
        ctx.fillText(this.liftState === 'inserted' ? 'press ACQUIRE' : 'press LIFT to load the selected vessel', w / 2, (y0 + y1) / 2);
      }
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
