from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
import io
import csv
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pymongo.errors import DuplicateKeyError

from db import db
from auth import TokenData, get_current_user, require_role
from models import (
    Invoice, InvoiceCreate, InvoiceUpdate,
    Proforma, ProformaCreate, ProformaUpdate, ProformaItem,
    Abono, AbonoCreate, AbonoUpdate
)

router = APIRouter(tags=["billing", "caja"])

# ========== HELPERS FACTURACIÓN ==========

async def _siguiente_numero_factura(establecimiento="001", punto_emision="001"):
    from atomic_ops import siguiente_numero_factura
    return await siguiente_numero_factura(establecimiento, punto_emision)


def _calcular_totales_factura(detalles, iva_pct=0.0):
    subtotal = sum(float(d.get("precio_unitario",0))*float(d.get("cantidad",1)) for d in detalles)
    desc = sum(float(d.get("descuento",0)) for d in detalles)
    sub_desc = subtotal - desc
    iva_val = round(sub_desc * iva_pct / 100, 2)
    return {
        "subtotal": round(subtotal,2),
        "descuento_total": round(desc,2),
        "subtotal_con_descuento": round(sub_desc,2),
        "iva_porcentaje": iva_pct,
        "iva_valor": iva_val,
        "total": round(sub_desc + iva_val, 2)
    }

# ========== INVOICE ENDPOINTS ==========

@router.post("/invoices", response_model=Invoice)
async def create_invoice(
    input: InvoiceCreate,
    current_user: TokenData = Depends(get_current_user)
):
    """Crea factura con numeración automática. Doctor es opcional."""
    # Leer config clinica para numeración y datos emisor
    cfg_clinica = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    clinica = cfg_clinica.get("valor", {}) if cfg_clinica else {}

    # Auto-numerar si no viene numero_factura
    numero = input.numero_factura if input.numero_factura else await _siguiente_numero_factura(
        clinica.get("establecimiento", "001"),
        clinica.get("punto_emision", "001")
    )

    # Doctor es opcional
    doctor_nombre = input.doctor_nombre or ""
    if input.doctor_id and not doctor_nombre:
        doc_db = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
        if doc_db:
            doctor_nombre = doc_db.get("nombre", "")

    # Calcular totales desde detalles
    detalles_list = [d.model_dump() if hasattr(d, 'model_dump') else d for d in (input.detalles or [])]
    totales = _calcular_totales_factura(detalles_list, input.iva_porcentaje or 0.0)

    # Construir detalles con subtotal calculado
    detalles_final = []
    for d in (input.detalles or []):
        det = d.model_dump() if hasattr(d, 'model_dump') else dict(d)
        det["subtotal"] = round(
            float(det.get("precio_unitario", 0)) * float(det.get("cantidad", 1)) - float(det.get("descuento", 0)), 2
        )
        detalles_final.append(det)

    fecha = input.fecha or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    invoice = Invoice(
        numero_factura=numero,
        emisor_ruc=clinica.get("ruc", ""),
        emisor_razon_social=clinica.get("razon_social", "CENTRO DE ESPECIALIDADES FAMILY HEALTH"),
        emisor_nombre_comercial=clinica.get("nombre_comercial", "FAMILY HEALTH"),
        emisor_direccion=clinica.get("direccion", "Mucho Lote 2 MZ 2833 Villa 15, Guayaquil"),
        emisor_telefono=clinica.get("telefono", "096-291-2170"),
        emisor_email=clinica.get("email", "centrodeespecialidadesfamilyhe@gmail.com"),
        paciente_nombre=input.paciente_nombre,
        paciente_cedula=input.paciente_cedula,
        paciente_direccion=input.paciente_direccion or "",
        paciente_email=input.paciente_email or "",
        paciente_telefono=input.paciente_telefono or "",
        doctor_id=input.doctor_id or "",
        doctor_nombre=doctor_nombre,
        especialidad=input.especialidad or "",
        detalles=detalles_final,
        tipo_pago=input.tipo_pago or "efectivo",
        referencia_pago=input.referencia_pago or "",
        consulta_financiera_id=input.consulta_financiera_id or "",
        appointment_id=input.appointment_id or "",
        numero_autorizacion=input.numero_autorizacion or "",
        observaciones=input.observaciones or "",
        fecha=fecha,
        estado="emitida",
        created_by=current_user.username,
        **totales,
    )

    doc = invoice.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["detalles"] = detalles_final
    try:
        await db.invoices.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=400,
            detail=f"El número de factura {numero} ya existe",
        )
    return invoice

@router.get("/invoices", response_model=List[Invoice])
async def get_invoices(current_user: TokenData = Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    for invoice in invoices:
        if isinstance(invoice['created_at'], str):
            invoice['created_at'] = datetime.fromisoformat(invoice['created_at'])
    return invoices

@router.get("/invoices/monthly-totals")
async def get_monthly_totals(current_user: TokenData = Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    monthly_totals = defaultdict(float)
    for invoice in invoices:
        year_month = invoice['fecha'][:7]
        monthly_totals[year_month] += invoice['valor']
    return {"monthly_totals": dict(monthly_totals)}

@router.get("/invoices/export")
async def export_invoices(current_user: TokenData = Depends(get_current_user)):
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Número Factura', 'Paciente', 'Cédula', 'Doctor', 'Especialidad', 'Servicio', 'Valor', 'Fecha', 'Tipo Pago'])
    for invoice in invoices:
        writer.writerow([invoice['numero_factura'], invoice['paciente_nombre'], invoice['paciente_cedula'],
                        invoice['doctor_nombre'], invoice['especialidad'], invoice.get('servicio', 'N/A'),
                        invoice.get('valor', invoice.get('total', 0)), invoice['fecha'], invoice['tipo_pago']])
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                           headers={"Content-Disposition": "attachment; filename=facturas_family_health.csv"})

@router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(
    invoice_id: str,
    input: InvoiceUpdate,
    current_user: TokenData = Depends(get_current_user),
):
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    update_data = {k: v for k, v in input.model_dump().items() if v is not None}
    if 'doctor_id' in update_data and update_data['doctor_id']:
        doctor = await db.doctors.find_one({"id": update_data['doctor_id']}, {"_id": 0})
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor no encontrado")
        update_data['doctor_nombre'] = doctor['nombre']
    if update_data:
        await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Invoice(**updated)

@router.delete("/invoices/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    current_user: TokenData = Depends(get_current_user),
):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return {"message": "Factura eliminada exitosamente"}

@router.get("/invoices/stats")
async def get_invoice_stats(current_user: TokenData = Depends(get_current_user)):
    from datetime import date
    hoy = date.today().isoformat()
    mes = hoy[:7]
    all_inv = await db.invoices.find({"estado": {"$ne": "anulada"}}, {"_id": 0}).to_list(5000)
    return {
        "total_hoy": round(sum(i.get("total",0) for i in all_inv if i.get("fecha","") == hoy), 2),
        "total_mes": round(sum(i.get("total",0) for i in all_inv if i.get("fecha","")[:7] == mes), 2),
        "total_general": round(sum(i.get("total",0) for i in all_inv), 2),
        "num_facturas_hoy": sum(1 for i in all_inv if i.get("fecha","") == hoy),
        "num_facturas_mes": sum(1 for i in all_inv if i.get("fecha","")[:7] == mes),
        "num_facturas_total": len(all_inv)
    }


@router.post("/invoices/{invoice_id}/anular")
async def anular_invoice(invoice_id: str, data: dict, current_user: TokenData = Depends(get_current_user)):
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if existing.get("estado") == "anulada":
        raise HTTPException(status_code=400, detail="La factura ya está anulada")
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {
            "estado": "anulada",
            "observaciones": data.get("motivo","Anulada") + " | " + existing.get("observaciones",""),
            "anulada_por": current_user.username,
            "fecha_anulacion": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }}
    )
    return {"ok": True, "mensaje": "Factura anulada correctamente"}


