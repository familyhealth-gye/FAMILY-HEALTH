import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
const hoy = () => new Date().toISOString().split("T")[0];

const FORMAS_PAGO = [
  { value: "efectivo", label: "💵 Efectivo" },
  { value: "transferencia", label: "🏦 Transferencia" },
  { value: "tarjeta", label: "💳 Tarjeta" },
  { value: "seguro", label: "🏥 Seguro Médico" },
  { value: "cheque", label: "📝 Cheque" },
];

const CARD = {
  background: "white", borderRadius: "10px", padding: "14px 16px",
  border: "1px solid #e0f7fa", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

export const FacturacionTab = ({ token, user }) => {
  const [vista, setVista] = useState("lista"); // lista | nueva | config
  const [facturas, setFacturas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroFechaIni, setFiltroFechaIni] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Formulario nueva factura
  const FORM_VACIO = {
    paciente_nombre: "", paciente_cedula: "", paciente_direccion: "",
    paciente_email: "", paciente_telefono: "",
    doctor_nombre: "", especialidad: "",
    tipo_pago: "efectivo", referencia_pago: "",
    consulta_financiera_id: "", appointment_id: "",
    numero_autorizacion: "", observaciones: "",
    iva_porcentaje: 0,
    detalles: [{ descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0, subtotal: 0 }],
  };
  const [form, setForm] = useState(FORM_VACIO);

  // Config clínica
  const CONFIG_VACIO = {
    ruc: "", razon_social: "CENTRO DE ESPECIALIDADES FAMILY HEALTH",
    nombre_comercial: "FAMILY HEALTH",
    direccion: "Mucho Lote 2 MZ 2833 Villa 15, Guayaquil",
    telefono: "096-291-2170",
    email: "centrodeespecialidadesfamilyhe@gmail.com",
    establecimiento: "001", punto_emision: "001",
  };
  const [configForm, setConfigForm] = useState(CONFIG_VACIO);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [facRes, statRes, cfgRes] = await Promise.all([
        axios.get(`${API}/invoices`, { headers }),
        axios.get(`${API}/invoices/stats`, { headers }),
        axios.get(`${API}/configuracion/clinica`, { headers }),
      ]);
      setFacturas(facRes.data || []);
      setStats(statRes.data);
      if (cfgRes.data && Object.keys(cfgRes.data).length > 0) {
        setConfig(cfgRes.data);
        setConfigForm({ ...CONFIG_VACIO, ...cfgRes.data });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // ── Calcular totales del formulario ──
  const calcularDetalle = (det) => {
    const sub = parseFloat(det.precio_unitario || 0) * parseFloat(det.cantidad || 1) - parseFloat(det.descuento || 0);
    return { ...det, subtotal: Math.max(0, sub) };
  };
  const subtotalForm = form.detalles.reduce((a, d) => a + (parseFloat(d.subtotal) || 0), 0);
  const ivaForm = subtotalForm * (form.iva_porcentaje / 100);
  const totalForm = subtotalForm + ivaForm;

  const updateDetalle = (idx, campo, valor) => {
    const dets = form.detalles.map((d, i) => {
      if (i !== idx) return d;
      const updated = { ...d, [campo]: valor };
      return calcularDetalle(updated);
    });
    setForm(f => ({ ...f, detalles: dets }));
  };

  const addDetalle = () => setForm(f => ({
    ...f,
    detalles: [...f.detalles, { descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0, subtotal: 0 }]
  }));

  const removeDetalle = (idx) => {
    if (form.detalles.length === 1) return;
    setForm(f => ({ ...f, detalles: f.detalles.filter((_, i) => i !== idx) }));
  };

  // ── Guardar factura ──
  const handleGuardar = async () => {
    if (!form.paciente_nombre || !form.paciente_cedula) {
      toast.error("Nombre y cédula del paciente son obligatorios");
      return;
    }
    if (form.detalles.every(d => !d.descripcion)) {
      toast.error("Agrega al menos un servicio");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        detalles: form.detalles
          .filter(d => d.descripcion)
          .map(d => calcularDetalle(d)),
      };
      await axios.post(`${API}/invoices`, payload, { headers });
      toast.success("✅ Factura creada correctamente");
      setForm(FORM_VACIO);
      setVista("lista");
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al crear factura");
    }
    setLoading(false);
  };

  // ── Emitir al SRI ──
  const handleEmitirSRI = async (id) => {
    if (!window.confirm("¿Emitir esta factura al SRI? Esta acción es irreversible.")) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/sri/emitir/${id}`, {}, { headers });
      if (res.data.ok) {
        toast.success(`✅ Factura AUTORIZADA por el SRI\nN°: ${res.data.numero_autorizacion}`);
      } else {
        toast.warning(`SRI respondió: ${res.data.sri_estado} — ${res.data.autorizacion?.mensaje || res.data.envio?.mensaje || ""}`);
      }
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al emitir al SRI");
    }
    setLoading(false);
  };

  // ── Consultar estado SRI ──
  const handleConsultarSRI = async (id) => {
    try {
      const res = await axios.get(`${API}/sri/estado/${id}`, { headers });
      if (res.data.ok) {
        toast.success(`✅ AUTORIZADO\nN°: ${res.data.numero_autorizacion}`);
      } else {
        toast.info(`Estado SRI: ${res.data.estado} — ${res.data.mensaje}`);
      }
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error consultando SRI");
    }
  };

  // ── Enviar RIDE por correo ──
  const handleEnviarCorreo = async (factura) => {
    let email = factura.paciente_email || "";
    if (!email) {
      email = window.prompt(`Email del paciente ${factura.paciente_nombre}:`);
      if (!email) return;
    }
    try {
      const res = await axios.post(`${API}/sri/enviar-ride/${factura.id}`, { email }, { headers });
      toast.success(res.data.mensaje);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al enviar correo");
    }
  };

  // ── Descargar XML ──
  const handleDescargarXML = (id, numero) => {
    window.open(`${API}/sri/descargar-xml/${id}`, "_blank");
  };

  // ── Anular factura ──
  const handleAnular = async (id) => {
    const motivo = window.prompt("Motivo de anulación:");
    if (!motivo) return;
    try {
      await axios.post(`${API}/invoices/${id}/anular`, { motivo }, { headers });
      toast.success("Factura anulada");
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al anular");
    }
  };

  // ── Descargar PDF ──
  const handlePDF = (id, numero) => {
    window.open(`${API}/invoices/${id}/pdf?token=${token}`, "_blank");
  };

  // ── Exportar CSV ──
  const handleExport = async () => {
    try {
      const res = await axios.get(`${API}/invoices/export`, { headers, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url; a.download = "facturas_family_health.csv"; a.click();
      toast.success("Exportado correctamente");
    } catch { toast.error("Error al exportar"); }
  };

  // ── Guardar config clínica ──
  const handleGuardarConfig = async () => {
    try {
      await axios.post(`${API}/configuracion/clinica`, configForm, { headers });
      toast.success("✅ Configuración guardada");
      setConfig(configForm);
      setVista("lista");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al guardar");
    }
  };

  // ── Filtrar facturas ──
  const facturasFiltradas = facturas.filter(f => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || f.paciente_nombre?.toLowerCase().includes(q) ||
      f.paciente_cedula?.includes(q) || f.numero_factura?.includes(q);
    const matchEstado = !filtroEstado || f.estado === filtroEstado;
    const matchFecha = (!filtroFechaIni || f.fecha >= filtroFechaIni) &&
      (!filtroFechaFin || f.fecha <= filtroFechaFin);
    return matchQ && matchEstado && matchFecha;
  });

  const SEC = { fontSize: "11px", fontWeight: "700", color: "#005f73", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" };
  const INPUT = { width: "100%", padding: "8px 10px", border: "1.5px solid #b2ebf2", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box" };
  const LABEL = { fontSize: "11px", fontWeight: "600", color: "#005f73", display: "block", marginBottom: "3px" };

  const TABS = [
    { id: "lista", label: "📋 Facturas" },
    { id: "nueva", label: "➕ Nueva Factura" },
    ...(user?.role === "Administrador" ? [{ id: "config", label: "⚙️ Config. Clínica" }] : []),
  ];

  return (
    <div style={{ padding: "16px", maxWidth: "1100px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#005f73,#00a8cc)", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ color: "white", margin: 0, fontSize: "18px", fontWeight: "800" }}>🧾 Facturación</h2>
            <p style={{ color: "rgba(255,255,255,0.8)", margin: "2px 0 0", fontSize: "12px" }}>
              {config?.ruc ? `RUC: ${config.ruc} · ` : "⚠️ Configure el RUC en Config. Clínica · "}
              Comprobantes internos para control de ingresos
            </p>
          </div>
          {stats && (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {[
                { label: "Hoy", val: stats.total_hoy, n: stats.num_facturas_hoy },
                { label: "Este mes", val: stats.total_mes, n: stats.num_facturas_mes },
                { label: "Total", val: stats.total_general, n: stats.num_facturas_total },
              ].map(s => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.15)", borderRadius: "8px", padding: "6px 12px", textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.7)", margin: 0, fontSize: "10px" }}>{s.label}</p>
                  <p style={{ color: "white", margin: 0, fontWeight: "800", fontSize: "15px" }}>{fmt(s.val)}</p>
                  <p style={{ color: "rgba(255,255,255,0.6)", margin: 0, fontSize: "10px" }}>{s.n} facturas</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setVista(t.id)} style={{
            padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
            fontWeight: "600", fontSize: "13px", whiteSpace: "nowrap",
            background: vista === t.id ? "#00a8cc" : "#f0f9ff",
            color: vista === t.id ? "white" : "#005f73",
            boxShadow: vista === t.id ? "0 2px 8px rgba(0,168,204,0.3)" : "none",
          }}>{t.label}</button>
        ))}
        <button onClick={handleExport} style={{ marginLeft: "auto", padding: "8px 14px", background: "white", border: "1.5px solid #b2ebf2", borderRadius: "8px", cursor: "pointer", fontSize: "12px", color: "#005f73", fontWeight: "600" }}>
          ⬇️ Exportar CSV
        </button>
      </div>

      {/* ══ LISTA ══ */}
      {vista === "lista" && (
        <div>
          {/* Filtros */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 140px", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar por paciente, cédula o N° factura..."
              style={{ ...INPUT }} />
            <input type="date" value={filtroFechaIni} onChange={e => setFiltroFechaIni(e.target.value)} style={INPUT} />
            <input type="date" value={filtroFechaFin} onChange={e => setFiltroFechaFin(e.target.value)} style={INPUT} />
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={INPUT}>
              <option value="">Todos</option>
              <option value="emitida">Emitidas</option>
              <option value="anulada">Anuladas</option>
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#00a8cc" }}>⏳ Cargando...</div>
          ) : facturasFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "50px", color: "#999" }}>
              <p style={{ fontSize: "40px", margin: 0 }}>🧾</p>
              <p style={{ fontSize: "15px", margin: "10px 0 4px" }}>Sin facturas</p>
              <p style={{ fontSize: "12px" }}>Crea tu primera factura con el botón "➕ Nueva Factura"</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f0f9ff" }}>
                    {["N° Factura", "Fecha", "Paciente", "Cédula", "Doctor", "Total", "Forma Pago", "N° Autorización", "Estado", "Acciones"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#005f73", fontWeight: "700", fontSize: "11px", borderBottom: "2px solid #b2ebf2", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {facturasFiltradas.map((f, i) => (
                    <tr key={f.id} style={{ borderBottom: "1px solid #f0f0f0", background: f.estado === "anulada" ? "#fff5f5" : i % 2 === 0 ? "white" : "#fafafa", opacity: f.estado === "anulada" ? 0.7 : 1 }}>
                      <td style={{ padding: "8px 10px", fontWeight: "700", color: "#005f73", whiteSpace: "nowrap" }}>{f.numero_factura}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{f.fecha}</td>
                      <td style={{ padding: "8px 10px", fontWeight: "600" }}>{f.paciente_nombre}</td>
                      <td style={{ padding: "8px 10px", color: "#555" }}>{f.paciente_cedula}</td>
                      <td style={{ padding: "8px 10px", color: "#555" }}>{f.doctor_nombre}</td>
                      <td style={{ padding: "8px 10px", fontWeight: "800", color: "#005f73" }}>{fmt(f.total || f.valor)}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ background: "#e0f7fa", color: "#005f73", borderRadius: "10px", padding: "2px 8px", fontSize: "11px", fontWeight: "600" }}>
                          {f.tipo_pago}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: f.numero_autorizacion ? "#059669" : "#999", fontSize: "11px" }}>
                        {f.numero_autorizacion || "—"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{
                            background: f.estado === "anulada" ? "#fee2e2" : "#d1fae5",
                            color: f.estado === "anulada" ? "#dc2626" : "#059669",
                            borderRadius: "10px", padding: "2px 8px", fontSize: "10px", fontWeight: "700",
                            whiteSpace: "nowrap",
                          }}>
                            {f.estado === "anulada" ? "✗ Anulada" : "✓ Emitida"}
                          </span>
                          {f.sri_estado && (
                            <span style={{
                              background: f.sri_estado === "AUTORIZADO" ? "#dcfce7" : f.sri_estado === "RECIBIDA" ? "#fef3c7" : "#fee2e2",
                              color: f.sri_estado === "AUTORIZADO" ? "#15803d" : f.sri_estado === "RECIBIDA" ? "#92400e" : "#dc2626",
                              borderRadius: "10px", padding: "1px 6px", fontSize: "10px", fontWeight: "700",
                              whiteSpace: "nowrap",
                            }}>
                              {f.sri_estado === "AUTORIZADO" ? "✅ SRI OK" : f.sri_estado === "RECIBIDA" ? "⏳ SRI Proc." : `⚠️ ${f.sri_estado}`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                          {/* PDF siempre disponible */}
                          <button onClick={() => handlePDF(f.id, f.numero_factura)}
                            title="Descargar PDF"
                            style={{ padding: "4px 7px", background: "#e0f7fa", border: "none", borderRadius: "5px", fontSize: "11px", cursor: "pointer", color: "#005f73" }}>
                            📄
                          </button>
                          {/* Emitir al SRI */}
                          {f.estado !== "anulada" && f.sri_estado !== "AUTORIZADO" && (
                            <button onClick={() => handleEmitirSRI(f.id)}
                              title="Emitir al SRI"
                              style={{ padding: "4px 7px", background: "#005f73", border: "none", borderRadius: "5px", fontSize: "11px", cursor: "pointer", color: "white", fontWeight: "700" }}>
                              📤 SRI
                            </button>
                          )}
                          {/* Consultar estado si fue enviado pero no autorizado */}
                          {f.sri_estado && f.sri_estado !== "AUTORIZADO" && f.clave_acceso && (
                            <button onClick={() => handleConsultarSRI(f.id)}
                              title="Consultar estado en SRI"
                              style={{ padding: "4px 7px", background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: "5px", fontSize: "11px", cursor: "pointer", color: "#92400e" }}>
                              🔄
                            </button>
                          )}
                          {/* Enviar por correo */}
                          {f.estado !== "anulada" && (
                            <button onClick={() => handleEnviarCorreo(f)}
                              title="Enviar RIDE por correo"
                              style={{ padding: "4px 7px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "5px", fontSize: "11px", cursor: "pointer", color: "#059669" }}>
                              📧
                            </button>
                          )}
                          {/* Descargar XML si está disponible */}
                          {f.sri_xml_b64 && (
                            <button onClick={() => handleDescargarXML(f.id, f.numero_factura)}
                              title="Descargar XML firmado"
                              style={{ padding: "4px 7px", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: "5px", fontSize: "11px", cursor: "pointer", color: "#7c3aed" }}>
                              📎 XML
                            </button>
                          )}
                          {/* Anular */}
                          {f.estado !== "anulada" && (
                            <button onClick={() => handleAnular(f.id)}
                              title="Anular factura"
                              style={{ padding: "4px 7px", background: "#fee2e2", border: "none", borderRadius: "5px", fontSize: "11px", cursor: "pointer", color: "#dc2626" }}>
                              ✗
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ NUEVA FACTURA ══ */}
      {vista === "nueva" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

          {/* Columna izquierda — Receptor */}
          <div>
            <div style={{ ...CARD, marginBottom: "12px" }}>
              <p style={SEC}>👤 Datos del Paciente (Receptor)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <label style={LABEL}>Nombre completo *</label>
                  <input value={form.paciente_nombre} onChange={e => setForm(f => ({ ...f, paciente_nombre: e.target.value }))}
                    placeholder="Apellidos y nombres" style={INPUT} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={LABEL}>Cédula / RUC *</label>
                    <input value={form.paciente_cedula} onChange={e => setForm(f => ({ ...f, paciente_cedula: e.target.value }))}
                      placeholder="0912345678" style={INPUT} />
                  </div>
                  <div>
                    <label style={LABEL}>Teléfono</label>
                    <input value={form.paciente_telefono} onChange={e => setForm(f => ({ ...f, paciente_telefono: e.target.value }))}
                      placeholder="09..." style={INPUT} />
                  </div>
                </div>
                <div>
                  <label style={LABEL}>Dirección</label>
                  <input value={form.paciente_direccion} onChange={e => setForm(f => ({ ...f, paciente_direccion: e.target.value }))}
                    placeholder="Dirección del paciente" style={INPUT} />
                </div>
                <div>
                  <label style={LABEL}>Email</label>
                  <input value={form.paciente_email} onChange={e => setForm(f => ({ ...f, paciente_email: e.target.value }))}
                    placeholder="email@ejemplo.com" style={INPUT} />
                </div>
              </div>
            </div>

            <div style={{ ...CARD, marginBottom: "12px" }}>
              <p style={SEC}>🏥 Médico y Pago</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={LABEL}>Doctor</label>
                    <input value={form.doctor_nombre} onChange={e => setForm(f => ({ ...f, doctor_nombre: e.target.value }))}
                      placeholder="Nombre del doctor" style={INPUT} />
                  </div>
                  <div>
                    <label style={LABEL}>Especialidad</label>
                    <input value={form.especialidad} onChange={e => setForm(f => ({ ...f, especialidad: e.target.value }))}
                      placeholder="Odontología..." style={INPUT} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>
                    <label style={LABEL}>Forma de pago *</label>
                    <select value={form.tipo_pago} onChange={e => setForm(f => ({ ...f, tipo_pago: e.target.value }))} style={INPUT}>
                      {FORMAS_PAGO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={LABEL}>N° Referencia / Transferencia</label>
                    <input value={form.referencia_pago} onChange={e => setForm(f => ({ ...f, referencia_pago: e.target.value }))}
                      placeholder="Opcional" style={INPUT} />
                  </div>
                </div>
                <div>
                  <label style={LABEL}>N° Autorización SRI (si ya emitió en el facturero SRI)</label>
                  <input value={form.numero_autorizacion} onChange={e => setForm(f => ({ ...f, numero_autorizacion: e.target.value }))}
                    placeholder="49 dígitos del comprobante electrónico" style={INPUT} />
                  <p style={{ fontSize: "10px", color: "#999", margin: "2px 0 0" }}>
                    Si lo deja vacío, la factura queda como comprobante interno hasta ingresar el número del SRI.
                  </p>
                </div>
                <div>
                  <label style={LABEL}>Observaciones</label>
                  <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                    rows={2} placeholder="Notas adicionales..." style={{ ...INPUT, resize: "vertical" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha — Detalle servicios */}
          <div>
            <div style={{ ...CARD, marginBottom: "12px" }}>
              <p style={SEC}>📋 Detalle de Servicios</p>

              {form.detalles.map((det, idx) => (
                <div key={idx} style={{ background: "#f8fdff", borderRadius: "8px", padding: "10px", marginBottom: "8px", border: "1px solid #e0f7fa" }}>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                    <input value={det.descripcion} onChange={e => updateDetalle(idx, "descripcion", e.target.value)}
                      placeholder={`Servicio ${idx + 1} — Ej: Endodoncia pieza 16`}
                      style={{ ...INPUT, flex: 2 }} />
                    {form.detalles.length > 1 && (
                      <button onClick={() => removeDetalle(idx)}
                        style={{ padding: "6px 10px", background: "#fee2e2", border: "none", borderRadius: "6px", color: "#dc2626", cursor: "pointer", fontSize: "14px" }}>✕</button>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr", gap: "6px" }}>
                    <div>
                      <label style={{ ...LABEL, fontSize: "10px" }}>Cant.</label>
                      <input type="number" min="1" step="1" value={det.cantidad}
                        onChange={e => updateDetalle(idx, "cantidad", parseFloat(e.target.value) || 1)}
                        style={{ ...INPUT, textAlign: "center" }} />
                    </div>
                    <div>
                      <label style={{ ...LABEL, fontSize: "10px" }}>Precio unit. $</label>
                      <input type="number" min="0" step="0.01" value={det.precio_unitario}
                        onChange={e => updateDetalle(idx, "precio_unitario", parseFloat(e.target.value) || 0)}
                        style={INPUT} />
                    </div>
                    <div>
                      <label style={{ ...LABEL, fontSize: "10px" }}>Descuento $</label>
                      <input type="number" min="0" step="0.01" value={det.descuento}
                        onChange={e => updateDetalle(idx, "descuento", parseFloat(e.target.value) || 0)}
                        style={INPUT} />
                    </div>
                    <div>
                      <label style={{ ...LABEL, fontSize: "10px" }}>Subtotal</label>
                      <div style={{ padding: "8px 10px", background: "#e0f7fa", borderRadius: "7px", fontSize: "13px", fontWeight: "700", color: "#005f73" }}>
                        {fmt(det.subtotal)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addDetalle} style={{ width: "100%", padding: "8px", background: "#f0f9ff", border: "1.5px dashed #b2ebf2", borderRadius: "8px", color: "#005f73", fontSize: "13px", cursor: "pointer", fontWeight: "600" }}>
                + Agregar otro servicio
              </button>
            </div>

            {/* Totales */}
            <div style={{ ...CARD }}>
              <p style={SEC}>💰 Totales</p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ ...LABEL, marginBottom: 0, whiteSpace: "nowrap" }}>IVA %:</label>
                <select value={form.iva_porcentaje}
                  onChange={e => setForm(f => ({ ...f, iva_porcentaje: parseFloat(e.target.value) }))}
                  style={{ ...INPUT, width: "120px" }}>
                  <option value={0}>0% — Exento (servicios médicos)</option>
                  <option value={12}>12% — Con IVA</option>
                  <option value={15}>15% — Con IVA</option>
                </select>
                <p style={{ fontSize: "11px", color: "#999", margin: 0 }}>
                  Los servicios médicos están exentos de IVA en Ecuador
                </p>
              </div>

              <div style={{ background: "#f8fdff", borderRadius: "8px", padding: "12px", border: "1.5px solid #b2ebf2" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                  <span style={{ color: "#555" }}>Subtotal:</span>
                  <span style={{ fontWeight: "700" }}>{fmt(subtotalForm)}</span>
                </div>
                {form.iva_porcentaje > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                    <span style={{ color: "#555" }}>IVA ({form.iva_porcentaje}%):</span>
                    <span style={{ fontWeight: "700" }}>{fmt(ivaForm)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "17px", fontWeight: "800", color: "#005f73", borderTop: "1px solid #b2ebf2", paddingTop: "8px", marginTop: "4px" }}>
                  <span>TOTAL:</span>
                  <span>{fmt(totalForm)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button onClick={handleGuardar} disabled={loading} style={{
                  flex: 1, padding: "12px", background: "linear-gradient(135deg,#005f73,#00a8cc)",
                  color: "white", border: "none", borderRadius: "8px",
                  fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                }}>
                  {loading ? "⏳ Guardando..." : "💾 Emitir Factura"}
                </button>
                <button onClick={() => { setForm(FORM_VACIO); setVista("lista"); }} style={{
                  padding: "12px 16px", background: "#f3f4f6", border: "none", borderRadius: "8px", cursor: "pointer",
                }}>Cancelar</button>
              </div>
          </div>
        </div>
      )}

      {/* ══ CONFIG CLÍNICA ══ */}
      {vista === "config" && user?.role === "Administrador" && (
        <div style={{ maxWidth: "600px" }}>
          <div style={CARD}>
            <p style={SEC}>⚙️ Datos de la Clínica para Facturas</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={LABEL}>RUC del Centro *</label>
                <input value={configForm.ruc} onChange={e => setConfigForm(f => ({ ...f, ruc: e.target.value }))}
                  placeholder="0912345678001" style={INPUT} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={LABEL}>Establecimiento</label>
                  <input value={configForm.establecimiento} onChange={e => setConfigForm(f => ({ ...f, establecimiento: e.target.value }))}
                    placeholder="001" style={INPUT} />
                </div>
                <div>
                  <label style={LABEL}>Punto de Emisión</label>
                  <input value={configForm.punto_emision} onChange={e => setConfigForm(f => ({ ...f, punto_emision: e.target.value }))}
                    placeholder="001" style={INPUT} />
                </div>
              </div>
              <div>
                <label style={LABEL}>Razón Social</label>
                <input value={configForm.razon_social} onChange={e => setConfigForm(f => ({ ...f, razon_social: e.target.value }))}
                  style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>Nombre Comercial</label>
                <input value={configForm.nombre_comercial} onChange={e => setConfigForm(f => ({ ...f, nombre_comercial: e.target.value }))}
                  style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>Dirección</label>
                <input value={configForm.direccion} onChange={e => setConfigForm(f => ({ ...f, direccion: e.target.value }))}
                  style={INPUT} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={LABEL}>Teléfono</label>
                  <input value={configForm.telefono} onChange={e => setConfigForm(f => ({ ...f, telefono: e.target.value }))}
                    style={INPUT} />
                </div>
                <div>
                  <label style={LABEL}>Email</label>
                  <input value={configForm.email} onChange={e => setConfigForm(f => ({ ...f, email: e.target.value }))}
                    style={INPUT} />
                </div>
              </div>
              <button onClick={handleGuardarConfig} style={{
                padding: "10px", background: "#005f73", color: "white",
                border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "700", cursor: "pointer",
              }}>
                💾 Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};