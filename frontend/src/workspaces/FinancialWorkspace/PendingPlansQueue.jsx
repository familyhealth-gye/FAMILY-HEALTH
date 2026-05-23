/**
 * PendingPlansQueue.jsx
 * Lista de planes propuestos esperando procesamiento financiero.
 */
import React from 'react';
import { Loader2, ClipboardList, Clock, User, DollarSign, ChevronRight } from 'lucide-react';

const PendingPlansQueue = ({ planes, loading, onSelectPlan, loadingPlan }) => {
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
    </div>
  );

  if (planes.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-6">
      <ClipboardList className="w-10 h-10 text-slate-200" />
      <p className="text-sm font-bold text-slate-400">Sin planes pendientes</p>
      <p className="text-[11px] text-slate-300">
        Cuando un doctor finalice una consulta, el plan aparecerá aquí.
      </p>
    </div>
  );

  return (
    <div className="p-6 space-y-3 max-w-2xl mx-auto">
      {planes.map(plan => {
        const procedimientos = plan.procedimientos || [];
        const total = procedimientos.reduce((s, p) => s + (p.precio || 0), 0);
        const propuestos = procedimientos.filter(p => p.estado_pipeline === 'propuesto').length;
        const fases = [...new Set(procedimientos.map(p => p.fase))].sort();

        return (
          <button
            key={plan.id}
            onClick={() => onSelectPlan(plan.id)}
            disabled={loadingPlan}
            className="w-full text-left bg-white border-2 border-slate-100 hover:border-amber-300
              rounded-2xl p-5 transition-all shadow-sm hover:shadow-md group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Nombre */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-black text-xs shrink-0">
                    {plan.paciente_nombre?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 leading-tight truncate">
                      {plan.paciente_nombre}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">{plan.paciente_cedula}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-3 text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" />
                    {propuestos} procedimiento{propuestos !== 1 ? 's' : ''} propuesto{propuestos !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    ${total.toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fases.length} fase{fases.length !== 1 ? 's' : ''}
                  </span>
                  {plan.doctor_nombre && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {plan.doctor_nombre}
                    </span>
                  )}
                </div>

                {/* Fecha */}
                <p className="text-[9px] text-slate-300 font-medium mt-2">
                  {plan.cerrado_at
                    ? `Enviado: ${new Date(plan.cerrado_at).toLocaleString('es-EC')}`
                    : `Creado: ${plan.fecha_creacion}`}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200 uppercase">
                  Pendiente
                </span>
                {loadingPlan
                  ? <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                  : <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                }
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default PendingPlansQueue;
