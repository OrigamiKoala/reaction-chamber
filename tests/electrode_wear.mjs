// Electrode wear maths (what a deposit / loss of metal does to the look of a rod): node tests/electrode_wear.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const { build } = await import(path.join(web, 'node_modules', 'esbuild', 'lib', 'main.js'));
const out = await build({ entryPoints: [path.join(web, 'src/equipment/electrode_wear.ts')], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const m = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const dep = (mass, rho = 8.96) => ({ species: 'Cu(s)', name: 'copper', mass_g: mass, density_g_ml: rho, rgb: [0.7, 0.25, 0.1] });
let n = 0;
const ok = (name, fn) => (fn(), n++, console.log('  ok', name));

ok('nothing deposited, nothing drawn', () => {
  assert.equal(m.cathodeLook(undefined).coverage, 0);
  assert.equal(m.cathodeLook({ material: 'Pt', mass_change_g: 0 }).coverage, 0);
  assert.equal(m.anodeLook({ material: 'Pt', mass_change_g: 0 }).coverage, 0);
});
ok('five milligrams of copper make an opaque film about a micrometre thick, in the deposit colour', () => {
  const c = m.cathodeLook({ material: 'Pt', mass_change_g: 0.005, deposit: dep(0.005) });
  const expectUm = (0.005 / (8.96 * m.WETTED_ROD_AREA_CM2)) * 1e4;
  assert.ok(Math.abs(c.thicknessUm - expectUm) < 1e-9);
  assert.ok(c.thicknessUm > 0.2 && c.thicknessUm < 5, 'um ' + c.thicknessUm);
  assert.ok(c.coverage > 0.8, 'coverage ' + c.coverage);
  assert.deepEqual(c.rgb, [0.7, 0.25, 0.1]);
});
ok('a tenth of a milligram only tints the rod', () => {
  const c = m.cathodeLook({ material: 'Pt', mass_change_g: 1e-4, deposit: dep(1e-4) });
  assert.ok(c.coverage > 0.01 && c.coverage < 0.25, 'coverage ' + c.coverage);
});
ok('plating of the electrode metal itself (no deposit record) still shows, with no colour of its own', () => {
  const c = m.cathodeLook({ material: 'Cu', mass_change_g: 0.005 });
  assert.ok(c.coverage > 0.9 && c.rgb === null);
});
ok('a dissolving anode tarnishes and thins, true to scale', () => {
  const a = m.anodeLook({ material: 'Cu', mass_change_g: -0.2 });
  assert.ok(a.coverage > 0.5 && a.coverage <= 0.7);
  const expectCm = (0.2 / (8 * m.WETTED_ROD_AREA_CM2)) * 1e4 * 1e-4;
  assert.ok(Math.abs(a.shrinkCm - Math.min(0.1, expectCm)) < 1e-9, `shrink ${a.shrinkCm} vs ${expectCm}`);
  assert.equal(m.anodeLook({ material: 'Cu', mass_change_g: +0.2 }).coverage, 0, 'gaining mass is not wear');
});
console.log(`electrode_wear: ${n} checks passed`);
