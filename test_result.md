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
  Usuario solicitó priorizar:
  1. Proformas (cotizaciones de tratamientos)
  2. Odontograma del paciente (usado a diario en odontología)
  3. Historia Clínica de Odontología
  
  Continuó con implementación de estos módulos manteniendo funcionalidad existente.

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

frontend:
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
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Proformas Tab - crear, listar, cambiar estados"
    - "Abonos Tab - registrar, vincular con proformas, calcular saldos"
    - "Odontograma Tab - interacción visual, selección de dientes, guardado"
    - "Historia Clínica Odontología - flujo completo desde cita"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Implementación completa de Proformas, Abonos y Odontograma con historia clínica de odontología. Backend con modelos y endpoints, frontend con componentes visuales interactivos. Linting pasado en todos los archivos. Backend reiniciado correctamente."
  - agent: "testing"
    message: "🎉 BACKEND TESTING COMPLETADO - TODOS LOS ENDPOINTS FUNCIONANDO: ✅ Proformas (3/3 tests), ✅ Abonos (3/3 tests), ✅ Odontogramas (3/3 tests), ✅ Historia Clínica Odontológica (3/3 tests). Total: 12/12 tests pasados. Cálculos automáticos, autenticación JWT, vinculación proforma-abono, y roles de usuario verificados. Sistema listo para producción."