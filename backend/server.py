from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
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

# Importar módulo financiero
from financial_routes import financial_router, unificar_paciente_por_cedula

app = FastAPI(title="Family Health API", description="Sistema Clínico Multiespecialidad SaaS", version="2.0")


def calcular_edad_desde_fecha(fecha_nacimiento: str) -> int:
    """Calcula edad en años desde YYYY-MM-DD. Nunca devuelve 0 si hay fecha válida."""
    if not fecha_nacimiento:
        return 0
    try:
        from datetime import date
        nac = date.fromisoformat(str(fecha_nacimiento)[:10])
        hoy = date.today()
        edad = hoy.year - nac.year - ((hoy.month, hoy.day) < (nac.month, nac.day))
        return max(0, edad)
    except Exception:
        return 0

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
    get_current_user, require_role, Token, TokenData, UserLogin
)
from pdf_generator import generate_prescription_pdf, generate_certificado_pdf

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection - 100% LOCAL
load_dotenv()
# MongoDB Atlas Connection
# MongoDB Atlas Connection
MONGO_URL = os.environ.get('MONGODB_URI', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
DB_NAME = os.environ.get('DB_NAME', 'family_health_db')
client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]
print(f"✅ Conectando a MongoDB: {DB_NAME}")

# ========== AUTH ENDPOINTS ==========

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_input: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"username": user_input.username})
    if existing:
        raise HTTPException(status_code=400, detail="Usuario ya existe")
    
    # Create user
    hashed_password = get_password_hash(user_input.password)
    user_dict = user_input.model_dump()
    user_dict.pop('password')
    user_dict['hashed_password'] = hashed_password
    
    # Si es Doctor y no tiene doctor_id, crear automáticamente el doctor
    if user_dict.get('role') == 'Doctor' and not user_dict.get('doctor_id'):
        doctor_id = str(uuid.uuid4())
        doctor_dict = {
            "id": doctor_id,
            "nombre": user_dict['nombre_completo'],
            "especialidad": user_dict.get('especialidad', 'General'),
            "subespecialidad": "",
            "porcentaje": 50.0,  # Por defecto 50%
            "telefono": "",
            "email": user_dict['email'],
            "cedula": "",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.doctors.insert_one(doctor_dict)
        user_dict['doctor_id'] = doctor_id
    
    user_obj = User(**user_dict)
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    return UserResponse(**user_obj.model_dump())

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    # Buscar usuario por cedula O username
    user = await db.users.find_one(
        {"$or": [
            {"username": credentials.username},
            {"cedula": credentials.username}
        ]},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    # Detectar el nombre real del campo de contraseña
    stored_password = user.get("hashed_password") or user.get("password") or user.get("password_hash")

    if not stored_password:
        raise HTTPException(status_code=500, detail="Error interno: contraseña no encontrada")

    # Verificar contraseña
    if not verify_password(credentials.password, stored_password):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    # Verificar si está activo
    if not user.get('is_active', True):
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    # Crear token
    access_token = create_access_token(
        data={"sub": user.get("username") or user.get("cedula"),
              "role": user['role']}
    )

    # RETURN OBLIGATORIO
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user.get("username"),
            "cedula": user.get("cedula"),
            "role": user["role"],
            "nombre": user.get("nombre_completo") or user.get("nombre") or user.get("username"),
            "nombre_completo": user.get("nombre_completo") or user.get("nombre") or user.get("username"),
            "especialidad": user.get("especialidad", ""),
            "doctor_id": user.get("doctor_id", ""),
            "email": user.get("email", "")
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserResponse(**user)

# ========== USER MANAGEMENT ENDPOINTS (Admin only) ==========

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: TokenData = Depends(require_role("Administrador"))):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [UserResponse(**user) for user in users]

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: dict,
    current_user: TokenData = Depends(require_role("Administrador"))
):
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # If password is being updated, hash it
    if 'password' in user_update and user_update['password']:
        user_update['hashed_password'] = get_password_hash(user_update['password'])
        del user_update['password']
    
    # Remove empty values
    update_data = {k: v for k, v in user_update.items() if v is not None and v != ""}
    
    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    return UserResponse(**updated)

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: TokenData = Depends(require_role("Administrador"))
):
    # Prevent deleting yourself
    current_user_data = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    if current_user_data['id'] == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado exitosamente"}


@api_router.post("/users/create-from-doctors")
async def create_users_from_doctors(
    current_user: TokenData = Depends(require_role("Administrador"))
):
    """
    Crear usuarios automáticamente para todos los doctores que no tengan usuario
    Username format: nombre.apellido (lowercase)
    Password: cambiar123 (to be changed on first login)
    """
    doctors = await db.doctors.find({}, {"_id": 0}).to_list(1000)
    created_users = []
    skipped_doctors = []
    
    for doctor in doctors:
        # Check if doctor already has a user
        existing_user = await db.users.find_one({"doctor_id": doctor['id']}, {"_id": 0})
        if existing_user:
            skipped_doctors.append(f"{doctor['nombre']} (ya tiene usuario: {existing_user['username']})")
            continue
        
        # Generate username from doctor name
        # Format: primer_nombre.primer_apellido
        name_parts = doctor['nombre'].strip().split()
        if len(name_parts) >= 2:
            username = f"{name_parts[0]}.{name_parts[1]}".lower()
        else:
            username = name_parts[0].lower()
        
        # Check if username already exists
        username_check = await db.users.find_one({"username": username}, {"_id": 0})
        if username_check:
            # Add number suffix
            counter = 1
            while True:
                test_username = f"{username}{counter}"
                username_check = await db.users.find_one({"username": test_username}, {"_id": 0})
                if not username_check:
                    username = test_username
                    break
                counter += 1
        
        # Create user
        user_dict = {
            "username": username,
            "email": f"{username}@familyhealth.com",
            "nombre_completo": doctor['nombre'],
            "role": "Doctor",
            "doctor_id": doctor['id'],
            "especialidad": doctor.get('especialidad', 'General'),  # Copiar especialidad del doctor
            "hashed_password": get_password_hash("cambiar123"),
            "is_active": True
        }
        
        user_obj = User(**user_dict)
        doc = user_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.users.insert_one(doc)
        created_users.append({
            "doctor": doctor['nombre'],
            "username": username,
            "password": "cambiar123",
            "doctor_id": doctor['id'],
            "especialidad": doctor.get('especialidad', 'General')
        })
    
    return {
        "created": created_users,
        "skipped": skipped_doctors,
        "message": f"Se crearon {len(created_users)} usuarios. {len(skipped_doctors)} doctores ya tenían usuario."
    }

# ========== ESPECIALIDADES ENDPOINTS ==========

@api_router.get("/especialidades", response_model=List[Especialidad])
async def get_especialidades():
    """Obtener todas las especialidades (sin autenticación para facilitar)"""
    especialidades = await db.especialidades.find({}, {"_id": 0}).to_list(1000)
    for esp in especialidades:
        if isinstance(esp['created_at'], str):
            esp['created_at'] = datetime.fromisoformat(esp['created_at'])
    return especialidades

@api_router.post("/especialidades", response_model=Especialidad)
async def create_especialidad(
    input: EspecialidadCreate,
    current_user: TokenData = Depends(require_role("Administrador"))
):
    """Crear especialidad (solo admin)"""
    esp_obj = Especialidad(**input.model_dump())
    doc = esp_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.especialidades.insert_one(doc)
    return esp_obj

@api_router.post("/especialidades/seed")
async def seed_especialidades(
    current_user: TokenData = Depends(require_role("Administrador"))
):
    """
    Crear especialidades iniciales
    IMPORTANTE: NO borra especialidades existentes, solo agrega las faltantes
    """
    especialidades_base = [
        {"nombre": "Medicina General", "descripcion": "Atención médica general"},
        {"nombre": "Odontología", "descripcion": "Salud bucal y dental"},
        {"nombre": "Endodoncia", "descripcion": "Tratamiento de conductos"},
        {"nombre": "Ortodoncia", "descripcion": "Corrección de dientes y mandíbula"},
        {"nombre": "Periodoncia", "descripcion": "Tratamiento de encías"},
        {"nombre": "Pediatría", "descripcion": "Atención infantil"},
        {"nombre": "Nutrición", "descripcion": "Asesoramiento nutricional y dietético"},
        {"nombre": "Psicología", "descripcion": "Salud mental"},
        {"nombre": "Ecografía", "descripcion": "Diagnóstico por imagen ecográfica"},
        {"nombre": "Ginecología", "descripcion": "Salud femenina y reproductiva"},
        {"nombre": "Obstetricia", "descripcion": "Embarazo y parto"},
        {"nombre": "Laboratorio", "descripcion": "Análisis clínicos y pruebas de laboratorio"}
    ]
    
    # NO BORRAR EXISTENTES - Solo agregar las que faltan
    created = []
    skipped = []
    
    for esp_data in especialidades_base:
        # Verificar si ya existe
        existing = await db.especialidades.find_one({"nombre": esp_data["nombre"]}, {"_id": 0})
        if existing:
            skipped.append(esp_data['nombre'])
            continue
        
        # Crear nueva especialidad
        esp_obj = Especialidad(**esp_data, activa=True)
        doc = esp_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.especialidades.insert_one(doc)
        created.append(esp_data['nombre'])
    
    return {
        "message": f"Proceso completado",
        "creadas": len(created),
        "existentes": len(skipped),
        "nuevas_especialidades": created,
        "especialidades_existentes": skipped
    }

# ========== MEDICAL HISTORY ENDPOINTS ==========

@api_router.post("/medical-history", response_model=MedicalHistory)
async def create_medical_history(
    input: MedicalHistoryCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get patient info from appointment
    appointment = await db.appointments.find_one({"id": input.paciente_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Get doctor info
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    
    history_dict = input.model_dump()
    history_dict['paciente_nombre'] = appointment['nombre_completo']
    history_dict['paciente_cedula'] = appointment['cedula']
    history_dict['doctor_nombre'] = doctor['nombre']
    
    history_obj = MedicalHistory(**history_dict)
    doc = history_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.medical_histories.insert_one(doc)
    return history_obj

@api_router.get("/medical-history", response_model=List[MedicalHistory])
async def get_medical_histories(current_user: TokenData = Depends(get_current_user)):
    histories = await db.medical_histories.find({}, {"_id": 0}).to_list(1000)
    
    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])
    
    return histories

@api_router.get("/medical-history/patient/{paciente_id}", response_model=List[MedicalHistory])
async def get_patient_medical_history(
    paciente_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    histories = await db.medical_histories.find(
        {"paciente_id": paciente_id}, {"_id": 0}
    ).to_list(1000)
    
    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])
    
    return histories

# ========== SPECIALIZED MEDICAL HISTORIES ==========

# Medicina General
@api_router.post("/medical-history/general", response_model=MedicalHistoryGeneral)
async def create_general_history(
    input: MedicalHistoryGeneralCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get appointment data
    appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    # Get current user data
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    
    # VALIDACIÓN: Solo para Medicina General
    appointment_especialidad = appointment.get('especialidad', '')
    if appointment_especialidad and appointment_especialidad != 'Medicina General':
        raise HTTPException(
            status_code=403, 
            detail=f"Este formulario es para Medicina General, no para {appointment_especialidad}."
        )
    
    # Validar doctor si tiene doctor_id
    if user.get('role') == 'Doctor' and user.get('doctor_id'):
        if user.get('doctor_id') != appointment.get('doctor_id'):
            raise HTTPException(status_code=403, detail="No tiene permisos para esta consulta")
    
    history_dict = input.model_dump()
    history_dict['paciente_id'] = appointment['id']
    history_dict['paciente_nombre'] = appointment['nombre_completo']
    history_dict['paciente_cedula'] = appointment['cedula']
    history_dict['paciente_edad'] = calcular_edad_desde_fecha(appointment.get('fecha_nacimiento','')) or appointment.get('edad',0)
    history_dict['paciente_sexo'] = appointment.get('sexo', 'No especificado')
    history_dict['doctor_id'] = user.get('doctor_id') or appointment.get('doctor_id', 'N/A')
    history_dict['doctor_nombre'] = user.get('nombre_completo', 'Sin nombre')
    history_dict['fecha'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    history_obj = MedicalHistoryGeneral(**history_dict)
    doc = history_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.medical_history_general.insert_one(doc)
    
    # Update appointment status to Pendiente de Pago
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )
    
    return history_obj

@api_router.get("/medical-history/general", response_model=List[MedicalHistoryGeneral])
async def get_general_histories(current_user: TokenData = Depends(get_current_user)):
    histories = await db.medical_history_general.find({}, {"_id": 0}).to_list(1000)
    
    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])
    
    return histories

@api_router.get("/medical-history/general/appointment/{appointment_id}", response_model=MedicalHistoryGeneral)
async def get_general_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_general.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    
    if isinstance(history['created_at'], str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    
    return MedicalHistoryGeneral(**history)

@api_router.put("/medical-history/general/{history_id}", response_model=MedicalHistoryGeneral)
async def update_general_history(
    history_id: str,
    input: MedicalHistoryGeneralCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar historia clínica general existente"""
    existing = await db.medical_history_general.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['paciente_id'] = existing.get('paciente_id')
    update_data['paciente_nombre'] = existing.get('paciente_nombre')
    update_data['paciente_cedula'] = existing.get('paciente_cedula')
    update_data['paciente_edad'] = existing.get('paciente_edad')
    update_data['paciente_sexo'] = existing.get('paciente_sexo')
    update_data['doctor_id'] = existing.get('doctor_id')
    update_data['doctor_nombre'] = existing.get('doctor_nombre')
    update_data['fecha'] = existing.get('fecha')
    update_data['created_at'] = existing.get('created_at')
    
    await db.medical_history_general.update_one(
        {"id": history_id},
        {"$set": update_data}
    )
    
    # Actualizar estado de la cita
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )
    
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    
    return MedicalHistoryGeneral(**update_data)

# Pediatría
@api_router.post("/medical-history/pediatric", response_model=MedicalHistoryPediatric)
async def create_pediatric_history(
    input: MedicalHistoryPediatricCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get appointment data
    appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    # Get current user data
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    
    # VALIDACIÓN: Solo para Pediatría
    appointment_especialidad = appointment.get('especialidad', '')
    if appointment_especialidad and appointment_especialidad != 'Pediatría':
        raise HTTPException(
            status_code=403, 
            detail=f"Este formulario es para Pediatría, no para {appointment_especialidad}."
        )
    
    # Validar doctor si tiene doctor_id
    if user.get('role') == 'Doctor' and user.get('doctor_id'):
        if user.get('doctor_id') != appointment.get('doctor_id'):
            raise HTTPException(status_code=403, detail="No tiene permisos para esta consulta")
    
    history_dict = input.model_dump()
    history_dict['paciente_id'] = appointment['id']
    history_dict['paciente_nombre'] = appointment['nombre_completo']
    history_dict['paciente_cedula'] = appointment['cedula']
    history_dict['paciente_edad'] = calcular_edad_desde_fecha(appointment.get('fecha_nacimiento','')) or appointment.get('edad',0)
    history_dict['paciente_sexo'] = appointment.get('sexo', 'No especificado')
    history_dict['doctor_id'] = user.get('doctor_id') or appointment.get('doctor_id', 'N/A')
    history_dict['doctor_nombre'] = user.get('nombre_completo', 'Sin nombre')
    history_dict['fecha'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    history_obj = MedicalHistoryPediatric(**history_dict)
    doc = history_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.medical_history_pediatric.insert_one(doc)
    
    # Update appointment status to Pendiente de Pago
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )
    
    return history_obj

@api_router.get("/medical-history/pediatric", response_model=List[MedicalHistoryPediatric])
async def get_pediatric_histories(current_user: TokenData = Depends(get_current_user)):
    histories = await db.medical_history_pediatric.find({}, {"_id": 0}).to_list(1000)
    
    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])
    
    return histories

@api_router.get("/medical-history/pediatric/appointment/{appointment_id}", response_model=MedicalHistoryPediatric)
async def get_pediatric_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_pediatric.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    
    if isinstance(history['created_at'], str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    
    return MedicalHistoryPediatric(**history)

@api_router.put("/medical-history/pediatric/{history_id}", response_model=MedicalHistoryPediatric)
async def update_pediatric_history(
    history_id: str,
    input: MedicalHistoryPediatricCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar historia clínica pediátrica existente"""
    existing = await db.medical_history_pediatric.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['paciente_id'] = existing.get('paciente_id')
    update_data['paciente_nombre'] = existing.get('paciente_nombre')
    update_data['paciente_cedula'] = existing.get('paciente_cedula')
    update_data['paciente_edad'] = existing.get('paciente_edad')
    update_data['paciente_sexo'] = existing.get('paciente_sexo')
    update_data['doctor_id'] = existing.get('doctor_id')
    update_data['doctor_nombre'] = existing.get('doctor_nombre')
    update_data['fecha'] = existing.get('fecha')
    update_data['created_at'] = existing.get('created_at')
    
    await db.medical_history_pediatric.update_one(
        {"id": history_id},
        {"$set": update_data}
    )
    
    # Actualizar estado de la cita
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )
    
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    
    return MedicalHistoryPediatric(**update_data)

# Odontología
@api_router.post("/medical-history/odontology", response_model=MedicalHistoryOdontology)
async def create_odontology_history(
    input: MedicalHistoryOdontologyCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get appointment data
    appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    # Get current user data
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    
    # VALIDACIÓN: Solo para Odontología
    appointment_especialidad = appointment.get('especialidad', '')
    if appointment_especialidad and appointment_especialidad != 'Odontología':
        raise HTTPException(
            status_code=403, 
            detail=f"Este formulario es para Odontología, no para {appointment_especialidad}."
        )
    
    # Validar doctor si tiene doctor_id
    if user.get('role') == 'Doctor' and user.get('doctor_id'):
        if user.get('doctor_id') != appointment.get('doctor_id'):
            raise HTTPException(status_code=403, detail="No tiene permisos para esta consulta")
    
    history_dict = input.model_dump()
    history_dict['paciente_id'] = appointment['id']
    history_dict['paciente_nombre'] = appointment['nombre_completo']
    history_dict['paciente_cedula'] = appointment['cedula']
    history_dict['paciente_edad'] = calcular_edad_desde_fecha(appointment.get('fecha_nacimiento','')) or appointment.get('edad',0)
    history_dict['paciente_sexo'] = appointment.get('sexo', 'No especificado')
    history_dict['doctor_id'] = user.get('doctor_id') or appointment.get('doctor_id', 'N/A')
    history_dict['doctor_nombre'] = user.get('nombre_completo', 'Sin nombre')
    history_dict['fecha'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    history_obj = MedicalHistoryOdontology(**history_dict)
    doc = history_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.medical_history_odontology.insert_one(doc)
    
    # Update appointment status to Pendiente de Pago
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )
    
    return history_obj

@api_router.get("/medical-history/odontology", response_model=List[MedicalHistoryOdontology])
async def get_odontology_histories(current_user: TokenData = Depends(get_current_user)):
    histories = await db.medical_history_odontology.find({}, {"_id": 0}).to_list(1000)
    
    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])
    
    return histories

