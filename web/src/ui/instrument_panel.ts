// Right panel, instrument mode: a clicked bench instrument with its live readout, history chart and the data it collected
// (spectra, peak tables, electrode reactions). The controls are NOT here: they are knobs, switches and buttons on the 3D
// instrument itself (see bench/controls3d.ts and app/instrument_controls.ts). DOM is built once per selection; a 10 Hz
// tick only updates text and redraws charts, so nothing is rebuilt under the pointer.
import type { BenchInstruments, InstrumentId } from '../bench/scene';
import { Lab } from '../app/lab';
import type { ChannelId, InstrumentKey, InstrumentLog } from '../app/instrument_log';
import { drawSeriesChart, ChartLine } from './series_chart';
import { h, setText, fmtClock, prettyFormula } from './dom';
import { icon } from './icons';
import type { SpectrumScanResult } from '../equipment/spectrophotometer';
import type { NmrSpectrumResult } from '../equipment/nmr';
import type { MassSpectrumResult } from '../equipment/mass_spec';
import { drawUvVisChart, NmrChart, drawMsSpectrum, drawChromatogram } from './analytical_charts';

export interface InstrumentPanelDeps {
  lab: Lab;
  instruments: () => BenchInstruments;
  /** Vessel standing on the balance pan, if any. */
  panVesselId: () => string | null;
  log: InstrumentLog;
  /** Current simulation time, s (the log's clock). */
  simTime: () => number;
  onClose: () => void;
}

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
  mass_spec: 'GC/MS (EI / ESI)',
};

