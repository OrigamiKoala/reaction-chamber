// Checks for the PubChem solubility / Ksp / appearance text parsers. Run: node tests/solubility_parser.mjs   (Node >= 22.6 strips TS types)
import assert from 'node:assert/strict';
import * as P from '../web/src/pubchem/solubility_parser.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const rel = (a, b, tol = 0.02, msg = '') => assert.ok(a !== undefined && Math.abs(a - b) <= tol * Math.abs(b), `${msg} ${a} vs ${b}`);
const sol = (texts, mm) => P.parseWaterSolubilityGPerL(texts, mm);

ok('real PubChem phrasings (g/L)', () => {
  rel(sol(['White solid; Darkened by light; Water solubility = 1.93 mg/L at 25 deg C; [Merck Index] Powder with lumps']), 1.93e-3);
  rel(sol(['Bright yellow solid; [Merck Index] Slightly soluble in water(630 mg/L at 20 deg C); [ATSDR ToxProfiles]']), 0.63);
  rel(sol(['Water (g/100 cu cm) 0.076 at 20 °C']), 0.76);
  rel(sol(['0.000033 G/100 CC WATER @ 18 °C.']), 3.3e-4);
  rel(sol(['In water, 1.9X10-3 g/L at 25 °C']), 1.9e-3);
  rel(sol(['Solubility in water: 0.0019 g/100 mL']), 0.019);
});

ok('other units and exponent styles', () => {
  rel(sol(['Solubility in water: 1.5e-3 mol/L'], 100), 0.15);
  rel(sol(['1.5e-3 mol/L'], 100), 0.15);
  rel(sol(['Solubility in water 2 mmol/L'], 50), 0.1);
  rel(sol(['Solubility in water: 0.01 M'], 100), 1);
  rel(sol(['Solubility in water: 5 mg/100 mL']), 0.05);
  rel(sol(['Solubility in water: 0.2 g/100 g water at 20 °C']), 2);
  rel(sol(['Water solubility: 12 ppm']), 0.012);
  rel(sol(['In water, 4 x 10^-5 g/L at 25 °C']), 4e-5);
  rel(sol(['In water, 4 × 10⁻⁵ g/L at 25 °C']), 4e-5);
  rel(sol(['In water, 4.0 x 10-5 g/L at 25 °C']), 4e-5);
  rel(sol(['Solubility in water, g/100ml at 20 °C: 0.07 (very poor)']), 0.7);
  rel(sol(['Solubility in water: 36 g/100 mL']), 360);
  assert.equal(sol(['Solubility in water: 1.5e-3 mol/L']), undefined); // molar unit without molar mass
});

ok('only water counts', () => {
  assert.equal(sol(['Soluble in ethanol, 12 g/L at 25 °C']), undefined);
  assert.equal(sol(['In ethanol: 3 g/100 mL; in acetone 5 g/100 mL']), undefined);
  assert.equal(sol(['Sol in concd solns of alkali iodides; freely sol in soln of sodium thiosulfate; sol in 200 parts cold, 90 parts hot aniline; insol in alcohol or cold HCl.']), undefined);
  rel(sol(['In ethanol, 3 g/100 mL; In water, 0.5 g/100 mL']), 5);
  rel(sol(['Water: 0.2 g/100 mL; ethanol: 5 g/100 mL']), 2);
  assert.equal(sol(['Insoluble in water']), undefined);
  assert.equal(sol([]), undefined);
});

ok('prefers entries near 25 C and takes a median', () => {
  rel(sol(['In water, 1 g/L at 0 °C', 'In water, 5 g/L at 25 °C', 'In water, 20 g/L at 80 °C']), 5);
  rel(sol(['In water, 1 g/L at 20 °C', 'In water, 3 g/L at 25 °C', 'In water, 9 g/L at 30 °C']), 3);
  // untouched by citation brackets and sentence splitting
  rel(sol(['Solubility in water: 2 g/L [CRC] Soluble in ethanol, 50 g/L']), 2);
});

