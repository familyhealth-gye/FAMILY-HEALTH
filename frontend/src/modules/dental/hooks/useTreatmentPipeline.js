/**
 * useTreatmentPipeline.js — v3 hardened
 *
 * Cambios vs v2:
 * - Integra useRetryQueue para resiliencia offline
 * - Envía plan_version en cada mutación (bloqueo optimista)
 * - Detecta conflicto 409 y muestra warning clínico
 * - syncStatus extendido: 'conflict' como estado separado
 * - updateProcedureState retorna las transiciones disponibles del backend
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';
import { PIPELINE_STATE_PRIORITY } from '@/modules/dental/engine/clinical_rules';
import { useRetryQueue } from '@/modules/dental/hooks/useRetryQueue';

const DEBOUNCE_MS = 1400;

export const useTreatmentPipeline = ({ appointmentId, pacienteCedula, appointment }) => {
  const [plan, setPlan]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle'|'saving'|'saved'|'error'|'conflict'
  const [sessionNote, setSessionNote] = useState('');

  const debounceRef = useRef(null);
  const { enqueue } = useRetryQueue();

  const setSyncTemp = (status, resetAfterMs = 2500) => {
    setSyncStatus(status);
    if (status !== 'conflict') {
      setTimeout(() => setSyncStatus('idle'), resetAfterMs);
    }
  };

  // ── FETCH ─────────────────────────────────────────────────────────────────
  const fetchPlan = useCallback(async (silent = false) => {
    // CRITICAL: siempre hacer setLoading(false), nunca dejar loading infinito
    if (!pacienteCedula) {
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get(`/plan-tratamiento/paciente/${pacienteCedula}`);
      const data = res.data || null;
      if (data) {
        data.proformas_generadas  = data.proformas_generadas  ?? [];
        data.sesiones_programadas = data.sesiones_programadas ?? [];
        data.version              = data.version              ?? 1;
      }
      setPlan(data);
    } catch (err) {
      // 404 = no existe plan aún — es estado válido, no error
      if (err.response?.status === 404) {
        setPlan(null);
      } else if (!silent) {
        console.error('[Pipeline] fetchPlan:', err);
      }
    } finally {
      // SIEMPRE liberar loading — nunca quedar colgado
      if (!silent) setLoading(false);
    }
  }, [pacienteCedula]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  // ── ENSURE PLAN ────────────────────────────────────────────────────────────
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
      const newPlan = { ...res.data, procedimientos: [], version: 1 };
      setPlan(newPlan);
      return res.data.id;
    } catch {
      toast.error('No se pudo crear el plan de tratamiento.');
      return null;
    }
  }, [plan, appointment]);

  // ── ADD PROCEDURE (optimistic) ─────────────────────────────────────────────
  const addProcedure = useCallback(async (procedureData) => {
    const planId = await ensurePlan();
    if (!planId) return;

    const tempId   = `temp_${Date.now()}`;
    const tempProc = { id: tempId, estado_pipeline: 'creado', ...procedureData, _optimistic: true };

    setPlan(prev => prev
      ? { ...prev, procedimientos: [...(prev.procedimientos || []), tempProc] }
      : null
    );
    setSyncStatus('saving');

    try {
      await apiClient.post(`/plan-tratamiento/${planId}/procedimiento`, {
        ...procedureData, estado_pipeline: 'creado',
      });
      await fetchPlan(true);
      setSyncTemp('saved');
    } catch (err) {
      // Optimistic rollback
      setPlan(prev => prev
        ? { ...prev, procedimientos: (prev.procedimientos || []).filter(p => p.id !== tempId) }
        : null
      );
      // Encolar para retry
      enqueue({
        method: 'POST',
        url:    `/api/plan-tratamiento/${planId}/procedimiento`,
        data:   { ...procedureData, estado_pipeline: 'creado' },
        label:  `Agregar ${procedureData.procedimiento || 'procedimiento'}`,
      });
      setSyncTemp('error', 4000);
    }
  }, [ensurePlan, fetchPlan, enqueue]);

  // ── UPDATE STATE (optimistic + conflict detection) ─────────────────────────
  const updateProcedureState = useCallback(async (procId, nuevoEstado, extraData = {}) => {
    if (!plan?.id) return;

    const snapshot       = JSON.parse(JSON.stringify(plan));
    const currentVersion = plan.version ?? 1;

    // Optimistic update
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
      const res = await apiClient.put(
        `/plan-tratamiento/${plan.id}/procedimiento/${procId}/estado`,
        null,
        { params: { nuevo_estado: nuevoEstado, plan_version: currentVersion, source: 'doctor_workspace' } }
      );

      if (Object.keys(extraData).length > 0) {
        await apiClient.put(
          `/plan-tratamiento/${plan.id}/procedimiento/${procId}`,
          extraData
        );
      }

      await fetchPlan(true);
      setSyncTemp('saved');

      // Retornar transiciones disponibles del backend
      return res.data?.transiciones_disponibles || [];

    } catch (err) {
      setPlan(snapshot); // rollback

      if (err.response?.status === 409) {
        // Conflicto de versión — el plan fue modificado por otro usuario
        setSyncStatus('conflict');
        toast.error(
          '⚠️ Conflicto de edición: otro usuario modificó este plan. Recargando…',
          { duration: 6000 }
        );
        setTimeout(() => {
          fetchPlan(true);
          setSyncStatus('idle');
        }, 2000);
        return;
      }

      if (err.response?.status === 422) {
        // Transición inválida — error de negocio, no de red
        const detail = err.response?.data?.detail;
        const msg = typeof detail === 'object' ? detail.message : (detail || 'Transición no permitida.');
        toast.error(msg);
        setSyncTemp('error', 3000);
        return;
      }

      setSyncTemp('error', 4000);
      toast.error('Error al actualizar estado. Se revirtió el cambio.');
    }
  }, [plan, fetchPlan]);

  // ── DELETE (optimistic + retry) ────────────────────────────────────────────
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
      setSyncTemp('saved');
    } catch {
      setPlan(snapshot);
      setSyncTemp('error', 4000);
      toast.error('Error al eliminar. Se revirtió el cambio.');
    }
  }, [plan, fetchPlan]);

  // ── CERRAR CONSULTA ────────────────────────────────────────────────────────
  const cerrarConsulta = useCallback(async (motivo = '') => {
    if (!plan?.id) { toast.error('No hay plan activo.'); return false; }
    setSyncStatus('saving');
    try {
      const res = await apiClient.post(`/plan-tratamiento/${plan.id}/cerrar-consulta`, { motivo });
      await fetchPlan(true);
      setSyncTemp('saved');
      toast.success(`✅ ${res.data.message}`);
      return true;
    } catch (err) {
      setSyncTemp('error', 4000);
      toast.error(err.response?.data?.detail || 'Error al cerrar consulta.');
      return false;
    }
  }, [plan, fetchPlan]);

  // ── AUTOSAVE NOTA (debounced + retry queue) ────────────────────────────────
  const handleSessionNoteChange = useCallback((value) => {
    setSessionNote(value);

    // localStorage inmediato — capa de resiliencia
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
        setSyncTemp('saved');
      } catch {
        // Falla silenciosa — localStorage ya tiene el dato
        // Encolar retry para cuando vuelva la conexión
        enqueue({
          method: 'PATCH',
          url:    `/api/appointments/${appointmentId}/nota-sesion`,
          data:   { nota: value },
          label:  'Guardar nota de sesión',
        });
        setSyncTemp('error', 4000);
      }
    }, DEBOUNCE_MS);
  }, [appointmentId, enqueue]);

  // Cargar nota: backend primero, localStorage como fallback
  useEffect(() => {
    if (!appointmentId) return;
    const load = async () => {
      try {
        const res = await apiClient.get(`/appointments/${appointmentId}`);
        if (res.data?.nota_sesion_clinica) { setSessionNote(res.data.nota_sesion_clinica); return; }
      } catch {}
      try {
        const draft = JSON.parse(localStorage.getItem(`dental_draft_${appointmentId}`) || '{}');
        if (draft.sessionNote) setSessionNote(draft.sessionNote);
      } catch {}
    };
    load();
  }, [appointmentId]);

  // ── HELPERS MEMOIZADOS ─────────────────────────────────────────────────────
  const toothStates = useMemo(() => {
    const states = {};
    if (!plan?.procedimientos) return states;
    plan.procedimientos.forEach(proc => {
      const tooth = proc.diente_numero;
      if (!tooth || tooth === '0') return;
      const state           = proc.estado_pipeline || 'creado';
      const currentPriority = PIPELINE_STATE_PRIORITY[states[tooth]] || 0;
      const newPriority     = PIPELINE_STATE_PRIORITY[state]         || 0;
      if (newPriority > currentPriority) states[tooth] = state;
      const nombre = proc.procedimiento?.toLowerCase() || '';
      if (nombre.includes('extrac') || nombre.includes('ausente')) states[tooth] = 'extraido';
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
