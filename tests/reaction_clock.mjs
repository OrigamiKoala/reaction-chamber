// Reaction-timer detection against the *built* WASM engine (no browser):
//   node tests/reaction_clock.mjs        (Node >= 22.6 for TypeScript type stripping)
// Feeds engine snapshots (as the app's 20 Hz loop does) into ReactionClock and asserts the clock only starts when a
// real reaction happens — not for dissolving a salt, adding water, or heating.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'web', 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const { ReactionClock } = await import(pathToFileURL(path.join(root, 'web', 'src', 'app', 'reaction_clock.ts')).href);

const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15 };
const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
imp({ id: 'pc_NaCl', name: 'Sodium chloride', formula: 'ClNa', smiles: '[Na+].[Cl-]', state: 'solid', density: 2.16 });
imp({ id: 'pc_KCl', name: 'Potassium chloride', formula: 'ClK', smiles: '[K+].[Cl-]', state: 'solid', density: 1.98 });
imp({ id: 'pc_CuSO4', name: 'Copper sulfate', formula: 'CuSO4', state: 'solid' });

/** Runs a scenario: doses (at a chosen sim time) + stepping, feeding every snapshot to the clock like the app does. */
function scenario(steps, { tail = 10 } = {}) {
  const h = eng.vessel_new(JSON.stringify(cfg));
  const clock = new ReactionClock();
  const fed = () => {
    const s = J(eng.vessel_snapshot(h));
    const started = clock.observe(s);
    return { s, started };
  };
  let startedAt = null;
  const check = () => {
    const { s, started } = fed();
    if (started) startedAt = clock.info(s.t_sim_s);
    return s;
  };
  for (const st of steps) {
    if (st.wait) for (let i = 0; i < st.wait * 2; i++) { eng.step_all(JSON.stringify([h]), 0.5); check(); }
    else if (st.heat !== undefined) eng.vessel_control(h, JSON.stringify({ heater_w: st.heat }));
    else { eng.vessel_dose(h, JSON.stringify(st)); check(); }
  }
  for (let i = 0; i < tail * 2; i++) { eng.step_all(JSON.stringify([h]), 0.5); check(); }
  const s = J(eng.vessel_snapshot(h));
  return { clock, tNow: s.t_sim_s, startedAt, info: clock.info(s.t_sim_s) };
}

const must = (name, steps, expectStartBy) => {
  const r = scenario(steps);
  assert.equal(r.info.phase, 'running', `${name}: should start`);
  if (expectStartBy !== undefined) assert.ok(r.info.elapsedS >= r.tNow - expectStartBy - 1e-6, `${name}: started late (elapsed ${r.info.elapsedS}, now ${r.tNow})`);
  console.log(`  starts   ${name.padEnd(34)} elapsed ${r.info.elapsedS.toFixed(2)} s of ${r.tNow.toFixed(1)} s  [${r.info.reason}]`);
};
const mustNot = (name, steps) => {
  const r = scenario(steps);
  assert.equal(r.info.phase, 'waiting', `${name}: must NOT start (${r.info.reason})`);
  assert.equal(r.info.elapsedS, 0);
  console.log(`  waiting  ${name}`);
};

