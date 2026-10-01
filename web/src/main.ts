// Composition root: wires the 3D bench (BenchScene contract), the WASM simulation and the UI panels.
import './style.css';
import { BenchScene } from './bench/scene';
import { SimController } from './sim/sim_controller';
import { BottleState } from './types';
import { importIsSolid } from './pubchem/parser';
import { OpticsTables, ReagentCatalogEntry, VesselSnapshot } from './types/sim';
import { initDataBundle, importCompound } from './pubchem/api';
import { Lab } from './app/lab';
import { knownReagentColor, probeReagentColor } from './app/reagent_colors';
import { ReagentLibrary, ReagentItem, displayName } from './app/reagent_library';
import { TopBar } from './ui/top_bar';
import { ReagentPanel } from './ui/reagent_panel';
import { AddCard } from './ui/add_card';
import { VesselPanel, Readouts, EVENT_LABELS } from './ui/vessel_panel';
import { TimeControls } from './ui/time_controls';
import { AdvancedView } from './ui/advanced_view';
import { CustomReactionModal } from './ui/custom_reaction_modal';
import { BottleCard } from './ui/bottle_card';
import { createHint } from './ui/hint';
import { toast } from './ui/toast';
import { anyModalOpen } from './ui/modal';
import { runSelfTest } from './ui/self_test';
import { h, isTypingTarget } from './ui/dom';

const simWorker = new Worker(new URL('./workers/simulation.worker.ts', import.meta.url), { type: 'module' });

let sessionToken = new URLSearchParams(window.location.search).get('token') || '';

