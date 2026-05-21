from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
import httpx
import os

from db import db
from auth import TokenData, get_current_user

router = APIRouter(tags=["configuration"])

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"

# ========== CONFIGURACIÓN CLÍNICA ==========

@router.post("/configuracion/clinica")
async def save_config_clinica(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.update_one(
        {"clave": "clinica_config"},
        {"$set": {
            "clave": "clinica_config",
            "valor": data,
            "actualizado": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"ok": True}


@router.get("/configuracion/clinica")
async def get_config_clinica(current_user: TokenData = Depends(get_current_user)):
    cfg = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    return cfg.get("valor", {}) if cfg else {}


# ========== CONFIGURACIÓN IA (GEMINI) ==========

@router.get("/configuracion/ia")
async def get_config_ia(current_user: TokenData = Depends(get_current_user)):
    """Lee la configuración de IA — solo muestra si está configurada, nunca devuelve la key."""
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    cfg = await db.configuracion.find_one({"clave": "gemini_api_key"}, {"_id": 0})
    tiene_key = bool(cfg and cfg.get("valor"))
    key_preview = ""
    if tiene_key:
        val = cfg["valor"]
        key_preview = val[:8] + "..." + val[-4:]
    return {
        "configurada": tiene_key,
        "key_preview": key_preview,
        "modelo": "gemini-1.5-flash",
        "costo": "Gratuito (hasta 1M tokens/día)",
        "actualizado": cfg.get("actualizado", "") if cfg else ""
    }


@router.post("/configuracion/ia")
async def save_config_ia(data: dict, current_user: TokenData = Depends(get_current_user)):
    """Guarda la API key de Gemini en MongoDB. Solo Administrador."""
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")

    api_key = data.get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="La API key no puede estar vacía")
    if not api_key.startswith("AIza"):
        raise HTTPException(status_code=400, detail="API key inválida — debe empezar con 'AIza'")

    # Verificar que la key funciona antes de guardar
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            test_resp = await client.post(
                f"{GEMINI_URL}?key={api_key}",
                json={"contents": [{"role": "user", "parts": [{"text": "test"}]}],
                      "generationConfig": {"maxOutputTokens": 5}},
                headers={"Content-Type": "application/json"}
            )
        if test_resp.status_code == 400:
            raise HTTPException(status_code=400, detail="API key inválida — verifica en aistudio.google.com")
        if test_resp.status_code == 403:
            raise HTTPException(status_code=400, detail="API key sin permisos — verifica en Google AI Studio")
    except httpx.TimeoutException:
        pass  # Timeout no significa key inválida, guardar igual

    await db.configuracion.update_one(
        {"clave": "gemini_api_key"},
        {"$set": {
            "clave": "gemini_api_key",
            "valor": api_key,
            "actualizado": datetime.now(timezone.utc).isoformat(),
            "actualizado_por": current_user.username
        }},
        upsert=True
    )
    return {"ok": True, "mensaje": "✅ API key guardada correctamente en MongoDB"}


@router.delete("/configuracion/ia")
async def delete_config_ia(current_user: TokenData = Depends(get_current_user)):
    """Elimina la API key de MongoDB."""
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.delete_one({"clave": "gemini_api_key"})
    return {"ok": True, "mensaje": "API key eliminada"}


# ========== CONFIGURACIÓN EMAIL ==========

@router.post("/configuracion/email")
async def save_config_email(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.update_one(
        {"clave": "email_config"},
        {"$set": {
            "clave": "email_config",
            "valor": {
                "email": data.get("email",""),
                "app_password": data.get("app_password",""),
                "nombre": data.get("nombre","Family Health")
            },
            "actualizado": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"ok": True, "mensaje": "✅ Configuración de correo guardada"}


@router.get("/configuracion/email")
async def get_config_email(current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    cfg = await db.configuracion.find_one({"clave": "email_config"}, {"_id": 0})
    if not cfg or not cfg.get("valor"):
        return {"configurado": False}
    val = cfg["valor"]
    return {
        "configurado": bool(val.get("email") and val.get("app_password")),
        "email": val.get("email",""),
        "nombre": val.get("nombre","Family Health")
    }


# ========== CONFIGURACIÓN LABORATORIO EXTERNO ==========

@router.post("/configuracion/laboratorio")
async def save_config_laboratorio(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    await db.configuracion.update_one(
        {"clave": "laboratorio_externo"},
        {"$set": {
            "clave": "laboratorio_externo",
            "valor": {
                "nombre": data.get("nombre", "Laboratorio"),
                "link": data.get("link", ""),
                "notas": data.get("notas", "")
            },
            "actualizado": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"ok": True}


@router.get("/configuracion/laboratorio")
async def get_config_laboratorio(current_user: TokenData = Depends(get_current_user)):
    cfg = await db.configuracion.find_one({"clave": "laboratorio_externo"}, {"_id": 0})
    return cfg.get("valor", {}) if cfg else {}


# ========== CONFIGURACIÓN SRI ==========

@router.get("/sri/configuracion")
async def get_sri_configuracion(current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador")
    cfg = await db.configuracion.find_one({"clave": "firma_electronica"}, {"_id": 0})
    if not cfg or not cfg.get("valor"):
        return {"configurado": False}
    val = cfg["valor"]
    return {
        "configurado": True,
        "titular": val.get("titular", ""),
        "valido_hasta": val.get("valido_hasta", ""),
        "ambiente": val.get("ambiente", "produccion"),
        "actualizado": cfg.get("actualizado", "")
    }

@router.post("/sri/configurar-firma")
async def configurar_firma_electronica(data: dict, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo el Administrador puede configurar la firma")
    p12_b64 = data.get("p12_base64", "")
    password = data.get("password", "")
    ambiente = data.get("ambiente", "produccion")
    if not p12_b64 or not password:
        raise HTTPException(status_code=400, detail="Se requiere el archivo .p12 y la contraseña")
    import base64
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.hazmat.backends import default_backend
    try:
        p12_bytes = base64.b64decode(p12_b64)
        pk, cert, chain = pkcs12.load_key_and_certificates(p12_bytes, password.encode(), default_backend())
        titular = cert.subject.rfc4514_string()
        valido_hasta = cert.not_valid_after_utc.strftime("%Y-%m-%d")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Certificado inválido o contraseña incorrecta: {e}")
    await db.configuracion.update_one(
        {"clave": "firma_electronica"},
        {"$set": {
            "clave": "firma_electronica",
            "valor": {
                "p12_base64": p12_b64,
                "password": password,
                "ambiente": ambiente,
                "titular": titular,
                "valido_hasta": valido_hasta
            },
            "actualizado": datetime.now(timezone.utc).isoformat(),
            "actualizado_por": current_user.username
        }},
        upsert=True
    )
    return {"ok": True, "titular": titular, "valido_hasta": valido_hasta, "ambiente": ambiente, "mensaje": f"✅ Certificado configurado correctamente"}
