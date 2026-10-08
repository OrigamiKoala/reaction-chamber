"""Search over the databases the server can reach (NIST Chemistry WebBook, CAS Common Chemistry) by name, formula, CAS
registry number or InChIKey. PubChem is searched by the browser directly (it allows cross-origin requests); the
frontend merges all hits by identity (`web/src/data/search/merge_hits.ts`).

A hit is identity only (`name`, `formula`, `cas`, `inchikey`, `source`); the data of a chosen compound are fetched by
`UnifiedPropertyResolver.resolve_compound` (`/api/data/properties`), which merges NIST and CAS values by CAS / InChIKey.
"""
from __future__ import annotations

import html as htmllib
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

from . import cas_common
from .data_proxy import NistWebBookClient, _get_cached, _set_cached

ELEMENTS = set(
    "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo "
    "Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl "
    "Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr".split()
)
CAS_RE = re.compile(r"^\d{2,7}-\d{2}-\d$")
INCHIKEY_RE = re.compile(r"^[A-Z]{14}-[A-Z]{10}-[A-Z]$")
_FORMULA_TOKEN = re.compile(r"([A-Z][a-z]?)(\d*)|([()\[\]])(\d*)|(\d+)\s*$")
_nist_enabled = lambda: os.environ.get("RC_NIST", "1") != "0"


def classify(q: str) -> str:
    """'cas' | 'inchikey' | 'formula' | 'name'. A formula is case-sensitive element symbols with counts and groups
    ("NaCl", "H2SO4", "Ca(OH)2", "CuSO4.5H2O" is not one); lower-case words are names."""
    q = q.strip()
    if CAS_RE.match(q):
        return "cas"
    if INCHIKEY_RE.match(q.upper()) and "-" in q:
        return "inchikey"
    body = re.sub(r"[\^]?\d*[+-]$", "", q)  # trailing charge
    if re.fullmatch(r"[A-Za-z0-9()\[\]]+", body) and body[0].isupper():
        i, n_elem = 0, 0
        while i < len(body):
            m = re.match(r"([A-Z][a-z]?)(\d*)", body[i:])
            if m:
                if m.group(1) not in ELEMENTS:
                    return "name"
                n_elem += 1
                i += m.end()
                continue
            if body[i] in "()[]" or body[i].isdigit():
                i += 1
                continue
            return "name"
        # one bare symbol or a counted/compound formula; a capitalised plain word is a name unless it is all symbols
        if n_elem >= 1 and (len(body) <= 2 or any(ch.isdigit() for ch in body) or n_elem >= 2):
            return "formula"
    return "name"


def _strip(s: str) -> str:
    return htmllib.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def parse_nist_search(html: str) -> List[Dict[str, Any]]:
    """Hits of a NIST "Search Results" page: name, formula and the NIST id (C + CAS digits for most species).
    Polymers `(C3H6O)n` are skipped."""
    hits: List[Dict[str, Any]] = []
    for m in re.finditer(r'<li><a href="/cgi/cbook\.cgi\?ID=([A-Z]\d+)&amp;Units=SI">(.*?)</a>\s*\((.*?)\)(.*?)(?:<br|</li>)', html, re.S):
        ident, name, formula, tail = m.group(1), _strip(m.group(2)), _strip(m.group(3)), m.group(4)
        if "<sub>n</sub>" in tail or formula.endswith("n") and "(" in formula:
            continue
        hit: Dict[str, Any] = {"name": name, "formula": formula.replace(" ", ""), "source": "nist", "nist_id": ident}
        if ident.startswith("C") and ident[1:].isdigit() and len(ident) > 4:
            d = ident[1:]
            hit["cas"] = f"{d[:-3]}-{d[-3:-1]}-{d[-1]}"
        hits.append(hit)
    return hits


