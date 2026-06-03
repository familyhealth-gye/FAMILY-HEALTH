/**
 * CIE10Search.jsx
 * Componente de búsqueda de códigos CIE-10 con autocomplete.
 * Reutilizable desde: CertificadoModal, formularios de HC, RecetasTab.
 *
 * Props:
 *   value       — string: "J02.9" o "J02.9 - Faringitis aguda"
 *   onChange    — fn(codigo, descripcion)
 *   token       — JWT
 *   placeholder — string opcional
 *   style       — estilos adicionales al input
 */

import { useState, useEffect, useRef, useCallback } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function CIE10Search({ value, onChange, token, placeholder = "Buscar CIE-10...", style = {} }) {
  const [query,     setQuery]     = useState(value || "");
  const [results,   setResults]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [selected,  setSelected]  = useState(!!value);
  const debounce    = useRef(null);
  const wrapperRef  = useRef(null);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Buscar con debounce
  const buscar = useCallback(async (q) => {
    setLoading(true);
    try {
      const url = `${BACKEND_URL}/api/cie10/buscar?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setResults(await res.json());
    } catch {}
    setLoading(false);
  }, [token]);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setSelected(false);
    setOpen(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => buscar(v), 250);
  };

  const handleFocus = () => {
    if (!selected) {
      setOpen(true);
      buscar(query);
    }
  };

  const handleSelect = (item) => {
    const display = `${item.codigo} — ${item.descripcion}`;
    setQuery(display);
    setSelected(true);
    setOpen(false);
    onChange(item.codigo, item.descripcion);
  };

  const handleClear = () => {
    setQuery("");
    setSelected(false);
    setOpen(false);
    onChange("", "");
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          style={{
            width: "100%", padding: "8px 32px 8px 10px",
            border: `1.5px solid ${selected ? "#86EFAC" : "#BFDBFE"}`,
            borderRadius: "8px", fontSize: "13px",
            boxSizing: "border-box", outline: "none",
            background: selected ? "#F0FDF4" : "white",
            fontFamily: selected ? "monospace" : "inherit",
            ...style,
          }}
          autoComplete="off"
        />
        {query && (
          <button onClick={handleClear}
            style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "16px", lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "white", border: "1.5px solid #BFDBFE", borderRadius: "10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 9999,
          maxHeight: "260px", overflowY: "auto",
        }}>
          {loading && (
            <div style={{ padding: "10px 14px", fontSize: "12px", color: "#9CA3AF", textAlign: "center" }}>Buscando...</div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: "10px 14px", fontSize: "12px", color: "#9CA3AF", textAlign: "center" }}>Sin resultados</div>
          )}
          {!loading && results.map((item, i) => (
            <button key={i} onClick={() => handleSelect(item)}
              style={{
                width: "100%", textAlign: "left", padding: "9px 14px",
                background: "none", border: "none", cursor: "pointer",
                borderBottom: i < results.length - 1 ? "1px solid #F3F4F6" : "none",
                display: "flex", gap: "10px", alignItems: "flex-start",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <span style={{ fontFamily: "monospace", fontWeight: "700", color: "#0C4A6E", fontSize: "12px", flexShrink: 0, marginTop: "1px" }}>
                {item.codigo}
              </span>
              <span style={{ fontSize: "12px", color: "#374151", lineHeight: "1.4" }}>
                {item.descripcion}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
