/**
 * QuickActions.jsx
 * Acciones rápidas generales (sin pieza específica).
 * Si hay una pieza seleccionada, lo indica en el label.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Zap } from 'lucide-react';
import { PROCEDURE_DEFAULTS } from '../engine/clinical_rules';

const QUICK_LIST = [
  { name: 'Resina Simple',  color: 'bg-blue-500'   },
  { name: 'Extracción',     color: 'bg-red-500'    },
  { name: 'Endodoncia',     color: 'bg-purple-500' },
  { name: 'Corona',         color: 'bg-amber-500'  },
  { name: 'Limpieza',       color: 'bg-teal-500'   },
  { name: 'Sellante',       color: 'bg-indigo-500' },
];

const QuickActions = ({ onAddProcedure, selectedTooth }) => (
  <div className="flex flex-col items-center">
    <div className="flex items-center gap-2 mb-3">
      <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {selectedTooth
          ? `Acción rápida → Pieza ${selectedTooth}`
          : 'Acciones Rápidas (General)'}
      </span>
    </div>
    <div className="flex flex-wrap gap-2 justify-center">
      {QUICK_LIST.map(({ name, color }) => {
        const d = PROCEDURE_DEFAULTS[name] || {};
        return (
          <Button
            key={name}
            variant="outline"
            size="sm"
            className="gap-2 h-9 text-[11px] font-bold border-slate-200 hover:border-medical-300 hover:bg-medical-50 transition-all shadow-sm"
            onClick={() => onAddProcedure({
              procedimiento:        name,
              // Si hay pieza seleccionada la usa, si no va como "General"
              diente_numero:        selectedTooth ? selectedTooth.toString() : '0',
              precio:               d.precio || 0,
              fase:                 d.fase   || 1,
              superficies_afectadas: [],
              descripcion: `${name}${selectedTooth ? ` en pieza ${selectedTooth}` : ' (General)'}`,
              cie10: d.cie10 || '',
            })}
          >
            <div className={`w-2 h-2 rounded-full ${color}`} />
            {name}
            <span className="text-[9px] text-slate-400 font-medium ml-1">${d.precio || 0}</span>
          </Button>
        );
      })}
      <Button variant="ghost" size="sm" className="gap-2 h-9 text-[11px] font-bold text-slate-500">
        <Plus className="w-3 h-3" /> MÁS SERVICIOS
      </Button>
    </div>
  </div>
);

export default QuickActions;
