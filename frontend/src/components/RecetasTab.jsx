/**
 * RecetasTab.jsx
 * Lista de recetas médicas con buscador, filtros por especialidad/fecha
 * y tabla responsiva consistente con el diseño de Agenda/Historias.
 *
 * Permisos:
 *   - Administrador / Recepción: ven todas las recetas
 *   - Doctor: ve solo las recetas de su especialidad
 */
import { useState, useMemo } from "react";
import { FileText, Search, Download, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { normalizeSpecialty } from "@/lib/specialties";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Fecha local (Ecuador UTC-5) en YYYY-MM-DD sin depender de UTC
const getLocalDate = () => new Date().toLocaleDateString("en-CA");

const PAGE_SIZE = 20;

export const RecetasTab = ({ prescriptions = [], user, token }) => {
  const [search, setSearch]           = useState("");
  const [filterEsp, setFilterEsp]     = useState("todas");
  const [filterFecha, setFilterFecha] = useState("");
  const [page, setPage]               = useState(1);

  // ── Permisos ────────────────────────────────────────────────────────────────
  const canSeeAll =
    user?.role === "Administrador" || user?.role === "Recepcion";

  // ── Especialidades únicas para el filtro ────────────────────────────────────
  const especialidades = useMemo(() => {
    const base = canSeeAll ? prescriptions : prescriptions.filter(p =>
      !user?.especialidad ||
      normalizeSpecialty(p.doctor_especialidad || p.especialidad) ===
      normalizeSpecialty(user.especialidad) ||
      !(p.doctor_especialidad || p.especialidad)
    );
    const set = new Set(
      base
        .map(p => normalizeSpecialty(p.doctor_especialidad || p.especialidad || ""))
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [prescriptions, canSeeAll, user]);

  // ── Pipeline de filtros ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...prescriptions];

    // 1) Restricción de rol
    if (!canSeeAll && user?.especialidad) {
      list = list.filter(p => {
        const pEsp = normalizeSpecialty(p.doctor_especialidad || p.especialidad || "");
        const uEsp = normalizeSpecialty(user.especialidad);
        return !uEsp || pEsp === uEsp || pEsp === "";
      });
    }

    // 2) Filtro de especialidad (dropdown)
    if (filterEsp !== "todas") {
      list = list.filter(
        p => normalizeSpecialty(p.doctor_especialidad || p.especialidad || "") === filterEsp
      );
    }

    // 3) Filtro de fecha exacta
    if (filterFecha) {
      list = list.filter(p => (p.fecha || "").startsWith(filterFecha));
    }

    // 4) Búsqueda de texto libre
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        (p.paciente_nombre || "").toLowerCase().includes(q) ||
        (p.doctor_nombre   || "").toLowerCase().includes(q) ||
        (p.cedula          || "").includes(q) ||
        (p.medicamentos    || []).some(m =>
          (m.nombre || m).toLowerCase().includes(q)
        )
      );
    }

    // Más recientes primero
    return list.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [prescriptions, canSeeAll, user, filterEsp, filterFecha, search]);

  // ── Paginación ───────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetFilters = () => {
    setSearch("");
    setFilterEsp("todas");
    setFilterFecha("");
    setPage(1);
  };

  const hasActiveFilters = search || filterEsp !== "todas" || filterFecha;

  const handleSearch = (v) => { setSearch(v); setPage(1); };
  const handleEsp    = (v) => { setFilterEsp(v); setPage(1); };
  const handleFecha  = (v) => { setFilterFecha(v); setPage(1); };

  const openPdf = async (id, nombrePaciente) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/prescriptions/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Error al generar PDF");
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      // Usar <a> en vez de window.open — compatible con móvil (Safari/Chrome bloquean popups)
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      // En móvil descarga, en desktop abre
      a.download = `receta-${(nombrePaciente || id).replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      alert("No se pudo abrir el PDF. Verifique su sesión.");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="tab-content">
      {/* ── Encabezado ── */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Recetas Médicas</h2>
          <p className="section-subtitle">
            {filtered.length} receta{filtered.length !== 1 ? "s" : ""}
            {hasActiveFilters ? " (filtradas)" : " en total"}
          </p>
        </div>
      </div>

      {/* ── Barra de filtros ── */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        alignItems: "center",
        background: "#F0F9FF",
        padding: "1rem",
        borderRadius: "8px",
        marginBottom: "1.25rem",
      }}>
        {/* Buscador */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: "180px" }}>
          <Search
            size={15}
            style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}
          />
          <input
            type="text"
            placeholder="Buscar paciente, doctor, medicamento…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem 0.5rem 2rem",
              border: "2px solid #BFDBFE",
              borderRadius: "8px",
              fontSize: "0.875rem",
              background: "white",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filtro especialidad */}
        {canSeeAll && especialidades.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Filter size={14} style={{ color: "#64748B" }} />
            <select
              value={filterEsp}
              onChange={e => handleEsp(e.target.value)}
              style={{
                padding: "0.5rem 0.75rem",
                border: "2px solid #BFDBFE",
                borderRadius: "8px",
                fontSize: "0.875rem",
                background: "white",
                cursor: "pointer",
              }}
            >
              <option value="todas">Todas las especialidades</option>
              {especialidades.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filtro fecha */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Label style={{ fontWeight: 600, color: "#0C4A6E", whiteSpace: "nowrap", fontSize: "0.875rem" }}>
            Fecha:
          </Label>
          <input
            type="date"
            value={filterFecha}
            onChange={e => handleFecha(e.target.value)}
            style={{
              padding: "0.5rem",
              border: "2px solid #BFDBFE",
              borderRadius: "8px",
              fontSize: "0.875rem",
              background: "white",
            }}
          />
        </div>

        {/* Limpiar filtros */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "0.5rem 0.75rem",
              background: "none",
              border: "2px solid #FCA5A5",
              borderRadius: "8px",
              color: "#DC2626",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      {/* ── Tabla ── */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Doctor</th>
              <th className="col-opcional">Especialidad</th>
              <th>Medicamentos</th>
              <th style={{ textAlign: "center" }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(p => (
              <tr key={p.id}>
                <td style={{ whiteSpace: "nowrap", color: "#64748B", fontSize: "0.875rem" }}>
                  {p.fecha || "—"}
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: "#0C4A6E" }}>
                    {p.paciente_nombre || "Sin nombre"}
                  </span>
                  {p.cedula && (
                    <div style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>{p.cedula}</div>
                  )}
                </td>
                <td style={{ fontSize: "0.9rem" }}>
                  {p.doctor_nombre || "—"}
                </td>
                <td className="col-opcional">
                  {p.doctor_especialidad || p.especialidad
                    ? <span className="badge">{normalizeSpecialty(p.doctor_especialidad || p.especialidad)}</span>
                    : <span style={{ color: "#94A3B8", fontSize: "0.8125rem" }}>—</span>
                  }
                </td>
                <td style={{ fontSize: "0.875rem", color: "#334155" }}>
                  {Array.isArray(p.medicamentos) && p.medicamentos.length > 0
                    ? p.medicamentos.map((m, i) => (
                        <span key={i} style={{
                          display: "inline-block",
                          marginRight: "4px",
                          marginBottom: "2px",
                          padding: "2px 8px",
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          borderRadius: "20px",
                          fontSize: "0.8125rem",
                          color: "#1E40AF",
                        }}>
                          {m.nombre || m}
                        </span>
                      ))
                    : <span style={{ color: "#94A3B8" }}>—</span>
                  }
                </td>
                <td style={{ textAlign: "center" }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPdf(p.id, p.paciente_nombre)}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <Download size={13} />
                    PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Estado vacío */}
        {filtered.length === 0 && (
          <div className="empty-state">
            <FileText className="empty-icon" />
            <p>
              {hasActiveFilters
                ? "No hay recetas que coincidan con los filtros aplicados."
                : "No hay recetas registradas."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                style={{ marginTop: "0.75rem", color: "#0284C7", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "1.25rem",
        }}>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Anterior
          </Button>
          <span style={{ fontSize: "0.875rem", color: "#64748B", fontWeight: 500 }}>
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Siguiente →
          </Button>
        </div>
      )}
    </div>
  );
};

export default RecetasTab;
