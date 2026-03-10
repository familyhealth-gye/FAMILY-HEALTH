#!/usr/bin/env python3
"""
Integration Test for Proformas-Abonos linking
Tests the business logic of linking payments to proformas
"""

import requests
import json
from datetime import datetime

BACKEND_URL = "https://clinic-tooth-render.preview.emergentagent.com/api"

def test_proforma_abono_integration():
    """Test integration between proformas and abonos"""
    print("Testing Proforma-Abono Integration...")
    
    # Login as admin
    login_response = requests.post(f"{BACKEND_URL}/auth/login", json={
        "username": "admin_test",
        "password": "admin123"
    })
    
    if login_response.status_code != 200:
        print("❌ Login failed")
        return False
        
    token = login_response.json()["access_token"]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Get existing proformas
    proformas_response = requests.get(f"{BACKEND_URL}/proformas", headers=headers)
    if proformas_response.status_code != 200:
        print("❌ Failed to get proformas")
        return False
        
    proformas = proformas_response.json()
    if not proformas:
        print("❌ No proformas found for integration test")
        return False
        
    proforma = proformas[0]  # Use first proforma
    print(f"Using proforma: {proforma['numero_proforma']} - Total: ${proforma['total']}")
    
    # Create abono linked to proforma
    abono_data = {
        "paciente_nombre": proforma["paciente_nombre"],
        "paciente_cedula": proforma["paciente_cedula"],
        "monto": proforma["total"] / 2,  # Pay half
        "fecha": "2024-01-16",
        "tipo_pago": "Transferencia",
        "concepto": f"Abono para proforma {proforma['numero_proforma']}",
        "proforma_id": proforma["id"],
        "saldo_pendiente": proforma["total"] / 2,  # Remaining half
        "recibo_numero": "REC-INT-001",
        "observaciones": "Pago parcial de proforma"
    }
    
    abono_response = requests.post(f"{BACKEND_URL}/abonos", headers=headers, json=abono_data)
    if abono_response.status_code != 200:
        print(f"❌ Failed to create linked abono: {abono_response.text}")
        return False
        
    abono = abono_response.json()
    print(f"✅ Created linked abono: {abono['recibo_numero']} - Amount: ${abono['monto']}")
    
    # Verify abono is linked to proforma
    if abono["proforma_id"] == proforma["id"]:
        print("✅ Abono correctly linked to proforma")
    else:
        print("❌ Abono not properly linked to proforma")
        return False
        
    # Get patient abonos to verify filtering
    patient_abonos_response = requests.get(
        f"{BACKEND_URL}/abonos/patient/{proforma['paciente_cedula']}", 
        headers=headers
    )
    
    if patient_abonos_response.status_code != 200:
        print("❌ Failed to get patient abonos")
        return False
        
    patient_abonos = patient_abonos_response.json()
    linked_abonos = [a for a in patient_abonos if a.get("proforma_id") == proforma["id"]]
    
    if linked_abonos:
        print(f"✅ Found {len(linked_abonos)} abono(s) linked to proforma")
        total_paid = sum(a["monto"] for a in linked_abonos)
        remaining = proforma["total"] - total_paid
        print(f"   Total proforma: ${proforma['total']}")
        print(f"   Total paid: ${total_paid}")
        print(f"   Remaining: ${remaining}")
        return True
    else:
        print("❌ No linked abonos found")
        return False

if __name__ == "__main__":
    success = test_proforma_abono_integration()
    exit(0 if success else 1)