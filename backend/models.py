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
    especialidad: Optional[str] = None  # "Odontología", "Medicina General", "Pediatría", etc.
    hashed_password: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    nombre_completo: str
    role: str
    doctor_id: Optional[str] = None
    especialidad: Optional[str] = None
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = ""
    nombre_completo: Optional[str] = ""
    role: str
    doctor_id: Optional[str] = None
    especialidad: Optional[str] = None
    is_active: Optional[bool] = True
    activo: Optional[bool] = True


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
# Sistema de recetas TRANSVERSAL para todas las especialidades del centro médico

class Medication(BaseModel):
    nombre: str  # Único campo obligatorio
    dosis: str = ""
    frecuencia: str = ""
    duracion: str = ""
    via: str = ""
    indicaciones: str = ""


class Prescription(BaseModel):
    """
    Receta médica universal - funciona para todas las especialidades:
    - Medicina General
    - Odontología
    - Pediatría
    - Ginecología
    - Otras especialidades futuras
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Campos obligatorios del paciente
    paciente_id: str
    paciente_nombre: str = ""
    paciente_cedula: str = ""
    paciente_fecha_nacimiento: str = ""  # CAMPO PRINCIPAL (edad calculada en frontend)
    paciente_edad: int = 0  # DEPRECADO - Solo para compatibilidad
    
    # Campos del doctor
    doctor_id: str = ""
    doctor_nombre: str = ""
    doctor_especialidad: str = ""  # Especialidad que emite la receta
    
    # Campos comunes obligatorios
    appointment_id: str = ""
    especialidad: str = ""  # Especialidad de la consulta
    fecha: str = ""
    medicamentos: List[Medication] = []
    indicaciones_generales: str = ""
    
    # Campos opcionales comunes
    diagnostico: str = ""
    cie10_codigo: str = ""
    cie10_descripcion: str = ""
    observaciones: str = ""
    
    # Campos opcionales por especialidad
    # Medicina General / Pediatría
    peso: float = 0
    talla: float = 0
    imc: float = 0
    
    # Ginecología
    semanas_gestacion: int = 0
    fecha_ultima_menstruacion: str = ""
    
    # Odontología
    procedimiento_realizado: str = ""
    piezas_dentales: str = ""
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PrescriptionCreate(BaseModel):
    """
    Crear receta - todos los campos opcionales excepto paciente_id
    Permite crear recetas desde cualquier especialidad
    """
    # Obligatorio
    paciente_id: str
    
    # Campos comunes opcionales
    doctor_id: str = ""
    appointment_id: str = ""
    especialidad: str = ""
    fecha: str = ""
    medicamentos: List[Medication] = []
    indicaciones_generales: str = ""
    
    # Opcionales
    diagnostico: str = ""
    cie10_codigo: str = ""
    cie10_descripcion: str = ""
    observaciones: str = ""
    
    # Campos opcionales por especialidad
    peso: float = 0
    talla: float = 0
    imc: float = 0
    semanas_gestacion: int = 0
    fecha_ultima_menstruacion: str = ""
    procedimiento_realizado: str = ""
    piezas_dentales: str = ""


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
    # Identificación del paciente (cédula es la principal)
    paciente_cedula: str = ""  # IDENTIFICADOR PRINCIPAL (opcional durante migración)
    paciente_id: str = ""  # Referencia interna al registro unificado de paciente
    nombre_completo: str
    cedula: str  # Mantener por compatibilidad
    fecha_nacimiento: str = ""  # CAMPO PRINCIPAL para edad (calculada automáticamente en frontend)
    edad: int = 0  # DEPRECADO - Solo para compatibilidad con datos antiguos
    telefono: str
    # Cita
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
    fecha_nacimiento: str = ""  # CAMPO PRINCIPAL
    edad: int = 0  # DEPRECADO - opcional para compatibilidad
    telefono: str
    especialidad: str
    doctor_id: str = ""  # Opcional — puede venir vacío si la especialidad no tiene doctor asignado
    fecha: str
    hora: str
    tipo_pago: str = "efectivo"
    observaciones: str = ""


class AppointmentUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    cedula: Optional[str] = None
    fecha_nacimiento: Optional[str] = None  # CAMPO PRINCIPAL
    edad: Optional[int] = None  # DEPRECADO - opcional
    telefono: Optional[str] = None
    especialidad: Optional[str] = None
    doctor_id: Optional[str] = None
    fecha: Optional[str] = None
    hora: Optional[str] = None
    tipo_pago: Optional[str] = None
    observaciones: Optional[str] = None
    estado: Optional[str] = None


class DetalleFactura(BaseModel):
    """Línea de detalle en la factura"""
    descripcion: str
    cantidad: float = 1.0
    precio_unitario: float
    descuento: float = 0.0
    subtotal: float  # precio_unitario * cantidad - descuento


class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Numeración SRI
    numero_factura: str            # Ej: 001-001-000000123
    numero_autorizacion: str = ""  # 49 dígitos del SRI (manual por ahora)
    clave_acceso: str = ""         # 49 dígitos generados

    # Emisor (Family Health)
    emisor_ruc: str = ""
    emisor_razon_social: str = "CENTRO DE ESPECIALIDADES FAMILY HEALTH"
    emisor_nombre_comercial: str = "FAMILY HEALTH"
    emisor_direccion: str = "Mucho Lote 2 MZ 2833 Villa 15, Guayaquil"
    emisor_telefono: str = "096-291-2170"
    emisor_email: str = "centrodeespecialidadesfamilyhe@gmail.com"

    # Receptor (Paciente)
    paciente_nombre: str
    paciente_cedula: str           # cédula o RUC del paciente
    paciente_direccion: str = ""
    paciente_email: str = ""
    paciente_telefono: str = ""

    # Médico
    doctor_id: str = ""
    doctor_nombre: str = ""
    especialidad: str = ""

    # Detalle de servicios
    detalles: List[DetalleFactura] = []

    # Totales
    subtotal: float = 0.0
    descuento_total: float = 0.0
    subtotal_con_descuento: float = 0.0
    iva_porcentaje: float = 0.0    # Ecuador: 0% para servicios médicos (exentos)
    iva_valor: float = 0.0
    total: float = 0.0

    # Pago
    tipo_pago: str = "efectivo"    # efectivo | transferencia | tarjeta | seguro
    referencia_pago: str = ""

    # Vínculo con consulta
    consulta_financiera_id: str = ""
    appointment_id: str = ""

    # Estado
    estado: str = "emitida"        # emitida | anulada
    observaciones: str = ""
    fecha: str = ""                # YYYY-MM-DD
    fecha_autorizacion: str = ""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = ""


class InvoiceCreate(BaseModel):
    # Receptor
    paciente_nombre: str
    paciente_cedula: str
    paciente_direccion: str = ""
    paciente_email: str = ""
    paciente_telefono: str = ""

    # Médico
    doctor_id: str = ""
    doctor_nombre: str = ""
    especialidad: str = ""

    # Detalle
    detalles: List[DetalleFactura] = []

    # Pago
    tipo_pago: str = "efectivo"
    referencia_pago: str = ""

    # Vínculo
    consulta_financiera_id: str = ""
    appointment_id: str = ""

    # Opcionales
    numero_autorizacion: str = ""
    observaciones: str = ""
    fecha: str = ""
    iva_porcentaje: float = 0.0


class InvoiceUpdate(BaseModel):
    numero_autorizacion: Optional[str] = None
    clave_acceso: Optional[str] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None
    fecha_autorizacion: Optional[str] = None
    paciente_direccion: Optional[str] = None
    paciente_email: Optional[str] = None
    referencia_pago: Optional[str] = None



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
    total_facturado: Optional[float] = None
    porcentaje: Optional[float] = None
    total_pagar: Optional[float] = None
    estado: Optional[str] = None


# ========== PROFORMA MODELS ==========
class ProformaItem(BaseModel):
    descripcion: str
    cantidad: int
    precio_unitario: float
    subtotal: float


class Proforma(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    numero_proforma: str
    paciente_nombre: str
    paciente_cedula: str
    paciente_telefono: str
    doctor_id: str
    doctor_nombre: str
    especialidad: str
    items: List[ProformaItem]
    subtotal: float
    descuento: float = 0.0
    total: float
    fecha_emision: str
    validez_dias: int = 30
    estado: str = "Pendiente"  # Pendiente, Aceptada, Rechazada, Facturada
    observaciones: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProformaCreate(BaseModel):
    numero_proforma: str
    paciente_nombre: str
    paciente_cedula: str
    paciente_telefono: str
    doctor_id: str
    especialidad: str
    items: List[ProformaItem]
    descuento: float = 0.0
    fecha_emision: str
    validez_dias: int = 30
    observaciones: str = ""


class ProformaUpdate(BaseModel):
    estado: Optional[str] = None
    observaciones: Optional[str] = None


# ========== ABONO MODELS ==========
class Abono(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paciente_nombre: str
    paciente_cedula: str
    monto: float
    fecha: str
    tipo_pago: str  # Efectivo, Transferencia, Tarjeta
    concepto: str  # Descripción del servicio o tratamiento
    proforma_id: Optional[str] = None  # Vincula con proforma si existe
    appointment_id: Optional[str] = None  # Vincula con cita si existe
    saldo_pendiente: float = 0.0
    recibo_numero: str
    observaciones: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AbonoCreate(BaseModel):
    paciente_nombre: str
    paciente_cedula: str
    monto: float
    fecha: str
    tipo_pago: str
    concepto: str
    proforma_id: Optional[str] = None
    appointment_id: Optional[str] = None
    saldo_pendiente: float = 0.0
    recibo_numero: str
    observaciones: str = ""


class AbonoUpdate(BaseModel):
    monto: Optional[float] = None
    saldo_pendiente: Optional[float] = None
    observaciones: Optional[str] = None


# ========== ESPECIALIDAD MODELS ==========
class Especialidad(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nombre: str
    descripcion: Optional[str] = ""
    activa: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EspecialidadCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = ""
    activa: bool = True


# ========== ODONTOGRAM MODELS ==========
# ========== ODONTOGRAMA CLÍNICO - MODELOS FDI ==========

# Diagnósticos clínicos posibles por superficie
DIAGNOSTICOS_SUPERFICIE = [
    "sano",
    "caries", 
    "restauracion",
    "endodoncia",
    "corona",
    "sellante",
    "fractura"
]

# Estados del diente completo
ESTADOS_DIENTE = [
    "presente",      # Diente normal presente
    "ausente",       # Diente extraído o nunca existió
    "extraccion",    # Marcado para extracción
    "no_erupcionado", # No ha erupcionado todavía
    "exfoliado",     # Temporal que se cayó naturalmente
    "implante",      # Tiene implante
    "protesis"       # Tiene prótesis fija
]


class SuperficieDental(BaseModel):
    """Estado de una superficie específica del diente"""
    nombre: str  # oclusal/incisal, vestibular, palatino/lingual, mesial, distal
    diagnostico: str = "sano"  # sano, caries, restauracion, etc.
    color: str = ""  # Color para visualización (se calcula en frontend)
    notas: str = ""


class DienteFDI(BaseModel):
    """
    Modelo de diente con numeración FDI internacional.
    
    Permanentes: 11-18, 21-28, 31-38, 41-48
    Temporales: 51-55, 61-65, 71-75, 81-85
    """
    numero_fdi: str  # "18", "11", "55", etc.
    tipo: str = "permanente"  # permanente | temporal
    cuadrante: int  # 1, 2, 3, 4 (permanentes) o 5, 6, 7, 8 (temporales)
    posicion: int   # Posición dentro del cuadrante (1-8 permanentes, 1-5 temporales)
    
    # Estado general del diente
    estado: str = "presente"  # presente, ausente, extraccion, no_erupcionado, exfoliado, implante
    
    # Superficies del diente
    superficies: List[SuperficieDental] = []
    
    # En dentición mixta, puede haber temporal y permanente en misma posición
    tiene_temporal: bool = False
    tiene_permanente: bool = True
    
    # Observaciones clínicas
    movilidad: str = ""  # Grado de movilidad: "", "I", "II", "III"
    observaciones: str = ""


class OdontogramaClinico(BaseModel):
    """
    Odontograma clínico completo con soporte para:
    - Dentición permanente (32 dientes)
    - Dentición temporal (20 dientes)
    - Dentición mixta
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Datos del paciente
    paciente_id: str
    paciente_nombre: str
    paciente_cedula: str
    
    # Datos del doctor
    doctor_id: str
    doctor_nombre: str
    
    # Tipo de dentición
    tipo_denticion: str = "permanente"  # permanente | temporal | mixta
    
    # Fecha del registro
    fecha: str
    fecha_actualizacion: str = ""
    
    # Dientes - Lista de DienteFDI
    dientes: List[DienteFDI] = []
    
    # Diagnóstico general
    diagnostico_general: str = ""
    indice_cpod: float = 0  # Índice de caries (dientes Cariados, Perdidos, Obturados)
    indice_ceod: float = 0  # Para dentición temporal
    
    # Observaciones clínicas generales
    higiene_oral: str = ""  # buena, regular, mala
    estado_encias: str = ""  # sano, gingivitis, periodontitis
    oclusion: str = ""
    observaciones: str = ""
    
    # Preparación para futuras integraciones (NO IMPLEMENTAR AÚN)
    # procedimientos: List = []  # Para vincular con catálogo de servicios
    # proforma_id: str = ""
    # consulta_financiera_id: str = ""
    
    # Auditoría
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OdontogramaCreate(BaseModel):
    paciente_id: str
    paciente_nombre: str = ""
    paciente_cedula: str = ""
    doctor_id: str
    tipo_denticion: str = "permanente"
    fecha: str = ""
    dientes: List[DienteFDI] = []
    diagnostico_general: str = ""
    higiene_oral: str = ""
    estado_encias: str = ""
    oclusion: str = ""
    observaciones: str = ""


