// Continuous (manual) dosing must be chemically the same as one big dose: node tests/flow_e2e.mjs
// Drives the built WASM engine headlessly like Lab.openFlow does: many tiny doses (the flow sink batches ~10 Hz).
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
const catalog = J(eng.reagent_catalog_json());
const byId = (id) => catalog.find((e) => e.id === id);
const pick = (pred, what) => {
  const e = catalog.find(pred);
  assert.ok(e, `catalog has ${what}`);
  return e;
};

const relDiff = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(a), Math.abs(b));
const speciesAmt = (s, id) => s.species.find((x) => x.id === id)?.amount_mol ?? 0;

function compare(name, label, runBig, runSmall, { checkPh = true, tolPh = 0.01, minMol = 1e-7 } = {}) {
  const a = vessel();
  const b = vessel();
  runBig(a);
  runSmall(b);
  const sa = snap(a);
  const sb = snap(b);
  near(`${label}: volume`, sa.total_liquid_ml, sb.total_liquid_ml, 0.01);
  near(`${label}: contents mass`, sa.contents_mass_g, sb.contents_mass_g, 0.02);
  if (checkPh && sa.ph !== null && sb.ph !== null) near(`${label}: pH`, sa.ph, sb.ph, tolPh);
  for (const sp of sa.species) {
    if (sp.amount_mol < minMol) continue;
    assert.ok(relDiff(sp.amount_mol, speciesAmt(sb, sp.id)) < 0.01, `${label}: ${sp.id} ${sp.amount_mol} vs ${speciesAmt(sb, sp.id)}`);
  }
  console.log(`  ok ${name}: ${sa.total_liquid_ml.toFixed(2)} mL, pH ${sa.ph?.toFixed(3) ?? '-'}, ${sa.solids.map((x) => `${x.species} ${x.mass_g.toFixed(3)} g`).join(', ') || 'no solids'}`);
  return [sa, sb];
}
function near(what, x, y, tol) {
  assert.ok(Math.abs(x - y) <= tol, `${what}: ${x} vs ${y} (tol ${tol})`);
}

// 1. strong acid: 200 x 0.5 mL == 1 x 100 mL
const acid = pick((e) => e.form === 'solution' && /hcl/i.test(e.id), 'an HCl solution');
compare(`200 x 0.5 mL ${acid.id}`, 'acid',
  (h) => dose(h, { reagent_id: acid.id, volume_ml: 100 }),
  (h) => { for (let i = 0; i < 200; i++) dose(h, { reagent_id: acid.id, volume_ml: 0.5 }); });

// 2. titration-like: base trickled into acid in 0.05 mL increments (the hit-the-endpoint workflow)
const base = pick((e) => e.form === 'solution' && /naoh/i.test(e.id), 'a NaOH solution');
compare(`acid then 400 x 0.05 mL ${base.id}`, 'neutralisation',
  (h) => { dose(h, { reagent_id: acid.id, volume_ml: 50 }); dose(h, { reagent_id: base.id, volume_ml: 20 }); },
  (h) => { dose(h, { reagent_id: acid.id, volume_ml: 50 }); for (let i = 0; i < 400; i++) dose(h, { reagent_id: base.id, volume_ml: 0.05 }); });

// 3. precipitation: AgNO3 trickled onto chloride (AgCl must end up the same, same Ksp state)
const ag = byId('agno3_0_1m') ?? pick((e) => /agno3/i.test(e.id), 'AgNO3');
const cl = pick((e) => e.form === 'solution' && /(nacl|kcl)/i.test(e.id), 'a chloride solution');
const [pa, pb] = compare(`AgNO3 in 100 x 0.25 mL onto ${cl.id}`, 'precipitation',
  (h) => { dose(h, { reagent_id: cl.id, volume_ml: 30 }); dose(h, { reagent_id: ag.id, volume_ml: 25 }); },
  (h) => { dose(h, { reagent_id: cl.id, volume_ml: 30 }); for (let i = 0; i < 100; i++) dose(h, { reagent_id: ag.id, volume_ml: 0.25 }); });
const m1 = pa.solids.find((x) => x.species === 'AgCl(s)')?.mass_g ?? 0;
const m2 = pb.solids.find((x) => x.species === 'AgCl(s)')?.mass_g ?? 0;
assert.ok(m1 > 0 && relDiff(m1, m2) < 0.02, `AgCl mass ${m1} vs ${m2}`);

const snap0Water = (() => { const w = vessel(); dose(w, { reagent_id: 'water', volume_ml: 50 }); return snap(w).contents_mass_g; })();
// 4. solid weigh-in: 250 x 10 mg == 2.5 g (balance workflow); mass accounted exactly
const solid = byId('nahco3_s') ?? pick((e) => e.by_mass, 'a by-mass solid');
const [sa, sb] = compare(`250 x 10 mg ${solid.id}`, 'solid',
  (h) => { dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: solid.id, mass_g: 2.5 }); },
  (h) => { dose(h, { reagent_id: 'water', volume_ml: 50 }); for (let i = 0; i < 250; i++) dose(h, { reagent_id: solid.id, mass_g: 0.01 }); },
  // pH is compared too: the engine solves all equilibria jointly, so one 2.5 g dose and 250 x 10 mg both give ~8.2
  { minMol: 1e-3 });
// 0.6 M NaHCO3 reads ~8.0 on the activity scale (Debye-Hueckel slope now follows the dielectric constant of water at T)
assert.ok(sa.ph > 7.9 && sa.ph < 8.5, `NaHCO3 pH ${sa.ph}`);
near('weigh-in mass', sb.contents_mass_g - snap0Water, 2.5, 0.01);

// 5. drops: 60 x 1 drop == 3 mL by drops==volume equivalence (0.05 mL each)
const dropper = pick((e) => e.dropper, 'a dropper reagent');
const d = vessel();
dose(d, { reagent_id: 'water', volume_ml: 20 });
const before = snap(d).total_liquid_ml;
for (let i = 0; i < 60; i++) dose(d, { reagent_id: dropper.id, drops: 1 });
near('60 drops = 3 mL', snap(d).total_liquid_ml - before, 3, 0.05);
console.log('  ok drops accumulate 0.05 mL each');
console.log('flow e2e OK');
