import React, { useState, useMemo } from 'react';
import { X, PlusCircle, Sparkles, Clock, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurfaceSelector from './SurfaceSelector';

const ToothPanel = ({ tooth, onClose, onAddProcedure, plan }) => {
  const [selectedSurfaces, setSelectedSurfaces] = useState([]);
  const [activeTab, setActiveTab] = useState('diagnostico');

  const commonProcedures = [
    { name: 'Resina Simple', surfaces: 1, price: 35, phase: 1 },
    { name: 'Resina Compuesta', surfaces: 2, price: 45, phase: 1 },
    { name: 'Resina Compleja', surfaces: 3, price: 60, phase: 1 },
    { name: 'Extracción', type: 'special', price: 45, phase: 1 },
    { name: 'Endodoncia', type: 'special', price: 180, phase: 1 },
    { name: 'Corona', type: 'special', price: 250, phase: 2 },
    { name: 'Sellante', type: 'special', price: 25, phase: 1 },
  ];

  const history = useMemo(() => {
    if (!plan?.procedimientos) return [];
    return plan.procedimientos
      .filter(p => p.diente_numero === tooth.toString())
      .sort((a, b) => (b.fecha_realizado || '').localeCompare(a.fecha_realizado || ''));
  }, [plan, tooth]);

  const toggleSurface = (id) => {
    setSelectedSurfaces(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const suggestions = useMemo(() => {
    const list = [];
    if (selectedSurfaces.length >= 3) {
      list.push({ text: "⚡ Considerar corona o incrustación", type: 'warning' });
    }
    if (selectedSurfaces.includes('O') && selectedSurfaces.length === 1) {
      list.push({ text: "Sugerencia: Sellante preventivo", type: 'info' });
    }
    return list;
  }, [selectedSurfaces]);

  const handleAddWithSurfaces = (proc) => {
    onAddProcedure({
      procedimiento: proc.name,
      precio: proc.price,
      fase: proc.phase,
      superficies_afectadas: selectedSurfaces,
      descripcion: `${proc.name} en diente ${tooth} (${selectedSurfaces.join(', ')})`
    });
    onClose();
  };

  const recommendedProcedure = useMemo(() => {
    const count = selectedSurfaces.length;
    if (count === 1) return commonProcedures[0];
    if (count === 2) return commonProcedures[1];
    if (count >= 3) return commonProcedures[2];
    return null;
  }, [selectedSurfaces]);

  return (
    <div className="mt-4 w-full max-w-2xl bg-white border border-medical-100 rounded-2xl p-0 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden z-30">
      <div className="flex items-center justify-between p-4 border-b bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-medical-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
            {tooth}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Diente {tooth}</h3>
            <div className="flex gap-2 mt-0.5">
              <button
                onClick={() => setActiveTab('diagnostico')}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${activeTab === 'diagnostico' ? 'bg-medical-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Atención
              </button>
              <button
                onClick={() => setActiveTab('historial')}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${activeTab === 'historial' ? 'bg-medical-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Historial ({history.length})
              </button>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="w-5 h-5 text-slate-400" />
        </Button>
      </div>

      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x min-h-[300px]">
        {activeTab === 'diagnostico' ? (
          <>
            {/* Left Col: Surface Selection */}
            <div className="p-6 flex-1 flex flex-col items-center justify-center bg-slate-50/50">
              <SurfaceSelector
                selectedSurfaces={selectedSurfaces}
                onToggleSurface={toggleSurface}
              />
              <div className="text-[10px] font-bold text-slate-400 uppercase mt-4 flex items-center gap-2">
                <div className="flex gap-1">
                  {selectedSurfaces.map(s => <span key={s} className="bg-red-100 text-red-600 px-1 rounded">{s}</span>)}
                </div>
                {selectedSurfaces.length === 0 && 'Sin superficies seleccionadas'}
              </div>
            </div>

            {/* Right Col: Actions & Suggestions */}
            <div className="p-6 flex-1 bg-white flex flex-col">
              {suggestions.length > 0 && (
                <div className="mb-4 space-y-2">
                  {suggestions.map((s, i) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-[11px] font-bold ${s.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                      <Sparkles className="w-3 h-3 shrink-0" />
                      {s.text}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-1">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Procedimiento Recomendado</h4>
                {recommendedProcedure ? (
                  <Button
                    className="w-full justify-between h-14 bg-medical-600 hover:bg-medical-700 shadow-lg group"
                    onClick={() => handleAddWithSurfaces(recommendedProcedure)}
                  >
                    <div className="text-left">
                      <div className="text-xs font-black leading-none uppercase">{recommendedProcedure.name}</div>
                      <div className="text-[9px] opacity-80 mt-1.5 font-bold flex items-center gap-2">
                        <span>FASE {recommendedProcedure.phase}</span>
                        <span>•</span>
                        <span>${recommendedProcedure.price}</span>
                      </div>
                    </div>
                    <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </Button>
                ) : (
                  <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                    <p className="text-[11px] text-slate-400 font-bold px-4">CLIC EN LAS SUPERFICIES PARA DIAGNOSTICAR</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 p-6 overflow-y-auto max-h-[400px]">
             <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-widest">Línea de Tiempo de la Pieza</h4>
             {history.length === 0 ? (
               <div className="text-center py-10 text-slate-400 text-xs italic">No hay historial para esta pieza.</div>
             ) : (
               <div className="space-y-4">
                 {history.map((h, i) => (
                   <div key={i} className="flex gap-3 relative pl-4 border-l-2 border-slate-100 last:border-0 pb-4 last:pb-0">
                     <div className="absolute left-[-5px] top-1 w-2 h-2 bg-medical-500 rounded-full" />
                     <div className="flex-1">
                       <div className="flex justify-between items-start">
                         <span className="text-[11px] font-black text-slate-800 uppercase">{h.procedimiento}</span>
                         <span className="text-[9px] font-bold text-slate-400">{h.fecha_realizado || 'Sin fecha'}</span>
                       </div>
                       <div className="text-[10px] text-slate-500 mt-1">{h.descripcion}</div>
                       <div className="flex items-center gap-3 mt-2">
                         <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                           <Clock className="w-2.5 h-2.5" />
                           {h.estado_pipeline}
                         </div>
                         <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                           <User className="w-2.5 h-2.5" />
                           Dr. Dental
                         </div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-[10px] font-bold h-8 border-red-100 text-red-600 hover:bg-red-50" onClick={() => handleAddWithSurfaces({ name: 'Extracción', price: 45, phase: 1 })}>
          EXTRACCIÓN
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-[10px] font-bold h-8 border-slate-200" onClick={() => handleAddWithSurfaces({ name: 'Ausente', price: 0, phase: 1 })}>
          AUSENTE
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-[10px] font-bold h-8 border-slate-200" onClick={() => handleAddWithSurfaces({ name: 'Sano', price: 0, phase: 1 })}>
          MARCAR SANO
        </Button>
      </div>
    </div>
  );
};

export default ToothPanel;
