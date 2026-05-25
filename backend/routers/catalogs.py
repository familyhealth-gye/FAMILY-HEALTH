from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime, timezone

from db import db
from auth import TokenData, get_current_user, require_role
from models import Especialidad, EspecialidadCreate

router = APIRouter(tags=["catalogs"])

# ========== ESPECIALIDADES ENDPOINTS ==========

@router.get("/especialidades", response_model=List[Especialidad])
async def get_especialidades():
    """Obtener todas las especialidades (sin autenticación para facilitar)"""
    especialidades = await db.especialidades.find({}, {"_id": 0}).to_list(1000)
    for esp in especialidades:
        if isinstance(esp['created_at'], str):
            esp['created_at'] = datetime.fromisoformat(esp['created_at'])
    return especialidades

@router.post("/especialidades", response_model=Especialidad)
async def create_especialidad(
    input: EspecialidadCreate,
    current_user: TokenData = Depends(require_role("Administrador"))
):
    """Crear especialidad (solo admin)"""
    esp_obj = Especialidad(**input.model_dump())
    doc = esp_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.especialidades.insert_one(doc)
    return esp_obj

@router.post("/especialidades/seed")
async def seed_especialidades(
    current_user: TokenData = Depends(require_role("Administrador"))
):
    """
    Crear especialidades iniciales
    IMPORTANTE: NO borra especialidades existentes, solo agrega las faltantes
    """
    especialidades_base = [
        {"nombre": "Medicina General", "descripcion": "Atención médica general"},
        {"nombre": "Odontología", "descripcion": "Salud bucal y dental"},
        {"nombre": "Endodoncia", "descripcion": "Tratamiento de conductos"},
        {"nombre": "Ortodoncia", "descripcion": "Corrección de dientes y mandíbula"},
        {"nombre": "Periodoncia", "descripcion": "Tratamiento de encías"},
        {"nombre": "Pediatría", "descripcion": "Atención infantil"},
        {"nombre": "Nutrición", "descripcion": "Asesoramiento nutricional y dietético"},
        {"nombre": "Psicología", "descripcion": "Salud mental"},
        {"nombre": "Ecografía", "descripcion": "Diagnóstico por imagen ecográfica"},
        {"nombre": "Ginecología", "descripcion": "Salud femenina y reproductiva"},
        {"nombre": "Obstetricia", "descripcion": "Embarazo y parto"},
        {"nombre": "Ginecología/Obstetricia", "descripcion": "Ginecología y obstetricia combinada"},
        {"nombre": "Laboratorio", "descripcion": "Análisis clínicos y pruebas de laboratorio"}
    ]

    # NO BORRAR EXISTENTES - Solo agregar las que faltan
    created = []
    skipped = []

    for esp_data in especialidades_base:
        # Verificar si ya existe
        existing = await db.especialidades.find_one({"nombre": esp_data["nombre"]}, {"_id": 0})
        if existing:
            skipped.append(esp_data['nombre'])
            continue

        # Crear nueva especialidad
        esp_obj = Especialidad(**esp_data, activa=True)
        doc = esp_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.especialidades.insert_one(doc)
        created.append(esp_data['nombre'])

    return {
        "message": f"Proceso completado",
        "creadas": len(created),
        "existentes": len(skipped),
        "nuevas_especialidades": created,
        "especialidades_existentes": skipped
    }

# ========== CIE-10 BÚSQUEDA ==========

