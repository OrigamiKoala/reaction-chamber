// Titration + separatory-funnel checks: node tests/titration.mjs   (Node >= 22.6 strips the TS types)
// 1) pure maths (stopcock curve, drops, tip seating, drain target), 2) the built WASM engine driven like the bench does:
// 25.00 mL 0.1 M HCl + indicator titrated with 0.1 M NaOH from a simulated burette in 0.05 mL drops.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as T from '../web/src/bench/titration_math.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);

// ------------------------------------------------------------------ maths
ok('stopcock flow: closed, monotone, drip -> stream, full open = Q_MAX', () => {
  assert.equal(T.stopcockFlow(0), 0);
  assert.equal(T.stopcockFlow(T.STOPCOCK_DEAD), 0);
  near(T.stopcockFlow(1), T.BURETTE_Q_MAX, 1e-9);
  near(T.stopcockFlow(1, 10), 10, 1e-9);
  let prev = 0;
  for (let o = 0.04; o <= 1.0001; o += 0.02) {
    const q = T.stopcockFlow(o);
    assert.ok(q > prev, `monotone at ${o}`);
    prev = q;
  }
  // a gentle lever gives single drops, a quarter-open lever is still dropwise, full open is a ~1.5-2 mL/s stream
  assert.ok(T.stopcockFlow(0.15) < 0.05, 'slow drip at 15 %');
  const q50 = T.stopcockFlow(0.5);
  assert.ok(q50 > 0.2 && q50 < 0.6, `half open ${q50}`);
  assert.ok(T.stopcockFlow(1) >= 1.5 && T.stopcockFlow(1) <= 2.0);
  near(T.stopcockFlow(T.openForFlow(0.1)), 0.1, 1e-6);
  assert.equal(T.openForFlow(0), 0);
});

ok('lever drag: up opens, down closes, shift is fine, clamped', () => {
  near(T.leverFromDrag(0, -T.LEVER_DRAG_PX / 2), 0.5, 1e-9);
  assert.equal(T.leverFromDrag(0.3, 1000), 0);
  assert.equal(T.leverFromDrag(0.3, -1000), 1);
  near(T.leverFromDrag(0.3, -40, true), 0.3 + (40 / T.LEVER_DRAG_PX) * T.LEVER_FINE, 1e-9);
});

ok('drips: every 0.05 mL is one drop, volume conserved, remainder swells', () => {
  const d = T.newDrip();
  let drops = 0;
  const q = 0.1; // mL/s
  for (let i = 0; i < 1000; i++) drops += T.stepDrip(d, q, 0.01); // 10 s
  assert.equal(drops, 20); // 1.0 mL
  const d2 = T.newDrip();
  let dd = 0;
  for (let i = 0; i < 100; i++) dd += T.stepDrip(d2, 0.012, 0.1); // 0.12 mL in 10 s -> 2 drops + 0.02 mL
  assert.equal(dd, 2);
  near(d2.acc, 0.02, 1e-9);
  near(T.pendantFill(d2), 0.4, 1e-9);
  // a stream run in 60 Hz frames delivers q*t overall
  const d3 = T.newDrip();
  let ml = 0;
  for (let i = 0; i < 600; i++) ml += T.stepDrip(d3, 1.8, 1 / 60) * T.STOPCOCK_DROP_ML;
  near(ml + d3.acc, 18, 1e-6);
});

ok('tap: exactly one drop, lever flicks open and back to closed', () => {
  assert.equal(T.tapProfile(-0.1), 0);
  assert.equal(T.tapProfile(T.TAP_S + 0.01), 0);
  assert.ok(T.tapProfile(T.TAP_S / 2) > 0.2);
  const d = T.newDrip();
  T.tapDrop(d);
  assert.equal(T.stepDrip(d, 0, 0.016), 1);
  assert.equal(T.stepDrip(d, 0, 0.016), 0);
  near(d.acc, 0, 1e-9);
});

ok('tip seating: clamp height puts the tip inside the neck; mouth must admit the tip', () => {
  // Erlenmeyer 250 on the tile: rim 17.5 cm, tip 16.03 cm above the burette origin, 1.5 cm deep
  const delta = T.clampDelta(16.03, 17.5, 1.5);
  near(delta + 16.03, 16.0, 1e-9);
  assert.ok(T.tipFitsMouth(1.65) && !T.tipFitsMouth(0.4));
  const dNeck = T.insertDepth(1.65, 13.4);
  const dBeaker = T.insertDepth(3.3, 9.4);
  assert.ok(dNeck >= 0.6 && dNeck <= 2.2 && dBeaker >= 0.6 && dBeaker <= 2.2);
});

