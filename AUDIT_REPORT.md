# AUDIT_REPORT.md — Auditoría Completa FAMILY-HEALTH

**Fecha:** 2026-06-13
**Alcance:** Backend completo, frontend completo, integraciones externas, estado funcional real, riesgos técnicos, calidad de código.
**Metodología:** Análisis directo del código fuente (no se asumió nada de `PROJECT_STATUS.md`); auditoría mediante agentes de exploración especializados (backend y frontend), con verificación de archivos, líneas y patrones concretos.

---

## 1. Backend — Estado Real

| Área | Estado | Evidencia |
|---|---|---|
| Auth (JWT, roles) | ✅ Funcional, seguro | `auth.py` sin fallback hardcodeado de `JWT_SECRET_KEY` |
| CORS / manejo de errores | ✅ Funcional | Handlers globales incluyen headers CORS en errores |
| MongoDB / `db.py` | ✅ Funcional | Sin issues críticos |
| Routers (14) | ⚠️ Funcional con deuda técnica | Ver hallazgos abajo |
| SRI (`sri_facturacion.py`, 213 líneas) | ✅ Funcional, con riesgo menor | URLs hardcodeadas, sin validación de expiración del `.p12` |
| Email (Gmail API) | ⏳ Implementado, pendiente Parte A | Código completo (commit `d88db08`), espera credenciales OAuth2 |

### Tamaño de routers (líneas)

| Archivo | Líneas |
|---|---|
| `billing.py` | 1456 |
| `financial_routes.py` | 1449 |
| `odontology.py` | 1199 |
| `medical_history.py` | 1081 |
| `catalogs.py` | 516 |

### Hallazgos del backend

- **🔴 ALTO — Endpoint duplicado en `medical_history.py`**: `create_odontology_history` está definido dos veces (~línea 428 y ~440). La primera definición queda como código muerto, sobrescrita por la segunda. Requiere revisión para confirmar cuál es la versión vigente correcta y eliminar la duplicada.
- **🟡 MEDIO — 30+ bloques `except Exception: pass`** silenciosos en `odontology.py`, `medical_history.py`, `catalogs.py`, `billing.py`, `helpers.py` — errores tragados sin log, dificulta el debugging en producción.
- **🟡 MEDIO — Sin rate limiting en login** (`users.py`) — riesgo de fuerza bruta.
- **🟡 MEDIO — Sin validación de expiración del certificado `.p12`** antes de firmar XML en `sri_facturacion.py` — un certificado vencido fallaría solo al momento de emitir, sin aviso previo.
- **🟢 BAJO — Archivos muertos**: `server_old.py` (665 líneas), `server_fase2.py` (667), `server_backup_fase2.py` (667) — backups sin uso, candidatos a eliminar (~2000 líneas).
- **🟢 BAJO — Archivos monolíticos**: `billing.py`, `financial_routes.py`, `odontology.py`, `medical_history.py` — todos superan 1000 líneas, candidatos a modularización futura.
- **🟢 BAJO — `server.py`**: endpoints raíz redundantes, sin hook de shutdown de DB.

### Seguridad backend

- Sin secretos hardcodeados (verificado).
- `JWT_SECRET_KEY` correctamente requerido vía variable de entorno, sin fallback.
- `.p12` y credenciales Gmail almacenadas en `db.configuracion`, no expuestas en respuestas más allá de booleanos/metadatos.

---

## 2. Frontend — Estado Real

**Conclusión general: producción-lista, sin bloqueadores críticos.** Se auditaron 19 componentes principales, 4 hooks de `modules/dental/` y 3 de `modules/counter/`.

### Inventario de componentes (líneas)

| Componente | Líneas | Estado |
|---|---|---|
| OdontogramaClinicoTab.jsx | 945 | ✅ Verificado (fix dentición correcto) |
| FacturacionTab.jsx | 844 | ✅ con observaciones menores |
| PlanTratamientoTab.jsx | 913 | ✅ |
| AbonosTab.jsx | 609 | ✅ |
| BusquedaPaciente.jsx | 551 | ✅ |
| ProformasTab.jsx | 503 | ✅ |
| CajaTab.jsx | 485 | ✅ |
| OdontogramaTab.jsx (legacy V1 pre-refactor) | 425 | 🟢 Huérfano — candidato a eliminar |
| FotosRXTab.jsx | 377 | ✅ |
| AntecedentesPanel.jsx | 380 | ✅ |
| UsersTab.jsx | 374 | ✅ |
| DocumentosClinicosPanel.jsx | 337 | ✅ |
| OdontogramaStandalone.jsx | 274 | ✅ activo (vista de historial) |
| ConfiguracionSRI.jsx | 279 | ✅ con observaciones menores |
| NuevaCitaModal.jsx | 205 | ✅ FichaClinicaTab integrada |
| LaboratorioTab.jsx | 162 | ✅ |
| IAMedicaPanel.jsx | 167 | ✅ |
| EvolucionesTab.jsx | 155 | ✅ |
| CIE10Search.jsx | 130 | ✅ |
| MedicamentoSearch.jsx | 130 | ✅ |
| InvoicesTab.jsx | 89 | ✅ |

