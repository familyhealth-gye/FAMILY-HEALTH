/**
 * FinancialWorkspace/index.jsx
 * Vista del Counter/Recepción — lee el mismo PlanTratamiento que el doctor.
 * NO duplica lógica del pipeline. Solo operaciones financieras.
 *
 * Flujo: Cola → Ver Plan → Aprobar Fases → Generar Proforma
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';
import PendingPlansQueue from './PendingPlansQueue';
import PlanFinancialView from './PlanFinancialView';
import { ENABLE_DENTAL_V2 } from '@/lib/constants';

const FinancialWorkspace = () => {
  const [planes, setPlanes]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loadingPlan, setLoadingPlan]   = useState(false);

  if (!ENABLE_DENTAL_V2) return null;

  const fetchCola = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/plan-tratamiento/cola-financiera');
      setPlanes(res.data || []);
    } catch {
      toast.error('Error al cargar la cola financiera');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCola(); }, [fetchCola]);

  const handleSelectPlan = async (planId) => {
    setLoadingPlan(true);
    try {
      const res = await apiClient.get(`/plan-tratamiento/${planId}`);
      setSelectedPlan(res.data);
    } catch {
      toast.error('Error al cargar el plan');
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleBack = () => {
    setSelectedPlan(null);
    fetchCola(); // refrescar cola al volver
  };

  const handlePlanUpdated = async () => {
    if (!selectedPlan?.id) return;
    const res = await apiClient.get(`/plan-tratamiento/${selectedPlan.id}`);
    setSelectedPlan(res.data);
    fetchCola();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans">
      {/* Header */}
      <div className="h-14 bg-white border-b flex items-center px-6 gap-3 shrink-0 shadow-sm">
        {selectedPlan && (
          <button
            onClick={handleBack}
            className="text-slate-400 hover:text-slate-700 transition-colors mr-2"
          >
            ← Cola
          </button>
        )}
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        <h1 className="text-sm font-black text-slate-700 uppercase tracking-wider">
          {selectedPlan ? `Plan: ${selectedPlan.paciente_nombre}` : 'Área Financiera · Cola de Planes'}
        </h1>
        {!selectedPlan && (
          <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            {planes.length} pendientes
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {!selectedPlan ? (
          <PendingPlansQueue
            planes={planes}
            loading={loading}
            onSelectPlan={handleSelectPlan}
            loadingPlan={loadingPlan}
          />
        ) : (
          <PlanFinancialView
            plan={selectedPlan}
            onPlanUpdated={handlePlanUpdated}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default FinancialWorkspace;