@router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str, current_user: TokenData = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    # Inyectar datos de la clínica y ambiente real
    cfg_clinica = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    clinica = cfg_clinica.get("valor", {}) if cfg_clinica else {}

    cfg_firma = await db.configuracion.find_one({"clave": "firma_electronica"}, {"_id": 0})
    ambiente_real = (cfg_firma.get("valor", {}) if cfg_firma else {}).get("ambiente", "produccion")

    inv_completo = {
        **clinica,       # razon_social, ruc, direccion, etc.
        **inv,           # datos de la factura (sobreescribe si hay conflicto)
        "emisor_razon_social":     clinica.get("razon_social", inv.get("emisor_razon_social", "FAMILY HEALTH")),
        "emisor_nombre_comercial": clinica.get("nombre_comercial", "FAMILY HEALTH"),
        "emisor_ruc":              clinica.get("ruc", inv.get("emisor_ruc", "")),
        "emisor_direccion":        clinica.get("direccion", inv.get("emisor_direccion", "")),
        # Ambiente real de la configuración (no el de la factura que puede estar desactualizado)
        "sri_ambiente": inv.get("sri_ambiente") or ambiente_real,
    }

    from pdf_generator import generate_factura_pdf
    pdf_buffer = generate_factura_pdf(inv_completo)
    filename = f"factura_{inv.get('numero_factura','').replace('-','_')}.pdf"
    return StreamingResponse(pdf_buffer, media_type="application/pdf",
                             headers={"Content-Disposition": f"inline; filename={filename}"})


# ========== PROFORMA ENDPOINTS ==========

@router.post("/proformas", response_model=Proforma)
async def create_proforma(
    input: ProformaCreate,
    current_user: TokenData = Depends(get_current_user)
):
    # Get doctor info
    doctor = await db.doctors.find_one({"id": input.doctor_id}, {"_id": 0})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor no encontrado")

    # Calculate totals
    subtotal = sum(item.subtotal for item in input.items)
    total = subtotal - input.descuento

    proforma_dict = input.model_dump()
    proforma_dict['doctor_nombre'] = doctor['nombre']
    proforma_dict['subtotal'] = subtotal
    proforma_dict['total'] = total

    proforma_obj = Proforma(**proforma_dict)
    doc = proforma_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.proformas.insert_one(doc)
    return proforma_obj

@router.get("/proformas", response_model=List[Proforma])
async def get_proformas(current_user: TokenData = Depends(get_current_user)):
    proformas = await db.proformas.find({}, {"_id": 0}).to_list(1000)
    for proforma in proformas:
        if isinstance(proforma['created_at'], str):
            proforma['created_at'] = datetime.fromisoformat(proforma['created_at'])
    return proformas

@router.get("/proformas/{proforma_id}", response_model=Proforma)
async def get_proforma(
    proforma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    proforma = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")

    if isinstance(proforma['created_at'], str):
        proforma['created_at'] = datetime.fromisoformat(proforma['created_at'])

    return Proforma(**proforma)

@router.put("/proformas/{proforma_id}", response_model=Proforma)
async def update_proforma(
    proforma_id: str,
    input: ProformaUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")

    update_data = {k: v for k, v in input.model_dump().items() if v is not None}

    if update_data:
        await db.proformas.update_one({"id": proforma_id}, {"$set": update_data})

    updated = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])

    return Proforma(**updated)

