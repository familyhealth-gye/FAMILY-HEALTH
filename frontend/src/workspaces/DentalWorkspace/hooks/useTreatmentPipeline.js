/**
 * useTreatmentPipeline.js  — v2 con persistencia real
 *
 * Cambios vs v1:
 * - autosave nota-sesion conectado al backend (PATCH /appointments/:id/nota-sesion)
 * - localStorage como capa de resiliencia, no fuente de verdad
 * - indicadores de estado: 'idle' | 'saving' | 'saved' | 'error'
 * - rollback real en updateProcedureState y deleteProcedure
 * - _registrar_auditoria llamado desde cerrar-consulta (backend lo maneja)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';
import { PIPELINE_STATE_PRIORITY } from '../engine/clinical_rules';

const DEBOUNCE_MS = 1400;

export const useTreatmentPipeline = ({ appointmentId, pacienteCedula, appointment }) => {
  const [plan, setPlan]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle'|'saving'|'saved'|'error'
  const [sessionNote, setSessionNote] = useState('');

  const debounceRef    = useRef(null);
  const prevPlanRef    = useRef(null); // para rollback

  // ─── FETCH PLAN ────────────────────────────────────────────────────────────
  const fetchPlan = useCallback(async (silent = false) => {
    if (!pacienteCedula) return;
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get(`/plan-tratamiento/paciente/${pacienteCedula}`);
      setPlan(res.data || null);
      prevPlanRef.current = res.data || null;
    } catch (err) {
      if (!silent) console.error('[Pipeline] fetchPlan error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [pacienteCedula]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  // ─── CREAR PLAN SI NO EXISTE ────────────────────────────────────────────────
  const ensurePlan = useCallback(async () => {
    if (plan?.id) return plan.id;
    if (!appointment) return null;
    try {
      const res = await apiClient.post('/plan-tratamiento', {
        paciente_id:     appointment.paciente_id     || '',
        paciente_cedula: appointment.paciente_cedula || appointment.cedula || '',
        paciente_nombre: appointment.nombre_completo || '',
        doctor_id:       appointment.doctor_id       || '',
        doctor_nombre:   appointment.doctor_nombre   || '',
      });
      const newPlan = { ...res.data, procedimientos: [] };
      setPlan(newPlan);
      prevPlanRef.current = newPlan;
      return res.data.id;
    } catch (err) {
      toast.error('No se pudo crear el plan de tratamiento.');
      return null;
    }
  }, [plan, appointment]);

  // ─── AGREGAR PROCEDIMIENTO (optimistic) ────────────────────────────────────
  const addProcedure = useCallback(async (procedureData) => {
    const planId = await ensurePlan();
    if (!planId) return;

    const tempId  = `temp_${Date.now()}`;
    const tempProc = { id: tempId, estado_pipeline: 'creado', ...procedureData, _optimistic: true };

    setPlan(prev => prev
      ? { ...prev, procedimientos: [...(prev.procedimientos || []), tempProc] }
      : null
    );
    setSyncStatus('saving');

    try {
      await apiClient.post(`/plan-tratamiento/${planId}/procedimiento`, {
        ...procedureData,
        estado_pipeline: 'creado',
      });
      await fetchPlan(true);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      setPlan(prev => prev
        ? { ...prev, procedimientos: (prev.procedimientos || []).filter(p => p.id !== tempId) }
        : null
      );
      setSyncStatus('error');
      toast.error('Error al agregar procedimiento. Reintentando…');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }, [ensurePlan, fetchPlan]);

  // ─── ACTUALIZAR ESTADO (optimistic + rollback) ──────────────────────────────
  const updateProcedureState = useCallback(async (procId, nuevoEstado, extraData = {}) => {
    if (!plan?.id) return;

    // Snapshot para rollback
    const snapshot = JSON.parse(JSON.stringify(plan));

    setPlan(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        procedimientos: prev.procedimientos.map(p =>
          p.id === procId ? { ...p, estado_pipeline: nuevoEstado, ...extraData } : p
        ),
      };
    });
    setSyncStatus('saving');

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
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      // Rollback al snapshot
      setPlan(snapshot);
      prevPlanRef.current = snapshot;
      setSyncStatus('error');
      toast.error(err.response?.data?.detail || 'Error al actualizar estado. Se revirtió el cambio.');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }, [plan, fetchPlan]);

  // ─── ELIMINAR PROCEDIMIENTO (optimistic + rollback) ─────────────────────────
  const deleteProcedure = useCallback(async (procId) => {
    if (!plan?.id) return;

    const snapshot = JSON.parse(JSON.stringify(plan));
    setPlan(prev => prev
      ? { ...prev, procedimientos: (prev.procedimientos || []).filter(p => p.id !== procId) }
      : null
    );
    setSyncStatus('saving');

    try {
      await apiClient.delete(`/plan-tratamiento/${plan.id}/procedimiento/${procId}`);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (err) {
      setPlan(snapshot);
      setSyncStatus('error');
      toast.error('Error al eliminar. Se revirtió el cambio.');
      setTimeout(() => setSyncStatus('idle'), 4000);
    }
  }, [plan, fetchPlan]);

  // ─── CERRAR CONSULTA (Doctor → Counter) ────────────────────────────────────
  const cerrarConsulta = useCallback(async (motivo = '') => {
    if (!plan?.id) {
      toast.error('No hay plan activo para cerrar.');
      return false;
    }
    setSyncStatus('saving');
    try {
      const res = await apiClient.post(
        `/plan-tratamiento/${plan.id}/cerrar-consulta`,
        { motivo }
      );
      await fetchPlan(true);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
      toast.success(`✅ ${res.data.message}`);
      return true;
    } catch (err) {
      setSyncStatus('error');
      toast.error(err.response?.data?.detail || 'Error al cerrar consulta.');
      setTimeout(() => setSyncStatus('idle'), 4000);
      return false;
    }
  }, [plan, fetchPlan]);

  // ─── AUTOSAVE NOTA DE SESIÓN ────────────────────────────────────────────────
  const handleSessionNoteChange = useCallback((value) => {
    setSessionNote(value);

    // localStorage: capa de resiliencia inmediata (no fuente de verdad)
    if (appointmentId) {
      try {
        const draft = JSON.parse(localStorage.getItem(`dental_draft_${appointmentId}`) || '{}');
        localStorage.setItem(`dental_draft_${appointmentId}`, JSON.stringify({ ...draft, sessionNote: value }));
      } catch {}
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!appointmentId || !value.trim()) return;
      setSyncStatus('saving');
      try {
        await apiClient.patch(`/appointments/${appointmentId}/nota-sesion`, { nota: value });
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (err) {
        // No toast — falla silenciosamente, localStorage ya tiene el dato
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
    }, DEBOUNCE_MS);
  }, [appointmentId]);

  // Recuperar nota: primero del backend (si existe), fallback a localStorage
  useEffect(() => {
    if (!appointmentId) return;
    const loadNote = async () => {
      try {
        const res = await apiClient.get(`/appointments/${appointmentId}`);
        const backendNote = res.data?.nota_sesion_clinica;
        if (backendNote) {
          setSessionNote(backendNote);
          return;
        }
      } catch {}
      // Fallback a localStorage
      try {
        const draft = JSON.parse(localStorage.getItem(`dental_draft_${appointmentId}`) || '{}');
        if (draft.sessionNote) setSessionNote(draft.sessionNote);
      } catch {}
    };
    loadNote();
  }, [appointmentId]);

  // ─── HELPERS DE LECTURA (memoizados) ────────────────────────────────────────
  const toothStates = useMemo(() => {
    const states = {};
    if (!plan?.procedimientos) return states;
    plan.procedimientos.forEach(proc => {
      const tooth = proc.diente_numero;
      if (!tooth || tooth === '0') return;

      const state           = proc.estado_pipeline || 'creado';
      const currentPriority = PIPELINE_STATE_PRIORITY[states[tooth]] || 0;
      const newPriority     = PIPELINE_STATE_PRIORITY[state] || 0;

      if (newPriority > currentPriority) states[tooth] = state;

      const nombre = proc.procedimiento?.toLowerCase() || '';
      if (nombre.includes('extrac') || nombre.includes('ausente')) {
        states[tooth] = 'extraido';
      }
    });
    return states;
  }, [plan]);

  const proceduresByTooth = useMemo(() => {
    const map = {};
    if (!plan?.procedimientos) return map;
    plan.procedimientos.forEach(proc => {
      const tooth = proc.diente_numero;
      if (!map[tooth]) map[tooth] = [];
      map[tooth].push(proc);
    });
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => (b.fecha_realizado || '').localeCompare(a.fecha_realizado || ''));
    });
    return map;
  }, [plan]);

  const totals = useMemo(() => {
    const procs = plan?.procedimientos || [];
    return {
      total:      procs.reduce((s, p) => s + (p.precio || 0), 0),
      realizados: procs.filter(p => ['realizado', 'cobrado'].includes(p.estado_pipeline)).length,
      pendientes: procs.filter(p => !['realizado', 'cobrado', 'cancelado'].includes(p.estado_pipeline)).length,
      count:      procs.length,
    };
  }, [plan]);

  return {
    plan, loading, syncStatus, sessionNote,
    addProcedure, updateProcedureState, deleteProcedure,
    handleSessionNoteChange, cerrarConsulta,
    refreshPlan: () => fetchPlan(true),
    toothStates, proceduresByTooth, totals,
  };
};
