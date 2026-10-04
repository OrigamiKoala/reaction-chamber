/**
 * Electrode materials of the potentiostat's selectors: the inert electrodes and every metal the engine's species store has
 * an aqueous cation or a solid record for, minus the violently water-reactive ones (`vessel_electro::electrode_materials`).
 * The first six keep the order of the original console. engine/tests/open_items_b.rs (`i4_console_materials_are_the_engines_list`)
 * fails when this list and the engine's differ.
 */
export const ELECTRODE_MATERIALS = ['Pt', 'C', 'Cu', 'Zn', 'Ag', 'Fe', 'Al', 'Co', 'Mg', 'Mn', 'Pb'] as const;
export type ElectrodeMaterial = (typeof ELECTRODE_MATERIALS)[number];