### Hallazgos del frontend

- **✅ CONFIRMADO — integración `FichaClinicaTab` ↔ `NuevaCitaModal` completamente funcional.** PROJECT_STATUS.md la marcaba como "incierta"; verificado en código: import (línea 22 de `NuevaCitaModal.jsx`), render condicional (líneas 167-173), flujo completo vía `useCitaForm.js` hasta `PUT /antecedentes-paciente/{cedula}`. **Se corrige el estado en PROJECT_STATUS.md.**
- **✅ CONFIRMADO — fix de odontograma/dentición (2026-06-13) correcto.** `organizarDientes()` (945 líneas el archivo total) maneja correctamente cuadrantes 1-8, sin código muerto residual de iteraciones previas. Render en 4 filas (supPerm/supTemp/infTemp/infPerm), visibilidad controlada por `tipoDenticion` sin perder datos.
- **✅ V2 del odontograma completamente eliminado** — sin referencias remanentes (grep limpio).
- **✅ Sin problemas de encoding** en muestra de 6 componentes (acentos/ñ intactos).
- **✅ `lib/axios.js`**: interceptor inyecta `Authorization: Bearer` en todas las requests; maneja 401 limpiando `localStorage` (sin redirect explícito, cubierto por guardas de la app).
- **✅ Descargas PDF**: usan `fetch + blob + Authorization Bearer`, no `window.open` (compatible móvil/Safari). Único `window.open` relevante es para impresión (`PacientesTab.jsx:302`) y enlace externo de WhatsApp (`App.js:187`), ambos aceptables.
- **✅ `Promise.allSettled`** usado correctamente en polling de estado SRI (`FacturacionTab.jsx:120`).

- **🟡 MEDIO — 151 llamadas axios "crudas"** (con headers manuales) en lugar de `apiClient`, en 30 archivos. Mayor concentración: `OdontogramaClinicoTab.jsx` (13), `FacturacionTab.jsx` (14), `PlanTratamientoTab.jsx` (10), `OdontologiaFormSimple.jsx` (11), `PediatriaForm.jsx` (8). Funcionalmente correcto (inyectan el token manualmente) pero inconsistente con la convención de `apiClient`.
- **🟡 MEDIO — Errores silenciosos sin feedback al usuario**: `FacturacionTab.jsx:129` (`catch(e){console.error(e)}` sin toast); subida de `.p12` en `ConfiguracionSRI.jsx` sin toast de error.
- **🟢 BAJO — `OdontogramaTab.jsx` (425 líneas) huérfano** — versión V1 pre-refactor, no se importa en ningún lado. Candidato a eliminación (no confundir con `OdontogramaClinicoTab.jsx`, que es el activo, ni con `OdontogramaStandalone.jsx`, que sí se usa).
- **🟢 BAJO — `ConfiguracionSRI.jsx:33`**: `Promise.all` (no `allSettled`) para cargar config SRI + Email; si la config de email aún no existe, podría afectar la carga de la config SRI también (edge case).
- **🟢 BAJO — `OdontogramaClinicoTab.jsx`** tiene 17 `useState` — al límite del umbral recomendado (15), sin urgencia de refactor.

### Estado de gestión de estado / arquitectura frontend

- Sin prop-drilling problemático detectado.
- Sin re-fetches innecesarios detectados (dependencias de `useEffect` correctas).
- `modules/dental/` (motor clínico) bien modularizado: `clinical_rules.js` (219 líneas), `useClinicalEngine.js` (78), `useTreatmentPipeline.js` (296, con manejo de conflictos `plan_version`/409 y retry queue), `useRetryQueue.js` (115, backoff exponencial 2s→32s, offline-first).
- `modules/counter/`: `DatosCitaTab.jsx` (253), `FichaClinicaTab.jsx` (125), `useCitaForm.js` (207) — limpios, sin duplicación.

---

## 3. Integraciones Externas

| Integración | Estado real |
|---|---|
| SRI (firma `.p12`, SOAP recepción/autorización) | ✅ Implementado y funcional. Sin validación de expiración de certificado antes de firmar (riesgo medio). |
| Email (Gmail API) | ⏳ Código backend + frontend completo (commit `d88db08`). **Bloqueado** hasta completar Parte A: Google Cloud Console (proyecto, Gmail API habilitada, pantalla de consentimiento, credenciales OAuth) + ejecutar `backend/scripts/gmail_oauth_setup.py` localmente para obtener `refresh_token`. |
| Render (deploy) | ✅ Operativo. Confirmado que bloquea SMTP saliente (causa raíz del bug de email original, ya resuelta vía Gmail API). |
| GitHub | ✅ 7 commits de la sesión anterior pusheados correctamente a `origin/main`. |

---

## 4. Estado Funcional Real (verificado contra código)

