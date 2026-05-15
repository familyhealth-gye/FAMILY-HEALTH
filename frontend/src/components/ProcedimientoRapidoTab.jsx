import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const INPUT = { width:"100%", padding:"8px 10px", border:"1.5px solid #b2ebf2", borderRadius:"7px", fontSize:"13px", boxSizing:"border-box" };
const LABEL = { fontSize:"11px", fontWeight:"700", color:"#005f73", display:"block", marginBottom:"3px" };
const CARD = { background:"white", borderRadius:"10px", padding:"14px 16px", border:"1px solid #e0f7fa", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", marginBottom:"12px" };
const VIAS = ["Intravenosa (IV)", "Intramuscular (IM)", "Subcutánea (SC)", "Oral", "Tópica", "Nebulización", "Otra"];
const fmt = (n) => `$${(parseFloat(n)||0).toFixed(2)}`;

export const ProcedimientoRapidoTab = ({ token, user }) => {
  const [vista, setVista] = useState("nuevo");
  const [catalogo, setCatalogo] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqPaciente, setBusqPaciente] = useState("");
  const [busqCatalogo, setBusqCatalogo] = useState("");
  const FORM_VACIO = { paciente_cedula:"", paciente_nombre:"", paciente_telefono:"", procedimientos:[], aplicado_por: user?.nombre_completo || "", prescripcion_externa:"", consentimiento_verbal:true, observaciones:"", tipo_pago:"efectivo", fecha: new Date().toISOString().split("T")[0], hora: new Date().toTimeString().slice(0,5) };
  const [form, setForm] = useState(FORM_VACIO);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get(`${API}/financial/catalogo`, { headers }).then(r => setCatalogo(r.data || [])).catch(()=>{});
    if (vista === "historial") cargarHistorial();
  }, [vista]);

  const cargarHistorial = async () => {
    try { const r = await axios.get(`${API}/procedimientos-rapidos`, { headers }); setHistorial(r.data || []); }
    catch { setHistorial([]); }
  };

  const buscarPaciente = async (cedula) => {
    setBusqPaciente(cedula);
    setForm(f => ({ ...f, paciente_cedula: cedula }));
    if (cedula.length >= 10) {
      try {
        const r = await axios.get(`${API}/appointments?search=${cedula}`, { headers });
        const apts = r.data || [];
        if (apts.length > 0) { setForm(f => ({ ...f, paciente_cedula: apts[0].cedula, paciente_nombre: apts[0].nombre_completo, paciente_telefono: apts[0].telefono || "" })); toast.success(`✅ ${apts[0].nombre_completo}`); }
      } catch {}
    }
  };

  const agregarProc = (srv) => {
    if (form.procedimientos.find(p => p.id === srv.id)) return;
    setForm(f => ({ ...f, procedimientos: [...f.procedimientos, { id:srv.id, nombre:srv.nombre, precio_base:srv.precio_base, cantidad:1, via:"Intravenosa (IV)", dosis:"", observaciones:"" }] }));
  };

  const updateProc = (id, campo, valor) => setForm(f => ({ ...f, procedimientos: f.procedimientos.map(p => p.id===id ? {...p,[campo]:valor} : p) }));
  const quitarProc = (id) => setForm(f => ({ ...f, procedimientos: f.procedimientos.filter(p => p.id!==id) }));
  const total = form.procedimientos.reduce((a,p) => a + p.precio_base*(p.cantidad||1), 0);

  const handleGuardar = async () => {
    if (!form.paciente_nombre) { toast.error("Ingresa el nombre del paciente"); return; }
    if (form.procedimientos.length === 0) { toast.error("Agrega al menos un procedimiento"); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/procedimientos-rapidos`, { ...form, total, usuario: user?.username }, { headers });
      toast.success(`✅ Registrado — Total: ${fmt(total)}`);
      setForm(FORM_VACIO); setBusqPaciente("");
    } catch (e) { toast.error(e.response?.data?.detail || "Error"); }
    setLoading(false);
  };

  const catFil = catalogo.filter(s => (!busqCatalogo || s.nombre.toLowerCase().includes(busqCatalogo.toLowerCase())) && !form.procedimientos.find(p=>p.id===s.id)).slice(0,30);

  return (
    <div style={{ padding:"16px", maxWidth:"900px", margin:"0 auto" }}>
      <div style={{ background:"linear-gradient(135deg,#7c3aed,#6366f1)", borderRadius:"12px", padding:"16px 20px", marginBottom:"16px" }}>
        <h2 style={{ color:"white", margin:0, fontSize:"18px", fontWeight:"800" }}>💉 Procedimientos Rápidos</h2>
        <p style={{ color:"rgba(255,255,255,0.8)", margin:"4px 0 0", fontSize:"12px" }}>Sueros · Inyecciones · Curaciones — sin historia clínica completa</p>
      </div>
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px" }}>
        {[["nuevo","➕ Nuevo"],["historial","📋 Historial"]].map(([id,label]) => (
          <button key={id} onClick={() => setVista(id)} style={{ padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:"600", fontSize:"13px", background:vista===id?"#7c3aed":"#f5f3ff", color:vista===id?"white":"#7c3aed" }}>{label}</button>
        ))}
      </div>

      {vista === "nuevo" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
          <div>
            <div style={CARD}>
              <p style={{ margin:"0 0 10px", fontWeight:"700", color:"#7c3aed", fontSize:"13px" }}>👤 Paciente</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <div><label style={LABEL}>Cédula (autocompletar)</label><input value={busqPaciente} onChange={e=>buscarPaciente(e.target.value)} placeholder="Ingresa cédula" style={INPUT} /></div>
                <div><label style={LABEL}>Nombre *</label><input value={form.paciente_nombre} onChange={e=>setForm(f=>({...f,paciente_nombre:e.target.value}))} placeholder="Nombre del paciente" style={INPUT} /></div>
                <div><label style={LABEL}>Teléfono</label><input value={form.paciente_telefono} onChange={e=>setForm(f=>({...f,paciente_telefono:e.target.value}))} placeholder="09..." style={INPUT} /></div>
                <div><label style={LABEL}>Prescripción externa (si aplica)</label><input value={form.prescripcion_externa} onChange={e=>setForm(f=>({...f,prescripcion_externa:e.target.value}))} placeholder="Ej: Dr. González — Hospital X" style={INPUT} /></div>
              </div>
            </div>
            <div style={CARD}>
              <p style={{ margin:"0 0 10px", fontWeight:"700", color:"#7c3aed", fontSize:"13px" }}>🏥 Aplicación</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                  <div><label style={LABEL}>Fecha</label><input type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} style={INPUT} /></div>
                  <div><label style={LABEL}>Hora</label><input type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} style={INPUT} /></div>
                </div>
                <div><label style={LABEL}>Aplicado por</label><input value={form.aplicado_por} onChange={e=>setForm(f=>({...f,aplicado_por:e.target.value}))} style={INPUT} /></div>
                <div><label style={LABEL}>Forma de pago</label>
                  <select value={form.tipo_pago} onChange={e=>setForm(f=>({...f,tipo_pago:e.target.value}))} style={INPUT}>
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="transferencia">🏦 Transferencia</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                  </select>
                </div>
                <label style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", cursor:"pointer" }}>
                  <input type="checkbox" checked={form.consentimiento_verbal} onChange={e=>setForm(f=>({...f,consentimiento_verbal:e.target.checked}))} />
                  Consentimiento verbal del paciente
                </label>
                <div><label style={LABEL}>Observaciones</label><textarea value={form.observaciones} onChange={e=>setForm(f=>({...f,observaciones:e.target.value}))} rows={2} style={{ ...INPUT, resize:"vertical" }} /></div>
              </div>
            </div>
          </div>
          <div>
            <div style={CARD}>
              <p style={{ margin:"0 0 10px", fontWeight:"700", color:"#7c3aed", fontSize:"13px" }}>💉 Procedimientos</p>
              {form.procedimientos.map(p => (
                <div key={p.id} style={{ background:"#f5f3ff", borderRadius:"8px", padding:"10px", marginBottom:"8px", border:"1px solid #ddd6fe" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                    <span style={{ fontWeight:"700", fontSize:"13px", color:"#7c3aed" }}>{p.nombre}</span>
                    <button type="button" onClick={()=>quitarProc(p.id)} style={{ background:"#fee2e2", border:"none", borderRadius:"4px", padding:"2px 8px", cursor:"pointer", color:"#dc2626", fontSize:"11px" }}>✕</button>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 55px", gap:"6px" }}>
                    <div><label style={{ ...LABEL, fontSize:"10px" }}>Vía</label>
                      <select value={p.via} onChange={e=>updateProc(p.id,"via",e.target.value)} style={{ ...INPUT, fontSize:"11px", padding:"5px 8px" }}>
                        {VIAS.map(v=><option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div><label style={{ ...LABEL, fontSize:"10px" }}>Dosis/Dilución</label><input value={p.dosis} onChange={e=>updateProc(p.id,"dosis",e.target.value)} placeholder="Ej: 500ml NaCl 0.9%" style={{ ...INPUT, fontSize:"11px", padding:"5px 8px" }} /></div>
                    <div><label style={{ ...LABEL, fontSize:"10px" }}>Cant.</label><input type="number" min="1" value={p.cantidad} onChange={e=>updateProc(p.id,"cantidad",parseInt(e.target.value)||1)} style={{ ...INPUT, fontSize:"11px", padding:"5px 8px", textAlign:"center" }} /></div>
                  </div>
                  <div style={{ marginTop:"4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <input value={p.observaciones} onChange={e=>updateProc(p.id,"observaciones",e.target.value)} placeholder="Observación..." style={{ ...INPUT, fontSize:"11px", padding:"4px 8px", flex:1, marginRight:"8px" }} />
                    <span style={{ fontWeight:"700", color:"#7c3aed", whiteSpace:"nowrap" }}>{fmt(p.precio_base*p.cantidad)}</span>
                  </div>
                </div>
              ))}
              <input value={busqCatalogo} onChange={e=>setBusqCatalogo(e.target.value)} placeholder="🔍 Buscar (suero, inyección, curación...)" style={{ ...INPUT, marginBottom:"6px" }} />
              <div style={{ maxHeight:"180px", overflowY:"auto", display:"flex", flexWrap:"wrap", gap:"4px" }}>
                {catFil.map(s => (
                  <button key={s.id} type="button" onClick={()=>agregarProc(s)} style={{ padding:"5px 10px", background:"white", border:"1.5px solid #ddd6fe", borderRadius:"6px", fontSize:"12px", cursor:"pointer", color:"#7c3aed" }}>
                    + {s.nombre} <span style={{ color:"#666", fontSize:"10px" }}>{fmt(s.precio_base)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ ...CARD, borderLeft:"4px solid #7c3aed" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                <span style={{ fontSize:"15px", fontWeight:"800", color:"#7c3aed" }}>TOTAL:</span>
                <span style={{ fontSize:"22px", fontWeight:"900", color:"#7c3aed" }}>{fmt(total)}</span>
              </div>
              <button onClick={handleGuardar} disabled={loading} style={{ width:"100%", padding:"12px", background:loading?"#94a3b8":"linear-gradient(135deg,#7c3aed,#6366f1)", color:"white", border:"none", borderRadius:"8px", fontSize:"15px", fontWeight:"700", cursor:loading?"not-allowed":"pointer" }}>
                {loading ? "⏳ Guardando..." : "✅ Registrar y Cobrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {vista === "historial" && (
        <div>
          {historial.length === 0 ? (
            <div style={{ textAlign:"center", padding:"50px", color:"#999" }}><p style={{ fontSize:"40px", margin:0 }}>💉</p><p>Sin procedimientos registrados</p></div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
              <thead><tr style={{ background:"#f5f3ff" }}>
                {["Fecha/Hora","Paciente","Procedimientos","Aplicado por","Total","Pago"].map(h=>(
                  <th key={h} style={{ padding:"8px 10px", textAlign:"left", color:"#7c3aed", fontWeight:"700", fontSize:"11px", borderBottom:"2px solid #ddd6fe" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {historial.map((p,i) => (
                  <tr key={p.id} style={{ borderBottom:"1px solid #f0f0f0", background:i%2===0?"white":"#fafafa" }}>
                    <td style={{ padding:"8px 10px" }}><div style={{ fontWeight:"600" }}>{p.fecha}</div><div style={{ fontSize:"11px", color:"#666" }}>{p.hora}</div></td>
                    <td style={{ padding:"8px 10px" }}><div style={{ fontWeight:"700" }}>{p.paciente_nombre}</div><div style={{ fontSize:"11px", color:"#666" }}>{p.paciente_cedula}</div>{p.prescripcion_externa&&<div style={{ fontSize:"10px", color:"#7c3aed" }}>Rx: {p.prescripcion_externa}</div>}</td>
                    <td style={{ padding:"8px 10px" }}>{(p.procedimientos||[]).map((proc,j)=><div key={j} style={{ fontSize:"12px" }}>• {proc.nombre} — {proc.via}</div>)}</td>
                    <td style={{ padding:"8px 10px", color:"#555" }}>{p.aplicado_por}</td>
                    <td style={{ padding:"8px 10px", fontWeight:"800", color:"#7c3aed" }}>{fmt(p.total)}</td>
                    <td style={{ padding:"8px 10px" }}><span style={{ background:"#e0f7fa", color:"#005f73", borderRadius:"10px", padding:"2px 8px", fontSize:"11px" }}>{p.tipo_pago}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
