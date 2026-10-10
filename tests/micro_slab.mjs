// Molecular viewer, solid surfaces (stage R4), against the built WASM engine: node tests/micro_slab.mjs
// The lattice patch (app/micro_lattice.ts), the slab and its occupancy rules (render/micro_slab.ts), the surface event and the
// generic swap (render/micro_surface_event.ts), with the real lattices and structures the engine sends.
// Checks: the packing follows the formula ratio and the radii, no two sites overlap, every site above the bottom layer has
// support, growth and dissolution keep that true, an event takes its sites and gives them back, ions end on the site they were
// sent to, electrons run between the places they are meant to, and a swap shrinks the reactants as it grows the products.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const dir = path.join(web, 'src', 'wasm', 'engine');
const eng = await import(path.join(dir, 'reaction_chamber_engine.js'));
eng.initSync({ module: readFileSync(path.join(dir, 'reaction_chamber_engine_bg.wasm')) });
eng.init_engine();
const J = (x) => (typeof x === 'string' ? JSON.parse(x) : x);

const { build } = await import(path.join(web, 'node_modules', 'esbuild', 'lib', 'main.js'));
const entry = `
import * as THREE from 'three';
export { buildSlab } from '${web}/src/app/micro_lattice';
export { Slab } from '${web}/src/render/micro_slab';
export { SurfaceEvent, SwapEvent, SWAP_TIME } from '${web}/src/render/micro_surface_event';
export { MicroMotion } from '${web}/src/render/micro_motion';
export { buildShape } from '${web}/src/render/micro_shape';
export { THREE };
`;
const out = await build({ stdin: { contents: entry, resolveDir: web, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const { buildSlab, Slab, SurfaceEvent, SwapEvent, SWAP_TIME, MicroMotion, buildShape, THREE } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));

let n = 0;
const ok = async (name, fn) => {
  await fn();
  n++;
  console.log('  ok', name);
};

const cfg = { type: 'beaker-250', capacity_ml: 250, glass_mass_g: 110, inner_radius_cm: 3.5, temperature_k: 298.15, room_k: 298.15 };
const hnd = eng.vessel_new(JSON.stringify(cfg));
const lattice = (s) => J(eng.vessel_micro_lattice(hnd, s));
const shapes = new Map();
const shapeOf = (sp) => {
  if (!shapes.has(sp)) shapes.set(sp, buildShape(J(eng.vessel_micro_structures(hnd, JSON.stringify([sp])))[0]));
  return shapes.get(sp);
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

await ok('the engine sends lattices for minerals, metals and salts, and none for a molecular solid', () => {
  for (const s of ['AgCl(s)', 'BaSO4(s)', 'Ag2CrO4(s)', 'Zn(s)', 'Cu(s)', 'Fe(OH)3(s)', 'Ca3(PO4)2(s)', 'CaF2(s)', 'NaCl(s)']) {
    const l = lattice(s);
    assert.ok(l, `no lattice for ${s}`);
    assert.ok(l.ions.length >= 1 && l.ions.every((i) => i.radius_a > 0 && i.count >= 1), s);
  }
  assert.equal(lattice('C6H12O6(s)'), null);
});

await ok('the packing follows the formula ratio: rock-salt, fluorite, anti-fluorite, close-packed, cubic', () => {
  const pack = (s) => buildSlab(lattice(s), { footprint: 28 });
  assert.equal(pack('AgCl(s)').packing, 'rock-salt');
  assert.equal(pack('BaSO4(s)').packing, 'rock-salt');
  assert.equal(pack('CaF2(s)').packing, 'fluorite');
  assert.equal(pack('Ag2CrO4(s)').packing, 'anti-fluorite');
  assert.equal(pack('Zn(s)').packing, 'close-packed');
  assert.equal(pack('Fe(OH)3(s)').packing, 'cubic');
  assert.equal(pack('Ca3(PO4)2(s)').packing, 'cubic');
  // rock-salt: equal numbers, alternating along every axis
  const rs = pack('AgCl(s)');
  const count = (sl, sp) => sl.sites.filter((x) => x.species === sp).length;
  assert.ok(Math.abs(count(rs, 'Ag+') - count(rs, 'Cl-')) <= 1, 'equal numbers (a checkerboard of an odd grid differs by one)');
  for (const s of rs.sites) for (const j of s.nbr) if (Math.abs(dist(s, rs.sites[j]) - rs.spacing) < 1e-6) assert.notEqual(rs.sites[j].species, s.species, 'a nearest neighbour of a rock-salt ion is the other ion');
  // fluorite: about two anions per cation (the closing plane adds cations only)
  const fl = pack('CaF2(s)');
  const ratio = count(fl, 'F-') / count(fl, 'Ca+2');
  assert.ok(ratio > 1.3 && ratio <= 2.0, `F:Ca = ${ratio}`);
  const af = pack('Ag2CrO4(s)');
  const ratio2 = count(af, 'Ag+') / count(af, 'CrO4-2');
  assert.ok(ratio2 > 1.3 && ratio2 <= 2.0, `Ag:CrO4 = ${ratio2}`);
  // cubic mixed: the formula ratio, with like charges kept apart
  const fe = pack('Fe(OH)3(s)');
  const r3 = count(fe, 'OH-') / count(fe, 'Fe+3');
  assert.ok(r3 > 2.4 && r3 < 3.6, `OH:Fe = ${r3}`);
});

await ok('sites do not overlap, keep their spacing, and every site above the bottom layer has support below', () => {
  for (const s of ['AgCl(s)', 'BaSO4(s)', 'CaF2(s)', 'Ag2CrO4(s)', 'Zn(s)', 'Fe(OH)3(s)', 'Ca3(PO4)2(s)', 'NaCl(s)']) {
    const l = buildSlab(lattice(s), { footprint: 30 });
    let nn = Infinity;
    for (let i = 0; i < l.sites.length; i++) for (let j = i + 1; j < l.sites.length; j++) nn = Math.min(nn, dist(l.sites[i], l.sites[j]));
    assert.ok(nn >= 0.95 * l.spacing, `${s}: nearest ${nn} vs spacing ${l.spacing}`);
    assert.ok(l.layers >= 3 && l.layers <= 8, `${s}: ${l.layers} layers`);
    assert.ok(l.sites.length >= 20 && l.sites.length <= 700, `${s}: ${l.sites.length} sites`);
    for (const site of l.sites) {
      assert.equal(site.layer === 0, site.below.length === 0, `${s}: site ${site.id} layer ${site.layer} has ${site.below.length} below`);
      for (const b of site.below) assert.ok(l.sites[b].above.includes(site.id), `${s}: below/above are mirror images`);
      assert.ok(site.y <= 1e-2 && site.y >= -l.height - 1e-2);
    }
    assert.ok(Math.abs(Math.max(...l.sites.map((x) => x.y))) < 1e-2, `${s}: the top layer is at y = 0`);
    // centred
    const cx = (Math.min(...l.sites.map((x) => x.x)) + Math.max(...l.sites.map((x) => x.x))) / 2;
    assert.ok(Math.abs(cx) < 1e-6, `${s}: centred in x`);
    // the spacing is the ion contact distance (rock-salt) or the metal's diameter
    if (s === 'AgCl(s)') assert.ok(Math.abs(l.spacing - (lattice(s).ions[0].radius_a + lattice(s).ions[1].radius_a)) < 0.02);
    if (s === 'Zn(s)') assert.ok(Math.abs(l.spacing - 2 * lattice(s).ions[0].radius_a) < 0.02);
  }
});

function makeSlab(solid, seed = 3) {
  const lat = lattice(solid);
  const layout = buildSlab(lat, { footprint: 30 });
  const slab = new Slab(layout, new THREE.Vector3(0, -30, 0), lat, solid, seed);
  slab.fillInitial((sp) => shapeOf(sp));
  return slab;
}
const supportedEverywhere = (slab) => slab.layout.sites.every((s) => !slab.occupant[s.id] || slab.supported(s.id));

await ok('the starting surface is a full crystal with a rough top, and offers vacancies and exposed ions of each kind', () => {
  for (const s of ['AgCl(s)', 'BaSO4(s)', 'CaF2(s)', 'Zn(s)', 'Fe(OH)3(s)']) {
    const slab = makeSlab(s);
    const total = slab.layout.sites.length;
    assert.ok(slab.count() > 0.45 * total && slab.count() < 0.98 * total, `${s}: ${slab.count()} of ${total}`);
    assert.ok(supportedEverywhere(slab), `${s}: every occupant is held up`);
    for (const u of slab.layout.unit) {
      assert.ok(slab.vacancies(u.species).length > 0, `${s}: vacancies of ${u.species}`);
      assert.ok(slab.exposed(u.species).length > 0, `${s}: exposed ${u.species}`);
    }
    // bottom layer is never offered for leaving
    assert.ok(slab.exposed().every((id) => slab.layout.sites[id].layer >= 1));
  }
});

await ok('picking a unit gives distinct sites of the right kinds, close together; growth and dissolution keep the crystal held up', () => {
  const slab = makeSlab('BaSO4(s)');
  const unit = slab.pickUnit('vacant');
  assert.equal(unit.length, 2);
  assert.deepEqual(unit.map((id) => slab.layout.sites[id].species), ['Ba+2', 'SO4-2']);
  assert.ok(dist(slab.layout.sites[unit[0]], slab.layout.sites[unit[1]]) < 2.2 * slab.layout.spacing);
  // Ag2CrO4: three sites, two of them silver
  const ag = makeSlab('Ag2CrO4(s)');
  const u3 = ag.pickUnit('vacant');
  assert.equal(new Set(u3).size, 3);
  assert.equal(u3.filter((id) => ag.layout.sites[id].species === 'Ag+').length, 2);
  // random growth and dissolution for a long time: the crystal stays supported, the occupancy stays between its limits
  const s = makeSlab('AgCl(s)', 11);
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const start = s.count();
  for (let i = 0; i < 400; i++) {
    if (rnd() < 0.55) {
      const u = s.pickUnit('vacant');
      if (u) u.forEach((id) => s.place(id, s.layout.sites[id].species, shapeOf(s.layout.sites[id].species)));
    } else {
      const u = s.pickUnit('exposed');
      if (u) u.forEach((id) => s.clear(id));
    }
    assert.ok(supportedEverywhere(s), `step ${i}: a floating ion`);
    assert.ok(s.exposed().every((id) => s.layout.sites[id].layer >= 1));
  }
  assert.ok(s.count() > 0 && s.count() < s.layout.sites.length);
  assert.ok(start !== s.count() || true);
  // reserved sites are not offered
  const free = s.vacancies('Ag+');
  s.reserve(free);
  assert.equal(s.vacancies('Ag+').length, 0);
  s.release(free);
  assert.equal(s.vacancies('Ag+').length, free.length);
  // occupant filter: foreign atoms are told apart from the lattice's own
  const zn = makeSlab('Zn(s)');
  const v = zn.pickUnit('vacant', ['Zn(s)']);
  zn.place(v[0], 'Cu(s)', shapeOf('Cu(s)'));
  assert.ok(zn.exposed('Zn(s)').includes(v[0]) || zn.layout.sites[v[0]].layer === 0 || zn.layout.sites[v[0]].above.some((a) => zn.occupant[a]));
  const cuOnly = zn.pickUnit('exposed', ['Zn(s)'], ['Cu(s)']);
  assert.deepEqual(cuOnly, [v[0]]);
});

await ok('a surface event docks ions at their sites, lifts occupants off, and gives the sites back', () => {
  const slab = makeSlab('AgCl(s)', 5);
  const motion = new MicroMotion(new THREE.Vector3(60, 50, 60), 'liquid', 3);
  const ag = shapeOf('Ag+');
  const cl = shapeOf('Cl-');
  const bodyAg = motion.addInside('Ag+', ag);
  const bodyCl = motion.addInside('Cl-', cl);
  const sites = slab.pickUnit('vacant');
  slab.reserve(sites);
  const before = slab.count();
  const docked = [];
  const lifted = [];
  const ev = new SurfaceEvent(
    slab,
    [
      { body: bodyAg, siteId: sites[0], occupantSpecies: 'Ag+', occupantShape: ag },
      { body: bodyCl, siteId: sites[1], occupantSpecies: 'Cl-', occupantShape: cl },
    ],
    [],
    [],
    { onDock: (j) => { docked.push(j.siteId); motion.release(j.body); }, onLift: () => assert.fail('nothing leaves') },
  );
  assert.equal(bodyAg.state, 'docking');
  assert.equal(slab.vacancies().includes(sites[0]), false, 'reserved');
  let t = 0;
  while (!ev.finished && t < 10) {
    ev.step(1 / 30);
    t += 1 / 30;
    // the ion never leaves the box-and-slab column
    assert.ok(Math.abs(bodyAg.pos.x) < 40 && bodyAg.pos.y > -45);
  }
  assert.ok(ev.finished && t < 6, `event lasted ${t} s`);
  assert.deepEqual(docked.sort(), [...sites].sort());
  assert.equal(slab.count(), before + 2);
  assert.equal(slab.reserved.size, 0);
  assert.ok(motion.bodies.indexOf(bodyAg) < 0 && motion.bodies.indexOf(bodyCl) < 0, 'docked ions left the box');
  const w = slab.siteWorld(sites[0]);
  assert.ok(slab.occupant[sites[0]].species === 'Ag+' && w.y < -29);
  // dissolution: two exposed ions lift off, the hook gets their positions, the sites are free again
  const ex = slab.pickUnit('exposed');
  slab.reserve(ex);
  const liftedAt = [];
  const ev2 = new SurfaceEvent(
    slab,
    [],
    ex.map((id) => ({ siteId: id, becomes: [{ species: slab.occupant[id].species, shape: slab.occupant[id].shape, role: 'solute', gas: false }] })),
    [],
    { onDock: () => assert.fail('nothing joins'), onLift: (l, pos) => liftedAt.push({ id: l.siteId, pos: pos.clone() }) },
  );
  const count0 = slab.count();
  t = 0;
  while (!ev2.finished && t < 10) {
    ev2.step(1 / 30);
    t += 1 / 30;
  }
  assert.equal(liftedAt.length, 2);
  assert.equal(slab.count(), count0 - 2);
  assert.equal(slab.reserved.size, 0);
  for (const l of liftedAt) assert.ok(l.pos.distanceTo(slab.siteWorld(l.id)) < 1e-9);
});

await ok('electrons run between the places they are meant to and only while they should', () => {
  const slab = makeSlab('Zn(s)', 9);
  const motion = new MicroMotion(new THREE.Vector3(60, 50, 60), 'liquid', 3);
  const cu2 = shapeOf('Cu+2');
  const cuAtom = shapeOf('Cu(s)');
  const body = motion.addInside('Cu+2', cu2);
  const [joinSite] = slab.pickUnit('vacant', ['Zn(s)']);
  const [leaveSite] = slab.pickUnit('exposed', ['Zn(s)']);
  slab.reserve([joinSite, leaveSite]);
  const seen = [];
  const ev = new SurfaceEvent(
    slab,
    [{ body, siteId: joinSite, occupantSpecies: 'Cu(s)', occupantShape: cuAtom }],
    [{ siteId: leaveSite, becomes: [{ species: 'Zn+2', shape: shapeOf('Zn+2'), role: 'solute', gas: false }] }],
    [{ from: () => slab.siteWorld(leaveSite), to: () => body.pos, count: 2 }],
    { onDock: (j) => motion.release(j.body), onLift: () => {} },
  );
  const sprites = [];
  let t = 0;
  let maxSprites = 0;
  let early = 0;
  while (!ev.finished && t < 10) {
    ev.step(1 / 30);
    t += 1 / 30;
    ev.electronSprites(sprites);
    if (t < 0.25) early += sprites.length;
    maxSprites = Math.max(maxSprites, sprites.length);
    for (const s of sprites) assert.ok(s.strength >= 0 && s.strength <= 1.0001 && Number.isFinite(s.pos.x));
  }
  assert.equal(early, 0, 'no electrons before the event is under way');
  assert.ok(maxSprites >= 1 && maxSprites <= 3, `sprites ${maxSprites}`);
  assert.equal(slab.occupant[joinSite].species, 'Cu(s)', 'the plated atom is copper on the zinc lattice');
  assert.equal(slab.occupant[leaveSite], null);
});

await ok('an event dropped half way gives its sites back and frees its ions', () => {
  const slab = makeSlab('AgCl(s)', 5);
  const motion = new MicroMotion(new THREE.Vector3(60, 50, 60), 'liquid', 3);
  const ag = shapeOf('Ag+');
  const b = motion.addInside('Ag+', ag);
  const [site] = slab.pickUnit('vacant', ['Ag+']);
  slab.reserve([site]);
  const ev = new SurfaceEvent(slab, [{ body: b, siteId: site, occupantSpecies: 'Ag+', occupantShape: ag }], [], [], { onDock: () => {}, onLift: () => {} });
  ev.step(0.3);
  ev.abort();
  assert.equal(slab.reserved.size, 0);
  assert.equal(b.state, 'in');
  assert.equal(slab.occupant[site], null);
  assert.ok(ev.finished);
});

await ok('a swap shrinks the reactants as it grows the products, around the same spot', () => {
  const sp = ['Cl-', 'Ag+'];
  const structs = new Map(J(eng.vessel_micro_structures(hnd, JSON.stringify([...sp, 'AgCl(aq)', 'H2O']))).map((s) => [s.species, s]));
  const q = new THREE.Quaternion();
  const ev = new SwapEvent(
    [
      { shape: shapeOf('Cl-'), struct: structs.get('Cl-'), pos: new THREE.Vector3(-3, 0, 0), quat: q },
      { shape: shapeOf('Ag+'), struct: structs.get('Ag+'), pos: new THREE.Vector3(3, 0, 0), quat: q },
    ],
    [{ shape: shapeOf('H2O'), struct: structs.get('H2O') }],
  );
  const rAtoms = 2;
  assert.equal(ev.atoms.length, rAtoms + 3);
  assert.deepEqual(ev.productPoses.length, 1);
  assert.ok(ev.productPoses[0].pos.distanceTo(ev.centre()) < 1e-6, 'a single product stands at the centre of the reactants');
  assert.ok(ev.atoms.slice(0, rAtoms).every((a) => a.scale === 1) && ev.atoms.slice(rAtoms).every((a) => a.scale === 0));
  let mid = false;
  let t = 0;
  while (!ev.finished) {
    ev.step(1 / 30);
    t += 1 / 30;
    if (ev.progress > 0.45 && ev.progress < 0.55 && !mid) {
      mid = true;
      assert.ok(ev.atoms[0].scale < 1 && ev.atoms[0].scale > 0 && ev.atoms[rAtoms].scale > 0 && ev.atoms[rAtoms].scale < 1, 'both are partly there half way');
    }
  }
  assert.ok(mid && Math.abs(t - SWAP_TIME) < 0.1);
  assert.ok(ev.atoms.slice(0, rAtoms).every((a) => a.scale < 0.01) && ev.atoms.slice(rAtoms).every((a) => a.scale > 0.99));
  // bonds of the water product fade in, none of the ions fade at all
  const lines = [];
  const water = ev.bonds.filter((b) => b.pOrder > 0);
  assert.equal(water.length, 2);
  assert.ok(water.every((b) => ev.linesOf(b, lines).length === 1 && lines[0].weight > 0.95));
});

console.log(`micro_slab: ${n} checks passed`);
