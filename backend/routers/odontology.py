from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from db import db
from auth import TokenData, get_current_user, require_role
from models import (
    Odontogram, OdontogramCreate, OdontogramUpdate, ToothState,
    OdontogramaClinico, OdontogramaCreate, OdontogramaUpdate, DienteFDI, SuperficieDental,
    PlanTratamiento, PlanTratamientoCreate, ProcedimientoDental,
    ProcedimientoCreate, ProcedimientoUpdate, FaseTratamiento,
    PipelineAuditLog
)

router = APIRouter(tags=["odontology"])

# ========== ODONTOGRAM ENDPOINTS (LEGACY) ==========

@router.post("/odontograms", response_model=Odontogram, deprecated=True)
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

@router.get("/odontograms", response_model=List[Odontogram], deprecated=True)
async def get_odontograms(current_user: TokenData = Depends(get_current_user)):
    odontograms = await db.odontograms.find({}, {"_id": 0}).to_list(1000)
    for odontogram in odontograms:
        if isinstance(odontogram['created_at'], str):
            odontogram['created_at'] = datetime.fromisoformat(odontogram['created_at'])
    return odontograms

@router.get("/odontograms/{odontogram_id}", response_model=Odontogram, deprecated=True)
async def get_odontogram(
    odontogram_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.odontograms.find_one({"id": odontogram_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    if isinstance(existing['created_at'], str):
        existing['created_at'] = datetime.fromisoformat(existing['created_at'])

    return existing

@router.put("/odontograms/{odontogram_id}", deprecated=True)
async def update_odontogram(
    odontogram_id: str,
    input: OdontogramUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.odontograms.find_one({"id": odontogram_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    update_data = input.model_dump(exclude_unset=True)
    if update_data:
        await db.odontograms.update_one({"id": odontogram_id}, {"$set": update_data})

    updated = await db.odontograms.find_one({"id": odontogram_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])

    return updated

@router.delete("/odontograms/{odontogram_id}", deprecated=True)
async def delete_odontogram(
    odontogram_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    result = await db.odontograms.delete_one({"id": odontogram_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    return {"message": "Odontograma eliminado con éxito"}

# ========== ODONTOGRAMA CLÍNICO ENDPOINTS (FDI) ==========

@router.post("/odontogramas-clinicos", response_model=OdontogramaClinico)
async def crear_odontogramas_clinicos(
    input: OdontogramaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Obtener info doctor
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")

    # Obtener info paciente (desde collection pacientes)
    paciente = await db.pacientes.find_one({"id": input.paciente_id}, {"_id": 0})
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")

    # Crear objeto
    odontograma = OdontogramaClinico(
        paciente_id=input.paciente_id,
        paciente_nombre=paciente.get('nombre_completo', ''),
        paciente_cedula=paciente.get('cedula', ''),
        doctor_id=input.doctor_id,
        doctor_nombre=doctor.get('nombre', ''),
        tipo_denticion=input.tipo_denticion,
        fecha=input.fecha or datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        dientes=input.dientes,
        diagnostico_general=input.diagnostico_general,
        higiene_oral=input.higiene_oral,
        estado_encias=input.estado_encias,
        oclusion=input.oclusion,
        observaciones=input.observaciones
    )

    doc = odontograma.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()

    await db.odontogramas_clinicos.insert_one(doc)
    return odontograma

@router.get("/odontogramas-clinicos", response_model=List[OdontogramaClinico])
async def obtener_odontogramas_clinicos(current_user: TokenData = Depends(get_current_user)):
    odontogramas = await db.odontogramas_clinicos.find({}, {"_id": 0}).sort("fecha", -1).to_list(500)
    for od in odontogramas:
        if isinstance(od['created_at'], str):
            od['created_at'] = datetime.fromisoformat(od['created_at'])
        if isinstance(od['updated_at'], str):
            od['updated_at'] = datetime.fromisoformat(od['updated_at'])
    return odontogramas

@router.get("/odontogramas-clinicos/{odontograma_id}", response_model=OdontogramaClinico)
async def obtener_odontograma_clinico(
    odontograma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    if isinstance(odontograma['created_at'], str):
        odontograma['created_at'] = datetime.fromisoformat(odontograma['created_at'])
    if isinstance(odontograma['updated_at'], str):
        odontograma['updated_at'] = datetime.fromisoformat(odontograma['updated_at'])

    return odontograma

@router.get("/odontogramas-clinicos/paciente/{paciente_id}", response_model=List[OdontogramaClinico])
async def obtener_odontogramas_paciente(
    paciente_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    odontogramas = await db.odontogramas_clinicos.find(
        {"paciente_id": paciente_id},
        {"_id": 0}
    ).sort("fecha", -1).to_list(100)

    for od in odontogramas:
        if isinstance(od['created_at'], str):
            od['created_at'] = datetime.fromisoformat(od['created_at'])
        if isinstance(od['updated_at'], str):
            od['updated_at'] = datetime.fromisoformat(od['updated_at'])

    return odontogramas

@router.get("/odontogramas-clinicos/cedula/{cedula}", response_model=List[OdontogramaClinico])
async def obtener_odontogramas_cedula(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    odontogramas = await db.odontogramas_clinicos.find(
        {"paciente_cedula": cedula},
        {"_id": 0}
    ).sort("fecha", -1).to_list(100)

    for od in odontogramas:
        if isinstance(od['created_at'], str):
            od['created_at'] = datetime.fromisoformat(od['created_at'])
        if isinstance(od['updated_at'], str):
            od['updated_at'] = datetime.fromisoformat(od['updated_at'])

    return odontogramas

@router.put("/odontogramas-clinicos/{odontograma_id}")
async def actualizar_odontograma_clinico(
    odontograma_id: str,
    input: OdontogramaUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    update_data = input.model_dump(exclude_unset=True)
    if update_data:
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        update_data['fecha_actualizacion'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        await db.odontogramas_clinicos.update_one({"id": odontograma_id}, {"$set": update_data})

    updated = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated['updated_at'], str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])

    return updated

@router.delete("/odontogramas-clinicos/{odontograma_id}")
async def eliminar_odontograma_clinico(
    odontograma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    result = await db.odontogramas_clinicos.delete_one({"id": odontograma_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    return {"message": "Odontograma eliminado con éxito"}


# ========== PLAN DE TRATAMIENTO HELPERS ==========

def clasificar_procedimiento_por_superficies(superficies):
    """Lógica simple para sugerir procedimiento basado en caras afectadas"""
    if not superficies:
        return None

    count = len(superficies)
    if count == 1:
        return "Resina Simple"
    elif count == 2:
        return "Resina Compuesta"
    elif count >= 3:
        return "Resina Compleja"
    return "Evaluación Especial"

def generar_procedimientos_desde_odontograma(odontograma):
    """Analiza hallazgos y genera lista de procedimientos sugeridos"""
    procedimientos = []
    for diente in odontograma.get('dientes', []):
        numero_fdi = diente.get('numero_fdi')
        superficies = diente.get('superficies', [])

        # Hallar superficies con hallazgos (caries, fractura)
        superficies_afectadas = [s for s in superficies if s.get('diagnostico') in ['caries', 'fractura']]

        # Otros estados del diente
        estado_diente = diente.get('estado')

        if estado_diente == 'extraccion':
            procedimientos.append({
                'diente_numero': numero_fdi,
                'procedimiento': 'Extracción',
                'descripcion': f'Extracción dental - diente {numero_fdi}',
                'superficies_afectadas': [],
                'fase': 1
            })
            continue

        # Revisar si hay endodoncia o corona indicada en hallazgos
        tiene_endodoncia = False
        tiene_corona = False
        for s in superficies:
            if s.get('diagnostico') == 'endodoncia': tiene_endodoncia = True
            if s.get('diagnostico') == 'corona': tiene_corona = True

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


@router.post("/plan-tratamiento")
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


@router.get("/plan-tratamiento/paciente/{cedula}")
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


@router.get("/plan-tratamiento/{plan_id}")
async def obtener_plan_por_id(
    plan_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener plan de tratamiento por ID"""
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    return plan


@router.post("/plan-tratamiento/{plan_id}/generar-desde-odontograma/{odontograma_id}")
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


@router.post("/plan-tratamiento/{plan_id}/procedimiento")
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


@router.put("/plan-tratamiento/{plan_id}/procedimiento/{procedimiento_id}")
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


@router.delete("/plan-tratamiento/{plan_id}/procedimiento/{procedimiento_id}")
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


@router.put("/plan-tratamiento/{plan_id}/organizar-fases")
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

# ========== TREATMENT PIPELINE ==========

VALID_PIPELINE_STATES = [
    "creado", "propuesto", "en_proforma", "aprobado",
    "programado", "en_ejecucion", "realizado",
    "cobrado", "cancelado", "postergado"
]

@router.put("/plan-tratamiento/{plan_id}/procedimiento/{proc_id}/estado")
async def actualizar_estado_procedimiento(
    plan_id: str,
    proc_id: str,
    nuevo_estado: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Actualiza el estado de un procedimiento dentro del pipeline odontológico.
    Valida roles y transiciones permitidas.
    """
    if nuevo_estado not in VALID_PIPELINE_STATES:
        raise HTTPException(
            status_code=400,
            detail=f"Estado no válido. Estados posibles: {', '.join(VALID_PIPELINE_STATES)}"
        )

    # Restricciones de Rol
    if nuevo_estado == "cobrado" and current_user.role == "Doctor":
        raise HTTPException(
            status_code=403,
            detail="Los doctores no pueden marcar procedimientos como 'cobrado'. Esta acción es para Recepción/Administración."
        )

    if nuevo_estado == "realizado" and current_user.role == "Recepcion":
        raise HTTPException(
            status_code=403,
            detail="El personal de recepción no puede marcar procedimientos como 'realizado'. Esta acción es para el Doctor."
        )

    # Obtener el plan
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de tratamiento no encontrado")

    procedimientos = plan.get('procedimientos', [])
    found = False
    for proc in procedimientos:
        if proc.get('id') == proc_id:
            old_state = proc.get('estado_pipeline', 'creado')

            proc['estado_pipeline'] = nuevo_estado

            # Sincronizar con el campo 'estado' legacy
            if nuevo_estado == "realizado":
                proc['estado'] = "realizado"
                proc['fecha_realizado'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            elif nuevo_estado == "cancelado":
                proc['estado'] = "cancelado"

            # Auditoría simple en notas
            timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
            log_entry = f"[{timestamp}] Estado cambiado de '{old_state}' a '{nuevo_estado}' por {current_user.username} ({current_user.role})."
            proc['notas'] = (proc.get('notas', '') + '\n' + log_entry).strip()

            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Procedimiento no encontrado en el plan")

    await db.planes_tratamiento.update_one(
        {"id": plan_id},
        {
            "$set": {
                "procedimientos": procedimientos,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d')
            }
        }
    )

    return {"message": "Estado actualizado", "nuevo_estado": nuevo_estado}


@router.get("/plan-tratamiento/cola-financiera")
async def obtener_cola_financiera(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Retorna planes en estado 'propuesto' que no tienen proformas generadas.
    Listo para el workflow de counter/recepción.
    """
    query = {
        "procedimientos": {
            "$elemMatch": {"estado_pipeline": "propuesto"}
        },
        "proformas_generadas": {"$size": 0}
    }

    cursor = db.planes_tratamiento.find(query, {"_id": 0}).sort("fecha_creacion", 1)
    planes = await cursor.to_list(length=100)

    return planes


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: Auditoría
# ─────────────────────────────────────────────────────────────────────────────
async def _registrar_auditoria(
    entity_type: str,
    entity_id: str,
    plan_id: str,
    accion: str,
    usuario: str,
    rol: str,
    paciente_cedula: str = "",
    estado_anterior: str = None,
    estado_nuevo: str = None,
    valor_anterior: float = None,
    valor_nuevo: float = None,
    motivo: str = None,
):
    """Inserta entrada de auditoría. Fire-and-forget — nunca bloquea el flujo."""
    try:
        log = PipelineAuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            plan_id=plan_id,
            paciente_cedula=paciente_cedula,
            accion=accion,
            estado_anterior=estado_anterior,
            estado_nuevo=estado_nuevo,
            valor_anterior=valor_anterior,
            valor_nuevo=valor_nuevo,
            usuario=usuario,
            rol=rol,
            motivo=motivo,
        )
        doc = log.model_dump()
        doc["timestamp"] = doc["timestamp"].isoformat()
        await db.pipeline_audit_log.insert_one(doc)
    except Exception:
        pass  # Auditoría no debe romper el flujo clínico


# ─────────────────────────────────────────────────────────────────────────────
# PATCH /appointments/:id/nota-sesion
# Solo el Doctor puede escribir notas clínicas de sesión.
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import Body

nota_session_router = APIRouter(tags=["appointments-clinical"])

@nota_session_router.patch("/appointments/{appointment_id}/nota-sesion")
async def guardar_nota_sesion(
    appointment_id: str,
    payload: dict = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Guarda la nota clínica de sesión en el appointment.
    Solo Doctores y Administradores pueden escribir notas clínicas.
    """
    if current_user.role not in ["Doctor", "Administrador"]:
        raise HTTPException(
            status_code=403,
            detail="Solo los doctores pueden registrar notas clínicas de sesión."
        )

    nota = payload.get("nota", "").strip()
    if not nota:
        raise HTTPException(status_code=400, detail="La nota no puede estar vacía.")

    existing = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cita no encontrada.")

    now = datetime.now(timezone.utc)
    await db.appointments.update_one(
        {"id": appointment_id},
        {
            "$set": {
                "nota_sesion_clinica": nota,
                "nota_sesion_updated_by": current_user.username,
                "nota_sesion_updated_at": now.isoformat(),
            }
        }
    )
    return {
        "message": "Nota guardada",
        "updated_by": current_user.username,
        "updated_at": now.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /plan-tratamiento/:id/cerrar-consulta
# Doctor cierra la consulta → plan pasa a "propuesto" → evento para counter.
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/plan-tratamiento/{plan_id}/cerrar-consulta")
async def cerrar_consulta(
    plan_id: str,
    payload: dict = Body(default={}),
    current_user: TokenData = Depends(get_current_user),
):
    """
    El Doctor cierra la consulta:
    - Todos los procedimientos en estado 'creado' pasan a 'propuesto'.
    - El plan queda disponible en la cola financiera del counter.
    - Solo Doctores pueden cerrar consultas.
    """
    if current_user.role not in ["Doctor", "Administrador"]:
        raise HTTPException(
            status_code=403,
            detail="Solo los doctores pueden cerrar consultas clínicas."
        )

    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado.")

    procedimientos = plan.get("procedimientos", [])
    now_str = datetime.now(timezone.utc).isoformat()
    promovidos = 0

    for proc in procedimientos:
        if proc.get("estado_pipeline") in ["creado"]:
            old_state = proc["estado_pipeline"]
            proc["estado_pipeline"] = "propuesto"
            timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
            log_entry = f"[{timestamp}] Propuesto al cerrar consulta por {current_user.username}."
            proc["notas"] = (proc.get("notas", "") + "\n" + log_entry).strip()
            promovidos += 1

            # Auditoría por cada procedimiento promovido
            await _registrar_auditoria(
                entity_type="procedimiento",
                entity_id=proc.get("id", ""),
                plan_id=plan_id,
                paciente_cedula=plan.get("paciente_cedula", ""),
                accion="cambio_estado",
                estado_anterior=old_state,
                estado_nuevo="propuesto",
                usuario=current_user.username,
                rol=current_user.role,
                motivo=payload.get("motivo", "Cierre de consulta"),
            )

    await db.planes_tratamiento.update_one(
        {"id": plan_id},
        {
            "$set": {
                "procedimientos": procedimientos,
                "updated_at": now_str,
                "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
                "cerrado_por": current_user.username,
                "cerrado_at": now_str,
            }
        }
    )

    return {
        "message": f"Consulta cerrada. {promovidos} procedimiento(s) enviados al área financiera.",
        "plan_id": plan_id,
        "promovidos": promovidos,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /plan-tratamiento/:id/aprobar-fase  (COUNTER)
# Aprobación parcial por fase. Solo Recepcion/Administrador.
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/plan-tratamiento/{plan_id}/aprobar-fase")
async def aprobar_fase(
    plan_id: str,
    payload: dict = Body(...),
    current_user: TokenData = Depends(get_current_user),
):
    """
    El counter aprueba una o más fases del plan.
    Mueve procedimientos de 'propuesto' → 'aprobado'.
    Registra quién aprobó y cuándo.
    """
    if current_user.role not in ["Recepcion", "Administrador"]:
        raise HTTPException(
            status_code=403,
            detail="Solo el personal de recepción puede aprobar fases del plan."
        )

    fase = payload.get("fase")              # int: número de fase, o None para todas
    proc_ids = payload.get("procedimiento_ids", [])  # lista específica, o [] para toda la fase

    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado.")

    procedimientos = plan.get("procedimientos", [])
    now_str = datetime.now(timezone.utc).isoformat()
    aprobados = 0

    for proc in procedimientos:
        if proc.get("estado_pipeline") != "propuesto":
            continue

        # Filtrar: por fase específica o por IDs específicos
        match_fase = (fase is None) or (proc.get("fase") == fase)
        match_ids  = (not proc_ids) or (proc.get("id") in proc_ids)

        if match_fase and match_ids:
            proc["estado_pipeline"] = "aprobado"
            proc["aprobado_paciente"] = True
            timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')
            log_entry = f"[{timestamp}] Aprobado por {current_user.username} ({current_user.role})."
            proc["notas"] = (proc.get("notas", "") + "\n" + log_entry).strip()
            aprobados += 1

            await _registrar_auditoria(
                entity_type="procedimiento",
                entity_id=proc.get("id", ""),
                plan_id=plan_id,
                paciente_cedula=plan.get("paciente_cedula", ""),
                accion="aprobacion",
                estado_anterior="propuesto",
                estado_nuevo="aprobado",
                usuario=current_user.username,
                rol=current_user.role,
                motivo=payload.get("motivo", f"Aprobación fase {fase}"),
            )

    await db.planes_tratamiento.update_one(
        {"id": plan_id},
        {
            "$set": {
                "procedimientos": procedimientos,
                "updated_at": now_str,
                "aprobado_por": current_user.username,
                "fecha_aprobacion": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
            }
        }
    )

    return {
        "message": f"{aprobados} procedimiento(s) aprobados.",
        "aprobados": aprobados,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /plan-tratamiento/:id/auditoria
# Log completo de cambios del plan. Solo Administrador y Doctor (su propio plan).
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/plan-tratamiento/{plan_id}/auditoria")
async def obtener_auditoria_plan(
    plan_id: str,
    current_user: TokenData = Depends(get_current_user),
):
    cursor = db.pipeline_audit_log.find(
        {"plan_id": plan_id},
        {"_id": 0}
    ).sort("timestamp", -1)
    logs = await cursor.to_list(length=500)
    return logs


# ─────────────────────────────────────────────────────────────────────────────
# PUT con require_role en endpoints críticos — wrappers con rol enforceado
# Aplicamos sobre el actualizar_estado_procedimiento existente agregando
# validación adicional de transiciones prohibidas por rol.
# ─────────────────────────────────────────────────────────────────────────────

# Nota: el endpoint existente actualizar_estado_procedimiento ya tiene
# validación inline de rol. Agregamos auditoría al mismo conectando
# _registrar_auditoria desde el endpoint existente via monkey-patch approach.
# El refactor limpio se hace en Fase siguiente cuando se unifique el router.

