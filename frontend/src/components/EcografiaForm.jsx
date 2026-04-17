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
import { HistorialLateral } from "./HistorialLateral";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const S = {
  seccion: {
    background: "#0284c7", color: "white", fontWeight: "700",
    fontSize: "12px", padding: "6px 14px", borderRadius: "6px",
    marginBottom: "10px", marginTop: "16px"
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" },
  campo: { display: "flex", flexDirection: "column", gap: "3px" },
  label: { fontSize: "12px", color: "#075985", fontWeight: "600" },
  input: { fontSize: "13px", height: "34px", borderColor: "#bae6fd" },
};

const TIPOS_ECO = [
  "Obstétrica", "Pélvica", "Abdominal", "Renal / Vías urinarias",
  "Tiroides", "Mamas", "Hepática / Vesicular", "Cardíaca (Ecocardiograma)",
  "Musculoesquelética", "Doppler", "Otra"
];

const ORGANOS_COMUNES = [
  "Hígado", "Vesícula biliar", "Páncreas", "Bazo",
  "Riñón derecho", "Riñón izquierdo", "Vejiga",
  "Útero", "Ovario derecho", "Ovario izquierdo",
  "Tiroides", "Próstata"
];

const FORM_INICIAL = {
  tipo_ecografia: "",
  via: "",
  indicacion_clinica: "",
  es_obstetrica: false,
  semanas_gestacion: "",
  fur: "",
  numero_fetos: 1,
  latido_cardiaco_fetal: null,
  frecuencia_cardiaca_fetal: "",
  presentacion: "",
  placenta: "",
  liquido_amniotico: "",
  biometria_fetal: "",
  hallazgos: [],
  conclusion: "",
  cie10_codigo: "",
  cie10_descripcion: "",
  recomendaciones: "",
  notas: "",
};

export const EcografiaForm = ({ appointment, token, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [existingHistory, setExistingHistory] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);

  const esObstetrica = form.es_obstetrica || form.tipo_ecografia === "Obstétrica";

  // Sincronizar tipo con es_obstetrica
  useEffect(() => {
    if (form.tipo_ecografia === "Obstétrica") {
      setForm(f => ({ ...f, es_obstetrica: true }));
    }
  }, [form.tipo_ecografia]);

  useEffect(() => {
    const cargar = async () => {
      if (!appointment?.id) { setLoadingData(false); return; }
      try {
        const res = await axios.get(
          `${API}/medical-history/ecografia/appointment/${appointment.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data) {
          setExistingHistory(res.data);
          setForm(f => ({ ...f, ...res.data, hallazgos: res.data.hallazgos || [] }));
          toast.info("Ecografía anterior cargada — puede continuar editando");
        }
      } catch (e) {
        if (e.response?.status !== 404) console.error(e);
        else toast.success("Nueva ecografía — formulario listo");
      }
      setLoadingData(false);
    };
    cargar();
  }, [appointment?.id, token]);

  // Gestión de hallazgos
  const agregarHallazgo = (organo = "") => {
    setForm(f => ({
      ...f,
      hallazgos: [...f.hallazgos, { organo, normal: true, descripcion: "", medidas: "" }]
    }));
  };

  const actualizarHallazgo = (idx, campo, valor) => {
    setForm(f => ({
      ...f,
      hallazgos: f.hallazgos.map((h, i) => i === idx ? { ...h, [campo]: valor } : h)
    }));
  };

  const eliminarHallazgo = (idx) => {
    setForm(f => ({ ...f, hallazgos: f.hallazgos.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.tipo_ecografia) { toast.error("Seleccione el tipo de ecografía"); return; }
    if (!form.conclusion.trim()) { toast.error("La conclusión es obligatoria"); return; }
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
        semanas_gestacion: form.semanas_gestacion ? parseInt(form.semanas_gestacion) : null,
        numero_fetos: form.numero_fetos ? parseInt(form.numero_fetos) : 1,
        frecuencia_cardiaca_fetal: form.frecuencia_cardiaca_fetal ? parseInt(form.frecuencia_cardiaca_fetal) : null,
      };

      if (existingHistory) {
        await axios.put(`${API}/medical-history/ecografia/${existingHistory.id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Ecografía actualizada correctamente");
      } else {
        await axios.post(`${API}/medical-history/ecografia`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        toast.success("Ecografía guardada — consulta financiera creada");
      }

      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al guardar la ecografía");
    }
    setLoading(false);
  };

  if (loadingData) return (
    <div style={{ textAlign: "center", padding: "40px", color: "#0284c7" }}>
      Cargando historia clínica...
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

        {/* Encabezado */}
        <div style={{
          background: "linear-gradient(135deg, #0284c7, #075985)",
          borderRadius: "10px", padding: "14px 18px", marginBottom: "16px",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <div>
            <h2 style={{ color: "white", margin: 0, fontSize: "16px", fontWeight: "700" }}>
              🔬 Informe de Ecografía
            </h2>
            <p style={{ color: "rgba(255,255,255,0.8)", margin: "2px 0 0", fontSize: "13px" }}>
              {appointment.nombre_completo} · {appointment.cedula}
            </p>
          </div>
          {form.tipo_ecografia && (
            <span style={{
              background: "rgba(255,255,255,0.2)", color: "white",
              borderRadius: "6px", padding: "6px 12px", fontSize: "13px", fontWeight: "700"
            }}>
              {form.tipo_ecografia}
            </span>
          )}
        </div>

        {/* DATOS DE LA ECOGRAFÍA */}
        <div style={S.seccion}>🔬 DATOS DEL ESTUDIO</div>
        <div style={{ ...S.grid3, marginBottom: "10px" }}>
          <div style={S.campo}>
            <Label style={S.label}>Tipo de Ecografía *</Label>
            <Select value={form.tipo_ecografia}
              onValueChange={v => setForm(f => ({ ...f, tipo_ecografia: v }))}>
              <SelectTrigger style={S.input}>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_ECO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div style={S.campo}>
            <Label style={S.label}>Vía</Label>
            <Select value={form.via} onValueChange={v => setForm(f => ({ ...f, via: v }))}>
              <SelectTrigger style={S.input}>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {["Abdominal","Transvaginal","Transrectal","Superficial"].map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div style={S.campo}>
            <Label style={S.label}>Indicación clínica</Label>
            <Input value={form.indicacion_clinica}
              onChange={e => setForm(f => ({ ...f, indicacion_clinica: e.target.value }))}
              placeholder="Motivo del estudio"
              style={S.input} />
          </div>
        </div>

        {/* SECCIÓN OBSTÉTRICA */}
        {esObstetrica && (
          <div style={{
            border: "2px solid #0284c7", borderRadius: "10px",
            padding: "14px", marginBottom: "10px",
            background: "#f0f9ff"
          }}>
            <div style={S.seccion}>🤱 DATOS OBSTÉTRICOS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "10px" }}>
              <div style={S.campo}>
                <Label style={S.label}>FUR</Label>
                <Input type="date" value={form.fur}
                  onChange={e => setForm(f => ({ ...f, fur: e.target.value }))}
                  style={S.input} />
              </div>
              <div style={S.campo}>
                <Label style={S.label}>Semanas gestación</Label>
                <Input type="number" value={form.semanas_gestacion}
                  onChange={e => setForm(f => ({ ...f, semanas_gestacion: e.target.value }))}
                  style={S.input} />
              </div>
              <div style={S.campo}>
                <Label style={S.label}>N° fetos</Label>
                <Select value={form.numero_fetos?.toString()}
                  onValueChange={v => setForm(f => ({ ...f, numero_fetos: parseInt(v) }))}>
                  <SelectTrigger style={S.input}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div style={S.campo}>
                <Label style={S.label}>FCF (lpm)</Label>
                <Input type="number" value={form.frecuencia_cardiaca_fetal}
                  onChange={e => setForm(f => ({ ...f, frecuencia_cardiaca_fetal: e.target.value }))}
                  style={S.input} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginBottom: "10px", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600" }}>
                <Checkbox
                  checked={form.latido_cardiaco_fetal === true}
                  onCheckedChange={v => setForm(f => ({ ...f, latido_cardiaco_fetal: v ? true : null }))}
                />
                LCF Presente
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#dc2626" }}>
                <Checkbox
                  checked={form.latido_cardiaco_fetal === false}
                  onCheckedChange={v => setForm(f => ({ ...f, latido_cardiaco_fetal: v ? false : null }))}
                />
                LCF Ausente
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <div style={S.campo}>
                <Label style={S.label}>Presentación</Label>
                <Select value={form.presentacion}
                  onValueChange={v => setForm(f => ({ ...f, presentacion: v }))}>
                  <SelectTrigger style={S.input}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Cefálica","Podálica","Transversa","Oblicua"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div style={S.campo}>
                <Label style={S.label}>Placenta</Label>
                <Input value={form.placenta}
                  onChange={e => setForm(f => ({ ...f, placenta: e.target.value }))}
                  placeholder="Localización y grado"
                  style={S.input} />
              </div>
              <div style={S.campo}>
                <Label style={S.label}>Líquido amniótico</Label>
                <Select value={form.liquido_amniotico}
                  onValueChange={v => setForm(f => ({ ...f, liquido_amniotico: v }))}>
                  <SelectTrigger style={S.input}>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Normal","Oligohidramnios","Polihidramnios","Aumentado","Disminuido"].map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div style={{ marginTop: "8px" }}>
              <Label style={S.label}>Biometría fetal</Label>
              <Textarea value={form.biometria_fetal}
                onChange={e => setForm(f => ({ ...f, biometria_fetal: e.target.value }))}
                placeholder="DBP: ___ mm | LF: ___ mm | CA: ___ mm | CC: ___ mm | Peso estimado: ___ g"
                rows={2} style={{ fontSize: "13px", borderColor: "#bae6fd" }} />
            </div>
          </div>
        )}

        {/* HALLAZGOS POR ÓRGANO */}
        <div style={S.seccion}>🔍 HALLAZGOS</div>
        <div style={{ marginBottom: "10px" }}>
          {/* Botones rápidos para agregar órganos */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
            {ORGANOS_COMUNES.map(o => (
              <button key={o} type="button"
                onClick={() => agregarHallazgo(o)}
                style={{
                  background: form.hallazgos.some(h => h.organo === o) ? "#0284c7" : "white",
                  color: form.hallazgos.some(h => h.organo === o) ? "white" : "#0284c7",
                  border: "1.5px solid #0284c7",
                  borderRadius: "16px", padding: "3px 10px",
                  fontSize: "11px", cursor: "pointer", transition: "all 0.2s"
                }}>
                + {o}
              </button>
            ))}
            <button type="button"
              onClick={() => agregarHallazgo("")}
              style={{
                background: "#f0f9ff", color: "#075985",
                border: "1.5px dashed #0284c7",
                borderRadius: "16px", padding: "3px 10px",
                fontSize: "11px", cursor: "pointer"
              }}>
              + Otro órgano
            </button>
          </div>

          {/* Lista de hallazgos */}
          {form.hallazgos.map((h, idx) => (
            <div key={idx} style={{
              border: h.normal ? "1px solid #bae6fd" : "1.5px solid #fca5a5",
              borderRadius: "8px", padding: "10px", marginBottom: "6px",
              background: h.normal ? "#f0f9ff" : "#fff5f5"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <Input value={h.organo}
                  onChange={e => actualizarHallazgo(idx, "organo", e.target.value)}
                  placeholder="Órgano / estructura"
                  style={{ ...S.input, flex: 1, fontWeight: "700", color: "#075985" }} />
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px",
                  whiteSpace: "nowrap", cursor: "pointer" }}>
                  <Checkbox checked={h.normal}
                    onCheckedChange={v => actualizarHallazgo(idx, "normal", v)} />
                  <span style={{ color: h.normal ? "#059669" : "#dc2626", fontWeight: "700" }}>
                    {h.normal ? "✓ Normal" : "⚠ Anormal"}
                  </span>
                </label>
                <button type="button" onClick={() => eliminarHallazgo(idx)}
                  style={{ background: "#fee2e2", border: "none", color: "#dc2626",
                    borderRadius: "4px", padding: "2px 8px", fontSize: "12px", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
              <div style={S.grid2}>
                <div style={S.campo}>
                  <Label style={{ fontSize: "11px", color: "#666" }}>Descripción / hallazgo</Label>
                  <Textarea value={h.descripcion}
                    onChange={e => actualizarHallazgo(idx, "descripcion", e.target.value)}
                    rows={2} placeholder={h.normal ? "Sin alteraciones" : "Describir hallazgo anormal..."}
                    style={{ fontSize: "12px", borderColor: h.normal ? "#bae6fd" : "#fca5a5" }} />
                </div>
                <div style={S.campo}>
                  <Label style={{ fontSize: "11px", color: "#666" }}>Medidas</Label>
                  <Input value={h.medidas}
                    onChange={e => actualizarHallazgo(idx, "medidas", e.target.value)}
                    placeholder="Ej: 8.5 x 4.2 x 3.1 cm"
                    style={{ ...S.input, fontSize: "12px" }} />
                </div>
              </div>
            </div>
          ))}

          {form.hallazgos.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px", color: "#999", fontSize: "13px",
              border: "2px dashed #bae6fd", borderRadius: "8px" }}>
              Haz click en los órganos arriba para agregar hallazgos
            </div>
          )}
        </div>

        {/* CONCLUSIÓN Y DIAGNÓSTICO */}
        <div style={S.seccion}>📋 CONCLUSIÓN Y DIAGNÓSTICO</div>
        <div style={{ marginBottom: "10px" }}>
          <CIE10Selector token={token}
            value={{ codigo: form.cie10_codigo, descripcion: form.cie10_descripcion }}
            onChange={({ codigo, descripcion }) => setForm(f => ({ ...f, cie10_codigo: codigo, cie10_descripcion: descripcion }))}
            label="Diagnóstico CIE-10 (opcional)"
          />
          <div style={{ marginTop: "8px" }}>
            <Label style={S.label}>Conclusión *</Label>
            <Textarea value={form.conclusion}
              onChange={e => setForm(f => ({ ...f, conclusion: e.target.value }))}
              placeholder="Impresión diagnóstica y conclusión del estudio..."
              rows={3} style={{ fontSize: "13px", borderColor: "#bae6fd" }} />
          </div>
          <div style={{ marginTop: "8px" }}>
            <Label style={S.label}>Recomendaciones</Label>
            <Textarea value={form.recomendaciones}
              onChange={e => setForm(f => ({ ...f, recomendaciones: e.target.value }))}
              rows={2} style={{ fontSize: "13px", borderColor: "#bae6fd" }} />
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingBottom: "20px" }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} style={{ background: "#0284c7", color: "white" }}>
            {loading ? "Guardando..." : existingHistory ? "Actualizar Informe" : "Guardar Informe"}
          </Button>
        </div>
      </form>

      <HistorialLateral cedula={appointment.cedula} token={token} especialidadActual="Ecografía" />
    </div>
  );
};
