import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';

const QuickActions = ({ onAddProcedure }) => {
  const actions = [
    { name: 'Resina Simple', color: 'bg-blue-500', price: 35, phase: 1 },
    { name: 'Extracción', color: 'bg-red-500', price: 45, phase: 1 },
    { name: 'Endodoncia', color: 'bg-purple-500', price: 180, phase: 1 },
    { name: 'Corona', color: 'bg-amber-500', price: 250, phase: 2 },
    { name: 'Limpieza', color: 'bg-teal-500', price: 40, phase: 1 },
    { name: 'Sellante', color: 'bg-indigo-500', price: 25, phase: 1 },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acciones Rápidas (General)</span>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {actions.map(action => (
          <Button
            key={action.name}
            variant="outline"
            size="sm"
            className="gap-2 h-9 text-[11px] font-bold border-slate-200 hover:border-medical-300 hover:bg-medical-50 transition-all shadow-sm"
            onClick={() => onAddProcedure({
              procedimiento: action.name,
              diente_numero: "0",
              precio: action.price,
              fase: action.phase,
              descripcion: `${action.name} (General)`
            })}
          >
            <div className={`w-2 h-2 rounded-full ${action.color}`} />
            {action.name}
            <span className="text-[9px] text-slate-400 font-medium ml-1">${action.price}</span>
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="gap-2 h-9 text-[11px] font-bold text-slate-500">
          <Plus className="w-3 h-3" />
          MÁS SERVICIOS
        </Button>
      </div>
    </div>
  );
};

export default QuickActions;
