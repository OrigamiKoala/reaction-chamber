import type { CompoundRecord } from '../record';
import { connectivityBlock } from '../identity';

export class CoreBundleProvider {
  private cache: Map<string, CompoundRecord> = new Map();
  private loadedShards: Set<string> = new Set();

  async loadShard(shardName: string): Promise<void> {
    if (this.loadedShards.has(shardName)) return;
    try {
      const res = await fetch(`/data/core/${shardName}.json`);
      if (!res.ok) return;
      const records: CompoundRecord[] = await res.json();
      for (const rec of records) {
        this.cache.set(rec.id, rec);
        if (rec.identity.inchikey) {
          this.cache.set(rec.identity.inchikey, rec);
          const conn = connectivityBlock(rec.identity.inchikey);
          if (conn) this.cache.set(conn, rec);
        }
      }
      this.loadedShards.add(shardName);
    } catch {
      // offline or not found
    }
  }

  async find(query: { inchikey?: string; formula?: string; id?: string }): Promise<CompoundRecord | null> {
    if (query.id && this.cache.has(query.id)) {
      return this.cache.get(query.id)!;
    }
    if (query.inchikey) {
      if (this.cache.has(query.inchikey)) {
        return this.cache.get(query.inchikey)!;
      }
      const conn = connectivityBlock(query.inchikey);
      if (conn && this.cache.has(conn)) {
        return this.cache.get(conn)!;
      }
    }
    return null;
  }
}
