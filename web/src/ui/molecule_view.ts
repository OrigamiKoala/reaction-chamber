// Right panel, tab "Molecules": a small 3D box of the selected vessel's phase with ball-and-stick molecules drifting about.
//
// An illustration driven by the engine (docs/plans/reaction-viewer-plan.md): which species are present, and in what
// proportions, comes from the vessel snapshot; the motion is schematic Brownian motion. Counts are compressed (x^0.3) and
// every species present gets at least one molecule, so the legend gives the true concentrations. The engine's reactions play
// as single-step events at an enriched, ranked frequency (`app/micro_events.ts`); the legend gives the true rates.
//   - R2/R3: template reactions, proton transfers, complexation, ion pairs, electron transfers: a morph of 3D structures
//     (`render/micro_morph.ts`).
//   - R4: solid surfaces (a slab under the box, `render/micro_slab.ts`): precipitation, dissolution, plating, corrosion,
//     electrode half-reactions, decomposition (`render/micro_surface_event.ts`); molecules crossing the free surface
//     (evaporation, dissolved gases); combustion in the gas; a generic swap for a reaction without an atom map.
//   - R5: replay of any row from the legend (the camera follows), a floating tag at every event, charge labels.
import * as THREE from 'three';
import type { MicroLatticeData, MicroMorphData, MicroReactionData, Structure3dData, VesselSnapshot, MicroPhase } from '../types/sim';
import { h, prettyFormula, prettyEquation, fmtConc, fmtAmountMol } from './dom';
import { allocate, reconcileStep, SCENERY_WATERS, DEFAULT_ALLOCATE } from '../app/micro_sampler';
import { phasesOf, sampleInput, defaultPhase, type PhaseInfo, type PhaseKey, type PhaseSet } from '../app/micro_phases';
import { EventScheduler, visualRates, type FiredEvent, type VisualRate } from '../app/micro_events';
import { buildSlab } from '../app/micro_lattice';
import { eventLabel, orientSurface, playability, positionsFor, surfaceKeyOf, type PlayContext } from '../app/micro_plan';
import { MicroMotion, FACE_BOTTOM, FACE_TOP, type Body, type BodyRole } from '../render/micro_motion';
import { MicroScene, type StyleMode, type WaterMode } from '../render/micro_scene';
import { buildShape, type MolShape } from '../render/micro_shape';
import { ReactionEvent, invertSpec, type DrawableEvent, type EventSpec } from '../render/micro_morph';
import { Slab } from '../render/micro_slab';
import { SurfaceEvent, SwapEvent, type ElectronPath, type JoinPlan, type LeavePlan } from '../render/micro_surface_event';

export interface MoleculeViewDeps {
  /** Structures of species of a vessel (engine `vessel_micro_structures`). */
  structures: (vesselId: string, speciesIds: string[]) => Promise<Structure3dData[]>;
  /** The latest snapshot of a vessel. */
  snapshot: (vesselId: string) => VesselSnapshot | undefined;
  /** Reactions of a phase with their atom maps and gross rates (engine `vessel_micro_reactions`); without it no reaction is drawn. */
  reactions?: (vesselId: string, phase: MicroPhase) => Promise<MicroReactionData[]>;
  /** What a solid is made of (engine `vessel_micro_lattice`); without it no solid surface is offered. */
  lattice?: (vesselId: string, solid: string) => Promise<MicroLatticeData | null>;
  /** Scene factory (tests pass a renderer-less scene); default: a scene drawing on the tab's canvas. */
  makeScene?: (canvas: HTMLCanvasElement) => MicroScene;
}

const WATER_ID = 'H2O';
/** Seconds between recomputing the targets from the snapshot (the snapshot itself arrives at 20 Hz). */
const TARGET_PERIOD_S = 1;
/** Molecules that may enter or leave the box per second while it follows the vessel. */
const RECONCILE_PER_S = 4;
/** Seconds between asking the engine for the reactions of the shown phase. */
const ROWS_PERIOD_S = 1;
/** Speed at which the products of an event drift apart when they are released, A/s. */
const PRODUCT_PUSH = 5;
/** An event that cannot find its reactant waits for one to drift in; at most this often per species (ms). */
const SPAWN_GAP_MS = 2500;
/** Reactions listed in the legend (the fastest); a busy vessel has many more. */
const LEGEND_ROWS = 24;
/** How long a transfer event (a molecule crossing the surface) stays announced, seconds of view time. */
const TRANSFER_S = 1.8;
/** A replay waits this long for the reactants to be in the box, ms. */
const REPLAY_WAIT_MS = 12000;
/** Height of the meeting point of a reaction at a surface above the lattice's top plane, A. */
const SURFACE_ANCHOR = 3.4;
/** A reactant sent in for an event stays in the box this long even if the phase does not list it, ms. */
const GUEST_MS = 15000;
/** Molecules crossing the free surface at once at most (apart from the three chemical events). */
const MAX_CROSSINGS = 2;
/** Events per second of the fastest crossing (the fastest chemical event gets one). */
const CROSSING_F_MAX = 0.5;
/** Floating tags shown at once at most. */
const MAX_TAGS = 4;

/** An event in progress: any mix of a morph of molecules, a lattice part, a swap, a crossing. */
interface ActiveEvent {
  row: MicroReactionData;
  direction: 'forward' | 'reverse';
  label: { title: string; tag: string };
  reaction: { ev: ReactionEvent; products: string[]; bodies: Body[] } | null;
  surface: SurfaceEvent | null;
  swap: { ev: SwapEvent; bodies: Body[]; products: string[] } | null;
  /** A crossing of the free surface is announced this many more seconds of view time (it moves by the motion model, not by the event). */
  left: number | null;
  /** The molecule that crosses, for the tag's position. */
  crossing: Body | null;
  /** A solid product that stays on the surface when the event is done. */
  residue: Array<{ species: string; at: THREE.Vector3 }>;
  replay: boolean;
}

const KIND_LABELS: Record<string, string> = {
  proton_transfer: 'proton transfer',
  complexation: 'complexation',
  ion_pair: 'ion pair',
  electron_transfer: 'electron transfer',
  dissolution: 'precipitation / dissolution',
  electrode: 'electrode half-reaction',
  phase_transfer: 'crosses the surface',
  decomposition: 'thermal decomposition',
  combustion: 'combustion',
  other: 'reaction (atoms not tracked)',
};
const kindLabel = (r: MicroReactionData) => {
  if (r.kind === 'template') return (r.family ?? 'reaction').replace(/_/g, ' ');
  const base = KIND_LABELS[r.kind] ?? r.kind;
  return r.note ? `${base} (one-electron step)` : base;
};

/** A rate in mol/s of the phase, 2 significant digits. */
const fmtRate = (v: number) => (v === 0 ? '0' : Math.abs(v) < 1e-3 || Math.abs(v) >= 1e4 ? v.toExponential(1) : v.toPrecision(2));

/** Every species a row needs a structure for (its molecules, the lattice parts, the morph at the surface). */
function speciesOfRow(r: MicroReactionData): string[] {
  const out = new Set<string>([...r.reactants, ...r.products]);
  const sd = r.surface;
  if (sd) {
    for (const l of sd.leaves) {
      out.add(l.occupant);
      l.becomes.forEach((s) => out.add(s));
    }
    for (const j of sd.joins) {
      out.add(j.occupant);
      j.takes.forEach((s) => out.add(s));
    }
    sd.residue.forEach((s) => out.add(s));
    if (sd.morph) [...sd.morph.reactants, ...sd.morph.products].forEach((s) => out.add(s));
  }
  return [...out];
}

