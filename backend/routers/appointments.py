from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
import uuid

from db import db
from models import Appointment, AppointmentCreate, AppointmentUpdate
from auth import get_current_user, TokenData
from financial_routes import unificar_paciente_por_cedula
from routers.helpers import calcular_edad_desde_fecha

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.post("", response_model=Appointment)
async def create_appointment(
    input: AppointmentCreate,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Crear cita con unificación automática de paciente por cédula.
    Si la cédula ya existe, actualiza datos vacíos del paciente (no sobreescribe).
    """
    # Calcular edad desde fecha_nacimiento
    if input.fecha_nacimiento:
        try:
            fn = datetime.fromisoformat(input.fecha_nacimiento)
            hoy_dt = datetime.now()
            edad_calc = hoy_dt.year - fn.year
            if (hoy_dt.month, hoy_dt.day) < (fn.month, fn.day):
                edad_calc -= 1
            input.edad = max(0, edad_calc)
        except Exception:
            pass

    # Detectar menor de edad automáticamente
    if input.edad > 0 and input.edad < 18:
        input.es_menor = True

    # Buscar doctor (opcional — no bloquea si no se especifica)
    doctor = None
    if input.doctor_id:
        doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
        if not doctor:
            # Fallback: buscar por nombre
            if input.doctor_nombre:
                doctor = await db.doctors.find_one(
                    {"nombre": {"$regex": input.doctor_nombre, "$options": "i"}}, {"_id": 0}
                )

    # Unificar paciente por cédula (evita duplicados)
    cedula_principal = input.cedula or input.paciente_cedula or ""
    datos_adicionales = {
        "nombre": input.nombre_completo,
        "telefono": input.telefono,
        "email": input.email or "",
        "whatsapp": input.whatsapp or "",
        "fecha_nacimiento": input.fecha_nacimiento,
        "sexo": input.sexo or "",
        "tipo_documento": input.tipo_documento or "cedula",
    }
    if cedula_principal:
        try:
            paciente = await unificar_paciente_por_cedula(
                cedula=cedula_principal,
                datos_adicionales=datos_adicionales,
            )
            paciente_id = paciente.id
            paciente_cedula = paciente.cedula
        except Exception:
            paciente_id = str(uuid.uuid4())
            paciente_cedula = cedula_principal
    else:
        paciente_id = str(uuid.uuid4())
        paciente_cedula = cedula_principal

    appointment_dict = input.model_dump()
    appointment_dict["doctor_nombre"] = doctor["nombre"] if doctor else (input.doctor_nombre or "")
    appointment_dict["paciente_cedula"] = paciente_cedula
    appointment_dict["paciente_id"] = paciente_id

    appointment_obj = Appointment(**appointment_dict)
    doc = appointment_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["detalles"] = []  # asegurar campo limpio

    await db.appointments.insert_one(doc)
    return appointment_obj


@router.get("", response_model=List[Appointment])
async def get_appointments(current_user: TokenData = Depends(get_current_user)):
    appointments = await db.appointments.find({}, {"_id": 0}).to_list(1000)
    for appointment in appointments:
        if isinstance(appointment["created_at"], str):
            appointment["created_at"] = datetime.fromisoformat(appointment["created_at"])
        if "estado" not in appointment:
            appointment["estado"] = "Programada"
    return appointments


@router.get("/{appointment_id}", response_model=Appointment)
async def get_appointment_by_id(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Retorna una cita por ID.
    Usado por DentalWorkspace (/odontologia-v2/:appointmentId) y cualquier
    componente que necesite datos de una cita específica sin cargar todas.
    """
    appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appointment:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if isinstance(appointment.get("created_at"), str):
        appointment["created_at"] = datetime.fromisoformat(appointment["created_at"])
    if "estado" not in appointment:
        appointment["estado"] = "Programada"
    return appointment


@router.put("/{appointment_id}", response_model=Appointment)
async def update_appointment(
    appointment_id: str,
    input: AppointmentUpdate,
    current_user: TokenData = Depends(get_current_user),
):
    existing = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    update_data = {k: v for k, v in input.model_dump().items() if v is not None}

    if "doctor_id" in update_data and update_data["doctor_id"]:
        doctor = await db.doctors.find_one({"id": update_data["doctor_id"]}, {"_id": 0})
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor no encontrado")
        update_data["doctor_nombre"] = doctor["nombre"]

    if update_data:
        await db.appointments.update_one({"id": appointment_id}, {"$set": update_data})

    updated = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if isinstance(updated["created_at"], str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])

    return Appointment(**updated)


@router.delete("/{appointment_id}")
async def delete_appointment(
    appointment_id: str,
    current_user: TokenData = Depends(get_current_user),
):
    result = await db.appointments.delete_one({"id": appointment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    return {"message": "Cita eliminada exitosamente"}