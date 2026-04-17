from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
import uuid
from datetime import datetime, timezone


# ========== MEDICINA GENERAL ==========

class SignosVitales(BaseModel):
    peso: Optional[float] = None
    talla: Optional[float] = None
    temperatura: Optional[float] = None
    presion_arterial: Optional[str] = None
    frecuencia_cardiaca: Optional[int] = None
    frecuencia_respiratoria: Optional[int] = None
    saturacion_oxigeno: Optional[float] = None


class MedicalHistoryGeneral(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    appointment_id: str
    paciente_id: str
    paciente_nombre: str
    paciente_cedula: str
    paciente_edad: int
    paciente_sexo: str
    doctor_id: str
    doctor_nombre: str
    fecha: str
    
    # Motivo de consulta
    motivo_consulta: str
    enfermedad_actual: str
    
    # Antecedentes Familiares
    antecedentes_familiares: Optional[str] = ""
    padre_vivo: Optional[bool] = None
    padre_causa_muerte: Optional[str] = ""
    madre_vivo: Optional[bool] = None
    madre_causa_muerte: Optional[str] = ""
    hermanos_vivos: Optional[int] = None
    
    # Antecedentes Personales Patológicos
    ant_hta: bool = False
    ant_diabetes: bool = False
    ant_tbc: bool = False
    ant_cancer: bool = False
    ant_hepatopatias: bool = False
    ant_nefropatias: bool = False
    ant_mentales: bool = False
    ant_endocrinas: bool = False
    ant_epilepsia: bool = False
    ant_asma: bool = False
    ant_hematologicas: bool = False
    otras_patologias: Optional[str] = ""
    
    # Antecedentes Personales No Patológicos
    alergias: Optional[str] = ""
    quirurgicos: Optional[str] = ""
    traumatismos: Optional[str] = ""
    hospitalizaciones: Optional[str] = ""
    transfusiones: bool = False
    
    # Hábitos
    tabaco: Optional[str] = ""
    alcohol: Optional[str] = ""
    drogas: Optional[str] = ""
    
    # Funciones biológicas
    sueno: Optional[str] = ""
    apetito: Optional[str] = ""
    defecacion: Optional[str] = ""
    micciones: Optional[str] = ""
    
    # Antecedentes Gineco-Obstétricos (si aplica)
    menarquia: Optional[int] = None
    menopausia: Optional[int] = None
    partos: Optional[int] = None
    abortos: Optional[int] = None
    cesareas: Optional[int] = None
    metodo_anticonceptivo: Optional[str] = ""
    
    # Examen Físico
    signos_vitales: SignosVitales
    impresion_general: Optional[str] = ""
    piel: Optional[str] = ""
    cabeza: Optional[str] = ""
    orl: Optional[str] = ""
    cuello: Optional[str] = ""
    torax: Optional[str] = ""
    cardiovascular: Optional[str] = ""
    pulmonar: Optional[str] = ""
    abdomen: Optional[str] = ""
    extremidades: Optional[str] = ""
    neurologico: Optional[str] = ""
    
    # Laboratorios
    laboratorios: Optional[str] = ""
    
    # Diagnóstico y tratamiento
    diagnostico: str
    cie10_codigo: Optional[str] = ""
    plan_tratamiento: str
    observaciones: Optional[str] = ""
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicalHistoryGeneralCreate(BaseModel):
    appointment_id: str
    motivo_consulta: str
    enfermedad_actual: str
    antecedentes_familiares: Optional[str] = ""
    padre_vivo: Optional[bool] = None
    padre_causa_muerte: Optional[str] = ""
    madre_vivo: Optional[bool] = None
    madre_causa_muerte: Optional[str] = ""
    hermanos_vivos: Optional[int] = None
    ant_hta: bool = False
    ant_diabetes: bool = False
    ant_tbc: bool = False
    ant_cancer: bool = False
    ant_hepatopatias: bool = False
    ant_nefropatias: bool = False
    ant_mentales: bool = False
    ant_endocrinas: bool = False
    ant_epilepsia: bool = False
    ant_asma: bool = False
    ant_hematologicas: bool = False
    otras_patologias: Optional[str] = ""
    alergias: Optional[str] = ""
    quirurgicos: Optional[str] = ""
    traumatismos: Optional[str] = ""
    hospitalizaciones: Optional[str] = ""
    transfusiones: bool = False
    tabaco: Optional[str] = ""
    alcohol: Optional[str] = ""
    drogas: Optional[str] = ""
    sueno: Optional[str] = ""
    apetito: Optional[str] = ""
    defecacion: Optional[str] = ""
    micciones: Optional[str] = ""
    menarquia: Optional[int] = None
    menopausia: Optional[int] = None
    partos: Optional[int] = None
    abortos: Optional[int] = None
    cesareas: Optional[int] = None
    metodo_anticonceptivo: Optional[str] = ""
    signos_vitales: SignosVitales
    impresion_general: Optional[str] = ""
    piel: Optional[str] = ""
    cabeza: Optional[str] = ""
    orl: Optional[str] = ""
    cuello: Optional[str] = ""
    torax: Optional[str] = ""
    cardiovascular: Optional[str] = ""
    pulmonar: Optional[str] = ""
    abdomen: Optional[str] = ""
    extremidades: Optional[str] = ""
    neurologico: Optional[str] = ""
    laboratorios: Optional[str] = ""
    diagnostico: str
    cie10_codigo: Optional[str] = ""
    plan_tratamiento: str
    observaciones: Optional[str] = ""


# ========== PEDIATRÍA ==========

class DatosNacimiento(BaseModel):
    peso_nacimiento: Optional[float] = None
    talla_nacimiento: Optional[float] = None
    perimetro_cefalico_nacimiento: Optional[float] = None
    apgar: Optional[str] = ""
    tipo_parto: Optional[str] = ""  # Normal, Cesárea
    complicaciones_parto: Optional[str] = ""


class DesarrolloPsicomotor(BaseModel):
    sostuvo_cabeza_meses: Optional[int] = None
    se_sento_meses: Optional[int] = None
    gateo_meses: Optional[int] = None
    camino_meses: Optional[int] = None
    primeras_palabras_meses: Optional[int] = None
    control_esfinteres_meses: Optional[int] = None


class Vacunas(BaseModel):
    bcg: bool = False
    hepatitis_b: bool = False
    pentavalente: bool = False
    rotavirus: bool = False
    neumococo: bool = False
    influenza: bool = False
    srp: bool = False  # Sarampión, Rubéola, Parotiditis
    varicela: bool = False
    otras: Optional[str] = ""


class MedicalHistoryPediatric(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    appointment_id: str
    paciente_id: str
    paciente_nombre: str
    paciente_cedula: str
    paciente_edad: int
    paciente_sexo: str
    doctor_id: str
    doctor_nombre: str
    fecha: str
    
    # Datos del responsable
    nombre_responsable: str
    parentesco_responsable: str
    telefono_responsable: str
    
    # Motivo de consulta
    motivo_consulta: str
    enfermedad_actual: str
    
    # Antecedentes perinatales
    datos_nacimiento: DatosNacimiento
    lactancia_materna: Optional[str] = ""  # Exclusiva, Mixta, No
    lactancia_meses: Optional[int] = None
    
    # Desarrollo
    desarrollo_psicomotor: DesarrolloPsicomotor
    desarrollo_acorde_edad: Optional[bool] = True
    observaciones_desarrollo: Optional[str] = ""
    
    # Inmunizaciones
    vacunas: Vacunas
    esquema_completo: bool = False
    
    # Antecedentes Familiares
    antecedentes_familiares: Optional[str] = ""
    enfermedades_hereditarias: Optional[str] = ""
    
    # Antecedentes Personales
    hospitalizaciones_previas: Optional[str] = ""
    cirugias_previas: Optional[str] = ""
    alergias: Optional[str] = ""
    medicamentos_actuales: Optional[str] = ""
    
    # Alimentación actual
    alimentacion_actual: Optional[str] = ""
    numero_comidas_dia: Optional[int] = None
    
    # Examen Físico
    signos_vitales: SignosVitales
    perimetro_cefalico: Optional[float] = None
    estado_general: Optional[str] = ""
    piel_mucosas: Optional[str] = ""
    cabeza_cuello: Optional[str] = ""
    torax_pulmonar: Optional[str] = ""
    cardiovascular: Optional[str] = ""
    abdomen: Optional[str] = ""
    genitales: Optional[str] = ""
    extremidades: Optional[str] = ""
    neurologico: Optional[str] = ""
    
    # Evaluación nutricional
    peso_edad: Optional[str] = ""  # Percentil
    talla_edad: Optional[str] = ""  # Percentil
    peso_talla: Optional[str] = ""  # Percentil
    estado_nutricional: Optional[str] = ""  # Normal, Desnutrición, Sobrepeso, Obesidad
    
    # Diagnóstico y tratamiento
    diagnostico: str
    cie10_codigo: Optional[str] = ""
    plan_tratamiento: str
    indicaciones_padres: Optional[str] = ""
    proximo_control: Optional[str] = ""
    observaciones: Optional[str] = ""
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicalHistoryPediatricCreate(BaseModel):
    appointment_id: str
    nombre_responsable: str
    parentesco_responsable: str
    telefono_responsable: str
    motivo_consulta: str
    enfermedad_actual: str
    datos_nacimiento: DatosNacimiento
    lactancia_materna: Optional[str] = ""
    lactancia_meses: Optional[int] = None
    desarrollo_psicomotor: DesarrolloPsicomotor
    desarrollo_acorde_edad: Optional[bool] = True
    observaciones_desarrollo: Optional[str] = ""
    vacunas: Vacunas
    esquema_completo: bool = False
    antecedentes_familiares: Optional[str] = ""
    enfermedades_hereditarias: Optional[str] = ""
    hospitalizaciones_previas: Optional[str] = ""
    cirugias_previas: Optional[str] = ""
    alergias: Optional[str] = ""
    medicamentos_actuales: Optional[str] = ""
    alimentacion_actual: Optional[str] = ""
    numero_comidas_dia: Optional[int] = None
    signos_vitales: SignosVitales
    perimetro_cefalico: Optional[float] = None
    estado_general: Optional[str] = ""
    piel_mucosas: Optional[str] = ""
    cabeza_cuello: Optional[str] = ""
    torax_pulmonar: Optional[str] = ""
    cardiovascular: Optional[str] = ""
    abdomen: Optional[str] = ""
    genitales: Optional[str] = ""
    extremidades: Optional[str] = ""
    neurologico: Optional[str] = ""
    peso_edad: Optional[str] = ""
    talla_edad: Optional[str] = ""
    peso_talla: Optional[str] = ""
    estado_nutricional: Optional[str] = ""
    diagnostico: str
    cie10_codigo: Optional[str] = ""
    plan_tratamiento: str
    indicaciones_padres: Optional[str] = ""
    proximo_control: Optional[str] = ""
    observaciones: Optional[str] = ""


# ========== ODONTOLOGÍA ==========

class EstadoDental(BaseModel):
    higiene_oral: Optional[str] = ""  # Buena, Regular, Mala
    encia: Optional[str] = ""  # Sana, Gingivitis, Periodontitis
    mucosa_oral: Optional[str] = ""
    lengua: Optional[str] = ""
    paladar: Optional[str] = ""
    atm: Optional[str] = ""  # Articulación Temporomandibular


class MedicalHistoryOdontology(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    appointment_id: str
    paciente_id: str
    paciente_nombre: str
    paciente_cedula: str
    paciente_edad: int
    paciente_sexo: str
    doctor_id: str
    doctor_nombre: str
    fecha: str
    
    # Motivo de consulta
    motivo_consulta: str
    dolor_dental: bool = False
    ubicacion_dolor: Optional[str] = ""
    intensidad_dolor: Optional[str] = ""  # Leve, Moderado, Severo
    tiempo_dolor: Optional[str] = ""
    
    # Antecedentes odontológicos
    ultima_visita_odonto: Optional[str] = ""
    frecuencia_cepillado: Optional[str] = ""
    uso_hilo_dental: bool = False
    uso_enjuague: bool = False
    tratamientos_previos: Optional[str] = ""
    
    # Antecedentes médicos relevantes
    diabetes: bool = False
    hipertension: bool = False
    cardiopatias: bool = False
    hepatitis: bool = False
    vih: bool = False
    epilepsia: bool = False
    embarazo: bool = False
    semanas_embarazo: Optional[int] = None
    alergias_medicamentos: Optional[str] = ""
    medicamentos_actuales: Optional[str] = ""
    
    # Hábitos
    fumador: bool = False
    cigarrillos_dia: Optional[int] = None
    bruxismo: bool = False
    succion_digital: bool = False
    
    # Examen intraoral
    estado_dental: EstadoDental
    
    # Odontograma (referencia)
    odontograma_id: Optional[str] = None
    
    # Diagnóstico
    diagnostico: str
    cie10_codigo: Optional[str] = ""
    
    # Plan de tratamiento
    plan_tratamiento: str
    procedimientos_realizados: Optional[str] = ""
    materiales_utilizados: Optional[str] = ""
    
    # Receta (medicamentos)
    medicamentos: Optional[str] = ""
    
    # Seguimiento
    proximo_control: Optional[str] = ""
    observaciones: Optional[str] = ""
    recomendaciones: Optional[str] = ""
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicalHistoryOdontologyCreate(BaseModel):
    appointment_id: str
    motivo_consulta: str
    dolor_dental: bool = False
    ubicacion_dolor: Optional[str] = ""
    intensidad_dolor: Optional[str] = ""
    tiempo_dolor: Optional[str] = ""
    ultima_visita_odonto: Optional[str] = ""
    frecuencia_cepillado: Optional[str] = ""
    uso_hilo_dental: bool = False
    uso_enjuague: bool = False
    tratamientos_previos: Optional[str] = ""
    diabetes: bool = False
    hipertension: bool = False
    cardiopatias: bool = False
    hepatitis: bool = False
    vih: bool = False
    epilepsia: bool = False
    embarazo: bool = False
    semanas_embarazo: Optional[int] = None
    alergias_medicamentos: Optional[str] = ""
    medicamentos_actuales: Optional[str] = ""
    fumador: bool = False
    cigarrillos_dia: Optional[int] = None
    bruxismo: bool = False
    succion_digital: bool = False
    estado_dental: EstadoDental
    odontograma_id: Optional[str] = None
    diagnostico: str
    cie10_codigo: Optional[str] = ""
    plan_tratamiento: str
    procedimientos_realizados: Optional[str] = ""
    materiales_utilizados: Optional[str] = ""
    medicamentos: Optional[str] = ""
    proximo_control: Optional[str] = ""
    observaciones: Optional[str] = ""
    recomendaciones: Optional[str] = ""

# ========== ODONTOLOGÍA - EVOLUCIÓN POR SESIÓN ==========

class ProcedimientoRealizado(BaseModel):
    """Procedimiento ejecutado en una sesión específica"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    diente_numero: str          # FDI: "16", "26", etc.
    procedimiento: str          # "Resina simple", "Extracción", etc.
    superficies: List[str] = [] # ["oclusal", "mesial"]
    precio: float = 0.0
    plan_tratamiento_item_id: Optional[str] = ""  # Referencia al item del plan
    notas: str = ""


class EvolicionSesion(BaseModel):
    """
    Registro de lo que se hizo en UNA sesión de odontología.
    Un paciente puede tener muchas sesiones, cada una con sus procedimientos.
    El odontograma se actualiza automáticamente al marcar procedimientos como realizados.
    """
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Datos de la sesión
    appointment_id: str         # La cita de HOY
    paciente_cedula: str        # Identificador único del paciente
    paciente_nombre: str
    doctor_id: str
    doctor_nombre: str
    fecha: str                  # Fecha de la sesión

    # Motivo de esta sesión
    motivo_sesion: str = ""     # "Continuación resinas", "Control", etc.

    # Procedimientos realizados en esta sesión
    procedimientos_realizados: List[ProcedimientoRealizado] = []

    # Materiales usados
    materiales_utilizados: str = ""

    # Signos vitales (opcional en odonto pero útil)
    presion_arterial: Optional[str] = ""
    frecuencia_cardiaca: Optional[int] = None

    # Evolución clínica (notas del doctor sobre el estado del paciente hoy)
    evolucion: str = ""

    # Próxima sesión
    proximo_procedimiento: str = ""   # Qué se hará en la próxima cita
    proxima_cita: Optional[str] = ""

    # Receta de esta sesión (analgésicos, antibióticos post-procedimiento)
    tiene_receta: bool = False
    medicamentos: Optional[str] = ""

    # Total cobrado en esta sesión
    total_sesion: float = 0.0

    # Estado del pago de esta sesión
    estado_pago: str = "pendiente"  # pendiente | pagado | abono

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EvolicionSesionCreate(BaseModel):
    """Modelo para crear una evolución de sesión"""
    appointment_id: str
    paciente_cedula: str
    paciente_nombre: str
    doctor_id: str
    doctor_nombre: str
    fecha: str
    motivo_sesion: str = ""
    procedimientos_realizados: List[ProcedimientoRealizado] = []
    materiales_utilizados: str = ""
    presion_arterial: Optional[str] = ""
    frecuencia_cardiaca: Optional[int] = None
    evolucion: str = ""
    proximo_procedimiento: str = ""
    proxima_cita: Optional[str] = ""
    tiene_receta: bool = False
    medicamentos: Optional[str] = ""
    total_sesion: float = 0.0
    estado_pago: str = "pendiente"


# ========== NUTRICIÓN ==========

class ExamenFisicoNutricion(BaseModel):
    peso: Optional[float] = None
    talla: Optional[float] = None
    imc: Optional[float] = None
    porcentaje_grasa: Optional[float] = None
    porcentaje_musculo: Optional[float] = None
    edad_corporal: Optional[int] = None
    # Pliegues cutáneos (mm)
    pliegue_suprailiaco: Optional[float] = None
    pliegue_tricipital: Optional[float] = None
    pliegue_bicipital: Optional[float] = None
    pliegue_subescapular: Optional[float] = None
    # Circunferencias (cm)
    cintura: Optional[float] = None
    cadera: Optional[float] = None
    icc: Optional[float] = None          # índice cintura-cadera
    muneca: Optional[float] = None
    circunferencia_brazo: Optional[float] = None

class LaboratorioNutricion(BaseModel):
    fecha_lab: Optional[str] = ""
    hemoglobina: Optional[float] = None
    plaquetas: Optional[float] = None
    glucosa: Optional[float] = None
    urea: Optional[float] = None
    creatinina: Optional[float] = None
    acido_urico: Optional[float] = None
    colesterol: Optional[float] = None
    hdl: Optional[float] = None
    ldl: Optional[float] = None
    trigliceridos: Optional[float] = None
    tgo: Optional[float] = None
    tgp: Optional[float] = None

class ControlNutricion(BaseModel):
    numero: int
    fecha: Optional[str] = ""
    peso: Optional[float] = None
    talla: Optional[float] = None
    imc: Optional[float] = None
    porcentaje_grasa: Optional[float] = None
    porcentaje_musculo: Optional[float] = None
    edad_corporal: Optional[int] = None
    cintura: Optional[float] = None
    cadera: Optional[float] = None
    icc: Optional[float] = None
    observaciones: Optional[str] = ""

class MedicalHistoryNutricion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    appointment_id: str
    paciente_cedula: str
    paciente_nombre: str
    paciente_edad: Optional[int] = None
    paciente_sexo: Optional[str] = ""
    doctor_id: str
    doctor_nombre: str
    fecha: str
    especialidad: str = "Nutrición"

    # Base clínica
    motivo_consulta: str
    evolucion_enfermedad: Optional[str] = ""

    # Antecedentes
    ant_familiares: Optional[str] = ""
    ant_personales: Optional[str] = ""
    ant_otros: Optional[str] = ""        # cirugías, gestas, partos, abortos
    alergias_intolerancias: Optional[str] = ""
    medicamentos_actuales: Optional[str] = ""

    # Examen físico
    examen_fisico: ExamenFisicoNutricion = Field(default_factory=ExamenFisicoNutricion)

    # Diagnóstico estandarizado
    diagnostico_texto: Optional[str] = ""
    cie10_codigo: Optional[str] = ""
    cie10_descripcion: Optional[str] = ""

    # Laboratorio
    laboratorio: LaboratorioNutricion = Field(default_factory=LaboratorioNutricion)

    # Plan alimentario
    plan_alimentario: Optional[str] = ""
    anamnesis: Optional[str] = ""
    notas: Optional[str] = ""

    # Receta
    receta: Optional[str] = ""
    medicamentos: Optional[List[dict]] = []

    # Controles de seguimiento (hasta 10)
    controles: List[ControlNutricion] = Field(default_factory=list)

    # Conexión financiera
    consulta_financiera_id: Optional[str] = ""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicalHistoryNutricionCreate(BaseModel):
    appointment_id: str
    paciente_cedula: str
    paciente_nombre: str
    paciente_edad: Optional[int] = None
    paciente_sexo: Optional[str] = ""
    doctor_id: str
    doctor_nombre: str
    fecha: str
    motivo_consulta: str
    evolucion_enfermedad: Optional[str] = ""
    ant_familiares: Optional[str] = ""
    ant_personales: Optional[str] = ""
    ant_otros: Optional[str] = ""
    alergias_intolerancias: Optional[str] = ""
    medicamentos_actuales: Optional[str] = ""
    examen_fisico: ExamenFisicoNutricion = Field(default_factory=ExamenFisicoNutricion)
    diagnostico_texto: Optional[str] = ""
    cie10_codigo: Optional[str] = ""
    cie10_descripcion: Optional[str] = ""
    laboratorio: LaboratorioNutricion = Field(default_factory=LaboratorioNutricion)
    plan_alimentario: Optional[str] = ""
    anamnesis: Optional[str] = ""
    notas: Optional[str] = ""
    receta: Optional[str] = ""
    medicamentos: Optional[List[dict]] = []
    controles: List[ControlNutricion] = Field(default_factory=list)


# ========== GINECOLOGÍA / OBSTETRICIA ==========

class DatosGinecologicos(BaseModel):
    menarquia: Optional[str] = ""
    ritmo_menstrual: Optional[str] = ""
    inicio_actividad_sexual: Optional[str] = ""
    menopausia: Optional[str] = ""
    partos: Optional[int] = None
    abortos: Optional[int] = None
    cesareas: Optional[int] = None
    gestas: Optional[int] = None
    metodo_anticonceptivo: Optional[str] = ""
    vida_sexual_activa: Optional[bool] = None
    ultimo_papanicolaou: Optional[str] = ""
    resultado_papanicolaou: Optional[str] = ""
    ultima_mamografia: Optional[str] = ""
    resultado_mamografia: Optional[str] = ""

class DatosEmbarazo(BaseModel):
    esta_embarazada: bool = False
    fur: Optional[str] = ""              # Fecha Última Regla
    fpp: Optional[str] = ""              # Fecha Probable de Parto
    semanas_gestacion: Optional[int] = None
    trimestre: Optional[int] = None      # 1, 2, 3
    numero_embarazo: Optional[int] = None
    embarazo_planificado: Optional[bool] = None
    # Controles prenatales
    presion_arterial: Optional[str] = ""
    peso_actual: Optional[float] = None
    altura_uterina: Optional[float] = None    # cm
    frecuencia_cardiaca_fetal: Optional[int] = None
    presentacion_fetal: Optional[str] = ""    # cefálica, podálica, transversa
    movimientos_fetales: Optional[str] = ""   # presentes, ausentes, disminuidos
    edemas: Optional[str] = ""               # no, leve, moderado, severo
    # Laboratorio prenatal
    grupo_sanguineo: Optional[str] = ""
    factor_rh: Optional[str] = ""
    vdrl: Optional[str] = ""
    vih_prenatal: Optional[str] = ""
    toxoplasma: Optional[str] = ""
    rubeola: Optional[str] = ""
    glucosa_prenatal: Optional[float] = None
    hemoglobina_prenatal: Optional[float] = None
    # Ecografías
    eco_primer_trimestre: Optional[str] = ""
    eco_segundo_trimestre: Optional[str] = ""
    eco_tercer_trimestre: Optional[str] = ""
    eco_morfologica: Optional[str] = ""
    # Vacunas embarazo
    vacuna_tetano: Optional[bool] = None
    vacuna_influenza: Optional[bool] = None
    # Notas del trimestre
    notas_primer_trimestre: Optional[str] = ""
    notas_segundo_trimestre: Optional[str] = ""
    notas_tercer_trimestre: Optional[str] = ""

class MedicalHistoryGinecologia(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    appointment_id: str
    paciente_cedula: str
    paciente_nombre: str
    paciente_edad: Optional[int] = None
    doctor_id: str
    doctor_nombre: str
    fecha: str
    especialidad: str = "Ginecología"

    # Base clínica
    motivo_consulta: str
    enfermedad_actual: Optional[str] = ""

    # Antecedentes generales
    ant_familiares_hta: bool = False
    ant_familiares_diabetes: bool = False
    ant_familiares_cancer: bool = False
    ant_familiares_otros: Optional[str] = ""
    ant_personales_quirurgicos: Optional[str] = ""
    ant_personales_alergias: Optional[str] = ""
    ant_personales_otros: Optional[str] = ""
    medicamentos_actuales: Optional[str] = ""

    # Datos ginecológicos
    datos_ginecologicos: DatosGinecologicos = Field(default_factory=DatosGinecologicos)

    # Embarazo (se activa si está embarazada)
    datos_embarazo: DatosEmbarazo = Field(default_factory=DatosEmbarazo)

    # Examen físico
    peso: Optional[float] = None
    talla: Optional[float] = None
    imc: Optional[float] = None
    presion_arterial: Optional[str] = ""
    frecuencia_cardiaca: Optional[int] = None
    temperatura: Optional[float] = None
    examen_fisico_general: Optional[str] = ""
    examen_ginecologico: Optional[str] = ""

    # Diagnóstico estandarizado
    diagnostico_texto: Optional[str] = ""
    cie10_codigo: Optional[str] = ""
    cie10_descripcion: Optional[str] = ""

    # Tratamiento y receta
    tratamiento: Optional[str] = ""
    receta: Optional[str] = ""
    medicamentos: Optional[List[dict]] = []
    indicaciones: Optional[str] = ""
    proximo_control: Optional[str] = ""
    notas: Optional[str] = ""

    # Conexión financiera
    consulta_financiera_id: Optional[str] = ""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicalHistoryGinecologiaCreate(BaseModel):
    appointment_id: str
    paciente_cedula: str
    paciente_nombre: str
    paciente_edad: Optional[int] = None
    doctor_id: str
    doctor_nombre: str
    fecha: str
    motivo_consulta: str
    enfermedad_actual: Optional[str] = ""
    ant_familiares_hta: bool = False
    ant_familiares_diabetes: bool = False
    ant_familiares_cancer: bool = False
    ant_familiares_otros: Optional[str] = ""
    ant_personales_quirurgicos: Optional[str] = ""
    ant_personales_alergias: Optional[str] = ""
    ant_personales_otros: Optional[str] = ""
    medicamentos_actuales: Optional[str] = ""
    datos_ginecologicos: DatosGinecologicos = Field(default_factory=DatosGinecologicos)
    datos_embarazo: DatosEmbarazo = Field(default_factory=DatosEmbarazo)
    peso: Optional[float] = None
    talla: Optional[float] = None
    imc: Optional[float] = None
    presion_arterial: Optional[str] = ""
    frecuencia_cardiaca: Optional[int] = None
    temperatura: Optional[float] = None
    examen_fisico_general: Optional[str] = ""
    examen_ginecologico: Optional[str] = ""
    diagnostico_texto: Optional[str] = ""
    cie10_codigo: Optional[str] = ""
    cie10_descripcion: Optional[str] = ""
    tratamiento: Optional[str] = ""
    receta: Optional[str] = ""
    medicamentos: Optional[List[dict]] = []
    indicaciones: Optional[str] = ""
    proximo_control: Optional[str] = ""
    notas: Optional[str] = ""


# ========== ECOGRAFÍA ==========

class HallazgoEcografico(BaseModel):
    organo: str                           # "Útero", "Ovario derecho", etc.
    normal: bool = True
    descripcion: Optional[str] = ""
    medidas: Optional[str] = ""           # "8.5 x 4.2 x 3.1 cm"

class MedicalHistoryEcografia(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    appointment_id: str
    paciente_cedula: str
    paciente_nombre: str
    paciente_edad: Optional[int] = None
    paciente_sexo: Optional[str] = ""
    doctor_id: str
    doctor_nombre: str
    fecha: str
    especialidad: str = "Ecografía"

    # Tipo de ecografía
    tipo_ecografia: str = ""              # "Obstétrica", "Pélvica", "Abdominal", "Renal", "Tiroides", etc.
    via: Optional[str] = ""              # "Abdominal", "Transvaginal", "Transrectal"
    indicacion_clinica: Optional[str] = ""

    # Para ecografía obstétrica
    es_obstetrica: bool = False
    semanas_gestacion: Optional[int] = None
    fur: Optional[str] = ""
    numero_fetos: Optional[int] = 1
    latido_cardiaco_fetal: Optional[bool] = None
    frecuencia_cardiaca_fetal: Optional[int] = None
    presentacion: Optional[str] = ""
    placenta: Optional[str] = ""
    liquido_amniotico: Optional[str] = ""
    biometria_fetal: Optional[str] = ""   # DBP, LF, CA, etc. en texto

    # Hallazgos por órgano (flexible)
    hallazgos: List[HallazgoEcografico] = Field(default_factory=list)

    # Diagnóstico estandarizado
    conclusion: str = ""
    cie10_codigo: Optional[str] = ""
    cie10_descripcion: Optional[str] = ""
    recomendaciones: Optional[str] = ""
    notas: Optional[str] = ""

    # Imagen adjunta (URL o base64)
    imagen_url: Optional[str] = ""

    # Conexión financiera
    consulta_financiera_id: Optional[str] = ""

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MedicalHistoryEcografiaCreate(BaseModel):
    appointment_id: str
    paciente_cedula: str
    paciente_nombre: str
    paciente_edad: Optional[int] = None
    paciente_sexo: Optional[str] = ""
    doctor_id: str
    doctor_nombre: str
    fecha: str
    tipo_ecografia: str = ""
    via: Optional[str] = ""
    indicacion_clinica: Optional[str] = ""
    es_obstetrica: bool = False
    semanas_gestacion: Optional[int] = None
    fur: Optional[str] = ""
    numero_fetos: Optional[int] = 1
    latido_cardiaco_fetal: Optional[bool] = None
    frecuencia_cardiaca_fetal: Optional[int] = None
    presentacion: Optional[str] = ""
    placenta: Optional[str] = ""
    liquido_amniotico: Optional[str] = ""
    biometria_fetal: Optional[str] = ""
    hallazgos: List[HallazgoEcografico] = Field(default_factory=list)
    conclusion: str = ""
    cie10_codigo: Optional[str] = ""
    cie10_descripcion: Optional[str] = ""
    recomendaciones: Optional[str] = ""
    notas: Optional[str] = ""
    imagen_url: Optional[str] = ""
