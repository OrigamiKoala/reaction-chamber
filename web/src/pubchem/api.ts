// PubChem API Client with rate limiting queue, PUG REST/View parsing, and bundle fallback
import type { SpeciesRecord } from '../types';
import { buildSpeciesRecord, PUG_PROPERTIES, type BuildRecordOptions } from './record_builder';
import { phaseAtRoom } from './parser';
import { authHeaders } from './session';
import { cacheCompound, getCachedCompound } from './cache';

let localBundleSpecies: Record<string, SpeciesRecord> | null = null;

// Load static bundle species for instant lookup and fallback
export async function initDataBundle(): Promise<Record<string, SpeciesRecord>> {
  if (localBundleSpecies) return localBundleSpecies;
  try {
    const res = await fetch('/data/bundle.json');
    if (res.ok) {
      const data = await res.json();
      localBundleSpecies = data.species || {};
      console.log(`[DataBundle] Loaded ${Object.keys(localBundleSpecies || {}).length} bundle species.`);
      return localBundleSpecies || {};
    }
  } catch (err) {
    console.warn('[DataBundle] Failed to fetch bundle.json, running standalone:', err);
  }
  return {};
}

// Queue for rate-limiting PubChem requests (5 per second = 200ms spacing)
class RequestQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private minIntervalMs = 210;

  push<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        await item();
        await new Promise((r) => setTimeout(r, this.minIntervalMs));
      }
    }
    this.processing = false;
  }
}

export const pubchemQueue = new RequestQueue();

export async function searchPubChemAutocomplete(term: string): Promise<string[]> {
  const query = term.trim();
  if (!query) return [];

  // 1. Check local bundle first for instant feedback
  const bundle = await initDataBundle();
  const matchedNames: string[] = [];
  const lower = query.toLowerCase();

  for (const s of Object.values(bundle)) {
    if (s.name.toLowerCase().includes(lower) || s.formula.toLowerCase().includes(lower)) {
      matchedNames.push(s.name);
      if (matchedNames.length >= 6) break;
    }
  }

  // 2. Fetch live PubChem autocomplete if online
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(query)}/json?limit=6`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const liveSuggestions: string[] = data?.dictionary_terms?.compound || [];
      const combined = Array.from(new Set([...matchedNames, ...liveSuggestions]));
      return combined.slice(0, 8);
    }
  } catch {
    // Network offline or blocked: fallback to local matches
  }

  return matchedNames.slice(0, 8);
}

/**
 * Static-bundle entry for a name. Names only: a CID is not a safe key (formed products carry real PubChem CIDs that
 * the bundle used to shadow with fabricated records). Identity matching after a PubChem lookup uses the InChIKey.
 */
async function bundleEntryFor(term: string): Promise<SpeciesRecord | undefined> {
  const bundle = await initDataBundle();
  return Object.values(bundle).find((s) => s.name.toLowerCase() === term.toLowerCase());
}

/** Static-bundle entry with this InChIKey (identity), if any. */
async function bundleEntryByInchiKey(inchiKey: string | undefined): Promise<SpeciesRecord | undefined> {
  if (!inchiKey) return undefined;
  const bundle = await initDataBundle();
  return bundle[inchiKey] ?? Object.values(bundle).find((s) => s.inchi_key === inchiKey);
}

/** PUG View record for a CID (null if unavailable): experimental MP/BP/density/hazards/colour text. */
async function fetchPugView(cid: number | string): Promise<unknown | null> {
  try {
    const viewRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON`);
    return viewRes.ok ? await viewRes.json() : null;
  } catch {
    return null; // use bundle/defaults if the view fails
  }
}

async function cacheQuietly(rec: SpeciesRecord) {
  try {
    await cacheCompound(rec);
  } catch {
    // Non-blocking cache failure
  }
}

/** Antoine / Wagner samples above this pressure (Pa) are rejected: no liquid is that volatile at a bench temperature. */
export const MAX_SAMPLED_VP_PA = 1e8;

/**
 * Vapour-pressure points sampled from Antoine blocks *inside each block's stated validity range* (never outside, never
 * with an invented default range). A sample above 1e8 Pa (a mis-parsed table) or below 1e-6 Pa is dropped.
 */