| Funcionalidad | Estado verificado |
|---|---|
| Odontograma (dentición Permanente/Mixta/Decidua) | ✅ Funcionando correctamente (fix 2026-06-13 verificado en código) |
| Plan de tratamiento / pipeline | ✅ Funcionando (offline-first con retry queue, manejo de conflictos por versión) |
| Facturación SRI (emisión, consulta estado) | ✅ Funcionando, con persistencia de estado mejorada (commit `ac769df`) |
| Envío RIDE por correo | ⏳ Código listo, **no operativo** hasta completar Parte A (Gmail OAuth2) |
| Ficha clínica en nueva cita | ✅ Funcionando — **se corrige el estado "incierto" de PROJECT_STATUS.md** |
| Caja, proformas, abonos, IA médica, laboratorio, fotos/RX | ✅ Funcionando, sin hallazgos relevantes |
| Historial odontológico (`medical_history.py`) | ⚠️ Funcional pero con endpoint duplicado (`create_odontology_history`) a revisar |

---

## 5. Riesgos Técnicos (consolidado, todas las áreas)

| # | Riesgo | Severidad | Área |
|---|---|---|---|
| 1 | Endpoint duplicado `create_odontology_history` en `medical_history.py` | 🔴 Alto | Backend |
| 2 | Sin rate limiting en login (`users.py`) | 🟡 Medio | Backend/Seguridad |
| 3 | 30+ `except Exception: pass` silenciosos | 🟡 Medio | Backend |
| 4 | Sin validación de expiración del `.p12` antes de firmar | 🟡 Medio | Integración SRI |
| 5 | 151 llamadas axios crudas vs `apiClient` (30 archivos) | 🟡 Medio | Frontend |
| 6 | Errores sin feedback visual (toast) en `FacturacionTab.jsx` y `ConfiguracionSRI.jsx` | 🟡 Medio | Frontend |
| 7 | Gmail API pendiente de credenciales (Parte A, acción del usuario) | 🟡 Medio | Integración |
| 8 | Archivos backup muertos (~2000 líneas: `server_old.py`, `server_fase2.py`, `server_backup_fase2.py`) | 🟢 Bajo | Backend |
| 9 | `OdontogramaTab.jsx` huérfano (425 líneas) | 🟢 Bajo | Frontend |
| 10 | Routers/componentes monolíticos (>1000 líneas) | 🟢 Bajo | Arquitectura |

---

## 6. Calidad de Código

### Fortalezas
- Motor clínico (`modules/dental/`) bien modularizado, sin duplicación detectada.
- Offline-first con retry queue y backoff exponencial.
- IA médica desacoplada y no bloqueante (degrada con gracia sin API key).
- Sin secretos hardcodeados en ningún archivo revisado.
- Sin caracteres corruptos (encoding limpio en muestra revisada).
- `Promise.allSettled` usado correctamente donde corresponde.
- Descargas de archivos siguen el patrón seguro `fetch + blob + Bearer`.

### Debilidades
- 4 routers backend y 1+ componentes frontend superan 1000 líneas — candidatos a dividir por dominio.
- Patrón de llamadas API inconsistente (axios crudo vs `apiClient`).
- Manejo de errores silencioso disperso (backend y frontend).
- ~2400 líneas de archivos muertos/huérfanos totales (backend + frontend).

---

## 7. Priorización para Próximas Fases

### 🔴 Crítico
*(Ninguno — no hay bloqueadores de producción)*

### 🟠 Alto
1. Resolver endpoint duplicado `create_odontology_history` en `medical_history.py`.
2. Completar Parte A de Gmail API (acción del usuario) + prueba E2E de envío de RIDE.
3. Verificación en producción de los 3 fixes de la sesión 2026-06-13 (odontograma, estado SRI, email).

### 🟡 Medio
4. Agregar rate limiting al login.
5. Reemplazar `except: pass` silenciosos por logging estructurado, priorizando `billing.py` y `odontology.py`.
6. Agregar validación de expiración del certificado `.p12` antes de firmar (alerta proactiva).
7. Agregar `toast.error()` en catches silenciosos de `FacturacionTab.jsx` y `ConfiguracionSRI.jsx`.

### 🟢 Bajo
8. Eliminar archivos muertos: `server_old.py`, `server_fase2.py`, `server_backup_fase2.py`, `OdontogramaTab.jsx`.
9. Migración gradual de axios crudo → `apiClient` (empezar por los archivos con mayor concentración).
10. Modularizar routers/componentes >1000 líneas (`billing.py`, `financial_routes.py`, `odontology.py`, `medical_history.py`, `PlanTratamientoTab.jsx`).
11. ✅ Ya aplicado en PROJECT_STATUS.md: marcar integración `FichaClinicaTab` como confirmada/funcional.

---

## Roadmap Propuesto

Ver sección "Roadmap Propuesto" en `PROJECT_STATUS.md` (sincronizado con esta auditoría).

---

*Documento generado a partir de auditoría de código fuente real — 2026-06-13. No se realizaron modificaciones de código durante esta auditoría.*
