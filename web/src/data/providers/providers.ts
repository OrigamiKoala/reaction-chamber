import type { CompoundRecord, CurvePoint } from '../record';

export class WikidataProvider {
  async fetchByInchiKey(_inchiKey: string): Promise<CompoundRecord | null> {
    // Stage 0 kept Wikidata off by default (RC_WIKIDATA=1)
    return null;
  }
}

export class NistProxyProvider {
  async fetchByInchiKey(inchiKey: string, sessionToken?: string): Promise<CompoundRecord | null> {
    if (!sessionToken) return null;
    try {
      const res = await fetch(`/api/data/properties?inchikey=${encodeURIComponent(inchiKey)}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.identity) return null;
      return data as CompoundRecord;
    } catch {
      return null;
    }
  }
}

export class EstimatorsProvider {
  estimateMissing(record: CompoundRecord): CompoundRecord {
    const updated = { ...record };
    // If melting point is missing, check if any estimate is available
    if (!updated.points?.some((p) => p.kind === 'tm')) {
      // rule of thumb or placeholder
    }
    return updated;
  }
}
