// Molecular viewer: the schematic lattice patch of a solid surface (pure maths, no three.js; tests/micro_slab.mjs).
//
// The engine says what a solid is made of (`vessel_micro_lattice`: ions or atoms with counts and radii), not how they are packed:
// that needs crystallographic data, which is out of scope (docs/plans/reaction-viewer-plan.md, 4.5 and 8). The patch is
// therefore a *schematic packing* chosen by the formula ratio and labelled so:
//   - an element (a metal, graphite)   close-packed layers (triangular layers, ABC stacking), nearest distance 2 r;
//   - 1 : 1 ionic                      rock-salt: a cubic grid of alternating ions, nearest distance r+ + r-;
//   - 1 : 2 / 2 : 1                    fluorite / anti-fluorite: the majority ion in the tetrahedral holes of an fcc array of the other;
//   - any other ratio                  a cubic grid filled in the formula ratio, each site taking the ion that has the fewest
//                                      like-charged neighbours (a greedy fill; the spacing is the largest ion pair contact).
// Local coordinates in angstrom: x, z in the plane (centred on 0), y up; the top layer is at y = 0 and lower layers at y < 0.
import type { MicroLatticeData } from '../types/sim';

export interface LatticeSite {
  id: number;
  /** Species that belongs at this position (`Ba+2`, `Zn(s)`). */
  species: string;
  /** 0 = the bottom layer, `layers - 1` = the top (growth) layer. */
  layer: number;
  x: number;
  y: number;
  z: number;
  /** Sites of the layer below that hold this one up, and of the layer above that rest on it. */
  below: number[];
  above: number[];
  /** All sites within bonding distance (any layer). */
  nbr: number[];
}

export interface SlabLayout {
  sites: LatticeSite[];
  layers: number;
  /** Extent in x and z (centre to centre of the outermost sites plus one spacing), A. */
  width: number;
  depth: number;
  /** Nearest distance between sites, A. */
  spacing: number;
  /** Depth of the slab: top layer to bottom layer, A. */
  height: number;
  /** "rock-salt" | "fluorite" | "anti-fluorite" | "close-packed" | "cubic" */
  packing: string;
  /** What the legend says about it ("schematic packing: rock-salt"). */
  note: string;
  /** Formula units: ions of each species per formula unit. */
  unit: Array<{ species: string; count: number }>;
}

export interface SlabOptions {
  /** Wanted edge of the patch in the plane, A (the nearest whole number of cells is used, at least 2). */
  footprint: number;
  /** Layers including the growth layer on top (default 5). */
  layers?: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RawSite {
  species: string;
  x: number;
  y: number;
  z: number;
}

/** The ion species of a lattice with its charge sign and radius, cations first (the engine sorts them so). */
function ionsOf(l: MicroLatticeData) {
  return l.ions.map((i) => ({ species: i.species, count: Math.max(1, Math.round(i.count)), radius: Math.max(0.4, i.radius_a), charge: i.charge }));
}

/** Layer index of every raw site: sites at (nearly) the same height share a layer; 0 is the lowest. */
function layerOf(raw: RawSite[]): { layer: number[]; heights: number[] } {
  const ys = [...new Set(raw.map((s) => Math.round(s.y * 1000) / 1000))].sort((a, b) => a - b);
  return { layer: raw.map((s) => ys.indexOf(Math.round(s.y * 1000) / 1000)), heights: ys };
}

function closePacked(species: string, r: number, nx: number, nz: number, layers: number): RawSite[] {
  const d = 2 * r;
  const dy = d * Math.sqrt(2 / 3);
  const out: RawSite[] = [];
  for (let k = 0; k < layers; k++) {
    // ABC stacking: each layer is shifted by one third of the in-plane diagonal
    const shiftX = ((k % 3) * d) / 2;
    const shiftZ = ((k % 3) * d * Math.sqrt(3)) / 6;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        out.push({ species, x: i * d + (j % 2) * (d / 2) + shiftX, z: j * d * (Math.sqrt(3) / 2) + shiftZ, y: k * dy });
      }
    }
  }
  return out;
}

