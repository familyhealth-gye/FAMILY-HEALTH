from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from db import db
from auth import TokenData, get_current_user
from models import (
    MedicalHistory, MedicalHistoryCreate, MedicalHistoryUpdate
)
from medical_history_models import (
    MedicalHistoryGeneral, MedicalHistoryGeneralCreate,
    MedicalHistoryPediatric, MedicalHistoryPediatricCreate,
    MedicalHistoryOdontology, MedicalHistoryOdontologyCreate, EstadoDental,
    EvolicionSesion, EvolicionSesionCreate,
    MedicalHistoryNutricion, MedicalHistoryNutricionCreate,
    MedicalHistoryGinecologia, MedicalHistoryGinecologiaCreate,
    MedicalHistoryEcografia, MedicalHistoryEcografiaCreate
)
from routers.helpers import calcular_edad_desde_fecha, crear_consulta_financiera_automatica

router = APIRouter(tags=["medical-history"])

# ========== MEDICAL HISTORY ENDPOINTS ==========

@router.post("/medical-history", response_model=MedicalHistory)
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

@router.get("/medical-history", response_model=List[MedicalHistory])
async def get_medical_histories(current_user: TokenData = Depends(get_current_user)):
    histories = await db.medical_histories.find({}, {"_id": 0}).to_list(1000)

    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])

    return histories

@router.get("/medical-history/patient/{paciente_id}", response_model=List[MedicalHistory])
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

# ========== SPECIALIZED MEDICAL HISTORIES ==========

# Medicina General
@router.post("/medical-history/general", response_model=MedicalHistoryGeneral)
async def create_general_history(
    input: MedicalHistoryGeneralCreate,
    current_user: TokenData = Depends(get_current_user)
):
    from specialty_utils import normalize_specialty

    appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})

    # VALIDACIÓN: Solo para Medicina General (con normalización de variantes)
    appointment_especialidad = appointment.get('especialidad', '')
    if appointment_especialidad and normalize_specialty(appointment_especialidad) != "Medicina General":
        raise HTTPException(
            status_code=403,
            detail=f"Este formulario es para Medicina General, no para {appointment_especialidad}."
        )

    # Validar doctor — permitir si la cita no tiene doctor asignado aún
    doctor_id_appt = appointment.get('doctor_id') or ""
    user_doctor_id = user.get('doctor_id') or ""
    if user.get('role') == 'Doctor' and user_doctor_id and doctor_id_appt and user_doctor_id != doctor_id_appt:
        raise HTTPException(status_code=403, detail="No tiene permisos para esta consulta")

    # Resolver paciente_id real desde db.pacientes
    cedula = appointment.get('cedula') or appointment.get('paciente_cedula') or ""
    paciente_id_real = appointment.get('paciente_id') or ""
    if cedula:
        pac = await db.pacientes.find_one({"cedula": cedula}, {"_id": 0})
        if pac:
            paciente_id_real = pac.get("id", paciente_id_real)

    doctor_id_final  = user_doctor_id or doctor_id_appt or "N/A"
    doctor_nombre    = user.get('nombre_completo') or user.get('nombre') or "Sin nombre"

    history_dict = input.model_dump()
    history_dict['paciente_id']    = paciente_id_real          # ← ID real del paciente
    history_dict['paciente_nombre'] = appointment['nombre_completo']
    history_dict['paciente_cedula'] = cedula
    history_dict['paciente_edad']   = calcular_edad_desde_fecha(appointment.get('fecha_nacimiento', '')) or appointment.get('edad', 0)
    history_dict['paciente_sexo']   = appointment.get('sexo', 'No especificado')
    history_dict['doctor_id']       = doctor_id_final
    history_dict['doctor_nombre']   = doctor_nombre
    history_dict['fecha']           = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    history_obj = MedicalHistoryGeneral(**history_dict)
    doc = history_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_general.insert_one(doc)

    # Crear consulta financiera automática
    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, cedula, appointment['nombre_completo'],
        doctor_id_final, "Medicina General", current_user.username
    )
    if fin_id:
        await db.medical_history_general.update_one({"id": history_obj.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history_obj

@router.get("/medical-history/general", response_model=List[MedicalHistoryGeneral])
async def get_general_histories(current_user: TokenData = Depends(get_current_user)):
    histories = await db.medical_history_general.find({}, {"_id": 0}).to_list(1000)

    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])

    return histories

