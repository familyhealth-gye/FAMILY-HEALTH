import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import DentalHeader from './DentalHeader';
import SessionForm from './LeftPanel/SessionForm';
import PreviousSessions from './LeftPanel/PreviousSessions';
import OdontogramaV2 from './CenterPanel/OdontogramaV2';
import ToothPanel from './CenterPanel/ToothPanel';
import QuickActions from './CenterPanel/QuickActions';
import ClinicalPipeline from './RightPanel/ClinicalPipeline';
import apiClient from '@/lib/axios';
import { History, ClipboardList, Smile } from 'lucide-react';
import { toast } from 'sonner';

const DentalWorkspace = () => {
  const { appointmentId } = useParams();
  const [appointment, setAppointment] = useState(null);
  const [plan, setPlan] = useState(null);
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('center');

  // Recuperar borrador local
  useEffect(() => {
    const draft = localStorage.getItem(`dental_v2_draft_${appointmentId}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.selectedTooth) setSelectedTooth(parsed.selectedTooth);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
      } catch (e) {}
    }
  }, [appointmentId]);

  // Persistir estado local
  useEffect(() => {
    const draft = { selectedTooth, activeTab };
    localStorage.setItem(`dental_v2_draft_${appointmentId}`, JSON.stringify(draft));
  }, [selectedTooth, activeTab, appointmentId]);

  const fetchPlan = useCallback(async (cedula) => {
    if (!cedula) return;
    try {
      const response = await apiClient.get(`/plan-tratamiento/paciente/${cedula}`);
      if (response.data) {
        setPlan(response.data);
      } else {
        // Si no hay plan, podríamos ofrecer crear uno o manejar el estado vacío
        setPlan(null);
      }
    } catch (error) {
      console.error("Error fetching plan:", error);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const appResponse = await apiClient.get(`/appointments/${appointmentId}`);
      const appData = appResponse.data;
      setAppointment(appData);

      if (appData.paciente_cedula) {
        await fetchPlan(appData.paciente_cedula);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, fetchPlan]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddProcedure = async (procedureData) => {
    if (!plan?.id) {
      // Intentar crear un plan automático si no existe
      try {
        const newPlan = await apiClient.post(`/plan-tratamiento`, {
           paciente_id: appointment.paciente_id,
           paciente_cedula: appointment.paciente_cedula,
           paciente_nombre: appointment.paciente_nombre,
           doctor_id: appointment.doctor_id,
           doctor_nombre: appointment.doctor_nombre
        });
        const planId = newPlan.data.id;
        await apiClient.post(`/plan-tratamiento/${planId}/procedimiento`, {
          ...procedureData,
          estado_pipeline: 'creado'
        });
        fetchPlan(appointment.paciente_cedula);
        toast.success("Nuevo plan creado y procedimiento agregado");
        return;
      } catch (e) {
        toast.error("No se pudo crear un plan de tratamiento.");
        return;
      }
    }

    try {
      await apiClient.post(`/plan-tratamiento/${plan.id}/procedimiento`, {
        ...procedureData,
        estado_pipeline: 'creado'
      });
      toast.success("Agregado al pipeline");
      fetchPlan(appointment.paciente_cedula);
    } catch (error) {
      console.error("Error adding procedure:", error);
      toast.error("Error al agregar");
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-white font-sans">
      <div className="flex flex-col items-center gap-6">
        <div className="w-12 h-12 border-4 border-medical-100 border-t-medical-600 rounded-full animate-spin"></div>
        <div className="flex flex-col items-center">
          <p className="text-slate-800 font-black text-xs uppercase tracking-[0.3em]">Cargando Sesión</p>
          <p className="text-slate-400 text-[10px] mt-2 font-medium">Sincronizando pipeline clínico...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      <DentalHeader appointment={appointment} />

      <main className="flex flex-1 overflow-hidden relative">
        {/* Left Panel */}
        <aside className={`${activeTab === 'left' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[260px] border-r bg-white flex-col shrink-0 z-20 absolute lg:relative h-full shadow-2xl lg:shadow-none`}>
          <SessionForm appointment={appointment} />
          <PreviousSessions patientId={appointment?.paciente_id} />
        </aside>

        {/* Center Panel */}
        <section className={`${activeTab === 'center' ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col overflow-hidden bg-slate-50 relative z-10`}>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 flex flex-col items-center scrollbar-hide">
            <OdontogramaV2
              selectedTooth={selectedTooth}
              onSelectTooth={setSelectedTooth}
              plan={plan}
            />
            {selectedTooth && (
              <ToothPanel
                tooth={selectedTooth}
                onClose={() => setSelectedTooth(null)}
                onAddProcedure={(proc) => handleAddProcedure({ diente_numero: selectedTooth.toString(), ...proc })}
                plan={plan}
              />
            )}
          </div>
          <div className="p-4 md:p-6 border-t bg-white shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <QuickActions onAddProcedure={(proc) => handleAddProcedure(proc)} />
          </div>
        </section>

        {/* Right Panel */}
        <aside className={`${activeTab === 'right' ? 'flex' : 'hidden'} md:flex w-full md:w-[340px] border-l bg-white flex-col shrink-0 z-20 absolute md:relative right-0 h-full shadow-2xl md:shadow-none`}>
          <ClinicalPipeline
            plan={plan}
            onRefresh={() => fetchPlan(appointment.paciente_cedula)}
            appointmentId={appointmentId}
          />
        </aside>
      </main>

      {/* Navigation */}
      <div className="md:hidden h-20 border-t bg-white flex items-center justify-around shrink-0 pb-safe z-30 px-4">
        <button onClick={() => setActiveTab('left')} className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-all duration-300 ${activeTab === 'left' ? 'text-medical-600 bg-medical-50/50 scale-105 rounded-xl' : 'text-slate-400'}`}>
          <History className={`w-5 h-5 ${activeTab === 'left' ? 'animate-pulse' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Historia</span>
        </button>
        <button onClick={() => setActiveTab('center')} className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-all duration-300 ${activeTab === 'center' ? 'text-medical-600 bg-medical-50/50 scale-105 rounded-xl' : 'text-slate-400'}`}>
          <Smile className={`w-5 h-5 ${activeTab === 'center' ? 'animate-bounce' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Odonto</span>
        </button>
        <button onClick={() => setActiveTab('right')} className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-all duration-300 ${activeTab === 'right' ? 'text-medical-600 bg-medical-50/50 scale-105 rounded-xl' : 'text-slate-400'}`}>
          <ClipboardList className={`w-5 h-5 ${activeTab === 'right' ? 'animate-pulse' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-tighter">Pipeline</span>
        </button>
      </div>
    </div>
  );
};

export default DentalWorkspace;
