import { useState, useEffect } from "react";
import { 
  DollarSign, Users, FileText, CreditCard, Download, 
  Plus, Search, Calendar, TrendingUp, AlertCircle,
  CheckCircle, Clock, Filter, Printer, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const FinancialModule = ({ user, token }) => {
  const [activeTab, setActiveTab] = useState("consultas");
  const [loading, setLoading] = useState(false);
  
  // Estados
  const [consultas, setConsultas] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [reporteMensual, setReporteMensual] = useState(null);
  
  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState("");
  
  // Dialogs
  const [pagoDialog, setPagoDialog] = useState(false);
  const [servicioDialog, setServicioDialog] = useState(false);
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const [detalleDialog, setDetalleDialog] = useState(false);
  
  // Forms
  const [pagoForm, setPagoForm] = useState({
    monto: "",
    tipo_pago: "efectivo",
    referencia: "",
    notas: ""
  });
  
  const [servicioForm, setServicioForm] = useState({
    servicio: "",
    precio_unitario: "",
    cantidad: 1,
    descripcion: ""
  });

  // Cargar datos iniciales
  useEffect(() => {
    fetchConsultas();
    fetchPendientes();
    fetchCatalogo();
  }, []);

  useEffect(() => {
    if (filtroMes) {
      fetchReporteMensual();
    }
  }, [filtroMes]);

  const fetchConsultas = async () => {
    try {
      let url = `${API}/financial/consultas`;
      if (filtroEstado !== "todos") {
        url += `?estado_pago=${filtroEstado}`;
      }
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConsultas(response.data);
    } catch (error) {
      console.error("Error fetching consultas:", error);
    }
  };

  const fetchPendientes = async () => {
    try {
      const response = await axios.get(`${API}/financial/reportes/pendientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendientes(response.data);
    } catch (error) {
      console.error("Error fetching pendientes:", error);
    }
  };

  const fetchCatalogo = async () => {
    try {
      const response = await axios.get(`${API}/financial/catalogo`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCatalogo(response.data);
    } catch (error) {
      // Si no hay catálogo, intentar crear el seed
      try {
        await axios.post(`${API}/financial/catalogo/seed`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const response = await axios.get(`${API}/financial/catalogo`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCatalogo(response.data);
      } catch (e) {
        console.error("Error seeding catalogo:", e);
      }
    }
  };

  const fetchReporteMensual = async () => {
    try {
      const response = await axios.get(`${API}/financial/reportes/mensual?mes=${filtroMes}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReporteMensual(response.data);
    } catch (error) {
      console.error("Error fetching reporte:", error);
    }
  };

  const handleRegistrarPago = async () => {
    if (!selectedConsulta || !pagoForm.monto) {
      toast.error("Ingrese el monto del pago");
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(
        `${API}/financial/consultas/${selectedConsulta.id}/pagos`,
        {
          ...pagoForm,
          monto: parseFloat(pagoForm.monto),
          fecha: new Date().toISOString().split('T')[0]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Pago registrado exitosamente");
      setPagoDialog(false);
      setPagoForm({ monto: "", tipo_pago: "efectivo", referencia: "", notas: "" });
      fetchConsultas();
      fetchPendientes();
      fetchReporteMensual();
    } catch (error) {
      toast.error("Error al registrar pago");
    }
    setLoading(false);
  };

  const handleAgregarServicio = async () => {
    if (!selectedConsulta || !servicioForm.servicio || !servicioForm.precio_unitario) {
      toast.error("Complete los campos requeridos");
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(
        `${API}/financial/consultas/${selectedConsulta.id}/servicios`,
        {
          ...servicioForm,
          precio_unitario: parseFloat(servicioForm.precio_unitario),
          cantidad: parseInt(servicioForm.cantidad)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Servicio agregado");
      setServicioDialog(false);
      setServicioForm({ servicio: "", precio_unitario: "", cantidad: 1, descripcion: "" });
      fetchConsultas();
      fetchPendientes();
    } catch (error) {
      toast.error("Error al agregar servicio");
    }
    setLoading(false);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value || 0);
  };

  const getEstadoPagoColor = (estado) => {
    switch (estado) {
      case 'pagado': return { bg: '#D1FAE5', color: '#065F46' };
      case 'parcial': return { bg: '#FEF3C7', color: '#92400E' };
      case 'pendiente': return { bg: '#FEE2E2', color: '#DC2626' };
      default: return { bg: '#F3F4F6', color: '#374151' };
    }
  };

  const filteredConsultas = consultas.filter(c => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return c.paciente_nombre?.toLowerCase().includes(search) ||
             c.paciente_cedula?.includes(search);
    }
    return true;
  });

  return (
    <div className="tab-content">
      {/* Header con KPIs */}
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="section-title">Módulo Financiero</h2>
          <p className="section-subtitle">Gestión de cobros, pagos y reportes</p>
        </div>
      </div>

      {/* KPIs Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem', 
        marginBottom: '1.5rem' 
      }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', 
          padding: '1.25rem', 
          borderRadius: '12px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>Facturado este mes</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                {formatCurrency(reporteMensual?.total_facturado)}
              </p>
            </div>
            <TrendingUp size={32} style={{ opacity: 0.8 }} />
          </div>
        </div>

        <div style={{ 
          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', 
          padding: '1.25rem', 
          borderRadius: '12px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>Cobrado este mes</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                {formatCurrency(reporteMensual?.total_cobrado)}
              </p>
            </div>
            <CheckCircle size={32} style={{ opacity: 0.8 }} />
          </div>
        </div>

        <div style={{ 
          background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', 
          padding: '1.25rem', 
          borderRadius: '12px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>Pendiente total</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                {formatCurrency(pendientes?.total_pendiente)}
              </p>
            </div>
            <Clock size={32} style={{ opacity: 0.8 }} />
          </div>
        </div>

        <div style={{ 
          background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', 
          padding: '1.25rem', 
          borderRadius: '12px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>Cuentas pendientes</p>
              <p style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                {pendientes?.total_cuentas || 0}
              </p>
            </div>
            <AlertCircle size={32} style={{ opacity: 0.8 }} />
          </div>
        </div>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList style={{ marginBottom: '1rem' }}>
          <TabsTrigger value="consultas">
            <FileText className="tab-icon" style={{ marginRight: '0.5rem' }} />
            Consultas
          </TabsTrigger>
          <TabsTrigger value="pendientes">
            <AlertCircle className="tab-icon" style={{ marginRight: '0.5rem' }} />
            Pendientes ({pendientes?.total_cuentas || 0})
          </TabsTrigger>
          <TabsTrigger value="reportes">
            <TrendingUp className="tab-icon" style={{ marginRight: '0.5rem' }} />
            Reportes
          </TabsTrigger>
          <TabsTrigger value="catalogo">
            <DollarSign className="tab-icon" style={{ marginRight: '0.5rem' }} />
            Catálogo
          </TabsTrigger>
        </TabsList>

        {/* Tab Consultas */}
        <TabsContent value="consultas">
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <Input
                placeholder="Buscar por paciente o cédula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filtroEstado} onValueChange={(val) => { setFiltroEstado(val); fetchConsultas(); }}>
              <SelectTrigger style={{ width: '180px' }}>
                <SelectValue placeholder="Estado de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="pagado">Pagado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Especialidad</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredConsultas.map((consulta) => {
                  const estadoStyle = getEstadoPagoColor(consulta.estado_pago);
                  return (
                    <tr key={consulta.id}>
                      <td>{consulta.fecha}</td>
                      <td>
                        <div>
                          <strong>{consulta.paciente_nombre}</strong>
                          <br />
                          <span style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                            {consulta.paciente_cedula}
                          </span>
                        </div>
                      </td>
                      <td><span className="badge">{consulta.especialidad}</span></td>
                      <td><strong>{formatCurrency(consulta.total)}</strong></td>
                      <td style={{ color: '#059669' }}>{formatCurrency(consulta.total_pagado)}</td>
                      <td style={{ color: consulta.saldo > 0 ? '#DC2626' : '#059669', fontWeight: 600 }}>
                        {formatCurrency(consulta.saldo)}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: estadoStyle.bg,
                          color: estadoStyle.color,
                          textTransform: 'capitalize'
                        }}>
                          {consulta.estado_pago}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedConsulta(consulta); setDetalleDialog(true); }}
                            title="Ver detalle"
                          >
                            <Eye size={16} />
                          </Button>
                          {consulta.saldo > 0 && (
                            <Button
                              size="sm"
                              onClick={() => { setSelectedConsulta(consulta); setPagoDialog(true); }}
                              title="Registrar pago"
                            >
                              <CreditCard size={16} />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedConsulta(consulta); setServicioDialog(true); }}
                            title="Agregar servicio"
                          >
                            <Plus size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredConsultas.length === 0 && (
              <div className="empty-state">
                <FileText className="empty-icon" />
                <p>No hay consultas financieras registradas</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab Pendientes */}
        <TabsContent value="pendientes">
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
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendientes?.cuentas?.map((cuenta) => (
                  <tr key={cuenta.id}>
                    <td>{cuenta.fecha}</td>
                    <td><strong>{cuenta.paciente_nombre}</strong></td>
                    <td>{cuenta.paciente_cedula}</td>
                    <td><span className="badge">{cuenta.especialidad}</span></td>
                    <td>{formatCurrency(cuenta.total)}</td>
                    <td style={{ color: '#059669' }}>{formatCurrency(cuenta.total_pagado)}</td>
                    <td style={{ color: '#DC2626', fontWeight: 600 }}>
                      {formatCurrency(cuenta.saldo)}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        onClick={() => { 
                          setSelectedConsulta(cuenta); 
                          setPagoDialog(true); 
                        }}
                      >
                        <CreditCard size={16} style={{ marginRight: '0.5rem' }} />
                        Cobrar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!pendientes?.cuentas || pendientes.cuentas.length === 0) && (
              <div className="empty-state">
                <CheckCircle className="empty-icon" style={{ color: '#059669' }} />
                <p>No hay cuentas pendientes</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab Reportes */}
        <TabsContent value="reportes">
          <div style={{ marginBottom: '1rem' }}>
            <Label>Seleccionar mes</Label>
            <Input
              type="month"
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              style={{ maxWidth: '200px' }}
            />
          </div>

          {reporteMensual && (
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Resumen */}
              <div style={{ 
                background: '#F8FAFC', 
                padding: '1.5rem', 
                borderRadius: '12px' 
              }}>
                <h3 style={{ marginBottom: '1rem', color: '#0C4A6E' }}>
                  Resumen {filtroMes}
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '1rem' 
                }}>
                  <div>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Total Consultas</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{reporteMensual.total_consultas}</p>
                  </div>
                  <div>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Facturado</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3B82F6' }}>
                      {formatCurrency(reporteMensual.total_facturado)}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Cobrado</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669' }}>
                      {formatCurrency(reporteMensual.total_cobrado)}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Pendiente</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#DC2626' }}>
                      {formatCurrency(reporteMensual.total_pendiente)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Por tipo de pago */}
              <div style={{ 
                background: '#F8FAFC', 
                padding: '1.5rem', 
                borderRadius: '12px' 
              }}>
                <h3 style={{ marginBottom: '1rem', color: '#0C4A6E' }}>Por Tipo de Pago</h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                  gap: '1rem' 
                }}>
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '8px' }}>
                    <p style={{ color: '#6B7280', fontSize: '0.75rem' }}>Efectivo</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCurrency(reporteMensual.efectivo)}</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '8px' }}>
                    <p style={{ color: '#6B7280', fontSize: '0.75rem' }}>Transferencia</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCurrency(reporteMensual.transferencia)}</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '8px' }}>
                    <p style={{ color: '#6B7280', fontSize: '0.75rem' }}>Tarjeta</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCurrency(reporteMensual.tarjeta)}</p>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '8px' }}>
                    <p style={{ color: '#6B7280', fontSize: '0.75rem' }}>Otros</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatCurrency(reporteMensual.otros)}</p>
                  </div>
                </div>
              </div>

              {/* Por Doctor */}
              {reporteMensual.por_doctor?.length > 0 && (
                <div style={{ 
                  background: '#F8FAFC', 
                  padding: '1.5rem', 
                  borderRadius: '12px' 
                }}>
                  <h3 style={{ marginBottom: '1rem', color: '#0C4A6E' }}>Por Doctor</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Consultas</th>
                        <th>Facturado</th>
                        <th>Cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporteMensual.por_doctor.map((item, idx) => (
                        <tr key={idx}>
                          <td><strong>{item.doctor}</strong></td>
                          <td>{item.consultas}</td>
                          <td>{formatCurrency(item.facturado)}</td>
                          <td style={{ color: '#059669' }}>{formatCurrency(item.cobrado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Por Especialidad */}
              {reporteMensual.por_especialidad?.length > 0 && (
                <div style={{ 
                  background: '#F8FAFC', 
                  padding: '1.5rem', 
                  borderRadius: '12px' 
                }}>
                  <h3 style={{ marginBottom: '1rem', color: '#0C4A6E' }}>Por Especialidad</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Especialidad</th>
                        <th>Consultas</th>
                        <th>Facturado</th>
                        <th>Cobrado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporteMensual.por_especialidad.map((item, idx) => (
                        <tr key={idx}>
                          <td><span className="badge">{item.especialidad}</span></td>
                          <td>{item.consultas}</td>
                          <td>{formatCurrency(item.facturado)}</td>
                          <td style={{ color: '#059669' }}>{formatCurrency(item.cobrado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab Catálogo */}
        <TabsContent value="catalogo">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Servicio</th>
                  <th>Especialidad</th>
                  <th>Precio Base</th>
                </tr>
              </thead>
              <tbody>
                {catalogo.map((srv) => (
                  <tr key={srv.id}>
                    <td><code>{srv.codigo}</code></td>
                    <td><strong>{srv.nombre}</strong></td>
                    <td><span className="badge">{srv.especialidad}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(srv.precio_base)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {catalogo.length === 0 && (
              <div className="empty-state">
                <DollarSign className="empty-icon" />
                <p>No hay servicios en el catálogo</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Registrar Pago */}
      <Dialog open={pagoDialog} onOpenChange={setPagoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          {selectedConsulta && (
            <div>
              <div style={{ 
                background: '#F8FAFC', 
                padding: '1rem', 
                borderRadius: '8px', 
                marginBottom: '1rem' 
              }}>
                <p><strong>Paciente:</strong> {selectedConsulta.paciente_nombre}</p>
                <p><strong>Total:</strong> {formatCurrency(selectedConsulta.total)}</p>
                <p><strong>Saldo pendiente:</strong> <span style={{ color: '#DC2626', fontWeight: 600 }}>{formatCurrency(selectedConsulta.saldo)}</span></p>
              </div>
              
              <div className="form-grid">
                <div className="form-field">
                  <Label>Monto a pagar *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pagoForm.monto}
                    onChange={(e) => setPagoForm({...pagoForm, monto: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-field">
                  <Label>Tipo de pago</Label>
                  <Select 
                    value={pagoForm.tipo_pago} 
                    onValueChange={(val) => setPagoForm({...pagoForm, tipo_pago: val})}
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
                  <Label>Referencia (opcional)</Label>
                  <Input
                    value={pagoForm.referencia}
                    onChange={(e) => setPagoForm({...pagoForm, referencia: e.target.value})}
                    placeholder="Número de transferencia, voucher, etc."
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoDialog(false)}>Cancelar</Button>
            <Button onClick={handleRegistrarPago} disabled={loading}>
              {loading ? "Procesando..." : "Registrar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Agregar Servicio */}
      <Dialog open={servicioDialog} onOpenChange={setServicioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Servicio</DialogTitle>
          </DialogHeader>
          <div className="form-grid">
            <div className="form-field full-width">
              <Label>Servicio *</Label>
              <Select 
                value={servicioForm.servicio} 
                onValueChange={(val) => {
                  const srv = catalogo.find(s => s.nombre === val);
                  setServicioForm({
                    ...servicioForm, 
                    servicio: val,
                    precio_unitario: srv?.precio_base?.toString() || ""
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un servicio" />
                </SelectTrigger>
                <SelectContent style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {catalogo.map((srv) => (
                    <SelectItem key={srv.id} value={srv.nombre}>
                      {srv.nombre} - {formatCurrency(srv.precio_base)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="form-field">
              <Label>Precio Unitario *</Label>
              <Input
                type="number"
                step="0.01"
                value={servicioForm.precio_unitario}
                onChange={(e) => setServicioForm({...servicioForm, precio_unitario: e.target.value})}
              />
            </div>
            <div className="form-field">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={servicioForm.cantidad}
                onChange={(e) => setServicioForm({...servicioForm, cantidad: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServicioDialog(false)}>Cancelar</Button>
            <Button onClick={handleAgregarServicio} disabled={loading}>
              {loading ? "Agregando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalle Consulta */}
      <Dialog open={detalleDialog} onOpenChange={setDetalleDialog}>
        <DialogContent className="dialog-wide">
          <DialogHeader>
            <DialogTitle>Detalle de Consulta</DialogTitle>
          </DialogHeader>
          {selectedConsulta && (
            <div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Paciente</p>
                  <p style={{ fontWeight: 600 }}>{selectedConsulta.paciente_nombre}</p>
                </div>
                <div>
                  <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Cédula</p>
                  <p style={{ fontWeight: 600 }}>{selectedConsulta.paciente_cedula}</p>
                </div>
                <div>
                  <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Especialidad</p>
                  <p><span className="badge">{selectedConsulta.especialidad}</span></p>
                </div>
                <div>
                  <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>Fecha</p>
                  <p style={{ fontWeight: 600 }}>{selectedConsulta.fecha}</p>
                </div>
              </div>

              {/* Servicios */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem', color: '#0C4A6E' }}>Servicios</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Servicio</th>
                      <th>Precio</th>
                      <th>Cant.</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedConsulta.servicios?.map((srv, idx) => (
                      <tr key={idx}>
                        <td>{srv.servicio}</td>
                        <td>{formatCurrency(srv.precio_unitario)}</td>
                        <td>{srv.cantidad}</td>
                        <td><strong>{formatCurrency(srv.subtotal)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600 }}>Total:</td>
                      <td><strong>{formatCurrency(selectedConsulta.total)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagos */}
              <div>
                <h4 style={{ marginBottom: '0.5rem', color: '#0C4A6E' }}>Pagos Registrados</h4>
                {selectedConsulta.pagos?.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Referencia</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedConsulta.pagos?.map((pago, idx) => (
                        <tr key={idx}>
                          <td>{pago.fecha}</td>
                          <td style={{ textTransform: 'capitalize' }}>{pago.tipo_pago}</td>
                          <td>{pago.referencia || '-'}</td>
                          <td style={{ color: '#059669', fontWeight: 600 }}>{formatCurrency(pago.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'right', fontWeight: 600 }}>Saldo:</td>
                        <td style={{ color: selectedConsulta.saldo > 0 ? '#DC2626' : '#059669', fontWeight: 600 }}>
                          {formatCurrency(selectedConsulta.saldo)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <p style={{ color: '#6B7280', fontStyle: 'italic' }}>No hay pagos registrados</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
