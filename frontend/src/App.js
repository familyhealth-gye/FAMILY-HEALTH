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
import { CalendarIcon, Phone, Edit, Trash2, UserPlus, Stethoscope, Users, FileText, Package, DollarSign, Download, AlertTriangle, MessageCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [inventory, setInventory] = useState([]);
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
      const [doctorsRes, appointmentsRes, specialtiesRes, categoriesRes, invoicesRes, inventoryRes, paymentsRes, totalsRes] = await Promise.all([
        axios.get(`${API}/doctors`),
        axios.get(`${API}/appointments`),
        axios.get(`${API}/specialties`),
        axios.get(`${API}/categories`),
        axios.get(`${API}/invoices`),
        axios.get(`${API}/inventory`),
        axios.get(`${API}/doctor-payments`),
        axios.get(`${API}/invoices/monthly-totals`)
      ]);
      setDoctors(doctorsRes.data);
      setAppointments(appointmentsRes.data);
      setSpecialties(specialtiesRes.data.specialties);
      setCategories(categoriesRes.data.categories);
      setInvoices(invoicesRes.data);
      setInventory(inventoryRes.data);
      setDoctorPayments(paymentsRes.data);
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
            <Stethoscope className="logo-icon" />
            <div>
              <h1 data-testid="app-title" className="clinic-name">Family Health</h1>
              <p className="clinic-location">Mucho Lote 2, Guayaquil</p>
            </div>
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

          {/* Doctors Tab */}
          <TabsContent value="doctors" className="tab-content">
            <div className="section-header">
              <div>
                <h2 className="section-title">Gestión de Doctores</h2>
                <p className="section-subtitle">Administra el personal médico del centro</p>
              </div>
              <Dialog open={doctorDialog} onOpenChange={(open) => { setDoctorDialog(open); if (!open) resetDoctorForm(); }}>
                <DialogTrigger asChild>
                  <Button className="add-button" data-testid="add-doctor-button">
                    <UserPlus className="button-icon" />
                    Nuevo Doctor
                  </Button>
                </DialogTrigger>
                <DialogContent className="dialog-content">
                  <DialogHeader>
                    <DialogTitle>{editingDoctor ? "Editar Doctor" : "Registrar Nuevo Doctor"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleDoctorSubmit}>
                    <div className="form-grid">
                      <div className="form-field">
                        <Label>Nombre Completo</Label>
                        <Input
                          data-testid="doctor-name-input"
                          value={doctorForm.nombre}
                          onChange={(e) => setDoctorForm({...doctorForm, nombre: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-field">
                        <Label>Especialidad</Label>
                        <Select
                          value={doctorForm.especialidad}
                          onValueChange={(value) => setDoctorForm({...doctorForm, especialidad: value})}
                        >
                          <SelectTrigger data-testid="doctor-specialty-select">
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
                    <th className="actions-column">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map((doctor) => (
                    <tr key={doctor.id} data-testid={`doctor-row-${doctor.id}`}>
                      <td>{doctor.nombre}</td>
                      <td><span className="badge">{doctor.especialidad}</span></td>
                      <td className="actions-cell">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditDoctor(doctor)}
                          data-testid={`edit-doctor-${doctor.id}`}
                        >
                          <Edit className="action-icon" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDoctor(doctor.id)}
                          data-testid={`delete-doctor-${doctor.id}`}
                        >
                          <Trash2 className="action-icon delete-icon" />
                        </Button>
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
          </TabsContent>

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
                        <Label>Cédula</Label>
                        <Input
                          data-testid="appointment-cedula-input"
                          value={appointmentForm.cedula}
                          onChange={(e) => setAppointmentForm({...appointmentForm, cedula: e.target.value})}
                          required
                        />
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
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Cédula</th>
                    <th>Edad</th>
                    <th>Teléfono</th>
                    <th>Especialidad</th>
                    <th>Doctor</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Pago</th>
                    <th className="actions-column">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((appointment) => (
                    <tr key={appointment.id} data-testid={`appointment-row-${appointment.id}`}>
                      <td>{appointment.nombre_completo}</td>
                      <td>{appointment.cedula}</td>
                      <td>{appointment.edad}</td>
                      <td>
                        <div className="phone-cell">
                          {appointment.telefono}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openWhatsApp(appointment.telefono)}
                            className="whatsapp-button"
                            data-testid={`whatsapp-${appointment.id}`}
                          >
                            <Phone className="whatsapp-icon" />
                          </Button>
                        </div>
                      </td>
                      <td><span className="badge">{appointment.especialidad}</span></td>
                      <td>{appointment.doctor_nombre}</td>
                      <td>{appointment.fecha}</td>
                      <td>{appointment.hora}</td>
                      <td><span className="badge-payment">{appointment.tipo_pago}</span></td>
                      <td className="actions-cell">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditAppointment(appointment)}
                          data-testid={`edit-appointment-${appointment.id}`}
                        >
                          <Edit className="action-icon" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAppointment(appointment.id)}
                          data-testid={`delete-appointment-${appointment.id}`}
                        >
                          <Trash2 className="action-icon delete-icon" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAppointments.length === 0 && (
                <div className="empty-state">
                  <Users className="empty-icon" />
                  <p>No hay citas agendadas</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default App;