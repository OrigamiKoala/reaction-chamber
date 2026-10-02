// P7: dissolution and precipitation are instantaneous (no rate, no induction, no size dependence)
import { eng, vessel, dose, snap, step, ctl, J } from './common.mjs';
const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
imp({ id: 'x_BaCl2', name: 'BaCl2', formula: 'BaCl2', state: 'liquid' });
imp({ id: 'x_Na2SO4', name: 'Na2SO4', formula: 'Na2O4S', state: 'liquid' });
const kcl = imp({ id: 'pc_KCl', name: 'Potassium chloride', formula: 'ClK', smiles: '[Cl-].[K+]', state: 'solid', density: 1.98 });
const solid = (h, id) => snap(h).solids.find((x) => x.species === id);
// dissolution
for (const [rid, g] of [['nahco3_s', 2.0], ['pc_KCl', 5.0]]) {
  const h = vessel(); dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: rid, mass_g: g });
  const s0 = snap(h); const left0 = s0.solids.reduce((a, x) => a + x.mass_g, 0);
  step(h, 0.05);
  console.log(`${g} g ${rid} into 50 mL water: undissolved solid right after dose = ${left0.toFixed(4)} g, after 0.05 s = ${snap(h).solids.reduce((a, x) => a + x.mass_g, 0).toFixed(4)} g (stirring/particle size not inputs)`);
}
// precipitation vs supersaturation (Ksp(BaSO4) ~ 1.1e-10 -> s ~ 1.05e-5 M)
for (const c of [1.0e-5, 1.3e-5, 2e-5, 1e-4, 1e-3]) {
  const h = vessel(); dose(h, { reagent_id: 'water', volume_ml: 100 });
  const v = c * 100 / 0.1; dose(h, { reagent_id: 'x_BaCl2', volume_ml: v }); dose(h, { reagent_id: 'x_Na2SO4', volume_ml: v });
  const so = solid(h, 'BaSO4(s)');
  const S = c * c / 1.08e-10;
  console.log(`[Ba]=[SO4]=${c.toExponential(1)} M (S = IAP/Ksp ~ ${S.toFixed(2)}): BaSO4 immediately after mixing = ${so ? (so.mass_g * 1e3).toFixed(3) + ' mg, particle ' + (so.particle_um ?? '?') + ' um' : 'none'}`);
}