export class MoleculeView {
  public readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private status: HTMLElement;
  private legend: HTMLElement;
  private phaseSel: HTMLSelectElement;
  private pauseBtn: HTMLButtonElement;
  private scene: MicroScene | null = null;
  private motion: MicroMotion | null = null;
  private resizeObs?: ResizeObserver;

  private vesselId: string | null = null;
  private active = false;
  private raf = 0;
  private lastT = 0;
  private paused = false;
  private speed = 1;
  private style: StyleMode = 'ball-stick';
  private water: WaterMode = 'faint';
  private charges = false;

  private phaseSet: PhaseSet = { phases: [], solids: [] };
  private phaseKey: PhaseKey | null = null;
  private built: PhaseKey | null = null;
  private target = new Map<string, number>();
  private waterTarget = 0;
  private prevAlloc = new Map<string, number>();
  private shapes = new Map<string, MolShape>();
  private fetching = new Set<string>();
  private failed = new Map<string, string>();
  private sinceTarget = TARGET_PERIOD_S;
  private opsBudget = 0;
  private legendKey = '';
  private legendAt = 0;
  private dropped = new Set<string>();
  private error = '';

  // reactions
  private structs = new Map<string, Structure3dData>();
  private rows: MicroReactionData[] = [];
  private rates: VisualRate[] = [];
  private rowsFor: PhaseKey | null = null;
  private sinceRows = ROWS_PERIOD_S;
  private rowsBusy = false;
  private crossingIds = new Set<string>();
  private scheduler = new EventScheduler();
  /** Crossings of the free surface are ranked and scheduled apart from the chemistry (their rates dwarf it and would crowd it out). */
  private crossingScheduler = new EventScheduler(Math.random, MAX_CROSSINGS);
  private events: ActiveEvent[] = [];
  private played = new Map<string, number>();
  private spawned = new Map<string, number>();
  /** Species sent in for an event whose reactant was missing (a fuel vapour that the snapshot does not list): kept in the box until this time (ms). */
  private guests = new Map<string, number>();
  private caption: HTMLElement;
  private captionUntil = 0;
  private tagBox: HTMLElement;
  private tagEls: HTMLElement[] = [];
  private pendingReplay: { id: string; until: number } | null = null;
  private followed: ActiveEvent | null = null;

  // solid surfaces
  private lattices = new Map<string, MicroLatticeData | null>();
  private latticeAsked = new Set<string>();
  private slab: Slab | null = null;

