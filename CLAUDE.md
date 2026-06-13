# CLAUDE.md — Guía para Sesiones de Desarrollo

Este documento define cómo trabajar en el repositorio **FAMILY-HEALTH**. Toda sesión de Claude que modifique código en este proyecto debe seguir las reglas aquí descritas.

---

## 1. Descripción General del Sistema

FAMILY HEALTH es un sistema SaaS de gestión clínica para un centro de especialidades médicas en Guayaquil, Ecuador. Cubre:

- Gestión de citas y agenda
- Historia clínica por especialidad (Medicina General, Pediatría, Nutrición, Ginecología/Obstetricia, Ecografía, Odontología)
- Odontograma clínico interactivo (5 caras por diente, plan de tratamiento automático, evolución)
- Facturación electrónica integrada con el SRI Ecuador (firma `.p12`, XML, SOAP)
- Caja y módulo financiero (resumen diario, catálogo de servicios, abonos, proformas)
- Documentos clínicos: recetas, certificados médicos (CIE-10), consentimientos informados
- Roles: **doctor** (clínico), **counter/recepción** (operativo y financiero), **administrador**

---

## 2. Arquitectura

### Backend (FastAPI + MongoDB/Motor)

```
backend/
├── server.py                  → app FastAPI, CORS, registro de routers (prefix /api)
├── auth.py                     → JWT — requiere JWT_SECRET_KEY en variables de entorno
├── database.py / db            → cliente Motor, conexión MongoDB
├── models.py                   → modelos Pydantic centrales
├── medical_history_models.py   → modelos de historia clínica por especialidad
├── specialty_utils.py          → normalizeSpecialty() — fuente única de verdad
├── pdf_generator.py             → ReportLab: recetas, certificados, RIDE de facturas
├── sri_facturacion.py           → firma XML (.p12), SOAP a webservices SRI
├── pipeline_transitions.py      → estados del plan de tratamiento dental
├── financial_routes.py          → caja, catálogo, pacientes financieros (NO modularizado aún)
└── routers/                      → un router por dominio, todos con prefix /api
    ├── odontology.py     → odontograma clínico, evolución, plan de tratamiento
    ├── billing.py         → facturas, PDFs, endpoints SRI
    ├── appointments.py    → citas
    ├── patients.py        → pacientes
    ├── doctors.py         → doctores y pagos
    ├── prescriptions.py   → recetas
    ├── medical_history.py → historia clínica
    ├── catalogs.py        → CIE-10, medicamentos, catálogo de servicios
    ├── config.py          → configuración SRI, clínica, IA
    ├── inventory.py       → inventario
    ├── ia.py              → integración Gemini (decoplada, opcional)
    ├── clinical.py        → endpoints clínicos generales
    ├── users.py           → usuarios y roles
    └── helpers.py         → utilidades compartidas
```

**Estado de modularización**: `server.py` se está vaciando progresivamente hacia `routers/`. `financial_routes.py` permanece sin extraer por su complejidad (operaciones atómicas, integración SRI, lógica de pagos) — su extracción es tarea de baja prioridad y solo se aborda cuando el resto de `server.py` esté completamente vacío.

### Frontend (React + Tailwind + shadcn/ui)

```
frontend/src/
├── components/         → ~50 componentes, uno por módulo/tab (ver sección 3)
├── modules/
│   ├── dental/
│   │   ├── engine/clinical_rules.js    → PROCEDURE_DEFAULTS, reglas clínicas,
│   │   │                                  clasificarPorSuperficies()
│   │   └── hooks/
│   │       ├── useClinicalEngine.js     → sugerencias IA + recetas ajustadas
│   │       ├── useTreatmentPipeline.js  → estado del plan (creado→...→realizado)
│   │       └── useRetryQueue.js
│   └── counter/
│       ├── components/DatosCitaTab.jsx, FichaClinicaTab.jsx
│       └── hooks/useCitaForm.js
└── lib/axios.js          → apiClient con interceptor de token (localStorage)
```

**Build**: CRACO (`craco build`). **Despliegue**: Render — frontend `ce-family-health.onrender.com`, backend `family-health.onrender.com` (dominios distintos → CORS configurado con `allow_origins=["*"]`, `allow_credentials=False`).

