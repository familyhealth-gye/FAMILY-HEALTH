import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import axios from "axios";
import { 
  ArrowLeft, User, Calendar, FileText, Phone, Mail, 
  Stethoscope, Pill, Clock, Download, Smile, ClipboardList
} from "lucide-react";
import { OdontogramaClinicoTab } from "./OdontogramaClinicoTab";
import { NuevaCitaModal } from "./NuevaCitaModal";
import { CalendarPlus } from "lucide-react";
import { PlanTratamientoTab } from "./PlanTratamientoTab";
import "./HistoriaClinicaCompleta.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const HistoriaClinicaCompleta = ({ 
  paciente, 
  token, 
  user,
  onBack,
  especialidad = null 
}) => {
  const [loading, setLoading] = useState(false);
  const [showNuevaCita, setShowNuevaCita] = useState(false);
  const [consultas, setConsultas] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const [activeTab, setActiveTab] = useState("consultas");
  const [odontogramaId, setOdontogramaId] = useState(null);

  // Determinar si mostrar odontograma
  const esOdontologia = especialidad === "Odontología" || 
                        user?.especialidad === "Odontología" ||
                        consultas.some(c => c.especialidad === "Odontología");

  useEffect(() => {
    if (paciente?.cedula) {
      fetchHistorialPaciente();
      if (esOdontologia) {
        fetchOdontogramaId();
      }
    }
  }, [paciente, esOdontologia]);

  const fetchOdontogramaId = async () => {
    try {
      const response = await axios.get(
        `${API}/odontograma-clinico/cedula/${paciente.cedula}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data && response.data.length > 0) {
        setOdontogramaId(response.data[0].id);
      }
    } catch (error) {
      console.log("No se encontró odontograma");
    }
  };

  const fetchHistorialPaciente = async () => {
    setLoading(true);
    try {
      // Obtener todas las citas del paciente
      const appointmentsRes = await axios.get(`${API}/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const citasPaciente = appointmentsRes.data.filter(apt => 
        apt.cedula === paciente.cedula && apt.estado !== "Cancelada"
      );

      // Mapeo especialidad -> endpoint slug
      const especialidadEndpointMap = {
        "Medicina General": "general",
        "Pediatría": "pediatric",
        "Pediatria": "pediatric",
        "Odontología": "odontology",
        "Odontologia": "odontology",
        "Nutrición": "nutricion",
        "Nutricion": "nutricion",
        "Ginecología": "ginecologia",
        "Ginecologia": "ginecologia",
        "Ecografía": "ecografia",
        "Ecografia": "ecografia",
      };

      // Orden de fallback (todas las especialidades) si la cita no tiene
      // especialidad o el endpoint específico devuelve 404
      const fallbackOrder = ["general", "pediatric", "odontology", "nutricion", "ginecologia", "ecografia"];

      const fetchHistoriaPorTipo = async (citaId, tipo) => {
        try {
          const res = await axios.get(
            `${API}/medical-history/${tipo}/appointment/${citaId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          return res.data || null;
        } catch (e) {
          return null;
        }
      };

      // Obtener historias clínicas de cada cita
      const consultasConHistoria = await Promise.all(
        citasPaciente.map(async (cita) => {
          let historia = null;
          let tipoHistoria = null;

          // 1) Intentar con la especialidad de la cita
          const tipoPreferido = especialidadEndpointMap[cita.especialidad];
          if (tipoPreferido) {
            const data = await fetchHistoriaPorTipo(cita.id, tipoPreferido);
            if (data) {
              historia = data;
              tipoHistoria = tipoPreferido;
            }
          }

          // 2) Fallback: probar todos los demás tipos
          if (!historia) {
            for (const tipo of fallbackOrder) {
              if (tipo === tipoPreferido) continue;
              const data = await fetchHistoriaPorTipo(cita.id, tipo);
              if (data) {
                historia = data;
                tipoHistoria = tipo;
                break;
              }
            }
          }

          return {
            ...cita,
            historia,
            tipoHistoria,
            tieneHistoria: !!historia
          };
        })
      );
      
      // Ordenar por fecha descendente
      consultasConHistoria.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setConsultas(consultasConHistoria);
      
      // Obtener recetas
      try {
        const recetasRes = await axios.get(
          `${API}/prescriptions/patient/${paciente.cedula}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRecetas(recetasRes.data || []);
      } catch (e) {
        console.log("No se encontraron recetas");
      }
      
    } catch (error) {
      console.error("Error al cargar historial:", error);
      toast.error("Error al cargar historial del paciente");
    }
    setLoading(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getEstadoBadge = (estado) => {
    const estilos = {
      "Programada": { bg: "#DBEAFE", color: "#1E40AF" },
      "En Atención": { bg: "#FEF3C7", color: "#92400E" },
      "Pendiente de Pago": { bg: "#FEE2E2", color: "#991B1B" },
      "Pagada": { bg: "#D1FAE5", color: "#065F46" },
      "Atendida": { bg: "#D1FAE5", color: "#065F46" }
    };
    return estilos[estado] || { bg: "#F3F4F6", color: "#374151" };
  };

  // ----- Renderizadores específicos por especialidad -----
  const Campo = ({ label, value }) => {
    if (value === null || value === undefined || value === "" || value === false) return null;
    return (
      <div className="historia-campo">
        <span className="campo-label">{label}:</span>
        <p style={{ whiteSpace: "pre-wrap" }}>{String(value)}</p>
      </div>
    );
  };

  const TablaCampos = ({ titulo, datos = {}, etiquetas = {} }) => {
    const entries = Object.entries(datos).filter(
      ([k, v]) => v !== null && v !== undefined && v !== "" && etiquetas[k]
    );
    if (entries.length === 0) return null;
    return (
      <div className="historia-campo">
        <span className="campo-label">{titulo}:</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "8px", marginTop: "6px" }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{ background: "#F9FAFB", padding: "6px 10px", borderRadius: "6px", fontSize: "13px" }}>
              <div style={{ color: "#6B7280", fontSize: "11px" }}>{etiquetas[k]}</div>
              <div style={{ fontWeight: 600 }}>{String(v)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNutricion = (h) => (
    <>
      <Campo label="Motivo de Consulta" value={h.motivo_consulta} />
      <Campo label="Evolución de la Enfermedad" value={h.evolucion_enfermedad} />
      <Campo label="Antecedentes Familiares" value={h.ant_familiares} />
      <Campo label="Antecedentes Personales" value={h.ant_personales} />
      <Campo label="Otros Antecedentes" value={h.ant_otros} />
      <Campo label="Alergias / Intolerancias" value={h.alergias_intolerancias} />
      <Campo label="Medicamentos Actuales" value={h.medicamentos_actuales} />
      <TablaCampos
        titulo="Examen Físico / Antropometría"
        datos={h.examen_fisico || {}}
        etiquetas={{
          peso: "Peso (kg)", talla: "Talla (cm)", imc: "IMC",
          porcentaje_grasa: "% Grasa", porcentaje_musculo: "% Músculo",
          edad_corporal: "Edad corporal",
          pliegue_suprailiaco: "P. Suprailíaco", pliegue_tricipital: "P. Tricipital",
          pliegue_bicipital: "P. Bicipital", pliegue_subescapular: "P. Subescapular",
          cintura: "Cintura (cm)", cadera: "Cadera (cm)", icc: "ICC",
          muneca: "Muñeca", circunferencia_brazo: "Brazo"
        }}
      />
      <Campo label="Diagnóstico" value={h.diagnostico_texto} />
      {(h.cie10_codigo || h.cie10_descripcion) && (
        <Campo label="CIE-10" value={`${h.cie10_codigo || ""} - ${h.cie10_descripcion || ""}`} />
      )}
      <TablaCampos
        titulo="Laboratorio"
        datos={h.laboratorio || {}}
        etiquetas={{
          fecha_lab: "Fecha", hemoglobina: "Hemoglobina", plaquetas: "Plaquetas",
          glucosa: "Glucosa", urea: "Urea", creatinina: "Creatinina",
          acido_urico: "Ácido úrico", colesterol: "Colesterol", hdl: "HDL",
          ldl: "LDL", trigliceridos: "Triglicéridos", tgo: "TGO", tgp: "TGP"
        }}
      />
      <Campo label="Plan Alimentario" value={h.plan_alimentario} />
      <Campo label="Anamnesis" value={h.anamnesis} />
      <Campo label="Notas" value={h.notas} />
      <Campo label="Receta" value={h.receta} />
      {Array.isArray(h.medicamentos) && h.medicamentos.length > 0 && (
        <div className="historia-campo">
          <span className="campo-label">Medicamentos:</span>
          <ul style={{ margin: "6px 0", paddingLeft: "18px" }}>
            {h.medicamentos.map((m, i) => (
              <li key={i}>
                <strong>{m.nombre}</strong>
                {m.dosis ? ` - ${m.dosis}` : ""}
                {m.frecuencia ? ` (${m.frecuencia})` : ""}
                {m.duracion ? ` x ${m.duracion}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {Array.isArray(h.controles) && h.controles.length > 0 && (
        <div className="historia-campo">
          <span className="campo-label">Controles de Seguimiento:</span>
          <table style={{ width: "100%", marginTop: "6px", fontSize: "12px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F3F4F6" }}>
                <th style={{ padding: "6px", textAlign: "left" }}>#</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Fecha</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Peso</th>
                <th style={{ padding: "6px", textAlign: "left" }}>IMC</th>
                <th style={{ padding: "6px", textAlign: "left" }}>%Grasa</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Cintura</th>
                <th style={{ padding: "6px", textAlign: "left" }}>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {h.controles.map((c, i) => (
                <tr key={i} style={{ borderTop: "1px solid #E5E7EB" }}>
                  <td style={{ padding: "6px" }}>{c.numero || i + 1}</td>
                  <td style={{ padding: "6px" }}>{c.fecha || "-"}</td>
                  <td style={{ padding: "6px" }}>{c.peso ?? "-"}</td>
                  <td style={{ padding: "6px" }}>{c.imc ?? "-"}</td>
                  <td style={{ padding: "6px" }}>{c.porcentaje_grasa ?? "-"}</td>
                  <td style={{ padding: "6px" }}>{c.cintura ?? "-"}</td>
                  <td style={{ padding: "6px" }}>{c.observaciones || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const renderGinecologia = (h) => (
    <>
      <Campo label="Motivo de Consulta" value={h.motivo_consulta} />
      <Campo label="Enfermedad Actual" value={h.enfermedad_actual} />
      <Campo label="Antecedentes Quirúrgicos" value={h.ant_personales_quirurgicos} />
      <Campo label="Alergias" value={h.ant_personales_alergias} />
      <Campo label="Medicamentos Actuales" value={h.medicamentos_actuales} />
      <TablaCampos
        titulo="Datos Ginecológicos"
        datos={h.datos_ginecologicos || {}}
        etiquetas={{
          menarquia: "Menarquia", ritmo_menstrual: "Ritmo menstrual",
          inicio_actividad_sexual: "Inicio actividad sexual", menopausia: "Menopausia",
          partos: "Partos", abortos: "Abortos", cesareas: "Cesáreas", gestas: "Gestas",
          metodo_anticonceptivo: "Anticonceptivo",
          ultimo_papanicolaou: "Último Papanicolaou", resultado_papanicolaou: "Resultado",
          ultima_mamografia: "Última mamografía", resultado_mamografia: "Resultado mamografía"
        }}
      />
      {h.datos_embarazo?.esta_embarazada && (
        <TablaCampos
          titulo="Embarazo"
          datos={h.datos_embarazo || {}}
          etiquetas={{
            fur: "FUR", fpp: "FPP", semanas_gestacion: "Semanas",
            trimestre: "Trimestre", numero_embarazo: "Nº Embarazo",
            presion_arterial: "PA", peso_actual: "Peso",
            altura_uterina: "Altura uterina", frecuencia_cardiaca_fetal: "FCF",
            presentacion_fetal: "Presentación", grupo_sanguineo: "Grupo sang.",
            factor_rh: "RH"
          }}
        />
      )}
      <TablaCampos
        titulo="Examen Físico"
        datos={{
          peso: h.peso, talla: h.talla, imc: h.imc,
          presion_arterial: h.presion_arterial, frecuencia_cardiaca: h.frecuencia_cardiaca,
          temperatura: h.temperatura
        }}
        etiquetas={{
          peso: "Peso", talla: "Talla", imc: "IMC",
          presion_arterial: "PA", frecuencia_cardiaca: "FC", temperatura: "T°"
        }}
      />
      <Campo label="Examen Ginecológico" value={h.examen_ginecologico} />
      <Campo label="Diagnóstico" value={h.diagnostico_texto} />
      {(h.cie10_codigo || h.cie10_descripcion) && (
        <Campo label="CIE-10" value={`${h.cie10_codigo || ""} - ${h.cie10_descripcion || ""}`} />
      )}
      <Campo label="Tratamiento" value={h.tratamiento} />
      <Campo label="Receta" value={h.receta} />
      <Campo label="Indicaciones" value={h.indicaciones} />
      <Campo label="Próximo Control" value={h.proximo_control} />
      <Campo label="Notas" value={h.notas} />
    </>
  );

  const renderGenerico = (h) => (
    <>
      <Campo label="Motivo de Consulta" value={h.motivo_consulta} />
      <Campo label="Enfermedad Actual" value={h.enfermedad_actual} />
      <Campo label="Diagnóstico" value={h.diagnostico || h.diagnostico_texto} />
      {(h.cie10_codigo || h.cie10_descripcion) && (
        <Campo label="CIE-10" value={`${h.cie10_codigo || ""} - ${h.cie10_descripcion || ""}`} />
      )}
      <Campo label="Tratamiento" value={h.tratamiento_realizado || h.tratamiento} />
      <Campo label="Indicaciones" value={h.indicaciones} />
      <Campo label="Observaciones" value={h.observaciones || h.notas} />
    </>
  );

  const renderMedicinaGeneral = (h) => (
    <>
      <Campo label="Motivo de Consulta" value={h.motivo_consulta} />
      <Campo label="Enfermedad Actual" value={h.enfermedad_actual} />
      {h.signos_vitales && Object.values(h.signos_vitales).some(Boolean) && (
        <div style={{ margin:"8px 0" }}>
          <p style={{ fontSize:"11px", fontWeight:"700", color:"#005f73", margin:"0 0 4px", textTransform:"uppercase" }}>Signos Vitales</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"6px" }}>
            {[["Peso",h.signos_vitales?.peso,"kg"],["Talla",h.signos_vitales?.talla,"cm"],["Temp.",h.signos_vitales?.temperatura,"°C"],["P. Arterial",h.signos_vitales?.presion_arterial,""],["F. Cardíaca",h.signos_vitales?.frecuencia_cardiaca,"lpm"],["SatO2",h.signos_vitales?.saturacion_oxigeno,"%"]].filter(([,v])=>v).map(([l,v,u])=>(
              <div key={l} style={{ background:"#f0f9ff", borderRadius:"6px", padding:"4px 8px" }}>
                <p style={{ margin:0, fontSize:"10px", color:"#666" }}>{l}</p>
                <p style={{ margin:0, fontWeight:"700", fontSize:"13px", color:"#005f73" }}>{v}{u}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Campo label="Antecedentes" value={h.antecedentes_familiares} />
      <Campo label="Alergias" value={h.alergias} />
      <Campo label="Diagnóstico" value={h.diagnostico} />
      {(h.cie10_codigo||h.cie10_descripcion) && <Campo label="CIE-10" value={`${h.cie10_codigo||""} - ${h.cie10_descripcion||""}`} />}
      <Campo label="Indicaciones Generales" value={h.indicaciones_generales} />
      <Campo label="Observaciones" value={h.observaciones} />
    </>
  );

  const renderOdontologia = (h) => (
    <>
      <Campo label="Motivo de Consulta" value={h.motivo_consulta} />
      <Campo label="Alergias a Medicamentos" value={h.alergias_medicamentos} />
      <Campo label="Última Visita Odontológica" value={h.ultima_visita_odonto} />
      {h.estado_dental && (
        <div style={{ margin:"8px 0" }}>
          <p style={{ fontSize:"11px", fontWeight:"700", color:"#d97706", margin:"0 0 4px", textTransform:"uppercase" }}>Examen Clínico</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"6px" }}>
            {[["Higiene",h.estado_dental?.higiene_oral],["Encías",h.estado_dental?.encia],["Mucosa",h.estado_dental?.mucosa_oral],["Lengua",h.estado_dental?.lengua],["ATM",h.estado_dental?.atm]].filter(([,v])=>v).map(([l,v])=>(
              <div key={l} style={{ background:"#fffbeb", borderRadius:"6px", padding:"4px 8px" }}>
                <p style={{ margin:0, fontSize:"10px", color:"#92400e" }}>{l}</p>
                <p style={{ margin:0, fontWeight:"600", fontSize:"12px" }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Campo label="Diagnóstico" value={h.diagnostico} />
      {(h.cie10_codigo||h.cie10_descripcion) && <Campo label="CIE-10" value={`${h.cie10_codigo||""} - ${h.cie10_descripcion||""}`} />}
      <Campo label="Plan de Tratamiento" value={h.plan_tratamiento} />
      <Campo label="Procedimientos Realizados" value={h.procedimientos_realizados} />
      <Campo label="Próximo Control" value={h.proximo_control} />
      <Campo label="Observaciones" value={h.observaciones} />
    </>
  );

  const renderPediatria = (h) => (
    <>
      <Campo label="Responsable" value={h.nombre_responsable} />
      <Campo label="Motivo de Consulta" value={h.motivo_consulta} />
      <Campo label="Enfermedad Actual" value={h.enfermedad_actual} />
      {h.signos_vitales && (
        <div style={{ margin:"8px 0" }}>
          <p style={{ fontSize:"11px", fontWeight:"700", color:"#005f73", margin:"0 0 4px", textTransform:"uppercase" }}>Somatometría</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"6px" }}>
            {[["Peso",h.signos_vitales?.peso,"kg"],["Talla",h.signos_vitales?.talla,"cm"],["Temp.",h.signos_vitales?.temperatura,"°C"],["P. Cefalico",h.signos_vitales?.perimetro_cefalico,"cm"]].filter(([,v])=>v).map(([l,v,u])=>(
              <div key={l} style={{ background:"#f0f9ff", borderRadius:"6px", padding:"4px 8px" }}>
                <p style={{ margin:0, fontSize:"10px", color:"#666" }}>{l}</p>
                <p style={{ margin:0, fontWeight:"700", fontSize:"13px", color:"#005f73" }}>{v}{u}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Campo label="Alergias" value={h.alergias} />
      <Campo label="Esquema de Vacunas" value={h.esquema_vacunas} />
      <Campo label="Diagnóstico" value={h.diagnostico} />
      {(h.cie10_codigo||h.cie10_descripcion) && <Campo label="CIE-10" value={`${h.cie10_codigo||""} - ${h.cie10_descripcion||""}`} />}
      <Campo label="Tratamiento" value={h.tratamiento} />
      <Campo label="Indicaciones" value={h.indicaciones_generales} />
      <Campo label="Próximo Control" value={h.proximo_control} />
    </>
  );

  const renderEcografia = (h) => (
    <>
      <Campo label="Tipo de Estudio" value={h.tipo_estudio} />
      <Campo label="Motivo" value={h.motivo_consulta} />
      <Campo label="Hallazgos" value={h.hallazgos} />
      {h.datos_obstetricia && (
        <>
          <Campo label="Semanas de Gestación" value={h.datos_obstetricia?.semanas_gestacion} />
          <Campo label="Presentación" value={h.datos_obstetricia?.presentacion} />
          <Campo label="Latidos Fetales" value={h.datos_obstetricia?.latidos_fetales} />
          <Campo label="Líquido Amniótico" value={h.datos_obstetricia?.liquido_amniotico} />
        </>
      )}
      <Campo label="Diagnóstico" value={h.diagnostico} />
      {(h.cie10_codigo||h.cie10_descripcion) && <Campo label="CIE-10" value={`${h.cie10_codigo||""} - ${h.cie10_descripcion||""}`} />}
      <Campo label="Conclusiones" value={h.conclusiones || h.recomendaciones} />
      <Campo label="Observaciones" value={h.observaciones} />
    </>
  );

  const renderHistoriaCompleta = (consulta) => {
    const h = consulta.historia || {};
    switch (consulta.tipoHistoria) {
      case "nutricion": return renderNutricion(h);
      case "ginecologia": return renderGinecologia(h);
      case "general":
      case "medicina_general": return renderMedicinaGeneral(h);
      case "odontologia":
      case "odontology": return renderOdontologia(h);
      case "pediatria":
      case "pediatric": return renderPediatria(h);
      case "ecografia": return renderEcografia(h);
      default: return renderGenerico(h);
    }
  };

  return (
    <div className="historia-clinica-completa">
      {/* Header con datos del paciente */}
      <div className="historia-header">
        <Button variant="ghost" onClick={onBack} className="back-button">
          <ArrowLeft size={20} />
          Volver
        </Button>
        <Button
          size="sm"
          onClick={() => setShowNuevaCita(true)}
          style={{ marginLeft: "auto", background: "#0C4A6E", color: "white", display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}
        >
          <CalendarPlus size={15} />
          Agendar Cita
        </Button>
        
        <div className="paciente-card">
          <div className="paciente-avatar">
            <User size={40} />
          </div>
          <div className="paciente-info-main">
            <h1 className="paciente-nombre">{paciente?.nombre_completo || paciente?.nombre}</h1>
            <div className="paciente-datos">
              <span className="dato">
                <FileText size={14} />
                Cédula: {paciente?.cedula}
              </span>
              {paciente?.telefono && (
                <span className="dato">
                  <Phone size={14} />
                  {paciente.telefono}
                </span>
              )}
              {paciente?.email && (
                <span className="dato">
                  <Mail size={14} />
                  {paciente.email}
                </span>
              )}
              {paciente?.edad && (
                <span className="dato">
                  <Calendar size={14} />
                  {paciente.edad} años
                </span>
              )}
            </div>
          </div>
          <div className="paciente-stats">
            <div className="stat">
              <span className="stat-value">{consultas.length}</span>
              <span className="stat-label">Consultas</span>
            </div>
            <div className="stat">
              <span className="stat-value">{recetas.length}</span>
              <span className="stat-label">Recetas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de contenido */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="historia-tabs">
        <TabsList className="historia-tabs-list">
          <TabsTrigger value="consultas">
            <Stethoscope size={16} />
            Consultas
          </TabsTrigger>
          {esOdontologia && (
            <TabsTrigger value="odontograma">
              <Smile size={16} />
              Odontograma
            </TabsTrigger>
          )}
          {esOdontologia && (
            <TabsTrigger value="plan-tratamiento">
              <ClipboardList size={16} />
              Plan de Tratamiento
            </TabsTrigger>
          )}
          <TabsTrigger value="recetas">
            <Pill size={16} />
            Recetas
          </TabsTrigger>
        </TabsList>

        {/* Tab de Consultas */}
        <TabsContent value="consultas" className="tab-content-full">
          {loading ? (
            <div className="loading-state">Cargando historial...</div>
          ) : consultas.length === 0 ? (
            <div className="empty-state">
              <Stethoscope size={48} />
              <p>No hay consultas registradas</p>
            </div>
          ) : (
            <div className="consultas-grid">
              {/* Lista de consultas */}
              <div className="consultas-lista">
                <h3>Historial de Consultas</h3>
                {consultas.map((consulta) => (
                  <div
                    key={consulta.id}
                    className={`consulta-item ${selectedConsulta?.id === consulta.id ? 'selected' : ''}`}
                    onClick={() => setSelectedConsulta(consulta)}
                  >
                    <div className="consulta-fecha">
                      <Calendar size={14} />
                      {formatDate(consulta.fecha)}
                    </div>
                    <div className="consulta-info">
                      <span className="consulta-especialidad">{consulta.especialidad}</span>
                      <span className="consulta-doctor">{consulta.doctor_nombre}</span>
                    </div>
                    <div 
                      className="consulta-estado"
                      style={{ 
                        background: getEstadoBadge(consulta.estado).bg,
                        color: getEstadoBadge(consulta.estado).color
                      }}
                    >
                      {consulta.estado}
                    </div>
                    {consulta.tieneHistoria && (
                      <div className="consulta-has-historia">
                        <FileText size={14} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Detalle de consulta seleccionada */}
              <div className="consulta-detalle">
                {selectedConsulta ? (
                  <>
                    <div className="detalle-header">
                      <h3>Detalle de Consulta</h3>
                      <span className="detalle-fecha">
                        {formatDate(selectedConsulta.fecha)} - {selectedConsulta.hora}
                      </span>
                    </div>
                    
                    <div className="detalle-info">
                      <div className="info-row">
                        <span className="label">Especialidad:</span>
                        <span className="value">{selectedConsulta.especialidad}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Doctor:</span>
                        <span className="value">{selectedConsulta.doctor_nombre}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Estado:</span>
                        <span 
                          className="value badge"
                          style={{ 
                            background: getEstadoBadge(selectedConsulta.estado).bg,
                            color: getEstadoBadge(selectedConsulta.estado).color
                          }}
                        >
                          {selectedConsulta.estado}
                        </span>
                      </div>
                    </div>
                    
                    {selectedConsulta.historia ? (
                      <div className="detalle-historia">
                        <h4>Historia Clínica</h4>
                        {renderHistoriaCompleta(selectedConsulta)}
                      </div>
                    ) : (
                      <div className="sin-historia">
                        <FileText size={24} />
                        <p>Sin historia clínica registrada</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="seleccionar-consulta">
                    <Clock size={48} />
                    <p>Seleccione una consulta para ver el detalle</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab de Odontograma */}
        {esOdontologia && (
          <TabsContent value="odontograma" className="tab-content-full">
            <div className="odontograma-container-full">
              <OdontogramaClinicoTab
                token={token}
                pacienteId={paciente?.id || consultas[0]?.id}
                pacienteNombre={paciente?.nombre_completo || paciente?.nombre}
                pacienteCedula={paciente?.cedula}
                doctorId={user?.doctor_id || ""}
                onOdontogramaLoaded={(id) => setOdontogramaId(id)}
              />
            </div>
          </TabsContent>
        )}

        {/* Tab de Plan de Tratamiento */}
        {esOdontologia && (
          <TabsContent value="plan-tratamiento" className="tab-content-full">
            <PlanTratamientoTab
              token={token}
              pacienteId={paciente?.id || consultas[0]?.id}
              pacienteNombre={paciente?.nombre_completo || paciente?.nombre}
              pacienteCedula={paciente?.cedula}
              doctorId={user?.doctor_id || ""}
              odontogramaId={odontogramaId}
            />
          </TabsContent>
        )}

        {/* Tab de Recetas */}
        <TabsContent value="recetas" className="tab-content-full">
          {recetas.length === 0 ? (
            <div className="empty-state">
              <Pill size={48} />
              <p>No hay recetas registradas</p>
            </div>
          ) : (
            <div className="recetas-lista">
              <h3>Historial de Recetas</h3>
              <table className="recetas-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Doctor</th>
                    <th>Diagnóstico</th>
                    <th>Medicamentos</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {recetas.map((receta) => (
                    <tr key={receta.id}>
                      <td>{formatDate(receta.fecha)}</td>
                      <td>{receta.doctor_nombre}</td>
                      <td>{receta.diagnostico}</td>
                      <td>
                        {receta.medicamentos?.map((med, idx) => (
                          <div key={idx} className="medicamento-item">
                            <strong>{med.nombre}</strong> - {med.dosis}
                          </div>
                        ))}
                      </td>
                      <td>
                        <Button variant="ghost" size="sm">
                          <Download size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal Nueva Cita - contexto fromPatient: no pide datos del paciente ni doctor */}
      <NuevaCitaModal
        isOpen={showNuevaCita}
        onClose={() => setShowNuevaCita(false)}
        onSuccess={() => {}}
        token={token}
        user={user}
        paciente={paciente}
        fromPatient={true}
      />
    </div>
  );
};

export default HistoriaClinicaCompleta;