class OdontogramaUpdate(BaseModel):
    tipo_denticion: Optional[str] = None
    dientes: Optional[List[DienteFDI]] = None
    diagnostico_general: Optional[str] = None
    higiene_oral: Optional[str] = None
    estado_encias: Optional[str] = None
    oclusion: Optional[str] = None
    observaciones: Optional[str] = None


# ========== COMPATIBILIDAD CON MODELO ANTERIOR ==========
# Mantener ToothState y Odontogram como alias para no romper código existente
class ToothState(BaseModel):
    """Modelo legacy - usar DienteFDI en nuevo código"""
    tooth_number: int
    estado: str = "Sano"
    cara_oclusal: str = ""
    cara_vestibular: str = ""
    cara_palatina: str = ""
    cara_mesial: str = ""
    cara_distal: str = ""
    observaciones: str = ""


class Odontogram(BaseModel):
    """Modelo legacy - usar OdontogramaClinico en nuevo código"""
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paciente_id: str
    paciente_nombre: str
    paciente_cedula: str
    doctor_id: str
    doctor_nombre: str
    fecha: str
    dientes: List[ToothState] = []
    diagnostico_general: str = ""
    tratamiento_recomendado: str = ""
    observaciones: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OdontogramCreate(BaseModel):
    """Modelo legacy para crear odontograma"""
    paciente_id: str
    doctor_id: str
    fecha: str
    dientes: List[ToothState] = []
    diagnostico_general: str = ""
    tratamiento_recomendado: str = ""
    observaciones: str = ""


