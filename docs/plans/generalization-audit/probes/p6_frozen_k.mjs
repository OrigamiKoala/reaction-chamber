import { imp, vessel, dose, step, snap, ctl } from './lib.mjs';
imp({ id: 'x_NaOH', name: 'NaOH', formula: 'HNaO', smiles: '[OH-].[Na+]', state: 'liquid', molarity: 1.0 });
imp({ id: 'x_EtBr', name: 'Bromoethane', formula: 'C2H5Br', smiles: 'CCBr', state: 'liquid' });
const rate = (s, id) => s.reactions.filter((r) => r.id === id).reduce((a, r) => a + r.rate, 0);
for (const T of [280, 298.15, 340]) {
  const h = vessel({ temperature_k: T, room_k: T });
  dose(h, { reagent_id: 'x_NaOH', volume_ml: 20 });
  dose(h, { reagent_id: 'x_EtBr', volume_ml: 2 });
  step(h, 1, 0.1);
  const s = snap(h);
  // now force temperature to 350 K via a hot bath? just report rate at dose temperature
  console.log(`dose at T=${T}: T now ${s.temperature_k.toFixed(1)}; sn2 rows`, s.reactions.filter(r=>r.id.startsWith('sn2')).map(r=>`${r.id}:${r.rate.toExponential(3)}`).join(' '));
}
// generated at 298, then heat: compare
const h = vessel();
dose(h, { reagent_id: 'x_NaOH', volume_ml: 20 }); dose(h, { reagent_id: 'x_EtBr', volume_ml: 2 });
step(h, 1, 0.1); const a = snap(h);
ctl(h, { heater_w: 600 }); step(h, 200, 0.5); ctl(h, { heater_w: 0 }); step(h, 1, 0.1); const b = snap(h);
const conc = (s, id) => s.species.find((r) => r.id === id)?.conc_m ?? 0;
const k = (s) => rate(s, 'sn2_C2H5Br_OH-') / (conc(s, 'C2H5Br') * conc(s, 'OH-'));
console.log(`k_eff at ${a.temperature_k.toFixed(1)} K = ${k(a).toExponential(3)}; after heating to ${b.temperature_k.toFixed(1)} K = ${k(b).toExponential(3)}`);
