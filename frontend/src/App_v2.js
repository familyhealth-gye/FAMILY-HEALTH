import { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Phone, Edit, Trash2, UserPlus, Stethoscope, Users, FileText, Package, DollarSign, Download, AlertTriangle, MessageCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [inventoryMovements, setInventoryMovements] = useState([]);
  const [inventoryAlerts, setInventoryAlerts] = useState([]);
  const [doctorPayments, setDoctorPayments] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [monthlyTotals, setMonthlyTotals] = useState({});
  
  // Doctor form
  const [doctorDialog, setDoctorDialog] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState({ nombre: "", especialidad: "", porcentaje: 50 });
  
  // Appointment form
  const [appointmentDialog, setAppointmentDialog] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [appointmentForm, setAppointmentForm] = useState({
    nombre_completo: "",
    cedula: "",
    edad: "",
    telefono: "",
    especialidad: "",
    doctor_id: "",
    fecha: null,
    hora: "",
    tipo_pago: "",
    observaciones: ""
  });
  const [showWhatsAppMessage, setShowWhatsAppMessage] = useState(false);
  const [whatsappData, setWhatsappData] = useState(null);
  
  // Invoice form
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({
    numero_factura: "",
    paciente_nombre: "",
    paciente_cedula: "",
    doctor_id: "",
    especialidad: "",
    servicio: "",
    valor: "",
    fecha: null,
    tipo_pago: ""
  });
  
  // Inventory form
  const [inventoryDialog, setInventoryDialog] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState(null);
  const [inventoryForm, setInventoryForm] = useState({
    nombre: "",
    categoria: "",
    cantidad: "",
    costo_unitario: "",
    stock_minimo: ""
  });
  
  // Movement form
  const [movementDialog, setMovementDialog] = useState(false);
  const [movementForm, setMovementForm] = useState({
    item_id: "",
    tipo: "salida",
    cantidad: "",
    motivo: "",
    fecha: null
  });
  
  // Payment calculation
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    doctor_id: "",
    mes: new Date().getMonth() + 1,
    año: new Date().getFullYear()
  });
  
  // Search
  const [searchDoctor, setSearchDoctor] = useState("");
  const [searchAppointment, setSearchAppointment] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [searchInventory, setSearchInventory] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [doctorsRes, appointmentsRes, specialtiesRes, categoriesRes, invoicesRes, inventoryRes, alertsRes, paymentsRes, movementsRes, totalsRes] = await Promise.all([
        axios.get(`${API}/doctors`),
        axios.get(`${API}/appointments`),
        axios.get(`${API}/specialties`),
        axios.get(`${API}/categories`),
        axios.get(`${API}/invoices`),
        axios.get(`${API}/inventory`),
        axios.get(`${API}/inventory/alerts`),
        axios.get(`${API}/doctor-payments`),
        axios.get(`${API}/inventory/movements`),
        axios.get(`${API}/invoices/monthly-totals`)
      ]);
      setDoctors(doctorsRes.data);
      setAppointments(appointmentsRes.data);
      setSpecialties(specialtiesRes.data.specialties);
      setCategories(categoriesRes.data.categories);
      setInvoices(invoicesRes.data);
      setInventory(inventoryRes.data);
      setInventoryAlerts(alertsRes.data.alerts);
      setDoctorPayments(paymentsRes.data);
      setInventoryMovements(movementsRes.data);
      setMonthlyTotals(totalsRes.data.monthly_totals);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar los datos");
    }
  };

  // Doctor handlers
  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingDoctor) {
        await axios.put(`${API}/doctors/${editingDoctor.id}`, doctorForm);
        toast.success("Doctor actualizado exitosamente");
      } else {
        await axios.post(`${API}/doctors`, doctorForm);
        toast.success("Doctor registrado exitosamente");
      }
      setDoctorDialog(false);
      resetDoctorForm();
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al guardar el doctor");
    }
    setLoading(false);
  };

  const handleEditDoctor = (doctor) => {
    setEditingDoctor(doctor);
    setDoctorForm({ nombre: doctor.nombre, especialidad: doctor.especialidad, porcentaje: doctor.porcentaje || 50 });
    setDoctorDialog(true);
  };

  const handleDeleteDoctor = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este doctor?")) return;
    try {
      await axios.delete(`${API}/doctors/${id}`);
      toast.success("Doctor eliminado exitosamente");
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar el doctor");
    }
  };

  const resetDoctorForm = () => {
    setDoctorForm({ nombre: "", especialidad: "", porcentaje: 50 });
    setEditingDoctor(null);
  };

  // Appointment handlers
  const handleAppointmentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...appointmentForm,
        edad: parseInt(appointmentForm.edad),
        fecha: appointmentForm.fecha ? format(appointmentForm.fecha, "yyyy-MM-dd") : ""
      };
      
      if (editingAppointment) {
        await axios.put(`${API}/appointments/${editingAppointment.id}`, data);
        toast.success("Cita actualizada exitosamente");
      } else {
        await axios.post(`${API}/appointments`, data);
        toast.success("Cita agendada exitosamente");
        
        // Show WhatsApp message
        const appointmentData = {
          nombre: appointmentForm.nombre_completo,
          fecha: format(appointmentForm.fecha, "PPP", { locale: es }),
          hora: appointmentForm.hora,
          telefono: appointmentForm.telefono
        };
        setWhatsappData(appointmentData);
        setShowWhatsAppMessage(true);
      }
      setAppointmentDialog(false);
      resetAppointmentForm();
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al guardar la cita");
    }
    setLoading(false);
  };

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment);
    setAppointmentForm({
      nombre_completo: appointment.nombre_completo,
      cedula: appointment.cedula,
      edad: appointment.edad.toString(),
      telefono: appointment.telefono,
      especialidad: appointment.especialidad,
      doctor_id: appointment.doctor_id,
      fecha: appointment.fecha ? new Date(appointment.fecha) : null,
      hora: appointment.hora,
      tipo_pago: appointment.tipo_pago,
      observaciones: appointment.observaciones
    });
    setAppointmentDialog(true);
  };

  const handleDeleteAppointment = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar esta cita?")) return;
    try {
      await axios.delete(`${API}/appointments/${id}`);
      toast.success("Cita eliminada exitosamente");
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar la cita");
    }
  };

  const resetAppointmentForm = () => {
    setAppointmentForm({
      nombre_completo: "",
      cedula: "",
      edad: "",
      telefono: "",
      especialidad: "",
      doctor_id: "",
      fecha: null,
      hora: "",
      tipo_pago: "",
      observaciones: ""
    });
    setEditingAppointment(null);
  };

  const openWhatsApp = (telefono, message = null) => {
    const phone = telefono.replace(/[^0-9]/g, "");
    const encodedMessage = message ? encodeURIComponent(message) : "";
    const url = `https://wa.me/593${phone}${message ? `?text=${encodedMessage}` : ""}`;
    window.open(url, "_blank");
  };

  const sendWhatsAppConfirmation = () => {
    if (whatsappData) {
      const message = `Hola ${whatsappData.nombre}, tu cita en Family Health ha sido agendada para el ${whatsappData.fecha} a las ${whatsappData.hora}.`;
      openWhatsApp(whatsappData.telefono, message);
      setShowWhatsAppMessage(false);
    }
  };

  // Invoice handlers
  const handleInvoiceSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...invoiceForm,
        valor: parseFloat(invoiceForm.valor),
        fecha: invoiceForm.fecha ? format(invoiceForm.fecha, "yyyy-MM-dd") : ""
      };
      
      if (editingInvoice) {
        await axios.put(`${API}/invoices/${editingInvoice.id}`, data);
        toast.success("Factura actualizada exitosamente");
      } else {
        await axios.post(`${API}/invoices`, data);
        toast.success("Factura registrada exitosamente");
      }
      setInvoiceDialog(false);
      resetInvoiceForm();
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al guardar la factura");
    }
    setLoading(false);
  };

  const handleEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setInvoiceForm({
      numero_factura: invoice.numero_factura,
      paciente_nombre: invoice.paciente_nombre,
      paciente_cedula: invoice.paciente_cedula,
      doctor_id: invoice.doctor_id,
      especialidad: invoice.especialidad,
      servicio: invoice.servicio,
      valor: invoice.valor.toString(),
      fecha: invoice.fecha ? new Date(invoice.fecha) : null,
      tipo_pago: invoice.tipo_pago
    });
    setInvoiceDialog(true);
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar esta factura?")) return;
    try {
      await axios.delete(`${API}/invoices/${id}`);
      toast.success("Factura eliminada exitosamente");
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar la factura");
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceForm({
      numero_factura: "",
      paciente_nombre: "",
      paciente_cedula: "",
      doctor_id: "",
      especialidad: "",
      servicio: "",
      valor: "",
      fecha: null,
      tipo_pago: ""
    });
    setEditingInvoice(null);
  };

  const handleExportInvoices = async () => {
    try {
      const response = await axios.get(`${API}/invoices/export`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'facturas_family_health.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Facturas exportadas exitosamente");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al exportar facturas");
    }
  };

  // Inventory handlers
  const handleInventorySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...inventoryForm,
        cantidad: parseInt(inventoryForm.cantidad),
        costo_unitario: parseFloat(inventoryForm.costo_unitario),
        stock_minimo: parseInt(inventoryForm.stock_minimo)
      };
      
      if (editingInventoryItem) {
        await axios.put(`${API}/inventory/${editingInventoryItem.id}`, data);
        toast.success("Item actualizado exitosamente");
      } else {
        await axios.post(`${API}/inventory`, data);
        toast.success("Item registrado exitosamente");
      }
      setInventoryDialog(false);
      resetInventoryForm();
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al guardar el item");
    }
    setLoading(false);
  };

  const handleEditInventoryItem = (item) => {
    setEditingInventoryItem(item);
    setInventoryForm({
      nombre: item.nombre,
      categoria: item.categoria,
      cantidad: item.cantidad.toString(),
      costo_unitario: item.costo_unitario.toString(),
      stock_minimo: item.stock_minimo.toString()
    });
    setInventoryDialog(true);
  };

  const handleDeleteInventoryItem = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este item?")) return;
    try {
      await axios.delete(`${API}/inventory/${id}`);
      toast.success("Item eliminado exitosamente");
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al eliminar el item");
    }
  };

  const resetInventoryForm = () => {
    setInventoryForm({
      nombre: "",
      categoria: "",
      cantidad: "",
      costo_unitario: "",
      stock_minimo: ""
    });
    setEditingInventoryItem(null);
  };

  // Movement handlers
  const handleMovementSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...movementForm,
        cantidad: parseInt(movementForm.cantidad),
        fecha: movementForm.fecha ? format(movementForm.fecha, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
      };
      
      await axios.post(`${API}/inventory/movements`, data);
      toast.success("Movimiento registrado exitosamente");
      setMovementDialog(false);
      resetMovementForm();
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error(error.response?.data?.detail || "Error al registrar movimiento");
    }
    setLoading(false);
  };

  const resetMovementForm = () => {
    setMovementForm({
      item_id: "",
      tipo: "salida",
      cantidad: "",
      motivo: "",
      fecha: null
    });
  };

  // Payment handlers
  const handleCalculatePayment = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/doctor-payments/calculate`, {
        doctor_id: paymentForm.doctor_id,
        mes: paymentForm.mes,
        año: paymentForm.año,
        estado: "Pendiente"
      });
      toast.success("Pago calculado exitosamente");
      setPaymentDialog(false);
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al calcular el pago");
    }
    setLoading(false);
  };

  const handleUpdatePaymentStatus = async (paymentId, newStatus) => {
    try {
      await axios.put(`${API}/doctor-payments/${paymentId}`, { estado: newStatus });
      toast.success("Estado actualizado exitosamente");
      fetchData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al actualizar el estado");
    }
  };

  // Filters
  const filteredDoctors = doctors.filter(d => 
    d.nombre.toLowerCase().includes(searchDoctor.toLowerCase()) ||
    d.especialidad.toLowerCase().includes(searchDoctor.toLowerCase())
  );

  const filteredAppointments = appointments.filter(a => 
    a.nombre_completo.toLowerCase().includes(searchAppointment.toLowerCase()) ||
    a.cedula.includes(searchAppointment) ||
    a.doctor_nombre.toLowerCase().includes(searchAppointment.toLowerCase())
  );

  const filteredInvoices = invoices.filter(i =>
    i.paciente_nombre.toLowerCase().includes(searchInvoice.toLowerCase()) ||
    i.numero_factura.includes(searchInvoice) ||
    i.doctor_nombre.toLowerCase().includes(searchInvoice.toLowerCase())
  );

  const filteredInventory = inventory.filter(i =>
    i.nombre.toLowerCase().includes(searchInventory.toLowerCase()) ||
    i.categoria.toLowerCase().includes(searchInventory.toLowerCase())
  );

  return (
    <div className="App">
      {/* Header */}
      <header className="medical-header">
        <div className="header-content">
          <div className="logo-section">
            <Stethoscope className="logo-icon" />
            <div>
              <h1 data-testid="app-title" className="clinic-name">Family Health</h1>
              <p className="clinic-location">Mucho Lote 2, Guayaquil</p>
            </div>
          </div>
        </div>
      </header>

      {/* WhatsApp Confirmation Dialog */}
      <Dialog open={showWhatsAppMessage} onOpenChange={setShowWhatsAppMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cita Agendada - Enviar Confirmación</DialogTitle>
          </DialogHeader>
          <div className="whatsapp-confirmation">
            <MessageCircle className="whatsapp-large-icon" />
            <p>¿Deseas enviar mensaje de confirmación por WhatsApp?</p>
            {whatsappData && (
              <div className="whatsapp-message-preview">
                <p><strong>Para:</strong> {whatsappData.nombre} ({whatsappData.telefono})</p>
                <p className="message-text">
                  "Hola {whatsappData.nombre}, tu cita en Family Health ha sido agendada para el {whatsappData.fecha} a las {whatsappData.hora}."
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWhatsAppMessage(false)}>
              Cancelar
            </Button>
            <Button onClick={sendWhatsAppConfirmation} className="whatsapp-send-button">
              <MessageCircle className="button-icon" />
              Enviar por WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory Alerts */}
      {inventoryAlerts.length > 0 && (
        <div className="alerts-container">
          <Alert variant="destructive" className="inventory-alert">
            <AlertTriangle className="alert-icon" />
            <AlertDescription>
              <strong>Alerta de Inventario:</strong> {inventoryAlerts.length} {inventoryAlerts.length === 1 ? 'item tiene' : 'items tienen'} stock bajo.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content - First part, will continue in next message */}
      <main className="main-container">
        <Tabs defaultValue="appointments" className="tabs-container">
          <TabsList className="tabs-list-extended">
            <TabsTrigger value="appointments" data-testid="appointments-tab">
              <Users className="tab-icon" />
              Citas
            </TabsTrigger>
            <TabsTrigger value="doctors" data-testid="doctors-tab">
              <Stethoscope className="tab-icon" />
              Doctores
            </TabsTrigger>
            <TabsTrigger value="invoices" data-testid="invoices-tab">
              <FileText className="tab-icon" />
              Facturas
            </TabsTrigger>
            <TabsTrigger value="inventory" data-testid="inventory-tab">
              <Package className="tab-icon" />
              Inventario
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="payments-tab">
              <DollarSign className="tab-icon" />
              Pagos
            </TabsTrigger>
          </TabsList>
