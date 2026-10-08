// Left panel: tabs 'Reagents | Glassware'. Reagents = search-first browser (catalog + PubChem / NIST / CAS in one box) with the inline Add
// card; Glassware = the catalog menu (ui/glassware_panel.ts).
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
import type { VesselType } from '../app/lab';
import type { VesselState } from '../types';
import type { ImportRequest } from '../pubchem/api';
import { DatabaseSearch, type SearchSnapshot } from '../data/search/search_all';
import type { MergedHit, SourceId } from '../data/search/merge_hits';
import { h, prettyFormula, setText } from './dom';
import { icon } from './icons';
import { swatchHTML } from './reagent_swatch';
import { AddCard } from './add_card';
import { GlasswarePanel } from './glassware_panel';

const RESULT_CAP = 50;

export type LibraryTab = 'reagents' | 'glassware';

export class ReagentPanel {
  public readonly el: HTMLElement;
  public onSelect?: (item: ReagentItem) => void;
  public onImportHit?: (req: ImportRequest) => Promise<void>;
  public onSpawnGlassware?: (type: VesselType) => void;
  public onSelectGlassware?: (id: string) => void;
  public onRemoveGlassware?: (id: string) => void;
  public readonly glassware = new GlasswarePanel();

  private search!: HTMLInputElement;
  private clearBtn!: HTMLButtonElement;
  private filterRow!: HTMLElement;
  private results!: HTMLElement;
  private pubchemSection!: HTMLElement;
  private countEl!: HTMLElement;
  private filter: ReagentFilter = 'all';
  private tab: LibraryTab = 'reagents';
  private tabBtns: Record<LibraryTab, HTMLButtonElement> | null = null;
  private reagentView!: HTMLElement;
  private glassCount = '';
  private selectedKey: string | null = null;
  private renderQueued = false;
  private pcTimer = 0;
  private importing = false;
  private dbSearch = new DatabaseSearch();
  private dbSnap: SearchSnapshot | null = null;

  constructor(private lib: ReagentLibrary, public readonly addCard: AddCard) {
    this.el = h('aside', { class: 'panel panel-left', id: 'reagent-panel', 'aria-label': 'Reagents and glassware' });
    this.build();
    this.lib.onChange = () => this.queueRender();
  }

