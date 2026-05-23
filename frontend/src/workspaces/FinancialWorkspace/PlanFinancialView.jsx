/**
 * PlanFinancialView.jsx
 * Vista financiera del plan de tratamiento.
 * El counter ve el plan clínico (readonly) y puede:
 * - Aprobar fases completas o procedimientos individuales
 * - Generar proforma desde el plan
 * - Ver el audit log
 */
import React, { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, FileText, Loader2, DollarSign,
  ChevronDown, ChevronUp, Activity, Eye,
} from 'lucide-react';
import apiClient from '@/lib/axios';
import { PIPELINE_STATE_CONFIG, FASE_LABELS } from '../DentalWorkspace/engine/clinical_rules';

const PlanFinancialView = ({ plan, onPlanUpdated, onBack }) => {
  const [approving, setApproving]     = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [expandedFases, setExpandedFases] = useState({ 1: true });
  const [selectedProcs, setSelectedProcs] = useState(new Set()); // para aprobación parcial

  const procedimientos = plan?.procedimientos || [];

  // Agrupar por fase
  const faseMap = useMemo(() => {
    const map = {};
    procedimientos.forEach(p => {
      const f = p.fase || 1;
      if (!map[f]) map[f] = [];
      map[f].push(p);
    });
    return map;
  }, [procedimientos]);

  const total = useMemo(
    () => procedimientos.reduce((s, p) => s + (p.precio || 0), 0),
    [procedimientos]
  );

  const totalAprobado = useMemo(
    () => procedimientos
      .filter(p => ['aprobado', 'programado', 'realizado', 'cobrado'].includes(p.estado_pipeline))
      .reduce((s, p) => s + (p.precio || 0), 0),
    [procedimientos]
  );

  const toggleFase = (f) =>
    setExpandedFases(prev => ({ ...prev, [f]: !prev[f] }));

  const toggleProc = (id) =>
    setSelectedProcs(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const selectAllFase = (faseNum) => {
    const ids = (faseMap[faseNum] || [])
      .filter(p => p.estado_pipeline === 'propuesto')
      .map(p => p.id);
    setSelectedProcs(prev => {
      const s = new Set(prev);
      ids.forEach(id => s.add(id));
      return s;
    });
  };

  // ── Aprobar seleccionados ──
  const handleAprobar = async () => {
    if (selectedProcs.size === 0) {
      toast.warning('Selecciona al menos un procedimiento para aprobar.');
      return;
    }
    setApproving(true);
    try {
      await apiClient.post(`/plan-tratamiento/${plan.id}/aprobar-fase`, {
        procedimiento_ids: [...selectedProcs],
        motivo: 'Aprobación por counter',
      });
      setSelectedProcs(new Set());
      await onPlanUpdated();
      toast.success('Procedimientos aprobados.');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al aprobar.');
    } finally {
      setApproving(false);
    }
  };

  // ── Aprobar fase completa ──
  const handleAprobarFase = async (faseNum) => {
    setApproving(true);
    try {
      await apiClient.post(`/plan-tratamiento/${plan.id}/aprobar-fase`, {
        fase: faseNum,
        motivo: `Aprobación completa Fase ${faseNum}`,
      });
      await onPlanUpdated();
      toast.success(`Fase ${faseNum} aprobada.`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al aprobar fase.');
    } finally {
      setApproving(false);
    }
  };

  // ── Generar proforma ──
  const handleGenerarProforma = async () => {
    const aprobados = procedimientos.filter(p =>
      ['aprobado', 'programado'].includes(p.estado_pipeline)
    );
    if (aprobados.length === 0) {
      toast.warning('Aprueba al menos un procedimiento antes de generar la proforma.');
      return;
    }
    setGenerating(true);
    try {
      const res = await apiClient.post('/proformas/desde-plan-tratamiento', {
        plan_id:      plan.id,
        paciente_id:  plan.paciente_id,
        observaciones: `Generada desde plan de tratamiento · ${new Date().toLocaleDateString('es-EC')}`,
      });
      await onPlanUpdated();
      toast.success(`✅ Proforma #${res.data?.numero || ''} generada exitosamente.`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al generar proforma.');
    } finally {
      setGenerating(false);
    }
  };

  const propuestosCount = procedimientos.filter(p => p.estado_pipeline === 'propuesto').length;
  const aprobadosCount  = procedimientos.filter(p =>
    ['aprobado', 'programado', 'realizado', 'cobrado'].includes(p.estado_pipeline)
  ).length;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* ── Resumen del plan ── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-black text-slate-800">{plan.paciente_nombre}</h2>
            <p className="text-[11px] text-slate-400 font-medium">{plan.paciente_cedula}</p>
            {plan.doctor_nombre && (
              <p className="text-[10px] text-slate-400 mt-1">Dr. {plan.doctor_nombre}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-slate-800">${total.toFixed(2)}</p>
            <p className="text-[10px] text-slate-400 font-medium">Total plan</p>
          </div>
        </div>

        {/* Barra de progreso aprobación */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
            <span>{aprobadosCount} aprobados</span>
            <span>${totalAprobado.toFixed(2)} aprobados</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-400 rounded-full transition-all duration-500"
              style={{ width: `${procedimientos.length ? (aprobadosCount / procedimientos.length) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-medium text-slate-300 uppercase">
            <span>{propuestosCount} pendientes</span>
            <span>{procedimientos.length} total</span>
          </div>
        </div>
      </div>

      {/* ── Acciones globales ── */}
      <div className="flex gap-3 flex-wrap">
        {selectedProcs.size > 0 && (
          <Button
            size="sm"
            className="gap-2 bg-green-600 hover:bg-green-700 shadow-sm"
            onClick={handleAprobar}
            disabled={approving}
          >
            {approving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5" />
            }
            Aprobar {selectedProcs.size} seleccionado{selectedProcs.size !== 1 ? 's' : ''}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 shadow-sm ml-auto"
          onClick={handleGenerarProforma}
          disabled={generating || aprobadosCount === 0}
        >
          {generating
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <FileText className="w-3.5 h-3.5" />
          }
          Generar Proforma
        </Button>
      </div>

      {/* ── Fases ── */}
      {Object.keys(faseMap).sort((a, b) => Number(a) - Number(b)).map(faseNum => {
        const procs  = faseMap[faseNum];
        const total_f = procs.reduce((s, p) => s + (p.precio || 0), 0);
        const propuestos_f = procs.filter(p => p.estado_pipeline === 'propuesto');
        const expanded = expandedFases[faseNum] !== false;

        return (
          <div key={faseNum} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            {/* Header fase */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b">
              <button
                onClick={() => toggleFase(faseNum)}
                className="flex items-center gap-3 text-left flex-1"
              >
                <span className="text-[10px] font-black text-medical-700 bg-medical-50 px-2 py-0.5 rounded border border-medical-100 uppercase">
                  Fase {faseNum}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {FASE_LABELS[Number(faseNum)] || ''}
                </span>
                <span className="text-[10px] font-bold text-slate-600 ml-auto mr-2">
                  ${total_f.toFixed(2)}
                </span>
                {expanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                }
              </button>
              {propuestos_f.length > 0 && (
                <Button
                  size="sm" variant="ghost"
                  className="h-7 px-2 text-[9px] font-bold text-green-700 hover:bg-green-50 ml-2 whitespace-nowrap"
                  onClick={() => handleAprobarFase(Number(faseNum))}
                  disabled={approving}
                >
                  APROBAR TODO
                </Button>
              )}
            </div>

            {/* Procedimientos */}
            {expanded && (
              <div className="divide-y divide-slate-50">
                {procs.map(proc => {
                  const cfg       = PIPELINE_STATE_CONFIG[proc.estado_pipeline] || PIPELINE_STATE_CONFIG.creado;
                  const isProp    = proc.estado_pipeline === 'propuesto';
                  const isChecked = selectedProcs.has(proc.id);

                  return (
                    <div
                      key={proc.id}
                      onClick={() => isProp && toggleProc(proc.id)}
                      className={`flex items-center gap-4 px-5 py-3.5 transition-colors
                        ${isProp ? 'cursor-pointer hover:bg-slate-50' : ''}
                        ${isChecked ? 'bg-green-50/50' : ''}
                      `}
                    >
                      {/* Checkbox */}
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                        ${isProp
                          ? isChecked
                            ? 'bg-green-500 border-green-500'
                            : 'border-slate-300 hover:border-green-400'
                          : 'border-transparent'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3 h-3 text-white fill-white" />}
                      </div>

                      {/* Diente */}
                      <div className="w-7 h-7 bg-slate-800 text-white rounded text-[10px] font-bold flex items-center justify-center shrink-0">
                        {proc.diente_numero === '0' ? 'G' : proc.diente_numero}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-800 truncate">{proc.procedimiento}</p>
                        {proc.superficies_afectadas?.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {proc.superficies_afectadas.map(s => (
                              <span key={s} className="text-[8px] bg-red-50 text-red-600 px-1 font-bold rounded">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Precio */}
                      <div className="text-[11px] font-black text-slate-700 shrink-0">
                        ${proc.precio?.toFixed(2) || '0.00'}
                      </div>

                      {/* Estado */}
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Proformas ya generadas ── */}
      {plan.proformas_generadas?.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-teal-700 mb-2 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Proformas generadas ({plan.proformas_generadas.length})
          </p>
          <div className="space-y-1">
            {plan.proformas_generadas.map((id, i) => (
              <p key={id} className="text-[10px] text-teal-600 font-medium">
                #{i + 1} · {id}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanFinancialView;
