import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const MedicinaGeneralForm = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    motivo_consulta: "",
    enfermedad_actual: "",
    antecedentes_familiares: "",
    padre_vivo: true,
    padre_causa_muerte: "",
    madre_vivo: true,
    madre_causa_muerte: "",
    hermanos_vivos: 0,
    ant_hta: false,
    ant_diabetes: false,
    ant_tbc: false,
    ant_cancer: false,
    ant_hepatopatias: false,
    ant_nefropatias: false,
    ant_mentales: false,
    ant_endocrinas: false,
    ant_epilepsia: false,
    ant_asma: false,
    ant_hematologicas: false,
    otras_patologias: "",
    alergias: "",
    quirurgicos: "",
    traumatismos: "",
    hospitalizaciones: "",
    transfusiones: false,
    tabaco: "",
    alcohol: "",
    drogas: "",
    sueno: "",
    apetito: "",
    defecacion: "",
    micciones: "",
    menarquia: null,
    menopausia: null,
    partos: null,
    abortos: null,
    cesareas: null,
    metodo_anticonceptivo: "",
    signos_vitales: {
      peso: null,
      talla: null,
      temperatura: null,
      presion_arterial: "",
      frecuencia_cardiaca: null,
      frecuencia_respiratoria: null,
      saturacion_oxigeno: null
    },
    impresion_general: "",
    piel: "",
    cabeza: "",
    orl: "",
    cuello: "",
    torax: "",
    cardiovascular: "",
    pulmonar: "",
    abdomen: "",
    extremidades: "",
    neurologico: "",
    laboratorios: "",
    diagnostico: "",
    cie10_codigo: "",
    medicamentos: [{nombre: '', dosis: '', frecuencia: '', duracion: '', indicaciones: ''}],
    indicaciones_generales: "",
    observaciones: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones frontend - solo campos esenciales
    if (!form.motivo_consulta.trim()) {
      toast.error("El motivo de consulta es obligatorio");
      return;
    }
    if (!form.enfermedad_actual.trim()) {
      toast.error("La enfermedad actual es obligatoria");
      return;
    }
    if (!form.diagnostico.trim()) {
      toast.error("El diagnóstico es obligatorio");
      return;
    }
    
    setLoading(true);
    let consultaCerrada = false;

    try {
      // 1. Guardar historia clínica (obligatorio)
      const historyData = { ...form, appointment_id: appointment.id };
      delete historyData.medicamentos;
      delete historyData.indicaciones_generales;
      
      const planTratamiento = form.medicamentos
        .filter(m => m.nombre && m.nombre.trim())
        .map((m, i) => `${i + 1}. ${m.nombre} ${m.dosis || ''} - ${m.frecuencia || ''} por ${m.duracion || ''}`)
        .join('\n');
      
      historyData.plan_tratamiento = planTratamiento || "Sin medicamentos prescritos";

      console.log("=== GUARDANDO HISTORIA CLÍNICA ===");
      await axios.post(
        `${API}/medical-history/general`,
        historyData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      consultaCerrada = true;
      toast.success("Historia clínica guardada");

      // 2. Crear receta SOLO si hay medicamentos (opcional)
      const medicamentosFiltrados = form.medicamentos.filter(m => m.nombre && m.nombre.trim());
      
      if (medicamentosFiltrados.length > 0) {
        try {
          const prescriptionData = {
            paciente_id: appointment.id,
            appointment_id: appointment.id,
            doctor_id: appointment.doctor_id || "",
            fecha: new Date().toISOString().split('T')[0],
            diagnostico: form.diagnostico || "",
            cie10_codigo: form.cie10_codigo || "",
            cie10_descripcion: "",
            medicamentos: medicamentosFiltrados.map(m => ({
              nombre: m.nombre || "",
              dosis: m.dosis || "",
              frecuencia: m.frecuencia || "",
              duracion: m.duracion || "",
              via: m.via || "",
              indicaciones: m.indicaciones || ""
            })),
            indicaciones_generales: form.indicaciones_generales || "",
            observaciones: form.observaciones || ""
          };

          console.log("=== GUARDANDO RECETA ===");
          const prescriptionRes = await axios.post(
            `${API}/prescriptions`,
            prescriptionData,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          toast.success("Receta guardada");

          // 3. Intentar descargar PDF (opcional, no bloquea cierre)
          try {
            const pdfRes = await axios.get(
              `${API}/prescriptions/${prescriptionRes.data.id}/pdf`,
              { 
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
              }
            );

            const url = window.URL.createObjectURL(new Blob([pdfRes.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `receta_${appointment.cedula}_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
          } catch (pdfError) {
            console.warn("No se pudo descargar el PDF, pero la receta está guardada:", pdfError);
            toast.info("Receta guardada. Puede descargarla después desde el historial del paciente.");
          }
        } catch (recetaError) {
          console.error("Error al guardar receta:", recetaError);
          toast.warning("Historia guardada. Error al crear receta: " + (recetaError.response?.data?.detail || "Error desconocido"));
        }
      }

      // Éxito final
      toast.success("Consulta cerrada exitosamente");
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
      <div className="form-section">
        <h3 className="section-title-small">Motivo de Consulta</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Motivo de Consulta *</Label>
            <Textarea
              value={form.motivo_consulta}
              onChange={(e) => setForm({...form, motivo_consulta: e.target.value})}
              required
              rows={2}
            />
          </div>
          <div className="form-field full-width">
            <Label>Enfermedad Actual *</Label>
            <Textarea
              value={form.enfermedad_actual}
              onChange={(e) => setForm({...form, enfermedad_actual: e.target.value})}
              required
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Antecedentes Familiares</h3>
        <div className="form-grid">
          <div className="form-field">
            <Label>Padre</Label>
            <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
              <Checkbox
                checked={form.padre_vivo}
                onCheckedChange={(checked) => setForm({...form, padre_vivo: checked})}
              />
              <span>Vivo</span>
            </div>
          </div>
          {!form.padre_vivo && (
            <div className="form-field">
              <Label>Causa de muerte</Label>
              <Input
                value={form.padre_causa_muerte}
                onChange={(e) => setForm({...form, padre_causa_muerte: e.target.value})}
              />
            </div>
          )}
          <div className="form-field">
            <Label>Madre</Label>
            <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
              <Checkbox
                checked={form.madre_vivo}
                onCheckedChange={(checked) => setForm({...form, madre_vivo: checked})}
              />
              <span>Viva</span>
            </div>
          </div>
          {!form.madre_vivo && (
            <div className="form-field">
              <Label>Causa de muerte</Label>
              <Input
                value={form.madre_causa_muerte}
                onChange={(e) => setForm({...form, madre_causa_muerte: e.target.value})}
              />
            </div>
          )}
          <div className="form-field">
            <Label>Hermanos Vivos</Label>
            <Input
              type="number"
              value={form.hermanos_vivos || ""}
              onChange={(e) => setForm({...form, hermanos_vivos: parseInt(e.target.value) || 0})}
            />
          </div>
          <div className="form-field full-width">
            <Label>Otros Antecedentes Familiares</Label>
            <Textarea
              value={form.antecedentes_familiares}
              onChange={(e) => setForm({...form, antecedentes_familiares: e.target.value})}
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Antecedentes Patológicos</h3>
        <div className="checkboxes-grid">
          {[
            {key: 'ant_hta', label: 'Hipertensión'},
            {key: 'ant_diabetes', label: 'Diabetes'},
            {key: 'ant_tbc', label: 'TBC'},
            {key: 'ant_cancer', label: 'Cáncer'},
            {key: 'ant_hepatopatias', label: 'Hepatopatías'},
            {key: 'ant_nefropatias', label: 'Nefropatías'},
            {key: 'ant_mentales', label: 'Enf. Mentales'},
            {key: 'ant_endocrinas', label: 'Endocrinas'},
            {key: 'ant_epilepsia', label: 'Epilepsia'},
            {key: 'ant_asma', label: 'Asma'},
            {key: 'ant_hematologicas', label: 'Hematológicas'}
          ].map(item => (
            <div key={item.key} className="checkbox-item">
              <Checkbox
                checked={form[item.key]}
                onCheckedChange={(checked) => setForm({...form, [item.key]: checked})}
              />
              <Label>{item.label}</Label>
            </div>
          ))}
        </div>
        <div className="form-field full-width" style={{marginTop: '1rem'}}>
          <Label>Otras Patologías</Label>
          <Textarea
            value={form.otras_patologias}
            onChange={(e) => setForm({...form, otras_patologias: e.target.value})}
            rows={2}
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Signos Vitales</h3>
        <div className="form-grid">
          <div className="form-field">
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.signos_vitales.peso || ""}
              onChange={(e) => setForm({...form, signos_vitales: {...form.signos_vitales, peso: parseFloat(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Talla (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.signos_vitales.talla || ""}
              onChange={(e) => setForm({...form, signos_vitales: {...form.signos_vitales, talla: parseFloat(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Temperatura (°C)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.signos_vitales.temperatura || ""}
              onChange={(e) => setForm({...form, signos_vitales: {...form.signos_vitales, temperatura: parseFloat(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Presión Arterial</Label>
            <Input
              placeholder="120/80"
              value={form.signos_vitales.presion_arterial}
              onChange={(e) => setForm({...form, signos_vitales: {...form.signos_vitales, presion_arterial: e.target.value}})}
            />
          </div>
          <div className="form-field">
            <Label>FC (lpm)</Label>
            <Input
              type="number"
              value={form.signos_vitales.frecuencia_cardiaca || ""}
              onChange={(e) => setForm({...form, signos_vitales: {...form.signos_vitales, frecuencia_cardiaca: parseInt(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>FR (rpm)</Label>
            <Input
              type="number"
              value={form.signos_vitales.frecuencia_respiratoria || ""}
              onChange={(e) => setForm({...form, signos_vitales: {...form.signos_vitales, frecuencia_respiratoria: parseInt(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Sat O2 (%)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.signos_vitales.saturacion_oxigeno || ""}
              onChange={(e) => setForm({...form, signos_vitales: {...form.signos_vitales, saturacion_oxigeno: parseFloat(e.target.value)}})}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Examen Físico</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Impresión General</Label>
            <Textarea value={form.impresion_general} onChange={(e) => setForm({...form, impresion_general: e.target.value})} rows={2} />
          </div>
          {['piel', 'cabeza', 'orl', 'cuello', 'torax', 'cardiovascular', 'pulmonar', 'abdomen', 'extremidades', 'neurologico'].map(field => (
            <div key={field} className="form-field full-width">
              <Label>{field.charAt(0).toUpperCase() + field.slice(1)}</Label>
              <Input
                value={form[field]}
                onChange={(e) => setForm({...form, [field]: e.target.value})}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Diagnóstico</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Diagnóstico *</Label>
            <Textarea
              value={form.diagnostico}
              onChange={(e) => setForm({...form, diagnostico: e.target.value})}
              required
              rows={2}
            />
          </div>
          <div className="form-field">
            <Label>Código CIE-10</Label>
            <Input
              value={form.cie10_codigo}
              onChange={(e) => setForm({...form, cie10_codigo: e.target.value})}
              placeholder="Ej: J00"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Receta Médica</h3>
        <div className="medications-list">
          {form.medicamentos && form.medicamentos.map((med, index) => (
            <div key={index} className="medication-item">
              <div className="form-grid">
                <div className="form-field">
                  <Label>Medicamento {index + 1} *</Label>
                  <Input
                    value={med.nombre}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[index].nombre = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Ej: Paracetamol"
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Dosis *</Label>
                  <Input
                    value={med.dosis}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[index].dosis = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Ej: 500mg"
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Frecuencia *</Label>
                  <Input
                    value={med.frecuencia}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[index].frecuencia = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Ej: Cada 8 horas"
                    required
                  />
                </div>
                <div className="form-field">
                  <Label>Duración *</Label>
                  <Input
                    value={med.duracion}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[index].duracion = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Ej: 7 días"
                    required
                  />
                </div>
                <div className="form-field full-width">
                  <Label>Indicaciones</Label>
                  <Input
                    value={med.indicaciones}
                    onChange={(e) => {
                      const newMeds = [...form.medicamentos];
                      newMeds[index].indicaciones = e.target.value;
                      setForm({...form, medicamentos: newMeds});
                    }}
                    placeholder="Ej: Tomar después de las comidas"
                  />
                </div>
              </div>
              {form.medicamentos.length > 1 && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const newMeds = form.medicamentos.filter((_, i) => i !== index);
                    setForm({...form, medicamentos: newMeds});
                  }}
                  style={{marginTop: '0.5rem'}}
                >
                  Eliminar Medicamento
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
                medicamentos: [...form.medicamentos, {nombre: '', dosis: '', frecuencia: '', duracion: '', indicaciones: ''}]
              });
            }}
            style={{marginTop: '1rem'}}
          >
            + Agregar Medicamento
          </Button>
        </div>
        <div className="form-field full-width" style={{marginTop: '1rem'}}>
          <Label>Indicaciones Generales</Label>
          <Textarea
            value={form.indicaciones_generales}
            onChange={(e) => setForm({...form, indicaciones_generales: e.target.value})}
            rows={2}
            placeholder="Indicaciones generales para el paciente..."
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Observaciones Médicas</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Observaciones</Label>
            <Textarea
              value={form.observaciones}
              onChange={(e) => setForm({...form, observaciones: e.target.value})}
              rows={3}
              placeholder="Observaciones adicionales, recomendaciones, próxima cita..."
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
