import { vessel, dose, snap } from './lib.mjs';
const h = vessel(); dose(h, { reagent_id: 'hcl_0_1m', volume_ml: 10 });
const s = snap(h); console.log(Object.keys(s.species[0]), s.species[0], Object.keys(s.reactions[0] ?? {}));
