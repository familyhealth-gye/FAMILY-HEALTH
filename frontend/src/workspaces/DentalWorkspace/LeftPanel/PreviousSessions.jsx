import React from 'react';

const PreviousSessions = ({ patientId }) => {
  return (
    <div className="p-4 flex-1">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sesiones Previas</h3>
      <div className="text-xs text-slate-500 italic">No hay sesiones anteriores registradas.</div>
    </div>
  );
};

export default PreviousSessions;
