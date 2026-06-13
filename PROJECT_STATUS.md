# FAMILY HEALTH — Estado del Proyecto

## Información General

| | |
|---|---|
| **Nombre** | FAMILY HEALTH — Sistema de Gestión Clínica Multi-especialidad |
| **Objetivo** | SaaS para clínica de especialidades en Guayaquil, Ecuador. Gestiona citas, historia clínica, odontograma, facturación electrónica SRI, caja/finanzas y roles (doctor, counter/recepción, administrador). |
| **Especialidades** | Medicina General, Pediatría, Nutrición, Ginecología/Obstetricia, Ecografía, Odontología |
| **Tecnologías** | React (Tailwind, shadcn/ui) · FastAPI · MongoDB (Motor, async) · ReportLab (PDFs) |
| **Despliegue** | Render — Frontend: `ce-family-health.onrender.com` · Backend: `family-health.onrender.com` |
| **Repositorio** | `familyhealth-gye/FAMILY-HEALTH` |
| **Entorno dev** | GitHub Codespaces + Cursor |

### Arquitectura General

```
frontend/src/
├── components/        → componentes principales (~50), uno por módulo/tab
├── modules/
│   ├── dental/         → motor clínico odontológico (engine, hooks)
│   │   ├── engine/clinical_rules.js   → PROCEDURE_DEFAULTS, reglas clínicas
│   │   └── hooks/       → useClinicalEngine, useTreatmentPipeline, useRetryQueue
│   └── counter/        → flujo operativo de recepción/caja
│       ├── components/ → DatosCitaTab, FichaClinicaTab
│       └── hooks/useCitaForm.js
└── lib/axios.js        → apiClient con interceptor de token automático

backend/
├── server.py            → FastAPI app, CORS, registro de routers
├── routers/             → un router por dominio (modular, prefix /api)
├── financial_routes.py  → módulo financiero (caja, facturación, catálogo)
├── sri_facturacion.py    → firma XML, envío y autorización SRI
├── pdf_generator.py      → generación de PDFs (recetas, certificados, facturas)
├── specialty_utils.py    → normalizeSpecialty() — fuente única de verdad
└── medical_history_models.py → modelos Pydantic de historia clínica
```

**Principios arquitectónicos establecidos:**
- Modularización incremental: `server.py` se está vaciando hacia `routers/`
- Counter/Recepción es el centro operativo del flujo clínico
- Separación de roles: doctores (clínico) vs counter (financiero)
- No refactors masivos ni migraciones irreversibles
- `normalizeSpecialty()` es la única fuente de verdad para nombres de especialidad

---

## Último Estado Confirmado

| | |
|---|---|
| **Último commit** | `9cf793a` — "feat: re-consulta automática de estado SRI al cargar Facturación" (+ correcciones de esta sesión, ver "Cambios Recientes") |
| **Fecha** | 2026-06-13 |
| **Rama principal** | `main` |
| **Estado del build** | Todos los archivos modificados verificados con `ast.parse` (Python) y balance de llaves/paréntesis (JSX) |

---

## Funcionalidades Implementadas

### Autenticación
- JWT vía `backend/auth.py`, variable de entorno obligatoria (sin fallback hardcoded)
- Roles: `doctor`, `counter`/recepción, `administrador`
- `users_router` — gestión de usuarios y permisos

### Pacientes
- `patients_router` — CRUD de pacientes
- `BusquedaPaciente.jsx` — búsqueda unificada por cédula/nombre
- `AntecedentesPanel.jsx` — antecedentes médicos (alergias, medicamentos actuales), modo solo-lectura disponible para consulta cruzada entre especialidades

