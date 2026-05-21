from fastapi import APIRouter, HTTPException, Depends
import httpx
import os
from typing import Optional
from datetime import datetime, timezone

from db import db
from auth import TokenData, get_current_user

router = APIRouter(tags=["ia"])

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

async def get_gemini_key() -> str:
    """Lee la API key de MongoDB. Fallback a variable de entorno."""
    try:
        cfg = await db.configuracion.find_one({"clave": "gemini_api_key"}, {"_id": 0})
        if cfg and cfg.get("valor"):
            return cfg["valor"]
    except Exception:
        pass
    return os.environ.get("GEMINI_API_KEY", "")

SYSTEM_PROMPT_MEDICO = """Eres un asistente médico de apoyo clínico para el Centro de Especialidades Family Health en Guayaquil, Ecuador.
Tu función es APOYAR al médico humano, nunca reemplazarlo. Siempre debes:
- Responder en español, de forma concisa y clínica
- Proporcionar diferenciales diagnósticos con sus códigos CIE-10
- Sugerir tratamientos farmacológicos con dosis habituales para adultos/niños según corresponda
- Indicar cuándo referir a especialista
- Mencionar signos de alarma relevantes
- Aclarar siempre que tus sugerencias requieren validación del médico tratante
- Para odontología, sugerir procedimientos con los nombres del catálogo de Family Health cuando sea posible

IMPORTANTE: No eres un sustituto del criterio médico. Tus respuestas son apoyo informativo basado en evidencia."""


@router.post("/ia/consulta-medica")
async def consulta_ia_medica(
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Endpoint de IA médica usando Google Gemini Flash (gratuito).
    Recibe contexto del paciente y la pregunta del médico.
    data: {
        mensaje: str,           # pregunta o descripción del caso
        especialidad: str,       # Medicina General, Odontología, etc.
        contexto_paciente: {    # datos del paciente actual
            nombre, edad, sexo,
            motivo_consulta, antecedentes,
            diagnostico_previo, medicamentos_actuales
        },
        historial: [ {rol: user|assistant, texto: str} ]  # para modo chat
    }
    """
    GEMINI_API_KEY = await get_gemini_key()
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="IA no configurada. Ve a Admin → Configuración IA y guarda tu API key de Gemini."
        )

    mensaje = data.get("mensaje", "").strip()
    especialidad = data.get("especialidad", "Medicina General")
    ctx = data.get("contexto_paciente", {})
    historial = data.get("historial", [])

    if not mensaje:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    # Construir contexto del paciente
    contexto_str = f"""
CONTEXTO DEL PACIENTE ACTUAL:
- Nombre: {ctx.get('nombre', 'No especificado')}
- Edad: {ctx.get('edad', 'No especificada')} años
- Sexo: {ctx.get('sexo', 'No especificado')}
- Especialidad: {especialidad}
- Motivo de consulta: {ctx.get('motivo_consulta', 'No especificado')}
- Antecedentes: {ctx.get('antecedentes', 'Sin antecedentes registrados')}
- Alergias: {ctx.get('alergias', 'Ninguna conocida')}
- Medicamentos actuales: {ctx.get('medicamentos_actuales', 'Ninguno')}
- Diagnóstico previo: {ctx.get('diagnostico_previo', 'Primera consulta')}
"""

    # Armar historial de conversación para Gemini
    contents = []

    # Mensaje del sistema como primer turno de usuario
    contents.append({
        "role": "user",
        "parts": [{"text": SYSTEM_PROMPT_MEDICO + "\n\n" + contexto_str}]
    })
    contents.append({
        "role": "model",
        "parts": [{"text": "Entendido. Estoy listo para apoyar la consulta con el contexto del paciente proporcionado. ¿En qué puedo ayudar al médico?"}]
    })

    # Agregar historial previo del chat
    for h in historial[-10:]:  # solo últimos 10 turnos para no exceder tokens
        role = "user" if h.get("rol") == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": h.get("texto", "")}]
        })

    # Mensaje actual del médico
    contents.append({
        "role": "user",
        "parts": [{"text": mensaje}]
    })

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                json={
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.3,      # bajo = más conservador/clínico
                        "maxOutputTokens": 1000,
                        "topP": 0.8,
                    },
                    "safetySettings": [
                        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
                        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
                        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
                    ]
                },
                headers={"Content-Type": "application/json"}
            )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Error de Gemini API: {response.status_code} — Verifique la GEMINI_API_KEY"
            )

        result = response.json()
        texto_respuesta = result["candidates"][0]["content"]["parts"][0]["text"]

        return {
            "respuesta": texto_respuesta,
            "modelo": "gemini-1.5-flash",
            "tokens_usados": result.get("usageMetadata", {}).get("totalTokenCount", 0)
        }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout — Gemini tardó demasiado, intente de nuevo")
    except KeyError:
        raise HTTPException(status_code=502, detail="Respuesta inesperada de Gemini API")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error de IA: {str(e)}")
