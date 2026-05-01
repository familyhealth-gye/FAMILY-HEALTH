import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
const hoy = () => new Date().toISOString().split("T")[0];
const primerDiaMes = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; };

const CARD = { background:"white", borderRadius:"10px", padding:"16px", border:"1px solid #e0f7fa", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", marginBottom:"14px" };
const INPUT = { width:"100%", padding:"8px 10px", border:"1.5px solid #b2ebf2", borderRadius:"7px", fontSize:"13px", boxSizing:"border-box" };
const LABEL = { fontSize:"11px", fontWeight:"700", color:"#005f73", display:"block", marginBottom:"3px" };

const TIPOS_EGRESO = [
  { value:"proveedor", label:"🏪 Proveedor" },
  { value:"nomina", label:"👨‍⚕️ Nómina / Doctor" },
  { value:"servicios", label:"💡 Servicios (luz/agua/internet)" },
  { value:"operativo", label:"🏥 Gasto operativo" },
  { value:"mantenimiento", label:"🔧 Mantenimiento" },
  { value:"comisariato", label:"🛒 Comisariato / Insumos" },
  { value:"otro", label:"📋 Otro" },
];

export const PaymentsTab = ({ token }) => {
  const [vista, setVista] = useState("calcular");
  const [fechaIni, setFechaIni] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(hoy());
  const [resumen, setResumen] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagando, setPagando] = useState(null);
  const [formPago, setFormPago] = useState({ monto:"", forma_pago:"efectivo", referencia:"", notas:"" });
  const [showEgreso, setShowEgreso] = useState(false);
  const [formEgreso, setFormEgreso] = useState({ concepto:"", monto:"", tipo:"operativo", referencia:"", notas:"", fecha:hoy() });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { if (vista === "historial") cargarHistorial(); if (vista === "egresos") cargarEgresos(); }, [vista]);

  const calcular = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/doctor-payments/calcular?fecha_inicio=${fechaIni}&fecha_fin=${fechaFin}`, { headers });
      setResumen(res.data);
    } catch (e) { toast.error(e.response?.data?.detail || "Error calculando"); }
    setLoading(false);
  };

  const cargarHistorial = async () => {
    try { const res = await axios.get(`${API}/doctor-payments/historial`, { headers }); setHistorial(res.data || []); }
    catch { setHistorial([]); }
  };

  const cargarEgresos = async () => {
    try { const res = await axios.get(`${API}/caja/egresos?fecha_inicio=${fechaIni}&fecha_fin=${fechaFin}`, { headers }); setEgresos(res.data?.egresos || []); }
    catch { setEgresos([]); }
  };

  const registrarPago = async () => {
    if (!formPago.monto || parseFloat(formPago.monto) <= 0) { toast.error("Ingresa el monto"); return; }
    try {
      await axios.post(`${API}/doctor-payments/registrar`, {
        doctor_id: pagando.doctor_id, doctor_nombre: pagando.doctor_nombre,
        monto: parseFloat(formPago.monto), fecha_inicio: fechaIni, fecha_fin: fechaFin,
        forma_pago: formPago.forma_pago, referencia: formPago.referencia, notas: formPago.notas,
      }, { headers });
      toast.success(`✅ Pago de ${fmt(formPago.monto)} a ${pagando.doctor_nombre} registrado`);
      setPagando(null);
      setFormPago({ monto:"", forma_pago:"efectivo", referencia:"", notas:"" });
      calcular();
    } catch (e) { toast.error(e.response?.data?.detail || "Error al registrar"); }
  };

  const registrarEgreso = async () => {
    if (!formEgreso.concepto || !formEgreso.monto) { toast.error("Concepto y monto son obligatorios"); return; }
    try {
      await axios.post(`${API}/caja/egresos`, formEgreso, { headers });
      toast.success("✅ Egreso registrado");
      setShowEgreso(false);
      setFormEgreso({ concepto:"", monto:"", tipo:"operativo", referencia:"", notas:"", fecha:hoy() });
      cargarEgresos();
    } catch (e) { toast.error(e.response?.data?.detail || "Error"); }
  };

  const eliminarEgreso = async (id) => {
    if (!window.confirm("¿Eliminar este egreso?")) return;
    try { await axios.delete(`${API}/caja/egresos/${id}`, { headers }); toast.success("Eliminado"); cargarEgresos(); }
    catch (e) { toast.error(e.response?.data?.detail || "Error"); }
  };

  const TABS = [
    { id:"calcular", label:"💰 Pago a Doctores" },
    { id:"historial", label:"📋 Historial Pagos" },
    { id:"egresos", label:"📤 Egresos / Gastos" },
  ];

  return (
    <div style={{ padding:"16px", maxWidth:"1000px", margin:"0 auto" }}>
      <div style={{ background:"linear-gradient(135deg,#005f73,#00a8cc)", borderRadius:"12px", padding:"16px 20px", marginBottom:"16px" }}>
        <h2 style={{ color:"white", margin:0, fontSize:"18px", fontWeight:"800" }}>💳 Pagos y Egresos</h2>
        <p style={{ color:"rgba(255,255,255,0.8)", margin:"4px 0 0", fontSize:"12px" }}>
          Calcula y registra pagos a doctores · Controla gastos y egresos de caja
        </p>
      </div>

      <div style={{ display:"flex", gap:"6px", marginBottom:"16px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setVista(t.id)} style={{ padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontWeight:"600", fontSize:"13px", background:vista===t.id?"#00a8cc":"#f0f9ff", color:vista===t.id?"white":"#005f73", boxShadow:vista===t.id?"0 2px 8px rgba(0,168,204,0.3)":"none" }}>{t.label}</button>
        ))}
      </div>

      {/* CALCULAR */}
      {vista === "calcular" && (
        <div>
          <div style={{ ...CARD, display:"flex", gap:"10px", alignItems:"flex-end", flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:"140px" }}>
              <label style={LABEL}>Desde</label>
              <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={INPUT} />
            </div>
            <div style={{ flex:1, minWidth:"140px" }}>
              <label style={LABEL}>Hasta</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={INPUT} />
            </div>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
              {[
                { label:"Hoy", fi:hoy(), ff:hoy() },
                { label:"Esta semana", fi:(() => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0]; })(), ff:hoy() },
                { label:"Este mes", fi:primerDiaMes(), ff:hoy() },
              ].map(p => (
                <button key={p.label} onClick={() => { setFechaIni(p.fi); setFechaFin(p.ff); }} style={{ padding:"8px 10px", background:"#e0f7fa", border:"none", borderRadius:"6px", fontSize:"12px", cursor:"pointer", color:"#005f73", fontWeight:"600" }}>{p.label}</button>
              ))}
              <button onClick={calcular} disabled={loading} style={{ padding:"8px 16px", background:"#005f73", color:"white", border:"none", borderRadius:"8px", fontSize:"13px", fontWeight:"700", cursor:"pointer" }}>
                {loading ? "⏳..." : "Calcular"}
              </button>
            </div>
          </div>

          {resumen && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"10px", marginBottom:"14px" }}>
                {[
                  { label:"Total cobrado", val:resumen.total_cobrado, color:"#0284c7" },
                  { label:"A pagar a doctores", val:resumen.total_pagar_doctores, color:"#d97706" },
                  { label:"Queda para la clínica", val:resumen.total_clinica, color:"#7c3aed" },
                ].map(s => (
                  <div key={s.label} style={{ ...CARD, borderLeft:`4px solid ${s.color}`, marginBottom:0 }}>
                    <p style={{ margin:"0 0 4px", fontSize:"11px", color:"#666" }}>{s.label}</p>
                    <p style={{ margin:0, fontSize:"20px", fontWeight:"800", color:s.color }}>{fmt(s.val)}</p>
                  </div>
                ))}
              </div>

              {resumen.doctores.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px", color:"#999" }}>
                  <p style={{ fontSize:"32px", margin:0 }}>📭</p>
                  <p>Sin consultas cobradas en este período</p>
                </div>
              ) : resumen.doctores.map(d => (
                <div key={d.doctor_id} style={{ ...CARD, borderLeft:"4px solid #00a8cc" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"10px" }}>
                    <div>
                      <p style={{ margin:"0 0 4px", fontWeight:"800", fontSize:"15px", color:"#005f73" }}>{d.doctor_nombre}</p>
                      <p style={{ margin:0, fontSize:"12px", color:"#666" }}>{d.especialidad} · {d.num_consultas} consulta{d.num_consultas!==1?"s":""} · {d.porcentaje}% comisión</p>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ display:"flex", gap:"16px", marginBottom:"6px" }}>
                        <div><p style={{ margin:0, fontSize:"10px", color:"#666" }}>Cobrado</p><p style={{ margin:0, fontWeight:"700", color:"#0284c7" }}>{fmt(d.total_cobrado)}</p></div>
                        <div><p style={{ margin:0, fontSize:"10px", color:"#666" }}>Le corresponde</p><p style={{ margin:0, fontWeight:"800", fontSize:"16px", color:"#d97706" }}>{fmt(d.ganancia_doctor)}</p></div>
                        <div><p style={{ margin:0, fontSize:"10px", color:"#666" }}>Clínica</p><p style={{ margin:0, fontWeight:"700", color:"#7c3aed" }}>{fmt(d.ganancia_clinica)}</p></div>
                      </div>
                      <button onClick={() => { setPagando(d); setFormPago(f => ({...f, monto:d.ganancia_doctor.toFixed(2)})); }} style={{ padding:"7px 16px", background:"#005f73", color:"white", border:"none", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
                        💳 Registrar Pago
                      </button>
                    </div>
                  </div>
                  {d.consultas?.length > 0 && (
                    <details style={{ marginTop:"8px" }}>
                      <summary style={{ cursor:"pointer", fontSize:"12px", color:"#005f73", fontWeight:"600" }}>Ver {d.consultas.length} consulta{d.consultas.length!==1?"s":""} del período</summary>
                      <div style={{ marginTop:"6px", maxHeight:"150px", overflowY:"auto" }}>
                        {d.consultas.map((c,i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", fontSize:"12px", borderBottom:"1px solid #f0f0f0" }}>
                            <span style={{ color:"#555" }}>{c.fecha} · {c.paciente}</span>
                            <span style={{ fontWeight:"700", color:"#005f73" }}>{fmt(c.monto)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {vista === "historial" && (
        <div>
          {historial.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#999" }}><p style={{ fontSize:"32px", margin:0 }}>📋</p><p>Sin pagos registrados</p></div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
                <thead><tr style={{ background:"#f0f9ff" }}>
                  {["Fecha pago","Doctor","Período","Monto","Forma pago","Registrado por"].map(h=>(
                    <th key={h} style={{ padding:"8px 10px", textAlign:"left", color:"#005f73", fontWeight:"700", fontSize:"11px", borderBottom:"2px solid #b2ebf2" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {historial.map((p,i) => (
                    <tr key={p.id} style={{ borderBottom:"1px solid #f0f0f0", background:i%2===0?"white":"#fafafa" }}>
                      <td style={{ padding:"8px 10px" }}>{p.fecha_pago}</td>
                      <td style={{ padding:"8px 10px", fontWeight:"700" }}>{p.doctor_nombre}</td>
                      <td style={{ padding:"8px 10px", fontSize:"11px", color:"#666" }}>{p.fecha_inicio_periodo} → {p.fecha_fin_periodo}</td>
                      <td style={{ padding:"8px 10px", fontWeight:"800", color:"#005f73" }}>{fmt(p.monto)}</td>
                      <td style={{ padding:"8px 10px" }}><span style={{ background:"#e0f7fa", color:"#005f73", borderRadius:"10px", padding:"2px 8px", fontSize:"11px" }}>{p.forma_pago}</span></td>
                      <td style={{ padding:"8px 10px", color:"#666", fontSize:"12px" }}>{p.registrado_por}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* EGRESOS */}
      {vista === "egresos" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px", flexWrap:"wrap", gap:"8px" }}>
            <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
              <input type="date" value={fechaIni} onChange={e => setFechaIni(e.target.value)} style={{ ...INPUT, width:"140px" }} />
              <span style={{ color:"#999" }}>—</span>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ ...INPUT, width:"140px" }} />
              <button onClick={cargarEgresos} style={{ padding:"8px 12px", background:"#00a8cc", color:"white", border:"none", borderRadius:"6px", fontSize:"12px", cursor:"pointer", fontWeight:"700" }}>Filtrar</button>
            </div>
            <button onClick={() => setShowEgreso(true)} style={{ padding:"8px 16px", background:"#dc2626", color:"white", border:"none", borderRadius:"8px", fontSize:"13px", fontWeight:"700", cursor:"pointer" }}>+ Registrar Egreso</button>
          </div>

          {egresos.length > 0 && (
            <div style={{ ...CARD, background:"#fff5f5", borderLeft:"4px solid #dc2626", display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
              <span style={{ fontWeight:"700", color:"#dc2626" }}>Total egresos:</span>
              <span style={{ fontWeight:"800", fontSize:"18px", color:"#dc2626" }}>{fmt(egresos.reduce((a,e)=>a+(e.monto||0),0))}</span>
            </div>
          )}

          {egresos.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px", color:"#999" }}><p style={{ fontSize:"32px", margin:0 }}>📤</p><p>Sin egresos en este período</p></div>
          ) : egresos.map(e => (
            <div key={e.id} style={{ ...CARD, marginBottom:"8px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ margin:"0 0 2px", fontWeight:"700", fontSize:"14px" }}>{e.concepto}</p>
                <div style={{ display:"flex", gap:"10px", fontSize:"12px", color:"#666" }}>
                  <span>{e.fecha}</span>
                  <span style={{ background:"#fee2e2", color:"#dc2626", borderRadius:"8px", padding:"1px 6px", fontWeight:"600" }}>{TIPOS_EGRESO.find(t=>t.value===e.tipo)?.label || e.tipo}</span>
                  {e.referencia && <span>Ref: {e.referencia}</span>}
                </div>
              </div>
              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                <span style={{ fontWeight:"800", fontSize:"16px", color:"#dc2626" }}>{fmt(e.monto)}</span>
                <button onClick={() => eliminarEgreso(e.id)} style={{ padding:"4px 8px", background:"#fee2e2", border:"none", borderRadius:"6px", fontSize:"11px", cursor:"pointer", color:"#dc2626" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal pagar doctor */}
      {pagando && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"white", borderRadius:"12px", padding:"24px", width:"400px", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin:"0 0 16px", color:"#005f73" }}>💳 Pago a {pagando.doctor_nombre}</h3>
            <div style={{ background:"#f0f9ff", borderRadius:"8px", padding:"10px 14px", marginBottom:"14px", fontSize:"13px" }}>
              <p style={{ margin:"0 0 4px" }}>Período: <strong>{fechaIni} → {fechaFin}</strong></p>
              <p style={{ margin:"0 0 4px" }}>Cobrado: <strong>{fmt(pagando.total_cobrado)}</strong></p>
              <p style={{ margin:0 }}>Le corresponde ({pagando.porcentaje}%): <strong style={{ color:"#d97706", fontSize:"16px" }}>{fmt(pagando.ganancia_doctor)}</strong></p>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <div><label style={LABEL}>Monto a pagar *</label>
                <input type="number" step="0.01" value={formPago.monto} onChange={e => setFormPago(f=>({...f,monto:e.target.value}))} style={INPUT} />
                <p style={{ fontSize:"10px", color:"#999", margin:"2px 0 0" }}>Puede ser parcial si acuerda pagar en partes</p>
              </div>
              <div><label style={LABEL}>Forma de pago</label>
                <select value={formPago.forma_pago} onChange={e => setFormPago(f=>({...f,forma_pago:e.target.value}))} style={INPUT}>
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  <option value="cheque">📝 Cheque</option>
                </select>
              </div>
              <div><label style={LABEL}>Referencia</label>
                <input value={formPago.referencia} onChange={e => setFormPago(f=>({...f,referencia:e.target.value}))} style={INPUT} placeholder="Opcional" />
              </div>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={registrarPago} style={{ flex:1, padding:"10px", background:"#005f73", color:"white", border:"none", borderRadius:"8px", fontSize:"14px", fontWeight:"700", cursor:"pointer" }}>✓ Confirmar Pago</button>
                <button onClick={() => setPagando(null)} style={{ padding:"10px 16px", background:"#f3f4f6", border:"none", borderRadius:"8px", cursor:"pointer" }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal egreso */}
      {showEgreso && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"white", borderRadius:"12px", padding:"24px", width:"440px", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin:"0 0 16px", color:"#dc2626" }}>📤 Registrar Egreso</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              <div><label style={LABEL}>Concepto *</label>
                <input value={formEgreso.concepto} onChange={e => setFormEgreso(f=>({...f,concepto:e.target.value}))} placeholder="Ej: Pago internet, Compra insumos..." style={INPUT} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                <div><label style={LABEL}>Monto *</label>
                  <input type="number" step="0.01" value={formEgreso.monto} onChange={e => setFormEgreso(f=>({...f,monto:e.target.value}))} style={INPUT} />
                </div>
                <div><label style={LABEL}>Fecha</label>
                  <input type="date" value={formEgreso.fecha} onChange={e => setFormEgreso(f=>({...f,fecha:e.target.value}))} style={INPUT} />
                </div>
              </div>
              <div><label style={LABEL}>Tipo de gasto</label>
                <select value={formEgreso.tipo} onChange={e => setFormEgreso(f=>({...f,tipo:e.target.value}))} style={INPUT}>
                  {TIPOS_EGRESO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label style={LABEL}>Referencia / Comprobante</label>
                <input value={formEgreso.referencia} onChange={e => setFormEgreso(f=>({...f,referencia:e.target.value}))} placeholder="N° factura proveedor, recibo..." style={INPUT} />
              </div>
              <div style={{ display:"flex", gap:"8px" }}>
                <button onClick={registrarEgreso} style={{ flex:1, padding:"10px", background:"#dc2626", color:"white", border:"none", borderRadius:"8px", fontSize:"14px", fontWeight:"700", cursor:"pointer" }}>✓ Registrar</button>
                <button onClick={() => setShowEgreso(false)} style={{ padding:"10px 16px", background:"#f3f4f6", border:"none", borderRadius:"8px", cursor:"pointer" }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};