function rockSalt(a: string, b: string, d: number, nx: number, nz: number, layers: number): RawSite[] {
  const out: RawSite[] = [];
  for (let k = 0; k < layers; k++) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) out.push({ species: (i + j + k) % 2 === 0 ? a : b, x: i * d, z: j * d, y: k * d });
  return out;
}

/** Fluorite: `fcc` ions on a face-centred cubic array of edge a, `hole` ions in the tetrahedral holes (twice as many). */
function fluorite(fcc: string, hole: string, a: number, nx: number, nz: number, layers: number): RawSite[] {
  const out: RawSite[] = [];
  const cat: Array<[number, number, number]> = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
  const an: Array<[number, number, number]> = [];
  for (const x of [0.25, 0.75]) for (const y of [0.25, 0.75]) for (const z of [0.25, 0.75]) an.push([x, y, z]);
  // a layer is a quarter of a cell: whole cells up to the height wanted, then the plane of fcc ions that closes the top
  const cells = Math.max(1, Math.ceil((layers - 1) / 4));
  for (let cy = 0; cy < cells; cy++) {
    for (let cz = 0; cz < nz; cz++) {
      for (let cx = 0; cx < nx; cx++) {
        for (const [fx, fy, fz] of cat) out.push({ species: fcc, x: (cx + fx) * a, y: (cy + fy) * a, z: (cz + fz) * a });
        for (const [fx, fy, fz] of an) out.push({ species: hole, x: (cx + fx) * a, y: (cy + fy) * a, z: (cz + fz) * a });
      }
    }
  }
  for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) for (const [fx, , fz] of cat.filter((c) => c[1] === 0)) out.push({ species: fcc, x: (cx + fx) * a, y: cells * a, z: (cz + fz) * a });
  return out;
}

/** A cubic grid filled in the formula ratio by the greedy rule of the module documentation. */
function cubicMixed(unit: Array<{ species: string; count: number; charge: number }>, d: number, nx: number, nz: number, layers: number, seed: number): RawSite[] {
  const rnd = mulberry32(seed);
  const total = unit.reduce((s, u) => s + u.count, 0);
  const n = nx * nz * layers;
  const target = unit.map((u) => (u.count / total) * n);
  const placed = unit.map(() => 0);
  const grid = new Map<string, number>(); // site key -> unit index
  const out: RawSite[] = [];
  const key = (i: number, j: number, k: number) => `${i},${j},${k}`;
  for (let k = 0; k < layers; k++) {
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        let best = 0;
        let bestScore = Infinity;
        for (let u = 0; u < unit.length; u++) {
          // a species ahead of its share is penalised first (the formula ratio holds), like charges next to each other a little
          let like = 0;
          for (const [di, dj, dk] of [[-1, 0, 0], [0, -1, 0], [0, 0, -1]] as const) {
            const o = grid.get(key(i + di, j + dj, k + dk));
            if (o !== undefined && Math.sign(unit[o].charge) === Math.sign(unit[u].charge)) like += 1;
          }
          const ahead = (placed[u] + 1) / Math.max(1e-9, target[u]);
          const score = ahead + (0.6 * like + 0.2 * rnd()) / n;
          if (score < bestScore) {
            bestScore = score;
            best = u;
          }
        }
        placed[best] += 1;
        grid.set(key(i, j, k), best);
        out.push({ species: unit[best].species, x: i * d, z: j * d, y: k * d });
      }
    }
  }
  return out;
}