@router.delete("/proformas/{proforma_id}")
async def delete_proforma(
    proforma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    result = await db.proformas.delete_one({"id": proforma_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")
    return {"message": "Proforma eliminada exitosamente"}


@router.post("/proformas/desde-plan-tratamiento")
async def crear_proforma_desde_plan(
    input: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Crear una proforma a partir de procedimientos seleccionados del plan de tratamiento.
    """
    plan_id = input.get('plan_id')
    procedimiento_ids = input.get('procedimiento_ids', [])

    # Obtener el plan de tratamiento
    plan = await db.planes_tratamiento.find_one({"id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan de tratamiento no encontrado")

    procedimientos = plan.get('procedimientos', [])

    # Filtrar procedimientos si se especificaron IDs
    if procedimiento_ids and len(procedimiento_ids) > 0:
        procedimientos = [p for p in procedimientos if p.get('id') in procedimiento_ids]

    if not procedimientos:
        raise HTTPException(status_code=400, detail="No hay procedimientos para incluir en la proforma")

    # Obtener datos del doctor
    doctor_id = input.get('doctor_id', plan.get('doctor_id', ''))
    doctor_nombre = ""
    especialidad = input.get('especialidad', 'Odontología')

    if doctor_id:
        doctor = await db.doctors.find_one({"id": doctor_id}, {"_id": 0})
        if doctor:
            doctor_nombre = doctor.get('nombre', '')
            especialidad = doctor.get('especialidad', especialidad)

    # Generar número de proforma
    count = await db.proformas.count_documents({})
    numero_proforma = f"PRO-{count + 1:06d}"

    # Crear items de la proforma desde los procedimientos
    items = []
    for proc in procedimientos:
        diente = proc.get('diente_numero', '')
        nombre_proc = proc.get('procedimiento', '')
        precio = proc.get('precio', 0)

        descripcion = nombre_proc
        if diente:
            descripcion = f"{nombre_proc} - Diente {diente}"

        items.append(ProformaItem(
            descripcion=descripcion,
            cantidad=1,
            precio_unitario=precio,
            subtotal=precio
        ))

    # Calcular totales
    subtotal = sum(item.subtotal for item in items)
    descuento = input.get('descuento', 0)
    total = subtotal - descuento

    # Crear la proforma
    proforma = Proforma(
        numero_proforma=numero_proforma,
        paciente_nombre=input.get('paciente_nombre', plan.get('paciente_nombre', '')),
        paciente_cedula=input.get('paciente_cedula', plan.get('paciente_cedula', '')),
        paciente_telefono=input.get('paciente_telefono', ''),
        doctor_id=doctor_id,
        doctor_nombre=doctor_nombre,
        especialidad=especialidad,
        items=items,
        subtotal=subtotal,
        descuento=descuento,
        total=total,
        fecha_emision=datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        validez_dias=input.get('validez_dias', 30),
        observaciones=input.get('observaciones', f"Generada desde Plan de Tratamiento - {plan_id}")
    )

    doc = proforma.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.proformas.insert_one(doc)

    return {
        "message": "Proforma creada exitosamente",
        "proforma_id": proforma.id,
        "numero_proforma": numero_proforma,
        "total": total,
        "items_count": len(items)
    }


@router.get("/proformas/{proforma_id}/pdf")
async def get_proforma_pdf(
    proforma_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    from fastapi.responses import Response
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from io import BytesIO

    proforma = await db.proformas.find_one({"id": proforma_id}, {"_id": 0})
    if not proforma:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")

    cfg = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    clinica = cfg.get("valor", {}) if cfg else {}

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # ── Header con branding ────────────────────────────────────────
    y = _clinica_header(c, clinica)

    # ── Título + número ────────────────────────────────────────────
    c.setFillColorRGB(0.047, 0.290, 0.431)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, y - 15, "PROFORMA")
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - 40, y - 15, f"N° {proforma.get('numero_proforma', '')}")
    c.setFillColorRGB(0, 0, 0)

    # Línea bajo título
    c.setStrokeColorRGB(0.047, 0.290, 0.431)
    c.setLineWidth(1)
    c.line(40, y - 22, width - 40, y - 22)
    y -= 35

    # ── Bloque info emisión + cliente lado a lado ──────────────────
    # Izquierda: datos emisión
    c.setFont("Helvetica-Bold", 9)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawString(40, y, "FECHA DE EMISIÓN")
    c.drawString(40, y - 13, "VÁLIDA POR")
    c.drawString(40, y - 26, "ESTADO")
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(160, y,      proforma.get("fecha_emision", ""))
    c.drawString(160, y - 13, f"{proforma.get('validez_dias', 30)} días")
    estado_prf = proforma.get("estado", "Pendiente")
    color_estado = (0.1, 0.6, 0.1) if estado_prf == "Aprobada" else (0.6, 0.3, 0)
    c.setFillColorRGB(*color_estado)
    c.drawString(160, y - 26, estado_prf)
    c.setFillColorRGB(0, 0, 0)

    # Derecha: datos cliente
    cx = width / 2 + 20
    c.setFont("Helvetica-Bold", 9)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawString(cx, y, "PACIENTE")
    c.drawString(cx, y - 13, "CI / PASAPORTE")
    c.drawString(cx, y - 26, "TELÉFONO")
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(cx + 100, y,      proforma.get("paciente_nombre", ""))
    c.drawString(cx + 100, y - 13, proforma.get("paciente_cedula", ""))
    c.drawString(cx + 100, y - 26, proforma.get("paciente_telefono", ""))

    y -= 48

    # ── Tabla de ítems ─────────────────────────────────────────────
    # Encabezado tabla
    c.setFillColorRGB(0.047, 0.290, 0.431)
    c.rect(40, y - 2, width - 80, 18, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(48,        y + 4, "DESCRIPCIÓN")
    c.drawString(370,       y + 4, "CANT.")
    c.drawString(420,       y + 4, "P. UNIT.")
    c.drawRightString(width - 45, y + 4, "SUBTOTAL")
    c.setFillColorRGB(0, 0, 0)
    y -= 20

    # Filas alternadas
    c.setFont("Helvetica", 9)
    for i, item in enumerate(proforma.get("items", [])):
        if i % 2 == 0:
            c.setFillColorRGB(0.96, 0.97, 1.0)
            c.rect(40, y - 3, width - 80, 16, fill=1, stroke=0)
        c.setFillColorRGB(0, 0, 0)
        desc = item.get("descripcion", "")[:52]
        c.drawString(48,  y + 4, desc)
        c.drawString(380, y + 4, str(item.get("cantidad", 1)))
        c.drawString(420, y + 4, f"${item.get('precio_unitario', 0):.2f}")
        c.drawRightString(width - 45, y + 4, f"${item.get('subtotal', 0):.2f}")
        y -= 16
        if y < 160:   # Nueva página si no cabe
            c.showPage()
            y = height - 60

    # Línea cierre tabla
    c.setStrokeColorRGB(0.047, 0.290, 0.431)
    c.setLineWidth(0.5)
    c.line(40, y, width - 40, y)
    y -= 20

    # ── Totales ────────────────────────────────────────────────────
    col_lbl = width - 180
    col_val = width - 40

    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawRightString(col_lbl, y, "Subtotal:")
    c.setFillColorRGB(0, 0, 0)
    c.drawRightString(col_val, y, f"${proforma.get('subtotal', 0):.2f}")
    y -= 16

    if proforma.get("descuento", 0) > 0:
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.drawRightString(col_lbl, y, "Descuento:")
        c.setFillColorRGB(0.7, 0.1, 0.1)
        c.drawRightString(col_val, y, f"-${proforma.get('descuento', 0):.2f}")
        c.setFillColorRGB(0, 0, 0)
        y -= 16

    # Total destacado
    c.setFillColorRGB(0.047, 0.290, 0.431)
    c.rect(col_lbl - 10, y - 4, col_val - col_lbl + 50, 20, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(col_lbl - 2, y + 2, "TOTAL:")
    c.drawRightString(col_val, y + 2, f"${proforma.get('total', 0):.2f}")
    c.setFillColorRGB(0, 0, 0)
    y -= 35

    # ── Observaciones ──────────────────────────────────────────────
    if proforma.get("observaciones"):
        c.setFont("Helvetica-Bold", 9)
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.drawString(40, y, "OBSERVACIONES:")
        c.setFont("Helvetica", 9)
        c.setFillColorRGB(0, 0, 0)
        y -= 14
        c.drawString(40, y, proforma["observaciones"][:95])
        y -= 30

    # ── Pie de página ──────────────────────────────────────────────
    c.setLineWidth(0.5)
    c.setStrokeColorRGB(0.8, 0.8, 0.8)
    c.line(40, 50, width - 40, 50)
    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(width / 2, 38,
        f"{clinica.get('razon_social', 'FAMILY HEALTH')}   |   "
        f"RUC: {clinica.get('ruc', '')}   |   "
        f"{clinica.get('telefono', '')}   |   Documento no válido como factura")

    c.save()
    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="application/pdf")

# ========== ABONO ENDPOINTS ==========

@router.post("/abonos", response_model=Abono)
async def create_abono(
    input: AbonoCreate,
    current_user: TokenData = Depends(get_current_user)
):
    abono_obj = Abono(**input.model_dump())
    doc = abono_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.abonos.insert_one(doc)
    return abono_obj

@router.get("/abonos", response_model=List[Abono])
async def get_abonos(current_user: TokenData = Depends(get_current_user)):
    abonos = await db.abonos.find({}, {"_id": 0}).to_list(1000)
    for abono in abonos:
        if isinstance(abono['created_at'], str):
            abono['created_at'] = datetime.fromisoformat(abono['created_at'])
    return abonos

@router.get("/abonos/patient/{cedula}", response_model=List[Abono])
async def get_patient_abonos(
    cedula: str,
    current_user: TokenData = Depends(get_current_user)
):
    abonos = await db.abonos.find({"paciente_cedula": cedula}, {"_id": 0}).to_list(1000)
    for abono in abonos:
        if isinstance(abono['created_at'], str):
            abono['created_at'] = datetime.fromisoformat(abono['created_at'])
    return abonos

@router.put("/abonos/{abono_id}", response_model=Abono)
async def update_abono(
    abono_id: str,
    input: AbonoUpdate,
    current_user: TokenData = Depends(get_current_user)
):
    existing = await db.abonos.find_one({"id": abono_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Abono no encontrado")

    update_data = {k: v for k, v in input.model_dump().items() if v is not None}

    if update_data:
        await db.abonos.update_one({"id": abono_id}, {"$set": update_data})

    updated = await db.abonos.find_one({"id": abono_id}, {"_id": 0})
    if isinstance(updated['created_at'], str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])

    return Abono(**updated)

@router.delete("/abonos/{abono_id}")
async def delete_abono(
    abono_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    result = await db.abonos.delete_one({"id": abono_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Abono no encontrado")
    return {"message": "Abono eliminado exitosamente"}


# ========== EGRESOS DE CAJA ==========

@router.post("/caja/egresos")
async def registrar_egreso(data: dict, current_user: TokenData = Depends(get_current_user)):
    egreso = {
        "id": str(uuid.uuid4()),
        "concepto": data.get("concepto",""),
        "monto": float(data.get("monto",0)),
        "tipo": data.get("tipo","otro"),
        "referencia": data.get("referencia",""),
        "fecha": data.get("fecha", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "notas": data.get("notas",""),
        "registrado_por": current_user.username,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if egreso["monto"] <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
    await db.egresos_caja.insert_one(egreso)
    egreso.pop("_id", None)
    return egreso


@router.get("/caja/egresos")
async def get_egresos(
    fecha: Optional[str] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    query = {}
    if fecha: query["fecha"] = fecha
    elif fecha_inicio and fecha_fin: query["fecha"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    egresos = await db.egresos_caja.find(query, {"_id": 0}).sort("fecha", -1).to_list(1000)
    return {"egresos": egresos, "total": round(sum(e.get("monto",0) for e in egresos), 2)}


@router.delete("/caja/egresos/{egreso_id}")
async def delete_egreso(egreso_id: str, current_user: TokenData = Depends(get_current_user)):
    if current_user.role != "Administrador":
        raise HTTPException(status_code=403, detail="Solo Administrador puede eliminar egresos")
    result = await db.egresos_caja.delete_one({"id": egreso_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Egreso no encontrado")
    return {"ok": True}


# ========== PROCEDIMIENTOS RAPIDOS ==========

@router.post("/procedimientos-rapidos")
async def crear_procedimiento_rapido(data: dict, current_user: TokenData = Depends(get_current_user)):
    proc = {
        "id": str(uuid.uuid4()),
        "paciente_cedula": data.get("paciente_cedula", ""),
        "paciente_nombre": data.get("paciente_nombre", ""),
        "paciente_telefono": data.get("paciente_telefono", ""),
        "procedimientos": data.get("procedimientos", []),
        "aplicado_por": data.get("aplicado_por", ""),
        "prescripcion_externa": data.get("prescripcion_externa", ""),
        "consentimiento_verbal": data.get("consentimiento_verbal", True),
        "observaciones": data.get("observaciones", ""),
        "tipo_pago": data.get("tipo_pago", "efectivo"),
        "total": float(data.get("total", 0)),
        "fecha": data.get("fecha", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "hora": data.get("hora", datetime.now(timezone.utc).strftime("%H:%M")),
        "usuario": current_user.username,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if not proc["paciente_nombre"]:
        raise HTTPException(status_code=400, detail="Nombre del paciente es obligatorio")
    if not proc["procedimientos"]:
        raise HTTPException(status_code=400, detail="Agrega al menos un procedimiento")
    await db.procedimientos_rapidos.insert_one(proc)
    proc.pop("_id", None)
    # Registrar como ingreso en caja
    await db.consultas_financieras.insert_one({
        "id": str(uuid.uuid4()), "tipo": "procedimiento_rapido",
        "paciente_cedula": proc["paciente_cedula"], "paciente_nombre": proc["paciente_nombre"],
        "doctor_nombre": proc["aplicado_por"], "doctor_id": "",
        "especialidad": "Procedimiento Rapido", "servicios": proc["procedimientos"],
        "total": proc["total"], "total_pagado": proc["total"], "saldo": 0,
        "estado_pago": "pagado", "tipo_pago": proc["tipo_pago"], "fecha": proc["fecha"],
        "pagos": [{"monto": proc["total"], "tipo_pago": proc["tipo_pago"],
                   "fecha": proc["fecha"], "recibido_por": current_user.username}],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return proc


@router.get("/procedimientos-rapidos")
async def get_procedimientos_rapidos(
    paciente_cedula: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    query = {}
    if paciente_cedula: query["paciente_cedula"] = paciente_cedula
    procs = await db.procedimientos_rapidos.find(query, {"_id": 0}).sort("fecha", -1).to_list(500)
    return procs


# ========== LABORATORIO EXTERNO ==========

@router.post("/laboratorio/envio")
async def registrar_envio_laboratorio(data: dict, current_user: TokenData = Depends(get_current_user)):
    envio = {
        "id": str(uuid.uuid4()),
        "paciente_cedula": data.get("paciente_cedula", ""),
        "paciente_nombre": data.get("paciente_nombre", ""),
        "appointment_id": data.get("appointment_id", ""),
        "examenes": data.get("examenes", ""),
        "fecha_envio": data.get("fecha_envio", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "fecha_resultado_estimada": data.get("fecha_resultado_estimada", ""),
        "enviado_por": current_user.username,
        "notas": data.get("notas", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.laboratorio_envios.insert_one(envio)
    envio.pop("_id", None)
    return envio


@router.get("/laboratorio/envios")
async def get_envios_laboratorio(
    paciente_cedula: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user)
):
    query = {}
    if paciente_cedula: query["paciente_cedula"] = paciente_cedula
    envios = await db.laboratorio_envios.find(query, {"_id": 0}).sort("fecha_envio", -1).to_list(200)
    return envios


# ========== INTEGRACIÓN SRI ==========

@router.post("/sri/emitir/{invoice_id}")
async def emitir_factura_sri(invoice_id: str, current_user: TokenData = Depends(get_current_user)):
    from sri_facturacion import generar_clave_acceso, generar_xml_factura, firmar_xml, enviar_al_sri, autorizar_en_sri, get_p12_desde_mongo
    import base64, asyncio
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if invoice.get("estado") == "anulada":
        raise HTTPException(status_code=400, detail="No se puede emitir una factura anulada")
    if invoice.get("sri_estado") == "AUTORIZADO":
        raise HTTPException(status_code=400, detail="Esta factura ya fue autorizada por el SRI")
    # Proteger contra doble emisión — si ya tiene clave de acceso, consultar estado antes de reenviar
    if invoice.get("clave_acceso") and invoice.get("sri_estado") in ("RECIBIDA", "PENDIENTE"):
        # Intentar consultar autorización con la clave ya generada
        from sri_facturacion import autorizar_en_sri, get_p12_desde_mongo
        _, _, amb = await get_p12_desde_mongo(db)
        resultado_consulta = await autorizar_en_sri(invoice["clave_acceso"], amb)
        if resultado_consulta.get("ok"):
            await db.invoices.update_one({"id": invoice_id}, {"$set": {
                "sri_estado": "AUTORIZADO",
                "numero_autorizacion": resultado_consulta.get("numero_autorizacion", invoice["clave_acceso"]),
                "fecha_autorizacion": resultado_consulta.get("fecha_autorizacion", ""),
            }})
            return {"ok": True, "clave_acceso": invoice["clave_acceso"],
                    "sri_estado": "AUTORIZADO",
                    "numero_autorizacion": resultado_consulta.get("numero_autorizacion", ""),
                    "mensaje": "Factura ya enviada — autorización consultada exitosamente"}
    p12_bytes, password, ambiente = await get_p12_desde_mongo(db)
    if not p12_bytes:
        raise HTTPException(status_code=503, detail="Certificado .p12 no configurado. Ve a Admin → Config. SRI")
    cfg_clinica = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    clinica = cfg_clinica.get("valor", {}) if cfg_clinica else {}
    ruc = clinica.get("ruc", invoice.get("emisor_ruc", ""))
    if not ruc:
        raise HTTPException(status_code=400, detail="RUC no configurado. Ve a Facturación → Config. Clínica")
    partes = invoice.get("numero_factura", "001-001-000000001").split("-")
    est = partes[0] if len(partes) > 0 else "001"
    pto = partes[1] if len(partes) > 1 else "001"
    seq = partes[2] if len(partes) > 2 else "000000001"
    serie = est + pto
    fecha_raw = invoice.get("fecha", datetime.now().strftime("%Y-%m-%d"))
    try:
        from datetime import datetime as dt2
        fecha_str = dt2.strptime(fecha_raw, "%Y-%m-%d").strftime("%d/%m/%Y")
    except:
        fecha_str = datetime.now().strftime("%d/%m/%Y")
    amb_codigo = "1" if ambiente == "pruebas" else "2"
    clave_acceso = generar_clave_acceso(fecha_str, "01", ruc, amb_codigo, serie, seq)
    invoice_completo = {**invoice, "emisor_ruc": ruc}
    try:
        xml_bytes = generar_xml_factura(invoice_completo, clave_acceso, amb_codigo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando XML: {e}")
    try:
        xml_firmado = firmar_xml(xml_bytes, p12_bytes, password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error firmando XML: {e}")
    xml_b64 = base64.b64encode(xml_firmado).decode()
    resultado_envio = await enviar_al_sri(xml_firmado, ambiente)
    resultado_autorizacion = {"ok": False, "estado": "PENDIENTE"}
    if resultado_envio.get("ok"):
        await asyncio.sleep(2)
        resultado_autorizacion = await autorizar_en_sri(clave_acceso, ambiente)
    update_data = {"clave_acceso": clave_acceso, "sri_estado_envio": resultado_envio.get("estado", "ERROR"), "sri_mensaje_envio": resultado_envio.get("mensaje", ""), "sri_xml_b64": xml_b64, "sri_ambiente": ambiente, "sri_fecha_envio": datetime.now(timezone.utc).isoformat()}
    if resultado_autorizacion.get("ok"):
        update_data["sri_estado"] = "AUTORIZADO"
        update_data["numero_autorizacion"] = resultado_autorizacion.get("numero_autorizacion", clave_acceso)
        update_data["fecha_autorizacion"] = resultado_autorizacion.get("fecha_autorizacion", "")
    else:
        update_data["sri_estado"] = resultado_envio.get("estado", "ERROR")
        update_data["sri_mensaje"] = resultado_envio.get("mensaje", "")
    await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    return {"ok": resultado_autorizacion.get("ok") or resultado_envio.get("ok"), "clave_acceso": clave_acceso, "sri_estado": update_data.get("sri_estado"), "numero_autorizacion": update_data.get("numero_autorizacion", ""), "envio": resultado_envio, "autorizacion": resultado_autorizacion}


@router.get("/sri/estado/{invoice_id}")
async def consultar_estado_sri(invoice_id: str, current_user: TokenData = Depends(get_current_user)):
    from sri_facturacion import autorizar_en_sri, get_p12_desde_mongo
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    clave = invoice.get("clave_acceso", "")
    if not clave:
        raise HTTPException(status_code=400, detail="Esta factura no tiene clave de acceso SRI")
    _, _, ambiente = await get_p12_desde_mongo(db)
    resultado = await autorizar_en_sri(clave, ambiente)
    if resultado.get("ok"):
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"sri_estado": "AUTORIZADO", "numero_autorizacion": resultado.get("numero_autorizacion", clave), "fecha_autorizacion": resultado.get("fecha_autorizacion", "")}})
    return resultado


@router.get("/sri/descargar-xml/{invoice_id}")
async def descargar_xml_sri(invoice_id: str, current_user: TokenData = Depends(get_current_user)):
    import base64
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice or not invoice.get("sri_xml_b64"):
        raise HTTPException(status_code=404, detail="XML no disponible para esta factura")
    xml_bytes = base64.b64decode(invoice["sri_xml_b64"])
    numero = invoice.get("numero_factura", "factura").replace("-", "_")
    return StreamingResponse(iter([xml_bytes]), media_type="application/xml", headers={"Content-Disposition": f"attachment; filename=factura_{numero}.xml"})


@router.post("/sri/enviar-ride/{invoice_id}")
async def enviar_ride_por_correo(invoice_id: str, data: dict = {}, current_user: TokenData = Depends(get_current_user)):
    import smtplib, base64
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders
    from pdf_generator import generate_factura_pdf
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    email_destino = data.get("email") or invoice.get("paciente_email", "")
    if not email_destino:
        raise HTTPException(status_code=400, detail="No hay email del paciente")
    cfg_email = await db.configuracion.find_one({"clave": "email_config"}, {"_id": 0})
    if not cfg_email or not cfg_email.get("valor"):
        raise HTTPException(status_code=503, detail="Correo no configurado. Ve a Admin → Config. SRI → sección Gmail")
    email_cfg = cfg_email["valor"]
    smtp_user = email_cfg.get("email", "")
    smtp_pass = email_cfg.get("app_password", "")
    if not smtp_user or not smtp_pass:
        raise HTTPException(status_code=503, detail="Configuración de correo incompleta")
    pdf_buffer = generate_factura_pdf(invoice)
    pdf_bytes = pdf_buffer.read()
    numero_factura = invoice.get("numero_factura", "")
    autorizacion = invoice.get("numero_autorizacion", "")
    sri_estado = invoice.get("sri_estado", "pendiente")
    msg = MIMEMultipart()
    msg["From"] = f"Family Health <{smtp_user}>"
    msg["To"] = email_destino
    msg["Subject"] = f"Factura {numero_factura} - Family Health"
    estado_texto = f"✅ Autorizada por el SRI — N°: {autorizacion}" if sri_estado == "AUTORIZADO" else "⏳ Pendiente de autorización SRI"
    cuerpo = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
<div style="background:linear-gradient(135deg,#005f73,#00a8cc);padding:20px;border-radius:10px 10px 0 0;text-align:center">
<h2 style="color:white;margin:0">🧾 Factura Electrónica</h2>
<p style="color:rgba(255,255,255,0.8);margin:5px 0 0">Centro de Especialidades Family Health</p></div>
<div style="background:#f8fdff;padding:20px;border:1px solid #e0f7fa">
<p>Estimado/a <strong>{invoice.get("paciente_nombre","Paciente")}</strong>,</p>
<p>Adjuntamos su comprobante de atención médica.</p>
<div style="background:white;border:1px solid #b2ebf2;border-radius:8px;padding:15px;margin:15px 0">
<table style="width:100%;font-size:14px">
<tr><td style="color:#666">N° Factura:</td><td><strong>{numero_factura}</strong></td></tr>
<tr><td style="color:#666">Fecha:</td><td>{invoice.get("fecha","")}</td></tr>
<tr><td style="color:#666">Doctor:</td><td>{invoice.get("doctor_nombre","")} — {invoice.get("especialidad","")}</td></tr>
<tr><td style="color:#666">Total:</td><td><strong style="color:#005f73">${invoice.get("total",0):.2f}</strong></td></tr>
<tr><td style="color:#666">Estado SRI:</td><td>{estado_texto}</td></tr>
</table></div>
<p style="color:#555;font-size:13px">Los servicios médicos están exentos de IVA según la Ley de Régimen Tributario Interno del Ecuador.</p>
</div>
<div style="background:#005f73;padding:15px;border-radius:0 0 10px 10px;text-align:center">
<p style="color:white;margin:0;font-size:13px">Family Health | Mucho Lote 2 MZ 2833 Villa 15, Guayaquil | 096-291-2170</p>
</div></body></html>"""
    msg.attach(MIMEText(cuerpo, "html"))
    part = MIMEBase("application", "octet-stream")
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f"attachment; filename=factura_{numero_factura.replace('-','_')}.pdf")
    msg.attach(part)
    if invoice.get("sri_xml_b64") and sri_estado == "AUTORIZADO":
        xml_bytes = base64.b64decode(invoice["sri_xml_b64"])
        part_xml = MIMEBase("application", "xml")
        part_xml.set_payload(xml_bytes)
        encoders.encode_base64(part_xml)
        part_xml.add_header("Content-Disposition", f"attachment; filename=factura_{numero_factura.replace('-','_')}.xml")
        msg.attach(part_xml)
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        await db.invoices.update_one({"id": invoice_id}, {"$set": {"ride_enviado_a": email_destino, "ride_enviado_fecha": datetime.now(timezone.utc).isoformat()}})
        return {"ok": True, "mensaje": f"✅ Factura enviada a {email_destino}"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="Error de autenticación Gmail. Usa una App Password de 16 caracteres.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar correo: {e}")


# ═══════════════════════════════════════════════════════════════════
# DOCUMENTOS CLÍNICOS — Consentimiento, Certificado, Firma doctor
# ═══════════════════════════════════════════════════════════════════

def _clinica_header(c, buffer_info: dict):
    """Dibuja el encabezado con logo y datos del consultorio."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    width, height = letter
    nombre  = buffer_info.get("razon_social", "CENTRO DE ESPECIALIDADES FAMILY HEALTH")
    comercial = buffer_info.get("nombre_comercial", "FAMILY HEALTH")
    ruc     = buffer_info.get("ruc", "")
    dir_    = buffer_info.get("direccion", "Guayaquil, Ecuador")
    tel     = buffer_info.get("telefono", "")

    # Banda azul superior
    c.setFillColorRGB(0.047, 0.290, 0.431)  # #0C4A6E
    c.rect(0, height - 80, width, 80, fill=1, stroke=0)

    # Logo (si existe)
    try:
        c.drawImage("/app/frontend/public/logo.png", 30, height - 72,
                    width=55, height=55, preserveAspectRatio=True, mask="auto")
    except Exception:
        pass

    # Nombre en blanco
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(100, height - 32, nombre)
    c.setFont("Helvetica", 9)
    c.drawString(100, height - 46, f"RUC: {ruc}   |   {dir_}   |   Tel: {tel}")

    # Línea divisoria bajo el banner
    c.setStrokeColorRGB(0.047, 0.290, 0.431)
    c.setFillColorRGB(0, 0, 0)
    c.setLineWidth(0.5)
    c.line(30, height - 90, width - 30, height - 90)

    return height - 100  # y de inicio del contenido


def _firma_doctor(c, doctor: dict, y: float, page_width: float):
    """Dibuja la firma del doctor (imagen base64 si existe, línea si no)."""
    firma_b64 = doctor.get("firma_imagen_b64")
    nombre_dr = doctor.get("nombre", doctor.get("nombre_completo", ""))
    especialidad = doctor.get("especialidad", "")
    reg_msp = doctor.get("registro_msp", "")

    x_firma = page_width / 2 - 60

    if firma_b64:
        try:
            import base64
            from PIL import Image as PILImage
            from io import BytesIO as BIO
            from reportlab.lib.utils import ImageReader
            img_bytes = base64.b64decode(firma_b64)
            img = PILImage.open(BIO(img_bytes))
            ir = ImageReader(BIO(img_bytes))
            c.drawImage(ir, x_firma, y - 50, width=120, height=50,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            c.setLineWidth(0.8)
            c.line(x_firma, y - 10, x_firma + 120, y - 10)
    else:
        c.setLineWidth(0.8)
        c.setStrokeColorRGB(0, 0, 0)
        c.line(x_firma, y - 10, x_firma + 120, y - 10)

    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x_firma + 60, y - 25, nombre_dr)
    c.setFont("Helvetica", 8)
    c.drawCentredString(x_firma + 60, y - 36, especialidad)
    if reg_msp:
        c.drawCentredString(x_firma + 60, y - 46, f"Reg. MSP: {reg_msp}")


# ── Guardar firma del doctor ─────────────────────────────────────────────────
@router.put("/doctors/{doctor_id}/firma")
async def guardar_firma_doctor(
    doctor_id: str,
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """Guarda la imagen de firma del doctor en base64."""
    await db.doctors.update_one(
        {"id": doctor_id},
        {"$set": {
            "firma_imagen_b64": data.get("firma_imagen_b64", ""),
            "registro_msp": data.get("registro_msp", ""),
        }}
    )
    return {"ok": True}


# ── Consentimiento Informado PDF ─────────────────────────────────────────────
@router.post("/appointments/{appointment_id}/consentimiento-pdf")
async def get_consentimiento_pdf(
    appointment_id: str,
    data: dict = {},
    current_user: TokenData = Depends(get_current_user)
):
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import getSampleStyleSheet
    from io import BytesIO

    appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    cfg = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    clinica = cfg.get("valor", {}) if cfg else {}

    doctor = None
    if appt.get("doctor_id"):
        doctor = await db.doctors.find_one({"id": appt["doctor_id"]}, {"_id": 0})

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    y = _clinica_header(c, clinica)

    procedimiento = data.get("procedimiento", "") if data else ""

    # Título
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(width / 2, y - 20, "CONSENTIMIENTO INFORMADO")
    c.setFont("Helvetica", 8)
    subtitulo = f"Fecha: {appt.get('fecha', '')}   |   Especialidad: {appt.get('especialidad', '')}"
    if procedimiento:
        subtitulo += f"   |   Procedimiento: {procedimiento}"
    c.drawCentredString(width / 2, y - 32, subtitulo)

    y -= 50

    # Datos del paciente
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0.047, 0.290, 0.431)
    c.drawString(40, y, "DATOS DEL PACIENTE")
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 10)
    y -= 16
    c.drawString(40, y, f"Nombre: {appt.get('nombre_completo', '')}")
    y -= 14
    c.drawString(40, y, f"Cédula / Pasaporte: {appt.get('cedula', 'No registrada')}")
    y -= 14
    c.drawString(40, y, f"Teléfono: {appt.get('telefono', '')}   |   Email: {appt.get('email', '')}")
    y -= 25

    # Cuerpo del consentimiento
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0.047, 0.290, 0.431)
    c.drawString(40, y, "DECLARACIÓN DE CONSENTIMIENTO")
    c.setFillColorRGB(0, 0, 0)
    y -= 15

    texto = (
        "Yo, el/la paciente o representante legal identificado/a en este documento, "
        "declaro que he sido informado/a de manera clara y comprensible sobre:\n\n"
        "1. Mi estado de salud actual y el diagnóstico provisional.\n"
        "2. El procedimiento o tratamiento propuesto, sus objetivos y características.\n"
        "3. Los beneficios esperados del tratamiento.\n"
        "4. Los riesgos posibles, complicaciones y efectos secundarios conocidos.\n"
        "5. Las alternativas existentes al procedimiento propuesto.\n"
        "6. Las consecuencias de no realizar el tratamiento.\n\n"
        "He tenido la oportunidad de realizar todas las preguntas que consideré pertinentes "
        "y he recibido respuestas satisfactorias. Comprendo que puedo revocar este consentimiento "
        "en cualquier momento antes de que se inicie el procedimiento, sin que ello afecte "
        "la calidad de la atención médica que se me brinde.\n\n"
        "En pleno uso de mis facultades mentales, CONSIENTO voluntariamente a recibir el "
        "procedimiento indicado y autorizo al equipo médico de este establecimiento de salud "
        "a realizarlo."
    )

    c.setFont("Helvetica", 9)
    text_obj = c.beginText(40, y)
    text_obj.setFont("Helvetica", 9)
    text_obj.setLeading(14)
    for linea in texto.split("\n"):
        # Wrap largo
        if len(linea) > 95:
            palabras = linea.split()
            linea_actual = ""
            for p in palabras:
                if len(linea_actual) + len(p) + 1 < 95:
                    linea_actual += (" " if linea_actual else "") + p
                else:
                    text_obj.textLine(linea_actual)
                    linea_actual = p
            if linea_actual:
                text_obj.textLine(linea_actual)
        else:
            text_obj.textLine(linea)
    c.drawText(text_obj)
    y = text_obj.getY() - 30

    # Firmas
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0.047, 0.290, 0.431)
    c.drawString(40, y, "FIRMAS")
    c.setFillColorRGB(0, 0, 0)
    y -= 20

    # Firma paciente
    c.setLineWidth(0.8)
    c.line(40, y - 10, 200, y - 10)
    c.setFont("Helvetica", 8)
    c.drawString(40, y - 22, "Firma del Paciente / Representante")
    c.drawString(40, y - 33, f"CI: {appt.get('cedula', '________________')}")

    # Firma doctor
    if doctor:
        _firma_doctor(c, doctor, y, width)
    else:
        c.line(width - 200, y - 10, width - 40, y - 10)
        c.setFont("Helvetica", 8)
        c.drawString(width - 200, y - 22, "Firma del Médico Responsable")

    c.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=consentimiento_{appointment_id}.pdf"}
    )


# ── Certificado Médico PDF ───────────────────────────────────────────────────
@router.post("/appointments/{appointment_id}/certificado-pdf")
async def get_certificado_pdf(
    appointment_id: str,
    data: dict,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Genera certificado médico con días de reposo.
    data: { dias_reposo: int, diagnostico: str, observaciones: str }
    """
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    from io import BytesIO
    from datetime import date

    appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    cfg = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
    clinica = cfg.get("valor", {}) if cfg else {}

    doctor = None
    if appt.get("doctor_id"):
        doctor = await db.doctors.find_one({"id": appt["doctor_id"]}, {"_id": 0})

    dias_reposo  = int(data.get("dias_reposo", 0))
    diagnostico  = data.get("diagnostico", "")
    cie10        = data.get("cie10", "").strip().upper()
    observaciones = data.get("observaciones", "")
    fecha_emision = date.today().strftime("%d/%m/%Y")

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    y = _clinica_header(c, clinica)

    # Título
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, y - 20, "CERTIFICADO MÉDICO")
    y -= 45

    # Datos doctor — usa emisor_nombre del request si lo provee (counter/admin)
    nombre_dr    = data.get("emisor_nombre") or (doctor or {}).get("nombre") or current_user.username
    especialidad = (doctor or {}).get("especialidad", "")
    reg_msp      = (doctor or {}).get("registro_msp", "")

    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0.047, 0.290, 0.431)
    c.drawString(40, y, "EL MÉDICO QUE SUSCRIBE:")
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 10)
    y -= 16
    c.drawString(40, y, f"Dr./Dra. {nombre_dr}   —   {especialidad}")
    if reg_msp:
        y -= 14
        c.drawString(40, y, f"Reg. MSP: {reg_msp}")
    y -= 25

    # Cuerpo
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0.047, 0.290, 0.431)
    c.drawString(40, y, "CERTIFICA QUE:")
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 10)
    y -= 18

    nombre_pac = appt.get("nombre_completo", "")
    cedula_pac = appt.get("cedula", "")

    texto_cuerpo = [
        f"El/La paciente {nombre_pac}, identificado/a con CI/Pasaporte: {cedula_pac},",
        f"fue atendido/a en esta institución el día {appt.get('fecha', fecha_emision)},",
        f"bajo diagnóstico de: {diagnostico if diagnostico else '___________________________________'}",
        f"Código CIE-10: {cie10 if cie10 else '_______________'}" if cie10 or True else "",
        "",
        f"Por tal motivo, se le indica REPOSO por {dias_reposo} día(s) a partir de la fecha de emisión." if dias_reposo > 0 else "No requiere reposo.",
    ]

    for linea in texto_cuerpo:
        c.drawString(40, y, linea)
        y -= 16

    if observaciones:
        y -= 10
        c.setFont("Helvetica-Bold", 10)
        c.setFillColorRGB(0.047, 0.290, 0.431)
        c.drawString(40, y, "OBSERVACIONES:")
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica", 10)
        y -= 16
        c.drawString(40, y, observaciones[:90])
        y -= 14
        if len(observaciones) > 90:
            c.drawString(40, y, observaciones[90:180])
            y -= 14

    y -= 10
    c.setFont("Helvetica", 9)
    c.drawString(40, y, f"Fecha de emisión: {fecha_emision}")
    y -= 40

    # Firma
    if doctor:
        _firma_doctor(c, doctor, y, width)
    else:
        c.setLineWidth(0.8)
        c.line(width / 2 - 60, y - 10, width / 2 + 60, y - 10)
        c.setFont("Helvetica", 8)
        c.drawCentredString(width / 2, y - 22, "Firma del Médico")

    # Pie
    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.5, 0.5, 0.5)
    c.drawCentredString(width / 2, 30,
        "Documento emitido electrónicamente — válido sin sello físico según normativa vigente")

    c.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=certificado_{appointment_id}.pdf"}
    )