CIE10_COMUNES = [
    {"codigo": "J06.9", "descripcion": "Infección aguda de las vías respiratorias superiores, no especificada"},
    {"codigo": "J00", "descripcion": "Rinofaringitis aguda (resfriado común)"},
    {"codigo": "J03.9", "descripcion": "Amigdalitis aguda, no especificada"},
    {"codigo": "J18.9", "descripcion": "Neumonía, no especificada"},
    {"codigo": "A09", "descripcion": "Diarrea y gastroenteritis de presunto origen infeccioso"},
    {"codigo": "K21.0", "descripcion": "Enfermedad por reflujo gastroesofágico con esofagitis"},
    {"codigo": "K29.7", "descripcion": "Gastritis, no especificada"},
    {"codigo": "N39.0", "descripcion": "Infección de vías urinarias, sitio no especificado"},
    {"codigo": "I10", "descripcion": "Hipertensión esencial (primaria)"},
    {"codigo": "E11.9", "descripcion": "Diabetes mellitus tipo 2, sin complicaciones"},
    {"codigo": "E66.9", "descripcion": "Obesidad, no especificada"},
    {"codigo": "E63.9", "descripcion": "Deficiencia nutricional, no especificada"},
    {"codigo": "F32.9", "descripcion": "Episodio depresivo, no especificado"},
    {"codigo": "F41.1", "descripcion": "Trastorno de ansiedad generalizada"},
    {"codigo": "M54.5", "descripcion": "Lumbago no especificado"},
    {"codigo": "M54.2", "descripcion": "Cervicalgia"},
    {"codigo": "R51", "descripcion": "Cefalea"},
    {"codigo": "R05", "descripcion": "Tos"},
    {"codigo": "R50.9", "descripcion": "Fiebre, no especificada"},
    {"codigo": "Z34.0", "descripcion": "Supervisión de embarazo normal, primigesta"},
    {"codigo": "Z34.9", "descripcion": "Supervisión de embarazo normal, no especificado"},
    {"codigo": "O80", "descripcion": "Parto único espontáneo"},
    {"codigo": "N76.0", "descripcion": "Vaginitis aguda"},
    {"codigo": "N91.2", "descripcion": "Amenorrea, no especificada"},
    {"codigo": "K08.1", "descripcion": "Pérdida de dientes debida a accidente, extracción o enfermedad periodontal local"},
    {"codigo": "K02.9", "descripcion": "Caries dental, no especificada"},
    {"codigo": "K05.1", "descripcion": "Gingivitis crónica"},
    {"codigo": "P00-P96", "descripcion": "Ciertas afecciones originadas en el período perinatal"},
    {"codigo": "Z00.1", "descripcion": "Examen de control de salud del niño"},
    {"codigo": "J45.9", "descripcion": "Asma, no especificada"},
    # ── Odontología completo K00-K14 ──
    {"codigo": "K02.0", "descripcion": "Caries limitada al esmalte (mancha blanca)"},
    {"codigo": "K02.1", "descripcion": "Caries de la dentina"},
    {"codigo": "K02.2", "descripcion": "Caries del cemento"},
    {"codigo": "K02.3", "descripcion": "Caries dentaria detenida"},
    {"codigo": "K02.5", "descripcion": "Caries con exposición pulpar"},
    {"codigo": "K04.0", "descripcion": "Pulpitis"},
    {"codigo": "K04.1", "descripcion": "Necrosis de la pulpa"},
    {"codigo": "K04.4", "descripcion": "Periodontitis apical aguda originada en la pulpa"},
    {"codigo": "K04.5", "descripcion": "Periodontitis apical crónica (granuloma apical)"},
    {"codigo": "K04.6", "descripcion": "Absceso periapical con fístula"},
    {"codigo": "K04.7", "descripcion": "Absceso periapical sin fístula"},
    {"codigo": "K04.8", "descripcion": "Quiste radicular"},
    {"codigo": "K05.0", "descripcion": "Gingivitis aguda"},
    {"codigo": "K05.2", "descripcion": "Periodontitis aguda"},
    {"codigo": "K05.3", "descripcion": "Periodontitis crónica"},
    {"codigo": "K06.0", "descripcion": "Recesión gingival"},
    {"codigo": "K06.1", "descripcion": "Agrandamiento gingival (hiperplasia gingival)"},
    {"codigo": "K07.4", "descripcion": "Maloclusión, no especificada"},
    {"codigo": "K07.6", "descripcion": "Trastornos de la articulación temporomandibular (ATM)"},
    {"codigo": "K08.1", "descripcion": "Pérdida de dientes por extracción o enfermedad periodontal"},
    {"codigo": "K08.3", "descripcion": "Raíz dental retenida"},
    {"codigo": "K10.3", "descripcion": "Alveolitis del maxilar (alveolo seco)"},
    {"codigo": "K01.1", "descripcion": "Dientes impactados (tercer molar incluido)"},
    {"codigo": "K03.0", "descripcion": "Atrición excesiva de los dientes (bruxismo)"},
    {"codigo": "K03.1", "descripcion": "Abrasión de los dientes"},
    {"codigo": "K03.2", "descripcion": "Erosión de los dientes"},
    {"codigo": "K03.6", "descripcion": "Depósitos en los dientes (cálculo, placa bacteriana)"},
    {"codigo": "K12.0", "descripcion": "Estomatitis aftosa recurrente (úlcera aftosa)"},
    {"codigo": "K12.2", "descripcion": "Celulitis y absceso de boca"},
    {"codigo": "K13.0", "descripcion": "Queilitis (enfermedad de los labios)"},
    {"codigo": "Z01.2", "descripcion": "Examen dental de rutina"},
]

@router.get("/cie10/buscar")
async def buscar_cie10(
    q: str = "",
    current_user: TokenData = Depends(get_current_user)
):
    """Busca códigos CIE-10. Si no hay query retorna los más comunes."""
    if not q or len(q) < 2:
        return CIE10_COMUNES[:20]

    q_lower = q.lower()
    resultados = [
        item for item in CIE10_COMUNES
        if q_lower in item["codigo"].lower() or q_lower in item["descripcion"].lower()
    ]
    return resultados[:15]

# ========== EXISTING ENDPOINTS (from Phase 2) ==========

@router.get("/specialties")
async def get_specialties():
    return {
        "specialties": [
            "Odontología",
            "Medicina General",
            "Pediatría",
            "Ginecología",
            "Psicología",
            "Nutrición",
            "Laboratorio Clínico",
            "Ecografía",
            "Terapia Física"
        ]
    }

@router.get("/categories")
async def get_categories():
    return {
        "categories": [
            "Odontología",
            "Medicina General",
            "Nutrición",
            "Psicología",
            "Ginecología",
            "Laboratorio Clínico",
            "Material Quirúrgico",
            "Consumibles",
            "Otros"
        ]
    }