@router.get("/medical-history/general/appointment/{appointment_id}", response_model=MedicalHistoryGeneral)
async def get_general_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_general.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")

    if isinstance(history['created_at'], str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])

    return MedicalHistoryGeneral(**history)

@router.put("/medical-history/general/{history_id}", response_model=MedicalHistoryGeneral)
async def update_general_history(
    history_id: str,
    input: MedicalHistoryGeneralCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar historia clínica general existente"""
    existing = await db.medical_history_general.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")

    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['paciente_id'] = existing.get('paciente_id')
    update_data['paciente_nombre'] = existing.get('paciente_nombre')
    update_data['paciente_cedula'] = existing.get('paciente_cedula')
    update_data['paciente_edad'] = existing.get('paciente_edad')
    update_data['paciente_sexo'] = existing.get('paciente_sexo')
    update_data['doctor_id'] = existing.get('doctor_id')
    update_data['doctor_nombre'] = existing.get('doctor_nombre')
    update_data['fecha'] = existing.get('fecha')
    update_data['created_at'] = existing.get('created_at')

    await db.medical_history_general.update_one(
        {"id": history_id},
        {"$set": update_data}
    )

    # Actualizar estado de la cita
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )

    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])

    return MedicalHistoryGeneral(**update_data)

# Pediatría
@router.post("/medical-history/pediatric", response_model=MedicalHistoryPediatric)
async def create_pediatric_history(
    input: MedicalHistoryPediatricCreate,
    current_user: TokenData = Depends(get_current_user)
):
    from specialty_utils import normalize_specialty

    appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})

    appointment_especialidad = appointment.get('especialidad', '')
    if appointment_especialidad and normalize_specialty(appointment_especialidad) != "Pediatría":
        raise HTTPException(
            status_code=403,
            detail=f"Este formulario es para Pediatría, no para {appointment_especialidad}."
        )

    doctor_id_appt = appointment.get('doctor_id') or ""
    user_doctor_id = user.get('doctor_id') or ""
    if user.get('role') == 'Doctor' and user_doctor_id and doctor_id_appt and user_doctor_id != doctor_id_appt:
        raise HTTPException(status_code=403, detail="No tiene permisos para esta consulta")

    cedula = appointment.get('cedula') or appointment.get('paciente_cedula') or ""
    paciente_id_real = appointment.get('paciente_id') or ""
    if cedula:
        pac = await db.pacientes.find_one({"cedula": cedula}, {"_id": 0})
        if pac:
            paciente_id_real = pac.get("id", paciente_id_real)

    doctor_id_final = user_doctor_id or doctor_id_appt or "N/A"
    doctor_nombre   = user.get('nombre_completo') or user.get('nombre') or "Sin nombre"

    history_dict = input.model_dump()
    history_dict['paciente_id']    = paciente_id_real
    history_dict['paciente_nombre'] = appointment['nombre_completo']
    history_dict['paciente_cedula'] = cedula
    history_dict['paciente_edad']   = calcular_edad_desde_fecha(appointment.get('fecha_nacimiento', '')) or appointment.get('edad', 0)
    history_dict['paciente_sexo']   = appointment.get('sexo', 'No especificado')
    history_dict['doctor_id']       = doctor_id_final
    history_dict['doctor_nombre']   = doctor_nombre
    history_dict['fecha']           = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    history_obj = MedicalHistoryPediatric(**history_dict)
    doc = history_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_pediatric.insert_one(doc)

    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, cedula, appointment['nombre_completo'],
        doctor_id_final, "Pediatría", current_user.username
    )
    if fin_id:
        await db.medical_history_pediatric.update_one({"id": history_obj.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history_obj

@router.get("/medical-history/pediatric", response_model=List[MedicalHistoryPediatric])
async def get_pediatric_histories(current_user: TokenData = Depends(get_current_user)):
    histories = await db.medical_history_pediatric.find({}, {"_id": 0}).to_list(1000)

    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])

    return histories

@router.get("/medical-history/pediatric/appointment/{appointment_id}", response_model=MedicalHistoryPediatric)
async def get_pediatric_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_pediatric.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")

    if isinstance(history['created_at'], str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])

    return MedicalHistoryPediatric(**history)

@router.get("/medical-history/pediatric/paciente/{cedula}")
async def get_pediatric_longitudinal(
    cedula: str,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Datos longitudinales del paciente pediátrico por cédula.
    Devuelve SOLO campos que persisten entre consultas:
      representante, antecedentes perinatales, desarrollo psicomotor,
      vacunas, alergias, antecedentes familiares.
    NO incluye: motivo_consulta, signos_vitales, diagnóstico (son por sesión).
    """
    # Buscar por paciente_cedula O cedula (compatibilidad legacy)
    histories = await db.medical_history_pediatric.find(
        {"$or": [
            {"paciente_cedula": cedula},
            {"cedula": cedula},
        ]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)

    if not histories:
        return {}

    # Tomar la más reciente como fuente de datos longitudinales
    latest = histories[0]

    # Retornar SOLO los campos longitudinales — no los del episodio actual
    return {
        # Responsable
        "nombre_responsable":      latest.get("nombre_responsable", ""),
        "parentesco_responsable":  latest.get("parentesco_responsable", ""),
        "telefono_responsable":    latest.get("telefono_responsable", ""),
        # Antecedentes perinatales
        "datos_nacimiento":        latest.get("datos_nacimiento", {}),
        "lactancia_materna":       latest.get("lactancia_materna", ""),
        "lactancia_meses":         latest.get("lactancia_meses", None),
        # Desarrollo psicomotor
        "desarrollo_psicomotor":   latest.get("desarrollo_psicomotor", {}),
        "desarrollo_acorde_edad":  latest.get("desarrollo_acorde_edad", True),
        "observaciones_desarrollo":latest.get("observaciones_desarrollo", ""),
        # Inmunizaciones
        "vacunas":                 latest.get("vacunas", {}),
        "esquema_completo":        latest.get("esquema_completo", False),
        # Antecedentes
        "antecedentes_familiares": latest.get("antecedentes_familiares", ""),
        "enfermedades_hereditarias":latest.get("enfermedades_hereditarias", ""),
        "hospitalizaciones_previas":latest.get("hospitalizaciones_previas", ""),
        "cirugias_previas":        latest.get("cirugias_previas", ""),
        "alergias":                latest.get("alergias", ""),
        "medicamentos_actuales":   latest.get("medicamentos_actuales", ""),
        # Alimentación
        "alimentacion_actual":     latest.get("alimentacion_actual", ""),
        "numero_comidas_dia":      latest.get("numero_comidas_dia", None),
        # Meta
        "_ultima_consulta":        latest.get("fecha", ""),
        "_total_consultas":        len(histories),
    }


@router.put("/medical-history/pediatric/{history_id}", response_model=MedicalHistoryPediatric)
async def update_pediatric_history(
    history_id: str,
    input: MedicalHistoryPediatricCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar historia clínica pediátrica existente"""
    existing = await db.medical_history_pediatric.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")

    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['paciente_id'] = existing.get('paciente_id')
    update_data['paciente_nombre'] = existing.get('paciente_nombre')
    update_data['paciente_cedula'] = existing.get('paciente_cedula')
    update_data['paciente_edad'] = existing.get('paciente_edad')
    update_data['paciente_sexo'] = existing.get('paciente_sexo')
    update_data['doctor_id'] = existing.get('doctor_id')
    update_data['doctor_nombre'] = existing.get('doctor_nombre')
    update_data['fecha'] = existing.get('fecha')
    update_data['created_at'] = existing.get('created_at')

    await db.medical_history_pediatric.update_one(
        {"id": history_id},
        {"$set": update_data}
    )

    # Actualizar estado de la cita
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )

    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])

    return MedicalHistoryPediatric(**update_data)

# Odontología
@router.post("/medical-history/odontology", response_model=MedicalHistoryOdontology)
async def create_odontology_history(
    input: MedicalHistoryOdontologyCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get appointment data
    appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    # Get current user data
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})

async def create_odontology_history(
    input: MedicalHistoryOdontologyCreate,
    current_user: TokenData = Depends(get_current_user)
):
    from specialty_utils import normalize_specialty

    appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})

    appointment_especialidad = appointment.get('especialidad', '')
    if appointment_especialidad and normalize_specialty(appointment_especialidad) != "Odontología":
        raise HTTPException(
            status_code=403,
            detail=f"Este formulario es para Odontología, no para {appointment_especialidad}."
        )

    doctor_id_appt = appointment.get('doctor_id') or ""
    user_doctor_id = user.get('doctor_id') or ""
    if user.get('role') == 'Doctor' and user_doctor_id and doctor_id_appt and user_doctor_id != doctor_id_appt:
        raise HTTPException(status_code=403, detail="No tiene permisos para esta consulta")

    cedula = appointment.get('cedula') or appointment.get('paciente_cedula') or ""
    paciente_id_real = appointment.get('paciente_id') or ""
    if cedula:
        pac = await db.pacientes.find_one({"cedula": cedula}, {"_id": 0})
        if pac:
            paciente_id_real = pac.get("id", paciente_id_real)

    doctor_id_final = user_doctor_id or doctor_id_appt or "N/A"
    doctor_nombre   = user.get('nombre_completo') or user.get('nombre') or "Sin nombre"

    history_dict = input.model_dump()
    history_dict['paciente_id']    = paciente_id_real
    history_dict['paciente_nombre'] = appointment['nombre_completo']
    history_dict['paciente_cedula'] = cedula
    history_dict['paciente_edad']   = calcular_edad_desde_fecha(appointment.get('fecha_nacimiento', '')) or appointment.get('edad', 0)
    history_dict['paciente_sexo']   = appointment.get('sexo', 'No especificado')
    history_dict['doctor_id']       = doctor_id_final
    history_dict['doctor_nombre']   = doctor_nombre
    history_dict['fecha']           = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    history_obj = MedicalHistoryOdontology(**history_dict)
    doc = history_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_odontology.insert_one(doc)

    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, cedula, appointment['nombre_completo'],
        doctor_id_final, "Odontología", current_user.username
    )
    if fin_id:
        await db.medical_history_odontology.update_one({"id": history_obj.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history_obj

@router.get("/medical-history/odontology", response_model=List[MedicalHistoryOdontology])
async def get_odontology_histories(current_user: TokenData = Depends(get_current_user)):
    histories = await db.medical_history_odontology.find({}, {"_id": 0}).to_list(1000)

    for history in histories:
        if isinstance(history['created_at'], str):
            history['created_at'] = datetime.fromisoformat(history['created_at'])

    return histories

@router.get("/medical-history/odontology/appointment/{appointment_id}", response_model=MedicalHistoryOdontology)
async def get_odontology_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_odontology.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")

    if isinstance(history['created_at'], str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])

    return MedicalHistoryOdontology(**history)

@router.put("/medical-history/odontology/{history_id}", response_model=MedicalHistoryOdontology)
async def update_odontology_history(
    history_id: str,
    input: MedicalHistoryOdontologyCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualizar historia clínica odontológica existente"""
    existing = await db.medical_history_odontology.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")

    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['paciente_id'] = existing.get('paciente_id')
    update_data['paciente_nombre'] = existing.get('paciente_nombre')
    update_data['paciente_cedula'] = existing.get('paciente_cedula')
    update_data['paciente_edad'] = existing.get('paciente_edad')
    update_data['paciente_sexo'] = existing.get('paciente_sexo')
    update_data['doctor_id'] = existing.get('doctor_id')
    update_data['doctor_nombre'] = existing.get('doctor_nombre')
    update_data['fecha'] = existing.get('fecha')
    update_data['created_at'] = existing.get('created_at')

    await db.medical_history_odontology.update_one(
        {"id": history_id},
        {"$set": update_data}
    )

    # Actualizar estado de la cita
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )

    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])

    return MedicalHistoryOdontology(**update_data)


