"""
Multi-Source Intrinsic Chemical Data Proxy.
Provides server-side access to the NIST Chemistry WebBook (SRD 69), a curated core table (NASA CEA, PHREEQC, SUPCRT,
CODATA reference values) and RDKit Joback group additivity. Caches NIST pages per user, never inside the repository.

Licence note: NIST SRD data may be looked up for the person running the app but must not be redistributed, so the cache
lives in the user's own cache directory (platformdirs, `RC_CACHE_DIR` overrides it), expires after `CACHE_TTL_SEC`, and
the repository's `.gitignore` excludes any `*.db` under `server/cache/`. Requests are rate limited to one per 5 s (the
crawl delay NIST asks for).

Identity: records are matched by InChIKey or CAS number only. A formula or a name is never enough (dimethyl ether is not
ethanol; methyl formate is not acetic acid).
"""

import os
import re
import json
import time
import math
import sqlite3
import urllib.request
import urllib.parse
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

try:  # platformdirs ships with the dev environment; fall back to ~/.cache when it is missing
    from platformdirs import user_cache_dir
except Exception:  # pragma: no cover
    def user_cache_dir(appname: str = "reaction-chamber", *_a, **_k) -> str:
        return str(Path.home() / ".cache" / appname)


def _cache_dir() -> Path:
    override = os.environ.get("RC_CACHE_DIR")
    path = Path(override) if override else Path(user_cache_dir("reaction-chamber"))
    path.mkdir(parents=True, exist_ok=True)
    return path


CACHE_DIR = _cache_dir()
CACHE_DB_PATH = CACHE_DIR / "nist_cache.db"
#: Minimum seconds between two requests to the WebBook (its robots.txt crawl delay).
NIST_MIN_INTERVAL_SEC = 5.0
#: A cached NIST record older than this is ignored and fetched again.
CACHE_TTL_SEC = 30 * 24 * 3600
#: Wikidata values are read without units or phase qualifiers (density 790 in kg/m3, boiling points mixed with Fahrenheit,
#: gas and liquid enthalpies in one list). It stays off until Stage 1 replaces it with a qualifier-aware extract.
WIKIDATA_ENABLED = os.environ.get("RC_WIKIDATA", "0") == "1"
#: Antoine blocks whose vapour pressure inside their stated range exceeds this (Pa) are mis-parsed tables, not data.
MAX_ANTOINE_PA = 1.0e8


