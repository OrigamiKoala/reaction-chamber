import { eng, J } from './common.mjs';
const g = (c, T, pH) => J(eng.m6_generate_reaction_network(JSON.stringify(c), T, pH));
for (const [c, T, pH] of [[{ 'CO2(aq)': 0.01, 'HCO3-': 0.01 }, 298.15, 6], [{ 'CoCl4-2': 0.01, 'OH-': 0.01 }, 298.15, 12], [{ 'CH3COOH': 0.5, 'H2O': 55 }, 298.15, 2.5], [{ piperidine: 0.1, benzhydrylium: 0.1 }, 298.15, 7], [{ nuc_piperidine: 0.1, el_benzhydrylium_ph: 0.1 }, 298.15, 7], [{ C4H8O2: 0.1, 'OH-': 0.1 }, 298.15, 13], [{ EtOAc: 0.1, 'OH-': 0.1 }, 298.15, 13], [{ EtOAc: 0.1, 'OH-': 0.1 }, 348.15, 13], [{ C6H12O6: 0.1 }, 298.15, 7], [{ 'C2H5Br': 0.1, 'OH-': 0.1 }, 298.15, 13], [{ 'C2H5Br': 0.1, 'OH-': 0.1 }, 348.15, 13]]) {
  const n = g(c, T, pH);
  const fams = {}; for (const r of n.reactions) fams[r.family_id] = (fams[r.family_id] || 0) + 1;
  const first = n.reactions.slice(0, 3).map((r) => `${r.id}: ${Object.keys(r.reactants).join('+')}->${Object.keys(r.products).join('+')} kf=${r.k_fwd.toExponential(2)} kr=${r.k_rev.toExponential(2)} K=${r.k_eq.toExponential(2)} dH=${r.delta_h_kj}`).join(' | ');
  console.log(`\n${JSON.stringify(c)} T=${T} pH=${pH}: ${n.reactions.length} rxns, ${n.active_species.length} species, cap=${n.cap_reached}, families=${JSON.stringify(fams)}\n   ${first}`);
}
