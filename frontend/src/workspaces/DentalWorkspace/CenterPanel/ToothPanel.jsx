import React, { useState, useMemo } from 'react';
import { X, PlusCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurfaceSelector from './SurfaceSelector';

const ToothPanel = ({ tooth, onClose, onAddProcedure }) => {
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
  }, [selectedSurfaces, commonProcedures]);

  return (
    <div className="mt-4 w-full max-w-2xl bg-white border border-medical-100 rounded-2xl p-0 shadow-xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
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
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${activeTab === 'diagnostico' ? 'bg-medical-600 text-white' : 'text-slate-400'}`}
              >
                Diagnóstico
              </button>
              <button
                onClick={() => setActiveTab('procedimientos')}
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${activeTab === 'procedimientos' ? 'bg-medical-600 text-white' : 'text-slate-400'}`}
              >
                Procedimientos
              </button>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="w-5 h-5 text-slate-400" />
        </Button>
      </div>

      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
        {/* Left Col: Surface Selection */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center bg-slate-50/50">
          <SurfaceSelector
            selectedSurfaces={selectedSurfaces}
            onToggleSurface={toggleSurface}
          />
          <div className="text-[10px] font-bold text-slate-400 uppercase mt-2">
            Superficies: {selectedSurfaces.length > 0 ? selectedSurfaces.join(', ') : 'Ninguna'}
          </div>
        </div>

        {/* Right Col: Actions & Suggestions */}
        <div className="p-6 flex-1 bg-white">
          {suggestions.length > 0 && (
            <div className="mb-4 space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-[11px] font-medium ${s.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                  <Sparkles className="w-3 h-3 shrink-0" />
                  {s.text}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'diagnostico' ? (
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2">Tratamiento Sugerido</h4>
              {recommendedProcedure ? (
                <Button
                  className="w-full justify-between h-12 bg-medical-600 hover:bg-medical-700 shadow-md"
                  onClick={() => handleAddWithSurfaces(recommendedProcedure)}
                >
                  <div className="text-left">
                    <div className="text-xs font-bold leading-none">{recommendedProcedure.name}</div>
                    <div className="text-[9px] opacity-80 mt-1 uppercase font-bold">Fase {recommendedProcedure.phase} • ${recommendedProcedure.price}</div>
                  </div>
                  <PlusCircle className="w-5 h-5" />
                </Button>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                  <p className="text-xs text-slate-400">Seleccione superficies para ver sugerencias</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {commonProcedures.map((proc) => (
                <button
                  key={proc.name}
                  onClick={() => handleAddWithSurfaces(proc)}
                  className="flex flex-col p-2 border border-slate-100 rounded-xl hover:border-medical-500 hover:bg-medical-50 transition-all text-left group"
                >
                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-medical-700">{proc.name}</span>
                  <span className="text-[9px] text-slate-400">${proc.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="p-3 bg-slate-50 border-t flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-[10px] h-8 border-red-100 text-red-600 hover:bg-red-50" onClick={() => handleAddWithSurfaces({ name: 'Extracción', price: 45, phase: 1 })}>
          Extracción
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-[10px] h-8 border-slate-200" onClick={() => handleAddWithSurfaces({ name: 'Ausente', price: 0, phase: 1 })}>
          Ausente
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-[10px] h-8 border-slate-200" onClick={() => handleAddWithSurfaces({ name: 'Sano', price: 0, phase: 1 })}>
          Marcar Sano
        </Button>
      </div>
    </div>
  );
};

export default ToothPanel;
