/**
 * clinical_rules.js
 * Motor de reglas clínicas locales — sin costo, sin latencia.
 * Capa 1 del Clinical Decision Engine.
 * Gemini es Capa 2 (opcional, bajo demanda).
 */

// ─── TABLA DE DEFAULTS POR PROCEDIMIENTO ───────────────────────────────────
export const PROCEDURE_DEFAULTS = {
  'Resina Simple': {
    fase: 1, precio: 35, cie10: 'K02.1',
    receta: [],
    indicaciones: 'Evitar café, té y alimentos que manchen 48h. No morder objetos duros.',
    dias_control: 30, tiempo_min: 30,
  },
  'Resina Compuesta': {
    fase: 1, precio: 45, cie10: 'K02.1',
    receta: [{ nombre: 'Ibuprofeno 400mg', dosis: '1 tableta', frecuencia: 'c/8h si dolor', duracion: '2 días' }],
    indicaciones: 'Evitar café, té y alimentos que manchen 48h.',
    dias_control: 30, tiempo_min: 45,
  },
  'Resina Compleja': {
    fase: 1, precio: 60, cie10: 'K02.1',
    receta: [{ nombre: 'Ibuprofeno 400mg', dosis: '1 tableta', frecuencia: 'c/8h si dolor', duracion: '2 días' }],
    indicaciones: 'Sensibilidad normal primeras 48h. Evitar alimentos duros 72h.',
    dias_control: 14, tiempo_min: 60,
  },
  'Extracción': {
    fase: 1, precio: 45, cie10: 'K08.1',
    receta: [
      { nombre: 'Amoxicilina 500mg', dosis: '1 cápsula', frecuencia: 'c/8h', duracion: '5 días' },
      { nombre: 'Ibuprofeno 400mg', dosis: '1 tableta', frecuencia: 'c/8h', duracion: '3 días' },
    ],
    receta_alergia_penicilina: [
      { nombre: 'Clindamicina 300mg', dosis: '1 cápsula', frecuencia: 'c/8h', duracion: '5 días' },
      { nombre: 'Ibuprofeno 400mg', dosis: '1 tableta', frecuencia: 'c/8h', duracion: '3 días' },
    ],
    indicaciones: 'No fumar 48h. No escupir. Aplicar frío 20min c/hora primeras 6h. Alimentos blandos 24h.',
    dias_control: 7, tiempo_min: 30,
  },
  'Endodoncia': {
    fase: 1, precio: 180, cie10: 'K04.0',
    receta: [
      { nombre: 'Amoxicilina 500mg', dosis: '1 cápsula', frecuencia: 'c/8h', duracion: '7 días' },
      { nombre: 'Ibuprofeno 400mg', dosis: '1 tableta', frecuencia: 'c/8h', duracion: '5 días' },
    ],
    receta_alergia_penicilina: [
      { nombre: 'Clindamicina 300mg', dosis: '1 cápsula', frecuencia: 'c/8h', duracion: '7 días' },
      { nombre: 'Ibuprofeno 400mg', dosis: '1 tableta', frecuencia: 'c/8h', duracion: '5 días' },
    ],
    indicaciones: 'No masticar del lado tratado. Control a los 7 días. Puede requerir corona posterior.',
    dias_control: 7, tiempo_min: 90,
  },
  'Corona': {
    fase: 2, precio: 250, cie10: 'K08.3',
    receta: [],
    indicaciones: 'No masticar del lado tratado hasta cementación definitiva. Evitar alimentos pegajosos.',
    dias_control: 14, tiempo_min: 60,
  },
  'Sellante': {
    fase: 1, precio: 25, cie10: 'K02.0',
    receta: [],
    indicaciones: 'No comer ni beber 1h. El sellante puede desprenderse — consultar si ocurre.',
    dias_control: 180, tiempo_min: 20,
  },
  'Limpieza': {
    fase: 3, precio: 40, cie10: 'K05.1',
    receta: [{ nombre: 'Clorhexidina 0.12% enjuague', dosis: '15ml', frecuencia: 'c/12h', duracion: '10 días' }],
    indicaciones: 'Sensibilidad normal primeras 48h. Cepillado suave. Hilo dental diario.',
    dias_control: 180, tiempo_min: 45,
  },
  'Incrustación': {
    fase: 2, precio: 160, cie10: 'K08.3',
    receta: [],
    indicaciones: 'No masticar del lado tratado hasta cementación definitiva.',
    dias_control: 14, tiempo_min: 75,
  },
  'Blanqueamiento': {
    fase: 4, precio: 120, cie10: 'Z46.7',
    receta: [],
    indicaciones: 'Evitar alimentos que manchen 48h. Sensibilidad normal. Usar pasta sensibilizante.',
    dias_control: 90, tiempo_min: 60,
  },
  'Ausente': { fase: 1, precio: 0, cie10: '', receta: [], indicaciones: '', dias_control: 0, tiempo_min: 0 },
};

