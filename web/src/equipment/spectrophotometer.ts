import * as THREE from 'three';
import type { SimController } from '../sim/sim_controller';
import type { UvVisScan } from '../types/sim';
import { roundedBox } from './lcd';

export interface SpectrumPoint {
  lambda: number;
  absorbance: number;
  transmittance: number;
}

export interface SpectrumScanResult {
  sampleName: string;
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
  public sampleLid: THREE.Mesh;
  private statusLedMat: THREE.MeshBasicMaterial;
  private beamLedMat: THREE.MeshBasicMaterial;
  private isScanning = false;
  private currentSampleName: string | null = null;
  private lastScan: SpectrumScanResult | null = null;
  private blankActive = false;

  constructor() {
    this.group.name = 'instrument_spectrophotometer';

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.35, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.5, metalness: 0.2 });
    const blueTrim = new THREE.MeshStandardMaterial({ color: 0x0066cc, roughness: 0.4, metalness: 0.2 });

    // Main spectrometer unit: 26cm W x 13cm H x 24cm D
    const base = new THREE.Mesh(roundedBox(26, 11, 24, 1.2), bodyMat);
    base.position.y = 5.5;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    // Front angled display section
    const frontPanel = new THREE.Mesh(roundedBox(24.5, 9, 8, 0.8), darkMat);
    frontPanel.position.set(0, 5.0, 9.0);
    frontPanel.rotation.x = 0.22;
    this.group.add(frontPanel);

    // Color LCD graphic display screen (dummy visual representation on mesh)
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0a1a2a });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.5), screenMat);
    screen.position.set(-4.5, 5.5, 13.1);
    screen.rotation.x = 0.22;
    this.group.add(screen);

    // Sample compartment on top-right
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x30353c, roughness: 0.4, metalness: 0.3 });
    this.sampleLid = new THREE.Mesh(roundedBox(9, 2.0, 10, 0.6), lidMat);
    this.sampleLid.position.set(6.5, 11.5, -2.0);
    this.sampleLid.castShadow = true;
    this.group.add(this.sampleLid);

    // Cuvette slot cutout indicator
    const slotRim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    slotRim.position.set(6.5, 11.0, -2.0);
    this.group.add(slotRim);

    // Brand accent line
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(26.2, 0.6, 24.2), blueTrim);
    stripe.position.y = 7.0;
    this.group.add(stripe);

    // Status LEDs
    this.statusLedMat = new THREE.MeshBasicMaterial({ color: 0x228822 });
    const statusLed = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16), this.statusLedMat);
    statusLed.position.set(8.5, 8.5, 12.0);
    statusLed.rotation.x = 0.22;
    this.group.add(statusLed);

    this.beamLedMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
    const beamLed = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16), this.beamLedMat);
    beamLed.position.set(10.0, 8.5, 12.0);
    beamLed.rotation.x = 0.22;
    this.group.add(beamLed);

    // Keypad buttons
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.5 });
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const btn = new THREE.Mesh(roundedBox(1.5, 0.4, 1.2, 0.2), btnMat);
        btn.position.set(4.5 + c * 2.2, 4.0 + r * 2.0, 12.5);
        btn.rotation.x = 0.22;
        this.group.add(btn);
      }
    }
  }

  public setSample(vesselName: string | null) {
    this.currentSampleName = vesselName;
  }

  public get sampleName(): string | null {
    return this.currentSampleName;
  }

  public setScanning(scanning: boolean) {
    this.isScanning = scanning;
    this.statusLedMat.color.setHex(scanning ? 0xffaa00 : 0x22ee44);
    this.beamLedMat.color.setHex(scanning ? 0x88bbff : 0x111122);
  }

  public blank() {
    this.blankActive = true;
    this.lastScan = {
      sampleName: 'Blank (Deionized H2O)',
      points: Array.from({ length: 81 }, (_, i) => ({
        lambda: 350 + i * 5,
        absorbance: 0.0,
        transmittance: 100.0,
      })),
      lambdaMax: 350,
      maxAbsorbance: 0.0,
      peaks: [],
    };
    return this.lastScan;
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
      eng = await sim.uvvisScan(vesselId, { layer: 0, nmMin: SCAN_NM_MIN, nmMax: SCAN_NM_MAX, stepNm: SCAN_STEP_NM, pathCm: CUVETTE_PATH_CM });
    } catch (err) {
      this.setScanning(false);
      throw err;
    }
    const points: SpectrumPoint[] = [];
    let lambdaMax = SCAN_NM_MIN;
    let maxAbs = 0;
    for (const p of eng.points) {
      const a = Math.min(DETECTOR_SATURATION_ABSORBANCE, CELL_BASELINE_ABSORBANCE + p.a_species + p.a_turbidity);
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
