// Left panel, "Glassware" tab: search-first catalog of every vessel the bench supports (same rhythm as the reagent
// browser), plus a compact "On the bench" list with select / remove. Click a catalog row = set that piece out.
import { GLASSWARE, GLASSWARE_CATEGORIES, GlasswareCategory, GlasswareSpec, formatCapacity, glasswareSpec, searchGlassware } from '../app/glassware_catalog';
import type { VesselState, VesselType } from '../types';
import { SetupSpec, searchSetups } from '../app/setups';
import { h, setText } from './dom';
import { icon } from './icons';

export class GlasswarePanel {
  public readonly el: HTMLElement;
  public onSpawn?: (type: VesselType) => void;
  /** A ready-made setup (several pieces, e.g. flask + delivery tube + gas collector) was clicked. */
  public onSetup?: (id: string) => void;
  public onSelectVessel?: (id: string) => void;
  public onRemoveVessel?: (id: string) => void;
  /** Result count for the panel header. */
  public onCount?: (n: number) => void;

  private search!: HTMLInputElement;
  private clearBtn!: HTMLButtonElement;
  private chipRow!: HTMLElement;
  private results!: HTMLElement;
  private benchList!: HTMLElement;
  private benchHead!: HTMLElement;
  private category: GlasswareCategory | null = null;
  private bench: VesselState[] = [];
  private selectedId: string | null = null;
  private armedId: string | null = null;
  private armTimer = 0;

  constructor() {
    this.el = h('div', { class: 'panel-view gw-view', id: 'glassware-view', role: 'tabpanel' });
    this.build();
    this.render();
    this.renderBench();
  }

  // ------------------------------------------------------------------ public
  public focusSearch(prefill?: string) {
    if (prefill !== undefined) {
      this.search.value = prefill;
      this.onQueryChanged();
    }
    this.search.focus();
    this.search.select();
  }

  /** Vessels currently on the bench (call whenever the list or the selection changes). */
  public setBench(vessels: VesselState[], selectedId: string | null) {
    this.bench = vessels.slice();
    this.selectedId = selectedId;
    if (this.armedId && !vessels.some((v) => v.id === this.armedId)) this.disarm();
    this.renderBench();
  }

  public get total(): number {
    return GLASSWARE.length;
  }

