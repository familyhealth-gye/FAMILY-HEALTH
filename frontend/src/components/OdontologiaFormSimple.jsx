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
import { PlanTratamientoTab } from "./PlanTratamientoTab";
import { EvolucionesTab } from "./EvolucionesTab";
import { FotosRXTab } from "./FotosRXTab";
import { IAMedicaPanel } from "./IAMedicaPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// CIE-10 Odontología K00-K14
const CIE10_ODONTO = [
  {codigo:"K02.0",descripcion:"Caries limitada al esmalte (mancha blanca)"},
  {codigo:"K02.1",descripcion:"Caries de la dentina"},
  {codigo:"K02.3",descripcion:"Caries dentaria detenida"},
  {codigo:"K02.5",descripcion:"Caries con exposición pulpar"},
  {codigo:"K02.9",descripcion:"Caries dental, no especificada"},
  {codigo:"K04.0",descripcion:"Pulpitis"},
  {codigo:"K04.1",descripcion:"Necrosis de la pulpa"},
  {codigo:"K04.4",descripcion:"Periodontitis apical aguda (origen pulpar)"},
  {codigo:"K04.5",descripcion:"Periodontitis apical crónica (granuloma apical)"},
  {codigo:"K04.6",descripcion:"Absceso periapical con fístula"},
  {codigo:"K04.7",descripcion:"Absceso periapical sin fístula"},
  {codigo:"K04.8",descripcion:"Quiste radicular"},
  {codigo:"K05.0",descripcion:"Gingivitis aguda"},
  {codigo:"K05.1",descripcion:"Gingivitis crónica"},
  {codigo:"K05.2",descripcion:"Periodontitis aguda"},
  {codigo:"K05.3",descripcion:"Periodontitis crónica"},
  {codigo:"K06.0",descripcion:"Recesión gingival"},
  {codigo:"K06.1",descripcion:"Agrandamiento gingival (hiperplasia)"},
  {codigo:"K07.4",descripcion:"Maloclusión, no especificada"},
  {codigo:"K07.6",descripcion:"Trastornos de la ATM"},
  {codigo:"K08.1",descripcion:"Pérdida de dientes por extracción / periodontal"},
  {codigo:"K08.3",descripcion:"Raíz dental retenida"},
  {codigo:"K10.3",descripcion:"Alveolitis del maxilar (alveolo seco)"},
  {codigo:"K01.1",descripcion:"Dientes impactados (tercer molar)"},
  {codigo:"K03.0",descripcion:"Atrición / bruxismo"},
  {codigo:"K03.2",descripcion:"Erosión de los dientes"},
  {codigo:"K03.6",descripcion:"Cálculo / placa bacteriana"},
  {codigo:"K12.0",descripcion:"Estomatitis aftosa recurrente"},
  {codigo:"K12.2",descripcion:"Celulitis y absceso de boca"},
  {codigo:"Z01.2",descripcion:"Examen dental de rutina"},
];

const S = {
  sec:{background:"#d97706",color:"white",fontWeight:"700",fontSize:"12px",padding:"6px 14px",borderRadius:"6px",marginBottom:"10px",marginTop:"16px"},
  g2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},
  g3:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px"},
  f:{display:"flex",flexDirection:"column",gap:"3px"},
  l:{fontSize:"12px",color:"#92400e",fontWeight:"600"},
  i:{fontSize:"13px",height:"34px",borderColor:"#fde68a"},
};

const FORM0 = {
  motivo_consulta:"",dolor_dental:false,ubicacion_dolor:"",intensidad_dolor:"",
  ultima_visita_odonto:"",frecuencia_cepillado:"",uso_hilo_dental:false,uso_enjuague:false,
  tratamientos_previos:"",
  diabetes:false,hipertension:false,cardiopatias:false,hepatitis:false,vih:false,epilepsia:false,embarazo:false,
  alergias_medicamentos:"",medicamentos_actuales:"",
  estado_dental:{higiene_oral:"",encia:"",mucosa_oral:"",lengua:"",paladar:"",atm:""},
  diagnostico:"",cie10_codigo:"",cie10_descripcion:"",
  plan_tratamiento:"",procedimientos_realizados:"",materiales_utilizados:"",
  proximo_control:"",observaciones:"",
  medicamentos:[],
  servicios_realizados:[],
};

