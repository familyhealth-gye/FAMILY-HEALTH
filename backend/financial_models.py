# ========== MÓDULO FINANCIERO - MODELOS ==========
# Sistema SaaS Clínico Multiespecialidad
# Arquitectura modular profesional

from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid


# ========== PACIENTES ==========
class Paciente(BaseModel):
    """Entidad central del paciente - datos demográficos"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cedula: str  # Único
    nombre: str
    telefono: str = ""
    direccion: str = ""
    email: str = ""
    fecha_nacimiento: str = ""
    sexo: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PacienteCreate(BaseModel):
    cedula: str
    nombre: str
    telefono: str = ""
    direccion: str = ""
    email: str = ""
    fecha_nacimiento: str = ""
    sexo: str = ""


class PacienteUpdate(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    email: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    sexo: Optional[str] = None


# ========== DETALLE DE SERVICIOS ==========
class DetalleServicio(BaseModel):
    """Línea de detalle de servicios en una consulta"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    consulta_id: str
    servicio: str
    descripcion: str = ""
    precio_unitario: float
    cantidad: int = 1
    subtotal: float = 0  # Calculado: precio_unitario * cantidad
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DetalleServicioCreate(BaseModel):
    servicio: str
    descripcion: str = ""
    precio_unitario: float
    cantidad: int = 1


# ========== PAGOS / ABONOS ==========
class Pago(BaseModel):
    """Registro de pagos/abonos a una consulta"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    consulta_id: str
    fecha: str
    monto: float
    tipo_pago: str  # efectivo, transferencia, tarjeta, cheque
    referencia: str = ""
    recibido_por: str = ""  # Usuario que recibió el pago
    notas: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PagoCreate(BaseModel):
    fecha: str = ""
    monto: float
    tipo_pago: str = "efectivo"
    referencia: str = ""
    notas: str = ""
    descuento_aplicado: float = 0.0  # descuento aplicado en este pago


# ========== CONSULTAS FINANCIERAS ==========
class ConsultaFinanciera(BaseModel):
    """
    Consulta médica con datos financieros completos.
    Relaciona paciente, doctor, servicios y pagos.
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Relaciones
    paciente_id: str
    paciente_cedula: str = ""
    paciente_nombre: str = ""
    doctor_id: str
    doctor_nombre: str = ""
    appointment_id: str = ""  # Referencia a cita original
    
    # Datos clínicos básicos
    especialidad: str
    fecha: str
    motivo: str = ""
    diagnostico: str = ""
    
    # Estado clínico
    estado: str = "activa"  # activa, cerrada
    
    # Datos financieros (calculados)
    total: float = 0  # Suma de subtotales de servicios
    total_pagado: float = 0  # Suma de pagos
    saldo: float = 0  # total - total_pagado
    estado_pago: str = "pendiente"  # pendiente, parcial, pagado
    
    # Servicios y pagos embebidos para consultas rápidas
    servicios: List[DetalleServicio] = []
    pagos: List[Pago] = []
    
    # Auditoría
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""
    

class ConsultaFinancieraCreate(BaseModel):
    paciente_id: str
    doctor_id: str
    appointment_id: str = ""
    especialidad: str
    fecha: str = ""
    motivo: str = ""
    diagnostico: str = ""
    servicios: List[DetalleServicioCreate] = []


class ConsultaFinancieraUpdate(BaseModel):
    motivo: Optional[str] = None
    diagnostico: Optional[str] = None
    estado: Optional[str] = None


# ========== REPORTES ==========
class ReporteFinanciero(BaseModel):
    """Modelo para reportes financieros"""
    periodo: str  # "2024-01", "2024-Q1", "2024"
    fecha_inicio: str
    fecha_fin: str
    
    # Totales
    total_consultas: int = 0
    total_facturado: float = 0
    total_cobrado: float = 0
    total_pendiente: float = 0
    
    # Desglose por tipo de pago
    efectivo: float = 0
    transferencia: float = 0
    tarjeta: float = 0
    otros: float = 0
    
    # Desglose
    por_doctor: List[dict] = []
    por_especialidad: List[dict] = []
    por_servicio: List[dict] = []


class ResumenPaciente(BaseModel):
    """Resumen financiero de un paciente"""
    paciente_id: str
    paciente_nombre: str
    paciente_cedula: str
    
    total_consultas: int = 0
    total_facturado: float = 0
    total_pagado: float = 0
    saldo_total: float = 0
    
    consultas: List[dict] = []


# ========== CATÁLOGO DE SERVICIOS ==========
class CatalogoServicio(BaseModel):
    """Catálogo de servicios con precios predefinidos"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    codigo: str = ""
    nombre: str
    descripcion: str = ""
    especialidad: str  # A qué especialidad aplica
    precio_base: float
    activo: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CatalogoServicioCreate(BaseModel):
    codigo: str = ""
    nombre: str
    descripcion: str = ""
    especialidad: str
    precio_base: float


# ========== CIERRE DE CAJA ==========
class CierreCaja(BaseModel):
    """Cierre de caja diario"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    fecha: str
    fecha_cierre: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    usuario_cierre: str
    usuario_nombre: str = ""
    
    # Totales por tipo de pago
    total_efectivo: float = 0
    total_transferencia: float = 0
    total_tarjeta: float = 0
    total_cheque: float = 0
    total_seguro: float = 0
    total_otros: float = 0
    
    # Total general
    total_general: float = 0
    num_transacciones: int = 0
    
    # Detalles
    observaciones: str = ""
    estado: str = "abierto"  # abierto, cerrado
    
    # Resúmenes
    por_especialidad: List[dict] = []
    por_doctor: List[dict] = []
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CierreCajaCreate(BaseModel):
    fecha: str
    observaciones: str = ""