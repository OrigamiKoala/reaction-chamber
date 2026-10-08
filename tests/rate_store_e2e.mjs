// End-to-end check of the rate store through the *built* WASM engine (what the browser loads):
//   node tests/rate_store_e2e.mjs
// A vessel with bromoethane in sodium hydroxide generates its organic network; a registered rate
// (register_reaction_rates), keyed by the structural key of the generated reaction, replaces the template rule in the
// vessel's reaction rows on the next step. This is the path the shipped table takes.
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

const imp = J(eng.import_compound(JSON.stringify({
  id: 'pc_bromoethane', name: 'Bromoethane', formula: 'C2H5Br', smiles: 'CCBr', inchi_key: 'RDHPKYGYEGBPIA-UHFFFAOYSA-N',
  state: 'liquid', density: 1.46,
})));
assert.equal(imp.modelable, true, imp.reason);

const h = eng.vessel_new(JSON.stringify(cfg));
eng.vessel_dose(h, JSON.stringify({ reagent_id: 'naoh_1m', volume_ml: 50 }));
eng.vessel_dose(h, JSON.stringify({ reagent_id: 'pc_bromoethane', volume_ml: 0.5 }));
for (let i = 0; i < 20; i++) eng.vessel_step(h, 0.05);

// the key is structural (graph hashes), so the generator's reaction for the seeded bromoethane has the key of the vessel's row
const net = J(eng.m6_generate_reaction_network(JSON.stringify({ bromoethane: 0.1, 'OH-': 0.1, 'Na+': 0.1, H2O: 55.5 }), 298.15, 13));
const rule = net.reactions.find((r) => r.family_id === 'sn2_substitution');
assert.ok(rule, 'an SN2 reaction: ' + JSON.stringify(net.reactions.map((r) => r.family_id)));
assert.ok(rule.template_a > 0 && rule.template_ea_j_mol > 0 && rule.rate_key.startsWith('sn2_substitution|'));
const rowOf = () => J(eng.vessel_snapshot(h)).reactions.find((r) => String(r.id).startsWith('sn2_substitution'));
const before = rowOf();
assert.ok(before, 'the SN2 row is in the snapshot');

// the shipped table of measured rows is already in the store (loaded when the engine first asks for a rate)
const sizeBefore = eng.rate_store_size();
assert.ok(sizeBefore >= 40, `the measured table is loaded: ${sizeBefore} rows`);
const changed = eng.register_reaction_rates(JSON.stringify([{
  key: rule.rate_key, a: rule.template_a * 50, ea_j_mol: rule.template_ea_j_mol, tier: 'estimated', source: 'e2e calculated rate',
}]));
assert.equal(changed, 1);
assert.equal(eng.rate_store_size(), sizeBefore + 1);
eng.vessel_step(h, 0.05);
const after = rowOf();
assert.ok(after.source.startsWith('e2e calculated rate'), after.source);
console.log('SN2 row source after registration:', after.source.slice(0, 90), '...');
console.log('rate_store_e2e: ok');
