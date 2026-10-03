import { SpectrumScanResult } from '../equipment/spectrophotometer';
import { NmrSpectrumResult } from '../equipment/nmr';
import { MassSpectrumResult } from '../equipment/mass_spec';

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

/**
 * Draws a 1H or 13C NMR spectrum with inverted ppm scale and Lorentzian peaks.
 */
export function drawNmrChart(cv: HTMLCanvasElement, spec: NmrSpectrumResult | null): void {
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
  ctx.fillStyle = '#0a1016';
  ctx.fillRect(0, 0, cssW, H);

  const padL = 20;
  const padR = 20;
  const padT = 20;
  const padB = 24;
  const plotW = cssW - padL - padR;
  const plotH = H - padT - padB;

  const is1H = !spec || spec.nucleus === '1H';
  const minPpm = is1H ? 0.0 : 0.0;
  const maxPpm = is1H ? 12.0 : 210.0;

  // Inverted ppm axis (NMR standard: High ppm on LEFT, 0 ppm on RIGHT)
  const getX = (ppm: number) => padL + ((maxPpm - ppm) / (maxPpm - minPpm)) * plotW;

  // Baseline grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT + plotH);
  ctx.lineTo(cssW - padR, padT + plotH);
  ctx.stroke();

  // Tick marks on ppm axis
  const tickStep = is1H ? 2 : 40;
  for (let ppm = 0; ppm <= maxPpm; ppm += tickStep) {
    const x = getX(ppm);
    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${ppm}`, x, H - 6);
  }

  // Unit label
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('δ (ppm)', cssW - padR, padT + 8);

  if (!spec || spec.curvePoints.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Insert 5mm tube & press "Pulse & Acquire FID"', padL + plotW / 2, padT + plotH / 2);
    return;
  }

  let maxInt = 0.01;
  for (const pt of spec.curvePoints) if (pt.intensity > maxInt) maxInt = pt.intensity;

  const getY = (val: number) => padT + plotH - (val / (maxInt * 1.15)) * plotH;

  // Curve
  ctx.beginPath();
  ctx.strokeStyle = '#20e880';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < spec.curvePoints.length; i++) {
    const pt = spec.curvePoints[i];
    const x = getX(pt.ppm);
    const y = getY(pt.intensity);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Peak ppm labels
  for (const pk of spec.peaks) {
    const px = getX(pk.ppm);
    ctx.fillStyle = '#66ffcc';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${pk.ppm.toFixed(2)}`, px, padT + 12);
    ctx.strokeStyle = 'rgba(102,255,204,0.3)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(px, padT + 16);
    ctx.lineTo(px, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Draws a Mass Spectrum stick plot (relative abundance % vs m/z).
 */
export function drawMassSpecChart(cv: HTMLCanvasElement, spec: MassSpectrumResult | null): void {
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
  ctx.fillStyle = '#10141a';
  ctx.fillRect(0, 0, cssW, H);

  const padL = 34;
  const padR = 16;
  const padT = 18;
  const padB = 24;
  const plotW = cssW - padL - padR;
  const plotH = H - padT - padB;

  // Y-axis grid (0%, 50%, 100%)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (const pct of [0, 50, 100]) {
    const y = padT + plotH - (pct / 100) * plotH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssW - padR, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, padL - 4, y + 3);
  }

  const minMz = 10;
  const maxMz = spec ? Math.max(120, Math.ceil((spec.molecularWeight + 30) / 20) * 20) : 150;
  const getX = (mz: number) => padL + ((mz - minMz) / (maxMz - minMz)) * plotW;

  // X ticks
  const mzStep = maxMz > 200 ? 50 : 20;
  for (let mz = 20; mz <= maxMz; mz += mzStep) {
    const x = getX(mz);
    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, padT + plotH + 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${mz}`, x, H - 6);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('m/z', cssW - padR, H - 6);

  if (!spec || spec.peaks.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Select sample & press "Acquire Mass Spectrum"', padL + plotW / 2, padT + plotH / 2);
    return;
  }

  // Draw sticks
  for (const pk of spec.peaks) {
    const x = Math.round(getX(pk.mz)) + 0.5;
    const y = Math.round(padT + plotH - (pk.intensity / 100) * plotH);

    ctx.strokeStyle = pk.intensity >= 95 ? '#ff5533' : pk.isMolecularIon ? '#00e5ff' : '#44aaff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, padT + plotH);
    ctx.lineTo(x, y);
    ctx.stroke();

    // Peak label if prominent
    if (pk.intensity >= 15 || pk.isMolecularIon) {
      ctx.fillStyle = pk.isMolecularIon ? '#00e5ff' : '#ffffff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${pk.mz}`, x, Math.max(padT + 8, y - 4));
    }
  }
}
