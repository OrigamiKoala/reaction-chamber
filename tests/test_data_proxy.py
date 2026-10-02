"""Data proxy (Stage 0.11 / 0.12): identity by InChIKey or CAS, table-structured NIST parser, cache hygiene, auth.

No network: NIST pages are fixtures modelled on the WebBook layout (captioned tables with header rows)."""
import time

import pytest
from fastapi.testclient import TestClient

import server.data_proxy as dp
from server.main import app
from server.security import get_session_token

client = TestClient(app, base_url="http://127.0.0.1:8000")
AUTH = {"Authorization": f"Bearer {get_session_token()}"}


# ---- fixtures ----------------------------------------------------------------------------------------------------------

ETHANOL_PAGE = """
<html><head><title>Ethanol</title></head><body>
<h1 id="Top">Ethanol</h1>
<ul>
<li><strong>Formula:</strong> C<sub>2</sub>H<sub>6</sub>O</li>
<li><strong>CAS Registry Number:</strong> 64-17-5</li>
<li><strong>InChIKey:</strong> LFQSCWFLJHTTHZ-UHFFFAOYSA-N</li>
</ul>
<h2><a id="Thermo-Phase">Phase change data</a></h2>
<table aria-label="Phase change data" class="data">
<tr><th>Quantity</th><th>Value</th><th>Units</th><th>Method</th><th>Reference</th><th>Comment</th></tr>
<tr><td>T<sub>boil</sub></td><td>351.5</td><td>K</td><td>AVG</td><td>N/A</td><td>Average of 74 values</td></tr>
<tr><td>T<sub>boil</sub></td><td>351.4</td><td>K</td><td>N/A</td><td>x</td><td></td></tr>
<tr><td>T<sub>fus</sub></td><td>159.0</td><td>K</td><td>AVG</td><td>N/A</td><td></td></tr>
<tr><td>T<sub>c</sub></td><td>514.</td><td>K</td><td>AVG</td><td>N/A</td><td></td></tr>
<tr><td>P<sub>c</sub></td><td>63.0</td><td>bar</td><td>N/A</td><td>x</td><td></td></tr>
<tr><td>&Delta;<sub>vap</sub>H&deg;</td><td>42.3</td><td>kJ/mol</td><td>AVG</td><td>N/A</td><td></td></tr>
<tr><td>&Delta;<sub>fus</sub>H</td><td>4.931</td><td>kJ/mol</td><td>AVG</td><td>N/A</td><td></td></tr>
</table>
<table aria-label="Enthalpy of vaporization">
<tr><th>&Delta;<sub>vap</sub>H (kJ/mol)</th><th>Temperature (K)</th><th>Method</th><th>Reference</th><th>Comment</th></tr>
<tr><td>38.56</td><td>351.</td><td>N/A</td><td>x</td><td></td></tr>
<tr><td>42.3</td><td>298.</td><td>N/A</td><td>x</td><td></td></tr>
</table>
<table aria-label="Enthalpy of vaporization correlation">
<tr><th>Temperature (K)</th><th>A (kJ/mol)</th><th>&alpha;</th><th>&beta;</th><th>T<sub>c</sub> (K)</th></tr>
<tr><td>298. to 363.</td><td>54.26</td><td>0.2982</td><td>523.2</td><td>514.</td></tr>
</table>
<table aria-label="Enthalpy of fusion">
<tr><th>&Delta;<sub>fus</sub>H (kJ/mol)</th><th>Temperature (K)</th><th>Method</th></tr>
<tr><td>4.931</td><td>159.0</td><td>DSC</td></tr>
</table>
<h2>Gas phase thermochemistry data</h2>
<table aria-label="Gas phase thermochemistry data">
<tr><th>Quantity</th><th>Value</th><th>Units</th><th>Method</th><th>Reference</th><th>Comment</th></tr>
<tr><td>&Delta;<sub>f</sub>H&deg;<sub>gas</sub></td><td>-234.8</td><td>kJ/mol</td><td>Review</td><td>x</td><td></td></tr>
<tr><td>S&deg;<sub>gas,1 bar</sub></td><td>281.6</td><td>J/mol*K</td><td>Review</td><td>x</td><td></td></tr>
<tr><td>C<sub>p,gas</sub></td><td>65.6</td><td>J/mol*K</td><td>Review</td><td>x</td><td></td></tr>
</table>
<h2>Condensed phase thermochemistry data</h2>
<table aria-label="Condensed phase thermochemistry data">
<tr><th>Quantity</th><th>Value</th><th>Units</th><th>Method</th><th>Reference</th><th>Comment</th></tr>
<tr><td>&Delta;<sub>f</sub>H&deg;<sub>liquid</sub></td><td>-277.6</td><td>kJ/mol</td><td>Review</td><td>x</td><td></td></tr>
<tr><td>&Delta;<sub>c</sub>H&deg;<sub>liquid</sub></td><td>-1366.8</td><td>kJ/mol</td><td>Review</td><td>x</td><td></td></tr>
<tr><td>S&deg;<sub>liquid,1 bar</sub></td><td>159.9</td><td>J/mol*K</td><td>Review</td><td>x</td><td></td></tr>
</table>
<h3>Constant pressure heat capacity of gas</h3>
<table aria-label="Constant pressure heat capacity of gas">
<tr><th>C<sub>p,gas</sub> (J/mol*K)</th><th>Temperature (K)</th><th>Reference</th></tr>
<tr><td>43.9</td><td>200.</td><td>x</td></tr>
<tr><td>65.6</td><td>298.15</td><td>x</td></tr>
</table>
<h3>Constant pressure heat capacity of liquid</h3>
<table aria-label="Constant pressure heat capacity of liquid">
<tr><th>C<sub>p,liquid</sub> (J/mol*K)</th><th>Temperature (K)</th><th>Reference</th></tr>
<tr><td>112.3</td><td>298.15</td><td>x</td></tr>
</table>
<h3>Antoine Equation Parameters</h3>
<table aria-label="Antoine Equation Parameters">
<tr><th>log<sub>10</sub>(P) = A &minus; (B / (T + C))</th><th colspan="5">P = vapor pressure (bar), T = temperature (K)</th></tr>
<tr><th>Temperature (K)</th><th>A</th><th>B</th><th>C</th><th>Reference</th><th>Comment</th></tr>
<tr><td>292.77 to 366.63</td><td>5.24677</td><td>1598.673</td><td>-46.424</td><td>x</td><td></td></tr>
<tr><td>364.8 to 513.91</td><td>4.92531</td><td>1432.526</td><td>-61.819</td><td>x</td><td></td></tr>
<tr><td>298. to 363.</td><td>54.26</td><td>0.2982</td><td>523.2</td><td>x</td><td>mis-read dHvap table</td></tr>
</table>
<h3>Gas Phase Heat Capacity (Shomate Equation)</h3>
<table aria-label="Gas Phase Heat Capacity (Shomate Equation)">
<tr><th>Temperature (K)</th><th>298. to 1200.</th><th>1200. to 6000.</th></tr>
<tr><td>A</td><td>-9.34</td><td>38.5</td></tr><tr><td>B</td><td>414.</td><td>35.8</td></tr><tr><td>C</td><td>-139.</td><td>-9.6</td></tr>
<tr><td>D</td><td>17.7</td><td>0.9</td></tr><tr><td>E</td><td>0.18</td><td>-3.2</td></tr><tr><td>F</td><td>-248.</td><td>-261.</td></tr>
<tr><td>G</td><td>272.</td><td>317.</td></tr><tr><td>H</td><td>-234.8</td><td>-234.8</td></tr>
</table>
</body></html>
"""

