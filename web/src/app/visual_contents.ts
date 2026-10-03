// Visual-only vessel contents, merged into the engine snapshot before it reaches the 3D scene / panels.
//
// Fallback only: PubChem imports whose formula the engine cannot model at all (`modelable: false`) still have to
// *show up* in the vessel: a powder bed / a coloured liquid, driven only by amount, density and the colour from PubChem.
// Every compound the engine models (reacting, or inert with phases / melting / boiling / dissolution) is drawn from the
// engine snapshot and must NOT be added here. (Stage 8: the engine keeps a dissolving solid as a particle population
// until it has dissolved, so the old "ghost pile" that faked the undissolved powder is gone.)
import * as THREE from 'three';
import { LiquidLayer, N_BINS, SolidVisual, SpeciesRow, VesselSnapshot } from '../types/sim';

export interface VisualItem {
  key: string;
  name: string;
  formula: string;
  kind: 'solid' | 'liquid';
  /** Linear-RGB colour (solid: reflectance; liquid: apparent colour at a few cm of path). */
  rgb: [number, number, number];
  /** Solids: grams currently present. Liquids: unused (see volume_ml). */
  mass_g: number;
  /** Liquids: mL. */
  volume_ml: number;
  density_g_ml: number;
  /** g/mol, 0 if unknown. */
  mw: number;
  /** Liquids: decadic absorbance per cm (engine grid) from the engine's Speculative RGB inversion (`colourToAbsorbance`). */
  absorbance_per_cm?: number[];
}

/** sRGB hex ('#rrggbb') to linear RGB. */
export function hexToLinear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

export class VisualContents {
  private items = new Map<string, VisualItem[]>();
  private lastT = new Map<string, number>();

  public has(vesselId: string): boolean {
    return (this.items.get(vesselId)?.length ?? 0) > 0;
  }

  public clear(vesselId: string) {
    this.items.delete(vesselId);
    this.lastT.delete(vesselId);
  }

  /** Adds (or merges into the same-key item of) a vessel's visual contents. */
  public add(vesselId: string, item: VisualItem) {
    this.put(vesselId, [item]);
  }

  public put(vesselId: string, list: VisualItem[]) {
    if (list.length === 0) return;
    const cur = this.items.get(vesselId) ?? [];
    for (const it of list) {
      const same = cur.find((x) => x.key === it.key && x.kind === it.kind);
      if (same) {
        const m0 = same.mass_g;
        const m1 = it.mass_g;
        if (m0 + m1 > 0) for (let k = 0; k < 3; k++) same.rgb[k] = (same.rgb[k] * m0 + it.rgb[k] * m1) / (m0 + m1);
        same.mass_g += it.mass_g;
        same.volume_ml += it.volume_ml;
      } else cur.push({ ...it, rgb: [...it.rgb] as [number, number, number] });
    }
    this.items.set(vesselId, cur);
  }

  /** Removes a fraction (0..1) of everything and returns it (to be `put` into another vessel). */
  public take(vesselId: string, fraction: number): VisualItem[] {
    const cur = this.items.get(vesselId);
    if (!cur || cur.length === 0) return [];
    const f = Math.min(1, Math.max(0, fraction));
    const moved: VisualItem[] = [];
    for (const it of cur) {
      moved.push({ ...it, rgb: [...it.rgb] as [number, number, number], mass_g: it.mass_g * f, volume_ml: it.volume_ml * f });
      it.mass_g *= 1 - f;
      it.volume_ml *= 1 - f;
    }
    this.items.set(
      vesselId,
      cur.filter((it) => it.mass_g > 1e-5 || it.volume_ml > 1e-4)
    );
    return moved;
  }

  /**
   * Returns `snap` itself when the vessel has no visual-only contents, else a shallow copy that carries them
   * (extra liquid layer / absorbance, solids, species rows, volume and mass).
   */
  public apply(vesselId: string, snap: VesselSnapshot, stirring: boolean): VesselSnapshot {
    const list = this.items.get(vesselId);
    if (!list || list.length === 0) {
      this.lastT.set(vesselId, snap.t_sim_s);
      return snap;
    }
    const dtSim = Math.max(0, Math.min(5, snap.t_sim_s - (this.lastT.get(vesselId) ?? snap.t_sim_s)));
    this.lastT.set(vesselId, snap.t_sim_s);

    const layers: LiquidLayer[] = snap.layers.map((l) => ({ ...l }));
    let total = snap.total_liquid_ml;
    let massAdd = 0;
    const solids: SolidVisual[] = snap.solids.slice();
    const species: SpeciesRow[] = snap.species.slice();

    // ---- liquids: dilute-mix into the aqueous layer (or start one)
    for (const it of list) {
      if (it.kind !== 'liquid' || it.volume_ml <= 1e-4) continue;
      const a = it.absorbance_per_cm ?? new Array(N_BINS).fill(0);
      const aq = layers.find((l) => l.phase === 'aqueous');
      if (aq) {
        const v0 = aq.volume_ml;
        const v1 = it.volume_ml;
        aq.absorbance_per_cm = aq.absorbance_per_cm.map((x, i) => (x * v0 + a[i] * v1) / (v0 + v1));
        aq.scatter_per_cm = aq.scatter_per_cm.map((x) => (x * v0) / (v0 + v1));
        aq.volume_ml = v0 + v1;
      } else {
        layers.unshift({
          phase: 'aqueous',
          volume_ml: it.volume_ml,
          density_g_ml: it.density_g_ml,
          refractive_index: 1.333,
          absorbance_per_cm: a,
          scatter_per_cm: new Array(N_BINS).fill(0),
          scatter_albedo: new Array(N_BINS).fill(1),
          solvent_class: 'water',
        });
      }
      total += it.volume_ml;
      const mass = it.volume_ml * it.density_g_ml;
      massAdd += mass;
      species.push(row(it, mass, it.mw || 60, 'aqueous', total));
    }

    // ---- solids (unmodelable visual fallbacks only)
    const wet = total > 0.5;
    for (const it of list) {
      if (it.kind !== 'solid') continue;
      const m = it.mass_g;
      massAdd += m;
      species.push(row(it, m, it.mw || 100, 'solid', total));
      if (m <= 1e-5) continue;
      const density = Math.min(25, Math.max(0.3, it.density_g_ml || 1.5));
      solids.push({
        species: it.key,
        name: it.name,
        mass_g: m,
        settled_volume_ml: (m / density) * 1.6,
        suspended_fraction: wet ? 0.1 : 0,
        particle_diameter_um: 30,
        rgb: it.rgb,
        kind: 'powder',
        remaining_fraction: 1,
      });
    }
    this.items.set(
      vesselId,
      list.filter((it) => (it.kind === 'liquid' ? it.volume_ml > 1e-4 : it.mass_g > 1e-5))
    );

    return {
      ...snap,
      layers,
      total_liquid_ml: total,
      solids,
      species,
      contents_mass_g: snap.contents_mass_g + massAdd,
    };
  }
}

function row(it: VisualItem, massG: number, mw: number, phase: SpeciesRow['phase'], totalMl: number): SpeciesRow {
  const mol = massG / Math.max(1, mw);
  return {
    id: it.key,
    name: it.name,
    formula: it.formula || it.name,
    charge: 0,
    phase,
    amount_mol: mol,
    conc_m: phase === 'solid' || totalMl <= 0.01 ? null : mol / (totalMl / 1000),
    activity: null,
    tier: 'speculative',
  };
}
