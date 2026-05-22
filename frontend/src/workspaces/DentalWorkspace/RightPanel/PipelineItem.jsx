import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Clock, Trash2, Calendar,
  DollarSign, ChevronRight, AlertTriangle, PlayCircle
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const PipelineItem = ({ procedure, planId, onRefresh, currentAppointmentId }) => {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [availableAppointments, setAvailableAppointments] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const getBadgeStyles = (state) => {
    switch (state) {
      case 'realizado': return 'bg-green-500 text-white border-transparent';
      case 'cobrado': return 'bg-teal-500 text-white border-transparent';
      case 'aprobado': return 'bg-amber-500 text-white border-transparent';
      case 'programado': return 'bg-blue-500 text-white border-transparent';
      case 'cancelado': return 'bg-red-500 text-white border-transparent';
      case 'creado': return 'bg-slate-500 text-white border-transparent';
      case 'propuesto': return 'bg-indigo-500 text-white border-transparent';
      default: return 'bg-slate-400 text-white border-transparent';
    }
  };

  const updateStatus = async (newStatus, extraData = {}) => {
    try {
      // 1. Actualizar estado
      let url = `/plan-tratamiento/${planId}/procedimiento/${procedure.id}/estado?nuevo_estado=${newStatus}`;
      await apiClient.put(url);

      // 2. Actualizar otros campos mediante el endpoint de actualización de procedimiento general
      if (Object.keys(extraData).length > 0) {
        await apiClient.put(`/plan-tratamiento/${planId}/procedimiento/${procedure.id}`, extraData);
      }

      toast.success(`Estado: ${newStatus}`);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al actualizar");
    }
  };

  const handleOpenSchedule = async () => {
    setLoadingSchedule(true);
    try {
      const res = await apiClient.get(`/appointments`);
      const filtered = res.data.filter(a =>
        (a.estado === 'Programada' || a.estado === 'Pendiente' || a.estado === 'En Atención') &&
        a.id !== currentAppointmentId
      );
      setAvailableAppointments(filtered);
      setShowScheduleModal(true);
    } catch (e) {
      toast.error("Error al cargar citas");
    } finally {
      setLoadingSchedule(false);
    }
  };

  const scheduleProcedure = async (appId) => {
    try {
      await updateStatus('programado', { sesion_appointment_id: appId });
      setShowScheduleModal(false);
    } catch (e) {}
  };

  const isCurrentSession = procedure.sesion_appointment_id === currentAppointmentId;

  return (
    <div className={`p-3 border-2 rounded-xl bg-white shadow-sm hover:shadow-md transition-all group relative ${isCurrentSession ? 'border-medical-300 ring-2 ring-medical-50 ring-inset' : 'border-slate-50'}`}>
      {isCurrentSession && (
        <div className="absolute -top-2 -right-2 bg-medical-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
          ESTA SESIÓN
        </div>
      )}

      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-800 text-white rounded text-[10px] font-bold flex items-center justify-center">
            {procedure.diente_numero === "0" ? "G" : procedure.diente_numero}
          </div>
          <Badge className={`text-[8px] px-1.5 py-0 h-4 font-black uppercase tracking-tighter ${getBadgeStyles(procedure.estado_pipeline)}`}>
            {procedure.estado_pipeline || 'creado'}
          </Badge>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <button className="text-slate-300 hover:text-red-500" onClick={async () => {
             if (window.confirm("¿Eliminar?")) {
               await apiClient.delete(`/plan-tratamiento/${planId}/procedimiento/${procedure.id}`);
               onRefresh();
             }
           }}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      <h4 className="text-[11px] font-bold text-slate-800 leading-tight mb-1">{procedure.procedimiento}</h4>

      {procedure.superficies_afectadas?.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mb-2">
          {procedure.superficies_afectadas.map(s => (
            <span key={s} className="text-[8px] bg-red-50 text-red-600 px-1 font-bold rounded border border-red-100">{s}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
        <div className="flex flex-col">
          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
            <DollarSign className="w-2.5 h-2.5" />
            {procedure.precio}
          </div>
          {procedure.sesion_appointment_id && (
            <div className="flex items-center gap-1 mt-1 text-[8px] font-bold text-medical-600">
              <Calendar className="w-2.5 h-2.5" />
              {isCurrentSession ? 'En ejecución' : 'Programado'}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {procedure.estado_pipeline === 'creado' && (
             <button onClick={() => updateStatus('propuesto')} className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold hover:bg-indigo-700 shadow-sm">PROPONER</button>
          )}
          {procedure.estado_pipeline === 'propuesto' && (
             <button onClick={() => updateStatus('aprobado')} className="text-[9px] bg-amber-600 text-white px-2 py-0.5 rounded font-bold hover:bg-amber-700 shadow-sm">APROBAR</button>
          )}
          {procedure.estado_pipeline === 'aprobado' && (
             <Button variant="outline" size="sm" className="h-6 px-2 text-[9px] font-bold border-blue-200 text-blue-700 hover:bg-blue-50" onClick={handleOpenSchedule}>
               <Calendar className="w-3 h-3 mr-1" /> PROGRAMAR
             </Button>
          )}
          {(procedure.estado_pipeline === 'programado' || isCurrentSession || (procedure.estado_pipeline === 'aprobado' && isCurrentSession)) && procedure.estado_pipeline !== 'realizado' && procedure.estado_pipeline !== 'cobrado' && (
            <button onClick={() => updateStatus('realizado', { ejecutado_en_sesion: currentAppointmentId })} className="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm">
              <CheckCircle2 className="w-3 h-3" /> LISTO
            </button>
          )}
        </div>
      </div>

      {/* Modal de Programación */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800">Programar Procedimiento</DialogTitle>
          </DialogHeader>
          <div className="py-2">
             <p className="text-[11px] text-slate-500 mb-4 font-medium">Asocie este tratamiento a una sesión:</p>
             <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
               <button
                  onClick={() => scheduleProcedure(currentAppointmentId)}
                  className="w-full flex items-center justify-between p-3 border-2 border-medical-100 bg-medical-50/30 rounded-xl hover:bg-medical-50 transition-all text-left"
               >
                 <div>
                    <div className="text-xs font-bold text-medical-800 underline decoration-medical-200 underline-offset-2">Esta sesión (Actual)</div>
                    <div className="text-[10px] text-medical-600 font-medium">Realizar durante la atención de hoy</div>
                 </div>
                 <PlayCircle className="w-5 h-5 text-medical-600" />
               </button>

               {availableAppointments.map(app => (
                 <button
                    key={app.id}
                    onClick={() => scheduleProcedure(app.id)}
                    className="w-full flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-medical-500 hover:bg-medical-50 transition-all text-left"
                 >
                   <div>
                      <div className="text-xs font-bold text-slate-800">{app.fecha} • {app.hora}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{app.doctor_nombre || 'Doctor sin asignar'}</div>
                   </div>
                   <ChevronRight className="w-4 h-4 text-slate-300" />
                 </button>
               ))}

               {availableAppointments.length === 0 && (
                 <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                   <AlertTriangle className="w-6 h-6 text-amber-300 mx-auto mb-2 opacity-50" />
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">No se encontraron otras citas programadas</p>
                 </div>
               )}
             </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" size="sm" className="text-xs font-bold text-slate-400" onClick={() => setShowScheduleModal(false)}>CANCELAR</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PipelineItem;
