// Appearance probe against the built WASM engine (read-only; nothing in the repo is modified).
//   node appearance_probe.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';

const dir = '/Users/carlliu/reaction-chamber/web/src/wasm/engine';
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const W = J(eng.optics_tables_json()).rgb_weights;
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15 };
const vessel = () => eng.vessel_new(JSON.stringify(cfg));
const dose = (h, d) => J(eng.vessel_dose(h, JSON.stringify(d)));
const snap = (h) => J(eng.vessel_snapshot(h));
const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
const step = (h, n, dt = 0.5) => { for (let i = 0; i < n; i++) eng.step_all(JSON.stringify([h]), dt); };
const srgb = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hex = (lin) => '#' + lin.map((c) => Math.round(srgb(c) * 255).toString(16).padStart(2, '0')).join('');
function colour(a, L = 3) {
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < 32; i++) { const t = 10 ** (-(a[i] || 0) * L); r += W[i * 3] * t; g += W[i * 3 + 1] * t; b += W[i * 3 + 2] * t; }
  return [r, g, b];
}
const maxA = (a) => Math.max(...a.map((x) => x || 0));
function describe(label, s) {
  const layers = s.layers.map((l) => `${l.phase}${l.species ? '[' + l.species + ']' : ''} ${l.volume_ml.toFixed(1)}mL rho=${l.density_g_ml.toFixed(3)} n=${l.refractive_index} maxA=${maxA(l.absorbance_per_cm).toExponential(2)} col3cm=${hex(colour(l.absorbance_per_cm))} scat=${l.scatter_per_cm.toFixed(3)} scRGB=${hex(l.scatter_rgb)}`);
  const solids = s.solids.map((x) => `${x.species} ${x.mass_g.toFixed(4)}g rgb=${hex(x.rgb)} kind=${x.kind} d=${x.particle_diameter_um}um susp=${x.suspended_fraction.toFixed(2)}${x.floating ? ' floating' : ''}`);
  console.log(`\n== ${label}`);
  layers.forEach((l) => console.log('  layer ', l));
  solids.forEach((l) => console.log('  solid ', l));
  if (s.fumes?.length) console.log('  fumes ', JSON.stringify(s.fumes));
  if (s.flame) console.log('  flame ', JSON.stringify(s.flame));
  console.log('  vap_vis', s.vapour_visibility?.toFixed?.(2), 'cond', s.condensation?.toFixed?.(2), 'boil', s.boil_intensity, 'foam', s.foam?.toFixed?.(2), 'T', (s.temperature_k - 273.15).toFixed(1));
  const ev = (s.events || []).map((e) => e.detail);
  if (ev.length) console.log('  events', ev.slice(-6).join(' | '));
}

