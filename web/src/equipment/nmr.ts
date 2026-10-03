import * as THREE from 'three';
import { VesselSnapshot } from '../types/sim';
import { roundedBox } from './lcd';

export type NmrNucleus = '1H' | '13C';
export type NmrSolvent = 'CDCl3' | 'D2O' | 'DMSO-d6';

export interface NmrPeak {
  ppm: number;
  multiplicity: 's' | 'd' | 't' | 'q' | 'm' | 'br s';
  j_hz?: number;
  integration: number;
  assignment: string;
}

export interface NmrSpectrumResult {
  sampleName: string;
  nucleus: NmrNucleus;
  solvent: NmrSolvent;
  frequencyMhz: number;
  peaks: NmrPeak[];
  curvePoints: Array<{ ppm: number; intensity: number }>;
}

export class NmrMachine {
  public group = new THREE.Group();
  public cryoMagnet = new THREE.Group();
  private statusRingMat: THREE.MeshBasicMaterial;
  private isAcquiring = false;
  private currentSampleName: string | null = null;
  private lastSpectrum: NmrSpectrumResult | null = null;

  constructor() {
    this.group.name = 'instrument_nmr_spectrometer';

    // ---------------------------------------------------------------- Benchtop FT-NMR Unit (on counter)
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0xe6e8eb, roughness: 0.35, metalness: 0.1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x24282e, roughness: 0.5, metalness: 0.2 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc8ced4, metalness: 0.85, roughness: 0.2 });

    // Console: 28cm W x 18cm H x 26cm D
    const consoleBox = new THREE.Mesh(roundedBox(28, 16, 26, 1.4), chassisMat);
    consoleBox.position.y = 8.0;
    consoleBox.castShadow = true;
    consoleBox.receiveShadow = true;
    this.group.add(consoleBox);

    // Front recessed panel
    const face = new THREE.Mesh(roundedBox(25, 12, 0.8, 0.4), darkMat);
    face.position.set(0, 7.5, 13.0);
    this.group.add(face);

    // Integrated touchscreen display on faceplate
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(16, 9.5), new THREE.MeshBasicMaterial({ color: 0x0c1e28 }));
    screen.position.set(-3.5, 7.5, 13.45);
    this.group.add(screen);

    // Top Sample Bore / Turbine Spinner Housing
    const boreCollar = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.8, 4.0, 32), silverMat);
    boreCollar.position.set(7.5, 17.5, -4.0);
    boreCollar.castShadow = true;
    this.group.add(boreCollar);

    // 5mm NMR Tube inserted in bore
    const tubeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, opacity: 0.8, transparent: true, roughness: 0.05 });
    const nmrTube = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 16.0, 16), tubeMat);
    nmrTube.position.set(7.5, 23.0, -4.0);
    nmrTube.castShadow = true;
    this.group.add(nmrTube);

    // Red polyethylene spinner cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 16), new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.4 }));
    cap.position.set(7.5, 19.5, -4.0);
    this.group.add(cap);

    // Status ring light around the sample bore
    this.statusRingMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.18, 12, 32), this.statusRingMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(7.5, 16.2, -4.0);
    this.group.add(ring);

    // ---------------------------------------------------------------- Superconducting Cryomagnet (Floor Tower)
    // Sits on floor: stainless steel cryostat cylinder with helium/nitrogen transfer ports
    this.cryoMagnet.name = 'instrument_nmr_cryostat';
    const cryoBodyMat = new THREE.MeshStandardMaterial({ color: 0xdfe4e8, metalness: 0.8, roughness: 0.2 });
    const cryoLegMat = new THREE.MeshStandardMaterial({ color: 0x363a40, roughness: 0.5, metalness: 0.6 });

    // Cryostat cylinder: 42cm diam, 75cm high
    const cryo = new THREE.Mesh(new THREE.CylinderGeometry(21, 21, 75, 40), cryoBodyMat);
    cryo.position.y = 37.5;
    cryo.castShadow = true;
    this.cryoMagnet.add(cryo);

    // Top domed flange
    const dome = new THREE.Mesh(new THREE.SphereGeometry(21.2, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.35), silverMat);
    dome.position.y = 75.0;
    this.cryoMagnet.add(dome);

    // Cryogen exhaust stacks (Liquid He & N2 turrets)
    for (const [tx, tz] of [[-10, -8], [10, -8], [0, 11]]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 18, 20), silverMat);
      stack.position.set(tx, 82.0, tz);
      this.cryoMagnet.add(stack);
    }

    // Three anti-vibration pneumatic isolation tripod legs
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.0, 24, 20), cryoLegMat);
      leg.position.set(Math.cos(angle) * 19, 12.0, Math.sin(angle) * 19);
      this.cryoMagnet.add(leg);
    }

    // 5 Gauss warning perimeter circle (floor decal)
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5b041, side: THREE.DoubleSide });
    const line = new THREE.Mesh(new THREE.RingGeometry(42, 43.5, 48), lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.2;
    this.cryoMagnet.add(line);
  }

  public setSample(vesselName: string | null) {
    this.currentSampleName = vesselName;
  }

  public get sampleName(): string | null {
    return this.currentSampleName;
  }

  public setAcquiring(acquiring: boolean) {
    this.isAcquiring = acquiring;
    this.statusRingMat.color.setHex(acquiring ? 0xffbb00 : 0x00d4ff);
  }

  public acquire(snapshot: VesselSnapshot | null, vesselName: string, nucleus: NmrNucleus = '1H', solvent: NmrSolvent = 'CDCl3'): NmrSpectrumResult {
    this.setAcquiring(true);
    const freqMhz = nucleus === '1H' ? 400.13 : 100.61;
    const peaks = this.predictPeaks(snapshot, nucleus, solvent);

    // Generate continuous Lorentzian FT spectrum curve
    const minPpm = nucleus === '1H' ? -0.5 : -10;
    const maxPpm = nucleus === '1H' ? 13.0 : 230;
    const nPoints = 400;
    const step = (maxPpm - minPpm) / nPoints;
    const curvePoints: Array<{ ppm: number; intensity: number }> = [];

    const gamma = nucleus === '1H' ? 0.015 : 0.4; // linewidth in ppm
    const g2 = Math.pow(gamma / 2, 2);

    for (let i = 0; i <= nPoints; i++) {
      const ppm = minPpm + i * step;
      let intensity = 0.002 * Math.sin(ppm * 37) + 0.003; // authentic baseline noise

      for (const pk of peaks) {
        // multiplet components
        const subs = this.getMultipletSubpeaks(pk);
        for (const sub of subs) {
          const dPpm = ppm - sub.ppm;
          const lorentz = (sub.amp * g2) / (dPpm * dPpm + g2);
          intensity += lorentz;
        }
      }
      curvePoints.push({ ppm, intensity: Math.max(0, intensity) });
    }

    this.lastSpectrum = {
      sampleName: vesselName,
      nucleus,
      solvent,
      frequencyMhz: freqMhz,
      peaks,
      curvePoints,
    };

    setTimeout(() => this.setAcquiring(false), 500);
    return this.lastSpectrum;
  }

  public getLastSpectrum(): NmrSpectrumResult | null {
    return this.lastSpectrum;
  }

  private getMultipletSubpeaks(peak: NmrPeak): Array<{ ppm: number; amp: number }> {
    const jPpm = (peak.j_hz ?? 7.0) / 400.13;
    switch (peak.multiplicity) {
      case 'd':
        return [
          { ppm: peak.ppm - jPpm / 2, amp: peak.integration * 0.5 },
          { ppm: peak.ppm + jPpm / 2, amp: peak.integration * 0.5 },
        ];
      case 't':
        return [
          { ppm: peak.ppm - jPpm, amp: peak.integration * 0.25 },
          { ppm: peak.ppm, amp: peak.integration * 0.5 },
          { ppm: peak.ppm + jPpm, amp: peak.integration * 0.25 },
        ];
      case 'q':
        return [
          { ppm: peak.ppm - 1.5 * jPpm, amp: peak.integration * 0.125 },
          { ppm: peak.ppm - 0.5 * jPpm, amp: peak.integration * 0.375 },
          { ppm: peak.ppm + 0.5 * jPpm, amp: peak.integration * 0.375 },
          { ppm: peak.ppm + 1.5 * jPpm, amp: peak.integration * 0.125 },
        ];
      case 'm':
        return [
          { ppm: peak.ppm - jPpm, amp: peak.integration * 0.2 },
          { ppm: peak.ppm - jPpm * 0.5, amp: peak.integration * 0.3 },
          { ppm: peak.ppm + jPpm * 0.5, amp: peak.integration * 0.3 },
          { ppm: peak.ppm + jPpm, amp: peak.integration * 0.2 },
        ];
      default:
        return [{ ppm: peak.ppm, amp: peak.integration }];
    }
  }

  private predictPeaks(snapshot: VesselSnapshot | null, nucleus: NmrNucleus, solvent: NmrSolvent): NmrPeak[] {
    const peaks: NmrPeak[] = [];

    // Reference & solvent residual peaks
    if (nucleus === '1H') {
      peaks.push({ ppm: 0.0, multiplicity: 's', integration: 0.2, assignment: 'TMS (internal standard)' });
      if (solvent === 'CDCl3') {
        peaks.push({ ppm: 7.26, multiplicity: 's', integration: 0.3, assignment: 'Residual CHCl3 in CDCl3' });
      } else if (solvent === 'D2O') {
        peaks.push({ ppm: 4.79, multiplicity: 's', integration: 1.0, assignment: 'Residual HDO in D2O' });
      } else if (solvent === 'DMSO-d6') {
        peaks.push({ ppm: 2.50, multiplicity: 'm', integration: 0.4, assignment: 'Residual DMSO-d5' });
        peaks.push({ ppm: 3.33, multiplicity: 'br s', integration: 0.3, assignment: 'Residual H2O in DMSO' });
      }
    } else {
      if (solvent === 'CDCl3') {
        peaks.push({ ppm: 77.16, multiplicity: 't', j_hz: 32, integration: 1.0, assignment: 'CDCl3 13C triplet' });
      } else if (solvent === 'DMSO-d6') {
        peaks.push({ ppm: 39.52, multiplicity: 'm', integration: 1.0, assignment: 'DMSO-d6 13C septet' });
      }
    }

    if (!snapshot) return peaks;

    // Detect organic solutes from snapshot species
    const speciesNames = snapshot.species.map((s) => s.id.toLowerCase());

    const hasSpecies = (pattern: RegExp) => speciesNames.some((s) => pattern.test(s));

    if (nucleus === '1H') {
      if (hasSpecies(/ethanol|ch3ch2oh|c2h6o/)) {
        peaks.push(
          { ppm: 1.25, multiplicity: 't', j_hz: 7.0, integration: 3, assignment: 'Ethanol -CH3' },
          { ppm: 3.69, multiplicity: 'q', j_hz: 7.0, integration: 2, assignment: 'Ethanol -CH2-' },
          { ppm: 2.45, multiplicity: 'br s', integration: 1, assignment: 'Ethanol -OH' }
        );
      } else if (hasSpecies(/acetic_acid|ch3cooh|c2h4o2/)) {
        peaks.push(
          { ppm: 2.08, multiplicity: 's', integration: 3, assignment: 'Acetic acid -CH3' },
          { ppm: 11.52, multiplicity: 'br s', integration: 1, assignment: 'Acetic acid -COOH' }
        );
      } else if (hasSpecies(/acetone|ch3coch3|c3h6o/)) {
        peaks.push({ ppm: 2.17, multiplicity: 's', integration: 6, assignment: 'Acetone -CH3' });
      } else if (hasSpecies(/ethyl_acetate|ethylacetate|c4h8o2/)) {
        peaks.push(
          { ppm: 1.26, multiplicity: 't', j_hz: 7.1, integration: 3, assignment: 'Ethyl acetate ethyl -CH3' },
          { ppm: 2.04, multiplicity: 's', integration: 3, assignment: 'Ethyl acetate acetyl -CH3' },
          { ppm: 4.12, multiplicity: 'q', j_hz: 7.1, integration: 2, assignment: 'Ethyl acetate -OCH2-' }
        );
      } else if (hasSpecies(/benzene|c6h6/)) {
        peaks.push({ ppm: 7.36, multiplicity: 's', integration: 6, assignment: 'Benzene aromatic CH' });
      } else if (hasSpecies(/cyclohexene|c6h10/)) {
        peaks.push(
          { ppm: 5.67, multiplicity: 'm', integration: 2, assignment: 'Cyclohexene =CH-' },
          { ppm: 2.00, multiplicity: 'm', integration: 4, assignment: 'Cyclohexene allylic -CH2-' },
          { ppm: 1.62, multiplicity: 'm', integration: 4, assignment: 'Cyclohexene aliphatic -CH2-' }
        );
      } else {
        // Generic sample or water-dominated
        const ph = snapshot.ph ?? 7.0;
        const waterPpm = 4.79 - (7.0 - ph) * 0.04;
        peaks.push({ ppm: Number(waterPpm.toFixed(2)), multiplicity: 's', integration: 2, assignment: `H2O (pH ${ph.toFixed(1)})` });
      }
    } else {
      // 13C NMR
      if (hasSpecies(/ethanol|ch3ch2oh|c2h6o/)) {
        peaks.push(
          { ppm: 18.2, multiplicity: 's', integration: 1, assignment: 'Ethanol -CH3' },
          { ppm: 58.3, multiplicity: 's', integration: 1, assignment: 'Ethanol -CH2OH' }
        );
      } else if (hasSpecies(/acetic_acid|ch3cooh|c2h4o2/)) {
        peaks.push(
          { ppm: 21.1, multiplicity: 's', integration: 1, assignment: 'Acetic acid -CH3' },
          { ppm: 178.4, multiplicity: 's', integration: 1, assignment: 'Acetic acid -COOH carbonyl' }
        );
      } else if (hasSpecies(/acetone|ch3coch3|c3h6o/)) {
        peaks.push(
          { ppm: 30.6, multiplicity: 's', integration: 2, assignment: 'Acetone 2x -CH3' },
          { ppm: 206.7, multiplicity: 's', integration: 1, assignment: 'Acetone C=O ketone' }
        );
      } else if (hasSpecies(/ethyl_acetate|ethylacetate|c4h8o2/)) {
        peaks.push(
          { ppm: 14.2, multiplicity: 's', integration: 1, assignment: 'Ethyl acetate ethyl -CH3' },
          { ppm: 21.0, multiplicity: 's', integration: 1, assignment: 'Ethyl acetate acetyl -CH3' },
          { ppm: 60.5, multiplicity: 's', integration: 1, assignment: 'Ethyl acetate -OCH2-' },
          { ppm: 171.3, multiplicity: 's', integration: 1, assignment: 'Ethyl acetate ester C=O' }
        );
      } else if (hasSpecies(/benzene|c6h6/)) {
        peaks.push({ ppm: 128.4, multiplicity: 's', integration: 6, assignment: 'Benzene 6x Ar-C' });
      }
    }

    return peaks.sort((a, b) => b.ppm - a.ppm); // NMR standard: left to right (high ppm to low ppm)
  }
}
