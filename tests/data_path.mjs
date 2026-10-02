// Stage 0.12 data-path checks: bundle never overrides PubChem or sets `known`, sodium fluoride keeps PubChem's 993 C,
// Antoine sampling stays inside its range and below 1e8 Pa, identity matching by InChIKey, session auth header.
// Run: node tests/data_path.mjs   (Node >= 22.6)
import { register } from 'node:module';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const { buildSpeciesRecord } = await import('../web/src/pubchem/record_builder.ts');
const { sampleAntoine, MAX_SAMPLED_VP_PA } = await import('../web/src/pubchem/api.ts');
const { effectiveThermo } = await import('../web/src/pubchem/parser.ts');
const { connectivityBlock } = await import('../web/src/pubchem/identity.ts');
const { authHeaders, setSessionToken } = await import('../web/src/pubchem/session.ts');

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};

/** A minimal PUG View record with the given strings under each TOC heading. */
const view = (sections) => ({
  Record: {
    Section: Object.entries(sections).map(([h, strings]) => ({
      TOCHeading: h,
      Information: strings.map((s) => ({ Value: { StringWithMarkup: [{ String: s }] } })),
    })),
  },
});

// the old synthetic bundle entry for sodium fluoride: mp 542 C, made-up density, labelled tabulated
const syntheticNaF = {
  inchi_key: 'PUZPDOWCWNUUKD-UHFFFAOYSA-M', cid: 5235, name: 'Sodium fluoride', formula: 'FNa', smiles: '[F-].[Na+]', charge: 0, mw: 41.99,
  mp_c: 542, bp_c: 1300, density: 2.5, solubility: 'soluble', ghs: [], tier: 'tabulated', source: 'PHREEQC_Inorganic_Matrix',
};
const naFProp = { CID: 5235, Title: 'Sodium fluoride', MolecularFormula: 'FNa', MolecularWeight: '41.99', CanonicalSMILES: '[F-].[Na+]', InChIKey: 'PUZPDOWCWNUUKD-UHFFFAOYSA-M', Charge: 0 };
const naFView = view({ 'Melting Point': ['993 °C', '1,832 °F (NTP, 1992)'], 'Boiling Point': ['1,695 °C'], Density: ['2.78 g/cm3'] });

ok('importing sodium fluoride gives mp = 993 C from PubChem, not the bundle 542', () => {
  const rec = buildSpeciesRecord(naFProp, naFView, syntheticNaF, 'sodium fluoride');
  // PubChem lists 993 C and 1,832 F (= 1000 C): the median is 996.5 C. The bundle's fabricated value was 542 C.
  assert.ok(Math.abs(rec.mp_c - 993) < 10, `mp ${rec.mp_c}`);
  assert.equal(rec.known.mp_c, true);
  assert.equal(rec.bp_c, 1695);
  assert.equal(rec.density, 2.78);
  assert.equal(rec.tier, 'imported', 'a PubChem record is imported, not tabulated');
  // same with no bundle at all
  assert.ok(Math.abs(buildSpeciesRecord(naFProp, naFView, undefined, 'x').mp_c - 993) < 10);
});

ok('a bundle value never becomes `known` and never reaches the engine', () => {
  const rec = buildSpeciesRecord(naFProp, view({}), syntheticNaF, 'sodium fluoride');
  assert.equal(rec.mp_c, 542, 'shown as a display fallback');
  assert.equal(rec.known.mp_c, false);
  assert.equal(rec.known.bp_c, false);
  assert.equal(rec.known.density, false);
  const eff = effectiveThermo({ sourcedProperties: { mp_c: rec.mp_c, bp_c: rec.bp_c, density: rec.density, known: rec.known } });
  assert.deepEqual(eff, { mp_c: undefined, bp_c: undefined, density: undefined });
  // the bundle still fills hazards and the state hint when PubChem has none
  const hazardous = { ...syntheticNaF, ghs: ['H301'] };
  assert.deepEqual(buildSpeciesRecord(naFProp, view({}), hazardous, 'x').ghs, ['H301']);
});

ok('glucose: PubChem text decides (146 C), the monohydrate string is ignored', () => {
  const prop = { CID: 5793, Title: 'Glucose', MolecularFormula: 'C6H12O6', MolecularWeight: '180.16', CanonicalSMILES: 'C(C1C(C(C(C(O1)O)O)O)O)O', InChIKey: 'WQZGKKKJIJFFOK-GASJEMHNSA-N', Charge: 0 };
  const v = view({
    'Melting Point': ['less than 32 °F (USCG, 1999)', '146 °C', 'Crystals from water, MP: 83 °C; ... at 25 °C/D. /alpha-Glucose, monohydrate/', '146 °C'],
    'Boiling Point': ['greater than 212 °F at 760 mmHg (USCG, 1999)'],
    Density: ['Relative density (water = 1): 1.54'],
  });
  const rec = buildSpeciesRecord(prop, v, undefined, 'glucose');
  assert.equal(rec.mp_c, 146);
  assert.equal(rec.known.mp_c, true);
  assert.equal(rec.known.bp_c, false, '"greater than 212 F" is a bound, not a boiling point');
  assert.equal(rec.density, 1.54);
  assert.equal(rec.known.density, true);
});

