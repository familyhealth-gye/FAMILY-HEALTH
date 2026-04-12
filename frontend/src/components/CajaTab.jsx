import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Calendar, TrendingUp, FileText, CheckCircle, 
  Clock, CreditCard, Banknote, Smartphone, Search, X, Plus,
  Download, Printer
} from 'lucide-react';
import BusquedaPaciente from './BusquedaPaciente';

const CajaTab = () => {
  const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001/api';
  const token = localStorage.getItem('token');

  const [vistaActual, setVistaActual] = useState('resumen'); // resumen, pagos, pendientes, reportes, cierres
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Estados para resumen del día
  const [resumenDia, setResumenDia] = useState(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);

  // Estados para cuentas pendientes
  const [cuentasPendientes, setCuentasPendientes] = useState([]);
  const [cargandoPendientes, setCargandoPendientes] = useState(false);

  // Estados para registro de pago
  const [mostrarFormularioPago, setMostrarFormularioPago] = useState(false);
  const [consultaSeleccionada, setConsultaSeleccionada] = useState(null);
  const [montoPago, setMontoPago] = useState('');
  const [tipoPago, setTipoPago] = useState('efectivo');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [notasPago, setNotasPago] = useState('');

  // Estados para reportes
  const [reporteEspecialidad, setReporteEspecialidad] = useState(null);
  const [reporteDoctor, setReporteDoctor] = useState(null);
  const [reporteTipoPago, setReporteTipoPago] = useState(null);
  const [fechaInicioReporte, setFechaInicioReporte] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [fechaFinReporte, setFechaFinReporte] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Estados para cierre de caja
  const [cierresCaja, setCierresCaja] = useState([]);
  const [mostrarFormularioCierre, setMostrarFormularioCierre] = useState(false);
  const [observacionesCierre, setObservacionesCierre] = useState('');

  useEffect(() => {
    if (vistaActual === 'resumen') {
      cargarResumenDia();
    } else if (vistaActual === 'pendientes') {
      cargarCuentasPendientes();
    } else if (vistaActual === 'reportes') {
      cargarReportes();
    } else if (vistaActual === 'cierres') {
      cargarCierresCaja();
    }
  }, [vistaActual, fechaSeleccionada]);

  // ========== FUNCIONES DE CARGA ==========

  const cargarResumenDia = async () => {
    setCargandoResumen(true);
    try {
      const response = await fetch(
        `${API_URL}/financial/reportes/ingresos-del-dia?fecha=${fechaSeleccionada}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResumenDia(data);
      }
    } catch (error) {
      console.error('Error cargando resumen:', error);
    } finally {
      setCargandoResumen(false);
    }
  };

  const cargarCuentasPendientes = async () => {
    setCargandoPendientes(true);
    try {
      const response = await fetch(
        `${API_URL}/financial/reportes/pendientes`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCuentasPendientes(data.consultas || []);
      }
    } catch (error) {
      console.error('Error cargando pendientes:', error);
    } finally {
      setCargandoPendientes(false);
    }
  };

  const cargarReportes = async () => {
    try {
      // Reporte por especialidad
      const respEsp = await fetch(
        `${API_URL}/financial/reportes/por-especialidad?fecha_inicio=${fechaInicioReporte}&fecha_fin=${fechaFinReporte}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (respEsp.ok) setReporteEspecialidad(await respEsp.json());

      // Reporte por doctor
      const respDoc = await fetch(
        `${API_URL}/financial/reportes/por-doctor?fecha_inicio=${fechaInicioReporte}&fecha_fin=${fechaFinReporte}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (respDoc.ok) setReporteDoctor(await respDoc.json());

      // Reporte por tipo de pago
      const respTipo = await fetch(
        `${API_URL}/financial/reportes/por-tipo-pago?fecha_inicio=${fechaInicioReporte}&fecha_fin=${fechaFinReporte}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (respTipo.ok) setReporteTipoPago(await respTipo.json());
    } catch (error) {
      console.error('Error cargando reportes:', error);
    }
  };

  const cargarCierresCaja = async () => {
    try {
      const response = await fetch(
        `${API_URL}/financial/cierres-caja`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCierresCaja(data);
      }
    } catch (error) {
      console.error('Error cargando cierres:', error);
    }
  };

  // ========== FUNCIONES DE ACCIÓN ==========

  const registrarPago = async () => {
    if (!consultaSeleccionada || !montoPago || parseFloat(montoPago) <= 0) {
      alert('Ingrese un monto válido');
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/financial/consultas/${consultaSeleccionada.id}/pagos`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fecha: new Date().toISOString().split('T')[0],
            monto: parseFloat(montoPago),
            tipo_pago: tipoPago,
            referencia: referenciaPago,
            notas: notasPago
          })
        }
      );

      if (response.ok) {
        alert('Pago registrado exitosamente');
        setMostrarFormularioPago(false);
        setConsultaSeleccionada(null);
        setMontoPago('');
        setReferenciaPago('');
        setNotasPago('');
        cargarCuentasPendientes();
        cargarResumenDia();
      } else {
        const error = await response.json();
        alert('Error: ' + error.detail);
      }
    } catch (error) {
      console.error('Error registrando pago:', error);
      alert('Error al registrar el pago');
    }
  };

  const crearCierreCaja = async () => {
    try {
      const response = await fetch(
        `${API_URL}/financial/cierre-caja`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fecha: fechaSeleccionada,
            observaciones: observacionesCierre
          })
        }
      );

      if (response.ok) {
        alert('Cierre de caja creado exitosamente');
        setMostrarFormularioCierre(false);
        setObservacionesCierre('');
        cargarCierresCaja();
      } else {
        const error = await response.json();
        alert('Error: ' + error.detail);
      }
    } catch (error) {
      console.error('Error creando cierre:', error);
      alert('Error al crear el cierre de caja');
    }
  };

  // ========== RENDERIZADO ==========

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-8 h-8 text-green-600" />
            Módulo de Caja
          </h2>
          <p className="text-gray-600 mt-1">Gestión de pagos y cierre de caja</p>
        </div>

        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-500" />
          <input
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Pestañas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'resumen', label: 'Resumen del Día', icon: TrendingUp },
            { id: 'pendientes', label: 'Cuentas Pendientes', icon: Clock },
            { id: 'reportes', label: 'Reportes', icon: FileText },
            { id: 'cierres', label: 'Cierres de Caja', icon: CheckCircle }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setVistaActual(tab.id)}
              className={`
                flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm
                ${vistaActual === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido según vista */}
      {vistaActual === 'resumen' && (
        <div className="space-y-6">
          {cargandoResumen ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando resumen...</p>
            </div>
          ) : resumenDia ? (
            <>
              {/* Tarjetas de resumen */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg border-l-4 border-green-500 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Efectivo</p>
                      <p className="text-2xl font-bold text-gray-800">
                        ${resumenDia.total_efectivo.toFixed(2)}
                      </p>
                    </div>
                    <Banknote className="w-10 h-10 text-green-500" />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border-l-4 border-blue-500 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Transferencia</p>
                      <p className="text-2xl font-bold text-gray-800">
                        ${resumenDia.total_transferencia.toFixed(2)}
                      </p>
                    </div>
                    <Smartphone className="w-10 h-10 text-blue-500" />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border-l-4 border-purple-500 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Tarjeta</p>
                      <p className="text-2xl font-bold text-gray-800">
                        ${resumenDia.total_tarjeta.toFixed(2)}
                      </p>
                    </div>
                    <CreditCard className="w-10 h-10 text-purple-500" />
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border-l-4 border-yellow-500 shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total General</p>
                      <p className="text-2xl font-bold text-gray-800">
                        ${resumenDia.total_general.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {resumenDia.num_transacciones} transacciones
                      </p>
                    </div>
                    <DollarSign className="w-10 h-10 text-yellow-500" />
                  </div>
                </div>
              </div>

              {/* Tabla de detalles */}
              {resumenDia.detalles && resumenDia.detalles.length > 0 && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 bg-gray-50 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Detalle de Pagos del Día
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paciente</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cédula</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Especialidad</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo Pago</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {resumenDia.detalles.map((detalle, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {detalle.paciente_nombre}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {detalle.paciente_cedula}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {detalle.especialidad}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                detalle.tipo_pago === 'efectivo' ? 'bg-green-100 text-green-800' :
                                detalle.tipo_pago === 'transferencia' ? 'bg-blue-100 text-blue-800' :
                                detalle.tipo_pago === 'tarjeta' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {detalle.tipo_pago}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-gray-900">
                              ${detalle.monto.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botón de cierre de caja */}
              <div className="flex justify-end">
                <button
                  onClick={() => setMostrarFormularioCierre(true)}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Realizar Cierre de Caja
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay datos para esta fecha</p>
            </div>
          )}
        </div>
      )}

      {vistaActual === 'pendientes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-800">
              Cuentas por Cobrar
            </h3>
            <button
              onClick={cargarCuentasPendientes}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Actualizar
            </button>
          </div>

          {cargandoPendientes ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : cuentasPendientes.length > 0 ? (
            <div className="grid gap-4">
              {cuentasPendientes.map(cuenta => (
                <div key={cuenta.id} className="bg-white p-6 rounded-lg border shadow hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg text-gray-800">
                        {cuenta.paciente_nombre}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Cédula: {cuenta.paciente_cedula} | Especialidad: {cuenta.especialidad}
                      </p>
                      <p className="text-sm text-gray-600">
                        Fecha: {cuenta.fecha} | Doctor: {cuenta.doctor_nombre}
                      </p>

                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Total:</span>
                          <span className="ml-2 font-semibold">${cuenta.total.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Pagado:</span>
                          <span className="ml-2 font-semibold text-green-600">${cuenta.total_pagado.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Saldo:</span>
                          <span className="ml-2 font-semibold text-red-600">${cuenta.saldo.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setConsultaSeleccionada(cuenta);
                        setMontoPago(cuenta.saldo.toString());
                        setMostrarFormularioPago(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Registrar Pago
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay cuentas pendientes</p>
            </div>
          )}
        </div>
      )}

      {vistaActual === 'reportes' && (
        <div className="space-y-6">
          {/* Selector de fechas */}
          <div className="bg-white p-4 rounded-lg border flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Período:</label>
            <input
              type="date"
              value={fechaInicioReporte}
              onChange={(e) => setFechaInicioReporte(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />
            <span className="text-gray-500">hasta</span>
            <input
              type="date"
              value={fechaFinReporte}
              onChange={(e) => setFechaFinReporte(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />
            <button
              onClick={cargarReportes}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Generar Reportes
            </button>
          </div>

          {/* Reporte por Especialidad */}
          {reporteEspecialidad && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Ingresos por Especialidad
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Especialidad</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Consultas</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Facturado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cobrado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reporteEspecialidad.especialidades.map((esp, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{esp.especialidad}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{esp.num_consultas}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${esp.total_facturado.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-semibold">${esp.total_cobrado.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">${esp.saldo_pendiente.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="2" className="px-6 py-3 text-sm font-bold text-gray-900">TOTAL</td>
                      <td className="px-6 py-3 text-sm font-bold text-right text-gray-900">${reporteEspecialidad.total_facturado.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm font-bold text-right text-green-600">${reporteEspecialidad.total_cobrado.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm font-bold text-right text-red-600">${(reporteEspecialidad.total_facturado - reporteEspecialidad.total_cobrado).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Reporte por Doctor */}
          {reporteDoctor && reporteDoctor.doctores.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Ingresos por Doctor
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doctor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Especialidad</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Consultas</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Facturado</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cobrado</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reporteDoctor.doctores.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.doctor_nombre}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{doc.especialidad}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{doc.num_consultas}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">${doc.total_facturado.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-semibold">${doc.total_cobrado.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reporte por Tipo de Pago */}
          {reporteTipoPago && reporteTipoPago.tipos_pago.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Ingresos por Tipo de Pago
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {reporteTipoPago.tipos_pago.map((tipo, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border">
                    <p className="text-sm text-gray-600 capitalize">{tipo.tipo_pago}</p>
                    <p className="text-2xl font-bold text-gray-900">${tipo.total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{tipo.num_pagos} pagos</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-800">Total General:</span>
                  <span className="text-2xl font-bold text-green-600">${reporteTipoPago.total_general.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {vistaActual === 'cierres' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-800">
              Historial de Cierres de Caja
            </h3>
          </div>

          {cierresCaja.length > 0 ? (
            <div className="grid gap-4">
              {cierresCaja.map(cierre => (
                <div key={cierre.id} className="bg-white p-6 rounded-lg border shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-lg text-gray-800">
                        Cierre del {cierre.fecha}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Realizado por: {cierre.usuario_nombre}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                      {cierre.estado}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div className="text-center p-3 bg-green-50 rounded">
                      <p className="text-xs text-gray-600">Efectivo</p>
                      <p className="text-lg font-bold text-gray-900">${cierre.total_efectivo.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <p className="text-xs text-gray-600">Transferencia</p>
                      <p className="text-lg font-bold text-gray-900">${cierre.total_transferencia.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded">
                      <p className="text-xs text-gray-600">Tarjeta</p>
                      <p className="text-lg font-bold text-gray-900">${cierre.total_tarjeta.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded">
                      <p className="text-xs text-gray-600">Total</p>
                      <p className="text-lg font-bold text-gray-900">${cierre.total_general.toFixed(2)}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-xs text-gray-600">Transacciones</p>
                      <p className="text-lg font-bold text-gray-900">{cierre.num_transacciones}</p>
                    </div>
                  </div>

                  {cierre.observaciones && (
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">Observaciones:</span> {cierre.observaciones}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay cierres de caja registrados</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Registro de Pago */}
      {mostrarFormularioPago && consultaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Registrar Pago
              </h3>
              <button
                onClick={() => {
                  setMostrarFormularioPago(false);
                  setConsultaSeleccionada(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-600">Paciente:</p>
                <p className="font-semibold text-gray-800">{consultaSeleccionada.paciente_nombre}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Saldo pendiente: <span className="font-bold text-red-600">${consultaSeleccionada.saldo.toFixed(2)}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto del Pago *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Pago *
                </label>
                <select
                  value={tipoPago}
                  onChange={(e) => setTipoPago(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="seguro">Seguro</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Referencia/Nº Transacción
                </label>
                <input
                  type="text"
                  value={referenciaPago}
                  onChange={(e) => setReferenciaPago(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={notasPago}
                  onChange={(e) => setNotasPago(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas adicionales..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={registrarPago}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Registrar Pago
                </button>
                <button
                  onClick={() => {
                    setMostrarFormularioPago(false);
                    setConsultaSeleccionada(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cierre de Caja */}
      {mostrarFormularioCierre && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Confirmar Cierre de Caja
              </h3>
              <button
                onClick={() => setMostrarFormularioCierre(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Se realizará el cierre de caja para la fecha: <strong>{fechaSeleccionada}</strong>
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Este proceso generará un reporte completo con todos los ingresos del día.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={observacionesCierre}
                  onChange={(e) => setObservacionesCierre(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Notas sobre el cierre de caja..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={crearCierreCaja}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Realizar Cierre
                </button>
                <button
                  onClick={() => setMostrarFormularioCierre(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CajaTab;
