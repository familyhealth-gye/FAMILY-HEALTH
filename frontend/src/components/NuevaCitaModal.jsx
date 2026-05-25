/**
 * NuevaCitaModal.jsx
 * Modal único para crear citas, con comportamiento contextual.
 *
 * Contextos soportados:
 *   1. fromAgenda   — usuario abre desde la lista de citas (Agenda)
 *      → muestra todos los campos: paciente, doctor, fecha, hora, especialidad
 *   2. fromPatient  — doctor/recepción abre desde la Historia Clínica de un paciente
 *      → oculta campos de paciente (ya hay contexto) y doctor (es el usuario logueado)
 *      → solo pide fecha, hora, motivo
 *
 * Props:
 *   isOpen          bool
 *   onClose         fn()
 *   onSuccess       fn()         — se llama después de crear la cita (para refrescar)
 *   token           string
 *   user            object       — usuario logueado {role, nombre, especialidad, doctor_id}
 *   // Contexto opcional (fromPatient):
 *   paciente        object|null  — {nombre_completo, cedula, telefono} del paciente abierto
 *   fromPatient     bool         — true cuando se abre desde historia clínica
 */

import { useState, useEffect, useCallback } from "react";
import { normalizeSpecialty } from "@/lib/specialties";
import { CalendarPlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ESPECIALIDADES = [
  "Medicina General",
  "Odontología",
  "Pediatría",
  "Nutrición",
  "Ginecología",
  "Ginecología/Obstetricia",
  "Obstetricia",
  "Ecografía",
];

// Cache de doctores por especialidad
const useDoctores = (especialidad, token) => {
  const [doctores, setDoctores] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const fetchDoctores = useCallback(async () => {
    if (!especialidad || !token) { setDoctores([]); return; }
    setLoadingDocs(true);
    try {
      const res = await axios.get(`${API}/doctors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const todos = Array.isArray(res.data) ? res.data : [];
      // Filtrar por especialidad — comparación normalizada
      const norm = (s) => (s || "").trim().toLowerCase();
      const filtrados = todos.filter(d =>
        norm(d.especialidad) === norm(especialidad) ||
        norm(d.especialidades?.join(",") || "") .includes(norm(especialidad))
      );
      setDoctores(filtrados.length > 0 ? filtrados : todos);
    } catch {
      setDoctores([]);
    } finally {
      setLoadingDocs(false);
    }
  }, [especialidad, token]);

  useEffect(() => { fetchDoctores(); }, [fetchDoctores]);
  return { doctores, loadingDocs };
};

const defaultForm = (user, paciente, fromPatient) => ({
  nombre_completo: paciente?.nombre_completo || paciente?.nombre || "",
  cedula:          paciente?.cedula || "",
  telefono:        paciente?.telefono || "",
  fecha:           new Date().toISOString().split("T")[0],
  hora:            "08:00",
  especialidad:    fromPatient ? (user?.especialidad || "") : "",
  doctor_nombre:   fromPatient ? (user?.nombre_completo || user?.nombre || "") : "",
  doctor_id:       fromPatient ? (user?.doctor_id || "") : "",
  motivo:          "",
});

export const NuevaCitaModal = ({
  isOpen,
  onClose,
  onSuccess,
  token,
  user,
  paciente = null,
  fromPatient = false,
}) => {
  const [form, setForm]       = useState(() => defaultForm(user, paciente, fromPatient));
  const { doctores, loadingDocs } = useDoctores(form.especialidad, token);
  const [saving, setSaving]   = useState(false);

  // Resetear form cuando cambia el contexto o se abre el modal
  useEffect(() => {
    if (isOpen) {
      setForm(defaultForm(user, paciente, fromPatient));
    }
  }, [isOpen, paciente, fromPatient, user]);

  if (!isOpen) return null;

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.nombre_completo.trim()) {
      toast.error("El nombre del paciente es obligatorio");
      return;
    }
    if (!form.fecha) {
      toast.error("La fecha es obligatoria");
      return;
    }
    if (!form.especialidad) {
      toast.error("La especialidad es obligatoria");
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API}/appointments`,
        { ...form, estado: "Programada" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("✅ Cita creada correctamente");
      onClose();
      if (onSuccess) onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  // ── Estilo inline consistente con el resto del sistema ──────────────────────
  const inp = {
    width: "100%", padding: "8px 10px", border: "1.5px solid #BFDBFE",
    borderRadius: "8px", fontSize: "13px", boxSizing: "border-box",
    outline: "none",
  };
  const lbl = {
    fontSize: "12px", fontWeight: "600", color: "#374151",
    display: "block", marginBottom: "4px",
  };
  const row = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
  };
  const full = { gridColumn: "1 / -1" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9998, padding: "16px",
    }}>
      <div style={{
        background: "white", borderRadius: "14px", padding: "24px",
        width: "100%", maxWidth: "500px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
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

        {/* Contexto informativo cuando viene de historia clínica */}
        {fromPatient && paciente && (
          <div style={{
            background: "#EFF6FF", border: "1px solid #BFDBFE",
            borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
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

        {/* Formulario */}
        <div style={{ ...row, marginBottom: "12px" }}>

          {/* Campos de paciente — solo en modo Agenda */}
          {!fromPatient && (
            <>
              <div style={full}>
                <label style={lbl}>Nombre del paciente *</label>
                <input
                  value={form.nombre_completo}
                  onChange={e => set("nombre_completo", e.target.value)}
                  placeholder="Nombre completo"
                  style={inp}
                  autoFocus
                />
              </div>
              <div>
                <label style={lbl}>Cédula</label>
                <input
                  value={form.cedula}
                  onChange={async e => {
                    const cedula = e.target.value;
                    set("cedula", cedula);
                    // Autocompletar si la cédula tiene 10 dígitos
                    if (cedula.length === 10 && token) {
                      try {
                        const res = await axios.get(
                          `${API}/financial/pacientes?search=${cedula}`,
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        const pac = (res.data || []).find(p => p.cedula === cedula);
                        if (pac) {
                          set("nombre_completo", pac.nombre || pac.nombre_completo || form.nombre_completo);
                          set("telefono", pac.telefono || form.telefono);
                        }
                      } catch {}
                    }
                  }}
                  placeholder="0000000000"
                  style={inp}
                  maxLength={13}
                />
              </div>
              <div>
                <label style={lbl}>Teléfono</label>
                <input
                  value={form.telefono}
                  onChange={e => set("telefono", e.target.value)}
                  placeholder="09XXXXXXXX"
                  style={inp}
                />
              </div>
            </>
          )}

          {/* Fecha y hora — siempre visibles */}
          <div>
            <label style={lbl}>Fecha *</label>
            <input
              type="date"
              value={form.fecha}
              onChange={e => set("fecha", e.target.value)}
              style={inp}
              autoFocus={fromPatient}
            />
          </div>
          <div>
            <label style={lbl}>Hora</label>
            <input
              type="time"
              value={form.hora}
              onChange={e => set("hora", e.target.value)}
              style={inp}
            />
          </div>

          {/* Especialidad — editable en Agenda; readonly prefilled en fromPatient */}
          <div style={fromPatient ? undefined : full}>
            <label style={lbl}>Especialidad *</label>
            {fromPatient ? (
              <input
                value={form.especialidad}
                readOnly
                style={{ ...inp, background: "#F9FAFB", color: "#6B7280", cursor: "not-allowed" }}
              />
            ) : (
              <select
                value={form.especialidad}
                onChange={e => set("especialidad", e.target.value)}
                style={inp}
              >
                <option value="">Seleccionar...</option>
                {ESPECIALIDADES.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            )}
          </div>

          {/* Doctor — solo en modo Agenda, select dinámico por especialidad */}
          {!fromPatient && (
            <div>
              <label style={lbl}>Doctor</label>
              {doctores.length > 0 ? (
                <select
                  value={form.doctor_id || ""}
                  onChange={e => {
                    const d = doctores.find(d => d.id === e.target.value);
                    set("doctor_id", d?.id || "");
                    set("doctor_nombre", d?.nombre || d?.nombre_completo || "");
                  }}
                  style={inp}
                >
                  <option value="">Seleccionar doctor...</option>
                  {doctores.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.nombre || d.nombre_completo}
                      {d.especialidad ? ` — ${d.especialidad}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.doctor_nombre}
                  onChange={e => set("doctor_nombre", e.target.value)}
                  placeholder={loadingDocs ? "Cargando doctores..." : "Nombre del doctor"}
                  style={{ ...inp, background: loadingDocs ? "#F9FAFB" : "white" }}
                />
              )}
            </div>
          )}

          {/* Motivo — siempre visible */}
          <div style={full}>
            <label style={lbl}>Motivo de consulta</label>
            <input
              value={form.motivo}
              onChange={e => set("motivo", e.target.value)}
              placeholder="Ej: Control, dolor, revisión..."
              style={inp}
            />
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex: 1, padding: "11px",
              background: saving ? "#93C5FD" : "#0C4A6E",
              color: "white", border: "none", borderRadius: "8px",
              fontSize: "14px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
              : "✓ Crear Cita"
            }
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "11px 16px", background: "#F3F4F6", color: "#374151",
              border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
