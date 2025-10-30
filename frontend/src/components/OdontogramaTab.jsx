import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { Plus, Save, FileText } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Estados posibles de los dientes
const TOOTH_STATES = [
  { value: "Sano", label: "Sano", color: "#ffffff" },
  { value: "Caries", label: "Caries", color: "#DC2626" },
  { value: "Obturación", label: "Obturación", color: "#3B82F6" },
  { value: "Extracción", label: "Extracción", color: "#000000" },
  { value: "Corona", label: "Corona", color: "#F59E0B" },
  { value: "Endodoncia", label: "Endodoncia", color: "#8B5CF6" },
  { value: "Implante", label: "Implante", color: "#10B981" }
];

export const OdontogramaTab = ({ token }) => {
  const [odontogramas, setOdontogramas] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTooth, setSelectedTooth] = useState(null);
  
  // Inicializar 32 dientes
  const initialTeeth = Array.from({ length: 32 }, (_, i) => ({
    tooth_number: i + 1,
    estado: "Sano",
    cara_oclusal: "",
    cara_vestibular: "",
    cara_palatina: "",
    cara_mesial: "",
    cara_distal: "",
    observaciones: ""
  }));

  const [formData, setFormData] = useState({
    paciente_id: "",
    doctor_id: "",
    fecha: new Date().toISOString().split('T')[0],
    dientes: initialTeeth,
    diagnostico_general: "",
    tratamiento_recomendado: "",
    observaciones: ""
  });

  useEffect(() => {
    fetchOdontogramas();
    fetchAppointments();
  }, []);

  const fetchOdontogramas = async () => {
    try {
      const response = await axios.get(`${API}/odontograms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOdontogramas(response.data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar odontogramas");
    }
  };

  const fetchAppointments = async () => {
    try {
      const response = await axios.get(`${API}/appointments`);
      // Filtrar solo citas de odontología
      const odontoAppointments = response.data.filter(
        a => a.especialidad.toLowerCase().includes('odonto')
      );
      setAppointments(odontoAppointments);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToothClick = (toothNumber) => {
    setSelectedTooth(toothNumber);
  };

  const updateToothState = (toothNumber, field, value) => {
    const newTeeth = formData.dientes.map(tooth =>
      tooth.tooth_number === toothNumber
        ? { ...tooth, [field]: value }
        : tooth
    );
    setFormData({ ...formData, dientes: newTeeth });
  };

  const getToothColor = (toothNumber) => {
    const tooth = formData.dientes.find(t => t.tooth_number === toothNumber);
    const state = TOOTH_STATES.find(s => s.value === tooth?.estado);
    return state?.color || "#ffffff";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/odontograms`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Odontograma guardado exitosamente");
      setIsDialogOpen(false);
      resetForm();
      fetchOdontogramas();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Error al guardar odontograma");
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      paciente_id: "",
      doctor_id: "",
      fecha: new Date().toISOString().split('T')[0],
      dientes: initialTeeth,
      diagnostico_general: "",
      tratamiento_recomendado: "",
      observaciones: ""
    });
    setSelectedTooth(null);
  };

  const selectedToothData = selectedTooth 
    ? formData.dientes.find(t => t.tooth_number === selectedTooth)
    : null;

  // Renderizar diente individual
  const renderTooth = (toothNumber) => {
    const color = getToothColor(toothNumber);
    const isSelected = selectedTooth === toothNumber;
    
    return (
      <div
        key={toothNumber}
        onClick={() => handleToothClick(toothNumber)}
        style={{
          width: '40px',
          height: '50px',
          backgroundColor: color,
          border: isSelected ? '3px solid #00a8cc' : '2px solid #334155',
          borderRadius: '5px',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          transition: 'all 0.2s',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: color === '#000000' ? '#ffffff' : '#000000',
          boxShadow: isSelected ? '0 4px 12px rgba(0, 168, 204, 0.4)' : 'none'
        }}
      >
        {toothNumber}
      </div>
    );
  };

  // Renderizar arcada dental
  const renderDentalArch = (start, end, label) => (
    <div style={{ marginBottom: '2rem' }}>
      <h4 style={{ marginBottom: '1rem', color: '#0C4A6E', fontWeight: 600 }}>{label}</h4>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(renderTooth)}
      </div>
    </div>
  );

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Odontogramas</h2>
          <p className="section-subtitle">Registro visual del estado dental de los pacientes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="add-button">
              <Plus className="button-icon" />
              Nuevo Odontograma
            </Button>
          </DialogTrigger>
          <DialogContent className="dialog-scrollable max-w-5xl">
            <DialogHeader>
              <DialogTitle>Nuevo Odontograma Dental</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-grid">
                <div className="form-field">
                  <Label>Paciente (Cita) *</Label>
                  <Select
                    value={formData.paciente_id}
                    onValueChange={(val) => {
                      const appointment = appointments.find(a => a.id === val);
                      setFormData({
                        ...formData,
                        paciente_id: val,
                        doctor_id: appointment?.doctor_id || ""
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {appointments.map((appointment) => (
                        <SelectItem key={appointment.id} value={appointment.id}>
                          {appointment.nombre_completo} - {appointment.cedula}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-field">
                  <Label>Fecha *</Label>
                  <Input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                    required
                  />
                </div>
              </div>

              {/* Leyenda de colores */}
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px' }}>
                <Label style={{ display: 'block', marginBottom: '0.5rem' }}>Leyenda de Estados:</Label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {TOOTH_STATES.map(state => (
                    <div key={state.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: state.color,
                        border: '1px solid #334155',
                        borderRadius: '4px'
                      }} />
                      <span style={{ fontSize: '0.875rem' }}>{state.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Odontograma visual */}
              <div style={{ background: '#F0F9FF', padding: '1.5rem', borderRadius: '12px', border: '2px solid #BFDBFE' }}>
                <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#00a8cc', fontWeight: 700 }}>
                  Mapa Dental Interactivo
                </h3>
                
                {/* Arcada superior derecha (18-11) */}
                {renderDentalArch(18, 11, "Arcada Superior Derecha")}
                
                {/* Arcada superior izquierda (21-28) */}
                {renderDentalArch(21, 28, "Arcada Superior Izquierda")}
                
                {/* Arcada inferior derecha (48-41) */}
                {renderDentalArch(48, 41, "Arcada Inferior Derecha")}
                
                {/* Arcada inferior izquierda (31-38) */}
                {renderDentalArch(31, 38, "Arcada Inferior Izquierda")}
              </div>

              {/* Detalles del diente seleccionado */}
              {selectedToothData && (
                <div style={{ background: '#E0F2FE', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ marginBottom: '1rem', color: '#0C4A6E', fontWeight: 600 }}>
                    Diente #{selectedToothData.tooth_number} - Detalles
                  </h4>
                  <div className="form-grid">
                    <div className="form-field">
                      <Label>Estado General</Label>
                      <Select
                        value={selectedToothData.estado}
                        onValueChange={(val) => updateToothState(selectedToothData.tooth_number, 'estado', val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TOOTH_STATES.map(state => (
                            <SelectItem key={state.value} value={state.value}>
                              {state.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="form-field">
                      <Label>Cara Oclusal</Label>
                      <Input
                        value={selectedToothData.cara_oclusal}
                        onChange={(e) => updateToothState(selectedToothData.tooth_number, 'cara_oclusal', e.target.value)}
                        placeholder="Estado de la cara oclusal"
                      />
                    </div>
                    <div className="form-field">
                      <Label>Cara Vestibular</Label>
                      <Input
                        value={selectedToothData.cara_vestibular}
                        onChange={(e) => updateToothState(selectedToothData.tooth_number, 'cara_vestibular', e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <Label>Cara Palatina</Label>
                      <Input
                        value={selectedToothData.cara_palatina}
                        onChange={(e) => updateToothState(selectedToothData.tooth_number, 'cara_palatina', e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <Label>Cara Mesial</Label>
                      <Input
                        value={selectedToothData.cara_mesial}
                        onChange={(e) => updateToothState(selectedToothData.tooth_number, 'cara_mesial', e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <Label>Cara Distal</Label>
                      <Input
                        value={selectedToothData.cara_distal}
                        onChange={(e) => updateToothState(selectedToothData.tooth_number, 'cara_distal', e.target.value)}
                      />
                    </div>
                    <div className="form-field full-width">
                      <Label>Observaciones del Diente</Label>
                      <Textarea
                        value={selectedToothData.observaciones}
                        onChange={(e) => updateToothState(selectedToothData.tooth_number, 'observaciones', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnóstico y tratamiento general */}
              <div className="form-grid">
                <div className="form-field full-width">
                  <Label>Diagnóstico General</Label>
                  <Textarea
                    value={formData.diagnostico_general}
                    onChange={(e) => setFormData({...formData, diagnostico_general: e.target.value})}
                    rows={2}
                    placeholder="Resumen del estado dental general del paciente"
                  />
                </div>
                <div className="form-field full-width">
                  <Label>Tratamiento Recomendado</Label>
                  <Textarea
                    value={formData.tratamiento_recomendado}
                    onChange={(e) => setFormData({...formData, tratamiento_recomendado: e.target.value})}
                    rows={3}
                    placeholder="Plan de tratamiento sugerido"
                  />
                </div>
                <div className="form-field full-width">
                  <Label>Observaciones Generales</Label>
                  <Textarea
                    value={formData.observaciones}
                    onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                    rows={2}
                  />
                </div>
              </div>

              <div className="form-actions">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  <Save className="button-icon" />
                  {loading ? "Guardando..." : "Guardar Odontograma"}
                </Button>
              </div>
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
              <th>Cédula</th>
              <th>Doctor</th>
              <th>Diagnóstico</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {odontogramas.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  <FileText className="empty-icon" />
                  <p>No hay odontogramas registrados</p>
                </td>
              </tr>
            ) : (
              odontogramas.map((odontograma) => (
                <tr key={odontograma.id}>
                  <td>{odontograma.fecha}</td>
                  <td>{odontograma.paciente_nombre}</td>
                  <td>{odontograma.paciente_cedula}</td>
                  <td>{odontograma.doctor_nombre}</td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {odontograma.diagnostico_general || "Sin diagnóstico"}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm">
                      Ver Detalles
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
