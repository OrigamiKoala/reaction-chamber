// One search over PubChem (browser, direct) and NIST WebBook / CAS Common Chemistry (server): results arrive
// progressively, are merged by identity and ranked for the query.
import { mergeHits, rankHits, type DbHit, type MergedHit } from './merge_hits';
import { searchPubChemHits } from './pubchem_search';
import { searchServerHits, type SourceStatus } from './server_search';

export interface SearchSnapshot {
  query: string;
  hits: MergedHit[];
  /** Per source: still running, or its final status. */
  sources: { pubchem: SourceStatus | 'running'; nist: SourceStatus | 'running'; cas: SourceStatus | 'running' };
  done: boolean;
}

/** Delay before the server sources are asked: NIST allows one request per 5 s, so a typed word must settle first. */
const SERVER_DELAY_MS = 700;

export class DatabaseSearch {
  private ctl: AbortController | null = null;
  private timer = 0;

  cancel() {
    this.ctl?.abort();
    this.ctl = null;
    window.clearTimeout(this.timer);
  }

  run(query: string, onUpdate: (s: SearchSnapshot) => void) {
    this.cancel();
    const q = query.trim();
    const ctl = new AbortController();
    this.ctl = ctl;
    const hitsBySource: Record<'pubchem' | 'server', DbHit[]> = { pubchem: [], server: [] };
    const snap: SearchSnapshot = { query: q, hits: [], sources: { pubchem: 'running', nist: 'running', cas: 'running' }, done: false };
    const emit = () => {
      if (ctl.signal.aborted) return;
      snap.hits = rankHits(q, mergeHits([...hitsBySource.pubchem, ...hitsBySource.server]));
      snap.done = !Object.values(snap.sources).includes('running');
      onUpdate({ ...snap, sources: { ...snap.sources }, hits: snap.hits });
    };
    emit();

    void searchPubChemHits(q, (hits) => { hitsBySource.pubchem = hits; emit(); }, ctl.signal).then((r) => {
      snap.sources.pubchem = r.ok ? (hitsBySource.pubchem.length ? { status: 'ok' } : { status: 'none' }) : { status: 'error', message: r.message ?? 'PubChem did not answer' };
      emit();
    });

    this.timer = window.setTimeout(() => {
      void searchServerHits(q, ctl.signal).then((r) => {
        hitsBySource.server = r.hits;
        snap.sources.nist = r.nist;
        snap.sources.cas = r.cas;
        emit();
      });
    }, SERVER_DELAY_MS);
  }
}
