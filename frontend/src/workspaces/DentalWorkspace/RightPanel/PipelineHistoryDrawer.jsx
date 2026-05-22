import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { History, User, Clock, ArrowRight } from 'lucide-react';

const PipelineHistoryDrawer = ({ isOpen, onClose, plan }) => {
  if (!plan) return null;

  // Extraer logs de las notas de todos los procedimientos
  const allLogs = [];
  plan.procedimientos?.forEach(proc => {
    const notes = proc.notas || '';
    const lines = notes.split('\n');
    lines.forEach(line => {
      if (line.startsWith('[') && line.includes('Estado cambiado')) {
        allLogs.push({
          procName: proc.procedimiento,
          tooth: proc.diente_numero,
          log: line,
          // Extraer fecha para ordenar (Formato: [YYYY-MM-DD HH:MM])
          date: line.substring(1, 17)
        });
      }
    });
  });

  // Ordenar logs por fecha descendente
  allLogs.sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-medical-600" />
            Historial del Plan
          </SheetTitle>
          <SheetDescription>
            Seguimiento de cambios y evolución clínica
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {allLogs.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-sm italic">
              No hay cambios registrados en el historial.
            </div>
          ) : (
            allLogs.map((item, index) => {
              // Parsear log: [2025-01-01 10:00] Estado cambiado de 'creado' a 'propuesto' por admin (Administrador).
              const parts = item.log.match(/\[(.*?)\] Estado cambiado de '(.*?)' a '(.*?)' por (.*)/);
              if (!parts) return null;

              return (
                <div key={index} className="relative pl-6 pb-6 border-l-2 border-slate-100 last:border-0 last:pb-0">
                  <div className="absolute left-[-9px] top-0 w-4 h-4 bg-white border-2 border-medical-500 rounded-full z-10" />

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {parts[1]}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-800">
                      Pieza {item.tooth === "0" ? "G" : item.tooth}: {item.procName}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">{parts[2]}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      <span className="text-[10px] bg-medical-50 px-1.5 py-0.5 rounded text-medical-700 font-bold border border-medical-100">
                        {parts[3]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                      <User className="w-3 h-3" />
                      Por {parts[4]}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PipelineHistoryDrawer;
