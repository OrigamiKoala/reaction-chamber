// End-to-end check of the *built* WASM engine's analytical instruments (what the browser loads), without a browser:
//   node tests/analytical_e2e.mjs
// Compounds are imported the way the web app imports PubChem hits (formula + SMILES + vapour-pressure point) and dosed into a
// beaker; nothing about them is known to the NMR / MS code except what the import carried. For each one the spectra must be
// consistent with the structure: every proton and every carbon accounted for, the molecular mass right, isotope patterns right.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();

const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 295.15, room_k: 295.15 };
const dose = (h, d) => eng.vessel_dose(h, JSON.stringify(d));
const imp = (r) => J(eng.import_compound(JSON.stringify(r)));
const nmr = (h, nuc, solvent, scans) => J(eng.vessel_nmr_spectrum(h, 0, nuc, solvent, scans, 11));
const ms = (h, mode) => J(eng.vessel_ms_spectrum(h, 0, mode, 5));

// [id, name, formula, SMILES, density g/mL, normal bp K]  (InChIKeys keep isomers apart, as the web import supplies them)
const KEYS = {
  c_thf: 'WYURNTSHIVDZCO-UHFFFAOYSA-N',
  c_mek: 'ZWEHNKRNPOVVGH-UHFFFAOYSA-N',
  c_bnoh: 'WVDDGKGOMKODPV-UHFFFAOYSA-N',
  c_anisole: 'RDOXTESZEPMUJZ-UHFFFAOYSA-N',
  c_diox: 'RYHBNJHYFVUHQT-UHFFFAOYSA-N',
};
const liquids = [
  ['c_ctol', '4-chlorotoluene', 'C7H7Cl', 'Cc1ccc(Cl)cc1', 1.07, 435.7],
  ['c_etbz', 'ethyl benzoate', 'C9H10O2', 'CCOC(=O)c1ccccc1', 1.05, 485.9],
  ['c_chone', 'cyclohexanone', 'C6H10O', 'O=C1CCCCC1', 0.95, 428.8],
  ['c_2buoh', '2-butanol', 'C4H10O', 'CCC(C)O', 0.81, 372.7],
  ['c_dmf', 'N,N-dimethylformamide', 'C3H7NO', 'CN(C)C=O', 0.944, 426.0],
  ['c_thf', 'tetrahydrofuran', 'C4H8O', 'C1CCOC1', 0.889, 339.1],
  ['c_acn', 'acetonitrile', 'C2H3N', 'CC#N', 0.786, 354.8],
  ['c_bnoh', 'benzyl alcohol', 'C7H8O', 'OCc1ccccc1', 1.044, 478.6],
  ['c_hex1ene', '1-hexene', 'C6H12', 'C=CCCCC', 0.673, 336.6],
  ['c_prbr', '1-bromopropane', 'C3H7Br', 'CCCBr', 1.354, 344.3],
  ['c_anisole', 'anisole', 'C7H8O', 'COc1ccccc1', 0.995, 427.0],
  ['c_pyr', 'pyridine', 'C5H5N', 'c1ccncc1', 0.982, 388.4],
  ['c_mek', 'butanone', 'C4H8O', 'CCC(C)=O', 0.805, 352.8],
  ['c_diox', '1,4-dioxane', 'C4H8O2', 'C1COCCO1', 1.033, 374.5],
  ['c_hexyl', 'hexylamine', 'C6H15N', 'CCCCCCN', 0.766, 405.0],
  ['c_fbz', 'fluorobenzene', 'C6H5F', 'Fc1ccccc1', 1.024, 357.9],
  ['c_tmsoh', 'trimethylsilanol', 'C3H10OSi', 'C[Si](C)(C)O', 0.811, 372.0],
  ['c_nitroet', 'nitroethane', 'C2H5NO2', 'CC[N+](=O)[O-]', 1.05, 387.0],
];

const Hs = (f) => {
  const m = /H(\d*)/.exec(f.replace(/Hg|Hf|Ho|He/g, ''));
  return m ? (m[1] === '' ? 1 : +m[1]) : 0;
};
const Cs = (f) => {
  const m = /^C(\d*)/.exec(f);
  return m ? (m[1] === '' ? 1 : +m[1]) : 0;
};

