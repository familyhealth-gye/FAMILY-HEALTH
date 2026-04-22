import { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * EvolucionesTab — Tabla de evoluciones por sesión
 * Replica la tabla física: Fecha | Evolución/Hallazgos | Pieza | Doctor
 */
export const EvolucionesTab = ({ pacienteCedula, token }) => {
  const [evoluciones, setEvoluciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pacienteCedula) cargar();
  }, [pacienteCedula]);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/evoluciones-sesion/paciente/${pacienteCedula}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setEvoluciones(res.data || []);
    } catch { setEvoluciones([]); }
    setLoading(false);
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "30px", color: "#999" }}>
      Cargando historial de sesiones...
    </div>
  );

  if (evoluciones.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
      <p style={{ fontSize: "32px", margin: 0 }}>📋</p>
      <p style={{ fontSize: "14px", margin: "8px 0 4px" }}>Sin sesiones registradas</p>
      <p style={{ fontSize: "12px" }}>Las sesiones aparecerán aquí después de cada consulta</p>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#005f73" }}>
          📅 Historial de sesiones — {evoluciones.length} consulta{evoluciones.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Tabla estilo historia física */}
      <div style={{ border: "1.5px solid #b2ebf2", borderRadius: "8px", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "90px 1fr 1fr 120px",
          background: "#00a8cc", color: "white",
          padding: "8px 12px", fontSize: "11px", fontWeight: "700", gap: "8px"
        }}>
          <span>FECHA</span>
          <span>EVOLUCIÓN Y HALLAZGOS</span>
          <span>PROCEDIMIENTOS REALIZADOS</span>
          <span>DOCTOR</span>
        </div>

        {evoluciones.map((ev, idx) => (
          <div key={ev.id || idx} style={{
            display: "grid", gridTemplateColumns: "90px 1fr 1fr 120px",
            padding: "10px 12px", gap: "8px",
            background: idx % 2 === 0 ? "#f8fdff" : "white",
            borderTop: "1px solid #e0f7fa",
            alignItems: "start"
          }}>
            {/* Fecha */}
            <div>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#005f73" }}>
                {ev.fecha ? new Date(ev.fecha + "T12:00:00").toLocaleDateString("es-EC", {
                  day: "2-digit", month: "short", year: "numeric"
                }) : "—"}
              </p>
              {ev.motivo_sesion && (
                <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#666", fontStyle: "italic" }}>
                  {ev.motivo_sesion}
                </p>
              )}
            </div>

            {/* Evolución */}
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#333", lineHeight: "1.4" }}>
                {ev.evolucion || "—"}
              </p>
              {ev.proximo_procedimiento && (
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#d97706",
                  background: "#fffbeb", borderRadius: "4px", padding: "2px 6px", display: "inline-block" }}>
                  ➡️ Próximo: {ev.proximo_procedimiento}
                </p>
              )}
            </div>

            {/* Procedimientos */}
            <div>
              {ev.procedimientos_realizados && ev.procedimientos_realizados.length > 0 ? (
                ev.procedimientos_realizados.map((p, i) => (
                  <div key={i} style={{
                    marginBottom: "3px", fontSize: "12px",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}>
                    <span style={{
                      background: "#00a8cc", color: "white",
                      borderRadius: "4px", padding: "1px 6px", fontSize: "10px",
                      whiteSpace: "nowrap", fontWeight: "700"
                    }}>
                      {p.diente_numero ? `Pza ${p.diente_numero}` : ""}
                    </span>
                    <span style={{ color: "#333" }}>{p.procedimiento}</span>
                    {p.precio > 0 && (
                      <span style={{ color: "#059669", fontWeight: "700", fontSize: "11px", marginLeft: "auto" }}>
                        ${p.precio.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, fontSize: "12px", color: "#999", fontStyle: "italic" }}>
                  Sin detalle de procedimientos
                </p>
              )}
              {ev.total_sesion > 0 && (
                <p style={{ margin: "6px 0 0", fontSize: "11px", fontWeight: "700",
                  color: "#005f73", borderTop: "1px solid #e0f7fa", paddingTop: "4px" }}>
                  Total sesión: ${ev.total_sesion.toFixed(2)}
                </p>
              )}
            </div>

            {/* Doctor */}
            <div>
              <p style={{ margin: 0, fontSize: "12px", color: "#333" }}>
                {ev.doctor_nombre || "—"}
              </p>
              <span style={{
                fontSize: "10px",
                color: ev.estado_pago === "pagado" ? "#059669" : "#d97706",
                fontWeight: "700"
              }}>
                {ev.estado_pago === "pagado" ? "✓ Pagado" : "⏳ Pendiente"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Resumen total */}
      <div style={{
        marginTop: "10px", background: "#f0fbff", border: "1.5px solid #00a8cc",
        borderRadius: "8px", padding: "10px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span style={{ fontSize: "13px", fontWeight: "700", color: "#005f73" }}>
          Total acumulado del paciente:
        </span>
        <span style={{ fontSize: "18px", fontWeight: "800", color: "#00a8cc" }}>
          ${evoluciones.reduce((acc, ev) => acc + (ev.total_sesion || 0), 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
};