---

## 3. Módulos Existentes

| Módulo | Componente(s) principales | Router backend |
|---|---|---|
| Odontología | `OdontogramaClinicoTab.jsx` (V1 activo — **V2 eliminado, no reintroducir**) | `odontology.py` |
| Facturación | `FacturacionTab.jsx`, `InvoicesTab.jsx` | `billing.py` |
| SRI | `ConfiguracionSRI.jsx` | `billing.py` (`/sri/*`), `sri_facturacion.py` |
| Caja | `CajaTab.jsx`, `AbonosTab.jsx` | `financial_routes.py` |
| Citas | `NuevaCitaModal.jsx`, `modules/counter/` | `appointments.py` |
| Pacientes | `PacientesTab.jsx`, `BusquedaPaciente.jsx` | `patients.py` |
| Historia Clínica | `MedicinaGeneralForm`, `PediatriaForm`, `GinecologiaForm`, `NutricionForm`, `EcografiaForm`, `OdontologiaForm`, `HistoriaClinicaCompleta.jsx` | `medical_history.py` |
| Documentos Clínicos | `DocumentosClinicosPanel.jsx` (consentimientos, certificados con CIE-10) | `billing.py` |
| Recetas | `RecetasTab.jsx`, `MedicacionRapida.jsx` | `prescriptions.py` |
| Búsquedas clínicas | `CIE10Search.jsx`, `MedicamentoSearch.jsx`, `AntecedentesPanel.jsx` | `catalogs.py` |
| Proformas | `ProformasTab.jsx` | `financial_routes.py` |
| Inventario | (vía `LaboratorioTab.jsx`) | `inventory.py` |
| IA Médica | `IAMedicaPanel.jsx` | `ia.py`, `useClinicalEngine` |
| Usuarios | `UsersTab.jsx` | `users.py` |
| Reportes / Evoluciones | `EvolucionesTab.jsx`, `FotosRXTab.jsx` | varios |

---

## 4. Convenciones de Código

### General
- **No refactors masivos.** Cambios incrementales y quirúrgicos (`str_replace`, no reescrituras completas salvo que el archivo esté irreparablemente roto).
- **No reintroducir el odontograma V2.** Su motor clínico fue migrado a `modules/dental/`; el único odontograma activo es `OdontogramaClinicoTab.jsx` (5 caras, V1).
- **`normalizeSpecialty()`** es la única fuente de verdad para nombres de especialidad — nunca hardcodear strings de especialidad.
- Idioma de UI, comentarios de negocio y strings al usuario: **español**. Comentarios técnicos pueden estar en español o inglés según el archivo existente.

### Backend (Python/FastAPI)
- Todos los routers usan `prefix="/api"` al registrarse en `server.py`
- Modelos Pydantic con **defaults explícitos** en todos los campos opcionales — un modelo `Create` sin defaults causa 422 silenciosos difíciles de depurar (ver historial: `InvoiceCreate`)
- `JWT_SECRET_KEY` debe leerse de variables de entorno; **nunca** hardcodear secretos ni usar fallback
- Verificación de sintaxis obligatoria tras cualquier edición: `python3 -c "import ast; ast.parse(open('archivo.py').read())"`
- `paciente_id` en registros financieros debe resolverse desde `db.pacientes`, nunca copiarse directamente de `appointment_id`

### Frontend (React/JSX)
- Componentes funcionales con hooks; estilos inline (`style={{...}}`) son el patrón dominante en componentes nuevos — mantener consistencia salvo que el archivo use Tailwind/shadcn explícitamente
- **`Promise.allSettled`**, no `Promise.all`, para llamadas paralelas a endpoints — evita que un endpoint caído tumbe toda la vista
- Descargas de PDF: **`fetch + blob + Authorization: Bearer`** — nunca `window.open(url?token=...)` (falla en móvil/Safari)
- Llamadas autenticadas deben usar `apiClient` de `lib/axios.js` (interceptor inyecta el token desde `localStorage`) cuando sea posible, en vez de `axios` + headers manuales
- Verificación de sintaxis obligatoria tras cualquier edición: balance de `{}`/`()` vía script Node, y verificación de que los imports `@/...` resuelvan a archivos existentes
- **Build de verificación**: `npx craco build` debe pasar antes de considerar una entrega de frontend completa

