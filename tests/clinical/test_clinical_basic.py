import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '../../backend'))
from server import app

def test_list_especialidades():
    with TestClient(app) as client:
        response = client.get("/api/especialidades")
        assert response.status_code == 200

def test_buscar_cie10_requiere_auth():
    with TestClient(app) as client:
        response = client.get("/api/cie10/buscar?q=")
        assert response.status_code in [401, 403]
