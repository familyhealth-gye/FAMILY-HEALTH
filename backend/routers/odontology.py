from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from db import db
from auth import TokenData, get_current_user
from models import (
    Odontogram, OdontogramCreate, OdontogramUpdate, ToothState,
    OdontogramaClinico, DienteFDI, SuperficieDental,
    PlanTratamiento, PlanTratamientoCreate, ProcedimientoDental,
    ProcedimientoCreate, ProcedimientoUpdate, FaseTratamiento
)

router = APIRouter(tags=["odontology"])

# ========== ODONTOGRAM ENDPOINTS (LEGACY) ==========

@router.post("/odontograms", response_model=Odontogram)
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

@router.get("/odontograms", response_model=List[Odontogram])
async def get_odontograms(current_user: TokenData = Depends(get_current_user)):
    odontograms = await db.odontograms.find({}, {"_id": 0}).to_list(1000)
    for odontogram in odontograms:
        if isinstance(odontogram['created_at'], str):
            odontogram['created_at'] = datetime.fromisoformat(odontogram['created_at'])
    return odontograms

@router.get("/odontograms/patient/{paciente_id}", response_model=List[Odontogram])
async def get_patient_odontograms(
    paciente_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    odontograms = await db.odontograms.find(
        {"paciente_id": paciente_id}, {"_id": 0}
    ).to_list(1000)

    for odontogram in odontograms:
        if isinstance(odontogram['created_at'], str):
            odontogram['created_at'] = datetime.fromisoformat(odontogram['created_at'])

    return odontograms

@router.put("/odontograms/{odontogram_id}", response_model=Odontogram)
async def update_odontogram(
    odontogram_id: str,
    input: OdontogramUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.odontograms.find_one({"id": odontogram_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    update_data = {k: v for k, v in input.model_dump().items() if v is not None}

    if update_data:
        await db.odontograms.update_one({"id": odontogram_id}, {"$set": update_data})

    updated = await db.odontograms.find_one({"id": odontogram_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])

    return Odontogram(**updated)

@router.delete("/odontograms/{odontogram_id}")
async def delete_odontogram(
    odontogram_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    result = await db.odontograms.delete_one({"id": odontogram_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    return {"message": "Odontograma eliminado exitosamente"}


# ========== ODONTOGRAMA CLÍNICO FDI - NUEVOS ENDPOINTS ==========

def generar_dientes_permanentes():
    """Genera los 32 dientes permanentes con numeración FDI"""
    dientes = []

    # Definir superficies estándar
    superficies_posteriores = ["oclusal", "vestibular", "palatino", "mesial", "distal"]
    superficies_anteriores = ["incisal", "vestibular", "palatino", "mesial", "distal"]

    # Cuadrante 1: Superior derecho (18-11)
    for pos in range(8, 0, -1):
        numero = f"1{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="permanente",
            cuadrante=1,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies]
        ))

    # Cuadrante 2: Superior izquierdo (21-28)
    for pos in range(1, 9):
        numero = f"2{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        # Cambiar palatino a lingual para consistencia
        superficies_adj = [s.replace("palatino", "palatino") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="permanente",
            cuadrante=2,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_adj]
        ))

    # Cuadrante 4: Inferior derecho (48-41)
    for pos in range(8, 0, -1):
        numero = f"4{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        # Inferior usa "lingual" en vez de "palatino"
        superficies_inf = [s.replace("palatino", "lingual") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="permanente",
            cuadrante=4,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_inf]
        ))

    # Cuadrante 3: Inferior izquierdo (31-38)
    for pos in range(1, 9):
        numero = f"3{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        superficies_inf = [s.replace("palatino", "lingual") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="permanente",
            cuadrante=3,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_inf]
        ))

    return dientes