export function sampleAntoine(blocks: Array<{ a_pa?: number; b_pa?: number; c_pa?: number; t_min_k?: number; t_max_k?: number }>): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (const ant of blocks) {
    const { a_pa, b_pa, c_pa, t_min_k, t_max_k } = ant;
    if (![a_pa, b_pa, c_pa, t_min_k, t_max_k].every((x) => typeof x === 'number' && isFinite(x))) continue;
    const lo = t_min_k as number;
    const hi = t_max_k as number;
    if (!(hi > lo)) continue;
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const t = lo + ((hi - lo) * i) / n;
      const d = t + (c_pa as number);
      if (!(d > 1)) continue;
      const pPa = Math.exp((a_pa as number) - (b_pa as number) / d);
      if (isFinite(pPa) && pPa > 1e-6 && pPa <= MAX_SAMPLED_VP_PA) pts.push([t, pPa]);
    }
  }
  return pts;
}

/** Proxy fields that are estimates (Joback / Trouton ...) rather than data: they never become `known`. */
function proxyEstimated(data: any): Set<string> {
  const out = new Set<string>(Array.isArray(data?.estimated_fields) ? data.estimated_fields : []);
  const src = String(data?.provenance?.t_boil_k ?? data?.provenance?.formula ?? '');
  if (/joback|estimat/i.test(src)) out.add('t_boil_k').add('t_fus_k');
  return out;
}

/** Enriches a record with NIST WebBook / curated core data from the local server proxy. */
export async function enrichWithLocalDataProxy(rec: SpeciesRecord): Promise<SpeciesRecord> {
  try {
    const params = new URLSearchParams();
    if (rec.formula) params.set('formula', rec.formula);
    if (rec.name) params.set('name', rec.name);
    if (rec.smiles) params.set('smiles', rec.smiles);
    if (rec.inchi_key) params.set('inchikey', rec.inchi_key);

    const res = await fetch(`/api/data/properties?${params.toString()}`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      const phys = rec.physical ? { ...rec.physical } : {};
      const estimated = proxyEstimated(data);

      // Measured proxy values fill what PubChem did not give; an estimate may fill the display value but is never `known`.
      if (data.t_boil_k && (!rec.known?.bp_c || rec.bp_c === 100)) {
        rec.bp_c = data.t_boil_k - 273.15;
        if (rec.known) rec.known.bp_c = !estimated.has('t_boil_k');
      }
      if (data.t_fus_k && (!rec.known?.mp_c || rec.mp_c === 20)) {
        rec.mp_c = data.t_fus_k - 273.15;
        if (rec.known) rec.known.mp_c = !estimated.has('t_fus_k');
      }
      if (data.dh_vap_kj_mol && !phys.dh_vap_kj_mol && !estimated.has('dh_vap_kj_mol')) {
        phys.dh_vap_kj_mol = data.dh_vap_kj_mol;
      }
      if (data.dh_fus_kj_mol && !phys.dh_fus_kj_mol && !estimated.has('dh_fus_kj_mol')) {
        phys.dh_fus_kj_mol = data.dh_fus_kj_mol;
      }
      // Intrinsic enthalpy / entropy of formation keep the phase they were measured for: never "solid ?? liquid ?? gas".
      const phaseOrder: Array<'solid' | 'liquid' | 'gas'> = [phaseAtRoom(rec.mp_c, rec.bp_c, rec.physical_state), 'solid', 'liquid', 'gas'];
      for (const ph of phaseOrder) {
        const v = data[`dhf_${ph}_kj_mol`];
        if (v !== undefined && phys.dhf_kj_mol === undefined) {
          phys.dhf_kj_mol = v;
          phys.dhf_phase = ph;
        }
        const s0 = data[`s_${ph}_j_mol_k`];
        if (s0 !== undefined && phys.s_j_mol_k === undefined) {
          phys.s_j_mol_k = s0;
          phys.s_phase = ph;
        }
      }
      if (typeof data.tc_k === 'number' && data.tc_k > 0) phys.tc_k = data.tc_k;
      if (Array.isArray(data.antoine) && data.antoine.length > 0) {
        // keep the blocks with their ranges, and sample them only inside those ranges
        phys.antoine = data.antoine
          .filter((a: any) => [a.a_pa, a.b_pa, a.c_pa, a.t_min_k, a.t_max_k].every((x: unknown) => typeof x === 'number' && isFinite(x as number)))
          .map((a: any) => ({ a_pa: a.a_pa, b_pa: a.b_pa, c_pa: a.c_pa, t_min_k: a.t_min_k, t_max_k: a.t_max_k }));
        const pts: Array<[number, number]> = [...(phys.vapor_pressure_points ?? []), ...sampleAntoine(data.antoine)];
        if (pts.length > 0) phys.vapor_pressure_points = pts.sort((a, b) => a[0] - b[0]);
      }
      if (Array.isArray(data.cp_coefficients) && data.cp_coefficients.length > 0 && data.cp_coefficients.every((x: unknown) => typeof x === 'number')) {
        phys.cp_coefficients = data.cp_coefficients;
      }
      // the proxy's record-level tier never replaces a PubChem record's tier with a better one
      if (data.tier && (rec.tier === 'speculative' || !rec.tier)) {
        rec.tier = data.tier;
      }
      rec.physical = Object.keys(phys).length > 0 ? phys : undefined;
    }
  } catch {
    // Non-blocking: local proxy not reachable or network offline
  }
  return rec;
}

