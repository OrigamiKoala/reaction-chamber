/**
 * Electrode materials of the potentiostat's selectors: the inert electrodes and every metal the engine's species store has
 * an aqueous cation or a solid record for, minus the violently water-reactive ones (`vessel_electro::electrode_materials`,
 * `engine/data/electrode_materials.json`).
 * Order: the inert electrodes, then the metals by decreasing standard potential (the electrochemical series). engine/tests/open_items_b.rs (`i4_console_materials_are_the_engines_list`)
 * fails when this list and the engine's differ.
 */
export const ELECTRODE_MATERIALS = ['Pt', 'C', 'Ag', 'Cu', 'Pb', 'Co', 'Fe', 'Zn', 'Mn', 'Al', 'Mg'] as const;
export type ElectrodeMaterial = (typeof ELECTRODE_MATERIALS)[number];
