// Thermodynamics / equilibrium / energy probes against the built WASM engine.
// Run: node thermo_probes.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dir = '/Users/carlliu/reaction-chamber/web/src/wasm/engine';
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();

const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const mk = (T, extra = {}) =>
  eng.vessel_new(JSON.stringify({ type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: T, room_k: T, ...extra }));
const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const snap = (h) => J(eng.vessel_snapshot(h));
const ctl = (h, c) => eng.vessel_control(h, JSON.stringify(c));
const step = (h, dt, n = 1) => { for (let i = 0; i < n; i++) eng.vessel_step(h, dt); };
const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
const conc = (s, id) => (s.species.find((x) => x.id === id) || {}).conc_m ?? 0;
const amt = (s, id) => (s.species.find((x) => x.id === id) || {}).amount_mol ?? 0;
const f = (x, d = 3) => (typeof x === 'number' ? x.toPrecision(d) : String(x));

// ---------------------------------------------------------------- P1 Kw(T): pure water
console.log('\n# P1 pKw(T) of pure water (engine pH*2 and -log([H+][OH-]))  lit: Bandura&Lvov 2006 at Psat');
const lit = { 273.15: 14.95, 298.15: 13.99, 333.15: 13.02, 373.15: 12.26, 423.15: 11.64, 473.15: 11.30 };
for (const T of [273.15, 298.15, 333.15, 373.15, 423.15, 473.15]) {
  const h = mk(T, { sealed: true, stopper_pop_atm: 100, burst_atm: 200 });
  dose(h, { reagent_id: 'water', volume_ml: 100, temperature_k: T });
  const s = snap(h);
  const kw = conc(s, 'H+') * conc(s, 'OH-');
  console.log(`T=${T} K  T_after=${f(s.temperature_k, 5)}  pH=${f(s.ph, 4)}  pKw_engine=${f(-Math.log10(kw), 4)}  pKw_lit=${lit[T]}`);
}

// ---------------------------------------------------------------- P2 Ksp(T) for minerals with and without dH
console.log('\n# P2 Ksp(T): equimolar 0.01 M cation + anion, equilibrium [cation] -> s, Ksp_eff');
const salts = [
  ['x_AgNO3', 'AgNO3', 'x_NaCl', 'ClNa', 'Ag+', 'Cl-', 'AgCl'],
  ['x_MgCl2', 'Cl2Mg', 'x_NaOH', 'HNaO', 'Mg+2', 'OH-', 'Mg(OH)2'],
  ['x_CaCl2', 'CaCl2', 'x_NaF', 'FNa', 'Ca+2', 'F-', 'CaF2'],
];
for (const [ida, fa, idb, fb] of salts) {
  imp({ id: ida, name: ida, formula: fa, state: 'liquid', molarity: 0.1 });
  imp({ id: idb, name: idb, formula: fb, state: 'liquid', molarity: 0.1 });
}
for (const [ida, , idb, , cat, an, name] of salts) {
  for (const T of [298.15, 353.15]) {
    const h = mk(T, { sealed: true, stopper_pop_atm: 100, burst_atm: 200 });
    dose(h, { reagent_id: 'water', volume_ml: 50, temperature_k: T });
    dose(h, { reagent_id: ida, volume_ml: 10, temperature_k: T });
    dose(h, { reagent_id: idb, volume_ml: name === 'AgCl' ? 10 : 20, temperature_k: T });
    const s = snap(h);
    const c = conc(s, cat), a = conc(s, an);
    const nu = name === 'AgCl' ? 1 : 2;
    const iap = c * Math.pow(a, nu);
    console.log(`${name} T=${T}: [${cat}]=${f(c)} [${an}]=${f(a)} log IAP=${f(Math.log10(iap), 4)} pH=${f(s.ph, 3)}`);
  }
}

// ---------------------------------------------------------------- P3 Ionic strength effect on solubility
console.log('\n# P3 AgCl saturation with and without 0.5 M KNO3 background (real: s rises ~1.5x by gamma)');
imp({ id: 'x_KNO3', name: 'KNO3', formula: 'KNO3', state: 'liquid', molarity: 1.0 });
for (const bg of [0, 50]) {
  const h = mk(298.15);
  dose(h, { reagent_id: 'water', volume_ml: 50 - bg });
  if (bg) dose(h, { reagent_id: 'x_KNO3', volume_ml: bg });
  dose(h, { reagent_id: 'x_AgNO3', volume_ml: 5 });
  dose(h, { reagent_id: 'x_NaCl', volume_ml: 5 });
  const s = snap(h);
  console.log(`KNO3 ${bg ? '0.42 M' : '0'}: [Ag+]=${f(conc(s, 'Ag+'))}  I=${f(s.ionic_strength)}  activity(Ag+) reported=${f((s.species.find((x) => x.id === 'Ag+') || {}).activity)}`);
}

