/**
 * NuevaCitaModal.jsx
 * Modal de creación de cita con Ficha Clínica Previa desde Counter/Recepción.
 *
 * Contextos soportados:
 *   1. fromAgenda   — recepción/admin abre desde Agenda
 *      → Tab 1: Datos cita (paciente, doctor, fecha, hora, especialidad)
 *      → Tab 2: Ficha previa (antecedentes, alergias, medicamentos, dirección, responsable)
 *   2. fromPatient  — abre desde Historia Clínica de un paciente
 *      → Solo fecha/hora/motivo (paciente ya está en contexto)
 *
 * Props:
 *   isOpen          bool
 *   onClose         fn()
 *   onSuccess       fn()
 *   token           string
 *   user            object   {role, nombre, especialidad, doctor_id}
 *   paciente        object|null
 *   fromPatient     bool
 */

import { useState, useEffect, useCallback } from "react";
import { normalizeSpecialty } from "@/lib/specialties";
import { CalendarPlus, X, Loader2, ChevronRight, ChevronLeft, User, ClipboardList, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ESPECIALIDADES = [
  "Medicina General", "Odontología", "Pediatría", "Nutrición",
  "Ginecología", "Ginecología/Obstetricia", "Obstetricia", "Ecografía",
];

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
      const norm = (s) => (s || "").trim().toLowerCase();
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

  useEffect(() => { fetchDoctores(); }, [fetchDoctores]);
  return { doctores, loadingDocs };
};

const getLocalDate = () => new Date().toLocaleDateString("en-CA");

const defaultCita = (user, paciente, fromPatient) => ({
  nombre_completo: paciente?.nombre_completo || paciente?.nombre || "",
  cedula:          paciente?.cedula || "",
  telefono:        paciente?.telefono || "",
  fecha_nacimiento: "",
  sexo:            "",
  email:           "",
  direccion:       "",
  fecha:           getLocalDate(),
  hora:            "08:00",
  especialidad:    fromPatient ? (user?.especialidad || "") : "",
  doctor_nombre:   fromPatient ? (user?.nombre_completo || user?.nombre || "") : "",
  doctor_id:       fromPatient ? (user?.doctor_id || "") : "",
  observaciones:   "",
  // Responsable (menores de edad)
  es_menor:               false,
  representante_nombre:   "",
  representante_cedula:   "",
  representante_telefono: "",
  representante_parentesco: "",
});

const defaultFicha = () => ({
  // Antecedentes patológicos
  diabetes:       false,
  hipertension:   false,
  cardiopatias:   false,
  hepatitis:      false,
  vih:            false,
  epilepsia:      false,
  asma:           false,
  embarazo:       false,
  // Texto libre
  alergias_medicamentos: "",
  medicamentos_actuales: "",
  ant_personales:        "",
  ant_quirurgicos:       "",
  ant_familiares:        "",
  // Motivo ampliado
  motivo_consulta: "",
  observaciones_recepcion: "",
});

