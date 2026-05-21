import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List

from db import db
from models import Prescription, PrescriptionCreate
from auth import get_current_user, TokenData
from pdf_generator import generate_prescription_pdf, generate_certificado_pdf
from routers.helpers import calcular_edad_desde_fecha

router = APIRouter(tags=["prescriptions"])


# ── RECETAS MÉDICAS ────────────────────────────────────────────

@router.post("/prescriptions", response_model=Prescription)
async def create_prescription(
    input: PrescriptionCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crear receta médica — funciona para TODAS las especialidades:
    Medicina General, Odontología, Pediatría, Ginecología, otras.
    Solo valida campos mínimos obligatorios.
    """
    paciente_id_real = input.paciente_id or input.paciente_cedula or input.appointment_id or ""
    paciente_cedula_real = input.paciente_cedula or input.paciente_id or ""

    appointment = None
    if input.appointment_id:
        appointment = await db.appointments.find_one({"id": input.appointment_id}, {"_id": 0})
    if not appointment and paciente_id_real:
        appointment = await db.appointments.find_one({"id": paciente_id_real}, {"_id": 0})
    if not appointment and paciente_cedula_real:
        appointment = await db.appointments.find_one(
            {"cedula": paciente_cedula_real}, {"_id": 0}
        )
    if not appointment:
        appointment = {
            "id": input.appointment_id or "",
            "nombre_completo": input.paciente_nombre or "",
            "cedula": paciente_cedula_real,
            "edad": 0,
            "fecha_nacimiento": "",
            "especialidad": input.especialidad or "",
            "doctor_id": input.doctor_id or "",
        }

    doctor = None
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})

    doctor_id = (
        input.doctor_id
        or (user.get("doctor_id") if user else None)
        or appointment.get("doctor_id")
    )
    if doctor_id:
        doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})

    prescription_dict = input.model_dump()

    prescription_dict["paciente_id"] = appointment["id"]
    prescription_dict["paciente_nombre"] = appointment.get("nombre_completo", "")
    prescription_dict["paciente_cedula"] = appointment.get("cedula", "")
    prescription_dict["paciente_edad"] = (
        calcular_edad_desde_fecha(appointment.get("fecha_nacimiento", ""))
        or appointment.get("edad", 0)
    )
    prescription_dict["appointment_id"] = appointment["id"]
    prescription_dict["especialidad"] = input.especialidad or appointment.get("especialidad", "")

    if doctor:
        prescription_dict["doctor_id"] = doctor["id"]
        prescription_dict["doctor_nombre"] = doctor.get("nombre", "")
        prescription_dict["doctor_especialidad"] = doctor.get("especialidad", "")
    else:
        prescription_dict["doctor_id"] = doctor_id or ""
        prescription_dict["doctor_nombre"] = user.get("nombre_completo", "") if user else ""
        prescription_dict["doctor_especialidad"] = appointment.get("especialidad", "")

    if not prescription_dict.get("fecha"):
        prescription_dict["fecha"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if prescription_dict.get("medicamentos"):
        prescription_dict["medicamentos"] = [
            m for m in prescription_dict.get("medicamentos", [])
            if m.get("nombre", "").strip()
        ]
    else:
        prescription_dict["medicamentos"] = []

    try:
        prescription_obj = Prescription(**prescription_dict)
        doc = prescription_obj.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        await db.prescriptions.insert_one(doc)
        return prescription_obj
    except Exception as e:
        logging.error(f"Error creando receta: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al crear receta: {str(e)}")


@router.get("/prescriptions", response_model=List[Prescription])
async def get_prescriptions(current_user: TokenData = Depends(get_current_user)):
    prescriptions = await db.prescriptions.find({}, {"_id": 0}).to_list(1000)
    for prescription in prescriptions:
        if isinstance(prescription["created_at"], str):
            prescription["created_at"] = datetime.fromisoformat(prescription["created_at"])
    return prescriptions


@router.get("/prescriptions/patient/{cedula}", response_model=List[Prescription])
async def get_prescriptions_by_patient(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtener todas las recetas de un paciente por cédula"""
    prescriptions = await db.prescriptions.find(
        {"paciente_cedula": cedula}, {"_id": 0}
    ).to_list(1000)
    for prescription in prescriptions:
        if isinstance(prescription["created_at"], str):
            prescription["created_at"] = datetime.fromisoformat(prescription["created_at"])
    prescriptions.sort(key=lambda x: x.get("fecha", ""), reverse=True)
    return prescriptions


@router.get("/prescriptions/{prescription_id}/pdf")
async def download_prescription_pdf(
    prescription_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    prescription = await db.prescriptions.find_one({"id": prescription_id}, {"_id": 0})
    if not prescription:
        raise HTTPException(status_code=404, detail="Receta no encontrada")
    pdf_buffer = generate_prescription_pdf(prescription)
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f"attachment; filename=receta_"
                f"{prescription['paciente_cedula']}_{prescription['fecha']}.pdf"
            )
        }
    )


# ── CERTIFICADO MÉDICO ─────────────────────────────────────────

@router.post("/certificado/pdf")
async def generate_certificado(
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Genera un certificado médico en PDF con branding Family Health"""
    try:
        pdf_buffer = generate_certificado_pdf(data)
        nombre = data.get("paciente_cedula", "paciente")
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=certificado_{nombre}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando certificado: {str(e)}")