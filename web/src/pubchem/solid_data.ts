// Browser entry point for precipitate lookups: rate-limited PubChem access + in-memory and localStorage caching
// (positive hits kept forever, "nothing found" for 24 h). Never throws.
import type { MineralLookup } from '../types/sim';
import { pubchemQueue } from './api';
import { cacheCompound } from './cache';
import { fetchSolidDataWith, type GetJson, type SolidLookupResult } from './solid_fetch';

const KEY_PREFIX = 'rc.solid.v1:';
const NEGATIVE_TTL_MS = 24 * 3600 * 1000;

interface CacheEntry {
  t: number;
  result: SolidLookupResult | null;
}

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<SolidLookupResult | null>>();
let warned = false;

const warnOnce = (...args: unknown[]) => {
  if (warned) return;
  warned = true;
  console.warn('[pubchem-solid]', ...args);
};

function readCache(species: string): CacheEntry | undefined {
  const mem = memory.get(species);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + species);
    if (!raw) return undefined;
    const e = JSON.parse(raw) as CacheEntry;
    if (typeof e?.t !== 'number') return undefined;
    memory.set(species, e);
    return e;
  } catch {
    return undefined; // storage unavailable or corrupt entry
  }
}

function writeCache(species: string, entry: CacheEntry, persist: boolean) {
  memory.set(species, entry);
  if (!persist) return;
  try {
    localStorage.setItem(KEY_PREFIX + species, JSON.stringify(entry));
  } catch {
    /* storage unavailable / full: memory cache still works */
  }
}

const getJson: GetJson = (url) =>
  pubchemQueue.push(async () => {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`PubChem returned ${res.status}`);
    return res.json();
  });

/** PubChem data + reagent record for a solid the engine had to guess; null if nothing usable was found. */
export function fetchSolidData(lookup: MineralLookup): Promise<SolidLookupResult | null> {
  const species = lookup.solid_species;
  const cached = readCache(species);
  if (cached) {
    if (cached.result) return Promise.resolve(cached.result);
    if (Date.now() - cached.t < NEGATIVE_TTL_MS) return Promise.resolve(null);
  }
  const running = inflight.get(species);
  if (running) return running;

  const p = (async () => {
    try {
      const result = await fetchSolidDataWith(lookup, getJson);
      writeCache(species, { t: Date.now(), result }, true);
      if (result?.record) void cacheCompound(result.record).catch(() => {}); // shares the IndexedDB cache with hand imports
      return result;
    } catch (err) {
      // Network / server trouble: remember for this session only, so a later visit retries.
      warnOnce(`lookup failed for ${species}:`, err);
      writeCache(species, { t: Date.now(), result: null }, false);
      return null;
    } finally {
      inflight.delete(species);
    }
  })();
  inflight.set(species, p);
  return p;
}
