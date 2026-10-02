// Pure-maths checks for manual pipetting and gas readings. Run: node tests/pipetting_math.mjs   (Node >= 22.6 strips TS types)
import assert from 'node:assert/strict';
import * as P from '../web/src/bench/pipetting_math.ts';
import * as G from '../web/src/bench/gas_math.ts';
import * as F from '../web/src/bench/filtration_math.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);

const vol10 = P.makePipetteSpec('volumetric', 10, 0.3);
const grad5 = P.makePipetteSpec('graduated', 5, 0.3);
const pas = P.makePipetteSpec('pasteur', 2, 0.2);

ok('specs: fill limit slightly above the mark, tolerance ~ half a mm of bore', () => {
  near(vol10.fillLimitMl - vol10.nominalMl, Math.PI * 0.09 * 0.8, 1e-9);
  assert.ok(vol10.fillLimitMl > 10 && vol10.fillLimitMl < 10.4);
  near(vol10.markTolMl, Math.PI * 0.09 * 0.05, 1e-9);
  assert.ok(vol10.markTolMl < 0.02, 'tolerance within the Class A +-0.02 mL');
  assert.equal(pas.fillLimitMl, 2);
  assert.equal(pas.dropMl, 0.04);
  assert.equal(grad5.residualMl, 0);
  assert.ok(vol10.residualMl > 0);
});

ok('signal: dead zone, sign, saturation', () => {
  assert.equal(P.pipetteSignal(0), 0);
  assert.equal(P.pipetteSignal(P.DEAD_PX), 0);
  assert.ok(P.pipetteSignal(60) > 0 && P.pipetteSignal(-60) < 0);
  near(P.pipetteSignal(60), -P.pipetteSignal(-60), 1e-12);
  assert.equal(P.pipetteSignal(1000), 1);
  assert.equal(P.pipetteSignal(-1000), -1);
  let prev = 0;
  for (let dy = 11; dy < 200; dy += 5) {
    const s = P.pipetteSignal(dy);
    assert.ok(s >= prev, 'monotone');
    prev = s;
  }
});

ok('flow: zero at 0, a trickle at small signal, max at full, monotone', () => {
  assert.equal(P.flowFromSignal(0, 0.01, 5), 0);
  const trickle = P.flowFromSignal(0.1, 0.01, 5);
  assert.ok(trickle > 0.005 && trickle < 0.1, `trickle ${trickle}`);
  near(P.flowFromSignal(1, 0.01, 5), 5, 1e-9);
  let prev = 0;
  for (let m = 0.05; m <= 1; m += 0.05) {
    const f = P.flowFromSignal(m, 0.01, 5);
    assert.ok(f >= prev);
    prev = f;
  }
});

ok('detent: slows near the mark, full speed far away', () => {
  assert.equal(P.detentScale(5, vol10.markTolMl), 1);
  near(P.detentScale(0, vol10.markTolMl), 0.25, 1e-9);
  assert.ok(P.detentScale(vol10.markTolMl * 3, vol10.markTolMl) < 0.3);
});

ok('draw: needs the tip below the surface, stops when the source is empty', () => {
  const base = { spec: vol10, contentMl: 0, signal: 1, fine: false, dt: 0.1, dipped: true, sourceMl: 50, roomMl: 0 };
  const air = P.pipetteStep({ ...base, dipped: false });
  assert.equal(air.drawMl, 0);
  assert.equal(air.blocked, 'air');
  const dry = P.pipetteStep({ ...base, sourceMl: 0 });
  assert.equal(dry.blocked, 'source-empty');
  const good = P.pipetteStep(base);
  assert.ok(good.drawMl > 0.3 && good.drawMl <= vol10.maxRateMlS * 0.1 + 1e-9, `draw ${good.drawMl}`);
  const little = P.pipetteStep({ ...base, sourceMl: 0.05, dt: 1 });
  near(little.drawMl, 0.05, 1e-12);
  assert.equal(little.blocked, 'source-empty');
});

ok('volumetric: filling stops by itself just above the ring; over-draw is refused', () => {
  let c = 0;
  let steps = 0;
  while (steps++ < 2000) {
    const o = P.pipetteStep({ spec: vol10, contentMl: c, signal: 1, fine: false, dt: 0.02, dipped: true, sourceMl: 100, roomMl: 0 });
    c += o.drawMl;
    if (o.blocked === 'full') break;
  }
  assert.ok(steps < 2000, 'did not fill');
  near(c, vol10.fillLimitMl, 1e-6);
  assert.ok(c > 10, 'above the ring');
  const again = P.pipetteStep({ spec: vol10, contentMl: c, signal: 1, fine: false, dt: 0.1, dipped: true, sourceMl: 100, roomMl: 0 });
  assert.equal(again.drawMl, 0);
  assert.equal(again.blocked, 'full');
});

