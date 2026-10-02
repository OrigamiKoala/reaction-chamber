// "Gas" section of the vessel panel: the delivery tube of a stoppered flask (pick the collector it feeds) and the readout
// of a gas collector (gas syringe / gas collection tube / gas jar). Built once per selection; `update` only touches text.
import type { Lab } from '../app/lab';
import type { VesselSnapshot } from '../types/sim';
import { dominantGas, gasName, gasTagText } from '../bench/gas_math';
import { h, setText } from './dom';
import { toast } from './toast';

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class GasSection {
  public readonly el: HTMLElement;
  private mode: 'collector' | 'source' | 'funnel' | 'none';
  private reading!: HTMLElement;
  private readingSub!: HTMLElement;
  private status!: HTMLElement;
  private chips!: HTMLElement;
  private trapped!: HTMLElement;
  private lastKey = '';

  constructor(private lab: Lab, private id: string) {
    this.mode = lab.isCollector(id) ? 'collector' : lab.isFunnel(id) ? 'funnel' : lab.canBeGasSource(id) ? 'source' : 'none';
    this.el = h('section', {
      class: 'vp-sec vp-gas',
      'aria-label': this.mode === 'collector' ? 'Gas collector' : this.mode === 'funnel' ? 'Filtration' : 'Delivery tube',
      hidden: this.mode === 'none',
    });
    if (this.mode === 'collector') this.buildCollector();
    else if (this.mode === 'source') this.buildSource();
    else if (this.mode === 'funnel') this.buildFunnel();
    this.refresh();
  }

  // ------------------------------------------------------------------ collector
  private buildCollector() {
    this.el.append(h('h3', { class: 'eyebrow', text: 'Gas collector' }));
    this.reading = h('output', { class: 'gas-reading', 'aria-live': 'off', text: '0 mL' });
    this.readingSub = h('span', { class: 'muted gas-sub' });
    this.status = h('p', { class: 'hint-line' });
    const clear = h('button', { class: 'btn btn-ghost btn-block', type: 'button', text: 'Empty the collector' });
    clear.addEventListener('click', () => {
      this.lab
        .ventCollector(this.id)
        .then((mol) => toast(mol > 0 ? 'Collector emptied.' : 'The collector was already empty.', 'info'))
        .catch((err) => toast(`Couldn't empty it: ${errMsg(err)}`, 'error'));
    });
    this.el.append(h('div', { class: 'gas-row' }, this.reading, this.readingSub), this.status, clear);
  }

  // ------------------------------------------------------------------ funnel
  private buildFunnel() {
    this.el.append(h('h3', { class: 'eyebrow', text: 'Filtration' }));
    this.status = h('p', { class: 'hint-line' });
    this.chips = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Flasks to filter into' });
    this.el.append(this.status, this.chips);
  }

  private refreshFunnel() {
    const cur = this.lab.filterReceiverOf(this.id);
    const recs = this.lab.list().filter((v) => v.id !== this.id && this.lab.canBeFilterReceiver(v.id));
    const key = `${cur ?? ''}|${recs.map((c) => c.id + c.name).join(',')}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.chips.innerHTML = '';
    if (cur) {
      setText(this.status, `Sitting on ${this.lab.get(cur)?.name ?? 'a flask'}. Pour the mixture into the funnel: the liquid runs through, the solid stays on the paper.`);
      const off = h('button', { class: 'chip', type: 'button', text: 'Lift off the flask' });
      off.addEventListener('click', () => this.lab.disconnectFilter(this.id));
      this.chips.append(off);
    } else if (recs.length === 0) {
      setText(this.status, 'Set out a flask to filter into (a Büchner funnel on a Büchner flask filters under vacuum).');
    } else {
      setText(this.status, 'Set the funnel on:');
      for (const c of recs) {
        const b = h('button', { class: 'chip', type: 'button', text: c.name });
        b.addEventListener('click', () => {
          this.lab.connectFilter(this.id, c.id).catch((err) => toast(errMsg(err), 'warning'));
        });
        this.chips.append(b);
      }
    }
  }

  // ------------------------------------------------------------------ source flask
  private buildSource() {
    this.el.append(h('h3', { class: 'eyebrow', text: 'Delivery tube' }));
    this.status = h('p', { class: 'hint-line' });
    this.chips = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Collectors on the bench' });
    this.trapped = h('p', { class: 'muted gas-trapped', hidden: true });
    this.el.append(this.status, this.chips, this.trapped);
  }

  /** Re-render the collector choices (vessels came or went, a tube was connected). */
  public refresh() {
    if (this.mode === 'collector') {
      const src = this.lab.gasSourceOf(this.id);
      setText(this.status, src ? `Fed by ${this.lab.get(src)?.name ?? 'a flask'}. Drag the tube end to move it.` : 'Not connected. Pick this collector on a stoppered flask, or drag a tube end onto it.');
      return;
    }
    if (this.mode === 'funnel') {
      this.refreshFunnel();
      return;
    }
    if (this.mode !== 'source') return;
    const cur = this.lab.gasCollectorOf(this.id);
    const cols = this.lab.collectors();
    const key = `${cur ?? ''}|${cols.map((c) => c.id + c.name).join(',')}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.chips.innerHTML = '';
    if (cur) {
      setText(this.status, `Stoppered, gas flows to ${this.lab.get(cur)?.name ?? 'the collector'}. Drag the tube end to move it.`);
      const off = h('button', { class: 'chip', type: 'button', text: 'Disconnect tube' });
      off.addEventListener('click', () => {
        this.lab.disconnectGas(this.id).catch((err) => toast(errMsg(err), 'warning'));
      });
      this.chips.append(off);
    } else if (cols.length === 0) {
      setText(this.status, 'Set out a gas syringe, gas collection tube or gas jar (Glassware, Gas) to collect the gas this flask gives off.');
    } else {
      setText(this.status, 'Fit a stopper and a delivery tube that leads the gas into:');
      for (const c of cols) {
        const b = h('button', { class: 'chip', type: 'button', text: c.name });
        b.addEventListener('click', () => {
          this.lab.connectGas(this.id, c.id).catch((err) => toast(errMsg(err), 'warning'));
        });
        this.chips.append(b);
      }
    }
  }

  // ------------------------------------------------------------------ live
  public update(snap: VesselSnapshot) {
    const g = snap.gas;
    if (this.mode === 'collector') {
      if (!g || !g.collector) return;
      const t = gasTagText(g.collector, g.volume_ml, snap.temperature_k, dominantGas(g.species));
      setText(this.reading, t.text.replace('Gas: ', ''));
      const parts = [t.sub];
      if (g.capacity_ml > 0) parts.push(`of ${g.capacity_ml.toFixed(0)} mL`);
      if (g.escaped_mol > 1e-6) parts.push('full: the excess escaped');
      setText(this.readingSub, parts.join(' · '));
      return;
    }
    if (this.mode === 'source' && g) {
      const sp = g.species[0]?.species;
      this.trapped.hidden = !(g.total_mol > 2e-5);
      if (!this.trapped.hidden) {
        setText(this.trapped, `Gas trapped in the flask: ${g.volume_ml.toFixed(0)} mL${sp ? ` (${gasName(sp)})` : ''} · pressure ${snap.pressure_atm.toFixed(2)} atm`);
      }
    }
  }
}
