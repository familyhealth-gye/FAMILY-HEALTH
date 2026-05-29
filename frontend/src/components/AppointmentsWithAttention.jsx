import { ENABLE_DENTAL_V2 } from "@/lib/constants";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, Edit, Trash2, Play, Check, ArrowLeft, CalendarPlus } from "lucide-react";
import { NuevaCitaModal } from "./NuevaCitaModal";
import { FichaPostCitaModal } from "./FichaPostCitaModal";
import { DocumentosClinicosPanel } from "./DocumentosClinicosPanel";
import { toast } from "sonner";
import apiClient from "@/lib/axios";
import { MedicinaGeneralForm } from "./MedicinaGeneralForm";
import { PediatriaForm } from "./PediatriaForm";
import { OdontologiaFormSimple } from "./OdontologiaFormSimple";
import { OdontologiaForm } from "./OdontologiaForm";
import { OdontogramaClinicoTab } from "./OdontogramaClinicoTab";
import { NutricionForm } from "./NutricionForm";
import { GinecologiaForm } from "./GinecologiaForm";
import { EcografiaForm } from "./EcografiaForm";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = '' + BACKEND_URL + '/api';

// ── Normalización de especialidades ─────────────────────────────────────────
// Fuente única de verdad: lib/specialties.js
// normalizeEspecialidad es alias local para compatibilidad con llamadas legacy en este archivo.
import { normalizeSpecialty } from "@/lib/specialties";
const normalizeEspecialidad = normalizeSpecialty;

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
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [editingAppt, setEditingAppt] = useState(null);
  const [editApptForm, setEditApptForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [modoAtencion, setModoAtencion] = useState("historia");
  // Ficha clínica post-cita (modal para completar desde recepción)
  const [fichaAppt, setFichaAppt] = useState(null);
  // ── Fecha local Ecuador (UTC-5) — evita que entre 00:00 y 04:59 se muestre el día siguiente
  const getLocalDate = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD en timezone del browser
  const [dateFilter, setDateFilter] = useState(getLocalDate);
  
  // Estados para el modal de pago
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState(null);
  const [consultaFinanciera, setConsultaFinanciera] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    monto: '',
    tipo_pago: 'efectivo',
    referencia: '',
    notas: '',
    descuento: 0,        // valor en $ del descuento
    motivo_descuento: '' // razn del descuento
  });

  // Obtener la especialidad del usuario
  const userEspecialidad = user?.especialidad || null;

  const handleStartAttention = async (appointment) => {
    // VALIDACIÓN DE ESPECIALIDAD: Solo validar si el usuario tiene especialidad definida
    if (user?.role === "Doctor" && userEspecialidad &&
        normalizeSpecialty(appointment.especialidad) !== normalizeSpecialty(userEspecialidad)) {
      toast.error(`No puede atender consultas de ${appointment.especialidad}. Su especialidad es ${userEspecialidad}.`);
      return;
    }

    // VALIDACIÓN DE DOCTOR: Solo bloquear si la cita tiene doctor asignado Y es distinto.
    // Citas sin doctor asignado (doctor_id="") son tomables por cualquier doctor de la especialidad.
    if (user?.role === "Doctor" && user.doctor_id &&
        appointment.doctor_id && appointment.doctor_id !== user.doctor_id) {
      toast.error("Esta cita está asignada a otro doctor.");
      return;
    }

    try {
      // Si la cita no tiene doctor asignado, asignar al doctor actual automáticamente
      const updatePayload = { estado: "En Atención" };
      if (user?.role === "Doctor" && user.doctor_id && !appointment.doctor_id) {
        updatePayload.doctor_id    = user.doctor_id;
        updatePayload.doctor_nombre = user.nombre_completo || user.nombre || user.username || "";
      }
      await apiClient.put(`/appointments/${appointment.id}`, updatePayload);

      // Enriquecer con datos completos del paciente desde sistema unificado
      let appointmentConDatosPaciente = { ...appointment, ...updatePayload };

      const cedula = appointment.paciente_cedula || appointment.cedula;
      if (cedula) {
        try {
          const responsePacientes = await apiClient.get(`/financial/pacientes?search=${cedula}`);
          const paciente = (responsePacientes.data || []).find(p => p.cedula === cedula);
          if (paciente) {
            appointmentConDatosPaciente = {
              ...appointmentConDatosPaciente,
              nombre_completo:  paciente.nombre  || appointment.nombre_completo,
              cedula:           paciente.cedula,
              paciente_cedula:  paciente.cedula,
              paciente_id:      paciente.id,
              telefono:         paciente.telefono        || appointment.telefono,
              fecha_nacimiento: paciente.fecha_nacimiento || appointment.fecha_nacimiento || "",
              email:            paciente.email   || "",
              direccion:        paciente.direccion || "",
              sexo:             paciente.sexo     || "",
            };
          }
        } catch {
          // No bloquear la atención si falla la búsqueda del paciente
        }
      }

      setSelectedAppointment(appointmentConDatosPaciente);
      // Odontología usa vista completa de historia clínica; otras usan formulario
      setModoAtencion(normalizeSpecialty(appointment.especialidad) === "Odontología" ? "historia" : "formulario");
      setVistaAtencion(true);
      await fetchData();
    } catch (error) {
      toast.error(`Error al iniciar atención: ${error.response?.data?.detail || error.message}`);
    }
  };

  // ── Edición de cita ─────────────────────────────────────────────────────────
  const handleEditAppt = (appt) => {
    // Si el padre pasó un handler real, usarlo; si no, modal interno
    if (handleEditAppointment) {
      handleEditAppointment(appt);
      return;
    }
    setEditApptForm({
      nombre_completo: appt.nombre_completo || '',
      cedula:          appt.cedula          || appt.paciente_cedula || '',
      telefono:        appt.telefono        || '',
      fecha:           appt.fecha           || '',
      hora:            appt.hora            || '',
      especialidad:    appt.especialidad    || '',
      doctor_nombre:   appt.doctor_nombre   || '',
      motivo:          appt.motivo          || '',
      estado:          appt.estado          || 'Programada',
    });
    setEditingAppt(appt);
  };

  const handleSaveEditAppt = async () => {
    if (!editingAppt?.id) return;
    setSavingEdit(true);
    try {
      await apiClient.put('/appointments/' + editingAppt.id, editApptForm);
      toast.success('Cita actualizada correctamente');
      setEditingAppt(null);
      if (fetchData) fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al actualizar la cita');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Eliminación de cita ───────────────────────────────────────────────────
  const handleDeleteAppt = async (apptId) => {
    // Si el padre pasó un handler real, usarlo
    if (handleDeleteAppointment) {
      handleDeleteAppointment(apptId);
      return;
    }
    if (!window.confirm('¿Eliminar esta cita? Esta acción no se puede deshacer.')) return;
    try {
      await apiClient.delete('/appointments/' + apptId);
      toast.success('Cita eliminada');
      if (fetchData) fetchData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error al eliminar la cita');
    }
  };

  const handleAttentionSuccess = async () => {
    try {
      // Actualizar el estado de la cita a "Pendiente de Pago"
      if (selectedAppointment?.id) {
        await apiClient.put('/appointments/' + selectedAppointment.id,
          { estado: "Pendiente de Pago" });
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

   // Funcin para abrir el modal de pago
  const handleOpenPaymentModal = async (appointment) => {
    try {
      const cedula = appointment.cedula || appointment.paciente_cedula || "";
      let consulta = null;

      // 1. Buscar directamente por appointment_id
      try {
        const res = await apiClient.get(
          '/financial/consultas/por-cita/' + appointment.id
        );
        if (res.data && res.data.id) consulta = res.data;
      } catch { /* no existe, continuar */ }

      // 2. Si no existe, buscar precio en catlogo y crearla
      if (!consulta) {
        toast.info("Generando consulta financiera...");

        // Buscar precio real del catlogo
        let precioReal = 30.0;
        let nombreServicio = 'Consulta ' + (appointment.especialidad || 'Medica');
        try {
          const catRes = await apiClient.get(
            '/financial/catalogo?especialidad=' + encodeURIComponent(appointment.especialidad || '')
          );
          if (catRes.data && catRes.data.length > 0) {
            // Buscar el servicio de consulta bsica
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
          await apiClient.post('/financial/consultas/desde-cita/' + appointment.id,
            [{
              servicio: nombreServicio,
              descripcion: (appointment.especialidad || 'Consulta medica') + ' - ' + appointment.nombre_completo,
              precio_unitario: precioReal,
              cantidad: 1
            }]);
        } catch (err) {
          if (err.response?.status !== 400) throw err;
        }

        try {
          const res2 = await apiClient.get(
            '/financial/consultas/por-cita/' + appointment.id
          );
          if (res2.data && res2.data.id) consulta = res2.data;
        } catch { /* continuar */ }
      }

      // 3. ltimo recurso: buscar por cédula
      if (!consulta && cedula) {
        try {
          const res3 = await apiClient.get('/financial/consultas');
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
        notas: "",
        descuento: 0,
        motivo_descuento: ""
      });
      setShowPaymentModal(true);

    } catch (error) {
      console.error("Error en cobro:", error);
      toast.error(error.response?.data?.detail || "Error al abrir el cobro");

    }
  };

  // Función para registrar el pago
  const handleRegisterPayment = async () => {
    try {
      const descuento        = parseFloat(paymentForm.descuento) || 0;
      const saldoConDescuento = Math.max(0, (consultaFinanciera.saldo || 0) - descuento);
      const monto            = parseFloat(paymentForm.monto);

      if (!consultaFinanciera || !paymentForm.monto || monto <= 0) {
        toast.error("Ingrese un monto válido");
        return;
      }
      if (monto > saldoConDescuento + 0.01) {
        toast.error("El monto excede el saldo.");
        return;
      }

      // ── Idempotencia: bloquear si ya fue pagada ───────────────────────────
      try {
        const estadoRes = await apiClient.get(`/financial/consultas/${consultaFinanciera.id}`);
        if (estadoRes.data?.estado_pago === "pagado") {
          toast.warning("Esta consulta ya fue pagada.");
          setShowPaymentModal(false);
          setConsultaFinanciera(null);
          setSelectedAppointmentForPayment(null);
          fetchData();
          return;
        }
      } catch { /* continuar */ }

      // ── Aplicar descuento si hay ──────────────────────────────────────────
      if (descuento > 0) {
        try {
          await apiClient.put(`/financial/consultas/${consultaFinanciera.id}`, {
            descuento,
            motivo_descuento: paymentForm.motivo_descuento || "Descuento aplicado",
            total: (consultaFinanciera.total || 0) - descuento,
            saldo: saldoConDescuento,
          });
        } catch { /* continuar */ }
      }

      // ── Registrar pago ────────────────────────────────────────────────────
      const payloadPago = {
        fecha:             new Date().toISOString().split("T")[0],
        monto,
        tipo_pago:         paymentForm.tipo_pago,
        referencia:        paymentForm.referencia,
        notas:             (descuento > 0
          ? `Descuento $${descuento.toFixed(2)}${paymentForm.motivo_descuento ? " - " + paymentForm.motivo_descuento : ""}. `
          : "") + (paymentForm.notas || ""),
        descuento_aplicado: descuento,
      };

      const response    = await apiClient.post(`/financial/consultas/${consultaFinanciera.id}/pagos`, payloadPago);
      const pagoCompleto = (response.data?.saldo ?? saldoConDescuento - monto) <= 0.01;

      // ── Actualizar estado cita ─────────────────────────────────────────────
      if (pagoCompleto) {
        await apiClient.put(`/appointments/${selectedAppointmentForPayment.id}`, { estado: "Pagada" });
        toast.success("✅ Pago completo — cita marcada como pagada");
      } else {
        toast.success(`Abono registrado — saldo: $${(response.data?.saldo ?? 0).toFixed(2)}`);
        setShowPaymentModal(false);
        setConsultaFinanciera(null);
        setSelectedAppointmentForPayment(null);
        fetchData();
        return;
      }

      // ── Cerrar modal ANTES de mostrar opción de facturar ─────────────────
      // IMPORTANTE: capturar todo antes de limpiar estado React
      const apt              = selectedAppointmentForPayment;
      const consultaSnap     = consultaFinanciera;
      const montoFinal       = monto;
      const descuentoFinal   = descuento;
      const tipoPagoSnap     = paymentForm.tipo_pago;
      const referenciaSnap   = paymentForm.referencia || "";

      setShowPaymentModal(false);
      setConsultaFinanciera(null);
      setSelectedAppointmentForPayment(null);
      fetchData();

      // ── Notificar con opción de ir a facturar ─────────────────────────────
      // No se factura automáticamente — el usuario puede ajustar datos
      // (nombre, cédula a nombre de otra persona) antes de emitir
      toast.success(
        `✅ Cobro registrado — $${montoFinal.toFixed(2)}`,
        {
          duration: 8000,
          description: "Ve a Caja para emitir la factura con los datos correctos.",
        }
      );

    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al registrar el pago");
    }
  };

  // ── Filtro de citas visibles ─────────────────────────────────────────────
  // Doctores ven:
  //   - Citas asignadas a ellos (doctor_id === user.doctor_id)
  //   - Citas SIN doctor asignado de su misma especialidad (para poder "tomarlas")
  // Admin y Recepción ven todas.
  let visibleAppointments = filteredAppointments ?? [];

  if (user?.role === "Doctor" && user?.doctor_id) {
    visibleAppointments = visibleAppointments.filter(apt => {
      const esDeEsteDoctor   = apt.doctor_id === user.doctor_id;
      const sinDoctorAsignado = !apt.doctor_id || apt.doctor_id === "";
      const mismaEspecialidad = !userEspecialidad ||
        normalizeSpecialty(apt.especialidad) === normalizeSpecialty(userEspecialidad);

      // Mostrar si es del doctor O si está sin asignar y es de su especialidad
      return esDeEsteDoctor || (sinDoctorAsignado && mismaEspecialidad);
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
      {/* Filtro de fecha + Crear Cita */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#F0F9FF', padding: '1rem', borderRadius: '8px', flexWrap: 'wrap' }}>
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
        {(user?.role === "Administrador" || user?.role === "Recepcion" || user?.role === "Doctor") && (
          <Button
            size="sm"
            style={{ marginLeft: 'auto', background: '#0C4A6E', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowNewAppointment(true)}
          >
            <CalendarPlus size={15} />
            Crear Cita
          </Button>
        )}
      </div>

      {/* Modal Editar Cita */}
      {editingAppt && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
          <div style={{ background:'white', borderRadius:'14px', padding:'24px', width:'100%', maxWidth:'480px', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <h3 style={{ margin:0, fontSize:'16px', fontWeight:'700', color:'#0C4A6E' }}>✏️ Editar Cita</h3>
              <button onClick={() => setEditingAppt(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:'#9CA3AF' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
              {[
                { key:'nombre_completo', label:'Nombre', full:true, placeholder:'Nombre del paciente' },
                { key:'cedula', label:'Cédula', placeholder:'0000000000' },
                { key:'telefono', label:'Teléfono', placeholder:'09XXXXXXXX' },
                { key:'email', label:'Correo electrónico', full:true, placeholder:'correo@ejemplo.com', type:'email' },
                { key:'fecha', label:'Fecha', type:'date' },
                { key:'hora', label:'Hora', type:'time' },
                { key:'doctor_nombre', label:'Doctor', placeholder:'Nombre del doctor' },
                { key:'motivo', label:'Motivo', full:true, placeholder:'Motivo de consulta' },
              ].map(({ key, label, full, placeholder, type }) => (
                <div key={key} style={full ? { gridColumn:'1/-1' } : {}}>
                  <label style={{ fontSize:'12px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'4px' }}>{label}</label>
                  <input
                    type={type || 'text'}
                    value={editApptForm[key] || ''}
                    onChange={e => setEditApptForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #BFDBFE', borderRadius:'8px', fontSize:'13px', boxSizing:'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize:'12px', fontWeight:'600', color:'#374151', display:'block', marginBottom:'4px' }}>Estado</label>
                <select value={editApptForm.estado || ''} onChange={e => setEditApptForm(f => ({ ...f, estado: e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #BFDBFE', borderRadius:'8px', fontSize:'13px', boxSizing:'border-box' }}>
                  {['Programada','En Atención','Pendiente de Pago','Atendido','Anulada'].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={handleSaveEditAppt} disabled={savingEdit}
                style={{ flex:1, padding:'11px', background: savingEdit ? '#93C5FD' : '#0C4A6E', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'700', cursor: savingEdit ? 'not-allowed' : 'pointer' }}>
                {savingEdit ? 'Guardando...' : '✓ Guardar Cambios'}
              </button>
              <button onClick={() => setEditingAppt(null)}
                style={{ padding:'11px 16px', background:'#F3F4F6', color:'#374151', border:'none', borderRadius:'8px', fontSize:'13px', cursor:'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <NuevaCitaModal
        isOpen={showNewAppointment}
        onClose={() => setShowNewAppointment(false)}
        onSuccess={fetchData}
        token={token}
        user={user}
        fromPatient={false}
      />

      {/* Modal ficha clínica post-cita — recepción completa datos después de agendar */}
      {fichaAppt && (
        <FichaPostCitaModal
          appointment={fichaAppt}
          token={token}
          onClose={() => setFichaAppt(null)}
          onSuccess={() => { setFichaAppt(null); fetchData(); }}
        />
      )}

      <div className="table-container">
        {/* Vista tabla  escritorio y tablet */}
        <table className="data-table" style={{ display:"var(--table-display, table)" }}>
          <thead>
            <tr>
              <th>Estado</th>
              <th>Paciente</th>
              <th className="col-opcional">Cédula</th>
              <th className="col-opcional">Edad</th>
              <th className="col-opcional">Teléfono</th>
              <th>Especialidad</th>
              <th className="col-opcional">Doctor</th>
              <th>Fecha</th>
              <th className="col-opcional">Hora</th>
              <th className="actions-column">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sortedAppointments.map((appointment) => (
              <tr key={appointment.id} data-testid={'appointment-row-' + appointment.id + ''}>
                <td>
                  <span className={'status-badge status-' + (appointment.estado || 'Programada').toLowerCase().replace(/ /g, '-') + ''}>
                    {appointment.estado || "Programada"}
                  </span>
                </td>
                <td><strong>{appointment.nombre_completo}</strong></td>
                <td className="col-opcional">{appointment.cedula}</td>
                <td className="col-opcional">{appointment.edad}</td>
                <td className="col-opcional">
                  <div className="phone-cell">
                    {appointment.telefono}
                    <Button size="sm" variant="ghost" onClick={() => openWhatsApp(appointment.telefono)} className="whatsapp-button" data-testid={'whatsapp-' + appointment.id + ''}>
                      <Phone className="whatsapp-icon" />
                    </Button>
                  </div>
                </td>
                <td><span className="badge">{appointment.especialidad}</span></td>
                <td className="col-opcional">{appointment.doctor_nombre || <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '12px' }}>Sin asignar</span>}</td>
                <td>{appointment.fecha}</td>
                <td className="col-opcional">{appointment.hora}</td>
                <td className="actions-cell">
                  {(appointment.estado === "Programada" || appointment.estado === "En Atención" || !appointment.estado) && user?.role === "Doctor" && (
                    <Button size="sm" variant="default" onClick={() => handleStartAttention(appointment)} className="attention-button" data-testid={`start-attention-${appointment.id}`}>
                      <Play className="button-icon" size={14} />
                      {appointment.estado === "En Atención"
                        ? "Continuar"
                        : (!appointment.doctor_id || appointment.doctor_id === "") ? "Tomar cita" : "Atender"}
                    </Button>
                  )}
                  {ENABLE_DENTAL_V2 && appointment.especialidad === "Odontología" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = '/odontologia-v2/' + appointment.id + ''}
                      className="ml-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      Workspace V2
                    </Button>
                  )}
                  {appointment.estado === "Pendiente de Pago" && user?.role === "Doctor" && (
                    <Button size="sm" variant="outline" onClick={() => handleStartAttention(appointment)} className="resume-button" data-testid={'resume-attention-' + appointment.id + ''} title="Reanudar para completar historia clínica">
                      <Play className="button-icon" size={14} />
                      Reanudar
                    </Button>
                  )}
                  {(appointment.estado === "Programada" || !appointment.estado) &&
                    (user?.role === "Recepcion" || user?.role === "Administrador") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFichaAppt(appointment)}
                      style={{ fontSize: "12px", borderColor: "#BFDBFE", color: "#1E40AF" }}
                      title="Completar ficha clínica previa"
                    >
                      📋 Ficha
                    </Button>
                  )}
                  {(appointment.estado === "En Atención" || appointment.estado === "Atendido" || appointment.estado === "Pendiente de Pago") &&
                    (user?.role === "Doctor" || user?.role === "Administrador") && (
                    <DocumentosClinicosPanel
                      appointment={appointment}
                      token={token}
                      compact={true}
                    />
                  )}
                  {appointment.estado === "Pendiente de Pago" && user?.role === "Recepcion" && (
                    <Button size="sm" variant="default" onClick={() => handleOpenPaymentModal(appointment)} className="payment-button">
                      <Check className="button-icon" size={14} />
                      Cobrar
                    </Button>
                  )}
                  {appointment.estado !== "En Atención" && (
                    <>
                      {(user?.role === "Administrador" || user?.role === "Recepcion" ||
                        (user?.role === "Doctor" && appointment.doctor_id === user?.doctor_id)) && (
                        <Button variant="ghost" size="sm" onClick={() => handleEditAppt(appointment)} data-testid={'edit-appointment-' + appointment.id + ''}>
                          <Edit className="action-icon" />
                        </Button>
                      )}
                      {(user?.role === "Administrador" || user?.role === "Recepcion") && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteAppt(appointment.id)} data-testid={'delete-appointment-' + appointment.id + ''}>
                          <Trash2 className="action-icon delete-icon" />
                        </Button>
                      )}
                    </>
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {sortedAppointments.length === 0 && (
        <div className="empty-state">
          <p>No hay citas {user?.role === "Doctor" ? "asignadas" : "registradas"}</p>
        </div>
      )}
    </>
  );

  // Si est en modo atención, mostrar la vista correspondiente
  if (vistaAtencion && selectedAppointment) {
    // Para otras especialidades: Formulario en vista amplia
    return (
      <div className="vista-atencion-formulario">
        <div className="atencion-header" style={{ position:"sticky", top:0, zIndex:50 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setVistaAtencion(false);
                setSelectedAppointment(null);
              }}
              style={{ color:"white", border:"1px solid rgba(255,255,255,0.3)", flexShrink:0 }}
            >
              <ArrowLeft size={16} />
              <span style={{ display:"var(--back-text-display, inline)" }}>Volver</span>
            </Button>
            <div className="atencion-titulo" style={{ flex:1, minWidth:0 }}>
              <h2 style={{ fontSize:"clamp(0.9rem, 3vw, 1.4rem)", margin:0 }}>
                 {selectedAppointment.especialidad}  {selectedAppointment.nombre_completo}
              </h2>
              <div className="patient-info-inline" style={{ flexWrap:"wrap", gap:"0.5rem", marginTop:"2px" }}>
                <span style={{ fontSize:"clamp(0.72rem, 2.5vw, 0.9rem)" }}>
                  <strong>Cédula:</strong> {selectedAppointment.cedula}
                </span>
                {selectedAppointment.fecha_nacimiento ? (
                  <span style={{ fontSize:"clamp(0.72rem, 2.5vw, 0.9rem)" }}>
                    <strong>Edad:</strong> {(() => {
                      const hoy = new Date();
                      const nac = new Date(selectedAppointment.fecha_nacimiento + "T12:00:00");
                      let edad = hoy.getFullYear() - nac.getFullYear();
                      if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
                      return '' + edad + ' años';
                    })()}
                  </span>
                ) : selectedAppointment.edad > 0 ? (
                  <span style={{ fontSize:"clamp(0.72rem, 2.5vw, 0.9rem)" }}>
                    <strong>Edad:</strong> {selectedAppointment.edad} años
                  </span>
                ) : null}
                {selectedAppointment.telefono && (
                  <span style={{ fontSize:"clamp(0.72rem, 2.5vw, 0.9rem)" }}>
                    <strong>Tel:</strong> {selectedAppointment.telefono}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="atencion-contenido">
          {/* ── Router de especialidades — usa normalizeEspecialidad para compatibilidad legacy ── */}
          {(() => {
            const esp = normalizeSpecialty(selectedAppointment.especialidad);
            const closeProps = {
              appointment: selectedAppointment,
              token,
              onClose: () => { setVistaAtencion(false); setSelectedAppointment(null); },
              onSuccess: handleAttentionSuccess,
            };
            if (esp === "Medicina General") return <MedicinaGeneralForm {...closeProps} />;
            if (esp === "Odontología")      return (
              <OdontogramaClinicoTab
                token={token}
                pacienteId={closeProps.appointment?.paciente_id || closeProps.appointment?.id}
                pacienteNombre={closeProps.appointment?.nombre_completo || closeProps.appointment?.nombre}
                pacienteCedula={closeProps.appointment?.cedula}
                doctorId={closeProps.appointment?.doctor_id}
                appointment={closeProps.appointment}
                onClose={closeProps.onClose}
                onOdontogramaLoaded={() => {}}
              />
            );
            if (esp === "Pediatría")        return <PediatriaForm {...closeProps} />;
            if (esp === "Nutrición")        return <NutricionForm {...closeProps} />;
            if (esp === "Ecografía")        return <EcografiaForm {...closeProps} />;
            if (["Ginecología","Ginecología/Obstetricia","Obstetricia"].includes(esp))
              return <GinecologiaForm {...closeProps} />;
            // Fallback — especialidad no mapeada
            return (
              <div style={{padding: '2rem', textAlign: 'center'}}>
                <p>Historia clínica de <strong>{selectedAppointment.especialidad}</strong> próximamente.</p>
                <p style={{marginTop: '1rem', color: '#64748B'}}>
                  Disponibles: Medicina General, Pediatría, Odontología, Nutrición, Ginecología y Ecografía.
                </p>
                <Button 
                  onClick={() => { setVistaAtencion(false); setSelectedAppointment(null); }}
                  style={{marginTop: '1.5rem'}}
                >
                  Volver
                </Button>
              </div>
            );
          })()}
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
                <h3 style={{ color:"white", margin:0, fontSize:"16px", fontWeight:"700" }}>Saldo Cobro de Consulta</h3>
                <p style={{ color:"rgba(255,255,255,0.8)", margin:"2px 0 0", fontSize:"12px" }}>
                  {consultaFinanciera.paciente_nombre}  {consultaFinanciera.paciente_cedula}
                </p>
              </div>
              <button onClick={() => { setShowPaymentModal(false); setConsultaFinanciera(null); setSelectedAppointmentForPayment(null); }}
                style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"white", borderRadius:"50%", width:"28px", height:"28px", cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>

              </button>
            </div>

            <div style={{ padding:"20px" }}>

              {/* Desglose de servicios */}
              <div style={{ marginBottom:"16px" }}>
                <p style={{ fontSize:"12px", fontWeight:"700", color:"#005f73", marginBottom:"8px", textTransform:"uppercase" }}>
                   Detalle de Servicios
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
                      Consulta  {consultaFinanciera.especialidad}
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen de totales  dinmico con descuento */}
              {(() => {
                const descuento = parseFloat(paymentForm.descuento) || 0;
                const totalOriginal = consultaFinanciera.total || 0;
                const yaPagado = consultaFinanciera.total_pagado || 0;
                const saldoConDesc = Math.max(0, (consultaFinanciera.saldo || 0) - descuento);
                return (
                  <div style={{ background:"#f8fdff", borderRadius:"8px", padding:"12px", marginBottom:"12px", border:"1.5px solid #00a8cc" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px", fontSize:"13px", color:"#555" }}>
                      <span>Total consulta:</span>
                      <span style={{ fontWeight:"700" }}>${totalOriginal.toFixed(2)}</span>
                    </div>
                    {yaPagado > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px", fontSize:"13px", color:"#059669" }}>
                        <span>Ya pagado:</span>
                        <span style={{ fontWeight:"700" }}>${yaPagado.toFixed(2)}</span>
                      </div>
                    )}
                    {descuento > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px", fontSize:"13px", color:"#d97706" }}>
                        <span> Descuento:</span>
                        <span style={{ fontWeight:"700" }}>${descuento.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:"17px", fontWeight:"800", color: descuento > 0 ? "#059669" : "#00a8cc", borderTop:"1px solid #b2ebf2", paddingTop:"8px", marginTop:"4px" }}>
                      <span>TOTAL A COBRAR:</span>
                      <span>${saldoConDesc.toFixed(2)}</span>
                    </div>
                    {descuento > 0 && (
                      <p style={{ margin:"4px 0 0", fontSize:"10px", color:"#d97706", textAlign:"right" }}>
                        Ahorro: ${descuento.toFixed(2)} ({totalOriginal > 0 ? ((descuento/totalOriginal)*100).toFixed(0) : 0}%)
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Descuento opcional */}
              <div style={{ background:"#fffbeb", border:"1.5px solid #fde68a", borderRadius:"8px", padding:"10px 12px", marginBottom:"12px" }}>
                <p style={{ margin:"0 0 8px", fontSize:"12px", fontWeight:"700", color:"#92400e" }}> Descuento (opcional)</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                  <div>
                    <label style={{ fontSize:"11px", color:"#92400e", fontWeight:"600", display:"block", marginBottom:"3px" }}>Monto descuento $</label>
                    <input type="number" min="0" step="0.50"
                      value={paymentForm.descuento || ""}
                      onChange={e => {
                        const desc = parseFloat(e.target.value) || 0;
                        const saldoConDesc = Math.max(0, (consultaFinanciera.saldo || 0) - desc);
                        setPaymentForm(f => ({ ...f, descuento: desc, monto: saldoConDesc.toFixed(2) }));
                      }}
                      placeholder="0.00"
                      style={{ width:"100%", padding:"7px 10px", border:"1.5px solid #fbbf24", borderRadius:"6px", fontSize:"15px", fontWeight:"700", color:"#92400e", boxSizing:"border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize:"11px", color:"#92400e", fontWeight:"600", display:"block", marginBottom:"3px" }}>Motivo</label>
                    <input type="text"
                      value={paymentForm.motivo_descuento}
                      onChange={e => setPaymentForm(f => ({ ...f, motivo_descuento: e.target.value }))}
                      placeholder="Ej: Paciente conocido, sin recursos..."
                      style={{ width:"100%", padding:"7px 10px", border:"1.5px solid #fbbf24", borderRadius:"6px", fontSize:"12px", boxSizing:"border-box" }}
                    />
                  </div>
                </div>
                <div style={{ display:"flex", gap:"5px", marginTop:"7px", flexWrap:"wrap" }}>
                  {[10, 15, 20, 25, 50].map(pct => {
                    const montoDesc = parseFloat(((consultaFinanciera.saldo || 0) * pct / 100).toFixed(2));
                    return (
                      <button key={pct} type="button"
                        onClick={() => {
                          const saldoConDesc = Math.max(0, (consultaFinanciera.saldo || 0) - montoDesc);
                          setPaymentForm(f => ({ ...f, descuento: montoDesc, monto: saldoConDesc.toFixed(2) }));
                        }}
                        style={{ padding:"3px 8px", background:"white", border:"1px solid #fbbf24", borderRadius:"12px", fontSize:"11px", cursor:"pointer", color:"#92400e", fontWeight:"600" }}>
                        {pct}% (${montoDesc.toFixed(0)})
                      </button>
                    );
                  })}
                  {(parseFloat(paymentForm.descuento) || 0) > 0 && (
                    <button type="button"
                      onClick={() => setPaymentForm(f => ({ ...f, descuento: 0, motivo_descuento: "", monto: (consultaFinanciera.saldo || 0).toFixed(2) }))}
                      style={{ padding:"3px 8px", background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:"12px", fontSize:"11px", cursor:"pointer", color:"#dc2626" }}>
                       Quitar
                    </button>
                  )}
                </div>
              </div>

              {/* Formulario de pago */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"12px" }}>
                <div>
                  <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>
                    Monto a cobrar * {(parseFloat(paymentForm.descuento)||0) > 0 && <span style={{ color:"#059669", fontSize:"11px" }}>(con descuento)</span>}
                  </label>
                  <input type="number" step="0.01"
                    value={paymentForm.monto}
                    onChange={e => setPaymentForm({...paymentForm, monto: e.target.value})}
                    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #00a8cc", borderRadius:"8px", fontSize:"16px", fontWeight:"700", color:"#005f73", boxSizing:"border-box" }}
                  />
                  <p style={{ fontSize:"10px", color:"#999", margin:"2px 0 0" }}>Puede ser abono parcial</p>
                </div>
                <div>
                  <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>Forma de pago *</label>
                  <select value={paymentForm.tipo_pago}
                    onChange={e => setPaymentForm({...paymentForm, tipo_pago: e.target.value})}
                    style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #e5e7eb", borderRadius:"8px", fontSize:"13px", boxSizing:"border-box" }}>
                    <option value="efectivo"> Efectivo</option>
                    <option value="transferencia"> Transferencia</option>
                    <option value="tarjeta"> Tarjeta</option>
                    <option value="seguro"> Seguro</option>
                    <option value="otros"> Otros</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom:"12px" }}>
                <label style={{ fontSize:"12px", fontWeight:"700", color:"#374151", display:"block", marginBottom:"4px" }}>Referencia / N Transaccin</label>
                <input type="text"
                  value={paymentForm.referencia}
                  onChange={e => setPaymentForm({...paymentForm, referencia: e.target.value})}
                  placeholder="Opcional  N de transferencia, voucher..."
                  style={{ width:"100%", padding:"8px 10px", border:"1.5px solid #e5e7eb", borderRadius:"8px", fontSize:"13px", boxSizing:"border-box" }}
                />
              </div>

              {/* Botones */}
              <div style={{ display:"flex", gap:"10px", marginTop:"4px" }}>
                <button onClick={handleRegisterPayment}
                  style={{ flex:1, padding:"12px", background:"linear-gradient(135deg,#00a8cc,#005f73)", color:"white", border:"none", borderRadius:"8px", fontSize:"14px", fontWeight:"700", cursor:"pointer" }}>
                   Cobrar ${parseFloat(paymentForm.monto || 0).toFixed(2)}
                  {(parseFloat(paymentForm.descuento)||0) > 0 && ` (ahorra $${parseFloat(paymentForm.descuento).toFixed(2)})`}
                </button>
                <button onClick={() => { setShowPaymentModal(false); setConsultaFinanciera(null); setSelectedAppointmentForPayment(null); }}
                  style={{ padding:"12px 16px", background:"#f3f4f6", color:"#374151", border:"none", borderRadius:"8px", fontSize:"13px", cursor:"pointer" }}>
                  Cancelar
                </button>
              </div>

              <p style={{ fontSize:"10px", color:"#9ca3af", textAlign:"center", marginTop:"8px" }}>
                El pago quedar registrado en Caja para el cierre del da
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};