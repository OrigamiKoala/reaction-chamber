// Molecular viewer: which phases of a vessel can be shown and who is in each (pure; tests/micro_sampler.mjs).
import type { VesselSnapshot, SpeciesRow } from '../types/sim';
import type { SampleSpecies } from './micro_sampler';

export type FluidKey = 'aqueous' | 'organic' | 'gas';
/** A fluid phase, or a solid surface (the box of the fluid over a slab): `surface:<solid species>` or `surface:anode` / `surface:cathode`. */
export type PhaseKey = FluidKey | `surface:${string}`;

export interface PhaseSpecies {
  id: string;
  name: string;
  formula: string;
  charge: number;
  /** True molar concentration (liquids) or null. */
  conc: number | null;
  /** Mole fraction in the gas phase, else null. */
  fraction: number | null;
  mol: number;
  /** Drawn as faint scenery (the solvent water of an aqueous phase), not counted as a solute. */
  scenery: boolean;
}

/** The solid surface a box shows (the slab under the fluid). */
export interface SurfaceRef {
  /** The solid whose lattice is drawn (`BaSO4(s)`, the electrode material `Cu(s)`). */
  slab: string;
  electrode: 'anode' | 'cathode' | null;
}

export interface PhaseInfo {
  key: PhaseKey;
  label: string;
  kind: 'liquid' | 'gas';
  species: PhaseSpecies[];
  /** The fluid whose molecules fill the box (a fluid phase is its own fluid). */
  fluid: FluidKey;
  /** Set for a solid surface: the engine's reactions of the fluid are asked for, and the ones at this surface are played. */
  surface?: SurfaceRef;
}

export interface PhaseSet {
  phases: PhaseInfo[];
  /** Solid phases present (also offered as surfaces of the box when their lattice is known). */
  solids: SpeciesRow[];
}

/** What `phasesOf` needs to offer solid surfaces: the solids the engine can draw a lattice for. */
export interface PhaseOptions {
  lattices?: ReadonlySet<string>;
}

const SOLVENT_WATER = 'H2O';

export function phasesOf(snap: VesselSnapshot, opts: PhaseOptions = {}): PhaseSet {
  const phases: PhaseInfo[] = [];
  const rows = snap.species ?? [];

  for (const [key, label] of [['aqueous', 'Aqueous layer'], ['organic', 'Organic layer']] as const) {
    const sp: PhaseSpecies[] = rows
      .filter((r) => r.phase === key && r.amount_mol > 0)
      .map((r) => ({
        id: r.id,
        name: r.name,
        formula: r.formula || r.id,
        charge: r.charge,
        conc: r.conc_m,
        fraction: null,
        mol: r.amount_mol,
        scenery: key === 'aqueous' && r.id === SOLVENT_WATER,
      }));
    if (sp.length === 0) continue;
    let lab: string = label;
    if (key === 'organic') {
      const org = (snap.layers ?? []).find((l) => l.phase === 'organic' && l.name);
      if (org?.name) lab = `Organic layer (${org.name})`;
    }
    phases.push({ key, label: lab, kind: 'liquid', species: sp, fluid: key });
  }

  // gas: the vessel's gas phase (atmosphere or sealed inventory) when the engine sends one, else the gas rows
  const gp = snap.gas_phase?.species ?? [];
  let gas: PhaseSpecies[] = gp
    .filter((g) => g.mole_fraction > 0)
    .map((g) => ({ id: g.species, name: g.species.replace(/\((g|l|s|aq)\)$/, ''), formula: g.species, charge: 0, conc: null, fraction: g.mole_fraction, mol: g.mol, scenery: false }));
  if (gas.length === 0) {
    gas = rows
      .filter((r) => r.phase === 'gas' && r.amount_mol > 0)
      .map((r) => ({ id: r.id, name: r.name, formula: r.formula || r.id, charge: 0, conc: null, fraction: null, mol: r.amount_mol, scenery: false }));
  }
  if (gas.length > 0) phases.push({ key: 'gas', label: snap.gas_phase?.kind === 'sealed' ? 'Gas (sealed headspace)' : 'Gas (air above)', kind: 'gas', species: gas, fluid: 'gas' });

  // solid surfaces: the fluid over a slab. Solids with a known lattice, and the electrodes of a powered cell
  const solids = rows.filter((r) => r.phase === 'solid' && r.amount_mol > 0);
  const fluid = phases.find((p) => p.fluid === 'aqueous') ?? phases.find((p) => p.fluid === 'organic') ?? phases.find((p) => p.fluid === 'gas');
  if (fluid) {
    const have = opts.lattices;
    if (snap.electrolysis && (snap.electrodes?.length ?? 0) >= 2) {
      (['anode', 'cathode'] as const).forEach((which, i) => {
        const material = snap.electrodes![i]?.material;
        if (!material) return;
        const slab = `${material.replace(/\(s\)$/, '')}(s)`;
        if (have && !have.has(slab)) return;
        phases.push({ key: `surface:${which}`, label: `Electrode surface: ${which} (${material})`, kind: fluid.kind, species: fluid.species, fluid: fluid.fluid, surface: { slab, electrode: which } });
      });
    }
    for (const sol of solids) {
      if (!have || !have.has(sol.id)) continue;
      phases.push({ key: `surface:${sol.id}`, label: `Solid surface: ${sol.formula || sol.id}`, kind: fluid.kind, species: fluid.species, fluid: fluid.fluid, surface: { slab: sol.id, electrode: null } });
    }
  }

  return { phases, solids };
}

/** The species of a phase as sampler input. Scenery water is left out (it is drawn separately). */
export function sampleInput(p: PhaseInfo, forced: ReadonlySet<string> = new Set()): SampleSpecies[] {
  const out: SampleSpecies[] = [];
  for (const s of p.species) {
    if (s.scenery) continue;
    const weight = s.conc ?? s.fraction ?? s.mol;
    // an open vessel's atmosphere holds no counted moles: its mole fraction stands in for the amount above the floor
    const mol = s.mol > 0 ? s.mol : s.fraction ?? 0;
    out.push({ id: s.id, weight: weight ?? 0, mol, forced: forced.has(s.id) });
  }
  return out;
}

/** Phase to show first: the aqueous layer, else the organic one, else the gas. */
export function defaultPhase(set: PhaseSet): PhaseKey | null {
  for (const k of ['aqueous', 'organic', 'gas'] as const) if (set.phases.some((p) => p.key === k)) return k;
  return null;
}