export const OdontologiaFormSimple = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading]     = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [existingHistory, setExistingHistory] = useState(null);
  const [form, setForm]           = useState(FORM0);
  const [tab, setTab]             = useState("historia");
  const [catalogo, setCatalogo]   = useState([]);
  const [busqCat, setBusqCat]     = useState("");
  const [cie10q, setCie10q]       = useState("");
  const [cie10open, setCie10open] = useState(false);

  // Cargar catálogo odontología
  useEffect(() => {
    axios.get(`${API}/financial/catalogo?especialidad=Odontología`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r => setCatalogo(r.data||[])).catch(()=>{});
  }, [token]);

  // Cargar historia existente
  useEffect(() => {
    if (!appointment?.id){setLoadingData(false);return;}
    axios.get(`${API}/medical-history/odontology/appointment/${appointment.id}`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>{
        if(r.data){
          setExistingHistory(r.data);
          const h=r.data;
          setForm(f=>({...f,
            motivo_consulta:h.motivo_consulta||"",dolor_dental:h.dolor_dental||false,
            ubicacion_dolor:h.ubicacion_dolor||"",intensidad_dolor:h.intensidad_dolor||"",
            ultima_visita_odonto:h.ultima_visita_odonto||"",frecuencia_cepillado:h.frecuencia_cepillado||"",
            uso_hilo_dental:h.uso_hilo_dental||false,uso_enjuague:h.uso_enjuague||false,
            tratamientos_previos:h.tratamientos_previos||"",
            diabetes:h.diabetes||false,hipertension:h.hipertension||false,
            cardiopatias:h.cardiopatias||false,hepatitis:h.hepatitis||false,
            vih:h.vih||false,epilepsia:h.epilepsia||false,embarazo:h.embarazo||false,
            alergias_medicamentos:h.alergias_medicamentos||"",medicamentos_actuales:h.medicamentos_actuales||"",
            estado_dental:h.estado_dental||f.estado_dental,
            diagnostico:h.diagnostico||"",cie10_codigo:h.cie10_codigo||"",cie10_descripcion:h.cie10_descripcion||"",
            plan_tratamiento:h.plan_tratamiento||"",procedimientos_realizados:h.procedimientos_realizados||"",
            materiales_utilizados:h.materiales_utilizados||"",proximo_control:h.proximo_control||"",
            observaciones:h.observaciones||"",medicamentos:[],servicios_realizados:[],
          }));
          toast.info("Consulta anterior cargada");
        }
      })
      .catch(e=>{if(e.response?.status!==404)console.error(e);else toast.success("Nueva consulta — formulario listo");})
      .finally(()=>setLoadingData(false));
  }, [appointment?.id, token]);

  const setED = (k,v) => setForm(f=>({...f,estado_dental:{...f.estado_dental,[k]:v}}));

  const toggleSrv = (srv) => {
    const ex = form.servicios_realizados.find(s=>s.id===srv.id);
    setForm(f=>({...f,servicios_realizados: ex
      ? f.servicios_realizados.filter(s=>s.id!==srv.id)
      : [...f.servicios_realizados,{...srv,cantidad:1}]
    }));
  };

  const totalSrv = form.servicios_realizados.reduce((a,s)=>a+(s.precio_base*(s.cantidad||1)),0);

  const cie10fil = cie10q.length>=1
    ? CIE10_ODONTO.filter(c=>c.codigo.toLowerCase().includes(cie10q.toLowerCase())||c.descripcion.toLowerCase().includes(cie10q.toLowerCase())).slice(0,12)
    : CIE10_ODONTO.slice(0,12);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!form.motivo_consulta.trim()){toast.error("Motivo de consulta obligatorio");return;}
    if(!form.diagnostico.trim()&&!form.cie10_codigo){toast.error("El diagnóstico es obligatorio");return;}
    if(form.servicios_realizados.length===0){toast.error("Seleccione procedimientos en la pestaña Cobro");return;}
    setLoading(true);
    try {
      const p={appointment_id:appointment.id,
        motivo_consulta:form.motivo_consulta,dolor_dental:form.dolor_dental,ubicacion_dolor:form.ubicacion_dolor,
        intensidad_dolor:form.intensidad_dolor,ultima_visita_odonto:form.ultima_visita_odonto,
        frecuencia_cepillado:form.frecuencia_cepillado,uso_hilo_dental:form.uso_hilo_dental,
        uso_enjuague:form.uso_enjuague,tratamientos_previos:form.tratamientos_previos,
        diabetes:form.diabetes,hipertension:form.hipertension,cardiopatias:form.cardiopatias,
        hepatitis:form.hepatitis,vih:form.vih,epilepsia:form.epilepsia,embarazo:form.embarazo,
        alergias_medicamentos:form.alergias_medicamentos,medicamentos_actuales:form.medicamentos_actuales,
        estado_dental:form.estado_dental,
        diagnostico:form.diagnostico||form.cie10_descripcion||"",cie10_codigo:form.cie10_codigo,
        plan_tratamiento:form.plan_tratamiento||"Ver odontograma",
        procedimientos_realizados:form.procedimientos_realizados,
        materiales_utilizados:form.materiales_utilizados,
        medicamentos:"",proximo_control:form.proximo_control,observaciones:form.observaciones,
      };
      if(existingHistory){
        await axios.put(`${API}/medical-history/odontology/${existingHistory.id}`,p,{headers:{Authorization:`Bearer ${token}`}});
      } else {
        await axios.post(`${API}/medical-history/odontology`,p,{headers:{Authorization:`Bearer ${token}`}});
      }
      toast.success("Historia guardada");

      // Consulta financiera con procedimientos REALES
      try {
        await axios.post(`${API}/financial/consultas/desde-cita/${appointment.id}`,
          form.servicios_realizados.map(s=>({servicio:s.nombre,descripcion:s.nombre,precio_unitario:s.precio_base,cantidad:s.cantidad||1})),
          {headers:{Authorization:`Bearer ${token}`}});
        toast.success(`Cobro creado — $${totalSrv.toFixed(2)}`);
      } catch(err){if(err.response?.status!==400)toast.warning("Error en consulta financiera");}

      // Registrar evolución de sesión
      try {
        await axios.post(`${API}/evoluciones-sesion`,{
          appointment_id:appointment.id,paciente_cedula:appointment.cedula||"",
          paciente_nombre:appointment.nombre_completo||"",
          doctor_id:appointment.doctor_id||"",doctor_nombre:appointment.doctor_nombre||"",
          fecha:new Date().toISOString().split("T")[0],
          motivo_sesion:form.motivo_consulta,
          procedimientos_realizados:form.servicios_realizados.map(s=>({
            diente_numero:"",procedimiento:s.nombre,precio:s.precio_base*(s.cantidad||1),indicaciones:""
          })),
          evolucion:form.procedimientos_realizados||form.diagnostico,
          proximo_procedimiento:form.plan_tratamiento,
          total_sesion:totalSrv,estado_pago:"pendiente",
        },{headers:{Authorization:`Bearer ${token}`}});
      } catch{ /* silencioso si ya existe */ }

      // Receta opcional
      const meds=form.medicamentos.filter(m=>m.nombre?.trim());
      if(meds.length>0){
        try{await axios.post(`${API}/prescriptions`,{
          appointment_id:appointment.id,paciente_cedula:appointment.cedula,
          diagnostico:form.diagnostico,cie10_codigo:form.cie10_codigo,
          medicamentos:meds,especialidad:"Odontología"
        },{headers:{Authorization:`Bearer ${token}`}});toast.success("Receta creada");}
        catch{toast.warning("Historia guardada. Error en receta.");}
      }

      onSuccess();onClose();
    } catch(err){toast.error(err.response?.data?.detail||"Error al guardar");}
    setLoading(false);
  };

  const handleProforma = async () => {
    if(form.servicios_realizados.length===0){toast.error("Seleccione procedimientos primero");return;}
    try{
      const res=await axios.post(`${API}/proformas`,{
        paciente_id:appointment.id,paciente_cedula:appointment.cedula,
        paciente_nombre:appointment.nombre_completo,doctor_id:appointment.doctor_id||"",
        doctor_nombre:appointment.doctor_nombre||"",especialidad:"Odontología",
        diagnostico:form.diagnostico||"Tratamiento odontológico",
        items:form.servicios_realizados.map(s=>({nombre:s.nombre,descripcion:s.nombre,cantidad:s.cantidad||1,precio:s.precio_base,subtotal:s.precio_base*(s.cantidad||1)})),
        total:totalSrv,descuento:0,
      },{headers:{Authorization:`Bearer ${token}`}});
      toast.success(`Proforma ${res.data.numero_proforma||""} creada`);
    }catch(err){toast.error(err.response?.data?.detail||"Error al crear proforma");}
  };

  if(loadingData) return <div style={{textAlign:"center",padding:"40px",color:"#d97706"}}>Cargando...</div>;

  const TABS=[
    {id:"historia",   label:"📋 Historia"},
    {id:"odontograma",label:"🦷 Odontograma"},
    {id:"plan",       label:"📅 Plan Tratamiento"},
    {id:"evoluciones",label:"📊 Evoluciones"},
    {id:"cobro",      label:"💰 Cobro"},
    {id:"fotos",      label:"📷 Fotos/RX"},
  ];

  const catFil = busqCat ? catalogo.filter(s=>s.nombre.toLowerCase().includes(busqCat.toLowerCase())) : catalogo;

  return (
    <div style={{display:"flex",height:"100%",gap:0}}>
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>

        {/* Encabezado */}
        <div style={{background:"linear-gradient(135deg,#d97706,#92400e)",borderRadius:"10px",padding:"12px 16px",marginBottom:"12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h2 style={{color:"white",margin:0,fontSize:"15px",fontWeight:"700"}}>🦷 Odontología</h2>
            <p style={{color:"rgba(255,255,255,0.8)",margin:"2px 0 0",fontSize:"12px"}}>{appointment.nombre_completo} · {appointment.cedula}</p>
          </div>
          <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
            {form.servicios_realizados.length>0 && (
              <span style={{background:"rgba(255,255,255,0.2)",color:"white",borderRadius:"6px",padding:"3px 8px",fontSize:"11px"}}>
                💰 ${totalSrv.toFixed(2)}
              </span>
            )}
            {existingHistory && <span style={{background:"rgba(255,255,255,0.2)",color:"white",borderRadius:"6px",padding:"3px 8px",fontSize:"11px"}}>✏️ Editando</span>}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:"4px",marginBottom:"14px",flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t.id} type="button" onClick={()=>setTab(t.id)} style={{
              padding:"7px 12px",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:"600",fontSize:"12px",
              background:tab===t.id?"#d97706":"#f3f4f6",color:tab===t.id?"white":"#374151",transition:"all 0.2s",
              whiteSpace:"nowrap"
            }}>{t.label}</button>
          ))}
        </div>

        {/* ══ TAB HISTORIA ══ */}
        {tab==="historia" && (
          <form onSubmit={handleSubmit}>
            <div style={S.sec}>📝 MOTIVO DE CONSULTA</div>
            <div style={{marginBottom:"10px"}}>
              <Label style={S.l}>Motivo *</Label>
              <Textarea value={form.motivo_consulta} onChange={e=>setForm(f=>({...f,motivo_consulta:e.target.value}))} rows={2} style={{fontSize:"13px",borderColor:"#fde68a"}}/>
            </div>
            <div style={{display:"flex",gap:"12px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center"}}>
              <label style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"13px",fontWeight:"600",color:"#92400e"}}>
                <Checkbox checked={form.dolor_dental} onCheckedChange={v=>setForm(f=>({...f,dolor_dental:v}))}/> Dolor dental
              </label>
              {form.dolor_dental&&(<>
                <Input value={form.ubicacion_dolor} onChange={e=>setForm(f=>({...f,ubicacion_dolor:e.target.value}))} placeholder="Pieza" style={{...S.i,width:"100px"}}/>
                <Select value={form.intensidad_dolor} onValueChange={v=>setForm(f=>({...f,intensidad_dolor:v}))}>
                  <SelectTrigger style={{...S.i,width:"120px"}}><SelectValue placeholder="Intensidad"/></SelectTrigger>
                  <SelectContent>{["Leve","Moderado","Severo"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </>)}
            </div>

            <div style={S.sec}>📂 ANTECEDENTES</div>
            <AntecedentesPanel cedula={appointment.cedula} token={token} especialidad="Odontología"
              onLoad={ant=>setForm(f=>({...f,diabetes:ant.diabetes||f.diabetes,hipertension:ant.hipertension||f.hipertension,
                cardiopatias:ant.cardiopatias||f.cardiopatias,hepatitis:ant.hepatitis||f.hepatitis,
                vih:ant.vih||f.vih,epilepsia:ant.epilepsia||f.epilepsia,
                alergias_medicamentos:ant.alergias_medicamentos||f.alergias_medicamentos,
                medicamentos_actuales:ant.medicamentos_actuales||f.medicamentos_actuales}))}
              onChange={ant=>setForm(f=>({...f,alergias_medicamentos:ant.alergias_medicamentos||f.alergias_medicamentos,
                medicamentos_actuales:ant.medicamentos_actuales||f.medicamentos_actuales}))}
            />
            <div style={{background:"#fffbeb",borderRadius:"8px",padding:"10px",marginBottom:"10px",marginTop:"8px"}}>
              <div style={S.g3}>
                <div style={S.f}><Label style={S.l}>Última visita</Label>
                  <Input value={form.ultima_visita_odonto} onChange={e=>setForm(f=>({...f,ultima_visita_odonto:e.target.value}))} style={S.i}/></div>
                <div style={S.f}><Label style={S.l}>Cepillado</Label>
                  <Select value={form.frecuencia_cepillado} onValueChange={v=>setForm(f=>({...f,frecuencia_cepillado:v}))}>
                    <SelectTrigger style={S.i}><SelectValue placeholder="Seleccionar"/></SelectTrigger>
                    <SelectContent>{["1 vez/día","2 veces/día","3 veces/día","Irregular"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div style={{display:"flex",gap:"10px",alignItems:"center",paddingTop:"20px"}}>
                  {[["uso_hilo_dental","Hilo"],["uso_enjuague","Enjuague"]].map(([k,l])=>(
                    <label key={k} style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"12px"}}>
                      <Checkbox checked={form[k]} onCheckedChange={v=>setForm(f=>({...f,[k]:v}))}/>{l}</label>
                  ))}
                </div>
                <div style={{...S.f,gridColumn:"1/-1"}}><Label style={S.l}>Tratamientos previos</Label>
                  <Input value={form.tratamientos_previos} onChange={e=>setForm(f=>({...f,tratamientos_previos:e.target.value}))} style={S.i}/></div>
              </div>
            </div>

            <div style={S.sec}>🔍 EXAMEN CLÍNICO</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"10px"}}>
              {[["higiene_oral","Higiene",["Buena","Regular","Mala"]],["encia","Encías",["Sana","Gingivitis","Periodontitis"]],
                ["mucosa_oral","Mucosa",["Normal","Alterada"]],["lengua","Lengua",["Normal","Alterada"]],
                ["paladar","Paladar",["Normal","Alterado"]],["atm","ATM",["Normal","Crepitación","Dolor","Limitación"]],
              ].map(([k,l,ops])=>(
                <div key={k} style={S.f}><Label style={{...S.l,fontSize:"11px"}}>{l}</Label>
                  <Select value={form.estado_dental[k]} onValueChange={v=>setED(k,v)}>
                    <SelectTrigger style={{...S.i,fontSize:"12px"}}><SelectValue placeholder="..."/></SelectTrigger>
                    <SelectContent>{ops.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select></div>
              ))}
            </div>

            {/* ASISTENTE IA ODONTOLÓGICO */}
            <IAMedicaPanel
              especialidad="Odontología"
              token={token}
              contexto={{
                nombre: appointment.nombre_completo,
                edad: appointment.edad || "",
                sexo: appointment.sexo || "",
                motivo_consulta: form.motivo_consulta,
                antecedentes: `Última visita: ${form.ultima_visita_odonto} | Alergias: ${form.alergias_medicamentos} | HTA: ${form.hipertension} | Diabetes: ${form.diabetes}`,
                alergias: form.alergias_medicamentos,
                medicamentos_actuales: form.medicamentos_actuales || "",
                diagnostico_previo: form.diagnostico || "",
              }}
              onUsarSugerencia={texto => setForm(f => ({
                ...f,
                diagnostico: f.diagnostico ? f.diagnostico + "\n[IA]: " + texto : texto,
              }))}
            />

            <div style={S.sec}>🩺 DIAGNÓSTICO CIE-10</div>
            <div style={{marginBottom:"10px"}}>
              {form.cie10_codigo?(
                <div style={{display:"flex",alignItems:"center",gap:"8px",background:"#fff7ed",border:"1.5px solid #d97706",borderRadius:"8px",padding:"8px 12px"}}>
                  <span style={{background:"#d97706",color:"white",borderRadius:"6px",padding:"2px 8px",fontSize:"12px",fontWeight:"700"}}>{form.cie10_codigo}</span>
                  <span style={{fontSize:"13px",flex:1}}>{form.cie10_descripcion}</span>
                  <button type="button" onClick={()=>setForm(f=>({...f,cie10_codigo:"",cie10_descripcion:""}))} style={{background:"none",border:"none",cursor:"pointer",color:"#999",fontSize:"16px"}}>✕</button>
                </div>
              ):(
                <div style={{position:"relative"}}>
                  <Input placeholder="🔍 Buscar CIE-10 dental (caries, pulpitis, extracción...)"
                    value={cie10q} onChange={e=>{setCie10q(e.target.value);setCie10open(true);}}
                    onFocus={()=>setCie10open(true)} style={{borderColor:"#d97706"}}/>
                  {cie10open&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:1000,background:"white",border:"1.5px solid #d97706",borderRadius:"8px",boxShadow:"0 8px 24px rgba(0,0,0,0.15)",maxHeight:"240px",overflowY:"auto",marginTop:"2px"}}>
                      {cie10fil.map(item=>(
                        <div key={item.codigo} onClick={()=>{setForm(f=>({...f,cie10_codigo:item.codigo,cie10_descripcion:item.descripcion,diagnostico:f.diagnostico||item.descripcion}));setCie10q("");setCie10open(false);}}
                          style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #f0f0f0"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#fffbeb"}
                          onMouseLeave={e=>e.currentTarget.style.background="white"}>
                          <span style={{background:"#92400e",color:"white",borderRadius:"5px",padding:"2px 7px",fontSize:"11px",fontWeight:"700",whiteSpace:"nowrap"}}>{item.codigo}</span>
                          <span style={{fontSize:"12px",color:"#333"}}>{item.descripcion}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{marginTop:"8px"}}><Label style={S.l}>Diagnóstico clínico *</Label>
                <Textarea value={form.diagnostico} onChange={e=>setForm(f=>({...f,diagnostico:e.target.value}))}
                  rows={2} style={{fontSize:"13px",borderColor:"#fde68a"}}/></div>
            </div>

            <div style={S.sec}>🔧 TRATAMIENTO</div>
            <div style={{...S.g2,marginBottom:"10px"}}>
              <div style={S.f}><Label style={S.l}>Procedimientos realizados hoy</Label>
                <Textarea value={form.procedimientos_realizados} onChange={e=>setForm(f=>({...f,procedimientos_realizados:e.target.value}))} rows={3} style={{fontSize:"13px",borderColor:"#fde68a"}}/></div>
              <div style={S.f}><Label style={S.l}>Plan de tratamiento</Label>
                <Textarea value={form.plan_tratamiento} onChange={e=>setForm(f=>({...f,plan_tratamiento:e.target.value}))} rows={3} style={{fontSize:"13px",borderColor:"#fde68a"}}/></div>
              <div style={S.f}><Label style={S.l}>Materiales</Label>
                <Input value={form.materiales_utilizados} onChange={e=>setForm(f=>({...f,materiales_utilizados:e.target.value}))} style={S.i}/></div>
              <div style={S.f}><Label style={S.l}>Próximo control</Label>
                <Input type="date" value={form.proximo_control} onChange={e=>setForm(f=>({...f,proximo_control:e.target.value}))} style={S.i}/></div>
              <div style={{...S.f,gridColumn:"1/-1"}}><Label style={S.l}>Observaciones</Label>
                <Textarea value={form.observaciones} onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))} rows={2} style={{fontSize:"13px",borderColor:"#fde68a"}}/></div>
            </div>

            <div style={{marginBottom:"12px"}}>
              <MedicacionRapida especialidad="Odontología" medicamentos={form.medicamentos}
                onChange={meds=>setForm(f=>({...f,medicamentos:meds}))}/>
            </div>

            {form.servicios_realizados.length===0?(
              <div style={{background:"#fffbeb",border:"1.5px solid #fbbf24",borderRadius:"8px",padding:"10px 14px",marginBottom:"12px"}}>
                <p style={{margin:0,fontSize:"12px",color:"#92400e"}}>
                  ⚠️ <strong>Ve a la pestaña "💰 Cobro"</strong> y selecciona los procedimientos realizados para poder terminar la consulta.
                </p>
              </div>
            ):(
              <div style={{background:"#f0fbff",border:"1.5px solid #00a8cc",borderRadius:"8px",padding:"10px 14px",marginBottom:"12px"}}>
                <p style={{margin:"0 0 4px",fontSize:"12px",fontWeight:"700",color:"#005f73"}}>
                  ✅ {form.servicios_realizados.length} procedimiento(s) — Total: ${totalSrv.toFixed(2)}
                </p>
                <p style={{margin:0,fontSize:"11px",color:"#666"}}>{form.servicios_realizados.map(s=>s.nombre).join(", ")}</p>
              </div>
            )}

            <div style={{display:"flex",gap:"10px",justifyContent:"flex-end",paddingBottom:"20px"}}>
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button type="submit" disabled={loading} style={{background:"#d97706",color:"white"}}>
                {loading?"Guardando...":existingHistory?"Actualizar Consulta":"Terminar Consulta"}
              </Button>
            </div>
          </form>
        )}

        {/* ══ TAB ODONTOGRAMA ══ */}
        {tab==="odontograma" && (
          <div style={{height:"600px"}}>
            <OdontogramaClinicoTab pacienteId={appointment.id} pacienteCedula={appointment.cedula}
              pacienteNombre={appointment.nombre_completo} token={token}/>
          </div>
        )}

        {/* ══ TAB PLAN DE TRATAMIENTO ══ */}
        {tab==="plan" && (
          <PlanTratamientoTab token={token} pacienteId={appointment.id}
            pacienteNombre={appointment.nombre_completo} pacienteCedula={appointment.cedula}
            doctorId={appointment.doctor_id||""} odontogramaId=""/>
        )}

        {/* ══ TAB EVOLUCIONES ══ */}
        {tab==="evoluciones" && (
          <EvolucionesTab pacienteCedula={appointment.cedula} token={token}/>
        )}

        {/* ══ TAB COBRO ══ */}
        {tab==="cobro" && (
          <div>
            <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:"10px",padding:"14px",marginBottom:"12px"}}>
              <p style={{margin:"0 0 8px",fontSize:"13px",fontWeight:"700",color:"#92400e"}}>
                ✅ Selecciona los procedimientos realizados HOY
              </p>
              <Input placeholder="🔍 Buscar procedimiento..." value={busqCat}
                onChange={e=>setBusqCat(e.target.value)} style={{marginBottom:"10px",fontSize:"13px"}}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",maxHeight:"320px",overflowY:"auto"}}>
                {catFil.map(srv=>{
                  const sel=form.servicios_realizados.find(s=>s.id===srv.id);
                  return(
                    <div key={srv.id} onClick={()=>toggleSrv(srv)} style={{
                      border:`2px solid ${sel?"#d97706":"#e5e7eb"}`,borderRadius:"8px",padding:"8px 10px",cursor:"pointer",
                      background:sel?"#fff7ed":"white",display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.15s"
                    }}>
                      <p style={{margin:0,fontSize:"12px",fontWeight:sel?"700":"500",color:sel?"#92400e":"#374151"}}>{srv.nombre}</p>
                      <div style={{textAlign:"right",minWidth:"55px"}}>
                        <p style={{margin:0,fontSize:"13px",fontWeight:"700",color:sel?"#d97706":"#555"}}>${srv.precio_base.toFixed(2)}</p>
                        {sel&&<span style={{fontSize:"10px",color:"#059669"}}>✓</span>}
                      </div>
                    </div>
                  );
                })}
                {catFil.length===0&&<p style={{gridColumn:"1/-1",textAlign:"center",color:"#999",padding:"20px",fontSize:"13px"}}>Sin servicios. Ejecuta el Seed del catálogo en Admin.</p>}
              </div>
            </div>

            {form.servicios_realizados.length>0&&(
              <div style={{background:"#f0fbff",border:"1.5px solid #00a8cc",borderRadius:"10px",padding:"14px"}}>
                <p style={{margin:"0 0 10px",fontSize:"13px",fontWeight:"700",color:"#005f73"}}>📋 Seleccionados:</p>
                {form.servicios_realizados.map((s,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #e0f7fa"}}>
                    <span style={{fontSize:"13px",color:"#333"}}>{s.nombre}</span>
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <input type="number" min="1" value={s.cantidad||1}
                        onChange={e=>{const c=parseInt(e.target.value)||1;setForm(f=>({...f,servicios_realizados:f.servicios_realizados.map((srv,idx)=>idx===i?{...srv,cantidad:c}:srv)}));}}
                        style={{width:"46px",padding:"2px 6px",border:"1px solid #b2ebf2",borderRadius:"4px",fontSize:"12px",textAlign:"center"}}/>
                      <span style={{fontSize:"13px",fontWeight:"700",color:"#00a8cc",minWidth:"55px",textAlign:"right"}}>${(s.precio_base*(s.cantidad||1)).toFixed(2)}</span>
                      <button type="button" onClick={()=>toggleSrv(s)} style={{background:"#fee2e2",border:"none",color:"#dc2626",borderRadius:"4px",padding:"2px 6px",fontSize:"11px",cursor:"pointer"}}>✕</button>
                    </div>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",marginTop:"10px",paddingTop:"8px",borderTop:"2px solid #00a8cc"}}>
                  <span style={{fontWeight:"700",fontSize:"15px",color:"#005f73"}}>TOTAL A COBRAR:</span>
                  <span style={{fontWeight:"800",fontSize:"18px",color:"#00a8cc"}}>${totalSrv.toFixed(2)}</span>
                </div>
                <button type="button" onClick={handleProforma}
                  style={{width:"100%",marginTop:"10px",padding:"8px",background:"white",border:"2px solid #d97706",color:"#d97706",borderRadius:"8px",fontSize:"13px",fontWeight:"700",cursor:"pointer"}}>
                  📄 Crear Proforma (para plan de tratamiento futuro)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB FOTOS/RX ══ */}
        {tab==="fotos" && (
          <FotosRXTab
            pacienteCedula={appointment.cedula}
            pacienteNombre={appointment.nombre_completo}
            appointmentId={appointment.id}
            doctorNombre={appointment.doctor_nombre||""}
            token={token}
            especialidad="Odontología"
          />
        )}
      </div>

      <HistorialLateral cedula={appointment.cedula} token={token} especialidadActual="Odontología"/>
    </div>
  );
};