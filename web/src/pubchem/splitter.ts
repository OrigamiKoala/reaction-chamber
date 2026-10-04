// Salt and hydrate fragment splitter (display of a PubChem SMILES as its components).
//
// Generic: a fragment's formula is read from its own atoms (element counts, explicit hydrogens in brackets, net charge);
// no ion is recognised by name. Hydrogens that SMILES leaves implicit on bare organic-subset atoms are not counted, so
// the label of a covalent fragment is a skeleton formula (the engine's own identity comes from the PubChem formula).
export interface DissolutionResult {
  originalSmiles: string;
  isHydrate: boolean;
  waterHydrateNumber: number;
  components: Array<{
    fragmentSmiles: string;
    formula: string;
    charge: number;
    stoichiometry: number;
  }>;
}

const ATOM = /\[([A-Za-z]{1,2})(@{0,2})(H\d*)?([+-]{1,2}\d*)?(?::\d+)?\]|Cl|Br|[BCNOPSFI]|[bcnops]/g;

function chargeOf(token: string | undefined): number {
  if (!token) return 0;
  const sign = token[0] === '-' ? -1 : 1;
  const digits = token.slice(1).replace(/[+-]/g, '');
  if (digits) return sign * parseInt(digits, 10);
  return sign * token.replace(/[^+-]/g, '').length;
}

/** Hill-ordered formula with a charge suffix ("Na+", "Cu+2", "O4S-2") of one SMILES fragment. */
export function fragmentFormula(frag: string): { formula: string; charge: number } {
  const counts = new Map<string, number>();
  let charge = 0;
  for (const m of frag.matchAll(ATOM)) {
    if (m[1] !== undefined) {
      const el = m[1][0].toUpperCase() + m[1].slice(1);
      counts.set(el, (counts.get(el) ?? 0) + 1);
      if (m[3]) {
        const n = m[3].length > 1 ? parseInt(m[3].slice(1), 10) : 1;
        counts.set('H', (counts.get('H') ?? 0) + n);
      }
      charge += chargeOf(m[4]);
    } else {
      const el = m[0][0].toUpperCase() + m[0].slice(1);
      counts.set(el, (counts.get(el) ?? 0) + 1);
    }
  }
  const order = [...counts.keys()].sort((a, b) => {
    const rank = (e: string) => (e === 'C' ? 0 : e === 'H' ? 1 : 2);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const body = order.map((e) => e + ((counts.get(e) ?? 0) > 1 ? counts.get(e) : '')).join('');
  const suffix = charge === 0 ? '' : charge === 1 ? '+' : charge === -1 ? '-' : charge > 0 ? `+${charge}` : `${charge}`;
  return { formula: body + suffix, charge };
}

export function splitSaltsAndHydrates(smiles: string): DissolutionResult {
  const fragments = smiles.split('.').filter(Boolean);
  let waterCount = 0;
  const compMap: Record<string, { fragmentSmiles: string; formula: string; charge: number; stoichiometry: number }> = {};

  for (const frag of fragments) {
    if (frag === 'O' || frag === '[OH2]') {
      waterCount += 1;
      continue;
    }
    const { formula, charge } = fragmentFormula(frag);
    if (!compMap[formula]) compMap[formula] = { fragmentSmiles: frag, formula, charge, stoichiometry: 1 };
    else compMap[formula].stoichiometry += 1;
  }

  if (waterCount > 0) {
    compMap['H2O'] = { fragmentSmiles: 'O', formula: 'H2O', charge: 0, stoichiometry: waterCount };
  }

  return {
    originalSmiles: smiles,
    isHydrate: waterCount > 0,
    waterHydrateNumber: waterCount,
    components: Object.values(compMap),
  };
}
