import { readFileSync } from 'node:fs';
import path from 'node:path';
const dir = '/Users/carlliu/reaction-chamber/web/src/wasm/engine';
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const mk = (o = {}) => eng.vessel_new(JSON.stringify({ type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15, ...o }));
const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const snap = (h) => J(eng.vessel_snapshot(h));
const ctl = (h, c) => eng.vessel_control(h, JSON.stringify(c));
const run = (h, s, dt = 0.5) => { for (let t = 0; t < s; t += dt) eng.step_all(JSON.stringify([h]), dt); };
const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
const rows = (s) => s.species.map((x) => `${x.id}[${x.phase}] ${x.amount_mol.toExponential(3)}`);
const out = (n, v) => console.log(`\n## ${n}\n` + JSON.stringify(v));
// Q1 iodine solid with no water / with water
imp({ id: 'x_I2', name: 'Iodine', formula: 'I2', state: 'solid', density: 4.93, vapor_pressure_points: [[298.15, 40.7], [457.5, 101325]], t_melt_ref_k: 386.85, dh_fus_kj_mol: 15.52 });
{ const h = mk(); dose(h, { reagent_id: 'x_I2', mass_g: 1 }); run(h, 2); const s = snap(h); out('Q1 1 g I2 dry beaker', { rows: rows(s), solids: s.solids.length, V: s.total_liquid_ml, mass: s.contents_mass_g }); }
{ const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: 'x_I2', mass_g: 1 }); run(h, 2); const s = snap(h); out('Q1b 1 g I2 into 50 mL water (real solubility 0.33 g/L -> 0.016 g)', { rows: rows(s), solids: s.solids.map((x) => x.species + ' ' + x.mass_g) }); }
// Q2 pure water pH vs T
for (const T of [241, 273.15, 295.15, 353.15]) { const h = mk({ temperature_k: T, room_k: T }); dose(h, { reagent_id: 'water', volume_ml: 50, temperature_k: T }); ctl(h, { bath_k: T }); run(h, 60); const s = snap(h); out(`Q2 pure water ${T} K`, { T: s.temperature_k, ph: s.ph, rows: rows(s) }); }
// Q3 H2SO4 import (liquid, ionic)
{ const c = imp({ id: 'x_h2so4', name: 'Sulfuric acid', formula: 'H2O4S', smiles: 'OS(=O)(=O)O', state: 'liquid', density: 1.83, t_melt_ref_k: 283.5, vapor_pressure_points: [[610, 101325]] });
  out('Q3 H2SO4 import', { reason: c.reason, state: c.state_at_room, entry: c.entry && c.entry.composition, label: c.entry && c.entry.label }); }
// Q4 ethanol import from PubChem
{ const c = imp({ id: 'x_etoh', name: 'Ethanol', formula: 'C2H6O', smiles: 'CCO', state: 'liquid', density: 0.789, vapor_pressure_points: [[298.15, 7870], [351.4, 101325]], t_melt_ref_k: 159 });
  out('Q4 ethanol import', { reason: c.reason, kind: c.phase_model, entry: c.entry && c.entry.composition, label: c.entry && c.entry.label }); }
// Q5 sealed hexane heated: pressure
imp({ id: 'x_hex', name: 'Hexane', formula: 'C6H14', smiles: 'CCCCCC', state: 'liquid', density: 0.655, vapor_pressure_points: [[298.15, 20200], [341.9, 101325]], t_melt_ref_k: 178.0, solubility_g_per_l: 0.0095 });
{ const h = mk({ sealed: true, stopper_pop_atm: 50, burst_atm: 60 }); dose(h, { reagent_id: 'x_hex', volume_ml: 50 }); ctl(h, { sealed: true, heater_w: 150 }); run(h, 120); const s = snap(h); out('Q5 sealed hexane 150 W 120 s (real p_sat(T)+air)', { T: s.temperature_k, P: s.pressure_atm, V: s.total_liquid_ml }); }
// Q6 ice bath on water for 1 h
{ const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 50 }); ctl(h, { bath_k: 273.15 }); run(h, 3600, 2); const s = snap(h); out('Q6 water in ice bath 1 h', { T: s.temperature_k, solids: s.solids.length }); }
// Q7 water+ethanol + NaCl: solubility
{ imp({ id: 'x_NaCl', name: 'Sodium chloride', formula: 'ClNa', smiles: '[Na+].[Cl-]', state: 'solid', density: 2.16 });
  const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 25 }); dose(h, { reagent_id: 'ethanol', volume_ml: 25 }); dose(h, { reagent_id: 'x_NaCl', mass_g: 10 }); run(h, 10); const s = snap(h);
  out('Q7 10 g NaCl in 25 mL water + 25 mL ethanol (real ~1.5 g dissolves, ~5 g/100g in 50 wt% EtOH)', { solids: s.solids.map((x) => x.species + ' ' + x.mass_g.toFixed(2)), layers: s.layers.map((l) => l.phase + ' ' + l.volume_ml.toFixed(1)) }); }
// Q8 NaCl solubility vs T (table delta_h?)
for (const T of [273.15, 373.0]) { const h = mk({ temperature_k: T, room_k: T }); dose(h, { reagent_id: 'water', volume_ml: 50, temperature_k: T }); dose(h, { reagent_id: 'x_NaCl', mass_g: 25, temperature_k: T }); ctl(h, { bath_k: T }); run(h, 30); const s = snap(h); out(`Q8 NaCl 25 g/50 mL at ${T} (real dissolved 17.8 g @0C, 19.6 g @100C)`, { T: s.temperature_k, undissolved: s.solids.map((x) => x.mass_g.toFixed(2)) }); }
// Q9 KNO3 solubility vs T (strongly T dependent: 13 g/100g @0C, 246 g/100g @100C)
{ imp({ id: 'x_KNO3', name: 'Potassium nitrate', formula: 'KNO3', smiles: '[K+].[O-][N+]([O-])=O', state: 'solid', density: 2.11, solubility_g_per_l: 383 });
  for (const T of [273.15, 333.15]) { const h = mk({ temperature_k: T, room_k: T }); dose(h, { reagent_id: 'water', volume_ml: 50, temperature_k: T }); dose(h, { reagent_id: 'x_KNO3', mass_g: 40, temperature_k: T }); ctl(h, { bath_k: T }); run(h, 30); const s = snap(h); out(`Q9 KNO3 40 g / 50 mL at ${T} (real dissolved 6.6 g @0C, 40 g (all) @60C)`, { T: s.temperature_k, undissolved: s.solids.map((x) => x.species + ' ' + x.mass_g.toFixed(2)) }); } }
// Q10 settling time of BaSO4 in water vs in a viscous / dense medium is constant; just report tau proxy
