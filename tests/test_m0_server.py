import pytest
from fastapi.testclient import TestClient
from server.main import app
from server.security import get_session_token

client = TestClient(app)

def test_m0_health_endpoint():
    response = client.get("/api/health", headers={"Host": "localhost"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["token_active"] is True
    assert "xtb_engine" in data

def test_m0_dns_rebinding_protection():
    # Attack request with malicious host header
    response = client.get("/api/health", headers={"Host": "evil-attacker.com"})
    assert response.status_code == 403
    assert "DNS rebinding protection" in response.json()["detail"]

def test_m0_session_token_security():
    # Unauthorized call without token
    response = client.post("/api/xtb/trivial-test", headers={"Host": "localhost"})
    assert response.status_code == 401

    # Authorized call with session token
    token = get_session_token()
    response = client.post(
        "/api/xtb/trivial-test",
        headers={"Host": "localhost", "Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["species"] == "H2O"
    assert "energy_hartree" in data
    assert data["energy_hartree"] < 0  # Bound molecule energy

def test_m0_xtb_semiempirical_job():
    token = get_session_token()
    response = client.post(
        "/api/xtb/run",
        headers={"Host": "localhost", "Authorization": f"Bearer {token}"},
        json={"smiles": "CCO", "family": "alcohol"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert "job_id" in data
