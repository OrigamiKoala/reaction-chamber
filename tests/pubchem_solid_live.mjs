// LIVE smoke test (needs network; not part of CI): runs the real precipitate lookup against PubChem and prints what
// the engine would be sent. Run: node tests/pubchem_solid_live.mjs [PbI2 AgCl CuS ...]   (Node >= 22.6)
import { register } from 'node:module';

// The web sources import each other without extensions (Vite style): teach Node to resolve them to .ts.
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(spec, ctx, next) {
        try { return await next(spec, ctx); }
        catch (e) {
          if (/^\\.\\.?\\//.test(spec) && !/\\.[a-z]+$/.test(spec)) return next(spec + '.ts', ctx);
          throw e;
        }
      }`),
  import.meta.url,
);

const { fetchSolidDataWith } = await import('../web/src/pubchem/solid_fetch.ts');

// [formula, Hill formula, molar mass, cation, anion, n_c, n_a]
const KNOWN = {
  PbI2: ['I2Pb', 461.0, 'Pb2+', 'I-', 1, 2],
  AgCl: ['AgCl', 143.32, 'Ag+', 'Cl-', 1, 1],
  CuS: ['CuS', 95.61, 'Cu2+', 'S2-', 1, 1],
  BaSO4: ['BaO4S', 233.39, 'Ba2+', 'SO42-', 1, 1],
  CaCO3: ['CCaO3', 100.09, 'Ca2+', 'CO32-', 1, 1],
};

let queueAt = 0;
const getJson = async (url) => {
  // polite spacing (PubChem allows 5 req/s)
  const wait = Math.max(0, queueAt - Date.now());
  queueAt = Date.now() + wait + 220;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
};

const names = process.argv.slice(2);
for (const f of names.length ? names : ['PbI2', 'AgCl', 'CuS']) {
  const k = KNOWN[f];
  if (!k) {
    console.log(`${f}: unknown to this script (add it to KNOWN)`);
    continue;
  }
  const lookup = { solid_species: `${f}(s)`, formula: f, hill_formula: k[0], molar_mass: k[1], cation: k[2], anion: k[3], n_c: k[4], n_a: k[5], tier: 'speculative' };
  const res = await fetchSolidDataWith(lookup, getJson);
  console.log(f, '-> engine data:', JSON.stringify(res?.data, null, 1));
  const r = res?.record;
  if (r) console.log(f, '-> reagent record:', JSON.stringify({ ...r, smiles: r.smiles }));
  else console.log(f, '-> no reagent record');
}
