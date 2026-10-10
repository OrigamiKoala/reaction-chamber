// Molecular viewer, reaction events, against the built WASM engine: node tests/micro_morph.mjs
// Real vessel (ester saponification, ammonia + acetic acid, water's own ionisation) -> real reaction descriptions
// (`vessel_micro_reactions`) and structures (`vessel_micro_structures`) -> the real ReactionEvent, forward and reversed.
// Stage R3 adds complexation (Cu2+ + 4 NH3, Fe3+ + SCN-, hydroxo), ion pairs and electron transfers (Zn + Cu2+, Fe2+ + MnO4-):
// the metal ion sits in the middle of its ligands, the electron is drawn hopping between the redox centres.
// Checks: atoms are conserved through the morph, the reactants dock with their reacting atoms close, no atom flies through
// another (clearance of non-bonded atoms), the motion is smooth, the end geometry is the product conformer (RMSD < 0.1 A under
// the pose the event hands over), the bonds drawn at the end are exactly the products' bonds, and the scene draws the event.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const dir = path.join(web, 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);

const { build } = await import(path.join(web, 'node_modules', 'esbuild', 'lib', 'main.js'));
const entry = `
import * as THREE from 'three';
export { ReactionEvent, invertSpec, fitRigid, EVENT_TIMING } from '${web}/src/render/micro_morph';
export { MicroScene } from '${web}/src/render/micro_scene';
export { MicroMotion } from '${web}/src/render/micro_motion';
export { buildShape } from '${web}/src/render/micro_shape';
export { THREE };
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const { ReactionEvent, invertSpec, fitRigid, EVENT_TIMING, MicroScene, MicroMotion, buildShape, THREE } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

let n = 0;
const ok = async (name, fn) => {
  await fn();
  n++;
  console.log('  ok', name);
};

// ---------------------------------------------------------------- a vessel that holds several kinds of reaction
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 298.15, room_k: 298.15 };
J(eng.import_compound(JSON.stringify({ id: 'c_ea', name: 'ethyl acetate', formula: 'C4H8O2', smiles: 'CCOC(C)=O', state: 'liquid', inchi_key: 'XEKOWRVHYACXOJ-UHFFFAOYSA-N', density: 0.902, vapor_pressure_points: [[350.2, 101325]] })));
const hnd = eng.vessel_new(JSON.stringify(cfg));
const dose = (d) => eng.vessel_dose(hnd, JSON.stringify(d));
dose({ reagent_id: 'water', volume_ml: 50 });
dose({ reagent_id: 'naoh_1m', volume_ml: 5 });
dose({ reagent_id: 'nh3_2m', volume_ml: 5 });
dose({ reagent_id: 'ch3cooh_5pct', volume_ml: 5 });
dose({ reagent_id: 'c_ea', volume_ml: 2 });
for (let i = 0; i < 6; i++) eng.step_all(JSON.stringify([hnd]), 0.5);
const rows = J(eng.vessel_micro_reactions(hnd, 'aqueous'));
const played = rows.filter((r) => r.kind !== 'other');
const species = [...new Set(played.flatMap((r) => [...r.reactants, ...r.products]))];
const structs = new Map(J(eng.vessel_micro_structures(hnd, JSON.stringify(species))).map((s) => [s.species, s]));

const specOf = (r) => ({ reactants: r.reactants.map((s) => structs.get(s)), products: r.products.map((s) => structs.get(s)), atomMap: r.atom_map, movingH: r.moving_h, electronHops: r.electron_hops });
function randomPoses(m, seed) {
  let a = seed;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  const poses = [];
  for (let i = 0; i < m; i++) {
    const q = new THREE.Quaternion(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    const ang = (2 * Math.PI * i) / m + rnd();
    poses.push({ pos: new THREE.Vector3(Math.cos(ang) * 22, (rnd() - 0.5) * 8, Math.sin(ang) * 22), quat: q });
  }
  return poses;
}

await ok('the vessel reports template and proton-transfer rows with maps for the viewer', () => {
  const kinds = new Set(played.map((r) => r.kind));
  assert.ok(kinds.has('template') && kinds.has('proton_transfer'), `kinds: ${[...kinds]}`);
  assert.ok(played.some((r) => (r.family ?? '').startsWith('base_ester_hydrolysis')), 'saponification row');
  assert.ok(played.some((r) => r.reactants.length === 1 && r.reactants[0] === 'H2O' && r.kind === 'proton_transfer'), 'autoprotolysis row');
  for (const r of played) {
    assert.equal(r.atom_map.length, r.products.length, r.equation);
    assert.ok(Number.isFinite(r.gross_forward_mol_s) && Number.isFinite(r.gross_reverse_mol_s), r.equation);
    for (const s of [...r.reactants, ...r.products]) assert.ok(structs.has(s), `structure of ${s}`);
  }
});

await ok('fitRigid recovers a random rigid motion', () => {
  const pts = Array.from({ length: 9 }, (_, i) => new THREE.Vector3(Math.sin(i * 1.7) * 3, Math.cos(i * 2.3) * 2, i * 0.4 - 1));
  const q = new THREE.Quaternion(0.3, -0.5, 0.2, 0.7).normalize();
  const t = new THREE.Vector3(4, -2, 7);
  const to = pts.map((p) => p.clone().applyQuaternion(q).add(t));
  const fit = fitRigid(pts, to);
  for (let i = 0; i < pts.length; i++) assert.ok(pts[i].clone().applyQuaternion(fit.q).add(fit.t).distanceTo(to[i]) < 1e-6);
  // two points, one point
  const f2 = fitRigid(pts.slice(0, 2), to.slice(0, 2));
  assert.ok(pts[0].clone().applyQuaternion(f2.q).add(f2.t).distanceTo(to[0]) < 1e-6);
  const f1 = fitRigid([pts[0]], [to[0]]);
  assert.ok(pts[0].clone().applyQuaternion(f1.q).add(f1.t).distanceTo(to[0]) < 1e-9);
});

await ok('invertSpec swaps the sides and inverts the atom map (twice is the identity)', () => {
  for (const r of played) {
    const s = specOf(r);
    const inv = invertSpec(s);
    assert.equal(inv.reactants.length, s.products.length);
    assert.equal(inv.atomMap.length, s.reactants.length);
    inv.atomMap.forEach((row, p) => assert.equal(row.length, s.reactants[p].atoms.length));
    const back = invertSpec(inv);
    assert.deepEqual(back.atomMap, s.atomMap, r.equation);
    for (const m of s.movingH) assert.ok(inv.movingH.some((x) => x.from[0] === m.to[0] && x.from[1] === m.to[1] && x.to[0] === m.from[0] && x.to[1] === m.from[1]));
  }
});

function runEvent(spec, seed, label) {
  const start = randomPoses(spec.reactants.length, seed);
  const ev = new ReactionEvent(spec, start);
  const nAtoms = spec.reactants.reduce((a, s) => a + s.atoms.length, 0);
  assert.equal(ev.atoms.length, nAtoms, `${label}: every reactant atom is in the event`);
  const bondedKey = new Set(ev.bonds.map((b) => `${b.a},${b.b}`));
  let minClear = Infinity;
  let worstPair = '';
  let maxStepMove = 0;
  let dockedGap = null;
  const prev = ev.atoms.map((a) => a.pos.clone());
  let steps = 0;
  let wasApproach = ev.phase === 'approach';
  while (!ev.finished && steps < 400) {
    ev.step(1 / 30);
    steps++;
    for (let i = 0; i < ev.atoms.length; i++) {
      const p = ev.atoms[i].pos;
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `${label}: finite positions`);
      maxStepMove = Math.max(maxStepMove, p.distanceTo(prev[i]));
      prev[i].copy(p);
    }
    if (wasApproach && ev.phase === 'morph') {
      wasApproach = false;
      // closest pair of reacting atoms that belong to different molecules
      let best = Infinity;
      for (const i of ev.reacting) for (const j of ev.reacting) if (ev.atoms[i].mol < ev.atoms[j].mol) best = Math.min(best, ev.atoms[i].pos.distanceTo(ev.atoms[j].pos));
      dockedGap = best;
    }
    if (ev.phase === 'morph') {
      for (let i = 0; i < ev.atoms.length; i++) {
        for (let j = i + 1; j < ev.atoms.length; j++) {
          if (bondedKey.has(`${i},${j}`) || (ev.reacting.has(i) && ev.reacting.has(j))) continue;
          const d = ev.atoms[i].pos.distanceTo(ev.atoms[j].pos) / (ev.atoms[i].rVdw + ev.atoms[j].rVdw);
          if (d < minClear) { minClear = d; worstPair = `${ev.atoms[i].el}${i}-${ev.atoms[j].el}${j} at u=${ev.progress.toFixed(2)} d=${ev.atoms[i].pos.distanceTo(ev.atoms[j].pos).toFixed(2)}`; }
        }
      }
    }
  }
  assert.ok(ev.finished, `${label}: the event ends (${steps} steps)`);
  assert.ok(steps * (1 / 30) <= ev.approachTime + EVENT_TIMING.morph + 0.3, `${label}: duration ${(steps / 30).toFixed(2)} s`);
  return { ev, minClear, maxStepMove, dockedGap, worstPair };
}

function checkEnd(ev, spec, label) {
  // the poses the event hands over put each product's conformer on the atoms it ended with
  const poses = ev.productPoses();
  assert.equal(poses.length, spec.products.length, label);
  let sum = 0;
  let cnt = 0;
  spec.atomMap.forEach((row, p) => {
    const st = spec.products[p];
    const c = new THREE.Vector3();
    for (const a of st.atoms) c.add(new THREE.Vector3(a.x, a.y, a.z));
    c.multiplyScalar(1 / st.atoms.length);
    row.forEach((o, j) => {
      const world = new THREE.Vector3(st.atoms[j].x, st.atoms[j].y, st.atoms[j].z).sub(c).applyQuaternion(poses[p].quat).add(poses[p].pos);
      const g = ev.spec.reactants.slice(0, o[0]).reduce((a, s) => a + s.atoms.length, 0) + o[1];
      const d = world.distanceTo(ev.atoms[g].pos);
      sum += d * d;
      cnt++;
      assert.equal(ev.atoms[g].el, st.atoms[j].el, `${label}: element along the map`);
    });
  });
  const rmsd = Math.sqrt(sum / cnt);
  assert.ok(rmsd < 0.1, `${label}: end geometry RMSD ${rmsd.toFixed(4)} A`);
  // bonds drawn at the end = the products' bonds
  const want = new Set();
  const off = [];
  let acc = 0;
  for (const s of spec.reactants) {
    off.push(acc);
    acc += s.atoms.length;
  }
  spec.atomMap.forEach((row, p) => {
    for (const b of spec.products[p].bonds) {
      const a = off[row[b.a][0]] + row[b.a][1];
      const c = off[row[b.b][0]] + row[b.b][1];
      want.add(`${Math.min(a, c)},${Math.max(a, c)}`);
    }
  });
  const drawn = new Set();
  for (const b of ev.bonds) if (ev.linesOf(b).length > 0) drawn.add(`${b.a},${b.b}`);
  assert.deepEqual([...drawn].sort(), [...want].sort(), `${label}: bonds at the end`);
  return rmsd;
}

await ok('every playable reaction, forward and reversed, morphs cleanly from random starting poses', () => {
  let events = 0;
  let worstClear = Infinity;
  let worstClearLabel = '';
  let worstMove = 0;
  let worstRmsd = 0;
  for (const r of played) {
    for (const [dirName, spec] of [['forward', specOf(r)], ['reverse', invertSpec(specOf(r))]]) {
      if (spec.reactants.some((s) => s.source === 'placeholder') || spec.products.some((s) => s.source === 'placeholder')) continue;
      for (const seed of [1, 2]) {
        const label = `${r.equation} (${dirName}, seed ${seed})`;
        const { ev, minClear, maxStepMove, dockedGap, worstPair } = runEvent(spec, seed, label);
        worstRmsd = Math.max(worstRmsd, checkEnd(ev, spec, label));
        if (minClear < worstClear) worstClearLabel = label + ' ' + worstPair;
        worstClear = Math.min(worstClear, minClear);
        worstMove = Math.max(worstMove, maxStepMove);
        if (spec.reactants.length >= 2) assert.ok(dockedGap < 3.4, `${label}: reacting atoms docked at ${dockedGap?.toFixed(2)} A`);
        events++;
      }
    }
  }
  console.log(`      ${events} events; worst clearance ${worstClear.toFixed(2)} of the vdW sum (${worstClearLabel}), largest step ${worstMove.toFixed(2)} A / frame, worst end RMSD ${worstRmsd.toFixed(4)} A`);
  assert.ok(events >= 12, `events played: ${events}`);
  assert.ok(worstClear > 0.45, `no atom passes through another: clearance ${worstClear.toFixed(2)}`);
  assert.ok(worstMove < 0.9, `smooth motion: ${worstMove.toFixed(2)} A in one 1/30 s frame`);
});

await ok('a hydrogen that changes owner travels from the donor to the acceptor, and the bonds follow', () => {
  const r = played.find((x) => x.kind === 'proton_transfer' && x.reactants.length === 2 && x.moving_h.some((m) => m.donor && m.acceptor));
  assert.ok(r, 'a proton transfer between two molecules (ammonia + water)');
  const spec = specOf(r);
  const ev = new ReactionEvent(spec, randomPoses(2, 3));
  const off = [0];
  for (const s of spec.reactants) off.push(off[off.length - 1] + s.atoms.length);
  const m = r.moving_h.find((x) => x.donor && x.acceptor);
  const h = off[m.from[0]] + m.from[1];
  const donor = off[m.donor[0]] + m.donor[1];
  while (ev.phase === 'approach') ev.step(1 / 30);
  const bondTo = (a, b) => ev.bonds.find((e) => (e.a === Math.min(a, b) && e.b === Math.max(a, b)));
  // the product-side acceptor atom, as a reactant atom
  const acceptor = off[r.atom_map[m.acceptor[0]][m.acceptor[1]][0]] + r.atom_map[m.acceptor[0]][m.acceptor[1]][1];
  const d0 = ev.atoms[h].pos.distanceTo(ev.atoms[donor].pos);
  assert.ok(bondTo(h, donor).rOrder > 0 && bondTo(h, donor).pOrder === 0, 'the donor bond breaks');
  assert.ok(bondTo(h, acceptor).rOrder === 0 && bondTo(h, acceptor).pOrder > 0, 'the acceptor bond forms');
  while (!ev.finished) ev.step(1 / 30);
  const d1 = ev.atoms[h].pos.distanceTo(ev.atoms[donor].pos);
  const dAcc = ev.atoms[h].pos.distanceTo(ev.atoms[acceptor].pos);
  assert.ok(d1 > d0 + 0.5, `the hydrogen has left its donor (${d0.toFixed(2)} -> ${d1.toFixed(2)} A)`);
  assert.ok(dAcc < 1.4, `...and sits on the acceptor (${dAcc.toFixed(2)} A)`);
});

await ok('a single-molecule reaction starts where the molecule is (no approach)', () => {
  const r = played.find((x) => x.reactants.length === 1 && x.moving_h.length > 0);
  assert.ok(r, 'a unimolecular row (a dissociation)');
  const start = randomPoses(1, 4);
  const ev = new ReactionEvent(specOf(r), start);
  assert.equal(ev.phase, 'morph');
  const st = specOf(r).reactants[0];
  const c = new THREE.Vector3();
  for (const a of st.atoms) c.add(new THREE.Vector3(a.x, a.y, a.z));
  c.multiplyScalar(1 / st.atoms.length);
  const a0 = new THREE.Vector3(st.atoms[0].x, st.atoms[0].y, st.atoms[0].z).sub(c).applyQuaternion(start[0].quat).add(start[0].pos);
  assert.ok(ev.atoms[0].pos.distanceTo(a0) < 1e-6, 'the molecule did not move');
});

await ok('the scene draws the event: instance counts equal the atoms and the bond lines', () => {
  const r = played.find((x) => (x.family ?? '').startsWith('base_ester_hydrolysis')) ?? played[0];
  const spec = specOf(r);
  const scene = new MicroScene(null);
  const motion = new MicroMotion(new THREE.Vector3(60, 50, 60), 'liquid', 1);
  const ev = new ReactionEvent(spec, randomPoses(spec.reactants.length, 5));
  scene.sync(motion, [ev]);
  const nAtoms = spec.reactants.reduce((a, s) => a + s.atoms.length, 0);
  let st = scene.stats();
  assert.equal(st.eventAtoms, nAtoms);
  const lines = (e) => e.bonds.reduce((a, b) => a + ev.linesOf(b).length * 2, 0);
  assert.equal(st.eventBonds, lines(ev));
  while (!ev.finished) ev.step(1 / 30);
  scene.sync(motion, [ev]);
  st = scene.stats();
  assert.equal(st.eventAtoms, nAtoms);
  assert.equal(st.eventBonds, lines(ev), 'after the morph the products\' lines are drawn');
  scene.sync(motion, []);
  assert.equal(scene.stats().eventAtoms, 0);
  scene.dispose();
});

await ok('bodies owned by an event are not drawn or moved by the box', () => {
  const sh = buildShape(structs.get('H2O'));
  const motion = new MicroMotion(new THREE.Vector3(60, 50, 60), 'liquid', 2);
  const a = motion.addInside('H2O', sh, 'solute');
  const b = motion.addInside('H2O', sh, 'solute');
  a.state = 'reacting';
  const p0 = a.pos.clone();
  motion.step(0.5);
  assert.ok(a.pos.equals(p0), 'a reacting body stays put');
  const scene = new MicroScene(null);
  scene.sync(motion);
  assert.equal(scene.stats().soluteAtoms, sh.atoms.length, 'only the free body is drawn');
  assert.equal(motion.pick('H2O', 'solute')?.uid, b.uid, 'pick skips the reacting body');
  assert.equal(motion.counts('solute').get('H2O'), 2, 'counts still include it');
  motion.release(a);
  assert.equal(motion.counts('solute').get('H2O'), 1);
  scene.dispose();
});

// ---------------------------------------------------------------- stage R3: complexation and electron transfer
const cfg3 = { ...cfg };
const vesselWith = (setup) => {
  const h = eng.vessel_new(JSON.stringify(cfg3));
  setup(h);
  return h;
};
const doseTo = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const portion = (h, p) => eng.vessel_add_portion(h, JSON.stringify({ volume_ml: 0.01, temperature_k: 298.15, aqueous_mol: {}, organic_mol: {}, solid_mol: {}, ...p }));
const advance = (h, n, dt) => {
  for (let i = 0; i < n; i++) eng.step_all(JSON.stringify([h]), dt);
};
const hndB = vesselWith((h) => {
  doseTo(h, { reagent_id: 'water', volume_ml: 40 });
  doseTo(h, { reagent_id: 'cuso4_0_1m', volume_ml: 10 });
  doseTo(h, { reagent_id: 'nh3_2m', volume_ml: 5 });
  advance(h, 4, 0.5);
});
const hndE = vesselWith((h) => {
  doseTo(h, { reagent_id: 'fe_no3_3_0_1m', volume_ml: 25 });
  doseTo(h, { reagent_id: 'kscn_0_1m', volume_ml: 25 });
  advance(h, 4, 0.5);
});
// permanganate + iron(II) in acid, and zinc in copper sulfate (species placed directly, as the engine's own gates do)
const hndC = vesselWith((h) => {
  doseTo(h, { reagent_id: 'water', volume_ml: 50 });
  doseTo(h, { reagent_id: 'hcl_1m', volume_ml: 10 });
  portion(h, { aqueous_mol: { 'MnO4-': 0.001, 'K+': 0.001, 'Fe+2': 0.01, 'Cl-': 0.02 } });
  advance(h, 1, 0.05);
});
const hndD = vesselWith((h) => {
  doseTo(h, { reagent_id: 'water', volume_ml: 50 });
  portion(h, { aqueous_mol: { 'Cu+2': 0.005, 'SO4-2': 0.005 }, solid_mol: { 'Zn(s)': 0.005 } });
  advance(h, 4, 0.5);
});
const collect = (h) => {
  const rs = J(eng.vessel_micro_reactions(h, 'aqueous')).filter((r) => ['complexation', 'ion_pair', 'electron_transfer'].includes(r.kind));
  const sp = [...new Set(rs.flatMap((r) => [...r.reactants, ...r.products]))];
  const st = new Map(J(eng.vessel_micro_structures(h, JSON.stringify(sp))).map((x) => [x.species, x]));
  return rs.map((r) => ({ r, st }));
};
const rowsB = [...J(eng.vessel_micro_reactions(hndB, 'aqueous')), ...J(eng.vessel_micro_reactions(hndE, 'aqueous'))];
const all3 = [...collect(hndB), ...collect(hndE), ...collect(hndC), ...collect(hndD)];
const r3 = all3.map((x) => x.r);
const spec3 = (r) => {
  const st = all3.find((x) => x.r === r).st;
  return { reactants: r.reactants.map((x) => st.get(x)), products: r.products.map((x) => st.get(x)), atomMap: r.atom_map, movingH: r.moving_h, electronHops: r.electron_hops };
};
const dissolvedET = () => r3.filter((r) => r.kind === 'electron_transfer' && r.electron_hops.length > 0 && !r.reactants.concat(r.products).some((x) => x.endsWith('(s)')));

await ok('the vessel reports complexation rows (Cu-NH3, Fe-SCN, hydroxo) with exact maps and Eigen-Wilkins rates', () => {
  const cu = rowsB.find((r) => r.id === 'copper_tetraammine');
  assert.ok(cu, 'copper tetraammine row');
  assert.equal(cu.kind, 'complexation');
  assert.equal(cu.reactants.length, 5);
  assert.ok(cu.rate_source.startsWith('Eigen-Wilkins'), cu.rate_source);
  assert.ok(!cu.schematic_mapping && cu.electron_hops.length === 0);
  const fe = rowsB.find((r) => r.id === 'iron_thiocyanate');
  assert.ok(fe && fe.kind === 'complexation' && fe.rate_source.startsWith('Eigen-Wilkins'));
  const oh = rowsB.find((r) => r.id === 'iron_monohydroxo');
  assert.ok(oh && oh.kind === 'complexation' && oh.moving_h.length === 1, 'hydroxo complex releases a proton');
  for (const { r, st } of all3) for (const x of [...r.reactants, ...r.products]) assert.ok(st.has(x), `structure of ${x}`);
});

await ok('complexation events morph cleanly, forward and reversed; the metal ion docks in the middle of its ligands', () => {
  const rs = r3.filter((r) => r.kind === 'complexation' || r.kind === 'ion_pair');
  assert.ok(rs.length >= 3, `rows: ${rs.map((r) => r.id)}`);
  let worst = Infinity;
  for (const r of rs) {
    const spec = spec3(r);
    if (spec.reactants.some((x) => x.source === 'placeholder') || spec.products.some((x) => x.source === 'placeholder')) continue;
    for (const [dir, sp] of [['forward', spec], ['reverse', invertSpec(spec)]]) {
      const label = `${r.equation} (${dir})`;
      const { ev, minClear, maxStepMove } = runEvent(sp, 7, label);
      checkEnd(ev, sp, label);
      worst = Math.min(worst, minClear);
      assert.ok(maxStepMove < 1.0, `${label}: step ${maxStepMove.toFixed(2)} A`);
    }
  }
  assert.ok(worst > 0.4, `clearance ${worst.toFixed(2)}`);
  // the tetraammine: at the end of the approach the copper is in the middle and each nitrogen sits 2.4-3.0 A from it, spread around
  const cu = rs.find((r) => r.id === 'copper_tetraammine');
  const spec = spec3(cu);
  const ev = new ReactionEvent(spec, randomPoses(5, 11));
  while (ev.phase === 'approach') ev.step(1 / 30);
  const iCu = ev.atoms.findIndex((a) => a.el === 'Cu');
  const ns = ev.atoms.map((a, i) => (a.el === 'N' ? i : -1)).filter((i) => i >= 0);
  assert.equal(ns.length, 4);
  const centre = new THREE.Vector3();
  ns.forEach((i) => centre.add(ev.atoms[i].pos));
  centre.multiplyScalar(0.25);
  assert.ok(centre.distanceTo(ev.atoms[iCu].pos) < 1.0, `the ligands surround the copper (centroid ${centre.distanceTo(ev.atoms[iCu].pos).toFixed(2)} A off)`);
  for (const i of ns) {
    const d = ev.atoms[i].pos.distanceTo(ev.atoms[iCu].pos);
    assert.ok(d > 1.8 && d < 3.4, `N-Cu docking distance ${d.toFixed(2)} A`);
  }
});

await ok('an electron transfer draws the electron hopping from the donor atom to the acceptor atom', () => {
  const et = dissolvedET();
  assert.ok(et.length >= 1, `dissolved electron transfers: ${r3.filter((r) => r.kind === 'electron_transfer').map((r) => r.equation)}`);
  for (const r of et) {
    const spec = spec3(r);
    const ev = new ReactionEvent(spec, randomPoses(spec.reactants.length, 3));
    let seen = 0;
    let maxStrength = 0;
    const off = [0];
    for (const s of spec.reactants) off.push(off[off.length - 1] + s.atoms.length);
    const hop = r.electron_hops[0];
    const from = off[hop.from[0]] + hop.from[1];
    const to = off[hop.to[0]] + hop.to[1];
    while (!ev.finished) {
      ev.step(1 / 30);
      const sp = ev.electronSprites();
      seen += sp.length;
      for (const e of sp) {
        maxStrength = Math.max(maxStrength, e.strength);
        const a = ev.atoms[from].pos;
        const b = ev.atoms[to].pos;
        assert.ok(e.pos.distanceTo(a) + e.pos.distanceTo(b) < 1.6 * a.distanceTo(b) + 1e-6, 'the electron stays near the line between the centres');
      }
    }
    assert.ok(seen > 0 && maxStrength > 0.9, `${r.equation}: electron sprites ${seen}`);
    assert.equal(ev.electronSprites().length, 0, 'none after the event');
  }
});

await ok('invertSpec swaps the ends of an electron hop (twice is the identity)', () => {
  const spec = {
    reactants: [structs.get('H2O'), structs.get('H2O')],
    products: [structs.get('H2O'), structs.get('H2O')],
    atomMap: [structs.get('H2O'), structs.get('H2O')].map((st, p) => st.atoms.map((_, j) => [p, j])),
    movingH: [],
    electronHops: [{ from: [0, 0], to: [1, 0], count: 2 }],
  };
  const inv = invertSpec(spec);
  assert.deepEqual(inv.electronHops, [{ from: [1, 0], to: [0, 0], count: 2 }]);
  assert.deepEqual(invertSpec(inv).electronHops, spec.electronHops);
});

await ok('the scene draws the electron as an extra small point while it travels', () => {
  const r = dissolvedET()[0];
  assert.ok(r, 'a dissolved electron transfer');
  const spec = spec3(r);
  const scene = new MicroScene(null);
  const motion = new MicroMotion(new THREE.Vector3(60, 50, 60), 'liquid', 1);
  const ev = new ReactionEvent(spec, randomPoses(spec.reactants.length, 5));
  const nAtoms = spec.reactants.reduce((a, s) => a + s.atoms.length, 0);
  let extra = 0;
  while (!ev.finished) {
    ev.step(1 / 30);
    scene.sync(motion, [ev]);
    extra = Math.max(extra, scene.stats().eventAtoms - nAtoms);
  }
  assert.ok(extra >= 1, `an electron point is drawn (extra instances: ${extra})`);
  scene.dispose();
});

console.log(`micro_morph: ${n} checks passed`);
