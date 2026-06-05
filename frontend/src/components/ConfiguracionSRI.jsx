import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const INPUT = { width:"100%", padding:"9px 12px", border:"1.5px solid #b2ebf2", borderRadius:"7px", fontSize:"13px", boxSizing:"border-box" };
const LABEL = { fontSize:"11px", fontWeight:"700", color:"#005f73", display:"block", marginBottom:"4px" };
const CARD = { background:"white", borderRadius:"12px", padding:"20px", border:"1px solid #e0f7fa", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", marginBottom:"16px" };

export const ConfiguracionSRI = ({ token }) => {
  const [sriCfg, setSriCfg]       = useState(null);
  const [emailCfg, setEmailCfg]   = useState(null);
  const [loadingSRI, setLoadingSRI]   = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  // SRI form
  const [p12File, setP12File]     = useState(null);
  const [p12Password, setP12Password] = useState("");
  const [ambiente, setAmbiente]   = useState("produccion");

  // Email form
  const [emailForm, setEmailForm] = useState({ email:"", app_password:"", nombre:"Family Health" });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    try {
      const [sriRes, emailRes] = await Promise.all([
        axios.get(`${API}/sri/configuracion`, { headers }),
        axios.get(`${API}/configuracion/email`, { headers }),
      ]);
      setSriCfg(sriRes.data);
      setEmailCfg(emailRes.data);
      if (emailRes.data?.email) {
        setEmailForm(f => ({ ...f, email: emailRes.data.email, nombre: emailRes.data.nombre || "Family Health" }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSRISubmit = async () => {
    if (!p12File) { toast.error("Selecciona el archivo .p12"); return; }
    if (!p12Password) { toast.error("Ingresa la contraseña del certificado"); return; }
    setLoadingSRI(true);
    try {
      // Leer .p12 como base64
      const p12_b64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(p12File);
      });

      const res = await axios.post(`${API}/sri/configurar-firma`, {
        p12_base64: p12_b64,
        password: p12Password,
        ambiente,
      }, { headers });

      toast.success(res.data.mensaje);
      setP12File(null);
      setP12Password("");
      setKeyTemporal("");
      // Reset file input DOM element
      const fileInput = document.querySelector('input[type="file"][accept=".p12,.pfx"]');
      if (fileInput) fileInput.value = "";
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al configurar el certificado");
    }
    setLoadingSRI(false);
  };

  const handleEmailSubmit = async () => {
    if (!emailForm.email || !emailForm.app_password) {
      toast.error("Email y contraseña de aplicación son obligatorios");
      return;
    }
    setLoadingEmail(true);
    try {
      const res = await axios.post(`${API}/configuracion/email`, emailForm, { headers });
      toast.success(res.data.mensaje);
      await cargar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al guardar");
    }
    setLoadingEmail(false);
  };

  return (
    <div style={{ maxWidth:"700px", margin:"0 auto", padding:"16px" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#005f73,#00a8cc)", borderRadius:"12px", padding:"16px 20px", marginBottom:"20px" }}>
        <h2 style={{ color:"white", margin:0, fontSize:"18px", fontWeight:"800" }}>⚙️ Configuración SRI y Correo</h2>
        <p style={{ color:"rgba(255,255,255,0.8)", margin:"4px 0 0", fontSize:"12px" }}>
          Configura el certificado de firma electrónica y el correo institucional
        </p>
      </div>

      {/* ── FIRMA ELECTRÓNICA SRI ── */}
      <div style={CARD}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
          <h3 style={{ margin:0, fontSize:"15px", color:"#005f73" }}>🔏 Firma Electrónica (.p12)</h3>
          {sriCfg?.configurado ? (
            <span style={{ background:"#d1fae5", color:"#059669", borderRadius:"20px", padding:"4px 12px", fontSize:"12px", fontWeight:"700" }}>
              ✅ Configurado
            </span>
          ) : (
            <span style={{ background:"#fee2e2", color:"#dc2626", borderRadius:"20px", padding:"4px 12px", fontSize:"12px", fontWeight:"700" }}>
              ❌ No configurado
            </span>
          )}
        </div>

        {sriCfg?.configurado && (
          <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"8px", padding:"12px", marginBottom:"14px", fontSize:"13px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
              <div><span style={{ color:"#666" }}>Titular:</span><br/><strong>{sriCfg.titular?.split("CN=")[1] || sriCfg.titular}</strong></div>
              <div><span style={{ color:"#666" }}>Válido hasta:</span><br/><strong style={{ color: new Date(sriCfg.valido_hasta) < new Date() ? "#dc2626" : "#059669" }}>{sriCfg.valido_hasta}</strong></div>
              <div><span style={{ color:"#666" }}>Ambiente:</span><br/><strong style={{ color: sriCfg.ambiente === "produccion" ? "#005f73" : "#d97706" }}>{sriCfg.ambiente === "produccion" ? "🟢 Producción" : "🟡 Pruebas"}</strong></div>
              <div><span style={{ color:"#666" }}>Actualizado:</span><br/><strong>{sriCfg.actualizado?.slice(0,10)}</strong></div>
            </div>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <div>
            <label style={LABEL}>{sriCfg?.configurado ? "Actualizar certificado .p12" : "Subir certificado .p12"}</label>
            <input type="file" accept=".p12,.pfx"
              onChange={e => setP12File(e.target.files[0])}
              style={{ ...INPUT, padding:"6px" }} />
            <p style={{ fontSize:"10px", color:"#999", margin:"3px 0 0" }}>
              El archivo .p12 es tu firma electrónica del BCE o Security Data. Se guarda cifrado en la base de datos.
            </p>
          </div>

          <div>
            <label style={LABEL}>Contraseña del certificado</label>
            <input type="password" value={p12Password}
              onChange={e => setP12Password(e.target.value)}
              placeholder="Contraseña del .p12"
              style={INPUT} />
          </div>

          <div>
            <label style={LABEL}>Ambiente SRI</label>
            <select value={ambiente} onChange={e => setAmbiente(e.target.value)} style={INPUT}>
              <option value="produccion">🟢 Producción (cel.sri.gob.ec) — Facturas reales</option>
              <option value="pruebas">🟡 Pruebas (celcer.sri.gob.ec) — Para testing</option>
            </select>
            <p style={{ fontSize:"10px", color: ambiente === "produccion" ? "#dc2626" : "#d97706", margin:"3px 0 0", fontWeight:"600" }}>
              {ambiente === "produccion"
                ? "⚠️ Las facturas emitidas serán REALES y válidas ante el SRI"
                : "✅ Las facturas de prueba no tienen validez legal"}
            </p>
          </div>

          <button onClick={handleSRISubmit} disabled={loadingSRI || !p12File || !p12Password}
            style={{ padding:"11px", background: loadingSRI || !p12File || !p12Password ? "#94a3b8" : "#005f73",
              color:"white", border:"none", borderRadius:"8px", fontSize:"14px", fontWeight:"700",
              cursor: loadingSRI || !p12File || !p12Password ? "not-allowed" : "pointer" }}>
            {loadingSRI ? "⏳ Verificando y guardando..." : "🔏 Guardar Certificado"}
          </button>

          {/* ── Diagnóstico SRI ── */}
          {sriCfg?.configurado && (
            <button
              onClick={async () => {
                try {
                  const res = await axios.get(`${API}/sri/diagnostico`, { headers });
                  const d = res.data;
                  const lineas = [
                    `Estado: ${d.estado_general || "Verificado"}`,
                    `Ambiente: ${d.ambiente}`,
                    `RUC: ${d.ruc_config || "No configurado"}`,
                    `Titular: ${d.titular_cert?.split("CN=")[1] || d.titular_cert || ""}`,
                    `Válido hasta: ${d.valido_hasta || ""}`,
                    `Conectividad SRI: ${d.conectividad_sri ? "✅ OK" : "❌ Sin conexión"}`,
                    d.problemas?.length
                      ? `\nPROBLEMAS:\n${d.problemas.join("\n")}`
                      : "\n✅ Sin problemas detectados",
                    d.recomendaciones?.length
                      ? `\nRECOMENDACIONES:\n${d.recomendaciones.join("\n")}`
                      : "",
                  ].filter(Boolean).join("\n");
                  alert(lineas);
                } catch (e) {
                  alert("Error diagnóstico: " + (e.response?.data?.detail || e.message));
                }
              }}
              style={{ padding:"9px", background:"#F0F9FF", border:"1.5px solid #BFDBFE",
                color:"#0C4A6E", borderRadius:"8px", fontSize:"13px", fontWeight:"700", cursor:"pointer" }}>
              🔍 Ejecutar Diagnóstico SRI
            </button>
          )}
        </div>
      </div>

      {/* ── CORREO INSTITUCIONAL ── */}
      <div style={CARD}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
          <h3 style={{ margin:0, fontSize:"15px", color:"#005f73" }}>📧 Correo Institucional (Gmail)</h3>
          {emailCfg?.configurado ? (
            <span style={{ background:"#d1fae5", color:"#059669", borderRadius:"20px", padding:"4px 12px", fontSize:"12px", fontWeight:"700" }}>✅ Configurado</span>
          ) : (
            <span style={{ background:"#fee2e2", color:"#dc2626", borderRadius:"20px", padding:"4px 12px", fontSize:"12px", fontWeight:"700" }}>❌ No configurado</span>
          )}
        </div>

        {emailCfg?.configurado && (
          <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:"8px", padding:"10px", marginBottom:"14px", fontSize:"13px" }}>
            <strong>Email actual:</strong> {emailCfg.email}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <div>
            <label style={LABEL}>Correo Gmail institucional</label>
            <input value={emailForm.email} onChange={e => setEmailForm(f=>({...f,email:e.target.value}))}
              placeholder="centrodeespecialidadesfamilyhe@gmail.com" style={INPUT} />
          </div>

          <div>
            <label style={LABEL}>Contraseña de aplicación Gmail</label>
            <input type="password" value={emailForm.app_password}
              onChange={e => setEmailForm(f=>({...f,app_password:e.target.value}))}
              placeholder="xxxx xxxx xxxx xxxx (16 caracteres)" style={INPUT} />
            <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"6px", padding:"8px 10px", marginTop:"6px", fontSize:"11px", color:"#92400e" }}>
              <p style={{ margin:"0 0 4px", fontWeight:"700" }}>⚠️ NO uses la contraseña normal de Gmail</p>
              <p style={{ margin:0 }}>Debes crear una <strong>Contraseña de Aplicación</strong>:</p>
              <ol style={{ margin:"4px 0 0", paddingLeft:"16px" }}>
                <li>Gmail → Cuenta → Seguridad → Verificación en 2 pasos (activar)</li>
                <li>Seguridad → Contraseñas de aplicaciones</li>
                <li>Seleccionar app: "Correo" → Dispositivo: "Otro" → Nombrar: "FamilyHealth"</li>
                <li>Copiar los 16 caracteres generados</li>
              </ol>
            </div>
          </div>

          <div>
            <label style={LABEL}>Nombre del remitente</label>
            <input value={emailForm.nombre} onChange={e => setEmailForm(f=>({...f,nombre:e.target.value}))}
              placeholder="Family Health" style={INPUT} />
          </div>

          <button onClick={handleEmailSubmit} disabled={loadingEmail}
            style={{ padding:"11px", background: loadingEmail ? "#94a3b8" : "#00a8cc",
              color:"white", border:"none", borderRadius:"8px", fontSize:"14px", fontWeight:"700", cursor: loadingEmail ? "not-allowed" : "pointer" }}>
            {loadingEmail ? "⏳ Guardando..." : "📧 Guardar Configuración de Correo"}
          </button>
        </div>
      </div>

      {/* ── ESTADO GENERAL ── */}
      <div style={{ background:"#f8fdff", border:"1px solid #b2ebf2", borderRadius:"10px", padding:"14px 16px", fontSize:"13px" }}>
        <p style={{ margin:"0 0 8px", fontWeight:"700", color:"#005f73" }}>📋 Estado del sistema de facturación electrónica</p>
        <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
          {[
            [sriCfg?.configurado, "Certificado de firma electrónica (.p12)"],
            [emailCfg?.configurado, "Correo institucional para envío de RIDE"],
            [true, "Generación de XML formato SRI 2.1.0"],
            [true, "Firma digital RSA-SHA1 (XMLDSig)"],
            [true, "Envío al webservice SRI (SOAP)"],
            [true, "PDF RIDE con clave de acceso de 49 dígitos"],
          ].map(([ok, label], i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span style={{ fontSize:"14px" }}>{ok ? "✅" : "❌"}</span>
              <span style={{ color: ok ? "#059669" : "#dc2626" }}>{label}</span>
            </div>
          ))}
        </div>
        {sriCfg?.configurado && emailCfg?.configurado && (
          <div style={{ marginTop:"10px", background:"#d1fae5", borderRadius:"6px", padding:"8px 12px", color:"#065f46", fontWeight:"700", fontSize:"13px" }}>
            🎉 Sistema listo para emitir facturas electrónicas al SRI
          </div>
        )}
      </div>
    </div>
  );
};