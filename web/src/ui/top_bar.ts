// Minimal top bar: brand, status dot, Details toggle and the More (⋯) menu.
import { h } from './dom';
import { icon } from './icons';

type Status = 'pending' | 'ok' | 'warn' | 'error';

export interface MenuItem {
  label: string;
  hint?: string;
  icon: Parameters<typeof icon>[0];
  action: () => void;
}

export class TopBar {
  public readonly el: HTMLElement;
  public onToggleDetails?: () => void;
  private detailsBtn: HTMLButtonElement;
  private moreBtn: HTMLButtonElement;
  private menu: HTMLElement;
  private statusDot: HTMLElement;
  private engineRow: HTMLElement;
  private serverRow: HTMLElement;
  private engine: { s: Status; text: string } = { s: 'pending', text: 'Starting…' };
  private server: { s: Status; text: string } = { s: 'pending', text: 'Checking…' };

  constructor(items: MenuItem[]) {
    this.el = h('header', { class: 'topbar' });
    const brand = h('div', { class: 'brand' });
    brand.innerHTML = `<svg class="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M9.5 3h5M10 3v6l-5.5 10a1 1 0 00.9 1.5h13.2a1 1 0 00.9-1.5L14 9V3"/><path d="M6.6 15.5h10.8" /><circle cx="11" cy="17.6" r=".7" fill="currentColor"/><circle cx="13.6" cy="16.9" r=".5" fill="currentColor"/></svg><span class="brand-name">Reaction Chamber</span>`;

    const right = h('div', { class: 'topbar-right' });
    this.statusDot = h('span', { class: 'status-dot', role: 'img' });

    this.detailsBtn = h('button', { class: 'btn btn-bar', type: 'button', 'aria-pressed': 'false', title: 'Details (I)' });
    this.detailsBtn.innerHTML = `${icon('details', 16)}<span>Details</span><kbd>I</kbd>`;
    this.detailsBtn.addEventListener('click', () => this.onToggleDetails?.());

    this.moreBtn = h('button', { class: 'icon-btn btn-bar-icon', type: 'button', 'aria-label': 'More', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': 'more-menu', html: icon('more', 18) });
    this.menu = h('div', { class: 'menu', id: 'more-menu', role: 'menu', hidden: true, 'aria-label': 'More' });
    for (const it of items) {
      const b = h('button', { class: 'menu-item', role: 'menuitem', type: 'button', tabindex: '-1' });
      b.innerHTML = `${icon(it.icon, 16)}<span class="mi-label"></span>`;
      (b.querySelector('.mi-label') as HTMLElement).textContent = it.label;
      if (it.hint) b.append(h('span', { class: 'mi-hint', text: it.hint }));
      b.addEventListener('click', () => {
        this.closeMenu(false);
        it.action();
      });
      this.menu.append(b);
    }
    this.menu.append(h('div', { class: 'menu-sep', role: 'separator' }));
    this.engineRow = h('div', { class: 'menu-status' });
    this.serverRow = h('div', { class: 'menu-status' });
    this.menu.append(this.engineRow, this.serverRow);

    this.moreBtn.addEventListener('click', () => (this.menu.hidden ? this.openMenu() : this.closeMenu(true)));
    this.menu.addEventListener('keydown', (e) => this.onMenuKey(e));
    document.addEventListener('pointerdown', (e) => {
      if (!this.menu.hidden && !this.menu.contains(e.target as Node) && !this.moreBtn.contains(e.target as Node)) this.closeMenu(false);
    });

    const center = h('div', { class: 'topbar-center' });
    const stations = [
      { id: 'bench', label: 'Wet Bench' },
      { id: 'electrochem', label: 'Electrochem' },
      { id: 'spectrophotometer', label: 'UV-Vis' },
      { id: 'nmr', label: 'NMR 400 MHz' },
      { id: 'mass_spec', label: 'Mass Spec' },
    ] as const;
    for (const s of stations) {
      const btn = h('button', { class: 'btn btn-bar btn-station', type: 'button', text: s.label });
      btn.addEventListener('click', () => {
        for (const b of center.querySelectorAll('.btn-station')) b.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-pressed', 'true');
        this.onSelectStation?.(s.id);
      });
      center.append(btn);
    }

    const moreWrap = h('div', { class: 'menu-wrap' }, this.moreBtn, this.menu);
    right.append(this.statusDot, this.detailsBtn, moreWrap);
    this.el.append(brand, center, right);
    this.paintStatus();
  }

  public onSelectStation?: (station: 'bench' | 'electrochem' | 'spectrophotometer' | 'nmr' | 'mass_spec') => void;

  public setDetailsOpen(open: boolean) {
    this.detailsBtn.setAttribute('aria-pressed', String(open));
  }

  public setEngineStatus(s: Status, text: string) {
    this.engine = { s, text };
    this.paintStatus();
  }

  public setServerStatus(s: Status, text: string) {
    this.server = { s, text };
    this.paintStatus();
  }

  public get menuOpen(): boolean {
    return !this.menu.hidden;
  }

  public closeMenu(returnFocus: boolean) {
    if (this.menu.hidden) return;
    this.menu.hidden = true;
    this.moreBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) this.moreBtn.focus();
  }

  private openMenu() {
    this.menu.hidden = false;
    this.moreBtn.setAttribute('aria-expanded', 'true');
    (this.menu.querySelector('.menu-item') as HTMLElement | null)?.focus();
  }

  private onMenuKey(e: KeyboardEvent) {
    const items = Array.from(this.menu.querySelectorAll<HTMLElement>('.menu-item'));
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = items.length;
      items[(idx + (e.key === 'ArrowDown' ? 1 : n - 1) + n) % n]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.closeMenu(true);
    } else if (e.key === 'Tab') {
      this.closeMenu(false);
    }
  }

  private paintStatus() {
    const row = (el: HTMLElement, name: string, st: { s: Status; text: string }) => {
      el.innerHTML = '';
      el.append(h('span', { class: `status-dot is-${st.s}`, 'aria-hidden': 'true' }), h('span', { class: 'ms-name', text: name }), h('span', { class: 'ms-val', text: st.text }));
    };
    row(this.engineRow, 'Chemistry engine', this.engine);
    row(this.serverRow, 'Local server', this.server);
    // Bar dot reflects the engine only: the local server is optional.
    this.statusDot.className = `status-dot is-${this.engine.s}`;
    this.statusDot.setAttribute('aria-label', `Chemistry engine: ${this.engine.text}`);
    this.statusDot.title = `Chemistry engine: ${this.engine.text} · Local server: ${this.server.text}`;
  }
}
