"""Database search (NIST WebBook + CAS Common Chemistry): query classification, page parsing, CAS property parsing,
the merged endpoint and the hosted-mode guard. No network: pages are trimmed copies of real WebBook output."""
import pytest
from fastapi.testclient import TestClient

import server.cas_common as cas
import server.compound_search as cs
from server.main import app
from server.security import get_session_token

client = TestClient(app, base_url="http://127.0.0.1:8000")
AUTH = {"Authorization": f"Bearer {get_session_token()}"}

LIST_PAGE = """<html><head><title>Search Results</title></head><body><main id="main"><h1>Search Results</h1>
<ol>
<li><a href="/cgi/cbook.cgi?ID=C1333740&amp;Units=SI">Hydrogen</a>  (H<sub>2</sub>)<br /><img src="x" /></li>
<li><a href="/cgi/cbook.cgi?ID=C12385136&amp;Units=SI">Hydrogen, atomic</a>  (H)<br /><img src="x" /></li>
<li><a href="/cgi/cbook.cgi?ID=C25722069&amp;Units=SI">Poly(oxacyclobutane)</a>  (C<sub>3</sub>H<sub>6</sub>O)<sub>n</sub></li>
<li><a href="/cgi/cbook.cgi?ID=B6000010&amp;Units=SI">Something</a>  (C<sub>2</sub>H<sub>4</sub>)<br /></li>
</ol></main></body></html>"""

ONE_PAGE = """<html><head><title>Copper</title></head><body><main><h1 id="Top">Copper</h1><ul>
<li><strong><a href="x">Formula</a>:</strong> Cu</li>
<li><strong>IUPAC Standard InChIKey:</strong> <span class="inchi-text">RYGMFSIKBFXOCR-UHFFFAOYSA-N</span></li>
<li><strong>CAS Registry Number:</strong> 7440-50-8</li></ul></main></body></html>"""


@pytest.mark.parametrize("q,kind", [
    ("67-64-1", "cas"), ("CSCPPACGZOOCGX-UHFFFAOYSA-N", "inchikey"),
    ("NaCl", "formula"), ("H2SO4", "formula"), ("Ca(OH)2", "formula"), ("C3H6O", "formula"), ("Cu", "formula"), ("H2", "formula"),
    ("acetone", "name"), ("copper", "name"), ("Zinc", "name"), ("Acetone", "name"), ("hydrogen gas", "name"), ("copper(II) sulfate", "name"),
])
def test_classify(q, kind):
    assert cs.classify(q) == kind


def test_list_page_hits_have_cas_from_the_nist_id_and_polymers_are_skipped():
    hits = cs.parse_nist_search(LIST_PAGE)
    assert [h["name"] for h in hits] == ["Hydrogen", "Hydrogen, atomic", "Something"]
    assert hits[0] == {"name": "Hydrogen", "formula": "H2", "source": "nist", "nist_id": "C1333740", "cas": "1333-74-0"}
    assert hits[1]["formula"] == "H" and hits[1]["cas"] == "12385-13-6"
    assert "cas" not in hits[2]  # B-ids are not CAS numbers


def test_single_compound_page_identity():
    h = cs.parse_nist_compound_identity(ONE_PAGE)
    assert h["name"] == "Copper" and h["formula"] == "Cu" and h["cas"] == "7440-50-8"
    assert h["inchikey"] == "RYGMFSIKBFXOCR-UHFFFAOYSA-N"


def test_cas_temperature_and_density_parsing():
    assert cas.parse_temperature("-94.7 °C") == pytest.approx((178.45, None))
    assert cas.parse_temperature("56 °C @ 760 Torr")[1] == pytest.approx(101325.0, rel=1e-3)
    assert cas.parse_temperature("−95 to −94 °C")[0] == pytest.approx(178.65)
    assert cas.parse_temperature("30-80 °C") is None  # not a point
    assert cas.parse_density("0.7845 g/cm3 @ 25 °C") == pytest.approx((0.7845, 298.15))
    assert cas.parse_density("791 kg/m3")[0] == pytest.approx(0.791)


def test_cas_detail_properties_drop_boiling_point_at_reduced_pressure():
    d = {"rn": "67-64-1", "name": "Acetone", "molecularFormula": "C<sub>3</sub>H<sub>6</sub>O", "molecularMass": "58.08",
         "canonicalSmile": "CC(C)=O", "inchiKey": "CSCPPACGZOOCGX-UHFFFAOYSA-N",
         "experimentalProperties": [
             {"name": "Melting Point", "property": "-94.7 °C"},
             {"name": "Boiling Point", "property": "20 °C @ 100 Torr"},
             {"name": "Boiling Point", "property": "56.05 °C @ 760 Torr"},
             {"name": "Density", "property": "0.7845 g/cm3 @ 25 °C"}]}
    p = cas.properties_from_detail(d)
    assert p["formula"] == "C3H6O" and p["smiles"] == "CC(C)=O" and p["mw"] == 58.08
    assert p["t_boil_k"] == pytest.approx(329.2, abs=0.1)  # the reduced-pressure value was skipped, the normal one taken
    assert p["t_fus_k"] == pytest.approx(178.45) and p["density_g_ml"] == 0.7845


