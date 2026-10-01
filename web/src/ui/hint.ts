// One-time dismissible onboarding hint, remembered per browser.
import { loadJSON, saveJSON } from '../app/storage';
import { h } from './dom';
import { icon } from './icons';

const KEY = 'rc.hint.dismissed.v2';

export function createHint(text: string): HTMLElement | null {
  if (loadJSON<boolean>(KEY, false)) return null;
  const el = h('div', { class: 'hint', role: 'note' });
  el.innerHTML = `${icon('info', 16)}<span class="hint-text"></span>`;
  (el.querySelector('.hint-text') as HTMLElement).textContent = text;
  const close = h('button', { class: 'icon-btn', 'aria-label': 'Dismiss hint', html: icon('close', 14) });
  close.addEventListener('click', () => {
    saveJSON(KEY, true);
    el.remove();
  });
  el.append(close);
  return el;
}
