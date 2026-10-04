// Lab controller: vessels on the bench, their per-vessel controls, and every user action that
// touches both the 3D scene (BenchScene contract) and the WASM simulation (SimController).
import type { BenchScene } from '../bench/scene';
import type { SimController } from '../sim/sim_controller';
import { VesselState } from '../types';
import { VesselConfig, VesselSnapshot, ReagentCatalogEntry, Portion, ElectrolysisSpec, DoseRequest } from '../types/sim';
import { ElectrodeMaterial } from '../equipment/electrochem';
import { ReagentItem, amountMode, streamColour } from './reagent_library';
import type { FlowForm } from '../bench/handling';
import { DROP_ML, DrainSink, LabFlowSink, LabFlowSource, ReagentFlowSink, VesselFlowSink } from './flow';
export type { LabFlowSink, LabFlowSource } from './flow';
import { VisualContents, VisualItem, hexToLinear } from './visual_contents';
import { effectiveThermo } from '../pubchem/parser';
import { knownReagentColor } from './reagent_colors';
import { glasswareSpec } from './glassware_catalog';
import { ReactionClock, ClockInfo } from './reaction_clock';
import { canReceiveFiltrate, filterMode, filtrateStep, filtrationRateMlS, isFunnelType } from '../bench/filtration_math';
import { getProfile, vesselHeight } from '../render/glass_profiles';

export type VesselType = VesselState['type'];

// The glassware catalog lives in its own module; re-exported so existing imports keep working.
export { GLASSWARE, glasswareSpec } from './glassware_catalog';
export type { GlasswareSpec } from './glassware_catalog';

