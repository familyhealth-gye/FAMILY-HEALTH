from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from io import BytesIO
from datetime import datetime
import os

COLOR_AZUL = colors.HexColor('#00a8cc')
COLOR_VERDE = colors.HexColor('#6decb9')
COLOR_AZUL_OSCURO = colors.HexColor('#005f73')
COLOR_GRIS = colors.HexColor('#666666')
COLOR_FONDO = colors.HexColor('#f5faff')

LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'logo.png')


def _draw_header_footer(canvas_obj, doc):
    canvas_obj.saveState()
    width, height = doc.pagesize

    # Barra azul superior
    canvas_obj.setFillColor(COLOR_AZUL)
    canvas_obj.rect(0, height - 1.4*inch, width, 1.4*inch, fill=1, stroke=0)

    # Logo
    if os.path.exists(LOGO_PATH):
        try:
            canvas_obj.drawImage(LOGO_PATH, 0.3*inch, height - 1.25*inch,
                                  width=1.1*inch, height=1.1*inch,
                                  preserveAspectRatio=True, mask='auto')
        except Exception:
            pass

    # Texto encabezado
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica-Bold", 9)
    canvas_obj.drawString(1.6*inch, height - 0.52*inch, "CENTRO DE ESPECIALIDADES FAMILY HEALTH")
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawString(1.6*inch, height - 0.72*inch, "CONTACTOS: 096-291-2170  /  04-500-7012")
    canvas_obj.drawString(1.6*inch, height - 0.90*inch, "DIRECCION: MUCHO LOTE 2 MZ 2833 VILLA 15 | FAMILYHEALTH.GYE")

    # Línea verde decorativa
    canvas_obj.setFillColor(COLOR_VERDE)
    canvas_obj.rect(0, height - 1.5*inch, width, 0.1*inch, fill=1, stroke=0)

    # Marca de agua logo central
    if os.path.exists(LOGO_PATH):
        try:
            canvas_obj.saveState()
            canvas_obj.setFillAlpha(0.04)
            canvas_obj.drawImage(LOGO_PATH, width/2 - 2*inch, height/2 - 2*inch,
                                  width=4*inch, height=4*inch,
                                  preserveAspectRatio=True, mask='auto')
            canvas_obj.restoreState()
        except Exception:
            pass

    # Barra azul pie de página
    canvas_obj.setFillColor(COLOR_AZUL)
    canvas_obj.rect(0, 0, width, 0.7*inch, fill=1, stroke=0)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont("Helvetica", 7.5)
    canvas_obj.drawString(0.3*inch, 0.43*inch,
        "MUCHO LOTE 2 VILLA ESPANA 2 MZ 2833 V15  |  Family Health  |  @familyhealth.gye")
    canvas_obj.drawString(0.3*inch, 0.26*inch,
        "0962 912 170  |  teethcarestudio@hotmail.com  |  Guayaquil - Ecuador")
    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.drawRightString(width - 0.3*inch, 0.43*inch,
        f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    canvas_obj.restoreState()


def _get_styles():
    styles = getSampleStyleSheet()
    return {
        'titulo': ParagraphStyle('FHTitulo', parent=styles['Heading1'],
            fontSize=14, textColor=COLOR_AZUL, spaceAfter=4,
            alignment=TA_CENTER, fontName='Helvetica-Bold'),
        'seccion': ParagraphStyle('FHSeccion', parent=styles['Heading2'],
            fontSize=10, textColor=colors.white, spaceAfter=4, spaceBefore=8,
            fontName='Helvetica-Bold', backColor=COLOR_AZUL, leading=16),
        'normal': ParagraphStyle('FHNormal', parent=styles['Normal'],
            fontSize=9, textColor=colors.HexColor('#333333'), spaceAfter=3),
        'base': styles,
    }


def generate_prescription_pdf(prescription_data: dict) -> BytesIO:
    buffer = BytesIO()
    s = _get_styles()

    def on_page(canvas_obj, doc):
        _draw_header_footer(canvas_obj, doc)

    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            rightMargin=0.6*inch, leftMargin=0.6*inch,
                            topMargin=1.8*inch, bottomMargin=0.9*inch)
    elements = []

    elements.append(Paragraph("RECETA MÉDICA", s['titulo']))
    elements.append(Spacer(1, 0.15*inch))

    # Info paciente
    info_data = [
        ['Paciente:', prescription_data.get('paciente_nombre', ''), 'Fecha:', prescription_data.get('fecha', '')],
        ['Cédula:', prescription_data.get('paciente_cedula', ''), 'Edad:', f"{prescription_data.get('paciente_edad', '')} años"],
        ['Doctor:', prescription_data.get('doctor_nombre', ''), 'Especialidad:', prescription_data.get('doctor_especialidad', '')],
    ]
    info_table = Table(info_data, colWidths=[1.1*inch, 2.8*inch, 1.1*inch, 2.4*inch])
    info_table.setStyle(TableStyle([
        ('FONT', (0,0), (0,-1), 'Helvetica-Bold', 9),
        ('FONT', (2,0), (2,-1), 'Helvetica-Bold', 9),
        ('FONT', (1,0), (-1,-1), 'Helvetica', 9),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [COLOR_FONDO, colors.white]),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_AZUL),
        ('INNERGRID', (0,0), (-1,-1), 0.3, colors.HexColor('#dddddd')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.15*inch))

    # Diagnóstico
    elements.append(Paragraph("  DIAGNÓSTICO", s['seccion']))
    elements.append(Spacer(1, 0.06*inch))
    diag = prescription_data.get('diagnostico', '')
    cie = prescription_data.get('cie10_codigo', '')
    if cie:
        diag += f"  (CIE-10: {cie})"
    elements.append(Paragraph(diag, s['normal']))
    elements.append(Spacer(1, 0.12*inch))

    # Prescripción + Indicaciones en 2 columnas
    elements.append(Paragraph("  PRESCRIPCIÓN / INDICACIONES", s['seccion']))
    elements.append(Spacer(1, 0.06*inch))

    meds = prescription_data.get('medicamentos', [])
    presc_lines = []
    for i, med in enumerate(meds, 1):
        presc_lines.append(f"<b>{i}. {med.get('nombre','')}</b> {med.get('dosis','')}")
        presc_lines.append(f"   {med.get('frecuencia','')} por {med.get('duracion','')}")
        if med.get('indicaciones'):
            presc_lines.append(f"   <i>{med.get('indicaciones')}</i>")
        presc_lines.append("")
    presc_text = "<br/>".join(presc_lines) if presc_lines else "Sin medicamentos prescritos"

    indic = prescription_data.get('indicaciones_generales', '')
    indic_text = f"<b>INDICACIONES:</b><br/><br/>{indic}" if indic else "<b>INDICACIONES:</b><br/>"

    dual = [[Paragraph(presc_text, s['normal']), Paragraph(indic_text, s['normal'])]]
    dual_table = Table(dual, colWidths=[3.7*inch, 3.7*inch])
    dual_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.5, COLOR_AZUL),
        ('LINEBEFORE', (1,0), (1,0), 1, COLOR_AZUL),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 70),
    ]))
    elements.append(dual_table)

    # Precauciones
    precauc = prescription_data.get('precauciones', '')
    if precauc:
        elements.append(Spacer(1, 0.12*inch))
        elements.append(Paragraph("  PRECAUCIONES", s['seccion']))
        elements.append(Spacer(1, 0.06*inch))
        elements.append(Paragraph(precauc, s['normal']))

    doc.build(elements, onFirstPage=on_page, onLaterPages=on_page)
    buffer.seek(0)
    return buffer


