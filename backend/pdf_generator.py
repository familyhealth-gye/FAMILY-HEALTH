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

    # Barra superior — azul oscuro (distinto al logo turquesa)
    canvas_obj.setFillColor(COLOR_AZUL)
    canvas_obj.rect(0, h - 1.1*inch, w, 1.1*inch, fill=1, stroke=0)

    # Logo
    if os.path.exists(LOGO_PATH):
        try:
            canvas_obj.drawImage(LOGO_PATH, 0.2*inch, h - 1.0*inch,
                                  width=0.85*inch, height=0.85*inch,
                                  preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    # Texto encabezado
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica-Bold", 8.5)
    canvas_obj.drawString(1.2*inch, h - 0.42*inch, "CENTRO DE ESPECIALIDADES FAMILY HEALTH")
    canvas_obj.setFont("Helvetica", 7.5)
    canvas_obj.drawString(1.2*inch, h - 0.58*inch, "CONTACTOS: 096-291-2170  /  04-500-7012")
    canvas_obj.drawString(1.2*inch, h - 0.72*inch, "DIRECCIÓN: MUCHO LOTE 2 MZ 2833 VILLA 15  |  FAMILYHEALTH.GYE")

    # Línea verde decorativa
    canvas_obj.setFillColor(COLOR_VERDE)
    canvas_obj.rect(0, h - 1.15*inch, w, 0.07*inch, fill=1, stroke=0)

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
                            rightMargin=0.45*inch, leftMargin=0.45*inch,
                            topMargin=1.25*inch, bottomMargin=0.6*inch)
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
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 40),
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