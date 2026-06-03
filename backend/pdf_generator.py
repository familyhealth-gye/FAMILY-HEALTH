from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from io import BytesIO
from datetime import datetime
import os

COLOR_AZUL       = colors.HexColor('#005f73')   # azul oscuro — diferente del logo turquesa
COLOR_TURQUESA   = colors.HexColor('#00a8cc')
COLOR_VERDE      = colors.HexColor('#6decb9')
COLOR_FONDO      = colors.HexColor('#f5faff')
COLOR_GRIS       = colors.HexColor('#555555')

LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'logo.png')

# Media hoja A4 (A5 apaisado es ~148x210, pero usamos A4 partido verticalmente)
MEDIA_HOJA = (A4[0], A4[1] / 2)   # 210 x 148 mm aprox


def _draw_header_footer(canvas_obj, doc):
    canvas_obj.saveState()
    w, h = doc.pagesize

# Barra superior — degradado simulado con dos rectángulos
    canvas_obj.setFillColor(colors.HexColor('#003d52'))
    canvas_obj.rect(0, h - 0.85*inch, w, 0.85*inch, fill=1, stroke=0)
    # Franja inferior del header — celeste médico suave
    canvas_obj.setFillColor(colors.HexColor('#0891b2'))
    canvas_obj.rect(0, h - 0.88*inch, w, 0.06*inch, fill=1, stroke=0)

    # Logo
    if os.path.exists(LOGO_PATH):
        try:
            canvas_obj.drawImage(LOGO_PATH, 0.18*inch, h - 0.80*inch,
                                  width=0.68*inch, height=0.68*inch,
                                  preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    # Texto encabezado — compacto en una línea y media
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica-Bold", 8)
    canvas_obj.drawString(1.0*inch, h - 0.32*inch, "CENTRO DE ESPECIALIDADES FAMILY HEALTH")
    canvas_obj.setFont("Helvetica", 6.8)
    canvas_obj.drawString(1.0*inch, h - 0.48*inch, "CONTACTOS: 096-291-2170  /  04-500-7012   |   MUCHO LOTE 2 MZ 2833 VILLA 15  |  FAMILYHEALTH.GYE")
   
    # Marca de agua logo centro (muy tenue)
    if os.path.exists(LOGO_PATH):
        try:
            canvas_obj.saveState()
            canvas_obj.setFillAlpha(0.04)
            canvas_obj.drawImage(LOGO_PATH, w/2 - 1.2*inch, h/2 - 1.5*inch,
                                  width=2.4*inch, height=2.4*inch,
                                  preserveAspectRatio=True, mask='auto')
            canvas_obj.restoreState()
        except Exception:
            pass

    # Pie de página azul oscuro
    canvas_obj.setFillColor(COLOR_AZUL)
    canvas_obj.rect(0, 0, w, 0.48*inch, fill=1, stroke=0)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica", 6.5)
    canvas_obj.drawString(0.2*inch, 0.30*inch,
        "centrodeespecialidadesfamilyhe@gmail.com  |  @familyhealth.gye  |  0962 912 170  |  Guayaquil - Ecuador")
    canvas_obj.setFont("Helvetica", 6)
    canvas_obj.drawRightString(w - 0.2*inch, 0.15*inch,
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    canvas_obj.restoreState()


def _estilos():
    s = getSampleStyleSheet()
    return {
        'titulo': ParagraphStyle('T', parent=s['Heading1'], fontSize=11,
            textColor=COLOR_AZUL, spaceAfter=3, alignment=TA_CENTER, fontName='Helvetica-Bold'),
        'sec': ParagraphStyle('S', parent=s['Heading2'], fontSize=8,
            textColor=colors.white, backColor=COLOR_AZUL, spaceAfter=3, spaceBefore=6,
            fontName='Helvetica-Bold', leading=13),
        'normal': ParagraphStyle('N', parent=s['Normal'], fontSize=8,
            textColor=colors.HexColor('#222222'), spaceAfter=2),
        'small': ParagraphStyle('SM', parent=s['Normal'], fontSize=7,
            textColor=COLOR_GRIS),
    }


def generate_prescription_pdf(prescription_data: dict) -> BytesIO:
    """Genera la receta médica en media hoja A4 con branding Family Health."""
    buffer = BytesIO()
    s = _estilos()

    def on_page(canvas_obj, doc):
        _draw_header_footer(canvas_obj, doc)

    doc = SimpleDocTemplate(buffer, pagesize=MEDIA_HOJA,
                            rightMargin=0.4*inch, leftMargin=0.4*inch,
                            topMargin=0.98*inch, bottomMargin=0.52*inch)
    elems = []

    elems.append(Paragraph("RECETA MÉDICA", s['titulo']))
    elems.append(Spacer(1, 0.08*inch))

    # Info paciente — tabla compacta
    info = [
        ['Paciente:', prescription_data.get('paciente_nombre',''), 'Fecha:', prescription_data.get('fecha','')],
        ['Cédula:', prescription_data.get('paciente_cedula',''), 'Edad:', f"{prescription_data.get('paciente_edad','')} años"],
        ['Doctor:', prescription_data.get('doctor_nombre',''), 'Especialidad:', prescription_data.get('doctor_especialidad','')],
    ]
    t_info = Table(info, colWidths=[0.7*inch, 2.1*inch, 0.7*inch, 1.8*inch])
    t_info.setStyle(TableStyle([
        ('FONT', (0,0), (0,-1), 'Helvetica-Bold', 7),
        ('FONT', (2,0), (2,-1), 'Helvetica-Bold', 7),
        ('FONT', (1,0), (-1,-1), 'Helvetica', 7),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [COLOR_FONDO, colors.white]),
        ('BOX', (0,0), (-1,-1), 0.4, COLOR_TURQUESA),
        ('INNERGRID', (0,0), (-1,-1), 0.2, colors.HexColor('#cccccc')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3),
    ]))
    elems.append(t_info)
    elems.append(Spacer(1, 0.07*inch))

    # Diagnóstico
    diag = prescription_data.get('diagnostico','')
    cie  = prescription_data.get('cie10_codigo','')
    if cie: diag += f"  (CIE-10: {cie})"
    elems.append(Paragraph("  DIAGNÓSTICO", s['sec']))
    elems.append(Paragraph(diag, s['normal']))
    elems.append(Spacer(1, 0.06*inch))

    # Prescripción + Indicaciones en 2 columnas
    meds = prescription_data.get('medicamentos', [])
    presc_lines = []
    for i, m in enumerate(meds, 1):
        presc_lines.append(f"<b>{i}. {m.get('nombre','')}</b> {m.get('dosis','')}")
        presc_lines.append(f"&nbsp;&nbsp;{m.get('frecuencia','')} por {m.get('duracion','')}")
        if m.get('indicaciones'):
            presc_lines.append(f"&nbsp;&nbsp;<i>{m.get('indicaciones')}</i>")
    presc_txt = "<br/>".join(presc_lines) if presc_lines else "Sin medicamentos prescritos"
    indic_txt = prescription_data.get('indicaciones_generales','') or ""

    elems.append(Paragraph("  PRESCRIPCIÓN / INDICACIONES", s['sec']))
    dual = [[Paragraph(presc_txt, s['normal']), Paragraph(f"<b>Indicaciones:</b><br/>{indic_txt}", s['normal'])]]
    t_dual = Table(dual, colWidths=[2.7*inch, 2.7*inch])
    t_dual.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.4, COLOR_TURQUESA),
        ('LINEBEFORE', (1,0), (1,0), 0.8, COLOR_TURQUESA),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elems.append(t_dual)

    # Precauciones
    precauc = prescription_data.get('precauciones','')
    if precauc:
        elems.append(Spacer(1, 0.06*inch))
        elems.append(Paragraph("  PRECAUCIONES", s['sec']))
        elems.append(Paragraph(precauc, s['normal']))

    doc.build(elems, onFirstPage=on_page, onLaterPages=on_page)
    buffer.seek(0)
    return buffer


