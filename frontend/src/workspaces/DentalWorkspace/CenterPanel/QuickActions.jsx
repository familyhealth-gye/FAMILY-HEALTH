import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const QuickActions = ({ onAddProcedure }) => {
  const actions = [
    { name: 'Resina Simple', color: 'bg-blue-500', price: 35 },
    { name: 'Extracción', color: 'bg-red-500', price: 45 },
    { name: 'Endodoncia', color: 'bg-purple-500', price: 180 },
    { name: 'Corona', color: 'bg-amber-500', price: 250 },
    { name: 'Limpieza', color: 'bg-teal-500', price: 40 },
    { name: 'Sellante', color: 'bg-indigo-500', price: 25 },
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <span className="text-[10px] font-bold text-slate-400 w-full text-center mb-1 uppercase tracking-tighter">Acciones Rápidas</span>
      {actions.map(action => (
        <Button
          key={action.name}
          variant="outline"
          size="sm"
          className="gap-2 h-8 text-[11px] border-slate-200 hover:border-medical-300 hover:bg-medical-50 transition-all"
          onClick={() => onAddProcedure({
            procedimiento: action.name,
            diente_numero: "0", // Procedimiento general
            precio: action.price,
            descripcion: action.name
          })}
        >
          <div className={`w-2 h-2 rounded-full ${action.color}`} />
          {action.name}
        </Button>
      ))}
      <Button variant="ghost" size="sm" className="gap-2 h-8 text-[11px]">
        <Plus className="w-3 h-3" />
        Otros
      </Button>
    </div>
  );
};

export default QuickActions;
