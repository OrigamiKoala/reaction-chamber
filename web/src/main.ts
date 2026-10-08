// Composition root: wires the 3D bench (BenchScene contract), the WASM simulation and the UI panels.
import './style.css';
import { BENCH_WATER_ID, BenchScene } from './bench/scene';
import { INDICATOR_IDS } from './bench/layout';
import { SimController } from './sim/sim_controller';
import { BottleState, SpeciesRecord } from './types';
import { effectiveThermo, vaporPressurePoints } from './pubchem/parser';
import { parseWaterSolubilityGPerL, srgbHexToLinear } from './pubchem/solubility_parser';
import { OpticsTables, ReagentCatalogEntry, VesselSnapshot } from './types/sim';
import { initDataBundle, importFromHit } from './pubchem/api';
import { Lab } from './app/lab';
import { setSessionToken } from './pubchem/session';
import { knownReagentColor, probeReagentColor, setOpticsDataVersion } from './app/reagent_colors';
import { ReagentLibrary, ReagentItem, displayName, itemPhase, describeModel } from './app/reagent_library';
import { TopBar } from './ui/top_bar';
import { ReagentPanel } from './ui/reagent_panel';
import { AddCard } from './ui/add_card';
import { VesselPanel, Readouts, EVENT_LABELS } from './ui/vessel_panel';
import { InstrumentPanel } from './ui/instrument_panel';
import { InstrumentLog, ChannelId, ChannelReading } from './app/instrument_log';
import type { InstrumentId } from './bench/scene';
import { TimeControls } from './ui/time_controls';
import { AdvancedView } from './ui/advanced_view';
import { CustomReactionModal } from './ui/custom_reaction_modal';
import { BottleCard } from './ui/bottle_card';
import { toast } from './ui/toast';
import { MineralResolver } from './app/mineral_resolver';

import { anyModalOpen } from './ui/modal';
import { runSelfTest } from './ui/self_test';
import { h, isTypingTarget } from './ui/dom';
import { icon } from './ui/icons';
import { LevelTags } from './ui/level_tags';
import { gasTagText, dominantGas } from './bench/gas_math';
import { SETUPS } from './app/setups';
import { setSolidForms } from './equipment/bottle';
import { setElectrodeMaterials } from './equipment/electrochem';
import { registerGasKits } from './app/gas_kit';
import { registerFilterKits } from './app/filter_kit';
import { registerTitrationKits } from './app/titration_kit';
import { registerElectroKits } from './app/electro_kit';
import { wireInstrumentControls } from './app/instrument_controls';
import { TitrationHud } from './ui/titration_hud';
import type { PourState } from './bench/handling';

const simWorker = new Worker(new URL('./workers/simulation.worker.ts', import.meta.url), { type: 'module' });

let sessionToken = new URLSearchParams(window.location.search).get('token') || '';
setSessionToken(sessionToken);
/** The local server (`python3 run.py`), when the app is served by it; the static build has none. */