SEARCH_RESULTS_PAGE = """<html><head><title>Search Results</title></head><body><h1>Search Results</h1>
<ol><li><a href="/cgi/cbook.cgi?ID=C64175">Ethanol</a></li><li><a href="/cgi/cbook.cgi?ID=C115106">Methyl ether</a></li></ol></body></html>"""


@pytest.fixture(autouse=True)
def isolated_cache(tmp_path, monkeypatch):
    monkeypatch.setattr(dp, "CACHE_DB_PATH", tmp_path / "nist_cache.db")
    dp.init_cache_db()
    monkeypatch.setattr(dp.NistWebBookClient, "MIN_INTERVAL_SEC", 0.0)
    # no network in tests: every NIST fetch fails unless a test installs fixture pages
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(lambda params: None))
    yield


def fake_fetch(pages):
    calls = []

    def fetch(params):
        calls.append(dict(params))
        for key, html in pages.items():
            if any(str(v).lower() == key for v in params.values()):
                return html
        return None

    fetch.calls = calls
    return fetch


# ---- parser ------------------------------------------------------------------------------------------------------------

def test_nist_parser_reads_tables_by_caption_and_header():
    d = dp.NistWebBookClient.parse_nist_html(ETHANOL_PAGE)
    assert d["name"] == "Ethanol" and d["cas"] == "64-17-5" and d["formula"] == "C2H6O"
    assert d["inchikey"] == "LFQSCWFLJHTTHZ-UHFFFAOYSA-N"
    assert d["t_boil_k"] == 351.5 and d["t_fus_k"] == 159.0 and d["t_crit_k"] == 514.0
    assert d["p_crit_bar"] == 63.0
    # the old parser read the melting temperature as the heat of fusion (ethanol 159 kJ/mol)
    assert abs(d["dh_fus_kj_mol"] - 4.931) < 1e-9
    # per-phase scalar thermochemistry
    assert d["dhf_gas_kj_mol"] == -234.8 and d["dhf_liquid_kj_mol"] == -277.6
    assert d["s_gas_j_mol_k"] == 281.6 and d["s_liquid_j_mol_k"] == 159.9
    assert d["dh_comb_liquid_kj_mol"] == -1366.8
    assert d["cp_gas_j_mol_k"] == 65.6


