/**
 * useClinicalEngine.js
 * Hook del motor clínico desacoplado.
 *
 * Capa 1: evaluarReglas() — local, sin costo, sin latencia
 * Capa 2: solicitarIA()   — Gemini, solo bajo demanda explícita del doctor
 *
 * La IA nunca bloquea el flujo. Si falla, el sistema sigue con reglas locales.
 */

import { useState, useCallback } from 'react';
import { evaluarReglas, getRecetaConAlergias, PROCEDURE_DEFAULTS } from '../engine/clinical_rules';
import apiClient from '@/lib/axios';

export const useClinicalEngine = ({ paciente }) => {
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiError, setAiError]           = useState(null);

  // ─── CAPA 1: Reglas locales ────────────────────────────────────────────────
  // Evaluación instantánea. Se llama desde ToothPanel en cada cambio de superficie/procedimiento.
  const evaluateLocal = useCallback((ctx) => {
    return evaluarReglas(ctx);
  }, []);

  // ─── DEFAULTS DE PROCEDIMIENTO ─────────────────────────────────────────────
  const getProcedureDefaults = useCallback((procedimiento) => {
    return PROCEDURE_DEFAULTS[procedimiento] || null;
  }, []);

  // ─── RECETA CON ALERGIAS ───────────────────────────────────────────────────
  const getAdjustedPrescription = useCallback((procedimiento) => {
    return getRecetaConAlergias(procedimiento, paciente);
  }, [paciente]);

  // ─── CAPA 2: Gemini bajo demanda ──────────────────────────────────────────
  // Solo se llama cuando el doctor presiona "✦ Análisis IA".
  // NUNCA se llama automáticamente.
  const requestAIAnalysis = useCallback(async (tipo, payload) => {
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);

    try {
      const endpoint = {
        tratamiento: '/clinical/suggest-treatment',
        evolucion:   '/clinical/generate-evolution',
        paciente:    '/clinical/explain-patient',
        receta:      '/clinical/suggest-prescription',
        secuencia:   '/clinical/optimize-sequence',
      }[tipo];

      if (!endpoint) throw new Error('Tipo de análisis IA desconocido');

      const res = await apiClient.post(endpoint, payload);

      if (res.data?.fallback) {
        // Backend indica que Gemini no está disponible
        setAiError('Análisis IA no disponible. Usando sugerencias locales.');
        return null;
      }

      setAiSuggestion(res.data);
      return res.data;
    } catch (err) {
      // NUNCA bloquear el flujo clínico por error de IA
      setAiError('IA temporalmente no disponible.');
      return null;
    } finally {
      setAiLoading(false);
    }
  }, []);

  const clearAISuggestion = useCallback(() => {
    setAiSuggestion(null);
    setAiError(null);
  }, []);

  return {
    // Capa 1 — inmediato
    evaluateLocal,
    getProcedureDefaults,
    getAdjustedPrescription,

    // Capa 2 — bajo demanda
    requestAIAnalysis,
    clearAISuggestion,
    aiSuggestion,
    aiLoading,
    aiError,
  };
};
