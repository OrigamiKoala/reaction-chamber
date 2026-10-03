import { SpectrumScanResult } from '../equipment/spectrophotometer';
import { NmrSpectrumResult } from '../equipment/nmr';
import { MassSpectrumResult } from '../equipment/mass_spec';
import { MsPeakData, NmrSignalData } from '../types/sim';

/**
 * Draws a UV-Vis absorbance spectrum (A vs lambda) with grid, axis labels, and peak tags.
 */
export function drawUvVisChart(cv: HTMLCanvasElement, scan: SpectrumScanResult | null): void {
  const cssW = cv.parentElement?.clientWidth || 320;
  const H = 160;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = `${cssW}px`;
    cv.style.height = `${H}px`;
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, H);

  // Background
  ctx.fillStyle = '#0f141a';
  ctx.fillRect(0, 0, cssW, H);

  const padL = 36;
  const padR = 14;
  const padT = 18;
  const padB = 24;
  const plotW = cssW - padL - padR;
  const plotH = H - padT - padB;

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssW - padR, y);
    ctx.stroke();
  }
  for (let nm = 400; nm <= 700; nm += 100) {
    const x = padL + ((nm - 350) / 400) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${nm}`, x, H - 8);
  }

  // Y-axis label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Abs', padL - 6, padT + 4);

  if (!scan || scan.points.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Insert sample cuvette & press "Scan Spectrum"', padL + plotW / 2, padT + plotH / 2);
    return;
  }

  const maxA = Math.max(1.0, Math.ceil(scan.maxAbsorbance * 1.25 * 10) / 10);
  ctx.fillText(`${maxA.toFixed(1)}`, padL - 4, padT + 8);
  ctx.fillText('0.0', padL - 4, padT + plotH);

  const getX = (nm: number) => padL + ((nm - 350) / 400) * plotW;
  const getY = (abs: number) => padT + plotH - (abs / maxA) * plotH;

  // Fill area under curve with spectral gradient
  ctx.beginPath();
  ctx.moveTo(getX(scan.points[0].lambda), padT + plotH);
  for (const pt of scan.points) {
    ctx.lineTo(getX(pt.lambda), getY(pt.absorbance));
  }
  ctx.lineTo(getX(scan.points[scan.points.length - 1].lambda), padT + plotH);
  ctx.closePath();

  const fillGrad = ctx.createLinearGradient(padL, 0, cssW - padR, 0);
  fillGrad.addColorStop(0.0, 'rgba(120, 50, 255, 0.25)'); // 350 nm UV/violet
  fillGrad.addColorStop(0.25, 'rgba(0, 150, 255, 0.25)'); // 450 nm blue
  fillGrad.addColorStop(0.5, 'rgba(0, 255, 120, 0.25)'); // 550 nm green
  fillGrad.addColorStop(0.75, 'rgba(255, 200, 0, 0.25)'); // 650 nm yellow/orange
  fillGrad.addColorStop(1.0, 'rgba(255, 50, 50, 0.25)'); // 750 nm red
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 2;
  for (let i = 0; i < scan.points.length; i++) {
    const pt = scan.points[i];
    const x = getX(pt.lambda);
    const y = getY(pt.absorbance);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Peak markers
  for (const pk of scan.peaks) {
    const px = getX(pk.lambda);
    const py = getY(pk.abs);
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${pk.lambda}nm`, px, Math.max(padT + 10, py - 6));
  }
}

function prepCanvas(cv: HTMLCanvasElement, H: number): { ctx: CanvasRenderingContext2D; W: number } | null {
  const cssW = cv.parentElement?.clientWidth || 320;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.width = `${cssW}px`;
    cv.style.height = `${H}px`;
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, H);
  return { ctx, W: cssW };
}

function niceStep(span: number, target: number): number {
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 5, 10]) if (raw <= m * mag) return m * mag;
  return 10 * mag;
}

/**
 * Interactive NMR spectrum: ppm axis running right to left, wheel zoom around the cursor, drag to pan, double-click to
 * toggle between the full range and a fit to the signals. Labels the shift of the strongest multiplets in view.
 */
export class NmrChart {
  private spec: NmrSpectrumResult | null = null;
  private lo = -0.5;
  private hi = 12;
  private full = true;
  private hl: NmrSignalData | null = null;
  private drag: { x: number; lo: number; hi: number } | null = null;
  private readonly H = 230;
  private readonly padL = 12;
  private readonly padR = 12;
  private readonly padT = 16;
  private readonly padB = 24;

