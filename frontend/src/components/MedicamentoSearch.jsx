/**
 * MedicamentoSearch.jsx
 * Búsqueda de medicamentos con autocomplete.
 * Fuentes: 1) Historial de recetas del sistema, 2) Base MSP Ecuador.
 *
 * Props:
 *   value         — string: nombre del medicamento
 *   onChange      — fn(nombre, presentaciones[])
 *   token         — JWT
 *   placeholder   — string opcional
 *   style         — estilos adicionales
 */

import { useState, useEffect, useRef, useCallback } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BADGE_COLORS = {
  historial: { bg: "#DCFCE7", color: "#15803D", label: "✓ Usado" },
  base:      { bg: "#EFF6FF", color: "#1D4ED8", label: "MSP"    },
};

export function MedicamentoSearch({ value, onChange, token, placeholder = "Buscar medicamento...", style = {} }) {
  const [query,    setQuery]    = useState(value || "");
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [selected, setSelected] = useState(!!value);
  const debounce   = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const buscar = useCallback(async (q) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/medicamentos/buscar?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
    if (!selected) { setOpen(true); buscar(query); }
  };

  const handleSelect = (item) => {
    setQuery(item.nombre);
    setSelected(true);
    setOpen(false);
    onChange(item.nombre, item.presentaciones || []);
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: "100%", padding: "8px 32px 8px 10px",
            border: `1.5px solid ${selected ? "#86EFAC" : "#BFDBFE"}`,
            borderRadius: "8px", fontSize: "13px",
            boxSizing: "border-box", outline: "none",
            background: selected ? "#F0FDF4" : "white",
            ...style,
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setSelected(false); setOpen(false); onChange("", []); }}
            style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "16px" }}>
            ×
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "white", border: "1.5px solid #BFDBFE", borderRadius: "10px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 9999,
          maxHeight: "280px", overflowY: "auto",
        }}>
          {loading && <div style={{ padding: "10px", fontSize: "12px", color: "#9CA3AF", textAlign: "center" }}>Buscando...</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: "10px", fontSize: "12px", color: "#9CA3AF", textAlign: "center" }}>
              Sin resultados — puede escribir el nombre manualmente
            </div>
          )}
          {!loading && results.map((item, i) => {
            const badge = BADGE_COLORS[item.fuente] || BADGE_COLORS.base;
            return (
              <button key={i} onClick={() => handleSelect(item)}
                style={{
                  width: "100%", textAlign: "left", padding: "9px 14px",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: i < results.length - 1 ? "1px solid #F3F4F6" : "none",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#EFF6FF"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: "700", fontSize: "13px", color: "#0C4A6E" }}>{item.nombre}</span>
                  <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "8px", background: badge.bg, color: badge.color }}>
                    {badge.label}
                  </span>
                </div>
                {item.presentaciones?.length > 0 && (
                  <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                    {item.presentaciones.slice(0, 3).join(" · ")}
                    {item.presentaciones.length > 3 && " ..."}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
