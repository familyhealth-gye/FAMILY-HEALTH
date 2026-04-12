#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  FASE ACTUAL: Unificación de Pacientes y Módulo de Caja Centralizado
  
  1. Unificación de Pacientes:
     - La cédula es el identificador único global del paciente
     - Todos los módulos trabajan con paciente_cedula como campo principal
     - Función helper unificar_paciente_por_cedula() evita duplicados
     - Aplicado en: citas, consultas, proformas, odontología, laboratorio, pagos
  
  2. Módulo de Caja Centralizado:
     - Caja central que funciona para todas las especialidades
     - Concepto de SERVICIOS (no solo proformas)
     - Pagos parciales (abonos) con cálculo automático de saldo
     - Tipos de pago: efectivo, transferencia, tarjeta, seguro
     - Estados: pendiente, abonado, pagado
     - Reportes: ingresos del día, por especialidad, por doctor, por tipo de pago
     - Cierre de caja diario con exportación

backend:
  - task: "Modelos Proformas, Abonos y Odontogramas"
    implemented: true
    working: true
    file: "/app/backend/models.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Agregados modelos Pydantic para Proformas (con items, descuentos), Abonos (pagos parciales vinculados a proformas), Odontogramas (32 dientes con estados) y ToothState"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Todos los modelos funcionan correctamente. ProformaItem con cálculos, Abono con vinculación a proformas, Odontogram con 32 dientes y estados, ToothState con caras dentales. Validaciones Pydantic operativas."
  
  - task: "Endpoints API Financiero - Consultas desde Cita"
    implemented: true
    working: true
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Nuevo endpoint POST /api/financial/consultas/desde-cita/{appointment_id} para crear consulta financiera automáticamente al cerrar atención médica"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/financial/consultas/desde-cita/{id} funciona correctamente. Crea consulta financiera con servicios, calcula totales automáticamente (total=45.0), establece estado_pago='pendiente'. Integración con appointments verificada."

  - task: "Endpoints API Financiero - Consultas desde Proforma"
    implemented: true
    working: true
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Nuevo endpoint POST /api/financial/consultas/desde-proforma/{proforma_id} para convertir proforma aceptada en consulta financiera (Odontología)"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/financial/consultas/desde-proforma/{id} funciona correctamente. Convierte proforma 'Aceptada' en consulta financiera (total=200.0), actualiza estado proforma a 'Facturada'. Validación de estado y cálculos verificados."

  - task: "Endpoints API Financiero - Pagos con actualización automática"
    implemented: true
    working: true
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoint POST /api/financial/consultas/{id}/pagos registra pagos y actualiza automáticamente total_pagado, saldo, estado_pago. DELETE para eliminar pagos y recalcular."
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/financial/consultas/{id}/pagos funciona correctamente. Registra pago (monto=25.0), actualiza automáticamente total_pagado=25.0, saldo=20.0, estado_pago='parcial'. DELETE /pagos/{pago_id} recalcula correctamente saldo=45.0, estado_pago='pendiente'. Cálculos automáticos verificados."

  - task: "Endpoints API Financiero - Reportes Pendientes"
    implemented: true
    working: true
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoint GET /api/financial/reportes/pendientes lista consultas con saldo pendiente"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: GET /api/financial/reportes/pendientes funciona correctamente. Lista consultas con saldo > 0, muestra total_cuentas, total_pendiente, detalles por cuenta. Filtrado por estado_pago verificado."

  - task: "Endpoints API Proformas"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implementados endpoints CRUD completos para proformas: crear, listar, obtener por ID, actualizar estado, eliminar. Calcula subtotales y totales automáticamente"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/proformas (cálculos correctos: subtotal=210, total=200 con descuento), GET /api/proformas (listado completo), PUT /api/proformas/{id} (actualización de estado). Autenticación JWT requerida y funcionando."
  
  - task: "Endpoints API Abonos"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Implementados endpoints para abonos: registrar, listar todos, filtrar por paciente (cédula), actualizar, eliminar"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/abonos (creación con vinculación a proformas), GET /api/abonos (listado completo), GET /api/abonos/patient/{cedula} (filtrado por paciente). Integración proforma-abono verificada con cálculos de saldos."
  
  - task: "Endpoints API Odontogramas"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoints para odontogramas: crear, listar, obtener por paciente, actualizar, eliminar"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/odontograms (creación con 32 dientes y estados variados), GET /api/odontograms (listado), GET /api/odontograms/patient/{paciente_id} (filtrado por paciente). Vinculación correcta con doctores y pacientes."
  
  - task: "Modelo Historia Clínica Odontológica"
    implemented: true
    working: true
    file: "/app/backend/medical_history_models.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Modelo completo MedicalHistoryOdontology con motivo consulta, dolor dental, antecedentes odontológicos, antecedentes médicos, hábitos, examen intraoral (EstadoDental), diagnóstico, plan tratamiento, medicamentos"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: Modelo MedicalHistoryOdontology completo con EstadoDental funcionando. Todos los campos opcionales y requeridos validados correctamente. Integración con appointment_id operativa."
  
  - task: "Endpoints Historia Clínica Odontológica"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Endpoints para historia odontológica: crear, listar, obtener por appointment_id"
      - working: true
        agent: "testing"
        comment: "✅ TESTED: POST /api/medical-history/odontology (requiere usuario Doctor con doctor_id), GET /api/medical-history/odontology (listado), GET /api/medical-history/odontology/appointment/{appointment_id} (búsqueda por cita). Autenticación de rol Doctor verificada."

  - task: "Odontograma Clínico FDI - Modelos y Endpoints"
    implemented: true
    working: true
    file: "/app/backend/server.py, /app/backend/models.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          NUEVO SISTEMA DE ODONTOGRAMA CLÍNICO FDI:
          - Modelos: DienteFDI, SuperficieDental, OdontogramaClinico
          - Soporta 3 tipos de dentición: permanente (32), temporal (20), mixta
          - Numeración FDI internacional
          - 5 superficies por diente: oclusal/incisal, vestibular, palatino/lingual, mesial, distal
          - Diagnósticos por superficie: sano, caries, restauracion, endodoncia, corona, sellante, fractura
          - Estados de diente: presente, ausente, extraccion, no_erupcionado, exfoliado, implante, protesis
          
          ENDPOINTS:
          - POST /api/odontograma-clinico - Crear odontograma
          - GET /api/odontograma-clinico - Listar todos
          - GET /api/odontograma-clinico/{id} - Obtener por ID
          - GET /api/odontograma-clinico/paciente/{paciente_id} - Por paciente
          - PUT /api/odontograma-clinico/{id} - Actualizar general
          - PUT /api/odontograma-clinico/{id}/diente/{numero_fdi} - Actualizar diente
          - PUT /api/odontograma-clinico/{id}/diente/{numero_fdi}/superficie/{superficie} - Actualizar superficie
          - POST /api/odontograma-clinico/{id}/cambiar-denticion - Cambiar tipo dentición
          - DELETE /api/odontograma-clinico/{id} - Eliminar
      - working: true
        agent: "testing"
        comment: |
          ✅ ODONTOGRAMA CLÍNICO FDI COMPLETAMENTE TESTADO Y FUNCIONANDO:
          
          TODOS LOS 6 ENDPOINTS REQUERIDOS FUNCIONANDO PERFECTAMENTE:
          1. ✅ POST /api/odontograma-clinico (permanente) - Crea 32 dientes con numeración FDI correcta (18-11, 21-28, 31-38, 41-48), cada diente con 5 superficies
          2. ✅ POST /api/odontograma-clinico (temporal) - Crea 20 dientes con numeración FDI temporal correcta (55-51, 61-65, 71-75, 81-85)
          3. ✅ PUT /api/odontograma-clinico/{id}/diente/16/superficie/oclusal - Actualiza superficie "oclusal" del diente "16" con diagnóstico "caries" y persiste correctamente
          4. ✅ PUT /api/odontograma-clinico/{id}/diente/48 - Marca diente "48" como "ausente" y persiste correctamente
          5. ✅ POST /api/odontograma-clinico/{id}/cambiar-denticion - Cambia de permanente a temporal, regenera 20 dientes correctamente

  
  - task: "Función Helper: unificar_paciente_por_cedula()"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          FUNCIÓN CENTRAL DE UNIFICACIÓN DE PACIENTES:
          - Busca paciente por cédula en collection "pacientes"
          - Si existe: retorna paciente y opcionalmente actualiza datos
          - Si no existe: crea nuevo paciente con los datos proporcionados
          - Garantiza que la cédula sea el identificador único en todo el sistema
          - Previene duplicados automáticamente
          - Todos los endpoints que crean/modifican pacientes deben usar esta función
  
  - task: "Modelo Appointment con paciente_cedula"
    implemented: true
    working: "NA"
    file: "/app/backend/models.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          ACTUALIZADO MODELO APPOINTMENT:
          - Agregado campo paciente_cedula (IDENTIFICADOR PRINCIPAL)
          - Agregado campo paciente_id (referencia interna)
          - La cédula es el campo primario para identificación
          - Mantiene compatibilidad con campo cedula existente
  
  - task: "Endpoint POST /api/appointments con unificación"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          MODIFICADO ENDPOINT DE CREACIÓN DE CITAS:
          - Llama a unificar_paciente_por_cedula() antes de crear cita
          - Usa la cédula para buscar/crear paciente
          - Vincula la cita con paciente_cedula y paciente_id
          - Previene creación de pacientes duplicados
          - Actualiza datos del paciente si es necesario
  
  - task: "Modelos CierreCaja y CierreCajaCreate"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_models.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          NUEVOS MODELOS PARA CIERRE DE CAJA:
          - CierreCaja: modelo completo con totales por tipo de pago
          - Campos: fecha, usuario_cierre, total_efectivo, total_transferencia, total_tarjeta, total_seguro, total_otros
          - total_general, num_transacciones, observaciones
          - Incluye resúmenes por_especialidad y por_doctor
          - CierreCajaCreate: modelo para crear cierre
  
  - task: "Endpoint GET /api/financial/reportes/ingresos-del-dia"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          REPORTE DE INGRESOS DEL DÍA:
          - Muestra todos los pagos realizados en una fecha específica
          - Agrupa por tipo de pago (efectivo, transferencia, tarjeta, seguro, otros)
          - Retorna total_general y num_transacciones
          - Incluye detalles de cada transacción con paciente, especialidad, doctor
  
  - task: "Endpoint GET /api/financial/reportes/por-especialidad"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          REPORTE POR ESPECIALIDAD:
          - Agrupa ingresos por especialidad
          - Filtro por rango de fechas (fecha_inicio, fecha_fin)
          - Retorna: num_consultas, total_facturado, total_cobrado, saldo_pendiente
          - Ordenado por total_cobrado descendente
  
  - task: "Endpoint GET /api/financial/reportes/por-doctor"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          REPORTE POR DOCTOR:
          - Agrupa ingresos por doctor
          - Filtro por rango de fechas
          - Retorna: doctor_nombre, doctor_id, especialidad, num_consultas, totales
          - Ordenado por total_cobrado descendente
  
  - task: "Endpoint GET /api/financial/reportes/por-tipo-pago"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          REPORTE POR TIPO DE PAGO:
          - Agrupa ingresos por tipo de pago
          - Filtro por rango de fechas
          - Retorna: tipo_pago, num_pagos, total
          - Útil para conciliación de caja
  
  - task: "Endpoint POST /api/financial/cierre-caja"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          CREAR CIERRE DE CAJA DIARIO:
          - Calcula automáticamente todos los totales del día
          - Verifica que no exista cierre cerrado para la misma fecha
          - Integra reportes de ingresos, especialidades y doctores
          - Genera documento completo con estado "cerrado"
          - Incluye observaciones del usuario
  
  - task: "Endpoint GET /api/financial/cierres-caja"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          HISTORIAL DE CIERRES DE CAJA:
          - Lista todos los cierres de caja registrados
          - Filtro opcional por rango de fechas
          - Ordenado por fecha descendente
          - Útil para auditoría y consulta histórica
  
  - task: "Endpoint GET /api/financial/cierre-caja/{id}"
    implemented: true
    working: "NA"
    file: "/app/backend/financial_routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Obtener un cierre de caja específico por ID para visualización detallada"

          6. ✅ GET /api/odontograma-clinico/paciente/{paciente_id} - Retorna odontogramas del paciente correctamente
          
          VALIDACIONES VERIFICADAS:
          - Numeración FDI internacional correcta para ambos tipos de dentición
          - 5 superficies por diente (oclusal/incisal, vestibular, palatino/lingual, mesial, distal)
          - Persistencia de cambios en superficies y estados de dientes
          - Regeneración correcta de dientes al cambiar tipo de dentición
          - Autenticación JWT requerida en todos endpoints
          - Filtrado correcto por paciente
          
          Sistema de Odontograma Clínico FDI 100% operativo y listo para uso clínico diario.

