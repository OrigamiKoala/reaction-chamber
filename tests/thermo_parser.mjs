// Checks for the PubChem thermodynamics parsers (heats, vapour-pressure points, reduced-pressure boiling points) and the
// derived-phase helpers. Run: node tests/thermo_parser.mjs   (Node >= 22.6 strips TS types)
import assert from 'node:assert/strict';
import * as T from '../web/src/pubchem/thermo_parser.ts';
import * as P from '../web/src/pubchem/parser.ts';

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log('  ok', name);
};
const rel = (a, b, tol = 0.01, msg = '') => assert.ok(a !== undefined && Math.abs(a - b) <= tol * Math.abs(b), `${msg} ${a} vs ${b}`);

ok('heat of fusion / vaporization: molar units', () => {
  rel(T.parseHeatOfFusionKJMol(['6.01 kJ/mol']), 6.01);
  rel(T.parseHeatOfFusionKJMol(['6009 J/mol at 0 °C']), 6.009);
  rel(T.parseHeatOfFusionKJMol(['1.43 kcal/mol']), 5.983, 0.002);
  rel(T.parseHeatOfFusionKJMol(['1430 cal/mol']), 5.983, 0.002);
  rel(T.parseHeatOfFusionKJMol(['6010 kJ/kmol']), 6.01);
  rel(T.parseHeatOfFusionKJMol(['6010 kJ/kg mol']), 6.01);
  rel(T.parseHeatOfFusionKJMol(['Heat of fusion [Merck Index]: 6.01 kJ/mole']), 6.01);
});

ok('per-mass units need the molar mass', () => {
  rel(T.parseHeatOfFusionKJMol(['333.55 J/g'], 18.015), 6.009);
  rel(T.parseHeatOfFusionKJMol(['80 cal/g'], 18.015), 6.03, 0.01);
  rel(T.parseHeatOfFusionKJMol(['0.33355 kJ/g'], 18.015), 6.009);
  rel(T.parseHeatOfFusionKJMol(['333550 J/kg'], 18.015), 6.009);
  rel(T.parseHeatOfFusionKJMol(['0.33 MJ/kg'], 18.015), 5.95, 0.01);
  rel(T.parseHeatOfFusionKJMol(['0.08 kcal/g'], 18.015), 6.03, 0.01);
  assert.equal(T.parseHeatOfFusionKJMol(['333.55 J/g']), undefined);
  rel(T.parseHeatOfVaporization(['970 Btu/lb'], 18.015)?.kj, 40.6, 0.01);
});

ok('vaporization carries the temperature it was quoted at', () => {
  const a = T.parseHeatOfVaporization(['40.65 kJ/mol at 100 °C']);
  rel(a.kj, 40.65);
  rel(a.at_k, 373.15, 1e-4);
  rel(T.parseHeatOfVaporization(['44.0 kJ/mol (25 °C)']).at_k, 298.15, 1e-4);
  rel(T.parseHeatOfVaporization(['2260 J/g at 373 K'], 18.015).at_k, 373, 1e-4);
  assert.equal(T.parseHeatOfVaporization(['40.65 kJ/mol']).at_k, undefined);
  assert.equal(T.parseHeatOfVaporization(['38.6 kJ/mol at the boiling point']).at_bp, true);
});

ok('implausible and unrelated strings are rejected', () => {
  assert.equal(T.parseHeatOfFusionKJMol(['melts at 80 °C']), undefined);
  assert.equal(T.parseHeatOfFusionKJMol(['no data']), undefined);
  assert.equal(T.parseHeatOfFusionKJMol(['9.9e9 kJ/mol']), undefined);
  assert.equal(T.parseHeatOfFusionKJMol([]), undefined);
});

ok('median over several values', () => {
  rel(T.parseHeatOfFusionKJMol(['6.0 kJ/mol', '6.01 kJ/mol', '30 kJ/mol']), 6.01);
});

