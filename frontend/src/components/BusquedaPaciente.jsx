import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Check, X } from 'lucide-react';
import { calcularEdad, formatearEdad, validarFechaNacimiento } from '@/lib/edadUtils';

/**
 * Componente reutilizable para buscar pacientes por cédula
 * Usa la función de unificación del backend
 * 
 * Props:
 * - onPacienteSeleccionado: callback con datos del paciente
 * - cedulaInicial: cédula pre-cargada (opcional)
 * - mostrarFormularioCompleto: si true, muestra campos adicionales
 */
const BusquedaPaciente = ({ 
  onPacienteSeleccionado, 
  cedulaInicial = '',
  mostrarFormularioCompleto = false 
}) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';
  const token = localStorage.getItem('token');

  const [cedula, setCedula] = useState(cedulaInicial);
  const [buscando, setBuscando] = useState(false);
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  // Datos del formulario para paciente nuevo
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    direccion: '',
    fecha_nacimiento: '',
    sexo: ''
  });

  useEffect(() => {
    if (cedulaInicial) {
      buscarPaciente(cedulaInicial);
    }
  }, [cedulaInicial]);

  const buscarPaciente = async (cedulaBuscar) => {
    if (!cedulaBuscar || cedulaBuscar.trim() === '') {
      return;
    }

    setBuscando(true);
    try {
      const response = await fetch(
        `${API_URL}/financial/pacientes?search=${cedulaBuscar}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const pacientes = await response.json();
        const paciente = pacientes.find(p => p.cedula === cedulaBuscar);
        
        if (paciente) {
          setPacienteEncontrado(paciente);
          setFormData({
            nombre: paciente.nombre || '',
            telefono: paciente.telefono || '',
            email: paciente.email || '',
            direccion: paciente.direccion || '',
            fecha_nacimiento: paciente.fecha_nacimiento || '',
            sexo: paciente.sexo || ''
          });
          setMostrarFormulario(false);
          
          // Notificar al componente padre
          if (onPacienteSeleccionado) {
            onPacienteSeleccionado(paciente);
          }
        } else {
          // No existe, mostrar formulario para crear
          setPacienteEncontrado(null);
          setMostrarFormulario(true);
          setFormData({
            nombre: '',
            telefono: '',
            email: '',
            direccion: '',
            fecha_nacimiento: '',
            sexo: ''
          });
        }
      }
    } catch (error) {
      console.error('Error buscando paciente:', error);
      setMostrarFormulario(true);
    } finally {
      setBuscando(false);
    }
  };

  const handleBuscar = () => {
    buscarPaciente(cedula);
  };

  const handleFormChange = (field, value) => {
    const nuevosDatos = { ...formData, [field]: value };
    setFormData(nuevosDatos);
    
    // Notificar al componente padre con datos parciales
    if (onPacienteSeleccionado) {
      onPacienteSeleccionado({
        cedula,
        ...nuevosDatos
      });
    }
  };

  const limpiar = () => {
    setCedula('');
    setPacienteEncontrado(null);
    setMostrarFormulario(false);
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      direccion: '',
      fecha_nacimiento: '',
      sexo: ''
    });
    if (onPacienteSeleccionado) {
      onPacienteSeleccionado(null);
    }
  };

  // Calcular edad para mostrar
  const edadCalculada = formData.fecha_nacimiento ? formatearEdad(formData.fecha_nacimiento) : '';

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <Search className="w-5 h-5" />
        Buscar Paciente
      </h3>

      {/* Búsqueda por cédula */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cédula del Paciente *
          </label>
          <input
            type="text"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleBuscar()}
            placeholder="Ingrese cédula..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={buscando}
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={handleBuscar}
            disabled={buscando || !cedula}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
          {(pacienteEncontrado || mostrarFormulario) && (
            <button
              onClick={limpiar}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Paciente encontrado */}
      {pacienteEncontrado && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
            <Check className="w-5 h-5" />
            Paciente Encontrado
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium">Nombre:</span> {pacienteEncontrado.nombre}
            </div>
            <div>
              <span className="font-medium">Teléfono:</span> {pacienteEncontrado.telefono || 'N/A'}
            </div>
            {pacienteEncontrado.fecha_nacimiento && (
              <div>
                <span className="font-medium">Edad:</span> {formatearEdad(pacienteEncontrado.fecha_nacimiento)}
              </div>
            )}
            {pacienteEncontrado.email && (
              <div>
                <span className="font-medium">Email:</span> {pacienteEncontrado.email}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formulario para paciente nuevo */}
      {mostrarFormulario && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 font-semibold mb-3">
            <UserPlus className="w-5 h-5" />
            Paciente Nuevo - Complete los datos
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleFormChange('nombre', e.target.value)}
                placeholder="Nombre completo del paciente"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de Nacimiento *
              </label>
              <input
                type="date"
                value={formData.fecha_nacimiento}
                onChange={(e) => handleFormChange('fecha_nacimiento', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                required
              />
              {formData.fecha_nacimiento && validarFechaNacimiento(formData.fecha_nacimiento) && (
                <p className="text-xs text-gray-600 mt-1">
                  Edad: <span className="font-semibold">{edadCalculada}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={formData.telefono}
                onChange={(e) => handleFormChange('telefono', e.target.value)}
                placeholder="Teléfono"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            {mostrarFormularioCompleto && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    placeholder="Email"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sexo
                  </label>
                  <select
                    value={formData.sexo}
                    onChange={(e) => handleFormChange('sexo', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) => handleFormChange('direccion', e.target.value)}
                    placeholder="Dirección"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-gray-600 mt-3">
            * El paciente se creará automáticamente al guardar la cita/consulta
          </p>
        </div>
      )}
    </div>
  );
};

export default BusquedaPaciente;

  const buscarPaciente = async (cedulaBuscar) => {
    if (!cedulaBuscar || cedulaBuscar.trim() === '') {
      return;
    }

    setBuscando(true);
    try {
      const response = await fetch(
        `${API_URL}/financial/pacientes?search=${cedulaBuscar}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const pacientes = await response.json();
        const paciente = pacientes.find(p => p.cedula === cedulaBuscar);
        
        if (paciente) {
          setPacienteEncontrado(paciente);
          setFormData({
            nombre: paciente.nombre || '',
            telefono: paciente.telefono || '',
            email: paciente.email || '',
            direccion: paciente.direccion || '',
            fecha_nacimiento: paciente.fecha_nacimiento || '',
            sexo: paciente.sexo || ''
          });
          setMostrarFormulario(false);
          
          // Notificar al componente padre
          if (onPacienteSeleccionado) {
            onPacienteSeleccionado(paciente);
          }
        } else {
          // No existe, mostrar formulario para crear
          setPacienteEncontrado(null);
          setMostrarFormulario(true);
          setFormData({
            nombre: '',
            telefono: '',
            email: '',
            direccion: '',
            fecha_nacimiento: '',
            sexo: ''
          });
        }
      }
    } catch (error) {
      console.error('Error buscando paciente:', error);
      setMostrarFormulario(true);
    } finally {
      setBuscando(false);
    }
  };

  const handleBuscar = () => {
    buscarPaciente(cedula);
  };

  const handleFormChange = (field, value) => {
    const nuevosDatos = { ...formData, [field]: value };
    setFormData(nuevosDatos);
    
    // Notificar al componente padre con datos parciales
    if (onPacienteSeleccionado) {
      onPacienteSeleccionado({
        cedula,
        ...nuevosDatos
      });
    }
  };

  const limpiar = () => {
    setCedula('');
    setPacienteEncontrado(null);
    setMostrarFormulario(false);
    setFormData({
      nombre: '',
      telefono: '',
      email: '',
      direccion: '',
      fecha_nacimiento: '',
      sexo: ''
    });
    if (onPacienteSeleccionado) {
      onPacienteSeleccionado(null);
    }

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <Search className="w-5 h-5" />
        Buscar Paciente
      </h3>

      {/* Búsqueda por cédula */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cédula del Paciente *
          </label>
          <input
            type="text"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleBuscar()}
            placeholder="Ingrese cédula..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={buscando}
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={handleBuscar}
            disabled={buscando || !cedula}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
          {(pacienteEncontrado || mostrarFormulario) && (
            <button
              onClick={limpiar}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Paciente encontrado */}
      {pacienteEncontrado && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800 font-semibold mb-2">
            <Check className="w-5 h-5" />
            Paciente Encontrado
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium">Nombre:</span> {pacienteEncontrado.nombre}
            </div>
            <div>
              <span className="font-medium">Teléfono:</span> {pacienteEncontrado.telefono || 'N/A'}
            </div>
            {pacienteEncontrado.email && (
              <div>
                <span className="font-medium">Email:</span> {pacienteEncontrado.email}
              </div>
            )}
            {pacienteEncontrado.fecha_nacimiento && (
              <div>
                <span className="font-medium">Fecha Nac.:</span> {pacienteEncontrado.fecha_nacimiento}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formulario para paciente nuevo */}
      {mostrarFormulario && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 font-semibold mb-3">
            <UserPlus className="w-5 h-5" />
            Paciente Nuevo - Complete los datos
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleFormChange('nombre', e.target.value)}
                placeholder="Nombre completo del paciente"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={formData.telefono}
                onChange={(e) => handleFormChange('telefono', e.target.value)}
                placeholder="Teléfono"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            {mostrarFormularioCompleto && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    placeholder="Email"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value={formData.fecha_nacimiento}
                    onChange={(e) => handleFormChange('fecha_nacimiento', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sexo
                  </label>
                  <select
                    value={formData.sexo}
                    onChange={(e) => handleFormChange('sexo', e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.direccion}
                    onChange={(e) => handleFormChange('direccion', e.target.value)}
                    placeholder="Dirección"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </>
            )}
          </div>

          <p className="text-xs text-gray-600 mt-3">
            * El paciente se creará automáticamente al guardar la cita/consulta
          </p>
        </div>
      )}
    </div>
  );
};

export default BusquedaPaciente;
