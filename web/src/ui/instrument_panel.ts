// Right panel, instrument mode: a clicked bench instrument (hot plate, balance, pH meter, thermometer, pressure
// gauge, burner) with its live readout and the controls it really has. DOM is built once per selection; a 10 Hz
// tick only updates text / state so sliders and focus are never disturbed.
import type { BenchInstruments, InstrumentId } from '../bench/scene';
import { Lab } from '../app/lab';
import type { ChannelId, InstrumentLog } from '../app/instrument_log';
import { drawSeriesChart, ChartLine } from './series_chart';
import { h, setText, fmtClock } from './dom';
import { icon } from './icons';
import { toast } from './toast';

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
};

interface ChartSpec {
  lines: Array<{ ch: ChannelId; color: string; range?: [number, number]; step?: boolean; alpha?: number }>;
  /** Channel whose min / max are listed under the chart (omit for none). */
  stat?: ChannelId;
  fmt: (v: number) => string;
}

const CHARTS: Record<InstrumentId, ChartSpec> = {
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
    if (!id) return;
    this.build(id);
    this.syncControls();
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
      : [['flame', 'Flame']];
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
    this.buildHistory(id);
  }

  /** History chart (+ min / max over the window) and the short event list. */
  private buildHistory(id: InstrumentId) {
    const spec = CHARTS[id];
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
    }
    this.drawHistory(id);
  }

  private drawHistory(id: InstrumentId) {
    if (!this.canvas) return;
    const log = this.deps.log;
    const spec = CHARTS[id];
    const lines: ChartLine[] = spec.lines.map((l) => ({ series: log.channel(l.ch), color: l.color, range: l.range, step: l.step, alpha: l.alpha }));
    drawSeriesChart(this.canvas, lines, this.deps.simTime());
    if (spec.stat && this.statMin && this.statMax) {
      const st = log.channel(spec.stat).stats();
      setText(this.statMin, st ? spec.fmt(st.min) : '—');
      setText(this.statMax, st ? spec.fmt(st.max) : '—');
    }
    if (this.eventsList && this.eventsSec) {
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
