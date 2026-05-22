import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Trash2, Calendar, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';

const PipelineItem = ({ procedure, planId, onRefresh }) => {
  const getBadgeStyles = (state) => {
    switch (state) {
      case 'realizado': return 'bg-green-500 text-white border-transparent';
      case 'cobrado': return 'bg-teal-500 text-white border-transparent';
      case 'propuesto': return 'bg-blue-500 text-white border-transparent';
      case 'programado': return 'bg-purple-500 text-white border-transparent';
      case 'cancelado': return 'bg-red-500 text-white border-transparent';
      case 'creado': return 'bg-slate-500 text-white border-transparent';
      default: return 'bg-slate-400 text-white border-transparent';
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      await apiClient.put(`/plan-tratamiento/${planId}/procedimiento/${procedure.id}/estado?nuevo_estado=${newStatus}`);
      toast.success(`Estado actualizado`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar estado");
    }
  };

  const deleteProcedure = async () => {
    if (!window.confirm("¿Eliminar este procedimiento?")) return;
    try {
      await apiClient.delete(`/plan-tratamiento/${planId}/procedimiento/${procedure.id}`);
      toast.success("Procedimiento eliminado");
      onRefresh();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="p-3 border-2 border-slate-50 rounded-xl bg-white shadow-sm hover:shadow-md hover:border-medical-100 transition-all group relative">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-800 text-white rounded text-[10px] font-bold flex items-center justify-center">
            {procedure.diente_numero === "0" ? "G" : procedure.diente_numero}
          </div>
          <Badge className={`text-[8px] px-1.5 py-0 h-4 font-black uppercase tracking-tighter ${getBadgeStyles(procedure.estado_pipeline)}`}>
            {procedure.estado_pipeline || 'creado'}
          </Badge>
        </div>
        <button
          onClick={deleteProcedure}
          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <h4 className="text-[11px] font-bold text-slate-800 leading-tight mb-1">{procedure.procedimiento}</h4>

      {procedure.superficies_afectadas?.length > 0 && (
        <div className="flex gap-1 mb-2">
          {procedure.superficies_afectadas.map(s => (
            <span key={s} className="text-[8px] bg-red-50 text-red-600 px-1 font-bold rounded border border-red-100">{s}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
            <DollarSign className="w-2.5 h-2.5" />
            {procedure.precio}
          </span>
        </div>

        <div className="flex gap-1">
          {procedure.estado_pipeline === 'creado' && (
             <button
                onClick={() => updateStatus('propuesto')}
                className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold hover:bg-blue-700"
              >
                PROPONER
              </button>
          )}
          {(procedure.estado_pipeline === 'propuesto' || procedure.estado_pipeline === 'programado') && (
            <button
              onClick={() => updateStatus('realizado')}
              className="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded font-bold hover:bg-green-700"
            >
              COMPLETAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineItem;
