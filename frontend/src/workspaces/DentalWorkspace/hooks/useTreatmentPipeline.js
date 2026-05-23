/**
 * useTreatmentPipeline.js
 * Hook central del pipeline clínico.
 *
 * Responsabilidades:
 * - Cargar y mantener el plan de tratamiento desde el backend
 * - Agregar procedimientos con optimistic update
 * - Actualizar estados con validación de rol
 * - Autosave debounced de la nota de sesión
 * - Exponer helpers de lectura (toothStates, proceduresByTooth)
 *
 * NO hace: lógica de UI, llamadas a Gemini, manejo de formularios.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';
import { PIPELINE_STATE_PRIORITY } from '../engine/clinical_rules';

const DEBOUNCE_MS = 1200;

export const useTreatmentPipeline = ({ appointmentId, pacienteCedula, appointment }) => {
  const [plan, setPlan]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);   // autosave indicator
  const [sessionNote, setSessionNote] = useState('');

  const debounceRef   = useRef(null);
  const sessionNoteRef = useRef(sessionNote);
  sessionNoteRef.current = sessionNote;

  // ─── FETCH PLAN ────────────────────────────────────────────────────────────
  const fetchPlan = useCallback(async (silent = false) => {
    if (!pacienteCedula) return;
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get(`/plan-tratamiento/paciente/${pacienteCedula}`);
      setPlan(res.data || null);
    } catch (err) {
      if (!silent) console.error('fetchPlan error:', err);
      // No toast en silent refresh — no interrumpir flujo clínico
    } finally {
      if (!silent) setLoading(false);
    }
  }, [pacienteCedula]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // ─── CREAR PLAN SI NO EXISTE ────────────────────────────────────────────────
  const ensurePlan = useCallback(async () => {
    if (plan?.id) return plan.id;
    if (!appointment) return null;
    try {
      const res = await apiClient.post('/plan-tratamiento', {
        paciente_id:      appointment.paciente_id,
        paciente_cedula:  appointment.paciente_cedula,
        paciente_nombre:  appointment.paciente_nombre,
        doctor_id:        appointment.doctor_id,
        doctor_nombre:    appointment.doctor_nombre,
      });
      const newPlan = res.data;
      setPlan(newPlan);
      return newPlan.id;
    } catch (err) {
      toast.error('No se pudo crear el plan de tratamiento.');
      return null;
    }
  }, [plan, appointment]);

  // ─── AGREGAR PROCEDIMIENTO ──────────────────────────────────────────────────
  // Optimistic: agrega localmente primero, confirma con backend
  const addProcedure = useCallback(async (procedureData) => {
    const planId = await ensurePlan();
    if (!planId) return;

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempProc = {
      id: tempId,
      estado_pipeline: 'creado',
      ...procedureData,
      _optimistic: true,
    };

    setPlan(prev => prev
      ? { ...prev, procedimientos: [...(prev.procedimientos || []), tempProc] }
      : null
    );

    try {
      await apiClient.post(`/plan-tratamiento/${planId}/procedimiento`, {
        ...procedureData,
        estado_pipeline: 'creado',
      });
      // Refresh silencioso para reemplazar tempId con ID real
      await fetchPlan(true);
      toast.success('Agregado al pipeline');
    } catch (err) {
      // Revertir optimistic
      setPlan(prev => prev
        ? { ...prev, procedimientos: (prev.procedimientos || []).filter(p => p.id !== tempId) }
        : null
      );
      toast.error('Error al agregar procedimiento');
    }
  }, [ensurePlan, fetchPlan]);

  // ─── ACTUALIZAR ESTADO ──────────────────────────────────────────────────────
  const updateProcedureState = useCallback(async (procId, nuevoEstado, extraData = {}) => {
    if (!plan?.id) return;

    // Optimistic update de estado
    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        procedimientos: prev.procedimientos.map(p =>
          p.id === procId ? { ...p, estado_pipeline: nuevoEstado, ...extraData } : p
        ),
      };
    });

    try {
      await apiClient.put(
        `/plan-tratamiento/${plan.id}/procedimiento/${procId}/estado?nuevo_estado=${nuevoEstado}`
      );
      if (Object.keys(extraData).length > 0) {
        await apiClient.put(
          `/plan-tratamiento/${plan.id}/procedimiento/${procId}`,
          extraData
        );
      }
      await fetchPlan(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar estado');
      await fetchPlan(true); // Revertir con datos reales
    }
  }, [plan, fetchPlan]);

  // ─── ELIMINAR PROCEDIMIENTO ─────────────────────────────────────────────────
  const deleteProcedure = useCallback(async (procId) => {
    if (!plan?.id) return;

    setPlan(prev => prev
      ? { ...prev, procedimientos: (prev.procedimientos || []).filter(p => p.id !== procId) }
      : null
    );

    try {
      await apiClient.delete(`/plan-tratamiento/${plan.id}/procedimiento/${procId}`);
    } catch (err) {
      toast.error('Error al eliminar');
      await fetchPlan(true);
    }
  }, [plan, fetchPlan]);

  // ─── AUTOSAVE NOTA DE SESIÓN ────────────────────────────────────────────────
  const handleSessionNoteChange = useCallback((value) => {
    setSessionNote(value);

    // Persistir en localStorage inmediatamente (cero pérdida)
    if (appointmentId) {
      const draft = JSON.parse(localStorage.getItem(`dental_draft_${appointmentId}`) || '{}');
      localStorage.setItem(`dental_draft_${appointmentId}`, JSON.stringify({ ...draft, sessionNote: value }));
    }

    // Debounce para backend (si en el futuro se persiste la nota en el appointment)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!appointmentId || !value.trim()) return;
      setSaving(true);
      try {
        // Endpoint futuro: PATCH /appointments/:id/nota-sesion
        // Por ahora solo persiste en localStorage — no rompe nada
        // await apiClient.patch(`/appointments/${appointmentId}/nota-sesion`, { nota: value });
      } finally {
        setSaving(false);
      }
    }, DEBOUNCE_MS);
  }, [appointmentId]);

  // Recuperar nota de sesión del draft local al montar
  useEffect(() => {
    if (!appointmentId) return;
    try {
      const draft = JSON.parse(localStorage.getItem(`dental_draft_${appointmentId}`) || '{}');
      if (draft.sessionNote) setSessionNote(draft.sessionNote);
    } catch {}
  }, [appointmentId]);

  // ─── HELPERS DE LECTURA ─────────────────────────────────────────────────────

  // Estado dominante por pieza (para colorear el odontograma)
  const toothStates = useMemo(() => {
    const states = {};
    if (!plan?.procedimientos) return states;

    plan.procedimientos.forEach(proc => {
      const tooth = proc.diente_numero;
      if (!tooth || tooth === '0') return;

      const state = proc.estado_pipeline || 'creado';
      const currentPriority = PIPELINE_STATE_PRIORITY[states[tooth]] || 0;
      const newPriority     = PIPELINE_STATE_PRIORITY[state] || 0;

      if (newPriority > currentPriority) states[tooth] = state;

      // Extracción/Ausente siempre domina visualmente
      const nombre = proc.procedimiento?.toLowerCase() || '';
      if (nombre.includes('extrac') || nombre.includes('ausente')) {
        states[tooth] = 'extraido';
      }
    });

    return states;
  }, [plan]);

  // Procedimientos agrupados por número de pieza (para historial en ToothPanel)
  const proceduresByTooth = useMemo(() => {
    const map = {};
    if (!plan?.procedimientos) return map;
    plan.procedimientos.forEach(proc => {
      const tooth = proc.diente_numero;
      if (!map[tooth]) map[tooth] = [];
      map[tooth].push(proc);
    });
    // Ordenar cada grupo por fecha descendente
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => (b.fecha_realizado || '').localeCompare(a.fecha_realizado || ''));
    });
    return map;
  }, [plan]);

  // Totales del plan
  const totals = useMemo(() => {
    const procs = plan?.procedimientos || [];
    return {
      total:      procs.reduce((s, p) => s + (p.precio || 0), 0),
      realizados: procs.filter(p => p.estado_pipeline === 'realizado' || p.estado_pipeline === 'cobrado').length,
      pendientes: procs.filter(p => !['realizado', 'cobrado', 'cancelado'].includes(p.estado_pipeline)).length,
      count:      procs.length,
    };
  }, [plan]);

  return {
    // Estado
    plan,
    loading,
    saving,
    sessionNote,

    // Acciones
    addProcedure,
    updateProcedureState,
    deleteProcedure,
    handleSessionNoteChange,
    refreshPlan: () => fetchPlan(true),

    // Helpers de lectura
    toothStates,
    proceduresByTooth,
    totals,
  };
};