// --- 1. Coloured ionic salts imported from PubChem (formula only, like the app)
const salts = [
  ['KMnO4', 'KMnO4', '#7b4fa8'], ['CuSO4', 'CuO4S', '#f4f3ef'], ['NiCl2', 'Cl2Ni', '#4f9a55'], ['CoCl2', 'Cl2Co', '#3d6fc4'],
  ['K2Cr2O7', 'Cr2K2O7', '#e98a2b'], ['FeCl3', 'Cl3Fe', '#7b5233'], ['CrCl3', 'Cl3Cr', '#7b4fa8'], ['MnSO4', 'MnO4S', '#e79bb4'],
  ['FeSO4', 'FeO4S', '#4f9a55'], ['K3Fe(CN)6', 'C6FeK3N6', '#c8332c'], ['VOSO4', 'O5SV', '#3d6fc4'], ['Cu(NO3)2', 'CuN2O6', '#3d6fc4'],
];
for (const [name, formula, col] of salts) {
  const lin = col.slice(1).match(/../g).map((h) => { const c = parseInt(h, 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const r = imp({ id: `pc_${name}`, name, formula, state: 'solid', color_linear_rgb: lin });
  const h = vessel();
  dose(h, { reagent_id: 'water', volume_ml: 50 });
  let note = `model=${r.phase_model} modelable=${r.modelable}`;
  if (r.modelable) { dose(h, { reagent_id: `pc_${name}`, mass_g: 0.5 }); step(h, 4); }
  const s = snap(h);
  const aq = s.layers.find((l) => l.phase === 'aqueous');
  const sp = s.species.filter((x) => x.phase === 'aqueous' && x.amount_mol > 1e-6 && !['H2O', 'H+', 'OH-'].includes(x.id)).map((x) => x.id).join(',');
  console.log(`salt ${name.padEnd(10)} ${note.padEnd(32)} species=[${sp}] solution(3cm)=${aq ? hex(colour(aq.absorbance_per_cm)) : '-'} maxA=${aq ? maxA(aq.absorbance_per_cm).toFixed(4) : '-'} solids=${s.solids.map((x) => x.species + hex(x.rgb)).join(',')} reason=${(r.reason || '').slice(0, 60)}`);
}

// --- 2. Imported coloured molecules: dye, I2, beta-carotene, bromine
const mols = [
  { id: 'pc_mb', name: 'Methylene blue', formula: 'C16H18ClN3S', smiles: 'CN(C)C1=CC2=C(C=C1)N=C3C=CC(=[N+](C)C)C=C3S2.[Cl-]', state: 'solid', color_linear_rgb: [0.05, 0.16, 0.56], solubility_g_per_l: 43.6 },
  { id: 'pc_i2', name: 'Iodine', formula: 'I2', smiles: 'II', state: 'solid', color_linear_rgb: [0.05, 0.02, 0.08], t_melt_ref_k: 386.85, vapor_pressure_points: [[457.6, 101325]], solubility_g_per_l: 0.33, density: 4.93 },
  { id: 'pc_br2', name: 'Bromine', formula: 'Br2', smiles: 'BrBr', state: 'liquid', color_linear_rgb: [0.35, 0.03, 0.01], t_melt_ref_k: 265.9, vapor_pressure_points: [[331.9, 101325]], density: 3.10 },
  { id: 'pc_hex', name: 'Hexane', formula: 'C6H14', smiles: 'CCCCCC', state: 'liquid', t_melt_ref_k: 178, vapor_pressure_points: [[341.9, 101325]], density: 0.655 },
  { id: 'pc_azo', name: 'Azobenzene', formula: 'C12H10N2', smiles: 'c1ccc(cc1)N=Nc1ccccc1', state: 'solid', color_linear_rgb: [0.79, 0.4, 0.02], t_melt_ref_k: 341, solubility_g_per_l: 0.0064 },
];
for (const m of mols) { const r = imp(m); console.log(`import ${m.name}: model=${r.phase_model} modelable=${r.modelable} room=${r.state_at_room} ${(r.reason || '').slice(0, 80)}`); }
{
  const h = vessel(); dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: 'pc_mb', mass_g: 0.01 }); step(h, 20);
  describe('Methylene blue 10 mg in 50 mL water (should be intense blue)', snap(h));
}
{
  const h = vessel(); dose(h, { reagent_id: 'water', volume_ml: 50 }); dose(h, { reagent_id: 'pc_i2', mass_g: 0.01 }); step(h, 40);
  describe('I2 10 mg in 50 mL water (should be yellow-brown)', snap(h));
}
{
  const h = vessel(); dose(h, { reagent_id: 'pc_hex', volume_ml: 30 }); dose(h, { reagent_id: 'pc_i2', mass_g: 0.01 }); step(h, 40);
  describe('I2 10 mg in 30 mL hexane (should be violet)', snap(h));
}
{
  const h = vessel(); dose(h, { reagent_id: 'water', volume_ml: 40 }); dose(h, { reagent_id: 'pc_hex', volume_ml: 20 }); dose(h, { reagent_id: 'pc_br2', volume_ml: 0.2 }); step(h, 20);
  describe('Water + hexane + 0.2 mL Br2 (Br2 should partition into hexane: orange top layer)', snap(h));
}
{
  const h = vessel(); dose(h, { reagent_id: 'pc_azo', mass_g: 0.2 }); step(h, 2);
  describe('Azobenzene dry solid', snap(h));
}

// --- 3. Catalog chemistry: Cu(NH3)4, CoCl4, indicators, starch-iodine
{
  const h = vessel(); dose(h, { reagent_id: 'cuso4_0_1m', volume_ml: 20 }); step(h, 2); describe('CuSO4 0.1 M 20 mL', snap(h));
  dose(h, { reagent_id: 'nh3_2m', volume_ml: 20 }); step(h, 10); describe('+ 2 M NH3 20 mL (deep blue expected)', snap(h));
}
{
  const h = vessel(); dose(h, { reagent_id: 'naoh_0_1m', volume_ml: 30 }); dose(h, { reagent_id: 'phenolphthalein_drop', drops: 3 }); step(h, 4);
  describe('NaOH + phenolphthalein (pink)', snap(h));
}

// --- 4. Precipitate appearance from the rules / table
const pp = [
  [['Cl2Ni', 'NiCl2'], ['HNaO', 'NaOH'], 'Ni(OH)2 green gel expected'],
  [['Cl2Zn', 'ZnCl2'], ['Na2S', 'Na2S'], 'ZnS white expected'],
  [['Cl2Ni', 'NiCl2'], ['Na3O4P', 'Na3PO4'], 'Ni3(PO4)2 (not tabulated) pale green expected'],
  [['Cl2Mn', 'MnCl2'], ['Na2S', 'Na2S'], 'MnS pink/salmon expected'],
  [['CuO4S', 'CuSO4'], ['IK', 'KI'], 'CuI white + I2 brown (redox) expected'],
  [['AgNO3', 'AgNO3'], ['HNaO', 'NaOH'], 'Ag2O brown expected'],
  [['Cl2Hg', 'HgCl2'], ['IK', 'KI'], 'HgI2 orange-red expected'],
  [['Cl3Fe', 'FeCl3'], ['C6FeK4N6', 'K4Fe(CN)6'], 'Prussian blue expected'],
];
for (const [[fa, na], [fb, nb], note] of pp) {
  imp({ id: `x_${na}`, name: na, formula: fa, state: 'liquid' });
  imp({ id: `x_${nb}`, name: nb, formula: fb, state: 'liquid' });
  const v = vessel();
  dose(v, { reagent_id: `x_${na}`, volume_ml: 25 });
  dose(v, { reagent_id: `x_${nb}`, volume_ml: 25 });
  step(v, 2);
  const s = snap(v);
  const aq = s.layers.find((l) => l.phase === 'aqueous');
  console.log(`ppt ${na}+${nb}: ${s.solids.map((x) => `${x.species} ${hex(x.rgb)} ${x.kind} d=${x.particle_diameter_um}`).join('; ') || 'none'} | sol=${aq ? hex(colour(aq.absorbance_per_cm)) : '-'} scat=${aq?.scatter_per_cm?.toFixed(2)} | ${note} | log: ${(s.events || []).map((e) => e.detail).join(' / ')}`);
  step(v, 120);
  const s2 = snap(v);
  console.log(`    after 60 s: ${s2.solids.map((x) => `${x.species} susp=${x.suspended_fraction.toFixed(2)}`).join('; ')}`);
}

// --- 5. Steam / vapour cues: water vs ethanol at 60 C and 76 C; sealed fumes
for (const [rid, tk] of [['water', 333.15], ['ethanol', 333.15], ['ethanol', 349.15], ['water', 349.15]]) {
  const h = eng.vessel_new(JSON.stringify({ ...cfg, temperature_k: tk }));
  dose(h, { reagent_id: rid, volume_ml: 50 });
  const s = snap(h);
  console.log(`vapour ${rid} @ ${(tk - 273.15).toFixed(0)} C: vapour_visibility=${s.vapour_visibility.toFixed(2)} condensation=${s.condensation.toFixed(2)} boil=${s.boil_intensity}`);
}
{
  const h = eng.vessel_new(JSON.stringify({ ...cfg, temperature_k: 340 }));
  dose(h, { reagent_id: 'pc_br2', volume_ml: 2 }); step(h, 10);
  describe('Neat Br2 at 67 C, open (red-brown vapour expected)', snap(h));
}

// --- 6. Flame: ethanol only
{
  const h = vessel(); dose(h, { reagent_id: 'ethanol', volume_ml: 10 }); eng.vessel_control(h, JSON.stringify({ igniter: true })); step(h, 4);
  describe('Ethanol ignited', snap(h));
}
{
  const h = vessel(); dose(h, { reagent_id: 'pc_hex', volume_ml: 10 }); eng.vessel_control(h, JSON.stringify({ igniter: true })); step(h, 4);
  describe('Hexane ignited (should burn, luminous)', snap(h));
}
{
  const h = vessel(); dose(h, { reagent_id: 'ethanol', volume_ml: 10 }); dose(h, { reagent_id: 'nacl_0_1m', volume_ml: 2 }); eng.vessel_control(h, JSON.stringify({ igniter: true })); step(h, 4);
  describe('Ethanol + NaCl ignited (Na yellow flame expected)', snap(h));
}
