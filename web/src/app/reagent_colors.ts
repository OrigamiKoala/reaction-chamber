import * as THREE from 'three';
import { SimController } from '../sim/sim_controller';
import { DoseRequest, OpticsTables, ReagentCatalogEntry, VesselSnapshot } from '../types/sim';
import { computeSpectralColor, scatterSummary } from '../render/liquid_shader';
import { loadJSON, saveJSON } from './storage';

/**
 * Data-driven bottle colours: each reagent is dosed into a throwaway engine vessel once and its colour is
 * derived from the engine's own snapshot (Beer–Lambert over the layer absorbance spectrum + turbidity, or the
 * solid's reflectance colour). Works for any catalog size; results are cached per reagent id.
 */

/** v2: the store records the engine optics-data hash its colours were computed from; a different hash discards them. */
const STORE_KEY = 'rc.reagentColors.v2';
/** Light path through a typical reagent bottle, cm. */
const BOTTLE_PATH_CM = 6.0;

interface ColourStore {
  version: string;
  colors: Record<string, string>;
}
const stored = loadJSON<ColourStore>(STORE_KEY, { version: '', colors: {} });
/** Engine optics-data version the in-memory colours are valid for ('' until `setOpticsDataVersion` is called). */
let cacheVersion = stored.version;
const cache = new Map<string, string>(Object.entries(stored.colors ?? {}));

function persist() {
  saveJSON(STORE_KEY, { version: cacheVersion, colors: Object.fromEntries(cache) } satisfies ColourStore);
}

/**
 * Tells the cache which optics data the engine runs on. Colours computed from different absorption data are dropped,
 * so a change to the engine's spectra can never leave stale bottle colours behind.
 */
export function setOpticsDataVersion(version: string | undefined) {
  if (!version || version === cacheVersion) return;
  cache.clear();
  inflight.clear();
  cacheVersion = version;
  persist();
}
const inflight = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();
let probeSeq = 0;

function toHex(r: number, g: number, b: number): string {
  const c = new THREE.Color().setRGB(
    Math.min(1, Math.max(0, r)),
    Math.min(1, Math.max(0, g)),
    Math.min(1, Math.max(0, b)),
    THREE.LinearSRGBColorSpace
  );
  return '#' + c.getHexString(THREE.SRGBColorSpace);
}

function colourFromSnapshot(snap: VesselSnapshot, optics: OpticsTables | null): string | null {
  const solid = snap.solids.find((s) => s.mass_g > 1e-6);
  if (snap.total_liquid_ml <= 0.01) {
    return solid ? toHex(solid.rgb[0], solid.rgb[1], solid.rgb[2]) : null;
  }
  const layer = snap.layers[snap.layers.length - 1];
  if (!layer) return null;
  // the same derivation as the liquid in a vessel: spectral absorption at the bottle path, plus the in-scattered light of
  // any suspended solid (chromatic extinction included)
  const wl = layer.absorbance_per_cm.map((a, i) => a * BOTTLE_PATH_CM + ((layer.scatter_per_cm?.[i] ?? 0) * BOTTLE_PATH_CM) / Math.LN10);
  const [r, g, b] = computeSpectralColor(optics, wl.map((x) => x / BOTTLE_PATH_CM), BOTTLE_PATH_CM);
  const sc = scatterSummary(optics, layer);
  const tau = Math.exp(-sc.w * BOTTLE_PATH_CM);
  return toHex(r + sc.rgb[0] * (1 - tau) * 0.5, g + sc.rgb[1] * (1 - tau) * 0.5, b + sc.rgb[2] * (1 - tau) * 0.5);
}

function probeDose(entry: ReagentCatalogEntry): DoseRequest {
  if (entry.by_mass) return { reagent_id: entry.id, mass_g: 2.0 };
  return { reagent_id: entry.id, volume_ml: 50.0 };
}

/** Cached colour if already known (sync). */
export function knownReagentColor(id: string): string | undefined {
  return cacheVersion ? cache.get(id) : undefined;
}

/** Engine-derived contents colour for a catalog reagent ('#rrggbb'), or null if it can't be determined. */
export function probeReagentColor(
  sim: SimController,
  entry: ReagentCatalogEntry,
  optics: OpticsTables | null
): Promise<string | null> {
  // Without the optics tables the spectrum can't be turned into a colour; don't cache a wrong answer.
  if (!optics) return Promise.resolve(null);
  setOpticsDataVersion(optics.data_version);
  const hit = cache.get(entry.id);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(entry.id);
  if (pending) return pending;

  // Serialise probes so a burst of shelf placements doesn't flood the worker.
  const run = queue.then(async () => {
    const vid = `__colour_probe_${++probeSeq}`;
    try {
      await sim.createVessel(vid, {
        type: 'beaker-250',
        capacity_ml: 250,
        glass_mass_g: 110,
        inner_radius_cm: 3.5,
      });
      await sim.dose(vid, probeDose(entry));
      const snap = await sim.fetchSnapshot(vid);
      const hex = snap ? colourFromSnapshot(snap, optics) : null;
      if (hex) {
        cache.set(entry.id, hex);
        persist();
      }
      return hex;
    } catch {
      return null;
    } finally {
      sim.freeVessel(vid).catch(() => {});
      inflight.delete(entry.id);
    }
  });
  queue = run.catch(() => null);
  inflight.set(entry.id, run);
  return run;
}
