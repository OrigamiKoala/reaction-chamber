// Compact live line chart (canvas) for an instrument's history. Same look as the Details drawer plot:
// faint horizontal grid, 2 px round-joined lines, 'Waiting for data…' placeholder.
import type { Series } from '../app/instrument_log';

export interface ChartLine {
  series: Series;
  color: string;
  /** Fixed value range; omitted = autoscale to the data with a little padding. */
  range?: [number, number];
  /** Draw as a step line (on/off, set-points). */
  step?: boolean;
  alpha?: number;
}

const H = 96;

export function drawSeriesChart(cv: HTMLCanvasElement, lines: ChartLine[], now: number): void {
  const cssW = cv.parentElement?.clientWidth || 300;
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
  ctx.strokeStyle = 'rgba(29,39,48,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = Math.round((H / 4) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cssW, y);
    ctx.stroke();
  }
  const longest = lines.reduce((m, l) => Math.max(m, l.series.length), 0);
  if (longest < 2) {
    ctx.fillStyle = 'rgba(29,39,48,0.45)';
    ctx.font = '12px Archivo, system-ui, sans-serif';
    ctx.fillText('Waiting for data…', 12, H / 2 + 4);
    return;
  }
  // shared time axis: from the oldest stored sample to the latest sim time
  let t0 = Infinity;
  for (const l of lines) l.series.forEach((t) => (t0 = Math.min(t0, t)));
  const t1 = Math.max(t0 + 5, now);
  const pad = 8;
  const x = (t: number) => pad + ((t - t0) / (t1 - t0)) * (cssW - pad * 2);
  for (const l of lines) {
    const st = l.series.stats();
    if (!st) continue;
    let lo = l.range ? l.range[0] : st.min;
    let hi = l.range ? l.range[1] : st.max;
    if (!l.range) {
      const span = Math.max(hi - lo, Math.max(Math.abs(hi), 1) * 0.02); // flat data: don't zoom into noise
      const mid = (hi + lo) / 2;
      lo = mid - span * 0.6;
      hi = mid + span * 0.6;
    }
    const y = (v: number) => H - pad - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (H - pad * 2);
    ctx.strokeStyle = l.color;
    ctx.globalAlpha = l.alpha ?? 1;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    let prevY = 0;
    l.series.forEach((t, v) => {
      if (Number.isNaN(v)) {
        started = false;
        return;
      }
      const yy = y(v);
      if (!started) {
        ctx.moveTo(x(t), yy);
        started = true;
      } else {
        if (l.step) ctx.lineTo(x(t), prevY);
        ctx.lineTo(x(t), yy);
      }
      prevY = yy;
    });
    // hold the last value up to "now"
    if (started) ctx.lineTo(x(t1), prevY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
