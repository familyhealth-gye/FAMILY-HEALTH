/**
 * PreviousSessions.jsx — Hotfix: lee historial legacy + nuevo
 *
 * Lee de dos fuentes en paralelo:
 *   1. GET /plan-tratamiento/paciente/:cedula  → pipeline nuevo (planes_tratamiento)
 *   2. GET /medical-history/odontology/:cedula → historial legacy (medical_history_odontology)
 *
 * Muestra sesiones unificadas ordenadas por fecha descendente.
 * NO migra datos. Solo lectura.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/axios';

const PreviousSessions = ({ patientId, pacienteCedula }) => {
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [expanded, setExpanded]   = useState(null);
  const [error, setError]         = useState(null);

  const fetchHistory = useCallback(async () => {
    // Necesitamos cédula para los endpoints legacy
    const cedula = pacienteCedula;
    if (!cedula && !patientId) return;

    setLoading(true);
    setError(null);
    const results = [];

    // 1. Pipeline nuevo
    try {
      const res = await apiClient.get(`/plan-tratamiento/paciente/${cedula}`);
      const plan = res.data;
      if (plan?.procedimientos?.length > 0) {
        const realizados = plan.procedimientos
          .filter(p => ['realizado', 'cobrado'].includes(p.estado_pipeline))
          .map(p => ({
            id:          p.id,
            fecha:       p.fecha_realizado || plan.fecha_creacion || '',
            tipo:        'pipeline_v2',
            titulo:      p.procedimiento,
            detalle:     p.descripcion || '',
            diente:      p.diente_numero !== '0' ? `Pieza ${p.diente_numero}` : 'General',
            estado:      p.estado_pipeline,
            precio:      p.precio,
          }));
        results.push(...realizados);
      }
    } catch {}

    // 2. Historial legacy (medical_history_odontology)
    try {
      const cedula_q = cedula || '';
      const res = await apiClient.get(`/medical-history/odontology/${cedula_q}`);
      const historias = Array.isArray(res.data) ? res.data : [res.data].filter(Boolean);
      historias.forEach(h => {
        if (!h) return;
        results.push({
          id:      h.id || h._id || Math.random().toString(),
          fecha:   h.fecha || h.created_at || '',
          tipo:    'legacy',
          titulo:  h.motivo_consulta || 'Consulta odontológica',
          detalle: h.procedimientos_realizados || h.diagnostico || '',
          diente:  '',
          estado:  'legacy',
          precio:  null,
        });
      });
    } catch {}

    // 3. Ordenar por fecha descendente y limitar a 10
    results.sort((a, b) => {
      const da = a.fecha ? new Date(a.fecha) : new Date(0);
      const db = b.fecha ? new Date(b.fecha) : new Date(0);
      return db - da;
    });

    setSessions(results.slice(0, 10));
    setLoading(false);
  }, [pacienteCedula, patientId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) return (
    <div className="p-4 flex-1">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sesiones Previas</h3>
      <div className="text-xs text-slate-400 animate-pulse">Cargando historial...</div>
    </div>
  );

  return (
    <div className="p-4 flex-1 overflow-y-auto">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
        Sesiones Previas
        {sessions.length > 0 && (
          <span className="ml-2 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-bold">
            {sessions.length}
          </span>
        )}
      </h3>

      {sessions.length === 0 ? (
        <div className="text-xs text-slate-400 italic">Sin sesiones previas registradas.</div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <div
              key={s.id || i}
              className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm"
            >
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                {/* Indicador de tipo */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  s.tipo === 'pipeline_v2' ? 'bg-green-400' :
                  s.tipo === 'legacy'      ? 'bg-amber-400' : 'bg-slate-300'
                }`} />

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-slate-700 truncate leading-tight">
                    {s.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {s.fecha ? s.fecha.split('T')[0] : 'Sin fecha'}
                    </span>
                    {s.diente && (
                      <span className="text-[9px] text-slate-400">{s.diente}</span>
                    )}
                  </div>
                </div>

                {s.precio > 0 && (
                  <span className="text-[9px] font-bold text-slate-500 shrink-0">${s.precio}</span>
                )}
                {expanded === i
                  ? <ChevronUp className="w-3 h-3 text-slate-300 shrink-0" />
                  : <ChevronDown className="w-3 h-3 text-slate-300 shrink-0" />
                }
              </button>

              {expanded === i && s.detalle && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-50 bg-slate-50/50">
                  <p className="text-[10px] text-slate-500 leading-relaxed whitespace-pre-wrap">
                    {s.detalle}
                  </p>
                  {s.tipo === 'legacy' && (
                    <span className="text-[8px] text-amber-500 font-bold uppercase mt-1 inline-block">
                      Registro legacy
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PreviousSessions;
