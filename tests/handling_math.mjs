// Pure-maths checks for manual handling (tilt-to-pour). Run: node tests/handling_math.mjs   (Node >= 22.6 strips TS types)
import assert from 'node:assert/strict';
import * as THREE from '../web/node_modules/three/build/three.module.js';
import * as M from '../web/src/bench/handling_math.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);

ok('ray-plane: camera ray hits y = 10', () => {
  const o = new THREE.Vector3(0, 50, 100);
  const d = new THREE.Vector3(0, -0.4, -1).normalize();
  const p = M.rayPlaneY(o, d, 10);
  near(p.y, 10, 1e-9);
  near(p.z, 100 - 40 / 0.4, 1e-6);
  assert.equal(M.rayPlaneY(o, new THREE.Vector3(0, 1, -1).normalize(), 10), null); // pointing away
  assert.equal(M.rayPlaneY(o, new THREE.Vector3(0, 0, -1), 10), null); // parallel
});

ok('onset tilt: surface meets the lip', () => {
  // cylinder R = 3, lip 15 cm up, filled to 9: tilt where fill + R*tan(th) == lip  =>  atan(6/3)
  near(M.onsetTilt(3, 15, 9), Math.atan2(6, 3), 1e-9);
  // fuller container -> pours earlier; emptier -> later
  assert.ok(M.onsetTilt(3, 15, 14) < M.onsetTilt(3, 15, 9));
  assert.ok(M.onsetTilt(3, 15, 2) > M.onsetTilt(3, 15, 9));
  // brim-full never goes below the clamp, empty never above it
  assert.ok(M.onsetTilt(3, 15, 15) >= 0.08);
  assert.ok(M.onsetTilt(1, 15, 0) <= 1.9);
});

ok('flow rate: zero below onset, trickle just above, monotone, max at full excess', () => {
  assert.equal(M.flowRate(0, 0.25, 30), 0);
  assert.equal(M.flowRate(-0.3, 0.25, 30), 0);
  const trickle = M.flowRate(0.03, 0.25, 30);
  assert.ok(trickle > 0.2 && trickle < 1.0, `trickle ${trickle}`);
  let prev = 0;
  for (let e = 0.005; e <= 0.7; e += 0.005) {
    const r = M.flowRate(e, 0.25, 30);
    assert.ok(r >= prev - 1e-12, 'monotone');
    prev = r;
  }
  near(M.flowRate(0.6, 0.25, 30), 30, 1e-6);
  near(M.flowRate(2, 0.25, 30), 30, 1e-6); // saturates
  // powder: a few mg/s at the smallest tilt, 5 g/s at full
  const mg = M.flowRate(0.03, M.POWDER_MIN_G_S, M.POWDER_MAX_G_S);
  assert.ok(mg >= 0.005 && mg < 0.05, `powder trickle ${mg}`);
  near(M.flowRate(0.6, M.POWDER_MIN_G_S, M.POWDER_MAX_G_S), 5, 1e-6);
});

ok('mouth limits the flow', () => {
  assert.ok(M.liquidMaxRate(0.9) < M.liquidMaxRate(1.3));
  assert.ok(M.liquidMaxRate(1.3) >= 15 && M.liquidMaxRate(1.3) <= 30);
  assert.equal(M.liquidMaxRate(5), 30);
  assert.ok(M.liquidMaxRate(0.2) >= 5);
});

ok('drop rate: 0 below the squeeze start, 0.3 -> 5 drops/s', () => {
  assert.equal(M.dropRate(0.05), 0);
  const lo = M.dropRate(0.17);
  assert.ok(lo > 0.25 && lo < 0.5, `lo ${lo}`);
  near(M.dropRate(1.1), 5, 1e-6);
});

ok('capture test has hysteresis', () => {
  const r = M.captureRadius(3.7, 1.4, 3.7);
  assert.ok(M.captureState(r - 0.1, r, false));
  assert.ok(!M.captureState(r + 0.1, r, false));
  assert.ok(M.captureState(r + 1, r, true));
  assert.ok(!M.captureState(r + 3, r, true));
});

ok('tilt from the pointer: fast to the onset, then fine control', () => {
  const onset = 1.3;
  assert.equal(M.tiltFromPointer(400, 450, onset, 90, 150), 0); // below the lock point: upright
  near(M.tiltFromPointer(400, 310, onset, 90, 150), onset, 1e-9); // `pre` px reach exactly the onset angle
  near(M.tiltFromPointer(400, 310 - 75, onset, 90, 150), onset + 0.5, 1e-9); // 75 px further = +0.5 rad of excess
  assert.equal(M.tiltFromPointer(400, -9999, onset, 90, 150), M.TILT_MAX);
  // monotone in pointer travel
  let prev = -1;
  for (let y = 450; y > 100; y -= 3) {
    const t = M.tiltFromPointer(400, y, onset, 90, 150);
    assert.ok(t >= prev - 1e-12);
    prev = t;
  }
  // a slight pointer move past the onset gives a trickle, full excess reaches the max flow
  const px = 90 + 6; // 6 px beyond the onset = 0.04 rad
  const tr = M.flowRate(M.tiltFromPointer(400, 400 - px, onset, 90, 150) - onset, 0.25, 30);
  assert.ok(tr > 0.2 && tr < 1.0, `trickle ${tr}`);
  // enough room above the pointer for the whole travel (or the scales compress)
  for (const [ly, H] of [[800, 900], [300, 900], [120, 600]]) {
    const { pre, fine } = M.pointerScales(ly, H);
    assert.ok(pre + 0.8 * fine <= ly - 10 + 1e-6 || pre === 36, `${ly}: ${pre} ${fine}`);
  }
  near(M.squeezeFromPointer(400, 250, 150), 1, 1e-9);
});

ok('body drop clears the bench when tilted about the lip', () => {
  near(M.bodyDrop(0, 15, 1.4, 3.7), 15, 1e-9); // upright: full height
  assert.ok(M.bodyDrop(1.3, 15, 1.4, 3.7) < 15);
  assert.ok(M.bodyDrop(2.0, 15, 1.4, 3.7) >= 0);
});

ok('clampLen2 / angleDelta / landing', () => {
  const [x, z] = M.clampLen2(10, 0, 0.2, 3);
  near(x, 3, 1e-9);
  near(z, 0, 1e-9);
  const [x0, z0] = M.clampLen2(0, 0, 0.5, 3, [0, 1]);
  near(x0, 0, 1e-9);
  near(z0, 0.5, 1e-9);
  near(M.angleDelta(3.0, -3.0), 2 * Math.PI - 6.0, 1e-9);
  const [lx, lz] = M.streamLanding(0, 0, 1, 0, 10, 30, 0, 0, 3);
  assert.ok(Math.hypot(lx, lz) <= 3 + 1e-9, 'landing stays inside the opening');
});

ok('nearestFreeSpot spirals out of an obstacle', () => {
  const blocked = (x, z, r) => Math.hypot(x - 10, z) < 4 + r; // one disc obstacle at x=10
  const [x, z] = M.nearestFreeSpot(10, 0, 3, blocked);
  assert.ok(!blocked(x, z, 3));
  assert.ok(Math.hypot(x - 10, z) < 12);
  assert.deepEqual(M.nearestFreeSpot(0, 0, 3, blocked), [0, 0]);
  assert.equal(M.nearestFreeSpot(0, 0, 3, () => true, 10), null);
});

console.log(`${n} checks passed`);
