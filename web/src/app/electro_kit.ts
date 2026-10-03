import type { Lab } from './lab';
import { registerSetup } from './setups';

export async function spawnElectrolysisSetup(lab: Lab): Promise<void> {
  const beaker = await lab.spawn('beaker-250');
  // Dose 120 mL of water + dilute sulfuric acid
  await lab.dose(beaker.id, { reagent_id: 'water', volume_ml: 120 });
  await lab.dose(beaker.id, { reagent_id: 'sulfuric_acid_1m', volume_ml: 10 });

  // Attach Pt electrodes, 3.0 V electrolysis, ON
  await lab.setElectrolysis(beaker.id, {
    anode: { material: 'Pt', area_cm2: 5.0 },
    cathode: { material: 'Pt', area_cm2: 5.0 },
    mode: 'voltage',
    value: 3.0,
    spacing_cm: 2.0,
    on: true,
  });

  lab.select(beaker.id);
  lab.setElectrochemMaterials('Pt', 'Pt');
}

export async function spawnCopperPlatingSetup(lab: Lab): Promise<void> {
  const beaker = await lab.spawn('beaker-250');
  await lab.dose(beaker.id, { reagent_id: 'water', volume_ml: 100 });
  // Add copper sulfate
  await lab.dose(beaker.id, { reagent_id: 'copper_ii_sulfate', mass_g: 5.0 });

  // Anode Cu, Cathode Pt, 1.8 V
  await lab.setElectrolysis(beaker.id, {
    anode: { material: 'Cu', area_cm2: 6.0 },
    cathode: { material: 'Pt', area_cm2: 6.0 },
    mode: 'voltage',
    value: 1.8,
    spacing_cm: 2.0,
    on: true,
  });

  lab.select(beaker.id);
  lab.setElectrochemMaterials('Cu', 'Pt');
}

export async function spawnDaniellCellSetup(lab: Lab): Promise<void> {
  // Beaker 1: Zn half-cell (250 mL beaker with ZnSO4)
  const beakerA = await lab.spawn('beaker-250');
  await lab.dose(beakerA.id, { reagent_id: 'water', volume_ml: 75 });
  await lab.dose(beakerA.id, { reagent_id: 'zinc_sulfate', mass_g: 4.0 });

  // Beaker 2: Cu half-cell (250 mL beaker with CuSO4)
  const beakerB = await lab.spawn('beaker-250');
  await lab.dose(beakerB.id, { reagent_id: 'water', volume_ml: 75 });
  await lab.dose(beakerB.id, { reagent_id: 'copper_ii_sulfate', mass_g: 4.0 });

  // Place Beaker B right beside Beaker A
  lab.placeBeside(beakerB.id, beakerA.id, 12);

  // Link as galvanic cell with salt bridge
  await lab.setGalvanicCell(beakerA.id, beakerB.id, 'Zn', 'Cu');
  lab.select(beakerA.id);
  lab.setElectrochemMaterials('Zn', 'Cu');
}

export function registerElectroKits(): void {
  registerSetup({
    id: 'electrolysis-cell',
    label: 'Electrolysis cell',
    description: '250 mL beaker + Pt electrodes + DC power supply (3.0 V) — splits water into H2 and O2 bubbles',
    keywords: 'electrolysis electrochem water splitting hydrogen oxygen electrodes platinum power supply cell current voltage',
    icon: 'spark',
    build: spawnElectrolysisSetup,
  });

  registerSetup({
    id: 'copper-electroplating',
    label: 'Copper electroplating',
    description: '250 mL beaker with CuSO4 + Cu anode + Pt cathode — deposits salmon-colored copper metal',
    keywords: 'copper plating electroplating electrochem cathode anode reduction deposition electrolysis',
    icon: 'spark',
    build: spawnCopperPlatingSetup,
  });

  registerSetup({
    id: 'daniell-galvanic-cell',
    label: 'Daniell cell (Galvanic)',
    description: 'Two beakers (ZnSO4 + CuSO4) + Zn & Cu electrodes + glass salt bridge — generates ~1.10 V EMF',
    keywords: 'daniell galvanic cell battery salt bridge zinc copper emf potential voltage spontaneous redox',
    icon: 'spark',
    build: spawnDaniellCellSetup,
  });
}
