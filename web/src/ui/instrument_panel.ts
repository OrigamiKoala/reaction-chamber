// Right panel, instrument mode: a clicked bench instrument (hot plate, balance, pH meter, thermometer, pressure
// gauge, burner) with its live readout and the controls it really has. DOM is built once per selection; a 10 Hz
// tick only updates text / state so sliders and focus are never disturbed.
import type { BenchInstruments, InstrumentId } from '../bench/scene';
import { Lab } from '../app/lab';
import type { ChannelId, InstrumentLog } from '../app/instrument_log';
import { drawSeriesChart, ChartLine } from './series_chart';
import { h, setText, fmtClock, prettyFormula } from './dom';
import { icon } from './icons';
import { toast } from './toast';
import type { ElectrodeMaterial } from '../equipment/electrochem';
import type { ElectrolysisSpec, ElectroReadout } from '../types/sim';
import type { SimController } from '../sim/sim_controller';
import type { SpectrumScanResult } from '../equipment/spectrophotometer';
import type { NmrNucleus, NmrSolvent, NmrSpectrumResult } from '../equipment/nmr';
import type { MsIonization, MassSpectrumResult } from '../equipment/mass_spec';
import { drawUvVisChart, drawNmrChart, drawMassSpecChart } from './analytical_charts';

export interface InstrumentPanelDeps {
  lab: Lab;
  /** The simulation controller: instruments that measure the liquid (UV-vis, flame test) ask the engine. */
  sim: SimController;
  instruments: () => BenchInstruments;
  /** Vessel standing on the balance pan, if any. */
  panVesselId: () => string | null;
  log: InstrumentLog;
  /** Current simulation time, s (the log's clock). */
  simTime: () => number;
  onClose: () => void;
}

/** Temperature of a typical premixed gas-burner flame (K): a property of the burner, not of any sample (placeholder). */
const BUNSEN_FLAME_K = 2000;

const TITLES: Record<InstrumentId, string> = {
  hotplate: 'Hot plate',
  balance: 'Balance',
  phmeter: 'pH meter',
  thermometer: 'Thermometer',
  gauge: 'Pressure gauge',
  burner: 'Burner',
  electrochem: 'Potentiostat / Galvanostat',
  spectrophotometer: 'UV-Vis Spectrophotometer',
  nmr: 'FT-NMR (400 MHz)',
  mass_spec: 'Mass Spectrometer (EI/ESI)',
};

interface ChartSpec {
  lines: Array<{ ch: ChannelId; color: string; range?: [number, number]; step?: boolean; alpha?: number }>;
  /** Channel whose min / max are listed under the chart (omit for none). */
  stat?: ChannelId;
  fmt: (v: number) => string;
}

const CHARTS: Partial<Record<InstrumentId, ChartSpec>> = {
  hotplate: {
    lines: [
      { ch: 'plate_w', color: '#e9a23b', range: [0, 1000], step: true, alpha: 0.7 },
      { ch: 'plate_temp', color: '#d1495b' },
    ],
    stat: 'plate_temp',
    fmt: (v) => `${v.toFixed(1)} °C`,
  },
  balance: { lines: [{ ch: 'balance', color: '#0f7c86' }], stat: 'balance', fmt: (v) => `${v.toFixed(2)} g` },
  phmeter: { lines: [{ ch: 'ph', color: '#0f7c86', range: [0, 14] }], stat: 'ph', fmt: (v) => v.toFixed(2) },
  thermometer: { lines: [{ ch: 'thermometer', color: '#d1495b' }], stat: 'thermometer', fmt: (v) => `${v.toFixed(1)} °C` },
  gauge: { lines: [{ ch: 'pressure', color: '#6a4fb3' }], stat: 'pressure', fmt: (v) => `${v.toFixed(2)} atm (g)` },
  burner: { lines: [{ ch: 'flame', color: '#e07a2f', range: [0, 1], step: true }], fmt: (v) => String(v) },
};

const EVENT_ROWS = 5;

function run(p: Promise<unknown>, what: string) {
  p.catch((err: unknown) => toast(`Couldn't ${what}: ${err instanceof Error ? err.message : String(err)}`, 'error'));
}

export class InstrumentPanel {
  public readonly el: HTMLElement;
  private id: InstrumentId | null = null;
  private content: HTMLElement;
  private timer = 0;

  // live refs (rebuilt per selection)
  private sub!: HTMLElement;
  private vals: Record<string, HTMLElement> = {};
  private labels: Record<string, HTMLElement> = {};
  private heat?: HTMLInputElement;
  private heatVal?: HTMLElement;
  private heatTimer = 0;
  private stir?: HTMLButtonElement;
  private reason?: HTMLElement;
  private flame?: HTMLButtonElement;
  private tareBtn?: HTMLButtonElement;
  private canvas?: HTMLCanvasElement;
  private statMin?: HTMLElement;
  private statMax?: HTMLElement;
  private eventsSec?: HTMLElement;
  private eventsList?: HTMLElement;
  private lastEventKey = '';
  /** Hot plate occupant the controls were last synced for. */
  private occupant: string | null | undefined = undefined;

  // Electrochem refs
  private ecVesselSel?: HTMLSelectElement;
  private ecBridgeSel?: HTMLSelectElement;
  private ecModeSel?: HTMLSelectElement;
  private ecVoltSlider?: HTMLInputElement;
  private ecVoltVal?: HTMLElement;
  private ecCurrSlider?: HTMLInputElement;
  private ecCurrVal?: HTMLElement;
  private ecAnodeSel?: HTMLSelectElement;
  private ecCathodeSel?: HTMLSelectElement;
  private ecPowerBtn?: HTMLButtonElement;
  private ecReactionsSec?: HTMLElement;

  // Spectrophotometer refs
  private specVesselSel?: HTMLSelectElement;
  private specLambdaSlider?: HTMLInputElement;
  private specLambdaVal?: HTMLElement;
  private specCanvas?: HTMLCanvasElement;
  private specPeaksList?: HTMLElement;
  private lastUvVisScan: SpectrumScanResult | null = null;

  // NMR refs
  private nmrVesselSel?: HTMLSelectElement;
  private nmrNuc1HBtn?: HTMLButtonElement;
  private nmrNuc13CBtn?: HTMLButtonElement;
  private nmrSolventSel?: HTMLSelectElement;
  private nmrScansSel?: HTMLSelectElement;
  private nmrCanvas?: HTMLCanvasElement;
  private nmrPeaksList?: HTMLElement;
  private nmrCurrentNucleus: NmrNucleus = '1H';
  private lastNmrResult: NmrSpectrumResult | null = null;

