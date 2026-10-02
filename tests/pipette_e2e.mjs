// Manual pipetting against the *built* WASM engine: node tests/pipette_e2e.mjs
// Moves liquid the way the bench does (many small portions: remove from one vessel, add to the other) following the
// pipette rules of web/src/bench/pipetting_math.ts, and checks that species and volume are conserved and that a
// volumetric pipette delivers its nominal volume.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as P from '../web/src/bench/pipetting_math.ts';
import * as F from '../web/src/bench/filtration_math.ts';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();

const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const mk = (type, cap, glass, r) => eng.vessel_new(JSON.stringify({ type, capacity_ml: cap, glass_mass_g: glass, inner_radius_cm: r, temperature_k: 295.15, room_k: 295.15 }));
const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const snap = (h) => J(eng.vessel_snapshot(h));
const near = (what, a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (tol ${tol})`);

/** Same as Lab.transferChunk(src, dst, ml, { solids: false }). */
function transfer(src, dst, ml) {
  const portion = J(eng.vessel_remove_liquid(src, ml, false));
  eng.vessel_add_portion(dst, JSON.stringify(portion));
  return portion.volume_ml;
}

const species = (h) => {
  const out = {};
  for (const s of snap(h).species) out[s.id] = s.amount_mol;
  return out;
};
const sumSpecies = (...hs) => {
  const tot = {};
  for (const h of hs) for (const [k, v] of Object.entries(species(h))) tot[k] = (tot[k] ?? 0) + v;
  return tot;
};

// ---- 1. volumetric 10 mL: fill to just above the ring, bleed to the ring, deliver
{
  const stock = mk('beaker-250', 250, 110, 3.3);
  const pip = mk('pipette-volumetric-10', 10, 12, 0.3);
  const rcv = mk('beaker-250', 250, 110, 3.3);
  dose(stock, { reagent_id: 'hcl_0_1m', volume_ml: 60 });
  dose(rcv, { reagent_id: 'water', volume_ml: 40 });
  const rcvStart = snap(rcv).total_liquid_ml; // 40 g of water is 40.09 mL at 22 C (IAPWS density)
  const before = sumSpecies(stock, pip, rcv);
  const spec = P.makePipetteSpec('volumetric', 10, 0.3);

  // draw: full speed signal, 20 Hz
  let content = 0;
  for (let t = 0; t < 30; t += 0.05) {
    const o = P.pipetteStep({ spec, contentMl: content, signal: 1, fine: false, dt: 0.05, dipped: true, sourceMl: snap(stock).total_liquid_ml, roomMl: 0 });
    if (o.drawMl > 0) {
      transfer(stock, pip, o.drawMl);
      content += o.drawMl;
    }
    if (o.blocked === 'full') break;
  }
  near('filled to the limit just above the ring', content, spec.fillLimitMl, 1e-9);
  near('engine volume of the pipette', snap(pip).total_liquid_ml, content, 1e-6);

  // bleed back into the stock with Shift until the meniscus sits on the ring
  for (let t = 0; t < 120 && P.markDeviationMl(spec, content) > spec.markTolMl * 0.4; t += 0.05) {
    const o = P.pipetteStep({ spec, contentMl: content, signal: -0.6, fine: true, dt: 0.05, dipped: true, sourceMl: 1, roomMl: 1000 });
    if (o.dispenseMl > 0) {
      transfer(pip, stock, o.dispenseMl);
      content -= o.dispenseMl;
    }
  }
  assert.ok(P.onMark(spec, content), `meniscus on the ring: deviation ${P.markDeviationMl(spec, content)} mL`);
  const filled = content;

  // deliver into the receiver, full release
  let delivered = 0;
  for (let t = 0; t < 30; t += 0.05) {
    const o = P.pipetteStep({ spec, contentMl: content, signal: -1, fine: false, dt: 0.05, dipped: false, sourceMl: 0, roomMl: 250 - snap(rcv).total_liquid_ml });
    if (o.dispenseMl > 0) {
      delivered += transfer(pip, rcv, o.dispenseMl);
      content -= o.dispenseMl;
    }
    if (o.blocked === 'empty') break;
  }
  near('delivered volume = nominal (Class A +-0.02 mL)', delivered, 10, 0.02);
  near('delivered = filled - the drop left in the tip', delivered, P.volumetricDelivered(spec, filled), 1e-6);
  near('receiver gained exactly what was delivered', snap(rcv).total_liquid_ml, rcvStart + delivered, 0.05);
  near('a drop stays in the tip', snap(pip).total_liquid_ml, spec.residualMl, 1e-6);

  // every species is conserved across the three vessels
  const after = sumSpecies(stock, pip, rcv);
  // (H+ / OH- re-equilibrate in every vessel, so conservation is checked on the spectator ions and the water)
  for (const k of ['Cl-', 'H2O']) near(`species ${k}`, after[k] ?? 0, before[k], Math.max(1e-9, before[k] * 1e-6));
  // and the delivered liquid carries the reagent: 10 mL of 0.1 M HCl = 1 mmol H+ (as Cl-)
  near('chloride delivered', species(rcv)['Cl-'] ?? 0, delivered * 0.1e-3, 3e-5);
  console.log(`  ok volumetric pipette: filled ${filled.toFixed(4)} mL, delivered ${delivered.toFixed(4)} mL, species conserved`);
  for (const h of [stock, pip, rcv]) eng.vessel_free(h);
}

// ---- 2. graduated pipette: 3.35 mL then release at will, reading by difference; liquid left behind in the stock is exact
{
  const stock = mk('beaker-250', 250, 110, 3.3);
  const pip = mk('pipette-graduated-5', 5, 8, 0.3);
  const rcv = mk('test-tube', 25, 10, 0.8);
  dose(stock, { reagent_id: 'nacl_0_1m', volume_ml: 20 });
  const spec = P.makePipetteSpec('graduated', 5, 0.3);
  const v0 = snap(stock).total_liquid_ml;
  let content = 0;
  while (content < 4.2) {
    const o = P.pipetteStep({ spec, contentMl: content, signal: 0.8, fine: false, dt: 0.05, dipped: true, sourceMl: snap(stock).total_liquid_ml, roomMl: 0 });
    transfer(stock, pip, o.drawMl);
    content += o.drawMl;
  }
  const start = content;
  let out = 0;
  while (out < 3.35) {
    const o = P.pipetteStep({ spec, contentMl: content, signal: -0.5, fine: false, dt: 0.05, dipped: false, sourceMl: 0, roomMl: 25 - snap(rcv).total_liquid_ml });
    const want = Math.min(o.dispenseMl, 3.35 - out);
    transfer(pip, rcv, want);
    content -= want;
    out += want;
  }
  near('released exactly 3.35 mL', snap(rcv).total_liquid_ml, 3.35, 1e-6);
  near('pipette keeps the rest', snap(pip).total_liquid_ml, start - 3.35, 1e-6);
  near('stock lost what was drawn', snap(stock).total_liquid_ml, v0 - start, 1e-6);
  console.log('  ok graduated pipette: partial delivery to a test tube');
  for (const h of [stock, pip, rcv]) eng.vessel_free(h);
}

// ---- 3. Pasteur pipette: drop-wise, 0.04 mL per drop
{
  const stock = mk('beaker-50', 50, 32, 2.1);
  const pip = mk('pipette-pasteur', 2, 2.5, 0.2);
  const rcv = mk('beaker-50', 50, 32, 2.1);
  dose(stock, { reagent_id: 'water', volume_ml: 20 });
  const spec = P.makePipetteSpec('pasteur', 2, 0.2);
  let content = 0;
  for (let i = 0; i < 400 && content < 2 - 1e-9; i++) {
    const o = P.pipetteStep({ spec, contentMl: content, signal: 0.7, fine: false, dt: 0.05, dipped: true, sourceMl: snap(stock).total_liquid_ml, roomMl: 0 });
    if (o.drawMl > 0) {
      transfer(stock, pip, o.drawMl);
      content += o.drawMl;
    }
  }
  near('Pasteur pipette holds 2 mL', content, 2, 1e-6);
  let acc = 0;
  let drops = 0;
  for (let i = 0; i < 100 && drops < 25; i++) {
    const o = P.pipetteStep({ spec, contentMl: content, signal: -0.5, fine: false, dt: 0.05, dipped: false, sourceMl: 0, roomMl: 50, dropAcc: acc });
    acc = o.dropAcc;
    if (o.dispenseMl > 0) {
      transfer(pip, rcv, o.dispenseMl);
      content -= o.dispenseMl;
      drops += o.drops;
    }
  }
  near(`${drops} drops x 0.04 mL`, snap(rcv).total_liquid_ml, drops * 0.04, 1e-6);
  console.log(`  ok Pasteur pipette: ${drops} drops = ${(drops * 0.04).toFixed(2)} mL`);
  for (const h of [stock, pip, rcv]) eng.vessel_free(h);
}
// ---- 4. filtration: a precipitate is poured into a funnel; the liquid runs into the flask, the solid stays
{
  const beaker = mk('beaker-250', 250, 110, 3.3);
  const funnel = mk('filter-funnel-75', 75, 40, 3.0);
  const flask = mk('erlenmeyer-125', 125, 70, 2.9);
  dose(beaker, { reagent_id: 'agno3_0_1m', volume_ml: 40 });
  dose(beaker, { reagent_id: 'nacl_0_1m', volume_ml: 30 });
  const s0 = snap(beaker);
  const agcl0 = s0.solids.find((x) => x.species === 'AgCl(s)');
  assert.ok(agcl0 && agcl0.mass_g > 0.1, 'AgCl precipitated');
  const before = { liquid: s0.total_liquid_ml, agcl: agcl0.mass_g, cl: species(beaker)['Cl-'] ?? 0, na: species(beaker)['Na+'] ?? 0, no3: species(beaker)['NO3-'] ?? 0 };

  // pour the whole suspension into the funnel (solids go with it, as in Lab.transferChunk(..., solids: true))
  for (let i = 0; i < 14; i++) {
    const portion = J(eng.vessel_remove_liquid(beaker, s0.total_liquid_ml / 14, true));
    eng.vessel_add_portion(funnel, JSON.stringify(portion));
  }
  assert.ok(snap(funnel).solids.some((x) => x.species === 'AgCl(s)'), 'the precipitate is in the funnel');

  // run the filter at 10 Hz like Lab.runFilters
  let t = 0;
  for (; t < 600; t += 0.1) {
    const sf = snap(funnel);
    const cake = sf.solids.reduce((a, x) => a + x.mass_g, 0);
    const ml = F.filtrateStep('gravity', sf.total_liquid_ml, cake, 0.1, 125 - snap(flask).total_liquid_ml);
    if (ml <= 1e-4) break;
    transfer(funnel, flask, ml);
  }
  const sf = snap(funnel);
  const sfl = snap(flask);
  const cake = sf.solids.reduce((a, x) => a + x.mass_g, 0);
  near('the solid stays on the paper', sf.solids.find((x) => x.species === 'AgCl(s)')?.mass_g ?? 0, before.agcl, before.agcl * 0.02);
  assert.equal(sfl.solids.length, 0, 'the filtrate is clear: no solid in the flask');
  near('the cake keeps its wet film', sf.total_liquid_ml, F.retainedMl(cake), 0.02);
  near('liquid is conserved', sf.total_liquid_ml + sfl.total_liquid_ml, before.liquid, 0.05);
  assert.ok(t > 20 && t < 300, `filtering took ${t.toFixed(0)} s`);
  // dissolved spectator ions pass through: Na+ / NO3- all end up (almost) entirely in the filtrate
  const ff = species(flask);
  const fu = species(funnel);
  near('Na+ conserved', (ff['Na+'] ?? 0) + (fu['Na+'] ?? 0), before.na, before.na * 1e-6 + 1e-9);
  assert.ok((ff['Na+'] ?? 0) > before.na * 0.9, 'Na+ is in the filtrate');
  assert.ok((ff['NO3-'] ?? 0) > before.no3 * 0.9, 'NO3- is in the filtrate');
  console.log(`  ok filtration: ${sfl.total_liquid_ml.toFixed(1)} mL filtrate in ${t.toFixed(0)} s, ${sf.solids[0].mass_g.toFixed(3)} g AgCl kept on the paper`);
  for (const h of [beaker, funnel, flask]) eng.vessel_free(h);
}
console.log('pipette e2e OK');
