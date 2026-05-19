"""
Conexión única a MongoDB (Motor) e índices de integridad.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv()

MONGO_URL = os.environ.get(
    "MONGODB_URI",
    os.environ.get("MONGO_URL", "mongodb://localhost:27017"),
)
DB_NAME = os.environ.get("DB_NAME", "family_health_db")

client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

_NON_EMPTY_STRING = {"$exists": True, "$type": "string", "$gt": ""}

INDEX_SPECS = [
    {
        "collection": "pacientes",
        "keys": "cedula",
        "name": "uniq_pacientes_cedula",
        "unique": True,
        "partialFilterExpression": {"cedula": _NON_EMPTY_STRING},
    },
    {
        "collection": "invoices",
        "keys": "numero_factura",
        "name": "uniq_invoices_numero_factura",
        "unique": True,
        "partialFilterExpression": {"numero_factura": _NON_EMPTY_STRING},
    },
    {
        "collection": "users",
        "keys": "username",
        "name": "uniq_users_username",
        "unique": True,
        "partialFilterExpression": {"username": _NON_EMPTY_STRING},
    },
]


async def ensure_indexes() -> None:
    """Crea índices únicos (idempotente). Registra error si hay duplicados previos."""
    from atomic_ops import sync_invoice_sequences

    await sync_invoice_sequences()

    for spec in INDEX_SPECS:
        collection = db[spec["collection"]]
        kwargs = {
            "unique": spec["unique"],
            "name": spec["name"],
        }
        if "partialFilterExpression" in spec:
            kwargs["partialFilterExpression"] = spec["partialFilterExpression"]
        try:
            await collection.create_index(spec["keys"], **kwargs)
            logger.info("Índice OK: %s.%s", spec["collection"], spec["name"])
        except Exception as exc:
            logger.error(
                "No se pudo crear índice %s en %s: %s. "
                "Revise duplicados en la colección antes de desplegar.",
                spec["name"],
                spec["collection"],
                exc,
            )


async def close_client() -> None:
    client.close()


print(f"✅ MongoDB configurado: {DB_NAME}")
