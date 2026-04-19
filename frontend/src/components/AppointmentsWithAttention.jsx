import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, Edit, Trash2, Play, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { MedicinaGeneralForm } from "./MedicinaGeneralForm";
import { PediatriaForm } from "./PediatriaForm";
import { OdontologiaFormSimple } from "./OdontologiaFormSimple";
import { HistoriaClinicaCompleta } from "./HistoriaClinicaCompleta";
import { NutricionForm } from "./NutricionForm";
import { GinecologiaForm } from "./GinecologiaForm";
import { EcografiaForm } from "./EcografiaForm";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AppointmentsWithAttention = ({ 
  filteredAppointments, 
  user,
  token,
  handleEditAppointment, 
  handleDeleteAppointment, 
  openWhatsApp,
  fetchData 
}) => {
  const [vistaAtencion, setVistaAtencion] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [modoAtencion, setModoAtencion] = useState("historia"); // "historia" o "formulario"
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  
  // Estados para el modal de pago
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState(null);
  const [consultaFinanciera, setConsultaFinanciera] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    monto: '',
    tipo_pago: 'efectivo',
    referencia: '',
    notas: ''
  });

  // Obtener la especialidad del usuario
  const userEspecialidad = user?.especialidad || null;
  
  // DEBUG: Mostrar info del usuario para verificar especialidad
  console.log("=== DEBUG USER ===", { 
    role: user?.role, 
    especialidad: userEspecialidad, 
    doctor_id: user?.doctor_id,
    username: user?.username
  });

  const handleStartAttention = async (appointment) => {
    console.log("🏥 ======== INICIANDO/REANUDANDO ATENCIÓN ========");
    console.log("📋 Appointment original:", appointment);
    console.log("🆔 Paciente ID:", appointment.paciente_id);
    console.log("🆔 Paciente Cédula:", appointment.paciente_cedula || appointment.cedula);
    console.log("👤 Usuario:", user?.role);
    console.log("⚕️ Especialidad usuario:", userEspecialidad);
    
    // VALIDACIÓN: Solo validar si el usuario tiene especialidad definida
    // Si no tiene especialidad (usuario legacy), permitir acceso
    if (user?.role === "Doctor" && userEspecialidad && appointment.especialidad !== userEspecialidad) {
      toast.error(`No puede atender consultas de ${appointment.especialidad}. Su especialidad es ${userEspecialidad}.`);
      return;
    }
    
    // VALIDACIÓN: Verificar que el doctor_id coincida (si está definido)
    if (user?.role === "Doctor" && user.doctor_id && appointment.doctor_id !== user.doctor_id) {
      toast.error("No tiene permisos para atender esta consulta.");
      return;
    }
    
    try {
      // Update appointment status to "En Atención"
      console.log("📡 Actualizando estado de cita a 'En Atención'...");
      await axios.put(
        `${API}/appointments/${appointment.id}`,
        { estado: "En Atención" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("✅ Estado actualizado");

      // IMPORTANTE: Obtener datos completos del paciente si existe paciente_cedula
      let appointmentConDatosPaciente = { ...appointment };
      
      const cedula = appointment.paciente_cedula || appointment.cedula;
      console.log("🔍 Buscando datos completos del paciente con cédula:", cedula);
      
      if (cedula) {
        try {
          // Buscar paciente en el sistema unificado
          console.log("📡 GET /api/financial/pacientes?search=", cedula);
          const responsePacientes = await axios.get(
            `${API}/financial/pacientes?search=${cedula}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          console.log("📦 Respuesta pacientes:", responsePacientes.data);
          
          const paciente = responsePacientes.data.find(p => p.cedula === cedula);
          console.log("👤 Paciente encontrado:", paciente);
          
          if (paciente) {
            // Enriquecer el appointment con los datos completos del paciente
            appointmentConDatosPaciente = {
              ...appointment,
              nombre_completo: paciente.nombre || appointment.nombre_completo,
              cedula: paciente.cedula,
              paciente_cedula: paciente.cedula,
              paciente_id: paciente.id,
              telefono: paciente.telefono || appointment.telefono,
              fecha_nacimiento: paciente.fecha_nacimiento || appointment.fecha_nacimiento || "",
              // La edad se calculará automáticamente desde fecha_nacimiento
              email: paciente.email || "",
              direccion: paciente.direccion || "",
              sexo: paciente.sexo || ""
            };
            
            console.log("✅ Appointment enriquecido con datos del paciente:");
            console.log("   - Nombre:", appointmentConDatosPaciente.nombre_completo);
            console.log("   - Cédula:", appointmentConDatosPaciente.cedula);
            console.log("   - Fecha Nacimiento:", appointmentConDatosPaciente.fecha_nacimiento);
            console.log("   - Teléfono:", appointmentConDatosPaciente.telefono);
            console.log("   - Paciente ID:", appointmentConDatosPaciente.paciente_id);
          } else {
            console.warn("⚠️ No se encontró paciente en sistema unificado, usando datos del appointment");
          }
        } catch (errorPaciente) {
          console.error("❌ Error buscando datos del paciente:", errorPaciente);
          console.warn("⚠️ Continuando con datos del appointment original");
        }
      }

      console.log("📝 Seteando appointment seleccionado con datos completos");
      setSelectedAppointment(appointmentConDatosPaciente);
      
      // Para Odontología, abrir vista completa de historia clínica
      if (appointment.especialidad === "Odontología") {
        console.log("🦷 Modo: Historia Clínica Odontológica");
        setModoAtencion("historia");
      } else {
        console.log("📋 Modo: Formulario General");
        setModoAtencion("formulario");
      }
      
      setVistaAtencion(true);
      console.log("🎉 Vista de atención abierta");
      console.log("========================================");
      
      await fetchData();
    } catch (error) {
      console.error("❌ ======== ERROR AL INICIAR ATENCIÓN ========");
      console.error("❌ Error completo:", error);
      console.error("❌ Response:", error.response?.data);
      console.error("========================================");
      toast.error("Error al iniciar atención: " + (error.response?.data?.detail || error.message));
    }
  };

  const handleAttentionSuccess = async () => {
    try {
      // Actualizar el estado de la cita a "Pendiente de Pago"
      if (selectedAppointment?.id) {
        await axios.put(
          `${API}/appointments/${selectedAppointment.id}`,
          { estado: "Pendiente de Pago" },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      setVistaAtencion(false);
      setSelectedAppointment(null);
      await fetchData();
      toast.success("Consulta terminada - Cita pendiente de pago");
    } catch (error) {
      console.error("Error al cerrar consulta:", error);
      toast.error("Error al cerrar consulta");
    }
  };

   // Función para abrir el modal de pago
  const handleOpenPaymentModal = async (appointment) => {
    try {
      const cedula = appointment.cedula || appointment.paciente_cedula || "";
      let consulta = null;

      // 1. Buscar directamente por appointment_id
      try {
        const res = await axios.get(
          `${API}/financial/consultas/por-cita/${appointment.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data && res.data.id) consulta = res.data;
      } catch { /* no existe, continuar */ }

      // 2. Si no existe, buscar precio en catálogo y crearla
      if (!consulta) {
        toast.info("Generando consulta financiera...");

        // Buscar precio real del catálogo
        let precioReal = 30.0;
        let nombreServicio = `Consulta ${appointment.especialidad || "Médica"}`;
        try {
          const catRes = await axios.get(
            `${API}/financial/catalogo?especialidad=${encodeURIComponent(appointment.especialidad || "")}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (catRes.data && catRes.data.length > 0) {
            // Buscar el servicio de consulta básica
            const servicioConsulta = catRes.data.find(s =>
              s.nombre.toLowerCase().includes("consulta") && !s.nombre.toLowerCase().includes("paquete")
            ) || catRes.data[0];
            if (servicioConsulta) {
              precioReal = servicioConsulta.precio_base;
              nombreServicio = servicioConsulta.nombre;
            }
          }
        } catch { /* usar precio default */ }

        try {
          await axios.post(
            `${API}/financial/consultas/desde-cita/${appointment.id}`,
            [{
              servicio: nombreServicio,
              descripcion: `${appointment.especialidad || "Consulta médica"} — ${appointment.nombre_completo}`,
              precio_unitario: precioReal,
              cantidad: 1
            }],
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          if (err.response?.status !== 400) throw err;
        }

        try {
          const res2 = await axios.get(
            `${API}/financial/consultas/por-cita/${appointment.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (res2.data && res2.data.id) consulta = res2.data;
        } catch { /* continuar */ }
      }

      // 3. Último recurso: buscar por cédula
      if (!consulta && cedula) {
        try {
          const res3 = await axios.get(`${API}/financial/consultas`,
            { headers: { Authorization: `Bearer ${token}` } });
          consulta = (res3.data || [])
            .filter(c => c.paciente_cedula === cedula && c.estado_pago !== "pagado")
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
        } catch { /* continuar */ }
      }

      if (!consulta) {
        toast.error("No se pudo crear la consulta financiera. Cierre primero la consulta médica.");
        return;
      }

      setConsultaFinanciera(consulta);
      setSelectedAppointmentForPayment(appointment);
      setPaymentForm({
        monto: (consulta.saldo || consulta.total || 0).toString(),
        tipo_pago: "efectivo",
        referencia: "",
        notas: ""
      });
      setShowPaymentModal(true);

    } catch (error) {
      console.error("Error en cobro:", error);
      toast.error(error.response?.data?.detail || "Error al abrir el cobro");

    }
  };

  // Función para registrar el pago
  const handleRegisterPayment = async () => {
    console.log("💳 ======== INICIANDO REGISTRO DE PAGO ========");
    console.log("📋 Consulta Financiera:", consultaFinanciera);
    console.log("💰 Formulario de Pago:", paymentForm);
    console.log("🆔 Appointment seleccionado:", selectedAppointmentForPayment);
    
    try {
      const monto = parseFloat(paymentForm.monto);
      console.log("💵 Monto parseado:", monto);
      
      if (!consultaFinanciera || !paymentForm.monto || monto <= 0) {
        console.error("❌ Validación fallida:");
        console.error("   - Tiene consulta:", !!consultaFinanciera);
        console.error("   - Tiene monto:", !!paymentForm.monto);
        console.error("   - Monto válido:", monto > 0);
        toast.error("Ingrese un monto válido");
        return;
      }

      const payloadPago = {
        fecha: new Date().toISOString().split('T')[0],
        monto: monto,
        tipo_pago: paymentForm.tipo_pago,
        referencia: paymentForm.referencia,
        notas: paymentForm.notas
      };

      console.log("📤 Payload a enviar:", payloadPago);
      console.log("📡 POST a:", `${API}/financial/consultas/${consultaFinanciera.id}/pagos`);

      // Registrar el pago en la consulta financiera
      const response = await axios.post(
        `${API}/financial/consultas/${consultaFinanciera.id}/pagos`,
        payloadPago,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("✅ Pago registrado. Response:", response.data);
      console.log("💰 Nuevo saldo:", response.data.saldo);
      console.log("💵 Total pagado:", response.data.total_pagado);
      console.log("📊 Estado pago:", response.data.estado_pago);

      // Si el saldo quedó en 0, actualizar el estado de la cita a "Pagada"
      if (response.data.saldo === 0) {
        console.log("✅ Saldo = 0, actualizando cita a 'Pagada'...");
        
        await axios.put(
          `${API}/appointments/${selectedAppointmentForPayment.id}`,
          { estado: "Pagada" },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        console.log("✅ Cita actualizada a estado 'Pagada'");
        toast.success("Pago registrado - Cita marcada como pagada");
      } else {
        console.log(`⚠️ Saldo restante: $${response.data.saldo.toFixed(2)}`);
        toast.success(`Pago registrado - Saldo restante: $${response.data.saldo.toFixed(2)}`);
      }

      // Cerrar modal y refrescar datos
      console.log("🔄 Cerrando modal y refrescando datos...");
      setShowPaymentModal(false);
      setConsultaFinanciera(null);
      setSelectedAppointmentForPayment(null);
      fetchData();
      
      console.log("🎉 Proceso de pago completado exitosamente");
      console.log("========================================");

    } catch (error) {
      console.error("❌ ======== ERROR AL REGISTRAR PAGO ========");
      console.error("❌ Error completo:", error);
      console.error("❌ Error message:", error.message);
      console.error("❌ Response status:", error.response?.status);
      console.error("❌ Response data:", error.response?.data);
      console.error("========================================");
      toast.error(error.response?.data?.detail || "Error al registrar el pago");
    }
  };

  // Filter appointments by doctor if user is a doctor
  // Solo filtrar por especialidad si el usuario tiene especialidad definida
  let visibleAppointments = filteredAppointments;
  
  if (user?.role === "Doctor" && user?.doctor_id) {
    visibleAppointments = filteredAppointments.filter(apt => {
      // Siempre filtrar por doctor_id
      if (apt.doctor_id !== user.doctor_id) return false;
      
      // Solo filtrar por especialidad si el usuario tiene una definida
      if (userEspecialidad && apt.especialidad !== userEspecialidad) return false;
      
      return true;
    });
  }

  // Filter by date (only show appointments for selected date)
  visibleAppointments = visibleAppointments.filter(apt => apt.fecha === dateFilter);

  // Sort by estado priority: "En Atención" first to allow recovery
  const sortedAppointments = [...visibleAppointments].sort((a, b) => {
    const priority = { "En Atención": 0, "Programada": 1, "Pendiente de Pago": 2, "Pagada": 3, "Cancelada": 4 };
    return priority[a.estado || "Programada"] - priority[b.estado || "Programada"];
  });

  // Contenido de la lista de citas (se usa en el return condicional)
  const appointmentsContent = (
    <>
      {/* Filtro de fecha */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#F0F9FF', padding: '1rem', borderRadius: '8px' }}>
        <Label style={{ fontWeight: 600, color: '#0C4A6E' }}>Mostrar citas del:</Label>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={{
            padding: '0.5rem',
            borderRadius: '8px',
            border: '2px solid #BFDBFE',
            fontSize: '0.9375rem',
            fontWeight: 500
          }}
        />
        <span style={{ color: '#64748B', fontSize: '0.875rem' }}>
          ({sortedAppointments.length} citas)
        </span>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Estado</th>
            <th>Paciente</th>
            <th>Cédula</th>
            <th>Edad</th>
            <th>Teléfono</th>
            <th>Especialidad</th>
            <th>Doctor</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th className="actions-column">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sortedAppointments.map((appointment) => (
            <tr key={appointment.id} data-testid={`appointment-row-${appointment.id}`}>
              <td>
                <span className={`status-badge status-${(appointment.estado || 'Programada').toLowerCase().replace(/ /g, '-')}`}>
                  {appointment.estado || "Programada"}
                </span>
              </td>
              <td><strong>{appointment.nombre_completo}</strong></td>
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
              <td className="actions-cell">
                {/* Permitir iniciar, continuar o reanudar atención */}
                {(appointment.estado === "Programada" || appointment.estado === "En Atención" || !appointment.estado) && user?.role === "Doctor" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleStartAttention(appointment)}
                    className="attention-button"
                    data-testid={`start-attention-${appointment.id}`}
                  >
                    <Play className="button-icon" size={14} />
                    {appointment.estado === "En Atención" ? "Continuar" : "Atender"}
                  </Button>
                )}
                
                {/* Permitir reanudar consulta "Pendiente de Pago" si el doctor necesita completarla */}
                {appointment.estado === "Pendiente de Pago" && user?.role === "Doctor" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartAttention(appointment)}
                    className="resume-button"
                    data-testid={`resume-attention-${appointment.id}`}
                    title="Reanudar para completar historia clínica"
                  >
                    <Play className="button-icon" size={14} />
                    Reanudar
                  </Button>
                )}
                
                {appointment.estado === "Pendiente de Pago" && user?.role === "Recepcion" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleOpenPaymentModal(appointment)}
                    className="payment-button"
                  >
                    <Check className="button-icon" size={14} />
                    Cobrar
                  </Button>
                )}
                
                {appointment.estado !== "En Atención" && (
                  <>
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
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sortedAppointments.length === 0 && (
        <div className="empty-state">
          <p>No hay citas {user?.role === "Doctor" ? "asignadas" : "registradas"}</p>
        </div>
      )}
    </>
  );

  // Si está en modo atención, mostrar la vista correspondiente
  if (vistaAtencion && selectedAppointment) {
    // Para otras especialidades: Formulario en vista amplia
    return (
      <div className="vista-atencion-formulario">
        <div className="atencion-header">
          <Button 
            variant="ghost" 
            onClick={() => {
              setVistaAtencion(false);
              setSelectedAppointment(null);
            }}
          >
            <ArrowLeft size={20} />
            Volver a Citas
          </Button>
          <div className="atencion-titulo">
            <h2>Atención Médica - {selectedAppointment.especialidad}</h2>
            <div className="patient-info-inline">
              <span><strong>Paciente:</strong> {selectedAppointment.nombre_completo}</span>
              <span><strong>Edad:</strong> {selectedAppointment.edad} años</span>
              <span><strong>Cédula:</strong> {selectedAppointment.cedula}</span>
            </div>
          </div>
        </div>
        
        <div className="atencion-contenido">
          {selectedAppointment.especialidad === "Medicina General" && (
            <MedicinaGeneralForm
              appointment={selectedAppointment}
              token={token}
              onClose={() => {
                setVistaAtencion(false);
                setSelectedAppointment(null);
              }}
              onSuccess={handleAttentionSuccess}
            />
          )}

          {selectedAppointment.especialidad === "Odontología" && (
            <OdontologiaFormSimple
              appointment={selectedAppointment}
              token={token}
              onClose={() => {
                setVistaAtencion(false);
                setSelectedAppointment(null);
              }}
              onSuccess={handleAttentionSuccess}
            />
          )}
          
          {selectedAppointment.especialidad === "Pediatría" && (
            <PediatriaForm
              appointment={selectedAppointment}
              token={token}
              onClose={() => {
                setVistaAtencion(false);
                setSelectedAppointment(null);
              }}
              onSuccess={handleAttentionSuccess}
            />
          )}
          
          {selectedAppointment.especialidad === "Nutrición" && (
            <NutricionForm
              appointment={selectedAppointment}
              token={token}
              onClose={() => { setVistaAtencion(false); setSelectedAppointment(null); }}
              onSuccess={handleAttentionSuccess}
            />
          )}

          {["Ginecología","Obstetricia","Ginecología/Obstetricia"].includes(selectedAppointment.especialidad) && (
            <GinecologiaForm
              appointment={selectedAppointment}
              token={token}
              onClose={() => { setVistaAtencion(false); setSelectedAppointment(null); }}
              onSuccess={handleAttentionSuccess}
            />
          )}

          {selectedAppointment.especialidad === "Ecografía" && (
            <EcografiaForm
              appointment={selectedAppointment}
              token={token}
              onClose={() => { setVistaAtencion(false); setSelectedAppointment(null); }}
              onSuccess={handleAttentionSuccess}
            />
          )}

          {!["Medicina General","Pediatría","Odontología","Nutrición",
             "Ginecología","Obstetricia","Ginecología/Obstetricia","Ecografía"
            ].includes(selectedAppointment.especialidad) && (
            <div style={{padding: '2rem', textAlign: 'center'}}>
              <p>Historia clínica de <strong>{selectedAppointment.especialidad}</strong> próximamente.</p>
              <p style={{marginTop: '1rem', color: '#64748B'}}>
                Disponibles: Medicina General, Pediatría, Odontología, Nutrición, Ginecología y Ecografía.
              </p>
              <Button 
                onClick={() => {
                  setVistaAtencion(false);
                  setSelectedAppointment(null);
                }}
                style={{marginTop: '1.5rem'}}
              >
                Volver
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista normal de lista de citas
  return (
    <>
      {appointmentsContent}
      
      {/* Modal de Registro de Pago */}
      {showPaymentModal && consultaFinanciera && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:"16px" }}>
          <div style={{ background:"white", borderRadius:"12px", boxShadow:"0 20px 60px rgba(0,0,0,0.3)", width:"100%", maxWidth:"520px", overflow:"hidden" }}>

            {/* Header */}
            <div style={{ background:"linear-gradient(135deg,#00a8cc,#005f73)", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <h3 style={{ color:"white", margin:0, fontSize:"16px", fontWeight:"700" }}>💰 Cobro de Consulta</h3>
                <p style={{ color:"rgba(255,255,255,0.8)", margin:"2px 0 0", fontSize:"12px" }}>
                  {consultaFinanciera.paciente_nombre} · {consultaFinanciera.paciente_cedula}
                </p>
              </div>
              <button onClick={() => { setShowPaymentModal(false); setConsultaFinanciera(null); setSelectedAppointmentForPayment(null); }}
                style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"white", borderRadius:"50%", width:"28px", height:"28px", cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                ×
              </button>
            </div>

            <div style={{ padding:"20px" }}>

              {/* Desglose de servicios */}
              <div style={{ marginBottom:"16px" }}>
                <p style={{ fontSize:"12px", fontWeight:"700", color:"#005f73", marginBottom:"8px", textTransform:"uppercase" }}>
                  📋 Detalle de Servicios
                </p>
                <div style={{ border:"1px solid #e0f7fa", borderRadius:"8px", overflow:"hidden" }}>
                  {/* Encabezado tabla */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", background:"#f0fbff", padding:"6px 12px", fontSize:"11px", fontWeight:"700", color:"#005f73", borderBottom:"1px solid #e0f7fa" }}>
                    <span>Servicio</span>
                    <span style={{ textAlign:"center", paddingRight:"12px" }}>Cant.</span>
                    <span style={{ textAlign:"right" }}>Precio</span>
                  </div>
                  {/* Filas de servicios */}
                  {(consultaFinanciera.servicios || []).map((srv, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr auto auto", padding:"8px 12px", borderBottom: i < (consultaFinanciera.servicios||[]).length-1 ? "1px solid #f0f0f0" : "none", alignItems:"center" }}>
                      <div>
                        <p style={{ margin:0, fontSize:"13px", fontWeight:"600", color:"#333" }}>{srv.servicio}</p>
                        {srv.descripcion && srv.descripcion !== srv.servicio && (
                          <p style={{ margin:0, fontSize:"11px", color:"#666" }}>{srv.descripcion}</p>
                        )}
                      </div>
                      <span style={{ textAlign:"center", fontSize:"13px", color:"#555", paddingRight:"12px" }}>{srv.cantidad || 1}</span>
                      <span style={{ textAlign:"right", fontSize:"13px", fontWeight:"700", color:"#005f73" }}>
                        ${(srv.precio_unitario || srv.subtotal || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {(!consultaFinanciera.servicios || consultaFinanciera.servicios.length === 0) && (
                    <div style={{ padding:"12px", textAlign:"center", color:"#999", fontSize:"12px" }}>
                      Consulta — {consultaFinanciera.especialidad}
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen de totales */}
              <div style={{ background:"#f8fdff", borderRadius:"8px", padding:"12px", marginBottom:"16px", border:"1.5px solid #00a8cc" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px", fontSize:"13px", color:"#555" }}>
                  <span>Total consulta:</span>
                  <span style={{ fontWeight:"700" }}>${(consultaFinanciera.total || 0).toFixed(2)}</span>
                </div>
                {(consultaFinanciera.total_pagado || 0) > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px", fontSize:"13px", color:"#059669" }}>
                    <span>Ya pagado:</span>
                    <span style={{ fontWeight:"700" }}>-${consultaFinanciera.total_pagado.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"16px", fontWeight:"800", color:"#00a8cc", borderTop:"1px solid #b2ebf2", paddingTop:"8px", marginTop:"4px" }}>
                  <span>SALDO A COBRAR:</span>
                  <span>${(consultaFinanciera.saldo || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Formulario de pago */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
                <div>
                  <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>
                    Monto a cobrar *
                  </label>
                  <input type="number" step="0.01"
                    value={paymentForm.monto}
                    onChange={e => setPaymentForm({...paymentForm, monto: e.target.value})}
                    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #00a8cc", borderRadius:"8px", fontSize:"16px", fontWeight:"700", color:"#005f73", boxSizing:"border-box" }}
                  />
                  <p style={{ fontSize:"10px", color:"#999", margin:"2px 0 0" }}>Puede ser abono parcial</p>
                </div>
                <div>
                  <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>
                    Forma de pago *
                  </label>
                  <select value={paymentForm.tipo_pago}
                    onChange={e => setPaymentForm({...paymentForm, tipo_pago: e.target.value})}
                    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #e5e7eb", borderRadius:"8px", fontSize:"13px", boxSizing:"border-box" }}>
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="transferencia">🏦 Transferencia</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="seguro">🏥 Seguro</option>
                    <option value="otros">📋 Otros</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom:"12px" }}>
                <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>
                  Referencia / N° Transacción
                </label>
                <input type="text"
                  value={paymentForm.referencia}
                  onChange={e => setPaymentForm({...paymentForm, referencia: e.target.value})}
                  placeholder="Opcional — Nº de transferencia, voucher..."
                  style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #e5e7eb", borderRadius:"8px", fontSize:"13px", boxSizing:"border-box" }}
                />
              </div>

              {/* Botones */}
              <div style={{ display:"flex", gap:"10px", marginTop:"4px" }}>
                <button onClick={handleRegisterPayment}
                  style={{ flex:1, padding:"12px", background:"linear-gradient(135deg,#00a8cc,#005f73)", color:"white", border:"none", borderRadius:"8px", fontSize:"15px", fontWeight:"700", cursor:"pointer" }}>
                  ✓ Confirmar Pago ${parseFloat(paymentForm.monto || 0).toFixed(2)}
                </button>
                <button onClick={() => { setShowPaymentModal(false); setConsultaFinanciera(null); setSelectedAppointmentForPayment(null); }}
                  style={{ padding:"12px 16px", background:"#f3f4f6", color:"#374151", border:"none", borderRadius:"8px", fontSize:"13px", cursor:"pointer" }}>
                  Cancelar
                </button>
              </div>

              {/* Nota info caja */}
              <p style={{ fontSize:"10px", color:"#9ca3af", textAlign:"center", marginTop:"8px" }}>
                El pago quedará registrado en Caja para el cierre del día
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};