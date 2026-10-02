// P1: catalysed H2O2 decomposition - stoichiometry, element balance, T-dependence of catalysed rate, catalyst amount
import { vessel, dose, snap, step, sp } from './common.mjs';
function run(T, mno2_g, dt = 0.5, tEnd = 60) {
  const h = vessel({ temperature_k: T, room_k: T });
  dose(h, { reagent_id: 'h2o2_3pct', volume_ml: 50, temperature_k: T });
  const s0 = sp(snap(h));
  const H0 = s0['H2O2']?.amount_mol ?? 0, W0 = s0['H2O']?.amount_mol ?? 0;
  if (mno2_g > 0) dose(h, { reagent_id: 'mno2_s', mass_g: mno2_g, temperature_k: T });
  let o2 = 0;
  for (let t = 0; t < tEnd; t += dt) {
    step(h, dt);
    const s = snap(h);
    for (const g of s.gas_fluxes) if (g.species === 'O2(g)') o2 += g.rate_ml_s * dt;
  }
  const s = snap(h); const r = sp(s);
  const H1 = r['H2O2']?.amount_mol ?? 0, W1 = r['H2O']?.amount_mol ?? 0;
  const dH = H0 - H1, dW = W1 - W0;
  console.log(`T=${T} MnO2=${mno2_g}g dt=${dt}: H2O2 ${H0.toExponential(3)} -> ${H1.toExponential(3)} (consumed ${dH.toExponential(3)}), H2O gained ${dW.toExponential(3)} (ratio ${(dW / dH).toFixed(2)}, correct 1.00), O2 ${o2.toFixed(1)} mL, Tend=${s.temperature_k.toFixed(2)} cons=${JSON.stringify(s.conservation)}`);
}
run(278.15, 0.5); run(298.15, 0.5); run(348.15, 0.5);
run(298.15, 0.05); run(298.15, 2.0);
run(298.15, 0, 0.5, 60);
