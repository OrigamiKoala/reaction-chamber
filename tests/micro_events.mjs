// Molecular viewer, event scheduling (pure, no engine, no renderer): node tests/micro_events.mjs
//   visualRates keeps the ranking of the gross rates, puts the fastest at fMax and the slowest shown at fMin, leaves rows below
//   the floor and beyond the row cap unplayed; the scheduler balances forward and reverse events by the forward share (an
//   equilibrium alternates), never has more than `cap` events in progress, and fires at the requested frequency.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const { build } = await import(path.join(web, 'node_modules', 'esbuild', 'lib', 'main.js'));
const entry = `export { visualRates, EventScheduler, DEFAULT_VISUAL_RATES } from '${web}/src/app/micro_events';`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const { visualRates, EventScheduler, DEFAULT_VISUAL_RATES } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const total = (v) => v.fwd + v.rev;

// ---------------------------------------------------------------- visualRates
ok('the ranking by total rate is kept, the fastest fires at fMax and the slowest shown at fMin', () => {
  const rows = [
    { id: 'slow', forward: 1e-12, reverse: 0 },
    { id: 'fast', forward: 3e-3, reverse: 1e-3 },
    { id: 'mid', forward: 1e-7, reverse: 1e-7 },
    { id: 'mid2', forward: 5e-6, reverse: 0 },
  ];
  const v = visualRates(rows);
  const by = Object.fromEntries(v.map((x) => [x.id, x]));
  assert.ok(Math.abs(total(by.fast) - DEFAULT_VISUAL_RATES.fMax) < 1e-9, `fastest at fMax: ${total(by.fast)}`);
  assert.ok(Math.abs(total(by.slow) - DEFAULT_VISUAL_RATES.fMin) < 1e-9, `slowest at fMin: ${total(by.slow)}`);
  assert.ok(total(by.fast) > total(by.mid2) && total(by.mid2) > total(by.mid) && total(by.mid) > total(by.slow), 'ranking kept');
  // the forward share of the true rates is kept
  assert.ok(Math.abs(by.fast.fwd / total(by.fast) - 0.75) < 1e-9);
  assert.ok(Math.abs(by.mid.fwd / total(by.mid) - 0.5) < 1e-9);
  assert.equal(by.slow.rev, 0);
});

ok('rows with no rate, below the floor or beyond the cap are listed but not played', () => {
  const rows = [
    { id: 'a', forward: 1, reverse: 0 },
    { id: 'none', forward: 0, reverse: 0 },
    { id: 'nan', forward: NaN, reverse: -1 },
    { id: 'tiny', forward: 1e-20, reverse: 0 },
  ];
  const v = Object.fromEntries(visualRates(rows).map((x) => [x.id, x]));
  assert.equal(v.a.shown, true);
  assert.equal(v.none.shown, false);
  assert.equal(v.nan.shown, false);
  assert.equal(v.tiny.shown, false, 'below 1e-15 of the fastest');
  assert.equal(total(v.tiny), 0);
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, forward: Math.pow(10, -i / 4), reverse: 0 }));
  const shown = visualRates(many).filter((x) => x.shown);
  assert.equal(shown.length, DEFAULT_VISUAL_RATES.maxRows);
  assert.deepEqual(shown.map((x) => x.id), many.slice(0, DEFAULT_VISUAL_RATES.maxRows).map((x) => x.id), 'the fastest rows are the ones played');
});

ok('a single row and rows of equal rate all fire at fMax', () => {
  const one = visualRates([{ id: 'x', forward: 1e-9, reverse: 0 }]);
  assert.ok(Math.abs(total(one[0]) - DEFAULT_VISUAL_RATES.fMax) < 1e-12);
  const eq = visualRates([{ id: 'x', forward: 2, reverse: 0 }, { id: 'y', forward: 1, reverse: 1 }]);
  assert.ok(eq.every((v) => Math.abs(total(v) - DEFAULT_VISUAL_RATES.fMax) < 1e-12));
});

