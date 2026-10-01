// PubChem API Client with rate limiting queue, PUG REST/View parsing, and bundle fallback
import { SpeciesRecord } from '../types';
import { splitSaltsAndHydrates } from './splitter';
import {
  parseTemperatureString,
  parseDensityString,
  resolveMedianProperty,
  parseGHSCodes,
  collectPugViewStrings,
  parsePhysicalState,
  parseColourWord,
  ParsedProperty,
} from './parser';
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

const pubchemQueue = new RequestQueue();

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

export async function importCompound(nameOrTerm: string): Promise<SpeciesRecord> {
  const term = nameOrTerm.trim();
  const bundle = await initDataBundle();

  // Check bundle by exact or case-insensitive name
  const foundInBundle = Object.values(bundle).find(
    (s) => s.name.toLowerCase() === term.toLowerCase() || (s.cid && String(s.cid) === term)
  );

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
    const record = await pubchemQueue.push(async () => {
      const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(term)}/property/Title,IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey,Charge/JSON`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`PubChem returned ${res.status}`);
      const data = await res.json();
      const prop = data?.PropertyTable?.Properties?.[0];
      if (!prop) throw new Error('Compound not found in PubChem');

      const smiles = prop.CanonicalSMILES || '';
      const inchiKey = prop.InChIKey || '';
      const splitRes = splitSaltsAndHydrates(smiles);

      // Fetch PUG View for experimental MP/BP/density/hazards
      let mp_c = foundInBundle ? foundInBundle.mp_c : 20.0;
      let bp_c = foundInBundle ? foundInBundle.bp_c : 100.0;
      let density = foundInBundle ? foundInBundle.density : 1.0;
      let ghs: string[] = foundInBundle ? foundInBundle.ghs : [];
      let physicalState: SpeciesRecord['physical_state'] = foundInBundle?.physical_state;
      let colour: string | undefined = foundInBundle?.color;

      try {
        const viewUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${prop.CID}/JSON`;
        const viewRes = await fetch(viewUrl);
        if (viewRes.ok) {
          const viewData = await viewRes.json();
          const jsonStr = JSON.stringify(viewData);
          const parsedGhs = parseGHSCodes(jsonStr);
          if (parsedGhs.length > 0) ghs = parsedGhs;
          // Generic text -> visuals: state / colour / melting & boiling point / density from the record itself.
          const props = collectPugViewStrings(viewData, ['Physical Description', 'Color/Form', 'Melting Point', 'Boiling Point', 'Density']);
          const look = [...(props['Physical Description'] ?? []), ...(props['Color/Form'] ?? [])];
          physicalState = physicalState ?? parsePhysicalState(look);
          colour = colour ?? parseColourWord(look);
          if (!foundInBundle) {
            const temps = (key: string) => (props[key] ?? []).map((t) => parseTemperatureString(t)).filter((x): x is ParsedProperty => !!x);
            const dens = (props['Density'] ?? []).map((t) => parseDensityString(t)).filter((x): x is ParsedProperty => !!x);
            mp_c = resolveMedianProperty(temps('Melting Point'), mp_c);
            bp_c = resolveMedianProperty(temps('Boiling Point'), bp_c);
            density = resolveMedianProperty(dens, density);
          }
        }
      } catch {
        // Use bundle/defaults if view fails
      }

      const speciesRecord: SpeciesRecord = {
        inchi_key: inchiKey,
        cid: prop.CID,
        name: prop.Title || term,
        formula: prop.MolecularFormula || '',
        smiles,
        charge: prop.Charge || 0,
        mw: parseFloat(prop.MolecularWeight) || 0,
        mp_c,
        bp_c,
        density,
        solubility: foundInBundle ? foundInBundle.solubility : 'soluble',
        ghs,
        tier: 'tabulated',
        source: 'PubChem PUG REST',
        physical_state: physicalState,
        color: colour,
      };

      try {
        await cacheCompound(speciesRecord);
      } catch {
        // Non-blocking cache failure
      }
      return speciesRecord;
    });

    return record;
  } catch (err) {
    // If live fetch fails, use bundle match or fallback
    if (foundInBundle) {
      try {
        await cacheCompound(foundInBundle);
      } catch {
        // Non-blocking cache failure
      }
      return foundInBundle;
    }
    throw new Error(`Could not find or import "${term}".`);
  }
}
