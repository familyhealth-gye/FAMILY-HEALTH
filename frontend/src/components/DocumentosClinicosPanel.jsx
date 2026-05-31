/**
 * DocumentosClinicosPanel.jsx
 * Botones para generar documentos clínicos desde una cita:
 *   - Consentimiento informado (PDF directo)
 *   - Certificado médico (modal con días de reposo + diagnóstico)
 *
 * Diseñado para usarse dentro de AppointmentsWithAttention
 * o en cualquier vista de detalle de cita.
 *
 * Props:
 *   appointment — objeto cita
 *   token       — JWT
 *   compact     — bool (modo compacto para lista de citas)
 */

import { useState } from "react";
import { FileText, Award, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function descargarPdfGet(url, token, nombreArchivo) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 15000);
}

async function descargarPdfPost(url, token, body, nombreArchivo) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 15000);
}

// ─── Modal Certificado ───────────────────────────────────────────────────────

function CertificadoModal({ appointment, token, onClose }) {
  const [form, setForm] = useState({
    dias_reposo:   0,
    diagnostico:   "",
    observaciones: "",
    emisor_nombre: "",  // quién firma — se prerrellena con doctor si existe
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGenerar = async () => {
    if (!form.diagnostico.trim()) { toast.error("Ingrese el diagnóstico"); return; }
    setLoading(true);
    try {
      await descargarPdfPost(
        `${BACKEND_URL}/api/appointments/${appointment.id}/certificado-pdf`,
        token,
        { dias_reposo: form.dias_reposo, diagnostico: form.diagnostico, observaciones: form.observaciones, emisor_nombre: form.emisor_nombre },
        `certificado-${appointment.nombre_completo?.replace(/\s+/g, "-") || appointment.id}.pdf`
      );
      toast.success("✅ Certificado generado");
      onClose();
    } catch (e) {
      toast.error("Error al generar el certificado. Verifique conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 10000, padding: "16px",
    }}>
      <div style={{
        background: "white", borderRadius: "14px", width: "100%", maxWidth: "440px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "#0C4A6E", padding: "16px 20px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={18} color="white" />
            <span style={{ color: "white", fontWeight: "700", fontSize: "15px" }}>
              Certificado Médico
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        {/* Paciente */}
        <div style={{ background: "#EFF6FF", padding: "10px 20px", fontSize: "12px", color: "#1E40AF" }}>
          👤 <strong>{appointment.nombre_completo}</strong>
          {appointment.cedula && <span style={{ marginLeft: "8px", color: "#3B82F6" }}>CI: {appointment.cedula}</span>}
        </div>

        {/* Formulario */}
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px", textTransform: "uppercase" }}>
              Diagnóstico *
            </label>
            <input
              value={form.diagnostico}
              onChange={e => set("diagnostico", e.target.value)}
              placeholder="Ej: Faringitis aguda, Lumbalgia mecánica..."
              autoFocus
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #BFDBFE", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", outline: "none" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px", textTransform: "uppercase" }}>
              Días de reposo
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                onClick={() => set("dias_reposo", Math.max(0, form.dias_reposo - 1))}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1.5px solid #BFDBFE", background: "#F8FAFF", fontSize: "18px", cursor: "pointer", color: "#0C4A6E" }}
              >−</button>
              <span style={{ fontSize: "22px", fontWeight: "700", color: "#0C4A6E", minWidth: "40px", textAlign: "center" }}>
                {form.dias_reposo}
              </span>
              <button
                onClick={() => set("dias_reposo", form.dias_reposo + 1)}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1.5px solid #BFDBFE", background: "#F8FAFF", fontSize: "18px", cursor: "pointer", color: "#0C4A6E" }}
              >+</button>
              <span style={{ fontSize: "12px", color: "#6B7280", marginLeft: "4px" }}>
                {form.dias_reposo === 0 ? "Sin reposo" : form.dias_reposo === 1 ? "día" : "días"}
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px", textTransform: "uppercase" }}>
              Observaciones adicionales
            </label>
            <textarea
              value={form.observaciones}
              onChange={e => set("observaciones", e.target.value)}
              placeholder="Indicaciones, restricciones, medicamentos prescritos..."
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #BFDBFE", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", outline: "none", minHeight: "60px", resize: "vertical" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "5px", textTransform: "uppercase" }}>
              Médico que emite <span style={{ fontWeight: "400", color: "#9CA3AF" }}>(dejar vacío para usar doctor de la cita)</span>
            </label>
            <input
              value={form.emisor_nombre}
              onChange={e => set("emisor_nombre", e.target.value)}
              placeholder={appointment?.doctor_nombre || "Dr. Nombre Apellido"}
              style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #BFDBFE", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", outline: "none" }}
            />
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              onClick={handleGenerar}
              disabled={loading}
              style={{
                flex: 1, padding: "11px", background: loading ? "#93C5FD" : "#0C4A6E",
                color: "white", border: "none", borderRadius: "8px", fontSize: "14px",
                fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              }}
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Generando...</> : "📄 Generar Certificado"}
            </button>
            <button
              onClick={onClose}
              style={{ padding: "11px 16px", background: "#F3F4F6", color: "#374151", border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PROCEDIMIENTOS_CONSENTIMIENTO = [
  "Consulta General",
  "Extracción Simple",
  "Extracción Molar / 3er Molar",
  "Endodoncia",
  "Implante Dental",
  "Prótesis Total",
  "Prótesis Parcial",
  "Corona Dental",
  "Restauración / Resina",
  "Cirugía Periodontal",
  "Injerto Óseo / Tejido",
  "Blanqueamiento Dental",
  "Ortodoncia",
  "Limpieza Profunda",
  "Procedimiento Quirúrgico",
  "Otro procedimiento",
];

function ConsentimientoModal({ appointment, token, onClose }) {
  const [procedimiento, setProcedimiento] = useState(appointment?.especialidad === "Odontología" ? "Consulta General" : "Consulta General");
  const [loading, setLoading] = useState(false);

  const handleGenerar = async () => {
    setLoading(true);
    try {
      await descargarPdfPost(
        `${BACKEND_URL}/api/appointments/${appointment.id}/consentimiento-pdf`,
        token,
        { procedimiento },
        `consentimiento-${(appointment.nombre_completo || appointment.id).replace(/\s+/g, "-")}.pdf`
      );
      toast.success("✅ Consentimiento generado");
      onClose();
    } catch {
      toast.error("Error al generar el consentimiento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:10001,padding:"16px" }}>
      <div style={{ background:"white",borderRadius:"14px",width:"100%",maxWidth:"420px",boxShadow:"0 20px 60px rgba(0,0,0,0.3)",overflow:"hidden" }}>
        <div style={{ background:"#0C4A6E",padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span style={{ color:"white",fontWeight:"700",fontSize:"15px" }}>📋 Consentimiento Informado</span>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:"18px" }}>×</button>
        </div>
        <div style={{ padding:"20px",display:"flex",flexDirection:"column",gap:"14px" }}>
          <div style={{ background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:"8px",padding:"8px 12px",fontSize:"12px",color:"#1E40AF" }}>
            👤 <strong>{appointment.nombre_completo}</strong>
            {appointment.cedula && <span style={{ marginLeft:"8px" }}>CI: {appointment.cedula}</span>}
          </div>
          <div>
            <label style={{ fontSize:"11px",fontWeight:"700",color:"#374151",display:"block",marginBottom:"5px",textTransform:"uppercase" }}>
              Procedimiento a consentir *
            </label>
            <select
              value={procedimiento}
              onChange={e => setProcedimiento(e.target.value)}
              autoFocus
              style={{ width:"100%",padding:"9px 12px",border:"1.5px solid #BFDBFE",borderRadius:"8px",fontSize:"13px",boxSizing:"border-box" }}
            >
              {PROCEDIMIENTOS_CONSENTIMIENTO.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div style={{ display:"flex",gap:"10px" }}>
            <button
              onClick={handleGenerar}
              disabled={loading}
              style={{ flex:1,padding:"11px",background:loading?"#93C5FD":"#0C4A6E",color:"white",border:"none",borderRadius:"8px",fontSize:"14px",fontWeight:"700",cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px" }}
            >
              {loading ? "Generando..." : "📄 Generar PDF"}
            </button>
            <button onClick={onClose} style={{ padding:"11px 16px",background:"#F3F4F6",color:"#374151",border:"none",borderRadius:"8px",fontSize:"13px",cursor:"pointer" }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocumentosClinicosPanel({ appointment, token, compact = false }) {
  const [showCertificado,    setShowCertificado]    = useState(false);
  const [showConsentimiento, setShowConsentimiento] = useState(false);

  const btnBase = {
    border: "1px solid #BFDBFE", borderRadius: "7px",
    background: "#EFF6FF", color: "#1E40AF",
    fontSize: compact ? "11px" : "12px",
    fontWeight: "600", cursor: "pointer",
    display: "flex", alignItems: "center", gap: "4px",
    padding: compact ? "4px 8px" : "6px 12px",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <button
          onClick={() => setShowConsentimiento(true)}
          style={btnBase}
          title="Generar consentimiento informado"
        >
          <FileText size={11} />
          Consentimiento
        </button>

        <button
          onClick={() => setShowCertificado(true)}
          style={btnBase}
          title="Generar certificado médico con días de reposo"
        >
          <Award size={11} />
          Certificado
        </button>
      </div>

      {showConsentimiento && (
        <ConsentimientoModal
          appointment={appointment}
          token={token}
          onClose={() => setShowConsentimiento(false)}
        />
      )}

      {showCertificado && (
        <CertificadoModal
          appointment={appointment}
          token={token}
          onClose={() => setShowCertificado(false)}
        />
      )}
    </>
  );
}
