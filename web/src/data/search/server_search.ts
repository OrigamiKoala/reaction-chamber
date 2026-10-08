// NIST WebBook and CAS Common Chemistry through the server (/api/data/search): the local run.py server or the Vercel
// function. A static host without the API reports `unavailable`; the other sources keep working.
import type { DbHit } from './merge_hits';
import { authHeaders } from '../../pubchem/session';

export type SourceStatus = { status: 'ok' | 'none' | 'error' | 'disabled' | 'unavailable'; message?: string };
export interface ServerCaps { nist: boolean; cas: boolean; search: boolean }

let capsPromise: Promise<ServerCaps | null> | null = null;

/** What the server can look up (null: no API here, e.g. the static GitHub Pages build). Asked once. */
export function serverCapabilities(): Promise<ServerCaps | null> {
  if (!capsPromise) {
    capsPromise = (async () => {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) return null;
        const c = (await res.json())?.capabilities;
        return c && typeof c === 'object' ? { nist: !!c.nist, cas: !!c.cas, search: !!c.search } : null;
      } catch {
        return null;
      }
    })();
  }
  return capsPromise;
}

export async function searchServerHits(query: string, signal?: AbortSignal): Promise<{ hits: DbHit[]; nist: SourceStatus; cas: SourceStatus }> {
  const none: SourceStatus = { status: 'unavailable', message: 'needs the local server or the hosted site' };
  const caps = await serverCapabilities();
  if (!caps || !caps.search) return { hits: [], nist: none, cas: none };
  try {
    const res = await fetch(`/api/data/search?q=${encodeURIComponent(query)}`, { headers: authHeaders(), signal });
    if (!res.ok) {
      const msg = res.status === 429 ? 'too many searches, wait a minute' : `server answered ${res.status}`;
      return { hits: [], nist: { status: 'error', message: msg }, cas: { status: 'error', message: msg } };
    }
    const body = await res.json();
    const hits: DbHit[] = (body.hits ?? []).map((h: any): DbHit => ({
      source: h.source === 'cas' ? 'cas' : 'nist',
      name: String(h.name ?? ''),
      formula: h.formula || undefined,
      cas: h.cas || undefined,
      inchikey: h.inchikey || undefined,
      smiles: h.smiles || undefined,
    }));
    return { hits, nist: body.sources?.nist ?? none, cas: body.sources?.cas ?? none };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { hits: [], nist: none, cas: none };
    const e: SourceStatus = { status: 'error', message: 'server not reachable' };
    return { hits: [], nist: e, cas: e };
  }
}