def generar_dientes_temporales():
    """Genera los 20 dientes temporales con numeración FDI"""
    dientes = []

    superficies_posteriores = ["oclusal", "vestibular", "palatino", "mesial", "distal"]
    superficies_anteriores = ["incisal", "vestibular", "palatino", "mesial", "distal"]

    # Cuadrante 5: Superior derecho temporal (55-51)
    for pos in range(5, 0, -1):
        numero = f"5{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="temporal",
            cuadrante=5,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies]
        ))

    # Cuadrante 6: Superior izquierdo temporal (61-65)
    for pos in range(1, 6):
        numero = f"6{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="temporal",
            cuadrante=6,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies]
        ))

    # Cuadrante 8: Inferior derecho temporal (85-81)
    for pos in range(5, 0, -1):
        numero = f"8{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        superficies_inf = [s.replace("palatino", "lingual") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="temporal",
            cuadrante=8,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_inf]
        ))

    # Cuadrante 7: Inferior izquierdo temporal (71-75)
    for pos in range(1, 6):
        numero = f"7{pos}"
        superficies = superficies_posteriores if pos > 3 else superficies_anteriores
        superficies_inf = [s.replace("palatino", "lingual") for s in superficies]
        dientes.append(DienteFDI(
            numero_fdi=numero,
            tipo="temporal",
            cuadrante=7,
            posicion=pos,
            estado="presente",
            superficies=[SuperficieDental(nombre=s) for s in superficies_inf]
        ))

    return dientes