ok('drain target: the opening under the tip, else the bench', () => {
  const flask = { id: 'f', x: 0, z: 0, rimInnerR: 1.65, rimTopY: 17.5, bottomY: 4.2 };
  const other = { id: 'b', x: 20, z: 0, rimInnerR: 3.3, rimTopY: 9, bottomY: 0.2 };
  assert.equal(T.targetUnderTip({ x: 0.2, y: 16, z: -0.3 }, [other, flask]), 'f');
  assert.equal(T.targetUnderTip({ x: 3, y: 16, z: 0 }, [other, flask]), null, 'tip off the mouth');
  assert.equal(T.targetUnderTip({ x: 20, y: 16, z: 0 }, [other, flask]), 'b');
  assert.equal(T.targetUnderTip({ x: 0, y: 3, z: 0 }, [flask]), null, 'tip below the vessel bottom');
});

ok('interface + burette tag text', () => {
  assert.ok(!T.interfaceReached([{ phase: 'aqueous', volume_ml: 20 }, { phase: 'organic', volume_ml: 5 }]));
  assert.ok(T.interfaceReached([{ phase: 'aqueous', volume_ml: 0.01 }, { phase: 'organic', volume_ml: 5 }]));
  assert.ok(!T.interfaceReached([{ phase: 'aqueous', volume_ml: 0 }]));
  assert.deepEqual(T.buretteTag(12.346, 40), { main: 'Burette reads 12.35 mL', sub: '(delivered)' });
  assert.equal(T.buretteTag(-1.2, 55).sub, 'above the zero mark');
  assert.equal(T.buretteTag(0, 0).main, 'Burette empty');
  assert.equal(T.formatReading(-0.001), '0.00');
});

// ------------------------------------------------------------------ engine
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const flaskCfg = { type: 'erlenmeyer-250', capacity_ml: 250, glass_mass_g: 105, inner_radius_cm: 3.6, temperature_k: 295.15, room_k: 295.15 };
const mk = (cfg = flaskCfg) => eng.vessel_new(JSON.stringify(cfg));
const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const snap = (h) => J(eng.vessel_snapshot(h));
const optics = J(eng.optics_tables_json());
const wl = optics.wavelengths_nm ?? optics.wavelengths ?? null;
const catalog = J(eng.reagent_catalog_json());

/** Mean visible absorbance (per cm) of the aqueous layer between lo and hi nm (falls back to bin indexes 400..710 / 32 bins). */
function absorbance(s, lo, hi) {
  const a = s.layers.find((l) => l.phase === 'aqueous')?.absorbance_per_cm ?? [];
  const nb = a.length || 32;
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < a.length; i++) {
    const nm = wl ? wl[i] : 400 + 10 * i; // 32 bins, 400-710 nm
    if (nm >= lo && nm <= hi) {
      sum += a[i];
      cnt++;
    }
  }
  return cnt ? sum / cnt : 0;
}

ok('catalog has the four indicator reagents', () => {
  for (const id of ['phenolphthalein_drop', 'methyl_orange_drop', 'bromothymol_blue_drop', 'methyl_red_drop']) {
    const e = catalog.find((x) => x.id === id);
    assert.ok(e && e.dropper, id);
  }
});

/** Titrate 25.00 mL 0.1 M HCl with 0.1 M NaOH in 0.05 mL drops; returns the curve [{v, ph, snap}]. */
function titrate(indicator, drops = 3) {
  const h = mk();
  dose(h, { reagent_id: 'hcl_0_1m', volume_ml: 25 });
  dose(h, { reagent_id: indicator, drops });
  const curve = [{ v: 0, ph: snap(h).ph, s: snap(h) }];
  let v = 0;
  for (let i = 0; i < 600; i++) {
    dose(h, { reagent_id: 'naoh_0_1m', volume_ml: T.STOPCOCK_DROP_ML });
    v = Math.round((v + T.STOPCOCK_DROP_ML) * 1e4) / 1e4;
    const s = snap(h);
    curve.push({ v, ph: s.ph, s });
    if (v > 27) break;
  }
  eng.vessel_free(h);
  return curve;
}

