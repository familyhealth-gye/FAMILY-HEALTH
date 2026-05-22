from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn
import os
import logging
import uuid
import httpx
from pathlib import Path
from typing import List, Optional
import io
import csv
from collections import defaultdict
from datetime import datetime, timezone
from pymongo.errors import DuplicateKeyError

from db import db, ensure_indexes, close_client

app = FastAPI(title="Family Health API", description="Sistema Clínico Multiespecialidad SaaS", version="2.0")


@app.on_event("startup")
async def startup_db():
    await ensure_indexes()


# Importar módulo financiero (después de db para evitar doble cliente)
from financial_routes import financial_router, unificar_paciente_por_cedula
from routers.doctors import router as doctors_router, payments_router as doctor_payments_router
from routers.appointments import router as appointments_router
from routers.inventory import router as inventory_router
from routers.helpers import calcular_edad_desde_fecha, crear_consulta_financiera_automatica
from routers.patients import router as patients_router
from routers.prescriptions import router as prescriptions_router
from routers.users import router as users_router
from routers.catalogs import router as catalogs_router
from routers.config import router as config_router
from routers.ia import router as ia_router
from routers.odontology import router as odontology_router
from routers.medical_history import router as medical_history_router
from routers.billing import router as billing_router
from routers.clinical import router as clinical_router

# CORS configuration
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://family-health.onrender.com", "http://localhost:8001", "http://127.0.0.1:3000", "https://ce-family-health.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router con prefijo
api_router = APIRouter(prefix="/api")

@app.get("/")
def read_root():
    return {"message": "API Family Health funcionando correctamente 🚀"}

# Ruta para el health check
@app.api_route("/healthz", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}

# Import local modules
from models import (
    User, UserCreate, UserResponse,
    MedicalHistory, MedicalHistoryCreate, MedicalHistoryUpdate,
    Prescription, PrescriptionCreate, Medication,
    Doctor, DoctorCreate, DoctorUpdate,
    Appointment, AppointmentCreate, AppointmentUpdate,
    Invoice, InvoiceCreate, InvoiceUpdate,
    InventoryItem, InventoryItemCreate, InventoryItemUpdate,
    InventoryMovement, InventoryMovementCreate,
    DoctorPayment, DoctorPaymentCreate, DoctorPaymentUpdate,
    Proforma, ProformaCreate, ProformaUpdate, ProformaItem,
    Abono, AbonoCreate, AbonoUpdate,
    Odontogram, OdontogramCreate, OdontogramUpdate, ToothState,
    OdontogramaClinico, DienteFDI, SuperficieDental,
    Especialidad, EspecialidadCreate,
    PlanTratamiento, PlanTratamientoCreate, ProcedimientoDental, 
    ProcedimientoCreate, ProcedimientoUpdate, FaseTratamiento
)
from medical_history_models import (
    MedicalHistoryGeneral, MedicalHistoryGeneralCreate,
    MedicalHistoryPediatric, MedicalHistoryPediatricCreate,
    MedicalHistoryOdontology, MedicalHistoryOdontologyCreate, EstadoDental,
    EvolicionSesion, EvolicionSesionCreate,
    MedicalHistoryNutricion, MedicalHistoryNutricionCreate,
    MedicalHistoryGinecologia, MedicalHistoryGinecologiaCreate,
    MedicalHistoryEcografia, MedicalHistoryEcografiaCreate
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_role,
    Token, TokenData, UserLogin, optional_security, decode_token,
)
from fastapi.security import HTTPAuthorizationCredentials
from pdf_generator import generate_prescription_pdf, generate_certificado_pdf

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app.include_router(api_router)
app.include_router(doctors_router, prefix="/api")
app.include_router(doctor_payments_router, prefix="/api")
app.include_router(appointments_router, prefix="/api")
app.include_router(patients_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(prescriptions_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(catalogs_router, prefix="/api")
app.include_router(config_router, prefix="/api")
app.include_router(ia_router, prefix="/api")
app.include_router(odontology_router, prefix="/api")
app.include_router(medical_history_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(clinical_router, prefix="/api")
app.include_router(financial_router, prefix="/api")


# ========== EXISTING ENDPOINTS (from Phase 2) ==========

@api_router.get("/")
async def root():
    return {"message": "Family Health API - Fase 3"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
