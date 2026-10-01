// Lab controller: vessels on the bench, their per-vessel controls, and every user action that
// touches both the 3D scene (BenchScene contract) and the WASM simulation (SimController).
import type { BenchScene } from '../bench/scene';
import type { SimController } from '../sim/sim_controller';
import { VesselState } from '../types';
import { VesselConfig, VesselSnapshot } from '../types/sim';
import { ReagentItem, amountMode, streamColour } from './reagent_library';
import { VisualContents, VisualItem, hexToLinear } from './visual_contents';
import { knownReagentColor } from './reagent_colors';
import { looksLikeMetal } from '../equipment/bottle';

export type VesselType = VesselState['type'];

export interface GlasswareSpec {
  type: VesselType;
  label: string;
  capacityMl: number;
  icon: 'beaker' | 'erlenmeyer' | 'cylinder' | 'testTube';
  glassMassG: number;
  innerRadiusCm: number;
}

export const GLASSWARE: GlasswareSpec[] = [
  { type: 'beaker-50', label: 'Beaker 50 mL', capacityMl: 50, icon: 'beaker', glassMassG: 35, innerRadiusCm: 2.0 },
  { type: 'beaker-250', label: 'Beaker 250 mL', capacityMl: 250, icon: 'beaker', glassMassG: 110, innerRadiusCm: 3.5 },
  { type: 'beaker-1000', label: 'Beaker 1 L', capacityMl: 1000, icon: 'beaker', glassMassG: 320, innerRadiusCm: 5.5 },
  { type: 'erlenmeyer-250', label: 'Flask 250 mL', capacityMl: 250, icon: 'erlenmeyer', glassMassG: 130, innerRadiusCm: 4.0 },
  { type: 'cylinder-100', label: 'Cylinder 100 mL', capacityMl: 100, icon: 'cylinder', glassMassG: 140, innerRadiusCm: 1.5 },
  { type: 'test-tube', label: 'Test tube', capacityMl: 30, icon: 'testTube', glassMassG: 20, innerRadiusCm: 0.9 },
];

export function glasswareSpec(type: VesselType): GlasswareSpec {
  return GLASSWARE.find((g) => g.type === type) ?? GLASSWARE[1];
}

export interface VesselControlState {
  heaterW: number;
  stirring: boolean;
  stirRpm: number;
  iceBath: boolean;
}

const DROP_ML = 0.05;
const STIR_RPM = 400;
const ANIM_SAFETY_MS = 20000;

export class Lab {
  private vessels = new Map<string, VesselState>();
  private controls = new Map<string, VesselControlState>();
  private latest = new Map<string, VesselSnapshot>();
  private flammableAdded = new Set<string>();
  /** Powders / liquids that exist only visually (PubChem imports) + dissolving piles of engine-dissolved solids. */
  private visual = new VisualContents();
  private nextId = 1;
  private typeCounters = new Map<VesselType, number>();
  private hotPlateId: string | null = null;
  public selectedId: string | null = null;

  public onVesselsChanged?: () => void;
  public onSelectionChanged?: (id: string | null) => void;
  /** Controls of a vessel changed from outside the vessel panel (e.g. displaced from the hot plate). */
  public onControlsChanged?: (id: string) => void;

  constructor(private bench: BenchScene, private sim: SimController) {}

  // ------------------------------------------------------------------ registry
  public list(): VesselState[] {
    return Array.from(this.vessels.values());
  }

  public get(id: string): VesselState | undefined {
    return this.vessels.get(id);
  }

  public has(id: string): boolean {
    return this.vessels.has(id);
  }

  public ctl(id: string): VesselControlState {
    let c = this.controls.get(id);
    if (!c) {
      c = { heaterW: 0, stirring: false, stirRpm: 0, iceBath: false };
      this.controls.set(id, c);
    }
    return c;
  }

  public snapshot(id: string): VesselSnapshot | undefined {
    return this.latest.get(id);
  }

  public isOnHotPlate(id: string): boolean {
    const sceneId = this.bench.getHotPlateVesselId();
    return (sceneId ?? this.hotPlateId) === id;
  }

  public freeCapacityMl(id: string): number {
    const v = this.vessels.get(id);
    if (!v) return 0;
    const snap = this.latest.get(id);
    const vol = snap ? snap.total_liquid_ml : v.currentVolumeMl;
    return Math.max(0, v.capacityMl - vol);
  }