def test_every_row_of_a_temperature_table_is_kept_with_its_temperature():
    d = dp.NistWebBookClient.parse_nist_html(ETHANOL_PAGE)
    assert d["dh_vap_points"] == [[298.0, 42.3], [351.0, 38.56]]
    assert d["dh_vap_kj_mol"] == 42.3 and d["dh_vap_at_k"] == 298.0  # nearest to 298.15 K, with its temperature
    assert d["dh_fus_points"] == [[159.0, 4.931]]
    # heat capacity per phase (gas and liquid are not mixed)
    assert d["cp_tabulated"]["gas"] == [[200.0, 43.9], [298.15, 65.6]]
    assert d["cp_tabulated"]["liquid"] == [[298.15, 112.3]]


def test_antoine_blocks_are_validated_and_the_dhvap_correlation_is_not_an_antoine_table():
    d = dp.NistWebBookClient.parse_nist_html(ETHANOL_PAGE)
    blocks = d["antoine"]
    assert len(blocks) == 2, blocks  # the A=54.26 block (a dHvap correlation read as Antoine) gives 1e59 Pa: rejected
    assert blocks[0]["t_min_k"] == 292.77 and blocks[0]["t_max_k"] == 366.63
    import math
    # ln(P/Pa) at the normal boiling point from the converted constants: 1 atm
    p = math.exp(blocks[0]["a_pa"] - blocks[0]["b_pa"] / (351.44 + blocks[0]["c_pa"]))
    assert abs(p / 101325 - 1) < 0.02
    for b in blocks:
        for t in (b["t_min_k"], b["t_max_k"]):
            assert math.exp(b["a_pa"] - b["b_pa"] / (t + b["c_pa"])) < dp.MAX_ANTOINE_PA


def test_shomate_blocks_are_kept_per_phase():
    d = dp.NistWebBookClient.parse_nist_html(ETHANOL_PAGE)
    gas = d["shomate"]["gas"]
    assert [(b["t_min_k"], b["t_max_k"]) for b in gas] == [(298.0, 1200.0), (1200.0, 6000.0)]
    assert gas[0]["A"] == -9.34 and gas[1]["B"] == 35.8 and gas[0]["H"] == -234.8


def test_search_results_page_is_not_a_record():
    assert dp.NistWebBookClient.is_search_results(SEARCH_RESULTS_PAGE)
    assert not dp.NistWebBookClient.is_search_results(ETHANOL_PAGE)


# ---- cache and lookup hygiene ---------------------------------------------------------------------------------------

def test_search_results_and_offline_fallbacks_are_never_cached(monkeypatch):
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(lambda params: SEARCH_RESULTS_PAGE))
    assert dp.NistWebBookClient.lookup("C4H8O2", by="formula") is None
    assert dp._get_cached("nist:formula:c4h8o2") is None
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(lambda params: None))
    assert dp.NistWebBookClient.lookup("water", by="name") is None  # offline: no core record stored under a NIST key
    assert dp._get_cached("nist:name:water") is None


def test_good_pages_are_cached_and_expire(monkeypatch):
    fetch = fake_fetch({"c64175": ETHANOL_PAGE})
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(fetch))
    first = dp.NistWebBookClient.lookup("64-17-5", by="cas")
    assert first and first["t_boil_k"] == 351.5
    assert len(fetch.calls) == 1
    dp.NistWebBookClient.lookup("64-17-5", by="cas")
    assert len(fetch.calls) == 1, "second lookup is served from the cache"
    # a record older than the TTL is fetched again
    monkeypatch.setattr(dp, "CACHE_TTL_SEC", -1.0)
    dp.NistWebBookClient.lookup("64-17-5", by="cas")
    assert len(fetch.calls) == 2


def test_cache_lives_outside_the_repository():
    import server.data_proxy as mod
    from pathlib import Path

    repo = Path(__file__).resolve().parent.parent
    # the module default (not the per-test override) is a user directory, never server/cache
    default = mod._cache_dir()
    assert repo not in default.parents and default != repo / "server" / "cache"


def test_nist_rate_limit_is_five_seconds():
    assert dp.NIST_MIN_INTERVAL_SEC == 5.0


