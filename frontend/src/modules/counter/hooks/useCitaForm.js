/**
 * useCitaForm.js
 * Hook que encapsula toda la lógica del modal de nueva cita:
 * - estado del formulario (cita + ficha clínica)
 * - autocarga de paciente por cédula
 * - carga de antecedentes previos
 * - submit con guardado dual (cita + antecedentes)
 * - gestión de tabs
 *
 * Separado de NuevaCitaModal.jsx para permitir reutilización
 * y mantener el componente puramente visual.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ─── Valores por defecto ────────────────────────────────────────────────────

export const ESPECIALIDADES = [
  "Medicina General", "Odontología", "Pediatría", "Nutrición",
  "Ginecología", "Ginecología/Obstetricia", "Obstetricia", "Ecografía",
];

const getLocalDate = () => new Date().toLocaleDateString("en-CA");

export function defaultCita(user, paciente, fromPatient) {
  return {
    nombre_completo:  paciente?.nombre_completo || paciente?.nombre || "",
    cedula:           paciente?.cedula  || "",
    telefono:         paciente?.telefono || "",
    fecha_nacimiento: "",
    sexo:             "",
    email:            "",
    direccion:        "",
    fecha:            getLocalDate(),
    hora:             "08:00",
    especialidad:     fromPatient ? (user?.especialidad || "") : "",
    doctor_nombre:    fromPatient ? (user?.nombre_completo || user?.nombre || "") : "",
    doctor_id:        fromPatient ? (user?.doctor_id || "") : "",
    observaciones:    "",
    // Representante (menores)
    es_menor:                 false,
    representante_nombre:     "",
    representante_cedula:     "",
    representante_telefono:   "",
    representante_parentesco: "",
  };
}

export function defaultFicha() {
  return {
    diabetes:       false,
    hipertension:   false,
    cardiopatias:   false,
    hepatitis:      false,
    vih:            false,
    epilepsia:      false,
    asma:           false,
    embarazo:       false,
    alergias_medicamentos:   "",
    medicamentos_actuales:   "",
    ant_personales:          "",
    ant_quirurgicos:         "",
    ant_familiares:          "",
    motivo_consulta:         "",
    observaciones_recepcion: "",
  };
}

// ─── Hook principal ─────────────────────────────────────────────────────────

export function useCitaForm({ isOpen, user, paciente, fromPatient, token, onClose, onSuccess }) {
  const [tab,          setTab]          = useState(0);
  const [cita,         setCita]         = useState(() => defaultCita(user, paciente, fromPatient));
  const [ficha,        setFicha]        = useState(() => defaultFicha());
  const [saving,       setSaving]       = useState(false);
  const [antecPreload, setAntecPreload] = useState(null);

  // Reset cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setTab(0);
      setCita(defaultCita(user, paciente, fromPatient));
      setFicha(defaultFicha());
      setAntecPreload(null);
    }
  }, [isOpen, paciente, fromPatient, user]);

  // Setters individuales
  const setC = useCallback((field, value) => setCita(f => ({ ...f, [field]: value })), []);
  const setF = useCallback((field, value) => setFicha(f => ({ ...f, [field]: value })), []);

  // Cargar antecedentes previos del paciente
  const cargarAntecedentes = useCallback(async (cedula) => {
    if (!cedula || cedula.length < 10 || !token) return;
    try {
      const res = await axios.get(`${API}/antecedentes-paciente/${cedula}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.tiene_antecedentes) {
        setAntecPreload(res.data);
        setFicha(f => ({
          ...f,
          diabetes:              res.data.diabetes      || f.diabetes,
          hipertension:          res.data.hipertension  || f.hipertension,
          cardiopatias:          res.data.cardiopatias  || f.cardiopatias,
          hepatitis:             res.data.hepatitis     || f.hepatitis,
          vih:                   res.data.vih           || f.vih,
          epilepsia:             res.data.epilepsia     || f.epilepsia,
          asma:                  res.data.asma          || f.asma,
          alergias_medicamentos: res.data.alergias_medicamentos || f.alergias_medicamentos,
          medicamentos_actuales: res.data.medicamentos_actuales || f.medicamentos_actuales,
          ant_personales:        res.data.ant_personales        || f.ant_personales,
          ant_quirurgicos:       res.data.ant_quirurgicos       || f.ant_quirurgicos,
          ant_familiares:        res.data.ant_familiares        || f.ant_familiares,
        }));
      }
    } catch {
      // Silencioso — no bloquear el flujo
    }
  }, [token]);

  // Autocompletar al tipear cédula
  const handleCedulaChange = useCallback(async (cedula) => {
    setC("cedula", cedula);
    if (cedula.length === 10 && token) {
      try {
        const res = await axios.get(`${API}/financial/pacientes?search=${cedula}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const pac = (res.data || []).find(p => p.cedula === cedula);
        if (pac) {
          setC("nombre_completo",  pac.nombre || pac.nombre_completo || "");
          setC("telefono",         pac.telefono         || "");
          setC("email",            pac.email            || "");
          setC("direccion",        pac.direccion        || "");
          setC("fecha_nacimiento", pac.fecha_nacimiento || "");
          setC("sexo",             pac.sexo             || "");
        }
      } catch {}
      await cargarAntecedentes(cedula);
    }
  }, [token, setC, cargarAntecedentes]);

  // Submit principal
  const handleSubmit = useCallback(async () => {
    if (!cita.nombre_completo.trim()) { toast.error("El nombre del paciente es obligatorio"); return; }
    if (!cita.fecha)                   { toast.error("La fecha es obligatoria");              return; }
    if (!cita.especialidad)            { toast.error("La especialidad es obligatoria");       return; }

    setSaving(true);
    try {
      // 1. Crear cita
      const payload = {
        ...cita,
        estado:         "Programada",
        observaciones:  ficha.motivo_consulta || cita.observaciones,
        motivo_consulta: ficha.motivo_consulta || cita.observaciones,
      };
      await axios.post(`${API}/appointments`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // 2. Guardar antecedentes si hay cédula y datos clínicos
      const hayFicha = Object.entries(ficha).some(([k, v]) => {
        if (k === "motivo_consulta" || k === "observaciones_recepcion") return false;
        return typeof v === "boolean" ? v : (v && v.toString().trim().length > 0);
      });

      if (cita.cedula && hayFicha) {
        try {
          await axios.put(`${API}/antecedentes-paciente/${cita.cedula}`, ficha, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // No bloquear si falla guardado de antecedentes
        }
      }

      toast.success("✅ Cita creada" + (hayFicha ? " con ficha clínica" : ""));
      onClose();
      if (onSuccess) onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  }, [cita, ficha, token, onClose, onSuccess]);

  return {
    // Estado
    tab, setTab,
    cita, setCita,
    ficha, setFicha,
    saving,
    antecPreload,
    // Setters de campo
    setC, setF,
    // Handlers
    handleCedulaChange,
    handleSubmit,
  };
}