@api_router.get("/medical-history/odontology/appointment/{appointment_id}", response_model=MedicalHistoryOdontology)
async def get_odontology_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_odontology.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    
    if isinstance(history['created_at'], str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    
    return MedicalHistoryOdontology(**history)

@api_router.put("/medical-history/odontology/{history_id}", response_model=MedicalHistoryOdontology)
async def update_odontology_history(
    history_id: str,
    input: MedicalHistoryOdontologyCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar historia clínica odontológica existente"""
    existing = await db.medical_history_odontology.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['paciente_id'] = existing.get('paciente_id')
    update_data['paciente_nombre'] = existing.get('paciente_nombre')
    update_data['paciente_cedula'] = existing.get('paciente_cedula')
    update_data['paciente_edad'] = existing.get('paciente_edad')
    update_data['paciente_sexo'] = existing.get('paciente_sexo')
    update_data['doctor_id'] = existing.get('doctor_id')
    update_data['doctor_nombre'] = existing.get('doctor_nombre')
    update_data['fecha'] = existing.get('fecha')
    update_data['created_at'] = existing.get('created_at')
    
    await db.medical_history_odontology.update_one(
        {"id": history_id},
        {"$set": update_data}
    )
    
    # Actualizar estado de la cita
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )
    
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    
    return MedicalHistoryOdontology(**update_data)


# ========== EVOLUCIÓN POR SESIÓN - ODONTOLOGÍA ==========

@api_router.post("/evoluciones-sesion", response_model=EvolicionSesion)
async def create_evolucion_sesion(
    input: EvolicionSesionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crea el registro de lo que se hizo en una sesión de odontología.
    Actualiza automáticamente el estado de los dientes en el odontograma.
    """
    # Verificar si ya existe una evolución para este appointment
    existing = await db.evoluciones_sesion.find_one(
        {"appointment_id": input.appointment_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una evolución para esta cita")

    evolucion = EvolicionSesion(**input.model_dump())
    doc = evolucion.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.evoluciones_sesion.insert_one(doc)

    # Actualizar estado de dientes en odontograma automáticamente
    if input.procedimientos_realizados and input.paciente_cedula:
        odontograma = await db.odontogramas_clinicos.find_one(
            {"paciente_cedula": input.paciente_cedula}, {"_id": 0}
        )
        if odontograma:
            dientes = odontograma.get("dientes", [])
            ESTADO_MAP = {
                "Resina": "restaurado",
                "Amalgama": "restaurado",
                "Corona": "corona",
                "Extracción": "ausente",
                "Implante": "implante",
                "Endodoncia": "endodoncia",
                "Limpieza": "presente",
                "Blanqueamiento": "presente",
            }
            for proc in input.procedimientos_realizados:
                diente_num = proc.diente_numero
                nuevo_estado = next(
                    (v for k, v in ESTADO_MAP.items() if k.lower() in proc.procedimiento.lower()),
                    "tratado"
                )
                for i, d in enumerate(dientes):
                    if str(d.get("numero_fdi", "")) == str(diente_num):
                        dientes[i]["estado_tratamiento"] = nuevo_estado
                        dientes[i]["ultimo_procedimiento"] = proc.procedimiento
                        dientes[i]["fecha_ultimo_tratamiento"] = input.fecha
                        break

            await db.odontogramas_clinicos.update_one(
                {"paciente_cedula": input.paciente_cedula},
                {"$set": {
                    "dientes": dientes,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )

    # Actualizar estado de la cita
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )

    return evolucion


@api_router.get("/evoluciones-sesion/paciente/{cedula}", response_model=List[EvolicionSesion])
async def get_evoluciones_by_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtiene todas las sesiones de un paciente ordenadas por fecha (más reciente primero)"""
    evoluciones = await db.evoluciones_sesion.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(1000)

    for e in evoluciones:
        if isinstance(e.get("created_at"), str):
            e["created_at"] = datetime.fromisoformat(e["created_at"])

    return evoluciones


@api_router.get("/evoluciones-sesion/appointment/{appointment_id}", response_model=EvolicionSesion)
async def get_evolucion_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtiene la evolución de una cita específica"""
    evolucion = await db.evoluciones_sesion.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not evolucion:
        raise HTTPException(status_code=404, detail="Evolución no encontrada")

    if isinstance(evolucion.get("created_at"), str):
        evolucion["created_at"] = datetime.fromisoformat(evolucion["created_at"])

    return EvolicionSesion(**evolucion)


@api_router.put("/evoluciones-sesion/{evolucion_id}", response_model=EvolicionSesion)
async def update_evolucion_sesion(
    evolucion_id: str,
    input: EvolicionSesionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualiza una evolución de sesión existente"""
    existing = await db.evoluciones_sesion.find_one({"id": evolucion_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Evolución no encontrada")

    update_data = input.model_dump()
    update_data["id"] = evolucion_id
    update_data["created_at"] = existing.get("created_at")

    await db.evoluciones_sesion.update_one(
        {"id": evolucion_id},
        {"$set": update_data}
    )

    if isinstance(update_data["created_at"], str):
        update_data["created_at"] = datetime.fromisoformat(update_data["created_at"])

    return EvolicionSesion(**update_data)


# ========== HELPER: CREAR CONSULTA FINANCIERA AUTOMÁTICA ==========

async def crear_consulta_financiera_automatica(appointment_id: str, paciente_cedula: str, 
                                                paciente_nombre: str, doctor_id: str,
                                                especialidad: str, username: str):
    """
    Crea consulta financiera automáticamente al cerrar cualquier consulta clínica.
    Si ya existe, la retorna sin duplicar.
    """
    try:
        existing = await db.consultas_financieras.find_one({"appointment_id": appointment_id}, {"_id": 0})
        if existing:
            return existing.get("id")

        appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
        if not appointment:
            return None

        cedula = paciente_cedula or appointment.get("cedula") or appointment.get("paciente_cedula") or ""
        doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
        doctor_nombre = doctor.get("nombre", "") if doctor else ""

        # Buscar precio en catálogo
        precio = 30.0
        try:
            servicio_cat = await db.catalogo_servicios.find_one(
                {"especialidad": {"$regex": especialidad, "$options": "i"}}, {"_id": 0}
            )
            if servicio_cat:
                precio = servicio_cat.get("precio_base", 30.0)
        except:
            pass

        from financial_models import ConsultaFinanciera, DetalleServicio
        servicio = DetalleServicio(
            consulta_id="",
            servicio=f"Consulta {especialidad}",
            descripcion=f"Consulta médica - {especialidad}",
            precio_unitario=precio,
            cantidad=1,
            subtotal=precio
        )

        consulta = ConsultaFinanciera(
            paciente_id=appointment_id,
            paciente_cedula=cedula,
            paciente_nombre=paciente_nombre,
            doctor_id=doctor_id,
            doctor_nombre=doctor_nombre,
            appointment_id=appointment_id,
            especialidad=especialidad,
            fecha=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            motivo=appointment.get("observaciones", ""),
            total=precio,
            total_pagado=0,
            saldo=precio,
            estado_pago="pendiente",
            servicios=[],
            pagos=[],
            created_by=username
        )
        servicio.consulta_id = consulta.id
        consulta.servicios = [servicio]

        doc = consulta.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        for srv in doc['servicios']:
            srv['created_at'] = srv['created_at'].isoformat()

        await db.consultas_financieras.insert_one(doc)
        await db.appointments.update_one({"id": appointment_id}, {"$set": {"estado": "Pendiente de Pago"}})
        return consulta.id
    except Exception as e:
        logging.error(f"Error creando consulta financiera automática: {str(e)}")
        return None


# ========== NUTRICIÓN ==========

@api_router.post("/medical-history/nutricion", response_model=MedicalHistoryNutricion)
async def create_nutricion_history(
    input: MedicalHistoryNutricionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_nutricion.find_one({"appointment_id": input.appointment_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe historia clínica para esta cita")

    history = MedicalHistoryNutricion(**input.model_dump())
    doc = history.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_nutricion.insert_one(doc)

    # Crear consulta financiera automáticamente
    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, input.paciente_cedula, input.paciente_nombre,
        input.doctor_id, "Nutrición", current_user.username
    )
    if fin_id:
        await db.medical_history_nutricion.update_one({"id": history.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history


@api_router.get("/medical-history/nutricion/appointment/{appointment_id}", response_model=MedicalHistoryNutricion)
async def get_nutricion_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_nutricion.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    if isinstance(history.get('created_at'), str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    return MedicalHistoryNutricion(**history)


@api_router.get("/medical-history/nutricion/paciente/{cedula}", response_model=List[MedicalHistoryNutricion])
async def get_nutricion_histories_by_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    histories = await db.medical_history_nutricion.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    for h in histories:
        if isinstance(h.get('created_at'), str):
            h['created_at'] = datetime.fromisoformat(h['created_at'])
    return histories


@api_router.put("/medical-history/nutricion/{history_id}", response_model=MedicalHistoryNutricion)
async def update_nutricion_history(
    history_id: str,
    input: MedicalHistoryNutricionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_nutricion.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['created_at'] = existing.get('created_at')
    await db.medical_history_nutricion.update_one({"id": history_id}, {"$set": update_data})
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    return MedicalHistoryNutricion(**update_data)


# ========== GINECOLOGÍA / OBSTETRICIA ==========

@api_router.post("/medical-history/ginecologia", response_model=MedicalHistoryGinecologia)
async def create_ginecologia_history(
    input: MedicalHistoryGinecologiaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_ginecologia.find_one({"appointment_id": input.appointment_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe historia clínica para esta cita")

    history = MedicalHistoryGinecologia(**input.model_dump())
    doc = history.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_ginecologia.insert_one(doc)

    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, input.paciente_cedula, input.paciente_nombre,
        input.doctor_id, "Ginecología", current_user.username
    )
    if fin_id:
        await db.medical_history_ginecologia.update_one({"id": history.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history


@api_router.get("/medical-history/ginecologia/appointment/{appointment_id}", response_model=MedicalHistoryGinecologia)
async def get_ginecologia_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_ginecologia.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    if isinstance(history.get('created_at'), str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    return MedicalHistoryGinecologia(**history)


@api_router.get("/medical-history/ginecologia/paciente/{cedula}", response_model=List[MedicalHistoryGinecologia])
async def get_ginecologia_histories_by_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    histories = await db.medical_history_ginecologia.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    for h in histories:
        if isinstance(h.get('created_at'), str):
            h['created_at'] = datetime.fromisoformat(h['created_at'])
    return histories


@api_router.put("/medical-history/ginecologia/{history_id}", response_model=MedicalHistoryGinecologia)
async def update_ginecologia_history(
    history_id: str,
    input: MedicalHistoryGinecologiaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_ginecologia.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['created_at'] = existing.get('created_at')
    await db.medical_history_ginecologia.update_one({"id": history_id}, {"$set": update_data})
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    return MedicalHistoryGinecologia(**update_data)


# ========== ECOGRAFÍA ==========

@api_router.post("/medical-history/ecografia", response_model=MedicalHistoryEcografia)
async def create_ecografia_history(
    input: MedicalHistoryEcografiaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_ecografia.find_one({"appointment_id": input.appointment_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe historia clínica para esta cita")

    history = MedicalHistoryEcografia(**input.model_dump())
    doc = history.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_ecografia.insert_one(doc)

    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, input.paciente_cedula, input.paciente_nombre,
        input.doctor_id, "Ecografía", current_user.username
    )
    if fin_id:
        await db.medical_history_ecografia.update_one({"id": history.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history


@api_router.get("/medical-history/ecografia/appointment/{appointment_id}", response_model=MedicalHistoryEcografia)
async def get_ecografia_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_ecografia.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    if isinstance(history.get('created_at'), str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    return MedicalHistoryEcografia(**history)


@api_router.get("/medical-history/ecografia/paciente/{cedula}", response_model=List[MedicalHistoryEcografia])
async def get_ecografia_histories_by_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    histories = await db.medical_history_ecografia.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    for h in histories:
        if isinstance(h.get('created_at'), str):
            h['created_at'] = datetime.fromisoformat(h['created_at'])
    return histories


@api_router.put("/medical-history/ecografia/{history_id}", response_model=MedicalHistoryEcografia)
async def update_ecografia_history(
    history_id: str,
    input: MedicalHistoryEcografiaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_ecografia.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['created_at'] = existing.get('created_at')
    await db.medical_history_ecografia.update_one({"id": history_id}, {"$set": update_data})
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    return MedicalHistoryEcografia(**update_data)


# ========== HISTORIAL CLÍNICO UNIFICADO POR PACIENTE ==========

@api_router.get("/historial-paciente/{cedula}")
async def get_historial_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Retorna TODO el historial clínico de un paciente por cédula,
    de todas las especialidades, ordenado por fecha descendente.
    Usado por el panel lateral de historial.
    """
    historial = []

    collections_map = [
        ("medical_history_general", "Medicina General"),
        ("medical_history_pediatric", "Pediatría"),
        ("medical_history_odontology", "Odontología"),
        ("medical_history_nutricion", "Nutrición"),
        ("medical_history_ginecologia", "Ginecología"),
        ("medical_history_ecografia", "Ecografía"),
    ]

    for collection_name, especialidad in collections_map:
        collection = getattr(db, collection_name)
        docs = await collection.find({"paciente_cedula": cedula}, {"_id": 0}).to_list(200)
        for doc in docs:
            historial.append({
                "id": doc.get("id"),
                "especialidad": especialidad,
                "fecha": doc.get("fecha", ""),
                "motivo_consulta": doc.get("motivo_consulta", doc.get("conclusion", "")),
                "diagnostico": doc.get("diagnostico_texto", doc.get("diagnostico", "")),
                "cie10_codigo": doc.get("cie10_codigo", ""),
                "cie10_descripcion": doc.get("cie10_descripcion", ""),
                "doctor_nombre": doc.get("doctor_nombre", ""),
                "appointment_id": doc.get("appointment_id", ""),
                "created_at": doc.get("created_at", ""),
            })

    historial.sort(key=lambda x: x.get("fecha", ""), reverse=True)
    return historial


# ========== IMÁGENES CLÍNICAS (FOTOS / RX) ==========

@api_router.post("/imagenes-clinicas")
async def guardar_imagen_clinica(
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Guarda una imagen clínica (RX, foto antes/después, etc.) en base64.
    Se asocia al paciente por cédula y opcionalmente a una cita.
    """
    imagen_doc = {
        "id": str(uuid.uuid4()),
        "paciente_cedula": data.get("paciente_cedula", ""),
        "paciente_nombre": data.get("paciente_nombre", ""),
        "appointment_id": data.get("appointment_id", ""),
        "categoria": data.get("categoria", "Otro"),  # RX Panorámica, RX Periapical, Foto Antes, etc.
        "tipo_archivo": data.get("tipo_archivo", "image/jpeg"),  # image/jpeg, image/png, application/pdf
        "nombre_archivo": data.get("nombre_archivo", "imagen.jpg"),
        "descripcion": data.get("descripcion", ""),
        "archivo_base64": data.get("archivo_base64", ""),  # ← Cambio de campo
        "especialidad": data.get("especialidad", "Odontología"),
        "doctor_nombre": data.get("doctor_nombre", current_user.username),
        "fecha": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.username,
    }
    await db.imagenes_clinicas.insert_one(imagen_doc)
    imagen_doc.pop("archivo_base64")  # no devolver base64 en respuesta
    return {"ok": True, "id": imagen_doc["id"], "fecha": imagen_doc["fecha"]}


@api_router.get("/imagenes-clinicas/paciente/{cedula}")
async def get_imagenes_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Lista las imágenes del paciente (sin base64 para que sea rápido)"""
    docs = await db.imagenes_clinicas.find(
        {"paciente_cedula": cedula},
        {"_id": 0, "archivo_base64": 0}  # ← Excluir archivo_base64
    ).sort("fecha", -1).to_list(200)
    return docs


@api_router.get("/imagenes-clinicas/{imagen_id}")
async def get_imagen(
    imagen_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtiene una imagen específica con su base64"""
    doc = await db.imagenes_clinicas.find_one({"id": imagen_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return doc


@api_router.delete("/imagenes-clinicas/{imagen_id}")
async def delete_imagen(
    imagen_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    await db.imagenes_clinicas.delete_one({"id": imagen_id})
    return {"ok": True}


# ========== IA MÉDICA — GEMINI FLASH (GRATUITO) ==========

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

async def get_gemini_key() -> str:
    """Lee la API key de MongoDB. Fallback a variable de entorno."""
    try:
        cfg = await db.configuracion.find_one({"clave": "gemini_api_key"}, {"_id": 0})
        if cfg and cfg.get("valor"):
            return cfg["valor"]
    except Exception:
        pass
    return os.environ.get("GEMINI_API_KEY", "")

SYSTEM_PROMPT_MEDICO = """Eres un asistente médico de apoyo clínico para el Centro de Especialidades Family Health en Guayaquil, Ecuador.
Tu función es APOYAR al médico humano, nunca reemplazarlo. Siempre debes:
- Responder en español, de forma concisa y clínica
- Proporcionar diferenciales diagnósticos con sus códigos CIE-10
- Sugerir tratamientos farmacológicos con dosis habituales para adultos/niños según corresponda
- Indicar cuándo referir a especialista
- Mencionar signos de alarma relevantes
- Aclarar siempre que tus sugerencias requieren validación del médico tratante
- Para odontología, sugerir procedimientos con los nombres del catálogo de Family Health cuando sea posible

IMPORTANTE: No eres un sustituto del criterio médico. Tus respuestas son apoyo informativo basado en evidencia."""


@api_router.post("/ia/consulta-medica")
async def consulta_ia_medica(
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Endpoint de IA médica usando Google Gemini Flash (gratuito).
    Recibe contexto del paciente y la pregunta del médico.
    data: {
        mensaje: str,           # pregunta o descripción del caso
        especialidad: str,       # Medicina General, Odontología, etc.
        contexto_paciente: {    # datos del paciente actual
            nombre, edad, sexo,
            motivo_consulta, antecedentes,
            diagnostico_previo, medicamentos_actuales
        },
        historial: [ {rol: user|assistant, texto: str} ]  # para modo chat
    }
    """
    GEMINI_API_KEY = await get_gemini_key()
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="IA no configurada. Ve a Admin → Configuración IA y guarda tu API key de Gemini."
        )

    mensaje = data.get("mensaje", "").strip()
    especialidad = data.get("especialidad", "Medicina General")
    ctx = data.get("contexto_paciente", {})
    historial = data.get("historial", [])

    if not mensaje:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    # Construir contexto del paciente
    contexto_str = f"""
CONTEXTO DEL PACIENTE ACTUAL:
- Nombre: {ctx.get('nombre', 'No especificado')}
- Edad: {ctx.get('edad', 'No especificada')} años
- Sexo: {ctx.get('sexo', 'No especificado')}
- Especialidad: {especialidad}
- Motivo de consulta: {ctx.get('motivo_consulta', 'No especificado')}
- Antecedentes: {ctx.get('antecedentes', 'Sin antecedentes registrados')}
- Alergias: {ctx.get('alergias', 'Ninguna conocida')}
- Medicamentos actuales: {ctx.get('medicamentos_actuales', 'Ninguno')}
- Diagnóstico previo: {ctx.get('diagnostico_previo', 'Primera consulta')}
"""

    # Armar historial de conversación para Gemini
    contents = []

    # Mensaje del sistema como primer turno de usuario
    contents.append({
        "role": "user",
        "parts": [{"text": SYSTEM_PROMPT_MEDICO + "\n\n" + contexto_str}]
    })
    contents.append({
        "role": "model",
        "parts": [{"text": "Entendido. Estoy listo para apoyar la consulta con el contexto del paciente proporcionado. ¿En qué puedo ayudar al médico?"}]
    })

    # Agregar historial previo del chat
    for h in historial[-10:]:  # solo últimos 10 turnos para no exceder tokens
        role = "user" if h.get("rol") == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": h.get("texto", "")}]
        })

    # Mensaje actual del médico
    contents.append({
        "role": "user",
        "parts": [{"text": mensaje}]
    })

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                json={
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.3,      # bajo = más conservador/clínico
                        "maxOutputTokens": 1000,
                        "topP": 0.8,
                    },
                    "safetySettings": [
                        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
                        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
                    ]
                },
                headers={"Content-Type": "application/json"}
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Error de Gemini API: {response.status_code} — Verifique la GEMINI_API_KEY"
            )

        result = response.json()
        texto_respuesta = result["candidates"][0]["content"]["parts"][0]["text"]

        return {
            "respuesta": texto_respuesta,
            "modelo": "gemini-1.5-flash",
            "tokens_usados": result.get("usageMetadata", {}).get("totalTokenCount", 0)
        }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout — Gemini tardó demasiado, intente de nuevo")
    except KeyError:
        raise HTTPException(status_code=502, detail="Respuesta inesperada de Gemini API")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error de IA: {str(e)}")


# ========== CONFIGURACIÓN DEL SISTEMA ==========

@api_router.get("/configuracion/ia")
async def get_config_ia(current_user: TokenData = Depends(get_current_user)):
    """Lee la configuración de IA — solo muestra si está configurada, nunca devuelve la key."""
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    cfg = await db.configuracion.find_one({"clave": "gemini_api_key"}, {"_id": 0})
    tiene_key = bool(cfg and cfg.get("valor"))
    key_preview = ""
    if tiene_key:
        val = cfg["valor"]
        key_preview = val[:8] + "..." + val[-4:]  # Ej: AIzaSyAB...xYz
    return {
        "configurada": tiene_key,
        "key_preview": key_preview,
        "modelo": "gemini-1.5-flash",
        "costo": "Gratuito (hasta 1M tokens/día)",
        "actualizado": cfg.get("actualizado", "") if cfg else ""
    }


@api_router.post("/configuracion/ia")
async def save_config_ia(data: dict, current_user: TokenData = Depends(get_current_user)):
    """Guarda la API key de Gemini en MongoDB. Solo Administrador."""
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")

    api_key = data.get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="La API key no puede estar vacía")
    if not api_key.startswith("AIza"):
        raise HTTPException(status_code=400, detail="API key inválida — debe empezar con 'AIza'")

    # Verificar que la key funciona antes de guardar
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            test_resp = await client.post(
                f"{GEMINI_URL}?key={api_key}",
                json={"contents": [{"role": "user", "parts": [{"text": "test"}]}],
                      "generationConfig": {"maxOutputTokens": 5}},
                headers={"Content-Type": "application/json"}
            )
        if test_resp.status_code == 400:
            raise HTTPException(status_code=400, detail="API key inválida — verifica en aistudio.google.com")
        if test_resp.status_code == 403:
            raise HTTPException(status_code=400, detail="API key sin permisos — verifica en Google AI Studio")
    except httpx.TimeoutException:
        pass  # Timeout no significa key inválida, guardar igual

    await db.configuracion.update_one(
        {"clave": "gemini_api_key"},
        {"$set": {
            "clave": "gemini_api_key",
            "valor": api_key,
            "actualizado": datetime.now(timezone.utc).isoformat(),
            "actualizado_por": current_user.username
        }},
        upsert=True
    )
    return {"ok": True, "mensaje": "✅ API key guardada correctamente en MongoDB"}


@api_router.delete("/configuracion/ia")
async def delete_config_ia(current_user: TokenData = Depends(get_current_user)):
    """Elimina la API key de MongoDB."""
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.delete_one({"clave": "gemini_api_key"})
    return {"ok": True, "mensaje": "API key eliminada"}



@api_router.get("/paciente/{cedula}/historial-consultas")
async def get_historial_consultas_paciente(
    cedula: str,
    especialidad: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Retorna el historial de consultas de un paciente por cédula.
    Útil para detectar si es primera cita o cita subsecuente.
    """
    query = {"cedula": cedula}
    if especialidad:
        norm = especialidad.lower()
        query["especialidad"] = {"$regex": norm, "$options": "i"}

    citas = await db.appointments.find(query, {"_id": 0}).sort("fecha", -1).to_list(100)

    # Para cada cita pagada/atendida, buscar si tiene historia clínica
    resultado = []
    for cita in citas:
        if cita.get("estado") in ("Pagada", "Atendida", "Pagado"):
            resultado.append({
                "id": cita.get("id"),
                "fecha": cita.get("fecha"),
                "especialidad": cita.get("especialidad"),
                "doctor_nombre": cita.get("doctor_nombre"),
                "estado": cita.get("estado"),
            })

    return {
        "cedula": cedula,
        "total_consultas": len(resultado),
        "es_primera_cita": len(resultado) == 0,
        "ultima_consulta": resultado[0] if resultado else None,
        "consultas": resultado,
    }


@api_router.get("/paciente/{cedula}/medidas-nutricion")
async def get_medidas_nutricion(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Retorna el historial de medidas antropométricas de nutrición para
    mostrar el comparativo entre citas (peso, IMC, ICC, etc.)
    """
    # Buscar citas de nutrición del paciente
    citas = await db.appointments.find(
        {"cedula": cedula, "especialidad": {"$regex": "nutri", "$options": "i"}},
        {"_id": 0}
    ).sort("fecha", -1).to_list(50)

    medidas = []
    for cita in citas:
        # Buscar historia clínica de nutrición (colección correcta)
        hist = await db.medical_history_nutricion.find_one(
            {"appointment_id": cita["id"]}, {"_id": 0}
        )
        if not hist:
            continue
        ef = hist.get("examen_fisico") or {}
        # Solo agregar si tiene al menos una medida antropométrica
        if any(ef.get(k) is not None for k in ("peso", "talla", "imc", "porcentaje_grasa", "cintura", "cadera")):
            medidas.append({
                "fecha": cita.get("fecha"),
                "appointment_id": cita.get("id"),
                "peso": ef.get("peso"),
                "talla": ef.get("talla"),
                "imc": ef.get("imc"),
                "icc": ef.get("icc"),
                "masa_grasa": ef.get("porcentaje_grasa"),
                "masa_muscular": ef.get("porcentaje_musculo"),
                "edad_corporal": ef.get("edad_corporal"),
                "circunferencia_cintura": ef.get("cintura"),
                "circunferencia_cadera": ef.get("cadera"),
                "pliegue_suprailiaco": ef.get("pliegue_suprailiaco"),
                "pliegue_tricipital": ef.get("pliegue_tricipital"),
                "pliegue_bicipital": ef.get("pliegue_bicipital"),
                "pliegue_subescapular": ef.get("pliegue_subescapular"),
                "motivo_consulta": hist.get("motivo_consulta"),
                "diagnostico_texto": hist.get("diagnostico_texto"),
                "plan_alimentario": hist.get("plan_alimentario"),
            })

    return {"cedula": cedula, "medidas": medidas}


@api_router.post("/nutricion/enviar-plan/{appointment_id}")
async def enviar_plan_nutricional(
    appointment_id: str,
    data: dict = {},
    current_user: TokenData = Depends(get_current_user)
):
    """Envia el plan nutricional por correo al paciente."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    apt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not apt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    hist = await db.nutricion_history.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not hist:
        raise HTTPException(status_code=404, detail="Historia nutricional no encontrada. Guarda primero la consulta.")

    email_destino = data.get("email") or apt.get("email", "")
    if not email_destino:
        raise HTTPException(status_code=400, detail="No hay email del paciente. Agrega el correo en la ficha de la cita.")

    cfg_email = await db.configuracion.find_one({"clave": "email_config"}, {"_id": 0})
    if not cfg_email or not cfg_email.get("valor"):
        raise HTTPException(status_code=503, detail="Correo no configurado. Ve a Admin -> Config. SRI -> seccion Gmail")

    email_cfg = cfg_email["valor"]
    smtp_user = email_cfg.get("email", "")
    smtp_pass = email_cfg.get("app_password", "")
    if not smtp_user or not smtp_pass:
        raise HTTPException(status_code=503, detail="Configuracion de correo incompleta")

    plan = hist.get("plan_alimentario", "")
    recs = hist.get("recomendaciones", "")
    diag = hist.get("diagnostico_nutricional", "")
    peso = hist.get("peso_actual", "") or str(hist.get("examen_fisico", {}).get("peso", ""))
    imc  = hist.get("imc", "") or str(hist.get("examen_fisico", {}).get("imc", ""))
    nombre = apt.get("nombre_completo", "Paciente")
    fecha = apt.get("fecha", "")

    plan_html = f"<div style='white-space:pre-wrap;font-size:13px;line-height:1.6'>{plan}</div>" if plan else ""
    recs_html = f"<div style='white-space:pre-wrap;font-size:13px;line-height:1.6'>{recs}</div>" if recs else ""

    cuerpo = f"""<html><body style='font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto'>
<div style='background:linear-gradient(135deg,#00a8cc,#005f73);padding:20px;border-radius:10px 10px 0 0;text-align:center'>
  <h2 style='color:white;margin:0'>Plan Nutricional Personalizado</h2>
  <p style='color:rgba(255,255,255,0.8);margin:5px 0 0'>Centro de Especialidades Family Health</p>
</div>
<div style='background:#f8fdff;padding:20px;border:1px solid #e0f7fa'>
  <p>Estimado/a <strong>{nombre}</strong>,</p>
  <p>A continuacion su plan nutricional personalizado segun su evaluacion del {fecha}.</p>
  <div style='background:white;border:1px solid #b2ebf2;border-radius:8px;padding:15px;margin:12px 0'>
    <p style='margin:0 0 8px;font-weight:700;color:#005f73'>Datos de su consulta:</p>
    <p style='margin:3px 0'>Fecha: {fecha}</p>
    {'<p style="margin:3px 0">Peso: ' + peso + ' kg</p>' if peso else ''}
    {'<p style="margin:3px 0">IMC: ' + imc + '</p>' if imc else ''}
    {'<p style="margin:3px 0">Diagnostico: ' + diag + '</p>' if diag else ''}
  </div>
  {'<div style="background:white;border:1px solid #b2ebf2;border-radius:8px;padding:15px;margin:12px 0"><p style="margin:0 0 10px;font-weight:700;color:#005f73">Plan Alimentario:</p>' + plan_html + '</div>' if plan else ''}
  {'<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:8px;padding:15px;margin:12px 0"><p style="margin:0 0 8px;font-weight:700;color:#e65100">Recomendaciones:</p>' + recs_html + '</div>' if recs else ''}
  <p style='font-size:12px;color:#666;margin-top:16px'>Si tiene dudas sobre su plan, contactenos.</p>
</div>
<div style='background:#005f73;padding:15px;border-radius:0 0 10px 10px;text-align:center'>
  <p style='color:white;margin:0;font-size:13px'>Family Health | Guayaquil | 096-291-2170</p>
</div>
</body></html>"""

    msg = MIMEMultipart()
    msg["From"] = f"Family Health <{smtp_user}>"
    msg["To"] = email_destino
    msg["Subject"] = f"Plan Nutricional - {nombre} - Family Health"
    msg.attach(MIMEText(cuerpo, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return {"ok": True, "mensaje": f"Plan nutricional enviado a {email_destino}"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="Error de autenticacion Gmail. Usa una App Password.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar: {e}")

# ========== MIGRACIÓN: RECALCULAR EDAD PACIENTES EXISTENTES ==========

def calcular_edad_desde_fecha(fecha_nacimiento: str) -> int:
    """
    Calcula la edad a partir de una fecha de nacimiento en formato ISO (YYYY-MM-DD).
    Retorna la edad en años o 0 si hay error.
    """
    try:
        fn = datetime.fromisoformat(fecha_nacimiento)
        hoy = datetime.now()
        edad = hoy.year - fn.year
        # Si el cumpleaños no ha llegado este año, restar 1
        if hoy.month < fn.month or (hoy.month == fn.month and hoy.day < fn.day):
            edad -= 1
        return max(0, edad)
    except Exception:
        return 0

@api_router.post("/admin/migrar-edades")
async def migrar_edades_pacientes(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Recalcula la edad de TODOS los appointments existentes que tienen edad=0
    pero sí tienen fecha_nacimiento. Ejecutar UNA sola vez después del deploy.
    Solo accesible para Administrador.
    """
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo el Administrador puede ejecutar migraciones")

    appointments = await db.appointments.find({}, {"_id": 0}).to_list(10000)
    actualizados = 0
    sin_fecha = 0
    print(f"\n🔄 INICIANDO MIGRACIÓN DE EDADES")
    print(f"   Total citas a procesar: {len(appointments)}")

    for apt in appointments:
        fecha = apt.get("fecha_nacimiento", "")
        edad_actual = apt.get("edad", 0)
        
        if fecha:
            nueva_edad = calcular_edad_desde_fecha(fecha)
            # Actualizar si la edad es diferente (incluyendo edad=0 con fecha válida)
            if nueva_edad != edad_actual:
                await db.appointments.update_one(
                    {"id": apt["id"]},
                    {"$set": {"edad": nueva_edad}}
                )
                actualizados += 1
                print(f"   ✅ {apt.get('nombre_completo', 'N/A')}: {edad_actual} → {nueva_edad} años")
        else:
            sin_fecha += 1

    print(f"\n✅ MIGRACIÓN COMPLETADA")
    print(f"   Actualizados: {actualizados}")
    print(f"   Sin fecha: {sin_fecha}")
    
    return {
        "ok": True,
        "total_procesados": len(appointments),
        "actualizados": actualizados,
        "sin_fecha_nacimiento": sin_fecha,
        "mensaje": f"✅ {actualizados} pacientes actualizados con edad correcta"
    }


# ========== ANTECEDENTES DEL PACIENTE ==========

@api_router.get("/antecedentes-paciente/{cedula}")
async def get_antecedentes_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Busca los antecedentes clínicos de un paciente en TODAS sus consultas previas.
    Retorna los antecedentes más completos encontrados + alertas activas.
    Solo hay que llenarlos UNA VEZ — se reutilizan en consultas futuras.
    """
    antecedentes = {
        # Patologías (alertas críticas)
        "diabetes": False,
        "hipertension": False,
        "cardiopatias": False,
        "hepatitis": False,
        "vih": False,
        "epilepsia": False,
        "embarazo": False,
        "asma": False,
        # Alergias — MUY IMPORTANTE
        "alergias_medicamentos": "",
        "alergias": "",
        # Antecedentes generales
        "ant_familiares": "",
        "ant_personales": "",
        "ant_quirurgicos": "",
        "medicamentos_actuales": "",
        # Hábitos
        "fumador": False,
        "alcohol": False,
        # Ginecológicos (si aplica)
        "menarquia": "",
        "gestas": None,
        "partos": None,
        "cesareas": None,
        "abortos": None,
        # Meta
        "tiene_antecedentes": False,
        "fuente": "",  # de qué especialidad vienen
        "fecha_registro": "",
    }

    # Buscar en todas las colecciones de historias clínicas
    busquedas = [
        ("medical_history_general", "Medicina General"),
        ("medical_history_pediatric", "Pediatría"),
        ("medical_history_odontology", "Odontología"),
        ("medical_history_nutricion", "Nutrición"),
        ("medical_history_ginecologia", "Ginecología"),
    ]

    for collection_name, especialidad in busquedas:
        collection = getattr(db, collection_name)
        # Buscar el más antiguo (primera consulta) para antecedentes base
        docs = await collection.find(
            {"paciente_cedula": cedula}, {"_id": 0}
        ).sort("fecha", 1).to_list(1)

        if not docs:
            continue

        doc = docs[0]
        antecedentes["tiene_antecedentes"] = True
        antecedentes["fuente"] = especialidad
        antecedentes["fecha_registro"] = doc.get("fecha", "")

        # Patologías — OR acumulativo (si alguna consulta dijo True, es True)
        for campo in ["diabetes", "hipertension", "cardiopatias", "hepatitis", "vih", "epilepsia", "embarazo"]:
            if doc.get(campo):
                antecedentes[campo] = True

        # Alergias — tomar el más completo
        for campo_doc, campo_ant in [
            ("alergias_medicamentos", "alergias_medicamentos"),
            ("alergias", "alergias"),
            ("ant_personales_alergias", "alergias"),
        ]:
            valor = doc.get(campo_doc, "")
            if valor and len(valor) > len(antecedentes.get(campo_ant, "")):
                antecedentes[campo_ant] = valor

        # Antecedentes generales — tomar el más completo
        for campo_doc, campo_ant in [
            ("ant_familiares", "ant_familiares"),
            ("ant_personales", "ant_personales"),
            ("ant_personales_quirurgicos", "ant_quirurgicos"),
            ("antecedentes_familiares", "ant_familiares"),
            ("medicamentos_actuales", "medicamentos_actuales"),
        ]:
            valor = doc.get(campo_doc, "")
            if valor and len(valor) > len(antecedentes.get(campo_ant, "")):
                antecedentes[campo_ant] = valor

        # Ginecológicos
        if especialidad == "Ginecología":
            datos_gine = doc.get("datos_ginecologicos", {})
            for campo in ["menarquia", "gestas", "partos", "cesareas", "abortos"]:
                if datos_gine.get(campo):
                    antecedentes[campo] = datos_gine[campo]

    # Construir lista de alertas
    alertas = []
    if antecedentes["alergias_medicamentos"] or antecedentes["alergias"]:
        alertas.append({
            "tipo": "ALERGIA",
            "color": "#dc2626",
            "icono": "⚠️",
            "mensaje": f"ALÉRGICO: {antecedentes['alergias_medicamentos'] or antecedentes['alergias']}"
        })
    if antecedentes["diabetes"]:
        alertas.append({"tipo": "DIABETES", "color": "#d97706", "icono": "🩸", "mensaje": "Paciente DIABÉTICO"})
    if antecedentes["hipertension"]:
        alertas.append({"tipo": "HTA", "color": "#dc2626", "icono": "❤️", "mensaje": "Paciente HIPERTENSO"})
    if antecedentes["cardiopatias"]:
        alertas.append({"tipo": "CARDIOPATÍA", "color": "#dc2626", "icono": "🫀", "mensaje": "Paciente con CARDIOPATÍA"})
    if antecedentes["epilepsia"]:
        alertas.append({"tipo": "EPILEPSIA", "color": "#7c3aed", "icono": "⚡", "mensaje": "Paciente con EPILEPSIA"})
    if antecedentes["hepatitis"]:
        alertas.append({"tipo": "HEPATITIS", "color": "#d97706", "icono": "🏥", "mensaje": "Paciente con HEPATITIS"})
    if antecedentes["vih"]:
        alertas.append({"tipo": "VIH", "color": "#dc2626", "icono": "🔴", "mensaje": "Paciente VIH+"})
    if antecedentes["embarazo"]:
        alertas.append({"tipo": "EMBARAZO", "color": "#ec4899", "icono": "🤱", "mensaje": "Paciente EMBARAZADA"})

    antecedentes["alertas"] = alertas
    return antecedentes


@api_router.put("/antecedentes-paciente/{cedula}")
async def update_antecedentes_paciente(
    cedula: str,
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Guarda/actualiza los antecedentes del paciente en la colección de pacientes.
    Se llama cuando el doctor llena los antecedentes por primera vez.
    """
    await db.pacientes.update_one(
        {"cedula": cedula},
        {"$set": {"antecedentes": data, "antecedentes_actualizados": datetime.now(timezone.utc).isoformat()}},
        upsert=False
    )
    return {"ok": True}


# ========== CIE-10 BÚSQUEDA ==========

CIE10_COMUNES = [
    {"codigo": "J06.9", "descripcion": "Infección aguda de las vías respiratorias superiores, no especificada"},
    {"codigo": "J00", "descripcion": "Rinofaringitis aguda (resfriado común)"},
    {"codigo": "J03.9", "descripcion": "Amigdalitis aguda, no especificada"},
    {"codigo": "J18.9", "descripcion": "Neumonía, no especificada"},
    {"codigo": "A09", "descripcion": "Diarrea y gastroenteritis de presunto origen infeccioso"},
    {"codigo": "K21.0", "descripcion": "Enfermedad por reflujo gastroesofágico con esofagitis"},
    {"codigo": "K29.7", "descripcion": "Gastritis, no especificada"},
    {"codigo": "N39.0", "descripcion": "Infección de vías urinarias, sitio no especificado"},
    {"codigo": "I10", "descripcion": "Hipertensión esencial (primaria)"},
    {"codigo": "E11.9", "descripcion": "Diabetes mellitus tipo 2, sin complicaciones"},
    {"codigo": "E66.9", "descripcion": "Obesidad, no especificada"},
    {"codigo": "E63.9", "descripcion": "Deficiencia nutricional, no especificada"},
    {"codigo": "F32.9", "descripcion": "Episodio depresivo, no especificado"},
    {"codigo": "F41.1", "descripcion": "Trastorno de ansiedad generalizada"},
    {"codigo": "M54.5", "descripcion": "Lumbago no especificado"},
    {"codigo": "M54.2", "descripcion": "Cervicalgia"},
    {"codigo": "R51", "descripcion": "Cefalea"},
    {"codigo": "R05", "descripcion": "Tos"},
    {"codigo": "R50.9", "descripcion": "Fiebre, no especificada"},
    {"codigo": "Z34.0", "descripcion": "Supervisión de embarazo normal, primigesta"},
    {"codigo": "Z34.9", "descripcion": "Supervisión de embarazo normal, no especificado"},
    {"codigo": "O80", "descripcion": "Parto único espontáneo"},
    {"codigo": "N76.0", "descripcion": "Vaginitis aguda"},
    {"codigo": "N91.2", "descripcion": "Amenorrea, no especificada"},
    {"codigo": "K08.1", "descripcion": "Pérdida de dientes debida a accidente, extracción o enfermedad periodontal local"},
    {"codigo": "K02.9", "descripcion": "Caries dental, no especificada"},
    {"codigo": "K05.1", "descripcion": "Gingivitis crónica"},
    {"codigo": "P00-P96", "descripcion": "Ciertas afecciones originadas en el período perinatal"},
    {"codigo": "Z00.1", "descripcion": "Examen de control de salud del niño"},
    {"codigo": "J45.9", "descripcion": "Asma, no especificada"},
    # ── Odontología completo K00-K14 ──
    {"codigo": "K02.0", "descripcion": "Caries limitada al esmalte (mancha blanca)"},
    {"codigo": "K02.1", "descripcion": "Caries de la dentina"},
    {"codigo": "K02.2", "descripcion": "Caries del cemento"},
    {"codigo": "K02.3", "descripcion": "Caries dentaria detenida"},
    {"codigo": "K02.5", "descripcion": "Caries con exposición pulpar"},
    {"codigo": "K04.0", "descripcion": "Pulpitis"},
    {"codigo": "K04.1", "descripcion": "Necrosis de la pulpa"},
    {"codigo": "K04.4", "descripcion": "Periodontitis apical aguda originada en la pulpa"},
    {"codigo": "K04.5", "descripcion": "Periodontitis apical crónica (granuloma apical)"},
    {"codigo": "K04.6", "descripcion": "Absceso periapical con fístula"},
    {"codigo": "K04.7", "descripcion": "Absceso periapical sin fístula"},
    {"codigo": "K04.8", "descripcion": "Quiste radicular"},
    {"codigo": "K05.0", "descripcion": "Gingivitis aguda"},
    {"codigo": "K05.2", "descripcion": "Periodontitis aguda"},
    {"codigo": "K05.3", "descripcion": "Periodontitis crónica"},
    {"codigo": "K06.0", "descripcion": "Recesión gingival"},
    {"codigo": "K06.1", "descripcion": "Agrandamiento gingival (hiperplasia gingival)"},
    {"codigo": "K07.4", "descripcion": "Maloclusión, no especificada"},
    {"codigo": "K07.6", "descripcion": "Trastornos de la articulación temporomandibular (ATM)"},
    {"codigo": "K08.1", "descripcion": "Pérdida de dientes por extracción o enfermedad periodontal"},
    {"codigo": "K08.3", "descripcion": "Raíz dental retenida"},
    {"codigo": "K10.3", "descripcion": "Alveolitis del maxilar (alveolo seco)"},
    {"codigo": "K01.1", "descripcion": "Dientes impactados (tercer molar incluido)"},
    {"codigo": "K03.0", "descripcion": "Atrición excesiva de los dientes (bruxismo)"},
    {"codigo": "K03.1", "descripcion": "Abrasión de los dientes"},
    {"codigo": "K03.2", "descripcion": "Erosión de los dientes"},
    {"codigo": "K03.6", "descripcion": "Depósitos en los dientes (cálculo, placa bacteriana)"},
    {"codigo": "K12.0", "descripcion": "Estomatitis aftosa recurrente (úlcera aftosa)"},
    {"codigo": "K12.2", "descripcion": "Celulitis y absceso de boca"},
    {"codigo": "K13.0", "descripcion": "Queilitis (enfermedad de los labios)"},
    {"codigo": "Z01.2", "descripcion": "Examen dental de rutina"},
]

@api_router.get("/cie10/buscar")
async def buscar_cie10(
    q: str = "",
    current_user: TokenData = Depends(get_current_user)
):
    """Busca códigos CIE-10. Si no hay query retorna los más comunes."""
    if not q or len(q) < 2:
        return CIE10_COMUNES[:20]

    q_lower = q.lower()
    resultados = [
        item for item in CIE10_COMUNES
        if q_lower in item["codigo"].lower() or q_lower in item["descripcion"].lower()
    ]
    return resultados[:15]


# ========== PRESCRIPTION ENDPOINTS ==========
# Sistema TRANSVERSAL de recetas para todas las especialidades

@api_router.post("/prescriptions", response_model=Prescription)
async def create_prescription(
    input: PrescriptionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crear receta médica - Funciona para TODAS las especialidades:
    - Medicina General
    - Odontología  
    - Pediatría
    - Ginecología
    - Otras especialidades
    
    Solo valida campos mínimos obligatorios.
    """
    # Get patient info - buscar por appointment_id o paciente_id
    # Normalizar paciente_id — puede venir vacío, usar cedula como fallback
    paciente_id_real = input.paciente_id or input.paciente_cedula or input.appointment_id or ""
    paciente_cedula_real = input.paciente_cedula or input.paciente_id or ""

    appointment = None
    if input.appointment_id:
        appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment and paciente_id_real:
        appointment = await db.appointments.find_one({"id": paciente_id_real}, {"_id": 0})
    # Fallback: buscar por cédula
    if not appointment and paciente_cedula_real:
        appointment = await db.appointments.find_one(
            {"cedula": paciente_cedula_real}, {"_id": 0}
        )
    # Si aún no hay cita, crear objeto mínimo para no bloquear
    if not appointment:
        appointment = {
            "id": input.appointment_id or "",
            "nombre_completo": input.paciente_nombre or "",
            "cedula": paciente_cedula_real,
            "edad": 0,
            "fecha_nacimiento": "",
            "especialidad": input.especialidad or "",
            "doctor_id": input.doctor_id or "",
        }
    
    # Get doctor info - del usuario actual o del input
    doctor = None
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    
    doctor_id = input.doctor_id or (user.get('doctor_id') if user else None) or appointment.get('doctor_id')
    if doctor_id:
        doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    
    prescription_dict = input.model_dump()
    
    # Datos del paciente (de la cita)
    prescription_dict['paciente_id'] = appointment['id']
    prescription_dict['paciente_nombre'] = appointment.get('nombre_completo', '')
    prescription_dict['paciente_cedula'] = appointment.get('cedula', '')
    prescription_dict['paciente_edad'] = calcular_edad_desde_fecha(appointment.get('fecha_nacimiento','')) or appointment.get('edad',0)
    prescription_dict['appointment_id'] = appointment['id']
    
    # Especialidad de la consulta
    prescription_dict['especialidad'] = input.especialidad or appointment.get('especialidad', '')
    
    # Datos del doctor
    if doctor:
        prescription_dict['doctor_id'] = doctor['id']
        prescription_dict['doctor_nombre'] = doctor.get('nombre', '')
        prescription_dict['doctor_especialidad'] = doctor.get('especialidad', '')
    else:
        prescription_dict['doctor_id'] = doctor_id or ''
        prescription_dict['doctor_nombre'] = user.get('nombre_completo', '') if user else ''
        prescription_dict['doctor_especialidad'] = appointment.get('especialidad', '')
    
    # Asegurar fecha
    if not prescription_dict.get('fecha'):
        prescription_dict['fecha'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Filtrar medicamentos vacíos (si hay medicamentos)
    if prescription_dict.get('medicamentos'):
        prescription_dict['medicamentos'] = [
            m for m in prescription_dict.get('medicamentos', []) 
            if m.get('nombre', '').strip()
        ]
    else:
        prescription_dict['medicamentos'] = []
    
    # Crear la receta
    try:
        prescription_obj = Prescription(**prescription_dict)
        doc = prescription_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        
        await db.prescriptions.insert_one(doc)
        return prescription_obj
    except Exception as e:
        logging.error(f"Error creando receta: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear receta: {str(e)}")

@api_router.get("/prescriptions", response_model=List[Prescription])
async def get_prescriptions(current_user: TokenData = Depends(get_current_user)):
    prescriptions = await db.prescriptions.find({}, {"_id": 0}).to_list(1000)
    
    for prescription in prescriptions:
        if isinstance(prescription['created_at'], str):
            prescription['created_at'] = datetime.fromisoformat(prescription['created_at'])
    
    return prescriptions

@api_router.get("/prescriptions/patient/{cedula}", response_model=List[Prescription])
async def get_prescriptions_by_patient(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener todas las recetas de un paciente por cédula"""
    prescriptions = await db.prescriptions.find(
        {"paciente_cedula": cedula}, 
        {"_id": 0}
    ).to_list(1000)
    
    for prescription in prescriptions:
        if isinstance(prescription['created_at'], str):
            prescription['created_at'] = datetime.fromisoformat(prescription['created_at'])
    
    # Ordenar por fecha descendente
    prescriptions.sort(key=lambda x: x.get('fecha', ''), reverse=True)
    return prescriptions

@api_router.get("/prescriptions/{prescription_id}/pdf")
async def download_prescription_pdf(
    prescription_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    prescription = await db.prescriptions.find_one({"id": prescription_id}, {"_id": 0})
    if not prescription:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    
    # Generate PDF
    pdf_buffer = generate_prescription_pdf(prescription)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=receta_{prescription['paciente_cedula']}_{prescription['fecha']}.pdf"
        }
    )


@api_router.post("/certificado/pdf")
async def generate_certificado(
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Genera un certificado médico en PDF con branding Family Health"""
    try:
        pdf_buffer = generate_certificado_pdf(data)
        from fastapi.responses import StreamingResponse
        nombre = data.get('paciente_cedula', 'paciente')
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=certificado_{nombre}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando certificado: {str(e)}")


# ========== EXISTING ENDPOINTS (from Phase 2) ==========

@api_router.get("/")
async def root():
    return {"message": "Family Health API - Fase 3"}

@api_router.get("/specialties")
async def get_specialties():
    return {
        "specialties": [
            "Odontología",
            "Medicina General",
            "Pediatría",
            "Ginecología",
            "Psicología",
            "Nutrición",
            "Laboratorio Clínico",
            "Ecografía",
            "Terapia Física"
        ]
    }

@api_router.get("/categories")
async def get_categories():
    return {
        "categories": [
            "Odontología",
            "Medicina General",
            "Nutrición",
            "Psicología",
            "Ginecología",
            "Laboratorio Clínico",
            "Material Quirúrgico",
            "Consumibles",
            "Otros"
        ]
    }

# Doctor endpoints
@api_router.post("/doctors", response_model=Doctor)
async def create_doctor(input: DoctorCreate):
    doctor_obj = Doctor(**input.model_dump())
    doc = doctor_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.doctors.insert_one(doc)
    return doctor_obj

@api_router.get("/doctors", response_model=List[Doctor])
async def get_doctors():
    doctors = await db.doctors.find({}, {"_id": 0}).to_list(1000)
    for doctor in doctors:
        if isinstance(doctor['created_at'], str):
            doctor['created_at'] = datetime.fromisoformat(doctor['created_at'])
        if 'porcentaje' not in doctor:
            doctor['porcentaje'] = 50.0
    return doctors

@api_router.put("/doctors/{doctor_id}", response_model=Doctor)
async def update_doctor(doctor_id: str, input: DoctorUpdate):
    existing = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.doctors.update_one({"id": doctor_id}, {"$set": update_data})
    updated = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Doctor(**updated)

@api_router.delete("/doctors/{doctor_id}")
async def delete_doctor(doctor_id: str):
    result = await db.doctors.delete_one({"id": doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return {"message": "Doctor eliminado exitosamente"}

# Appointment endpoints
@api_router.post("/appointments", response_model=Appointment)
async def create_appointment(input: AppointmentCreate):
    """
    Crear cita con unificación automática de paciente por cédula.
    Si la cédula ya existe, actualiza datos vacíos del paciente (no sobreescribe).
    """
    # Calcular edad desde fecha_nacimiento
    if input.fecha_nacimiento:
        try:
            fn = datetime.fromisoformat(input.fecha_nacimiento)
            hoy_dt = datetime.now()
            edad_calc = hoy_dt.year - fn.year
            if (hoy_dt.month, hoy_dt.day) < (fn.month, fn.day):
                edad_calc -= 1
            input.edad = max(0, edad_calc)
        except Exception:
            pass

    # Detectar menor de edad automáticamente
    if input.edad > 0 and input.edad < 18:
        input.es_menor = True

    # Buscar doctor (opcional — no bloquea si no se especifica)
    doctor = None
    if input.doctor_id:
        doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
        if not doctor:
            # Fallback: buscar por nombre
            if input.doctor_nombre:
                doctor = await db.doctors.find_one(
                    {"nombre": {"$regex": input.doctor_nombre, "$options": "i"}}, {"_id": 0}
                )

    # Unificar paciente por cédula (evita duplicados)
    cedula_principal = input.cedula or input.paciente_cedula or ""
    datos_adicionales = {
        "nombre": input.nombre_completo,
        "telefono": input.telefono,
        "email": input.email or "",
        "whatsapp": input.whatsapp or "",
        "fecha_nacimiento": input.fecha_nacimiento,
        "sexo": input.sexo or "",
        "tipo_documento": input.tipo_documento or "cedula",
    }
    if cedula_principal:
        try:
            paciente = await unificar_paciente_por_cedula(
                cedula=cedula_principal,
                datos_adicionales=datos_adicionales
            )
            paciente_id = paciente.id
            paciente_cedula = paciente.cedula
        except Exception:
            paciente_id = str(uuid.uuid4())
            paciente_cedula = cedula_principal
    else:
        paciente_id = str(uuid.uuid4())
        paciente_cedula = cedula_principal

    appointment_dict = input.model_dump()
    appointment_dict['doctor_nombre'] = doctor['nombre'] if doctor else (input.doctor_nombre or "")
    appointment_dict['paciente_cedula'] = paciente_cedula
    appointment_dict['paciente_id'] = paciente_id

    appointment_obj = Appointment(**appointment_dict)
    doc = appointment_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['detalles'] = []  # asegurar campo limpio

    await db.appointments.insert_one(doc)
    return appointment_obj

@api_router.get("/appointments", response_model=List[Appointment])
async def get_appointments():
    appointments = await db.appointments.find({}, {"_id": 0}).to_list(1000)
    for appointment in appointments:
        if isinstance(appointment['created_at'], str):
            appointment['created_at'] = datetime.fromisoformat(appointment['created_at'])
        if 'estado' not in appointment:
            appointment['estado'] = 'Programada'
    return appointments

@api_router.put("/appointments/{appointment_id}", response_model=Appointment)
async def update_appointment(appointment_id: str, input: AppointmentUpdate):
    existing = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if 'doctor_id' in update_data and update_data['doctor_id']:
        doctor = await db.doctors.find_one({"id": update_data['doctor_id']}, {"_id": 0})
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor no encontrado")
        update_data['doctor_nombre'] = doctor['nombre']
    
    if update_data:
        await db.appointments.update_one({"id": appointment_id}, {"$set": update_data})
    
    updated = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return Appointment(**updated)

@api_router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str):
    result = await db.appointments.delete_one({"id": appointment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return {"message": "Cita eliminada exitosamente"}

# Invoice endpoints  
@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(
    input: InvoiceCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Crea factura con numeración automática. Doctor es opcional."""
    # Leer config clinica para numeración y datos emisor
    cfg_clinica = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    clinica = cfg_clinica.get("valor", {}) if cfg_clinica else {}

    # Auto-numerar si no viene numero_factura
    numero = input.numero_factura if input.numero_factura else await _siguiente_numero_factura(
        clinica.get("establecimiento", "001"),
        clinica.get("punto_emision", "001")
    )

    # Doctor es opcional
    doctor_nombre = input.doctor_nombre or ""
    if input.doctor_id and not doctor_nombre:
        doc_db = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
        if doc_db:
            doctor_nombre = doc_db.get("nombre", "")

    # Calcular totales desde detalles
    detalles_list = [d.model_dump() if hasattr(d, 'model_dump') else d for d in (input.detalles or [])]
    totales = _calcular_totales_factura(detalles_list, input.iva_porcentaje or 0.0)

    # Construir detalles con subtotal calculado
    detalles_final = []
    for d in (input.detalles or []):
        det = d.model_dump() if hasattr(d, 'model_dump') else dict(d)
        det["subtotal"] = round(
            float(det.get("precio_unitario", 0)) * float(det.get("cantidad", 1)) - float(det.get("descuento", 0)), 2
        )
        detalles_final.append(det)

    fecha = input.fecha or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    invoice = Invoice(
        numero_factura=numero,
        emisor_ruc=clinica.get("ruc", ""),
        emisor_razon_social=clinica.get("razon_social", "CENTRO DE ESPECIALIDADES FAMILY HEALTH"),
        emisor_nombre_comercial=clinica.get("nombre_comercial", "FAMILY HEALTH"),
        emisor_direccion=clinica.get("direccion", "Mucho Lote 2 MZ 2833 Villa 15, Guayaquil"),
        emisor_telefono=clinica.get("telefono", "096-291-2170"),
        emisor_email=clinica.get("email", "centrodeespecialidadesfamilyhe@gmail.com"),
        paciente_nombre=input.paciente_nombre,
        paciente_cedula=input.paciente_cedula,
        paciente_direccion=input.paciente_direccion or "",
        paciente_email=input.paciente_email or "",
        paciente_telefono=input.paciente_telefono or "",
        doctor_id=input.doctor_id or "",
        doctor_nombre=doctor_nombre,
        especialidad=input.especialidad or "",
        detalles=detalles_final,
        tipo_pago=input.tipo_pago or "efectivo",
        referencia_pago=input.referencia_pago or "",
        consulta_financiera_id=input.consulta_financiera_id or "",
        appointment_id=input.appointment_id or "",
        numero_autorizacion=input.numero_autorizacion or "",
        observaciones=input.observaciones or "",
        fecha=fecha,
        estado="emitida",
        created_by=current_user.username,
        **totales,
    )

    doc = invoice.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["detalles"] = detalles_final
    await db.invoices.insert_one(doc)
    return invoice

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices():
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    for invoice in invoices:
        if isinstance(invoice['created_at'], str):
            invoice['created_at'] = datetime.fromisoformat(invoice['created_at'])
    return invoices

@api_router.get("/invoices/monthly-totals")
async def get_monthly_totals():
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    monthly_totals = defaultdict(float)
    for invoice in invoices:
        year_month = invoice['fecha'][:7]
        monthly_totals[year_month] += invoice['valor']
    return {"monthly_totals": dict(monthly_totals)}

@api_router.get("/invoices/export")
async def export_invoices():
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Número Factura', 'Paciente', 'Cédula', 'Doctor', 'Especialidad', 'Servicio', 'Valor', 'Fecha', 'Tipo Pago'])
    for invoice in invoices:
        writer.writerow([invoice['numero_factura'], invoice['paciente_nombre'], invoice['paciente_cedula'],
                        invoice['doctor_nombre'], invoice['especialidad'], invoice['servicio'],
                        invoice['valor'], invoice['fecha'], invoice['tipo_pago']])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                           headers={"Content-Disposition": "attachment; filename=facturas_family_health.csv"})

@api_router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, input: InvoiceUpdate):
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if 'doctor_id' in update_data and update_data['doctor_id']:
        doctor = await db.doctors.find_one({"id": update_data['doctor_id']}, {"_id": 0})
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor no encontrado")
        update_data['doctor_nombre'] = doctor['nombre']
    if update_data:
        await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Invoice(**updated)

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return {"message": "Factura eliminada exitosamente"}

# Inventory endpoints
@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(input: InventoryItemCreate):
    item_obj = InventoryItem(**input.model_dump())
    doc = item_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.inventory.insert_one(doc)
    return item_obj

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory():
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    return items

@api_router.get("/inventory/alerts")
async def get_inventory_alerts():
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    alerts = []
    for item in items:
        if item['cantidad'] <= item['stock_minimo']:
            alerts.append({"id": item['id'], "nombre": item['nombre'],
                          "cantidad": item['cantidad'], "stock_minimo": item['stock_minimo']})
    return {"alerts": alerts}

@api_router.put("/inventory/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, input: InventoryItemUpdate):
    existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.inventory.update_one({"id": item_id}, {"$set": update_data})
    updated = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return InventoryItem(**updated)

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str):
    result = await db.inventory.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    return {"message": "Item eliminado exitosamente"}

@api_router.post("/inventory/movements", response_model=InventoryMovement)
async def create_inventory_movement(input: InventoryMovementCreate):
    item = await db.inventory.find_one({"id": input.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    if input.tipo == "entrada":
        new_quantity = item['cantidad'] + input.cantidad
    elif input.tipo == "salida":
        if item['cantidad'] < input.cantidad:
            raise HTTPException(status_code=400, detail="Cantidad insuficiente en inventario")
        new_quantity = item['cantidad'] - input.cantidad
    else:
        raise HTTPException(status_code=400, detail="Tipo inválido")
    
    await db.inventory.update_one({"id": input.item_id}, {"$set": {"cantidad": new_quantity}})
    
    movement_dict = input.model_dump()
    movement_dict['item_nombre'] = item['nombre']
    movement_obj = InventoryMovement(**movement_dict)
    
    doc = movement_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.inventory_movements.insert_one(doc)
    return movement_obj

@api_router.get("/inventory/movements", response_model=List[InventoryMovement])
async def get_inventory_movements():
    movements = await db.inventory_movements.find({}, {"_id": 0}).to_list(1000)
    for movement in movements:
        if isinstance(movement['created_at'], str):
            movement['created_at'] = datetime.fromisoformat(movement['created_at'])
    return movements

# Doctor payment endpoints
@api_router.post("/doctor-payments/calculate")
async def calculate_doctor_payments(input: DoctorPaymentCreate):
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    
    invoices = await db.invoices.find({"doctor_id": input.doctor_id}, {"_id": 0}).to_list(1000)
    total_facturado = 0
    for invoice in invoices:
        invoice_date = invoice['fecha'].split('-')
        if len(invoice_date) >= 2:
            invoice_year = int(invoice_date[0])
            invoice_month = int(invoice_date[1])
            if invoice_year == input.año and invoice_month == input.mes:
                total_facturado += invoice['valor']
    
    porcentaje = doctor.get('porcentaje', 50.0)
    total_pagar = (total_facturado * porcentaje) / 100
    
    existing_payment = await db.doctor_payments.find_one({
        "doctor_id": input.doctor_id, "mes": input.mes, "año": input.año
    }, {"_id": 0})
    
    if existing_payment:
        await db.doctor_payments.update_one(
            {"id": existing_payment['id']},
            {"$set": {"total_facturado": total_facturado, "porcentaje": porcentaje,
                     "total_pagar": total_pagar, "estado": input.estado}}
        )
        existing_payment['total_facturado'] = total_facturado
        existing_payment['porcentaje'] = porcentaje
        existing_payment['total_pagar'] = total_pagar
        existing_payment['estado'] = input.estado
        if isinstance(existing_payment['created_at'], str):
            existing_payment['created_at'] = datetime.fromisoformat(existing_payment['created_at'])
        return DoctorPayment(**existing_payment)
    else:
        payment_obj = DoctorPayment(
            doctor_id=input.doctor_id, doctor_nombre=doctor['nombre'],
            mes=input.mes, año=input.año,
            total_facturado=total_facturado, porcentaje=porcentaje,
            total_pagar=total_pagar, estado=input.estado
        )
        doc = payment_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.doctor_payments.insert_one(doc)
        return payment_obj

@api_router.get("/doctor-payments", response_model=List[DoctorPayment])
async def get_doctor_payments():
    payments = await db.doctor_payments.find({}, {"_id": 0}).to_list(1000)
    for payment in payments:
        if isinstance(payment['created_at'], str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    return payments

@api_router.put("/doctor-payments/{payment_id}", response_model=DoctorPayment)
async def update_doctor_payment(payment_id: str, input: DoctorPaymentUpdate):
    existing = await db.doctor_payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.doctor_payments.update_one({"id": payment_id}, {"$set": update_data})
    updated = await db.doctor_payments.find_one({"id": payment_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return DoctorPayment(**updated)

@api_router.delete("/doctor-payments/{payment_id}")
async def delete_doctor_payment(payment_id: str):
    result = await db.doctor_payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return {"message": "Pago eliminado exitosamente"}

# ========== PROFORMA ENDPOINTS ==========

@api_router.post("/proformas", response_model=Proforma)
async def create_proforma(
    input: ProformaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get doctor info
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    
    # Calculate totals
    subtotal = sum(item.subtotal for item in input.items)
    total = subtotal - input.descuento
    
    proforma_dict = input.model_dump()
    proforma_dict['doctor_nombre'] = doctor['nombre']
    proforma_dict['subtotal'] = subtotal
    proforma_dict['total'] = total
    
    proforma_obj = Proforma(**proforma_dict)
    doc = proforma_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.proformas.insert_one(doc)
    return proforma_obj

@api_router.get("/proformas", response_model=List[Proforma])
async def get_proformas(current_user: TokenData = Depends(get_current_user)):
    proformas = await db.proformas.find({}, {"_id": 0}).to_list(1000)
    for proforma in proformas:
        if isinstance(proforma['created_at'], str):
            proforma['created_at'] = datetime.fromisoformat(proforma['created_at'])
    return proformas

@api_router.get("/proformas/{proforma_id}", response_model=Proforma)
async def get_proforma(
    proforma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    proforma = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")
    
    if isinstance(proforma['created_at'], str):
        proforma['created_at'] = datetime.fromisoformat(proforma['created_at'])
    
    return Proforma(**proforma)

@api_router.put("/proformas/{proforma_id}", response_model=Proforma)
async def update_proforma(
    proforma_id: str,
    input: ProformaUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if update_data:
        await db.proformas.update_one({"id": proforma_id}, {"$set": update_data})
    
    updated = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return Proforma(**updated)

@api_router.delete("/proformas/{proforma_id}")
async def delete_proforma(
    proforma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    result = await db.proformas.delete_one({"id": proforma_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")
    return {"message": "Proforma eliminada exitosamente"}


@api_router.post("/proformas/desde-plan-tratamiento")
async def crear_proforma_desde_plan(
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crear una proforma a partir de procedimientos seleccionados del plan de tratamiento.
    Input esperado:
    {
        "plan_id": "...",
        "procedimiento_ids": ["id1", "id2", ...],  # Si está vacío, usar todos
        "paciente_nombre": "...",
        "paciente_cedula": "...",
        "paciente_telefono": "...",
        "doctor_id": "...",
        "especialidad": "Odontología",
        "observaciones": ""
    }
    """
    plan_id = input.get('plan_id')
    procedimiento_ids = input.get('procedimiento_ids', [])
    
    # Obtener el plan de tratamiento
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de tratamiento no encontrado")
    
    procedimientos = plan.get('procedimientos', [])
    
    # Filtrar procedimientos si se especificaron IDs
    if procedimiento_ids and len(procedimiento_ids) > 0:
        procedimientos = [p for p in procedimientos if p.get('id') in procedimiento_ids]
    
    if not procedimientos:
        raise HTTPException(status_code=400, detail="No hay procedimientos para incluir en la proforma")
    
    # Obtener datos del doctor
    doctor_id = input.get('doctor_id', plan.get('doctor_id', ''))
    doctor_nombre = ""
    especialidad = input.get('especialidad', 'Odontología')
    
    if doctor_id:
        doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
        if doctor:
            doctor_nombre = doctor.get('nombre', '')
            especialidad = doctor.get('especialidad', especialidad)
    
    # Generar número de proforma
    count = await db.proformas.count_documents({})
    numero_proforma = f"PRO-{count + 1:06d}"
    
    # Crear items de la proforma desde los procedimientos
    items = []
    for proc in procedimientos:
        diente = proc.get('diente_numero', '')
        nombre_proc = proc.get('procedimiento', '')
        precio = proc.get('precio', 0)
        
        descripcion = nombre_proc
        if diente:
            descripcion = f"{nombre_proc} - Diente {diente}"
        
        items.append(ProformaItem(
            descripcion=descripcion,
            cantidad=1,
            precio_unitario=precio,
            subtotal=precio
        ))
    
    # Calcular totales
    subtotal = sum(item.subtotal for item in items)
    descuento = input.get('descuento', 0)
    total = subtotal - descuento
    
    # Crear la proforma
    proforma = Proforma(
        numero_proforma=numero_proforma,
        paciente_nombre=input.get('paciente_nombre', plan.get('paciente_nombre', '')),
        paciente_cedula=input.get('paciente_cedula', plan.get('paciente_cedula', '')),
        paciente_telefono=input.get('paciente_telefono', ''),
        doctor_id=doctor_id,
        doctor_nombre=doctor_nombre,
        especialidad=especialidad,
        items=items,
        subtotal=subtotal,
        descuento=descuento,
        total=total,
        fecha_emision=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        validez_dias=input.get('validez_dias', 30),
        observaciones=input.get('observaciones', f"Generada desde Plan de Tratamiento - {plan_id}")
    )
    
    doc = proforma.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.proformas.insert_one(doc)
    
    return {
        "message": "Proforma creada exitosamente",
        "proforma_id": proforma.id,
        "numero_proforma": numero_proforma,
        "total": total,
        "items_count": len(items)
    }


@api_router.get("/proformas/{proforma_id}/pdf")
async def get_proforma_pdf(
    proforma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    from fastapi.responses import Response
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import inch
    from io import BytesIO
    
    proforma = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")
    
    # Crear PDF
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Logo
    try:
        c.drawImage("/app/frontend/public/logo.png", 50, height - 100, width=100, height=50, preserveAspectRatio=True)
    except Exception:
        pass
    
    # Título
    c.setFont("Helvetica-Bold", 20)
    c.drawString(200, height - 70, "PROFORMA")
    
    # Info
    c.setFont("Helvetica", 10)
    y = height - 120
    c.drawString(50, y, f"N°: {proforma['numero_proforma']}")
    c.drawString(50, y-15, f"Fecha: {proforma['fecha_emision']}")
    c.drawString(50, y-30, f"Válida por: {proforma['validez_dias']} días")
    
    # Cliente
    y -= 60
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "CLIENTE:")
    c.setFont("Helvetica", 10)
    c.drawString(50, y-15, proforma['paciente_nombre'])
    c.drawString(50, y-30, f"CI: {proforma['paciente_cedula']}")
    c.drawString(50, y-45, f"Teléfono: {proforma['paciente_telefono']}")
    
    # Items
    y -= 80
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "DESCRIPCIÓN")
    c.drawString(350, y, "CANT.")
    c.drawString(420, y, "P. UNIT")
    c.drawString(500, y, "SUBTOTAL")
    
    c.line(50, y-5, width-50, y-5)
    
    y -= 20
    c.setFont("Helvetica", 10)
    for item in proforma['items']:
        c.drawString(50, y, item['descripcion'][:40])
        c.drawString(350, y, str(item['cantidad']))
        c.drawString(420, y, f"${item['precio_unitario']:.2f}")
        c.drawString(500, y, f"${item['subtotal']:.2f}")
        y -= 15
    
    # Totales
    y -= 10
    c.line(400, y, width-50, y)
    y -= 20
    c.drawString(420, y, "Subtotal:")
    c.drawString(500, y, f"${proforma['subtotal']:.2f}")
    y -= 15
    c.drawString(420, y, "Descuento:")
    c.drawString(500, y, f"-${proforma['descuento']:.2f}")
    y -= 15
    c.setFont("Helvetica-Bold", 12)
    c.drawString(420, y, "TOTAL:")
    c.drawString(500, y, f"${proforma['total']:.2f}")
    
    # Observaciones
    if proforma.get('observaciones'):
        y -= 40
        c.setFont("Helvetica", 9)
        c.drawString(50, y, f"Observaciones: {proforma['observaciones']}")
    
    c.save()
    buffer.seek(0)
    
    return Response(content=buffer.getvalue(), media_type="application/pdf")

# ========== ABONO ENDPOINTS ==========

@api_router.post("/abonos", response_model=Abono)
async def create_abono(
    input: AbonoCreate,
    current_user: TokenData = Depends(get_current_user)
):
    abono_obj = Abono(**input.model_dump())
    doc = abono_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.abonos.insert_one(doc)
    return abono_obj

@api_router.get("/abonos", response_model=List[Abono])
async def get_abonos(current_user: TokenData = Depends(get_current_user)):
    abonos = await db.abonos.find({}, {"_id": 0}).to_list(1000)
    for abono in abonos:
        if isinstance(abono['created_at'], str):
            abono['created_at'] = datetime.fromisoformat(abono['created_at'])
    return abonos

@api_router.get("/abonos/patient/{cedula}", response_model=List[Abono])
async def get_patient_abonos(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    abonos = await db.abonos.find({"paciente_cedula": cedula}, {"_id": 0}).to_list(1000)
    for abono in abonos:
        if isinstance(abono['created_at'], str):
            abono['created_at'] = datetime.fromisoformat(abono['created_at'])
    return abonos

@api_router.put("/abonos/{abono_id}", response_model=Abono)
async def update_abono(
    abono_id: str,
    input: AbonoUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.abonos.find_one({"id": abono_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Abono no encontrado")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if update_data:
        await db.abonos.update_one({"id": abono_id}, {"$set": update_data})
    
    updated = await db.abonos.find_one({"id": abono_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return Abono(**updated)

@api_router.delete("/abonos/{abono_id}")
async def delete_abono(
    abono_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    result = await db.abonos.delete_one({"id": abono_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Abono no encontrado")
    return {"message": "Abono eliminado exitosamente"}

# ========== ODONTOGRAM ENDPOINTS ==========

@api_router.post("/odontograms", response_model=Odontogram)
async def create_odontogram(
    input: OdontogramCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get patient info from appointment
    appointment = await db.appointments.find_one({"id": input.paciente_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Get doctor info
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    
    odontogram_dict = input.model_dump()
    odontogram_dict['paciente_nombre'] = appointment['nombre_completo']
    odontogram_dict['paciente_cedula'] = appointment['cedula']
    odontogram_dict['doctor_nombre'] = doctor['nombre']
    
    odontogram_obj = Odontogram(**odontogram_dict)
    doc = odontogram_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.odontograms.insert_one(doc)
    return odontogram_obj

@api_router.get("/odontograms", response_model=List[Odontogram])
async def get_odontograms(current_user: TokenData = Depends(get_current_user)):
    odontograms = await db.odontograms.find({}, {"_id": 0}).to_list(1000)
    for odontogram in odontograms:
        if isinstance(odontogram['created_at'], str):
            odontogram['created_at'] = datetime.fromisoformat(odontogram['created_at'])
    return odontograms

@api_router.get("/odontograms/patient/{paciente_id}", response_model=List[Odontogram])
async def get_patient_odontograms(
    paciente_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    odontograms = await db.odontograms.find(
        {"paciente_id": paciente_id}, {"_id": 0}
    ).to_list(1000)
    
    for odontogram in odontograms:
        if isinstance(odontogram['created_at'], str):
            odontogram['created_at'] = datetime.fromisoformat(odontogram['created_at'])
    
    return odontograms

@api_router.put("/odontograms/{odontogram_id}", response_model=Odontogram)
async def update_odontogram(
    odontogram_id: str,
    input: OdontogramUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.odontograms.find_one({"id": odontogram_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    if update_data:
        await db.odontograms.update_one({"id": odontogram_id}, {"$set": update_data})
    
    updated = await db.odontograms.find_one({"id": odontogram_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    
    return Odontogram(**updated)

@api_router.delete("/odontograms/{odontogram_id}")
async def delete_odontogram(
    odontogram_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    result = await db.odontograms.delete_one({"id": odontogram_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    return {"message": "Odontograma eliminado exitosamente"}


# ========== ODONTOGRAMA CLÍNICO FDI - NUEVOS ENDPOINTS ==========

def generar_dientes_permanentes():
    """Genera los 32 dientes permanentes con numeración FDI"""
    dientes = []
    
    # Definir superficies estándar
    superficies_posteriores = ["oclusal", "vestibular", "palatino", "mesial", "distal"]
    superficies_anteriores = ["incisal", "vestibular", "palatino", "mesial", "distal"]
    
    # Cuadrante 1: Superior derecho (18-11)
    for pos in range(8, 0, -1):
        numero = f"1{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="permanente",
            cuadrante=1,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies]
        ))
    
    # Cuadrante 2: Superior izquierdo (21-28)
    for pos in range(1, 9):
        numero = f"2{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        # Cambiar palatino a lingual para consistencia
        superficies_adj = [s.replace("palatino", "palatino") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="permanente",
            cuadrante=2,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_adj]
        ))
    
    # Cuadrante 4: Inferior derecho (48-41)
    for pos in range(8, 0, -1):
        numero = f"4{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        # Inferior usa "lingual" en vez de "palatino"
        superficies_inf = [s.replace("palatino", "lingual") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="permanente",
            cuadrante=4,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_inf]
        ))
    
    # Cuadrante 3: Inferior izquierdo (31-38)
    for pos in range(1, 9):
        numero = f"3{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        superficies_inf = [s.replace("palatino", "lingual") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="permanente",
            cuadrante=3,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_inf]
        ))
    
    return dientes


def generar_dientes_temporales():
    """Genera los 20 dientes temporales con numeración FDI"""
    dientes = []
    
    superficies_posteriores = ["oclusal", "vestibular", "palatino", "mesial", "distal"]
    superficies_anteriores = ["incisal", "vestibular", "palatino", "mesial", "distal"]
    
    # Cuadrante 5: Superior derecho temporal (55-51)
    for pos in range(5, 0, -1):
        numero = f"5{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="temporal",
            cuadrante=5,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies]
        ))
    
    # Cuadrante 6: Superior izquierdo temporal (61-65)
    for pos in range(1, 6):
        numero = f"6{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="temporal",
            cuadrante=6,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies]
        ))
    
    # Cuadrante 8: Inferior derecho temporal (85-81)
    for pos in range(5, 0, -1):
        numero = f"8{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        superficies_inf = [s.replace("palatino", "lingual") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="temporal",
            cuadrante=8,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_inf]
        ))
    
    # Cuadrante 7: Inferior izquierdo temporal (71-75)
    for pos in range(1, 6):
        numero = f"7{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        superficies_inf = [s.replace("palatino", "lingual") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="temporal",
            cuadrante=7,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_inf]
        ))
    
    return dientes


@api_router.post("/odontograma-clinico")
async def crear_odontograma_clinico(
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crear nuevo odontograma clínico con soporte FDI.
    Soporta dentición: permanente (32), temporal (20), mixta
    """
    tipo_denticion = input.get('tipo_denticion', 'permanente')
    paciente_id = input.get('paciente_id')
    paciente_cedula = input.get('paciente_cedula', '')
    paciente_nombre = input.get('paciente_nombre', '')
    doctor_id = input.get('doctor_id', '')
    
    # Si no hay paciente_id pero hay cédula, usar la cédula como identificador
    if not paciente_id and paciente_cedula:
        paciente_id = paciente_cedula
    
    if not paciente_id:
        raise HTTPException(status_code=400, detail="paciente_id o paciente_cedula son requeridos")
    
    # Obtener datos del paciente (puede ser de appointments o pacientes)
    # Mantener los valores pasados si existen
    paciente_nombre_input = paciente_nombre
    paciente_cedula_input = paciente_cedula
    
    paciente = await db.appointments.find_one({"id": paciente_id}, {"_id": 0})
    
    if paciente:
        if not paciente_nombre_input:
            paciente_nombre = paciente.get('nombre_completo', '')
        else:
            paciente_nombre = paciente_nombre_input
        if not paciente_cedula_input:
            paciente_cedula = paciente.get('cedula', '')
        else:
            paciente_cedula = paciente_cedula_input
    else:
        # Buscar en colección de pacientes
        paciente = await db.pacientes.find_one({"id": paciente_id}, {"_id": 0})
        if paciente:
            if not paciente_nombre_input:
                paciente_nombre = paciente.get('nombre_completo', '')
            else:
                paciente_nombre = paciente_nombre_input
            if not paciente_cedula_input:
                paciente_cedula = paciente.get('cedula', '')
            else:
                paciente_cedula = paciente_cedula_input
        else:
            # Usar los valores del input si no se encuentra el paciente
            paciente_nombre = paciente_nombre_input
            paciente_cedula = paciente_cedula_input
    
    # Si aún no tenemos cédula, buscar por cédula en appointments
    if not paciente_cedula and paciente_cedula_input:
        paciente_cedula = paciente_cedula_input
        # Buscar appointment por cédula
        apt = await db.appointments.find_one({"cedula": paciente_cedula}, {"_id": 0})
        if apt and not paciente_nombre:
            paciente_nombre = apt.get('nombre_completo', '')
    
    # Obtener datos del doctor
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    doctor_nombre = doctor.get('nombre', '') if doctor else ''
    
    # Generar dientes según tipo de dentición
    if tipo_denticion == 'permanente':
        dientes = generar_dientes_permanentes()
    elif tipo_denticion == 'temporal':
        dientes = generar_dientes_temporales()
    else:  # mixta
        dientes = generar_dientes_permanentes() + generar_dientes_temporales()
    
    # Crear odontograma
    odontograma = OdontogramaClinico(
        paciente_id=paciente_id,
        paciente_nombre=paciente_nombre or input.get('paciente_nombre', ''),
        paciente_cedula=paciente_cedula or input.get('paciente_cedula', ''),
        doctor_id=doctor_id or '',
        doctor_nombre=doctor_nombre,
        tipo_denticion=tipo_denticion,
        fecha=input.get('fecha', datetime.now(timezone.utc).strftime('%Y-%m-%d')),
        dientes=dientes,
        diagnostico_general=input.get('diagnostico_general', ''),
        higiene_oral=input.get('higiene_oral', ''),
        estado_encias=input.get('estado_encias', ''),
        observaciones=input.get('observaciones', '')
    )
    
    # Guardar
    doc = odontograma.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.odontogramas_clinicos.insert_one(doc)
    
    return {
        "message": "Odontograma clínico creado exitosamente",
        "id": odontograma.id,
        "tipo_denticion": tipo_denticion,
        "total_dientes": len(dientes)
    }


@api_router.get("/odontograma-clinico")
async def listar_odontogramas_clinicos(
    current_user: TokenData = Depends(get_current_user)
):
    """Listar todos los odontogramas clínicos"""
    odontogramas = await db.odontogramas_clinicos.find({}, {"_id": 0}).sort("fecha", -1).to_list(500)
    return odontogramas


@api_router.get("/odontograma-clinico/{odontograma_id}")
async def obtener_odontograma_clinico(
    odontograma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener odontograma clínico por ID"""
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    return odontograma


@api_router.get("/odontograma-clinico/paciente/{paciente_id}")
async def obtener_odontogramas_paciente(
    paciente_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener todos los odontogramas de un paciente"""
    odontogramas = await db.odontogramas_clinicos.find(
        {"paciente_id": paciente_id}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    return odontogramas


@api_router.get("/odontograma-clinico/cedula/{cedula}")
async def obtener_odontogramas_por_cedula(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener todos los odontogramas de un paciente por cédula"""
    odontogramas = await db.odontogramas_clinicos.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    return odontogramas


@api_router.put("/odontograma-clinico/{odontograma_id}")
async def actualizar_odontograma_clinico(
    odontograma_id: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar odontograma clínico (dientes, diagnósticos, etc.)"""
    existing = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    
    # Campos permitidos para actualizar
    allowed_fields = [
        'dientes', 'diagnostico_general', 'higiene_oral', 
        'estado_encias', 'oclusion', 'observaciones',
        'indice_cpod', 'indice_ceod', 'tipo_denticion'
    ]
    
    update_data = {k: v for k, v in input.items() if k in allowed_fields and v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    update_data['fecha_actualizacion'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    if update_data:
        await db.odontogramas_clinicos.update_one({"id": odontograma_id}, {"$set": update_data})
    
    updated = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    return updated


@api_router.put("/odontograma-clinico/{odontograma_id}/diente/{numero_fdi}")
async def actualizar_diente(
    odontograma_id: str,
    numero_fdi: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar un diente específico del odontograma"""
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    
    dientes = odontograma.get('dientes', [])
    diente_encontrado = False
    
    for i, diente in enumerate(dientes):
        if diente.get('numero_fdi') == numero_fdi:
            # Actualizar campos del diente
            if 'estado' in input:
                dientes[i]['estado'] = input['estado']
            if 'superficies' in input:
                dientes[i]['superficies'] = input['superficies']
            if 'movilidad' in input:
                dientes[i]['movilidad'] = input['movilidad']
            if 'observaciones' in input:
                dientes[i]['observaciones'] = input['observaciones']
            diente_encontrado = True
            break
    
    if not diente_encontrado:
        raise HTTPException(status_code=404, detail=f"Diente {numero_fdi} no encontrado")
    
    await db.odontogramas_clinicos.update_one(
        {"id": odontograma_id},
        {"$set": {
            "dientes": dientes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d')
        }}
    )
    
    return {"message": f"Diente {numero_fdi} actualizado", "diente": dientes[i]}


@api_router.put("/odontograma-clinico/{odontograma_id}/diente/{numero_fdi}/superficie/{superficie}")
async def actualizar_superficie_diente(
    odontograma_id: str,
    numero_fdi: str,
    superficie: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar una superficie específica de un diente"""
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    
    dientes = odontograma.get('dientes', [])
    actualizado = False
    
    for i, diente in enumerate(dientes):
        if diente.get('numero_fdi') == numero_fdi:
            superficies = diente.get('superficies', [])
            for j, sup in enumerate(superficies):
                if sup.get('nombre') == superficie:
                    if 'diagnostico' in input:
                        dientes[i]['superficies'][j]['diagnostico'] = input['diagnostico']
                    if 'notas' in input:
                        dientes[i]['superficies'][j]['notas'] = input['notas']
                    actualizado = True
                    break
            break
    
    if not actualizado:
        raise HTTPException(status_code=404, detail=f"Superficie {superficie} del diente {numero_fdi} no encontrada")
    
    await db.odontogramas_clinicos.update_one(
        {"id": odontograma_id},
        {"$set": {
            "dientes": dientes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Superficie {superficie} del diente {numero_fdi} actualizada"}


@api_router.delete("/odontograma-clinico/{odontograma_id}")
async def eliminar_odontograma_clinico(
    odontograma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Eliminar odontograma clínico"""
    result = await db.odontogramas_clinicos.delete_one({"id": odontograma_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    return {"message": "Odontograma eliminado exitosamente"}


@api_router.post("/odontograma-clinico/{odontograma_id}/cambiar-denticion")
async def cambiar_tipo_denticion(
    odontograma_id: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Cambiar tipo de dentición del odontograma (regenera dientes)"""
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    
    nuevo_tipo = input.get('tipo_denticion', 'permanente')
    
    # Generar nuevos dientes
    if nuevo_tipo == 'permanente':
        dientes = generar_dientes_permanentes()
    elif nuevo_tipo == 'temporal':
        dientes = generar_dientes_temporales()
    else:
        dientes = generar_dientes_permanentes() + generar_dientes_temporales()
    
    # Convertir a dict
    dientes_dict = [d.model_dump() for d in dientes]
    
    await db.odontogramas_clinicos.update_one(
        {"id": odontograma_id},
        {"$set": {
            "tipo_denticion": nuevo_tipo,
            "dientes": dientes_dict,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": f"Dentición cambiada a {nuevo_tipo}",
        "total_dientes": len(dientes)
    }


# Include router
@api_router.get("/debug/db")
async def debug_db():
    try:
        count = await db.users.count_documents({})
        return {"ok": True, "users": count}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@api_router.get("/debug/dbname")
async def debug_db_name():
    return {"db_name_connected": db.name}


# ========== PLAN DE TRATAMIENTO ENDPOINTS ==========

def clasificar_procedimiento_por_superficies(superficies_afectadas: List[dict]) -> str:
    """
    Clasifica el procedimiento dental según número de superficies afectadas.
    Reglas:
    - 1 superficie → Resina simple
    - 2 superficies → Resina compuesta
    - 3 superficies → Resina compleja
    - 4+ superficies o daño estructural → Corona
    """
    # Contar superficies con diagnóstico diferente de "sano"
    superficies_con_problema = [s for s in superficies_afectadas if s.get('diagnostico', 'sano') != 'sano']
    num_superficies = len(superficies_con_problema)
    
    if num_superficies == 0:
        return None  # No requiere tratamiento
    elif num_superficies == 1:
        return "Resina simple"
    elif num_superficies == 2:
        return "Resina compuesta"
    elif num_superficies == 3:
        return "Resina compleja"
    else:
        return "Corona"


def generar_procedimientos_desde_odontograma(odontograma: dict) -> List[dict]:
    """
    Analiza el odontograma y genera procedimientos sugeridos por diente.
    """
    procedimientos = []
    dientes = odontograma.get('dientes', [])
    
    for diente in dientes:
        numero_fdi = diente.get('numero_fdi', '')
        estado = diente.get('estado', 'presente')
        superficies = diente.get('superficies', [])
        
        # Si el diente está ausente, no generar procedimiento
        if estado in ['ausente', 'exfoliado']:
            continue
        
        # Si está marcado para extracción
        if estado == 'extraccion':
            procedimientos.append({
                'diente_numero': numero_fdi,
                'procedimiento': 'Extracción',
                'descripcion': f'Extracción indicada - diente {numero_fdi}',
                'superficies_afectadas': [],
                'fase': 1
            })
            continue
        
        # Analizar superficies para determinar procedimiento
        superficies_afectadas = []
        tiene_endodoncia = False
        tiene_corona = False
        
        for sup in superficies:
            diagnostico = sup.get('diagnostico', 'sano')
            if diagnostico != 'sano':
                superficies_afectadas.append({
                    'nombre': sup.get('nombre', ''),
                    'diagnostico': diagnostico
                })
                if diagnostico == 'endodoncia':
                    tiene_endodoncia = True
                if diagnostico == 'corona':
                    tiene_corona = True
        
        # Determinar procedimiento
        if tiene_endodoncia:
            procedimientos.append({
                'diente_numero': numero_fdi,
                'procedimiento': 'Endodoncia',
                'descripcion': f'Tratamiento de conducto - diente {numero_fdi}',
                'superficies_afectadas': [s['nombre'] for s in superficies_afectadas],
                'fase': 1
            })
        elif tiene_corona:
            procedimientos.append({
                'diente_numero': numero_fdi,
                'procedimiento': 'Corona',
                'descripcion': f'Corona dental - diente {numero_fdi}',
                'superficies_afectadas': [s['nombre'] for s in superficies_afectadas],
                'fase': 2
            })
        elif len(superficies_afectadas) > 0:
            procedimiento = clasificar_procedimiento_por_superficies(superficies_afectadas)
            if procedimiento:
                nombres_superficies = [s['nombre'] for s in superficies_afectadas]
                procedimientos.append({
                    'diente_numero': numero_fdi,
                    'procedimiento': procedimiento,
                    'descripcion': f'{procedimiento} - diente {numero_fdi} ({", ".join(nombres_superficies)})',
                    'superficies_afectadas': nombres_superficies,
                    'fase': 1
                })
    
    return procedimientos


@api_router.post("/plan-tratamiento")
async def crear_plan_tratamiento(
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Crear nuevo plan de tratamiento para un paciente"""
    paciente_cedula = input.get('paciente_cedula')
    paciente_id = input.get('paciente_id', '')
    paciente_nombre = input.get('paciente_nombre', '')
    doctor_id = input.get('doctor_id', '')
    doctor_nombre = input.get('doctor_nombre', '')
    odontograma_id = input.get('odontograma_id', '')
    
    if not paciente_cedula:
        raise HTTPException(status_code=400, detail="paciente_cedula es requerido")
    
    # Crear plan
    plan = PlanTratamiento(
        paciente_id=paciente_id,
        paciente_cedula=paciente_cedula,
        paciente_nombre=paciente_nombre,
        doctor_id=doctor_id,
        doctor_nombre=doctor_nombre,
        odontograma_id=odontograma_id
    )
    
    doc = plan.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.planes_tratamiento.insert_one(doc)
    
    return {"message": "Plan de tratamiento creado", "id": plan.id}


@api_router.get("/plan-tratamiento/paciente/{cedula}")
async def obtener_plan_por_cedula(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener plan de tratamiento activo de un paciente por cédula"""
    plan = await db.planes_tratamiento.find_one(
        {"paciente_cedula": cedula, "estado": "activo"}, 
        {"_id": 0}
    )
    return plan


@api_router.get("/plan-tratamiento/{plan_id}")
async def obtener_plan_por_id(
    plan_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener plan de tratamiento por ID"""
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    return plan


@api_router.post("/plan-tratamiento/{plan_id}/generar-desde-odontograma/{odontograma_id}")
async def generar_procedimientos_automaticos(
    plan_id: str,
    odontograma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Genera procedimientos automáticamente desde el odontograma.
    Analiza las superficies afectadas y sugiere tratamientos por diente.
    """
    # Obtener plan
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    # Obtener odontograma
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    
    # Generar procedimientos
    procedimientos_sugeridos = generar_procedimientos_desde_odontograma(odontograma)
    
    # Convertir a objetos ProcedimientoDental
    nuevos_procedimientos = []
    for proc_data in procedimientos_sugeridos:
        proc = ProcedimientoDental(
            diente_numero=proc_data['diente_numero'],
            procedimiento=proc_data['procedimiento'],
            descripcion=proc_data['descripcion'],
            fase=proc_data['fase'],
            superficies_afectadas=proc_data['superficies_afectadas']
        )
        nuevos_procedimientos.append(proc.model_dump())
    
    # Actualizar plan
    await db.planes_tratamiento.update_one(
        {"id": plan_id},
        {
            "$set": {
                "procedimientos": nuevos_procedimientos,
                "odontograma_id": odontograma_id,
                "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": "Procedimientos generados",
        "total": len(nuevos_procedimientos),
        "procedimientos": nuevos_procedimientos
    }


@api_router.post("/plan-tratamiento/{plan_id}/procedimiento")
async def agregar_procedimiento(
    plan_id: str,
    proc_input: ProcedimientoCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Agregar procedimiento manualmente al plan"""
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    nuevo_proc = ProcedimientoDental(
        diente_numero=proc_input.diente_numero,
        procedimiento=proc_input.procedimiento,
        descripcion=proc_input.descripcion,
        fase=proc_input.fase,
        precio=proc_input.precio,
        superficies_afectadas=proc_input.superficies_afectadas,
        notas=proc_input.notas
    )
    
    await db.planes_tratamiento.update_one(
        {"id": plan_id},
        {
            "$push": {"procedimientos": nuevo_proc.model_dump()},
            "$set": {
                "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Procedimiento agregado", "procedimiento": nuevo_proc.model_dump()}


@api_router.put("/plan-tratamiento/{plan_id}/procedimiento/{procedimiento_id}")
async def actualizar_procedimiento(
    plan_id: str,
    procedimiento_id: str,
    proc_update: ProcedimientoUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar un procedimiento del plan"""
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    procedimientos = plan.get('procedimientos', [])
    actualizado = False
    
    for i, proc in enumerate(procedimientos):
        if proc.get('id') == procedimiento_id:
            for key, value in proc_update.model_dump(exclude_unset=True).items():
                if value is not None:
                    procedimientos[i][key] = value
            if proc_update.estado == 'realizado':
                procedimientos[i]['fecha_realizado'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            actualizado = True
            break
    
    if not actualizado:
        raise HTTPException(status_code=404, detail="Procedimiento no encontrado")
    
    await db.planes_tratamiento.update_one(
        {"id": plan_id},
        {
            "$set": {
                "procedimientos": procedimientos,
                "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Procedimiento actualizado"}


@api_router.delete("/plan-tratamiento/{plan_id}/procedimiento/{procedimiento_id}")
async def eliminar_procedimiento(
    plan_id: str,
    procedimiento_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Eliminar un procedimiento del plan"""
    result = await db.planes_tratamiento.update_one(
        {"id": plan_id},
        {
            "$pull": {"procedimientos": {"id": procedimiento_id}},
            "$set": {
                "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Procedimiento no encontrado")
    
    return {"message": "Procedimiento eliminado"}


@api_router.put("/plan-tratamiento/{plan_id}/organizar-fases")
async def organizar_fases(
    plan_id: str,
    fases_input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Reorganizar procedimientos en fases.
    Input: { "procedimiento_id": fase_numero, ... }
    """
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    cambios_fase = fases_input.get('cambios', {})
    procedimientos = plan.get('procedimientos', [])
    
    for i, proc in enumerate(procedimientos):
        proc_id = proc.get('id')
        if proc_id in cambios_fase:
            procedimientos[i]['fase'] = cambios_fase[proc_id]
    
    await db.planes_tratamiento.update_one(
        {"id": plan_id},
        {
            "$set": {
                "procedimientos": procedimientos,
                "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Fases reorganizadas"}


# Include API router
app.include_router(api_router)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ========== FACTURACIÓN ELECTRÓNICA SRI ==========

@api_router.post("/sri/configurar-firma")
async def configurar_firma_electronica(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo el Administrador puede configurar la firma")
    p12_b64 = data.get("p12_base64", "")
    password = data.get("password", "")
    ambiente = data.get("ambiente", "produccion")
    if not p12_b64 or not password:
        raise HTTPException(status_code=400, detail="Se requiere el archivo .p12 y la contraseña")
    import base64
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.hazmat.backends import default_backend
    try:
        p12_bytes = base64.b64decode(p12_b64)
        pk, cert, chain = pkcs12.load_key_and_certificates(p12_bytes, password.encode(), default_backend())
        titular = cert.subject.rfc4514_string()
        valido_hasta = cert.not_valid_after_utc.strftime("%Y-%m-%d")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Certificado inválido o contraseña incorrecta: {e}")
    await db.configuracion.update_one(
        {"clave": "firma_electronica"},
        {"$set": {"clave": "firma_electronica", "valor": {"p12_base64": p12_b64, "password": password, "ambiente": ambiente, "titular": titular, "valido_hasta": valido_hasta}, "actualizado": datetime.now(timezone.utc).isoformat(), "actualizado_por": current_user.username}},
        upsert=True
    )
    return {"ok": True, "titular": titular, "valido_hasta": valido_hasta, "ambiente": ambiente, "mensaje": f"✅ Certificado configurado correctamente"}


@api_router.get("/sri/configuracion")
async def get_sri_configuracion(current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    cfg = await db.configuracion.find_one({"clave": "firma_electronica"}, {"_id": 0})
    if not cfg or not cfg.get("valor"):
        return {"configurado": False}
    val = cfg["valor"]
    return {"configurado": True, "titular": val.get("titular", ""), "valido_hasta": val.get("valido_hasta", ""), "ambiente": val.get("ambiente", "produccion"), "actualizado": cfg.get("actualizado", "")}


@api_router.post("/sri/emitir/{invoice_id}")
async def emitir_factura_sri(invoice_id: str, current_user: TokenData = Depends(get_current_user)):
    from sri_facturacion import generar_clave_acceso, generar_xml_factura, firmar_xml, enviar_al_sri, autorizar_en_sri, get_p12_desde_mongo
    import base64, asyncio
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if invoice.get("estado") == "anulada":
        raise HTTPException(status_code=400, detail="No se puede emitir una factura anulada")
    if invoice.get("sri_estado") == "AUTORIZADO":
        raise HTTPException(status_code=400, detail="Esta factura ya fue autorizada por el SRI")
    p12_bytes, password, ambiente = await get_p12_desde_mongo(db)
    if not p12_bytes:
        raise HTTPException(status_code=503, detail="Certificado .p12 no configurado. Ve a Admin → Config. SRI")
    cfg_clinica = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    clinica = cfg_clinica.get("valor", {}) if cfg_clinica else {}
    ruc = clinica.get("ruc", invoice.get("emisor_ruc", ""))
    if not ruc:
        raise HTTPException(status_code=400, detail="RUC no configurado. Ve a Facturación → Config. Clínica")
    partes = invoice.get("numero_factura", "001-001-000000001").split("-")
    est = partes[0] if len(partes) > 0 else "001"
    pto = partes[1] if len(partes) > 1 else "001"
    seq = partes[2] if len(partes) > 2 else "000000001"
    serie = est + pto
    fecha_raw = invoice.get("fecha", datetime.now().strftime("%Y-%m-%d"))
    try:
        from datetime import datetime as dt2
        fecha_str = dt2.strptime(fecha_raw, "%Y-%m-%d").strftime("%d/%m/%Y")
    except:
        fecha_str = datetime.now().strftime("%d/%m/%Y")
    amb_codigo = "1" if ambiente == "pruebas" else "2"
    clave_acceso = generar_clave_acceso(fecha_str, "01", ruc, amb_codigo, serie, seq)
    invoice_completo = {**invoice, "emisor_ruc": ruc}
    try:
        xml_bytes = generar_xml_factura(invoice_completo, clave_acceso, amb_codigo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando XML: {e}")
    try:
        xml_firmado = firmar_xml(xml_bytes, p12_bytes, password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error firmando XML: {e}")
    xml_b64 = base64.b64encode(xml_firmado).decode()
    resultado_envio = await enviar_al_sri(xml_firmado, ambiente)
    resultado_autorizacion = {"ok": False, "estado": "PENDIENTE"}
    if resultado_envio.get("ok"):
        await asyncio.sleep(2)
        resultado_autorizacion = await autorizar_en_sri(clave_acceso, ambiente)
    update_data = {"clave_acceso": clave_acceso, "sri_estado_envio": resultado_envio.get("estado", "ERROR"), "sri_mensaje_envio": resultado_envio.get("mensaje", ""), "sri_xml_b64": xml_b64, "sri_ambiente": ambiente, "sri_fecha_envio": datetime.now(timezone.utc).isoformat()}
    if resultado_autorizacion.get("ok"):
        update_data["sri_estado"] = "AUTORIZADO"
        update_data["numero_autorizacion"] = resultado_autorizacion.get("numero_autorizacion", clave_acceso)
        update_data["fecha_autorizacion"] = resultado_autorizacion.get("fecha_autorizacion", "")
    else:
        update_data["sri_estado"] = resultado_envio.get("estado", "ERROR")
        update_data["sri_mensaje"] = resultado_envio.get("mensaje", "")
    await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    return {"ok": resultado_autorizacion.get("ok") or resultado_envio.get("ok"), "clave_acceso": clave_acceso, "sri_estado": update_data.get("sri_estado"), "numero_autorizacion": update_data.get("numero_autorizacion", ""), "envio": resultado_envio, "autorizacion": resultado_autorizacion}


@api_router.get("/sri/estado/{invoice_id}")
async def consultar_estado_sri(invoice_id: str, current_user: TokenData = Depends(get_current_user)):
    from sri_facturacion import autorizar_en_sri, get_p12_desde_mongo
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    clave = invoice.get("clave_acceso", "")
    if not clave:
        raise HTTPException(status_code=400, detail="Esta factura no tiene clave de acceso SRI")
    _, _, ambiente = await get_p12_desde_mongo(db)
    resultado = await autorizar_en_sri(clave, ambiente)
    if resultado.get("ok"):
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"sri_estado": "AUTORIZADO", "numero_autorizacion": resultado.get("numero_autorizacion", clave), "fecha_autorizacion": resultado.get("fecha_autorizacion", "")}})
    return resultado


@api_router.get("/sri/descargar-xml/{invoice_id}")
async def descargar_xml_sri(invoice_id: str, current_user: TokenData = Depends(get_current_user)):
    import base64
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice or not invoice.get("sri_xml_b64"):
        raise HTTPException(status_code=404, detail="XML no disponible para esta factura")
    xml_bytes = base64.b64decode(invoice["sri_xml_b64"])
    numero = invoice.get("numero_factura", "factura").replace("-", "_")
    return StreamingResponse(iter([xml_bytes]), media_type="application/xml", headers={"Content-Disposition": f"attachment; filename=factura_{numero}.xml"})


# ========== CORREO ELECTRÓNICO ==========

@api_router.post("/sri/enviar-ride/{invoice_id}")
async def enviar_ride_por_correo(invoice_id: str, data: dict = {}, current_user: TokenData = Depends(get_current_user)):
    import smtplib, base64
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
    from pdf_generator import generate_factura_pdf
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    email_destino = data.get("email") or invoice.get("paciente_email", "")
    if not email_destino:
        raise HTTPException(status_code=400, detail="No hay email del paciente")
    cfg_email = await db.configuracion.find_one({"clave": "email_config"}, {"_id": 0})
    if not cfg_email or not cfg_email.get("valor"):
        raise HTTPException(status_code=503, detail="Correo no configurado. Ve a Admin → Config. SRI → sección Gmail")
    email_cfg = cfg_email["valor"]
    smtp_user = email_cfg.get("email", "")
    smtp_pass = email_cfg.get("app_password", "")
    if not smtp_user or not smtp_pass:
        raise HTTPException(status_code=503, detail="Configuración de correo incompleta")
    pdf_buffer = generate_factura_pdf(invoice)
    pdf_bytes = pdf_buffer.read()
    numero_factura = invoice.get("numero_factura", "")
    autorizacion = invoice.get("numero_autorizacion", "")
    sri_estado = invoice.get("sri_estado", "pendiente")
    msg = MIMEMultipart()
    msg["From"] = f"Family Health <{smtp_user}>"
    msg["To"] = email_destino
    msg["Subject"] = f"Factura {numero_factura} - Family Health"
    estado_texto = f"✅ Autorizada por el SRI — N°: {autorizacion}" if sri_estado == "AUTORIZADO" else "⏳ Pendiente de autorización SRI"
    cuerpo = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<div style="background:linear-gradient(135deg,#005f73,#00a8cc);padding:20px;border-radius:10px 10px 0 0;text-align:center">
<h2 style="color:white;margin:0">🧾 Factura Electrónica</h2>
<p style="color:rgba(255,255,255,0.8);margin:5px 0 0">Centro de Especialidades Family Health</p></div>
<div style="background:#f8fdff;padding:20px;border:1px solid #e0f7fa">
<p>Estimado/a <strong>{invoice.get("paciente_nombre","Paciente")}</strong>,</p>
<p>Adjuntamos su comprobante de atención médica.</p>
<div style="background:white;border:1px solid #b2ebf2;border-radius:8px;padding:15px;margin:15px 0">
<table style="width:100%;font-size:14px">
<tr><td style="color:#666">N° Factura:</td><td><strong>{numero_factura}</strong></td></tr>
<tr><td style="color:#666">Fecha:</td><td>{invoice.get("fecha","")}</td></tr>
<tr><td style="color:#666">Doctor:</td><td>{invoice.get("doctor_nombre","")} — {invoice.get("especialidad","")}</td></tr>
<tr><td style="color:#666">Total:</td><td><strong style="color:#005f73">${invoice.get("total",0):.2f}</strong></td></tr>
<tr><td style="color:#666">Estado SRI:</td><td>{estado_texto}</td></tr>
</table></div>
<p style="color:#555;font-size:13px">Los servicios médicos están exentos de IVA según la Ley de Régimen Tributario Interno del Ecuador.</p>
</div>
<div style="background:#005f73;padding:15px;border-radius:0 0 10px 10px;text-align:center">
<p style="color:white;margin:0;font-size:13px">Family Health | Mucho Lote 2 MZ 2833 Villa 15, Guayaquil | 096-291-2170</p>
</div></body></html>"""
    msg.attach(MIMEText(cuerpo, "html"))
    part = MIMEBase("application", "octet-stream")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f"attachment; filename=factura_{numero_factura.replace('-','_')}.pdf")
    msg.attach(part)
    if invoice.get("sri_xml_b64") and sri_estado == "AUTORIZADO":
        xml_bytes = base64.b64decode(invoice["sri_xml_b64"])
        part_xml = MIMEBase("application", "xml")
        part_xml.set_payload(xml_bytes)
        encoders.encode_base64(part_xml)
        part_xml.add_header("Content-Disposition", f"attachment; filename=factura_{numero_factura.replace('-','_')}.xml")
        msg.attach(part_xml)
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"ride_enviado_a": email_destino, "ride_enviado_fecha": datetime.now(timezone.utc).isoformat()}})
        return {"ok": True, "mensaje": f"✅ Factura enviada a {email_destino}"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="Error de autenticación Gmail. Usa una App Password de 16 caracteres.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar correo: {e}")


@api_router.post("/configuracion/email")
async def save_config_email(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.update_one({"clave": "email_config"}, {"$set": {"clave": "email_config", "valor": {"email": data.get("email",""), "app_password": data.get("app_password",""), "nombre": data.get("nombre","Family Health")}, "actualizado": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"ok": True, "mensaje": "✅ Configuración de correo guardada"}


@api_router.get("/configuracion/email")
async def get_config_email(current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    cfg = await db.configuracion.find_one({"clave": "email_config"}, {"_id": 0})
    if not cfg or not cfg.get("valor"):
        return {"configurado": False}
    val = cfg["valor"]
    return {"configurado": bool(val.get("email") and val.get("app_password")), "email": val.get("email",""), "nombre": val.get("nombre","Family Health")}


# ========== CONFIGURACIÓN CLÍNICA ==========

@api_router.post("/configuracion/clinica")
async def save_config_clinica(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.update_one({"clave": "clinica_config"}, {"$set": {"clave": "clinica_config", "valor": data, "actualizado": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"ok": True}


@api_router.get("/configuracion/clinica")
async def get_config_clinica(current_user: TokenData = Depends(get_current_user)):
    cfg = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    return cfg.get("valor", {}) if cfg else {}


# ========== IA MÉDICA — GEMINI FLASH ==========

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

async def get_gemini_key() -> str:
    try:
        cfg = await db.configuracion.find_one({"clave": "gemini_api_key"}, {"_id": 0})
        if cfg and cfg.get("valor"): return cfg["valor"]
    except: pass
    return os.environ.get("GEMINI_API_KEY", "")


@api_router.post("/ia/consulta-medica")
async def consulta_ia_medica(data: dict, current_user: TokenData = Depends(get_current_user)):
    GEMINI_API_KEY = await get_gemini_key()
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="IA no configurada. Ve a Admin → Config. IA y guarda tu API key de Gemini.")
    mensaje = data.get("mensaje", "").strip()
    especialidad = data.get("especialidad", "Medicina General")
    ctx = data.get("contexto_paciente", {})
    historial = data.get("historial", [])
    if not mensaje:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")
    contexto_str = f"PACIENTE: {ctx.get('nombre','?')}, {ctx.get('edad','?')} años, {ctx.get('sexo','')}, Especialidad: {especialidad}, Motivo: {ctx.get('motivo_consulta','?')}, Antecedentes: {ctx.get('antecedentes','Sin antecedentes')}, Alergias: {ctx.get('alergias','Ninguna')}"
    system_prompt = "Eres un asistente médico de apoyo clínico para Family Health, Guayaquil, Ecuador. Responde en español, conciso y clínico. Provee diagnósticos diferenciales con CIE-10, tratamientos con dosis, signos de alarma. Siempre aclara que tus sugerencias requieren validación del médico tratante."
    contents = [
        {"role": "user", "parts": [{"text": system_prompt + "\n\n" + contexto_str}]},
        {"role": "model", "parts": [{"text": "Entendido. ¿En qué puedo apoyar al médico?"}]},
    ]
    for h in historial[-10:]:
        contents.append({"role": "user" if h.get("rol") == "user" else "model", "parts": [{"text": h.get("texto", "")}]})
    contents.append({"role": "user", "parts": [{"text": mensaje}]})
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json={"contents": contents, "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800, "topP": 0.8}, "safetySettings": [{"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}, {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"}]}, headers={"Content-Type": "application/json"})
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Error Gemini API: {response.status_code}")
        result = response.json()
        return {"respuesta": result["candidates"][0]["content"]["parts"][0]["text"], "modelo": "gemini-flash-latest"}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout — Gemini tardó demasiado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error IA: {str(e)}")


@api_router.get("/configuracion/ia")
async def get_config_ia(current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    cfg = await db.configuracion.find_one({"clave": "gemini_api_key"}, {"_id": 0})
    tiene_key = bool(cfg and cfg.get("valor"))
    key_preview = ""
    if tiene_key:
        val = cfg["valor"]
        key_preview = val[:8] + "..." + val[-4:]
    return {"configurada": tiene_key, "key_preview": key_preview, "modelo": "gemini-flash-latest", "actualizado": cfg.get("actualizado","") if cfg else ""}


@api_router.post("/configuracion/ia")
async def save_config_ia(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    api_key = data.get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="La API key no puede estar vacía")
    if not api_key.startswith("AIza"):
        raise HTTPException(status_code=400, detail="API key inválida — debe empezar con 'AIza'")
    await db.configuracion.update_one({"clave": "gemini_api_key"}, {"$set": {"clave": "gemini_api_key", "valor": api_key, "actualizado": datetime.now(timezone.utc).isoformat(), "actualizado_por": current_user.username}}, upsert=True)
    return {"ok": True, "mensaje": "✅ API key guardada correctamente"}


@api_router.delete("/configuracion/ia")
async def delete_config_ia(current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.delete_one({"clave": "gemini_api_key"})
    return {"ok": True, "mensaje": "API key eliminada"}


# ========== EGRESOS DE CAJA ==========

@api_router.post("/caja/egresos")
async def registrar_egreso(data: dict, current_user: TokenData = Depends(get_current_user)):
    egreso = {"id": str(uuid.uuid4()), "concepto": data.get("concepto",""), "monto": float(data.get("monto",0)), "tipo": data.get("tipo","otro"), "referencia": data.get("referencia",""), "fecha": data.get("fecha", datetime.now(timezone.utc).strftime("%Y-%m-%d")), "notas": data.get("notas",""), "registrado_por": current_user.username, "created_at": datetime.now(timezone.utc).isoformat()}
    if egreso["monto"] <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
    await db.egresos_caja.insert_one(egreso)
    egreso.pop("_id", None)
    return egreso


@api_router.get("/caja/egresos")
async def get_egresos(fecha: Optional[str] = None, fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None, current_user: TokenData = Depends(get_current_user)):
    query = {}
    if fecha: query["fecha"] = fecha
    elif fecha_inicio and fecha_fin: query["fecha"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    egresos = await db.egresos_caja.find(query, {"_id": 0}).sort("fecha", -1).to_list(1000)
    return {"egresos": egresos, "total": round(sum(e.get("monto",0) for e in egresos), 2)}


@api_router.delete("/caja/egresos/{egreso_id}")
async def delete_egreso(egreso_id: str, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador puede eliminar egresos")
    result = await db.egresos_caja.delete_one({"id": egreso_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    return {"ok": True}


# ========== PAGO A DOCTORES ==========

@api_router.get("/doctor-payments/calcular")
async def calcular_pago_doctor(doctor_id: Optional[str] = None, fecha_inicio: Optional[str] = None, fecha_fin: Optional[str] = None, current_user: TokenData = Depends(get_current_user)):
    from datetime import date as date_type
    fi = fecha_inicio or date_type.today().replace(day=1).isoformat()
    ff = fecha_fin or date_type.today().isoformat()
    query = {"fecha": {"$gte": fi, "$lte": ff}}
    if doctor_id: query["doctor_id"] = doctor_id
    consultas = await db.consultas_financieras.find(query, {"_id": 0}).to_list(5000)
    doctores_db = {d["id"]: d for d in await db.doctors.find({}, {"_id": 0}).to_list(500)}
    resumen = {}
    for c in consultas:
        did = c.get("doctor_id","")
        cobrado = c.get("total_pagado", 0)
        if cobrado <= 0: continue
        if did not in resumen:
            pct = doctores_db.get(did, {}).get("porcentaje", 50.0) if did else 50.0
            resumen[did] = {"doctor_id": did, "doctor_nombre": c.get("doctor_nombre","Sin Doctor"), "especialidad": doctores_db.get(did,{}).get("especialidad",""), "porcentaje": pct, "total_cobrado": 0, "ganancia_doctor": 0, "ganancia_clinica": 0, "num_consultas": 0, "consultas": []}
        resumen[did]["total_cobrado"] += cobrado
        resumen[did]["num_consultas"] += 1
        resumen[did]["consultas"].append({"fecha": c.get("fecha",""), "paciente": c.get("paciente_nombre",""), "monto": cobrado})
    for did in resumen:
        tc = resumen[did]["total_cobrado"]
        pct = resumen[did]["porcentaje"]
        resumen[did]["ganancia_doctor"] = round(tc * pct / 100, 2)
        resumen[did]["ganancia_clinica"] = round(tc * (100 - pct) / 100, 2)
        resumen[did]["total_cobrado"] = round(tc, 2)
    resultado = sorted(resumen.values(), key=lambda x: x["total_cobrado"], reverse=True)
    return {"fecha_inicio": fi, "fecha_fin": ff, "doctores": resultado, "total_cobrado": round(sum(r["total_cobrado"] for r in resultado), 2), "total_pagar_doctores": round(sum(r["ganancia_doctor"] for r in resultado), 2), "total_clinica": round(sum(r["ganancia_clinica"] for r in resultado), 2)}


@api_router.post("/doctor-payments/registrar")
async def registrar_pago_doctor(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role not in ("Administrador", "Recepcion"):
        raise HTTPException(status_code=403, detail="Sin permiso")
    monto = float(data.get("monto", 0))
    if monto <= 0:
        raise HTTPException(status_code=400, detail="Monto debe ser mayor a 0")
    pago = {"id": str(uuid.uuid4()), "doctor_id": data.get("doctor_id",""), "doctor_nombre": data.get("doctor_nombre",""), "monto": monto, "fecha_inicio_periodo": data.get("fecha_inicio",""), "fecha_fin_periodo": data.get("fecha_fin",""), "forma_pago": data.get("forma_pago","efectivo"), "referencia": data.get("referencia",""), "notas": data.get("notas",""), "registrado_por": current_user.username, "fecha_pago": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.pagos_doctores.insert_one(pago)
    pago.pop("_id", None)
    # Registrar como egreso de caja automáticamente
    egreso = {"id": str(uuid.uuid4()), "concepto": f"Pago Dr/Dra. {data.get('doctor_nombre','')} — período {data.get('fecha_inicio','')} al {data.get('fecha_fin','')}", "monto": monto, "tipo": "nomina", "referencia": data.get("referencia",""), "fecha": datetime.now(timezone.utc).strftime("%Y-%m-%d"), "notas": data.get("notas",""), "registrado_por": current_user.username, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.egresos_caja.insert_one(egreso)
    return {"ok": True, "pago": pago}


@api_router.get("/doctor-payments/historial")
async def historial_pagos_doctores(doctor_id: Optional[str] = None, current_user: TokenData = Depends(get_current_user)):
    query = {}
    if doctor_id: query["doctor_id"] = doctor_id
    pagos = await db.pagos_doctores.find(query, {"_id": 0}).sort("fecha_pago", -1).to_list(1000)
    return pagos


# ========== FACTURACIÓN — NUEVOS ENDPOINTS ==========

async def _siguiente_numero_factura(establecimiento="001", punto_emision="001"):
    last = await db.invoices.find_one({"numero_factura": {"$regex": f"^{establecimiento}-{punto_emision}-"}}, {"_id": 0, "numero_factura": 1}, sort=[("numero_factura", -1)])
    if last:
        try: seq = int(last["numero_factura"].split("-")[-1]) + 1
        except: seq = 1
    else:
        seq = 1
    return f"{establecimiento}-{punto_emision}-{str(seq).zfill(9)}"


def _calcular_totales_factura(detalles, iva_pct=0.0):
    subtotal = sum(float(d.get("precio_unitario",0))*float(d.get("cantidad",1)) for d in detalles)
    desc = sum(float(d.get("descuento",0)) for d in detalles)
    sub_desc = subtotal - desc
    iva_val = round(sub_desc * iva_pct / 100, 2)
    return {"subtotal": round(subtotal,2), "descuento_total": round(desc,2), "subtotal_con_descuento": round(sub_desc,2), "iva_porcentaje": iva_pct, "iva_valor": iva_val, "total": round(sub_desc + iva_val, 2)}


@api_router.get("/invoices/stats")
async def get_invoice_stats(current_user: TokenData = Depends(get_current_user)):
    from datetime import date
    hoy = date.today().isoformat()
    mes = hoy[:7]
    all_inv = await db.invoices.find({"estado": {"$ne": "anulada"}}, {"_id": 0}).to_list(5000)
    return {"total_hoy": round(sum(i.get("total",0) for i in all_inv if i.get("fecha","") == hoy), 2), "total_mes": round(sum(i.get("total",0) for i in all_inv if i.get("fecha","")[:7] == mes), 2), "total_general": round(sum(i.get("total",0) for i in all_inv), 2), "num_facturas_hoy": sum(1 for i in all_inv if i.get("fecha","") == hoy), "num_facturas_mes": sum(1 for i in all_inv if i.get("fecha","")[:7] == mes), "num_facturas_total": len(all_inv)}


@api_router.post("/invoices/{invoice_id}/anular")
async def anular_invoice(invoice_id: str, data: dict, current_user: TokenData = Depends(get_current_user)):
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if existing.get("estado") == "anulada":
        raise HTTPException(status_code=400, detail="La factura ya está anulada")
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"estado": "anulada", "observaciones": data.get("motivo","Anulada") + " | " + existing.get("observaciones",""), "anulada_por": current_user.username, "fecha_anulacion": datetime.now(timezone.utc).strftime("%Y-%m-%d")}})
    return {"ok": True, "mensaje": "Factura anulada correctamente"}


@api_router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str, current_user: TokenData = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    from pdf_generator import generate_factura_pdf
    pdf_buffer = generate_factura_pdf(inv)
    filename = f"factura_{inv.get('numero_factura','').replace('-','_')}.pdf"
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename={filename}"})


# ========== ADMIN MIGRACIÓN EDADES ==========

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Registrar router financiero
app.include_router(financial_router, prefix="/api")
    
import os
import uvicorn


# ========== PROCEDIMIENTOS RAPIDOS ==========

@api_router.post("/procedimientos-rapidos")
async def crear_procedimiento_rapido(data: dict, current_user: TokenData = Depends(get_current_user)):
    proc = {
        "id": str(uuid.uuid4()),
        "paciente_cedula": data.get("paciente_cedula", ""),
        "paciente_nombre": data.get("paciente_nombre", ""),
        "paciente_telefono": data.get("paciente_telefono", ""),
        "procedimientos": data.get("procedimientos", []),
        "aplicado_por": data.get("aplicado_por", ""),
        "prescripcion_externa": data.get("prescripcion_externa", ""),
        "consentimiento_verbal": data.get("consentimiento_verbal", True),
        "observaciones": data.get("observaciones", ""),
        "tipo_pago": data.get("tipo_pago", "efectivo"),
        "total": float(data.get("total", 0)),
        "fecha": data.get("fecha", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "hora": data.get("hora", datetime.now(timezone.utc).strftime("%H:%M")),
        "usuario": current_user.username,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if not proc["paciente_nombre"]:
        raise HTTPException(status_code=400, detail="Nombre del paciente es obligatorio")
    if not proc["procedimientos"]:
        raise HTTPException(status_code=400, detail="Agrega al menos un procedimiento")
    await db.procedimientos_rapidos.insert_one(proc)
    proc.pop("_id", None)
    # Registrar como ingreso en caja
    await db.consultas_financieras.insert_one({
        "id": str(uuid.uuid4()), "tipo": "procedimiento_rapido",
        "paciente_cedula": proc["paciente_cedula"], "paciente_nombre": proc["paciente_nombre"],
        "doctor_nombre": proc["aplicado_por"], "doctor_id": "",
        "especialidad": "Procedimiento Rapido", "servicios": proc["procedimientos"],
        "total": proc["total"], "total_pagado": proc["total"], "saldo": 0,
        "estado_pago": "pagado", "tipo_pago": proc["tipo_pago"], "fecha": proc["fecha"],
        "pagos": [{"monto": proc["total"], "tipo_pago": proc["tipo_pago"],
                   "fecha": proc["fecha"], "recibido_por": current_user.username}],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return proc


@api_router.get("/procedimientos-rapidos")
async def get_procedimientos_rapidos(
    paciente_cedula: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    query = {}
    if paciente_cedula: query["paciente_cedula"] = paciente_cedula
    procs = await db.procedimientos_rapidos.find(query, {"_id": 0}).sort("fecha", -1).to_list(500)
    return procs


# ========== LABORATORIO EXTERNO ==========

@api_router.post("/configuracion/laboratorio")
async def save_config_laboratorio(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.update_one(
        {"clave": "laboratorio_externo"},
        {"$set": {"clave": "laboratorio_externo", "valor": {"nombre": data.get("nombre", "Laboratorio"), "link": data.get("link", ""), "notas": data.get("notas", "")}, "actualizado": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"ok": True}


@api_router.get("/configuracion/laboratorio")
async def get_config_laboratorio(current_user: TokenData = Depends(get_current_user)):
    cfg = await db.configuracion.find_one({"clave": "laboratorio_externo"}, {"_id": 0})
    return cfg.get("valor", {}) if cfg else {}


@api_router.post("/laboratorio/envio")
async def registrar_envio_laboratorio(data: dict, current_user: TokenData = Depends(get_current_user)):
    envio = {
        "id": str(uuid.uuid4()),
        "paciente_cedula": data.get("paciente_cedula", ""),
        "paciente_nombre": data.get("paciente_nombre", ""),
        "appointment_id": data.get("appointment_id", ""),
        "examenes": data.get("examenes", ""),
        "fecha_envio": data.get("fecha_envio", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "fecha_resultado_estimada": data.get("fecha_resultado_estimada", ""),
        "enviado_por": current_user.username,
        "notas": data.get("notas", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.laboratorio_envios.insert_one(envio)
    envio.pop("_id", None)
    return envio


@api_router.get("/laboratorio/envios")
async def get_envios_laboratorio(
    paciente_cedula: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    query = {}
    if paciente_cedula: query["paciente_cedula"] = paciente_cedula
    envios = await db.laboratorio_envios.find(query, {"_id": 0}).sort("fecha_envio", -1).to_list(200)
    return envios

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
