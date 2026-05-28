/**
 * DatosCitaTab.jsx
 * Tab 1 del modal de nueva cita: datos del paciente, fecha/hora,
 * especialidad, doctor y representante (menores de edad).
 *
 * Props:
 *   cita            — estado del formulario de cita
 *   setC            — setter de campo individual (field, value)
 *   fromPatient     — bool: modo desde historia clínica
 *   paciente        — objeto paciente preseleccionado
 *   user            — usuario logueado
 *   doctores        — array de doctores disponibles (filtrado por especialidad)
 *   loadingDocs     — bool: cargando doctores
 *   handleCedulaChange — handler con autocomplete y carga de antecedentes
 *   ESPECIALIDADES  — array de strings
 */

import { S } from "./modalStyles";

export function DatosCitaTab({
  cita, setC, fromPatient, paciente, user,
  doctores, loadingDocs, handleCedulaChange, ESPECIALIDADES,
}) {
  return (
    <div style={{ paddingTop: "8px" }}>
      <div style={{ ...S.row2, marginBottom: "10px" }}>

        {/* ── Campos solo en modo Agenda ─────────────────────────────── */}
        {!fromPatient && (
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
              <select
                value={cita.sexo}
                onChange={e => setC("sexo", e.target.value)}
                style={S.inp}
              >
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

        {/* ── Fecha y hora ────────────────────────────────────────────── */}
        <div>
          <label style={S.lbl}>Fecha *</label>
          <input
            type="date"
            value={cita.fecha}
            onChange={e => setC("fecha", e.target.value)}
            style={S.inp}
            autoFocus={fromPatient}
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

        {/* ── Especialidad ─────────────────────────────────────────────── */}
        <div style={fromPatient ? undefined : S.full}>
          <label style={S.lbl}>Especialidad *</label>
          {fromPatient ? (
            <input
              value={cita.especialidad}
              readOnly
              style={{ ...S.inp, background: "#F9FAFB", color: "#6B7280", cursor: "not-allowed" }}
            />
          ) : (
            <select
              value={cita.especialidad}
              onChange={e => setC("especialidad", e.target.value)}
              style={S.inp}
            >
              <option value="">Seleccionar...</option>
              {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
        </div>

        {/* ── Doctor (solo Agenda) ─────────────────────────────────────── */}
        {!fromPatient && (
          <div>
            <label style={S.lbl}>Doctor</label>
            {doctores.length > 0 ? (
              <select
                value={cita.doctor_id || ""}
                onChange={e => {
                  const d = doctores.find(d => d.id === e.target.value);
                  setC("doctor_id",     d?.id     || "");
                  setC("doctor_nombre", d?.nombre || d?.nombre_completo || "");
                }}
                style={S.inp}
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
                value={cita.doctor_nombre}
                onChange={e => setC("doctor_nombre", e.target.value)}
                placeholder={loadingDocs ? "Cargando doctores..." : "Nombre del doctor"}
                style={{ ...S.inp, background: loadingDocs ? "#F9FAFB" : "white" }}
              />
            )}
          </div>
        )}

        {/* ── Motivo ───────────────────────────────────────────────────── */}
        <div style={S.full}>
          <label style={S.lbl}>Motivo de consulta</label>
          <input
            value={cita.observaciones}
            onChange={e => setC("observaciones", e.target.value)}
            placeholder="Ej: Control, dolor, revisión..."
            style={S.inp}
          />
        </div>

        {/* ── Representante (menores, solo Agenda) ─────────────────────── */}
        {!fromPatient && (
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
              <DatosRepresentante cita={cita} setC={setC} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponente representante ────────────────────────────────────────────

function DatosRepresentante({ cita, setC }) {
  return (
    <div style={{ ...S.section, margin: 0 }}>
      <div style={S.sectionTitle}>👨‍👩‍👧 Datos del Representante</div>
      <div style={S.row2}>
        <div style={S.full}>
          <label style={S.lbl}>Nombre representante</label>
          <input
            value={cita.representante_nombre}
            onChange={e => setC("representante_nombre", e.target.value)}
            placeholder="Nombre completo"
            style={S.inpSm}
          />
        </div>
        <div>
          <label style={S.lbl}>Cédula</label>
          <input
            value={cita.representante_cedula}
            onChange={e => setC("representante_cedula", e.target.value)}
            placeholder="0000000000"
            style={S.inpSm}
          />
        </div>
        <div>
          <label style={S.lbl}>Teléfono</label>
          <input
            value={cita.representante_telefono}
            onChange={e => setC("representante_telefono", e.target.value)}
            placeholder="09XXXXXXXX"
            style={S.inpSm}
          />
        </div>
        <div>
          <label style={S.lbl}>Parentesco</label>
          <select
            value={cita.representante_parentesco}
            onChange={e => setC("representante_parentesco", e.target.value)}
            style={S.inpSm}
          >
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
  );
}
