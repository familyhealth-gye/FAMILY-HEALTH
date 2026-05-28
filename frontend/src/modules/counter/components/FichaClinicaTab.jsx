/**
 * FichaClinicaTab.jsx
 * Tab 2 del modal de nueva cita: ficha clínica previa desde recepción.
 * Captura antecedentes, alergias, medicamentos y notas antes de la consulta.
 *
 * Props:
 *   ficha       — estado del formulario clínico
 *   setF        — setter de campo individual (field, value)
 *   antecPreload — objeto si hay antecedentes precargados (para mostrar badge)
 */

import { AlertTriangle } from "lucide-react";
import { S } from "./modalStyles";

const ANTECEDENTES_PATOLOGICOS = [
  { key: "diabetes",     label: "Diabetes" },
  { key: "hipertension", label: "Hipertensión" },
  { key: "cardiopatias", label: "Cardiopatías" },
  { key: "asma",         label: "Asma" },
  { key: "epilepsia",    label: "Epilepsia" },
  { key: "hepatitis",    label: "Hepatitis" },
  { key: "vih",          label: "VIH+" },
  { key: "embarazo",     label: "Embarazo actual" },
];

export function FichaClinicaTab({ ficha, setF, antecPreload }) {
  return (
    <div style={{ paddingTop: "8px" }}>

      {/* Badge de precarga */}
      {antecPreload && (
        <div style={{
          background: "#DCFCE7", border: "1px solid #86EFAC",
          borderRadius: "8px", padding: "6px 12px", marginBottom: "10px",
          fontSize: "11px", color: "#15803D",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          ✅ Antecedentes previos cargados automáticamente desde historial
        </div>
      )}

      {/* ── Alergias — alta prioridad ─────────────────────────────────── */}
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
              placeholder="Penicilina, ibuprofeno... — dejar vacío si no hay"
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

      {/* ── Antecedentes patológicos ──────────────────────────────────── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>
          🩺 Antecedentes Patológicos Personales
        </div>
        <div style={S.checkGrid}>
          {ANTECEDENTES_PATOLOGICOS.map(({ key, label }) => (
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

      {/* ── Historia libre ────────────────────────────────────────────── */}
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
  );
}