const SHELF_SEED = 8;
const NOTABLE_EVENTS = new Set(['stopper_pop', 'ignition', 'flame_out', 'boil_over', 'dry_out', 'splatter']);
/** Reaction-log events that are worth a toast the first time they happen in a vessel (engine supplies the sentence). */
const REACTION_TOAST_EVENTS = new Set(['precipitate_formed', 'gas_evolved', 'colour_change', 'temperature_change']);

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
  let optics: OpticsTables | null = null;

  // ------------------------------------------------------------------ UI
  const advanced = new AdvancedView();
  const customModal = new CustomReactionModal();
  const bottleCard = new BottleCard();

  const topBar = new TopBar([
    { label: 'Import from PubChem', hint: 'Search box', icon: 'cloud', action: () => reagentPanel.focusSearch() },
    { label: 'Custom chemistry…', icon: 'plus', action: () => customModal.show() },
    { label: 'Run self-test', icon: 'test', action: () => runSelfTest(simWorker, sim, sessionToken) },
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
   * Asks the engine to model an imported compound from its formula (ions, solubility, ...). Compounds it can model
   * become real reacting reagents; the rest stay visual-only with an explanation.
   */
  const modelImported = async (b: BottleState) => {
    try {
      const density = b.userOverrides?.density ?? b.sourcedProperties?.density;
      const model = await sim.importCompound({
        id: b.id,
        name: b.name,
        formula: b.formula,
        smiles: b.smiles || undefined,
        mw: b.mw || undefined,
        density: typeof density === 'number' && isFinite(density) ? density : undefined,
        state: importIsSolid(b) ? 'solid' : b.state === 'gas' ? 'gas' : 'liquid',
        ghs: [],
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
      pressure: safe(() => ins?.pressureGauge?.readout().formatted, snap ? `${(snap.pressure_atm - 1).toFixed(2)} atm (g)` : '—'),
    };
  };

  const vesselPanel = new VesselPanel({
    lab,
    readouts,
    focusVessel: (id) => bench.focusVessel(id),
    openDetails: () => advanced.show(),
  });
  const time = new TimeControls(sim);

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
  const hint = createHint('Search for a reagent on the left or click a bottle on the shelf · drag the bench to look around');
  if (hint) bottom.append(hint);
  bottom.append(time.el);

  app.append(topBar.el, reagentPanel.el, vesselPanel.el, bottom, sheetSwitch);

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
        bench.addBottle(it.bottle);
        shelvedImports.add(it.id);
      }
    } catch (err) {
      console.warn('[Main] shelf placement failed', err);
    }
  };

  const openReagent = (it: ReagentItem) => {
    putOnShelf(it);
    reagentPanel.setCollapsed(false);
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
    // Overrides (density, melting point -> solid/liquid) change how the compound is dosed: re-model it.
    void modelImported(b);
  };

  reagentPanel.onImportPubChem = async (name) => {
    try {
      const rec = await importCompound(name);
      const bottle: BottleState = {
        id: rec.inchi_key ? `pc_${rec.inchi_key.slice(0, 14)}` : `pc_${Date.now()}`,
        cid: rec.cid,
        name: rec.name,
        formula: rec.formula,
        smiles: rec.smiles,
        inchi_key: rec.inchi_key,
        mw: rec.mw,
        sourcedProperties: { mp_c: rec.mp_c, bp_c: rec.bp_c, density: rec.density, solubility: rec.solubility },
        userOverrides: {},
        color: rec.color || '#e8f4fa',
        ghs: rec.ghs || [],
        remainingMl: 500,
        state: rec.physical_state,
      };
      const it0 = lib.addImported(bottle);
      const model = await modelImported(it0.kind === 'imported' ? it0.bottle : bottle);
      const it = lib.get(it0.key) ?? it0;
      openReagent(it);
      if (model?.modelable) toast(`Imported ${rec.name} from PubChem. ${model.reason}.`, 'success');
      else toast(`Imported ${rec.name} from PubChem. It's visual only — ${model?.reason ?? 'no reaction model available'}.`, 'info');
    } catch (err) {
      toast(`Couldn't import “${name}” from PubChem: ${errMsg(err)}`, 'error');
    }
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
    vesselPanel.show(id);
    addCard.setDefaultVessel(id);
    const v = id ? lab.get(id) : undefined;
    advanced.setVessel(id, v?.name ?? '');
    const snap = id ? lab.snapshot(id) : undefined;
    if (snap) {
      advanced.updateSnapshot(snap);
      time.setClock(snap.t_sim_s);
    }
    if (id && !addCard.isOpen) setSheet('vessel');
  };
  lab.onVesselsChanged = () => {
    vesselPanel.vesselsChanged();
    addCard.vesselsChanged();
  };
  lab.onControlsChanged = (id) => {
    if (id === lab.selectedId) vesselPanel.syncControls();
  };

  bench.onSelectObject = (type, id) => {
    if (type === 'vessel') {
      lab.select(id);
      setSheet('vessel');
    } else {
      const it = lib.findByShelfId(id);
      if (it) openReagent(it);
    }
  };
  bench.onDeselect = () => addCard.hide();

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
        g.applyVisual(snap, dt, optics);
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
      const chem = fresh.find((e) => REACTION_TOAST_EVENTS.has(e.kind) && e.detail);
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
      time.setClock(snap.t_sim_s);
    }
    if (addCard.isOpen && now - lastAddCardRefresh > 250) {
      lastAddCardRefresh = now;
      addCard.refresh();
    }
  };

  // ------------------------------------------------------------------ keyboard
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || anyModalOpen()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (topBar.menuOpen) topBar.closeMenu(true);
      else if (addCard.isOpen) addCard.hide();
      else if (advanced.isVisible) advanced.hide();
      else if (!isTypingTarget(e.target)) lab.select(null);
      return;
    }
    if (isTypingTarget(e.target)) return;
    const t = e.target as HTMLElement;
    const onControl = !!t.closest?.('button, a, input, select, textarea, [role="menuitem"], [role="tab"]');
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      advanced.toggle();
    } else if (e.key === ' ' && !onControl) {
      e.preventDefault();
      time.togglePause();
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
    .then((r) => topBar.setServerStatus(r.ok ? 'ok' : 'warn', r.ok ? 'Online' : 'Not running (optional)'))
    .catch(() => topBar.setServerStatus('warn', 'Not running (optional)'));
  if (!sessionToken) {
    fetch('/api/session-token')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.token) sessionToken = d.token;
      })
      .catch(() => {});
  }
  initDataBundle().catch(() => {}); // warms the PubChem fallback bundle

  // ------------------------------------------------------------------ startup data
  setLoading('Loading the chemistry engine…');
  try {
    optics = await withTimeout(sim.getOpticsTables(), 20000, 'Loading optics tables');
    bench.setOpticsTables(optics);
  } catch (err) {
    console.warn('[Main] optics tables unavailable', err);
  }
  setLoading('Stocking the reagent shelf…');
  try {
    lib.setCatalog(await withTimeout(sim.getReagentCatalog(), 20000, 'Loading the reagent catalog'));
  } catch (err) {
    toast(`Couldn't load reagents: ${errMsg(err)}`, 'error');
  }

  // Imported compounds persist in localStorage but the engine is in-memory: re-model them (formula-driven, fast).
  await Promise.all(lib.importedBottles().map((b) => modelImported(b)));

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
