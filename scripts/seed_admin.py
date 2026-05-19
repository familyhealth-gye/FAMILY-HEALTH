#!/usr/bin/env python3
"""
Crea el primer usuario Administrador si la base de datos no tiene usuarios.

Uso (desde la raíz del proyecto, con variables de entorno cargadas):
  python scripts/seed_admin.py
  python scripts/seed_admin.py --username admin --password "TuClaveSegura" --nombre "Admin Principal"
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / "backend" / ".env")
load_dotenv()

from db import db, close_client  # noqa: E402
from auth import get_password_hash  # noqa: E402
from models import User  # noqa: E402
from datetime import datetime, timezone

async def seed_admin(username: str, password: str, nombre: str, email: str) -> None:
    count = await db.users.count_documents({})
    if count > 0:
        print(f"⚠️  Ya existen {count} usuario(s). No se creó ningún administrador.")
        return

    existing = await db.users.find_one({"username": username})
    if existing:
        print(f"⚠️  El usuario '{username}' ya existe.")
        return

    user_obj = User(
        username=username,
        email=email,
        nombre_completo=nombre,
        role="Administrador",
        hashed_password=get_password_hash(password),
    )
    doc = user_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()

    await db.users.insert_one(doc)
    print(f"✅ Administrador creado: {username} ({nombre})")


def main():
    parser = argparse.ArgumentParser(description="Seed del primer Administrador Family Health")
    parser.add_argument("--username", default=os.environ.get("SEED_ADMIN_USER", "admin"))
    parser.add_argument("--password", default=os.environ.get("SEED_ADMIN_PASSWORD", "admin123"))
    parser.add_argument("--nombre", default=os.environ.get("SEED_ADMIN_NOMBRE", "Administrador"))
    parser.add_argument("--email", default=os.environ.get("SEED_ADMIN_EMAIL", "admin@familyhealth.local"))
    args = parser.parse_args()

    async def run():
        try:
            await seed_admin(args.username, args.password, args.nombre, args.email)
        finally:
            await close_client()

    asyncio.run(run())


if __name__ == "__main__":
    main()
