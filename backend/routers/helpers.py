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
    servicios_custom: list | None = None,
):
    """
    Crea consulta financiera automáticamente al cerrar cualquier consulta clínica.
    Si ya existe, la retorna sin duplicar.
    Usada por: medical-history (general, pediatric, odontology, nutricion, ginecologia, ecografia)
    y odontograma clínico ("Terminar Consulta").

    IMPORTANTE: paciente_id se resuelve desde db.pacientes por cédula.
                NO usar appointment_id como paciente_id.

    servicios_custom (opcional): lista de procedimientos a cobrar como ítems individuales,
        cada uno { "procedimiento": str, "precio": float, "diente": str (opcional) }.
        Si se pasa y suma > 0, el cobro se construye con esos ítems (caso odontología:
        cobrar por procedimientos realizados). Si es None o suma 0, se usa la tarifa
        fija de consulta del catálogo (comportamiento original de las demás especialidades).
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

        # ── Resolver paciente_id real desde db.pacientes ──────────────────────
        paciente_id_real = appointment.get("paciente_id") or ""
        if cedula:
            paciente_doc = await db.pacientes.find_one({"cedula": cedula}, {"_id": 0})
            if paciente_doc:
                paciente_id_real = paciente_doc.get("id", paciente_id_real)
                # Completar nombre si no viene del caller
                if not paciente_nombre:
                    paciente_nombre = paciente_doc.get("nombre") or paciente_doc.get("nombre_completo") or ""

        doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
        doctor_nombre = doctor.get("nombre", "") if doctor else ""

        # ── Buscar precio en catálogo ─────────────────────────────────────────
        precio = 30.0
        try:
            from specialty_utils import normalize_specialty
            esp_canon = normalize_specialty(especialidad)
            servicio_cat = await db.catalogo_servicios.find_one(
                {"especialidad": {"$regex": esp_canon, "$options": "i"}}, {"_id": 0}
            )
            if servicio_cat:
                precio = servicio_cat.get("precio_base", 30.0)
        except Exception:
            pass

        from financial_models import ConsultaFinanciera, DetalleServicio

        # ── Construir servicios y total ───────────────────────────────────────
        # Si llegan procedimientos personalizados con precio (odontología), se cobra
        # por cada uno; si no, una sola "Consulta {especialidad}" a tarifa de catálogo.
        servicios_obj = []
        total = 0.0
        if servicios_custom:
            for sc in servicios_custom:
                try:
                    p = float(sc.get("precio") or 0)
                except (TypeError, ValueError):
                    p = 0.0
                nombre_proc = sc.get("procedimiento") or "Procedimiento"
                diente = sc.get("diente")
                servicios_obj.append(DetalleServicio(
                    consulta_id="",
                    servicio=nombre_proc,
                    descripcion=(f"Pieza {diente}" if diente else nombre_proc),
                    precio_unitario=p,
                    cantidad=1,
                    subtotal=p,
                ))
                total += p

        # Fallback a tarifa fija si no hubo procedimientos con precio
        if not servicios_obj or total <= 0:
            servicios_obj = [DetalleServicio(
                consulta_id="",
                servicio=f"Consulta {especialidad}",
                descripcion=f"Consulta médica - {especialidad}",
                precio_unitario=precio,
                cantidad=1,
                subtotal=precio,
            )]
            total = precio

        consulta = ConsultaFinanciera(
            paciente_id=paciente_id_real,          # ← ID real del paciente
            paciente_cedula=cedula,
            paciente_nombre=paciente_nombre,
            doctor_id=doctor_id,
            doctor_nombre=doctor_nombre,
            appointment_id=appointment_id,
            especialidad=especialidad,
            fecha=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            motivo=appointment.get("observaciones", ""),
            total=total,
            total_pagado=0,
            saldo=total,
            estado_pago="pendiente",
            servicios=[],
            pagos=[],
            created_by=username,
        )
        for srv in servicios_obj:
            srv.consulta_id = consulta.id
        consulta.servicios = servicios_obj

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