def init_cache_db():
    conn = sqlite3.connect(CACHE_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS nist_cache (
            query_key TEXT PRIMARY KEY,
            source TEXT,
            data_json TEXT,
            timestamp REAL
        )
    """)
    conn.commit()
    conn.close()


init_cache_db()


def _get_cached(key: str) -> Optional[Dict[str, Any]]:
    try:
        conn = sqlite3.connect(CACHE_DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT data_json, timestamp FROM nist_cache WHERE query_key = ?", (key,))
        row = cur.fetchone()
        conn.close()
        if row and (time.time() - float(row[1] or 0.0)) <= CACHE_TTL_SEC:
            return json.loads(row[0])
    except Exception:
        pass
    return None


def _set_cached(key: str, source: str, data: Dict[str, Any]):
    try:
        conn = sqlite3.connect(CACHE_DB_PATH)
        cur = conn.cursor()
        cur.execute(
            "INSERT OR REPLACE INTO nist_cache (query_key, source, data_json, timestamp) VALUES (?, ?, ?, ?)",
            (key, source, json.dumps(data), time.time())
        )
        conn.commit()
        conn.close()
    except Exception:
        pass


def parse_num(s: str) -> Optional[float]:
    if not s:
        return None
    m = re.search(r'([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)', s.replace("\u2212", "-"))
    return float(m.group(1)) if m else None


# ---------------------------------------------------------------------------
# NIST Chemistry WebBook: table-structured parser
# ---------------------------------------------------------------------------

class _TableCollector(HTMLParser):
    """Collects every <table> with its caption / aria-label, the nearest preceding heading and its rows of cell texts."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables: List[Dict[str, Any]] = []
        self._heading = ""
        self._in_heading = False
        self._heading_buf: List[str] = []
        self._table: Optional[Dict[str, Any]] = None
        self._row: Optional[List[str]] = None
        self._cell: Optional[List[str]] = None
        self._in_caption = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("h1", "h2", "h3", "h4"):
            self._in_heading = True
            self._heading_buf = []
        elif tag == "table":
            self._table = {
                "label": (a.get("aria-label") or "").strip(),
                "caption": "",
                "heading": self._heading,
                "rows": [],
            }
        elif tag == "caption" and self._table is not None:
            self._in_caption = True
        elif tag == "tr" and self._table is not None:
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4") and self._in_heading:
            self._in_heading = False
            self._heading = " ".join("".join(self._heading_buf).split())
        elif tag == "caption":
            self._in_caption = False
        elif tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None and self._table is not None:
            if self._row:
                self._table["rows"].append(self._row)
            self._row = None
        elif tag == "table" and self._table is not None:
            self.tables.append(self._table)
            self._table = None

    def handle_data(self, data):
        if self._in_heading:
            self._heading_buf.append(data)
        if self._in_caption and self._table is not None:
            self._table["caption"] += data
        if self._cell is not None:
            self._cell.append(data)


def _norm(text: str) -> str:
    """Lower-case, no spaces, one minus sign: 'Δ vap H°' -> 'Δvaph°'."""
    return re.sub(r"\s+", "", text.replace("\u2212", "-")).lower()


def _unit_scale_to(unit: str, target: str) -> Optional[float]:
    """Factor converting `unit` text to `target` ('kj/mol', 'j/mol*k', 'k', 'bar'), or None if they do not match."""
    u = _norm(unit).replace("·", "*").replace("/molk", "/mol*k")
    if target == "kj/mol":
        return {"kj/mol": 1.0, "j/mol": 1e-3, "kcal/mol": 4.184}.get(u)
    if target == "j/mol*k":
        return {"j/mol*k": 1.0, "kj/mol*k": 1e3, "cal/mol*k": 4.184}.get(u)
    if target == "k":
        return 1.0 if u == "k" else None
    if target == "bar":
        return {"bar": 1.0, "atm": 1.01325, "mpa": 10.0, "kpa": 0.01, "pa": 1e-5}.get(u)
    return None


_PHASE_WORDS = {"gas": "gas", "liquid": "liquid", "solid": "solid", "crystal": "solid", "cr": "solid"}


def _phase_of(text: str) -> Optional[str]:
    t = text.lower()
    for word, phase in (("gas", "gas"), ("liquid", "liquid"), ("solid", "solid")):
        if re.search(rf"\b{word}\b", t):
            return phase
    return None


def _antoine_pressures_ok(a: float, b: float, c: float, t_min: float, t_max: float, p_unit_bar: float) -> bool:
    """True when log10(P) = A - B/(T + C) gives a finite, plausible vapour pressure over the whole stated range."""
    for i in range(0, 5):
        t = t_min + (t_max - t_min) * i / 4.0
        d = t + c
        if d <= 1.0:
            return False
        try:
            p_pa = (10.0 ** (a - b / d)) * p_unit_bar * 1e5
        except OverflowError:
            return False
        if not math.isfinite(p_pa) or p_pa <= 0.0 or p_pa > MAX_ANTOINE_PA:
            return False
    return True


class NistWebBookClient:
    BASE_URL = "https://webbook.nist.gov/cgi/cbook.cgi"
    LAST_REQUEST_TIME = 0.0
    MIN_INTERVAL_SEC = NIST_MIN_INTERVAL_SEC  # the crawl delay the WebBook asks for

    @classmethod
    def _rate_limit(cls):
        now = time.time()
        elapsed = now - cls.LAST_REQUEST_TIME
        if elapsed < cls.MIN_INTERVAL_SEC:
            time.sleep(cls.MIN_INTERVAL_SEC - elapsed)
        cls.LAST_REQUEST_TIME = time.time()

    @classmethod
    def fetch_nist_html(cls, query_params: Dict[str, str]) -> Optional[str]:
        cls._rate_limit()
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(query_params)}"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "ReactionChamberAcademicSimulator/1.0 (academic research)"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return resp.read().decode("utf-8", errors="ignore")
        except Exception:
            return None
        return None

    @classmethod
    def is_search_results(cls, html: str) -> bool:
        """A multi-hit "Search Results" page (or a not-found page) carries no compound data and must not be parsed."""
        head = html[:4000].lower()
        return ("<title>search results" in head or "<h1>search results" in head or "<title>not found" in head
                or "no matching species found" in html.lower() or "name not found" in html.lower())

    @classmethod
    def parse_nist_html(cls, html: str) -> Dict[str, Any]:
        """Parses a WebBook compound page table by table (caption + header decide what a table is), per phase.

        Every row of a temperature-dependent table is kept with its temperature (`dh_vap_points`, `dh_fus_points`,
        `cp_tabulated[phase]`); scalar quantities (Tboil, Tfus, Tc, Pc, enthalpies and entropies of formation) are read
        from the 'Quantity / Value / Units' tables by name and phase. Antoine blocks whose pressures leave the plausible
        range are rejected, and the enthalpy-of-vaporisation correlation table (A, alpha, beta, Tc) is not an Antoine table.
        """
        data: Dict[str, Any] = {"source": "NIST Chemistry WebBook (SRD 69)", "tier": "imported"}

        # the compound's heading is `<h1 id="Top">`; the first <h1> of the page is the site banner ("NIST Chemistry WebBook")
        title_m = re.search(r'<h1[^>]*\bid="Top"[^>]*>(.*?)</h1>', html, re.I | re.S)
        if title_m:
            data["name"] = re.sub(r'<[^>]+>', '', title_m.group(1)).strip()
        cas_m = re.search(r'CAS Registry Number:</strong>\s*([\d\-]+)', html, re.I)
        if cas_m:
            data["cas"] = cas_m.group(1).strip()
        # "Formula" is a link to the IUPAC definition: `Formula</a>:</strong> C<sub>8</sub>...`
        formula_m = re.search(r'Formula(?:</a>)?:</strong>(.*?)</li>', html, re.I | re.S)
        if formula_m:
            data["formula"] = re.sub(r'<[^>]+>', '', formula_m.group(1)).replace(" ", "").strip()
        ik_m = (re.search(r'InChIKey:</strong>.{0,400}?([A-Z]{14}-[A-Z]{10}-[A-Z])', html, re.S)
                or re.search(r'"inChIKey"\s*:\s*"([A-Z]{14}-[A-Z]{10}-[A-Z])"', html))
        if ik_m:
            data["inchikey"] = ik_m.group(1)

        collector = _TableCollector()
        collector.feed(html)

        cp_tab: Dict[str, List[List[float]]] = {}
        shomate: Dict[str, List[Dict[str, Any]]] = {}
        antoine: List[Dict[str, Any]] = []
        dh_vap_points: List[List[float]] = []
        dh_fus_points: List[List[float]] = []

        for table in collector.tables:
            rows = table["rows"]
            if not rows:
                continue
            ctx = f'{table["label"]} {table["caption"]} {table["heading"]}'
            ctx_l = ctx.lower()
            header = [_norm(c) for c in rows[0]]
            body = rows[1:]

            # ---- Antoine (header: Temperature (K) | A | B | C ...), NOT the dHvap correlation table
            if "antoine" in ctx_l or (header[:4] == ["temperature(k)", "a", "b", "c"]):
                # a title row ("log10(P) = A - B/(T+C) | P = vapor pressure (bar)") may precede the column header row
                for hi in range(min(3, len(rows))):
                    if _norm(rows[hi][0]).startswith("temperature") and "a" in [_norm(c) for c in rows[hi]]:
                        header = [_norm(c) for c in rows[hi]]
                        body = rows[hi + 1:]
                        break
                unit_bar = 1.0
                for r in rows[:2]:
                    for cell in r:
                        low = cell.lower()
                        if "vapor pressure (" in low or "vapour pressure (" in low:
                            m = re.search(r"\(([a-z]+)\)", low)
                            f = _unit_scale_to(m.group(1), "bar") if m else None
                            if f:
                                unit_bar = f
                col_idx = {name: header.index(name) for name in ("a", "b", "c") if name in header}
                if len(col_idx) == 3 and "temperature(k)" in header:
                    ti = header.index("temperature(k)")
                    for r in body:
                        try:
                            parts = re.split(r"\bto\b|-(?=\s*\d)", r[ti].replace("\u2212", "-"))
                            nums = [parse_num(x) for x in parts if parse_num(x) is not None]
                            if len(nums) < 2:
                                continue
                            t_min, t_max = nums[0], nums[1]
                            a_v, b_v, c_v = (float(r[col_idx[k]].replace("\u2212", "-")) for k in ("a", "b", "c"))
                        except (ValueError, IndexError):
                            continue
                        if not _antoine_pressures_ok(a_v, b_v, c_v, t_min, t_max, unit_bar):
                            continue
                        antoine.append({
                            "t_min_k": t_min, "t_max_k": t_max, "A": a_v, "B": b_v, "C": c_v,
                            # ln(P/Pa) = a_pa - b_pa / (T + c_pa)
                            "a_pa": round(math.log(10.0) * (a_v + math.log10(unit_bar * 1e5)), 5),
                            "b_pa": round(math.log(10.0) * b_v, 4),
                            "c_pa": c_v,
                        })
                continue

            # ---- enthalpy of vaporisation / fusion at stated temperatures: [value | temperature | ...]
            if ("enthalpy of vaporization" in ctx_l or "enthalpy of vaporisation" in ctx_l) and any("temperature" in h for h in header):
                if any(h in ("α", "alpha", "β") or h.startswith("a(") for h in header):
                    continue  # the A, alpha, beta, Tc correlation: not a data point
                vi = next((i for i, h in enumerate(header) if "δvaph" in h or "Δvaph".lower() in h), 0)
                ti = next(i for i, h in enumerate(header) if "temperature" in h)
                for r in body:
                    v, t = parse_num(r[vi]) if len(r) > vi else None, parse_num(r[ti]) if len(r) > ti else None
                    if v is not None and t is not None and 0.0 < v < 600.0 and 10.0 < t < 5000.0:
                        dh_vap_points.append([t, v])
                continue
            if "enthalpy of fusion" in ctx_l and any("temperature" in h for h in header):
                vi = next((i for i, h in enumerate(header) if "δfush" in h), 0)
                ti = next(i for i, h in enumerate(header) if "temperature" in h)
                for r in body:
                    v, t = parse_num(r[vi]) if len(r) > vi else None, parse_num(r[ti]) if len(r) > ti else None
                    if v is not None and t is not None and 0.0 < v < 600.0 and 10.0 < t < 5000.0:
                        dh_fus_points.append([t, v])
                continue

            # ---- constant-pressure heat capacity vs T, per phase: [Cp | Temperature]
            if "heat capacity" in ctx_l and "shomate" not in ctx_l and any("temperature" in h for h in header):
                phase = _phase_of(ctx)
                ti = next(i for i, h in enumerate(header) if "temperature" in h)
                ci = next((i for i, h in enumerate(header) if h.startswith("cp") or "heatcapacity" in h), 0)
                if phase:
                    for r in body:
                        cp, t = parse_num(r[ci]) if len(r) > ci else None, parse_num(r[ti]) if len(r) > ti else None
                        if cp is not None and t is not None and 10.0 <= t <= 6000.0 and 0.0 < cp < 2000.0:
                            cp_tab.setdefault(phase, []).append([t, cp])
                continue

            # ---- Shomate: header row = temperature ranges, rows A..H
            if "shomate" in ctx_l:
                phase = _phase_of(ctx) or "gas"
                if body and _norm(rows[0][0]).startswith("temperature"):
                    ranges = rows[0][1:]
                    names = [_norm(r[0]) for r in body]
                    if all(n in names for n in ("a", "b", "c", "d", "e", "f", "g")):
                        for col, rng in enumerate(ranges, start=1):
                            parts = re.split(r"\bto\b", rng)
                            nums = [parse_num(x) for x in parts]
                            if len(nums) < 2 or nums[0] is None or nums[1] is None:
                                continue
                            coeffs: Dict[str, float] = {}
                            for r in body:
                                n = _norm(r[0]).upper()
                                if n in "ABCDEFGH" and len(n) == 1 and col < len(r):
                                    v = parse_num(r[col])
                                    if v is not None:
                                        coeffs[n] = v
                            if len(coeffs) >= 7:
                                shomate.setdefault(phase, []).append({"t_min_k": nums[0], "t_max_k": nums[1], **coeffs})
                continue

            # ---- 'Quantity | Value | Units' tables (phase change data, gas / condensed phase thermochemistry)
            if len(header) >= 3 and header[0] == "quantity" and header[1] == "value" and header[2] == "units":
                for r in body:
                    if len(r) < 3:
                        continue
                    q = _norm(r[0]).replace("°", "°")
                    val = parse_num(r[1])
                    if val is None:
                        continue
                    unit = r[2]
                    kj = _unit_scale_to(unit, "kj/mol")
                    jmk = _unit_scale_to(unit, "j/mol*k")
                    kk = _unit_scale_to(unit, "k")
                    bar = _unit_scale_to(unit, "bar")
                    # scalar temperatures / pressures (first row per quantity is the recommended one)
                    if q in ("tboil", "tboil".lower()) and kk and "t_boil_k" not in data:
                        data["t_boil_k"] = val
                    elif q == "tfus" and kk and "t_fus_k" not in data:
                        data["t_fus_k"] = val
                    elif q == "ttriple" and kk and "t_triple_k" not in data:
                        data["t_triple_k"] = val
                    elif q == "ptriple" and bar and "p_triple_bar" not in data:
                        data["p_triple_bar"] = val * bar
                    elif q == "tc" and kk and "t_crit_k" not in data:
                        data["t_crit_k"] = val
                    elif q == "pc" and bar and "p_crit_bar" not in data:
                        data["p_crit_bar"] = val * bar
                    elif q.startswith("δvaph") and kj and "dh_vap_std_kj_mol" not in data:
                        # at 298 K / standard conditions in the phase-change table (the T-resolved rows are separate)
                        data["dh_vap_std_kj_mol"] = val * kj
                    elif q.startswith("δfush") and kj and "dh_fus_kj_mol" not in data:
                        data["dh_fus_kj_mol"] = val * kj
                    else:
                        m = re.match(r"^δ?(f|c)h°(gas|liquid|solid)", q)
                        if m and kj:
                            key = ("dhf_" if m.group(1) == "f" else "dh_comb_") + m.group(2) + "_kj_mol"
                            data.setdefault(key, val * kj)
                            continue
                        m = re.match(r"^s°(gas|liquid|solid)", q)
                        if m and jmk:
                            data.setdefault(f"s_{m.group(1)}_j_mol_k", val * jmk)
                            continue
                        m = re.match(r"^cp,(gas|liquid|solid)", q)
                        if m and jmk:
                            data.setdefault(f"cp_{m.group(1)}_j_mol_k", val * jmk)

        if antoine:
            data["antoine"] = antoine
        if dh_vap_points:
            data["dh_vap_points"] = sorted(dh_vap_points)
            # a single representative value for callers that want one number, with the temperature it was measured at
            t, v = sorted(dh_vap_points, key=lambda p: abs(p[0] - 298.15))[0]
            data["dh_vap_kj_mol"], data["dh_vap_at_k"] = v, t
        elif "dh_vap_std_kj_mol" in data:
            data["dh_vap_kj_mol"], data["dh_vap_at_k"] = data["dh_vap_std_kj_mol"], 298.15
        if dh_fus_points:
            data["dh_fus_points"] = sorted(dh_fus_points)
            data.setdefault("dh_fus_kj_mol", dh_fus_points[0][1])
        if cp_tab:
            data["cp_tabulated"] = {ph: sorted(pts)[:60] for ph, pts in cp_tab.items()}
        if shomate:
            data["shomate"] = shomate
        return data

    @classmethod
    def lookup(cls, identifier: str, by: str = "auto") -> Optional[Dict[str, Any]]:
        """NIST record by CAS or InChIKey (or, for a name / formula query, whatever page the WebBook returns for it:
        a multi-hit search page is rejected, never cached)."""
        ident = identifier.strip()
        cache_key = f"nist:{by}:{ident.lower()}"
        cached = _get_cached(cache_key)
        if cached:
            return cached

        params = {"Units": "SI", "Mask": "7"}
        if by == "cas" or re.match(r'^\d{2,7}-\d\d-\d$', ident):
            params["ID"] = f"C{ident.replace('-', '')}"
        elif by == "inchikey" or re.match(r'^[A-Z]{14}-[A-Z]{10}-[A-Z0-9]$', ident):
            params["InChI"] = ident
        elif by == "formula":
            params["Formula"] = ident
        else:
            params["Name"] = ident

        html = cls.fetch_nist_html(params)
        if html and cls.is_search_results(html) and "Name" in params:
            params.pop("Name")
            params["Formula"] = ident
            html = cls.fetch_nist_html(params)
        if not html or cls.is_search_results(html):
            # offline, not found, or a multi-hit search page: nothing is stored under a NIST key
            return None

        parsed = cls.parse_nist_html(html)
        # a parsed page must carry real data, not just a title
        has_data = any(k for k in parsed if k not in ("source", "tier", "name", "cas", "formula", "inchikey"))
        if has_data:
            _set_cached(cache_key, "nist_webbook", parsed)
            return parsed
        return None


