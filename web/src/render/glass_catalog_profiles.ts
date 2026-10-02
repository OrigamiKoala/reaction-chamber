import * as THREE from 'three';
import {
  TickSpec,
  VesselProfile,
  VesselType,
  Wall,
  buildProfile,
  outerRadiusAt,
  scaleGraduations,
  solveIncreasing,
  tickValues,
  volumeAtHeight,
} from './glass_profiles';

/**
 * Per-type dimensions (real catalogue sizes, 1 unit = 1 cm). Everything is built from `Wall` polylines and the
 * generic `buildProfile`; the volume tables come from the real inner cavity, so graduations are placed with
 * `heightForVolume` and are true to the liquid level. Bodies that are fitted to a nominal volume (round-bottom
 * flasks, volumetric flasks / pipettes, separatory funnel) solve their radius numerically.
 */

const V2 = (x: number, y: number) => new THREE.Vector2(x, y);

// ------------------------------------------------------------------ support geometry shared with the builders
export interface RackDims {
  W: number;
  D: number;
  spacing: number;
  holeR: number;
  plateY: number;
  baseH: number;
  postH: number;
}

/** Test-tube rack sized for a tube of outer radius `ro` and length `len` (3 holes, tube in the middle one). */
export function rackDims(ro: number, len: number): RackDims {
  const holeR = ro + 0.17;
  const spacing = Math.max(3.8, holeR * 2 + 1.0);
  const baseH = 1.2;
  const plateY = baseH + Math.min(8.2 - baseH, Math.max(2.4, len * 0.55));
  return {
    W: spacing * 3 + 0.6,
    D: Math.max(5.5, holeR * 2 + 2.2),
    spacing,
    holeR,
    plateY,
    baseH,
    postH: plateY + 0.4 - baseH,
  };
}

// ------------------------------------------------------------------ graduation helper
function applyScale(
  p: VesselProfile,
  range: number,
  t: TickSpec,
  opts: { zeroY?: number; downward?: boolean } = {}
): void {
  p.graduations = scaleGraduations(p, tickValues(range, t), opts);
}

// ------------------------------------------------------------------ beakers
function beaker(type: VesselType, nominal: number, Ri: number, H: number, wall: number, tick: TickSpec): VesselProfile {
  const R = Ri + wall;
  const c = Math.min(0.55, R * 0.18);
  const w = new Wall(R - c, 0).arc(R - c, c, c, -Math.PI / 2, 0, 6).line(R, H * 0.5).line(R, H - 0.25);
  const p = buildProfile(type, w.pts, wall, {
    kind: 'beaker',
    nominalMl: nominal,
    graduations: [],
    gradTitle: `${nominal} mL`,
    gradNote: 'approx.',
    spout: Math.max(0.35, R * 0.11),
  });
  applyScale(p, nominal, tick);
  return p;
}

// ------------------------------------------------------------------ conical (Erlenmeyer) and filter flasks
interface ConicalDims {
  Rb: number;
  H: number;
  neckR: number;
  shoulderY: number;
  neckY: number;
  wall: number;
}

function conicalWall(d: ConicalDims): THREE.Vector2[] {
  const c = Math.min(0.6, d.Rb * 0.14);
  const w = new Wall(d.Rb - c, 0).arc(d.Rb - c, c, c, -Math.PI / 2, 0.2, 7);
  w.line(d.neckR + 0.45, d.shoulderY, 6); // straight cone to the shoulder
  w.ease(d.neckR, d.neckY, 6); // shoulder curve into the neck
  w.line(d.neckR, d.H - 0.6);
  w.line(d.neckR + 0.12, d.H - 0.3); // slight lip flare
  return w.pts;
}

function erlenmeyer(type: VesselType, nominal: number, d: ConicalDims, tick: TickSpec, maxMark: number): VesselProfile {
  const p = buildProfile(type, conicalWall(d), d.wall, {
    kind: 'conical',
    nominalMl: nominal,
    graduations: [],
    gradTitle: `${nominal} mL`,
    gradNote: 'approx.',
    neckRadius: d.neckR - d.wall,
  });
  applyScale(p, maxMark, { ...tick, from: Math.max(tick.minor, nominal * 0.1) });
  return p;
}

