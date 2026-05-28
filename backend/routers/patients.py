from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
import uuid

from db import db
from auth import get_current_user, TokenData

router = APIRouter(tags=["patients"])


# ── HISTORIAL CLÍNICO COMPLETO POR CÉDULA ─────────────────────

@router.get("/historial-paciente/{cedula}")
async def get_historial_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Retorna TODO el historial clínico de un paciente por cédula,
    de todas las especialidades, ordenado por fecha descendente.
    Usado por el panel lateral de historial.
    """
    historial = []

    collections_map = [
        ("medical_history_general", "Medicina General"),
        ("medical_history_pediatric", "Pediatría"),
        ("medical_history_odontology", "Odontología"),
        ("medical_history_nutricion", "Nutrición"),
        ("medical_history_ginecologia", "Ginecología"),
        ("medical_history_ecografia", "Ecografía"),
    ]

    for collection_name, especialidad in collections_map:
        collection = getattr(db, collection_name)
        docs = await collection.find({"paciente_cedula": cedula}, {"_id": 0}).to_list(200)
        for doc in docs:
            historial.append({
                "id": doc.get("id"),
                "especialidad": especialidad,
                "fecha": doc.get("fecha", ""),
                "motivo_consulta": doc.get("motivo_consulta", doc.get("conclusion", "")),
                "diagnostico": doc.get("diagnostico_texto", doc.get("diagnostico", "")),
                "cie10_codigo": doc.get("cie10_codigo", ""),
                "cie10_descripcion": doc.get("cie10_descripcion", ""),
                "doctor_nombre": doc.get("doctor_nombre", ""),
                "appointment_id": doc.get("appointment_id", ""),
                "created_at": doc.get("created_at", ""),
            })

    historial.sort(key=lambda x: x.get("fecha", ""), reverse=True)
    return historial


# ── ANTECEDENTES CLÍNICOS ──────────────────────────────────────

@router.get("/antecedentes-paciente/{cedula}")
async def get_antecedentes_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Busca antecedentes clínicos. Fuente prioridad:
    1. db.pacientes.antecedentes (guardados por recepción o doctor via PUT)
    2. Historial clínico de cada especialidad (retrocompatibilidad)
    """
    antecedentes = {
        "diabetes": False,
        "hipertension": False,
        "cardiopatias": False,
        "hepatitis": False,
        "vih": False,
        "epilepsia": False,
        "embarazo": False,
        "asma": False,
        "alergias_medicamentos": "",
        "alergias": "",
        "ant_familiares": "",
        "ant_personales": "",
        "ant_quirurgicos": "",
        "medicamentos_actuales": "",
        "fumador": False,
        "alcohol": False,
        "menarquia": "",
        "gestas": None,
        "partos": None,
        "cesareas": None,
        "abortos": None,
        "tiene_antecedentes": False,
        "fuente": "",
        "fecha_registro": "",
    }

    # ── Prioridad 1: antecedentes guardados directamente en db.pacientes ──────
    paciente_doc = await db.pacientes.find_one({"cedula": cedula}, {"_id": 0})
    if paciente_doc and paciente_doc.get("antecedentes"):
        ant = paciente_doc["antecedentes"]
        for campo in ["diabetes","hipertension","cardiopatias","hepatitis","vih","epilepsia","embarazo","asma"]:
            if ant.get(campo):
                antecedentes[campo] = True
        for campo in ["alergias_medicamentos","alergias","ant_familiares","ant_personales",
                      "ant_quirurgicos","medicamentos_actuales"]:
            if ant.get(campo):
                antecedentes[campo] = ant[campo]
        antecedentes["tiene_antecedentes"] = True
        antecedentes["fuente"] = "Recepción/Ficha"
        antecedentes["fecha_registro"] = paciente_doc.get("antecedentes_actualizados", "")

    # ── Prioridad 2: historial clínico (retrocompatibilidad) ─────────────────
    busquedas = [
        ("medical_history_general", "Medicina General"),
        ("medical_history_pediatric", "Pediatría"),
        ("medical_history_odontology", "Odontología"),
        ("medical_history_nutricion", "Nutrición"),
        ("medical_history_ginecologia", "Ginecología"),
    ]

    for collection_name, especialidad in busquedas:
        collection = getattr(db, collection_name)
        docs = await collection.find(
            {"paciente_cedula": cedula}, {"_id": 0}
        ).sort("fecha", 1).to_list(1)

        if not docs:
            continue

        doc = docs[0]
        antecedentes["tiene_antecedentes"] = True
        antecedentes["fuente"] = especialidad
        antecedentes["fecha_registro"] = doc.get("fecha", "")

        for campo in ["diabetes", "hipertension", "cardiopatias", "hepatitis", "vih", "epilepsia", "embarazo"]:
            if doc.get(campo):
                antecedentes[campo] = True

        for campo_doc, campo_ant in [
            ("alergias_medicamentos", "alergias_medicamentos"),
            ("alergias", "alergias"),
            ("ant_personales_alergias", "alergias"),
        ]:
            valor = doc.get(campo_doc, "")
            if valor and len(valor) > len(antecedentes.get(campo_ant, "")):
                antecedentes[campo_ant] = valor

        for campo_doc, campo_ant in [
            ("ant_familiares", "ant_familiares"),
            ("ant_personales", "ant_personales"),
            ("ant_personales_quirurgicos", "ant_quirurgicos"),
            ("antecedentes_familiares", "ant_familiares"),
            ("medicamentos_actuales", "medicamentos_actuales"),
        ]:
            valor = doc.get(campo_doc, "")
            if valor and len(valor) > len(antecedentes.get(campo_ant, "")):
                antecedentes[campo_ant] = valor

        if especialidad == "Ginecología":
            datos_gine = doc.get("datos_ginecologicos", {})
            for campo in ["menarquia", "gestas", "partos", "cesareas", "abortos"]:
                if datos_gine.get(campo):
                    antecedentes[campo] = datos_gine[campo]

    alertas = []
    if antecedentes["alergias_medicamentos"] or antecedentes["alergias"]:
        alertas.append({
            "tipo": "ALERGIA",
            "color": "#dc2626",
            "icono": "⚠️",
            "mensaje": f"ALÉRGICO: {antecedentes['alergias_medicamentos'] or antecedentes['alergias']}"
        })
    if antecedentes["diabetes"]:
        alertas.append({"tipo": "DIABETES", "color": "#d97706", "icono": "🩸", "mensaje": "Paciente DIABÉTICO"})
    if antecedentes["hipertension"]:
        alertas.append({"tipo": "HTA", "color": "#dc2626", "icono": "❤️", "mensaje": "Paciente HIPERTENSO"})
    if antecedentes["cardiopatias"]:
        alertas.append({"tipo": "CARDIOPATÍA", "color": "#dc2626", "icono": "🫀", "mensaje": "Paciente con CARDIOPATÍA"})
    if antecedentes["epilepsia"]:
        alertas.append({"tipo": "EPILEPSIA", "color": "#7c3aed", "icono": "⚡", "mensaje": "Paciente con EPILEPSIA"})
    if antecedentes["hepatitis"]:
        alertas.append({"tipo": "HEPATITIS", "color": "#d97706", "icono": "🏥", "mensaje": "Paciente con HEPATITIS"})
    if antecedentes["vih"]:
        alertas.append({"tipo": "VIH", "color": "#dc2626", "icono": "🔴", "mensaje": "Paciente VIH+"})
    if antecedentes["embarazo"]:
        alertas.append({"tipo": "EMBARAZO", "color": "#ec4899", "icono": "🤱", "mensaje": "Paciente EMBARAZADA"})

    antecedentes["alertas"] = alertas
    return antecedentes


