// Bottle-type swatch for reagent rows: shape from the dosing mode, tint from the data's bottle colour.
import { ReagentItem, amountMode, bottleTint } from '../app/reagent_library';

const SHAPES = {
  ml: '<path d="M9 3h6v3l2 2v12a1 1 0 01-1 1H8a1 1 0 01-1-1V8l2-2z"/><path class="sw-fill" d="M7.6 13h8.8v6.4a.6.6 0 01-.6.6H8.2a.6.6 0 01-.6-.6z"/>',
  drops: '<path d="M10.5 2.5h3v3h-3z"/><path d="M9.5 5.5h5l1.5 3V20a1 1 0 01-1 1H9a1 1 0 01-1-1V8.5z"/><path class="sw-fill" d="M8.6 14h6.8v5.4a.6.6 0 01-.6.6H9.2a.6.6 0 01-.6-.6z"/>',
  g: '<path d="M6 6h12v2H6z"/><path d="M6.5 8h11v11a2 2 0 01-2 2h-7a2 2 0 01-2-2z"/><path class="sw-fill" d="M7.2 14h9.6v5a1.4 1.4 0 01-1.4 1.4H8.6A1.4 1.4 0 017.2 19z"/>',
};

export function swatchHTML(it: ReagentItem): string {
  const shape = SHAPES[amountMode(it)];
  const tint = bottleTint(it);
  const style = it.kind === 'imported' && /^#[0-9a-f]{6}$/i.test(it.bottle.color) ? ` style="--sw:${it.bottle.color}"` : '';
  return `<span class="swatch swatch-${tint}"${style} aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">${shape}</svg></span>`;
}