function filterFlask(type: VesselType): VesselProfile {
  const d: ConicalDims = { Rb: 4.4, H: 14.2, neckR: 2.0, shoulderY: 8.6, neckY: 10.4, wall: 0.3 };
  const p = buildProfile(type, conicalWall(d), d.wall, {
    kind: 'filter-flask',
    nominalMl: 250,
    graduations: [],
    gradTitle: '250 mL',
    gradNote: '',
    neckRadius: d.neckR - d.wall,
    accessories: [{ kind: 'sidearm', y: d.H - 4.0, r: d.neckR, len: 3.6 }],
  });
  applyScale(p, 200, { minor: 25, major: 50 }, {});
  return p;
}

// ------------------------------------------------------------------ round-bottom / Florence
function roundBottom(type: VesselType, nominal: number, neckRi: number, neckLen: number, wall: number): VesselProfile {
  const Rin = Math.cbrt((3 * nominal) / (4 * Math.PI));
  const Ro = Rin + wall;
  const rn = neckRi + wall;
  const aj = Math.acos(Math.min(0.95, (rn + 0.5) / Ro));
  const w = new Wall();
  w.arc(0, Ro, Ro, -Math.PI / 2 + 0.12, aj, 30);
  const yTop = w.y + 0.9 + neckLen;
  w.ease(rn, w.y + 0.9, 8).line(rn, yTop - 0.3).line(rn + 0.12, yTop);
  const ringR = Ro * 0.45;
  const ringT = Math.max(0.55, Ro * 0.16);
  const yAtRing = Ro - Math.sqrt(Ro * Ro - ringR * ringR);
  return buildProfile(type, w.pts, wall, {
    kind: 'round-bottom',
    nominalMl: nominal,
    graduations: [],
    gradTitle: '',
    roundBottom: true,
    neckRadius: neckRi,
    support: 'cork-ring',
    supportR: ringR,
    supportY: ringT,
    baseOffsetY: ringT * 2 - yAtRing,
    footprintR: Math.max(Ro, ringR + ringT) + 0.2,
    accessories: [{ kind: 'joint', y: yTop, r: rn, len: 2.6 }],
  });
}

function florence(type: VesselType): VesselProfile {
  const nominal = 500;
  const wall = 0.22;
  const Rin = 4.95;
  const Ro = Rin + wall;
  const cy = Ro - 0.75; // sphere centre height: truncated flat base
  const a0 = -Math.asin(cy / Ro);
  const rn = 1.6 + wall;
  const aj = Math.acos((rn + 0.55) / Ro);
  const w = new Wall(Ro * Math.cos(a0) * 0.8, 0);
  w.line(Ro * Math.cos(a0), 0, 2);
  w.arc(0, cy, Ro, a0, aj, 34);
  const yTop = w.y + 1.0 + 8.2;
  w.ease(rn, w.y + 1.0, 8).line(rn, yTop - 0.3).line(rn + 0.15, yTop);
  return buildProfile(type, w.pts, wall, {
    kind: 'florence',
    nominalMl: nominal,
    graduations: [],
    gradTitle: '',
    neckRadius: 1.6,
    accessories: [{ kind: 'joint', y: yTop, r: rn, len: 2.8 }],
  });
}

// ------------------------------------------------------------------ graduated cylinders
function cylinder(type: VesselType, nominal: number, Ri: number, wall: number, foot: number, tick: TickSpec): VesselProfile {
  const Ro = Ri + wall;
  const c = Math.min(0.3, Ro * 0.25);
  const scaleLen = nominal / (Math.PI * Ri * Ri);
  const gap = Math.min(4.0, Math.max(2.0, scaleLen * 0.15));
  const H = foot + wall + scaleLen + gap;
  const w = new Wall(Ro - c, foot).arc(Ro - c, foot + c, c, -Math.PI / 2, 0, 4).line(Ro, (foot + H) * 0.5).line(Ro, H - 0.2);
  const p = buildProfile(type, w.pts, wall, {
    kind: 'cylinder',
    nominalMl: nominal,
    graduations: [],
    gradTitle: `${nominal} mL`,
    gradNote: 'TC 20 °C',
    spout: Math.min(0.4, Math.max(0.3, Ro * 0.2)),
    bottomY: foot,
    footHeight: foot,
    footRadius: Ro * 2.3 + 0.3,
  });
  applyScale(p, nominal, tick);
  return p;
}

