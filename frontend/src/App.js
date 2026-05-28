import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Stethoscope, Users, Trash2, FileText, Package, DollarSign, ClipboardList, UserCog, Receipt, CreditCard, ListChecks, Smile, UserPlus, Edit } from "lucide-react";

import { InvoicesTab } from "@/components/InvoicesTab";
import { AbonosTab } from "@/components/AbonosTab";
import { InventoryTab } from "@/components/InventoryTab";
import { PaymentsTab } from "@/components/PaymentsTab";
import { UsersTab } from "@/components/UsersTab";
import { AppointmentsWithAttention } from "@/components/AppointmentsWithAttention";
import { ProformasTab } from "@/components/ProformasTab";
import CajaTab from "@/components/CajaTab";
import { PacientesTab } from "@/components/PacientesTab";
import { CatalogoServiciosTab } from "@/components/CatalogoServiciosTab";
import { ConfiguracionIA } from "@/components/ConfiguracionIA";
import { FacturacionTab } from "@/components/FacturacionTab";
import { ConfiguracionSRI } from "@/components/ConfiguracionSRI";
import { ProcedimientoRapidoTab } from "@/components/ProcedimientoRapidoTab";
import { LaboratorioTab } from "@/components/LaboratorioTab";
import { OdontogramaStandalone } from "@/components/OdontogramaStandalone";
import { RecetasTab } from "@/components/RecetasTab";
import { MedicalHistoryTab } from "@/components/MedicalHistoryTab";
import { HistoriaClinicaCompleta } from "@/components/HistoriaClinicaCompleta";
import { Login } from "@/pages/Login";
import { Routes, Route, Navigate } from "react-router-dom";
import DentalWorkspace from "@/workspaces/DentalWorkspace";
import FinancialWorkspace from "@/workspaces/FinancialWorkspace";
import { ENABLE_DENTAL_V2 } from "@/lib/constants";

import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import apiClient from "@/lib/axios";
import { getAllAppData } from "@/services/dataService";
import { normalizeSpecialty } from "@/lib/specialties";

