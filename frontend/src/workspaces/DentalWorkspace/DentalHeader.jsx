/**
 * DentalHeader.jsx
 * Header del workspace con datos del paciente, alertas médicas y totales del pipeline.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, AlertTriangle, CheckCircle2, Loader2, Activity } from 'lucide-react';

const DentalHeader = ({ appointment, saving, totals }) => {
  const navigate = useNavigate();

  // Alertas sistémicas desde el paciente
  const alertas = [];
  const pac = appointment?.paciente_data || {};
  if (pac.alergias)     alertas.push({ texto: `Alergia: ${pac.alergias}`, color: 'bg-red-500' });
  if (pac.ant_diabetes) alertas.push({ texto: 'Diabetes', color: 'bg-amber-500' });
  if (pac.ant_hta)      alertas.push({ texto: 'HTA', color: 'bg-orange-500' });
  if (pac.embarazo)     alertas.push({ texto: 'Embarazada', color: 'bg-pink-500' });

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0 gap-4">
      {/* ── Izquierda: volver + paciente ── */}
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm font-black text-slate-800 leading-none truncate">
              {appointment?.paciente_nombre || 'Paciente'}
            </h1>
            {alertas.map((a, i) => (
              <span key={i} className={`${a.color} text-white text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1`}>
                <AlertTriangle className="w-2.5 h-2.5" />
                {a.texto}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            {appointment?.fecha || ''} · Odontología
          </p>
        </div>
      </div>

      {/* ── Centro: totales del pipeline ── */}
      {totals && totals.count > 0 && (
        <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-slate-500">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-medical-500" />
            <span>{totals.count} procedimientos</span>
          </div>
          <div className="h-3 w-px bg-slate-200" />
          <span className="text-slate-800 font-black">${totals.total.toFixed(2)}</span>
          {totals.realizados > 0 && (
            <>
              <div className="h-3 w-px bg-slate-200" />
              <span className="text-green-600">{totals.realizados} realizados</span>
            </>
          )}
        </div>
      )}

      {/* ── Derecha: estado guardado + acción ── */}
      <div className="flex items-center gap-2 shrink-0">
        {saving ? (
          <div className="hidden sm:flex items-center gap-1 text-[9px] text-amber-500 font-bold">
            <Loader2 className="w-3 h-3 animate-spin" />
            Guardando
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1 text-[9px] text-green-500 font-bold">
            <CheckCircle2 className="w-3 h-3" />
            En línea
          </div>
        )}
        <Button size="sm" variant="outline" className="text-xs font-bold h-8">
          Finalizar Sesión
        </Button>
      </div>
    </header>
  );
};

export default DentalHeader;
