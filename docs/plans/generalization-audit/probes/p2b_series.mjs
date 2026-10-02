import { vessel, dose, snap, step, sp } from './common.mjs';
for (const dt of [0.05, 0.5, 1.0]) {
  const T = 293.15;
  const h = vessel({ temperature_k: T, room_k: T });
  dose(h, { reagent_id: 's2o8_0_04m', volume_ml: 25, temperature_k: T });
  dose(h, { reagent_id: 'ki_0_05m', volume_ml: 25, temperature_k: T });
  dose(h, { reagent_id: 'na2s2o3_0_002m', volume_ml: 25, temperature_k: T });
  dose(h, { reagent_id: 'starch_sol', volume_ml: 2, temperature_k: T });
  let line = `dt=${dt}: `; let tsw = null;
  for (let t = 0; t < 200; t += dt) {
    step(h, dt);
    const r = sp(snap(h));
    const st = r['starch_I3']?.amount_mol ?? 0, th = r['S2O3-2']?.amount_mol ?? 0;
    if (tsw === null && th < 1e-7) tsw = t + dt;
    if (Math.abs((t + dt) % 20) < dt / 2) line += `[t=${(t + dt).toFixed(0)} S2O3=${th.toExponential(1)} starchI3=${st.toExponential(1)}] `;
  }
  console.log(line, ' S2O3 exhausted at', tsw);
}
