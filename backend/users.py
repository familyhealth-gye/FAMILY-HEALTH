from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from .auth import get_password_hash, require_role
import os

# Conexión Mongo
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ["MONGO_URL"]  # obligatorio, sin fallback
DB_NAME = os.environ.get("DB_NAME", "family_health")

client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]

router = APIRouter(prefix="/api/users", tags=["Usuarios"])

# Modelos
class UserCreate(BaseModel):
    username: str
    password: str
    role: str  # "Administrador", "Recepción", "Doctor"
    nombre_completo: str

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    nombre_completo: str

# Crear usuario
@router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate, current_user=Depends(require_role("Administrador"))):
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    hashed_password = get_password_hash(user.password)
    user_dict = {
        "username": user.username,
        "password": hashed_password,
        "role": user.role,
        "nombre_completo": user.nombre_completo
    }
    result = await db.users.insert_one(user_dict)
    return UserResponse(
        id=str(result.inserted_id),
        username=user.username,
        role=user.role,
        nombre_completo=user.nombre_completo
    )

# Listar usuarios
@router.get("/", response_model=List[UserResponse])
async def list_users(current_user=Depends(require_role("Administrador"))):
    users = []
    async for u in db.users.find({}, {"password": 0}):
        users.append(UserResponse(
            id=str(u["_id"]),
            username=u["username"],
            role=u["role"],
            nombre_completo=u.get("nombre_completo", "")
        ))
    return users
