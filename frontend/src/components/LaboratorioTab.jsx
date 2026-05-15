import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const INPUT = { width:"100%", padding:"8px 10px", border:"1.5px solid #b2ebf2", borderRadius:"7px", fontSize:"13px", boxSizing:"border-box" };
const LABEL = { fontSize:"11px", fontWeight:"700", color:"#005f73", display:"block", marginBottom:"3px" };
const CARD = { background:"white", borderRadius:"10px", padding:"14px 16px", border:"1px solid #e0f7fa", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", marginBottom:"12px" };

export const LaboratorioTab = ({ token, user }) => {
  const [vista, setVista] = useState("portal");
  const [labConfig, setLabConfig] = useState(null);
  const [envios, setEnvios] = useState([]);
  const [configForm, setConfigForm] = useState({ nombre:"Deltalab", link:"", notas:"" });
  const [envioForm, setEnvioForm] = useState({ paciente_cedula:"", paciente_nombre:"", examenes:"", fecha_envio: new Date().toISOString().split("T")[0], fecha_resultado_estimada:"", notas:"" });
  const [busqPaciente, setBusqPaciente] = useState("");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (vista === "historial") cargarEnvios(); }, [vista]);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/configuracion/laboratorio`, { headers });
      if (res.data?.link) { setLabConfig(res.data); setConfigForm(res.data); }
    } catch {}
  };

  const cargarEnvios = async () => {
    try { const res = await axios.get(`${API}/laboratorio/envios`, { headers }); setEnvios(res.data || []); }
    catch { setEnvios([]); }
  };

  const buscarPaciente = async (cedula) => {
    setBusqPaciente(cedula);
    setEnvioForm(f => ({ ...f, paciente_cedula: cedula }));
    if (cedula.length >= 10) {
      try {
        const res = await axios.get(`${API}/appointments?search=${cedula}`, { headers });
        const apts = res.data || [];
        if (apts.length > 0) { setEnvioForm(f => ({ ...f, paciente_nombre: apts[0].nombre_completo, paciente_cedula: apts[0].cedula })); toast.success(`✅ ${apts[0].nombre_completo}`); }
      } catch {}
    }
  };

  const guardarConfig = async () => {
    if (!configForm.link) { toast.error("Ingresa el link del portal"); return; }
    try { await axios.post(`${API}/configuracion/laboratorio`, configForm, { headers }); toast.success("✅ Link guardado"); setLabConfig(configForm); }
    catch (e) { toast.error(e.response?.data?.detail || "Error"); }
  };

  const registrarEnvio = async () => {
    if (!envioForm.paciente_nombre || !envioForm.examenes) { toast.error("Paciente y exámenes son obligatorios"); return; }
    try {
      await axios.post(`${API}/laboratorio/envio`, envioForm, { headers });
      toast.success("✅ Envío registrado");
      setEnvioForm({ paciente_cedula:"", paciente_nombre:"", examenes:"", fecha_envio: new Date().toISOString().split("T")[0], fecha_resultado_estimada:"", notas:"" });
      setBusqPaciente("");
      if (vista === "historial") cargarEnvios();
    } catch (e) { toast.error(e.response?.data?.detail || "Error"); }
  };

  const TABS = [["portal","🔗 Portal"],["registrar","📋 Registrar envío"],["historial","📂 Historial"], ...(user?.role==="Administrador" ? [["config","⚙️ Config"]] : [])];

  return (
    <div style={{ padding:"16px", maxWidth:"900px", margin:"0 auto" }}>
      <div style={{ background:"linear-gradient(135deg,#0284c7,#0ea5e9)", borderRadius:"12px", padding:"16px 20px", marginBottom:"16px" }}>
        <h2 style={{ color:"white", margin:0, fontSize:"18px", fontWeight:"800" }}>🔬 Laboratorio Externo</h2>
        <p style={{ color:"rgba(255,255,255,0.8)", margin:"4px 0 0", fontSize:"12px" }}>Portal Deltalab · Registro de exámenes enviados</p>
      </div>
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px" }}>
        {TABS.map(([id,label]) => (
          <button key={id} onClick={() => setVista(id)} style={{ padding:"8px 14px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:"600", fontSize:"13px", background: vista===id ? "#0284c7" : "#f0f9ff", color: vista===id ? "white" : "#0284c7" }}>{label}</button>
        ))}
      </div>

      {vista === "portal" && (
        <div>
          {labConfig?.link ? (
            <div style={CARD}>
              <p style={{ margin:"0 0 12px", fontWeight:"700", color:"#0284c7", fontSize:"15px" }}>🔬 {labConfig.nombre || "Portal de Laboratorio"}</p>
              {labConfig.notas && <p style={{ margin:"0 0 12px", fontSize:"13px", color:"#555" }}>{labConfig.notas}</p>}
              <a href={labConfig.link} target="_blank" rel="noreferrer" style={{ display:"inline-block", padding:"12px 24px", background:"#0284c7", color:"white", borderRadius:"8px", fontWeight:"700", fontSize:"14px", textDecoration:"none" }}>
                🔗 Abrir portal {labConfig.nombre}
              </a>
              <p style={{ margin:"10px 0 0", fontSize:"11px", color:"#999" }}>Se abre en nueva pestaña — usa las credenciales de la clínica</p>
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"50px", color:"#999" }}>
              <p style={{ fontSize:"40px", margin:0 }}>🔬</p>
              <p>Portal no configurado.</p>
              {user?.role === "Administrador" && <button onClick={() => setVista("config")} style={{ padding:"8px 16px", background:"#0284c7", color:"white", border:"none", borderRadius:"8px", cursor:"pointer" }}>⚙️ Configurar</button>}
            </div>
          )}
        </div>
      )}

      {vista === "registrar" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
          <div>
            <div style={CARD}>
              <p style={{ margin:"0 0 10px", fontWeight:"700", color:"#0284c7", fontSize:"13px" }}>👤 Paciente</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <div><label style={LABEL}>Cédula</label><input value={busqPaciente} onChange={e => buscarPaciente(e.target.value)} placeholder="Cédula para autocompletar" style={INPUT} /></div>
                <div><label style={LABEL}>Nombre *</label><input value={envioForm.paciente_nombre} onChange={e => setEnvioForm(f=>({...f,paciente_nombre:e.target.value}))} placeholder="Nombre completo" style={INPUT} /></div>
                <div><label style={LABEL}>Fecha de envío</label><input type="date" value={envioForm.fecha_envio} onChange={e => setEnvioForm(f=>({...f,fecha_envio:e.target.value}))} style={INPUT} /></div>
                <div><label style={LABEL}>Resultado estimado para</label><input type="date" value={envioForm.fecha_resultado_estimada} onChange={e => setEnvioForm(f=>({...f,fecha_resultado_estimada:e.target.value}))} style={INPUT} /></div>
              </div>
            </div>
          </div>
          <div>
            <div style={CARD}>
              <p style={{ margin:"0 0 10px", fontWeight:"700", color:"#0284c7", fontSize:"13px" }}>🧪 Exámenes solicitados *</p>
              <textarea value={envioForm.examenes} onChange={e => setEnvioForm(f=>({...f,examenes:e.target.value}))} rows={5}
                placeholder={"- Biometría hemática\n- Glucosa\n- Colesterol\n- TSH"} style={{ ...INPUT, resize:"vertical" }} />
              <div style={{ marginTop:"8px" }}><label style={LABEL}>Notas al paciente</label>
                <textarea value={envioForm.notas} onChange={e => setEnvioForm(f=>({...f,notas:e.target.value}))} rows={2} placeholder="Ej: Ayuno 8 horas..." style={{ ...INPUT, resize:"vertical" }} /></div>
              <button onClick={registrarEnvio} style={{ marginTop:"12px", width:"100%", padding:"11px", background:"#0284c7", color:"white", border:"none", borderRadius:"8px", fontSize:"14px", fontWeight:"700", cursor:"pointer" }}>
                ✅ Registrar envío
              </button>
            </div>
          </div>
        </div>
      )}

      {vista === "historial" && (
        <div>
          {envios.length === 0 ? (
            <div style={{ textAlign:"center", padding:"50px", color:"#999" }}><p style={{ fontSize:"40px", margin:0 }}>📂</p><p>Sin envíos registrados</p></div>
          ) : envios.map(e => (
            <div key={e.id} style={{ ...CARD, marginBottom:"8px", display:"flex", gap:"14px" }}>
              <div style={{ minWidth:"90px", textAlign:"center", background:"#f0f9ff", borderRadius:"8px", padding:"8px" }}>
                <p style={{ margin:0, fontSize:"10px", color:"#666" }}>Enviado</p>
                <p style={{ margin:0, fontWeight:"700", color:"#0284c7", fontSize:"13px" }}>{e.fecha_envio}</p>
                {e.fecha_resultado_estimada && <><p style={{ margin:"4px 0 0", fontSize:"10px", color:"#666" }}>Resultado</p><p style={{ margin:0, fontWeight:"600", color:"#059669", fontSize:"12px" }}>{e.fecha_resultado_estimada}</p></>}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ margin:"0 0 2px", fontWeight:"800", fontSize:"14px" }}>{e.paciente_nombre}</p>
                <p style={{ margin:"0 0 6px", fontSize:"11px", color:"#666" }}>Cédula: {e.paciente_cedula} · Por: {e.enviado_por}</p>
                <div style={{ background:"#f8fafc", borderRadius:"6px", padding:"6px 10px", fontSize:"12px" }}>
                  <pre style={{ margin:0, fontFamily:"inherit", whiteSpace:"pre-wrap" }}>{e.examenes}</pre>
                </div>
                {e.notas && <p style={{ margin:"4px 0 0", fontSize:"11px", color:"#666", fontStyle:"italic" }}>📝 {e.notas}</p>}
              </div>
              {labConfig?.link && (
                <div style={{ display:"flex", alignItems:"center" }}>
                  <a href={labConfig.link} target="_blank" rel="noreferrer" style={{ padding:"8px 12px", background:"#e0f2fe", color:"#0284c7", borderRadius:"8px", fontSize:"12px", fontWeight:"700", textDecoration:"none", whiteSpace:"nowrap" }}>
                    🔗 Ver resultados
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {vista === "config" && user?.role === "Administrador" && (
        <div style={{ maxWidth:"500px" }}>
          <div style={CARD}>
            <p style={{ margin:"0 0 14px", fontWeight:"700", color:"#0284c7", fontSize:"15px" }}>⚙️ Configurar Portal</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <div><label style={LABEL}>Nombre del laboratorio</label><input value={configForm.nombre} onChange={e => setConfigForm(f=>({...f,nombre:e.target.value}))} placeholder="Deltalab" style={INPUT} /></div>
              <div><label style={LABEL}>Link del portal *</label>
                <input value={configForm.link} onChange={e => setConfigForm(f=>({...f,link:e.target.value}))} placeholder="https://deltalab.orion-labs.com/..." style={INPUT} />
                <p style={{ fontSize:"10px", color:"#999", margin:"3px 0 0" }}>Token incluido en el link. Solo admin puede cambiarlo.</p>
              </div>
              <div><label style={LABEL}>Notas</label><textarea value={configForm.notas} onChange={e => setConfigForm(f=>({...f,notas:e.target.value}))} rows={2} style={{ ...INPUT, resize:"vertical" }} /></div>
              <button onClick={guardarConfig} style={{ padding:"10px", background:"#0284c7", color:"white", border:"none", borderRadius:"8px", fontSize:"14px", fontWeight:"700", cursor:"pointer" }}>💾 Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
