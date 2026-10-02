import { eng, J, vessel, dose, step, snap } from './lib.mjs';
const cat = J(eng.reagent_catalog_json());
const ids = cat.map((c) => c.id);
const legit = /^(HIn_|In_|starch)/;
let pairs = 0, junkPairs = [];
const junkIds = new Map();
for (let i = 0; i < ids.length; i++) for (let j = i; j < ids.length; j++) {
  const h = vessel();
  for (const id of [ids[i], ids[j]]) {
    const c = cat.find((x) => x.id === id);
    dose(h, c.by_mass ? { reagent_id: id, mass_g: 0.5 } : { reagent_id: id, volume_ml: 10 });
  }
  step(h, 10);
  const s = snap(h);
  const junk = s.species.filter((x) => x.id.includes('_') && !legit.test(x.id)).map((x) => x.id);
  pairs++;
  if (junk.length) { junkPairs.push(`${ids[i]} + ${ids[j]}: ${junk.join(',')}`); junk.forEach((k) => junkIds.set(k, (junkIds.get(k) || 0) + 1)); }
  eng.vessel_free(h);
}
console.log(`catalog reagents: ${ids.length}; pairs: ${pairs}; pairs with formula-less generated species: ${junkPairs.length}`);
console.log([...junkIds.entries()].map(([k, v]) => `${k}(${v})`).join(', '));
console.log(junkPairs.slice(0, 12).join('\n'));