  public volumeMl(id: string): number {
    const snap = this.latest.get(id);
    return snap ? snap.total_liquid_ml : this.vessels.get(id)?.currentVolumeMl ?? 0;
  }

  /** Flammable contents: an organic liquid phase, or a GHS02 reagent was added and liquid remains. */
  public hasFlammable(id: string): boolean {
    const snap = this.latest.get(id);
    if (!snap || snap.total_liquid_ml <= 0.01) return false;
    if (snap.layers.some((l) => l.phase === 'organic')) return true;
    if (snap.species.some((s) => s.phase === 'organic' && s.amount_mol > 1e-6)) return true;
    return this.flammableAdded.has(id);
  }

  // ------------------------------------------------------------------ snapshots
  /**
   * Keeps the vessel state in sync with the engine and returns the snapshot to display: the engine snapshot with
   * any visual-only contents (imports, dissolving piles) merged in. Returns null for unknown (removed) vessels.
   */
  public ingest(id: string, engineSnap: VesselSnapshot): VesselSnapshot | null {
    const v = this.vessels.get(id);
    if (!v) return null;
    const snap = this.visual.apply(id, engineSnap, this.ctl(id).stirring);
    this.latest.set(id, snap);
    v.currentVolumeMl = snap.total_liquid_ml;
    v.temperatureK = snap.temperature_k;
    v.ph = snap.ph !== null ? snap.ph : undefined;
    const sealedChanged = v.isSealed !== snap.sealed;
    v.isSealed = snap.sealed;
    v.contents = snap.species.map((s) => ({
      name: s.name,
      formula: s.formula,
      amountMol: s.amount_mol,
      concentrationM: s.conc_m !== null ? s.conc_m : 0,
    }));
    // Stopper popped (or sealed from elsewhere): re-attach the gauge for the selected vessel.
    if (sealedChanged && id === this.selectedId) this.bench.setSelectedVessel(id);
    return snap;
  }

  // ------------------------------------------------------------------ vessels
  public async spawn(type: VesselType): Promise<VesselState> {
    const spec = glasswareSpec(type);
    const n = (this.typeCounters.get(type) ?? 0) + 1;
    this.typeCounters.set(type, n);
    const state: VesselState = {
      id: `vessel_${this.nextId++}`,
      name: n > 1 ? `${spec.label} (${n})` : spec.label,
      type,
      capacityMl: spec.capacityMl,
      currentVolumeMl: 0,
      liquidColor: '#e8f4fa',
      liquidOpacity: 0.6,
      temperatureK: 298.15,
      isSealed: false,
      stirring: false,
      contents: [],
    };
    const bundle = this.bench.addVessel(state);
    const canonical = bundle?.vesselState ?? state;
    this.vessels.set(state.id, canonical);
    this.ctl(state.id);
    const config: VesselConfig = {
      type,
      capacity_ml: spec.capacityMl,
      glass_mass_g: spec.glassMassG,
      inner_radius_cm: spec.innerRadiusCm,
      temperature_k: 298.15,
      room_k: 295.15,
      sealed: false,
      stopper_pop_atm: 2.2,
      burst_atm: 6.0,
    };
    await this.sim.createVessel(state.id, config);
    this.onVesselsChanged?.();
    return canonical;
  }

  public async remove(id: string): Promise<void> {
    if (!this.vessels.has(id)) return;
    if (this.isOnHotPlate(id)) {
      this.bench.placeVesselOnHotPlate(null);
      this.hotPlateId = null;
      this.bench.instruments?.hotPlate?.setPower(0);
      this.bench.instruments?.hotPlate?.setStir(false, 0);
    }
    this.vessels.delete(id);
    this.controls.delete(id);
    this.latest.delete(id);
    this.flammableAdded.delete(id);
    this.visual.clear(id);
    try {
      await this.sim.freeVessel(id);
    } finally {
      this.bench.removeVessel(id);
      if (this.selectedId === id) {
        const next = this.list()[0]?.id ?? null;
        this.select(next);
      }
      this.onVesselsChanged?.();
    }
  }

  public select(id: string | null) {
    if (id !== null && !this.vessels.has(id)) return;
    this.selectedId = id;
    this.bench.setSelectedVessel(id);
    this.onSelectionChanged?.(id);
  }

