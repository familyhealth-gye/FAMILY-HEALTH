import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MedicamentoSearch } from "@/components/MedicamentoSearch";

// Plantillas por especialidad
const PLANTILLAS = {
  "Medicina General": [
    { nombre: "Paracetamol", dosis: "500mg", frecuencia: "cada 8h", duracion: "3 días", indicaciones: "Tomar con alimentos" },
    { nombre: "Ibuprofeno", dosis: "400mg", frecuencia: "cada 8h", duracion: "3 días", indicaciones: "No tomar con estómago vacío" },
    { nombre: "Amoxicilina", dosis: "500mg", frecuencia: "cada 8h", duracion: "7 días", indicaciones: "Completar el tratamiento" },
    { nombre: "Azitromicina", dosis: "500mg", frecuencia: "cada 24h", duracion: "5 días", indicaciones: "Tomar en ayunas" },
    { nombre: "Loratadina", dosis: "10mg", frecuencia: "cada 24h", duracion: "7 días", indicaciones: "Puede causar somnolencia" },
    { nombre: "Omeprazol", dosis: "20mg", frecuencia: "cada 24h", duracion: "14 días", indicaciones: "Tomar 30 min antes del desayuno" },
  ],
  "Pediatría": [
    { nombre: "Paracetamol pediátrico", dosis: "10-15mg/kg", frecuencia: "cada 6-8h", duracion: "3 días", indicaciones: "Según peso del niño" },
    { nombre: "Ibuprofeno pediátrico", dosis: "5-10mg/kg", frecuencia: "cada 8h", duracion: "3 días", indicaciones: "Con alimentos" },
    { nombre: "Amoxicilina pediátrica", dosis: "40-50mg/kg/día", frecuencia: "cada 8h", duracion: "7 días", indicaciones: "Suspensión oral" },
    { nombre: "Salbutamol inhalador", dosis: "2 puffs", frecuencia: "cada 4-6h", duracion: "Según necesidad", indicaciones: "Para crisis bronquial" },
    { nombre: "Loratadina pediátrica", dosis: "5mg", frecuencia: "cada 24h", duracion: "7 días", indicaciones: "Para mayores de 2 años" },
  ],
  "Nutrición": [
    { nombre: "Vitamina D3", dosis: "1000 UI", frecuencia: "cada 24h", duracion: "30 días", indicaciones: "Con el desayuno" },
    { nombre: "Omega 3", dosis: "1g", frecuencia: "cada 24h", duracion: "30 días", indicaciones: "Con los alimentos" },
    { nombre: "Hierro elemental", dosis: "80mg", frecuencia: "cada 24h", duracion: "30 días", indicaciones: "En ayunas con vitamina C" },
    { nombre: "Ácido fólico", dosis: "5mg", frecuencia: "cada 24h", duracion: "30 días", indicaciones: "En el embarazo tomar todo el día" },
    { nombre: "Vitamina B12", dosis: "1000mcg", frecuencia: "semanal", duracion: "4 semanas", indicaciones: "Sublingual" },
    { nombre: "Calcio + Vitamina D", dosis: "600mg + 400UI", frecuencia: "cada 12h", duracion: "30 días", indicaciones: "Con las comidas" },
  ],
  "Ginecología": [
    { nombre: "Ácido fólico", dosis: "5mg", frecuencia: "cada 24h", duracion: "90 días", indicaciones: "Prenatal obligatorio" },
    { nombre: "Hierro fumarato", dosis: "200mg", frecuencia: "cada 24h", duracion: "30 días", indicaciones: "En ayunas" },
    { nombre: "Calcio 600mg", dosis: "600mg", frecuencia: "cada 12h", duracion: "30 días", indicaciones: "Con vitamina D" },
    { nombre: "Metronidazol", dosis: "500mg", frecuencia: "cada 12h", duracion: "7 días", indicaciones: "No alcohol durante tratamiento" },
    { nombre: "Clotrimazol óvulos", dosis: "100mg", frecuencia: "cada 24h", duracion: "7 días", indicaciones: "Vía vaginal, en la noche" },
    { nombre: "Progesterona", dosis: "200mg", frecuencia: "cada 24h", duracion: "Según indicación", indicaciones: "Vía vaginal" },
  ],
  "Ecografía": [],
};

const MED_VACIO = { nombre: "", dosis: "", frecuencia: "", duracion: "", indicaciones: "" };

/**
 * MedicacionRapida — Gestión de medicamentos con plantillas
 * Props:
 *   especialidad: string
 *   medicamentos: array de { nombre, dosis, frecuencia, duracion, indicaciones }
 *   onChange: (nuevos_medicamentos) => void
 */
