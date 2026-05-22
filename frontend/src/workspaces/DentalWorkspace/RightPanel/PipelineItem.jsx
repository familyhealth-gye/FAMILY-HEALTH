import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, MoreVertical } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';

const PipelineItem = ({ procedure, planId, onRefresh }) => {
  const getBadgeColor = (state) => {
    switch (state) {
      case 'realizado': return 'bg-green-100 text-green-700 border-green-200';
      case 'cobrado': return 'bg-teal-100 text-teal-700 border-teal-200';
      case 'propuesto': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'cancelado': return 'bg-red-100 text-red-700 border-red-200';
      case 'creado': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      await apiClient.put(`/plan-tratamiento/${planId}/procedimiento/${procedure.id}/estado?nuevo_estado=${newStatus}`);
      toast.success(`Estado actualizado a ${newStatus}`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar estado");
    }
  };

  return (
    <div className="p-3 border rounded-lg bg-white shadow-sm hover:border-medical-200 transition-all group relative">
      <div className="flex justify-between items-start mb-1">
        <span className="text-[10px] font-bold text-slate-400">Pieza {procedure.diente_numero}</span>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 uppercase ${getBadgeColor(procedure.estado_pipeline)}`}>
            {procedure.estado_pipeline || 'creado'}
          </Badge>
        </div>
      </div>
      <h4 className="text-xs font-semibold text-slate-800 leading-tight">{procedure.procedimiento}</h4>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          {procedure.estado_pipeline === 'realizado' || procedure.estado_pipeline === 'cobrado' ? (
            <CheckCircle2 className="w-3 h-3 text-green-500" />
          ) : (
            <Clock className="w-3 h-3 text-slate-400" />
          )}
          <span className="text-[10px] font-medium text-slate-500">
            {procedure.estado_pipeline === 'realizado' ? 'Completado' :
             procedure.estado_pipeline === 'cobrado' ? 'Pagado' : 'Pendiente'}
          </span>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {procedure.estado_pipeline !== 'realizado' && procedure.estado_pipeline !== 'cobrado' && (
            <button
              onClick={() => updateStatus('realizado')}
              className="text-[9px] bg-green-500 text-white px-2 py-0.5 rounded hover:bg-green-600 font-bold"
            >
              MARCAR LISTO
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PipelineItem;
