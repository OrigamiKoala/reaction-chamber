// Identity of a compound: the InChIKey. Pure (no imports) so Node tests can load it.

/** Connectivity block (first 14 letters) of an InChIKey, upper-cased; '' when absent or malformed. */
export function connectivityBlock(inchiKey?: string): string {
  const first = (inchiKey || '').trim().toUpperCase().split('-')[0];
  return /^[A-Z]{14}$/.test(first) ? first : '';
}
