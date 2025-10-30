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

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
