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
    # ── Respiratorio ──────────────────────────────────────────────────────────
    {"codigo": "J06.9", "descripcion": "Infección aguda vías respiratorias superiores, no especificada"},
    {"codigo": "J00",   "descripcion": "Rinofaringitis aguda (resfriado común)"},
    {"codigo": "J02.9", "descripcion": "Faringitis aguda, no especificada"},
    {"codigo": "J02.0", "descripcion": "Faringitis estreptocócica"},
    {"codigo": "J03.9", "descripcion": "Amigdalitis aguda, no especificada"},
    {"codigo": "J03.0", "descripcion": "Amigdalitis estreptocócica"},
    {"codigo": "J04.0", "descripcion": "Laringitis aguda"},
    {"codigo": "J04.1", "descripcion": "Traqueítis aguda"},
    {"codigo": "J20.9", "descripcion": "Bronquitis aguda, no especificada"},
    {"codigo": "J18.9", "descripcion": "Neumonía, no especificada"},
    {"codigo": "J45.9", "descripcion": "Asma, no especificada"},
    {"codigo": "J45.0", "descripcion": "Asma predominantemente alérgica"},
    {"codigo": "J30.1", "descripcion": "Rinitis alérgica debida al polen"},
    {"codigo": "J30.4", "descripcion": "Rinitis alérgica, no especificada"},
    {"codigo": "J32.9", "descripcion": "Sinusitis crónica, no especificada"},
    {"codigo": "J01.9", "descripcion": "Sinusitis aguda, no especificada"},
    {"codigo": "J11.1", "descripcion": "Influenza con otras manifestaciones respiratorias"},
    {"codigo": "J22",   "descripcion": "Infección aguda no especificada de las vías respiratorias inferiores"},
    # ── Digestivo ────────────────────────────────────────────────────────────
    {"codigo": "A09",   "descripcion": "Diarrea y gastroenteritis de presunto origen infeccioso"},
    {"codigo": "K21.0", "descripcion": "ERGE con esofagitis"},
    {"codigo": "K21.9", "descripcion": "ERGE sin esofagitis"},
    {"codigo": "K29.7", "descripcion": "Gastritis, no especificada"},
    {"codigo": "K29.0", "descripcion": "Gastritis aguda hemorrágica"},
    {"codigo": "K30",   "descripcion": "Dispepsia funcional"},
    {"codigo": "K59.0", "descripcion": "Estreñimiento"},
    {"codigo": "K59.1", "descripcion": "Diarrea funcional"},
    {"codigo": "K37",   "descripcion": "Apendicitis, no especificada"},
    {"codigo": "K57.9", "descripcion": "Enfermedad diverticular del intestino, sin perforación ni absceso"},
    {"codigo": "K74.6", "descripcion": "Cirrosis hepática, no especificada"},
    {"codigo": "K80.2", "descripcion": "Cálculo de la vesícula biliar sin colecistitis"},
    {"codigo": "K85.9", "descripcion": "Pancreatitis aguda, no especificada"},
    {"codigo": "B82.9", "descripcion": "Parasitosis intestinal, no especificada"},
    {"codigo": "A02.0", "descripcion": "Enteritis por Salmonella"},
    # ── Cardiovascular ───────────────────────────────────────────────────────
    {"codigo": "I10",   "descripcion": "Hipertensión esencial (primaria)"},
    {"codigo": "I11.9", "descripcion": "Cardiopatía hipertensiva sin insuficiencia cardíaca"},
    {"codigo": "I25.1", "descripcion": "Enfermedad aterosclerótica del corazón"},
    {"codigo": "I50.9", "descripcion": "Insuficiencia cardíaca, no especificada"},
    {"codigo": "I48.9", "descripcion": "Fibrilación auricular y flutter, no especificados"},
    {"codigo": "I63.9", "descripcion": "Infarto cerebral, no especificado"},
    {"codigo": "I21.9", "descripcion": "Infarto agudo de miocardio, no especificado"},
    {"codigo": "I83.9", "descripcion": "Varices de los miembros inferiores sin úlcera ni inflamación"},
    # ── Endocrinología ───────────────────────────────────────────────────────
    {"codigo": "E11.9", "descripcion": "Diabetes mellitus tipo 2, sin complicaciones"},
    {"codigo": "E11.0", "descripcion": "Diabetes mellitus tipo 2 con coma"},
    {"codigo": "E11.6", "descripcion": "Diabetes mellitus tipo 2 con otras complicaciones especificadas"},
    {"codigo": "E10.9", "descripcion": "Diabetes mellitus tipo 1, sin complicaciones"},
    {"codigo": "E66.9", "descripcion": "Obesidad, no especificada"},
    {"codigo": "E63.9", "descripcion": "Deficiencia nutricional, no especificada"},
    {"codigo": "E03.9", "descripcion": "Hipotiroidismo, no especificado"},
    {"codigo": "E05.9", "descripcion": "Tirotoxicosis, no especificada"},
    {"codigo": "E07.9", "descripcion": "Trastorno de la glándula tiroides, no especificado"},
    {"codigo": "E78.0", "descripcion": "Hipercolesterolemia pura"},
    {"codigo": "E78.5", "descripcion": "Hiperlipidemia, no especificada"},
    {"codigo": "E27.4", "descripcion": "Insuficiencia corticosuprarrenal, no especificada"},
    # ── Mental / Neurológico ─────────────────────────────────────────────────
    {"codigo": "F32.9", "descripcion": "Episodio depresivo, no especificado"},
    {"codigo": "F32.0", "descripcion": "Episodio depresivo leve"},
    {"codigo": "F32.1", "descripcion": "Episodio depresivo moderado"},
    {"codigo": "F41.1", "descripcion": "Trastorno de ansiedad generalizada"},
    {"codigo": "F41.0", "descripcion": "Trastorno de pánico"},
    {"codigo": "F41.2", "descripcion": "Trastorno mixto ansioso-depresivo"},
    {"codigo": "G43.9", "descripcion": "Migraña, no especificada"},
    {"codigo": "G47.0", "descripcion": "Insomnio orgánico"},
    {"codigo": "G47.3", "descripcion": "Apnea del sueño"},
    {"codigo": "R51",   "descripcion": "Cefalea"},
    {"codigo": "R55",   "descripcion": "Síncope y colapso"},
    {"codigo": "G40.9", "descripcion": "Epilepsia, no especificada"},
    {"codigo": "G35",   "descripcion": "Esclerosis múltiple"},
    # ── Musculoesquelético ───────────────────────────────────────────────────
    {"codigo": "M54.5", "descripcion": "Lumbago no especificado"},
    {"codigo": "M54.2", "descripcion": "Cervicalgia"},
    {"codigo": "M54.1", "descripcion": "Radiculopatía"},
    {"codigo": "M54.3", "descripcion": "Ciática"},
    {"codigo": "M54.4", "descripcion": "Lumbago con ciática"},
    {"codigo": "M25.5", "descripcion": "Dolor en articulación"},
    {"codigo": "M79.3", "descripcion": "Paniculitis"},
    {"codigo": "M79.1", "descripcion": "Mialgia"},
    {"codigo": "M10.9", "descripcion": "Gota, no especificada"},
    {"codigo": "M15.9", "descripcion": "Poliartrosis, no especificada"},
    {"codigo": "M16.9", "descripcion": "Coxartrosis, no especificada"},
    {"codigo": "M17.9", "descripcion": "Gonartrosis, no especificada"},
    {"codigo": "M19.9", "descripcion": "Artrosis, no especificada"},
    {"codigo": "M79.7", "descripcion": "Fibromialgia"},
    {"codigo": "M06.9", "descripcion": "Artritis reumatoide, no especificada"},
    # ── Urinario / Renal ─────────────────────────────────────────────────────
    {"codigo": "N39.0", "descripcion": "Infección de vías urinarias, sitio no especificado"},
    {"codigo": "N30.0", "descripcion": "Cistitis aguda"},
    {"codigo": "N12",   "descripcion": "Nefritis tubulointersticial, no especificada"},
    {"codigo": "N20.0", "descripcion": "Cálculo del riñón"},
    {"codigo": "N20.1", "descripcion": "Cálculo del uréter"},
    {"codigo": "N18.9", "descripcion": "Enfermedad renal crónica, no especificada"},
    # ── Ginecología / Obstetricia ─────────────────────────────────────────────
    {"codigo": "N76.0", "descripcion": "Vaginitis aguda"},
    {"codigo": "N76.1", "descripcion": "Vaginitis subaguda y crónica"},
    {"codigo": "N91.2", "descripcion": "Amenorrea, no especificada"},
    {"codigo": "N92.0", "descripcion": "Menstruación excesiva y frecuente con ciclo regular"},
    {"codigo": "N94.6", "descripcion": "Dismenorrea, no especificada"},
    {"codigo": "N83.2", "descripcion": "Quiste ovárico, no especificado"},
    {"codigo": "N72",   "descripcion": "Enfermedad inflamatoria del cuello uterino (cervicitis)"},
    {"codigo": "O00.9", "descripcion": "Embarazo ectópico, no especificado"},
    {"codigo": "O20.0", "descripcion": "Amenaza de aborto"},
    {"codigo": "O80",   "descripcion": "Parto único espontáneo"},
    {"codigo": "O82",   "descripcion": "Parto único por cesárea"},
    {"codigo": "Z34.0", "descripcion": "Supervisión de embarazo normal, primigesta"},
    {"codigo": "Z34.9", "descripcion": "Supervisión de embarazo normal, no especificado"},
    # ── Dermatología ─────────────────────────────────────────────────────────
    {"codigo": "L30.9", "descripcion": "Dermatitis, no especificada"},
    {"codigo": "L20.9", "descripcion": "Dermatitis atópica, no especificada"},
    {"codigo": "L23.9", "descripcion": "Dermatitis alérgica de contacto, no especificada"},
    {"codigo": "L50.9", "descripcion": "Urticaria, no especificada"},
    {"codigo": "B35.9", "descripcion": "Dermatofitosis, no especificada (tiña)"},
    {"codigo": "L40.9", "descripcion": "Psoriasis, no especificada"},
    {"codigo": "B01.9", "descripcion": "Varicela sin complicaciones"},
    {"codigo": "B02.9", "descripcion": "Zóster sin complicaciones (herpes)"},
    # ── Odontología K00-K14 ──────────────────────────────────────────────────
    {"codigo": "K02.0", "descripcion": "Caries limitada al esmalte (mancha blanca)"},
    {"codigo": "K02.1", "descripcion": "Caries de la dentina"},
    {"codigo": "K02.2", "descripcion": "Caries del cemento"},
    {"codigo": "K02.3", "descripcion": "Caries dentaria detenida"},
    {"codigo": "K02.5", "descripcion": "Caries con exposición pulpar"},
    {"codigo": "K02.9", "descripcion": "Caries dental, no especificada"},
    {"codigo": "K04.0", "descripcion": "Pulpitis"},
    {"codigo": "K04.1", "descripcion": "Necrosis de la pulpa"},
    {"codigo": "K04.4", "descripcion": "Periodontitis apical aguda de origen pulpar"},
    {"codigo": "K04.5", "descripcion": "Periodontitis apical crónica (granuloma apical)"},
    {"codigo": "K04.6", "descripcion": "Absceso periapical con fístula"},
    {"codigo": "K04.7", "descripcion": "Absceso periapical sin fístula"},
    {"codigo": "K04.8", "descripcion": "Quiste radicular"},
    {"codigo": "K05.0", "descripcion": "Gingivitis aguda"},
    {"codigo": "K05.1", "descripcion": "Gingivitis crónica"},
    {"codigo": "K05.2", "descripcion": "Periodontitis aguda"},
    {"codigo": "K05.3", "descripcion": "Periodontitis crónica"},
    {"codigo": "K06.0", "descripcion": "Recesión gingival"},
    {"codigo": "K07.4", "descripcion": "Maloclusión, no especificada"},
    {"codigo": "K07.6", "descripcion": "Trastornos de la articulación temporomandibular (ATM)"},
    {"codigo": "K08.1", "descripcion": "Pérdida de dientes por extracción o enfermedad periodontal"},
    {"codigo": "K08.3", "descripcion": "Raíz dental retenida"},
    {"codigo": "K10.3", "descripcion": "Alveolitis del maxilar (alveolo seco)"},
    {"codigo": "K01.1", "descripcion": "Dientes impactados (tercer molar incluido)"},
    {"codigo": "K03.0", "descripcion": "Atrición excesiva (bruxismo)"},
    {"codigo": "K03.6", "descripcion": "Depósitos en dientes (cálculo, placa)"},
    {"codigo": "K12.0", "descripcion": "Estomatitis aftosa recurrente"},
    {"codigo": "K12.2", "descripcion": "Celulitis y absceso de boca"},
    {"codigo": "Z01.2", "descripcion": "Examen dental de rutina"},
    # ── Pediátría ────────────────────────────────────────────────────────────
    {"codigo": "Z00.1", "descripcion": "Examen de control de salud del niño"},
    {"codigo": "P00-P96", "descripcion": "Afecciones originadas en el período perinatal"},
    {"codigo": "A37.9", "descripcion": "Tos ferina, no especificada"},
    {"codigo": "B05.9", "descripcion": "Sarampión sin complicaciones"},
    {"codigo": "B26.9", "descripcion": "Parotiditis infecciosa (paperas) sin complicaciones"},
    {"codigo": "B06.9", "descripcion": "Rubéola sin complicaciones"},
    {"codigo": "J09",   "descripcion": "Influenza debida a ciertos virus de la influenza identificados"},
    {"codigo": "H65.9", "descripcion": "Otitis media no supurativa, no especificada"},
    {"codigo": "H66.9", "descripcion": "Otitis media supurativa, no especificada"},
    # ── Síntomas generales ───────────────────────────────────────────────────
    {"codigo": "R05",   "descripcion": "Tos"},
    {"codigo": "R50.9", "descripcion": "Fiebre, no especificada"},
    {"codigo": "R10.9", "descripcion": "Dolor abdominal, no especificado"},
    {"codigo": "R07.9", "descripcion": "Dolor en el pecho, no especificado"},
    {"codigo": "R06.0", "descripcion": "Disnea"},
    {"codigo": "R11",   "descripcion": "Náusea y vómitos"},
    {"codigo": "R42",   "descripcion": "Mareo y desvanecimiento"},
    {"codigo": "R53",   "descripcion": "Malestar y fatiga"},
    {"codigo": "R00.0", "descripcion": "Taquicardia, no especificada"},
    {"codigo": "R73.0", "descripcion": "Glucemia anormal"},
    {"codigo": "R03.0", "descripcion": "Lectura elevada de la presión arterial"},
]

