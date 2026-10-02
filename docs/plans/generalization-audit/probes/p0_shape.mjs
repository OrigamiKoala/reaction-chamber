import { eng, vessel, dose, snap, step, J } from './common.mjs';
const h = vessel();
dose(h, { reagent_id: 'h2o2_3pct', volume_ml: 50 });
const s = snap(h);
console.log(JSON.stringify(s.species[0]), JSON.stringify(s.conservation));
console.log(J(eng.reagent_catalog_json()).map?.((r) => r.id).join(' ') ?? Object.keys(J(eng.reagent_catalog_json())).join(' '));
