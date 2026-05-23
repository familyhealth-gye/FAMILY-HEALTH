"""
telemetry.py
Estructura base de telemetría operativa del pipeline clínico.

Colección: pipeline_telemetry (append-only, como audit_log).
No tiene dashboards todavía — solo registra eventos estructurados
para análisis posterior (tiempo por consulta, abandono, etc.).

Uso: fire-and-forget desde los endpoints clave.
"""

from datetime import datetime, timezone
from typing import Optional
import uuid
from db import db


async def registrar_evento(
    evento: str,
    plan_id: str,
    paciente_cedula: str = "",
    usuario: str = "",
    rol: str = "",
    metadata: dict = None,
) -> None:
    """
    Registra un evento de telemetría. Fire-and-forget.

    Eventos definidos:
    - consulta_iniciada        → cuando se abre DentalWorkspace
    - procedimiento_agregado   → cuando se añade al pipeline
    - consulta_cerrada         → cuando el doctor finaliza
    - fase_aprobada            → counter aprueba fase
    - proforma_generada        → counter genera proforma
    - procedimiento_realizado  → doctor ejecuta
    - plan_abandonado          → plan sin actividad >30 días (batch job)
    - conflicto_detectado      → version mismatch
    - autosave_fallido         → nota de sesión no persistió
    """
    try:
        doc = {
            "id":               str(uuid.uuid4()),
            "evento":           evento,
            "plan_id":          plan_id,
            "paciente_cedula":  paciente_cedula,
            "usuario":          usuario,
            "rol":              rol,
            "metadata":         metadata or {},
            "timestamp":        datetime.now(timezone.utc).isoformat(),
        }
        await db.pipeline_telemetry.insert_one(doc)
    except Exception:
        pass  # Telemetría nunca rompe el flujo


# ── Helpers con semántica explícita ──────────────────────────────────────────

async def t_consulta_iniciada(plan_id: str, paciente_cedula: str, usuario: str, rol: str) -> None:
    await registrar_evento("consulta_iniciada", plan_id, paciente_cedula, usuario, rol)


async def t_consulta_cerrada(
    plan_id: str,
    paciente_cedula: str,
    usuario: str,
    n_procedimientos: int,
    total_estimado: float,
) -> None:
    await registrar_evento(
        "consulta_cerrada", plan_id, paciente_cedula, usuario,
        metadata={"n_procedimientos": n_procedimientos, "total_estimado": total_estimado},
    )


async def t_proforma_generada(
    plan_id: str,
    paciente_cedula: str,
    usuario: str,
    proforma_id: str,
    monto: float,
) -> None:
    await registrar_evento(
        "proforma_generada", plan_id, paciente_cedula, usuario,
        metadata={"proforma_id": proforma_id, "monto": monto},
    )


async def t_conflicto_detectado(
    plan_id: str,
    usuario: str,
    version_local: int,
    version_server: int,
) -> None:
    await registrar_evento(
        "conflicto_detectado", plan_id, usuario=usuario,
        metadata={"version_local": version_local, "version_server": version_server},
    )


async def t_autosave_fallido(plan_id: str, appointment_id: str, usuario: str) -> None:
    await registrar_evento(
        "autosave_fallido", plan_id, usuario=usuario,
        metadata={"appointment_id": appointment_id},
    )
