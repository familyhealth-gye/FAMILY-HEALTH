/**
 * OdontogramaV2.jsx
 * Odontograma FDI — ahora recibe toothStates desde el hook (no desde plan raw).
 * Más limpio, sin lógica de negocio interna.
 */
import React from 'react';
import { PIPELINE_STATE_CONFIG } from '../engine/clinical_rules';

const getToothClasses = (tooth, selectedTooth, toothStates) => {
  const state = toothStates[tooth.toString()];
  const cfg   = PIPELINE_STATE_CONFIG[state];
  const isSelected = selectedTooth === tooth;

  const baseColor = cfg
    ? `${cfg.color} border-transparent text-white`
    : 'bg-white border-slate-200 text-slate-600 hover:border-medical-300 hover:bg-medical-50/30';

  const selectedRing = isSelected
    ? 'ring-4 ring-medical-100 ring-offset-2 scale-110 shadow-lg'
    : 'hover:scale-105';

  return `w-7 h-10 md:w-10 md:h-14 border-2 rounded-lg flex items-center justify-center cursor-pointer
    transition-all duration-150 text-[10px] md:text-xs font-black
    ${baseColor} ${selectedRing}`;
};

const Quadrant = React.memo(({ range, reverse, selectedTooth, toothStates, onSelectTooth }) => {
  const teeth = reverse ? [...range].reverse() : range;
  return (
    <div className="flex gap-1.5 md:gap-2">
      {teeth.map(num => {
        const state = toothStates[num.toString()];
        const cfg   = PIPELINE_STATE_CONFIG[state];
        return (
          <div key={num} className="flex flex-col items-center gap-1">
            <div
              onClick={() => onSelectTooth(selectedTooth === num ? null : num)}
              className={getToothClasses(num, selectedTooth, toothStates)}
              title={cfg ? `Pieza ${num} — ${cfg.label}` : `Pieza ${num}`}
            >
              {num}
            </div>
            {state && (
              <div className={`w-1.5 h-1.5 rounded-full ${cfg?.dot || 'bg-slate-300'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
});

const LEGEND = [
  { label: 'Propuesto',  key: 'propuesto'  },
  { label: 'Aprobado',   key: 'aprobado'   },
  { label: 'Programado', key: 'programado' },
  { label: 'Realizado',  key: 'realizado'  },
  { label: 'Cobrado',    key: 'cobrado'    },
  { label: 'Extraído',   key: 'extraido'   },
];

const OdontogramaV2 = ({ selectedTooth, onSelectTooth, toothStates = {} }) => {
  const sharedProps = { selectedTooth, toothStates, onSelectTooth };

  return (
    <div className="w-full max-w-5xl bg-white border border-slate-100 rounded-3xl p-6 md:p-10 shadow-xl flex flex-col items-center min-h-[500px]">
      <div className="w-full flex flex-col gap-12">

        {/* Arcada Superior */}
        <div className="flex flex-col gap-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center border-b pb-2">
            Arcada Superior
          </p>
          <div className="flex justify-center gap-4 md:gap-8 flex-wrap">
            <Quadrant range={[18,17,16,15,14,13,12,11]} reverse={false} {...sharedProps} />
            <Quadrant range={[21,22,23,24,25,26,27,28]} reverse={false} {...sharedProps} />
          </div>
        </div>

        {/* Arcada Inferior */}
        <div className="flex flex-col gap-4">
          <div className="flex justify-center gap-4 md:gap-8 flex-wrap">
            <Quadrant range={[48,47,46,45,44,43,42,41]} reverse={false} {...sharedProps} />
            <Quadrant range={[31,32,33,34,35,36,37,38]} reverse={false} {...sharedProps} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center border-t pt-4">
            Arcada Inferior
          </p>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 w-full">
        {LEGEND.map(({ label, key }) => {
          const cfg = PIPELINE_STATE_CONFIG[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
              <span className="text-[10px] font-bold text-slate-500 uppercase">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// React.memo evita re-renders cuando toothStates no cambia
export default React.memo(OdontogramaV2, (prev, next) => {
  // Solo re-render si selectedTooth o toothStates cambian
  return (
    prev.selectedTooth === next.selectedTooth &&
    JSON.stringify(prev.toothStates) === JSON.stringify(next.toothStates)
  );
});