@router.get("/sri/diagnostico")
async def diagnostico_sri(current_user: TokenData = Depends(get_current_user)):
    """Diagnóstico del estado de la integración SRI."""
    from sri_facturacion import get_p12_desde_mongo
    resultado = {
        "certificado_cargado": False,
        "ambiente": None,
        "ruc_config": None,
        "titular_cert": None,
        "valido_hasta": None,
        "conectividad_sri": "no verificado",
        "problemas": [],
        "recomendaciones": [],
        "estado_general": "",
    }
    try:
        p12_bytes, password, ambiente = await get_p12_desde_mongo(db)
        resultado["ambiente"] = ambiente

        if not p12_bytes:
            resultado["problemas"].append("No hay certificado .p12 cargado")
            resultado["recomendaciones"].append("Ve a Config → Configuración SRI y sube tu certificado .p12")
            resultado["estado_general"] = "❌ Sin certificado"
            return resultado

        resultado["certificado_cargado"] = True

        cfg = await db.configuracion.find_one({"clave": "firma_electronica"}, {"_id": 0})
        val = (cfg or {}).get("valor", {})
        resultado["titular_cert"] = val.get("titular", "No disponible")
        resultado["valido_hasta"] = val.get("valido_hasta", "No disponible")

        cfg_clinica = await db.configuracion.find_one({"clave": "clinica_config"}, {"_id": 0})
        clinica = (cfg_clinica or {}).get("valor", {})
        ruc = clinica.get("ruc", "")
        resultado["ruc_config"] = ruc or "NO CONFIGURADO"

        if not ruc:
            resultado["problemas"].append("RUC no configurado en Config. Clínica")
            resultado["recomendaciones"].append("Ve a Facturación → Config. Clínica e ingresa tu RUC")

        if ambiente == "pruebas":
            resultado["problemas"].append("Ambiente: PRUEBAS — facturas van al portal de pruebas SRI, no al productivo")
            resultado["recomendaciones"].append("Cambia ambiente a 'produccion' en Config → Configuración SRI")

        if resultado["valido_hasta"] and resultado["valido_hasta"] != "No disponible":
            from datetime import date
            try:
                vence = date.fromisoformat(resultado["valido_hasta"])
                dias = (vence - date.today()).days
                if dias < 0:
                    resultado["problemas"].append(f"Certificado VENCIDO el {resultado['valido_hasta']}")
                    resultado["recomendaciones"].append("Renueva tu .p12 en el Banco Central o Security Data")
                elif dias < 30:
                    resultado["problemas"].append(f"Certificado vence en {dias} días ({resultado['valido_hasta']})")
            except Exception:
                pass

        resultado["estado_general"] = (
            f"⚠️ {len(resultado['problemas'])} problema(s)"
            if resultado["problemas"] else "✅ Configuración correcta"
        )
    except Exception as e:
        resultado["problemas"].append(f"Error interno: {str(e)[:120]}")
        resultado["estado_general"] = "❌ Error en diagnóstico"

    return resultado
