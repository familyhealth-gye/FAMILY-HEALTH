/**
 * App.js
 * Responsabilidades:
 *   - Routing principal
 *   - LegacyApp: SmartNav (móvil: dropdown, desktop: tabs), permisos, contenido
 *
 * Lógica de datos  → hooks/useAppData.js
 * Doctores tab     → components/tabs/DoctoresTab.jsx
 * Counter/Intake   → modules/counter/
 * Navegación       → components/SmartNav.jsx
 */

import { useState, useEffect } from "react";
import "@/App.css";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button }            from "@/components/ui/button";
import { toast }             from "sonner";
import {
  Stethoscope, Users, FileText, Package, DollarSign,
  ClipboardList, UserCog, Receipt, CreditCard, ListChecks, Smile, Zap,
} from "lucide-react";

// ── Componentes de tabs ──────────────────────────────────────────────────────
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
import { ProcedimientoRapidoTab } from "@/components/ProcedimientoRapidoTab";

// ── Módulos extraídos ────────────────────────────────────────────────────────
import { DoctoresTab }  from "@/components/tabs/DoctoresTab";
import { useAppData }   from "@/hooks/useAppData";
import { SmartNav }     from "@/components/SmartNav";

// ── Auth / Layout / Router ───────────────────────────────────────────────────
import { Login }            from "@/pages/Login";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth }          from "@/hooks/useAuth";
import { MainLayout }       from "@/components/layout/MainLayout";
import apiClient            from "@/lib/axios";
import { normalizeSpecialty } from "@/lib/specialties";

// ─── Definición de items de navegación ───────────────────────────────────────
// group: clinico | operativo | admin | config
// roles: null = todos los autenticados
function buildNavItems(user) {
  const role = user?.role;
  const isAdmin    = role === "Administrador";
  const isRecep    = role === "Recepcion";
  const isDoctor   = role === "Doctor";
  const isAdminRec = isAdmin || isRecep;

  return [
    // ── Clínico ────────────────────────────────────────────────────────
    {
      value: "appointments", label: "Citas", group: "clinico",
      icon: Users,
    },
    isAdmin && {
      value: "doctors", label: "Doctores", group: "clinico",
      icon: Stethoscope,
    },
    isDoctor && {
      value: "pacientes", label: "Pacientes", group: "clinico",
      icon: Users,
    },
    isAdminRec && {
      value: "history", label: "Historias", group: "clinico",
      icon: ClipboardList,
    },
    {
      value: "prescriptions", label: "Recetas", group: "clinico",
      icon: FileText,
    },
    (isAdmin || isRecep || isDoctor) && {
      value: "procedimientos", label: "Procedimientos", group: "clinico",
      icon: Zap,
    },
    // ── Operativo ──────────────────────────────────────────────────────
    isAdminRec && {
      value: "invoices", label: "Facturación", group: "operativo",
      icon: FileText,
    },
    isAdminRec && {
      value: "proformas", label: "Proformas", group: "operativo",
      icon: Receipt,
    },
    isAdminRec && {
      value: "abonos", label: "Abonos", group: "operativo",
      icon: CreditCard,
    },
    isAdminRec && {
      value: "caja", label: "Caja", group: "operativo",
      icon: DollarSign,
    },
    // ── Admin ──────────────────────────────────────────────────────────
    isAdmin && {
      value: "inventory", label: "Inventario", group: "admin",
      icon: Package,
    },
    isAdmin && {
      value: "payments", label: "Pagos Doctores", group: "admin",
      icon: DollarSign,
    },
    isAdmin && {
      value: "users", label: "Usuarios", group: "admin",
      icon: UserCog,
    },
    isAdmin && {
      value: "catalogo", label: "Catálogo", group: "admin",
      icon: ListChecks,
    },
    // ── Odontograma standalone (Doctor odontólogo) ─────────────────────
    (isDoctor && normalizeSpecialty(user?.especialidad) === "Odontología") && {
      value: "odontograma-standalone", label: "Odontograma", group: "clinico",
      icon: Smile,
    },
    // ── Config ────────────────────────────────────────────────────────
    isAdmin && {
      value: "config", label: "Configuración", group: "config",
      icon: UserCog,
    },
  ].filter(Boolean);
}