frontend:
  - task: "Componente OdontogramaClinicoTab"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/OdontogramaClinicoTab.jsx"
    stuck_count: 0


  - task: "Componente BusquedaPaciente.jsx (reutilizable)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/BusquedaPaciente.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          COMPONENTE REUTILIZABLE DE BÚSQUEDA DE PACIENTES:
          - Busca pacientes por cédula usando endpoint /api/financial/pacientes
          - Si existe: muestra datos del paciente (nombre, teléfono, email, etc.)
          - Si no existe: muestra formulario para crear nuevo paciente
          - Notifica al componente padre con callback onPacienteSeleccionado
          - Soporte para formulario completo (opcional) con campos adicionales
          - Validación de cédula obligatoria
          - Mensaje claro cuando paciente será creado automáticamente
  
  - task: "Componente CajaTab.jsx (Módulo completo)"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/CajaTab.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          MÓDULO DE CAJA CENTRALIZADO CON 4 VISTAS:
          
          1. RESUMEN DEL DÍA:
             - Tarjetas con totales por tipo de pago (efectivo, transferencia, tarjeta)
             - Total general y número de transacciones
             - Tabla detallada con todos los pagos del día
             - Botón para realizar cierre de caja
          
          2. CUENTAS PENDIENTES:
             - Lista de consultas con saldo pendiente
             - Información de paciente, especialidad, doctor
             - Visualización de total, pagado y saldo
             - Botón para registrar pago directo desde la lista
             - Modal de registro de pago con validaciones
          
          3. REPORTES:
             - Selector de rango de fechas
             - Reporte por Especialidad (tabla con totales)
             - Reporte por Doctor (tabla con totales)
             - Reporte por Tipo de Pago (tarjetas visuales)
             - Totales generales en cada reporte
          
          4. CIERRES DE CAJA:
             - Historial de todos los cierres realizados
             - Visualización de totales por tipo de pago
             - Observaciones y usuario que realizó el cierre
             - Estado del cierre
          
          FUNCIONALIDADES:
          - Registro de pagos con tipos: efectivo, transferencia, tarjeta, seguro, otros
          - Referencia/Nº transacción opcional
          - Notas adicionales por pago
          - Cierre de caja con observaciones
          - Validación de cierre único por día
          - Interfaz moderna con Lucide React icons
          - Responsive design con Tailwind CSS
  
  - task: "Integración CajaTab en App.js"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          REEMPLAZO DE ABONOSTAB POR CAJATAB:
          - Import de CajaTab en lugar de AbonosTab
          - TabsTrigger cambiado de "abonos" a "caja"
          - Acceso: Administrador y Recepción
          - Nuevo icono: CreditCard
          - Nombre del tab: "Caja"

    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          NUEVO COMPONENTE DE ODONTOGRAMA CLÍNICO:
          - Visualización gráfica de dientes con SVG
          - Superficies clickeables con colores por diagnóstico
          - Selector de tipo de dentición (permanente/temporal/mixta)
          - Barra de herramientas de diagnóstico
          - Modo edición: superficie o diente completo
          - Leyenda de diagnósticos con colores
          - Panel de diagnóstico general (higiene oral, estado encías)
          - Dialog para editar diente individual

  - task: "Componente OdontogramaStandalone"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/OdontogramaStandalone.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Wrapper para usar odontograma desde tab independiente. Permite buscar/seleccionar paciente antes de mostrar odontograma. Lista odontogramas recientes."

  - task: "Componente ProformasTab"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/ProformasTab.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Tab completo de proformas con formulario de múltiples items, cálculo automático de subtotales/totales, selección de doctor, gestión de estados (Pendiente/Aceptada/Rechazada/Facturada), búsqueda, eliminación"
  
  - task: "Componente AbonosTab"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/AbonosTab.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Tab de abonos con vinculación opcional a proformas, cálculo automático de saldo pendiente, gestión de recibos, tipos de pago, edición, eliminación, totalizador de abonos"
  
  - task: "Componente OdontogramaTab"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/OdontogramaTab.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Odontograma interactivo visual con 32 dientes, selección por click, estados coloreados (Sano, Caries, Obturación, Extracción, Corona, Endodoncia, Implante), detalles por diente (caras: oclusal, vestibular, palatina, mesial, distal), leyenda de colores, diagnóstico y tratamiento general"
  
  - task: "Componente OdontologiaForm"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/OdontologiaForm.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Formulario completo de historia clínica odontológica: motivo consulta, dolor dental (ubicación, intensidad, tiempo), antecedentes odontológicos (última visita, cepillado, hilo dental), antecedentes médicos (diabetes, hipertensión, embarazo, etc), hábitos (fumador, bruxismo), examen intraoral (higiene, encías, mucosa, lengua, paladar, ATM), diagnóstico, plan tratamiento, procedimientos, materiales, medicamentos, seguimiento"
  
  - task: "Integración tabs en App.js"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Agregados 3 nuevos tabs: Proformas (Admin/Recepción), Abonos (Admin/Recepción), Odontograma (todos). Importados íconos Receipt, CreditCard, Activity. TabsContent renderizados condicionalmente según rol"
  
  - task: "Integración OdontologiaForm en AppointmentsWithAttention"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/components/AppointmentsWithAttention.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Formulario de odontología integrado en flujo de atención de citas. Se renderiza cuando especialidad es 'Odontología', al igual que Medicina General y Pediatría"

