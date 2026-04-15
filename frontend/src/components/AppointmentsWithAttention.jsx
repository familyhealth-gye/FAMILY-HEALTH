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
    console.log("=== DEBUG APPOINTMENT ===", {
      id: appointment.id,
      especialidad: appointment.especialidad,
      doctor_id: appointment.doctor_id,
      estado: appointment.estado
    });
    
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
      await axios.put(
        `${API}/appointments/${appointment.id}`,
        { estado: "En Atención" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSelectedAppointment(appointment);
      
      // Para Odontología, abrir vista completa de historia clínica
      if (appointment.especialidad === "Odontología") {
        setModoAtencion("historia");
      } else {
        setModoAtencion("formulario");
      }
      
      setVistaAtencion(true);
      await fetchData();
    } catch (error) {
      console.error("Error al iniciar atención:", error);
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
      // Buscar consulta financiera asociada a esta cita por paciente_cedula
      const response = await axios.get(
        `${API}/financial/reportes/pendientes`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Buscar la consulta financiera de este paciente
      const consulta = response.data.consultas?.find(
        c => c.paciente_cedula === appointment.cedula || 
             c.paciente_cedula === appointment.paciente_cedula
      );
      
      if (!consulta) {
        toast.error("No se encontró consulta financiera para esta cita. El doctor debe cerrar la consulta primero.");
        return;
      }
      
      // Setear la consulta financiera y el appointment
      setConsultaFinanciera(consulta);
      setSelectedAppointmentForPayment(appointment);
      setPaymentForm({
        monto: consulta.saldo.toString(),
        tipo_pago: 'efectivo',
        referencia: '',
        notas: ''
      });
      setShowPaymentModal(true);
      
    } catch (error) {
      console.error("Error buscando consulta financiera:", error);
      toast.error("Error al buscar información de pago");
    }
  };

  // Función para registrar el pago
  const handleRegisterPayment = async () => {
    try {
      if (!consultaFinanciera || !paymentForm.monto || parseFloat(paymentForm.monto) <= 0) {
        toast.error("Ingrese un monto válido");
        return;
      }

      // Registrar el pago en la consulta financiera
      const response = await axios.post(
        `${API}/financial/consultas/${consultaFinanciera.id}/pagos`,
        {
          fecha: new Date().toISOString().split('T')[0],
          monto: parseFloat(paymentForm.monto),
          tipo_pago: paymentForm.tipo_pago,
          referencia: paymentForm.referencia,
          notas: paymentForm.notas
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Si el saldo quedó en 0, actualizar el estado de la cita a "Pagada"
      if (response.data.saldo === 0) {
        await axios.put(
          `${API}/appointments/${selectedAppointmentForPayment.id}`,
          { estado: "Pagada" },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Pago registrado - Cita marcada como pagada");
      } else {
        toast.success(`Pago registrado - Saldo restante: $${response.data.saldo.toFixed(2)}`);
      }

      // Cerrar modal y refrescar datos
      setShowPaymentModal(false);
      setConsultaFinanciera(null);
      setSelectedAppointmentForPayment(null);
      fetchData();

    } catch (error) {
      console.error("Error registrando pago:", error);
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
    // Para Odontología: Vista completa de Historia Clínica con Odontograma FDI
    if (modoAtencion === "historia" || selectedAppointment.especialidad === "Odontología") {
      return (
        <div className="vista-atencion-completa">
          <HistoriaClinicaCompleta
            paciente={{
              id: selectedAppointment.id,
              cedula: selectedAppointment.cedula,
              nombre_completo: selectedAppointment.nombre_completo,
              nombre: selectedAppointment.nombre_completo,
              edad: selectedAppointment.edad,
              telefono: selectedAppointment.telefono
            }}
            token={token}
            user={user}
            onBack={() => {
              setVistaAtencion(false);
              setSelectedAppointment(null);
            }}
            especialidad={selectedAppointment.especialidad}
          />
          
          {/* Panel flotante para cerrar consulta */}
          <div className="panel-cerrar-consulta">
            <div className="panel-info">
              <span>Paciente: <strong>{selectedAppointment.nombre_completo}</strong></span>
              <span>Especialidad: <strong>{selectedAppointment.especialidad}</strong></span>
            </div>
            <Button 
              onClick={handleAttentionSuccess}
              className="btn-cerrar-consulta"
            >
              <Check size={16} />
              Cerrar Consulta
            </Button>
          </div>
        </div>
      );
    }
    
    // Para otras especialidades: Formulario tradicional en vista amplia
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
          
          {!["Medicina General", "Pediatría", "Odontología"].includes(selectedAppointment.especialidad) && (
            <div style={{padding: '2rem', textAlign: 'center'}}>
              <p>Historia clínica de {selectedAppointment.especialidad} aún no implementada.</p>
              <p style={{marginTop: '1rem', color: '#64748B'}}>
                Por ahora están disponibles Medicina General, Pediatría y Odontología.
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Registrar Pago
              </h3>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setConsultaFinanciera(null);
                  setSelectedAppointmentForPayment(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Información del paciente */}
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Paciente:</p>
                <p className="font-semibold text-gray-800">{consultaFinanciera.paciente_nombre}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Total: <span className="font-bold text-gray-900">${consultaFinanciera.total.toFixed(2)}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Pagado: <span className="font-bold text-green-600">${consultaFinanciera.total_pagado.toFixed(2)}</span>
                </p>
                <p className="text-sm text-gray-600">
                  Saldo pendiente: <span className="font-bold text-red-600">${consultaFinanciera.saldo.toFixed(2)}</span>
                </p>
              </div>

              {/* Monto del Pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto del Pago *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.monto}
                  onChange={(e) => setPaymentForm({...paymentForm, monto: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              {/* Tipo de Pago */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Pago *
                </label>
                <select
                  value={paymentForm.tipo_pago}
                  onChange={(e) => setPaymentForm({...paymentForm, tipo_pago: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="seguro">Seguro</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              {/* Referencia */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia/Nº Transacción
                </label>
                <input
                  type="text"
                  value={paymentForm.referencia}
                  onChange={(e) => setPaymentForm({...paymentForm, referencia: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={paymentForm.notas}
                  onChange={(e) => setPaymentForm({...paymentForm, notas: e.target.value})}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas adicionales..."
                />
              </div>

              {/* Botones */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleRegisterPayment}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Registrar Pago
                </button>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setConsultaFinanciera(null);
                    setSelectedAppointmentForPayment(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
