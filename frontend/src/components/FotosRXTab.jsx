import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { Download, Trash2, ZoomIn, X } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Categorías de imágenes
const CATEGORIAS = [
  "RX Panorámica",
  "RX Periapical",
  "Foto Antes",
  "Foto Después",
  "RX Lateral",
  "Foto Intraoral",
  "Foto Extraoral",
  "Tomografía",
  "Otro"
];

/**
 * FotosRXTab - Subir y gestionar imágenes clínicas
 * Soporta imágenes y PDFs desde galería o equipo de RX
 */
export const FotosRXTab = ({ pacienteCedula, appointmentId, token }) => {
  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Estados del modal de vista previa
  const [preview, setPreview] = useState(null);
  
  // Estados del formulario de subida
  const [categoria, setCategoria] = useState("RX Panorámica");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState(null);

  useEffect(() => {
    if (pacienteCedula) cargarImagenes();
  }, [pacienteCedula]);

  const cargarImagenes = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/imagenes-clinicas/paciente/${pacienteCedula}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setImagenes(res.data || []);
    } catch (error) {
      console.error("Error cargando imágenes:", error);
      setImagenes([]);
    }
    setLoading(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tamaño (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no debe superar 10MB");
      return;
    }

    // Validar tipo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Solo se permiten imágenes (JPG, PNG, WEBP) o PDF");
      return;
    }

    setArchivo(file);
  };

  const handleSubir = async () => {
    if (!archivo) {
      toast.error("Selecciona un archivo");
      return;
    }

    setUploading(true);
    try {
      // Convertir a base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(archivo);
      });

      // Enviar al backend
      await axios.post(
        `${API}/imagenes-clinicas`,
        {
          paciente_cedula: pacienteCedula,
          appointment_id: appointmentId || "",
          categoria: categoria,
          descripcion: descripcion || `${categoria} - ${new Date().toLocaleDateString()}`,
          tipo_archivo: archivo.type,
          nombre_archivo: archivo.name,
          archivo_base64: base64
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Imagen subida correctamente");
      
      // Reset form
      setArchivo(null);
      setDescripcion("");
      document.getElementById("file-input").value = "";
      
      // Recargar lista
      cargarImagenes();
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      toast.error(error.response?.data?.detail || "Error al subir imagen");
    }
    setUploading(false);
  };

  const handleEliminar = async (id) => {
    if (!confirm("¿Eliminar esta imagen?")) return;
    
    try {
      await axios.delete(`${API}/imagenes-clinicas/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Imagen eliminada");
      cargarImagenes();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleVerImagen = async (id) => {
    try {
      const res = await axios.get(`${API}/imagenes-clinicas/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPreview(res.data);
    } catch (error) {
      toast.error("Error cargando imagen");
    }
  };

  const handleDescargar = (imagen) => {
    const link = document.createElement('a');
    link.href = `data:${imagen.tipo_archivo};base64,${imagen.archivo_base64}`;
    link.download = imagen.nombre_archivo;
    link.click();
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "30px", color: "#999" }}>
        Cargando imágenes...
      </div>
    );
  }

  return (
    <div style={{ padding: "16px" }}>
      {/* Formulario de subida */}
      <div style={{
        background: "#f0f9ff",
        padding: "16px",
        borderRadius: "8px",
        marginBottom: "20px",
        border: "1px solid #bae6fd"
      }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: "700", color: "#0c4a6e" }}>
          📤 Subir nueva imagen
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <Label style={{ fontSize: "12px", fontWeight: "600", color: "#0c4a6e" }}>
              Categoría
            </Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger style={{ height: "36px" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label style={{ fontSize: "12px", fontWeight: "600", color: "#0c4a6e" }}>
              Descripción (opcional)
            </Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: Pieza 16 con caries"
              style={{ height: "36px" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <Label style={{ fontSize: "12px", fontWeight: "600", color: "#0c4a6e" }}>
            Archivo (Imagen o PDF, máx 10MB)
          </Label>
          <Input
            id="file-input"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            style={{ height: "36px" }}
          />
          {archivo && (
            <p style={{ fontSize: "12px", color: "#0c4a6e", marginTop: "4px" }}>
              ✅ {archivo.name} ({(archivo.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>

        <Button
          onClick={handleSubir}
          disabled={!archivo || uploading}
          style={{
            background: uploading ? "#94a3b8" : "#0ea5e9",
            color: "white",
            width: "100%"
          }}
        >
          {uploading ? "Subiendo..." : "📤 Subir imagen"}
        </Button>
      </div>

      {/* Lista de imágenes */}
      <div>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "700", color: "#0c4a6e" }}>
          📷 Imágenes del paciente ({imagenes.length})
        </h3>

        {imagenes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
            <p style={{ fontSize: "32px", margin: 0 }}>📷</p>
            <p style={{ fontSize: "13px" }}>No hay imágenes subidas</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "12px"
          }}>
            {imagenes.map((img) => (
              <div
                key={img.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "white"
                }}
              >
                {/* Preview thumbnail */}
                <div
                  style={{
                    height: "150px",
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    position: "relative"
                  }}
                  onClick={() => handleVerImagen(img.id)}
                >
                  {img.tipo_archivo === "application/pdf" ? (
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: "48px", margin: 0 }}>📄</p>
                      <p style={{ fontSize: "11px", color: "#64748b" }}>PDF</p>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: "48px", margin: 0 }}>🖼️</p>
                      <p style={{ fontSize: "11px", color: "#64748b" }}>Imagen</p>
                    </div>
                  )}
                  <div style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "rgba(0,0,0,0.6)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "10px"
                  }}>
                    <ZoomIn size={12} style={{ display: "inline" }} /> Ver
                  </div>
                </div>

                {/* Info */}
                <div style={{ padding: "8px" }}>
                  <p style={{ margin: "0 0 4px 0", fontSize: "12px", fontWeight: "600", color: "#0c4a6e" }}>
                    {img.categoria}
                  </p>
                  <p style={{ margin: "0 0 4px 0", fontSize: "11px", color: "#64748b" }}>
                    {img.descripcion}
                  </p>
                  <p style={{ margin: "0 0 8px 0", fontSize: "10px", color: "#94a3b8" }}>
                    {new Date(img.fecha).toLocaleDateString()}
                  </p>

                  <div style={{ display: "flex", gap: "4px" }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerImagen(img.id)}
                      style={{ flex: 1, fontSize: "11px", height: "28px" }}
                    >
                      <ZoomIn size={12} /> Ver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEliminar(img.id)}
                      style={{ fontSize: "11px", height: "28px", color: "#dc2626" }}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de vista previa */}
      {preview && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setPreview(null)}
        >
          <div style={{ position: "absolute", top: "20px", right: "20px", display: "flex", gap: "10px" }}>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleDescargar(preview);
              }}
              style={{ background: "#0ea5e9", color: "white" }}
            >
              <Download size={16} /> Descargar
            </Button>
            <Button
              onClick={() => setPreview(null)}
              style={{ background: "#dc2626", color: "white" }}
            >
              <X size={16} /> Cerrar
            </Button>
          </div>

          <div
            style={{ maxWidth: "90%", maxHeight: "90%", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            {preview.tipo_archivo === "application/pdf" ? (
              <iframe
                src={`data:application/pdf;base64,${preview.archivo_base64}`}
                style={{ width: "800px", height: "600px", border: "none" }}
                title="PDF Preview"
              />
            ) : (
              <img
                src={`data:${preview.tipo_archivo};base64,${preview.archivo_base64}`}
                alt={preview.descripcion}
                style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
