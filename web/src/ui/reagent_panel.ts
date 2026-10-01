// Left panel: search-first reagent browser (catalog + PubChem in one box), inline Add card, glassware.
import {
  ReagentLibrary,
  ReagentItem,
  ReagentFilter,
  FILTERS,
  displayName,
  formulaOf,
  strengthLabel,
  signalWord,
} from '../app/reagent_library';
import { GLASSWARE, VesselType } from '../app/lab';
import { searchPubChemAutocomplete } from '../pubchem/api';
import { h, prettyFormula, setText } from './dom';
import { icon } from './icons';
import { swatchHTML } from './reagent_swatch';
import { AddCard } from './add_card';

const RESULT_CAP = 50;

export class ReagentPanel {
  public readonly el: HTMLElement;
  public onSelect?: (item: ReagentItem) => void;
  public onImportPubChem?: (name: string) => Promise<void>;
  public onSpawnGlassware?: (type: VesselType) => void;

  private search!: HTMLInputElement;
  private clearBtn!: HTMLButtonElement;
  private filterRow!: HTMLElement;
  private results!: HTMLElement;
  private pubchemSection!: HTMLElement;
  private countEl!: HTMLElement;
  private filter: ReagentFilter = 'all';
  private selectedKey: string | null = null;
  private renderQueued = false;
  private pcTimer = 0;
  private pcSeq = 0;
  private importing = false;
  private pcNames: string[] = [];
  private pcState: 'idle' | 'loading' | 'done' = 'idle';

  constructor(private lib: ReagentLibrary, public readonly addCard: AddCard) {
    this.el = h('aside', { class: 'panel panel-left', id: 'reagent-panel', 'aria-label': 'Reagents' });
    this.build();
    this.lib.onChange = () => this.queueRender();
  }

  // ------------------------------------------------------------------ public
  public focusSearch(prefill?: string) {
    this.setCollapsed(false);
    if (prefill !== undefined) {
      this.search.value = prefill;
      this.onQueryChanged();
    }
    this.search.focus();
    this.search.select();
  }

  public setSelected(key: string | null) {
    this.selectedKey = key;
    this.results.querySelectorAll<HTMLElement>('.r-row').forEach((r) => {
      r.setAttribute('aria-current', String(r.dataset.key === key));
    });
  }

  public setCollapsed(collapsed: boolean) {
    this.el.dataset.collapsed = String(collapsed);
    const btn = this.el.querySelector('.panel-collapse') as HTMLElement;
    btn?.setAttribute('aria-expanded', String(!collapsed));
    if (!collapsed) this.el.dispatchEvent(new CustomEvent('panel-expanded', { bubbles: true }));
  }

  public get collapsed(): boolean {
    return this.el.dataset.collapsed === 'true';
  }