// ------------------------------------------------------------------ volumetric flasks
function volumetricFlask(type: VesselType, nominal: number, neckRi: number, wall: number, bodyH: number, neckLen: number): VesselProfile {
  const rn = neckRi + wall;
  const yRing = bodyH + neckLen * 0.55;
  const yTop = bodyH + neckLen;
  const build = (Rb: number): VesselProfile => {
    const c = Math.min(0.9, Rb * 0.3);
    const w = new Wall(Rb - c, 0).arc(Rb - c, c, c, -Math.PI / 2, 0, 6);
    w.line(Rb, bodyH * 0.2, 2); // short barrel
    w.ease(rn, bodyH, 22); // pear shoulder blending into the neck
    w.line(rn, yTop - 0.35).line(rn + 0.15, yTop);
    return buildProfile(type, w.pts, wall, {
      kind: 'volumetric',
      nominalMl: nominal,
      graduations: [],
      gradTitle: `${nominal} mL`,
      gradNote: 'TC 20 °C',
      neckRadius: neckRi,
      calibrationY: yRing,
      accessories: [{ kind: 'joint', y: yTop, r: rn, len: 2.4 }],
      label: { y: bodyH * 0.42, h: bodyH * 0.5, lines: [`${nominal} mL`, 'TC 20 °C', 'CLASS A'] },
    });
  };
  const Rb = solveIncreasing((r) => (volumeAtHeight(build(r), yRing) - nominal) / nominal, rn + 0.4, 9);
  return build(Rb);
}

// ------------------------------------------------------------------ burettes
function burette(type: VesselType, nominal: number, ri: number, wall: number): VesselProfile {
  const Ro = ri + wall;
  const tipR = 0.3;
  const yStop = 6.9;
  const yEnd = 12.5; // y of the full-scale mark
  const A = Math.PI * ri * ri;
  const zeroY = yEnd + nominal / A;
  const top = zeroY + 4.5;
  const w = new Wall(0.17, 0);
  w.line(tipR, 3.4, 4); // delivery tip taper
  w.line(tipR, 8.0, 2);
  w.ease(Ro, 10.4, 10);
  w.line(Ro, top - 0.5).line(Ro + 0.12, top);
  const lift = 16;
  const p = buildProfile(type, w.pts, wall, {
    kind: 'burette',
    nominalMl: nominal,
    graduations: [],
    gradTitle: 'mL',
    gradNote: 'TD 20 °C',
    downward: true,
    zeroY,
    scaleMl: nominal,
    tip: new THREE.Vector3(0, 0, 0),
    openBottom: true,
    neckRadius: ri,
    baseOffsetY: lift,
    support: 'stand',
    supportR: Ro + 0.25,
    supportY: zeroY * 0.72,
    footprintR: 7,
    accessories: [{ kind: 'stopcock', y: yStop, r: tipR, len: 2.7 }],
  });
  p.graduations = scaleGraduations(p, tickValues(nominal, { minor: 0.1, mid: 0.5, major: 1, from: 0 }), { zeroY, downward: true });
  return p;
}

// ------------------------------------------------------------------ pipettes
function volumetricPipette(type: VesselType, nominal: number, ri: number, wall: number, delivLen: number, bulbLen: number): VesselProfile {
  const Ro = ri + wall;
  const yb1 = delivLen + bulbLen;
  const yRing = yb1 + 5.5;
  const top = yRing + 5.5;
  const build = (Rb: number): VesselProfile => {
    const w = new Wall(0.12, 0);
    w.line(Ro, 3.0, 4).line(Ro, delivLen, 2);
    w.curve(yb1, (t) => Ro + (Rb - Ro) * Math.pow(Math.sin(Math.PI * t), 1.35), 22);
    w.line(Ro, top - 0.3).line(Ro + 0.05, top);
    const p = buildProfile(type, w.pts, wall, {
      kind: 'pipette-volumetric',
      nominalMl: nominal,
      graduations: [],
      gradTitle: `${nominal} mL`,
      gradNote: 'TD 20 °C',
      calibrationY: yRing,
      tip: new THREE.Vector3(0, 0, 0),
      openBottom: true,
      neckRadius: ri,
      baseOffsetY: 1.2,
      support: 'stand',
      supportR: Ro + 0.2,
      supportY: top * 0.72,
      footprintR: 6,
      label: { y: delivLen + bulbLen * 0.5, h: bulbLen * 0.8, lines: [`${nominal} mL`, '20 °C TD', 'A'] },
    });
    return p;
  };
  const Rb = solveIncreasing((r) => (volumeAtHeight(build(r), yRing) - nominal) / nominal, Ro + 0.12, 3.5);
  return build(Rb);
}