# ---------------------------------------------------------------------------
# Pre-Curated Core Tabulated Reference Database (NASA CEA & SUPCRTBL)
# ---------------------------------------------------------------------------

CORE_TABULATED_THERMO: Dict[str, Dict[str, Any]] = {
    # Water
    "H2O": {
        "formula": "H2O", "name": "water", "mw": 18.015, "cas": "7732-18-5", "inchikey": "XLYOFNOQVPJJNP-UHFFFAOYSA-N",
        "dhf_liquid_kj_mol": -285.83, "dhf_gas_kj_mol": -241.82,
        "s_liquid_j_mol_k": 69.95, "s_gas_j_mol_k": 188.84,
        "t_boil_k": 373.15, "t_fus_k": 273.15,
        "dh_vap_kj_mol": 40.66, "dh_fus_kj_mol": 6.01,
        "antoine": [{"t_min_k": 273.15, "t_max_k": 373.15, "A": 5.20389, "B": 1733.926, "C": -39.485,
                     "a_pa": 23.4925, "b_pa": 3992.51, "c_pa": -39.485}],
        "cp_liquid_j_mol_k": 75.38, "tier": "tabulated", "source": "CODATA Key Values / NASA CEA"
    },
    # Ethanol
    "C2H5OH": {
        "formula": "C2H6O", "name": "ethanol", "mw": 46.069, "smiles": "CCO", "cas": "64-17-5", "inchikey": "LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
        "dhf_liquid_kj_mol": -277.6, "dhf_gas_kj_mol": -234.8,
        "s_liquid_j_mol_k": 160.7, "s_gas_j_mol_k": 281.6,
        "t_boil_k": 351.5, "t_fus_k": 159.0,
        "dh_vap_kj_mol": 38.56, "dh_fus_kj_mol": 4.93,
        "dh_comb_kj_mol": -1366.8,
        "antoine": [{"t_min_k": 292.77, "t_max_k": 366.63, "A": 5.24677, "B": 1598.673, "C": -46.424,
                     "a_pa": 23.5912, "b_pa": 3681.08, "c_pa": -46.424}],
        "cp_liquid_j_mol_k": 112.3, "tier": "tabulated", "source": "NIST WebBook / NASA CEA"
    },
    # Acetic acid
    "CH3COOH": {
        "formula": "C2H4O2", "name": "acetic acid", "mw": 60.052, "smiles": "CC(=O)O", "cas": "64-19-7", "inchikey": "QTBSBXVTEAMEQO-UHFFFAOYSA-N",
        "dhf_liquid_kj_mol": -484.5, "dhf_gas_kj_mol": -432.2,
        "s_liquid_j_mol_k": 159.8, "s_gas_j_mol_k": 282.5,
        "t_boil_k": 391.1, "t_fus_k": 289.8,
        "dh_vap_kj_mol": 23.7, "dh_fus_kj_mol": 11.7,
        "pka": [4.76],
        "antoine": [{"t_min_k": 290.0, "t_max_k": 391.0, "A": 4.6816, "B": 1642.54, "C": -39.76,
                     "a_pa": 22.2926, "b_pa": 3782.09, "c_pa": -39.76}],
        "cp_liquid_j_mol_k": 123.1, "tier": "tabulated", "source": "NIST WebBook / PHREEQC"
    },
    # Acetone
    "C3H6O": {
        "formula": "C3H6O", "name": "acetone", "mw": 58.08, "smiles": "CC(=O)C", "cas": "67-64-1", "inchikey": "CSCPPACGZOOCGX-UHFFFAOYSA-N",
        "dhf_liquid_kj_mol": -248.4, "dhf_gas_kj_mol": -217.5,
        "s_liquid_j_mol_k": 200.4, "s_gas_j_mol_k": 295.5,
        "t_boil_k": 329.2, "t_fus_k": 178.5,
        "dh_vap_kj_mol": 29.1, "dh_fus_kj_mol": 5.69,
        "antoine": [{"t_min_k": 259.0, "t_max_k": 329.0, "A": 4.42448, "B": 1312.253, "C": -32.445,
                     "a_pa": 21.7005, "b_pa": 3021.58, "c_pa": -32.445}],
        "cp_liquid_j_mol_k": 125.5, "tier": "tabulated", "source": "NIST WebBook"
    },
    # Carbon dioxide
    "CO2": {
        "formula": "CO2", "name": "carbon dioxide", "mw": 44.009, "cas": "124-38-9",
        "dhf_gas_kj_mol": -393.52, "s_gas_j_mol_k": 213.79,
        "t_boil_k": 194.7, "t_fus_k": 216.6,
        "henry_k_h_m_atm": 0.034, "henry_dh_kj_mol": -20.0,
        "shomate": [{"t_min_k": 298.0, "t_max_k": 1200.0, "A": 24.997, "B": 55.187, "C": -33.691, "D": 7.948, "E": -0.137, "F": -403.61, "G": 228.24, "H": -393.52}],
        "tier": "tabulated", "source": "NIST-JANAF"
    },
    # Oxygen
    "O2": {
        "formula": "O2", "name": "oxygen", "mw": 31.999, "cas": "7782-44-7",
        "dhf_gas_kj_mol": 0.0, "s_gas_j_mol_k": 205.15,
        "t_boil_k": 90.2, "t_fus_k": 54.4,
        "henry_k_h_m_atm": 0.0013, "henry_dh_kj_mol": -12.0,
        "tier": "tabulated", "source": "NASA CEA"
    },
    # Nitrogen
    "N2": {
        "formula": "N2", "name": "nitrogen", "mw": 28.013, "cas": "7727-37-9",
        "dhf_gas_kj_mol": 0.0, "s_gas_j_mol_k": 191.61,
        "t_boil_k": 77.36, "t_fus_k": 63.15,
        "tier": "tabulated", "source": "NASA CEA"
    },
    # Lead(II) iodide
    "PbI2": {
        "formula": "I2Pb", "name": "lead(II) iodide", "mw": 461.01, "cas": "10101-63-0",
        "dhf_solid_kj_mol": -175.4, "s_solid_j_mol_k": 174.85,
        "t_boil_k": 1145.0, "t_fus_k": 685.0,
        "log_ksp_298": -8.04, "dh_sol_kj_mol": 62.57,
        "tier": "tabulated", "source": "NASA CEA / PHREEQC llnl.dat"
    },
    # Silver chloride
    "AgCl": {
        "formula": "AgCl", "name": "silver chloride", "mw": 143.32, "cas": "7783-90-6",
        "dhf_solid_kj_mol": -127.01, "s_solid_j_mol_k": 96.2,
        "t_fus_k": 728.0,
        "log_ksp_298": -9.75, "dh_sol_kj_mol": 65.5,
        "tier": "tabulated", "source": "NIST-JANAF / PHREEQC"
    },
    # Naphthalene
    "C10H8": {
        "formula": "C10H8", "name": "naphthalene", "mw": 128.17, "smiles": "c1ccc2ccccc2c1", "cas": "91-20-3",
        "dhf_solid_kj_mol": 74.99, "dhf_gas_kj_mol": 147.56,
        "s_solid_j_mol_k": 166.9,
        "t_boil_k": 491.1, "t_fus_k": 353.4,
        "dh_vap_kj_mol": 43.3, "dh_fus_kj_mol": 19.1,
        "tier": "tabulated", "source": "ATcT / NIST WebBook"
    },
    # Benzoic acid
    "C7H6O2": {
        "formula": "C7H6O2", "name": "benzoic acid", "mw": 122.12, "smiles": "c1ccccc1C(=O)O", "cas": "65-85-0", "inchikey": "WPYMKLBDIGXBTP-UHFFFAOYSA-N",
        "dhf_solid_kj_mol": -384.8, "s_solid_j_mol_k": 165.7,
        "t_boil_k": 522.2, "t_fus_k": 395.2,
        "dh_vap_kj_mol": 78.9, "dh_fus_kj_mol": 18.0,
        "pka": [4.20],
        "tier": "tabulated", "source": "NIST WebBook / PHREEQC"
    }
}

