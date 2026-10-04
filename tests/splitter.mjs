// Fragment splitter: node tests/splitter.mjs. Formulas come from the atoms of each fragment, never from ion names.
import assert from 'node:assert/strict';
import { splitSaltsAndHydrates, fragmentFormula } from '../web/src/pubchem/splitter.ts';

assert.deepEqual(fragmentFormula('[Na+]'), { formula: 'Na+', charge: 1 });
assert.deepEqual(fragmentFormula('[Mg+2]'), { formula: 'Mg+2', charge: 2 });
assert.deepEqual(fragmentFormula('[Fe+3]'), { formula: 'Fe+3', charge: 3 });
assert.deepEqual(fragmentFormula('[Cl-]'), { formula: 'Cl-', charge: -1 });
assert.equal(fragmentFormula('[O-]S(=O)(=O)[O-]').formula, 'O4S-2');
assert.equal(fragmentFormula('[NH4+]').formula, 'H4N+');
const hyd = splitSaltsAndHydrates('O.O.O.O.O.[O-]S(=O)(=O)[O-].[Cu+2]');
assert.equal(hyd.waterHydrateNumber, 5);
assert.ok(hyd.components.some((c) => c.formula === 'Cu+2') && hyd.components.some((c) => c.formula === 'O4S-2'));
console.log('splitter OK');
