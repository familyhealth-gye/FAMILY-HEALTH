import React, { useState } from 'react';
import PipelineItem from './PipelineItem';
import PipelineHistoryDrawer from './PipelineHistoryDrawer';
import { Layers, History, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ClinicalPipeline = ({ plan, onRefresh, appointmentId }) => {
  const [showHistory, setShowHistory] = useState(false);

  if (!plan) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-slate-50 shrink-0">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Pipeline</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Layers className="w-8 h-8 text-slate-200 mb-2" />
          <p className="text-sm text-slate-400 font-medium">No hay plan activo</p>
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
    <div className="flex flex-col h-full bg-white shadow-inner relative">
      <div className="p-4 border-b bg-slate-50 shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-medical-600" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Clinical Pipeline</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full text-slate-400 hover:text-medical-600"
          onClick={() => setShowHistory(true)}
          title="Ver historial del plan"
        >
          <History className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        {Object.keys(fases).sort().map(faseNum => (
          <div key={faseNum} className="space-y-3">
            <div className="flex items-center gap-2 sticky top-0 bg-white/80 backdrop-blur-sm py-1 z-10">
              <span className="text-[10px] font-black text-medical-700 bg-medical-50 px-2 py-0.5 rounded border border-medical-100 shadow-sm uppercase">
                Fase {faseNum}
              </span>
              <div className="h-[1px] flex-1 bg-slate-100"></div>
            </div>
            <div className="space-y-3 pl-2 border-l-2 border-slate-50 ml-2">
              {fases[faseNum].map(proc => (
                <PipelineItem
                  key={proc.id}
                  procedure={proc}
                  planId={plan.id}
                  onRefresh={onRefresh}
                  currentAppointmentId={appointmentId}
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
