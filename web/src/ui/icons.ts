// Small inline SVG icon set (24×24, 1.6 stroke, currentColor). No emoji-as-icons.

const P: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  details: '<path d="M4 19h16"/><path d="M4 15l4-5 4 3 5-7 3 4"/>',
  focus: '<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="12" r="2.5"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',
  play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.4-3.8 2.4-5 .3 1.6 1 2.6 2 3 0-3 0-5.5.6-8z"/>',
  heat: '<path d="M8 4c-1.5 2 1.5 3.5 0 6M12 4c-1.5 2 1.5 3.5 0 6M16 4c-1.5 2 1.5 3.5 0 6"/><rect x="4" y="13" width="16" height="4" rx="1"/><path d="M6 20h12"/>',
  stir: '<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v4.5h-4.5"/><rect x="9" y="11" width="6" height="2" rx="1" fill="currentColor"/>',
  ice: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5"/>',
  stopper: '<path d="M8 4h8l-1 7H9z"/><path d="M7 13h10v7a1 1 0 01-1 1H8a1 1 0 01-1-1z"/>',
  pour: '<path d="M4 7l6-3 2 4-6 3z"/><path d="M11 8c2 2 2 5 2 7"/><path d="M8 15h10l-1 6H9z"/>',
  drop: '<path d="M12 3.5c3 4 5.5 6.8 5.5 10a5.5 5.5 0 01-11 0c0-3.2 2.5-6 5.5-10z"/>',
  scoop: '<path d="M3 20l8-8"/><path d="M11 12c1-3 4-6 7-6 1 0 2 1 2 2 0 3-3 6-6 7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',
  warning: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cloud: '<path d="M7 18h10a4 4 0 00.5-8A6 6 0 006 9.5 4.3 4.3 0 007 18z"/><path d="M12 10.5v6M9.5 14l2.5 2.5 2.5-2.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  bucket: '<path d="M5 8h14l-1.5 12h-11z"/><path d="M8 8a4 4 0 018 0"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  test: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3"/><path d="M7.5 15h9"/>',
  // Glassware silhouettes
  beaker: '<path d="M5 4h14M6 4v15a1 1 0 001 1h10a1 1 0 001-1V4"/><path d="M6 12h12" opacity=".45"/>',
  erlenmeyer: '<path d="M9.5 3h5M10 3v6l-5.5 10a1 1 0 00.9 1.5h13.2a1 1 0 00.9-1.5L14 9V3"/><path d="M7 15h10" opacity=".45"/>',
  cylinder: '<path d="M8 3h8M9 3v16M15 3v16M6 21h12M9 19h6"/><path d="M9 7h2M9 10h3M9 13h2M9 16h3" opacity=".6"/>',
  testTube: '<path d="M9 3h6M10 3v14a2 2 0 004 0V3"/><path d="M10 12h4" opacity=".45"/>',
  roundFlask: '<path d="M9.5 3h5M10 3v5.2a7 7 0 104 0V3"/><path d="M6 15h12" opacity=".45"/>',
  volumetric: '<path d="M10.5 3h3M10.8 3v8.2a6.5 6.5 0 102.4 0V3"/><path d="M9.8 7h4.4" opacity=".7"/><path d="M6.5 17h11" opacity=".45"/>',
  burette: '<path d="M10 2.5h4M10.5 2.5V17M13.5 2.5V17M10.5 17l1.5 3 1.5-3"/><path d="M8 11h5M14 12h2.5" opacity=".8"/><path d="M10.5 5h1.5M10.5 8h1.5M10.5 11h1.5M10.5 14h1.5" opacity=".6"/>',
  pipette: '<path d="M10 3h4M12 3v3M10.6 6h2.8v7a1.4 1.4 0 01-2.8 0z"/><path d="M12 14.4V21" /><path d="M9 9h2" opacity=".6"/>',
  centrifuge: '<path d="M7.5 3h9M8 3v11l4 7 4-7V3"/><path d="M8 8h3M8 11h2" opacity=".6"/>',
  gasTube: '<path d="M8.5 5a3.5 3.5 0 017 0v14M8.5 5v14M6 19h12"/><path d="M8.5 9h2.5M8.5 12h1.5M8.5 15h2.5" opacity=".6"/>',
  syringe: '<path d="M5 8h10v8H5zM15 10.5h5M15 13.5h5M5 12H2.5M2.5 8.5v7"/><path d="M8 8v3M11 8v3" opacity=".6"/>',
  funnel: '<path d="M4 4h16l-6.2 8v4.5M10.2 12L4 4M10.2 12v4.5"/><path d="M10.2 16.5l1.8 4 1.8-4" opacity=".8"/>',
  dish: '<path d="M3.5 9h17M4.5 9c.4 4.2 3.5 7 7.5 7s7.1-2.8 7.5-7"/><path d="M8 19.5h8" opacity=".45"/>',
};

export type IconName = keyof typeof P;

export function icon(name: IconName, size = 18, extraClass = ''): string {
  return `<svg class="ic ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name]}</svg>`;
}

export function iconEl(name: IconName, size = 18, extraClass = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ic-wrap';
  span.innerHTML = icon(name, size, extraClass);
  return span;
}
