# ========== MÓDULO FINANCIERO - ENDPOINTS ==========
# Sistema SaaS Clínico Multiespecialidad

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import uuid

from financial_models import (
    Paciente, PacienteCreate, PacienteUpdate,
    ConsultaFinanciera, ConsultaFinancieraCreate, ConsultaFinancieraUpdate,
    DetalleServicio, DetalleServicioCreate,
    Pago, PagoCreate,
    CatalogoServicio, CatalogoServicioCreate,
    ReporteFinanciero, ResumenPaciente
)
from auth import TokenData, get_current_user

# Router para endpoints financieros
financial_router = APIRouter(prefix="/financial", tags=["Financial"])

# MongoDB Atlas Connection (same as server.py)
MONGO_URL = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'family_health_db')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


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
    """Poblar catálogo con servicios base"""
    servicios_base = [
        # Medicina General
        {"codigo": "MG001", "nombre": "Consulta General", "especialidad": "Medicina General", "precio_base": 25.00},
        {"codigo": "MG002", "nombre": "Control de Presión", "especialidad": "Medicina General", "precio_base": 15.00},
        {"codigo": "MG003", "nombre": "Certificado Médico", "especialidad": "Medicina General", "precio_base": 20.00},
        {"codigo": "MG004", "nombre": "Inyección Intramuscular", "especialidad": "Medicina General", "precio_base": 5.00},
        {"codigo": "MG005", "nombre": "Curación Herida", "especialidad": "Medicina General", "precio_base": 15.00},
        
        # Odontología
        {"codigo": "OD001", "nombre": "Consulta Odontológica", "especialidad": "Odontología", "precio_base": 25.00},
        {"codigo": "OD002", "nombre": "Limpieza Dental", "especialidad": "Odontología", "precio_base": 35.00},
        {"codigo": "OD003", "nombre": "Extracción Simple", "especialidad": "Odontología", "precio_base": 30.00},
        {"codigo": "OD004", "nombre": "Extracción Compleja", "especialidad": "Odontología", "precio_base": 50.00},
        {"codigo": "OD005", "nombre": "Resina (Calza)", "especialidad": "Odontología", "precio_base": 40.00},
        {"codigo": "OD006", "nombre": "Endodoncia", "especialidad": "Odontología", "precio_base": 150.00},
        {"codigo": "OD007", "nombre": "Corona Dental", "especialidad": "Odontología", "precio_base": 200.00},
        {"codigo": "OD008", "nombre": "Blanqueamiento", "especialidad": "Odontología", "precio_base": 100.00},
        {"codigo": "OD009", "nombre": "Rayos X Dental", "especialidad": "Odontología", "precio_base": 15.00},
        
        # Pediatría
        {"codigo": "PD001", "nombre": "Consulta Pediátrica", "especialidad": "Pediatría", "precio_base": 30.00},
        {"codigo": "PD002", "nombre": "Control Crecimiento", "especialidad": "Pediatría", "precio_base": 25.00},
        {"codigo": "PD003", "nombre": "Vacunación", "especialidad": "Pediatría", "precio_base": 20.00},
        
        # Ginecología
        {"codigo": "GI001", "nombre": "Consulta Ginecológica", "especialidad": "Ginecología", "precio_base": 35.00},
        {"codigo": "GI002", "nombre": "Papanicolau", "especialidad": "Ginecología", "precio_base": 30.00},
        {"codigo": "GI003", "nombre": "Ecografía Pélvica", "especialidad": "Ginecología", "precio_base": 50.00},
        {"codigo": "GI004", "nombre": "Control Prenatal", "especialidad": "Ginecología", "precio_base": 35.00},
    ]
    
    count = 0
    for srv in servicios_base:
        existing = await db.catalogo_servicios.find_one({"codigo": srv["codigo"]}, {"_id": 0})
        if not existing:
            servicio = CatalogoServicio(**srv)
            doc = servicio.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.catalogo_servicios.insert_one(doc)
            count += 1
    
    return {"message": f"Creados {count} servicios en catálogo", "total": len(servicios_base)}


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
    
    # Crear consulta financiera
    consulta = ConsultaFinanciera(
        paciente_id=appointment_id,
        paciente_cedula=appointment.get("cedula", ""),
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

@financial_router.get("/consultas/por-cita/{appointment_id}")
async def get_consulta_por_cita(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener consulta financiera por ID de cita"""
    consulta = await db.consultas_financieras.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not consulta:
        return None
    return consulta


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
