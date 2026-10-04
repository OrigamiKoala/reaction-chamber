// Headless check of the titration station (bench/titration.ts) with REAL glassware bundles: node tests/titration_rig.mjs
// The 3D code is bundled with esbuild (from web/node_modules) and run in node with a stubbed canvas / DOM, a fake camera
// ray and a fake flow sink. Covers: auto-mount, flask seating + clamp height, stopcock lever drag / tap / wheel, drip
// and stream delivery, empty / spill / full handling, separatory funnel stand, tall-target pouring into the burette.
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
import { createGlassware } from '${web}/src/bench/glassware';
import { TitrationRig, STATION_X, STATION_Z, STATION_TILE_Y } from '${web}/src/bench/titration';
import { HandlingController } from '${web}/src/bench/handling';
import { Animator } from '${web}/src/bench/animations';
export { THREE, createGlassware, TitrationRig, STATION_X, STATION_Z, STATION_TILE_Y, HandlingController, Animator };
`;
const out = await build({
  stdin: { contents: entry, resolveDir: web, loader: 'ts' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'error',
  alias: { three: path.join(web, 'node_modules', 'three', 'build', 'three.module.js') },
});
const code = out.outputFiles[0].text;
const M = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const { THREE, createGlassware, TitrationRig, STATION_X, STATION_Z, STATION_TILE_Y, HandlingController, Animator } = M;

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);

// ------------------------------------------------------------------ world
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 1.6, 4, 900);
const vessels = new Map();
const volumes = new Map();
const log = [];
let held = null;
const sinks = [];
class FakeSink {
  constructor(src, tgt, bottom) { this.src = src; this.tgt = tgt; this.bottom = bottom; this.total = 0; this.unit = 'ml'; this.r = null; this.ended = false; }
  push(a) {
    const have = volumes.get(this.src) ?? 0;
    const free = this.tgt ? 250 - (volumes.get(this.tgt) ?? 0) : Infinity;
    const got = Math.max(0, Math.min(a, have, free));
    volumes.set(this.src, have - got);
    if (this.tgt) volumes.set(this.tgt, (volumes.get(this.tgt) ?? 0) + got);
    this.total += got;
    this.r = got < a - 1e-9 ? (have <= free ? 'empty' : 'full') : null;
    return got;
  }
  limit() { return this.r; }
  end() { this.ended = true; }
}
const dom = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }), parentElement: { addEventListener() {}, removeEventListener() {} }, style: {} };
const rig = new TitrationRig({
  scene, camera: cam, dom, controls: { enabled: true }, vessels: () => vessels, heldVesselId: () => held, isHolding: () => held !== null,
  openDrain: (s, t, b) => { const k = new FakeSink(s, t, b); sinks.push(k); return k; },
  volumeMl: (id) => volumes.get(id) ?? 0, notify: (m) => log.push(m), setHint: (t) => log.push('hint:' + t), markDirty() {},
  setStirring: (id, on) => { vessels.get(id).setStirring(on ? 400 : 0); vessels.get(id).vesselState.stirring = on; log.push('stir ' + on); },
  stirrerVacated: (id) => log.push('vacated ' + id),
});
const mk = (id, type, vol = 0) => {
  const st = { id, name: id, type, capacityMl: 250, currentVolumeMl: vol, liquidColor: '#e8f4fa', liquidOpacity: 0.6, temperatureK: 298, isSealed: false, stirring: false, contents: [] };
  const b = createGlassware(st);
  vessels.set(id, b);
  scene.add(b.group);
  return b;
};
let t = 0;
const run = (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) { t += 1 / 60; rig.update(1 / 60, t); } };
const disp = (id) => rig.dispensers.get(id);

// ------------------------------------------------------------------ station
const bur = mk('bur', 'burette-50');
const flask = mk('flask', 'erlenmeyer-250');
ok('a burette auto-mounts at the clamp; a flask seats on the tile and the tip drops inside its neck', () => {
  const pos = rig.onVesselAdded(bur);
  assert.ok(pos, 'burette mount position');
  near(pos.x, STATION_X, 1e-9); near(pos.z, STATION_Z, 1e-9);
  bur.group.position.copy(pos);
  assert.equal(rig.mountedBuretteId(), 'bur');
  assert.equal(rig.onVesselAdded(flask), null);
  const spot = rig.flaskSpot('flask');
  assert.ok(spot && spot.tag === 'flask');
  near(spot.pos.y, STATION_TILE_Y, 1e-9);
  flask.group.position.copy(spot.pos);
  rig.onCommit('flask', spot);
  run(3);
  const tipY = bur.group.position.y + bur.tipLocal().y;
  const rim = STATION_TILE_Y + flask.profile.rimY + flask.profile.baseOffsetY;
  assert.ok(tipY < rim && tipY > rim - 3.2, `tip ${tipY} inside the neck below the rim ${rim}`);
  assert.equal(rig.stirrerVesselId(), 'flask');
  // only the glass of a stand-mounted burette is clickable (the air under it must not hide the flask)
  assert.ok(bur.pickProxy.scale.y < 0.9 && bur.pickProxy.position.y > 10);
});

ok('dropping a burette near the clamp re-seats it; far away it stands on its own stand', () => {
  rig.onLift('bur');
  assert.equal(rig.mountedBuretteId(), null);
  const far = rig.resolveDrop('bur', 20, 15, bur);
  assert.equal(far, null);
  const near1 = rig.resolveDrop('bur', STATION_X + 8, STATION_Z + 5, bur);
  assert.ok(near1 && near1.tag === 'burette');
  rig.onCommit('bur', near1);
  assert.equal(rig.mountedBuretteId(), 'bur');
});

ok('flask dropped near the tile snaps onto it; clamp rises while a vessel is carried over', () => {
  rig.onLift('flask');
  assert.equal(rig.stirrerVesselId(), null);
  assert.ok(log.includes('vacated flask'));
  const tall = mk('cyl', 'cylinder-100');
  held = 'cyl';
  tall.group.position.set(STATION_X + 8, 4, STATION_Z);
  run(2);
  const raised = bur.group.position.y;
  assert.ok(raised > 8, `burette raised out of the way: ${raised}`);
  held = null;
  const spot = rig.resolveDrop('flask', STATION_X + 3, STATION_Z - 2, flask);
  assert.equal(spot.tag, 'flask');
  flask.group.position.copy(spot.pos);
  rig.onCommit('flask', spot);
  run(3);
  assert.ok(bur.group.position.y < 3, 'burette settled back over the flask');
  vessels.delete('cyl');
});

// ------------------------------------------------------------------ stopcock delivery
const d = disp('bur');
ok('lever at 0.3: single drops, ~0.1 mL/s, into the flask; burette level falls', () => {
  volumes.set('bur', 50);
  volumes.set('flask', 0);
  d.open = 0.3;
  run(20);
  const got = volumes.get('flask');
  near(got, 20 * 0.1075, 0.08, 'delivered');
  assert.equal(sinks[sinks.length - 1].tgt, 'flask');
  // always whole drops
  near(Math.round(got / 0.05) * 0.05, got, 1e-6);
});

ok('wide open: a continuous stream of ~1.8 mL/s', () => {
  const before = volumes.get('flask');
  d.open = 1;
  run(10);
  near(volumes.get('flask') - before, 18, 0.3);
});

ok('closed lever + tap = exactly one drop; click on an open lever closes it', () => {
  d.open = 0;
  run(1);
  const before = volumes.get('flask');
  rig.tap(d);
  run(1);
  near(volumes.get('flask') - before, 0.05, 1e-6);
  d.open = 0.5;
  rig.tap(d);
  assert.equal(d.open, 0);
});

ok('lever drag / wheel / Esc: up opens, shift is fine, Esc closes, flow stops', () => {
  cam.position.set(STATION_X + 6, 45, 62);
  cam.lookAt(STATION_X, 24, -3);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  d.pick.updateWorldMatrix(true, false);
  const w = new THREE.Vector3();
  d.pick.getWorldPosition(w);
  const ndc = w.clone().project(cam);
  const px = (ndc.x * 0.5 + 0.5) * 800, py = (-ndc.y * 0.5 + 0.5) * 500;
  assert.equal(rig.pointerDown({ button: 0, clientX: px, clientY: py }), true, 'press on the lever');
  rig.onMove({ clientY: py - 85, shiftKey: false });
  near(d.open, 0.5, 1e-9);
  rig.onMove({ clientY: py - 85, shiftKey: true });
  near(d.open, 0.5 * 0 + (85 / 170) * 0.25, 1e-9);
  rig.onMove({ clientY: py - 1000 });
  assert.equal(d.open, 1);
  rig.onUp({ button: 0, clientX: px, clientY: py });
  assert.equal(d.open, 1, 'the lever stays where it was left (no auto close on release)');
  rig.hover({ type: 'stopcock', id: 'bur' });
  rig.onWheel({ deltaY: 100, shiftKey: false, preventDefault() {}, stopImmediatePropagation() {} });
  near(d.open, 0.97, 1e-9);
  assert.equal(rig.closeAll(), true);
  assert.equal(d.open, 0);
  assert.equal(rig.closeAll(), false);
  rig.hover(null);
  // the stirrer knob toggles stirring of the flask on the tile
  const kn = new THREE.Vector3();
  rig.stirrer.knobPick.updateWorldMatrix(true, false);
  rig.stirrer.knobPick.getWorldPosition(kn);
  const n2 = kn.clone().project(cam);
  const kx = (n2.x * 0.5 + 0.5) * 800, ky = (-n2.y * 0.5 + 0.5) * 500;
  assert.equal(rig.pointerDown({ button: 0, clientX: kx, clientY: ky }), true);
  rig.onUp({ button: 0, clientX: kx, clientY: ky });
  assert.ok(log.includes('stir true'));
  run(1);
  assert.equal(rig.stirrer.isOn, true);
});

ok('empty burette: flow stops and the stopcock closes by itself', () => {
  volumes.set('bur', 0.2);
  d.open = 1;
  run(2);
  assert.equal(d.open, 0);
  assert.ok(log.some((m) => /empty/.test(m)));
  near(volumes.get('bur'), 0, 1e-6);
});

ok('no vessel under the tip: the liquid goes onto the bench (once-only warning)', () => {
  flask.group.position.set(30, 0, 0);
  rig.vesselMoved('flask');
  volumes.set('bur', 5);
  log.length = 0;
  d.open = 0.8;
  run(2);
  assert.equal(sinks[sinks.length - 1].tgt, null);
  assert.equal(log.filter((m) => /bench/.test(m)).length, 1);
  d.open = 0;
  run(1);
});

ok('full target: stopcock closes with a message', () => {
  flask.group.position.set(STATION_X, STATION_TILE_Y, STATION_Z);
  rig.onCommit('flask', { place: 'bench', pos: flask.group.position.clone(), tag: 'flask' });
  run(1);
  volumes.set('flask', 249.9);
  volumes.set('bur', 20);
  log.length = 0;
  d.open = 1;
  run(2);
  assert.equal(d.open, 0);
  assert.ok(log.some((m) => /full/.test(m)));
});

// ------------------------------------------------------------------ separatory funnel
ok('separatory funnel: beaker snaps under the tip, stopcock drains bottom-first, closes at the interface', () => {
  const fun = mk('fun', 'separatory-funnel-250');
  rig.onVesselAdded(fun);
  fun.group.position.set(10, 0, 0);
  const cup = mk('cup', 'beaker-250');
  rig.onVesselAdded(cup);
  const spot = rig.funnelFlaskSpot('cup', 'fun');
  near(spot.pos.x, 10, 1e-9);
  cup.group.position.copy(spot.pos);
  assert.equal(rig.resolveDrop('cup', 11.5, 1, cup)?.tag, 'funnel-flask');
  near(rig.groundAt(10, 0), 1.2, 1e-9);
  const fd = disp('fun');
  assert.equal(fd.kind, 'funnel');
  volumes.set('fun', 60);
  volumes.set('cup', 0);
  // a snapshot with two layers: aqueous drains first, interface -> auto close
  fun.lastSnapshot = { layers: [{ phase: 'aqueous', volume_ml: 40 }, { phase: 'organic', volume_ml: 20 }] };
  fd.open = 1;
  run(1);
  assert.equal(sinks[sinks.length - 1].bottom, true, 'funnel drains the bottom layer first');
  assert.ok(volumes.get('cup') > 5, 'about 10 mL/s through a wide open funnel');
  fun.lastSnapshot = { layers: [{ phase: 'aqueous', volume_ml: 0.0 }, { phase: 'organic', volume_ml: 20 }] };
  run(0.2);
  assert.equal(fd.open, 0, 'closed at the interface');
  assert.ok(log.some((m) => /interface/.test(m)));
  // opening it again runs the upper layer out (no second auto close)
  fd.open = 1;
  run(0.5);
  assert.ok(fd.open > 0);
});

// ------------------------------------------------------------------ pouring into the burette from the top
ok('tall target: a carried beaker locks onto the burette opening by screen position and pours into it', () => {
  const scene2 = new THREE.Scene();
  const cam2 = new THREE.PerspectiveCamera(40, 1.6, 4, 900);
  cam2.position.set(0, 55, 170);
  cam2.lookAt(0, 48, 0);
  cam2.updateMatrixWorld();
  cam2.updateProjectionMatrix();
  const vs = new Map();
  const mk2 = (id, type, vol = 0) => {
    const st = { id, name: id, type, capacityMl: 250, currentVolumeMl: vol, liquidColor: '#e8f4fa', liquidOpacity: 0.6, temperatureK: 298, isSealed: false, stirring: false, contents: [] };
    const b = createGlassware(st);
    vs.set(id, b);
    scene2.add(b.group);
    return b;
  };
  const b2 = mk2('bur2', 'burette-50');
  const src = mk2('src', 'beaker-100', 60);
  src.group.position.set(30, 0, 10);
  let pushed = 0;
  const host = {
    scene: scene2, camera: cam2, dom: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }), style: {} }, controls: { enabled: true },
    animator: new Animator(), shelf: { get: () => undefined, setBusy() {}, touch() {}, getMeta() { return null; } },
    vessels: () => vs, pickables: () => [...vs.values()].map((b) => b.pickProxy), groundAt: () => 0, bounds: () => ({ x0: -108, x1: 108, z0: -27, z1: 27 }),
    liftVessel: (id) => ({ place: 'bench', pos: vs.get(id).group.position.clone() }), resolveDrop: (_i, x, z) => ({ place: 'bench', pos: new THREE.Vector3(x, 0, z) }), commitDrop() {},
    openFlow: () => ({ unit: 'ml', total: 0, push(a) { pushed += a; return a; }, limit() { return null; }, end() {} }),
    markDirty() {}, onSelectVessel() {}, notify() {}, setHint() {}, setPourState() {},
  };
  const hc = new HandlingController(host);
  const proj = (v) => { const p = v.clone().project(cam2); return { x: (p.x * 0.5 + 0.5) * 800, y: (-p.y * 0.5 + 0.5) * 500 }; };
  const sp = proj(new THREE.Vector3(30, 4, 10));
  assert.equal(hc.pointerDown({ button: 0, clientX: sp.x, clientY: sp.y }), true);
  hc.onMove({ clientX: sp.x + 20, clientY: sp.y - 10 });
  assert.equal(hc.heldVesselId(), 'src');
  let tt = 0;
  const step = (k) => { for (let i = 0; i < k; i++) { tt += 1 / 60; hc.update(1 / 60, tt); } };
  step(20);
  const rs = proj(new THREE.Vector3(0, b2.profile.rimY + b2.profile.baseOffsetY, 0));
  hc.onMove({ clientX: rs.x + 30, clientY: rs.y + 20 });
  step(60);
  assert.ok(hc.held?.lock?.tall, 'locked on the tall opening');
  assert.ok(hc.held.pos.y > 70, `beaker lifted to the burette top: ${hc.held.pos.y}`);
  for (let k = 0; k < 8; k++) { hc.onMove({ clientX: rs.x + 30, clientY: rs.y + 20 - k * 25 }); step(20); }
  assert.ok(pushed > 5, `poured into the burette: ${pushed}`);
  hc.onMove({ clientX: rs.x + 400, clientY: rs.y - 100 });
  step(10);
  assert.ok(!hc.held.lock, 'sideways travel releases the lock');
  hc.onUp({ button: 0 });
});

ok('tall target: carrying a beaker over the base of the burette does not fill it; the camera has to be raised to the opening', () => {
  const scene3 = new THREE.Scene();
  const cam3 = new THREE.PerspectiveCamera(40, 1.6, 4, 900);
  cam3.position.set(0, 40, 110);
  cam3.lookAt(0, 8, 0);
  cam3.updateMatrixWorld();
  cam3.updateProjectionMatrix();
  const vs = new Map();
  const mk3 = (id, type, vol = 0) => {
    const st = { id, name: id, type, capacityMl: 250, currentVolumeMl: vol, liquidColor: '#e8f4fa', liquidOpacity: 0.6, temperatureK: 298, isSealed: false, stirring: false, contents: [] };
    const b = createGlassware(st);
    vs.set(id, b);
    scene3.add(b.group);
    return b;
  };
  const bur = mk3('bur3', 'burette-50');
  const src = mk3('src3', 'beaker-100', 60);
  src.group.position.set(30, 0, 10);
  const rimY = bur.profile.rimY + bur.profile.baseOffsetY;
  assert.ok(new THREE.Vector3(0, rimY, 0).project(cam3).y > 1, 'the opening is above the low camera view');
  let pushed = 0;
  const host = {
    scene: scene3, camera: cam3, dom: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 500 }), style: {} }, controls: { enabled: true },
    animator: new Animator(), shelf: { get: () => undefined, setBusy() {}, touch() {}, getMeta() { return null; } },
    vessels: () => vs, pickables: () => [...vs.values()].map((b) => b.pickProxy), groundAt: () => 0, bounds: () => ({ x0: -108, x1: 108, z0: -27, z1: 27 }),
    liftVessel: (id) => ({ place: 'bench', pos: vs.get(id).group.position.clone() }), resolveDrop: (_i, x, z) => ({ place: 'bench', pos: new THREE.Vector3(x, 0, z) }), commitDrop() {},
    openFlow: () => ({ unit: 'ml', total: 0, push(a) { pushed += a; return a; }, limit() { return null; }, end() {} }),
    markDirty() {}, onSelectVessel() {}, notify() {}, setHint() {}, setPourState() {},
  };
  const hc = new HandlingController(host);
  const proj = (v) => { const p = v.clone().project(cam3); return { x: (p.x * 0.5 + 0.5) * 800, y: (-p.y * 0.5 + 0.5) * 500 }; };
  const sp = proj(new THREE.Vector3(30, 4, 10));
  assert.equal(hc.pointerDown({ button: 0, clientX: sp.x, clientY: sp.y }), true);
  hc.onMove({ clientX: sp.x + 20, clientY: sp.y - 10 });
  let tt = 0;
  const step = (k) => { for (let i = 0; i < k; i++) { tt += 1 / 60; hc.update(1 / 60, tt); } };
  step(20);
  // straight over the base of the burette: nothing happens, however long it stays there
  const over = proj(new THREE.Vector3(0, 10, 0));
  hc.onMove({ clientX: over.x, clientY: over.y });
  step(120);
  assert.ok(!hc.held?.lock, 'no lock over the base');
  assert.ok(hc.held.pos.y < 30, `the beaker stays at the base: ${hc.held.pos.y}`);
  assert.equal(pushed, 0);
  // raise the camera to the top of the burette: the opening is on screen and the beaker locks onto it
  cam3.position.set(0, rimY + 5, 70);
  cam3.lookAt(0, rimY - 6, 0);
  cam3.updateMatrixWorld();
  cam3.updateProjectionMatrix();
  const rs = proj(new THREE.Vector3(0, rimY, 0));
  hc.onMove({ clientX: rs.x + 20, clientY: rs.y + 15 });
  step(80);
  assert.ok(hc.held?.lock?.tall, 'locked on the opening once it is in view');
  for (let k = 0; k < 8; k++) { hc.onMove({ clientX: rs.x + 20, clientY: rs.y + 15 - k * 25 }); step(20); }
  assert.ok(pushed > 5, `poured into the burette: ${pushed}`);
  hc.onUp({ button: 0 });
});

console.log(`titration rig OK (${n} checks)`);
process.exit(0);
