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

// Autosampler geometry (group frame, cm): everything sits on one line at z = AS_Z along the top of the GC.
const GC_X = -14;
const MS_X = 14;
const GC_H = 30;
const AS_Z = -1.5;
const INJECTOR_X = -19.5;
const VIAL_X = [-14.2, -11.7, -9.2, -6.7, -4.2, -1.7];
const LOADED_SLOT = 2;
const ARM_Y = 45.4;
const SYRINGE_DROP = 3.4;

/**
 * Benchtop GC/MS: a gas chromatograph with its autosampler (tower, arm, syringe carriage, vial tray) on top, joined by a
 * heated transfer line to the quadrupole mass spectrometer with its front panel (screen, source selector, LOAD / INJECT).
 * INJECT runs the autosampler through its real motions (draw from the vial, inject into the inlet) and then scans.
 */
export class MassSpectrometer {
  public group = new THREE.Group();
  /** Front-panel controls (source selector, LOAD, INJECT); the scene registers them with its control rig. */
  public readonly controls: Control3D[] = [];
  /** LOAD was pressed: the app puts the selected vessel's liquid into a vial in the tray. */
  public onLoad?: () => void;
  /** INJECT was pressed: the app supplies the sample and calls `startAcquisition`. */
  public onInject?: () => void;
  /** A run failed in the engine (nothing to inject ...). */
  public onError?: (message: string) => void;
  public ionization: MsIonization = 'EI';

  private ionSourceGlowMat: THREE.MeshBasicMaterial;
  private screen: ScreenPanel;
  private gcScreen: ScreenPanel;
  private carriage = new THREE.Group();
  private syringe = new THREE.Group();
  private vial = new THREE.Group();
  private vialLiquidMat: THREE.MeshStandardMaterial;
  private readyLed: THREE.MeshBasicMaterial;
  private runLed: THREE.MeshBasicMaterial;
  private emissionLed: THREE.MeshBasicMaterial;
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

    const cream = new THREE.MeshStandardMaterial({ color: 0xe4e5e0, roughness: 0.45, metalness: 0.08 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.5, metalness: 0.2 });
    const smoke = new THREE.MeshStandardMaterial({ color: 0x232930, roughness: 0.18, metalness: 0.35 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc8ced4, metalness: 0.85, roughness: 0.25 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf1f2ef, roughness: 0.4 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x1e6b9c, roughness: 0.4 });