const SHELF_SEED = 8;
const NOTABLE_EVENTS = new Set(['stopper_pop', 'ignition', 'flame_out', 'boil_over', 'dry_out', 'splatter']);
/** Reaction-log events that are worth a toast the first time they happen in a vessel (engine supplies the sentence). */
const REACTION_TOAST_EVENTS = ['precipitate_formed', 'gas_evolved', 'complex_formed', 'colour_change'];

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function initApp() {
  const app = document.getElementById('app') as HTMLElement;
  const benchContainer = document.getElementById('bench-container') as HTMLElement;
  const loading = document.getElementById('loading') as HTMLElement;
  const loadingDetail = document.getElementById('loading-detail') as HTMLElement;
  const setLoading = (t: string) => (loadingDetail.textContent = t);

  // ------------------------------------------------------------------ core
  const bench = new BenchScene(benchContainer);
  const sim = new SimController(simWorker);
  const lib = new ReagentLibrary();
  const lab = new Lab(bench, sim);
  registerGasKits(); // 'Setups' at the top of the Glassware menu
  registerFilterKits();
  registerTitrationKits(); // titration station + separatory funnel stand
  registerElectroKits(); // electrolysis, electroplating, Daniell galvanic cell
  let optics: OpticsTables | null = null;

  // ------------------------------------------------------------------ UI
  const advanced = new AdvancedView();
  const customModal = new CustomReactionModal();
  const bottleCard = new BottleCard();

  const topBar = new TopBar([
    { label: 'Import from PubChem', hint: 'Search box', icon: 'cloud', action: () => { reagentPanel.showTab('reagents'); reagentPanel.focusSearch(); } },
    { label: 'Custom chemistry…', icon: 'plus', action: () => customModal.show() },
    { label: 'Run self-test', icon: 'test', action: () => runSelfTest(simWorker, sim) },
  ]);
  topBar.onToggleDetails = () => advanced.toggle();
  advanced.onVisibilityChange = (open) => topBar.setDetailsOpen(open);

  const addCard = new AddCard({
    vessels: () => lab.list(),
    freeCapacityMl: (id) => lab.freeCapacityMl(id),
    isBroken: (id) => !!lab.snapshot(id)?.burst,
    catalogMatchFor: (it) => (it.kind === 'imported' ? lib.catalogMatchFor(it.bottle) : undefined),
  });
  const reagentPanel = new ReagentPanel(lib, addCard);

  /**
   * Asks the engine to model an imported compound: every PubChem import is a compound whose phase the engine derives
   * from conditions (vapour-pressure curve, melting point, ...), so this sends the physical data and no state. Compounds
   * the engine can react (salts, known molecules) become reacting reagents, the rest inert-but-physical compounds;
   * only unparseable formulas stay visual-only with an explanation.
   */
  const modelImported = async (b: BottleState) => {
    try {
      const th = effectiveThermo(b);
      const phys = b.physical ?? {};
      // user-typed solubility ("5 g/L") overrides the parsed one
      const solOverride = typeof b.userOverrides?.solubility === 'string' ? parseWaterSolubilityGPerL([b.userOverrides.solubility], b.mw || undefined) : undefined;
      const points = vaporPressurePoints(b);
      const model = await sim.importCompound({
        id: b.id,
        name: b.name,
        formula: b.formula,
        smiles: b.smiles || undefined,
        inchi_key: b.inchi_key || undefined, // identity: built-in molecules and inert compounds are matched / keyed on it
        mw: b.mw || undefined,
        density: th.density,
        state: b.state, // PubChem text hint only: the engine uses it when it has no melting / vapour-pressure data
        ghs: [],
        vapor_pressure_points: points.length > 0 ? points : undefined,
        dh_vap_kj_mol: phys.dh_vap_kj_mol,
        dh_vap_at_k: phys.dh_vap_at_k,
        t_melt_ref_k: th.mp_c !== undefined ? th.mp_c + 273.15 : undefined,
        dh_fus_kj_mol: phys.dh_fus_kj_mol,
        dh_comb_kj_mol: phys.dh_comb_kj_mol,
        solubility_g_per_l: solOverride ?? phys.solubility_g_per_l,
        dh_sol_kj_mol: phys.dh_sol_kj_mol,
        s_j_mol_k: phys.s_j_mol_k,
        cp_j_mol_k: phys.cp_j_mol_k,
        cp_coefficients: phys.cp_coefficients,
        color_linear_rgb: b.sourcedProperties?.known?.color && /^#[0-9a-f]{6}$/i.test(b.color) ? srgbHexToLinear(b.color) : undefined,
        color_meta: phys.colour_meta,
        uv_bands: phys.uv_bands && phys.uv_bands.length > 0 ? phys.uv_bands : undefined,
      });
      lib.setModel(b.id, model);
      return model;
    } catch (err) {
      console.warn('[Main] compound modelling failed', b.name, err);
      return undefined;
    }
  };

  const readouts = (): Readouts => {
    const ins = bench.instruments;
    const snap = lab.selectedId ? lab.snapshot(lab.selectedId) : undefined;
    const safe = (f: () => string | undefined, fb: string) => {
      try {
        return f() ?? fb;
      } catch {
        return fb;
      }
    };
    return {
      temperature: safe(() => ins?.thermometer?.readout().formatted, snap ? `${(snap.temperature_k - 273.15).toFixed(1)} °C` : '—'),
      ph: safe(() => ins?.phMeter?.readout().formatted, snap?.ph != null ? snap.ph.toFixed(2) : '—'),
      mass: safe(() => ins?.balance?.readout().formatted, snap ? `${snap.contents_mass_g.toFixed(2)} g` : '—'),
      pressure: safe(() => ins?.pressureGauge?.readout().formatted, snap ? `${(snap.pressure_atm - (snap.ambient_atm ?? 1)).toFixed(2)} atm (g)` : '—'),
    };
  };

  const vesselPanel = new VesselPanel({
    lab,
    readouts,
    focusVessel: (id) => bench.focusVessel(id),
    openDetails: () => advanced.show(),
  });
  // Instruments: continuous history (sim time) + the right-hand panel shown when one is clicked.
  const instLog = new InstrumentLog();
  const instrumentPanel = new InstrumentPanel({
    lab,
    instruments: () => bench.instruments,
    panVesselId: () => bench.getPanVesselId(),
    log: instLog,
    simTime: () => sim.simTime,
    onClose: () => setInstrument(null),
  });
  /** Instrument mode of the right panel: shows the instrument instead of the vessel panel (null = vessel mode). */
  const setInstrument = (id: InstrumentId | null, focus = true) => {
    if (id === instrumentPanel.instrumentId) return;
    instrumentPanel.show(id);
    vesselPanel.el.hidden = !!id;
    if (id && focus) {
      bench.focusStation(id);
    }
  };
  // knobs, switches and buttons live on the 3D instruments; the right panel keeps the readings, charts and tables
  const instControls = wireInstrumentControls({
    lab,
    sim,
    instruments: () => bench.instruments,
    vesselPosition: (id) => bench.getGlassware(id)?.group.position ?? null,
  });
  bench.onSampleDelivered = (port, id) => {
    instControls.deliver(port, id);
    setInstrument(port === 'uvvis' ? 'spectrophotometer' : port === 'ms' ? 'mass_spec' : 'nmr', false);
  };
  bench.onControlUsed = (id) => setInstrument(id, false);
  topBar.onSelectStation = (station) => {
    if (station === 'bench') {
      bench.focusStation('bench');
      setInstrument(null);
    } else {
      setInstrument(station as InstrumentId);
    }
  };
  const time = new TimeControls(sim);
  // Reaction timer of the selected vessel: waits for a real reaction; Start/Stop/Reset are a manual stopwatch.
  const refreshClock = () => time.setClock(lab.selectedId ? lab.reactionClock(lab.selectedId) : null);
  time.onStart = () => {
    if (lab.selectedId) lab.startReactionClock(lab.selectedId);
    refreshClock();
  };
  time.onStop = () => {
    if (lab.selectedId) lab.stopReactionClock(lab.selectedId);
    refreshClock();
  };
  time.onReset = () => {
    if (lab.selectedId) lab.resetReactionClock(lab.selectedId);
    refreshClock();
  };

  // Mobile: one bottom sheet at a time.
  const sheetSwitch = h('div', { class: 'sheet-switch', role: 'tablist', 'aria-label': 'Panels' });
  const sheetBtns = (['reagents', 'vessel'] as const).map((name) => {
    const b = h('button', { class: 'seg-btn', role: 'tab', type: 'button', 'aria-selected': 'false', text: name === 'reagents' ? 'Reagents' : 'Vessel' });
    b.addEventListener('click', () => setSheet(name));
    sheetSwitch.append(b);
    return b;
  });
  const setSheet = (name: 'reagents' | 'vessel') => {
    app.dataset.sheet = name;
    sheetBtns[0].setAttribute('aria-selected', String(name === 'reagents'));
    sheetBtns[1].setAttribute('aria-selected', String(name === 'vessel'));
  };
  setSheet('reagents');
  reagentPanel.el.addEventListener('panel-expanded', () => setSheet('reagents'));

  const bottom = h('div', { class: 'bottom-dock' });
  bottom.append(time.el);

  app.append(topBar.el, reagentPanel.el, vesselPanel.el, instrumentPanel.el, bottom, sheetSwitch);

  // ------------------------------------------------------------------ reagents
  const shelvedImports = new Set<string>();
  const putOnShelf = (it: ReagentItem) => {
    try {
      if (it.kind === 'catalog') {
        const entry = it.entry;
        bench.addReagentBottle(entry);
        const known = knownReagentColor(entry.id);
        if (known) bench.setBottleContentColor(entry.id, known);
        else
          probeReagentColor(sim, entry, optics).then((hex) => {
            if (hex) bench.setBottleContentColor(entry.id, hex);
          });
      } else if (!shelvedImports.has(it.id)) {
        bench.addBottle(it.bottle, itemPhase(it));
        shelvedImports.add(it.id);
      }
    } catch (err) {
      console.warn('[Main] shelf placement failed', err);
    }
  };

  const openReagent = (it: ReagentItem) => {
    putOnShelf(it);
    bench.pulseBottle(it.id); // highlight the bottle on the shelf: this is the one to pick up
    reagentPanel.setCollapsed(false);
    reagentPanel.showTab('reagents');
    reagentPanel.setSelected(it.key);
    setSheet('reagents');
    addCard.show(it, lab.selectedId);
  };
  reagentPanel.onSelect = openReagent;
  addCard.onClose = () => reagentPanel.setSelected(null);
  addCard.onProperties = (it) => {
    if (it.kind === 'imported') bottleCard.showBottle(it.bottle);
  };
  addCard.onUseCatalog = (entry) => {
    const it = lib.get(`cat:${entry.id}`);
    if (it) openReagent(it);
  };
  addCard.onAdd = async (it, vesselId, amount) => {
    try {
      const result = await lab.addReagent(it, vesselId, amount);
      lib.markUsed(it.key);
      putOnShelf(it);
      if (result === 'visual') toast(`Added ${displayName(it)} — visual only: the engine has no reaction chemistry for this compound.`, 'info');
    } catch (err) {
      toast(`Couldn't add ${displayName(it)}: ${errMsg(err)}`, 'error');
    }
  };
  bottleCard.onAddToVessel = (b) => {
    const it = lib.get(`pc:${b.id}`);
    if (it) openReagent(it);
  };
  bottleCard.onBottleUpdated = (b) => {
    lib.persistImported();
    // Overrides (density, melting / boiling point, solubility) change the compound's phase behaviour: re-model it.
    void modelImported(b);
  };

  /** PubChem record -> bottle in the reagent library (deduped) -> engine reaction model. Used by hand imports and by products formed in the lab. */
  const addImportedRecord = async (rec: SpeciesRecord, extra: Partial<BottleState> = {}) => {
    const bottle: BottleState = {
      id: rec.inchi_key ? `pc_${rec.inchi_key.slice(0, 14)}` : `pc_${Date.now()}`,
      cid: rec.cid,
      name: rec.name,
      formula: rec.formula,
      smiles: rec.smiles,
      inchi_key: rec.inchi_key,
      mw: rec.mw,
      sourcedProperties: { mp_c: rec.mp_c, bp_c: rec.bp_c, density: rec.density, solubility: rec.solubility, known: rec.known },
      physical: rec.physical,
      userOverrides: {},
      color: rec.color || '#e8f4fa',
      ghs: rec.ghs || [],
      remainingMl: 500,
      state: rec.physical_state,
      ...extra,
    };
    const it0 = lib.addImported(bottle);
    const model = await modelImported(it0.kind === 'imported' ? it0.bottle : bottle);
    const item = lib.get(it0.key) ?? it0;
    return { item, model };
  };

  reagentPanel.onImportHit = async (req) => {
    try {
      const rec = await importFromHit(req);
      const { item, model } = await addImportedRecord(rec);
      openReagent(item);
      const from = rec.source ? ` (${rec.source})` : '';
      if (model?.modelable) toast(`Imported ${rec.name}${from}. ${model.phase_model === 'inert' ? describeModel(model) : model.reason}.`, 'success');
      else toast(`Imported ${rec.name}${from}. It's visual only — ${model?.reason ?? 'no reaction model available'}.`, 'info');
    } catch (err) {
      toast(`Couldn't import “${req.name}”: ${errMsg(err)}`, 'error');
    }
  };

  reagentPanel.onSelectGlassware = (id) => lab.select(id);
  reagentPanel.onRemoveGlassware = (id) => {
    lab.remove(id).catch((err) => toast(`Couldn't remove the vessel: ${errMsg(err)}`, 'error'));
  };
  reagentPanel.glassware.onSetup = (id) => {
    const setup = SETUPS.find((s) => s.id === id);
    if (!setup) return;
    setup
      .build(lab)
      .then(() => toast(`${setup.label} is set out. Add a reagent to the flask.`, 'info'))
      .catch((err) => toast(`Couldn't set out ${setup.label}: ${errMsg(err)}`, 'error'));
  };
  reagentPanel.onSpawnGlassware = (type) => {
    lab
      .spawn(type)
      .then((v) => lab.select(v.id))
      .catch((err) => toast(`Couldn't add glassware: ${errMsg(err)}`, 'error'));
  };

  customModal.onRegisterCompound = async (entry: ReagentCatalogEntry) => {
    try {
      await sim.registerCustomCompound(entry);
      let cat = await sim.getReagentCatalog();
      if (!cat.some((e) => e.id === entry.id)) cat = [...cat, entry];
      lib.setCatalog(cat);
      const it = lib.get(`cat:${entry.id}`);
      if (it) openReagent(it);
      toast(`Registered ${entry.name}. Find it in Reagents.`, 'success');
      return true;
    } catch (err) {
      toast(`Couldn't register the compound: ${errMsg(err)}`, 'error');
      return false;
    }
  };
  customModal.onRegisterReaction = async (rxn) => {
    try {
      await sim.registerCustomReaction(rxn);
      toast(`Registered reaction ${rxn.id}.`, 'success');
      return true;
    } catch (err) {
      toast(`Couldn't register the reaction: ${errMsg(err)}`, 'error');
      return false;
    }
  };

  // ------------------------------------------------------------------ selection
  lab.onSelectionChanged = (id) => {
    if (id) setInstrument(null); // picking a vessel leaves instrument mode
    instControls.sync(); // the potentiostat console follows the selected vessel's cell
    reagentPanel.setBench(lab.list(), id);
    vesselPanel.show(id);
    addCard.setDefaultVessel(id);
    const v = id ? lab.get(id) : undefined;
    advanced.setVessel(id, v?.name ?? '');
    const snap = id ? lab.snapshot(id) : undefined;
    if (snap) {
      advanced.updateSnapshot(snap);
    }
    refreshClock();
    if (id && !addCard.isOpen) setSheet('vessel');
  };
  lab.onVesselsChanged = () => {
    reagentPanel.setBench(lab.list(), lab.selectedId);
    vesselPanel.vesselsChanged();
    instrumentPanel.vesselsChanged();
    addCard.vesselsChanged();
  };
  lab.onControlsChanged = (id) => {
    if (id === lab.selectedId) vesselPanel.syncControls();
  };
  lab.onVesselRemoved = (id) => instLog.forgetSource(id);
  bench.onSelectObject = (type, id) => {
    if (type === 'instrument') {
      // The selected vessel stays selected: deselecting it would lift the thermometer / pH probe out of it.
      setInstrument(id as InstrumentId);
      setSheet('vessel');
    } else if (type === 'vessel') {
      lab.select(id);
      setSheet('vessel');
    } else {
      const it = lib.findByShelfId(id);
      if (it) openReagent(it);
    }
  };
  bench.onDeselect = () => {
    addCard.hide();
    setInstrument(null);
  };

  // ------------------------------------------------------------------ manual handling (carry / tilt-to-pour)
  const handHint = h('div', { class: 'hint hand-hint', role: 'status', 'aria-live': 'polite' });
  handHint.innerHTML = `${icon('info', 16)}<span class="hint-text"></span>`;
  const handHintText = handHint.querySelector('.hint-text') as HTMLElement;
  bottom.prepend(handHint);
  bench.onHint = (text) => {
    handHint.classList.toggle('is-on', !!text);
    if (text) handHintText.textContent = text;
  };

  const pourReadout = h('div', { class: 'pour-readout', role: 'status', 'aria-live': 'off' });
  const prRate = h('span', { class: 'pr-rate' });
  const prTotal = h('span', { class: 'pr-total' });
  const prTo = h('span', { class: 'pr-to' });
  pourReadout.append(prRate, prTotal, prTo);
  app.append(pourReadout);
  const fmtPour = (v: number, unit: PourState['unit']) =>
    unit === 'drops' ? v.toFixed(v < 10 && v % 1 !== 0 ? 1 : 0) : unit === 'g' ? v.toFixed(v < 1 ? 3 : 2) : v.toFixed(v < 10 ? 2 : 1);
  bench.onPourState = (st) => {
    pourReadout.classList.toggle('is-on', !!st);
    if (!st) return;
    if (st.readout) {
      // pipetting supplies its own wording (draw / dispense, meniscus vs the mark)
      pourReadout.classList.toggle('is-idle', !st.flowing);
      pourReadout.classList.toggle('is-blocked', !!st.blocked);
      prRate.textContent = st.readout.rate;
      prTotal.textContent = st.readout.total;
      prTo.textContent = st.readout.to;
      return;
    }
    const per = st.unit === 'drops' ? 'drops/s' : `${st.unit}/s`;
    pourReadout.classList.toggle('is-idle', !st.flowing && !st.blocked);
    pourReadout.classList.toggle('is-blocked', !!st.blocked);
    prRate.textContent = st.blocked === 'full' ? 'Target full' : st.blocked === 'empty' ? 'Nothing left' : st.flowing ? `Pouring ${fmtPour(st.rate, st.unit)} ${per}` : 'Tilt further to pour';
    prTotal.textContent = `${fmtPour(st.total, st.unit)} ${st.unit} total`;
    prTo.textContent = `into ${st.targetName}`;
  };
  bench.onNotify = (message, kind) => toast(message, kind === 'warning' ? 'warning' : 'info');
  bench.flowProvider = (src, targetId, form) => {
    if (src.type === 'vessel') return lab.openFlow({ vesselId: src.id }, targetId, form);
    const it = lib.findByShelfId(src.id);
    if (!it) return null;
    const sink = lab.openFlow({ item: it }, targetId, form);
    if (!sink) return null;
    void sink.finished.then(() => {
      if (sink.total <= 0) return;
      lib.markUsed(it.key);
      putOnShelf(it);
      if (sink.visualOnly) toast(`Added ${displayName(it)} — visual only: the engine has no reaction chemistry for this compound.`, 'info');
    });
    return sink;
  };
  bench.onVesselLifted = (id, from) => lab.vesselLifted(id, from);
  bench.onVesselPlaced = (id, place) => lab.vesselPlaced(id, place);
  bench.massProvider = (id) => lab.totalMassG(id);
  // stopcocks (burette, separatory funnel) drain real engine liquid; the stirrer plate stirs the flask standing on it
  bench.drainProvider = (src, target, bottom) => lab.openDrain(src, target, bottom);
  bench.volumeProvider = (id) => lab.volumeMl(id);
  bench.onStirrerToggle = (id, on) => {
    lab.setStir(id, on).then(() => lab.onControlsChanged?.(id)).catch((err) => toast(`Couldn't change the stirrer: ${errMsg(err)}`, 'error'));
  };
  bench.onStirrerVacated = (id) => lab.stirrerVacated(id);
  const stopcockHud = new TitrationHud({ states: () => bench.getStopcockStates(), close: () => bench.closeStopcocks() });
  app.append(stopcockHud.el);
  stopcockHud.start();
  bench.pipetteLab = lab.pipetteLab();
  bench.onGasLink = (src, dst) =>
    void lab
      .connectGas(src, dst)
      .then(() => toast(`Delivery tube connected: ${lab.get(src)?.name ?? 'flask'} → ${lab.get(dst)?.name ?? 'collector'}.`, 'info'))
      .catch((err) => toast(errMsg(err), 'warning'));
  bench.onGasUnlink = (src) => void lab.disconnectGas(src).catch((err) => toast(errMsg(err), 'warning'));

  const levelTags = new LevelTags({
    focusIds: () => bench.getFocusVesselIds(),
    anchor: (id) => bench.getVesselScreenAnchor(id),
    label: (id) => {
      const burette = bench.getVesselTagText(id); // 'Burette reads 12.35 mL' / '(delivered)'
      if (burette) return { text: burette.main, sub: burette.sub };
      // gas collectors: the collected gas, read like the real instrument
      const g = lab.snapshot(id)?.gas;
      if (!g || !g.collector) return null;
      return gasTagText(g.collector, g.volume_ml, lab.snapshot(id)!.temperature_k, dominantGas(g.species));
    },
  });
  benchContainer.append(levelTags.el);
  levelTags.start();

  // ------------------------------------------------------------------ snapshot loop (20 Hz)
  const lastSeen = new Map<string, number>();
  const eventCursor = new Map<string, number>();
  let lastChemToast = 0;
  const burstHandled = new Set<string>();
  let lastAddCardRefresh = 0;

  sim.onSnapshotUpdated = (id: string, engineSnap: VesselSnapshot) => {
    // Engine snapshot + visual-only contents (PubChem imports, dissolving piles) = what the bench and panels show.
    const snap = lab.ingest(id, engineSnap);
    if (!snap) return;
    const now = performance.now();
    const prev = lastSeen.get(id) ?? now - 50;
    lastSeen.set(id, now);
    const dt = Math.min(0.25, Math.max(0.001, (now - prev) / 1000)); // per-vessel dt

    const g = bench.getGlassware(id);
    if (g) {
      try {
        // gas collectors draw their gas (plunger / gas column) instead of liquid layers
        if (!bench.drawGasCollector(id, snap)) g.applyVisual(snap, dt, optics);
      } catch (err) {
        console.warn('[Main] applyVisual failed', err);
      }
    }

    const name = lab.get(id)?.name ?? 'Vessel';
    if (snap.burst && !burstHandled.has(id)) {
      burstHandled.add(id);
      bench.triggerBurst(id);
      toast(`${name} burst — the pressure was too high.`, 'error');
    }

    // Events carry a monotonic `seq` (the engine caps the list); don't replay history on first sight.
    const evs = snap.events ?? [];
    const lastSeq = evs.reduce((m, e) => Math.max(m, e.seq ?? 0), 0);
    const seen = eventCursor.get(id);
    if (seen === undefined) {
      eventCursor.set(id, lastSeq);
    } else if (lastSeq > seen) {
      const fresh = evs.filter((e) => (e.seq ?? 0) > seen);
      const kinds = Array.from(new Set(fresh.filter((e) => NOTABLE_EVENTS.has(e.kind)).map((e) => e.kind)));
      for (const k of kinds) toast(`${name}: ${EVENT_LABELS[k] ?? k}`, k === 'ignition' || k === 'boil_over' ? 'warning' : 'info');
      // Reaction log: toast the first notable chemistry in this addition (one toast per batch, not per tick)
      // (the most telling kind first; steady temperature steps stay in the panel's log, not in toasts)
      let chem: (typeof fresh)[number] | undefined;
      for (const kind of REACTION_TOAST_EVENTS) {
        chem = fresh.find((e) => e.kind === kind && e.detail);
        if (chem) break;
      }
      if (chem && now - lastChemToast > 4000) {
        lastChemToast = now;
        toast(`${name}: ${chem.detail}`, 'info');
      }
      eventCursor.set(id, lastSeq);
    }

    if (id === lab.selectedId) {
      try {
        bench.updateInstruments(snap, dt);
      } catch (err) {
        console.warn('[Main] updateInstruments failed', err);
      }
      vesselPanel.update(snap);
      advanced.updateSnapshot(snap);
      refreshClock();
    }
    if (addCard.isOpen && now - lastAddCardRefresh > 250) {
      lastAddCardRefresh = now;
      addCard.refresh();
    }
  };

  // ------------------------------------------------------------------ instrument history (sim time, 20 Hz, decimated in the log)
  sim.onTick = (t) => {
    try {
      const ins = bench.instruments;
      const sel = lab.selectedId && lab.has(lab.selectedId) ? lab.selectedId : null;
      const selName = sel ? lab.get(sel)?.name ?? null : null;
      const snap = sel ? lab.snapshot(sel) : undefined;
      const sealed = !!snap?.sealed && !snap.burst;
      const occ = lab.hotPlateVesselId();
      const occName = occ ? lab.get(occ)?.name ?? null : null;
      const occSnap = occ ? lab.snapshot(occ) : undefined;
      const pan = bench.getPanVesselId();
      const panName = pan ? lab.get(pan)?.name ?? null : null;
      const watts = Math.round(ins.hotPlate.heaterWatts);
      const readings: Partial<Record<ChannelId, ChannelReading>> = {
        thermometer: { v: sel ? ins.thermometer.readout().temperature_c : null, src: sel, srcLabel: selName },
        ph: { v: sel ? ins.phMeter.readout().ph : null, src: sel, srcLabel: selName },
        pressure: { v: sealed ? ins.pressureGauge.readout().gauge_atm : null, src: sealed ? sel : null, srcLabel: selName },
        balance: { v: ins.balance.readout().mass_g, src: pan, srcLabel: panName },
        plate_w: { v: watts, src: occ, srcLabel: occName },
        plate_temp: { v: occSnap ? occSnap.temperature_k - 273.15 : null, src: occ, srcLabel: occName },
        flame: { v: ins.burner.isActive ? 1 : 0 },
      };
      instLog.record(t, readings);
      instLog.watch('hotplate', 'watts', watts, t, (w) => (w > 0 ? `${w} W` : 'heat off'));
      instLog.watch('hotplate', 'stir', ins.hotPlate.isStirring, t, (on) => (on ? 'stirring' : 'stir off'));
      instLog.watch('hotplate', 'occupant', occ, t, (id) => (id ? `${occName ?? 'vessel'} on the plate` : 'plate cleared'));
      instLog.watch('balance', 'tare', ins.balance.tareCount, t, () => 'tared');
      instLog.watch('balance', 'pan', pan, t, (id) => (id ? `${panName ?? 'vessel'} on the pan` : 'pan cleared'));
      instLog.watch('burner', 'flame', ins.burner.isActive, t, (on) => (on ? 'flame on' : 'flame off'));
    } catch (err) {
      console.warn('[Main] instrument log failed', err);
    }
  };

  // ------------------------------------------------------------------ keyboard
  // WASD / arrow keys walk the camera around the bench (hold Shift to hurry)
  window.addEventListener('keyup', (e) => {
    bench.setMoveKey(e.code, false);
  });
  window.addEventListener('blur', () => bench.clearMoveKeys());
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || anyModalOpen()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // while something is carried the mouse button is down, so stray focus in a text field must not swallow the walking keys
    const typing = isTypingTarget(e.target) && !bench.isHolding();
    // Q / E: camera down / up (also while carrying something, to see the top of a burette)
    if ((e.code === 'KeyQ' || e.code === 'KeyE') && !typing && bench.setMoveKey(e.code, true)) {
      e.preventDefault();
      return;
    }
    // walking also works while carrying a vessel (to take it across the aisle to an analytical instrument)
    if (/^(Key[WASD]|Shift(Left|Right))$/.test(e.code) || (!bench.isHolding() && /^Arrow(Up|Down|Left|Right)$/.test(e.code))) {
      const el = e.target as HTMLElement;
      const isArrow = e.code.startsWith('Arrow');
      const blocked = typing || (isArrow && !!el.closest?.('button, a, select, [role="menuitem"], [role="tab"], [role="slider"]'));
      if (!blocked && bench.setMoveKey(e.code, true)) {
        if (!e.code.startsWith('Shift')) e.preventDefault();
        return;
      }
    }
    if (bench.isHolding() && e.key !== 'Escape') return;
    if (e.key === 'Escape') {
      if (topBar.menuOpen) topBar.closeMenu(true);
      else if (addCard.isOpen) addCard.hide();
      else if (advanced.isVisible) advanced.hide();
      else if (!isTypingTarget(e.target)) {
        if (instrumentPanel.instrumentId) setInstrument(null);
        else lab.select(null);
      }
      return;
    }
    if (isTypingTarget(e.target)) return;
    const t = e.target as HTMLElement;
    const onControl = !!t.closest?.('button, a, input, select, textarea, [role="menuitem"], [role="tab"]');
    if ((e.key === 'i' || e.key === 'I') && !onControl) {
      e.preventDefault();
      advanced.toggle();
    } else if (e.key === ' ' && !onControl) {
      e.preventDefault();
      time.togglePause();
    } else if ((e.key === 't' || e.key === 'T') && !onControl) {
      e.preventDefault();
      bench.instruments?.balance?.tare(); // zero the balance (the TARE key on the 3D balance does the same)
    } else if ((e.key === 'b' || e.key === 'B') && !onControl) {
      e.preventDefault();
      if (!bench.focusTitration()) toast('No burette in the station clamp. Set out the Titration setup first.', 'info');
    } else if ((e.key === 'f' || e.key === 'F') && lab.selectedId) {
      e.preventDefault();
      bench.focusVessel(lab.selectedId);
    } else if (e.key === '/' && !onControl) {
      e.preventDefault();
      reagentPanel.focusSearch();
    }
  });

  // ------------------------------------------------------------------ engine / server status
  simWorker.addEventListener('message', (e) => {
    const { type, payload } = e.data ?? {};
    if (type === 'WASM_READY') topBar.setEngineStatus('ok', 'Ready');
    else if (type === 'WASM_ROUNDTRIP_RESPONSE') topBar.setEngineStatus('ok', `Ready · ${Date.now() - payload.timestamp} ms`);
    else if (type === 'WASM_ERROR') {
      topBar.setEngineStatus('error', 'Failed to load');
      toast('The chemistry engine failed to load. Reload the page to try again.', 'error');
    }
  });
  simWorker.postMessage({ type: 'WASM_ROUNDTRIP', payload: { message: 'Reaction Chamber heartbeat' }, requestId: 'init-ping' });

  fetch('/api/health')
    .then((r) => (r.ok ? r.json() : null))
    .then((h) => {
      if (!h) topBar.setServerStatus('warn', 'Not running (optional)');
      else topBar.setServerStatus('ok', 'Online');
    })
    .catch(() => topBar.setServerStatus('warn', 'Not running (optional)'));
  if (!sessionToken) {
    fetch('/api/session-token')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.token) {
          sessionToken = d.token;
          setSessionToken(sessionToken);
        }
      })
      .catch(() => {});
  }
  initDataBundle().catch(() => {}); // warms the PubChem fallback bundle

  // ------------------------------------------------------------------ startup data
  setLoading('Loading the chemistry engine…');
  try {
    optics = await withTimeout(sim.getOpticsTables(), 20000, 'Loading optics tables');
    bench.setOpticsTables(optics);
    setOpticsDataVersion(optics.data_version);
  } catch (err) {
    console.warn('[Main] optics tables unavailable', err);
  }
  setLoading('Stocking the reagent shelf…');
  try {
    lib.setCatalog(await withTimeout(sim.getReagentCatalog(), 20000, 'Loading the reagent catalog'));
  } catch (err) {
    toast(`Couldn't load reagents: ${errMsg(err)}`, 'error');
  }

  // What the engine knows about the physical form of solid reagents and the look of the electrode metals
  try {
    setSolidForms(await withTimeout(sim.getSolidForms(), 20000, 'Loading solid forms'));
    setElectrodeMaterials(await withTimeout(sim.getElectrodeMaterials(), 20000, 'Loading electrode materials'));
  } catch (err) {
    console.warn('[Main] solid forms / electrode materials unavailable', err);
  }

  // Imported compounds persist in localStorage but the engine is in-memory: re-model them (formula-driven, fast).
  await Promise.all(lib.importedBottles().map((b) => modelImported(b)));

  // The titration setup puts the indicator dropper bottles out on the bench beside the station
  lab.indicatorHandler = () => {
    const entries = lib.catalogEntries().filter((e) => INDICATOR_IDS.includes(e.id));
    for (const id of bench.setOutIndicators(entries)) {
      const entry = entries.find((e) => e.id === id)!;
      const known = knownReagentColor(id);
      if (known) bench.setBottleContentColor(id, known);
      else probeReagentColor(sim, entry, optics).then((hex) => hex && bench.setBottleContentColor(id, hex));
    }
    return entries.map((e) => e.name);
  };

  // Distilled water stands on the bench in view, not on the shelf
  const waterEntry = lib.catalogEntries().find((e) => e.id === BENCH_WATER_ID);
  if (waterEntry) {
    bench.addReagentBottle(waterEntry);
    bench.setBottleContentColor(waterEntry.id, knownReagentColor(waterEntry.id) ?? '#dcecf4');
  }

  // Shelf: recently used first; a few catalog entries for first-time visitors.
  const recent = lib.recentItems();
  const shelf = recent.length ? recent : lib.search('', 'all', SHELF_SEED).items;
  shelf.slice().reverse().forEach(putOnShelf);

  // Default bench: a 250 mL beaker on the hot plate (selected), a cylinder and a flask.
  setLoading('Setting out glassware…');
  try {
    const beaker = await lab.spawn('beaker-250');
    lab.moveToHotPlate(beaker.id);
    await lab.spawn('cylinder-100');
    await lab.spawn('erlenmeyer-250');
    lab.select(beaker.id);
  } catch (err) {
    toast(`Couldn't set out glassware: ${errMsg(err)}`, 'error');
  }

  // Solids with only a rule-of-thumb Ksp get looked up on PubChem and fed back to the engine.
  const minerals = new MineralResolver(sim, (msg, kind) => toast(msg, kind === 'warn' ? 'warning' : 'info'));
  minerals.onProduct = async (rec) => {
    if (lib.has(rec.formula, rec.inchi_key)) return false; // already a reagent (catalog or imported)
    await addImportedRecord(rec, { formedInLab: true });
    return true;
  };
  minerals.start();

  loading.classList.add('is-done');
  window.setTimeout(() => loading.remove(), 400);
}

window.addEventListener('DOMContentLoaded', () => {
  initApp().catch((err) => {
    console.error('[Main] startup failed', err);
    const d = document.getElementById('loading-detail');
    if (d) d.textContent = `Startup failed: ${errMsg(err)}`;
  });
});
