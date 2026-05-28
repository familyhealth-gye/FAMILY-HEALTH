/**
 * DoctoresTab.jsx
 * Gestión de doctores — extraído de App.js (LegacyApp inline).
 * Mantiene el mismo comportamiento y UI exacta.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Edit, Trash2 } from "lucide-react";
import apiClient from "@/lib/axios";

/**
 * Props:
 *   doctors     — array de doctores (viene de useAppData)
 *   specialties — array de strings de especialidades
 *   fetchData   — callback para refrescar tras guardar/eliminar
 */
export function DoctoresTab({ doctors = [], specialties = [], fetchData }) {
  const [dialog,        setDialog]        = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [form,          setForm]          = useState({ nombre: "", especialidad: "", porcentaje: 50 });
  const [saving,        setSaving]        = useState(false);

  const openNew = () => {
    setEditingDoctor(null);
    setForm({ nombre: "", especialidad: "", porcentaje: 50 });
    setDialog(true);
  };

  const openEdit = (doctor) => {
    setEditingDoctor(doctor);
    setForm({ nombre: doctor.nombre, especialidad: doctor.especialidad, porcentaje: doctor.porcentaje });
    setDialog(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingDoctor) {
        await apiClient.put(`/doctors/${editingDoctor.id}`, form);
        toast.success("Doctor actualizado exitosamente");
      } else {
        await apiClient.post("/doctors", form);
        toast.success("Doctor registrado exitosamente");
      }
      setDialog(false);
      setEditingDoctor(null);
      setForm({ nombre: "", especialidad: "", porcentaje: 50 });
      fetchData();
    } catch {
      toast.error("Error al guardar el doctor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este doctor?")) return;
    try {
      await apiClient.delete(`/doctors/${id}`);
      toast.success("Doctor eliminado");
      fetchData();
    } catch {
      toast.error("Error al eliminar el doctor");
    }
  };

  return (
    <div>
      <div className="tab-header">
        <div className="tab-header-info">
          <h2 className="tab-title">Gestión de Doctores</h2>
          <p className="tab-description">Administre el personal médico y sus especialidades.</p>
        </div>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-medical-600 hover:bg-medical-700">
              <UserPlus className="button-icon" />
              Nuevo Doctor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDoctor ? "Editar Doctor" : "Nuevo Doctor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doc-name">Nombre Completo</Label>
                <Input
                  id="doc-name"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-specialty">Especialidad</Label>
                <Select
                  value={form.especialidad}
                  onValueChange={val => setForm(f => ({ ...f, especialidad: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione especialidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc-pct">Porcentaje Ganancia (%)</Label>
                <Input
                  id="doc-pct"
                  type="number"
                  value={form.porcentaje}
                  onChange={e => setForm(f => ({ ...f, porcentaje: parseFloat(e.target.value) }))}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid-container">
        {doctors.map(doctor => (
          <div key={doctor.id} className="card-item">
            <div className="card-content">
              <div className="card-info">
                <h3 className="card-name">{doctor.nombre}</h3>
                <p className="card-subtitle">{doctor.especialidad}</p>
                <p className="card-detail">Ganancia: {doctor.porcentaje}%</p>
              </div>
              <div className="card-actions">
                <Button variant="ghost" size="icon" onClick={() => openEdit(doctor)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(doctor.id)}
                  className="text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
