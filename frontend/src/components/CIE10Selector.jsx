import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * CIE10Selector — Buscador de códigos CIE-10
 * Props:
 *   token: JWT token
 *   value: { codigo, descripcion }
 *   onChange: ({ codigo, descripcion }) => void
 *   label: string (opcional)
 */
export const CIE10Selector = ({ token, value = {}, onChange, label = "Diagnóstico CIE-10" }) => {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Buscar con debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 1) {
        // Mostrar comunes si abre sin texto
        try {
          const res = await axios.get(`${API}/cie10/buscar?q=`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setResultados(res.data || []);
        } catch { setResultados([]); }
        return;
      }
      setLoading(true);
      try {
        const res = await axios.get(`${API}/cie10/buscar?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setResultados(res.data || []);
        setOpen(true);
      } catch { setResultados([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, token]);

  const seleccionar = (item) => {
    onChange({ codigo: item.codigo, descripcion: item.descripcion });
    setQuery("");
    setOpen(false);
  };

  const limpiar = () => {
    onChange({ codigo: "", descripcion: "" });
    setQuery("");
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Label style={{ color: "#005f73", fontWeight: 600, fontSize: "13px" }}>{label}</Label>

      {/* Seleccionado actual */}
      {value?.codigo ? (
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#e0f7fa", border: "1.5px solid #00a8cc",
          borderRadius: "8px", padding: "8px 12px", marginTop: "4px"
        }}>
          <span style={{
            background: "#00a8cc", color: "white", borderRadius: "6px",
            padding: "2px 8px", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap"
          }}>
            {value.codigo}
          </span>
          <span style={{ fontSize: "13px", color: "#333", flex: 1 }}>{value.descripcion}</span>
          <button onClick={limpiar} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#999", fontSize: "16px", lineHeight: 1
          }} title="Cambiar">✕</button>
        </div>
      ) : (
        <>
          <Input
            placeholder="Buscar por nombre o código (ej: gripe, J00, diabetes...)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            style={{ marginTop: "4px", borderColor: "#00a8cc" }}
          />
          {loading && (
            <div style={{ fontSize: "12px", color: "#999", padding: "4px 8px" }}>Buscando...</div>
          )}
        </>
      )}

      {/* Dropdown resultados */}
      {open && !value?.codigo && resultados.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
          background: "white", border: "1.5px solid #00a8cc", borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(0,168,204,0.15)", maxHeight: "280px",
          overflowY: "auto", marginTop: "2px"
        }}>
          {!query && (
            <div style={{ padding: "6px 12px", fontSize: "11px", color: "#999",
              borderBottom: "1px solid #eee", background: "#f5faff" }}>
              📋 Códigos más comunes — escribe para buscar más
            </div>
          )}
          {resultados.map((item) => (
            <div
              key={item.codigo}
              onClick={() => seleccionar(item)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f0f0f0",
                transition: "background 0.15s"
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f0fbff"}
              onMouseLeave={e => e.currentTarget.style.background = "white"}
            >
              <span style={{
                background: "#005f73", color: "white", borderRadius: "5px",
                padding: "2px 7px", fontSize: "11px", fontWeight: "700",
                whiteSpace: "nowrap", minWidth: "52px", textAlign: "center"
              }}>
                {item.codigo}
              </span>
              <span style={{ fontSize: "13px", color: "#333" }}>{item.descripcion}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
