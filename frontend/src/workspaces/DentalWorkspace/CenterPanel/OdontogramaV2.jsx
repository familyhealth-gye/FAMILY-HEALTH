import React, { useMemo } from 'react';

const OdontogramaV2 = ({ selectedTooth, onSelectTooth, plan }) => {

  const toothStates = useMemo(() => {
    const states = {};
    if (!plan?.procedimientos) return states;

    // Prioridad de estados (el más avanzado domina la visualización)
    const priority = {
      'realizado': 6,
      'cobrado': 5,
      'programado': 4,
      'aprobado': 3,
      'propuesto': 2,
      'creado': 1
    };

    plan.procedimientos.forEach(proc => {
      const tooth = proc.diente_numero;
      const state = proc.estado_pipeline || 'creado';
      const currentLevel = priority[states[tooth]] || 0;
      const newLevel = priority[state] || 0;

      if (newLevel > currentLevel) {
        states[tooth] = state;
      }

      // Caso especial: Extracción o Ausente
      if (proc.procedimiento?.toLowerCase().includes('extrac') || proc.procedimiento?.toLowerCase().includes('ausente')) {
        states[tooth] = 'extraido';
      }
    });

    return states;
  }, [plan]);

  const getToothColor = (tooth) => {
    const state = toothStates[tooth.toString()];
    switch (state) {
      case 'propuesto': return 'bg-red-500 border-red-600 text-white';
      case 'aprobado': return 'bg-amber-500 border-amber-600 text-white';
      case 'programado': return 'bg-blue-500 border-blue-600 text-white';
      case 'realizado': return 'bg-green-500 border-green-600 text-white';
      case 'cobrado': return 'bg-teal-500 border-teal-600 text-white';
      case 'extraido': return 'bg-slate-800 border-slate-900 text-white';
      case 'cancelado': return 'bg-slate-200 border-slate-300 text-slate-400';
      default: return 'bg-white border-slate-200 text-slate-600';
    }
  };

  const renderQuadrant = (range, reverse = false) => {
    const teeth = reverse ? [...range].reverse() : range;
    return (
      <div className="flex gap-1.5 md:gap-2">
        {teeth.map(num => (
          <div key={num} className="flex flex-col items-center gap-1">
            <div
              onClick={() => onSelectTooth(num)}
              className={`
                w-7 h-10 md:w-10 md:h-14 border-2 rounded-lg flex items-center justify-center cursor-pointer
                transition-all duration-200 hover:scale-110 hover:shadow-lg
                text-[10px] md:text-xs font-black
                ${selectedTooth === num ? 'ring-4 ring-medical-100 ring-offset-2 border-medical-500' : ''}
                ${getToothColor(num)}
              `}
            >
              {num}
            </div>
            {toothStates[num.toString()] && (
               <div className={`w-1.5 h-1.5 rounded-full ${getToothColor(num).split(' ')[0]}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl bg-white border border-slate-100 rounded-3xl p-6 md:p-10 shadow-xl flex flex-col items-center min-h-[500px]">
      <div className="w-full flex flex-col gap-12">

        {/* Arcada Superior */}
        <div className="flex flex-col gap-6">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center border-b pb-2 mb-2">Arcada Superior</div>
          <div className="flex justify-center gap-4 md:gap-8 flex-wrap">
            {/* Cuadrante 1 */}
            {renderQuadrant([11, 12, 13, 14, 15, 16, 17, 18], true)}
            {/* Cuadrante 2 */}
            {renderQuadrant([21, 22, 23, 24, 25, 26, 27, 28])}
          </div>
        </div>

        {/* Arcada Inferior */}
        <div className="flex flex-col gap-6">
          <div className="flex justify-center gap-4 md:gap-8 flex-wrap">
            {/* Cuadrante 4 */}
            {renderQuadrant([41, 42, 43, 44, 45, 46, 47, 48], true)}
            {/* Cuadrante 3 */}
            {renderQuadrant([31, 32, 33, 34, 35, 36, 37, 38])}
          </div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center border-t pt-4 mt-2">Arcada Inferior</div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-16 grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        {[
          { label: 'Propuesto', color: 'bg-red-500' },
          { label: 'Aprobado', color: 'bg-amber-500' },
          { label: 'Programado', color: 'bg-blue-500' },
          { label: 'Realizado', color: 'bg-green-500' },
          { label: 'Cobrado', color: 'bg-teal-500' },
          { label: 'Extraído/Ausente', color: 'bg-slate-800' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${item.color}`} />
            <span className="text-[10px] font-bold text-slate-500 uppercase">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OdontogramaV2;