def test_gitignore_excludes_the_nist_cache():
    from pathlib import Path

    text = (Path(__file__).resolve().parent.parent / ".gitignore").read_text()
    assert "server/cache/*.db" in text and "server/chamber.db" in text


# ---- identity ----------------------------------------------------------------------------------------------------------

def test_core_table_is_matched_by_inchikey_or_cas_only():
    # same formula as ethanol, different compound: no core record
    assert dp.core_record_for(inchikey="LCGLNKUTAGEVQW-UHFFFAOYSA-N") is None  # dimethyl ether
    assert dp.core_record_for() is None
    assert dp.core_record_for(inchikey="LFQSCWFLJHTTHZ-UHFFFAOYSA-N")["name"] == "ethanol"
    assert dp.core_record_for(cas="64-19-7")["name"] == "acetic acid"
    r = dp.UnifiedPropertyResolver.resolve_compound(name="Methoxymethane", formula="C2H6O", smiles="COC")
    assert r.get("t_boil_k") != 351.5 and r["name"] != "ethanol", r
    r = dp.UnifiedPropertyResolver.resolve_compound(name="Methyl formate", formula="C2H4O2", smiles="COC=O")
    assert r.get("dh_vap_kj_mol") != 23.7


def test_resolver_marks_joback_values_as_estimated(monkeypatch):
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(lambda params: None))
    r = dp.UnifiedPropertyResolver.resolve_compound(name="Diethyl ether", formula="C4H10O", smiles="CCOCC")
    assert r["tier"] == "estimated"
    assert {"t_boil_k", "t_fus_k"} <= set(r["estimated_fields"])
    assert isinstance(r["cp_coefficients"], list) and len(r["cp_coefficients"]) == 4
    assert abs(r["t_boil_k"] - 307.6) < 25


def test_resolver_gives_no_joback_numbers_for_uncovered_molecules(monkeypatch):
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(lambda params: None))
    r = dp.UnifiedPropertyResolver.resolve_compound(name="Tetramethylammonium", smiles="C[N+](C)(C)C")
    assert "t_boil_k" not in r and r["tier"] == "speculative"


def test_nist_page_with_a_contradicting_inchikey_is_discarded(monkeypatch):
    fetch = fake_fetch({"c64175": ETHANOL_PAGE})
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(fetch))
    r = dp.UnifiedPropertyResolver.resolve_compound(cas="64-17-5", inchikey="LCGLNKUTAGEVQW-UHFFFAOYSA-N")
    assert "t_boil_k" not in r or r["tier"] != "imported"


# ---- endpoints ---------------------------------------------------------------------------------------------------------

def test_data_endpoints_require_the_session_token():
    for method, url, kw in [
        ("get", "/api/data/properties", {"params": {"cas": "64-17-5"}}),
        ("get", "/api/data/nist-webbook", {"params": {"cas": "64-17-5"}}),
        ("post", "/api/data/resolve-compound", {"json": {"cas": "64-17-5"}}),
    ]:
        res = getattr(client, method)(url, **kw)
        assert res.status_code == 401, (url, res.status_code)
        res = getattr(client, method)(url, headers={"Authorization": "Bearer wrong"}, **kw)
        assert res.status_code == 401


def test_properties_endpoint_returns_core_record_for_cas():
    res = client.get("/api/data/properties", params={"cas": "64-17-5"}, headers=AUTH)
    assert res.status_code == 200
    data = res.json()
    assert data.get("dhf_liquid_kj_mol") is not None
    assert data.get("antoine") is not None
    assert data.get("t_boil_k") is not None and data.get("t_fus_k") is not None
    assert data["tier"] == "tabulated"


def test_nist_endpoint_serves_a_parsed_page(monkeypatch):
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(fake_fetch({"c64175": ETHANOL_PAGE})))
    res = client.get("/api/data/nist-webbook", params={"cas": "64-17-5"}, headers=AUTH)
    assert res.status_code == 200
    data = res.json()
    assert data["dhf_liquid_kj_mol"] == -277.6 and len(data["antoine"]) == 2


def test_resolve_compound_endpoint_with_joback(monkeypatch):
    monkeypatch.setattr(dp.NistWebBookClient, "fetch_nist_html", staticmethod(lambda params: None))
    payload = {"formula": "C4H10O", "name": "Diethyl ether", "smiles": "CCOCC"}
    res = client.post("/api/data/resolve-compound", json=payload, headers=AUTH)
    assert res.status_code == 200
    data = res.json()
    assert "t_boil_k" in data and "dhf_gas_kj_mol" in data
    assert data["tier"] == "estimated"
    assert "Joback Group Contribution" in data["provenance"].values()
