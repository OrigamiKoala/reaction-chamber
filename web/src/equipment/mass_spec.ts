import * as THREE from 'three';
import { VesselSnapshot } from '../types/sim';
import { roundedBox } from './lcd';

export type MsIonization = 'EI' | 'ESI_POS' | 'ESI_NEG';

export interface MsPeak {
  mz: number;
  intensity: number; // 0..100% relative abundance
  assignment?: string;
  isMolecularIon?: boolean;
}

export interface MassSpectrumResult {
  sampleName: string;
  ionization: MsIonization;
  basePeakMz: number;
  molecularWeight: number;
  peaks: MsPeak[];
}

export class MassSpectrometer {
  public group = new THREE.Group();
  private ionSourceGlowMat: THREE.MeshBasicMaterial;
  private isAcquiring = false;
  private currentSampleName: string | null = null;
  private lastSpectrum: MassSpectrumResult | null = null;

  constructor() {
    this.group.name = 'instrument_mass_spectrometer';

    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.4, metalness: 0.2 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xc8ced4, metalness: 0.85, roughness: 0.2 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.5, metalness: 0.1 });

    // Main MS Console: 30cm W x 20cm H x 28cm D
    const mainBody = new THREE.Mesh(roundedBox(30, 18, 28, 1.2), chassisMat);
    mainBody.position.y = 9.0;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    this.group.add(mainBody);

    // Front manifold access plate
    const frontPlate = new THREE.Mesh(roundedBox(27, 15, 0.8, 0.4), darkMat);
    frontPlate.position.set(0, 8.5, 14.0);
    this.group.add(frontPlate);

    // Stainless steel vacuum chamber housing (quadrupole / ion optics)
    const vacChamber = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 16.0, 32), silverMat);
    vacChamber.rotation.z = Math.PI / 2;
    vacChamber.position.set(-3.0, 10.0, 5.0);
    vacChamber.castShadow = true;
    this.group.add(vacChamber);

    // Flange bolts ring
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 1.2, 32), silverMat);
    flange.rotation.z = Math.PI / 2;
    flange.position.set(5.2, 10.0, 5.0);
    this.group.add(flange);

    // Circular ion source inspection viewport
    const viewPortBezel = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.6, 24), silverMat);
    viewPortBezel.rotation.x = Math.PI / 2;
    viewPortBezel.position.set(-6.5, 9.5, 14.5);
    this.group.add(viewPortBezel);

    this.ionSourceGlowMat = new THREE.MeshBasicMaterial({ color: 0x221144 });
    const viewGlass = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), this.ionSourceGlowMat);
    viewGlass.position.set(-6.5, 9.5, 14.85);
    this.group.add(viewGlass);

    // Autosampler Carousel on top-right
    const carouselBase = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.2, 3.0, 32), silverMat);
    carouselBase.position.set(8.5, 19.5, 2.0);
    carouselBase.castShadow = true;
    this.group.add(carouselBase);

    // Tiny autosampler sample vials in carousel
    const vialMat = new THREE.MeshPhysicalMaterial({ color: 0x8899aa, transparent: true, opacity: 0.85, roughness: 0.2 });
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.4, 12), vialMat);
      vial.position.set(8.5 + Math.cos(angle) * 3.6, 21.5, 2.0 + Math.sin(angle) * 3.6);
      this.group.add(vial);
    }

    // Robotic injection tower
    const tower = new THREE.Mesh(roundedBox(2.2, 10.0, 2.2, 0.3), silverMat);
    tower.position.set(8.5, 25.0, -3.0);
    tower.castShadow = true;
    this.group.add(tower);

    // Needle arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5.0), silverMat);
    arm.position.set(8.5, 29.0, -0.5);
    this.group.add(arm);

    // Vacuum Gauge display
    const gauge = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 2.5), new THREE.MeshBasicMaterial({ color: 0x001100 }));
    gauge.position.set(5.5, 12.5, 14.5);
    this.group.add(gauge);
  }

  public setSample(vesselName: string | null) {
    this.currentSampleName = vesselName;
  }

  public get sampleName(): string | null {
    return this.currentSampleName;
  }

  public setAcquiring(acquiring: boolean) {
    this.isAcquiring = acquiring;
    this.ionSourceGlowMat.color.setHex(acquiring ? 0x9944ff : 0x221144);
  }

  public acquire(snapshot: VesselSnapshot | null, vesselName: string, ionization: MsIonization = 'EI'): MassSpectrumResult {
    this.setAcquiring(true);
    const peaks = this.predictMassPeaks(snapshot, ionization);

    // Find base peak for normalization
    let maxIntensity = 0;
    let basePeakMz = 43;
    for (const p of peaks) {
      if (p.intensity > maxIntensity) {
        maxIntensity = p.intensity;
        basePeakMz = p.mz;
      }
    }

    // Normalize relative abundance to 100%
    const scale = maxIntensity > 0 ? 100 / maxIntensity : 1;
    for (const p of peaks) {
      p.intensity = Math.round(p.intensity * scale * 10) / 10;
    }

    let mw = 46;
    const molIon = peaks.find((p) => p.isMolecularIon);
    if (molIon) mw = molIon.mz;

    this.lastSpectrum = {
      sampleName: vesselName,
      ionization,
      basePeakMz,
      molecularWeight: mw,
      peaks: peaks.sort((a, b) => a.mz - b.mz),
    };

    setTimeout(() => this.setAcquiring(false), 500);
    return this.lastSpectrum;
  }

  public getLastSpectrum(): MassSpectrumResult | null {
    return this.lastSpectrum;
  }

  private predictMassPeaks(snapshot: VesselSnapshot | null, ionization: MsIonization): MsPeak[] {
    const raw: MsPeak[] = [];

    // Background air/water peaks common in real MS spectra
    raw.push(
      { mz: 18, intensity: 12, assignment: 'H2O+' },
      { mz: 28, intensity: 25, assignment: 'N2+ (ambient air)' },
      { mz: 32, intensity: 8, assignment: 'O2+ (ambient air)' }
    );

    if (!snapshot) return raw;

    const speciesNames = snapshot.species.map((s) => s.id.toLowerCase());
    const has = (pattern: RegExp) => speciesNames.some((s) => pattern.test(s));

    if (has(/ethanol|ch3ch2oh|c2h6o/)) {
      if (ionization === 'EI') {
        raw.push(
          { mz: 46, intensity: 22, assignment: '[M]+ (C2H6O+)', isMolecularIon: true },
          { mz: 45, intensity: 38, assignment: '[M - H]+' },
          { mz: 31, intensity: 100, assignment: 'CH2=OH+ (base peak alpha-cleavage)' },
          { mz: 29, intensity: 24, assignment: 'C2H5+' },
          { mz: 27, intensity: 14, assignment: 'C2H3+' },
          { mz: 15, intensity: 8, assignment: 'CH3+' }
        );
      } else {
        raw.push({ mz: 47, intensity: 100, assignment: '[M + H]+', isMolecularIon: true });
      }
    } else if (has(/acetone|ch3coch3|c3h6o/)) {
      if (ionization === 'EI') {
        raw.push(
          { mz: 58, intensity: 32, assignment: '[M]+ (C3H6O+)', isMolecularIon: true },
          { mz: 59, intensity: 1.1, assignment: '[M + 1]+ (13C isotope)' },
          { mz: 43, intensity: 100, assignment: 'CH3-C≡O+ (acylium base peak)' },
          { mz: 15, intensity: 18, assignment: 'CH3+' }
        );
      } else {
        raw.push({ mz: 59, intensity: 100, assignment: '[M + H]+', isMolecularIon: true });
      }
    } else if (has(/acetic_acid|ch3cooh|c2h4o2/)) {
      if (ionization === 'EI') {
        raw.push(
          { mz: 60, intensity: 85, assignment: '[M]+ (C2H4O2+)', isMolecularIon: true },
          { mz: 45, intensity: 90, assignment: 'COOH+' },
          { mz: 43, intensity: 100, assignment: 'CH3-C≡O+ (base peak)' },
          { mz: 15, intensity: 12, assignment: 'CH3+' }
        );
      } else {
        raw.push({ mz: 61, intensity: 100, assignment: '[M + H]+', isMolecularIon: true });
      }
    } else if (has(/ethyl_acetate|ethylacetate|c4h8o2/)) {
      if (ionization === 'EI') {
        raw.push(
          { mz: 88, intensity: 8, assignment: '[M]+ (C4H8O2+)', isMolecularIon: true },
          { mz: 73, intensity: 14, assignment: '[M - CH3]+' },
          { mz: 70, intensity: 16, assignment: '[M - H2O]+' },
          { mz: 61, intensity: 22, assignment: 'CH3C(OH)2+' },
          { mz: 43, intensity: 100, assignment: 'CH3-C≡O+ (acetyl base peak)' },
          { mz: 29, intensity: 18, assignment: 'CH3CH2+' }
        );
      } else {
        raw.push({ mz: 89, intensity: 100, assignment: '[M + H]+', isMolecularIon: true });
      }
    } else if (has(/benzene|c6h6/)) {
      raw.push(
        { mz: 78, intensity: 100, assignment: '[M]+ (C6H6+ aromatic ring base)', isMolecularIon: true },
        { mz: 79, intensity: 6.6, assignment: '[M + 1]+ (6x 13C isotope)' },
        { mz: 77, intensity: 18, assignment: '[M - H]+ (phenyl cation)' },
        { mz: 52, intensity: 20, assignment: 'C4H4+' },
        { mz: 51, intensity: 18, assignment: 'C4H3+' },
        { mz: 50, intensity: 16, assignment: 'C4H2+' }
      );
    } else if (has(/cu/)) {
      // Copper isotopic signature 63Cu (69%) / 65Cu (31%)
      raw.push(
        { mz: 63, intensity: 100, assignment: '63Cu+' },
        { mz: 65, intensity: 45, assignment: '65Cu+' }
      );
      if (has(/cl/)) {
        // CuCl with 35Cl / 37Cl
        raw.push(
          { mz: 98, intensity: 75, assignment: '63Cu35Cl+' },
          { mz: 100, intensity: 58, assignment: '65Cu35Cl+ / 63Cu37Cl+' },
          { mz: 102, intensity: 12, assignment: '65Cu37Cl+' }
        );
      }
    } else {
      // General aqueous sample
      raw.push(
        { mz: 18, intensity: 100, assignment: '[H2O]+', isMolecularIon: true },
        { mz: 17, intensity: 24, assignment: '[OH]+' },
        { mz: 16, intensity: 4, assignment: '[O]+' }
      );
    }

    return raw;
  }
}
