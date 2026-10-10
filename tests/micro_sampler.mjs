// Molecular viewer, pure parts (no engine, no renderer): node tests/micro_sampler.mjs
//   allocate (enrichment, floor, cap, budget), reconcileStep (bounded, converges, missing species first),
//   phasesOf / sampleInput (phase split of a snapshot) and MicroMotion (stays in the box, enters, leaves, deterministic).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const { build } = await import(path.join(web, 'node_modules', 'esbuild', 'lib', 'main.js'));
const entry = `
import * as THREE from 'three';
export { allocate, reconcileStep, SCENERY_WATERS } from '${web}/src/app/micro_sampler';
export { phasesOf, sampleInput, defaultPhase } from '${web}/src/app/micro_phases';
export { MicroMotion } from '${web}/src/render/micro_motion';
export { buildShape } from '${web}/src/render/micro_shape';
export { THREE };
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const { allocate, reconcileStep, SCENERY_WATERS, phasesOf, sampleInput, defaultPhase, MicroMotion, buildShape, THREE } = mod;

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- allocate
ok('every species above the floor gets at least one molecule; the budget holds', () => {
  const sp = [
    { id: 'A', weight: 1, mol: 1 },
    { id: 'B', weight: 1e-3, mol: 1e-3 },
    { id: 'C', weight: 1e-6, mol: 1e-6 },
    { id: 'D', weight: 1e-9, mol: 1e-9 },
  ];
  const { counts, dropped } = allocate(sp, { budget: 100 });
  assert.equal(dropped.length, 0);
  for (const s of sp) assert.ok(counts.get(s.id) >= 1, s.id);
  assert.ok(sum(counts) <= 100, `total ${sum(counts)}`);
  // ranking kept, range compressed: 1 : 1e-9 in concentration is far less than 1e9 in counts
  assert.ok(counts.get('A') > counts.get('B') && counts.get('B') >= counts.get('C') && counts.get('C') >= counts.get('D'));
  assert.ok(counts.get('A') / counts.get('D') < 200);
});

ok('floor drops traces; zero or non-finite weights are dropped', () => {
  const { counts, dropped } = allocate([
    { id: 'A', weight: 1, mol: 1 },
    { id: 'T', weight: 1e-15, mol: 1e-15 },
    { id: 'Z', weight: 0, mol: 1 },
    { id: 'N', weight: NaN, mol: 1 },
  ]);
  assert.deepEqual([...counts.keys()], ['A']);
  assert.deepEqual(dropped.sort(), ['N', 'T', 'Z']);
});

ok('the species cap keeps forced species first, then the most abundant', () => {
  const sp = [];
  for (let i = 0; i < 40; i++) sp.push({ id: `S${i}`, weight: 1 / (i + 1), mol: 1 });
  sp.push({ id: 'RARE', weight: 1e-8, mol: 1, forced: true });
  const { counts, dropped } = allocate(sp, { maxSpecies: 10 });
  assert.equal(counts.size, 10);
  assert.ok(counts.has('RARE'));
  assert.ok(counts.has('S0') && !counts.has('S39'));
  assert.equal(dropped.length, 31);
});

ok('more species than the budget: one each, no more', () => {
  const sp = [];
  for (let i = 0; i < 20; i++) sp.push({ id: `S${i}`, weight: 1, mol: 1 });
  const { counts } = allocate(sp, { budget: 8, maxSpecies: 30 });
  assert.equal(sum(counts), 20);
});

ok('hysteresis keeps the old count against a tiny change', () => {
  const sp = [{ id: 'A', weight: 1, mol: 1 }, { id: 'B', weight: 0.5, mol: 1 }];
  const first = allocate(sp, { budget: 60 }).counts;
  const sp2 = [{ id: 'A', weight: 1, mol: 1 }, { id: 'B', weight: 0.51, mol: 1 }];
  const raw2 = allocate(sp2, { budget: 60 }).counts;
  const held = allocate(sp2, { budget: 60, previous: first }).counts;
  assert.deepEqual([...held], [...first]);
  assert.ok(raw2.size === 2);
});

ok('deterministic', () => {
  const sp = [{ id: 'B', weight: 2, mol: 1 }, { id: 'A', weight: 2, mol: 1 }];
  assert.deepEqual([...allocate(sp).counts], [...allocate(sp).counts]);
});

// ---------------------------------------------------------------- reconcile
ok('reconcileStep is bounded per call and converges to the target', () => {
  const target = new Map([['A', 30], ['B', 5], ['C', 1]]);
  let cur = new Map([['A', 10], ['X', 7]]);
  let calls = 0;
  for (; calls < 200; calls++) {
    const ops = reconcileStep(cur, target, 4);
    assert.ok(ops.add.length + ops.remove.length <= 4);
    if (ops.add.length + ops.remove.length === 0) break;
    for (const id of ops.add) cur.set(id, (cur.get(id) ?? 0) + 1);
    for (const id of ops.remove) cur.set(id, cur.get(id) - 1);
    for (const [k, v] of [...cur]) if (v === 0) cur.delete(k);
  }
  assert.deepEqual(Object.fromEntries([...cur].sort()), Object.fromEntries([...target].sort()));
  assert.ok(calls < 40, `${calls} calls`);
});

ok('a missing species is brought in before a big gap of another is closed', () => {
  const ops = reconcileStep(new Map([['A', 1]]), new Map([['A', 50], ['B', 1]]), 1);
  assert.deepEqual(ops.add, ['B']);
});

ok('nothing to do, nothing done', () => {
  const t = new Map([['A', 3]]);
  const ops = reconcileStep(t, t, 10);
  assert.equal(ops.add.length + ops.remove.length, 0);
  assert.equal(reconcileStep(new Map(), t, 0).add.length, 0);
});

// ---------------------------------------------------------------- phases
const snap = {
  species: [
    { id: 'H2O', name: 'Water', formula: 'H2O', charge: 0, phase: 'aqueous', amount_mol: 2.7, conc_m: 55.4, activity: 1, tier: 'tabulated' },
    { id: 'Na+', name: 'Sodium', formula: 'Na+', charge: 1, phase: 'aqueous', amount_mol: 0.005, conc_m: 0.1, activity: 0.1, tier: 'tabulated' },
    { id: 'Cl-', name: 'Chloride', formula: 'Cl-', charge: -1, phase: 'aqueous', amount_mol: 0.005, conc_m: 0.1, activity: 0.1, tier: 'tabulated' },
    { id: 'AgCl(s)', name: 'Silver chloride', formula: 'AgCl', charge: 0, phase: 'solid', amount_mol: 1e-3, conc_m: null, activity: 1, tier: 'tabulated' },
    { id: 'C6H14', name: 'Hexane', formula: 'C6H14', charge: 0, phase: 'organic', amount_mol: 0.01, conc_m: 7.6, activity: 1, tier: 'estimated' },
  ],
  layers: [{ phase: 'aqueous' }, { phase: 'organic', name: 'Hexane' }],
  gas_phase: { kind: 'atmosphere', species: [{ species: 'N2(g)', mol: 0, mole_fraction: 0.78, partial_atm: 0.78 }, { species: 'O2(g)', mol: 0, mole_fraction: 0.21, partial_atm: 0.21 }] },
};
ok('phases: aqueous, organic and gas; solids listed apart; water is scenery', () => {
  const set = phasesOf(snap);
  assert.deepEqual(set.phases.map((p) => p.key), ['aqueous', 'organic', 'gas']);
  assert.equal(set.solids.length, 1);
  assert.equal(defaultPhase(set), 'aqueous');
  assert.match(set.phases[1].label, /Hexane/);
  const aq = set.phases[0];
  assert.ok(aq.species.find((s) => s.id === 'H2O').scenery);
  const input = sampleInput(aq);
  assert.deepEqual(input.map((s) => s.id), ['Na+', 'Cl-']);
  const gas = sampleInput(set.phases[2]);
  // an atmosphere has no counted moles: the mole fraction stands in above the floor
  assert.equal(allocate(gas).counts.size, 2);
  assert.equal(phasesOf({ species: [] }).phases.length, 0);
  assert.equal(defaultPhase({ phases: [], solids: [] }), null);
});

// ---------------------------------------------------------------- motion
const fakeStruct = (id, r = 1.2) => ({
  species: id,
  formula: id,
  charge: 0,
  source: 'smiles',
  n_heavy: 1,
  atoms: [
    { el: 'O', x: 0, y: 0, z: 0, charge: 0 },
    { el: 'H', x: r, y: 0, z: 0, charge: 0 },
    { el: 'H', x: -0.3 * r, y: 0.9 * r, z: 0, charge: 0 },
  ],
  bonds: [{ a: 0, b: 1, order: 1, aromatic: false, coordinate: false }, { a: 0, b: 2, order: 2, aromatic: false, coordinate: false }],
});

ok('shape: centred, bounded, one cylinder per bond line', () => {
  const sh = buildShape(fakeStruct('X'));
  const c = sh.atoms.reduce((v, a) => v.add(a.p), new THREE.Vector3()).multiplyScalar(1 / 3);
  assert.ok(c.length() < 1e-9);
  assert.equal(sh.segs.length, 3); // single + double (2 lines)
  assert.ok(sh.radius > 1);
});

ok('motion: bodies stay inside, are finite, enter and leave through walls', () => {
  const shapeA = buildShape(fakeStruct('A'));
  const m = new MicroMotion(40, 'liquid', 3);
  for (let i = 0; i < 60; i++) m.addInside('A', shapeA, 'solute');
  for (let i = 0; i < 100; i++) m.step(0.05);
  for (const b of m.bodies) {
    assert.ok([b.pos.x, b.pos.y, b.pos.z, b.quat.w].every(Number.isFinite));
    assert.ok(Math.abs(b.pos.x) <= 20 + 1e-6 && Math.abs(b.pos.y) <= 20 + 1e-6 && Math.abs(b.pos.z) <= 20 + 1e-6, 'inside');
  }
  assert.equal(m.counts().get('A'), 60);
  // enter
  m.addEntering('A', shapeA);
  assert.equal(m.counts().get('A'), 61);
  for (let i = 0; i < 200; i++) m.step(0.05);
  assert.ok(m.bodies.every((b) => b.state === 'in'), 'entered');
  // leave
  assert.ok(m.removeOne('A'));
  assert.equal(m.counts().get('A'), 60);
  for (let i = 0; i < 400; i++) m.step(0.05);
  assert.equal(m.bodies.length, 60, 'left the scene');
  assert.equal(m.removeOne('nothing'), false);
});

ok('motion: bodies do not sit inside one another after settling', () => {
  const sh = buildShape(fakeStruct('A', 1.4));
  const m = new MicroMotion(36, 'liquid', 5);
  for (let i = 0; i < 80; i++) m.addInside('A', sh, 'solute');
  for (let i = 0; i < 400; i++) m.step(0.05);
  let worst = Infinity;
  for (let i = 0; i < m.bodies.length; i++)
    for (let j = i + 1; j < m.bodies.length; j++) worst = Math.min(worst, m.bodies[i].pos.distanceTo(m.bodies[j].pos) / (2 * sh.radius));
  assert.ok(worst > 0.55, `closest pair at ${worst.toFixed(2)} of the touching distance`);
});

ok('motion: gas flies faster than a liquid and still stays in', () => {
  const sh = buildShape(fakeStruct('G'));
  const travel = (kind) => {
    const m = new MicroMotion(60, kind, 9);
    for (let i = 0; i < 20; i++) m.addInside('G', sh, 'solute');
    const p0 = m.bodies.map((b) => b.pos.clone());
    let path = 0;
    let prev = p0;
    for (let i = 0; i < 40; i++) {
      m.step(0.05);
      m.bodies.forEach((b, k) => { path += b.pos.distanceTo(prev[k]); });
      prev = m.bodies.map((b) => b.pos.clone());
    }
    for (const b of m.bodies) assert.ok(Math.abs(b.pos.x) <= 30 + 1e-6);
    return path;
  };
  assert.ok(travel('gas') > 2 * travel('liquid'));
});

ok('motion: same seed, same trajectory', () => {
  const sh = buildShape(fakeStruct('A'));
  const run = () => {
    const m = new MicroMotion(40, 'liquid', 11);
    for (let i = 0; i < 10; i++) m.addInside('A', sh, 'solute');
    for (let i = 0; i < 20; i++) m.step(0.05);
    return m.bodies.map((b) => b.pos.toArray());
  };
  assert.deepEqual(run(), run());
});

console.log(`micro_sampler: ${n} checks passed (scenery waters ${SCENERY_WATERS})`);