function graduatedPipette(type: VesselType, nominal: number, ri: number, wall: number, yEnd: number, tick: TickSpec): VesselProfile {
  const Ro = ri + wall;
  const A = Math.PI * ri * ri;
  const zeroY = yEnd + nominal / A;
  const top = zeroY + 6.0;
  const w = new Wall(0.13, 0);
  w.line(Ro, 4.0, 5).line(Ro, top - 0.3).line(Ro + 0.05, top);
  const p = buildProfile(type, w.pts, wall, {
    kind: 'pipette-graduated',
    nominalMl: nominal,
    graduations: [],
    gradTitle: 'mL',
    gradNote: 'TD 20 °C',
    downward: true,
    zeroY,
    scaleMl: nominal,
    tip: new THREE.Vector3(0, 0, 0),
    openBottom: true,
    neckRadius: ri,
    baseOffsetY: 1.2,
    support: 'stand',
    supportR: Ro + 0.2,
    supportY: top * 0.72,
    footprintR: 6,
  });
  p.graduations = scaleGraduations(p, tickValues(nominal, { ...tick, from: 0 }), { zeroY, downward: true });
  return p;
}

function pasteurPipette(type: VesselType): VesselProfile {
  const Ro = 0.3;
  const wall = 0.07;
  const top = 15;
  const w = new Wall(0.1, 0);
  w.line(0.1, 1.2, 2).ease(Ro, 5.2, 10).line(Ro, top - 0.3).line(Ro + 0.06, top);
  return buildProfile(type, w.pts, wall, {
    kind: 'pipette-pasteur',
    nominalMl: 2,
    graduations: [],
    gradTitle: '',
    tip: new THREE.Vector3(0, 0, 0),
    openBottom: true,
    neckRadius: Ro - wall,
    baseOffsetY: 1.2,
    support: 'stand',
    supportR: Ro + 0.2,
    supportY: top * 0.7,
    footprintR: 6,
    accessories: [{ kind: 'teat', y: top, r: Ro + 0.06, len: 4.6 }],
  });
}

// ------------------------------------------------------------------ tubes
function tube(
  type: VesselType,
  kind: 'tube' | 'centrifuge',
  nominal: number,
  Ro: number,
  wall: number,
  H: number,
  opts: { conicalH?: number; material?: 'glass' | 'poly'; tick?: TickSpec; title?: string } = {}
): VesselProfile {
  const w = opts.conicalH
    ? new Wall(0.14, 0).line(Ro, opts.conicalH, 8).line(Ro, H - 0.25)
    : new Wall().arc(0, Ro, Ro, -Math.PI / 2 + 0.12, 0, 10).line(Ro, H * 0.5).line(Ro, H - 0.25);
  const rd = rackDims(Ro, H);
  const p = buildProfile(type, w.pts, wall, {
    kind,
    material: opts.material ?? 'glass',
    nominalMl: nominal,
    graduations: [],
    gradTitle: opts.title ?? '',
    roundBottom: !opts.conicalH,
    baseOffsetY: rd.baseH,
    support: 'rack',
    supportR: rd.holeR,
    supportY: rd.plateY,
    footprintR: Math.max(6.5, rd.W / 2 + 0.5),
  });
  if (opts.tick) applyScale(p, nominal, opts.tick);
  return p;
}

