from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# 🚨 FORZAMOS a usar SIEMPRE la URL del .env
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "familyhealth")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