  // ------------------------------------------------------------------ hot plate & controls
  /** Slide `id` onto the hot plate; the previous occupant gets heat and stirring switched off. */
  public moveToHotPlate(id: string) {
    if (this.isOnHotPlate(id)) {
      this.hotPlateId = id;
      return;
    }
    const sceneDisplaced = this.bench.placeVesselOnHotPlate(id);
    const displaced = sceneDisplaced ?? (this.hotPlateId !== id ? this.hotPlateId : null);
    this.hotPlateId = id;
    if (displaced && displaced !== id && this.vessels.has(displaced)) {
      const c = this.ctl(displaced);
      c.heaterW = 0;
      c.stirring = false;
      c.stirRpm = 0;
      this.sim.control(displaced, { heater_w: 0, stirring: false, stir_rpm: 0 }).catch(() => {});
      this.bench.getGlassware(displaced)?.setStirring(0);
      const v = this.vessels.get(displaced);
      if (v) v.stirring = false;
      this.onControlsChanged?.(displaced);
    }
    this.syncHotPlate(id);
  }

  private syncHotPlate(id: string) {
    const c = this.ctl(id);
    const hp = this.bench.instruments?.hotPlate;
    hp?.setPower(c.heaterW);
    hp?.setStir(c.stirring, c.stirring ? c.stirRpm || STIR_RPM : 0);
  }

  public async setHeat(id: string, watts: number) {
    const c = this.ctl(id);
    const w = Math.max(0, Math.min(1000, Math.round(watts)));
    if (w > 0 || this.isOnHotPlate(id)) this.moveToHotPlate(id);
    c.heaterW = w;
    if (this.isOnHotPlate(id)) this.bench.instruments?.hotPlate?.setPower(w);
    await this.sim.control(id, { heater_w: w });
  }

  public async setStir(id: string, on: boolean) {
    const c = this.ctl(id);
    if (on) this.moveToHotPlate(id);
    c.stirring = on;
    c.stirRpm = on ? STIR_RPM : 0;
    const v = this.vessels.get(id);
    if (v) v.stirring = on;
    if (this.isOnHotPlate(id)) this.bench.instruments?.hotPlate?.setStir(on, c.stirRpm);
    this.bench.getGlassware(id)?.setStirring(c.stirRpm);
    await this.sim.control(id, { stirring: on, stir_rpm: c.stirRpm });
  }

  public async setIceBath(id: string, on: boolean) {
    this.ctl(id).iceBath = on;
    await this.sim.control(id, { bath_k: on ? 273.15 : null });
  }

  public async setSealed(id: string, on: boolean) {
    const v = this.vessels.get(id);
    if (v) v.isSealed = on;
    await this.sim.control(id, { sealed: on });
    if (id === this.selectedId) this.bench.setSelectedVessel(id);
  }

  public async ignite(id: string) {
    await this.sim.control(id, { igniter: true });
    await new Promise((r) => window.setTimeout(r, 450));
    if (this.vessels.has(id)) await this.sim.control(id, { igniter: false });
  }

  // ------------------------------------------------------------------ transfers
  /** Volume (mL) an addition of `amount` would occupy. Solids are treated as negligible volume. */
  public static addedVolumeMl(item: ReagentItem, amount: number): number {
    const mode = amountMode(item);
    if (mode === 'drops') return amount * DROP_ML;
    if (mode === 'g') return 0;
    return amount;
  }