    // ---------------------------------------------------------------- gas chromatograph (left)
    const gc = new THREE.Mesh(roundedBox(26, GC_H, 34, 1.5), cream);
    gc.position.x = GC_X;
    gc.castShadow = true;
    gc.receiveShadow = true;
    this.group.add(gc);
    const gcBand = new THREE.Mesh(new THREE.BoxGeometry(27.7, 0.8, 35.7), accent);
    gcBand.position.set(GC_X, 24.6, 0);
    this.group.add(gcBand);
    // keypad strip with status screen
    const strip = frontPlate(23, 5.6, 0.4, 0.6, darkMat);
    strip.position.set(GC_X, 26.8 - 0.4, 17.75); // body front face = 17 + bevel 0.75
    this.group.add(strip);
    this.gcScreen = new ScreenPanel(8.4, 3.6);
    this.gcScreen.mesh.position.set(GC_X - 5.6, 26.4, 18.18);
    this.group.add(this.gcScreen.mesh);
    const mkLed = (x: number, y: number, z: number, off: number) => {
      const m = new THREE.MeshBasicMaterial({ color: off, toneMapped: false });
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.25, 16), m);
      l.rotation.x = Math.PI / 2;
      l.position.set(x, y, z);
      this.group.add(l);
      return m;
    };
    this.readyLed = mkLed(GC_X + 2.4, 27.4, 18.2, 0x1d3a26);
    this.runLed = mkLed(GC_X + 5.0, 27.4, 18.2, 0x3a2e14);
    const lg1 = textLegend('READY', 2.6, 0.5, { ink: '#8d979f', weight: 700 });
    lg1.rotation.x = 0;
    lg1.position.set(GC_X + 2.4, 26.2, 18.17);
    const lg2 = textLegend('RUN', 2.6, 0.5, { ink: '#8d979f', weight: 700 });
    lg2.rotation.x = 0;
    lg2.position.set(GC_X + 5.0, 26.2, 18.17);
    this.group.add(lg1, lg2);
    // oven door (smoked glass) with a handle
    const door = frontPlate(21.4, 17.8, 0.6, 1.4, smoke);
    door.position.set(GC_X, 13.0, 17.75);
    this.group.add(door);
    const doorFrame = frontPlate(22.2, 18.6, 0.3, 1.6, new THREE.MeshStandardMaterial({ color: 0xb9bdbf, roughness: 0.4, metalness: 0.4 }));
    doorFrame.position.set(GC_X, 13.0, 17.75);
    this.group.add(doorFrame);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 7, 14), silverMat);
    handle.position.set(GC_X + 8.4, 13.0, 18.9);
    this.group.add(handle);
    for (const dy of [-3, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 10), silverMat);
      post.rotation.x = Math.PI / 2;
      post.position.set(GC_X + 8.4, 13.0 + dy, 18.6);
      this.group.add(post);
    }
    // vent slots
    for (let i = 0; i < 6; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 0.12), new THREE.MeshBasicMaterial({ color: 0x15171a }));
      slot.position.set(GC_X, 1.9 + i * 0.8, 17.77);
      this.group.add(slot);
    }

    // ---------------------------------------------------------------- injector and autosampler on top of the GC
    const inj = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 1.6, 24), silverMat);
    inj.position.set(INJECTOR_X, GC_H + 0.8, AS_Z);
    const injNut = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.8, 18), new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.5 }));
    injNut.position.set(INJECTOR_X, GC_H + 2.0, AS_Z);
    this.group.add(inj, injNut);
    const tower = new THREE.Mesh(roundedBox(4.1, 17, 7.6, 0.9), white);
    tower.position.set(-24.8, GC_H, AS_Z - 1.2);
    tower.castShadow = true;
    this.group.add(tower);
    const towerStripe = new THREE.Mesh(new THREE.BoxGeometry(5.3, 1.0, 8.7), accent);
    towerStripe.position.set(-24.8, GC_H + 3, AS_Z - 1.2);
    this.group.add(towerStripe);
    const arm = new THREE.Mesh(roundedBox(24.4, 1.7, 3.2, 0.5), white);
    arm.position.set(-14.5, ARM_Y - 0.2, AS_Z);
    arm.castShadow = true;
    this.group.add(arm);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(22, 0.3, 0.5), silverMat);
    rail.position.set(-14.5, ARM_Y - 1.2, AS_Z + 1.7);
    this.group.add(rail);
    // syringe carriage on the arm
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
    // vial tray
    const tray = new THREE.Mesh(roundedBox(15.0, 1.2, 5.2, 0.6), new THREE.MeshStandardMaterial({ color: 0xd2d5d6, roughness: 0.5, metalness: 0.2 }));
    tray.position.set(-8.4, GC_H, AS_Z);
    tray.castShadow = true;
    this.group.add(tray);
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
    const ms = new THREE.Mesh(roundedBox(26, 30, 34, 1.5), cream);
    ms.position.x = MS_X;
    ms.castShadow = true;
    ms.receiveShadow = true;
    this.group.add(ms);
    const msBand = new THREE.Mesh(new THREE.BoxGeometry(27.7, 0.8, 35.7), accent);
    msBand.position.set(MS_X, 15.2, 0);
    this.group.add(msBand);
    // heated transfer line GC -> MS
    const transfer = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.4, 16), silverMat);
    transfer.rotation.z = Math.PI / 2;
    transfer.position.set(0, 9, 4);
    this.group.add(transfer);
    // control panel (upper front)
    const panel = frontPlate(23.4, 12.4, 0.4, 0.8, darkMat);
    panel.position.set(MS_X, 22.4, 17.75);
    this.group.add(panel);
    this.screen = new ScreenPanel(11.4, 8.2);
    this.screen.mesh.position.set(MS_X - 5.9, 22.4, 18.37);
    this.group.add(this.screen.mesh);
    const bezel = frontPlate(12.1, 8.9, 0.2, 0.5, new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.6 }));
    bezel.position.set(MS_X - 5.9, 22.4, 18.15);
    this.group.add(bezel);

    const srcSel = new Selector({
      id: 'ms.source',
      caption: 'SOURCE',
      labels: ['EI', 'ESI+', 'ESI-'],
      radius: 1.15,
      accent: 0xb27dff,
      describe: (i) => (i === 0 ? 'GC/MS, 70 eV electron ionisation: fragments, one spectrum per eluting compound' : i === 1 ? 'electrospray, positive: [M+H]+, [M+Na]+ and pre-formed cations' : 'electrospray, negative: [M-H]- and pre-formed anions'),
      onChange: (i) => {
        this.ionization = i === 0 ? 'EI' : i === 1 ? 'ESI_POS' : 'ESI_NEG';
      },
    });
    this.loadBtn = new PushButton({
      id: 'ms.load',
      label: 'LOAD',
      size: [3.8, 1.6],
      color: 0x3a444c,
      lamp: 0xffc233,
      hintText: 'Load a vial: puts the selected vessel\'s liquid in the autosampler tray (click the vessel first)',
      onPress: () => this.onLoad?.(),
    });
    const injectBtn = new PushButton({
      id: 'ms.inject',
      label: 'INJECT',
      size: [7.6, 2.7],
      color: 0x1f7a3f,
      lamp: 0x6dff9b,
      hintText: 'Inject: the autosampler draws the vial and injects; EI runs the GC programme and records a spectrum of every compound that elutes, ESI infuses the liquid (loads the selected vessel if the tray is empty)',
      onPress: () => this.onInject?.(),
    });
    place(srcSel, this.group, [MS_X + 5.9, 25.2, 18.17]);
    place(this.loadBtn, this.group, [MS_X + 9.9, 25.6, 18.17]);
    place(injectBtn, this.group, [MS_X + 7.6, 19.1, 18.17]);
    this.controls.push(srcSel, this.loadBtn, injectBtn);

    // lower front: ion-source viewport, vacuum read-out, vents
    const lowerPlate = frontPlate(23.4, 11.6, 0.3, 0.8, new THREE.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.4, metalness: 0.3 }));
    lowerPlate.position.set(MS_X, 8.3, 17.75);
    this.group.add(lowerPlate);
    const viewBezel = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.7, 28), silverMat);
    viewBezel.rotation.x = Math.PI / 2;
    viewBezel.position.set(MS_X - 6.0, 8.8, 18.4);
    this.group.add(viewBezel);
    this.ionSourceGlowMat = new THREE.MeshBasicMaterial({ color: 0x221144, toneMapped: false });
    const viewGlass = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), this.ionSourceGlowMat);
    viewGlass.position.set(MS_X - 6.0, 8.8, 18.77);
    this.group.add(viewGlass);
    const viewLegend = textLegend('ION SOURCE', 6, 0.6, { ink: '#2b3236', weight: 800 });
    viewLegend.rotation.x = 0;
    viewLegend.position.set(MS_X - 6.0, 4.6, 18.07);
    this.group.add(viewLegend);
    this.emissionLed = mkLed(MS_X + 5.4, 11.8, 18.1, 0x2e1d4a);
    const vacLed = mkLed(MS_X + 8.2, 11.8, 18.1, 0x1d3a26);
    vacLed.color.setHex(0x35e070);
    const el = textLegend('EMISSION', 3.2, 0.5, { ink: '#2b3236', weight: 800 });
    el.rotation.x = 0;
    el.position.set(MS_X + 5.4, 10.7, 18.07);
    const vl = textLegend('VACUUM', 3.2, 0.5, { ink: '#2b3236', weight: 800 });
    vl.rotation.x = 0;
    vl.position.set(MS_X + 8.2, 10.7, 18.07);
    this.group.add(el, vl);
    const gauge = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 2.4), new THREE.MeshBasicMaterial({ color: 0x06140b, toneMapped: false }));
    gauge.position.set(MS_X + 6.8, 6.4, 18.08);
    this.group.add(gauge);
    const gaugeTxt = textLegend('1.2e-5 Torr', 7.0, 1.6, { ink: '#5dff8a', weight: 700 });
    gaugeTxt.rotation.x = 0;
    gaugeTxt.position.set(MS_X + 6.8, 6.4, 18.1);
    this.group.add(gaugeTxt);
    // turbopump fan grille on the right side
    const grille = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.4, 36), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 }));
    grille.rotation.z = Math.PI / 2;
    grille.position.set(MS_X + 13.95, 13, 0);
    this.group.add(grille);
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 9.4), silverMat);
      bar.position.set(MS_X + 14.2, 13 + i * 1.8, 0);
      this.group.add(bar);
    }
    // foreline bellows to the roughing pump, which stands behind the bench
    const bellows = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(MS_X + 6, 3, -17), new THREE.Vector3(MS_X + 6, 3, -21), new THREE.Vector3(MS_X + 6, 0.4, -25), new THREE.Vector3(MS_X + 6, -14, -27)]), 24, 1.1, 10, false),
      new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.7, metalness: 0.5 })
    );
    this.group.add(bellows);
    // feet
    const footMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 });
    for (const x of [-25, -3, 3, 25]) {
      for (const z of [-14, 14]) {
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
    this.readyLed.color.setHex(this.phase === 'idle' ? 0x35e070 : 0x1d3a26);
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
    this.screen.draw(key, (ctx, w, h) => {
      ctx.fillStyle = '#0a0713';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(0, 0, w, h * 0.12);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#c6a8ff';
      ctx.font = `700 ${Math.round(h * 0.075)}px Arial, sans-serif`;
      ctx.fillText(`GC/MS  ·  ${this.ionization === 'EI' ? 'EI 70 eV' : this.ionization === 'ESI_POS' ? 'ESI (+)' : 'ESI (−)'}`, w * 0.03, h * 0.06);
      const state = this.phase === 'injecting' ? 'INJECTING' : this.phase === 'scanning' ? 'SCANNING' : this.pending ? 'STARTING' : this.vial.visible ? 'VIAL LOADED' : 'READY';
      ctx.textAlign = 'right';
      ctx.fillStyle = this.phase !== 'idle' ? '#ffc233' : '#7be0a0';
      ctx.fillText(state, w * 0.97, h * 0.06);
      ctx.textAlign = 'left';
      ctx.font = `${Math.round(h * 0.07)}px "Courier New", monospace`;
      ctx.fillStyle = '#b9a6e8';
      ctx.fillText(this.currentSampleName ? `Vial  ${this.currentSampleName.slice(0, 24)}` : 'Vial  (tray empty)', w * 0.03, h * 0.19);
      ctx.fillStyle = '#8c7fb5';
      ctx.fillText('m/z 10-500 · quad · 1.2e-5 Torr', w * 0.03, h * 0.27);
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
        ctx.fillText(this.vial.visible ? 'press INJECT' : 'press LOAD for the selected vessel', w / 2, (y0 + y1) / 2);
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
      ctx.fillText(this.phase === 'idle' ? 'GC  OVEN 40°C' : 'GC  RAMP 40>280°C', w * 0.06, h * 0.3);
      ctx.fillStyle = '#9fe8c4';
      ctx.fillText(`INLET 250°C  He 1.2mL/m`, w * 0.06, h * 0.62);
      ctx.fillStyle = this.phase === 'idle' ? '#7be0a0' : '#ffc233';
      ctx.fillText(this.phase === 'injecting' ? 'INJECTING' : this.phase === 'scanning' ? 'RUN' : 'READY', w * 0.06, h * 0.88);
    });
  }

  // ------------------------------------------------------------------ spectra
  public getLastSpectrum(): MassSpectrumResult | null {
    return this.lastSpectrum;
  }
}

const INJECT_SECONDS = 4.0;
const SCAN_SECONDS = 2.0;