  // ------------------------------------------------------------------ public
  public focusSearch(prefill?: string) {
    this.setCollapsed(false);
    if (this.tab === 'glassware') {
      this.glassware.focusSearch(prefill);
      return;
    }
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

  public get activeTab(): LibraryTab {
    return this.tab;
  }

  /** Switch between the Reagents and Glassware views (focus stays where it is unless `focus` is set). */
  public showTab(tab: LibraryTab, focus = false) {
    this.tab = tab;
    this.el.dataset.tab = tab;
    this.reagentView.hidden = tab !== 'reagents';
    this.glassware.el.hidden = tab !== 'glassware';
    for (const t of ['reagents', 'glassware'] as const) {
      const on = t === tab;
      this.tabBtns?.[t].setAttribute('aria-selected', String(on));
      this.tabBtns?.[t].setAttribute('tabindex', on ? '0' : '-1');
    }
    this.updateCount();
    if (focus) this.tabBtns?.[tab].focus();
  }

  /** Vessels on the bench for the Glassware tab's "On the bench" list. */
  public setBench(vessels: VesselState[], selectedId: string | null) {
    this.glassware.setBench(vessels, selectedId);
  }

  private updateCount() {
    setText(this.countEl, this.tab === 'glassware' ? this.glassCount : this.lib.size ? String(this.lib.size) : '');
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
    const tabs = h('div', { class: 'seg panel-tabs', role: 'tablist', 'aria-label': 'Library' });
    const mkTab = (id: LibraryTab, label: string) => {
      const b = h('button', {
        class: 'seg-btn',
        type: 'button',
        role: 'tab',
        id: `lib-tab-${id}`,
        'aria-selected': String(id === this.tab),
        'aria-controls': id === 'reagents' ? 'reagents-view' : 'glassware-view',
        tabindex: id === this.tab ? '0' : '-1',
        text: label,
      });
      b.addEventListener('click', () => this.showTab(id));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          this.showTab(id === 'reagents' ? 'glassware' : 'reagents', true);
        }
      });
      tabs.append(b);
      return b;
    };
    this.tabBtns = { reagents: mkTab('reagents', 'Reagents'), glassware: mkTab('glassware', 'Glassware') };
    head.append(tabs);
    this.countEl = h('span', { class: 'panel-count' });
    const collapse = h('button', {
      class: 'icon-btn panel-collapse',
      'aria-label': 'Show or hide the library',
      'aria-expanded': 'true',
      'aria-controls': 'reagent-panel-body',
      html: icon('chevronUp', 16),
    });
    collapse.addEventListener('click', () => this.setCollapsed(!this.collapsed));
    head.append(h('span', { class: 'panel-spacer' }), this.countEl, collapse);

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

    // Glassware tab (own search, categories, "On the bench" list)
    this.glassware.onSpawn = (type) => this.onSpawnGlassware?.(type);
    this.glassware.onSelectVessel = (id) => this.onSelectGlassware?.(id);
    this.glassware.onRemoveVessel = (id) => this.onRemoveGlassware?.(id);
    this.glassware.onCount = (n) => {
      this.glassCount = String(n);
      if (this.tab === 'glassware') this.updateCount();
    };
    this.glassCount = String(this.glassware.total);
    this.glassware.el.setAttribute('aria-labelledby', 'lib-tab-glassware');
    this.glassware.el.hidden = true;

    this.reagentView = h('div', { class: 'panel-view', id: 'reagents-view', role: 'tabpanel', 'aria-labelledby': 'lib-tab-reagents' }, searchWrap, this.filterRow, scroller, this.addCard.el);
    body.append(this.reagentView, this.glassware.el);
    this.el.append(head, body);
    this.el.dataset.tab = this.tab;
    this.renderResults();
  }

  // ------------------------------------------------------------------ results
  private onQueryChanged() {
    this.clearBtn.hidden = this.search.value.length === 0;
    this.renderResults();
    this.scheduleDatabases();
  }

  private renderResults() {
    const q = this.search.value.trim();
    this.updateCount();
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
          ? 'Nothing imported yet. Search above to import any compound from PubChem, NIST or CAS.'
          : q
            ? `No reagent matches “${q}”.`
            : 'Nothing here.';
      this.results.append(h('p', { class: 'empty-hint', text: msg }));
    }
    this.renderDatabases();
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

  // ------------------------------------------------------------------ databases (same search box)
  private scheduleDatabases() {
    window.clearTimeout(this.pcTimer);
    const q = this.search.value.trim();
    if (q.length < 2) {
      this.dbSearch.cancel();
      this.dbSnap = null;
      this.renderDatabases();
      return;
    }
    this.pcTimer = window.setTimeout(() => {
      this.dbSearch.run(q, (snap) => {
        if (this.search.value.trim() !== snap.query) return;
        this.dbSnap = snap;
        this.renderDatabases();
      });
    }, 320);
  }

  private renderDatabases() {
    const q = this.search.value.trim();
    this.pubchemSection.innerHTML = '';
    if (q.length < 2) return;
    this.pubchemSection.append(h('div', { class: 'eyebrow', text: 'Chemical databases' }));
    const snap = this.dbSnap && this.dbSnap.query === q ? this.dbSnap : null;
    if (!snap) {
      this.pubchemSection.append(h('p', { class: 'pc-status', text: 'Searching PubChem, NIST WebBook and CAS Common Chemistry…' }));
      return;
    }
    for (const m of snap.hits.slice(0, 12)) this.pubchemSection.append(this.dbRow(m));
    if (snap.hits.length === 0 && snap.done) {
      this.pubchemSection.append(h('p', { class: 'pc-status', text: `No database knows “${q}”. Try a different spelling, the formula, or the CAS number.` }));
    }
    this.pubchemSection.append(h('p', { class: 'pc-status', text: this.statusLine(snap) }));
    this.pubchemSection.append(h('p', { class: 'pc-status', text: 'Imported compounds react when the engine can derive their ions from the formula (salts, acids, bases).' }));
  }

  private statusLine(snap: SearchSnapshot): string {
    const names: Record<SourceId, string> = { pubchem: 'PubChem', nist: 'NIST', cas: 'CAS' };
    const parts: string[] = [];
    for (const id of ['pubchem', 'nist', 'cas'] as SourceId[]) {
      const st = snap.sources[id];
      if (st === 'running') parts.push(`${names[id]}: searching…`);
      else if (st.status === 'ok') parts.push(`${names[id]}: found`);
      else if (st.status === 'none') parts.push(`${names[id]}: no match`);
      else parts.push(`${names[id]}: ${st.message ?? st.status}`);
    }
    return parts.join(' · ');
  }

  private dbRow(m: MergedHit): HTMLElement {
    const b = h('button', { class: 'pc-row db-row', type: 'button', disabled: this.importing });
    b.innerHTML = icon('plus', 14);
    const text = h('span', { class: 'db-text' });
    text.append(h('span', { class: 'db-name', text: m.name }));
    const meta: string[] = [];
    if (m.formula) meta.push(prettyFormula(m.formula));
    if (m.kind === 'element') meta.push('element');
    if (m.kind === 'ion') meta.push('ion');
    if (m.cas) meta.push(`CAS ${m.cas}`);
    text.append(h('span', { class: 'db-meta', text: meta.join(' · ') }));
    b.append(text);
    const badges = h('span', { class: 'db-badges' });
    for (const s of m.sources) badges.append(h('span', { class: `db-badge db-${s}`, text: s === 'pubchem' ? 'PubChem' : s === 'nist' ? 'NIST' : 'CAS' }));
    b.append(badges);
    b.addEventListener('click', () => this.importHit({ name: m.name, cid: m.cid, inchikey: m.inchikey, cas: m.cas, formula: m.formula, smiles: m.smiles }));
    return b;
  }

  private async importHit(req: ImportRequest) {
    if (this.importing || !this.onImportHit) return;
    this.importing = true;
    this.renderDatabases();
    try {
      await this.onImportHit(req);
      this.search.value = '';
      this.dbSnap = null;
      this.onQueryChanged();
    } finally {
      this.importing = false;
      this.renderDatabases();
    }
  }

  // ------------------------------------------------------------------ keyboard
  private rows(): HTMLElement[] {
    return Array.from(this.reagentView.querySelectorAll<HTMLElement>('.r-row, .pc-row:not([disabled])'));
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
      if (q && total === 0) {
        const top = this.dbSnap && this.dbSnap.query === q ? this.dbSnap.hits[0] : undefined;
        this.importHit(top ? { name: top.name, cid: top.cid, inchikey: top.inchikey, cas: top.cas, formula: top.formula, smiles: top.smiles } : { name: q });
      }
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
