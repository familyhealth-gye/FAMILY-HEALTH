import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {} from "@/components/ui/checkbox";
import { toast } from "sonner";
import axios from "axios";
import { NuevaCitaModal } from "./NuevaCitaModal";
import { AntecedentesPanel } from "./AntecedentesPanel";
import { CIE10Selector } from "./CIE10Selector";
import { MedicacionRapida } from "./MedicacionRapida";
import { IAMedicaPanel } from "./IAMedicaPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const MedicinaGeneralForm = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [showAgendarCita, setShowAgendarCita] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [existingHistory, setExistingHistory] = useState(null);
  const [form, setForm] = useState({
    motivo_consulta: "", enfermedad_actual: "",
    antecedentes_familiares: "",
    padre_vivo: true, padre_causa_muerte: "",
    madre_vivo: true, madre_causa_muerte: "",
    hermanos_vivos: 0,
    ant_hta: false, ant_diabetes: false, ant_tbc: false, ant_cancer: false,
    ant_hepatopatias: false, ant_nefropatias: false, ant_mentales: false,
    ant_endocrinas: false, ant_epilepsia: false, ant_asma: false, ant_hematologicas: false,
    otras_patologias: "", alergias: "", quirurgicos: "",
    traumatismos: "", hospitalizaciones: "", transfusiones: false,
    tabaco: "", alcohol: "", drogas: "",
    signos_vitales: {
      peso: null, talla: null, temperatura: null,
      presion_arterial: "", frecuencia_cardiaca: null,
      frecuencia_respiratoria: null, saturacion_oxigeno: null
    },
    impresion_general: "", piel: "", cabeza: "", orl: "", cuello: "",
    torax: "", cardiovascular: "", pulmonar: "", abdomen: "",
    extremidades: "", neurologico: "", laboratorios: "",
    diagnostico: "", cie10_codigo: "", cie10_descripcion: "",
    medicamentos: [],
    indicaciones_generales: "", precauciones: "", observaciones: ""
  });

  useEffect(() => {
    const load = async () => {
      if (!appointment?.id) { setLoadingData(false); return; }
      try {
        const res = await axios.get(
          `${API}/medical-history/general/appointment/${appointment.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data) {
          setExistingHistory(res.data);
          const h = res.data;
          setForm(f => ({
            ...f,
            motivo_consulta: h.motivo_consulta || "",
            enfermedad_actual: h.enfermedad_actual || "",
            antecedentes_familiares: h.antecedentes_familiares || "",
            padre_vivo: h.padre_vivo !== undefined ? h.padre_vivo : true,
            padre_causa_muerte: h.padre_causa_muerte || "",
            madre_vivo: h.madre_vivo !== undefined ? h.madre_vivo : true,
            madre_causa_muerte: h.madre_causa_muerte || "",
            hermanos_vivos: h.hermanos_vivos || 0,
            ant_hta: h.ant_hta || false, ant_diabetes: h.ant_diabetes || false,
            ant_tbc: h.ant_tbc || false, ant_cancer: h.ant_cancer || false,
            ant_hepatopatias: h.ant_hepatopatias || false,
            ant_nefropatias: h.ant_nefropatias || false,
            ant_mentales: h.ant_mentales || false,
            ant_endocrinas: h.ant_endocrinas || false,
            ant_epilepsia: h.ant_epilepsia || false, ant_asma: h.ant_asma || false,
            ant_hematologicas: h.ant_hematologicas || false,
            otras_patologias: h.otras_patologias || "",
            alergias: h.alergias || "", quirurgicos: h.quirurgicos || "",
            traumatismos: h.traumatismos || "", hospitalizaciones: h.hospitalizaciones || "",
            transfusiones: h.transfusiones || false, tabaco: h.tabaco || "",
            alcohol: h.alcohol || "", drogas: h.drogas || "",
            signos_vitales: h.signos_vitales || f.signos_vitales,
            impresion_general: h.impresion_general || "", piel: h.piel || "",
            cabeza: h.cabeza || "", orl: h.orl || "", cuello: h.cuello || "",
            torax: h.torax || "", cardiovascular: h.cardiovascular || "",
            pulmonar: h.pulmonar || "", abdomen: h.abdomen || "",
            extremidades: h.extremidades || "", neurologico: h.neurologico || "",
            laboratorios: h.laboratorios || "",
            diagnostico: h.diagnostico || "",
            cie10_codigo: h.cie10_codigo || "", cie10_descripcion: h.cie10_descripcion || "",
            medicamentos: [],
            indicaciones_generales: h.indicaciones_generales || "",
            precauciones: h.precauciones || "",
            observaciones: h.observaciones || "",
          }));
          toast.info("Consulta anterior cargada — puede continuar editando");
        }
      } catch (e) {
        if (e.response?.status !== 404) console.error(e);
        else toast.success("Nueva consulta — formulario listo");
      }
      setLoadingData(false);
    };
    load();
  }, [appointment?.id, token]);

  const setSV = (k, v) => setForm(f => ({ ...f, signos_vitales: { ...f.signos_vitales, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validación con highlight visual del campo
    if (!form.motivo_consulta.trim()) {
      toast.error("⚠️ Falta: Motivo de consulta");
      document.querySelector('[data-field="motivo_consulta"]')?.scrollIntoView({ behavior:'smooth', block:'center' });
      document.querySelector('[data-field="motivo_consulta"]')?.focus();
      return;
    }
    if (!form.diagnostico.trim() && !form.cie10_codigo) {
      toast.error("⚠️ Falta: Diagnóstico — agrega el diagnóstico o código CIE-10");
      document.querySelector('[data-field="diagnostico"]')?.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        appointment_id: appointment.id,
        ...form,
        signos_vitales: {
          peso: form.signos_vitales.peso ? parseFloat(form.signos_vitales.peso) : null,
          talla: form.signos_vitales.talla ? parseFloat(form.signos_vitales.talla) : null,
          temperatura: form.signos_vitales.temperatura ? parseFloat(form.signos_vitales.temperatura) : null,
          presion_arterial: form.signos_vitales.presion_arterial || "",
          frecuencia_cardiaca: form.signos_vitales.frecuencia_cardiaca ? parseInt(form.signos_vitales.frecuencia_cardiaca) : null,
          frecuencia_respiratoria: form.signos_vitales.frecuencia_respiratoria ? parseInt(form.signos_vitales.frecuencia_respiratoria) : null,
          saturacion_oxigeno: form.signos_vitales.saturacion_oxigeno ? parseFloat(form.signos_vitales.saturacion_oxigeno) : null,
        },
      };
      // Quitar medicamentos del payload de historia (van a prescriptions)
      delete payload.medicamentos;

      if (existingHistory) {
        await axios.put(`${API}/medical-history/general/${existingHistory.id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Historia actualizada");
      } else {
        await axios.post(`${API}/medical-history/general`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Historia guardada");
      }

      // Consulta financiera automática
      try {
        await axios.post(`${API}/financial/consultas/desde-cita/${appointment.id}`,
          [{ servicio: "Consulta Medicina General", descripcion: form.diagnostico || "Consulta médica", precio_unitario: 15, cantidad: 1 }],
          { headers: { Authorization: `Bearer ${token}` } });
      } catch { /* ya existe */ }

      // Receta si hay medicamentos
      const meds = form.medicamentos.filter(m => m.nombre?.trim());
      if (meds.length > 0) {
        try {
          await axios.post(`${API}/prescriptions`, {
            appointment_id: appointment.id,
            paciente_cedula: appointment.cedula,
            diagnostico: form.diagnostico,
            cie10_codigo: form.cie10_codigo,
            indicaciones_generales: form.indicaciones_generales,
            precauciones: form.precauciones,
            medicamentos: meds,
            especialidad: "Medicina General",
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success("Receta creada");
        } catch { toast.warning("Historia guardada. Error al crear receta."); }
      }

      // Auto-agendar proxima cita si se indico fecha
      const proxFecha = form.proximo_control || form.fecha_control;
      if (proxFecha) {
        try {
          await axios.post(`${API}/appointments`, {
            tipo_documento: appointment.tipo_documento || "cedula",
            nombre_completo: appointment.nombre_completo,
            cedula: appointment.cedula || "",
            fecha_nacimiento: appointment.fecha_nacimiento || "",
            telefono: appointment.telefono || "",
            email: appointment.email || "",
            especialidad: appointment.especialidad,
            doctor_id: appointment.doctor_id || "",
            doctor_nombre: appointment.doctor_nombre || "",
            fecha: proxFecha,
            hora: appointment.hora || "09:00",
            tipo_pago: "efectivo",
            observaciones: "Control medico programado automaticamente.",
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success(`Proximo control agendado para ${proxFecha}`);
        } catch { toast.warning("Consulta guardada. Agenda el control manualmente."); }
      }

      onSuccess(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar la historia clínica");
    }
    setLoading(false);
  };

  if (loadingData) return <div style={{ textAlign:"center", padding:"40px", color:"#00a8cc" }}>Cargando historia clínica...</div>;

  const S = {
    sec: { background:"#00a8cc", color:"white", fontWeight:"700", fontSize:"12px", padding:"6px 14px", borderRadius:"6px", marginBottom:"10px", marginTop:"16px" },
    g2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" },
    g3: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px" },
    g4: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:"8px" },
    f: { display:"flex", flexDirection:"column", gap:"3px" },
    l: { fontSize:"12px", color:"#005f73", fontWeight:"600" },
    i: { fontSize:"13px", height:"34px", borderColor:"#b2ebf2" },
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding:"16px 20px", overflowY:"auto", height:"100%" }}>

      {/* Encabezado */}
      <div style={{ background:"linear-gradient(135deg,#00a8cc,#005f73)", borderRadius:"10px", padding:"14px 18px", marginBottom:"16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h2 style={{ color:"white", margin:0, fontSize:"16px", fontWeight:"700" }}>🩺 Historia Clínica — Medicina General</h2>
          <p style={{ color:"rgba(255,255,255,0.8)", margin:"2px 0 0", fontSize:"13px" }}>{appointment.nombre_completo} · {appointment.cedula}</p>
        </div>
          {/* Agendar próxima cita rápido */}
          <button
            onClick={() => setShowAgendarCita(true)}
            style={{ marginTop:"6px", fontSize:"11px", color:"#0C4A6E", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", fontWeight:"600" }}
          >
            📅 Agendar próxima consulta
          </button>
        {existingHistory && <span style={{ background:"rgba(255,255,255,0.2)", color:"white", borderRadius:"6px", padding:"4px 10px", fontSize:"12px" }}>✏️ Editando</span>}
      </div>

      {/* ALERTAS — solo banner, sin formulario editable aquí */}
      <AntecedentesPanel
        cedula={appointment.cedula}
        token={token}
        especialidad="Medicina General"
        readOnly={true}
        onLoad={ant => {
          if (ant.tiene_antecedentes) {
            setForm(f => ({
              ...f,
              ant_hta: ant.hipertension || f.ant_hta,
              ant_diabetes: ant.diabetes || f.ant_diabetes,
              ant_epilepsia: ant.epilepsia || f.ant_epilepsia,
              alergias: ant.alergias_medicamentos || ant.alergias || f.alergias,
              antecedentes_familiares: ant.ant_familiares || f.antecedentes_familiares,
            }));
          }
        }}
        onChange={() => {}}
      />

      {/* MOTIVO */}
      <div style={S.sec}>📝 MOTIVO DE CONSULTA</div>
      <div style={{ ...S.g2, marginBottom:"10px" }}>
        <div style={{ ...S.f, gridColumn:"1/-1" }}>
          <Label style={S.l}>Motivo de consulta *</Label>
          <Textarea value={form.motivo_consulta} onChange={e=>setForm(f=>({...f,motivo_consulta:e.target.value}))} rows={2} style={{ fontSize:"13px", borderColor:"#b2ebf2" }} />
        </div>
        <div style={{ ...S.f, gridColumn:"1/-1" }}>
          <Label style={S.l}>Enfermedad actual</Label>
          <Textarea value={form.enfermedad_actual} onChange={e=>setForm(f=>({...f,enfermedad_actual:e.target.value}))} rows={3} style={{ fontSize:"13px", borderColor:"#b2ebf2" }} />
        </div>
      </div>

<div style={S.sec}>💓 SIGNOS VITALES</div>
      <div style={{ ...S.g4, marginBottom:"10px" }}>
        {[["peso","Peso","kg"],["talla","Talla","cm"],["temperatura","Temp.","°C"],
          ["presion_arterial","P. Arterial",""],["frecuencia_cardiaca","Frec. Cardíaca","lpm"],
          ["frecuencia_respiratoria","Frec. Resp.","rpm"],["saturacion_oxigeno","SatO2","%"]
        ].map(([k,l,u]) => (
          <div key={k} style={S.f}>
            <Label style={{ ...S.l, fontSize:"11px" }}>{l}</Label>
            <Input type={u===""?"text":"number"} step="0.1"
              value={form.signos_vitales[k] || ""}
              onChange={e=>setSV(k, e.target.value)}
              style={{ ...S.i, fontSize:"12px" }} />
            {u && <span style={{ fontSize:"10px", color:"#999" }}>{u}</span>}
          </div>
        ))}
      </div>

      {/* EXAMEN FÍSICO */}
      <div style={S.sec}>🔍 EXAMEN FÍSICO</div>
      <div style={{ ...S.g3, marginBottom:"10px" }}>
        {[["impresion_general","Impresión general"],["piel","Piel / Mucosas"],["cabeza","Cabeza"],
          ["orl","ORL"],["cuello","Cuello"],["torax","Tórax"],
          ["cardiovascular","Cardiovascular"],["pulmonar","Pulmonar"],["abdomen","Abdomen"],
          ["extremidades","Extremidades"],["neurologico","Neurológico"],
        ].map(([k,l]) => (
          <div key={k} style={S.f}>
            <Label style={{ ...S.l, fontSize:"11px" }}>{l}</Label>
            <Input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{ ...S.i, fontSize:"12px" }} />
          </div>
        ))}
        <div style={{ ...S.f, gridColumn:"1/-1" }}>
          <Label style={S.l}>Laboratorios / Exámenes</Label>
          <Textarea value={form.laboratorios} onChange={e=>setForm(f=>({...f,laboratorios:e.target.value}))} rows={2} style={{ fontSize:"13px" }} />
        </div>
      </div>

      {/* DIAGNÓSTICO */}
      {/* ASISTENTE IA — antes del diagnóstico */}
      <IAMedicaPanel
        especialidad="Medicina General"
        token={token}
        contexto={{
          nombre: appointment.nombre_completo,
          edad: appointment.edad || (appointment.fecha_nacimiento ? (() => { const h=new Date(),n=new Date(appointment.fecha_nacimiento+"T12:00:00"); let e=h.getFullYear()-n.getFullYear(); if((h.getMonth(),h.getDate())<(n.getMonth(),n.getDate()))e--; return e; })() : ""),
          sexo: appointment.sexo || "",
          motivo_consulta: form.motivo_consulta,
          antecedentes: `${form.antecedentes_familiares} | Alergias: ${form.alergias} | HTA: ${form.ant_hta} | Diabetes: ${form.ant_diabetes}`,
          alergias: form.alergias,
          medicamentos_actuales: form.medicamentos_actuales || "",
          diagnostico_previo: form.diagnostico || "",
        }}
        onUsarSugerencia={texto => setForm(f => ({
          ...f,
          diagnostico: f.diagnostico ? f.diagnostico + "\n\n[IA]: " + texto : "[IA sugerencia]: " + texto
        }))}
      />

      <div style={S.sec}>🩺 DIAGNÓSTICO</div>
      <div style={{ marginBottom:"10px" }}>
        <CIE10Selector token={token}
          value={{ codigo:form.cie10_codigo, descripcion:form.cie10_descripcion }}
          onChange={({codigo,descripcion})=>setForm(f=>({...f,cie10_codigo:codigo,cie10_descripcion:descripcion}))}
        />
        <div style={{ marginTop:"8px" }}>
          <Label style={S.l}>Diagnóstico clínico *</Label>
          <Textarea value={form.diagnostico} onChange={e=>setForm(f=>({...f,diagnostico:e.target.value}))}
            rows={2} style={{ fontSize:"13px", borderColor:"#b2ebf2" }} />
        </div>
      </div>

      {/* RECETA — opcional */}
      <div style={{ marginBottom:"10px" }}>
        <MedicacionRapida especialidad="Medicina General"
          medicamentos={form.medicamentos}
          token={token}
          onChange={meds=>setForm(f=>({...f,medicamentos:meds}))} />
      </div>

      {/* INDICACIONES Y PRECAUCIONES */}
      <div style={S.sec}>📋 INDICACIONES / PRECAUCIONES</div>
      <div style={{ ...S.g2, marginBottom:"10px" }}>
        <div style={S.f}>
          <Label style={S.l}>Indicaciones generales</Label>
          <Textarea value={form.indicaciones_generales} onChange={e=>setForm(f=>({...f,indicaciones_generales:e.target.value}))}
            rows={3} style={{ fontSize:"13px", borderColor:"#b2ebf2" }} />
        </div>
        <div style={S.f}>
          <Label style={S.l}>Precauciones</Label>
          <Textarea value={form.precauciones} onChange={e=>setForm(f=>({...f,precauciones:e.target.value}))}
            placeholder="Ej: Reposo, no conducir, evitar..." rows={3} style={{ fontSize:"13px", borderColor:"#b2ebf2" }} />
        </div>
        <div style={{ ...S.f, gridColumn:"1/-1" }}>
          <Label style={S.l}>Observaciones</Label>
          <Textarea value={form.observaciones} onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))}
            rows={2} style={{ fontSize:"13px", borderColor:"#b2ebf2" }} />
        </div>
      </div>

      {/* Botones */}
      <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end", paddingBottom:"20px" }}>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button type="button" variant="outline" disabled={loading || !form.motivo_consulta?.trim()}
          onClick={async () => {
            try {
              const ep = existingHistory
                ? `${API}/medical-history/general/${existingHistory.id}`
                : `${API}/medical-history/general`;
              const method = existingHistory ? "put" : "post";
              await axios[method](ep, {
                appointment_id: appointment.id,
                paciente_cedula: appointment.cedula || "",
                ...form,
              }, { headers: { Authorization: `Bearer ${token}` } });
              toast.success("💾 Borrador guardado");
            } catch { toast.warning("No se pudo guardar el borrador"); }
          }}>
          💾 Guardar borrador
        </Button>
        <Button type="submit" disabled={loading} style={{ background:"#00a8cc", color:"white" }}>
          {loading ? "Guardando..." : existingHistory ? "Actualizar Consulta" : "Terminar Consulta"}
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
