// Wet-bench layout: node tests/bench_layout.mjs
// Poses the real instrument models like the scene does and checks that none overlaps another or the titration station,
// that all stand square to the table edge, and that they fit on the worktop.
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
import { HotPlate } from '${web}/src/equipment/hotplate';
import { Burner } from '${web}/src/equipment/burner';
import { ElectrochemStation } from '${web}/src/equipment/electrochem';
import { Balance } from '${web}/src/equipment/balance';
import { PHMeter } from '${web}/src/equipment/ph_meter';
import * as L from '${web}/src/bench/layout';
import { STATION_FOOTPRINT } from '${web}/src/bench/titration';
export { THREE, HotPlate, Burner, ElectrochemStation, Balance, PHMeter, L, STATION_FOOTPRINT };
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const { THREE, HotPlate, Burner, ElectrochemStation, Balance, PHMeter, L, STATION_FOOTPRINT } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

const items = {
  burner: [new Burner(), L.BURNER_POS],
  hotplate: [new HotPlate(), L.HOTPLATE_POS],
  potentiostat: [new ElectrochemStation(), L.ELECTROCHEM_POS],
  phmeter: [new PHMeter(), L.PH_METER_POS],
  balance: [new Balance(), L.BALANCE_POS],
};
const boxes = {};
for (const [name, [inst, pos]] of Object.entries(items)) {
  inst.group.position.copy(pos);
  assert.equal(inst.group.rotation.y, 0, `${name} stands square to the table edge`);
  inst.group.updateMatrixWorld(true);
  // the body only: hoses, cables, probes and electrodes leave the instrument on purpose
  const b = new THREE.Box3();
  for (const c of inst.group.children) {
    if (c.geometry?.type === 'TubeGeometry' || c === inst.probe || c === inst.electrodesGroup || c === inst.saltBridgeGroup) continue;
    if (c.isMesh && c.material?.visible === false) continue;
    b.expandByObject(c);
  }
  boxes[name] = b;
  console.log(name.padEnd(13), `x ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)}  z ${b.min.z.toFixed(1)}..${b.max.z.toFixed(1)}`);
}
const f = STATION_FOOTPRINT;
boxes.titration = new THREE.Box3(new THREE.Vector3(f.x0, 0, f.z0), new THREE.Vector3(f.x1, 10, f.z1));
const names = Object.keys(boxes);
for (let i = 0; i < names.length; i++) {
  for (let j = i + 1; j < names.length; j++) {
    const a = boxes[names[i]];
    const b = boxes[names[j]];
    const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
    const oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
    assert.ok(!(ox > -2 && oz > -2), `${names[i]} overlaps or touches ${names[j]} (x ${ox.toFixed(1)}, z ${oz.toFixed(1)})`);
  }
}
for (const [n, b] of Object.entries(boxes)) assert.ok(b.min.x >= -118 && b.max.x <= 118 && b.min.z >= -44 && b.max.z <= 30, `${n} on the worktop`);
console.log('bench layout OK (' + names.length + ' items)');