// ─── Estilos compartidos ────────────────────────────────────────────────────
const S = {
  inp: {
    width: "100%", padding: "8px 10px", border: "1.5px solid #BFDBFE",
    borderRadius: "8px", fontSize: "13px", boxSizing: "border-box",
    outline: "none", background: "white",
  },
  inpSm: {
    width: "100%", padding: "6px 10px", border: "1.5px solid #BFDBFE",
    borderRadius: "7px", fontSize: "12px", boxSizing: "border-box",
    outline: "none", background: "white",
  },
  lbl: {
    fontSize: "11px", fontWeight: "600", color: "#374151",
    display: "block", marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.03em",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  full: { gridColumn: "1 / -1" },
  section: {
    background: "#F8FAFF", border: "1px solid #E0EDFF",
    borderRadius: "10px", padding: "12px 14px", marginBottom: "10px",
  },
  sectionTitle: {
    fontSize: "12px", fontWeight: "700", color: "#1E40AF",
    marginBottom: "10px", display: "flex", alignItems: "center", gap: "5px",
  },
  checkbox: { display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151", cursor: "pointer" },
  checkGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" },
  btnPrimary: {
    flex: 1, padding: "11px", background: "#0C4A6E", color: "white",
    border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
  },
  btnSecondary: {
    padding: "11px 16px", background: "#F3F4F6", color: "#374151",
    border: "none", borderRadius: "8px", fontSize: "13px", cursor: "pointer",
  },
  btnOutline: {
    padding: "11px 16px", background: "white", color: "#0C4A6E",
    border: "1.5px solid #0C4A6E", borderRadius: "8px", fontSize: "13px",
    fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
  },
};

export const NuevaCitaModal = ({
  isOpen, onClose, onSuccess, token, user, paciente = null, fromPatient = false,
}) => {
  const [tab, setTab]           = useState(0); // 0 = cita, 1 = ficha
  const [cita, setCita]         = useState(() => defaultCita(user, paciente, fromPatient));
  const [ficha, setFicha]       = useState(() => defaultFicha());
  const [saving, setSaving]     = useState(false);
  const [antecPreload, setAntecPreload] = useState(null); // antecedentes existentes del paciente

  const { doctores, loadingDocs } = useDoctores(cita.especialidad, token);

  // Resetear al abrir
  useEffect(() => {
    if (isOpen) {
      setTab(0);
      setCita(defaultCita(user, paciente, fromPatient));
      setFicha(defaultFicha());
      setAntecPreload(null);
    }
  }, [isOpen, paciente, fromPatient, user]);

  // Cargar antecedentes previos cuando hay cédula con 10 dígitos
  const cargarAntecedentes = useCallback(async (cedula) => {
    if (!cedula || cedula.length < 10 || !token) return;
    try {
      const res = await axios.get(`${API}/antecedentes-paciente/${cedula}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.tiene_antecedentes) {
        setAntecPreload(res.data);
        setFicha(f => ({
          ...f,
          diabetes:              res.data.diabetes      || f.diabetes,
          hipertension:          res.data.hipertension  || f.hipertension,
          cardiopatias:          res.data.cardiopatias  || f.cardiopatias,
          hepatitis:             res.data.hepatitis     || f.hepatitis,
          vih:                   res.data.vih           || f.vih,
          epilepsia:             res.data.epilepsia     || f.epilepsia,
          asma:                  res.data.asma          || f.asma,
          alergias_medicamentos: res.data.alergias_medicamentos || f.alergias_medicamentos,
          medicamentos_actuales: res.data.medicamentos_actuales || f.medicamentos_actuales,
          ant_personales:        res.data.ant_personales        || f.ant_personales,
          ant_quirurgicos:       res.data.ant_quirurgicos       || f.ant_quirurgicos,
          ant_familiares:        res.data.ant_familiares        || f.ant_familiares,
        }));
      }
    } catch {}
  }, [token]);

  if (!isOpen) return null;

  const setC = (field, value) => setCita(f => ({ ...f, [field]: value }));
  const setF = (field, value) => setFicha(f => ({ ...f, [field]: value }));

  const handleCedulaChange = async (cedula) => {
    setC("cedula", cedula);
    if (cedula.length === 10 && token) {
      try {
        const res = await axios.get(`${API}/financial/pacientes?search=${cedula}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const pac = (res.data || []).find(p => p.cedula === cedula);
        if (pac) {
          setC("nombre_completo", pac.nombre || pac.nombre_completo || cita.nombre_completo);
          setC("telefono",        pac.telefono  || cita.telefono);
          setC("email",           pac.email     || cita.email);
          setC("direccion",       pac.direccion || cita.direccion);
          setC("fecha_nacimiento", pac.fecha_nacimiento || cita.fecha_nacimiento);
          setC("sexo",            pac.sexo || cita.sexo);
        }
      } catch {}
      await cargarAntecedentes(cedula);
    }
  };

  const handleSubmit = async () => {
    if (!cita.nombre_completo.trim()) { toast.error("El nombre del paciente es obligatorio"); return; }
    if (!cita.fecha)                   { toast.error("La fecha es obligatoria"); return; }
    if (!cita.especialidad)            { toast.error("La especialidad es obligatoria"); return; }

    setSaving(true);
    try {
      // 1. Crear la cita con motivo ampliado
      const payload = {
        ...cita,
        estado: "Programada",
        observaciones: ficha.motivo_consulta || cita.observaciones,
        // Campos clínicos adicionales que el backend acepta
        motivo_consulta: ficha.motivo_consulta || cita.observaciones,
      };
      await axios.post(`${API}/appointments`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 2. Guardar antecedentes si la cédula está presente y hay datos
      const hayFicha = Object.entries(ficha).some(([k, v]) => {
        if (k === "motivo_consulta" || k === "observaciones_recepcion") return false;
        return typeof v === "boolean" ? v : (v && v.toString().trim().length > 0);
      });

      if (cita.cedula && hayFicha) {
        try {
          await axios.put(`${API}/antecedentes-paciente/${cita.cedula}`, ficha, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // No bloquear si falla el guardado de antecedentes
        }
      }

      toast.success("✅ Cita creada" + (hayFicha ? " con ficha clínica" : ""));
      onClose();
      if (onSuccess) onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  };

  const isFromPatient = fromPatient;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9998, padding: "16px",
    }}>
      <div style={{
        background: "white", borderRadius: "14px",
        width: "100%", maxWidth: isFromPatient ? "480px" : "580px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        maxHeight: "92vh", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ padding: "18px 22px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarPlus size={18} color="#0C4A6E" />
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0C4A6E" }}>
                {isFromPatient ? "Agendar Cita" : "Nueva Cita"}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
              <X size={18} color="#9CA3AF" />
            </button>
          </div>

          {/* ── Contexto fromPatient ─────────────────────────────────────── */}
          {isFromPatient && paciente && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px" }}>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: "600", color: "#1E40AF" }}>
                👤 {paciente.nombre_completo || paciente.nombre}
              </p>
              {paciente.cedula && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#3B82F6" }}>CI: {paciente.cedula}</p>}
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#3B82F6" }}>
                Doctor: {user?.nombre_completo || user?.nombre}{user?.especialidad ? ` · ${user.especialidad}` : ""}
              </p>
            </div>
          )}

          {/* ── Tabs (solo en modo Agenda) ────────────────────────────────── */}
          {!isFromPatient && (
            <div style={{ display: "flex", gap: "2px", background: "#F3F4F6", borderRadius: "10px", padding: "3px", marginBottom: "14px" }}>
              {[
                { label: "📅 Datos Cita", icon: <User size={13}/> },
                { label: "📋 Ficha Clínica", icon: <ClipboardList size={13}/> },
              ].map((t, i) => (
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
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Indicador de antecedentes precargados */}
          {!isFromPatient && antecPreload && tab === 1 && (
            <div style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "8px", padding: "6px 12px", marginBottom: "10px", fontSize: "11px", color: "#15803D", display: "flex", alignItems: "center", gap: "5px" }}>
              ✅ Antecedentes previos cargados automáticamente desde historial
            </div>
          )}
        </div>

        {/* ── Cuerpo scrollable ────────────────────────────────────────────── */}
        <div style={{ overflowY: "auto", padding: "0 22px 16px", flex: 1 }}>

          {/* ════════════════════════════════════════
              TAB 0 — DATOS DE CITA
              ════════════════════════════════════════ */}
          {(tab === 0 || isFromPatient) && (
            <div style={{ paddingTop: "8px" }}>
              <div style={{ ...S.row2, marginBottom: "10px" }}>

                {!isFromPatient && (
                  <>
                    <div style={S.full}>
                      <label style={S.lbl}>Nombre del paciente *</label>
                      <input
                        value={cita.nombre_completo}
                        onChange={e => setC("nombre_completo", e.target.value)}
                        placeholder="Nombre completo"
                        style={S.inp}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label style={S.lbl}>Cédula</label>
                      <input
                        value={cita.cedula}
                        onChange={e => handleCedulaChange(e.target.value)}
                        placeholder="0000000000"
                        style={S.inp}
                        maxLength={13}
                      />
                    </div>
                    <div>
                      <label style={S.lbl}>Teléfono</label>
                      <input
                        value={cita.telefono}
                        onChange={e => setC("telefono", e.target.value)}
                        placeholder="09XXXXXXXX"
                        style={S.inp}
                      />
                    </div>
                    <div>
                      <label style={S.lbl}>Fecha nacimiento</label>
                      <input
                        type="date"
                        value={cita.fecha_nacimiento}
                        onChange={e => setC("fecha_nacimiento", e.target.value)}
                        style={S.inp}
                      />
                    </div>
                    <div>
                      <label style={S.lbl}>Sexo</label>
                      <select value={cita.sexo} onChange={e => setC("sexo", e.target.value)} style={S.inp}>
                        <option value="">Seleccionar...</option>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                    <div style={S.full}>
                      <label style={S.lbl}>Dirección</label>
                      <input
                        value={cita.direccion}
                        onChange={e => setC("direccion", e.target.value)}
                        placeholder="Dirección del paciente"
                        style={S.inp}
                      />
                    </div>
                  </>
                )}

                {/* Fecha y hora — siempre visibles */}
                <div>
                  <label style={S.lbl}>Fecha *</label>
                  <input
                    type="date"
                    value={cita.fecha}
                    onChange={e => setC("fecha", e.target.value)}
                    style={S.inp}
                    autoFocus={isFromPatient}
                  />
                </div>
                <div>
                  <label style={S.lbl}>Hora</label>
                  <input
                    type="time"
                    value={cita.hora}
                    onChange={e => setC("hora", e.target.value)}
                    style={S.inp}
                  />
                </div>

                {/* Especialidad */}
                <div style={isFromPatient ? undefined : S.full}>
                  <label style={S.lbl}>Especialidad *</label>
                  {isFromPatient ? (
                    <input value={cita.especialidad} readOnly style={{ ...S.inp, background: "#F9FAFB", color: "#6B7280", cursor: "not-allowed" }} />
                  ) : (
                    <select value={cita.especialidad} onChange={e => setC("especialidad", e.target.value)} style={S.inp}>
                      <option value="">Seleccionar...</option>
                      {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  )}
                </div>

                {/* Doctor — solo en Agenda */}
                {!isFromPatient && (
                  <div>
                    <label style={S.lbl}>Doctor</label>
                    {doctores.length > 0 ? (
                      <select
                        value={cita.doctor_id || ""}
                        onChange={e => {
                          const d = doctores.find(d => d.id === e.target.value);
                          setC("doctor_id", d?.id || "");
                          setC("doctor_nombre", d?.nombre || d?.nombre_completo || "");
                        }}
                        style={S.inp}
                      >
                        <option value="">Seleccionar doctor...</option>
                        {doctores.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.nombre || d.nombre_completo}{d.especialidad ? ` — ${d.especialidad}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={cita.doctor_nombre}
                        onChange={e => setC("doctor_nombre", e.target.value)}
                        placeholder={loadingDocs ? "Cargando doctores..." : "Nombre del doctor"}
                        style={{ ...S.inp, background: loadingDocs ? "#F9FAFB" : "white" }}
                      />
                    )}
                  </div>
                )}

                {/* Motivo */}
                <div style={S.full}>
                  <label style={S.lbl}>Motivo de consulta</label>
                  <input
                    value={cita.observaciones}
                    onChange={e => setC("observaciones", e.target.value)}
                    placeholder="Ej: Control, dolor, revisión..."
                    style={S.inp}
                  />
                </div>

                {/* Responsable (menores) — solo en Agenda */}
                {!isFromPatient && (
                  <div style={S.full}>
                    <label style={{ ...S.lbl, marginBottom: "8px" }}>
                      <input
                        type="checkbox"
                        checked={cita.es_menor}
                        onChange={e => setC("es_menor", e.target.checked)}
                        style={{ marginRight: "5px" }}
                      />
                      Es menor de edad / requiere representante
                    </label>
                    {cita.es_menor && (
                      <div style={{ ...S.section, margin: 0 }}>
                        <div style={S.sectionTitle}>👨‍👩‍👧 Datos del Representante</div>
                        <div style={{ ...S.row2 }}>
                          <div style={S.full}>
                            <label style={S.lbl}>Nombre representante</label>
                            <input value={cita.representante_nombre} onChange={e => setC("representante_nombre", e.target.value)} placeholder="Nombre completo" style={S.inpSm} />
                          </div>
                          <div>
                            <label style={S.lbl}>Cédula</label>
                            <input value={cita.representante_cedula} onChange={e => setC("representante_cedula", e.target.value)} placeholder="0000000000" style={S.inpSm} />
                          </div>
                          <div>
                            <label style={S.lbl}>Teléfono</label>
                            <input value={cita.representante_telefono} onChange={e => setC("representante_telefono", e.target.value)} placeholder="09XXXXXXXX" style={S.inpSm} />
                          </div>
                          <div>
                            <label style={S.lbl}>Parentesco</label>
                            <select value={cita.representante_parentesco} onChange={e => setC("representante_parentesco", e.target.value)} style={S.inpSm}>
                              <option value="">Seleccionar...</option>
                              <option value="Madre">Madre</option>
                              <option value="Padre">Padre</option>
                              <option value="Abuelo/a">Abuelo/a</option>
                              <option value="Tutor legal">Tutor legal</option>
                              <option value="Otro">Otro</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              TAB 1 — FICHA CLÍNICA PREVIA
              Solo visible en modo Agenda
              ════════════════════════════════════════ */}
          {tab === 1 && !isFromPatient && (
            <div style={{ paddingTop: "8px" }}>

              {/* Alergias - alta prioridad clínica */}
              <div style={{ ...S.section, borderColor: "#FCA5A5", background: "#FFF5F5" }}>
                <div style={{ ...S.sectionTitle, color: "#DC2626" }}>
                  <AlertTriangle size={13} /> Alergias y Medicamentos Actuales
                </div>
                <div style={S.row2}>
                  <div style={S.full}>
                    <label style={S.lbl}>Alergias a medicamentos</label>
                    <input
                      value={ficha.alergias_medicamentos}
                      onChange={e => setF("alergias_medicamentos", e.target.value)}
                      placeholder="Penicilina, ibuprofeno, etc. — dejar vacío si no hay"
                      style={{ ...S.inpSm, borderColor: "#FCA5A5" }}
                    />
                  </div>
                  <div style={S.full}>
                    <label style={S.lbl}>Medicamentos actuales</label>
                    <input
                      value={ficha.medicamentos_actuales}
                      onChange={e => setF("medicamentos_actuales", e.target.value)}
                      placeholder="Metformina 500mg, losartán, etc."
                      style={S.inpSm}
                    />
                  </div>
                </div>
              </div>

              {/* Antecedentes patológicos */}
              <div style={S.section}>
                <div style={S.sectionTitle}>
                  🩺 Antecedentes Patológicos Personales
                </div>
                <div style={S.checkGrid}>
                  {[
                    { key: "diabetes",     label: "Diabetes" },
                    { key: "hipertension", label: "Hipertensión" },
                    { key: "cardiopatias", label: "Cardiopatías" },
                    { key: "asma",         label: "Asma" },
                    { key: "epilepsia",    label: "Epilepsia" },
                    { key: "hepatitis",    label: "Hepatitis" },
                    { key: "vih",          label: "VIH+" },
                    { key: "embarazo",     label: "Embarazo actual" },
                  ].map(({ key, label }) => (
                    <label key={key} style={S.checkbox}>
                      <input
                        type="checkbox"
                        checked={ficha[key] || false}
                        onChange={e => setF(key, e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Antecedentes texto libre */}
              <div style={S.section}>
                <div style={S.sectionTitle}>📝 Historia Clínica Previa</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>
                    <label style={S.lbl}>Antecedentes personales / patológicos</label>
                    <textarea
                      value={ficha.ant_personales}
                      onChange={e => setF("ant_personales", e.target.value)}
                      placeholder="Enfermedades previas, cirugías anteriores, hospitalizaciones..."
                      style={{ ...S.inpSm, minHeight: "50px", resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <label style={S.lbl}>Antecedentes quirúrgicos</label>
                    <input
                      value={ficha.ant_quirurgicos}
                      onChange={e => setF("ant_quirurgicos", e.target.value)}
                      placeholder="Operaciones previas, fechas aproximadas"
                      style={S.inpSm}
                    />
                  </div>
                  <div>
                    <label style={S.lbl}>Antecedentes familiares</label>
                    <input
                      value={ficha.ant_familiares}
                      onChange={e => setF("ant_familiares", e.target.value)}
                      placeholder="Diabetes, cáncer, cardiopatías en familia directa"
                      style={S.inpSm}
                    />
                  </div>
                  <div>
                    <label style={S.lbl}>Observaciones de recepción</label>
                    <textarea
                      value={ficha.observaciones_recepcion}
                      onChange={e => setF("observaciones_recepcion", e.target.value)}
                      placeholder="Notas internas de recepción, urgencia, contexto especial..."
                      style={{ ...S.inpSm, minHeight: "40px", resize: "vertical" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{ padding: "12px 22px 18px", flexShrink: 0, borderTop: "1px solid #F3F4F6" }}>
          {/* Navegación entre tabs */}
          {!isFromPatient && (
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
              style={{ ...S.btnPrimary, background: saving ? "#93C5FD" : "#0C4A6E", cursor: saving ? "not-allowed" : "pointer" }}
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
