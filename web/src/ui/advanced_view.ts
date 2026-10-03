// Details drawer: live plot, conservation, energetics, reactions and full species table
// for the selected vessel only. Tables refresh at ~4 Hz; the plot at ~10 Hz.
import { VesselSnapshot } from '../types/sim';
import { h, esc, prettyFormula, setText } from './dom';
import { icon } from './icons';

interface Point {
  t: number;
  tempK: number;
  ph: number | null;
  pressureAtm: number;
}

const SERIES = {
  temp: '#d1495b',
  ph: '#0f7c86',
  press: '#6a4fb3',
};

export class AdvancedView {
  public readonly el: HTMLElement;
  public isVisible = false;
  public onVisibilityChange?: (open: boolean) => void;
  private snap: VesselSnapshot | null = null;
  private history: Point[] = [];
  private vesselId: string | null = null;
  private canvas: HTMLCanvasElement;
  private subtitle: HTMLElement;
  private lastTable = 0;
  private lastPlot = 0;
  private maxHistoryS = 600;

  constructor() {
    this.el = h('aside', { class: 'drawer', id: 'details-drawer', 'aria-label': 'Details', hidden: true, tabindex: '-1' });
    this.el.innerHTML = `
      <header class="drawer-head">
        <div>
          <h2 class="drawer-title">Details</h2>
          <p class="drawer-sub"></p>
        </div>
        <button class="icon-btn drawer-close" aria-label="Close details (I)">${icon('close', 18)}</button>
      </header>
      <div class="drawer-body">
        <section class="d-sec">
          <h3 class="eyebrow">Last 10 minutes</h3>
          <div class="plot-wrap"><canvas class="plot" height="170" role="img" aria-label="Temperature, pH and pressure over time"></canvas></div>
          <div class="legend">
            <span><i style="background:${SERIES.temp}"></i><b data-k="lg-temp">Temperature</b></span>
            <span><i style="background:${SERIES.ph}"></i>pH (0–14)</span>
            <span><i style="background:${SERIES.press}"></i><b data-k="lg-press">Pressure</b></span>
          </div>
        </section>
        <div class="d-grid">
          <section class="d-card"><h3 class="eyebrow">Conservation</h3><dl class="kv" data-k="cons"></dl></section>
          <section class="d-card"><h3 class="eyebrow">Heat &amp; mass</h3><dl class="kv" data-k="energy"></dl></section>
        </div>
        <section class="d-sec">
          <h3 class="eyebrow">Appearance (what the engine tells the renderer)</h3>
          <div class="table-wrap"><table class="dtable">
            <thead><tr><th>Liquid layer</th><th class="num">mL</th><th class="num">ρ g/mL</th><th class="num">n</th><th>Solvent</th><th>Colour from</th><th>Data</th></tr></thead>
            <tbody data-k="layers"></tbody></table></div>
          <div class="table-wrap"><table class="dtable">
            <thead><tr><th>Solid</th><th>Form</th><th class="num">g</th><th class="num">d (µm)</th><th class="num">σg</th><th class="num">Suspended</th><th class="num">Settles mm/s</th><th>Colour from</th><th>Data</th></tr></thead>
            <tbody data-k="solids"></tbody></table></div>
          <dl class="kv" data-k="visual"></dl>
        </section>
        <section class="d-sec">
          <h3 class="eyebrow">Reactions</h3>
          <div class="table-wrap"><table class="dtable">
            <thead><tr><th>Equation</th><th>Kind</th><th class="num">Rate mol/(L·s)</th><th class="num">log Q/K</th><th>Data</th><th>Source</th></tr></thead>
            <tbody data-k="rxn"></tbody></table></div>
        </section>
        <section class="d-sec">
          <h3 class="eyebrow">Species</h3>
          <div class="table-wrap"><table class="dtable">
            <thead><tr><th>Species</th><th>Phase</th><th class="num">Amount (mol)</th><th class="num">Conc (M)</th><th class="num">Activity</th><th>Data</th></tr></thead>
            <tbody data-k="sp"></tbody></table></div>
        </section>
      </div>`;
    document.body.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas.plot') as HTMLCanvasElement;
    this.subtitle = this.el.querySelector('.drawer-sub') as HTMLElement;
    this.el.querySelector('.drawer-close')?.addEventListener('click', () => this.hide());
    window.addEventListener('resize', () => this.isVisible && this.drawPlot());
  }

