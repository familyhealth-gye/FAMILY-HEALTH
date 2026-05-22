from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone

from db import db
from auth import TokenData, get_current_user
from routers.helpers import calcular_edad_desde_fecha

router = APIRouter(tags=["clinical-utils"])

@router.get("/clinical/summary/{cedula}")
async def get_clinical_summary(cedula: str, current_user: TokenData = Depends(get_current_user)):
    """Obtiene un resumen clínico rápido del paciente para el dashboard."""
    # Buscar última consulta de cualquier tipo
    collections = [
        "medical_history_general", "medical_history_pediatric",
        "medical_history_odontology", "medical_history_nutricion",
        "medical_history_ginecologia", "medical_history_ecografia"
    ]

    last_consultations = []
    for coll in collections:
        doc = await getattr(db, coll).find_one(
            {"paciente_cedula": cedula},
            sort=[("fecha", -1)]
        )
        if doc:
            last_consultations.append({
                "tipo": coll.replace("medical_history_", "").capitalize(),
                "fecha": doc.get("fecha"),
                "diagnostico": doc.get("diagnostico") or doc.get("diagnostico_texto") or doc.get("conclusion")
            })

    last_consultations.sort(key=lambda x: x["fecha"] or "", reverse=True)

    return {
        "cedula": cedula,
        "ultima_consulta": last_consultations[0] if last_consultations else None,
        "historial_resumido": last_consultations[:5]
    }