@router.get("/cie10/buscar")
async def buscar_cie10(
    q: str = "",
    current_user: TokenData = Depends(get_current_user)
):
    """Busca códigos CIE-10. Sin query retorna los 25 más comunes."""
    if not q or len(q) < 1:
        return CIE10_COMUNES[:25]
    q_lower = q.lower().strip()
    resultados = [
        item for item in CIE10_COMUNES
        if q_lower in item["codigo"].lower() or q_lower in item["descripcion"].lower()
    ]
    return resultados[:20]


# ========== MEDICAMENTOS ==========

# Base de medicamentos frecuentes (cuadro básico MSP Ecuador + más comunes)
MEDICAMENTOS_BASE = [
    # Analgésicos / Antipiréticos
    {"nombre": "Paracetamol", "presentaciones": ["500mg tab", "1g tab", "250mg/5ml jarabe", "150mg sup"]},
    {"nombre": "Ibuprofeno",  "presentaciones": ["200mg tab", "400mg tab", "600mg tab", "100mg/5ml susp"]},
    {"nombre": "Naproxeno",   "presentaciones": ["250mg tab", "500mg tab", "550mg tab"]},
    {"nombre": "Diclofenaco", "presentaciones": ["50mg tab", "75mg/3ml amp", "75mg tab SR", "1% gel"]},
    {"nombre": "Ketorolaco",  "presentaciones": ["10mg tab", "30mg/1ml amp", "10mg/1ml amp"]},
    {"nombre": "Tramadol",    "presentaciones": ["50mg cap", "100mg tab SR", "50mg/1ml amp", "100mg supos"]},
    {"nombre": "Morfina",     "presentaciones": ["10mg/1ml amp", "30mg tab SR", "60mg tab SR"]},
    {"nombre": "Celecoxib",   "presentaciones": ["100mg cap", "200mg cap"]},
    {"nombre": "Meloxicam",   "presentaciones": ["7.5mg tab", "15mg tab", "15mg/1.5ml amp"]},
    # Antibióticos
    {"nombre": "Amoxicilina",          "presentaciones": ["250mg/5ml susp", "500mg cap", "875mg tab"]},
    {"nombre": "Amoxicilina + Clavulanato", "presentaciones": ["500/125mg tab", "875/125mg tab", "250/62.5mg/5ml susp"]},
    {"nombre": "Azitromicina",         "presentaciones": ["250mg tab", "500mg tab", "200mg/5ml susp"]},
    {"nombre": "Claritromicina",       "presentaciones": ["250mg tab", "500mg tab", "125mg/5ml susp"]},
    {"nombre": "Ciprofloxacino",       "presentaciones": ["250mg tab", "500mg tab", "750mg tab", "200mg/100ml IV"]},
    {"nombre": "Levofloxacino",        "presentaciones": ["250mg tab", "500mg tab", "750mg tab"]},
    {"nombre": "Metronidazol",         "presentaciones": ["250mg tab", "500mg tab", "500mg/100ml IV", "250mg/5ml susp"]},
    {"nombre": "Cefalexina",           "presentaciones": ["250mg/5ml susp", "500mg cap", "1g tab"]},
    {"nombre": "Ceftriaxona",          "presentaciones": ["500mg amp", "1g amp", "2g amp"]},
    {"nombre": "Clindamicina",         "presentaciones": ["150mg cap", "300mg cap", "600mg/4ml amp"]},
    {"nombre": "Doxiciclina",          "presentaciones": ["100mg cap", "100mg tab"]},
    {"nombre": "Nitrofurantoína",      "presentaciones": ["100mg cap", "25mg/5ml susp"]},
    {"nombre": "Trimetoprim + Sulfametoxazol", "presentaciones": ["160/800mg tab", "40/200mg/5ml susp"]},
    # Antiinflamatorios / Corticoides
    {"nombre": "Prednisona",      "presentaciones": ["5mg tab", "20mg tab", "50mg tab"]},
    {"nombre": "Prednisolona",    "presentaciones": ["5mg tab", "15mg/5ml sol"]},
    {"nombre": "Dexametasona",    "presentaciones": ["0.5mg tab", "4mg/1ml amp", "8mg/2ml amp"]},
    {"nombre": "Betametasona",    "presentaciones": ["0.5mg tab", "4mg/1ml amp"]},
    {"nombre": "Hidrocortisona",  "presentaciones": ["100mg amp", "500mg amp", "1%crema"]},
    # Antihistamínicos
    {"nombre": "Loratadina",     "presentaciones": ["10mg tab", "5mg/5ml jarabe"]},
    {"nombre": "Cetirizina",     "presentaciones": ["10mg tab", "1mg/1ml sol"]},
    {"nombre": "Fexofenadina",   "presentaciones": ["120mg tab", "180mg tab"]},
    {"nombre": "Clorfeniramina", "presentaciones": ["4mg tab", "2mg/5ml jarabe", "10mg/1ml amp"]},
    {"nombre": "Difenhidramina", "presentaciones": ["25mg tab", "50mg/1ml amp", "12.5mg/5ml jarabe"]},
    # Gastrointestinal
    {"nombre": "Omeprazol",       "presentaciones": ["20mg cap", "40mg cap", "40mg amp IV"]},
    {"nombre": "Pantoprazol",     "presentaciones": ["20mg tab", "40mg tab", "40mg amp IV"]},
    {"nombre": "Ranitidina",      "presentaciones": ["150mg tab", "300mg tab", "50mg/2ml amp"]},
    {"nombre": "Metoclopramida",  "presentaciones": ["10mg tab", "10mg/2ml amp", "5mg/5ml jarabe"]},
    {"nombre": "Ondansetrón",     "presentaciones": ["4mg tab", "8mg tab", "4mg/2ml amp", "4mg/5ml sol"]},
    {"nombre": "Domperidona",     "presentaciones": ["10mg tab", "1mg/1ml susp"]},
    {"nombre": "Hidróxido de aluminio + magnesio", "presentaciones": ["Suspensión oral", "Tableta masticable"]},
    {"nombre": "Loperamida",      "presentaciones": ["2mg cap", "2mg tab"]},
    # Cardiovascular / Antihipertensivos
    {"nombre": "Enalapril",       "presentaciones": ["5mg tab", "10mg tab", "20mg tab"]},
    {"nombre": "Losartán",        "presentaciones": ["25mg tab", "50mg tab", "100mg tab"]},
    {"nombre": "Amlodipino",      "presentaciones": ["5mg tab", "10mg tab"]},
    {"nombre": "Nifedipino",      "presentaciones": ["10mg cap", "30mg tab SR", "60mg tab SR"]},
    {"nombre": "Metoprolol",      "presentaciones": ["25mg tab", "50mg tab", "100mg tab SR"]},
    {"nombre": "Atenolol",        "presentaciones": ["25mg tab", "50mg tab", "100mg tab"]},
    {"nombre": "Hidroclorotiazida","presentaciones": ["25mg tab", "50mg tab"]},
    {"nombre": "Furosemida",      "presentaciones": ["20mg tab", "40mg tab", "20mg/2ml amp"]},
    {"nombre": "Espironolactona", "presentaciones": ["25mg tab", "100mg tab"]},
    {"nombre": "Aspirina",        "presentaciones": ["75mg tab", "100mg tab", "500mg tab"]},
    # Endocrinología / Diabetes
    {"nombre": "Metformina",      "presentaciones": ["500mg tab", "850mg tab", "1000mg tab"]},
    {"nombre": "Glibenclamida",   "presentaciones": ["5mg tab"]},
    {"nombre": "Insulina NPH",    "presentaciones": ["100UI/ml vial 10ml", "100UI/ml cartucho"]},
    {"nombre": "Insulina Regular","presentaciones": ["100UI/ml vial 10ml"]},
    {"nombre": "Levotiroxina",    "presentaciones": ["25mcg tab", "50mcg tab", "100mcg tab", "150mcg tab"]},
    {"nombre": "Atorvastatina",   "presentaciones": ["10mg tab", "20mg tab", "40mg tab"]},
    {"nombre": "Simvastatina",    "presentaciones": ["10mg tab", "20mg tab", "40mg tab"]},
    # Antiparasitarios
    {"nombre": "Albendazol",      "presentaciones": ["200mg tab", "400mg tab", "200mg/5ml susp"]},
    {"nombre": "Mebendazol",      "presentaciones": ["100mg tab", "100mg/5ml susp"]},
    {"nombre": "Ivermectina",     "presentaciones": ["6mg tab", "3mg tab"]},
    {"nombre": "Metronidazol",    "presentaciones": ["250mg tab", "500mg tab", "250mg/5ml susp"]},
    # Vitaminas / Minerales
    {"nombre": "Vitamina C",       "presentaciones": ["500mg tab", "1g tab", "1g sobre"]},
    {"nombre": "Vitamina D3",      "presentaciones": ["400UI gotas", "800UI tab", "2000UI cap"]},
    {"nombre": "Calcio + Vitamina D", "presentaciones": ["500/200UI tab", "1000/200UI tab"]},
    {"nombre": "Hierro",           "presentaciones": ["45mg tab", "325mg tab", "30mg/5ml jarabe"]},
    {"nombre": "Ácido fólico",     "presentaciones": ["0.5mg tab", "1mg tab", "5mg tab"]},
    {"nombre": "Vitamina B12",     "presentaciones": ["500mcg tab", "1000mcg amp"]},
    # Anestésicos dentales
    {"nombre": "Lidocaína + Epinefrina", "presentaciones": ["2% 1:100,000 cartucho 1.8ml", "2% sin vasoconstrictor"]},
    {"nombre": "Mepivacaína",      "presentaciones": ["3% sin vasoconstrictor cartucho 1.8ml", "2% 1:100,000"]},
    {"nombre": "Articaína",        "presentaciones": ["4% 1:100,000 cartucho 1.7ml", "4% 1:200,000"]},
    # Otros frecuentes
    {"nombre": "Salbutamol",       "presentaciones": ["100mcg/dosis inhaler", "2mg tab", "2mg/5ml jarabe", "0.5% sol nebuliz"]},
    {"nombre": "Budesonida",       "presentaciones": ["200mcg/dosis inhaler", "0.25mg/2ml nebuliz", "0.5mg/2ml nebuliz"]},
    {"nombre": "Fluticasona",      "presentaciones": ["50mcg/dosis inhaler", "125mcg/dosis inhaler"]},
    {"nombre": "Diazepam",         "presentaciones": ["2mg tab", "5mg tab", "10mg tab", "10mg/2ml amp"]},
    {"nombre": "Alprazolam",       "presentaciones": ["0.25mg tab", "0.5mg tab", "1mg tab"]},
    {"nombre": "Lorazepam",        "presentaciones": ["0.5mg tab", "1mg tab", "2mg/1ml amp"]},
    {"nombre": "Amitriptilina",    "presentaciones": ["10mg tab", "25mg tab"]},
    {"nombre": "Fluoxetina",       "presentaciones": ["20mg cap", "20mg/5ml sol"]},
    {"nombre": "Sertralina",       "presentaciones": ["25mg tab", "50mg tab", "100mg tab"]},
]