def parse_nist_compound_identity(html: str) -> Optional[Dict[str, Any]]:
    """Identity of a single-compound NIST page (what a name query with one exact match returns)."""
    t = re.search(r'<h1[^>]*\bid="Top"[^>]*>(.*?)</h1>', html, re.I | re.S)
    if not t:
        return None
    hit: Dict[str, Any] = {"name": _strip(t.group(1)), "source": "nist"}
    f = re.search(r'Formula(?:</a>)?:</strong>(.*?)</li>', html, re.I | re.S)
    if f:
        hit["formula"] = _strip(f.group(1)).replace(" ", "")
    c = re.search(r'CAS Registry Number:</strong>\s*([\d\-]+)', html, re.I)
    if c:
        hit["cas"] = c.group(1)
    k = re.search(r'InChIKey:</strong>.{0,400}?([A-Z]{14}-[A-Z]{10}-[A-Z])', html, re.S)
    if k:
        hit["inchikey"] = k.group(1)
    return hit if hit.get("formula") or hit.get("cas") else None


def nist_search(q: str, kind: str, limit: int = 10) -> Dict[str, Any]:
    """{'status': 'ok'|'none'|'error'|'disabled', 'hits': [...]}. One WebBook request (5 s crawl delay applies)."""
    if not _nist_enabled():
        return {"status": "disabled", "hits": [], "message": "NIST lookups are switched off (RC_NIST=0)"}
    key = f"nist_search:{kind}:{q.lower()}"
    cached = _get_cached(key)
    if cached is not None:
        return cached
    params = {"Units": "SI"}
    if kind == "cas":
        params["ID"] = "C" + q.replace("-", "")
    elif kind == "inchikey":
        params["InChI"] = q.upper()
    elif kind == "formula":
        params["Formula"] = q
        params["NoIon"] = "on"
    else:
        params["Name"] = q
    html = NistWebBookClient.fetch_nist_html(params)
    if html is None:
        return {"status": "error", "hits": [], "message": "NIST WebBook did not answer"}
    head = html[:4000].lower()
    if "<title>search results" in head:
        hits = parse_nist_search(html)
    elif "<title>not found" in head or "name not found" in html.lower() or "no matching species found" in html.lower():
        hits = []
    else:
        one = parse_nist_compound_identity(html)
        hits = [one] if one else []
    out = {"status": "ok" if hits else "none", "hits": hits[:limit]}
    _set_cached(key, "nist_search", out)
    return out


def cas_search(q: str, kind: str, limit: int = 8) -> Dict[str, Any]:
    if not cas_common.enabled():
        return {"status": "disabled", "hits": [], "message": "CAS Common Chemistry needs CAS_API_KEY"}
    if kind == "formula":
        return {"status": "none", "hits": [], "message": "CAS Common Chemistry cannot search by formula"}
    if kind == "cas":
        d = cas_common.detail(q)
        hits = []
        if d:
            props = cas_common.properties_from_detail(d)
            hits = [{"name": props.get("name", q), "formula": props.get("formula", ""), "cas": q, "source": "cas",
                     **({"inchikey": props["inchikey"]} if "inchikey" in props else {}),
                     **({"smiles": props["smiles"]} if "smiles" in props else {})}]
    else:
        # the exact name first (the API lists wildcard matches alphabetically, so the plain compound would be buried), then the
        # wildcard matches of a single word
        hits = cas_common.search(q, limit)
        if kind == "name" and " " not in q and "*" not in q:
            seen = {h["cas"] for h in hits}
            # the wildcard list is alphabetical and full of long systematic names: keep a few short ones
            hits += [h for h in cas_common.search(q + "*", limit) if h["cas"] not in seen and len(h["name"]) <= 40][:3]
        hits = hits[:limit]
    if not hits and cas_common.last_error and cas_common.last_error != "not found":
        return {"status": "error", "hits": [], "message": cas_common.last_error}
    return {"status": "ok" if hits else "none", "hits": hits}


def search(q: str) -> Dict[str, Any]:
    q = q.strip()
    if len(q) < 2:
        return {"query": q, "kind": "name", "hits": [], "sources": {}}
    kind = classify(q)
    with ThreadPoolExecutor(max_workers=2) as pool:
        f_nist = pool.submit(nist_search, q, kind)
        f_cas = pool.submit(cas_search, q, kind)
        nist, cas = f_nist.result(), f_cas.result()
    return {
        "query": q,
        "kind": kind,
        "hits": nist["hits"] + cas["hits"],
        "sources": {
            "nist": {k: v for k, v in nist.items() if k != "hits"},
            "cas": {k: v for k, v in cas.items() if k != "hits"},
        },
    }