// ─── REGLAS CLÍNICAS ─────────────────────────────────────────────────────────
// Cada regla: condicion(ctx) → bool, sugerencia a mostrar
export const CLINICAL_RULES = [
  {
    id: 'CR-001',
    descripcion: '3+ superficies → evaluar corona o incrustación',
    condicion: ({ selectedSurfaces }) => selectedSurfaces.length >= 3,
    sugerencia: {
      tipo: 'warning',
      texto: '3+ superficies afectadas — considerar Corona o Incrustación',
      procedimientos_alternativos: ['Corona', 'Incrustación'],
    },
  },
  {
    id: 'CR-002',
    descripcion: 'Solo oclusal → sellante preventivo',
    condicion: ({ selectedSurfaces }) =>
      selectedSurfaces.length === 1 && selectedSurfaces.includes('O'),
    sugerencia: {
      tipo: 'info',
      texto: 'Solo superficie oclusal — considerar Sellante preventivo',
      procedimientos_alternativos: ['Sellante'],
    },
  },
  {
    id: 'CR-003',
    descripcion: 'Historial endodoncia en misma pieza + nueva caries → retratamiento',
    condicion: ({ toothHistory }) =>
      toothHistory.some(h => h.procedimiento?.toLowerCase().includes('endodoncia')),
    sugerencia: {
      tipo: 'warning',
      texto: 'Endodoncia previa en esta pieza — evaluar retratamiento o extracción',
      procedimientos_alternativos: ['Endodoncia', 'Extracción'],
    },
  },
  {
    id: 'CR-004',
    descripcion: 'Alergia penicilina + procedimiento invasivo → receta alternativa',
    condicion: ({ paciente, procedimiento }) => {
      const esInvasivo = ['Extracción', 'Endodoncia'].includes(procedimiento);
      const alergia = paciente?.alergias?.toLowerCase() || '';
      return esInvasivo && (alergia.includes('penicilina') || alergia.includes('amoxicilina'));
    },
    sugerencia: {
      tipo: 'danger',
      texto: '⚠️ Alérgico a Penicilina — receta ajustada a Clindamicina automáticamente',
      ajusta_receta: true,
    },
  },
  {
    id: 'CR-005',
    descripcion: 'Diabético + extracción → alerta cicatrización',
    condicion: ({ paciente, procedimiento }) =>
      procedimiento === 'Extracción' && paciente?.ant_diabetes === true,
    sugerencia: {
      tipo: 'warning',
      texto: '⚠️ Paciente diabético — verificar glucemia pre-procedimiento. Mayor riesgo de cicatrización lenta.',
      ajusta_receta: false,
    },
  },
  {
    id: 'CR-006',
    descripcion: 'Historial corona en misma pieza → verificar soporte',
    condicion: ({ toothHistory }) =>
      toothHistory.some(h => h.procedimiento?.toLowerCase().includes('corona')),
    sugerencia: {
      tipo: 'info',
      texto: 'Corona previa en esta pieza — verificar soporte y estructura remanente',
    },
  },
];

// ─── EVALUADOR PRINCIPAL ──────────────────────────────────────────────────────
/**
 * Evalúa todas las reglas para el contexto actual.
 * @param {object} ctx - { selectedSurfaces, toothHistory, paciente, procedimiento }
 * @returns {Array} - sugerencias activas
 */
export const evaluarReglas = (ctx) => {
  return CLINICAL_RULES
    .filter(regla => {
      try { return regla.condicion(ctx); }
      catch { return false; }
    })
    .map(regla => ({ ...regla.sugerencia, regla_id: regla.id }));
};

/**
 * Devuelve la receta correcta considerando alergias del paciente.
 */
export const getRecetaConAlergias = (procedimiento, paciente) => {
  const defaults = PROCEDURE_DEFAULTS[procedimiento];
  if (!defaults) return [];

  const alergia = paciente?.alergias?.toLowerCase() || '';
  const tieneAlergiaP = alergia.includes('penicilina') || alergia.includes('amoxicilina');

  if (tieneAlergiaP && defaults.receta_alergia_penicilina) {
    return defaults.receta_alergia_penicilina;
  }
  return defaults.receta || [];
};

/**
 * Clasifica procedimiento por número de superficies.
 */
export const clasificarPorSuperficies = (numSuperficies) => {
  if (numSuperficies === 0) return null;
  if (numSuperficies === 1) return 'Resina Simple';
  if (numSuperficies === 2) return 'Resina Compuesta';
  if (numSuperficies === 3) return 'Resina Compleja';
  return 'Corona'; // 4+
};

/**
 * Nombres legibles de las fases.
 */
export const FASE_LABELS = {
  1: 'Urgencia / Dolor activo',
  2: 'Rehabilitación',
  3: 'Prevención / Mantenimiento',
  4: 'Estética',
};

/**
 * Colores y estilos de cada estado del pipeline.
 */
export const PIPELINE_STATE_CONFIG = {
  creado:    { label: 'Creado',    color: 'bg-slate-500',  ring: 'ring-slate-200',  dot: 'bg-slate-400'  },
  propuesto: { label: 'Propuesto', color: 'bg-red-500',    ring: 'ring-red-100',    dot: 'bg-red-400'    },
  aprobado:  { label: 'Aprobado',  color: 'bg-amber-500',  ring: 'ring-amber-100',  dot: 'bg-amber-400'  },
  programado:{ label: 'Programado',color: 'bg-blue-500',   ring: 'ring-blue-100',   dot: 'bg-blue-400'   },
  realizado: { label: 'Realizado', color: 'bg-green-500',  ring: 'ring-green-100',  dot: 'bg-green-400'  },
  cobrado:   { label: 'Cobrado',   color: 'bg-teal-500',   ring: 'ring-teal-100',   dot: 'bg-teal-400'   },
  cancelado: { label: 'Cancelado', color: 'bg-slate-200',  ring: 'ring-slate-100',  dot: 'bg-slate-300'  },
  extraido:  { label: 'Extraído',  color: 'bg-slate-800',  ring: 'ring-slate-300',  dot: 'bg-slate-700'  },
};

// Prioridad visual en el odontograma (mayor número = domina)
export const PIPELINE_STATE_PRIORITY = {
  extraido: 7, realizado: 6, cobrado: 5, programado: 4,
  aprobado: 3, propuesto: 2, creado: 1,
};