@router.get("/medicamentos/buscar")
async def buscar_medicamentos(
    q: str = "",
    current_user: TokenData = Depends(get_current_user)
):
    """
    Busca medicamentos en:
    1. Base de datos de recetas previas (medicamentos ya enviados por doctores)
    2. Lista base MSP Ecuador
    Retorna sugerencias con nombre + presentaciones disponibles.
    """
    # Buscar en recetas previas (historial del sistema)
    historico = set()
    try:
        pipeline = [
            {"$unwind": "$medicamentos"},
            {"$group": {"_id": "$medicamentos.nombre"}},
            {"$limit": 200}
        ]
        async for doc in db.prescriptions.aggregate(pipeline):
            if doc.get("_id"):
                historico.add(doc["_id"].strip())
    except Exception:
        pass

    if not q or len(q) < 2:
        # Sin query: retornar historial + primeros 20 de la base
        resultado = []
        for nombre in list(historico)[:10]:
            resultado.append({"nombre": nombre, "presentaciones": [], "fuente": "historial"})
        for med in MEDICAMENTOS_BASE[:20]:
            if not any(r["nombre"].lower() == med["nombre"].lower() for r in resultado):
                resultado.append({**med, "fuente": "base"})
        return resultado[:25]

    q_lower = q.lower().strip()

    # Buscar en historial
    resultado = []
    for nombre in historico:
        if q_lower in nombre.lower():
            resultado.append({"nombre": nombre, "presentaciones": [], "fuente": "historial"})

    # Buscar en base
    for med in MEDICAMENTOS_BASE:
        if q_lower in med["nombre"].lower():
            if not any(r["nombre"].lower() == med["nombre"].lower() for r in resultado):
                resultado.append({**med, "fuente": "base"})

    return sorted(resultado, key=lambda x: (x["fuente"] != "historial", x["nombre"]))[:20]


# ========== EXISTING ENDPOINTS (from Phase 2) ==========
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
# ========== EXISTING ENDPOINTS ==========

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