function LegacyApp({ user: propUser, token: propToken }) {
  const { user: authUser, token: authToken, isAuthenticated, login, loading: authLoading } = useAuth();
  const user = propUser || authUser;
  const token = propToken || authToken;

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
  const [hcPaciente, setHcPaciente] = useState(null);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const results = await getAllAppData(user?.role === "Administrador");
      
      setDoctors(results[0].data);
      setAppointments(results[1].data);

      const especialidadesArray = Array.isArray(results[2].data) 
        ? results[2].data.map(e => e.nombre) 
        : [];
      setSpecialties(especialidadesArray);

      setCategories(results[3].data.categories || []);
      setInvoices(results[4].data);
      setInventory(results[5].data);
      setDoctorPayments(results[6].data);
      setMonthlyTotals(results[7].data.monthly_totals || {});
      setMedicalHistories(results[8].data);
      setPrescriptions(results[9].data);
      
      if (user?.role === "Administrador" && results[10]) {
        setUsers(results[10].data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos del sistema");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Doctor state & handlers
  const [doctorDialog, setDoctorDialog] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState({ nombre: "", especialidad: "", porcentaje: 50 });

  const handleSaveDoctor = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingDoctor) {
        await apiClient.put(`/doctors/${editingDoctor.id}`, doctorForm);
        toast.success("Doctor actualizado exitosamente");
      } else {
        await apiClient.post("/doctors", doctorForm);
        toast.success("Doctor registrado exitosamente");
      }
      setDoctorDialog(false);
      setEditingDoctor(null);
      setDoctorForm({ nombre: "", especialidad: "", porcentaje: 50 });
      fetchData();
    } catch (error) {
      toast.error("Error al guardar el doctor");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDoctor = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este doctor?")) return;
    try {
      await apiClient.delete(`/doctors/${id}`);
      toast.success("Doctor eliminado");
      fetchData();
    } catch (error) {
      toast.error("Error al eliminar el doctor");
    }
  };

  if (authLoading) return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  if (!isAuthenticated) return <Login />;

  return (
    <MainLayout>
      <Tabs defaultValue="appointments" className="tabs-container">
        <TabsList className="tabs-list tabs-list-extended">
          <TabsTrigger value="appointments">
            <Users className="tab-icon" />
            Citas
          </TabsTrigger>
          {user?.role === "Administrador" && (
            <TabsTrigger value="doctors">
              <Stethoscope className="tab-icon" />
              Doctores
            </TabsTrigger>
          )}
          {user?.role === "Doctor" && (
            <TabsTrigger value="pacientes">
              <Users className="tab-icon" />
              Pacientes
            </TabsTrigger>
          )}
          {(user?.role === "Administrador" || user?.role === "Recepcion") && (
            <TabsTrigger value="history">
              <ClipboardList className="tab-icon" />
              Historias
            </TabsTrigger>
          )}
          <TabsTrigger value="prescriptions">
            <FileText className="tab-icon" />
            Recetas
          </TabsTrigger>
          {(user?.role === "Administrador" || user?.role === "Recepcion") && (
            <TabsTrigger value="invoices">
              <FileText className="tab-icon" />
              Facturas
            </TabsTrigger>
          )}
          {user?.role === "Administrador" && (
            <>
              <TabsTrigger value="inventory">
                <Package className="tab-icon" />
                Inventario
              </TabsTrigger>
              <TabsTrigger value="payments">
                <DollarSign className="tab-icon" />
                Pagos
              </TabsTrigger>
              <TabsTrigger value="users">
                <UserCog className="tab-icon" />
                Usuarios
              </TabsTrigger>
            </>
          )}
          {(user?.role === "Administrador" || user?.role === "Recepcion") && (
            <>
              <TabsTrigger value="proformas">
                <Receipt className="tab-icon" />
                Proformas
              </TabsTrigger>
              <TabsTrigger value="abonos">
                <CreditCard className="tab-icon" />
                Abonos
              </TabsTrigger>
            </>
          )}
          {(user?.role === "Administrador" || user?.role === "Recepcion") && (
            <TabsTrigger value="caja">
              <DollarSign className="tab-icon" />
              Caja
            </TabsTrigger>
          )}
          {user?.role === "Doctor" &&
            normalizeSpecialty(user?.especialidad) === "Odontología" && (
            <>
              <TabsTrigger value="odontograma-standalone">
                <Smile className="tab-icon" />
                Odontograma
              </TabsTrigger>
            </>
          )}
          {user?.role === "Administrador" && (
            <>
              <TabsTrigger value="catalogo">
                <ListChecks className="tab-icon" />
                Catálogo
              </TabsTrigger>
              <TabsTrigger value="config">
                <UserCog className="tab-icon" />
                Config
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="appointments" className="tab-content">
          <AppointmentsWithAttention
            filteredAppointments={appointments}
            user={user}
            token={token}
            fetchData={fetchData}
            handleEditAppointment={null}
            handleDeleteAppointment={null}
            openWhatsApp={(phone) => { if(phone) window.open('https://wa.me/' + phone.replace(/[^0-9]/g,''), '_blank'); }}
          />
        </TabsContent>

        {user?.role === "Administrador" && (
          <TabsContent value="doctors" className="tab-content">
            <div className="tab-header">
              <div className="tab-header-info">
                <h2 className="tab-title">Gestión de Doctores</h2>
                <p className="tab-description">Administre el personal médico y sus especialidades.</p>
              </div>
              <Dialog open={doctorDialog} onOpenChange={setDoctorDialog}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingDoctor(null); setDoctorForm({ nombre: "", especialidad: "", porcentaje: 50 }); }} className="bg-medical-600 hover:bg-medical-700">
                    <UserPlus className="button-icon" />
                    Nuevo Doctor
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingDoctor ? 'Editar Doctor' : 'Nuevo Doctor'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSaveDoctor} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo</Label>
                      <Input id="name" value={doctorForm.nombre} onChange={(e) => setDoctorForm({...doctorForm, nombre: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Especialidad</Label>
                      <Select value={doctorForm.especialidad} onValueChange={(val) => setDoctorForm({...doctorForm, especialidad: val})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione especialidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {specialties.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="percentage">Porcentaje Ganancia (%)</Label>
                      <Input id="percentage" type="number" value={doctorForm.porcentaje} onChange={(e) => setDoctorForm({...doctorForm, porcentaje: parseFloat(e.target.value)})} required />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid-container">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="card-item">
                  <div className="card-content">
                    <div className="card-info">
                      <h3 className="card-name">{doctor.nombre}</h3>
                      <p className="card-subtitle">{doctor.especialidad}</p>
                      <p className="card-detail">Ganancia: {doctor.porcentaje}%</p>
                    </div>
                    <div className="card-actions">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingDoctor(doctor); setDoctorForm({ nombre: doctor.nombre, especialidad: doctor.especialidad, porcentaje: doctor.porcentaje }); setDoctorDialog(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDoctor(doctor.id)} className="text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        {user?.role === "Doctor" && (
          <TabsContent value="pacientes" className="tab-content">
            <PacientesTab user={user} token={token} />
          </TabsContent>
        )}

        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <TabsContent value="history" className="tab-content">
            {hcPaciente ? (
              <HistoriaClinicaCompleta
                paciente={hcPaciente}
                token={token}
                user={user}
                onBack={() => setHcPaciente(null)}
              />
            ) : (
              <MedicalHistoryTab
                medicalHistories={medicalHistories}
                appointments={appointments}
                doctors={doctors}
                fetchData={fetchData}
                token={token}
                user={user}
                onOpenPaciente={setHcPaciente}
              />
            )}
          </TabsContent>
        )}

        <TabsContent value="prescriptions" className="tab-content">
          <RecetasTab prescriptions={prescriptions} user={user} token={token} />
        </TabsContent>

        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <TabsContent value="invoices" className="tab-content">
            <InvoicesTab invoices={invoices} doctors={doctors} monthlyTotals={monthlyTotals} fetchData={fetchData} token={token} />
          </TabsContent>
        )}

        {user?.role === "Administrador" && (
          <>
            <TabsContent value="inventory" className="tab-content">
              <InventoryTab inventory={inventory} categories={categories} fetchData={fetchData} />
            </TabsContent>
            <TabsContent value="payments" className="tab-content">
              <PaymentsTab doctors={doctors} doctorPayments={doctorPayments} fetchData={fetchData} token={token} />
            </TabsContent>
            <TabsContent value="users" className="tab-content">
              <UsersTab users={users} doctors={doctors} specialties={specialties} fetchData={fetchData} user={user} token={token} />
            </TabsContent>
          </>
        )}

        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <>
            <TabsContent value="proformas" className="tab-content">
              <ProformasTab token={token} />
            </TabsContent>
            <TabsContent value="abonos" className="tab-content">
              <AbonosTab token={token} />
            </TabsContent>
            <TabsContent value="caja" className="tab-content">
              <CajaTab />
            </TabsContent>
          </>
        )}

        {user?.role === "Doctor" &&
          normalizeSpecialty(user?.especialidad) === "Odontología" && (
          <>
            <TabsContent value="odontograma-standalone" className="tab-content">
              <OdontogramaStandalone token={token} user={user} />
            </TabsContent>
          </>
        )}

        {user?.role === "Administrador" && (
          <>
          <TabsContent value="catalogo" className="tab-content">
            <CatalogoServiciosTab token={token} />
          </TabsContent>
          <TabsContent value="config" className="tab-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FacturacionTab token={token} user={user} />
              <ConfiguracionSRI token={token} />
              <ConfiguracionIA token={token} />
              <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100">
                 <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-medical-600" />
                    Mantenimiento de Datos
                 </h3>
                 <Button variant="outline" onClick={async () => {
                    try {
                      const res = await apiClient.post("/admin/migrar-edades");
                      toast.success(res.data.mensaje);
                    } catch (e) {
                      toast.error("Error en migración");
                    }
                 }}>
                    Migrar Edades de Pacientes
                 </Button>
              </div>
            </div>
          </TabsContent>
          </>
        )}
      </Tabs>
    </MainLayout>
  );
}

// Estos son componentes que estaban en App.js pero que no fueron importados explícitamente arriba
// Se deberían mover a sus propios archivos eventualmente.



function App() {
  const { isAuthenticated, loading, user, token, login } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/financiero" element={isAuthenticated && ENABLE_DENTAL_V2 ? <FinancialWorkspace /> : <Navigate to="/" />} />
      <Route path="/odontologia-v2/:appointmentId" element={isAuthenticated ? <DentalWorkspace /> : <Navigate to="/login" />} />
      <Route path="/*" element={isAuthenticated ? <LegacyApp user={user} token={token} /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;