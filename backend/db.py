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
    # ── Unicidad ──────────────────────────────────────────────────────────────
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
    # ── planes_tratamiento ────────────────────────────────────────────────────
    {
        "collection": "planes_tratamiento",
        "keys": "paciente_cedula",
        "name": "idx_planes_paciente_cedula",
        "unique": False,
    },
    {
        "collection": "planes_tratamiento",
        "keys": "paciente_id",
        "name": "idx_planes_paciente_id",
        "unique": False,
    },
    {
        "collection": "planes_tratamiento",
        "keys": "estado",
        "name": "idx_planes_estado",
        "unique": False,
    },
    {
        "collection": "planes_tratamiento",
        "keys": "updated_at",
        "name": "idx_planes_updated_at",
        "unique": False,
    },
    # ── pipeline_audit_log ────────────────────────────────────────────────────
    {
        "collection": "pipeline_audit_log",
        "keys": "plan_id",
        "name": "idx_audit_plan_id",
        "unique": False,
    },
    {
        "collection": "pipeline_audit_log",
        "keys": "entity_id",
        "name": "idx_audit_entity_id",
        "unique": False,
    },
    {
        "collection": "pipeline_audit_log",
        "keys": "paciente_cedula",
        "name": "idx_audit_paciente",
        "unique": False,
    },
    {
        "collection": "pipeline_audit_log",
        "keys": "timestamp",
        "name": "idx_audit_timestamp",
        "unique": False,
    },
    # ── appointments ──────────────────────────────────────────────────────────
    {
        "collection": "appointments",
        "keys": "cedula",
        "name": "idx_appointments_cedula",
        "unique": False,
    },
]

# Índices compuestos (se crean en ensure_indexes con lógica separada)
COMPOUND_INDEX_SPECS = [
    {
        "collection": "planes_tratamiento",
        "keys": [("paciente_cedula", 1), ("estado", 1)],
        "name": "idx_planes_cedula_estado",
    },
    {
        "collection": "pipeline_audit_log",
        "keys": [("plan_id", 1), ("timestamp", -1)],
        "name": "idx_audit_plan_time",
    },
]


async def ensure_indexes() -> None:
    """Crea índices (idempotente). Registra error si hay duplicados previos."""
    from atomic_ops import sync_invoice_sequences

    await sync_invoice_sequences()

    # Índices simples
    for spec in INDEX_SPECS:
        collection = db[spec["collection"]]
        kwargs: dict = {"name": spec["name"]}
        if spec.get("unique"):
            kwargs["unique"] = True
        if "partialFilterExpression" in spec:
            kwargs["partialFilterExpression"] = spec["partialFilterExpression"]
        try:
            await collection.create_index(spec["keys"], **kwargs)
            logger.info("Índice OK: %s.%s", spec["collection"], spec["name"])
        except Exception as exc:
            logger.error(
                "No se pudo crear índice %s en %s: %s.",
                spec["name"], spec["collection"], exc,
            )

    # Índices compuestos
    for spec in COMPOUND_INDEX_SPECS:
        collection = db[spec["collection"]]
        try:
            await collection.create_index(spec["keys"], name=spec["name"])
            logger.info("Índice compuesto OK: %s.%s", spec["collection"], spec["name"])
        except Exception as exc:
            logger.error(
                "No se pudo crear índice compuesto %s en %s: %s.",
                spec["name"], spec["collection"], exc,
            )


async def close_client() -> None:
    client.close()


print(f"✅ MongoDB configurado: {DB_NAME}")
