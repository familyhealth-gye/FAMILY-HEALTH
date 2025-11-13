import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Odontograma simplificado - 32 dientes
const DIENTES_ADULTO = [
  // Superior derecha
  18, 17, 16, 15, 14, 13, 12, 11,
  // Superior izquierda  
  21, 22, 23, 24, 25, 26, 27, 28,
  // Inferior izquierda
  38, 37, 36, 35, 34, 33, 32, 31,
  // Inferior derecha
  41, 42, 43, 44, 45, 46, 47, 48
];

const ESTADOS = [
  { value: 'sano', label: 'Sano', color: '#ffffff' },
  { value: 'caries', label: 'Caries', color: '#DC2626' },
  { value: 'obturacion', label: 'Obturación', color: '#3B82F6' },
  { value: 'corona', label: 'Corona', color: '#F59E0B' },
  { value: 'endodoncia', label: 'Endodoncia', color: '#8B5CF6' },
  { value: 'extraccion', label: 'Extracción', color: '#000000' },
  { value: 'implante', label: 'Implante', color: '#10B981' },
  { value: 'protesis', label: 'Prótesis', color: '#EC4899' }
];

export const OdontologiaFormSimple = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('caries');
  
  // Inicializar dientes con estado sano
  const [dientes, setDientes] = useState(
    DIENTES_ADULTO.reduce((acc, num) => {
      acc[num] = 'sano';
      return acc;
    }, {})
  );

  const [form, setForm] = useState({
    motivo_consulta: "",
    diagnostico: "",
    tratamiento_realizado: "",
    medicamentos: [{ nombre: "", dosis: "", via: "", frecuencia: "", duracion: "", indicaciones: "" }],
    observaciones: ""
  });

  const handleDienteClick = (numero) => {
    setDientes({
      ...dientes,
      [numero]: dientes[numero] === estadoSeleccionado ? 'sano' : estadoSeleccionado
    });
  };

  const getColorDiente = (numero) => {
    const estado = dientes[numero];
    return ESTADOS.find(e => e.value === estado)?.color || '#ffffff';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Preparar datos del odontograma
      const dientesArray = Object.entries(dientes)
        .filter(([_, estado]) => estado !== 'sano')
        .map(([numero, estado]) => ({
          tooth_number: parseInt(numero),
          estado: ESTADOS.find(e => e.value === estado)?.label || 'Sano',
          cara_oclusal: "",
          cara_vestibular: "",
          cara_palatina: "",
          cara_mesial: "",
          cara_distal: "",
          observaciones: ""
        }));

      // Guardar odontograma
      const odontogramData = {
        paciente_id: appointment.id,
        doctor_id: appointment.doctor_id,
        fecha: new Date().toISOString().split('T')[0],
        dientes: dientesArray.length > 0 ? dientesArray : [{ tooth_number: 1, estado: 'Sano' }],
        diagnostico_general: form.diagnostico,
        tratamiento_recomendado: form.tratamiento_realizado,
        observaciones: form.observaciones
      };

      await axios.post(`${API}/odontograms`, odontogramData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Guardar historia clínica simplificada
      const historyData = {
        appointment_id: appointment.id,
        motivo_consulta: form.motivo_consulta,
        diagnostico: form.diagnostico,
        plan_tratamiento: form.tratamiento_realizado,
        medicamentos: form.medicamentos.filter(m => m.nombre).map(m => 
          `${m.nombre} ${m.dosis} ${m.via} - ${m.frecuencia} x ${m.duracion}. ${m.indicaciones}`
        ).join('; '),
        observaciones: form.observaciones,
        dolor_dental: false,
        diabetes: false,
        hipertension: false,
        cardiopatias: false,
        hepatitis: false,
        vih: false,
        epilepsia: false,
        embarazo: false,
        fumador: false,
        bruxismo: false,
        succion_digital: false,
        estado_dental: {
          higiene_oral: "",
          encia: "",
          mucosa_oral: "",
          lengua: "",
          paladar: "",
          atm: ""
        }
      };

      await axios.post(`${API}/medical-history/odontology`, historyData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Crear receta si hay medicamentos
      const medsFiltrados = form.medicamentos.filter(m => m.nombre);
      if (medsFiltrados.length > 0) {
        const recetaData = {
          appointment_id: appointment.id,
          diagnostico: form.diagnostico,
          cie10_codigo: "",
          medications: medsFiltrados.map(m => ({
            nombre: m.nombre,
            dosis: m.dosis,
            via: m.via,
            frecuencia: m.frecuencia,
            duracion: m.duracion
          })),
          indicaciones: medsFiltrados.map(m => m.indicaciones).join('. ')
        };

        await axios.post(`${API}/prescriptions`, recetaData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      toast.success("Historia odontológica guardada exitosamente");
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="medical-history-form">
      {/* Motivo de consulta */}
      <div className="form-section">
        <h3 className="section-title-small">Información de la Consulta</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Motivo de Consulta *</Label>
            <Textarea
              value={form.motivo_consulta}
              onChange={(e) => setForm({...form, motivo_consulta: e.target.value})}
              required
              rows={2}
              placeholder="Ej: Dolor en molar inferior derecho"
            />
          </div>
        </div>
      </div>

      {/* Odontograma Visual Simplificado */}
      <div className="form-section">
        <h3 className="section-title-small">Odontograma - Click en cada diente</h3>
        
        {/* Selector de estado */}
        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#F0F9FF', borderRadius: '8px' }}>
          <Label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            Estado a marcar (click en diente):
          </Label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {ESTADOS.filter(e => e.value !== 'sano').map(estado => (
              <button
                key={estado.value}
                type="button"
                onClick={() => setEstadoSeleccionado(estado.value)}
                style={{
                  padding: '0.5rem 1rem',
                  border: estadoSeleccionado === estado.value ? '2px solid #00a8cc' : '1px solid #CBD5E1',
                  borderRadius: '6px',
                  background: estadoSeleccionado === estado.value ? '#E0F2FE' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: estadoSeleccionado === estado.value ? 600 : 400
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  background: estado.color,
                  border: '1px solid #334155',
                  borderRadius: '3px'
                }} />
                <span>{estado.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Odontograma con todos los dientes */}
        <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '2px solid #BFDBFE' }}>
          
          {/* Superior */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748B', fontWeight: 600 }}>
              ARCADA SUPERIOR
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '0.25rem' }}>
              {/* Superior Derecha 18-11 */}
              {[18, 17, 16, 15, 14, 13, 12, 11].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDienteClick(num)}
                  style={{
                    width: '42px',
                    height: '50px',
                    background: getColorDiente(num),
                    border: '2px solid #334155',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: getColorDiente(num) === '#000000' ? '#fff' : '#000',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={`Diente ${num}`}
                >
                  {num}
                </button>
              ))}
              <div style={{ width: '8px' }} />
              {/* Superior Izquierda 21-28 */}
              {[21, 22, 23, 24, 25, 26, 27, 28].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDienteClick(num)}
                  style={{
                    width: '42px',
                    height: '50px',
                    background: getColorDiente(num),
                    border: '2px solid #334155',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: getColorDiente(num) === '#000000' ? '#fff' : '#000',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={`Diente ${num}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Inferior */}
          <div>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748B', fontWeight: 600 }}>
              ARCADA INFERIOR
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
              {/* Inferior Derecha 48-41 */}
              {[48, 47, 46, 45, 44, 43, 42, 41].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDienteClick(num)}
                  style={{
                    width: '42px',
                    height: '50px',
                    background: getColorDiente(num),
                    border: '2px solid #334155',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: getColorDiente(num) === '#000000' ? '#fff' : '#000',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={`Diente ${num}`}
                >
                  {num}
                </button>
              ))}
              <div style={{ width: '8px' }} />
              {/* Inferior Izquierda 31-38 */}
              {[31, 32, 33, 34, 35, 36, 37, 38].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDienteClick(num)}
                  style={{
                    width: '42px',
                    height: '50px',
                    background: getColorDiente(num),
                    border: '2px solid #334155',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: getColorDiente(num) === '#000000' ? '#fff' : '#000',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title={`Diente ${num}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Diagnóstico y Tratamiento */}
      <div className="form-section">
        <h3 className="section-title-small">Diagnóstico y Tratamiento</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Diagnóstico *</Label>
            <Textarea
              value={form.diagnostico}
              onChange={(e) => setForm({...form, diagnostico: e.target.value})}
              required
              rows={2}
              placeholder="Diagnóstico odontológico"
            />
          </div>
          <div className="form-field full-width">
            <Label>Tratamiento Realizado *</Label>
            <Textarea
              value={form.tratamiento_realizado}
              onChange={(e) => setForm({...form, tratamiento_realizado: e.target.value})}
              required
              rows={2}
              placeholder="Procedimientos realizados"
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
        </div>
      </div>

      <div className="form-actions">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : "Terminar Consulta"}
        </Button>
      </div>
    </form>
  );
};
