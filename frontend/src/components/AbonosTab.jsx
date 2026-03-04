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
import { Plus, Trash2, DollarSign, Eye, CreditCard, CheckCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AbonosTab = ({ token }) => {
  // Estados principales
  const [consultasPendientes, setConsultasPendientes] = useState([]);
  const [todasConsultas, setTodasConsultas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("pendientes"); // pendientes, todos, pagados
  
  // Modal de pago
  const [pagoDialog, setPagoDialog] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [formPago, setFormPago] = useState({
    monto: 0,
    tipo_pago: "efectivo",
    referencia: "",
    notas: ""
  });
  
  // Modal de detalle
  const [detalleDialog, setDetalleDialog] = useState(false);
  const [consultaDetalle, setConsultaDetalle] = useState(null);

  useEffect(() => {
    fetchConsultas();
  }, [filtroEstado]);

  const fetchConsultas = async () => {
    setLoading(true);
    try {
      if (filtroEstado === "pendientes") {
        // Obtener solo consultas con saldo pendiente
        const response = await axios.get(`${API}/financial/reportes/pendientes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setConsultasPendientes(response.data.cuentas || []);
      } else {
        // Obtener todas las consultas
        const response = await axios.get(`${API}/financial/consultas`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTodasConsultas(response.data || []);
      }
    } catch (error) {
      console.error("Error al cargar consultas:", error);
      toast.error("Error al cargar consultas financieras");
    }
    setLoading(false);
  };

  const handleAbrirPago = (consulta) => {
    setConsultaSeleccionada(consulta);
    setFormPago({
      monto: consulta.saldo || 0,
      tipo_pago: "efectivo",
      referencia: "",
      notas: ""
    });
    setPagoDialog(true);
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    
    if (formPago.monto <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    
    if (formPago.monto > consultaSeleccionada.saldo) {
      toast.warning("El monto excede el saldo pendiente. Se registrará el saldo pendiente.");
      formPago.monto = consultaSeleccionada.saldo;
    }
    
    setLoading(true);
    try {
      await axios.post(
        `${API}/financial/consultas/${consultaSeleccionada.id}/pagos`,
        {
          consulta_id: consultaSeleccionada.id,
          monto: formPago.monto,
          tipo_pago: formPago.tipo_pago,
          referencia: formPago.referencia,
          notas: formPago.notas
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Pago registrado exitosamente");
      setPagoDialog(false);
      setConsultaSeleccionada(null);
      fetchConsultas();
    } catch (error) {
      console.error("Error al registrar pago:", error);
      toast.error(error.response?.data?.detail || "Error al registrar pago");
    }
    setLoading(false);
  };

  const handleVerDetalle = async (consulta) => {
    try {
      const response = await axios.get(
        `${API}/financial/consultas/${consulta.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConsultaDetalle(response.data);
      setDetalleDialog(true);
    } catch (error) {
      console.error("Error al cargar detalle:", error);
      toast.error("Error al cargar detalle de consulta");
    }
  };

  const handleEliminarPago = async (consultaId, pagoId) => {
    if (!window.confirm("¿Está seguro de eliminar este pago?")) return;
    
    try {
      await axios.delete(
        `${API}/financial/consultas/${consultaId}/pagos/${pagoId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Pago eliminado");
      
      // Recargar detalle
      const response = await axios.get(
        `${API}/financial/consultas/${consultaId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setConsultaDetalle(response.data);
      fetchConsultas();
    } catch (error) {
      console.error("Error al eliminar pago:", error);
      toast.error("Error al eliminar pago");
    }
  };

  // Determinar qué datos mostrar
  const consultasAMostrar = filtroEstado === "pendientes" 
    ? consultasPendientes 
    : filtroEstado === "pagados"
    ? todasConsultas.filter(c => c.estado_pago === "pagado")
    : todasConsultas;

  // Filtrar por búsqueda
  const consultasFiltradas = consultasAMostrar.filter((consulta) =>
    consulta.paciente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    consulta.paciente_cedula?.includes(searchTerm) ||
    consulta.especialidad?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular totales
  const totalPendiente = consultasFiltradas
    .filter(c => c.estado_pago !== "pagado")
    .reduce((sum, c) => sum + (c.saldo || 0), 0);

  const getEstadoBadge = (estado) => {
    const estilos = {
      pendiente: { background: '#FEF3C7', color: '#92400E' },
      parcial: { background: '#DBEAFE', color: '#1E40AF' },
      pagado: { background: '#D1FAE5', color: '#065F46' }
    };
    return estilos[estado] || estilos.pendiente;
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Pagos y Abonos de Consultas</h2>
          <p className="section-subtitle">
            Gestión de pagos vinculados a consultas médicas
          </p>
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
            placeholder="Buscar por paciente, cédula o especialidad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger style={{ width: '200px' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendientes">Con Saldo Pendiente</SelectItem>
            <SelectItem value="todos">Todas las Consultas</SelectItem>
            <SelectItem value="pagados">Pagadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Resumen */}
      <div style={{ 
        background: '#E0F2FE', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
            {consultasFiltradas.length} consultas
          </span>
        </div>
        {filtroEstado !== "pagados" && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            background: '#FEF3C7',
            padding: '0.5rem 1rem',
            borderRadius: '8px'
          }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#92400E' }}>
              Total Pendiente:
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#D97706' }}>
              ${totalPendiente.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Tabla de consultas */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Cédula</th>
              <th>Especialidad</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                  Cargando...
                </td>
              </tr>
            ) : consultasFiltradas.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  <DollarSign className="empty-icon" />
                  <p>No hay consultas {filtroEstado === "pendientes" ? "con saldo pendiente" : ""}</p>
                </td>
              </tr>
            ) : (
              consultasFiltradas.map((consulta) => (
                <tr key={consulta.id}>
                  <td>{consulta.fecha}</td>
                  <td><strong>{consulta.paciente_nombre}</strong></td>
                  <td>{consulta.paciente_cedula}</td>
                  <td><span className="badge">{consulta.especialidad}</span></td>
                  <td style={{ fontWeight: 600 }}>${(consulta.total || 0).toFixed(2)}</td>
                  <td style={{ color: '#059669' }}>${(consulta.total_pagado || 0).toFixed(2)}</td>
                  <td style={{ 
                    fontWeight: 700, 
                    color: (consulta.saldo || 0) > 0 ? '#DC2626' : '#059669' 
                  }}>
                    ${(consulta.saldo || 0).toFixed(2)}
                  </td>
                  <td>
                    <span style={{
                      ...getEstadoBadge(consulta.estado_pago),
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'capitalize'
                    }}>
                      {consulta.estado_pago}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleVerDetalle(consulta)}
                        title="Ver detalle"
                      >
                        <Eye className="action-icon" />
                      </Button>
                      {consulta.estado_pago !== "pagado" && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAbrirPago(consulta)}
                          style={{ 
                            background: '#00a8cc',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <CreditCard size={14} />
                          Abonar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Pago */}
      <Dialog open={pagoDialog} onOpenChange={setPagoDialog}>
        <DialogContent className="dialog-content">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          {consultaSeleccionada && (
            <form onSubmit={handleRegistrarPago}>
              <div style={{ 
                background: '#F0F9FF', 
                padding: '1rem', 
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  {consultaSeleccionada.paciente_nombre}
                </p>
                <p style={{ color: '#64748B', fontSize: '0.875rem' }}>
                  Cédula: {consultaSeleccionada.paciente_cedula}
                </p>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  marginTop: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #BFDBFE'
                }}>
                  <span>Total consulta:</span>
                  <strong>${(consultaSeleccionada.total || 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ya pagado:</span>
                  <span style={{ color: '#059669' }}>
                    ${(consultaSeleccionada.total_pagado || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  color: '#DC2626'
                }}>
                  <span>Saldo pendiente:</span>
                  <span>${(consultaSeleccionada.saldo || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <Label>Monto a Abonar ($) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={consultaSeleccionada.saldo || 0}
                    value={formPago.monto}
                    onChange={(e) => setFormPago({
                      ...formPago, 
                      monto: parseFloat(e.target.value) || 0
                    })}
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Tipo de Pago *</Label>
                  <Select
                    value={formPago.tipo_pago}
                    onValueChange={(val) => setFormPago({...formPago, tipo_pago: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-field full-width">
                  <Label>Referencia / Nº Comprobante</Label>
                  <Input
                    value={formPago.referencia}
                    onChange={(e) => setFormPago({...formPago, referencia: e.target.value})}
                    placeholder="Ej: Transferencia #12345"
                  />
                </div>
                <div className="form-field full-width">
                  <Label>Notas</Label>
                  <Textarea
                    value={formPago.notas}
                    onChange={(e) => setFormPago({...formPago, notas: e.target.value})}
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter style={{ marginTop: '1rem' }}>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setPagoDialog(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Registrando..." : "Registrar Pago"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalle */}
      <Dialog open={detalleDialog} onOpenChange={setDetalleDialog}>
        <DialogContent className="dialog-content dialog-wide">
          <DialogHeader>
            <DialogTitle>Detalle de Consulta Financiera</DialogTitle>
          </DialogHeader>
          {consultaDetalle && (
            <div>
              {/* Info del paciente */}
              <div style={{ 
                background: '#F0F9FF', 
                padding: '1rem', 
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                      {consultaDetalle.paciente_nombre}
                    </p>
                    <p style={{ color: '#64748B' }}>
                      Cédula: {consultaDetalle.paciente_cedula}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.875rem', color: '#64748B' }}>
                      {consultaDetalle.fecha}
                    </p>
                    <span className="badge">{consultaDetalle.especialidad}</span>
                  </div>
                </div>
                <p style={{ marginTop: '0.5rem', color: '#64748B' }}>
                  <strong>Doctor:</strong> {consultaDetalle.doctor_nombre}
                </p>
              </div>

              {/* Servicios */}
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Servicios</h4>
                <table className="data-table" style={{ fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th>Cant.</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(consultaDetalle.servicios || []).map((srv, idx) => (
                      <tr key={idx}>
                        <td>{srv.servicio}</td>
                        <td>{srv.cantidad}</td>
                        <td>${(srv.precio_unitario || 0).toFixed(2)}</td>
                        <td>${(srv.subtotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                      <td colSpan="3" style={{ textAlign: 'right' }}>TOTAL:</td>
                      <td>${(consultaDetalle.total || 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagos */}
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  Historial de Pagos
                </h4>
                {(consultaDetalle.pagos || []).length === 0 ? (
                  <p style={{ color: '#64748B', fontStyle: 'italic' }}>
                    Sin pagos registrados
                  </p>
                ) : (
                  <table className="data-table" style={{ fontSize: '0.875rem' }}>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Tipo</th>
                        <th>Referencia</th>
                        <th>Recibido por</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(consultaDetalle.pagos || []).map((pago, idx) => (
                        <tr key={idx}>
                          <td>{pago.fecha}</td>
                          <td style={{ fontWeight: 600, color: '#059669' }}>
                            ${(pago.monto || 0).toFixed(2)}
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{pago.tipo_pago}</td>
                          <td>{pago.referencia || '-'}</td>
                          <td>{pago.recibido_por || '-'}</td>
                          <td>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEliminarPago(consultaDetalle.id, pago.id)}
                              title="Eliminar pago"
                            >
                              <Trash2 className="delete-icon" size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700 }}>
                        <td>Total Pagado:</td>
                        <td style={{ color: '#059669' }}>
                          ${(consultaDetalle.total_pagado || 0).toFixed(2)}
                        </td>
                        <td colSpan="4"></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              {/* Resumen */}
              <div style={{ 
                background: consultaDetalle.estado_pago === 'pagado' ? '#D1FAE5' : '#FEF3C7',
                padding: '1rem',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>Estado: </span>
                  <span style={{ 
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: consultaDetalle.estado_pago === 'pagado' ? '#065F46' : '#92400E'
                  }}>
                    {consultaDetalle.estado_pago}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 600 }}>Saldo Pendiente: </span>
                  <span style={{ 
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: (consultaDetalle.saldo || 0) > 0 ? '#DC2626' : '#059669'
                  }}>
                    ${(consultaDetalle.saldo || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Botón de pago si hay saldo */}
              {consultaDetalle.estado_pago !== 'pagado' && (
                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                  <Button
                    onClick={() => {
                      setDetalleDialog(false);
                      handleAbrirPago(consultaDetalle);
                    }}
                    style={{ background: '#00a8cc' }}
                  >
                    <CreditCard className="button-icon" />
                    Registrar Pago
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
