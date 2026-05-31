import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { Save, User, Zap, Brain } from "lucide-react";
import "./OdontogramaClinico.css";

// ── Motor clínico extraído del V2 ────────────────────────────────────────────
import { PROCEDURE_DEFAULTS, clasificarPorSuperficies, evaluarReglas, getRecetaConAlergias } from "@/modules/dental/engine/clinical_rules";
import { useClinicalEngine } from "@/modules/dental/hooks/useClinicalEngine";
import { useTreatmentPipeline } from "@/modules/dental/hooks/useTreatmentPipeline";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Procedimientos rápidos con precios del motor clínico
const QUICK_PROCEDURES = [
  { name: "Resina Simple",    color: "#3B82F6" },
  { name: "Resina Compuesta", color: "#6366F1" },
  { name: "Resina Compleja",  color: "#8B5CF6" },
  { name: "Extracción",       color: "#EF4444" },
  { name: "Endodoncia",       color: "#7C3AED" },
  { name: "Corona",           color: "#F59E0B" },
  { name: "Sellante",         color: "#10B981" },
  { name: "Limpieza",         color: "#06B6D4" },
];

// Colores para diagnósticos
const COLORES_DIAGNOSTICO = {
  sano: "#FFFFFF",
  caries: "#EF4444",        // Rojo
  restauracion: "#3B82F6",  // Azul
  endodoncia: "#8B5CF6",    // Violeta
  corona: "#F59E0B",        // Amarillo/Naranja
  sellante: "#10B981",      // Verde
  fractura: "#EC4899"       // Rosa
};

// Estados del diente completo
const ESTADOS_DIENTE = [
  { value: "presente", label: "Presente", color: "#FFFFFF" },
  { value: "ausente", label: "Ausente", color: "#1F2937" },
  { value: "extraccion", label: "Para Extracción", color: "#DC2626" },
  { value: "no_erupcionado", label: "No Erupcionado", color: "#9CA3AF" },
  { value: "exfoliado", label: "Exfoliado", color: "#D1D5DB" },
  { value: "implante", label: "Implante", color: "#06B6D4" },
  { value: "protesis", label: "Prótesis", color: "#F97316" }
];

// Diagnósticos por superficie
const DIAGNOSTICOS = [
  { value: "sano", label: "Sano", color: "#FFFFFF" },
  { value: "caries", label: "Caries", color: "#EF4444" },
  { value: "restauracion", label: "Restauración", color: "#3B82F6" },
  { value: "endodoncia", label: "Endodoncia", color: "#8B5CF6" },
  { value: "corona", label: "Corona", color: "#F59E0B" },
  { value: "sellante", label: "Sellante", color: "#10B981" },
  { value: "fractura", label: "Fractura", color: "#EC4899" }
];

// Componente de diente individual con superficies clickeables
const Diente = ({ diente, onSelectDiente, onSelectSuperficie, isSelected, herramientaActual }) => {
  const { numero_fdi, estado, superficies, tipo } = diente;
  
  const esPosterior = parseInt(numero_fdi[1]) > 3;
  const esInferior = ['3', '4', '7', '8'].includes(numero_fdi[0]);
  
  // Obtener colores de superficies
  const getSuperficieColor = (nombreSuperficie) => {
    const sup = superficies?.find(s => s.nombre === nombreSuperficie);
    if (!sup) return "#FFFFFF";
    return COLORES_DIAGNOSTICO[sup.diagnostico] || "#FFFFFF";
  };
  
  // Renderizar diente según estado
  if (estado === "ausente" || estado === "exfoliado") {
    return (
      <div 
        className="diente-container ausente"
        onClick={() => onSelectDiente(diente)}
        style={{ cursor: 'pointer' }}
      >
        <div className="diente-numero">{numero_fdi}</div>
        <div className="diente-grafico ausente">
          <span style={{ fontSize: '1.5rem' }}>✕</span>
        </div>
      </div>
    );
  }
  
  if (estado === "implante") {
    return (
      <div 
        className="diente-container implante"
        onClick={() => onSelectDiente(diente)}
        style={{ cursor: 'pointer' }}
      >
        <div className="diente-numero">{numero_fdi}</div>
        <div className="diente-grafico implante">
          <span style={{ fontSize: '1.2rem' }}>⬡</span>
        </div>
      </div>
    );
  }
  
  // Diente normal con superficies
  return (
    <div 
      className={`diente-container ${isSelected ? 'selected' : ''} ${tipo}`}
      style={{ cursor: 'pointer' }}
    >
      <div className="diente-numero" onClick={() => onSelectDiente(diente)}>
        {numero_fdi}
      </div>
      <svg 
        viewBox="0 0 50 50" 
        className="diente-svg"
        onClick={() => onSelectDiente(diente)}
      >
        {/* Superficie vestibular (arriba para superiores, abajo para inferiores) */}
        <polygon
          points={esInferior ? "10,35 40,35 35,45 15,45" : "10,15 40,15 35,5 15,5"}
          fill={getSuperficieColor("vestibular")}
          stroke="#374151"
          strokeWidth="1"
          className="superficie"
          onClick={(e) => { e.stopPropagation(); onSelectSuperficie(diente, "vestibular"); }}
        />
        
        {/* Superficie palatina/lingual (abajo para superiores, arriba para inferiores) */}
        <polygon
          points={esInferior ? "10,15 40,15 35,5 15,5" : "10,35 40,35 35,45 15,45"}
          fill={getSuperficieColor(esInferior ? "lingual" : "palatino")}
          stroke="#374151"
          strokeWidth="1"
          className="superficie"
          onClick={(e) => { e.stopPropagation(); onSelectSuperficie(diente, esInferior ? "lingual" : "palatino"); }}
        />
        
        {/* Superficie mesial (izquierda) */}
        <polygon
          points="5,10 15,15 15,35 5,40"
          fill={getSuperficieColor("mesial")}
          stroke="#374151"
          strokeWidth="1"
          className="superficie"
          onClick={(e) => { e.stopPropagation(); onSelectSuperficie(diente, "mesial"); }}
        />
        
        {/* Superficie distal (derecha) */}
        <polygon
          points="45,10 35,15 35,35 45,40"
          fill={getSuperficieColor("distal")}
          stroke="#374151"
          strokeWidth="1"
          className="superficie"
          onClick={(e) => { e.stopPropagation(); onSelectSuperficie(diente, "distal"); }}
        />
        
        {/* Superficie oclusal/incisal (centro) */}
        <polygon
          points="15,15 35,15 35,35 15,35"
          fill={getSuperficieColor(esPosterior ? "oclusal" : "incisal")}
          stroke="#374151"
          strokeWidth="1.5"
          className="superficie centro"
          onClick={(e) => { e.stopPropagation(); onSelectSuperficie(diente, esPosterior ? "oclusal" : "incisal"); }}
        />
        
        {/* Indicador de estado especial */}
        {estado === "extraccion" && (
          <text x="25" y="28" textAnchor="middle" fill="#DC2626" fontSize="16" fontWeight="bold">X</text>
        )}
        {estado === "no_erupcionado" && (
          <circle cx="25" cy="25" r="8" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeDasharray="3,3" />
        )}
      </svg>
    </div>
  );
};