class OdontogramUpdate(BaseModel):
    """Modelo legacy para actualizar odontograma"""
    dientes: Optional[List[ToothState]] = None
    diagnostico_general: Optional[str] = None
    tratamiento_recomendado: Optional[str] = None
    observaciones: Optional[str] = None


# ========== PLAN DE TRATAMIENTO MODELS ==========
class ProcedimientoDental(BaseModel):
    """
    Procedimiento dental individual dentro de un plan de tratamiento.
    Los procedimientos se generan por diente, no por superficie.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    diente_numero: str  # Número FDI del diente (ej: "16", "26")
    procedimiento: str  # Nombre del procedimiento (ej: "Resina simple", "Extracción")
    descripcion: str = ""  # Descripción adicional
    fase: int = 1  # Número de fase del tratamiento
    estado: str = "pendiente"  # pendiente | realizado | cancelado
    precio: float = 0.0  # Precio estimado (para futura proforma)
    superficies_afectadas: List[str] = []  # Superficies que motivaron el procedimiento
    fecha_programada: str = ""
    fecha_realizado: str = ""
    notas: str = ""


class FaseTratamiento(BaseModel):
    """Fase de tratamiento agrupando procedimientos"""
    numero: int
    nombre: str = ""  # Ej: "Fase de urgencia", "Fase restauradora"
    descripcion: str = ""
    procedimientos: List[str] = []  # IDs de procedimientos en esta fase


class PlanTratamiento(BaseModel):
    """
    Plan de tratamiento dental completo.
    Conecta hallazgos del odontograma con procedimientos organizados en fases.
    """
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Datos del paciente
    paciente_id: str
    paciente_cedula: str
    paciente_nombre: str
    
    # Datos del doctor
    doctor_id: str = ""
    doctor_nombre: str = ""
    
    # Referencia al odontograma
    odontograma_id: str = ""
    
    # Procedimientos y fases
    procedimientos: List[ProcedimientoDental] = []
    fases: List[FaseTratamiento] = []
    
    # Estado general
    estado: str = "activo"  # activo | completado | cancelado
    
    # Totales
    total_estimado: float = 0.0
    total_realizado: float = 0.0
    
    # Diagnóstico y observaciones
    diagnostico_general: str = ""
    observaciones: str = ""
    
    # Auditoría
    fecha_creacion: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    fecha_actualizacion: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PlanTratamientoCreate(BaseModel):
    """Modelo para crear plan de tratamiento"""
    paciente_id: str
    paciente_cedula: str
    paciente_nombre: str
    doctor_id: str = ""
    doctor_nombre: str = ""
    odontograma_id: str = ""


class ProcedimientoCreate(BaseModel):
    """Modelo para agregar procedimiento a plan"""
    diente_numero: str
    procedimiento: str
    descripcion: str = ""
    fase: int = 1
    precio: float = 0.0
    superficies_afectadas: List[str] = []
    notas: str = ""


class ProcedimientoUpdate(BaseModel):
    """Modelo para actualizar procedimiento"""
    procedimiento: Optional[str] = None
    descripcion: Optional[str] = None
    fase: Optional[int] = None
    estado: Optional[str] = None
    precio: Optional[float] = None
    fecha_programada: Optional[str] = None
    fecha_realizado: Optional[str] = None
    notas: Optional[str] = None