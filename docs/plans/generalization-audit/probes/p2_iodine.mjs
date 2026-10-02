// P2: iodine clock in the Vessel path - iodine atom balance and dt dependence of the switch time
import { vessel, dose, snap, step, sp } from './common.mjs';
const Itot = (r) => Object.entries(r).reduce((a, [id, x]) => {
  const m = id.match(/I(\d*)/g); if (!m || !/I/.test(id) || id.startsWith('In')) return a;
  let n = 0; for (const t of id.matchAll(/I(\d*)(?![a-z])/g)) n += t[1] ? +t[1] : 1;
  return a + n * x.amount_mol;
}, 0);
function run(T, dt, thio = true, tEnd = 300) {
  const h = vessel({ temperature_k: T, room_k: T });
  dose(h, { reagent_id: 's2o8_0_04m', volume_ml: 25, temperature_k: T });
  dose(h, { reagent_id: 'ki_0_05m', volume_ml: 25, temperature_k: T });
  if (thio) dose(h, { reagent_id: 'na2s2o3_0_002m', volume_ml: 25, temperature_k: T });
  dose(h, { reagent_id: 'starch_sol', volume_ml: 2, temperature_k: T });
  const r0 = sp(snap(h)); const I0 = Itot(r0);
  let tsw = null;
  for (let t = 0; t < tEnd; t += dt) {
    step(h, dt);
    const r = sp(snap(h));
    const blue = Object.entries(r).filter(([k]) => /starch/i.test(k)).reduce((a, [, x]) => a + x.amount_mol, 0);
    if (tsw === null && blue > 1e-7) tsw = t + dt;
  }
  const r = sp(snap(h));
  const ids = Object.keys(r).filter((k) => /I/.test(k) && r[k].amount_mol > 1e-9).map((k) => `${k}=${r[k].amount_mol.toExponential(2)}`).join(' ');
  console.log(`T=${T} dt=${dt} thio=${thio}: switch t=${tsw}, I atoms ${I0.toExponential(4)} -> ${Itot(r).toExponential(4)} (${((Itot(r) / I0 - 1) * 100).toFixed(1)}%)  ${ids}`);
}
run(293.15, 0.05); run(293.15, 0.5); run(293.15, 1.0);
run(308.15, 0.5);
run(293.15, 0.5, false, 600);
