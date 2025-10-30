import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";

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

export const OdontologiaForm = ({ appointment, token, onClose, onSuccess }) => {
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

  const [form, setForm] = useState({
    motivo_consulta: "",
    dolor_dental: false,
    ubicacion_dolor: "",
    intensidad_dolor: "",
    tiempo_dolor: "",
    ultima_visita_odonto: "",
    frecuencia_cepillado: "",
    uso_hilo_dental: false,
    uso_enjuague: false,
    tratamientos_previos: "",
    diabetes: false,
    hipertension: false,
    cardiopatias: false,
    hepatitis: false,
    vih: false,
    epilepsia: false,
    embarazo: false,
    semanas_embarazo: null,
    alergias_medicamentos: "",
    medicamentos_actuales: "",
    fumador: false,
    cigarrillos_dia: null,
    bruxismo: false,
    succion_digital: false,
    estado_dental: {
      higiene_oral: "",
      encia: "",
      mucosa_oral: "",
      lengua: "",
      paladar: "",
      atm: ""
    },
    dientes: initialTeeth, // Odontograma integrado
    diagnostico: "",
    cie10_codigo: "",
    plan_tratamiento: "",
    procedimientos_realizados: "",
    materiales_utilizados: "",
    medicamentos: "",
    proximo_control: "",
    observaciones: "",
    recomendaciones: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API}/medical-history/odontology`,
        { ...form, appointment_id: appointment.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Historia clínica odontológica guardada exitosamente");
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
          <div className="checkbox-item">
            <Checkbox
              checked={form.dolor_dental}
              onCheckedChange={(checked) => setForm({...form, dolor_dental: checked})}
            />
            <Label>Presenta Dolor Dental</Label>
          </div>
          {form.dolor_dental && (
            <>
              <div className="form-field">
                <Label>Ubicación del Dolor</Label>
                <Input
                  value={form.ubicacion_dolor}
                  onChange={(e) => setForm({...form, ubicacion_dolor: e.target.value})}
                  placeholder="Ej: Molar inferior derecho"
                />
              </div>
              <div className="form-field">
                <Label>Intensidad</Label>
                <Select
                  value={form.intensidad_dolor}
                  onValueChange={(val) => setForm({...form, intensidad_dolor: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Leve">Leve</SelectItem>
                    <SelectItem value="Moderado">Moderado</SelectItem>
                    <SelectItem value="Severo">Severo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="form-field">
                <Label>Tiempo de Evolución</Label>
                <Input
                  value={form.tiempo_dolor}
                  onChange={(e) => setForm({...form, tiempo_dolor: e.target.value})}
                  placeholder="Ej: 3 días"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Antecedentes Odontológicos</h3>
        <div className="form-grid">
          <div className="form-field">
            <Label>Última Visita al Odontólogo</Label>
            <Input
              value={form.ultima_visita_odonto}
              onChange={(e) => setForm({...form, ultima_visita_odonto: e.target.value})}
              placeholder="Hace 6 meses"
            />
          </div>
          <div className="form-field">
            <Label>Frecuencia de Cepillado</Label>
            <Input
              value={form.frecuencia_cepillado}
              onChange={(e) => setForm({...form, frecuencia_cepillado: e.target.value})}
              placeholder="Ej: 3 veces al día"
            />
          </div>
          <div className="checkbox-item">
            <Checkbox
              checked={form.uso_hilo_dental}
              onCheckedChange={(checked) => setForm({...form, uso_hilo_dental: checked})}
            />
            <Label>Usa Hilo Dental</Label>
          </div>
          <div className="checkbox-item">
            <Checkbox
              checked={form.uso_enjuague}
              onCheckedChange={(checked) => setForm({...form, uso_enjuague: checked})}
            />
            <Label>Usa Enjuague Bucal</Label>
          </div>
          <div className="form-field full-width">
            <Label>Tratamientos Previos</Label>
            <Textarea
              value={form.tratamientos_previos}
              onChange={(e) => setForm({...form, tratamientos_previos: e.target.value})}
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Antecedentes Médicos Relevantes</h3>
        <div className="checkboxes-grid">
          {[
            {key: 'diabetes', label: 'Diabetes'},
            {key: 'hipertension', label: 'Hipertensión'},
            {key: 'cardiopatias', label: 'Cardiopatías'},
            {key: 'hepatitis', label: 'Hepatitis'},
            {key: 'vih', label: 'VIH'},
            {key: 'epilepsia', label: 'Epilepsia'},
            {key: 'embarazo', label: 'Embarazo'}
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
        {form.embarazo && (
          <div className="form-field" style={{marginTop: '1rem'}}>
            <Label>Semanas de Embarazo</Label>
            <Input
              type="number"
              value={form.semanas_embarazo || ""}
              onChange={(e) => setForm({...form, semanas_embarazo: parseInt(e.target.value)})}
            />
          </div>
        )}
        <div className="form-grid" style={{marginTop: '1rem'}}>
          <div className="form-field full-width">
            <Label>Alergias a Medicamentos</Label>
            <Input
              value={form.alergias_medicamentos}
              onChange={(e) => setForm({...form, alergias_medicamentos: e.target.value})}
            />
          </div>
          <div className="form-field full-width">
            <Label>Medicamentos Actuales</Label>
            <Input
              value={form.medicamentos_actuales}
              onChange={(e) => setForm({...form, medicamentos_actuales: e.target.value})}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Hábitos</h3>
        <div className="form-grid">
          <div className="checkbox-item">
            <Checkbox
              checked={form.fumador}
              onCheckedChange={(checked) => setForm({...form, fumador: checked})}
            />
            <Label>Fumador</Label>
          </div>
          {form.fumador && (
            <div className="form-field">
              <Label>Cigarrillos por día</Label>
              <Input
                type="number"
                value={form.cigarrillos_dia || ""}
                onChange={(e) => setForm({...form, cigarrillos_dia: parseInt(e.target.value)})}
              />
            </div>
          )}
          <div className="checkbox-item">
            <Checkbox
              checked={form.bruxismo}
              onCheckedChange={(checked) => setForm({...form, bruxismo: checked})}
            />
            <Label>Bruxismo</Label>
          </div>
          <div className="checkbox-item">
            <Checkbox
              checked={form.succion_digital}
              onCheckedChange={(checked) => setForm({...form, succion_digital: checked})}
            />
            <Label>Succión Digital</Label>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Examen Intraoral</h3>
        <div className="form-grid">
          <div className="form-field">
            <Label>Higiene Oral</Label>
            <Select
              value={form.estado_dental.higiene_oral}
              onValueChange={(val) => setForm({...form, estado_dental: {...form.estado_dental, higiene_oral: val}})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Buena">Buena</SelectItem>
                <SelectItem value="Regular">Regular</SelectItem>
                <SelectItem value="Mala">Mala</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <Label>Estado de Encías</Label>
            <Select
              value={form.estado_dental.encia}
              onValueChange={(val) => setForm({...form, estado_dental: {...form.estado_dental, encia: val}})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sana">Sana</SelectItem>
                <SelectItem value="Gingivitis">Gingivitis</SelectItem>
                <SelectItem value="Periodontitis">Periodontitis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <Label>Mucosa Oral</Label>
            <Input
              value={form.estado_dental.mucosa_oral}
              onChange={(e) => setForm({...form, estado_dental: {...form.estado_dental, mucosa_oral: e.target.value}})}
            />
          </div>
          <div className="form-field">
            <Label>Lengua</Label>
            <Input
              value={form.estado_dental.lengua}
              onChange={(e) => setForm({...form, estado_dental: {...form.estado_dental, lengua: e.target.value}})}
            />
          </div>
          <div className="form-field">
            <Label>Paladar</Label>
            <Input
              value={form.estado_dental.paladar}
              onChange={(e) => setForm({...form, estado_dental: {...form.estado_dental, paladar: e.target.value}})}
            />
          </div>
          <div className="form-field">
            <Label>ATM (Articulación Temporomandibular)</Label>
            <Input
              value={form.estado_dental.atm}
              onChange={(e) => setForm({...form, estado_dental: {...form.estado_dental, atm: e.target.value}})}
            />
          </div>
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
              placeholder="Ej: K02"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Tratamiento</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Plan de Tratamiento *</Label>
            <Textarea
              value={form.plan_tratamiento}
              onChange={(e) => setForm({...form, plan_tratamiento: e.target.value})}
              required
              rows={3}
              placeholder="Describe el plan de tratamiento completo"
            />
          </div>
          <div className="form-field full-width">
            <Label>Procedimientos Realizados</Label>
            <Textarea
              value={form.procedimientos_realizados}
              onChange={(e) => setForm({...form, procedimientos_realizados: e.target.value})}
              rows={2}
              placeholder="Procedimientos realizados en esta consulta"
            />
          </div>
          <div className="form-field full-width">
            <Label>Materiales Utilizados</Label>
            <Input
              value={form.materiales_utilizados}
              onChange={(e) => setForm({...form, materiales_utilizados: e.target.value})}
              placeholder="Ej: Resina compuesta, anestesia local"
            />
          </div>
          <div className="form-field full-width">
            <Label>Medicamentos Recetados</Label>
            <Textarea
              value={form.medicamentos}
              onChange={(e) => setForm({...form, medicamentos: e.target.value})}
              rows={2}
              placeholder="Medicamentos, dosis y duración"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Seguimiento</h3>
        <div className="form-grid">
          <div className="form-field">
            <Label>Próximo Control</Label>
            <Input
              value={form.proximo_control}
              onChange={(e) => setForm({...form, proximo_control: e.target.value})}
              placeholder="Ej: En 15 días"
            />
          </div>
          <div className="form-field full-width">
            <Label>Recomendaciones</Label>
            <Textarea
              value={form.recomendaciones}
              onChange={(e) => setForm({...form, recomendaciones: e.target.value})}
              rows={2}
              placeholder="Recomendaciones de higiene y cuidados"
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
