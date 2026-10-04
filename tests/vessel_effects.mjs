// Headless check of the per-vessel reaction visuals fed with REAL engine snapshots: node tests/vessel_effects.mjs
// Bundles the glass profile + liquid body + VesselEffects with esbuild (stubbed canvas), loads the built WASM engine,
// and checks what the renderer builds for: a fizzing metal, boiling water, a frozen vessel, floating ice pieces, a mixed
// precipitate bed, the CO2 haze. No GL: it inspects the scene graph and instance buffers the effects own.
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
import { createGlassware } from '${web}/src/bench/glassware';
export { THREE, getProfile, LiquidBody, VesselEffects, createGlassware };
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const { THREE, getProfile, LiquidBody, VesselEffects, createGlassware } = mod;

const dir = path.join(web, 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15 };
const vessel = () => eng.vessel_new(JSON.stringify(cfg));
const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const ctl = (h, c) => eng.vessel_control(h, JSON.stringify(c));
const snap = (h) => J(eng.vessel_snapshot(h));
const run = (h, t, dt = 0.5) => {
  for (let i = 0; i < t / dt; i++) eng.step_all(JSON.stringify([h]), dt);
};

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};

/** A vessel's visuals driven with a snapshot for `seconds` of frames. */
function show(s, seconds = 2) {
  const p = getProfile('beaker-250');
  const liquid = new LiquidBody(p);
  const fx = new VesselEffects(p, liquid);
  liquid.setLayers(s.layers, s.total_liquid_ml, null);
  fx.applySnapshot(s);
  let t = 0;
  for (let i = 0; i < seconds * 60; i++, t += 1 / 60) {
    liquid.tick(1 / 60, t, new THREE.Matrix4());
    fx.tick(1 / 60, t);
  }
  assert.equal(fx.failed.size, 0, 'no effect failed: ' + [...fx.failed].join(','));
  return { fx, liquid, p };
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------- fizzing magnesium
{
  const h = vessel();
  dose(h, { reagent_id: 'hcl_1m', volume_ml: 50 });
  dose(h, { reagent_id: 'mg_ribbon', mass_g: 0.3 });
  run(h, 2);
  const s = snap(h);
  // the engine knows the form the metal was dosed in (catalog `solid_form`): pieces, not a particle bed
  const turb = Math.max(...s.layers[0].scatter_per_cm);
  const { fx } = show(s);
  ok('a metal added as a piece neither clouds the liquid nor counts as suspended', () => {
    assert.ok(turb < 0.05, 'the layer is not turbid: ' + turb);
    assert.ok(s.solids.every((x) => x.kind !== 'metal' || (x.morphology === 'pieces' && x.suspended_fraction === 0)));
  });
  ok('a fizzing metal ribbon is shown and bubbles come off', () => {
    const r = fx.pieces.ribbons[0];
    assert.ok(r.mesh.visible, 'ribbon visible');
    assert.ok(fx.bubbles.live > 20, 'bubbles ' + fx.bubbles.live);
    assert.ok(r.floating, 'fizzing metal floats');
  });
  ok('the metal is not also drawn as a bed or a cloud', () => {
    assert.equal(fx.bedTargetVol, 0);
    assert.equal(fx.suspendedTargetCount, 0);
  });
}

// ---------------------------------------------------------------- boiling water
{
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 100 });
  ctl(h, { heater_w: 600 });
  run(h, 130); // (the hot plate passes on what its surface temperature allows, `hot_plate_heat_w`: boiling takes about two minutes)
  const s = snap(h);
  assert.ok(s.boil_intensity > 0.3, 'boiling ' + s.boil_intensity);
  const { fx, p } = show(s, 1.5);
  ok('boiling: bubbles are born on the floor, none is drawn bigger than a few mm, vapour flux is not doubled', () => {
    assert.ok(fx.bubbles.live > 25, 'live ' + fx.bubbles.live);
    let maxR = 0;
    for (let i = 0; i < fx.bubbles.live; i++) maxR = Math.max(maxR, fx.bubbles.r[i]);
    assert.ok(maxR < 0.8, 'max bubble radius cm ' + maxR);
    let low = 0;
    for (let i = 0; i < fx.bubbles.live; i++) if (fx.bubbles.p[i * 3 + 1] < p.innerBottomY + 2) low++;
    assert.ok(low > fx.bubbles.live * 0.25, 'a good share of the bubbles is near the floor: ' + low + '/' + fx.bubbles.live);
  });
}

