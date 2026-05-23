/**
 * ToothPanel.jsx
 * Panel inline que aparece al seleccionar una pieza del odontograma.
 *
 * Cambios vs versión anterior:
 * - Usa clinicalEngine para reglas locales (no tiene reglas hardcoded)
 * - toothHistory viene del pipeline hook (no del plan raw)
 * - Procedimientos recomendados usan PROCEDURE_DEFAULTS del engine
 * - Botones de quick-add completos con superficies
 */
import React, { useState, useMemo } from 'react';
import { X, PlusCircle, Sparkles, Clock, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurfaceSelector from './SurfaceSelector';
import {
  PROCEDURE_DEFAULTS,
  clasificarPorSuperficies,
  PIPELINE_STATE_CONFIG,
} from '../engine/clinical_rules';

const QUICK_PROCEDURES = [
  'Resina Simple', 'Resina Compuesta', 'Resina Compleja',
  'Extracción', 'Endodoncia', 'Corona', 'Sellante',
];

const ToothPanel = ({ tooth, onClose, onAddProcedure, toothHistory, paciente, clinicalEngine }) => {
  const [selectedSurfaces, setSelectedSurfaces] = useState([]);
  const [activeTab, setActiveTab]               = useState('diagnostico');
  const [customProc, setCustomProc]             = useState('');

  const toggleSurface = (id) =>
    setSelectedSurfaces(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );

  // Procedimiento recomendado por número de superficies
  const recommendedProcName = useMemo(
    () => clasificarPorSuperficies(selectedSurfaces.length),
    [selectedSurfaces]
  );
  const recommendedDefaults = useMemo(
    () => recommendedProcName ? PROCEDURE_DEFAULTS[recommendedProcName] : null,
    [recommendedProcName]
  );

  // Reglas locales — evaluadas en cada render, sin costo
  const suggestions = useMemo(() => {
    if (!clinicalEngine) return [];
    return clinicalEngine.evaluateLocal({
      selectedSurfaces,
      toothHistory,
      paciente,
      procedimiento: recommendedProcName,
    });
  }, [selectedSurfaces, toothHistory, paciente, recommendedProcName, clinicalEngine]);

  const handleAdd = (procName, overridePrice, overridePhase) => {
    const defaults = PROCEDURE_DEFAULTS[procName] || {};
    onAddProcedure({
      procedimiento:       procName,
      precio:              overridePrice ?? defaults.precio ?? 0,
      fase:                overridePhase  ?? defaults.fase  ?? 1,
      superficies_afectadas: selectedSurfaces,
      descripcion: `${procName} en diente ${tooth}${
        selectedSurfaces.length ? ` (${selectedSurfaces.join(', ')})` : ''
      }`,
      cie10: defaults.cie10 || '',
    });
    onClose();
  };

  const stateConfig = (estado) =>
    PIPELINE_STATE_CONFIG[estado] || PIPELINE_STATE_CONFIG.creado;

  return (
    <div className="mt-4 w-full max-w-2xl bg-white border border-medical-100 rounded-2xl p-0 shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden z-30">

      {/* ── Header ── */}
      <div className="flex items-center justify-between p-4 border-b bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-medical-600 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-sm">
            {tooth}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Diente {tooth}</h3>
            <div className="flex gap-2 mt-0.5">
              {['diagnostico', 'historial'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${
                    activeTab === tab
                      ? 'bg-medical-600 text-white'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab === 'diagnostico' ? 'Atención' : `Historial (${toothHistory.length})`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="w-5 h-5 text-slate-400" />
        </Button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x min-h-[300px]">

        {activeTab === 'diagnostico' ? (
          <>
            {/* Columna izquierda: Selector de superficies */}
            <div className="p-6 flex-1 flex flex-col items-center justify-center bg-slate-50/50">
              <SurfaceSelector
                selectedSurfaces={selectedSurfaces}
                onToggleSurface={toggleSurface}
              />
              <div className="text-[10px] font-bold text-slate-400 uppercase mt-3 flex items-center gap-1 flex-wrap justify-center">
                {selectedSurfaces.length === 0
                  ? 'Selecciona superficies afectadas'
                  : selectedSurfaces.map(s => (
                    <span key={s} className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">{s}</span>
                  ))
                }
              </div>
            </div>

            {/* Columna derecha: Sugerencias + Acción */}
            <div className="p-5 flex-1 bg-white flex flex-col gap-4">

              {/* Sugerencias del motor de reglas */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2.5 rounded-xl text-[11px] font-semibold border ${
                        s.tipo === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        s.tipo === 'danger'  ? 'bg-red-50 text-red-800 border-red-200' :
                                              'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{s.texto}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Procedimiento recomendado */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest">
                  Procedimiento sugerido
                </h4>
                {recommendedDefaults ? (
                  <Button
                    className="w-full justify-between h-14 bg-medical-600 hover:bg-medical-700 shadow-lg group"
                    onClick={() => handleAdd(recommendedProcName)}
                  >
                    <div className="text-left">
                      <div className="text-xs font-black leading-none uppercase">{recommendedProcName}</div>
                      <div className="text-[9px] opacity-80 mt-1.5 font-bold flex items-center gap-2">
                        <span>FASE {recommendedDefaults.fase}</span>
                        <span>·</span>
                        <span>${recommendedDefaults.precio}</span>
                        <span>·</span>
                        <span>~{recommendedDefaults.tiempo_min}min</span>
                      </div>
                    </div>
                    <PlusCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </Button>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                    <p className="text-[11px] text-slate-400 font-bold px-4">
                      SELECCIONA SUPERFICIES PARA DIAGNOSTICAR
                    </p>
                  </div>
                )}
              </div>

              {/* Otros procedimientos frecuentes */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                  Otros procedimientos
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROCEDURES
                    .filter(p => p !== recommendedProcName)
                    .map(name => {
                      const d = PROCEDURE_DEFAULTS[name];
                      return (
                        <button
                          key={name}
                          onClick={() => handleAdd(name)}
                          className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-medical-300 hover:bg-medical-50 transition-all flex items-center gap-1"
                        >
                          {name}
                          <span className="text-slate-400 font-medium">${d?.precio}</span>
                        </button>
                      );
                    })
                  }
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ── Tab Historial ── */
          <div className="flex-1 p-6 overflow-y-auto max-h-[420px]">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-4 tracking-widest">
              Línea de Tiempo · Pieza {tooth}
            </h4>
            {toothHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-300 text-sm italic">
                Sin intervenciones previas en esta pieza.
              </div>
            ) : (
              <div className="space-y-4">
                {toothHistory.map((h, i) => {
                  const cfg = stateConfig(h.estado_pipeline);
                  return (
                    <div key={i} className="flex gap-3 pl-4 border-l-2 border-slate-100 last:border-0 pb-4 last:pb-0 relative">
                      <div className={`absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      <div className="flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[11px] font-black text-slate-800 uppercase leading-tight">
                            {h.procedimiento}
                          </span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white whitespace-nowrap ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        {h.superficies_afectadas?.length > 0 && (
                          <div className="flex gap-0.5 mt-1">
                            {h.superficies_afectadas.map(s => (
                              <span key={s} className="text-[8px] bg-red-50 text-red-600 px-1 font-bold rounded border border-red-100">{s}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                            <Clock className="w-2.5 h-2.5" />
                            {h.fecha_realizado || h.fecha_programada || 'Sin fecha'}
                          </div>
                          {h.precio > 0 && (
                            <div className="text-[9px] text-slate-400 font-bold">
                              ${h.precio}
                            </div>
                          )}
                        </div>
                        {h.descripcion && (
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{h.descripcion}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer: acciones rápidas críticas ── */}
      <div className="p-3 bg-slate-50 border-t flex gap-2">
        <Button
          variant="outline" size="sm"
          className="flex-1 text-[10px] font-bold h-8 border-red-100 text-red-600 hover:bg-red-50"
          onClick={() => handleAdd('Extracción')}
        >
          EXTRACCIÓN
        </Button>
        <Button
          variant="outline" size="sm"
          className="flex-1 text-[10px] font-bold h-8 border-slate-200"
          onClick={() => handleAdd('Ausente', 0, 1)}
        >
          AUSENTE
        </Button>
        <Button
          variant="outline" size="sm"
          className="flex-1 text-[10px] font-bold h-8 border-slate-200"
          onClick={() => {
            onAddProcedure({
              procedimiento: 'Sano',
              precio: 0, fase: 1,
              superficies_afectadas: [],
              descripcion: `Pieza ${tooth} sana`,
            });
            onClose();
          }}
        >
          MARCAR SANO
        </Button>
      </div>
    </div>
  );
};

export default ToothPanel;
