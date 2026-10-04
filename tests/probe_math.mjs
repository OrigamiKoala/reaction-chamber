// Probe maths: which layer a probe tip is in, and the two-node thermometer bulb. Run: node tests/probe_math.mjs   (Node >= 22.6 strips TS types)
import assert from 'node:assert/strict';
import * as P from '../web/src/equipment/probe_math.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};

ok('layer under the tip: densest layer first, above the surface is none', () => {
  // 100 mL of layers (40 + 60 mL) in a straight beaker where 1 mL = 0.1 cm of height, bottom at y = 1
  const level = (ml) => 1 + 0.1 * ml;
  assert.equal(P.layerIndexAtHeight([40, 60], 2.0, level), 0);
  assert.equal(P.layerIndexAtHeight([40, 60], 6.0, level), 1);
  assert.equal(P.layerIndexAtHeight([40, 60], 0.5, level), 0, 'on the floor: the bottom layer');
  assert.equal(P.layerIndexAtHeight([40, 60], 11.5, level), -1, 'above the liquid');
  assert.equal(P.layerIndexAtHeight([100], 6, level), 0);
});

/** Time for the reading to cover 63.2 % of a 1 K step from the liquid, with the bulb starting at equilibrium. */
function tau(rpm, tLiq = 300) {
  const s = { glassK: tLiq - 1, spiritK: tLiq - 1 };
  let t = 0;
  while (s.spiritK < tLiq - 1 + 0.632 && t < 600) {
    P.stepBulb(s, tLiq, rpm, 0.05);
    t += 0.05;
  }
  return t;
}

ok('film coefficients are those of water around a 5 mm cylinder', () => {
  const hn = P.filmNatural(300, 1);
  assert.ok(hn > 200 && hn < 600, `natural ${hn}`);
  const hf = P.filmForced(300, 400);
  assert.ok(hf > 2500 && hf < 6000, `forced ${hf}`);
  assert.equal(P.filmForced(300, 0), 0);
  assert.ok(P.bulbFilmCoefficient(300, 1, 400) > P.bulbFilmCoefficient(300, 1, 0));
});

ok('a stirred bulb answers in about ten seconds (spirit conduction), an unstirred one slower', () => {
  const stirred = tau(400);
  const still = tau(0);
  console.log(`    tau stirred ${stirred.toFixed(1)} s, unstirred ${still.toFixed(1)} s`);
  // lab spirit thermometers have 63 % response times of the order of 10 s; conduction in the spirit sets most of it
  assert.ok(stirred > 4 && stirred < 14, `stirred ${stirred}`);
  assert.ok(still > stirred + 1.5 && still < 30, `unstirred ${still}`);
});

ok('the reading converges to the liquid temperature and never overshoots', () => {
  const s = { glassK: 295, spiritK: 295 };
  let maxSpirit = 0;
  for (let i = 0; i < 4000; i++) {
    P.stepBulb(s, 330, 300, 0.05);
    maxSpirit = Math.max(maxSpirit, s.spiritK);
    assert.ok(s.spiritK <= 330 + 1e-9 && s.glassK <= 330 + 1e-9);
  }
  assert.ok(Math.abs(s.spiritK - 330) < 0.01, `${s.spiritK}`);
  // the glass leads the spirit while heating
  const t = { glassK: 295, spiritK: 295 };
  P.stepBulb(t, 330, 300, 1);
  assert.ok(t.glassK > t.spiritK);
});

console.log(`${n} probe maths checks passed`);
