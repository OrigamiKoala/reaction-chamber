// Probe: run the real record_builder on live PubChem data for a few compounds; shows mp/bp/known flags and parsed strings.
import { buildSpeciesRecord, PUG_PROPERTIES, collectPugViewStrings, parseTemperatureString } from './pc.mjs';
const names = (process.argv[2] || 'aspirin,caffeine,benzoic acid,naphthalene,ethyl acetate,dimethyl ether,acetone,glucose,sodium fluoride').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const n of names) {
  const p = await (await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(n)}/property/${PUG_PROPERTIES}/JSON`)).json();
  const prop = p?.PropertyTable?.Properties?.[0]; await sleep(250);
  const view = await (await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${prop.CID}/JSON`)).json(); await sleep(250);
  const rec = buildSpeciesRecord(prop, view, undefined, n);
  const s = collectPugViewStrings(view, ['Melting Point', 'Boiling Point']);
  const mpParsed = (s['Melting Point'] ?? []).map((t) => [t.slice(0, 40), parseTemperatureString(t)?.value]);
  const bad = mpParsed.filter(([t, v]) => /\d\s*-\s*\d/.test(t) && v !== undefined && v < 0);
  console.log(JSON.stringify({ n, cid: prop.CID, formula: rec.formula, mp_c: rec.mp_c, bp_c: rec.bp_c, density: rec.density, known: rec.known,
    phys: rec.physical && Object.fromEntries(Object.entries(rec.physical).map(([k, v]) => [k, Array.isArray(v) ? `${v.length} pts` : v])), nMpStrings: mpParsed.length, rangeMisparsed: bad }));
}