/** Fetches the property row at `url`, adds the PUG View record and builds the SpeciesRecord (queued, rate-limited). */
async function importFromPropertyUrl(url: string, term: string, foundInBundle: SpeciesRecord | undefined, opts: BuildRecordOptions): Promise<SpeciesRecord> {
  return pubchemQueue.push(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`PubChem returned ${res.status}`);
    const data = await res.json();
    const prop = data?.PropertyTable?.Properties?.[0];
    if (!prop) throw new Error('Compound not found in PubChem');
    const viewData = await fetchPugView(prop.CID);
    // identity decides which bundle entry (if any) describes this compound: its InChIKey, or the name it was asked by
    const bundleEntry = (await bundleEntryByInchiKey(prop.InChIKey)) ?? foundInBundle;
    const speciesRecord = buildSpeciesRecord(prop, viewData, bundleEntry, term, opts);
    const enriched = await enrichWithLocalDataProxy(speciesRecord);
    await cacheQuietly(enriched);
    return enriched;
  });
}

export async function importCompound(nameOrTerm: string): Promise<SpeciesRecord> {
  const term = nameOrTerm.trim();

  // Check bundle by exact or case-insensitive name
  const foundInBundle = await bundleEntryFor(term);

  // Check IndexedDB cache
  if (foundInBundle) {
    try {
      const cached = await getCachedCompound(foundInBundle.inchi_key);
      if (cached) return cached;
    } catch {
      // Non-blocking cache lookup
    }
  }

  // Try live PubChem PUG REST
  try {
    return await importFromPropertyUrl(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(term)}/property/${PUG_PROPERTIES}/JSON`,
      term,
      foundInBundle,
      {},
    );
  } catch (err) {
    // If live fetch fails, use bundle match or fallback
    if (foundInBundle) {
      await cacheQuietly(foundInBundle);
      return foundInBundle;
    }

    // Fallback: try local database proxy directly
    try {
      const res = await fetch(`/api/data/properties?name=${encodeURIComponent(term)}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.formula || data.mw || data.t_boil_k) {
          const fallbackRec: SpeciesRecord = {
            inchi_key: data.inchikey || `local-${term}`,
            name: data.name || term,
            formula: data.formula || term,
            smiles: data.smiles || '',
            charge: 0,
            mw: data.mw || 0,
            mp_c: data.t_fus_k ? data.t_fus_k - 273.15 : 20.0,
            bp_c: data.t_boil_k ? data.t_boil_k - 273.15 : 100.0,
            density: 1.0,
            solubility: 'soluble',
            ghs: [],
            tier: data.tier || 'imported',
            source: data.provenance?.formula || 'Local Data Proxy',
            known: { mp_c: !!data.t_fus_k, bp_c: !!data.t_boil_k, density: false },
          };
          const enriched = await enrichWithLocalDataProxy(fallbackRec);
          await cacheQuietly(enriched);
          return enriched;
        }
      }
    } catch {
      // ignore
    }

    throw new Error(`Could not find or import "${term}".`);
  }
}

/** Same record `importCompound` would build, for a known PubChem CID (e.g. a product the engine formed). */
export async function importCompoundByCid(cid: number, opts: BuildRecordOptions = {}): Promise<SpeciesRecord> {
  const foundInBundle = undefined; // a CID is not a bundle key; identity is matched by InChIKey after the lookup
  try {
    return await importFromPropertyUrl(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/${PUG_PROPERTIES}/JSON`,
      `CID ${cid}`,
      foundInBundle,
      opts,
    );
  } catch (err) {
    if (foundInBundle) return foundInBundle;
    throw new Error(`Could not import PubChem CID ${cid}.`);
  }
}
