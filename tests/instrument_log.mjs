// Pure-logic checks for the instrument history log. Run: node tests/instrument_log.mjs   (Node >= 22.6 strips TS types)
import assert from 'node:assert/strict';
import { Series, InstrumentLog, LOG_WINDOW_S, LOG_MIN_DT_S } from '../web/src/app/instrument_log.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const collect = (s) => {
  const out = [];
  s.forEach((t, v, src) => out.push([t, v, src]));
  return out;
};

ok('decimates to <= 4 Hz of sim time', () => {
  const s = new Series();
  let stored = 0;
  for (let i = 0; i < 200; i++) if (s.push(i * 0.05, i, null)) stored++; // 20 Hz for 10 s
  assert.equal(stored, s.length);
  assert.ok(stored >= 39 && stored <= 41, `stored ${stored}`);
  const pts = collect(s);
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][0] - pts[i - 1][0] >= LOG_MIN_DT_S - 1e-6);
});

ok('keeps only the window and stays bounded (ring buffer)', () => {
  const s = new Series(60, 0.25);
  for (let i = 0; i < 4000; i++) s.push(i * 0.25, i, null); // 1000 s of sim time
  const pts = collect(s);
  assert.ok(pts[pts.length - 1][0] - pts[0][0] <= 60 + 1e-6);
  assert.ok(s.length <= Math.ceil(60 / 0.25) + 8);
  assert.equal(pts[pts.length - 1][1], 3999);
  assert.ok(pts.every((p, i) => i === 0 || p[0] > pts[i - 1][0]), 'time stays ordered after wrap-around');
});

ok('default window is 10 simulated minutes', () => {
  assert.equal(LOG_WINDOW_S, 600);
  const s = new Series();
  for (let i = 0; i < 6000; i++) s.push(i * 0.25, 1, null);
  assert.ok(s.span() <= 600 + 1e-6 && s.span() > 590);
});

ok('no sim time, no samples (paused)', () => {
  const s = new Series();
  s.push(10, 1, null);
  for (let i = 0; i < 100; i++) assert.equal(s.push(10, 2, null), false); // clock did not move
  assert.equal(s.length, 1);
});

ok('time going backwards restarts the series', () => {
  const s = new Series();
  s.push(100, 5, null);
  s.push(101, 6, null);
  s.push(3, 7, null);
  assert.deepEqual(collect(s), [[3, 7, null]]);
});

ok('no-reading gaps are one marker, stats ignore them', () => {
  const s = new Series();
  s.push(0, 20, 'a');
  s.push(1, null, 'a');
  assert.equal(s.push(2, null, 'a'), false);
  s.push(3, 30, 'a');
  const pts = collect(s);
  assert.equal(pts.length, 3);
  assert.ok(Number.isNaN(pts[1][1]));
  assert.deepEqual(s.stats(), { min: 20, max: 30, last: 30 });
  assert.equal(new Series().stats(), null);
});

ok('forgetSource drops that vessel\'s samples only', () => {
  const s = new Series();
  s.push(0, 1, 'a');
  s.push(1, 2, 'b');
  s.push(2, 3, 'a');
  s.push(3, 4, 'b');
  s.forgetSource('a');
  assert.deepEqual(collect(s), [[1, 2, 'b'], [3, 4, 'b']]);
  s.push(4, 5, 'b'); // still usable afterwards
  assert.equal(s.length, 3);
});

ok('record(): per-channel series, source switches become events', () => {
  const log = new InstrumentLog();
  log.record(0, { thermometer: { v: 20, src: 'v1', srcLabel: 'Beaker 1' }, balance: { v: 0, src: null } });
  log.record(1, { thermometer: { v: 21, src: 'v1', srcLabel: 'Beaker 1' } });
  assert.equal(log.eventsOf('thermometer').length, 0, 'first sighting is silent');
  log.record(2, { thermometer: { v: 22, src: 'v2', srcLabel: 'Flask 1' } });
  log.record(3, { thermometer: { v: null, src: null } });
  assert.deepEqual(log.eventsOf('thermometer').map((e) => e.text), ['reading Flask 1', 'no vessel']);
  assert.equal(log.channel('thermometer').length, 4);
  assert.equal(log.channel('balance').length, 1);
});

ok('watch(): silent first value, then one event per change', () => {
  const log = new InstrumentLog();
  log.watch('hotplate', 'w', 0, 0, (w) => (w > 0 ? `${w} W` : 'heat off'));
  log.watch('hotplate', 'w', 0, 1, () => 'x');
  log.watch('hotplate', 'w', 250, 2, (w) => `${w} W`);
  log.watch('hotplate', 'w', 250, 3, () => 'x');
  log.watch('hotplate', 'w', 0, 4, () => 'heat off');
  assert.deepEqual(log.eventsOf('hotplate').map((e) => [e.t, e.text]), [[2, '250 W'], [4, 'heat off']]);
});

ok('events are capped; forgetSource / clear free memory', () => {
  const log = new InstrumentLog();
  for (let i = 0; i < 200; i++) log.note('balance', i, 'tared');
  assert.ok(log.eventsOf('balance').length <= 40);
  log.record(0, { plate_temp: { v: 30, src: 'v1' } });
  log.record(1, { plate_temp: { v: 31, src: 'v1' } });
  log.forgetSource('v1');
  assert.equal(log.channel('plate_temp').length, 0);
  log.clear();
  assert.equal(log.eventsOf('balance').length, 0);
});

console.log(`${n} instrument_log checks passed`);
