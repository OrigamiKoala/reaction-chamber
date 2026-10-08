// Pure helpers of the compound search: one list of hits from several databases, merged by identity and ranked.
// No imports on purpose (tests run this file directly with Node).

export type SourceId = 'pubchem' | 'nist' | 'cas';

/** One database's record of a compound: identity only; the data are fetched when the hit is imported. */
export interface DbHit {
  source: SourceId;
  name: string;
  formula?: string;
  cas?: string;
  inchikey?: string;
  smiles?: string;
  cid?: number;
  charge?: number;
  /** Another name the database knows (synonym, IUPAC name). */
  altNames?: string[];
}

export interface MergedHit {
  /** Display name (shortest of the names, which is the common one: "acetone" over "propan-2-one"). */
  name: string;
  names: string[];
  formula?: string;
  cas?: string;
  inchikey?: string;
  smiles?: string;
  cid?: number;
  charge?: number;
  sources: SourceId[];
  hits: DbHit[];
  /** 'element' for one element (Cu, H2, O2, S8), 'ion' for a charged species, else 'compound'. */
  kind: 'element' | 'ion' | 'compound';
}

/** Element multiset of a formula, order independent ("ClNa" == "NaCl"); hydrate suffixes dropped. */
export function formulaKey(formula: string | undefined): string {
  const body = (formula ?? '').replace(/\s+/g, '').split(/[·.*•]/)[0].replace(/[+-]\d*$|\^.*$/, '');
  if (!body) return '';
  const counts = new Map<string, number>();
  let i = 0;
  const parse = (): Map<string, number> => {
    const here = new Map<string, number>();
    while (i < body.length) {
      const c = body[i];
      if (c === '(' || c === '[') {
        i++;
        const inner = parse();
        let num = '';
        while (i < body.length && /\d/.test(body[i])) num += body[i++];
        const k = num ? parseInt(num, 10) : 1;
        inner.forEach((v, el) => here.set(el, (here.get(el) ?? 0) + v * k));
      } else if (c === ')' || c === ']') {
        i++;
        return here;
      } else if (/[A-Z]/.test(c)) {
        let el = c;
        i++;
        while (i < body.length && /[a-z]/.test(body[i])) el += body[i++];
        let num = '';
        while (i < body.length && /\d/.test(body[i])) num += body[i++];
        here.set(el, (here.get(el) ?? 0) + (num ? parseInt(num, 10) : 1));
      } else {
        i++;
      }
    }
    return here;
  };
  parse().forEach((v, el) => counts.set(el, v));
  if (counts.size === 0) return body.toLowerCase();
  return [...counts.keys()].sort().map((el) => `${el}${counts.get(el)}`).join('');
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

function keysOf(h: DbHit): string[] {
  const keys: string[] = [];
  if (h.inchikey) keys.push(`ik:${h.inchikey.toUpperCase()}`);
  if (h.cas) keys.push(`cas:${h.cas}`);
  const f = formulaKey(h.formula);
  for (const n of [h.name, ...(h.altNames ?? [])]) {
    if (n) keys.push(`nf:${norm(n)}|${f}`);
  }
  return keys;
}

/**
 * Merges hits that share an InChIKey, a CAS number, or a (normalised name, formula) pair. Transitive: a PubChem hit with
 * an InChIKey, a NIST hit with a CAS and a CAS hit with both end up as one row.
 */
export function mergeHits(hits: DbHit[]): MergedHit[] {
  const parent = hits.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map<string, number>();
  hits.forEach((h, i) => {
    for (const k of keysOf(h)) {
      const o = owner.get(k);
      if (o === undefined) owner.set(k, i);
      else parent[find(i)] = find(o);
    }
  });
  const groups = new Map<number, DbHit[]>();
  hits.forEach((h, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(h);
  });
  const out: MergedHit[] = [];
  for (const g of groups.values()) {
    const names: string[] = [];
    for (const h of g) for (const n of [h.name, ...(h.altNames ?? [])]) if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
    const pick = <K extends keyof DbHit>(k: K): DbHit[K] | undefined => g.map((h) => h[k]).find((v) => v !== undefined && v !== '');
    const formula = pick('formula') as string | undefined;
    const charge = pick('charge') as number | undefined;
    const display = [...g.map((h) => h.name)].filter(Boolean).sort((a, b) => a.length - b.length)[0] ?? names[0] ?? '';
    const fk = formulaKey(formula);
    const els = fk.match(/[A-Z][a-z]?/g) ?? [];
    const kind: MergedHit['kind'] = charge ? 'ion' : els.length === 1 ? 'element' : 'compound';
    out.push({
      name: display,
      names,
      formula,
      cas: pick('cas') as string | undefined,
      inchikey: pick('inchikey') as string | undefined,
      smiles: pick('smiles') as string | undefined,
      cid: pick('cid') as number | undefined,
      charge,
      sources: [...new Set(g.map((h) => h.source))],
      hits: g,
      kind,
    });
  }
  return out;
}

/**
 * Ranking for a query: an exact name or formula match first (so "acetone" shows acetone, not "acetone oxime"), then
 * names that start with the query, then the rest; ties go to the hit more databases agree on, neutral before ions,
 * and the shorter name.
 */
export function rankHits(query: string, hits: MergedHit[]): MergedHit[] {
  const q = query.trim();
  const qn = norm(q);
  const qf = formulaKey(q);
  const score = (h: MergedHit): number => {
    const exactName = h.names.some((n) => norm(n) === qn);
    const exactFormula = !!h.formula && !!qf && formulaKey(h.formula) === qf && /^[A-Z(]/.test(q);
    let s = 6;
    if (h.cas === q || h.inchikey === q.toUpperCase()) s = 0;
    else if (exactName) s = 1;
    else if (exactFormula) s = 2;
    else if (h.names.some((n) => norm(n).startsWith(qn))) s = 3;
    else if (h.names.some((n) => norm(n).includes(qn))) s = 4;
    else s = 5;
    if (h.charge) s += 0.5;
    return s;
  };
  return hits
    .map((h, i) => ({ h, i, s: score(h) }))
    .sort((a, b) => a.s - b.s || b.h.sources.length - a.h.sources.length || a.h.name.length - b.h.name.length || a.i - b.i)
    .map((x) => x.h);
}