  // Mass Spec refs
  private msVesselSel?: HTMLSelectElement;
  private msEiBtn?: HTMLButtonElement;
  private msEsiBtn?: HTMLButtonElement;
  private msCanvas?: HTMLCanvasElement;
  private msPeaksList?: HTMLElement;
  private msCurrentIonization: MsIonization = 'EI';
  private lastMsResult: MassSpectrumResult | null = null;

  constructor(private deps: InstrumentPanelDeps) {
    this.el = h('aside', { class: 'panel panel-right', id: 'instrument-panel', 'aria-label': 'Selected instrument', hidden: true });
    this.content = h('div', { class: 'vp' });
    this.el.append(this.content);
  }

  public get instrumentId(): InstrumentId | null {
    return this.id;
  }

  // ------------------------------------------------------------------ selection
  public show(id: InstrumentId | null) {
    window.clearInterval(this.timer);
    window.clearTimeout(this.heatTimer);
    this.id = id;
    this.el.hidden = !id;
    this.content.innerHTML = '';
    this.vals = {};
    this.labels = {};
    this.heat = this.heatVal = this.stir = this.reason = this.flame = this.tareBtn = undefined;
    this.canvas = this.statMin = this.statMax = this.eventsSec = this.eventsList = undefined;
    this.lastEventKey = '';
    this.occupant = undefined;

    this.ecVesselSel = this.ecBridgeSel = this.ecModeSel = this.ecVoltSlider = this.ecVoltVal = undefined;
    this.ecCurrSlider = this.ecCurrVal = this.ecAnodeSel = this.ecCathodeSel = this.ecPowerBtn = this.ecReactionsSec = undefined;
    this.specVesselSel = this.specLambdaSlider = this.specLambdaVal = this.specCanvas = this.specPeaksList = undefined;
    this.nmrVesselSel = this.nmrNuc1HBtn = this.nmrNuc13CBtn = this.nmrSolventSel = this.nmrScansSel = this.nmrCanvas = this.nmrPeaksList = undefined;
    this.msVesselSel = this.msEiBtn = this.msEsiBtn = this.msCanvas = this.msPeaksList = undefined;

    if (!id) return;
    this.build(id);
    this.syncControls();
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 100);
  }

  /** Vessel names may have changed. */
  public vesselsChanged() {
    this.refreshVesselDropdowns();
    if (this.id) this.tick();
  }

  // ------------------------------------------------------------------ build
  private build(id: InstrumentId) {
    const head = h('header', { class: 'vp-head' });
    this.sub = h('div', { class: 'vp-sub' });
    const titles = h('div', { class: 'vp-titles' }, h('h2', { class: 'vp-name', text: TITLES[id] }), this.sub);
    const close = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', title: 'Close (Esc)', html: icon('close', 18) });
    close.addEventListener('click', () => this.deps.onClose());
    head.append(titles, h('div', { class: 'vp-actions' }, close));
    this.content.append(head);

    const cells: Array<[string, string]> =
      id === 'hotplate' ? [['power', 'Power'], ['temp', 'Vessel']]
      : id === 'balance' ? [['mass', 'Reading']]
      : id === 'phmeter' ? [['ph', 'pH']]
      : id === 'thermometer' ? [['temp', 'Temp']]
      : id === 'gauge' ? [['press', 'Pressure']]
      : id === 'burner' ? [['flame', 'Flame']]
      : id === 'electrochem' ? [['volt', 'Voltage'], ['curr', 'Current'], ['res', 'Resistance'], ['emf', 'Open EMF']]
      : id === 'spectrophotometer' ? [['lambda', 'Wavelength'], ['abs', 'Absorbance'], ['trans', '% Transmittance']]
      : id === 'nmr' ? [['field', 'Field / Freq'], ['nuc', 'Nucleus'], ['solvent', 'Solvent']]
      : [['mode', 'Ion Mode'], ['vac', 'Manifold Vac'], ['base', 'Base Peak']];
    const ro = h('div', { class: `readouts${cells.length === 1 ? ' readouts-1' : ''}`, role: 'group', 'aria-label': 'Live readings' });
    for (const [key, label] of cells) {
      const val = h('output', { class: 'ro-val', 'aria-live': 'off', text: '—' });
      const lab = h('span', { class: 'ro-label', text: label });
      ro.append(h('div', { class: `ro ro-${key}` }, lab, val));
      this.vals[key] = val;
      this.labels[key] = lab;
    }
    this.content.append(ro);

    if (id === 'hotplate') this.buildHotPlate();
    else if (id === 'balance') this.buildBalance();
    else if (id === 'burner') this.buildBurner();
    else if (id === 'electrochem') this.buildElectrochem();
    else if (id === 'spectrophotometer') this.buildSpectrophotometer();
    else if (id === 'nmr') this.buildNmr();
    else if (id === 'mass_spec') this.buildMassSpec();

    if (id in CHARTS) {
      this.buildHistory(id);
    }
  }

  /** History chart (+ min / max over the window) and the short event list. */
  private buildHistory(id: InstrumentId) {
    const spec = CHARTS[id];
    if (!spec) return;
    this.canvas = h('canvas', { class: 'plot plot-mini', height: '96', role: 'img', 'aria-label': `${TITLES[id]} history` });
    const sec = h('section', { class: 'vp-sec', 'aria-label': 'History' }, h('div', { class: 'plot-wrap' }, this.canvas));
    if (spec.stat) {
      this.statMin = h('span', { text: '—' });
      this.statMax = h('span', { text: '—' });
      sec.append(h('div', { class: 'stat-row' }, h('span', { class: 'muted', text: 'Min ' }), this.statMin, h('span', { class: 'muted', text: 'Max ' }), this.statMax));
    }
    this.eventsList = h('ol', { class: 'events' });
    this.eventsSec = h('section', { class: 'vp-sec vp-events', hidden: true, 'aria-label': 'Events' }, this.eventsList);
    this.content.append(sec, this.eventsSec);
  }

  private section(...children: Array<Node | null>): HTMLElement {
    const sec = h('section', { class: 'vp-sec', 'aria-label': 'Controls' });
    for (const c of children) if (c) sec.append(c);
    this.content.append(sec);
    return sec;
  }

  private buildHotPlate() {
    const lab = this.deps.lab;
    const row = h('div', { class: 'heat' });
    const label = h('label', { class: 'heat-label', for: 'ip-heat' });
    label.innerHTML = `${icon('heat', 18)}<span>Heat</span>`;
    this.heatVal = h('span', { class: 'heat-val', text: 'Off' });
    this.heat = h('input', { id: 'ip-heat', class: 'range', type: 'range', min: '0', max: '1000', step: '50', value: '0' });
    this.heat.addEventListener('input', () => {
      const id = lab.hotPlateVesselId();
      const w = Number(this.heat!.value);
      this.paintHeat(w);
      window.clearTimeout(this.heatTimer);
      if (!id) return;
      this.heatTimer = window.setTimeout(() => {
        if (lab.hotPlateVesselId() !== id) return; // lifted off meanwhile
        run(lab.setHeat(id, w), 'set the heat');
      }, 120);
    });
    row.append(label, this.heat, this.heatVal);

    this.stir = h('button', { class: 'toggle', type: 'button', 'aria-pressed': 'false' });
    this.stir.innerHTML = `${icon('stir', 18)}<span>Stir</span>`;
    this.stir.addEventListener('click', () => {
      const id = lab.hotPlateVesselId();
      if (!id) return;
      const on = this.stir!.getAttribute('aria-pressed') !== 'true';
      this.stir!.setAttribute('aria-pressed', String(on));
      lab.setStir(id, on).catch((err: unknown) => {
        this.stir!.setAttribute('aria-pressed', String(!on));
        toast(`Couldn't change stirring: ${err instanceof Error ? err.message : String(err)}`, 'error');
      });
    });
    this.reason = h('p', { class: 'hint-line', text: 'Set a vessel on the plate to heat or stir.' });
    this.section(row, h('div', { class: 'toggle-row toggle-row-auto' }, this.stir), this.reason);
  }

  private buildBalance() {
    this.tareBtn = h('button', { class: 'btn btn-ghost btn-block', type: 'button' });
    this.tareBtn.innerHTML = '<span>Tare (T)</span>';
    this.tareBtn.addEventListener('click', () => this.deps.instruments().balance.tare());
    this.section(this.tareBtn);
  }

  private buildBurner() {
    this.flame = h('button', { class: 'toggle', type: 'button', 'aria-pressed': 'false' });
    this.flame.innerHTML = `${icon('flame', 18)}<span>Flame</span>`;
    this.flame.addEventListener('click', () => {
      const b = this.deps.instruments().burner;
      if (b.isActive) b.extinguish();
      else b.ignite();
      this.tick();
    });
    this.section(h('div', { class: 'toggle-row toggle-row-auto' }, this.flame), h('p', { class: 'hint-line', text: 'Open flame only; it does not heat vessels.' }));

    // Flame test: the colour comes from the engine's emission model (lines and bands of the metals in the sample)
    const sel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.populateVesselOptions(sel, true, 'Clean flame');
    const result = h('p', { class: 'hint-line', text: 'Hold a wire loop dipped in a vessel\'s liquid in the flame.' });
    const test = h('button', { class: 'btn btn-ghost', type: 'button', text: 'Flame test' });
    test.addEventListener('click', () => {
      const b = this.deps.instruments().burner;
      if (!sel.value) {
        b.setFlameTest(null);
        setText(result, 'Clean flame.');
        return;
      }
      if (!b.isActive) b.ignite();
      this.deps.sim.flameTest(sel.value, BUNSEN_FLAME_K).then(
        (r) => {
          b.setFlameTest(r.emitter_rgb, r.metal_share);
          setText(result, r.emitters.length ? `Emission: ${r.emitters.join(', ')}` : 'No emitting metal in this sample: the flame keeps its own colour.');
          this.tick();
        },
        (err) => toast(`Flame test failed: ${err instanceof Error ? err.message : String(err)}`, 'warning')
      );
    });
    this.section(h('div', { class: 'form-row' }, h('label', { class: 'form-label', text: 'Flame-test sample' }), sel), h('div', { class: 'btn-row' }, test), result);
  }

  private populateVesselOptions(select: HTMLSelectElement, allowNone = false, noneLabel = 'None') {
    const prev = select.value;
    select.innerHTML = '';
    if (allowNone) {
      select.append(h('option', { value: '', text: noneLabel }));
    }
    const vessels = this.deps.lab.list();
    for (const v of vessels) {
      select.append(h('option', { value: v.id, text: v.name }));
    }
    if (prev && vessels.some((v) => v.id === prev)) {
      select.value = prev;
    } else if (vessels.length > 0 && !allowNone) {
      const selId = this.deps.lab.selectedId;
      select.value = selId && vessels.some((v) => v.id === selId) ? selId : vessels[0].id;
    }
  }

  private refreshVesselDropdowns() {
    if (this.ecVesselSel) this.populateVesselOptions(this.ecVesselSel, true, 'Detached (No vessel)');
    if (this.ecBridgeSel) this.populateVesselOptions(this.ecBridgeSel, true, 'None (Single Vessel)');
    if (this.specVesselSel) this.populateVesselOptions(this.specVesselSel, true, 'Select sample vessel...');
    if (this.nmrVesselSel) this.populateVesselOptions(this.nmrVesselSel, true, 'Select sample vessel...');
    if (this.msVesselSel) this.populateVesselOptions(this.msVesselSel, true, 'Select sample vial...');
  }

  private buildElectrochem() {
    const lab = this.deps.lab;
    const vessels = lab.list();
    const selVesselId = lab.selectedId && lab.has(lab.selectedId) ? lab.selectedId : (vessels[0]?.id ?? '');

    const vRow = h('div', { class: 'form-row' });
    vRow.append(h('label', { class: 'form-label', text: 'Cell Vessel' }));
    this.ecVesselSel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.populateVesselOptions(this.ecVesselSel, true, 'Detached (No vessel)');
    if (selVesselId) this.ecVesselSel.value = selVesselId;
    vRow.append(this.ecVesselSel);

    const bRow = h('div', { class: 'form-row' });
    bRow.append(h('label', { class: 'form-label', text: 'Salt Bridge To' }));
    this.ecBridgeSel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.populateVesselOptions(this.ecBridgeSel, true, 'None (Single Vessel)');
    bRow.append(this.ecBridgeSel);

    const mRow = h('div', { class: 'form-row' });
    mRow.append(h('label', { class: 'form-label', text: 'Operating Mode' }));
    this.ecModeSel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.ecModeSel.append(
      h('option', { value: 'voltage', text: 'Potentiostatic (Const Voltage)' }),
      h('option', { value: 'current', text: 'Galvanostatic (Const Current)' }),
    );
    mRow.append(this.ecModeSel);

    const voltRow = h('div', { class: 'heat' });
    const voltLabel = h('label', { class: 'heat-label', text: 'Target V' });
    this.ecVoltVal = h('span', { class: 'heat-val', text: '2.50 V' });
    this.ecVoltSlider = h('input', { class: 'range', type: 'range', min: '0', max: '12', step: '0.05', value: '2.50' }) as HTMLInputElement;
    this.ecVoltSlider.addEventListener('input', () => {
      setText(this.ecVoltVal!, `${Number(this.ecVoltSlider!.value).toFixed(2)} V`);
      this.applyElectrochem();
    });
    voltRow.append(voltLabel, this.ecVoltSlider, this.ecVoltVal);

    const currRow = h('div', { class: 'heat' });
    const currLabel = h('label', { class: 'heat-label', text: 'Limit I' });
    this.ecCurrVal = h('span', { class: 'heat-val', text: '1.00 A' });
    this.ecCurrSlider = h('input', { class: 'range', type: 'range', min: '0.01', max: '5.0', step: '0.05', value: '1.00' }) as HTMLInputElement;
    this.ecCurrSlider.addEventListener('input', () => {
      setText(this.ecCurrVal!, `${Number(this.ecCurrSlider!.value).toFixed(2)} A`);
      this.applyElectrochem();
    });
    currRow.append(currLabel, this.ecCurrSlider, this.ecCurrVal);

    const matRow = h('div', { class: 'form-row form-row-2' });
    const anDiv = h('div', { class: 'form-col' });
    anDiv.append(h('label', { class: 'form-label', text: 'Anode (+)' }));
    this.ecAnodeSel = h('select', { class: 'select' }) as HTMLSelectElement;
    for (const [mat, lbl] of [['Pt', 'Platinum (Pt)'], ['C', 'Graphite (C)'], ['Cu', 'Copper (Cu)'], ['Zn', 'Zinc (Zn)'], ['Ag', 'Silver (Ag)'], ['Fe', 'Iron (Fe)']] as Array<[ElectrodeMaterial, string]>) {
      this.ecAnodeSel.append(h('option', { value: mat, text: lbl }));
    }
    anDiv.append(this.ecAnodeSel);

    const caDiv = h('div', { class: 'form-col' });
    caDiv.append(h('label', { class: 'form-label', text: 'Cathode (-)' }));
    this.ecCathodeSel = h('select', { class: 'select' }) as HTMLSelectElement;
    for (const [mat, lbl] of [['Pt', 'Platinum (Pt)'], ['C', 'Graphite (C)'], ['Cu', 'Copper (Cu)'], ['Zn', 'Zinc (Zn)'], ['Ag', 'Silver (Ag)'], ['Fe', 'Iron (Fe)']] as Array<[ElectrodeMaterial, string]>) {
      this.ecCathodeSel.append(h('option', { value: mat, text: lbl }));
    }
    caDiv.append(this.ecCathodeSel);
    matRow.append(anDiv, caDiv);

    this.ecVesselSel.addEventListener('change', () => this.syncElectroControls());
    this.ecBridgeSel.addEventListener('change', () => this.applyElectrochem());
    this.ecModeSel.addEventListener('change', () => this.applyElectrochem());
    this.ecAnodeSel.addEventListener('change', () => this.applyElectrochem());
    this.ecCathodeSel.addEventListener('change', () => this.applyElectrochem());

    this.ecPowerBtn = h('button', { class: 'toggle', type: 'button', 'aria-pressed': 'false' }) as HTMLButtonElement;
    this.ecPowerBtn.innerHTML = `${icon('heat', 18)}<span>Cell Power</span>`;
    this.ecPowerBtn.addEventListener('click', () => {
      const on = this.ecPowerBtn!.getAttribute('aria-pressed') !== 'true';
      this.ecPowerBtn!.setAttribute('aria-pressed', String(on));
      this.applyElectrochem();
    });

    const removeBtn = h('button', { class: 'btn btn-ghost', type: 'button', text: 'Remove Electrodes' });
    removeBtn.addEventListener('click', () => {
      const vid = this.ecVesselSel?.value;
      if (vid) {
        lab.removeElectrodes(vid);
        this.ecPowerBtn?.setAttribute('aria-pressed', 'false');
      }
    });

    this.section(vRow, bRow, mRow, voltRow, currRow, matRow, h('div', { class: 'toggle-row toggle-row-auto' }, this.ecPowerBtn, removeBtn));

    this.ecReactionsSec = h('section', { class: 'vp-sec', 'aria-label': 'Electrode Reactions' });
    this.ecReactionsSec.append(h('h3', { class: 'eyebrow', text: 'Electrode Reactions' }));
    this.content.append(this.ecReactionsSec);

    this.syncElectroControls();
  }

  private syncElectroControls() {
    const lab = this.deps.lab;
    const vid = this.ecVesselSel?.value;
    if (!vid) {
      this.deps.instruments().electrochem.detach();
      return;
    }
    const ctl = lab.ctl(vid);
    if (ctl.electrolysis) {
      const el = ctl.electrolysis;
      if (this.ecModeSel) this.ecModeSel.value = el.mode;
      if (this.ecAnodeSel) this.ecAnodeSel.value = el.anode.material;
      if (this.ecCathodeSel) this.ecCathodeSel.value = el.cathode.material;
      if (this.ecPowerBtn) this.ecPowerBtn.setAttribute('aria-pressed', String(el.on));
      if (el.mode === 'voltage' && this.ecVoltSlider) {
        this.ecVoltSlider.value = String(el.value);
        if (this.ecVoltVal) setText(this.ecVoltVal, `${el.value.toFixed(2)} V`);
      } else if (el.mode === 'current' && this.ecCurrSlider) {
        this.ecCurrSlider.value = String(el.value);
        if (this.ecCurrVal) setText(this.ecCurrVal, `${el.value.toFixed(2)} A`);
      }
    }
    lab.updateElectroVisuals(vid);
  }

  private applyElectrochem() {
    const lab = this.deps.lab;
    const vid = this.ecVesselSel?.value;
    if (!vid) return;
    const mode = (this.ecModeSel?.value as 'voltage' | 'current') || 'voltage';
    const val = mode === 'current' ? Number(this.ecCurrSlider?.value ?? 1.0) : Number(this.ecVoltSlider?.value ?? 2.5);
    const on = this.ecPowerBtn?.getAttribute('aria-pressed') === 'true';
    const anodeMat = (this.ecAnodeSel?.value as ElectrodeMaterial) || 'Pt';
    const cathodeMat = (this.ecCathodeSel?.value as ElectrodeMaterial) || 'Pt';

    const bridgeTarget = this.ecBridgeSel?.value;
    if (bridgeTarget && bridgeTarget !== vid) {
      run(lab.setGalvanicCell(vid, bridgeTarget, anodeMat, cathodeMat), 'configure galvanic cell');
    } else {
      const spec: ElectrolysisSpec = {
        anode: { material: anodeMat, area_cm2: 6.0 },
        cathode: { material: cathodeMat, area_cm2: 6.0 },
        mode,
        value: val,
        on,
      };
      run(lab.setElectrolysis(vid, spec), 'configure electrolysis');
    }
  }

  private buildSpectrophotometer() {
    const lab = this.deps.lab;
    const ins = this.deps.instruments();

    const vRow = h('div', { class: 'form-row' });
    vRow.append(h('label', { class: 'form-label', text: 'Sample Cuvette' }));
    this.specVesselSel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.populateVesselOptions(this.specVesselSel, true, 'Select sample vessel...');
    vRow.append(this.specVesselSel);

    const btnRow = h('div', { class: 'btn-row' });
    const blankBtn = h('button', { class: 'btn btn-ghost', type: 'button', text: 'Blank (DI H2O)' });
    blankBtn.addEventListener('click', () => {
      this.lastUvVisScan = ins.spectrophotometer.blank();
      if (this.specCanvas) drawUvVisChart(this.specCanvas, this.lastUvVisScan);
      toast('Spectrophotometer blanked (100.0% T, 0.000 Abs)', 'info');
      this.tick();
    });

    const scanBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'Scan Spectrum (350–750 nm)' });
    scanBtn.addEventListener('click', () => {
      const vid = this.specVesselSel?.value;
      if (!vid) {
        toast('Select a vessel containing sample liquid first.', 'warning');
        return;
      }
      const snap = lab.snapshot(vid);
      if (!snap || snap.total_liquid_ml < 0.05) {
        toast('That vessel holds no liquid to scan.', 'warning');
        return;
      }
      const vName = lab.get(vid)?.name ?? 'Sample';
      ins.spectrophotometer.setSample(vName);
      // the scan comes from the engine: the same optical data and models that colour the liquid in the scene
      ins.spectrophotometer.scan(this.deps.sim, vid, vName).then(
        (scan) => {
          this.lastUvVisScan = scan;
          if (this.specCanvas) drawUvVisChart(this.specCanvas, scan);
          this.updateSpecPeaksList(scan);
          this.tick();
        },
        (err) => toast(`Scan failed: ${err instanceof Error ? err.message : String(err)}`, 'warning')
      );
    });
    btnRow.append(blankBtn, scanBtn);

    const lambdaRow = h('div', { class: 'heat' });
    const lambdaLabel = h('label', { class: 'heat-label', text: 'Wavelength' });
    this.specLambdaVal = h('span', { class: 'heat-val', text: '500 nm' });
    this.specLambdaSlider = h('input', { class: 'range', type: 'range', min: '350', max: '750', step: '5', value: '500' }) as HTMLInputElement;
    this.specLambdaSlider.addEventListener('input', () => {
      const nm = Number(this.specLambdaSlider!.value);
      setText(this.specLambdaVal!, `${nm} nm`);
      this.tick();
    });
    lambdaRow.append(lambdaLabel, this.specLambdaSlider, this.specLambdaVal);

    this.section(vRow, btnRow, lambdaRow);

    this.specCanvas = h('canvas', { class: 'plot plot-spec', height: '160', role: 'img', 'aria-label': 'UV-Vis Absorbance Spectrum' }) as HTMLCanvasElement;
    const chartSec = h('section', { class: 'vp-sec', 'aria-label': 'UV-Vis Spectrum' }, h('div', { class: 'plot-wrap' }, this.specCanvas));
    this.content.append(chartSec);

    this.specPeaksList = h('div', { class: 'peak-list' });
    const peakSec = h('section', { class: 'vp-sec', 'aria-label': 'Absorption Peaks' }, h('h3', { class: 'eyebrow', text: 'Detected Absorption Bands' }), this.specPeaksList);
    this.content.append(peakSec);

    this.lastUvVisScan = ins.spectrophotometer.getLastScan();
    drawUvVisChart(this.specCanvas, this.lastUvVisScan);
    this.updateSpecPeaksList(this.lastUvVisScan);
  }

  private updateSpecPeaksList(scan: SpectrumScanResult | null) {
    if (!this.specPeaksList) return;
    this.specPeaksList.innerHTML = '';
    if (!scan || scan.peaks.length === 0) {
      this.specPeaksList.append(h('p', { class: 'muted', text: 'No chromophores / absorption bands detected in range.' }));
      return;
    }
    const table = h('table', { class: 'data-table' });
    table.innerHTML = `<thead><tr><th>Peak λ (nm)</th><th>Absorbance</th><th>Chromophore</th></tr></thead>`;
    const tbody = h('tbody');
    for (const p of scan.peaks) {
      const tr = h('tr');
      const tier = p.tier ? ` <span class="muted" title="${(p.source ?? '').replace(/"/g, '&quot;')}">(${p.tier})</span>` : '';
      tr.innerHTML = `<td><b>${p.lambda} nm</b></td><td>${p.abs.toFixed(3)}</td><td>${p.species ? prettyFormula(p.species) : 'Complex band'}${tier}</td>`;
      tbody.append(tr);
    }
    table.append(tbody);
    this.specPeaksList.append(table);
    if (scan.solvent) this.specPeaksList.append(h('p', { class: 'muted', text: `Measured in a ${scan.solvent} phase. Band data tier and source are shown per peak (hover).` }));
  }

  private buildNmr() {
    const lab = this.deps.lab;
    const ins = this.deps.instruments();

    const vRow = h('div', { class: 'form-row' });
    vRow.append(h('label', { class: 'form-label', text: '5mm NMR Sample Tube' }));
    this.nmrVesselSel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.populateVesselOptions(this.nmrVesselSel, true, 'Select sample vessel...');
    vRow.append(this.nmrVesselSel);

    const nucRow = h('div', { class: 'btn-row' });
    this.nmrNuc1HBtn = h('button', { class: 'btn btn-primary', type: 'button', text: '¹H NMR (400 MHz)' }) as HTMLButtonElement;
    this.nmrNuc13CBtn = h('button', { class: 'btn btn-ghost', type: 'button', text: '¹³C NMR (100 MHz)' }) as HTMLButtonElement;
    this.nmrNuc1HBtn.addEventListener('click', () => {
      this.nmrCurrentNucleus = '1H';
      this.nmrNuc1HBtn!.className = 'btn btn-primary';
      this.nmrNuc13CBtn!.className = 'btn btn-ghost';
      this.tick();
    });
    this.nmrNuc13CBtn.addEventListener('click', () => {
      this.nmrCurrentNucleus = '13C';
      this.nmrNuc13CBtn!.className = 'btn btn-primary';
      this.nmrNuc1HBtn!.className = 'btn btn-ghost';
      this.tick();
    });
    nucRow.append(this.nmrNuc1HBtn, this.nmrNuc13CBtn);

    const optRow = h('div', { class: 'form-row form-row-2' });
    const sCol = h('div', { class: 'form-col' });
    sCol.append(h('label', { class: 'form-label', text: 'Lock Solvent' }));
    this.nmrSolventSel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.nmrSolventSel.append(
      h('option', { value: 'CDCl3', text: 'CDCl3 (δ 7.26)' }),
      h('option', { value: 'D2O', text: 'D2O (δ 4.79)' }),
      h('option', { value: 'DMSO-d6', text: 'DMSO-d6 (δ 2.50)' }),
    );
    sCol.append(this.nmrSolventSel);

    const scCol = h('div', { class: 'form-col' });
    scCol.append(h('label', { class: 'form-label', text: 'Scans' }));
    this.nmrScansSel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.nmrScansSel.append(
      h('option', { value: '8', text: '8 Scans (Fast)' }),
      h('option', { value: '16', text: '16 Scans (Standard)' }),
      h('option', { value: '64', text: '64 Scans (High S/N)' }),
    );
    scCol.append(this.nmrScansSel);
    optRow.append(sCol, scCol);

    const acqBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Pulse & Acquire 1D Spectrum' });
    acqBtn.addEventListener('click', () => {
      const vid = this.nmrVesselSel?.value;
      if (!vid) {
        toast('Select a sample vessel to load into the 400 MHz magnet.', 'warning');
        return;
      }
      const snap = lab.snapshot(vid);
      const vName = lab.get(vid)?.name ?? 'Sample';
      const solvent = (this.nmrSolventSel?.value as NmrSolvent) || 'CDCl3';
      ins.nmr.setSample(vName);
      toast(`FT-NMR 90° RF Pulse applied. Acquiring ${this.nmrCurrentNucleus} FID...`, 'info');
      this.lastNmrResult = ins.nmr.acquire(snap ?? null, vName, this.nmrCurrentNucleus, solvent);
      if (this.nmrCanvas) drawNmrChart(this.nmrCanvas, this.lastNmrResult);
      this.updateNmrPeaksList(this.lastNmrResult);
      this.tick();
    });

    this.section(vRow, nucRow, optRow, acqBtn);

    this.nmrCanvas = h('canvas', { class: 'plot plot-spec', height: '180', role: 'img', 'aria-label': '1D FT-NMR Spectrum' }) as HTMLCanvasElement;
    const chartSec = h('section', { class: 'vp-sec', 'aria-label': 'NMR Spectrum' }, h('div', { class: 'plot-wrap' }, this.nmrCanvas));
    this.content.append(chartSec);

    this.nmrPeaksList = h('div', { class: 'peak-list' });
    const peakSec = h('section', { class: 'vp-sec', 'aria-label': 'Chemical Shifts' }, h('h3', { class: 'eyebrow', text: 'Chemical Shift Table (ppm)' }), this.nmrPeaksList);
    this.content.append(peakSec);

    this.lastNmrResult = ins.nmr.getLastSpectrum();
    drawNmrChart(this.nmrCanvas, this.lastNmrResult);
    this.updateNmrPeaksList(this.lastNmrResult);
  }

  private updateNmrPeaksList(res: NmrSpectrumResult | null) {
    if (!this.nmrPeaksList) return;
    this.nmrPeaksList.innerHTML = '';
    if (!res || res.peaks.length === 0) {
      this.nmrPeaksList.append(h('p', { class: 'muted', text: 'No signals detected. Insert sample and acquire FID.' }));
      return;
    }
    const table = h('table', { class: 'data-table' });
    table.innerHTML = `<thead><tr><th>δ (ppm)</th><th>Mult</th><th>Int</th><th>Group</th></tr></thead>`;
    const tbody = h('tbody');
    for (const p of res.peaks) {
      const tr = h('tr');
      tr.innerHTML = `<td><b>${p.ppm.toFixed(2)}</b></td><td>${p.multiplicity}</td><td>${p.integration.toFixed(1)}</td><td>${p.assignment ?? '—'}</td>`;
      tbody.append(tr);
    }
    table.append(tbody);
    this.nmrPeaksList.append(table);
  }

  private buildMassSpec() {
    const lab = this.deps.lab;
    const ins = this.deps.instruments();

    const vRow = h('div', { class: 'form-row' });
    vRow.append(h('label', { class: 'form-label', text: 'Autosampler Vial' }));
    this.msVesselSel = h('select', { class: 'select' }) as HTMLSelectElement;
    this.populateVesselOptions(this.msVesselSel, true, 'Select sample vial...');
    vRow.append(this.msVesselSel);

    const ionRow = h('div', { class: 'btn-row' });
    this.msEiBtn = h('button', { class: 'btn btn-primary', type: 'button', text: 'EI (70 eV Electron Ionization)' }) as HTMLButtonElement;
    this.msEsiBtn = h('button', { class: 'btn btn-ghost', type: 'button', text: 'ESI (+ Electrospray)' }) as HTMLButtonElement;
    this.msEiBtn.addEventListener('click', () => {
      this.msCurrentIonization = 'EI';
      this.msEiBtn!.className = 'btn btn-primary';
      this.msEsiBtn!.className = 'btn btn-ghost';
      this.tick();
    });
    this.msEsiBtn.addEventListener('click', () => {
      this.msCurrentIonization = 'ESI_POS';
      this.msEsiBtn!.className = 'btn btn-primary';
      this.msEiBtn!.className = 'btn btn-ghost';
      this.tick();
    });
    ionRow.append(this.msEiBtn, this.msEsiBtn);

    const acqBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Inject & Acquire Mass Spectrum' });
    acqBtn.addEventListener('click', () => {
      const vid = this.msVesselSel?.value;
      if (!vid) {
        toast('Select a sample vial to inject into the mass spectrometer.', 'warning');
        return;
      }
      const snap = lab.snapshot(vid);
      const vName = lab.get(vid)?.name ?? 'Sample';
      ins.massSpec.setSample(vName);
      toast(`Sample injected into ${this.msCurrentIonization} source. Mass analyzer scanning m/z 10–500...`, 'info');
      this.lastMsResult = ins.massSpec.acquire(snap ?? null, vName, this.msCurrentIonization);
      if (this.msCanvas) drawMassSpecChart(this.msCanvas, this.lastMsResult);
      this.updateMsPeaksList(this.lastMsResult);
      this.tick();
    });

    this.section(vRow, ionRow, acqBtn);

    this.msCanvas = h('canvas', { class: 'plot plot-spec', height: '180', role: 'img', 'aria-label': 'Mass Spectrum Stick Plot' }) as HTMLCanvasElement;
    const chartSec = h('section', { class: 'vp-sec', 'aria-label': 'Mass Spectrum' }, h('div', { class: 'plot-wrap' }, this.msCanvas));
    this.content.append(chartSec);

    this.msPeaksList = h('div', { class: 'peak-list' });
    const peakSec = h('section', { class: 'vp-sec', 'aria-label': 'm/z Peaks' }, h('h3', { class: 'eyebrow', text: 'Mass Peaks (m/z & Relative Abundance)' }), this.msPeaksList);
    this.content.append(peakSec);

    this.lastMsResult = ins.massSpec.getLastSpectrum();
    drawMassSpecChart(this.msCanvas, this.lastMsResult);
    this.updateMsPeaksList(this.lastMsResult);
  }

  private updateMsPeaksList(res: MassSpectrumResult | null) {
    if (!this.msPeaksList) return;
    this.msPeaksList.innerHTML = '';
    if (!res || res.peaks.length === 0) {
      this.msPeaksList.append(h('p', { class: 'muted', text: 'No ions detected. Inject sample into ionization source.' }));
      return;
    }
    const table = h('table', { class: 'data-table' });
    table.innerHTML = `<thead><tr><th>m/z</th><th>Rel. %</th><th>Ion / Fragment</th></tr></thead>`;
    const tbody = h('tbody');
    for (const p of res.peaks) {
      const tr = h('tr');
      tr.innerHTML = `<td><b>${p.mz}</b></td><td>${p.intensity.toFixed(1)}%</td><td>${p.assignment ?? (p.isMolecularIon ? '[M]⁺' : 'Fragment')}</td>`;
      tbody.append(tr);
    }
    table.append(tbody);
    this.msPeaksList.append(table);
  }

  // ------------------------------------------------------------------ state
  private paintHeat(w: number) {
    if (!this.heat || !this.heatVal) return;
    setText(this.heatVal, w <= 0 ? 'Off' : `${w} W`);
    this.heat.setAttribute('aria-valuetext', w <= 0 ? 'Off' : `${w} watts`);
    this.heat.style.setProperty('--fill', `${(w / 1000) * 100}%`);
    this.heat.classList.toggle('is-hot', w > 0);
  }

  /** Pull the hot plate controls from the lab (selection, occupant change, lifted / displaced vessel). */
  public syncControls() {
    if (this.id === 'electrochem') {
      this.syncElectroControls();
      return;
    }
    if (this.id !== 'hotplate' || !this.heat || !this.stir || !this.reason) return;
    const lab = this.deps.lab;
    const occ = lab.hotPlateVesselId();
    this.occupant = occ;
    const c = occ ? lab.ctl(occ) : null;
    this.heat.disabled = !occ;
    this.stir.disabled = !occ;
    this.reason.hidden = !!occ;
    if (document.activeElement !== this.heat) {
      this.heat.value = String(c?.heaterW ?? 0);
      this.paintHeat(c?.heaterW ?? 0);
    }
    this.stir.setAttribute('aria-pressed', String(!!c?.stirring));
  }

  // ------------------------------------------------------------------ live update (10 Hz)
  private tick() {
    const id = this.id;
    if (!id) return;
    const lab = this.deps.lab;
    const ins = this.deps.instruments();
    const safe = <T>(f: () => T, fb: T): T => {
      try {
        return f();
      } catch {
        return fb;
      }
    };
    const selected = lab.selectedId && lab.has(lab.selectedId) ? lab.selectedId : null;
    const selectedName = selected ? lab.get(selected)?.name ?? null : null;

    if (id === 'hotplate') {
      const occ = lab.hotPlateVesselId();
      if (occ !== this.occupant) this.syncControls();
      const watts = occ ? lab.ctl(occ).heaterW : 0;
      setText(this.vals.power, watts > 0 ? `${Math.round(ins.hotPlate.heaterWatts)} W` : 'Off');
      const snap = occ ? lab.snapshot(occ) : undefined;
      setText(this.vals.temp, snap ? `${(snap.temperature_k - 273.15).toFixed(1)} °C` : '—');
      setText(this.sub, occ ? lab.get(occ)?.name ?? '' : 'Nothing on the plate');
    } else if (id === 'balance') {
      const r = safe(() => ins.balance.readout(), null);
      setText(this.vals.mass, r?.formatted ?? '—');
      setText(this.labels.mass, r?.tared ? 'Net' : 'Reading');
      const pan = this.deps.panVesselId();
      setText(this.sub, pan ? lab.get(pan)?.name ?? '' : 'Nothing on the pan');
    } else if (id === 'phmeter') {
      setText(this.vals.ph, safe(() => ins.phMeter.readout().formatted, '---'));
      setText(this.sub, selectedName ?? 'No vessel selected');
    } else if (id === 'thermometer') {
      setText(this.vals.temp, safe(() => ins.thermometer.readout().formatted, '—'));
      setText(this.sub, selectedName ?? 'No vessel selected');
    } else if (id === 'gauge') {
      const sealed = !!selected && !!lab.snapshot(selected)?.sealed;
      setText(this.vals.press, sealed ? safe(() => ins.pressureGauge.readout().formatted, '—') : '—');
      setText(this.sub, sealed ? selectedName ?? '' : 'No stoppered vessel');
    } else if (id === 'burner') {
      const on = ins.burner.isActive;
      setText(this.vals.flame, on ? 'On' : 'Off');
      setText(this.sub, on ? 'Lit' : 'Off');
      this.flame?.setAttribute('aria-pressed', String(on));
    } else if (id === 'electrochem') {
      const vid = this.ecVesselSel?.value;
      const snap = vid ? lab.snapshot(vid) : null;
      const electro = snap?.electrolysis ?? null;
      const r = safe(() => ins.electrochem.readout(), null);
      const on = this.ecPowerBtn?.getAttribute('aria-pressed') === 'true';

      const emf = r ? Math.abs(r.cathode_potential_v - r.anode_potential_v) : 0;
      setText(this.vals.volt, r ? `${r.cell_voltage_v.toFixed(2)} V` : '0.00 V');
      setText(this.vals.curr, r ? (r.current_a >= 1 ? `${r.current_a.toFixed(3)} A` : `${(r.current_a * 1000).toFixed(1)} mA`) : '0.0 mA');
      setText(this.vals.res, r ? `${r.resistance_ohm.toFixed(1)} Ω` : '—');
      setText(this.vals.emf, r ? `${emf.toFixed(2)} V` : '—');

      const vName = vid ? lab.get(vid)?.name ?? 'Vessel' : 'No vessel connected';
      setText(this.sub, `${vName} • ${on ? 'Powered' : 'Open-Circuit'}`);

      if (this.ecReactionsSec && electro) {
        const reactionsHtml = electro.rows.map((rx) => {
          const isAnode = rx.electrode === 'anode';
          return `<div class="ev" style="margin-bottom: 6px;">
            <span class="ev-kind" style="color: ${isAnode ? '#e05a47' : '#00a8ff'}">${isAnode ? 'Anode (+) Ox' : 'Cathode (-) Red'}:</span>
            <span class="ev-detail">${prettyFormula(rx.equation)}</span>
            <span style="font-family: monospace; font-size: 11px; margin-left: auto;">E°=${rx.e0_v >= 0 ? '+' : ''}${rx.e0_v.toFixed(2)}V</span>
          </div>`;
        }).join('');
        this.ecReactionsSec.innerHTML = `<h3 class="eyebrow">Electrode Reactions (${electro.rows.length})</h3>${reactionsHtml || '<p class="muted">No active redox couple.</p>'}`;
      }
    } else if (id === 'spectrophotometer') {
      const nm = this.specLambdaSlider ? Number(this.specLambdaSlider.value) : 500;
      let abs = 0;
      let trans = 100;
      if (this.lastUvVisScan && this.lastUvVisScan.points.length > 0) {
        const pt = this.lastUvVisScan.points.find((p) => Math.abs(p.lambda - nm) < 3);
        if (pt) {
          abs = pt.absorbance;
          trans = pt.transmittance;
        }
      }
      setText(this.vals.lambda, `${nm} nm`);
      setText(this.vals.abs, abs.toFixed(3));
      setText(this.vals.trans, `${trans.toFixed(1)}%`);
      setText(this.sub, ins.spectrophotometer.sampleName ? `Sample: ${ins.spectrophotometer.sampleName}` : 'Sample compartment empty');
    } else if (id === 'nmr') {
      setText(this.vals.field, this.nmrCurrentNucleus === '1H' ? '9.4 T (400 MHz)' : '9.4 T (100 MHz)');
      setText(this.vals.nuc, this.nmrCurrentNucleus === '1H' ? '¹H' : '¹³C');
      setText(this.vals.solvent, this.nmrSolventSel?.value ?? 'CDCl3');
      setText(this.sub, ins.nmr.sampleName ? `Tube: ${ins.nmr.sampleName}` : 'Cryomagnet bore ready (unlocked)');
    } else if (id === 'mass_spec') {
      setText(this.vals.mode, this.msCurrentIonization === 'EI' ? 'EI (70 eV)' : 'ESI (+)');
      setText(this.vals.vac, '1.2e-5 Torr');
      setText(this.vals.base, this.lastMsResult ? `m/z ${this.lastMsResult.basePeakMz}` : '—');
      setText(this.sub, ins.massSpec.sampleName ? `Vial: ${ins.massSpec.sampleName}` : 'High vacuum OK • Turbopump 60k RPM');
    }
    this.drawHistory(id);
  }

  private drawHistory(id: InstrumentId) {
    if (!this.canvas) return;
    const spec = CHARTS[id];
    if (!spec) return;
    const log = this.deps.log;
    const lines: ChartLine[] = spec.lines.map((l) => ({ series: log.channel(l.ch), color: l.color, range: l.range, step: l.step, alpha: l.alpha }));
    drawSeriesChart(this.canvas, lines, this.deps.simTime());
    if (spec.stat && this.statMin && this.statMax) {
      const st = log.channel(spec.stat).stats();
      setText(this.statMin, st ? spec.fmt(st.min) : '—');
      setText(this.statMax, st ? spec.fmt(st.max) : '—');
    }
    if (this.eventsList && this.eventsSec && (id === 'hotplate' || id === 'balance' || id === 'phmeter' || id === 'thermometer' || id === 'gauge' || id === 'burner')) {
      const evs = log.eventsOf(id).slice(-EVENT_ROWS).reverse();
      const key = `${evs.length}:${evs[0]?.t ?? ''}:${evs[0]?.text ?? ''}`;
      if (key !== this.lastEventKey) {
        this.lastEventKey = key;
        this.eventsSec.hidden = evs.length === 0;
        this.eventsList.innerHTML = '';
        for (const e of evs) {
          this.eventsList.append(h('li', { class: 'ev' }, h('span', { class: 'ev-detail ev-sentence', text: e.text }), h('time', { class: 'ev-t', text: fmtClock(e.t) })));
        }
      }
    }
  }
}