export const MedicacionRapida = ({ especialidad = "Medicina General", medicamentos = [], onChange, token = "" }) => {
  const [mostrarPlantillas, setMostrarPlantillas] = useState(false);
  const plantillas = PLANTILLAS[especialidad] || PLANTILLAS["Medicina General"];

  const agregar = (med = MED_VACIO) => {
    onChange([...medicamentos, { ...med, id: Date.now() }]);
  };

  const actualizar = (idx, campo, valor) => {
    const nuevos = medicamentos.map((m, i) => i === idx ? { ...m, [campo]: valor } : m);
    onChange(nuevos);
  };

  const eliminar = (idx) => {
    onChange(medicamentos.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ border: "1.5px solid #00a8cc", borderRadius: "10px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        background: "#00a8cc", padding: "10px 16px",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span style={{ color: "white", fontWeight: "700", fontSize: "13px" }}>
          💊 RECETA / MEDICAMENTOS
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          {plantillas.length > 0 && (
            <button
              type="button"
              onClick={() => setMostrarPlantillas(!mostrarPlantillas)}
              style={{
                background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.5)",
                color: "white", borderRadius: "6px", padding: "4px 10px",
                fontSize: "12px", cursor: "pointer"
              }}
            >
              {mostrarPlantillas ? "Ocultar plantillas" : "⚡ Plantillas rápidas"}
            </button>
          )}
          <button
            type="button"
            onClick={() => agregar()}
            style={{
              background: "white", border: "none", color: "#00a8cc",
              borderRadius: "6px", padding: "4px 10px",
              fontSize: "12px", cursor: "pointer", fontWeight: "700"
            }}
          >
            + Agregar
          </button>
        </div>
      </div>

      {/* Plantillas rápidas */}
      {mostrarPlantillas && plantillas.length > 0 && (
        <div style={{
          background: "#f0fbff", padding: "12px 16px",
          borderBottom: "1px solid #b2ebf2"
        }}>
          <p style={{ fontSize: "12px", color: "#005f73", fontWeight: "600", marginBottom: "8px" }}>
            Click para agregar a la receta:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {plantillas.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { agregar(p); setMostrarPlantillas(false); }}
                style={{
                  background: "white", border: "1.5px solid #00a8cc",
                  borderRadius: "20px", padding: "4px 12px",
                  fontSize: "12px", color: "#005f73", cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#00a8cc"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#005f73"; }}
              >
                {p.nombre} {p.dosis}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de medicamentos */}
      <div style={{ padding: "12px 16px" }}>
        {medicamentos.length === 0 ? (
          <p style={{ textAlign: "center", color: "#999", fontSize: "13px", padding: "16px 0" }}>
            Sin medicamentos. Usa "Plantillas rápidas" o "Agregar".
          </p>
        ) : (
          medicamentos.map((med, idx) => (
            <div key={idx} style={{
              background: idx % 2 === 0 ? "#f8fdff" : "white",
              border: "1px solid #e0f7fa", borderRadius: "8px",
              padding: "10px", marginBottom: "8px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontWeight: "700", color: "#005f73", fontSize: "13px" }}>
                  Medicamento {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => eliminar(idx)}
                  style={{
                    background: "#fee2e2", border: "none", color: "#dc2626",
                    borderRadius: "4px", padding: "2px 8px",
                    fontSize: "12px", cursor: "pointer"
                  }}
                >
                  Eliminar
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <Label style={{ fontSize: "11px", color: "#666" }}>Medicamento *</Label>
                  <MedicamentoSearch
                    value={med.nombre}
                    token={token}
                    onChange={(nombre, presentaciones) => {
                      actualizar(idx, "nombre", nombre);
                      if (presentaciones?.length === 1 && !med.dosis) {
                        actualizar(idx, "dosis", presentaciones[0]);
                      }
                    }}
                    placeholder="Buscar medicamento..."
                    style={{ fontSize: "13px", height: "32px" }}
                  />
                </div>
                <div>
                  <Label style={{ fontSize: "11px", color: "#666" }}>Dosis</Label>
                  <Input
                    value={med.dosis}
                    onChange={e => actualizar(idx, "dosis", e.target.value)}
                    placeholder="Ej: 500mg"
                    style={{ fontSize: "13px", height: "32px" }}
                  />
                </div>
                <div>
                  <Label style={{ fontSize: "11px", color: "#666" }}>Frecuencia</Label>
                  <Input
                    value={med.frecuencia}
                    onChange={e => actualizar(idx, "frecuencia", e.target.value)}
                    placeholder="Ej: cada 8 horas"
                    style={{ fontSize: "13px", height: "32px" }}
                  />
                </div>
                <div>
                  <Label style={{ fontSize: "11px", color: "#666" }}>Duración</Label>
                  <Input
                    value={med.duracion}
                    onChange={e => actualizar(idx, "duracion", e.target.value)}
                    placeholder="Ej: 7 días"
                    style={{ fontSize: "13px", height: "32px" }}
                  />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Label style={{ fontSize: "11px", color: "#666" }}>Indicaciones</Label>
                  <Input
                    value={med.indicaciones}
                    onChange={e => actualizar(idx, "indicaciones", e.target.value)}
                    placeholder="Ej: Tomar con alimentos"
                    style={{ fontSize: "13px", height: "32px" }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