  public show() {
    this.isVisible = true;
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('is-open'));
    this.render(true);
    this.onVisibilityChange?.(true);
  }

  public hide() {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.el.classList.remove('is-open');
    this.el.hidden = true;
    this.onVisibilityChange?.(false);
  }

  public toggle() {
    if (this.isVisible) this.hide();
    else this.show();
  }

  /** Switch to another vessel: history restarts. */
  public setVessel(id: string | null, name: string) {
    if (id === this.vesselId) {
      setText(this.subtitle, id ? name : 'No vessel selected');
      return;
    }
    this.vesselId = id;
    this.history = [];
    this.snap = null;
    setText(this.subtitle, id ? name : 'No vessel selected');
    this.render(true);
  }

  public updateSnapshot(snap: VesselSnapshot) {
    this.snap = snap;
    const last = this.history[this.history.length - 1];
    if (last && snap.t_sim_s < last.t) this.history = [];
    this.history.push({ t: snap.t_sim_s, tempK: snap.temperature_k, ph: snap.ph, pressureAtm: snap.pressure_atm });
    const oldest = snap.t_sim_s - this.maxHistoryS;
    while (this.history.length && this.history[0].t < oldest) this.history.shift();
    if (this.isVisible) this.render(false);
  }

  private render(force: boolean) {
    const now = performance.now();
    if (force || now - this.lastPlot > 100) {
      this.lastPlot = now;
      this.drawPlot();
    }
    if (!force && now - this.lastTable < 250) return;
    this.lastTable = now;
    const s = this.snap;
    const q = (k: string) => this.el.querySelector(`[data-k="${k}"]`) as HTMLElement;
    if (!s) {
      q('cons').innerHTML = '<dt>—</dt><dd></dd>';
      q('energy').innerHTML = '<dt>—</dt><dd></dd>';
      q('rxn').innerHTML = '<tr><td colspan="6" class="empty-cell">No data yet</td></tr>';
      q('sp').innerHTML = '<tr><td colspan="6" class="empty-cell">No data yet</td></tr>';
      return;
    }
    const c = s.conservation;
    q('cons').innerHTML = `
      <dt>Status</dt><dd class="${c.ok ? 'ok' : 'bad'}">${c.ok ? 'Balanced' : 'Check failed'}</dd>
      <dt>Charge error</dt><dd>${c.charge_err_mol.toExponential(2)} mol</dd>
      <dt>Element error</dt><dd>${(c.max_element_rel_err * 100).toFixed(4)} % (max ${c.max_element_abs_err_mol.toExponential(1)} mol)</dd>
      ${c.unverified_species.length > 0 ? `<dt>Not covered</dt><dd title="Formula cannot be parsed, so its atoms are not checked">${esc(c.unverified_species.join(', '))}</dd>` : ''}`;
    q('energy').innerHTML = `
      <dt>Temperature</dt><dd>${s.temperature_k.toFixed(2)} K · ${(s.temperature_k - 273.15).toFixed(2)} °C</dd>
      <dt>Contents</dt><dd>${s.contents_mass_g.toFixed(2)} g</dd>
      <dt>Lost as gas</dt><dd>${s.mass_lost_g.toFixed(2)} g</dd>
      <dt>Heater</dt><dd>${s.heat_input_w.toFixed(0)} W</dd>
      <dt>Reaction heat</dt><dd>${s.net_reaction_heat_w.toFixed(1)} W</dd>
      <dt>Ionic strength</dt><dd>${s.ionic_strength !== null ? s.ionic_strength.toFixed(4) + ' M' : '—'}</dd>`;
    this.renderAppearance(s, q);
    q('rxn').innerHTML = s.reactions.length
      ? s.reactions
          .map(
            (r) => `<tr class="${r.active ? '' : 'is-idle'}">
              <td class="mono">${esc(r.equation)}</td>
              <td><span class="tag">${esc(r.kind)}</span></td>
              <td class="num mono">${r.rate.toExponential(2)}</td>
              <td class="num mono">${r.log_q_over_k !== null ? r.log_q_over_k.toFixed(2) : '—'}</td>
              <td><span class="tier tier-${esc(r.tier)}">${esc(r.tier)}</span></td>
              <td class="src">${esc(r.source)}</td></tr>`,
          )
          .join('')
      : '<tr><td colspan="6" class="empty-cell">No reactions running</td></tr>';
    q('sp').innerHTML = s.species.length
      ? s.species
          .slice()
          .sort((a, b) => b.amount_mol - a.amount_mol)
          .map(
            (sp) => `<tr>
              <td><span class="mono">${esc(prettyFormula(sp.formula || sp.id))}</span>${sp.name && sp.name !== sp.formula && sp.name !== sp.id ? ` <span class="muted">${esc(sp.name)}</span>` : ''}</td>
              <td><span class="tag">${esc(sp.phase)}</span></td>
              <td class="num mono">${sp.amount_mol.toExponential(3)}</td>
              <td class="num mono">${sp.conc_m !== null ? sp.conc_m.toExponential(3) : '—'}</td>
              <td class="num mono">${sp.activity !== null ? sp.activity.toExponential(3) : '—'}</td>
              <td><span class="tier tier-${esc(sp.tier)}">${esc(sp.tier)}</span></td></tr>`,
          )
          .join('')
      : '<tr><td colspan="6" class="empty-cell">Empty</td></tr>';
  }

  private renderAppearance(s: VesselSnapshot, q: (k: string) => HTMLElement) {
    const tier = (t: string | undefined) => (t ? `<span class="tier tier-${esc(t)}">${esc(t)}</span>` : '—');
    q('layers').innerHTML = s.layers.length
      ? s.layers
          .map((l) => {
            const a = l.absorbance_per_cm;
            const amax = a.length ? Math.max(...a) : 0;
            const sc = l.scatter_per_cm.length ? Math.max(...l.scatter_per_cm) : 0;
            const look = amax < 1e-3 && sc < 1e-3 ? 'colourless' : sc > 0.3 ? `turbid (${sc.toFixed(2)} /cm)` : `A max ${amax.toFixed(2)} /cm`;
            const name = l.name ?? l.species ?? (l.phase === 'aqueous' ? 'aqueous' : 'organic');
            return `<tr><td>${esc(name)} <span class="muted">${esc(look)}</span></td>
              <td class="num mono">${l.volume_ml.toFixed(1)}</td><td class="num mono">${l.density_g_ml.toFixed(3)}</td><td class="num mono">${l.refractive_index.toFixed(3)}</td>
              <td>${esc(l.solvent_class ?? '—')}</td><td class="src">${esc((l.colour_sources ?? []).join('; ') || '—')}</td><td>${tier(l.colour_tier)}</td></tr>`;
          })
          .join('')
      : '<tr><td colspan="7" class="empty-cell">No liquid</td></tr>';
    q('solids').innerHTML = s.solids.length
      ? s.solids
          .map((x) => {
            const form = x.floating ? `${x.kind} (floats)` : x.kind;
            return `<tr><td><span class="mono">${esc(prettyFormula(x.species))}</span> <span class="muted">${esc(x.name)}</span></td>
              <td>${esc(form)}</td><td class="num mono">${x.mass_g.toFixed(3)}</td><td class="num mono">${x.particle_diameter_um.toFixed(1)}</td>
              <td class="num mono">${x.particle_sigma_g ? x.particle_sigma_g.toFixed(2) : '—'}</td><td class="num mono">${(x.suspended_fraction * 100).toFixed(0)} %</td>
              <td class="num mono">${(x.settling_velocity_mm_s ?? 0).toExponential(1)}</td><td class="src">${esc(x.colour_source ?? '—')}</td><td>${tier(x.colour_tier)}</td></tr>`;
          })
          .join('')
      : '<tr><td colspan="9" class="empty-cell">No solids</td></tr>';
    // gas and vapour: the fluxes of one species add up (the engine reports one row per reaction)
    const flux = new Map<string, { rate: number; d: number; w: number; site: string }>();
    for (const g of s.gas_fluxes) {
      if (g.rate_ml_s < 1e-6) continue;
      const e = flux.get(g.species) ?? { rate: 0, d: 0, w: 0, site: g.nucleation };
      e.rate += g.rate_ml_s;
      e.d += g.bubble_diameter_mm * g.rate_ml_s;
      e.w += g.rate_ml_s;
      flux.set(g.species, e);
    }
    const rows: string[] = [];
    for (const [sp, e] of flux) rows.push(`<dt>${esc(prettyFormula(sp))} bubbles</dt><dd>${e.rate.toFixed(e.rate < 1 ? 3 : 1)} mL/s · ⌀ ${(e.d / e.w).toFixed(2)} mm · from ${esc(e.site)}</dd>`);
    for (const f of s.fumes) {
      rows.push(`<dt>${esc(prettyFormula(f.species))} ${f.kind === 'aerosol' ? 'smoke' : 'fumes'}</dt><dd>intensity ${f.intensity.toFixed(2)} · ${f.denser_than_air ? `sinks (${(f.density_ratio ?? 0).toFixed(2)}× air)` : 'rises'}</dd>`);
    }
    if (s.boil_intensity > 0.01) rows.push(`<dt>Boiling</dt><dd>${(s.boil_intensity * 100).toFixed(0)} %</dd>`);
    if (s.evaporation_g_s > 1e-5) rows.push(`<dt>Evaporation</dt><dd>${s.evaporation_g_s.toExponential(2)} g/s</dd>`);
    if (s.foam > 0.01) rows.push(`<dt>Foam</dt><dd>${(s.foam * 100).toFixed(0)} % of the surface</dd>`);
    if (s.condensation > 0.01) rows.push(`<dt>Fogged glass</dt><dd>${(s.condensation * 100).toFixed(0)} %</dd>`);
    if (s.flame) rows.push(`<dt>Flame</dt><dd>${esc(prettyFormula(s.flame.fuel))} · ${s.flame.power_w.toFixed(0)} W · ${s.flame.flame_temp_k.toFixed(0)} K${s.flame.emitters?.length ? ' · ' + esc(s.flame.emitters.join(', ')) : ''}</dd>`);
    q('visual').innerHTML = rows.length ? rows.join('') : '<dt>Gas, vapour, flame</dt><dd>none</dd>';
  }

  private drawPlot() {
    const cv = this.canvas;
    const cssW = cv.parentElement?.clientWidth || 600;
    const cssH = 170;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) {
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
      cv.style.width = `${cssW}px`;
      cv.style.height = `${cssH}px`;
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.strokeStyle = 'rgba(29,39,48,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = Math.round((cssH / 5) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }
    const hist = this.history;
    if (hist.length < 2) {
      ctx.fillStyle = 'rgba(29,39,48,0.45)';
      ctx.font = '12px Archivo, system-ui, sans-serif';
      ctx.fillText('Waiting for data…', 12, cssH / 2);
      return;
    }
    const t0 = hist[0].t;
    const t1 = Math.max(t0 + 5, hist[hist.length - 1].t);
    const pad = 8;
    const x = (t: number) => pad + ((t - t0) / (t1 - t0)) * (cssW - pad * 2);
    const yMap = (v: number, lo: number, hi: number) => cssH - pad - ((v - lo) / (hi - lo)) * (cssH - pad * 2);
    const line = (color: string, get: (p: Point) => number | null, lo: number, hi: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (const p of hist) {
        const v = get(p);
        if (v === null) {
          started = false;
          continue;
        }
        const yy = yMap(Math.max(lo, Math.min(hi, v)), lo, hi);
        if (!started) {
          ctx.moveTo(x(p.t), yy);
          started = true;
        } else ctx.lineTo(x(p.t), yy);
      }
      ctx.stroke();
    };
    // axes follow the data (a frozen sample, a flame or a sealed vessel under pressure must not be clipped)
    let tLo = 270, tHi = 380, pLo = 0.5, pHi = 4;
    for (const p of hist) {
      tLo = Math.min(tLo, p.tempK);
      tHi = Math.max(tHi, p.tempK);
      pHi = Math.max(pHi, p.pressureAtm);
      pLo = Math.min(pLo, p.pressureAtm);
    }
    tLo = Math.floor((tLo - 3) / 10) * 10;
    tHi = Math.ceil((tHi + 3) / 10) * 10;
    pHi = Math.ceil(pHi * 2) / 2;
    pLo = Math.floor(pLo * 2) / 2;
    const lgT = this.el.querySelector('[data-k="lg-temp"]');
    const lgP = this.el.querySelector('[data-k="lg-press"]');
    if (lgT) setText(lgT as HTMLElement, `Temperature (${tLo}–${tHi} K)`);
    if (lgP) setText(lgP as HTMLElement, `Pressure (${pLo}–${pHi} atm)`);
    line(SERIES.temp, (p) => p.tempK, tLo, tHi);
    line(SERIES.ph, (p) => p.ph, 0, 14);
    line(SERIES.press, (p) => p.pressureAtm, pLo, pHi);
  }
}
