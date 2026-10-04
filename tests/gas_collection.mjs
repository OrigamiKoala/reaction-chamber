// Gas collection against the *built* WASM engine: node tests/gas_collection.mjs
// A stoppered flask with a delivery tube feeds a gas syringe / gas tube / gas jar. Checks mole conservation
// (removed from the source headspace == added to the collector, + what a full collector let escape), the volume
// reading (ideal gas at lab T / P, water-vapour correction over water) and that the flask does not pressurise.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as G from '../web/src/bench/gas_math.ts';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();

const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const mk = (type, cap, glass, r, sealed = false) =>
  eng.vessel_new(JSON.stringify({ type, capacity_ml: cap, glass_mass_g: glass, inner_radius_cm: r, temperature_k: 293.15, room_k: 293.15, sealed, stopper_pop_atm: 2.2, burst_atm: 6.0 }));
const flask = () => mk('erlenmeyer-250', 250, 105, 3.6);
const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const snap = (h) => J(eng.vessel_snapshot(h));
const carbonInSolution = (sn) => sn.species.filter((x) => ['CO2(aq)', 'HCO3-', 'CO3-2', 'H2CO3'].includes(x.id)).reduce((a, x) => a + x.amount_mol, 0);
const near = (what, a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

/** step all handles for `secs` of sim time in 50 ms ticks like the app's 20 Hz loop; returns the last snapshots. */
function run(handles, secs, each) {
  let last = {};
  for (let t = 0; t < secs; t += 0.05) {
    last = J(eng.step_all(JSON.stringify(handles), 0.05));
    each?.(last, t);
  }
  return last;
}

// Stage 4: the flask holds air (and vapour) like any real flask, so what the tube carries is the headspace gas: the
// flask's air goes over first, mixed with the evolved gas. The collector reads the volume of gas pushed out.
const molOf = (list, id) => list.find((x) => x.species === id)?.mol ?? 0;
const molsMatching = (list, re) => list.filter((x) => re.test(x.species)).reduce((a, x) => a + x.mol, 0);

// 1. Mg + excess HCl -> H2 into a 250 mL gas syringe (the 84 mL of hydrogen plus the warm air it pushes out)
{
  const src = flask();
  const syr = mk('gas-syringe-250', 250, 140, 1.5);
  assert.equal(eng.vessel_gas_link(src, syr), true, 'link');
  assert.equal(snap(src).sealed, true, 'linking stoppers the flask');
  dose(src, { reagent_id: 'hcl_1m', volume_ml: 30 });
  const mgMol = 0.0035; // 0.085 g
  // (a powder: the test is about collecting the gas, not about how fast a ribbon dissolves)
  dose(src, { reagent_id: 'mg_ribbon', mass_g: mgMol * 24.305, solid_form: 'powder' });
  let maxP = 0;
  const s = run([src, syr], 60, (all) => (maxP = Math.max(maxP, all[src].pressure_atm)));
  const gs = s[syr].gas;
  assert.equal(gs.collector, 'syringe');
  const molH2 = molOf(gs.species, 'H2(g)');
  const flaskH2 = molOf(s[src].gas.species, 'H2(g)');
  near('H2 collected + left in the flask = Mg consumed', molH2 + flaskH2, mgMol, 0.0002);
  assert.ok(molH2 > mgMol * 0.05, `some H2 reached the syringe ${molH2}`);
  assert.ok(molOf(gs.species, 'N2(g)') > 0, 'the displaced air is in the syringe too');
  near('syringe volume = ideal gas at 20 C, 1 atm', gs.volume_ml, G.collectorVolumeMl(gs.total_mol, 293.15, gs.vapour_atm), 1e-6);
  near('volume reading ~ 84 mL of H2 plus thermal expansion and vapour', gs.volume_ml, 95, 15);
  assert.ok(maxP < 1.1, `the connected flask must not pressurise (peak ${maxP} atm)`);
  assert.equal(s[src].sealed, true);
  assert.equal(gs.escaped_mol, 0);
  console.log(`  ok Mg+HCl -> ${gs.volume_ml.toFixed(1)} mL pushed into the syringe, ${(molH2 * 1000).toFixed(2)} mmol of it H2 (peak flask pressure ${maxP.toFixed(3)} atm)`);
  eng.vessel_free(src);
  eng.vessel_free(syr);
}

// 2. NaHCO3 + acetic acid -> CO2 over water in a 50 mL gas tube (reading includes the water vapour)
{
  const src = flask();
  const tube = mk('gas-collection-tube-50', 50, 45, 1.0);
  eng.vessel_gas_link(src, tube);
  dose(src, { reagent_id: 'ch3cooh_5pct', volume_ml: 20 });
  for (let i = 0; i < 4; i++) dose(src, { reagent_id: 'nahco3_s', mass_g: 0.05 }); // 2.38 mmol CO2 = 57 mL dry > 50 mL tube
  const s = run([src, tube], 90);
  const g = s[tube].gas;
  assert.equal(g.collector, 'over_water');
  assert.ok(g.vapour_atm > 0.02 && g.vapour_atm < 0.026);
  assert.ok(g.volume_ml <= 50 + 1e-6, `capped by the tube: ${g.volume_ml}`);
  const produced = 0.2 / 84.007; // mol HCO3-
  const co2Out = molOf(g.species, 'CO2(g)') + (g.escaped_mol * molOf(g.species, 'CO2(g)')) / Math.max(1e-12, g.total_mol);
  near('carbon conserved: CO2 collected + in flask + dissolved (escaped gas carries its CO2 share)', co2Out + molOf(s[src].gas.species, 'CO2(g)') + carbonInSolution(s[src]), produced, 0.0003);
  near('tube volume (water-vapour corrected)', g.volume_ml, G.collectorVolumeMl(g.total_mol, 293.15, g.vapour_atm), 1e-6);
  console.log(`  ok NaHCO3 + vinegar over water: ${g.volume_ml.toFixed(1)} mL in a 50 mL tube, ${(g.escaped_mol * 1000).toFixed(3)} mmol escaped`);
  eng.vessel_free(src);
  eng.vessel_free(tube);
}

// 3. Overfilling a syringe: the excess escapes, books balance
{
  const src = flask();
  const syr = mk('gas-syringe-100', 100, 140, 1.5);
  eng.vessel_gas_link(src, syr);
  dose(src, { reagent_id: 'ch3cooh_5pct', volume_ml: 100 });
  let total = 0;
  for (let i = 0; i < 20; i++) {
    dose(src, { reagent_id: 'nahco3_s', mass_g: 0.25 }); // 2.98 mmol each, ~60 mmol altogether
    total += 0.25 / 84.007;
    run([src, syr], 3);
  }
  const s = run([src, syr], 20);
  const g = s[syr].gas;
  near('syringe is full', g.volume_ml, 100, 0.5);
  assert.ok(g.escaped_mol > 0.0005, 'excess escaped');
  // (the escaped gas is a mixture of air and CO2: its CO2 share is unknown, so check what is certain)
  const co2Collected = molOf(g.species, 'CO2(g)');
  assert.ok(co2Collected + molOf(s[src].gas.species, 'CO2(g)') + carbonInSolution(s[src]) <= total + 0.0003, 'no carbon created');
  assert.ok(co2Collected + molOf(s[src].gas.species, 'CO2(g)') + carbonInSolution(s[src]) + g.escaped_mol >= total - 0.0003, 'carbon accounted for');
  assert.equal(s[src].sealed, true, 'connected flask keeps its stopper');
  console.log(`  ok overfilled syringe: ${g.volume_ml.toFixed(1)} mL, ${(g.escaped_mol * 1000).toFixed(1)} mmol escaped`);
  eng.vessel_free(src);
  eng.vessel_free(syr);
}

// 4. Unlink: the stopper stays, gas builds pressure again; a freed collector drops its link; venting empties it
{
  const src = flask();
  const syr = mk('gas-syringe-100', 100, 140, 1.5);
  eng.vessel_gas_link(src, syr);
  assert.equal(eng.vessel_gas_unlink(src), true);
  assert.equal(eng.vessel_gas_unlink(src), false);
  dose(src, { reagent_id: 'ch3cooh_5pct', volume_ml: 20 });
  dose(src, { reagent_id: 'nahco3_s', mass_g: 0.3 });
  const s = run([src, syr], 10);
  assert.ok(s[syr].gas.total_mol < 1e-12, 'nothing is collected without a tube');
  assert.ok(s[src].pressure_atm > 1.1 || s[src].gas.total_mol > 1e-3, 'gas stays in the stoppered flask');
  eng.vessel_gas_link(src, syr);
  // (Stage 8: the supersaturated CO2 leaves the liquid over tens of seconds, not at once)
  const s2 = run([src, syr], 60);
  assert.ok(s2[syr].gas.volume_ml > 50, 're-linked: the trapped gas flows into the syringe');
  const vented = eng.vessel_gas_vent(syr);
  assert.ok(vented > 0.002);
  assert.equal(snap(syr).gas.total_mol, 0);
  eng.vessel_free(syr); // freeing an end drops the link without breaking the flask
  run([src], 1);
  eng.vessel_free(src);
  console.log('  ok unlink / re-link / vent / free');
}

// 5. A plain vessel reports its trapped headspace gas, no collector
{
  const v = mk('erlenmeyer-250', 250, 105, 3.6, true);
  dose(v, { reagent_id: 'ch3cooh_5pct', volume_ml: 20 });
  dose(v, { reagent_id: 'nahco3_s', mass_g: 0.1 });
  // (Stage 8: ~60 mM of supersaturated CO2 leaves the liquid over a minute or two, like a glass of soda, not within 5 s)
  const s = run([v], 100)[v];
  assert.equal(s.gas.collector, null);
  assert.ok(s.gas.total_mol > 2e-4 && s.gas.species[0].species === 'CO2(g)', 'a plain flask reports the evolved gas, not its air');
  eng.vessel_free(v);
  console.log('  ok stoppered flask reports its headspace gas');
}
console.log('gas collection OK');
