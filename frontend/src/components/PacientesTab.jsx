import { useState, useEffect } from "react";
import { Users, Eye, ArrowLeft, Phone, Calendar, FileText, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const PacientesTab = ({ user, token }) => {
  const [pacientes, setPacientes] = useState([]);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [consultas, setConsultas] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [selectedConsulta, setSelectedConsulta] = useState(null);
  const [historiaDetalle, setHistoriaDetalle] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("consultas");

  // Cargar pacientes del doctor
  useEffect(() => {
    if (user?.doctor_id) {
      fetchPacientes();
    }
  }, [user?.doctor_id]);

  const fetchPacientes = async () => {
    setLoading(true);
    try {
      const appointmentsRes = await axios.get(`${API}/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const misCitas = appointmentsRes.data.filter(
        apt => apt.doctor_id === user.doctor_id && 
               (apt.estado === "Pendiente de Pago" || apt.estado === "Atendida" || apt.estado === "Pagada")
      );
      
      const pacientesMap = {};
      misCitas.forEach(cita => {
        if (!pacientesMap[cita.cedula]) {
          pacientesMap[cita.cedula] = {
            cedula: cita.cedula,
            nombre: cita.nombre_completo,
            edad: cita.edad,
            telefono: cita.telefono,
            ultimaConsulta: cita.fecha,
            totalConsultas: 1
          };
        } else {
          pacientesMap[cita.cedula].totalConsultas++;
          if (new Date(cita.fecha) > new Date(pacientesMap[cita.cedula].ultimaConsulta)) {
            pacientesMap[cita.cedula].ultimaConsulta = cita.fecha;
          }
        }
      });
      
      setPacientes(Object.values(pacientesMap));
    } catch (error) {
      console.error("Error fetching pacientes:", error);
      toast.error("Error al cargar pacientes");
    }
    setLoading(false);
  };

  const fetchConsultasPaciente = async (cedula) => {
    setLoading(true);
    try {
      const appointmentsRes = await axios.get(`${API}/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const citasPaciente = appointmentsRes.data.filter(
        apt => apt.cedula === cedula && 
               apt.doctor_id === user.doctor_id &&
               (apt.estado === "Pendiente de Pago" || apt.estado === "Atendida" || apt.estado === "Pagada")
      );
      
      const consultasConHistoria = await Promise.all(
        citasPaciente.map(async (cita) => {
          let historia = null;
          let tipoHistoria = null;
          
          try {
            const generalRes = await axios.get(
              `${API}/medical-history/general/appointment/${cita.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (generalRes.data) {
              historia = generalRes.data;
              tipoHistoria = "general";
            }
          } catch (e) {}
          
          if (!historia) {
            try {
              const pedRes = await axios.get(
                `${API}/medical-history/pediatric/appointment/${cita.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (pedRes.data) {
                historia = pedRes.data;
                tipoHistoria = "pediatric";
              }
            } catch (e) {}
          }
          
          if (!historia) {
            try {
              const odontoRes = await axios.get(
                `${API}/medical-history/odontology/appointment/${cita.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (odontoRes.data) {
                historia = odontoRes.data;
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
      
      consultasConHistoria.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setConsultas(consultasConHistoria);
    } catch (error) {
      console.error("Error fetching consultas:", error);
      toast.error("Error al cargar consultas");
    }
    setLoading(false);
  };

  const fetchRecetasPaciente = async (cedula) => {
    try {
      const response = await axios.get(`${API}/prescriptions/patient/${cedula}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecetas(response.data);
    } catch (error) {
      console.error("Error fetching recetas:", error);
      setRecetas([]);
    }
  };

  const handleVerPaciente = (paciente) => {
    setSelectedPaciente(paciente);
    setActiveTab("consultas");
    fetchConsultasPaciente(paciente.cedula);
    fetchRecetasPaciente(paciente.cedula);
  };

  const handleVerHistoria = (consulta) => {
    if (consulta.historia) {
      setSelectedConsulta(consulta);
      setHistoriaDetalle(consulta.historia);
    }
  };

  const handleDescargarReceta = async (receta) => {
    try {
      const response = await axios.get(
        `${API}/prescriptions/${receta.id}/pdf`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receta_${receta.paciente_cedula}_${receta.fecha}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success("Receta descargada");
    } catch (error) {
      console.error("Error downloading receta:", error);
      toast.error("Error al descargar la receta");
    }
  };

  const handleImprimirReceta = async (receta) => {
    try {
      const response = await axios.get(
        `${API}/prescriptions/${receta.id}/pdf`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      toast.success("Abriendo para imprimir...");
    } catch (error) {
      console.error("Error printing receta:", error);
      toast.error("Error al imprimir la receta");
    }
  };

  const handleVolver = () => {
    if (historiaDetalle) {
      setHistoriaDetalle(null);
      setSelectedConsulta(null);
    } else if (selectedPaciente) {
      setSelectedPaciente(null);
      setConsultas([]);
      setRecetas([]);
    }
  };

  const filteredPacientes = pacientes.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.cedula.includes(search)
  );

  // Vista de Historia Clínica (Solo Lectura)
  if (historiaDetalle && selectedConsulta) {
    return (
      <div className="tab-content">
        <div className="section-header">
          <div>
            <Button variant="ghost" onClick={handleVolver} style={{ marginBottom: '0.5rem' }}>
              <ArrowLeft className="button-icon" /> Volver al historial
            </Button>
            <h2 className="section-title">Historia Clínica - Solo Lectura</h2>
            <p className="section-subtitle">
              {selectedPaciente?.nombre} | {selectedConsulta.fecha} | {selectedConsulta.especialidad}
            </p>
          </div>
        </div>

        <div className="table-container" style={{ padding: '1.5rem' }}>
          <div style={{ 
            background: '#FEF3C7', 
            color: '#92400E', 
            padding: '0.75rem 1rem', 
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <FileText size={18} />
            <span>Esta consulta está cerrada. Los datos son de solo lectura.</span>
          </div>

          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div className="form-section">
              <h3 style={{ color: '#0C4A6E', marginBottom: '1rem', fontWeight: 600 }}>Motivo de Consulta</h3>
              <p style={{ background: '#F1F5F9', padding: '1rem', borderRadius: '8px' }}>
                {historiaDetalle.motivo_consulta || "No registrado"}
              </p>
            </div>

            {historiaDetalle.enfermedad_actual && (
              <div className="form-section">
                <h3 style={{ color: '#0C4A6E', marginBottom: '1rem', fontWeight: 600 }}>Enfermedad Actual</h3>
                <p style={{ background: '#F1F5F9', padding: '1rem', borderRadius: '8px' }}>
                  {historiaDetalle.enfermedad_actual}
                </p>
              </div>
            )}

            <div className="form-section">
              <h3 style={{ color: '#0C4A6E', marginBottom: '1rem', fontWeight: 600 }}>Diagnóstico</h3>
              <p style={{ background: '#DBEAFE', padding: '1rem', borderRadius: '8px', fontWeight: 500 }}>
                {historiaDetalle.diagnostico || "No registrado"}
              </p>
            </div>

            <div className="form-section">
              <h3 style={{ color: '#0C4A6E', marginBottom: '1rem', fontWeight: 600 }}>Plan de Tratamiento</h3>
              <p style={{ background: '#F1F5F9', padding: '1rem', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                {historiaDetalle.plan_tratamiento || "No registrado"}
              </p>
            </div>

            {historiaDetalle.observaciones && (
              <div className="form-section">
                <h3 style={{ color: '#0C4A6E', marginBottom: '1rem', fontWeight: 600 }}>Observaciones</h3>
                <p style={{ background: '#F1F5F9', padding: '1rem', borderRadius: '8px' }}>
                  {historiaDetalle.observaciones}
                </p>
              </div>
            )}

            {historiaDetalle.signos_vitales && (
              <div className="form-section">
                <h3 style={{ color: '#0C4A6E', marginBottom: '1rem', fontWeight: 600 }}>Signos Vitales</h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '1rem',
                  background: '#F1F5F9',
                  padding: '1rem',
                  borderRadius: '8px'
                }}>
                  {historiaDetalle.signos_vitales.peso && (
                    <div><strong>Peso:</strong> {historiaDetalle.signos_vitales.peso} kg</div>
                  )}
                  {historiaDetalle.signos_vitales.talla && (
                    <div><strong>Talla:</strong> {historiaDetalle.signos_vitales.talla} cm</div>
                  )}
                  {historiaDetalle.signos_vitales.temperatura && (
                    <div><strong>Temp:</strong> {historiaDetalle.signos_vitales.temperatura}°C</div>
                  )}
                  {historiaDetalle.signos_vitales.presion_arterial && (
                    <div><strong>PA:</strong> {historiaDetalle.signos_vitales.presion_arterial}</div>
                  )}
                  {historiaDetalle.signos_vitales.frecuencia_cardiaca && (
                    <div><strong>FC:</strong> {historiaDetalle.signos_vitales.frecuencia_cardiaca} lpm</div>
                  )}
                  {historiaDetalle.signos_vitales.saturacion_oxigeno && (
                    <div><strong>SpO2:</strong> {historiaDetalle.signos_vitales.saturacion_oxigeno}%</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vista de Detalle del Paciente con tabs
  if (selectedPaciente) {
    return (
      <div className="tab-content">
        <div className="section-header">
          <div>
            <Button variant="ghost" onClick={handleVolver} style={{ marginBottom: '0.5rem' }}>
              <ArrowLeft className="button-icon" /> Volver a pacientes
            </Button>
            <h2 className="section-title">{selectedPaciente.nombre}</h2>
            <p className="section-subtitle">Historial completo del paciente</p>
          </div>
        </div>

        {/* Datos del Paciente */}
        <div style={{ 
          background: '#F8FAFC', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          <div>
            <span style={{ color: '#64748B', fontSize: '0.875rem' }}>Cédula</span>
            <p style={{ fontWeight: 600, color: '#1E293B' }}>{selectedPaciente.cedula}</p>
          </div>
          <div>
            <span style={{ color: '#64748B', fontSize: '0.875rem' }}>Edad</span>
            <p style={{ fontWeight: 600, color: '#1E293B' }}>{selectedPaciente.edad} años</p>
          </div>
          <div>
            <span style={{ color: '#64748B', fontSize: '0.875rem' }}>Teléfono</span>
            <p style={{ fontWeight: 600, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Phone size={16} /> {selectedPaciente.telefono || "No registrado"}
            </p>
          </div>
          <div>
            <span style={{ color: '#64748B', fontSize: '0.875rem' }}>Total consultas</span>
            <p style={{ fontWeight: 600, color: '#1E293B' }}>{consultas.length}</p>
          </div>
        </div>

        {/* Tabs de Consultas y Recetas */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList style={{ marginBottom: '1rem' }}>
            <TabsTrigger value="consultas">
              <FileText className="tab-icon" style={{ marginRight: '0.5rem' }} />
              Consultas ({consultas.length})
            </TabsTrigger>
            <TabsTrigger value="recetas">
              <Download className="tab-icon" style={{ marginRight: '0.5rem' }} />
              Recetas ({recetas.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Consultas */}
          <TabsContent value="consultas">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Especialidad</th>
                    <th>Motivo</th>
                    <th>Diagnóstico</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consultas.map((consulta) => (
                    <tr key={consulta.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={16} className="text-gray-400" />
                          {consulta.fecha}
                        </div>
                      </td>
                      <td>
                        <span className="badge">{consulta.especialidad}</span>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {consulta.historia?.motivo_consulta || consulta.observaciones || "-"}
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {consulta.historia?.diagnostico || "-"}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: consulta.estado === "Pagada" ? '#D1FAE5' : 
                                      consulta.estado === "Pendiente de Pago" ? '#FEF3C7' : '#DBEAFE',
                          color: consulta.estado === "Pagada" ? '#065F46' : 
                                 consulta.estado === "Pendiente de Pago" ? '#92400E' : '#1E40AF'
                        }}>
                          {consulta.estado === "Pendiente de Pago" ? "Atendida" : consulta.estado}
                        </span>
                      </td>
                      <td>
                        {consulta.tieneHistoria ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerHistoria(consulta)}
                          >
                            <Eye className="button-icon" /> Ver
                          </Button>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Sin historia</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading && (
                <div className="empty-state">
                  <p>Cargando consultas...</p>
                </div>
              )}
              {!loading && consultas.length === 0 && (
                <div className="empty-state">
                  <FileText className="empty-icon" />
                  <p>No hay consultas registradas</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab Recetas */}
          <TabsContent value="recetas">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Diagnóstico</th>
                    <th>Medicamentos</th>
                    <th>Doctor</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {recetas.map((receta) => (
                    <tr key={receta.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={16} className="text-gray-400" />
                          {receta.fecha}
                        </div>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {receta.diagnostico || "-"}
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#E0E7FF', color: '#3730A3' }}>
                          {receta.medicamentos?.length || 0} medicamento(s)
                        </span>
                      </td>
                      <td>{receta.doctor_nombre || "-"}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDescargarReceta(receta)}
                            title="Descargar PDF"
                          >
                            <Download size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImprimirReceta(receta)}
                            title="Imprimir"
                          >
                            <Printer size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recetas.length === 0 && (
                <div className="empty-state">
                  <FileText className="empty-icon" />
                  <p>No hay recetas registradas para este paciente</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Vista Principal - Lista de Pacientes
  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Mis Pacientes</h2>
          <p className="section-subtitle">{pacientes.length} pacientes atendidos</p>
        </div>
      </div>

      <div className="search-box">
        <Input
          placeholder="Buscar por nombre o cédula..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cédula</th>
              <th>Edad</th>
              <th>Última Consulta</th>
              <th>Total Consultas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredPacientes.map((paciente) => (
              <tr key={paciente.cedula}>
                <td><strong>{paciente.nombre}</strong></td>
                <td>{paciente.cedula}</td>
                <td>{paciente.edad} años</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={16} className="text-gray-400" />
                    {paciente.ultimaConsulta}
                  </div>
                </td>
                <td>
                  <span className="badge" style={{ background: '#DBEAFE', color: '#1E40AF' }}>
                    {paciente.totalConsultas}
                  </span>
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleVerPaciente(paciente)}
                  >
                    <Eye className="button-icon" /> Ver Paciente
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <div className="empty-state">
            <p>Cargando pacientes...</p>
          </div>
        )}
        {!loading && filteredPacientes.length === 0 && (
          <div className="empty-state">
            <Users className="empty-icon" />
            <p>No hay pacientes registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};
