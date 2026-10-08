"""CAS Common Chemistry (https://commonchemistry.cas.org) client.

The API needs a token (free, by registration with CAS) sent in the `X-API-KEY` header; the server reads it from the
environment variable `CAS_API_KEY` (locally in the shell that starts `run.py`, on Vercel under Project Settings ->
Environment Variables). Without it the source reports `disabled` and everything else keeps working. The browser never
sees the key: it only talks to this server.

Terms: Common Chemistry is CC BY-NC 4.0. Values are looked up for the person using the app, with attribution
(`source` of every datum says "CAS Common Chemistry"), and are not bundled into the repository.

Response shapes (CAS API v2.0): `GET /api/search?q=...` -> `{"count": n, "results": [{"rn", "name", ...}]}`;
`GET /api/detail?cas_rn=...` -> `{"rn", "name", "molecularFormula", "molecularMass", "smile", "canonicalSmile",
"inchi", "inchiKey", "experimentalProperties": [{"name", "property", "sourceNumber"}], "synonyms": [...]}`.
Parsing is defensive: a missing or reshaped field is skipped, never guessed.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

BASE_URL = "https://commonchemistry.cas.org/direct-api"
#: The API's own example request sends this header with the key (the keyed endpoint is /direct-api/, not the /api/ of the web page).
X_ORIGIN = "https://commonchemistry.cas.org/api-overview"
CAS_RN_RE = re.compile(r"^\d{2,7}-\d{2}-\d$")
SOURCE = "CAS Common Chemistry"

_cache: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL_SEC = 24 * 3600


def api_key() -> str:
    return os.environ.get("CAS_API_KEY", "").strip()


def enabled() -> bool:
    return bool(api_key())


def _get(path: str, params: Dict[str, str]) -> Optional[Any]:
    """GET with the key; None on any failure (the caller reports the status through `last_error`)."""
    global last_error
    key = f"{path}?{urllib.parse.urlencode(sorted(params.items()))}"
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_TTL_SEC:
        return hit[1]
    req = urllib.request.Request(
        f"{BASE_URL}/{path}?{urllib.parse.urlencode(params)}",
        headers={"X-API-KEY": api_key(), "x-origin": X_ORIGIN, "Accept": "application/json",
                 "User-Agent": "ReactionChamberAcademicSimulator/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="ignore"))
        _cache[key] = (time.time(), data)
        last_error = ""
        return data
    except urllib.error.HTTPError as e:
        last_error = {401: "CAS API key rejected (401)", 403: "CAS API key rejected (403)",
                      404: "not found", 429: "CAS rate limit (429)"}.get(e.code, f"CAS HTTP {e.code}")
    except Exception as e:  # network down, timeout, bad JSON
        last_error = f"CAS request failed: {type(e).__name__}"
    return None


last_error = ""


def search(q: str, limit: int = 8) -> List[Dict[str, Any]]:
    """Substances matching a name (trailing wildcard added for a plain word), CAS RN, SMILES, InChI or InChIKey."""
    q = q.strip()
    if not enabled() or not q:
        return []
    data = _get("search", {"q": q})
    results = (data or {}).get("results") if isinstance(data, dict) else None
    hits: List[Dict[str, Any]] = []
    for r in results or []:
        if not isinstance(r, dict) or not r.get("rn"):
            continue
        name = re.sub(r"<[^>]+>", "", str(r.get("name") or r["rn"])).strip()  # the API marks italics with <em>
        hits.append({"name": name, "cas": str(r["rn"]), "source": "cas"})
        if len(hits) >= limit:
            break
    return hits


def detail(cas_rn: str) -> Optional[Dict[str, Any]]:
    if not enabled() or not CAS_RN_RE.match(cas_rn.strip()):
        return None
    data = _get("detail", {"cas_rn": cas_rn.strip()})
    return data if isinstance(data, dict) and data.get("rn") else None


# ---------------------------------------------------------------------------------------------------------------------
# experimental properties: "56 °C", "-94.7 °C", "0.7845 g/cm3 @ 25 °C", "56.05 °C @ 760 Torr"
# ---------------------------------------------------------------------------------------------------------------------
_NUM = r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?"


def _clean(text: str) -> str:
    return (text.replace("−", "-").replace("–", "-").replace(" ", " ").strip())


def _to_kelvin(value: float, unit: str) -> Optional[float]:
    u = unit.strip().lower().replace("deg", "").replace("°", "").replace(" ", "")
    if u in ("c", "degc"):
        return value + 273.15
    if u == "f":
        return (value - 32.0) * 5.0 / 9.0 + 273.15
    if u == "k":
        return value
    return None


def _pressure_pa(text: str) -> Optional[float]:
    m = re.search(rf"@\s*(?:press(?:ure)?\s*:?\s*)?({_NUM})\s*(torr|mmhg|mm hg|atm|kpa|pa|bar|mbar)", text, re.I)
    if not m:
        return None
    v = float(m.group(1))
    return v * {"torr": 133.322, "mmhg": 133.322, "mm hg": 133.322, "atm": 101325.0, "kpa": 1000.0, "pa": 1.0,
                "bar": 1e5, "mbar": 100.0}[m.group(2).lower()]


def parse_temperature(text: str) -> Optional[Tuple[float, Optional[float]]]:
    """(T in K, pressure in Pa or None) from a melting / boiling point string. A range wider than 2 K is not a point
    and is skipped; a range of <= 2 K takes its midpoint."""
    t = _clean(text)
    head = t.split("@")[0]
    m = re.match(rf"^\s*({_NUM})(?:\s*(?:to|-)\s*({_NUM}))?\s*(?:°|deg)?\s*([CFK])\b", head, re.I)
    if not m:
        return None
    lo = float(m.group(1))
    hi = float(m.group(2)) if m.group(2) is not None else lo
    k_lo, k_hi = _to_kelvin(lo, m.group(3)), _to_kelvin(hi, m.group(3))
    if k_lo is None or k_hi is None or abs(k_hi - k_lo) > 2.0:
        return None
    return (0.5 * (k_lo + k_hi), _pressure_pa(t))


def parse_density(text: str) -> Optional[Tuple[float, Optional[float]]]:
    """(density in g/mL, temperature in K or None) from "0.7845 g/cm3 @ 25 °C"."""
    t = _clean(text)
    m = re.match(rf"^\s*({_NUM})\s*(g/cm3|g/cm\^3|g/cm\u00b3|g/ml|g/cc|kg/m3|kg/m\^3|kg/m\u00b3)", t, re.I)
    if not m:
        return None
    v = float(m.group(1))
    if m.group(2).lower().startswith("kg"):
        v /= 1000.0
    tm = re.search(rf"@\s*(?:temp(?:erature)?\s*:?\s*)?({_NUM})\s*(?:°|deg)?\s*([CFK])\b", t, re.I)
    temp = _to_kelvin(float(tm.group(1)), tm.group(2)) if tm else None
    return (v, temp) if 0.0 < v < 30.0 else None


def properties_from_detail(d: Dict[str, Any]) -> Dict[str, Any]:
    """The fields of a detail record the data proxy merges: identity and measured melting / boiling point / density.

    A boiling point stated at a pressure other than 1 atm (within 2 %) is not the normal boiling point and is dropped
    (the vapour-pressure curve takes a point, not a mislabelled normal bp)."""
    out: Dict[str, Any] = {"cas": str(d.get("rn", ""))}
    if d.get("name"):
        out["name"] = str(d["name"])
    if d.get("molecularFormula"):
        out["formula"] = re.sub(r"<[^>]+>", "", str(d["molecularFormula"])).replace(" ", "")
    smi = d.get("canonicalSmile") or d.get("smile")
    if smi:
        out["smiles"] = str(smi)
    if d.get("inchiKey"):
        out["inchikey"] = re.sub(r"^InChIKey=", "", str(d["inchiKey"]).strip(), flags=re.I)  # the API prefixes it
    if d.get("inchi"):
        out["inchi"] = str(d["inchi"])
    try:
        if d.get("molecularMass") not in (None, ""):
            out["mw"] = float(str(d["molecularMass"]).replace(",", ""))
    except ValueError:
        pass
    for p in d.get("experimentalProperties") or []:
        if not isinstance(p, dict):
            continue
        name, text = str(p.get("name", "")).lower(), str(p.get("property", ""))
        if "melting" in name and "t_fus_k" not in out:
            r = parse_temperature(text)
            if r:
                out["t_fus_k"] = round(r[0], 2)
        elif "boiling" in name and "t_boil_k" not in out:
            r = parse_temperature(text)
            if r and (r[1] is None or abs(r[1] - 101325.0) / 101325.0 < 0.02):
                out["t_boil_k"] = round(r[0], 2)
        elif name.startswith("density") and "density_g_ml" not in out:
            r = parse_density(text)
            if r:
                out["density_g_ml"] = r[0]
                if r[1]:
                    out["density_t_k"] = round(r[1], 2)
    return out