// ------------------------------------------------------------------ gas handling
function gasTube(type: VesselType): VesselProfile {
  const Ri = 1.0;
  const wall = 0.12;
  const Ro = Ri + wall;
  const nominal = 50;
  const hemi = (2 / 3) * Math.PI * Ri * Ri * Ri;
  const scaleTop = Ro + (nominal - hemi) / (Math.PI * Ri * Ri);
  const H = scaleTop + 3.2;
  const w = new Wall().arc(0, Ro, Ro, -Math.PI / 2 + 0.12, 0, 12).line(Ro, H * 0.5).line(Ro, H - 0.25);
  const p = buildProfile(type, w.pts, wall, {
    kind: 'gas-tube',
    nominalMl: nominal,
    graduations: [],
    gradTitle: 'mL',
    gradNote: '',
    roundBottom: true,
    baseOffsetY: 1.2,
    support: 'stand',
    supportR: Ro + 0.2,
    supportY: H * 0.62,
    footprintR: 6,
  });
  applyScale(p, nominal, { minor: 1, mid: 5, major: 10 });
  return p;
}

function gasSyringe(type: VesselType): VesselProfile {
  const Ri = 1.5;
  const wall = 0.15;
  const Ro = Ri + wall;
  const nominal = 100;
  const yBarrel = 3.2; // the 0 mark: where the barrel starts
  const yTop = yBarrel + nominal / (Math.PI * Ri * Ri) + 2.4;
  const w = new Wall(0.22, 0);
  w.line(0.36, 1.8, 3).ease(Ro, yBarrel, 10).line(Ro, yTop - 0.4).line(Ro + 0.9, yTop - 0.15, 2);
  const p = buildProfile(type, w.pts, wall, {
    kind: 'gas-syringe',
    nominalMl: nominal,
    graduations: [],
    gradTitle: 'mL',
    gradNote: '',
    tip: new THREE.Vector3(0, 0, 0),
    openBottom: true,
    baseOffsetY: 1.2,
    support: 'stand',
    supportR: Ro + 0.2,
    supportY: yTop * 0.55,
    footprintR: 6,
    accessories: [{ kind: 'plunger', y: yBarrel, r: Ri, len: 17 }],
  });
  applyScale(p, nominal, { minor: 1, mid: 5, major: 10 }, { zeroY: yBarrel });
  return p;
}

function gasJar(type: VesselType): VesselProfile {
  const Ri = 2.75;
  const wall = 0.2;
  const Ro = Ri + wall;
  const H = 12.4;
  const c = 0.8;
  const w = new Wall(Ro - c, 0).arc(Ro - c, c, c, -Math.PI / 2, 0, 6).line(Ro, H - 1.1);
  w.ease(Ro + 0.3, H - 0.25, 5);
  return buildProfile(type, w.pts, wall, {
    kind: 'gas-jar',
    nominalMl: 250,
    graduations: [],
    gradTitle: '',
    accessories: [{ kind: 'lid', y: H, r: Ro + 0.3, len: 0.28 }],
  });
}

// ------------------------------------------------------------------ funnels
function separatoryFunnel(type: VesselType): VesselProfile {
  const nominal = 250;
  const wall = 0.18;
  const rs = 0.38; // stem outer radius
  const rn = 1.08; // neck outer radius
  const yStop = 6.2;
  const y0 = 9.8;
  const L1 = 11.5;
  const L2 = 4.2;
  const yTop = y0 + L1 + L2 + 4.8;
  const build = (Rb: number): VesselProfile => {
    const w = new Wall(rs, 0);
    w.line(rs, y0, 4);
    w.curve(y0 + L1, (t) => rs + (Rb - rs) * Math.pow(t, 0.8), 18);
    w.curve(y0 + L1 + L2, (t) => rn + (Rb - rn) * Math.pow(Math.cos((Math.PI / 2) * t), 0.75), 14);
    w.line(rn, yTop - 0.4).line(rn + 0.15, yTop);
    return buildProfile(type, w.pts, wall, {
      kind: 'sep-funnel',
      nominalMl: nominal,
      graduations: [],
      gradTitle: '',
      tip: new THREE.Vector3(0, 0, 0),
      openBottom: true,
      neckRadius: rn - wall,
      baseOffsetY: 14,
      support: 'stand',
      supportR: 2.2,
      supportY: y0 + L1 * 0.78,
      footprintR: 7.5,
      accessories: [
        { kind: 'stopcock', y: yStop, r: rs, len: 3.4 },
        { kind: 'joint', y: yTop, r: rn, len: 2.4 },
      ],
    });
  };
  const yBody = y0 + L1 + L2;
  const Rb = solveIncreasing((r) => (volumeAtHeight(build(r), yBody) - nominal) / nominal, 1.8, 6);
  const p = build(Rb);
  p.supportR = outerRadiusAt(p, p.supportY) + 0.2; // iron ring hugs the body
  return p;
}

