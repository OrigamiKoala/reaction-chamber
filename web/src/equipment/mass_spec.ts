import * as THREE from 'three';
import { MsSpectrumData } from '../types/sim';
import { frontPlate, roundedBox } from './lcd';
import { Control3D, PushButton, ScreenPanel, Selector, place, textLegend } from '../bench/controls3d';

export type MsIonization = 'EI' | 'ESI_POS' | 'ESI_NEG';

export type MsPhase = 'idle' | 'injecting' | 'scanning';

/** A finished run: the engine's predicted chromatogram / spectra of the vial's contents. */
export interface MassSpectrumResult extends MsSpectrumData {
  sampleName: string;
  ionization: MsIonization;
}

/** Ionisation mode name the engine understands. */
export function engineMode(i: MsIonization): string {
  return i === 'EI' ? 'EI' : i === 'ESI_POS' ? 'ESI+' : 'ESI-';
}

// Geometry of the instrument (group frame, cm; the bench top is y = 0). The GC and the MS are full size and abut each other.
const GC_X = -21;
const MS_X = 20;
const GC_W = 48;
const GC_H = 46;
const MS_W = 34;
const MS_H = 38;
const BODY_D = 52;
// Autosampler: a tower on the left of the GC top, a beam above the inlet and the vial tray; everything on one line at z = AS_Z.
const AS_Z = 8;
const INJECTOR_X = -36;
const VIAL_X = [-27.5, -24.9, -22.3, -19.7, -17.1, -14.5];
const LOADED_SLOT = 2;
const ARM_Y = GC_H + 15.4;
const SYRINGE_DROP = 3.4;
const TOWER_X = -42;
const TOWER_H = 31;

/**
 * Benchtop GC/MS at full size: a gas chromatograph (keypad strip with the data screen, LOAD and INJECT keys, a smoked-glass
 * oven door with the capillary column coil behind it, injector on top) with its autosampler (tower, beam, syringe carriage and
 * vial tray), joined to the quadrupole mass spectrometer (status panel, SOURCE selector, light bar, turbopump grille) whose
 * foreline hose runs down to a rotary-vane pump on the floor. INJECT runs the autosampler through its real motions (draw from
 * the vial, inject into the inlet) and then scans.
 */
export class MassSpectrometer {
  public group = new THREE.Group();
  /** Front-panel controls (source selector, LOAD, INJECT); the scene registers them with its control rig. */
  public readonly controls: Control3D[] = [];
  /** Autosampler geometry shared with the tests: tray / inlet positions, heights (group frame). */
  public readonly geom = { GC_X, MS_X, GC_H, ARM_Y, INJECTOR_X, VIAL_X, LOADED_SLOT, AS_Z };
  /** The autosampler tower (the carriage must never enter it). */
  public readonly tower: THREE.Mesh;
  /** LOAD was pressed: the app puts the selected vessel's liquid into a vial in the tray. */
  public onLoad?: () => void;
  /** INJECT was pressed: the app supplies the sample and calls `startAcquisition`. */
  public onInject?: () => void;
  /** A run failed in the engine (nothing to inject ...). */
  public onError?: (message: string) => void;
  public ionization: MsIonization = 'EI';

  private ionSourceGlowMat: THREE.MeshBasicMaterial;
  /** The data system's window; shown on the lab PC (`Workstation`), not on the instrument. */
  public readonly software: ScreenPanel;
  /** Small status display on the MS front. */
  private msStatus: ScreenPanel;
  private gcScreen: ScreenPanel;
  private carriage = new THREE.Group();
  private syringe = new THREE.Group();
  private vial = new THREE.Group();
  private vialLiquidMat: THREE.MeshStandardMaterial;
  private readyLed: THREE.MeshBasicMaterial;
  private runLed: THREE.MeshBasicMaterial;
  private emissionLed: THREE.MeshBasicMaterial;
  private columnMat: THREE.MeshStandardMaterial;
  private ovenGlowMat: THREE.MeshBasicMaterial;
  private fanBlades: THREE.Group = new THREE.Group();
  private loadBtn: PushButton;
  private phase: MsPhase = 'idle';
  private phaseT = 0;
  private pending: { run: (mode: string) => Promise<MsSpectrumData>; name: string } | null = null;
  private result: MassSpectrumResult | null = null;
  private fetched = false;
  private failed = false;
  private currentSampleName: string | null = null;
  private lastSpectrum: MassSpectrumResult | null = null;
  private time = 0;
  private injectedOnce = false;

