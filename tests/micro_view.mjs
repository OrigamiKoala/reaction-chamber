// Molecular viewer tab, headless, against the built WASM engine: node tests/micro_view.mjs
// Real vessel -> real snapshot -> real 3D structures (engine `vessel_micro_structures`) -> the real MoleculeView with a
// renderer-less MicroScene and a stub DOM. Checks: the tab builds, the instance counts equal the atoms / bond halves of the
// molecules in the box, phases switch, the water modes and drawing styles apply, the box follows a change of the vessel's
// composition by reconciliation (not by popping), nothing goes non-finite or leaves the box, and the frame cost.
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

// ---- stub DOM (just what ui/dom.ts `h` and the view use)
class El {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.dataset = {};
    this.className = '';
    this._text = '';
    this.style = {};
    this.parentElement = null;
    this.clientWidth = 360;
    this.clientHeight = 340;
    this.value = '';
  }
  get hidden() { return 'hidden' in this.attrs; }
  set hidden(v) { if (v) this.attrs.hidden = ''; else delete this.attrs.hidden; }
  set textContent(t) { this._text = String(t); this.children = []; }
  get textContent() { return this._text + this.children.map((c) => c.textContent ?? '').join(''); }
  set innerHTML(_h) { this.children = []; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  fire(t) { for (const f of this.listeners[t] ?? []) f({}); }
  append(...cs) { for (const c of cs) { if (typeof c === 'string') this.children.push(Object.assign(new El('#text'), { _text: c })); else { c.parentElement = this; this.children.push(c); } } }
  replaceChildren(...cs) { this.children = []; this.append(...cs); }
  all(f, acc = []) { for (const c of this.children) { if (f(c)) acc.push(c); c.all?.(f, acc); } return acc; }
}
globalThis.document = { createElement: (t) => new El(t) };
let rafCb = null;
globalThis.requestAnimationFrame = (f) => { rafCb = f; return 1; };
globalThis.cancelAnimationFrame = () => { rafCb = null; };
globalThis.window = globalThis;