function filterFunnel(type: VesselType): VesselProfile {
  const wall = 0.15;
  const stemR = 0.5;
  const Ro = 3.65; // 75 mm
  const stemLen = 6.5;
  const coneH = (Ro - stemR) * 1.732; // 60° funnel
  const yTop = stemLen + coneH;
  const w = new Wall(stemR * 0.7, 0);
  w.line(stemR, 0.6, 2).line(stemR, stemLen, 3).ease(stemR + 0.9, stemLen + 1.1, 5).line(Ro, yTop - 0.3).line(Ro + 0.1, yTop);
  const p = buildProfile(type, w.pts, wall, {
    kind: 'funnel',
    nominalMl: 75,
    graduations: [],
    gradTitle: '',
    tip: new THREE.Vector3(0, 0, 0),
    openBottom: true,
    baseOffsetY: 10,
    support: 'stand',
    supportR: 2.6,
    supportY: stemLen + coneH * 0.55,
    footprintR: 7,
  });
  p.supportR = outerRadiusAt(p, p.supportY) + 0.2;
  return p;
}

function buchnerFunnel(type: VesselType): VesselProfile {
  const wall = 0.4;
  const Ri = 4.15;
  const Ro = Ri + wall;
  const stemR = 0.8;
  const plateY = 5.4;
  const H = plateY + 3.1;
  const w = new Wall(stemR * 0.8, 0);
  w.line(stemR, 0.5, 2).line(stemR, 3.6, 2).ease(Ro - 0.2, plateY - 0.2, 10).line(Ro, plateY + 0.1).line(Ro, H - 0.25);
  const p = buildProfile(type, w.pts, wall, {
    kind: 'buchner-funnel',
    material: 'porcelain',
    nominalMl: 150,
    graduations: [],
    gradTitle: '',
    innerFloorY: plateY,
    tip: new THREE.Vector3(0, 0, 0),
    openBottom: true,
    baseOffsetY: 9,
    support: 'stand',
    supportR: 3.1,
    supportY: plateY - 1.4,
    footprintR: 7,
    accessories: [{ kind: 'plate', y: plateY, r: Ri }],
  });
  p.supportR = outerRadiusAt(p, p.supportY) + 0.2;
  return p;
}

// ------------------------------------------------------------------ dishes / open vessels
/** Bowl outer wall: flat base of radius `x0`, quarter-ellipse-like flank to the rim radius `Ro` at height `H`. */
function bowl(x0: number, Ro: number, H: number, thetaMax: number, n = 20): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const sm = Math.sin(thetaMax);
  const cm = 1 - Math.cos(thetaMax);
  for (let i = 0; i <= n; i++) {
    const th = (thetaMax * i) / n;
    pts.push(V2(x0 + ((Ro - x0) * Math.sin(th)) / sm, (H * (1 - Math.cos(th))) / cm));
  }
  return pts;
}

function evaporatingDish(type: VesselType): VesselProfile {
  const wall = 0.3;
  const pts = bowl(1.7, 4.2, 3.6, 1.25);
  return buildProfile(type, pts, wall, {
    kind: 'dish',
    material: 'porcelain',
    nominalMl: 100,
    graduations: [],
    gradTitle: '',
    spout: 0.5,
  });
}

function petriDish(type: VesselType): VesselProfile {
  const Ro = 4.5;
  const H = 1.5;
  const c = 0.25;
  const w = new Wall(Ro - c, 0).arc(Ro - c, c, c, -Math.PI / 2, 0, 4).line(Ro, H - 0.1);
  return buildProfile(type, w.pts, 0.1, {
    kind: 'petri',
    nominalMl: 50,
    graduations: [],
    gradTitle: '',
    accessories: [{ kind: 'lid', y: H, r: Ro + 0.12, len: 0.9 }],
  });
}

