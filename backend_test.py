#!/usr/bin/env python3
"""
Backend API Testing Suite for Family Health System
Tests all new endpoints: Proformas, Abonos, Odontogramas, and Medical History Odontology
"""

import requests
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "http://localhost:10000/api"
TEST_USER = {
    "username": "admin_test",
    "password": "admin123",
    "email": "admin@test.com",
    "nombre_completo": "Administrador Test",
    "role": "Administrador"
}

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.token = None
        self.headers = {"Content-Type": "application/json"}
        self.test_data = {}
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")
        
    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    params: Optional[Dict] = None) -> requests.Response:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{endpoint}"
        headers = self.headers.copy()
        
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=headers, json=data, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            self.log(f"Request failed: {e}", "ERROR")
            raise
            
    def authenticate(self) -> bool:
        """Authenticate and get JWT token"""
        self.log("Starting authentication...")
        
        # Try to register admin user first
        try:
            register_response = self.make_request("POST", "/auth/register", TEST_USER)
            if register_response.status_code == 201:
                self.log("Admin user registered successfully")
            elif register_response.status_code == 400:
                self.log("Admin user already exists")
            else:
                self.log(f"Registration failed: {register_response.status_code} - {register_response.text}", "WARNING")
        except Exception as e:
            self.log(f"Registration error: {e}", "WARNING")
            
        # Login
        login_data = {
            "username": TEST_USER["username"],
            "password": TEST_USER["password"]
        }
        
        try:
            response = self.make_request("POST", "/auth/login", login_data)
            if response.status_code == 200:
                token_data = response.json()
                self.token = token_data["access_token"]
                self.log("Authentication successful")
                return True
            else:
                self.log(f"Login failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Authentication error: {e}", "ERROR")
            return False
            
    def authenticate_as_doctor(self) -> bool:
        """Authenticate as doctor user for medical history tests"""
        if "doctor_user" not in self.test_data:
            self.log("No doctor user available for authentication", "ERROR")
            return False
            
        login_data = {
            "username": self.test_data["doctor_user"]["username"],
            "password": self.test_data["doctor_user"]["password"]
        }
        
        try:
            response = self.make_request("POST", "/auth/login", login_data)
            if response.status_code == 200:
                token_data = response.json()
                self.token = token_data["access_token"]
                self.log("Doctor authentication successful")
                return True
            else:
                self.log(f"Doctor login failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Doctor authentication error: {e}", "ERROR")
            return False
            
    def setup_test_data(self) -> bool:
        """Create necessary test data (doctors, appointments)"""
        self.log("Setting up test data...")
        
        # Create test doctor
        doctor_data = {
            "nombre": "Dr. Juan Pérez",
            "especialidad": "Odontología",
            "porcentaje": 60.0
        }
        
        try:
            response = self.make_request("POST", "/doctors", doctor_data)
            if response.status_code == 200:
                doctor = response.json()
                self.test_data["doctor_id"] = doctor["id"]
                self.log(f"Test doctor created: {doctor['id']}")
                
                # Create a doctor user linked to this doctor
                doctor_user_data = {
                    "username": "doctor_test",
                    "password": "doctor123",
                    "email": "doctor@test.com",
                    "nombre_completo": "Dr. Juan Pérez",
                    "role": "Doctor",
                    "doctor_id": doctor["id"]
                }
                
                # Register doctor user
                register_response = self.make_request("POST", "/auth/register", doctor_user_data)
                if register_response.status_code in [200, 201]:
                    self.log("Doctor user created successfully")
                    # Store doctor credentials for later use
                    self.test_data["doctor_user"] = {
                        "username": "doctor_test",
                        "password": "doctor123"
                    }
                elif register_response.status_code == 400:
                    self.log("Doctor user already exists")
                    # Store doctor credentials for later use
                    self.test_data["doctor_user"] = {
                        "username": "doctor_test",
                        "password": "doctor123"
                    }
                else:
                    self.log(f"Failed to create doctor user: {register_response.status_code} - {register_response.text}", "WARNING")
                    
            else:
                self.log(f"Failed to create doctor: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error creating doctor: {e}", "ERROR")
            return False
            
        # Create test appointment
        appointment_data = {
            "nombre_completo": "María González",
            "cedula": "1234567890",
            "edad": 35,
            "telefono": "0987654321",
            "especialidad": "Odontología",
            "doctor_id": self.test_data["doctor_id"],
            "fecha": "2024-01-15",
            "hora": "10:00",
            "tipo_pago": "Efectivo",
            "observaciones": "Paciente de prueba"
        }
        
        try:
            response = self.make_request("POST", "/appointments", appointment_data)
            if response.status_code == 200:
                appointment = response.json()
                self.test_data["appointment_id"] = appointment["id"]
                self.test_data["paciente_id"] = appointment["id"]
                self.test_data["paciente_cedula"] = appointment["cedula"]
                self.test_data["paciente_nombre"] = appointment["nombre_completo"]
                self.log(f"Test appointment created: {appointment['id']}")
                return True
            else:
                self.log(f"Failed to create appointment: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"Error creating appointment: {e}", "ERROR")
            return False
            
    def test_proformas(self) -> Dict[str, bool]:
        """Test Proforma endpoints"""
        self.log("Testing Proforma endpoints...")
        results = {}
        
        # Test POST /api/proformas
        proforma_data = {
            "numero_proforma": "PRF-001",
            "paciente_nombre": self.test_data["paciente_nombre"],
            "paciente_cedula": self.test_data["paciente_cedula"],
            "paciente_telefono": "0987654321",
            "doctor_id": self.test_data["doctor_id"],
            "especialidad": "Odontología",
            "items": [
                {
                    "descripcion": "Limpieza dental",
                    "cantidad": 1,
                    "precio_unitario": 50.0,
                    "subtotal": 50.0
                },
                {
                    "descripcion": "Obturación",
                    "cantidad": 2,
                    "precio_unitario": 80.0,
                    "subtotal": 160.0
                }
            ],
            "descuento": 10.0,
            "fecha_emision": "2024-01-15",
            "validez_dias": 30,
            "observaciones": "Proforma de prueba"
        }
        
        try:
            response = self.make_request("POST", "/proformas", proforma_data)
            if response.status_code == 200:
                proforma = response.json()
                self.test_data["proforma_id"] = proforma["id"]
                
                # Verify calculations
                expected_subtotal = 210.0  # 50 + 160
                expected_total = 200.0     # 210 - 10
                
                if (proforma["subtotal"] == expected_subtotal and 
                    proforma["total"] == expected_total):
                    results["create_proforma"] = True
                    self.log("✅ POST /api/proformas - SUCCESS (calculations correct)")
                else:
                    results["create_proforma"] = False
                    self.log(f"❌ POST /api/proformas - FAILED (calculation error: subtotal={proforma['subtotal']}, total={proforma['total']})", "ERROR")
            else:
                results["create_proforma"] = False
                self.log(f"❌ POST /api/proformas - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["create_proforma"] = False
            self.log(f"❌ POST /api/proformas - ERROR: {e}", "ERROR")
            
        # Test GET /api/proformas
        try:
            response = self.make_request("GET", "/proformas")
            if response.status_code == 200:
                proformas = response.json()
                if isinstance(proformas, list) and len(proformas) > 0:
                    results["list_proformas"] = True
                    self.log("✅ GET /api/proformas - SUCCESS")
                else:
                    results["list_proformas"] = False
                    self.log("❌ GET /api/proformas - FAILED (empty list)", "ERROR")
            else:
                results["list_proformas"] = False
                self.log(f"❌ GET /api/proformas - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["list_proformas"] = False
            self.log(f"❌ GET /api/proformas - ERROR: {e}", "ERROR")
            
        # Test PUT /api/proformas/{id}
        if "proforma_id" in self.test_data:
            update_data = {
                "estado": "Aceptada",
                "observaciones": "Proforma aceptada por el paciente"
            }
            
            try:
                response = self.make_request("PUT", f"/proformas/{self.test_data['proforma_id']}", update_data)
                if response.status_code == 200:
                    updated_proforma = response.json()
                    if updated_proforma["estado"] == "Aceptada":
                        results["update_proforma"] = True
                        self.log("✅ PUT /api/proformas/{id} - SUCCESS")
                    else:
                        results["update_proforma"] = False
                        self.log("❌ PUT /api/proformas/{id} - FAILED (estado not updated)", "ERROR")
                else:
                    results["update_proforma"] = False
                    self.log(f"❌ PUT /api/proformas/{{id}} - FAILED: {response.status_code} - {response.text}", "ERROR")
            except Exception as e:
                results["update_proforma"] = False
                self.log(f"❌ PUT /api/proformas/{{id}} - ERROR: {e}", "ERROR")
        else:
            results["update_proforma"] = False
            self.log("❌ PUT /api/proformas/{id} - SKIPPED (no proforma_id)", "ERROR")
            
        return results
        
    def test_abonos(self) -> Dict[str, bool]:
        """Test Abono endpoints"""
        self.log("Testing Abono endpoints...")
        results = {}
        
        # Test POST /api/abonos
        abono_data = {
            "paciente_nombre": self.test_data["paciente_nombre"],
            "paciente_cedula": self.test_data["paciente_cedula"],
            "monto": 100.0,
            "fecha": "2024-01-15",
            "tipo_pago": "Efectivo",
            "concepto": "Abono para tratamiento dental",
            "proforma_id": self.test_data.get("proforma_id"),
            "appointment_id": self.test_data["appointment_id"],
            "saldo_pendiente": 100.0,
            "recibo_numero": "REC-001",
            "observaciones": "Primer abono del paciente"
        }
        
        try:
            response = self.make_request("POST", "/abonos", abono_data)
            if response.status_code == 200:
                abono = response.json()
                self.test_data["abono_id"] = abono["id"]
                results["create_abono"] = True
                self.log("✅ POST /api/abonos - SUCCESS")
            else:
                results["create_abono"] = False
                self.log(f"❌ POST /api/abonos - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["create_abono"] = False
            self.log(f"❌ POST /api/abonos - ERROR: {e}", "ERROR")
            
        # Test GET /api/abonos
        try:
            response = self.make_request("GET", "/abonos")
            if response.status_code == 200:
                abonos = response.json()
                if isinstance(abonos, list) and len(abonos) > 0:
                    results["list_abonos"] = True
                    self.log("✅ GET /api/abonos - SUCCESS")
                else:
                    results["list_abonos"] = False
                    self.log("❌ GET /api/abonos - FAILED (empty list)", "ERROR")
            else:
                results["list_abonos"] = False
                self.log(f"❌ GET /api/abonos - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["list_abonos"] = False
            self.log(f"❌ GET /api/abonos - ERROR: {e}", "ERROR")
            
        # Test GET /api/abonos/patient/{cedula}
        try:
            response = self.make_request("GET", f"/abonos/patient/{self.test_data['paciente_cedula']}")
            if response.status_code == 200:
                patient_abonos = response.json()
                if isinstance(patient_abonos, list) and len(patient_abonos) > 0:
                    results["get_patient_abonos"] = True
                    self.log("✅ GET /api/abonos/patient/{cedula} - SUCCESS")
                else:
                    results["get_patient_abonos"] = False
                    self.log("❌ GET /api/abonos/patient/{cedula} - FAILED (empty list)", "ERROR")
            else:
                results["get_patient_abonos"] = False
                self.log(f"❌ GET /api/abonos/patient/{{cedula}} - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["get_patient_abonos"] = False
            self.log(f"❌ GET /api/abonos/patient/{{cedula}} - ERROR: {e}", "ERROR")
            
        return results
        
    def test_odontograms(self) -> Dict[str, bool]:
        """Test Odontogram endpoints"""
        self.log("Testing Odontogram endpoints...")
        results = {}
        
        # Create 32 teeth with different states
        dientes = []
        estados = ["Sano", "Caries", "Obturación", "Extracción", "Corona", "Endodoncia", "Implante"]
        
        for i in range(1, 33):  # 32 teeth
            estado = estados[i % len(estados)]
            dientes.append({
                "tooth_number": i,
                "estado": estado,
                "cara_oclusal": "Normal" if estado == "Sano" else "Afectada",
                "cara_vestibular": "Normal",
                "cara_palatina": "Normal",
                "cara_mesial": "Normal",
                "cara_distal": "Normal",
                "observaciones": f"Diente {i} - {estado}"
            })
            
        # Test POST /api/odontograms
        odontogram_data = {
            "paciente_id": self.test_data["paciente_id"],
            "doctor_id": self.test_data["doctor_id"],
            "fecha": "2024-01-15",
            "dientes": dientes,
            "diagnostico_general": "Múltiples caries y obturaciones",
            "tratamiento_recomendado": "Limpieza, obturaciones y endodoncia",
            "observaciones": "Paciente requiere tratamiento integral"
        }
        
        try:
            response = self.make_request("POST", "/odontograms", odontogram_data)
            if response.status_code == 200:
                odontogram = response.json()
                self.test_data["odontogram_id"] = odontogram["id"]
                
                # Verify 32 teeth
                if len(odontogram["dientes"]) == 32:
                    results["create_odontogram"] = True
                    self.log("✅ POST /api/odontograms - SUCCESS (32 teeth created)")
                else:
                    results["create_odontogram"] = False
                    self.log(f"❌ POST /api/odontograms - FAILED (wrong teeth count: {len(odontogram['dientes'])})", "ERROR")
            else:
                results["create_odontogram"] = False
                self.log(f"❌ POST /api/odontograms - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["create_odontogram"] = False
            self.log(f"❌ POST /api/odontograms - ERROR: {e}", "ERROR")
            
        # Test GET /api/odontograms
        try:
            response = self.make_request("GET", "/odontograms")
            if response.status_code == 200:
                odontograms = response.json()
                if isinstance(odontograms, list) and len(odontograms) > 0:
                    results["list_odontograms"] = True
                    self.log("✅ GET /api/odontograms - SUCCESS")
                else:
                    results["list_odontograms"] = False
                    self.log("❌ GET /api/odontograms - FAILED (empty list)", "ERROR")
            else:
                results["list_odontograms"] = False
                self.log(f"❌ GET /api/odontograms - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["list_odontograms"] = False
            self.log(f"❌ GET /api/odontograms - ERROR: {e}", "ERROR")
            
        # Test GET /api/odontograms/patient/{paciente_id}
        try:
            response = self.make_request("GET", f"/odontograms/patient/{self.test_data['paciente_id']}")
            if response.status_code == 200:
                patient_odontograms = response.json()
                if isinstance(patient_odontograms, list) and len(patient_odontograms) > 0:
                    results["get_patient_odontograms"] = True
                    self.log("✅ GET /api/odontograms/patient/{paciente_id} - SUCCESS")
                else:
                    results["get_patient_odontograms"] = False
                    self.log("❌ GET /api/odontograms/patient/{paciente_id} - FAILED (empty list)", "ERROR")
            else:
                results["get_patient_odontograms"] = False
                self.log(f"❌ GET /api/odontograms/patient/{{paciente_id}} - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["get_patient_odontograms"] = False
            self.log(f"❌ GET /api/odontograms/patient/{{paciente_id}} - ERROR: {e}", "ERROR")
            
        return results
        
    def test_medical_history_odontology(self) -> Dict[str, bool]:
        """Test Medical History Odontology endpoints"""
        self.log("Testing Medical History Odontology endpoints...")
        results = {}
        
        # Authenticate as doctor for medical history operations
        if not self.authenticate_as_doctor():
            self.log("Failed to authenticate as doctor. Skipping medical history tests.", "ERROR")
            return {
                "create_odontology_history": False,
                "list_odontology_histories": False,
                "get_odontology_history_by_appointment": False
            }
        
        # Test POST /api/medical-history/odontology
        history_data = {
            "appointment_id": self.test_data["appointment_id"],
            "motivo_consulta": "Dolor en muela del juicio",
            "dolor_dental": True,
            "ubicacion_dolor": "Molar superior derecho",
            "intensidad_dolor": "Severo",
            "tiempo_dolor": "3 días",
            "ultima_visita_odonto": "Hace 6 meses",
            "frecuencia_cepillado": "2 veces al día",
            "uso_hilo_dental": True,
            "uso_enjuague": False,
            "tratamientos_previos": "Limpieza dental",
            "diabetes": False,
            "hipertension": False,
            "cardiopatias": False,
            "hepatitis": False,
            "vih": False,
            "epilepsia": False,
            "embarazo": False,
            "alergias_medicamentos": "Penicilina",
            "medicamentos_actuales": "Ibuprofeno 400mg",
            "fumador": False,
            "bruxismo": True,
            "succion_digital": False,
            "estado_dental": {
                "higiene_oral": "Regular",
                "encia": "Gingivitis leve",
                "mucosa_oral": "Normal",
                "lengua": "Normal",
                "paladar": "Normal",
                "atm": "Sin alteraciones"
            },
            "odontograma_id": self.test_data.get("odontogram_id"),
            "diagnostico": "Caries profunda en molar 18",
            "cie10_codigo": "K02.9",
            "plan_tratamiento": "Endodoncia y corona",
            "procedimientos_realizados": "Examen clínico y radiografía",
            "materiales_utilizados": "Anestesia local",
            "medicamentos": "Amoxicilina 500mg cada 8 horas por 7 días",
            "proximo_control": "En 1 semana",
            "observaciones": "Paciente con alta sensibilidad",
            "recomendaciones": "Mejorar técnica de cepillado"
        }
        
        try:
            response = self.make_request("POST", "/medical-history/odontology", history_data)
            if response.status_code == 200:
                history = response.json()
                self.test_data["odontology_history_id"] = history["id"]
                results["create_odontology_history"] = True
                self.log("✅ POST /api/medical-history/odontology - SUCCESS")
            else:
                results["create_odontology_history"] = False
                self.log(f"❌ POST /api/medical-history/odontology - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["create_odontology_history"] = False
            self.log(f"❌ POST /api/medical-history/odontology - ERROR: {e}", "ERROR")
            
        # Test GET /api/medical-history/odontology
        try:
            response = self.make_request("GET", "/medical-history/odontology")
            if response.status_code == 200:
                histories = response.json()
                if isinstance(histories, list) and len(histories) > 0:
                    results["list_odontology_histories"] = True
                    self.log("✅ GET /api/medical-history/odontology - SUCCESS")
                else:
                    results["list_odontology_histories"] = False
                    self.log("❌ GET /api/medical-history/odontology - FAILED (empty list)", "ERROR")
            else:
                results["list_odontology_histories"] = False
                self.log(f"❌ GET /api/medical-history/odontology - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["list_odontology_histories"] = False
            self.log(f"❌ GET /api/medical-history/odontology - ERROR: {e}", "ERROR")
            
        # Test GET /api/medical-history/odontology/appointment/{appointment_id}
        try:
            response = self.make_request("GET", f"/medical-history/odontology/appointment/{self.test_data['appointment_id']}")
            if response.status_code == 200:
                history = response.json()
                if history and "id" in history:
                    results["get_odontology_history_by_appointment"] = True
                    self.log("✅ GET /api/medical-history/odontology/appointment/{appointment_id} - SUCCESS")
                else:
                    results["get_odontology_history_by_appointment"] = False
                    self.log("❌ GET /api/medical-history/odontology/appointment/{appointment_id} - FAILED (no data)", "ERROR")
            else:
                results["get_odontology_history_by_appointment"] = False
                self.log(f"❌ GET /api/medical-history/odontology/appointment/{{appointment_id}} - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["get_odontology_history_by_appointment"] = False
            self.log(f"❌ GET /api/medical-history/odontology/appointment/{{appointment_id}} - ERROR: {e}", "ERROR")
            
        return results
        
    def test_financial_endpoints(self) -> Dict[str, bool]:
        """Test Financial Cycle endpoints as requested"""
        self.log("Testing Financial Cycle endpoints...")
        results = {}
        
        # 1. Test crear consulta desde cita (Medicina General/Pediatría)
        self.log("1. Testing crear consulta desde cita...")
        
        # First create a test appointment for Medicina General
        mg_appointment_data = {
            "nombre_completo": "Carlos Mendoza",
            "cedula": "0987654321",
            "edad": 45,
            "telefono": "0999888777",
            "especialidad": "Medicina General",
            "doctor_id": self.test_data["doctor_id"],
            "fecha": "2024-01-20",
            "hora": "14:00",
            "tipo_pago": "Efectivo",
            "observaciones": "Consulta de control"
        }
        
        try:
            response = self.make_request("POST", "/appointments", mg_appointment_data)
            if response.status_code == 200:
                mg_appointment = response.json()
                self.test_data["mg_appointment_id"] = mg_appointment["id"]
                
                # Now create consulta from appointment
                servicios_data = [
                    {
                        "servicio": "Consulta General",
                        "descripcion": "Consulta médica general",
                        "precio_unitario": 25.0,
                        "cantidad": 1
                    },
                    {
                        "servicio": "Certificado Médico",
                        "descripcion": "Certificado de salud",
                        "precio_unitario": 20.0,
                        "cantidad": 1
                    }
                ]
                
                response = self.make_request("POST", f"/financial/consultas/desde-cita/{mg_appointment['id']}", servicios_data)
                if response.status_code == 200:
                    consulta_result = response.json()
                    self.test_data["consulta_id"] = consulta_result["consulta_id"]
                    
                    # Verify calculations
                    expected_total = 45.0  # 25 + 20
                    if consulta_result["total"] == expected_total and consulta_result["estado_pago"] == "pendiente":
                        results["crear_consulta_desde_cita"] = True
                        self.log("✅ POST /api/financial/consultas/desde-cita/{id} - SUCCESS")
                    else:
                        results["crear_consulta_desde_cita"] = False
                        self.log(f"❌ POST /api/financial/consultas/desde-cita/{{id}} - FAILED (calculation error: total={consulta_result['total']})", "ERROR")
                else:
                    results["crear_consulta_desde_cita"] = False
                    self.log(f"❌ POST /api/financial/consultas/desde-cita/{{id}} - FAILED: {response.status_code} - {response.text}", "ERROR")
            else:
                results["crear_consulta_desde_cita"] = False
                self.log(f"❌ Failed to create MG appointment: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["crear_consulta_desde_cita"] = False
            self.log(f"❌ POST /api/financial/consultas/desde-cita/{{id}} - ERROR: {e}", "ERROR")
        
        # 2. Test registrar pago en consulta
        self.log("2. Testing registrar pago en consulta...")
        if "consulta_id" in self.test_data:
            pago_data = {
                "monto": 25.0,
                "tipo_pago": "efectivo",
                "referencia": "REC-001",
                "notas": "Pago parcial"
            }
            
            try:
                response = self.make_request("POST", f"/financial/consultas/{self.test_data['consulta_id']}/pagos", pago_data)
                if response.status_code == 200:
                    consulta_updated = response.json()
                    
                    # Verify payment calculations
                    if (consulta_updated["total_pagado"] == 25.0 and 
                        consulta_updated["saldo"] == 20.0 and 
                        consulta_updated["estado_pago"] == "parcial"):
                        results["registrar_pago"] = True
                        self.test_data["pago_id"] = consulta_updated["pagos"][0]["id"]
                        self.log("✅ POST /api/financial/consultas/{id}/pagos - SUCCESS")
                    else:
                        results["registrar_pago"] = False
                        self.log(f"❌ POST /api/financial/consultas/{{id}}/pagos - FAILED (calculation error)", "ERROR")
                else:
                    results["registrar_pago"] = False
                    self.log(f"❌ POST /api/financial/consultas/{{id}}/pagos - FAILED: {response.status_code} - {response.text}", "ERROR")
            except Exception as e:
                results["registrar_pago"] = False
                self.log(f"❌ POST /api/financial/consultas/{{id}}/pagos - ERROR: {e}", "ERROR")
        else:
            results["registrar_pago"] = False
            self.log("❌ POST /api/financial/consultas/{id}/pagos - SKIPPED (no consulta_id)", "ERROR")
        
        # 3. Test crear consulta desde proforma (Odontología)
        self.log("3. Testing crear consulta desde proforma...")
        if "proforma_id" in self.test_data:
            try:
                response = self.make_request("POST", f"/financial/consultas/desde-proforma/{self.test_data['proforma_id']}")
                if response.status_code == 200:
                    proforma_consulta = response.json()
                    self.test_data["proforma_consulta_id"] = proforma_consulta["consulta_id"]
                    
                    # Verify proforma was converted
                    if proforma_consulta["total"] == 200.0:  # Expected total from proforma (210 - 10 discount)
                        results["crear_consulta_desde_proforma"] = True
                        self.log("✅ POST /api/financial/consultas/desde-proforma/{id} - SUCCESS")
                        
                        # Verify proforma status changed to "Facturada"
                        proforma_check = self.make_request("GET", f"/proformas/{self.test_data['proforma_id']}")
                        if proforma_check.status_code == 200:
                            proforma_data = proforma_check.json()
                            if proforma_data["estado"] == "Facturada":
                                self.log("✅ Proforma status updated to 'Facturada'")
                            else:
                                self.log(f"⚠️ Proforma status not updated: {proforma_data['estado']}", "WARNING")
                    else:
                        results["crear_consulta_desde_proforma"] = False
                        self.log(f"❌ POST /api/financial/consultas/desde-proforma/{{id}} - FAILED (total mismatch: {proforma_consulta['total']})", "ERROR")
                else:
                    results["crear_consulta_desde_proforma"] = False
                    self.log(f"❌ POST /api/financial/consultas/desde-proforma/{{id}} - FAILED: {response.status_code} - {response.text}", "ERROR")
            except Exception as e:
                results["crear_consulta_desde_proforma"] = False
                self.log(f"❌ POST /api/financial/consultas/desde-proforma/{{id}} - ERROR: {e}", "ERROR")
        else:
            results["crear_consulta_desde_proforma"] = False
            self.log("❌ POST /api/financial/consultas/desde-proforma/{id} - SKIPPED (no proforma_id)", "ERROR")
        
        # 4. Test listar consultas pendientes
        self.log("4. Testing listar consultas pendientes...")
        try:
            response = self.make_request("GET", "/financial/reportes/pendientes")
            if response.status_code == 200:
                pendientes = response.json()
                if "cuentas" in pendientes and isinstance(pendientes["cuentas"], list):
                    # Should have at least one pending account (our test consulta)
                    pending_found = any(c.get("saldo", 0) > 0 for c in pendientes["cuentas"])
                    if pending_found:
                        results["listar_consultas_pendientes"] = True
                        self.log("✅ GET /api/financial/reportes/pendientes - SUCCESS")
                    else:
                        results["listar_consultas_pendientes"] = False
                        self.log("❌ GET /api/financial/reportes/pendientes - FAILED (no pending accounts found)", "ERROR")
                else:
                    results["listar_consultas_pendientes"] = False
                    self.log("❌ GET /api/financial/reportes/pendientes - FAILED (invalid response format)", "ERROR")
            else:
                results["listar_consultas_pendientes"] = False
                self.log(f"❌ GET /api/financial/reportes/pendientes - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["listar_consultas_pendientes"] = False
            self.log(f"❌ GET /api/financial/reportes/pendientes - ERROR: {e}", "ERROR")
        
        # 5. Test eliminar pago
        self.log("5. Testing eliminar pago...")
        if "consulta_id" in self.test_data and "pago_id" in self.test_data:
            try:
                response = self.make_request("DELETE", f"/financial/consultas/{self.test_data['consulta_id']}/pagos/{self.test_data['pago_id']}")
                if response.status_code == 200:
                    delete_result = response.json()
                    
                    # Verify saldo was recalculated correctly
                    if (delete_result["total_pagado"] == 0 and 
                        delete_result["saldo"] == 45.0 and 
                        delete_result["estado_pago"] == "pendiente"):
                        results["eliminar_pago"] = True
                        self.log("✅ DELETE /api/financial/consultas/{id}/pagos/{pago_id} - SUCCESS")
                    else:
                        results["eliminar_pago"] = False
                        self.log(f"❌ DELETE /api/financial/consultas/{{id}}/pagos/{{pago_id}} - FAILED (calculation error)", "ERROR")
                else:
                    results["eliminar_pago"] = False
                    self.log(f"❌ DELETE /api/financial/consultas/{{id}}/pagos/{{pago_id}} - FAILED: {response.status_code} - {response.text}", "ERROR")
            except Exception as e:
                results["eliminar_pago"] = False
                self.log(f"❌ DELETE /api/financial/consultas/{{id}}/pagos/{{pago_id}} - ERROR: {e}", "ERROR")
        else:
            results["eliminar_pago"] = False
            self.log("❌ DELETE /api/financial/consultas/{id}/pagos/{pago_id} - SKIPPED (missing IDs)", "ERROR")
        
        return results

    def test_odontograma_clinico_fdi(self) -> Dict[str, bool]:
        """Test Odontograma Clínico FDI endpoints as requested"""
        self.log("Testing Odontograma Clínico FDI endpoints...")
        results = {}
        
        # 1. Test crear odontograma permanente (32 dientes)
        self.log("1. Testing crear odontograma permanente (32 dientes)...")
        
        odontograma_permanente_data = {
            "paciente_id": self.test_data["paciente_id"],
            "paciente_nombre": self.test_data["paciente_nombre"],
            "paciente_cedula": self.test_data["paciente_cedula"],
            "doctor_id": self.test_data["doctor_id"],
            "tipo_denticion": "permanente",
            "fecha": "2024-01-15",
            "diagnostico_general": "Evaluación odontológica completa",
            "higiene_oral": "regular",
            "estado_encias": "gingivitis leve",
            "observaciones": "Paciente requiere limpieza dental"
        }
        
        try:
            response = self.make_request("POST", "/odontograma-clinico", odontograma_permanente_data)
            if response.status_code == 200:
                result = response.json()
                self.test_data["odontograma_permanente_id"] = result["id"]
                
                # Verify 32 teeth created with FDI numbering
                if (result["tipo_denticion"] == "permanente" and 
                    result["total_dientes"] == 32):
                    results["crear_odontograma_permanente"] = True
                    self.log("✅ POST /api/odontograma-clinico (permanente) - SUCCESS (32 dientes FDI)")
                    
                    # Verify the actual odontogram structure
                    get_response = self.make_request("GET", f"/odontograma-clinico/{result['id']}")
                    if get_response.status_code == 200:
                        odontograma = get_response.json()
                        dientes = odontograma.get("dientes", [])
                        
                        # Check FDI numbering for permanent teeth (18-11, 21-28, 48-41, 31-38)
                        expected_fdi_numbers = []
                        # Cuadrante 1: 18-11
                        for i in range(8, 0, -1):
                            expected_fdi_numbers.append(f"1{i}")
                        # Cuadrante 2: 21-28
                        for i in range(1, 9):
                            expected_fdi_numbers.append(f"2{i}")
                        # Cuadrante 3: 31-38
                        for i in range(1, 9):
                            expected_fdi_numbers.append(f"3{i}")
                        # Cuadrante 4: 48-41
                        for i in range(8, 0, -1):
                            expected_fdi_numbers.append(f"4{i}")
                        
                        actual_fdi_numbers = [d.get("numero_fdi") for d in dientes]
                        
                        if len(dientes) == 32 and all(num in actual_fdi_numbers for num in expected_fdi_numbers):
                            # Check that each tooth has 5 surfaces
                            all_have_5_surfaces = all(len(d.get("superficies", [])) == 5 for d in dientes)
                            if all_have_5_surfaces:
                                self.log("✅ FDI numbering and 5 surfaces per tooth verified")
                            else:
                                self.log("⚠️ Not all teeth have 5 surfaces", "WARNING")
                        else:
                            self.log(f"❌ FDI numbering incorrect. Expected 32, got {len(dientes)}", "ERROR")
                    else:
                        self.log("⚠️ Could not verify odontogram structure", "WARNING")
                else:
                    results["crear_odontograma_permanente"] = False
                    self.log(f"❌ POST /api/odontograma-clinico (permanente) - FAILED (wrong count: {result.get('total_dientes')})", "ERROR")
            else:
                results["crear_odontograma_permanente"] = False
                self.log(f"❌ POST /api/odontograma-clinico (permanente) - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["crear_odontograma_permanente"] = False
            self.log(f"❌ POST /api/odontograma-clinico (permanente) - ERROR: {e}", "ERROR")
        
        # 2. Test crear odontograma temporal (20 dientes)
        self.log("2. Testing crear odontograma temporal (20 dientes)...")
        
        odontograma_temporal_data = {
            "paciente_id": self.test_data["paciente_id"],
            "paciente_nombre": "Niño Pérez",
            "paciente_cedula": "1234567891",
            "doctor_id": self.test_data["doctor_id"],
            "tipo_denticion": "temporal",
            "fecha": "2024-01-15",
            "diagnostico_general": "Dentición temporal completa",
            "observaciones": "Paciente pediátrico"
        }
        
        try:
            response = self.make_request("POST", "/odontograma-clinico", odontograma_temporal_data)
            if response.status_code == 200:
                result = response.json()
                self.test_data["odontograma_temporal_id"] = result["id"]
                
                # Verify 20 teeth created with FDI temporal numbering
                if (result["tipo_denticion"] == "temporal" and 
                    result["total_dientes"] == 20):
                    results["crear_odontograma_temporal"] = True
                    self.log("✅ POST /api/odontograma-clinico (temporal) - SUCCESS (20 dientes FDI)")
                    
                    # Verify FDI temporal numbering (55-51, 61-65, 85-81, 71-75)
                    get_response = self.make_request("GET", f"/odontograma-clinico/{result['id']}")
                    if get_response.status_code == 200:
                        odontograma = get_response.json()
                        dientes = odontograma.get("dientes", [])
                        
                        expected_temporal_fdi = []
                        # Cuadrante 5: 55-51
                        for i in range(5, 0, -1):
                            expected_temporal_fdi.append(f"5{i}")
                        # Cuadrante 6: 61-65
                        for i in range(1, 6):
                            expected_temporal_fdi.append(f"6{i}")
                        # Cuadrante 7: 71-75
                        for i in range(1, 6):
                            expected_temporal_fdi.append(f"7{i}")
                        # Cuadrante 8: 85-81
                        for i in range(5, 0, -1):
                            expected_temporal_fdi.append(f"8{i}")
                        
                        actual_fdi_numbers = [d.get("numero_fdi") for d in dientes]
                        
                        if len(dientes) == 20 and all(num in actual_fdi_numbers for num in expected_temporal_fdi):
                            self.log("✅ FDI temporal numbering verified")
                        else:
                            self.log(f"❌ FDI temporal numbering incorrect. Expected 20, got {len(dientes)}", "ERROR")
                else:
                    results["crear_odontograma_temporal"] = False
                    self.log(f"❌ POST /api/odontograma-clinico (temporal) - FAILED (wrong count: {result.get('total_dientes')})", "ERROR")
            else:
                results["crear_odontograma_temporal"] = False
                self.log(f"❌ POST /api/odontograma-clinico (temporal) - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["crear_odontograma_temporal"] = False
            self.log(f"❌ POST /api/odontograma-clinico (temporal) - ERROR: {e}", "ERROR")
        
        # 3. Test actualizar superficie de diente
        self.log("3. Testing actualizar superficie de diente...")
        
        if "odontograma_permanente_id" in self.test_data:
            superficie_data = {
                "diagnostico": "caries",
                "notas": "Caries profunda requiere tratamiento"
            }
            
            try:
                response = self.make_request(
                    "PUT", 
                    f"/odontograma-clinico/{self.test_data['odontograma_permanente_id']}/diente/16/superficie/oclusal",
                    superficie_data
                )
                if response.status_code == 200:
                    result = response.json()
                    if "actualizada" in result.get("message", "").lower():
                        results["actualizar_superficie_diente"] = True
                        self.log("✅ PUT /api/odontograma-clinico/{id}/diente/16/superficie/oclusal - SUCCESS")
                        
                        # Verify the change persisted
                        get_response = self.make_request("GET", f"/odontograma-clinico/{self.test_data['odontograma_permanente_id']}")
                        if get_response.status_code == 200:
                            odontograma = get_response.json()
                            dientes = odontograma.get("dientes", [])
                            diente_16 = next((d for d in dientes if d.get("numero_fdi") == "16"), None)
                            if diente_16:
                                superficie_oclusal = next((s for s in diente_16.get("superficies", []) if s.get("nombre") == "oclusal"), None)
                                if superficie_oclusal and superficie_oclusal.get("diagnostico") == "caries":
                                    self.log("✅ Surface update persisted correctly")
                                else:
                                    self.log("⚠️ Surface update not persisted correctly", "WARNING")
                    else:
                        results["actualizar_superficie_diente"] = False
                        self.log("❌ PUT /api/odontograma-clinico/{id}/diente/{numero_fdi}/superficie/{superficie} - FAILED (no update message)", "ERROR")
                else:
                    results["actualizar_superficie_diente"] = False
                    self.log(f"❌ PUT /api/odontograma-clinico/{{id}}/diente/16/superficie/oclusal - FAILED: {response.status_code} - {response.text}", "ERROR")
            except Exception as e:
                results["actualizar_superficie_diente"] = False
                self.log(f"❌ PUT /api/odontograma-clinico/{{id}}/diente/16/superficie/oclusal - ERROR: {e}", "ERROR")
        else:
            results["actualizar_superficie_diente"] = False
            self.log("❌ PUT /api/odontograma-clinico/{id}/diente/{numero_fdi}/superficie/{superficie} - SKIPPED (no odontograma_id)", "ERROR")
        
        # 4. Test actualizar estado de diente
        self.log("4. Testing actualizar estado de diente...")
        
        if "odontograma_permanente_id" in self.test_data:
            diente_data = {
                "estado": "ausente",
                "observaciones": "Diente extraído previamente"
            }
            
            try:
                response = self.make_request(
                    "PUT",
                    f"/odontograma-clinico/{self.test_data['odontograma_permanente_id']}/diente/48",
                    diente_data
                )
                if response.status_code == 200:
                    result = response.json()
                    if "actualizado" in result.get("message", "").lower():
                        results["actualizar_estado_diente"] = True
                        self.log("✅ PUT /api/odontograma-clinico/{id}/diente/48 - SUCCESS")
                        
                        # Verify the change persisted
                        get_response = self.make_request("GET", f"/odontograma-clinico/{self.test_data['odontograma_permanente_id']}")
                        if get_response.status_code == 200:
                            odontograma = get_response.json()
                            dientes = odontograma.get("dientes", [])
                            diente_48 = next((d for d in dientes if d.get("numero_fdi") == "48"), None)
                            if diente_48 and diente_48.get("estado") == "ausente":
                                self.log("✅ Tooth state update persisted correctly")
                            else:
                                self.log("⚠️ Tooth state update not persisted correctly", "WARNING")
                    else:
                        results["actualizar_estado_diente"] = False
                        self.log("❌ PUT /api/odontograma-clinico/{id}/diente/{numero_fdi} - FAILED (no update message)", "ERROR")
                else:
                    results["actualizar_estado_diente"] = False
                    self.log(f"❌ PUT /api/odontograma-clinico/{{id}}/diente/48 - FAILED: {response.status_code} - {response.text}", "ERROR")
            except Exception as e:
                results["actualizar_estado_diente"] = False
                self.log(f"❌ PUT /api/odontograma-clinico/{{id}}/diente/48 - ERROR: {e}", "ERROR")
        else:
            results["actualizar_estado_diente"] = False
            self.log("❌ PUT /api/odontograma-clinico/{id}/diente/{numero_fdi} - SKIPPED (no odontograma_id)", "ERROR")
        
        # 5. Test cambiar tipo de dentición
        self.log("5. Testing cambiar tipo de dentición...")
        
        if "odontograma_permanente_id" in self.test_data:
            cambio_data = {
                "tipo_denticion": "temporal"
            }
            
            try:
                response = self.make_request(
                    "POST",
                    f"/odontograma-clinico/{self.test_data['odontograma_permanente_id']}/cambiar-denticion",
                    cambio_data
                )
                if response.status_code == 200:
                    result = response.json()
                    if result.get("total_dientes") == 20:  # Should now have 20 temporal teeth
                        results["cambiar_tipo_denticion"] = True
                        self.log("✅ POST /api/odontograma-clinico/{id}/cambiar-denticion - SUCCESS (regenerated 20 temporal teeth)")
                        
                        # Verify the change persisted
                        get_response = self.make_request("GET", f"/odontograma-clinico/{self.test_data['odontograma_permanente_id']}")
                        if get_response.status_code == 200:
                            odontograma = get_response.json()
                            if (odontograma.get("tipo_denticion") == "temporal" and 
                                len(odontograma.get("dientes", [])) == 20):
                                self.log("✅ Dentition change persisted correctly")
                            else:
                                self.log("⚠️ Dentition change not persisted correctly", "WARNING")
                    else:
                        results["cambiar_tipo_denticion"] = False
                        self.log(f"❌ POST /api/odontograma-clinico/{{id}}/cambiar-denticion - FAILED (wrong teeth count: {result.get('total_dientes')})", "ERROR")
                else:
                    results["cambiar_tipo_denticion"] = False
                    self.log(f"❌ POST /api/odontograma-clinico/{{id}}/cambiar-denticion - FAILED: {response.status_code} - {response.text}", "ERROR")
            except Exception as e:
                results["cambiar_tipo_denticion"] = False
                self.log(f"❌ POST /api/odontograma-clinico/{{id}}/cambiar-denticion - ERROR: {e}", "ERROR")
        else:
            results["cambiar_tipo_denticion"] = False
            self.log("❌ POST /api/odontograma-clinico/{id}/cambiar-denticion - SKIPPED (no odontograma_id)", "ERROR")
        
        # 6. Test obtener odontogramas por paciente
        self.log("6. Testing obtener odontogramas por paciente...")
        
        try:
            response = self.make_request("GET", f"/odontograma-clinico/paciente/{self.test_data['paciente_id']}")
            if response.status_code == 200:
                odontogramas = response.json()
                if isinstance(odontogramas, list) and len(odontogramas) > 0:
                    # Should have at least the odontograms we created
                    patient_odontograms = [o for o in odontogramas if o.get("paciente_id") == self.test_data["paciente_id"]]
                    if len(patient_odontograms) >= 1:  # At least one odontogram for this patient
                        results["obtener_odontogramas_paciente"] = True
                        self.log("✅ GET /api/odontograma-clinico/paciente/{paciente_id} - SUCCESS")
                    else:
                        results["obtener_odontogramas_paciente"] = False
                        self.log("❌ GET /api/odontograma-clinico/paciente/{paciente_id} - FAILED (no odontograms for patient)", "ERROR")
                else:
                    results["obtener_odontogramas_paciente"] = False
                    self.log("❌ GET /api/odontograma-clinico/paciente/{paciente_id} - FAILED (empty list)", "ERROR")
            else:
                results["obtener_odontogramas_paciente"] = False
                self.log(f"❌ GET /api/odontograma-clinico/paciente/{{paciente_id}} - FAILED: {response.status_code} - {response.text}", "ERROR")
        except Exception as e:
            results["obtener_odontogramas_paciente"] = False
            self.log(f"❌ GET /api/odontograma-clinico/paciente/{{paciente_id}} - ERROR: {e}", "ERROR")
        
        return results

    def run_all_tests(self) -> Dict[str, Dict[str, bool]]:
        """Run all backend tests"""
        self.log("=" * 60)
        self.log("STARTING BACKEND API TESTS")
        self.log("=" * 60)
        
        # Authenticate
        if not self.authenticate():
            self.log("Authentication failed. Cannot proceed with tests.", "ERROR")
            return {}
            
        # Setup test data
        if not self.setup_test_data():
            self.log("Test data setup failed. Cannot proceed with tests.", "ERROR")
            return {}
            
        # Run tests
        all_results = {}
        
        try:
            all_results["proformas"] = self.test_proformas()
            all_results["abonos"] = self.test_abonos()
            all_results["odontograms"] = self.test_odontograms()
            all_results["medical_history_odontology"] = self.test_medical_history_odontology()
            all_results["financial_endpoints"] = self.test_financial_endpoints()
            all_results["odontograma_clinico_fdi"] = self.test_odontograma_clinico_fdi()
        except Exception as e:
            self.log(f"Test execution error: {e}", "ERROR")
            
        # Summary
        self.log("=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        total_tests = 0
        passed_tests = 0
        
        for category, tests in all_results.items():
            self.log(f"\n{category.upper()}:")
            for test_name, result in tests.items():
                status = "✅ PASS" if result else "❌ FAIL"
                self.log(f"  {test_name}: {status}")
                total_tests += 1
                if result:
                    passed_tests += 1
                    
        self.log(f"\nOVERALL: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            self.log("🎉 ALL TESTS PASSED!", "SUCCESS")
        else:
            self.log(f"⚠️  {total_tests - passed_tests} tests failed", "WARNING")
            
        return all_results

def main():
    """Main test execution"""
    tester = BackendTester()
    results = tester.run_all_tests()
    
    # Exit with appropriate code
    if results:
        all_passed = all(
            all(test_results.values()) 
            for test_results in results.values()
        )
        exit(0 if all_passed else 1)
    else:
        exit(1)

if __name__ == "__main__":
    main()