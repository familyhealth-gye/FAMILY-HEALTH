/**
 * MedicalHistoryTab.jsx
 * Lista unificada de historias clínicas con buscador, filtros por especialidad/fecha,
 * tabla responsiva y paginación — diseño consistente con Agenda/Recetas.
 *
 * La creación de historias clínicas se hace desde los formularios de cada especialidad
 * al atender una cita. Este tab es solo lectura/consulta.
 */
import { useState, useMemo } from "react";
import { FileText, Search, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { normalizeSpecialty } from "@/lib/specialties";

const PAGE_SIZE = 20;

export const MedicalHistoryTab = ({ medicalHistories = [], appointments = [], doctors = [], fetchData, token, user }) => {
  const [search, setSearch]           = useState("");
  const [filterEsp, setFilterEsp]     = useState("todas");
  const [filterFecha, setFilterFecha] = useState("");
  const [page, setPage]               = useState(1);

  // ── Especialidades únicas para dropdown ────────────────────────────────────
  const especialidades = useMemo(() => {
    const set = new Set(
      medicalHistories
        .map(h => normalizeSpecialty(h.especialidad || ""))
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [medicalHistories]);

  // ── Permisos ───────────────────────────────────────────────────────────────
  const canSeeAll = !user || user.role === "Administrador" || user.role === "Recepcion";

  // ── Pipeline de filtros ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...medicalHistories];

    // Restricción por rol
    if (!canSeeAll && user?.especialidad) {
      list = list.filter(h =>
        !h.especialidad ||
        normalizeSpecialty(h.especialidad) === normalizeSpecialty(user.especialidad)
      );
    }

    // Filtro especialidad
    if (filterEsp !== "todas") {
      list = list.filter(h => normalizeSpecialty(h.especialidad || "") === filterEsp);
    }

    // Filtro fecha
    if (filterFecha) {
      list = list.filter(h => (h.fecha || "").startsWith(filterFecha));
    }

    // Búsqueda libre
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(h =>
        (h.paciente_nombre   || "").toLowerCase().includes(q) ||
        (h.paciente_cedula   || "").includes(q) ||
        (h.doctor_nombre     || "").toLowerCase().includes(q) ||
        (h.diagnostico       || "").toLowerCase().includes(q) ||
        (h.motivo_consulta   || "").toLowerCase().includes(q)
      );
    }

    // Más recientes primero
    return list.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  }, [medicalHistories, canSeeAll, user, filterEsp, filterFecha, search]);

  // ── Paginación ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = search || filterEsp !== "todas" || filterFecha;

  const handleSearch = v => { setSearch(v);    setPage(1); };
  const handleEsp    = v => { setFilterEsp(v); setPage(1); };
  const handleFecha  = v => { setFilterFecha(v); setPage(1); };

  const resetFilters = () => {
    setSearch(""); setFilterEsp("todas"); setFilterFecha(""); setPage(1);
  };

  // ── Utilidad: color de badge por especialidad ──────────────────────────────
  const espColor = (esp) => {
    const map = {
      "Odontología":    { bg: "#FEF3C7", color: "#92400E" },
      "Pediatría":      { bg: "#D1FAE5", color: "#065F46" },
      "Ginecología":    { bg: "#FCE7F3", color: "#831843" },
      "Nutrición":      { bg: "#E0E7FF", color: "#3730A3" },
      "Ecografía":      { bg: "#CFFAFE", color: "#164E63" },
      "Obstetricia":    { bg: "#FDE8D8", color: "#7C2D12" },
    };
    return map[normalizeSpecialty(esp)] || { bg: "#DBEAFE", color: "#1E40AF" };
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="tab-content">
      {/* Encabezado */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Historias Clínicas</h2>
          <p className="section-subtitle">
            {filtered.length} historia{filtered.length !== 1 ? "s" : ""}
            {hasActiveFilters ? " (filtradas)" : " en total"}
          </p>
        </div>
      </div>

      {/* Barra de filtros */}
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
            placeholder="Buscar paciente, cédula, doctor, diagnóstico…"
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
        {especialidades.length > 1 && (
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

        {/* Limpiar */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            style={{
              display: "flex", alignItems: "center", gap: "4px",
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

      {/* Tabla */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Doctor</th>
              <th className="col-opcional">Especialidad</th>
              <th>Motivo / Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(h => {
              const colors = espColor(h.especialidad);
              return (
                <tr key={h.id}>
                  <td style={{ whiteSpace: "nowrap", color: "#64748B", fontSize: "0.875rem" }}>
                    {h.fecha || "—"}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: "#0C4A6E" }}>
                      {h.paciente_nombre || "Sin nombre"}
                    </span>
                    {h.paciente_cedula && (
                      <div style={{ fontSize: "0.8125rem", color: "#94A3B8" }}>{h.paciente_cedula}</div>
                    )}
                  </td>
                  <td style={{ fontSize: "0.9rem" }}>
                    {h.doctor_nombre || "—"}
                  </td>
                  <td className="col-opcional">
                    {h.especialidad ? (
                      <span style={{
                        display: "inline-block",
                        padding: "0.25rem 0.625rem",
                        background: colors.bg,
                        color: colors.color,
                        borderRadius: "20px",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                      }}>
                        {normalizeSpecialty(h.especialidad)}
                      </span>
                    ) : <span style={{ color: "#94A3B8" }}>—</span>}
                  </td>
                  <td style={{ fontSize: "0.875rem" }}>
                    {h.motivo_consulta && (
                      <div style={{ color: "#334155", marginBottom: "2px" }}>
                        <span style={{ color: "#64748B", fontSize: "0.8125rem" }}>Motivo: </span>
                        {h.motivo_consulta}
                      </div>
                    )}
                    {h.diagnostico && (
                      <div style={{ color: "#0C4A6E", fontWeight: 500, fontSize: "0.875rem" }}>
                        <span style={{ color: "#64748B", fontWeight: 400, fontSize: "0.8125rem" }}>Dx: </span>
                        {h.diagnostico}
                      </div>
                    )}
                    {!h.motivo_consulta && !h.diagnostico && (
                      <span style={{ color: "#94A3B8" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Estado vacío */}
        {filtered.length === 0 && (
          <div className="empty-state">
            <FileText className="empty-icon" />
            <p>
              {hasActiveFilters
                ? "No hay historias que coincidan con los filtros aplicados."
                : "No hay historias clínicas registradas."}
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

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "1.25rem",
        }}>
          <Button
            variant="outline" size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Anterior
          </Button>
          <span style={{ fontSize: "0.875rem", color: "#64748B", fontWeight: 500 }}>
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline" size="sm"
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
