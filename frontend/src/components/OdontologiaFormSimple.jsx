import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { CIE10Selector } from "./CIE10Selector";
import { MedicacionRapida } from "./MedicacionRapida";
import { HistorialLateral } from "./HistorialLateral";
import { OdontogramaClinicoTab } from "./OdontogramaClinicoTab";
import { AntecedentesPanel } from "./AntecedentesPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const S = {
  seccion: { background:"#d97706",color:"white",fontWeight:"700",fontSize:"12px",padding:"6px 14px",borderRadius:"6px",marginBottom:"10px",marginTop:"16px" },
  grid2: { display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px" },
  grid3: { display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px" },
  campo: { display:"flex",flexDirection:"column",gap:"3px" },
  label: { fontSize:"12px",color:"#92400e",fontWeight:"600" },
  input: { fontSize:"13px",height:"34px",borderColor:"#fde68a" },
};

const FORM_INICIAL = {
  motivo_consulta:"",dolor_dental:false,ubicacion_dolor:"",intensidad_dolor:"",
  ultima_visita_odonto:"",frecuencia_cepillado:"",uso_hilo_dental:false,uso_enjuague:false,
  tratamientos_previos:"",
  diabetes:false,hipertension:false,cardiopatias:false,
  hepatitis:false,vih:false,epilepsia:false,embarazo:false,
  alergias_medicamentos:"",medicamentos_actuales:"",
  estado_dental:{higiene_oral:"",encia:"",mucosa_oral:"",lengua:"",paladar:"",atm:""},
  diagnostico:"",cie10_codigo:"",cie10_descripcion:"",
  plan_tratamiento:"",procedimientos_realizados:"",materiales_utilizados:"",
  proximo_control:"",observaciones:"",medicamentos:[],
};

export const OdontologiaFormSimple = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [existingHistory, setExistingHistory] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [activeTab, setActiveTab] = useState("historia");

  // Carga SOLO por appointment_id — nunca mezcla citas
  useEffect(() => {
    const cargar = async () => {
      if (!appointment?.id) { setLoadingData(false); return; }
      try {
        const res = await axios.get(
          `${API}/medical-history/odontology/appointment/${appointment.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data) {
          setExistingHistory(res.data);
          const h = res.data;
          setForm(f => ({
            ...f,
            motivo_consulta: h.motivo_consulta||"",
            dolor_dental: h.dolor_dental||false,
            ubicacion_dolor: h.ubicacion_dolor||"",
            intensidad_dolor: h.intensidad_dolor||"",
            ultima_visita_odonto: h.ultima_visita_odonto||"",
            frecuencia_cepillado: h.frecuencia_cepillado||"",
            uso_hilo_dental: h.uso_hilo_dental||false,
            uso_enjuague: h.uso_enjuague||false,
            tratamientos_previos: h.tratamientos_previos||"",
            diabetes: h.diabetes||false,
            hipertension: h.hipertension||false,
            cardiopatias: h.cardiopatias||false,
            hepatitis: h.hepatitis||false,
            vih: h.vih||false,
            epilepsia: h.epilepsia||false,
            embarazo: h.embarazo||false,
            alergias_medicamentos: h.alergias_medicamentos||"",
            medicamentos_actuales: h.medicamentos_actuales||"",
            estado_dental: h.estado_dental||f.estado_dental,
            diagnostico: h.diagnostico||"",
            cie10_codigo: h.cie10_codigo||"",
            cie10_descripcion: h.cie10_descripcion||"",
            plan_tratamiento: h.plan_tratamiento||"",
            procedimientos_realizados: h.procedimientos_realizados||"",
            materiales_utilizados: h.materiales_utilizados||"",
            proximo_control: h.proximo_control||"",
            observaciones: h.observaciones||"",
            medicamentos: [],
          }));
          toast.info("Consulta anterior cargada — puede continuar editando");
        }
      } catch (e) {
        if (e.response?.status !== 404) console.error(e);
        else toast.success("Nueva consulta odontológica — formulario listo");
      }
      setLoadingData(false);
    };
    cargar();
  }, [appointment?.id, token]);

  const setED = (k, v) => setForm(f => ({ ...f, estado_dental: { ...f.estado_dental, [k]: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.motivo_consulta.trim()) { toast.error("El motivo de consulta es obligatorio"); return; }
    if (!form.diagnostico.trim() && !form.cie10_codigo) { toast.error("El diagnóstico es obligatorio"); return; }
    setLoading(true);
    try {
      const payload = {
        appointment_id: appointment.id,
        motivo_consulta: form.motivo_consulta,
        dolor_dental: form.dolor_dental,
        ubicacion_dolor: form.ubicacion_dolor,
        intensidad_dolor: form.intensidad_dolor,
        ultima_visita_odonto: form.ultima_visita_odonto,
        frecuencia_cepillado: form.frecuencia_cepillado,
        uso_hilo_dental: form.uso_hilo_dental,
        uso_enjuague: form.uso_enjuague,
        tratamientos_previos: form.tratamientos_previos,
        diabetes: form.diabetes,
        hipertension: form.hipertension,
        cardiopatias: form.cardiopatias,
        hepatitis: form.hepatitis,
        vih: form.vih,
        epilepsia: form.epilepsia,
        embarazo: form.embarazo,
        alergias_medicamentos: form.alergias_medicamentos,
        medicamentos_actuales: form.medicamentos_actuales,
        estado_dental: form.estado_dental,
        diagnostico: form.diagnostico || form.cie10_descripcion || "",
        cie10_codigo: form.cie10_codigo,
        plan_tratamiento: form.plan_tratamiento || "Ver evolución en odontograma",
        procedimientos_realizados: form.procedimientos_realizados,
        materiales_utilizados: form.materiales_utilizados,
        medicamentos: "",
        proximo_control: form.proximo_control,
        observaciones: form.observaciones,
      };

      if (existingHistory) {
        await axios.put(`${API}/medical-history/odontology/${existingHistory.id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Historia actualizada");
      } else {
        await axios.post(`${API}/medical-history/odontology`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Historia guardada");
      }

      // Consulta financiera automática
      try {
        await axios.post(
          `${API}/financial/consultas/desde-cita/${appointment.id}`,
          [{ servicio:"Consulta Odontológica", descripcion: form.diagnostico||"Consulta dental", precio_unitario:30, cantidad:1 }],
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch { }

      // Receta (opcional)
      const meds = form.medicamentos.filter(m => m.nombre?.trim());
      if (meds.length > 0) {
        try {
          await axios.post(`${API}/prescriptions`, {
            appointment_id: appointment.id,
            paciente_cedula: appointment.cedula,
            diagnostico: form.diagnostico,
            cie10_codigo: form.cie10_codigo,
            medicamentos: meds,
            especialidad: "Odontología",
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success("Receta creada");
        } catch { toast.warning("Historia guardada. No se pudo crear la receta."); }
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar");
    }
    setLoading(false);
  };

  if (loadingData) return <div style={{textAlign:"center",padding:"40px",color:"#d97706"}}>Cargando historia clínica...</div>;

  return (
    <div style={{ display:"flex",height:"100%",gap:0 }}>
      <div style={{ flex:1,overflowY:"auto",padding:"16px 20px" }}>

        {/* Encabezado */}
        <div style={{ background:"linear-gradient(135deg,#d97706,#92400e)",borderRadius:"10px",padding:"14px 18px",marginBottom:"16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <h2 style={{ color:"white",margin:0,fontSize:"16px",fontWeight:"700" }}>🦷 Historia Clínica — Odontología</h2>
            <p style={{ color:"rgba(255,255,255,0.8)",margin:"2px 0 0",fontSize:"13px" }}>{appointment.nombre_completo} · {appointment.cedula}</p>
          </div>
          {existingHistory && <span style={{ background:"rgba(255,255,255,0.2)",color:"white",borderRadius:"6px",padding:"4px 10px",fontSize:"12px" }}>✏️ Editando</span>}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",gap:"8px",marginBottom:"16px" }}>
          {[["historia","📋 Historia Clínica"],["odontograma","🦷 Odontograma"]].map(([t,l]) => (
            <button key={t} type="button" onClick={() => setActiveTab(t)} style={{
              padding:"8px 20px",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:"600",fontSize:"13px",
              background: activeTab===t?"#d97706":"#f3f4f6",color: activeTab===t?"white":"#374151",transition:"all 0.2s"
            }}>{l}</button>
          ))}
        </div>

        {activeTab === "odontograma" ? (
          <div style={{ height:"600px" }}>
            <OdontogramaClinicoTab
              pacienteId={appointment.id}
              pacienteCedula={appointment.cedula}
              pacienteNombre={appointment.nombre_completo}
              token={token}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>

            {/* MOTIVO DE CONSULTA */}
            <div style={S.seccion}>📝 MOTIVO DE CONSULTA</div>
            <div style={{ marginBottom:"10px" }}>
              <Label style={S.label}>Motivo de consulta *</Label>
              <Textarea value={form.motivo_consulta}
                onChange={e => setForm(f=>({...f,motivo_consulta:e.target.value}))}
                rows={2} style={{ fontSize:"13px",borderColor:"#fde68a" }} />
            </div>
            <div style={{ display:"flex",gap:"12px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center" }}>
              <label style={{ display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",fontWeight:"600",color:"#92400e" }}>
                <Checkbox checked={form.dolor_dental} onCheckedChange={v=>setForm(f=>({...f,dolor_dental:v}))} />
                Dolor dental
              </label>
              {form.dolor_dental && (
                <>
                  <Input value={form.ubicacion_dolor} onChange={e=>setForm(f=>({...f,ubicacion_dolor:e.target.value}))}
                    placeholder="Ubicación (ej: Pieza 16)" style={{...S.input,width:"180px"}} />
                  <Select value={form.intensidad_dolor} onValueChange={v=>setForm(f=>({...f,intensidad_dolor:v}))}>
                    <SelectTrigger style={{...S.input,width:"140px"}}><SelectValue placeholder="Intensidad" /></SelectTrigger>
                    <SelectContent>{["Leve","Moderado","Severo"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </>
              )}
            </div>

            {/* ANTECEDENTES — panel inteligente */}
            <div style={S.seccion}>📂 ANTECEDENTES DEL PACIENTE</div>
            <div style={{ marginBottom:"10px" }}>
              <AntecedentesPanel
                cedula={appointment.cedula}
                token={token}
                especialidad="Odontología"
                onLoad={ant => setForm(f => ({
                  ...f,
                  diabetes: ant.diabetes||false, hipertension: ant.hipertension||false,
                  cardiopatias: ant.cardiopatias||false, hepatitis: ant.hepatitis||false,
                  vih: ant.vih||false, epilepsia: ant.epilepsia||false,
                  alergias_medicamentos: ant.alergias_medicamentos||"",
                  medicamentos_actuales: ant.medicamentos_actuales||"",
                }))}
                onChange={ant => setForm(f => ({
                  ...f,
                  diabetes: ant.diabetes||false, hipertension: ant.hipertension||false,
                  cardiopatias: ant.cardiopatias||false, hepatitis: ant.hepatitis||false,
                  vih: ant.vih||false, epilepsia: ant.epilepsia||false,
                  alergias_medicamentos: ant.alergias_medicamentos||"",
                  medicamentos_actuales: ant.medicamentos_actuales||"",
                }))}
              />
            </div>

            {/* Antecedentes odontológicos específicos */}
            <div style={{ background:"#fffbeb",borderRadius:"8px",padding:"10px",marginBottom:"10px" }}>
              <p style={{ fontSize:"12px",fontWeight:"700",color:"#92400e",marginBottom:"8px" }}>🪥 Antecedentes odontológicos:</p>
              <div style={S.grid3}>
                <div style={S.campo}>
                  <Label style={S.label}>Última visita odontológica</Label>
                  <Input value={form.ultima_visita_odonto} onChange={e=>setForm(f=>({...f,ultima_visita_odonto:e.target.value}))} placeholder="Hace cuánto tiempo" style={S.input} />
                </div>
                <div style={S.campo}>
                  <Label style={S.label}>Frecuencia cepillado</Label>
                  <Select value={form.frecuencia_cepillado} onValueChange={v=>setForm(f=>({...f,frecuencia_cepillado:v}))}>
                    <SelectTrigger style={S.input}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{["1 vez al día","2 veces al día","3 veces al día","Irregular"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div style={{ display:"flex",gap:"10px",alignItems:"center",paddingTop:"20px" }}>
                  {[["uso_hilo_dental","Hilo dental"],["uso_enjuague","Enjuague"]].map(([k,l])=>(
                    <label key={k} style={{ display:"flex",alignItems:"center",gap:"5px",fontSize:"12px" }}>
                      <Checkbox checked={form[k]} onCheckedChange={v=>setForm(f=>({...f,[k]:v}))} />{l}
                    </label>
                  ))}
                </div>
                <div style={{ ...S.campo,gridColumn:"1/-1" }}>
                  <Label style={S.label}>Tratamientos odontológicos previos</Label>
                  <Input value={form.tratamientos_previos} onChange={e=>setForm(f=>({...f,tratamientos_previos:e.target.value}))} placeholder="Extracciones, coronas, endodoncias previas..." style={S.input} />
                </div>
              </div>
            </div>

            {/* EXAMEN CLÍNICO */}
            <div style={S.seccion}>🔍 EXAMEN CLÍNICO</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"10px" }}>
              {[["higiene_oral","Higiene oral",["Buena","Regular","Mala"]],
                ["encia","Encías",["Sana","Gingivitis","Periodontitis"]],
                ["mucosa_oral","Mucosa oral",["Normal","Alterada"]],
                ["lengua","Lengua",["Normal","Alterada"]],
                ["paladar","Paladar",["Normal","Alterado"]],
                ["atm","ATM",["Normal","Crepitación","Dolor","Limitación"]],
              ].map(([k,l,ops])=>(
                <div key={k} style={S.campo}>
                  <Label style={{ ...S.label,fontSize:"11px" }}>{l}</Label>
                  <Select value={form.estado_dental[k]} onValueChange={v=>setED(k,v)}>
                    <SelectTrigger style={{ ...S.input,fontSize:"12px" }}><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{ops.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* DIAGNÓSTICO */}
            <div style={S.seccion}>🩺 DIAGNÓSTICO</div>
            <div style={{ marginBottom:"10px" }}>
              <CIE10Selector token={token}
                value={{ codigo:form.cie10_codigo,descripcion:form.cie10_descripcion }}
                onChange={({codigo,descripcion})=>setForm(f=>({...f,cie10_codigo:codigo,cie10_descripcion:descripcion}))}
              />
              <div style={{ marginTop:"8px" }}>
                <Label style={S.label}>Diagnóstico clínico *</Label>
                <Textarea value={form.diagnostico} onChange={e=>setForm(f=>({...f,diagnostico:e.target.value}))}
                  placeholder="Diagnóstico odontológico detallado..." rows={2}
                  style={{ fontSize:"13px",borderColor:"#fde68a" }} />
              </div>
            </div>

            {/* TRATAMIENTO */}
            <div style={S.seccion}>🔧 TRATAMIENTO</div>
            <div style={{ ...S.grid2,marginBottom:"10px" }}>
              <div style={S.campo}>
                <Label style={S.label}>Procedimientos realizados hoy</Label>
                <Textarea value={form.procedimientos_realizados}
                  onChange={e=>setForm(f=>({...f,procedimientos_realizados:e.target.value}))}
                  placeholder="Ej: Resina compuesta pieza 16 cara oclusal" rows={3}
                  style={{ fontSize:"13px",borderColor:"#fde68a" }} />
              </div>
              <div style={S.campo}>
                <Label style={S.label}>Plan de tratamiento</Label>
                <Textarea value={form.plan_tratamiento}
                  onChange={e=>setForm(f=>({...f,plan_tratamiento:e.target.value}))}
                  placeholder="Próximos procedimientos..." rows={3}
                  style={{ fontSize:"13px",borderColor:"#fde68a" }} />
              </div>
              <div style={S.campo}>
                <Label style={S.label}>Materiales utilizados</Label>
                <Input value={form.materiales_utilizados}
                  onChange={e=>setForm(f=>({...f,materiales_utilizados:e.target.value}))}
                  placeholder="Ej: Resina Tetric, anestesia articaína" style={S.input} />
              </div>
              <div style={S.campo}>
                <Label style={S.label}>Próximo control</Label>
                <Input type="date" value={form.proximo_control}
                  onChange={e=>setForm(f=>({...f,proximo_control:e.target.value}))} style={S.input} />
              </div>
              <div style={{ ...S.campo,gridColumn:"1/-1" }}>
                <Label style={S.label}>Observaciones</Label>
                <Textarea value={form.observaciones}
                  onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))}
                  rows={2} style={{ fontSize:"13px",borderColor:"#fde68a" }} />
              </div>
            </div>

            {/* RECETA — opcional */}
            <div style={{ marginBottom:"16px" }}>
              <MedicacionRapida especialidad="Odontología"
                medicamentos={form.medicamentos}
                onChange={meds=>setForm(f=>({...f,medicamentos:meds}))} />
            </div>

            {/* Botones */}
            <div style={{ display:"flex",gap:"10px",justifyContent:"flex-end",paddingBottom:"20px" }}>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading} style={{ background:"#d97706",color:"white" }}>
                {loading ? "Guardando..." : existingHistory ? "Actualizar Consulta" : "Terminar Consulta"}
              </Button>
            </div>
          </form>
        )}
      </div>

      <HistorialLateral cedula={appointment.cedula} token={token} especialidadActual="Odontología" />
    </div>
  );
};