  constructor() {
    this.group.name = 'instrument_mass_spectrometer';

    const cream = new THREE.MeshStandardMaterial({ color: 0xe9eae6, roughness: 0.42, metalness: 0.06 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.5, metalness: 0.2 });
    const graphite = new THREE.MeshStandardMaterial({ color: 0x3b4147, roughness: 0.5, metalness: 0.3 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc8ced4, metalness: 0.85, roughness: 0.25 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf1f2ef, roughness: 0.4 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x1e6b9c, roughness: 0.4 });
    const slotMat = new THREE.MeshBasicMaterial({ color: 0x15171a });
    const mkLed = (x: number, y: number, z: number, off: number) => {
      const m = new THREE.MeshBasicMaterial({ color: off, toneMapped: false });
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 16), m);
      l.rotation.x = Math.PI / 2;
      l.position.set(x, y, z);
      this.group.add(l);
      return m;
    };
    const legend = (text: string, w: number, h: number, x: number, y: number, z: number, ink = '#8d979f') => {
      const lg = textLegend(text, w, h, { ink, weight: 700 });
      lg.rotation.x = 0;
      lg.position.set(x, y, z);
      this.group.add(lg);
      return lg;
    };

    // ---------------------------------------------------------------- gas chromatograph (left)
    const gc = new THREE.Mesh(roundedBox(GC_W, GC_H, BODY_D, 1.8), cream);
    gc.position.x = GC_X;
    gc.castShadow = true;
    gc.receiveShadow = true;
    this.group.add(gc);
    const gcFront = BODY_D / 2 + 0.9; // front face of the body (bevel included)
    const gcBand = new THREE.Mesh(new THREE.BoxGeometry(GC_W + 0.6, 0.7, BODY_D + 0.6), accent);
    gcBand.position.set(GC_X, 35.4, 0);
    this.group.add(gcBand);
    // keypad strip: data screen, status LEDs, LOAD and INJECT keys
    const strip = frontPlate(GC_W - 4, 8.6, 0.4, 0.6, darkMat);
    strip.position.set(GC_X, 41, gcFront);
    this.group.add(strip);
    const PF1 = gcFront + 0.4;
    const gcBezel = frontPlate(13.2, 7.2, 0.2, 0.4, new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.6 }));
    gcBezel.position.set(GC_X - 13, 41, PF1);
    this.group.add(gcBezel);
    this.gcScreen = new ScreenPanel(12.4, 6.4);
    this.gcScreen.mesh.position.set(GC_X - 13, 41, PF1 + 0.22);
    this.group.add(this.gcScreen.mesh);
    this.readyLed = mkLed(GC_X - 3.0, 43.4, PF1 + 0.06, 0x1d3a26);
    this.runLed = mkLed(GC_X + 0.6, 43.4, PF1 + 0.06, 0x3a2e14);
    legend('POWER', 2.9, 0.55, GC_X - 3.0, 42.2, PF1 + 0.04);
    legend('RUN', 2.9, 0.55, GC_X + 0.6, 42.2, PF1 + 0.04);
    this.loadBtn = new PushButton({
      id: 'ms.load',
      label: 'LOAD',
      size: [6.4, 2.6],
      color: 0x3a444c,
      lamp: 0xffc233,
      hintText: 'Load a vial: puts the selected vessel\'s liquid in the autosampler tray (click the vessel first)',
      onPress: () => this.onLoad?.(),
    });
    const injectBtn = new PushButton({
      id: 'ms.inject',
      label: 'INJECT',
      size: [6.4, 2.6],
      color: 0x1f7a3f,
      lamp: 0x6dff9b,
      hintText: 'Inject (the GC START key): the autosampler draws the vial and injects; EI runs the GC programme and records a spectrum of every compound that elutes, ESI infuses the liquid (loads the selected vessel if the tray is empty)',
      onPress: () => this.onInject?.(),
    });
    place(this.loadBtn, this.group, [GC_X + 5.8, 40.4, PF1 + 0.02]);
    place(injectBtn, this.group, [GC_X + 13.4, 40.4, PF1 + 0.02]);

    // oven door: a frame proud of the front, a dark liner, the column coil in its cage, a smoked-glass window
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f1, roughness: 0.38 });
    const doorD = 2.6;
    const doorBars: Array<[number, number, number, number]> = [
      [44, 4, 0, 32.2],
      [44, 4, 0, 5.8],
      [4, 23, -20, 19],
      [4, 23, 20, 19],
    ];
    for (const [w, h, dx, dy] of doorBars) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, doorD), frameMat);
      bar.position.set(GC_X + dx, dy, gcFront + doorD / 2 - 0.1);
      bar.castShadow = true;
      this.group.add(bar);
    }
    const liner = new THREE.Mesh(new THREE.BoxGeometry(36, 23, 0.2), new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.7, metalness: 0.4 }));
    liner.position.set(GC_X, 19, gcFront + 0.05);
    this.group.add(liner);
    // oven interior: a stainless fan hub, a coil cage and eight turns of polyimide-coated fused silica
    const cageMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c5, metalness: 0.9, roughness: 0.3 });
    this.columnMat = new THREE.MeshStandardMaterial({ color: 0xc4811a, roughness: 0.35, metalness: 0.1, emissive: 0x000000 });
    const colX = GC_X - 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 28), cageMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(colX, 19, gcFront + 0.7);
    this.group.add(hub);
    this.fanBlades.position.set(colX, 19, gcFront + 1.4);
    for (let k = 0; k < 6; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.6, 0.08), cageMat);
      blade.geometry.translate(0, 3.0, 0);
      blade.rotation.z = (k * Math.PI * 2) / 6;
      this.fanBlades.add(blade);
    }
    this.group.add(this.fanBlades);
    for (let k = 0; k < 8; k++) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(8.4 - (k % 2) * 0.12, 0.2, 8, 56), this.columnMat);
      loop.position.set(colX, 19, gcFront + 1.0 + k * 0.17);
      this.group.add(loop);
    }
    for (const dz of [0.6, 2.0]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(8.9, 0.28, 8, 56), cageMat);
      rim.position.set(colX, 19, gcFront + dz);
      this.group.add(rim);
    }
    for (let k = 0; k < 6; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.6, 0.22), cageMat);
      const a = (k * Math.PI * 2) / 6;
      spoke.position.set(colX + Math.cos(a) * 5.9, 19 + Math.sin(a) * 5.9, gcFront + 1.3);
      spoke.rotation.z = a - Math.PI / 2;
      this.group.add(spoke);
    }
    // heater glow behind the coil (visible only while a run is on)
    this.ovenGlowMat = new THREE.MeshBasicMaterial({ color: 0x1a1210, toneMapped: false });
    const ovenGlow = new THREE.Mesh(new THREE.PlaneGeometry(33, 20), this.ovenGlowMat);
    ovenGlow.position.set(GC_X, 19, gcFront + 0.17);
    this.group.add(ovenGlow);
    // the column ends: two silver nuts on the oven wall and a line to the transfer line on the right
    for (const nx of [colX + 8.5, colX + 10.5]) {
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 6), cageMat);
      nut.rotation.x = Math.PI / 2;
      nut.position.set(nx, 12.5, gcFront + 0.6);
      this.group.add(nut);
    }
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(36, 23, 0.25),
      new THREE.MeshPhysicalMaterial({ color: 0x2c343b, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.52, clearcoat: 1, clearcoatRoughness: 0.05 })
    );
    glass.position.set(GC_X, 19, gcFront + doorD - 0.15);
    this.group.add(glass);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 14), silverMat);
    handle.position.set(GC_X + 20, 19, gcFront + doorD + 1.2);
    this.group.add(handle);
    for (const dy of [-5.5, 5.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 10), silverMat);
      post.rotation.x = Math.PI / 2;
      post.position.set(GC_X + 20, 19 + dy, gcFront + doorD + 0.5);
      this.group.add(post);
    }
    legend('GAS CHROMATOGRAPH', 20, 0.85, GC_X - 9, 2.4, gcFront + 0.04, '#7a848b');
    // vent slots in the lower front
    for (let i = 0; i < 4; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(16, 0.32, 0.12), slotMat);
      slot.position.set(GC_X + 8, 2.4 - i * 0.55, gcFront + 0.03);
      this.group.add(slot);
    }

    // ---------------------------------------------------------------- injector, flow module and autosampler on top of the GC
    const inj = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 1.6, 24), silverMat);
    inj.position.set(INJECTOR_X, GC_H + 0.8, AS_Z);
    const injNut = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.8, 18), new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.5 }));
    injNut.position.set(INJECTOR_X, GC_H + 2.0, AS_Z);
    const injBase = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.8, 28), graphite);
    injBase.position.set(INJECTOR_X, GC_H + 0.3, AS_Z);
    this.group.add(injBase, inj, injNut);
    const detCover = new THREE.Mesh(roundedBox(9, 2.2, 8, 0.6), graphite);
    detCover.position.set(GC_X + 18, GC_H, 6);
    this.group.add(detCover);
    const flowCover = new THREE.Mesh(roundedBox(30, 1.4, 16, 0.6), graphite);
    flowCover.position.set(GC_X - 4, GC_H, -14);
    flowCover.receiveShadow = true;
    this.group.add(flowCover);
    for (let i = 0; i < 4; i++) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.0, 14), silverMat);
      knob.position.set(GC_X - 14 + i * 4.2, GC_H + 1.7, -14);
      this.group.add(knob);
    }
    this.tower = new THREE.Mesh(roundedBox(7, TOWER_H, 9.2, 0.9), white);
    this.tower.position.set(TOWER_X, GC_H, AS_Z - 1.2);
    this.tower.castShadow = true;
    this.group.add(this.tower);
    const towerFront = AS_Z - 1.2 + 4.6 + 0.45;
    const towerStripe = new THREE.Mesh(new THREE.BoxGeometry(7.3, 1.0, 9.6), accent);
    towerStripe.position.set(TOWER_X, GC_H + 3, AS_Z - 1.2);
    this.group.add(towerStripe);
    legend('AUTOSAMPLER', 6.4, 0.7, TOWER_X, GC_H + 12, towerFront + 0.03, '#6b757c');
    mkLed(TOWER_X, GC_H + 8.5, towerFront + 0.05, 0x1d3a26).color.setHex(0x35e070);
    // beam from the tower to the right post
    const beamL = -9 - TOWER_X + 3;
    const arm = new THREE.Mesh(roundedBox(beamL, 1.7, 3.2, 0.5), white);
    arm.position.set((TOWER_X - 9) / 2, ARM_Y - 0.2, AS_Z);
    arm.castShadow = true;
    this.group.add(arm);
    const rightPost = new THREE.Mesh(roundedBox(2.8, ARM_Y - GC_H, 3.2, 0.5), white);
    rightPost.position.set(-9, GC_H, AS_Z);
    this.group.add(rightPost);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(beamL - 4, 0.3, 0.5), silverMat);
    rail.position.set((TOWER_X - 9) / 2, ARM_Y - 1.2, AS_Z + 1.7);
    this.group.add(rail);
    // syringe carriage on the beam
    const carBody = new THREE.Mesh(roundedBox(3.2, 3.0, 3.6, 0.5), new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.45 }));
    carBody.position.y = -2.4;
    this.carriage.add(carBody);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.4, 12), new THREE.MeshPhysicalMaterial({ color: 0xe8f1f5, transparent: true, opacity: 0.55, roughness: 0.05 }));
    barrel.position.y = -3.0;
    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 8), silverMat);
    plunger.position.y = -0.6;
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.0, 8), silverMat);
    needle.position.y = -6.7;
    this.syringe.add(barrel, plunger, needle);
    this.carriage.add(this.syringe);
    this.carriage.position.set(INJECTOR_X, ARM_Y - 1.1, AS_Z + 0.3);
    this.group.add(this.carriage);
    // vial tray: a plate with a hole ring per vial
    const tray = new THREE.Mesh(roundedBox(19, 1.2, 6, 0.6), new THREE.MeshStandardMaterial({ color: 0xcfd3d4, roughness: 0.45, metalness: 0.3 }));
    tray.position.set(-21, GC_H, AS_Z);
    tray.castShadow = true;
    this.group.add(tray);
    VIAL_X.forEach((x) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.95, 20), new THREE.MeshBasicMaterial({ color: 0x4a5258, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, GC_H + 1.23, AS_Z);
      this.group.add(ring);
    });
    const clearGlass = new THREE.MeshPhysicalMaterial({ color: 0xe9f2f7, transparent: true, opacity: 0.4, roughness: 0.05 });
    VIAL_X.forEach((x, i) => {
      if (i === LOADED_SLOT) return;
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 14), clearGlass);
      v.position.set(x, GC_H + 1.2 + 1.6, AS_Z);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.5, 14), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2d8f57 : 0x2b6fb2, roughness: 0.5 }));
      c.position.set(x, GC_H + 1.2 + 3.35, AS_Z);
      this.group.add(v, c);
    });
    // the loaded vial (hidden until LOAD)
    const vglass = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 14), clearGlass);
    vglass.position.y = 1.6;
    this.vialLiquidMat = new THREE.MeshStandardMaterial({ color: 0x9cc8e6, transparent: true, opacity: 0.8, roughness: 0.2 });
    const vliq = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.7, 12), this.vialLiquidMat);
    vliq.position.y = 1.0;
    const vcap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 }));
    vcap.position.y = 3.35;
    this.vial.add(vglass, vliq, vcap);
    this.vial.position.set(VIAL_X[LOADED_SLOT], GC_H + 1.2, AS_Z);
    this.vial.visible = false;
    this.group.add(this.vial);

    // ---------------------------------------------------------------- mass spectrometer (right)
    const ms = new THREE.Mesh(roundedBox(MS_W, MS_H, BODY_D, 1.6), cream);
    ms.position.x = MS_X;
    ms.castShadow = true;
    ms.receiveShadow = true;
    this.group.add(ms);
    const msFront = BODY_D / 2 + 0.8;
    const msBand = new THREE.Mesh(new THREE.BoxGeometry(MS_W + 0.6, 0.7, BODY_D + 0.6), accent);
    msBand.position.set(MS_X, 19.4, 0);
    this.group.add(msBand);
    // seam between the GC and the MS (the heated transfer line passes behind it)
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.5, MS_H - 4, BODY_D - 4), darkMat);
    seam.position.set(GC_X + GC_W / 2 + 0.05, MS_H / 2, 0);
    this.group.add(seam);
    // control panel (upper front): status display, SOURCE selector and the status light bar
    const panel = frontPlate(MS_W - 4, 13.4, 0.4, 0.8, darkMat);
    panel.position.set(MS_X, 29.3, msFront);
    this.group.add(panel);
    const PF2 = msFront + 0.4;
    // the MS front has a small status display; the spectra are shown by the data system on the lab PC
    this.software = new ScreenPanel(11.4, 8.2, 100);
    this.msStatus = new ScreenPanel(11.4, 4.6, 60);
    this.msStatus.mesh.position.set(MS_X - 7.6, 31.2, PF2 + 0.24);
    this.group.add(this.msStatus.mesh);
    const bezel = frontPlate(12.1, 5.3, 0.2, 0.5, new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.6 }));
    bezel.position.set(MS_X - 7.6, 31.2, PF2);
    this.group.add(bezel);
    legend('MASS SELECTIVE DETECTOR', 11.4, 0.75, MS_X - 7.6, 26.0, PF2 + 0.04);
    this.ionSourceGlowMat = new THREE.MeshBasicMaterial({ color: 0x221144, toneMapped: false });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 0.16), this.ionSourceGlowMat);
    bar.position.set(MS_X, 24.2, PF2 + 0.08);
    this.group.add(bar);
    legend('STATUS', 4.2, 0.5, MS_X - 9.8, 23.0, PF2 + 0.04);

    const srcSel = new Selector({
      id: 'ms.source',
      caption: 'SOURCE',
      labels: ['EI', 'ESI+', 'ESI-'],
      radius: 1.15,
      plateScale: 3.0,
      accent: 0xb27dff,
      describe: (i) => (i === 0 ? 'GC/MS, 70 eV electron ionisation: fragments, one spectrum per eluting compound' : i === 1 ? 'electrospray, positive: [M+H]+, [M+Na]+ and pre-formed cations' : 'electrospray, negative: [M-H]- and pre-formed anions'),
      onChange: (i) => {
        this.ionization = i === 0 ? 'EI' : i === 1 ? 'ESI_POS' : 'ESI_NEG';
      },
    });
    place(srcSel, this.group, [MS_X + 8.6, 30.0, PF2 + 0.02]);
    this.controls.push(srcSel, this.loadBtn, injectBtn);

    // lower front: removable cover with vents, vacuum read-out and lamps
    const lowerPlate = frontPlate(MS_W - 4, 17, 0.3, 0.8, new THREE.MeshStandardMaterial({ color: 0xa4acb1, roughness: 0.4, metalness: 0.3 }));
    lowerPlate.position.set(MS_X, 10.4, msFront);
    this.group.add(lowerPlate);
    const PF3 = msFront + 0.3;
    for (let i = 0; i < 8; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(17, 0.3, 0.12), slotMat);
      slot.position.set(MS_X - 5, 4.0 + i * 0.7, PF3 + 0.02);
      this.group.add(slot);
    }
    const gauge = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.6), new THREE.MeshBasicMaterial({ color: 0x06140b, toneMapped: false }));
    gauge.position.set(MS_X + 7.6, 14.2, PF3 + 0.03);
    this.group.add(gauge);
    const gaugeTxt = textLegend('1.2e-5 Torr', 8.2, 1.7, { ink: '#5dff8a', weight: 700 });
    gaugeTxt.rotation.x = 0;
    gaugeTxt.position.set(MS_X + 7.6, 14.2, PF3 + 0.05);
    this.group.add(gaugeTxt);
    legend('ANALYSER VACUUM', 8.6, 0.6, MS_X + 7.6, 16.0, PF3 + 0.04, '#2b3236');
    const vacLed = mkLed(MS_X + 4.2, 10.4, PF3 + 0.06, 0x1d3a26);
    vacLed.color.setHex(0x35e070);
    this.emissionLed = mkLed(MS_X + 8.0, 10.4, PF3 + 0.06, 0x2e1d4a);
    const pwrLed = mkLed(MS_X + 11.8, 10.4, PF3 + 0.06, 0x1d3a26);
    pwrLed.color.setHex(0x35e070);
    legend('VACUUM', 3.4, 0.5, MS_X + 4.2, 9.2, PF3 + 0.04, '#2b3236');
    legend('EMISSION', 3.4, 0.5, MS_X + 8.0, 9.2, PF3 + 0.04, '#2b3236');
    legend('POWER', 3.4, 0.5, MS_X + 11.8, 9.2, PF3 + 0.04, '#2b3236');
    // turbopump fan grille on the right side
    const sideX = MS_X + MS_W / 2 + 0.85;
    const grille = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.4, 40), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 }));
    grille.rotation.z = Math.PI / 2;
    grille.position.set(sideX, 15, 0);
    this.group.add(grille);
    for (let i = -3; i <= 3; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 2 * Math.sqrt(Math.max(0, 7.2 * 7.2 - (i * 2.1) ** 2))), silverMat);
      slat.position.set(sideX + 0.3, 15 + i * 2.1, 0);
      this.group.add(slat);
    }
    // MS top: removable cover seam, a carry handle
    const topSeam = new THREE.Mesh(new THREE.BoxGeometry(MS_W - 6, 0.12, 0.5), slotMat);
    topSeam.position.set(MS_X, MS_H + 0.02, 8);
    this.group.add(topSeam);
    // foreline hose: from the back of the MS over the raceway and the bench edge down to the rotary-vane pump on the floor
    const bellows = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(MS_X + 8, 6.5, -27.4),
          new THREE.Vector3(MS_X + 8, 10, -30.5),
          new THREE.Vector3(MS_X + 7, 9, -34.5),
          new THREE.Vector3(MS_X + 5, 0, -38.5),
          new THREE.Vector3(MS_X + 2, -30, -43),
          new THREE.Vector3(MS_X + 0.5, -60, -46),
          new THREE.Vector3(MS_X + 0, -65, -46),
        ]),
        48,
        1.2,
        10,
        false
      ),
      new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.7, metalness: 0.5 })
    );
    this.group.add(bellows);
    // feet
    const footMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 });
    for (const x of [-44, -2, 4, 36]) {
      for (const z of [-24, 24]) {
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.4, 12), footMat);
        f.position.set(x, -0.1, z);
        this.group.add(f);
      }
    }
    this.poseAutosampler(0);
    this.drawScreens();
  }

  // ------------------------------------------------------------------ sample / vial
  public setSample(vesselName: string | null) {
    this.currentSampleName = vesselName;
  }

  public get sampleName(): string | null {
    return this.currentSampleName;
  }

  public get vialLoaded(): boolean {
    return this.vial.visible;
  }

  public get phaseNow(): MsPhase {
    return this.phase;
  }

  public get isAcquiring(): boolean {
    return this.phase !== 'idle' || !!this.pending;
  }

  /** Puts a vial of the named sample in the tray (its liquid tinted `color`). */
  public loadVial(vesselName: string, color?: string) {
    this.currentSampleName = vesselName;
    if (color) this.vialLiquidMat.color.set(color);
    this.vial.visible = true;
    this.loadBtn.setLit(true);
  }

  public unloadVial() {
    this.vial.visible = false;
    this.loadBtn.setLit(false);
  }

  /** Starts an injection + scan: the spectrum is published when the scan has run (animated by `animate`). */
  public startAcquisition(run: (mode: string) => Promise<MsSpectrumData>, vesselName: string) {
    if (this.phase !== 'idle' || this.pending) return;
    this.pending = { run, name: vesselName };
  }

  /** Legacy hook (the app used to flip the glow itself). */
  public setAcquiring(acquiring: boolean) {
    this.ionSourceGlowMat.color.setHex(acquiring ? 0x9944ff : 0x221144);
  }

  // ------------------------------------------------------------------ per-frame
  public animate(dt: number) {
    this.time += dt;
    if (this.pending && this.phase === 'idle') {
      this.phase = 'injecting';
      this.phaseT = 0;
    }
    if (this.phase === 'injecting') {
      this.phaseT += dt;
      this.poseAutosampler(this.phaseT);
      if (this.phaseT >= INJECT_SECONDS) {
        const p = this.pending;
        this.pending = null;
        this.phase = 'scanning';
        this.phaseT = 0;
        this.injectedOnce = true;
        this.poseAutosampler(0);
        this.fetched = false;
        this.failed = false;
        this.result = null;
        if (p) {
          const ion = this.ionization;
          p.run(engineMode(ion)).then(
            (data) => {
              this.result = { ...data, sampleName: p.name, ionization: ion };
              this.fetched = true;
            },
            (err) => {
              this.failed = true;
              this.fetched = true;
              this.onError?.(String(err instanceof Error ? err.message : err).replace(/^Error: /, ''));
            }
          );
        } else {
          this.fetched = true;
          this.failed = true;
        }
      }
    } else if (this.phase === 'scanning') {
      this.phaseT += dt;
      if (this.phaseT >= SCAN_SECONDS && this.fetched) {
        this.phase = 'idle';
        this.phaseT = 0;
        if (!this.failed && this.result) this.lastSpectrum = this.result;
        this.result = null;
      }
    }
    const scanning = this.phase === 'scanning';
    const flick = 0.6 + 0.4 * Math.sin(this.time * 17);
    this.ionSourceGlowMat.color.setRGB(scanning ? 0.6 * flick : 0.13, scanning ? 0.25 * flick : 0.07, scanning ? 1.0 * flick : 0.27);
    this.emissionLed.color.setHex(scanning ? 0xb27dff : 0x2e1d4a);
    // the oven: the column coil warms to a dull red during the run and the fan turns
    const running = this.phase !== 'idle';
    this.ovenGlowMat.color.setRGB(running ? 0.22 : 0.1, running ? 0.09 : 0.07, running ? 0.05 : 0.06);
    this.columnMat.emissive.setRGB(running ? 0.18 : 0, running ? 0.05 : 0, 0);
    if (running) this.fanBlades.rotation.z += dt * 14;
    this.readyLed.color.setHex(0x35e070); // power lamp
    this.runLed.color.setHex(this.phase !== 'idle' ? 0xffb02e : 0x3a2e14);
    this.drawScreens();
  }

  /** Autosampler pose at time `t` of an injection: to the vial, draw, back to the inlet, inject. */
  private poseAutosampler(t: number) {
    const seg = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    const ease = (x: number) => x * x * (3 - 2 * x);
    const vialX = VIAL_X[LOADED_SLOT];
    let x = INJECTOR_X;
    let drop = 0;
    if (t > 0) {
      x = INJECTOR_X + (vialX - INJECTOR_X) * ease(seg(0, 0.7)) + (INJECTOR_X - vialX) * ease(seg(1.9, 2.6));
      drop = ease(seg(0.7, 1.2)) - ease(seg(1.4, 1.9)) + ease(seg(2.6, 3.1)) - ease(seg(3.3, 3.8));
    }
    this.carriage.position.x = x;
    this.syringe.position.y = -SYRINGE_DROP * drop;
  }

  private drawScreens() {
    const sp = this.lastSpectrum;
    const scanning = this.phase === 'scanning';
    const key = `${this.ionization}|${this.phase}|${this.currentSampleName}|${this.vial.visible}|${sp ? sp.sampleName + sp.summed.length + sp.components.length + sp.ionization : ''}|${scanning ? Math.floor((this.phaseT / SCAN_SECONDS) * 30) : 0}|${this.phase === 'injecting' ? Math.floor(this.phaseT * 5) : 0}`;
    this.paintStatus();
    this.software.draw(key, (ctx, w, h) => {
      ctx.fillStyle = '#0a0713';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(0, 0, w, h * 0.12);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#c6a8ff';
      ctx.font = `700 ${Math.round(h * 0.075)}px Arial, sans-serif`;
      ctx.fillText(`GC/MS  ·  ${this.ionization === 'EI' ? 'EI' : this.ionization === 'ESI_POS' ? 'ESI +' : 'ESI −'}`, w * 0.03, h * 0.06);
      const state = this.phase === 'injecting' ? 'INJECTING' : this.phase === 'scanning' ? 'SCANNING' : this.pending ? 'STARTING' : this.vial.visible ? 'VIAL LOADED' : '';
      ctx.textAlign = 'right';
      ctx.fillStyle = this.phase !== 'idle' ? '#ffc233' : '#7be0a0';
      ctx.fillText(state, w * 0.97, h * 0.06);
      ctx.textAlign = 'left';
      ctx.font = `${Math.round(h * 0.07)}px "Courier New", monospace`;
      ctx.fillStyle = '#b9a6e8';
      ctx.fillText(this.currentSampleName ? `Vial  ${this.currentSampleName.slice(0, 24)}` : 'Vial  (tray empty)', w * 0.03, h * 0.19);
      const x0 = w * 0.05;
      const x1 = w * 0.96;
      const y0 = h * 0.36;
      const y1 = h * 0.93;
      ctx.strokeStyle = '#3a2d66';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      if (scanning) {
        const f = Math.min(1, this.phaseT / SCAN_SECONDS);
        ctx.fillStyle = '#ffc233';
        ctx.fillRect(x0, y1 - (y1 - y0) * 0.1, (x1 - x0) * f, (y1 - y0) * 0.1);
        ctx.fillStyle = '#b9a6e8';
        ctx.textAlign = 'center';
        ctx.fillText(`scanning m/z ${Math.round(10 + f * 490)}`, w / 2, (y0 + y1) / 2);
      } else if (sp && (sp.summed.length || sp.components.length)) {
        // EI: the largest compound's spectrum under a strip of the total ion chromatogram; ESI: the infused spectrum
        const eiRun = sp.tic.length > 0;
        const main = eiRun ? [...sp.components].sort((a, b) => b.share_pct - a.share_pct)[0] : null;
        const peaks = main ? main.peaks : sp.summed;
        const yTop = eiRun ? y0 + (y1 - y0) * 0.36 : y0;
        if (eiRun) {
          const tmax = Math.max(1e-6, ...sp.tic);
          ctx.strokeStyle = '#7be0a0';
          ctx.lineWidth = Math.max(1.2, h * 0.007);
          ctx.beginPath();
          const stepT = Math.max(1, Math.floor(sp.tic.length / Math.max(2, x1 - x0)));
          for (let i = 0, c = 0; i < sp.tic.length; i += stepT, c++) {
            const x = x0 + (i / (sp.tic.length - 1)) * (x1 - x0);
            const y = y0 + (y1 - y0) * 0.33 - (sp.tic[i] / tmax) * (y1 - y0) * 0.24;
            if (c === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        if (peaks.length) {
          const mzMax = Math.max(100, Math.ceil((Math.max(...peaks.map((p) => p.mz)) + 10) / 10) * 10);
          ctx.strokeStyle = '#c6a8ff';
          ctx.lineWidth = Math.max(2, h * 0.012);
          for (const p of peaks) {
            const x = x0 + (p.mz / mzMax) * (x1 - x0);
            const y = y1 - 2 - (p.intensity / 100) * (y1 - yTop - 6);
            ctx.beginPath();
            ctx.moveTo(x, y1 - 2);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#8c7fb5';
        ctx.textAlign = 'center';
        ctx.font = `${Math.round(h * 0.055)}px Arial, sans-serif`;
        const label = main ? `${main.name.slice(0, 14)} · RT ${main.rt_min?.toFixed(2)} min · ${sp.components.length} compound${sp.components.length === 1 ? '' : 's'}` : `${sp.sampleName.slice(0, 16)} · ${sp.components.length} species ionised`;
        ctx.fillText(label, w / 2, y0 + 9);
      } else {
        ctx.fillStyle = '#6a5d96';
        ctx.textAlign = 'center';
        ctx.fillText(this.vial.visible ? 'press INJECT' : 'bring a sample to the autosampler', w / 2, (y0 + y1) / 2);
      }
    });
    const gkey = `${this.phase}|${this.vial.visible}|${this.injectedOnce}`;
    this.gcScreen.draw(gkey, (ctx, w, h) => {
      ctx.fillStyle = '#0a1a14';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#7be0a0';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(h * 0.26)}px "Courier New", monospace`;
      ctx.fillText('GC/MS', w * 0.06, h * 0.3);
      ctx.fillStyle = '#9fe8c4';
      ctx.fillText(this.vial.visible ? 'VIAL IN TRAY' : 'TRAY EMPTY', w * 0.06, h * 0.62);
      ctx.fillStyle = '#ffc233';
      ctx.fillText(this.phase === 'injecting' ? 'INJECTING' : this.phase === 'scanning' ? 'RUN' : '', w * 0.06, h * 0.88);
    });
  }

  private paintStatus() {
    const state = this.phase === 'injecting' ? 'INJECTING' : this.phase === 'scanning' ? 'SCANNING' : this.pending ? 'STARTING' : this.vial.visible ? 'VIAL LOADED' : '';
    const key = `${this.ionization}|${state}`;
    this.msStatus.draw(key, (ctx, w, h) => {
      ctx.fillStyle = '#0d0a18';
      ctx.fillRect(0, 0, w, h);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(h * 0.22)}px "Courier New", monospace`;
      ctx.fillStyle = '#c6a8ff';
      ctx.fillText(this.ionization === 'EI' ? 'SOURCE EI' : this.ionization === 'ESI_POS' ? 'SOURCE ESI +' : 'SOURCE ESI -', w * 0.05, h * 0.3);
      ctx.fillStyle = this.phase !== 'idle' ? '#ffc233' : '#7be0a0';
      ctx.fillText(state, w * 0.05, h * 0.8);
    });
  }

  // ------------------------------------------------------------------ spectra
  public getLastSpectrum(): MassSpectrumResult | null {
    return this.lastSpectrum;
  }
}

const INJECT_SECONDS = 4.0;
const SCAN_SECONDS = 2.0;
