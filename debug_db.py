#!/usr/bin/env python3
"""
Debug script to check database contents
"""

import requests
import json

BACKEND_URL = "https://patient-payments-2.preview.emergentagent.com/api"

# Get auth token
login_data = {"username": "admin_test", "password": "admin123"}
response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
token = response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("=== APPOINTMENTS ===")
response = requests.get(f"{BACKEND_URL}/appointments", headers=headers)
appointments = response.json()
for apt in appointments[-3:]:  # Last 3 appointments
    print(f"ID: {apt['id']}, Name: {apt['nombre_completo']}, Especialidad: {apt.get('especialidad', 'N/A')}")

print("\n=== PROFORMAS ===")
response = requests.get(f"{BACKEND_URL}/proformas", headers=headers)
proformas = response.json()
for prf in proformas[-3:]:  # Last 3 proformas
    print(f"ID: {prf['id']}, Estado: {prf.get('estado', 'N/A')}, Total: {prf.get('total', 0)}")

print("\n=== FINANCIAL CONSULTAS ===")
response = requests.get(f"{BACKEND_URL}/financial/consultas", headers=headers)
consultas = response.json()
print(f"Total consultas financieras: {len(consultas)}")
for cons in consultas[-3:]:  # Last 3 consultas
    print(f"ID: {cons['id']}, Paciente: {cons.get('paciente_nombre', 'N/A')}, Total: {cons.get('total', 0)}")