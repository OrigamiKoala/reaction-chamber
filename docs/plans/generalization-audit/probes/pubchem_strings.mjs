// Probe: raw PUG View strings behind suspicious parsed values.
import { collectPugViewStrings } from './pc.mjs';
const want = { 2244: ['Boiling Point'], 5793: ['Boiling Point','Melting Point'], 243: ['Heat of Vaporization','Enthalpy of Vaporization'], 2519: ['Boiling Point'] };
for (const [cid, heads] of Object.entries(want)) {
  const v = await (await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON`)).json();
  const s = collectPugViewStrings(v, heads);
  console.log(cid, JSON.stringify(s));
  await new Promise((r) => setTimeout(r, 300));
}