const phph = titrate('phenolphthalein_drop');
ok('pH curve: ~3 just before, ~11 just after 25.0 mL; endpoint within 0.1 mL', () => {
  const at = (v) => phph.find((p) => Math.abs(p.v - v) < 1e-6);
  assert.ok(at(24.5).ph < 3.5 && at(24.5).ph > 2.2, `pH at 24.5 = ${at(24.5).ph}`);
  assert.ok(at(24.9).ph > 3 && at(24.9).ph < 4.5, `pH at 24.9 = ${at(24.9).ph}`);
  assert.ok(at(25.2).ph > 10 && at(25.2).ph < 11.5, `pH at 25.2 = ${at(25.2).ph}`);
  // monotone rise
  for (let i = 1; i < phph.length; i++) assert.ok(phph[i].ph >= phph[i - 1].ph - 0.02, `monotone at ${phph[i].v}`);
  // equivalence = steepest slope
  let best = 0;
  let bestV = 0;
  for (let i = 1; i < phph.length; i++) {
    const s = (phph[i].ph - phph[i - 1].ph) / T.STOPCOCK_DROP_ML;
    if (s > best) {
      best = s;
      bestV = (phph[i].v + phph[i - 1].v) / 2;
    }
  }
  near(bestV, 25.0, 0.1, 'equivalence volume');
  // first pink: the first reading past pH 8.3
  const pinkAt = phph.find((p) => p.ph > 8.3).v;
  near(pinkAt, 25.0, 0.1, 'pink endpoint');
});

ok('phenolphthalein: colourless in acid, pink (green light absorbed) past the endpoint, colour_change event fired', () => {
  const at = (v) => phph.find((p) => Math.abs(p.v - v) < 1e-6).s;
  assert.ok(absorbance(at(20), 520, 580) < 1e-4, 'colourless before');
  assert.ok(absorbance(at(24.9), 520, 580) < 1e-3, 'colourless one drop-pair before');
  assert.ok(absorbance(at(25.2), 520, 580) > 0.03, `pink after: ${absorbance(at(25.2), 520, 580)}`);
  assert.ok(absorbance(at(26), 520, 580) > absorbance(at(25.2), 520, 580), 'deeper pink with excess base');
  // blue/red edges stay clear compared with the green absorption band: the result looks pink, not brown
  assert.ok(absorbance(at(26), 430, 470) < absorbance(at(26), 520, 580) * 0.5);
  const last = phph[phph.length - 1].s;
  assert.ok(last.events.some((e) => e.kind === 'colour_change'), 'colour_change event');
});

ok('methyl orange: red (acid form) -> yellow (base form) across its transition, near the equivalence point', () => {
  const mo = titrate('methyl_orange_drop', 1);
  const at = (v) => mo.find((p) => Math.abs(p.v - v) < 1e-6).s;
  const red = (s) => absorbance(s, 480, 540); // acid form absorbs green-cyan -> looks red
  const yellow = (s) => absorbance(s, 430, 470); // base form absorbs blue -> looks yellow
  assert.ok(red(at(10)) > yellow(at(10)) * 1.5, 'acid side is red');
  assert.ok(yellow(at(26)) > red(at(26)) * 1.2, 'base side is yellow');
  // transition happens at pH 3.1-4.4, i.e. within ~0.15 mL of the endpoint for a 0.1 M strong acid
  const tr = mo.find((p) => p.ph > 4.4).v;
  near(tr, 25.0, 0.15, 'methyl orange transition');
});

ok('bromothymol blue: yellow acid, blue base; methyl red: red acid, yellow base', () => {
  const btb = titrate('bromothymol_blue_drop', 2);
  const at = (c, v) => c.find((p) => Math.abs(p.v - v) < 1e-6).s;
  assert.ok(absorbance(at(btb, 10), 400, 470) > absorbance(at(btb, 10), 580, 650), 'yellow in acid');
  assert.ok(absorbance(at(btb, 26), 580, 650) > absorbance(at(btb, 26), 400, 470), 'blue in base');
  const mr = titrate('methyl_red_drop', 2);
  assert.ok(absorbance(at(mr, 10), 490, 550) > absorbance(at(mr, 10), 410, 450) * 2, 'red in acid');
  assert.ok(absorbance(at(mr, 26), 410, 450) > absorbance(at(mr, 26), 490, 550) * 2, 'yellow in base');
});