// ─── LegacyApp ───────────────────────────────────────────────────────────────
function LegacyApp({ user: propUser, token: propToken }) {
  const { user: authUser, token: authToken, isAuthenticated, loading: authLoading } = useAuth();
  const user  = propUser  || authUser;
  const token = propToken || authToken;

  const {
    users, doctors, appointments, invoices, inventory,
    doctorPayments, medicalHistories, prescriptions,
    specialties, categories, monthlyTotals,
    loading, fetchData,
  } = useAppData(user, isAuthenticated);

  const [activeTab, setActiveTab] = useState("appointments");
  const [hcPaciente, setHcPaciente] = useState(null);

  // Escuchar evento de navegación entre tabs (ej. desde CajaTab → Facturación)
  useEffect(() => {
    const handler = (e) => setActiveTab(e.detail);
    window.addEventListener("navigate_to_tab", handler);
    return () => window.removeEventListener("navigate_to_tab", handler);
  }, []);

  if (authLoading) return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  if (!isAuthenticated) return <Login />;

  const navItems = buildNavItems(user);

  return (
    <MainLayout>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="tabs-container">

        {/* ══ NAVEGACIÓN INTELIGENTE ══════════════════════════════════ */}
        <SmartNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          items={navItems}
          userRole={user?.role}
        />

        {/* ══ CONTENIDO ════════════════════════════════════════════════ */}

        {/* Citas */}
        <TabsContent value="appointments" className="tab-content">
          <AppointmentsWithAttention
            filteredAppointments={appointments}
            user={user} token={token} fetchData={fetchData}
            handleEditAppointment={null} handleDeleteAppointment={null}
            openWhatsApp={(phone) => {
              if (phone) window.open("https://wa.me/" + phone.replace(/[^0-9]/g, ""), "_blank");
            }}
          />
        </TabsContent>

        {/* Doctores */}
        {user?.role === "Administrador" && (
          <TabsContent value="doctors" className="tab-content">
            <DoctoresTab doctors={doctors} specialties={specialties} fetchData={fetchData} />
          </TabsContent>
        )}

        {/* Pacientes (Doctor) */}
        {user?.role === "Doctor" && (
          <TabsContent value="pacientes" className="tab-content">
            <PacientesTab user={user} token={token} />
          </TabsContent>
        )}

        {/* Historias */}
        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <TabsContent value="history" className="tab-content">
            {hcPaciente ? (
              <HistoriaClinicaCompleta
                paciente={hcPaciente} token={token} user={user}
                onBack={() => setHcPaciente(null)}
              />
            ) : (
              <MedicalHistoryTab
                medicalHistories={medicalHistories} appointments={appointments}
                doctors={doctors} fetchData={fetchData} token={token} user={user}
                onOpenPaciente={setHcPaciente}
              />
            )}
          </TabsContent>
        )}

        {/* Recetas */}
        <TabsContent value="prescriptions" className="tab-content">
          <RecetasTab prescriptions={prescriptions} user={user} token={token} />
        </TabsContent>

        {/* Procedimientos */}
        {(user?.role === "Administrador" || user?.role === "Recepcion" || user?.role === "Doctor") && (
          <TabsContent value="procedimientos" className="tab-content">
            <ProcedimientoRapidoTab token={token} user={user} />
          </TabsContent>
        )}

        {/* ── Facturación — Admin ve todo, Counter/Recepción ve lista + nueva factura ── */}
        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <TabsContent value="invoices" className="tab-content">
            <FacturacionTab token={token} user={user} />
          </TabsContent>
        )}

        {/* Proformas */}
        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <TabsContent value="proformas" className="tab-content">
            <ProformasTab token={token} />
          </TabsContent>
        )}

        {/* Abonos */}
        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <TabsContent value="abonos" className="tab-content">
            <AbonosTab token={token} />
          </TabsContent>
        )}

        {/* Caja */}
        {(user?.role === "Administrador" || user?.role === "Recepcion") && (
          <TabsContent value="caja" className="tab-content">
            <CajaTab />
          </TabsContent>
        )}

        {/* Admin: Inventario, Pagos, Usuarios, Catálogo */}
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
            <TabsContent value="catalogo" className="tab-content">
              <CatalogoServiciosTab token={token} />
            </TabsContent>
          </>
        )}

        {/* Odontograma standalone */}
        {user?.role === "Doctor" && normalizeSpecialty(user?.especialidad) === "Odontología" && (
          <TabsContent value="odontograma-standalone" className="tab-content">
            <OdontogramaStandalone token={token} user={user} />
          </TabsContent>
        )}

        {/* Configuración — solo Admin */}
        {user?.role === "Administrador" && (
          <TabsContent value="config" className="tab-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        )}

      </Tabs>
    </MainLayout>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────
function App() {
  const { isAuthenticated, loading, user, token } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
      <Route path="/*" element={isAuthenticated ? <LegacyApp user={user} token={token} /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