### Odontología
- **`OdontogramaClinicoTab.jsx`** (V1, único activo — V2 fue eliminado y su motor clínico migrado a `modules/dental/`)
  - Odontograma de 5 caras por diente (vestibular, palatino/lingual, mesial, distal, oclusal/incisal)
  - Numeración FDI correcta (Q1: 18→11, Q2: 21→28, Q3: 31→38, Q4: 48→41)
  - Generación automática de 32 dientes permanentes al crear odontograma (`_generar_dientes()` en backend)
  - **Cambio de dentición** (Permanente/Decidua/Mixta): agrega cuadrantes faltantes (5-8 para temporal) preservando lo ya marcado
  - Layout: Antecedentes → Diagnóstico General → Odontograma → Leyenda → Acciones Rápidas → Plan de Tratamiento → Tratamiento Realizado → Evolución
  - **Consolidación por diente**: múltiples superficies cariadas generan UN ítem en el plan (no uno por superficie); diagnóstico dominante por prioridad (endodoncia > corona > fractura > restauración > caries)
  - Acciones Rápidas unificadas: procedimientos + estados de diente (extracción, implante, corona, endodoncia, etc.) sin cambiar de "modo"
  - Plan de Tratamiento automático con precios desde catálogo (`getPrecio()`: catálogo → PROCEDURE_DEFAULTS → fallback)
  - **Botón "Guardar y Terminar Consulta"**: persiste diagnóstico general + registra evolución
  - **Evolución**: panel colapsable con historial cronológico (fecha, profesional, procedimiento, observaciones)
- Endpoints backend: `POST/PUT/DELETE /odontogramas-clinicos`, `PUT .../diente/{fdi}/superficie/{sup}`, `POST/GET .../evolucion`

### Historia Clínica
- Formularios por especialidad: `MedicinaGeneralForm`, `PediatriaForm`, `GinecologiaForm`, `NutricionForm`, `EcografiaForm`, `OdontologiaForm`
- `MedicacionRapida.jsx` — gestión de medicamentos con plantillas por especialidad
- `CIE10Search.jsx` — autocomplete de ~130 códigos CIE-10 (Respiratorio, Digestivo, Cardiovascular, Endocrino, Mental, Musculoesquelético, Urinario, Ginecología, Dermatología, Odontología K00-K14, Pediátría)
- `MedicamentoSearch.jsx` — autocomplete de medicamentos: historial de prescripciones del sistema (badge "✓ Usado") + base MSP Ecuador (~80 medicamentos, badge "MSP")
- `DocumentosClinicosPanel.jsx`:
  - Consentimiento informado con selector de procedimiento (16 tipos: extracción, implante, prótesis, endodoncia, etc.)
  - Certificado médico con CIE-10 (búsqueda integrada), días de reposo, campo "emisor" (permite que counter emita en nombre del doctor)
- `IAMedicaPanel.jsx` + `useClinicalEngine` — sugerencias de IA (Gemini, decoplado, opcional)

### Facturación
- `FacturacionTab.jsx` — CRUD de facturas, autocomplete de paciente por cédula (busca en `/financial/pacientes` y `/appointments`)
- `generate_factura_pdf()` — RIDE según normativa SRI (NAC-DGERCGC12-00105): encabezado emisor, clave de acceso, detalle de servicios, totales, forma de pago
- PDF endpoint inyecta `clinica_config` y `ambiente` real desde configuración en tiempo de generación (no usa datos desactualizados de la factura)
- Descarga vía `fetch + blob + Authorization Bearer` (compatible móvil)

### SRI (Facturación Electrónica)
- `sri_facturacion.py` — generación XML, firma RSA-SHA1 con `.p12`, envío SOAP a webservices SRI (`celcer.sri.gob.ec` pruebas / `cel.sri.gob.ec` producción)
- **Modal de progreso en tiempo real**: al emitir, muestra spinner hasta 60s mientras el backend reintenta autorización (3+5+7+10+12+15s) — evita salir y volver
- Protección contra doble emisión: si ya existe `clave_acceso` con estado PENDIENTE/RECIBIDA, consulta autorización antes de reenviar
- `ConfiguracionSRI.jsx` — carga `.p12`, contraseña, selector de ambiente (pruebas/producción)
- Endpoint de diagnóstico `GET /api/sri/diagnostico` — verifica certificado, ambiente, RUC, vencimiento