  constructor(private cv: HTMLCanvasElement) {
    cv.style.touchAction = 'none';
    cv.style.cursor = 'grab';
    cv.addEventListener(
      'wheel',
      (e) => {
        if (!this.spec) return;
        e.preventDefault();
        const f = e.deltaY < 0 ? 1 / 1.25 : 1.25;
        this.zoomAt(this.ppmAt(e.offsetX), f);
      },
      { passive: false }
    );
    cv.addEventListener('pointerdown', (e) => {
      if (!this.spec) return;
      this.drag = { x: e.offsetX, lo: this.lo, hi: this.hi };
      cv.setPointerCapture(e.pointerId);
      cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const plotW = this.W() - this.padL - this.padR;
      const dppm = ((e.offsetX - this.drag.x) / plotW) * (this.drag.hi - this.drag.lo);
      this.setView(this.drag.lo + dppm, this.drag.hi + dppm, false);
    });
    const end = (e: PointerEvent) => {
      this.drag = null;
      cv.style.cursor = 'grab';
      if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => {
      if (!this.spec) return;
      if (this.full) this.fit();
      else this.resetView();
    });
  }

  private W(): number {
    return this.cv.parentElement?.clientWidth || 320;
  }

  private ppmAt(x: number): number {
    const plotW = this.W() - this.padL - this.padR;
    return this.hi - ((x - this.padL) / plotW) * (this.hi - this.lo);
  }

  private bounds(): [number, number] {
    const s = this.spec;
    if (!s) return [-0.5, 12];
    return [s.ppm_start, s.ppm_start + s.ppm_step * (s.intensity.length - 1)];
  }

  private setView(lo: number, hi: number, isFull: boolean) {
    const [b0, b1] = this.bounds();
    const span = Math.max(hi - lo, (b1 - b0) / 4000);
    let l = lo;
    let h = lo + span;
    if (h - l > b1 - b0) {
      l = b0;
      h = b1;
    }
    if (l < b0 - 0.1 * (b1 - b0)) {
      h += b0 - 0.1 * (b1 - b0) - l;
      l = b0 - 0.1 * (b1 - b0);
    }
    if (h > b1 + 0.1 * (b1 - b0)) {
      l -= h - (b1 + 0.1 * (b1 - b0));
      h = b1 + 0.1 * (b1 - b0);
    }
    this.lo = l;
    this.hi = h;
    this.full = isFull;
    this.render();
  }

  private zoomAt(ppm: number, f: number) {
    const lo = ppm - (ppm - this.lo) * f;
    const hi = ppm + (this.hi - ppm) * f;
    this.setView(lo, hi, false);
  }

  public resetView() {
    const s = this.spec;
    if (s && s.nucleus === '13C') this.setView(-5, 220, true);
    else this.setView(-0.5, 12, true);
  }

  /** Zoom to the observed signals (reference and solvent lines ignored). */
  public fit() {
    const s = this.spec;
    if (!s) return;
    const sig = s.signals.filter((q) => !q.solvent);
    if (!sig.length) return this.resetView();
    const lo = Math.min(...sig.map((q) => q.ppm_lo));
    const hi = Math.max(...sig.map((q) => q.ppm_hi));
    const pad = Math.max(0.4, (hi - lo) * 0.08) * (s.nucleus === '13C' ? 6 : 1);
    this.setView(lo - pad, hi + pad, false);
  }

  /** Zoom to the given ppm window. */
  public zoomTo(a: number, b: number) {
    this.setView(Math.min(a, b), Math.max(a, b), false);
  }

  public highlight(sig: NmrSignalData | null) {
    this.hl = sig;
    this.render();
  }

  public setSpectrum(spec: NmrSpectrumResult | null) {
    this.spec = spec;
    this.hl = null;
    if (spec) {
      this.resetView();
      this.fit();
    } else {
      this.lo = -0.5;
      this.hi = 12;
      this.full = true;
      this.render();
    }
  }

