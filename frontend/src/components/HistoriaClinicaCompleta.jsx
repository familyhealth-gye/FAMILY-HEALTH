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

      // Obtener historias clínicas de cada cita
      const consultasConHistoria = await Promise.all(
        citasPaciente.map(async (cita) => {
          let historia = null;
          let tipoHistoria = null;
          
          // Buscar historia de medicina general
          try {
            const res = await axios.get(
              `${API}/medical-history/general/appointment/${cita.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data) {
              historia = res.data;
              tipoHistoria = "general";
            }
          } catch (e) {}
          
          // Buscar historia pediátrica
          if (!historia) {
            try {
              const res = await axios.get(
                `${API}/medical-history/pediatric/appointment/${cita.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (res.data) {
                historia = res.data;
                tipoHistoria = "pediatric";
              }
            } catch (e) {}
          }
          
          // Buscar historia odontológica
          if (!historia) {
            try {
              const res = await axios.get(
                `${API}/medical-history/odontology/appointment/${cita.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (res.data) {
                historia = res.data;
                tipoHistoria = "odontology";
              }
            } catch (e) {}
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

  return (
    <div className="historia-clinica-completa">
      {/* Header con datos del paciente */}
      <div className="historia-header">
        <Button variant="ghost" onClick={onBack} className="back-button">
          <ArrowLeft size={20} />
          Volver
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
                        
                        {selectedConsulta.historia.motivo_consulta && (
                          <div className="historia-campo">
                            <span className="campo-label">Motivo de Consulta:</span>
                            <p>{selectedConsulta.historia.motivo_consulta}</p>
                          </div>
                        )}
                        
                        {selectedConsulta.historia.diagnostico && (
                          <div className="historia-campo">
                            <span className="campo-label">Diagnóstico:</span>
                            <p>{selectedConsulta.historia.diagnostico}</p>
                          </div>
                        )}
                        
                        {selectedConsulta.historia.tratamiento_realizado && (
                          <div className="historia-campo">
                            <span className="campo-label">Tratamiento:</span>
                            <p>{selectedConsulta.historia.tratamiento_realizado}</p>
                          </div>
                        )}
                        
                        {selectedConsulta.historia.indicaciones && (
                          <div className="historia-campo">
                            <span className="campo-label">Indicaciones:</span>
                            <p>{selectedConsulta.historia.indicaciones}</p>
                          </div>
                        )}
                        
                        {selectedConsulta.historia.observaciones && (
                          <div className="historia-campo">
                            <span className="campo-label">Observaciones:</span>
                            <p>{selectedConsulta.historia.observaciones}</p>
                          </div>
                        )}
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
              />
            </div>
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
    </div>
  );
};

export default HistoriaClinicaCompleta;
