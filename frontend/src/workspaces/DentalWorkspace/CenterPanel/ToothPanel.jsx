import React from 'react';
import { X, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ToothPanel = ({ tooth, onClose, onAddProcedure }) => {
  const commonProcedures = [
    { name: 'Caries (Resina)', price: 35 },
    { name: 'Extracción', price: 45 },
    { name: 'Endodoncia', price: 180 },
    { name: 'Corona', price: 250 },
    { name: 'Sellante', price: 25 },
    { name: 'Perno', price: 80 },
  ];

  const handleAction = (proc) => {
    onAddProcedure({
      procedimiento: proc.name,
      precio: proc.price,
      descripcion: `${proc.name} en diente ${tooth}`
    });
    onClose();
  };

  return (
    <div className="mt-6 w-full max-w-2xl bg-white border border-medical-100 rounded-2xl p-5 shadow-xl flex flex-col animate-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between mb-4 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-medical-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
            {tooth}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Diente {tooth}</h3>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Opciones de Diagnóstico y Tratamiento</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="w-5 h-5 text-slate-400" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {commonProcedures.map((proc) => (
          <button
            key={proc.name}
            onClick={() => handleAction(proc)}
            className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-medical-500 hover:bg-medical-50 transition-all text-left group"
          >
            <span className="text-xs font-semibold text-slate-700 group-hover:text-medical-700">{proc.name}</span>
            <PlusCircle className="w-4 h-4 text-slate-300 group-hover:text-medical-600" />
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1 text-xs h-9 border-red-100 text-red-600 hover:bg-red-50">Marcar Ausente</Button>
        <Button variant="outline" className="flex-1 text-xs h-9 border-amber-100 text-amber-600 hover:bg-amber-50">Implante</Button>
      </div>
    </div>
  );
};

export default ToothPanel;
