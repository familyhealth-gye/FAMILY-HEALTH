from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime

from db import db
from models import (
    InventoryItem, InventoryItemCreate, InventoryItemUpdate,
    InventoryMovement, InventoryMovementCreate,
)
from auth import get_current_user, TokenData
from atomic_ops import apply_inventory_movement

router = APIRouter(prefix="/inventory", tags=["inventory"])


# ── INVENTORY CRUD ─────────────────────────────────────────────

@router.post("", response_model=InventoryItem)
async def create_inventory_item(input: InventoryItemCreate):
    item_obj = InventoryItem(**input.model_dump())
    doc = item_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.inventory.insert_one(doc)
    return item_obj


@router.get("", response_model=List[InventoryItem])
async def get_inventory():
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item['created_at'], str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
    return items


@router.get("/alerts")
async def get_inventory_alerts():
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    alerts = []
    for item in items:
        if item['cantidad'] <= item['stock_minimo']:
            alerts.append({
                "id": item['id'],
                "nombre": item['nombre'],
                "cantidad": item['cantidad'],
                "stock_minimo": item['stock_minimo'],
            })
    return {"alerts": alerts}


@router.put("/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, input: InventoryItemUpdate):
    existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.inventory.update_one({"id": item_id}, {"$set": update_data})
    updated = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return InventoryItem(**updated)


@router.delete("/{item_id}")
async def delete_inventory_item(item_id: str):
    result = await db.inventory.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    return {"message": "Item eliminado exitosamente"}


# ── INVENTORY MOVEMENTS (OPERACIÓN ATÓMICA) ───────────────────

@router.post("/movements", response_model=InventoryMovement)
async def create_inventory_movement(
    input: InventoryMovementCreate,
    current_user: TokenData = Depends(get_current_user),
):
    item_before = await db.inventory.find_one({"id": input.item_id}, {"_id": 0, "nombre": 1})
    if not item_before:
        raise HTTPException(status_code=404, detail="Item no encontrado")

    await apply_inventory_movement(input.item_id, input.cantidad, input.tipo)

    movement_dict = input.model_dump()
    movement_dict["item_nombre"] = item_before["nombre"]
    movement_obj = InventoryMovement(**movement_dict)

    doc = movement_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()

    await db.inventory_movements.insert_one(doc)
    return movement_obj


@router.get("/movements", response_model=List[InventoryMovement])
async def get_inventory_movements():
    movements = await db.inventory_movements.find({}, {"_id": 0}).to_list(1000)
    for movement in movements:
        if isinstance(movement['created_at'], str):
            movement['created_at'] = datetime.fromisoformat(movement['created_at'])
    return movements