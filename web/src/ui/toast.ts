// Toast notifications (replaces alert()). Polite live region; errors are assertive.
import { icon } from './icons';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';

let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (region) return region;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);
  return region;
}

export function toast(message: string, kind: ToastKind = 'info', durationMs = 4200): void {
  const r = ensureRegion();
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  if (kind === 'error') el.setAttribute('role', 'alert');
  const ic = kind === 'success' ? 'check' : kind === 'error' || kind === 'warning' ? 'warning' : 'info';
  el.innerHTML = `${icon(ic, 16)}<span class="toast-msg"></span><button class="toast-close" aria-label="Dismiss">${icon('close', 14)}</button>`;
  (el.querySelector('.toast-msg') as HTMLElement).textContent = message;
  const remove = () => {
    el.classList.add('leaving');
    window.setTimeout(() => el.remove(), 220);
  };
  el.querySelector('.toast-close')?.addEventListener('click', remove);
  r.appendChild(el);
  // Keep at most 4 visible
  while (r.children.length > 4) r.firstElementChild?.remove();
  window.setTimeout(remove, kind === 'error' ? durationMs * 1.6 : durationMs);
}
