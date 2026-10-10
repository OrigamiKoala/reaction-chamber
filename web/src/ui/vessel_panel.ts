// Right panel: the selected vessel. DOM is built once per selection; each 20 Hz snapshot only
// updates text nodes / attributes so sliders, inputs and keyboard focus are never disturbed.
import { VesselSnapshot, VesselEvent } from '../types/sim';
import { Lab, glasswareSpec } from '../app/lab';
import { formatCapacity } from '../app/glassware_catalog';
import { h, setText, prettyFormula, prettyEquation, fmtConc, fmtAmountMol, fmtClock } from './dom';
import { icon } from './icons';
import { toast } from './toast';
import { GasSection } from './gas_section';
import { MoleculeView } from './molecule_view';

interface TrackedReaction {
  id: string;
  equation: string;
  kind: string;
  rate: number;
  active: boolean;
  lastSimTime: number;
}

export interface Readouts {
  temperature: string;
  ph: string;
  mass: string;
  pressure: string;
}

export interface VesselPanelDeps {
  lab: Lab;
  readouts: () => Readouts;
  focusVessel: (id: string) => void;
  openDetails: () => void;
}

export const EVENT_LABELS: Record<VesselEvent['kind'], string> = {
  burst: 'Vessel burst',
  stopper_pop: 'Stopper popped',
  ignition: 'Ignited',
  flame_out: 'Flame went out',
  boil_over: 'Boiled over',
  splatter: 'Splattered',
  dry_out: 'Boiled dry',
  conservation_warning: 'Conservation warning',
  solver_warning: 'Solver warning',
  precipitate_formed: 'Precipitate',
  solid_dissolved: 'Solid gone',
  gas_evolved: 'Gas',
  colour_change: 'Colour change',
  temperature_change: 'Temperature',
  complex_formed: 'Complex',
};

/** Engine-written sentence kinds (reaction log): the sentence is the whole message, no label needed. */
const LOG_KINDS = new Set<string>(['precipitate_formed', 'solid_dissolved', 'gas_evolved', 'colour_change', 'temperature_change', 'complex_formed']);
const LOG_ROWS = 8;
const SUPERSEDING = new Set<string>(['temperature_change', 'solid_dissolved', 'colour_change']);

function linearToCss(rgb: [number, number, number]): string {
  const g = (c: number) => {
    const x = Math.min(1, Math.max(0, c));
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
  };
  return `rgb(${g(rgb[0])}, ${g(rgb[1])}, ${g(rgb[2])})`;
}

const CONTENT_ROWS = 6;

function run(p: Promise<unknown>, what: string) {
  p.catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    toast(`Couldn't ${what}: ${msg}`, 'error');
  });
}

export class VesselPanel {
  public readonly el: HTMLElement;
  private id: string | null = null;
  private empty: HTMLElement;
  private content: HTMLElement;

  // live refs (rebuilt per selection)
  private r: Record<string, HTMLElement> = {};
  private toggles: Record<'ice' | 'stopper', HTMLButtonElement> = {} as never;
  private igniteBtn!: HTMLButtonElement;
  private contentRows: Array<{ li: HTMLElement; f: HTMLElement; n: HTMLElement; a: HTMLElement }> = [];
  private contentEmpty!: HTMLElement;
  private rxnList!: HTMLElement;
  private eventsList!: HTMLElement;
  private eventsSec!: HTMLElement;
  private lastEventsLen = -1;
  private lastRxnKey = '';
  private lastRxnAt = 0;
  private vesselReactions = new Map<string, Map<string, TrackedReaction>>();
  // Contents list stability: persistent row order (hysteresis), row-count high-water mark, 4 Hz throttle.
  private contentOrder: string[] = [];
  private contentSlots = 0;
  private lastContentsAt = 0;
  private pourTargets!: HTMLElement;
  private pourTarget: string | null = null;
  private pourRange!: HTMLInputElement;
  private pourNum!: HTMLInputElement;
  private pourBtn!: HTMLButtonElement;
  private pourLabel!: HTMLElement;
  private pourBusy = false;
  private pourSec!: HTMLElement;
  private brokenBanner!: HTMLElement;
  private gasSec?: GasSection;
  private readonly mol: MoleculeView;
  private tab: 'vessel' | 'molecules' = 'vessel';
  private tabBtns: Record<'vessel' | 'molecules', HTMLButtonElement> | null = null;
  private vesselTab!: HTMLElement;