  public render() {
    const pc = prepCanvas(this.cv, this.H);
    if (!pc) return;
    const { ctx, W } = pc;
    const H = this.H;
    ctx.fillStyle = '#0a1016';
    ctx.fillRect(0, 0, W, H);
    const plotW = W - this.padL - this.padR;
    const plotH = H - this.padT - this.padB;
    const spec = this.spec;
    const getX = (ppm: number) => this.padL + ((this.hi - ppm) / (this.hi - this.lo)) * plotW;
    // axis
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.padL, this.padT + plotH + 0.5);
    ctx.lineTo(W - this.padR, this.padT + plotH + 0.5);
    ctx.stroke();
    const step = niceStep(this.hi - this.lo, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let t = Math.ceil(this.lo / step) * step; t <= this.hi + 1e-9; t += step) {
      const x = getX(t);
      ctx.beginPath();
      ctx.moveTo(x, this.padT + plotH);
      ctx.lineTo(x, this.padT + plotH + 4);
      ctx.stroke();
      ctx.fillText(`${Math.abs(t) < 1e-9 ? 0 : +t.toFixed(2)}`, x, H - 8);
    }
    ctx.textAlign = 'right';
    ctx.fillText('δ (ppm)', W - this.padR, this.padT + 8);
    if (!spec || spec.intensity.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Load a tube with LIFT, then press ACQUIRE on the console', this.padL + plotW / 2, this.padT + plotH / 2);
      return;
    }
    const n = spec.intensity.length;
    const iOf = (ppm: number) => (ppm - spec.ppm_start) / spec.ppm_step;
    // highlighted multiplet
    if (this.hl) {
      const x0 = getX(this.hl.ppm_hi + 0.02);
      const x1 = getX(this.hl.ppm_lo - 0.02);
      ctx.fillStyle = 'rgba(255, 210, 74, 0.16)';
      ctx.fillRect(Math.min(x0, x1), this.padT, Math.max(3, Math.abs(x1 - x0)), plotH);
    }
    // envelope per pixel column (high ppm on the left)
    const cols = Math.max(2, Math.floor(plotW));
    const colMax = new Float32Array(cols);
    let top = 0;
    for (let c = 0; c < cols; c++) {
      const pa = this.hi - (c / cols) * (this.hi - this.lo);
      const pb = this.hi - ((c + 1) / cols) * (this.hi - this.lo);
      let i0 = Math.floor(iOf(pb));
      let i1 = Math.ceil(iOf(pa));
      i0 = Math.max(0, i0);
      i1 = Math.min(n - 1, i1);
      let m = -1;
      for (let i = i0; i <= i1; i++) if (spec.intensity[i] > m) m = spec.intensity[i];
      colMax[c] = m < 0 ? 0 : m;
      if (colMax[c] > top) top = colMax[c];
    }
    const floor = Math.max(spec.noise_sigma * 8, 0.003);
    const yMax = Math.max(top, floor) * 1.12;
    const getY = (v: number) => this.padT + plotH - (Math.max(0, v) / yMax) * plotH;
    ctx.strokeStyle = '#20e880';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let c = 0; c < cols; c++) {
      const x = this.padL + c + 0.5;
      const y = getY(colMax[c]);
      if (c === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // shift labels of the strongest multiplets in view
    const vis = spec.signals
      .filter((q) => q.ppm >= this.lo && q.ppm <= this.hi)
      .map((q) => {
        const cx = Math.min(cols - 1, Math.max(0, Math.round(((this.hi - q.ppm) / (this.hi - this.lo)) * cols)));
        let h = 0;
        for (let c = Math.max(0, cx - 6); c <= Math.min(cols - 1, cx + 6); c++) h = Math.max(h, colMax[c]);
        return { q, h };
      })
      .sort((a, b) => b.h - a.h);
    const placed: number[] = [];
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (const { q, h } of vis) {
      const x = getX(q.ppm);
      if (placed.some((px) => Math.abs(px - x) < 30)) continue;
      placed.push(x);
      ctx.fillStyle = q.solvent ? 'rgba(143,183,168,0.9)' : '#66ffcc';
      ctx.fillText(q.ppm.toFixed(spec.nucleus === '1H' ? 2 : 1), x, Math.max(this.padT + 8, getY(h) - 4));
    }
    // reading
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.font = '9px sans-serif';
    ctx.fillText(`${spec.frequency_mhz.toFixed(0)} MHz · ${spec.solvent} · ${spec.scans} scans — scroll to zoom, drag to pan, double-click to fit / reset`, this.padL, this.padT + 8);
  }
}

