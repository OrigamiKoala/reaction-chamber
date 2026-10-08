// PubChem as a search source: exact name (or CAS / InChIKey), formula, and autocomplete suggestions, each turned into
// identity hits (name, formula, InChIKey, charge). Rate limited through the shared PubChem queue.
import type { DbHit } from './merge_hits';
import { pubchemQueue } from '../../pubchem/api';

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest';
const PROPS = 'Title,MolecularFormula,InChIKey,Charge,CanonicalSMILES';

type Row = { CID?: number; Title?: string; MolecularFormula?: string; InChIKey?: string; Charge?: number; CanonicalSMILES?: string; ConnectivitySMILES?: string };

function toHit(r: Row): DbHit | null {
  if (!r.CID || !r.MolecularFormula) return null;
  const title = typeof r.Title === 'string' && !/^CID\s*\d+/i.test(r.Title) ? r.Title : '';
  return {
    source: 'pubchem',
    name: title || r.MolecularFormula,
    formula: r.MolecularFormula,
    inchikey: r.InChIKey,
    smiles: r.CanonicalSMILES ?? r.ConnectivitySMILES,
    cid: r.CID,
    charge: typeof r.Charge === 'number' ? r.Charge : 0,
  };
}

async function getRows(url: string, signal?: AbortSignal): Promise<Row[]> {
  return pubchemQueue.push(async () => {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const data = await res.json();
      return (data?.PropertyTable?.Properties ?? []) as Row[];
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') throw err;
      return [];
    }
  });
}

/** True when the text reads as a chemical formula (case-sensitive element symbols with counts): "NaCl", "H2SO4", "Cu". */
export function looksLikeFormula(q: string): boolean {
  return /^[A-Z][A-Za-z0-9()[\]]*$/.test(q) && /^(?:[A-Z][a-z]?\d*|[()[\]]\d*)+$/.test(q) && (q.length <= 2 || /\d/.test(q) || (q.match(/[A-Z]/g) ?? []).length >= 2);
}

/**
 * Hits for a query. `onPartial` is called as results arrive (the exact match first, then formula matches, then the
 * suggestion list with their formulas) so the list fills without waiting for the slowest request.
 */
export async function searchPubChemHits(query: string, onPartial: (hits: DbHit[]) => void, signal?: AbortSignal): Promise<{ ok: boolean; message?: string }> {
  const q = query.trim();
  if (q.length < 2) return { ok: true };
  const all: DbHit[] = [];
  const push = (hits: DbHit[]) => {
    for (const h of hits) if (!all.some((x) => x.cid === h.cid)) all.push(h);
    onPartial([...all]);
  };
  try {
    // 1. the exact match: PubChem resolves names, synonyms, CAS numbers and InChIKeys through the name endpoint
    const exact = await getRows(`${PUG}/pug/compound/name/${encodeURIComponent(q)}/property/${PROPS}/JSON`, signal);
    push(exact.map(toHit).filter((h): h is DbHit => !!h));

    // 2. formula matches (the common compounds have the lowest CIDs)
    if (looksLikeFormula(q)) {
      const ids = await pubchemQueue.push(async () => {
        try {
          const res = await fetch(`${PUG}/pug/compound/fastformula/${encodeURIComponent(q)}/cids/JSON?MaxRecords=12`, { signal });
          return res.ok ? (((await res.json())?.IdentifierList?.CID ?? []) as number[]) : [];
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') throw err;
          return [];
        }
      });
      if (ids.length > 0) {
        push((await getRows(`${PUG}/pug/compound/cid/${ids.slice(0, 12).join(',')}/property/${PROPS}/JSON`, signal)).map(toHit).filter((h): h is DbHit => !!h));
      }
    }

    // 3. autocomplete suggestions, each resolved to its formula
    const auto = await pubchemQueue.push(async () => {
      try {
        const res = await fetch(`${PUG}/autocomplete/compound/${encodeURIComponent(q)}/json?limit=6`, { signal });
        return res.ok ? (((await res.json())?.dictionary_terms?.compound ?? []) as string[]) : [];
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') throw err;
        return [];
      }
    });
    for (const name of auto) {
      if (all.some((h) => h.name.toLowerCase() === name.toLowerCase())) continue;
      const rows = await getRows(`${PUG}/pug/compound/name/${encodeURIComponent(name)}/property/${PROPS}/JSON`, signal);
      push(rows.slice(0, 1).map(toHit).filter((h): h is DbHit => !!h));
    }
    return { ok: true };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return { ok: true };
    return { ok: false, message: String((err as Error)?.message ?? err) };
  }
}
