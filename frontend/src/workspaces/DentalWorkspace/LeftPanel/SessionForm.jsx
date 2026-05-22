import React from 'react';

const SessionForm = ({ appointment }) => {
  return (
    <div className="p-4 border-b">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Nota de Evolución</h3>
      <textarea
        className="w-full text-sm p-2 border rounded-md h-32 focus:ring-1 focus:ring-medical-500 outline-none"
        placeholder="Describa el trabajo realizado hoy..."
      />
    </div>
  );
};

export default SessionForm;
