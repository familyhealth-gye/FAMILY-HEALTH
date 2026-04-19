import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TIPOS = [
  { value: "rx_panoramica",  label: "🦷 RX Panorámica",      color: "#1e40af" },
  { value: "rx_periapical",  label: "🔬 RX Periapical",       color: "#1e40af" },
  { value: "rx_otra",        label: "📷 Otra RX",             color: "#1e40af" },
  { value: "foto_antes",     label: "📸 Foto Antes",          color: "#059669" },
  { value: "foto_despues",   label: "✅ Foto Después",        color: "#059669" },
  { value: "foto_clinica",   label: "🏥 Foto Clínica",        color: "#6b7280" },
  { value: "otro",           label: "📎 Otro documento",      color: "#6b7280" },
];

export const FotosRXTab = ({ pacienteCedula, pacienteNombre, appointmentId, doctorNombre, token, especialidad = "Odontología" }) => {
  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(null); // imagen seleccionada para ver grande
  const [form, setForm] = useState({ tipo: "rx_periapical", descripcion: "" });
  const fileRef = useRef(null);

  useEffect(() => {
    cargar();
  }, [pacienteCedula]);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/imagenes-clinicas/paciente/${pacienteCedula}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setImagenes(res.data || []);
    } catch { setImagenes([]); }
    setLoading(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamaño (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo es muy grande. Máximo 5MB.");
      return;
    }

    setSubiendo(true);
    try {
      // Convertir a base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await axios.post(`${API}/imagenes-clinicas`, {
        paciente_cedula: pacienteCedula,
        paciente_nombre: pacienteNombre,
        appointment_id: appointmentId || "",
        tipo: form.tipo,
        descripcion: form.descripcion || form.tipo,
        imagen_base64: base64,
        especialidad,
        doctor_nombre: doctorNombre || "",
      }, { headers: { Authorization: `Bearer ${token}` } });

      toast.success("Imagen guardada correctamente");
      setForm(f => ({ ...f, descripcion: "" }));
      if (fileRef.current) fileRef.current.value = "";
      await cargar();
    } catch (err) {
      toast.error("Error al guardar la imagen");
    }
    setSubiendo(false);
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar esta imagen?")) return;
    try {
      await axios.delete(`${API}/imagenes-clinicas/${id}`,
        { headers: { Authorization: `Bearer ${token}` } });
      toast.success("Imagen eliminada");
      await cargar();
    } catch { toast.error("Error al eliminar"); }
  };

  const verGrande = async (img) => {
    try {
      const res = await axios.get(`${API}/imagenes-clinicas/${img.id}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setVistaPrevia(res.data);
    } catch { toast.error("Error al cargar imagen"); }
  };

  const tipoInfo = (tipo) => TIPOS.find(t => t.value === tipo) || TIPOS[TIPOS.length - 1];

  // Agrupar por tipo
  const grupos = TIPOS.map(t => ({
    ...t,
    items: imagenes.filter(img => img.tipo === t.value)
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ padding: "4px" }}>

      {/* Formulario de subida */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)",
        borderRadius: "10px", padding: "14px 16px", marginBottom: "16px"
      }}>
        <p style={{ color: "white", fontWeight: "700", fontSize: "13px", margin: "0 0 10px" }}>
          📤 Subir nueva imagen / RX
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
          <div>
            <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", display: "block", marginBottom: "3px" }}>Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "none", fontSize: "13px" }}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", display: "block", marginBottom: "3px" }}>Descripción (opcional)</label>
            <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: RX pieza 16, Control 1 mes..."
              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "none", fontSize: "13px", boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFile}
            style={{ display: "none" }} id="file-upload" />
          <label htmlFor="file-upload" style={{
            flex: 1, padding: "10px", background: "rgba(255,255,255,0.15)",
            border: "2px dashed rgba(255,255,255,0.5)", borderRadius: "8px",
            color: "white", fontSize: "13px", fontWeight: "600", textAlign: "center",
            cursor: "pointer", transition: "all 0.2s"
          }}>
            {subiendo ? "⏳ Subiendo..." : "📁 Seleccionar archivo (imagen o PDF, máx 5MB)"}
          </label>
        </div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "10px", margin: "6px 0 0", textAlign: "center" }}>
          Formatos: JPG, PNG, PDF · Desde galería del celular o archivo del equipo de RX
        </p>
      </div>

      {/* Lista de imágenes */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "30px", color: "#999" }}>Cargando imágenes...</div>
      ) : imagenes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          <p style={{ fontSize: "32px", margin: 0 }}>📷</p>
          <p style={{ fontSize: "14px", margin: "8px 0 4px" }}>Sin imágenes guardadas</p>
          <p style={{ fontSize: "12px" }}>Sube RX panorámicas, periapicales o fotos antes/después</p>
        </div>
      ) : (
        grupos.length > 0 ? grupos.map(grupo => (
          <div key={grupo.value} style={{ marginBottom: "16px" }}>
            <p style={{
              fontSize: "12px", fontWeight: "700", color: grupo.color,
              margin: "0 0 8px", padding: "4px 10px",
              background: grupo.color + "15", borderRadius: "6px", display: "inline-block"
            }}>
              {grupo.label} ({grupo.items.length})
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {grupo.items.map(img => (
                <div key={img.id} style={{
                  border: "1.5px solid #e5e7eb", borderRadius: "8px",
                  overflow: "hidden", background: "white",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
                }}>
                  {/* Thumbnail placeholder */}
                  <div
                    onClick={() => verGrande(img)}
                    style={{
                      height: "90px", background: "#f0f9ff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", fontSize: "32px"
                    }}
                  >
                    {img.tipo.startsWith("rx") ? "🦷" : img.tipo.startsWith("foto") ? "📸" : "📎"}
                  </div>
                  <div style={{ padding: "6px 8px" }}>
                    <p style={{ margin: 0, fontSize: "11px", fontWeight: "600", color: "#333",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {img.descripcion || tipoInfo(img.tipo).label}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "10px", color: "#999" }}>
                      {img.fecha} · {img.doctor_nombre}
                    </p>
                    <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                      <button onClick={() => verGrande(img)} style={{
                        flex: 1, padding: "3px", background: "#f0f9ff", border: "1px solid #bae6fd",
                        borderRadius: "4px", fontSize: "10px", cursor: "pointer", color: "#0284c7"
                      }}>👁 Ver</button>
                      <button onClick={() => eliminar(img.id)} style={{
                        padding: "3px 6px", background: "#fee2e2", border: "1px solid #fca5a5",
                        borderRadius: "4px", fontSize: "10px", cursor: "pointer", color: "#dc2626"
                      }}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )) : null
      )}

      {/* Modal vista grande */}
      {vistaPrevia && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px"
        }} onClick={() => setVistaPrevia(null)}>
          <div style={{ maxWidth: "90vw", maxHeight: "90vh", position: "relative" }}
            onClick={e => e.stopPropagation()}>
            <div style={{
              background: "white", borderRadius: "10px", overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
            }}>
              <div style={{ background: "#1e3a5f", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "white", margin: 0, fontWeight: "700", fontSize: "13px" }}>
                    {tipoInfo(vistaPrevia.tipo).label} — {vistaPrevia.descripcion}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.7)", margin: 0, fontSize: "11px" }}>
                    {vistaPrevia.fecha} · {vistaPrevia.doctor_nombre}
                  </p>
                </div>
                <button onClick={() => setVistaPrevia(null)} style={{
                  background: "rgba(255,255,255,0.2)", border: "none", color: "white",
                  borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontSize: "16px"
                }}>×</button>
              </div>
              {vistaPrevia.imagen_base64 && (
                vistaPrevia.imagen_base64.startsWith("data:application/pdf") ? (
                  <iframe src={vistaPrevia.imagen_base64} style={{ width: "80vw", height: "75vh", border: "none" }} />
                ) : (
                  <img src={vistaPrevia.imagen_base64} alt={vistaPrevia.descripcion}
                    style={{ maxWidth: "80vw", maxHeight: "75vh", display: "block" }} />
                )
              )}
              {/* Botón descargar */}
              <div style={{ padding: "8px 16px", background: "#f9fafb", textAlign: "right" }}>
                <a href={vistaPrevia.imagen_base64} download={`${vistaPrevia.tipo}_${vistaPrevia.fecha}.${vistaPrevia.imagen_base64?.startsWith("data:application/pdf") ? "pdf" : "jpg"}`}
                  style={{ fontSize: "12px", color: "#1e40af", textDecoration: "none", fontWeight: "600" }}>
                  ⬇️ Descargar
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};