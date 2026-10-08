// Merge and ranking of compound-search hits from several databases. Run: node tests/db_search.mjs (Node >= 22.6)
import assert from 'node:assert/strict';
import { mergeHits, rankHits, formulaKey } from '../web/src/data/search/merge_hits.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};

ok('formula key is order independent and ignores hydrate suffixes and charge', () => {
  assert.equal(formulaKey('ClNa'), formulaKey('NaCl'));
  assert.equal(formulaKey('CuSO4.5H2O'), formulaKey('CuSO4'));
  assert.equal(formulaKey('Ca(OH)2'), formulaKey('CaH2O2'));
  assert.equal(formulaKey('C3H6O'), formulaKey('H6C3O'));
  assert.notEqual(formulaKey('C3H6O'), formulaKey('C3H6O2'));
});

ok('hits of three databases for one compound become one row (transitively)', () => {
  const m = mergeHits([
    { source: 'pubchem', name: 'Acetone', formula: 'C3H6O', inchikey: 'CSCPPACGZOOCGX-UHFFFAOYSA-N', cid: 180 },
    { source: 'nist', name: 'Acetone', formula: 'C3H6O', cas: '67-64-1' },
    { source: 'cas', name: 'Acetone', formula: 'C3H6O', cas: '67-64-1', inchikey: 'CSCPPACGZOOCGX-UHFFFAOYSA-N' },
  ]);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0].sources.sort(), ['cas', 'nist', 'pubchem']);
  assert.equal(m[0].cas, '67-64-1');
  assert.equal(m[0].cid, 180);
});

ok('isomers with the same formula are not merged', () => {
  const m = mergeHits([
    { source: 'nist', name: 'Acetone', formula: 'C3H6O', cas: '67-64-1' },
    { source: 'nist', name: 'Propanal', formula: 'C3H6O', cas: '123-38-6' },
  ]);
  assert.equal(m.length, 2);
});

ok('an exact name ranks before names that merely start with it', () => {
  const m = rankHits('acetone', mergeHits([
    { source: 'pubchem', name: 'Acetone oxime', formula: 'C3H7NO', inchikey: 'A-X-N' },
    { source: 'pubchem', name: 'Acetone semicarbazone', formula: 'C4H9N3O', inchikey: 'B-X-N' },
    { source: 'pubchem', name: 'acetone', formula: 'C3H6O', inchikey: 'CSCPPACGZOOCGX-UHFFFAOYSA-N' },
  ]));
  assert.equal(m[0].name, 'acetone');
});

ok('elements and ions are recognised; the neutral element beats the ion for "copper"', () => {
  const m = rankHits('copper', mergeHits([
    { source: 'pubchem', name: 'Copper(2+)', formula: 'Cu', charge: 2, inchikey: 'JPVYNHNXODAKFH-UHFFFAOYSA-N' },
    { source: 'pubchem', name: 'copper', formula: 'Cu', charge: 0, inchikey: 'RYGMFSIKBFXOCR-UHFFFAOYSA-N', cid: 23978 },
    { source: 'nist', name: 'Copper', formula: 'Cu', cas: '7440-50-8' },
  ]));
  assert.equal(m[0].kind, 'element');
  assert.equal(m[0].cid, 23978);
  assert.equal(m.find((h) => h.charge === 2).kind, 'ion');
});

ok('hydrogen gas: H2 is an element, found by formula too', () => {
  const m = rankHits('H2', mergeHits([
    { source: 'nist', name: 'Hydrogen, atomic', formula: 'H', cas: '12385-13-6' },
    { source: 'nist', name: 'Hydrogen', formula: 'H2', cas: '1333-74-0' },
  ]));
  assert.equal(m[0].name, 'Hydrogen');
  assert.equal(m[0].kind, 'element');
});

ok('a CAS number or InChIKey query puts that compound first', () => {
  const m = rankHits('67-64-1', mergeHits([
    { source: 'nist', name: 'Propanal', formula: 'C3H6O', cas: '123-38-6' },
    { source: 'nist', name: 'Acetone', formula: 'C3H6O', cas: '67-64-1' },
  ]));
  assert.equal(m[0].name, 'Acetone');
});

console.log(`${n} checks passed`);
