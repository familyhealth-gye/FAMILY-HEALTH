from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from typing import List
import io
import csv
from collections import defaultdict
from datetime import datetime, timezone

# Importar módulo financiero
from financial_routes import financial_router, unificar_paciente_por_cedula

app = FastAPI(title="Family Health API", description="Sistema Clínico Multiespecialidad SaaS", version="2.0")

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
    MedicalHistoryOdontology, MedicalHistoryOdontologyCreate, EstadoDental
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_role, Token, TokenData, UserLogin
)
from pdf_generator import generate_prescription_pdf

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
            "nombre": user.get("nombre")
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
    """Crear especialidades iniciales"""
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
    
    # Limpiar existentes
    await db.especialidades.delete_many({})
    
    created = []
    for esp_data in especialidades_base:
        esp_obj = Especialidad(**esp_data, activa=True)
        doc = esp_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.especialidades.insert_one(doc)
        created.append(esp_data['nombre'])
    
    return {"message": f"Creadas {len(created)} especialidades", "especialidades": created}

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
    history_dict['paciente_edad'] = appointment['edad']
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
    history_dict['paciente_edad'] = appointment['edad']
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
    history_dict['paciente_edad'] = appointment['edad']
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
    appointment = None
    if input.appointment_id:
        appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment and input.paciente_id:
        appointment = await db.appointments.find_one({"id": input.paciente_id}, {"_id": 0})
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita/Paciente no encontrado")
    
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
    prescription_dict['paciente_edad'] = appointment.get('edad', 0)
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
    Crear cita con unificación automática de paciente por cédula
    """
    # Verificar que el doctor existe
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    
    # UNIFICACIÓN DE PACIENTE POR CÉDULA
    # Esta es la clave: primero unificamos al paciente usando la cédula
    paciente = await unificar_paciente_por_cedula(
        cedula=input.cedula,
        datos_adicionales={
            "nombre": input.nombre_completo,
            "telefono": input.telefono,
            # Podemos agregar más campos si los tenemos en AppointmentCreate
        }
    )
    
    # Crear la cita vinculada al paciente unificado
    appointment_dict = input.model_dump()
    appointment_dict['doctor_nombre'] = doctor['nombre']
    
    # IMPORTANTE: Guardar paciente_cedula como referencia principal
    # El paciente_id también se guarda pero la cédula es el identificador primario
    appointment_dict['paciente_cedula'] = paciente.cedula
    appointment_dict['paciente_id'] = paciente.id  # Referencia interna
    
    appointment_obj = Appointment(**appointment_dict)
    
    doc = appointment_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
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
async def create_invoice(input: InvoiceCreate):
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    
    invoice_dict = input.model_dump()
    invoice_dict['doctor_nombre'] = doctor['nombre']
    invoice_obj = Invoice(**invoice_dict)
    
    doc = invoice_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.invoices.insert_one(doc)
    return invoice_obj

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Registrar router financiero
app.include_router(financial_router, prefix="/api")
    
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
