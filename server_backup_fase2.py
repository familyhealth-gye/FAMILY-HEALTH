from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
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
import io
import csv
from collections import defaultdict


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


# ========== MODELS ==========

# Doctor Models
class Doctor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    especialidad: str
    porcentaje: float = 50.0  # Default 50%
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorCreate(BaseModel):
    nombre: str
    especialidad: str
    porcentaje: float = 50.0

class DoctorUpdate(BaseModel):
    nombre: Optional[str] = None
    especialidad: Optional[str] = None
    porcentaje: Optional[float] = None

# Appointment Models
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
    fecha: str
    hora: str
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

# Invoice Models
class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    numero_factura: str
    paciente_nombre: str
    paciente_cedula: str
    doctor_id: str
    doctor_nombre: str
    especialidad: str
    servicio: str
    valor: float
    fecha: str
    tipo_pago: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvoiceCreate(BaseModel):
    numero_factura: str
    paciente_nombre: str
    paciente_cedula: str
    doctor_id: str
    especialidad: str
    servicio: str
    valor: float
    fecha: str
    tipo_pago: str

class InvoiceUpdate(BaseModel):
    numero_factura: Optional[str] = None
    paciente_nombre: Optional[str] = None
    paciente_cedula: Optional[str] = None
    doctor_id: Optional[str] = None
    especialidad: Optional[str] = None
    servicio: Optional[str] = None
    valor: Optional[float] = None
    fecha: Optional[str] = None
    tipo_pago: Optional[str] = None

# Inventory Models
class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    categoria: str
    cantidad: int
    costo_unitario: float
    stock_minimo: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryItemCreate(BaseModel):
    nombre: str
    categoria: str
    cantidad: int
    costo_unitario: float
    stock_minimo: int

class InventoryItemUpdate(BaseModel):
    nombre: Optional[str] = None
    categoria: Optional[str] = None
    cantidad: Optional[int] = None
    costo_unitario: Optional[float] = None
    stock_minimo: Optional[int] = None

class InventoryMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_id: str
    item_nombre: str
    tipo: str  # "entrada" o "salida"
    cantidad: int
    motivo: str
    fecha: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryMovementCreate(BaseModel):
    item_id: str
    tipo: str
    cantidad: int
    motivo: str
    fecha: str

# Doctor Payment Models
class DoctorPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doctor_id: str
    doctor_nombre: str
    mes: int
    año: int
    total_facturado: float
    porcentaje: float
    total_pagar: float
    estado: str  # "Pendiente" o "Pagado"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DoctorPaymentCreate(BaseModel):
    doctor_id: str
    mes: int
    año: int
    estado: str = "Pendiente"

class DoctorPaymentUpdate(BaseModel):
    estado: Optional[str] = None


# ========== ROUTES ==========

@api_router.get("/")
async def root():
    return {"message": "Family Health API - Fase 2"}

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

# Categories endpoint
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

# ========== DOCTOR ENDPOINTS ==========

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

# ========== APPOINTMENT ENDPOINTS ==========

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

# ========== INVOICE ENDPOINTS ==========

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
    
    writer.writerow([
        'Número Factura', 'Paciente', 'Cédula', 'Doctor', 
        'Especialidad', 'Servicio', 'Valor', 'Fecha', 'Tipo Pago'
    ])
    
    for invoice in invoices:
        writer.writerow([
            invoice['numero_factura'],
            invoice['paciente_nombre'],
            invoice['paciente_cedula'],
            invoice['doctor_nombre'],
            invoice['especialidad'],
            invoice['servicio'],
            invoice['valor'],
            invoice['fecha'],
            invoice['tipo_pago']
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=facturas_family_health.csv"}
    )

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

# ========== INVENTORY ENDPOINTS ==========

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
            alerts.append({
                "id": item['id'],
                "nombre": item['nombre'],
                "cantidad": item['cantidad'],
                "stock_minimo": item['stock_minimo']
            })
    
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

# ========== DOCTOR PAYMENTS ==========

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
        "doctor_id": input.doctor_id,
        "mes": input.mes,
        "año": input.año
    }, {"_id": 0})
    
    if existing_payment:
        await db.doctor_payments.update_one(
            {"id": existing_payment['id']},
            {"$set": {
                "total_facturado": total_facturado,
                "porcentaje": porcentaje,
                "total_pagar": total_pagar,
                "estado": input.estado
            }}
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
            doctor_id=input.doctor_id,
            doctor_nombre=doctor['nombre'],
            mes=input.mes,
            año=input.año,
            total_facturado=total_facturado,
            porcentaje=porcentaje,
            total_pagar=total_pagar,
            estado=input.estado
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

# Include the router
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