def generate_certificado_pdf(data: dict) -> BytesIO:
    """Genera un certificado médico en A4 completo con branding Family Health."""
    buffer = BytesIO()
    s = _estilos()

    def on_page(canvas_obj, doc):
        _draw_header_footer(canvas_obj, doc)

    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=1.1*inch, leftMargin=1.1*inch,
                            topMargin=1.4*inch, bottomMargin=0.8*inch)
    elems = []
    elems.append(Paragraph("CERTIFICADO MÉDICO", s['titulo']))
    elems.append(Spacer(1, 0.3*inch))

    fecha = data.get('fecha', datetime.now().strftime('%d de %B de %Y'))
    texto = (
        f"El/La suscrito/a, <b>{data.get('doctor_nombre','')}</b>, médico del Centro de Especialidades "
        f"Family Health, certifica que el/la paciente <b>{data.get('paciente_nombre','')}</b>, "
        f"portador/a de la cédula <b>{data.get('paciente_cedula','')}</b>, de "
        f"<b>{data.get('paciente_edad','')} años</b> de edad, fue atendido/a en esta institución "
        f"el día <b>{fecha}</b>.<br/><br/>"
        f"<b>Diagnóstico:</b> {data.get('diagnostico','')}"
        f"{' (CIE-10: ' + data.get('cie10_codigo','') + ')' if data.get('cie10_codigo') else ''}"
        f"<br/><br/>{data.get('contenido','')}<br/><br/>"
        f"Este certificado se extiende a petición del/la interesado/a para los fines que estime conveniente."
    )
    cert_st = ParagraphStyle('cert', parent=s['normal'], fontSize=11, leading=18, alignment=4)
    elems.append(Paragraph(texto, cert_st))
    elems.append(Spacer(1, 0.8*inch))

    firma = [[
        Paragraph(f"_________________________<br/><b>{data.get('doctor_nombre','')}</b><br/>Médico Tratante", s['normal']),
        Paragraph(f"_________________________<br/><b>Guayaquil, {fecha}</b><br/>Lugar y Fecha", s['normal'])
    ]]
    t_firma = Table(firma, colWidths=[3*inch, 3*inch])
    t_firma.setStyle(TableStyle([('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'TOP')]))
    elems.append(t_firma)

    doc.build(elems, onFirstPage=on_page, onLaterPages=on_page)
    buffer.seek(0)
    return buffer

def generate_factura_pdf(inv: dict) -> BytesIO:
    """
    Genera el RIDE (Representación Impresa del Documento Electrónico)
    para facturas electrónicas según formato SRI Ecuador.
    Compatible con resolución NAC-DGERCGC12-00105.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=1.5*cm, leftMargin=1.5*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm)
    elems = []
    s = getSampleStyleSheet()

    # ── Estilos ──────────────────────────────────────────────────────────────
    bold_center = ParagraphStyle('BoldC', parent=s['Normal'],
                                 fontName='Helvetica-Bold', fontSize=9, alignment=TA_CENTER)
    normal_sm   = ParagraphStyle('NormSm', parent=s['Normal'],
                                 fontName='Helvetica', fontSize=8)
    bold_sm     = ParagraphStyle('BoldSm', parent=s['Normal'],
                                 fontName='Helvetica-Bold', fontSize=8)
    tiny        = ParagraphStyle('Tiny', parent=s['Normal'],
                                 fontName='Helvetica', fontSize=7)
    tiny_center = ParagraphStyle('TinyC', parent=s['Normal'],
                                 fontName='Helvetica', fontSize=7, alignment=TA_CENTER)
    title_style = ParagraphStyle('Title', parent=s['Normal'],
                                 fontName='Helvetica-Bold', fontSize=11, alignment=TA_CENTER)

    W = A4[0] - 3*cm  # ancho útil

    # ── ENCABEZADO: Logo | Datos emisor | Datos documento ────────────────────
    # Datos del emisor
    razon_social    = inv.get('emisor_razon_social', inv.get('clinica_nombre', 'FAMILY HEALTH'))
    nombre_comercial= inv.get('emisor_nombre_comercial', razon_social)
    ruc             = inv.get('emisor_ruc', '')
    direccion_matriz= inv.get('emisor_direccion', '')
    dir_establecimiento = inv.get('emisor_direccion_establecimiento', direccion_matriz)
    contribuyente   = inv.get('emisor_tipo_contribuyente', 'PERSONA NATURAL')
    obligado        = 'SI' if inv.get('emisor_obligado_contabilidad', False) else 'NO'
    ambiente_str    = 'PRODUCCIÓN' if inv.get('sri_ambiente', 'pruebas') == 'produccion' else 'PRUEBAS'
    num_factura     = inv.get('numero_factura', '001-001-000000001')
    clave_acceso    = inv.get('clave_acceso', '')
    num_autorizacion= inv.get('numero_autorizacion', clave_acceso or 'PENDIENTE')
    fecha_autorizacion = inv.get('fecha_autorizacion', '')
    sri_estado      = inv.get('sri_estado', 'PENDIENTE')

    # Columna central (datos emisor)
    emisor_data = [
        [Paragraph(razon_social, bold_center)],
        [Paragraph(f'RUC: {ruc}', tiny_center)],
        [Paragraph(nombre_comercial, tiny_center)],
        [Paragraph(f'Dirección Matriz: {direccion_matriz}', tiny_center)],
        [Paragraph(f'Dir. Establecimiento: {dir_establecimiento}', tiny_center)],
        [Paragraph(f'Contribuyente: {contribuyente}', tiny_center)],
        [Paragraph(f'Obligado a llevar contabilidad: {obligado}', tiny_center)],
    ]
    t_emisor = Table(emisor_data, colWidths=[W*0.45])
    t_emisor.setStyle(TableStyle([
        ('ALIGN', (0,0),(-1,-1),'CENTER'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('BOX', (0,0),(-1,-1), 0.5, colors.black),
        ('INNERGRID',(0,0),(-1,-1), 0.3, colors.lightgrey),
        ('ROWBACKGROUNDS', (0,0),(-1,-1), [colors.white, colors.HexColor('#F0F9FF')]),
    ]))

    # Columna derecha (identificación del documento)
    doc_data = [
        [Paragraph('R.U.C.:', bold_sm), Paragraph(ruc, normal_sm)],
        [Paragraph('FACTURA', bold_center), Paragraph('', normal_sm)],
        [Paragraph('No.', bold_sm), Paragraph(num_factura, normal_sm)],
        [Paragraph('NÚMERO DE AUTORIZACIÓN', bold_sm), Paragraph('')],
        [Paragraph(num_autorizacion[:24] if num_autorizacion else 'PENDIENTE', tiny_center), Paragraph('')],
        [Paragraph(f'Fecha auth: {fecha_autorizacion}', tiny), Paragraph('')],
        [Paragraph(f'AMBIENTE: {ambiente_str}', bold_sm), Paragraph('')],
        [Paragraph(f'ESTADO: {sri_estado}', bold_sm), Paragraph('')],
    ]
    t_doc = Table(doc_data, colWidths=[W*0.28, W*0.27])
    t_doc.setStyle(TableStyle([
        ('ALIGN', (0,0),(-1,-1),'LEFT'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('BOX', (0,0),(-1,-1), 0.5, colors.black),
        ('INNERGRID',(0,0),(-1,-1), 0.3, colors.lightgrey),
        ('SPAN', (0,1),(1,1)),
        ('ALIGN', (0,1),(1,1),'CENTER'),
        ('SPAN', (0,3),(1,3)),
        ('SPAN', (0,4),(1,4)),
        ('SPAN', (0,5),(1,5)),
        ('SPAN', (0,6),(1,6)),
        ('SPAN', (0,7),(1,7)),
    ]))

    # Encabezado completo
    header_table = Table([[t_emisor, t_doc]], colWidths=[W*0.45, W*0.55])
    header_table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'), ('LEFTPADDING',(0,0),(-1,-1),0), ('RIGHTPADDING',(0,0),(-1,-1),0)]))
    elems.append(header_table)
    elems.append(Spacer(1, 6))

    # ── CLAVE DE ACCESO ───────────────────────────────────────────────────────
    if clave_acceso:
        clave_data = [[
            Paragraph('CLAVE DE ACCESO', bold_sm),
            Paragraph(clave_acceso, ParagraphStyle('Mono', parent=s['Normal'], fontName='Courier', fontSize=7))
        ]]
        t_clave = Table(clave_data, colWidths=[W*0.25, W*0.75])
        t_clave.setStyle(TableStyle([('BOX',(0,0),(-1,-1),0.5,colors.black), ('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('BACKGROUND',(0,0),(0,0),colors.HexColor('#EFF6FF'))]))
        elems.append(t_clave)
        elems.append(Spacer(1, 6))

    # ── DATOS DEL ADQUIRENTE ─────────────────────────────────────────────────
    fecha_str  = inv.get('fecha', '')
    tipo_pago  = inv.get('tipo_pago', 'efectivo').upper()
    pac_nombre = inv.get('paciente_nombre', '')
    pac_cedula = inv.get('paciente_cedula', '')
    pac_dir    = inv.get('paciente_direccion', '')
    pac_email  = inv.get('paciente_email', '')

    adq_data = [
        ['Razón Social / Nombres:', pac_nombre, 'Identificación:', pac_cedula],
        ['Fecha Emisión:', fecha_str, 'Forma de Pago:', tipo_pago],
        ['Dirección:', pac_dir, 'Email:', pac_email],
    ]
    t_adq = Table(adq_data, colWidths=[W*0.22, W*0.33, W*0.18, W*0.27])
    t_adq.setStyle(TableStyle([
        ('FONTNAME',(0,0),(-1,-1),'Helvetica'), ('FONTSIZE',(0,0),(-1,-1),8),
        ('FONTNAME',(0,0),(0,-1),'Helvetica-Bold'), ('FONTNAME',(2,0),(2,-1),'Helvetica-Bold'),
        ('BOX',(0,0),(-1,-1),0.5,colors.black), ('INNERGRID',(0,0),(-1,-1),0.3,colors.lightgrey),
        ('ROWBACKGROUNDS',(0,0),(-1,-1),[colors.HexColor('#F0F9FF'), colors.white]),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ]))
    elems.append(t_adq)
    elems.append(Spacer(1, 8))

    # ── DETALLE DE SERVICIOS ─────────────────────────────────────────────────
    det_header = [
        Paragraph('Cód.', bold_sm),
        Paragraph('Descripción del Servicio / Bien', bold_sm),
        Paragraph('Cant.', bold_sm),
        Paragraph('P. Unit.', bold_sm),
        Paragraph('Desc.', bold_sm),
        Paragraph('P. Total', bold_sm),
    ]
    det_rows = [det_header]

    detalles = inv.get('detalles', [])
    if not detalles and inv.get('servicio'):
        detalles = [{'descripcion': inv['servicio'], 'cantidad': 1,
                     'precio_unitario': inv.get('valor', 0), 'descuento': 0,
                     'subtotal': inv.get('valor', 0)}]

    subtotal_sin_imp = 0.0
    for i, det in enumerate(detalles):
        cant     = float(det.get('cantidad', 1))
        precio   = float(det.get('precio_unitario', det.get('precio', 0)))
        desc_val = float(det.get('descuento', 0))
        total_det= float(det.get('subtotal', precio * cant - desc_val))
        subtotal_sin_imp += total_det
        bg = colors.white if i % 2 == 0 else colors.HexColor('#F9FAFB')
        det_rows.append([
            Paragraph(str(det.get('codigo', str(i+1))), tiny),
            Paragraph(det.get('descripcion', ''), normal_sm),
            Paragraph(f'{cant:.2f}', tiny_center),
            Paragraph(f'${precio:.2f}', tiny_center),
            Paragraph(f'${desc_val:.2f}', tiny_center),
            Paragraph(f'${total_det:.2f}', tiny_center),
        ])

    t_det = Table(det_rows, colWidths=[W*0.07, W*0.43, W*0.1, W*0.13, W*0.1, W*0.13])
    det_style = [
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'), ('FONTSIZE',(0,0),(-1,-1),8),
        ('BOX',(0,0),(-1,-1),0.5,colors.black), ('INNERGRID',(0,0),(-1,-1),0.3,colors.lightgrey),
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#0C4A6E')),
        ('TEXTCOLOR',(0,0),(-1,0),colors.white),
        ('ALIGN',(2,0),(-1,-1),'CENTER'), ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ]
    # Filas alternadas
    for i in range(1, len(det_rows)):
        if i % 2 == 0:
            det_style.append(('BACKGROUND',(0,i),(-1,i),colors.HexColor('#F9FAFB')))
    t_det.setStyle(TableStyle(det_style))
    elems.append(t_det)
    elems.append(Spacer(1, 6))

    # ── TOTALES ───────────────────────────────────────────────────────────────
    iva_pct    = float(inv.get('iva_porcentaje', 0))
    iva_val    = round(subtotal_sin_imp * iva_pct / 100, 2)
    total_final= round(subtotal_sin_imp + iva_val, 2)
    descuento_total = sum(float(d.get('descuento', 0)) for d in detalles)

    totales_data = [
        ['', 'Subtotal 0%:', f'${subtotal_sin_imp:.2f}'],
        ['', f'IVA {iva_pct:.0f}%:', f'${iva_val:.2f}'],
        ['', 'Descuento Total:', f'${descuento_total:.2f}'],
        ['', 'TOTAL:', f'${total_final:.2f}'],
    ]
    t_tot = Table(totales_data, colWidths=[W*0.6, W*0.22, W*0.18])
    t_tot.setStyle(TableStyle([
        ('FONTNAME',(0,0),(-1,-1),'Helvetica'), ('FONTSIZE',(0,0),(-1,-1),9),
        ('FONTNAME',(1,-1),(2,-1),'Helvetica-Bold'), ('FONTSIZE',(1,-1),(2,-1),11),
        ('ALIGN',(1,0),(-1,-1),'RIGHT'),
        ('BOX',(1,0),(-1,-1),0.5,colors.black),
        ('LINEABOVE',(1,-1),(2,-1),1,colors.black),
        ('BACKGROUND',(1,-1),(2,-1),colors.HexColor('#0C4A6E')),
        ('TEXTCOLOR',(1,-1),(2,-1),colors.white),
    ]))
    elems.append(t_tot)
    elems.append(Spacer(1, 10))

    # ── FORMA DE PAGO ────────────────────────────────────────────────────────
    pago_data = [
        [Paragraph('FORMA DE PAGO', bold_sm), Paragraph('VALOR', bold_sm), Paragraph('PLAZO', bold_sm), Paragraph('UNIDAD TIEMPO', bold_sm)],
        [Paragraph(tipo_pago, normal_sm), Paragraph(f'${total_final:.2f}', normal_sm), Paragraph('0', normal_sm), Paragraph('DÍAS', normal_sm)],
    ]
    t_pago = Table(pago_data, colWidths=[W*0.35, W*0.25, W*0.2, W*0.2])
    t_pago.setStyle(TableStyle([
        ('FONTSIZE',(0,0),(-1,-1),8), ('BOX',(0,0),(-1,-1),0.5,colors.black),
        ('INNERGRID',(0,0),(-1,-1),0.3,colors.lightgrey),
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EFF6FF')),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),
    ]))
    elems.append(t_pago)
    elems.append(Spacer(1, 10))

    # ── PIE: información adicional ────────────────────────────────────────────
    pie_txt = (
        f"Dr./Dra. {inv.get('doctor_nombre','')} — {inv.get('especialidad','')}\n"
        f"Documento generado por FAMILY HEALTH · Sistema de Gestión Clínica\n"
        "Los servicios médicos están exentos de IVA según la Ley Orgánica de Régimen Tributario Interno."
    )
    elems.append(Paragraph(pie_txt, tiny_center))

    doc.build(elems)
    buffer.seek(0)
    return buffer
