import React from 'react';
import PipelineItem from './PipelineItem';

const ClinicalPipeline = ({ plan, onRefresh }) => {
  if (!plan) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b bg-slate-50 shrink-0">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Pipeline</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm text-slate-400">No hay plan de tratamiento activo para este paciente.</p>
        </div>
      </div>
    );
  }

  const procedimientos = plan.procedimientos || [];

  // Agrupar por fase
  const fases = {};
  procedimientos.forEach(proc => {
    const faseNum = proc.fase || 1;
    if (!fases[faseNum]) fases[faseNum] = [];
    fases[faseNum].push(proc);
  });

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b bg-slate-50 shrink-0 flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Pipeline</h3>
        <span className="text-[10px] bg-medical-100 text-medical-700 px-2 py-0.5 rounded-full font-bold">
          {procedimientos.length} PROC
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.keys(fases).sort().map(faseNum => (
          <div key={faseNum} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-medical-600 bg-medical-50 px-2 py-0.5 rounded border border-medical-100">
                FASE {faseNum}
              </span>
              <div className="h-[1px] flex-1 bg-slate-100"></div>
            </div>
            <div className="space-y-3">
              {fases[faseNum].map(proc => (
                <PipelineItem
                  key={proc.id}
                  procedure={proc}
                  planId={plan.id}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
          </div>
        ))}

        {procedimientos.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-10">
            No hay procedimientos registrados en este plan.
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicalPipeline;
