// Salt and hydrate fragment splitter in TypeScript
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

export function splitSaltsAndHydrates(smiles: string): DissolutionResult {
  const fragments = smiles.split('.').filter(Boolean);
  let waterCount = 0;
  const rawComponents: Array<{ fragmentSmiles: string; formula: string; charge: number }> = [];

  for (const frag of fragments) {
    if (frag === 'O' || frag === '[OH2]') {
      waterCount += 1;
      continue;
    }

    // Determine basic charge from brackets
    let charge = 0;
    if (frag.includes('+')) {
      const match = frag.match(/\+(\d*)/);
      charge = match && match[1] ? parseInt(match[1], 10) : 1;
    } else if (frag.includes('-')) {
      const match = frag.match(/-(\d*)/);
      charge = match && match[1] ? -parseInt(match[1], 10) : -1;
    }

    // Clean formula representation
    let cleanFormula = frag.replace(/[\[\]\+\-0-9]/g, '');
    if (frag.includes('Na')) cleanFormula = 'Na+';
    else if (frag.includes('Cl')) cleanFormula = 'Cl-';
    else if (frag.includes('K')) cleanFormula = 'K+';
    else if (frag.includes('Ca')) cleanFormula = 'Ca+2';
    else if (frag.includes('Cu')) cleanFormula = 'Cu+2';
    else if (frag.includes('Fe')) cleanFormula = charge === 3 ? 'Fe+3' : 'Fe+2';
    else if (frag.includes('SO4') || frag.includes('S(=O)(=O)')) cleanFormula = 'SO4-2';
    else if (frag.includes('NO3')) cleanFormula = 'NO3-';
    else if (frag.includes('CO3') || frag.includes('C(=O)')) cleanFormula = 'CO3-2';
    else if (frag.includes('OH')) cleanFormula = 'OH-';
    else cleanFormula = frag;

    rawComponents.push({
      fragmentSmiles: frag,
      formula: cleanFormula,
      charge,
    });
  }

  // Aggregate duplicate fragments
  const compMap: Record<string, { fragmentSmiles: string; formula: string; charge: number; stoichiometry: number }> = {};
  for (const c of rawComponents) {
    if (!compMap[c.formula]) {
      compMap[c.formula] = { ...c, stoichiometry: 1.0 };
    } else {
      compMap[c.formula].stoichiometry += 1.0;
    }
  }

  if (waterCount > 0) {
    compMap['H2O'] = {
      fragmentSmiles: 'O',
      formula: 'H2O',
      charge: 0,
      stoichiometry: waterCount,
    };
  }

  return {
    originalSmiles: smiles,
    isHydrate: waterCount > 0,
    waterHydrateNumber: waterCount,
    components: Object.values(compMap),
  };
}
