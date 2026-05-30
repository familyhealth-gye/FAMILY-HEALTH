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
import { AntecedentesPanel } from "./AntecedentesPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const S = {
  seccion: {
    background: "#9333ea", color: "white", fontWeight: "700",
    fontSize: "12px", padding: "6px 14px", borderRadius: "6px",
    marginBottom: "10px", marginTop: "16px"
  },
  seccionEmbarazo: {
    background: "linear-gradient(135deg, #f97316, #ec4899)", color: "white",
    fontWeight: "700", fontSize: "12px", padding: "8px 14px", borderRadius: "6px",
    marginBottom: "10px", marginTop: "16px"
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" },
  campo: { display: "flex", flexDirection: "column", gap: "3px" },
  label: { fontSize: "12px", color: "#6b21a8", fontWeight: "600" },
  labelEmb: { fontSize: "12px", color: "#c2410c", fontWeight: "600" },
  input: { fontSize: "13px", height: "34px", borderColor: "#e9d5ff" },
  inputEmb: { fontSize: "13px", height: "34px", borderColor: "#fed7aa" },
};

const FORM_INICIAL = {
  motivo_consulta: "",
  enfermedad_actual: "",
  ant_familiares_hta: false,
  ant_familiares_diabetes: false,
  ant_familiares_cancer: false,
  ant_familiares_otros: "",
  ant_personales_quirurgicos: "",
  ant_personales_alergias: "",
  ant_personales_otros: "",
  medicamentos_actuales: "",
  datos_ginecologicos: {
    menarquia: "", ritmo_menstrual: "", inicio_actividad_sexual: "",
    menopausia: "", partos: "", abortos: "", cesareas: "", gestas: "",
    metodo_anticonceptivo: "", vida_sexual_activa: null,
    ultimo_papanicolaou: "", resultado_papanicolaou: "",
    ultima_mamografia: "", resultado_mamografia: ""
  },
  datos_embarazo: {
    esta_embarazada: false,
    fur: "", fpp: "", semanas_gestacion: "", trimestre: "",
    numero_embarazo: "", embarazo_planificado: null,
    presion_arterial: "", peso_actual: "", altura_uterina: "",
    frecuencia_cardiaca_fetal: "", presentacion_fetal: "",
    movimientos_fetales: "", edemas: "",
    grupo_sanguineo: "", factor_rh: "", vdrl: "", vih_prenatal: "",
    toxoplasma: "", rubeola: "", glucosa_prenatal: "", hemoglobina_prenatal: "",
    eco_primer_trimestre: "", eco_segundo_trimestre: "", eco_tercer_trimestre: "",
    eco_morfologica: "", vacuna_tetano: null, vacuna_influenza: null,
    notas_primer_trimestre: "", notas_segundo_trimestre: "", notas_tercer_trimestre: ""
  },
  peso: "", talla: "", imc: "", presion_arterial: "",
  frecuencia_cardiaca: "", temperatura: "",
  examen_fisico_general: "", examen_ginecologico: "",
  diagnostico_texto: "", cie10_codigo: "", cie10_descripcion: "",
  tratamiento: "", receta: "", medicamentos: [],
  indicaciones: "", proximo_control: "", notas: ""
};