// ---------------------------------------------------------------- frozen vessel
{
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 50 });
  ctl(h, { bath_k: 255, bath_coupling_w_k: 25 }); // a thermostatted jacket: the default bath couples through the glass at ~1-2 W/K
  run(h, 90);
  const s = snap(h);
  assert.ok(s.solids.some((x) => x.species === 'H2O(s)' && x.floating), 'ice solid reported');
  const { fx } = show(s, 1);
  ok('a vessel frozen solid shows an ice block, not a powder bed', () => {
    assert.ok(fx.pieces.block && fx.pieces.block.visible, 'ice block visible');
    assert.equal(fx.pieces.floatMesh.visible, false);
    assert.equal(fx.bedTargetVol, 0);
  });
}

// ---------------------------------------------------------------- ice floating in water
{
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 100 });
  const s = clone(snap(h));
  s.solids.push({
    species: 'H2O(s)', name: 'ice', mass_g: 40, settled_volume_ml: (40 / 0.92) * 1.6, suspended_fraction: 0, particle_diameter_um: 5000,
    rgb: [0.88, 0.9, 0.93], kind: 'crystal', floating: true, remaining_fraction: 1, settling_velocity_mm_s: 0,
  });
  const { fx, liquid } = show(s, 1);
  ok('ice in water floats at the surface as separate pieces', () => {
    const m = fx.pieces.floatMesh;
    assert.ok(m.visible && m.count >= 4, 'pieces ' + m.count);
    const ys = [];
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, mat);
      pos.setFromMatrixPosition(mat);
      ys.push(pos.y);
    }
    for (const y of ys) assert.ok(Math.abs(y - liquid.fillY) < 1.2, `piece at ${y}, surface ${liquid.fillY}`);
    assert.equal(fx.bedTargetVol, 0, 'ice is not part of the bed');
    assert.equal(fx.suspendedTargetCount, 0, 'ice is not a cloud');
  });
}

