import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { 
  Plus, Trash2, Edit2, Check, X, RefreshCw, 
  FileText, ChevronDown, ChevronUp, Wand2,
  ClipboardList
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Procedimientos disponibles
const PROCEDIMIENTOS_DISPONIBLES = [
  "Profilaxis",
  "Resina simple",
  "Resina compuesta",
  "Resina compleja",
  "Corona",
  "Extracción",
  "Endodoncia",
  "Sellante",
  "Pulpotomía",
  "Pulpectomía",
  "Incrustación",
  "Carilla",
  "Puente",
  "Implante",
  "Periodoncia",
  "Blanqueamiento",
  "Ortodoncia - Inicio",
  "Ortodoncia - Control",
  "Cirugía menor",
  "Otro"
];

// Colores por estado
const ESTADO_COLORS = {
  pendiente: { bg: "#FEF3C7", color: "#92400E", label: "Pendiente" },
  realizado: { bg: "#D1FAE5", color: "#065F46", label: "Realizado" },
  cancelado: { bg: "#FEE2E2", color: "#991B1B", label: "Cancelado" }
};

export const PlanTratamientoTab = ({ 
  token, 
  pacienteId, 
  pacienteNombre, 
  pacienteCedula, 
  doctorId,
  odontogramaId 
}) => {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedFases, setExpandedFases] = useState({ 1: true, 2: true, 3: true });
  
  // Dialog para agregar/editar procedimiento
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProc, setEditingProc] = useState(null);
  const [formProc, setFormProc] = useState({
    diente_numero: "",
    procedimiento: "",
    descripcion: "",
    fase: 1,
    precio: 0,
    notas: ""
  });

  useEffect(() => {
    if (pacienteCedula) {
      buscarPlanExistente();
    }
  }, [pacienteCedula]);

  const buscarPlanExistente = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/plan-tratamiento/paciente/${pacienteCedula}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data) {
        setPlan(response.data);
      } else {
        // Crear nuevo plan
        await crearNuevoPlan();
      }
    } catch (error) {
      console.log("No se encontró plan, creando uno nuevo...");
      await crearNuevoPlan();
    }
    setLoading(false);
  };

  const crearNuevoPlan = async () => {
    try {
      const response = await axios.post(
        `${API}/plan-tratamiento`,
        {
          paciente_id: pacienteId,
          paciente_cedula: pacienteCedula,
          paciente_nombre: pacienteNombre,
          doctor_id: doctorId || "",
          odontograma_id: odontogramaId || ""
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Obtener el plan creado
      const planResponse = await axios.get(
        `${API}/plan-tratamiento/${response.data.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPlan(planResponse.data);
      toast.success("Plan de tratamiento creado");
    } catch (error) {
      console.error("Error al crear plan:", error);
      toast.error("Error al crear plan de tratamiento");
    }
  };

  const generarDesdeOdontograma = async () => {
    if (!plan || !odontogramaId) {
      toast.error("Se requiere un odontograma para generar procedimientos");
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/plan-tratamiento/${plan.id}/generar-desde-odontograma/${odontogramaId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`${response.data.total} procedimientos generados`);
      await buscarPlanExistente();
    } catch (error) {
      console.error("Error al generar procedimientos:", error);
      toast.error("Error al generar procedimientos desde odontograma");
    }
    setLoading(false);
  };

  const handleAddProcedimiento = () => {
    setEditingProc(null);
    setFormProc({
      diente_numero: "",
      procedimiento: "",
      descripcion: "",
      fase: 1,
      precio: 0,
      notas: ""
    });
    setDialogOpen(true);
  };

  const handleEditProcedimiento = (proc) => {
    setEditingProc(proc);
    setFormProc({
      diente_numero: proc.diente_numero,
      procedimiento: proc.procedimiento,
      descripcion: proc.descripcion || "",
      fase: proc.fase,
      precio: proc.precio || 0,
      notas: proc.notas || ""
    });
    setDialogOpen(true);
  };

  const handleSaveProcedimiento = async () => {
    if (!formProc.procedimiento) {
      toast.error("Seleccione un procedimiento");
      return;
    }
    
    try {
      if (editingProc) {
        // Actualizar
        await axios.put(
          `${API}/plan-tratamiento/${plan.id}/procedimiento/${editingProc.id}`,
          formProc,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Procedimiento actualizado");
      } else {
        // Crear
        await axios.post(
          `${API}/plan-tratamiento/${plan.id}/procedimiento`,
          formProc,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success("Procedimiento agregado");
      }
      
      setDialogOpen(false);
      await buscarPlanExistente();
    } catch (error) {
      console.error("Error al guardar procedimiento:", error);
      toast.error("Error al guardar procedimiento");
    }
  };

  const handleDeleteProcedimiento = async (procId) => {
    if (!window.confirm("¿Eliminar este procedimiento?")) return;
    
    try {
      await axios.delete(
        `${API}/plan-tratamiento/${plan.id}/procedimiento/${procId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Procedimiento eliminado");
      await buscarPlanExistente();
    } catch (error) {
      console.error("Error al eliminar:", error);
      toast.error("Error al eliminar procedimiento");
    }
  };

  const handleToggleEstado = async (proc) => {
    const nuevoEstado = proc.estado === 'pendiente' ? 'realizado' : 'pendiente';
    
    try {
      await axios.put(
        `${API}/plan-tratamiento/${plan.id}/procedimiento/${proc.id}`,
        { estado: nuevoEstado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await buscarPlanExistente();
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      toast.error("Error al cambiar estado");
    }
  };

  const handleChangeFase = async (proc, nuevaFase) => {
    try {
      await axios.put(
        `${API}/plan-tratamiento/${plan.id}/procedimiento/${proc.id}`,
        { fase: nuevaFase },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await buscarPlanExistente();
    } catch (error) {
      console.error("Error al cambiar fase:", error);
    }
  };

  // Agrupar procedimientos por fase
  const procedimientosPorFase = () => {
    if (!plan?.procedimientos) return {};
    
    const grupos = {};
    plan.procedimientos.forEach(proc => {
      const fase = proc.fase || 1;
      if (!grupos[fase]) {
        grupos[fase] = [];
      }
      grupos[fase].push(proc);
    });
    
    return grupos;
  };

  const fases = procedimientosPorFase();
  const totalProcedimientos = plan?.procedimientos?.length || 0;
  const procedimientosRealizados = plan?.procedimientos?.filter(p => p.estado === 'realizado').length || 0;

  if (loading && !plan) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Cargando plan de tratamiento...</p>
      </div>
    );
  }

  return (
    <div className="plan-tratamiento-tab" style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1E3A5F' }}>
            Plan de Tratamiento
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
            {pacienteNombre} • {pacienteCedula}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {odontogramaId && (
            <Button 
              onClick={generarDesdeOdontograma}
              variant="outline"
              disabled={loading}
            >
              <Wand2 size={16} style={{ marginRight: '0.5rem' }} />
              Generar desde Odontograma
            </Button>
          )}
          <Button onClick={handleAddProcedimiento}>
            <Plus size={16} style={{ marginRight: '0.5rem' }} />
            Agregar Procedimiento
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ 
          background: '#F0F9FF', 
          padding: '1rem', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0369A1' }}>
            {totalProcedimientos}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>Total Procedimientos</div>
        </div>
        <div style={{ 
          background: '#F0FDF4', 
          padding: '1rem', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#15803D' }}>
            {procedimientosRealizados}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>Realizados</div>
        </div>
        <div style={{ 
          background: '#FFFBEB', 
          padding: '1rem', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#B45309' }}>
            {totalProcedimientos - procedimientosRealizados}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#6B7280' }}>Pendientes</div>
        </div>
      </div>

      {/* Lista de Fases */}
      {Object.keys(fases).length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          background: '#F9FAFB',
          borderRadius: '8px'
        }}>
          <ClipboardList size={48} style={{ color: '#9CA3AF', marginBottom: '1rem' }} />
          <p style={{ color: '#6B7280' }}>No hay procedimientos en el plan</p>
          <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>
            Usa "Generar desde Odontograma" o agrega procedimientos manualmente
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.keys(fases).sort((a, b) => Number(a) - Number(b)).map(faseNum => (
            <div 
              key={faseNum}
              style={{ 
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            >
              {/* Header de Fase */}
              <div 
                style={{ 
                  background: '#F3F4F6',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onClick={() => setExpandedFases(prev => ({
                  ...prev,
                  [faseNum]: !prev[faseNum]
                }))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold', color: '#374151' }}>
                    Fase {faseNum}
                  </span>
                  <span style={{ 
                    background: '#E5E7EB',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.8rem',
                    color: '#6B7280'
                  }}>
                    {fases[faseNum].length} procedimientos
                  </span>
                </div>
                {expandedFases[faseNum] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
              
              {/* Lista de procedimientos */}
              {expandedFases[faseNum] && (
                <div style={{ padding: '0.5rem' }}>
                  {fases[faseNum].map(proc => (
                    <div 
                      key={proc.id}
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem',
                        borderBottom: '1px solid #F3F4F6',
                        gap: '1rem'
                      }}
                    >
                      {/* Checkbox estado */}
                      <button
                        onClick={() => handleToggleEstado(proc)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          border: proc.estado === 'realizado' ? 'none' : '2px solid #D1D5DB',
                          background: proc.estado === 'realizado' ? '#10B981' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {proc.estado === 'realizado' && <Check size={16} color="white" />}
                      </button>
                      
                      {/* Info del procedimiento */}
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: '500',
                          textDecoration: proc.estado === 'realizado' ? 'line-through' : 'none',
                          color: proc.estado === 'realizado' ? '#9CA3AF' : '#374151'
                        }}>
                          {proc.procedimiento}
                          {proc.diente_numero && (
                            <span style={{ 
                              marginLeft: '0.5rem',
                              background: '#E0F2FE',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              color: '#0369A1'
                            }}>
                              Diente {proc.diente_numero}
                            </span>
                          )}
                        </div>
                        {proc.descripcion && (
                          <div style={{ fontSize: '0.85rem', color: '#6B7280', marginTop: '0.25rem' }}>
                            {proc.descripcion}
                          </div>
                        )}
                        {proc.superficies_afectadas?.length > 0 && (
                          <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '0.25rem' }}>
                            Superficies: {proc.superficies_afectadas.join(', ')}
                          </div>
                        )}
                      </div>
                      
                      {/* Selector de fase */}
                      <Select 
                        value={String(proc.fase)} 
                        onValueChange={(val) => handleChangeFase(proc, Number(val))}
                      >
                        <SelectTrigger style={{ width: '100px' }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Fase 1</SelectItem>
                          <SelectItem value="2">Fase 2</SelectItem>
                          <SelectItem value="3">Fase 3</SelectItem>
                          <SelectItem value="4">Fase 4</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Precio */}
                      {proc.precio > 0 && (
                        <span style={{ color: '#059669', fontWeight: '500' }}>
                          ${proc.precio.toFixed(2)}
                        </span>
                      )}
                      
                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditProcedimiento(proc)}
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteProcedimiento(proc.id)}
                        >
                          <Trash2 size={16} color="#EF4444" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog para agregar/editar procedimiento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProc ? 'Editar Procedimiento' : 'Agregar Procedimiento'}
            </DialogTitle>
          </DialogHeader>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <Label>Procedimiento *</Label>
                <Select 
                  value={formProc.procedimiento} 
                  onValueChange={(val) => setFormProc({...formProc, procedimiento: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROCEDIMIENTOS_DISPONIBLES.map(proc => (
                      <SelectItem key={proc} value={proc}>{proc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Diente (FDI)</Label>
                <Input
                  value={formProc.diente_numero}
                  onChange={(e) => setFormProc({...formProc, diente_numero: e.target.value})}
                  placeholder="Ej: 16, 26, 36..."
                />
              </div>
            </div>
            
            <div>
              <Label>Descripción</Label>
              <Input
                value={formProc.descripcion}
                onChange={(e) => setFormProc({...formProc, descripcion: e.target.value})}
                placeholder="Descripción del procedimiento..."
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <Label>Fase</Label>
                <Select 
                  value={String(formProc.fase)} 
                  onValueChange={(val) => setFormProc({...formProc, fase: Number(val)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Fase 1</SelectItem>
                    <SelectItem value="2">Fase 2</SelectItem>
                    <SelectItem value="3">Fase 3</SelectItem>
                    <SelectItem value="4">Fase 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Precio ($)</Label>
                <Input
                  type="number"
                  value={formProc.precio}
                  onChange={(e) => setFormProc({...formProc, precio: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <Label>Notas</Label>
              <Textarea
                value={formProc.notas}
                onChange={(e) => setFormProc({...formProc, notas: e.target.value})}
                placeholder="Notas adicionales..."
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProcedimiento}>
              {editingProc ? 'Guardar Cambios' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlanTratamientoTab;