# ========== EVOLUCIÓN POR SESIÓN - ODONTOLOGÍA ==========

@router.post("/evoluciones-sesion", response_model=EvolicionSesion)
async def create_evolucion_sesion(
    input: EvolicionSesionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crea el registro de lo que se hizo en una sesión de odontología.
    Actualiza automáticamente el estado de los dientes en el odontograma.
    """
    # Verificar si ya existe una evolución para este appointment
    existing = await db.evoluciones_sesion.find_one(
        {"appointment_id": input.appointment_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una evolución para esta cita")

    evolucion = EvolicionSesion(**input.model_dump())
    doc = evolucion.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.evoluciones_sesion.insert_one(doc)

    # Actualizar estado de dientes en odontograma automáticamente
    if input.procedimientos_realizados and input.paciente_cedula:
        odontograma = await db.odontogramas_clinicos.find_one(
            {"paciente_cedula": input.paciente_cedula}, {"_id": 0}
        )
        if odontograma:
            dientes = odontograma.get("dientes", [])
            ESTADO_MAP = {
                "Resina": "restaurado",
                "Amalgama": "restaurado",
                "Corona": "corona",
                "Extracción": "ausente",
                "Implante": "implante",
                "Endodoncia": "endodoncia",
                "Limpieza": "presente",
                "Blanqueamiento": "presente",
            }
            for proc in input.procedimientos_realizados:
                diente_num = proc.diente_numero
                nuevo_estado = next(
                    (v for k, v in ESTADO_MAP.items() if k.lower() in proc.procedimiento.lower()),
                    "tratado"
                )
                for i, d in enumerate(dientes):
                    if str(d.get("numero_fdi", "")) == str(diente_num):
                        dientes[i]["estado_tratamiento"] = nuevo_estado
                        dientes[i]["ultimo_procedimiento"] = proc.procedimiento
                        dientes[i]["fecha_ultimo_tratamiento"] = input.fecha
                        break

            await db.odontogramas_clinicos.update_one(
                {"paciente_cedula": input.paciente_cedula},
                {"$set": {
                    "dientes": dientes,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )

    # Actualizar estado de la cita
    await db.appointments.update_one(
        {"id": input.appointment_id},
        {"$set": {"estado": "Pendiente de Pago"}}
    )

    return evolucion


@router.get("/evoluciones-sesion/paciente/{cedula}", response_model=List[EvolicionSesion])
async def get_evoluciones_by_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtiene todas las sesiones de un paciente ordenadas por fecha (más reciente primero)"""
    evoluciones = await db.evoluciones_sesion.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(1000)

    for e in evoluciones:
        if isinstance(e.get("created_at"), str):
            e["created_at"] = datetime.fromisoformat(e["created_at"])

    return evoluciones


@router.get("/evoluciones-sesion/appointment/{appointment_id}", response_model=EvolicionSesion)
async def get_evolucion_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtiene la evolución de una cita específica"""
    evolucion = await db.evoluciones_sesion.find_one(
        {"appointment_id": appointment_id}, {"_id": 0}
    )
    if not evolucion:
        raise HTTPException(status_code=404, detail="Evolución no encontrada")

    if isinstance(evolucion.get("created_at"), str):
        evolucion["created_at"] = datetime.fromisoformat(evolucion["created_at"])

    return EvolicionSesion(**evolucion)


@router.put("/evoluciones-sesion/{evolucion_id}", response_model=EvolicionSesion)
async def update_evolucion_sesion(
    evolucion_id: str,
    input: EvolicionSesionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Actualiza una evolución de sesión existente"""
    existing = await db.evoluciones_sesion.find_one({"id": evolucion_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Evolución no encontrada")

    update_data = input.model_dump()
    update_data["id"] = evolucion_id
    update_data["created_at"] = existing.get("created_at")

    await db.evoluciones_sesion.update_one(
        {"id": evolucion_id},
        {"$set": update_data}
    )

    if isinstance(update_data["created_at"], str):
        update_data["created_at"] = datetime.fromisoformat(update_data["created_at"])

    return EvolicionSesion(**update_data)


# ========== NUTRICIÓN ==========

@router.post("/medical-history/nutricion", response_model=MedicalHistoryNutricion)
async def create_nutricion_history(
    input: MedicalHistoryNutricionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_nutricion.find_one({"appointment_id": input.appointment_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe historia clínica para esta cita")

    # Resolver paciente_id real desde db.pacientes por cédula
    paciente_id_real = ""
    if input.paciente_cedula:
        pac = await db.pacientes.find_one({"cedula": input.paciente_cedula}, {"_id": 0})
        if pac:
            paciente_id_real = pac.get("id", "")

    history_dict = input.model_dump()
    history_dict["paciente_id"] = paciente_id_real

    history = MedicalHistoryNutricion(**history_dict)
    doc = history.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_nutricion.insert_one(doc)

    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, input.paciente_cedula, input.paciente_nombre,
        input.doctor_id, "Nutrición", current_user.username
    )
    if fin_id:
        await db.medical_history_nutricion.update_one({"id": history.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history


@router.get("/medical-history/nutricion/appointment/{appointment_id}", response_model=MedicalHistoryNutricion)
async def get_nutricion_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_nutricion.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    if isinstance(history.get('created_at'), str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    return MedicalHistoryNutricion(**history)


@router.get("/medical-history/nutricion/paciente/{cedula}", response_model=List[MedicalHistoryNutricion])
async def get_nutricion_histories_by_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    histories = await db.medical_history_nutricion.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    for h in histories:
        if isinstance(h.get('created_at'), str):
            h['created_at'] = datetime.fromisoformat(h['created_at'])
    return histories


@router.put("/medical-history/nutricion/{history_id}", response_model=MedicalHistoryNutricion)
async def update_nutricion_history(
    history_id: str,
    input: MedicalHistoryNutricionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_nutricion.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['created_at'] = existing.get('created_at')
    await db.medical_history_nutricion.update_one({"id": history_id}, {"$set": update_data})
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    return MedicalHistoryNutricion(**update_data)


# ========== GINECOLOGÍA / OBSTETRICIA ==========

@router.post("/medical-history/ginecologia", response_model=MedicalHistoryGinecologia)
async def create_ginecologia_history(
    input: MedicalHistoryGinecologiaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_ginecologia.find_one({"appointment_id": input.appointment_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe historia clínica para esta cita")

    # Resolver paciente_id real desde db.pacientes por cédula
    paciente_id_real = ""
    if input.paciente_cedula:
        pac = await db.pacientes.find_one({"cedula": input.paciente_cedula}, {"_id": 0})
        if pac:
            paciente_id_real = pac.get("id", "")

    history_dict = input.model_dump()
    history_dict["paciente_id"] = paciente_id_real

    history = MedicalHistoryGinecologia(**history_dict)
    doc = history.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_ginecologia.insert_one(doc)

    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, input.paciente_cedula, input.paciente_nombre,
        input.doctor_id, "Ginecología", current_user.username
    )
    if fin_id:
        await db.medical_history_ginecologia.update_one({"id": history.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history


@router.get("/medical-history/ginecologia/appointment/{appointment_id}", response_model=MedicalHistoryGinecologia)
async def get_ginecologia_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_ginecologia.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    if isinstance(history.get('created_at'), str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    return MedicalHistoryGinecologia(**history)


@router.get("/medical-history/ginecologia/paciente/{cedula}", response_model=List[MedicalHistoryGinecologia])
async def get_ginecologia_histories_by_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    histories = await db.medical_history_ginecologia.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    for h in histories:
        if isinstance(h.get('created_at'), str):
            h['created_at'] = datetime.fromisoformat(h['created_at'])
    return histories


@router.put("/medical-history/ginecologia/{history_id}", response_model=MedicalHistoryGinecologia)
async def update_ginecologia_history(
    history_id: str,
    input: MedicalHistoryGinecologiaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_ginecologia.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['created_at'] = existing.get('created_at')
    await db.medical_history_ginecologia.update_one({"id": history_id}, {"$set": update_data})
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    return MedicalHistoryGinecologia(**update_data)


# ========== ECOGRAFÍA ==========

@router.post("/medical-history/ecografia", response_model=MedicalHistoryEcografia)
async def create_ecografia_history(
    input: MedicalHistoryEcografiaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_ecografia.find_one({"appointment_id": input.appointment_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe historia clínica para esta cita")

    # Resolver paciente_id real desde db.pacientes por cédula
    paciente_id_real = ""
    if input.paciente_cedula:
        pac = await db.pacientes.find_one({"cedula": input.paciente_cedula}, {"_id": 0})
        if pac:
            paciente_id_real = pac.get("id", "")

    history_dict = input.model_dump()
    history_dict["paciente_id"] = paciente_id_real

    history = MedicalHistoryEcografia(**history_dict)
    doc = history.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.medical_history_ecografia.insert_one(doc)

    fin_id = await crear_consulta_financiera_automatica(
        input.appointment_id, input.paciente_cedula, input.paciente_nombre,
        input.doctor_id, "Ecografía", current_user.username
    )
    if fin_id:
        await db.medical_history_ecografia.update_one({"id": history.id}, {"$set": {"consulta_financiera_id": fin_id}})

    return history


@router.get("/medical-history/ecografia/appointment/{appointment_id}", response_model=MedicalHistoryEcografia)
async def get_ecografia_history_by_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    history = await db.medical_history_ecografia.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not history:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    if isinstance(history.get('created_at'), str):
        history['created_at'] = datetime.fromisoformat(history['created_at'])
    return MedicalHistoryEcografia(**history)


@router.get("/medical-history/ecografia/paciente/{cedula}", response_model=List[MedicalHistoryEcografia])
async def get_ecografia_histories_by_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    histories = await db.medical_history_ecografia.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).sort("fecha", -1).to_list(100)
    for h in histories:
        if isinstance(h.get('created_at'), str):
            h['created_at'] = datetime.fromisoformat(h['created_at'])
    return histories


@router.put("/medical-history/ecografia/{history_id}", response_model=MedicalHistoryEcografia)
async def update_ecografia_history(
    history_id: str,
    input: MedicalHistoryEcografiaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.medical_history_ecografia.find_one({"id": history_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    update_data = input.model_dump()
    update_data['id'] = history_id
    update_data['created_at'] = existing.get('created_at')
    await db.medical_history_ecografia.update_one({"id": history_id}, {"$set": update_data})
    if isinstance(update_data['created_at'], str):
        update_data['created_at'] = datetime.fromisoformat(update_data['created_at'])
    return MedicalHistoryEcografia(**update_data)


@router.post("/nutricion/enviar-plan/{appointment_id}")
async def enviar_plan_nutricional(
    appointment_id: str,
    data: dict = {},
    current_user: TokenData = Depends(get_current_user)
):
    """Envia el plan nutricional por correo al paciente."""

    apt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not apt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    hist = await db.medical_history_nutricion.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not hist:
        raise HTTPException(status_code=404, detail="Historia nutricional no encontrada. Guarda primero la consulta.")

    email_destino = data.get("email") or apt.get("email", "")
    if not email_destino:
        raise HTTPException(status_code=400, detail="No hay email del paciente. Agrega el correo en la ficha de la cita.")

    cfg_email = await db.configuracion.find_one({"clave": "email_config"}, {"_id": 0})
    if not cfg_email or not cfg_email.get("valor"):
        raise HTTPException(status_code=503, detail="Correo no configurado. Ve a Admin -> Config. SRI -> seccion Gmail")

    email_cfg = cfg_email["valor"]
    smtp_user = email_cfg.get("email", "")
    smtp_pass = email_cfg.get("app_password", "")
    if not smtp_user or not smtp_pass:
        raise HTTPException(status_code=503, detail="Configuracion de correo incompleta")

    plan = hist.get("plan_alimentario", "")
    recs = hist.get("recomendaciones", "")
    diag = hist.get("diagnostico_nutricional", "")
    peso = hist.get("peso_actual", "") or str(hist.get("examen_fisico", {}).get("peso", ""))
    imc  = hist.get("imc", "") or str(hist.get("examen_fisico", {}).get("imc", ""))
    nombre = apt.get("nombre_completo", "Paciente")
    fecha = apt.get("fecha", "")

    plan_html = f"<div style='white-space:pre-wrap;font-size:13px;line-height:1.6'>{plan}</div>" if plan else ""
    recs_html = f"<div style='white-space:pre-wrap;font-size:13px;line-height:1.6'>{recs}</div>" if recs else ""

    cuerpo = f"""<html><body style='font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto'>
<div style='background:linear-gradient(135deg,#00a8cc,#005f73);padding:20px;border-radius:10px 10px 0 0;text-align:center'>
  <h2 style='color:white;margin:0'>Plan Nutricional Personalizado</h2>
  <p style='color:rgba(255,255,255,0.8);margin:5px 0 0'>Centro de Especialidades Family Health</p>
</div>
<div style='background:#f8fdff;padding:20px;border:1px solid #e0f7fa'>
  <p>Estimado/a <strong>{nombre}</strong>,</p>
  <p>A continuacion su plan nutricional personalizado segun su evaluacion del {fecha}.</p>
  <div style='background:white;border:1px solid #b2ebf2;border-radius:8px;padding:15px;margin:12px 0'>
    <p style='margin:0 0 8px;font-weight:700;color:#005f73'>Datos de su consulta:</p>
    <p style='margin:3px 0'>Fecha: {fecha}</p>
    {'<p style="margin:3px 0">Peso: ' + peso + ' kg</p>' if peso else ''}
    {'<p style="margin:3px 0">IMC: ' + imc + '</p>' if imc else ''}
    {'<p style="margin:3px 0">Diagnostico: ' + diag + '</p>' if diag else ''}
  </div>
  {'<div style="background:white;border:1px solid #b2ebf2;border-radius:8px;padding:15px;margin:12px 0"><p style="margin:0 0 10px;font-weight:700;color:#005f73">Plan Alimentario:</p>' + plan_html + '</div>' if plan else ''}
  {'<div style="background:#fff3e0;border:1px solid #ffe0b2;border-radius:8px;padding:15px;margin:12px 0"><p style="margin:0 0 8px;font-weight:700;color:#e65100">Recomendaciones:</p>' + recs_html + '</div>' if recs else ''}
  <p style='font-size:12px;color:#666;margin-top:16px'>Si tiene dudas sobre su plan, contactenos.</p>
</div>
<div style='background:#005f73;padding:15px;border-radius:0 0 10px 10px;text-align:center'>
  <p style='color:white;margin:0;font-size:13px'>Family Health | Guayaquil | 096-291-2170</p>
</div>
</body></html>"""

    msg = MIMEMultipart()
    msg["From"] = f"Family Health <{smtp_user}>"
    msg["To"] = email_destino
    msg["Subject"] = f"Plan Nutricional - {nombre} - Family Health"
    msg.attach(MIMEText(cuerpo, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return {"ok": True, "mensaje": f"Plan nutricional enviado a {email_destino}"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="Error de autenticacion Gmail. Usa una App Password.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar: {e}")

# ========== MIGRACIÓN: RECALCULAR EDAD PACIENTES EXISTENTES ==========

@router.post("/admin/migrar-edades")
async def migrar_edades_pacientes(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Recalcula la edad de TODOS los appointments existentes que tienen edad=0
    pero sí tienen fecha_nacimiento. Ejecutar UNA sola vez después del deploy.
    Solo accesible para Administrador.
    """
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo el Administrador puede ejecutar migraciones")

    appointments = await db.appointments.find({}, {"_id": 0}).to_list(10000)
    actualizados = 0
    sin_fecha = 0
    print(f"\n🔄 INICIANDO MIGRACIÓN DE EDADES")
    print(f"   Total citas a procesar: {len(appointments)}")

    for apt in appointments:
        fecha = apt.get("fecha_nacimiento", "")
        edad_actual = apt.get("edad", 0)

        if fecha:
            nueva_edad = calcular_edad_desde_fecha(fecha)
            # Actualizar si la edad es diferente (incluyendo edad=0 con fecha válida)
            if nueva_edad != edad_actual:
                await db.appointments.update_one(
                    {"id": apt["id"]},
                    {"$set": {"edad": nueva_edad}}
                )
                actualizados += 1
                print(f"   ✅ {apt.get('nombre_completo', 'N/A')}: {edad_actual} → {nueva_edad} años")
        else:
            sin_fecha += 1

    print(f"\n✅ MIGRACIÓN COMPLETADA")
    print(f"   Actualizados: {actualizados}")
    print(f"   Sin fecha: {sin_fecha}")

    return {
        "ok": True,
        "total_procesados": len(appointments),
        "actualizados": actualizados,
        "sin_fecha_nacimiento": sin_fecha,
        "mensaje": f"✅ {actualizados} pacientes actualizados con edad correcta"
    }
