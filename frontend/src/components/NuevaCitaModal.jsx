/**
 * NuevaCitaModal.jsx
 * Modal de creación de cita. Capa visual pura — toda la lógica
 * está en módulos separados:
 *
 *   hooks/useCitaForm.js              — estado, submit, autocomplete
 *   modules/counter/hooks/useCitaForm.js   — idem (canonical)
 *   modules/counter/components/DatosCitaTab.jsx   — Tab 1
 *   modules/counter/components/FichaClinicaTab.jsx — Tab 2
 *   modules/counter/components/modalStyles.js      — estilos
 *
 * Props:
 *   isOpen, onClose, onSuccess, token, user, paciente, fromPatient
 */

import { useState, useEffect, useCallback } from "react";
import { CalendarPlus, X, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import axios from "axios";

import { useCitaForm, ESPECIALIDADES } from "@/modules/counter/hooks/useCitaForm";
import { DatosCitaTab }    from "@/modules/counter/components/DatosCitaTab";
import { FichaClinicaTab } from "@/modules/counter/components/FichaClinicaTab";
import { S } from "@/modules/counter/components/modalStyles";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ─── Hook interno: doctores filtrados por especialidad ───────────────────────
function useDoctores(especialidad, token) {
  const [doctores,    setDoctores]    = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const fetch = useCallback(async () => {
    if (!especialidad || !token) { setDoctores([]); return; }
    setLoadingDocs(true);
    try {
      const res = await axios.get(`${API}/doctors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const todos = Array.isArray(res.data) ? res.data : [];
      const norm  = s => (s || "").trim().toLowerCase();
      const filtrados = todos.filter(d =>
        norm(d.especialidad) === norm(especialidad) ||
        norm(d.especialidades?.join(",") || "").includes(norm(especialidad))
      );
      setDoctores(filtrados.length > 0 ? filtrados : todos);
    } catch {
      setDoctores([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [especialidad, token]);

  useEffect(() => { fetch(); }, [fetch]);
  return { doctores, loadingDocs };
}

// ─── Componente principal ────────────────────────────────────────────────────
export const NuevaCitaModal = ({
  isOpen, onClose, onSuccess, token, user,
  paciente = null, fromPatient = false,
}) => {
  const {
    tab, setTab,
    cita, ficha,
    saving, antecPreload,
    setC, setF,
    handleCedulaChange,
    handleSubmit,
  } = useCitaForm({ isOpen, user, paciente, fromPatient, token, onClose, onSuccess });

  const { doctores, loadingDocs } = useDoctores(cita.especialidad, token);

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9998, padding: "16px",
    }}>
      <div style={{
        background: "white", borderRadius: "14px",
        width: "100%", maxWidth: fromPatient ? "480px" : "580px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ padding: "18px 22px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarPlus size={18} color="#0C4A6E" />
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0C4A6E" }}>
                {fromPatient ? "Agendar Cita" : "Nueva Cita"}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
              <X size={18} color="#9CA3AF" />
            </button>
          </div>

          {/* Contexto fromPatient */}
          {fromPatient && paciente && (
            <div style={{
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: "8px", padding: "10px 14px", marginBottom: "14px",
            }}>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#1E40AF" }}>
                👤 {paciente.nombre_completo || paciente.nombre}
              </p>
              {paciente.cedula && (
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#3B82F6" }}>
                  CI: {paciente.cedula}
                </p>
              )}
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#3B82F6" }}>
                Doctor: {user?.nombre_completo || user?.nombre}
                {user?.especialidad ? ` · ${user.especialidad}` : ""}
              </p>
            </div>
          )}

          {/* Tabs (solo en modo Agenda) */}
          {!fromPatient && (
            <div style={{
              display: "flex", gap: "2px", background: "#F3F4F6",
              borderRadius: "10px", padding: "3px", marginBottom: "14px",
            }}>
              {["📅 Datos Cita", "📋 Ficha Clínica"].map((label, i) => (
                <button
                  key={i}
                  onClick={() => setTab(i)}
                  style={{
                    flex: 1, padding: "7px 10px",
                    background: tab === i ? "white" : "transparent",
                    border: "none", borderRadius: "8px", cursor: "pointer",
                    fontSize: "12px", fontWeight: tab === i ? "700" : "500",
                    color: tab === i ? "#0C4A6E" : "#6B7280",
                    boxShadow: tab === i ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Cuerpo scrollable ────────────────────────────────────────── */}
        <div style={{ overflowY: "auto", padding: "0 22px 16px", flex: 1 }}>
          {(tab === 0 || fromPatient) && (
            <DatosCitaTab
              cita={cita}
              setC={setC}
              fromPatient={fromPatient}
              paciente={paciente}
              user={user}
              doctores={doctores}
              loadingDocs={loadingDocs}
              handleCedulaChange={handleCedulaChange}
              ESPECIALIDADES={ESPECIALIDADES}
            />
          )}

          {tab === 1 && !fromPatient && (
            <FichaClinicaTab
              ficha={ficha}
              setF={setF}
              antecPreload={antecPreload}
            />
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div style={{ padding: "12px 22px 18px", flexShrink: 0, borderTop: "1px solid #F3F4F6" }}>
          {/* Navegación entre tabs */}
          {!fromPatient && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              {tab === 1 && (
                <button onClick={() => setTab(0)} style={S.btnOutline}>
                  <ChevronLeft size={14} /> Datos Cita
                </button>
              )}
              {tab === 0 && (
                <button
                  onClick={() => setTab(1)}
                  style={{ ...S.btnOutline, marginLeft: "auto" }}
                  title="Llenar ficha clínica previa (opcional)"
                >
                  Ficha Clínica <ChevronRight size={14} />
                </button>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                ...S.btnPrimary,
                background: saving ? "#93C5FD" : "#0C4A6E",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                : "✓ Crear Cita"
              }
            </button>
            <button onClick={onClose} disabled={saving} style={S.btnSecondary}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