// ---------------------------------------------------------------- P4 Heating rate water vs ethanol (equal mass)
console.log('\n# P4 heating 50 g water vs 50 g ethanol, 50 W, 60 s (ideal ratio of dT ~ 1.6 incl. glass)');
for (const [id, ml] of [['water', 50], ['ethanol', 50 / 0.789]]) {
  const h = mk(295.15);
  dose(h, { reagent_id: id, volume_ml: ml });
  const t0 = snap(h).temperature_k;
  ctl(h, { heater_w: 50 });
  step(h, 0.5, 120);
  const s = snap(h);
  console.log(`${id}: mass=${f(s.contents_mass_g, 4)} g dT=${f(s.temperature_k - t0, 4)} K`);
}

// ---------------------------------------------------------------- P5 Brine heat capacity
console.log('\n# P5 heating 100 mL water vs 100 mL water + 30 g NaCl at 50 W, 60 s (real Cp(26 wt% brine) ~3.3 J/g/K)');
imp({ id: 'x_NaCl_s', name: 'NaCl', formula: 'ClNa', smiles: '[Na+].[Cl-]', state: 'solid', density: 2.16 });
for (const salt of [0, 30]) {
  const h = mk(295.15);
  dose(h, { reagent_id: 'water', volume_ml: 100 });
  if (salt) dose(h, { reagent_id: 'x_NaCl_s', mass_g: salt });
  const s0 = snap(h);
  ctl(h, { heater_w: 50 });
  step(h, 0.5, 120);
  const s = snap(h);
  console.log(`NaCl ${salt} g: T after dissolution=${f(s0.temperature_k, 5)} (dissolution dT), mass=${f(s.contents_mass_g, 4)}, heating dT=${f(s.temperature_k - s0.temperature_k, 4)}  solid left=${f((s.solids.find((x) => x.species === 'NaCl(s)') || {}).mass_g ?? 0)}`);
}

// ---------------------------------------------------------------- P6 Neutralisation heat & route dependence
console.log('\n# P6 heat of reaction, two routes');
{
  const h = mk(295.15);
  dose(h, { reagent_id: 'hcl_1m', volume_ml: 50 });
  dose(h, { reagent_id: 'naoh_1m', volume_ml: 50 });
  const s = snap(h);
  console.log(`HCl(aq)+NaOH(aq) 0.05 mol: dT=${f(s.temperature_k - 295.15, 4)} K (lit 55.8 kJ/mol -> ~6.2 K with this glass)`);
}
imp({ id: 'x_NaOH_s', name: 'NaOH', formula: 'HNaO', smiles: '[Na+].[OH-]', state: 'solid', density: 2.13 });
{
  const h = mk(295.15);
  dose(h, { reagent_id: 'hcl_1m', volume_ml: 50 });
  dose(h, { reagent_id: 'water', volume_ml: 48 });
  dose(h, { reagent_id: 'x_NaOH_s', mass_g: 2.0 });
  const s = snap(h);
  console.log(`HCl(aq)+NaOH(s) 0.05 mol: dT=${f(s.temperature_k - 295.15, 4)} K (lit: 55.8+44.5 kJ/mol -> ~11 K)`);
}
// Baking soda + vinegar: kinetic rxn (dH 11.5) vs equilibria path (no degassing enthalpy)
for (const stepping of [false, true]) {
  const h = mk(295.15);
  dose(h, { reagent_id: 'ch3cooh_5pct', volume_ml: 50 });
  dose(h, { reagent_id: 'nahco3_s', mass_g: 1.0 });
  let s = snap(h);
  const t1 = s.temperature_k;
  if (stepping) { step(h, 0.1, 600); s = snap(h); }
  const rx = s.reactions.map((r) => r.id).join(',');
  console.log(`NaHCO3(s) 1 g + 50 mL 5% AcOH ${stepping ? 'after 60 s' : 'right after dose'}: T=${f(s.temperature_k, 5)} (dT=${f(s.temperature_k - 295.15, 3)}; at dose ${f(t1 - 295.15, 3)}), CO2(aq)=${f(conc(s, 'CO2(aq)'))} M, mass lost ${f(s.mass_lost_g, 3)} g, rxns: ${rx}`);
}
console.log('   expected from species dfH (NaHCO3(s)+AcOH(aq)->Na+ + Ac- + H2O + CO2(g)) = +29.9 kJ/mol x 11.9 mmol = 356 J -> ~ -1.5 K');

