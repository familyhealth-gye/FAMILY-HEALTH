/**
 * SessionForm.jsx
 * Nota de evolución de la sesión actual.
 * Muestra indicador de guardado (autosave debounced desde el hook).
 */
import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

const SessionForm = ({ sessionNote, onNoteChange, saving }) => (
  <div className="p-4 border-b flex flex-col gap-2 shrink-0">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
        Nota de Evolución
      </h3>
      {saving ? (
        <div className="flex items-center gap-1 text-[9px] text-amber-500 font-bold">
          <Loader2 className="w-3 h-3 animate-spin" />
          Guardando...
        </div>
      ) : sessionNote ? (
        <div className="flex items-center gap-1 text-[9px] text-green-500 font-bold">
          <CheckCircle2 className="w-3 h-3" />
          Guardado
        </div>
      ) : null}
    </div>
    <textarea
      value={sessionNote}
      onChange={(e) => onNoteChange(e.target.value)}
      className="w-full text-sm p-3 border border-slate-200 rounded-xl h-36
        focus:ring-2 focus:ring-medical-400 focus:border-medical-400
        outline-none resize-none transition-all placeholder:text-slate-300
        text-slate-700 leading-relaxed"
      placeholder="Describa el trabajo realizado hoy, hallazgos y observaciones clínicas..."
    />
    <p className="text-[9px] text-slate-300 font-medium text-right">
      {sessionNote.length} caracteres · guardado localmente
    </p>
  </div>
);

export default SessionForm;
