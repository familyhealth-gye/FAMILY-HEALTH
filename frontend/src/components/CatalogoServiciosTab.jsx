import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { Plus, Edit, Trash2, Package, RefreshCw, DollarSign } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ESPECIALIDADES = [
  "Medicina General",
  "Odontología", 
  "Pediatría",
  "Ginecología",
  "Obstetricia",
  "Psicología",
  "Nutrición",
  "Laboratorio Clínico",
  "Ecografía",
  "Terapia Física"
];

export const CatalogoServiciosTab = ({ token }) => {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEspecialidad, setFiltroEspecialidad] = useState("todas");
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  
  // Modal de edición/creación
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServicio, setEditingServicio] = useState(null);
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    especialidad: "",
    precio_base: 0,
    activo: true
  });

  useEffect(() => {
    fetchServicios();
  }, [mostrarInactivos]);

  const fetchServicios = async () => {
    setLoading(true);
    try {
      const endpoint = mostrarInactivos ? "/financial/catalogo/todos" : "/financial/catalogo";
      const response = await axios.get(`${API}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServicios(response.data);
    } catch (error) {
      console.error("Error al cargar servicios:", error);
      toast.error("Error al cargar catálogo de servicios");
    }
    setLoading(false);
  };

  const handleSeedCatalogo = async () => {
    if (!window.confirm("¿Deseas poblar el catálogo con servicios predefinidos?")) return;
    
    try {
      const response = await axios.post(
        `${API}/financial/catalogo/seed`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      fetchServicios();
    } catch (error) {
      console.error("Error al poblar catálogo:", error);
      toast.error("Error al poblar catálogo");
    }
  };

  const handleOpenDialog = (servicio = null) => {
    if (servicio) {
      setEditingServicio(servicio);
      setFormData({
        codigo: servicio.codigo || "",
        nombre: servicio.nombre,
        descripcion: servicio.descripcion || "",
        especialidad: servicio.especialidad,
        precio_base: servicio.precio_base,
        activo: servicio.activo !== false
      });
    } else {
      setEditingServicio(null);
      setFormData({
        codigo: "",
        nombre: "",
        descripcion: "",
        especialidad: "",
        precio_base: 0,
        activo: true
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.especialidad || formData.precio_base <= 0) {
      toast.error("Complete todos los campos obligatorios");
      return;
    }
    
    setLoading(true);
    try {
      if (editingServicio) {
        await axios.put(
          `${API}/financial/catalogo/${editingServicio.id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Servicio actualizado");
      } else {
        await axios.post(
          `${API}/financial/catalogo`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Servicio creado");
      }
      setDialogOpen(false);
      fetchServicios();
    } catch (error) {
      console.error("Error al guardar servicio:", error);
      toast.error(error.response?.data?.detail || "Error al guardar servicio");
    }
    setLoading(false);
  };

  const handleToggleActivo = async (servicio) => {
    try {
      await axios.put(
        `${API}/financial/catalogo/${servicio.id}`,
        { activo: !servicio.activo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(servicio.activo ? "Servicio desactivado" : "Servicio activado");
      fetchServicios();
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      toast.error("Error al cambiar estado del servicio");
    }
  };

  const handleDelete = async (servicio) => {
    if (!window.confirm(`¿Eliminar permanentemente "${servicio.nombre}"?`)) return;
    
    try {
      await axios.delete(
        `${API}/financial/catalogo/${servicio.id}/permanente`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Servicio eliminado");
      fetchServicios();
    } catch (error) {
      console.error("Error al eliminar:", error);
      toast.error("Error al eliminar servicio");
    }
  };

  // Filtrar servicios
  const serviciosFiltrados = servicios.filter(srv => {
    const matchSearch = srv.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       srv.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchEspecialidad = filtroEspecialidad === "todas" || srv.especialidad === filtroEspecialidad;
    return matchSearch && matchEspecialidad;
  });

  // Agrupar por especialidad para resumen
  const resumenPorEspecialidad = servicios.reduce((acc, srv) => {
    if (!acc[srv.especialidad]) {
      acc[srv.especialidad] = { count: 0, activos: 0 };
    }
    acc[srv.especialidad].count++;
    if (srv.activo !== false) acc[srv.especialidad].activos++;
    return acc;
  }, {});

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Catálogo de Servicios</h2>
          <p className="section-subtitle">
            {servicios.length} servicios registrados
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant="outline"
            onClick={handleSeedCatalogo}
            title="Poblar con servicios predefinidos"
          >
            <RefreshCw className="button-icon" />
            Poblar Catálogo
          </Button>
          <Button className="add-button" onClick={() => handleOpenDialog()}>
            <Plus className="button-icon" />
            Nuevo Servicio
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <Input
            placeholder="Buscar por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filtroEspecialidad} onValueChange={setFiltroEspecialidad}>
          <SelectTrigger style={{ width: '200px' }}>
            <SelectValue placeholder="Especialidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las Especialidades</SelectItem>
            {ESPECIALIDADES.map(esp => (
              <SelectItem key={esp} value={esp}>{esp}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
          />
          Mostrar inactivos
        </label>
      </div>

      {/* Resumen por especialidad */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
        {Object.entries(resumenPorEspecialidad).map(([esp, data]) => (
          <div
            key={esp}
            style={{
              background: '#F0F9FF',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              border: filtroEspecialidad === esp ? '2px solid #00a8cc' : '2px solid transparent'
            }}
            onClick={() => setFiltroEspecialidad(filtroEspecialidad === esp ? "todas" : esp)}
          >
            <div style={{ fontWeight: 600, color: '#0C4A6E', fontSize: '0.875rem' }}>
              {esp}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
              {data.activos} activos / {data.count} total
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de servicios */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Especialidad</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                  Cargando...
                </td>
              </tr>
            ) : serviciosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  <Package className="empty-icon" />
                  <p>No hay servicios en el catálogo</p>
                  <Button 
                    variant="outline" 
                    onClick={handleSeedCatalogo}
                    style={{ marginTop: '1rem' }}
                  >
                    Poblar con servicios predefinidos
                  </Button>
                </td>
              </tr>
            ) : (
              serviciosFiltrados.map((servicio) => (
                <tr 
                  key={servicio.id}
                  style={{ opacity: servicio.activo === false ? 0.5 : 1 }}
                >
                  <td style={{ fontWeight: 600, color: '#64748B' }}>
                    {servicio.codigo || '-'}
                  </td>
                  <td>
                    <strong>{servicio.nombre}</strong>
                    {servicio.descripcion && (
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {servicio.descripcion}
                      </div>
                    )}
                  </td>
                  <td><span className="badge">{servicio.especialidad}</span></td>
                  <td style={{ fontWeight: 700, color: '#059669' }}>
                    ${servicio.precio_base?.toFixed(2)}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: servicio.activo !== false ? '#D1FAE5' : '#FEE2E2',
                        color: servicio.activo !== false ? '#065F46' : '#991B1B'
                      }}
                    >
                      {servicio.activo !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(servicio)}
                        title="Editar"
                      >
                        <Edit className="action-icon" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActivo(servicio)}
                        title={servicio.activo !== false ? "Desactivar" : "Activar"}
                      >
                        <DollarSign 
                          className="action-icon" 
                          style={{ color: servicio.activo !== false ? '#059669' : '#DC2626' }}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(servicio)}
                        title="Eliminar permanentemente"
                      >
                        <Trash2 className="delete-icon" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Edición/Creación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="dialog-content">
          <DialogHeader>
            <DialogTitle>
              {editingServicio ? "Editar Servicio" : "Nuevo Servicio"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <Label>Código</Label>
                <Input
                  value={formData.codigo}
                  onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                  placeholder="Ej: OD001"
                />
              </div>
              <div className="form-field">
                <Label>Especialidad *</Label>
                <Select
                  value={formData.especialidad}
                  onValueChange={(val) => setFormData({...formData, especialidad: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ESPECIALIDADES.map(esp => (
                      <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="form-field full-width">
                <Label>Nombre del Servicio *</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  placeholder="Ej: Limpieza Dental"
                  required
                />
              </div>
              <div className="form-field full-width">
                <Label>Descripción</Label>
                <Input
                  value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  placeholder="Descripción opcional del servicio"
                />
              </div>
              <div className="form-field">
                <Label>Precio Base ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio_base}
                  onChange={(e) => setFormData({...formData, precio_base: parseFloat(e.target.value) || 0})}
                  required
                />
              </div>
              <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                />
                <Label htmlFor="activo" style={{ margin: 0 }}>Servicio Activo</Label>
              </div>
            </div>

            <DialogFooter style={{ marginTop: '1.5rem' }}>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : editingServicio ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};