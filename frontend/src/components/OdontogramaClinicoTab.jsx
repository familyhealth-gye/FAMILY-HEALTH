/**
 * OdontogramaClinicoTab.jsx
 * Flujo principal de atención odontológica.
 *
 * Layout (en orden visual):
 *  1. Antecedentes (readOnly — llenados por counter)
 *  2. Diagnóstico General
 *  3. Toolbar + Odontograma interactivo (5 caras)
 *  4. Leyenda
 *  5. Acciones Rápidas (procedimientos + estados de diente)
 *  6. Plan de Tratamiento automático
 *  7. Tratamiento realizado en esta consulta
 *  8. Evolución
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { Save, Zap, Brain, ChevronDown, ChevronUp, Clock } from "lucide-react";
import "./OdontogramaClinico.css";
import { AntecedentesPanel } from "@/components/AntecedentesPanel";
import { PROCEDURE_DEFAULTS, clasificarPorSuperficies, evaluarReglas, getRecetaConAlergias } from "@/modules/dental/engine/clinical_rules";
import { useClinicalEngine } from "@/modules/dental/hooks/useClinicalEngine";
import { useTreatmentPipeline } from "@/modules/dental/hooks/useTreatmentPipeline";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ─── Constantes ──────────────────────────────────────────────────────────────

const COLORES_DIAG = {
  sano: "#FFFFFF", caries: "#EF4444", restauracion: "#3B82F6",
  endodoncia: "#8B5CF6", corona: "#F59E0B", sellante: "#10B981", fractura: "#EC4899",
};

const DIAGNOSTICOS = [
  { value: "sano",        label: "Sano",        color: "#FFFFFF" },
  { value: "caries",      label: "Caries",      color: "#EF4444" },
  { value: "restauracion",label: "Restauración",color: "#3B82F6" },
  { value: "endodoncia",  label: "Endodoncia",  color: "#8B5CF6" },
  { value: "corona",      label: "Corona",      color: "#F59E0B" },
  { value: "sellante",    label: "Sellante",    color: "#10B981" },
  { value: "fractura",    label: "Fractura",    color: "#EC4899" },
];

// Prioridad clínica para consolidar diagnóstico dominante por diente
const PRIORIDAD = { endodoncia: 5, corona: 4, fractura: 3, restauracion: 2, sellante: 1, caries: 0 };

// Precios por defecto cuando no están en el catálogo
const PRECIOS_DEFAULT = {
  "Resina Simple": 25, "Resina Compuesta": 40, "Resina Compleja": 60,
  "Extracción": 45, "Extracción Molar": 80, "Endodoncia": 180, "Corona": 250,
  "Sellante": 25, "Limpieza": 40, "Implante": 800, "Prótesis Total": 600,
  "Prótesis Parcial": 350, "Puente": 450, "Poste": 120, "Blanqueamiento": 150,
};

// Acciones rápidas unificadas (procedimientos + estados de diente)
const ACCIONES_RAPIDAS = [
  { name: "Resina Simple",    color: "#3B82F6", grupo: "restauracion" },
  { name: "Resina Compuesta", color: "#6366F1", grupo: "restauracion" },
  { name: "Resina Compleja",  color: "#8B5CF6", grupo: "restauracion" },
  { name: "Sellante",         color: "#10B981", grupo: "prevencion"   },
  { name: "Limpieza",         color: "#06B6D4", grupo: "prevencion"   },
  { name: "Extracción",       color: "#EF4444", grupo: "cirugia",  esEstado: true, estado: "extraccion" },
  { name: "Extracción Molar", color: "#DC2626", grupo: "cirugia"      },
  { name: "Endodoncia",       color: "#7C3AED", grupo: "endodoncia",  esEstado: true, estado: "endodoncia_activa" },
  { name: "Poste",            color: "#A78BFA", grupo: "endodoncia"   },
  { name: "Corona",           color: "#F59E0B", grupo: "protesis",    esEstado: true, estado: "corona_activa" },
  { name: "Puente",           color: "#D97706", grupo: "protesis"     },
  { name: "Implante",         color: "#06B6D4", grupo: "implantologia", esEstado: true, estado: "implante" },
  { name: "Prótesis Total",   color: "#F97316", grupo: "protesis"     },
  { name: "Prótesis Parcial", color: "#EA580C", grupo: "protesis"     },
  { name: "Blanqueamiento",   color: "#FCD34D", grupo: "estetica"     },
];

// ─── Subcomponente Diente SVG ─────────────────────────────────────────────────

const Diente = ({ diente, onSelectDiente, onSelectSuperficie, isSelected }) => {
  const { numero_fdi, estado, superficies } = diente;
  const esInferior = ["3","4","7","8"].includes(String(numero_fdi)[0]);
  const esPosterior = parseInt(String(numero_fdi)[1]) > 3;

  const getColor = (nombre) => {
    // Si el diente está realizado, colorear en azul
    if (estado === "realizado") return "#93C5FD";
    const s = superficies?.find(s => s.nombre === nombre);
    return COLORES_DIAG[s?.diagnostico] || "#FFFFFF";
  };

  if (estado === "ausente" || estado === "exfoliado") {
    return (
      <div className="diente-container ausente" onClick={() => onSelectDiente(diente)} style={{ cursor: "pointer" }}>
        <div className="diente-numero">{numero_fdi}</div>
        <div className="diente-grafico ausente"><span style={{ fontSize: "1.2rem" }}>✕</span></div>
      </div>
    );
  }

  return (
    <div className={`diente-container ${isSelected ? "selected" : ""}`} style={{ cursor: "pointer" }}>
      <div className="diente-numero" onClick={() => onSelectDiente(diente)}>{numero_fdi}</div>
      <svg viewBox="0 0 50 50" className="diente-svg" onClick={() => onSelectDiente(diente)}>
        {/* Vestibular */}
        <polygon points={esInferior ? "10,35 40,35 35,45 15,45" : "10,15 40,15 35,5 15,5"}
          fill={getColor("vestibular")} stroke="#374151" strokeWidth="1" className="superficie"
          onClick={e => { e.stopPropagation(); onSelectSuperficie(diente, "vestibular"); }} />
        {/* Palatino/Lingual */}
        <polygon points={esInferior ? "10,15 40,15 35,5 15,5" : "10,35 40,35 35,45 15,45"}
          fill={getColor(esInferior ? "lingual" : "palatino")} stroke="#374151" strokeWidth="1" className="superficie"
          onClick={e => { e.stopPropagation(); onSelectSuperficie(diente, esInferior ? "lingual" : "palatino"); }} />
        {/* Mesial */}
        <polygon points="5,10 15,15 15,35 5,40"
          fill={getColor("mesial")} stroke="#374151" strokeWidth="1" className="superficie"
          onClick={e => { e.stopPropagation(); onSelectSuperficie(diente, "mesial"); }} />
        {/* Distal */}
        <polygon points="45,10 35,15 35,35 45,40"
          fill={getColor("distal")} stroke="#374151" strokeWidth="1" className="superficie"
          onClick={e => { e.stopPropagation(); onSelectSuperficie(diente, "distal"); }} />
        {/* Oclusal/Incisal */}
        <polygon points="15,15 35,15 35,35 15,35"
          fill={getColor(esPosterior ? "oclusal" : "incisal")} stroke="#374151" strokeWidth="1.5" className="superficie centro"
          onClick={e => { e.stopPropagation(); onSelectSuperficie(diente, esPosterior ? "oclusal" : "incisal"); }} />
        {/* Indicadores de estado */}
        {estado === "extraccion" && <text x="25" y="30" textAnchor="middle" fill="#DC2626" fontSize="18" fontWeight="bold">X</text>}
        {estado === "implante"   && <text x="25" y="30" textAnchor="middle" fill="#06B6D4" fontSize="14" fontWeight="bold">I</text>}
        {estado === "no_erupcionado" && <circle cx="25" cy="25" r="8" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeDasharray="3,3" />}
      </svg>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const OdontogramaClinicoTab = ({
  token, pacienteId, pacienteNombre, pacienteCedula,
  doctorId, onClose, onOdontogramaLoaded, appointment,
}) => {
  // ── Estado ──────────────────────────────────────────────────────────────────
  const [odontograma,       setOdontograma]       = useState(null);
  const [loading,           setLoading]           = useState(false);
  const [tipoDenticion,     setTipoDenticion]     = useState("permanente");
  const [herramienta,       setHerramienta]       = useState("caries");
  const [dienteSeleccionado,setDienteSeleccionado]= useState(null);
  const [aiSugerencias,     setAiSugerencias]     = useState([]);

  // Diagnóstico general
  const [higieneOral,       setHigieneOral]       = useState("");
  const [estadoEncias,      setEstadoEncias]       = useState("");
  const [diagGeneral,       setDiagGeneral]       = useState("");
  const [observaciones,     setObservaciones]     = useState("");

  // Plan de tratamiento automático
  const [planAuto,          setPlanAuto]          = useState([]); // { diente, proc, precio, estado }

  // Tratamiento realizado hoy
  const [realizados,        setRealizados]        = useState([]);
  const [formRealizado,     setFormRealizado]     = useState({
    diente: "", procedimiento: "", notas: "", longitud_conducto: "", materiales: "",
  });

  // Evolución
  const [evolucion,         setEvolucion]         = useState([]);
  const [loadingEvolucion,  setLoadingEvolucion]  = useState(false);
  const [showEvolucion,     setShowEvolucion]     = useState(false);

  // Motor clínico
  const pacienteParaEngine = {
    alergias: appointment?.alergias_medicamentos || appointment?.alergias || "",
    ant_diabetes: appointment?.diabetes || false,
  };
  const { evaluateLocal, getAdjustedPrescription, requestAIAnalysis, aiLoading } =
    useClinicalEngine({ paciente: pacienteParaEngine });
  const { plan, addProcedure, updateProcedureState } = useTreatmentPipeline({
    appointmentId: appointment?.id,
    pacienteCedula: pacienteCedula || appointment?.cedula,
    appointment,
  });

  // ── Cargar precios del catálogo ──────────────────────────────────────────────
  const [preciosCatalogo, setPreciosCatalogo] = useState({});

  useEffect(() => {
    const cargarPrecios = async () => {
      try {
        const res = await axios.get(`${API}/financial/catalogo`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const mapa = {};
        (res.data || []).forEach(item => {
          if (item.nombre && item.precio) {
            mapa[item.nombre.trim()] = parseFloat(item.precio);
          }
        });
        if (Object.keys(mapa).length > 0) setPreciosCatalogo(mapa);
      } catch {}
    };
    if (token) cargarPrecios();
  }, [token]);

  // Obtener precio: catálogo primero, luego PROCEDURE_DEFAULTS, luego PRECIOS_DEFAULT
  const getPrecio = (nombre) =>
    preciosCatalogo[nombre]
    || PROCEDURE_DEFAULTS[nombre]?.precio
    || PRECIOS_DEFAULT[nombre]
    || 0;
  useEffect(() => {
    if (pacienteId || pacienteCedula) buscarOdontograma();
    else if (appointment?.id) crearOdontograma();
  }, [pacienteId, pacienteCedula, appointment?.id]);

  const buscarOdontograma = async () => {
    setLoading(true);
    try {
      let res = null;
      if (pacienteCedula) {
        try { res = await axios.get(`${API}/odontogramas-clinicos/cedula/${pacienteCedula}`, { headers: { Authorization: `Bearer ${token}` } }); } catch {}
      }
      if (!res?.data?.length && pacienteId) {
        try { res = await axios.get(`${API}/odontogramas-clinicos/paciente/${pacienteId}`, { headers: { Authorization: `Bearer ${token}` } }); } catch {}
      }
      if (res?.data?.length > 0) {
        cargarOdontogramaData(res.data[0]);
      } else {
        await crearOdontograma();
      }
    } catch {
      await crearOdontograma();
    }
    setLoading(false);
  };

  const cargarOdontogramaData = (o) => {
    setOdontograma(o);
    setTipoDenticion(o.tipo_denticion || "permanente");
    setDiagGeneral(o.diagnostico_general || "");
    setHigieneOral(o.higiene_oral || "");
    setEstadoEncias(o.estado_encias || "");
    setObservaciones(o.observaciones || "");
    if (onOdontogramaLoaded) onOdontogramaLoaded(o.id);
    // Reconstruir plan automático desde dientes guardados
    reconstruirPlanDesdeOdontograma(o);
  };

  const crearOdontograma = async () => {
    try {
      const payload = {
        paciente_id:     pacienteId || appointment?.paciente_id || "",
        paciente_nombre: pacienteNombre || appointment?.nombre_completo || "",
        paciente_cedula: pacienteCedula || appointment?.cedula || "",
        doctor_id:       doctorId || appointment?.doctor_id || "",
        doctor_nombre:   appointment?.doctor_nombre || "",
        tipo_denticion:  tipoDenticion,
      };
      const res = await axios.post(`${API}/odontogramas-clinicos`, payload, { headers: { Authorization: `Bearer ${token}` } });
      cargarOdontogramaData(res.data);
      toast.success("Odontograma creado");
    } catch (e) {
      toast.error("Error al crear odontograma: " + (e.response?.data?.detail || e.message));
    }
  };

  // Reconstruir plan de tratamiento desde dientes del odontograma
  const reconstruirPlanDesdeOdontograma = (o) => {
    const nuevoPlan = [];
    (o.dientes || []).forEach(diente => {
      const supAfectadas = (diente.superficies || []).filter(s => s.diagnostico && s.diagnostico !== "sano");
      if (supAfectadas.length === 0) return;
      const item = calcularItemPlan(diente.numero_fdi, supAfectadas);
      if (item) nuevoPlan.push(item);
    });
    setPlanAuto(nuevoPlan);
  };

  // Calcular el ítem del plan para un diente dado sus superficies afectadas
  const calcularItemPlan = (numero_fdi, supAfectadas) => {
    if (!supAfectadas.length) return null;
    const diagDominante = [...supAfectadas]
      .sort((a, b) => (PRIORIDAD[b.diagnostico] || 0) - (PRIORIDAD[a.diagnostico] || 0))[0]?.diagnostico || "caries";
    const proc = diagDominante === "endodoncia" ? "Endodoncia"
      : diagDominante === "corona"    ? "Corona"
      : diagDominante === "sellante"  ? "Sellante"
      : diagDominante === "fractura"  ? "Resina Compleja"
      : clasificarPorSuperficies(supAfectadas.length);
    const supCodigos = supAfectadas.map(s =>
      ({ vestibular:"V", palatino:"P", lingual:"L", mesial:"M", distal:"D", oclusal:"O", incisal:"I" })[s.nombre] || "?"
    ).join("");
    const precio = getPrecio(proc);
    return {
      id: `plan-${numero_fdi}`,
      diente: String(numero_fdi), procedimiento: proc,
      superficies: supCodigos, precio,
      estado: "pendiente", diagnostico: diagDominante,
    };
  };

  // ── Aplicar diagnóstico a superficie ────────────────────────────────────────
  const aplicarDiagnosticoSuperficie = async (diente, nombreSuperficie, diagnostico) => {
    if (!odontograma?.id) { toast.error("Odontograma no cargado"); return; }
    try {
      await axios.put(
        `${API}/odontogramas-clinicos/${odontograma.id}/diente/${diente.numero_fdi}/superficie/${nombreSuperficie}`,
        { diagnostico }, { headers: { Authorization: `Bearer ${token}` } }
      );
      // Actualizar estado local
      const copia = {
        ...odontograma,
        dientes: odontograma.dientes.map(d =>
          d.numero_fdi !== diente.numero_fdi ? d : {
            ...d,
            superficies: d.superficies.map(s =>
              s.nombre === nombreSuperficie ? { ...s, diagnostico } : s
            ),
          }
        ),
      };
      setOdontograma(copia);

      // Recalcular plan para este diente
      const dienteActual = copia.dientes.find(d => d.numero_fdi === diente.numero_fdi);
      const supAfectadas = (dienteActual?.superficies || []).filter(s => s.diagnostico && s.diagnostico !== "sano");

      if (supAfectadas.length > 0) {
        const item = calcularItemPlan(diente.numero_fdi, supAfectadas);
        setPlanAuto(prev => {
          const sinEste = prev.filter(p => p.diente !== String(diente.numero_fdi));
          return item ? [...sinEste, item] : sinEste;
        });
        // Pre-seleccionar diente en formulario "realizado"
        setFormRealizado(f => ({ ...f, diente: String(diente.numero_fdi), procedimiento: item?.procedimiento || "" }));

        // Sugerencias motor clínico
        if (supAfectadas.length >= 2) {
          const proc = item?.procedimiento || "";
          setAiSugerencias([{
            tipo: "info",
            texto: `${supAfectadas.length} superficies afectadas → ${proc} recomendado`,
            procedimientos_alternativos: supAfectadas.length >= 4 ? ["Corona"] : supAfectadas.length === 3 ? ["Resina Compleja"] : [],
            diente_numero: String(diente.numero_fdi),
          }]);
        }
      } else {
        // Sano — quitar del plan
        setPlanAuto(prev => prev.filter(p => p.diente !== String(diente.numero_fdi)));
        setAiSugerencias(prev => prev.filter(s => s.diente_numero !== String(diente.numero_fdi)));
      }
    } catch (e) {
      toast.error(`Error al marcar superficie: ${e.response?.data?.detail || e.message}`);
    }
  };

  // ── Aplicar acción rápida a diente seleccionado ──────────────────────────────
  const aplicarAccionRapida = async (accion) => {
    const dNum = dienteSeleccionado?.numero_fdi;
    const precio = getPrecio(accion.name);

    // Si tiene estado asociado, marcarlo en el diente
    if (accion.esEstado && dNum && odontograma?.id) {
      try {
        await axios.put(
          `${API}/odontogramas-clinicos/${odontograma.id}/diente/${dNum}`,
          { estado: accion.estado },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const copia = {
          ...odontograma,
          dientes: odontograma.dientes.map(d =>
            d.numero_fdi !== dNum ? d : { ...d, estado: accion.estado }
          ),
        };
        setOdontograma(copia);
        setDienteSeleccionado(prev => prev ? { ...prev, estado: accion.estado } : prev);
      } catch {}
    }

    // Agregar al plan (reemplazando si ya existe para este diente)
    const itemNuevo = {
      id: dNum ? `plan-${dNum}` : `plan-rapido-${Date.now()}`,
      diente: String(dNum || "General"),
      procedimiento: accion.name, superficies: "",
      precio, estado: "pendiente",
    };
    if (dNum) {
      setPlanAuto(prev => {
        const sinEste = prev.filter(p => p.diente !== String(dNum));
        return [...sinEste, itemNuevo];
      });
    } else {
      setPlanAuto(prev => [...prev, itemNuevo]);
    }

    // Pre-cargar en formulario de realizado
    setFormRealizado(f => ({ ...f, diente: String(dNum || ""), procedimiento: accion.name }));

    // Motor clínico — receta
    try {
      const receta = getAdjustedPrescription(accion.name);
      if (receta?.length > 0) toast.info(`Receta: ${receta.map(r => r.nombre).join(", ")}`);
    } catch {}

    // Limpiar sugerencias de IA para este diente
    if (dNum) setAiSugerencias(prev => prev.filter(s => s.diente_numero !== String(dNum)));
  };

  // ── Guardar diagnóstico general ──────────────────────────────────────────────
  const guardarDiagnosticoGeneral = async () => {
    if (!odontograma) return;
    try {
      await axios.put(`${API}/odontogramas-clinicos/${odontograma.id}`,
        { diagnostico_general: diagGeneral, higiene_oral: higieneOral, estado_encias: estadoEncias, observaciones },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Diagnóstico general guardado");
    } catch { toast.error("Error al guardar"); }
  };

  // ── Marcar procedimiento del plan como realizado ─────────────────────────────
  const marcarRealizado = (planId) => {
    const item = planAuto.find(p => p.id === planId);
    if (!item) return;
    setPlanAuto(prev => prev.map(p => p.id === planId ? { ...p, estado: "realizado" } : p));
    // Agregar a realizados hoy
    setRealizados(prev => [...prev, { ...item, id: Date.now(), fecha: new Date().toLocaleDateString("es-EC") }]);
    // Marcar diente como realizado en el SVG
    if (item.diente && item.diente !== "General" && odontograma) {
      setOdontograma(prev => ({
        ...prev,
        dientes: prev.dientes.map(d =>
          d.numero_fdi === item.diente ? { ...d, estado: "realizado" } : d
        ),
      }));
    }
  };

  // ── Registrar tratamiento realizado manualmente ──────────────────────────────
  const agregarRealizado = () => {
    if (!formRealizado.diente && !formRealizado.procedimiento) {
      toast.error("Seleccione diente y procedimiento"); return;
    }
    const nuevo = {
      id: Date.now(),
      diente: formRealizado.diente,
      procedimiento: formRealizado.procedimiento,
      notas: formRealizado.notas,
      longitud_conducto: formRealizado.longitud_conducto,
      materiales: formRealizado.materiales,
      fecha: new Date().toLocaleDateString("es-EC"),
      hora: new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
    };
    setRealizados(prev => [...prev, nuevo]);
    setFormRealizado({ diente: "", procedimiento: "", notas: "", longitud_conducto: "", materiales: "" });
    // Marcar en el SVG si hay diente
    if (nuevo.diente && odontograma) {
      setOdontograma(prev => ({
        ...prev,
        dientes: prev.dientes.map(d =>
          d.numero_fdi === nuevo.diente ? { ...d, estado: "realizado" } : d
        ),
      }));
    }
  };

  // ── Cargar evolución previa ──────────────────────────────────────────────────
  const cargarEvolucion = async () => {
    if (!odontograma?.id) return;
    setLoadingEvolucion(true);
    try {
      const res = await axios.get(`${API}/odontogramas-clinicos/${odontograma.id}/evolucion`,
        { headers: { Authorization: `Bearer ${token}` } });
      setEvolucion(Array.isArray(res.data) ? res.data : []);
    } catch { setEvolucion([]); }
    setLoadingEvolucion(false);
  };

  // ── Organizar dientes en arcos ───────────────────────────────────────────────
  const organizarDientes = () => {
    if (!odontograma?.dientes) return { superior: [], inferior: [] };
    const d = odontograma.dientes;
    return {
      superior: [
        ...d.filter(x => x.cuadrante === 1).sort((a, b) => a.posicion - b.posicion),
        ...d.filter(x => x.cuadrante === 2).sort((a, b) => a.posicion - b.posicion),
      ],
      inferior: [
        ...d.filter(x => x.cuadrante === 4).sort((a, b) => a.posicion - b.posicion),
        ...d.filter(x => x.cuadrante === 3).sort((a, b) => a.posicion - b.posicion),
      ],
    };
  };

  const { superior, inferior } = organizarDientes();

  // ── Estilos compartidos ──────────────────────────────────────────────────────
  const sCard = { marginBottom: "16px", padding: "16px", background: "#F8FAFF", border: "1px solid #BFDBFE", borderRadius: "12px" };
  const sTitle = { margin: "0 0 12px", fontSize: "14px", fontWeight: "700", color: "#0C4A6E", display: "flex", alignItems: "center", gap: "6px" };
  const sInput = { width: "100%", padding: "8px 10px", border: "1.5px solid #BFDBFE", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", outline: "none" };
  const sLabel = { fontSize: "11px", fontWeight: "700", color: "#374151", display: "block", marginBottom: "3px", textTransform: "uppercase" };
  const sRow2  = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" };

  // ── Estados de carga ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: "40px", textAlign: "center", color: "#6B7280" }}>
      <div style={{ fontSize: "14px" }}>Cargando odontograma...</div>
    </div>
  );

  if (!odontograma?.dientes?.length) return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <p style={{ color: "#6B7280", marginBottom: "16px" }}>
        {pacienteNombre || appointment?.nombre_completo || "Paciente nuevo"}
      </p>
      <Button onClick={crearOdontograma} style={{ background: "#0C4A6E", color: "white", padding: "12px 28px" }}>
        Iniciar Odontograma
      </Button>
    </div>
  );

  // ── RENDER PRINCIPAL ─────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "12px", maxWidth: "100%", background: "white" }}>

      {/* ══ 1. ANTECEDENTES ════════════════════════════════════════════════ */}
      {(appointment?.cedula || pacienteCedula) && (
        <div style={{ marginBottom: "12px" }}>
          <AntecedentesPanel
            cedula={appointment?.cedula || pacienteCedula}
            token={token} especialidad="Odontología"
            readOnly={true} onLoad={() => {}}
          />
        </div>
      )}

      {/* ══ 2. DIAGNÓSTICO GENERAL ═════════════════════════════════════════ */}
      <div style={sCard}>
        <h3 style={sTitle}>🩺 Diagnóstico General</h3>
        <div style={{ ...sRow2, marginBottom: "10px" }}>
          <div>
            <label style={sLabel}>Higiene Oral</label>
            <select value={higieneOral} onChange={e => setHigieneOral(e.target.value)} style={sInput}>
              <option value="">Seleccione...</option>
              {["Excelente","Buena","Regular","Mala","Muy mala"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={sLabel}>Estado de Encías</label>
            <select value={estadoEncias} onChange={e => setEstadoEncias(e.target.value)} style={sInput}>
              <option value="">Seleccione...</option>
              {["Sanas","Gingivitis leve","Gingivitis moderada","Periodontitis leve","Periodontitis avanzada"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label style={sLabel}>Diagnóstico General</label>
          <textarea value={diagGeneral} onChange={e => setDiagGeneral(e.target.value)}
            placeholder="Describa el diagnóstico general del paciente..."
            style={{ ...sInput, minHeight: "60px", resize: "vertical" }} />
        </div>
        <div style={{ marginBottom: "10px" }}>
          <label style={sLabel}>Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
            placeholder="Observaciones adicionales..."
            style={{ ...sInput, minHeight: "44px", resize: "vertical" }} />
        </div>
        <button onClick={guardarDiagnosticoGeneral}
          style={{ padding: "7px 16px", background: "#0C4A6E", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
          <Save size={12} /> Guardar
        </button>
      </div>

      {/* ══ 3. TOOLBAR + ODONTOGRAMA ══════════════════════════════════════ */}
      <div style={{ ...sCard, background: "white" }}>
        {/* Selector de tipo de dentición */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "10px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748B" }}>Dentición:</span>
          {[
            { value: "permanente", label: "Permanente (adulto)" },
            { value: "temporal",   label: "Decidua (niño)"      },
            { value: "mixta",      label: "Mixta"               },
          ].map(op => (
            <button key={op.value} onClick={async () => {
              setTipoDenticion(op.value);
              // Actualizar en backend si hay odontograma
              if (odontograma?.id) {
                try {
                  await axios.put(`${API}/odontogramas-clinicos/${odontograma.id}`,
                    { tipo_denticion: op.value },
                    { headers: { Authorization: `Bearer ${token}` } });
                } catch {}
              }
            }}
              style={{
                padding: "4px 10px", borderRadius: "12px", border: "1.5px solid",
                borderColor: tipoDenticion === op.value ? "#0C4A6E" : "#CBD5E1",
                background: tipoDenticion === op.value ? "#0C4A6E" : "white",
                color: tipoDenticion === op.value ? "white" : "#374151",
                fontSize: "11px", fontWeight: "600", cursor: "pointer",
              }}>
              {op.label}
            </button>
          ))}
        </div>

        {/* Toolbar: selector de diagnóstico */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", marginRight: "4px" }}>Diagnóstico:</span>
          {DIAGNOSTICOS.map(d => (
            <button key={d.value} onClick={() => setHerramienta(d.value)}
              style={{
                padding: "4px 10px", borderRadius: "14px", border: `2px solid ${d.color === "#FFFFFF" ? "#D1D5DB" : d.color}`,
                background: herramienta === d.value ? d.color : "white",
                color: herramienta === d.value && d.color !== "#FFFFFF" ? "white" : "#374151",
                fontSize: "11px", fontWeight: "700", cursor: "pointer",
                boxShadow: herramienta === d.value ? "0 2px 6px rgba(0,0,0,0.2)" : "none",
              }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Arco Superior */}
        <div style={{ marginBottom: "4px" }}>
          <div style={{ fontSize: "9px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px", textAlign: "center" }}>Superior</div>
          <div style={{ display: "flex", justifyContent: "center", gap: "2px", overflowX: "auto", paddingBottom: "4px" }}>
            {superior.map(d => (
              <Diente key={d.numero_fdi} diente={d}
                isSelected={dienteSeleccionado?.numero_fdi === d.numero_fdi}
                onSelectDiente={setDienteSeleccionado}
                onSelectSuperficie={(diente, sup) => aplicarDiagnosticoSuperficie(diente, sup, herramienta)}
              />
            ))}
          </div>
        </div>

        {/* Línea divisoria */}
        <div style={{ border: "none", borderTop: "1px dashed #CBD5E1", margin: "6px 0" }} />

        {/* Arco Inferior */}
        <div>
          <div style={{ display: "flex", justifyContent: "center", gap: "2px", overflowX: "auto", paddingBottom: "4px" }}>
            {inferior.map(d => (
              <Diente key={d.numero_fdi} diente={d}
                isSelected={dienteSeleccionado?.numero_fdi === d.numero_fdi}
                onSelectDiente={setDienteSeleccionado}
                onSelectSuperficie={(diente, sup) => aplicarDiagnosticoSuperficie(diente, sup, herramienta)}
              />
            ))}
          </div>
          <div style={{ fontSize: "9px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "4px", textAlign: "center" }}>Inferior</div>
        </div>
      </div>

      {/* ══ 4. LEYENDA ════════════════════════════════════════════════════ */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px", padding: "8px 12px", background: "#F9FAFB", borderRadius: "8px" }}>
        {DIAGNOSTICOS.map(d => (
          <div key={d.value} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#374151" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: d.color, border: "1px solid #D1D5DB", flexShrink: 0 }} />
            {d.label}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#374151" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#93C5FD", border: "1px solid #D1D5DB", flexShrink: 0 }} />
          Realizado
        </div>
      </div>

      {/* ══ 5. ACCIONES RÁPIDAS ═══════════════════════════════════════════ */}
      <div style={sCard}>
        <h3 style={sTitle}>
          <Zap size={14} color="#F59E0B" fill="#F59E0B" />
          {dienteSeleccionado ? `Acciones Rápidas → Diente ${dienteSeleccionado.numero_fdi}` : "Acciones Rápidas"}
          {!dienteSeleccionado && <span style={{ fontSize: "10px", fontWeight: "400", color: "#94A3B8" }}>(seleccione un diente primero)</span>}
        </h3>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: aiSugerencias.length > 0 ? "10px" : "0" }}>
          {ACCIONES_RAPIDAS.map(accion => (
            <button key={accion.name} onClick={() => aplicarAccionRapida(accion)}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                padding: "5px 10px", border: `1.5px solid ${dienteSeleccionado ? accion.color : "#E2E8F0"}`,
                borderRadius: "20px", background: "white", cursor: dienteSeleccionado ? "pointer" : "default",
                fontSize: "11px", fontWeight: "700", color: dienteSeleccionado ? "#374151" : "#94A3B8",
                opacity: dienteSeleccionado ? 1 : 0.6,
              }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: accion.color, flexShrink: 0 }} />
              {accion.name}
              <span style={{ fontSize: "9px", color: "#94A3B8" }}>${getPrecio(accion.name)}</span>
            </button>
          ))}
          <button
            onClick={async () => {
              if (!odontograma || !dienteSeleccionado) return;
              const sugs = await requestAIAnalysis("tratamiento", {
                diente: dienteSeleccionado.numero_fdi,
                superficies: dienteSeleccionado.superficies?.filter(s => s.diagnostico && s.diagnostico !== "sano").map(s => s.nombre),
                paciente: { alergias: appointment?.alergias_medicamentos || "" },
              });
              if (sugs?.sugerencias) setAiSugerencias(sugs.sugerencias.map(s => ({ tipo: "info", texto: s, diente_numero: String(dienteSeleccionado.numero_fdi) })));
            }}
            disabled={aiLoading || !dienteSeleccionado}
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", border: "1.5px solid #DDD6FE", borderRadius: "20px", background: "#F5F3FF", cursor: "pointer", fontSize: "11px", fontWeight: "700", color: "#7C3AED" }}>
            <Brain size={11} /> {aiLoading ? "..." : "✦ IA"}
          </button>
        </div>

        {/* Sugerencias */}
        {aiSugerencias.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "8px" }}>
            {aiSugerencias.map((s, i) => (
              <div key={i} style={{
                padding: "7px 10px", borderRadius: "8px", fontSize: "11px",
                background: s.tipo === "danger" ? "#FEF2F2" : s.tipo === "warning" ? "#FFFBEB" : "#EFF6FF",
                border: `1px solid ${s.tipo === "danger" ? "#FCA5A5" : s.tipo === "warning" ? "#FDE68A" : "#BFDBFE"}`,
                color: s.tipo === "danger" ? "#DC2626" : s.tipo === "warning" ? "#92400E" : "#1E40AF",
              }}>
                {s.tipo === "danger" ? "⚠️" : "💡"} {s.texto}
                {s.procedimientos_alternativos?.length > 0 && (
                  <div style={{ marginTop: "4px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {s.procedimientos_alternativos.map(proc => (
                      <button key={proc}
                        onClick={() => {
                          const dNum = s.diente_numero || dienteSeleccionado?.numero_fdi;
                          const precio = getPrecio(proc);
                          // REEMPLAZA el ítem del plan para este diente
                          setPlanAuto(prev => {
                            const sinEste = prev.filter(p => p.diente !== String(dNum));
                            return [...sinEste, { id: `plan-${dNum}`, diente: String(dNum), procedimiento: proc, superficies: "", precio, estado: "pendiente" }];
                          });
                          setAiSugerencias(sgs => sgs.filter((_, j) => j !== i));
                          toast.success(`${proc} agregado al plan — reemplaza tratamiento anterior`);
                        }}
                        style={{ padding: "2px 8px", background: "#0C4A6E", color: "white", border: "none", borderRadius: "10px", fontSize: "10px", cursor: "pointer", fontWeight: "700" }}>
                        + {proc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ 6. PLAN DE TRATAMIENTO ════════════════════════════════════════ */}
      <div style={sCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ ...sTitle, margin: 0 }}>📋 Plan de Tratamiento</h3>
          <div style={{ fontSize: "13px", fontWeight: "700", color: "#059669" }}>
            Total: ${planAuto.filter(p => p.estado === "pendiente").reduce((s, p) => s + (parseFloat(p.precio) || 0), 0).toFixed(2)}
          </div>
        </div>

        {planAuto.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", padding: "12px" }}>
            El plan se genera automáticamente al marcar dientes en el odontograma
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {planAuto.map(item => {
              const realizado = item.estado === "realizado";
              return (
                <div key={item.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", background: "white", borderRadius: "8px",
                  border: `1.5px solid ${realizado ? "#BFDBFE" : "#FCA5A5"}`,
                  borderLeft: `4px solid ${realizado ? "#3B82F6" : "#EF4444"}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: "700", fontSize: "13px", color: realizado ? "#1E40AF" : "#0C4A6E" }}>
                      {item.procedimiento}
                    </span>
                    <span style={{ fontSize: "11px", color: "#6B7280", marginLeft: "8px" }}>D{item.diente}</span>
                    {item.superficies && <span style={{ fontSize: "10px", color: "#94A3B8", marginLeft: "4px" }}>[{item.superficies}]</span>}
                    <span style={{
                      marginLeft: "8px", fontSize: "10px", fontWeight: "700", padding: "1px 6px",
                      borderRadius: "10px", background: realizado ? "#DBEAFE" : "#FEE2E2",
                      color: realizado ? "#1D4ED8" : "#DC2626",
                    }}>
                      {realizado ? "✓ Realizado" : "● Pendiente"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <span style={{ fontWeight: "700", color: "#059669", fontSize: "13px" }}>${parseFloat(item.precio || 0).toFixed(2)}</span>
                    {!realizado && (
                      <button onClick={() => marcarRealizado(item.id)}
                        style={{ padding: "3px 8px", background: "#DBEAFE", border: "none", borderRadius: "6px", fontSize: "10px", cursor: "pointer", fontWeight: "700", color: "#1D4ED8" }}>
                        ✓ Realizado
                      </button>
                    )}
                    <button onClick={() => setPlanAuto(prev => prev.filter(p => p.id !== item.id))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "16px" }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ 7. TRATAMIENTO REALIZADO HOY ════════════════════════════════ */}
      <div style={sCard}>
        <h3 style={sTitle}>🦷 Tratamiento Realizado en Esta Consulta</h3>

        {/* Formulario de registro */}
        <div style={{ background: "white", border: "1px solid #E0EDFF", borderRadius: "10px", padding: "12px", marginBottom: "12px" }}>
          <div style={{ ...sRow2, marginBottom: "8px" }}>
            <div>
              <label style={sLabel}>Diente</label>
              <select value={formRealizado.diente} onChange={e => setFormRealizado(f => ({ ...f, diente: e.target.value }))} style={sInput}>
                <option value="">Seleccione...</option>
                {(odontograma?.dientes || []).map(d => (
                  <option key={d.numero_fdi} value={d.numero_fdi}>D{d.numero_fdi}</option>
                ))}
                <option value="General">General (sin diente específico)</option>
              </select>
            </div>
            <div>
              <label style={sLabel}>Procedimiento</label>
              <select value={formRealizado.procedimiento} onChange={e => setFormRealizado(f => ({ ...f, procedimiento: e.target.value }))} style={sInput}>
                <option value="">Seleccione...</option>
                {ACCIONES_RAPIDAS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ ...sRow2, marginBottom: "8px" }}>
            <div>
              <label style={sLabel}>Longitud de conducto</label>
              <input value={formRealizado.longitud_conducto}
                onChange={e => setFormRealizado(f => ({ ...f, longitud_conducto: e.target.value }))}
                placeholder="Ej: 21mm — solo si aplica" style={sInput} />
            </div>
            <div>
              <label style={sLabel}>Materiales utilizados</label>
              <input value={formRealizado.materiales}
                onChange={e => setFormRealizado(f => ({ ...f, materiales: e.target.value }))}
                placeholder="Ej: MTA, Biodentine..." style={sInput} />
            </div>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <label style={sLabel}>Notas operatorias</label>
            <textarea value={formRealizado.notas}
              onChange={e => setFormRealizado(f => ({ ...f, notas: e.target.value }))}
              placeholder="Observaciones del procedimiento..."
              style={{ ...sInput, minHeight: "44px", resize: "vertical" }} />
          </div>
          <button onClick={agregarRealizado}
            style={{ padding: "7px 14px", background: "#0369A1", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
            + Registrar
          </button>
        </div>

        {/* Lista de realizados hoy */}
        {realizados.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", padding: "8px" }}>Sin procedimientos registrados en esta consulta</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {realizados.map((r, i) => (
              <div key={r.id} style={{ padding: "8px 12px", background: "#EFF6FF", borderRadius: "8px", border: "1px solid #BFDBFE", borderLeft: "4px solid #3B82F6" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: "700", fontSize: "13px", color: "#1E40AF" }}>
                    {r.procedimiento} — D{r.diente}
                  </span>
                  <span style={{ fontSize: "11px", color: "#94A3B8" }}>{r.hora}</span>
                </div>
                {r.longitud_conducto && <div style={{ fontSize: "11px", color: "#374151", marginTop: "2px" }}>Longitud: {r.longitud_conducto}</div>}
                {r.materiales && <div style={{ fontSize: "11px", color: "#374151" }}>Materiales: {r.materiales}</div>}
                {r.notas && <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>{r.notas}</div>}
                <button onClick={() => setRealizados(prev => prev.filter((_, j) => j !== i))}
                  style={{ marginTop: "4px", fontSize: "10px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer" }}>Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ 8. EVOLUCIÓN ═════════════════════════════════════════════════ */}
      <div style={sCard}>
        <button
          onClick={() => { setShowEvolucion(s => !s); if (!showEvolucion) cargarEvolucion(); }}
          style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ ...sTitle, margin: 0 }}>
            <Clock size={14} color="#0C4A6E" /> Evolución del Paciente
          </h3>
          {showEvolucion ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
        </button>

        {showEvolucion && (
          <div style={{ marginTop: "12px" }}>
            {loadingEvolucion ? (
              <p style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center" }}>Cargando historial...</p>
            ) : evolucion.length === 0 ? (
              <p style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center" }}>Sin historial de evolución previo</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {evolucion.map((ev, i) => (
                  <div key={i} style={{ padding: "10px 12px", background: "white", borderRadius: "8px", border: "1px solid #E0EDFF" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontWeight: "700", fontSize: "12px", color: "#0C4A6E" }}>{ev.profesional || ev.doctor_nombre || "Profesional"}</span>
                      <span style={{ fontSize: "11px", color: "#94A3B8" }}>{ev.fecha}</span>
                    </div>
                    {ev.procedimiento && <div style={{ fontSize: "12px", color: "#374151" }}>🦷 {ev.procedimiento}</div>}
                    {ev.observaciones && <div style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>{ev.observaciones}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default OdontogramaClinicoTab;
