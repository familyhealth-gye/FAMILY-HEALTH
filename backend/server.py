from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Doctor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    especialidad: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorCreate(BaseModel):
    nombre: str
    especialidad: str

class DoctorUpdate(BaseModel):
    nombre: Optional[str] = None
    especialidad: Optional[str] = None

class Appointment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre_completo: str
    cedula: str
    edad: int
    telefono: str
    especialidad: str
    doctor_id: str
    doctor_nombre: str
    fecha: str  # Format: YYYY-MM-DD
    hora: str   # Format: HH:MM
    tipo_pago: str
    observaciones: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppointmentCreate(BaseModel):
    nombre_completo: str
    cedula: str
    edad: int
    telefono: str
    especialidad: str
    doctor_id: str
    fecha: str
    hora: str
    tipo_pago: str
    observaciones: str = ""

class AppointmentUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    cedula: Optional[str] = None
    edad: Optional[int] = None
    telefono: Optional[str] = None
    especialidad: Optional[str] = None
    doctor_id: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    tipo_pago: Optional[str] = None
    observaciones: Optional[str] = None


# Routes
@api_router.get("/")
async def root():
    return {"message": "Family Health API"}

# Specialties endpoint
@api_router.get("/specialties")
async def get_specialties():
    return {
        "specialties": [
            "Odontología",
            "Medicina General",
            "Nutrición",
            "Psicología",
            "Ginecología",
            "Laboratorio Clínico"
        ]
    }

# Doctor endpoints
@api_router.post("/doctors", response_model=Doctor)
async def create_doctor(input: DoctorCreate):
    doctor_dict = input.model_dump()
    doctor_obj = Doctor(**doctor_dict)
    
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
    # Get doctor name
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    
    appointment_dict = input.model_dump()
    appointment_dict['doctor_nombre'] = doctor['nombre']
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
    
    return appointments

@api_router.put("/appointments/{appointment_id}", response_model=Appointment)
async def update_appointment(appointment_id: str, input: AppointmentUpdate):
    existing = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    
    # If doctor_id is updated, update doctor_nombre
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

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()