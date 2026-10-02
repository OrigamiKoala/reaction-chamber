// P4: what the live network generator injects into ordinary inorganic vessels (substring matching on species ids)
import { eng, vessel, dose, snap, step, ctl, sp, J } from './common.mjs';
function show(label, doses, tEnd = 60, T) {
  const h = vessel(T ? { temperature_k: T, room_k: T } : {});
  for (const d of doses) dose(h, d);
  for (let t = 0; t < tEnd; t += 1) step(h, 1);
  const s = snap(h);
  const weird = s.species.filter((r) => /_enol|_subst|_alkene|_alcohol|_acid|Mayr|_adduct/.test(r.id) && r.amount_mol > 0);
  const kin = s.reactions.filter((r) => r.kind === 'kinetic').map((r) => `${r.id} rate=${r.rate.toExponential(2)}`);
  console.log(`\n== ${label}: kinetic rows: ${kin.join('; ') || 'none'}`);
  console.log('   generated species:', weird.map((r) => `${r.id}=${r.amount_mol.toExponential(2)}`).join(' ') || 'none', ' T=', s.temperature_k.toFixed(2));
}
show('NaHCO3 + HCl', [{ reagent_id: 'hcl_1m', volume_ml: 50 }, { reagent_id: 'nahco3_s', mass_g: 1 }]);
show('CoCl2 (+ 10 M Cl) + NaOH', [{ reagent_id: 'cocl2_10m_cl', volume_ml: 20 }, { reagent_id: 'naoh_1m', volume_ml: 5 }]);
show('CoCl2 + NaOH', [{ reagent_id: 'cocl2_0_1m', volume_ml: 20 }, { reagent_id: 'naoh_1m', volume_ml: 5 }]);
show('acetic acid + NaOH', [{ reagent_id: 'ch3cooh_5pct', volume_ml: 20 }, { reagent_id: 'naoh_1m', volume_ml: 5 }]);
show('vinegar + HCl, 1 h', [{ reagent_id: 'ch3cooh_5pct', volume_ml: 20 }, { reagent_id: 'hcl_1m', volume_ml: 20 }], 3600);
// direct generator calls
const g = (c, T, pH) => J(eng.m6_generate_reaction_network(JSON.stringify(c), T, pH));
for (const [c, T, pH] of [[{ 'CO2(aq)': 0.01, 'HCO3-': 0.01 }, 298.15, 6], [{ 'CoCl4-2': 0.01, 'OH-': 0.01 }, 298.15, 12], [{ 'CH3COOH': 0.5, 'H2O': 55 }, 298.15, 2.5], [{ piperidine: 0.1, benzhydrylium: 0.1 }, 298.15, 7], [{ nuc_piperidine: 0.1, el_benzhydrylium_ph: 0.1 }, 298.15, 7], [{ C4H8O2: 0.1, 'OH-': 0.1 }, 298.15, 13], [{ EtOAc: 0.1, 'OH-': 0.1 }, 298.15, 13], [{ EtOAc: 0.1, 'OH-': 0.1 }, 348.15, 13]]) {
  const n = g(c, T, pH);
  console.log(`gen ${JSON.stringify(c)} T=${T} pH=${pH}:`, n.reactions.map((r) => `${r.id} kf=${r.k_fwd.toExponential(2)} kr=${r.k_rev.toExponential(2)} K=${r.k_eq.toExponential(2)} [${Object.keys(r.reactants).join('+')}->${Object.keys(r.products).join('+')}]`).join(' | ') || 'none');
}
