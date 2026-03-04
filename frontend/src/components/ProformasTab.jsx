import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Trash2, FileText, X, PlayCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const ProformasTab = ({ token }) => {
  const [proformas, setProformas] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    numero_proforma: "",
    paciente_nombre: "",
    paciente_cedula: "",
    paciente_telefono: "",
    doctor_id: "",
    especialidad: "",
    items: [{ descripcion: "", cantidad: 1, precio_unitario: 0, subtotal: 0 }],
    descuento: 0,
    fecha_emision: new Date().toISOString().split('T')[0],
    validez_dias: 30,
    observaciones: ""
  });

  useEffect(() => {
    fetchProformas();
    fetchDoctors();
  }, []);

  const fetchProformas = async () => {
    try {
      const response = await axios.get(`${API}/proformas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProformas(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar proformas");
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API}/doctors`);
      setDoctors(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    // Calcular subtotal automáticamente
    if (field === 'cantidad' || field === 'precio_unitario') {
      newItems[index].subtotal = newItems[index].cantidad * newItems[index].precio_unitario;
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { descripcion: "", cantidad: 1, precio_unitario: 0, subtotal: 0 }]
    });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotal = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.subtotal, 0);
    return subtotal - (formData.descuento || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/proformas`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Proforma creada exitosamente");
      setIsDialogOpen(false);
      resetForm();
      fetchProformas();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Error al crear proforma");
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await axios.put(
        `${API}/proformas/${id}`,
        { estado: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Estado actualizado");
      fetchProformas();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar estado");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar esta proforma?")) return;

    try {
      await axios.delete(`${API}/proformas/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Proforma eliminada");
      fetchProformas();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar proforma");
    }
  };

  const resetForm = () => {
    setFormData({
      numero_proforma: "",
      paciente_nombre: "",
      paciente_cedula: "",
      paciente_telefono: "",
      doctor_id: "",
      especialidad: "",
      items: [{ descripcion: "", cantidad: 1, precio_unitario: 0, subtotal: 0 }],
      descuento: 0,
      fecha_emision: new Date().toISOString().split('T')[0],
      validez_dias: 30,
      observaciones: ""
    });
  };

  // Convertir proforma aceptada en consulta financiera (iniciar tratamiento)
  const handleConvertirATratamiento = async (proforma) => {
    if (proforma.estado !== "Aceptada") {
      toast.error("Solo se pueden convertir proformas con estado 'Aceptada'");
      return;
    }
    
    if (!window.confirm(`¿Iniciar tratamiento para ${proforma.paciente_nombre}?\n\nEsto creará una cuenta por cobrar de $${proforma.total.toFixed(2)} que podrá recibir pagos/abonos.`)) {
      return;
    }
    
    try {
      await axios.post(
        `${API}/financial/consultas/desde-proforma/${proforma.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Tratamiento iniciado - Cuenta creada en Pagos/Abonos");
      fetchProformas();
    } catch (error) {
      console.error("Error al convertir proforma:", error);
      toast.error(error.response?.data?.detail || "Error al iniciar tratamiento");
    }
  };

  const filteredProformas = proformas.filter((proforma) =>
    proforma.paciente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    proforma.paciente_cedula.includes(searchTerm) ||
    proforma.numero_proforma.includes(searchTerm)
  );

  const getStatusBadgeClass = (estado) => {
    const statusMap = {
      'Pendiente': 'status-pending',
      'Aceptada': 'status-active',
      'Rechazada': 'status-inactive',
      'Facturada': 'status-paid'
    };
    return statusMap[estado] || 'badge';
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Proformas</h2>
          <p className="section-subtitle">Gestión de cotizaciones para tratamientos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="add-button">
              <Plus className="button-icon" />
              Nueva Proforma
            </Button>
          </DialogTrigger>
          <DialogContent className="dialog-scrollable max-w-4xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <DialogHeader>
              <DialogTitle>Nueva Proforma</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-grid">
                <div className="form-field">
                  <Label>N° Proforma *</Label>
                  <Input
                    value={formData.numero_proforma}
                    onChange={(e) => setFormData({...formData, numero_proforma: e.target.value})}
                    placeholder="PRF-001"
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Fecha de Emisión *</Label>
                  <Input
                    type="date"
                    value={formData.fecha_emision}
                    onChange={(e) => setFormData({...formData, fecha_emision: e.target.value})}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Paciente *</Label>
                  <Input
                    value={formData.paciente_nombre}
                    onChange={(e) => setFormData({...formData, paciente_nombre: e.target.value})}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Cédula *</Label>
                  <Input
                    value={formData.paciente_cedula}
                    onChange={(e) => setFormData({...formData, paciente_cedula: e.target.value})}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Teléfono *</Label>
                  <Input
                    value={formData.paciente_telefono}
                    onChange={(e) => setFormData({...formData, paciente_telefono: e.target.value})}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Doctor *</Label>
                  <Select
                    value={formData.doctor_id}
                    onValueChange={(val) => {
                      const doctor = doctors.find(d => d.id === val);
                      setFormData({
                        ...formData,
                        doctor_id: val,
                        especialidad: doctor?.especialidad || ""
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.id}>
                          {doctor.nombre} - {doctor.especialidad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-field">
                  <Label>Validez (días)</Label>
                  <Input
                    type="number"
                    value={formData.validez_dias}
                    onChange={(e) => setFormData({...formData, validez_dias: parseInt(e.target.value)})}
                  />
                </div>
                <div className="form-field">
                  <Label>Descuento ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.descuento}
                    onChange={(e) => setFormData({...formData, descuento: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <Label>Items del Tratamiento</Label>
                  <Button type="button" onClick={addItem} variant="outline" size="sm">
                    <Plus className="button-icon" />
                    Agregar Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="medication-item">
                      <div className="form-grid">
                        <div className="form-field full-width">
                          <Label>Descripción</Label>
                          <Input
                            value={item.descripcion}
                            onChange={(e) => handleItemChange(index, 'descripcion', e.target.value)}
                            placeholder="Ej: Limpieza dental profunda"
                            required
                          />
                        </div>
                        <div className="form-field">
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) => handleItemChange(index, 'cantidad', parseInt(e.target.value) || 1)}
                            required
                          />
                        </div>
                        <div className="form-field">
                          <Label>Precio Unitario ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.precio_unitario}
                            onChange={(e) => handleItemChange(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                            required
                          />
                        </div>
                        <div className="form-field">
                          <Label>Subtotal ($)</Label>
                          <Input
                            type="number"
                            value={item.subtotal.toFixed(2)}
                            disabled
                            style={{ background: '#F8FAFC', fontWeight: 600 }}
                          />
                        </div>
                      </div>
                      {formData.items.length > 1 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(index)}
                          style={{ marginTop: '0.5rem' }}
                        >
                          <Trash2 className="button-icon" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: '#E0F2FE', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>Subtotal:</span>
                  <span>${formData.items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>Descuento:</span>
                  <span>-${(formData.descuento || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, color: '#00a8cc' }}>
                  <span>Total:</span>
                  <span>${calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              <div className="form-field">
                <Label>Observaciones</Label>
                <Textarea
                  value={formData.observaciones}
                  onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                  rows={2}
                />
              </div>

              <div className="form-actions">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Guardando..." : "Crear Proforma"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="search-box">
        <Input
          placeholder="Buscar por paciente, cédula o número de proforma..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>N° Proforma</th>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Cédula</th>
              <th>Doctor</th>
              <th>Especialidad</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProformas.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  <FileText className="empty-icon" />
                  <p>No hay proformas registradas</p>
                </td>
              </tr>
            ) : (
              filteredProformas.map((proforma) => (
                <tr key={proforma.id}>
                  <td style={{ fontWeight: 600 }}>{proforma.numero_proforma}</td>
                  <td>{proforma.fecha_emision}</td>
                  <td>{proforma.paciente_nombre}</td>
                  <td>{proforma.paciente_cedula}</td>
                  <td>{proforma.doctor_nombre}</td>
                  <td><span className="badge">{proforma.especialidad}</span></td>
                  <td className="amount-cell">${proforma.total.toFixed(2)}</td>
                  <td>
                    <Select
                      value={proforma.estado}
                      onValueChange={(val) => handleUpdateStatus(proforma.id, val)}
                    >
                      <SelectTrigger className={getStatusBadgeClass(proforma.estado)} style={{ border: 'none', minWidth: '120px' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                        <SelectItem value="Aceptada">Aceptada</SelectItem>
                        <SelectItem value="Rechazada">Rechazada</SelectItem>
                        <SelectItem value="Facturada">Facturada</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const response = await axios.get(
                              `${API}/proformas/${proforma.id}/pdf`,
                              { 
                                headers: { Authorization: `Bearer ${token}` },
                                responseType: 'blob'
                              }
                            );
                            const url = window.URL.createObjectURL(new Blob([response.data]));
                            const link = document.createElement('a');
                            link.href = url;
                            link.setAttribute('download', `proforma_${proforma.numero_proforma}.pdf`);
                            document.body.appendChild(link);
                            link.click();
                            link.remove();
                            toast.success("Proforma descargada");
                          } catch (error) {
                            toast.error("Error al descargar proforma");
                          }
                        }}
                        style={{ marginRight: '0.5rem' }}
                      >
                        <FileText className="button-icon" />
                        Ver PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(proforma.id)}
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
    </div>
  );
};