/** Builds the patch for a solid's lattice composition. */
export function buildSlab(l: MicroLatticeData, opts: SlabOptions): SlabLayout {
  const layersWanted = Math.max(3, Math.min(8, opts.layers ?? 5));
  const ions = ionsOf(l);
  const unit = ions.map((i) => ({ species: i.species, count: i.count }));
  let raw: RawSite[] = [];
  let packing = 'cubic';
  let spacing = 2.8;
  const cellsFor = (d: number) => Math.max(2, Math.min(7, Math.round(opts.footprint / d)));

  if (l.kind === 'metal' || ions.length === 1) {
    const r = ions[0].radius;
    spacing = 2 * r;
    const nx = cellsFor(spacing);
    const nz = Math.max(2, Math.round(nx / (Math.sqrt(3) / 2)) - 1);
    raw = closePacked(ions[0].species, r, nx, Math.min(nz, 7), layersWanted);
    packing = 'close-packed';
  } else if (ions.length === 2 && ions[0].count === 1 && ions[1].count === 1) {
    spacing = ions[0].radius + ions[1].radius;
    const n = cellsFor(spacing);
    raw = rockSalt(ions[0].species, ions[1].species, spacing, n, n, layersWanted);
    packing = 'rock-salt';
  } else if (ions.length === 2 && Math.min(ions[0].count, ions[1].count) * 2 === Math.max(ions[0].count, ions[1].count)) {
    // the minority ion forms the fcc array (Ca in CaF2), the majority sits in the tetrahedral holes
    const [minor, major] = ions[0].count < ions[1].count ? [ions[0], ions[1]] : [ions[1], ions[0]];
    spacing = minor.radius + major.radius;
    const a = (4 * spacing) / Math.sqrt(3);
    const n = Math.max(2, Math.min(4, Math.round(opts.footprint / a)));
    raw = fluorite(minor.species, major.species, a, n, n, layersWanted);
    packing = ions[0].count < ions[1].count ? 'fluorite' : 'anti-fluorite';
    spacing = (a * Math.sqrt(3)) / 4;
  } else {
    spacing = Math.max(...ions.map((i) => i.radius)) + Math.min(...ions.map((i) => i.radius)) * 0.9;
    const n = cellsFor(spacing);
    raw = cubicMixed(ions, spacing, n, n, layersWanted, hash(l.species));
    packing = 'cubic';
  }

  const { layer, heights } = layerOf(raw);
  const layers = heights.length;
  // centre in the plane; the top layer at y = 0
  const xs = raw.map((s) => s.x);
  const zs = raw.map((s) => s.z);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const top = heights[layers - 1];
  let sites: LatticeSite[] = raw.map((s, id) => ({ id, species: s.species, layer: layer[id], x: s.x - cx, y: s.y - top, z: s.z - cz, below: [], above: [], nbr: [] }));

  // neighbours: within 1.2 of the nearest distance of this lattice; a site on the open edge of the patch whose supporting
  // neighbours lie outside it (a fluorite patch is not closed on its far sides) is dropped, then the links are made again
  const link = (list: LatticeSite[]): number => {
    let nn = Infinity;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const d = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y, list[i].z - list[j].z);
        if (d > 1e-6 && d < nn) nn = d;
      }
    }
    const reach = nn * 1.2;
    for (const s of list) {
      s.below = [];
      s.above = [];
      s.nbr = [];
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > reach) continue;
        a.nbr.push(j);
        b.nbr.push(i);
        if (a.layer === b.layer + 1) {
          a.below.push(j);
          b.above.push(i);
        } else if (b.layer === a.layer + 1) {
          b.below.push(i);
          a.above.push(j);
        }
      }
    }
    return nn;
  };
  let nn = link(sites);
  for (let pass = 0; pass < 6; pass++) {
    const keep = sites.filter((s) => s.layer === 0 || s.below.length > 0);
    if (keep.length === sites.length) break;
    sites = keep.map((s, id) => ({ ...s, id }));
    nn = link(sites);
  }
  const width = Math.max(...sites.map((s) => s.x)) - Math.min(...sites.map((s) => s.x)) + spacing;
  const depth = Math.max(...sites.map((s) => s.z)) - Math.min(...sites.map((s) => s.z)) + spacing;
  const height = top - heights[0];
  return { sites, layers, width, depth, spacing: nn, height, packing, note: `schematic packing: ${packing}`, unit };
}
