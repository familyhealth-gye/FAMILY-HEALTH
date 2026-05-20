from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from db import db
from models import (
    Doctor, DoctorCreate, DoctorUpdate,
    DoctorPayment, DoctorPaymentCreate, DoctorPaymentUpdate,
)
from auth import get_current_user, TokenData

router = APIRouter(prefix="/doctors", tags=["doctors"])
payments_router = APIRouter(prefix="/doctor-payments", tags=["doctor-payments"])


# ── DOCTORS CRUD ──────────────────────────────────────────────

@router.post("", response_model=Doctor)
async def create_doctor(
    input: DoctorCreate,
    current_user: TokenData = Depends(get_current_user),
):
    doctor_obj = Doctor(**input.model_dump())
    doc = doctor_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.doctors.insert_one(doc)
    return doctor_obj


@router.get("", response_model=List[Doctor])
async def get_doctors(current_user: TokenData = Depends(get_current_user)):
    doctors = await db.doctors.find({}, {"_id": 0}).to_list(1000)
    for doctor in doctors:
        if isinstance(doctor['created_at'], str):
            doctor['created_at'] = datetime.fromisoformat(doctor['created_at'])
        if 'porcentaje' not in doctor:
            doctor['porcentaje'] = 50.0
    return doctors


@router.put("/{doctor_id}", response_model=Doctor)
async def update_doctor(
    doctor_id: str,
    input: DoctorUpdate,
    current_user: TokenData = Depends(get_current_user),
):
    existing = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.doctors.update_one({"id": doctor_id}, {"$set": update_data})
    updated = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Doctor(**updated)


