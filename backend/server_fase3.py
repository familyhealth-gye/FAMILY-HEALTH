from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from typing import List
import io
import csv
from collections import defaultdict
from datetime import datetime

# Import local modules
from models import *
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_role, Token, TokenData
)
from pdf_generator import generate_prescription_pdf

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

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
    
    user_obj = User(**user_dict)
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    return UserResponse(**user_obj.model_dump())

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"username": credentials.username}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user['hashed_password']):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    if not user.get('is_active', True):
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    
    access_token = create_access_token(
        data={"sub": user['username'], "role": user['role']}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user={
            "id": user['id'],
            "username": user['username'],
            "nombre_completo": user['nombre_completo'],
            "email": user['email'],
            "role": user['role']
        }
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserResponse(**user)

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

# ========== PRESCRIPTION ENDPOINTS ==========

@api_router.post("/prescriptions", response_model=Prescription)
async def create_prescription(
    input: PrescriptionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get patient info
    appointment = await db.appointments.find_one({"id": input.paciente_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    # Get doctor info
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    
    prescription_dict = input.model_dump()
    prescription_dict['paciente_nombre'] = appointment['nombre_completo']
    prescription_dict['paciente_cedula'] = appointment['cedula']
    prescription_dict['paciente_edad'] = appointment['edad']
    prescription_dict['doctor_nombre'] = doctor['nombre']
    prescription_dict['doctor_especialidad'] = doctor['especialidad']
    
    prescription_obj = Prescription(**prescription_dict)
    doc = prescription_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.prescriptions.insert_one(doc)
    return prescription_obj

@api_router.get("/prescriptions", response_model=List[Prescription])
async def get_prescriptions(current_user: TokenData = Depends(get_current_user)):
    prescriptions = await db.prescriptions.find({}, {"_id": 0}).to_list(1000)
    
    for prescription in prescriptions:
        if isinstance(prescription['created_at'], str):
            prescription['created_at'] = datetime.fromisoformat(prescription['created_at'])
    
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