function watchGlass(type: VesselType): VesselProfile {
  const a = 3.75;
  const h = 1.1;
  const R = (a * a + h * h) / (2 * h);
  const thMax = Math.asin(a / R);
  const pts: THREE.Vector2[] = [];
  for (let i = 1; i <= 24; i++) {
    const th = (thMax * i) / 24;
    pts.push(V2(R * Math.sin(th), R * (1 - Math.cos(th))));
  }
  const ringR = 1.9;
  const ringT = 0.5;
  const yAtRing = R * (1 - Math.cos(Math.asin(ringR / R)));
  return buildProfile(type, pts, 0.1, {
    kind: 'watch-glass',
    nominalMl: 10,
    graduations: [],
    gradTitle: '',
    support: 'cork-ring',
    supportR: ringR,
    supportY: ringT,
    baseOffsetY: ringT * 2 - yAtRing,
    footprintR: a + 0.3,
  });
}

function crucible(type: VesselType): VesselProfile {
  const wall = 0.22;
  const w = new Wall(0.9, 0);
  w.line(1.2, 0.25, 2).line(2.25, 4.4, 8);
  return buildProfile(type, w.pts, wall, {
    kind: 'crucible',
    material: 'porcelain',
    nominalMl: 30,
    graduations: [],
    gradTitle: '',
  });
}

function weighBoat(type: VesselType): VesselProfile {
  const w = new Wall(1.6, 0);
  w.line(2.0, 0.15, 2).line(2.95, 1.6, 6);
  return buildProfile(type, w.pts, 0.07, {
    kind: 'weigh-boat',
    material: 'plastic',
    nominalMl: 25,
    graduations: [],
    gradTitle: '',
  });
}

