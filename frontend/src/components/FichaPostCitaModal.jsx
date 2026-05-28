/**
 * FichaPostCitaModal.jsx
 * Modal para completar la ficha clínica de una cita ya creada.
 * Recepción puede abrirlo desde el botón "📋 Ficha" en la lista de citas.
 *
 * Props:
 *   appointment — objeto cita {id, nombre_completo, cedula, especialidad, fecha, hora}
 *   token       — JWT
 *   onClose     — fn()
 *   onSuccess   — fn()
 */

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: "16px",
  },
  modal: {
    background: "white", borderRadius: "14px",
    width: "100%", maxWidth: "520px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    maxHeight: "92vh", display: "flex", flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "16px 20px", borderBottom: "1px solid #F3F4F6",
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    flexShrink: 0,
  },
  body: { overflowY: "auto", padding: "16px 20px", flex: 1 },
  footer: {
    padding: "12px 20px", borderTop: "1px solid #F3F4F6",
    display: "flex", gap: "10px", flexShrink: 0,
  },
  section: {
    background: "#F8FAFF", border: "1px solid #E0EDFF",
    borderRadius: "10px", padding: "12px 14px", marginBottom: "10px",
  },
  sectionRed: {
    background: "#FFF5F5", border: "1px solid #FCA5A5",
    borderRadius: "10px", padding: "12px 14px", marginBottom: "10px",
  },
  title: { fontSize: "12px", fontWeight: "700", color: "#1E40AF", marginBottom: "10px" },
  titleRed: { fontSize: "12px", fontWeight: "700", color: "#DC2626", marginBottom: "10px", display: "flex", alignItems: "center", gap: "5px" },
  lbl: { fontSize: "11px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "3px", textTransform: "uppercase" },
  inp: { width: "100%", padding: "7px 10px", border: "1.5px solid #BFDBFE", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", outline: "none" },
  inpRed: { width: "100%", padding: "7px 10px", border: "1.5px solid #FCA5A5", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box", outline: "none" },
  checkGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" },
  check: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151", cursor: "pointer" },
  btnPrimary: {
    flex: 1, padding: "10px", background: "#0C4A6E", color: "white",
    border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
  },
  btnSecondary: {
    padding: "10px 16px", background: "#F3F4F6", color: "#374151",
    border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer",
  },
};

const ANTECEDENTES = [
  { key: "diabetes",     label: "Diabetes" },
  { key: "hipertension", label: "Hipertensión" },
  { key: "cardiopatias", label: "Cardiopatías" },
  { key: "asma",         label: "Asma" },
  { key: "epilepsia",    label: "Epilepsia" },
  { key: "hepatitis",    label: "Hepatitis" },
  { key: "vih",          label: "VIH+" },
  { key: "embarazo",     label: "Embarazo actual" },
];

const defaultFicha = () => ({
  diabetes: false, hipertension: false, cardiopatias: false,
  hepatitis: false, vih: false, epilepsia: false, asma: false, embarazo: false,
  alergias_medicamentos: "", medicamentos_actuales: "",
  ant_personales: "", ant_quirurgicos: "", ant_familiares: "",
  motivo_consulta: "", observaciones_recepcion: "",
});

export function FichaPostCitaModal({ appointment, token, onClose, onSuccess }) {
  const [ficha,   setFicha]   = useState(defaultFicha());
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [preloaded, setPreloaded] = useState(false);

  const setF = (field, value) => setFicha(f => ({ ...f, [field]: value }));

  // Cargar antecedentes previos si hay cédula
  useEffect(() => {
    const cargar = async () => {
      const cedula = appointment?.cedula;
      if (!cedula || !token) { setLoading(false); return; }
      try {
        const res = await axios.get(`${API}/antecedentes-paciente/${cedula}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.tiene_antecedentes) {
          setFicha(f => ({
            ...f,
            diabetes:              res.data.diabetes              || f.diabetes,
            hipertension:          res.data.hipertension          || f.hipertension,
            cardiopatias:          res.data.cardiopatias          || f.cardiopatias,
            hepatitis:             res.data.hepatitis             || f.hepatitis,
            vih:                   res.data.vih                   || f.vih,
            epilepsia:             res.data.epilepsia             || f.epilepsia,
            asma:                  res.data.asma                  || f.asma,
            alergias_medicamentos: res.data.alergias_medicamentos || f.alergias_medicamentos,
            medicamentos_actuales: res.data.medicamentos_actuales || f.medicamentos_actuales,
            ant_personales:        res.data.ant_personales        || f.ant_personales,
            ant_quirurgicos:       res.data.ant_quirurgicos       || f.ant_quirurgicos,
            ant_familiares:        res.data.ant_familiares        || f.ant_familiares,
          }));
          setPreloaded(true);
        }
      } catch {}
      setLoading(false);
    };
    cargar();
  }, [appointment?.cedula, token]);

  const handleSave = async () => {
    const cedula = appointment?.cedula;
    if (!cedula) {
      toast.error("Esta cita no tiene cédula registrada. Edite la cita primero.");
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/antecedentes-paciente/${cedula}`, ficha, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("✅ Ficha clínica guardada");
      onSuccess();
    } catch {
      toast.error("Error al guardar la ficha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0C4A6E" }}>
              📋 Ficha Clínica Previa
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6B7280" }}>
              {appointment?.nombre_completo} · {appointment?.especialidad}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
              {appointment?.fecha} {appointment?.hora}
              {appointment?.cedula ? ` · CI: ${appointment.cedula}` : " · Sin cédula registrada"}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
            <X size={18} color="#9CA3AF" />
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px", color: "#6B7280" }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
              Cargando antecedentes previos...
            </div>
          ) : (
            <>
              {preloaded && (
                <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "8px", padding: "6px 12px", marginBottom: "12px", fontSize: "11px", color: "#15803D" }}>
                  ✅ Antecedentes previos cargados desde historial
                </div>
              )}
              {!appointment?.cedula && (
                <div style={{ background: "#FEF9C3", border: "1px solid #FDE047", borderRadius: "8px", padding: "8px 12px", marginBottom: "12px", fontSize: "12px", color: "#854D0E" }}>
                  ⚠️ Sin cédula: los antecedentes no se podrán guardar por paciente. Edite la cita primero para agregar la cédula.
                </div>
              )}

              {/* Alergias */}
              <div style={S.sectionRed}>
                <div style={S.titleRed}><AlertTriangle size={13} /> Alergias y Medicamentos</div>
                <div style={{ marginBottom: "8px" }}>
                  <label style={S.lbl}>Alergias a medicamentos</label>
                  <input value={ficha.alergias_medicamentos} onChange={e => setF("alergias_medicamentos", e.target.value)} placeholder="Penicilina, ibuprofeno... — vacío si no hay" style={S.inpRed} />
                </div>
                <div>
                  <label style={S.lbl}>Medicamentos actuales</label>
                  <input value={ficha.medicamentos_actuales} onChange={e => setF("medicamentos_actuales", e.target.value)} placeholder="Metformina 500mg, losartán..." style={S.inp} />
                </div>
              </div>

              {/* Antecedentes patológicos */}
              <div style={S.section}>
                <div style={S.title}>🩺 Antecedentes Patológicos</div>
                <div style={S.checkGrid}>
                  {ANTECEDENTES.map(({ key, label }) => (
                    <label key={key} style={S.check}>
                      <input type="checkbox" checked={ficha[key] || false} onChange={e => setF(key, e.target.checked)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Historia libre */}
              <div style={S.section}>
                <div style={S.title}>📝 Historia Previa</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <label style={S.lbl}>Antecedentes personales</label>
                    <textarea value={ficha.ant_personales} onChange={e => setF("ant_personales", e.target.value)} placeholder="Enfermedades previas, hospitalizaciones..." style={{ ...S.inp, minHeight: "44px", resize: "vertical" }} />
                  </div>
                  <div>
                    <label style={S.lbl}>Antecedentes quirúrgicos</label>
                    <input value={ficha.ant_quirurgicos} onChange={e => setF("ant_quirurgicos", e.target.value)} placeholder="Operaciones previas" style={S.inp} />
                  </div>
                  <div>
                    <label style={S.lbl}>Antecedentes familiares</label>
                    <input value={ficha.ant_familiares} onChange={e => setF("ant_familiares", e.target.value)} placeholder="Diabetes, cáncer, cardiopatías en familia" style={S.inp} />
                  </div>
                  <div>
                    <label style={S.lbl}>Motivo de consulta</label>
                    <input value={ficha.motivo_consulta} onChange={e => setF("motivo_consulta", e.target.value)} placeholder="Motivo principal de esta visita" style={S.inp} />
                  </div>
                  <div>
                    <label style={S.lbl}>Observaciones de recepción</label>
                    <textarea value={ficha.observaciones_recepcion} onChange={e => setF("observaciones_recepcion", e.target.value)} placeholder="Notas internas, urgencia, contexto..." style={{ ...S.inp, minHeight: "40px", resize: "vertical" }} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button onClick={handleSave} disabled={saving || loading || !appointment?.cedula} style={{ ...S.btnPrimary, background: (saving || !appointment?.cedula) ? "#93C5FD" : "#0C4A6E", cursor: (saving || !appointment?.cedula) ? "not-allowed" : "pointer" }}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : "✓ Guardar Ficha"}
          </button>
          <button onClick={onClose} disabled={saving} style={S.btnSecondary}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
