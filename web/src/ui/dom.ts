// Tiny DOM helpers shared by the UI modules.

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

/** Create an element. Attributes: `class`, `text`, `html` are special; booleans toggle presence. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Set textContent only when it changed (avoids layout churn at 20 Hz). */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };

/**
 * Generic formula prettifier: "SO4-2" → "SO₄²⁻", "Cu(NH3)4+2" → "Cu(NH₃)₄²⁺", "AgCl(s)" unchanged.
 * Works on any engine/PubChem formula string; no per-compound tables.
 */
export function prettyFormula(f: string): string {
  if (!f) return '';
  // isomers share a formula and are told apart by an internal `#HASH` suffix of the engine id ("C6H14#VLKZOEOY(g)"): never shown
  let core = f.replace(/#[A-Za-z0-9]+/, '');
  let phase = '';
  const ph = core.match(/\((s|l|g|aq)\)$/);
  if (ph) {
    phase = ph[0];
    core = core.slice(0, -phase.length);
  }
  let charge = '';
  const ch = core.match(/([+-])(\d*)$/);
  if (ch && core.length > ch[0].length && /[A-Za-z0-9)\]]/.test(core[core.length - ch[0].length - 1])) {
    const n = ch[2] && ch[2] !== '1' ? ch[2] : '';
    charge = n.split('').map((d) => SUP[d]).join('') + SUP[ch[1]];
    core = core.slice(0, -ch[0].length);
  }
  core = core.replace(/([A-Za-z)\]])(\d+)/g, (_m, a: string, d: string) => a + d.split('').map((x) => SUB[x]).join(''));
  return core + charge + phase;
}

export function fmtNumber(v: number, digits = 2): string {
  if (!isFinite(v)) return '—';
  return v.toFixed(digits);
}

/** Concentration with a sensible unit (M / mM / µM). */
export function fmtConc(m: number): string {
  const a = Math.abs(m);
  if (a >= 0.1) return `${m.toFixed(2)} M`;
  if (a >= 1e-4) return `${(m * 1e3).toPrecision(3)} mM`;
  if (a >= 1e-7) return `${(m * 1e6).toPrecision(3)} µM`;
  return `${m.toExponential(1)} M`;
}

export function fmtAmountMol(mol: number): string {
  const a = Math.abs(mol);
  if (a >= 0.1) return `${mol.toFixed(2)} mol`;
  if (a >= 1e-4) return `${(mol * 1e3).toPrecision(3)} mmol`;
  return `${(mol * 1e6).toPrecision(3)} µmol`;
}

export function fmtClock(tSec: number): string {
  const t = Math.max(0, tSec);
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

export function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (t.isContentEditable) return true;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (t as HTMLInputElement).type;
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset'].includes(type);
  }
  return false;
}
