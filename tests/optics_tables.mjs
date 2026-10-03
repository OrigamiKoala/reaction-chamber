// The web's fallback colorimetry (render/cie.ts, used until the engine loads) must equal the engine's own tables, and the
// spectrophotometer's scan must come from the engine's optical records. Run: node tests/optics_tables.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rgbWeights } from '../web/src/render/cie.ts';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};

const tables = J(eng.optics_tables_json());
ok('grid and weights: engine and TypeScript fallback agree', () => {
  assert.equal(tables.n_bins, 41);
  assert.equal(tables.bin_nm0, 380);
  const w = rgbWeights();
  assert.equal(w.length, tables.rgb_weights.length);
  for (let i = 0; i < w.length; i++) assert.ok(Math.abs(w[i] - tables.rgb_weights[i]) < 1e-9, `weight ${i}: ${w[i]} vs ${tables.rgb_weights[i]}`);
  for (let c = 0; c < 3; c++) {
    let sum = 0;
    for (let i = 0; i < 41; i++) sum += w[i * 3 + c];
    assert.ok(Math.abs(sum - 1) < 1e-9, 'white balanced');
  }
  assert.match(tables.data_version, /^[0-9a-f]{16}$/);
});

const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15 };
ok('UV-vis scan: permanganate is read from the engine records, ligand-field fills in for nickel, the flame test reads the sample', () => {
  const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
  assert.equal(imp({ id: 'ot_kmno4', name: 'Potassium permanganate', formula: 'KMnO4', state: 'solid', density: 2.7 }).modelable, true);
  assert.equal(imp({ id: 'ot_nicl2', name: 'Nickel chloride', formula: 'Cl2Ni', state: 'solid', density: 3.5, solubility_g_per_l: 600 }).modelable, true);
  assert.equal(imp({ id: 'ot_srcl2', name: 'Strontium chloride', formula: 'Cl2Sr', state: 'solid', density: 3.05, solubility_g_per_l: 500 }).modelable, true);
  for (const [id, expectNm, expectName] of [['ot_kmno4', [520, 550], /MnO/], ['ot_nicl2', [370, 720], /Ni/]]) {
    const h = eng.vessel_new(JSON.stringify(cfg));
    eng.vessel_dose(h, JSON.stringify({ reagent_id: 'water', volume_ml: 50 }));
    eng.vessel_dose(h, JSON.stringify({ reagent_id: id, mass_g: 0.05 }));
    for (let i = 0; i < 20; i++) eng.vessel_step(h, 0.5);
    const scan = J(eng.vessel_uvvis_scan(h, 0, 350, 750, 5, 1));
    assert.equal(scan.points.length, 81);
    const top = scan.points.reduce((b, p) => (p.a_species > b.a_species ? p : b));
    assert.ok(top.a_species > 0.05, `${id} absorbs: ${top.a_species}`);
    assert.ok(top.nm >= expectNm[0] && top.nm <= expectNm[1], `${id} peak at ${top.nm}`);
    assert.ok(scan.contributors.length > 0 && expectName.test(scan.contributors[0].species), JSON.stringify(scan.contributors.map((c) => c.species)));
    assert.ok(scan.contributors[0].tier && scan.contributors[0].source, 'data tier and source are reported');
    if (id === 'ot_nicl2') {
      const ft = J(eng.vessel_flame_test(h, 2000));
      assert.equal(ft.metal_share, 0, 'nickel has no flame-test emission data: the flame keeps its own colour');
    }
    eng.vessel_free(h);
  }
  const h = eng.vessel_new(JSON.stringify(cfg));
  eng.vessel_dose(h, JSON.stringify({ reagent_id: 'water', volume_ml: 20 }));
  eng.vessel_dose(h, JSON.stringify({ reagent_id: 'ot_srcl2', mass_g: 2 }));
  for (let i = 0; i < 20; i++) eng.vessel_step(h, 0.5);
  const ft = J(eng.vessel_flame_test(h, 2000));
  assert.ok(ft.metal_share > 0.3 && ft.emitters.some((e) => /Sr/.test(e)), JSON.stringify(ft));
  assert.ok(ft.emitter_rgb[0] > ft.emitter_rgb[1] * 3, 'strontium is red: ' + JSON.stringify(ft.emitter_rgb));
  const a = eng.colour_to_absorbance(0.8, 0.2, 0.1, 2);
  assert.equal(a.length, 41);
});

console.log(`${n} optics table checks passed`);
