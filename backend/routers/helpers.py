"""
Helpers compartidos entre routers.
NO modificar sin revisar todos los módulos que los importan.
"""
import logging
from datetime import datetime, timezone

from db import db


def calcular_edad_desde_fecha(fecha_nacimiento: str) -> int:
    """Calcula edad en años desde YYYY-MM-DD. Nunca devuelve 0 si hay fecha válida."""
    if not fecha_nacimiento:
        return 0
    try:
        from datetime import date
        nac = date.fromisoformat(str(fecha_nacimiento)[:10])
        hoy = date.today()
        edad = hoy.year - nac.year - ((hoy.month, hoy.day) < (nac.month, nac.day))
        return max(0, edad)
    except Exception:
        return 0


async def crear_consulta_financiera_automatica(
    appointment_id: str,
    paciente_cedula: str,
    paciente_nombre: str,
    doctor_id: str,
    especialidad: str,
    username: str,
):
    """
    Crea consulta financiera automáticamente al cerrar cualquier consulta clínica.
    Si ya existe, la retorna sin duplicar.
    Usada por: appointments, medical-history (general, pediatric, odontology,
               nutricion, ginecologia, ecografia), evoluciones-sesion.
    """
    try:
        existing = await db.consultas_financieras.find_one(
            {"appointment_id": appointment_id}, {"_id": 0}
        )
        if existing:
            return existing.get("id")

        appointment = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
        if not appointment:
            return None

        cedula = (
            paciente_cedula
            or appointment.get("cedula")
            or appointment.get("paciente_cedula")
            or ""
        )
        doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
        doctor_nombre = doctor.get("nombre", "") if doctor else ""

        # Buscar precio en catálogo
        precio = 30.0
        try:
            servicio_cat = await db.catalogo_servicios.find_one(
                {"especialidad": {"$regex": especialidad, "$options": "i"}}, {"_id": 0}
            )
            if servicio_cat:
                precio = servicio_cat.get("precio_base", 30.0)
        except Exception:
            pass

        from financial_models import ConsultaFinanciera, DetalleServicio

        servicio = DetalleServicio(
            consulta_id="",
            servicio=f"Consulta {especialidad}",
            descripcion=f"Consulta médica - {especialidad}",
            precio_unitario=precio,
            cantidad=1,
            subtotal=precio,
        )

        consulta = ConsultaFinanciera(
            paciente_id=appointment_id,
            paciente_cedula=cedula,
            paciente_nombre=paciente_nombre,
            doctor_id=doctor_id,
            doctor_nombre=doctor_nombre,
            appointment_id=appointment_id,
            especialidad=especialidad,
            fecha=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            motivo=appointment.get("observaciones", ""),
            total=precio,
            total_pagado=0,
            saldo=precio,
            estado_pago="pendiente",
            servicios=[],
            pagos=[],
            created_by=username,
        )
        servicio.consulta_id = consulta.id
        consulta.servicios = [servicio]

        doc = consulta.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        for srv in doc["servicios"]:
            srv["created_at"] = srv["created_at"].isoformat()

        await db.consultas_financieras.insert_one(doc)
        await db.appointments.update_one(
            {"id": appointment_id}, {"$set": {"estado": "Pendiente de Pago"}}
        )
        return consulta.id

    except Exception as e:
        logging.error(f"Error creando consulta financiera automática: {str(e)}")
        return None