### Reportes
- `EvolucionesTab.jsx` — vista de evoluciones clínicas
- `FotosRXTab.jsx` — gestión de imágenes/radiografías
- `LaboratorioTab.jsx` — resultados de laboratorio
- Exportación CSV en Facturación

### Otros Módulos
- **Caja** (`CajaTab.jsx` + `financial_routes.py`): resumen diario por forma de pago, enriquecido con teléfono/email/dirección desde `appointments`, badge de factura existente
- **Citas** (`appointments_router`, `NuevaCitaModal.jsx`): creación de citas, integración con `modules/counter/`
- **Inventario** (`inventory_router`, `LaboratorioTab`)
- **Pagos a Doctores** (`doctor_payments_router`)
- **Proformas** (`ProformasTab.jsx`, `proformas_router`)
- **Abonos** (`AbonosTab.jsx`)
- **Plan de Tratamiento** (`PlanTratamientoTab.jsx`, `useTreatmentPipeline`) — estados: `creado → propuesto → aprobado → en_ejecucion → realizado`

---

## Cambios Recientes (última sesión)

### Correcciones de producción (2026-06-13)
- **Odontograma — render de dentición Decidua/Mixta**: `organizarDientes()` solo dibujaba los cuadrantes permanentes 1-4, por lo que los dientes temporales 5-8 (correctamente guardados en backend) nunca se renderizaban. **Corregido en dos pasos**: primero se incluyeron los temporales, pero quedaban intercalados entre los permanentes (mal colocados); la versión final los muestra en **filas internas propias y centradas** (4 filas: permanente sup → temporal sup → temporal inf → permanente inf), como un odontograma mixto estándar (`OdontogramaClinicoTab.jsx`).
- **Envío de RIDE por correo — migrado de SMTP a Gmail API**: `smtplib.SMTP_SSL` síncrono congelaba el event loop; se aisló primero con `asyncio.to_thread`+timeout (devolvía 504). **Pero Render bloquea todo el SMTP saliente (25/465/587)**, así que SMTP nunca funcionaría. Se migró el envío a la **Gmail API por HTTPS** (OAuth2, `httpx` async): refresh_token → access_token → `messages/send`. Requiere configurar credenciales OAuth2 (ver "Problemas Conocidos" / pendiente Parte A).
- **Consulta SRI — mostrar respuesta real**: `GET /sri/estado/{id}` ahora persiste siempre `sri_ultimo_estado`, `sri_ultimo_mensaje` y `sri_ultima_consulta` (no solo cuando autoriza). La tabla de Facturación muestra ese estado real bajo el badge (RECIBIDA / EN PROCESO / NO EXISTE / DEVUELTA), facilitando el diagnóstico (`billing.py`, `FacturacionTab.jsx`).

### Correcciones SRI previas (commits 2551f76 → 9cf793a)
- **`2551f76`** — Handler global de excepciones FastAPI con headers CORS + logging de traceback (el "Network Error" al emitir era un 500 sin CORS) + None-safety en `numero_factura`/`clinica_config.valor`
- **`6dcc882`** — `lxml==5.3.0` faltaba en `requirements.txt` (importado en `sri_facturacion.py`, causaba 500 "No module named 'lxml'")
- **`6f439da`** — Early-return en `emitir_factura_sri` para facturas ya RECIBIDA (evita re-emisión duplicada) + descarga XML vía fetch+blob+auth (corrige "Not authenticated") + mensaje de éxito solo si `sri_estado === "AUTORIZADO"`
- **`9cf793a`** — `cargar()` auto-consulta `/sri/estado/{id}` (vía `Promise.allSettled`) para facturas pendientes al abrir Facturación