  /**
   * Plays the matching bench animation and performs the chemistry when it completes.
   * Catalog reagents react; PubChem imports are visual only (returns 'visual').
   */
  public async addReagent(item: ReagentItem, vesselId: string, amount: number): Promise<'dosed' | 'visual'> {
    if (!this.vessels.has(vesselId)) throw new Error('That vessel is no longer on the bench.');
    if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
    const addMl = Lab.addedVolumeMl(item, amount);
    const free = this.freeCapacityMl(vesselId);
    if (addMl > free + 1e-6) throw new Error(`Only ${free.toFixed(1)} mL of space left.`);
    const colour = streamColour(item);

    if (item.kind === 'imported') {
      const b = item.bottle;
      const mode = amountMode(item);
      await this.animate((done) => {
        if (mode === 'g') this.bench.animateSolidAddition(item.id, vesselId, colour, done);
        else this.bench.animatePour(item.id, vesselId, colour, done);
      });
      if (!this.vessels.has(vesselId)) throw new Error('That vessel was removed before the addition finished.');
      // No reaction data: keep what was added as visible contents (powder bed / coloured liquid).
      const density = b.userOverrides?.density ?? b.sourcedProperties?.density;
      const rho = typeof density === 'number' && isFinite(density) && density > 0.05 && density < 25 ? density : mode === 'g' ? 1.6 : 1.0;
      const vis: VisualItem = {
        key: b.id,
        name: b.name,
        formula: b.formula,
        kind: mode === 'g' ? 'solid' : 'liquid',
        rgb: hexToLinear(/^#[0-9a-f]{6}$/i.test(b.color) ? b.color : mode === 'g' ? '#f4f3ef' : '#e8f4fa'),
        mass_g: mode === 'g' ? amount : 0,
        volume_ml: mode === 'g' ? 0 : amount,
        density_g_ml: rho,
        mw: b.mw || 0,
      };
      this.visual.add(vesselId, vis);
      await this.sim.fetchSnapshot(vesselId);
      return 'visual';
    }

    const e = item.entry;
    const mode = amountMode(item);
    await this.animate((done) => {
      if (mode === 'drops') this.bench.animateDrops(e.id, vesselId, Math.round(amount), colour, done);
      else if (mode === 'g') this.bench.animateSolidAddition(e.id, vesselId, colour, done);
      else this.bench.animatePour(e.id, vesselId, colour, done);
    });
    if (!this.vessels.has(vesselId)) throw new Error('That vessel was removed before the addition finished.');
    if (mode === 'drops') await this.sim.dose(vesselId, { reagent_id: e.id, drops: Math.round(amount) });
    else if (mode === 'g') {
      // The engine may dissolve a soluble solid instantly; keep a pile that visibly dissolves away instead of
      // letting the powder vanish the moment it lands (metals are consumed by reaction, not dissolved).
      if (!looksLikeMetal(e.formula, e.name)) {
        this.visual.add(vesselId, {
          key: e.id,
          name: e.name,
          formula: e.formula,
          kind: 'solid',
          rgb: hexToLinear(knownReagentColor(e.id) ?? '#f4f3ef'),
          mass_g: amount,
          volume_ml: 0,
          density_g_ml: e.density_g_ml || 1.6,
          mw: 0,
          ghost: { species: Object.keys(e.composition) },
        });
      }
      await this.sim.dose(vesselId, { reagent_id: e.id, mass_g: amount });
    } else await this.sim.dose(vesselId, { reagent_id: e.id, volume_ml: amount });
    if (e.ghs.includes('GHS02')) this.flammableAdded.add(vesselId);
    return 'dosed';
  }

  /** Max mL that can go from `src` into `tgt`. */
  public maxPourMl(src: string, tgt: string): number {
    return Math.max(0, Math.min(this.volumeMl(src), this.freeCapacityMl(tgt)));
  }

  public async pour(src: string, tgt: string, ml: number): Promise<void> {
    if (!this.vessels.has(src) || !this.vessels.has(tgt)) throw new Error('Pick two vessels on the bench.');
    const amount = Math.min(ml, this.maxPourMl(src, tgt));
    if (!(amount > 0.01)) throw new Error('Nothing to pour, or the target is full.');
    let colour = '#e8f4fa';
    try {
      colour = this.bench.getGlassware(src)?.getLiquidColorHex() || colour;
    } catch {
      /* stubbed scene */
    }
    const before = this.volumeMl(src);
    const portion = await this.sim.removeLiquid(src, amount, true);
    const carried = this.visual.take(src, before > 0 ? amount / before : 1);
    if (this.flammableAdded.has(src)) this.flammableAdded.add(tgt);
    await this.animate((done) => this.bench.animatePour(src, tgt, colour, done));
    if (!this.vessels.has(tgt)) return;
    this.visual.put(tgt, carried);
    await this.sim.addPortion(tgt, portion);
  }

  /** Discard all contents (liquid and solids) to waste. */
  public async empty(id: string): Promise<void> {
    if (!this.vessels.has(id)) return;
    await this.sim.removeLiquid(id, 1e5, true);
    this.visual.clear(id);
    this.flammableAdded.delete(id);
    await this.sim.fetchSnapshot(id);
  }

  /** Wraps a scene animation whose onComplete must fire exactly once; resolves even if it never does. */
  private animate(start: (done: () => void) => void): Promise<void> {
    return new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      window.setTimeout(done, ANIM_SAFETY_MS);
      try {
        start(done);
      } catch (err) {
        console.warn('[Lab] animation failed', err);
        done();
      }
    });
  }
}