  constructor(private deps: MoleculeViewDeps) {
    this.el = h('div', { class: 'mv', hidden: true });
    this.canvas = h('canvas', { class: 'mv-canvas', 'aria-label': 'Molecular view of the vessel contents (illustration)' });
    this.caption = h('div', { class: 'mv-caption', hidden: true, role: 'status', 'aria-live': 'polite' });
    this.tagBox = h('div', { class: 'mv-tags', 'aria-hidden': 'true' });
    const stage = h('div', { class: 'mv-stage' }, this.canvas, this.tagBox, this.caption);

    // toolbar
    this.phaseSel = h('select', { class: 'mv-select', 'aria-label': 'Phase to show' });
    this.phaseSel.addEventListener('change', () => {
      this.phaseKey = this.phaseSel.value as PhaseKey;
      this.refreshTargets(true);
    });
    this.pauseBtn = h('button', { class: 'seg-btn mv-pause', type: 'button', 'aria-pressed': 'false', text: 'Pause' });
    this.pauseBtn.addEventListener('click', () => {
      this.paused = !this.paused;
      this.pauseBtn.setAttribute('aria-pressed', String(this.paused));
      this.pauseBtn.textContent = this.paused ? 'Play' : 'Pause';
    });
    const speedSeg = this.segment<number>('Playback speed', [['0.5×', 0.5], ['1×', 1], ['2×', 2]], 1, (v) => (this.speed = v));
    const waterSeg = this.segment<WaterMode>('Solvent water', [['Faint', 'faint'], ['Solid', 'solid'], ['Hide', 'hidden']], 'faint', (v) => {
      this.water = v;
      this.scene?.setWaterMode(v);
    });
    const styleSeg = this.segment<StyleMode>('Drawing style', [['Ball & stick', 'ball-stick'], ['Space-filling', 'space-filling']], 'ball-stick', (v) => {
      this.style = v;
      if (this.scene) this.scene.style = v;
    });
    const chargeSeg = this.segment<boolean>('Charge labels', [['Charges off', false], ['Charges on', true]], false, (v) => {
      this.charges = v;
      if (this.scene) this.scene.showCharges = v;
    });
    const bar = h(
      'div',
      { class: 'mv-bar' },
      h('div', { class: 'mv-bar-row' }, this.phaseSel, this.pauseBtn, speedSeg),
      h('div', { class: 'mv-bar-row' }, h('span', { class: 'mv-bar-label', text: 'Water' }), waterSeg, styleSeg, chargeSeg),
    );

    this.status = h('p', { class: 'hint-line mv-status', role: 'status' });
    this.legend = h('div', { class: 'mv-legend' });
    const note = h('p', {
      class: 'hint-line mv-note',
      text:
        'Illustration. Which molecules are present comes from the simulation; their numbers are compressed so that rare species show (every species present has at least one molecule). The motion is schematic and slowed far below real speed. Reactions play as a single-step morph, ranked as in the simulation (the fastest about once a second, the slowest shown once per 20 s) and enriched: the table gives the true rates, and ▶ plays one again with the camera on it. Solid surfaces (pick one in the list) are a schematic packing chosen by the formula, not a measured crystal structure; ions there do not shed their hydration shell. A reaction without an atom map is drawn as a swap (the reactants shrink away, the products grow in).',
    });
    this.el.append(stage, bar, this.status, this.legend, note);
    // the legend's replay buttons
    this.legend.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('button.mv-replay');
      if (b && !b.disabled && b.dataset.row) this.replay(b.dataset.row);
    });
  }

  private segment<T>(label: string, items: Array<[string, T]>, initial: T, on: (v: T) => void): HTMLElement {
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    const btns: Array<[HTMLButtonElement, T]> = [];
    for (const [text, value] of items) {
      const b = h('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(value === initial), text });
      b.addEventListener('click', () => {
        for (const [o, v] of btns) o.setAttribute('aria-pressed', String(v === value));
        on(value);
      });
      btns.push([b, value]);
      seg.append(b);
    }
    return seg;
  }

  // ------------------------------------------------------------------ lifecycle
  /** The panel shows another vessel (or none). */
  public show(vesselId: string | null) {
    this.setActive(false);
    this.abortEvents();
    this.vesselId = vesselId;
    this.shapes.clear();
    this.fetching.clear();
    this.failed.clear();
    this.lattices.clear();
    this.latticeAsked.clear();
    this.slab = null;
    this.scene?.setSlab(null);
    this.phaseKey = null;
    this.built = null;
    this.prevAlloc.clear();
    this.motion = null;
    this.sinceTarget = TARGET_PERIOD_S;
    this.error = '';
    this.resetReactions();
  }

  private resetReactions() {
    this.structs.clear();
    this.rows = [];
    this.rates = [];
    this.rowsFor = null;
    this.sinceRows = ROWS_PERIOD_S;
    this.events = [];
    this.played.clear();
    this.spawned.clear();
    this.guests.clear();
    this.scheduler.reset();
    this.crossingScheduler.reset();
    this.pendingReplay = null;
    this.followed = null;
    this.caption.hidden = true;
    this.hideTags(0);
    this.legendKey = '';
  }

  /** The tab is visible: render and animate; hidden: stop completely (no frames, no snapshot work). */
  public setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    this.el.hidden = !on;
    if (on) {
      this.ensureScene();
      this.sinceTarget = TARGET_PERIOD_S;
      const snap = this.vesselId ? this.deps.snapshot(this.vesselId) : undefined;
      if (snap) this.update(snap);
      this.lastT = performance.now();
      this.raf = requestAnimationFrame(this.loop);
    } else {
      cancelAnimationFrame(this.raf);
    }
  }

  public dispose() {
    this.setActive(false);
    this.resizeObs?.disconnect();
    this.scene?.dispose();
    this.scene = null;
  }

  private ensureScene() {
    if (this.scene) return;
    try {
      this.scene = this.deps.makeScene ? this.deps.makeScene(this.canvas) : new MicroScene(this.canvas);
    } catch (err) {
      this.error = `3D view unavailable: ${err instanceof Error ? err.message : String(err)}`;
      return;
    }
    this.scene.style = this.style;
    this.scene.showCharges = this.charges;
    this.scene.setWaterMode(this.water);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(() => this.fit());
      this.resizeObs.observe(this.canvas.parentElement!);
    }
    this.fit();
    if (this.motion) this.scene.setBox(this.motion.size, this.motion.kind === 'liquid');
    if (this.slab) this.scene.setSlab(this.slab);
  }

  private fit() {
    const wrap = this.canvas.parentElement;
    if (wrap && this.scene) this.scene.resize(wrap.clientWidth, wrap.clientHeight);
  }

  // ------------------------------------------------------------------ snapshot (20 Hz, forwarded by the vessel panel)
  public update(snap: VesselSnapshot) {
    if (!this.active) return;
    this.requestLattices(snap);
    this.phaseSet = phasesOf(snap, { lattices: this.latticeSet() });
    this.syncPhaseOptions();
    if (this.phaseKey === null || !this.phaseSet.phases.some((p) => p.key === this.phaseKey)) {
      this.phaseKey = defaultPhase(this.phaseSet);
      this.phaseSel.value = this.phaseKey ?? '';
      this.sinceTarget = TARGET_PERIOD_S;
    }
  }

  /** Asks the engine, once per solid, what the lattice of each solid and each electrode of the vessel is made of. */
  private requestLattices(snap: VesselSnapshot) {
    const vessel = this.vesselId;
    if (!vessel || !this.deps.lattice) return;
    const want = new Set<string>();
    for (const r of snap.species ?? []) if (r.phase === 'solid' && r.amount_mol > 0) want.add(r.id);
    if (snap.electrolysis) for (const e of snap.electrodes ?? []) if (e.material) want.add(`${e.material.replace(/\(s\)$/, '')}(s)`);
    for (const id of want) {
      if (this.latticeAsked.has(id)) continue;
      this.latticeAsked.add(id);
      this.deps
        .lattice(vessel, id)
        .then((l) => {
          if (this.vesselId === vessel) this.lattices.set(id, l);
        })
        .catch(() => {
          if (this.vesselId === vessel) this.lattices.set(id, null);
        });
    }
  }

  private latticeSet(): Set<string> {
    return new Set([...this.lattices.entries()].filter(([, l]) => l !== null).map(([id]) => id));
  }

  private syncPhaseOptions() {
    const keys = this.phaseSet.phases.map((p) => `${p.key}:${p.label}`).join('|');
    if (this.phaseSel.dataset.keys === keys) return;
    this.phaseSel.dataset.keys = keys;
    this.phaseSel.replaceChildren(...this.phaseSet.phases.map((p) => h('option', { value: p.key, text: p.label })));
    if (this.phaseKey) this.phaseSel.value = this.phaseKey;
  }

  // ------------------------------------------------------------------ targets
  private currentPhase(): PhaseInfo | undefined {
    return this.phaseSet.phases.find((p) => p.key === this.phaseKey);
  }

  private context(): PlayContext | null {
    const p = this.currentPhase();
    return p ? { fluid: p.fluid, surface: p.surface } : null;
  }

  /** Recomputes how many molecules of each species the box should hold; `rebuild` also refills the box at once. */
  private refreshTargets(rebuild: boolean) {
    const phase = this.currentPhase();
    if (!phase || !this.vesselId) {
      this.target = new Map();
      this.waterTarget = 0;
      this.abortEvents();
      this.motion = null;
      this.built = null;
      return;
    }
    const alloc = allocate(sampleInput(phase), { ...DEFAULT_ALLOCATE, previous: rebuild ? undefined : this.prevAlloc });
    this.target = alloc.counts;
    this.prevAlloc = new Map(alloc.counts);
    this.dropped = new Set(alloc.dropped);
    this.waterTarget = phase.species.some((s) => s.scenery) ? SCENERY_WATERS : 0;

    // fetch the structures that are missing: the box's species, and the ions of the lattice under it
    const need = [...this.target.keys()];
    if (this.waterTarget > 0) need.push(WATER_ID);
    const lat = phase.surface ? this.lattices.get(phase.surface.slab) : null;
    if (lat) for (const i of lat.ions) need.push(i.species);
    this.fetchStructures(need, true);

    if (rebuild || this.built !== this.phaseKey) this.rebuildBox(phase);
  }

  /**
   * Asks the engine for the structures not held yet. `rebuild`: the box is refilled once they arrive (they are species of the
   * sample); the structures of an event's products only join the library.
   */
  private fetchStructures(ids: string[], rebuild: boolean) {
    const vessel = this.vesselId;
    if (!vessel) return;
    const missing = ids.filter((id) => !this.shapes.has(id) && !this.fetching.has(id) && !this.failed.has(id));
    if (missing.length === 0) return;
    for (const id of missing) this.fetching.add(id);
    this.deps
      .structures(vessel, missing)
      .then((list) => {
        if (this.vesselId !== vessel) return;
        for (const s of list) {
          this.structs.set(s.species, s);
          this.shapes.set(s.species, buildShape(s));
          this.fetching.delete(s.species);
        }
        for (const id of missing) {
          if (!this.shapes.has(id)) this.failed.set(id, 'no structure returned');
          this.fetching.delete(id);
        }
        if (rebuild) {
          this.sinceTarget = TARGET_PERIOD_S; // rebuild with what is there
          if (this.built === this.phaseKey) this.built = null;
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        for (const id of missing) {
          this.fetching.delete(id);
          this.failed.set(id, msg);
        }
        this.error = `Structures unavailable: ${msg}`;
      });
  }

  /** New box for the phase, filled at once with the species whose structures have arrived. */
  private rebuildBox(phase: PhaseInfo) {
    const ready = [...this.target.entries()].filter(([id]) => this.shapes.has(id));
    if (ready.length === 0 && this.target.size > 0) return; // wait for the structures
    // box edge from the volume the molecules take (about 10 % packing), within a range that frames well
    const waterShape = this.shapes.get(WATER_ID);
    let vol = 0;
    for (const [id, n] of ready) vol += n * (4 / 3) * Math.PI * Math.pow(this.shapes.get(id)!.radius, 3);
    if (waterShape && this.waterTarget > 0) vol += this.waterTarget * (4 / 3) * Math.PI * Math.pow(waterShape.radius, 3);
    let edge = THREE.MathUtils.clamp(Math.cbrt(vol / (phase.kind === 'gas' ? 0.02 : 0.12)), 34, 80);
    if (!Number.isFinite(edge)) edge = 50;
    const size = new THREE.Vector3(edge, edge * (phase.kind === 'gas' ? 1 : 0.85), edge);
    this.abortEvents(); // their bodies belonged to the old box
    const m = new MicroMotion(size, phase.kind, 7);
    // the largest molecules first, so the small ones fill the gaps
    ready.sort((a, b) => this.shapes.get(b[0])!.radius - this.shapes.get(a[0])!.radius);
    for (const [id, n] of ready) for (let i = 0; i < n; i++) m.addInside(id, this.shapes.get(id)!, 'solute');
    if (waterShape && this.waterTarget > 0) for (let i = 0; i < this.waterTarget; i++) m.addInside(WATER_ID, waterShape, 'water');
    this.motion = m;
    this.built = this.phaseKey;
    this.opsBudget = 0;
    this.scene?.setBox(size, phase.kind === 'liquid');
    this.buildSlab(phase, size);
  }

  /** The lattice patch under the box when the phase is a solid surface (and the structures of its ions have arrived). */
  private buildSlab(phase: PhaseInfo, size: THREE.Vector3) {
    this.slab = null;
    const sf = phase.surface;
    const lat = sf ? this.lattices.get(sf.slab) : null;
    if (sf && lat && lat.ions.every((i) => this.shapes.has(i.species))) {
      const layout = buildSlab(lat, { footprint: Math.min(size.x, size.z) * 0.85 });
      let seed = 7;
      for (const c of sf.slab) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) | 0;
      const slab = new Slab(layout, new THREE.Vector3(0, -size.y / 2 - 1.0, 0), lat, sf.slab, seed >>> 0);
      slab.fillInitial((sp) => this.shapes.get(sp));
      this.slab = slab;
    }
    this.scene?.setSlab(this.slab);
  }

  // ------------------------------------------------------------------ frame loop
  private loop = (t: number) => {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;

    this.sinceTarget += dt;
    if (this.sinceTarget >= TARGET_PERIOD_S) {
      this.sinceTarget = 0;
      this.refreshTargets(false);
    }
    this.sinceRows += dt;
    if (this.sinceRows >= ROWS_PERIOD_S) {
      this.sinceRows = 0;
      this.refreshRows();
    }
    const m = this.motion;
    if (m && this.scene) {
      if (!this.paused) {
        const sdt = dt * this.speed;
        this.reconcile(m, dt);
        m.step(sdt);
        this.stepEvents(m, sdt);
        this.tryReplay(m);
        this.scheduleEvents(m, sdt);
      }
      if (this.followed && !this.events.includes(this.followed)) this.followed = null;
      this.scene.followPoint(this.followed ? this.eventCentre(this.followed) : null);
      this.scene.sync(m, this.drawables());
    }
    this.scene?.render();
    this.drawTags();
    this.drawStatus();
    this.drawCaption(t);
    this.drawLegend(t);
  };

  private drawables(): DrawableEvent[] {
    const out: DrawableEvent[] = [];
    for (const e of this.events) {
      if (e.reaction) out.push(e.reaction.ev);
      if (e.surface) out.push(e.surface);
      if (e.swap) out.push(e.swap.ev);
    }
    return out;
  }

  // ------------------------------------------------------------------ reactions
  private playable(r: MicroReactionData): boolean {
    const ctx = this.context();
    if (!ctx) return false;
    if (!playability(r, ctx).ok) return false;
    // a surface row needs the slab that is under the box now
    if (r.surface && !this.slab) return false;
    return true;
  }

  /** Asks the engine for the reactions of the shown phase (once a second) and recomputes the visual frequencies. */
  private refreshRows() {
    const phase = this.currentPhase();
    const vessel = this.vesselId;
    if (!this.deps.reactions || !vessel || !phase) {
      if (this.rows.length > 0) {
        this.rows = [];
        this.rates = [];
      }
      return;
    }
    if (this.rowsBusy) return;
    const key = this.phaseKey;
    this.rowsBusy = true;
    this.deps
      .reactions(vessel, phase.fluid)
      .then((rows) => {
        if (this.vesselId !== vessel || this.phaseKey !== key) return;
        this.rows = rows;
        this.rowsFor = key;
        this.rates = this.rankRows(rows);
        // the molecules of the reactions that will be played: their structures are fetched ahead of the first event
        const shown = new Set(this.rates.filter((v) => v.shown).map((v) => v.id));
        const ids = new Set<string>();
        for (const r of rows) if (shown.has(r.id)) for (const sp of speciesOfRow(r)) ids.add(sp);
        this.fetchStructures([...ids], false);
      })
      .catch((err: unknown) => {
        this.rows = [];
        this.rates = [];
        this.error = `Reactions unavailable: ${err instanceof Error ? err.message : String(err)}`;
      })
      .finally(() => {
        this.rowsBusy = false;
      });
  }

  /** Visual frequencies of the playable rows: the chemistry ranked on its own, the crossings of the free surface on theirs. */
  private rankRows(rows: MicroReactionData[]): VisualRate[] {
    const ev = (r: MicroReactionData) => ({ id: r.id, forward: r.gross_forward_mol_s, reverse: r.gross_reverse_mol_s });
    const playable = rows.filter((r) => this.playable(r));
    const chem = visualRates(playable.filter((r) => r.kind !== 'phase_transfer').map(ev));
    const cross = visualRates(playable.filter((r) => r.kind === 'phase_transfer').map(ev), { fMax: CROSSING_F_MAX, maxRows: 4 });
    const crossIds = new Set(playable.filter((r) => r.kind === 'phase_transfer').map((r) => r.id));
    this.crossingIds = crossIds;
    return [...chem, ...cross];
  }

  private specOfStructs(reactants: string[], products: string[], atomMap: MicroReactionData['atom_map'], movingH: MicroReactionData['moving_h'], hops: MicroReactionData['electron_hops'], direction: 'forward' | 'reverse'): EventSpec | null {
    const rs = reactants.map((s) => this.structs.get(s));
    const ps = products.map((s) => this.structs.get(s));
    if (rs.some((x) => !x || x.source === 'placeholder') || ps.some((x) => !x || x.source === 'placeholder')) return null;
    const spec: EventSpec = { reactants: rs as Structure3dData[], products: ps as Structure3dData[], atomMap, movingH, electronHops: hops };
    return direction === 'forward' ? spec : invertSpec(spec);
  }

  private specOf(r: MicroReactionData, direction: 'forward' | 'reverse'): EventSpec | null {
    return this.specOfStructs(r.reactants, r.products, r.atom_map, r.moving_h, r.electron_hops, direction);
  }

  private specOfMorph(mo: MicroMorphData, direction: 'forward' | 'reverse'): EventSpec | null {
    return this.specOfStructs(mo.reactants, mo.products, mo.atom_map, mo.moving_h, mo.electron_hops, direction);
  }

  private roleOf(species: string): BodyRole {
    return species === WATER_ID && this.waterTarget > 0 ? 'water' : 'solute';
  }

  private fluidIsGas(): boolean {
    return this.currentPhase()?.kind === 'gas';
  }

  /** The reactions that fire now (Poisson, ranked, at most three at a time) start their events. */
  private scheduleEvents(m: MicroMotion, dt: number) {
    if (this.rates.length === 0 || this.rowsFor !== this.phaseKey) return;
    const busyChem = this.events.filter((e) => e.row.kind !== 'phase_transfer').length;
    const busyCross = this.events.length - busyChem;
    const chem = this.rates.filter((v) => !this.crossingIds.has(v.id));
    const cross = this.rates.filter((v) => this.crossingIds.has(v.id));
    for (const f of this.scheduler.tick(Math.min(dt, 0.25), chem, busyChem)) this.startEvent(m, f);
    for (const f of this.crossingScheduler.tick(Math.min(dt, 0.25), cross, busyCross)) this.startEvent(m, f);
  }

  /**
   * Starts the event of a row: takes the molecules it needs out of the box's motion. A reactant that is not in the box yet is sent
   * in through a wall and the event is skipped this time (the row fires again later). Returns the event, or null.
   */
  private startEvent(m: MicroMotion, f: FiredEvent, near?: THREE.Vector3): ActiveEvent | null {
    const row = this.rows.find((r) => r.id === f.id);
    const ctx = this.context();
    if (!row || !ctx || !playability(row, ctx).ok) return null;
    let ev: ActiveEvent | null;
    if (row.surface) ev = this.startSurface(m, row, f.direction, near);
    else if (row.kind === 'phase_transfer') ev = this.startTransfer(m, row, f.direction, near);
    else if (row.kind === 'other') ev = this.startSwap(m, row, f.direction, near);
    else ev = this.startMorph(m, row, f.direction, near);
    if (ev) {
      this.events.push(ev);
      this.showCaption(ev);
    }
    return ev;
  }

  private newEvent(row: MicroReactionData, direction: 'forward' | 'reverse'): ActiveEvent {
    return { row, direction, label: eventLabel(row, direction), reaction: null, surface: null, swap: null, left: null, crossing: null, residue: [], replay: false };
  }

  /** A molecule of each of `species` taken from the box (the one nearest the first, or to `near`); null, with the missing one sent in, when one is absent. */
  private pickAll(m: MicroMotion, species: string[], near?: THREE.Vector3): Body[] | null {
    const chosen: Body[] = [];
    const taken = new Set<number>();
    for (const sp of species) {
      const role = this.roleOf(sp);
      const b = m.pick(sp, role, taken, chosen[0]?.pos ?? near);
      if (!b) {
        this.spawn(m, sp);
        return null;
      }
      chosen.push(b);
      taken.add(b.uid);
    }
    return chosen;
  }

  private spawn(m: MicroMotion, sp: string) {
    const shape = this.shapes.get(sp);
    const now = performance.now();
    if (shape && now - (this.spawned.get(sp) ?? -1e9) > SPAWN_GAP_MS) {
      this.spawned.set(sp, now);
      this.guests.set(sp, now + GUEST_MS);
      m.addEntering(sp, shape, this.roleOf(sp));
    }
  }

  // ---- a morph of molecules in solution (R2, R3) and combustion in the gas
  private startMorph(m: MicroMotion, row: MicroReactionData, direction: 'forward' | 'reverse', near?: THREE.Vector3): ActiveEvent | null {
    const spec = this.specOf(row, direction);
    if (!spec) return null;
    const species = direction === 'forward' ? row.reactants : row.products;
    const productSpecies = direction === 'forward' ? row.products : row.reactants;
    const chosen = this.pickAll(m, species, near);
    if (!chosen) return null;
    for (const b of chosen) b.state = 'reacting';
    const ev = this.newEvent(row, direction);
    ev.reaction = { ev: new ReactionEvent(spec, chosen.map((b) => ({ pos: b.pos, quat: b.quat }))), products: productSpecies, bodies: chosen };
    return ev;
  }

  // ---- a molecule crossing the free surface (evaporation, a dissolved gas, boiling)
  private startTransfer(m: MicroMotion, row: MicroReactionData, direction: 'forward' | 'reverse', near?: THREE.Vector3): ActiveEvent | null {
    const liquidSp = row.reactants[0];
    const gasSp = row.products[0];
    if (!liquidSp || !gasSp) return null;
    const toGas = direction === 'forward';
    const ev = this.newEvent(row, direction);
    if (!this.fluidIsGas()) {
      if (toGas) {
        const picked = this.pickAll(m, [liquidSp], near);
        if (!picked) return null;
        m.sendThrough(picked[0], FACE_TOP);
        ev.crossing = picked[0];
      } else {
        const shape = this.shapes.get(liquidSp);
        if (!shape) return null;
        ev.crossing = m.addEnteringAt(liquidSp, shape, this.roleOf(liquidSp), FACE_TOP);
      }
    } else if (toGas) {
      const shape = this.shapes.get(gasSp);
      if (!shape) return null;
      ev.crossing = m.addEnteringAt(gasSp, shape, 'solute', FACE_BOTTOM);
    } else {
      const picked = this.pickAll(m, [gasSp], near);
      if (!picked) return null;
      m.sendThrough(picked[0], FACE_BOTTOM);
      ev.crossing = picked[0];
    }
    ev.left = TRANSFER_S;
    return ev;
  }

  // ---- a reaction without an atom map: a swap
  private startSwap(m: MicroMotion, row: MicroReactionData, direction: 'forward' | 'reverse', near?: THREE.Vector3): ActiveEvent | null {
    const from = direction === 'forward' ? row.reactants : row.products;
    const to = direction === 'forward' ? row.products : row.reactants;
    const fromStructs = from.map((s) => this.structs.get(s));
    const toStructs = to.map((s) => this.structs.get(s));
    const fromShapes = from.map((s) => this.shapes.get(s));
    const toShapes = to.map((s) => this.shapes.get(s));
    if ([...fromStructs, ...toStructs].some((s) => !s || s.source === 'placeholder') || [...fromShapes, ...toShapes].some((s) => !s)) return null;
    const chosen = this.pickAll(m, from, near);
    if (!chosen) return null;
    for (const b of chosen) b.state = 'reacting';
    const sw = new SwapEvent(
      chosen.map((b, i) => ({ shape: b.shape, struct: fromStructs[i]!, pos: b.pos.clone(), quat: b.quat.clone() })),
      to.map((_, i) => ({ shape: toShapes[i]!, struct: toStructs[i]! })),
    );
    const ev = this.newEvent(row, direction);
    ev.swap = { ev: sw, bodies: chosen, products: to };
    return ev;
  }

  // ---- a reaction at a solid surface (R4): ions join the lattice, occupants leave it, the rest reacts above it
  private startSurface(m: MicroMotion, row: MicroReactionData, direction: 'forward' | 'reverse', near?: THREE.Vector3): ActiveEvent | null {
    const slab = this.slab;
    const sd = row.surface;
    if (!slab || !sd) return null;
    const o = orientSurface(sd, direction);
    if (!o) return null;
    const unit = slab.layout.unit;
    const slabSpecies = slab.lattice.species;

    // sites that leave: one group of positions per leaving occupant (a formula unit when the solid itself leaves)
    const leavePositions: string[] = [];
    const leaveOccupants: Array<string | null> = [];
    const leaveGroups: Array<{ first: number; count: number; becomes: string[] }> = [];
    for (const l of o.leaves) {
      const pos = positionsFor(l.occupant, slabSpecies, unit);
      if (!pos) return null;
      leaveGroups.push({ first: leavePositions.length, count: pos.length, becomes: l.becomes });
      for (const p of pos) {
        leavePositions.push(p);
        // the occupant must be what the engine says leaves (the lattice's own ion or a foreign atom plated on it); a whole formula
        // unit of the solid itself (a decomposition) is any set of its ions
        leaveOccupants.push(pos.length === 1 ? l.occupant : null);
      }
    }
    const joinPositions: string[] = [];
    const joinGroups: Array<{ first: number; takes: string[]; occupant: string }> = [];
    for (const j of o.joins) {
      const pos = positionsFor(j.occupant, slabSpecies, unit);
      if (!pos || pos.length !== 1) return null;
      joinGroups.push({ first: joinPositions.length, takes: j.takes, occupant: j.occupant });
      joinPositions.push(pos[0]);
    }
    const leaveSites = leavePositions.length > 0 ? slab.pickUnit('exposed', leavePositions, leaveOccupants) : [];
    if (!leaveSites) return null;
    const joinSites = joinPositions.length > 0 ? slab.pickUnit('vacant', joinPositions) : [];
    if (!joinSites) return null;

    // the molecules that come to the surface: the ions that join, then the species that react above it
    const floorY = slab.origin.y + 1.0;
    const mid = joinSites.length > 0 ? slab.siteWorld(joinSites[0]) : leaveSites.length > 0 ? slab.siteWorld(leaveSites[0]) : new THREE.Vector3(0, floorY, 0);
    const joinSpecies = joinGroups.map((g) => g.takes[0]);
    const joinBodies = joinSpecies.length > 0 ? this.pickAll(m, joinSpecies, near ?? mid) : [];
    if (!joinBodies) return null;
    const taken = new Set(joinBodies.map((b) => b.uid));
    let morphSpec: EventSpec | null = null;
    let morphBodies: Body[] = [];
    let morphProducts: string[] = [];
    if (o.morph) {
      morphSpec = this.specOfMorph(o.morph, o.morphReverse ? 'reverse' : 'forward');
      if (!morphSpec) return null;
      const need = o.morphReverse ? o.morph.products : o.morph.reactants;
      morphProducts = o.morphReverse ? o.morph.reactants : o.morph.products;
      const picked: Body[] = [];
      for (const sp of need) {
        const b = m.pick(sp, this.roleOf(sp), taken, picked[0]?.pos ?? near ?? mid);
        if (!b) {
          this.spawn(m, sp);
          return null;
        }
        picked.push(b);
        taken.add(b.uid);
      }
      morphBodies = picked;
    }

    // nothing can fail from here: take everything over
    slab.reserve([...leaveSites, ...joinSites]);
    const ev = this.newEvent(row, direction);
    const joins: JoinPlan[] = joinGroups.map((g, i) => ({ body: joinBodies[i], siteId: joinSites[g.first], occupantSpecies: g.occupant, occupantShape: this.shapes.get(g.occupant) ?? joinBodies[i].shape }));
    const leaves: LeavePlan[] = [];
    for (const g of leaveGroups) {
      for (let k = 0; k < g.count; k++) {
        const id = leaveSites[g.first + k];
        const becomes = k === 0 ? g.becomes : [];
        leaves.push({
          siteId: id,
          becomes: becomes
            .filter((s) => this.shapes.has(s))
            .map((s) => ({ species: s, shape: this.shapes.get(s)!, role: this.roleOf(s), gas: s.endsWith('(g)') })),
        });
      }
    }
    // the solid products that stay behind sit where the unit was
    if (o.residue.length > 0 && leaveSites.length > 0) {
      const c = new THREE.Vector3();
      for (const s of leaveSites) c.add(slab.siteWorld(s));
      c.multiplyScalar(1 / leaveSites.length);
      for (const sp of o.residue) ev.residue.push({ species: sp, at: c.clone() });
    }

    let morphEv: ReactionEvent | null = null;
    if (morphSpec && morphBodies.length > 0) {
      for (const b of morphBodies) b.state = 'reacting';
      const anchorSite = joinSites[0] ?? leaveSites[0];
      const anchor = anchorSite !== undefined ? slab.above(anchorSite, SURFACE_ANCHOR) : new THREE.Vector3(0, floorY + SURFACE_ANCHOR, 0);
      morphEv = new ReactionEvent(morphSpec, morphBodies.map((b) => ({ pos: b.pos, quat: b.quat })), { anchor });
      ev.reaction = { ev: morphEv, products: morphProducts, bodies: morphBodies };
    }

    // electrons: an anode takes them from what reacts into the electrode, a cathode gives them to it, a metal / solution pair
    // passes them from the metal that leaves to what takes them
    const paths: ElectronPath[] = [];
    const n = row.electrons;
    if (n > 0) {
      const bulk = (p: THREE.Vector3) => new THREE.Vector3(p.x, slab.origin.y - slab.layout.height - slab.layout.spacing, p.z);
      const leavePoint = leaveSites.length > 0 ? () => slab.siteWorld(leaveSites[0]) : null;
      const sinkPoint = joinBodies.length > 0 ? () => joinBodies[0].pos : morphEv ? () => morphEv!.centre() : null;
      const which = sd.electrode ?? null;
      if (which && sd.oxidation) {
        const src = leavePoint ?? sinkPoint;
        if (src) paths.push({ from: src, to: () => bulk(src()), count: n });
      } else if (which) {
        if (sinkPoint) paths.push({ from: () => bulk(sinkPoint()), to: sinkPoint, count: n });
      } else if (leavePoint && sinkPoint) {
        paths.push({ from: leavePoint, to: sinkPoint, count: n });
      }
    }

    ev.surface = new SurfaceEvent(slab, joins, leaves, paths, {
      onDock: (j) => m.release(j.body),
      onLift: (l, pos) => {
        const up = new THREE.Vector3(0, 1, 0);
        for (const b of l.becomes) {
          const q = new THREE.Quaternion().setFromAxisAngle(up, Math.random() * 6.28);
          const body = m.place(b.species, b.shape, b.role, pos.clone().add(new THREE.Vector3(0, b.shape.radius + 0.6, 0)), q, new THREE.Vector3((Math.random() - 0.5) * 3, 5, (Math.random() - 0.5) * 3));
          if (b.gas && !this.fluidIsGas()) m.sendThrough(body, FACE_TOP);
        }
      },
    });
    return ev;
  }

  // ------------------------------------------------------------------ progress of events
  private eventCentre(a: ActiveEvent, out = new THREE.Vector3()): THREE.Vector3 {
    if (a.surface) return a.surface.centre(out);
    if (a.reaction) return a.reaction.ev.centre(out);
    if (a.swap) return a.swap.ev.centre(out);
    if (a.crossing) return out.copy(a.crossing.pos);
    return out.set(0, 0, 0);
  }

  private stepEvents(m: MicroMotion, dt: number) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const a = this.events[i];
      a.reaction?.ev.step(dt);
      a.surface?.step(dt);
      a.swap?.ev.step(dt);
      if (a.left !== null) a.left -= dt;
      const done = (!a.reaction || a.reaction.ev.finished) && (!a.surface || a.surface.finished) && (!a.swap || a.swap.ev.finished) && (a.left === null || a.left <= 0);
      if (!done) continue;
      this.events.splice(i, 1);
      this.finishEvent(m, a);
    }
  }

  /** Products of a morph or a swap appear as rigid bodies at the poses of the event and drift apart; residues stay on the slab. */
  private finishEvent(m: MicroMotion, a: ActiveEvent) {
    if (a.reaction) {
      for (const b of a.reaction.bodies) m.release(b);
      const poses = a.reaction.ev.productPoses();
      const centre = a.reaction.ev.centre();
      a.reaction.products.forEach((sp, i) => {
        const shape = this.shapes.get(sp);
        if (!shape) return;
        const away = poses[i].pos.clone().sub(centre);
        if (away.lengthSq() < 1e-6) away.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        away.normalize().multiplyScalar(PRODUCT_PUSH);
        const body = m.place(sp, shape, this.roleOf(sp), poses[i].pos, poses[i].quat, away);
        // a gas made in a liquid rises out of it
        if (sp.endsWith('(g)') && !this.fluidIsGas()) m.sendThrough(body, FACE_TOP);
      });
    }
    if (a.swap) {
      for (const b of a.swap.bodies) m.release(b);
      a.swap.products.forEach((sp, i) => {
        const shape = this.shapes.get(sp);
        if (!shape) return;
        const pose = a.swap!.ev.productPoses[i];
        const away = pose.pos.clone().sub(a.swap!.ev.centre());
        if (away.lengthSq() < 1e-6) away.set(0, 1, 0);
        m.place(sp, shape, this.roleOf(sp), pose.pos, pose.quat, away.normalize().multiplyScalar(PRODUCT_PUSH * 0.6));
      });
    }
    if (a.residue.length > 0 && this.slab) {
      for (const r of a.residue) {
        const shape = this.shapes.get(r.species);
        if (shape) this.slab.addResidue(r.at, r.species, shape);
      }
    }
    this.played.set(a.row.id, (this.played.get(a.row.id) ?? 0) + 1);
    this.captionUntil = performance.now() + 2500;
  }

  /** Drops every event in progress (the box is rebuilt or closed): bodies go back to the motion, the slab's sites are freed. */
  private abortEvents() {
    for (const a of this.events) {
      a.surface?.abort();
      for (const b of a.reaction?.bodies ?? []) b.state = 'in';
      for (const b of a.swap?.bodies ?? []) b.state = 'in';
    }
    this.events = [];
    this.followed = null;
    this.hideTags(0);
  }

  // ------------------------------------------------------------------ replay (R5)
  /**
   * Plays the next event of a legend row in the middle of the box, with the camera on it. A row of a solid surface that is not the
   * one on show takes the view to that surface first (the replay waits for its box and its rows).
   */
  public replay(rowId: string) {
    const row = this.rows.find((r) => r.id === rowId);
    if (!row) return;
    const key = surfaceKeyOf(row);
    if (key && key !== this.phaseKey && this.phaseSet.phases.some((p) => p.key === key)) {
      this.phaseKey = key as PhaseKey;
      this.phaseSel.value = key;
      this.refreshTargets(true);
      this.rowsFor = null;
      this.sinceRows = ROWS_PERIOD_S;
    }
    this.pendingReplay = { id: rowId, until: performance.now() + REPLAY_WAIT_MS };
    this.paused = false;
    this.pauseBtn.setAttribute('aria-pressed', 'false');
    this.pauseBtn.textContent = 'Pause';
  }

  private tryReplay(m: MicroMotion) {
    const p = this.pendingReplay;
    if (!p) return;
    if (performance.now() > p.until) {
      this.pendingReplay = null;
      return;
    }
    if (this.rowsFor !== this.phaseKey) return; // the rows of the new view have not arrived yet
    const row = this.rows.find((r) => r.id === p.id);
    if (!row) {
      this.pendingReplay = null;
      return;
    }
    // the direction the row runs now; a row that only runs one way runs that way
    const direction: 'forward' | 'reverse' = row.reversible && row.gross_reverse_mol_s > row.gross_forward_mol_s ? 'reverse' : 'forward';
    const a = this.startEvent(m, { id: row.id, direction }, new THREE.Vector3(0, 0, 0));
    if (a) {
      a.replay = true;
      this.followed = a;
      this.pendingReplay = null;
    }
  }

  // ------------------------------------------------------------------ text
  private captionText(a: ActiveEvent): string {
    const { row } = a;
    const fwd = a.direction === 'forward';
    const from = fwd ? row.reactants : row.products;
    const to = fwd ? row.products : row.reactants;
    const eq = row.kind === 'dissolution' || row.kind === 'electrode' || row.surface ? prettyEquation(row.equation.replace(/ \(\d+ e-, (anode|cathode)\)$/, '')) : `${from.map(prettyFormula).join(' + ')} → ${to.map(prettyFormula).join(' + ')}`;
    let text = `${a.label.title}: ${eq}`;
    if (row.electron_hops.length > 0 && row.reactants[row.electron_hops[0].from[0]]) {
      const hop = row.electron_hops[0];
      const donor = row.reactants[hop.from[0]];
      const acceptor = row.reactants[hop.to[0]];
      const [d, c] = fwd ? [donor, acceptor] : [acceptor, donor];
      text += ` · ${hop.count} e⁻ ${prettyFormula(d)} → ${prettyFormula(c)}`;
    } else if (row.electrons > 0) {
      text += ` · ${row.electrons} e⁻`;
    }
    if (row.schematic_mapping) text += ' · atoms assigned by element (schematic)';
    if (a.swap) text += ' · atoms not tracked';
    if (this.slab && row.surface) text += ` · ${this.slab.layout.note}`;
    return text;
  }

  private showCaption(a: ActiveEvent) {
    this.caption.textContent = this.captionText(a);
    this.caption.hidden = false;
    this.captionUntil = performance.now() + 60000; // until the event ends (finishEvent shortens it)
  }

  private drawCaption(t: number) {
    if (!this.caption.hidden && this.events.length === 0 && t > this.captionUntil) this.caption.hidden = true;
  }

  /** Short labels floating at the events in progress, positioned by projecting the event's centre onto the canvas. */
  private drawTags() {
    const sc = this.scene;
    const shown = this.events.slice(0, MAX_TAGS);
    if (!sc || shown.length === 0) {
      this.hideTags(0);
      return;
    }
    const v = new THREE.Vector3();
    shown.forEach((a, i) => {
      let el = this.tagEls[i];
      if (!el) {
        el = h('div', { class: 'mv-tag' });
        this.tagEls[i] = el;
        this.tagBox.append(el);
      }
      const p = sc.project(this.eventCentre(a, v).add(new THREE.Vector3(0, 6, 0)));
      el.hidden = !p.visible;
      if (el.textContent !== a.label.tag) el.textContent = a.label.tag;
      el.style.transform = `translate(${p.x.toFixed(0)}px, ${p.y.toFixed(0)}px) translate(-50%, -100%)`;
    });
    this.hideTags(shown.length);
  }

  private hideTags(from: number) {
    for (let i = from; i < this.tagEls.length; i++) this.tagEls[i].hidden = true;
  }

  /** Moves the box toward the targets a few molecules per second, so it follows the vessel without popping. */
  private reconcile(m: MicroMotion, dt: number) {
    this.opsBudget += dt * RECONCILE_PER_S;
    const n = Math.floor(this.opsBudget);
    if (n < 1) return;
    this.opsBudget -= n;
    const have = m.counts('solute');
    const want = new Map([...this.target].filter(([id]) => this.shapes.has(id)));
    const now = performance.now();
    for (const [sp, until] of this.guests) {
      if (now > until) this.guests.delete(sp);
      else if (!want.has(sp) && this.shapes.has(sp)) want.set(sp, 1);
    }
    const ops = reconcileStep(have, want, n);
    for (const id of ops.add) m.addEntering(id, this.shapes.get(id)!, 'solute');
    for (const id of ops.remove) m.removeOne(id, 'solute');
    const w = this.shapes.get(WATER_ID);
    if (w) {
      const haveW = m.counts('water').get(WATER_ID) ?? 0;
      if (haveW < this.waterTarget) m.addEntering(WATER_ID, w, 'water');
      else if (haveW > this.waterTarget) m.removeOne(WATER_ID, 'water');
    }
  }

  private drawStatus() {
    const phase = this.currentPhase();
    let text = '';
    if (this.error) text = this.error;
    else if (!phase) text = 'Nothing in the vessel to show yet. Add a reagent.';
    else if (this.fetching.size > 0 && !this.motion) text = 'Building molecule structures…';
    else {
      const have = this.motion?.counts('solute') ?? new Map<string, number>();
      let n = 0;
      for (const c of have.values()) n += c;
      const w = this.motion?.counts('water').get(WATER_ID) ?? 0;
      text = `${n} molecules of ${have.size} species in the box${w > 0 ? `, with ${w} scenery waters (not the true ratio)` : ''}${this.events.length > 0 ? `; ${this.events.length} reaction${this.events.length > 1 ? 's' : ''} in progress` : ''}.`;
      if (phase.surface) {
        text += this.slab ? ` Surface: ${phase.surface.slab} (${this.slab.layout.note}; ${this.slab.count()} of ${this.slab.layout.sites.length} sites occupied).` : ` Building the lattice of ${phase.surface.slab}…`;
      }
    }
    if (this.status.textContent !== text) this.status.textContent = text;
  }

  private drawLegend(t: number) {
    if (t - this.legendAt < 500) return;
    this.legendAt = t;
    const phase = this.currentPhase();
    const ctx = this.context();
    const have = this.motion?.counts('solute') ?? new Map<string, number>();
    const rows: string[] = [];
    if (phase) {
      for (const s of phase.species) {
        const n = s.scenery ? this.motion?.counts('water').get(WATER_ID) ?? 0 : have.get(s.id) ?? 0;
        const amount = s.conc !== null ? fmtConc(s.conc) : s.fraction !== null ? `x = ${s.fraction < 0.001 ? s.fraction.toExponential(1) : s.fraction.toFixed(3)}` : fmtAmountMol(s.mol);
        const note = s.scenery ? 'solvent, scenery' : n === 0 ? (this.dropped.has(s.id) ? 'not drawn (trace / cap)' : 'arriving') : '';
        rows.push([s.id, prettyFormula(s.formula || s.id), s.name, amount, String(n), note].join('\u0001'));
      }
    }
    // reactions: true rates (mol/s of the phase) and how the view plays them
    const rate = new Map(this.rates.map((v) => [v.id, v]));
    const byRate = [...this.rows].sort((a, b) => b.gross_forward_mol_s + b.gross_reverse_mol_s - (a.gross_forward_mol_s + a.gross_reverse_mol_s) || (a.id < b.id ? -1 : 1));
    const rx = byRate.slice(0, LEGEND_ROWS).map((r) => {
      const v = rate.get(r.id);
      const pb = ctx ? playability(r, ctx) : { ok: false, why: '' };
      const played = pb.ok && (!r.surface || !!this.slab);
      const key = surfaceKeyOf(r);
      const elsewhere = !pb.ok && !!key && this.phaseSet.phases.some((p) => p.key === key);
      let true_ = 'exchange rate not modelled';
      if (r.rate_source.startsWith('net rate')) true_ = `net ${fmtRate(r.net_rate_mol_s)} mol/s (gross exchange not modelled)`;
      else if (r.rate_source !== 'none' && (r.gross_forward_mol_s > 0 || r.gross_reverse_mol_s > 0)) {
        true_ = `net ${fmtRate(r.net_rate_mol_s)} · gross ${fmtRate(r.gross_forward_mol_s)} ⇄ ${fmtRate(r.gross_reverse_mol_s)} mol/s`;
      }
      const how = !played ? (pb.ok ? 'building the lattice…' : pb.why || 'not drawn yet') : v?.shown ? `drawn about every ${(1 / (v.fwd + v.rev)).toFixed(v.fwd + v.rev >= 0.2 ? 1 : 0)} s` : 'listed only (too slow to show)';
      return [prettyEquation(r.equation), kindLabel(r), true_, how + (elsewhere ? ' (▶ goes there)' : ''), String(this.played.get(r.id) ?? 0), played || elsewhere ? '1' : '0', r.id].join('\u0001');
    });
    const key = rows.join('\u0002') + '\u0003' + rx.join('\u0002') + this.phaseSet.solids.map((s) => s.id).join(',');
    if (key === this.legendKey) return;
    this.legendKey = key;
    const table = h('table', { class: 'mv-table' });
    table.append(h('thead', {}, h('tr', {}, h('th', { text: 'Species' }), h('th', { text: 'True amount' }), h('th', { class: 'mv-num', text: 'In box' }), h('th', { text: '' }))));
    const body = h('tbody');
    for (const r of rows) {
      const [, formula, name, amount, n, note] = r.split('\u0001');
      body.append(
        h(
          'tr',
          {},
          h('td', {}, h('span', { class: 'c-formula', text: formula }), name && name !== formula ? h('span', { class: 'c-name', text: name }) : null),
          h('td', { text: amount }),
          h('td', { class: 'mv-num', text: n }),
          h('td', { class: 'mv-note-cell', text: note }),
        ),
      );
    }
    table.append(body);
    const parts: Node[] = [table];
    if (rx.length > 0) {
      const rt = h('table', { class: 'mv-table mv-rx' });
      rt.append(h('thead', {}, h('tr', {}, h('th', { text: 'Reaction' }), h('th', { text: 'True rate (this phase)' }), h('th', { class: 'mv-num', text: 'Played' }), h('th', { text: '' }))));
      const rb = h('tbody');
      for (const r of rx) {
        const [eq, kind, truth, how, count, can, id] = r.split('\u0001');
        const btn = h('button', { class: 'seg-btn mv-replay', type: 'button', title: can === '1' ? 'Play this reaction again in the middle of the box' : 'This reaction cannot be played in this view', 'aria-label': `Replay ${eq}`, text: '▶' });
        btn.dataset.row = id;
        btn.disabled = can !== '1';
        rb.append(
          h(
            'tr',
            {},
            h('td', {}, h('span', { class: 'c-formula', text: eq }), h('span', { class: 'c-name', text: kind })),
            h('td', {}, h('span', { text: truth }), h('span', { class: 'mv-note-cell', text: ` ${how}` })),
            h('td', { class: 'mv-num', text: count }),
            h('td', {}, btn),
          ),
        );
      }
      rt.append(rb);
      const more = this.rows.length - rx.length;
      parts.push(h('p', { class: 'hint-line mv-rx-title', text: `Reactions in this phase (true rates; the box plays them enriched)${more > 0 ? `, the ${rx.length} fastest of ${this.rows.length}` : ''}` }), rt);
    }
    const nonSurface = this.phaseSet.solids.filter((s) => !this.lattices.get(s.id));
    if (nonSurface.length > 0) {
      parts.push(h('p', { class: 'hint-line', text: `Solids without a lattice the engine can describe (molecular solids): ${nonSurface.map((s) => prettyFormula(s.formula || s.id)).join(', ')}.` }));
    }
    this.legend.replaceChildren(...parts);
  }
}
