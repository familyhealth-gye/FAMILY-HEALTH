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
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Phone, Edit, Trash2, UserPlus, Stethoscope, Users, FileText, Package, DollarSign, Download, AlertTriangle, MessageCircle, ClipboardList, LogOut, UserCog, Receipt, CreditCard, Activity, ListChecks } from "lucide-react";
import { InvoicesTab } from "@/components/InvoicesTab";
import { InventoryTab } from "@/components/InventoryTab";
import { PaymentsTab } from "@/components/PaymentsTab";
import { UsersTab } from "@/components/UsersTab";
import { AppointmentsWithAttention } from "@/components/AppointmentsWithAttention";
import { ProformasTab } from "@/components/ProformasTab";
import { AbonosTab } from "@/components/AbonosTab";
import { PacientesTab } from "@/components/PacientesTab";
import { CatalogoServiciosTab } from "@/components/CatalogoServiciosTab";
import { Login } from "@/pages/Login";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [doctorPayments, setDoctorPayments] = useState([]);
  const [medicalHistories, setMedicalHistories] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
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
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    nombre_completo: "",
    cedula: "",
    fecha_nacimiento: "",
    edad: "",
    telefono: "",
    especialidad: "",
    doctor_id: "",
    fecha: null,
    hora: "",
    tipo_pago: "",
    observaciones: ""
  });
  
  // Search
  const [searchDoctor, setSearchDoctor] = useState("");
  const [searchAppointment, setSearchAppointment] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [searchInventory, setSearchInventory] = useState("");

  useEffect(() => {
    // Check if user is logged in
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    
    try {
      const promises = [
        axios.get(`${API}/doctors`, { headers }),
        axios.get(`${API}/appointments`, { headers }),
        axios.get(`${API}/specialties`, { headers }),
        axios.get(`${API}/categories`, { headers }),
        axios.get(`${API}/invoices`, { headers }),
        axios.get(`${API}/inventory`, { headers }),
        axios.get(`${API}/doctor-payments`, { headers }),
        axios.get(`${API}/invoices/monthly-totals`, { headers }),
        axios.get(`${API}/medical-history`, { headers }),
        axios.get(`${API}/prescriptions`, { headers })
      ];

      // Only fetch users if admin
      if (user && user.role === "Administrador") {
        promises.push(axios.get(`${API}/users`, { headers }));
      }

      const results = await Promise.all(promises);
      
      setDoctors(results[0].data);
      setAppointments(results[1].data);
      setSpecialties(results[2].data.specialties);
      setCategories(results[3].data.categories);
      setInvoices(results[4].data);
      setInventory(results[5].data);
      setDoctorPayments(results[6].data);
      setMonthlyTotals(results[7].data.monthly_totals);
      setMedicalHistories(results[8].data);
      setPrescriptions(results[9].data);
      
      if (results[10]) {
        setUsers(results[10].data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 401) {
        handleLogout();
      } else {
        toast.error("Error al cargar los datos");
      }
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setToken(localStorage.getItem("token"));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setToken(null);
    toast.info("Sesión cerrada");
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

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

  // Buscar paciente por cédula y autocompletar datos
  const handleCedulaChange = async (cedula) => {
    // Actualizar cédula
    setAppointmentForm({...appointmentForm, cedula});

    // Si la cédula tiene al menos 10 dígitos, buscar paciente
    if (cedula.length >= 10) {
      setSearchingPatient(true);
      try {
        // Buscar en todas las citas anteriores
        const response = await axios.get(`${API}/appointments`);
        const allAppointments = response.data;
        
        // Encontrar la última cita de este paciente
        const patientAppointment = allAppointments
          .filter(apt => apt.cedula === cedula)
          .sort((a, b) => new Date(b.created_at || b.fecha) - new Date(a.created_at || a.fecha))[0];
        
        if (patientAppointment) {
          // Autocompletar datos del paciente
          setAppointmentForm({
            ...appointmentForm,
            cedula,
            nombre_completo: patientAppointment.nombre_completo,
            edad: patientAppointment.edad.toString(),
            telefono: patientAppointment.telefono,
            // No autocompletar especialidad ni doctor (puede querer otra especialidad)
          });
          toast.success(`✓ Paciente: ${patientAppointment.nombre_completo}`, {
            duration: 2000
          });
        }
      } catch (error) {
        console.error("Error buscando paciente:", error);
      }
      setSearchingPatient(false);
    }
  };

  const openWhatsApp = (telefono) => {
    const phone = telefono.replace(/[^0-9]/g, "");
    const url = `https://wa.me/593${phone}`;
    window.open(url, "_blank");
  };

  const filteredDoctors = doctors.filter(d => 
    d.nombre.toLowerCase().includes(searchDoctor.toLowerCase()) ||
    d.especialidad.toLowerCase().includes(searchDoctor.toLowerCase())
  );

  const filteredAppointments = appointments.filter(a => 
    a.nombre_completo.toLowerCase().includes(searchAppointment.toLowerCase()) ||
    a.cedula.includes(searchAppointment) ||
    a.doctor_nombre.toLowerCase().includes(searchAppointment.toLowerCase())
  );

  return (
    <div className="App">
      {/* Header */}
      <header className="medical-header">
        <div className="header-content">
          <div className="logo-section">
            <img src="/logo.png" alt="Family Health" className="logo-image" />
            <div>
              <h1 data-testid="app-title" className="clinic-name">Family Health</h1>
              <p className="clinic-location">Toledo Externo, Mz 2833 V15 - Guayaquil</p>
            </div>
          </div>
          <div className="user-section">
            <span className="user-name">{user.nombre_completo}</span>
            <span className="user-role">{user.role}</span>
            <Button variant="ghost" onClick={handleLogout} className="logout-button">
              <LogOut className="button-icon" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-container">
        <Tabs defaultValue="appointments" className="tabs-container">
          <TabsList className="tabs-list tabs-list-extended">
            <TabsTrigger value="appointments" data-testid="appointments-tab">
              <Users className="tab-icon" />
              Citas
            </TabsTrigger>
            {user.role === "Administrador" && (
              <TabsTrigger value="doctors" data-testid="doctors-tab">
                <Stethoscope className="tab-icon" />
                Doctores
              </TabsTrigger>
            )}
            {/* Tab Pacientes solo para Doctores */}
            {user.role === "Doctor" && (
              <TabsTrigger value="pacientes" data-testid="pacientes-tab">
                <Users className="tab-icon" />
                Pacientes
              </TabsTrigger>
            )}
            {/* Tab Historias para Admin y Recepción */}
            {(user.role === "Administrador" || user.role === "Recepcion") && (
              <TabsTrigger value="history" data-testid="history-tab">
                <ClipboardList className="tab-icon" />
                Historias
              </TabsTrigger>
            )}
            <TabsTrigger value="prescriptions" data-testid="prescriptions-tab">
              <FileText className="tab-icon" />
              Recetas
            </TabsTrigger>
            {(user.role === "Administrador" || user.role === "Recepcion") && (
              <TabsTrigger value="invoices" data-testid="invoices-tab">
                <FileText className="tab-icon" />
                Facturas
              </TabsTrigger>
            )}
            {user.role === "Administrador" && (
              <>
                <TabsTrigger value="inventory" data-testid="inventory-tab">
                  <Package className="tab-icon" />
                  Inventario
                </TabsTrigger>
                <TabsTrigger value="payments" data-testid="payments-tab">
                  <DollarSign className="tab-icon" />
                  Pagos
                </TabsTrigger>
                <TabsTrigger value="users" data-testid="users-tab">
                  <UserCog className="tab-icon" />
                  Usuarios
                </TabsTrigger>
              </>
            )}
            {(user.role === "Administrador" || user.role === "Recepcion") && (
              <>
                <TabsTrigger value="proformas" data-testid="proformas-tab">
                  <Receipt className="tab-icon" />
                  Proformas
                </TabsTrigger>
                <TabsTrigger value="abonos" data-testid="abonos-tab">
                  <CreditCard className="tab-icon" />
                  Abonos
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Doctors Tab - Admin Only - Simplificado: Listado + Editar Porcentaje */}
          {user.role === "Administrador" && (
            <TabsContent value="doctors" className="tab-content">
              <div className="section-header">
                <div>
                  <h2 className="section-title">Gestión de Doctores</h2>
                  <p className="section-subtitle">Listado y porcentajes de comisión</p>
                </div>
              </div>

            <div className="search-box">
              <Input
                data-testid="search-doctor-input"
                placeholder="Buscar doctor por nombre o especialidad..."
                value={searchDoctor}
                onChange={(e) => setSearchDoctor(e.target.value)}
              />
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Especialidad</th>
                    <th>% Comisión</th>
                    <th className="actions-column">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map((doctor) => (
                    <tr key={doctor.id} data-testid={`doctor-row-${doctor.id}`}>
                      <td>{doctor.nombre}</td>
                      <td><span className="badge">{doctor.especialidad}</span></td>
                      <td>
                        <span className="badge" style={{background: '#DBEAFE', color: '#1E40AF'}}>
                          {doctor.porcentaje || 50}%
                        </span>
                      </td>
                      <td className="actions-cell">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditDoctor(doctor)}
                              data-testid={`edit-doctor-${doctor.id}`}
                            >
                              <Edit className="action-icon" />
                            </Button>
                          </DialogTrigger>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredDoctors.length === 0 && (
                <div className="empty-state">
                  <Stethoscope className="empty-icon" />
                  <p>No hay doctores registrados</p>
                </div>
              )}
            </div>
            
            {/* Dialog para editar porcentaje */}
            <Dialog open={doctorDialog} onOpenChange={(open) => { setDoctorDialog(open); if (!open) resetDoctorForm(); }}>
              <DialogContent className="dialog-content">
                <DialogHeader>
                  <DialogTitle>Editar Porcentaje de Comisión</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleDoctorSubmit}>
                  <div className="form-grid">
                    <div className="form-field full-width">
                      <Label>Doctor: {editingDoctor?.nombre}</Label>
                      <p style={{color: '#6B7280', fontSize: '0.875rem'}}>{editingDoctor?.especialidad}</p>
                    </div>
                    <div className="form-field full-width">
                      <Label>Porcentaje de Comisión (%)</Label>
                      <Input
                        data-testid="doctor-percentage-input"
                        type="number"
                        min="0"
                        max="100"
                        value={doctorForm.porcentaje}
                        onChange={(e) => setDoctorForm({...doctorForm, porcentaje: parseFloat(e.target.value)})}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={loading} data-testid="save-doctor-button">
                      {loading ? "Guardando..." : "Guardar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
          )}

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="tab-content">
            <div className="section-header">
              <div>
                <h2 className="section-title">Gestión de Citas</h2>
                <p className="section-subtitle">Agenda y administra las citas de pacientes</p>
              </div>
              <Dialog open={appointmentDialog} onOpenChange={(open) => { setAppointmentDialog(open); if (!open) resetAppointmentForm(); }}>
                <DialogTrigger asChild>
                  <Button className="add-button" data-testid="add-appointment-button">
                    <UserPlus className="button-icon" />
                    Nueva Cita
                  </Button>
                </DialogTrigger>
                <DialogContent className="dialog-content dialog-wide">
                  <DialogHeader>
                    <DialogTitle>{editingAppointment ? "Editar Cita" : "Agendar Nueva Cita"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAppointmentSubmit}>
                    <div className="form-grid">
                      <div className="form-field">
                        <Label>Nombre Completo</Label>
                        <Input
                          data-testid="appointment-name-input"
                          value={appointmentForm.nombre_completo}
                          onChange={(e) => setAppointmentForm({...appointmentForm, nombre_completo: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-field">
                        <Label>Cédula *</Label>
                        <div style={{ position: 'relative' }}>
                          <Input
                            data-testid="appointment-cedula-input"
                            value={appointmentForm.cedula}
                            onChange={(e) => handleCedulaChange(e.target.value)}
                            placeholder="Ingrese cédula (se autocompletará si existe)"
                            required
                          />
                          {searchingPatient && (
                            <div style={{ 
                              position: 'absolute', 
                              right: '10px', 
                              top: '50%', 
                              transform: 'translateY(-50%)',
                              color: '#00a8cc',
                              fontSize: '0.875rem'
                            }}>
                              Buscando...
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="form-field">
                        <Label>Edad</Label>
                        <Input
                          data-testid="appointment-age-input"
                          type="number"
                          value={appointmentForm.edad}
                          onChange={(e) => setAppointmentForm({...appointmentForm, edad: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-field">
                        <Label>Teléfono</Label>
                        <Input
                          data-testid="appointment-phone-input"
                          value={appointmentForm.telefono}
                          onChange={(e) => setAppointmentForm({...appointmentForm, telefono: e.target.value})}
                          placeholder="0999999999"
                          required
                        />
                      </div>
                      <div className="form-field">
                        <Label>Especialidad</Label>
                        <Select
                          value={appointmentForm.especialidad}
                          onValueChange={(value) => setAppointmentForm({...appointmentForm, especialidad: value})}
                        >
                          <SelectTrigger data-testid="appointment-specialty-select">
                            <SelectValue placeholder="Seleccione especialidad" />
                          </SelectTrigger>
                          <SelectContent>
                            {specialties.map((spec) => (
                              <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-field">
                        <Label>Doctor</Label>
                        <Select
                          value={appointmentForm.doctor_id}
                          onValueChange={(value) => setAppointmentForm({...appointmentForm, doctor_id: value})}
                        >
                          <SelectTrigger data-testid="appointment-doctor-select">
                            <SelectValue placeholder="Seleccione doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            {doctors
                              .filter(d => !appointmentForm.especialidad || d.especialidad === appointmentForm.especialidad)
                              .map((doctor) => (
                                <SelectItem key={doctor.id} value={doctor.id}>
                                  {doctor.nombre} - {doctor.especialidad}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-field">
                        <Label>Fecha</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="date-picker"
                              data-testid="appointment-date-picker"
                            >
                              <CalendarIcon className="calendar-icon" />
                              {appointmentForm.fecha ? format(appointmentForm.fecha, "PPP", { locale: es }) : "Seleccionar fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent>
                            <Calendar
                              mode="single"
                              selected={appointmentForm.fecha}
                              onSelect={(date) => setAppointmentForm({...appointmentForm, fecha: date})}
                              locale={es}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="form-field">
                        <Label>Hora</Label>
                        <Input
                          data-testid="appointment-time-input"
                          type="time"
                          value={appointmentForm.hora}
                          onChange={(e) => setAppointmentForm({...appointmentForm, hora: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-field">
                        <Label>Tipo de Pago</Label>
                        <Select
                          value={appointmentForm.tipo_pago}
                          onValueChange={(value) => setAppointmentForm({...appointmentForm, tipo_pago: value})}
                        >
                          <SelectTrigger data-testid="appointment-payment-select">
                            <SelectValue placeholder="Seleccione tipo de pago" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Efectivo">Efectivo</SelectItem>
                            <SelectItem value="Transferencia">Transferencia</SelectItem>
                            <SelectItem value="Seguro">Seguro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="form-field full-width">
                        <Label>Observaciones</Label>
                        <Textarea
                          data-testid="appointment-observations-input"
                          value={appointmentForm.observaciones}
                          onChange={(e) => setAppointmentForm({...appointmentForm, observaciones: e.target.value})}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading} data-testid="save-appointment-button">
                        {loading ? "Guardando..." : "Guardar Cita"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="search-box">
              <Input
                data-testid="search-appointment-input"
                placeholder="Buscar por nombre, cédula o doctor..."
                value={searchAppointment}
                onChange={(e) => setSearchAppointment(e.target.value)}
              />
            </div>

            <div className="table-container">
              <AppointmentsWithAttention
                filteredAppointments={filteredAppointments}
                user={user}
                token={token}
                handleEditAppointment={handleEditAppointment}
                handleDeleteAppointment={handleDeleteAppointment}
                openWhatsApp={openWhatsApp}
                fetchData={fetchData}
              />
            </div>
          </TabsContent>

          {/* Pacientes Tab - Solo para Doctores */}
          {user.role === "Doctor" && (
            <TabsContent value="pacientes">
              <PacientesTab user={user} token={token} />
            </TabsContent>
          )}

          {/* Medical History Tab - Solo para Admin y Recepción */}
          {(user.role === "Administrador" || user.role === "Recepcion") && (
          <TabsContent value="history" className="tab-content">
            <div className="section-header">
              <div>
                <h2 className="section-title">Historias Clínicas</h2>
                <p className="section-subtitle">
                  {medicalHistories.length} registros médicos
                </p>
              </div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Paciente</th>
                    <th>Doctor</th>
                    <th>Diagnóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {medicalHistories.map((history) => (
                    <tr key={history.id}>
                      <td>{history.fecha}</td>
                      <td>{history.paciente_nombre}</td>
                      <td>{history.doctor_nombre}</td>
                      <td>{history.diagnostico}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {medicalHistories.length === 0 && (
                <div className="empty-state">
                  <ClipboardList className="empty-icon" />
                  <p>No hay historias clínicas registradas</p>
                </div>
              )}
            </div>
          </TabsContent>
          )}

          {/* Prescriptions Tab */}
          <TabsContent value="prescriptions" className="tab-content">
            <div className="section-header">
              <div>
                <h2 className="section-title">Recetas Médicas</h2>
                <p className="section-subtitle">
                  {(() => {
                    const filtered = user?.role === "Doctor" && user?.doctor_id
                      ? prescriptions.filter(p => p.doctor_id === user.doctor_id)
                      : prescriptions;
                    return `${filtered.length} recetas emitidas`;
                  })()}
                </p>
              </div>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Paciente</th>
                    <th>Doctor</th>
                    <th>Diagnóstico</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = user?.role === "Doctor" && user?.doctor_id
                      ? prescriptions.filter(p => p.doctor_id === user.doctor_id)
                      : prescriptions;
                    return filtered.map((prescription) => (
                      <tr key={prescription.id}>
                        <td>{prescription.fecha}</td>
                        <td>{prescription.paciente_nombre}</td>
                        <td>{prescription.doctor_nombre}</td>
                        <td>{prescription.diagnostico}</td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const response = await axios.get(
                                  `${API}/prescriptions/${prescription.id}/pdf`,
                                  { 
                                    headers: { Authorization: `Bearer ${token}` },
                                    responseType: 'blob' 
                                  }
                                );
                                const url = window.URL.createObjectURL(new Blob([response.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', `receta_${prescription.paciente_cedula}.pdf`);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                toast.success("Receta descargada");
                              } catch (error) {
                                toast.error("Error al descargar receta");
                              }
                            }}
                          >
                          <Download className="button-icon" />
                          PDF
                        </Button>
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
              {(() => {
                const filtered = user?.role === "Doctor" && user?.doctor_id
                  ? prescriptions.filter(p => p.doctor_id === user.doctor_id)
                  : prescriptions;
                return filtered.length === 0 && (
                  <div className="empty-state">
                    <FileText className="empty-icon" />
                    <p>No hay recetas registradas</p>
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <InvoicesTab 
              invoices={invoices} 
              searchInvoice={searchInvoice} 
              setSearchInvoice={setSearchInvoice}
              monthlyTotals={monthlyTotals}
            />
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <InventoryTab 
              inventory={inventory} 
              searchInventory={searchInventory} 
              setSearchInventory={setSearchInventory}
            />
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <PaymentsTab 
              doctorPayments={doctorPayments} 
              fetchData={fetchData}
            />
          </TabsContent>

          {/* Users Tab - Admin Only */}
          {user.role === "Administrador" && (
            <TabsContent value="users">
              <UsersTab 
                users={users}
                fetchData={fetchData}
                token={token}
              />
            </TabsContent>
          )}

          {/* Proformas Tab - Admin & Recepcion */}
          {(user.role === "Administrador" || user.role === "Recepcion") && (
            <TabsContent value="proformas">
              <ProformasTab token={token} />
            </TabsContent>
          )}

          {/* Abonos Tab - Admin & Recepcion */}
          {(user.role === "Administrador" || user.role === "Recepcion") && (
            <TabsContent value="abonos">
              <AbonosTab token={token} />
            </TabsContent>
          )}

        </Tabs>
      </main>
    </div>
  );
}

export default App;