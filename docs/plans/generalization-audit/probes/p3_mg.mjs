// P3: Mg + HCl - dependence on Mg mass (surface), solution volume at fixed [H+], stirring, dt; Zn/Fe/Al do nothing
import { eng, vessel, dose, snap, step, ctl, sp, J } from './common.mjs';
function run({ mg = 0.1, vol = 50, reagent = 'hcl_1m', dt = 0.5, stir = false, T = 298.15, tEnd = 10 }) {
  const h = vessel({ temperature_k: T, room_k: T });
  dose(h, { reagent_id: reagent, volume_ml: vol, temperature_k: T });
  if (stir) ctl(h, { stirring: true });
  dose(h, { reagent_id: 'mg_ribbon', mass_g: mg, temperature_k: T });
  let h2 = 0; let first = null;
  for (let t = 0; t < tEnd; t += dt) { step(h, dt); const s = snap(h); for (const g of s.gas_fluxes) if (g.species === 'H2(g)') { h2 += g.rate_ml_s * dt; if (first === null) first = g.rate_ml_s; } }
  const s = snap(h);
  const mgLeft = sp(s)['Mg(s)']?.amount_mol ?? (s.solids.find((x) => x.species === 'Mg(s)')?.mass_g ?? 0) / 24.305;
  console.log(`Mg=${mg}g V=${vol}mL ${reagent} stir=${stir} T=${T} dt=${dt}: H2 in ${tEnd}s = ${h2.toFixed(2)} mL (initial ${first?.toFixed(3)} mL/s), Mg reacted ${((mg / 24.305 - mgLeft) / (mg / 24.305) * 100).toFixed(1)}%, Tend ${s.temperature_k.toFixed(2)}`);
}
run({ mg: 0.02 }); run({ mg: 0.1 }); run({ mg: 0.5 }); run({ mg: 2.0 });
run({ mg: 0.1, vol: 25 }); run({ mg: 0.1, vol: 200 });
run({ mg: 0.1, stir: true });
run({ mg: 0.1, reagent: 'hcl_0_1m' });
run({ mg: 0.1, T: 278.15 }); run({ mg: 0.1, T: 338.15 });
run({ mg: 0.1, dt: 0.05 }); run({ mg: 0.1, dt: 1.0 });
// other metals via import
for (const [f, n] of [['Zn', 'zinc'], ['Fe', 'iron'], ['Al', 'aluminium']]) {
  const m = J(eng.import_compound(JSON.stringify({ id: 'pc_' + f, name: n, formula: f, state: 'solid', density: 7 })));
  const h = vessel(); dose(h, { reagent_id: 'hcl_1m', volume_ml: 50 }); 
  try { dose(h, { reagent_id: 'pc_' + f, mass_g: 0.5 }); } catch (e) { console.log(f, 'dose err', String(e)); continue; }
  let gas = 0; for (let i = 0; i < 60; i++) { step(h, 1); for (const g of snap(h).gas_fluxes) gas += g.rate_ml_s; }
  console.log(`${f} + 1 M HCl: modelable=${m.modelable} model=${m.phase_model} reason="${m.reason}" -> gas in 60 s ${gas.toFixed(2)} mL`);
}