console.log('Reaction clock vs engine');
// --- must NOT start
mustNot('water only', [{ reagent_id: 'water', volume_ml: 100 }]);
mustNot('NaCl dissolving in water', [{ reagent_id: 'water', volume_ml: 100 }, { reagent_id: 'pc_NaCl', mass_g: 1 }]);
mustNot('NaHCO3 dissolving in water', [{ reagent_id: 'water', volume_ml: 100 }, { reagent_id: 'nahco3_s', mass_g: 2 }]);
mustNot('CuSO4 dissolving (turns blue)', [{ reagent_id: 'water', volume_ml: 100 }, { reagent_id: 'pc_CuSO4', mass_g: 1 }]);
mustNot('CuSO4 solution + water', [{ reagent_id: 'cuso4_0_1m', volume_ml: 50 }, { reagent_id: 'water', volume_ml: 50 }]);
mustNot('HCl diluted into water', [{ reagent_id: 'water', volume_ml: 100 }, { reagent_id: 'hcl_1m', volume_ml: 10 }]);
mustNot('NaOH diluted into water', [{ reagent_id: 'water', volume_ml: 100 }, { reagent_id: 'naoh_1m', volume_ml: 10 }]);
mustNot('heating water', [{ reagent_id: 'water', volume_ml: 100 }, { heat: 500 }, { wait: 30 }]);
mustNot('two unreactive solutions', [{ reagent_id: 'nacl_0_1m', volume_ml: 25 }, { reagent_id: 'ki_0_5m', volume_ml: 25 }]);
// --- must start
must('KCl + AgNO3 (precipitate)', [{ reagent_id: 'agno3_0_1m', volume_ml: 25 }, { reagent_id: 'pc_KCl', mass_g: 0.5 }], 0.6);
must('HCl + NaOH (neutralisation)', [{ reagent_id: 'hcl_1m', volume_ml: 50 }, { reagent_id: 'naoh_1m', volume_ml: 50 }], 0.6);
must('0.1 M HCl + 0.1 M NaOH', [{ reagent_id: 'hcl_0_1m', volume_ml: 50 }, { reagent_id: 'naoh_0_1m', volume_ml: 50 }], 0.6);
must('NaOH drop into acetic acid', [{ reagent_id: 'ch3cooh_5pct', volume_ml: 50 }, { reagent_id: 'naoh_0_1m', drops: 4 }], 0.6);
must('NaHCO3 + acetic acid (CO2)', [{ reagent_id: 'ch3cooh_5pct', volume_ml: 50 }, { reagent_id: 'nahco3_s', mass_g: 2 }]);
must('Mg + HCl (H2)', [{ reagent_id: 'hcl_1m', volume_ml: 50 }, { reagent_id: 'mg_ribbon', mass_g: 0.2 }]);
must('Fe3+ + SCN- (complex)', [{ reagent_id: 'fe_no3_3_0_1m', volume_ml: 25 }, { reagent_id: 'kscn_0_1m', volume_ml: 5 }], 0.6);
must('H2O2 + MnO2', [{ reagent_id: 'h2o2_3pct', volume_ml: 25 }, { reagent_id: 'mno2_s', mass_g: 0.5 }]);
must('iodine clock (slow kinetic)', [{ reagent_id: 'ki_0_05m', volume_ml: 25 }, { reagent_id: 's2o8_0_04m', volume_ml: 25 }]);
// start time is the moment of the reaction, not of vessel creation
{
  const r = scenario([{ reagent_id: 'water', volume_ml: 50 }, { wait: 20 }, { reagent_id: 'hcl_1m', volume_ml: 25 }, { reagent_id: 'naoh_1m', volume_ml: 25 }], { tail: 5 });
  assert.equal(r.info.phase, 'running');
  assert.ok(r.info.elapsedS < 6, `idle 20 s must not count: elapsed ${r.info.elapsedS}`);
  console.log(`  idle 20 s then neutralise: elapsed ${r.info.elapsedS.toFixed(2)} s of ${r.tNow.toFixed(1)} s`);
}

// --- manual stopwatch semantics
{
  const c = new ReactionClock();
  assert.equal(c.info(5).phase, 'waiting');
  c.start(5);
  assert.equal(c.info(8).elapsedS, 3);
  c.stop(9);
  assert.equal(c.info(20).elapsedS, 4);
  assert.equal(c.info(20).phase, 'stopped');
  c.start(30); // resume
  assert.equal(c.info(32).elapsedS, 6);
  c.reset();
  assert.equal(c.info(40).phase, 'waiting');
  assert.equal(c.info(40).elapsedS, 0);
  console.log('  stopwatch start/stop/resume/reset OK');
}
console.log('reaction clock OK');