export const OdontogramaClinicoTab = ({ token, pacienteId, pacienteNombre, pacienteCedula, doctorId, onClose, onOdontogramaLoaded, appointment }) => {
  const [odontograma, setOdontograma] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tipoDenticion, setTipoDenticion] = useState("permanente");
  const [dienteSeleccionado, setDienteSeleccionado] = useState(null);
  const [superficieSeleccionada, setSuperficieSeleccionada] = useState(null);
  const [herramientaActual, setHerramientaActual] = useState("sano");
  const [modoEdicion, setModoEdicion] = useState("superficie");
  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false);
  const [diagnosticoGeneral, setDiagnosticoGeneral] = useState("");
  const [higieneOral, setHigieneOral] = useState("");
  const [estadoEncias, setEstadoEncias] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [tratamientos, setTratamientos] = useState([]);
  const [nuevoTratamiento, setNuevoTratamiento] = useState({ descripcion: "", diente: "", precio: "" });
  const [generandoProforma, setGenerandoProforma] = useState(false);
  const [aiSugerencias, setAiSugerencias] = useState([]);

  // ── Motor clínico V2 integrado ────────────────────────────────────────────
  const pacienteParaEngine = {
    alergias: appointment?.alergias_medicamentos || appointment?.alergias || "",
    ant_diabetes: appointment?.diabetes || false,
  };
  const { evaluateLocal, getProcedureDefaults, getAdjustedPrescription, requestAIAnalysis, aiLoading } =
    useClinicalEngine({ paciente: pacienteParaEngine });

  // ── Plan de tratamiento (pipeline V2) ─────────────────────────────────────
  const { plan, addProcedure, updateProcedureState, totals } = useTreatmentPipeline({
    appointmentId:   appointment?.id,
    pacienteCedula:  pacienteCedula || appointment?.cedula,
    appointment,
  });

  useEffect(() => {
    if (pacienteId || pacienteCedula) {
      buscarOdontogramaExistente();
    }
  }, [pacienteId, pacienteCedula]);

  const buscarOdontogramaExistente = async () => {
    setLoading(true);
    try {
      let response = null;
      
      // Primero intentar buscar por cédula (más confiable)
      if (pacienteCedula) {
        try {
          response = await axios.get(
            `${API}/odontogramas-clinicos/cedula/${pacienteCedula}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) {
          console.log("No se encontró odontograma por cédula, intentando por ID");
        }
      }
      
      // Si no encontró por cédula, buscar por pacienteId
      if ((!response || !response.data || response.data.length === 0) && pacienteId) {
        response = await axios.get(
          `${API}/odontogramas-clinicos/paciente/${pacienteId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      if (response?.data && response.data.length > 0) {
        // Usar el odontograma más reciente
        const ultimoOdontograma = response.data[0];
        setOdontograma(ultimoOdontograma);
        setTipoDenticion(ultimoOdontograma.tipo_denticion || "permanente");
        setDiagnosticoGeneral(ultimoOdontograma.diagnostico_general || "");
        setHigieneOral(ultimoOdontograma.higiene_oral || "");
        setEstadoEncias(ultimoOdontograma.estado_encias || "");
        setObservaciones(ultimoOdontograma.observaciones || "");
        // Notificar al padre que se cargó el odontograma
        if (onOdontogramaLoaded) {
          onOdontogramaLoaded(ultimoOdontograma.id);
        }
      } else {
        // Antes de crear, verificar si existe odontograma en formato legacy
        let legacyFound = false;
        if (pacienteCedula) {
          try {
            const legacyRes = await axios.get(
              `${API}/odontogramas-clinicos/cedula/${pacienteCedula}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const legacyData = Array.isArray(legacyRes.data) ? legacyRes.data : [];
            if (legacyData.length > 0) {
              // Existe en legacy — cargar sin crear nuevo
              const legacyOdonto = legacyData[0];
              setOdontograma(legacyOdonto);
              setTipoDenticion(legacyOdonto.tipo_denticion || "permanente");
              setDiagnosticoGeneral(legacyOdonto.diagnostico_general || "");
              setHigieneOral(legacyOdonto.higiene_oral || "");
              setEstadoEncias(legacyOdonto.estado_encias || "");
              setObservaciones(legacyOdonto.observaciones || "");
              if (onOdontogramaLoaded) onOdontogramaLoaded(legacyOdonto.id);
              legacyFound = true;
            }
          } catch (legacyErr) {
            console.log("No existe odontograma legacy tampoco:", legacyErr.message);
          }
        }
        if (!legacyFound) {
          // Realmente no existe — crear nuevo
          await crearNuevoOdontograma();
        }
      }
    } catch (error) {
      console.error("Error al buscar odontograma:", error);
      await crearNuevoOdontograma();
    }
    setLoading(false);
  };

  const crearNuevoOdontograma = async () => {
    try {
      // Usar todos los datos disponibles del appointment como fallback
      const payload = {
        paciente_id:      pacienteId             || appointment?.paciente_id || "",
        paciente_nombre:  pacienteNombre          || appointment?.nombre_completo || appointment?.nombre || "",
        paciente_cedula:  pacienteCedula          || appointment?.cedula || "",
        doctor_id:        doctorId               || appointment?.doctor_id || "",
        doctor_nombre:    appointment?.doctor_nombre || "",
        tipo_denticion:   tipoDenticion,
      };

      const response = await axios.post(
        `${API}/odontogramas-clinicos`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // El POST devuelve el odontograma completo — no necesita segundo GET
      const nuevoOdontograma = response.data;
      setOdontograma(nuevoOdontograma);
      if (onOdontogramaLoaded) onOdontogramaLoaded(nuevoOdontograma.id);
      toast.success("✅ Odontograma creado");
    } catch (error) {
      const det = error.response?.data?.detail || error.message;
      console.error("Error al crear odontograma:", det);
      toast.error(`Error al crear odontograma: ${det}`);
      // No dejar al usuario pegado — mostrar estado de error
      setOdontograma(null);
    }
  };

  const cambiarTipoDenticion = async (nuevoTipo) => {
    if (!odontograma) return;
    
    if (!window.confirm(`¿Cambiar a dentición ${nuevoTipo}? Esto regenerará los dientes.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(
        `${API}/odontogramas-clinicos/${odontograma.id}/cambiar-denticion`,
        { tipo_denticion: nuevoTipo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setTipoDenticion(nuevoTipo);
      await buscarOdontogramaExistente();
      toast.success(`Dentición cambiada a ${nuevoTipo}`);
    } catch (error) {
      console.error("Error al cambiar dentición:", error);
      toast.error("Error al cambiar dentición");
    }
    setLoading(false);
  };

  const handleSelectDiente = (diente) => {
    setDienteSeleccionado(diente);
    setSuperficieSeleccionada(null);
    
    if (modoEdicion === "diente") {
      setDetalleDialogOpen(true);
    }
  };

  const handleSelectSuperficie = async (diente, nombreSuperficie) => {
    if (modoEdicion === "superficie") {
      // Aplicar diagnóstico directamente
      await aplicarDiagnosticoSuperficie(diente, nombreSuperficie, herramientaActual);
    } else {
      setDienteSeleccionado(diente);
      setSuperficieSeleccionada(nombreSuperficie);
      setDetalleDialogOpen(true);
    }
  };

  const aplicarDiagnosticoSuperficie = async (diente, nombreSuperficie, diagnostico) => {
    if (!odontograma?.id) {
      toast.error("Odontograma no cargado aún, espere un momento");
      return;
    }

    try {
      await axios.put(
        `${API}/odontogramas-clinicos/${odontograma.id}/diente/${diente.numero_fdi}/superficie/${nombreSuperficie}`,
        { diagnostico },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Actualizar estado local
      const copia = { ...odontograma, dientes: odontograma.dientes.map(d => {
        if (d.numero_fdi !== diente.numero_fdi) return d;
        return {
          ...d,
          superficies: d.superficies.map(s =>
            s.nombre === nombreSuperficie ? { ...s, diagnostico } : s
          ),
        };
      })};
      setOdontograma(copia);

      // ── Auto-agregar a lista de tratamientos si no es "sano" ─────────────
      if (diagnostico && diagnostico !== "sano") {
        const etiquetas = {
          caries: "Caries", restauracion: "Restauración", endodoncia: "Endodoncia",
          corona: "Corona", sellante: "Sellante", fractura: "Fractura",
        };
        const precios = {
          caries: 25, restauracion: 40, endodoncia: 150,
          corona: 200, sellante: 20, fractura: 50,
        };
        const etiqueta  = etiquetas[diagnostico] || diagnostico;
        const supLabel  = { vestibular: "V", palatino: "P", lingual: "L", mesial: "M", distal: "D", oclusal: "O" }[nombreSuperficie] || nombreSuperficie;
        const desc      = `${etiqueta} — D${diente.numero_fdi} sup. ${supLabel}`;

        setTratamientos(ts => {
          if (ts.some(t => t.descripcion === desc)) return ts;
          return [...ts, {
            id: Date.now(), descripcion: desc,
            diente: String(diente.numero_fdi),
            precio: String(precios[diagnostico] || 0),
            estado: "pendiente",
          }];
        });
        setNuevoTratamiento(f => ({ ...f, diente: String(diente.numero_fdi) }));

        // ── Motor clínico: evaluar reglas y sugerir procedimientos ────────
        const superficiesAfectadas = (copia.dientes
          .find(d => d.numero_fdi === diente.numero_fdi)
          ?.superficies?.filter(s => s.diagnostico && s.diagnostico !== "sano")
          ?.map(s => s.nombre?.[0]?.toUpperCase()) || []);

        const sugerencias = evaluateLocal({
          selectedSurfaces:  superficiesAfectadas,
          toothHistory:      [],
          paciente:          pacienteParaEngine,
          procedimiento:     etiqueta,
        });

        // Sugerencia automática por número de superficies
        const procSugerido = clasificarPorSuperficies(superficiesAfectadas.length);
        if (procSugerido && procSugerido !== "Resina Simple") {
          sugerencias.unshift({
            tipo: "info",
            texto: `${superficiesAfectadas.length} superficies → se sugiere ${procSugerido}`,
            procedimientos_alternativos: [procSugerido],
          });
        }

        if (sugerencias.length > 0) setAiSugerencias(sugerencias);
      } else {
        setAiSugerencias([]);
      }

    } catch (error) {
      console.error("Error al actualizar superficie:", error);
      toast.error(`Error al marcar ${nombreSuperficie} — ${error.response?.data?.detail || error.message}`);
    }
  };

  const aplicarEstadoDiente = async (nuevoEstado) => {
    if (!odontograma || !dienteSeleccionado) return;
    
    try {
      await axios.put(
        `${API}/odontogramas-clinicos/${odontograma.id}/diente/${dienteSeleccionado.numero_fdi}`,
        { estado: nuevoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Actualizar estado local
      const nuevosOdontogramas = { ...odontograma };
      const dienteIndex = nuevosOdontogramas.dientes.findIndex(d => d.numero_fdi === dienteSeleccionado.numero_fdi);
      if (dienteIndex >= 0) {
        nuevosOdontogramas.dientes[dienteIndex].estado = nuevoEstado;
      }
      setOdontograma(nuevosOdontogramas);
      setDienteSeleccionado({ ...dienteSeleccionado, estado: nuevoEstado });
      
      toast.success(`Diente ${dienteSeleccionado.numero_fdi} marcado como ${nuevoEstado}`);
    } catch (error) {
      console.error("Error al actualizar diente:", error);
      toast.error("Error al actualizar diente");
    }
  };

  const guardarDiagnosticoGeneral = async () => {
    if (!odontograma) return;
    
    setLoading(true);
    try {
      await axios.put(
        `${API}/odontogramas-clinicos/${odontograma.id}`,
        {
          diagnostico_general: diagnosticoGeneral,
          higiene_oral: higieneOral,
          estado_encias: estadoEncias,
          observaciones: observaciones
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success("Diagnóstico guardado");
    } catch (error) {
      console.error("Error al guardar:", error);
      toast.error("Error al guardar diagnóstico");
    }
    setLoading(false);
  };

  // Organizar dientes por cuadrantes
  const organizarDientes = () => {
    if (!odontograma?.dientes) return { superior: [], inferior: [] };
    
    const dientes = odontograma.dientes;
    
    if (tipoDenticion === "permanente") {
      // Cuadrantes 1 y 2 (superiores), 4 y 3 (inferiores)
      const cuadrante1 = dientes.filter(d => d.cuadrante === 1).sort((a, b) => b.posicion - a.posicion);
      const cuadrante2 = dientes.filter(d => d.cuadrante === 2).sort((a, b) => a.posicion - b.posicion);
      const cuadrante4 = dientes.filter(d => d.cuadrante === 4).sort((a, b) => b.posicion - a.posicion);
      const cuadrante3 = dientes.filter(d => d.cuadrante === 3).sort((a, b) => a.posicion - b.posicion);
      
      return {
        superior: [...cuadrante1, ...cuadrante2],
        inferior: [...cuadrante4, ...cuadrante3]
      };
    } else if (tipoDenticion === "temporal") {
      // Cuadrantes 5 y 6 (superiores), 8 y 7 (inferiores)
      const cuadrante5 = dientes.filter(d => d.cuadrante === 5).sort((a, b) => b.posicion - a.posicion);
      const cuadrante6 = dientes.filter(d => d.cuadrante === 6).sort((a, b) => a.posicion - b.posicion);
      const cuadrante8 = dientes.filter(d => d.cuadrante === 8).sort((a, b) => b.posicion - a.posicion);
      const cuadrante7 = dientes.filter(d => d.cuadrante === 7).sort((a, b) => a.posicion - b.posicion);
      
      return {
        superior: [...cuadrante5, ...cuadrante6],
        inferior: [...cuadrante8, ...cuadrante7]
      };
    } else {
      // Mixta: mostrar ambos
      const permanentes = {
        superior: [
          ...dientes.filter(d => d.cuadrante === 1).sort((a, b) => b.posicion - a.posicion),
          ...dientes.filter(d => d.cuadrante === 2).sort((a, b) => a.posicion - b.posicion)
        ],
        inferior: [
          ...dientes.filter(d => d.cuadrante === 4).sort((a, b) => b.posicion - a.posicion),
          ...dientes.filter(d => d.cuadrante === 3).sort((a, b) => a.posicion - b.posicion)
        ]
      };
      const temporales = {
        superior: [
          ...dientes.filter(d => d.cuadrante === 5).sort((a, b) => b.posicion - a.posicion),
          ...dientes.filter(d => d.cuadrante === 6).sort((a, b) => a.posicion - b.posicion)
        ],
        inferior: [
          ...dientes.filter(d => d.cuadrante === 8).sort((a, b) => b.posicion - a.posicion),
          ...dientes.filter(d => d.cuadrante === 7).sort((a, b) => a.posicion - b.posicion)
        ]
      };
      
      return { permanentes, temporales };
    }
  };

  const denticionOrganizada = organizarDientes();

  // Debug para verificar datos
  console.log("Odontograma:", odontograma?.id, "Dientes:", odontograma?.dientes?.length);
  console.log("Denticion organizada:", denticionOrganizada);

  if (loading && !odontograma) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Cargando odontograma...</p>
      </div>
    );
  }

  // Mostrar mensaje si no hay dientes cargados
  if (!odontograma?.dientes || odontograma.dientes.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Inicializando odontograma...</p>
        <Button onClick={crearNuevoOdontograma} style={{ marginTop: '1rem' }}>
          Crear Odontograma
        </Button>
      </div>
    );
  }

  return (
    <div className="odontograma-clinico">
      {/* Header */}
      <div className="odontograma-header">
        <div className="header-info">
          <h2>Odontograma Clínico</h2>
          {pacienteNombre && (
            <div className="paciente-info">
              <User size={16} />
              <span>{pacienteNombre}</span>
              {pacienteCedula && <span className="cedula">({pacienteCedula})</span>}
            </div>
          )}
        </div>
        
        <div className="header-controls">
          <Select value={tipoDenticion} onValueChange={cambiarTipoDenticion}>
            <SelectTrigger style={{ width: '180px' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="permanente">Permanente (32)</SelectItem>
              <SelectItem value="temporal">Temporal (20)</SelectItem>
              <SelectItem value="mixta">Mixta</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={guardarDiagnosticoGeneral} disabled={loading}>
            <Save size={16} style={{ marginRight: '0.5rem' }} />
            Guardar
          </Button>
        </div>
      </div>

      {/* Barra de herramientas de diagnóstico */}
      <div className="herramientas-diagnostico">
        <div className="modo-edicion">
          <Label>Modo:</Label>
          <div className="modo-buttons">
            <Button 
              variant={modoEdicion === "superficie" ? "default" : "outline"}
              size="sm"
              onClick={() => setModoEdicion("superficie")}
            >
              Superficie
            </Button>
            <Button 
              variant={modoEdicion === "diente" ? "default" : "outline"}
              size="sm"
              onClick={() => setModoEdicion("diente")}
            >
              Diente
            </Button>
          </div>
        </div>
        
        {modoEdicion === "superficie" && (
          <div className="diagnosticos-toolbar">
            <Label>Diagnóstico:</Label>
            <div className="diagnostico-buttons">
              {DIAGNOSTICOS.map(diag => (
                <button
                  key={diag.value}
                  className={`diag-btn ${herramientaActual === diag.value ? 'active' : ''}`}
                  onClick={() => setHerramientaActual(diag.value)}
                  style={{ 
                    backgroundColor: herramientaActual === diag.value ? diag.color : 'transparent',
                    borderColor: diag.color,
                    color: herramientaActual === diag.value ? (diag.value === 'sano' ? '#374151' : '#fff') : diag.color
                  }}
                  title={diag.label}
                >
                  {diag.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Odontograma Visual */}
      <div className="odontograma-visual">
        {tipoDenticion === "mixta" ? (
          <>
            {/* Permanentes */}
            <div className="denticion-section">
              <h4>Dentición Permanente</h4>
              <div className="arcada superior">
                <div className="cuadrante-label left">Q1</div>
                <div className="dientes-row">
                  {denticionOrganizada.permanentes?.superior?.map(diente => (
                    <Diente
                      key={diente.numero_fdi}
                      diente={diente}
                      onSelectDiente={handleSelectDiente}
                      onSelectSuperficie={handleSelectSuperficie}
                      isSelected={dienteSeleccionado?.numero_fdi === diente.numero_fdi}
                      herramientaActual={herramientaActual}
                    />
                  ))}
                </div>
                <div className="cuadrante-label right">Q2</div>
              </div>
              
              <div className="linea-media" />
              
              <div className="arcada inferior">
                <div className="cuadrante-label left">Q4</div>
                <div className="dientes-row">
                  {denticionOrganizada.permanentes?.inferior?.map(diente => (
                    <Diente
                      key={diente.numero_fdi}
                      diente={diente}
                      onSelectDiente={handleSelectDiente}
                      onSelectSuperficie={handleSelectSuperficie}
                      isSelected={dienteSeleccionado?.numero_fdi === diente.numero_fdi}
                      herramientaActual={herramientaActual}
                    />
                  ))}
                </div>
                <div className="cuadrante-label right">Q3</div>
              </div>
            </div>
            
            {/* Temporales */}
            <div className="denticion-section temporal">
              <h4>Dentición Temporal</h4>
              <div className="arcada superior">
                <div className="cuadrante-label left">Q5</div>
                <div className="dientes-row">
                  {denticionOrganizada.temporales?.superior?.map(diente => (
                    <Diente
                      key={diente.numero_fdi}
                      diente={diente}
                      onSelectDiente={handleSelectDiente}
                      onSelectSuperficie={handleSelectSuperficie}
                      isSelected={dienteSeleccionado?.numero_fdi === diente.numero_fdi}
                      herramientaActual={herramientaActual}
                    />
                  ))}
                </div>
                <div className="cuadrante-label right">Q6</div>
              </div>
              
              <div className="linea-media" />
              
              <div className="arcada inferior">
                <div className="cuadrante-label left">Q8</div>
                <div className="dientes-row">
                  {denticionOrganizada.temporales?.inferior?.map(diente => (
                    <Diente
                      key={diente.numero_fdi}
                      diente={diente}
                      onSelectDiente={handleSelectDiente}
                      onSelectSuperficie={handleSelectSuperficie}
                      isSelected={dienteSeleccionado?.numero_fdi === diente.numero_fdi}
                      herramientaActual={herramientaActual}
                    />
                  ))}
                </div>
                <div className="cuadrante-label right">Q7</div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Arcada Superior */}
            <div className="arcada superior">
              <div className="cuadrante-label left">{tipoDenticion === 'temporal' ? 'Q5' : 'Q1'}</div>
              <div className="dientes-row">
                {denticionOrganizada.superior?.map(diente => (
                  <Diente
                    key={diente.numero_fdi}
                    diente={diente}
                    onSelectDiente={handleSelectDiente}
                    onSelectSuperficie={handleSelectSuperficie}
                    isSelected={dienteSeleccionado?.numero_fdi === diente.numero_fdi}
                    herramientaActual={herramientaActual}
                  />
                ))}
              </div>
              <div className="cuadrante-label right">{tipoDenticion === 'temporal' ? 'Q6' : 'Q2'}</div>
            </div>
            
            {/* Línea media */}
            <div className="linea-media">
              <span>SUPERIOR</span>
              <div className="linea" />
              <span>INFERIOR</span>
            </div>
            
            {/* Arcada Inferior */}
            <div className="arcada inferior">
              <div className="cuadrante-label left">{tipoDenticion === 'temporal' ? 'Q8' : 'Q4'}</div>
              <div className="dientes-row">
                {denticionOrganizada.inferior?.map(diente => (
                  <Diente
                    key={diente.numero_fdi}
                    diente={diente}
                    onSelectDiente={handleSelectDiente}
                    onSelectSuperficie={handleSelectSuperficie}
                    isSelected={dienteSeleccionado?.numero_fdi === diente.numero_fdi}
                    herramientaActual={herramientaActual}
                  />
                ))}
              </div>
              <div className="cuadrante-label right">{tipoDenticion === 'temporal' ? 'Q7' : 'Q3'}</div>
            </div>
          </>
        )}
      </div>

      {/* Leyenda */}
      <div className="leyenda-odontograma">
        <h4>Leyenda de Diagnósticos</h4>
        <div className="leyenda-items">
          {DIAGNOSTICOS.map(diag => (
            <div key={diag.value} className="leyenda-item">
              <div 
                className="leyenda-color" 
                style={{ backgroundColor: diag.color, border: diag.value === 'sano' ? '1px solid #9CA3AF' : 'none' }}
              />
              <span>{diag.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de diagnóstico general */}
      <div className="diagnostico-general-panel">
        <h4>Diagnóstico General</h4>
        <div className="form-grid">
          <div className="form-field">
            <Label>Higiene Oral</Label>
            <Select value={higieneOral} onValueChange={setHigieneOral}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buena">Buena</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="mala">Mala</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field">
            <Label>Estado de Encías</Label>
            <Select value={estadoEncias} onValueChange={setEstadoEncias}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sano">Sano</SelectItem>
                <SelectItem value="gingivitis">Gingivitis</SelectItem>
                <SelectItem value="periodontitis_leve">Periodontitis Leve</SelectItem>
                <SelectItem value="periodontitis_moderada">Periodontitis Moderada</SelectItem>
                <SelectItem value="periodontitis_severa">Periodontitis Severa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="form-field full-width">
            <Label>Diagnóstico General</Label>
            <Textarea
              value={diagnosticoGeneral}
              onChange={(e) => setDiagnosticoGeneral(e.target.value)}
              placeholder="Describa el diagnóstico general del paciente..."
              rows={3}
            />
          </div>
          <div className="form-field full-width">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* Dialog para editar diente completo */}
      <Dialog open={detalleDialogOpen} onOpenChange={setDetalleDialogOpen}>
        <DialogContent className="dialog-content">
          <DialogHeader>
            <DialogTitle>
              Diente {dienteSeleccionado?.numero_fdi}
            </DialogTitle>
          </DialogHeader>
          
          {dienteSeleccionado && (
            <div style={{ padding: '1rem 0' }}>
              <div className="form-field" style={{ marginBottom: '1rem' }}>
                <Label>Estado del Diente</Label>
                <Select 
                  value={dienteSeleccionado.estado} 
                  onValueChange={aplicarEstadoDiente}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_DIENTE.map(est => (
                      <SelectItem key={est.value} value={est.value}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%',
                            backgroundColor: est.color,
                            border: '1px solid #9CA3AF'
                          }} />
                          {est.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {dienteSeleccionado.estado === 'presente' && (
                <div>
                  <Label style={{ marginBottom: '0.5rem', display: 'block' }}>Superficies</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {dienteSeleccionado.superficies?.map(sup => (
                      <div 
                        key={sup.nombre}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          background: '#F3F4F6',
                          borderRadius: '4px'
                        }}
                      >
                        <span style={{ textTransform: 'capitalize' }}>{sup.nombre}</span>
                        <Select 
                          value={sup.diagnostico || 'sano'}
                          onValueChange={(val) => aplicarDiagnosticoSuperficie(dienteSeleccionado, sup.nombre, val)}
                        >
                          <SelectTrigger style={{ width: '140px' }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DIAGNOSTICOS.map(diag => (
                              <SelectItem key={diag.value} value={diag.value}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ 
                                    width: '10px', 
                                    height: '10px', 
                                    borderRadius: '50%',
                                    backgroundColor: diag.color,
                                    border: diag.value === 'sano' ? '1px solid #9CA3AF' : 'none'
                                  }} />
                                  {diag.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setDetalleDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ ACCIONES RÁPIDAS (motor clínico V2) ══════════════════════════ */}
      <div style={{ margin: "16px 0 0", padding: "14px 16px", background: "#F8FAFF", border: "1px solid #BFDBFE", borderRadius: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
          <Zap size={14} color="#F59E0B" fill="#F59E0B" />
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {dienteSeleccionado ? `Acción rápida → Diente ${dienteSeleccionado.numero_fdi}` : "Acciones Rápidas"}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {QUICK_PROCEDURES.map(({ name, color }) => {
            const d = PROCEDURE_DEFAULTS[name] || {};
            return (
              <button
                key={name}
                onClick={() => {
                  const dienteNum = dienteSeleccionado?.numero_fdi?.toString() || "0";
                  const t = {
                    id: Date.now(),
                    descripcion: `${name}${dienteSeleccionado ? ` — D${dienteNum}` : " (General)"}`,
                    diente: dienteNum,
                    precio: String(d.precio || 0),
                    estado: "pendiente",
                  };
                  setTratamientos(ts => [...ts, t]);
                  // También agregar al pipeline del plan de tratamiento
                  addProcedure({
                    procedimiento: name,
                    diente_numero: dienteNum,
                    precio: d.precio || 0,
                    fase: d.fase || 1,
                    superficies_afectadas: [],
                    descripcion: t.descripcion,
                    cie10: d.cie10 || "",
                    indicaciones: d.indicaciones || "",
                  });
                  // Evaluar reglas clínicas
                  const receta = getAdjustedPrescription(name);
                  if (receta.length > 0) {
                    toast.info(`Receta sugerida: ${receta.map(r => r.nombre).join(", ")}`);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "5px 10px", border: "1.5px solid #E2E8F0",
                  borderRadius: "20px", background: "white", cursor: "pointer",
                  fontSize: "11px", fontWeight: "700", color: "#374151",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                {name}
                <span style={{ fontSize: "9px", color: "#94A3B8", fontWeight: "500" }}>${d.precio || 0}</span>
              </button>
            );
          })}
          <button
            onClick={async () => {
              if (!odontograma) return;
              const dienteNum = dienteSeleccionado?.numero_fdi;
              const sugs = await requestAIAnalysis("tratamiento", {
                diente:      dienteNum,
                superficies: dienteSeleccionado?.superficies?.filter(s => s.diagnostico && s.diagnostico !== "sano").map(s => s.nombre),
                paciente:    { alergias: appointment?.alergias_medicamentos || "" },
              });
              if (sugs?.sugerencias) setAiSugerencias(sugs.sugerencias.map(s => ({ tipo: "info", texto: s })));
            }}
            disabled={aiLoading}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "5px 12px", border: "1.5px solid #DDD6FE",
              borderRadius: "20px", background: "#F5F3FF", cursor: "pointer",
              fontSize: "11px", fontWeight: "700", color: "#7C3AED",
            }}
          >
            <Brain size={11} /> {aiLoading ? "Analizando..." : "✦ IA"}
          </button>
        </div>

        {/* Sugerencias del motor clínico */}
        {aiSugerencias.length > 0 && (
          <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {aiSugerencias.map((s, i) => (
              <div key={i} style={{
                padding: "7px 10px", borderRadius: "8px", fontSize: "11px",
                background: s.tipo === "danger" ? "#FEF2F2" : s.tipo === "warning" ? "#FFFBEB" : "#EFF6FF",
                border: `1px solid ${s.tipo === "danger" ? "#FCA5A5" : s.tipo === "warning" ? "#FDE68A" : "#BFDBFE"}`,
                color: s.tipo === "danger" ? "#DC2626" : s.tipo === "warning" ? "#92400E" : "#1E40AF",
              }}>
                {s.tipo === "danger" ? "⚠️" : s.tipo === "warning" ? "💡" : "ℹ️"} {s.texto}
                {s.procedimientos_alternativos?.length > 0 && (
                  <div style={{ marginTop: "4px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {s.procedimientos_alternativos.map(proc => (
                      <button
                        key={proc}
                        onClick={() => {
                          const d = PROCEDURE_DEFAULTS[proc] || {};
                          setTratamientos(ts => [...ts, {
                            id: Date.now(),
                            descripcion: `${proc}${dienteSeleccionado ? ` — D${dienteSeleccionado.numero_fdi}` : ""}`,
                            diente: dienteSeleccionado?.numero_fdi?.toString() || "",
                            precio: String(d.precio || 0),
                            estado: "pendiente",
                          }]);
                          setAiSugerencias(sgs => sgs.filter((_, j) => j !== i));
                        }}
                        style={{
                          padding: "2px 7px", background: "#0C4A6E", color: "white",
                          border: "none", borderRadius: "10px", fontSize: "10px",
                          cursor: "pointer", fontWeight: "700",
                        }}
                      >
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

      {/* ══ TRATAMIENTOS DE ESTA CONSULTA + PROFORMA ══════════════════════ */}
      <div style={{
        margin: "20px 0 0", padding: "16px 20px",
        background: "#F8FAFF", border: "1px solid #BFDBFE", borderRadius: "12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0C4A6E" }}>
            🦷 Tratamientos realizados en esta consulta
          </h3>
          {tratamientos.length > 0 && (
            <button
              onClick={async () => {
                if (!appointment?.id) { toast.error("Sin cita vinculada, no se puede generar proforma"); return; }
                setGenerandoProforma(true);
                try {
                  const items = tratamientos.map(t => ({
                    descripcion: `${t.descripcion}${t.diente ? ` — Diente ${t.diente}` : ""}`,
                    cantidad: 1,
                    precio_unitario: parseFloat(t.precio) || 0,
                    descuento: 0,
                    subtotal: parseFloat(t.precio) || 0,
                  }));
                  const res = await axios.post(`${API}/proformas`, {
                    paciente_nombre:   pacienteNombre || appointment?.nombre_completo || "",
                    paciente_cedula:   pacienteCedula || appointment?.cedula || "",
                    paciente_telefono: appointment?.telefono || "",
                    doctor_id:         doctorId || appointment?.doctor_id || "",
                    doctor_nombre:     appointment?.doctor_nombre || "",
                    appointment_id:    appointment?.id,
                    especialidad:      "Odontología",
                    validez_dias:      30,
                    items,
                    subtotal:    items.reduce((s, i) => s + i.subtotal, 0),
                    descuento:   0,
                    total:       items.reduce((s, i) => s + i.subtotal, 0),
                    observaciones: diagnosticoGeneral || "",
                  }, { headers: { Authorization: `Bearer ${token}` } });
                  toast.success(`✅ Proforma ${res.data.numero_proforma || ""} creada`);
                } catch (e) {
                  toast.error("Error al crear proforma: " + (e.response?.data?.detail || e.message));
                } finally {
                  setGenerandoProforma(false);
                }
              }}
              disabled={generandoProforma}
              style={{
                padding: "7px 14px", background: "#0C4A6E", color: "white",
                border: "none", borderRadius: "8px", fontSize: "12px",
                fontWeight: "700", cursor: generandoProforma ? "not-allowed" : "pointer",
              }}
            >
              {generandoProforma ? "Generando..." : "📋 Generar Proforma"}
            </button>
          )}
        </div>

        {/* Agregar tratamiento */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "8px", marginBottom: "12px", alignItems: "end" }}>
          <div>
            <label style={{ fontSize: "10px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "3px", textTransform: "uppercase" }}>
              Descripción del tratamiento
            </label>
            <input
              value={nuevoTratamiento.descripcion}
              onChange={e => setNuevoTratamiento(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Extracción, Restauración, Endodoncia..."
              style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #BFDBFE", borderRadius: "7px", fontSize: "13px", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "10px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "3px", textTransform: "uppercase" }}>
              Diente
            </label>
            <input
              value={nuevoTratamiento.diente}
              onChange={e => setNuevoTratamiento(f => ({ ...f, diente: e.target.value }))}
              placeholder="Ej: 16"
              style={{ width: "70px", padding: "7px 10px", border: "1.5px solid #BFDBFE", borderRadius: "7px", fontSize: "13px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "10px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "3px", textTransform: "uppercase" }}>
              Precio $
            </label>
            <input
              type="number"
              value={nuevoTratamiento.precio}
              onChange={e => setNuevoTratamiento(f => ({ ...f, precio: e.target.value }))}
              placeholder="0.00"
              style={{ width: "80px", padding: "7px 10px", border: "1.5px solid #BFDBFE", borderRadius: "7px", fontSize: "13px" }}
            />
          </div>
          <button
            onClick={() => {
              if (!nuevoTratamiento.descripcion.trim()) { toast.error("Ingrese la descripción"); return; }
              setTratamientos(t => [...t, { ...nuevoTratamiento, id: Date.now() }]);
              setNuevoTratamiento({ descripcion: "", diente: dienteSeleccionado?.numero_fdi?.toString() || "", precio: "" });
            }}
            style={{
              padding: "7px 14px", background: "#0369A1", color: "white",
              border: "none", borderRadius: "7px", fontSize: "13px",
              fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            + Agregar
          </button>
        </div>

        {/* Lista de tratamientos */}
        {tratamientos.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontSize: "12px", textAlign: "center", padding: "12px" }}>
            Sin tratamientos. Marque superficies en el odontograma o agréguelos manualmente.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {tratamientos.map((t, i) => {
              const realizado = t.estado === "realizado";
              return (
                <div key={t.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", background: "white", borderRadius: "8px",
                  border: `1.5px solid ${realizado ? "#BFDBFE" : "#FCA5A5"}`,
                  borderLeft: `4px solid ${realizado ? "#3B82F6" : "#EF4444"}`,
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: "600", fontSize: "13px", color: realizado ? "#1E40AF" : "#0C4A6E" }}>
                      {t.descripcion}
                    </span>
                    {t.diente && <span style={{ fontSize: "11px", color: "#6B7280", marginLeft: "8px" }}>D{t.diente}</span>}
                    <span style={{
                      marginLeft: "8px", fontSize: "10px", fontWeight: "700",
                      padding: "1px 6px", borderRadius: "10px",
                      background: realizado ? "#DBEAFE" : "#FEE2E2",
                      color: realizado ? "#1D4ED8" : "#DC2626",
                    }}>
                      {realizado ? "✓ Realizado" : "● Pendiente"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <span style={{ fontWeight: "700", color: "#059669" }}>${parseFloat(t.precio || 0).toFixed(2)}</span>
                    <button
                      onClick={() => setTratamientos(ts => ts.map((item, j) =>
                        j === i ? { ...item, estado: item.estado === "realizado" ? "pendiente" : "realizado" } : item
                      ))}
                      style={{
                        background: realizado ? "#DBEAFE" : "#FEE2E2",
                        border: "none", borderRadius: "6px", padding: "3px 7px",
                        fontSize: "10px", cursor: "pointer", fontWeight: "700",
                        color: realizado ? "#1D4ED8" : "#DC2626",
                      }}
                      title="Marcar como realizado/pendiente"
                    >
                      {realizado ? "↩ Pendiente" : "✓ Realizado"}
                    </button>
                    <button
                      onClick={() => setTratamientos(ts => ts.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "16px" }}
                    >×</button>
                  </div>
                </div>
              );
            })}
            <div style={{ textAlign: "right", fontWeight: "700", color: "#0C4A6E", fontSize: "14px", paddingTop: "4px" }}>
              Total: ${tratamientos.reduce((s, t) => s + parseFloat(t.precio || 0), 0).toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OdontogramaClinicoTab;