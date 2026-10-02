// Session token of the local server: the /api/data/* proxy routes require it (they trigger outbound scraping).
let token = '';

export function setSessionToken(t: string) {
  token = t || '';
}

/** Authorization header for local-server requests (empty when no token is known, e.g. a static preview). */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