  public queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.renderResults();
    });
  }

  // ------------------------------------------------------------------ build
  private build() {
    const head = h('header', { class: 'panel-head' });
    head.innerHTML = `<h2 class="panel-title">Reagents</h2>`;
    this.countEl = h('span', { class: 'panel-count' });
    const collapse = h('button', {
      class: 'icon-btn panel-collapse',
      'aria-label': 'Show or hide reagents',
      'aria-expanded': 'true',
      'aria-controls': 'reagent-panel-body',
      html: icon('chevronUp', 16),
    });
    collapse.addEventListener('click', () => this.setCollapsed(!this.collapsed));
    head.append(this.countEl, collapse);

    const body = h('div', { class: 'panel-body', id: 'reagent-panel-body' });

    // Search
    const searchWrap = h('div', { class: 'search' });
    searchWrap.innerHTML = icon('search', 16, 'search-ic');
    this.search = h('input', {
      type: 'search',
      class: 'search-input',
      placeholder: 'Search reagents or PubChem',
      'aria-label': 'Search reagents or PubChem',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    this.clearBtn = h('button', { class: 'icon-btn search-clear', 'aria-label': 'Clear search', hidden: true, html: icon('close', 14) });
    this.clearBtn.addEventListener('click', () => {
      this.search.value = '';
      this.onQueryChanged();
      this.search.focus();
    });
    this.search.addEventListener('input', () => this.onQueryChanged());
    this.search.addEventListener('keydown', (e) => this.onSearchKey(e));
    searchWrap.append(this.search, this.clearBtn);

    // Filters (derived generically from form/dropper; Imported = PubChem)
    this.filterRow = h('div', { class: 'filter-row', role: 'group', 'aria-label': 'Filter reagents' });
    for (const f of FILTERS) {
      const b = h('button', { class: 'filter-chip', type: 'button', 'aria-pressed': String(f.id === this.filter), text: f.label });
      b.addEventListener('click', () => {
        this.filter = this.filter === f.id && f.id !== 'all' ? 'all' : f.id;
        this.filterRow.querySelectorAll('.filter-chip').forEach((c, i) => c.setAttribute('aria-pressed', String(FILTERS[i].id === this.filter)));
        this.renderResults();
      });
      this.filterRow.append(b);
    }

    this.results = h('div', { class: 'results', 'aria-label': 'Reagent results' });
    this.pubchemSection = h('div', { class: 'pc-section' });

    const scroller = h('div', { class: 'panel-scroll' }, this.results, this.pubchemSection);
    scroller.addEventListener('keydown', (e) => this.onResultsKey(e));

    // Glassware
    const glass = h('footer', { class: 'glass-row' });
    glass.append(h('div', { class: 'eyebrow', text: 'Add glassware' }));
    const grid = h('div', { class: 'glass-grid' });
    for (const g of GLASSWARE) {
      const b = h('button', { class: 'glass-btn', type: 'button', 'aria-label': `Add ${g.label}`, title: `Add ${g.label}` });
      b.innerHTML = `${icon(g.icon, 22)}<span>${g.label}</span>`;
      b.addEventListener('click', () => this.onSpawnGlassware?.(g.type));
      grid.append(b);
    }
    glass.append(grid);

    body.append(searchWrap, this.filterRow, scroller, this.addCard.el, glass);
    this.el.append(head, body);
    this.renderResults();
  }

  // ------------------------------------------------------------------ results
  private onQueryChanged() {
    this.clearBtn.hidden = this.search.value.length === 0;
    this.renderResults();
    this.schedulePubChem();
  }

  private renderResults() {
    const q = this.search.value.trim();
    setText(this.countEl, this.lib.size ? String(this.lib.size) : '');
    this.results.innerHTML = '';

    const recent = q === '' && this.filter === 'all' ? this.lib.recentItems().slice(0, 8) : [];
    if (recent.length) {
      this.results.append(this.section('Recently used', recent));
    }

    const { items, total } = this.lib.search(q, this.filter, RESULT_CAP);
    const recentKeys = new Set(recent.map((r) => r.key));
    const list = items.filter((i) => !recentKeys.has(i.key));
    const title = q ? 'Matches' : this.filter === 'all' ? (recent.length ? 'All reagents' : 'Reagents') : FILTERS.find((f) => f.id === this.filter)!.label;
    if (list.length) {
      this.results.append(this.section(title, list));
      if (total > RESULT_CAP) {
        this.results.append(h('p', { class: 'more-hint', text: `${total - RESULT_CAP} more — type to narrow the list` }));
      }
    } else if (!recent.length) {
      const msg = this.lib.size === 0
        ? 'Loading reagents…'
        : this.filter === 'imported' && !q
          ? 'Nothing imported yet. Search PubChem above to import any compound.'
          : q
            ? `No reagent matches “${q}”.`
            : 'Nothing here.';
      this.results.append(h('p', { class: 'empty-hint', text: msg }));
    }
    this.renderPubChem(this.pcNames, this.pcState);
  }

  private section(title: string, items: ReagentItem[]): HTMLElement {
    const sec = h('div', { class: 'r-section' });
    sec.append(h('div', { class: 'eyebrow', text: title }));
    const ul = h('ul', { class: 'r-list', role: 'list' });
    for (const it of items) ul.append(h('li', {}, this.row(it)));
    sec.append(ul);
    return sec;
  }

  private row(it: ReagentItem): HTMLElement {
    const b = h('button', { class: 'r-row', type: 'button', 'aria-current': String(it.key === this.selectedKey) });
    b.dataset.key = it.key;
    const sw = signalWord(it);
    const formula = prettyFormula(formulaOf(it));
    b.innerHTML = swatchHTML(it);
    b.append(
      h(
        'span',
        { class: 'r-main' },
        h('span', { class: 'r-name', text: displayName(it) }),
        h('span', { class: 'r-sub', text: `${formula} · ${strengthLabel(it)}` }),
      ),
    );
    if (it.kind === 'imported') b.append(h('span', { class: 'r-tag', text: 'PubChem' }));
    if (sw) {
      b.append(h('span', { class: `hz-dot ${sw === 'Danger' ? 'is-danger' : 'is-warning'}`, role: 'img', 'aria-label': `Hazard: ${sw}`, title: sw }));
    }
    b.addEventListener('click', () => this.onSelect?.(it));
    return b;
  }

  // ------------------------------------------------------------------ PubChem (same search box)
  private schedulePubChem() {
    window.clearTimeout(this.pcTimer);
    const q = this.search.value.trim();
    if (q.length < 2) {
      this.renderPubChem([], 'idle');
      return;
    }
    this.renderPubChem([], q.length >= 3 ? 'loading' : 'idle');
    if (q.length < 3) return;
    const seq = ++this.pcSeq;
    this.pcTimer = window.setTimeout(async () => {
      let names: string[] = [];
      try {
        names = await searchPubChemAutocomplete(q);
      } catch {
        names = [];
      }
      if (seq !== this.pcSeq || this.search.value.trim() !== q) return;
      this.renderPubChem(names.slice(0, 6), 'done');
    }, 320);
  }

  private renderPubChem(names: string[], state: 'idle' | 'loading' | 'done') {
    this.pcNames = names;
    this.pcState = state;
    const q = this.search.value.trim();
    this.pubchemSection.innerHTML = '';
    if (q.length < 2) return;
    this.pubchemSection.append(h('div', { class: 'eyebrow', text: 'PubChem' }));
    const main = h('button', { class: 'pc-row pc-primary', type: 'button', disabled: this.importing });
    main.innerHTML = icon('cloud', 16);
    main.append(h('span', { text: this.importing ? 'Importing…' : `Import “${q}” from PubChem` }));
    main.addEventListener('click', () => this.importName(q));
    this.pubchemSection.append(main);
    if (state === 'loading') {
      this.pubchemSection.append(h('p', { class: 'pc-status', text: 'Looking up suggestions…' }));
    }
    const lowerQ = q.toLowerCase();
    for (const n of names.filter((x) => x.toLowerCase() !== lowerQ)) {
      const b = h('button', { class: 'pc-row', type: 'button', disabled: this.importing });
      b.innerHTML = icon('plus', 14);
      b.append(h('span', { text: n }));
      b.addEventListener('click', () => this.importName(n));
      this.pubchemSection.append(b);
    }
    this.pubchemSection.append(h('p', { class: 'pc-status', text: 'Imported compounds are visual only — no reaction data.' }));
  }

  private async importName(name: string) {
    if (this.importing || !this.onImportPubChem) return;
    this.importing = true;
    this.renderPubChem(this.pcNames, 'idle');
    try {
      await this.onImportPubChem(name);
      this.search.value = '';
      this.onQueryChanged();
    } finally {
      this.importing = false;
      this.renderPubChem([], 'idle');
    }
  }

  // ------------------------------------------------------------------ keyboard
  private rows(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll<HTMLElement>('.r-row, .pc-row:not([disabled])'));
  }

  private onSearchKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.rows()[0]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const first = this.results.querySelector<HTMLElement>('.r-row');
      const q = this.search.value.trim();
      const { total } = this.lib.search(q, this.filter, 1);
      if (q && total === 0) this.importName(q);
      else first?.click();
    } else if (e.key === 'Escape' && this.search.value) {
      e.preventDefault();
      e.stopPropagation();
      this.search.value = '';
      this.onQueryChanged();
    }
  }

  private onResultsKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = this.rows();
    const idx = rows.indexOf(document.activeElement as HTMLElement);
    if (idx < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowUp' && idx === 0) this.search.focus();
    else rows[Math.max(0, Math.min(rows.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  }
}