ok('Ksp', () => {
  rel(P.parseKsp(['Ksp = 1.8X10-10']), Math.log10(1.8e-10), 0.001);
  rel(P.parseKsp(['Ksp: 4.4e-9']), Math.log10(4.4e-9), 0.001);
  rel(P.parseKsp(['solubility product 1.77 x 10^-10']), Math.log10(1.77e-10), 0.001);
  rel(P.parseKsp(['The solubility product constant is 8.5 × 10⁻¹⁷ at 25 °C']), Math.log10(8.5e-17), 0.001);
  rel(P.parseKsp(['Ksp (25 °C) = 3.2e-8']), Math.log10(3.2e-8), 0.001);
  rel(P.parseKsp(['pKsp 9.75']), -9.75, 0.001);
  rel(P.parseKsp(['pKsp = 12.3', 'Ksp = 5e-13']), (-12.3 + Math.log10(5e-13)) / 2, 0.001);
  assert.equal(P.parseKsp(['pKa = 4.76; Ka = 1.8e-5']), undefined);
  assert.equal(P.parseKsp(['Water solubility = 1.93 mg/L']), undefined);
});

ok('qualitative solubility', () => {
  const q = P.parseQualitativeSolubility;
  assert.equal(q(['Insoluble in water and denser than water.']), 'practically_insoluble');
  assert.equal(q(['Practically insoluble in water']), 'practically_insoluble');
  assert.equal(q(['Virtually insoluble in water, but soluble in alkali cyanides and in aqueous ammonia solution']), 'practically_insoluble');
  assert.equal(q(['Slightly soluble in water(630 mg/L at 20 deg C)']), 'slightly_soluble');
  assert.equal(q(['Sparingly soluble in water']), 'sparingly_soluble');
  assert.equal(q(['Very slightly soluble in water']), 'very_slightly_soluble');
  assert.equal(q(['Freely soluble in water']), 'freely_soluble');
  assert.equal(q(['Very soluble in water, soluble in ethanol']), 'very_soluble');
  assert.equal(q(['Soluble in water']), 'soluble');
  assert.equal(q(['Sol in water; insol in alcohol']), 'soluble');
  assert.equal(q(['Chloride salts of silver are insoluble']), 'practically_insoluble');
  assert.equal(q(['Decomposes in water']), undefined);
  assert.equal(q(['Reacts with water to give HF']), undefined);
  assert.equal(q(['Soluble in potassium iodide and concentrated sodium acetate solutions']), undefined);
  assert.equal(q(['Insoluble in alcohol, soluble in water']), 'soluble');
  assert.equal(q(['Silver chloride is insoluble in dilute acids']), undefined);
  assert.equal(q(['Bright yellow solid']), undefined);
});

ok('solid kind', () => {
  assert.equal(P.parseSolidKind(['Gelatinous precipitate']), 'gel');
  assert.equal(P.parseSolidKind(['Amorphous white solid']), 'gel');
  assert.equal(P.parseSolidKind(['White curdy precipitate']), 'curds');
  assert.equal(P.parseSolidKind(['Yellow hexagonal crystals']), 'crystal');
  assert.equal(P.parseSolidKind(['White crystalline or amorphous, odourless and tasteless powder']), 'crystal');
  assert.equal(P.parseSolidKind(['Amorphous brown powder']), 'powder');
  assert.equal(P.parseSolidKind(['Black powder or lumps']), 'powder');
  assert.equal(P.parseSolidKind([]), 'powder');
});

ok('density', () => {
  rel(P.parseSolidDensity(['6.16 at 68 °F (USCG, 1999) - Denser than water; will sink', '6.16 g/cu cm', '6.16 @25 °C']), 6.16);
  rel(P.parseSolidDensity(['5.56 @25 °C']), 5.56);
  rel(P.parseSolidDensity(['4.76', '4.6 @25 °C']), 4.6);
  rel(P.parseSolidDensity(['Density: 2.17 g/cm3']), 2.17);
  rel(P.parseSolidDensity(['5560 kg/m3']), 5.56);
  assert.equal(P.parseSolidDensity(['Denser than water']), undefined);
});

ok('sRGB hex -> linear', () => {
  assert.deepEqual(P.srgbHexToLinear('#000000'), [0, 0, 0]);
  const w = P.srgbHexToLinear('#ffffff');
  for (const c of w) rel(c, 1, 1e-9);
  const g = P.srgbHexToLinear('#808080');
  for (const c of g) rel(c, 0.2158, 0.002);
  const [r, gg, b] = P.srgbHexToLinear('#ff0000');
  rel(r, 1, 1e-9);
  assert.equal(gg, 0);
  assert.equal(b, 0);
});

console.log(`solubility_parser: ${n} groups passed`);