// ---------------------------------------------------------------- P7 Boiling of brine and of water/ethanol mixture
console.log('\n# P7 boiling: 100 mL 2 M NaCl (lit 375.2 K) and 50/50 vol water/ethanol (lit bubble pt ~ 353.5 K)');
{
  const h = mk(295.15);
  dose(h, { reagent_id: 'water', volume_ml: 100 });
  dose(h, { reagent_id: 'x_NaCl_s', mass_g: 11.7 });
  ctl(h, { heater_w: 400 });
  step(h, 0.5, 600);
  const s = snap(h);
  console.log(`2 M NaCl after 300 s at 400 W: T=${f(s.temperature_k, 5)} K, boil_intensity=${s.boil_intensity}, mass lost=${f(s.mass_lost_g, 3)}`);
}
{
  const h = mk(295.15);
  dose(h, { reagent_id: 'water', volume_ml: 50 });
  dose(h, { reagent_id: 'ethanol', volume_ml: 50 });
  ctl(h, { heater_w: 300 });
  let firstBoil = null;
  for (let i = 0; i < 1600; i++) {
    step(h, 0.5);
    const s = snap(h);
    if (!firstBoil && s.gas_fluxes.length) firstBoil = s.temperature_k;
    if (i === 799 || i === 1599) {
      console.log(`t=${(i + 1) / 2}s T=${f(s.temperature_k, 5)} EtOH=${f(amt(s, 'C2H5OH'), 3)} mol H2O=${f(amt(s, 'H2O'), 3)} mol fluxes=${s.gas_fluxes.map((g) => g.species).join(',')}`);
    }
  }
  console.log(`  first vapour flux at T=${f(firstBoil, 5)} K`);
}

// ---------------------------------------------------------------- P8 Freezing
console.log('\n# P8 50 mL water in a 250 K bath for 1000 s (expect ice, plateau at 273.15 K)');
{
  const h = mk(295.15);
  dose(h, { reagent_id: 'water', volume_ml: 50 });
  ctl(h, { bath_k: 250 });
  step(h, 0.5, 2000);
  const s = snap(h);
  console.log(`T=${f(s.temperature_k, 5)} K, solids=${s.solids.map((x) => x.species).join(',') || 'none'}, layers=${s.layers.map((l) => l.phase).join(',')}`);
}

// ---------------------------------------------------------------- P9 Sealed water heated: pressure model
console.log('\n# P9 sealed 50 mL water heated at 200 W (lit Psat 150 C = 4.7 atm + air)');
{
  const h = mk(295.15, { sealed: true, stopper_pop_atm: 50, burst_atm: 100 });
  dose(h, { reagent_id: 'water', volume_ml: 50 });
  ctl(h, { heater_w: 200, sealed: true });
  for (let i = 0; i < 4; i++) {
    step(h, 0.5, 300);
    const s = snap(h);
    console.log(`t=${(i + 1) * 150}s T=${f(s.temperature_k, 5)} K (${f(s.temperature_k - 273.15, 4)} C) P=${f(s.pressure_atm, 4)} atm, liquid=${f(s.total_liquid_ml, 4)} mL`);
  }
}

// ---------------------------------------------------------------- P10 6 M HCl pH and pH of 1 M NaOH at 60 C
console.log('\n# P10 pH scale');
imp({ id: 'x_HCl6', name: 'HCl', formula: 'ClH', state: 'liquid', molarity: 6.0 });
{
  const h = mk(298.15);
  dose(h, { reagent_id: 'x_HCl6', volume_ml: 50 });
  const s = snap(h);
  console.log(`6 M HCl import: pH=${f(s.ph, 4)} [H+]=${f(conc(s, 'H+'))} (lit pH(activity) ~ -1.1 to -1.4 ; conc-scale -0.78)`);
}
for (const T of [298.15, 333.15]) {
  const h = mk(T);
  dose(h, { reagent_id: 'naoh_1m', volume_ml: 50, temperature_k: T });
  const s = snap(h);
  console.log(`1 M NaOH at ${T}: pH=${f(s.ph, 4)} (lit ~13.8 at 25 C with gamma; ~12.9 at 60 C)`);
}

// ---------------------------------------------------------------- P11 Heat loss model: 100 mL vs 10 mL at 353 K
console.log('\n# P11 cooling from 353 K in room 295 K for 600 s: 10 mL vs 200 mL (real: small volume cools much faster)');
for (const ml of [10, 200]) {
  const h = mk(295.15);
  dose(h, { reagent_id: 'water', volume_ml: ml, temperature_k: 353.15 });
  const t0 = snap(h).temperature_k;
  step(h, 0.5, 1200);
  const s = snap(h);
  console.log(`${ml} mL: T0=${f(t0, 5)} -> T=${f(s.temperature_k, 5)} after 600 s`);
}
