/**
 * SmartNav.jsx
 * Navegación principal inteligente:
 * - Desktop (>768px): tabs horizontales normales
 * - Móvil (≤768px): menú dropdown agrupado por sección
 *
 * Props:
 *   activeTab    — string: tab activo actual
 *   onTabChange  — fn(value): cambia tab
 *   items        — array de { value, label, icon, group, roles }
 *   userRole     — string: rol del usuario actual
 */

import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronRight } from "lucide-react";

// ─── Grupos de navegación ────────────────────────────────────────────────────
export const NAV_GROUPS = {
  clinico:   { label: "Clínico",      color: "#0C4A6E" },
  operativo: { label: "Operativo",    color: "#0369A1" },
  admin:     { label: "Administración", color: "#1E40AF" },
  config:    { label: "Configuración", color: "#374151" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const useIsMobile = () => {
  const [mobile, setMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
};

// ─── Componente ──────────────────────────────────────────────────────────────
export function SmartNav({ activeTab, onTabChange, items, userRole }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const isMobile = useIsMobile();

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const visibleItems = items.filter(item =>
    !item.roles || item.roles.includes(userRole)
  );

  const activeItem = visibleItems.find(i => i.value === activeTab);

  const handleSelect = (value) => {
    onTabChange(value);
    setOpen(false);
  };

  // ── Desktop: tabs horizontales ──────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div style={{
        display: "flex", overflowX: "auto", background: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)",
        padding: "8px", gap: "6px", borderBottom: "2px solid #BFDBFE",
        scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
      }}>
        {visibleItems.map(item => (
          <button
            key={item.value}
            onClick={() => handleSelect(item.value)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "10px 16px", borderRadius: "10px", border: "none",
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              fontWeight: "600", fontSize: "14px", transition: "all 0.2s",
              background: activeTab === item.value
                ? "linear-gradient(135deg, #0284C7 0%, #06B6D4 100%)"
                : "transparent",
              color: activeTab === item.value ? "white" : "#0369A1",
              boxShadow: activeTab === item.value ? "0 4px 12px rgba(2,132,199,0.3)" : "none",
            }}
          >
            {item.icon && <item.icon size={16} />}
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  // ── Móvil: botón activo + dropdown agrupado ────────────────────────────────

  // Agrupar items
  const grouped = {};
  visibleItems.forEach(item => {
    const g = item.group || "otros";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(item);
  });

  return (
    <div ref={menuRef} style={{ position: "relative", zIndex: 100 }}>
      {/* Barra superior con item activo + botón menú */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(135deg, #0284C7 0%, #0C4A6E 100%)",
        padding: "0 12px", height: "52px",
      }}>
        {/* Item activo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {activeItem?.icon && <activeItem.icon size={18} color="white" />}
          <span style={{ color: "white", fontWeight: "700", fontSize: "15px" }}>
            {activeItem?.label || "Menú"}
          </span>
        </div>

        {/* Botón hamburguesa */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: "rgba(255,255,255,0.15)", border: "none",
            borderRadius: "8px", padding: "8px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
            color: "white", fontSize: "12px", fontWeight: "600",
          }}
        >
          {open ? <X size={18} color="white" /> : <Menu size={18} color="white" />}
          <span>{open ? "Cerrar" : "Menú"}</span>
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "white", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          borderRadius: "0 0 14px 14px", overflow: "hidden",
          maxHeight: "75vh", overflowY: "auto",
          borderTop: "2px solid #BFDBFE",
        }}>
          {Object.entries(grouped).map(([groupKey, groupItems]) => {
            const groupMeta = NAV_GROUPS[groupKey] || { label: groupKey, color: "#374151" };
            return (
              <div key={groupKey}>
                {/* Encabezado de grupo */}
                <div style={{
                  padding: "8px 16px 4px",
                  fontSize: "10px", fontWeight: "700", letterSpacing: "0.08em",
                  textTransform: "uppercase", color: groupMeta.color,
                  background: "#F8FAFF", borderBottom: "1px solid #EFF6FF",
                }}>
                  {groupMeta.label}
                </div>

                {/* Items del grupo */}
                {groupItems.map(item => {
                  const isActive = item.value === activeTab;
                  return (
                    <button
                      key={item.value}
                      onClick={() => handleSelect(item.value)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center",
                        justifyContent: "space-between",
                        padding: "13px 16px", border: "none", cursor: "pointer",
                        background: isActive ? "#EFF6FF" : "white",
                        borderLeft: isActive ? `3px solid ${groupMeta.color}` : "3px solid transparent",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {item.icon && (
                          <item.icon
                            size={18}
                            color={isActive ? groupMeta.color : "#6B7280"}
                          />
                        )}
                        <span style={{
                          fontSize: "14px", fontWeight: isActive ? "700" : "500",
                          color: isActive ? groupMeta.color : "#374151",
                        }}>
                          {item.label}
                        </span>
                      </div>
                      {isActive && <ChevronRight size={14} color={groupMeta.color} />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
