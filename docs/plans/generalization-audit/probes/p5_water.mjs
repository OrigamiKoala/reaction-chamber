import { vessel, dose, step, snap } from './lib.mjs';
const w = (s) => s.species.find((r) => r.id === 'H2O').amount_mol;
let a = vessel(); dose(a, { reagent_id: 'hcl_1m', volume_ml: 20 });
let b = vessel(); dose(b, { reagent_id: 'naoh_1m', volume_ml: 20 });
const wa = w(snap(a)), wb = w(snap(b));
let c = vessel(); dose(c, { reagent_id: 'hcl_1m', volume_ml: 20 }); dose(c, { reagent_id: 'naoh_1m', volume_ml: 20 });
const sc = snap(c);
console.log(`neutralisation 0.02 mol: H2O before ${(wa + wb).toFixed(5)} after ${w(sc).toFixed(5)} (expected +0.02000); dT=${(sc.temperature_k - 298.15).toFixed(2)} K; cons=${JSON.stringify(sc.conservation)}`);
// temperature dependence of a generated (frozen-k) reaction: bromoethane + NaOH at 298 vs heat later