  // ------------------------------------------------------------------ build
  private build() {
    const searchWrap = h('div', { class: 'search' });
    searchWrap.innerHTML = icon('search', 16, 'search-ic');
    this.search = h('input', {
      type: 'search',
      class: 'search-input',
      placeholder: 'Search glassware… e.g. 50 mL burette',
      'aria-label': 'Search glassware',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    this.clearBtn = h('button', { class: 'icon-btn search-clear', type: 'button', 'aria-label': 'Clear search', hidden: true, html: icon('close', 14) });
    this.clearBtn.addEventListener('click', () => {
      this.search.value = '';
      this.onQueryChanged();
      this.search.focus();
    });
    this.search.addEventListener('input', () => this.onQueryChanged());
    this.search.addEventListener('keydown', (e) => this.onSearchKey(e));
    searchWrap.append(this.search, this.clearBtn);

    this.chipRow = h('div', { class: 'filter-row', role: 'group', 'aria-label': 'Glassware categories' });
    this.results = h('div', { class: 'results', 'aria-label': 'Glassware results' });
    const scroller = h('div', { class: 'panel-scroll' }, this.results);
    scroller.addEventListener('keydown', (e) => this.onResultsKey(e));

    // On the bench
    const foot = h('footer', { class: 'glass-row gw-bench' });
    this.benchHead = h('div', { class: 'eyebrow', text: 'On the bench' });
    this.benchList = h('ul', { class: 'gw-bench-list', role: 'list', 'aria-label': 'Glassware on the bench' });
    foot.append(this.benchHead, this.benchList);

    this.el.append(searchWrap, this.chipRow, scroller, foot);
  }

  // ------------------------------------------------------------------ catalog
  private onQueryChanged() {
    this.clearBtn.hidden = this.search.value.length === 0;
    this.render();
  }

  private render() {
    const q = this.search.value.trim();
    const matches = searchGlassware(q);
    this.renderChips(matches);

    const list = this.category ? matches.filter((g) => g.category === this.category) : matches;
    this.onCount?.(list.length);
    this.results.innerHTML = '';
    const setups = this.category ? [] : searchSetups(q);
    if (setups.length) this.results.append(this.setupSection(setups));
    if (list.length === 0) {
      if (!setups.length) this.results.append(h('p', { class: 'empty-hint', text: q ? `No glassware matches “${q}”.` : 'Nothing here.' }));
      return;
    }
    // One flat list while searching or filtering, grouped by category when browsing everything.
    if (q || this.category) {
      this.results.append(this.section(q ? 'Matches' : GLASSWARE_CATEGORIES.find((c) => c.id === this.category)!.label, list));
    } else {
      for (const cat of GLASSWARE_CATEGORIES) {
        const items = list.filter((g) => g.category === cat.id);
        if (items.length) this.results.append(this.section(cat.label, items));
      }
    }
  }

  private renderChips(matches: GlasswareSpec[]) {
    this.chipRow.innerHTML = '';
    const mk = (id: GlasswareCategory | null, label: string, n: number) => {
      const on = this.category === id;
      const b = h('button', { class: 'filter-chip', type: 'button', 'aria-pressed': String(on), disabled: n === 0 && !on });
      b.append(label, h('span', { class: 'chip-n', text: String(n) }));
      b.addEventListener('click', () => {
        this.category = this.category === id ? null : id;
        this.render();
      });
      this.chipRow.append(b);
    };
    mk(null, 'All', matches.length);
    for (const cat of GLASSWARE_CATEGORIES) mk(cat.id, cat.label, matches.filter((g) => g.category === cat.id).length);
  }

  private section(title: string, items: GlasswareSpec[]): HTMLElement {
    const sec = h('div', { class: 'r-section' });
    sec.append(h('div', { class: 'eyebrow', text: title }));
    const ul = h('ul', { class: 'r-list', role: 'list' });
    for (const g of items) ul.append(h('li', {}, this.row(g)));
    sec.append(ul);
    return sec;
  }

  private setupSection(items: SetupSpec[]): HTMLElement {
    const sec = h('div', { class: 'r-section' });
    sec.append(h('div', { class: 'eyebrow', text: 'Setups' }));
    const ul = h('ul', { class: 'r-list', role: 'list' });
    for (const s of items) {
      const b = h('button', { class: 'r-row gw-row', type: 'button', 'aria-label': `Set out ${s.label}. ${s.description}`, title: s.description });
      b.dataset.setup = s.id;
      b.innerHTML = `<span class="swatch gw-ic" aria-hidden="true">${icon(s.icon, 22)}</span>`;
      b.append(h('span', { class: 'r-main' }, h('span', { class: 'r-name', text: s.label }), h('span', { class: 'r-sub gw-sub', text: s.description })), h('span', { class: 'r-tag', text: 'Setup' }));
      b.addEventListener('click', () => this.onSetup?.(s.id));
      ul.append(h('li', {}, b));
    }
    sec.append(ul);
    return sec;
  }

  private row(g: GlasswareSpec): HTMLElement {
    const b = h('button', { class: 'r-row gw-row', type: 'button', 'aria-label': `Set out ${g.label}. ${g.description}`, title: g.description });
    b.dataset.type = g.type;
    b.innerHTML = `<span class="swatch gw-ic" aria-hidden="true">${icon(g.icon, 22)}</span>`;
    b.append(
      h('span', { class: 'r-main' }, h('span', { class: 'r-name', text: g.label }), h('span', { class: 'r-sub gw-sub', text: g.description })),
    );
    const grade = g.tolerance?.match(/^Class [AB]/)?.[0];
    if (grade) b.append(h('span', { class: 'r-tag', text: grade }));
    b.addEventListener('click', () => this.onSpawn?.(g.type));
    return b;
  }

  // ------------------------------------------------------------------ on the bench
  private renderBench() {
    setText(this.benchHead, this.bench.length ? `On the bench · ${this.bench.length}` : 'On the bench');
    this.benchList.innerHTML = '';
    if (this.bench.length === 0) {
      this.benchList.append(h('li', { class: 'gw-bench-empty', text: 'Nothing yet — click a piece above to set it out.' }));
      return;
    }
    for (const v of this.bench) {
      const spec = glasswareSpec(v.type);
      const on = v.id === this.selectedId;
      const pick = h('button', { class: 'gw-bench-pick', type: 'button', 'aria-current': String(on), title: `Select ${v.name}` });
      pick.innerHTML = `<span class="gw-bench-ic" aria-hidden="true">${icon(spec.icon, 18)}</span>`;
      pick.append(h('span', { class: 'gw-bench-name', text: v.name }), h('span', { class: 'gw-bench-cap', text: formatCapacity(spec.nominalMl ?? spec.capacityMl) }));
      pick.addEventListener('click', () => this.onSelectVessel?.(v.id));

      const armed = this.armedId === v.id;
      const rm = h('button', {
        class: `icon-btn gw-bench-rm btn-danger-quiet${armed ? ' is-armed' : ''}`,
        type: 'button',
        'aria-label': armed ? `Confirm removing ${v.name}` : `Remove ${v.name} from the bench`,
        title: armed ? 'Press again to remove' : `Remove ${v.name}`,
      });
      rm.innerHTML = armed ? `${icon('warning', 14)}<span>Remove?</span>` : icon('trash', 15);
      rm.addEventListener('click', () => this.onRemoveClick(v));
      this.benchList.append(h('li', { class: 'gw-bench-item' }, pick, rm));
    }
  }

  /** Empty glassware goes straight away; anything holding liquid needs a second press within 3 s. */
  private onRemoveClick(v: VesselState) {
    const holdsStuff = v.currentVolumeMl > 0.01 || v.contents.length > 0;
    if (!holdsStuff || this.armedId === v.id) {
      this.disarm();
      this.onRemoveVessel?.(v.id);
      return;
    }
    this.disarm();
    this.armedId = v.id;
    this.armTimer = window.setTimeout(() => {
      this.armedId = null;
      this.renderBench();
    }, 3000);
    this.renderBench();
    (this.benchList.querySelector('.gw-bench-rm.is-armed') as HTMLElement | null)?.focus();
  }

  private disarm() {
    window.clearTimeout(this.armTimer);
    this.armedId = null;
  }

  // ------------------------------------------------------------------ keyboard
  private rows(): HTMLElement[] {
    return Array.from(this.el.querySelectorAll<HTMLElement>('.gw-row'));
  }

  private onSearchKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.rows()[0]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Enter sets out the best match, but only when the query actually narrowed the list.
      if (this.search.value.trim()) this.rows()[0]?.click();
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
