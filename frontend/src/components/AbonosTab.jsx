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
import { Plus, Trash2, DollarSign, Edit } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AbonosTab = ({ token }) => {
  const [abonos, setAbonos] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingAbono, setEditingAbono] = useState(null);
  const [formData, setFormData] = useState({
    paciente_nombre: "",
    paciente_cedula: "",
    monto: 0,
    fecha: new Date().toISOString().split('T')[0],
    tipo_pago: "Efectivo",
    concepto: "",
    proforma_id: "",
    saldo_pendiente: 0,
    recibo_numero: "",
    observaciones: ""
  });

  useEffect(() => {
    fetchAbonos();
    fetchProformas();
  }, []);

  const fetchAbonos = async () => {
    try {
      const response = await axios.get(`${API}/abonos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAbonos(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar abonos");
    }
  };

  const fetchProformas = async () => {
    try {
      const response = await axios.get(`${API}/proformas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProformas(response.data.filter(p => p.estado === "Aceptada"));
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingAbono) {
        await axios.put(
          `${API}/abonos/${editingAbono.id}`,
          {
            monto: formData.monto,
            saldo_pendiente: formData.saldo_pendiente,
            observaciones: formData.observaciones
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Abono actualizado exitosamente");
      } else {
        await axios.post(`${API}/abonos`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Abono registrado exitosamente");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchAbonos();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Error al guardar abono");
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este abono?")) return;

    try {
      await axios.delete(`${API}/abonos/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Abono eliminado");
      fetchAbonos();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar abono");
    }
  };

  const handleEdit = (abono) => {
    setEditingAbono(abono);
    setFormData({
      paciente_nombre: abono.paciente_nombre,
      paciente_cedula: abono.paciente_cedula,
      monto: abono.monto,
      fecha: abono.fecha,
      tipo_pago: abono.tipo_pago,
      concepto: abono.concepto,
      proforma_id: abono.proforma_id || "",
      saldo_pendiente: abono.saldo_pendiente,
      recibo_numero: abono.recibo_numero,
      observaciones: abono.observaciones
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingAbono(null);
    setFormData({
      paciente_nombre: "",
      paciente_cedula: "",
      monto: 0,
      fecha: new Date().toISOString().split('T')[0],
      tipo_pago: "Efectivo",
      concepto: "",
      proforma_id: "",
      saldo_pendiente: 0,
      recibo_numero: "",
      observaciones: ""
    });
  };

  const handleProformaSelection = (proformaId) => {
    const proforma = proformas.find(p => p.id === proformaId);
    if (proforma) {
      // Calcular abonos previos para esta proforma
      const abonosPrevios = abonos
        .filter(a => a.proforma_id === proformaId)
        .reduce((sum, a) => sum + a.monto, 0);
      
      const saldoPendiente = proforma.total - abonosPrevios;
      
      setFormData({
        ...formData,
        proforma_id: proformaId,
        paciente_nombre: proforma.paciente_nombre,
        paciente_cedula: proforma.paciente_cedula,
        concepto: `Abono a Proforma ${proforma.numero_proforma}`,
        saldo_pendiente: saldoPendiente
      });
    }
  };

  const filteredAbonos = abonos.filter((abono) =>
    abono.paciente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    abono.paciente_cedula.includes(searchTerm) ||
    abono.recibo_numero.includes(searchTerm)
  );

  const totalAbonos = filteredAbonos.reduce((sum, abono) => sum + abono.monto, 0);

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Abonos y Pagos Parciales</h2>
          <p className="section-subtitle">Registro de pagos adelantados a tratamientos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="add-button">
              <Plus className="button-icon" />
              Nuevo Abono
            </Button>
          </DialogTrigger>
          <DialogContent className="dialog-scrollable">
            <DialogHeader>
              <DialogTitle>{editingAbono ? "Editar Abono" : "Registrar Nuevo Abono"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-grid">
                {!editingAbono && (
                  <div className="form-field full-width">
                    <Label>Vincular con Proforma (Opcional)</Label>
                    <Select
                      value={formData.proforma_id}
                      onValueChange={handleProformaSelection}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin vincular" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin vincular</SelectItem>
                        {proformas.map((proforma) => (
                          <SelectItem key={proforma.id} value={proforma.id}>
                            {proforma.numero_proforma} - {proforma.paciente_nombre} (${proforma.total})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="form-field">
                  <Label>Paciente *</Label>
                  <Input
                    value={formData.paciente_nombre}
                    onChange={(e) => setFormData({...formData, paciente_nombre: e.target.value})}
                    disabled={editingAbono || formData.proforma_id}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Cédula *</Label>
                  <Input
                    value={formData.paciente_cedula}
                    onChange={(e) => setFormData({...formData, paciente_cedula: e.target.value})}
                    disabled={editingAbono || formData.proforma_id}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Recibo N° *</Label>
                  <Input
                    value={formData.recibo_numero}
                    onChange={(e) => setFormData({...formData, recibo_numero: e.target.value})}
                    placeholder="REC-001"
                    disabled={editingAbono}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Fecha *</Label>
                  <Input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                    disabled={editingAbono}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Monto Abonado ($) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monto}
                    onChange={(e) => setFormData({...formData, monto: parseFloat(e.target.value) || 0})}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Saldo Pendiente ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.saldo_pendiente}
                    onChange={(e) => setFormData({...formData, saldo_pendiente: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div className="form-field">
                  <Label>Tipo de Pago *</Label>
                  <Select
                    value={formData.tipo_pago}
                    onValueChange={(val) => setFormData({...formData, tipo_pago: val})}
                    disabled={editingAbono}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Transferencia">Transferencia</SelectItem>
                      <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-field full-width">
                  <Label>Concepto *</Label>
                  <Input
                    value={formData.concepto}
                    onChange={(e) => setFormData({...formData, concepto: e.target.value})}
                    placeholder="Ej: Abono a tratamiento de ortodoncia"
                    disabled={editingAbono}
                    required
                  />
                </div>
                <div className="form-field full-width">
                  <Label>Observaciones</Label>
                  <Textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                    rows={2}
                  />
                </div>
              </div>

              <div className="form-actions">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Guardando..." : editingAbono ? "Actualizar" : "Registrar Abono"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="search-box">
        <Input
          placeholder="Buscar por paciente, cédula o número de recibo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={{ background: '#E0F2FE', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: '#0C4A6E' }}>
            Total de Abonos: <span style={{ color: '#00a8cc', fontSize: '1.5rem' }}>${totalAbonos.toFixed(2)}</span>
          </span>
          <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
            {filteredAbonos.length} abonos registrados
          </span>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Recibo N°</th>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Cédula</th>
              <th>Concepto</th>
              <th>Tipo Pago</th>
              <th>Monto</th>
              <th>Saldo Pend.</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredAbonos.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  <DollarSign className="empty-icon" />
                  <p>No hay abonos registrados</p>
                </td>
              </tr>
            ) : (
              filteredAbonos.map((abono) => (
                <tr key={abono.id}>
                  <td style={{ fontWeight: 600 }}>{abono.recibo_numero}</td>
                  <td>{abono.fecha}</td>
                  <td>{abono.paciente_nombre}</td>
                  <td>{abono.paciente_cedula}</td>
                  <td>{abono.concepto}</td>
                  <td><span className="badge-payment">{abono.tipo_pago}</span></td>
                  <td className="amount-cell">${abono.monto.toFixed(2)}</td>
                  <td style={{ color: abono.saldo_pendiente > 0 ? '#DC2626' : '#059669', fontWeight: 600 }}>
                    ${abono.saldo_pendiente.toFixed(2)}
                  </td>
                  <td>
                    <div className="actions-cell">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(abono)}
                      >
                        <Edit className="action-icon" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(abono.id)}
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
