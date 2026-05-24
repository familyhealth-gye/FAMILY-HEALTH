import apiClient from "@/lib/axios";
import React, { useState, useEffect } from 'react';

// URL correcta — igual que todos los demás componentes
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
const hoy = () => new Date().toISOString().split('T')[0];
const primerDiaMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
};

const CARD = { background:'white', borderRadius:'12px', padding:'16px', border:'1px solid #e0f7fa', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' };
const SEC = { fontSize:'11px', fontWeight:'700', color:'#005f73', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'10px' };

export default function CajaTab() {
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [vista, setVista] = useState('resumen');
  const [fechaDia, setFechaDia] = useState(hoy());
  const [fechaIni, setFechaIni] = useState(primerDiaMes());
  const [fechaFin, setFechaFin] = useState(hoy());

  // Data states
  const [resumen, setResumen] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [doctores, setDoctores] = useState(null);
  const [porEspecialidad, setPorEspecialidad] = useState(null);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cierre de caja
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [observacionesCierre, setObservacionesCierre] = useState('');

  // Pago directo en pendientes
  const [pagandoId, setPagandoId] = useState(null);
  const [montoPago, setMontoPago] = useState('');
  const [tipoPago, setTipoPago] = useState('efectivo');

  useEffect(() => { cargar(); }, [vista, fechaDia, fechaIni, fechaFin]);

  const get = async (url) => {
    const response = await apiClient.get(url);
    return response.data;
  };

  const cargar = async () => {
    setLoading(true);
    setError('');
    try {
      if (vista === 'resumen') {
        const data = await get(`/financial/reportes/ingresos-del-dia?fecha=${fechaDia}`);
        setResumen(data);
      } else if (vista === 'pendientes') {
        const data = await get(`/financial/reportes/pendientes`);
        setPendientes(data.consultas || []);
      } else if (vista === 'doctores') {
        const data = await get(`/financial/reportes/por-doctor?fecha_inicio=${fechaIni}&fecha_fin=${fechaFin}`);
        setDoctores(data);
      } else if (vista === 'especialidad') {
        const data = await get(`/financial/reportes/por-especialidad?fecha_inicio=${fechaIni}&fecha_fin=${fechaFin}`);
        setPorEspecialidad(data);
      } else if (vista === 'cierres') {
        const data = await get(`/financial/cierres-caja`);
        setCierres(data || []);
      }
    } catch (e) {
      setError(`Error cargando datos: ${e.message}`);
    }
    setLoading(false);
  };

  const registrarPago = async (consultaId) => {
    if (!montoPago || parseFloat(montoPago) <= 0) { alert('Ingrese un monto válido'); return; }
    try {
      await fetch(`${API}/financial/consultas/${consultaId}/pagos`, {
        method: 'POST', headers,
        body: JSON.stringify({ fecha: hoy(), monto: parseFloat(montoPago), tipo_pago: tipoPago, referencia: '', notas: '' })
      });
      setPagandoId(null); setMontoPago(''); setTipoPago('efectivo');
      cargar();
    } catch { alert('Error al registrar el pago'); }
  };

  const cerrarCaja = async () => {
    if (!resumen) return;
    try {
      await fetch(`${API}/financial/cierre-caja`, {
        method: 'POST', headers,
        body: JSON.stringify({
          fecha: fechaDia,
          total_efectivo: resumen.total_efectivo,
          total_transferencia: resumen.total_transferencia,
          total_tarjeta: resumen.total_tarjeta,
          total_seguro: resumen.total_seguro || 0,
          total_otros: resumen.total_otros || 0,
          total_general: resumen.total_general,
          num_transacciones: resumen.num_transacciones,
          observaciones: observacionesCierre,
        })
      });
      alert('✅ Caja cerrada exitosamente');
      setMostrarCierre(false);
      setObservacionesCierre('');
      cargar();
    } catch (e) { alert('Error al cerrar caja: ' + e.message); }
  };

  const TABS = [
    { id:'resumen',    label:'📊 Resumen del Día' },
    { id:'pendientes', label:'⏳ Cuentas Pendientes' },
    { id:'doctores',   label:'👨‍⚕️ Ganancias por Doctor' },
    { id:'especialidad',label:'🏥 Por Especialidad' },
    { id:'cierres',    label:'🔒 Cierres de Caja' },
  ];

  return (
    <div style={{ padding:'16px', maxWidth:'1100px', margin:'0 auto' }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#005f73,#00a8cc)', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h2 style={{ color:'white', margin:0, fontSize:'18px', fontWeight:'800' }}>💰 Módulo de Caja</h2>
          <p style={{ color:'rgba(255,255,255,0.8)', margin:'2px 0 0', fontSize:'12px' }}>Ingresos · Pendientes · Cierres · Ganancias por Doctor</p>
        </div>
        <button onClick={cargar} style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', borderRadius:'8px', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontWeight:'700' }}>
          🔄 Actualizar
        </button>
      </div>

      {/* Nav tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px', overflowX:'auto', paddingBottom:'4px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setVista(t.id)} style={{
            padding:'8px 14px', borderRadius:'8px', border:'none', cursor:'pointer',
            fontWeight:'600', fontSize:'12px', whiteSpace:'nowrap', flexShrink:0,
            background: vista===t.id ? '#00a8cc' : '#f0f9ff',
            color: vista===t.id ? 'white' : '#005f73',
            boxShadow: vista===t.id ? '0 2px 8px rgba(0,168,204,0.3)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {error && (
        <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'8px', padding:'10px 14px', marginBottom:'12px', color:'#dc2626', fontSize:'13px' }}>
          ⚠️ {error}
          <button onClick={cargar} style={{ marginLeft:'10px', background:'#dc2626', color:'white', border:'none', borderRadius:'4px', padding:'2px 8px', cursor:'pointer', fontSize:'12px' }}>Reintentar</button>
        </div>
      )}

      {loading && <div style={{ textAlign:'center', padding:'30px', color:'#00a8cc', fontSize:'14px' }}>⏳ Cargando...</div>}

      {/* ══ RESUMEN DEL DÍA ══ */}
      {!loading && vista === 'resumen' && (
        <div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'14px', flexWrap:'wrap' }}>
            <label style={{ fontSize:'12px', fontWeight:'700', color:'#005f73' }}>Fecha:</label>
            <input type="date" value={fechaDia} onChange={e=>setFechaDia(e.target.value)}
              style={{ padding:'6px 10px', border:'1.5px solid #b2ebf2', borderRadius:'6px', fontSize:'13px' }} />
            <button onClick={() => setFechaDia(hoy())} style={{ padding:'6px 10px', background:'#e0f7fa', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer', color:'#005f73' }}>
              Hoy
            </button>
          </div>

          {resumen ? (
            <>
              {/* Totales por método */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:'10px', marginBottom:'16px' }}>
                {[
                  { label:'💵 Efectivo', val:resumen.total_efectivo, color:'#059669' },
                  { label:'🏦 Transferencia', val:resumen.total_transferencia, color:'#0284c7' },
                  { label:'💳 Tarjeta', val:resumen.total_tarjeta, color:'#7c3aed' },
                  { label:'🏥 Seguro', val:resumen.total_seguro||0, color:'#d97706' },
                  { label:'📋 Otros', val:resumen.total_otros||0, color:'#6b7280' },
                ].map(item => (
                  <div key={item.label} style={{ ...CARD, borderLeft:`4px solid ${item.color}` }}>
                    <p style={{ margin:'0 0 4px', fontSize:'11px', color:'#666' }}>{item.label}</p>
                    <p style={{ margin:0, fontSize:'20px', fontWeight:'800', color:item.color }}>{fmt(item.val)}</p>
                  </div>
                ))}
              </div>

              {/* Total general */}
              <div style={{ background:'linear-gradient(135deg,#005f73,#00a8cc)', borderRadius:'12px', padding:'16px 20px', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <p style={{ color:'rgba(255,255,255,0.8)', margin:0, fontSize:'12px' }}>TOTAL DEL DÍA</p>
                  <p style={{ color:'white', margin:'4px 0 0', fontSize:'28px', fontWeight:'900' }}>{fmt(resumen.total_general)}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ color:'rgba(255,255,255,0.8)', margin:0, fontSize:'12px' }}>{resumen.num_transacciones} transacciones</p>
                  <button onClick={() => setMostrarCierre(true)}
                    style={{ marginTop:'8px', background:'white', color:'#005f73', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'13px', fontWeight:'700' }}>
                    🔒 Cerrar Caja
                  </button>
                </div>
              </div>

              {/* Detalle de transacciones */}
              {resumen.detalles && resumen.detalles.length > 0 ? (
                <div style={CARD}>
                  <p style={SEC}>Transacciones del día</p>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                      <thead>
                        <tr style={{ background:'#f0f9ff' }}>
                          {['Paciente','Especialidad','Doctor','Forma Pago','Monto'].map(h=>(
                            <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'#005f73', fontWeight:'700', fontSize:'11px', borderBottom:'2px solid #b2ebf2' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resumen.detalles.map((d, i) => (
                          <tr key={i} style={{ borderBottom:'1px solid #f0f0f0', background: i%2===0?'white':'#fafafa' }}>
                            <td style={{ padding:'8px 10px', fontWeight:'600' }}>{d.paciente_nombre}</td>
                            <td style={{ padding:'8px 10px' }}><span style={{ background:'#e0f7fa', color:'#005f73', borderRadius:'10px', padding:'2px 8px', fontSize:'11px', fontWeight:'700' }}>{d.especialidad}</span></td>
                            <td style={{ padding:'8px 10px', color:'#555' }}>{d.doctor_nombre}</td>
                            <td style={{ padding:'8px 10px' }}>
                              <span style={{ background: d.tipo_pago==='efectivo'?'#d1fae5':d.tipo_pago==='tarjeta'?'#ede9fe':'#dbeafe', color: d.tipo_pago==='efectivo'?'#065f46':d.tipo_pago==='tarjeta'?'#5b21b6':'#1e40af', borderRadius:'10px', padding:'2px 8px', fontSize:'11px', fontWeight:'700' }}>
                                {d.tipo_pago}
                              </span>
                            </td>
                            <td style={{ padding:'8px 10px', fontWeight:'800', color:'#059669', fontSize:'14px' }}>{fmt(d.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign:'center', padding:'40px', color:'#999' }}>
                  <p style={{ fontSize:'32px', margin:0 }}>📭</p>
                  <p style={{ fontSize:'14px', margin:'8px 0 4px' }}>Sin transacciones para esta fecha</p>
                  <p style={{ fontSize:'12px' }}>Asegúrate de cobrar las consultas desde el módulo de Citas</p>
                </div>
              )}
            </>
          ) : !error && (
            <div style={{ textAlign:'center', padding:'40px', color:'#999' }}>Sin datos</div>
          )}

          {/* Modal cierre de caja */}
          {mostrarCierre && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ background:'white', borderRadius:'12px', padding:'24px', width:'380px', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
                <h3 style={{ margin:'0 0 16px', color:'#005f73' }}>🔒 Cierre de Caja — {fechaDia}</h3>
                <div style={{ background:'#f0f9ff', borderRadius:'8px', padding:'12px', marginBottom:'14px' }}>
                  {[['Efectivo', resumen?.total_efectivo],['Transferencia', resumen?.total_transferencia],['Tarjeta', resumen?.total_tarjeta]].map(([l,v])=>(
                    <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px', fontSize:'13px' }}>
                      <span style={{ color:'#555' }}>{l}:</span><span style={{ fontWeight:'700' }}>{fmt(v)}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'16px', fontWeight:'800', color:'#005f73', borderTop:'1px solid #b2ebf2', paddingTop:'8px', marginTop:'4px' }}>
                    <span>TOTAL:</span><span>{fmt(resumen?.total_general)}</span>
                  </div>
                </div>
                <textarea value={observacionesCierre} onChange={e=>setObservacionesCierre(e.target.value)}
                  placeholder="Observaciones (opcional)..." rows={3}
                  style={{ width:'100%', padding:'8px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'13px', boxSizing:'border-box', marginBottom:'12px' }}/>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={cerrarCaja} style={{ flex:1, padding:'10px', background:'#005f73', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'700', cursor:'pointer' }}>
                    ✓ Confirmar Cierre
                  </button>
                  <button onClick={()=>setMostrarCierre(false)} style={{ padding:'10px 14px', background:'#f3f4f6', border:'none', borderRadius:'8px', cursor:'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ PENDIENTES ══ */}
      {!loading && vista === 'pendientes' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
            <p style={SEC}>Cuentas pendientes de cobro ({pendientes.length})</p>
            <p style={{ fontSize:'13px', fontWeight:'700', color:'#dc2626' }}>
              Total: {fmt(pendientes.reduce((a,c)=>a+(c.saldo||0),0))}
            </p>
          </div>
          {pendientes.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#059669' }}>
              <p style={{ fontSize:'32px', margin:0 }}>✅</p>
              <p style={{ fontSize:'14px', margin:'8px 0' }}>¡Sin cuentas pendientes!</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {pendientes.map(c => (
                <div key={c.id} style={{ ...CARD, borderLeft:'4px solid #f59e0b' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'8px' }}>
                    <div>
                      <p style={{ margin:'0 0 2px', fontWeight:'700', fontSize:'14px' }}>{c.paciente_nombre}</p>
                      <p style={{ margin:0, fontSize:'12px', color:'#666' }}>{c.especialidad} · {c.doctor_nombre} · {c.fecha}</p>
                      <div style={{ marginTop:'4px', display:'flex', gap:'12px', fontSize:'12px' }}>
                        <span>Total: <strong>{fmt(c.total)}</strong></span>
                        <span style={{ color:'#059669' }}>Pagado: <strong>{fmt(c.total_pagado)}</strong></span>
                        <span style={{ color:'#dc2626' }}>Saldo: <strong>{fmt(c.saldo)}</strong></span>
                      </div>
                    </div>
                    <div>
                      {pagandoId === c.id ? (
                        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                          <input type="number" value={montoPago} onChange={e=>setMontoPago(e.target.value)}
                            placeholder={fmt(c.saldo)} style={{ width:'80px', padding:'6px', border:'1.5px solid #00a8cc', borderRadius:'6px', fontSize:'13px' }}/>
                          <select value={tipoPago} onChange={e=>setTipoPago(e.target.value)}
                            style={{ padding:'6px', border:'1px solid #e5e7eb', borderRadius:'6px', fontSize:'12px' }}>
                            <option value="efectivo">💵 Efectivo</option>
                            <option value="transferencia">🏦 Transfer.</option>
                            <option value="tarjeta">💳 Tarjeta</option>
                          </select>
                          <button onClick={()=>registrarPago(c.id)} style={{ padding:'6px 10px', background:'#059669', color:'white', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontWeight:'700' }}>✓</button>
                          <button onClick={()=>setPagandoId(null)} style={{ padding:'6px 8px', background:'#f3f4f6', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer' }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={()=>{setPagandoId(c.id);setMontoPago((c.saldo||0).toFixed(2));}}
                          style={{ padding:'7px 14px', background:'#00a8cc', color:'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                          💰 Cobrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ GANANCIAS POR DOCTOR ══ */}
      {!loading && vista === 'doctores' && (
        <div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'14px', flexWrap:'wrap' }}>
            <label style={{ fontSize:'12px', fontWeight:'700', color:'#005f73' }}>Período:</label>
            <input type="date" value={fechaIni} onChange={e=>setFechaIni(e.target.value)} style={{ padding:'6px 10px', border:'1.5px solid #b2ebf2', borderRadius:'6px', fontSize:'13px' }}/>
            <span style={{ color:'#999' }}>—</span>
            <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} style={{ padding:'6px 10px', border:'1.5px solid #b2ebf2', borderRadius:'6px', fontSize:'13px' }}/>
            <button onClick={cargar} style={{ padding:'6px 12px', background:'#00a8cc', color:'white', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontWeight:'700' }}>Buscar</button>
          </div>

          {doctores && (
            <>
              {/* Resumen total */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'10px', marginBottom:'16px' }}>
                {[
                  { label:'Total Facturado', val:doctores.total_facturado, color:'#0284c7' },
                  { label:'Total Cobrado', val:doctores.total_cobrado, color:'#059669' },
                  { label:'Para Doctores', val:doctores.total_ganancia_doctores||0, color:'#d97706' },
                  { label:'Para la Clínica', val:doctores.total_ganancia_clinica||0, color:'#7c3aed' },
                ].map(item=>(
                  <div key={item.label} style={{ ...CARD, borderLeft:`4px solid ${item.color}` }}>
                    <p style={{ margin:'0 0 4px', fontSize:'11px', color:'#666' }}>{item.label}</p>
                    <p style={{ margin:0, fontSize:'20px', fontWeight:'800', color:item.color }}>{fmt(item.val)}</p>
                  </div>
                ))}
              </div>

              {/* Tabla por doctor */}
              <div style={CARD}>
                <p style={SEC}>Desglose por doctor</p>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                    <thead>
                      <tr style={{ background:'#f0f9ff' }}>
                        {['Doctor','Especialidad','% Ganancia','Consultas','Total Cobrado','Ganancia Doctor','Ganancia Clínica','Pendiente'].map(h=>(
                          <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'#005f73', fontWeight:'700', fontSize:'11px', borderBottom:'2px solid #b2ebf2', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {doctores.doctores.map((d,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid #f0f0f0', background:i%2===0?'white':'#fafafa' }}>
                          <td style={{ padding:'8px 10px', fontWeight:'700' }}>{d.doctor_nombre}</td>
                          <td style={{ padding:'8px 10px', color:'#555' }}>{d.especialidad}</td>
                          <td style={{ padding:'8px 10px' }}>
                            <span style={{ background:'#e0f7fa', color:'#005f73', borderRadius:'10px', padding:'2px 8px', fontSize:'12px', fontWeight:'800' }}>{d.porcentaje}%</span>
                          </td>
                          <td style={{ padding:'8px 10px', textAlign:'center' }}>{d.num_consultas}</td>
                          <td style={{ padding:'8px 10px', fontWeight:'700', color:'#0284c7' }}>{fmt(d.total_cobrado)}</td>
                          <td style={{ padding:'8px 10px', fontWeight:'800', color:'#d97706' }}>{fmt(d.ganancia_doctor)}</td>
                          <td style={{ padding:'8px 10px', fontWeight:'800', color:'#7c3aed' }}>{fmt(d.ganancia_clinica)}</td>
                          <td style={{ padding:'8px 10px', color: d.saldo_pendiente>0?'#dc2626':'#059669', fontWeight:'700' }}>{fmt(d.saldo_pendiente)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop:'10px', background:'#fffbeb', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', color:'#92400e' }}>
                  💡 El % de ganancia se configura en la pestaña <strong>Doctores</strong>. Si sale 50% por defecto, es porque el doctor no tiene porcentaje configurado.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ POR ESPECIALIDAD ══ */}
      {!loading && vista === 'especialidad' && (
        <div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'14px', flexWrap:'wrap' }}>
            <label style={{ fontSize:'12px', fontWeight:'700', color:'#005f73' }}>Período:</label>
            <input type="date" value={fechaIni} onChange={e=>setFechaIni(e.target.value)} style={{ padding:'6px 10px', border:'1.5px solid #b2ebf2', borderRadius:'6px', fontSize:'13px' }}/>
            <span style={{ color:'#999' }}>—</span>
            <input type="date" value={fechaFin} onChange={e=>setFechaFin(e.target.value)} style={{ padding:'6px 10px', border:'1.5px solid #b2ebf2', borderRadius:'6px', fontSize:'13px' }}/>
            <button onClick={cargar} style={{ padding:'6px 12px', background:'#00a8cc', color:'white', border:'none', borderRadius:'6px', fontSize:'12px', cursor:'pointer', fontWeight:'700' }}>Buscar</button>
          </div>
          {porEspecialidad && (
            <div style={CARD}>
              <p style={SEC}>Ingresos por especialidad</p>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                  <thead>
                    <tr style={{ background:'#f0f9ff' }}>
                      {['Especialidad','Consultas','Facturado','Cobrado','Pendiente'].map(h=>(
                        <th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'#005f73', fontWeight:'700', fontSize:'11px', borderBottom:'2px solid #b2ebf2' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(porEspecialidad.especialidades||[]).map((e,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f0f0f0', background:i%2===0?'white':'#fafafa' }}>
                        <td style={{ padding:'8px 10px', fontWeight:'700' }}>{e.especialidad}</td>
                        <td style={{ padding:'8px 10px', textAlign:'center' }}>{e.num_consultas}</td>
                        <td style={{ padding:'8px 10px', color:'#0284c7', fontWeight:'700' }}>{fmt(e.total_facturado)}</td>
                        <td style={{ padding:'8px 10px', color:'#059669', fontWeight:'700' }}>{fmt(e.total_cobrado)}</td>
                        <td style={{ padding:'8px 10px', color: e.saldo_pendiente>0?'#dc2626':'#059669', fontWeight:'700' }}>{fmt(e.saldo_pendiente)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CIERRES DE CAJA ══ */}
      {!loading && vista === 'cierres' && (
        <div>
          <p style={{ ...SEC, marginBottom:'12px' }}>Historial de cierres de caja</p>
          {cierres.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#999' }}>
              <p style={{ fontSize:'32px', margin:0 }}>📋</p>
              <p style={{ fontSize:'14px', margin:'8px 0' }}>Sin cierres registrados</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {cierres.map((c,i)=>(
                <div key={i} style={{ ...CARD, borderLeft:'4px solid #7c3aed' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'8px' }}>
                    <div>
                      <p style={{ margin:'0 0 4px', fontWeight:'700', fontSize:'14px' }}>📅 {c.fecha}</p>
                      <div style={{ display:'flex', gap:'16px', fontSize:'12px', color:'#555', flexWrap:'wrap' }}>
                        <span>💵 Efectivo: <strong>{fmt(c.total_efectivo)}</strong></span>
                        <span>🏦 Transfer.: <strong>{fmt(c.total_transferencia)}</strong></span>
                        <span>💳 Tarjeta: <strong>{fmt(c.total_tarjeta)}</strong></span>
                        <span>{c.num_transacciones} transacciones</span>
                      </div>
                      {c.observaciones && <p style={{ margin:'4px 0 0', fontSize:'12px', color:'#6b7280', fontStyle:'italic' }}>📝 {c.observaciones}</p>}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <p style={{ margin:0, fontSize:'22px', fontWeight:'900', color:'#7c3aed' }}>{fmt(c.total_general)}</p>
                      <span style={{ fontSize:'11px', color: c.estado==='cerrado'?'#059669':'#d97706', fontWeight:'700', background: c.estado==='cerrado'?'#d1fae5':'#fef3c7', borderRadius:'8px', padding:'2px 8px' }}>
                        {c.estado==='cerrado'?'✓ Cerrado':'⏳ Abierto'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}