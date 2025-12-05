from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "familyhealth")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
