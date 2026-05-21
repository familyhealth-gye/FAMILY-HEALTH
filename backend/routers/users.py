from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from db import db
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_role,
    Token, TokenData, UserLogin, optional_security, decode_token,
)
from models import User, UserCreate, UserResponse

router = APIRouter(tags=["auth", "users"])

async def _persist_new_user(user_input: UserCreate, *, bootstrap: bool = False) -> UserResponse:
    """Crea usuario en BD. En bootstrap fuerza rol Administrador."""
    existing = await db.users.find_one({"username": user_input.username})
    if existing:
        raise HTTPException(status_code=400, detail="Usuario ya existe")

    hashed_password = get_password_hash(user_input.password)
    user_dict = user_input.model_dump()
    user_dict.pop("password")
    user_dict["hashed_password"] = hashed_password

    if bootstrap:
        user_dict["role"] = "Administrador"
    elif user_dict.get("role") == "Doctor" and not user_dict.get("doctor_id"):
        doctor_id = str(uuid.uuid4())
        doctor_dict = {
            "id": doctor_id,
            "nombre": user_dict["nombre_completo"],
            "especialidad": user_dict.get("especialidad", "General"),
            "subespecialidad": "",
            "porcentaje": 50.0,
            "telefono": "",
            "email": user_dict["email"],
            "cedula": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.doctors.insert_one(doctor_dict)
        user_dict["doctor_id"] = doctor_id

    user_obj = User(**user_dict)
    doc = user_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()

    await db.users.insert_one(doc)
    return UserResponse(**user_obj.model_dump())


@router.get("/auth/setup-status")
async def auth_setup_status():
    """Indica si el sistema necesita crear el primer administrador (instalación nueva)."""
    user_count = await db.users.count_documents({})
    return {
        "needs_setup": user_count == 0,
        "user_count": user_count,
    }


@router.post("/auth/register", response_model=UserResponse)
async def register(
    user_input: UserCreate,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
):
    """
    Registro de usuarios.
    - Sin usuarios en BD: permite crear el primer Administrador (bootstrap, sin token).
    - Con usuarios: solo un Administrador autenticado puede registrar.
    """
    user_count = await db.users.count_documents({})

    if user_count == 0:
        if await db.users.find_one({}, {"_id": 1}):
            raise HTTPException(
                status_code=409,
                detail="La instalación inicial ya fue completada. Inicie sesión.",
            )
        return await _persist_new_user(user_input, bootstrap=True)

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Debe iniciar sesión como Administrador para registrar usuarios",
            headers={"WWW-Authenticate": "Bearer"},
        )

    current_user = decode_token(credentials.credentials)
    if current_user.role != "Administrador":
        raise HTTPException(
            status_code=403,
            detail="Solo un Administrador puede registrar nuevos usuarios",
        )

    return await _persist_new_user(user_input, bootstrap=False)

@router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    # Buscar usuario por cedula O username
    user = await db.users.find_one(
        {"$or": [
            {"username": credentials.username},
            {"cedula": credentials.username}
        ]},
        {"_id": 0}
    )

    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    # Detectar el nombre real del campo de contraseña
    stored_password = user.get("hashed_password") or user.get("password") or user.get("password_hash")

    if not stored_password:
        raise HTTPException(status_code=500, detail="Error interno: contraseña no encontrada")

    # Verificar contraseña
    if not verify_password(credentials.password, stored_password):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    # Verificar si está activo
    if not user.get('is_active', True):
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    # Crear token
    access_token = create_access_token(
        data={"sub": user.get("username") or user.get("cedula"),
              "role": user['role']}
    )

    # RETURN OBLIGATORIO
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "username": user.get("username"),
            "cedula": user.get("cedula"),
            "role": user["role"],
            "nombre": user.get("nombre_completo") or user.get("nombre") or user.get("username"),
            "nombre_completo": user.get("nombre_completo") or user.get("nombre") or user.get("username"),
            "especialidad": user.get("especialidad", ""),
            "doctor_id": user.get("doctor_id", ""),
            "email": user.get("email", "")
        }
    }

@router.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    user = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return UserResponse(**user)

# ========== USER MANAGEMENT ENDPOINTS (Admin only) ==========

@router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: TokenData = Depends(require_role("Administrador"))):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [UserResponse(**user) for user in users]

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: dict,
    current_user: TokenData = Depends(require_role("Administrador"))
):
    existing = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # If password is being updated, hash it
    if 'password' in user_update and user_update['password']:
        user_update['hashed_password'] = get_password_hash(user_update['password'])
        del user_update['password']

    # Remove empty values
    update_data = {k: v for k, v in user_update.items() if v is not None and v != ""}

    if update_data:
        await db.users.update_one({"id": user_id}, {"$set": update_data})

    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    return UserResponse(**updated)

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: TokenData = Depends(require_role("Administrador"))
):
    # Prevent deleting yourself
    current_user_data = await db.users.find_one({"username": current_user.username}, {"_id": 0})
    if current_user_data['id'] == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")

    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"message": "Usuario eliminado exitosamente"}


@router.post("/users/create-from-doctors")
async def create_users_from_doctors(
    current_user: TokenData = Depends(require_role("Administrador"))
):
    """
    Crear usuarios automáticamente para todos los doctores que no tengan usuario
    Username format: nombre.apellido (lowercase)
    Password: cambiar123 (to be changed on first login)
    """
    doctors = await db.doctors.find({}, {"_id": 0}).to_list(1000)
    created_users = []
    skipped_doctors = []

    for doctor in doctors:
        # Check if doctor already has a user
        existing_user = await db.users.find_one({"doctor_id": doctor['id']}, {"_id": 0})
        if existing_user:
            skipped_doctors.append(f"{doctor['nombre']} (ya tiene usuario: {existing_user['username']})")
            continue

        # Generate username from doctor name
        # Format: primer_nombre.primer_apellido
        name_parts = doctor['nombre'].strip().split()
        if len(name_parts) >= 2:
            username = f"{name_parts[0]}.{name_parts[1]}".lower()
        else:
            username = name_parts[0].lower()

        # Check if username already exists
        username_check = await db.users.find_one({"username": username}, {"_id": 0})
        if username_check:
            # Add number suffix
            counter = 1
            while True:
                test_username = f"{username}{counter}"
                username_check = await db.users.find_one({"username": test_username}, {"_id": 0})
                if not username_check:
                    username = test_username
                    break
                counter += 1

        # Create user
        user_dict = {
            "username": username,
            "email": f"{username}@familyhealth.com",
            "nombre_completo": doctor['nombre'],
            "role": "Doctor",
            "doctor_id": doctor['id'],
            "especialidad": doctor.get('especialidad', 'General'),  # Copiar especialidad del doctor
            "hashed_password": get_password_hash("cambiar123"),
            "is_active": True
        }

        user_obj = User(**user_dict)
        doc = user_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()

        await db.users.insert_one(doc)
        created_users.append({
            "doctor": doctor['nombre'],
            "username": username,
            "password": "cambiar123",
            "doctor_id": doctor['id'],
            "especialidad": doctor.get('especialidad', 'General')
        })

    return {
        "created": created_users,
        "skipped": skipped_doctors,
        "message": f"Se crearon {len(created_users)} usuarios. {len(skipped_doctors)} doctores ya tenían usuario."
    }
