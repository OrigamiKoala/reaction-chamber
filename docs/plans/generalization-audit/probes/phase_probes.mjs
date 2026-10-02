// Phase / transport probes against the built WASM (read-only use of the repo).
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
const sp = (s, id) => (s.species.find((x) => x.id === id) || {}).amount_mol || 0;
const brief = (s) => ({ T: +s.temperature_k.toFixed(2), P: +s.pressure_atm.toFixed(3), V: +s.total_liquid_ml.toFixed(3),
  layers: s.layers.map((l) => `${l.phase}${l.species ? ':' + l.species : ''} ${l.volume_ml.toFixed(2)}mL rho=${l.density_g_ml.toFixed(3)}`),
  solids: s.solids.map((x) => `${x.species} ${x.mass_g.toFixed(4)}g`), gas: s.gas_fluxes.map((g) => `${g.species} ${g.rate_ml_s.toFixed(3)}mL/s`),
  lost: +s.mass_lost_g.toFixed(4), ph: s.ph && +s.ph.toFixed(3) });
const out = (name, v) => console.log(`\n## ${name}\n` + JSON.stringify(v, null, 1));

// P1 water in a 240 K bath
{ const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 50 }); ctl(h, { bath_k: 240 }); run(h, 1200); out('P1 water, 240 K bath, 20 min', brief(snap(h))); }
// P2 0.1 M NaCl in 260 K bath
{ const h = mk(); dose(h, { reagent_id: 'nacl_0_1m', volume_ml: 50 }); ctl(h, { bath_k: 260 }); run(h, 1200); out('P2 0.1 M NaCl, 260 K bath', brief(snap(h))); }
// P3 ethanol + water
{ const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: 'ethanol', volume_ml: 50 }); out('P3 50 mL water + 50 mL ethanol (real: one phase, ~96 mL)', brief(snap(h)));
  ctl(h, { heater_w: 150 }); const T = []; for (let i = 0; i < 40; i++) { run(h, 30); const s = snap(h); T.push([+s.temperature_k.toFixed(1), +sp(s, 'C2H5OH').toFixed(3), +sp(s, 'H2O').toFixed(3)]); }
  out('P3b heating the 50/50 mix at 150 W: [T, mol EtOH, mol H2O] every 30 s (real: bubble point ~353 K, rising, no plateau at 351.5 then 373)', T); }
// P4 pure ethanol, open, heated
{ const h = mk(); dose(h, { reagent_id: 'ethanol', volume_ml: 50 }); ctl(h, { heater_w: 150 }); run(h, 300); out('P4 ethanol open 150 W 300 s', brief(snap(h))); }
// P5 sealed water heated hard
{ const h = mk({ sealed: true, stopper_pop_atm: 50, burst_atm: 60 }); dose(h, { reagent_id: 'water', volume_ml: 50 }); ctl(h, { sealed: true, heater_w: 300 }); const rows = [];
  for (let i = 0; i < 12; i++) { run(h, 30); const s = snap(h); rows.push([+s.temperature_k.toFixed(1), +s.pressure_atm.toFixed(2), +sp(s, 'H2O').toFixed(3)]); }
  out('P5 sealed water 300 W: [T, P atm, mol H2O] (real P = p_air(T) + p_sat(T): 473 K -> ~15.5 atm)', rows); }
// P6 sealed water with default pop thresholds
{ const h = mk({ sealed: true }); dose(h, { reagent_id: 'water', volume_ml: 50 }); ctl(h, { sealed: true, heater_w: 300 }); run(h, 400); const s = snap(h); out('P6 sealed water default pop', { ...brief(s), events: s.events.map((e) => e.detail) }); }
// P7 NaCl into ethanol
{ imp({ id: 'x_NaCl', name: 'Sodium chloride', formula: 'ClNa', smiles: '[Na+].[Cl-]', state: 'solid', density: 2.16 });
  const h = mk(); dose(h, { reagent_id: 'ethanol', volume_ml: 50 }); dose(h, { reagent_id: 'x_NaCl', mass_g: 5 }); run(h, 60); out('P7 5 g NaCl in 50 mL ethanol (real: ~0.03 g dissolves)', brief(snap(h)));
  const h2 = mk(); dose(h2, { reagent_id: 'water', volume_ml: 50 }); dose(h2, { reagent_id: 'x_NaCl', mass_g: 25 }); run(h2, 60); out('P7b 25 g NaCl in 50 mL water (real: ~17.9 g dissolves, V ~ 57 mL)', brief(snap(h2)));
  const h3 = mk(); dose(h3, { reagent_id: 'water', volume_ml: 50 }); dose(h3, { reagent_id: 'x_NaCl', mass_g: 10 }); run(h3, 10); out('P7c 10 g NaCl in 50 mL water: volume (real ~53.4 mL, density 1.13)', brief(snap(h3))); }
