// P6: registered kinetics - is_reversible / k_eq ignored? rate order for coefficient 2? dt sensitivity?
import { eng, vessel, dose, snap, step, J } from './common.mjs';
const mode = process.argv[2];
const base = { equation: 'probe', gas_products: {}, arrhenius_n: 0, delta_h_kj: 0, catalyst_species: null, tier: 'Speculative', source: 'probe' };
const mol = (h, id) => snap(h).species.find((r) => r.id === id)?.amount_mol ?? 0;
if (mode === 'rev') {
  J(eng.register_reaction(JSON.stringify({ ...base, id: 'probe_rev', reactants: { 'Na+': 1 }, products: { 'K+': 1 }, arrhenius_a: 0.05, arrhenius_ea: 0, is_reversible: true, k_eq_298: 1.0 })));
  const h = vessel(); dose(h, { reagent_id: 'nacl_0_1m', volume_ml: 50 });
  const n0 = mol(h, 'Na+');
  for (let i = 0; i < 400; i++) step(h, 0.5);
  console.log(`A <=> B with K = 1, kf = 0.05 s^-1, 200 s: Na+ fraction left ${(mol(h, 'Na+') / n0).toFixed(4)} (detailed balance: 0.5000)`);
}
if (mode === 'order') {
  J(eng.register_reaction(JSON.stringify({ ...base, id: 'probe_2nd', reactants: { 'Na+': 2 }, products: { 'K+': 2 }, arrhenius_a: 0.01, arrhenius_ea: 0, is_reversible: false, k_eq_298: null })));
  for (const v of [50, 25]) {
    const h = vessel(); dose(h, { reagent_id: 'nacl_0_1m', volume_ml: v }); dose(h, { reagent_id: 'water', volume_ml: 50 - v });
    const n0 = mol(h, 'Na+'); step(h, 0.5); const r = (n0 - mol(h, 'Na+')) / 0.05 / 0.5;
    console.log(`2 Na+ -> 2 K+ (elementary, should be 2nd order): [Na+]0=${(n0 / 0.05).toFixed(3)} M initial rate ${r.toExponential(3)} M/s`);
  }
}
if (mode === 'dt') {
  J(eng.register_reaction(JSON.stringify({ ...base, id: 'probe_fast', reactants: { 'Na+': 1 }, products: { 'K+': 1 }, arrhenius_a: 2.0, arrhenius_ea: 0, is_reversible: false, k_eq_298: null })));
  for (const dt of [0.05, 0.25, 0.5, 1.0]) {
    const h = vessel(); dose(h, { reagent_id: 'nacl_0_1m', volume_ml: 50 }); const n0 = mol(h, 'Na+');
    let t = 0; while (t < 1.0 - 1e-9) { step(h, dt); t += dt; }
    console.log(`first order k = 2 s^-1, after 1.0 s with dt=${dt}: fraction left ${(mol(h, 'Na+') / n0).toFixed(4)} (exact ${Math.exp(-2).toFixed(4)})`);
  }
}