ok('stopcock simulation: dripping NaOH from a burette model into the flask stays on the same curve', () => {
  // drive the lever model: open to 0.3 (dropwise), 20 ms frames, push whole drops like the bench does
  const h = mk();
  dose(h, { reagent_id: 'hcl_0_1m', volume_ml: 25 });
  dose(h, { reagent_id: 'phenolphthalein_drop', drops: 3 });
  const open = 0.3;
  const q = T.stopcockFlow(open);
  const drip = T.newDrip();
  let delivered = 0;
  let t = 0;
  let pinkAt = null;
  while (delivered < 30 && t < 3000) {
    const k = T.stepDrip(drip, q, 0.02);
    if (k > 0) {
      dose(h, { reagent_id: 'naoh_0_1m', volume_ml: k * T.STOPCOCK_DROP_ML });
      delivered += k * T.STOPCOCK_DROP_ML;
      const s = snap(h);
      if (pinkAt === null && absorbance(s, 520, 580) > 0.02) pinkAt = delivered;
    }
    t += 0.02;
    if (pinkAt !== null && delivered > pinkAt + 0.5) break;
  }
  near(pinkAt, 25.0, 0.1, 'pink after delivering');
  near(t * q, delivered, 0.06, 'delivered volume matches flow x time');
  eng.vessel_free(h);
});

// ------------------------------------------------------------------ separatory funnel (drain the bottom layer first)
ok('funnel: engine drains the aqueous (bottom) layer before the ethanol layer; species conserved', () => {
  const cfg = { type: 'separatory-funnel-250', capacity_ml: 250, glass_mass_g: 230, inner_radius_cm: 3.3, temperature_k: 295.15, room_k: 295.15 };
  const f = mk(cfg);
  const dst = mk({ ...cfg, type: 'beaker-250', glass_mass_g: 110 });
  dose(f, { reagent_id: 'nacl_0_1m', volume_ml: 40 });
  dose(f, { reagent_id: 'ethanol', volume_ml: 20 });
  const s0 = snap(f);
  const layer = (s, ph) => s.layers.find((l) => l.phase === ph)?.volume_ml ?? 0;
  const aq0 = layer(s0, 'aqueous');
  const org0 = layer(s0, 'organic');
  assert.ok(aq0 > 35 && org0 > 15, `two layers ${aq0}/${org0}`);
  const na0 = s0.species.find((x) => x.id === 'Na+').amount_mol;
  let moved = 0;
  while (moved < aq0 - 0.15) {
    const p = J(eng.vessel_remove_liquid_bottom(f, Math.min(0.5, aq0 - moved - 0.1), true)); // stop short of the interface
    eng.vessel_add_portion(dst, JSON.stringify(p));
    moved += p.volume_ml;
    assert.ok(layer(snap(f), 'organic') > org0 - 1e-6, 'ethanol layer untouched while the aqueous layer drains');
  }
  const mid = snap(f);
  assert.ok(layer(mid, 'aqueous') < 0.3, `aqueous almost gone: ${layer(mid, 'aqueous')}`);
  assert.ok(T.interfaceReached([{ phase: 'aqueous', volume_ml: layer(mid, 'aqueous') < 0.05 ? layer(mid, 'aqueous') : 0 }, { phase: 'organic', volume_ml: layer(mid, 'organic') }]));
  const naF = mid.species.find((x) => x.id === 'Na+')?.amount_mol ?? 0;
  const naD = snap(dst).species.find((x) => x.id === 'Na+')?.amount_mol ?? 0;
  near(naF + naD, na0, na0 * 1e-6, 'Na+ conserved across the transfer');
  // default removal is still proportional over both phases
  const g = mk(cfg);
  dose(g, { reagent_id: 'water', volume_ml: 30 });
  dose(g, { reagent_id: 'ethanol', volume_ml: 20 });
  const b0 = snap(g);
  eng.vessel_remove_liquid(g, 10, true);
  const b1 = snap(g);
  assert.ok(layer(b1, 'organic') < layer(b0, 'organic') - 1 && layer(b1, 'aqueous') < layer(b0, 'aqueous') - 1);
});

console.log(`titration OK (${n} checks)`);
