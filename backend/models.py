from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone


# ========== USER MODELS ==========
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    nombre_completo: str
    role: str  # "Administrador", "Recepcion", "Doctor"
    doctor_id: Optional[str] = None  # Vincula usuario con doctor del sistema
    hashed_password: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    nombre_completo: str
    role: str
    doctor_id: Optional[str] = None
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    nombre_completo: str
    role: str
    doctor_id: Optional[str] = None
    is_active: bool


# ========== MEDICAL HISTORY MODELS ==========
class MedicalHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paciente_id: str
    paciente_nombre: str
    paciente_cedula: str
    doctor_id: str
    doctor_nombre: str
    fecha: str
    motivo_consulta: str
    antecedentes: str = ""
    examen_fisico: str = ""
    diagnostico: str = ""
    tratamiento: str = ""
    observaciones: str = ""
    proxima_cita: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicalHistoryCreate(BaseModel):
    paciente_id: str
    doctor_id: str
    fecha: str
    motivo_consulta: str
    antecedentes: str = ""
    examen_fisico: str = ""
    diagnostico: str = ""
    tratamiento: str = ""
    observaciones: str = ""
    proxima_cita: str = ""


class MedicalHistoryUpdate(BaseModel):
    motivo_consulta: Optional[str] = None
    antecedentes: Optional[str] = None
    examen_fisico: Optional[str] = None
    diagnostico: Optional[str] = None
    tratamiento: Optional[str] = None
    observaciones: Optional[str] = None
    proxima_cita: Optional[str] = None


# ========== PRESCRIPTION MODELS ==========
class Medication(BaseModel):
    nombre: str
    dosis: str
    frecuencia: str
    duracion: str
    indicaciones: str = ""


class Prescription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paciente_id: str
    paciente_nombre: str
    paciente_cedula: str
    paciente_edad: int
    doctor_id: str
    doctor_nombre: str
    doctor_especialidad: str
    fecha: str
    diagnostico: str
    cie10_codigo: str = ""
    cie10_descripcion: str = ""
    medicamentos: List[Medication]
    indicaciones_generales: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PrescriptionCreate(BaseModel):
    paciente_id: str
    doctor_id: str
    fecha: str
    diagnostico: str
    cie10_codigo: str = ""
    cie10_descripcion: str = ""
    medicamentos: List[Medication]
    indicaciones_generales: str = ""


# ========== EXISTING MODELS (from previous phases) ==========
class Doctor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    especialidad: str
    porcentaje: float = 50.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DoctorCreate(BaseModel):
    nombre: str
    especialidad: str
    porcentaje: float = 50.0


class DoctorUpdate(BaseModel):
    nombre: Optional[str] = None
    especialidad: Optional[str] = None
    porcentaje: Optional[float] = None


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
    estado: str = "Programada"  # Programada, Atendida, Cancelada
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
    estado: Optional[str] = None


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
    tipo: str
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
    estado: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DoctorPaymentCreate(BaseModel):
    doctor_id: str
    mes: int
    año: int
    estado: str = "Pendiente"


class DoctorPaymentUpdate(BaseModel):
    estado: Optional[str] = None
