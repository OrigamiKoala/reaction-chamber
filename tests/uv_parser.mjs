// Checks for the PubChem UV-text parser. Run: node tests/uv_parser.mjs   (Node >= 22.6 strips TS types)
import assert from 'node:assert/strict';
import { parseUvText, parseUvBands, solventClassOf } from '../web/src/pubchem/uv_parser.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const near = (a, b, tol = 0.02) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} vs ${b}`);

ok('HSDB-style "MAX ABSORPTION (SOLVENT): nm (LOG E= x)" rows', () => {
  const b = parseUvText('MAX ABSORPTION (ALCOHOL): 221 NM (LOG E= 5.04)');
  assert.equal(b.length, 1);
  assert.equal(b[0][0], 221);
  near(b[0][1], 10 ** 5.04);
  assert.equal(b[0][3], 'alcohol');
  const w = parseUvText('Max absorption (water): 664 nm (log e = 4.98)');
  assert.equal(w[0][3], 'water');
  near(w[0][1], 10 ** 4.98);
});

ok('several wavelengths share one row; absorptivity given directly', () => {
  const b = parseUvText('UV max (hexane): 246, 280 nm (log e = 4.1, 3.9)');
  assert.equal(b.length, 2);
  assert.deepEqual(b.map((x) => x[0]), [246, 280]);
  near(b[1][1], 10 ** 3.9);
  assert.equal(b[0][3], 'alkane');
  const e = parseUvText('UV max (water): 520 nm (epsilon = 95,000)');
  near(e[0][1], 95000);
  const x = parseUvText('Max absorption (methanol) 351 nm (e = 2.6X10+4)');
  near(x[0][1], 26000);
});

ok('a wavelength without an absorptivity gives no band; out-of-range wavelengths are dropped', () => {
  assert.deepEqual(parseUvText('Max absorption (water): 664 nm'), []);
  assert.deepEqual(parseUvText('Max absorption (water): 150 nm (log e = 4)'), []);
  assert.deepEqual(parseUvText(''), []);
});

ok('solvent classes and deduplication', () => {
  assert.equal(solventClassOf('cyclohexane'), 'alkane');
  assert.equal(solventClassOf('Ethanol 95%'), 'alcohol');
  assert.equal(solventClassOf('chloroform'), 'other');
  assert.equal(solventClassOf('benzene'), 'aromatic');
  assert.equal(solventClassOf('zzz'), null);
  const all = parseUvBands(['Max absorption (water): 664 nm (log e = 4.98)', 'Max absorption (water): 665 nm (log e = 4.9)', 'Max absorption (ethanol): 665 nm (log e = 4.9)']);
  assert.equal(all.length, 2);
});

console.log(`${n} uv-parser checks passed`);
