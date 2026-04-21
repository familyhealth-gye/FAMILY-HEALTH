import { useState, useRef, useEffect } from "react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const IAMedicaPanel = ({ especialidad = "Medicina General", token, contexto = {}, onUsarSugerencia }) => {
  const [abierto, setAbierto]       = useState(false);
  const [modo, setModo]             = useState("sugerencia");
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [historial, setHistorial]   = useState([]);
  const [sugerencia, setSugerencia] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [historial]);

  const llamarIA = async (mensaje, hist = []) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/ia/consulta-medica`, {
        mensaje, especialidad, contexto_paciente: contexto, historial: hist,
      }, { headers: { Authorization: `Bearer ${token}` } });
      return res.data.respuesta || "Sin respuesta.";
    } catch (err) {
      const detail = err.response?.data?.detail || "";
      if (err.response?.status === 503) return "⚠️ IA no configurada. El Administrador debe ir a **Config. IA** → guardar API key de Gemini (gratis en aistudio.google.com).";
      if (err.response?.status === 429) return "⏳ Límite alcanzado. Espera unos minutos.";
      return `❌ ${detail || "Error de conexión con la IA."}`;
    } finally { setLoading(false); }
  };

  const BOTONES = {
    "Medicina General": [
      {id:"dx",label:"🩺 Diagnósticos + CIE-10"},{id:"tx",label:"💊 Tratamiento"},
      {id:"alarma",label:"⚠️ Signos alarma"},{id:"referir",label:"🏥 ¿Referir?"},
    ],
    "Odontología": [
      {id:"dx",label:"🦷 Diagnóstico + CIE-10"},{id:"tx",label:"🔧 Plan tratamiento"},
      {id:"anestesia",label:"💉 Anestesia"},{id:"alarma",label:"⚠️ Signos alarma"},
    ],
    "Pediatría": [
      {id:"dx",label:"👶 Diferenciales"},{id:"tx",label:"💊 Dosis pediátrica"},
      {id:"alarma",label:"⚠️ Signos alarma"},{id:"referir",label:"🏥 ¿Referir?"},
    ],
    "Nutrición": [
      {id:"plan",label:"🥗 Plan nutricional"},{id:"imc",label:"📊 Interpretar IMC"},
      {id:"tx",label:"💊 Suplementación"},{id:"alarma",label:"⚠️ Alertas"},
    ],
    "Ginecología": [
      {id:"dx",label:"🩺 Diagnóstico"},{id:"tx",label:"💊 Tratamiento"},
      {id:"prenatal",label:"🤱 Control prenatal"},{id:"alarma",label:"⚠️ Signos alarma"},
    ],
    "Ecografía": [
      {id:"hallazgos",label:"🔍 Interpretar hallazgos"},
      {id:"dx",label:"🩺 Diferencial"},{id:"referir",label:"🏥 ¿Urgente?"},
    ],
  };
  const PROMPTS = {
    dx:"Da los 3 diagnósticos diferenciales más probables con códigos CIE-10, basándote en el contexto del paciente.",
    tx:"Sugiere el tratamiento farmacológico más apropiado con medicamentos, dosis y duración.",
    alarma:"¿Cuáles son los signos de alarma que el médico debe explicar al paciente y cuándo debe volver de urgencia?",
    referir:"¿Este caso requiere referencia a especialista? ¿A quién y con qué urgencia?",
    anestesia:"¿Qué protocolo de anestesia local es más adecuado considerando los antecedentes y alergias del paciente?",
    plan:"Sugiere un plan nutricional base de 7 días adaptado al diagnóstico nutricional del paciente.",
    imc:"Interpreta los datos de IMC y antropometría, indica clasificación y riesgos.",
    prenatal:"¿Qué controles, exámenes y cuidados corresponden según el trimestre de embarazo?",
    hallazgos:"El médico describe hallazgos ecográficos. Ayuda a interpretarlos y sugiere diagnósticos probables.",
  };

  const btns = BOTONES[especialidad] || BOTONES["Medicina General"];
  const fmt = (t) => t.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/\n/g,"<br/>");

  const handleBoton = async (id) => { setSugerencia(""); const r = await llamarIA(PROMPTS[id]||id); if(r) setSugerencia(r); };
  const handleCustom = async () => { if(!input.trim()) return; const m=input.trim(); setInput(""); setSugerencia(""); const r=await llamarIA(m); if(r) setSugerencia(r); };
  const handleChat = async () => {
    if(!input.trim()) return;
    const m=input.trim(); setInput("");
    const h=[...historial,{rol:"user",texto:m}]; setHistorial(h);
    const r=await llamarIA(m,historial);
    setHistorial([...h,{rol:"assistant",texto:r}]);
  };

  if (!abierto) return (
    <div onClick={()=>setAbierto(true)} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:"10px",padding:"10px 16px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"10px",cursor:"pointer",boxShadow:"0 2px 12px rgba(99,102,241,0.25)"}}>
      <span style={{fontSize:"20px"}}>🤖</span>
      <div>
        <p style={{margin:0,color:"white",fontWeight:"700",fontSize:"13px"}}>Asistente IA — {especialidad}</p>
        <p style={{margin:0,color:"rgba(255,255,255,0.75)",fontSize:"11px"}}>Diagnósticos · Tratamientos · Chat médico · Click para abrir</p>
      </div>
      <span style={{marginLeft:"auto",color:"white",fontSize:"16px"}}>▼</span>
    </div>
  );

  return (
    <div style={{border:"2px solid #6366f1",borderRadius:"12px",overflow:"hidden",marginBottom:"12px",boxShadow:"0 4px 20px rgba(99,102,241,0.15)"}}>
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"18px"}}>🤖</span>
          <div>
            <p style={{margin:0,color:"white",fontWeight:"700",fontSize:"13px"}}>Asistente IA — {especialidad}</p>
            <p style={{margin:0,color:"rgba(255,255,255,0.7)",fontSize:"10px"}}>Gemini Flash · Solo apoyo, no reemplaza el criterio médico</p>
          </div>
        </div>
        <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
          {contexto.nombre && <span style={{background:"rgba(255,255,255,0.15)",color:"white",borderRadius:"10px",padding:"2px 8px",fontSize:"10px"}}>📋 {contexto.nombre}{contexto.edad?`, ${contexto.edad}a`:""}</span>}
          <div style={{background:"rgba(255,255,255,0.15)",borderRadius:"8px",padding:"2px",display:"flex"}}>
            {[["sugerencia","⚡"],["chat","💬"]].map(([m,l])=>(
              <button key={m} onClick={()=>setModo(m)} style={{padding:"4px 10px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:"600",background:modo===m?"white":"transparent",color:modo===m?"#6366f1":"white"}}>{l} {m==="sugerencia"?"Sugerencias":"Chat"}</button>
            ))}
          </div>
          <button onClick={()=>setAbierto(false)} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"white",borderRadius:"50%",width:"24px",height:"24px",cursor:"pointer",fontSize:"14px"}}>×</button>
        </div>
      </div>

      {/* SUGERENCIAS */}
      {modo==="sugerencia" && (
        <div style={{padding:"12px",background:"#fafafa"}}>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
            {btns.map(b=>(
              <button key={b.id} onClick={()=>handleBoton(b.id)} disabled={loading} style={{padding:"6px 12px",background:"white",border:"1.5px solid #6366f1",borderRadius:"8px",cursor:loading?"not-allowed":"pointer",fontSize:"12px",fontWeight:"600",color:"#6366f1",opacity:loading?0.6:1}}>{b.label}</button>
            ))}
          </div>
          {loading && <div style={{textAlign:"center",padding:"16px",color:"#6366f1"}}><span style={{fontSize:"20px"}}>⏳</span><p style={{margin:"6px 0 0",fontSize:"12px"}}>Consultando IA...</p></div>}
          {sugerencia && !loading && (
            <div style={{background:"white",border:"1.5px solid #e0e7ff",borderRadius:"10px",padding:"12px"}}>
              <div style={{fontSize:"13px",lineHeight:"1.6",color:"#1f2937"}} dangerouslySetInnerHTML={{__html:fmt(sugerencia)}}/>
              <div style={{display:"flex",gap:"8px",marginTop:"10px"}}>
                {onUsarSugerencia && <button onClick={()=>onUsarSugerencia(sugerencia)} style={{padding:"5px 12px",background:"#6366f1",color:"white",border:"none",borderRadius:"6px",fontSize:"12px",cursor:"pointer",fontWeight:"600"}}>✓ Usar en formulario</button>}
                <button onClick={()=>setSugerencia("")} style={{padding:"5px 10px",background:"#f3f4f6",border:"none",borderRadius:"6px",fontSize:"12px",cursor:"pointer"}}>Limpiar</button>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:"6px",marginTop:"10px"}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!loading&&handleCustom()} placeholder="Pregunta específica sobre este caso..." style={{flex:1,padding:"8px 12px",border:"1.5px solid #c7d2fe",borderRadius:"8px",fontSize:"13px"}}/>
            <button onClick={handleCustom} disabled={loading||!input.trim()} style={{padding:"8px 14px",background:"#6366f1",color:"white",border:"none",borderRadius:"8px",fontSize:"13px",cursor:loading||!input.trim()?"not-allowed":"pointer",fontWeight:"700",opacity:loading||!input.trim()?0.6:1}}>→</button>
          </div>
        </div>
      )}

      {/* CHAT */}
      {modo==="chat" && (
        <div style={{background:"#fafafa"}}>
          <div style={{maxHeight:"280px",overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:"8px"}}>
            {historial.length===0 && (
              <div style={{textAlign:"center",padding:"20px",color:"#9ca3af"}}>
                <p style={{fontSize:"24px",margin:0}}>💬</p>
                <p style={{fontSize:"12px",margin:"6px 0 0"}}>Tengo el contexto de <strong>{contexto.nombre||"este paciente"}</strong> cargado.<br/>Pregúntame lo que necesites.</p>
              </div>
            )}
            {historial.map((msg,i)=>(
              <div key={i} style={{display:"flex",justifyContent:msg.rol==="user"?"flex-end":"flex-start"}}>
                <div style={{maxWidth:"80%",padding:"8px 12px",borderRadius:"10px",fontSize:"12px",lineHeight:"1.5",background:msg.rol==="user"?"#6366f1":"white",color:msg.rol==="user"?"white":"#1f2937",border:msg.rol==="user"?"none":"1.5px solid #e0e7ff"}}>
                  {msg.rol==="assistant"?<div dangerouslySetInnerHTML={{__html:fmt(msg.texto)}}/>:msg.texto}
                  {msg.rol==="assistant"&&onUsarSugerencia&&<button onClick={()=>onUsarSugerencia(msg.texto)} style={{marginTop:"6px",padding:"2px 8px",display:"block",background:"#e0e7ff",color:"#6366f1",border:"none",borderRadius:"4px",fontSize:"10px",cursor:"pointer"}}>✓ Usar en formulario</button>}
                </div>
              </div>
            ))}
            {loading && <div style={{display:"flex",justifyContent:"flex-start"}}><div style={{background:"white",border:"1.5px solid #e0e7ff",borderRadius:"10px",padding:"8px 14px",fontSize:"12px",color:"#6366f1"}}>⏳ Consultando IA...</div></div>}
            <div ref={chatEndRef}/>
          </div>
          <div style={{padding:"10px 12px",borderTop:"1px solid #e0e7ff",display:"flex",gap:"6px"}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!loading){e.preventDefault();handleChat();}}} placeholder="Pregunta sobre este paciente... (Enter para enviar)" style={{flex:1,padding:"8px 12px",border:"1.5px solid #c7d2fe",borderRadius:"8px",fontSize:"13px"}}/>
            <button onClick={handleChat} disabled={loading||!input.trim()} style={{padding:"8px 14px",background:"#6366f1",color:"white",border:"none",borderRadius:"8px",fontSize:"13px",cursor:loading||!input.trim()?"not-allowed":"pointer",fontWeight:"700",opacity:loading||!input.trim()?0.6:1}}>➤</button>
            {historial.length>0&&<button onClick={()=>setHistorial([])} style={{padding:"8px 10px",background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:"8px",fontSize:"12px",cursor:"pointer"}} title="Limpiar chat">🗑</button>}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{background:"#fef3c7",padding:"5px 12px",fontSize:"10px",color:"#92400e",textAlign:"center"}}>
        ⚕️ Apoyo informativo — Las sugerencias requieren validación del médico tratante
      </div>
    </div>
  );
};