ok('aspirin and caffeine: decomposition / sublimation points are not boiling points', () => {
  const asp = buildSpeciesRecord({ CID: 2244, Title: 'Aspirin', MolecularFormula: 'C9H8O4', MolecularWeight: '180.16', InChIKey: 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N' },
    view({ 'Melting Point': ['275 °F (NTP, 1992)', '135 °C'], 'Boiling Point': ['284 °F at 760 mmHg (decomposes) (NTP, 1992)', '284 °F (decomposes)'] }), undefined, 'aspirin');
  assert.equal(asp.known.bp_c, false);
  assert.equal(asp.known.mp_c, true);
  const caf = buildSpeciesRecord({ CID: 2519, Title: 'Caffeine', MolecularFormula: 'C8H10N4O2', MolecularWeight: '194.19', InChIKey: 'RYYVLZVUVIJVGH-UHFFFAOYSA-N' },
    view({ 'Boiling Point': ['352 °F at 760 mmHg (sublimes) (NTP, 1992)', '178 °C (sublimes)'] }), undefined, 'caffeine');
  assert.equal(caf.known.bp_c, false);
});

ok('benzoic acid: heat of vaporisation 425 kJ/mol fails Trouton and is not used; the rejection is recorded', () => {
  const rec = buildSpeciesRecord({ CID: 243, Title: 'Benzoic acid', MolecularFormula: 'C7H6O2', MolecularWeight: '122.12', InChIKey: 'WPYMKLBDIGXBTP-UHFFFAOYSA-N' },
    view({ 'Boiling Point': ['480 °F at 760 mmHg (NTP, 1992)', '249 °C'], 'Heat of Vaporization': ['534 KJ/mol at 140 °C, 425 Kj/mol at 249 °C'] }), undefined, 'benzoic acid');
  assert.equal(rec.known.bp_c, true);
  assert.equal(rec.physical?.dh_vap_kj_mol, undefined);
  assert.ok(rec.physical?.rejected?.some((r) => /Trouton/.test(r)), JSON.stringify(rec.physical));
});

ok('Antoine blocks are sampled only inside their stated range and below 1e8 Pa', () => {
  // ethanol, NIST: log10(P/bar) = 5.24677 - 1598.673 / (T - 46.424), 292.77-366.63 K  ->  ln(P/Pa) form
  const a_pa = Math.log(10) * (5.24677 + 5);
  const b_pa = Math.log(10) * 1598.673;
  const pts = sampleAntoine([{ a_pa, b_pa, c_pa: -46.424, t_min_k: 292.77, t_max_k: 366.63 }]);
  assert.equal(pts.length, 6);
  assert.ok(pts.every(([t, p]) => t >= 292.77 - 1e-9 && t <= 366.63 + 1e-9 && p > 1000 && p < 3e5));
  // ethanol at the top of the range (366.63 K, 15 K above its boiling point): about 1.77 atm
  assert.ok(Math.abs(pts[5][1] / 101325 - 1.77) < 0.1, `top of range: ${pts[5][1]}`);
  // the dHvap correlation block read as Antoine (A=54.26, B=0.2982, C=523.2): ln P = 136.45 - 0.69 / (T + 523.2) ~ 1e59 Pa
  const bogus = sampleAntoine([{ a_pa: 136.45119, b_pa: 0.6866, c_pa: 523.2, t_min_k: 298, t_max_k: 363 }]);
  assert.deepEqual(bogus, []);
  // no stated range: nothing is invented (the old code sampled 273-373 K)
  assert.deepEqual(sampleAntoine([{ a_pa, b_pa, c_pa: -46.424 }]), []);
  assert.equal(MAX_SAMPLED_VP_PA, 1e8);
});

ok('identity: InChIKey connectivity block, formula only as a fallback', () => {
  assert.equal(connectivityBlock('LFQSCWFLJHTTHZ-UHFFFAOYSA-N'), 'LFQSCWFLJHTTHZ');
  assert.equal(connectivityBlock('lfqscwfljhtthz-uhfffaoysa-n'), 'LFQSCWFLJHTTHZ');
  assert.equal(connectivityBlock(''), '');
  assert.equal(connectivityBlock('local-aspirin'), '');
  // ethanol and dimethyl ether share a formula but not an identity
  assert.notEqual(connectivityBlock('LFQSCWFLJHTTHZ-UHFFFAOYSA-N'), connectivityBlock('LCGLNKUTAGEVQW-UHFFFAOYSA-N'));
});

ok('local-server requests carry the session token', () => {
  setSessionToken('');
  assert.deepEqual(authHeaders(), {});
  setSessionToken('abc');
  assert.deepEqual(authHeaders(), { Authorization: 'Bearer abc' });
});

ok('the shipped bundle holds no synthetic entries and no sodium fluoride stand-in', () => {
  const bundle = JSON.parse(readFileSync(new URL('../web/public/data/bundle.json', import.meta.url), 'utf8'));
  const all = Object.values(bundle.species);
  assert.ok(all.length >= 60);
  assert.ok(all.every((s) => !/^(Salt_|Ester_|AminoAcid_|Alkane_)/.test(s.formula)), 'synthetic formula token');
  assert.ok(all.every((s) => !['PHREEQC_Inorganic_Matrix', 'Joback_Additivity', 'CRC_Amino_Acids'].includes(s.source)));
  const naf = all.find((s) => s.name === 'Sodium fluoride');
  assert.equal(naf, undefined, 'the fabricated mp-542 C sodium fluoride must be gone');
});

console.log(`${n} groups passed`);
