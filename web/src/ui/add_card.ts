// Inline "Add" card: amount presets, target vessel chips and one primary action.
// Built once per reagent selection; only text/disabled state is refreshed afterwards.
import { VesselState } from '../types';
import { ReagentCatalogEntry } from '../types/sim';
import {
  ReagentItem,
  AmountMode,
  amountMode,
  displayName,
  formulaOf,
  strengthLabel,
  signalWord,
  ghsOf,
  hazardWords,
  describeModel,
} from '../app/reagent_library';
import { Lab } from '../app/lab';
import { h, setText, prettyFormula } from './dom';
import { icon } from './icons';
import { swatchHTML } from './reagent_swatch';

const PRESETS: Record<AmountMode, { values: number[]; def: number; unit: string; step: number; max: number }> = {
  ml: { values: [1, 5, 10, 25, 50], def: 10, unit: 'mL', step: 0.5, max: 1000 },
  g: { values: [0.1, 0.5, 1, 2], def: 0.5, unit: 'g', step: 0.05, max: 50 },
  drops: { values: [1, 3, 5, 10], def: 3, unit: 'drops', step: 1, max: 100 },
};

export interface AddCardHost {
  vessels(): VesselState[];
  freeCapacityMl(id: string): number;
  isBroken(id: string): boolean;
  catalogMatchFor(item: ReagentItem): ReagentCatalogEntry | undefined;
}

export class AddCard {
  public readonly el: HTMLElement;
  public item: ReagentItem | null = null;
  public onAdd?: (item: ReagentItem, vesselId: string, amount: number) => Promise<void>;
  public onClose?: () => void;
  public onProperties?: (item: ReagentItem) => void;
  public onUseCatalog?: (entry: ReagentCatalogEntry) => void;

  private amount = 10;
  private targetId: string | null = null;
  private busy = false;
  private mode: AmountMode = 'ml';
  /** The exact-amount disclosure stays open once the user has opened it. */
  private assistOpen = false;

  private amountInput!: HTMLInputElement;
  private presetBtns: HTMLButtonElement[] = [];
  private vesselChips!: HTMLElement;
  private warnEl!: HTMLElement;
  private addBtn!: HTMLButtonElement;
  private addLabel!: HTMLElement;

  constructor(private host: AddCardHost) {
    this.el = h('section', { class: 'add-card', 'aria-label': 'Add reagent', hidden: true });
  }

  public get isOpen(): boolean {
    return !this.el.hidden;
  }

  public show(item: ReagentItem, defaultVesselId: string | null) {
    this.item = item;
    this.mode = amountMode(item);
    this.amount = PRESETS[this.mode].def;
    const vessels = this.host.vessels();
    this.targetId = defaultVesselId && vessels.some((v) => v.id === defaultVesselId) ? defaultVesselId : vessels[0]?.id ?? null;
    this.busy = false;
    this.build();
    this.el.hidden = false;
    this.refresh();
  }