@router.delete("/{doctor_id}")
async def delete_doctor(
    doctor_id: str,
    current_user: TokenData = Depends(get_current_user),
):
    result = await db.doctors.delete_one({"id": doctor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")
    return {"message": "Doctor eliminado exitosamente"}


# ── DOCTOR PAYMENTS CRUD (legacy) ─────────────────────────────

@payments_router.post("/calculate")
async def calculate_doctor_payments(input: DoctorPaymentCreate):
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")

    invoices = await db.invoices.find({"doctor_id": input.doctor_id}, {"_id": 0}).to_list(1000)
    total_facturado = 0
    for invoice in invoices:
        invoice_date = invoice['fecha'].split('-')
        if len(invoice_date) >= 2:
            invoice_year = int(invoice_date[0])
            invoice_month = int(invoice_date[1])
            if invoice_year == input.año and invoice_month == input.mes:
                total_facturado += invoice['valor']

    porcentaje = doctor.get('porcentaje', 50.0)
    total_pagar = (total_facturado * porcentaje) / 100

    existing_payment = await db.doctor_payments.find_one(
        {"doctor_id": input.doctor_id, "mes": input.mes, "año": input.año},
        {"_id": 0}
    )

    if existing_payment:
        await db.doctor_payments.update_one(
            {"id": existing_payment['id']},
            {"$set": {
                "total_facturado": total_facturado,
                "porcentaje": porcentaje,
                "total_pagar": total_pagar,
                "estado": input.estado,
            }}
        )
        existing_payment.update({
            "total_facturado": total_facturado,
            "porcentaje": porcentaje,
            "total_pagar": total_pagar,
            "estado": input.estado,
        })
        if isinstance(existing_payment['created_at'], str):
            existing_payment['created_at'] = datetime.fromisoformat(existing_payment['created_at'])
        return DoctorPayment(**existing_payment)
    else:
        payment_obj = DoctorPayment(
            doctor_id=input.doctor_id,
            doctor_nombre=doctor['nombre'],
            mes=input.mes,
            año=input.año,
            total_facturado=total_facturado,
            porcentaje=porcentaje,
            total_pagar=total_pagar,
            estado=input.estado,
        )
        doc = payment_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.doctor_payments.insert_one(doc)
        return payment_obj


@payments_router.get("", response_model=List[DoctorPayment])
async def get_doctor_payments():
    payments = await db.doctor_payments.find({}, {"_id": 0}).to_list(1000)
    for payment in payments:
        if isinstance(payment['created_at'], str):
            payment['created_at'] = datetime.fromisoformat(payment['created_at'])
    return payments


@payments_router.put("/{payment_id}", response_model=DoctorPayment)
async def update_doctor_payment(payment_id: str, input: DoctorPaymentUpdate):
    existing = await db.doctor_payments.find_one({"id": payment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if update_data:
        await db.doctor_payments.update_one({"id": payment_id}, {"$set": update_data})
    updated = await db.doctor_payments.find_one({"id": payment_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return DoctorPayment(**updated)


@payments_router.delete("/{payment_id}")
async def delete_doctor_payment(payment_id: str):
    result = await db.doctor_payments.delete_one({"id": payment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return {"message": "Pago eliminado exitosamente"}


# ── DOCTOR PAYMENTS NUEVOS (calcular / registrar / historial) ──

@payments_router.get("/calcular")
async def calcular_pago_doctor(
    doctor_id: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user),
):
    from datetime import date as date_type
    fi = fecha_inicio or date_type.today().replace(day=1).isoformat()
    ff = fecha_fin or date_type.today().isoformat()
    query = {"fecha": {"$gte": fi, "$lte": ff}}
    if doctor_id:
        query["doctor_id"] = doctor_id
    consultas = await db.consultas_financieras.find(query, {"_id": 0}).to_list(5000)
    doctores_db = {d["id"]: d for d in await db.doctors.find({}, {"_id": 0}).to_list(500)}
    resumen = {}
    for c in consultas:
        did = c.get("doctor_id", "")
        cobrado = c.get("total_pagado", 0)
        if cobrado <= 0:
            continue
        if did not in resumen:
            pct = doctores_db.get(did, {}).get("porcentaje", 50.0) if did else 50.0
            resumen[did] = {
                "doctor_id": did,
                "doctor_nombre": c.get("doctor_nombre", "Sin Doctor"),
                "especialidad": doctores_db.get(did, {}).get("especialidad", ""),
                "porcentaje": pct,
                "total_cobrado": 0,
                "ganancia_doctor": 0,
                "ganancia_clinica": 0,
                "num_consultas": 0,
                "consultas": [],
            }
        resumen[did]["total_cobrado"] += cobrado
        resumen[did]["num_consultas"] += 1
        resumen[did]["consultas"].append({
            "fecha": c.get("fecha", ""),
            "paciente": c.get("paciente_nombre", ""),
            "monto": cobrado,
        })
    for did in resumen:
        tc = resumen[did]["total_cobrado"]
        pct = resumen[did]["porcentaje"]
        resumen[did]["ganancia_doctor"] = round(tc * pct / 100, 2)
        resumen[did]["ganancia_clinica"] = round(tc * (100 - pct) / 100, 2)
        resumen[did]["total_cobrado"] = round(tc, 2)
    resultado = sorted(resumen.values(), key=lambda x: x["total_cobrado"], reverse=True)
    return {
        "fecha_inicio": fi,
        "fecha_fin": ff,
        "doctores": resultado,
        "total_cobrado": round(sum(r["total_cobrado"] for r in resultado), 2),
        "total_pagar_doctores": round(sum(r["ganancia_doctor"] for r in resultado), 2),
        "total_clinica": round(sum(r["ganancia_clinica"] for r in resultado), 2),
    }


@payments_router.post("/registrar")
async def registrar_pago_doctor(
    data: dict,
    current_user: TokenData = Depends(get_current_user),
):
    if current_user.role not in ("Administrador", "Recepcion"):
        raise HTTPException(status_code=403, detail="Sin permiso")
    monto = float(data.get("monto", 0))
    if monto <= 0:
        raise HTTPException(status_code=400, detail="Monto debe ser mayor a 0")
    pago = {
        "id": str(uuid.uuid4()),
        "doctor_id": data.get("doctor_id", ""),
        "doctor_nombre": data.get("doctor_nombre", ""),
        "monto": monto,
        "fecha_inicio_periodo": data.get("fecha_inicio", ""),
        "fecha_fin_periodo": data.get("fecha_fin", ""),
        "forma_pago": data.get("forma_pago", "efectivo"),
        "referencia": data.get("referencia", ""),
        "notas": data.get("notas", ""),
        "registrado_por": current_user.username,
        "fecha_pago": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.pagos_doctores.insert_one(pago)
    pago.pop("_id", None)
    egreso = {
        "id": str(uuid.uuid4()),
        "concepto": f"Pago Dr/Dra. {data.get('doctor_nombre', '')} — período {data.get('fecha_inicio', '')} al {data.get('fecha_fin', '')}",
        "monto": monto,
        "tipo": "nomina",
        "referencia": data.get("referencia", ""),
        "fecha": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "notas": data.get("notas", ""),
        "registrado_por": current_user.username,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.egresos_caja.insert_one(egreso)
    return {"ok": True, "pago": pago}


@payments_router.get("/historial")
async def historial_pagos_doctores(
    doctor_id: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user),
):
    query = {}
    if doctor_id:
        query["doctor_id"] = doctor_id
    pagos = await db.pagos_doctores.find(query, {"_id": 0}).sort("fecha_pago", -1).to_list(1000)
    return pagos