ok('heat of combustion is negative whatever the printed sign', () => {
  rel(T.parseHeatOfCombustionKJMol(['-1,367 kJ/mol']), -1367);
  rel(T.parseHeatOfCombustionKJMol(['1367 kJ/mol']), -1367);
  rel(T.parseHeatOfCombustionKJMol(['−3.2X10+3 kJ/mol']), -3200);
  rel(T.parseHeatOfCombustionKJMol(['29.7 MJ/kg'], 46.07), -1368, 0.01);
  rel(T.parseHeatOfCombustionKJMol(['Heat of combustion: -5640 kJ/mol; [CRC]']), -5640);
  assert.equal(T.parseHeatOfCombustionKJMol(['no data']), undefined);
});

const kpa = (p) => p * 1000;
const mmhg = 133.322368;

ok('vapour-pressure points', () => {
  let pts = T.parseVaporPressurePoints(['0.05 mmHg at 20 °C']);
  assert.equal(pts.length, 1);
  rel(pts[0][0], 293.15, 1e-6);
  rel(pts[0][1], 0.05 * mmhg);
  pts = T.parseVaporPressurePoints(['1 mmHg at 52.6 °C (NTP, 1992)', '0.05 mmHg at 20 °C']);
  assert.equal(pts.length, 2);
  assert.ok(pts[0][0] < pts[1][0], 'sorted by T');
  rel(pts[1][0], 325.75, 1e-6);
  rel(T.parseVaporPressurePoints(['VP: 5.0X10-2 mm Hg at 25 °C'])[0][1], 0.05 * mmhg);
  rel(T.parseVaporPressurePoints(['3.17 kPa at 25 °C'])[0][1], kpa(3.17));
  rel(T.parseVaporPressurePoints(['4.1e-3 Pa (25 °C)'])[0][1], 4.1e-3);
  rel(T.parseVaporPressurePoints(['760 mm Hg at 100 deg C'])[0][1], 101325, 1e-4);
  rel(T.parseVaporPressurePoints(['1.2 bar at 293 K'])[0][1], 1.2e5);
  rel(T.parseVaporPressurePoints(['Vapor pressure, kPa at 20 °C: 5.8'])[0][1], kpa(5.8));
  rel(T.parseVaporPressurePoints(['23.8 mm Hg at 77 °F'])[0][0], 298.15, 1e-4);
});

ok('vapour pressure without a temperature is never guessed', () => {
  assert.deepEqual(T.parseVaporPressurePoints(['15 mmHg']), []);
  assert.deepEqual(T.parseVaporPressurePoints(['Negligible']), []);
  assert.deepEqual(T.parseVaporPressurePoints([]), []);
});

ok('boiling points: normal vs reduced pressure', () => {
  let b = T.parseBoilingPoints(['218 °C']);
  assert.deepEqual(b.normal_c, [218]);
  assert.equal(b.points.length, 0);
  b = T.parseBoilingPoints(['78.37 °C at 760 mmHg']);
  assert.deepEqual(b.normal_c, [78.4]);
  b = T.parseBoilingPoints(['100 °C at 1 atm']);
  assert.deepEqual(b.normal_c, [100]);
  b = T.parseBoilingPoints(['118 °C at 10 mm Hg', '244 °C']);
  assert.deepEqual(b.normal_c, [244]);
  assert.equal(b.points.length, 1);
  rel(b.points[0][0], 391.15, 1e-6);
  rel(b.points[0][1], 10 * mmhg);
  b = T.parseBoilingPoints(['212 °F']);
  assert.deepEqual(b.normal_c, [100]);
  b = T.parseBoilingPoints(['373.15 K']);
  assert.deepEqual(b.normal_c, [100]);
});

ok('phase at 25 C from mp / bp, else the hint', () => {
  assert.equal(P.phaseAtRoom(801, 1413), 'solid');
  assert.equal(P.phaseAtRoom(-117, 78), 'liquid');
  assert.equal(P.phaseAtRoom(-189, -85), 'gas');
  assert.equal(P.phaseAtRoom(26, 100), 'solid');
  assert.equal(P.phaseAtRoom(25, 100), 'liquid');
  assert.equal(P.phaseAtRoom(-30, 24.9), 'gas');
  assert.equal(P.phaseAtRoom(undefined, -33), 'gas');
  assert.equal(P.phaseAtRoom(undefined, 150), 'liquid');
  assert.equal(P.phaseAtRoom(undefined, undefined, 'solid'), 'solid');
  assert.equal(P.phaseAtRoom(undefined, undefined), 'liquid');
  assert.equal(P.phaseAtRoom(NaN, null, 'gas'), 'gas');
  assert.equal(P.phaseAtRoom(80, undefined, 'liquid'), 'solid'); // data beats the text hint
});

