import { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORES_ESP = {
  "Medicina General": { bg: "#dbeafe", text: "#1e40af" },
  "Pediatría": { bg: "#dcfce7", text: "#166534" },
  "Odontología": { bg: "#fef9c3", text: "#854d0e" },
  "Nutrición": { bg: "#ffe4e6", text: "#9f1239" },
  "Ginecología": { bg: "#f3e8ff", text: "#6b21a8" },
  "Ecografía": { bg: "#e0f2fe", text: "#075985" },
};

/**
 * HistorialLateral — Panel lateral con historial de consultas del paciente
 * Props:
 *   cedula: string
 *   token: string
 *   especialidadActual: string (para resaltar)
 */
export const HistorialLateral = ({ cedula, token, especialidadActual }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    if (!cedula) return;
    const cargar = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/historial-paciente/${cedula}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHistorial(res.data || []);
      } catch {
        setHistorial([]);
      }
      setLoading(false);
    };
    cargar();
  }, [cedula, token]);

  const formatFecha = (fecha) => {
    if (!fecha) return "";
    try {
      return new Date(fecha).toLocaleDateString("es-EC", {
        day: "2-digit", month: "short", year: "numeric"
      });
    } catch { return fecha; }
  };

  return (
    <div style={{
      width: "260px", minWidth: "260px",
      background: "white", borderLeft: "2px solid #e0f7fa",
      display: "flex", flexDirection: "column",
      maxHeight: "100%", overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        background: "#005f73", padding: "12px 14px",
        display: "flex", alignItems: "center", gap: "8px"
      }}>
        <span style={{ fontSize: "16px" }}>📋</span>
        <div>
          <p style={{ color: "white", fontWeight: "700", fontSize: "13px", margin: 0 }}>
            Historial Clínico
          </p>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", margin: 0 }}>
            Solo lectura
          </p>
        </div>
      </div>

      {/* Lista */}
      <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#999", fontSize: "13px" }}>
            Cargando historial...
          </div>
        ) : historial.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#999", fontSize: "13px" }}>
            <p>📭</p>
            <p>Sin consultas previas</p>
          </div>
        ) : (
          historial.map((item, idx) => {
            const colores = COLORES_ESP[item.especialidad] || { bg: "#f3f4f6", text: "#374151" };
            const esActual = idx === 0;
            const estaExpandido = expandido === idx;

            return (
              <div
                key={idx}
                style={{
                  border: esActual
                    ? "2px solid #00a8cc"
                    : "1px solid #e5e7eb",
                  borderRadius: "8px",
                  marginBottom: "6px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "box-shadow 0.2s"
                }}
                onClick={() => setExpandido(estaExpandido ? null : idx)}
              >
                {/* Cabecera item */}
                <div style={{
                  padding: "8px 10px",
                  background: esActual ? "#f0fbff" : "#fafafa"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span style={{
                      background: colores.bg, color: colores.text,
                      borderRadius: "4px", padding: "1px 7px",
                      fontSize: "10px", fontWeight: "700"
                    }}>
                      {item.especialidad}
                    </span>
                    {esActual && (
                      <span style={{
                        background: "#00a8cc", color: "white",
                        borderRadius: "4px", padding: "1px 6px", fontSize: "10px"
                      }}>
                        Última
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 2px", fontSize: "12px", fontWeight: "600", color: "#333" }}>
                    {formatFecha(item.fecha)}
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#666",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.motivo_consulta || "Sin motivo registrado"}
                  </p>
                </div>

                {/* Detalle expandido */}
                {estaExpandido && (
                  <div style={{
                    padding: "8px 10px", borderTop: "1px solid #e5e7eb",
                    background: "white", fontSize: "11px"
                  }}>
                    {item.cie10_codigo && (
                      <div style={{ marginBottom: "4px" }}>
                        <span style={{
                          background: "#005f73", color: "white",
                          borderRadius: "4px", padding: "1px 6px",
                          fontSize: "10px", fontWeight: "700", marginRight: "6px"
                        }}>
                          {item.cie10_codigo}
                        </span>
                        <span style={{ color: "#555" }}>{item.cie10_descripcion}</span>
                      </div>
                    )}
                    {item.diagnostico && (
                      <p style={{ margin: "4px 0", color: "#444" }}>
                        <b>Dx:</b> {item.diagnostico}
                      </p>
                    )}
                    {item.doctor_nombre && (
                      <p style={{ margin: "4px 0", color: "#666" }}>
                        <b>Dr:</b> {item.doctor_nombre}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "8px 12px", borderTop: "1px solid #e5e7eb",
        background: "#f8fdff"
      }}>
        <p style={{ margin: 0, fontSize: "11px", color: "#999", textAlign: "center" }}>
          {historial.length} consulta{historial.length !== 1 ? "s" : ""} registrada{historial.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
};
