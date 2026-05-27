/**
 * PipelineItem.jsx
 * Tarjeta individual de un procedimiento en el pipeline.
 *
 * Cambios vs versión anterior:
 * - Usa onUpdateState/onDelete del hook (no llama a apiClient directamente)
 * - Una sola llamada por transición (antes eran dos)
 * - Modal de programación sigue aquí (es UI local)
 * - Sigue compatible con el modal de citas existente
 */
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, Trash2, Calendar, DollarSign,
  ChevronRight, AlertTriangle, PlayCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import apiClient from '@/lib/axios';
import { PIPELINE_STATE_CONFIG } from '../engine/clinical_rules';

const PipelineItem = ({ procedure, planId, appointmentId, onUpdateState, onDelete }) => {
  const [showSchedule, setShowSchedule]       = useState(false);
  const [appointments, setAppointments]       = useState([]);
  const [loadingAppts, setLoadingAppts]       = useState(false);

  const cfg            = PIPELINE_STATE_CONFIG[procedure.estado_pipeline] || PIPELINE_STATE_CONFIG.creado;
  const isThisSession  = procedure.sesion_appointment_id === appointmentId;

  const handleOpenSchedule = async () => {
    setLoadingAppts(true);
    try {
      const res      = await apiClient.get('/appointments');
      const filtered = res.data.filter(a =>
        ['Programada', 'Pendiente', 'En Atención'].includes(a.estado) &&
        a.id !== appointmentId
      );
      setAppointments(filtered);
      setShowSchedule(true);
    } catch {
      toast.error('Error al cargar citas');
    } finally {
      setLoadingAppts(false);
    }
  };

  const scheduleToAppointment = (apptId) => {
    onUpdateState(procedure.id, 'programado', { sesion_appointment_id: apptId });
    setShowSchedule(false);
  };

  const confirmDelete = () => {
    if (window.confirm('¿Eliminar este procedimiento del pipeline?')) {
      onDelete(procedure.id);
    }
  };

  return (
    <div className={`
      p-3 border-2 rounded-xl bg-white shadow-sm hover:shadow-md transition-all group relative
      ${isThisSession ? 'border-medical-300 ring-2 ring-medical-50 ring-inset' : 'border-slate-50'}
    `}>
      {isThisSession && (
        <div className="absolute -top-2 -right-2 bg-medical-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
          ESTA SESIÓN
        </div>
      )}

      {/* ── Top row: diente + estado + eliminar ── */}
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-800 text-white rounded text-[10px] font-bold flex items-center justify-center">
            {procedure.diente_numero === '0' ? 'G' : procedure.diente_numero}
          </div>
          <Badge className={`text-[8px] px-1.5 py-0 h-4 font-black uppercase tracking-tighter ${cfg.color} border-transparent text-white`}>
            {cfg.label}
          </Badge>
        </div>
        <button
          className="text-slate-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          onClick={confirmDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Nombre del procedimiento ── */}
      <h4 className="text-[11px] font-bold text-slate-800 leading-tight mb-1">
        {procedure.procedimiento}
      </h4>

      {/* ── Superficies ── */}
      {procedure.superficies_afectadas?.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mb-1.5">
          {procedure.superficies_afectadas.map(s => (
            <span key={s} className="text-[8px] bg-red-50 text-red-600 px-1 font-bold rounded border border-red-100">{s}</span>
          ))}
        </div>
      )}

      {/* ── Footer: precio + acciones ── */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-50">
        <div className="flex flex-col gap-0.5">
          {procedure.precio > 0 && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
              <DollarSign className="w-2.5 h-2.5" />
              {procedure.precio}
            </div>
          )}
          {procedure.sesion_appointment_id && (
            <div className="flex items-center gap-1 text-[8px] font-bold text-medical-600">
              <Calendar className="w-2.5 h-2.5" />
              {isThisSession ? 'En ejecución' : 'Programado'}
            </div>
          )}
        </div>

        {/* Acciones por estado — alineadas con pipeline_transitions.py del backend
            Grafo:
              creado     → propuesto   (Doctor/Admin)
              propuesto  → aprobado    (Recepcion/Admin)   ← Doctor NO puede aprobar
              aprobado   → en_ejecucion (Doctor/Admin)     ← "Iniciar" reemplaza salto inválido
              en_ejecucion → realizado (Doctor/Admin)      ← "LISTO"
        */}
        <div className="flex gap-1">
          {procedure.estado_pipeline === 'creado' && (
            <button
              onClick={() => onUpdateState(procedure.id, 'propuesto')}
              className="text-[9px] bg-indigo-600 text-white px-2 py-1 rounded font-bold hover:bg-indigo-700 shadow-sm"
            >
              PROPONER
            </button>
          )}
          {procedure.estado_pipeline === 'propuesto' && (
            <button
              onClick={() => onUpdateState(procedure.id, 'aprobado')}
              className="text-[9px] bg-amber-600 text-white px-2 py-1 rounded font-bold hover:bg-amber-700 shadow-sm"
              title="Aprobación realizada por Recepción o Admin"
            >
              APROBAR
            </button>
          )}
          {procedure.estado_pipeline === 'aprobado' && (
            <>
              <button
                onClick={() => onUpdateState(procedure.id, 'en_ejecucion', { sesion_appointment_id: appointmentId })}
                className="text-[9px] bg-blue-600 text-white px-2 py-1 rounded font-bold hover:bg-blue-700 shadow-sm flex items-center gap-1"
                title="Iniciar ejecución en esta sesión"
              >
                <PlayCircle className="w-3 h-3" /> INICIAR
              </button>
              <Button
                variant="outline" size="sm"
                className="h-6 px-2 text-[9px] font-bold border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={handleOpenSchedule}
                disabled={loadingAppts}
              >
                <Calendar className="w-3 h-3 mr-1" />
                PROG.
              </Button>
            </>
          )}
          {procedure.estado_pipeline === 'programado' && (
            <button
              onClick={() => onUpdateState(procedure.id, 'en_ejecucion', { sesion_appointment_id: appointmentId })}
              className="text-[9px] bg-blue-600 text-white px-2 py-1 rounded font-bold hover:bg-blue-700 shadow-sm flex items-center gap-1"
            >
              <PlayCircle className="w-3 h-3" /> INICIAR
            </button>
          )}
          {procedure.estado_pipeline === 'en_ejecucion' && (
            <button
              onClick={() => onUpdateState(procedure.id, 'realizado', { ejecutado_en_sesion: appointmentId })}
              className="text-[9px] bg-green-600 text-white px-2 py-1 rounded font-bold hover:bg-green-700 flex items-center gap-1 shadow-sm"
            >
              <CheckCircle2 className="w-3 h-3" /> LISTO
            </button>
          )}
        </div>
      </div>

      {/* ── Modal de programación ── */}
      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-800">Programar en sesión</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-72 overflow-y-auto pr-1">
            {/* Esta sesión */}
            <button
              onClick={() => scheduleToAppointment(appointmentId)}
              className="w-full flex items-center justify-between p-3 border-2 border-medical-100 bg-medical-50/30 rounded-xl hover:bg-medical-50 transition-all text-left"
            >
              <div>
                <div className="text-xs font-bold text-medical-800">Esta sesión (Actual)</div>
                <div className="text-[10px] text-medical-600 font-medium">Realizar durante la atención de hoy</div>
              </div>
              <PlayCircle className="w-5 h-5 text-medical-600" />
            </button>

            {/* Otras citas */}
            {appointments.map(app => (
              <button
                key={app.id}
                onClick={() => scheduleToAppointment(app.id)}
                className="w-full flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-medical-400 hover:bg-medical-50 transition-all text-left"
              >
                <div>
                  <div className="text-xs font-bold text-slate-800">{app.fecha} · {app.hora}</div>
                  <div className="text-[10px] text-slate-400 font-medium">{app.doctor_nombre || 'Doctor sin asignar'}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            ))}

            {appointments.length === 0 && !loadingAppts && (
              <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                <AlertTriangle className="w-6 h-6 text-amber-300 mx-auto mb-2 opacity-50" />
                <p className="text-[10px] text-slate-400 font-bold uppercase">Sin otras citas disponibles</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="text-xs text-slate-400" onClick={() => setShowSchedule(false)}>
              CANCELAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PipelineItem;
