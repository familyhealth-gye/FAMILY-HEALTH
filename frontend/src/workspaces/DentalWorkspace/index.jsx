/**
 * DentalWorkspace/index.jsx
 * Orquestador principal — solo coordina, no tiene lógica de negocio.
 * Toda la lógica vive en useTreatmentPipeline y useClinicalEngine.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import DentalHeader from './DentalHeader';
import SessionForm from './LeftPanel/SessionForm';
import PreviousSessions from './LeftPanel/PreviousSessions';
import OdontogramaV2 from './CenterPanel/OdontogramaV2';
import ToothPanel from './CenterPanel/ToothPanel';
import QuickActions from './CenterPanel/QuickActions';
import ClinicalPipeline from './RightPanel/ClinicalPipeline';

import { useTreatmentPipeline } from './hooks/useTreatmentPipeline';
import { useClinicalEngine } from './hooks/useClinicalEngine';

import apiClient from '@/lib/axios';
import { History, ClipboardList, Smile } from 'lucide-react';

const DentalWorkspace = () => {
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [appointmentLoading, setAppointmentLoading] = useState(true);
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [activeTab, setActiveTab] = useState('center');

  // ─── Cargar appointment ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAppointment = async () => {
      try {
        setAppointmentLoading(true);
        const res = await apiClient.get(`/appointments/${appointmentId}`);
        setAppointment(res.data);
      } catch {
        toast.error('Error al cargar la cita');
      } finally {
        setAppointmentLoading(false);
      }
    };
    if (appointmentId) {
      fetchAppointment();
    } else {
      // Sin appointmentId — no hay cita que cargar, liberar loading
      setAppointmentLoading(false);
    }
  }, [appointmentId]);

  // ─── Pipeline hook (fuente de verdad clínica) ─────────────────────────────
  const pipeline = useTreatmentPipeline({
    appointmentId,
    pacienteCedula: appointment?.cedula || appointment?.paciente_cedula || "",
    appointment,
  });

  // ─── Clinical Engine (reglas locales + Gemini) ────────────────────────────
  const clinicalEngine = useClinicalEngine({
    paciente: appointment?.paciente_data || null,
  });

  // ─── Persistir diente seleccionado en draft local ─────────────────────────
  useEffect(() => {
    if (!appointmentId) return;
    try {
      const draft = JSON.parse(localStorage.getItem(`dental_draft_${appointmentId}`) || '{}');
      if (draft.selectedTooth) setSelectedTooth(draft.selectedTooth);
    } catch {}
  }, [appointmentId]);

  const handleSelectTooth = useCallback((tooth) => {
    setSelectedTooth(tooth);
    if (appointmentId) {
      try {
        const draft = JSON.parse(localStorage.getItem(`dental_draft_${appointmentId}`) || '{}');
        localStorage.setItem(`dental_draft_${appointmentId}`, JSON.stringify({ ...draft, selectedTooth: tooth }));
      } catch {}
    }
  }, [appointmentId]);

  // ─── Add procedure desde ToothPanel o QuickActions ───────────────────────
  const handleAddProcedure = useCallback((procData) => {
    pipeline.addProcedure(procData);
  }, [pipeline]);

  // ─── Loading state ────────────────────────────────────────────────────────
  const isLoading = appointmentLoading || pipeline.loading;

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-white font-sans">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-medical-100 border-t-medical-600 rounded-full animate-spin" />
        <div className="flex flex-col items-center">
          <p className="text-slate-800 font-black text-xs uppercase tracking-[0.3em]">Cargando Sesión</p>
          <p className="text-slate-400 text-[10px] mt-2 font-medium">Sincronizando pipeline clínico...</p>
        </div>
        {/* Fallback anti-cuelgue: si tarda más de 8 segundos, mostrar botón */}
      </div>
    </div>
  );

  // Fallback: si no hay cita válida después de cargar, mostrar mensaje
  if (!appointment && !appointmentLoading) return (
    <div className="flex h-screen items-center justify-center bg-white font-sans">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <p className="text-slate-700 font-bold text-sm">No se encontró la cita</p>
        <p className="text-slate-400 text-xs">Verifica que el ID de la cita sea correcto.</p>
        <button
          onClick={() => window.history.back()}
          className="text-xs font-bold text-medical-600 underline"
        >
          Volver a la agenda
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      <DentalHeader
        appointment={appointment}
        syncStatus={pipeline.syncStatus}
        totals={pipeline.totals}
          onCerrarConsulta={pipeline.cerrarConsulta}
      />

      <main className="flex flex-1 overflow-hidden relative">
        {/* ── Left Panel ── */}
        <aside className={`
          ${activeTab === 'left' ? 'flex' : 'hidden'} lg:flex
          w-full lg:w-[260px] border-r bg-white flex-col shrink-0
          z-20 absolute lg:relative h-full shadow-2xl lg:shadow-none
        `}>
          <SessionForm
            appointmentId={appointmentId}
            sessionNote={pipeline.sessionNote}
            onNoteChange={pipeline.handleSessionNoteChange}
            syncStatus={pipeline.syncStatus}
          />
          <PreviousSessions patientId={appointment?.paciente_id} pacienteCedula={appointment?.paciente_cedula || appointment?.cedula} />
        </aside>

        {/* ── Center Panel ── */}
        <section className={`
          ${activeTab === 'center' ? 'flex' : 'hidden md:flex'}
          flex-1 flex flex-col overflow-hidden bg-slate-50 relative z-10
        `}>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 flex flex-col items-center scrollbar-hide">
            <OdontogramaV2
              selectedTooth={selectedTooth}
              onSelectTooth={handleSelectTooth}
              toothStates={pipeline.toothStates}
            />

            {selectedTooth && (
              <ToothPanel
                tooth={selectedTooth}
                onClose={() => handleSelectTooth(null)}
                onAddProcedure={(proc) => handleAddProcedure({
                  diente_numero: selectedTooth.toString(),
                  ...proc,
                })}
                toothHistory={pipeline.proceduresByTooth[selectedTooth.toString()] || []}
                paciente={appointment?.paciente_data}
                clinicalEngine={clinicalEngine}
              />
            )}
          </div>

          <div className="p-4 md:p-6 border-t bg-white shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <QuickActions
              onAddProcedure={handleAddProcedure}
              selectedTooth={selectedTooth}
            />
          </div>
        </section>

        {/* ── Right Panel ── */}
        <aside className={`
          ${activeTab === 'right' ? 'flex' : 'hidden'} md:flex
          w-full md:w-[340px] border-l bg-white flex-col shrink-0
          z-20 absolute md:relative right-0 h-full shadow-2xl md:shadow-none
        `}>
          <ClinicalPipeline
            plan={pipeline.plan}
            onRefresh={pipeline.refreshPlan}
            appointmentId={appointmentId}
            updateProcedureState={pipeline.updateProcedureState}
            deleteProcedure={pipeline.deleteProcedure}
            totals={pipeline.totals}
          onCerrarConsulta={pipeline.cerrarConsulta}
          />
        </aside>
      </main>

      {/* ── Bottom Nav (mobile) ── */}
      <div className="md:hidden h-20 border-t bg-white flex items-center justify-around shrink-0 pb-safe z-30 px-4">
        {[
          { id: 'left',   icon: History,       label: 'Historia' },
          { id: 'center', icon: Smile,          label: 'Odonto'   },
          { id: 'right',  icon: ClipboardList,  label: 'Pipeline' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-all duration-300 ${
              activeTab === id
                ? 'text-medical-600 bg-medical-50/50 scale-105 rounded-xl'
                : 'text-slate-400'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
            {id === 'right' && pipeline.totals.pendientes > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                {pipeline.totals.pendientes}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DentalWorkspace;