@router.put("/antecedentes-paciente/{cedula}")
async def update_antecedentes_paciente(
    cedula: str,
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Guarda/actualiza los antecedentes del paciente en la colección de pacientes.
    Se llama cuando el doctor llena los antecedentes por primera vez.
    """
    await db.pacientes.update_one(
        {"cedula": cedula},
        {"$set": {"antecedentes": data, "antecedentes_actualizados": datetime.now(timezone.utc).isoformat()}},
        upsert=True   # Crear el doc si no existe aún (paciente creado solo por cita)
    )
    return {"ok": True}


# ── IMÁGENES CLÍNICAS ──────────────────────────────────────────

@router.post("/imagenes-clinicas")
async def guardar_imagen_clinica(
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Guarda una imagen clínica (RX, foto antes/después, etc.) en base64.
    Se asocia al paciente por cédula y opcionalmente a una cita.
    """
    imagen_doc = {
        "id": str(uuid.uuid4()),
        "paciente_cedula": data.get("paciente_cedula", ""),
        "paciente_nombre": data.get("paciente_nombre", ""),
        "appointment_id": data.get("appointment_id", ""),
        "categoria": data.get("categoria", "Otro"),
        "tipo_archivo": data.get("tipo_archivo", "image/jpeg"),
        "nombre_archivo": data.get("nombre_archivo", "imagen.jpg"),
        "descripcion": data.get("descripcion", ""),
        "archivo_base64": data.get("archivo_base64", ""),
        "especialidad": data.get("especialidad", "Odontología"),
        "doctor_nombre": data.get("doctor_nombre", current_user.username),
        "fecha": datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.username,
    }
    await db.imagenes_clinicas.insert_one(imagen_doc)
    imagen_doc.pop("archivo_base64")
    return {"ok": True, "id": imagen_doc["id"], "fecha": imagen_doc["fecha"]}


@router.get("/imagenes-clinicas/paciente/{cedula}")
async def get_imagenes_paciente(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Lista las imágenes del paciente (sin base64 para que sea rápido)"""
    docs = await db.imagenes_clinicas.find(
        {"paciente_cedula": cedula},
        {"_id": 0, "archivo_base64": 0}
    ).sort("fecha", -1).to_list(200)
    return docs


@router.get("/imagenes-clinicas/{imagen_id}")
async def get_imagen(
    imagen_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """Obtiene una imagen específica con su base64"""
    doc = await db.imagenes_clinicas.find_one({"id": imagen_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    return doc


@router.delete("/imagenes-clinicas/{imagen_id}")
async def delete_imagen(
    imagen_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    await db.imagenes_clinicas.delete_one({"id": imagen_id})
    return {"ok": True}


# ── HISTORIAL DE CONSULTAS POR CÉDULA ─────────────────────────

@router.get("/paciente/{cedula}/historial-consultas")
async def get_historial_consultas_paciente(
    cedula: str,
    especialidad: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Retorna el historial de consultas de un paciente por cédula.
    Útil para detectar si es primera cita o cita subsecuente.
    """
    query = {"cedula": cedula}
    if especialidad:
        norm = especialidad.lower()
        query["especialidad"] = {"$regex": norm, "$options": "i"}

    citas = await db.appointments.find(query, {"_id": 0}).sort("fecha", -1).to_list(100)

    resultado = []
    for cita in citas:
        if cita.get("estado") in ("Pagada", "Atendida", "Pagado"):
            resultado.append({
                "id": cita.get("id"),
                "fecha": cita.get("fecha"),
                "especialidad": cita.get("especialidad"),
                "doctor_nombre": cita.get("doctor_nombre"),
                "estado": cita.get("estado"),
            })

    return {
        "cedula": cedula,
        "total_consultas": len(resultado),
        "es_primera_cita": len(resultado) == 0,
        "ultima_consulta": resultado[0] if resultado else None,
        "consultas": resultado,
    }


# ── MEDIDAS ANTROPOMÉTRICAS (NUTRICIÓN) ───────────────────────

@router.get("/paciente/{cedula}/medidas-nutricion")
async def get_medidas_nutricion(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Retorna el historial de medidas antropométricas de nutrición para
    mostrar el comparativo entre citas (peso, IMC, ICC, etc.)
    """
    citas = await db.appointments.find(
        {"cedula": cedula, "especialidad": {"$regex": "nutri", "$options": "i"}},
        {"_id": 0}
    ).sort("fecha", -1).to_list(50)

    medidas = []
    for cita in citas:
        hist = await db.medical_history_nutricion.find_one(
            {"appointment_id": cita["id"]}, {"_id": 0}
        )
        if not hist:
            continue
        ef = hist.get("examen_fisico") or {}
        if any(ef.get(k) is not None for k in ("peso", "talla", "imc", "porcentaje_grasa", "cintura", "cadera")):
            medidas.append({
                "fecha": cita.get("fecha"),
                "appointment_id": cita.get("id"),
                "peso": ef.get("peso"),
                "talla": ef.get("talla"),
                "imc": ef.get("imc"),
                "icc": ef.get("icc"),
                "masa_grasa": ef.get("porcentaje_grasa"),
                "masa_muscular": ef.get("porcentaje_musculo"),
                "edad_corporal": ef.get("edad_corporal"),
                "circunferencia_cintura": ef.get("cintura"),
                "circunferencia_cadera": ef.get("cadera"),
                "pliegue_suprailiaco": ef.get("pliegue_suprailiaco"),
                "pliegue_tricipital": ef.get("pliegue_tricipital"),
                "pliegue_bicipital": ef.get("pliegue_bicipital"),
                "pliegue_subescapular": ef.get("pliegue_subescapular"),
                "motivo_consulta": hist.get("motivo_consulta"),
                "diagnostico_texto": hist.get("diagnostico_texto"),
                "plan_alimentario": hist.get("plan_alimentario"),
            })

    return {"cedula": cedula, "medidas": medidas}