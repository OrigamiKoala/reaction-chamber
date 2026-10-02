// Looks up a precipitate's solubility / colour / density / name on PubChem (PUG REST + PUG View). The network is
// injected (`GetJson`) so the same code runs in the browser (rate-limited queue, see solid_data.ts) and in Node
// (tests/pubchem_solid_live.mjs). Only imports pure modules.
import type { SpeciesRecord } from '../types';
import type { MineralData, MineralLookup } from '../types/sim';
import { collectPugViewStrings, parseColourWord } from './parser';
import { buildSpeciesRecord, PUG_PROPERTIES } from './record_builder';
import {
  parseWaterSolubilityGPerL,
  parseKsp,
  parseQualitativeSolubility,
  parseSolidKind,
  parseSolidDensity,
  srgbHexToLinear,
} from './solubility_parser';

/** GET a PubChem URL as JSON. Resolve `null` for "not found" (404); throw for network / server errors. */
export type GetJson = (url: string) => Promise<any | null>;

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest';
const MAX_VIEW_CANDIDATES = 3;
const HEADINGS = ['Solubility', 'Physical Description', 'Color/Form', 'Density', 'Solubility Product', 'Dissociation Constants'];

interface Candidate {
  cid: number;
  title: string;
  /** PUG REST property row (see PUG_PROPERTIES). */
  prop: any;
}

/** What a lookup yields: data for the engine's mineral registry, plus the compound as a full reagent record. */
export interface SolidLookupResult {
  data: MineralData;
  /** Same shape as a hand-imported compound (state defaults to 'solid'); null if it could not be built. */
  record: SpeciesRecord | null;
}

/** Neutral records whose formula is exactly the engine's Hill formula (PubChem also lists ions / isotopologues). */
async function findCandidates(hill: string, getJson: GetJson): Promise<Candidate[]> {
  const ids = await getJson(`${PUG}/pug/compound/fastformula/${encodeURIComponent(hill)}/cids/JSON?MaxRecords=10`);
  const cids: number[] = (ids?.IdentifierList?.CID ?? []).slice(0, 6);
  if (cids.length === 0) return [];
  const props = await getJson(`${PUG}/pug/compound/cid/${cids.join(',')}/property/${PUG_PROPERTIES}/JSON`);
  const rows: any[] = props?.PropertyTable?.Properties ?? [];
  const byCid = new Map<number, any>(rows.map((r) => [r.CID, r]));
  const out: Candidate[] = [];
  for (const cid of cids) {
    const r = byCid.get(cid);
    if (!r || r.Charge !== 0 || r.MolecularFormula !== hill) continue;
    out.push({ cid, title: typeof r.Title === 'string' ? r.Title : '', prop: r });
  }
  return out;
}

/** "Copper sulfide (CuS)" -> "Copper sulfide"; CID placeholders -> ''. */
function cleanTitle(t: string): string {
  if (/^CID\s*\d+/i.test(t)) return '';
  return t.replace(/\s*\([A-Z][A-Za-z0-9]*\)$/, '').trim();
}

interface Facts {
  solubility?: number;
  logKsp?: number;
  qualitative?: MineralData['qualitative'];
  colour?: [number, number, number];
  density?: number;
  kind?: MineralData['kind'];
}

function factsFrom(view: any, molarMass: number): Facts {
  const h = collectPugViewStrings(view, HEADINGS);
  const get = (k: string) => h[k] ?? [];
  const solTexts = [...get('Solubility'), ...get('Physical Description')];
  const kspTexts = [...get('Solubility Product'), ...get('Dissociation Constants'), ...get('Solubility')];
  const looks = [...get('Color/Form'), ...get('Physical Description')];
  const hex = parseColourWord(looks);
  return {
    solubility: parseWaterSolubilityGPerL(solTexts, molarMass),
    logKsp: parseKsp(kspTexts),
    qualitative: parseQualitativeSolubility(solTexts),
    colour: hex ? srgbHexToLinear(hex) : undefined,
    density: parseSolidDensity(get('Density')),
    kind: looks.length > 0 ? parseSolidKind(looks) : undefined,
  };
}

/**
 * PubChem data for the solid in `lookup`, or null when PubChem has nothing usable. Looks at up to 3 candidate records
 * and stops at the first with numeric solubility (or a stated Ksp); otherwise uses the first record's words/colour.
 * Throws on network errors (callers decide whether that is cacheable).
 */
export async function fetchSolidDataWith(lookup: MineralLookup, getJson: GetJson): Promise<SolidLookupResult | null> {
  const cands = await findCandidates(lookup.hill_formula, getJson);
  if (cands.length === 0) return null;

  type Picked = { c: Candidate; f: Facts; view: unknown };
  let chosen: Picked | undefined;
  let first: Picked | undefined;
  for (const c of cands.slice(0, MAX_VIEW_CANDIDATES)) {
    const view = await getJson(`${PUG}/pug_view/data/compound/${c.cid}/JSON`);
    if (!view) continue;
    const f = factsFrom(view, lookup.molar_mass);
    first ??= { c, f, view };
    if (f.solubility !== undefined || f.logKsp !== undefined) {
      chosen = { c, f, view };
      break;
    }
  }
  chosen ??= first;
  if (!chosen) return null;

  const { c, f, view } = chosen;
  const fb = first?.f; // appearance may be missing on the chosen record but present on the first
  const colour = f.colour ?? fb?.colour;
  const density = f.density ?? fb?.density;
  if (f.solubility === undefined && f.logKsp === undefined && !f.qualitative && !colour && density === undefined) return null;

  const data: MineralData = { solid_species: lookup.solid_species, source: `PubChem CID ${c.cid}`, cid: c.cid };
  const name = cleanTitle(c.title || first?.c.title || '');
  if (name) data.name = name;
  if (f.solubility !== undefined) data.solubility_g_per_l = f.solubility;
  if (f.logKsp !== undefined) data.log_ksp = f.logKsp;
  if (f.qualitative) data.qualitative = f.qualitative;
  if (colour) data.color_linear_rgb = colour;
  if (density !== undefined) data.density_g_ml = density;
  const kind = f.kind ?? fb?.kind;
  if (kind) data.kind = kind;

  // The product may be a reactant next: describe it like a hand-imported compound (state defaults to solid).
  let record: SpeciesRecord | null = null;
  try {
    record = buildSpeciesRecord(c.prop, view, undefined, name || lookup.formula, { defaultState: 'solid' });
    if (name) record.name = name;
    if (density !== undefined) {
      record.density = density; // bare numbers ("4.6 @25 °C") that the unit-based parser skips
      record.known = { ...record.known, density: true };
    }
    if (f.qualitative) record.solubility = f.qualitative.replace(/_/g, ' ');
    else if (f.solubility !== undefined) record.solubility = `${f.solubility.toPrecision(2)} g/L`;
  } catch {
    record = null;
  }
  return { data, record };
}