### Modal de progreso SRI
- Backend: ciclo de reintentos de autorización extendido de 2s a ~60s (intervalos 3,5,7,10,12,15s), sigue reintentando mientras SRI responde "NO EXISTE"/"EN PROCESO"/"PENDIENTE"
- Frontend: modal fullscreen con spinner animado (`@keyframes spin`), estados visuales ✅/⚠️/❌/⏱️, timeout axios de 90s
- Elimina la necesidad de cerrar y reabrir la factura para ver si fue autorizada

### Corrección de dentición (completada 2026-06-13)
- El selector Permanente/Decidua/Mixta **agrega** los cuadrantes de dientes faltantes al odontograma existente (vía generación temporal + unificación), preservando lo ya marcado — esta parte (backend + handler) ya funcionaba
- **Faltaba el render**: `organizarDientes()` ignoraba los cuadrantes 5-8; corregido en esta sesión (ver "Correcciones de producción" arriba). Ahora los dientes temporales se muestran en ambos arcos

### Guardar y terminar consulta
- Nuevo botón al final del flujo de odontograma
- Guarda: `diagnostico_general`, `higiene_oral`, `estado_encias`, `observaciones`
- Si hay tratamientos realizados en la consulta, los consolida y envía a evolución
- Botón secundario "Cerrar sin guardar"

### Endpoint POST evolución
- `POST /odontogramas-clinicos/{id}/evolucion` — agrega entrada al array `evolucion` del odontograma vía `$push`
- Campos: `fecha`, `doctor_nombre`, `procedimiento`, `observaciones`, `materiales`, `created_at`
- Complementa el `GET .../evolucion` ya existente (que también busca en `medical_history_odontology`)

---

## Problemas Resueltos

| Problema | Causa raíz | Solución |
|---|---|---|
| Odontograma se quedaba en "Crear Odontograma" | Backend generaba `dientes: []`, frontend no auto-creaba | `_generar_dientes()` genera 32 dientes FDI automáticamente; `useEffect` crea odontograma si falta `pacienteId` |
| Clicks en superficies no hacían nada | Endpoint `PUT .../diente/{fdi}/superficie/{sup}` no existía (404 silencioso) | Endpoint creado, actualiza diagnóstico y recalcula estado del diente |
| Cuadrante 1 invertido (11→18 en vez de 18→11) | Orden de `sort()` incorrecto (descendente cuando debía ser ascendente) | Corregido en Q1, Q2, Q3, Q4 y arcos temporal/mixto |
| Múltiples superficies cariadas generaban ítems duplicados en el plan | Cada superficie creaba un ítem independiente | Consolidación: un ítem por diente, reemplazado al cambiar diagnóstico dominante |
| PDF de factura en blanco | `generate_factura_pdf` no existía — import fallaba silenciosamente | Función creada: RIDE completo con tablas, totales, forma de pago |
| Factura mostraba "AMBIENTE: PRUEBAS" en producción | PDF leía `sri_ambiente` guardado en la factura (desactualizado) | PDF ahora inyecta `ambiente` real desde `db.configuracion` en el momento de generar |
| Error CORS en `/sri/emitir/` | `allow_credentials=True` con lista de orígenes — incompatible con respuestas 500 sin headers CORS | `allow_origins=["*"]`, `allow_credentials=False` |
| Doble emisión SRI generaba duplicados | Reenvío sin verificar `clave_acceso` existente | Si hay `clave_acceso` y estado PENDIENTE/RECIBIDA, consulta autorización antes de reenviar |
| Datos incompletos en factura desde Caja (sin teléfono/email) | `financial_routes.py` no incluía esos campos en `detalles` | Enriquecimiento desde `db.appointments` por cédula |
| `handleGuardar` de factura no hacía nada | `InvoiceCreate` tenía campos obligatorios sin default → 422 silencioso | Defaults agregados a todos los campos; error 422 mostrado en detalle |
| Botón "Ejecutar Diagnóstico SRI" → Network Error | Usaba `axios` dinámico sin headers de autenticación | Reemplazado por `apiClient` (interceptor con token de localStorage) |
| Consentimiento sin selector de procedimiento | Endpoint GET fijo sin parámetros | Cambiado a POST + `ConsentimientoModal` con 16 procedimientos |
| "Network Error" al emitir factura SRI | Excepción 500 sin headers CORS (el navegador la reporta como Network Error) + `None.split()` en `numero_factura` | Handler global de excepciones con CORS + logging; None-safety (`2551f76`) |
| 500 "No module named 'lxml'" al emitir | `lxml` importado en `sri_facturacion.py` pero ausente en `requirements.txt` | `lxml==5.3.0` agregado (`6dcc882`) |
| Re-emisión SRI duplicada / XML "Not authenticated" / mensaje "AUTORIZADO" engañoso | Sin early-return en factura RECIBIDA; descarga XML sin token; éxito sin verificar estado | Early-return + fetch+blob+auth + check `sri_estado === "AUTORIZADO"` (`6f439da`) |
| Facturas quedaban en "SRI Proc." tras recargar | No se re-consultaba el estado al abrir Facturación | `cargar()` auto-consulta `/sri/estado/{id}` con `Promise.allSettled` (`9cf793a`) |
| Dentición Decidua/Mixta no mostraba dientes | `organizarDientes()` solo renderizaba cuadrantes 1-4; los temporales 5-8 nunca se dibujaban | Incluidos cuadrantes 5-8 en ambos arcos (2026-06-13) |
| "Enviar por correo" congelaba toda la app | `smtplib.SMTP_SSL` síncrono sin timeout dentro de `async def` bloqueaba el event loop | `asyncio.to_thread()` + `timeout=20s` + 504 claro (2026-06-13) |
| Certificado médico sin emisor configurable | Solo usaba doctor de la cita | Campo `emisor_nombre` opcional para que counter especifique quién firma |