ok('importPhase: engine state_at_room > local derivation > text hint', () => {
  const b = { state: 'liquid', sourcedProperties: { mp_c: 80, bp_c: 218, density: 1.14, known: { mp_c: true, bp_c: true, density: true } } };
  assert.equal(P.importPhase(b), 'solid');
  assert.equal(P.importPhase(b, { state_at_room: 'gas' }), 'gas');
  assert.equal(P.importPhase(b, {}), 'solid');
  // placeholder mp / bp (20 / 100) are unknown: the hint decides
  const unknown = { state: 'solid', sourcedProperties: { mp_c: 20, bp_c: 100, density: 1, known: { mp_c: false, bp_c: false, density: false } } };
  assert.equal(P.importPhase(unknown), 'solid');
  assert.equal(P.importPhase({ sourcedProperties: { mp_c: 20, bp_c: 100, density: 1 } }), 'liquid'); // legacy flagless placeholders
  // a user override beats sourced data
  assert.equal(P.importPhase({ ...b, userOverrides: { mp_c: -10 } }), 'liquid');
});

ok('effectiveThermo: overrides, known flags, legacy placeholders', () => {
  const src = { mp_c: 80, bp_c: 218, density: 1.14, known: { mp_c: true, bp_c: false, density: true } };
  assert.deepEqual(P.effectiveThermo({ sourcedProperties: src }), { mp_c: 80, bp_c: undefined, density: 1.14 });
  assert.equal(P.effectiveThermo({ sourcedProperties: src, userOverrides: { bp_c: 200 } }).bp_c, 200);
  assert.deepEqual(P.effectiveThermo({ sourcedProperties: { mp_c: 20, bp_c: 100, density: 1 } }), { mp_c: undefined, bp_c: undefined, density: undefined });
  assert.deepEqual(P.effectiveThermo({ sourcedProperties: { mp_c: 20, bp_c: 78, density: 0.79 } }), { mp_c: undefined, bp_c: 78, density: 0.79 });
});

ok('vaporPressurePoints: curve points + normal bp, override replaces', () => {
  const known = { mp_c: true, bp_c: true, density: true };
  const b = { sourcedProperties: { mp_c: 80, bp_c: 218, density: 1.14, known }, physical: { vapor_pressure_points: [[293.15, 6.7], [325.75, 133.3]] } };
  const pts = P.vaporPressurePoints(b);
  assert.equal(pts.length, 3);
  assert.deepEqual(pts[2], [491.15, 101325]);
  assert.equal(pts[0][0], 293.15);
  const ov = P.vaporPressurePoints({ ...b, userOverrides: { bp_c: 200 } });
  assert.deepEqual(ov, [[473.15, 101325]]);
  // no boiling data at all: non-volatile, nothing invented
  assert.deepEqual(P.vaporPressurePoints({ sourcedProperties: { mp_c: 20, bp_c: 100, density: 1, known: { bp_c: false } } }), []);
});


// ---- Stage 0.12: live PubChem strings captured in docs/plans/generalization-audit/probes/pubchem_strings.out -------------

ok('ranges parse to their midpoint, never a negative number (live strings)', () => {
  assert.equal(P.parseTemperatureString('122-123 °C').value, 122.5);
  assert.equal(P.parseTemperatureString('122 - 123 °C').value, 122.5);
  assert.equal(P.parseTemperatureString('122 to 123 °C').value, 122.5);
  assert.equal(P.parseTemperatureString('-117 °C').value, -117);
  assert.equal(P.parseTemperatureString('−94.9 to −94.5 °C').value, -94.7);
  // a range inside a boiling-point string (thermo_parser): "100-102 °C at 10 mm Hg" is the point (101 C, 10 mmHg)
  const b = T.parseBoilingPoints(['100-102 °C at 10 mm Hg']);
  assert.equal(b.normal_c.length, 0);
  rel(b.points[0][0], 374.15, 1e-6);
  rel(b.points[0][1], 10 * mmhg);
  rel(T.parseVaporPressurePoints(['0.05 mmHg at 20-25 °C'])[0][0], 295.65, 1e-6);
});