// P8 naphthalene: open beaker at room for 1 h (sublimation), then heat
{ const n = imp({ id: 'x_naph', name: 'Naphthalene', formula: 'C10H8', smiles: 'C1=CC=C2C=CC=CC2=C1', state: 'solid', density: 1.14,
    vapor_pressure_points: [[298.15, 11.6], [353.15, 1000], [491.15, 101325]], dh_vap_kj_mol: 43.2, dh_vap_at_k: 491.15, t_melt_ref_k: 353.35, solubility_g_per_l: 0.031 });
  out('P8 naphthalene model', { state: n.state_at_room, thermo: n.thermo });
  const h = mk(); dose(h, { reagent_id: 'x_naph', mass_g: 5 }); run(h, 3600, 2); out('P8a 5 g naphthalene open, 1 h at 295 K (real: sublimes slowly, mothball smell)', brief(snap(h)));
  ctl(h, { heater_w: 60 }); const rows = []; for (let i = 0; i < 20; i++) { run(h, 30); const s = snap(h); rows.push([+s.temperature_k.toFixed(1), s.solids.map((x) => x.mass_g.toFixed(2)).join(','), s.layers.map((l) => l.volume_ml.toFixed(2)).join(','), +s.mass_lost_g.toFixed(3)]); }
  out('P8b heating 5 g naphthalene 60 W [T, solid g, layer mL, lost g]', rows); }
// P9 iodine: sublimation
{ const i2 = imp({ id: 'x_I2', name: 'Iodine', formula: 'I2', state: 'solid', density: 4.93, vapor_pressure_points: [[298.15, 40.7], [457.5, 101325]], t_melt_ref_k: 386.85, dh_fus_kj_mol: 15.52 });
  out('P9 iodine model', { modelable: i2.modelable, reason: i2.reason, state: i2.state_at_room, thermo: i2.thermo });
  const h = mk(); dose(h, { reagent_id: 'x_I2', mass_g: 1 }); ctl(h, { heater_w: 30 }); run(h, 240); out('P9b 1 g iodine heated 30 W 240 s (real: violet vapour well below mp)', brief(snap(h))); }
// P10 dry ice
{ const c = imp({ id: 'x_CO2', name: 'Carbon dioxide', formula: 'CO2', smiles: 'C(=O)=O', state: 'gas', vapor_pressure_points: [[194.7, 101325]], t_melt_ref_k: 216.6, density: 1.56 });
  out('P10 CO2 import (dry ice)', { modelable: c.modelable, reason: c.reason, by_mass: c.by_mass, state: c.state_at_room, kind: c.phase_model, entry: c.entry && c.entry.composition }); }
// P11 methane import
{ const c = imp({ id: 'x_CH4', name: 'Methane', formula: 'CH4', smiles: 'C', state: 'gas', vapor_pressure_points: [[111.6, 101325]], t_melt_ref_k: 90.7, solubility_g_per_l: 0.022 });
  out('P11 methane import', { reason: c.reason, state: c.state_at_room, entry: c.entry && c.entry.composition });
  const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: 'x_CH4', volume_ml: 10 }); run(h, 5); out('P11b 10 mL "methane" dosed into water', brief(snap(h))); }
// P12 hexane + toluene (miscible pair), and hexane on water
{ imp({ id: 'x_hex', name: 'Hexane', formula: 'C6H14', smiles: 'CCCCCC', state: 'liquid', density: 0.655, vapor_pressure_points: [[298.15, 20200], [341.9, 101325]], t_melt_ref_k: 178.0, solubility_g_per_l: 0.0095 });
  imp({ id: 'x_tol', name: 'Toluene', formula: 'C7H8', smiles: 'Cc1ccccc1', state: 'liquid', density: 0.867, vapor_pressure_points: [[298.15, 3790], [383.8, 101325]], t_melt_ref_k: 178.0, solubility_g_per_l: 0.52 });
  const h = mk(); dose(h, { reagent_id: 'x_hex', volume_ml: 30 }); dose(h, { reagent_id: 'x_tol', volume_ml: 30 }); run(h, 5); out('P12 30 mL hexane + 30 mL toluene (real: one phase)', brief(snap(h)));
  run(h, 3600, 2); out('P12b same after 1 h open at 295 K (real: hexane evaporates, several mL/h from 38 cm2)', brief(snap(h)));
  ctl(h, { heater_w: 100 }); const rows = []; for (let i = 0; i < 12; i++) { run(h, 20); const s = snap(h); rows.push([+s.temperature_k.toFixed(1), s.layers.map((l) => (l.species || l.phase) + ':' + l.volume_ml.toFixed(1)).join(',')]); }
  out('P12c heating hexane+toluene: [T, layers] (real: bubble point ~350 K rising continuously)', rows); }
