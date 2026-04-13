#!/usr/bin/env python3
"""
Script de Migración de Datos: Unificación de Pacientes
Este script migra datos existentes al nuevo sistema de pacientes unificados por cédula.

IMPORTANTE: Este script NO borra datos, solo agrega campos y crea registros de pacientes.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
import uuid

async def migrar_pacientes():
    MONGO_URL = os.environ.get('MONGODB_URI', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    DB_NAME = os.environ.get('DB_NAME', 'family_health_db')
    
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    
    print("=" * 70)
    print("MIGRACIÓN DE DATOS: UNIFICACIÓN DE PACIENTES")
    print("=" * 70)
    
    # Paso 1: Obtener todas las citas
    print("\n📋 Paso 1: Obteniendo citas existentes...")
    appointments = await db.appointments.find({}).to_list(1000)
    print(f"   ✓ Encontradas {len(appointments)} citas")
    
    if len(appointments) == 0:
        print("\n⚠️  No hay citas para migrar")
        client.close()
        return
    
    # Paso 2: Extraer pacientes únicos por cédula
    print("\n📋 Paso 2: Identificando pacientes únicos...")
    pacientes_por_cedula = {}
    
    for apt in appointments:
        cedula = apt.get('cedula', '')
        if not cedula or cedula.strip() == '':
            print(f"   ⚠️  Cita sin cédula: {apt.get('nombre_completo', 'N/A')}")
            continue
        
        if cedula not in pacientes_por_cedula:
            pacientes_por_cedula[cedula] = {
                'cedula': cedula,
                'nombre': apt.get('nombre_completo', ''),
                'telefono': apt.get('telefono', ''),
                'fecha_nacimiento': apt.get('fecha_nacimiento', ''),
                'edad': apt.get('edad', 0),
                'email': '',
                'direccion': '',
                'sexo': ''
            }
    
    print(f"   ✓ Identificados {len(pacientes_por_cedula)} pacientes únicos")
    
    # Paso 3: Crear registros de pacientes si no existen
    print("\n📋 Paso 3: Creando registros de pacientes...")
    pacientes_creados = 0
    pacientes_existentes = 0
    pacientes_map = {}  # cedula -> paciente_id
    
    for cedula, datos in pacientes_por_cedula.items():
        # Verificar si ya existe
        existing = await db.pacientes.find_one({"cedula": cedula}, {"_id": 0})
        
        if existing:
            pacientes_existentes += 1
            pacientes_map[cedula] = existing['id']
            print(f"   → Ya existe: {datos['nombre']} ({cedula})")
        else:
            # Crear nuevo paciente
            paciente_id = str(uuid.uuid4())
            paciente_doc = {
                "id": paciente_id,
                "cedula": cedula,
                "nombre": datos['nombre'],
                "telefono": datos['telefono'],
                "email": datos.get('email', ''),
                "direccion": datos.get('direccion', ''),
                "fecha_nacimiento": datos.get('fecha_nacimiento', ''),
                "sexo": datos.get('sexo', ''),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.pacientes.insert_one(paciente_doc)
            pacientes_map[cedula] = paciente_id
            pacientes_creados += 1
            print(f"   ✓ Creado: {datos['nombre']} ({cedula})")
    
    print(f"\n   Resumen:")
    print(f"   - Pacientes creados: {pacientes_creados}")
    print(f"   - Pacientes ya existentes: {pacientes_existentes}")
    
    # Paso 4: Actualizar appointments con paciente_cedula y paciente_id
    print("\n📋 Paso 4: Actualizando citas con referencias a pacientes...")
    citas_actualizadas = 0
    citas_sin_cedula = 0
    
    for apt in appointments:
        cedula = apt.get('cedula', '')
        if not cedula or cedula.strip() == '':
            citas_sin_cedula += 1
            continue
        
        # Obtener paciente_id del mapa
        paciente_id = pacientes_map.get(cedula)
        if not paciente_id:
            print(f"   ⚠️  No se encontró paciente_id para cédula: {cedula}")
            continue
        
        # Actualizar appointment
        update_data = {
            "paciente_cedula": cedula,
            "paciente_id": paciente_id
        }
        
        # Si no tiene fecha_nacimiento pero tiene edad, calcular aproximada
        if not apt.get('fecha_nacimiento') and apt.get('edad'):
            edad = apt.get('edad', 0)
            if edad > 0:
                # Calcular fecha aproximada (año actual - edad)
                year_nacimiento = datetime.now().year - edad
                update_data["fecha_nacimiento"] = f"{year_nacimiento}-01-01"
        
        await db.appointments.update_one(
            {"id": apt['id']},
            {"$set": update_data}
        )
        citas_actualizadas += 1
    
    print(f"   ✓ Citas actualizadas: {citas_actualizadas}")
    if citas_sin_cedula > 0:
        print(f"   ⚠️  Citas sin cédula (no actualizadas): {citas_sin_cedula}")
    
    # Paso 5: Actualizar proformas (si existen)
    print("\n📋 Paso 5: Actualizando proformas...")
    proformas = await db.proformas.find({}).to_list(1000)
    proformas_actualizadas = 0
    
    for proforma in proformas:
        cedula = proforma.get('paciente_cedula', '')
        if cedula and cedula in pacientes_map:
            await db.proformas.update_one(
                {"id": proforma['id']},
                {"$set": {"paciente_id": pacientes_map[cedula]}}
            )
            proformas_actualizadas += 1
    
    print(f"   ✓ Proformas actualizadas: {proformas_actualizadas}")
    
    # Paso 6: Actualizar consultas financieras (si existen)
    print("\n📋 Paso 6: Actualizando consultas financieras...")
    consultas = await db.consultas_financieras.find({}).to_list(1000)
    consultas_actualizadas = 0
    
    for consulta in consultas:
        cedula = consulta.get('paciente_cedula', '')
        if cedula and cedula in pacientes_map:
            await db.consultas_financieras.update_one(
                {"id": consulta['id']},
                {"$set": {"paciente_id": pacientes_map[cedula]}}
            )
            consultas_actualizadas += 1
    
    print(f"   ✓ Consultas financieras actualizadas: {consultas_actualizadas}")
    
    # Resumen final
    print("\n" + "=" * 70)
    print("RESUMEN DE MIGRACIÓN")
    print("=" * 70)
    print(f"✅ Pacientes únicos identificados: {len(pacientes_por_cedula)}")
    print(f"✅ Registros de pacientes creados: {pacientes_creados}")
    print(f"✅ Pacientes ya existentes: {pacientes_existentes}")
    print(f"✅ Citas actualizadas: {citas_actualizadas}")
    print(f"✅ Proformas actualizadas: {proformas_actualizadas}")
    print(f"✅ Consultas financieras actualizadas: {consultas_actualizadas}")
    
    if citas_sin_cedula > 0:
        print(f"\n⚠️  ADVERTENCIA: {citas_sin_cedula} citas sin cédula no fueron actualizadas")
        print("   Estas citas necesitarán actualización manual.")
    
    print("\n✅ Migración completada exitosamente")
    print("=" * 70)
    
    client.close()

if __name__ == "__main__":
    print("\n⚠️  IMPORTANTE: Este script migra datos existentes al nuevo sistema.")
    print("   NO borra ningún dato, solo agrega campos y crea registros de pacientes.")
    print()
    
    respuesta = input("¿Desea continuar con la migración? (si/no): ")
    
    if respuesta.lower() in ['si', 'sí', 's', 'yes', 'y']:
        asyncio.run(migrar_pacientes())
    else:
        print("Migración cancelada.")
