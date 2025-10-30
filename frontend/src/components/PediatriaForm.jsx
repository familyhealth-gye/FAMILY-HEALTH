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

export const PediatriaForm = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre_responsable: "",
    parentesco_responsable: "",
    telefono_responsable: "",
    motivo_consulta: "",
    enfermedad_actual: "",
    datos_nacimiento: {
      peso_nacimiento: null,
      talla_nacimiento: null,
      perimetro_cefalico_nacimiento: null,
      apgar: "",
      tipo_parto: "",
      complicaciones_parto: ""
    },
    lactancia_materna: "",
    lactancia_meses: null,
    desarrollo_psicomotor: {
      sostuvo_cabeza_meses: null,
      se_sento_meses: null,
      gateo_meses: null,
      camino_meses: null,
      primeras_palabras_meses: null,
      control_esfinteres_meses: null
    },
    desarrollo_acorde_edad: true,
    observaciones_desarrollo: "",
    vacunas: {
      bcg: false,
      hepatitis_b: false,
      pentavalente: false,
      rotavirus: false,
      neumococo: false,
      influenza: false,
      srp: false,
      varicela: false,
      otras: ""
    },
    esquema_completo: false,
    antecedentes_familiares: "",
    alergias: "",
    alimentacion_actual: "",
    numero_comidas_dia: null,
    signos_vitales: {
      peso: null,
      talla: null,
      temperatura: null,
      presion_arterial: "",
      frecuencia_cardiaca: null,
      frecuencia_respiratoria: null,
      saturacion_oxigeno: null
    },
    perimetro_cefalico: null,
    estado_general: "",
    estado_nutricional: "",
    diagnostico: "",
    cie10_codigo: "",
    medicamentos: [{nombre: '', dosis: '', frecuencia: '', duracion: '', indicaciones: ''}],
    indicaciones_padres: "",
    proximo_control: "",
    observaciones: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API}/medical-history/pediatric`,
        { ...form, appointment_id: appointment.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("Historia pediátrica guardada exitosamente");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al guardar");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="medical-history-form">
      <div className="form-section">
        <h3 className="section-title-small">Datos del Responsable</h3>
        <div className="form-grid">
          <div className="form-field">
            <Label>Nombre del Responsable *</Label>
            <Input
              value={form.nombre_responsable}
              onChange={(e) => setForm({...form, nombre_responsable: e.target.value})}
              required
            />
          </div>
          <div className="form-field">
            <Label>Parentesco *</Label>
            <Input
              value={form.parentesco_responsable}
              onChange={(e) => setForm({...form, parentesco_responsable: e.target.value})}
              placeholder="Ej: Madre"
              required
            />
          </div>
          <div className="form-field">
            <Label>Teléfono del Responsable *</Label>
            <Input
              value={form.telefono_responsable}
              onChange={(e) => setForm({...form, telefono_responsable: e.target.value})}
              required
            />
          </div>
        </div>
      </div>

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
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Antecedentes Perinatales</h3>
        <div className="form-grid">
          <div className="form-field">
            <Label>Peso al Nacer (kg)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.datos_nacimiento.peso_nacimiento || ""}
              onChange={(e) => setForm({...form, datos_nacimiento: {...form.datos_nacimiento, peso_nacimiento: parseFloat(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Talla al Nacer (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.datos_nacimiento.talla_nacimiento || ""}
              onChange={(e) => setForm({...form, datos_nacimiento: {...form.datos_nacimiento, talla_nacimiento: parseFloat(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Tipo de Parto</Label>
            <Select
              value={form.datos_nacimiento.tipo_parto}
              onValueChange={(val) => setForm({...form, datos_nacimiento: {...form.datos_nacimiento, tipo_parto: val}})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Cesarea">Cesárea</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <Label>APGAR</Label>
            <Input
              value={form.datos_nacimiento.apgar}
              onChange={(e) => setForm({...form, datos_nacimiento: {...form.datos_nacimiento, apgar: e.target.value}})}
              placeholder="Ej: 8/9"
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Desarrollo Psicomotor</h3>
        <div className="form-grid">
          <div className="form-field">
            <Label>Sostuvo cabeza (meses)</Label>
            <Input
              type="number"
              value={form.desarrollo_psicomotor.sostuvo_cabeza_meses || ""}
              onChange={(e) => setForm({...form, desarrollo_psicomotor: {...form.desarrollo_psicomotor, sostuvo_cabeza_meses: parseInt(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Se sentó (meses)</Label>
            <Input
              type="number"
              value={form.desarrollo_psicomotor.se_sento_meses || ""}
              onChange={(e) => setForm({...form, desarrollo_psicomotor: {...form.desarrollo_psicomotor, se_sento_meses: parseInt(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Gateó (meses)</Label>
            <Input
              type="number"
              value={form.desarrollo_psicomotor.gateo_meses || ""}
              onChange={(e) => setForm({...form, desarrollo_psicomotor: {...form.desarrollo_psicomotor, gateo_meses: parseInt(e.target.value)}})}
            />
          </div>
          <div className="form-field">
            <Label>Caminó (meses)</Label>
            <Input
              type="number"
              value={form.desarrollo_psicomotor.camino_meses || ""}
              onChange={(e) => setForm({...form, desarrollo_psicomotor: {...form.desarrollo_psicomotor, camino_meses: parseInt(e.target.value)}})}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Esquema de Vacunación</h3>
        <div className="checkboxes-grid">
          {[
            {key: 'bcg', label: 'BCG'},
            {key: 'hepatitis_b', label: 'Hepatitis B'},
            {key: 'pentavalente', label: 'Pentavalente'},
            {key: 'rotavirus', label: 'Rotavirus'},
            {key: 'neumococo', label: 'Neumococo'},
            {key: 'influenza', label: 'Influenza'},
            {key: 'srp', label: 'SRP'},
            {key: 'varicela', label: 'Varicela'}
          ].map(item => (
            <div key={item.key} className="checkbox-item">
              <Checkbox
                checked={form.vacunas[item.key]}
                onCheckedChange={(checked) => setForm({...form, vacunas: {...form.vacunas, [item.key]: checked}})}
              />
              <Label>{item.label}</Label>
            </div>
          ))}
        </div>
        <div className="checkbox-item" style={{marginTop: '1rem'}}>
          <Checkbox
            checked={form.esquema_completo}
            onCheckedChange={(checked) => setForm({...form, esquema_completo: checked})}
          />
          <Label>Esquema Completo para la Edad</Label>
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
            <Label>Perímetro Cefálico (cm)</Label>
            <Input
              type="number"
              step="0.1"
              value={form.perimetro_cefalico || ""}
              onChange={(e) => setForm({...form, perimetro_cefalico: parseFloat(e.target.value)})}
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
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Diagnóstico</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Estado Nutricional</Label>
            <Select
              value={form.estado_nutricional}
              onValueChange={(val) => setForm({...form, estado_nutricional: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Desnutricion">Desnutrición</SelectItem>
                <SelectItem value="Sobrepeso">Sobrepeso</SelectItem>
                <SelectItem value="Obesidad">Obesidad</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                medicamentos: [...form.medicamentos, {nombre: '', dosis: '', frecuencia: '', duracion: '', indicaciones: ''}]
              });
            }}
            style={{marginTop: '1rem'}}
          >
            + Agregar Medicamento
          </Button>
        </div>
        <div className="form-field full-width" style={{marginTop: '1rem'}}>
          <Label>Indicaciones para Padres</Label>
          <Textarea
            value={form.indicaciones_padres}
            onChange={(e) => setForm({...form, indicaciones_padres: e.target.value})}
            rows={2}
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title-small">Observaciones</h3>
        <div className="form-grid">
          <div className="form-field full-width">
            <Label>Observaciones y Próximo Control</Label>
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