  public hide() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.item = null;
    this.onClose?.();
  }

  /** Selected vessel changed elsewhere: follow it unless the user is mid-add. */
  public setDefaultVessel(id: string | null) {
    if (!this.item || this.busy || !id) return;
    this.targetId = id;
    this.renderVesselChips();
    this.refresh();
  }

  public vesselsChanged() {
    if (!this.item) return;
    const vessels = this.host.vessels();
    if (!this.targetId || !vessels.some((v) => v.id === this.targetId)) this.targetId = vessels[0]?.id ?? null;
    this.renderVesselChips();
    this.refresh();
  }

  private build() {
    const it = this.item!;
    const p = PRESETS[this.mode];
    this.el.innerHTML = '';
    const sw = signalWord(it);
    const hazards = hazardWords(ghsOf(it));

    const head = h('div', { class: 'add-head' });
    head.innerHTML = swatchHTML(it);
    const titles = h(
      'div',
      { class: 'add-titles' },
      h('h3', { class: 'add-name', text: displayName(it) }),
      h('div', { class: 'add-sub', text: `${prettyFormula(formulaOf(it))} · ${strengthLabel(it)}` }),
    );
    const close = h('button', { class: 'icon-btn', 'aria-label': 'Close add card', html: icon('close', 16) });
    close.addEventListener('click', () => this.hide());
    head.append(titles, close);
    this.el.append(head);

    if (sw || hazards.length) {
      this.el.append(
        h(
          'div',
          { class: `add-hazard ${sw === 'Danger' ? 'is-danger' : 'is-warning'}` },
          h('span', { class: 'hz-dot', 'aria-hidden': 'true' }),
          h('span', { text: [sw, hazards.join(', ')].filter(Boolean).join(' · ') }),
        ),
      );
    }

    if (it.kind === 'imported') {
      const note = h('div', { class: 'add-note' });
      const model = it.model;
      let msg: string;
      if (model?.modelable && model.phase_model === 'inert') msg = `${describeModel(model)}. Solids are dosed by mass, liquids by volume.`;
      else if (model?.modelable) msg = `${describeModel(model)}. Imported solids are dosed by mass, liquids as a 0.10 M aqueous solution.`;
      else if (model) msg = describeModel(model);
      else msg = 'Checking whether the engine can model this compound…';
      note.innerHTML = `${icon('info', 14)}<span></span>`;
      (note.querySelector('span') as HTMLElement).textContent = msg;
      this.el.append(note);
      const match = this.host.catalogMatchFor(it);
      const row = h('div', { class: 'add-links' });
      if (match) {
        const use = h('button', { class: 'link-btn', text: `Also in stock: ${match.name}` });
        use.addEventListener('click', () => this.onUseCatalog?.(match));
        row.append(use);
      }
      const props = h('button', { class: 'link-btn', html: `${icon('list', 14)} Properties` });
      props.addEventListener('click', () => this.onProperties?.(it));
      row.append(props);
      this.el.append(row);
    }

    // Manual handling is the primary way to add chemicals; the amount form is an assisted fallback.
    const guide = h('div', { class: 'manual-guide', role: 'note' });
    const guideText: Record<AmountMode, string> = {
      ml: 'Drag the bottle off the shelf, bring it over a vessel and drag up to tilt. Release to stop.',
      g: 'Drag the jar off the shelf, hold it over a vessel (or the balance pan) and drag up to tilt. A slight tilt gives a trickle.',
      drops: 'Drag the dropper bottle off the shelf, hold it over a vessel and drag up to squeeze drops. Release to stop.',
    };
    guide.innerHTML = `${icon('pour', 18)}<div><strong>Pour it by hand</strong><span class="mg-keys"></span></div>`;
    (guide.querySelector('.mg-keys') as HTMLElement).textContent = guideText[this.mode];
    this.el.append(guide);

    const assist = h('details', { class: 'assist' });
    assist.open = this.assistOpen;
    assist.addEventListener('toggle', () => {
      this.assistOpen = assist.open;
    });
    assist.append(h('summary', { text: 'Assisted add (exact amount)' }));
    const body = h('div', { class: 'assist-body' });
    assist.append(body);

    // Amount
    const amountId = `add-amount-${Math.random().toString(36).slice(2, 7)}`;
    const amountRow = h('div', { class: 'field' });
    amountRow.append(h('label', { class: 'field-label', for: amountId, text: 'Amount' }));
    const presets = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Amount presets' });
    this.presetBtns = p.values.map((v) => {
      const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', text: `${v} ${p.unit === 'drops' ? (v === 1 ? 'drop' : 'drops') : p.unit}` });
      b.dataset.v = String(v);
      b.addEventListener('click', () => {
        this.amount = v;
        this.amountInput.value = String(v);
        this.refresh();
      });
      presets.append(b);
      return b;
    });
    const inputWrap = h('div', { class: 'num-input' });
    this.amountInput = h('input', {
      id: amountId,
      type: 'number',
      inputmode: 'decimal',
      min: String(p.step),
      max: String(p.max),
      step: String(p.step),
      value: String(this.amount),
    });
    this.amountInput.addEventListener('input', () => {
      const v = parseFloat(this.amountInput.value);
      this.amount = isFinite(v) ? v : 0;
      this.refresh();
    });
    this.amountInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });
    inputWrap.append(this.amountInput, h('span', { class: 'num-unit', text: p.unit }));
    amountRow.append(h('div', { class: 'amount-line' }, presets, inputWrap));
    body.append(amountRow);

    // Target vessel
    const target = h('div', { class: 'field' });
    target.append(h('div', { class: 'field-label', id: `${amountId}-into`, text: 'Into' }));
    this.vesselChips = h('div', { class: 'chip-row', role: 'radiogroup', 'aria-labelledby': `${amountId}-into` });
    target.append(this.vesselChips);
    body.append(target);
    this.renderVesselChips();

    this.warnEl = h('div', { class: 'add-warn', role: 'status', 'aria-live': 'polite' });
    body.append(this.warnEl);

    this.addBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button' });
    const verb = this.mode === 'drops' ? icon('drop', 16) : this.mode === 'g' ? icon('scoop', 16) : icon('pour', 16);
    this.addBtn.innerHTML = verb;
    this.addLabel = h('span');
    this.addBtn.append(this.addLabel);
    this.addBtn.addEventListener('click', () => this.submit());
    body.append(this.addBtn);
    this.el.append(assist);
  }

  private renderVesselChips() {
    if (!this.vesselChips) return;
    this.vesselChips.innerHTML = '';
    const vessels = this.host.vessels();
    if (vessels.length === 0) {
      this.vesselChips.append(h('span', { class: 'muted', text: 'No glassware on the bench — open the Glassware tab to add some.' }));
      return;
    }
    for (const v of vessels) {
      const on = v.id === this.targetId;
      const b = h('button', { class: 'chip chip-vessel', type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', tabindex: on ? '0' : '-1', text: v.name });
      b.addEventListener('click', () => {
        this.targetId = v.id;
        this.renderVesselChips();
        this.refresh();
        (this.vesselChips.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
      });
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const idx = vessels.findIndex((x) => x.id === this.targetId);
        const next = vessels[(idx + (e.key === 'ArrowRight' ? 1 : vessels.length - 1)) % vessels.length];
        this.targetId = next.id;
        this.renderVesselChips();
        this.refresh();
        (this.vesselChips.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
      });
      this.vesselChips.append(b);
    }
  }

  /** Cheap: updates button label, warning and disabled state. Safe to call often. */
  public refresh() {
    if (!this.item || !this.addBtn) return;
    const p = PRESETS[this.mode];
    for (const b of this.presetBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.v) === this.amount));
    const vessel = this.host.vessels().find((v) => v.id === this.targetId);
    const unit = this.mode === 'drops' ? (this.amount === 1 ? 'drop' : 'drops') : p.unit;
    const amountText = `${+this.amount.toFixed(3)} ${unit}`;
    let warn = '';
    if (!vessel) warn = 'Add a beaker or flask to the bench first.';
    else if (this.host.isBroken(vessel.id)) warn = `${vessel.name} is broken. Pick another vessel.`;
    else if (!(this.amount > 0)) warn = 'Enter an amount greater than zero.';
    else {
      const need = Lab.addedVolumeMl(this.item, this.amount);
      const free = this.host.freeCapacityMl(vessel.id);
      if (need > free + 1e-6) warn = `Too much: ${vessel.name} has ${free.toFixed(1)} mL of space left.`;
    }
    setText(this.warnEl, warn);
    this.warnEl.hidden = !warn;
    setText(this.addLabel, this.busy ? 'Adding…' : vessel ? `Add ${amountText} to ${vessel.name}` : 'Add');
    this.addBtn.disabled = this.busy || !!warn;
    this.addBtn.setAttribute('aria-busy', String(this.busy));
  }

  private async submit() {
    if (!this.item || !this.targetId || this.busy) return;
    this.refresh();
    if (this.addBtn.disabled) return;
    this.busy = true;
    this.refresh();
    try {
      await this.onAdd?.(this.item, this.targetId, this.amount);
    } finally {
      this.busy = false;
      this.refresh();
    }
  }
}