@router.post("/odontograma-clinico")
async def crear_odontograma_clinico(
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crear nuevo odontograma clínico con soporte FDI.
    Soporta dentición: permanente (32), temporal (20), mixta
    """
    tipo_denticion = input.get('tipo_denticion', 'permanente')
    paciente_id = input.get('paciente_id')
    paciente_cedula = input.get('paciente_cedula', '')
    paciente_nombre = input.get('paciente_nombre', '')
    doctor_id = input.get('doctor_id', '')

    # Si no hay paciente_id pero hay cédula, usar la cédula como identificador
    if not paciente_id and paciente_cedula:
        paciente_id = paciente_cedula

    if not paciente_id:
        raise HTTPException(status_code=400, detail="paciente_id o paciente_cedula son requeridos")

    # Obtener datos del paciente (puede ser de appointments o pacientes)
    # Mantener los valores pasados si existen
    paciente_nombre_input = paciente_nombre
    paciente_cedula_input = paciente_cedula

    paciente = await db.appointments.find_one({"id": paciente_id}, {"_id": 0})

    if paciente:
        if not paciente_nombre_input:
            paciente_nombre = paciente.get('nombre_completo', '')
        else:
            paciente_nombre = paciente_nombre_input
        if not paciente_cedula_input:
            paciente_cedula = paciente.get('cedula', '')
        else:
            paciente_cedula = paciente_cedula_input
    else:
        # Buscar en colección de pacientes
        paciente = await db.pacientes.find_one({"id": paciente_id}, {"_id": 0})
        if paciente:
            if not paciente_nombre_input:
                paciente_nombre = paciente.get('nombre_completo', '')
            else:
                paciente_nombre = paciente_nombre_input
            if not paciente_cedula_input:
                paciente_cedula = paciente.get('cedula', '')
            else:
                paciente_cedula = paciente_cedula_input
        else:
            # Usar los valores del input si no se encuentra el paciente
            paciente_nombre = paciente_nombre_input
            paciente_cedula = paciente_cedula_input

    # Si aún no tenemos cédula, buscar por cédula en appointments
    if not paciente_cedula and paciente_cedula_input:
        paciente_cedula = paciente_cedula_input
        # Buscar appointment por cédula
        apt = await db.appointments.find_one({"cedula": paciente_cedula}, {"_id": 0})
        if apt and not paciente_nombre:
            paciente_nombre = apt.get('nombre_completo', '')

    # Obtener datos del doctor
    doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    doctor_nombre = doctor.get('nombre', '') if doctor else ''

    # Generar dientes según tipo de dentición
    if tipo_denticion == 'permanente':
        dientes = generar_dientes_permanentes()
    elif tipo_denticion == 'temporal':
        dientes = generar_dientes_temporales()
    else:  # mixta
        dientes = generar_dientes_permanentes() + generar_dientes_temporales()

    # Crear odontograma
    odontograma = OdontogramaClinico(
        paciente_id=paciente_id,
        paciente_nombre=paciente_nombre or input.get('paciente_nombre', ''),
        paciente_cedula=paciente_cedula or input.get('paciente_cedula', ''),
        doctor_id=doctor_id or '',
        doctor_nombre=doctor_nombre,
        tipo_denticion=tipo_denticion,
        fecha=input.get('fecha', datetime.now(timezone.utc).strftime('%Y-%m-%d')),
        dientes=dientes,
        diagnostico_general=input.get('diagnostico_general', ''),
        higiene_oral=input.get('higiene_oral', ''),
        estado_encias=input.get('estado_encias', ''),
        observaciones=input.get('observaciones', '')
    )

    # Guardar
    doc = odontograma.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()

    await db.odontogramas_clinicos.insert_one(doc)

    return {
        "message": "Odontograma clínico creado exitosamente",
        "id": odontograma.id,
        "tipo_denticion": tipo_denticion,
        "total_dientes": len(dientes)
    }


@router.get("/odontograma-clinico")
async def listar_odontogramas_clinicos(
    current_user: TokenData = Depends(get_current_user)
):
    """Listar todos los odontogramas clínicos"""
    odontogramas = await db.odontogramas_clinicos.find({}, {"_id": 0}).sort("fecha", -1).to_list(500)
    return odontogramas


@router.get("/odontograma-clinico/{odontograma_id}")
async def obtener_odontograma_clinico(
    odontograma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener odontograma clínico por ID"""
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    return odontograma


@router.get("/odontograma-clinico/paciente/{paciente_id}")
async def obtener_odontogramas_paciente(
    paciente_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener todos los odontogramas de un paciente"""
    odontogramas = await db.odontogramas_clinicos.find(
        {"paciente_id": paciente_id}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    return odontogramas


@router.get("/odontograma-clinico/cedula/{cedula}")
async def obtener_odontogramas_por_cedula(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener todos los odontogramas de un paciente por cédula"""
    odontogramas = await db.odontogramas_clinicos.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    return odontogramas


@router.put("/odontograma-clinico/{odontograma_id}")
async def actualizar_odontograma_clinico(
    odontograma_id: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar odontograma clínico (dientes, diagnósticos, etc.)"""
    existing = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    # Campos permitidos para actualizar
    allowed_fields = [
        'dientes', 'diagnostico_general', 'higiene_oral',
        'estado_encias', 'oclusion', 'observaciones',
        'indice_cpod', 'indice_ceod', 'tipo_denticion'
    ]

    update_data = {k: v for k, v in input.items() if k in allowed_fields and v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    update_data['fecha_actualizacion'] = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    if update_data:
        await db.odontogramas_clinicos.update_one({"id": odontograma_id}, {"$set": update_data})

    updated = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    return updated


@router.put("/odontograma-clinico/{odontograma_id}/diente/{numero_fdi}")
async def actualizar_diente(
    odontograma_id: str,
    numero_fdi: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar un diente específico del odontograma"""
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    dientes = odontograma.get('dientes', [])
    diente_encontrado = False

    for i, diente in enumerate(dientes):
        if diente.get('numero_fdi') == numero_fdi:
            # Actualizar campos del diente
            if 'estado' in input:
                dientes[i]['estado'] = input['estado']
            if 'superficies' in input:
                dientes[i]['superficies'] = input['superficies']
            if 'movilidad' in input:
                dientes[i]['movilidad'] = input['movilidad']
            if 'observaciones' in input:
                dientes[i]['observaciones'] = input['observaciones']
            diente_encontrado = True
            break

    if not diente_encontrado:
        raise HTTPException(status_code=404, detail=f"Diente {numero_fdi} no encontrado")

    await db.odontogramas_clinicos.update_one(
        {"id": odontograma_id},
        {"$set": {
            "dientes": dientes,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "fecha_actualizacion": datetime.now(timezone.utc).strftime('%Y-%m-%d')
        }}
    )

    return {"message": f"Diente {numero_fdi} actualizado", "diente": dientes[i]}


@router.put("/odontograma-clinico/{odontograma_id}/diente/{numero_fdi}/superficie/{superficie}")
async def actualizar_superficie_diente(
    odontograma_id: str,
    numero_fdi: str,
    superficie: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar una superficie específica de un diente"""
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    dientes = odontograma.get('dientes', [])
    actualizado = False

    for i, diente in enumerate(dientes):
        if diente.get('numero_fdi') == numero_fdi:
            superficies = diente.get('superficies', [])
            for j, sup in enumerate(superficies):
                if sup.get('nombre') == superficie:
                    if 'diagnostico' in input:
                        dientes[i]['superficies'][j]['diagnostico'] = input['diagnostico']
                    if 'notas' in input:
                        dientes[i]['superficies'][j]['notas'] = input['notas']
                    actualizado = True
                    break
            break

    if not actualizado:
        raise HTTPException(status_code=404, detail=f"Superficie {superficie} del diente {numero_fdi} no encontrada")

    await db.odontogramas_clinicos.update_one(
        {"id": odontograma_id},
        {"$set": {
            "dientes": dientes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"message": f"Superficie {superficie} del diente {numero_fdi} actualizada"}


@router.delete("/odontograma-clinico/{odontograma_id}")
async def eliminar_odontograma_clinico(
    odontograma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Eliminar odontograma clínico"""
    result = await db.odontogramas_clinicos.delete_one({"id": odontograma_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")
    return {"message": "Odontograma eliminado exitosamente"}


@router.post("/odontograma-clinico/{odontograma_id}/cambiar-denticion")
async def cambiar_tipo_denticion(
    odontograma_id: str,
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Cambiar tipo de dentición del odontograma (regenera dientes)"""
    odontograma = await db.odontogramas_clinicos.find_one({"id": odontograma_id}, {"_id": 0})
    if not odontograma:
        raise HTTPException(status_code=404, detail="Odontograma no encontrado")

    nuevo_tipo = input.get('tipo_denticion', 'permanente')

    # Generar nuevos dientes
    if nuevo_tipo == 'permanente':
        dientes = generar_dientes_permanentes()
    elif nuevo_tipo == 'temporal':
        dientes = generar_dientes_temporales()
    else:
        dientes = generar_dientes_permanentes() + generar_dientes_temporales()

    # Convertir a dict
    dientes_dict = [d.model_dump() for d in dientes]

    await db.odontogramas_clinicos.update_one(
        {"id": odontograma_id},
        {"$set": {
            "tipo_denticion": nuevo_tipo,
            "dientes": dientes_dict,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {
        "message": f"Dentición cambiada a {nuevo_tipo}",
        "total_dientes": len(dientes)
    }


# ========== PLAN DE TRATAMIENTO ENDPOINTS ==========

def clasificar_procedimiento_por_superficies(superficies_afectadas: List[dict]) -> str:
    """
    Clasifica el procedimiento dental según número de superficies afectadas.
    Reglas:
    - 1 superficie → Resina simple
    - 2 superficies → Resina compuesta
    - 3 superficies → Resina compleja
    - 4+ superficies o daño estructural → Corona
    """
    # Contar superficies con diagnóstico diferente de "sano"
    superficies_con_problema = [s for s in superficies_afectadas if s.get('diagnostico', 'sano') != 'sano']
    num_superficies = len(superficies_con_problema)

    if num_superficies == 0:
        return None  # No requiere tratamiento
    elif num_superficies == 1:
        return "Resina simple"
    elif num_superficies == 2:
        return "Resina compuesta"
    elif num_superficies == 3:
        return "Resina compleja"
    else:
        return "Corona"


def generar_procedimientos_desde_odontograma(odontograma: dict) -> List[dict]:
    """
    Analiza el odontograma y genera procedimientos sugeridos por diente.
    """
    procedimientos = []
    dientes = odontograma.get('dientes', [])

    for diente in dientes:
        numero_fdi = diente.get('numero_fdi', '')
        estado = diente.get('estado', 'presente')
        superficies = diente.get('superficies', [])

        # Si el diente está ausente, no generar procedimiento
        if estado in ['ausente', 'exfoliado']:
            continue

        # Si está marcado para extracción
        if estado == 'extraccion':
            procedimientos.append({
                'diente_numero': numero_fdi,
                'procedimiento': 'Extracción',
                'descripcion': f'Extracción indicada - diente {numero_fdi}',
                'superficies_afectadas': [],
                'fase': 1
            })
            continue

        # Analizar superficies para determinar procedimiento
        superficies_afectadas = []
        tiene_endodoncia = False
        tiene_corona = False

        for sup in superficies:
            diagnostico = sup.get('diagnostico', 'sano')
            if diagnostico != 'sano':
                superficies_afectadas.append({
                    'nombre': sup.get('nombre', ''),
                    'diagnostico': diagnostico
                })
                if diagnostico == 'endodoncia':
                    tiene_endodoncia = True
                if diagnostico == 'corona':
                    tiene_corona = True

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