// ---------------------------------------------------------------- mixed bed colours
{
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 60 });
  const s = clone(snap(h));
  const mk = (sp, rgb, vol) => ({
    species: sp, name: sp, mass_g: vol, settled_volume_ml: vol, suspended_fraction: 0, particle_diameter_um: 30,
    rgb, kind: 'powder', remaining_fraction: 1, settling_velocity_mm_s: 1,
  });
  s.solids.push(mk('A(s)', [0.95, 0.95, 0.95], 1.2), mk('B(s)', [0.02, 0.02, 0.025], 1.2));
  const { fx } = show(s, 3);
  ok('a white and a black solid make a mottled bed, not one grey', () => {
    const col = fx.bedTop.geometry.attributes.color;
    let lo = 1, hi = 0;
    for (let i = 0; i < col.count; i++) {
      const v = col.getX(i);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    assert.ok(hi > 0.8 && lo < 0.1, `vertex colours span ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  });
}

// ---------------------------------------------------------------- CO2 effervescence
{
  const h = vessel();
  dose(h, { reagent_id: 'ch3cooh_5pct', volume_ml: 50 });
  dose(h, { reagent_id: 'nahco3_s', mass_g: 3 });
  run(h, 1);
  const s = snap(h);
  const { fx, liquid } = show(s, 2);
  ok('vigorous gas release: many bubbles within the budget and a micro-bubble haze in the liquid', () => {
    assert.ok(fx.bubbles.live > 30 && fx.bubbles.live <= 700, 'bubbles ' + fx.bubbles.live);
    assert.ok(liquid.uniforms.uScat.value[0].w > 0.05, 'haze extinction ' + liquid.uniforms.uScat.value[0].w);
  });
}

// ---------------------------------------------------------------- metal granules, a second metal, floating powder
{
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 80 });
  const s = clone(snap(h));
  const solid = (sp, kind, vol, extra = {}) => ({
    species: sp, name: sp, mass_g: vol * 5, settled_volume_ml: vol * 1.6, suspended_fraction: 0, particle_diameter_um: kind === 'powder' ? 40 : 3000,
    rgb: [0.7, 0.7, 0.72], kind, remaining_fraction: 1, settling_velocity_mm_s: 0, morphology: kind === 'metal' ? 'pieces' : 'bed', ...extra,
  });
  s.solids.push(solid('Zn(s)', 'metal', 4), solid('Mg(s)', 'metal', 0.17), solid('S(s)', 'powder', 0.5, { floating: true, rgb: [0.9, 0.85, 0.2] }));
  const { fx, liquid } = show(s, 2);
  ok('a large metal amount is drawn as granules on the floor, a small one as a ribbon, both at once', () => {
    assert.ok(fx.pieces.metalMesh.visible && fx.pieces.metalMesh.count >= 8, 'granules ' + fx.pieces.metalMesh.count);
    assert.ok(fx.pieces.ribbons[0].mesh.visible, 'ribbon for the small piece');
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3();
    for (let i = 0; i < fx.pieces.metalMesh.count; i++) {
      fx.pieces.metalMesh.getMatrixAt(i, m);
      v.setFromMatrixPosition(m);
      assert.ok(v.y < liquid.fillY - 0.2 && Math.hypot(v.x, v.z) < 3.6, `granule ${i} at ${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)}`);
    }
  });
  ok('a floating fine powder forms a film on the surface', () => {
    assert.ok(fx.pieces.film.visible, 'film visible');
    assert.ok(Math.abs(fx.pieces.film.position.y - liquid.fillY) < 0.1, 'film at the surface');
  });
}

// ---------------------------------------------------------------- engine morphology, metal powders, dry solids, layers, glow
{
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 60 });
  const s0 = clone(snap(h));
  const solid = (sp, kind, vol, extra = {}) => ({
    species: sp, name: sp, mass_g: vol * 5, settled_volume_ml: vol * 1.6, volume_ml: vol, suspended_fraction: 0, particle_diameter_um: 30,
    rgb: [0.55, 0.2, 0.08], kind, remaining_fraction: 1, settling_velocity_mm_s: 0, morphology: 'bed', ...extra,
  });
  {
    const s = clone(s0);
    s.solids.push(solid('Cu(s)', 'metal', 0.4, { particle_diameter_um: 10 }));
    const { fx } = show(s, 2);
    ok('a cemented metal powder (morphology bed) is a bed with a metallic sheen, not a ribbon', () => {
      assert.ok(fx.bedTargetVol > 0.3, 'bed volume ' + fx.bedTargetVol);
      assert.ok(!fx.pieces.ribbons[0].mesh.visible && !fx.pieces.metalMesh.visible, 'no ribbon or granules');
      assert.ok(fx.bedMat.metalness > 0.3, 'metalness ' + fx.bedMat.metalness);
    });
  }
  {
    const s = clone(s0);
    s.solids.push(solid('Mg(s)', 'metal', 0.17, { particle_diameter_um: 30, morphology: 'pieces' }));
    const { fx } = show(s, 2);
    ok('a metal the engine reports as pieces stays a ribbon', () => {
      assert.ok(fx.pieces.ribbons[0].mesh.visible, 'ribbon');
      assert.equal(fx.bedTargetVol, 0);
    });
  }
  {
    // a dry powder cannot be suspended: the whole of it lies in the bed whatever the fraction says
    const dry = vessel();
    const s = clone(snap(dry));
    s.solids.push(solid('NaX(s)', 'powder', 1.0, { suspended_fraction: 0.2, rgb: [0.9, 0.9, 0.9] }));
    const { fx } = show(s, 1);
    ok('a dry powder is all bed (no suspended share without a liquid)', () => {
      assert.ok(Math.abs(fx.bedTargetVol - 1.6) < 1e-6, 'bed ' + fx.bedTargetVol);
      assert.equal(fx.suspendedTargetCount, 0);
    });
  }
  {
    // the size of the suspended particles follows the engine's mass-weighted diameter: coarse crystals glitter, fines haze
    const mk = (d) => {
      const s = clone(s0);
      s.solids.push(solid('P(s)', 'powder', 0.3, { suspended_fraction: 1, suspended_diameter_um: d, particle_diameter_um: d, rgb: [0.9, 0.9, 0.5] }));
      return show(s, 3).fx;
    };
    const fine = mk(2), coarse = mk(900);
    const mean = (fx) => {
      let a = 0;
      for (let i = 0; i < fx.precip.live; i++) a += fx.precip.size0[i];
      return a / Math.max(1, fx.precip.live);
    };
    ok('suspended sprites are larger for coarse crystals than for fines', () => {
      assert.ok(fine.precip.live > 20 && coarse.precip.live > 20, `live ${fine.precip.live}/${coarse.precip.live}`);
      assert.ok(mean(coarse) > mean(fine) * 2, `sizes ${mean(fine).toFixed(3)} vs ${mean(coarse).toFixed(3)}`);
    });
  }
  {
    // a frozen sheet in a liquid is one piece riding the surface; a floating solid sits on the layer the engine names
    const s = clone(s0);
    s.solids.push(solid('H2O(s)', 'crystal', 20, { floating: true, morphology: 'monolith', particle_diameter_um: 20000, rgb: [0.88, 0.9, 0.93] }));
    const { fx, liquid } = show(s, 1);
    ok('a floating monolith is a single piece at the surface', () => {
      assert.equal(fx.pieces.floatMesh.count, 1);
      assert.ok(fx.pieces.floatMesh.visible);
      const m = new THREE.Matrix4();
      const v = new THREE.Vector3();
      fx.pieces.floatMesh.getMatrixAt(0, m);
      v.setFromMatrixPosition(m);
      assert.ok(Math.abs(v.y - liquid.fillY) < 1.5, `at ${v.y} surface ${liquid.fillY}`);
    });
  }
  {
    const s = clone(s0);
    // two layers: 40 mL of aqueous below, 20 mL of organic on top; a wax disc rides the top of the lower layer
    s.layers = [clone(s0.layers[0]), clone(s0.layers[0])];
    s.layers[0].volume_ml = 40;
    s.layers[1].volume_ml = 20;
    s.layers[1].phase = 'organic';
    s.solids.push(solid('wax(s)', 'powder', 1.5, { floating: true, layer_index: 0, particle_diameter_um: 5000, rgb: [0.95, 0.93, 0.8] }));
    const { fx, liquid, p } = show(s, 1);
    ok('a floating solid rides the interface of the layer the engine names, not the free surface', () => {
      const tops = liquid.layerTopsY();
      assert.equal(tops.length, 2);
      assert.ok(tops[1] > tops[0] + 0.5);
      const m = new THREE.Matrix4();
      const v = new THREE.Vector3();
      fx.pieces.floatMesh.getMatrixAt(0, m);
      v.setFromMatrixPosition(m);
      assert.ok(Math.abs(v.y - tops[0]) < 1.0, `piece at ${v.y.toFixed(2)}, interface ${tops[0].toFixed(2)}, surface ${tops[1].toFixed(2)}`);
      void p;
    });
  }
  {
    const hot = clone(s0);
    hot.temperature_k = 1100;
    const cool = clone(s0);
    const a = show(hot, 4).fx, b = show(cool, 1).fx;
    ok('a vessel above ~780 K glows, one at room temperature does not', () => {
      assert.ok(a.glow.visible && a.glowMat.opacity > 0.05, 'glow ' + a.glowMat.opacity);
      assert.ok(a.glowMat.color.r > a.glowMat.color.b, 'red-orange glow');
      assert.ok(!b.glow.visible);
    });
  }
}

// ---------------------------------------------------------------- electrolysis
{
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 100 });
  dose(h, { reagent_id: 'hcl_1m', volume_ml: 10 });
  ctl(h, { electrolysis: { anode: { material: 'Pt', area_cm2: 5 }, cathode: { material: 'Pt', area_cm2: 5 }, mode: 'voltage', value: 3, spacing_cm: 2, on: true } });
  run(h, 2);
  const s = clone(snap(h));
  assert.ok(s.electrolysis && s.electrolysis.rows.length >= 2, 'electrolysis readout');
  // the real cell makes ~0.01 mL/s of H2: scale it up to a visible stream so the test sees bubbles within a second
  for (const g of s.gas_fluxes) g.rate_ml_s *= 400;
  const { fx } = show(s, 1);
  ok('electrolysis gas forms on the electrode rods (H2 at the cathode side)', () => {
    assert.ok(fx.bubbles.live > 3, 'bubbles ' + fx.bubbles.live);
    let near = 0;
    for (let i = 0; i < fx.bubbles.live; i++) {
      const x = fx.bubbles.p[i * 3];
      if (Math.abs(Math.abs(x) - 1.4) < 0.7) near++;
    }
    assert.ok(near >= fx.bubbles.live * 0.7, `bubbles near a rod: ${near}/${fx.bubbles.live}`);
  });
}

// ---------------------------------------------------------------- a whole vessel bundle, coloured liquid
{
  const h = vessel();
  dose(h, { reagent_id: 'cuso4_0_1m', volume_ml: 100 });
  const s = snap(h);
  const b = createGlassware({ id: 'v1', name: 'Beaker', type: 'beaker-250', capacityMl: 250, currentVolumeMl: 0, liquidColor: '#ffffff', liquidOpacity: 0.8, temperatureK: 295, isSealed: false, stirring: false, contents: [] });
  b.applyVisual(s, 0.05, null);
  for (let i = 0; i < 120; i++) b.tick(1 / 60, i / 60);
  ok('a blue copper solution casts a tinted caustic on the bench, a clear one does not', () => {
    const caustic = b.group.children.find((c) => c.material && c.material.blending === THREE.AdditiveBlending && c.material.map && c.material.opacity > 0);
    assert.ok(caustic && caustic.visible, 'caustic visible');
    const c = caustic.material.color;
    assert.ok(c.b > c.r, `tinted blue-ish: ${c.r.toFixed(2)} ${c.g.toFixed(2)} ${c.b.toFixed(2)}`);
    const h2 = vessel();
    dose(h2, { reagent_id: 'water', volume_ml: 100 });
    const b2 = createGlassware({ id: 'v2', name: 'Beaker', type: 'beaker-250', capacityMl: 250, currentVolumeMl: 0, liquidColor: '#ffffff', liquidOpacity: 0.8, temperatureK: 295, isSealed: false, stirring: false, contents: [] });
    b2.applyVisual(snap(h2), 0.05, null);
    for (let i = 0; i < 120; i++) b2.tick(1 / 60, i / 60);
    assert.ok(!b2.group.children.some((c2) => c2.material && c2.material.blending === THREE.AdditiveBlending && c2.material.map && c2.visible && c2.material.opacity > 0.02 && c2.scale.x > 1.1 && c2.material.opacity > 0.05), 'clear water: no caustic');
  });
}

// ---------------------------------------------------------------- thermal bath around a vessel
{
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 100 });
  ctl(h, { bath_k: 273.15 });
  run(h, 5);
  const s = snap(h);
  assert.equal(s.bath_k, 273.15, 'engine reports the bath');
  const mk = () => createGlassware({ id: 'v3', name: 'Beaker', type: 'beaker-250', capacityMl: 250, currentVolumeMl: 0, liquidColor: '#ffffff', liquidOpacity: 0.8, temperatureK: 295, isSealed: false, stirring: false, contents: [] });
  const b = mk();
  b.applyVisual(s, 0.05, null);
  for (let i = 0; i < 90; i++) b.tick(1 / 60, i / 60);
  const bathGroup = () => b.group.children.find((c) => c.children && c.children.some((k) => k.isInstancedMesh && k.material && k.material.flatShading));
  ok('an ice bath draws a basin of water with floating ice around the vessel', () => {
    const g = bathGroup();
    assert.ok(g && g.visible, 'bath visible');
    const ice = g.children.filter((k) => k.isInstancedMesh);
    const cubes = ice.reduce((a, k) => a + (k.visible ? k.count : 0), 0);
    assert.ok(cubes >= 6, 'ice cubes ' + cubes);
  });
  ok('the bath is only drawn while the vessel stands in it, and not at all without one', () => {
    b.group.position.y = 12; // lifted out
    for (let i = 0; i < 120; i++) b.tick(1 / 60, 2 + i / 60);
    assert.ok(!bathGroup().visible, 'basin stays behind when the vessel is lifted: hidden once the vessel is out');
    const none = mk();
    const s2 = JSON.parse(JSON.stringify(s));
    s2.bath_k = null;
    none.applyVisual(s2, 0.05, null);
    for (let i = 0; i < 60; i++) none.tick(1 / 60, i / 60);
    const g2 = none.group.children.find((c) => c.children && c.children.some((k) => k.isInstancedMesh && k.material && k.material.flatShading));
    assert.ok(g2 && !g2.visible, 'no bath');
  });
}

console.log(`vessel_effects: ${n} checks passed`);