/** One line pointing at the physical controls (the panel has none). */
const CONTROL_HINTS: Partial<Record<InstrumentId, string>> = {
  hotplate: 'Controls are on the instrument: turn the HEAT knob, flip STIR. Stand a vessel on the plate first.',
  balance: 'Press the TARE key on the balance (or T).',
  burner: 'Open the gas tap at the end of the hose to light it; turn the air collar for a blue or yellow flame; drag the wire loop into a vessel and then into the flame for a flame test (a click tests the selected vessel).',
  electrochem: 'Click a vessel, then use the console: DIP the electrodes, set V / I and the electrodes, switch OUTPUT on. BRIDGE links a second vessel.',
  spectrophotometer: 'Click the pure-solvent vessel and press BLANK, then click the sample, turn the WAVELENGTH knob and press SCAN.',
  nmr: 'Click the vessel, set nucleus / solvent / scans on the console, press LIFT to load the tube, ACQUIRE to record.',
  mass_spec: 'Click the vessel, choose the SOURCE (EI / ESI+ / ESI−), press LOAD for a vial, INJECT to run.',
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
const LOG_EVENT_INSTRUMENTS = new Set<InstrumentId>(['hotplate', 'balance', 'phmeter', 'thermometer', 'gauge', 'burner']);

export class InstrumentPanel {
  public readonly el: HTMLElement;
  private id: InstrumentId | null = null;
  private content: HTMLElement;
  private timer = 0;

  // live refs (rebuilt per selection)
  private sub!: HTMLElement;
  private vals: Record<string, HTMLElement> = {};
  private labels: Record<string, HTMLElement> = {};
  private status?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private statMin?: HTMLElement;
  private statMax?: HTMLElement;
  private eventsSec?: HTMLElement;
  private eventsList?: HTMLElement;
  private lastEventKey = '';

  private ecReactionsSec?: HTMLElement;
  private specCanvas?: HTMLCanvasElement;
  private specPeaksList?: HTMLElement;
  private lastUvVisScan: SpectrumScanResult | null = null;
  private nmrCanvas?: HTMLCanvasElement;
  private nmrChart?: NmrChart;
  private nmrPeaksList?: HTMLElement;
  private lastNmrResult: NmrSpectrumResult | null = null;
  private msCanvas?: HTMLCanvasElement;
  private msChrom?: HTMLCanvasElement;
  private msChromHits: Array<{ x0: number; x1: number; index: number }> = [];
  private msCompList?: HTMLElement;
  private msPeaksList?: HTMLElement;
  private msNotes?: HTMLElement;
  private msSel = 0;
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
    this.id = id;
    this.el.hidden = !id;
    this.content.innerHTML = '';
    this.vals = {};
    this.labels = {};
    this.status = this.canvas = this.statMin = this.statMax = this.eventsSec = this.eventsList = undefined;
    this.lastEventKey = '';
    this.ecReactionsSec = this.specCanvas = this.specPeaksList = this.nmrCanvas = this.nmrPeaksList = this.msCanvas = this.msPeaksList = this.msChrom = this.msCompList = this.msNotes = undefined;
    this.nmrChart = undefined;
    this.msSel = 0;
    this.msChromHits = [];

    if (!id) return;
    this.build(id);
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 100);
  }

  /** Vessel names may have changed. */
  public vesselsChanged() {
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
      : id === 'burner' ? [['flame', 'Flame'], ['air', 'Air collar']]
      : id === 'electrochem' ? [['volt', 'Voltage'], ['curr', 'Current'], ['res', 'Resistance'], ['emf', 'Open EMF']]
      : id === 'spectrophotometer' ? [['lambda', 'Wavelength'], ['abs', 'Absorbance'], ['trans', '% Transmittance']]
      : id === 'nmr' ? [['field', 'Field / Freq'], ['nuc', 'Nucleus'], ['solvent', 'Solvent'], ['scans', 'Scans']]
      : [['mode', 'Ion Source'], ['vac', 'Manifold Vac'], ['base', 'Base Peak']];
    const ro = h('div', { class: `readouts${cells.length === 1 ? ' readouts-1' : ''}`, role: 'group', 'aria-label': 'Live readings' });
    for (const [key, label] of cells) {
      const val = h('output', { class: 'ro-val', 'aria-live': 'off', text: '—' });
      const lab = h('span', { class: 'ro-label', text: label });
      ro.append(h('div', { class: `ro ro-${key}` }, lab, val));
      this.vals[key] = val;
      this.labels[key] = lab;
    }
    this.content.append(ro);

    const hint = CONTROL_HINTS[id];
    if (hint) this.content.append(h('p', { class: 'hint-line', text: hint }));
    if (id === 'burner' || id === 'nmr' || id === 'mass_spec' || id === 'spectrophotometer') {
      this.status = h('p', { class: 'hint-line' });
      this.content.append(this.status);
    }

    if (id === 'electrochem') this.buildElectrochem();
    else if (id === 'spectrophotometer') this.buildSpectrophotometer();
    else if (id === 'nmr') this.buildNmr();
    else if (id === 'mass_spec') this.buildMassSpec();

    if (id in CHARTS) this.buildHistory(id);
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

  private buildElectrochem() {
    this.ecReactionsSec = h('section', { class: 'vp-sec', 'aria-label': 'Electrode Reactions' });
    this.ecReactionsSec.append(h('h3', { class: 'eyebrow', text: 'Electrode Reactions' }));
    this.content.append(this.ecReactionsSec);
  }

  private buildSpectrophotometer() {
    this.specCanvas = h('canvas', { class: 'plot plot-spec', height: '160', role: 'img', 'aria-label': 'UV-Vis Absorbance Spectrum' }) as HTMLCanvasElement;
    this.content.append(h('section', { class: 'vp-sec', 'aria-label': 'UV-Vis Spectrum' }, h('div', { class: 'plot-wrap' }, this.specCanvas)));
    this.specPeaksList = h('div', { class: 'peak-list' });
    this.content.append(h('section', { class: 'vp-sec', 'aria-label': 'Absorption Peaks' }, h('h3', { class: 'eyebrow', text: 'Detected Absorption Bands' }), this.specPeaksList));
    this.lastUvVisScan = this.deps.instruments().spectrophotometer.getLastScan();
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
    this.nmrCanvas = h('canvas', { class: 'plot plot-spec', height: '230', role: 'img', 'aria-label': '1D FT-NMR Spectrum' }) as HTMLCanvasElement;
    this.nmrChart = new NmrChart(this.nmrCanvas);
    this.content.append(h('section', { class: 'vp-sec', 'aria-label': 'NMR Spectrum' }, h('div', { class: 'plot-wrap' }, this.nmrCanvas)));
    this.nmrPeaksList = h('div', { class: 'peak-list tall' });
    this.content.append(h('section', { class: 'vp-sec', 'aria-label': 'Signals' }, h('h3', { class: 'eyebrow', text: 'Signals' }), this.nmrPeaksList));
    this.lastNmrResult = this.deps.instruments().nmr.getLastSpectrum();
    this.nmrChart.setSpectrum(this.lastNmrResult);
    this.updateNmrPeaksList(this.lastNmrResult);
  }

  private updateNmrPeaksList(res: NmrSpectrumResult | null) {
    if (!this.nmrPeaksList) return;
    this.nmrPeaksList.innerHTML = '';
    if (!res) {
      this.nmrPeaksList.append(h('p', { class: 'muted', text: 'No spectrum yet. Load a tube with LIFT and press ACQUIRE.' }));
      return;
    }
    const is1H = res.nucleus === '1H';
    const table = h('table', { class: 'data-table' });
    table.innerHTML = `<thead><tr><th>δ (ppm)</th><th>Mult.</th><th>${is1H ? 'J (Hz)' : 'J (C–F, Hz)'}</th><th>${is1H ? 'Int. (H)' : 'Int. (C)'}</th><th>Assignment</th><th>S/N</th></tr></thead>`;
    const tbody = h('tbody');
    for (const q of res.signals) {
      const tr = h('tr', { class: q.solvent ? 'dim' : '' });
      const js = q.j_hz.length ? q.j_hz.map((j) => j.toFixed(1)).join(', ') : '';
      const who = q.solvent ? q.species : q.species;
      const label = `${q.assignment}`.replace(/</g, '&lt;');
      tr.innerHTML = `<td><b>${q.ppm.toFixed(is1H ? 2 : 1)}</b></td><td>${q.multiplicity}</td><td>${js}</td><td>${q.solvent && !is1H ? '' : q.integration.toFixed(q.integration < 10 ? 2 : 1)}</td><td><b>${who.replace(/</g, '&lt;')}</b> ${label}</td><td>${q.snr >= 100 ? Math.round(q.snr) : q.snr.toFixed(1)}</td>`;
      tr.addEventListener('mouseenter', () => this.nmrChart?.highlight(q));
      tr.addEventListener('mouseleave', () => this.nmrChart?.highlight(null));
      tr.addEventListener('click', () => {
        const half = Math.max(0.3, (q.ppm_hi - q.ppm_lo) * 2);
        this.nmrChart?.zoomTo(q.ppm - half, q.ppm + half);
      });
      tbody.append(tr);
    }
    table.append(tbody);
    this.nmrPeaksList.append(table);
    if (!res.signals.some((q) => !q.solvent)) this.nmrPeaksList.append(h('p', { class: 'muted', text: 'No sample signals above the noise: only the solvent and reference lines are visible.' }));
    const foot = h('div', { class: 'muted small' });
    const lines: string[] = [];
    for (const n of res.notes) lines.push(n);
    if (res.unobserved.length) lines.push(`Not seen: ${res.unobserved.join(' · ')}`);
    lines.push(`${res.tier}: ${res.method}.`);
    foot.innerHTML = lines.map((l) => `<p>${l.replace(/</g, '&lt;')}</p>`).join('');
    this.nmrPeaksList.append(foot);
  }

  private buildMassSpec() {
    this.msChrom = h('canvas', { class: 'plot plot-spec', height: '150', role: 'img', 'aria-label': 'Total ion chromatogram' }) as HTMLCanvasElement;
    this.msChrom.addEventListener('click', (e) => {
      const hit = this.msChromHits.find((b) => e.offsetX >= b.x0 && e.offsetX <= b.x1);
      if (hit) this.selectMsComponent(hit.index);
    });
    this.content.append(h('section', { class: 'vp-sec', 'aria-label': 'Chromatogram', hidden: true }, h('div', { class: 'plot-wrap' }, this.msChrom)));
    this.msCompList = h('div', { class: 'ms-comps' });
    this.content.append(h('section', { class: 'vp-sec', 'aria-label': 'Components' }, h('h3', { class: 'eyebrow', text: 'Components' }), this.msCompList));
    this.msCanvas = h('canvas', { class: 'plot plot-spec', height: '190', role: 'img', 'aria-label': 'Mass Spectrum Stick Plot' }) as HTMLCanvasElement;
    this.content.append(h('section', { class: 'vp-sec', 'aria-label': 'Mass Spectrum' }, h('div', { class: 'plot-wrap' }, this.msCanvas)));
    this.msPeaksList = h('div', { class: 'peak-list tall' });
    this.content.append(h('section', { class: 'vp-sec', 'aria-label': 'm/z Peaks' }, h('h3', { class: 'eyebrow', text: 'Mass peaks (m/z, relative abundance, ion)' }), this.msPeaksList));
    this.msNotes = h('div', { class: 'muted small' });
    this.content.append(h('section', { class: 'vp-sec' }, this.msNotes));
    this.lastMsResult = this.deps.instruments().massSpec.getLastSpectrum();
    this.msSel = 0;
    this.drawMs();
  }

  private selectMsComponent(i: number) {
    this.msSel = i;
    this.drawMs();
  }

  private drawMs() {
    const res = this.lastMsResult;
    if (!this.msCanvas || !this.msPeaksList || !this.msCompList || !this.msChrom || !this.msNotes) return;
    const chromSec = this.msChrom.closest('section') as HTMLElement | null;
    const hasTic = !!res && res.tic.length > 0;
    if (chromSec) chromSec.hidden = !hasTic;
    this.msChromHits = drawChromatogram(this.msChrom, hasTic ? res : null, this.msSel);
    // component buttons
    this.msCompList.innerHTML = '';
    let peaks = res?.summed ?? null;
    let title: string | undefined;
    if (res && res.components.length) {
      const total = res.components.length;
      if (this.msSel >= total) this.msSel = 0;
      res.components.forEach((c, i) => {
        const b = h('button', { class: `ms-comp${i === this.msSel ? ' on' : ''}`, type: 'button', title: c.notes.join('; ') });
        const rt = c.rt_min != null ? `RT ${c.rt_min.toFixed(2)} min · ` : '';
        b.innerHTML = `<b>${prettyFormula(c.formula)}</b> ${c.name.replace(/</g, '&lt;')} <span class="muted">${rt}${c.share_pct.toFixed(c.share_pct < 10 ? 1 : 0)} %</span>`;
        b.addEventListener('click', () => this.selectMsComponent(i));
        this.msCompList!.append(b);
      });
      if (res.mode === 'EI') {
        const c = res.components[this.msSel];
        peaks = c.peaks;
        title = `${c.name} · M ${c.mw.toFixed(2)}${c.rt_min != null ? ` · RT ${c.rt_min.toFixed(2)} min` : ''}`;
      } else {
        title = 'all ions (direct infusion)';
      }
    } else {
      this.msCompList.append(h('p', { class: 'muted', text: res ? 'Nothing ionised or eluted.' : 'No run yet. Press LOAD, then INJECT.' }));
    }
    drawMsSpectrum(this.msCanvas, peaks, title);
    // peak table
    this.msPeaksList.innerHTML = '';
    if (peaks && peaks.length) {
      const table = h('table', { class: 'data-table' });
      table.innerHTML = `<thead><tr><th>m/z</th><th>Rel. %</th><th>Ion</th></tr></thead>`;
      const tbody = h('tbody');
      const shown = [...peaks].sort((a, b) => b.intensity - a.intensity).slice(0, 40).sort((a, b) => a.mz - b.mz);
      for (const p of shown) {
        const tr = h('tr');
        tr.innerHTML = `<td><b>${Number.isInteger(p.mz) ? p.mz : p.mz.toFixed(2)}</b></td><td>${p.intensity.toFixed(p.intensity < 10 ? 1 : 0)}%</td><td>${(p.assignment || (p.molecular ? '[M]⁺' : 'fragment')).replace(/</g, '&lt;')}</td>`;
        tbody.append(tr);
      }
      table.append(tbody);
      this.msPeaksList.append(table);
    } else {
      this.msPeaksList.append(h('p', { class: 'muted', text: res ? 'No ions detected.' : 'No ions yet.' }));
    }
    const lines: string[] = [];
    if (res) {
      for (const n of res.notes) lines.push(n);
      if (res.not_analysed.length) lines.push(`Not analysed: ${res.not_analysed.join(' · ')}`);
      lines.push(`${res.tier}: ${res.method}.`);
    }
    this.msNotes.innerHTML = lines.map((l) => `<p>${l.replace(/</g, '&lt;')}</p>`).join('');
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
      const watts = occ ? lab.ctl(occ).heaterW : 0;
      setText(this.vals.power, watts > 0 ? `${Math.round(ins.hotPlate.heaterWatts)} W` : 'Off');
      const snap = occ ? lab.snapshot(occ) : undefined;
      setText(this.vals.temp, snap ? `${(snap.temperature_k - 273.15).toFixed(1)} °C` : '—');
      const stirring = occ ? lab.ctl(occ).stirring : false;
      setText(this.sub, occ ? `${lab.get(occ)?.name ?? ''}${stirring ? ' • stirring' : ''}` : 'Nothing on the plate');
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
      const b = ins.burner;
      setText(this.vals.flame, b.isActive ? 'On' : 'Off');
      setText(this.vals.air, `${Math.round(b.airOpen * 100)} % open`);
      setText(this.sub, b.isActive ? (b.loopInFlame ? 'Lit • wire loop in the flame' : 'Lit') : 'Gas off');
      if (this.status) {
        setText(this.status, b.flameTestInfo ? `Flame test: ${b.flameTestInfo}` : 'Flame test: click the wire loop to dip it in the selected vessel and hold it in the flame.');
      }
    } else if (id === 'electrochem') {
      const vid = selected;
      const snap = vid ? lab.snapshot(vid) : null;
      const electro = snap?.electrolysis ?? null;
      const spec = vid ? lab.ctl(vid).electrolysis : null;
      const r = safe(() => ins.electrochem.readout(), null);
      const on = !!spec?.on;
      const emf = r ? Math.abs(r.cathode_potential_v - r.anode_potential_v) : 0;
      setText(this.vals.volt, r ? `${r.cell_voltage_v.toFixed(2)} V` : '0.00 V');
      setText(this.vals.curr, r ? (r.current_a >= 1 ? `${r.current_a.toFixed(3)} A` : `${(r.current_a * 1000).toFixed(1)} mA`) : '0.0 mA');
      setText(this.vals.res, r ? `${r.resistance_ohm.toFixed(1)} Ω` : '—');
      setText(this.vals.emf, r ? `${emf.toFixed(2)} V` : '—');
      const vName = vid ? lab.get(vid)?.name ?? 'Vessel' : 'No vessel selected';
      const setpoint = spec ? ` • ${spec.mode === 'current' ? `${spec.value.toFixed(2)} A set` : `${spec.value.toFixed(2)} V set`}` : '';
      setText(this.sub, `${vName} • ${spec ? (on ? 'Powered' : 'Electrodes in, output off') : 'Open-Circuit'}${setpoint}`);

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
      const sp = ins.spectrophotometer;
      const nm = sp.wavelengthNm;
      const reading = sp.readingAt(nm);
      setText(this.vals.lambda, `${nm} nm`);
      setText(this.vals.abs, reading.abs.toFixed(3));
      setText(this.vals.trans, `${reading.trans.toFixed(1)}%`);
      setText(this.sub, sp.sampleName ? `Sample: ${sp.sampleName}` : 'Sample compartment empty');
      if (this.status) setText(this.status, sp.scanning ? 'Scanning 350–750 nm…' : selectedName ? `SCAN will measure: ${selectedName}` : 'Select a vessel to measure.');
      const scan = sp.getLastScan();
      if (scan !== this.lastUvVisScan) {
        this.lastUvVisScan = scan;
        if (this.specCanvas) drawUvVisChart(this.specCanvas, scan);
        this.updateSpecPeaksList(scan);
      }
    } else if (id === 'nmr') {
      const n = ins.nmr;
      setText(this.vals.field, n.nucleus === '1H' ? '9.4 T (400 MHz)' : '9.4 T (100 MHz)');
      setText(this.vals.nuc, n.nucleus === '1H' ? '¹H' : '¹³C');
      setText(this.vals.solvent, n.solvent);
      setText(this.vals.scans, n.scans >= 1000 ? `${n.scans / 1024}k` : String(n.scans));
      const lift = n.lift;
      setText(this.sub, n.sampleName && lift !== 'empty' ? `Tube: ${n.sampleName}${lift === 'ejected' ? ' (ejected)' : ''}` : 'Cryomagnet bore ready (no tube)');
      if (this.status) {
        setText(this.status, n.isAcquiring ? `Acquiring… ${Math.round(n.acquisitionProgress * 100)} %` : lift === 'inserted' ? 'Tube in the magnet: press ACQUIRE.' : 'Press LIFT to load the selected vessel.');
      }
      const res = n.getLastSpectrum();
      if (res !== this.lastNmrResult) {
        this.lastNmrResult = res;
        this.nmrChart?.setSpectrum(res);
        this.updateNmrPeaksList(res);
      }
    } else if (id === 'mass_spec') {
      const m = ins.massSpec;
      setText(this.vals.mode, m.ionization === 'EI' ? 'EI (70 eV)' : m.ionization === 'ESI_POS' ? 'ESI (+)' : 'ESI (−)');
      setText(this.vals.vac, '1.2e-5 Torr');
      const topComp = this.lastMsResult && this.lastMsResult.components.length ? [...this.lastMsResult.components].sort((a, b) => b.share_pct - a.share_pct)[0] : null;
      setText(this.vals.base, topComp ? `m/z ${topComp.base_mz}` : '—');
      setText(this.sub, m.vialLoaded && m.sampleName ? `Vial: ${m.sampleName}` : 'High vacuum OK • Turbopump 60k RPM');
      if (this.status) {
        const ph = m.phaseNow;
        setText(this.status, ph === 'injecting' ? 'Autosampler injecting…' : ph === 'scanning' ? 'Running the GC programme and scanning the quadrupole…' : m.vialLoaded ? 'Vial in the tray: press INJECT.' : 'Press LOAD for the selected vessel.');
      }
      const res = m.getLastSpectrum();
      if (res !== this.lastMsResult) {
        this.lastMsResult = res;
        this.msSel = 0;
        this.drawMs();
      }
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
    if (this.eventsList && this.eventsSec && LOG_EVENT_INSTRUMENTS.has(id)) {
      const evs = log.eventsOf(id as InstrumentKey).slice(-EVENT_ROWS).reverse();
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
