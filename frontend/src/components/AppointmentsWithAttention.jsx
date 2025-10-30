import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Phone, Edit, Trash2, Play, Check } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { MedicinaGeneralForm } from "./MedicinaGeneralForm";
import { PediatriaForm } from "./PediatriaForm";
import { OdontologiaForm } from "./OdontologiaForm";

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
  const [attentionDialog, setAttentionDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  const handleStartAttention = async (appointment) => {
    try {
      // Update appointment status to "En Atención"
      await axios.put(
        `${API}/appointments/${appointment.id}`,
        { estado: "En Atención" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSelectedAppointment(appointment);
      setAttentionDialog(true);
      await fetchData();
    } catch (error) {
      toast.error("Error al iniciar atención");
    }
  };

  const handleAttentionSuccess = async () => {
    setAttentionDialog(false);
    setSelectedAppointment(null);
    await fetchData();
    toast.success("Consulta terminada - Cita pendiente de pago");
  };

  // Filter appointments by doctor if user is a doctor
  const visibleAppointments = user?.role === "Doctor" && user?.doctor_id
    ? filteredAppointments.filter(apt => apt.doctor_id === user.doctor_id)
    : filteredAppointments;

  // Sort by estado priority
  const sortedAppointments = [...visibleAppointments].sort((a, b) => {
    const priority = { "Programada": 1, "En Atención": 0, "Pendiente de Pago": 2, "Pagada": 3, "Cancelada": 4 };
    return priority[a.estado || "Programada"] - priority[b.estado || "Programada"];
  });

  return (
    <>
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
                {(appointment.estado === "Programada" || !appointment.estado) && user?.role === "Doctor" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleStartAttention(appointment)}
                    className="attention-button"
                    data-testid={`start-attention-${appointment.id}`}
                  >
                    <Play className="button-icon" size={14} />
                    Atender
                  </Button>
                )}
                
                {appointment.estado === "Pendiente de Pago" && user?.role === "Recepcion" && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={async () => {
                      try {
                        await axios.put(
                          `${API}/appointments/${appointment.id}`,
                          { estado: "Pagada" },
                          { headers: { Authorization: `Bearer ${token}` } }
                        );
                        toast.success("Pago registrado");
                        fetchData();
                      } catch (error) {
                        toast.error("Error al registrar pago");
                      }
                    }}
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

      {/* Attention Dialog */}
      <Dialog open={attentionDialog} onOpenChange={setAttentionDialog}>
        <DialogContent className="dialog-content dialog-wide dialog-scrollable">
          <DialogHeader>
            <DialogTitle>
              Atención Médica - {selectedAppointment?.especialidad}
            </DialogTitle>
            <div className="patient-info-header">
              <p><strong>Paciente:</strong> {selectedAppointment?.nombre_completo}</p>
              <p><strong>Edad:</strong> {selectedAppointment?.edad} años</p>
              <p><strong>Cédula:</strong> {selectedAppointment?.cedula}</p>
            </div>
          </DialogHeader>
          
          {selectedAppointment && (
            <>
              {(selectedAppointment.especialidad === "Medicina General") && (
                <MedicinaGeneralForm
                  appointment={selectedAppointment}
                  token={token}
                  onClose={() => setAttentionDialog(false)}
                  onSuccess={handleAttentionSuccess}
                />
              )}
              
              {selectedAppointment.especialidad === "Pediatría" && (
                <PediatriaForm
                  appointment={selectedAppointment}
                  token={token}
                  onClose={() => setAttentionDialog(false)}
                  onSuccess={handleAttentionSuccess}
                />
              )}
              
              {!["Medicina General", "Pediatría"].includes(selectedAppointment.especialidad) && (
                <div style={{padding: '2rem', textAlign: 'center'}}>
                  <p>Historia clínica de {selectedAppointment.especialidad} aún no implementada.</p>
                  <p style={{marginTop: '1rem', color: '#64748B'}}>
                    Por ahora solo está disponible Medicina General y Pediatría.
                  </p>
                  <Button 
                    onClick={() => setAttentionDialog(false)} 
                    style={{marginTop: '1.5rem'}}
                  >
                    Cerrar
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
