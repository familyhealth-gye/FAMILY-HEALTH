import { useState, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * ConfiguracionIA — Panel para que el Administrador configure la API key de Gemini.
 * La key se guarda en MongoDB, nunca se muestra completa.
 */
export const ConfiguracionIA = ({ token }) => {
  const [estado, setEstado] = useState(null); // { configurada, key_preview, costo, actualizado }
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [msg, setMsg] = useState({ tipo: "", texto: "" });

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/configuracion/ia`,
        { headers: { Authorization: `Bearer ${token}` } });
      setEstado(res.data);
    } catch (e) {
      setMsg({ tipo: "error", texto: e.response?.data?.detail || "Error cargando configuración" });
    }
  };

  const guardar = async () => {
    if (!apiKey.trim()) { setMsg({ tipo: "error", texto: "Ingresa la API key" }); return; }
    setLoading(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const res = await axios.post(`${API}/configuracion/ia`,
        { api_key: apiKey.trim() },
        { headers: { Authorization: `Bearer ${token}` } });
      setMsg({ tipo: "ok", texto: res.data.mensaje });
      setApiKey("");
      await cargar();
    } catch (e) {
      setMsg({ tipo: "error", texto: e.response?.data?.detail || "Error al guardar" });
    }
    setLoading(false);
  };

  const eliminar = async () => {
    if (!window.confirm("¿Eliminar la API key? La IA dejará de funcionar.")) return;
    try {
      await axios.delete(`${API}/configuracion/ia`,
        { headers: { Authorization: `Bearer ${token}` } });
      setMsg({ tipo: "ok", texto: "API key eliminada" });
      await cargar();
    } catch (e) {
      setMsg({ tipo: "error", texto: "Error al eliminar" });
    }
  };

  const testIA = async () => {
    setTestLoading(true);
    setMsg({ tipo: "", texto: "" });
    try {
      const res = await axios.post(`${API}/ia/consulta-medica`, {
        mensaje: "Di 'OK' en una palabra.",
        especialidad: "Medicina General",
        contexto_paciente: { nombre: "Test", edad: "30" },
        historial: []
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMsg({ tipo: "ok", texto: `✅ IA funcionando correctamente — Respuesta: "${res.data.respuesta?.slice(0, 50)}..."` });
    } catch (e) {
      setMsg({ tipo: "error", texto: e.response?.data?.detail || "Error al probar la IA" });
    }
    setTestLoading(false);
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "16px" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px" }}>
        <h2 style={{ color: "white", margin: 0, fontSize: "18px", fontWeight: "800" }}>🤖 Configuración IA Médica</h2>
        <p style={{ color: "rgba(255,255,255,0.8)", margin: "4px 0 0", fontSize: "12px" }}>
          Google Gemini Flash · Gratuito · La key se guarda en MongoDB de forma segura
        </p>
      </div>

      {/* Estado actual */}
      {estado && (
        <div style={{
          background: estado.configurada ? "#f0fdf4" : "#fffbeb",
          border: `1.5px solid ${estado.configurada ? "#86efac" : "#fbbf24"}`,
          borderRadius: "10px", padding: "14px 16px", marginBottom: "16px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontWeight: "700", fontSize: "14px", color: estado.configurada ? "#15803d" : "#92400e" }}>
                {estado.configurada ? "✅ IA configurada y lista" : "⚠️ IA no configurada"}
              </p>
              {estado.configurada && (
                <>
                  <p style={{ margin: 0, fontSize: "12px", color: "#555" }}>
                    Key: <code style={{ background: "#e5e7eb", padding: "1px 6px", borderRadius: "4px" }}>{estado.key_preview}</code>
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#666" }}>
                    Modelo: {estado.modelo} · {estado.costo}
                    {estado.actualizado && ` · Actualizado: ${estado.actualizado.slice(0, 10)}`}
                  </p>
                </>
              )}
              {!estado.configurada && (
                <p style={{ margin: 0, fontSize: "12px", color: "#92400e" }}>
                  Obtén tu API key gratuita en{" "}
                  <a href="https://aistudio.google.com" target="_blank" rel="noreferrer"
                    style={{ color: "#6366f1", fontWeight: "700" }}>aistudio.google.com</a>
                </p>
              )}
            </div>
            {estado.configurada && (
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={testIA} disabled={testLoading}
                  style={{ padding: "6px 12px", background: "#6366f1", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: "600" }}>
                  {testLoading ? "⏳ Probando..." : "🧪 Probar IA"}
                </button>
                <button onClick={eliminar}
                  style={{ padding: "6px 10px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>
                  🗑 Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensaje feedback */}
      {msg.texto && (
        <div style={{
          background: msg.tipo === "ok" ? "#f0fdf4" : "#fee2e2",
          border: `1px solid ${msg.tipo === "ok" ? "#86efac" : "#fca5a5"}`,
          borderRadius: "8px", padding: "10px 14px", marginBottom: "14px",
          color: msg.tipo === "ok" ? "#15803d" : "#dc2626", fontSize: "13px"
        }}>
          {msg.texto}
        </div>
      )}

      {/* Formulario para guardar/actualizar key */}
      <div style={{ background: "white", border: "1.5px solid #e0e7ff", borderRadius: "10px", padding: "16px" }}>
        <p style={{ margin: "0 0 12px", fontWeight: "700", fontSize: "13px", color: "#4338ca" }}>
          {estado?.configurada ? "🔄 Actualizar API key" : "➕ Agregar API key"}
        </p>

        {/* Instrucciones */}
        <div style={{ background: "#f5f3ff", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px", fontSize: "12px", color: "#5b21b6" }}>
          <p style={{ margin: "0 0 6px", fontWeight: "700" }}>📋 Cómo obtener tu API key gratuita:</p>
          <ol style={{ margin: 0, paddingLeft: "16px", lineHeight: "1.7" }}>
            <li>Ve a <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>aistudio.google.com</a></li>
            <li>Inicia sesión con tu cuenta Google</li>
            <li>Clic en <strong>"Get API key"</strong> → <strong>"Create API key"</strong></li>
            <li>Copia la key (empieza con <code>AIza...</code>)</li>
            <li>Pégala aquí y guarda</li>
          </ol>
          <p style={{ margin: "6px 0 0", color: "#7c3aed" }}>
            ✅ Plan gratuito: hasta 1,500 consultas/día · Sin costo
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && guardar()}
            placeholder="AIzaSy..."
            style={{
              flex: 1, padding: "10px 14px",
              border: "1.5px solid #c7d2fe", borderRadius: "8px",
              fontSize: "14px", fontFamily: "monospace"
            }}
          />
          <button onClick={guardar} disabled={loading || !apiKey.trim()}
            style={{
              padding: "10px 20px", background: loading ? "#a5b4fc" : "#6366f1",
              color: "white", border: "none", borderRadius: "8px",
              fontSize: "14px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap"
            }}>
            {loading ? "⏳ Guardando..." : "💾 Guardar en MongoDB"}
          </button>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9ca3af" }}>
          La key se guarda cifrada en tu base de datos MongoDB. Nunca se muestra completa ni se envía a terceros.
        </p>
      </div>

      {/* Info de uso */}
      <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px 16px", marginTop: "14px", fontSize: "12px", color: "#555" }}>
        <p style={{ margin: "0 0 8px", fontWeight: "700", color: "#374151" }}>ℹ️ ¿Cómo funciona?</p>
        <ul style={{ margin: 0, paddingLeft: "16px", lineHeight: "1.8" }}>
          <li>Todos los doctores acceden a la IA sin configurar nada — la key es compartida</li>
          <li>La IA lee el contexto del paciente abierto en consulta automáticamente</li>
          <li>Funciona en todas las especialidades: Medicina General, Odontología, Pediatría, Nutrición, Ginecología y Ecografía</li>
          <li>Límite gratuito: ~1,500 consultas/día (Gemini 1.5 Flash)</li>
          <li>Si alcanzas el límite, la IA muestra aviso y puedes reintentarlo al día siguiente</li>
        </ul>
      </div>
    </div>
  );
};