// End-to-end check of the *built* WASM engine's 3D structures for the molecular viewer (engine `vessel_micro_structures`,
// worker message MICRO_STRUCTURES), without a browser:
//   node tests/micro_structures.mjs
// An import carries its SMILES only in the vessel's compound table, so its structure must come from there; store species
// come from their SMILES, a PubChem structure row or the formula rule; a monatomic ion is one sphere with its radius.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();

const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 298.15, room_k: 298.15 };

J(eng.import_compound(JSON.stringify({ id: 'c_etbz', name: 'ethyl benzoate', formula: 'C9H10O2', smiles: 'CCOC(=O)c1ccccc1', state: 'liquid', density: 1.05, vapor_pressure_points: [[485.9, 101325]] })));
const h = eng.vessel_new(JSON.stringify(cfg));
eng.vessel_dose(h, JSON.stringify({ reagent_id: 'c_etbz', volume_ml: 5 }));

// the viewer asks with the ids of the snapshot (an import is keyed by its Hill formula)
const imported = J(eng.vessel_snapshot(h)).species.map((x) => x.id).find((id) => id.startsWith('C9H10O2'));
assert.ok(imported, 'ethyl benzoate not in the snapshot');
const ids = [imported, 'H2O', 'Na+', 'SO4-2', 'Cu(NH3)4+2', 'S2O3-2'];
const t0 = performance.now();
const out = J(eng.vessel_micro_structures(h, JSON.stringify(ids)));
const ms = performance.now() - t0;
assert.equal(out.length, ids.length);
const by = Object.fromEntries(out.map((s) => [s.species, s]));

for (const s of out) {
  assert.ok(s.atoms.length >= 1, `${s.species}: no atoms`);
  for (const a of s.atoms) assert.ok([a.x, a.y, a.z].every(Number.isFinite), `${s.species}: non-finite coordinate`);
  for (const b of s.bonds) assert.ok(b.a < s.atoms.length && b.b < s.atoms.length && b.a !== b.b, `${s.species}: bad bond`);
  assert.equal(s.atoms.reduce((q, a) => q + a.charge, 0), s.charge, `${s.species}: charges do not add up`);
}

// the import: SMILES from the vessel, skeleton in SMILES order then 10 hydrogens
assert.equal(by[imported].source, 'smiles');
assert.equal(by[imported].n_heavy, 11);
assert.equal(by[imported].atoms.length, 21);
assert.deepEqual(by[imported].atoms.slice(0, 4).map((a) => a.el), ['C', 'C', 'O', 'C']);
assert.equal(by[imported].bonds.filter((b) => b.aromatic).length, 6);

assert.equal(by.H2O.atoms.length, 3);
assert.equal(by['Na+'].atoms.length, 1);
assert.ok(by['Na+'].radius_a > 0.9 && by['Na+'].radius_a < 1.1);
assert.equal(by['SO4-2'].atoms.length, 5);
assert.equal(by['Cu(NH3)4+2'].source, 'formula-rule');
assert.equal(by['Cu(NH3)4+2'].atoms.length, 17);
assert.equal(by['Cu(NH3)4+2'].bonds.filter((b) => b.coordinate).length, 4);
assert.equal(by['S2O3-2'].source, 'structure_data');

// cached: a second request is cheap
const t1 = performance.now();
eng.vessel_micro_structures(h, JSON.stringify(ids));
const ms2 = performance.now() - t1;
console.log(`micro structures: ${ids.length} species in ${ms.toFixed(1)} ms (cached ${ms2.toFixed(2)} ms)`);
eng.vessel_free(h);
console.log('micro_structures: all checks passed');