def test_search_endpoint_merges_sources_and_reports_each_status(monkeypatch):
    monkeypatch.setattr(cs, "nist_search", lambda q, k, limit=10: {"status": "ok", "hits": [{"name": "Acetone", "formula": "C3H6O", "cas": "67-64-1", "source": "nist"}]})
    monkeypatch.setattr(cs, "cas_search", lambda q, k, limit=8: {"status": "disabled", "hits": [], "message": "needs CAS_API_KEY"})
    r = client.get("/api/data/search", params={"q": "acetone"}, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["kind"] == "name" and body["hits"][0]["cas"] == "67-64-1"
    assert body["sources"]["nist"]["status"] == "ok" and body["sources"]["cas"]["status"] == "disabled"
    assert client.get("/api/data/search", params={"q": "acetone"}).status_code == 401  # local server: session token needed


def test_hosted_mode_needs_no_token_but_refuses_cross_origin_and_limits_the_rate(monkeypatch):
    import server.security as sec
    monkeypatch.setattr(sec, "HOSTED", True)
    monkeypatch.setattr(sec, "HOSTED_RATE_PER_MIN", 3)
    sec._hits.clear()
    monkeypatch.setattr(cs, "nist_search", lambda q, k, limit=10: {"status": "none", "hits": []})
    monkeypatch.setattr(cs, "cas_search", lambda q, k, limit=8: {"status": "none", "hits": []})
    h = {"Host": "chem.example.com", "Origin": "https://chem.example.com"}
    c = TestClient(app, base_url="https://chem.example.com")
    assert c.get("/api/data/search", params={"q": "acetone"}, headers=h).status_code == 200
    bad = c.get("/api/data/search", params={"q": "acetone"}, headers={"Host": "chem.example.com", "Origin": "https://evil.example"})
    assert bad.status_code == 403
    for _ in range(2):  # the limit is 3 per minute: the first call and these two are allowed, the next is not
        assert c.get("/api/data/search", params={"q": "acetone"}, headers=h).status_code == 200
    assert c.get("/api/data/search", params={"q": "acetone"}, headers=h).status_code == 429
    sec._hits.clear()


def test_health_reports_capabilities(monkeypatch):
    monkeypatch.delenv("CAS_API_KEY", raising=False)
    caps = client.get("/api/health").json()["capabilities"]
    assert caps["search"] is True and caps["cas"] is False
    monkeypatch.setenv("CAS_API_KEY", "x")
    assert client.get("/api/health").json()["capabilities"]["cas"] is True


def test_env_file_loader_sets_missing_variables_only(tmp_path, monkeypatch):
    from server.env import load_env_file
    f = tmp_path / ".env"
    f.write_text('# comment\nCAS_API_KEY="abc123"  \nexport RC_X=1 # trailing\nEMPTY=\nKEEP=fromfile\n')
    monkeypatch.delenv("CAS_API_KEY", raising=False)
    monkeypatch.delenv("RC_X", raising=False)
    monkeypatch.delenv("EMPTY", raising=False)
    monkeypatch.setenv("KEEP", "fromshell")
    assert load_env_file(f) == 2
    import os
    assert os.environ["CAS_API_KEY"] == "abc123" and os.environ["RC_X"] == "1"
    assert "EMPTY" not in os.environ and os.environ["KEEP"] == "fromshell"
    monkeypatch.delenv("CAS_API_KEY"); monkeypatch.delenv("RC_X")


def test_cas_real_response_shapes():
    """Shapes of a live reply of /direct-api/detail (acetone, read 2026-10-08): prefixed InChIKey, g/cm\u00b3, 'Press:' and 'Temp:' labels."""
    d = {"rn": "67-64-1", "name": "Acetone", "molecularFormula": "C<sub>3</sub>H<sub>6</sub>O", "molecularMass": "58.08",
         "canonicalSmile": "O=C(C)C", "inchiKey": "InChIKey=CSCPPACGZOOCGX-UHFFFAOYSA-N",
         "experimentalProperties": [
             {"name": "Boiling Point", "property": "56.0 \u00b0C @ Press: 760 Torr"},
             {"name": "Melting Point", "property": "-94.8 \u00b0C"},
             {"name": "Density", "property": "0.7899 g/cm\u00b3 @ Temp: 20 \u00b0C"}]}
    p = cas.properties_from_detail(d)
    assert p["inchikey"] == "CSCPPACGZOOCGX-UHFFFAOYSA-N"
    assert p["t_boil_k"] == pytest.approx(329.15) and p["t_fus_k"] == pytest.approx(178.35)
    assert p["density_g_ml"] == 0.7899 and p["density_t_k"] == pytest.approx(293.15)
    # a boiling point at reduced pressure written the same way is not the normal boiling point
    d["experimentalProperties"][0]["property"] = "20.0 \u00b0C @ Press: 100 Torr"
    assert "t_boil_k" not in cas.properties_from_detail(d)


def test_cas_identity_alone_does_not_raise_the_tier(monkeypatch):
    """CAS giving only a SMILES must not turn a Joback-estimated record into an 'imported' one; a measured melting point does."""
    from server.data_proxy import UnifiedPropertyResolver as U
    monkeypatch.setenv("CAS_API_KEY", "x")
    monkeypatch.setattr(cas, "detail", lambda rn: {"rn": rn, "name": "X", "canonicalSmile": "OCCO", "inchiKey": "InChIKey=LYCAIKOWRPUZTN-UHFFFAOYSA-N"})
    monkeypatch.setattr("server.data_proxy.NistWebBookClient.lookup", staticmethod(lambda *a, **k: None))
    r = U.resolve_compound(name="x", cas="107-21-1")
    assert r["smiles"] == "OCCO" and r["tier"] != "imported"
    monkeypatch.setattr(cas, "detail", lambda rn: {"rn": rn, "name": "X", "canonicalSmile": "OCCO", "experimentalProperties": [{"name": "Melting Point", "property": "-114 °C"}]})
    r = U.resolve_compound(name="x", cas="107-21-1")
    assert r["tier"] == "imported" and r["t_fus_k"] == pytest.approx(159.15)
