// Renderer fuzz: random reagent mixtures, heating and stirring in random glassware, REAL engine snapshots through the
// vessel visuals (liquid body + VesselEffects), headless: node tests/renderer_fuzz.mjs [seeds=60]
// Checks, for every state: no effect fails (`fx.failed`), the liquid passes its self check, every number the renderer
// owns (layer interfaces, bubble / particle / piece buffers, uniforms) is finite, layer interfaces rise monotonically,
// and the solids the engine reports are drawn somewhere (a bed, a cloud, pieces, a film or a block).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const { build } = await import(path.join(web, 'node_modules', 'esbuild', 'lib', 'main.js'));

const entry = `
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'getImageData' || k === 'createImageData' ? (_a, _b, w, h) => ({ data: new Uint8ClampedArray(4 * Math.max(1, (w || 1) * (h || 1))) }) : () => {}), set: () => true });
globalThis.document = { createElement: (tag) => tag === 'canvas' ? { width: 1, height: 1, getContext: () => ctx2d, style: {} } : { style: {}, addEventListener() {}, appendChild() {} } };
Object.assign(globalThis, { window: globalThis, addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 });
import * as THREE from 'three';
import { getProfile } from '${web}/src/render/glass_profiles';
import { LiquidBody } from '${web}/src/render/liquid_material';
import { VesselEffects } from '${web}/src/render/effects';
import { glasswareSpec } from '${web}/src/app/glassware_catalog';
export { THREE, getProfile, LiquidBody, VesselEffects, glasswareSpec };
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const { THREE, getProfile, LiquidBody, VesselEffects, glasswareSpec } = mod;

const dir = path.join(web, 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const catalog = (() => {
  const c = J(eng.reagent_catalog_json());
  return c.reagents ?? c;
})();

// small deterministic PRNG so a failing seed can be replayed
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const TYPES = ['beaker-250', 'beaker-50', 'erlenmeyer-125', 'test-tube', 'cylinder-100', 'round-bottom-250', 'evaporating-dish-100', 'gas-jar-250', 'burette-50', 'volumetric-100', 'buchner-flask-250'];
const finite = (a, n, what) => {
  for (let i = 0; i < n; i++) if (!Number.isFinite(a[i])) throw new Error(`${what}[${i}] = ${a[i]}`);
};

const seeds = Number(process.argv[2] || 60);
let checked = 0;
const seen = { liquid: 0, solids: 0, gas: 0, layers2: 0, boil: 0, fumes: 0, hot: 0 };
for (let seed = 1; seed <= seeds; seed++) {
  const R = rng(seed * 7919);
  const type = TYPES[Math.floor(R() * TYPES.length)];
  const spec = glasswareSpec(type);
  const cfg = { type, capacity_ml: spec.capacityMl, glass_mass_g: spec.glassMassG, inner_radius_cm: spec.innerRadiusCm, temperature_k: 295.15, room_k: 295.15 };
  const h = eng.vessel_new(JSON.stringify(cfg));
  const log = [`seed ${seed} ${type}`];
  const nDose = 1 + Math.floor(R() * 3);
  for (let i = 0; i < nDose; i++) {
    const r = catalog[Math.floor(R() * catalog.length)];
    const d = { reagent_id: r.id };
    if (r.form === 'solid' || r.by_mass) d.mass_g = +(0.05 + R() * 3).toFixed(2);
    else if (r.dropper) d.drops = 1 + Math.floor(R() * 6);
    else d.volume_ml = +(1 + R() * Math.min(60, spec.capacityMl * 0.4)).toFixed(1);
    log.push(JSON.stringify(d));
    try {
      eng.vessel_dose(h, JSON.stringify(d));
    } catch (e) {
      log.push('dose refused: ' + e);
    }
  }
  const ctl = {};
  if (R() < 0.4) ctl.heater_w = Math.floor(R() * 10) * 100;
  if (R() < 0.4) {
    ctl.stirring = true;
    ctl.stir_rpm = 300 + Math.floor(R() * 700);
  }
  if (R() < 0.15) ctl.bath_k = 255 + R() * 20;
  if (Object.keys(ctl).length) {
    log.push(JSON.stringify(ctl));
    eng.vessel_control(h, JSON.stringify(ctl));
  }
  const total = 2 + R() * 90;
  for (let t = 0; t < total; t += 0.5) eng.step_all(JSON.stringify([h]), 0.5);
  const s = J(eng.vessel_snapshot(h));
  // the engine rarely fumes / burns / foams in a random mixture: add those fields by hand to a share of the states so
  // every effect runs in every kind of glassware
  if (R() < 0.35) {
    s.fumes = [
      { species: 'Cl2(g)', intensity: R(), rgb: [0.7, 0.8, 0.3], opacity: 0.5, denser_than_air: true, density_ratio: 2.4, kind: 'gas' },
      { species: 'NH4Cl(s)', intensity: R(), rgb: [0.95, 0.95, 0.95], opacity: 0.8, denser_than_air: false, kind: 'aerosol' },
    ];
    s.foam = R();
    s.condensation = R();
    s.vapour_visibility = R();
    if (R() < 0.5) s.flame = { fuel: 'C2H5OH', power_w: 20 + R() * 800, luminosity: R(), flame_temp_k: 1200 + R() * 800, emitter_rgb: [0.9, 0.6, 0.2], metal_share: R() * 0.8, emitters: ['Na atom 589 nm'] };
    log.push('synthetic extras');
  }

  try {
    const p = getProfile(type);
    const liquid = new LiquidBody(p);
    const fx = new VesselEffects(p, liquid);
    liquid.setLayers(s.layers, s.total_liquid_ml, null);
    fx.setStirring(ctl.stir_rpm || 0);
    liquid.setStirring(ctl.stir_rpm || 0);
    fx.applySnapshot(s);
    let t = 0;
    for (let i = 0; i < 150; i++, t += 1 / 60) {
      liquid.tick(1 / 60, t, new THREE.Matrix4());
      fx.tick(1 / 60, t);
    }
    assert.equal(fx.failed.size, 0, 'effects failed: ' + [...fx.failed].join(','));
    assert.equal(liquid.diagnose(), null, 'liquid self check');
    const tops = liquid.layerTopsY();
    finite(tops, tops.length, 'layerTops');
    for (let i = 1; i < tops.length; i++) assert.ok(tops[i] >= tops[i - 1] - 1e-6, 'layer interfaces rise: ' + tops.join(','));
    finite(fx.bubbles.p, fx.bubbles.live * 3, 'bubble position');
    finite(fx.bubbles.r, fx.bubbles.live, 'bubble radius');
    finite(fx.precip.pos, fx.precip.live * 3, 'precipitate position');
    finite(fx.smoke.pos, fx.smoke.live * 3, 'smoke position');
    for (const k of Object.keys(liquid.uniforms)) {
      const v = liquid.uniforms[k].value;
      if (typeof v === 'number') assert.ok(Number.isFinite(v), `uniform ${k} = ${v}`);
    }
    // solids the engine reports (more than a speck) must be drawn somewhere
    const massive = s.solids.filter((x) => x.mass_g > 1e-3);
    if (massive.length && !s.burst) {
      const drawn =
        fx.bedTargetVol > 0 ||
        fx.suspendedTargetCount > 0 ||
        fx.lumpCount > 0 ||
        fx.pieces.floatMesh.visible ||
        (fx.pieces.block && fx.pieces.block.visible) ||
        fx.pieces.film.visible ||
        fx.pieces.metalMesh.visible ||
        fx.pieces.ribbons.some((r) => r.mesh.visible) ||
        s.total_liquid_ml <= 0.05;
      assert.ok(drawn, 'solids reported but nothing drawn: ' + massive.map((x) => `${x.species} ${x.mass_g.toFixed(3)} g ${x.kind}/${x.morphology} floating=${x.floating}`).join('; '));
    }
    checked++;
    if (s.total_liquid_ml > 0.05) seen.liquid++;
    if (s.solids.some((x) => x.mass_g > 1e-3)) seen.solids++;
    if (s.gas_fluxes.some((g) => g.rate_ml_s > 1e-3)) seen.gas++;
    if (s.layers.length > 1) seen.layers2++;
    if (s.boil_intensity > 0.02) seen.boil++;
    if (s.fumes.length) seen.fumes++;
    if (s.flame) seen.flame = (seen.flame || 0) + 1;
    if (s.temperature_k > 780) seen.hot++;
  } catch (e) {
    console.error(log.join('\n'));
    console.error('snapshot solids:', JSON.stringify(s.solids.map((x) => [x.species, x.mass_g, x.kind, x.morphology, x.floating, x.suspended_fraction])));
    throw e;
  }
}
console.log(`renderer_fuzz: ${checked} random states rendered without a failure`, JSON.stringify(seen));
