import * as THREE from 'three';
import type { SimController } from '../sim/sim_controller';
import type { UvVisScan } from '../types/sim';
import { LcdDisplay, frontPlate, roundedBox } from './lcd';
import { Control3D, Knob, PushButton, ScreenPanel, place, textLegend } from '../bench/controls3d';

export interface SpectrumPoint {
  lambda: number;
  absorbance: number;
  transmittance: number;
}

export interface SpectrumScanResult {
  sampleName: string;
  /** The reference measurement taken by BLANK (a flat 100 % T line), not a sample. */
  blank?: boolean;
  points: SpectrumPoint[];
  lambdaMax: number;
  maxAbsorbance: number;
  peaks: Array<{ lambda: number; abs: number; species?: string; tier?: string; source?: string }>;
  /** Species behind the spectrum, strongest first, with the data tier and source of their bands (from the engine). */
  contributors?: Array<{ name: string; tier: string; source: string; solventMatched: boolean }>;
  /** Solvent class the sample was measured in (water, alkane, ...). */
  solvent?: string;
}

/** Instrument model: the cell/solvent baseline and the absorbance above which the detector no longer reads (stray light). */
export const CELL_BASELINE_ABSORBANCE = 0.005;
export const DETECTOR_SATURATION_ABSORBANCE = 3.5;
/** Scan range and step of the instrument, nm, and the cuvette path, cm. */
export const SCAN_NM_MIN = 350;
export const SCAN_NM_MAX = 750;
export const SCAN_STEP_NM = 5;
export const CUVETTE_PATH_CM = 1;

export class Spectrophotometer {
  public group = new THREE.Group();
  /** Front-panel controls (wavelength knob, BLANK, SCAN); the scene registers them with its control rig. */
  public readonly controls: Control3D[] = [];
  /** BLANK was pressed / SCAN was pressed (the app decides what is scanned: the selected vessel). */
  public onBlank?: () => void;
  public onScan?: () => void;
  /** Wavelength the knob is set to, nm (the instrument panel reads the absorbance there). */
  public wavelengthNm = 500;
  private lidPivot = new THREE.Group();
  private cuvette = new THREE.Group();
  /** The instrument's control software window; shown on the lab PC (`Workstation`), not on the instrument. */
  public readonly software: ScreenPanel;
  /** The small readout on the front panel. */
  private lcd: LcdDisplay;
  private statusLedMat: THREE.MeshBasicMaterial;
  private beamLedMat: THREE.MeshBasicMaterial;
  private isScanning = false;
  private currentSampleName: string | null = null;
  private lastScan: SpectrumScanResult | null = null;
  /** Raw absorbance (cell + solvent + turbidity) of the reference cuvette, per scan point; later scans are read against it. */
  private blankRaw: number[] | null = null;
  private blankName: string | null = null;
  private scanId = 0;
  private lidT = 0;
  private lidTarget = 0;
  private lidHold = 0;
  private time = 0;

