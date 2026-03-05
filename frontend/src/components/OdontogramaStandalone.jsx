import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";
import { Search, User, Plus } from "lucide-react";
import { OdontogramaClinicoTab } from "./OdontogramaClinicoTab";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const OdontogramaStandalone = ({ token, user }) => {
  const [pacientes, setPacientes] = useState([]);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [odontogramasRecientes, setOdontogramasRecientes] = useState([]);

  useEffect(() => {
    fetchPacientes();
    fetchOdontogramasRecientes();
  }, []);

  const fetchPacientes = async () => {
    try {
      // Buscar en pacientes registrados
      const resPacientes = await axios.get(`${API}/pacientes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // También buscar en citas de odontología
      const resCitas = await axios.get(`${API}/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Combinar y deduplicar por cédula
      const pacientesMap = new Map();
      
      resPacientes.data?.forEach(p => {
        if (p.cedula) {
          pacientesMap.set(p.cedula, {
            id: p.id,
            nombre: p.nombre_completo || p.nombre,
            cedula: p.cedula
          });
        }
      });
      
      resCitas.data?.filter(c => c.especialidad === "Odontología").forEach(c => {
        if (c.cedula && !pacientesMap.has(c.cedula)) {
          pacientesMap.set(c.cedula, {
            id: c.id,
            nombre: c.nombre_completo,
            cedula: c.cedula
          });
        }
      });
      
      setPacientes(Array.from(pacientesMap.values()));
    } catch (error) {
      console.error("Error al cargar pacientes:", error);
    }
  };

  const fetchOdontogramasRecientes = async () => {
    try {
      const response = await axios.get(`${API}/odontograma-clinico`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOdontogramasRecientes(response.data?.slice(0, 10) || []);
    } catch (error) {
      console.error("Error al cargar odontogramas:", error);
    }
  };

  const handleSeleccionarPaciente = (paciente) => {
    setPacienteSeleccionado(paciente);
  };

  const handleBuscarPaciente = () => {
    if (!busqueda) return;
    
    const encontrado = pacientes.find(p => 
      p.cedula?.includes(busqueda) || 
      p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    );
    
    if (encontrado) {
      setPacienteSeleccionado(encontrado);
    } else {
      toast.error("Paciente no encontrado");
    }
  };

  const handleSeleccionarOdontogramaReciente = async (odontograma) => {
    setPacienteSeleccionado({
      id: odontograma.paciente_id,
      nombre: odontograma.paciente_nombre,
      cedula: odontograma.paciente_cedula
    });
  };

  const pacientesFiltrados = pacientes.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.cedula?.includes(busqueda)
  ).slice(0, 20);

  // Si hay paciente seleccionado, mostrar el odontograma
  if (pacienteSeleccionado) {
    return (
      <div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1rem',
          padding: '1rem',
          background: '#F0F9FF',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <User size={24} color="#0284C7" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                {pacienteSeleccionado.nombre}
              </div>
              <div style={{ color: '#64748B', fontSize: '0.875rem' }}>
                Cédula: {pacienteSeleccionado.cedula}
              </div>
            </div>
          </div>
          <Button 
            variant="outline"
            onClick={() => setPacienteSeleccionado(null)}
          >
            Cambiar Paciente
          </Button>
        </div>
        
        <OdontogramaClinicoTab
          token={token}
          pacienteId={pacienteSeleccionado.id}
          pacienteNombre={pacienteSeleccionado.nombre}
          pacienteCedula={pacienteSeleccionado.cedula}
          doctorId={user?.doctor_id || ""}
        />
      </div>
    );
  }

  // Pantalla de selección de paciente
  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Odontograma Clínico</h2>
          <p className="section-subtitle">
            Seleccione un paciente para ver o crear su odontograma
          </p>
        </div>
      </div>

      {/* Búsqueda de paciente */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        alignItems: 'flex-end'
      }}>
        <div style={{ flex: 1 }}>
          <Label>Buscar por nombre o cédula</Label>
          <Input
            placeholder="Ingrese nombre o cédula del paciente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscarPaciente()}
          />
        </div>
        <Button onClick={handleBuscarPaciente}>
          <Search size={16} style={{ marginRight: '0.5rem' }} />
          Buscar
        </Button>
      </div>

      {/* Lista de pacientes filtrados */}
      {busqueda && pacientesFiltrados.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ marginBottom: '0.75rem', color: '#4B5563' }}>
            Resultados de búsqueda
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {pacientesFiltrados.map(paciente => (
              <div
                key={paciente.cedula}
                onClick={() => handleSeleccionarPaciente(paciente)}
                style={{
                  padding: '1rem',
                  background: '#F9FAFB',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: '1px solid #E5E7EB',
                  transition: 'all 0.2s'
                }}
                className="hover-card"
              >
                <div style={{ fontWeight: 600 }}>{paciente.nombre}</div>
                <div style={{ color: '#64748B', fontSize: '0.875rem' }}>
                  {paciente.cedula}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Odontogramas recientes */}
      {odontogramasRecientes.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '0.75rem', color: '#4B5563' }}>
            Odontogramas Recientes
          </h4>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Paciente</th>
                  <th>Cédula</th>
                  <th>Dentición</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {odontogramasRecientes.map(odonto => (
                  <tr key={odonto.id}>
                    <td>{odonto.fecha}</td>
                    <td><strong>{odonto.paciente_nombre}</strong></td>
                    <td>{odonto.paciente_cedula}</td>
                    <td>
                      <span className="badge" style={{ textTransform: 'capitalize' }}>
                        {odonto.tipo_denticion}
                      </span>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        onClick={() => handleSeleccionarOdontogramaReciente(odonto)}
                      >
                        Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mensaje si no hay datos */}
      {pacientes.length === 0 && odontogramasRecientes.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          color: '#6B7280'
        }}>
          <User size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No hay pacientes registrados aún.</p>
          <p style={{ fontSize: '0.875rem' }}>
            Los pacientes aparecerán aquí cuando se registren citas de Odontología.
          </p>
        </div>
      )}
    </div>
  );
};

export default OdontogramaStandalone;
