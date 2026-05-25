import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import axios from "axios";
import { NuevaCitaModal } from "./NuevaCitaModal";
import { CIE10Selector } from "./CIE10Selector";
import { MedicacionRapida } from "./MedicacionRapida";
import { HistorialLateral } from "./HistorialLateral";
import { AntecedentesPanel } from "./AntecedentesPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const S = {
  seccion: {
    background: "#00a8cc", color: "white", fontWeight: "700",
    fontSize: "12px", padding: "6px 14px", borderRadius: "6px",
    marginBottom: "10px", marginTop: "16px", letterSpacing: "0.5px"
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" },
  campo: { display: "flex", flexDirection: "column", gap: "3px" },
  label: { fontSize: "12px", color: "#005f73", fontWeight: "600" },
  input: { fontSize: "13px", height: "34px", borderColor: "#b2ebf2" },
  unidad: { fontSize: "11px", color: "#999", marginTop: "2px" },
};

const FORM_INICIAL = {
  motivo_consulta: "",
  evolucion_enfermedad: "",
  ant_familiares: "",
  ant_personales: "",
  ant_otros: "",
  alergias_intolerancias: "",
  medicamentos_actuales: "",
  examen_fisico: {
    peso: "", talla: "", imc: "", porcentaje_grasa: "", porcentaje_musculo: "",
    edad_corporal: "", pliegue_suprailiaco: "", pliegue_tricipital: "",
    pliegue_bicipital: "", pliegue_subescapular: "",
    cintura: "", cadera: "", icc: "", muneca: "", circunferencia_brazo: ""
  },
  diagnostico_texto: "",
  cie10_codigo: "",
  cie10_descripcion: "",
  laboratorio: {
    fecha_lab: "", hemoglobina: "", plaquetas: "", glucosa: "", urea: "",
    creatinina: "", acido_urico: "", colesterol: "", hdl: "", ldl: "",
    trigliceridos: "", tgo: "", tgp: ""
  },
  plan_alimentario: "",
  anamnesis: "",
  notas: "",
  medicamentos: [],
};

