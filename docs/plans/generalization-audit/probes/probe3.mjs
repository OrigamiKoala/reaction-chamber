import { readFileSync } from 'node:fs';
import path from 'node:path';
const dir = '/Users/carlliu/reaction-chamber/web/src/wasm/engine';
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15 };
const srgb = (c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hex = (lin) => '#' + lin.map((c) => Math.round(srgb(c) * 255).toString(16).padStart(2, '0')).join('');
// dry-solid colour of imported salts, PubChem colour passed as white for all to see whether it is used
for (const [name, formula] of [['KMnO4','KMnO4'],['CuSO4','CuO4S'],['NiCl2','Cl2Ni'],['CoCl2','Cl2Co'],['K2Cr2O7','Cr2K2O7'],['FeCl3','Cl3Fe'],['K3Fe(CN)6','C6FeK3N6'],['KI','IK'],['NaI','INa'],['CuCl2','Cl2Cu'],['CrCl3','Cl3Cr'],['Na2S','Na2S']]) {
  const r = J(eng.import_compound(JSON.stringify({ id: 'd_'+name, name, formula, state: 'solid', color_linear_rgb: [0.9,0.9,0.9], density: 2.0 })));
  const h = eng.vessel_new(JSON.stringify(cfg));
  eng.vessel_dose(h, JSON.stringify({ reagent_id: 'd_'+name, mass_g: 1 }));
  const s = J(eng.vessel_snapshot(h));
  console.log(name.padEnd(10), r.phase_model, s.solids.map(x=>`${x.species} ${hex(x.rgb)} ${x.kind} rho=${(x.mass_g/(x.settled_volume_ml/1.6)).toFixed(2)}`).join('; '));
}