---

## Problemas Conocidos

1. **Modulación de `server.py`**: aún contiene rutas legacy pendientes de mover a `routers/modules/` (clinical history por especialidad) — `financial_routes.py` deliberadamente no extraído por su complejidad (operaciones atómicas, SRI, pagos)
2. **Reintentos SRI de 60s**: si el SRI tarda más, la factura queda en estado PENDIENTE; ahora hay botón "Consultar SRI" que muestra el estado real devuelto (RECIBIDA/EN PROCESO/NO EXISTE/DEVUELTA) — pendiente probar en producción que el estado real se refleje correctamente en la tabla
3. **Gemini AI**: decoplado pero depende de que el usuario configure su propia API key; sin key, `IAMedicaPanel` no ofrece sugerencias
4. **Pendiente verificar**: integración completa de `FichaClinicaTab` dentro de `NuevaCitaModal` (estado incierto de sesiones previas)
5. **MedicamentoSearch**: integrado solo en `MedicacionRapida` (Medicina General) y `PediatriaForm`; `GinecologiaForm` y `NutricionForm` aún usan input manual
6. **CIE10Search**: integrado solo en certificado médico; no en formularios de historia clínica por especialidad
7. **Encoding**: riesgo conocido de corrupción ASCII en merges que afecta comparaciones de especialidad — vigilar tras cualquier merge masivo
8. **Envío de correo — PENDIENTE Parte A (configuración del usuario)**: el código ya envía vía Gmail API (HTTPS), pero falta que el usuario complete el setup OAuth2 en Google Cloud y pegue las credenciales:
   - **Parte A (manual, una vez)**: crear proyecto en Google Cloud Console → habilitar "Gmail API" → pantalla de consentimiento OAuth (Externo, scope `gmail.send`, agregar el Gmail como usuario de prueba) → credencial "ID de cliente OAuth" tipo *Aplicación de escritorio* (da Client ID + Client Secret) → ejecutar `python backend/scripts/gmail_oauth_setup.py` en local para obtener el Refresh Token
   - **Luego**: pegar Client ID / Client Secret / Refresh Token en Admin → Config. SRI → sección Gmail
   - Hasta que se complete, "Enviar por correo" devuelve 503 ("Gmail API no configurada")

