import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * AntecedentesPanel — Panel de antecedentes reutilizable para todas las especialidades.
 *
 * Comportamiento:
 * - Primera consulta: muestra formulario editable para llenar antecedentes
 * - Consultas siguientes: muestra solo alertas + botón "Ver/Editar antecedentes"
 * - Siempre visible al médico: las alertas de alergia, HTA, diabetes, etc.
 *
 * Props:
 *   cedula: string
 *   token: string
 *   especialidad: string
 *   onLoad: (antecedentes) => void  — callback con los datos cargados
 *   onChange: (antecedentes) => void — callback cuando el doctor edita
 */
export const AntecedentesPanel = ({ cedula, token, especialidad, onLoad, onChange, readOnly = false }) => {
  const [loading, setLoading] = useState(true);
  const [antecedentes, setAntecedentes] = useState(null);
  const [editando, setEditando] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [form, setForm] = useState({
    diabetes: false, hipertension: false, cardiopatias: false,
    hepatitis: false, vih: false, epilepsia: false, embarazo: false, asma: false,
    alergias_medicamentos: "", alergias: "",
    ant_familiares: "", ant_personales: "", ant_quirurgicos: "",
    medicamentos_actuales: "",
  });

  useEffect(() => {
    if (!cedula) return;
    const cargar = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/antecedentes-paciente/${cedula}`,
          { headers: { Authorization: `Bearer ${token}` } });
        setAntecedentes(res.data);
        if (res.data.tiene_antecedentes) {
          const f = {
            diabetes: res.data.diabetes || false,
            hipertension: res.data.hipertension || false,
            cardiopatias: res.data.cardiopatias || false,
            hepatitis: res.data.hepatitis || false,
            vih: res.data.vih || false,
            epilepsia: res.data.epilepsia || false,
            embarazo: res.data.embarazo || false,
            asma: res.data.asma || false,
            alergias_medicamentos: res.data.alergias_medicamentos || "",
            alergias: res.data.alergias || "",
            ant_familiares: res.data.ant_familiares || "",
            ant_personales: res.data.ant_personales || "",
            ant_quirurgicos: res.data.ant_quirurgicos || "",
            medicamentos_actuales: res.data.medicamentos_actuales || "",
          };
          setForm(f);
          if (onLoad) onLoad(f);
        } else {
          // Primera vez — abrir edición automáticamente
          setEditando(true);
        }
      } catch {
        setEditando(true);
      }
      setLoading(false);
    };
    cargar();
  }, [cedula, token]);

  const handleChange = (campo, valor) => {
    const nuevo = { ...form, [campo]: valor };
    setForm(nuevo);
    if (onChange) onChange(nuevo);
  };

  const alertas = antecedentes?.alertas || [];
  const tieneAlertas = alertas.length > 0;
  const esPrimeraVez = antecedentes && !antecedentes.tiene_antecedentes;

  if (loading) return (
    <div style={{ padding: "10px", color: "#999", fontSize: "12px" }}>
      Cargando antecedentes...
    </div>
  );

  // ── Modo solo-lectura (doctor ve datos llenados por counter) ─────────────
  if (readOnly) {
    const alertas = [];
    if (form.alergias_medicamentos) alertas.push(`⚠️ Alérgico: ${form.alergias_medicamentos}`);
    if (form.diabetes)     alertas.push("Diabetes");
    if (form.hipertension) alertas.push("HTA");
    if (form.cardiopatias) alertas.push("Cardiopatías");
    if (form.asma)         alertas.push("Asma");
    if (form.epilepsia)    alertas.push("Epilepsia");
    if (form.embarazo)     alertas.push("Embarazo");
    if (form.vih)          alertas.push("VIH+");

    return (
      <div style={{ marginBottom: "12px" }}>
        {/* Alerta de alergias siempre visible */}
        {form.alergias_medicamentos && (
          <div style={{
            background: "#FEF2F2", border: "1.5px solid #FCA5A5",
            borderRadius: "8px", padding: "8px 12px", marginBottom: "8px",
            fontSize: "12px", fontWeight: "700", color: "#DC2626",
          }}>
            ⚠️ ALERGIA: {form.alergias_medicamentos}
          </div>
        )}
        {/* Resumen colapsable */}
        <button
          onClick={() => setExpandido(e => !e)}
          style={{
            width: "100%", textAlign: "left", background: "#F8FAFF",
            border: "1px solid #BFDBFE", borderRadius: "8px",
            padding: "8px 12px", cursor: "pointer", fontSize: "12px",
            color: "#1E40AF", fontWeight: "600",
            display: "flex", justifyContent: "space-between",
          }}
        >
          <span>📋 Antecedentes del paciente {alertas.length > 0 ? `(${alertas.length} activos)` : "(sin antecedentes)"}</span>
          <span>{expandido ? "▲" : "▼"}</span>
        </button>
        {expandido && (
          <div style={{
            background: "#F8FAFF", border: "1px solid #BFDBFE",
            borderRadius: "0 0 8px 8px", padding: "10px 12px",
            fontSize: "12px", color: "#374151",
          }}>
            {alertas.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                {alertas.map((a, i) => (
                  <span key={i} style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: "10px", padding: "2px 8px", fontSize: "11px", fontWeight: "600" }}>{a}</span>
                ))}
              </div>
            )}
            {form.medicamentos_actuales && <p style={{ margin: "4px 0" }}><strong>Medicamentos:</strong> {form.medicamentos_actuales}</p>}
            {form.ant_personales && <p style={{ margin: "4px 0" }}><strong>Antecedentes:</strong> {form.ant_personales}</p>}
            {form.ant_quirurgicos && <p style={{ margin: "4px 0" }}><strong>Quirúrgicos:</strong> {form.ant_quirurgicos}</p>}
            {form.ant_familiares && <p style={{ margin: "4px 0" }}><strong>Familiares:</strong> {form.ant_familiares}</p>}
            {alertas.length === 0 && !form.medicamentos_actuales && !form.ant_personales && (
              <p style={{ color: "#9CA3AF", margin: 0 }}>Sin antecedentes registrados por recepción</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* ── ALERTAS CRÍTICAS — siempre visibles ── */}
      {tieneAlertas && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "6px",
          marginBottom: "10px"
        }}>
          {alertas.map((a, i) => (
            <div key={i} style={{
              background: a.color, color: "white",
              borderRadius: "8px", padding: "6px 12px",
              display: "flex", alignItems: "center", gap: "6px",
              fontSize: "12px", fontWeight: "700",
              boxShadow: `0 2px 8px ${a.color}44`,
              animation: "pulse 2s infinite"
            }}>
              <span style={{ fontSize: "16px" }}>{a.icono}</span>
              {a.mensaje}
            </div>
          ))}
        </div>
      )}

      {/* ── PRIMERA VEZ: Banner informativo ── */}
      {esPrimeraVez && (
        <div style={{
          background: "#fef3c7", border: "2px solid #d97706",
          borderRadius: "8px", padding: "10px 14px", marginBottom: "10px",
          display: "flex", alignItems: "center", gap: "10px"
        }}>
          <span style={{ fontSize: "20px" }}>📋</span>
          <div>
            <p style={{ margin: 0, fontWeight: "700", color: "#92400e", fontSize: "13px" }}>
              Primera consulta — registre los antecedentes del paciente
            </p>
            <p style={{ margin: 0, color: "#b45309", fontSize: "11px" }}>
              Solo se registran una vez. En próximas consultas aparecerán automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* ── CABECERA con toggle ── */}
      {!esPrimeraVez && (
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: editando ? "10px" : "0"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "700", color: "#374151" }}>
              📂 Antecedentes
            </span>
            {antecedentes?.fuente && (
              <span style={{
                background: "#e0f2fe", color: "#0369a1",
                borderRadius: "4px", padding: "1px 7px", fontSize: "10px"
              }}>
                Registrados en {antecedentes.fuente} · {antecedentes.fecha_registro}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditando(!editando)}
            style={{
              background: editando ? "#fee2e2" : "#f0f9ff",
              color: editando ? "#dc2626" : "#0284c7",
              border: `1px solid ${editando ? "#fca5a5" : "#bae6fd"}`,
              borderRadius: "6px", padding: "3px 10px",
              fontSize: "11px", cursor: "pointer", fontWeight: "600"
            }}>
            {editando ? "✓ Cerrar" : "✏️ Ver / Editar"}
          </button>
        </div>
      )}

      {/* ── RESUMEN compacto cuando no está editando ── */}
      {!editando && antecedentes?.tiene_antecedentes && (
        <div style={{
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: "8px", padding: "8px 12px", marginBottom: "4px"
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {[
              [form.diabetes, "Diabetes", "#d97706"],
              [form.hipertension, "HTA", "#dc2626"],
              [form.cardiopatias, "Cardiopatía", "#dc2626"],
              [form.hepatitis, "Hepatitis", "#d97706"],
              [form.vih, "VIH+", "#dc2626"],
              [form.epilepsia, "Epilepsia", "#7c3aed"],
              [form.embarazo, "Embarazo", "#ec4899"],
            ].filter(([v]) => v).map(([, label, color]) => (
              <span key={label} style={{
                background: color + "22", color, border: `1px solid ${color}44`,
                borderRadius: "4px", padding: "1px 8px", fontSize: "11px", fontWeight: "700"
              }}>{label}</span>
            ))}
            {!form.diabetes && !form.hipertension && !form.cardiopatias &&
             !form.hepatitis && !form.vih && !form.epilepsia && !form.embarazo && (
              <span style={{ color: "#059669", fontSize: "11px" }}>✓ Sin patologías crónicas</span>
            )}
            {form.alergias_medicamentos && (
              <span style={{
                background: "#fee2e2", color: "#dc2626",
                border: "1px solid #fca5a5", borderRadius: "4px",
                padding: "1px 8px", fontSize: "11px", fontWeight: "700"
              }}>⚠️ Alérgico: {form.alergias_medicamentos}</span>
            )}
            {form.medicamentos_actuales && (
              <span style={{ color: "#6b7280", fontSize: "11px" }}>
                💊 {form.medicamentos_actuales}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── FORMULARIO EDITABLE ── */}
      {editando && (
        <div style={{
          border: "1.5px solid #e5e7eb", borderRadius: "10px",
          padding: "14px", background: "#fafafa"
        }}>
          {/* Patologías */}
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "8px" }}>
            Patologías conocidas:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
            {[
              ["diabetes", "🩸 Diabetes"],
              ["hipertension", "❤️ HTA"],
              ["cardiopatias", "🫀 Cardiopatías"],
              ["hepatitis", "🏥 Hepatitis"],
              ["vih", "🔴 VIH"],
              ["epilepsia", "⚡ Epilepsia"],
              ["embarazo", "🤱 Embarazo"],
              ["asma", "💨 Asma"],
            ].map(([k, l]) => (
              <label key={k} style={{
                display: "flex", alignItems: "center", gap: "6px",
                fontSize: "12px", cursor: "pointer",
                color: form[k] ? "#dc2626" : "#374151",
                fontWeight: form[k] ? "700" : "normal"
              }}>
                <Checkbox
                  checked={form[k]}
                  onCheckedChange={v => handleChange(k, v)}
                />
                {l}
              </label>
            ))}
          </div>

          {/* Alergias — campo destacado */}
          <div style={{
            background: form.alergias_medicamentos ? "#fee2e2" : "#f9fafb",
            border: `1.5px solid ${form.alergias_medicamentos ? "#fca5a5" : "#e5e7eb"}`,
            borderRadius: "8px", padding: "10px", marginBottom: "10px"
          }}>
            <Label style={{
              fontSize: "12px", fontWeight: "700",
              color: form.alergias_medicamentos ? "#dc2626" : "#374151"
            }}>
              ⚠️ Alergias a medicamentos {form.alergias_medicamentos ? "(¡ALERTA ACTIVA!)" : "(ninguna conocida)"}
            </Label>
            <Input
              value={form.alergias_medicamentos}
              onChange={e => handleChange("alergias_medicamentos", e.target.value)}
              placeholder="Ej: Penicilina, Ibuprofeno, Sulfas..."
              style={{
                marginTop: "4px", fontSize: "13px",
                borderColor: form.alergias_medicamentos ? "#f87171" : "#e5e7eb",
                background: form.alergias_medicamentos ? "#fff5f5" : "white"
              }}
            />
          </div>

          {/* Antecedentes en grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <Label style={{ fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>
                Antecedentes familiares
              </Label>
              <Textarea
                value={form.ant_familiares}
                onChange={e => handleChange("ant_familiares", e.target.value)}
                placeholder="HTA, diabetes, cáncer familiar..."
                rows={2}
                style={{ fontSize: "12px" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <Label style={{ fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>
                Antecedentes personales
              </Label>
              <Textarea
                value={form.ant_personales}
                onChange={e => handleChange("ant_personales", e.target.value)}
                placeholder="Enfermedades previas..."
                rows={2}
                style={{ fontSize: "12px" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <Label style={{ fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>
                Quirúrgicos / Hospitalizaciones
              </Label>
              <Input
                value={form.ant_quirurgicos}
                onChange={e => handleChange("ant_quirurgicos", e.target.value)}
                placeholder="Cirugías previas..."
                style={{ fontSize: "12px", height: "34px" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <Label style={{ fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>
                Medicamentos actuales
              </Label>
              <Input
                value={form.medicamentos_actuales}
                onChange={e => handleChange("medicamentos_actuales", e.target.value)}
                placeholder="Medicamentos que toma habitualmente..."
                style={{ fontSize: "12px", height: "34px" }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
};