/** Mass spectrum stick plot (relative abundance % vs m/z) for a list of peaks. */
export function drawMsSpectrum(cv: HTMLCanvasElement, peaks: MsPeakData[] | null, title?: string): void {
  const H = 190;
  const pc = prepCanvas(cv, H);
  if (!pc) return;
  const { ctx, W } = pc;
  ctx.fillStyle = '#10141a';
  ctx.fillRect(0, 0, W, H);
  const padL = 34;
  const padR = 16;
  const padT = 20;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (const pct of [0, 50, 100]) {
    const y = padT + plotH - (pct / 100) * plotH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, padL - 4, y + 3);
  }
  if (!peaks || peaks.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Load a vial and press INJECT on the instrument', padL + plotW / 2, padT + plotH / 2);
    return;
  }
  const maxPk = Math.max(...peaks.map((p) => p.mz));
  const minMz = Math.max(0, Math.floor((Math.min(...peaks.map((p) => p.mz)) - 5) / 10) * 10);
  const maxMz = Math.max(minMz + 40, Math.ceil((maxPk + 8) / 10) * 10);
  const getX = (mz: number) => padL + ((mz - minMz) / (maxMz - minMz)) * plotW;
  const step = niceStep(maxMz - minMz, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  for (let t = Math.ceil(minMz / step) * step; t <= maxMz; t += step) {
    const x = getX(t);
    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 4);
    ctx.stroke();
    ctx.fillText(`${t}`, x, H - 8);
  }
  ctx.textAlign = 'right';
  ctx.fillText('m/z', W - padR, H - 8);
  if (title) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.font = '10px sans-serif';
    ctx.fillText(title, padL, 12);
  }
  const labelled: number[] = [];
  const order = [...peaks].sort((a, b) => b.intensity - a.intensity);
  for (const pk of peaks) {
    const x = Math.round(getX(pk.mz)) + 0.5;
    const y = Math.round(padT + plotH - (pk.intensity / 100) * plotH);
    ctx.strokeStyle = pk.intensity >= 95 ? '#ff5533' : pk.molecular ? '#00e5ff' : '#44aaff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  for (const pk of order) {
    if (pk.intensity < 6 && !pk.molecular) continue;
    const x = getX(pk.mz);
    if (labelled.some((lx) => Math.abs(lx - x) < 20)) continue;
    labelled.push(x);
    const y = Math.round(padT + plotH - (pk.intensity / 100) * plotH);
    ctx.fillStyle = pk.molecular ? '#00e5ff' : '#ffffff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Number.isInteger(pk.mz) ? `${pk.mz}` : pk.mz.toFixed(1), x, Math.max(padT + 8, y - 4));
  }
}

/** Total ion chromatogram with the oven programme; component markers are returned as hit boxes for selection. */
export function drawChromatogram(
  cv: HTMLCanvasElement,
  res: MassSpectrumResult | null,
  selected: number
): Array<{ x0: number; x1: number; index: number }> {
  const H = 150;
  const pc = prepCanvas(cv, H);
  if (!pc) return [];
  const { ctx, W } = pc;
  ctx.fillStyle = '#0f1410';
  ctx.fillRect(0, 0, W, H);
  const padL = 30;
  const padR = 12;
  const padT = 16;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const hits: Array<{ x0: number; x1: number; index: number }> = [];
  if (!res || res.tic.length === 0) return hits;
  const n = res.tic.length;
  const tEnd = res.chrom_dt * (n - 1);
  const getX = (t: number) => padL + (t / tEnd) * plotW;
  const top = Math.max(1e-9, ...res.tic) * 1.08;
  const getY = (v: number) => padT + plotH - (v / top) * plotH;
  // oven temperature (faint)
  if (res.oven.length === n) {
    const tmax = Math.max(...res.oven);
    ctx.strokeStyle = 'rgba(255,170,60,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i += 4) {
      const x = padL + (i / (n - 1)) * plotW;
      const y = padT + plotH - ((res.oven[i] - 30) / (tmax - 30)) * plotH * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = '#7be0a0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = padL + (i / (n - 1)) * plotW;
    const y = getY(res.tic[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const step = niceStep(tEnd, 8);
  for (let t = 0; t <= tEnd; t += step) {
    ctx.fillText(`${+t.toFixed(1)}`, getX(t), H - 7);
  }
  ctx.textAlign = 'right';
  ctx.fillText('min', W - padR, H - 7);
  ctx.textAlign = 'left';
  ctx.fillText('TIC', 4, padT + 4);
  res.components.forEach((c, i) => {
    if (c.rt_min == null) return;
    const x = getX(c.rt_min);
    const idx = Math.min(n - 1, Math.round(c.rt_min / res.chrom_dt));
    const y = getY(res.tic[idx]);
    ctx.fillStyle = i === selected ? '#ffd34a' : '#cfe8d8';
    ctx.font = i === selected ? '700 9px monospace' : '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${c.name.slice(0, 12)} ${c.rt_min.toFixed(2)}`, x, Math.max(padT + 8, y - 5));
    hits.push({ x0: x - 22, x1: x + 22, index: i });
  });
  return hits;
}
