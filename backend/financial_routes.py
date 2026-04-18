# ========== MÓDULO FINANCIERO - ENDPOINTS ==========
# Sistema SaaS Clínico Multiespecialidad

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import io
import uuid

# Cargar variables de entorno
load_dotenv()

from financial_models import (
    Paciente, PacienteCreate, PacienteUpdate,
    ConsultaFinanciera, ConsultaFinancieraCreate, ConsultaFinancieraUpdate,
    DetalleServicio, DetalleServicioCreate,
    Pago, PagoCreate,
    CatalogoServicio, CatalogoServicioCreate,
    ReporteFinanciero, ResumenPaciente,
    CierreCaja, CierreCajaCreate
)
from auth import TokenData, get_current_user

# Router para endpoints financieros
financial_router = APIRouter(prefix="/financial", tags=["Financial"])

# MongoDB Atlas Connection (same as server.py)
MONGO_URL = os.environ.get('MONGODB_URI', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
DB_NAME = os.environ.get('DB_NAME', 'family_health_db')
client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

print(f"🔗 financial_routes.py conectado a MongoDB: {DB_NAME}")


# ========== FUNCIÓN HELPER: UNIFICACIÓN DE PACIENTES ==========
async def unificar_paciente_por_cedula(cedula: str, datos_adicionales: dict = None) -> Paciente:
    """
    FUNCIÓN CENTRAL DE UNIFICACIÓN DE PACIENTES
    
    Busca paciente por cédula. Si existe, lo retorna (opcionalmente actualiza datos).
    Si no existe, crea uno nuevo con los datos proporcionados.
    
    Esta función garantiza que la cédula sea el identificador único en todo el sistema.
    
    Args:
        cedula: Cédula del paciente (identificador único)
        datos_adicionales: Dict con campos opcionales (nombre, telefono, email, etc.)
    
    Returns:
        Paciente: Objeto Paciente (existente o recién creado)
    """
    if not cedula or cedula.strip() == "":
        raise HTTPException(status_code=400, detail="La cédula es obligatoria")
    
    cedula = cedula.strip()
    
    # Buscar paciente existente por cédula
    paciente_doc = await db.pacientes.find_one({"cedula": cedula}, {"_id": 0})
    
    if paciente_doc:
        # Paciente existe - actualizar datos si se proporcionan
        if datos_adicionales:
            update_data = {}
            campos_actualizables = ['nombre', 'telefono', 'direccion', 'email', 'fecha_nacimiento', 'sexo']
            
            for campo in campos_actualizables:
                if campo in datos_adicionales and datos_adicionales[campo]:
                    # Solo actualizar si el campo está vacío o el nuevo valor es diferente
                    if not paciente_doc.get(campo) or paciente_doc.get(campo) == "":
                        update_data[campo] = datos_adicionales[campo]
            
            if update_data:
                update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
                await db.pacientes.update_one({"cedula": cedula}, {"$set": update_data})
                # Recargar documento actualizado
                paciente_doc = await db.pacientes.find_one({"cedula": cedula}, {"_id": 0})
        
        # Convertir strings ISO a datetime si es necesario
        if isinstance(paciente_doc.get('created_at'), str):
            paciente_doc['created_at'] = datetime.fromisoformat(paciente_doc['created_at'])
        if isinstance(paciente_doc.get('updated_at'), str):
            paciente_doc['updated_at'] = datetime.fromisoformat(paciente_doc['updated_at'])
        
        return Paciente(**paciente_doc)
    
    else:
        # Paciente NO existe - crear nuevo
        if not datos_adicionales or not datos_adicionales.get('nombre'):
            raise HTTPException(
                status_code=400, 
                detail=f"Paciente con cédula {cedula} no existe. Debe proporcionar al menos el nombre para crearlo."
            )
        
        paciente_data = {
            "cedula": cedula,
            "nombre": datos_adicionales.get('nombre', ''),
            "telefono": datos_adicionales.get('telefono', ''),
            "direccion": datos_adicionales.get('direccion', ''),
            "email": datos_adicionales.get('email', ''),
            "fecha_nacimiento": datos_adicionales.get('fecha_nacimiento', ''),
            "sexo": datos_adicionales.get('sexo', '')
        }
        
        nuevo_paciente = Paciente(**paciente_data)
        doc = nuevo_paciente.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.pacientes.insert_one(doc)
        
        return nuevo_paciente


# ========== PACIENTES ==========

@financial_router.get("/pacientes", response_model=List[Paciente])
async def get_pacientes(
    search: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener lista de pacientes con búsqueda opcional"""
    query = {}
    if search:
        query = {
            "$or": [
                {"nombre": {"$regex": search, "$options": "i"}},
                {"cedula": {"$regex": search, "$options": "i"}}
            ]
        }
    
    pacientes = await db.pacientes.find(query, {"_id": 0}).to_list(1000)
    
    for p in pacientes:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
        if isinstance(p.get('updated_at'), str):
            p['updated_at'] = datetime.fromisoformat(p['updated_at'])
    
    return pacientes


@financial_router.get("/pacientes/{paciente_id}", response_model=Paciente)
async def get_paciente(
    paciente_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener paciente por ID"""
    paciente = await db.pacientes.find_one({"id": paciente_id}, {"_id": 0})
    if not paciente:
        # Buscar por cédula también
        paciente = await db.pacientes.find_one({"cedula": paciente_id}, {"_id": 0})
    
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    return paciente


@financial_router.post("/pacientes", response_model=Paciente)
async def create_paciente(
    input: PacienteCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Crear nuevo paciente"""
    # Verificar cédula única
    existing = await db.pacientes.find_one({"cedula": input.cedula}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un paciente con esta cédula")
    
    paciente = Paciente(**input.model_dump())
    doc = paciente.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.pacientes.insert_one(doc)
    return paciente


@financial_router.put("/pacientes/{paciente_id}", response_model=Paciente)
async def update_paciente(
    paciente_id: str,
    input: PacienteUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar paciente"""
    paciente = await db.pacientes.find_one({"id": paciente_id}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.pacientes.update_one({"id": paciente_id}, {"$set": update_data})
    
    updated = await db.pacientes.find_one({"id": paciente_id}, {"_id": 0})
    return updated


# ========== CONSULTAS FINANCIERAS ==========

@financial_router.get("/consultas", response_model=List[ConsultaFinanciera])
async def get_consultas_financieras(
    paciente_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    estado_pago: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener consultas financieras con filtros"""
    query = {}
    
    if paciente_id:
        query["paciente_id"] = paciente_id
    if doctor_id:
        query["doctor_id"] = doctor_id
    if estado_pago:
        query["estado_pago"] = estado_pago
    if fecha_inicio and fecha_fin:
        query["fecha"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    
    consultas = await db.consultas_financieras.find(query, {"_id": 0}).sort("fecha", -1).to_list(1000)
    
    for c in consultas:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
        if isinstance(c.get('updated_at'), str):
            c['updated_at'] = datetime.fromisoformat(c['updated_at'])
    
    return consultas


# ⚠️ IMPORTANTE: estas rutas específicas deben ir ANTES de /consultas/{consulta_id}
# para que FastAPI no las confunda con el parámetro genérico

@financial_router.get("/consultas/por-cita/{appointment_id}")
async def get_consulta_por_cita(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener consulta financiera por ID de cita — búsqueda directa y exacta"""
    consulta = await db.consultas_financieras.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not consulta:
        raise HTTPException(status_code=404, detail="No existe consulta financiera para esta cita")
    # Convertir fechas
    if isinstance(consulta.get('created_at'), str):
        consulta['created_at'] = datetime.fromisoformat(consulta['created_at'])
    if isinstance(consulta.get('updated_at'), str):
        consulta['updated_at'] = datetime.fromisoformat(consulta['updated_at'])
    return consulta


@financial_router.get("/consultas/{consulta_id}", response_model=ConsultaFinanciera)
async def get_consulta_financiera(
    consulta_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener consulta financiera por ID"""
    consulta = await db.consultas_financieras.find_one({"id": consulta_id}, {"_id": 0})
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    
    return consulta


@financial_router.post("/consultas", response_model=ConsultaFinanciera)
async def create_consulta_financiera(
    input: ConsultaFinancieraCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Crear consulta financiera con servicios"""
    # Obtener datos del paciente
    paciente = await db.pacientes.find_one({"id": input.paciente_id}, {"_id": 0})
    if not paciente:
        # Buscar en appointments por compatibilidad
        appointment = await db.appointments.find_one({"id": input.paciente_id}, {"_id": 0})
        if appointment:
            paciente = {
                "id": input.paciente_id,
                "cedula": appointment.get("cedula", ""),
                "nombre": appointment.get("nombre_completo", "")
            }
    
    # Obtener datos del doctor
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    doctor_nombre = doctor.get("nombre", "") if doctor else ""
    
    # Crear servicios con subtotales
    servicios = []
    total = 0
    for srv in input.servicios:
        servicio = DetalleServicio(
            consulta_id="",  # Se actualiza después
            servicio=srv.servicio,
            descripcion=srv.descripcion,
            precio_unitario=srv.precio_unitario,
            cantidad=srv.cantidad,
            subtotal=srv.precio_unitario * srv.cantidad
        )
        total += servicio.subtotal
        servicios.append(servicio)
    
    # Crear consulta
    consulta = ConsultaFinanciera(
        paciente_id=input.paciente_id,
        paciente_cedula=paciente.get("cedula", "") if paciente else "",
        paciente_nombre=paciente.get("nombre", "") if paciente else "",
        doctor_id=input.doctor_id,
        doctor_nombre=doctor_nombre,
        appointment_id=input.appointment_id,
        especialidad=input.especialidad,
        fecha=input.fecha or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        motivo=input.motivo,
        diagnostico=input.diagnostico,
        total=total,
        total_pagado=0,
        saldo=total,
        estado_pago="pendiente" if total > 0 else "pagado",
        servicios=[],
        pagos=[],
        created_by=current_user.username
    )
    
    # Actualizar consulta_id en servicios
    for srv in servicios:
        srv.consulta_id = consulta.id
    consulta.servicios = servicios
    
    # Guardar
    doc = consulta.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    for srv in doc['servicios']:
        srv['created_at'] = srv['created_at'].isoformat()
    
    await db.consultas_financieras.insert_one(doc)
    return consulta


@financial_router.post("/consultas/{consulta_id}/servicios", response_model=ConsultaFinanciera)
async def add_servicio_to_consulta(
    consulta_id: str,
    input: DetalleServicioCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Agregar servicio a una consulta existente"""
    consulta = await db.consultas_financieras.find_one({"id": consulta_id}, {"_id": 0})
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    
    # Crear nuevo servicio
    servicio = DetalleServicio(
        consulta_id=consulta_id,
        servicio=input.servicio,
        descripcion=input.descripcion,
        precio_unitario=input.precio_unitario,
        cantidad=input.cantidad,
        subtotal=input.precio_unitario * input.cantidad
    )
    
    # Recalcular totales
    servicios = consulta.get('servicios', [])
    srv_doc = servicio.model_dump()
    srv_doc['created_at'] = srv_doc['created_at'].isoformat()
    servicios.append(srv_doc)
    
    total = sum(s.get('subtotal', 0) for s in servicios)
    total_pagado = consulta.get('total_pagado', 0)
    saldo = total - total_pagado
    estado_pago = "pagado" if saldo <= 0 else ("parcial" if total_pagado > 0 else "pendiente")
    
    # Actualizar
    await db.consultas_financieras.update_one(
        {"id": consulta_id},
        {"$set": {
            "servicios": servicios,
            "total": total,
            "saldo": saldo,
            "estado_pago": estado_pago,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.consultas_financieras.find_one({"id": consulta_id}, {"_id": 0})
    return updated


# ========== PAGOS ==========

@financial_router.post("/consultas/{consulta_id}/pagos", response_model=ConsultaFinanciera)
async def registrar_pago(
    consulta_id: str,
    input: PagoCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Registrar pago/abono a una consulta"""
    consulta = await db.consultas_financieras.find_one({"id": consulta_id}, {"_id": 0})
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    
    # Crear pago
    pago = Pago(
        consulta_id=consulta_id,
        fecha=input.fecha or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        monto=input.monto,
        tipo_pago=input.tipo_pago,
        referencia=input.referencia,
        recibido_por=current_user.username,
        notas=input.notas
    )
    
    # Actualizar lista de pagos
    pagos = consulta.get('pagos', [])
    pago_doc = pago.model_dump()
    pago_doc['created_at'] = pago_doc['created_at'].isoformat()
    pagos.append(pago_doc)
    
    # Recalcular totales
    total = consulta.get('total', 0)
    total_pagado = sum(p.get('monto', 0) for p in pagos)
    saldo = total - total_pagado
    
    # Determinar estado de pago
    if saldo <= 0:
        estado_pago = "pagado"
        saldo = 0
    elif total_pagado > 0:
        estado_pago = "parcial"
    else:
        estado_pago = "pendiente"
    
    # Actualizar
    await db.consultas_financieras.update_one(
        {"id": consulta_id},
        {"$set": {
            "pagos": pagos,
            "total_pagado": total_pagado,
            "saldo": saldo,
            "estado_pago": estado_pago,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.consultas_financieras.find_one({"id": consulta_id}, {"_id": 0})
    return updated


@financial_router.get("/pagos", response_model=List[Pago])
async def get_pagos(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    tipo_pago: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener todos los pagos con filtros"""
    # Buscar en todas las consultas y extraer pagos
    consultas = await db.consultas_financieras.find({}, {"_id": 0, "pagos": 1, "id": 1}).to_list(1000)
    
    all_pagos = []
    for consulta in consultas:
        for pago in consulta.get('pagos', []):
            if fecha_inicio and fecha_fin:
                if pago.get('fecha', '') < fecha_inicio or pago.get('fecha', '') > fecha_fin:
                    continue
            if tipo_pago and pago.get('tipo_pago') != tipo_pago:
                continue
            all_pagos.append(pago)
    
    # Ordenar por fecha
    all_pagos.sort(key=lambda x: x.get('fecha', ''), reverse=True)
    return all_pagos


# ========== CATÁLOGO DE SERVICIOS ==========

@financial_router.get("/catalogo", response_model=List[CatalogoServicio])
async def get_catalogo_servicios(
    especialidad: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener catálogo de servicios"""
    query = {"activo": True}
    if especialidad:
        query["especialidad"] = especialidad
    
    servicios = await db.catalogo_servicios.find(query, {"_id": 0}).to_list(500)
    return servicios


@financial_router.post("/catalogo", response_model=CatalogoServicio)
async def create_catalogo_servicio(
    input: CatalogoServicioCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Crear servicio en catálogo"""
    servicio = CatalogoServicio(**input.model_dump())
    doc = servicio.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.catalogo_servicios.insert_one(doc)
    return servicio


@financial_router.post("/catalogo/seed")
async def seed_catalogo_servicios(
    current_user: TokenData = Depends(get_current_user)
):
    """Poblar/actualizar catálogo con precios reales de Family Health"""

    servicios_base = [
        # ── MEDICINA GENERAL ─────────────────────────────────
        {"codigo":"MG001","nombre":"Consulta Medicina General","especialidad":"Medicina General","precio_base":15.00},
        {"codigo":"MG002","nombre":"Paquete 2 Consultas Medicina General","especialidad":"Medicina General","precio_base":20.00},
        {"codigo":"MG003","nombre":"Certificado Médico","especialidad":"Medicina General","precio_base":20.00},
        # ── NUTRICIÓN ─────────────────────────────────────────
        {"codigo":"NT001","nombre":"Consulta Nutrición","especialidad":"Nutrición","precio_base":20.00},
        {"codigo":"NT002","nombre":"Paquete 3 Consultas Nutrición","especialidad":"Nutrición","precio_base":60.00},
        {"codigo":"NT003","nombre":"Paquete 5 Consultas Nutrición","especialidad":"Nutrición","precio_base":100.00},
        # ── PSICOLOGÍA ────────────────────────────────────────
        {"codigo":"PS001","nombre":"Consulta Psicología","especialidad":"Psicología","precio_base":30.00},
        {"codigo":"PS002","nombre":"Paquete 2 Consultas Psicología","especialidad":"Psicología","precio_base":50.00},
        # ── PEDIATRÍA ─────────────────────────────────────────
        {"codigo":"PD001","nombre":"Consulta Pediátrica","especialidad":"Pediatría","precio_base":25.00},
        # ── GINECOLOGÍA ───────────────────────────────────────
        {"codigo":"GI001","nombre":"Consulta Ginecológica","especialidad":"Ginecología","precio_base":25.00},
        {"codigo":"GI002","nombre":"Paquete Consulta + Eco Pélvica","especialidad":"Ginecología","precio_base":39.00},
        # ── ECOGRAFÍAS ────────────────────────────────────────
        {"codigo":"EC001","nombre":"Electrocardiograma","especialidad":"Ecografía","precio_base":40.00},
        {"codigo":"EC002","nombre":"Ultrasonido Abdominal Completo","especialidad":"Ecografía","precio_base":40.00},
        {"codigo":"EC003","nombre":"Ultrasonido Abdomen Superior","especialidad":"Ecografía","precio_base":25.00},
        {"codigo":"EC004","nombre":"Ultrasonido Renal","especialidad":"Ecografía","precio_base":25.00},
        {"codigo":"EC005","nombre":"Ultrasonido Mamas / Testicular","especialidad":"Ecografía","precio_base":25.00},
        {"codigo":"EC006","nombre":"Ultrasonido Partes Blandas (rodilla, hombro, tobillo, talón)","especialidad":"Ecografía","precio_base":25.00},
        {"codigo":"EC007","nombre":"Ultrasonido Tiroides / Paratiroides","especialidad":"Ecografía","precio_base":25.00},
        {"codigo":"EC008","nombre":"Ultrasonido Vascular","especialidad":"Ecografía","precio_base":25.00},
        # ── ODONTOLOGÍA ───────────────────────────────────────
        {"codigo":"OD001","nombre":"Endodoncia","especialidad":"Odontología","precio_base":200.00},
        {"codigo":"OD002","nombre":"Retratamiento de Conducto","especialidad":"Odontología","precio_base":250.00},
        {"codigo":"OD003","nombre":"Corona Metal Porcelana","especialidad":"Odontología","precio_base":150.00},
        {"codigo":"OD004","nombre":"Corona Emax","especialidad":"Odontología","precio_base":260.00},
        {"codigo":"OD005","nombre":"Corona Zirconio","especialidad":"Odontología","precio_base":450.00},
        {"codigo":"OD006","nombre":"Poste Metálico","especialidad":"Odontología","precio_base":60.00},
        {"codigo":"OD007","nombre":"Poste de Fibra de Vidrio","especialidad":"Odontología","precio_base":80.00},
        {"codigo":"OD008","nombre":"Alargamiento Coronario (1 pieza)","especialidad":"Odontología","precio_base":20.00},
        {"codigo":"OD009","nombre":"Provisional","especialidad":"Odontología","precio_base":20.00},
        {"codigo":"OD010","nombre":"Incrustación Directa","especialidad":"Odontología","precio_base":50.00},
        {"codigo":"OD011","nombre":"Incrustación Indirecta","especialidad":"Odontología","precio_base":100.00},
        {"codigo":"OD012","nombre":"Cuello Tipo 1","especialidad":"Odontología","precio_base":10.00},
        {"codigo":"OD013","nombre":"Cuello Tipo 2","especialidad":"Odontología","precio_base":15.00},
        {"codigo":"OD014","nombre":"Cuello Tipo 3","especialidad":"Odontología","precio_base":20.00},
        {"codigo":"OD015","nombre":"Obturación Tipo 1","especialidad":"Odontología","precio_base":15.00},
        {"codigo":"OD016","nombre":"Obturación Tipo 2","especialidad":"Odontología","precio_base":20.00},
        {"codigo":"OD017","nombre":"Obturación Tipo 3","especialidad":"Odontología","precio_base":25.00},
        {"codigo":"OD018","nombre":"Gingivectomía 6 Piezas","especialidad":"Odontología","precio_base":130.00},
        {"codigo":"OD019","nombre":"Carilla de Resina","especialidad":"Odontología","precio_base":50.00},
        {"codigo":"OD020","nombre":"Diseño de Sonrisa 6 Piezas","especialidad":"Odontología","precio_base":250.00},
        {"codigo":"OD021","nombre":"Diseño de Sonrisa 8 Piezas","especialidad":"Odontología","precio_base":350.00},
        {"codigo":"OD022","nombre":"Blanqueamiento 1 Sesión","especialidad":"Odontología","precio_base":50.00},
        {"codigo":"OD023","nombre":"Blanqueamiento 2 Sesiones","especialidad":"Odontología","precio_base":100.00},
        {"codigo":"OD024","nombre":"Blanqueamiento 3 Sesiones","especialidad":"Odontología","precio_base":120.00},
        {"codigo":"OD025","nombre":"Profilaxis","especialidad":"Odontología","precio_base":15.00},
        {"codigo":"OD026","nombre":"Profilaxis Profunda","especialidad":"Odontología","precio_base":30.00},
        {"codigo":"OD027","nombre":"Detartraje","especialidad":"Odontología","precio_base":40.00},
        {"codigo":"OD028","nombre":"Placa Acrílica 1-3 Piezas","especialidad":"Odontología","precio_base":100.00},
        {"codigo":"OD029","nombre":"Placa Acrílica 4-6 Piezas","especialidad":"Odontología","precio_base":150.00},
        {"codigo":"OD030","nombre":"Placa Acrílica Total","especialidad":"Odontología","precio_base":250.00},
        {"codigo":"OD031","nombre":"Placa Acrílica con Malla","especialidad":"Odontología","precio_base":160.00},
        {"codigo":"OD032","nombre":"Placa Acrílica Estética","especialidad":"Odontología","precio_base":200.00},
        {"codigo":"OD033","nombre":"Placa Flex","especialidad":"Odontología","precio_base":260.00},
        {"codigo":"OD034","nombre":"Yker Flex","especialidad":"Odontología","precio_base":150.00},
        {"codigo":"OD035","nombre":"Cementación de Corona (otro lugar)","especialidad":"Odontología","precio_base":30.00},
        {"codigo":"OD036","nombre":"Inicio Ortodoncia Metálica","especialidad":"Odontología","precio_base":60.00},
        {"codigo":"OD037","nombre":"Control Ortodoncia Metálica","especialidad":"Odontología","precio_base":25.00},
        {"codigo":"OD038","nombre":"Reposición Ortodoncia Metálica","especialidad":"Odontología","precio_base":3.00},
        {"codigo":"OD039","nombre":"Inicio Ortodoncia Autoligado","especialidad":"Odontología","precio_base":170.00},
        {"codigo":"OD040","nombre":"Control Ortodoncia Autoligado","especialidad":"Odontología","precio_base":40.00},
        {"codigo":"OD041","nombre":"Reposición Ortodoncia Autoligado","especialidad":"Odontología","precio_base":5.00},
        {"codigo":"OD042","nombre":"Inicio Autoligado Estético","especialidad":"Odontología","precio_base":350.00},
        {"codigo":"OD043","nombre":"Control Autoligado Estético","especialidad":"Odontología","precio_base":60.00},
        {"codigo":"OD044","nombre":"Reposición Autoligado Estético","especialidad":"Odontología","precio_base":10.00},
        {"codigo":"OD045","nombre":"Inicio Ortodoncia Estética","especialidad":"Odontología","precio_base":70.00},
        {"codigo":"OD046","nombre":"Control Ortodoncia Estética","especialidad":"Odontología","precio_base":30.00},
        {"codigo":"OD047","nombre":"Extracción Simple","especialidad":"Odontología","precio_base":20.00},
        {"codigo":"OD048","nombre":"Extracción de Resto Radicular","especialidad":"Odontología","precio_base":35.00},
        {"codigo":"OD049","nombre":"Extracción Tercer Molar Tipo 1","especialidad":"Odontología","precio_base":40.00},
        {"codigo":"OD050","nombre":"Extracción Tercer Molar Tipo 2","especialidad":"Odontología","precio_base":80.00},
        {"codigo":"OD051","nombre":"Extracción Tercer Molar Tipo 3","especialidad":"Odontología","precio_base":150.00},
        {"codigo":"OD052","nombre":"Extracción Tercer Molar con Especialista","especialidad":"Odontología","precio_base":90.00},
        {"codigo":"OD053","nombre":"Implante + Cirugía (sin materiales)","especialidad":"Odontología","precio_base":850.00},
        {"codigo":"OD054","nombre":"Ortopedia Ambas Placas","especialidad":"Odontología","precio_base":170.00},
        {"codigo":"OD055","nombre":"Consulta Implantólogo","especialidad":"Odontología","precio_base":40.00},
        {"codigo":"OD056","nombre":"Consulta Periodoncista","especialidad":"Odontología","precio_base":50.00},
        {"codigo":"OD057","nombre":"Consulta Odontopediatría","especialidad":"Odontología","precio_base":40.00},
        {"codigo":"OD058","nombre":"Bichectomía","especialidad":"Odontología","precio_base":250.00},
        {"codigo":"OD059","nombre":"Lipo Papada 1 Sesión","especialidad":"Odontología","precio_base":160.00},
        {"codigo":"OD060","nombre":"Lipo Papada 2 Sesiones","especialidad":"Odontología","precio_base":320.00},
    ]

    count_new = 0
    count_updated = 0
    for srv in servicios_base:
        existing = await db.catalogo_servicios.find_one({"codigo": srv["codigo"]}, {"_id": 0})
        if not existing:
            servicio = CatalogoServicio(**srv)
            doc = servicio.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.catalogo_servicios.insert_one(doc)
            count_new += 1
        else:
            # Actualizar precio si cambió
            await db.catalogo_servicios.update_one(
                {"codigo": srv["codigo"]},
                {"$set": {"nombre": srv["nombre"], "precio_base": srv["precio_base"]}}
            )
            count_updated += 1

    return {
        "message": f"Catálogo actualizado: {count_new} nuevos, {count_updated} actualizados",
        "total": len(servicios_base)
    }



# ========== CRUD COMPLETO CATÁLOGO ==========

@financial_router.get("/catalogo/todos")
async def get_todos_servicios(
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener TODOS los servicios (activos e inactivos) para administración"""
    servicios = await db.catalogo_servicios.find({}, {"_id": 0}).to_list(500)
    return servicios


@financial_router.get("/catalogo/{servicio_id}")
async def get_servicio_by_id(
    servicio_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener servicio por ID"""
    servicio = await db.catalogo_servicios.find_one({"id": servicio_id}, {"_id": 0})
    if not servicio:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return servicio


@financial_router.put("/catalogo/{servicio_id}")
async def update_catalogo_servicio(
    servicio_id: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar servicio del catálogo"""
    existing = await db.catalogo_servicios.find_one({"id": servicio_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    
    # Campos permitidos para actualizar
    allowed_fields = ['nombre', 'descripcion', 'especialidad', 'precio_base', 'activo', 'codigo']
    update_data = {k: v for k, v in input.items() if k in allowed_fields and v is not None}
    
    if update_data:
        await db.catalogo_servicios.update_one({"id": servicio_id}, {"$set": update_data})
    
    updated = await db.catalogo_servicios.find_one({"id": servicio_id}, {"_id": 0})
    return updated


@financial_router.delete("/catalogo/{servicio_id}")
async def delete_catalogo_servicio(
    servicio_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Eliminar servicio del catálogo (soft delete - marca como inactivo)"""
    existing = await db.catalogo_servicios.find_one({"id": servicio_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    
    # Soft delete - marcar como inactivo
    await db.catalogo_servicios.update_one({"id": servicio_id}, {"$set": {"activo": False}})
    
    return {"message": "Servicio desactivado exitosamente"}


@financial_router.delete("/catalogo/{servicio_id}/permanente")
async def delete_catalogo_servicio_permanente(
    servicio_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Eliminar servicio permanentemente del catálogo"""
    result = await db.catalogo_servicios.delete_one({"id": servicio_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    
    return {"message": "Servicio eliminado permanentemente"}


# ========== REPORTES ==========

@financial_router.get("/reportes/resumen-paciente/{paciente_id}", response_model=ResumenPaciente)
async def get_resumen_paciente(
    paciente_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener resumen financiero de un paciente"""
    paciente = await db.pacientes.find_one({"id": paciente_id}, {"_id": 0})
    if not paciente:
        # Buscar por cédula
        paciente = await db.pacientes.find_one({"cedula": paciente_id}, {"_id": 0})
    
    consultas = await db.consultas_financieras.find(
        {"paciente_id": paciente_id}, {"_id": 0}
    ).to_list(500)
    
    # Si no hay paciente registrado pero hay consultas, buscar en appointments
    if not paciente and consultas:
        paciente = {
            "id": paciente_id,
            "cedula": consultas[0].get("paciente_cedula", ""),
            "nombre": consultas[0].get("paciente_nombre", "")
        }
    
    total_facturado = sum(c.get('total', 0) for c in consultas)
    total_pagado = sum(c.get('total_pagado', 0) for c in consultas)
    
    return ResumenPaciente(
        paciente_id=paciente.get("id", paciente_id) if paciente else paciente_id,
        paciente_nombre=paciente.get("nombre", "") if paciente else "",
        paciente_cedula=paciente.get("cedula", "") if paciente else "",
        total_consultas=len(consultas),
        total_facturado=total_facturado,
        total_pagado=total_pagado,
        saldo_total=total_facturado - total_pagado,
        consultas=[{
            "id": c.get("id"),
            "fecha": c.get("fecha"),
            "especialidad": c.get("especialidad"),
            "total": c.get("total"),
            "saldo": c.get("saldo"),
            "estado_pago": c.get("estado_pago")
        } for c in consultas]
    )


@financial_router.get("/reportes/mensual")
async def get_reporte_mensual(
    mes: str,  # Formato: "2024-01"
    current_user: TokenData = Depends(get_current_user)
):
    """Generar reporte mensual completo"""
    # Calcular rango de fechas
    year, month = mes.split("-")
    fecha_inicio = f"{mes}-01"
    
    # Último día del mes
    if int(month) == 12:
        fecha_fin = f"{int(year)+1}-01-01"
    else:
        fecha_fin = f"{year}-{int(month)+1:02d}-01"
    
    consultas = await db.consultas_financieras.find({
        "fecha": {"$gte": fecha_inicio, "$lt": fecha_fin}
    }, {"_id": 0}).to_list(1000)
    
    # Totales
    total_facturado = sum(c.get('total', 0) for c in consultas)
    total_cobrado = sum(c.get('total_pagado', 0) for c in consultas)
    total_pendiente = total_facturado - total_cobrado
    
    # Por tipo de pago
    pagos_por_tipo = {"efectivo": 0, "transferencia": 0, "tarjeta": 0, "otros": 0}
    for c in consultas:
        for p in c.get('pagos', []):
            tipo = p.get('tipo_pago', 'otros').lower()
            if tipo in pagos_por_tipo:
                pagos_por_tipo[tipo] += p.get('monto', 0)
            else:
                pagos_por_tipo['otros'] += p.get('monto', 0)
    
    # Por doctor
    por_doctor = {}
    for c in consultas:
        doctor = c.get('doctor_nombre', 'Sin asignar')
        if doctor not in por_doctor:
            por_doctor[doctor] = {"consultas": 0, "facturado": 0, "cobrado": 0}
        por_doctor[doctor]["consultas"] += 1
        por_doctor[doctor]["facturado"] += c.get('total', 0)
        por_doctor[doctor]["cobrado"] += c.get('total_pagado', 0)
    
    # Por especialidad
    por_especialidad = {}
    for c in consultas:
        esp = c.get('especialidad', 'Sin especialidad')
        if esp not in por_especialidad:
            por_especialidad[esp] = {"consultas": 0, "facturado": 0, "cobrado": 0}
        por_especialidad[esp]["consultas"] += 1
        por_especialidad[esp]["facturado"] += c.get('total', 0)
        por_especialidad[esp]["cobrado"] += c.get('total_pagado', 0)
    
    return {
        "periodo": mes,
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "total_consultas": len(consultas),
        "total_facturado": total_facturado,
        "total_cobrado": total_cobrado,
        "total_pendiente": total_pendiente,
        **pagos_por_tipo,
        "por_doctor": [{"doctor": k, **v} for k, v in por_doctor.items()],
        "por_especialidad": [{"especialidad": k, **v} for k, v in por_especialidad.items()]
    }


@financial_router.get("/reportes/pendientes")
async def get_cuentas_pendientes(
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener todas las cuentas con saldo pendiente"""
    consultas = await db.consultas_financieras.find({
        "estado_pago": {"$in": ["pendiente", "parcial"]}
    }, {"_id": 0}).sort("fecha", -1).to_list(500)
    
    total_pendiente = sum(c.get('saldo', 0) for c in consultas)
    
    return {
        "total_cuentas": len(consultas),
        "total_pendiente": total_pendiente,
        "cuentas": [{
            "id": c.get("id"),
            "fecha": c.get("fecha"),
            "paciente_nombre": c.get("paciente_nombre"),
            "paciente_cedula": c.get("paciente_cedula"),
            "especialidad": c.get("especialidad"),
            "total": c.get("total"),
            "total_pagado": c.get("total_pagado"),
            "saldo": c.get("saldo"),
            "estado_pago": c.get("estado_pago")
        } for c in consultas]
    }


# ========== CREAR CONSULTA DESDE CIERRE DE ATENCIÓN MÉDICA ==========

@financial_router.post("/consultas/desde-cita/{appointment_id}")
async def crear_consulta_desde_cita(
    appointment_id: str,
    servicios: List[DetalleServicioCreate],
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crea una consulta financiera automáticamente al cerrar una atención médica.
    Usado para Medicina General, Pediatría, etc.
    """
    # Verificar que no exista ya una consulta para esta cita
    existing = await db.consultas_financieras.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Ya existe una consulta financiera para esta cita"
        )
    
    # Obtener datos de la cita
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    
    # Obtener datos del doctor
    doctor = await db.doctors.find_one({"id": appointment.get("doctor_id")}, {"_id": 0})
    doctor_nombre = doctor.get("nombre", "") if doctor else appointment.get("doctor_nombre", "")
    
    # Crear servicios con subtotales
    servicios_list = []
    total = 0
    for srv in servicios:
        servicio = DetalleServicio(
            consulta_id="",
            servicio=srv.servicio,
            descripcion=srv.descripcion,
            precio_unitario=srv.precio_unitario,
            cantidad=srv.cantidad,
            subtotal=srv.precio_unitario * srv.cantidad
        )
        total += servicio.subtotal
        servicios_list.append(servicio)
    
    # Buscar cédula con fallback para garantizar que no quede vacía
    cedula_paciente = (
        appointment.get("cedula") or
        appointment.get("paciente_cedula") or
        ""
    )
    if not cedula_paciente:
        paciente_db = await db.pacientes.find_one(
            {"nombre": {"$regex": appointment.get("nombre_completo", ""), "$options": "i"}},
            {"_id": 0}
        )
        if paciente_db:
            cedula_paciente = paciente_db.get("cedula", "")

    # Crear consulta financiera
    consulta = ConsultaFinanciera(
        paciente_id=appointment_id,
        paciente_cedula=cedula_paciente,
        paciente_nombre=appointment.get("nombre_completo", ""),
        doctor_id=appointment.get("doctor_id", ""),
        doctor_nombre=doctor_nombre,
        appointment_id=appointment_id,
        especialidad=appointment.get("especialidad", ""),
        fecha=appointment.get("fecha", datetime.now(timezone.utc).strftime('%Y-%m-%d')),
        motivo=appointment.get("observaciones", ""),
        total=total,
        total_pagado=0,
        saldo=total,
        estado_pago="pendiente" if total > 0 else "pagado",
        servicios=[],
        pagos=[],
        created_by=current_user.username
    )
    
    # Actualizar consulta_id en servicios
    for srv in servicios_list:
        srv.consulta_id = consulta.id
    consulta.servicios = servicios_list
    
    # Guardar
    doc = consulta.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    for srv in doc['servicios']:
        srv['created_at'] = srv['created_at'].isoformat()
    
    await db.consultas_financieras.insert_one(doc)
    
    return {
        "message": "Consulta financiera creada exitosamente",
        "consulta_id": consulta.id,
        "total": total,
        "estado_pago": consulta.estado_pago
    }


# ========== CONVERTIR PROFORMA EN CONSULTA FINANCIERA (ODONTOLOGÍA) ==========

@financial_router.post("/consultas/desde-proforma/{proforma_id}")
async def crear_consulta_desde_proforma(
    proforma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Convierte una proforma aprobada en una consulta financiera.
    Usado para Odontología cuando se aprueba un tratamiento.
    La proforma debe tener estado 'Aceptada'.
    """
    # Obtener proforma
    proforma = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")
    
    if proforma.get("estado") != "Aceptada":
        raise HTTPException(
            status_code=400, 
            detail="Solo se pueden convertir proformas con estado 'Aceptada'"
        )
    
    # Verificar que no exista ya una consulta para esta proforma
    existing = await db.consultas_financieras.find_one(
        {"proforma_origen_id": proforma_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Ya existe una consulta financiera para esta proforma"
        )
    
    # Obtener datos del doctor
    doctor = await db.doctors.find_one({"id": proforma.get("doctor_id")}, {"_id": 0})
    doctor_nombre = doctor.get("nombre", "") if doctor else proforma.get("doctor_nombre", "")
    
    # Crear servicios desde items de proforma
    servicios_list = []
    total = 0
    for item in proforma.get("items", []):
        servicio = DetalleServicio(
            consulta_id="",
            servicio=item.get("tratamiento", ""),
            descripcion=item.get("descripcion", ""),
            precio_unitario=item.get("precio", 0),
            cantidad=item.get("cantidad", 1),
            subtotal=item.get("subtotal", item.get("precio", 0) * item.get("cantidad", 1))
        )
        total += servicio.subtotal
        servicios_list.append(servicio)
    
    # Aplicar descuento si existe
    descuento = proforma.get("descuento", 0)
    total_con_descuento = total - descuento
    
    # Crear consulta financiera
    consulta = ConsultaFinanciera(
        paciente_id=proforma.get("paciente_id", ""),
        paciente_cedula=proforma.get("paciente_cedula", ""),
        paciente_nombre=proforma.get("paciente_nombre", ""),
        doctor_id=proforma.get("doctor_id", ""),
        doctor_nombre=doctor_nombre,
        appointment_id="",  # Puede no tener cita asociada
        especialidad="Odontología",
        fecha=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        motivo=f"Tratamiento desde Proforma {proforma.get('numero_proforma', '')}",
        diagnostico=proforma.get("diagnostico", ""),
        total=total_con_descuento,
        total_pagado=0,
        saldo=total_con_descuento,
        estado_pago="pendiente" if total_con_descuento > 0 else "pagado",
        servicios=[],
        pagos=[],
        created_by=current_user.username
    )
    
    # Agregar campo especial para rastrear origen
    consulta_dict = consulta.model_dump()
    consulta_dict['proforma_origen_id'] = proforma_id
    
    # Actualizar consulta_id en servicios
    for srv in servicios_list:
        srv.consulta_id = consulta.id
    consulta.servicios = servicios_list
    consulta_dict['servicios'] = [srv.model_dump() for srv in servicios_list]
    
    # Guardar
    consulta_dict['created_at'] = consulta_dict['created_at'].isoformat()
    consulta_dict['updated_at'] = consulta_dict['updated_at'].isoformat()
    for srv in consulta_dict['servicios']:
        srv['created_at'] = srv['created_at'].isoformat()
    
    await db.consultas_financieras.insert_one(consulta_dict)
    
    # Actualizar estado de proforma a "Facturada"
    await db.proformas.update_one(
        {"id": proforma_id},
        {"$set": {"estado": "Facturada", "consulta_financiera_id": consulta.id}}
    )
    
    return {
        "message": "Proforma convertida a consulta financiera exitosamente",
        "consulta_id": consulta.id,
        "total": total_con_descuento,
        "estado_pago": consulta.estado_pago
    }


# ========== OBTENER CONSULTA POR APPOINTMENT ==========



# ========== ELIMINAR PAGO DE CONSULTA ==========

@financial_router.delete("/consultas/{consulta_id}/pagos/{pago_id}")
async def eliminar_pago(
    consulta_id: str,
    pago_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Eliminar un pago de una consulta y recalcular saldos"""
    consulta = await db.consultas_financieras.find_one({"id": consulta_id}, {"_id": 0})
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta no encontrada")
    
    # Filtrar el pago a eliminar
    pagos = [p for p in consulta.get('pagos', []) if p.get('id') != pago_id]
    
    if len(pagos) == len(consulta.get('pagos', [])):
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    # Recalcular totales
    total = consulta.get('total', 0)
    total_pagado = sum(p.get('monto', 0) for p in pagos)
    saldo = total - total_pagado
    
    # Determinar estado de pago
    if saldo <= 0:
        estado_pago = "pagado"
        saldo = 0
    elif total_pagado > 0:
        estado_pago = "parcial"
    else:
        estado_pago = "pendiente"
    
    # Actualizar
    await db.consultas_financieras.update_one(
        {"id": consulta_id},
        {"$set": {
            "pagos": pagos,
            "total_pagado": total_pagado,
            "saldo": saldo,
            "estado_pago": estado_pago,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "Pago eliminado exitosamente",
        "total_pagado": total_pagado,
        "saldo": saldo,
        "estado_pago": estado_pago
    }




# ========== REPORTES ADICIONALES ==========

@financial_router.get("/reportes/ingresos-del-dia")
async def reporte_ingresos_del_dia(
    fecha: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Reporte de ingresos del día
    Muestra todos los pagos realizados en una fecha específica
    """
    from datetime import datetime as dt
    
    if not fecha:
        fecha = dt.now().strftime("%Y-%m-%d")
    
    # Buscar todos los pagos del día
    consultas = await db.consultas_financieras.find(
        {"pagos.fecha": {"$regex": f"^{fecha}"}},
        {"_id": 0}
    ).to_list(1000)
    
    total_efectivo = 0
    total_transferencia = 0
    total_tarjeta = 0
    total_seguro = 0
    total_otros = 0
    num_transacciones = 0
    detalles = []
    
    for consulta in consultas:
        for pago in consulta.get('pagos', []):
            if pago.get('fecha', '').startswith(fecha):
                tipo_pago = pago.get('tipo_pago', 'otros').lower()
                monto = pago.get('monto', 0)
                
                if tipo_pago == 'efectivo':
                    total_efectivo += monto
                elif tipo_pago == 'transferencia':
                    total_transferencia += monto
                elif tipo_pago == 'tarjeta':
                    total_tarjeta += monto
                elif tipo_pago == 'seguro':
                    total_seguro += monto
                else:
                    total_otros += monto
                
                num_transacciones += 1
                
                detalles.append({
                    "consulta_id": consulta.get('id'),
                    "paciente_nombre": consulta.get('paciente_nombre'),
                    "paciente_cedula": consulta.get('paciente_cedula'),
                    "especialidad": consulta.get('especialidad'),
                    "doctor_nombre": consulta.get('doctor_nombre'),
                    "monto": monto,
                    "tipo_pago": tipo_pago,
                    "referencia": pago.get('referencia', ''),
                    "hora": pago.get('fecha', '').split(' ')[-1] if ' ' in pago.get('fecha', '') else ''
                })
    
    total_general = total_efectivo + total_transferencia + total_tarjeta + total_seguro + total_otros
    
    return {
        "fecha": fecha,
        "total_efectivo": round(total_efectivo, 2),
        "total_transferencia": round(total_transferencia, 2),
        "total_tarjeta": round(total_tarjeta, 2),
        "total_seguro": round(total_seguro, 2),
        "total_otros": round(total_otros, 2),
        "total_general": round(total_general, 2),
        "num_transacciones": num_transacciones,
        "detalles": detalles
    }


@financial_router.get("/reportes/por-especialidad")
async def reporte_por_especialidad(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Reporte de ingresos agrupados por especialidad
    """
    from datetime import datetime as dt
    from collections import defaultdict
    
    if not fecha_inicio:
        fecha_inicio = dt.now().strftime("%Y-%m-%d")
    if not fecha_fin:
        fecha_fin = fecha_inicio
    
    query = {"fecha": {"$gte": fecha_inicio, "$lte": fecha_fin}}
    consultas = await db.consultas_financieras.find(query, {"_id": 0}).to_list(1000)
    
    por_especialidad = defaultdict(lambda: {"total_facturado": 0, "total_cobrado": 0, "num_consultas": 0})
    
    for consulta in consultas:
        esp = consulta.get('especialidad', 'Sin Especialidad')
        por_especialidad[esp]["total_facturado"] += consulta.get('total', 0)
        por_especialidad[esp]["total_cobrado"] += consulta.get('total_pagado', 0)
        por_especialidad[esp]["num_consultas"] += 1
    
    resultado = []
    for esp, datos in por_especialidad.items():
        resultado.append({
            "especialidad": esp,
            "num_consultas": datos["num_consultas"],
            "total_facturado": round(datos["total_facturado"], 2),
            "total_cobrado": round(datos["total_cobrado"], 2),
            "saldo_pendiente": round(datos["total_facturado"] - datos["total_cobrado"], 2)
        })
    
    resultado.sort(key=lambda x: x["total_cobrado"], reverse=True)
    
    return {
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "especialidades": resultado,
        "total_facturado": round(sum(r["total_facturado"] for r in resultado), 2),
        "total_cobrado": round(sum(r["total_cobrado"] for r in resultado), 2)
    }


@financial_router.get("/reportes/por-doctor")
async def reporte_por_doctor(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Reporte de ingresos agrupados por doctor
    """
    from datetime import datetime as dt
    from collections import defaultdict
    
    if not fecha_inicio:
        fecha_inicio = dt.now().strftime("%Y-%m-%d")
    if not fecha_fin:
        fecha_fin = fecha_inicio
    
    query = {"fecha": {"$gte": fecha_inicio, "$lte": fecha_fin}}
    consultas = await db.consultas_financieras.find(query, {"_id": 0}).to_list(1000)
    
    por_doctor = defaultdict(lambda: {"total_facturado": 0, "total_cobrado": 0, "num_consultas": 0, "especialidad": ""})
    
    for consulta in consultas:
        doctor = consulta.get('doctor_nombre', 'Sin Doctor')
        doctor_id = consulta.get('doctor_id', '')
        por_doctor[doctor]["doctor_id"] = doctor_id
        por_doctor[doctor]["total_facturado"] += consulta.get('total', 0)
        por_doctor[doctor]["total_cobrado"] += consulta.get('total_pagado', 0)
        por_doctor[doctor]["num_consultas"] += 1
        if not por_doctor[doctor]["especialidad"]:
            por_doctor[doctor]["especialidad"] = consulta.get('especialidad', '')
    
    resultado = []
    for doctor, datos in por_doctor.items():
        resultado.append({
            "doctor_nombre": doctor,
            "doctor_id": datos["doctor_id"],
            "especialidad": datos["especialidad"],
            "num_consultas": datos["num_consultas"],
            "total_facturado": round(datos["total_facturado"], 2),
            "total_cobrado": round(datos["total_cobrado"], 2),
            "saldo_pendiente": round(datos["total_facturado"] - datos["total_cobrado"], 2)
        })
    
    resultado.sort(key=lambda x: x["total_cobrado"], reverse=True)
    
    return {
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "doctores": resultado,
        "total_facturado": round(sum(r["total_facturado"] for r in resultado), 2),
        "total_cobrado": round(sum(r["total_cobrado"] for r in resultado), 2)
    }


@financial_router.get("/reportes/por-tipo-pago")
async def reporte_por_tipo_pago(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Reporte de ingresos agrupados por tipo de pago
    """
    from datetime import datetime as dt
    from collections import defaultdict
    
    if not fecha_inicio:
        fecha_inicio = dt.now().strftime("%Y-%m-%d")
    if not fecha_fin:
        fecha_fin = fecha_inicio
    
    # Buscar consultas en el rango de fechas
    consultas = await db.consultas_financieras.find(
        {"fecha": {"$gte": fecha_inicio, "$lte": fecha_fin}},
        {"_id": 0}
    ).to_list(1000)
    
    por_tipo = defaultdict(lambda: {"total": 0, "num_pagos": 0})
    
    for consulta in consultas:
        for pago in consulta.get('pagos', []):
            # Verificar que el pago esté en el rango de fechas
            fecha_pago = pago.get('fecha', '').split(' ')[0]
            if fecha_inicio <= fecha_pago <= fecha_fin:
                tipo = pago.get('tipo_pago', 'otros')
                por_tipo[tipo]["total"] += pago.get('monto', 0)
                por_tipo[tipo]["num_pagos"] += 1
    
    resultado = []
    for tipo, datos in por_tipo.items():
        resultado.append({
            "tipo_pago": tipo,
            "num_pagos": datos["num_pagos"],
            "total": round(datos["total"], 2)
        })
    
    resultado.sort(key=lambda x: x["total"], reverse=True)
    
    return {
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "tipos_pago": resultado,
        "total_general": round(sum(r["total"] for r in resultado), 2)
    }


# ========== CIERRE DE CAJA ==========

@financial_router.post("/cierre-caja", response_model=CierreCaja)
async def crear_cierre_caja(
    input: CierreCajaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crear cierre de caja diario
    Calcula automáticamente todos los totales del día
    """
    # Verificar que no exista ya un cierre para esta fecha
    existing = await db.cierres_caja.find_one({"fecha": input.fecha, "estado": "cerrado"}, {"_id": 0})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un cierre de caja cerrado para la fecha {input.fecha}"
        )
    
    # Obtener reporte del día
    reporte_dia = await reporte_ingresos_del_dia(fecha=input.fecha, current_user=current_user)
    
    # Obtener resúmenes
    reporte_especialidades = await reporte_por_especialidad(
        fecha_inicio=input.fecha,
        fecha_fin=input.fecha,
        current_user=current_user
    )
    
    reporte_doctores = await reporte_por_doctor(
        fecha_inicio=input.fecha,
        fecha_fin=input.fecha,
        current_user=current_user
    )
    
    # Crear cierre
    cierre = CierreCaja(
        fecha=input.fecha,
        usuario_cierre=current_user.username,
        usuario_nombre=current_user.username,
        total_efectivo=reporte_dia["total_efectivo"],
        total_transferencia=reporte_dia["total_transferencia"],
        total_tarjeta=reporte_dia["total_tarjeta"],
        total_seguro=reporte_dia.get("total_seguro", 0),
        total_otros=reporte_dia.get("total_otros", 0),
        total_general=reporte_dia["total_general"],
        num_transacciones=reporte_dia["num_transacciones"],
        observaciones=input.observaciones,
        estado="cerrado",
        por_especialidad=reporte_especialidades.get("especialidades", []),
        por_doctor=reporte_doctores.get("doctores", [])
    )
    
    doc = cierre.model_dump()
    doc['fecha_cierre'] = doc['fecha_cierre'].isoformat()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.cierres_caja.insert_one(doc)
    
    return cierre


@financial_router.get("/cierres-caja", response_model=List[CierreCaja])
async def get_cierres_caja(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Obtener historial de cierres de caja
    """
    query = {}
    if fecha_inicio and fecha_fin:
        query["fecha"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    elif fecha_inicio:
        query["fecha"] = {"$gte": fecha_inicio}
    
    cierres = await db.cierres_caja.find(query, {"_id": 0}).sort("fecha", -1).to_list(1000)
    
    for c in cierres:
        if isinstance(c.get('fecha_cierre'), str):
            c['fecha_cierre'] = datetime.fromisoformat(c['fecha_cierre'])
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
    
    return cierres


@financial_router.get("/cierre-caja/{cierre_id}", response_model=CierreCaja)
async def get_cierre_caja(
    cierre_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Obtener un cierre de caja específico
    """
    cierre = await db.cierres_caja.find_one({"id": cierre_id}, {"_id": 0})
    if not cierre:
        raise HTTPException(status_code=404, detail="Cierre de caja no encontrado")
    
    if isinstance(cierre.get('fecha_cierre'), str):
        cierre['fecha_cierre'] = datetime.fromisoformat(cierre['fecha_cierre'])
    if isinstance(cierre.get('created_at'), str):
        cierre['created_at'] = datetime.fromisoformat(cierre['created_at'])
    
    return cierre