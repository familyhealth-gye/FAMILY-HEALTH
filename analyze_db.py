#!/usr/bin/env python3
"""Script para analizar el estado actual de la base de datos"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def analyze_db():
    MONGO_URL = os.environ.get('MONGODB_URI', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    DB_NAME = os.environ.get('DB_NAME', 'family_health_db')
    
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    
    print(f"📊 Conectado a: {DB_NAME}\n")
    
    # Listar colecciones
    collections = await db.list_collection_names()
    print("📁 Colecciones existentes:")
    for col in sorted(collections):
        count = await db[col].count_documents({})
        print(f"  - {col}: {count} documentos")
    
    print("\n" + "="*60)
    
    # Revisar appointments con cédulas
    print("\n🔍 Revisando appointments (citas):")
    appointments = await db.appointments.find({}, {"cedula": 1, "nombre_completo": 1, "_id": 0}).to_list(1000)
    cedulas_appointments = {}
    for apt in appointments:
        cedula = apt.get('cedula', '')
        nombre = apt.get('nombre_completo', '')
        if cedula:
            if cedula not in cedulas_appointments:
                cedulas_appointments[cedula] = []
            cedulas_appointments[cedula].append(nombre)
    
    print(f"  Total citas: {len(appointments)}")
    print(f"  Cédulas únicas: {len(cedulas_appointments)}")
    duplicados = {c: nombres for c, nombres in cedulas_appointments.items() if len(set(nombres)) > 1}
    if duplicados:
        print(f"  ⚠️  Cédulas con nombres diferentes: {len(duplicados)}")
        for ced, nombres in list(duplicados.items())[:3]:
            print(f"      {ced}: {set(nombres)}")
    
    # Revisar si existe colección pacientes
    print("\n🔍 Revisando pacientes:")
    pacientes_count = await db.pacientes.count_documents({})
    print(f"  Total pacientes: {pacientes_count}")
    if pacientes_count > 0:
        sample = await db.pacientes.find_one({}, {"_id": 0})
        print(f"  Ejemplo: {sample.get('cedula', 'N/A')} - {sample.get('nombre', 'N/A')}")
    
    # Revisar proformas
    print("\n🔍 Revisando proformas:")
    proformas = await db.proformas.find({}, {"paciente_cedula": 1, "paciente_nombre": 1, "_id": 0}).to_list(1000)
    print(f"  Total proformas: {len(proformas)}")
    cedulas_proformas = set(p.get('paciente_cedula', '') for p in proformas if p.get('paciente_cedula'))
    print(f"  Cédulas únicas en proformas: {len(cedulas_proformas)}")
    
    # Revisar consultas financieras
    print("\n🔍 Revisando consultas_financieras:")
    consultas = await db.consultas_financieras.find({}, {"paciente_cedula": 1, "paciente_nombre": 1, "_id": 0}).to_list(1000)
    print(f"  Total consultas financieras: {len(consultas)}")
    cedulas_consultas = set(c.get('paciente_cedula', '') for c in consultas if c.get('paciente_cedula'))
    print(f"  Cédulas únicas en consultas: {len(cedulas_consultas)}")
    
    # Revisar odontogramas
    print("\n🔍 Revisando odontogramas clínicos:")
    odontogramas = await db.odontograma_clinico.find({}, {"paciente_id": 1, "_id": 0}).to_list(1000)
    print(f"  Total odontogramas: {len(odontogramas)}")
    
    # Todas las cédulas únicas del sistema
    todas_cedulas = set()
    todas_cedulas.update(cedulas_appointments.keys())
    todas_cedulas.update(cedulas_proformas)
    todas_cedulas.update(cedulas_consultas)
    todas_cedulas.discard('')
    
    print(f"\n📊 RESUMEN GLOBAL:")
    print(f"  Total cédulas únicas en el sistema: {len(todas_cedulas)}")
    print(f"  Pacientes en colección 'pacientes': {pacientes_count}")
    if len(todas_cedulas) > pacientes_count:
        print(f"  ⚠️  Pacientes faltantes por crear: {len(todas_cedulas) - pacientes_count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(analyze_db())