def generate_certificado_pdf(data: dict) -> BytesIO:
    buffer = BytesIO()
    s = _get_styles()

    def on_page(canvas_obj, doc):
        _draw_header_footer(canvas_obj, doc)

    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=1.2*inch, leftMargin=1.2*inch,
                            topMargin=1.8*inch, bottomMargin=1*inch)
    elements = []

    elements.append(Paragraph("CERTIFICADO MÉDICO", s['titulo']))
    elements.append(Spacer(1, 0.4*inch))

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
    cert_style = ParagraphStyle('cert', parent=s['normal'], fontSize=11, leading=20, alignment=4)
    elements.append(Paragraph(texto, cert_style))
    elements.append(Spacer(1, 1*inch))

    firma = [[
        Paragraph(f"_________________________<br/><b>{data.get('doctor_nombre','')}</b><br/>Médico Tratante", s['normal']),
        Paragraph(f"_________________________<br/><b>Guayaquil, {fecha}</b><br/>Fecha y Lugar", s['normal'])
    ]]
    firma_t = Table(firma, colWidths=[3*inch, 3*inch])
    firma_t.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER'), ('VALIGN', (0,0), (-1,-1), 'TOP')]))
    elements.append(firma_t)

    doc.build(elements, onFirstPage=on_page, onLaterPages=on_page)
    buffer.seek(0)
    return buffer
