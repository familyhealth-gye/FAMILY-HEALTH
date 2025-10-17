import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const MedicalHistoryTab = ({ medicalHistories, appointments, doctors, fetchData, token }) => {
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({
    paciente_id: "",
    doctor_id: "",
    fecha: new Date(),
    motivo_consulta: "",
    antecedentes: "",
    examen_fisico: "",
    diagnostico: "",
    tratamiento: "",
    observaciones: "",
    proxima_cita: ""
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...form,
        fecha: format(form.fecha, "yyyy-MM-dd")
      };

      await axios.post(`${API}/medical-history`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success("Historia clínica registrada");
      setDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      paciente_id: "",
      doctor_id: "",
      fecha: new Date(),
      motivo_consulta: "",
      antecedentes: "",
      examen_fisico: "",
      diagnostico: "",
      tratamiento: "",
      observaciones: "",
      proxima_cita: ""
    });
  };

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Historias Clínicas</h2>
          <p className="section-subtitle">Registro médico de pacientes</p>
        </div>
        <Dialog open={dialog} onOpenChange={(open) => { setDialog(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="add-button">
              <Plus className="button-icon" />
              Nueva Historia
            </Button>
          </DialogTrigger>
          <DialogContent className="dialog-content dialog-wide">
            <DialogHeader>
              <DialogTitle>Registrar Historia Clínica</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <Label>Paciente</Label>
                  <Select value={form.paciente_id} onValueChange={(val) => setForm({...form, paciente_id: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {appointments.map((apt) => (
                        <SelectItem key={apt.id} value={apt.id}>
                          {apt.nombre_completo} - {apt.cedula}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-field">
                  <Label>Doctor</Label>
                  <Select value={form.doctor_id} onValueChange={(val) => setForm({...form, doctor_id: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.nombre} - {doc.especialidad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="form-field full-width">
                  <Label>Motivo de Consulta</Label>
                  <Textarea
                    value={form.motivo_consulta}
                    onChange={(e) => setForm({...form, motivo_consulta: e.target.value})}
                    required
                    rows={2}
                  />
                </div>

                <div className="form-field full-width">
                  <Label>Antecedentes</Label>
                  <Textarea
                    value={form.antecedentes}
                    onChange={(e) => setForm({...form, antecedentes: e.target.value})}
                    rows={2}
                  />
                </div>

                <div className="form-field full-width">
                  <Label>Examen Físico</Label>
                  <Textarea
                    value={form.examen_fisico}
                    onChange={(e) => setForm({...form, examen_fisico: e.target.value})}
                    rows={2}
                  />
                </div>

                <div className="form-field full-width">
                  <Label>Diagnóstico</Label>
                  <Textarea
                    value={form.diagnostico}
                    onChange={(e) => setForm({...form, diagnostico: e.target.value})}
                    required
                    rows={2}
                  />
                </div>

                <div className="form-field full-width">
                  <Label>Tratamiento</Label>
                  <Textarea
                    value={form.tratamiento}
                    onChange={(e) => setForm({...form, tratamiento: e.target.value})}
                    rows={2}
                  />
                </div>

                <div className="form-field full-width">
                  <Label>Observaciones</Label>
                  <Textarea
                    value={form.observaciones}
                    onChange={(e) => setForm({...form, observaciones: e.target.value})}
                    rows={2}
                  />
                </div>

                <div className="form-field">
                  <Label>Próxima Cita</Label>
                  <Input
                    value={form.proxima_cita}
                    onChange={(e) => setForm({...form, proxima_cita: e.target.value})}
                    placeholder="Ej: 1 semana, 15 días..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Historia"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Doctor</th>
              <th>Motivo</th>
              <th>Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {medicalHistories.map((history) => (
              <tr key={history.id}>
                <td>{history.fecha}</td>
                <td>{history.paciente_nombre}</td>
                <td>{history.doctor_nombre}</td>
                <td>{history.motivo_consulta}</td>
                <td>{history.diagnostico}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {medicalHistories.length === 0 && (
          <div className="empty-state">
            <FileText className="empty-icon" />
            <p>No hay historias clínicas registradas</p>
          </div>
        )}
      </div>
    </div>
  );
};
