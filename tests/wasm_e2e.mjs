// End-to-end check of the *built* WASM engine (what the browser loads), without a browser:
//   node tests/wasm_e2e.mjs
// Imports KCl the way the web app does (formula + SMILES + state from PubChem), doses it with AgNO3 and asserts that
// AgCl(s) precipitates and the reaction log says so.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();

const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15 };
const vessel = () => eng.vessel_new(JSON.stringify(cfg));
const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const snap = (h) => J(eng.vessel_snapshot(h));
const imp = (r) => J(eng.import_compound(JSON.stringify(r)));

// 1. KCl as PubChem delivers it: Hill-ordered formula, fragment SMILES, solid
const kcl = imp({ id: 'pc_KCl', name: 'Potassium chloride', formula: 'ClK', smiles: '[Cl-].[K+]', state: 'solid', density: 1.98 });
assert.equal(kcl.modelable, true, kcl.reason);
assert.equal(kcl.by_mass, true);
console.log('KCl model:', kcl.reason);

const h = vessel();
dose(h, { reagent_id: 'agno3_0_1m', volume_ml: 25 });
dose(h, { reagent_id: 'pc_KCl', mass_g: 0.5 });
let s = snap(h);
const agcl = s.solids.find((x) => x.species === 'AgCl(s)');
assert.ok(agcl && agcl.mass_g > 0.3, 'AgCl precipitates: ' + JSON.stringify(s.solids.map((x) => x.species)));
assert.ok(s.species.some((x) => x.id === 'AgCl(s)' && x.phase === 'solid'), 'AgCl in species rows');
const ev = s.events.find((e) => e.kind === 'precipitate_formed');
assert.ok(ev && /white precipitate formed: AgCl/i.test(ev.detail), 'log: ' + JSON.stringify(s.events));
assert.ok(s.events.every((e) => typeof e.seq === 'number'), 'events carry seq');
console.log('log:', s.events.map((e) => e.detail).join(' | '));

// the event must not repeat while the sim runs
for (let i = 0; i < 240; i++) eng.step_all(JSON.stringify([h]), 0.5);
s = snap(h);
assert.equal(s.events.filter((e) => e.kind === 'precipitate_formed').length, 1);
const settled = s.solids.find((x) => x.species === 'AgCl(s)');
assert.ok(settled.suspended_fraction < 0.25, 'precipitate settles: ' + settled.suspended_fraction);

// 2. A handful of other generic combinations, all imported by formula only
const cases = [
  [['Na2O4S', 'Na2SO4'], ['BaCl2', 'BaCl2'], 'BaSO4(s)'],
  [['CNa2O3', 'Na2CO3'], ['CaCl2', 'CaCl2'], 'CaCO3(s)'],
  [['N2O6Pb', 'Pb(NO3)2'], ['IK', 'KI'], 'PbI2(s)'],
  [['CrK2O4', 'K2CrO4'], ['AgNO3', 'AgNO3'], 'Ag2CrO4(s)'],
  [['Cl3Fe', 'FeCl3'], ['HNaO', 'NaOH'], 'Fe(OH)3(s)'],
];
for (const [[fa, na], [fb, nb], sp] of cases) {
  const a = imp({ id: `x_${na}`, name: na, formula: fa, state: 'liquid' });
  const b = imp({ id: `x_${nb}`, name: nb, formula: fb, state: 'liquid' });
  assert.ok(a.modelable && b.modelable, `${na}/${nb}: ${a.reason} / ${b.reason}`);
  const v = vessel();
  dose(v, { reagent_id: `x_${na}`, volume_ml: 25 });
  dose(v, { reagent_id: `x_${nb}`, volume_ml: 25 });
  const sn = snap(v);
  assert.ok(sn.solids.some((x) => x.species === sp && x.mass_g > 0), `${na} + ${nb} -> ${sp}: got ${sn.solids.map((x) => x.species)}`);
  assert.ok(sn.events.some((e) => e.kind === 'precipitate_formed' && e.detail.includes(sp.replace('(s)', ''))));
  console.log(`${na} + ${nb}: ${sn.events.find((e) => e.kind === 'precipitate_formed').detail}`);
}

// 3. What cannot be modelled is reported, not silently ignored
const glucose = imp({ id: 'x_glc', name: 'Glucose', formula: 'C6H12O6', smiles: 'C(C1C(C(C(C(O1)O)O)O)O)O', state: 'solid' });
assert.equal(glucose.modelable, false);
console.log('glucose:', glucose.reason);
console.log('wasm e2e OK');
