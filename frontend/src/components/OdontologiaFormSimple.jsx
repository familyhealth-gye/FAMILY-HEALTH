import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { OdontogramaClinicoTab } from "./OdontogramaClinicoTab";

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
  const [loadingData, setLoadingData] = useState(true);
  const [existingHistory, setExistingHistory] = useState(null);
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('caries');
  const [mostrarOdontogramaAvanzado, setMostrarOdontogramaAvanzado] = useState(false);
  
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

  // Cargar historia odontológica existente al montar
  useEffect(() => {
    const loadExistingHistory = async () => {
      if (!appointment?.id) {
        setLoadingData(false);
        return;
      }
      
      try {
        const response = await axios.get(
          `${API}/medical-history/odontology/appointment/${appointment.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data) {
          console.log("=== HISTORIA ODONTOLÓGICA EXISTENTE ===", response.data);
          setExistingHistory(response.data);
          
          // Cargar datos en el formulario
          const history = response.data;
          setForm(prevForm => ({
            ...prevForm,
            motivo_consulta: history.motivo_consulta || "",
            diagnostico: history.diagnostico || "",
            tratamiento_realizado: history.plan_tratamiento || "",
            observaciones: history.observaciones || ""
          }));
          
          toast.info("Historia odontológica cargada - puede continuar editando");
        }
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error("Error cargando historia odontológica:", error);
        }
      }
      setLoadingData(false);
    };
    
    loadExistingHistory();
  }, [appointment?.id, token]);

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
    
    // Validaciones frontend
    if (!form.motivo_consulta.trim()) {
      toast.error("El motivo de consulta es obligatorio");
      return;
    }
    if (!form.diagnostico.trim()) {
      toast.error("El diagnóstico es obligatorio");
      return;
    }
    if (!form.tratamiento_realizado.trim()) {
      toast.error("El tratamiento realizado es obligatorio");
      return;
    }
    
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
        observaciones: form.observaciones || ""
      };

      console.log("=== ENVIANDO ODONTOGRAMA ===");
      await axios.post(`${API}/odontograms`, odontogramData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Guardar o actualizar historia clínica
      const historyData = {
        appointment_id: appointment.id,
        motivo_consulta: form.motivo_consulta,
        diagnostico: form.diagnostico,
        plan_tratamiento: form.tratamiento_realizado,
        medicamentos: form.medicamentos.filter(m => m.nombre).map(m => 
          `${m.nombre} ${m.dosis} ${m.via} - ${m.frecuencia} x ${m.duracion}. ${m.indicaciones}`
        ).join('; ') || "",
        observaciones: form.observaciones || "",
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

      console.log("=== GUARDANDO HISTORIA ODONTOLÓGICA ===");
      console.log("Historia existente:", existingHistory ? "Sí (actualizar)" : "No (crear nueva)");

      if (existingHistory) {
        // ACTUALIZAR historia existente
        await axios.put(
          `${API}/medical-history/odontology/${existingHistory.id}`,
          historyData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Historia odontológica actualizada");
      } else {
        // CREAR nueva historia
        await axios.post(`${API}/medical-history/odontology`, historyData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Historia odontológica guardada");
      }

      // Crear receta si hay medicamentos
      const medsFiltrados = form.medicamentos.filter(m => m.nombre && m.nombre.trim());
      if (medsFiltrados.length > 0) {
        try {
          const recetaData = {
            paciente_id: appointment.id,
            appointment_id: appointment.id,
            especialidad: "Odontología",
            diagnostico: form.diagnostico || "",
            procedimiento_realizado: form.tratamiento_realizado || "",
            medicamentos: medsFiltrados.map(m => ({
              nombre: m.nombre || "",
              dosis: m.dosis || "",
              via: m.via || "",
              frecuencia: m.frecuencia || "",
              duracion: m.duracion || "",
              indicaciones: m.indicaciones || ""
            })),
            indicaciones_generales: medsFiltrados.map(m => m.indicaciones).filter(i => i).join('. ') || "",
            observaciones: form.observaciones || ""
          };

          console.log("=== ENVIANDO RECETA ODONTOLOGÍA ===");
          console.log("Payload:", recetaData);

          await axios.post(`${API}/prescriptions`, recetaData, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          toast.success("Receta creada");
        } catch (recetaError) {
          console.error("Error al crear receta:", recetaError);
          toast.warning("Historia guardada. Error al crear receta: " + (recetaError.response?.data?.detail || "Error desconocido"));
        }
      }

      toast.success("Historia odontológica guardada exitosamente");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("=== ERROR ===");
      console.error("Error completo:", error);
      console.error("Response:", error.response?.data);
      
      const errorMsg = error.response?.data?.detail || 
                       (typeof error.response?.data === 'string' ? error.response.data : null) ||
                       "Error al guardar la historia clínica";
      toast.error(errorMsg);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="section-title-small" style={{ margin: 0 }}>Odontograma</h3>
          <Button
            type="button"
            variant={mostrarOdontogramaAvanzado ? "default" : "outline"}
            size="sm"
            onClick={() => setMostrarOdontogramaAvanzado(!mostrarOdontogramaAvanzado)}
          >
            {mostrarOdontogramaAvanzado ? "Vista Simple" : "Vista Avanzada (FDI)"}
          </Button>
        </div>
        
        {mostrarOdontogramaAvanzado ? (
          /* ODONTOGRAMA CLÍNICO AVANZADO FDI */
          <div style={{ border: '2px solid #BFDBFE', borderRadius: '12px', overflow: 'hidden' }}>
            <OdontogramaClinicoTab
              token={token}
              pacienteId={appointment?.id}
              pacienteNombre={appointment?.nombre_completo}
              pacienteCedula={appointment?.cedula}
              doctorId={appointment?.doctor_id}
            />
          </div>
        ) : (
          /* ODONTOGRAMA SIMPLIFICADO ORIGINAL */
          <>
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
        </div>
      </div>

      {/* Receta Médica */}
      <div className="form-section">
        <h3 className="section-title-small">Receta Médica</h3>
        <div className="medications-list">
          {form.medicamentos.map((med, idx) => (
            <div key={idx} className="medication-item">
              <div className="form-grid">
                <div className="form-field">
                  <Label>Medicamento</Label>
                  <Input
                    value={med.nombre}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[idx].nombre = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Ej: Ibuprofeno"
                  />
                </div>
                <div className="form-field">
                  <Label>Dosis</Label>
                  <Input
                    value={med.dosis}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[idx].dosis = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Ej: 400mg"
                  />
                </div>
                <div className="form-field">
                  <Label>Vía</Label>
                  <Input
                    value={med.via}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[idx].via = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Oral/IV"
                  />
                </div>
                <div className="form-field">
                  <Label>Frecuencia</Label>
                  <Input
                    value={med.frecuencia}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[idx].frecuencia = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Cada 8h"
                  />
                </div>
                <div className="form-field">
                  <Label>Duración</Label>
                  <Input
                    value={med.duracion}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[idx].duracion = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="5 días"
                  />
                </div>
                <div className="form-field full-width">
                  <Label>Indicaciones</Label>
                  <Input
                    value={med.indicaciones}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[idx].indicaciones = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Con alimentos"
                  />
                </div>
              </div>
              {form.medicamentos.length > 1 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const newMeds = form.medicamentos.filter((_, i) => i !== idx);
                    setForm({...form, medicamentos: newMeds});
                  }}
                  style={{ marginTop: '0.5rem' }}
                >
                  Eliminar
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setForm({
                ...form,
                medicamentos: [...form.medicamentos, { nombre: "", dosis: "", via: "", frecuencia: "", duracion: "", indicaciones: "" }]
              });
            }}
            style={{ marginTop: '0.5rem' }}
          >
            + Agregar Medicamento
          </Button>
        </div>
      </div>

      <div className="form-section">
        <div className="form-grid">
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