ok('the order of the input does not matter and the output keeps it', () => {
  const rows = [
    { id: 'c', forward: 1e-9, reverse: 0 },
    { id: 'a', forward: 1e-3, reverse: 0 },
    { id: 'b', forward: 1e-6, reverse: 0 },
  ];
  const v = visualRates(rows);
  assert.deepEqual(v.map((x) => x.id), ['c', 'a', 'b']);
  const w = visualRates([...rows].reverse());
  for (const x of v) assert.ok(Math.abs(total(x) - total(w.find((y) => y.id === x.id))) < 1e-12);
});

// ---------------------------------------------------------------- scheduler
ok('forward and reverse events follow the forward share: an equilibrium alternates', () => {
  const s = new EventScheduler(mulberry32(5), 3);
  const rate = [{ id: 'eq', fwd: 0.5, rev: 0.5, shown: true }];
  const seq = [];
  for (let i = 0; i < 4000 && seq.length < 60; i++) for (const e of s.tick(0.1, rate, 0)) seq.push(e.direction === 'forward' ? 'F' : 'R');
  assert.ok(seq.length >= 40, `events fired: ${seq.length}`);
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `alternates: ${seq.join('')}`);

  const s2 = new EventScheduler(mulberry32(6), 3);
  const rate2 = [{ id: 'run', fwd: 0.9, rev: 0.1, shown: true }];
  let f = 0;
  let r = 0;
  for (let i = 0; i < 40000; i++) for (const e of s2.tick(0.1, rate2, 0)) e.direction === 'forward' ? f++ : r++;
  assert.ok(f + r > 1000);
  assert.ok(Math.abs(f / (f + r) - 0.9) < 0.01, `forward share ${(f / (f + r)).toFixed(3)} for 0.9`);

  const s3 = new EventScheduler(mulberry32(7), 3);
  const rate3 = [{ id: 'irr', fwd: 0.4, rev: 0, shown: true }];
  for (let i = 0; i < 5000; i++) for (const e of s3.tick(0.1, rate3, 0)) assert.equal(e.direction, 'forward', 'an irreversible row never fires backwards');
});

ok('never more events than the cap, counting those in progress', () => {
  const s = new EventScheduler(mulberry32(3), 3);
  const rates = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, fwd: 5, rev: 5, shown: true }));
  let maxFired = 0;
  for (let i = 0; i < 500; i++) {
    const fired = s.tick(0.2, rates, 0);
    maxFired = Math.max(maxFired, fired.length);
    assert.ok(fired.length <= 3);
    assert.equal(new Set(fired.map((e) => e.id)).size, fired.length, 'a row fires once per tick');
  }
  assert.equal(maxFired, 3, 'the cap is reached with rows this fast');
  for (let i = 0; i < 100; i++) {
    assert.equal(s.tick(0.2, rates, 3).length, 0, 'full: nothing starts');
    assert.ok(s.tick(0.2, rates, 2).length <= 1);
  }
});

ok('the firing frequency matches the requested one, and unplayed rows never fire', () => {
  const s = new EventScheduler(mulberry32(11), 99);
  const rates = [
    { id: 'a', fwd: 0.5, rev: 0.5, shown: true },
    { id: 'b', fwd: 0.05, rev: 0, shown: true },
    { id: 'off', fwd: 1, rev: 1, shown: false },
  ];
  const count = { a: 0, b: 0, off: 0 };
  const T = 20000;
  for (let i = 0; i < T; i++) for (const e of s.tick(0.1, rates, 0)) count[e.id]++;
  const seconds = T * 0.1;
  assert.ok(Math.abs(count.a / seconds - 1) < 0.08, `a fires ${(count.a / seconds).toFixed(3)} per s (1)`);
  assert.ok(Math.abs(count.b / seconds - 0.05) < 0.01, `b fires ${(count.b / seconds).toFixed(3)} per s (0.05)`);
  assert.equal(count.off, 0);
});

ok('deterministic for a given random source', () => {
  const run = (seed) => {
    const s = new EventScheduler(mulberry32(seed), 3);
    const rates = [{ id: 'a', fwd: 0.6, rev: 0.4, shown: true }, { id: 'b', fwd: 0.2, rev: 0, shown: true }];
    const out = [];
    for (let i = 0; i < 300; i++) for (const e of s.tick(0.1, rates, 0)) out.push(e.id + e.direction[0]);
    return out.join(',');
  };
  assert.equal(run(9), run(9));
  assert.notEqual(run(9), run(10));
});

console.log(`micro_events: ${n} checks passed`);
