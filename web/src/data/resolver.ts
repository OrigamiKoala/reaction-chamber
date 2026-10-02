import type { CompoundRecord } from './record';
import { CoreBundleProvider } from './providers/core_bundle';
import { PubchemTextProvider } from './providers/pubchem_text';
import { WikidataProvider, NistProxyProvider, EstimatorsProvider } from './providers/providers';
import { mergeRecords } from './merge';
import { connectivityBlock } from './identity';

export interface PropertyQuery {
  id?: string;
  inchikey?: string;
  formula?: string;
  name?: string;
  cid?: number;
}

export class PropertyResolver {
  private coreBundle = new CoreBundleProvider();
  private pubchemText = new PubchemTextProvider();
  private wikidata = new WikidataProvider();
  private nistProxy = new NistProxyProvider();
  private estimators = new EstimatorsProvider();

  private memoryCache: Map<string, { record: CompoundRecord; timestamp: number }> = new Map();
  private ttlMs = 1000 * 60 * 60 * 24; // 24 hours

  async resolve(query: PropertyQuery, sessionToken?: string): Promise<CompoundRecord | null> {
    const key = query.inchikey || query.id || query.formula;
    if (key && this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      if (Date.now() - entry.timestamp < this.ttlMs) {
        return entry.record;
      }
    }

    let record: CompoundRecord | null = null;

    // 1. Core bundle (highest priority bundled)
    const bundleRec = await this.coreBundle.find(query);
    if (bundleRec) {
      record = bundleRec;
    }

    // 2. NIST Proxy (if opt-in with token)
    if (query.inchikey && sessionToken) {
      const nistRec = await this.nistProxy.fetchByInchiKey(query.inchikey, sessionToken);
      if (nistRec) {
        record = record ? mergeRecords(record, nistRec) : nistRec;
      }
    }

    // 3. Fallback estimators
    if (record) {
      record = this.estimators.estimateMissing(record);
      if (key) {
        this.memoryCache.set(key, { record, timestamp: Date.now() });
      }
    }

    return record;
  }

  registerResolved(record: CompoundRecord): void {
    if (record.id) {
      this.memoryCache.set(record.id, { record, timestamp: Date.now() });
    }
    if (record.identity.inchikey) {
      this.memoryCache.set(record.identity.inchikey, { record, timestamp: Date.now() });
    }
  }
}

export const globalResolver = new PropertyResolver();
