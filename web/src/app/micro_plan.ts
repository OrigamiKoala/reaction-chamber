// Molecular viewer: what a reaction row needs to be played in a box, and how it reads (pure, no DOM, no three.js; tests/micro_plan.mjs).
//
// The engine describes a reaction at a surface *forward* (a solid dissolves, a metal leaves, an anode oxidises); the reverse event
// (precipitation, plating) is the same description read the other way. Whether a row can be drawn depends on where the viewer
// is: a precipitation needs the slab of that solid under the box, a combustion needs the gas, a generic swap needs only a few
// species. These functions decide that and the words used for it, so the legend, the scheduler and the tests agree.
import type { MicroMorphData, MicroReactionData, MicroSurfaceData, MicroSurfaceJoin, MicroSurfaceLeave } from '../types/sim';
import type { FluidKey, SurfaceRef } from './micro_phases';

/** The box a row would be played in: its fluid and, for a solid surface, the surface. */
export interface PlayContext {
  fluid: FluidKey;
  surface?: SurfaceRef;
}

export interface Playability {
  ok: boolean;
  /** For the legend when it is not: why. */
  why: string;
}

/** A generic swap (a row without an atom map) is drawn for at most this many molecules per side. */
export const MAX_SWAP_MOLECULES = 6;

const isSolid = (s: string) => s.endsWith('(s)');

/** The surface a row works on, as the key of the surface phase that shows it (`surface:anode`, `surface:BaSO4(s)`), else null. */
export function surfaceKeyOf(r: MicroReactionData): string | null {
  const sd = r.surface;
  if (!sd) return null;
  return `surface:${sd.electrode ?? sd.slab}`;
}

/** Can the row be played in this box, and if not, why. */
export function playability(r: MicroReactionData, ctx: PlayContext): Playability {
  if (r.surface) {
    const sd = r.surface;
    if (sd.slab_kind === 'none') return { ok: false, why: `no crystal structure for ${sd.slab} (a molecular solid)` };
    const here = ctx.surface ? (sd.electrode ? ctx.surface.electrode === sd.electrode : !ctx.surface.electrode && ctx.surface.slab === sd.slab) : false;
    if (!here) return { ok: false, why: sd.electrode ? `shown in the ${sd.electrode} surface view` : `shown in the ${sd.slab} surface view` };
    if (r.kind !== 'dissolution' && sd.morph && (sd.morph.atom_map.length === 0 || sd.morph.reactants.length === 0)) return { ok: false, why: 'no atom map for the species at the surface' };
    return { ok: true, why: '' };
  }
  if (r.kind === 'other') {
    const solids = r.reactants.some(isSolid) || r.products.some(isSolid);
    if (solids) return { ok: false, why: 'a solid takes part (needs its surface)' };
    if (r.reactants.length === 0 || r.products.length === 0) return { ok: false, why: 'species not in whole numbers' };
    if (r.reactants.length > MAX_SWAP_MOLECULES || r.products.length > MAX_SWAP_MOLECULES) return { ok: false, why: `more than ${MAX_SWAP_MOLECULES} molecules on a side` };
    return { ok: true, why: '' };
  }
  if (r.atom_map.length === 0) {
    return { ok: false, why: r.kind === 'combustion' ? 'needs more than 8 molecules to balance' : 'no atom map' };
  }
  if (r.reactants.some(isSolid) || r.products.some(isSolid)) return { ok: false, why: 'a solid takes part (needs its surface)' };
  return { ok: true, why: '' };
}

/** A surface description read in the direction of the event: what leaves the lattice, what joins it. */
export interface OrientedSurface {
  leaves: MicroSurfaceLeave[];
  joins: MicroSurfaceJoin[];
  residue: string[];
  morph: MicroMorphData | null;
  /** The morph part runs backwards. */
  morphReverse: boolean;
}

/** Reads the description forward or backwards. A reaction with a residue (a decomposition) has no reverse. */
export function orientSurface(sd: MicroSurfaceData, direction: 'forward' | 'reverse'): OrientedSurface | null {
  if (direction === 'forward') return { leaves: sd.leaves, joins: sd.joins, residue: sd.residue, morph: sd.morph ?? null, morphReverse: false };
  if (sd.residue.length > 0) return null;
  return {
    leaves: sd.joins.map((j) => ({ occupant: j.occupant, becomes: j.takes })),
    joins: sd.leaves.map((l) => ({ takes: l.becomes, occupant: l.occupant })),
    residue: [],
    morph: sd.morph ?? null,
    morphReverse: true,
  };
}

/** Words for an event of a row: the title of the caption and a short tag for the floating label. */
export function eventLabel(r: MicroReactionData, direction: 'forward' | 'reverse'): { title: string; tag: string } {
  const fwd = direction === 'forward';
  const sd = r.surface;
  switch (r.kind) {
    case 'dissolution':
      return fwd ? { title: 'dissolution', tag: 'dissolves' } : { title: 'precipitation', tag: 'precipitates' };
    case 'phase_transfer': {
      const origin = r.id.split('_')[1] ?? '';
      if (origin === 'boiling') return { title: 'boiling', tag: 'boils' };
      if (origin === 'henry') return fwd ? { title: 'dissolved gas leaves', tag: 'gas out' } : { title: 'gas dissolves', tag: 'gas in' };
      return fwd ? { title: 'evaporation', tag: 'evaporates' } : { title: 'condensation', tag: 'condenses' };
    }
    case 'electrode': {
      const which = sd?.electrode ?? 'electrode';
      return { title: `${which} half-reaction`, tag: `${r.electrons} e⁻ at the ${which}` };
    }
    case 'decomposition':
      return { title: 'thermal decomposition', tag: 'decomposes' };
    case 'combustion':
      return { title: 'combustion (one step standing for a chain mechanism)', tag: 'burns' };
    case 'electron_transfer':
      if (sd) {
        const leaving = fwd ? sd.leaves : sd.joins;
        return { title: leaving.length > 0 && fwd ? 'metal dissolves, ions plate out' : 'electron transfer at a surface', tag: `${r.electrons} e⁻` };
      }
      return { title: 'electron transfer', tag: `${r.electrons} e⁻` };
    case 'other':
      return { title: 'reaction (atoms not tracked)', tag: 'swap' };
    case 'template':
      return { title: (r.family ?? 'reaction').replace(/_/g, ' '), tag: (r.family ?? 'reaction').replace(/_/g, ' ') };
    case 'proton_transfer':
      return { title: 'proton transfer', tag: 'H⁺ moves' };
    case 'complexation':
      return { title: 'complexation', tag: fwd ? 'binds' : 'releases' };
    case 'ion_pair':
      return { title: 'ion pair', tag: fwd ? 'pairs' : 'separates' };
    default:
      return { title: r.kind, tag: r.kind };
  }
}

/**
 * Where a lattice position is wanted for each leaving or joining entry: an entry that names the slab's own formula unit (the
 * solid species of a decomposition) takes one site per ion of the unit; an ion or atom of the lattice takes a site of its own
 * kind; anything else (a copper atom plating on platinum) takes a position of the lattice if it has just one kind, else none.
 */
export function positionsFor(entry: string, slabSpecies: string, unit: ReadonlyArray<{ species: string; count: number }>): string[] | null {
  const kinds = unit.map((u) => u.species);
  if (entry === slabSpecies && !kinds.includes(entry)) return unit.flatMap((u) => Array.from({ length: u.count }, () => u.species));
  if (kinds.includes(entry)) return [entry];
  if (unit.length === 1) return [unit[0].species];
  return null;
}
