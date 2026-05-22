import React from 'react';

const SurfaceSelector = ({ selectedSurfaces, onToggleSurface }) => {
  const surfaces = [
    { id: 'V', label: 'V', pos: 'top-0 left-1/2 -translate-x-1/2' }, // Vestibular
    { id: 'M', label: 'M', pos: 'left-0 top-1/2 -translate-y-1/2' }, // Mesial
    { id: 'D', label: 'D', pos: 'right-0 top-1/2 -translate-y-1/2' }, // Distal
    { id: 'L', label: 'L/P', pos: 'bottom-0 left-1/2 -translate-x-1/2' }, // Lingual/Palatino
    { id: 'O', label: 'O', pos: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8' } // Oclusal
  ];

  return (
    <div className="relative w-28 h-28 mx-auto my-4">
      {surfaces.map(s => (
        <button
          key={s.id}
          onClick={() => onToggleSurface(s.id)}
          className={`absolute flex items-center justify-center border-2 transition-all text-[10px] font-bold rounded
            ${s.id === 'O' ? 'z-10 bg-white' : 'w-9 h-9'}
            ${selectedSurfaces.includes(s.id)
              ? 'bg-red-500 border-red-600 text-white shadow-inner'
              : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}
            ${s.pos}
          `}
        >
          {s.label}
        </button>
      ))}
      {/* Visual connecting lines or background can be added here */}
      <div className="absolute inset-0 border border-slate-100 rounded-lg pointer-events-none -m-2"></div>
    </div>
  );
};

export default SurfaceSelector;