export const GinecologiaForm = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [existingHistory, setExistingHistory] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const embarazada = form.datos_embarazo.esta_embarazada;

  // Calcular IMC
  useEffect(() => {
    const peso = parseFloat(form.peso);
    const talla = parseFloat(form.talla);
    if (peso > 0 && talla > 0) {
      const tm = talla > 10 ? talla / 100 : talla;
      setForm(f => ({ ...f, imc: (peso / (tm * tm)).toFixed(1) }));
    }
  }, [form.peso, form.talla]);

  // Calcular trimestre desde semanas
  useEffect(() => {
    const sem = parseInt(form.datos_embarazo.semanas_gestacion);
    if (sem > 0) {
      const tri = sem <= 13 ? 1 : sem <= 26 ? 2 : 3;
      setDE("trimestre", tri.toString());
    }
  }, [form.datos_embarazo.semanas_gestacion]);

  // Cargar historia existente
  useEffect(() => {
    const cargar = async () => {
      if (!appointment?.id) { setLoadingData(false); return; }
      try {
        const res = await axios.get(
          `${API}/medical-history/ginecologia/appointment/${appointment.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data) {
          setExistingHistory(res.data);
          const h = res.data;
          setForm(f => ({
            ...f, ...h,
            datos_ginecologicos: { ...f.datos_ginecologicos, ...(h.datos_ginecologicos || {}) },
            datos_embarazo: { ...f.datos_embarazo, ...(h.datos_embarazo || {}) },
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

  const setDG = (campo, valor) =>
    setForm(f => ({ ...f, datos_ginecologicos: { ...f.datos_ginecologicos, [campo]: valor } }));
  const setDE = (campo, valor) =>
    setForm(f => ({ ...f, datos_embarazo: { ...f.datos_embarazo, [campo]: valor } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.motivo_consulta.trim()) { toast.error("El motivo de consulta es obligatorio"); return; }
    if (!form.diagnostico_texto.trim() && !form.cie10_codigo) { toast.error("El diagnóstico es obligatorio"); return; }
    setLoading(true);

    try {
      const payload = {
        appointment_id: appointment.id,
        paciente_cedula: appointment.cedula || "",
        paciente_nombre: appointment.nombre_completo || "",
        paciente_edad: appointment.edad || null,
        doctor_id: appointment.doctor_id || "",
        doctor_nombre: appointment.doctor_nombre || "",
        fecha: new Date().toISOString().split("T")[0],
        ...form,
        peso: form.peso ? parseFloat(form.peso) : null,
        talla: form.talla ? parseFloat(form.talla) : null,
        imc: form.imc ? parseFloat(form.imc) : null,
        frecuencia_cardiaca: form.frecuencia_cardiaca ? parseInt(form.frecuencia_cardiaca) : null,
        temperatura: form.temperatura ? parseFloat(form.temperatura) : null,
        datos_embarazo: {
          ...form.datos_embarazo,
          semanas_gestacion: form.datos_embarazo.semanas_gestacion ? parseInt(form.datos_embarazo.semanas_gestacion) : null,
          trimestre: form.datos_embarazo.trimestre ? parseInt(form.datos_embarazo.trimestre) : null,
          numero_embarazo: form.datos_embarazo.numero_embarazo ? parseInt(form.datos_embarazo.numero_embarazo) : null,
          peso_actual: form.datos_embarazo.peso_actual ? parseFloat(form.datos_embarazo.peso_actual) : null,
          altura_uterina: form.datos_embarazo.altura_uterina ? parseFloat(form.datos_embarazo.altura_uterina) : null,
          frecuencia_cardiaca_fetal: form.datos_embarazo.frecuencia_cardiaca_fetal ? parseInt(form.datos_embarazo.frecuencia_cardiaca_fetal) : null,
          glucosa_prenatal: form.datos_embarazo.glucosa_prenatal ? parseFloat(form.datos_embarazo.glucosa_prenatal) : null,
          hemoglobina_prenatal: form.datos_embarazo.hemoglobina_prenatal ? parseFloat(form.datos_embarazo.hemoglobina_prenatal) : null,
        },
        datos_ginecologicos: {
          ...form.datos_ginecologicos,
          partos: form.datos_ginecologicos.partos ? parseInt(form.datos_ginecologicos.partos) : null,
          abortos: form.datos_ginecologicos.abortos ? parseInt(form.datos_ginecologicos.abortos) : null,
          cesareas: form.datos_ginecologicos.cesareas ? parseInt(form.datos_ginecologicos.cesareas) : null,
          gestas: form.datos_ginecologicos.gestas ? parseInt(form.datos_ginecologicos.gestas) : null,
        }
      };

      if (existingHistory) {
        await axios.put(`${API}/medical-history/ginecologia/${existingHistory.id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Historia actualizada correctamente");
      } else {
        await axios.post(`${API}/medical-history/ginecologia`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Historia guardada — consulta financiera creada");
      }

      const meds = form.medicamentos.filter(m => m.nombre?.trim());
      if (meds.length > 0) {
        try {
          await axios.post(`${API}/prescriptions`, {
            appointment_id: appointment.id,
            paciente_cedula: appointment.cedula,
            diagnostico: form.diagnostico_texto,
            cie10_codigo: form.cie10_codigo,
            medicamentos: meds,
            especialidad: "Ginecología",
          }, { headers: { Authorization: `Bearer ${token}` } });
        } catch { }
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar la historia clínica");
    }
    setLoading(false);
  };

  if (loadingData) return (
    <div style={{ textAlign: "center", padding: "40px", color: "#9333ea" }}>
      Cargando historia clínica...
    </div>
  );

  const TRIM_COLORS = { 1: "#fef9c3", 2: "#dcfce7", 3: "#fce7f3" };
  const TRIM_LABELS = { 1: "1er Trimestre (1-13 sem)", 2: "2do Trimestre (14-26 sem)", 3: "3er Trimestre (27+ sem)" };

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

        {/* Encabezado */}
        <div style={{
          background: "linear-gradient(135deg, #9333ea, #6b21a8)",
          borderRadius: "10px", padding: "14px 18px", marginBottom: "16px",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div>
            <h2 style={{ color: "white", margin: 0, fontSize: "16px", fontWeight: "700" }}>
              🩺 Historia Clínica — Ginecología / Obstetricia
            </h2>
            <p style={{ color: "rgba(255,255,255,0.8)", margin: "2px 0 0", fontSize: "13px" }}>
              {appointment.nombre_completo} · {appointment.cedula}
            </p>
          </div>
          {embarazada && form.datos_embarazo.semanas_gestacion && (
            <div style={{
              background: "rgba(255,255,255,0.2)", color: "white",
              borderRadius: "8px", padding: "6px 12px", textAlign: "center"
            }}>
              <div style={{ fontSize: "11px" }}>Embarazo</div>
              <div style={{ fontSize: "18px", fontWeight: "700" }}>
                {form.datos_embarazo.semanas_gestacion} sem
              </div>
              <div style={{ fontSize: "11px" }}>
                {TRIM_LABELS[parseInt(form.datos_embarazo.trimestre)] || ""}
              </div>
            </div>
          )}
        </div>

        {/* MOTIVO */}
        <div style={S.seccion}>📝 MOTIVO DE CONSULTA</div>
        <div style={{ ...S.grid2, marginBottom: "10px" }}>
          <div style={{ ...S.campo, gridColumn: "1/-1" }}>
            <Label style={S.label}>Motivo de consulta *</Label>
            <Textarea value={form.motivo_consulta}
              onChange={e => setForm(f => ({ ...f, motivo_consulta: e.target.value }))}
              rows={2} style={{ fontSize: "13px", borderColor: "#e9d5ff" }} />
          </div>
          <div style={{ ...S.campo, gridColumn: "1/-1" }}>
            <Label style={S.label}>Enfermedad actual</Label>
            <Textarea value={form.enfermedad_actual}
              onChange={e => setForm(f => ({ ...f, enfermedad_actual: e.target.value }))}
              rows={2} style={{ fontSize: "13px", borderColor: "#e9d5ff" }} />
          </div>
        </div>

        {/* ANTECEDENTES — panel inteligente */}
        <div style={S.seccion}>📂 ANTECEDENTES DEL PACIENTE</div>
        <div style={{ marginBottom: "10px" }}>
          <AntecedentesPanel
            cedula={appointment.cedula}
            token={token}
            especialidad="Ginecología"
            readOnly={true}
            onLoad={ant => setForm(f => ({
              ...f,
              ant_familiares_hta: ant.hipertension || f.ant_familiares_hta,
              ant_familiares_diabetes: ant.diabetes || f.ant_familiares_diabetes,
              ant_familiares_otros: ant.ant_familiares || f.ant_familiares_otros,
              ant_personales_quirurgicos: ant.ant_quirurgicos || f.ant_personales_quirurgicos,
              ant_personales_alergias: ant.alergias_medicamentos || f.ant_personales_alergias,
              medicamentos_actuales: ant.medicamentos_actuales || f.medicamentos_actuales,
            }))}
            onChange={ant => setForm(f => ({
              ...f,
              ant_personales_alergias: ant.alergias_medicamentos || f.ant_personales_alergias,
              medicamentos_actuales: ant.medicamentos_actuales || f.medicamentos_actuales,
            }))}
          />
        </div>
        {/* Antecedentes ginecológicos específicos */}
        <div style={{ background: "#faf5ff", borderRadius: "8px", padding: "10px", marginBottom: "10px" }}>
          <p style={{ fontSize: "12px", fontWeight: "600", color: "#6b21a8", marginBottom: "8px" }}>Antecedentes familiares:</p>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "8px" }}>
            {[["ant_familiares_hta","HTA"],["ant_familiares_diabetes","Diabetes"],["ant_familiares_cancer","Cáncer"]].map(([k,l]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                <Checkbox checked={form[k]} onCheckedChange={v => setForm(f => ({ ...f, [k]: v }))} />
                {l}
              </label>
            ))}
          </div>
          <Input value={form.ant_familiares_otros}
            onChange={e => setForm(f => ({ ...f, ant_familiares_otros: e.target.value }))}
            placeholder="Otros antecedentes familiares..." style={{ ...S.input, marginBottom: "8px" }} />
          <div style={S.grid3}>
            <div style={S.campo}>
              <Label style={S.label}>Quirúrgicos</Label>
              <Input value={form.ant_personales_quirurgicos}
                onChange={e => setForm(f => ({ ...f, ant_personales_quirurgicos: e.target.value }))}
                style={S.input} />
            </div>
            <div style={S.campo}>
              <Label style={S.label}>Alergias</Label>
              <Input value={form.ant_personales_alergias}
                onChange={e => setForm(f => ({ ...f, ant_personales_alergias: e.target.value }))}
                style={S.input} />
            </div>
            <div style={S.campo}>
              <Label style={S.label}>Medicamentos actuales</Label>
              <Input value={form.medicamentos_actuales}
                onChange={e => setForm(f => ({ ...f, medicamentos_actuales: e.target.value }))}
                style={S.input} />
            </div>
          </div>
        </div>

        {/* DATOS GINECOLÓGICOS */}
        <div style={S.seccion}>👩 DATOS GINECOLÓGICOS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "10px" }}>
          {[
            ["menarquia","Menarquia"],["ritmo_menstrual","Ritmo menstrual"],
            ["inicio_actividad_sexual","Inicio act. sexual"],["menopausia","Menopausia"],
            ["gestas","Gestas"],["partos","Partos"],["cesareas","Cesáreas"],["abortos","Abortos"],
          ].map(([k,l]) => (
            <div key={k} style={S.campo}>
              <Label style={{ ...S.label, fontSize: "11px" }}>{l}</Label>
              <Input value={form.datos_ginecologicos[k]}
                onChange={e => setDG(k, e.target.value)}
                style={{ ...S.input, fontSize: "12px" }} />
            </div>
          ))}
          <div style={{ ...S.campo, gridColumn: "1/3" }}>
            <Label style={S.label}>Método anticonceptivo</Label>
            <Input value={form.datos_ginecologicos.metodo_anticonceptivo}
              onChange={e => setDG("metodo_anticonceptivo", e.target.value)}
              style={S.input} />
          </div>
          <div style={{ ...S.campo, gridColumn: "3/5" }}>
            <Label style={S.label}>Último Papanicolaou</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              <Input type="date" value={form.datos_ginecologicos.ultimo_papanicolaou}
                onChange={e => setDG("ultimo_papanicolaou", e.target.value)}
                style={S.input} />
              <Input value={form.datos_ginecologicos.resultado_papanicolaou}
                onChange={e => setDG("resultado_papanicolaou", e.target.value)}
                placeholder="Resultado" style={S.input} />
            </div>
          </div>
        </div>

        {/* TOGGLE EMBARAZO */}
        <div style={{
          background: embarazada ? "#fff7ed" : "#f9fafb",
          border: `2px solid ${embarazada ? "#f97316" : "#e5e7eb"}`,
          borderRadius: "10px", padding: "12px 16px", marginBottom: "10px",
          transition: "all 0.3s"
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <Checkbox
              checked={embarazada}
              onCheckedChange={v => setDE("esta_embarazada", v)}
              style={{ width: "20px", height: "20px" }}
            />
            <span style={{
              fontSize: "14px", fontWeight: "700",
              color: embarazada ? "#c2410c" : "#6b7280"
            }}>
              🤱 Paciente embarazada
            </span>
            {embarazada && form.datos_embarazo.trimestre && (
              <span style={{
                background: TRIM_COLORS[parseInt(form.datos_embarazo.trimestre)],
                color: "#333", borderRadius: "12px", padding: "2px 10px", fontSize: "12px"
              }}>
                {TRIM_LABELS[parseInt(form.datos_embarazo.trimestre)]}
              </span>
            )}
          </label>
        </div>

        {/* SECCIÓN EMBARAZO — solo si está embarazada */}
        {embarazada && (
          <div style={{
            border: "2px solid #f97316", borderRadius: "10px",
            padding: "16px", marginBottom: "10px",
            background: "linear-gradient(180deg, #fff7ed 0%, white 100%)"
          }}>
            <div style={S.seccionEmbarazo}>🤱 DATOS DEL EMBARAZO</div>

            {/* Datos básicos */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
              {[
                ["fur","FUR (Última Regla)","date"],["fpp","FPP (Parto Probable)","date"],
                ["semanas_gestacion","Semanas de gestación","number"],["numero_embarazo","N° Embarazo","number"],
              ].map(([k,l,t]) => (
                <div key={k} style={S.campo}>
                  <Label style={S.labelEmb}>{l}</Label>
                  <Input type={t} value={form.datos_embarazo[k]}
                    onChange={e => setDE(k, e.target.value)}
                    style={{ ...S.inputEmb, fontSize: "12px" }} />
                </div>
              ))}
            </div>

            {/* Control prenatal */}
            <p style={{ fontSize: "12px", fontWeight: "700", color: "#c2410c", marginBottom: "6px" }}>
              Control Prenatal:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
              {[
                ["presion_arterial","Presión Arterial","text"],
                ["peso_actual","Peso actual (kg)","number"],
                ["altura_uterina","Altura uterina (cm)","number"],
                ["frecuencia_cardiaca_fetal","FCF (lpm)","number"],
              ].map(([k,l,t]) => (
                <div key={k} style={S.campo}>
                  <Label style={{ ...S.labelEmb, fontSize: "11px" }}>{l}</Label>
                  <Input type={t} value={form.datos_embarazo[k]}
                    onChange={e => setDE(k, e.target.value)}
                    style={{ ...S.inputEmb, fontSize: "12px" }} />
                </div>
              ))}
              <div style={S.campo}>
                <Label style={{ ...S.labelEmb, fontSize: "11px" }}>Presentación fetal</Label>
                <Select value={form.datos_embarazo.presentacion_fetal}
                  onValueChange={v => setDE("presentacion_fetal", v)}>
                  <SelectTrigger style={{ ...S.inputEmb, fontSize: "12px" }}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Cefálica","Podálica","Transversa","No definida"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div style={S.campo}>
                <Label style={{ ...S.labelEmb, fontSize: "11px" }}>Movimientos fetales</Label>
                <Select value={form.datos_embarazo.movimientos_fetales}
                  onValueChange={v => setDE("movimientos_fetales", v)}>
                  <SelectTrigger style={{ ...S.inputEmb, fontSize: "12px" }}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Presentes","Disminuidos","Ausentes"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div style={S.campo}>
                <Label style={{ ...S.labelEmb, fontSize: "11px" }}>Edemas</Label>
                <Select value={form.datos_embarazo.edemas}
                  onValueChange={v => setDE("edemas", v)}>
                  <SelectTrigger style={{ ...S.inputEmb, fontSize: "12px" }}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {["No","Leve","Moderado","Severo"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div style={S.campo}>
                <Label style={{ ...S.labelEmb, fontSize: "11px" }}>Grupo / Factor Rh</Label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                  <Input value={form.datos_embarazo.grupo_sanguineo}
                    onChange={e => setDE("grupo_sanguineo", e.target.value)}
                    placeholder="A/B/O/AB" style={{ ...S.inputEmb, fontSize: "11px" }} />
                  <Select value={form.datos_embarazo.factor_rh}
                    onValueChange={v => setDE("factor_rh", v)}>
                    <SelectTrigger style={{ ...S.inputEmb, fontSize: "11px" }}>
                      <SelectValue placeholder="Rh" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+">Positivo (+)</SelectItem>
                      <SelectItem value="-">Negativo (-)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Laboratorio prenatal */}
            <p style={{ fontSize: "12px", fontWeight: "700", color: "#c2410c", marginBottom: "6px" }}>
              Laboratorio Prenatal:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "12px" }}>
              {[
                ["vdrl","VDRL"],["vih_prenatal","VIH Prenatal"],
                ["toxoplasma","Toxoplasma"],["rubeola","Rubéola"],
                ["glucosa_prenatal","Glucosa (mg/dL)"],["hemoglobina_prenatal","Hemoglobina (g/dL)"],
              ].map(([k,l]) => (
                <div key={k} style={S.campo}>
                  <Label style={{ ...S.labelEmb, fontSize: "11px" }}>{l}</Label>
                  <Input value={form.datos_embarazo[k]}
                    onChange={e => setDE(k, e.target.value)}
                    style={{ ...S.inputEmb, fontSize: "12px" }} />
                </div>
              ))}
            </div>

            {/* Ecografías */}
            <p style={{ fontSize: "12px", fontWeight: "700", color: "#c2410c", marginBottom: "6px" }}>
              Ecografías:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "12px" }}>
              {[
                ["eco_primer_trimestre","Eco 1er Trimestre"],
                ["eco_segundo_trimestre","Eco 2do Trimestre"],
                ["eco_tercer_trimestre","Eco 3er Trimestre"],
                ["eco_morfologica","Eco Morfológica"],
              ].map(([k,l]) => (
                <div key={k} style={S.campo}>
                  <Label style={{ ...S.labelEmb, fontSize: "11px" }}>{l}</Label>
                  <Input value={form.datos_embarazo[k]}
                    onChange={e => setDE(k, e.target.value)}
                    placeholder="Resultado / fecha"
                    style={{ ...S.inputEmb, fontSize: "12px" }} />
                </div>
              ))}
            </div>

            {/* Vacunas embarazo */}
            <p style={{ fontSize: "12px", fontWeight: "700", color: "#c2410c", marginBottom: "6px" }}>
              Vacunas:
            </p>
            <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
              {[["vacuna_tetano","Tétano"],["vacuna_influenza","Influenza"]].map(([k,l]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                  <Checkbox checked={!!form.datos_embarazo[k]}
                    onCheckedChange={v => setDE(k, v)} />
                  {l}
                </label>
              ))}
            </div>

            {/* Notas por trimestre */}
            <p style={{ fontSize: "12px", fontWeight: "700", color: "#c2410c", marginBottom: "6px" }}>
              Notas por trimestre:
            </p>
            <div style={S.grid3}>
              {[
                ["notas_primer_trimestre","1er Trimestre"],
                ["notas_segundo_trimestre","2do Trimestre"],
                ["notas_tercer_trimestre","3er Trimestre"],
              ].map(([k,l]) => (
                <div key={k} style={S.campo}>
                  <Label style={{ ...S.labelEmb, fontSize: "11px" }}>{l}</Label>
                  <Textarea value={form.datos_embarazo[k]}
                    onChange={e => setDE(k, e.target.value)}
                    rows={3} style={{ fontSize: "12px", borderColor: "#fed7aa" }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXAMEN FÍSICO GENERAL */}
        <div style={S.seccion}>🩻 EXAMEN FÍSICO</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", marginBottom: "10px" }}>
          {[["peso","Peso","kg"],["talla","Talla","cm"],["imc","IMC","auto"],
            ["presion_arterial","P. Arterial",""],["temperatura","Temp.","°C"]].map(([k,l,u]) => (
            <div key={k} style={S.campo}>
              <Label style={{ ...S.label, fontSize: "11px" }}>{l}</Label>
              <Input type={u === "" ? "text" : "number"} step="0.01"
                value={form[k]}
                onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                readOnly={u === "auto"}
                style={{ ...S.input, background: u === "auto" ? "#f5f3ff" : "white",
                  fontWeight: u === "auto" ? "700" : "normal" }} />
            </div>
          ))}
        </div>
        <div style={S.grid2}>
          <div style={S.campo}>
            <Label style={S.label}>Examen físico general</Label>
            <Textarea value={form.examen_fisico_general}
              onChange={e => setForm(f => ({ ...f, examen_fisico_general: e.target.value }))}
              rows={3} style={{ fontSize: "13px", borderColor: "#e9d5ff" }} />
          </div>
          <div style={S.campo}>
            <Label style={S.label}>Examen ginecológico</Label>
            <Textarea value={form.examen_ginecologico}
              onChange={e => setForm(f => ({ ...f, examen_ginecologico: e.target.value }))}
              rows={3} style={{ fontSize: "13px", borderColor: "#e9d5ff" }} />
          </div>
        </div>

        {/* DIAGNÓSTICO */}
        <div style={S.seccion}>🩺 DIAGNÓSTICO</div>
        <div style={{ marginBottom: "10px" }}>
          <CIE10Selector token={token}
            value={{ codigo: form.cie10_codigo, descripcion: form.cie10_descripcion }}
            onChange={({ codigo, descripcion }) => setForm(f => ({ ...f, cie10_codigo: codigo, cie10_descripcion: descripcion }))}
          />
          <div style={{ marginTop: "8px" }}>
            <Label style={S.label}>Diagnóstico detallado *</Label>
            <Textarea value={form.diagnostico_texto}
              onChange={e => setForm(f => ({ ...f, diagnostico_texto: e.target.value }))}
              rows={2} style={{ fontSize: "13px", borderColor: "#e9d5ff" }} />
          </div>
        </div>

        {/* TRATAMIENTO */}
        <div style={S.seccion}>💊 TRATAMIENTO / INDICACIONES</div>
        <div style={S.grid2}>
          <div style={S.campo}>
            <Label style={S.label}>Tratamiento</Label>
            <Textarea value={form.tratamiento}
              onChange={e => setForm(f => ({ ...f, tratamiento: e.target.value }))}
              rows={3} style={{ fontSize: "13px", borderColor: "#e9d5ff" }} />
          </div>
          <div style={S.campo}>
            <Label style={S.label}>Indicaciones / Próximo control</Label>
            <Textarea value={form.indicaciones}
              onChange={e => setForm(f => ({ ...f, indicaciones: e.target.value }))}
              rows={2} style={{ fontSize: "13px", borderColor: "#e9d5ff" }} />
            <Input type="date" value={form.proximo_control}
              onChange={e => setForm(f => ({ ...f, proximo_control: e.target.value }))}
              style={{ ...S.input, marginTop: "6px" }} />
          </div>
        </div>

        {/* RECETA */}
        <div style={{ marginBottom: "16px", marginTop: "12px" }}>
          <MedicacionRapida
            especialidad="Ginecología"
            medicamentos={form.medicamentos}
            onChange={meds => setForm(f => ({ ...f, medicamentos: meds }))}
          />
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingBottom: "20px" }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} style={{ background: "#9333ea", color: "white" }}>
            {loading ? "Guardando..." : existingHistory ? "Actualizar Consulta" : "Terminar Consulta"}
          </Button>
        </div>
      </form>

      <HistorialLateral cedula={appointment.cedula} token={token} especialidadActual="Ginecología" />
    </div>
  );
};