"""Compatibilidad: use `from db import db, client`."""
from db import client, db, close_client, ensure_indexes, DB_NAME, MONGO_URL

__all__ = ["client", "db", "close_client", "ensure_indexes", "DB_NAME", "MONGO_URL"]