### Encoding
- Cuidado con corrupción ASCII en merges que elimina tildes/acentos de strings en español — esto rompe comparaciones de especialidad y debe vigilarse tras cualquier merge masivo

---

## 5. Flujo Git

- **Rama principal**: `main` — todo el trabajo se commitea y pushea directamente (no hay rama de desarrollo separada en este flujo)
- **Patrón de entrega**: en Codespaces, los cambios se aplican directamente sobre el árbol de trabajo, se verifica sintaxis, se commitea con mensaje descriptivo (qué se rompió, causa raíz, qué se corrigió), y se pushea
- **Mensajes de commit**: formato `tipo: resumen corto` + cuerpo detallado explicando causa raíz y solución (ver historial de commits para ejemplos)
- **Identidad git**: si el entorno es nuevo, configurar `git config user.email` y `user.name` antes de commitear
- **Reclonado**: si el contenedor se reinicia, el árbol de trabajo se pierde — reclonar con `git clone` y verificar `git log` para confirmar qué se pusheó exitosamente vs. qué se perdió localmente

---

## 6. Reglas de Seguridad

- **Nunca** incluir tokens, PATs, contraseñas o claves en archivos del repositorio — ni en código, ni en documentación, ni en mensajes de commit. GitHub Push Protection bloqueará el push y requiere amend del commit para limpiar el historial
- Si un PAT de GitHub se usó en texto plano durante una sesión (por ejemplo, en la URL de `git clone`), debe **revocarse** al finalizar esa sesión
- `JWT_SECRET_KEY` y credenciales de Gemini AI se manejan vía variables de entorno / configuración cifrada en MongoDB — nunca hardcoded
- El certificado `.p12` de firma electrónica se almacena cifrado en `db.configuracion` (clave `firma_electronica`) — nunca expuesto en respuestas de API más allá de metadatos (titular, vencimiento, ambiente)
- Antes de cualquier `git push`, revisar que no haya secretos en los archivos modificados

---

## 7. Procedimiento Obligatorio Antes de Modificar Código

Toda sesión nueva (o tras compactación de contexto) debe, en este orden:

1. **Leer `CLAUDE.md`** (este archivo) — reglas y arquitectura
2. **Leer `PROJECT_STATUS.md`** — estado actual, funcionalidades, problemas conocidos, tareas recomendadas
3. **Analizar cambios recientes**: `git log --oneline -15` y revisar el diff del último commit si es relevante a la tarea solicitada
4. **Proponer un plan** antes de modificar código — identificar archivos afectados, causa raíz si es un bug, y alcance del cambio (evitar scope creep)
5. **Verificar sintaxis** tras cada edición (Python: `ast.parse`; JSX: balance de llaves/paréntesis + resolución de imports `@/`)
6. **Commit y push al finalizar cada tarea importante** — no acumular cambios sin pushear; el contenedor puede reiniciarse y perder trabajo no guardado
7. **Actualizar `PROJECT_STATUS.md`** cuando se complete una funcionalidad relevante: mover de "Próximas Tareas" a "Cambios Recientes"/"Problemas Resueltos", actualizar el hash del último commit y la fecha

---

## 8. Notas Operativas Adicionales

- Si el contenedor se reinicia a mitad de sesión, el árbol de trabajo local se pierde pero el último `git push` exitoso persiste — siempre reclonar y verificar `git log` antes de asumir que el trabajo se perdió
- Las imágenes/screenshots del usuario suelen mostrar el estado en producción (Render) — los cambios requieren push + redespliegue (~2 min) antes de ser visibles
- Para diagnósticos SRI: usar el endpoint `GET /api/sri/diagnostico` (botón en Configuración SRI) antes de asumir causas — verifica certificado, ambiente, RUC y vencimiento sin necesidad de emitir una factura real

---

*Última actualización: 2026-06-13*