  constructor() {
    this.group.name = 'instrument_spectrophotometer';

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdcdfe2, roughness: 0.35, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.5, metalness: 0.2 });
    const blueTrim = new THREE.MeshStandardMaterial({ color: 0x0b66c3, roughness: 0.4, metalness: 0.2 });

    // Main spectrometer unit: 28cm W x 11cm H x 24cm D
    const base = new THREE.Mesh(roundedBox(28, 11, 24, 1.2), bodyMat);
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    // Brand accent band (a hair proud of the bevelled body so it shows)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(29.5, 0.5, 25.5), blueTrim);
    stripe.position.y = 9.9;
    this.group.add(stripe);

    // ---------------------------------------------------------------- sample compartment (top right) with a hinged lid
    const well = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.3, 11.6), new THREE.MeshStandardMaterial({ color: 0x0d0f11, roughness: 0.8 }));
    well.position.set(7.2, 11.0, -1.0);
    this.group.add(well);
    // cuvette holder: a black block with a window, the cuvette stands in it
    const holder = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 2.6), new THREE.MeshStandardMaterial({ color: 0x25292e, roughness: 0.6 }));
    holder.position.set(7.2, 11.4, -1.0);
    this.group.add(holder);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xe9f2f7, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0 });
    const cuv = new THREE.Mesh(new THREE.BoxGeometry(1.25, 4.6, 1.25), glass);
    cuv.position.y = 2.3;
    const liquid = new THREE.Mesh(new THREE.BoxGeometry(1.05, 3.0, 1.05), new THREE.MeshStandardMaterial({ color: 0x9cc8e6, transparent: true, opacity: 0.7, roughness: 0.2 }));
    liquid.position.y = 1.7;
    const cuvCap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 1.3), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 }));
    cuvCap.position.y = 4.7;
    this.cuvette.add(cuv, liquid, cuvCap);
    this.cuvette.position.set(7.2, 11.8, -1.0);
    this.cuvette.visible = false;
    this.group.add(this.cuvette);
    // lid: hinged at the back edge of the well
    this.lidPivot.position.set(7.2, 11.2, -6.8);
    const lid = new THREE.Mesh(roundedBox(10.8, 2.0, 12.0, 0.8), new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.4, metalness: 0.3 }));
    lid.position.set(0, 0, 6.0);
    lid.castShadow = true;
    const handle = new THREE.Mesh(roundedBox(5, 0.5, 1.0, 0.3), new THREE.MeshStandardMaterial({ color: 0x9aa2a8, metalness: 0.8, roughness: 0.3 }));
    handle.position.set(0, 1.9, 11.0);
    this.lidPivot.add(lid, handle);
    this.group.add(this.lidPivot);

    // ---------------------------------------------------------------- sloped front console (a wedge in front of the body)
    const prof = new THREE.Shape();
    prof.moveTo(11.5, 1.0);
    prof.lineTo(15.0, 1.0);
    prof.lineTo(13.2, 9.4);
    prof.lineTo(11.5, 9.4);
    prof.closePath();
    const wedgeGeo = new THREE.ExtrudeGeometry(prof, { depth: 27, bevelEnabled: false });
    wedgeGeo.rotateY(-Math.PI / 2); // profile (z, y), extruded along x
    wedgeGeo.translate(13.5, 0, 0);
    const wedge = new THREE.Mesh(wedgeGeo, darkMat);
    wedge.castShadow = true;
    this.group.add(wedge);
    // the plate lies on the wedge's sloped face: centre of the face line, tilted back by atan(1.8 / 8.4)
    const panel = new THREE.Group();
    panel.position.set(0, 5.2, 14.1);
    panel.rotation.x = -0.2113;
    this.group.add(panel);
    const plate = frontPlate(25, 8.2, 0.5, 0.6, new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.5, metalness: 0.2 }));
    plate.position.z = 0;
    panel.add(plate);

    // the instrument has a small monochrome readout (wavelength, absorbance); the spectrum is plotted by its software on the lab PC
    this.software = new ScreenPanel(12.4, 7.0, 100);
    this.lcd = new LcdDisplay(11.2, 4.0, { bg: '#aebd98', fg: '#18210f', ghost: 'rgba(24,33,15,0.07)', unit: 'A' });
    this.lcd.mesh.position.set(-6.4, 1.4, 0.72);
    panel.add(this.lcd.mesh);
    const lcdFrame = frontPlate(12.2, 4.9, 0.2, 0.4, new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.6 }));
    lcdFrame.position.set(-6.4, 1.4, 0.5);
    panel.add(lcdFrame);
    const model = textLegend('UV-VIS SPECTROPHOTOMETER', 11.5, 0.7, { ink: '#8d979f', weight: 700 });
    model.rotation.x = 0;
    model.position.set(-6.4, -2.1, 0.54);
    panel.add(model);

    // wavelength knob
    const knob = new Knob({
      id: 'spectro.lambda',
      caption: 'WAVELENGTH',
      min: 350,
      max: 750,
      step: 5,
      value: this.wavelengthNm,
      radius: 1.3,
      accent: 0x62d2ff,
      ticks: 9,
      labels: [
        { at: 0, text: '350' },
        { at: 1, text: '750' },
      ],
      format: (v) => `${v} nm`,
      onChange: (v) => {
        this.wavelengthNm = v;
      },
    });
    place(knob, panel, [6.4, 1.4, 0.52]);
    const blankBtn = new PushButton({
      id: 'spectro.blank',
      label: 'BLANK',
      size: [3.7, 1.5],
      color: 0x3a444c,
      hintText: 'Blank: zero the absorbance on the solvent reference (100 % T)',
      onPress: () => this.onBlank?.(),
    });
    const scanBtn = new PushButton({
      id: 'spectro.scan',
      label: 'SCAN',
      size: [3.7, 1.5],
      color: 0x1f6b3a,
      hintText: 'Scan 350-750 nm on the selected vessel\'s liquid (click the vessel first); the cuvette goes in the sample compartment',
      onPress: () => this.onScan?.(),
    });
    place(blankBtn, panel, [4.2, -2.9, 0.52]);
    place(scanBtn, panel, [8.7, -2.9, 0.52]);
    this.controls.push(knob, blankBtn, scanBtn);

    // Status LEDs
    this.statusLedMat = new THREE.MeshBasicMaterial({ color: 0x22ee44 });
    const statusLed = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 16), this.statusLedMat);
    statusLed.rotation.x = Math.PI / 2;
    statusLed.position.set(9.3, 3.5, 0.56);
    panel.add(statusLed);
    this.beamLedMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
    const beamLed = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.2, 16), this.beamLedMat);
    beamLed.rotation.x = Math.PI / 2;
    beamLed.position.set(10.7, 3.5, 0.56);
    panel.add(beamLed);
    const lg = textLegend('READY', 1.9, 0.5, { ink: '#8d979f', weight: 700 });
    lg.rotation.x = 0;
    lg.position.set(9.3, 2.7, 0.54);
    const lg2 = textLegend('LAMP', 1.9, 0.5, { ink: '#8d979f', weight: 700 });
    lg2.rotation.x = 0;
    lg2.position.set(10.7, 2.7, 0.54);
    panel.add(lg, lg2);

    // feet
    const footMat = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.9 });
    for (const [x, z] of [[-12, -10], [12, -10], [-12, 10], [12, 10]]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.4, 12), footMat);
      f.position.set(x, -0.1, z);
      this.group.add(f);
    }
    this.drawScreen();
  }

  /** Per-frame: lid animation and the screen. */
  public animate(dt: number) {
    this.time += dt;
    if (this.lidHold > 0) {
      this.lidHold -= dt;
      if (this.lidHold <= 0) this.lidTarget = 0;
    }
    if (this.lidT !== this.lidTarget) {
      this.lidT += Math.sign(this.lidTarget - this.lidT) * Math.min(Math.abs(this.lidTarget - this.lidT), dt * 3.2);
      const k = this.lidT * this.lidT * (3 - 2 * this.lidT);
      this.lidPivot.rotation.x = -1.25 * k;
    }
    this.drawScreen();
  }

  /** Open the lid for a moment (sample change), then close it. */
  public pulseLid(seconds = 0.9) {
    this.lidTarget = 1;
    this.lidHold = seconds;
  }

  /** Absorbance / transmittance of the last scan at `nm` (blank: 0 / 100). */
  public readingAt(nm: number): { abs: number; trans: number } {
    const scan = this.lastScan;
    if (scan && scan.points.length > 0) {
      const pt = scan.points.find((p) => Math.abs(p.lambda - nm) < 3);
      if (pt) return { abs: pt.absorbance, trans: pt.transmittance };
    }
    return { abs: 0, trans: 100 };
  }

  private drawScreen() {
    const nm = this.wavelengthNm;
    const key = `${this.scanId}|${nm}|${this.isScanning}|${this.currentSampleName}|${this.blankName}|${this.isScanning ? Math.floor(this.time * 6) % 4 : 0}`;
    const rd = this.readingAt(nm);
    this.lcd.set(rd.abs.toFixed(3), `${nm} nm   ${rd.trans.toFixed(1)} %T`);
    this.software.draw(key, (ctx, w, h) => {
      ctx.fillStyle = '#071521';
      ctx.fillRect(0, 0, w, h);
      // header
      ctx.fillStyle = '#0d2a40';
      ctx.fillRect(0, 0, w, h * 0.13);
      ctx.fillStyle = '#7fd6ff';
      ctx.font = `700 ${Math.round(h * 0.085)}px Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('UV-VIS  350-750 nm', w * 0.03, h * 0.065);
      ctx.textAlign = 'right';
      ctx.fillStyle = this.isScanning ? '#ffc233' : '#5df08a';
      ctx.fillText(this.isScanning ? 'SCANNING' + '.'.repeat(Math.floor(this.time * 6) % 4) : this.blankName !== null && this.lastScan?.blank ? 'BLANKED' : 'READY', w * 0.97, h * 0.065);
      // plot area
      const px0 = w * 0.1;
      const px1 = w * 0.96;
      const py0 = h * 0.2;
      const py1 = h * 0.7;
      ctx.strokeStyle = '#1d4560';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#4f89aa';
      ctx.font = `${Math.round(h * 0.06)}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      for (let l = 400; l <= 700; l += 100) {
        const x = px0 + ((l - SCAN_NM_MIN) / (SCAN_NM_MAX - SCAN_NM_MIN)) * (px1 - px0);
        ctx.beginPath();
        ctx.moveTo(x, py0);
        ctx.lineTo(x, py1);
        ctx.stroke();
        ctx.fillText(String(l), x, py1 + h * 0.06);
      }
      const scan = this.lastScan;
      const amax = Math.max(1, Math.ceil((scan?.maxAbsorbance ?? 0) * 1.1 * 2) / 2);
      ctx.textAlign = 'right';
      for (const a of [0, amax / 2, amax]) {
        const y = py1 - (a / amax) * (py1 - py0);
        ctx.beginPath();
        ctx.moveTo(px0, y);
        ctx.lineTo(px1, y);
        ctx.stroke();
        ctx.fillText(a.toFixed(1), px0 - 3, y);
      }
      // spectrum
      if (scan && scan.points.length > 1) {
        const grad = ctx.createLinearGradient(px0, 0, px1, 0);
        grad.addColorStop(0, '#8a4bff');
        grad.addColorStop(0.2, '#3f7bff');
        grad.addColorStop(0.4, '#34e0c0');
        grad.addColorStop(0.55, '#7be04a');
        grad.addColorStop(0.7, '#ffd23a');
        grad.addColorStop(1, '#ff4a3a');
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(2, h * 0.012);
        ctx.beginPath();
        scan.points.forEach((p, i) => {
          const x = px0 + ((p.lambda - SCAN_NM_MIN) / (SCAN_NM_MAX - SCAN_NM_MIN)) * (px1 - px0);
          const y = py1 - (Math.min(p.absorbance, amax) / amax) * (py1 - py0);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      // wavelength cursor
      const cx = px0 + ((nm - SCAN_NM_MIN) / (SCAN_NM_MAX - SCAN_NM_MIN)) * (px1 - px0);
      ctx.strokeStyle = '#ffd34a';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, py0);
      ctx.lineTo(cx, py1);
      ctx.stroke();
      ctx.setLineDash([]);
      // read-out line
      const r = this.readingAt(nm);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd34a';
      ctx.font = `700 ${Math.round(h * 0.085)}px "Courier New", monospace`;
      ctx.fillText(`${nm} nm`, w * 0.03, h * 0.83);
      ctx.fillStyle = '#7fe8b0';
      ctx.fillText(`A ${r.abs.toFixed(3)}`, w * 0.3, h * 0.83);
      ctx.fillStyle = '#9ad7ff';
      ctx.fillText(`${r.trans.toFixed(1)} %T`, w * 0.62, h * 0.83);
      ctx.fillStyle = '#6f93a8';
      ctx.font = `${Math.round(h * 0.065)}px Arial, sans-serif`;
      const inCell = this.currentSampleName ? `Cuvette: ${this.currentSampleName}` : 'No cuvette in the compartment';
      ctx.fillText(this.blankName ? `${inCell}  |  Blank: ${this.blankName}` : `${inCell}  |  Not blanked`, w * 0.03, h * 0.94);
    });
  }

  public setSample(vesselName: string | null) {
    this.currentSampleName = vesselName;
    this.cuvette.visible = !!vesselName;
    this.scanId++;
  }

  public get sampleName(): string | null {
    return this.currentSampleName;
  }

  public get scanning(): boolean {
    return this.isScanning;
  }

  public setScanning(scanning: boolean) {
    this.isScanning = scanning;
    this.statusLedMat.color.setHex(scanning ? 0xffaa00 : 0x22ee44);
    this.beamLedMat.color.setHex(scanning ? 0x88bbff : 0x111122);
    if (scanning) this.pulseLid(0.8);
    this.scanId++;
  }

  /**
   * BLANK: reads the reference cuvette (the pure solvent, the selected vessel) and stores it as the 100 % T line. Scans after
   * it are absorbances relative to the reference, so the cell and the solvent drop out. Needs the engine, like a scan.
   */
  public async blank(sim: SimController, vesselId: string, vesselName: string): Promise<SpectrumScanResult> {
    this.setSample(vesselName);
    this.setScanning(true);
    let eng: UvVisScan;
    try {
      eng = await this.measure(sim, vesselId);
    } catch (err) {
      this.setScanning(false);
      throw err;
    }
    this.blankRaw = eng.points.map((p) => CELL_BASELINE_ABSORBANCE + p.a_species + p.a_turbidity);
    this.blankName = vesselName;
    this.scanId++;
    this.lastScan = {
      sampleName: `Blank (${vesselName})`,
      blank: true,
      points: eng.points.map((p) => ({ lambda: p.nm, absorbance: 0, transmittance: 100 })),
      lambdaMax: SCAN_NM_MIN,
      maxAbsorbance: 0,
      peaks: [],
      solvent: eng.solvent_class,
    };
    setTimeout(() => this.setScanning(false), 400);
    return this.lastScan;
  }

  private measure(sim: SimController, vesselId: string): Promise<UvVisScan> {
    return sim.uvvisScan(vesselId, { layer: 0, nmMin: SCAN_NM_MIN, nmMax: SCAN_NM_MAX, stepNm: SCAN_STEP_NM, pathCm: CUVETTE_PATH_CM });
  }

  /**
   * Scans the liquid in a vessel. The spectrum is the engine's own: the same optical records and models that colour the liquid
   * in the 3D scene (bands per solvent, ligand-field estimates, imported UV bands) plus the turbidity of suspended solids,
   * evaluated at the instrument's wavelengths. The instrument adds its cell baseline and saturates at its detector limit.
   */
  public async scan(sim: SimController, vesselId: string, vesselName: string): Promise<SpectrumScanResult> {
    this.setScanning(true);
    let eng: UvVisScan;
    try {
      eng = await this.measure(sim, vesselId);
    } catch (err) {
      this.setScanning(false);
      throw err;
    }
    const blank = this.blankRaw && this.blankRaw.length === eng.points.length ? this.blankRaw : null;
    const points: SpectrumPoint[] = [];
    let lambdaMax = SCAN_NM_MIN;
    let maxAbs = 0;
    for (const [i, p] of eng.points.entries()) {
      const raw = CELL_BASELINE_ABSORBANCE + p.a_species + p.a_turbidity;
      const a = Math.min(DETECTOR_SATURATION_ABSORBANCE, blank ? Math.max(0, raw - blank[i]) : raw);
      const t = Math.max(0.001, Math.min(100, Math.pow(10, -a) * 100));
      points.push({ lambda: p.nm, absorbance: a, transmittance: t });
      if (a > maxAbs) {
        maxAbs = a;
        lambdaMax = p.nm;
      }
    }

    // local peaks, each named after the species whose band contributes most at that wavelength (or the turbidity)
    const peaks: SpectrumScanResult['peaks'] = [];
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      if (p.absorbance > 0.04 && p.absorbance > points[i - 1].absorbance && p.absorbance >= points[i + 1].absorbance) {
        const turb = eng.points[i].a_turbidity;
        let best: { name: string; a: number; tier: string; source: string } | null = null;
        for (const c of eng.contributors) {
          const a = (c.a_per_cm[i] ?? 0) * eng.path_cm;
          if (!best || a > best.a) best = { name: c.name, a, tier: c.tier, source: c.source };
        }
        if (turb > (best?.a ?? 0)) {
          peaks.push({ lambda: p.lambda, abs: p.absorbance, species: 'Turbidity (scattering by suspended solid)' });
        } else {
          peaks.push({ lambda: p.lambda, abs: p.absorbance, species: best?.name ?? `Absorbance band @ ${p.lambda} nm`, tier: best?.tier, source: best?.source });
        }
      }
    }

    this.scanId++;
    this.lastScan = {
      sampleName: vesselName,
      points,
      lambdaMax,
      maxAbsorbance: maxAbs,
      peaks,
      contributors: eng.contributors.map((c) => ({ name: c.name, tier: c.tier, source: c.source, solventMatched: c.solvent_matched })),
      solvent: eng.solvent_class,
    };
    setTimeout(() => this.setScanning(false), 400);
    return this.lastScan;
  }

  public getLastScan(): SpectrumScanResult | null {
    return this.lastScan;
  }
}
