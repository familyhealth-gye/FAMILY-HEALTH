/**
 * DentalHeader.jsx — v2 con syncStatus real y botón Finalizar Sesión funcional
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ChevronLeft, AlertTriangle, CheckCircle2, Loader2,
  Activity, WifiOff, Send,
} from 'lucide-react';

const SyncIndicator = ({ syncStatus }) => {
  if (syncStatus === 'saving') return (
    <div className="hidden sm:flex items-center gap-1.5 text-[9px] text-amber-500 font-bold">
      <Loader2 className="w-3 h-3 animate-spin" /> Guardando…
    </div>
  );
  if (syncStatus === 'saved') return (
    <div className="hidden sm:flex items-center gap-1.5 text-[9px] text-green-500 font-bold">
      <CheckCircle2 className="w-3 h-3" /> Guardado
    </div>
  );
  if (syncStatus === 'error') return (
    <div className="hidden sm:flex items-center gap-1.5 text-[9px] text-red-500 font-bold">
      <WifiOff className="w-3 h-3" /> Error de sincronización
    </div>
  );
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
      <CheckCircle2 className="w-3 h-3" /> En línea
    </div>
  );
};

const DentalHeader = ({ appointment, syncStatus, totals, onCerrarConsulta }) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [cerrando, setCerrando]       = useState(false);

  const alertas = [];
  const pac = appointment?.paciente_data || {};
  if (pac.alergias)     alertas.push({ texto: `Alergia: ${pac.alergias}`, color: 'bg-red-500' });
  if (pac.ant_diabetes) alertas.push({ texto: 'Diabetes', color: 'bg-amber-500' });
  if (pac.ant_hta)      alertas.push({ texto: 'HTA', color: 'bg-orange-500' });
  if (pac.embarazo)     alertas.push({ texto: 'Embarazada', color: 'bg-pink-500' });

  const handleConfirmCerrar = async () => {
    setCerrando(true);
    const ok = await onCerrarConsulta('Cierre de consulta por doctor');
    setCerrando(false);
    if (ok) {
      setShowConfirm(false);
      // Opcional: navegar de vuelta a la agenda
      // navigate(-1);
    }
  };

  const hasPendientes = totals?.pendientes > 0;

  return (
    <>
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0 gap-4 shadow-sm">
        {/* ── Izquierda ── */}
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0 hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black text-slate-800 leading-none truncate">
                {appointment?.nombre_completo || 'Paciente'}
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

        {/* ── Centro: totales ── */}
        {totals?.count > 0 && (
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

        {/* ── Derecha ── */}
        <div className="flex items-center gap-3 shrink-0">
          <SyncIndicator syncStatus={syncStatus} />
          <Button
            size="sm"
            className="text-xs font-bold h-8 gap-2 bg-medical-600 hover:bg-medical-700 shadow-sm"
            onClick={() => setShowConfirm(true)}
            disabled={!hasPendientes}
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Finalizar Sesión</span>
          </Button>
        </div>
      </header>

      {/* ── Modal confirmación cierre ── */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Finalizar sesión clínica</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-slate-600">
              Al finalizar, <strong>{totals?.pendientes} procedimiento(s)</strong> serán enviados
              al área financiera para generación de proforma.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 font-medium">
              ⚠️ El equipo de recepción recibirá el plan para procesarlo con el paciente.
              Tú no podrás modificar precios ni generar cobros.
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)} disabled={cerrando}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-medical-600 hover:bg-medical-700 gap-2"
              onClick={handleConfirmCerrar}
              disabled={cerrando}
            >
              {cerrando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {cerrando ? 'Enviando…' : 'Confirmar y enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DentalHeader;
