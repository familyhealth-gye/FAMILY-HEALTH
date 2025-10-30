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