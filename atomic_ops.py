"""
Operaciones atómicas en MongoDB para inventario, pagos y secuencias de factura.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException
from pymongo import ReturnDocument

from db import db

UPDATED_AT = lambda: datetime.now(timezone.utc).isoformat()


# ---------- Inventario ----------


async def apply_inventory_movement(item_id: str, cantidad: float, tipo: str) -> Dict[str, Any]:
    """
    Ajusta stock con $inc. Las salidas exigen cantidad >= movimiento (sin stock negativo).
    """
    if cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0")

    if tipo == "entrada":
        updated = await db.inventory.find_one_and_update(
            {"id": item_id},
            {"$inc": {"cantidad": cantidad}},
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Item no encontrado")
        return updated

    if tipo == "salida":
        updated = await db.inventory.find_one_and_update(
            {"id": item_id, "cantidad": {"$gte": cantidad}},
            {"$inc": {"cantidad": -cantidad}},
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        if updated:
            return updated
        existing = await db.inventory.find_one({"id": item_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Item no encontrado")
        raise HTTPException(status_code=400, detail="Cantidad insuficiente en inventario")

    raise HTTPException(status_code=400, detail="Tipo inválido")


# ---------- Secuencia de facturas ----------


async def sync_invoice_sequences() -> None:
    """Alinea contadores con el máximo número de factura existente por establecimiento-punto."""
    invoices = await db.invoices.find(
        {"numero_factura": {"$regex": r"^\d{3}-\d{3}-\d+$"}},
        {"numero_factura": 1, "_id": 0},
    ).to_list(10000)

    max_by_key: Dict[str, int] = {}
    for inv in invoices:
        parts = inv.get("numero_factura", "").split("-")
        if len(parts) != 3:
            continue
        key = f"{parts[0]}-{parts[1]}"
        try:
            seq = int(parts[2])
        except ValueError:
            continue
        max_by_key[key] = max(max_by_key.get(key, 0), seq)

    for key, max_seq in max_by_key.items():
        await db.factura_secuencias.update_one(
            {"_id": key},
            {"$max": {"seq": max_seq}},
            upsert=True,
        )


async def siguiente_numero_factura(
    establecimiento: str = "001",
    punto_emision: str = "001",
) -> str:
    """Contador secuencial atómico por establecimiento y punto de emisión."""
    key = f"{establecimiento}-{punto_emision}"
    doc = await db.factura_secuencias.find_one_and_update(
        {"_id": key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    seq = int(doc.get("seq", 1))
    return f"{establecimiento}-{punto_emision}-{str(seq).zfill(9)}"


# ---------- Servicios de consultas financieras ----------


async def agregar_servicio_consulta(
    consulta_id: str,
    servicio_doc: dict,
    subtotal: float,
) -> Optional[dict]:
    """
    Añade un servicio con $push y actualiza total con $inc lógico en pipeline.
    Recalcula saldo/estado_pago respecto a descuentos y pagos existentes.
    """
    subtotal = round(float(subtotal), 2)
    now = UPDATED_AT()

    pipeline: list = [
        {
            "$set": {
                "servicios": {
                    "$concatArrays": [
                        {"$ifNull": ["$servicios", []]},
                        [servicio_doc],
                    ]
                },
                "total": {
                    "$round": [
                        {"$add": [{"$ifNull": ["$total", 0]}, subtotal]},
                        2,
                    ]
                },
                "updated_at": now,
            }
        },
        *_pipeline_recalc_saldo_estado(),
    ]

    updated = await db.consultas_financieras.find_one_and_update(
        {"id": consulta_id},
        pipeline,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    return updated


# ---------- Pagos de consultas financieras ----------


def _pipeline_recalc_saldo_estado() -> list:
    """Etapas comunes: total efectivo, saldo y estado_pago tras cambiar pagos/descuento."""
    return [
        {
            "$set": {
                "total_efectivo": {
                    "$max": [
                        0,
                        {
                            "$subtract": [
                                {"$ifNull": ["$total", 0]},
                                {"$ifNull": ["$descuento_aplicado", 0]},
                            ]
                        },
                    ]
                }
            }
        },
        {
            "$set": {
                "total_con_descuento": "$total_efectivo",
                "saldo": {
                    "$round": [
                        {
                            "$max": [
                                0,
                                {
                                    "$subtract": [
                                        "$total_efectivo",
                                        {"$ifNull": ["$total_pagado", 0]},
                                    ]
                                },
                            ]
                        },
                        2,
                    ]
                },
            }
        },
        {
            "$set": {
                "estado_pago": {
                    "$cond": [
                        {
                            "$lte": [
                                {
                                    "$max": [
                                        0,
                                        {
                                            "$subtract": [
                                                "$total_efectivo",
                                                {"$ifNull": ["$total_pagado", 0]},
                                            ]
                                        },
                                    ]
                                },
                                0.01,
                            ]
                        },
                        "pagado",
                        {
                            "$cond": [
                                {"$gt": [{"$ifNull": ["$total_pagado", 0]}, 0]},
                                "parcial",
                                "pendiente",
                            ]
                        },
                    ]
                }
            }
        },
        {
            "$set": {
                "saldo": {
                    "$cond": [
                        {"$lte": ["$saldo", 0.01]},
                        0,
                        "$saldo",
                    ]
                }
            }
        },
    ]


async def registrar_pago_consulta(
    consulta_id: str,
    pago_doc: dict,
    monto: float,
    descuento_aplicado: float = 0,
) -> Optional[dict]:
    """$push del pago + $inc de total_pagado/descuento y recálculo atómico de saldo."""
    desc_inc = float(descuento_aplicado or 0)
    now = UPDATED_AT()

    pipeline: list = [
        {
            "$set": {
                "pagos": {"$concatArrays": [{"$ifNull": ["$pagos", []]}, [pago_doc]]},
                "descuento_aplicado": {
                    "$add": [{"$ifNull": ["$descuento_aplicado", 0]}, desc_inc]
                },
                "total_pagado": {
                    "$round": [
                        {"$add": [{"$ifNull": ["$total_pagado", 0]}, float(monto)]},
                        2,
                    ]
                },
                "updated_at": now,
            }
        },
        *_pipeline_recalc_saldo_estado(),
    ]

    updated = await db.consultas_financieras.find_one_and_update(
        {"id": consulta_id},
        pipeline,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    return updated


async def eliminar_pago_consulta(consulta_id: str, pago_id: str) -> Optional[dict]:
    """Elimina un pago del array y recalcula totales de forma atómica."""
    consulta = await db.consultas_financieras.find_one(
        {"id": consulta_id, "pagos.id": pago_id},
        {"_id": 0, "pagos.$": 1},
    )
    if not consulta:
        consulta_exists = await db.consultas_financieras.find_one({"id": consulta_id}, {"_id": 1})
        if not consulta_exists:
            raise HTTPException(status_code=404, detail="Consulta no encontrada")
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    pagos = consulta.get("pagos") or []
    pago = next((p for p in pagos if p.get("id") == pago_id), None)
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    monto = float(pago.get("monto", 0))
    desc_pago = float(pago.get("descuento_aplicado", 0) or 0)
    now = UPDATED_AT()

    pipeline: list = [
        {
            "$set": {
                "pagos": {
                    "$filter": {
                        "input": {"$ifNull": ["$pagos", []]},
                        "cond": {"$ne": ["$$this.id", pago_id]},
                    }
                },
                "total_pagado": {
                    "$round": [
                        {
                            "$max": [
                                0,
                                {
                                    "$subtract": [
                                        {"$ifNull": ["$total_pagado", 0]},
                                        monto,
                                    ]
                                },
                            ]
                        },
                        2,
                    ]
                },
                "descuento_aplicado": {
                    "$max": [
                        0,
                        {
                            "$subtract": [
                                {"$ifNull": ["$descuento_aplicado", 0]},
                                desc_pago,
                            ]
                        },
                    ]
                },
                "updated_at": now,
            }
        },
        *_pipeline_recalc_saldo_estado(),
    ]

    updated = await db.consultas_financieras.find_one_and_update(
        {"id": consulta_id, "pagos.id": pago_id},
        pipeline,
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    return updated