  constructor(private deps: VesselPanelDeps) {
    this.el = h('aside', { class: 'panel panel-right', id: 'vessel-panel', 'aria-label': 'Selected vessel' });
    this.mol = new MoleculeView({
      structures: (id, ids) => deps.lab.microStructures(id, ids),
      reactions: (id, phase) => deps.lab.microReactions(id, phase),
      lattice: (id, solid) => deps.lab.microLattice(id, solid),
      snapshot: (id) => deps.lab.snapshot(id),
    });
    this.empty = h('div', { class: 'panel-empty' });
    this.empty.innerHTML = `${icon('beaker', 36)}<p class="empty-title">Click a vessel or instrument on the bench</p><p class="muted">Its readings, contents and controls appear here.</p>`;
    this.content = h('div', { class: 'vp' });
    this.el.append(this.empty, this.content);
    this.show(null);
  }

  public get vesselId(): string | null {
    return this.id;
  }

  // ------------------------------------------------------------------ selection
  public show(id: string | null) {
    this.id = id;
    this.lastEventsLen = -1;
    this.lastRxnKey = '';
    this.lastRxnAt = 0;
    this.contentOrder = [];
    this.contentSlots = 0;
    this.lastContentsAt = 0;
    this.mol.show(id);
    this.tab = 'vessel';
    const v = id ? this.deps.lab.get(id) : undefined;
    this.empty.hidden = !!v;
    this.content.hidden = !v;
    this.el.dataset.empty = String(!v);
    if (!v) return;
    this.build();
    this.syncControls();
    const snap = this.deps.lab.snapshot(v.id);
    if (snap) this.update(snap);
  }

  /** The panel is covered by the instrument panel: the molecular view stops animating while hidden. */
  public setHidden(hidden: boolean) {
    this.el.hidden = hidden;
    this.mol.setActive(!hidden && this.tab === 'molecules' && !!this.id);
  }

  /** Vessel list changed: rename chips etc. without touching the rest. */
  public vesselsChanged() {
    if (!this.id) return;
    if (!this.deps.lab.has(this.id)) {
      this.show(null);
      return;
    }
    this.renderPourTargets();
    this.gasSec?.refresh();
  }