export const NutricionForm = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [showAgendarCita, setShowAgendarCita] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Guardado manual rápido (sin cerrar el formulario)
  const handleGuardarBorrador = async () => {
    if (!form.motivo_consulta.trim()) return; // necesita al menos motivo
    try {
      const endpoint = existingHistory
        ? `${API}/medical-history/nutricion/${existingHistory.id}`
        : `${API}/medical-history/nutricion`;
      const method = existingHistory ? "put" : "post";
      const payload = {
        appointment_id: appointment.id,
        paciente_cedula: appointment.cedula || "",
        paciente_nombre: appointment.nombre_completo || "",
        ...form,
        examen_fisico: {
          ...form.examen_fisico,
          peso: parseFloat(form.examen_fisico?.peso) || null,
          talla: parseFloat(form.examen_fisico?.talla) || null,
        },
      };
      await axios[method](`${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAutoSaved(true);
      setLastSaved(new Date().toLocaleTimeString());
      setTimeout(() => setAutoSaved(false), 3000);
    } catch (e) {
      console.warn("Auto-save failed:", e.message);
    }
  };
  const [loadingData, setLoadingData] = useState(true);
  const [existingHistory, setExistingHistory] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);

  // Calcular IMC automáticamente
  useEffect(() => {
    const peso = parseFloat(form.examen_fisico.peso);
    const talla = parseFloat(form.examen_fisico.talla);
    if (peso > 0 && talla > 0) {
      const tallaMts = talla > 10 ? talla / 100 : talla;
      const imc = (peso / (tallaMts * tallaMts)).toFixed(1);
      setForm(f => ({ ...f, examen_fisico: { ...f.examen_fisico, imc } }));
    }
  }, [form.examen_fisico.peso, form.examen_fisico.talla]);

  // Calcular ICC
  useEffect(() => {
    const cintura = parseFloat(form.examen_fisico.cintura);
    const cadera = parseFloat(form.examen_fisico.cadera);
    if (cintura > 0 && cadera > 0) {
      const icc = (cintura / cadera).toFixed(2);
      setForm(f => ({ ...f, examen_fisico: { ...f.examen_fisico, icc } }));
    }
  }, [form.examen_fisico.cintura, form.examen_fisico.cadera]);

  // Cargar historia existente
  useEffect(() => {
    const cargar = async () => {
      if (!appointment?.id) { setLoadingData(false); return; }
      try {
        const res = await axios.get(
          `${API}/medical-history/nutricion/appointment/${appointment.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data) {
          setExistingHistory(res.data);
          const h = res.data;
          setForm(f => ({
            ...f, ...h,
            examen_fisico: { ...f.examen_fisico, ...(h.examen_fisico || {}) },
            laboratorio: { ...f.laboratorio, ...(h.laboratorio || {}) },
            medicamentos: h.medicamentos || [],
          }));
          toast.info("Consulta anterior cargada — puede continuar editando");
        }
      } catch (e) {
        if (e.response?.status !== 404) console.error(e);
        else toast.success("Nueva consulta — formulario listo");
      }
      setLoadingData(false);
    };
    cargar();
  }, [appointment?.id, token]);

  // ── Detectar si es primera o segunda cita ──
  const [esPrimeraCita, setEsPrimeraCita] = useState(true);
  const [medidasAnteriores, setMedidasAnteriores] = useState(null);
  const [planFile, setPlanFile] = useState(null);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [planUrl, setPlanUrl] = useState(null);
  const [modoEvolucion, setModoEvolucion] = useState(false);

  useEffect(() => {
    const checkHistorial = async () => {
      if (!appointment?.cedula) return;
      try {
        const res = await axios.get(
          `${API}/paciente/${appointment.cedula}/medidas-nutricion`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const medidas = res.data?.medidas || [];
        // Filtrar medidas que no sean de esta cita actual
        const medidasPrevias = medidas.filter(m => m.appointment_id !== appointment.id);
        if (medidasPrevias.length > 0) {
          setEsPrimeraCita(false);
          const ultima = medidasPrevias[0];
          setMedidasAnteriores(ultima);
          setModoEvolucion(true);

          // Precargar solo las medidas físicas (no los campos de historia que no vienen aquí)
          // diagnostico/plan se cargan cuando se abre la historia existente via el useEffect de appointment
          if (ultima.peso) {
            setMedidasAnteriores(ultima);
          }
        }
      } catch {}
    };
    checkHistorial();
  }, [appointment?.cedula]);

  const setEF = (campo, valor) =>
    setForm(f => ({ ...f, examen_fisico: { ...f.examen_fisico, [campo]: valor } }));
  const setLab = (campo, valor) =>
    setForm(f => ({ ...f, laboratorio: { ...f.laboratorio, [campo]: valor } }));

  const handleUploadPlan = async () => {
    if (!planFile) return;
    setUploadingPlan(true);
    try {
      const formData = new FormData();
      formData.append("file", planFile);
      formData.append("cedula", appointment.cedula || "");
      formData.append("appointment_id", appointment.id || "");
      formData.append("tipo", "plan_nutricional");
      const res = await axios.post(
        `${API}/imagenes-clinicas`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } }
      );
      setPlanUrl(res.data?.url || res.data?.id || "guardado");
      setPlanFile(null);
      toast.success("Plan nutricional subido correctamente");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al subir el archivo");
    } finally {
      setUploadingPlan(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.motivo_consulta.trim()) {
      toast.error("⚠️ Falta: Motivo de consulta");
      return;
    }
    // Diagnóstico es recomendado pero no bloquea
    if (!form.diagnostico_texto.trim() && !form.cie10_codigo) {
      toast.warning("💡 Recuerda agregar el diagnóstico nutricional antes de terminar");
      // No hace return - permite continuar sin diagnóstico
    }
    setLoading(true);

    try {
      const payload = {
        appointment_id: appointment.id,
        paciente_cedula: appointment.cedula || "",
        paciente_nombre: appointment.nombre_completo || "",
        paciente_edad: appointment.edad || null,
        paciente_sexo: appointment.sexo || "",
        doctor_id: appointment.doctor_id || "",
        doctor_nombre: appointment.doctor_nombre || "",
        fecha: new Date().toISOString().split("T")[0],
        ...form,
        examen_fisico: {
          ...form.examen_fisico,
          peso: form.examen_fisico.peso ? parseFloat(form.examen_fisico.peso) : null,
          talla: form.examen_fisico.talla ? parseFloat(form.examen_fisico.talla) : null,
          imc: form.examen_fisico.imc ? parseFloat(form.examen_fisico.imc) : null,
          porcentaje_grasa: form.examen_fisico.porcentaje_grasa ? parseFloat(form.examen_fisico.porcentaje_grasa) : null,
          porcentaje_musculo: form.examen_fisico.porcentaje_musculo ? parseFloat(form.examen_fisico.porcentaje_musculo) : null,
          cintura: form.examen_fisico.cintura ? parseFloat(form.examen_fisico.cintura) : null,
          cadera: form.examen_fisico.cadera ? parseFloat(form.examen_fisico.cadera) : null,
          icc: form.examen_fisico.icc ? parseFloat(form.examen_fisico.icc) : null,
        }
      };

      if (existingHistory) {
        await axios.put(`${API}/medical-history/nutricion/${existingHistory.id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Historia actualizada correctamente");
      } else {
        await axios.post(`${API}/medical-history/nutricion`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Historia guardada — consulta financiera creada");
      }

      // Generar receta si hay medicamentos
      const meds = form.medicamentos.filter(m => m.nombre?.trim());
      if (meds.length > 0) {
        try {
          const recetaPayload = {
            appointment_id: appointment.id,
            paciente_cedula: appointment.cedula,
            diagnostico: form.diagnostico_texto,
            cie10_codigo: form.cie10_codigo,
            medicamentos: meds,
            especialidad: "Nutrición",
          };
          await axios.post(`${API}/prescriptions`, recetaPayload,
            { headers: { Authorization: `Bearer ${token}` } });
        } catch { /* no bloquear si falla la receta */ }
      }

      // Auto-agendar próxima cita si se indicó fecha
      const proximaFecha = form.proxima_cita || form.proximo_control;
      if (proximaFecha) {
        try {
          await axios.post(`${API}/appointments`, {
            tipo_documento: appointment.tipo_documento || "cedula",
            nombre_completo: appointment.nombre_completo,
            cedula: appointment.cedula || "",
            fecha_nacimiento: appointment.fecha_nacimiento || "",
            telefono: appointment.telefono || "",
            whatsapp: appointment.whatsapp || "",
            email: appointment.email || "",
            especialidad: appointment.especialidad,
            doctor_id: appointment.doctor_id || "",
            doctor_nombre: appointment.doctor_nombre || "",
            fecha: proximaFecha,
            hora: appointment.hora || "09:00",
            tipo_pago: "efectivo",
            observaciones: "Cita de control nutricional programada automáticamente.",
          }, { headers: { Authorization: `Bearer ${token}` } });
          toast.success(`📅 Próxima cita de control agendada para ${proximaFecha}`);
        } catch {
          toast.warning("Consulta guardada. No se pudo agendar la próxima cita — agrégala manualmente.");
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.detail || err.message || "Error desconocido";
      if (status === 401 || status === 403) {
        toast.error("❌ Sesión expirada — recarga la página e inicia sesión de nuevo");
      } else if (status >= 500) {
        toast.error(`❌ Error del servidor: ${msg}. Intenta de nuevo.`);
      } else if (!err.response) {
        toast.error("❌ Sin conexión — verifica tu internet e intenta de nuevo");
      } else {
        toast.error(`❌ ${msg}`);
      }
      console.error("Error guardando historia nutrición:", err);
    }
    setLoading(false);
  };

  if (loadingData) return (
    <div style={{ textAlign: "center", padding: "40px", color: "#00a8cc" }}>
      Cargando historia clínica...
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      {/* Formulario principal */}
      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Banner segunda cita */}
        {!esPrimeraCita && (
          <div style={{ background:"#fffbeb", border:"1.5px solid #fbbf24", borderRadius:"10px", padding:"12px 16px", marginBottom:"12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <p style={{ margin:"0 0 2px", fontWeight:"800", color:"#92400e", fontSize:"14px" }}>
                  🔄 Cita subsecuente — Paciente conocido
                </p>
                <p style={{ margin:0, fontSize:"12px", color:"#92400e" }}>
                  Última consulta: {medidasAnteriores?.fecha} · Peso anterior: {medidasAnteriores?.peso} kg · IMC: {medidasAnteriores?.imc}
                </p>
              </div>
          {/* Agendar próxima cita rápido */}
          <button
            onClick={() => setShowAgendarCita(true)}
            style={{ marginTop:"6px", fontSize:"11px", color:"#0C4A6E", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"6px", padding:"4px 10px", cursor:"pointer", fontWeight:"600" }}
          >
            📅 Agendar próxima consulta
          </button>
              <div style={{ display:"flex", gap:"6px" }}>
                <button type="button" onClick={() => setModoEvolucion(true)}
                  style={{ padding:"6px 12px", background:modoEvolucion?"#d97706":"white", color:modoEvolucion?"white":"#d97706", border:"1.5px solid #d97706", borderRadius:"6px", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
                  ⚡ Solo evolución
                </button>
                <button type="button" onClick={() => setModoEvolucion(false)}
                  style={{ padding:"6px 12px", background:!modoEvolucion?"#005f73":"white", color:!modoEvolucion?"white":"#005f73", border:"1.5px solid #005f73", borderRadius:"6px", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
                  📋 Ficha completa
                </button>
              </div>
            </div>
            {/* Tabla comparativa */}
            {medidasAnteriores && (
              <div style={{ marginTop:"10px", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"6px" }}>
                {[
                  ["Peso", medidasAnteriores.peso, pesoActual, "kg"],
                  ["IMC", medidasAnteriores.imc, form.examen_fisico?.imc, ""],
                  ["% Grasa", medidasAnteriores.masa_grasa, form.examen_fisico?.porcentaje_grasa, "%"],
                  ["Cintura", medidasAnteriores.circunferencia_cintura, form.examen_fisico?.circunferencia_cintura, "cm"],
                ].map(([label, prev, curr, unit]) => {
                  const cambio = calcularCambio(curr, prev);
                  return (
                    <div key={label} style={{ background:"white", borderRadius:"8px", padding:"8px", textAlign:"center", border:"1px solid #fde68a" }}>
                      <p style={{ margin:"0 0 2px", fontSize:"10px", color:"#666" }}>{label}</p>
                      <p style={{ margin:0, fontSize:"11px", color:"#999" }}>Ant: {prev || "—"}{unit}</p>
                      <p style={{ margin:0, fontSize:"13px", fontWeight:"700", color:"#005f73" }}>{curr || "—"}{unit}</p>
                      {cambio && (
                        <p style={{ margin:"2px 0 0", fontSize:"11px", fontWeight:"700", color:cambio.subio?"#dc2626":"#059669" }}>
                          {cambio.subio ? "▲" : "▼"} {Math.abs(cambio.diff)}{unit} ({cambio.pct}%)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {/* Encabezado */}
        <div style={{
          background: "linear-gradient(135deg, #00a8cc, #005f73)",
          borderRadius: "10px", padding: "14px 18px", marginBottom: "16px",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div>
            <h2 style={{ color: "white", margin: 0, fontSize: "16px", fontWeight: "700" }}>
              🥗 Historia Clínica — Nutrición
            </h2>
            <p style={{ color: "rgba(255,255,255,0.8)", margin: "2px 0 0", fontSize: "13px" }}>
              {appointment.nombre_completo} · {appointment.cedula}
            </p>
          </div>
          {existingHistory && (
            <span style={{
              background: "rgba(255,255,255,0.2)", color: "white",
              borderRadius: "6px", padding: "4px 10px", fontSize: "12px"
            }}>
              ✏️ Editando consulta existente
            </span>
          )}
        </div>

        {/* MOTIVO DE CONSULTA */}
        <div style={S.seccion}>📝 MOTIVO DE CONSULTA</div>
        <div style={{ ...S.grid2, marginBottom: "10px" }}>
          <div style={{ ...S.campo, gridColumn: "1/-1" }}>
            <Label style={S.label}>Motivo de consulta *</Label>
            <Textarea value={form.motivo_consulta}
              onChange={e => setForm(f => ({ ...f, motivo_consulta: e.target.value }))}
              placeholder="Razón de la consulta..." rows={2}
              style={{ fontSize: "13px", borderColor: "#b2ebf2" }} />
          </div>
          <div style={{ ...S.campo, gridColumn: "1/-1" }}>
            <Label style={S.label}>Evolución de la enfermedad</Label>
            <Textarea value={form.evolucion_enfermedad}
              onChange={e => setForm(f => ({ ...f, evolucion_enfermedad: e.target.value }))}
              placeholder="Descripción de la evolución..." rows={2}
              style={{ fontSize: "13px", borderColor: "#b2ebf2" }} />
          </div>
        </div>

        {/* ANTECEDENTES — panel inteligente */}
        <div style={S.seccion}>📂 ANTECEDENTES DEL PACIENTE</div>
        <div style={{ marginBottom: "10px" }}>
          <AntecedentesPanel
            cedula={appointment.cedula}
            token={token}
            especialidad="Nutrición"
            onLoad={ant => setForm(f => ({
              ...f,
              ant_familiares: ant.ant_familiares || f.ant_familiares,
              ant_personales: ant.ant_personales || f.ant_personales,
              alergias_intolerancias: ant.alergias_medicamentos || ant.alergias || f.alergias_intolerancias,
              medicamentos_actuales: ant.medicamentos_actuales || f.medicamentos_actuales,
            }))}
            onChange={ant => setForm(f => ({
              ...f,
              alergias_intolerancias: ant.alergias_medicamentos || ant.alergias || f.alergias_intolerancias,
              medicamentos_actuales: ant.medicamentos_actuales || f.medicamentos_actuales,
            }))}
          />
        </div>
        {/* Antecedentes específicos nutrición */}
        <div style={{ ...S.grid3, marginBottom: "10px" }}>
          {[["ant_familiares","Familiares"],["ant_personales","Personales"],["ant_otros","Otros (cirugías, gestas, partos, abortos)"]].map(([k,l]) => (
            <div key={k} style={S.campo}>
              <Label style={S.label}>{l}</Label>
              <Textarea value={form[k]}
                onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                rows={2} style={{ fontSize: "12px", borderColor: "#b2ebf2" }} />
            </div>
          ))}
        </div>

        {/* EXAMEN FÍSICO */}
        <div style={S.seccion}>⚖️ EXAMEN FÍSICO</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", marginBottom: "10px" }}>
          {[
            ["peso","Peso","kg"], ["talla","Talla","cm"],
            ["imc","IMC","auto"], ["porcentaje_grasa","% Grasa","%"],
            ["porcentaje_musculo","% Músculo","%"],
            ["edad_corporal","Edad Corporal","años"],
            ["pliegue_suprailiaco","P. Suprailiaco","mm"],
            ["pliegue_tricipital","P. Tricipital","mm"],
            ["pliegue_bicipital","P. Bicipital","mm"],
            ["pliegue_subescapular","P. Subescapular","mm"],
            ["cintura","Cintura","cm"], ["cadera","Cadera","cm"],
            ["icc","ICC","auto"], ["muneca","Muñeca","cm"],
            ["circunferencia_brazo","C. Brazo","cm"],
          ].map(([k, l, u]) => (
            <div key={k} style={S.campo}>
              <Label style={{ ...S.label, fontSize: "11px" }}>{l}</Label>
              <Input
                type="number" step="0.01"
                value={form.examen_fisico[k]}
                onChange={e => setEF(k, e.target.value)}
                readOnly={u === "auto"}
                style={{
                  ...S.input,
                  background: u === "auto" ? "#f0fbff" : "white",
                  borderColor: u === "auto" ? "#00a8cc" : "#b2ebf2",
                  fontWeight: u === "auto" ? "700" : "normal",
                  color: u === "auto" ? "#005f73" : "inherit",
                }}
              />
              {u !== "auto" && <span style={S.unidad}>{u}</span>}
            </div>
          ))}
        </div>

        {/* Clasificación IMC */}
        {form.examen_fisico.imc && (
          <div style={{
            background: parseFloat(form.examen_fisico.imc) < 18.5 ? "#fef9c3" :
                        parseFloat(form.examen_fisico.imc) < 25 ? "#dcfce7" :
                        parseFloat(form.examen_fisico.imc) < 30 ? "#fee2e2" : "#fca5a5",
            borderRadius: "8px", padding: "8px 14px", marginBottom: "10px",
            display: "flex", alignItems: "center", gap: "10px"
          }}>
            <span style={{ fontSize: "20px" }}>
              {parseFloat(form.examen_fisico.imc) < 18.5 ? "⚠️" :
               parseFloat(form.examen_fisico.imc) < 25 ? "✅" :
               parseFloat(form.examen_fisico.imc) < 30 ? "⚠️" : "🔴"}
            </span>
            <span style={{ fontWeight: "700", fontSize: "13px" }}>
              IMC {form.examen_fisico.imc} —{" "}
              {parseFloat(form.examen_fisico.imc) < 18.5 ? "Bajo peso" :
               parseFloat(form.examen_fisico.imc) < 25 ? "Normal" :
               parseFloat(form.examen_fisico.imc) < 30 ? "Sobrepeso" : "Obesidad"}
            </span>
          </div>
        )}

        {/* LABORATORIO — Opcional */}
        <div style={{
          border: "1.5px solid #a7f3d0", borderRadius: "8px",
          overflow: "hidden", marginBottom: "10px"
        }}>
          <button type="button"
            onClick={() => setForm(f => ({ ...f, _showLab: !f._showLab }))}
            style={{
              width: "100%", background: form._showLab ? "#10b981" : "#f0fdf4",
              color: form._showLab ? "white" : "#065f46",
              border: "none", padding: "8px 14px", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontWeight: "700", fontSize: "12px"
            }}>
            <span>🔬 LABORATORIO (opcional — solo si el paciente trae exámenes)</span>
            <span>{form._showLab ? "▲ Ocultar" : "▼ Agregar laboratorio"}</span>
          </button>
          {form._showLab && (
            <div style={{ padding: "12px" }}>
              <div style={{ marginBottom: "6px" }}>
                <Label style={S.label}>Fecha del laboratorio</Label>
                <Input type="date" value={form.laboratorio.fecha_lab}
                  onChange={e => setLab("fecha_lab", e.target.value)}
                  style={{ ...S.input, maxWidth: "180px" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                {[
                  ["hemoglobina","Hemoglobina","g/dL"],["plaquetas","Plaquetas","x10³"],
                  ["glucosa","Glucosa","mg/dL"],["urea","Urea","mg/dL"],
                  ["creatinina","Creatinina","mg/dL"],["acido_urico","Ácido Úrico","mg/dL"],
                  ["colesterol","Colesterol","mg/dL"],["hdl","HDL","mg/dL"],
                  ["ldl","LDL","mg/dL"],["trigliceridos","Triglicéridos","mg/dL"],
                  ["tgo","TGO","U/L"],["tgp","TGP","U/L"],
                ].map(([k,l,u]) => (
                  <div key={k} style={S.campo}>
                    <Label style={{ ...S.label, fontSize: "11px" }}>{l}</Label>
                    <Input type="number" step="0.01" value={form.laboratorio[k]}
                      onChange={e => setLab(k, e.target.value)}
                      style={{ ...S.input, fontSize: "12px" }} />
                    <span style={S.unidad}>{u}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ANTROPOMETRÍA ADICIONAL — Opcional */}
        <div style={{
          border: "1.5px solid #bfdbfe", borderRadius: "8px",
          overflow: "hidden", marginBottom: "10px"
        }}>
          <button type="button"
            onClick={() => setForm(f => ({ ...f, _showAntroExtra: !f._showAntroExtra }))}
            style={{
              width: "100%", background: form._showAntroExtra ? "#3b82f6" : "#eff6ff",
              color: form._showAntroExtra ? "white" : "#1e40af",
              border: "none", padding: "8px 14px", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontWeight: "700", fontSize: "12px"
            }}>
            <span>📐 ANTROPOMETRÍA ADICIONAL (circunferencias, alturas especiales)</span>
            <span>{form._showAntroExtra ? "▲ Ocultar" : "▼ Agregar medidas adicionales"}</span>
          </button>
          {form._showAntroExtra && (
            <div style={{ padding: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                {[
                  ["circ_cuello","Circ. Cuello","cm"],
                  ["circ_pantorrilla","Circ. Pantorrilla","cm"],
                  ["circ_muslo","Circ. Muslo","cm"],
                  ["altura_rodilla","Altura de Rodilla","cm"],
                  ["brazada","Brazada","cm"],
                  ["pliegue_abdominal","Pliegue Abdominal","mm"],
                ].map(([k,l,u]) => (
                  <div key={k} style={S.campo}>
                    <Label style={{ ...S.label, fontSize: "11px" }}>{l}</Label>
                    <Input type="number" step="0.01"
                      value={form.antro_extra?.[k] || ""}
                      onChange={e => setForm(f => ({
                        ...f,
                        antro_extra: { ...(f.antro_extra || {}), [k]: e.target.value }
                      }))}
                      style={{ ...S.input, fontSize: "12px" }} />
                    <span style={S.unidad}>{u}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DIAGNÓSTICO */}
        <div style={S.seccion}>🩺 DIAGNÓSTICO</div>
        <div style={{ marginBottom: "10px" }}>
          <CIE10Selector
            token={token}
            value={{ codigo: form.cie10_codigo, descripcion: form.cie10_descripcion }}
            onChange={({ codigo, descripcion }) => setForm(f => ({ ...f, cie10_codigo: codigo, cie10_descripcion: descripcion }))}
            label="Diagnóstico CIE-10"
          />
          <div style={{ marginTop: "8px" }}>
            <Label style={S.label}>Diagnóstico complementario / observaciones *</Label>
            <Textarea value={form.diagnostico_texto}
              onChange={e => setForm(f => ({ ...f, diagnostico_texto: e.target.value }))}
              placeholder="Detalle del diagnóstico nutricional..." rows={2}
              style={{ fontSize: "13px", borderColor: "#b2ebf2" }} />
          </div>
        </div>

        {/* PLAN ALIMENTARIO */}
        <div style={S.seccion}>🥦 PLAN ALIMENTARIO</div>
        <div style={{ marginBottom: "10px" }}>
          <Textarea value={form.plan_alimentario}
            onChange={e => setForm(f => ({ ...f, plan_alimentario: e.target.value }))}
            placeholder="Plan de alimentación detallado, distribución de macronutrientes, porciones..." rows={4}
            style={{ fontSize: "13px", borderColor: "#b2ebf2" }} />
        </div>

        {/* ANAMNESIS Y NOTAS */}
        <div style={S.seccion}>📝 ANAMNESIS / NOTAS</div>
        <div style={{ ...S.grid2, marginBottom: "10px" }}>
          <div style={S.campo}>
            <Label style={S.label}>Anamnesis alimentaria</Label>
            <Textarea value={form.anamnesis}
              onChange={e => setForm(f => ({ ...f, anamnesis: e.target.value }))}
              rows={3} style={{ fontSize: "13px", borderColor: "#b2ebf2" }} />
          </div>
          <div style={S.campo}>
            <Label style={S.label}>Notas adicionales</Label>
            <Textarea value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              rows={3} style={{ fontSize: "13px", borderColor: "#b2ebf2" }} />
          </div>
        </div>

        {/* RECETA */}
        <div style={{ marginBottom: "16px" }}>
          <MedicacionRapida
            especialidad="Nutrición"
            medicamentos={form.medicamentos}
            onChange={meds => setForm(f => ({ ...f, medicamentos: meds }))}
          />
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingBottom: "20px", flexWrap: "wrap" }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button"
            style={{ background: autoSaved ? "#059669" : "#6366f1", color: "white" }}
            disabled={loading || !form.motivo_consulta?.trim()}
            onClick={handleGuardarBorrador}>
            {autoSaved ? `✅ Guardado ${lastSaved}` : "💾 Guardar borrador"}
          </Button>
          {existingHistory && (
            <Button type="button" disabled={loading}
              style={{ background: "#059669", color: "white" }}
              onClick={async () => {
                const email = appointment.email || prompt("Ingresa el email del paciente:");
                if (!email) return;
                try {
                  const res = await axios.post(
                    `${API}/nutricion/enviar-plan/${appointment.id}`,
                    { email },
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  alert(res.data.mensaje || "Plan enviado correctamente");
                } catch (e) {
                  alert("Error: " + (e.response?.data?.detail || e.message));
                }
              }}>
              {appointment.email ? `📧 Enviar plan a ${appointment.email}` : "📧 Enviar plan nutricional"}
            </Button>
          )}
          

          {/* ── Subir Plan Nutricional (PDF/DOCX) ───────────────────────── */}
          <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:"10px", padding:"14px", marginBottom:"12px" }}>
            <p style={{ margin:"0 0 10px", fontSize:"13px", fontWeight:"700", color:"#166534" }}>📎 Plan Nutricional (PDF / DOCX)</p>
            <div style={{ display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap" }}>
              <input type="file" accept=".pdf,.doc,.docx"
                onChange={e => setPlanFile(e.target.files[0] || null)}
                style={{ fontSize:"12px", flex:1, minWidth:"180px" }} />
              {planFile && (
                <button onClick={handleUploadPlan} disabled={uploadingPlan}
                  style={{ padding:"6px 14px", background: uploadingPlan ? "#86EFAC":"#16A34A", color:"white", border:"none", borderRadius:"6px", fontSize:"12px", fontWeight:"700", cursor: uploadingPlan?"not-allowed":"pointer" }}>
                  {uploadingPlan ? "Subiendo..." : "Subir"}
                </button>
              )}
              {planUrl && <span style={{ fontSize:"11px", color:"#166534", fontWeight:"600" }}>✓ Subido</span>}
            </div>
            <p style={{ margin:"6px 0 0", fontSize:"10px", color:"#4B7A5A" }}>Asociado a esta consulta en Imágenes/Docs.</p>
          </div>
<Button type="submit" disabled={loading} style={{ background: "#00a8cc", color: "white" }}>
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

      {/* Historial lateral */}
      <HistorialLateral
        cedula={appointment.cedula}
        token={token}
        especialidadActual="Nutrición"
      />
    </div>

  );
};
