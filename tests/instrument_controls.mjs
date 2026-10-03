// Headless check of the 3D instrument controls: node tests/instrument_controls.mjs
// Bundles the equipment + control rig with esbuild (from web/node_modules) and runs it in node with a stubbed canvas / DOM.
// Covers: every instrument builds, control ids are unique, every control is pickable from the front without another control
// in the way, knob drag / selector click / button / rocker behaviour through the real rig (incl. refusal snap-back), the
// burner's gas tap + wire-loop pose, the NMR lift + acquisition and the GC/MS injection + scan state machines.
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
import { Spectrophotometer } from '${web}/src/equipment/spectrophotometer';
import { NmrMachine } from '${web}/src/equipment/nmr';
import { MassSpectrometer } from '${web}/src/equipment/mass_spec';
import { ControlRig } from '${web}/src/bench/controls3d';
export { THREE, HotPlate, Burner, ElectrochemStation, Spectrophotometer, NmrMachine, MassSpectrometer, ControlRig };
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const code = out.outputFiles[0].text;
const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const { THREE, HotPlate, Burner, ElectrochemStation, Spectrophotometer, NmrMachine, MassSpectrometer, ControlRig } = mod;

let n = 0;
const ok = async (name, fn) => {
  await fn();
  n++;
  console.log('  ok', name);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const ev = (x, y, shift = false) => ({ clientX: x, clientY: y, shiftKey: shift, button: 0 });

// ---- build everything, posed like the scene does
const hot = new HotPlate();
const burner = new Burner();
const ec = new ElectrochemStation();
const sp = new Spectrophotometer();
const nmr = new NmrMachine();
const ms = new MassSpectrometer();
hot.group.position.set(0, 0, 6);
burner.group.position.set(-80, 0, -12);
ec.group.position.set(-44, 0, -14);
sp.group.position.set(-65, 0, 105);
nmr.group.position.set(74, 0, 105);
nmr.cryoMagnet.position.set(126, -90, 105);
ms.group.position.set(17, 0, 105);
const scene = new THREE.Scene();
scene.add(hot.group, burner.group, ec.group, sp.group, nmr.group, nmr.cryoMagnet, ms.group);
scene.updateMatrixWorld(true);
nmr.routeCables();

const hints = [];
const orbit = { enabled: true };
const rig = new ControlRig({ container: { addEventListener() {}, removeEventListener() {} }, orbit, setHint: (t) => hints.push(t) });
const all = [...hot.controls, ...burner.controls, ...ec.controls, ...sp.controls, ...nmr.controls, ...ms.controls];
rig.register(all);

await ok('all instruments build, controls registered with unique ids', () => {
  assert.equal(all.length, 2 + 3 + 8 + 3 + 5 + 3);
  assert.equal(new Set(all.map((c) => c.id)).size, all.length);
  for (const c of all) assert.equal(c.hit.userData.pick.id, c.id);
});

await ok('every control is pickable from the front with no other control in the way', () => {
  const meshes = rig.hitMeshes();
  const ray = new THREE.Raycaster();
  for (const c of all) {
    c.hit.updateWorldMatrix(true, false);
    const target = new THREE.Vector3();
    new THREE.Box3().setFromObject(c.hit).getCenter(target);
    // camera like focusPoint(front): a bit left of and above straight-on, 45 cm away
    const cam = target.clone().add(new THREE.Vector3(-5, 4, 45));
    ray.set(cam, target.clone().sub(cam).normalize());
    for (const m of meshes) m.updateWorldMatrix(true, false);
    const hits = ray.intersectObjects(meshes, false);
    assert.ok(hits.length > 0, `${c.id}: not hit at all`);
    assert.equal(hits[0].object.userData.pick.id, c.id, `${c.id}: blocked by ${hits[0].object.userData.pick.id}`);
  }
});

await ok('nothing buries a control or a screen: the first surface a front camera sees is the control / screen itself', () => {
  // gather every visible mesh of the instruments (meshes of the hot plate / burner have raycasting switched off: restore it here)
  const hitSet = new Set(rig.hitMeshes());
  const meshes = [];
  for (const g of [hot.group, burner.group, ec.group, sp.group, nmr.group, ms.group]) {
    g.traverse((o) => {
      if (o.isMesh && !hitSet.has(o) && o.material?.visible !== false) {
        o.raycast = THREE.Mesh.prototype.raycast;
        meshes.push(o);
      }
    });
  }
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const firstHit = (target) => {
    const cam = target.clone().add(new THREE.Vector3(-5, 4, 45));
    ray.set(cam, target.clone().sub(cam).normalize());
    return ray.intersectObjects(meshes, false)[0]?.object ?? null;
  };
  const ownedBy = (obj, root) => {
    for (let o = obj; o; o = o.parent) if (o === root) return true;
    return false;
  };
  for (const c of all) {
    if (c.id === 'burner.loop' || c.id === 'burner.air') continue; // sculpted parts of the burner, no panel in front
    const p = new THREE.Vector3();
    c.group.getWorldPosition(p);
    const up = new THREE.Vector3(0, 1, 0).transformDirection(c.group.matrixWorld).normalize();
    p.addScaledVector(up, 0.3); // just above the mounting surface
    const hit = firstHit(p);
    assert.ok(hit && ownedBy(hit, c.group), `${c.id}: buried, a camera sees ${hit?.parent?.name || hit?.name || hit?.geometry?.type} first`);
  }
  const screens = {
    'hot plate LCD': hot.lcd.mesh,
    'potentiostat V': ec.vLcd.mesh,
    'potentiostat A': ec.aLcd.mesh,
    'UV-vis screen': sp.screen.mesh,
    'NMR screen': nmr.screen.mesh,
    'MS screen': ms.screen.mesh,
    'GC screen': ms.gcScreen.mesh,
  };
  for (const [name, mesh] of Object.entries(screens)) {
    mesh.raycast = THREE.Mesh.prototype.raycast;
    if (!meshes.includes(mesh)) meshes.push(mesh);
  }
  for (const [name, mesh] of Object.entries(screens)) {
    const c = new THREE.Vector3();
    mesh.getWorldPosition(c);
    const hit = firstHit(c);
    assert.ok(hit === mesh, `${name} is hidden behind ${hit?.geometry?.type} (${hit?.parent?.name || hit?.name}) y ${hit?.position?.y} z ${hit?.position?.z}`);
  }
});

await ok('hot plate HEAT knob: drag up raises power in 50 W steps, refusal snaps back', () => {
  const heat = rig.get('hotplate.heat');
  const seen = [];
  hot.onHeat = (w) => {
    seen.push(w);
    return true;
  };
  rig.begin(heat, ev(100, 300));
  assert.equal(orbit.enabled, false, 'orbit camera stays off during the drag');
  rig.onMove(ev(100, 190)); // 110 px up = half the range
  assert.equal(hot.heaterWatts, 500);
  assert.equal(heat.value, 500);
  rig.onMove(ev(100, 150, true)); // moves are cumulative from the press
  assert.ok(heat.value > 500);
  rig.onUp(ev(100, 150));
  assert.equal(orbit.enabled, true);
  assert.ok(seen.length >= 2 && seen.every((w) => w % 50 === 0), `steps ${seen}`);
  // no vessel on the plate: the app refuses, the knob goes back
  hot.setPower(0);
  hot.onHeat = () => false;
  rig.begin(heat, ev(100, 300));
  rig.onMove(ev(100, 200));
  rig.onUp(ev(100, 200));
  assert.equal(hot.heaterWatts, 0);
  assert.equal(heat.value, 0);
});

await ok('hot plate STIR switch toggles on click and reports', () => {
  const stir = rig.get('hotplate.stir');
  let last = null;
  hot.onStir = (on) => {
    last = on;
    return true;
  };
  rig.begin(stir, ev(0, 0));
  rig.onUp(ev(0, 0)); // a click (no move)
  assert.equal(last, true);
  assert.equal(hot.isStirring, true);
  rig.begin(stir, ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(last, false);
  assert.equal(hot.isStirring, false);
  hot.onStir = () => false; // refused: nothing on the plate
  rig.begin(stir, ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(hot.isStirring, false);
  assert.equal(stir.index, 0);
});

await ok('hints are produced for hover and drag', () => {
  hints.length = 0;
  rig.setHovered('hotplate.heat');
  assert.ok(/HEAT/.test(hints.at(-1)), String(hints.at(-1)));
  rig.setHovered(null);
  assert.equal(hints.at(-1), null);
});

await ok('burner: gas tap lights it, air collar changes the flame, loop goes into the flame and back', () => {
  const gas = rig.get('burner.gas');
  assert.equal(burner.isActive, false);
  rig.begin(gas, ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(burner.isActive, true, 'GAS lever lights the burner');
  rig.begin(gas, ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(burner.isActive, false);
  burner.ignite();
  assert.equal(gas.index, 1, 'ignite() moves the lever');
  const air = rig.get('burner.air');
  rig.begin(air, ev(0, 300));
  rig.onMove(ev(0, 400)); // down = closed
  rig.onUp(ev(0, 400));
  assert.ok(burner.airOpen < 1, `air ${burner.airOpen}`);
  const loopCtl = rig.get('burner.loop');
  let asked = null;
  burner.onLoop = (into) => {
    asked = into;
    return true;
  };
  rig.begin(loopCtl, ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(asked, true);
  assert.equal(burner.loopInFlame, true);
  for (let i = 0; i < 40; i++) burner.animate(0.05);
  const loop = burner.loop;
  burner.group.updateWorldMatrix(true, true);
  const tip = new THREE.Vector3(0, 15, 0).applyMatrix4(loop.matrix); // wire end of the rod, burner frame
  near(tip.x, 0.3, 0.2, 'tip x');
  near(tip.y, 15.5 + 5.2, 0.2, 'tip y (inside the flame)');
  burner.extinguish();
  assert.equal(burner.loopInFlame, false, 'putting the flame out withdraws the loop');
});

await ok('potentiostat: knobs, selectors and rocker report; setPanel is silent', () => {
  const got = {};
  ec.onVoltage = (v) => (got.v = v);
  ec.onCurrent = (a) => (got.a = a);
  ec.onMode = (m) => (got.mode = m);
  ec.onMaterials = (a, c) => (got.mat = [a, c]);
  ec.onPower = (on) => (got.on = on);
  let dips = 0;
  ec.onDip = () => dips++;
  const volts = rig.get('electrochem.volts');
  rig.begin(volts, ev(0, 300));
  rig.onMove(ev(0, 190));
  rig.onUp(ev(0, 190));
  near(got.v, 2.5 + 6, 0.06, 'volts after a half-range drag');
  const mode = rig.get('electrochem.mode');
  rig.begin(mode, ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(got.mode, 'current');
  const anode = rig.get('electrochem.anode');
  rig.begin(anode, ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.deepEqual(got.mat, ['C', 'Pt']);
  const cath = rig.get('electrochem.cathode');
  rig.begin(cath, ev(0, 0), false);
  rig.onUp(ev(0, 0, true)); // shift-click goes back (wraps to Fe)
  assert.deepEqual(got.mat, ['C', 'Fe']);
  const power = rig.get('electrochem.power');
  rig.begin(power, ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(got.on, true);
  rig.begin(rig.get('electrochem.dip'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(dips, 1);
  got.v = undefined;
  ec.setPanel({ volts: 1.25, mode: 'voltage', anode: 'Cu', cathode: 'Zn', on: false, dipped: true });
  assert.equal(got.v, undefined, 'setPanel must not fire callbacks');
  const p = ec.panel;
  assert.equal(p.volts, 1.25);
  assert.equal(p.anode, 'Cu');
  assert.equal(p.cathode, 'Zn');
  assert.equal(p.mode, 'voltage');
  assert.equal(p.on, false);
  assert.equal(p.dipped, true);
});

await ok('spectrophotometer: wavelength knob, blank resets the reading, buttons call back', () => {
  const lam = rig.get('spectro.lambda');
  rig.begin(lam, ev(0, 300));
  rig.onMove(ev(0, 410)); // 110 px down = half the range, downwards
  rig.onUp(ev(0, 410));
  assert.ok(sp.wavelengthNm < 500 && sp.wavelengthNm >= 350, `lambda ${sp.wavelengthNm}`);
  assert.equal(sp.wavelengthNm % 5, 0);
  let blank = 0;
  let scan = 0;
  sp.onBlank = () => blank++;
  sp.onScan = () => scan++;
  rig.begin(rig.get('spectro.blank'), ev(0, 0));
  rig.onUp(ev(0, 0));
  rig.begin(rig.get('spectro.scan'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.deepEqual([blank, scan], [1, 1]);
  const b = sp.blank();
  assert.equal(b.points.length, 81);
  assert.deepEqual(sp.readingAt(500), { abs: 0, trans: 100 });
  for (let i = 0; i < 30; i++) sp.animate(0.05); // lid + screen draw without throwing
});

await ok('NMR: selectors set nucleus / solvent / scans; LIFT + ACQUIRE run the sample through to a spectrum', async () => {
  rig.begin(rig.get('nmr.nucleus'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(nmr.nucleus, '13C');
  rig.begin(rig.get('nmr.solvent'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(nmr.solvent, 'DMSO-d6');
  rig.begin(rig.get('nmr.scans'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(nmr.scans, 64);
  let lifts = 0;
  let acqs = 0;
  nmr.onLift = () => lifts++;
  nmr.onAcquire = () => acqs++;
  rig.begin(rig.get('nmr.lift'), ev(0, 0));
  rig.onUp(ev(0, 0));
  rig.begin(rig.get('nmr.acquire'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.deepEqual([lifts, acqs], [1, 1]);

  assert.equal(nmr.lift, 'empty');
  nmr.insert('Beaker 1', '#ff8800');
  assert.equal(nmr.lift, 'inserted');
  // the console asks the engine (stubbed here) once the tube is seated, with the parameters set on the selectors
  const calls = [];
  const fake = {
    nucleus: '13C', solvent: 'DMSO-d6', frequency_mhz: 100.61, scans: 64, ppm_start: -10, ppm_step: 0.01,
    intensity: Array.from({ length: 200 }, (_, i) => (i === 120 ? 1 : 0.01)),
    signals: [{ ppm: -8.8, multiplicity: 's', j_hz: [], integration: 1, nuclei: 1, assignment: 'CH3', species: 'sample', species_id: 'x', exchangeable: false, solvent: false, width_hz: 1, snr: 40, ppm_lo: -8.8, ppm_hi: -8.8 }],
    noise_sigma: 0.001, unobserved: [], notes: [], tier: 'Estimated', method: 'stub',
  };
  nmr.startAcquisition((p) => { calls.push(p); return Promise.resolve(fake); }, 'Beaker 1');
  assert.equal(nmr.isAcquiring, true);
  assert.equal(nmr.getLastSpectrum(), null, 'no spectrum before the acquisition has run');
  let t = 0;
  while (nmr.isAcquiring && t < 20) {
    nmr.animate(0.05);
    await new Promise((r) => setImmediate(r)); // let the engine promise settle
    t += 0.05;
  }
  assert.deepEqual(calls, [{ nucleus: '13C', solvent: 'DMSO-d6', scans: 64 }]);
  const res = nmr.getLastSpectrum();
  assert.ok(res, 'spectrum published');
  assert.equal(res.nucleus, '13C');
  assert.equal(res.sampleName, 'Beaker 1');
  // 64 scans: 0.6 + 0.7 log2(16) = 3.4 s of acquisition after the tube has settled (~1.1 s)
  assert.ok(t > 3.0 && t < 6.5, `acquisition took ${t.toFixed(2)} s`);
  // an engine failure is reported, not published
  nmr.insert('Beaker 1', '#ff8800');
  let msg = '';
  nmr.onError = (m) => { msg = m; };
  const before = nmr.getLastSpectrum();
  nmr.startAcquisition(() => Promise.reject(new Error('nothing to measure')), 'Beaker 1');
  for (let i = 0; i < 400 && nmr.isAcquiring; i++) { nmr.animate(0.05); await new Promise((r) => setImmediate(r)); }
  assert.match(msg, /nothing to measure/);
  assert.equal(nmr.getLastSpectrum(), before);
  nmr.eject();
  assert.equal(nmr.lift, 'ejected');
  for (let i = 0; i < 40; i++) nmr.animate(0.05);
  assert.ok(nmr.tube.position.y + 13.4 > 156 + 5, `ejected: the spinner is above the rim (tube base y ${nmr.tube.position.y})`);
});

await ok('GC/MS: LOAD puts a vial in the tray, INJECT runs the autosampler then the scan', async () => {
  const seen = [];
  ms.onLoad = () => seen.push('load');
  ms.onInject = () => seen.push('inject');
  rig.begin(rig.get('ms.source'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(ms.ionization, 'ESI_POS');
  rig.begin(rig.get('ms.source'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.equal(ms.ionization, 'ESI_NEG');
  rig.begin(rig.get('ms.source'), ev(0, 0));
  rig.onUp(ev(0, 0, true));
  assert.equal(ms.ionization, 'ESI_POS');
  rig.begin(rig.get('ms.load'), ev(0, 0));
  rig.onUp(ev(0, 0));
  rig.begin(rig.get('ms.inject'), ev(0, 0));
  rig.onUp(ev(0, 0));
  assert.deepEqual(seen, ['load', 'inject']);
  assert.equal(ms.vialLoaded, false);
  ms.loadVial('Vial A', '#55aaff');
  assert.equal(ms.vialLoaded, true);
  const modes = [];
  const fakeMs = {
    mode: 'ESI+', components: [{ id: 'a', name: 'acetone', formula: 'C3H6O', mw: 58.04, rt_min: null, share_pct: 100, peaks: [{ mz: 59, intensity: 100, assignment: '[M+H]+', molecular: true }], base_mz: 59, notes: [] }],
    summed: [{ mz: 59, intensity: 100, assignment: '[M+H]+', molecular: true }], chrom_t0: 0, chrom_dt: 0, tic: [], oven: [], not_analysed: [], notes: [], tier: 'Estimated', method: 'stub',
  };
  ms.startAcquisition((mode) => { modes.push(mode); return Promise.resolve(fakeMs); }, 'Vial A');
  assert.equal(ms.isAcquiring, true);
  const phases = new Set();
  let t = 0;
  let carriageMax = -1e9;
  while (ms.isAcquiring && t < 20) {
    ms.animate(0.05);
    await new Promise((r) => setImmediate(r));
    phases.add(ms.phaseNow);
    carriageMax = Math.max(carriageMax, ms.carriage.position.x);
    t += 0.05;
  }
  assert.ok(phases.has('injecting') && phases.has('scanning'), [...phases].join());
  assert.ok(carriageMax > -9.6 && carriageMax < -8.8, `carriage reached the vial (x ${carriageMax})`);
  near(ms.carriage.position.x, -19.5, 0.01, 'carriage returns to the inlet');
  assert.deepEqual(modes, ['ESI+']);
  const res = ms.getLastSpectrum();
  assert.ok(res && res.ionization === 'ESI_POS' && res.sampleName === 'Vial A');
  assert.ok(res.summed.some((p) => p.mz === 59), 'the engine result is published');
  near(t, 6, 0.6, 'injection 4 s + scan 2 s');
});

await ok('analytical bench layout: instruments clear each other, the monitor and the bench / room edges', () => {
  // the invisible pick volumes of the controls are not part of the instrument: take them off while measuring
  const hits = rig.hitMeshes().map((m) => ({ m, parent: m.parent }));
  for (const h of hits) h.parent.remove(h.m);
  const box = (o) => new THREE.Box3().setFromObject(o);
  // hoses / cables leave the instruments on purpose: measure the bodies
  const body = (g) => {
    const b = new THREE.Box3();
    for (const c of g.children) if (c.geometry?.type !== 'TubeGeometry') b.expandByObject(c);
    return b;
  };
  const items = {
    spectro: box(sp.group),
    ms: body(ms.group),
    nmrConsole: body(nmr.group),
    monitor: new THREE.Box3(new THREE.Vector3(-28, 0, 95), new THREE.Vector3(-12, 20, 97)),
  };
  const names = Object.keys(items);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = items[names[i]];
      const b = items[names[j]];
      const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
      const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
      assert.ok(!(overlapX > 0.01 && overlapZ > 0.01), `${names[i]} overlaps ${names[j]} (x ${overlapX.toFixed(1)}, z ${overlapZ.toFixed(1)})`);
    }
  }
  for (const k of ['spectro', 'nmrConsole']) {
    const b = items[k];
    assert.ok(b.min.x >= -95 && b.max.x <= 95 && b.min.z >= 85 && b.max.z <= 125, `${k} on the bench: x ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)} z ${b.min.z.toFixed(1)}..${b.max.z.toFixed(1)}`);
  }
  // GC/MS body (the foreline bellows leaves over the back edge on purpose)
  const msBody = new THREE.Box3();
  for (const c of ms.group.children) if (c.geometry?.type !== 'TubeGeometry') msBody.expandByObject(c);
  assert.ok(msBody.min.x >= -95 && msBody.max.x <= 95 && msBody.min.z >= 85 && msBody.max.z <= 125, `GC/MS on the bench: z ${msBody.min.z.toFixed(1)}..${msBody.max.z.toFixed(1)}`);
  // the magnet stands past the bench end, inside the side wall at x = 160, and below the lab ceiling
  const mag = box(nmr.cryoMagnet); // includes the 5-gauss floor decal ring around it
  assert.ok(mag.min.x >= 92 && mag.max.x <= 160, `magnet x ${mag.min.x.toFixed(1)}..${mag.max.x.toFixed(1)}`);
  assert.ok(mag.max.y < 120, `magnet height ${mag.max.y.toFixed(1)} above the bench top`);
  for (const h of hits) h.parent.add(h.m);
});

await ok('autosampler motion never drives the carriage into the tower, vials or inlet; the needle reaches the vial and the inlet', () => {
  const tower = ms.group.children.find((c) => c.isMesh && Math.abs(c.position.x + 24.8) < 1e-6 && c.position.y === 30);
  assert.ok(tower, 'tower found');
  tower.updateWorldMatrix(true, false);
  const towerBox = new THREE.Box3().setFromObject(tower);
  const needleTip = (t) => {
    ms.poseAutosampler(t);
    ms.group.updateMatrixWorld(true);
    const carBody = ms.carriage.children[0];
    const cb = new THREE.Box3().setFromObject(carBody);
    assert.ok(!cb.intersectsBox(towerBox), `carriage inside the tower at t=${t.toFixed(2)}`);
    const needle = ms.syringe.children[2];
    const tip = new THREE.Vector3(0, -2.0, 0); // needle centre is at -6.7, length 4: the tip is 2 below
    needle.localToWorld(tip);
    return tip.sub(ms.group.position); // instrument frame
  };
  let minTipYAtVial = 1e9;
  let minTipYAtInlet = 1e9;
  for (let t = 0; t <= 4.0; t += 0.05) {
    const tip = needleTip(t);
    const nearVial = Math.abs(tip.x - -9.2) < 0.2;
    const nearInlet = Math.abs(tip.x - -19.5) < 0.2;
    if (nearVial) minTipYAtVial = Math.min(minTipYAtVial, tip.y);
    if (nearInlet) minTipYAtInlet = Math.min(minTipYAtInlet, tip.y);
    // while travelling sideways the needle must clear the caps of the vials (top at 30 + 1.2 + 3.6 = 34.8)
    if (!nearVial && !nearInlet && tip.x > -19 && tip.x < -1) assert.ok(tip.y > 34.8, `needle drags through the vial caps at x ${tip.x.toFixed(1)} y ${tip.y.toFixed(1)}`);
  }
  assert.ok(minTipYAtVial < 33.5 && minTipYAtVial > 31.3, `needle dips into the vial (tip y ${minTipYAtVial.toFixed(2)})`);
  assert.ok(minTipYAtInlet < 33 && minTipYAtInlet > 30.5, `needle enters the inlet (tip y ${minTipYAtInlet.toFixed(2)})`);
  ms.poseAutosampler(0);
});

console.log(`\n${n} instrument-control checks passed`);