> **Resuelto:** el PAT de GitHub usado en desarrollo **ya fue revocado/eliminado** — riesgo de seguridad cerrado.

---

## Próximas Tareas Recomendadas

### Prioridad Alta — verificar en producción los fixes de esta sesión (2026-06-13)
1. **Odontograma**: confirmar que al cambiar a Decidua/Mixta ahora se ven los dientes temporales 5-8 en ambos arcos
2. **Envío RIDE por correo**: completar la Parte A (setup Gmail API OAuth2 — ver "Problemas Conocidos" #8) y confirmar que envía correctamente vía Gmail API
3. **Consulta SRI**: confirmar que la tabla muestra el estado real (RECIBIDA/EN PROCESO/NO EXISTE/DEVUELTA) bajo el badge tras pulsar "Consultar SRI"
4. Verificar y completar integración `FichaClinicaTab` ↔ `NuevaCitaModal`

### Prioridad Media
5. Extender `MedicamentoSearch` a `GinecologiaForm` y `NutricionForm`
6. Extender `CIE10Search` a formularios de historia clínica (no solo certificado)
7. Continuar modularización de `server.py`: mover historia clínica por especialidad a `routers/modules/{especialidad}.py`

### Prioridad Baja
8. Extracción de `financial_routes.py` hacia arquitectura `services/`/`repositories/` (cuando se aborde evolución SaaS completa)
9. Evaluar agregar resumen visual de evolución odontológica (timeline gráfico) más allá del panel colapsable actual
10. Considerar envío de correo vía API HTTP (SendGrid/Resend) si el puerto 465 SMTP resulta poco fiable en Render

---

## Archivos Clave

| Archivo | Función |
|---|---|
| `backend/server.py` | Punto de entrada FastAPI, configuración CORS, registro de todos los routers |
| `backend/routers/odontology.py` | Odontograma clínico: generación de dientes FDI, superficies, evolución, plan de tratamiento |
| `backend/routers/billing.py` | Facturas, PDFs (RIDE, certificados, consentimientos), endpoints SRI (`emitir`, `diagnostico`) |
| `backend/sri_facturacion.py` | Firma XML, comunicación SOAP con webservices SRI Ecuador |
| `backend/pdf_generator.py` | Generación de PDFs con ReportLab: recetas, certificados, facturas (RIDE) |
| `backend/financial_routes.py` | Caja, resumen diario, catálogo de servicios, pacientes financieros |
| `backend/models.py` | Modelos Pydantic centrales (incluye `InvoiceCreate` corregido) |
| `backend/specialty_utils.py` | `normalizeSpecialty()` — única fuente de verdad para nombres de especialidad |
| `frontend/src/components/OdontogramaClinicoTab.jsx` | Flujo principal de atención odontológica (odontograma V1, 5 caras) |
| `frontend/src/components/FacturacionTab.jsx` | UI de facturación, modal de progreso SRI, autocomplete de paciente |
| `frontend/src/components/ConfiguracionSRI.jsx` | Configuración de certificado `.p12`, ambiente SRI, diagnóstico |
| `frontend/src/components/DocumentosClinicosPanel.jsx` | Consentimiento informado y certificado médico (con CIE-10) |
| `frontend/src/components/CIE10Search.jsx` | Autocomplete de códigos CIE-10 (~130 códigos) |
| `frontend/src/components/MedicamentoSearch.jsx` | Autocomplete de medicamentos (historial + base MSP) |
| `frontend/src/modules/dental/engine/clinical_rules.js` | `PROCEDURE_DEFAULTS`, reglas clínicas, clasificación por superficies |
| `frontend/src/modules/dental/hooks/useTreatmentPipeline.js` | Estado del plan de tratamiento (creado→propuesto→aprobado→en_ejecucion→realizado) |
| `frontend/src/lib/axios.js` | `apiClient` con interceptor de token automático desde localStorage |

---

*Documento generado automáticamente — última actualización: 2026-06-13*
