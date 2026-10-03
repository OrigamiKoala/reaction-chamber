// Checks for the PubChem colour-phrase parser. Run: node tests/colour_lexicon.mjs   (Node >= 22.6 strips TS types)
import assert from 'node:assert/strict';
import { parseColourPhrase } from '../web/src/pubchem/colour_lexicon.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hue = (hex) => {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx - mn < 18) return mx > 200 ? 'white' : mx < 60 ? 'black' : 'grey';
  if (mx === r) return g > b ? (g > 0.75 * r ? 'yellow' : 'orange') : b > 0.5 * r ? 'magenta' : 'red';
  if (mx === g) return b > 0.85 * g ? 'cyan' : r > 0.8 * g ? 'yellow' : 'green';
  return r > 0.65 * b && g < 0.8 * r ? 'purple' : g > 0.75 * b ? 'cyan' : 'blue';
};

ok('single colour words, subjects and confidence', () => {
  const p = parseColourPhrase(['White crystalline powder']);
  assert.equal(hue(p.hex), 'white');
  assert.equal(p.subject, 'solid');
  assert.ok(p.confidence >= 0.85);
  assert.equal(hue(parseColourPhrase(['Deep purple crystals']).hex), 'purple');
  assert.equal(hue(parseColourPhrase(['Dark blue crystalline solid']).hex), 'blue');
});

ok('compound hues and modifiers', () => {
  assert.equal(hue(parseColourPhrase(['Bluish green crystals']).hex), 'green');
  assert.ok(parseColourPhrase(['Bluish green crystals']).confidence < 0.85);
  assert.equal(hue(parseColourPhrase(['Orange-red crystals']).hex), 'orange');
  const vb = parseColourPhrase(['Violet-black crystals']);
  assert.ok(rgb(vb.hex).every((c) => c < 130), vb.hex);
  const pale = parseColourPhrase(['Pale yellow liquid']);
  assert.equal(pale.subject, 'liquid');
  assert.ok(rgb(pale.hex)[2] > rgb(parseColourPhrase(['Yellow liquid']).hex)[2], 'pale is lighter');
  assert.equal(hue(parseColourPhrase(['Purplish crystals']).hex), 'purple');
});

ok('hydrates, solutions, vapours', () => {
  assert.equal(parseColourPhrase(['Blue crystals (pentahydrate)']).hydrate, true);
  assert.equal(parseColourPhrase(['White anhydrous powder']).hydrate, false);
  assert.equal(parseColourPhrase(['Blue crystals']).hydrate, undefined);
  assert.equal(parseColourPhrase(['Purple aqueous solution']).subject, 'solution');
  assert.equal(parseColourPhrase(['Red-brown vapor']).subject, 'vapour');
});

ok('conflicting colours lower the confidence; the first colour is kept', () => {
  const p = parseColourPhrase(['Colorless when pure, yellow on standing']);
  assert.equal(hue(p.hex), 'white');
  assert.ok(p.confidence < 0.6, String(p.confidence));
  assert.ok(parseColourPhrase(['Colorless to yellow liquid']).confidence <= 0.9);
});

ok('no colour word, no result; unrelated words are not colours', () => {
  assert.equal(parseColourPhrase(['Crystalline solid with an odor']), undefined);
  assert.equal(parseColourPhrase(['Soluble in water']), undefined);
  assert.equal(parseColourPhrase([]), undefined);
});

console.log(`${n} colour-lexicon checks passed`);
