import type { Identity } from './record';

export function connectivityBlock(inchiKey?: string): string {
  const first = (inchiKey || '').trim().toUpperCase().split('-')[0];
  return /^[A-Z]{14}$/.test(first) ? first : '';
}

export function generateCanonicalId(identity: Identity, phase?: 's' | 'l' | 'g' | 'aq'): string {
  if (identity.inchikey && connectivityBlock(identity.inchikey)) {
    return `ik:${identity.inchikey}`;
  }
  if (identity.charge !== 0) {
    const sign = identity.charge > 0 ? '+' : '';
    return `ion:${identity.formula}${sign}${identity.charge}`;
  }
  if (phase === 's') {
    return `s:${identity.formula}:solid`;
  }
  if (phase === 'g') {
    return `g:${identity.formula}`;
  }
  return identity.formula;
}

export function matchesIdentity(a: Identity, b: Identity): boolean {
  const connA = connectivityBlock(a.inchikey);
  const connB = connectivityBlock(b.inchikey);
  if (connA && connB) {
    return connA === connB;
  }
  if (a.cas && b.cas && a.cas === b.cas) {
    return true;
  }
  return a.formula.toLowerCase() === b.formula.toLowerCase() && a.charge === b.charge;
}
