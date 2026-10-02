import { readFileSync } from 'node:fs';
import path from 'node:path';
const dir = '/Users/carlliu/reaction-chamber/web/src/wasm/engine';
export const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
export const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 298.15, room_k: 298.15 };
export const vessel = (o = {}) => eng.vessel_new(JSON.stringify({ ...cfg, ...o }));
export const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
export const snap = (h) => J(eng.vessel_snapshot(h));
export const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
export const step = (h, n, dt = 0.5) => { for (let i = 0; i < n; i++) eng.step_all(JSON.stringify([h]), dt); };
export const ctl = (h, c) => eng.vessel_control(h, JSON.stringify(c));
export function summary(h, label) {
  const s = snap(h);
  const sp = s.species.filter((x) => (x.mol ?? x.amount_mol ?? 1) > 1e-9).map((x) => x.id);
  console.log(`--- ${label}`);
  console.log(`  T=${s.temperature_k.toFixed(1)} pH=${s.ph?.toFixed(2)} liq=${s.total_liquid_ml.toFixed(2)} massLost=${s.mass_lost_g.toFixed(4)}`);
  console.log(`  species: ${sp.join(', ')}`);
  console.log(`  solids: ${s.solids.map((x) => `${x.species}:${x.mass_g.toExponential(2)}g`).join(', ')}`);
  console.log(`  gas: ${s.gas_fluxes.map((g) => `${g.species}:${g.rate_ml_s.toExponential(2)}`).join(', ')}`);
  console.log(`  rxns: ${[...new Set(s.reactions.map((r) => r.id))].slice(0, 12).join(', ')}`);
  console.log(`  events: ${s.events.map((e) => e.detail).slice(-6).join(' | ')}`);
  console.log(`  conservation: ${JSON.stringify(s.conservation)}`);
  return s;
}
