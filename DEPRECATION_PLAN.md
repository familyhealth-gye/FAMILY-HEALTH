# Estrategia de Deprecación: Odontogramas Legacy

## Estado Actual
Existen dos colecciones y conjuntos de modelos para el manejo de odontogramas:
1.  **Legacy (`db.odontograms`)**: Utiliza modelos `ToothState` y `Odontogram`. Estructura simplificada.
2.  **Productivo (`db.odontogramas_clinicos`)**: Utiliza modelos `DienteFDI` y `OdontogramaClinico`. Sigue el estándar FDI y permite diagnóstico detallado por superficie.

## Plan de Deprecación (Propuesto)

### Fase 0 (Actual)
- **Identificación**: Se han identificado todas las rutas que consumen la colección legacy.
- **Documentación**: Marcar las rutas en `backend/routers/odontology.py` como deprecated usando el parámetro de FastAPI.

### Fase 1 (Próximamente)
- **Migración de Datos**: Desarrollar un script para convertir documentos de `odontograms` al formato `odontogramas_clinicos` (basado en mapeo FDI).
- **Solo Lectura**: Deshabilitar los métodos POST, PUT y DELETE de las rutas legacy, permitiendo solo GET para historial.

### Fase 2
- **Eliminación**: Una vez verificado que el frontend ya no consume estas rutas, eliminar el código y la colección legacy.

## Recomendación Inmediata
Se recomienda a los desarrolladores de frontend migrar el uso de `GET /odontograms` a `GET /odontogramas-clinicos` a la brevedad posible.
