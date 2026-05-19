import { useState, useEffect } from "react";
import { Users, Plus, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const UsersTab = ({ users, fetchData, token, user: currentUser }) => {
  const [dialog, setDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    nombre_completo: "",
    role: "Recepcion",
    especialidad: "",
    doctor_id: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log("=== SUBMIT INICIADO ===");
    console.log("Form completo:", form);
    console.log("Rol:", form.role);
    console.log("Especialidad:", form.especialidad);
    
    // Validación: si es Doctor, especialidad es requerida
    if (form.role === "Doctor" && !form.especialidad) {
      toast.error("Debe seleccionar una especialidad para el Doctor");
      return;
    }
    
    setLoading(true);

    try {
      if (editingUser) {
        // Update user
        const updateData = { ...form };
        if (!updateData.password) {
          delete updateData.password;
        }
        
        await axios.put(`${API}/users/${editingUser.id}`, updateData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success("Usuario actualizado exitosamente");
      } else {
        // Create user - limpiar campos vacíos
        const payload = {
          username: form.username,
          email: form.email,
          nombre_completo: form.nombre_completo,
          role: form.role,
          password: form.password
        };
        
        // Solo agregar especialidad si tiene valor (para Doctores)
        if (form.especialidad) {
          payload.especialidad = form.especialidad;
        }
        
        // NO enviar doctor_id vacío - el backend lo auto-crea
        
        console.log("=== ENVIANDO PAYLOAD ===");
        console.log("URL:", `${API}/auth/register`);
        console.log("Payload:", payload);
        
        const response = await axios.post(`${API}/auth/register`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("=== RESPUESTA ===");
        console.log("Response:", response.data);
        
        toast.success("Usuario creado exitosamente");
      }

      setDialog(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.log("=== ERROR ===");
      console.log("Error completo:", error);
      console.log("Response:", error.response);
      toast.error(error.response?.data?.detail || "Error al guardar usuario");
    }
    setLoading(false);
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      email: user.email,
      nombre_completo: user.nombre_completo,
      role: user.role,
      especialidad: user.especialidad || "",
      doctor_id: user.doctor_id || "",
      password: ""
    });
    setDialog(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este usuario?")) return;

    try {
      await axios.delete(`${API}/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Usuario eliminado exitosamente");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Error al eliminar usuario");
    }
  };

  const resetForm = () => {
    setForm({
      username: "",
      email: "",
      nombre_completo: "",
      role: "Recepcion",
      especialidad: "",
      doctor_id: "",
      password: ""
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Cargar doctores
  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API}/doctors`, { headers: authHeaders });
      setDoctors(response.data);
    } catch (error) {
      console.error("Error loading doctors:", error);
    }
  };

  // Cargar especialidades desde BD
  const fetchEspecialidades = async () => {
    try {
      const response = await axios.get(`${API}/especialidades`, { headers: authHeaders });
      setEspecialidades(response.data);
    } catch (error) {
      console.error("Error loading especialidades:", error);
    }
  };

  // useEffect para cargar datos al montar
  useEffect(() => {
    if (token) {
      fetchDoctors();
      fetchEspecialidades();
    }
  }, [token]);

  if (currentUser?.role !== "Administrador") {
    return (
      <div className="tab-content">
        <p className="section-subtitle">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="section-header">
        <div>
          <h2 className="section-title">Gestión de Usuarios</h2>
          <p className="section-subtitle">{users.length} usuarios registrados</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Dialog open={dialog} onOpenChange={(open) => { setDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="add-button" data-testid="add-user-button">
                <Plus className="button-icon" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
          <DialogContent className="dialog-content">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <Label>Nombre Completo</Label>
                  <Input
                    data-testid="user-fullname-input"
                    value={form.nombre_completo}
                    onChange={(e) => setForm({...form, nombre_completo: e.target.value})}
                    placeholder="Ej: Dr. Juan Pérez"
                    required
                  />
                </div>

                <div className="form-field">
                  <Label>Usuario</Label>
                  <Input
                    data-testid="user-username-input"
                    value={form.username}
                    onChange={(e) => setForm({...form, username: e.target.value})}
                    placeholder="Ej: jperez"
                    required
                    disabled={editingUser !== null}
                  />
                </div>

                <div className="form-field">
                  <Label>Email</Label>
                  <Input
                    data-testid="user-email-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({...form, email: e.target.value})}
                    placeholder="ejemplo@familyhealth.com"
                    required
                  />
                </div>

                <div className="form-field">
                  <Label>Rol</Label>
                  <Select value={form.role} onValueChange={(val) => setForm({...form, role: val})}>
                    <SelectTrigger data-testid="user-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Administrador">Administrador</SelectItem>
                      <SelectItem value="Recepcion">Recepción</SelectItem>
                      <SelectItem value="Doctor">Doctor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mostrar selector de especialidad solo si el rol es Doctor */}
                {form.role === "Doctor" && (
                  <div className="form-field">
                    <Label>Especialidad *</Label>
                    <Select 
                      value={form.especialidad} 
                      onValueChange={(val) => setForm({...form, especialidad: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione especialidad" />
                      </SelectTrigger>
                      <SelectContent style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {especialidades.length > 0 ? (
                          especialidades.filter(esp => esp.activa).map((esp) => (
                            <SelectItem key={esp.id} value={esp.nombre}>
                              {esp.nombre}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="Medicina General">Medicina General</SelectItem>
                            <SelectItem value="Odontología">Odontología</SelectItem>
                            <SelectItem value="Pediatría">Pediatría</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '4px' }}>
                      Al guardar se creará automáticamente el doctor vinculado
                    </p>
                  </div>
                )}

                <div className="form-field full-width">
                  <Label>{editingUser ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña"}</Label>
                  <div style={{ position: 'relative' }}>
                    <Input
                      data-testid="user-password-input"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm({...form, password: e.target.value})}
                      placeholder="Mínimo 6 caracteres"
                      required={!editingUser}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#64748B'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={loading} data-testid="save-user-button">
                  {loading ? "Guardando..." : editingUser ? "Actualizar" : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Especialidad</th>
              <th>Estado</th>
              <th className="actions-column">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} data-testid={`user-row-${user.id}`}>
                <td><strong>{user.nombre_completo}</strong></td>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge role-${user.role.toLowerCase()}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  {user.role === 'Doctor' && user.especialidad ? (
                    <span className="badge" style={{background: '#E0F2FE', color: '#0C4A6E'}}>
                      {user.especialidad}
                    </span>
                  ) : (
                    <span style={{color: '#94A3B8'}}>-</span>
                  )}
                </td>
                <td>
                  <span className={user.is_active ? "status-active" : "status-inactive"}>
                    {user.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="actions-cell">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(user)}
                    data-testid={`edit-user-${user.id}`}
                  >
                    <Edit className="action-icon" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(user.id)}
                    data-testid={`delete-user-${user.id}`}
                  >
                    <Trash2 className="action-icon delete-icon" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="empty-state">
            <Users className="empty-icon" />
            <p>No hay usuarios registrados</p>
          </div>
        )}
      </div>
    </div>
  );
};
