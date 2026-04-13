# RECUPERACIÓN DE DATOS - INSTRUCCIONES URGENTES

## ⚠️ SITUACIÓN ACTUAL

Los datos anteriores (citas, doctores, usuarios, proformas, etc.) se perdieron debido a un error en el seed de especialidades que ejecutó `delete_many({})`.

**Datos afectados:**
- appointments: 15 registros
- doctors: 5 doctores
- users: 8 usuarios  
- proformas: 10 registros
- consultas_financieras: 4 registros
- medical_history: varios registros
- prescriptions: 4 registros
- odontogramas_clinicos: 14 registros
- planes_tratamiento: 5 registros
- catalogo_servicios: 21 registros

---

## 🔧 OPCIONES DE RECUPERACIÓN

### OPCIÓN 1: Restaurar desde MongoDB Atlas (RECOMENDADO)

MongoDB Atlas hace backups automáticos. Para restaurar:

1. **Acceder a MongoDB Atlas:**
   - Ir a https://cloud.mongodb.com
   - Iniciar sesión con tu cuenta

2. **Restaurar desde Snapshot:**
   - Seleccionar tu cluster
   - Ir a "Backup" → "Snapshots"
   - Buscar snapshot del día de hoy ANTES del error (antes de las pruebas)
   - Click en "Restore"
   - Seleccionar "Download" o "Restore to Cluster"

3. **Verificar datos restaurados:**
   ```bash
   cd /app
   python3 analyze_db.py
   ```

---

### OPCIÓN 2: Importar desde Backup Manual (si tienes)

Si tienes un export/dump de MongoDB:

```bash
# Restaurar desde dump
mongorestore --uri="tu_mongodb_uri" --db=family_health_db /ruta/al/dump
```

---

### OPCIÓN 3: Re-ingresar Datos Manualmente

Si no tienes backup, tendrás que re-ingresar los datos.

**IMPORTANTE:** He creado un script de migración que automáticamente:
- Crea registros de pacientes desde citas
- Vincula todo con cédula como identificador único
- NO borra datos existentes

**Uso del script:**
```bash
cd /app
python3 scripts/migrar_pacientes.py
```

Este script se ejecutará DESPUÉS de que reingreses los datos básicos (doctores, usuarios, citas).

---

## ✅ CORRECCIONES APLICADAS

He modificado el código para PREVENIR que esto vuelva a pasar:

1. **`/app/backend/server.py`:**
   - Endpoint `/especialidades/seed` ya NO borra datos existentes
   - Solo agrega especialidades faltantes
   - Respeta datos existentes

2. **Script de migración creado:**
   - `/app/scripts/migrar_pacientes.py`
   - NO destructivo
   - Migra datos existentes al nuevo sistema de pacientes unificados

---

## 📋 PASOS RECOMENDADOS

### Paso 1: Intentar Restauración desde MongoDB Atlas

Es la opción más rápida y segura.

### Paso 2: Verificar Datos

```bash
cd /app
python3 analyze_db.py
```

### Paso 3: Ejecutar Migración (si tienes datos)

```bash
python3 scripts/migrar_pacientes.py
```

### Paso 4: Verificar Sistema

Probar que:
- Las citas se crean con paciente_cedula
- No se duplican pacientes
- Los reportes funcionan

---

## 🚨 PREVENCIÓN FUTURA

**Reglas implementadas:**
1. ✅ Seeds ya NO borran datos existentes
2. ✅ Script de migración NO destructivo
3. ✅ Validaciones antes de `delete_many()`

**Código actualizado:**
- `/app/backend/server.py` - seed de especialidades corregido
- `/app/scripts/migrar_pacientes.py` - script de migración seguro

---

## 📞 SOPORTE

Si necesitas ayuda con la restauración desde MongoDB Atlas:
1. Comparte screenshot del panel de Atlas
2. Confirma si ves snapshots disponibles
3. Te guiaré paso a paso

---

**Fecha del incidente:** 2025-01-XX
**Causa:** `await db.especialidades.delete_many({})` en seed
**Solución:** Restaurar desde backup de MongoDB Atlas
**Prevención:** Seeds modificados para NO borrar datos