ok('volumetric: bleeding with Shift lands the meniscus on the ring (within the tolerance)', () => {
  // start from the overfilled state; keep a gentle release going, like a user easing the thumb
  let c = vol10.fillLimitMl;
  let t = 0;
  let last = c;
  for (; t < 60; t += 0.02) {
    const dev = c - vol10.nominalMl;
    if (dev <= vol10.markTolMl * 0.4) break; // the user stops as soon as they see the meniscus sit on the ring
    const o = P.pipetteStep({ spec: vol10, contentMl: c, signal: -0.6, fine: true, dt: 0.02, dipped: true, sourceMl: 100, roomMl: 1000 });
    assert.ok(o.dispenseMl >= 0);
    // fine steps never skip over the whole tolerance band in one frame
    assert.ok(o.dispenseMl < vol10.markTolMl * 2, `step ${o.dispenseMl} too coarse`);
    c -= o.dispenseMl;
    last = c;
  }
  assert.ok(t < 60, 'never reached the mark');
  assert.ok(P.onMark(vol10, last), `dev ${P.markDeviationMl(vol10, last)} vs tol ${vol10.markTolMl}`);
});

ok('volumetric TD: delivers the nominal volume (+-tolerance), a drop stays in the tip', () => {
  let c = vol10.nominalMl + vol10.markTolMl * 0.5; // meniscus within the reading tolerance
  const filled = c;
  let delivered = 0;
  for (let i = 0; i < 4000; i++) {
    const o = P.pipetteStep({ spec: vol10, contentMl: c, signal: -1, fine: false, dt: 0.02, dipped: false, sourceMl: 0, roomMl: 250 });
    c -= o.dispenseMl;
    delivered += o.dispenseMl;
    if (o.blocked === 'empty') break;
  }
  near(c, vol10.residualMl, 1e-9, 'residual drop');
  near(delivered, P.volumetricDelivered(vol10, filled), 1e-9);
  near(delivered, 10, 0.02, 'within Class A tolerance of 10 mL');
});

ok('graduated: dispenses freely down to empty and can be stopped at any mark', () => {
  let c = 5;
  let out = 0;
  for (let i = 0; i < 50; i++) {
    const o = P.pipetteStep({ spec: grad5, contentMl: c, signal: -0.5, fine: false, dt: 0.02, dipped: false, sourceMl: 0, roomMl: 100 });
    c -= o.dispenseMl;
    out += o.dispenseMl;
  }
  near(out + c, 5, 1e-9, 'conservation');
  assert.ok(c > 0.5 && c < 5, `released midway: ${c}`);
  for (let i = 0; i < 5000 && c > 0; i++) {
    const o = P.pipetteStep({ spec: grad5, contentMl: c, signal: -1, fine: false, dt: 0.02, dipped: false, sourceMl: 0, roomMl: 100 });
    c -= o.dispenseMl;
    if (o.blocked === 'empty') break;
  }
  near(c, 0, 1e-9);
});

ok('dispense stops when the vessel below is full', () => {
  const o = P.pipetteStep({ spec: grad5, contentMl: 3, signal: -1, fine: false, dt: 0.5, dipped: false, sourceMl: 0, roomMl: 0.2 });
  near(o.dispenseMl, 0.2, 1e-12);
  assert.equal(o.blocked, 'target-full');
  const o2 = P.pipetteStep({ spec: grad5, contentMl: 3, signal: -1, fine: false, dt: 0.5, dipped: false, sourceMl: 0, roomMl: 0 });
  assert.equal(o2.dispenseMl, 0);
});

ok('Pasteur pipette: drop-wise release, 0.04 mL per drop, draws up to 2 mL', () => {
  let c = 0;
  for (let i = 0; i < 2000; i++) {
    const o = P.pipetteStep({ spec: pas, contentMl: c, signal: 1, fine: false, dt: 0.02, dipped: true, sourceMl: 100, roomMl: 0 });
    c += o.drawMl;
    if (o.blocked === 'full') break;
  }
  near(c, 2, 1e-6);
  let acc = 0;
  let drops = 0;
  let released = 0;
  for (let i = 0; i < 400; i++) {
    const o = P.pipetteStep({ spec: pas, contentMl: c, signal: -0.6, fine: false, dt: 0.02, dipped: false, sourceMl: 0, roomMl: 250, dropAcc: acc });
    acc = o.dropAcc;
    c -= o.dispenseMl;
    drops += o.drops;
    released += o.dispenseMl;
    if (o.drops) near(o.dispenseMl, o.drops * 0.04, 1e-9);
  }
  assert.ok(drops > 5 && drops < 60, `${drops} drops in 8 s`);
  near(released, drops * 0.04, 1e-9);
  near(c + released, 2, 1e-9);
});

ok('interaction mode by glass kind', () => {
  assert.equal(P.interactionMode('pipette-volumetric'), 'pipette');
  assert.equal(P.interactionMode('pipette-graduated'), 'pipette');
  assert.equal(P.interactionMode('pipette-pasteur'), 'pipette');
  assert.equal(P.interactionMode('gas-syringe'), 'syringe');
  assert.equal(P.interactionMode('beaker'), 'pour');
  assert.equal(P.pipetteKindOf('beaker'), null);
  assert.equal(P.acceptsPipette('beaker', 3, 0.4), true);
  assert.equal(P.acceptsPipette('pipette-volumetric', 3, 0.4), false);
  assert.equal(P.acceptsPipette('gas-syringe', 1.5, 0.4), false);
  assert.equal(P.acceptsPipette('burette', 0.38, 0.4), false);
  assert.equal(P.acceptsPipette('cylinder', 0.6, 0.38), true);
});