ok('qualifiers: decomposes / sublimes / greater than / less than are rejected, not read as values', () => {
  // aspirin, caffeine, glucose (live)
  for (const t of ['284 °F (decomposes)', '284 °F (Decomposes)', '178 °C (sublimes)', 'greater than 212 °F at 760 mmHg (USCG, 1999)', 'less than 32 °F (USCG, 1999)']) {
    assert.equal(P.parseTemperatureString(t), null, t);
  }
  const bp = T.parseBoilingPoints(['284 °F at 760 mmHg (decomposes) (NTP, 1992)', '352 °F at 760 mmHg (sublimes) (NTP, 1992)', 'greater than 212 °F at 760 mmHg (USCG, 1999)']);
  assert.deepEqual(bp, { normal_c: [], points: [] });
  // "approx." is a value
  assert.equal(P.parseTemperatureString('approx. 200 °C').value, 200);
});

ok('glucose: the monohydrate string is another substance, the pool is 146 C', () => {
  const mp = [
    'less than 32 °F (USCG, 1999)',
    '146 °C',
    'Crystals from water, MP: 83 °C; specific optical rotation = +102.0 deg to 47.9 deg (water) at 25 °C/D. 0.74 times as sweet as sucrose; 1 g dissolves in ca 1 mL water, ca 60 mL alcohol /alpha-Glucose, monohydrate/',
    '146 °C',
  ].map((t) => P.parseTemperatureString(t)).filter(Boolean);
  assert.equal(P.resolveMedianProperty(mp, 20), 146);
});

ok('standard conditions is a real test, not "contains 25"', () => {
  assert.equal(P.parseTemperatureString('125 °C').isStandardConditions, true);
  assert.equal(P.parseTemperatureString('125 °C at 10 mm Hg').isStandardConditions, false);
  assert.equal(P.parseTemperatureString('80 °C at 25 mm Hg').isStandardConditions, false);
  assert.equal(P.parseTemperatureString('78.37 °C at 760 mmHg').isStandardConditions, true);
  assert.equal(P.parseDensityString('0.79 g/cm3 at 20 °C').isStandardConditions, true);
  assert.equal(P.parseDensityString('0.98 g/cm3 at 80 °C').isStandardConditions, false);
  assert.equal(P.parseDensityString('1.266 g/cm3 at 125 °C').isStandardConditions, false); // not "contains 25"
});

ok('unitless relative densities are accepted', () => {
  rel(P.parseDensityString('Relative density (water = 1): 0.79').value, 0.79);
  rel(P.parseDensityString('Specific gravity: 1.26 at 15 °C').value, 1.26);
  rel(P.parseDensityString('0.7893 at 20 °C/4 °C').value, 0.789, 0.001);
  rel(P.parseDensityString('7874 kg/m3').value, 7.874);
  rel(P.parseDensityString('1.26 g/cm³').value, 1.26);
  assert.equal(P.parseDensityString('0.79'), null); // a bare number is not a density
});

ok('Trouton and Walden gates reject the live outliers', () => {
  // benzoic acid "425 Kj/mol at 249 °C" (Tb 522 K): 814 J/(mol K)
  assert.equal(T.troutonOk(425, 522.15), false);
  assert.equal(T.troutonOk(40.65, 373.15), true); // water 109
  assert.equal(T.troutonOk(38.6, 351.4), true); // ethanol 110
  assert.equal(T.troutonOk(23.7, 391.1), true); // acetic acid 61
  assert.equal(T.troutonOk(425, undefined), true); // no boiling point: cannot check
  // ethanol "T fus = 159" read as the heat of fusion (4.9 kJ/mol expected)
  assert.equal(T.waldenOk(159, 159.05), false);
  assert.equal(T.waldenOk(4.93, 159.05), true);
  assert.equal(T.waldenOk(19.0, 353.35), true); // naphthalene 54
  assert.equal(T.waldenOk(6.01, 273.15), true);
});

console.log(`${n} groups passed`);
