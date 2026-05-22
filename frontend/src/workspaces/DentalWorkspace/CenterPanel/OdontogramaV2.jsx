import React from 'react';

const OdontogramaV2 = ({ selectedTooth, onSelectTooth }) => {
  // Placeholder for Odontograma
  return (
    <div className="w-full max-w-4xl bg-white border rounded-xl p-8 shadow-sm flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <p className="text-slate-400 mb-4 font-medium">Odontograma FDI Interactivo V2</p>
        <div className="grid grid-cols-8 gap-2">
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              onClick={() => onSelectTooth(18-i)}
              className={`w-10 h-14 border-2 rounded flex items-center justify-center cursor-pointer hover:bg-medical-50 transition-colors ${selectedTooth === (18-i) ? 'border-medical-500 bg-medical-50' : 'border-slate-200'}`}
            >
              {18-i}
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-slate-400">Haga clic en un diente para iniciar diagnóstico</p>
      </div>
    </div>
  );
};

export default OdontogramaV2;
