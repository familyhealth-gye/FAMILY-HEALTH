import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { NuevaCitaModal } from "./NuevaCitaModal";
import { AntecedentesPanel } from "./AntecedentesPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const PediatriaForm = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [showAgendarCita, setShowAgendarCita] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [existingHistory, setExistingHistory] = useState(null);
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

  // Cargar historia clínica existente al montar
  useEffect(() => {
    const loadExistingHistory = async () => {
      if (!appointment?.id) {
        setLoadingData(false);
        return;
      }
      
      try {
        const response = await axios.get(
          `${API}/medical-history/pediatric/appointment/${appointment.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (response.data) {
          console.log("=== HISTORIA PEDIÁTRICA EXISTENTE CARGADA ===", response.data);
          setExistingHistory(response.data);
          
          // Cargar datos en el formulario
          const history = response.data;
          setForm(prevForm => ({
            ...prevForm,
            nombre_responsable: history.nombre_responsable || "",
            parentesco_responsable: history.parentesco_responsable || "",
            telefono_responsable: history.telefono_responsable || "",
            motivo_consulta: history.motivo_consulta || "",
            enfermedad_actual: history.enfermedad_actual || "",
            datos_nacimiento: history.datos_nacimiento || prevForm.datos_nacimiento,
            lactancia_materna: history.lactancia_materna || "",
            lactancia_meses: history.lactancia_meses || null,
            desarrollo_psicomotor: history.desarrollo_psicomotor || prevForm.desarrollo_psicomotor,
            desarrollo_acorde_edad: history.desarrollo_acorde_edad !== undefined ? history.desarrollo_acorde_edad : true,
            observaciones_desarrollo: history.observaciones_desarrollo || "",
            vacunas: history.vacunas || prevForm.vacunas,
            esquema_completo: history.esquema_completo || false,
            antecedentes_familiares: history.antecedentes_familiares || "",
            alergias: history.alergias || "",
            alimentacion_actual: history.alimentacion_actual || "",
            numero_comidas_dia: history.numero_comidas_dia || null,
            signos_vitales: history.signos_vitales || prevForm.signos_vitales,
            perimetro_cefalico: history.perimetro_cefalico || null,
            estado_general: history.estado_general || "",
            estado_nutricional: history.estado_nutricional || "",
            diagnostico: history.diagnostico || "",
            cie10_codigo: history.cie10_codigo || "",
            indicaciones_padres: history.indicaciones_padres || "",
            proximo_control: history.proximo_control || "",
            observaciones: history.observaciones || ""
          }));
          
          toast.info("Historia clínica cargada - puede continuar editando");
        }
      } catch (error) {
        // 404 significa que no existe historia, es normal
        if (error.response?.status !== 404) {
          console.error("Error cargando historia pediátrica:", error);
        }
      }
      setLoadingData(false);
    };
    
    loadExistingHistory();
  }, [appointment?.id, token]);

  // Cargar datos longitudinales del paciente — endpoint específico por cédula
  // Solo se activa si no se encontró historia para el appointment actual
  useEffect(() => {
    const loadLongitudinalData = async () => {
      if (!appointment?.cedula || existingHistory) return;
      try {
        const res = await axios.get(
          `${API}/medical-history/pediatric/paciente/${appointment.cedula}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const d = res.data;
        if (!d || Object.keys(d).length === 0) return;

        setForm(prev => ({
          ...prev,
          nombre_responsable:      prev.nombre_responsable      || d.nombre_responsable      || "",
          parentesco_responsable:  prev.parentesco_responsable  || d.parentesco_responsable  || "",
          telefono_responsable:    prev.telefono_responsable    || d.telefono_responsable    || "",
          datos_nacimiento:        prev.datos_nacimiento?.peso_nacimiento ? prev.datos_nacimiento : (d.datos_nacimiento || prev.datos_nacimiento),
          lactancia_materna:       prev.lactancia_materna       || d.lactancia_materna       || "",
          lactancia_meses:         prev.lactancia_meses         || d.lactancia_meses         || null,
          desarrollo_psicomotor:   prev.desarrollo_psicomotor?.sostuvo_cabeza_meses ? prev.desarrollo_psicomotor : (d.desarrollo_psicomotor || prev.desarrollo_psicomotor),
          antecedentes_familiares: prev.antecedentes_familiares || d.antecedentes_familiares || "",
          alergias:                prev.alergias                || d.alergias                || "",
          vacunas:                 prev.vacunas?.length > 0     ? prev.vacunas               : (d.vacunas || prev.vacunas),
          esquema_completo:        prev.esquema_completo        || d.esquema_completo        || false,
          alimentacion_actual:     prev.alimentacion_actual     || d.alimentacion_actual     || "",
          medicamentos_actuales:   prev.medicamentos_actuales   || d.medicamentos_actuales   || "",
        }));
        if (d._total_consultas > 0) {
          toast.info(`Datos precargados desde consulta anterior (${d._ultima_consulta}).`);
        }
      } catch {
        // 404 = primer paciente — silencioso, no bloquear el formulario
      }
    };
    loadLongitudinalData();
  }, [appointment?.cedula, token, existingHistory]);

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

    try {
      // 1. Guardar o actualizar historia clínica (obligatorio)
      const historyData = { ...form, appointment_id: appointment.id };
      delete historyData.medicamentos;
      
      const planTratamiento = form.medicamentos
        .filter(m => m.nombre && m.nombre.trim())
        .map((m, i) => `${i + 1}. ${m.nombre} ${m.dosis || ''} - ${m.frecuencia || ''} por ${m.duracion || ''}`)
        .join('\n');
      
      historyData.plan_tratamiento = planTratamiento || "Sin medicamentos prescritos";

      console.log("=== GUARDANDO HISTORIA PEDIÁTRICA ===");
      console.log("Historia existente:", existingHistory ? "Sí (actualizar)" : "No (crear nueva)");
      
      if (existingHistory) {
        // ACTUALIZAR historia existente
        await axios.put(
          `${API}/medical-history/pediatric/${existingHistory.id}`,
          historyData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Historia clínica actualizada");
      } else {
        // CREAR nueva historia
        await axios.post(
          `${API}/medical-history/pediatric`,
          historyData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Historia clínica guardada");
      }

      // 2. Crear receta SOLO si hay medicamentos (opcional)
      const medicamentosFiltrados = form.medicamentos.filter(m => m.nombre && m.nombre.trim());
      
      if (medicamentosFiltrados.length > 0) {
        try {
          const prescriptionData = {
            paciente_id: appointment.id,
            appointment_id: appointment.id,
            especialidad: "Pediatría",
            doctor_id: appointment.doctor_id || "",
            fecha: new Date().toISOString().split('T')[0],
            diagnostico: form.diagnostico || "",
            cie10_codigo: form.cie10_codigo || "",
            cie10_descripcion: "",
            // Campos específicos de Pediatría
            peso: form.signos_vitales?.peso || 0,
            talla: form.signos_vitales?.talla || 0,
            medicamentos: medicamentosFiltrados.map(m => ({
              nombre: m.nombre || "",
              dosis: m.dosis || "",
              frecuencia: m.frecuencia || "",
              duracion: m.duracion || "",
              via: m.via || "",
              indicaciones: m.indicaciones || ""
            })),
            indicaciones_generales: form.indicaciones_padres || "",
            observaciones: ""
          };

          console.log("=== GUARDANDO RECETA PEDIATRÍA ===");
          const prescriptionRes = await axios.post(
            `${API}/prescriptions`,
            prescriptionData,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          toast.success("Receta guardada");

          // 3. Intentar descargar PDF
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
            console.warn("No se pudo descargar el PDF:", pdfError);
            toast.info("Receta guardada. Puede descargarla después desde el historial.");
          }
        } catch (recetaError) {
          console.error("Error al guardar receta:", recetaError);
          toast.warning("Historia guardada. Error al crear receta.");
        }
      }

      // 4. Crear consulta financiera automáticamente
      try {
        let precioConsulta = 30.00; // Precio por defecto Pediatría
        try {
          const catalogoRes = await axios.get(
            `${API}/financial/catalogo?especialidad=Pediatría`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const servicioConsulta = catalogoRes.data?.find(s => 
            s.nombre.toLowerCase().includes('consulta')
          );
          if (servicioConsulta) {
            precioConsulta = servicioConsulta.precio_base;
          }
        } catch (catError) {
          console.warn("No se pudo obtener precio del catálogo, usando precio por defecto");
        }

        await axios.post(
          `${API}/financial/consultas/desde-cita/${appointment.id}`,
          [{
            servicio: "Consulta Pediátrica",
            descripcion: form.diagnostico || "Consulta pediátrica",
            precio_unitario: precioConsulta,
            cantidad: 1
          }],
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("✅ Consulta financiera creada");
      } catch (finError) {
        console.warn("No se pudo crear consulta financiera:", finError);
        if (finError.response?.status !== 400) {
          toast.warning("Historia guardada. Consulta financiera pendiente de crear manualmente.");
        }
      }

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
      {/* ALERTAS DE ANTECEDENTES */}
      <div style={{ marginBottom: "12px" }}>
        <AntecedentesPanel
          cedula={appointment.cedula}
          token={token}
          especialidad="Pediatría"
          readOnly={true}
          onLoad={ant => {
            if (ant.tiene_antecedentes) {
              setForm(f => ({
                ...f,
                alergias: ant.alergias_medicamentos || ant.alergias || f.alergias,
                medicamentos_actuales: ant.medicamentos_actuales || f.medicamentos_actuales,
                antecedentes_familiares: ant.ant_familiares || f.antecedentes_familiares,
              }));
            }
          }}
          onChange={() => {}}
        />
      </div>

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
          {/* Agendar próxima cita rápido */}
          <button
            onClick={() => setShowAgendarCita(true)}
            style={{ marginTop:"6px", fontSize:"11px", color:"#0C4A6E", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", fontWeight:"600" }}
          >
            📅 Agendar próxima consulta
          </button>
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
    

      {/* Modal agendar próxima cita */}
      <NuevaCitaModal
        isOpen={showAgendarCita}
        onClose={() => setShowAgendarCita(false)}
        onSuccess={() => setShowAgendarCita(false)}
        token={token}
        user={null}
        paciente={{
          nombre_completo: appointment?.nombre_completo || "",
          cedula: appointment?.cedula || "",
          telefono: appointment?.telefono || "",
        }}
        fromPatient={true}
      />
      </form>
  );
};