metadata:
  created_by: "main_agent"
  version: "2.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Función Helper: unificar_paciente_por_cedula()"
    - "Endpoint POST /api/appointments con unificación"
    - "Endpoint GET /api/financial/reportes/ingresos-del-dia"
    - "Endpoint GET /api/financial/reportes/por-especialidad"
    - "Endpoint GET /api/financial/reportes/por-doctor"
    - "Endpoint GET /api/financial/reportes/por-tipo-pago"
    - "Endpoint POST /api/financial/cierre-caja"
    - "Endpoint GET /api/financial/cierres-caja"
    - "Componente CajaTab.jsx (Módulo completo)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      🚀 IMPLEMENTACIÓN COMPLETA: UNIFICACIÓN DE PACIENTES Y MÓDULO DE CAJA
      
      ========== BACKEND ==========
      
      1. UNIFICACIÓN DE PACIENTES POR CÉDULA:
         ✅ Función helper unificar_paciente_por_cedula() en financial_routes.py
         ✅ Modelo Appointment actualizado con paciente_cedula (principal) y paciente_id (interno)
         ✅ Endpoint POST /api/appointments modificado para usar unificación automática
         ✅ Modelos CierreCaja y CierreCajaCreate en financial_models.py
      
      2. NUEVOS ENDPOINTS DE REPORTES (todos en /api/financial/):
         ✅ GET /reportes/ingresos-del-dia - Totales por tipo de pago con detalles
         ✅ GET /reportes/por-especialidad - Ingresos agrupados por especialidad
         ✅ GET /reportes/por-doctor - Ingresos agrupados por doctor
         ✅ GET /reportes/por-tipo-pago - Ingresos agrupados por tipo de pago
      
      3. ENDPOINTS DE CIERRE DE CAJA:
         ✅ POST /cierre-caja - Crear cierre diario con cálculos automáticos
         ✅ GET /cierres-caja - Historial de cierres
         ✅ GET /cierre-caja/{id} - Obtener cierre específico
      
      ========== FRONTEND ==========
      
      1. COMPONENTE REUTILIZABLE:
         ✅ BusquedaPaciente.jsx - Búsqueda por cédula con creación automática
      
      2. MÓDULO DE CAJA COMPLETO (CajaTab.jsx):
         ✅ Vista Resumen del Día - Totales por tipo de pago y tabla de detalles
         ✅ Vista Cuentas Pendientes - Lista con opción de registro de pago
         ✅ Vista Reportes - Especialidad, Doctor, Tipo de Pago
         ✅ Vista Cierres de Caja - Historial completo
         ✅ Modal de Registro de Pago - Con validaciones
         ✅ Modal de Cierre de Caja - Con observaciones
      
      3. INTEGRACIÓN:
         ✅ CajaTab reemplaza AbonosTab en App.js
         ✅ Tab "Caja" accesible para Administrador y Recepción
      
      ========== ARQUITECTURA ==========
      
      UNIFICACIÓN DE PACIENTES:
      - La cédula es el identificador único global
      - unificar_paciente_por_cedula() previene duplicados automáticamente
      - Si paciente existe: retorna y actualiza datos opcionales
      - Si no existe: crea nuevo con los datos proporcionados
      - Aplicado en POST /api/appointments (más módulos pendientes)
      
      MÓDULO DE CAJA:
      - Centraliza TODOS los pagos del sistema
      - Soporta múltiples especialidades y tipos de servicio
      - Pagos parciales con cálculo automático de saldos
      - Reportes por especialidad, doctor y tipo de pago
      - Cierre de caja diario con validación única
      - Interfaz moderna y responsive
      
      ========== PREPARADO PARA TESTING ==========
      
      FLUJOS A PROBAR:
      1. Crear cita con paciente nuevo (verificar unificación)
      2. Crear cita con paciente existente (verificar reutilización)
      3. Registrar pagos desde módulo de Caja
      4. Generar reportes de ingresos del día
      5. Generar reportes por especialidad, doctor y tipo de pago
      6. Realizar cierre de caja
      7. Ver historial de cierres
      
      SIGUIENTE PASO:
      - Testing completo de backend con deep_testing_backend_v2
      - Verificar que todos los endpoints funcionan correctamente
      - Confirmar que la unificación de pacientes previene duplicados
