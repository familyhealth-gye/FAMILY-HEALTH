/**
 * ClinicalPipeline.jsx
 * Panel derecho: pipeline clínico agrupado por fases.
 * Recibe plan + acciones del hook — no tiene estado propio de datos.
 */
import React, { useState } from 'react';
import PipelineItem from './PipelineItem';
import PipelineHistoryDrawer from './PipelineHistoryDrawer';
import { Layers, History, DollarSign, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FASE_LABELS } from '../engine/clinical_rules';

const ClinicalPipeline = ({
  plan,
  onRefresh,
  appointmentId,
  updateProcedureState,
  deleteProcedure,
  totals,
}) => {
  const [showHistory, setShowHistory] = useState(false);

  if (!plan) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-slate-50 shrink-0">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Pipeline</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
          <Layers className="w-8 h-8 text-slate-200" />
          <p className="text-sm text-slate-400 font-medium">Sin plan activo</p>
          <p className="text-[10px] text-slate-300">
            Selecciona una pieza del odontograma para comenzar
          </p>
        </div>
      </div>
    );
  }

  const procedimientos = plan.procedimientos || [];

  // Agrupar por fase
  const faseMap = {};
  procedimientos.forEach(proc => {
    const f = proc.fase || 1;
    if (!faseMap[f]) faseMap[f] = [];
    faseMap[f].push(proc);
  });

  return (
    <div className="flex flex-col h-full bg-white shadow-inner relative">

      {/* ── Header ── */}
      <div className="p-4 border-b bg-slate-50 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-medical-600" />
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Clinical Pipeline
            </h3>
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8 rounded-full text-slate-400 hover:text-medical-600"
            onClick={() => setShowHistory(true)}
            title="Ver historial del plan"
          >
            <History className="w-4 h-4" />
          </Button>
        </div>

        {/* Totales compactos */}
        {totals && totals.count > 0 && (
          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {totals.pendientes} pendientes
            </div>
            <div className="h-3 w-px bg-slate-200" />
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              <span className="text-slate-700">${totals.total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Lista por fases ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        {Object.keys(faseMap).sort((a, b) => Number(a) - Number(b)).map(faseNum => (
          <div key={faseNum} className="space-y-3">
            <div className="flex items-center gap-2 sticky top-0 bg-white/90 backdrop-blur-sm py-1 z-10">
              <span className="text-[9px] font-black text-medical-700 bg-medical-50 px-2 py-0.5 rounded border border-medical-100 uppercase whitespace-nowrap">
                Fase {faseNum}
              </span>
              <span className="text-[9px] text-slate-400 font-medium truncate">
                {FASE_LABELS[Number(faseNum)] || ''}
              </span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>

            <div className="space-y-2.5 pl-2 border-l-2 border-slate-50 ml-2">
              {faseMap[faseNum].map(proc => (
                <PipelineItem
                  key={proc.id}
                  procedure={proc}
                  planId={plan.id}
                  appointmentId={appointmentId}
                  onUpdateState={updateProcedureState}
                  onDelete={deleteProcedure}
                />
              ))}
            </div>
          </div>
        ))}

        {procedimientos.length === 0 && (
          <div className="text-sm text-slate-300 text-center py-20 italic">
            Sin procedimientos registrados.
          </div>
        )}
      </div>

      <PipelineHistoryDrawer
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        plan={plan}
      />
    </div>
  );
};

export default ClinicalPipeline;
