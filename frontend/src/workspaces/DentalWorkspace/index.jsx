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

  const fetchPlan = useCallback(async (cedula) => {
    if (!cedula) return;
    try {
      const response = await apiClient.get(`/plan-tratamiento/paciente/${cedula}`);
      if (response.data) {
        setPlan(response.data);
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
      toast.error("Error al cargar datos de la cita");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, fetchPlan]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddProcedure = async (procedureData) => {
    if (!plan?.id) {
      toast.error("No hay un plan de tratamiento activo para este paciente.");
      return;
    }

    try {
      await apiClient.post(`/plan-tratamiento/${plan.id}/procedimiento`, {
        ...procedureData,
        estado_pipeline: 'creado'
      });
      toast.success("Procedimiento agregado al pipeline");
      fetchPlan(appointment.paciente_cedula);
    } catch (error) {
      console.error("Error adding procedure:", error);
      toast.error("Error al agregar procedimiento");
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-white">Cargando Workspace...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden text-slate-900 font-sans">
      <DentalHeader appointment={appointment} />

      <main className="flex flex-1 overflow-hidden relative">
        <aside className={`${activeTab === 'left' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[260px] border-r bg-white flex-col shrink-0 z-20 absolute lg:relative h-full`}>
          <SessionForm appointment={appointment} />
          <PreviousSessions patientId={appointment?.paciente_id} />
        </aside>

        <section className={`${activeTab === 'center' ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col overflow-hidden bg-slate-50`}>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center">
            <OdontogramaV2
              selectedTooth={selectedTooth}
              onSelectTooth={setSelectedTooth}
            />
            {selectedTooth && (
              <ToothPanel
                tooth={selectedTooth}
                onClose={() => setSelectedTooth(null)}
                onAddProcedure={(proc) => handleAddProcedure({ diente_numero: selectedTooth.toString(), ...proc })}
              />
            )}
          </div>
          <div className="p-4 border-t bg-white shrink-0">
            <QuickActions onAddProcedure={(proc) => handleAddProcedure(proc)} />
          </div>
        </section>

        <aside className={`${activeTab === 'right' ? 'flex' : 'hidden'} md:flex w-full md:w-[340px] border-l bg-white flex-col shrink-0 z-20 absolute md:relative right-0 h-full`}>
          <ClinicalPipeline plan={plan} onRefresh={() => fetchPlan(appointment.paciente_cedula)} />
        </aside>
      </main>

      <div className="md:hidden h-16 border-t bg-white flex items-center justify-around shrink-0 pb-safe">
        <button onClick={() => setActiveTab('left')} className={`flex flex-col items-center gap-1 ${activeTab === 'left' ? 'text-medical-600' : 'text-slate-400'}`}>
          <History className="w-5 h-5" />
          <span className="text-[10px] font-medium">Historia</span>
        </button>
        <button onClick={() => setActiveTab('center')} className={`flex flex-col items-center gap-1 ${activeTab === 'center' ? 'text-medical-600' : 'text-slate-400'}`}>
          <Smile className="w-5 h-5" />
          <span className="text-[10px] font-medium">Odontograma</span>
        </button>
        <button onClick={() => setActiveTab('right')} className={`flex flex-col items-center gap-1 ${activeTab === 'right' ? 'text-medical-600' : 'text-slate-400'}`}>
          <ClipboardList className="w-5 h-5" />
          <span className="text-[10px] font-medium">Pipeline</span>
        </button>
      </div>
    </div>
  );
};

export default DentalWorkspace;