ok('tip heights: dips below the surface, never on the bottom; stays inside the rim', () => {
  const y = P.drawTipHeight(8, 0.3);
  assert.ok(y < 8 && y > 0.5);
  assert.ok(P.drawTipHeight(0.5, 0.3) < 0.5); // shallow: rests on the bottom
  const hi = P.dispenseTipHeight(8, 0.3, 11);
  assert.ok(hi > 8 && hi < 11);
  assert.ok(P.dispenseTipHeight(0.3, 0.3, 11) < 11);
});

// ---------------------------------------------------------------- gas
ok('gas: molar volume and the 0.01 mol Mg example', () => {
  near(G.gasVolumeMl(1, 293.15, 1), 24055, 20);
  // 0.01 mol Mg + excess HCl -> 0.01 mol H2 -> ~240 mL at 20 C
  near(G.gasVolumeMl(0.01, 293.15, 1), 240.6, 1);
  near(G.gasMoles(G.gasVolumeMl(0.0123, 300, 1.0), 300, 1.0), 0.0123, 1e-12);
});

ok('gas: over water the reading includes the water vapour (~2.3 % at 20 C)', () => {
  const vapour = 0.0231; // the engine reports it (GasInfo.vapour_atm, IF97 curve of the water record)
  const dry = G.collectorVolumeMl(0.002, 293.15, 0);
  const wet = G.collectorVolumeMl(0.002, 293.15, vapour);
  near(wet / dry, 1 / (1 - vapour), 1e-9);
  assert.ok(wet / dry > 1.015 && wet / dry < 1.03);
});

ok('gas: tag text and readings', () => {
  const t = G.gasTagText('syringe', 37.4, 294.15, 'H2(g)');
  assert.equal(t.text, 'Gas: 37 mL');
  assert.ok(t.sub.includes('21 °C') && t.sub.includes('H₂'), t.sub);
  assert.equal(G.gasTagText('over_water', 12.26, 293.15).text, 'Gas: 12.5 mL');
  assert.equal(G.gasName('CO2(g)'), 'CO₂');
  assert.equal(G.dominantGas([{ species: 'H2(g)', mol: 1 }, { species: 'CO2(g)', mol: 3 }]), 'CO2(g)');
  assert.equal(G.dominantGas([]), null);
  assert.equal(G.plungerMl(130, 100), 100);
  assert.equal(G.plungerMl(-2, 100), 0);
});

// ---------------------------------------------------------------- filtration
ok('filtration: vacuum only for a Büchner funnel on a Büchner flask', () => {
  assert.equal(F.filterMode('buchner-funnel-90', 'buchner-flask-250'), 'vacuum');
  assert.equal(F.filterMode('buchner-funnel-90', 'erlenmeyer-250'), 'gravity');
  assert.equal(F.filterMode('filter-funnel-75', 'buchner-flask-250'), 'gravity');
  assert.ok(F.canReceiveFiltrate('erlenmeyer-250') && F.canReceiveFiltrate('beaker-100'));
  assert.ok(!F.canReceiveFiltrate('filter-funnel-75') && !F.canReceiveFiltrate('pipette-pasteur') && !F.canReceiveFiltrate('gas-jar-250'));
});

ok('filtration: rate grows with the head, shrinks with the cake, vacuum is much faster', () => {
  assert.ok(F.filtrationRateMlS('gravity', 50, 0) > F.filtrationRateMlS('gravity', 5, 0));
  assert.ok(F.filtrationRateMlS('gravity', 40, 3) < F.filtrationRateMlS('gravity', 40, 0));
  assert.ok(F.filtrationRateMlS('vacuum', 40, 0) > 8 * F.filtrationRateMlS('gravity', 40, 0));
});

ok('filtration: passes everything above what the wet cake keeps, then stops', () => {
  let liquid = 50;
  const cake = 2; // g
  let passed = 0;
  for (let t = 0; t < 1000; t += 0.1) {
    const step = F.filtrateStep('gravity', liquid, cake, 0.1);
    liquid -= step;
    passed += step;
  }
  near(liquid, F.retainedMl(cake), 1e-3, 'liquid left on the cake');
  near(passed, 50 - F.retainedMl(cake), 1e-3);
  assert.equal(F.filtrateStep('gravity', F.retainedMl(cake), cake, 0.1), 0);
  assert.equal(F.filtrateStep('gravity', 50, 0, 0.1, 0), 0, 'a full flask accepts nothing');
  const t50 = (() => {
    let l = 50;
    let t = 0;
    while (l > 5 && t < 1e4) {
      l -= F.filtrateStep('gravity', l, 0, 0.1);
      t += 0.1;
    }
    return t;
  })();
  assert.ok(t50 > 40 && t50 < 400, `50 mL through a gravity funnel in ${t50.toFixed(0)} s`);
});

console.log(`pipetting math OK (${n} checks)`);
