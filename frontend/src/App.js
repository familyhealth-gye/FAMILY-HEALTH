/**
 * App.js
 * Punto de entrada principal. Responsabilidades:
 *   - Routing de rutas principales
 *   - LegacyApp: montaje de tabs, permisos por rol, navegación
 *
 * Lógica de datos → hooks/useAppData.js
 * Gestión de doctores → components/tabs/DoctoresTab.jsx
 * Counter/Intake → modules/counter/
 */

import { useState } from "react";
import "@/App.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Stethoscope, Users, FileText, Package, DollarSign,
  ClipboardList, UserCog, Receipt, CreditCard, ListChecks, Smile,
} from "lucide-react";

// ── Tabs existentes ──────────────────────────────────────────────────────────
import { InvoicesTab }           from "@/components/InvoicesTab";
import { AbonosTab }             from "@/components/AbonosTab";
import { InventoryTab }          from "@/components/InventoryTab";
import { PaymentsTab }           from "@/components/PaymentsTab";
import { UsersTab }              from "@/components/UsersTab";
import { AppointmentsWithAttention } from "@/components/AppointmentsWithAttention";
import { ProformasTab }          from "@/components/ProformasTab";
import CajaTab                   from "@/components/CajaTab";
import { PacientesTab }          from "@/components/PacientesTab";
import { CatalogoServiciosTab }  from "@/components/CatalogoServiciosTab";
import { ConfiguracionIA }       from "@/components/ConfiguracionIA";
import { FacturacionTab }        from "@/components/FacturacionTab";
import { ConfiguracionSRI }      from "@/components/ConfiguracionSRI";
import { RecetasTab }            from "@/components/RecetasTab";
import { MedicalHistoryTab }     from "@/components/MedicalHistoryTab";
import { HistoriaClinicaCompleta } from "@/components/HistoriaClinicaCompleta";
import { OdontogramaStandalone } from "@/components/OdontogramaStandalone";

// ── Módulos extraídos ────────────────────────────────────────────────────────
import { DoctoresTab }  from "@/components/tabs/DoctoresTab";
import { useAppData }   from "@/hooks/useAppData";

// ── Auth / Layout / Router ───────────────────────────────────────────────────
import { Login }        from "@/pages/Login";
import { Routes, Route, Navigate } from "react-router-dom";
import DentalWorkspace      from "@/workspaces/DentalWorkspace";
import FinancialWorkspace   from "@/workspaces/FinancialWorkspace";
import { ENABLE_DENTAL_V2 } from "@/lib/constants";
import { useAuth }          from "@/hooks/useAuth";
import { MainLayout }       from "@/components/layout/MainLayout";
import apiClient            from "@/lib/axios";
import { normalizeSpecialty } from "@/lib/specialties";

// ─── LegacyApp ───────────────────────────────────────────────────────────────
// Componente principal de la app (tabs + contenido).
// Mantiene su nombre para no romper referencias internas.
function LegacyApp({ user: propUser, token: propToken }) {
  const { user: authUser, token: authToken, isAuthenticated, loading: authLoading } = useAuth();
  const user  = propUser  || authUser;
  const token = propToken || authToken;

  // ── Datos globales ─────────────────────────────────────────────────────────
  const {
    users, doctors, appointments, invoices, inventory,
    doctorPayments, medicalHistories, prescriptions,
    specialties, categories, monthlyTotals,
    loading, fetchData,
  } = useAppData(user, isAuthenticated);

  // ── Estado local de UI ─────────────────────────────────────────────────────
  const [hcPaciente, setHcPaciente] = useState(null);

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }
  if (!isAuthenticated) return <Login />;

  return (
    <MainLayout>
      <Tabs defaultValue="appointments" className="tabs-container">

        {/* ══ NAVEGACIÓN ═══════════════════════════════════════════════════ */}
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
              <TabsTrigger value="caja">
                <DollarSign className="tab-icon" />
                Caja
              </TabsTrigger>
            </>
          )}

          {user?.role === "Doctor" &&
            normalizeSpecialty(user?.especialidad) === "Odontología" && (
            <TabsTrigger value="odontograma-standalone">
              <Smile className="tab-icon" />
              Odontograma
            </TabsTrigger>
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

        {/* ══ CONTENIDO ════════════════════════════════════════════════════ */}

        {/* Citas / Agenda */}
        <TabsContent value="appointments" className="tab-content">
          <AppointmentsWithAttention
            filteredAppointments={appointments}
            user={user}
            token={token}
            fetchData={fetchData}
            handleEditAppointment={null}
            handleDeleteAppointment={null}
            openWhatsApp={(phone) => {
              if (phone) window.open("https://wa.me/" + phone.replace(/[^0-9]/g, ""), "_blank");
            }}
          />
        </TabsContent>

        {/* Doctores — componente extraído */}
        {user?.role === "Administrador" && (
          <TabsContent value="doctors" className="tab-content">
            <DoctoresTab
              doctors={doctors}
              specialties={specialties}
              fetchData={fetchData}
            />
          </TabsContent>
        )}

        {/* Pacientes (vista Doctor) */}
        {user?.role === "Doctor" && (
          <TabsContent value="pacientes" className="tab-content">
            <PacientesTab user={user} token={token} />
          </TabsContent>
        )}

        {/* Historias clínicas */}
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

        {/* Recetas */}
        <TabsContent value="prescriptions" className="tab-content">
          <RecetasTab prescriptions={prescriptions} user={user} token={token} />
        </TabsContent>

        {/* Facturas */}
        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <TabsContent value="invoices" className="tab-content">
            <InvoicesTab
              invoices={invoices}
              doctors={doctors}
              monthlyTotals={monthlyTotals}
              fetchData={fetchData}
              token={token}
            />
          </TabsContent>
        )}

        {/* Admin: Inventario, Pagos, Usuarios */}
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

        {/* Recepción / Admin: Proformas, Abonos, Caja */}
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

        {/* Odontograma standalone (Doctor Odontólogo) */}
        {user?.role === "Doctor" &&
          normalizeSpecialty(user?.especialidad) === "Odontología" && (
          <TabsContent value="odontograma-standalone" className="tab-content">
            <OdontogramaStandalone token={token} user={user} />
          </TabsContent>
        )}

        {/* Admin: Catálogo separado */}
        {user?.role === "Administrador" && (
          <>
            <TabsContent value="catalogo" className="tab-content">
              <CatalogoServiciosTab token={token} />
            </TabsContent>

            {/* Config: solo configuración del sistema */}
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
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await apiClient.post("/admin/migrar-edades");
                        toast.success(res.data.mensaje);
                      } catch {
                        toast.error("Error en migración");
                      }
                    }}
                  >
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

// ─── Router principal ─────────────────────────────────────────────────────────
function App() {
  const { isAuthenticated, loading, user, token } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route
        path="/login"
        element={!isAuthenticated ? <Login /> : <Navigate to="/" />}
      />
      <Route
        path="/financiero"
        element={isAuthenticated && ENABLE_DENTAL_V2
          ? <FinancialWorkspace />
          : <Navigate to="/" />}
      />
      <Route
        path="/odontologia-v2/:appointmentId"
        element={isAuthenticated ? <DentalWorkspace /> : <Navigate to="/login" />}
      />
      <Route
        path="/*"
        element={isAuthenticated
          ? <LegacyApp user={user} token={token} />
          : <Navigate to="/login" />}
      />
    </Routes>
  );
}

export default App;