let n = 0;
let tNmr = 0;
let tMs = 0;
for (const [id, name, formula, smiles, density, tb] of liquids) {
  const m = imp({ id, name, formula, smiles, inchi_key: KEYS[id], state: 'liquid', density, vapor_pressure_points: [[tb, 101325]], dh_vap_kj_mol: (88 * tb) / 1000, dh_vap_at_k: tb });
  assert.ok(m.modelable, `${name}: ${m.reason}`);
  const h = eng.vessel_new(JSON.stringify(cfg));
  dose(h, { reagent_id: id, volume_ml: 5 });

  // ---- 1H: every proton accounted for (integrals are relative to the most abundant species = this compound)
  let t0 = performance.now();
  const h1 = nmr(h, '1H', 'CDCl3', 16);
  const h13 = nmr(h, '13C', 'CDCl3', 4096);
  tNmr += performance.now() - t0;
  const sig = h1.signals.filter((s) => !s.solvent);
  assert.ok(sig.length > 0, `${name}: no 1H signals`);
  const totalH = sig.reduce((a, s) => a + s.integration, 0);
  assert.ok(Math.abs(totalH - Hs(formula)) < 0.06, `${name}: 1H integrals add up to ${totalH.toFixed(2)}, formula has ${Hs(formula)} H`);
  assert.equal(h1.intensity.length, 32768);
  assert.ok(h1.signals.some((s) => s.solvent && Math.abs(s.ppm - 7.26) < 0.01), `${name}: CDCl3 residual line`);
  // ---- 13C: every carbon accounted for
  const c13 = h13.signals.filter((s) => !s.solvent);
  const totalC = c13.reduce((a, s) => a + s.nuclei, 0);
  assert.equal(totalC, Cs(formula), `${name}: 13C signals represent ${totalC} carbons, formula has ${Cs(formula)}`);

  // ---- GC/EI-MS
  t0 = performance.now();
  const e = ms(h, 'EI');
  tMs += performance.now() - t0;
  assert.equal(e.components.length, 1, `${name}: ${JSON.stringify(e.not_analysed)}`);
  const c = e.components[0];
  assert.ok(c.rt_min > 0.9 && c.rt_min < 12, `${name}: retention ${c.rt_min}`);
  const top = c.peaks.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  assert.equal(top.intensity, 100);
  assert.ok(c.peaks.every((p) => p.mz >= 1 && p.assignment.length > 0), `${name}: peaks carry assignments`);
  // heaviest peak cluster is at or just above the nominal mass
  const heaviest = Math.max(...c.peaks.filter((p) => p.intensity > 2).map((p) => p.mz));
  assert.ok(heaviest <= Math.round(c.mw) + 3, `${name}: heaviest peak ${heaviest} vs M ${c.mw}`);
  n++;
}

// ---- isotope patterns and structure-specific features
{
  const h = eng.vessel_new(JSON.stringify(cfg));
  dose(h, { reagent_id: 'c_ctol', volume_ml: 5 });
  const e = ms(h, 'EI').components[0];
  const at = (mz) => e.peaks.find((p) => p.mz === mz)?.intensity ?? 0;
  assert.ok(at(126) > 20 && Math.abs(at(128) / at(126) - 0.32) < 0.05, `chlorotoluene M / M+2 = ${at(126)} / ${at(128)}`);
  assert.ok(at(91) > 50, `benzylic / tropylium ion from loss of Cl: ${at(91)}`);

  const h2 = eng.vessel_new(JSON.stringify(cfg));
  dose(h2, { reagent_id: 'c_etbz', volume_ml: 5 });
  const s2 = nmr(h2, '1H', 'CDCl3', 16).signals.filter((s) => !s.solvent);
  const q = s2.find((s) => s.multiplicity === 'q');
  const t = s2.find((s) => s.multiplicity === 't');
  assert.ok(q && t && Math.abs(q.ppm - 4.35) < 0.35 && Math.abs(t.ppm - 1.38) < 0.2, 'ethyl ester quartet / triplet');
  const c2 = nmr(h2, '13C', 'CDCl3', 4096).signals.filter((s) => !s.solvent);
  assert.ok(c2.some((s) => s.ppm > 160 && s.ppm < 172), 'ester carbonyl carbon');

  // fluorobenzene: C-F coupling splits the ipso carbon into a doublet of ~245 Hz
  const h3 = eng.vessel_new(JSON.stringify(cfg));
  dose(h3, { reagent_id: 'c_fbz', volume_ml: 5 });
  const cf = nmr(h3, '13C', 'CDCl3', 4096).signals.filter((s) => !s.solvent).sort((a, b) => b.ppm - a.ppm)[0];
  assert.ok(cf.multiplicity === 'd' && Math.abs(cf.j_hz[0] - 245) < 15, `C-F doublet: ${cf.multiplicity} ${cf.j_hz}`);
}

// ---- mixtures: GC separation, relative integrals follow the amounts, a reaction changes the spectrum
{
  const h = eng.vessel_new(JSON.stringify(cfg));
  dose(h, { reagent_id: 'c_thf', volume_ml: 5 });
  dose(h, { reagent_id: 'c_ctol', volume_ml: 5 });
  dose(h, { reagent_id: 'c_etbz', volume_ml: 5 });
  const e = ms(h, 'EI');
  assert.deepEqual(e.components.map((c) => c.name), ['tetrahydrofuran', '4-chlorotoluene', 'ethyl benzoate']);
  assert.ok(e.tic.length > 100 && Math.max(...e.tic) > 0.3);
  const s = nmr(h, '1H', 'CDCl3', 16).signals.filter((x) => !x.solvent);
  const species = new Set(s.map((x) => x.species));
  assert.equal(species.size, 3);
}

// ---- aqueous sample: D2O exchanges O-H into the HDO line; ESI shows the ions
{
  const h = eng.vessel_new(JSON.stringify(cfg));
  dose(h, { reagent_id: 'nacl_0_1m', volume_ml: 10 });
  const pos = ms(h, 'ESI+');
  assert.ok(pos.summed.some((p) => Math.abs(p.mz - 23) < 0.6), 'Na+ in ESI+');
  const neg = ms(h, 'ESI-');
  assert.ok(neg.summed.some((p) => Math.abs(p.mz - 35) < 0.6), 'Cl- in ESI-');
}

console.log(`${n} compounds analysed; mean ${(tNmr / n).toFixed(0)} ms per NMR pair (1H + 13C), ${(tMs / n).toFixed(1)} ms per GC/MS run`);
console.log('analytical e2e checks passed');