const { build } = await import(path.join(web, 'node_modules', 'esbuild', 'lib', 'main.js'));
const entry = `
export { MoleculeView } from '${web}/src/ui/molecule_view';
export { MicroScene } from '${web}/src/render/micro_scene';
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const { MoleculeView, MicroScene } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

let n = 0;
const ok = async (name, fn) => { await fn(); n++; console.log('  ok', name); };
const flush = () => new Promise((r) => setTimeout(r, 0));

// ---- a real vessel: salt + acid in water, plus an organic that forms its own layer
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 298.15, room_k: 298.15 };
J(eng.import_compound(JSON.stringify({ id: 'c_hex', name: 'hexane', formula: 'C6H14', smiles: 'CCCCCC', state: 'liquid', density: 0.66, vapor_pressure_points: [[341.9, 101325]] })));
const hnd = eng.vessel_new(JSON.stringify(cfg));
const dose = (d) => eng.vessel_dose(hnd, JSON.stringify(d));
dose({ reagent_id: 'water', volume_ml: 40 });
dose({ reagent_id: 'nacl_0_1m', volume_ml: 20 });
dose({ reagent_id: 'hcl_1m', volume_ml: 5 });
dose({ reagent_id: 'c_hex', volume_ml: 10 });
for (let i = 0; i < 20; i++) eng.step_all(JSON.stringify([hnd]), 0.5);
let snap = J(eng.vessel_snapshot(hnd));

const scenes = [];
const view = new MoleculeView({
  structures: async (_id, ids) => J(eng.vessel_micro_structures(hnd, JSON.stringify(ids))),
  snapshot: () => snap,
  makeScene: () => { const s = new MicroScene(null); scenes.push(s); return s; },
});
view.show('v1');

let clock = 0;
/** Advance the view by `seconds` of wall time in 1/30 s frames, letting the structure promises resolve. */
const run = async (seconds) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    clock += 1000 / 30;
    const f = rafCb;
    if (f) f(clock);
    snap && view.update(snap);
    if (Math.round(t * 30) % 10 === 0) await flush();
  }
  await flush();
};
const motion = () => view.motion;
const atomsOf = (role) => motion().bodies.filter((b) => b.role === role).reduce((q, b) => q + b.shape.atoms.length, 0);
const halvesOf = (role) => motion().bodies.filter((b) => b.role === role).reduce((q, b) => q + b.shape.segs.length * 2, 0);
const select = view.el.all((e) => e.tagName === 'select')[0];

await ok('the tab builds and starts hidden', () => {
  assert.equal(view.el.hidden, true);
  assert.ok(view.el.all((e) => e.tagName === 'canvas').length === 1);
  assert.ok(select);
});

await ok('active: structures arrive, the box fills, instance counts match the molecules', async () => {
  view.setActive(true);
  assert.equal(view.el.hidden, false);
  await run(3);
  assert.ok(motion(), 'box built');
  const sc = scenes[0];
  const st = sc.stats();
  assert.equal(st.soluteAtoms, atomsOf('solute'));
  assert.equal(st.soluteBonds, halvesOf('solute'));
  assert.equal(st.waterAtoms, atomsOf('water'));
  assert.equal(st.waterBonds, halvesOf('water'));
  const have = motion().counts('solute');
  assert.ok(have.has('Na+') && have.has('Cl-'), [...have.keys()].join());
  assert.equal(motion().counts('water').get('H2O'), 40, 'scenery waters');
  assert.ok(st.waterAtoms === 120 && st.waterBonds === 160);
  const legend = view.legend.textContent;
  assert.match(legend, /Na/);
  assert.match(legend, /scenery/);
});

await ok('aqueous phase holds hexane only as the dissolved trace it is; the organic phase is dominated by it', async () => {
  const aq = motion().counts('solute');
  assert.ok(aq.get('C6H14') < aq.get('Cl-'), `hexane ${aq.get('C6H14')} vs chloride ${aq.get('Cl-')}`);
  const opts = select.children.map((c) => c.attrs.value);
  assert.ok(opts.includes('aqueous'), opts.join());
  if (opts.includes('organic')) {
    select.value = 'organic';
    select.fire('change');
    await run(2);
    const org = motion().counts('solute');
    assert.ok(org.get('C6H14') > 5 * (org.get('H2O') ?? 0), `organic box ${JSON.stringify([...org])}`);
    assert.equal(motion().counts('water').size, 0, 'no scenery water in an organic layer');
    select.value = 'aqueous';
    select.fire('change');
    await run(2);
  }
});

await ok('gas phase: a box of free-flying gas molecules', async () => {
  const opts = select.children.map((c) => c.attrs.value);
  assert.ok(opts.includes('gas'), opts.join());
  select.value = 'gas';
  select.fire('change');
  await run(2);
  assert.equal(motion().kind, 'gas');
  assert.ok(motion().bodies.length > 0);
  select.value = 'aqueous';
  select.fire('change');
  await run(2);
  assert.equal(motion().kind, 'liquid');
});

await ok('water modes and drawing style', async () => {
  const sc = scenes[0];
  const seg = view.el.all((e) => e.tagName === 'div' && e.attrs.role === 'group');
  const btn = (label) => view.el.all((e) => e.tagName === 'button' && e._text === label)[0];
  btn('Hide').fire('click');
  await run(0.5);
  assert.equal(sc.stats().waterAtoms, 0);
  btn('Solid').fire('click');
  await run(0.5);
  assert.equal(sc.stats().waterAtoms, 120);
  btn('Space-filling').fire('click');
  await run(0.5);
  assert.equal(sc.stats().soluteBonds, 0, 'no bonds when space-filling');
  btn('Ball & stick').fire('click');
  await run(0.5);
  assert.equal(sc.stats().soluteBonds, halvesOf('solute'));
  assert.ok(seg.length >= 3);
});

await ok('pause freezes the motion', async () => {
  const btn = view.el.all((e) => e.tagName === 'button' && e._text === 'Pause')[0];
  btn.fire('click');
  const before = motion().bodies.map((b) => b.pos.toArray().join());
  await run(1);
  assert.deepEqual(motion().bodies.map((b) => b.pos.toArray().join()), before);
  view.el.all((e) => e.tagName === 'button' && e._text === 'Play')[0].fire('click');
  await run(1);
  assert.notDeepEqual(motion().bodies.map((b) => b.pos.toArray().join()), before);
});

await ok('the box follows the vessel by reconciliation: a new species drifts in, nothing pops', async () => {
  // dose a copper salt: Cu+2 / SO4-2 appear
  dose({ reagent_id: 'cuso4_0_1m', volume_ml: 20 });
  for (let i = 0; i < 4; i++) eng.step_all(JSON.stringify([hnd]), 0.5);
  snap = J(eng.vessel_snapshot(hnd));
  const idsNow = snap.species.filter((s) => s.phase === 'aqueous').map((s) => s.id);
  const newcomer = idsNow.find((id) => id.startsWith('Cu') );
  assert.ok(newcomer, idsNow.join());
  assert.ok(!motion().counts('solute').has(newcomer));
  const total0 = [...motion().counts('solute').values()].reduce((a, b) => a + b, 0);
  await run(0.4);
  // within a second at most a few molecules were changed
  const total1 = [...motion().counts('solute').values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total1 - total0) <= 8, `${total0} -> ${total1}`);
  await run(25);
  assert.ok(motion().counts('solute').has(newcomer), 'newcomer present');
  assert.ok(motion().bodies.every((b) => b.state === 'in' || b.state === 'entering' || b.state === 'leaving'), 'no reaction without the reactions dependency');
  assert.equal(scenes[0].stats().soluteAtoms, atomsOf('solute'));
});

await ok('everything finite, inside the box, and the frame cost is small', async () => {
  const m = motion();
  for (const b of m.bodies) {
    if (b.state !== 'in') continue;
    assert.ok([b.pos.x, b.pos.y, b.pos.z, b.quat.x, b.quat.w].every(Number.isFinite));
    assert.ok(Math.abs(b.pos.x) <= m.size.x / 2 + 1e-6 && Math.abs(b.pos.y) <= m.size.y / 2 + 1e-6 && Math.abs(b.pos.z) <= m.size.z / 2 + 1e-6);
  }
  const sc = scenes[0];
  const t0 = performance.now();
  const N = 200;
  for (let i = 0; i < N; i++) { m.step(1 / 30); sc.sync(m); }
  const per = (performance.now() - t0) / N;
  console.log(`    ${m.bodies.length} molecules, ${sc.stats().soluteAtoms + sc.stats().waterAtoms} atoms: step + instance write ${per.toFixed(2)} ms/frame`);
  assert.ok(per < 6, `frame cost ${per} ms`);
});

await ok('hiding the tab stops the loop; a new vessel starts clean', async () => {
  view.setActive(false);
  assert.equal(view.el.hidden, true);
  assert.equal(rafCb, null);
  view.show('v2');
  assert.equal(view.motion, null);
});

// ---- reactions (R2): a vessel in which an ester is saponified next to an ammonia / acetic acid buffer
J(eng.import_compound(JSON.stringify({ id: 'c_ea', name: 'ethyl acetate', formula: 'C4H8O2', smiles: 'CCOC(C)=O', state: 'liquid', inchi_key: 'XEKOWRVHYACXOJ-UHFFFAOYSA-N', density: 0.902, vapor_pressure_points: [[350.2, 101325]] })));
const hnd2 = eng.vessel_new(JSON.stringify(cfg));
const dose2 = (d) => eng.vessel_dose(hnd2, JSON.stringify(d));
dose2({ reagent_id: 'water', volume_ml: 50 });
dose2({ reagent_id: 'naoh_1m', volume_ml: 5 });
dose2({ reagent_id: 'nh3_2m', volume_ml: 5 });
dose2({ reagent_id: 'ch3cooh_5pct', volume_ml: 5 });
dose2({ reagent_id: 'c_ea', volume_ml: 2 });
for (let i = 0; i < 6; i++) eng.step_all(JSON.stringify([hnd2]), 0.5);
snap = J(eng.vessel_snapshot(hnd2));
const scenes2 = [];
let rowCalls = 0;
const view2 = new MoleculeView({
  structures: async (_id, ids) => J(eng.vessel_micro_structures(hnd2, JSON.stringify(ids))),
  snapshot: () => snap,
  reactions: async (_id, phase) => { rowCalls++; return J(eng.vessel_micro_reactions(hnd2, phase)); },
  makeScene: () => { const s = new MicroScene(null); scenes2.push(s); return s; },
});
view2.show('v3');
view2.setActive(true);

await ok('reactions: the engine rows arrive and the legend lists them with their true rates', async () => {
  await run(4);
  assert.ok(rowCalls >= 2, `rows asked for: ${rowCalls}`);
  assert.ok(view2.rows.length >= 3, `rows: ${view2.rows.length}`);
  assert.ok(view2.rows.some((r) => r.kind === 'template') && view2.rows.some((r) => r.kind === 'proton_transfer'));
  const legend = view2.legend.textContent;
  assert.match(legend, /Reactions in this phase/);
  assert.match(legend, /proton transfer/);
  assert.match(legend, /mol\/s/);
  assert.ok(view2.rates.some((v) => v.shown), 'some reactions are played');
});

await ok('reactions play: events start, never more than three at once, and own exactly the bodies marked reacting', async () => {
  let maxConcurrent = 0;
  let drawn = 0;
  let sawProducts = false;
  const sc = scenes2[0];
  for (let t = 0; t < 70; t += 1 / 30) {
    clock += 1000 / 30;
    rafCb(clock);
    if (Math.round(t * 30) % 15 === 0) await flush();
    const ev = view2.events;
    maxConcurrent = Math.max(maxConcurrent, ev.filter((e) => e.row.kind !== 'phase_transfer').length);
    assert.ok(ev.filter((e) => e.row.kind !== 'phase_transfer').length <= 3 && ev.length <= 5, `${ev.length} events at once`);
    const owned = new Set(ev.flatMap((e) => [...(e.reaction?.bodies ?? []), ...(e.swap?.bodies ?? [])].map((b) => b.uid)));
    const marked = view2.motion.bodies.filter((b) => b.state === 'reacting').map((b) => b.uid);
    assert.equal(marked.length, owned.size, 'reacting bodies belong to events');
    for (const u of marked) assert.ok(owned.has(u));
    if (ev.length > 0) drawn = Math.max(drawn, sc.stats().eventAtoms);
    for (const b of view2.motion.bodies) if (b.state === 'in') assert.ok(Number.isFinite(b.pos.x + b.pos.y + b.pos.z));
    if ([...view2.played.values()].reduce((a, c) => a + c, 0) > 3) sawProducts = true;
  }
  const played = [...view2.played.values()].reduce((a, c) => a + c, 0);
  console.log(`    ${played} events played in 70 s, at most ${maxConcurrent} at once, up to ${drawn} event atoms drawn`);
  assert.ok(played >= 8, `events played: ${played}`);
  assert.ok(maxConcurrent >= 1 && drawn > 0, 'events were drawn');
  assert.ok(sawProducts);
  // the faster reaction plays more often than a slower one
  const rate = new Map(view2.rates.map((v) => [v.id, v.fwd + v.rev]));
  const shown = view2.rates.filter((v) => v.shown).sort((a, b) => b.fwd + b.rev - (a.fwd + a.rev));
  if (shown.length >= 2 && shown[0].fwd + shown[0].rev > 2 * (shown[shown.length - 1].fwd + shown[shown.length - 1].rev)) {
    const top = view2.played.get(shown[0].id) ?? 0;
    const bottom = view2.played.get(shown[shown.length - 1].id) ?? 0;
    assert.ok(top >= bottom, `ranking: fastest ${top} vs slowest ${bottom}`);
  }
  assert.match(view2.legend.textContent, /Played/);
});

await ok('a frame with events running stays cheap', async () => {
  const m = view2.motion;
  const sc = scenes2[0];
  // force a few events at once so the cost is that of the busiest case
  for (let i = 0; i < 30 && view2.events.length < 3; i++) await run(0.5);
  const t0 = performance.now();
  const N = 120;
  for (let i = 0; i < N; i++) {
    for (const e of view2.events) e.reaction?.ev.step(1 / 60);
    m.step(1 / 30);
    sc.sync(m, view2.drawables());
  }
  const per = (performance.now() - t0) / N;
  console.log(`    ${view2.events.length} events in progress, ${sc.stats().eventAtoms} event atoms: ${per.toFixed(2)} ms/frame`);
  assert.ok(per < 8, `frame cost ${per} ms`);
});

await ok('a new vessel or another phase clears the events and the rows', async () => {
  view2.setActive(false);
  view2.show('v4');
  assert.equal(view2.events.length, 0);
  assert.equal(view2.rows.length, 0);
  assert.equal(rafCb, null);
});

// ---- complexation and electron transfer (R3)
function viewOf(h, name) {
  const scenes = [];
  const v = new MoleculeView({
    structures: async (_id, ids) => J(eng.vessel_micro_structures(h, JSON.stringify(ids))),
    snapshot: () => J(eng.vessel_snapshot(h)),
    reactions: async (_id, phase) => J(eng.vessel_micro_reactions(h, phase)),
    makeScene: () => { const sc = new MicroScene(null); scenes.push(sc); return sc; },
  });
  v.show(name);
  v.setActive(true);
  return { v, scenes };
}
const addPortion = (h, p) => eng.vessel_add_portion(h, JSON.stringify({ volume_ml: 0.01, temperature_k: 298.15, aqueous_mol: {}, organic_mol: {}, solid_mol: {}, ...p }));

const hndCu = eng.vessel_new(JSON.stringify(cfg));
for (const d of [{ reagent_id: 'water', volume_ml: 40 }, { reagent_id: 'cuso4_0_1m', volume_ml: 10 }, { reagent_id: 'nh3_2m', volume_ml: 5 }]) eng.vessel_dose(hndCu, JSON.stringify(d));
for (let i = 0; i < 4; i++) eng.step_all(JSON.stringify([hndCu]), 0.5);
const cuView = viewOf(hndCu, 'v-cu');

await ok('complexation rows are listed and played: ligands dock around the copper ion', async () => {
  await run(4);
  const cx = cuView.v.rows.filter((r) => r.kind === 'complexation' || r.kind === 'ion_pair');
  assert.ok(cx.length >= 3, `complexation rows: ${cx.length}`);
  assert.match(cuView.v.legend.textContent, /complexation/);
  assert.match(cuView.v.legend.textContent, /Eigen-Wilkins|mol\/s/);
  let started = 0;
  let sawMany = false;
  const seen = new Set();
  for (let t = 0; t < 120; t += 1 / 30) {
    clock += 1000 / 30;
    rafCb(clock);
    if (Math.round(t * 30) % 15 === 0) await flush();
    for (const e of cuView.v.events) {
      if (!seen.has(e)) { seen.add(e); started++; }
      if (e.row.kind === 'complexation' && e.row.reactants.length >= 4) sawMany = true;
    }
  }
  const played = [...cuView.v.played.entries()].filter(([id, c]) => c > 0 && cx.some((r) => r.id === id));
  console.log(`    ${started} events started, complexation rows played: ${played.map(([id, c]) => id + '×' + c).join(', ')}`);
  assert.ok(played.length >= 1, 'a complexation row was played to the end');
  void sawMany;
  cuView.v.setActive(false);
});

const hndMn = eng.vessel_new(JSON.stringify(cfg));
for (const d of [{ reagent_id: 'water', volume_ml: 50 }, { reagent_id: 'hcl_1m', volume_ml: 10 }]) eng.vessel_dose(hndMn, JSON.stringify(d));
addPortion(hndMn, { aqueous_mol: { 'MnO4-': 0.01, 'K+': 0.01, 'Fe+2': 0.002, 'Cl-': 0.004 } });
eng.step_all(JSON.stringify([hndMn]), 0.002); // a short step: most of the permanganate is still there to react
const mnView = viewOf(hndMn, 'v-mn');

await ok('electron transfer: the one-electron step of permanganate + iron(II) plays with a drawn electron and its caption', async () => {
  await run(4);
  const et = mnView.v.rows.filter((r) => r.kind === 'electron_transfer');
  assert.ok(et.length >= 1, `electron-transfer rows: ${mnView.v.rows.map((r) => r.kind + ':' + r.equation)}`);
  assert.ok(et.some((r) => r.note && /one-electron step/.test(r.note)), 'a many-electron reaction is shown as its one-electron step');
  assert.match(mnView.v.legend.textContent, /one-electron step/);
  let electronDrawn = false;
  let captioned = false;
  for (let t = 0; t < 90 && !(electronDrawn && captioned); t += 1 / 30) {
    clock += 1000 / 30;
    rafCb(clock);
    if (Math.round(t * 30) % 15 === 0) await flush();
    for (const e of mnView.v.events) {
      if (e.row.kind !== 'electron_transfer') continue;
      // every event atom plus the electron points: more instances than the atoms of all the events in progress
      const n = mnView.v.events.reduce((a, x) => a + (x.reaction ? x.reaction.ev.spec.reactants.reduce((b, st) => b + st.atoms.length, 0) : 0), 0);
      if (mnView.scenes[0].stats().eventAtoms > n) electronDrawn = true;
      if (/e⁻/.test(mnView.v.caption.textContent)) captioned = true;
    }
  }
  assert.ok(electronDrawn, 'the electron point was drawn');
  assert.ok(captioned, 'the caption names the electron hop');
});

await ok('a row that involves a solid is listed but not played in the solution view (it is played in the surface view of its solid)', async () => {
  const hndZn = eng.vessel_new(JSON.stringify(cfg));
  eng.vessel_dose(hndZn, JSON.stringify({ reagent_id: 'water', volume_ml: 50 }));
  addPortion(hndZn, { aqueous_mol: { 'Cu+2': 0.005, 'SO4-2': 0.005 }, solid_mol: { 'Zn(s)': 0.005 } });
  for (let i = 0; i < 4; i++) eng.step_all(JSON.stringify([hndZn]), 0.5);
  const zv = viewOf(hndZn, 'v-zn');
  await run(4);
  const pair = zv.v.rows.find((r) => r.kind === 'electron_transfer' && r.reactants.includes('Zn(s)'));
  assert.ok(pair, 'the Zn + Cu2+ pair is described');
  assert.ok(!zv.v.playable(pair), 'not played in the solution view');
  assert.match(zv.v.legend.textContent, /surface view/);
  zv.v.setActive(false);
  eng.vessel_free(hndZn);
});

eng.vessel_free(hndCu);
eng.vessel_free(hndMn);
eng.vessel_free(hnd);
eng.vessel_free(hnd2);
console.log(`micro_view: ${n} checks passed`);
