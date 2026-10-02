import { vessel, dose, step, snap } from './lib.mjs';
const elem = (s, el) => {
  let tot = 0;
  for (const r of s.species) {
    const m = r.id.replace(/\((s|aq|l|g)\)$/, '').replace(/[+-]\d*$/, '');
    const re = new RegExp(el + '(\\d*)(?![a-z])', 'g'); let mm, n = 0;
    while ((mm = re.exec(m))) n += mm[1] ? +mm[1] : 1;
    tot += n * r.amount_mol;
  }
  return tot;
};
// iodine clock: I count
let h = vessel();
dose(h, { reagent_id: 'ki_0_05m', volume_ml: 20 });
dose(h, { reagent_id: 's2o8_0_04m', volume_ml: 20 });
const s0 = snap(h); const i0 = elem(s0, 'I');
step(h, 600);
const s1 = snap(h); const i1 = elem(s1, 'I');
console.log(`iodine clock (no thiosulfate): I atoms before ${i0.toExponential(4)} after ${i1.toExponential(4)} (ratio ${(i1 / i0).toFixed(3)}); conservation=${JSON.stringify(s1.conservation)}`);
console.log('  species', s1.species.map((r) => `${r.id}:${r.amount_mol.toExponential(2)}`).join(' '));
// H2O2 + MnO2: O count incl. vented O2 (mass lost)
h = vessel();
dose(h, { reagent_id: 'h2o2_3pct', volume_ml: 20 });
const a = snap(h); const o0 = elem(a, 'O'), h0 = elem(a, 'H'), p0 = a.species.find((r) => r.id === 'H2O2').amount_mol;
dose(h, { reagent_id: 'mno2_s', mass_g: 0.2 });
step(h, 600);
const b = snap(h); const p1 = b.species.find((r) => r.id === 'H2O2')?.amount_mol ?? 0;
const o2vented = b.mass_lost_g / 32;
console.log(`H2O2 decomposed ${(p0 - p1).toExponential(3)} mol; O2 vented ${o2vented.toExponential(3)} mol (ideal 0.5x = ${((p0 - p1) / 2).toExponential(3)}); H atoms ${h0.toExponential(5)} -> ${elem(b, 'H').toExponential(5)} (expected unchanged); O ${o0.toExponential(5)} -> ${(elem(b, 'O') - 2 * 0).toExponential(5)} + vented ${(2 * o2vented).toExponential(3)}`);
// Carbonate: amount of CO2 trapped as enol
h = vessel();
dose(h, { reagent_id: 'hcl_1m', volume_ml: 20 });
dose(h, { reagent_id: 'nahco3_s', mass_g: 0.84 });
step(h, 600);
const c = snap(h);
console.log('NaHCO3 + HCl after 300 s:', c.species.filter((r) => /CO|enol/.test(r.id)).map((r) => `${r.id}:${r.amount_mol.toExponential(2)}`).join(' '), 'massLost', c.mass_lost_g.toFixed(3), 'cons', JSON.stringify(c.conservation));