# ---------------------------------------------------------------------------
# Universal Multi-Source Chemical Resolver
# ---------------------------------------------------------------------------

def core_record_for(inchikey: str = "", cas: str = "") -> Optional[Dict[str, Any]]:
    """The core-table record with this InChIKey or CAS number. Formula, name and SMILES are never enough to identify a
    compound (dimethyl ether shares C2H6O with ethanol, methyl formate C2H4O2 with acetic acid, propanal C3H6O with acetone)."""
    ik = inchikey.strip().upper()
    cas_n = cas.strip()
    for rec in CORE_TABULATED_THERMO.values():
        if (ik and rec.get("inchikey", "").upper() == ik) or (cas_n and rec.get("cas") == cas_n):
            return rec
    return None


class UnifiedPropertyResolver:
    """
    Resolves intrinsic thermodynamic & physical properties across prioritized data providers:
    1. Core Tabulated (NASA CEA, ATcT, PHREEQC, SUPCRT), matched by InChIKey or CAS only
    2. NIST Chemistry WebBook (SRD 69) via the local proxy (per-user cache, 5 s rate limit)
    3. RDKit Joback group additivity (Estimated; only when every heavy atom is covered)
    Wikidata is off until Stage 1 (it ignored units and phase qualifiers).
    """

    @classmethod
    def resolve_compound(
        cls,
        name: str = "",
        formula: str = "",
        smiles: str = "",
        inchikey: str = "",
        cas: str = ""
    ) -> Dict[str, Any]:
        merged: Dict[str, Any] = {
            "name": name,
            "formula": formula,
            "smiles": smiles,
            "inchikey": inchikey,
            "cas": cas,
            "provenance": {},
            "estimated_fields": []
        }

        # 1. Core tabulated database: identity by InChIKey or CAS
        core_data = core_record_for(inchikey=inchikey, cas=cas)
        if core_data is not None:
            for key, val in core_data.items():
                merged[key] = val
                merged["provenance"][key] = core_data.get("source", "Tabulated Core")
            merged["tier"] = "tabulated"
            return merged

        # 2. NIST Chemistry WebBook: by CAS, then InChIKey, then the exact name. Never by formula (isomers), and a page
        # whose own identifiers contradict the request is discarded.
        nist_res = None
        for query_type, query_val in (("cas", cas), ("inchikey", inchikey), ("name", name)):
            if query_val:
                nist_res = NistWebBookClient.lookup(query_val, by=query_type)
                if nist_res and inchikey and nist_res.get("inchikey") and nist_res["inchikey"].upper() != inchikey.upper():
                    nist_res = None
                if nist_res and cas and nist_res.get("cas") and nist_res["cas"] != cas:
                    nist_res = None
                if nist_res:
                    break

        if nist_res:
            for key, val in nist_res.items():
                if key not in ("source", "tier") and val is not None:
                    merged[key] = val
                    merged["provenance"][key] = "NIST Chemistry WebBook"
            merged["tier"] = "imported"

        # 3. Joback group contribution for organic molecules with SMILES (None when a heavy atom is uncovered)
        if smiles:
            try:
                from pipeline.joback_estimator import estimate_for_smiles
                joback_res = estimate_for_smiles(smiles)
                if joback_res:
                    if "dhf_gas_kj_mol" not in merged and "dhf_kj_mol" in joback_res:
                        merged["dhf_gas_kj_mol"] = joback_res["dhf_kj_mol"]
                        merged["provenance"]["dhf_gas_kj_mol"] = "Joback Group Contribution"
                        merged["estimated_fields"].append("dhf_gas_kj_mol")
                    if "t_boil_k" not in merged and "tb_k" in joback_res:
                        merged["t_boil_k"] = joback_res["tb_k"]
                        merged["provenance"]["t_boil_k"] = "Joback Group Contribution"
                        merged["estimated_fields"].append("t_boil_k")
                    if "t_fus_k" not in merged and "tm_k" in joback_res:
                        merged["t_fus_k"] = joback_res["tm_k"]
                        merged["provenance"]["t_fus_k"] = "Joback Group Contribution"
                        merged["estimated_fields"].append("t_fus_k")
                    if "cp_coeffs" in joback_res:
                        merged["cp_coefficients"] = joback_res["cp_coeffs"]
                        merged["provenance"]["cp_coefficients"] = "Joback Group Contribution"
                        merged["estimated_fields"].append("cp_coefficients")
                    if "tier" not in merged:
                        merged["tier"] = "estimated"
            except Exception:
                pass

        if "tier" not in merged:
            merged["tier"] = "speculative"

        return merged
