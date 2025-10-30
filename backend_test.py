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
BACKEND_URL = "https://medicalhistory-hub.preview.emergentagent.com/api"
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