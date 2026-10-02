// Ready-made apparatus "setups" shown at the top of the Glassware menu: a click sets out several pieces that already
// belong together (e.g. a stoppered flask + delivery tube + gas collector). Other setups (titration, ...) register
// themselves with `registerSetup`; the panel only needs this list.
import type { IconName } from '../ui/icons';
import type { Lab } from './lab';

export interface SetupSpec {
  id: string;
  label: string;
  /** One line shown under the name. */
  description: string;
  /** Extra search words. */
  keywords: string;
  icon: IconName;
  /** Sets the pieces out on the bench; resolves when they are placed and connected. */
  build: (lab: Lab) => Promise<void>;
}

export const SETUPS: SetupSpec[] = [];

export function registerSetup(s: SetupSpec): void {
  const i = SETUPS.findIndex((x) => x.id === s.id);
  if (i >= 0) SETUPS[i] = s;
  else SETUPS.push(s);
}

export function searchSetups(query: string): SetupSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return SETUPS.slice();
  const words = q.split(/\s+/);
  return SETUPS.filter((s) => {
    const hay = `${s.label} ${s.description} ${s.keywords} setup kit apparatus`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