// P13 acetone in water heated
{ imp({ id: 'x_ace', name: 'Acetone', formula: 'C3H6O', smiles: 'CC(C)=O', state: 'liquid', density: 0.784, vapor_pressure_points: [[298.15, 30800], [329.2, 101325]], t_melt_ref_k: 178.5, solubility_g_per_l: 1000 });
  const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: 'x_ace', volume_ml: 20 }); run(h, 5); out('P13 50 mL water + 20 mL acetone', brief(snap(h)));
  ctl(h, { heater_w: 150 }); const rows = []; for (let i = 0; i < 12; i++) { run(h, 30); const s = snap(h); rows.push([+s.temperature_k.toFixed(1), +sp(s, 'C3H6O').toFixed(3), +sp(s, 'H2O').toFixed(3)]); }
  out('P13b heating acetone/water [T, mol acetone dissolved, mol H2O] (real: acetone distils first from ~333 K)', rows); }
// P14 water volume vs T
{ const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 100 }); const v0 = snap(h).total_liquid_ml; ctl(h, { bath_k: 353.15 }); run(h, 900); const s = snap(h); out('P14 100 mL water 295 -> 353 K (real +2.9 % volume)', { v0, T: s.temperature_k, v1: s.total_liquid_ml }); }
// P15 NaHCO3 + vinegar open: residual CO2(aq)
{ const h = mk(); dose(h, { reagent_id: 'ch3cooh_5pct', volume_ml: 50 }); dose(h, { reagent_id: 'nahco3_s', mass_g: 1 }); run(h, 600); const s = snap(h);
  const vol = s.layers.filter((l) => l.phase === 'aqueous').reduce((a, l) => a + l.volume_ml, 0);
  out('P15 vinegar + 1 g NaHCO3, open, after 10 min: CO2(aq) M (air equilibrium ~1.4e-5 M; Henry at 1 atm pure CO2 0.034 M)', { co2_M: sp(s, 'CO2(aq)') / (vol / 1000), ph: s.ph }); }
// P16 2 M NH3 heated open
{ const h = mk(); dose(h, { reagent_id: 'nh3_2m', volume_ml: 50 }); ctl(h, { heater_w: 150 }); run(h, 600); const s = snap(h); out('P16 2 M NH3, 150 W, 10 min (real: NH3 strongly driven off well before boiling)', { ...brief(s), nh3: sp(s, 'NH3'), nh4: sp(s, 'NH4+') }); }
// P17 micro drop: 11 uL AgNO3 + 11 uL NaCl
{ const h = mk(); dose(h, { reagent_id: 'agno3_0_1m', volume_ml: 0.011 }); dose(h, { reagent_id: 'nacl_0_1m', volume_ml: 0.011 }); run(h, 2); const s = snap(h);
  out('P17 11 uL 0.1 M AgNO3 + 11 uL 0.1 M NaCl (real: ~1.1e-6 mol AgCl, ~0.16 mg)', { solids: s.solids, agcl_row: s.species.find((x) => x.id === 'AgCl(s)'), ag: sp(s, 'Ag+') }); }
// P18 glucose: dissolution + volume
{ imp({ id: 'x_glc', name: 'Glucose', formula: 'C6H12O6', smiles: 'C(C1C(C(C(C(O1)O)O)O)O)O', state: 'solid', t_melt_ref_k: 419.15, solubility_g_per_l: 909, dh_comb_kj_mol: -2803, density: 1.54 });
  const h = mk(); dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: 'x_glc', mass_g: 20 }); run(h, 2); out('P18 20 g glucose in 50 mL water (real V ~ 62.4 mL)', brief(snap(h)));
  ctl(h, { bath_k: 268.15 }); run(h, 1800); out('P18b same in 268 K bath (real: f.p. depression ~4.1 K -> freezes ~269 K partially)', brief(snap(h))); }
// P19 sealed vessel with ethanol heated: pressure
{ const h = mk({ sealed: true, stopper_pop_atm: 50, burst_atm: 60 }); dose(h, { reagent_id: 'ethanol', volume_ml: 50 }); ctl(h, { sealed: true, heater_w: 200 }); run(h, 240); out('P19 sealed ethanol 200 W 240 s (real P includes p_sat(EtOH): 400 K -> ~5 atm)', brief(snap(h))); }
// P20 hexane open: evaporation at room T only
{ const h = mk(); dose(h, { reagent_id: 'x_hex', volume_ml: 10 }); run(h, 7200, 5); out('P20 10 mL hexane open 2 h at 295 K (real: gone in well under 2 h)', brief(snap(h))); }
