import { readFileSync } from 'node:fs';
import path from 'node:path';
const dir = '/Users/carlliu/reaction-chamber/web/src/wasm/engine';
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15 };
const dose = (h, d) => J(eng.vessel_dose(h, JSON.stringify(d)));
const snap = (h) => J(eng.vessel_snapshot(h));
const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
const step = (h, n, dt = 0.5) => { for (let i = 0; i < n; i++) eng.step_all(JSON.stringify([h]), dt); };
imp({ id: 'pc_br2', name: 'Bromine', formula: 'Br2', smiles: 'BrBr', state: 'liquid', color_linear_rgb: [0.35, 0.03, 0.01], t_melt_ref_k: 265.9, vapor_pressure_points: [[331.9, 101325]], density: 3.10 });
// vapour cue vs temperature for water and ethanol, heated by the hot plate
for (const rid of ['water', 'ethanol']) {
  const h = eng.vessel_new(JSON.stringify(cfg));
  dose(h, { reagent_id: rid, volume_ml: 50 });
  eng.vessel_control(h, JSON.stringify({ heater_w: 400 }));
  const rows = [];
  for (let i = 0; i < 400; i++) { step(h, 1, 0.5); const s = snap(h); if (i % 25 === 0) rows.push(`${(s.temperature_k - 273.15).toFixed(0)}C vis=${s.vapour_visibility.toFixed(2)} cond=${s.condensation.toFixed(2)} boil=${s.boil_intensity} gas=${s.gas_fluxes.map(g=>g.species+':'+g.rate_ml_s.toFixed(1)).join(',')}`); }
  console.log(rid + ':\n  ' + rows.join('\n  '));
}
// sealed Br2 heated: headspace fumes?
{
  const h = eng.vessel_new(JSON.stringify(cfg));
  dose(h, { reagent_id: 'pc_br2', volume_ml: 1 });
  eng.vessel_control(h, JSON.stringify({ sealed: true, stoppered: true, heater_w: 100 }));
  step(h, 60);
  const s = snap(h);
  console.log('sealed Br2: T', (s.temperature_k - 273.15).toFixed(1), 'P', s.pressure_atm?.toFixed?.(2), 'fumes', JSON.stringify(s.fumes), 'sealed?', s.sealed);
}
// sealed conc HCl? catalog has 1 M only. NH3 2M heated sealed -> NH3(g)?
{
  const h = eng.vessel_new(JSON.stringify(cfg));
  dose(h, { reagent_id: 'nahco3_s', mass_g: 2 }); dose(h, { reagent_id: 'hcl_1m', volume_ml: 30 });
  step(h, 4);
  const s = snap(h);
  console.log('NaHCO3+HCl open: gas', JSON.stringify(s.gas_fluxes), 'foam', s.foam, 'fumes', JSON.stringify(s.fumes));
}
{
  const h = eng.vessel_new(JSON.stringify(cfg));
  dose(h, { reagent_id: 'mg_ribbon', mass_g: 0.1 }); dose(h, { reagent_id: 'hcl_1m', volume_ml: 30 });
  step(h, 4);
  const s = snap(h);
  console.log('Mg+HCl: gas', JSON.stringify(s.gas_fluxes), 'solids', JSON.stringify(s.solids.map(x=>[x.species,x.kind,x.floating])));
}