export interface VesselControlState {
  heaterW: number;
  stirring: boolean;
  stirRpm: number;
  iceBath: boolean;
  electrolysis?: ElectrolysisSpec | null;
}

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
  /** Heater / stirrer settings of vessels lifted off the hot plate (restored if they are set back on it). */
  private liftedControls = new Map<string, { heaterW: number; stirring: boolean }>();
  /** Delivery tubes: stoppered source flask id -> gas collector id (the engine moves the gas, see engine/src/gas.rs). */
  private gasLinks = new Map<string, string>();
  /** Funnels sitting on flasks: funnel id -> receiving flask id (liquid passes, solids stay: see runFilters). */
  private filters = new Map<string, string>();
  private filterTimer = 0;
  private filterLast = new Map<string, number>();
  private filterBusy = new Set<string>();
  /** Per-vessel reaction timer: waits for the first real reaction (or a manual Start). See reaction_clock.ts. */
  private clocks = new Map<string, ReactionClock>();
  public selectedId: string | null = null;

  public onVesselsChanged?: () => void;
  public onSelectionChanged?: (id: string | null) => void;
  /** Controls of a vessel changed from outside the vessel panel (e.g. displaced from the hot plate). */
  public onControlsChanged?: (id: string) => void;
  /** A vessel was removed from the bench (instrument histories forget it). */
  public onVesselRemoved?: (id: string) => void;
  /** A vessel's reaction timer started by itself because a real reaction began (`reason` e.g. "White precipitate formed: AgCl"). */
  public onReactionStarted?: (id: string, reason: string) => void;

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

  /** Vessel standing on the hot plate right now (null when the plate is empty). */
  public hotPlateVesselId(): string | null {
    const id = this.bench.getHotPlateVesselId() ?? this.hotPlateId;
    return id && this.vessels.has(id) ? id : null;
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
    if (this.clock(id).observe(engineSnap)) this.onReactionStarted?.(id, this.clock(id).info(snap.t_sim_s).reason ?? 'Reaction started');
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
    if (snap.electrolysis && id === this.selectedId) {
      this.bench.instruments.electrochem?.updateReadout(snap.electrolysis, this.ctl(id).electrolysis?.on ?? false);
    }
    // the electrode rods stand in the liquid: follow its level (reaction products, evaporation, pouring)
    if (this.ctl(id).electrolysis) {
      if (Math.abs(this.bench.vesselSurfaceY(id) - (this.electroSurfaceY.get(id) ?? -99)) > 0.15) this.updateElectroVisuals(id);
    }
    // Stopper popped (or sealed from elsewhere): re-attach the gauge for the selected vessel.
    if (sealedChanged && id === this.selectedId) this.bench.setSelectedVessel(id);
    return snap;
  }

  // ------------------------------------------------------------------ mass & reaction timer
  /** Everything a balance would read for this vessel: empty glass + contents (grams). */
  public totalMassG(id: string): number {
    const v = this.vessels.get(id);
    if (!v) return 0;
    const snap = this.latest.get(id);
    return glasswareSpec(v.type).glassMassG + (snap && !snap.burst ? snap.contents_mass_g : 0);
  }

  private clock(id: string): ReactionClock {
    let c = this.clocks.get(id);
    if (!c) {
      c = new ReactionClock();
      this.clocks.set(id, c);
    }
    return c;
  }

  /** Reaction timer of `id` in engine time (waiting until the first reaction, unless started by hand). */
  public reactionClock(id: string): ClockInfo | null {
    if (!this.vessels.has(id)) return null;
    return this.clock(id).info(this.latest.get(id)?.t_sim_s ?? 0);
  }

  public startReactionClock(id: string) {
    if (this.vessels.has(id)) this.clock(id).start(this.latest.get(id)?.t_sim_s ?? 0);
  }

  public stopReactionClock(id: string) {
    if (this.vessels.has(id)) this.clock(id).stop(this.latest.get(id)?.t_sim_s ?? 0);
  }

  public resetReactionClock(id: string) {
    if (this.vessels.has(id)) this.clock(id).reset();
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
      stopper_pop_atm: spec.popAtm,
      burst_atm: spec.burstAtm,
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
    this.onVesselRemoved?.(id);
    this.controls.delete(id);
    this.latest.delete(id);
    this.flammableAdded.delete(id);
    this.clocks.delete(id);
    for (const [s, d] of Array.from(this.gasLinks)) if (s === id || d === id) this.gasLinks.delete(s);
    this.releaseFiltersOf(id);
    this.liftedControls.delete(id);
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
    if (id) this.updateElectroVisuals(id);
    else this.bench.instruments?.electrochem?.detach();
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
    if (on && !this.bench.isOnStirrer(id)) this.moveToHotPlate(id); // the titration stirrer stirs where it stands
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
    if (!on && this.gasLinks.has(id)) await this.disconnectGas(id); // the delivery tube goes with the stopper
    const v = this.vessels.get(id);
    if (v) v.isSealed = on;
    await this.sim.control(id, { sealed: on });
    if (id === this.selectedId) this.bench.setSelectedVessel(id);
  }

  /** Slide a vessel next to another one on the bench (setups). */
  public placeBeside(id: string, nearId: string, dx = 14) {
    if (this.vessels.has(id) && this.vessels.has(nearId)) this.bench.placeBeside(id, nearId, dx);
  }

  // ------------------------------------------------------------------ electrochemistry
  public async setElectrolysis(id: string, spec: ElectrolysisSpec | null) {
    const c = this.ctl(id);
    c.electrolysis = spec;
    if (spec) {
      await this.sim.control(id, { electrolysis: spec });
    } else {
      await this.sim.control(id, { remove_electrodes: true });
    }
    this.updateElectroVisuals(id);
    this.onControlsChanged?.(id);
  }

  public async removeElectrodes(id: string) {
    await this.setElectrolysis(id, null);
  }

  public setElectrochemMaterials(anode: ElectrodeMaterial, cathode: ElectrodeMaterial) {
    this.bench.instruments?.electrochem?.setMaterials(anode, cathode);
  }

  public async dose(vesselId: string, req: DoseRequest) {
    if (!this.vessels.has(vesselId)) return;
    await this.sim.dose(vesselId, req);
  }

  public async setGalvanicCell(anodeVesselId: string, cathodeVesselId: string, anodeMat: ElectrodeMaterial = 'Zn', cathodeMat: ElectrodeMaterial = 'Cu') {
    const specA: ElectrolysisSpec = {
      anode: { material: anodeMat, area_cm2: 6.0 },
      cathode: { material: cathodeMat, area_cm2: 6.0 },
      mode: 'voltage',
      value: 0.0,
      on: false,
    };
    await this.setElectrolysis(anodeVesselId, specA);

    const bA = this.bench.getGlassware(anodeVesselId);
    const bB = this.bench.getGlassware(cathodeVesselId);
    if (bA && bB && this.bench.instruments.electrochem) {
      this.bench.instruments.electrochem.setSaltBridge(
        bA.group.position,
        bB.group.position,
        vesselHeight(getProfile(bA.vesselState.type)),
        vesselHeight(getProfile(bB.vesselState.type)),
      );
      this.bench.instruments.electrochem.setMaterials(anodeMat, cathodeMat);
    }
  }

  private electroSurfaceY = new Map<string, number>();

  public updateElectroVisuals(id: string) {
    const c = this.ctl(id);
    const ec = this.bench.instruments?.electrochem;
    if (!ec) return;
    if (c.electrolysis) {
      const b = this.bench.getGlassware(id);
      if (b) {
        const surfY = this.bench.vesselSurfaceY(id);
        ec.attachToVessel(b.group.position, vesselHeight(getProfile(b.vesselState.type)), surfY);
        this.electroSurfaceY.set(id, surfY);
        ec.setMaterials(c.electrolysis.anode.material as any, c.electrolysis.cathode.material as any);
      }
    } else {
      ec.detach();
      ec.removeSaltBridge();
    }
  }

  // ------------------------------------------------------------------ filtration
  public isFunnel(id: string): boolean {
    const v = this.vessels.get(id);
    return !!v && isFunnelType(v.type);
  }

  public canBeFilterReceiver(id: string): boolean {
    const v = this.vessels.get(id);
    return !!v && canReceiveFiltrate(v.type);
  }

  /** Flask that funnel `funnel` sits on, if any. */
  public filterReceiverOf(funnel: string): string | null {
    return this.filters.get(funnel) ?? null;
  }

  /** Funnel sitting on flask `receiver`, if any. */
  public filterFunnelOn(receiver: string): string | null {
    for (const [f, r] of this.filters) if (r === receiver) return f;
    return null;
  }

  /**
   * Sets `funnel` on the flask `receiver`: from now on liquid in the funnel runs through (slowly by gravity, fast through
   * a Büchner funnel on a Büchner flask under vacuum), the solids stay in the funnel and the filtrate collects below.
   */
  public async connectFilter(funnel: string, receiver: string): Promise<void> {
    if (!this.isFunnel(funnel)) throw new Error('Only a filter funnel or Büchner funnel can be set on a flask.');
    if (!this.canBeFilterReceiver(receiver)) throw new Error("The filtrate can't be collected in that vessel.");
    if (funnel === receiver) throw new Error('Pick a different vessel.');
    const other = this.filterFunnelOn(receiver);
    if (other && other !== funnel) this.disconnectFilter(other);
    if (this.hotPlateId === funnel) this.hotPlateId = null;
    if (!this.bench.stackFunnel(funnel, receiver)) throw new Error('Both vessels have to be on the bench.');
    this.filters.set(funnel, receiver);
    this.filterLast.set(funnel, performance.now());
    this.startFilterLoop();
    this.onVesselsChanged?.();
  }

  /** Lifts the funnel off its flask (it is set down beside it unless `reposition` is false, e.g. while carried). */
  public disconnectFilter(funnel: string, reposition = true): void {
    if (!this.filters.delete(funnel)) return;
    this.filterLast.delete(funnel);
    this.bench.unstackFunnel(funnel, reposition && this.vessels.has(funnel));
    this.onVesselsChanged?.();
  }

  private releaseFiltersOf(id: string, reposition = true) {
    for (const [f, r] of Array.from(this.filters)) {
      if (f === id) this.disconnectFilter(f, false); // the funnel itself is being carried or removed
      else if (r === id) this.disconnectFilter(f, reposition);
    }
  }

  private startFilterLoop() {
    if (this.filterTimer) return;
    this.filterTimer = window.setInterval(() => this.runFilters(), 100);
  }

  private runFilters() {
    if (this.filters.size === 0) {
      window.clearInterval(this.filterTimer);
      this.filterTimer = 0;
      return;
    }
    const now = performance.now();
    for (const [funnel, receiver] of this.filters) {
      const last = this.filterLast.get(funnel) ?? now;
      if (this.filterBusy.has(funnel)) continue;
      const fv = this.vessels.get(funnel);
      const rv = this.vessels.get(receiver);
      if (!fv || !rv) continue;
      const dt = Math.min(0.5, (now - last) / 1000) * (this.sim.isPaused ? 0 : this.sim.speedMultiplier);
      this.filterLast.set(funnel, now);
      const snap = this.latest.get(funnel);
      const liquid = this.volumeMl(funnel);
      const cake = snap ? snap.solids.reduce((a, s) => a + (s.mass_g || 0), 0) : 0;
      const mode = filterMode(fv.type, rv.type);
      const ml = filtrateStep(mode, liquid, cake, dt, this.freeCapacityMl(receiver));
      if (!(ml > 1e-4)) {
        this.bench.filters.setFlow(funnel, 0);
        continue;
      }
      this.bench.filters.setFlow(funnel, filtrationRateMlS(mode, liquid, cake));
      this.filterBusy.add(funnel);
      // clear liquid only: the precipitate stays on the paper
      this.transferChunk(funnel, receiver, ml, { solids: false })
        .catch((err) => console.warn('[lab] filtration step failed', err))
        .finally(() => this.filterBusy.delete(funnel));
    }
  }

  // ------------------------------------------------------------------ gas collection
  /** Gas syringe / gas collection tube / gas jar. */
  public static isCollectorType(type: string): boolean {
    return type.startsWith('gas-syringe') || type.startsWith('gas-collection-tube') || type.startsWith('gas-jar');
  }

  public isCollector(id: string): boolean {
    const v = this.vessels.get(id);
    return !!v && Lab.isCollectorType(v.type);
  }

  /** Vessels that can feed a delivery tube: anything that is neither a collector nor a pipette. */
  public canBeGasSource(id: string): boolean {
    const v = this.vessels.get(id);
    return !!v && !Lab.isCollectorType(v.type) && !v.type.startsWith('pipette') && !isFunnelType(v.type);
  }

  public collectors(): VesselState[] {
    return this.list().filter((v) => Lab.isCollectorType(v.type));
  }

  /** Collector that the delivery tube of flask `src` leads to, if any. */
  public gasCollectorOf(src: string): string | null {
    return this.gasLinks.get(src) ?? null;
  }

  /** Flask whose delivery tube feeds collector `dst`, if any. */
  public gasSourceOf(dst: string): string | null {
    for (const [s, d] of this.gasLinks) if (d === dst) return s;
    return null;
  }

  /**
   * Connects a delivery tube from flask `src` to the collector `dst`: stoppers the flask, draws the tube, and from now
   * on the engine moves the gas evolved in the flask into the collector (moles conserved).
   */
  public async connectGas(src: string, dst: string): Promise<void> {
    if (!this.vessels.has(src) || !this.vessels.has(dst)) throw new Error('Both vessels have to be on the bench.');
    if (src === dst) throw new Error('A delivery tube needs two different vessels.');
    if (!this.isCollector(dst)) throw new Error('The tube has to end in a gas syringe, gas collection tube or gas jar.');
    if (!this.canBeGasSource(src)) throw new Error("That vessel can't be fitted with a stopper and delivery tube.");
    const taken = this.gasSourceOf(dst);
    if (taken && taken !== src) await this.disconnectGas(taken); // one tube per collector
    const ok = await this.sim.gasLink(src, dst);
    if (!ok) throw new Error('The engine could not connect the tube.');
    this.gasLinks.set(src, dst);
    const v = this.vessels.get(src);
    if (v) v.isSealed = true;
    this.bench.gas.link(src, dst);
    if (src === this.selectedId) this.bench.setSelectedVessel(src);
    this.onControlsChanged?.(src);
    this.onVesselsChanged?.();
  }

  /** Takes the delivery tube off flask `src` (it keeps its stopper). */
  public async disconnectGas(src: string): Promise<void> {
    if (!this.gasLinks.has(src)) return;
    this.gasLinks.delete(src);
    this.bench.gas.unlink(src);
    await this.sim.gasUnlink(src);
    this.onVesselsChanged?.();
  }

  /** Empties a gas collector (plunger pushed home / jar flushed); resolves to the moles discarded. */
  public async ventCollector(id: string): Promise<number> {
    if (!this.isCollector(id)) return 0;
    return this.sim.gasVent(id);
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

  /** The engine reagent entry an item doses as, or undefined when it is visual-only (the engine could not model the formula). */
  private engineEntry(item: ReagentItem): ReagentCatalogEntry | undefined {
    if (item.kind === 'catalog') return item.entry;
    return item.model?.modelable && item.model.entry ? item.model.entry : undefined;
  }

  /**
   * Plays the matching bench animation and performs the chemistry when it completes.
   * Catalog reagents and imports the engine could model (ions from the formula) react; only imports with no
   * reaction model are visual-only (returns 'visual').
   */
  public async addReagent(item: ReagentItem, vesselId: string, amount: number): Promise<'dosed' | 'visual'> {
    if (!this.vessels.has(vesselId)) throw new Error('That vessel is no longer on the bench.');
    if (!(amount > 0)) throw new Error('Enter an amount greater than zero.');
    const addMl = Lab.addedVolumeMl(item, amount);
    const free = this.freeCapacityMl(vesselId);
    if (addMl > free + 1e-6) throw new Error(`Only ${free.toFixed(1)} mL of space left.`);
    const colour = streamColour(item);
    const e = this.engineEntry(item);
    const mode = amountMode(item);
    if (!e && item.kind !== 'imported') throw new Error('Unknown reagent.');

    await this.animate((done) => {
      if (!e) {
        // visual-only import: no dosing animation of its own, same pour / powder visuals
        if (mode === 'g') this.bench.animateSolidAddition(item.id, vesselId, colour, done);
        else this.bench.animatePour(item.id, vesselId, colour, done);
      } else if (mode === 'drops') this.bench.animateDrops(item.id, vesselId, Math.round(amount), colour, done);
      else if (mode === 'g') this.bench.animateSolidAddition(item.id, vesselId, colour, done);
      else this.bench.animatePour(item.id, vesselId, colour, done);
    });
    if (!this.vessels.has(vesselId)) throw new Error('That vessel was removed before the addition finished.');
    return this.commitAddition(item, vesselId, amount);
  }

  /**
   * The chemistry half of an addition (shared by the assisted Add card and manual pouring): dose the engine, or keep
   * a visual-only import as visible contents.
   * `amount` is in the item's own unit (mL / g / drops).
   */
  public async commitAddition(item: ReagentItem, vesselId: string, amount: number): Promise<'dosed' | 'visual'> {
    if (!this.vessels.has(vesselId)) throw new Error('That vessel is no longer on the bench.');
    const e = this.engineEntry(item);
    const mode = amountMode(item);
    if (!e && item.kind === 'imported') {
      const b = item.bottle;
      // The engine could not model the formula at all (modelable=false): keep what was added as visible contents
      // (powder bed / coloured liquid). Compounds the engine models - reacting or inert - never come through here:
      // their solids / layers are in the engine snapshot.
      const density = effectiveThermo(b).density; // undefined when PubChem gave none (placeholder 1 g/mL is not data)
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
      // a liquid known only by a colour gets the engine's single (Speculative) RGB -> spectrum inversion
      if (vis.kind === 'liquid') {
        try {
          vis.absorbance_per_cm = await this.sim.colourToAbsorbance(vis.rgb, 2);
        } catch {
          /* rendered colourless without the engine inversion */
        }
      }
      this.visual.add(vesselId, vis);
      await this.sim.fetchSnapshot(vesselId);
      return 'visual';
    }
    if (!e) throw new Error('Unknown reagent.');

    if (mode === 'drops') await this.sim.dose(vesselId, { reagent_id: e.id, drops: Math.round(amount) });
    else if (mode === 'g') {
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
    const taken = await this.takePortion(src, tgt, amount);
    await this.animate((done) => this.bench.animatePour(src, tgt, colour, done));
    if (!this.vessels.has(tgt)) return;
    await this.insertPortion(tgt, taken);
  }

  /** Removes `ml` of liquid (with proportional solids / visual contents) from `src`, species conserved. */
  private async takePortion(src: string, tgt: string, ml: number, solids = true) {
    const before = this.volumeMl(src);
    const portion = await this.sim.removeLiquid(src, ml, solids);
    const carried = this.visual.take(src, before > 0 ? ml / before : 1);
    if (this.flammableAdded.has(src)) this.flammableAdded.add(tgt);
    return { portion, carried };
  }

  private async insertPortion(tgt: string, taken: { portion: Portion; carried: VisualItem[] }) {
    this.visual.put(tgt, taken.carried);
    await this.sim.addPortion(tgt, taken.portion);
  }

  // ------------------------------------------------------------------ stopcocks (burette / separatory funnel) + stirrer plate
  /** A drain through a stopcock: `tgt` null = onto the bench (discarded); `bottom`: densest layer first (separatory funnel). */
  public openDrain(srcId: string, targetId: string | null, bottom: boolean): LabFlowSink | null {
    if (!this.vessels.has(srcId) || (targetId !== null && (!this.vessels.has(targetId) || targetId === srcId))) return null;
    return new DrainSink(this, srcId, targetId, bottom);
  }

  /** One increment of a stopcock drain (species conserved; the target gets exactly what left the source). */
  public async drainChunk(src: string, tgt: string | null, ml: number, bottom: boolean): Promise<void> {
    if (!this.vessels.has(src) || !(ml > 0)) return;
    const before = this.volumeMl(src);
    const portion = bottom ? await this.sim.removeLiquidBottom(src, ml, true) : await this.sim.removeLiquid(src, ml, true);
    const carried = this.visual.take(src, before > 0 ? ml / before : 1);
    if (tgt === null || !this.vessels.has(tgt)) return; // spilled onto the bench
    if (this.flammableAdded.has(src)) this.flammableAdded.add(tgt);
    await this.insertPortion(tgt, { portion, carried });
  }

  /** A vessel left the titration stirrer: stirring stops (like lifting a flask off the hot plate). */
  public stirrerVacated(id: string) {
    if (!this.vessels.has(id)) return;
    const c = this.ctl(id);
    if (!c.stirring) return;
    c.stirring = false;
    c.stirRpm = 0;
    const v = this.vessels.get(id);
    if (v) v.stirring = false;
    this.bench.getGlassware(id)?.setStirring(0);
    this.sim.control(id, { stirring: false, stir_rpm: 0 }).catch(() => {});
    this.onControlsChanged?.(id);
  }

  /** Stand a vessel on the titration stirrer's tile (the burette clamp rises / drops to seat its tip in the neck). */
  public seatOnTitrationStirrer(id: string): boolean {
    return this.vessels.has(id) && this.bench.seatTitrationFlask(id);
  }

  /** Stand `flaskId` under the stopcock of the separatory funnel `funnelId`. */
  public seatBelowFunnel(flaskId: string, funnelId: string): boolean {
    return this.vessels.has(flaskId) && this.vessels.has(funnelId) && this.bench.seatBelowFunnel(flaskId, funnelId);
  }

  /** Camera over the titration station (B key): tip + flask, the whole stand, the burette reading. */
  public frameTitration(restart = false): boolean {
    return this.bench.focusTitration(restart);
  }

  /** Which vessels stand in the titration station right now (burette in the clamp, flask on the tile). */
  public stationState(): { burette: string | null; flask: string | null } {
    return { burette: this.bench.titration.mountedBuretteId(), flask: this.bench.titration.stirrerVesselId() };
  }

  /** One increment of a manual vessel→vessel pour (called ~10 Hz while the user keeps tilting). */
  public async transferChunk(src: string, tgt: string, ml: number, opts?: { solids?: boolean }): Promise<void> {
    if (!this.vessels.has(src) || !this.vessels.has(tgt) || !(ml > 0)) return;
    const taken = await this.takePortion(src, tgt, ml, opts?.solids ?? true);
    if (!this.vessels.has(tgt)) return;
    await this.insertPortion(tgt, taken);
  }

  /**
   * Chemistry side of manual pipetting: liquid moves between real engine vessels in small portions (species
   * conserved). Suction takes clear liquid only: settled / suspended solids stay behind in the source.
   */
  public pipetteLab() {
    return {
      volumeMl: (id: string) => this.volumeMl(id),
      freeMl: (id: string) => this.freeCapacityMl(id),
      transfer: (src: string, dst: string, ml: number) => this.transferChunk(src, dst, ml, { solids: false }),
      name: (id: string) => this.vessels.get(id)?.name ?? 'vessel',
    };
  }

  // ------------------------------------------------------------------ manual handling (hot plate / balance / flows)
  /** A vessel was picked up off the hot plate: it stops being heated (its settings come back if it is put back). */
  public vesselLifted(id: string, from: 'hotplate' | 'balance' | 'bench') {
    this.releaseFiltersOf(id); // lifting a funnel or the flask under it breaks the filtration setup
    // a vessel lifted out of its ice bath is no longer cooled by it (the basin is drawn only while the vessel stands in it)
    if (this.vessels.has(id) && this.ctl(id).iceBath) this.sim.control(id, { bath_k: null }).catch(() => {});
    if (from !== 'hotplate' || !this.vessels.has(id)) return;
    if (this.hotPlateId === id) this.hotPlateId = null;
    const c = this.ctl(id);
    if (c.heaterW > 0 || c.stirring) this.liftedControls.set(id, { heaterW: c.heaterW, stirring: c.stirring });
    c.heaterW = 0;
    c.stirring = false;
    c.stirRpm = 0;
    const hp = this.bench.instruments?.hotPlate;
    hp?.setPower(0);
    hp?.setStir(false, 0);
    this.sim.control(id, { heater_w: 0, stirring: false, stir_rpm: 0 }).catch(() => {});
    this.bench.getGlassware(id)?.setStirring(0);
    const v = this.vessels.get(id);
    if (v) v.stirring = false;
    this.onControlsChanged?.(id);
  }

  /** A carried vessel came to rest on the bench / hot plate / balance. */
  public vesselPlaced(id: string, place: 'hotplate' | 'balance' | 'bench') {
    if (!this.vessels.has(id)) return;
    if (this.ctl(id).iceBath) this.sim.control(id, { bath_k: 273.15 }).catch(() => {}); // set down: the bath is round it again
    const saved = this.liftedControls.get(id);
    if (place !== 'hotplate') {
      this.liftedControls.delete(id);
      return;
    }
    this.moveToHotPlate(id);
    this.liftedControls.delete(id);
    if (saved) {
      if (saved.heaterW > 0) void this.setHeat(id, saved.heaterW).catch(() => {});
      if (saved.stirring) void this.setStir(id, true).catch(() => {});
      this.onControlsChanged?.(id);
    }
  }

  /**
   * Opens a continuous flow of `source` into `targetId` (manual pouring). Amounts pushed into the returned sink are
   * batched to the engine at <= ~10 Hz; `end()` flushes the rest. Reagent bottles are unlimited reservoirs; a vessel
   * source drains. `form` is the unit the pourer works in (mL / g / drops) and is converted to the item's own unit.
   */
  public openFlow(source: LabFlowSource, targetId: string, form: FlowForm): LabFlowSink | null {
    if (!this.vessels.has(targetId)) return null;
    if ('vesselId' in source) {
      if (!this.vessels.has(source.vesselId) || source.vesselId === targetId) return null;
      return new VesselFlowSink(this, source.vesselId, targetId);
    }
    if (!this.engineEntry(source.item) && source.item.kind !== 'imported') return null;
    const e = this.engineEntry(source.item);
    return new ReagentFlowSink(this, source.item, targetId, form, e?.density_g_ml || 1);
  }

  /** Discard all contents (liquid and solids) to waste. */
  public async empty(id: string): Promise<void> {
    if (!this.vessels.has(id)) return;
    if (this.isCollector(id)) await this.sim.gasVent(id); // a gas collector holds gas: flush it
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
