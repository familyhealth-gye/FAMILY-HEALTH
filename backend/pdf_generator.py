from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from io import BytesIO
from datetime import datetime


def generate_prescription_pdf(prescription_data: dict) -> BytesIO:
    """Generate prescription PDF in landscape format"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), 
                           rightMargin=0.5*inch, leftMargin=0.5*inch,
                           topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#00a8cc'),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor('#666666'),
        spaceAfter=12,
        alignment=TA_CENTER
    )
    
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.HexColor('#00a8cc'),
        spaceAfter=6,
        spaceBefore=12,
        fontName='Helvetica-Bold'
    )
    
    # Header
    elements.append(Paragraph("FAMILY HEALTH", title_style))
    elements.append(Paragraph("Toledo Externo, Mz 2833 V15 - Guayaquil, Ecuador | Tel: 0962912170", subtitle_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Title
    elements.append(Paragraph("RECETA MÉDICA", section_style))
    elements.append(Spacer(1, 0.1*inch))
    
    # Patient and Doctor Info
    info_data = [
        ['Paciente:', prescription_data['paciente_nombre'], 'Fecha:', prescription_data['fecha']],
        ['Cédula:', prescription_data['paciente_cedula'], 'Edad:', f"{prescription_data['paciente_edad']} años"],
        ['Doctor:', prescription_data['doctor_nombre'], 'Especialidad:', prescription_data['doctor_especialidad']]
    ]
    
    info_table = Table(info_data, colWidths=[1.2*inch, 3*inch, 1.2*inch, 2*inch])
    info_table.setStyle(TableStyle([
        ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 9),
        ('FONT', (2, 0), (2, -1), 'Helvetica-Bold', 9),
        ('FONT', (1, 0), (-1, -1), 'Helvetica', 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#333333')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Diagnosis
    elements.append(Paragraph("DIAGNÓSTICO", section_style))
    diag_text = prescription_data['diagnostico']
    if prescription_data.get('cie10_codigo'):
        diag_text += f" (CIE-10: {prescription_data['cie10_codigo']})"
    elements.append(Paragraph(diag_text, styles['Normal']))
    elements.append(Spacer(1, 0.15*inch))
    
    # Medications
    elements.append(Paragraph("MEDICAMENTOS", section_style))
    
    med_data = [['N°', 'Medicamento', 'Dosis', 'Frecuencia', 'Duración', 'Indicaciones']]
    for idx, med in enumerate(prescription_data['medicamentos'], 1):
        med_data.append([
            str(idx),
            med['nombre'],
            med['dosis'],
            med['frecuencia'],
            med['duracion'],
            med.get('indicaciones', '')
        ])
    
    med_table = Table(med_data, colWidths=[0.4*inch, 2*inch, 1*inch, 1.2*inch, 1*inch, 2*inch])
    med_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#00a8cc')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 9),
        ('FONT', (0, 1), (-1, -1), 'Helvetica', 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0f9ff')]),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(med_table)
    
    # General Instructions
    if prescription_data.get('indicaciones_generales'):
        elements.append(Spacer(1, 0.15*inch))
        elements.append(Paragraph("INDICACIONES GENERALES", section_style))
        elements.append(Paragraph(prescription_data['indicaciones_generales'], styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 0.3*inch))
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER
    )
    elements.append(Paragraph(f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}", footer_style))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