  private build() {
    const lab = this.deps.lab;
    const v = lab.get(this.id!)!;
    const spec = glasswareSpec(v.type);
    this.content.innerHTML = '';
    this.r = {};

    // Header
    const head = h('header', { class: 'vp-head' });
    const titles = h('div', { class: 'vp-titles' }, h('h2', { class: 'vp-name', text: v.name }));
    this.r.sub = h('div', { class: 'vp-sub', text: formatCapacity(spec.capacityMl), title: spec.description });
    titles.append(this.r.sub);
    const focusBtn = h('button', { class: 'icon-btn', 'aria-label': 'Focus camera on this vessel (F)', title: 'Focus camera (F)', html: icon('focus', 18) });
    focusBtn.addEventListener('click', () => this.deps.focusVessel(v.id));
    const removeBtn = h('button', { class: 'icon-btn btn-danger-quiet', 'aria-label': 'Remove vessel from bench', title: 'Remove vessel', html: icon('trash', 18) });
    this.confirmable(removeBtn, 'Remove?', () => run(lab.remove(v.id), 'remove the vessel'));
    head.append(titles, h('div', { class: 'vp-actions' }, focusBtn, removeBtn));

    this.brokenBanner = h('div', { class: 'vp-banner', role: 'alert', hidden: true });
    this.brokenBanner.innerHTML = `${icon('warning', 16)}<span>The glass shattered from over-pressure. Remove it and start again.</span>`;

    // Readouts: the instrument window
    const ro = h('div', { class: 'readouts', role: 'group', 'aria-label': 'Live readings' });
    const cell = (key: string, label: string, unitHint = '') => {
      const c = h('div', { class: `ro ro-${key}` });
      const val = h('output', { class: 'ro-val', 'aria-live': 'off', text: '—' });
      c.append(h('span', { class: 'ro-label', text: label }), val);
      if (unitHint) c.append(h('span', { class: 'ro-unit', text: unitHint }));
      this.r[key] = val;
      this.r[`${key}Cell`] = c;
      ro.append(c);
      return c;
    };
    cell('temp', 'Temp');
    cell('ph', 'pH');
    const volCell = cell('vol', 'Volume');
    const gauge = h('div', { class: 'ro-gauge', 'aria-hidden': 'true' }, h('div', { class: 'ro-gauge-fill' }));
    this.r.gaugeFill = gauge.firstElementChild as HTMLElement;
    volCell.append(gauge);
    cell('mass', 'Balance');
    cell('press', 'Pressure');

    // Reactions (equations & events, right above species)
    this.eventsSec = h('section', { class: 'vp-sec vp-reactions', hidden: true, 'aria-label': 'Reactions' });
    const rxnHead = h('div', { class: 'sec-head' }, h('h3', { class: 'eyebrow', text: 'Reactions' }));
    this.rxnList = h('ul', { class: 'rxn-list', role: 'list' });
    this.eventsList = h('ol', { class: 'events', 'aria-live': 'polite' });
    this.eventsSec.append(rxnHead, this.rxnList, this.eventsList);

    // Controls
    const ctlSec = h('section', { class: 'vp-sec', 'aria-label': 'Controls' });
    ctlSec.append(h('h3', { class: 'eyebrow', text: 'Controls' }));
    const tg = h('div', { class: 'toggle-row toggle-row-auto' });
    const mkToggle = (key: 'ice' | 'stopper', ic: 'ice' | 'stopper', label: string, onToggle: (on: boolean) => Promise<unknown>) => {
      const b = h('button', { class: 'toggle', type: 'button', 'aria-pressed': 'false' });
      b.innerHTML = `${icon(ic, 18)}<span>${label}</span>`;
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        onToggle(on)
          .then(() => this.updateSub())
          .catch((err: unknown) => {
            b.setAttribute('aria-pressed', String(!on));
            toast(`Couldn't change ${label.toLowerCase()}: ${err instanceof Error ? err.message : String(err)}`, 'error');
          });
      });
      this.toggles[key] = b;
      tg.append(b);
    };
    mkToggle('ice', 'ice', 'Ice bath', (on) => lab.setIceBath(v.id, on));
    mkToggle('stopper', 'stopper', 'Stopper', (on) => lab.setSealed(v.id, on));

    this.igniteBtn = h('button', { class: 'btn btn-warm btn-block', type: 'button', hidden: true });
    this.igniteBtn.innerHTML = `${icon('flame', 16)}<span>Ignite with lighter</span>`;
    this.igniteBtn.addEventListener('click', () => run(lab.ignite(v.id), 'ignite'));
    ctlSec.append(tg, this.igniteBtn);

    // Contents
    const conSec = h('section', { class: 'vp-sec', 'aria-label': 'Contents' });
    const conHead = h('div', { class: 'sec-head' }, h('h3', { class: 'eyebrow', text: 'Contents' }));
    const all = h('button', { class: 'link-btn', type: 'button', text: 'Show all in Details' });
    all.addEventListener('click', () => this.deps.openDetails());
    conHead.append(all);
    const ul = h('ul', { class: 'contents', role: 'list' });
    this.contentRows = [];
    for (let i = 0; i < CONTENT_ROWS; i++) {
      const f = h('span', { class: 'c-formula' });
      const n = h('span', { class: 'c-name' });
      const a = h('span', { class: 'c-amt' });
      const li = h('li', { hidden: true }, h('span', { class: 'c-id' }, f, n), a);
      ul.append(li);
      this.contentRows.push({ li, f, n, a });
    }
    this.contentEmpty = h('p', { class: 'muted', text: 'Empty. Pick a reagent on the left to add it.' });
    conSec.append(conHead, ul, this.contentEmpty);

    // Pour
    this.pourSec = h('section', { class: 'vp-sec', 'aria-label': 'Pour into another vessel' });
    this.pourSec.append(
      h('h3', { class: 'eyebrow', text: 'Pour' }),
      h('p', {
        class: 'hint-line',
        text: v.type.startsWith('pipette')
          ? 'Carry the tip into a liquid. Drag up to draw, drag down to dispense; hold Shift for fine control (set the meniscus on the mark).'
          : 'Drag this vessel over another and drag up to tilt it. Release to stop.',
      }),
    );
    this.pourTargets = h('div', { class: 'chip-row', role: 'radiogroup', 'aria-label': 'Pour target' });
    const pourAmt = h('div', { class: 'pour-amt' });
    const pourId = `pour-${v.id}`;
    this.pourRange = h('input', { class: 'range', type: 'range', min: '0', max: '0', step: '1', value: '0', 'aria-label': 'Amount to pour in millilitres' });
    this.pourNum = h('input', { id: pourId, type: 'number', min: '0', step: '1', value: '0', inputmode: 'decimal', 'aria-label': 'Amount to pour (mL)' });
    this.pourRange.addEventListener('input', () => {
      this.pourNum.value = this.pourRange.value;
      this.refreshPour();
    });
    this.pourNum.addEventListener('input', () => {
      this.pourRange.value = this.pourNum.value;
      this.refreshPour();
    });
    const numWrap = h('div', { class: 'num-input num-sm' }, this.pourNum, h('span', { class: 'num-unit', text: 'mL' }));
    pourAmt.append(this.pourRange, numWrap);
    const quick = h('div', { class: 'chip-row chip-row-tight', role: 'group', 'aria-label': 'Pour presets' });
    for (const [label, frac] of [['10 mL', 10], ['25 mL', 25], ['Half', -0.5], ['All', -1]] as Array<[string, number]>) {
      const b = h('button', { class: 'chip', type: 'button', text: label });
      b.addEventListener('click', () => {
        const max = Number(this.pourRange.max);
        const src = this.id ? lab.volumeMl(this.id) : 0;
        const val = frac < 0 ? Math.min(max, src * -frac) : Math.min(max, frac);
        this.setPourValue(val);
      });
      quick.append(b);
    }
    this.pourBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button' });
    this.pourBtn.innerHTML = icon('pour', 16);
    this.pourLabel = h('span', { text: 'Pour' });
    this.pourBtn.append(this.pourLabel);
    this.pourBtn.addEventListener('click', () => this.doPour());
    const emptyBtn = h('button', { class: 'btn btn-ghost btn-block', type: 'button' });
    emptyBtn.innerHTML = `${icon('bucket', 16)}<span>Empty into waste</span>`;
    this.confirmable(emptyBtn, 'Tap again to empty', () =>
      run(lab.empty(v.id).then(() => toast(`Emptied ${v.name}.`, 'success')), 'empty the vessel'),
    );
    const assistPour = h('details', { class: 'assist' }, h('summary', { text: 'Assisted pour' }));
    assistPour.append(h('div', { class: 'assist-body' }, this.pourTargets, pourAmt, quick, this.pourBtn));
    this.pourSec.append(assistPour, emptyBtn);
    this.r.pourEmptyBtn = emptyBtn;

    this.gasSec = new GasSection(lab, v.id);
    this.vesselTab = h('div', { class: 'vp-tab', id: 'vp-tab-vessel', role: 'tabpanel' }, ro, ctlSec, this.eventsSec, conSec, this.pourSec, this.gasSec.el);
    this.mol.el.id = 'vp-tab-molecules';
    this.content.append(head, this.brokenBanner, this.buildTabs(), this.vesselTab, this.mol.el);
    this.showTab('vessel');
    this.renderPourTargets();
    this.updateSub();
  }

  /** `Vessel | Molecules` switch under the header. */
  private buildTabs(): HTMLElement {
    const tabs = h('div', { class: 'seg vp-tabs', role: 'tablist', 'aria-label': 'Vessel view' });
    const mk = (id: 'vessel' | 'molecules', label: string) => {
      const b = h('button', { class: 'seg-btn', type: 'button', role: 'tab', 'aria-controls': `vp-tab-${id}`, 'aria-selected': String(id === this.tab), text: label });
      b.addEventListener('click', () => this.showTab(id));
      tabs.append(b);
      return b;
    };
    this.tabBtns = { vessel: mk('vessel', 'Vessel'), molecules: mk('molecules', 'Molecules') };
    return tabs;
  }

  private showTab(tab: 'vessel' | 'molecules') {
    this.tab = tab;
    this.vesselTab.hidden = tab !== 'vessel';
    for (const [k, b] of Object.entries(this.tabBtns ?? {}) as Array<['vessel' | 'molecules', HTMLButtonElement]>) {
      b.setAttribute('aria-selected', String(k === tab));
      b.tabIndex = k === tab ? 0 : -1;
    }
    this.mol.setActive(tab === 'molecules' && !!this.id);
  }

  /** Two-step destructive buttons: first press arms, second press within 4 s confirms. */
  private confirmable(btn: HTMLButtonElement, armedText: string, action: () => void) {
    let armed = false;
    let timer = 0;
    const original = btn.innerHTML;
    const originalLabel = btn.getAttribute('aria-label');
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        btn.classList.add('is-armed');
        btn.innerHTML = `${icon('warning', 16)}<span>${armedText}</span>`;
        btn.setAttribute('aria-label', `${armedText} Press again to confirm.`);
        timer = window.setTimeout(reset, 4000);
        return;
      }
      reset();
      action();
    });
    const reset = () => {
      armed = false;
      window.clearTimeout(timer);
      btn.classList.remove('is-armed');
      btn.innerHTML = original;
      if (originalLabel) btn.setAttribute('aria-label', originalLabel);
      else btn.removeAttribute('aria-label');
    };
  }

  // ------------------------------------------------------------------ controls state
  /** Pull control state from the lab (selection change, or the ice bath / stopper changed elsewhere). */
  public syncControls() {
    if (!this.id || !this.toggles.ice) return;
    const c = this.deps.lab.ctl(this.id);
    const v = this.deps.lab.get(this.id);
    this.toggles.ice.setAttribute('aria-pressed', String(c.iceBath));
    this.toggles.stopper.setAttribute('aria-pressed', String(!!v?.isSealed));
    this.updateSub();
  }

  private updateSub() {
    if (!this.id || !this.r.sub) return;
    const lab = this.deps.lab;
    const v = lab.get(this.id);
    if (!v) return;
    const parts = [formatCapacity(v.capacityMl)];
    const onPlate = lab.isOnHotPlate(this.id);
    if (onPlate) parts.push('on hot plate');
    if (v.isSealed) parts.push('stoppered');
    if (lab.ctl(this.id).iceBath) parts.push('in ice bath');
    setText(this.r.sub, parts.join(' · '));
  }

  // ------------------------------------------------------------------ live update (20 Hz)
  public update(snap: VesselSnapshot) {
    if (!this.id || this.content.hidden) return;
    const lab = this.deps.lab;
    const v = lab.get(this.id);
    if (!v) return;
    this.gasSec?.update(snap);
    if (this.tab === 'molecules') this.mol.update(snap);
    const ro = this.deps.readouts();

    setText(this.r.temp, ro.temperature);
    setText(this.r.ph, snap.total_liquid_ml > 0.05 ? ro.ph : '—');
    setText(this.r.mass, ro.mass);
    const vol = snap.total_liquid_ml;
    setText(this.r.vol, `${vol < 10 ? vol.toFixed(1) : vol.toFixed(0)} mL`);
    this.r.gaugeFill.style.transform = `scaleY(${Math.min(1, vol / v.capacityMl)})`;
    this.r.volCell.title = `${vol.toFixed(1)} of ${v.capacityMl} mL`;
    this.r.pressCell.hidden = !snap.sealed;
    if (snap.sealed) setText(this.r.press, ro.pressure);

    // Broken
    this.brokenBanner.hidden = !snap.burst;
    this.el.classList.toggle('is-broken', snap.burst);

    // Stopper reflects the engine (a pop unseals)
    const sealedPressed = this.toggles.stopper.getAttribute('aria-pressed') === 'true';
    if (sealedPressed !== snap.sealed) {
      this.toggles.stopper.setAttribute('aria-pressed', String(snap.sealed));
      this.updateSub();
    }

    this.igniteBtn.hidden = !(lab.hasFlammable(this.id) && !snap.flame && !snap.burst);

    this.updateReactions(snap);
    this.updateContents(snap);
    this.refreshPour();
  }

  private updateContents(snap: VesselSnapshot) {
    // Throttle to ~4 Hz: values move slowly and this list must not shimmer at the snapshot rate.
    const now = performance.now();
    if (now - this.lastContentsAt < 250) return;
    this.lastContentsAt = now;

    const live = new Map<string, VesselSnapshot['species'][number]>();
    for (const s of snap.species) {
      if (s.phase === 'gas' || s.id === 'H2O') continue;
      live.set(`${s.id}|${s.phase}`, s);
    }
    // Keep existing rows while above half the entry threshold (hysteresis on appear/disappear).
    const order = this.contentOrder.filter((id) => (live.get(id)?.amount_mol ?? 0) > 5e-10);
    const known = new Set(order);
    const fresh = [...live.values()]
      .filter((s) => !known.has(`${s.id}|${s.phase}`) && s.amount_mol > 1e-9)
      .sort((a, b) => b.amount_mol - a.amount_mol || (a.id < b.id ? -1 : 1));
    for (const s of fresh) order.push(`${s.id}|${s.phase}`);
    // Stable ordering: only swap neighbours when the lower one clearly exceeds the upper (x1.5), so
    // equal/near-equal species (Na+ / Cl-) never flip place from numerical noise.
    const amt = (id: string) => live.get(id)!.amount_mol;
    for (let guard = 0, moved = true; moved && guard < order.length + 2; guard++) {
      moved = false;
      for (let i = 1; i < order.length; i++) {
        if (amt(order[i]) > amt(order[i - 1]) * 1.5) {
          [order[i - 1], order[i]] = [order[i], order[i - 1]];
          moved = true;
        }
      }
    }
    this.contentOrder = order;

    const rows = order.slice(0, CONTENT_ROWS).map((id) => live.get(id)!);
    // Slots only grow within a selection (vanished rows stay as invisible placeholders) so the panel
    // below never jumps up and down.
    this.contentSlots = Math.max(this.contentSlots, rows.length);
    const emptyHidden = snap.total_liquid_ml > 0.01 || this.contentSlots > 0;
    if (this.contentEmpty.hidden !== emptyHidden) this.contentEmpty.hidden = emptyHidden;
    this.contentRows.forEach((row, i) => {
      const s = rows[i];
      const slotHidden = i >= this.contentSlots;
      if (row.li.hidden !== slotHidden) row.li.hidden = slotHidden;
      const ghost = !s && !slotHidden;
      if (row.li.classList.contains('is-ghost') !== ghost) row.li.classList.toggle('is-ghost', ghost);
      if (!s) return;
      const formula = prettyFormula(s.formula || s.id);
      setText(row.f, formula);
      // say where it is when it is not dissolved in the main liquid: a solid on the bottom, or its own liquid layer
      const where = s.phase === 'solid' ? 'solid' : s.phase === 'organic' ? 'organic layer' : '';
      const nm = s.name && s.name !== s.formula && s.name !== s.id ? s.name : '';
      setText(row.n, where ? (nm ? `${nm} · ${where}` : where) : nm);
      setText(row.a, s.conc_m !== null && s.phase !== 'solid' ? fmtConc(s.conc_m) : fmtAmountMol(s.amount_mol));
    });
  }

  private updateReactions(snap: VesselSnapshot) {
    if (!this.id) return;
    let tracked = this.vesselReactions.get(this.id);
    if (!tracked) {
      tracked = new Map();
      this.vesselReactions.set(this.id, tracked);
    }
    // Emptied vessel: clear history
    if (snap.total_liquid_ml < 0.001 && snap.solids.length === 0 && (snap.events ?? []).length === 0) {
      tracked.clear();
    }

    const rxns = snap.reactions ?? [];
    for (const tr of tracked.values()) {
      tr.active = false;
    }

    for (const r of rxns) {
      let isOccurring = false;
      let kind: string = r.kind;
      let eq = r.equation;

      if (r.role === 'autoprotolysis') {
        if (r.rate < -2e-3) {
          isOccurring = true;
          kind = 'neutralisation';
          eq = 'H+ + OH- -> H2O';
        }
      } else if (r.kind === 'equilibrium') {
        if (Math.abs(r.rate) > 1e-5) {
          isOccurring = true;
        }
      } else if (Math.abs(r.rate) > 1e-7) {
        isOccurring = true;
      }

      if (isOccurring) {
        const key = r.id || eq;
        const ex = tracked.get(key);
        if (ex) {
          ex.active = true;
          ex.rate = r.rate;
          ex.lastSimTime = snap.t_sim_s;
        } else {
          tracked.set(key, {
            id: r.id,
            equation: eq,
            kind,
            rate: r.rate,
            active: true,
            lastSimTime: snap.t_sim_s,
          });
        }
      }
    }

    const rxnItems = [...tracked.values()]
      .sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return Math.abs(b.rate) - Math.abs(a.rate) || b.lastSimTime - a.lastSimTime;
      })
      .slice(0, 5);

    const rxnKey = rxnItems.map((r) => `${r.id}:${r.active}`).join('|');
    const now = performance.now();
    if (rxnKey !== this.lastRxnKey || now - this.lastRxnAt > 250) {
      this.lastRxnKey = rxnKey;
      this.lastRxnAt = now;
      this.rxnList.innerHTML = '';
      for (const rx of rxnItems) {
        const li = h('li', { class: `rxn-item${rx.active ? ' is-active' : ''}` });
        const dot = h('span', { class: 'rxn-indicator', 'aria-hidden': 'true' });
        const eqSpan = h('span', { class: 'rxn-eq mono', title: rx.equation, text: prettyEquation(rx.equation) });
        li.append(dot, eqSpan);
        this.rxnList.append(li);
      }
    }
    this.rxnList.hidden = rxnItems.length === 0;

    // Events log
    const evs = snap.events ?? [];
    const last = evs.length ? (evs[evs.length - 1].seq ?? evs.length) : 0;
    if (last !== this.lastEventsLen) {
      this.lastEventsLen = last;
      const out: VesselEvent[] = [];
      for (const e of evs) {
        const prev = out[out.length - 1];
        if (prev && prev.kind === e.kind && prev.detail === e.detail && e.t_sim_s - prev.t_sim_s < 5) continue;
        if (SUPERSEDING.has(e.kind)) {
          const j = out.findLastIndex((o) => o.kind === e.kind && o.species === e.species && e.t_sim_s - o.t_sim_s < 30);
          if (j >= 0) {
            out.splice(j, 1);
          }
        }
        out.push(e);
      }
      const recent = out.slice(-LOG_ROWS).reverse();
      this.eventsList.innerHTML = '';
      for (const e of recent) {
        const li = h('li', { class: `ev ev-${e.kind}` });
        if (LOG_KINDS.has(e.kind)) {
          if (e.rgb) {
            const dot = h('span', { class: 'ev-dot', 'aria-hidden': 'true' });
            dot.style.background = linearToCss(e.rgb);
            li.append(dot);
          }
          li.append(h('span', { class: 'ev-detail ev-sentence', text: e.detail ?? EVENT_LABELS[e.kind] }));
        } else {
          li.append(h('span', { class: 'ev-kind', text: EVENT_LABELS[e.kind] ?? e.kind }));
          if (e.detail) li.append(h('span', { class: 'ev-detail', text: e.detail }));
        }
        li.append(h('time', { class: 'ev-t', text: fmtClock(e.t_sim_s) }));
        this.eventsList.append(li);
      }
      this.eventsList.hidden = recent.length === 0;
    }

    const hasContent = rxnItems.length > 0 || this.eventsList.children.length > 0;
    this.eventsSec.hidden = !hasContent;
  }

  // ------------------------------------------------------------------ pour
  private renderPourTargets() {
    if (!this.id || !this.pourTargets) return;
    const others = this.deps.lab.list().filter((x) => x.id !== this.id);
    if (!this.pourTarget || !others.some((o) => o.id === this.pourTarget)) this.pourTarget = others[0]?.id ?? null;
    this.pourTargets.innerHTML = '';
    if (others.length === 0) {
      this.pourTargets.append(h('span', { class: 'muted', text: 'Add another vessel to pour into.' }));
    }
    for (const o of others) {
      const on = o.id === this.pourTarget;
      const b = h('button', { class: 'chip chip-vessel', type: 'button', role: 'radio', 'aria-checked': String(on), tabindex: on ? '0' : '-1', text: o.name });
      b.addEventListener('click', () => {
        this.pourTarget = o.id;
        this.renderPourTargets();
        (this.pourTargets.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
      });
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const idx = others.findIndex((x) => x.id === this.pourTarget);
        this.pourTarget = others[(idx + (e.key === 'ArrowRight' ? 1 : others.length - 1)) % others.length].id;
        this.renderPourTargets();
        (this.pourTargets.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
      });
      this.pourTargets.append(b);
    }
    this.refreshPour();
  }

  private setPourValue(ml: number) {
    const v = Math.max(0, Math.round(ml * 10) / 10);
    this.pourRange.value = String(v);
    this.pourNum.value = String(v);
    this.refreshPour();
  }

  private refreshPour() {
    if (!this.id || !this.pourBtn) return;
    const lab = this.deps.lab;
    const tgt = this.pourTarget ? lab.get(this.pourTarget) : undefined;
    const src = lab.volumeMl(this.id);
    const max = tgt ? lab.maxPourMl(this.id, tgt.id) : 0;
    const maxStr = String(Math.floor(max * 10) / 10);
    if (this.pourRange.max !== maxStr) {
      this.pourRange.max = maxStr;
      this.pourNum.max = maxStr;
    }
    let val = parseFloat(this.pourNum.value);
    if (!isFinite(val)) val = 0;
    if (val > max && document.activeElement !== this.pourNum) {
      val = Math.floor(max * 10) / 10;
      this.pourNum.value = String(val);
      this.pourRange.value = String(val);
    }
    this.pourRange.style.setProperty('--fill', `${max > 0 ? (Math.min(val, max) / max) * 100 : 0}%`);
    const broken = !!lab.snapshot(this.id)?.burst;
    let label: string;
    if (this.pourBusy) label = 'Pouring…';
    else if (!tgt) label = 'No other vessel';
    else if (src <= 0.01) label = 'Nothing to pour';
    else if (max <= 0.01) label = `${tgt.name} is full`;
    else if (val > max + 1e-6) label = `Max ${max.toFixed(1)} mL`;
    else label = `Pour ${+val.toFixed(1)} mL into ${tgt.name}`;
    setText(this.pourLabel, label);
    this.pourBtn.disabled = this.pourBusy || broken || !tgt || !(val > 0.01) || val > max + 1e-6;
    (this.r.pourEmptyBtn as HTMLButtonElement).disabled = src <= 0.01 && !(lab.snapshot(this.id)?.solids.length);
  }

  private doPour() {
    if (!this.id || !this.pourTarget || this.pourBusy) return;
    const src = this.id;
    const tgt = this.pourTarget;
    const ml = parseFloat(this.pourNum.value);
    this.pourBusy = true;
    this.refreshPour();
    this.deps.lab
      .pour(src, tgt, ml)
      .catch((err: unknown) => toast(`Couldn't pour: ${err instanceof Error ? err.message : String(err)}`, 'error'))
      .finally(() => {
        this.pourBusy = false;
        this.refreshPour();
      });
  }
}
