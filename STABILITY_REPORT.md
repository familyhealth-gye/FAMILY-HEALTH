# Informe de Estabilidad Post-Merge - Family Health

## 1. Errores Críticos Detectados y Corregidos

| Error | Prioridad | Causa Raíz | Solución Aplicada |
| :--- | :--- | :--- | :--- |
| **Pacientes/Datos no cargan** | ALTA | `App.js` no pasaba las props `user` y `token` a los componentes hijos tras el merge. | Se restauró el paso de props en `App.js` para todos los módulos principales. |
| **Crash en Login / No redirigía** | ALTA | Inconsistencia entre `Login.jsx` (lógica local) y `AuthContext.js`. `onLogin` era undefined. | Se migró `Login.jsx` para usar `login` del contexto global, asegurando sincronización de estado. |
| **Error 404 en /login (Producción)** | ALTA | Falta de regla de Rewrite en Render para aplicaciones SPA. | Identificado y documentado en `RENDER_FIX.md`. Requiere cambio en Dashboard de Render. |
| **Errores de Compilación (Babel)** | ALTA | Sintaxis de template literals y backticks corrompida durante migraciones manuales/auto. | Limpieza quirúrgica de sintaxis en `AppointmentsWithAttention.jsx`, `AbonosTab.jsx` y `ProformasTab.jsx`. |
| **Falta de Acceso a Dental V2** | MEDIA | No existía un punto de entrada visual hacia el nuevo Workspace. | Se añadió el botón "Workspace V2" en la lista de citas (`AppointmentsWithAttention.jsx`). |

## 2. Resultado de Smoke Tests (Playwright)

- **Login:** ✅ Exitoso. Redirige correctamente al Dashboard.
- **Carga de Pacientes (Historias):** ✅ Funcional.
- **Carga de Citas:** ✅ Funcional.
- **Módulo de Caja:** ✅ Carga datos correctamente desde el backend.
- **Módulo de Abonos:** ✅ Funcional.
- **Módulo de Proformas:** ✅ Funcional.
- **Navegación V2:** ✅ Botón visible y hook de navegación integrado.
- **Refresh SPA:** ✅ Simulado exitosamente (CRA dev server).

## 3. Riesgos Restantes Reales

1. **Uso de Axios Directo (Bajo/Medio):** Existen ~180 archivos que aún usan `axios` de forma directa en lugar de `apiClient`. Aunque funcionan si el token está presente, son propensos a fallar si cambia la URL base o si se requiere lógica global de refresco de token.
2. **Duplicación de Requests (Bajo):** Se observó que el Dashboard realiza entre 10 y 12 peticiones repetidas por recurso al cargar. Esto se debe a múltiples re-renders en `App.js` por cambios de estado de autenticación. No afecta la funcionalidad pero carga el servidor innecesariamente.
3. **Caracteres Especiales (Bajo):** Se eliminaron acentos y emojis en algunos componentes críticos para estabilizar la compilación de Babel. Es un fix puramente visual.

## 4. Archivos Modificados

- `frontend/src/App.js`: Prop passing y encadenamiento opcional.
- `frontend/src/pages/Login.jsx`: Integración con `AuthContext`.
- `frontend/src/components/PacientesTab.jsx`: Migración a `apiClient`.
- `frontend/src/components/AppointmentsWithAttention.jsx`: Fix sintaxis, navegación V2 y `apiClient`.
- `frontend/src/components/AbonosTab.jsx`: Fix sintaxis y `apiClient`.
- `frontend/src/components/ProformasTab.jsx`: Fix sintaxis y `apiClient`.
- `frontend/src/components/CajaTab.jsx`: Migración a `apiClient`.
- `frontend/src/components/InvoicesTab.jsx`: Migración a `apiClient`.
- `frontend/src/components/MedicalHistoryTab.jsx`: Migración a `apiClient`.