// ------------------------------------------------------------------ dispatcher
export function buildCatalogProfile(type: VesselType): VesselProfile | undefined {
  switch (type) {
    // beakers: [Ri, H, wall, ticks]
    case 'beaker-50':
      return beaker(type, 50, 2.1, 6.0, 0.13, { minor: 5, major: 10 });
    case 'beaker-100':
      return beaker(type, 100, 2.5, 7.0, 0.15, { minor: 10, major: 20 });
    case 'beaker-250':
      return beaker(type, 250, 3.3, 9.5, 0.18, { minor: 25, major: 50 });
    case 'beaker-400':
      return beaker(type, 400, 3.8, 10.8, 0.2, { minor: 50, major: 100 });
    case 'beaker-600':
      return beaker(type, 600, 4.4, 12.2, 0.2, { minor: 50, major: 100 });
    case 'beaker-1000':
      return beaker(type, 1000, 5.2, 14.5, 0.22, { minor: 50, mid: 100, major: 200 });

    // conical flasks
    case 'erlenmeyer-50':
      return erlenmeyer(type, 50, { Rb: 2.6, H: 8.6, neckR: 1.2, shoulderY: 4.7, neckY: 5.6, wall: 0.12 }, { minor: 5, major: 10 }, 40);
    case 'erlenmeyer-125':
      return erlenmeyer(type, 125, { Rb: 3.3, H: 11.2, neckR: 1.5, shoulderY: 6.7, neckY: 7.7, wall: 0.15 }, { minor: 5, major: 25 }, 100);
    case 'erlenmeyer-250':
      return erlenmeyer(type, 250, { Rb: 4.25, H: 13.5, neckR: 1.7, shoulderY: 9.2, neckY: 10.2, wall: 0.18 }, { minor: 25, major: 50 }, 200);
    case 'erlenmeyer-500':
      return erlenmeyer(type, 500, { Rb: 5.25, H: 17.5, neckR: 2.05, shoulderY: 11.6, neckY: 12.9, wall: 0.2 }, { minor: 50, major: 100 }, 400);

    // round-bottom / boiling / filter flasks
    case 'round-bottom-50':
      return roundBottom(type, 50, 0.9, 3.4, 0.13);
    case 'round-bottom-100':
      return roundBottom(type, 100, 1.0, 3.8, 0.15);
    case 'round-bottom-250':
      return roundBottom(type, 250, 1.2, 4.4, 0.18);
    case 'round-bottom-500':
      return roundBottom(type, 500, 1.4, 5.2, 0.22);
    case 'florence-500':
      return florence(type);
    case 'buchner-flask-250':
      return filterFlask(type);

    // graduated cylinders (Ri = catalogue inner radius)
    case 'cylinder-10':
      return cylinder(type, 10, 0.6, 0.09, 0.6, { minor: 0.2, mid: 0.5, major: 1 });
    case 'cylinder-25':
      return cylinder(type, 25, 0.9, 0.1, 0.7, { minor: 0.5, mid: 1, major: 5 });
    case 'cylinder-50':
      return cylinder(type, 50, 1.2, 0.12, 0.8, { minor: 1, mid: 5, major: 10 });
    case 'cylinder-100':
      return cylinder(type, 100, 1.5, 0.15, 1.0, { minor: 1, mid: 5, major: 10 });
    case 'cylinder-250':
      return cylinder(type, 250, 2.2, 0.18, 1.2, { minor: 5, major: 25 });
    case 'cylinder-500':
      return cylinder(type, 500, 2.7, 0.22, 1.4, { minor: 10, major: 50 });
    case 'cylinder-1000':
      return cylinder(type, 1000, 3.3, 0.26, 1.8, { minor: 10, mid: 50, major: 100 });

    // volumetric flasks: neck inner radius at the ring, body height, neck length
    case 'volumetric-25':
      return volumetricFlask(type, 25, 0.65, 0.12, 5.0, 6.0);
    case 'volumetric-50':
      return volumetricFlask(type, 50, 0.75, 0.13, 6.0, 7.5);
    case 'volumetric-100':
      return volumetricFlask(type, 100, 0.85, 0.15, 7.5, 9.0);
    case 'volumetric-250':
      return volumetricFlask(type, 250, 1.0, 0.17, 9.5, 10.5);
    case 'volumetric-500':
      return volumetricFlask(type, 500, 1.2, 0.19, 11.5, 12.5);
    case 'volumetric-1000':
      return volumetricFlask(type, 1000, 1.4, 0.22, 14.0, 14.5);

    // burettes
    case 'burette-25':
      return burette(type, 25, 0.4, 0.11);
    case 'burette-50':
      return burette(type, 50, 0.525, 0.12);

    // pipettes
    case 'pipette-volumetric-10':
      return volumetricPipette(type, 10, 0.3, 0.08, 14, 7.5);
    case 'pipette-volumetric-25':
      return volumetricPipette(type, 25, 0.35, 0.09, 16, 9.5);
    case 'pipette-graduated-5':
      return graduatedPipette(type, 5, 0.3, 0.09, 6.0, { minor: 0.05, mid: 0.5, major: 1 });
    case 'pipette-graduated-10':
      return graduatedPipette(type, 10, 0.4, 0.1, 6.5, { minor: 0.1, mid: 0.5, major: 1 });
    case 'pipette-pasteur':
      return pasteurPipette(type);

    // tubes
    case 'test-tube':
      return tube(type, 'tube', 30, 0.9, 0.1, 15);
    case 'test-tube-small':
      return tube(type, 'tube', 8, 0.65, 0.1, 10);
    case 'boiling-tube-25':
      return tube(type, 'tube', 25, 1.1, 0.15, 15);
    case 'centrifuge-tube-15':
      return tube(type, 'centrifuge', 15, 0.8, 0.1, 12, { conicalH: 2.6, material: 'poly', tick: { minor: 1, major: 5 }, title: 'mL' });
    case 'centrifuge-tube-50':
      return tube(type, 'centrifuge', 50, 1.47, 0.12, 11.5, { conicalH: 3.2, material: 'poly', tick: { minor: 5, major: 10 }, title: 'mL' });

    // gas handling
    case 'gas-collection-tube-50':
      return gasTube(type);
    case 'gas-syringe-100':
      return gasSyringe(type);
    case 'gas-jar-250':
      return gasJar(type);

    // funnels
    case 'separatory-funnel-250':
      return separatoryFunnel(type);
    case 'filter-funnel-75':
      return filterFunnel(type);
    case 'buchner-funnel-90':
      return buchnerFunnel(type);

    // dishes
    case 'evaporating-dish-100':
      return evaporatingDish(type);
    case 'petri-dish-90':
      return petriDish(type);
    case 'watch-glass-75':
      return watchGlass(type);
    case 'crucible-30':
      return crucible(type);
    case 'weigh-boat':
      return weighBoat(type);
  }
  return undefined;
}
