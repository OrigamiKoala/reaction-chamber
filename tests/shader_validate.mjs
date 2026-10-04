// Validates the liquid / condensation GLSL with glslangValidator (three.js-style prefix added by hand): node tests/shader_validate.mjs
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const { build } = await import(path.join(web, 'node_modules', 'esbuild', 'lib', 'main.js'));
const entry = `
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'getImageData' || k === 'createImageData' ? (_a, _b, w, h) => ({ data: new Uint8ClampedArray(4 * Math.max(1, (w || 1) * (h || 1))) }) : () => {}), set: () => true });
globalThis.document = { createElement: (tag) => tag === 'canvas' ? { width: 1, height: 1, getContext: () => ctx2d, style: {} } : { style: {}, addEventListener() {}, appendChild() {} } };
Object.assign(globalThis, { window: globalThis, addEventListener() {}, removeEventListener() {}, devicePixelRatio: 1 });
import { getProfile } from '${web}/src/render/glass_profiles';
import { LiquidBody } from '${web}/src/render/liquid_material';
import { VesselEffects } from '${web}/src/render/effects';
import { makeBubbleMaterial } from '${web}/src/render/particles';
import { makeFlameMaterial } from '${web}/src/render/flame';
export { getProfile, LiquidBody, VesselEffects, makeBubbleMaterial, makeFlameMaterial };
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const p = mod.getProfile('beaker-250');
const liquid = new mod.LiquidBody(p);
const fx = new mod.VesselEffects(p, liquid);

const VS = `#version 300 es
precision highp float; precision highp int;
uniform mat4 modelMatrix; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform mat3 normalMatrix; uniform vec3 cameraPosition;
#define attribute in
#define varying out
#define texture2D texture
in vec3 position; in vec3 normal; in vec2 uv;
`;
const FS = `#version 300 es
precision highp float; precision highp int;
uniform mat4 viewMatrix; uniform vec3 cameraPosition;
#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
`;
const strip = (s) => s.replace(/#include <[a-z_]+>/g, '');
const dir = mkdtempSync(path.join(tmpdir(), 'glsl-'));
const check = (name, vs, fs) => {
  const v = path.join(dir, name + '.vert');
  const f = path.join(dir, name + '.frag');
  writeFileSync(v, VS + strip(vs));
  writeFileSync(f, FS + strip(fs));
  for (const file of [v, f]) {
    try {
      execFileSync('glslangValidator', [file], { stdio: 'pipe' });
    } catch (e) {
      assert.fail(`${name}: ${path.basename(file)}\n${e.stdout?.toString() ?? e}`);
    }
  }
  console.log('  ok', name);
};
const abs = liquid.absorbMat;
check('liquid-absorb', abs.vertexShader, abs.fragmentShader);
check('condensation', fx.condMat.vertexShader, fx.condMat.fragmentShader);
const flame = mod.makeFlameMaterial(0);
check('flame', flame.vertexShader, flame.fragmentShader);
console.log('shader_validate: passed');
